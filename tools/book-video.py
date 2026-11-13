#!/usr/bin/env python3
"""فيديوهات ملخصات الكتب ومراجعتها (video.yml):
الطابور data/video/_queue.json: {"items": [{"id": "<كتاب>", "style": "summary|review", "len": "short|medium|long",
  "aspect": "16:9|9:16", "voice": "gemini:Orus", "theme": "green|gold|night|auto", "note": "متطلبات المدير", "creative": 1}]}
- النص: من اختصار الكتاب (data/summ) إن وُجد، وإلا من نص الكتاب نفسه؛ يكتب النموذج مشاهد (عنوان، نقاط، نص الراوي) بألفاظ المؤلف وأمانة النقل.
  review: مشاهد أسئلة وأجوبة للمراجعة. creative: يقترح النموذج الألوان والزخرفة وتقسيم المشاهد بنفسه («إبداع من الموقع»).
- الصورة: كل مشهد صفحة HTML تُصوَّر بالمتصفح (tools/video-slides.js) فيسلم الخط العربي، والصوت: Gemini TTS (Orus/Charon) وإلا Edge.
- الإخراج: ffmpeg ← MP4 في إصدارات المستودع (video-<كتاب>)، والسجل data/video/_list.json."""
import asyncio, datetime, importlib.util, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import tashjir as T  # noqa: E402
spec = importlib.util.spec_from_file_location("tts", os.path.join(ROOT, "tools", "tts.py")); TTS = importlib.util.module_from_spec(spec); spec.loader.exec_module(TTS)
VD = os.path.join(ROOT, "data", "video"); QP, LP = os.path.join(VD, "_queue.json"), os.path.join(VD, "_list.json")
REPO = os.environ.get("GITHUB_REPOSITORY", "dawah-library/sdsl-library")
N = {"short": 5, "medium": 9, "long": 14}
THEMES = {"green": {"bg": "#0f3d33", "c1": "#ffffff", "acc": "#d4af37", "c2": "#cfe6dc"}, "gold": {"bg": "#f6efe1", "c1": "#3b2a1a", "acc": "#a5782e", "c2": "#6b5440"},
          "night": {"bg": "#111827", "c1": "#f9fafb", "acc": "#60a5fa", "c2": "#cbd5e1"}}

def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d

PROMPT = """أعدّ نص فيديو {kind} لكتاب «{title}» لـ{author}، في {n} مشاهد تقريبًا، للعرض على الشاشة مع راوٍ.
أخرج JSON حرفيًا: {{"title": "عنوان الفيديو", "scenes": [{{"h": "عنوان المشهد", "pts": ["نقطة قصيرة على الشاشة (٣–٤ نقاط، أقل من ١٢ كلمة لكل نقطة)"], "say": "ما يقوله الراوي في المشهد (٤٠–٩٠ كلمة) بعربية فصيحة سليمة مشكولة ما يُلتبس"}}]{theme_hint}}}
- المشهد الأول تعريف بالكتاب ومؤلفه وموضوعه، والأخير خلاصة جامعة ودعوة لقراءة الكتاب في المكتبة.
- التزم مضمون الكتاب وألفاظ مؤلفه وترتيب أفكاره، ولا تضف رأيًا ولا معلومة من خارجه، وانقل الآيات والأحاديث بلفظها إن ذكرتها.
{extra}
المادة:
{src}"""
REVIEW = "- اجعل المشاهد بعد الأول أسئلة مراجعة: h = السؤال، وpts = عناصر الجواب، وsay = طرح السؤال ثم جوابه الموجز."
CREATIVE = ', "theme": {"bg": "#rrggbb", "c1": "#rrggbb لون النص", "acc": "#rrggbb لون التمييز", "c2": "#rrggbb لون ثانوي", "pat": "stars|lines|arch|none"}'

def material(bid, cat):
    s = jl(os.path.join(ROOT, "data", "summ", bid + ".json"), None)
    if s and s.get("chs"):
        return s["t"], s.get("a", ""), "\n\n".join("## %s\n%s" % (c.get("t", ""), c.get("r25") or c.get("r10") or "") for c in s["chs"])[:60000]
    src = T.source(bid, cat)
    if not src: return None
    title, au, pages, sh = src; txt = "\n".join(re.sub(r"\n_{4,}[\s\S]*", "", p or "") for p in pages)
    if len(txt) > 90000:  # عينة متوزعة على الكتاب
        k = len(txt) // 90000 + 1; parts = [txt[i:i + 90000 // k] for i in range(0, len(txt), len(txt) // k)]; txt = "\n…\n".join(parts)
    return title, au, txt[:90000]

def render(scenes, theme, aspect, title, out):
    spec_ = {"scenes": scenes, "theme": theme, "aspect": aspect, "title": title, "out": out}
    p = os.path.join(out, "spec.json"); json.dump(spec_, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run(["node", os.path.join(ROOT, "tools", "video-slides.js"), p], check=True)

def secs(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0

async def speak(text, voice, path):
    if voice.startswith("gemini:"):
        try: TTS.speak_gemini(text, voice.split(":", 1)[1], path); return
        except Exception as e: print("  Gemini TTS تعذر:", str(e)[:120])
    await TTS.speak(text, "ar-SA-HamedNeural", "-5%", path)

async def make(it, cat, L):
    bid = it["id"]; m = material(bid, cat)
    if not m: print("لا مادة:", bid); return False
    title, au, src = m; style = it.get("style") or "summary"; n = N.get(it.get("len") or "medium", 9)
    j = T.gemini(PROMPT.format(kind="مراجعة واختبار" if style == "review" else "ملخص", title=title, author=au, n=n, src=src,
                               theme_hint=CREATIVE if it.get("creative") or it.get("theme") == "auto" else "",
                               extra="\n".join(x for x in [REVIEW if style == "review" else "", ("- متطلبات المدير: " + str(it["note"])[:800]) if it.get("note") else ""] if x)))
    if not j or not j.get("scenes"): print("تعذر النص:", bid); return False
    sc = [s for s in j["scenes"] if s.get("say")][:n + 2]
    th = dict(THEMES.get(it.get("theme"), THEMES["green"]))
    if isinstance(j.get("theme"), dict): th.update({k: v for k, v in j["theme"].items() if isinstance(v, str) and (re.fullmatch(r"#[0-9a-fA-F]{6}", v) or k == "pat")})
    aspect = it.get("aspect") if it.get("aspect") in ("16:9", "9:16") else "16:9"
    tmp = tempfile.mkdtemp(); render(sc, th, aspect, j.get("title") or title, tmp)
    segs = []
    for i, s in enumerate(sc):
        a = os.path.join(tmp, "a%02d.mp3" % i); await speak(s["say"], it.get("voice") or "gemini:Orus", a)
        d = secs(a) + 0.8; v = os.path.join(tmp, "s%02d.mp4" % i)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", "%.2f" % d, "-i", os.path.join(tmp, "f%02d.png" % i), "-i", a,
                        "-vf", "fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4,format=yuv420p" % max(0, d - 0.4), "-c:v", "libx264", "-preset", "veryfast", "-r", "25",
                        "-c:a", "aac", "-b:a", "96k", "-af", "apad", "-t", "%.2f" % d, v], check=True)
        segs.append(v)
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join("file '%s'\n" % x for x in segs))
    k = len((L.get(bid) or [])) + 1; fn = "%s-%s-%d.mp4" % (bid, style, k); outp = os.path.join(tmp, fn)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", outp], check=True)
    tag = "video-" + bid
    if subprocess.run(["gh", "release", "view", tag, "-R", REPO], capture_output=True).returncode:
        subprocess.run(["gh", "release", "create", tag, "-R", REPO, "--title", "فيديو: " + title, "--notes", "فيديوهات ملخص ومراجعة لكتاب في مكتبة الدعوة السلفية الرقمية.", "--latest=false"], check=True)
    subprocess.run(["gh", "release", "upload", tag, "-R", REPO, "--clobber", outp], check=True)
    L.setdefault(bid, []).append({"f": fn, "t": j.get("title") or title, "style": style, "len": it.get("len") or "medium", "aspect": aspect, "d": round(secs(outp)),
                                  "voice": it.get("voice") or "gemini:Orus", "at": str(datetime.date.today()), "scenes": [s.get("h", "") for s in sc], "ok": 0})
    print("✓ فيديو", title, fn); return True

async def main():
    Q = jl(QP, {"items": []}); L = jl(LP, {}); cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    left = []
    for it in Q.get("items") or []:
        try: ok = await make(it, cat, L)
        except Exception as e: print("✗", it.get("id"), str(e)[:200]); ok = False
        if not ok:
            it["err"] = (it.get("err") or 0) + 1
            if it["err"] < 3: left.append(it)
        json.dump(L, open(LP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    Q["items"] = left; json.dump(Q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    asyncio.run(main())
