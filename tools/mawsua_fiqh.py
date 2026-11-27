"""منهج الموسوعة الفقهية المقارنة (طلب المدير، ٢٧ نوفمبر ٢٠٢٦) — يستدعيه tools/mawsua.py لموسوعة الفقه.

ما يضيفه على التحرير العام:
- سجل مصادر بمساراتها (data/mawsua/_fiqh.json): المذهبي (بمذهب كل كتاب ودوره: معتمد المذهب، الأمهات ونص الإمام، كتاب مذهبي
  يحكي الخلاف ولمؤلفه اختيارات)، والمقارن واختيارات المحققين، وشروح السنة؛ ومشايخ الدعوة: فتاوى صوت السلف (الشيخ ياسر برهامي) أولًا،
  ثم كتبه وشروحه، ثم سائر المشايخ.
- استرجاع موضعي من المطولات (refs_hits): مرور واحد على مجلدات السجل، وتحديد «الكتاب» الفقهي من فهرس كل مجلد (كتاب الصيام…)،
  ثم ترجيح الصفحات بعناوين الأبواب والفصول وألفاظ المسألة؛ فيُستحضر من كل مذهب كتبه، ومن المقارن والشروح أوثقها صلة.
- هيكل المسألة التسعي (fq): التصوير وتحرير محل النزاع، الحكم الإجمالي، أقوال الفقهاء بمذاهبها ودرجة النسبة، الخلاف داخل المذهب،
  الأدلة، وجه الاستدلال والمناقشة، سبب الخلاف، الترجيح بنصه، اختيارات مشايخ الدعوة بنوع الدلالة وتاريخها، والمراجع والتوسعات.
- ضبط النسبة بالكود لا بالتعليمات وحدها (validate): نسبة القول إلى مذهب تُوزن بمصدرها (٢ معتمد المذهب، ١ كتاب مذهبي، ٠ منقول عن
  غيره)، والترجيح لا يُقبل إلا بنصه الحرفي في موضعه، واختيار الشيخ «صريح/ظاهر» لا يُقبل إلا بنصه وإلا صار «عرضًا»، والعالم المسمى
  لا يبقى إلا إن كان مؤلف المصدر المعزو إليه أو ورد اسمه فيه، و«النقل» الحرفي يُتحقق منه وإلا صار «تلخيصًا»، و«الجمهور» يُنبَّه عليه
  إن لم تثبت في المادة مذاهب ثلاثة فأكثر من كتبها؛ وكل ما سقط يُذكر في «ما تعذر التحقق من نسبته».
- التحديث المحافظ (changes): تحديث مادة منشورة يُكتب مقترحًا بجوارها بسجل ما أُضيف وما تغير وسببه، ويبقى تاريخها التحريري (hist).
"""
import datetime, os, re, time

KUTUB = [  # (المفتاح، العنوان، ألفاظ عناوين «الكتاب» في فهارس كتب الفقه والشروح)
    ("tahara", "كتاب الطهارة", ["الطهارة", "الوضوء", "المياه", "الغسل", "التيمم", "الحيض", "الآنية", "النجاسات", "الطهارة من الحدث", "المسح على الخفين"]),
    ("salat", "كتاب الصلاة", ["الصلاة", "صلاة", "الأذان", "مواقيت الصلاة", "الجمعة", "العيدين", "الكسوف", "الاستسقاء", "الوتر", "التهجد", "التطوع", "الجماعة", "الإمامة", "تقصير الصلاة", "سجود السهو", "الخوف", "السهو"]),
    ("janaiz", "كتاب الجنائز", ["الجنائز", "الجنازة"]),
    ("zakat", "كتاب الزكاة", ["الزكاة", "الصدقات", "زكاة الفطر", "قسم الصدقات", "الخمس"]),
    ("siyam", "كتاب الصيام والاعتكاف", ["الصيام", "الصوم", "الاعتكاف", "فضل ليلة القدر"]),
    ("hajj", "كتاب الحج والعمرة", ["الحج", "المناسك", "العمرة", "المحصر", "جزاء الصيد", "الإحصار", "الهدي"]),
    ("udhiya", "كتاب الأضاحي والعقيقة", ["الأضاحي", "الأضحية", "الضحايا", "العقيقة"]),
    ("atima", "كتاب الأطعمة والذبائح والصيد", ["الأطعمة", "الذبائح", "الصيد والذبائح", "الصيد", "الذكاة", "الأشربة"]),
    ("ayman", "كتاب الأيمان والنذور", ["الأيمان والنذور", "النذور", "النذر", "الكفارات", "كفارات الأيمان"]),
    ("jihad", "كتاب الجهاد والسير", ["الجهاد", "السير", "الجزية", "فرض الخمس", "الغنيمة", "الأمان", "الهدنة", "الموادعة"]),
    ("buyu", "كتاب البيوع والمعاملات", ["البيوع", "البيع", "السلم", "الربا", "الصرف", "القرض", "الرهن", "الحوالة", "الضمان", "الكفالة", "الصلح", "الحجر", "الوكالة", "الشركة", "المضاربة", "القراض", "المساقاة", "المزارعة", "الإجارة", "الإجارات", "الجعالة", "الشفعة", "الوديعة", "العارية", "الغصب", "إحياء الموات", "اللقطة", "الخيار", "المساقاة والمزارعة"]),
    ("waqf", "كتاب الوقف والهبة والوصايا", ["الوقف", "الأحباس", "الهبة", "الهبات", "العطية", "الوصايا", "الوصية"]),
    ("faraid", "كتاب الفرائض", ["الفرائض", "المواريث", "الميراث"]),
    ("nikah", "كتاب النكاح", ["النكاح", "الصداق", "الوليمة", "عشرة النساء", "القسم بين الزوجات"]),
    ("talaq", "كتاب الطلاق وتوابعه", ["الطلاق", "الخلع", "الرجعة", "الإيلاء", "الظهار", "اللعان", "العدد", "العدة", "الاستبراء", "الرضاع", "النفقات", "النفقة", "الحضانة"]),
    ("jinayat", "كتاب الجنايات والديات", ["الجنايات", "الجراح", "القصاص", "الديات", "الدية", "القسامة", "المحاربين"]),
    ("hudud", "كتاب الحدود والتعزير", ["الحدود", "الحد", "الزنا", "القذف", "السرقة", "الحرابة", "قطاع الطريق", "حد الخمر", "التعزير", "المرتد", "الردة", "البغاة", "استتابة المرتدين"]),
    ("qada", "كتاب القضاء والشهادات", ["القضاء", "الأقضية", "أدب القاضي", "الشهادات", "الدعاوى", "الدعوى والبينات", "الإقرار"]),
]
KNAME = {k: t for k, t, _ in KUTUB}
MDH = {"ha": "الحنفية", "ma": "المالكية", "sh": "الشافعية", "hb": "الحنابلة", "zh": "الظاهرية"}
ROLE = {"mu": "معتمد المذهب", "um": "أمهات المذهب ونص الإمام", "mq": "كتاب مذهبي يحكي الخلاف واختيار مؤلفه", "cm": "كتاب مقارن جامع",
        "ik": "اختيارات المحققين", "sh": "شرح", "asl": "أصل معتمد في الفن", "mt": "متن معتمد", "rd": "ردود ومناقشة للمخالف", "lg": "معجم ولغة", "ms": "كتابة معاصرة موثوقة"}
TRK = {"dawah": "مشايخ الدعوة السلفية", "madh": "الفقه المذهبي", "muq": "الفقه المقارن", "sharh": "شروح السنة",
       "asl": "المصادر الأصلية المعتمدة", "tahqiq": "كتب المحققين", "sanad": "مصادر مساندة"}
LVL = {"معتمد", "مشهور", "رواية", "وجه", "قول الإمام", "اختيار", "قول"}
TY = {"نقل", "تلخيص", "تحرير"}
DK = {"صريح", "ظاهر", "عرض"}
ADL = {"قرآن", "سنة", "أثر", "إجماع", "قياس", "قاعدة", "لغة", "مصلحة", "استصحاب", "عرف"}
SECS3 = ["تصوير المسألة وتحرير محل النزاع", "حكم المسألة إجمالًا", "أقوال الفقهاء", "الأدلة", "وجه الاستدلال والمناقشة", "سبب الخلاف",
         "الترجيح", "اختيارات مشايخ الدعوة السلفية", "المراجع والتوسعات"]
ALIAS = {"ابن تيمية": ["ابن تيمية", "تقي الدين", "شيخ الإسلام", "أبو العباس"], "ابن القيم": ["ابن القيم", "ابن قيم الجوزية"],
         "ابن قدامة": ["ابن قدامة", "الموفق", "موفق الدين", "صاحب المغني"], "النووي": ["النووي", "محيي الدين"],
         "ابن حجر": ["ابن حجر", "الحافظ"], "الشوكاني": ["الشوكاني"], "الصنعاني": ["الصنعاني"], "ابن رشد": ["ابن رشد"]}

M = None  # tools/mawsua.py نفسه (يُمرَّر عند الاستدعاء لتفادي الاستيراد الدائري)
_REG = [None]


def init(mod):
    global M
    M = mod


def today(): return str(datetime.date.today())


def wrx(pats):
    """مطابقة ألفاظ كاملة بعد التطبيع (فلا تطابق «الحج» كلمةَ «الحجر»)."""
    ps = sorted({M.nz(p) for p in pats if M.nz(p)}, key=len, reverse=True)
    return re.compile(r"(?:^| )(?:ال)?(?:%s)(?= |$)" % "|".join(re.escape(re.sub(r"^ال", "", p)) for p in ps)) if ps else None


_KRX = []


def krx():
    if not _KRX: _KRX.extend((k, wrx(p)) for k, _, p in KUTUB)
    return _KRX


def kitab_of(title):
    """مفتاح «الكتاب» الفقهي من عنوان: «كتاب الصوم» ← siyam؛ وما ليس من أبواب الفقه (كتاب العلم، التفسير…) ← None."""
    n = M.nz(re.sub(r"^[\[\(\s\-:]*(?:قوله\s+)?", "", title or ""))
    n = re.sub(r"^كتاب ", "", n)
    for k, rx in krx():
        if rx and rx.search(" " + n[:60]): return k
    return None


def keys_of(*titles):
    """مفاتيح الكتب الفقهية التي يتناولها عنوان باب أو فصل في المخطط (قد يكون أكثر من واحد: «الجنايات والجهاد»)."""
    out = []
    for t in titles:
        n = " " + M.nz(re.sub(r"^\s*كتاب\s+", "", t or "")) + " "
        for k, rx in krx():
            if rx and rx.search(n) and k not in out: out.append(k)
        if out: return out  # الفصل أخص من الباب
    return out


# ---------- السجل ----------
def feed(k):
    """data/mawsua/_feed.json (tools/mawsua_feed.py، بلا Gemini): primary المراجع الأولى للموسوعة من مكتبة الدعوة (كتب السياسة الشرعية
    للشيخ ياسر برهامي وغيره)، وnew الكتب الجديدة المتصلة بالموسوعة؛ تقرؤه مراحل التحرير (التسليم من جلسة التغذية، ٢٧ نوفمبر)."""
    return ((M.jl(os.path.join(M.OUT, "_feed.json"), {}) or {}).get("enc") or {}).get(k) or {}


def feed_refs(k, by, meta):
    """الكتب الجديدة من غير مكتبة الدعوة (enc[k].new) تُضم مراجعَ مساندة للموسوعة، فتدخل الاسترجاع والنمو تلقائيًّا."""
    ids = set(feed(k).get("new") or [])
    for b in M.CAT["books"]:
        if b["id"] in ids and b["id"] not in by and (b.get("col") or "dawah") != "dawah" and not b.get("hidden") and M.ready(b) and (b.get("size") or 0) >= 3000:
            by[b["id"]] = dict(meta, t=b.get("setTitle") or b["title"], title=b.get("setTitle") or b["title"], author=M.AUTH.get(b.get("authorId"), ""), vol=b.get("vol") or 0, feed=1)
    return by


_OPN = [None]


def opinion_ok(name):
    """أصحاب الآراء والترجيحات المعتمدون (opinion_authors في _sources.json، قائمة المستخدم ٢٣ اسمًا): من سواهم مصدر معلومات لا ترجيح."""
    if _OPN[0] is None: _OPN[0] = [M._ntok(n) for n in (M.POL.get("opinion_authors") or M.POL.get("authors") or [])]
    if not _OPN[0]: return True
    t = M._ntok(name)
    for w in _OPN[0]:
        i = 0
        for x in t:
            if i < len(w) and x == w[i]: i += 1
        if w and i == len(w): return True
    return False


def registry():
    """{معرّف الكتاب: بيان المرجع} من data/mawsua/_fiqh.json: كل مجلدات الكتاب، بعد جاهزية نصه؛ ويُتجاوز مجلد الفهرس الصغير."""
    if _REG[0] is not None: return _REG[0]
    R = M.jl(os.path.join(M.OUT, "_fiqh.json"), {}) or {}
    by = {}
    for b in M.CAT["books"]:
        if b.get("hidden") or b.get("demo") or (b.get("col") or "dawah") == "dawah": continue
        if (b.get("size") or 0) < 3000: continue
        t = b.get("setTitle") or b["title"]; an = M.AUTH.get(b.get("authorId"), "")
        for r in R.get("refs") or []:
            if r["t"] in t and (not r.get("a") or r["a"] in an):
                if M.ready(b): by[b["id"]] = dict(r, title=t, author=an, vol=b.get("vol") or 0)
                break
    feed_refs("fiqh", by, {"m": "0", "r": "cm", "tr": "muq"})
    _REG[0] = (R, by); return _REG[0]


def policy():
    R, by = registry()
    sets = {}
    for bid, r in by.items(): sets.setdefault(r["t"], r)
    have = [{"t": r["title"], "a": r["author"], "m": r.get("m"), "r": r.get("r"), "tr": r.get("tr")} for r in sets.values()]
    return {"tracks": R.get("tracks") or [], "have": have, "want": R.get("want") or [], "lead": (R.get("dawah") or {}).get("lead", "")}


# ---------- الاسترجاع الموضعي من المطولات ----------
SYN = [("صيام", "صوم"), ("الصيام", "الصوم"), ("صلاه", "صلوات"), ("المناسك", "الحج"), ("الزكاه", "الصدقه"), ("النكاح", "التزويج"), ("البيع", "البيوع")]
STOP = set("حكم احكام في من على عن الى او و ما بين مع عند اذا التي الذي فيه فيها به بها وما ذلك هذه هذا المساله مسائل مساله صفه انواع شروط حقيقه معني تعريف"
           " الواجب والمستحب المستحب الواجب وحكمها واحكامها واحكامه وحكمه وشروطه وشروطها".split())


def _kws(m):
    """ألفاظ المسألة بتطبيعها ومرادفاتها الفقهية الشائعة (الصيام/الصوم…)، أخصها أولًا."""
    L = []
    for x in [m["t"]] + (m.get("kw") or []):
        w = M.nz(x)
        if len(w) <= 2: continue
        L.append(w)
        for a, b in SYN:
            if a in w.split(): L.append(" ".join(b if t == a else t for t in w.split()))
            elif b in w.split(): L.append(" ".join(a if t == b else t for t in w.split()))
    return list(dict.fromkeys(L))


def _core(m):
    """الألفاظ الدالة في عنوان المسألة وألفاظها (بلا أدوات ولا «أحكام/حكم»)، للمطابقة داخل الكتاب الفقهي المحدد من الفهرس."""
    ws = []
    for x in [m["t"]] + (m.get("kw") or []):
        for t in M.nz(x).split():
            t2 = re.sub(r"^(?:و|ف|ب|ل)?ال(?=...)", "", t)
            if len(t2) >= 3 and t not in STOP and t2 not in STOP: ws.append(t2)
    return list(dict.fromkeys(ws))[:10]


def _score(kws, n, core=None):
    s = sum((3 if j <= 1 else 1) * min(3, n.count(w)) for j, w in enumerate(kws))
    if s >= 3 and any(w in n for w in kws[:3]): return s
    if core:  # لا عبارة تامة: يكفي اجتماع أكثر الألفاظ الدالة في الصفحة (داخل الكتاب الفقهي المحدد من فهرس المرجع)
        ov = sum(1 for w in core if w in n)
        if ov >= min(4, max(2, (len(core) + 1) // 2)): return ov + s
    return 0


KH = re.compile(r"^[\[\(\s\-:]*(?:قوله\s+)?كتاب\s")


def refs_hits(todo, per_set=3, boost=None):
    """مرور واحد على مجلدات السجل كلها لمسائل الجولة: {معرّف المسألة: [موضع…]}.
    الموضع: ("m", الكتاب، العنوان، المؤلف، الصفحة، النص، المطبع، الصنف، بيانه {m,r,tr,vol,sec}).
    الصفحة تُرشَّح إن وقعت في «كتاب» فقهي من كتب المسألة بحسب فهرس المجلد، أو وافق عنوان بابها ألفاظ المسألة."""
    R, by = registry()
    need = {}  # مفتاح الكتاب الفقهي ← [(المسألة، ألفاظها)]
    loose = []
    for b, f, m in todo:
        ks = keys_of(f["t"], b["t"]) or keys_of(m["t"])
        item = (m, _kws(m), _core(m))
        if ks: [need.setdefault(k, []).append(item) for k in ks]
        else: loose.append(item)
    out = {m["id"]: {} for _, _, m in todo}
    sets = {}
    for bid, r in by.items(): sets.setdefault(r["t"], []).append(bid)
    t0 = time.time(); np_ = 0
    for st, ids in sets.items():
        cur = None
        for bid in sorted(ids, key=lambda x: (by[x]["vol"], x)):
            doc = None
            for p_ in (os.path.join(M.D, "books", bid + ".json"), os.path.join(M.ROOT, "vols", bid + ".json")):
                if os.path.exists(p_):
                    try: doc = M.jl(p_)
                    except Exception: doc = None
                    break
            if not doc: continue
            pages = doc.get("pages") or []
            toc = sorted([(int(x.get("p") or 1), (x.get("t") or "").strip()) for x in doc.get("toc") or [] if x.get("t")], key=lambda x: x[0])
            ti, sec, kit = 0, "", cur
            r = by[bid]
            for i, pg in enumerate(pages):
                while ti < len(toc) and toc[ti][0] <= i + 1:
                    sec = toc[ti][1]
                    if KH.match(sec): kit = kitab_of(sec)  # «كتاب …» يبدأ نطاقًا جديدًا (وما ليس من أبواب الفقه نطاقه None)
                    ti += 1
                cand = (need.get(kit) or []) + loose if kit else loose
                if not cand: continue
                t = M.body(pg)
                if len(t) < 200: continue
                n = M.nz(t); ns = M.nz(sec); np_ += 1
                for m, kws, core in cand:
                    s = _score(kws, n, core if kit else None)
                    if not s: continue
                    if any(w in ns for w in kws[:4]) or sum(1 for w in core if w in ns) >= 2: s += 6  # عنوان الباب أو الفصل في فهرس الكتاب يوافق المسألة
                    if kit is None: s -= 2
                    if boost and bid in boost: s += 8
                    L = out[m["id"]].setdefault(st, [])
                    L.append((s, ("m", bid, r["title"], r["author"], i + 1, t, n, "m", {"m": r.get("m"), "r": r.get("r"), "tr": r.get("tr"), "vol": r["vol"], "sec": sec[:80]})))
                    if len(L) > 12: L.sort(key=lambda x: -x[0]); del L[per_set * 2:]
            cur = kit
            doc = None
    print("  المراجع الفقهية: %d كتابًا، %d صفحة فُحصت (%.0f ث)" % (len(sets), np_, time.time() - t0), flush=True)
    res = {}
    for mid, d in out.items():
        L = []
        for st, hs in d.items():
            hs.sort(key=lambda x: -x[0]); got = []
            for s, h in hs:
                if any(abs(h[4] - g[1][4]) <= 1 and h[1] == g[1][1] for g in got): continue  # لا صفحتين متجاورتين من الموضع نفسه
                got.append((s, h))
                if len(got) >= per_set: break
            L += got
        res[mid] = L
    return res


def ref_corpus(ids, by=None):
    """مواضع مجلدات المراجع المعطاة (للنمو بما يُضاف منها) بصيغة المواضع مع بيانها في الحقل التاسع؛ by: سجل موسوعة غير الفقه."""
    by = by if by is not None else registry()[1]; out = []
    for bid in ids:
        r = by.get(bid)
        if not r: continue
        for i, pg in enumerate(M.pages_of(bid)):
            t = M.body(pg)
            if len(t) > 200: out.append(("m", bid, r["title"], r["author"], i + 1, t, M.nz(t), "m", {"m": r.get("m"), "r": r.get("r"), "tr": r.get("tr"), "vol": r["vol"], "sec": ""}))
    return out


def pick_refs(scored, cap=18):
    """توزيع المواضع على المسارات: لكل مذهب من الأربعة موضعان (المعتمد أولًا)، والمقارن خمسة، والشروح خمسة؛ وموضعان من الكتاب الواحد."""
    sc = sorted(scored, key=lambda x: -x[0]); out, per, n_tr, n_m = [], {}, {}, {}
    rank = {"mu": 3, "um": 2, "mq": 2, "cm": 1, "ik": 1, "sh": 0}
    for mdh in ("ha", "ma", "sh", "hb"):  # المسار المذهبي: أعلى كل مذهب درجةً ثم دورًا
        L = sorted([x for x in sc if x[1][8]["tr"] == "madh" and x[1][8]["m"] == mdh], key=lambda x: (-rank.get(x[1][8]["r"], 0), -x[0]))
        for s, h in L:
            if n_m.get(mdh, 0) >= 2 or per.get(h[2], 0) >= 2: continue
            out.append(h); per[h[2]] = per.get(h[2], 0) + 1; n_m[mdh] = n_m.get(mdh, 0) + 1
    cap_tr = {"madh": 10, "muq": 5, "sharh": 5}
    for tr in ("muq", "sharh", "madh"):
        for s, h in sc:
            if h in out or h[8]["tr"] != tr: continue
            if n_tr.get(tr, 0) >= cap_tr[tr] - (len([x for x in out if x[8]["tr"] == tr]) if tr == "madh" else 0) or per.get(h[2], 0) >= 2: continue
            out.append(h); per[h[2]] = per.get(h[2], 0) + 1; n_tr[tr] = n_tr.get(tr, 0) + 1
    return out[:cap], [h for s, h in sc if h not in out][:20]


# ---------- مصادر مشايخ الدعوة للمسألة الفقهية ----------
FIQH_CAT = re.compile(r"^أسئلة (?:العبادات|المعاملات|الزواج|الأطعمة|الأيمان)|أسئلة الأيمان والنذور|› (?:الصلاة|الزكاة|الصيام|الحج|الطهارة|الربا|البيوع|المواريث|الإجار|الأضاحي|التأمين|الشركة|الهبات)")


def art_meta():
    return {a["id"]: a for a, _ in M.art_items()}


_FK = {}


def fatwa_kitab(c):
    """الكتاب الفقهي لتصنيف الفتوى في صوت السلف («أسئلة العبادات › من فقه الواقع › الصيام والاعتكاف» ← siyam)."""
    if c not in _FK: _FK[c] = set(keys_of((c or "").split("›")[-1]))
    return _FK[c]


def dawah_pick(DC, m, boost=None, AM=None, ks=None, cat_rx=None):
    """فتاوى صوت السلف أولًا (عنوان الفتوى سؤال المسألة غالبًا)، ثم كتب الشيخ ياسر برهامي وشروحه، ثم سائر كتب المشايخ، ثم المقالات."""
    R, _ = registry(); P = R.get("dawah") or {}; lead = M.nz(P.get("lead", "ياسر برهامي"))
    caps = {"f": int(P.get("fatwa_cap") or 8), "lead": int(P.get("lead_book_cap") or 4), "b": int(P.get("other_cap") or 3), "o": 2, "s": 2, "a": int(P.get("article_cap") or 2)}
    kws = _kws(m); core = _core(m); AM = AM or {}; sc = []; ks = set(ks or [])
    for r in DC:
        same = False
        if r[7] == "f" and ks: same = bool(fatwa_kitab((AM.get(r[1]) or {}).get("c") or "") & ks)
        elif r[7] == "f" and cat_rx is not None: same = bool(cat_rx.search((AM.get(r[1]) or {}).get("c") or ""))
        s = _score(kws, r[6], core if same else None)  # الفتوى في تصنيف كتاب المسألة: يكفي اجتماع ألفاظها الدالة
        if not s: continue
        ttl = M.nz(r[2])
        if any(w in ttl for w in kws[:4]) or sum(1 for w in core if w in ttl) >= 2: s += 6
        if r[7] == "f" and cat_rx is not None:  # غير الفقه: الفتوى مقدمة إن كانت من تصنيف الموسوعة في صوت السلف، ومؤخرة إن لم تكن
            s += 7 if same else -4
        elif r[7] == "f":
            s += 6 + (4 if same else (-2 if ks else 0)); c = (AM.get(r[1]) or {}).get("c") or ""
            s += 3 if FIQH_CAT.search(c) else (-3 if re.search(r"العقيدة|المنهج", c) else 0)
        if lead and lead in M.nz(r[3]): s += 4
        if boost and r[1] in boost: s += 8
        sc.append((s, r))
    sc.sort(key=lambda x: -x[0]); out, per, kc = [], {}, {}
    for s, r in sc:
        g = "lead" if r[7] in ("b", "o") and lead and lead in M.nz(r[3]) else r[7]
        if per.get(r[1], 0) >= 2 or kc.get(g, 0) >= caps.get(g, 2) or len(out) >= 14: continue
        per[r[1]] = per.get(r[1], 0) + 1; kc[g] = kc.get(g, 0) + 1; out.append(r)
    return out


# ---------- التحرير ----------
FIQH_ENTRY = """أنت محرر فقهي محقق في «موسوعة الفقه» المقارن، تحرر مادة علمية موسعة مترابطة لمسألة: «{t}» (من «{bab}» › «{fasl}»).
المواضع المرسلة من أربعة مسارات، وفي رأس كل موضع مساره ومذهبه ودوره:
١) مشايخ الدعوة السلفية [د…]: فتاوى صوت السلف (أكثرها للشيخ ياسر برهامي، بتاريخها)، ثم كتبه وشروحه، ثم كتب سائر المشايخ — وهي المعتمد الأول في الترجيح.
٢) الفقه المذهبي [م…]: «معتمد المذهب» (يُثبت به المعتمد)، و«أمهات المذهب ونص الإمام»، و«كتاب مذهبي يحكي الخلاف واختيار مؤلفه».
٣) الفقه المقارن واختيارات المحققين [م…]: كالمغني والمجموع وبداية المجتهد والمحلى ومجموع الفتاوى وإعلام الموقعين وزاد المعاد.
٤) شروح السنة [م…]: كفتح الباري وشرح النووي على مسلم وعون المعبود وتهذيب ابن القيم وتحفة الأحوذي وسبل السلام ونيل الأوطار.

المنهج الملزم:
- الاستيعاب: لا تكتفِ بأول موضع؛ اجمع من المسارات كلها ما يتصل بالمسألة، ورتبه وادمجه في سياق علمي متماسك. ولا تختصر اختصارًا مخلًّا: اذكر ما في المواضع من صور المسألة وشروطها وأركانها وواجباتها وسننها ومبطلاتها وفروعها ونوازلها حين تتعلق بها. والمطولات والأصول مقدمة على المختصرات.
- السياق: راعِ سياق كل موضع ومراده (تقرير، أو حكاية قول، أو رد على مخالف، أو سؤال المستفتي)، ولا تجتزئ قولًا بما يخل بمعناه أو يوهم خلاف مراد صاحبه. أسطر [المتن] في الشروح نص الكتاب المشروح لا كلام الشارح.
- النسبة إلى المذاهب: لا تنسب قولًا إلى مذهب إلا من موضع يحكيه، وفرّق بين قول صاحب المذهب والمعتمد عند أصحابه، وبين المعتمد والمشهور والرواية والوجه واختيار عالم بعينه. ولا تجعل اختيار عالم من علماء المذهب (كاختيارات ابن تيمية أو ابن قدامة أو النووي) هو المعتمد في المذهب كله، ولا تجعل ورود القول في كتاب مقارن دليلًا على أنه المعتمد. وإن كان في المذهب خلاف معتبر فاذكره في "dakhil"، ولا سيما إن كان القول الآخر أقوى دليلًا أو أقرب إلى قول الجمهور.
- الجمهور: لا تقل «الجمهور» إلا إن نصت عليه المواضع أو ثبتت فيها مذاهب أكثر الفقهاء.
- الترجيح: لا تخترع ترجيحًا ولا تنسبه إلى عالم لم يصرح به؛ ولكل ترجيح نصه الحرفي الدال عليه في "nass" منسوخًا بحروفه من موضعه.
- مشايخ الدعوة: اعرض ما ثبت من أقوالهم وترجيحاتهم والشيخ ياسر برهامي أولًا، بنوع الدلالة "kind": "صريح" (نص على اختياره) أو "ظاهر" (يدل عليه السياق دلالة واضحة) أو "عرض" (حكى الخلاف أو نقل قولًا بلا ترجيح) — ومجرد النقل أو العرض ليس ترجيحًا. وإن اختلف قول الشيخ في موضعين فبيّن ذلك بإنصاف في "dawah_diff" مع تاريخ كل منهما وسياقه، ولا تخترع توفيقًا غير ثابت.
- التوثيق: كل فقرة تُعزى إلى رموز مواضعها في "c"، وتُميَّز في "ty": "نقل" (نص حرفي من الموضع بلا تغيير)، أو "تلخيص" (معنى موضع واحد بعبارة أخرى)، أو "تحرير" (صياغة علمية جامعة بين المواضع). لا تصغ كلامًا من عندك ثم تنسبه إلى عالم، ولا تضف من خارج المواضع إلا آية بسورتها ورقمها.
- الأدلة: لكل قول أدلته من القرآن والسنة والآثار والإجماع والقياس والقواعد كما وردت في المواضع، مع تخريج الحديث ودرجته إن ذكرتهما المواضع فقط، ووجه الاستدلال بكل دليل، وما أُورد عليه من مناقشة وجوابها.
- ما تعذر التحقق من نسبته من المواضع اذكره في "nv" صراحة، ولا تقدمه على أنه ثابت.
- إن كانت المواضع لا تتعلق بالمسألة حقيقة فأخرج {"skip": true}.

الهيكل (مرن: اترك ما ليس له مادة، ولا تُسقط عنصرًا جوهريًّا له مادة). الفقرة: {"t": "النص", "c": ["م1"], "ty": "نقل|تلخيص|تحرير"}
{"lead": "تمهيد في سطرين",
 "tasw": [فقرات: تصوير المسألة وتحرير محل النزاع وصورها],
 "hukm": [فقرات: الحكم الإجمالي قبل التفصيل],
 "aqwal": [{"n": "القول الأول", "t": "نص القول", "c": ["م1"], "mdh": [{"m": "ha|ma|sh|hb", "lvl": "معتمد|مشهور|رواية|وجه|قول الإمام|اختيار", "c": ["م1"]}], "by": [{"who": "اسم العالم", "kind": "اختيار|ترجيح|قول", "c": ["م4"]}], "adl": [{"ty": "قرآن|سنة|أثر|إجماع|قياس|قاعدة", "t": "نص الدليل", "takh": "التخريج والدرجة إن وردا", "c": ["م2"]}], "wajh": [فقرات: وجه الاستدلال], "mun": [فقرات: المناقشة والجواب]}],
 "dakhil": [{"m": "hb", "t": "الخلاف داخل المذهب: المعتمد، والمشهور، والروايات والأوجه، واختيار عالم بعينه", "c": ["م3"]}],
 "sabab": [فقرات: سبب الخلاف — ثبوت الحديث أو دلالته أو الجمع بين النصوص أو القواعد الأصولية],
 "tarjih": [{"who": "من رجّح", "t": "مضمون الترجيح ومستنده", "nass": "نصه الحرفي الدال على الترجيح", "c": "م3"}],
 "dawah": [{"who": "اسم الشيخ", "kind": "صريح|ظاهر|عرض", "t": "قوله ومستنده", "nass": "نصه الحرفي", "c": "د1"}],
 "dawah_diff": {"t": "بيان اختلاف قول الشيخ بين موضعين وتاريخ كل منهما", "c": ["د1", "د4"]},
 "extra": [{"h": "عنوان مثل: شروطه، أركانه، سننه ومستحباته، مبطلاته، فروع ونوازل", "p": [فقرات]}],
 "q": [{"t": "اقتباس حرفي ١٠–٤٠ كلمة", "c": "د1"}],
 "see": ["عنوان مسألة ذات صلة"],
 "nv": ["ما تعذر التحقق من نسبته"]}

{cur}المواضع:
{ctx}"""


def _fmt_date(d): return (d or "")[:10]


def header(tg, h, AM):
    x = h[8] if len(h) > 8 else {}
    if h[0] == "d":
        a = AM.get(h[1]) or {}
        kind = M.KLBL.get(h[7], "كتاب")
        extra = (" — بتاريخ " + _fmt_date(a.get("d"))) if a.get("d") else ""
        return "[%s] (مشايخ الدعوة — %s — %s%s) «%s»، ص %d:" % (tg, kind, h[3], extra, h[2], h[4])
    tr = TRK.get(x.get("tr"), "مرجع"); md = MDH.get(x.get("m"), "")
    return "[%s] (%s%s — %s) «%s» — %s%s، ص %d%s:" % (tg, tr, (" — " + md) if md else "", ROLE.get(x.get("r"), ""), h[2], h[3],
                                                    ("، ج %d" % x["vol"]) if x.get("vol") else "", h[4], ("، باب: " + x["sec"]) if x.get("sec") else "")


def win(h, m):
    if h[0] == "d" and h[7] == "f": return M._mark_matn(h[5])[:2600]  # الفتوى بسؤالها وجوابها كاملين إلى حدٍّ: السياق قبل الاقتباس
    return M.window(h, m, 2000 if h[0] == "m" else 1600)


# ---------- التحقق من النسبة ----------
def _in(s, h):
    t = M.nz(s)
    return len(t) >= 12 and t in h[6]


def _names(n):
    n = re.sub(r"^\s*(?:الشيخ|الدكتور|الإمام|الحافظ|العلامة|شيخ الإسلام)\s+", "", n or "").strip()
    for k, al in ALIAS.items():
        if M.nz(k) in M.nz(n) or any(M.nz(a) == M.nz(n) for a in al): return al
    w = n.split()
    return [n] + ([w[-1]] if len(w) >= 2 and len(w[-1]) >= 4 else [])


def who_ok(who, hs):
    """العالم المسمى مؤلفُ المصدر المعزو إليه، أو ورد اسمه (أو لقبه المشهور) في نص موضعه."""
    if not who: return False
    al = [M.nz(a) for a in _names(who) if len(M.nz(a)) >= 3]
    return any(any(a in M.nz(h[3]) or (" " + a) in (" " + h[6]) for a in al) for h in hs)


def validate(r, tags, AM, fiqh=True):
    """المخرج المنضبط fq، وما سقط بسبب التحقق في nv."""
    nv = [x.strip() for x in (r.get("nv") or []) if isinstance(x, str) and x.strip()][:12]
    used = set()

    def cl(x):
        L = x if isinstance(x, list) else [x]
        return [g for g in L if isinstance(g, str) and g in tags]

    def kp(c):  # الأسماء المسموح بها في سياق الفقرة: مؤلفو مصادرها، ومن ورد اسمه أو لقبه المشهور في نصوصها
        hs = [tags[g] for g in c]  # أسماء مشايخ الدعوة لا تُذكر في سياق الكلام (قرار المستخدم ٢٧ نوفمبر): العزو بالمرجع
        return [h[3] for h in hs if h[0] != "d"] + [n for n in M.IMAMS if who_ok(n, hs)]

    def paras(L):
        out = []
        for p in L or []:
            if isinstance(p, str): p = {"t": p}
            if not isinstance(p, dict): continue
            c = cl(p.get("c")); t = (p.get("t") or "").strip()
            if not t or not c: continue
            ty = p.get("ty") if p.get("ty") in TY else "تحرير"
            if ty == "نقل" and not any(_in(t.strip(" «»\""), tags[g]) for g in c): ty = "تلخيص"
            out.append({"t": M.unname(t, [], keep=kp(c)), "c": c, "ty": ty}); used.update(c)
        return out

    def vlevel(mdh, c):
        best = 0
        for g in c:
            x = tags[g][8] if len(tags[g]) > 8 else {}
            if x.get("m") != mdh: continue
            if x.get("r") == "mu": best = 2
            elif x.get("r") in ("um", "mq", "cm"): best = max(best, 1)
        return best

    fq = {"tasw": paras(r.get("tasw")), "hukm": paras(r.get("hukm")), "sabab": paras(r.get("sabab"))}
    aq = []
    for i, a in enumerate(r.get("aqwal") or []):
        if not isinstance(a, dict): continue
        c = cl(a.get("c")); t = (a.get("t") or "").strip()
        if not t: continue
        md = []
        for x in a.get("mdh") or []:
            if not isinstance(x, dict) or x.get("m") not in MDH: continue
            xc = cl(x.get("c")) or c
            if not xc: nv.append("نسبة القول «%s» إلى %s بلا عزو" % (t[:60], MDH[x["m"]])); continue
            v = vlevel(x["m"], xc); lvl = x.get("lvl") if x.get("lvl") in LVL else "قول"
            md.append({"m": x["m"], "lvl": lvl, "v": v, "c": xc}); used.update(xc)
            if v == 0: nv.append("نسبة «%s» إلى %s منقولة عن مصدر غير مذهبي، ولم يُتحقق منها من كتب المذهب" % (t[:60], MDH[x["m"]]))
            elif lvl == "معتمد" and v < 2: nv.append("وُصف قول %s في «%s» بأنه المعتمد بحسب المصدر المعزو إليه، ولم يُعزَ إلى كتب المعتمد في المذهب" % (MDH[x["m"]], t[:60]))
        if not c and not md: nv.append("قول بلا عزو أُسقط: «%s»" % t[:80]); continue
        by = []
        for x in a.get("by") or []:
            if not isinstance(x, dict): continue
            xc = cl(x.get("c")) or c; w = (x.get("who") or "").strip()
            if w and xc and who_ok(w, [tags[g] for g in xc]): by.append({"who": w, "kind": x.get("kind") if x.get("kind") in ("اختيار", "ترجيح", "قول") else "قول", "c": xc}); used.update(xc)
            elif w: nv.append("لم يُتحقق من نسبة القول «%s» إلى %s من المواضع المعزو إليها" % (t[:50], w))
        adl = []
        for x in a.get("adl") or []:
            if not isinstance(x, dict): continue
            xc = cl(x.get("c")); dt = (x.get("t") or "").strip()
            if not dt or not xc: continue
            d = {"ty": x.get("ty") if x.get("ty") in ADL else "قاعدة", "t": dt, "c": xc}
            if d["ty"] in ("سنة", "أثر"):  # لفظ الحديث والأثر من موضعه، وإلا يُعرض معنًى لا لفظًا
                core = M.nz(re.sub(r"^.*?[«\"]|[»\"].*$", "", dt))[:80]
                if core and len(core) > 15 and not any(core[:40] in tags[g][6] for g in xc): d["nf"] = 1
            tk = (x.get("takh") or "").strip()
            if tk: d["takh"] = tk
            adl.append(d); used.update(xc)
        q = {"n": (a.get("n") or "القول %s" % M_ord(i + 1)).strip(), "t": M.unname(t, [], keep=kp(c) + [x["who"] for x in by]), "c": c, "mdh": md, "by": by, "adl": adl,
             "wajh": paras(a.get("wajh")), "mun": paras(a.get("mun"))}
        used.update(c); aq.append(q)
    fq["aqwal"] = aq
    dk = []
    for x in r.get("dakhil") or []:
        if not isinstance(x, dict) or not (x.get("t") or "").strip(): continue
        xc = cl(x.get("c"))
        if not xc: continue
        m_ = x.get("m") if x.get("m") in MDH else ""
        dk.append({"m": m_, "t": M.unname(x["t"].strip(), [], keep=kp(xc)), "c": xc, "v": vlevel(m_, xc) if m_ else 0}); used.update(xc)
    fq["dakhil"] = dk
    tj = []
    for x in r.get("tarjih") or []:
        if not isinstance(x, dict): continue
        xc = cl(x.get("c")); ns = (x.get("nass") or "").strip(" «»\""); w = (x.get("who") or "").strip(); t = (x.get("t") or "").strip()
        if not xc or not t: continue
        hs = [tags[g] for g in xc]
        if not ns or not any(_in(ns, h) for h in hs): nv.append("ترجيح لم يوجد نصه الدال عليه في موضعه فلم يُثبت: «%s»" % t[:80]); continue
        if w and not who_ok(w, hs): nv.append("لم يُتحقق من نسبة الترجيح إلى %s؛ فعُرض منسوبًا إلى مصدره" % w); w = ""
        if not w: w = hs[0][3]
        tj.append({"who": w, "t": M.unname(t, [], keep=[w] + [h[3] for h in hs]), "nass": ns, "c": xc}); used.update(xc)
    fq["tarjih"] = tj
    dw = []
    for x in r.get("dawah") or []:
        if not isinstance(x, dict): continue
        xc = [g for g in cl(x.get("c")) if g.startswith("د")]; t = (x.get("t") or "").strip()
        if not xc or not t: continue
        hs = [tags[g] for g in xc]; w = (x.get("who") or "").strip(); au = hs[0][3]
        if not w or not who_ok(w, hs): w = au
        ns = (x.get("nass") or "").strip(" «»\""); kd = x.get("kind") if x.get("kind") in DK else "عرض"
        if kd in ("صريح", "ظاهر") and not (ns and any(_in(ns, h) for h in hs)):
            nv.append("لم يوجد نص يدل على اختيار %s في الموضع المعزو إليه؛ فعُرض قوله عرضًا لا ترجيحًا" % w); kd = "عرض"; ns = ns if ns and any(_in(ns, h) for h in hs) else ""
        if kd != "عرض" and not opinion_ok(au):  # الترجيح والاختيار للمعتمدين وحدهم؛ وغيرهم مصدر معلومات
            nv.append("مصدر «%s» من غير قائمة المعتمدين للآراء والترجيحات؛ فعُرض معلومةً لا ترجيحًا" % hs[0][2][:60]); kd = "عرض"
        a = AM.get(hs[0][1]) or {}
        dw.append({"who": w, "kind": kd, "t": M.unname(t, [w, au]), "nass": ns, "c": xc, "d": _fmt_date(a.get("d")), "u": a.get("u") or "", "src": hs[0][2]}); used.update(xc)
    R, _ = registry(); lead = M.nz((R.get("dawah") or {}).get("lead", "ياسر برهامي"))
    dw.sort(key=lambda y: (0 if lead and lead in M.nz(y["who"]) else 1, {"صريح": 0, "ظاهر": 1, "عرض": 2}[y["kind"]], y.get("d") or "9999"))
    fq["dawah"] = dw
    df = r.get("dawah_diff")
    if isinstance(df, dict) and (df.get("t") or "").strip():
        xc = [g for g in cl(df.get("c")) if g.startswith("د")]
        if len(xc) >= 2: fq["dawah_diff"] = {"t": df["t"].strip(), "c": xc}; used.update(xc)
    ex = []
    for s in r.get("extra") or []:
        if isinstance(s, dict) and (s.get("h") or "").strip():
            ps = paras(s.get("p"))
            if ps: ex.append({"h": s["h"].strip(), "p": ps})
    fq["extra"] = ex
    # «الجمهور» بلا مذاهب ثابتة من كتبها
    vm = {x["m"] for a in aq for x in a["mdh"] if x["v"] >= 1}
    blob = " ".join(p["t"] for k in ("tasw", "hukm", "sabab") for p in fq[k]) + " ".join(a["t"] for a in aq)
    if fiqh and "جمهور" in blob and len(vm & {"ha", "ma", "sh", "hb"}) < 3:
        fq["jm"] = "نسبة القول إلى الجمهور منقولة عن المصادر المعزو إليها، ولم تثبت في هذه المادة مذاهب ثلاثة فأكثر من كتبها."
    fq["nv"] = list(dict.fromkeys(nv))[:20]
    return fq, used


def M_ord(n): return ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن"][n] if n < 9 else str(n)


def flatten(fq):
    """أقسام عامة (s) من الهيكل الفقهي: للنسخ والبحث والمِسبار والتصدير وما يقرأ المادة بالشكل العام."""
    S = []
    def sec(h, ps):
        ps = [p for p in ps if p.get("t") and p.get("c")]
        if ps: S.append({"h": h, "p": ps})
    sec(SECS3[0], fq.get("tasw") or []); sec(SECS3[1], fq.get("hukm") or [])
    ql = []
    for a in fq.get("aqwal") or []:
        md = "، ".join("%s (%s)" % (MDH[x["m"]], x["lvl"]) for x in a["mdh"])
        by = "، ".join("%s %s" % (x["kind"], x["who"]) for x in a["by"])
        ql.append({"t": "%s: %s%s%s" % (a["n"], a["t"], (" — " + md) if md else "", ("؛ وهو " + by) if by else ""), "c": sorted(set(a["c"] + [g for x in a["mdh"] for g in x["c"]]))})
    for x in fq.get("dakhil") or []: ql.append({"t": "الخلاف داخل مذهب %s: %s" % (MDH.get(x["m"], ""), x["t"]) if x["m"] else x["t"], "c": x["c"]})
    sec(SECS3[2], ql)
    sec(SECS3[3], [{"t": "%s — %s: %s%s" % (a["n"], d["ty"], d["t"], (" (" + d["takh"] + ")") if d.get("takh") else ""), "c": d["c"]} for a in fq.get("aqwal") or [] for d in a["adl"]])
    sec(SECS3[4], [dict(p, t=a["n"] + ": " + p["t"]) for a in fq.get("aqwal") or [] for p in a["wajh"] + a["mun"]])
    sec(SECS3[5], fq.get("sabab") or [])
    sec(SECS3[6], [{"t": "رجّح %s: %s — «%s»" % (x["who"], x["t"], x["nass"]), "c": x["c"]} for x in fq.get("tarjih") or []])
    dw = [{"t": "%s (%s%s): %s%s" % (x["who"], {"صريح": "اختيار صريح", "ظاهر": "ظاهر اختياره", "عرض": "عرض للمسألة دون ترجيح صريح"}[x["kind"]], ("، " + x["d"]) if x.get("d") else "", x["t"], (" — «" + x["nass"] + "»") if x.get("nass") else ""), "c": x["c"]} for x in fq.get("dawah") or []]
    if fq.get("dawah_diff"): dw.append({"t": fq["dawah_diff"]["t"], "c": fq["dawah_diff"]["c"]})
    sec(SECS3[7], dw)
    for x in fq.get("extra") or []: sec(x["h"], x["p"])
    return S


# ---------- سجل التغيير والتاريخ التحريري ----------
def changes(old, new, why):
    """ما أُضيف وما تغير وسببه، للمراجعة قبل الاعتماد (طلب المدير، ٢٧ نوفمبر)."""
    key = lambda v: (v.get("b"), v.get("p"))
    so = {key(v): v for v in (old.get("src") or {}).values()}; sn = {key(v): v for v in (new.get("src") or {}).values()}
    lab = lambda v: "«%s»%s، ص %s" % (v.get("t", ""), ("، ج %s" % v["v"]) if v.get("v") else "", v.get("p"))
    ho = [s.get("h") for s in old.get("s") or []]; hn = [s.get("h") for s in new.get("s") or []]
    np_ = lambda e: sum(len(s.get("p") or []) for s in e.get("s") or [])
    c = {"at": today(), "why": why, "add": [lab(v) for k, v in sn.items() if k not in so][:30], "drop": [lab(v) for k, v in so.items() if k not in sn][:30],
         "secs_add": [h for h in hn if h not in ho], "secs_drop": [h for h in ho if h not in hn], "p": [np_(old), np_(new)]}
    fo, fn = old.get("fq") or {}, new.get("fq") or {}
    mo = {(x["m"]) for a in fo.get("aqwal") or [] for x in a.get("mdh") or []}; mn = {(x["m"]) for a in fn.get("aqwal") or [] for x in a.get("mdh") or []}
    if mn - mo: c["mdh_add"] = [MDH[x] for x in sorted(mn - mo) if x in MDH]
    if len(fn.get("dawah") or []) > len(fo.get("dawah") or []): c["dawah_add"] = len(fn.get("dawah") or []) - len(fo.get("dawah") or [])
    return c


def hist(old, new, why):
    h = list((old or {}).get("hist") or [])
    if old and not h: h.append({"at": old.get("built") or "", "v": old.get("v") or (2 if old.get("v2") else 1), "why": "التحرير الأول", "n": len(old.get("src") or {})})
    h.append({"at": today(), "v": new.get("v"), "why": why, "n": len(new.get("src") or {})})
    return h[-30:]


# ---------- التحرير الفقهي ----------
def fiqh_profile():
    R, by = registry()
    return {"hits": lambda todo, boost: refs_hits(todo, boost=boost), "pick": pick_refs,
            "dpick": lambda DC, m, boost, AM, b, f: dawah_pick(DC, m, boost, AM, keys_of(f["t"], b["t"]) or keys_of(m["t"])),
            "prompt": lambda m, b, f, cur, ctx: FIQH_ENTRY.replace("{t}", m["t"]).replace("{bab}", b["t"]).replace("{fasl}", f["t"]).replace("{cur}", cur).replace("{ctx}", ctx),
            "flat": flatten, "accept": lambda fq, S: bool(S) and bool(fq["aqwal"] or fq["hukm"]), "fiqh": True, "meth": "fiqh3", "by": by,
            "review": R.get("review_updates", True) is not False, "deftr": "muq"}


def build(e, tree, todo, boost=None, why="", P=None):
    prefer = set(feed(e[0]).get("primary") or [])  # المراجع الأولى للموسوعة من التغذية: مقدمة في المواضع، ولا تُعد «مصدرًا جديدًا»
    """تحرير المسائل بالمنهج الموسع (الفقه افتراضًا، وغيره بملف منهجه P من mawsua_disc). يعيد (المنجز، هل نفدت الحصة)."""
    tp = os.path.join(M.OUT, e[0], "_tree.json")
    if not todo: return 0, False
    P = P or fiqh_profile()
    DC = M.dawah_corpus(None); AM = art_meta(); ix = {(r[1], r[4]): r for r in DC}
    RH = P["hits"](todo, set(boost or []) | prefer)
    by = P["by"]; review = P["review"]
    done = 0
    for b, f, m in todo:
        if time.time() - M.T0 > M.LIMIT: return done, False
        dh = P["dpick"](DC, m, set(boost or []) | prefer, AM, b, f)
        rh, more = P["pick"](RH.get(m["id"]) or [])
        ep = os.path.join(M.OUT, e[0], "e", m["id"] + ".json"); old = M.jl(ep) if m.get("e") else None
        hits = dh + rh
        if old:  # التحديث يضيف ولا يُسقط: مواضع المادة المنشورة تبقى في السياق
            have = {(h[1], h[4]) for h in hits}
            for v in (old.get("src") or {}).values():
                k_ = (v.get("b"), v.get("p"))
                if k_ in have or len(hits) >= 32: continue
                r_ = ix.get(k_)
                if not r_ and v.get("k") == "m":
                    pg = M.pages_of(v.get("b")); p_ = int(v.get("p") or 0)
                    if 0 < p_ <= len(pg):
                        t = M.body(pg[p_ - 1]); rr = by.get(v.get("b")) or {}
                        r_ = ("m", v["b"], v.get("t", ""), v.get("a", ""), p_, t, M.nz(t), "m", {"m": rr.get("m") or v.get("m"), "r": rr.get("r") or v.get("r"), "tr": rr.get("tr") or v.get("tr") or P["deftr"], "vol": rr.get("vol") or v.get("v") or 0, "sec": ""})
                if r_: hits.append(r_); have.add(k_)
        if not dh and len(rh) < 3:
            if not m.get("e"): m["skip"] = "قلة المواضع"
            else: m["upf"] = today()
            print("  ✗ قلة المواضع:", m["t"]); continue
        tags, ctx = {}, []
        for h in hits:
            tg = ("د" if h[0] == "d" else "م") + str(1 + sum(1 for x in tags.values() if x[0] == h[0]))
            tags[tg] = h; ctx.append(header(tg, h, AM) + "\n" + win(h, m))
        cur = ""
        if old:
            back = {(h[1], h[4]): tg for tg, h in tags.items()}
            rmap = {g: back.get((v.get("b"), v.get("p"))) for g, v in (old.get("src") or {}).items()}
            lines = [old.get("lead", "")] + ["## " + x.get("h", "") + "\n" + "\n".join(p["t"] + " " + "".join("[%s]" % rmap[c] for c in p.get("c") or [] if rmap.get(c)) for p in x.get("p") or []) for x in old.get("s") or []]
            cur = "المادة الحالية (المنشورة) — احفظ صحيحها وعزوها، وأعد بناءها على الهيكل المطلوب، وأضف إليها ما في المواضع الجديدة بلا حذف لمعلومة معزوة صحيحة:\n" + "\n".join(lines)[:7000] + "\n\n"
            newt = sorted({tg for tg, h in tags.items() if h[1] in set(boost or [])})
            if newt: cur += "المواضع الجديدة المطلوب إدخالها: " + "، ".join(newt) + "\n\n"
        prompt = P["prompt"](m, b, f, cur, "\n\n".join(ctx))
        r = M.T.gemini(prompt)
        if not r: return done, True
        if r.get("skip"):
            if not m.get("e"): m["skip"] = "المواضع لا تتعلق بالمسألة"
            else: m["upf"] = today()
            continue
        if P.get("norm"): r = P["norm"](r)
        fq, used = validate(r, tags, AM, P["fiqh"])
        S = P["flat"](fq)
        qs = []
        for q in r.get("q") or []:
            c = q.get("c") if isinstance(q, dict) else None; t = ((q or {}).get("t") or "").strip(" «»\"") if isinstance(q, dict) else ""
            if c in tags and t and M.nz(t) in tags[c][6]: qs.append({"t": t, "c": c}); used.add(c)
        if not P["accept"](fq, S):
            if not m.get("e"): m["skip"] = "لم تُعزَ الفقرات"
            else: m["upf"] = today()
            print("  ✗ لم تُعزَ:", m["t"]); continue
        src = {}
        for tg, h in tags.items():
            if tg not in used: continue
            x = h[8] if len(h) > 8 else {}
            s_ = {"k": h[0], "s": h[7], "b": h[1], "t": h[2], "a": h[3], "p": h[4]}
            if h[0] == "m": s_.update({"tr": x.get("tr"), "m": x.get("m"), "r": x.get("r"), "v": x.get("vol") or 0})
            else:
                a = AM.get(h[1]) or {}; s_["tr"] = "dawah"
                if a.get("d"): s_["d"] = _fmt_date(a["d"])
                if a.get("u"): s_["u"] = a["u"]
            src[tg] = s_
        mo = [{"b": h[1], "t": h[2], "a": h[3], "p": h[4], "tr": h[8]["tr"], "m": h[8]["m"], "v": h[8]["vol"]} for h in more if (h[1], h[4]) not in {(v["b"], v["p"]) for v in src.values()}][:16]
        ent = {"id": m["id"], "t": m["t"], "bab": b["t"], "fasl": f["t"], "lead": M.unname(r.get("lead", ""), [], keep=[h[3] for h in tags.values()]), "fq": fq, "s": S, "q": qs, "src": src, "more": mo,
               "see": [x for x in (r.get("see") or []) if isinstance(x, str)][:8], "built": today(), "ok": 1, "auto": 1, "v": 3, "meth": P["meth"]}
        nb = sorted({h["b"] for h in src.values()} & set(boost or []))
        if nb: ent["upd"] = today(); ent["new"] = nb
        w = why or ("مصدر جديد" if nb else (("ترقية إلى منهج الموسوعة الفقهية المقارنة" if P["fiqh"] else "ترقية إلى المنهج العلمي الموسع") if old else "التحرير الأول"))
        if old:
            ent["chg"] = changes(old, ent, w); ent["hist"] = hist(old, ent, w)
            if review or old.get("man"):  # التحديث المحافظ: المنشور باقٍ، والمقترح بجواره حتى تراجعه الإدارة وتعتمده
                ent["ok"] = 0
                M.jw(os.path.join(M.OUT, e[0], "e", m["id"] + ".new.json"), ent); m["rev"] = 1; done += 1
                print("  ↻ تحديث مقترح:", m["t"], "— مواضع", len(src), flush=True)
                M.glog({"k": e[0], "id": m["id"], "t": m["t"], "do": "rev", "b": nb}); M.jw(tp, tree); continue
            M.jw(os.path.join(M.OUT, e[0], "e", m["id"] + ".prev.json"), old)
        else:
            ent["hist"] = hist(None, ent, w)
        M.jw(ep, ent)
        m["e"] = 1; m["ok"] = 1; m["v"] = 3; m.pop("skip", None); m.pop("rev", None); done += 1
        print("  ✓", m["t"], "— مواضع", len(src), "(أقسام %d، أقوال %d، مذاهب ثابتة %d، الدعوة %d)" % (len(S), len(fq["aqwal"]), len({x["m"] for a in fq["aqwal"] for x in a["mdh"] if x["v"]}), len(fq["dawah"])), flush=True)
        if nb or m.get("add") or not old: M.glog({"k": e[0], "id": m["id"], "t": m["t"], "do": "upd" if old else "new", "b": nb})
        M.jw(tp, tree)
    M.jw(tp, tree)
    return done, False


def upgrade_ids(tree, n=40):
    """المسائل المحررة بالمنهج السابق (قبل الهيكل الفقهي): تُعاد بالمنهج المقارن مقترحاتٍ بجوار المنشور."""
    out = []
    for b in tree["b"]:
        for f in b["f"]:
            for m in f["m"]:
                if m.get("e") and not m.get("rev") and not m.get("upf") and not m.get("upr") and (m.get("v") or 0) < 3:  # upr: رفضت الإدارة الترقية
                    ent = M.jl(os.path.join(M.OUT, tree["k"], "e", m["id"] + ".json")) or {}
                    if (ent.get("v") or 0) < 3 and not os.path.exists(os.path.join(M.OUT, tree["k"], "e", m["id"] + ".new.json")): out.append(m["id"])
                    elif ent.get("v") == 3: m["v"] = 3
    return out[:n]


# ---------- المخطط الموسع ----------
PLAN2 = """أنت لجنة فقهية تعد مخطط «{kitab}» في «موسوعة الفقه» المقارن الموسعة، على ترتيب كتب الفقه المعتمدة.
المطلوب مخطط مستوعب لا مختصر: أبواب (٣–١٠)، وفي كل باب مسائل (٤–١٦) تستوعب ما يتناوله الفقهاء في هذا الكتاب: التعريف والحكم والأدلة،
والشروط، والأركان والواجبات، والسنن والمستحبات، والمبطلات والمكروهات، والمسائل الخلافية المشهورة، والنوازل المعاصرة المتصلة.
المسألة عنوان علمي دقيق لمسألة واحدة تُحرَّر في مادة مستقلة (لا عنوان باب جامع)، ولكل مسألة "kw": ٣–٦ ألفاظ بحث عربية يرد بها الكلام عنها في كتب الفقه وشروح الحديث وفتاوى المعاصرين، أولها أخصها.
من عناوين هذا الكتاب في المراجع (للاستئناس بالترتيب والاستيعاب):
{toc}

وهذه مسائل محررة موجودة في الموسوعة من هذا الكتاب: ضع كل واحدة منها في بابها المناسب بذكر رقمها {{"old": "الرقم"}} بدل كتابتها، ولا تكررها بلفظ آخر:
{old}

أخرج JSON: {{"f": [{{"t": "الباب", "m": [{{"t": "المسألة", "kw": ["…"]}}, {{"old": "fiqh-1-1-1"}}]}}]}}"""


def toc_kitab(bid, key, cap=70):
    doc = None
    for p_ in (os.path.join(M.D, "books", bid + ".json"), os.path.join(M.ROOT, "vols", bid + ".json")):
        if os.path.exists(p_): doc = M.jl(p_); break
    if not doc: return []
    out, kit = [], None
    for x in doc.get("toc") or []:
        t = (x.get("t") or "").strip()
        if KH.match(t): kit = kitab_of(t); continue
        if kit == key and t: out.append(re.sub(r"[\[\]\(\)]", "", t)[:70])
    return list(dict.fromkeys(out))[:cap]


def plan2(e):
    """إعادة بناء مخطط الفقه موسعًا على كتب الفقه الثمانية عشر (KUTUB)، كتابًا كتابًا، مع إبقاء المسائل المحررة بمعرّفاتها وحالها.
    المرحلي في _tree.plan2.json (يُستأنف إن نفدت الحصة)؛ وعند تمام الكتب يُستبدل المخطط."""
    k = e[0]; tp = os.path.join(M.OUT, k, "_tree.json"); sp = os.path.join(M.OUT, k, "_tree.plan2.json")
    tree = M.jl(tp) or {"k": k, "n": e[1], "b": []}
    if tree.get("v") == 3 and not os.path.exists(sp): print("  المخطط الموسع قائم"); return True
    st = M.jl(sp, {"done": {}}) or {"done": {}}
    olds = {}
    for b in tree["b"]:
        for f in b["f"]:
            for m in f["m"]:
                ks = keys_of(f["t"], b["t"]) or keys_of(m["t"]) or ["_"]
                olds.setdefault(ks[0], []).append(m)
    allids = {m["id"] for L in olds.values() for m in L}
    hint = [x for x in ("bidayatmujtahid", "rawdmurbi") if os.path.exists(os.path.join(M.D, "books", x + ".json")) or os.path.exists(os.path.join(M.ROOT, "vols", x + ".json"))]
    for ki, (key, name, _) in enumerate(KUTUB, 1):
        if key in st["done"]: continue
        if M.dead() or time.time() - M.T0 > M.LIMIT * 0.5: break
        toc = []
        for bid in hint: toc += toc_kitab(bid, key)
        mine = olds.get(key, [])
        r = M.T.gemini(PLAN2.format(kitab=name, toc="\n".join("- " + t for t in toc[:120]) or "—", old="\n".join("- [%s] %s" % (m["id"], m["t"]) for m in mine) or "لا شيء"))
        if not r or not r.get("f"): print("  تعذر مخطط", name); break
        byid = {m["id"]: m for m in mine}; placed = set(); fs = []
        have = set()
        for fi, F in enumerate(r["f"], 1):
            ms = []
            for mi, x in enumerate(F.get("m") or [], 1):
                if not isinstance(x, dict): continue
                if x.get("old") in byid and x["old"] not in placed: ms.append(byid[x["old"]]); placed.add(x["old"]); have.add(M.nz(byid[x["old"]]["t"])); continue
                t = (x.get("t") or "").strip()
                if not t or M.nz(t) in have: continue
                nid = "fiqh-k%d-%d-%d" % (ki, fi, mi)
                while nid in allids: nid += "x"
                allids.add(nid); have.add(M.nz(t))
                ms.append({"id": nid, "t": t, "kw": [w for w in (x.get("kw") or []) if isinstance(w, str)][:6]})
            if ms and (F.get("t") or "").strip(): fs.append({"t": F["t"].strip(), "m": ms})
        rest = [m for m in mine if m["id"] not in placed]
        if rest: fs.append({"t": "مسائل أخرى في " + name.replace("كتاب ", ""), "m": rest})
        st["done"][key] = {"t": name, "key": key, "f": fs}; M.jw(sp, st)
        print("  ✓ %s: %d بابًا، %d مسألة" % (name, len(fs), sum(len(F["m"]) for F in fs)), flush=True)
    if not all(key in st["done"] for key, _, _ in KUTUB): print("  المخطط الموسع: %d/%d كتابًا؛ يُستأنف في الجولة القادمة" % (len(st["done"]), len(KUTUB))); return False
    B = [st["done"][key] for key, _, _ in KUTUB]
    now = {m["id"]: m for b in tree["b"] for f in b["f"] for m in f["m"]}; seen = set()
    for b in B:  # حال المسائل المحررة من المخطط الحالي (قد تتغير بين الجولات)
        for F in b["f"]:
            F["m"] = [now.get(m["id"], m) for m in F["m"]]; seen.update(m["id"] for m in F["m"])
    misc = [m for i, m in now.items() if i not in seen]
    if misc: B.append({"t": "مسائل متفرقة", "key": "_", "f": [{"t": "مسائل متفرقة", "m": misc}]})
    M.jw(tp, {"k": k, "n": e[1], "built": today(), "ok": 1, "auto": 1, "v": 3, "b": B}); os.remove(sp)
    print("  ✓ المخطط الموسع للفقه: %d كتابًا، %d مسألة" % (len(B), sum(len(F["m"]) for b in B for F in b["f"])))
    return True
