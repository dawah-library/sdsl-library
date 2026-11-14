#!/usr/bin/env python3
"""فيديوهات ملخصات الكتب ومراجعتها (video.yml ← video.js #/video).
الطابور data/video/_queue.json: {"items": [...]} وأنواع العناصر:
  ١) توليد: {"id": "<كتاب>", "style", "min"|"scenes", "aud", "tone", "topics", "ideas", "intro", "outro", "aspects": ["16:9","9:16","4:5","1:1"],
     "voice": "gemini:Charon|gemini:Orus", "theme", "font", "pat", "cap", "pages": 1, "sfx": 1, "note", "creative", "phase": "script"?}
  ٢) إخراج مسودة بعد المونتاج: {"id", "draft": "<مسودة>"} (مع خيارات تغلب خيارات المسودة)
  ٣) تصحيح فيديو قبل اعتماده: {"id", "draft", "fix": {"notes": "...", "lex": [["برهامي","بُرْهامي"]]}, "replace": "<ملف الفيديو>"}
     تُطبَّق الملاحظات على نص المسودة نفسها (لا يُعاد إنشاء الفيديو من الكتاب)، ويُعاد الإخراج ويحل محل الفيديو السابق.
- كل فيديو له مسودة (data/video/drafts/<id>.json) فيمكن تصحيحه وتعديله بعد توليده.
- النطق: قاموس data/video/_lexicon.json (وقاموس الصوتيات data/audio/_lexicon.json) يُطبَّق على نص الراوي قبل التسجيل لا على النص المعروض.
- الصوت: نموذجان فقط (Gemini TTS: Charon وOrus)، ويُخزَّن تسجيل كل مشهد في إصدار الكتاب ببصمة نصه، فلا يُعاد إلا ما تغيّر.
- صفحات الكتاب (pages): يظهر في أول كل مشهد الصفحة التي أُخذ منها (المصورة من R2 إن وُجدت، وإلا صفحة النص) تنقلب ثم يمر عليها
  قلم التحديد على العبارة المقصودة، مع صوت القلم وتقليب الورق (sfx). موضع العبارة في المصورة من tesseract (سطورها)، وإلا تُعرض صفحة النص.
- الإخراج: ffmpeg ← MP4 لكل مقاس مختار في إصدارات المستودع (video-<كتاب>)، والسجل data/video/_list.json."""
import asyncio, datetime, hashlib, importlib.util, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import tashjir as T  # noqa: E402
spec = importlib.util.spec_from_file_location("tts", os.path.join(ROOT, "tools", "tts.py")); TTS = importlib.util.module_from_spec(spec); spec.loader.exec_module(TTS)
VD = os.path.join(ROOT, "data", "video"); QP, LP = os.path.join(VD, "_queue.json"), os.path.join(VD, "_list.json")
REPO = os.environ.get("GITHUB_REPOSITORY", "dawah-library/sdsl-library")
N = {"short": 5, "medium": 9, "long": 14}
DRAFTS = os.path.join(VD, "drafts")
ASPECTS = ("16:9", "9:16", "4:5", "1:1")
VOICES = ("gemini:Charon", "gemini:Orus")
FPS = 20
KIND = {"summary": "ملخص", "review": "مراجعة واختبار", "benefits": "أبرز الفوائد والدروس المستفادة", "story": "سرد قصصي متسلسل لأحداثه وأفكاره", "faq": "أسئلة شائعة وأجوبتها من الكتاب",
        "quotes": "مختارات من أقوال المؤلف بنصها مع تعليق موجز", "intro": "تعريف ترويجي قصير بالكتاب يدعو إلى قراءته", "lesson": "درس تعليمي مبسط مرتب كالدرس",
        "features": "عرض مميزات الكتاب ومنهج مؤلفه وقيمته العلمية ولمن يُنصح به", "critique": "قراءة نقدية علمية منصفة: مزايا الكتاب، وما يُستدرك عليه بأدب وإنصاف ودليل، دون تجريح، مع التنبيه على أن الاستدراك اجتهاد",
        "part": "حديث مفصل عن الجزء أو الباب المحدد من الكتاب"}
AUD = {"general": "عموم المسلمين", "students": "طلاب العلم", "youth": "الشباب", "kids": "الأطفال (بلغة سهلة جدًا)", "women": "النساء والفتيات"}
TONE = {"calm": "هادئ وقور", "warm": "دافئ مؤثر", "lively": "حيوي حماسي معتدل", "teach": "تعليمي مبسط"}
THEMES = {"green": {"bg": "#0f3d33", "c1": "#ffffff", "acc": "#d4af37", "c2": "#cfe6dc"}, "gold": {"bg": "#f6efe1", "c1": "#3b2a1a", "acc": "#a5782e", "c2": "#6b5440"},
          "night": {"bg": "#111827", "c1": "#f9fafb", "acc": "#60a5fa", "c2": "#cbd5e1"}}


def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def jw(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


PROMPT = """أعدّ نص فيديو ({kind}) لكتاب «{title}» لـ{author}، في {n} مشاهد تقريبًا، للعرض على الشاشة مع راوٍ. الجمهور: {aud}. أسلوب الإلقاء: {tone}.
أخرج JSON حرفيًا: {{"title": "عنوان الفيديو", "scenes": [{{"h": "عنوان المشهد", "pts": ["نقطة قصيرة على الشاشة (٣–٤ نقاط، أقل من ١٢ كلمة لكل نقطة)"], "say": "ما يقوله الراوي في المشهد (٤٠–٩٠ كلمة) بعربية فصيحة سليمة مشكولة ما يُلتبس", "pg": رقم الصفحة التي أُخذ منها المشهد من علامات [ص …], "q": "عبارة قصيرة (٥–١٢ كلمة) منقولة بلفظها من تلك الصفحة هي أصل المشهد"}}]{theme_hint}}}
- المشهد الأول تعريف بالكتاب ومؤلفه وموضوعه، والأخير خلاصة جامعة ودعوة لقراءة الكتاب في المكتبة.
- التزم مضمون الكتاب وألفاظ مؤلفه وترتيب أفكاره، ولا تضف رأيًا ولا معلومة من خارجه، وانقل الآيات والأحاديث بلفظها إن ذكرتها.
- اضبط بالشكل أسماء الأعلام والكلمات التي يُخطأ في نطقها في نص الراوي (say).
{extra}
المادة (علامات [ص N] أرقام صفحات الكتاب):
{src}"""
REVIEW = "- اجعل المشاهد بعد الأول أسئلة مراجعة: h = السؤال، وpts = عناصر الجواب، وsay = طرح السؤال ثم جوابه الموجز."
CREATIVE = ', "theme": {"bg": "#rrggbb", "c1": "#rrggbb لون النص", "acc": "#rrggbb لون التمييز", "c2": "#rrggbb لون ثانوي", "pat": "stars|lines|arch|none"}'
FIX = """هذه مشاهد فيديو عن كتاب «{title}» (JSON). طبّق ملاحظات المدير وتصحيحاته الآتية بدقة، ولا تغيّر شيئًا لم تتناوله الملاحظات،
وأبقِ بنية كل مشهد (h, pts, say, pg, q, min) وترتيب المشاهد إلا أن تطلب الملاحظات حذفًا أو إضافة أو ترتيبًا.
- إن تناولت الملاحظات نطق كلمة أو اسم (مثل اسم شيخ) فاضبطها بالشكل الكامل في say حيث وردت، وأضفها إلى "lex": [["الكلمة كما تُكتب بلا شكل", "نطقها مشكولًا"]].
- لا تضف معلومة من خارج المشاهد إلا ما نصت عليه الملاحظات.
أخرج JSON حرفيًا: {{"title": "...", "scenes": [...], "lex": [["…","…"]]}}

ملاحظات المدير:
{notes}

المشاهد:
{scenes}"""


# ———— المادة ————
def material(bid, cat, topics=None):
    s = jl(os.path.join(ROOT, "data", "summ", bid + ".json"), None)
    if s and s.get("chs"):
        chs = [c for c in s["chs"] if not topics or any(t and (t in (c.get("t") or "") or (c.get("t") or "") in t) for t in topics)] or s["chs"]
        def rng(c):
            try: a = json.loads(c.get("p") or "[]"); return " [ص %s–%s]" % (a[0], a[-1]) if a else ""
            except Exception: return ""
        return s["t"], s.get("a", ""), "\n\n".join("## %s%s\n%s" % (c.get("t", ""), rng(c), c.get("r25") or c.get("r10") or "") for c in chs)[:60000]
    src = T.source(bid, cat)
    if not src: return None
    title, au, pages, sh = src
    idx = list(range(len(pages)))
    if topics and sh.get("toc"):  # الموضوعات المختارة: صفحات أبوابها وحدها
        toc = [x for x in sh["toc"] if x.get("p")]; keep = set()
        for i, x in enumerate(toc):
            if any(t in (x.get("t") or "") for t in topics): keep |= set(range(x["p"] - 1, (toc[i + 1]["p"] - 1) if i + 1 < len(toc) else len(pages)))
        if keep: idx = [i for i in sorted(keep) if i < len(pages)]
    txt = "\n".join("[ص %d] %s" % (i + 1, re.sub(r"\n_{4,}[\s\S]*", "", pages[i] or "")) for i in idx)
    if len(txt) > 90000:  # عينة متوزعة على الكتاب
        k = len(txt) // 90000 + 1; parts = [txt[i:i + 90000 // k] for i in range(0, len(txt), len(txt) // k)]; txt = "\n…\n".join(parts)
    return title, au, txt[:90000]


# ———— مطابقة العبارة بالصفحة وسطور المصورة ————
DIAC = re.compile(r"[ً-ْٰـ]")
def norm(s):
    s = DIAC.sub("", str(s or "")); s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return re.findall(r"[ء-ي]{2,}", s)


def overlap(q, t):
    a, b = set(norm(q)), set(norm(t))
    return len(a & b)


def locate(sc, pages):
    """رقم الصفحة الأقرب لعبارة المشهد: المقترح من النموذج وما حوله (±٣)، أو الكتاب كله إن لم يقترح."""
    q = (sc.get("q") or "") + " " + (sc.get("h") or "")
    try: pg = int(sc.get("pg") or 0)
    except Exception: pg = 0
    cand = range(max(1, pg - 3), min(len(pages), pg + 3) + 1) if pg else range(1, len(pages) + 1)
    best, bs = 0, 0
    for p in cand:
        s = overlap(q, re.sub(r"\n_{4,}[\s\S]*", "", pages[p - 1] or ""))
        if s > bs: best, bs = p, s
    return best if bs >= 2 else (pg if 0 < pg <= len(pages) else 0)


def pdf_page(b, sh, p):  # مثل pdfPageFor في app.js
    off = int(b.get("pdfOffset") or 0); pm = sh.get("pmap")
    if isinstance(pm, list) and p - 1 < len(pm) and pm[p - 1]: return int(pm[p - 1]) + off
    if b.get("pdfByLabel") and isinstance(sh.get("pl"), list) and p - 1 < len(sh["pl"]):
        m = re.search(r"(\d+)\s*$", str(sh["pl"][p - 1] or ""))
        if m: return int(m.group(1)) + off
    return p + off


R2 = None
def r2_img(bid, n, out):
    """صورة الصفحة من مخزن R2 الخاص (books/<id>/p0001.webp) ← PNG؛ None إن تعذرت."""
    global R2
    env = {k: os.environ.get(k, "").strip() for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")}
    if not all(env.values()): return None
    try:
        if R2 is None:
            import boto3
            R2 = boto3.client("s3", endpoint_url="https://%s.r2.cloudflarestorage.com" % env["R2_ACCOUNT_ID"], aws_access_key_id=env["R2_ACCESS_KEY_ID"],
                              aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"], region_name="auto")
        w = out + ".webp"; R2.download_file(env["R2_BUCKET"], "books/%s/p%04d.webp" % (bid, n), w)
        from PIL import Image
        Image.open(w).convert("RGB").save(out); os.unlink(w); return out
    except Exception as e:
        print("  صورة الصفحة تعذرت:", bid, n, str(e)[:100]); return None


def ocr_boxes(img, q):
    """سطور العبارة في الصورة بـ tesseract: [[x,y,w,h] نسبًا من ٠ إلى ١] للسطور الأكثر مطابقة (حتى ٣ متتالية)."""
    if not shutil.which("tesseract") or not q: return []
    try:
        r = subprocess.run(["tesseract", img, "stdout", "-l", "ara", "--psm", "4", "tsv"], capture_output=True, text=True, timeout=120)
        from PIL import Image
        W, H = Image.open(img).size
    except Exception: return []
    lines = {}
    for row in r.stdout.splitlines()[1:]:
        c = row.split("\t")
        if len(c) < 12 or not c[11].strip(): continue
        k = (c[2], c[3], c[4]); x, y, w, h = map(int, c[6:10])
        L = lines.setdefault(k, {"t": "", "b": [x, y, x + w, y + h]}); L["t"] += " " + c[11]
        b = L["b"]; L["b"] = [min(b[0], x), min(b[1], y), max(b[2], x + w), max(b[3], y + h)]
    L = sorted(lines.values(), key=lambda v: v["b"][1]); qn = set(norm(q))
    if not L or not qn: return []
    best, bs = None, 0
    for i in range(len(L)):
        for n in (1, 2, 3):
            seg = L[i:i + n]
            if len(seg) < n: break
            s = len(qn & set(norm(" ".join(x["t"] for x in seg))))
            if s > bs or (s == bs and best and n < len(best)): best, bs = seg, s
    if not best or bs < max(2, min(4, len(qn) // 3)): return []
    return [[x["b"][0] / W, x["b"][1] / H, (x["b"][2] - x["b"][0]) / W, (x["b"][3] - x["b"][1]) / H] for x in best]


def mark_text(text, q):
    """نص الصفحة مع تعليم الجملة الأقرب للعبارة بـ ⟦ ⟧ (لصفحة النص إن لم تتوفر المصورة)."""
    t = re.sub(r"\n_{4,}[\s\S]*", "", text or "").strip(); t = re.sub(r"(?m)^(#+|@@|<<)\s*", "", t)
    sents = re.split(r"(?<=[.؟!:؛\n])", t); best, bs = -1, 0
    for i, s in enumerate(sents):
        v = overlap(q, s)
        if v > bs: best, bs = i, v
    if best >= 0 and bs >= 2: sents[best] = "⟦" + sents[best].strip() + "⟧ "
    return "".join(sents)


def prepare_pages(bid, cat, sc, tmp):
    """لكل مشهد: page = {img|text, boxes, n} إن عُرفت صفحته."""
    b = next((x for x in cat["books"] if x["id"] == bid), None); src = T.source(bid, cat)
    if not b or not src: return
    pages, sh = src[2], src[3]
    for i, s in enumerate(sc):
        if s.get("pgoff") or not pages: s.pop("page", None); continue
        p = locate(s, pages)
        if not p: continue
        s["pg"] = p; q = s.get("q") or s.get("h") or ""; pg = {"n": p, "label": (sh.get("pl") or [None] * p)[p - 1] if isinstance(sh.get("pl"), list) and p <= len(sh["pl"]) else p}
        if b.get("img"):
            n = pdf_page(b, sh, p)
            if 0 < n <= int(b.get("imgN") or 10 ** 6):
                f = r2_img(bid, n, os.path.join(tmp, "pimg%02d.png" % i))
                if f:
                    bx = ocr_boxes(f, q)
                    if bx: pg.update(img=f, boxes=bx)
        if not pg.get("img"): pg["text"] = mark_text(pages[p - 1], q)
        s["page"] = pg


# ———— الصورة والصوت ————
def render(scenes, theme, aspect, title, out, pages=False):
    spec_ = {"scenes": scenes, "theme": theme, "aspect": aspect, "title": title, "out": out, "pages": 1 if pages else 0, "fps": FPS}
    p = os.path.join(out, "spec.json"); json.dump(spec_, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    subprocess.run(["node", os.path.join(ROOT, "tools", "video-slides.js"), p], check=True)


def secs(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0


def lexicon():
    L = [x for x in jl(os.path.join(VD, "_lexicon.json"), {}).get("words", []) if isinstance(x, list) and len(x) == 2 and x[0]]
    L += [x for x in jl(os.path.join(ROOT, "data", "audio", "_lexicon.json"), {}).get("words", []) if isinstance(x, list) and len(x) == 2 and x[0]]
    return sorted(L, key=lambda x: -len(x[0]))


def spoken(text, lex):
    t = str(text or "")
    for w, r in lex:  # الكلمة كاملة، مشكولة أو غير مشكولة في النص
        pat = "".join(re.escape(ch) + "[ً-ْٰ]*" for ch in DIAC.sub("", w))
        t = re.sub(r"(?<![ء-يً-ْ])" + pat + r"(?![ء-ي])", r, t)
    return t


ASSETS = {}
def assets(tag):
    if tag not in ASSETS:
        r = subprocess.run(["gh", "release", "view", tag, "-R", REPO, "--json", "assets", "-q", ".assets[].name"], capture_output=True, text=True)
        ASSETS[tag] = set(r.stdout.split()) if r.returncode == 0 else None
    return ASSETS[tag]


def ensure_release(tag, title):
    if assets(tag) is None:
        subprocess.run(["gh", "release", "create", tag, "-R", REPO, "--title", "فيديو: " + title, "--notes", "فيديوهات ملخص ومراجعة لكتاب في مكتبة الدعوة السلفية الرقمية.", "--latest=false"], check=True)
        ASSETS[tag] = set()


async def speak(text, voice, path, tag):
    """تسجيل المشهد مع ذاكرة في إصدار الكتاب: البصمة من الصوت والنص المنطوق، فلا يُعاد تسجيل ما لم يتغير."""
    name = "a-" + hashlib.sha1((voice + "|" + text).encode()).hexdigest()[:14] + ".mp3"; have = assets(tag) or set()
    if name in have and subprocess.run(["gh", "release", "download", tag, "-R", REPO, "-p", name, "-O", path, "--clobber"], capture_output=True).returncode == 0 and secs(path) > 0.5:
        return
    done = False
    if voice.startswith("gemini:"):
        try: TTS.speak_gemini(text, voice.split(":", 1)[1], path); done = True
        except Exception as e: print("  Gemini TTS تعذر:", str(e)[:120])
    if not done: await TTS.speak(text, "ar-SA-HamedNeural", "-5%", path); return  # البديل لا يُخزَّن حتى يُعاد بالصوت المختار لاحقًا
    c = os.path.join(os.path.dirname(path), name); shutil.copy(path, c)
    if subprocess.run(["gh", "release", "upload", tag, "-R", REPO, "--clobber", c], capture_output=True).returncode == 0: have.add(name)


def sfx(tmp, dur):
    """صوت تقليب الورق، وصوت قلم التحديد بطول مروره على السطور؛ مولَّدان بـ ffmpeg (بلا ملفات خارجية)."""
    flip, pen = os.path.join(tmp, "flip.wav"), os.path.join(tmp, "pen%.1f.wav" % dur)
    if not os.path.exists(flip):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=color=white:amplitude=0.5:d=0.45:r=24000",
                        "-af", "highpass=f=900,lowpass=f=7000,afade=t=in:d=0.05,afade=t=out:st=0.12:d=0.33,volume=0.55", flip], check=True)
    if not os.path.exists(pen):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.35:d=%.2f:r=24000" % dur,
                        "-af", "bandpass=f=2600:width_type=h:w=1800,tremolo=f=11:d=0.55,afade=t=in:d=0.04,afade=t=out:st=%.2f:d=0.2,volume=0.45" % max(0, dur - 0.2), pen], check=True)
    return flip, pen


# ———— الإنشاء ————
def draft_save(did, D):
    jw(os.path.join(DRAFTS, did + ".json"), D)
    idx = jl(os.path.join(DRAFTS, "_index.json"), {}); idx[did] = {"book": D["book"], "t": D["title"], "n": len(D["scenes"]), "at": str(datetime.date.today()), "made": D.get("made", 0)}
    jw(os.path.join(DRAFTS, "_index.json"), idx)


def apply_fix(D, fix, lexf):
    notes = str((fix or {}).get("notes") or "").strip(); new_lex = [x for x in (fix or {}).get("lex") or [] if isinstance(x, list) and len(x) == 2 and x[0] and x[1]]
    if notes:
        sc = [{k: s.get(k) for k in ("h", "pts", "say", "pg", "q", "min", "pgoff") if s.get(k) not in (None, "")} for s in D["scenes"]]
        j = T.gemini(FIX.format(title=D.get("title", ""), notes=notes[:3000], scenes=json.dumps(sc, ensure_ascii=False)))
        if not j or not j.get("scenes"): raise RuntimeError("تعذر تطبيق الملاحظات")
        D["scenes"] = [s for s in j["scenes"] if s.get("say")]; D["title"] = j.get("title") or D["title"]
        new_lex += [x for x in j.get("lex") or [] if isinstance(x, list) and len(x) == 2 and x[0] and x[1]]
    if new_lex:  # قاموس النطق الدائم لكل الفيديوهات
        L = jl(lexf, {"words": []}); have = {w for w, _ in L.get("words", [])}
        for w, r in new_lex:
            w = DIAC.sub("", w).strip()
            if w and w not in have: L.setdefault("words", []).append([w, r.strip()]); have.add(w)
            elif w: L["words"] = [[a, (r.strip() if a == w else b)] for a, b in L["words"]]
        jw(lexf, L)
    D.setdefault("fixes", []).append({"at": datetime.datetime.now().isoformat(timespec="minutes"), "notes": notes[:500], "lex": new_lex})


async def make(it, cat, L):
    bid = it["id"]
    if it.get("draft"):  # إخراج مسودة بعد المونتاج، أو تصحيح فيديو قبل اعتماده: من نص المسودة نفسها لا من الكتاب
        D = jl(os.path.join(DRAFTS, it["draft"] + ".json"), None)
        if not D or not D.get("scenes"): print("مسودة غير موجودة:", it["draft"]); return False
        if it.get("fix"): apply_fix(D, it["fix"], os.path.join(VD, "_lexicon.json"))
        opts = dict(D.get("opts") or {}, **{k: v for k, v in it.items() if k not in ("draft", "fix", "replace", "err", "at")})
        D["opts"] = {k: v for k, v in opts.items() if k not in ("phase",)}
        ok = await render_all(opts, D, L, it["draft"], it.get("replace"))
        draft_save(it["draft"], D); return ok
    m = material(bid, cat, it.get("topics"))
    if not m: print("لا مادة:", bid); return False
    title, au, src = m; style = it.get("style") or "summary"; n = int(it["scenes"]) if str(it.get("scenes") or "").isdigit() else (max(3, round(float(it["min"]) * 1.6)) if it.get("min") else N.get(it.get("len") or "medium", 9))
    extra = [REVIEW if style in ("review", "faq") else "", ("- ركّز على هذه الموضوعات وحدها: " + "، ".join(it["topics"])) if it.get("topics") else "",
             ("- أفكار يجب أن يتضمنها الفيديو: " + str(it["ideas"])[:1500]) if it.get("ideas") else "", ("- افتتح بهذا المعنى: " + str(it["intro"])[:400]) if it.get("intro") else "",
             ("- اختم بهذا المعنى: " + str(it["outro"])[:400]) if it.get("outro") else "", ("- متطلبات المدير: " + str(it["note"])[:800]) if it.get("note") else ""]
    lex = lexicon()
    if lex: extra.append("- انطق هذه الأسماء والكلمات هكذا في say: " + "، ".join("%s ← %s" % (a, b) for a, b in lex[:60]))
    j = T.gemini(PROMPT.format(kind=KIND.get(style, "ملخص"), aud=AUD.get(it.get("aud"), "عموم المسلمين"), tone=TONE.get(it.get("tone"), "هادئ وقور"), title=title, author=au, n=n, src=src,
                               theme_hint=CREATIVE if it.get("creative") or it.get("theme") == "auto" else "", extra="\n".join(x for x in extra if x)))
    if not j or not j.get("scenes"): print("تعذر النص:", bid); return False
    sc = [s for s in j["scenes"] if s.get("say")][:n + 2]
    th = dict(THEMES.get(it.get("theme"), THEMES["green"]))
    if isinstance(j.get("theme"), dict): th.update({k: v for k, v in j["theme"].items() if isinstance(v, str) and (re.fullmatch(r"#[0-9a-fA-F]{6}", v) or k == "pat")})
    if it.get("pat"): th["pat"] = it["pat"]
    did = "%s-%s" % (bid, datetime.datetime.now().strftime("%m%d%H%M%S"))
    D = {"id": did, "book": bid, "title": j.get("title") or title, "theme": th, "opts": {k: v for k, v in it.items() if k not in ("phase", "err")}, "scenes": sc, "at": str(datetime.date.today())}
    if it.get("phase") == "script":  # إعداد النص أولًا: مسودة يراجعها المدير ويعدّلها ثم يأمر بالإخراج
        draft_save(did, D); print("✓ مسودة", did); return True
    ok = await render_all(it, D, L, did, None); draft_save(did, D); return ok


async def render_all(it, D, L, did, replace):
    """يُخرج الفيديو بكل مقاس مختار؛ وفي التصحيح يحل محل الفيديو السابق غير المعتمد من المسودة نفسها."""
    asp = [a for a in (it.get("aspects") or [it.get("aspect") or "16:9"]) if a in ASPECTS] or ["16:9"]
    if replace:  # تصحيح فيديو بعينه: مقاسه وحده
        old = next((v for v in L.get(it["id"], []) if v.get("f") == replace), None)
        if old and old.get("aspect") in ASPECTS: asp = [old["aspect"]]
    ok = False
    for a in asp:
        ok = await render_video(it, D, a, L, did, replace) or ok
    D["made"] = 1; return ok


async def render_video(it, D, aspect, L, did, replace):
    bid = it["id"]; style = it.get("style") or "summary"; sc = D["scenes"]; title = D.get("title") or bid
    th = dict(D.get("theme") or THEMES["green"]); th["cap"] = 1 if it.get("cap") else 0; th["font"] = it.get("font") or ""
    voice = it.get("voice") if it.get("voice") in VOICES else "gemini:Charon"
    tag = "video-" + bid; ensure_release(tag, title)
    tmp = tempfile.mkdtemp(); cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    pages = bool(it.get("pages"))
    if pages: prepare_pages(bid, cat, sc, tmp)
    render(sc, th, aspect, title, tmp, pages)
    lex = lexicon(); want_sfx = bool(it.get("sfx") and pages)
    segs = []
    for i, s in enumerate(sc):
        a = os.path.join(tmp, "a%02d.mp3" % i); await speak(spoken(s["say"], lex), voice, a, tag)
        pclip = os.path.join(tmp, "p%02d" % i); P = 0.0
        if pages and os.path.exists(os.path.join(pclip, "0000.png")):
            nf = len([x for x in os.listdir(pclip) if x.endswith(".png")]); P = nf / FPS
        lead = 0.5 if P else 0.0  # يبدأ الراوي بعد انقلاب الصفحة
        d = max(secs(a) + 0.8 + lead, float(s.get("min") or 0), P + 1.5); v = os.path.join(tmp, "s%02d.mp4" % i)
        img = os.path.join(tmp, "f%02d.png" % i); rest = d - P + (0.4 if P else 0)
        vin = ["-loop", "1", "-t", "%.2f" % rest, "-framerate", str(FPS), "-i", img]
        if P:  # مقطع الصفحة ثم شريحة المشهد بانتقال ناعم
            vin = ["-framerate", str(FPS), "-i", os.path.join(pclip, "%04d.png")] + vin
            vf = "[0:v]format=yuv420p,setsar=1,fps=%d[pv];[1:v]format=yuv420p,setsar=1,fps=%d[sv];[pv][sv]xfade=transition=fade:duration=0.4:offset=%.2f,fade=t=out:st=%.2f:d=0.4[v]" % (FPS, FPS, max(0.1, P - 0.4), max(0, d - 0.8))
            ai = 2
        else:
            vf = "[0:v]format=yuv420p,setsar=1,fps=%d,fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4[v]" % (FPS, max(0, d - 0.4)); ai = 1
        ain = ["-i", a]; amix = "[%d:a]adelay=%d:all=1,apad[n]" % (ai, int(lead * 1000)); mixn = ["[n]"]
        if want_sfx and P:  # القلم من ٠٫٧ث إلى قبل نهاية مقطع الصفحة بـ٠٫٦ث (كما في video-slides.js)
            flip, pen = sfx(tmp, max(0.4, P - 1.3))
            ain += ["-i", flip, "-i", pen]
            amix += ";[%d:a]apad[fl];[%d:a]adelay=700:all=1,apad[pn]" % (ai + 1, ai + 2); mixn += ["[fl]", "[pn]"]
        amix += ";%samix=inputs=%d:duration=first:normalize=0[a]" % ("".join(mixn), len(mixn)) if len(mixn) > 1 else ";[n]anull[a]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + vin + ain + ["-filter_complex", vf + ";" + amix, "-map", "[v]", "-map", "[a]",
                        "-c:v", "libx264", "-preset", "veryfast", "-r", str(FPS), "-c:a", "aac", "-b:a", "96k", "-ar", "24000", "-t", "%.2f" % d, v], check=True)
        segs.append(v)
    lst = os.path.join(tmp, "l.txt"); open(lst, "w").write("".join("file '%s'\n" % x for x in segs))
    stamp = datetime.datetime.now().strftime("%m%d%H%M"); fn = "%s-%s-%s-%s.mp4" % (bid, style, aspect.replace(":", "x"), stamp); outp = os.path.join(tmp, fn)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", outp], check=True)
    subprocess.run(["gh", "release", "upload", tag, "-R", REPO, "--clobber", outp], check=True)
    rec = {"f": fn, "t": title, "draft": did or "", "style": style, "aspect": aspect, "d": round(secs(outp)), "voice": voice, "pages": 1 if pages else 0,
           "at": str(datetime.date.today()), "scenes": [s.get("h", "") for s in sc], "ok": 0}
    lst_ = L.setdefault(bid, [])
    old = next((k for k, v in enumerate(lst_) if replace and v.get("f") == replace and not v.get("ok")), None)
    if old is not None:  # التصحيح يحل محل الفيديو غير المعتمد (ويُحذف ملفه القديم من الإصدار)
        rec["rev"] = int(lst_[old].get("rev") or 0) + 1; lst_[old] = rec
        subprocess.run(["gh", "release", "delete-asset", tag, replace, "-R", REPO, "-y"], capture_output=True)
    else: lst_.append(rec)
    for s in sc: s.pop("page", None)
    shutil.rmtree(tmp, ignore_errors=True)
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
        jw(LP, L)
    Q["items"] = left; jw(QP, Q)


if __name__ == "__main__":
    asyncio.run(main())
