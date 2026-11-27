"""المنهج العلمي الموسع لسائر الموسوعات (طلب المدير، ٢٧ نوفمبر ٢٠٢٦): العقيدة، التفسير، علوم القرآن، الفكر، الدعوة، اللغة،
التاريخ، الآداب، التربية، الأسرة، السياسة الشرعية — على منوال الموسوعة الفقهية (tools/mawsua_fiqh.py) وبآلياتها نفسها:

- سجل منهج كل موسوعة (data/mawsua/_disc.json): مراجعها المعتمدة في فنها بأدوارها ومساراتها (المصادر الأصلية، كتب المحققين،
  مصادر مساندة)، وأقسام مادتها، ووسم أقوالها (مذاهب أهل السنة والفرق، أقوال المفسرين، مذاهب النحاة…)، وتصنيفات فتاوى صوت السلف
  المتصلة بها، وأقسام مخططها الموسع، والمراجع الناقصة.
- الاسترجاع: مرور واحد على مراجع الموسوعة لمسائل الجولة، والصفحة ترجَّح بعنوان بابها في فهرس الكتاب وألفاظ المسألة، وتُوزَّع على
  المسارات (الأصول ٧، المحققون ٦، المساندة ٤، وموضعان من الكتاب الواحد)؛ ومشايخ الدعوة أولًا: فتاوى صوت السلف من تصنيف الموسوعة،
  ثم كتب الشيخ ياسر برهامي وشروحه، ثم سائر المشايخ.
- المادة: أقسام الفن، ثم الأقوال بأدلتها ومناقشتها، والترجيح بنصه، واختيارات مشايخ الدعوة بنوع الدلالة؛ وضبط النسبة نفسه (validate)
  والتحديث المحافظ نفسه (مقترح بسجل التغيير حتى تعتمده الإدارة)، والمخطط الموسع (plan2) بأقسام كل فن مع إبقاء المسائل المحررة.
"""
import os, re, time
import mawsua_fiqh as F

M = None
_CFG = [None]
_REG = {}


def init(mod):
    global M
    M = mod


def cfg():
    if _CFG[0] is None: _CFG[0] = M.jl(os.path.join(M.OUT, "_disc.json"), {}) or {}
    return _CFG[0]


def enc(k): return (cfg().get("enc") or {}).get(k)


def has(k): return bool(enc(k))


def registry(k):
    """{معرّف المجلد: بيان المرجع} لمراجع الموسوعة (كل مجلدات الكتاب الجاهزة نصوصها)."""
    if k in _REG: return _REG[k]
    refs = (enc(k) or {}).get("refs") or []; by = {}
    for b in M.CAT["books"]:
        if b.get("hidden") or b.get("demo") or (b.get("col") or "dawah") == "dawah" or (b.get("size") or 0) < 3000: continue
        t = b.get("setTitle") or b["title"]; an = M.AUTH.get(b.get("authorId"), "")
        for r in refs:
            if r["t"] in t and (not r.get("a") or r["a"] in an):
                if M.ready(b): by[b["id"]] = dict(r, title=t, author=an, vol=b.get("vol") or 0, m=None)
                break
    F.feed_refs(k, by, {"m": None, "r": "ms", "tr": "sanad"})  # الكتب الجديدة المتصلة بالموسوعة (_feed.json)
    _REG[k] = by; return by


def policy(k):
    E = enc(k) or {}; by = registry(k); sets = {}
    for r in by.values(): sets.setdefault(r["t"], r)
    return {"secs": E.get("secs") or [], "aq": E.get("aq") or "", "have": [{"t": r["title"], "a": r["author"], "r": r.get("r"), "tr": r.get("tr")} for r in sets.values()],
            "want": E.get("want") or [], "missing": [r["t"] for r in E.get("refs") or [] if r["t"] not in sets]}


def refs_hits(k, todo, boost=None, per_set=3):
    """مرور واحد على مراجع الموسوعة لمسائل الجولة: الصفحة تُرشَّح بعبارات المسألة، أو باجتماع ألفاظها الدالة إن وافق عنوانُ بابها في فهرس
    الكتاب المسألةَ؛ ويُزاد وزن الصفحة التي يوافق عنوان بابها ألفاظ المسألة."""
    by = registry(k); items = [(m, F._kws(m), F._core(m)) for _, _, m in todo]
    out = {m["id"]: {} for _, _, m in todo}; sets = {}
    for bid, r in by.items(): sets.setdefault(r["t"], []).append(bid)
    t0 = time.time(); np_ = 0
    for st, ids in sets.items():
        for bid in sorted(ids, key=lambda x: (by[x]["vol"], x)):
            doc = None
            for p_ in (os.path.join(M.D, "books", bid + ".json"), os.path.join(M.ROOT, "vols", bid + ".json")):
                if os.path.exists(p_):
                    try: doc = M.jl(p_)
                    except Exception: doc = None
                    break
            if not doc: continue
            pages = doc.get("pages") or []; r = by[bid]
            toc = sorted([(int(x.get("p") or 1), (x.get("t") or "").strip()) for x in doc.get("toc") or [] if x.get("t")], key=lambda x: x[0])
            ti, sec = 0, ""
            for i, pg in enumerate(pages):
                while ti < len(toc) and toc[ti][0] <= i + 1: sec = toc[ti][1]; ti += 1
                t = M.body(pg)
                if len(t) < 200: continue
                n = M.nz(t); ns = M.nz(sec); np_ += 1
                for m, kws, core in items:
                    sh = any(w in ns for w in kws[:4]) or sum(1 for w in core if w in ns) >= 2
                    s = F._score(kws, n, core if sh else None)
                    if not s and len(core) >= 3:  # بلا باب موافق: اجتماع أكثر الألفاظ الدالة (ثلاثة أرباعها) في الصفحة
                        ov = sum(1 for w in core if w in n)
                        if ov >= max(3, (3 * len(core) + 3) // 4): s = ov
                    if not s: continue
                    if sh: s += 6
                    if boost and bid in boost: s += 8
                    if re.match(r"\s*(?:متن|مختصر)\b", r["title"]): s -= 2  # الأصول والشروح مقدمة على المتون والمختصرات
                    L = out[m["id"]].setdefault(st, [])
                    L.append((s, ("m", bid, r["title"], r["author"], i + 1, t, n, "m", {"m": None, "r": r.get("r"), "tr": r.get("tr"), "vol": r["vol"], "sec": sec[:80]})))
                    if len(L) > 12: L.sort(key=lambda x: -x[0]); del L[per_set * 2:]
            doc = None
    print("  مراجع %s: %d كتابًا، %d صفحة فُحصت (%.0f ث)" % (k, len(sets), np_, time.time() - t0), flush=True)
    res = {}
    for mid, d in out.items():
        L = []
        for st, hs in d.items():
            hs.sort(key=lambda x: -x[0]); got = []
            for s, h in hs:
                if any(abs(h[4] - g[1][4]) <= 1 and h[1] == g[1][1] for g in got): continue
                got.append((s, h))
                if len(got) >= per_set: break
            L += got
        res[mid] = L
    return res


def pick_refs(scored, cap=16):
    sc = sorted(scored, key=lambda x: -x[0]); out, per, n = [], {}, {}
    caps = {"asl": 7, "tahqiq": 6, "sanad": 4}
    for s, h in sc:
        tr = h[8]["tr"]
        if n.get(tr, 0) >= caps.get(tr, 3) or per.get(h[2], 0) >= 2: continue
        out.append(h); per[h[2]] = per.get(h[2], 0) + 1; n[tr] = n.get(tr, 0) + 1
    return out[:cap], [h for s, h in sc if h not in out][:20]


DISC_ENTRY = """أنت محرر علمي محقق في «{name}»، تحرر مادة علمية موسعة مترابطة لمسألة: «{t}» (من «{bab}» › «{fasl}»).
المواضع المرسلة من مسارات، وفي رأس كل موضع مساره ودور كتابه:
١) مشايخ الدعوة السلفية [د…]: كتبهم وشروحهم، وفتاوى صوت السلف (أكثرها للشيخ ياسر برهامي، بتاريخها)، ومقالاتهم — وهي المعتمد الأول في التقرير والترجيح.
٢) المصادر الأصلية المعتمدة في الفن [م…]: الأمهات والمطولات والمتون المعتمدة وشروحها.
٣) كتب المحققين [م…]: تحريرات أئمة أهل السنة ومناقشاتهم وترجيحاتهم.
٤) مصادر مساندة [م…]: اللغة والحديث وشروحه والتاريخ والكتابات المعاصرة الموثوقة.

المنهج الملزم:
- الاستيعاب: لا تكتفِ بأول موضع؛ اجمع من المواضع كلها أكثرها تخصصًا واتصالًا بالمسألة، ورتبه وادمجه في سياق علمي متماسك. ولا تختصر اختصارًا مخلًّا: استوفِ ما في المواضع من التعريفات والتقسيمات والشروط والأحكام والأدلة والشواهد والفروع والأمثلة. والأصول والمطولات مقدمة على المتون والمختصرات.
- السياق: راعِ سياق كل موضع ومراده (تقرير، أو حكاية قول، أو رد على مخالف)، فلا تجعل القول المردود عليه تقريرًا، ولا تجتزئ قولًا بما يخل بمعناه. أسطر [المتن] في الشروح نص الكتاب المشروح لا كلام الشارح.
- الأقوال: لا تنسب قولًا إلى عالم أو طائفة أو مذهب إلا من موضع يحكيه، وفرّق بين قول العالم وحكايته لقول غيره، وبين تقرير أهل السنة ومقالات المخالفين؛ وفي "by" اسم من قال أو اختار ("kind": "قول|اختيار|ترجيح|مقالة فرقة").
- الترجيح: لا تخترع ترجيحًا ولا تنسبه إلى عالم لم يصرح به؛ ولكل ترجيح نصه الحرفي الدال عليه في "nass" منسوخًا بحروفه من موضعه.
- مشايخ الدعوة: اعرض ما ثبت من تقريراتهم واختياراتهم والشيخ ياسر برهامي أولًا، بنوع الدلالة "kind": "صريح" أو "ظاهر" أو "عرض" (حكى أو نقل بلا ترجيح) — ومجرد النقل ليس اختيارًا؛ وإن اختلف قول الشيخ في موضعين فبيّنه بإنصاف في "dawah_diff" بتاريخ كل منهما، ولا تخترع توفيقًا.
- التوثيق: كل فقرة تُعزى إلى رموز مواضعها في "c"، وتُميَّز في "ty": "نقل" (نص حرفي) أو "تلخيص" أو "تحرير"؛ لا تصغ كلامًا من عندك ثم تنسبه إلى عالم، ولا تضف من خارج المواضع إلا آية بسورتها ورقمها. والحديث والأثر بلفظهما في موضعهما، وتخريجهما ودرجتهما إن ذكرتهما المواضع فقط.
- ما تعذر التحقق من نسبته اذكره في "nv" صراحة.
- إن كانت المواضع لا تتعلق بالمسألة حقيقة فأخرج {"skip": true}.

الهيكل (مرن: اترك ما ليس له مادة، ولا تُسقط عنصرًا جوهريًّا له مادة، ولك أن تزيد أقسامًا بعناوينها). الفقرة: {"t": "النص", "c": ["م1"], "ty": "نقل|تلخيص|تحرير"}
{"lead": "تمهيد في سطرين",
 "s": [{"h": "عنوان القسم", "p": [فقرات]}],   ← الأقسام بالترتيب: {secs}
 "aqwal": [{"n": "القول الأول", "t": "نص القول", "c": ["م1"], "by": [{"who": "اسم العالم أو الطائفة", "kind": "قول|اختيار|ترجيح|مقالة فرقة", "c": ["م1"]}], "adl": [{"ty": "قرآن|سنة|أثر|إجماع|قياس|لغة|قاعدة", "t": "الدليل أو الشاهد", "takh": "التخريج إن ورد", "c": ["م2"]}], "wajh": [فقرات: وجه الاستدلال], "mun": [فقرات: المناقشة والرد والجواب]}],   ← {aq}، إن كان في المسألة خلاف أو أقوال
 "tarjih": [{"who": "من رجّح", "t": "مضمون الترجيح ومستنده", "nass": "نصه الحرفي", "c": "م3"}],
 "dawah": [{"who": "اسم الشيخ", "kind": "صريح|ظاهر|عرض", "t": "قوله ومستنده", "nass": "نصه الحرفي", "c": "د1"}],
 "dawah_diff": {"t": "…", "c": ["د1", "د4"]},
 "q": [{"t": "اقتباس حرفي ١٠–٤٠ كلمة", "c": "د1"}],
 "see": ["عنوان مسألة ذات صلة"],
 "nv": ["ما تعذر التحقق من نسبته"]}

{cur}المواضع:
{ctx}"""


def flatten(fq):
    S = [x for x in fq.get("extra") or []]
    ql = [{"t": "%s: %s%s" % (a["n"], a["t"], ("؛ " + "، ".join("%s: %s" % (x["kind"], x["who"]) for x in a["by"])) if a["by"] else ""), "c": a["c"]} for a in fq.get("aqwal") or [] if a["c"]]
    ql += [{"t": "%s — %s: %s" % (a["n"], d["ty"], d["t"]), "c": d["c"]} for a in fq.get("aqwal") or [] for d in a["adl"]]
    ql += [dict(p, t=a["n"] + ": " + p["t"]) for a in fq.get("aqwal") or [] for p in a["wajh"] + a["mun"]]
    if ql: S.insert(min(2, len(S)), {"h": "الأقوال وأدلتها ومناقشتها", "p": ql})
    tj = [{"t": "رجّح %s: %s — «%s»" % (x["who"], x["t"], x["nass"]), "c": x["c"]} for x in fq.get("tarjih") or []]
    if tj: S.append({"h": "الترجيح", "p": tj})
    dw = [{"t": "%s (%s%s): %s%s" % (x["who"], {"صريح": "اختيار صريح", "ظاهر": "ظاهر اختياره", "عرض": "عرض دون ترجيح صريح"}[x["kind"]], ("، " + x["d"]) if x.get("d") else "", x["t"], (" — «" + x["nass"] + "»") if x.get("nass") else ""), "c": x["c"]} for x in fq.get("dawah") or []]
    if fq.get("dawah_diff"): dw.append({"t": fq["dawah_diff"]["t"], "c": fq["dawah_diff"]["c"]})
    if dw: S.append({"h": "تقريرات مشايخ الدعوة السلفية واختياراتهم", "p": dw})
    return S


def profile(e):
    k = e[0]; E = enc(k); by = registry(k); C = cfg()
    rx = re.compile(E["fcat"]) if E.get("fcat") else re.compile(r"(?!x)x")  # بلا تصنيف (اللغة): الفتاوى مؤخرة
    def prompt(m, b, f, cur, ctx):
        return (DISC_ENTRY.replace("{name}", e[1]).replace("{t}", m["t"]).replace("{bab}", b["t"]).replace("{fasl}", f["t"])
                .replace("{secs}", "، ".join(E.get("secs") or [])).replace("{aq}", E.get("aq") or "الأقوال").replace("{cur}", cur).replace("{ctx}", ctx))
    def norm(r):  # أقسام الفن تُحمل على extra لتمر بالتحقق نفسه
        if isinstance(r, dict): r["extra"] = r.get("s") or []
        return r
    def flat(fq): return flatten(fq)
    return {"hits": lambda todo, boost: refs_hits(k, todo, boost), "pick": pick_refs,
            "dpick": lambda DC, m, boost, AM, b, f: F.dawah_pick(DC, m, boost, AM, None, rx),
            "prompt": prompt, "norm": norm, "flat": flat, "accept": lambda fq, S: len(S) >= 2, "fiqh": False, "meth": "disc3", "by": by,
            "review": C.get("review_updates", True) is not False, "deftr": "asl"}


# ---------- المخطط الموسع لكل فن ----------
PLAN2 = """أنت لجنة علمية تعد قسم «{div}» من «{name}» الموسعة، على ترتيب كتب الفن المعتمدة.
نطاق الموسوعة: {desc}
المطلوب تقسيم مستوعب لا مختصر: فصول (٢–٨)، وفي كل فصل مسائل (٣–١٢) تستوعب ما يتناوله أهل العلم في هذا القسم: التعريفات والأصول، والأحكام والتقسيمات،
والأدلة والشواهد، والأقوال والخلاف، والشبهات والردود، والتطبيقات والنوازل المعاصرة، بحسب طبيعة الفن.
المسألة عنوان علمي دقيق لمسألة واحدة تُحرَّر في مادة مستقلة، ولكل مسألة "kw": ٣–٦ ألفاظ بحث عربية يرد بها الكلام عنها في الكتب، أولها أخصها.
من عناوين هذا القسم في المراجع (للاستئناس):
{toc}

وهذه مسائل موجودة في الموسوعة لم توضع بعد في قسم: ما كان منها من هذا القسم فضعه في فصله بذكر رقمه {{"old": "الرقم"}} بدل كتابته، ولا تكرره بلفظ آخر، واترك ما ليس منه:
{old}

أخرج JSON: {{"f": [{{"t": "الفصل", "m": [{{"t": "المسألة", "kw": ["…"]}}, {{"old": "aqeeda-1-1-1"}}]}}]}}"""


def toc_hint(k, kws, cap=80):
    """عناوين من فهارس المراجع الأصلية للموسوعة توافق ألفاظ القسم."""
    by = registry(k); out = []; kz = [M.nz(w) for w in kws if M.nz(w)]
    seen = set()
    for bid, r in by.items():
        if r.get("tr") != "asl" or r["t"] in seen and len(out) > cap: continue
        doc = None
        for p_ in (os.path.join(M.D, "books", bid + ".json"), os.path.join(M.ROOT, "vols", bid + ".json")):
            if os.path.exists(p_): doc = M.jl(p_); break
        if not doc: continue
        for x in doc.get("toc") or []:
            t = (x.get("t") or "").strip()
            if t and any(w in M.nz(t) for w in kz): out.append(re.sub(r"[\[\]\(\)]", "", t)[:70])
        seen.add(r["t"])
        if len(out) > cap * 2: break
    return list(dict.fromkeys(out))[:cap]


def plan2(e):
    """إعادة بناء مخطط الموسوعة موسعًا على أقسام فنها (div)، قسمًا قسمًا (مرحليًّا في _tree.plan2.json)، مع إبقاء المسائل الموجودة
    بمعرّفاتها وحالها: يضعها المحرر في فصولها، وما لم يوضع يبقى في «مسائل متفرقة»."""
    k = e[0]; E = enc(k); tp = os.path.join(M.OUT, k, "_tree.json"); sp = os.path.join(M.OUT, k, "_tree.plan2.json")
    tree = M.jl(tp) or {"k": k, "n": e[1], "b": []}
    if tree.get("v") == 3 and not os.path.exists(sp): print("  المخطط الموسع قائم:", k); return True
    st = M.jl(sp, {"done": {}}) or {"done": {}}
    now = {m["id"]: m for b in tree["b"] for f in b["f"] for m in f["m"]}
    placed = {m["id"] for d in st["done"].values() for F_ in d["f"] for m in F_["m"]}
    allids = set(now) | placed
    divs = E.get("div") or []
    for di, D in enumerate(divs, 1):
        key = "d%d" % di
        if key in st["done"]: continue
        if M.dead() or time.time() - M.T0 > M.LIMIT * 0.5: break
        rest = [m for i, m in now.items() if i not in placed]
        r = M.T.gemini(PLAN2.format(div=D["t"], name=e[1], desc=e[2], toc="\n".join("- " + t for t in toc_hint(k, D.get("kw") or [D["t"]])) or "—",
                                    old="\n".join("- [%s] %s" % (m["id"], m["t"]) for m in rest[:120]) or "لا شيء"))
        if not r or not r.get("f"): print("  تعذر قسم", D["t"]); break
        fs, have = [], set()
        for fi, F_ in enumerate(r["f"], 1):
            ms = []
            for mi, x in enumerate(F_.get("m") or [], 1):
                if not isinstance(x, dict): continue
                o = x.get("old")
                if o in now and o not in placed: ms.append(now[o]); placed.add(o); have.add(M.nz(now[o]["t"])); continue
                t = (x.get("t") or "").strip()
                if not t or M.nz(t) in have: continue
                nid = "%s-k%d-%d-%d" % (k, di, fi, mi)
                while nid in allids: nid += "x"
                allids.add(nid); have.add(M.nz(t))
                ms.append({"id": nid, "t": t, "kw": [w for w in (x.get("kw") or []) if isinstance(w, str)][:6]})
            if ms and (F_.get("t") or "").strip(): fs.append({"t": F_["t"].strip(), "m": ms})
        st["done"][key] = {"t": D["t"], "key": key, "f": fs}; M.jw(sp, st)
        print("  ✓ %s › %s: %d فصلًا، %d مسألة" % (k, D["t"], len(fs), sum(len(x["m"]) for x in fs)), flush=True)
    if not all("d%d" % i in st["done"] for i in range(1, len(divs) + 1)): print("  المخطط الموسع %s: %d/%d؛ يُستأنف" % (k, len(st["done"]), len(divs))); return False
    B = [st["done"]["d%d" % i] for i in range(1, len(divs) + 1)]
    cur = {m["id"]: m for b in tree["b"] for f in b["f"] for m in f["m"]}; seen = set()
    for b in B:
        for F_ in b["f"]: F_["m"] = [cur.get(m["id"], m) for m in F_["m"]]; seen.update(m["id"] for m in F_["m"])
    misc = [m for i, m in cur.items() if i not in seen]
    if misc: B.append({"t": "مسائل متفرقة", "key": "_", "f": [{"t": "مسائل متفرقة", "m": misc}]})
    M.jw(tp, {"k": k, "n": e[1], "built": F.today(), "ok": 1, "auto": 1, "v": 3, "b": B}); os.remove(sp)
    print("  ✓ المخطط الموسع %s: %d قسمًا، %d مسألة" % (k, len(B), sum(len(x["m"]) for b in B for x in b["f"])))
    return True
