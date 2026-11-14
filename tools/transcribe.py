#!/usr/bin/env python3
"""تحويل الصوتيات والمرئيات إلى نصوص ثم إلى كتب (البند ٣٨).
الطابور data/transcribe/_queue.json: {"items": [{"id": "...", "t": "عنوان الدرس أو السلسلة", "a": "معرّف المؤلف",
   "src": ["رابط مباشر أو يوتيوب أو فيسبوك", ...]  (أجزاء السلسلة بالترتيب), "date": "...", "note": "..."}]}
   ومن ملفات الجهاز (نموذج الإدارة): "store:au….mp3" في صندوق الرفع الخاص (رابط مؤقت من /api/r2put برمز OIDC)،
   أو "parts:<أساس>:<عدد>:<امتداد>" أجزاءً في data/transcribe/in/ تُجمع ثم تُحذف بعد اكتمال الكتاب. "fn": أسماء الملفات الأصلية.
المراحل:
 ١) التنزيل: yt-dlp (يوتيوب وفيسبوك وغيرهما) أو الرابط المباشر، ثم ffmpeg إلى صوت أحادي مضغوط، ويُقسَّم مقاطع (٢٠ دقيقة).
 ٢) التفريغ الحرفي: Gemini يستمع لكل مقطع ويكتب كلام الشيخ بلفظه (بالعربية الفصحى كما نطق، مع ضبط الآيات والأحاديث)،
    دون زيادة ولا حذف إلا التكرار اللفظي العارض؛ وما لم يتبين يُكتب [غير واضح]. وعند عدم توفر Gemini: faster-whisper محليًا.
 ٣) الكتاب: يُحفظ التفريغ كتابًا في data/books/<id>.json (صفحات بنحو ٢٥٠٠ حرف، وكل جزء من السلسلة باب) مع بطاقة في الفهرس
    موسومة «tafrigh» وروابط الأصل، ثم يُضاف إلى طابور «النسخة المحررة» (data/tfedit/_queue.json) فتُبنى منه نسخة مرتبة
    بعناوين وفقرات (وبأسلوب كتابي عند الطلب) — على منهج دليل معايير التحرير (#/standards).
لا يُنشر للأعضاء إلا بعد مراجعة الإدارة (hidden حتى الاعتماد)."""
import shutil, json, os, re, subprocess, sys, time, tempfile, glob, base64, urllib.request, urllib.error, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); Q = os.path.join(D, "transcribe", "_queue.json")
from gkeys import keys as _gkeys  # noqa: E402  (tools/gkeys.py)
KEYS = _gkeys("study")  # التفريغ خدمة كتب: يبدأ بالمفاتيح المحجوزة
MODELS = [m for m in os.environ.get("TR_MODELS", "gemini-flash-latest,gemini-3.5-flash").split(",") if m]
SEG = int(os.environ.get("TR_SEG_MIN", "20")) * 60
DEADLINE = time.time() + 60 * float(os.environ.get("TR_MINUTES", "300"))
PROMPT = ("فرّغ هذا التسجيل الصوتي لدرس شرعي تفريغًا حرفيًا أمينًا بالعربية: اكتب كلام المتكلم بلفظه كما قاله، "
          "واضبط الآيات بين ﴿ ﴾ والأحاديث بين « »، وقسّم الكلام فقرات بحسب المعنى، واحذف التكرار اللفظي العارض وأصوات التردد فقط. "
          "لا تلخص ولا تضف شرحًا ولا عناوين من عندك. ما لم يتبين لك اكتبه [غير واضح]. وإن تكلم سائل فاكتب: السائل: … ثم: الشيخ: …")
def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def js(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
def sh(*a, **k): return subprocess.run(list(a), capture_output=True, text=True, **k)

INB = os.path.join(D, "transcribe", "in")


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from storeurl import direct_url  # noqa: E402


def oidc_url(name):
    d = direct_url(name)
    if d: return d
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library",
                     headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=20).read())["value"]
    site = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
    try: return json.loads(urllib.request.urlopen(urllib.request.Request(site + "/api/r2put?f=" + name, headers=dict(UA, Authorization="Bearer " + tok)), timeout=30).read())["url"]
    except urllib.error.HTTPError as e: raise RuntimeError("الموقع رفض طلب الرابط: %s %s" % (e.code, e.read()[:200]))


UA = {"User-Agent": "dawahlibrary-transcribe/1.0"}
SB_URL = os.environ.get("SUPABASE_URL", "https://nqxkkdexpodjjwfdkxoq.supabase.co").rstrip("/")


def _http_err(e):
    return "%s %s" % (getattr(e, "code", ""), (e.read()[:200].decode("utf-8", "ignore") if hasattr(e, "read") else e))


def store_get(name, dest):
    """تنزيل ملف من صندوق الرفع الخاص: رابط مؤقت من الموقع (OIDC)، وإن تعذّر فمباشرة من Supabase Storage بالمفتاح السري للمهمة.
    (١٣ نوفمبر: ظل «شرح فقه السنة» عالقًا منذ ١٠ نوفمبر بخطأ 403 لا يُعرف مصدره، فصار الخطأ يُسجَّل بتفصيله وتُجرَّب الطريق الثانية.)"""
    errs = []
    try:
        u = oidc_url(name)
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=900) as r, open(dest, "wb") as o: shutil.copyfileobj(r, o, 1 << 20)
        return
    except Exception as e:
        errs.append("الرابط المؤقت: " + _http_err(e))
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if key:
        for auth in (False, True):
            h = dict(UA, apikey=key)
            if auth or not key.startswith("sb_"): h["Authorization"] = "Bearer " + key
            try:
                with urllib.request.urlopen(urllib.request.Request(SB_URL + "/storage/v1/object/inbox/" + name, headers=h), timeout=900) as r, open(dest, "wb") as o:
                    shutil.copyfileobj(r, o, 1 << 20)
                print("  نُزّل مباشرة من Supabase Storage:", name, flush=True); return
            except Exception as e:
                errs.append("Supabase مباشرة: " + _http_err(e))
    raise RuntimeError(" | ".join(errs))


def part_files(src):
    m = re.match(r"parts:([0-9a-z]+):(\d+):(\w+)$", src or "")
    return sorted(glob.glob(os.path.join(INB, m.group(1) + ".part*"))) if m else []


def fetch_audio(url, tmp, n):
    out = os.path.join(tmp, "src%d" % n)
    if url.startswith("store:"):  # ملف رفعه المشرف من جهازه إلى صندوق الرفع الخاص
        src = out + os.path.splitext(url)[1]
        store_get(url[6:], src)
    elif url.startswith("parts:"):  # ملف كبير أو فيديو رُفع أجزاءً إلى المستودع
        _, base, cnt, ext = url.split(":"); ps = part_files(url)
        if len(ps) != int(cnt): raise RuntimeError("أجزاء ناقصة %d من %s" % (len(ps), cnt))
        src = out + "." + ext
        with open(src, "wb") as o:
            for x in ps: o.write(open(x, "rb").read())
    elif re.search(r"youtu|facebook\.com|fb\.watch|soundcloud|archive\.org/details", url):
        r = sh("yt-dlp", "-q", "-f", "bestaudio/best", "-o", out + ".%(ext)s", "--no-playlist", url)
        files = glob.glob(out + ".*")
        if not files: raise RuntimeError("تعذّر التنزيل: " + (r.stderr or "")[-300:])
        src = files[0]
    else:
        src = out + ".bin"; urllib.request.urlretrieve(url, src)
    if not os.path.exists(src) or os.path.getsize(src) < 1000: raise RuntimeError("الملف فارغ أو لم يُنزَّل")
    mono = os.path.join(tmp, "a%d.ogg" % n)
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libopus", "-b:a", "24k", mono)
    os.remove(src)
    dur = float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mono).stdout.strip() or 0)
    parts = []
    for k, s in enumerate(range(0, int(dur) + 1, SEG)):
        p = os.path.join(tmp, "a%d_%03d.ogg" % (n, k))
        sh("ffmpeg", "-y", "-loglevel", "error", "-ss", str(s), "-t", str(SEG + 5), "-i", mono, "-c", "copy", p)
        if os.path.exists(p) and os.path.getsize(p) > 2000: parts.append(p)
    return parts, dur

def gemini_audio(path):
    data = base64.b64encode(open(path, "rb").read()).decode()
    body = json.dumps({"contents": [{"parts": [{"text": PROMPT}, {"inline_data": {"mime_type": "audio/ogg", "data": data}}]}], "generationConfig": {"temperature": 0.1}}).encode()
    err = None
    for m in MODELS:
        for k in KEYS:
            try:
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % m, data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
                j = json.load(urllib.request.urlopen(req, timeout=900))
                return "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"]).strip()
            except urllib.error.HTTPError as e: err = "HTTP %d" % e.code; continue
            except Exception as e: err = str(e)[:120]; continue
    raise RuntimeError("Gemini: %s" % err)

def whisper(path):
    from faster_whisper import WhisperModel
    global WM
    try: WM
    except NameError: WM = WhisperModel(os.environ.get("TR_WHISPER", "large-v3-turbo"), device="cpu", compute_type="int8")
    segs, _ = WM.transcribe(path, language="ar", vad_filter=True, beam_size=5, initial_prompt="درس علمي شرعي باللغة العربية: قال الله تعالى، قال رسول الله صلى الله عليه وسلم.")
    return "\n".join(s.text.strip() for s in segs)

def paginate(chunks):
    pages = []
    for title, text in chunks:
        cur = "# " + title + "\n" if title else ""
        for para in [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]:
            if len(cur) + len(para) > 2500 and cur.strip(): pages.append(cur.strip()); cur = ""
            cur += para + "\n\n"
        if cur.strip(): pages.append(cur.strip())
    return pages

def main():
    q = jl(Q, {"items": []}); cat = jl(os.path.join(D, "catalog.json"), {"books": []}); done = []
    for it in list(q.get("items", [])):
        if time.time() > DEADLINE: break
        bid = it["id"]; work = os.path.join(D, "transcribe", "_work", bid + ".json"); W = jl(work, {"parts": {}})
        print("تفريغ:", it.get("t"), flush=True)
        with tempfile.TemporaryDirectory() as tmp:
            for n, url in enumerate(it.get("src") or []):
                if str(n) in W["parts"]: continue
                try:
                    parts, dur = fetch_audio(url, tmp, n); texts = []
                    for p in parts:
                        if time.time() > DEADLINE: raise TimeoutError()
                        try: texts.append(gemini_audio(p) if KEYS else whisper(p))
                        except Exception as e:
                            print("  Gemini:", e, "← faster-whisper", flush=True); texts.append(whisper(p))
                    W["parts"][str(n)] = {"u": url, "d": round(dur), "t": "\n\n".join(texts)}; js(work, W)
                    print("  الجزء %d: %d دقيقة" % (n + 1, dur // 60), flush=True)
                except TimeoutError:
                    break
                except Exception as e:
                    print("  تعذّر الجزء", n + 1, e, flush=True); W.setdefault("err", {})[str(n)] = str(e)[:300]; js(work, W)
        srcs = it.get("src") or []
        if not all(str(n) in W["parts"] for n in range(len(srcs))): continue  # يُستكمل في الجولة القادمة
        multi = len(srcs) > 1
        pages = paginate([(("المجلس %d" % (n + 1)) if multi else "", W["parts"][str(n)]["t"]) for n in range(len(srcs))])
        toc = []; acc = 0
        if multi:
            for i, p in enumerate(pages):
                m = re.match(r"# (المجلس \d+)", p)
                if m: toc.append({"t": m.group(1), "p": i + 1, "l": 1})
        js(os.path.join(D, "books", bid + ".json"), {"id": bid, "pages": pages, "toc": toc})
        meta = {"id": bid, "title": it.get("t") or bid, "authorId": it.get("a") or "", "topicId": it.get("tp") or "", "col": "dawah", "type": "book", "n": len(pages),
                "added": str(datetime.date.today()), "size": sum(len(p) for p in pages), "tags": ["tafrigh"], "source": "تفريغ آلي لدروس صوتية: " + (" ، ".join((it.get("fn") or [])[:3]) or " ، ".join(x for x in srcs[:3] if x.startswith("http"))) + (" …" if len(srcs) > 3 else ""),
                "hidden": True, "unrev": len(pages), "tfauto": 1}
        web = [x for x in srcs if x.startswith("http")]
        if web: meta["audio"] = web[0]
        cat["books"] = [b for b in cat["books"] if b["id"] != bid] + [meta]; cat["version"] = int(time.time() * 1000)
        js(os.path.join(D, "catalog.json"), cat)
        tq = jl(os.path.join(D, "tfedit", "_queue.json"), {"items": []})
        if not any((x.get("id") if isinstance(x, dict) else x) == bid for x in tq["items"]): tq["items"].append({"id": bid}); js(os.path.join(D, "tfedit", "_queue.json"), tq)
        done.append(bid); q["items"] = [x for x in q["items"] if x["id"] != bid]; js(Q, q)
        for x in [y for u in srcs for y in part_files(u)] + [work]:  # أجزاء الملفات المرفوعة لم تعد لازمة بعد اكتمال الكتاب
            try: os.remove(x)
            except Exception: pass
        print("  ✓ كتاب «%s»: %d صفحة (مخفي حتى المراجعة)، وأُضيف إلى طابور النسخة المحررة" % (meta["title"], len(pages)), flush=True)
    open(os.path.join(ROOT, ".tr-report.txt"), "w", encoding="utf-8").write(("🎙️ <b>تفريغ الصوتيات</b>: " + "، ".join(done)) if done else "")

if __name__ == "__main__":
    main()
