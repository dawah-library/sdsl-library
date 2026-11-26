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
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("transcribe")  # يدوي فقط
import shutil, json, os, re, subprocess, sys, time, tempfile, glob, base64, urllib.request, urllib.error, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); Q = os.path.join(D, "transcribe", "_queue.json")
from gkeys import keys as _gkeys  # noqa: E402  (tools/gkeys.py)
KEYS = _gkeys("study")  # التفريغ خدمة كتب: يبدأ بالمفاتيح المحجوزة
MODELS = [m for m in os.environ.get("TR_MODELS", "gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash,gemini-flash-latest").split(",") if m]
SEG = int(os.environ.get("TR_SEG_MIN", "10")) * 60  # مقاطع أقصر أدق (كانت ٢٠ دقيقة)
WAIT_DAYS = float(os.environ.get("TR_WAIT_DAYS", "3"))  # لا يُلجأ إلى Whisper إلا إذا تعذّر Gemini هذه المدة
class Defer(Exception): pass  # تعذّر Gemini اليوم: يُستكمل في التشغيل القادم بدل التفريغ الضعيف
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

def context(it, cat):
    """سياق الدرس للنموذج: العنوان والشيخ والكتاب المشروح، فيُضبط ما يشتبه سماعه من الأسماء والمصطلحات."""
    a = next((x for x in cat.get("authors", []) if x.get("id") == it.get("a")), {})
    t = it.get("t") or ""; bk = it.get("ctx") or (re.sub(r"^شرح\s+", "", t) if t.startswith("شرح") else "")
    return "سياق التسجيل: درس بعنوان «%s»%s%s. استعن بهذا السياق في ضبط أسماء الأعلام والكتب والمصطلحات الشرعية." % (
        t, (" للشيخ " + re.sub(r"^الشيخ\s+", "", a["name"])) if a.get("name") else "", ("، وهو شرح لكتاب «%s»" % bk) if bk else "")


DEAD = set()  # (مفتاح، نموذج) نفدت حصته اليومية


def gemini_call(parts, timeout=900):
    err = None
    for m in MODELS:
        for k in KEYS:
            if (k, m) in DEAD: continue
            try:
                body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"temperature": 0.1}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % m, data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
                j = json.load(urllib.request.urlopen(req, timeout=timeout))
                return "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought")).strip()
            except urllib.error.HTTPError as e:
                msg = e.read()[:600].decode("utf-8", "ignore"); err = "HTTP %d %s" % (e.code, msg[:80])
                if e.code in (400, 403, 404) or (e.code == 429 and re.search(r"PerDay|per day|exceeded your current quota", msg, re.I)): DEAD.add((k, m))
                continue
            except Exception as e: err = str(e)[:120]; continue
    raise Defer("Gemini: %s" % err)


def gemini_audio(path, ctx="", prev=""):
    data = base64.b64encode(open(path, "rb").read()).decode()
    note = ctx + ("\nآخر ما قيل قبل هذا المقطع (للاتصال فقط، لا تكرره): «%s»" % prev[-300:] if prev else "")
    return gemini_call([{"text": PROMPT + "\n" + note}, {"inline_data": {"mime_type": "audio/ogg", "data": data}}])


CORRECT = ("أمامك تفريغ آلي لدرس شرعي فيه أخطاء سماع. صحّحه تصحيحًا محافظًا: أصلح الكلمات التي أخطأ فيها التفريغ بما يقتضيه السياق "
           "(الأعلام والكتب والمصطلحات الشرعية، وألفاظ الآيات والأحاديث والأدعية المشهورة)، وضع علامات الترقيم، واجمع الأسطر المتقطعة جملًا وفقرات بحسب المعنى، "
           "واضبط الآيات بين ﴿ ﴾ بلفظ المصحف والأحاديث بين « ». لا تلخّص ولا تحذف ولا تضف شرحًا، ولا تغيّر عبارة المتكلم إذا كانت صحيحة ولو كانت عامية. "
           "ما لم تتبين صوابه فاتركه كما هو. أخرج النص المصحَّح وحده.")


def correct(text, ctx):
    """جولة تصحيح نصية بعد التفريغ؛ تُرفض نتيجتها إن اختلف طولها كثيرًا (حذف أو زيادة)."""
    out, chunks, cur = [], [], ""
    for para in re.split(r"\n\s*\n", text):
        if len(cur) + len(para) > 6000 and cur: chunks.append(cur); cur = ""
        cur += para + "\n\n"
    if cur.strip(): chunks.append(cur)
    for c in chunks:
        try: r = gemini_call([{"text": CORRECT + "\n" + ctx + "\n\nالنص:\n" + c}], timeout=300)
        except Defer: return None
        r = (r or "").strip()
        out.append(r if r and 0.75 * len(c) <= len(r) <= 1.3 * len(c) else c.strip())
    return "\n\n".join(out)


def gemini_audio_old(path):
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
    segs, _ = WM.transcribe(path, language="ar", vad_filter=True, beam_size=5, condition_on_previous_text=True,
                            initial_prompt="درس علمي شرعي باللغة العربية الفصحى: بسم الله الرحمن الرحيم، الحمد لله، قال الله تعالى، قال رسول الله صلى الله عليه وسلم، رضي الله عنه، رحمه الله.")
    # المقاطع جمل قصيرة متقطعة: تُجمع فقرات عند الوقفات الطويلة (أكثر من ثانيتين) أو كل نحو ٦٠٠ حرف
    paras, cur, last = [], "", 0.0
    for sg in segs:
        t = sg.text.strip()
        if not t: continue
        if cur and (sg.start - last > 2.0 or len(cur) > 600): paras.append(cur.strip()); cur = ""
        cur += " " + t; last = sg.end
    if cur.strip(): paras.append(cur.strip())
    return "\n\n".join(paras)

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
        ctx = context(it, cat); W.setdefault("since", time.time())
        # Whisper لا يُلجأ إليه إلا إذا تعذّر Gemini أيامًا (TR_WAIT_DAYS)، ثم بالنموذج الكبير وجولة التصحيح
        allow_whisper = not KEYS or (time.time() - W["since"]) > WAIT_DAYS * 86400
        with tempfile.TemporaryDirectory() as tmp:
            for n, url in enumerate(it.get("src") or []):
                if str(n) in W["parts"]: continue
                try:
                    parts, dur = fetch_audio(url, tmp, n); texts = []; eng = "gemini"
                    for p in parts:
                        if time.time() > DEADLINE: raise TimeoutError()
                        try: texts.append(gemini_audio(p, ctx, texts[-1] if texts else "") if KEYS else whisper(p))
                        except Defer as e:
                            if not allow_whisper: raise
                            print("  Gemini:", e, "← faster-whisper (large)", flush=True); texts.append(whisper(p)); eng = "whisper"
                    W["parts"][str(n)] = {"u": url, "d": round(dur), "t": "\n\n".join(texts), "e": eng}; js(work, W)
                    print("  الجزء %d: %d دقيقة (%s)" % (n + 1, dur // 60, eng), flush=True)
                except TimeoutError:
                    break
                except Defer as e:
                    print("  تعذّر Gemini اليوم؛ يُستكمل في التشغيل القادم:", e, flush=True); W.setdefault("err", {})[str(n)] = str(e)[:300]; js(work, W); break
                except Exception as e:
                    print("  تعذّر الجزء", n + 1, e, flush=True); W.setdefault("err", {})[str(n)] = str(e)[:300]; js(work, W)
            # جولة التصحيح النصية لكل جزء لم يُصحَّح بعد
            for n, P in sorted(W["parts"].items()):
                if P.get("fix") or time.time() > DEADLINE: continue
                r = correct(P["t"], ctx)
                if r is None: print("  التصحيح: تعذّر Gemini؛ يُستكمل لاحقًا", flush=True); break
                P["raw"] = P["t"]; P["t"] = r; P["fix"] = 1; js(work, W); print("  صُحّح الجزء", int(n) + 1, flush=True)
        srcs = it.get("src") or []
        if not all(str(n) in W["parts"] for n in range(len(srcs))): continue  # يُستكمل في الجولة القادمة
        if not all(W["parts"][str(n)].get("fix") for n in range(len(srcs))) and (time.time() - W["since"]) < WAIT_DAYS * 86400: continue  # ينتظر التصحيح
        multi = len(srcs) > 1
        pages = paginate([(("المجلس %d" % (n + 1)) if multi else "", W["parts"][str(n)]["t"]) for n in range(len(srcs))])
        toc = []; acc = 0
        if multi:
            for i, p in enumerate(pages):
                m = re.match(r"# (المجلس \d+)", p)
                if m: toc.append({"t": m.group(1), "p": i + 1, "l": 1})
        # الآيات بلفظ المصحف (أداة فحص الآيات نفسها)
        try:
            import importlib.util
            spq = importlib.util.spec_from_file_location("qc", os.path.join(ROOT, "tools", "quran-check.py")); qc = importlib.util.module_from_spec(spq); spq.loader.exec_module(qc)
            QQ = qc.load_quran(); IXQ = qc.Index(QQ, qc.load_tash(QQ)); fx = []
            pages = [qc.fix_page(pg, IXQ, i, fx) for i, pg in enumerate(pages)]
            if fx: print("  ضُبطت %d آية بلفظ المصحف" % len(fx), flush=True)
        except Exception as e: print("  فحص الآيات:", str(e)[:120], flush=True)
        js(os.path.join(D, "books", bid + ".json"), {"id": bid, "pages": pages, "toc": toc})
        meta = {"id": bid, "title": it.get("t") or bid, "authorId": it.get("a") or "", "topicId": it.get("tp") or "", "col": "dawah", "type": "book", "n": len(pages),
                "added": str(datetime.date.today()), "size": sum(len(p) for p in pages), "tags": ["tafrigh"], "source": "تفريغ آلي لدروس صوتية: " + (" ، ".join((it.get("fn") or [])[:3]) or " ، ".join(x for x in srcs[:3] if x.startswith("http"))) + (" …" if len(srcs) > 3 else ""),
                "hidden": True, "unrev": len(pages), "tfauto": 1, "trsrc": srcs, "treng": sorted({W["parts"][str(n)].get("e", "gemini") for n in range(len(srcs))})}
        # الكتاب المشروح وسلسلة الشرح (تُكمَّل بدروس لاحقة): it.ser سلسلة قائمة، it.ctx الكتاب المشروح
        import series as SR
        if it.get("ser"): SR.cont(cat, it["ser"], meta)
        if it.get("ctx") and not meta.get("sharh") and not meta.get("matn"):
            mid, mname = SR.matn_of(cat, it["ctx"])
            if mid: meta["sharh"] = mid
            elif mname: meta["matn"] = mname
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
