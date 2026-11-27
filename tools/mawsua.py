#!/usr/bin/env python3
"""الموسوعات العلمية المتخصصة (طلب المدير، ٢٠ نوفمبر ٢٠٢٦) — على غرار الموسوعات المحكمة: عقيدة، فقه، تفسير، علوم القرآن،
الفكر، الدعوة، اللغة، التاريخ، الآداب والأخلاق، التربية، الأسرة، السياسة الشرعية.

العماد والمرجعية: كتب مشايخ الدعوة السلفية ومقالاتهم وفتاواهم في المكتبة؛ وتُكمَّل الأبواب والمسائل من المراجع المتخصصة المشهورة
في كل علم (من المكتبة العامة). لكل موسوعة:
- plan: مخطط محكم (أبواب ← فصول ← مسائل) على ترتيب كتب الفن، لكل مسألة ألفاظ بحثها (data/mawsua/<k>/_tree.json).
- build: تحرير المسائل واحدة واحدة: تُجمع المواضع من نصوص المكتبة (المشايخ أولًا ثم المراجع)، ثم تُحرَّر المادة بأقسام ثابتة
  (التعريف، التأصيل والأدلة، تقريرات مشايخ الدعوة، أقوال أهل العلم من المراجع، الخلاصة) وكل فقرة معزوة إلى مواضعها.
  لا تُقبل فقرة بلا عزو إلى موضع مما أُرسل، ولا اقتباس لا يوجد بحروفه في موضعه. المادة مسودة (ok=0) حتى تعتمدها الإدارة من #/mawsua.
- grow (يوميًّا قبل الطابور): ما يُضاف من كتب مشايخ الدعوة ومقالاتهم وشروحهم يُطابَق بالمسائل فتُحرَّر أو تُحدَّث به (انظر grow()).
- الطابور: data/mawsua/_queue.json {"items": [{"k": "aqeeda", "do": "plan"}, {"k": "fiqh", "do": "build", "n": 30}]} — تضيفه الإدارة.
الاستعمال: python3 tools/mawsua.py [plan|build <k> [n]] — بلا وسائط: ينفّذ الطابور.
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("mawsua")  # يدوي فقط
import datetime, json, os, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "mawsua")
import tashjir as T  # noqa: E402  محرك Gemini بمفاتيح خدمات الكتب
T0, LIMIT = time.time(), int(os.environ.get("MAWSUA_MINUTES", "150")) * 60
T.DEADLINE[0] = T0 + LIMIT - 25 * 60
jl = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
def jw(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
DIA = re.compile(r"[\u064B-\u0652\u0670\u0640]")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", re.sub(r"[^\u0621-\u064A0-9 ]", " ", s)).strip()

# المفتاح، الاسم، الوصف، الأيقونة، موضوعات الفهرس (المشايخ والمراجع)، تصنيفات المقالات، ألفاظ عناوين المراجع المشهورة في الفن
ENC = [
    ("aqeeda", "موسوعة العقيدة", "التوحيد وأقسامه، والإيمان، والأسماء والصفات، والقدر، والصحابة، والولاء والبراء، ونواقض الإسلام، ومسائل الاعتقاد", "🕋", ["t1"], ["at1", "st", "التوحيد", "الأسماء والصفات", "العقيدة"], ["العقيدة الطحاوية", "شرح العقيدة الواسطية", "كتاب التوحيد", "معارج القبول", "شرح أصول اعتقاد", "الشريعة للآجري", "الإبانة", "لمعة الاعتقاد", "فتح المجيد", "تيسير العزيز"]),
    ("fiqh", "موسوعة الفقه", "الطهارة والصلاة والزكاة والصيام والحج، والمعاملات، والنكاح، والجنايات، والقضاء، على ترتيب أبواب الفقه", "⚖️", ["t4", "t14"], ["الصلاة", "الزكاة", "الربا", "البيوع", "الزواج", "الصيام", "الحج", "الطهارة"], ["المغني", "فقه السنة", "تمام المنة", "الشرح الممتع", "زاد المستقنع", "المجموع شرح", "بداية المجتهد", "الروضة الندية", "نيل الأوطار", "سبل السلام", "منار السبيل"]),
    ("tafsir", "موسوعة التفسير", "تفسير الآيات والسور، وموضوعات القرآن، ومناهج المفسرين وقواعد التفسير", "📖", ["t2"], ["من نور الوحيين", "القرآن"], ["تفسير ابن كثير", "تفسير القرآن العظيم", "تفسير السعدي", "تيسير الكريم الرحمن", "تفسير الطبري", "جامع البيان", "أضواء البيان", "زاد المسير", "فتح القدير"]),
    ("quran", "موسوعة علوم القرآن", "نزول القرآن وجمعه، والمكي والمدني، والناسخ والمنسوخ، والقراءات، والإعجاز، والمحكم والمتشابه، وآداب التلاوة", "📜", ["t12", "t2"], ["القرآن"], ["الإتقان في علوم القرآن", "البرهان في علوم القرآن", "مناهل العرفان", "مباحث في علوم القرآن", "التبيان في آداب حملة القرآن", "مقدمة في أصول التفسير"]),
    ("fikr", "موسوعة الفكر والمذاهب", "المذاهب الفكرية المعاصرة، والفرق، والعلمانية والإلحاد والليبرالية، والاستشراق، والغزو الفكري، ونقدها", "🧭", ["t19", "t22"], ["قضايا معاصرة", "مذاهب فكرية", "الفكر"], ["الملل والنحل", "الفرق بين الفرق", "مقالات الإسلاميين", "الفصل في الملل", "درء تعارض العقل والنقل"]),
    ("dawa", "موسوعة الدعوة", "فقه الدعوة وأصولها ووسائلها، وصفات الداعية، والأمر بالمعروف والنهي عن المنكر، والعمل الجماعي، وفقه الواقع", "📣", ["t19"], ["مع الدعاة", "المنهج السلفي", "الدعوة"], ["الأمر بالمعروف والنهي عن المنكر", "إعلام الموقعين", "مدارج السالكين", "زاد المعاد"]),
    ("lugha", "موسوعة اللغة العربية", "النحو والصرف والبلاغة والإملاء، وفقه اللغة، والمعاجم، والعروض والقافية، والشعر العربي وأغراضه وطبقاته، والأدب العربي ونقده، وأثر العربية في فهم النصوص", "✒️", ["t15", "t16", "t17"], ["اللغة", "أدب ومنوعات"], ["الكتاب لسيبويه", "الخصائص", "مغني اللبيب", "شرح ابن عقيل", "ألفية ابن مالك", "أوضح المسالك", "قطر الندى", "شذور الذهب", "الآجرومية", "لسان العرب", "مختار الصحاح", "تاج العروس", "مقاييس اللغة", "فقه اللغة", "المزهر", "دلائل الإعجاز", "أسرار البلاغة", "الإيضاح في علوم البلاغة", "البيان والتبيين", "الكامل في اللغة والأدب", "أدب الكاتب", "العقد الفريد", "الشعر والشعراء", "طبقات فحول الشعراء", "العمدة في محاسن الشعر", "شرح المعلقات", "ديوان الحماسة", "خزانة الأدب", "الكافي في العروض"]),
    ("tarikh", "موسوعة التاريخ والسيرة", "السيرة النبوية، والخلفاء الراشدون، وتاريخ الإسلام ودوله، والتراجم، وسنن الله في التاريخ", "🏛️", ["t5", "t18"], ["السيرة والتاريخ", "التاريخ"], ["البداية والنهاية", "سيرة ابن هشام", "زاد المعاد", "الرحيق المختوم", "سير أعلام النبلاء", "تاريخ الطبري", "الكامل في التاريخ"]),
    ("adab", "موسوعة الآداب الشرعية والأخلاق", "الأخلاق الفاضلة والذميمة، وآداب الطعام والسلام والمجلس والطريق والسفر، وآداب طالب العلم، والتزكية", "🌿", ["t11", "t6"], ["التزكية", "آداب", "الأخلاق"], ["الآداب الشرعية", "رياض الصالحين", "الأدب المفرد", "مدارج السالكين", "إحياء علوم الدين", "مختصر منهاج القاصدين", "أدب الدنيا والدين", "تذكرة السامع"]),
    ("tarbiya", "موسوعة التربية", "التربية الإيمانية والعلمية والخلقية والنفسية، وتربية الأبناء والشباب، ومناهج التربية ووسائلها", "🌱", ["t8", "t6"], ["شبابنا", "أطفالنا", "التربية", "الالتزام"], ["تحفة المودود", "مختصر منهاج القاصدين", "الفوائد", "صيد الخاطر", "تربية الأولاد"]),
    ("usra", "موسوعة الأسرة", "الخطبة والزواج، والحقوق الزوجية، والطلاق والعدة، وبر الوالدين وصلة الرحم، وقضايا المرأة والأسرة المعاصرة", "🏡", ["t8", "t4"], ["المرأة والأسرة", "الزواج والطلاق", "الأسرة"], ["تحفة المودود", "فقه السنة", "المغني", "زاد المعاد", "آداب الزفاف"]),
    ("siyasa", "موسوعة السياسة الشرعية", "الإمامة والولاية، والشورى، والحسبة، والقضاء، والجهاد وأحكامه، والعلاقات الدولية، والمصالح والمفاسد، والعمل السياسي", "🏛", ["t7"], ["السياسة", "حدث وتعليق", "من فقه الواقع"], ["الأحكام السلطانية", "السياسة الشرعية", "الطرق الحكمية", "غياث الأمم", "الحسبة في الإسلام"]),
]
SECS = ["التعريف", "التأصيل والأدلة", "تقريرات مشايخ الدعوة", "أقوال أهل العلم والمحققين", "الخلاصة"]
SECS_LUGHA = ["التعريف", "التأصيل والشواهد", "تقريرات مشايخ الدعوة", "أقوال أئمة اللغة والأدب", "الخلاصة"]

PLAN = """أنت لجنة علمية متخصصة تعد مخطط «{name}» على نمط الموسوعات العلمية المحكمة (كموسوعات الدرر السنية)، ومرجعيتها كتب مشايخ الدعوة السلفية ومقالاتهم وفتاواهم، مع تكميل الأبواب من المراجع المتخصصة المشهورة.
نطاقها: {desc}.
من مصادرها في المكتبة: {srcs}
ضع مخططًا محكم الترتيب على ترتيب كتب الفن المعتمدة، شاملًا غير متداخل، بعبارات علمية دقيقة:
أبواب (٨–١٤)، في كل باب فصول (٢–٦)، في كل فصل مسائل (٣–٨). المسألة عنوان دقيق لمسألة واحدة يمكن تحريرها في مادة مستقلة.
لكل مسألة "kw": ٣–٦ ألفاظ بحث عربية (كلمة أو عبارة قصيرة) يرد بها الكلام عنها في الكتب، أولها أخصها.
أخرج JSON: {{"b": [{{"t": "الباب", "f": [{{"t": "الفصل", "m": [{{"t": "المسألة", "kw": ["…"]}}]}}]}}]}}"""

ENTRY = """أنت محرر علمي متخصص في «{name}» تحرر مادة موسوعية محكمة لمسألة: «{t}» (من باب «{bab}»، فصل «{fasl}»).
المرجعية والعماد: كلام مشايخ الدعوة السلفية في كتبهم وشروحهم ومقالاتهم (المواضع الموسومة [د…]) — هي المصدر الأساسي؛ ثم تُكمَّل وتُدعَّم من الكتب العلمية المعتمدة المشهورة في الفن، مع العناية بكتب المحققين من أهل السنة قديمًا وحديثًا وشراح الحديث وأئمة اللغة والتحقيق والتاريخ والأدب (الموسومة [م…])؛ فتظهر تقريرات مشايخ الدعوة ومعها النصوص العلمية المشهورة لعلماء الأمة.
اكتب بأسلوب علمي متناسق رصين واضح، بلا حشو، وبالترتيب: {secs}.
قواعد ملزمة:
- كل فقرة تُبنى على المواضع المرسلة فقط، وتذكر رموز مواضعها في "c" (مثل ["د1","م2"]). لا تنسب قولًا ليس في المواضع، ولا تضف معلومة من خارجها إلا آية بسورتها ورقمها أو حديثًا ورد في المواضع.
- لا تذكر في الفقرات أسماء المشايخ ولا المؤلفين ولا الكتب في سياق الكلام (لا «قال الشيخ فلان»، ولا «يقرر فلان»، ولا «ذكر ابن فلان في كتابه»): اعرض المعنى أو النص نفسه مباشرة بصيغة التقرير العلمي، والعزو يكون بالرموز في "c" وحدها.
- «{dsec}»: ما قرره مشايخ الدعوة في المواضع [د…] معروضًا تقريرًا علميًّا بلا أسماء. و«{msec}»: النصوص والأقوال المشهورة من المواضع [م…]، وإن تعددت الأقوال فاعرضها أقوالًا («القول الأول…») بلا أسماء. وإن لم تكف المواضع لقسم فاتركه فارغًا.
- الأسطر الموسومة [المتن] في كتب الشروح هي نص الكتاب المشروح لا كلام الشارح: اعرضها متنًا يُشرح، والتقرير ما قاله الشارح بعدها؛ وراعِ سياق كل موضع ومراده (تقرير، أو حكاية قول، أو رد على مخالف) فلا تجعل القول المردود عليه تقريرًا.
- إن أُرسلت «المادة الحالية» فهي المنشورة: احفظ صحيحها وعزوها، وأضف إليها ما في المواضع الجديدة من زيادة أو دليل أو تفصيل أو قول، وادمجه في موضعه من الأقسام بلا تكرار ولا حذف لمعلومة معزوة صحيحة.
- المنهج (طلب المدير، ٢٧ نوفمبر): لا تكتفِ بأول موضع؛ اجمع من المواضع كلها أكثرها تخصصًا واتصالًا بالمسألة، ورتبها وادمجها في سياق علمي متماسك. والمطولات والأصول والشروح والحواشي والتحقيقات مقدمة على المختصرات إذا توافرت. ولا تضحِّ بالاستيعاب لأجل الاختصار: استوفِ ما في المواضع من الأقسام والشروط والأركان والأحكام والفروع والأدلة ومآخذ الأقوال، ولك أن تزيد أقسامًا بعناوينها عند الحاجة.
- ميّز نوع كل فقرة في "ty": "نقل" (نص حرفي من الموضع بلا تغيير)، أو "تلخيص" (معنى موضع بعبارة أخرى)، أو "تحرير" (صياغة علمية جامعة)؛ ولا تصغ كلامًا من عندك ثم تنسبه إلى عالم، وما تعذر التحقق من نسبته اذكره في "nv".
- "q": اقتباسات قصيرة (١٠–٤٠ كلمة) منسوخة بحروفها من المواضع، مع رمز موضعها.
- إن كانت المواضع لا تتعلق بالمسألة حقيقة فأخرج {{"skip": true}}.
أخرج JSON: {{"lead": "تمهيد في سطرين", "s": [{{"h": "عنوان القسم", "p": [{{"t": "فقرة", "c": ["د1"], "ty": "تحرير"}}]}}], "q": [{{"t": "اقتباس", "c": "د1"}}], "see": ["عنوان مسألة ذات صلة"], "nv": []}}

{cur}المواضع:
{ctx}"""


# ---------- النصوص ----------
CAT = jl(os.path.join(D, "catalog.json")); AUTH = {a["id"]: a.get("name", "") for a in CAT["authors"]}
BOOKS = {b["id"]: b for b in CAT["books"]}
_PG = {}

# ---------- سياسة المصادر (طلب المدير، ٢١ نوفمبر ٢٠٢٦): data/mawsua/_sources.json ----------
# الأنواع: b كتب مشايخ الدعوة (الأصل) ← s البيانات ← f فتاوى الدعوة السلفية (صوت السلف) ← a مقالات المعتمدين وحدهم.
POL = jl(os.path.join(OUT, "_sources.json"), {}) or {}
KW = dict({"b": 4, "s": 3, "f": 3, "a": 1}, **(POL.get("weight") or {}))
KCAP = dict({"b": 10, "s": 2, "f": 4, "a": 4}, **(POL.get("cap") or {}))
KLBL = {x[0]: x[1] for x in POL.get("order") or []} or {"b": "كتاب", "s": "بيان", "f": "فتوى صوت السلف", "a": "مقال"}
KLBL.setdefault("o", "كتاب دعوي"); KLBL.setdefault("i", "كتب المحققين"); KLBL.setdefault("m", "مرجع")
KW.setdefault("o", 0); KCAP.setdefault("o", 2)
# المحققون من أهل السنة (طلب المدير، ٢١ نوفمبر): كتبهم مقدَّمة في التكميل على سائر المراجع (صنف i)
IMAMS = POL.get("imams") or ["ابن تيمية", "ابن رجب", "ابن قيم الجوزية", "ابن القيم", "ابن كثير", "الذهبي", "الشاطبي", "ابن حجر", "النووي", "ابن عبد البر", "البغوي", "القرطبي", "الطبري", "السعدي", "ابن منظور", "ابن هشام", "سيبويه", "ابن جني", "ابن قتيبة", "الجاحظ", "المبرد", "عبد القاهر الجرجاني", "ابن مالك", "ابن عقيل", "السيوطي"]
IW, ICAP, MCAP = int(POL.get("imam_weight") or 3), int(POL.get("imam_cap") or 6), int(POL.get("ref_cap") or 12)
# التحديث المحافظ (طلب المدير، ٢٧ نوفمبر): تحديث مادة منشورة يُقترح بجوارها بسجل ما أُضيف وما تغير وسببه حتى تعتمده الإدارة
REVIEW = POL.get("review_updates", True) is not False
import mawsua_fiqh as F  # noqa: E402  منهج الموسوعة الفقهية المقارنة
import mawsua_disc as DS  # noqa: E402  المنهج الموسع لسائر الموسوعات (data/mawsua/_disc.json)


def _ntok(s):
    """ألفاظ الاسم للمطابقة: بلا ألقاب، و«عبد X» لفظ واحد، وبلا «ال» التعريف (عبدالمنعم = عبد المنعم، سيد = السيد)."""
    s = nz(re.sub(r"^\s*(الشيخ|الدكتور|المهندس|د\.|م\.)\s*", "", s or "")); s = re.sub(r"\bعبد\s+", "عبد", s)
    return [re.sub(r"^ال(?=..)", "", w) for w in s.split() if w]


def _approved():
    """معرّفات المؤلفين المعتمدين لمقالات الموسوعات: كل ألفاظ الاسم المعتمد في اسم المؤلف بترتيبها (سيد العفاني ← السيد حسين العفاني)."""
    L = [_ntok(n) for n in POL.get("authors") or []]
    def ok(name):
        t = _ntok(name)
        for w in L:
            if not w: continue
            i = 0
            for x in t:
                if i < len(w) and x == w[i]: i += 1
            if i == len(w): return True
        return False
    return {a["id"] for a in CAT["authors"] if ok(a.get("name", ""))} if L else None


APPROVED = _approved()


def _imam_ids():
    pats = [nz(re.sub(r"^(شيخ الإسلام|الإمام|الحافظ|العلامة|الشيخ)\s+", "", n)) for n in IMAMS]
    return {a["id"] for a in CAT["authors"] if any(p and p in nz(a.get("name", "")) for p in pats)}


IMAM_IDS = _imam_ids()


def art_kind(a):
    """نوع مادة فهرس المقالات للموسوعات: s بيان، f فتوى، a مقال لمعتمد، None مستبعد (التراث والإثرائي ومقالات غير المعتمدين)."""
    if a.get("col") in ("turath", "ithra") or not a.get("f"): return None
    c = a.get("c") or ""
    if a.get("tp") == "at17" or re.search(r"بيانات|(^|›\s*)بيان", c) or re.match(r"بيان(\s|ات)", a.get("t") or ""): return "s"
    if a.get("fa") or re.match(r"(أسئلة|الاستفتاء|من فقه الواقع)", c): return "f"
    return "a" if APPROVED is None or a.get("a") in APPROVED else None


def art_items():
    return [(a, k) for a in (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", []) for k in [art_kind(a)] if k]


def ready(b):
    """النص جاهز: كتاب إلكتروني، أو مصوَّر اكتمل تدقيقه (كما في enrich-new.py)؛ فلا تُبنى الموسوعة على تحويل لم يُراجَع."""
    return not b.get("ocr") or (b.get("unrev") or 0) + (b.get("unc") or 0) == 0


def is_src_book(b): return (b.get("col") or "dawah") == "dawah" and not b.get("hidden") and not b.get("demo") and ready(b)


def book_kind(b):
    """كتب المشايخ المعتمدين (قائمة authors نفسها التي اختيرت مقالاتهم) أصل أساسي (b)؛ وسائر كتب مكتبة الدعوة تكميل محدود (o)."""
    return "b" if APPROVED is None or b.get("authorId") in APPROVED else "o"


def pages_of(bid):
    if bid in _PG: return _PG[bid]
    for p in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p):
            try: _PG[bid] = jl(p).get("pages") or []; return _PG[bid]
            except Exception: pass
    _PG[bid] = []; return []


def body(pg): return re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0]


def corpus(e):
    """[(نوع، معرّف، عنوان، مؤلف، صفحة، نص، نص مطبع، صنف)]: مصادر الدعوة بحسب سياستها (الكتب، البيانات، فتاوى صوت السلف،
    مقالات المعتمدين)، ومراجع الفن (بالعنوان ثم بالموضوع حتى ٣٠ كتابًا) بصنف m."""
    k, name, desc, ic, topics, acats, refs = e
    out = dawah_corpus(None)
    tr = [b for b in CAT["books"] if b.get("col") == "turath" and not b.get("hidden")]
    pick = [b for b in tr if any(r in (b.get("setTitle") or b["title"]) for r in refs)]
    # كتب المحققين (ابن تيمية وابن رجب وابن القيم وابن كثير والذهبي والشاطبي وشراح الحديث وأئمة اللغة…) في موضوع الموسوعة
    pick += sorted([b for b in tr if b.get("authorId") in IMAM_IDS and b.get("topicId") in topics and b not in pick and not (b.get("vol") or 0) > 6], key=lambda b: -(b.get("size") or 0))[:30]
    pick += sorted([b for b in tr if b.get("topicId") in topics and b not in pick and not (b.get("vol") or 0) > 3], key=lambda b: -(b.get("size") or 0))[:max(0, 45 - len(pick))]
    for b in pick[:80]:
        cls = "i" if b.get("authorId") in IMAM_IDS else "m"
        for i, pg in enumerate(pages_of(b["id"])):
            t = body(pg)
            if len(t) > 200: out.append(("m", b["id"], b.get("setTitle") or b["title"], AUTH.get(b.get("authorId"), ""), i + 1, t, nz(t), cls))
    from collections import Counter
    print("  المواضع: %d (%s؛ مراجع %d كتابًا)" % (len(out), "، ".join("%s %d" % (KLBL.get(x, x), n) for x, n in Counter(r[7] for r in out).items()), len(pick[:80])), flush=True)
    return out


def find(C, m, boost=None):
    """أقوى المواضع للمسألة: العبارة الأخص أولًا، وتقارب ألفاظها؛ ١٠ من كلام المشايخ و٦ من المراجع، وموضعان على الأكثر من المصدر الواحد."""
    kws = [nz(x) for x in ([m["t"]] + (m.get("kw") or [])) if nz(x)]
    sc = []
    for r in C:
        n = r[6]; s = sum((3 if j <= 1 else 1) * min(3, n.count(w)) for j, w in enumerate(kws) if len(w) > 2)
        if s >= 3 and any(w in n for w in kws[:3]):  # عنوان المصدر بالمسألة أقوى، ثم وزن الصنف (الكتب أصل، ثم البيانات والفتاوى، ثم المقالات)
            sc.append((s + (4 if any(w in nz(r[2]) for w in kws[:3]) else 0) + (8 if boost and r[1] in boost else 0) + (IW if r[7] == "i" else KW.get(r[7], 0)) - (3 if r[0] == "m" and re.match(r"\s*(مختصر|تهذيب مختصر)", r[2]) else 0), r))  # الأصول مقدمة على المختصرات
    sc.sort(key=lambda x: -x[0]); out, per, cnt, kc = [], {}, {"d": 0, "m": 0}, {}
    for s, r in sc:
        if per.get(r[1], 0) >= 2 or cnt[r[0]] >= (10 if r[0] == "d" else MCAP) or (r[0] == "d" and kc.get(r[7], 0) >= KCAP.get(r[7], 10)) or (r[7] == "i" and kc.get("i", 0) >= ICAP): continue
        per[r[1]] = per.get(r[1], 0) + 1; cnt[r[0]] += 1; kc[r[7]] = kc.get(r[7], 0) + 1; out.append(r)
    return out


def _mark_matn(t):
    """كتب الشروح: أسطر المتن («%% ») تُوسم [المتن] حتى لا يُنسب كلام صاحب المتن إلى الشارح، ويُفهم الشرح في سياقه."""
    return re.sub(r"^%%\s*", "[المتن] ", t, flags=re.M) if "%%" in t else t


def window(r, m, w=1800):
    t, n = _mark_matn(r[5]), nz(r[5]); kw = next((nz(x) for x in (m.get("kw") or []) + [m["t"]] if nz(x) in n), "")
    k = n.find(kw) if kw else 0; k = int(k * len(t) / max(1, len(n)))
    a = max(0, k - w // 3); return ("…" if a else "") + t[a:a + w].strip()


# ---------- لا أسماء للمشايخ والمؤلفين في سياق الكلام (طلب المدير، ٢١ نوفمبر): النص يُعرض، والعزو بالأرقام ----------
_HON = r"(?:فضيلة\s+)?(?:الشيخ|الإمام|العلامة|الحافظ|شيخ\s+الإسلام|الدكتور|د\.|المؤلف|المصنف|الكاتب)"
_VERB = r"(?:و|ف)?(?:يقرر|قرر|يؤكد|أكد|يبين|بين|بيّن|يوضح|أوضح|يرى|رأى|يذكر|ذكر|ينبه|نبه|نبّه|يشير|أشار|يلفت|لفت|يقول|قال|يرجح|رجح|رجّح|يشدد|شدد|يعرف|عرف|عرّف|ينقل|نقل|يستدل|استدل|يصف|وصف|يعتبر|اعتبر|يقسم|قسم|قسّم|يفرق|فرق|فرّق|يحذر|حذر|حذّر|يلخص|لخص|لخّص|يتناول|تناول|يعدد|عدد|عدّد|يوجه|وجه|وجّه)"


def _name_rx(names):
    alts = set()
    for n in names or []:
        n = re.sub(r"^\s*(الشيخ|الدكتور|الإمام|الحافظ|العلامة|شيخ الإسلام)\s+", "", (n or "").strip()).replace("\u2069", "").strip()
        if len(n) < 3: continue
        for v in {n, re.sub(r"عبد\s+", "عبد", n), re.sub(r"عبد(?=\S)", "عبد ", n)}:
            alts.add(re.escape(v)); w = v.split()
            if len(w) >= 3: alts.add(re.escape(" ".join(w[:2])))
            if len(w) >= 2 and len(w[-1]) >= 5 and not w[-1].startswith("عبد"): alts.add(re.escape(w[-1]))  # برهامي، المقدم، الشحات
    return "|".join(sorted(alts, key=len, reverse=True))


def unname(t, names, keep=None):
    """يزيل ذكر الشيخ أو المؤلف من سياق الفقرة: «يقرر الشيخ فلان أن…» ← «المقرر أن…»، و«عند الشيخ فلان» ← حذف.
    keep (الموسوعة الفقهية، طلب المدير ٢٧ نوفمبر): أسماء ثبتت نسبة الكلام إليها (مؤلف المصدر المعزو إليه أو من ورد اسمه فيه) تبقى،
    لأن بيان «اختيار فلان» و«ترجيح فلان» من صلب المنهج المقارن؛ وما سواها يُحذف كما كان."""
    kz = [_ntok(k) for k in keep or [] if k]
    def kept(n):
        w = _ntok(n); return any(w and (w == k or (len(w) >= 2 and w[-1] == k[-1] and w[-2:] == k[-2:]) or (len(w) == 1 and w[0] in k)) for k in kz if k)
    alt = _name_rx([n for n in list(names or []) + IMAMS + list(POL.get("authors") or []) if not kept(n)])
    if not t or not alt: return t
    who = r"(?:%s\s+)?(?:%s)(?:\s+(?:رحمه\s+الله|حفظه\s+الله))?" % (_HON, alt)
    V = r"(?:(?:و|ف)?(?:قد|لقد)\s+)?" + _VERB
    IN = r"\s*(?:في\s+(?:كتابه|شرحه|مقاله|مقالته|فتواه|درسه)\s*(?:«[^»]{0,80}»)?\s*)?"
    t = re.sub(r"%s\s+%s%s:\s*" % (V, who, IN), "", t)
    t = re.sub(r"%s\s+%s%s(?:إلى\s+|على\s+)?(?=أن|أنه|أنها|بأن)" % (V, who, IN), "والمقرر ", t)
    t = re.sub(r"(%s)\s+%s%s[،,]?\s*" % (V, who, IN), r"\1 ", t)  # «وحذر الشيخ فلان من…» ← «وحذر من…»
    # اسم غير معروف بعد لقب: «وذكر الشيخ فلان الفلاني أن…» (حتى أربع كلمات قبل «أن»)
    if keep is None:  # في المنهج الفقهي المقارن لا يُحذف اسم غير معروف بعد لقب (قد يكون صاحب الاختيار المعزو إليه)
        t = re.sub(r"%s\s+%s\s+(?:[^\s،:.«»]+\s+){0,3}?[^\s،:.«»]+(?:\s+(?:رحمه|حفظه)\s+الله)?%s(?:إلى\s+|على\s+)?(?=أن\b|أنه|أنها|بأن)" % (V, _HON, IN), "والمقرر ", t)
        t = re.sub(r"(%s)\s+%s\s+(?:[^\s،:.«»]+\s+){0,4}?[^\s،:.«»]+(?:\s+(?:رحمه|حفظه)\s+الله)?\s+(?=(?:من|إلى|على|عن|في)\s)" % (V, _HON), r"\1 ", t)
    t = re.sub(r"(?:عند|لدى|بحسب|وفق|حسب|كما\s+(?:يقول|قال|ذكر|يذكر|قرر|يقرر))\s+%s\s*[،,]?\s*" % who, "", t)
    t = re.sub(r"(?:،\s*)?%s\s+(?:%s)\s*[،,]?" % (_HON, alt), "", t)
    t = re.sub(r"\s{2,}", " ", t).strip(" ،,")
    t = re.sub(r"(في\s+حين|بينما|كما)\s+والمقرر\s+أن", r"\1 أن", t)
    if keep is None: t = re.sub(r"^\s*(?:%s\s+[^:.]{3,40}:\s*)?[:،\s]*" % _HON, "", t)  # «الشيخ فلان: …» عنوانًا للفقرة
    t = re.sub(r"^(?:قرر|أوضح|بين|بيّن|أكد|ذكر|نبه|أشار)\s+(?:إلى\s+)?أن", "المقرر أن", t)
    t = re.sub(r"(^|[.؛]\s*)والمقرر ", r"\1المقرر ", t)
    return t


# ---------- المخطط ----------
def plan(e, force=False):
    k = e[0]; tp = os.path.join(OUT, k, "_tree.json")
    if os.path.exists(tp) and not force: print("  المخطط موجود:", k); return
    dawah = [b["title"] for b in CAT["books"] if (b.get("col") or "dawah") == "dawah" and (b.get("topicId") in e[4] or any(c in b.get("title", "") for c in e[5]))][:25]
    srcs = "كتب المشايخ: " + ("، ".join(dawah) or "متفرقة") + ". ومقالاتهم وفتاواهم في: " + "، ".join(e[5]) + ". والمراجع: " + "، ".join(e[6]) + "."
    r = T.gemini(PLAN.format(name=e[1], desc=e[2], srcs=srcs))
    if not r or not r.get("b"): print("  تعذر المخطط:", k); return False
    tree = []
    for i, b in enumerate(r["b"], 1):
        fs = []
        for j, f in enumerate(b.get("f") or [], 1):
            ms = [{"id": "%s-%d-%d-%d" % (k, i, j, x), "t": m["t"].strip(), "kw": [w for w in (m.get("kw") or []) if isinstance(w, str)][:6]} for x, m in enumerate(f.get("m") or [], 1) if m.get("t")]
            if ms: fs.append({"t": f["t"].strip(), "m": ms})
        if fs: tree.append({"t": b["t"].strip(), "f": fs})
    jw(tp, {"k": k, "n": e[1], "built": str(datetime.date.today()), "ok": 1, "auto": 1, "b": tree})
    print("  ✓ مخطط %s: %d بابًا، %d مسألة" % (k, len(tree), sum(len(f["m"]) for b in tree for f in b["f"])))
    return True


# ---------- تحرير المسائل ----------
def build(e, n=20, ids=None, boost=None, why=""):
    k = e[0]; tp = os.path.join(OUT, k, "_tree.json"); tree = jl(tp)
    if not tree: print("  لا مخطط لـ", k, "— يُبنى أولًا"); plan(e); tree = jl(tp)
    if not tree: return 0
    todo = [(b, f, m) for b in tree["b"] for f in b["f"] for m in f["m"] if ((m["id"] in ids) if ids else (not m.get("e") and not m.get("skip")))][:n]
    if not todo: print("  اكتملت مسائل", k); return 0
    if k == "fiqh":  # المنهج الفقهي المقارن (طلب المدير، ٢٧ نوفمبر): المسارات الثلاثة ومشايخ الدعوة، والهيكل التسعي، وضبط النسبة
        d, _ = F.build(e, tree, todo, boost, why); return d
    if DS.has(k):  # سائر الموسوعات بالمنهج الموسع (طلب المدير، ٢٧ نوفمبر): مراجع الفن بأدوارها، والأقوال والترجيح واختيارات المشايخ بضبط النسبة
        d, _ = F.build(e, tree, todo, boost, why, DS.profile(e)); return d
    C = corpus(e); done = 0
    for b, f, m in todo:
        if time.time() - T0 > LIMIT: break
        hits = find(C, m, set(boost or []))
        ep = os.path.join(OUT, k, "e", m["id"] + ".json"); old = jl(ep) if m.get("e") else None
        if old and boost:  # التحديث بمصدر جديد يضيف ولا يُسقط: مواضع المادة المنشورة تبقى في السياق
            have = {(h[1], h[4]) for h in hits}; ix = {(r[1], r[4]): r for r in C}
            for v in (old.get("src") or {}).values():
                r = ix.get((v.get("b"), v.get("p")))
                if r and (r[1], r[4]) not in have and len(hits) < 18: hits.append(r); have.add((r[1], r[4]))
        if len([h for h in hits if h[0] == "d"]) < 1 and len(hits) < 3:
            if not m.get("e"): m["skip"] = "قلة المواضع"  # المنشورة تبقى كما هي
            print("  ✗ قلة المواضع:", m["t"]); continue
        tags, ctx = {}, []
        for h in hits:
            tg = ("د" if h[0] == "d" else "م") + str(1 + sum(1 for x in tags.values() if x[0] == h[0]))
            tags[tg] = h; ctx.append("[%s] (%s) «%s» — %s، ص %d:\n%s" % (tg, KLBL.get(h[7], "مرجع"), h[2], h[3], h[4], window(h, m)))
        SX = SECS_LUGHA if k == "lugha" else SECS
        cur = ""
        if old and boost:  # المادة الحالية برموز المواضع الجديدة، ليُضاف إليها الجديد في موضعه
            back = {(h[1], h[4]): tg for tg, h in tags.items()}
            rmap = {g: back.get((v.get("b"), v.get("p"))) for g, v in (old.get("src") or {}).items()}
            lines = [old.get("lead", "")] + ["## " + x.get("h", "") + "\n" + "\n".join(p["t"] + " " + "".join("[%s]" % rmap[c] for c in p.get("c") or [] if rmap.get(c)) for p in x.get("p") or []) for x in old.get("s") or []]
            cur = "المادة الحالية (المنشورة):\n" + "\n".join(lines)[:6000] + "\n\n"
            newt = sorted({tg for tg, h in tags.items() if h[1] in set(boost)})
            if newt: cur += "المواضع الجديدة المطلوب إدخالها: " + "، ".join(newt) + "\n\n"
        r = T.gemini(ENTRY.format(name=e[1], t=m["t"], bab=b["t"], fasl=f["t"], secs="، ".join(SX), dsec=SX[2], msec=SX[3], cur=cur, ctx="\n\n".join(ctx)))
        if not r: break  # نفدت الحصة
        if r.get("skip"):
            if not m.get("e"): m["skip"] = "المواضع لا تتعلق بالمسألة"
            continue
        used, secs = set(), []
        for s in r.get("s") or []:
            ps = []
            for p in s.get("p") or []:
                c = [x for x in (p.get("c") or []) if x in tags]
                if p.get("t") and c:
                    ty = p.get("ty") if p.get("ty") in ("نقل", "تلخيص", "تحرير") else "تحرير"
                    if ty == "نقل" and not any(len(nz(p["t"])) > 12 and nz(p["t"].strip(" «»\"")) in tags[x][6] for x in c): ty = "تلخيص"  # النقل الحرفي يُتحقق منه
                    ps.append({"t": unname(p["t"].strip(), [tags[x][3] for x in c]), "c": c, "ty": ty}); used.update(c)
            if ps: secs.append({"h": (s.get("h") or "").strip(), "p": ps})
        qs = []
        for q in r.get("q") or []:
            c = q.get("c"); t = (q.get("t") or "").strip(" «»\"")
            if c in tags and t and nz(t) in tags[c][6]: qs.append({"t": t, "c": c}); used.add(c)
        if not secs:
            if not m.get("e"): m["skip"] = "لم تُعزَ الفقرات"
            continue
        src = {tg: dict({"k": h[0], "s": h[7], "b": h[1], "t": h[2], "a": h[3], "p": h[4]}, **({"v": (BOOKS.get(h[1]) or {}).get("vol")} if (BOOKS.get(h[1]) or {}).get("vol") else {})) for tg, h in tags.items() if tg in used}
        # الاعتماد والنشر تلقائيان (طلب المدير، ٢١ نوفمبر): المادة تُنشر فور تحريرها، وتبقى للإدارة المراجعة والتعديل اليدوي
        ent = {"id": m["id"], "t": m["t"], "bab": b["t"], "fasl": f["t"], "lead": unname(r.get("lead", ""), [h[3] for h in tags.values()]), "s": secs, "q": qs, "src": src,
               "see": [x for x in (r.get("see") or []) if isinstance(x, str)][:6], "built": str(datetime.date.today()), "ok": 1, "auto": 1, "v2": 1, "v": 2}
        nvl = [x for x in (r.get("nv") or []) if isinstance(x, str) and x.strip()][:10]
        if nvl: ent["nv"] = nvl
        old = old or jl(ep)
        nb = sorted({h["b"] for h in src.values()} & set(boost or []))
        if nb: ent["upd"] = str(datetime.date.today()); ent["new"] = nb
        w = why or ("مصدر جديد" if nb else ("إعادة التحرير" if old else "التحرير الأول"))
        if old: ent["chg"] = F.changes(old, ent, w)
        ent["hist"] = F.hist(old, ent, w)
        if old and (old.get("man") or REVIEW):  # التحديث المحافظ: المنشور باقٍ، والتحديث مقترح بجواره بسجل تغييره حتى تعتمده الإدارة
            ent["ok"] = 0
            jw(os.path.join(OUT, k, "e", m["id"] + ".new.json"), ent); m["rev"] = 1; done += 1; print("  ↻ تحديث مقترح:", m["t"], flush=True)
            glog({"k": k, "id": m["id"], "t": m["t"], "do": "rev", "b": nb}); jw(tp, tree); continue
        if old: jw(os.path.join(OUT, k, "e", m["id"] + ".prev.json"), old)  # النسخة السابقة محفوظة للمقارنة والاسترجاع
        jw(ep, ent)
        m["e"] = 1; m["ok"] = 1; m.pop("skip", None); m.pop("rev", None); done += 1; print("  ✓", m["t"], "— مواضع", len(src), flush=True)
        if nb or m.get("add"): glog({"k": k, "id": m["id"], "t": m["t"], "do": "upd" if old else "new", "b": nb})
        jw(tp, tree)
    jw(tp, tree); return done


# ---------- النمو التلقائي (طلب المدير، ٢١ نوفمبر ٢٠٢٦) ----------
def dawah_sources():
    """معرّفات مصادر الدعوة بحسب سياسة المصادر: كتب المشايخ وشروحهم وتفريغاتهم (col=dawah)، والبيانات، وفتاوى صوت السلف، ومقالات المعتمدين."""
    return {b["id"] for b in CAT["books"] if is_src_book(b)} | {a["id"] for a, _ in art_items()}


def dawah_corpus(ids):
    """مواضع مصادر الدعوة (كلها، أو المعرّفات المعطاة) بصنفها في الحقل الثامن."""
    out = []
    for b in CAT["books"]:
        if not is_src_book(b) or (ids is not None and b["id"] not in ids): continue
        for i, pg in enumerate(pages_of(b["id"])):
            t = body(pg)
            if len(t) > 200: out.append(("d", b["id"], b.get("setTitle") or b["title"], AUTH.get(b.get("authorId"), ""), i + 1, t, nz(t), book_kind(b)))
    grp = {}
    for a, kd in art_items():
        if ids is not None and a["id"] not in ids: continue
        if a["f"] not in grp: grp[a["f"]] = jl(os.path.join(D, "articles", a["f"] + ".json"), {}) or {}
        for i, pg in enumerate((grp[a["f"]].get(a["id"]) or {}).get("pages") or []):
            t = body(pg)
            if len(t) > 200: out.append(("d", a["id"], a.get("t", ""), AUTH.get(a.get("a"), ""), i + 1, t, nz(t), kd))
    return out


def new_corpus(ids): return dawah_corpus(set(ids))


def dead():
    """نفدت حصة مفاتيح Gemini كلها في هذه الجولة (ولا محرك بديل)."""
    return bool(T.KEYS) and len(T.EXH) >= len(T.KEYS) and not getattr(T, "GHM_TOKEN", "")


def ensure(n=40):
    """الاستمرار الذاتي: موسوعة بلا مخطط يُطلب مخططها، وما بقي من مسائل غير محررة يُطلب تحريره؛ ما لم يكن في الطابور."""
    qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}; it = Q["items"]
    for e in ENC:
        k, tree = e[0], jl(os.path.join(OUT, e[0], "_tree.json"))
        if not tree:
            if not any(x.get("k") == k and x.get("do") == "plan" for x in it): it.insert(0, {"k": k, "do": "plan"})  # المخططات أولًا قبل أن تستهلك المسائل الحصة
        elif any(not m.get("e") and not m.get("skip") for b in tree["b"] for f in b["f"] for m in f["m"]) and not any(x.get("k") == k and x.get("do") == "build" and not x.get("ids") for x in it):
            it.append({"k": k, "do": "build", "n": n})
        if (k == "fiqh" or DS.has(k)) and tree:  # المنهج الموسع: المخطط الموسع أولًا، ثم ترقية المواد السابقة مقترحاتٍ بجوار المنشور
            if tree.get("v") != 3 and not any(x.get("k") == k and x.get("do") == "plan2" for x in it): it.insert(0, {"k": k, "do": "plan2"})
            if F.upgrade_ids(tree, 1) and not any(x.get("k") == k and x.get("do") == "upgrade" for x in it): it.append({"k": k, "do": "upgrade", "n": 20})
    jw(qp, Q)


VERIFY = """أنت مدقق علمي في «{name}». لكل زوج (مسألة، موضع من كتاب جديد) قرّر: هل يتناول الموضع هذه المسألة حقيقةً بمعناها وسياقها
(تعريفها، أو دليلها، أو حكمها، أو الخلاف فيها، أو تفصيلها، أو فائدة متصلة بها)؟ لا يكفي اشتراك لفظ، ولا ذكر عابر، ولا أن يكون المعنى غير المعنى المراد في المسألة.
أخرج JSON: {{"r": [{{"i": رقم_الزوج, "ok": true أو false, "w": "تعريف|دليل|حكم|خلاف|تفصيل|فائدة"}}]}}

{pairs}"""

EXPAND = """أنت لجنة علمية تنمّي «{name}». هذا مخططها الحالي (أبواب ← فصول، ومن مسائلها):
{outline}

وهذه فصول كتاب جديد من كتب مشايخ الدعوة السلفية: «{book}»، مع مقتطف من كل فصل:
{chapters}

اقترح مسائل جديدة يحررها هذا الكتاب وليست في المخطط بمعناها (لا تكرر مسألة موجودة ولو بلفظ آخر)، وتدخل في نطاق الموسوعة حقيقةً؛
وضع كل مسألة في الباب والفصل المناسبين من المخطط (بأرقامهما)، بعنوان علمي دقيق لمسألة واحدة، مع ٣–٦ ألفاظ بحث يرد بها الكلام عنها في الكتاب.
إن لم يكن في الكتاب جديد يخص هذه الموسوعة فأخرج {{"m": []}}. لا تزد على {cap} مسائل.
أخرج JSON: {{"m": [{{"b": رقم_الباب, "f": رقم_الفصل, "t": "عنوان المسألة", "kw": ["…"]}}]}}"""


def glog(ev):
    """سجل نمو الموسوعات (يعرضه «أحدث الإضافات والتحديثات» في #/mawsua): آخر ٢٠٠ حدث."""
    gp = os.path.join(OUT, "_growth.json"); G = jl(gp, {"items": []}) or {"items": []}
    ev["at"] = str(datetime.date.today()); G["items"] = ([ev] + [x for x in G["items"] if not (x.get("id") == ev.get("id") and x.get("at") == ev["at"])])[:200]
    jw(gp, G)


def verify(e, pairs):
    """التحقق بالمعنى والسياق من مطابقة المواضع الجديدة لمسائل الموسوعة (المطابقة اللفظية وحدها تخطئ): دفعات من ١٢ زوجًا."""
    ok = {}
    for i in range(0, len(pairs), 12):
        if dead() or time.time() - T0 > LIMIT * 0.4: break
        chunk = pairs[i:i + 12]
        txt = "\n\n".join("[%d] المسألة: «%s» (باب «%s»)\nالموضع: «%s»، ص %d:\n%s" % (j + 1, m["t"], bt, h[2], h[4], window(h, m, 700)) for j, (m, h, bt) in enumerate(chunk))
        r = T.gemini(VERIFY.format(name=e[1], pairs=txt))
        if not r: break
        for x in r.get("r") or []:
            try: j = int(x.get("i")) - 1
            except Exception: continue
            if 0 <= j < len(chunk) and x.get("ok") is True: m, h, _ = chunk[j]; ok.setdefault(m["id"], set()).add(h[1])
    return ok


def expand(e, tree, bid, cap=6):
    """مسائل جديدة من فصول الكتاب الجديد لا يغطيها المخطط: تُضاف إلى بابها وفصلها (منشورة تلقائيًّا) وتُحرَّر بالكتاب نفسه."""
    b = BOOKS.get(bid) or {}; doc = None
    for p_ in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p_): doc = jl(p_); break
    if not doc: return []
    pages, toc, seen_t = doc.get("pages") or [], [], set()
    for x in doc.get("toc") or []:
        t = (x.get("t") or "").strip(); p_ = int(x.get("p") or 1)
        if t and t not in seen_t and 0 < p_ <= len(pages): seen_t.add(t); toc.append((t, p_))
    if len(toc) < 2: return []
    ch = "\n".join("- %s: %s" % (t, re.sub(r"\s+", " ", body(pages[p_ - 1]))[:220]) for t, p_ in toc[:60])
    outline = "\n".join("%d. %s\n%s" % (i + 1, B_["t"], "\n".join("   %d.%d %s: %s" % (i + 1, j + 1, F["t"], "، ".join(m["t"] for m in F["m"][:8])) for j, F in enumerate(B_["f"]))) for i, B_ in enumerate(tree["b"]))
    r = T.gemini(EXPAND.format(name=e[1], outline=outline[:9000], book=b.get("setTitle") or b.get("title", bid), chapters=ch[:9000], cap=cap))
    if not r: return []
    have = {nz(m["t"]) for B_ in tree["b"] for F in B_["f"] for m in F["m"]}; out = []
    for x in (r.get("m") or [])[:cap]:
        try: bi, fi = int(x.get("b")) - 1, int(x.get("f")) - 1; F = tree["b"][bi]["f"][fi]
        except Exception: continue
        t = (x.get("t") or "").strip()
        if not t or nz(t) in have: continue
        n = 1 + max([int(m["id"].rsplit("-", 1)[-1]) for m in F["m"] if m["id"].rsplit("-", 1)[-1].isdigit()] or [0])
        m = {"id": "%s-%d-%d-%d" % (e[0], bi + 1, fi + 1, n), "t": t, "kw": [w for w in (x.get("kw") or []) if isinstance(w, str)][:6], "add": str(datetime.date.today()), "from": bid}
        F["m"].append(m); have.add(nz(t)); out.append(m["id"])
    return out


def grow(cap=25):
    """النمو التلقائي بكل ما يُرفع من كتب مشايخ الدعوة وشروحهم وتفريغاتهم ومقالاتهم (بعد جاهزية نصه):
    ١) المطابقة اللفظية تقترح المسائل المتعلقة بالجديد؛ ٢) التحقق بالمعنى والسياق يُبقي ما يتناول المسألة حقيقةً (verify)؛
    ٣) مسائل جديدة من فصول الكتاب الجديد لا يغطيها المخطط تُضاف إلى أبوابها (expand)؛ ٤) تُحرَّر في الطابور مع تقديم المصدر الجديد:
    غير المحررة تُحرَّر، والمنشورة يُدمج فيها الجديد مع بقاء مواضعها السابقة، والمعدلة يدويًّا يُقترح تحديثها بجوارها.
    الكتاب المصوَّر لا يُعدّ «مقروءًا» حتى يكتمل تدقيقه، فيُتناول عند جاهزيته. الحالة: data/mawsua/_seen.json، والسجل: _growth.json."""
    ensure()
    sp = os.path.join(OUT, "_seen.json"); seen = jl(sp); now = dawah_sources()
    REGS = {"fiqh": F.registry()[1]}; REGS.update({e[0]: DS.registry(e[0]) for e in ENC if DS.has(e[0])})
    refs_now = set().union(*REGS.values())  # مراجع الموسوعات (الفقه وسائر الفنون): ما يُضاف منها يُطابَق بمسائل موسوعته كذلك
    if seen is None: jw(sp, {"at": str(datetime.date.today()), "ids": sorted(now), "refs": sorted(refs_now)}); print("  النمو: بُدئت الحالة بـ%d مصدرًا" % len(now)); return
    if "refs" not in seen: seen["refs"] = sorted(refs_now); jw(sp, seen)  # أول تشغيل بالسجل: الموجود يغطيه التحرير بالمنهج الجديد
    new = sorted(now - set(seen.get("ids") or [])); new_refs = sorted(refs_now - set(seen.get("refs") or []))
    if not new and not new_refs: print("  النمو: لا مصادر جديدة"); return
    C = new_corpus(set(new))
    CR = {k_: F.ref_corpus([x for x in new_refs if x in by_], by_) for k_, by_ in REGS.items()} if new_refs else {}
    print("  النمو: %d مصدرًا جديدًا (%d موضعًا)، و%d مجلدًا من مراجع الموسوعات" % (len(new), len(C), len(new_refs)), flush=True)
    newbooks = [x for x in new if x in BOOKS]
    qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}; added = 0; done_ids = set(new); died = False
    for e in ENC:
        tp = os.path.join(OUT, e[0], "_tree.json"); tree = jl(tp)
        if not tree: continue
        cand = []; CE = C + (CR.get(e[0]) or [])
        if not CE: continue
        for b in tree["b"]:
            for f in b["f"]:
                for m in f["m"]:
                    for h in find(CE, m)[:3]: cand.append((m, h, b["t"]))
        cand.sort(key=lambda x: -len(x[0].get("kw") or []))
        okm = verify(e, cand[:cap * 3]) if cand else {}
        if cand and not okm and dead(): done_ids = set(); died = True; print("  النمو: نفدت الحصة قبل التحقق؛ يعاد غدًا"); break
        ids = list(okm)[:cap]; boost = set().union(*okm.values()) if okm else set()
        from collections import Counter
        rel = Counter(b_ for v in okm.values() for b_ in v)  # كتب جديدة ثبتت صلتها بالموسوعة بالمعنى (مسألتان فأكثر) أو بموضوعها: تُستخرج منها مسائل جديدة
        for bid in [x for x in newbooks if rel[x] >= 2 or (BOOKS[x].get("topicId") in e[4])][:3]:
            if dead(): break
            add = expand(e, tree, bid)
            if add: ids += add; boost.add(bid); print("  %s: %d مسألة جديدة من «%s»" % (e[0], len(add), BOOKS[bid].get("title", bid)))
        if ids:
            for B_ in tree["b"]:
                for F in B_["f"]:
                    for m in F["m"]:
                        if m["id"] in ids: m.pop("skip", None)
            jw(tp, tree); Q["items"].append({"k": e[0], "do": "build", "n": len(ids), "ids": ids, "boost": sorted(boost), "grow": str(datetime.date.today())}); added += len(ids)
            print("  %s: %d مسألة تتعلق بالجديد (بعد التحقق بالمعنى)" % (e[0], len(ids)))
    jw(qp, Q)
    if done_ids or new_refs: jw(sp, {"at": str(datetime.date.today()), "ids": sorted(set(seen.get("ids") or []) | done_ids), "refs": sorted(set(seen.get("refs") or []) | (set() if died else set(new_refs)))})
    print("  النمو: %d مسألة في الطابور" % added)


def index():
    items = []
    for e in ENC:
        t = jl(os.path.join(OUT, e[0], "_tree.json"), {}) or {}; ms = [m for b in t.get("b", []) for f in b["f"] for m in f["m"]]
        items.append({"k": e[0], "n": e[1], "d": e[2], "ic": e[3], "bab": len(t.get("b", [])), "m": len(ms), "e": sum(1 for m in ms if m.get("e")), "ok": sum(1 for m in ms if m.get("ok")), "rev": sum(1 for m in ms if m.get("rev"))})
    pol = {"order": POL.get("order") or [], "authors": POL.get("authors") or [], "n": {}}
    from collections import Counter
    pol["n"] = dict(Counter(k for _, k in art_items())); pol["n"]["b"] = sum(1 for b in CAT["books"] if is_src_book(b))
    recent = [x for x in (jl(os.path.join(OUT, "_growth.json"), {}) or {}).get("items", [])][:30]
    for x in recent: x["bt"] = [(BOOKS.get(b) or {}).get("setTitle") or (BOOKS.get(b) or {}).get("title", b) for b in x.get("b") or []][:3]
    try: fqp = F.policy()
    except Exception as x: fqp = {}; print("  تعذر سجل مصادر الفقه:", x)
    disc = {}
    for e in ENC:
        if DS.has(e[0]):
            try: disc[e[0]] = DS.policy(e[0])
            except Exception as x: print("  تعذر سجل", e[0], x)
    jw(os.path.join(OUT, "_index.json"), {"note": "tools/mawsua.py — الموسوعات العلمية المتخصصة", "secs": SECS, "src": pol, "fiqh": dict(fqp, secs=F.SECS3), "disc": disc, "review": REVIEW, "items": items, "recent": recent})


def fix_existing():
    """المواد المحررة قبل قرار ٢١ نوفمبر: تُزال الأسماء من سياقها، وتُعتمد وتُنشر (ما لم تُعدَّل يدويًّا)، وتوضع في الطابور لإعادة تحريرها بالسياسة الجديدة."""
    n, rq = 0, []
    for e in ENC:
        tp = os.path.join(OUT, e[0], "_tree.json"); tree = jl(tp)
        if not tree: continue
        tree["ok"] = 1; ids = []
        for b in tree["b"]:
            for f in b["f"]:
                for m in f["m"]:
                    ep = os.path.join(OUT, e[0], "e", m["id"] + ".json"); E_ = jl(ep)
                    if not E_ or not m.get("e"): continue
                    nm = [v.get("a") for v in (E_.get("src") or {}).values()]
                    E_["lead"] = unname(E_.get("lead", ""), nm)
                    for s_ in E_.get("s") or []:
                        for p_ in s_.get("p") or []: p_["t"] = unname(p_["t"], nm)
                    if not E_.get("man"): E_["ok"] = 1; E_["auto"] = 1; m["ok"] = 1
                    jw(ep, E_); n += 1
                    if not E_.get("man") and not E_.get("v2"): ids.append(m["id"])
        jw(tp, tree)
        if ids: rq.append({"k": e[0], "do": "build", "n": len(ids), "ids": ids, "redo": "v2"})
    qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}
    Q["items"] = rq + [x for x in Q["items"] if x.get("redo") != "v2"]; jw(qp, Q)
    print("  أُصلحت ونُشرت %d مادة، وأعيد تحريرها في الطابور: %d" % (n, sum(len(x["ids"]) for x in rq)))


class _G:
    """واجهة الوحدة لـ mawsua_fiqh (تعمل كذلك إذا حُمِّلت هذه الوحدة بـ importlib كما في misbar.py)."""
    def __getattr__(self, k): return globals()[k]


F.init(_G()); DS.init(_G())


def main():
    a = sys.argv[1:]; E = {e[0]: e for e in ENC}
    if a and a[0] == "fix": fix_existing(); index(); return
    if a and a[0] == "grow": grow(); index(); return
    if a and a[0] == "plan2":
        for k in (a[1:2] if len(a) > 1 and a[1] in E else ["fiqh"]): (F.plan2 if k == "fiqh" else DS.plan2)(E[k])
        index(); return
    if a and a[0] == "plan": [plan(E[k], "--force" in a) for k in (a[1:2] if len(a) > 1 and a[1] in E else E)]
    elif a and a[0] == "build" and len(a) > 1: build(E[a[1]], int(a[2]) if len(a) > 2 else 20)
    else:
        qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}; rest = []
        for it in Q.get("items", []):
            e = E.get(it.get("k"))
            if not e: continue
            if time.time() - T0 > LIMIT or dead(): rest.append(it); continue  # نفدت المهلة أو حصة المفاتيح كلها: يبقى للجولة القادمة
            if it.get("do") == "plan":
                if plan(e, bool(it.get("force"))) is False: rest.append(it)
            elif it.get("do") == "plan2":  # المخطط الموسع: الفقه على كتبه الثمانية عشر، وسائر الموسوعات على أقسام فنونها (يُستأنف حتى يتم)
                if (F.plan2(e) if e[0] == "fiqh" else DS.plan2(e) if DS.has(e[0]) else True) is False: rest.append(it)
            elif it.get("do") == "upgrade":  # ترقية المواد السابقة إلى المنهج الفقهي المقارن: مقترحات بجوار المنشور
                tr_ = jl(os.path.join(OUT, e[0], "_tree.json")); ids_ = F.upgrade_ids(tr_, int(it.get("n") or 20)) if tr_ and (e[0] == "fiqh" or DS.has(e[0])) else []
                if ids_:
                    d = build(e, len(ids_), ids_, None, "ترقية المادة إلى منهج الموسوعة الفقهية المقارنة" if e[0] == "fiqh" else "ترقية المادة إلى المنهج العلمي الموسع")
                    if d < len(ids_) or F.upgrade_ids(jl(os.path.join(OUT, e[0], "_tree.json")), 1): rest.append(it)
            else:
                n = int(it.get("n") or 20); d = build(e, n, it.get("ids"), it.get("boost"))
                if it.get("ids"):
                    if not d: rest.append(it)
                elif d < n and any(not m.get("e") and not m.get("skip") for b in jl(os.path.join(OUT, e[0], "_tree.json"))["b"] for f in b["f"] for m in f["m"]): rest.append(dict(it, n=n - d))  # ما بقي (أو كله إن نفدت الحصة) إلى الجولة القادمة
        jw(qp, {"items": rest})
    index()


if __name__ == "__main__":
    main()
