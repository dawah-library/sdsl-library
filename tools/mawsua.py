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
    ("lugha", "موسوعة اللغة العربية", "النحو والصرف والبلاغة والإملاء، وفقه اللغة، والمعاجم، وأثر العربية في فهم النصوص", "✒️", ["t15", "t16"], ["اللغة"], ["شرح ابن عقيل", "أوضح المسالك", "قطر الندى", "شذور الذهب", "الآجرومية", "لسان العرب", "مختار الصحاح", "فقه اللغة", "دلائل الإعجاز"]),
    ("tarikh", "موسوعة التاريخ والسيرة", "السيرة النبوية، والخلفاء الراشدون، وتاريخ الإسلام ودوله، والتراجم، وسنن الله في التاريخ", "🏛️", ["t5", "t18"], ["السيرة والتاريخ", "التاريخ"], ["البداية والنهاية", "سيرة ابن هشام", "زاد المعاد", "الرحيق المختوم", "سير أعلام النبلاء", "تاريخ الطبري", "الكامل في التاريخ"]),
    ("adab", "موسوعة الآداب الشرعية والأخلاق", "الأخلاق الفاضلة والذميمة، وآداب الطعام والسلام والمجلس والطريق والسفر، وآداب طالب العلم، والتزكية", "🌿", ["t11", "t6"], ["التزكية", "آداب", "الأخلاق"], ["الآداب الشرعية", "رياض الصالحين", "الأدب المفرد", "مدارج السالكين", "إحياء علوم الدين", "مختصر منهاج القاصدين", "أدب الدنيا والدين", "تذكرة السامع"]),
    ("tarbiya", "موسوعة التربية", "التربية الإيمانية والعلمية والخلقية والنفسية، وتربية الأبناء والشباب، ومناهج التربية ووسائلها", "🌱", ["t8", "t6"], ["شبابنا", "أطفالنا", "التربية", "الالتزام"], ["تحفة المودود", "مختصر منهاج القاصدين", "الفوائد", "صيد الخاطر", "تربية الأولاد"]),
    ("usra", "موسوعة الأسرة", "الخطبة والزواج، والحقوق الزوجية، والطلاق والعدة، وبر الوالدين وصلة الرحم، وقضايا المرأة والأسرة المعاصرة", "🏡", ["t8", "t4"], ["المرأة والأسرة", "الزواج والطلاق", "الأسرة"], ["تحفة المودود", "فقه السنة", "المغني", "زاد المعاد", "آداب الزفاف"]),
    ("siyasa", "موسوعة السياسة الشرعية", "الإمامة والولاية، والشورى، والحسبة، والقضاء، والجهاد وأحكامه، والعلاقات الدولية، والمصالح والمفاسد، والعمل السياسي", "🏛", ["t7"], ["السياسة", "حدث وتعليق", "من فقه الواقع"], ["الأحكام السلطانية", "السياسة الشرعية", "الطرق الحكمية", "غياث الأمم", "الحسبة في الإسلام"]),
]
SECS = ["التعريف", "التأصيل والأدلة", "تقريرات مشايخ الدعوة", "أقوال أهل العلم من المراجع", "الخلاصة"]

PLAN = """أنت لجنة علمية متخصصة تعد مخطط «{name}» على نمط الموسوعات العلمية المحكمة (كموسوعات الدرر السنية)، ومرجعيتها كتب مشايخ الدعوة السلفية ومقالاتهم وفتاواهم، مع تكميل الأبواب من المراجع المتخصصة المشهورة.
نطاقها: {desc}.
من مصادرها في المكتبة: {srcs}
ضع مخططًا محكم الترتيب على ترتيب كتب الفن المعتمدة، شاملًا غير متداخل، بعبارات علمية دقيقة:
أبواب (٨–١٤)، في كل باب فصول (٢–٦)، في كل فصل مسائل (٣–٨). المسألة عنوان دقيق لمسألة واحدة يمكن تحريرها في مادة مستقلة.
لكل مسألة "kw": ٣–٦ ألفاظ بحث عربية (كلمة أو عبارة قصيرة) يرد بها الكلام عنها في الكتب، أولها أخصها.
أخرج JSON: {{"b": [{{"t": "الباب", "f": [{{"t": "الفصل", "m": [{{"t": "المسألة", "kw": ["…"]}}]}}]}}]}}"""

ENTRY = """أنت محرر علمي متخصص في «{name}» تحرر مادة موسوعية محكمة لمسألة: «{t}» (من باب «{bab}»، فصل «{fasl}»).
المرجعية والعماد: كلام مشايخ الدعوة السلفية (المواضع الموسومة [د…])، ثم تُكمَّل من المراجع العلمية (الموسومة [م…]).
اكتب بأسلوب علمي متناسق رصين واضح، بلا حشو، وبالترتيب: {secs}.
قواعد ملزمة:
- كل فقرة تُبنى على المواضع المرسلة فقط، وتذكر رموز مواضعها في "c" (مثل ["د1","م2"]). لا تنسب إلى أحد قولًا ليس في المواضع، ولا تضف معلومة من خارجها إلا آية بسورتها ورقمها أو حديثًا ورد في المواضع.
- «تقريرات مشايخ الدعوة»: اذكر الشيخ باسمه كما في الموضع وتقريره. وإن لم تكف المواضع لقسم فاتركه فارغًا.
- "q": اقتباسات قصيرة (١٠–٤٠ كلمة) منسوخة بحروفها من المواضع، مع رمز موضعها.
- إن كانت المواضع لا تتعلق بالمسألة حقيقة فأخرج {{"skip": true}}.
أخرج JSON: {{"lead": "تمهيد في سطرين", "s": [{{"h": "عنوان القسم", "p": [{{"t": "فقرة", "c": ["د1"]}}]}}], "q": [{{"t": "اقتباس", "c": "د1"}}], "see": ["عنوان مسألة ذات صلة"]}}

المواضع:
{ctx}"""


# ---------- النصوص ----------
CAT = jl(os.path.join(D, "catalog.json")); AUTH = {a["id"]: a.get("name", "") for a in CAT["authors"]}
BOOKS = {b["id"]: b for b in CAT["books"]}
_PG = {}


def pages_of(bid):
    if bid in _PG: return _PG[bid]
    for p in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p):
            try: _PG[bid] = jl(p).get("pages") or []; return _PG[bid]
            except Exception: pass
    _PG[bid] = []; return []


def body(pg): return re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0]


def corpus(e):
    """[(نوع، معرّف، عنوان، مؤلف، صفحة، نص، نص مطبع)]: كتب المشايخ ومقالاتهم وفتاواهم كلها، ومراجع الفن (بالعنوان ثم بالموضوع حتى ٣٠ كتابًا)."""
    k, name, desc, ic, topics, acats, refs = e; out = []
    for b in CAT["books"]:
        if (b.get("col") or "dawah") != "dawah" or b.get("hidden"): continue
        for i, pg in enumerate(pages_of(b["id"])):
            t = body(pg)
            if len(t) > 200: out.append(("d", b["id"], b.get("setTitle") or b["title"], AUTH.get(b.get("authorId"), ""), i + 1, t, nz(t)))
    ix = (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", [])
    grp = {}
    for a in ix:
        if a.get("col") == "turath" or not a.get("f"): continue
        if a["f"] not in grp: grp[a["f"]] = jl(os.path.join(D, "articles", a["f"] + ".json"), {}) or {}
        for i, pg in enumerate((grp[a["f"]].get(a["id"]) or {}).get("pages") or []):
            t = body(pg)
            if len(t) > 200: out.append(("d", a["id"], a.get("t", ""), AUTH.get(a.get("a"), ""), i + 1, t, nz(t)))
    tr = [b for b in CAT["books"] if b.get("col") == "turath" and not b.get("hidden")]
    pick = [b for b in tr if any(r in (b.get("setTitle") or b["title"]) for r in refs)]
    pick += sorted([b for b in tr if b.get("topicId") in topics and b not in pick and not (b.get("vol") or 0) > 3], key=lambda b: -(b.get("size") or 0))[:max(0, 30 - len(pick))]
    for b in pick[:60]:
        for i, pg in enumerate(pages_of(b["id"])):
            t = body(pg)
            if len(t) > 200: out.append(("m", b["id"], b.get("setTitle") or b["title"], AUTH.get(b.get("authorId"), ""), i + 1, t, nz(t)))
    print("  المواضع: %d (مراجع %d كتابًا)" % (len(out), len(pick[:60])), flush=True)
    return out


def find(C, m, boost=None):
    """أقوى المواضع للمسألة: العبارة الأخص أولًا، وتقارب ألفاظها؛ ١٠ من كلام المشايخ و٦ من المراجع، وموضعان على الأكثر من المصدر الواحد."""
    kws = [nz(x) for x in ([m["t"]] + (m.get("kw") or [])) if nz(x)]
    sc = []
    for r in C:
        n = r[6]; s = sum((3 if j <= 1 else 1) * min(3, n.count(w)) for j, w in enumerate(kws) if len(w) > 2)
        if s >= 3 and any(w in n for w in kws[:3]): sc.append((s + (4 if any(w in nz(r[2]) for w in kws[:3]) else 0) + (8 if boost and r[1] in boost else 0), r))  # عنوان المصدر بالمسألة أقوى
    sc.sort(key=lambda x: -x[0]); out, per, cnt = [], {}, {"d": 0, "m": 0}
    for s, r in sc:
        if per.get(r[1], 0) >= 2 or cnt[r[0]] >= (10 if r[0] == "d" else 6): continue
        per[r[1]] = per.get(r[1], 0) + 1; cnt[r[0]] += 1; out.append(r)
    return out


def window(r, m, w=1400):
    t, n = r[5], nz(r[5]); kw = next((nz(x) for x in (m.get("kw") or []) + [m["t"]] if nz(x) in n), "")
    k = n.find(kw) if kw else 0; k = int(k * len(t) / max(1, len(n)))
    a = max(0, k - w // 3); return ("…" if a else "") + t[a:a + w].strip()


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
    jw(tp, {"k": k, "n": e[1], "built": str(datetime.date.today()), "ok": 0, "b": tree})
    print("  ✓ مخطط %s: %d بابًا، %d مسألة" % (k, len(tree), sum(len(f["m"]) for b in tree for f in b["f"])))
    return True


# ---------- تحرير المسائل ----------
def build(e, n=20, ids=None, boost=None):
    k = e[0]; tp = os.path.join(OUT, k, "_tree.json"); tree = jl(tp)
    if not tree: print("  لا مخطط لـ", k, "— يُبنى أولًا"); plan(e); tree = jl(tp)
    if not tree: return 0
    todo = [(b, f, m) for b in tree["b"] for f in b["f"] for m in f["m"] if ((m["id"] in ids) if ids else (not m.get("e") and not m.get("skip")))][:n]
    if not todo: print("  اكتملت مسائل", k); return 0
    C = corpus(e); done = 0
    for b, f, m in todo:
        if time.time() - T0 > LIMIT: break
        hits = find(C, m, set(boost or []))
        if len([h for h in hits if h[0] == "d"]) < 1 and len(hits) < 3: m["skip"] = "قلة المواضع"; print("  ✗ قلة المواضع:", m["t"]); continue
        tags, ctx = {}, []
        for h in hits:
            tg = ("د" if h[0] == "d" else "م") + str(1 + sum(1 for x in tags.values() if x[0] == h[0]))
            tags[tg] = h; ctx.append("[%s] «%s» — %s، ص %d:\n%s" % (tg, h[2], h[3], h[4], window(h, m)))
        r = T.gemini(ENTRY.format(name=e[1], t=m["t"], bab=b["t"], fasl=f["t"], secs="، ".join(SECS), ctx="\n\n".join(ctx)))
        if not r: break  # نفدت الحصة
        if r.get("skip"): m["skip"] = "المواضع لا تتعلق بالمسألة"; continue
        used, secs = set(), []
        for s in r.get("s") or []:
            ps = []
            for p in s.get("p") or []:
                c = [x for x in (p.get("c") or []) if x in tags]
                if p.get("t") and c: ps.append({"t": p["t"].strip(), "c": c}); used.update(c)
            if ps: secs.append({"h": (s.get("h") or "").strip(), "p": ps})
        qs = []
        for q in r.get("q") or []:
            c = q.get("c"); t = (q.get("t") or "").strip(" «»\"")
            if c in tags and t and nz(t) in tags[c][6]: qs.append({"t": t, "c": c}); used.add(c)
        if not secs: m["skip"] = "لم تُعزَ الفقرات"; continue
        src = {tg: {"k": h[0], "b": h[1], "t": h[2], "a": h[3], "p": h[4]} for tg, h in tags.items() if tg in used}
        ent = {"id": m["id"], "t": m["t"], "bab": b["t"], "fasl": f["t"], "lead": r.get("lead", ""), "s": secs, "q": qs, "src": src,
               "see": [x for x in (r.get("see") or []) if isinstance(x, str)][:6], "built": str(datetime.date.today()), "ok": 0}
        ep = os.path.join(OUT, k, "e", m["id"] + ".json"); old = jl(ep)
        if old and (old.get("ok") or m.get("ok")):  # مادة معتمدة: التحديث مقترح بجوارها حتى تعتمده الإدارة، والمنشور باقٍ
            ent["new"] = sorted({h["b"] for h in src.values()} & set(boost or []))
            jw(os.path.join(OUT, k, "e", m["id"] + ".new.json"), ent); m["rev"] = 1; done += 1; print("  ↻ تحديث مقترح:", m["t"], flush=True)
            jw(tp, tree); continue
        jw(ep, ent)
        m["e"] = 1; m.pop("skip", None); done += 1; print("  ✓", m["t"], "— مواضع", len(src), flush=True)
        jw(tp, tree)
    jw(tp, tree); return done


# ---------- النمو التلقائي (طلب المدير، ٢١ نوفمبر ٢٠٢٦) ----------
def dawah_sources():
    """معرّفات مصادر مشايخ الدعوة الحالية: كتبهم وشروحهم وتفريغاتهم (الفهرس، col=dawah)، ومقالاتهم وفتاواهم (فهرس المقالات غير التراثية)."""
    ids = {b["id"] for b in CAT["books"] if (b.get("col") or "dawah") == "dawah" and not b.get("hidden")}
    ids |= {a["id"] for a in (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", []) if a.get("col") != "turath" and a.get("f")}
    return ids


def new_corpus(ids):
    out, ix = [], {a["id"]: a for a in (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", []) if a["id"] in ids}
    for bid in ids:
        b = BOOKS.get(bid)
        if b:
            for i, pg in enumerate(pages_of(bid)):
                t = body(pg)
                if len(t) > 200: out.append(("d", bid, b.get("setTitle") or b["title"], AUTH.get(b.get("authorId"), ""), i + 1, t, nz(t)))
    grp = {}
    for a in ix.values():
        if a["f"] not in grp: grp[a["f"]] = jl(os.path.join(D, "articles", a["f"] + ".json"), {}) or {}
        for i, pg in enumerate((grp[a["f"]].get(a["id"]) or {}).get("pages") or []):
            t = body(pg)
            if len(t) > 200: out.append(("d", a["id"], a.get("t", ""), AUTH.get(a.get("a"), ""), i + 1, t, nz(t)))
    return out


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
    jw(qp, Q)


def grow(cap=25):
    """ما أُضيف من كتب مشايخ الدعوة ومقالاتهم وشروحهم منذ آخر جولة: تُطابَق نصوصه بمسائل المخططات كلها، فالمسألة التي يتعلق بها
    تُوضع في طابور التحرير مع تقديم المصدر الجديد (boost): غير المحررة تُحرَّر، والمتروكة لقلة مواضعها يُعاد النظر فيها، والمحررة تُعاد
    كتابتها بالمصدر الجديد، والمعتمدة يُقترح تحديثها بجوارها (e/<id>.new.json) حتى تعتمده الإدارة. الحالة: data/mawsua/_seen.json."""
    ensure()
    sp = os.path.join(OUT, "_seen.json"); seen = jl(sp); now = dawah_sources()
    if seen is None: jw(sp, {"at": str(datetime.date.today()), "ids": sorted(now)}); print("  النمو: بُدئت الحالة بـ%d مصدرًا" % len(now)); return
    new = sorted(now - set(seen.get("ids") or []))
    if not new: print("  النمو: لا مصادر جديدة"); return
    C = new_corpus(set(new)); print("  النمو: %d مصدرًا جديدًا (%d موضعًا)" % (len(new), len(C)), flush=True)
    qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}; added = 0
    for e in ENC:
        tp = os.path.join(OUT, e[0], "_tree.json"); tree = jl(tp)
        if not tree: continue
        hit, boost = [], set()
        for b in tree["b"]:
            for f in b["f"]:
                for m in f["m"]:
                    H = find(C, m)
                    if not H: continue
                    hit.append((sum(1 for _ in H), m)); boost |= {h[1] for h in H}
        hit.sort(key=lambda x: -x[0]); ids = []
        for _, m in hit[:cap]:
            m.pop("skip", None); ids.append(m["id"])
        if ids:
            jw(tp, tree); Q["items"].append({"k": e[0], "do": "build", "n": len(ids), "ids": ids, "boost": sorted(boost), "grow": str(datetime.date.today())}); added += len(ids)
            print("  %s: %d مسألة تتعلق بالجديد" % (e[0], len(ids)))
    jw(qp, Q); jw(sp, {"at": str(datetime.date.today()), "ids": sorted(now)})
    print("  النمو: %d مسألة في الطابور" % added)


def index():
    items = []
    for e in ENC:
        t = jl(os.path.join(OUT, e[0], "_tree.json"), {}) or {}; ms = [m for b in t.get("b", []) for f in b["f"] for m in f["m"]]
        items.append({"k": e[0], "n": e[1], "d": e[2], "ic": e[3], "bab": len(t.get("b", [])), "m": len(ms), "e": sum(1 for m in ms if m.get("e")), "ok": sum(1 for m in ms if m.get("ok"))})
    jw(os.path.join(OUT, "_index.json"), {"note": "tools/mawsua.py — الموسوعات العلمية المتخصصة", "secs": SECS, "items": items})


def main():
    a = sys.argv[1:]; E = {e[0]: e for e in ENC}
    if a and a[0] == "grow": grow(); index(); return
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
            else:
                n = int(it.get("n") or 20); d = build(e, n, it.get("ids"), it.get("boost"))
                if it.get("ids"):
                    if not d: rest.append(it)
                elif d < n and any(not m.get("e") and not m.get("skip") for b in jl(os.path.join(OUT, e[0], "_tree.json"))["b"] for f in b["f"] for m in f["m"]): rest.append(dict(it, n=n - d))  # ما بقي (أو كله إن نفدت الحصة) إلى الجولة القادمة
        jw(qp, {"items": rest})
    index()


if __name__ == "__main__":
    main()
