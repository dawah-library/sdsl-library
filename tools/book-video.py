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
WPM = 130  # كلمات الراوي العربي في الدقيقة تقريبًا (إلقاء هادئ)
ICONS = ["book-open", "library", "scroll-text", "scroll", "scale", "sparkles", "heart", "compass", "landmark", "quote", "clipboard-check", "message-circle-question", "brain", "network", "history", "users", "flag", "trophy", "pen-line", "book-marked"]  # من icons.js
TRANS = ["fade", "smoothleft", "dissolve", "circleopen", "slideup", "fadegrays", "wipeleft", "radial", "smoothright", "circlecrop"]  # انتقالات xfade متنوعة هادئة
XF = 0.7  # مدة الانتقال بين المشاهد (ث)
VG = importlib.util.spec_from_file_location("vg", os.path.join(ROOT, "tools", "video-gen.py")); VG = (lambda m: (VG.loader.exec_module(m), m)[1])(importlib.util.module_from_spec(VG))
KIND = {"summary": "ملخص", "review": "مراجعة واختبار", "benefits": "أبرز الفوائد والدروس المستفادة", "story": "سرد قصصي متسلسل لأحداثه وأفكاره", "faq": "أسئلة شائعة وأجوبتها من الكتاب",
        "quotes": "مختارات من أقوال المؤلف بنصها مع تعليق موجز", "intro": "تعريف ترويجي قصير بالكتاب يدعو إلى قراءته", "lesson": "درس تعليمي مبسط مرتب كالدرس",
        "features": "عرض مميزات الكتاب ومنهج مؤلفه وقيمته العلمية ولمن يُنصح به", "critique": "قراءة نقدية علمية منصفة: مزايا الكتاب، وما يُستدرك عليه بأدب وإنصاف ودليل، دون تجريح، مع التنبيه على أن الاستدراك اجتهاد",
        "part": "حديث مفصل عن الجزء أو الباب المحدد من الكتاب"}
AUD = {"general": "عموم المسلمين", "students": "طلاب العلم", "youth": "الشباب", "kids": "الأطفال (بلغة سهلة جدًا)", "women": "النساء والفتيات"}
TONE = {"calm": "هادئ وقور", "warm": "دافئ مؤثر", "lively": "حيوي حماسي معتدل", "teach": "تعليمي مبسط"}
THEMES = {"kids_b": {"bg": "#0b4a8b", "c1": "#ffffff", "acc": "#ffd166", "c2": "#cfe8ff", "pat": "stars"}, "kids_g": {"bg": "#7a1f5c", "c1": "#ffffff", "acc": "#ffd6e8", "c2": "#f6d6ff", "pat": "stars"},
          "kids": {"bg": "#1b5e57", "c1": "#ffffff", "acc": "#ffd166", "c2": "#d8f3dc", "pat": "stars"}, "green": {"bg": "#0f3d33", "c1": "#ffffff", "acc": "#d4af37", "c2": "#cfe6dc"}, "gold": {"bg": "#f6efe1", "c1": "#3b2a1a", "acc": "#a5782e", "c2": "#6b5440"},
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
- لكل مشهد "icon": أنسب أيقونة لمضمونه من: {icons}، و"vis": وصف إنجليزي قصير للقطة خلفية هادئة تناسبه (مناظر، عمارة إسلامية، مكتبة وكتب، مخطوطات، خط عربي، طبيعة، ضوء) بلا بشر ولا حيوانات.
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


# ———— الطلائع: تحويل القصص والفقرات والموضوعات العلمية إلى مقاطع مرئية لكل مرحلة (طلب المدير، ٢١ نوفمبر ٢٠٢٦) ————
# المعرّف "tala-<قصة>" من data/tala-qasas.json بنص مرحلتها (age)، أو "tala-t<وقت>" بنص حر (text) يختاره المشرف من فقرة أو موضوع.
# الإعداد لكل مرحلة (TALA_AGE): عدد المشاهد، وطول عبارة الراوي، والجمهور، والأسلوب؛ والضوابط الشرعية في docs/tala-media.md.
TALA_AGE = {"t1": {"n": 4, "w": "١٥–٣٠", "aud": "أطفال ٥–٨ سنوات: جمل قصيرة جدًا، وكلمات سهلة، وتكرار لطيف للمعنى، وسؤال واحد بسيط في الختام"},
            "t2": {"n": 6, "w": "٢٥–٥٠", "aud": "أطفال ٩–١٢ سنة: لغة سهلة، وتسلسل واضح للأحداث، وفائدة عملية في كل مشهد"},
            "t3": {"n": 7, "w": "٣٥–٦٥", "aud": "ناشئة ١٢–١٥ سنة: عرض مشوّق، ودروس مستفادة، وربط بالواقع"},
            "t4": {"n": 8, "w": "٤٠–٨٠", "aud": "شباب ١٥–٢٠ سنة: عمق علمي ميسّر، وأدلة، وتطبيق عملي"}}
TALA_PROMPT = """أعدّ نص مقطع مرئي تعليمي لقسم «طلائع الدعوة السلفية» بعنوان «{title}»، في {n} مشاهد، للعرض على الشاشة مع راوٍ.
الجمهور: {aud}. أسلوب الإلقاء: دافئ تربوي مشوّق، بعربية فصيحة سليمة مشكولة ما يُلتبس.
أخرج JSON حرفيًا: {{"title": "عنوان المقطع", "scenes": [{{"h": "عنوان قصير", "pts": ["نقطة قصيرة على الشاشة (٢–٣ نقاط، أقل من ٨ كلمات)"], "say": "ما يقوله الراوي ({w} كلمة)", "icon": "…", "vis": "…"}}]}}
- المشهد الأول تمهيد مشوّق، والأخير خلاصة الدرس ودعوة لطيفة إلى العمل به.
- التزم النص المرسل وحده، ولا تضف أحداثًا ولا تفاصيل ليست فيه، وانقل الآيات والأحاديث بلفظها إن ذكرتها.
- لكل مشهد "icon" من: {icons}، و"vis" وصف إنجليزي قصير لخلفية المشهد: {vis_rule}
- لا موسيقى، ولا تجسيد لنبي ولا صحابي ولا ملَك بأي صورة، ولا ما يخدش الحياء.
النص:
{src}"""
VIS_CARTOON = "رسم كرتوني تعليمي لطيف لأطفال أو حيوانات أو طبيعة يناسب المشهد (لا يمثل نبيًا ولا صحابيًا ولا ملَكًا ولا أي شخصية تاريخية)."
VIS_SCENE = "مناظر وطبيعة وعمارة إسلامية وكتب وخط عربي فقط، بلا بشر ولا حيوانات."


def tala_material(it):
    """(العنوان، النص، كرتون؟) لعنصر الطلائع. الكرتون للمراحل حتى ١٥ سنة في الموضوعات العامة، لا في قصص الأنبياء والصحابة والتابعين."""
    age = it.get("age") if it.get("age") in TALA_AGE else "t2"
    if it.get("text"): return (it.get("title") or "درس للطلائع"), str(it["text"])[:12000], age != "t4"
    if it.get("lessons"): return lesson_material(it, age)
    Q = jl(os.path.join(ROOT, "data", "tala-qasas.json"), {}) or {}; sid = it["id"][5:]
    x = next((y for y in Q.get("items") or [] if y.get("id") == sid), None)
    if not x: return None
    s = x.get("s") or {}; txt = s.get(age) or s.get("t2") or next(iter(s.values()), "")
    return x.get("n") or sid, txt, False  # قصص الأنبياء والصحابة والتابعين: مناظر فقط


# دروس كتب منهج الطلائع («الأساس» و«البنيان» و«البداية» للشيخ مصطفى دياب): نص الدرس من صفحاته مباشرة بلا كتابة من المشرف.
# العنصر: "lessons": [{"b": معرف المجلد, "p": أول صفحة, "z": آخر صفحة, "t": عنوان الدرس, "s": مادته}] (درس أو عدة دروس).
LESSON_SKIP = re.compile(r"^(\d+\s*)?(الأهداف|الاهداف|المناقشة|صل |اختر|ضع علامة|أكمل|اكمل|ظلل|مع معلمك|التقويم|أسئلة|اسئلة|نشاط)")
NOCART = re.compile(r"نبي|النبي|رسول|الأنبياء|صحاب|الصحابة|التابع|غزو|سير[ةه]|عليه السلام|رضي الله")


def lesson_material(it, age):
    parts, cart, nm = [], age != "t4", []
    for L in (it.get("lessons") or [])[:8]:
        bid = str(L.get("b") or ""); f = next((x for x in (os.path.join(ROOT, "data", "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")) if os.path.exists(x)), None)
        if not f: continue
        pages = (jl(f, {}) or {}).get("pages") or []
        a = max(1, int(L.get("p") or 1)); z = min(len(pages), max(a, int(L.get("z") or a)), a + 10)
        body = []
        for pg in pages[a - 1:z]:
            t = re.split(r"^\s*_{4,}\s*$", pg or "", maxsplit=1, flags=re.M)[0]  # بلا الحواشي
            for l in t.split("\n"):
                l = re.sub(r"^(@@|<<|#{1,3})\s*", "", l.strip())
                if not l or LESSON_SKIP.match(l) or re.match(r"^\[(رسم|صورة|شكل)", l) or re.match(r"^\|?\s*:?-{3}", l) or re.match(r"^[\d٠-٩]+\s*[-–)]\s*أن (ي|ت)", l): continue  # أهداف الدرس للمعلم وفواصل الجداول
                if l.startswith("|"): l = " — ".join(c.strip() for c in l.strip("|").split("|") if c.strip())  # صف جدول: الكلمة — معناها
                body.append(l)
        if not body: continue
        tt = str(L.get("t") or "").strip(); nm.append(tt)
        parts.append("## " + tt + "\n" + "\n".join(body))
        if L.get("s") in ("sira", "quran") or NOCART.search(tt): cart = False  # لا تُشخَّص الأنبياء ولا الصحابة بالرسوم، ولا تُركَّب الرسوم على الآيات
    if not parts: return None
    title = it.get("title") or (nm[0] if len(nm) == 1 else "دروس: " + "، ".join(nm[:3]))
    return title, ("\n\n".join(parts))[:12000], cart


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
REDIST = """هذا النص الكامل المعتمد لفيديو عن كتاب «{title}»، مقسّمًا إلى {n} مشاهد بالترتيب (لا تغيّر نص أي مشهد). لكل مشهد أخرج:
"h" عنوانًا قصيرًا على الشاشة، و"pts" من ٢ إلى ٤ نقاط قصيرة (أقل من ١٢ كلمة) مأخوذة من نصه، و"icon" من: {icons}، و"vis" وصفًا إنجليزيًّا قصيرًا للقطة خلفية هادئة بلا بشر ولا حيوانات.
أخرج JSON حرفيًّا: {{"scenes": [{{"h": "...", "pts": ["..."], "icon": "...", "vis": "..."}}]}}

{blocks}"""


def redistribute(D, script, opts):
    """المرحلة ٦: النص الكامل (خانة واحدة) ← مشاهد. «## عنوان» يبدأ مشهدًا إن وُجد؛ وإلا تُقسم الفقرات على عدد مشاهد يناسب المدة،
    ونص الراوي يبقى كما كتبه المدير حرفًا بحرف؛ ويُستبقى من المشهد القديم صفحته وعبارته إن طابق عنوانه."""
    lines = [l.rstrip() for l in script.replace("\r", "").split("\n")]
    blocks, cur = [], None
    for l in lines:
        if re.match(r"^\s*#{1,3}\s+\S", l): cur = {"h": re.sub(r"^\s*#+\s*", "", l).strip(), "say": []}; blocks.append(cur)
        elif l.strip():
            if cur is None: cur = {"h": "", "say": []}; blocks.append(cur)
            cur["say"].append(l.strip())
    blocks = [b for b in blocks if b["say"]]
    if len(blocks) <= 1:  # بلا عناوين: فقرات تُجمع على عدد مشاهد بحسب الطول (مشهد لكل ~٢٨ ثانية)
        paras = [p for b in blocks for p in b["say"]]; words = sum(len(p.split()) for p in paras)
        n = max(1, min(len(paras), round(words / WPM * 60 / 28) or 1)); per = words / n; blocks, acc = [], 0
        for p in paras:
            if not blocks or (acc >= per * len(blocks) and len(blocks) < n): blocks.append({"h": "", "say": []})
            blocks[-1]["say"].append(p); acc += len(p.split())
    old = {(s.get("h") or "").strip(): s for s in D.get("scenes") or []}
    sc = [dict({k: v for k, v in (old.get(b["h"]) or {}).items() if k in ("pg", "q", "pgoff", "icon", "vis", "pts")}, h=b["h"], say="\n".join(b["say"])) for b in blocks]
    need = [i for i, x in enumerate(sc) if not x.get("h") or not x.get("pts")]
    if need:
        j = T.gemini(REDIST.format(title=D.get("title", ""), n=len(sc), icons="، ".join(ICONS), blocks="\n\n".join("[%d] %s" % (i + 1, x["say"][:1500]) for i, x in enumerate(sc)))) or {}
        for i, g in enumerate((j.get("scenes") or [])[:len(sc)]):
            for k in ("h", "pts", "icon", "vis"):
                if g.get(k) and not sc[i].get(k): sc[i][k] = g[k]
    for x in sc: x["h"] = x.get("h") or D.get("title", ""); x["pts"] = x.get("pts") or []
    return sc


def render(scenes, theme, aspect, title, out, pages=False, bg=None, reveal=False):
    spec_ = {"scenes": scenes, "theme": theme, "aspect": aspect, "title": title, "out": out, "pages": 1 if pages else 0, "fps": FPS, "bg": bg or [], "reveal": 1 if reveal else 0,
             "icons": os.path.join(ROOT, "icons.js")}
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
    elif voice.startswith("eleven:"):  # ElevenLabs (المرحلة ٥)
        try: TTS.ELS.update(jl(os.path.join(ROOT, "data", "audio", "_settings.json"), {}).get("eleven") or {}); TTS.speak_eleven(text, voice.split(":", 1)[1], path); done = True
        except Exception as e: print("  ElevenLabs تعذر:", str(e)[:120])
    if not done: await TTS.speak(text, "ar-SA-HamedNeural", "-5%", path); return  # البديل لا يُخزَّن حتى يُعاد بالصوت المختار لاحقًا
    c = os.path.join(os.path.dirname(path), name); shutil.copy(path, c)
    if subprocess.run(["gh", "release", "upload", tag, "-R", REPO, "--clobber", c], capture_output=True).returncode == 0: have.add(name)


def soft(tmp):
    """فاصل الانتقال: نفَس هوائي ناعم (ضوضاء وردية منخفضة التردد ترتفع ثم تتلاشى في ٠٫٩ث) بمستوى خافت؛ لا موسيقى ولا صوت حاد."""
    f = os.path.join(tmp, "soft.wav")
    if not os.path.exists(f):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.5:d=0.9:r=24000",
                        "-af", "lowpass=f=900,highpass=f=120,afade=t=in:d=0.35,afade=t=out:st=0.4:d=0.5,volume=0.16", f], check=True)
    return f


def join(segs, outp, trans="auto"):
    """وصل المشاهد بانتقالات متنوعة سلسة (xfade) وتداخل صوتي ناعم (acrossfade)؛ وعند التعذر وصلٌ مباشر."""
    if len(segs) == 1: shutil.copy(segs[0], outp); return
    ds = [secs(x) for x in segs]; ins = []
    for x in segs: ins += ["-i", x]
    fv, fa, off, pv, pa = [], [], 0.0, "[0:v]", "[0:a]"
    for k in range(1, len(segs)):
        off += ds[k - 1] - XF; t = TRANS[(k - 1) % len(TRANS)] if trans == "auto" else trans
        fv.append("%s[%d:v]xfade=transition=%s:duration=%.2f:offset=%.2f[v%d]" % (pv, k, t, XF, off, k)); pv = "[v%d]" % k
        fa.append("%s[%d:a]acrossfade=d=%.2f:c1=tri:c2=tri[a%d]" % (pa, k, XF, k)); pa = "[a%d]" % k
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + ins + ["-filter_complex", ";".join(fv + fa), "-map", pv, "-map", pa, "-c:v", "libx264", "-preset", "veryfast",
                        "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "96k", "-ar", "24000", "-movflags", "+faststart", outp], capture_output=True, text=True)
    if r.returncode:
        print("  الانتقالات تعذرت، وصل مباشر:", r.stderr[-200:]); lst = outp + ".txt"; open(lst, "w").write("".join("file '%s'\n" % x for x in segs))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", outp], check=True)


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
        if it.get("script"): D["scenes"] = redistribute(D, str(it["script"]), opts)  # النص الكامل المعتمد يُعاد توزيعه على المشاهد آليًّا
        D["opts"] = {k: v for k, v in opts.items() if k not in ("phase", "script")}
        ok = await render_all(opts, D, L, it["draft"], it.get("replace"))
        draft_save(it["draft"], D); return ok
    if bid.startswith("tala-"):  # مقاطع الطلائع: من القصة أو النص الحر بإعداد مرحلته
        tm = tala_material(it)
        if not tm or not tm[1].strip(): print("لا مادة للطلائع:", bid); return False
        title, txt, cart = tm; age = it.get("age") if it.get("age") in TALA_AGE else "t2"; A = TALA_AGE[age]
        it["cartoon"] = bool(cart and it.get("cartoon", 1)); it.setdefault("voice", "gemini:Orus"); it.setdefault("style", "story"); it.setdefault("theme", {"b": "kids_b", "g": "kids_g"}.get(it.get("g"), "kids"))
        j = T.gemini(TALA_PROMPT.format(title=title, n=A["n"], aud=A["aud"], w=A["w"], icons="، ".join(ICONS), vis_rule=VIS_CARTOON if it["cartoon"] else VIS_SCENE, src=txt))
        if not j or not j.get("scenes"): print("تعذر النص:", bid); return False
        th = dict(THEMES.get(it.get("theme"), THEMES["kids"]))
        did = "%s-%s" % (bid, datetime.datetime.now().strftime("%m%d%H%M%S"))
        D = {"id": did, "book": bid, "title": j.get("title") or title, "theme": th, "opts": {k: v for k, v in it.items() if k not in ("phase", "err")}, "scenes": [x for x in j["scenes"] if x.get("say")][:A["n"] + 1], "at": str(datetime.date.today()), "tala": age}
        if it.get("phase") == "script": draft_save(did, D); print("✓ مسودة", did); return True
        ok = await render_all(it, D, L, did, None); draft_save(did, D); return ok
    m = material(bid, cat, it.get("topics"))
    if not m: print("لا مادة:", bid); return False
    title, au, src = m; style = it.get("style") or "summary"; n = int(it["scenes"]) if str(it.get("scenes") or "").isdigit() else (max(3, round(float(it["min"]) * 1.6)) if it.get("min") else N.get(it.get("len") or "medium", 9))
    if it.get("min"):  # المدة حرة من دقيقة: طول نص الراوي على قدرها (نحو ١٣٠ كلمة في الدقيقة)، بلا حشو ولا اختزال مخل
        mins = max(1.0, float(it["min"])); it["_words"] = int(mins * WPM)
    sts = [x for x in style.split("+") if x in KIND] or ["summary"]  # يجوز الجمع بين عدة أنماط
    kind = KIND[sts[0]] if len(sts) == 1 else "يجمع بين: " + "، و".join(KIND[x] for x in sts) + " — وزّع المشاهد على هذه الأنماط كلها في سياق واحد متصل"
    extra = [REVIEW if set(sts) & {"review", "faq"} else "", ("- ركّز على هذه الموضوعات وحدها: " + "، ".join(it["topics"])) if it.get("topics") else "",
             ("- أفكار يجب أن يتضمنها الفيديو: " + str(it["ideas"])[:1500]) if it.get("ideas") else "", ("- افتتح بهذا المعنى: " + str(it["intro"])[:400]) if it.get("intro") else "",
             ("- اختم بهذا المعنى: " + str(it["outro"])[:400]) if it.get("outro") else "", ("- متطلبات المدير: " + str(it["note"])[:800]) if it.get("note") else ""]
    if it.get("_words"): extra.append("- المدة %s دقيقة: اجعل مجموع نص الراوي (say) نحو %d كلمة. وزّعها على الأفكار بقدر أهميتها، ولا تحشُ بتكرار أو عموميات لملء المدة، ولا تختزل اختزالًا يُخل بالمعنى؛ فإن كانت مادة الكتاب أقل من المدة فاكتفِ بما تحمله وقل ذلك في \"note\"." % (it["min"], it["_words"]))
    lex = lexicon()
    if lex: extra.append("- انطق هذه الأسماء والكلمات هكذا في say: " + "، ".join("%s ← %s" % (a, b) for a, b in lex[:60]))
    j = T.gemini(PROMPT.format(kind=kind, aud=AUD.get(it.get("aud"), "عموم المسلمين"), tone=TONE.get(it.get("tone"), "هادئ وقور"), title=title, author=au, n=n, src=src,
                               theme_hint=CREATIVE if it.get("creative") or it.get("theme") == "auto" else "", icons="، ".join(ICONS), extra="\n".join(x for x in extra if x)))
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
    voice = it.get("voice") if it.get("voice") in VOICES or str(it.get("voice") or "").startswith("eleven:") else "gemini:Charon"
    engine = it.get("gen") or "local:auto"; spent = []; os.environ["VG_ASPECT"] = aspect; os.environ["VG_THEME"] = json.dumps(th)  # الافتراضي: خلفيات متحركة مجانية
    tag = "video-" + bid; ensure_release(tag, title)
    tmp = tempfile.mkdtemp(); cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    pages = bool(it.get("pages"))
    if pages: prepare_pages(bid, cat, sc, tmp)
    # لقطات خلفية مولَّدة (اختياري، مكلف): للمشاهد التي لا تعرض صفحة الكتاب، ضمن السقف
    bgs = []
    for i, s in enumerate(sc):
        f = os.path.join(tmp, "bg%02d.mp4" % i)
        os.environ["VG_IDX"] = str(i)
        bgs.append(f if engine != "none" and not (pages and s.get("page")) and VG.clip(engine, s.get("vis"), 8, aspect, f, spent, kids=bool(it.get("cartoon"))) else None)
    render(sc, th, aspect, title, tmp, pages, [1 if b else 0 for b in bgs], reveal=bool(it.get("reveal", 1)))
    lex = lexicon(); want_sfx = bool(it.get("sfx") and pages)
    segs = []
    for i, s in enumerate(sc):
        a = os.path.join(tmp, "a%02d.mp3" % i); await speak(spoken(s["say"], lex), voice, a, tag)
        pclip = os.path.join(tmp, "p%02d" % i); P = 0.0
        if pages and os.path.exists(os.path.join(pclip, "0000.png")):
            nf = len([x for x in os.listdir(pclip) if x.endswith(".png")]); P = nf / FPS
        lead = 0.5 if P else 0.0  # يبدأ الراوي بعد انقلاب الصفحة
        d = max(secs(a) + 0.8 + lead, float(s.get("min") or 0), P + 1.5); v = os.path.join(tmp, "s%02d.mp4" % i)
        img = os.path.join(tmp, "f%02d.png" % i); rest = max(0.1, d - P)
        vin = ["-loop", "1", "-t", "%.2f" % rest, "-framerate", str(FPS), "-i", img]
        rv = sorted([x for x in os.listdir(tmp) if x.startswith("f%02d_" % i)], key=lambda x: int(x.split("_")[1].split(".")[0]))
        if rv and not P:  # النقاط تظهر تباعًا على امتداد ثلاثة أرباع كلام الراوي، ثم تبقى الشريحة كاملة
            n = len(rv); step = max(0.6, (rest * 0.75) / (n + 1)); lst = os.path.join(tmp, "rv%02d.txt" % i)
            open(lst, "w").write("".join("file '%s'\nduration %.2f\n" % (os.path.join(tmp, x), step) for x in rv) + "file '%s'\nduration %.2f\nfile '%s'\n" % (img, max(0.5, rest - step * n), img))
            sl = os.path.join(tmp, "sl%02d.mov" % i)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-vf", "fps=%d,format=rgba" % FPS, "-c:v", "png", "-t", "%.2f" % rest, sl], check=True)
            vin = ["-i", sl]
        if bgs[i] and not P:  # لقطة متحركة خلف الشريحة الشفافة: مكتومة، معتمة قليلًا، تتكرر إلى نهاية الكلام
            W_, H_ = {"9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350)}.get(aspect, (1920, 1080))
            vin = ["-stream_loop", "-1", "-t", "%.2f" % d, "-i", bgs[i]] + vin
            vf = ("[0:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,eq=brightness=-0.18:saturation=0.85,fps=%d,setsar=1[bgv];[1:v]format=rgba[fg];"
                  "[bgv][fg]overlay=0:0:format=auto,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4[v]") % (W_, H_, W_, H_, FPS, max(0, d - 0.4))
            ai = 2
        if P:  # الصفحة تنقلب ويُحدَّد سطرها داخل الشريحة نفسها، ثم تثبت الشريحة (آخر إطار) حتى نهاية الكلام
            vin = ["-framerate", str(FPS), "-i", os.path.join(pclip, "%04d.png")] + vin
            vf = "[0:v]format=yuv420p,setsar=1,fps=%d[pv];[1:v]format=yuv420p,setsar=1,fps=%d[sv];[pv][sv]concat=n=2:v=1:a=0,fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4[v]" % (FPS, FPS, max(0, d - 0.4))
            ai = 2
        elif not bgs[i]:
            vf = "[0:v]format=yuv420p,setsar=1,fps=%d,fade=t=in:st=0:d=0.4,fade=t=out:st=%.2f:d=0.4[v]" % (FPS, max(0, d - 0.4)); ai = 1
        ain = ["-i", a]; amix = "[%d:a]adelay=%d:all=1,apad[n]" % (ai, int(lead * 1000)); mixn = ["[n]"]
        if want_sfx and P:  # القلم من ٠٫٧ث إلى قبل نهاية مقطع الصفحة بـ٠٫٦ث (كما في video-slides.js)
            flip, pen = sfx(tmp, max(0.4, P - 1.3))
            ain += ["-i", flip, "-i", pen]
            amix += ";[%d:a]apad[fl];[%d:a]adelay=700:all=1,apad[pn]" % (ai + 1, ai + 2); mixn += ["[fl]", "[pn]"]
        if it.get("sfx") and i > 0:  # فاصل صوتي ناعم غير حاد عند الانتقال: نفَس هوائي خافت منخفض التردد يتلاشى (بلا موسيقى)
            k_in = sum(1 for x in vin + ain if x == "-i"); ain += ["-i", soft(tmp)]
            amix += ";[%d:a]apad[sw]" % k_in; mixn += ["[sw]"]
        amix += ";%samix=inputs=%d:duration=first:normalize=0[a]" % ("".join(mixn), len(mixn)) if len(mixn) > 1 else ";[n]anull[a]"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + vin + ain + ["-filter_complex", vf + ";" + amix, "-map", "[v]", "-map", "[a]",
                        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-r", str(FPS), "-c:a", "aac", "-b:a", "96k", "-ar", "24000", "-t", "%.2f" % d, v], check=True)
        segs.append(v)
    stamp = datetime.datetime.now().strftime("%m%d%H%M"); fn = "%s-%s-%s-%s.mp4" % (bid, style.replace("+", "_"), aspect.replace(":", "x"), stamp); outp = os.path.join(tmp, fn)
    join(segs, outp, it.get("trans") or "auto")
    subprocess.run(["gh", "release", "upload", tag, "-R", REPO, "--clobber", outp], check=True)
    rec = {"f": fn, "t": title, "draft": did or "", "style": style, "aspect": aspect, "d": round(secs(outp)), "voice": voice, "pages": 1 if pages else 0,
           "at": str(datetime.date.today()), "scenes": [s.get("h", "") for s in sc], "ok": 0, "v420": 1}
    if bid.startswith("tala-"): rec.update({"tala": it.get("age") or "t2", "g": it.get("g") or "", "cartoon": 1 if it.get("cartoon") else 0})
    if it.get("lessons"): rec.update({"ls": ["%s:%s" % (x.get("b"), x.get("p")) for x in it["lessons"]][:8], "ser": it.get("ser") or ""})  # ربط المقطع بدروسه في منهج الطلائع
    lst_ = L.setdefault(bid, [])
    old = next((k for k, v in enumerate(lst_) if replace and v.get("f") == replace and not v.get("ok")), None)
    if old is not None:  # التصحيح يحل محل الفيديو غير المعتمد (ويُحذف ملفه القديم من الإصدار)
        rec["rev"] = int(lst_[old].get("rev") or 0) + 1; lst_[old] = rec
        subprocess.run(["gh", "release", "delete-asset", tag, replace, "-R", REPO, "-y"], capture_output=True)
    else: lst_.append(rec)
    for s in sc: s.pop("page", None)
    shutil.rmtree(tmp, ignore_errors=True)
    print("✓ فيديو", title, fn); return True


def fix_old(L):
    """إصلاح لمرة واحدة: الفيديوهات الأولى خرجت بترميز yuv444p (High 4:4:4) الذي لا يشغّله iPhone ولا أكثر المتصفحات؛
    تُنزَّل وتُعاد ترميزًا إلى yuv420p ثم تُرفع مكانها بالاسم نفسه. تُعلَّم بـ v420 فلا تُعاد."""
    for bid, l in L.items():
        for v in l:
            if v.get("v420"): continue
            tmp = tempfile.mkdtemp(); src = os.path.join(tmp, v["f"]); out = os.path.join(tmp, "o.mp4")
            try:
                subprocess.run(["gh", "release", "download", "video-" + bid, "-R", REPO, "-p", v["f"], "-D", tmp, "--clobber"], check=True)
                pf = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip()
                if pf != "yuv420p":
                    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high",
                                    "-level", "4.1", "-c:a", "copy", "-movflags", "+faststart", out], check=True)
                    os.replace(out, src); subprocess.run(["gh", "release", "upload", "video-" + bid, "-R", REPO, "--clobber", src], check=True)
                    print("✓ أُعيد ترميز", v["f"], "من", pf)
                v["v420"] = 1
            except Exception as e: print("✗ إعادة الترميز:", v.get("f"), str(e)[:200])
            finally: shutil.rmtree(tmp, ignore_errors=True)


def delete_video(it, L):
    """حذف فيديو غير معتمد بطلب من الموقع: ملفه من إصدار video-<كتاب>، والإصدار نفسه إن فرغ؛ ويُزال من القائمة إن بقي فيها."""
    bid, f, tag = it["id"], it["f"], "video-" + it["id"]
    if any(v.get("f") == f and v.get("ok") for v in L.get(bid, [])): print("لا يُحذف فيديو معتمد:", f); return True
    a = assets(tag)
    if a is not None and f in a:
        subprocess.run(["gh", "release", "delete-asset", tag, f, "-R", REPO, "-y"], check=True); a.discard(f); print("🗑 حُذف", f)
    if a is not None and not a:
        subprocess.run(["gh", "release", "delete", tag, "-R", REPO, "-y", "--cleanup-tag"], check=True); ASSETS.pop(tag, None)
    if bid in L:
        L[bid] = [v for v in L[bid] if v.get("f") != f]
        if not L[bid]: del L[bid]
    return True


async def main():
    Q = jl(QP, {"items": []}); L = jl(LP, {}); cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    fix_old(L); jw(LP, L)
    left = []
    for it in Q.get("items") or []:
        try: ok = delete_video(it, L) if it.get("del") else await make(it, cat, L)
        except Exception as e: print("✗", it.get("id"), str(e)[:200]); ok = False
        if not ok:
            it["err"] = (it.get("err") or 0) + 1
            if it["err"] < 3: left.append(it)
        jw(LP, L)
    Q["items"] = left; jw(QP, Q)


if __name__ == "__main__":
    asyncio.run(main())
