#!/usr/bin/env python3
"""رحلة شرح السنة (طلب المدير، ١٤ نوفمبر ٢٠٢٦): شرح موجز شامل لكل حديث برواياته في الكتب التسعة، يوميًّا آليًّا.

الترتيب: صحيح البخاري، ثم زوائد مسلم، ثم أبي داود، ثم النسائي، ثم الترمذي، ثم ابن ماجه، ثم مسند أحمد، ثم الموطأ (ثم الدارمي).
«العنقود»: الحديث ورواياته في الكتب التسعة (روابط التخريج في data/hadith/links، ومواضع تكراره في البخاري)؛ يُشرح مرة واحدة،
فإذا فُتحت رواية منه في أي كتاب ظهر الشرح نفسه. فلا يبقى لكل كتاب تالٍ إلا ما لم يُشرح من زوائده.

مقاصد الشرح (من توجيه المدير):
  ١) غريب الحديث ومعاني المفردات، والمراد بالجمل والعبارات، والمبهمات، والمنسوخ والمجمل والمبيَّن والعام والخاص.
  ٢) أهم ما يُستنبط منه: فقهيًّا وعقديًّا وأدبيًّا وعلميًّا — موجزًا وافيًا لكل ألفاظ الحديث وسياقه، بلا توسع في الخلاف.
المصادر: نصوص الشروح نفسها من المكتبة، مواضعها المربوطة بكل رواية (فتح الباري لابن حجر ولابن رجب، والمنهاج للنووي،
والمفهم، ومعالم السنن، وتهذيب السنن، وعون المعبود، وعارضة الأحوذي، وتحفة الأحوذي، وحاشيتا السيوطي والسندي، والاستذكار…)،
وما يوجد فيه الحديث من نيل الأوطار والسيل الجرار وسبل السلام وفيض القدير وطرح التثريب والفتح الرباني. لا يكتب النموذج من عنده:
كل نقطة من النصوص المرسلة، بعزوها [[المجلد:الصفحة]].

المخرجات: data/sharh/c/<ملف>.json (العناقيد)، وdata/sharh/map/<كتاب>.json ({رقم: [معرّف العنقود، الملف]})،
وdata/sharh/_state.json (التقدم)، وtools/sharh-report.md. مفتاح الإيقاف: sharh_ai.
المتغيرات: SHARH_MAX (عدد العناقيد في التشغيل، ٦٠)، SHARH_MINUTES (١٥٠)، SHARH_ONLY (عنقود بعينه «bukhari:1»).
"""
import glob, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402  gemini بالمفاتيح المحجوزة لخدمات الكتب وبدائل النماذج

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); H = os.path.join(D, "hadith"); OUT = os.path.join(D, "sharh")
ORDER = ["bukhari", "muslim", "abudawud", "nasai", "tirmidhi", "ibnmajah", "musnadahmad", "muwatta", "darimi"]
NINE = set(ORDER)
# شروح كل كتاب بترتيب الاعتماد (ما لم يُستورد بعد يُتجاوز)
SHR = {"bukhari": ["fathbari", "fathbarirajab"], "muslim": ["nawawimuslim", "mufhim"], "abudawud": ["maalimsunan", "tahdhibsunan", "awnmabud"],
       "tirmidhi": ["aridatahwadhi", "tuhfaahwadhi"], "nasai": ["suyutinasai", "sindinasai"], "ibnmajah": ["sindiibnmajah"],
       "musnadahmad": ["sindimusnad", "fathrabbani"], "muwatta": ["istidhkar", "tamhid"], "darimi": []}
THEMATIC = ["naylawtar", "sayljarrar", "subulsalam", "faydqadir", "tarhtathrib", "fathrabbani", "jamiulum"]
MAX = int(os.environ.get("SHARH_MAX", "60")); T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("SHARH_MINUTES", "150"))
AR2EN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def js(p, o, ind=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=ind, separators=None if ind else (",", ":"))


def words(s):
    s = re.sub(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]", "", s or "")
    s = re.sub(r"صلى الله عليه(?: وعلى آله| وآله)?(?: وسلم)?|رضي الله عن(?:ه|ها|هما|هم)|[ﷺ﵀-﵏ﷻ]", " ", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return [w for w in re.sub(r"[^ء-ي ]", " ", s).split() if len(w) > 1]


def clean_matn(m):
    """المتن وحده: نسخة البخاري تضع المتن بين قوسين يتبعه بيان المحقق ومواضع التكرار «[٥٤، …]»"""
    m = m or ""
    if m.lstrip().startswith("("):
        i = m.find(")")
        if i > 20: return m.lstrip()[1:i].strip() if m.lstrip()[0] == "(" else m[:i]
    k = re.search(r"\s\[[\d٠-٩،,\s]+\]", m)
    return m[:k.start()].strip() if k else m


def shingles(ws, k=4): return {" ".join(ws[i:i + k]) for i in range(len(ws) - k + 1)}


# ---------- الكتب التسعة: الأرقام والمتون والروابط ----------
def load_book(b):
    idx = jl(os.path.join(H, "k", b + ".json"), {}); items = idx.get("items") or []
    M = {}
    for f in sorted(glob.glob(os.path.join(H, "k", b, "m*.json"))): M.update(jl(f, {}))
    pos = {str(x[0]): i for i, x in enumerate(items)}
    return {"t": idx.get("t") or b, "items": items, "pos": pos, "m": M, "links": jl(os.path.join(H, "links", b + ".json"), {})}


def book_page(vol, p):
    for path in (os.path.join(ROOT, "vols", vol + ".json"), os.path.join(D, "books", vol + ".json")):
        if os.path.exists(path):
            if path not in PG: PG[path] = jl(path, {}).get("pages") or []
            ps = PG[path]; return ps[p - 1] if 0 < p <= len(ps) else ""
    return ""
PG = {}


def vols_of(bid):
    return sorted(glob.glob(os.path.join(ROOT, "vols", bid + "-v*.json"))) or ([os.path.join(D, "books", bid + ".json")] if os.path.exists(os.path.join(D, "books", bid + ".json")) else [])


def title_of(cat, vol):
    b = next((x for x in cat["books"] if x["id"] == vol), None)
    return (b.get("setTitle") or b["title"]) if b else vol


def main():
    sw = (jl(os.path.join(D, "switches.json"), {}) or {}).get("s") or {}
    if sw.get("all_jobs") is False or sw.get("sharh_ai") is False: print("موقوف من المفاتيح"); return
    DRY = os.environ.get("SHARH_DRY") == "1"  # تجربة: يُبنى العنقود ونصوصه ويُطبع حجمه بلا طلب ولا حفظ
    if not T.KEYS and not DRY: print("لا مفاتيح Gemini"); return
    cat = jl(os.path.join(D, "catalog.json"), {"books": []})
    BK = {b: load_book(b) for b in ORDER if os.path.exists(os.path.join(H, "k", b + ".json"))}
    print("الكتب:", {b: len(v["items"]) for b, v in BK.items()}, flush=True)
    # روابط الروايات في الاتجاهين (التخريج بين الكتب التسعة)، ومواضع التكرار في البخاري
    NB = {}
    def edge(a, z):
        if a != z: NB.setdefault(a, set()).add(z); NB.setdefault(z, set()).add(a)
    for b, V in BK.items():
        for n, L in V["links"].items():
            base = n.split(".")[0]
            if base != n and base in V["pos"]: edge((b, n), (b, base))
            for b2, n2 in L.get("t") or []:
                if b2 in NINE and b2 in BK and str(n2) in BK[b2]["pos"]: edge((b, n), (b2, str(n2)))
    if "bukhari" in BK:
        for n, m in BK["bukhari"]["m"].items():
            br = re.search(r"\[([\d٠-٩،,\s]+)\]\s*\.?\s*$", (m or "")[-200:])
            if br:
                for x in re.split(r"[،,\s]+", br.group(1).translate(AR2EN)):
                    if x and x in BK["bukhari"]["pos"]: edge(("bukhari", n), ("bukhari", x))
    # روايات لم تربطها روابط التخريج: اتفاق المتون في المقاطع الرباعية بين الكتب التسعة (بعد حذف المقاطع الشائعة)
    SI, SK = {}, {}
    for b, V in BK.items():
        for n, m in V["m"].items():
            if "." in n: continue
            hs = {hash(x) for x in shingles(words(clean_matn(m))[:45])}
            SK[(b, n)] = hs
            for h in hs: SI.setdefault(h, []).append((b, n))
    common = {h for h, l in SI.items() if len(l) > 60}
    # والمقياس الثاني: الكلمات المميِّزة (غير الشائعة) مشتركةً في الاتجاهين، لاختلاف ألفاظ الروايات («بالنيات/بالنية»، «لكل امرئ/لامرئ»)
    WK, WI, DF = {}, {}, {}
    stem = lambda w: re.sub(r"^(و|ف|ب|ل|ك)(?=ال)", "", w)
    for key in SK:
        ws = {stem(w) for w in words(clean_matn(BK[key[0]]["m"].get(key[1], "")))[:45] if len(w) > 2}
        WK[key] = ws
        for w in ws: DF[w] = DF.get(w, 0) + 1
    for key, ws in WK.items():
        WK[key] = {w for w in ws if DF[w] <= 400}
        for w in WK[key]: WI.setdefault(w, []).append(key)
    def variants(key):
        hs = SK.get(key, set()) - common
        if len(hs) < 3: return []
        cnt = {}
        for h in hs:
            for k2 in SI.get(h, ()):
                if k2 != key: cnt[k2] = cnt.get(k2, 0) + 1
        need = max(3, int(len(hs) * 0.3))
        out = {k2 for k2, c in cnt.items() if c >= need}
        R = WK.get(key, set())
        if len(R) >= 4:
            wc = {}
            for w in R:
                for k2 in WI.get(w, ()):
                    if k2 != key: wc[k2] = wc.get(k2, 0) + 1
            out |= {k2 for k2, c in wc.items() if c >= max(4, 0.6 * len(R)) and c >= 0.5 * len(WK.get(k2, ())) }
        return list(out)
    MAP = {b: jl(os.path.join(OUT, "map", b + ".json"), {}) for b in ORDER}
    st = jl(os.path.join(OUT, "_state.json"), {"done": 0, "books": {}})
    covered = lambda b, n: n in MAP.get(b, {})
    # قائمة العمل بالترتيب: ما لم يُشرح من كل كتاب
    todo = []
    only = os.environ.get("SHARH_ONLY", "").strip()
    if only: b, n = only.split(":"); todo = [(b, n)]
    else:
        for b in ORDER:
            if b not in BK: continue
            for x in BK[b]["items"]:
                n = str(x[0])
                if "." in n or covered(b, n): continue
                m = BK[b]["m"].get(n) or ""
                if len(words(m)) < 4: continue  # ليس متنًا (إحالة «حدثنا مسدد…» أو عنوان)
                todo.append((b, n))
                if len(todo) >= MAX * 3: break
            if len(todo) >= MAX * 3: break
    # المرشحون من الشروح الموضوعية: فهرس مقاطع لمتون العمل وحده (قراءة كل كتاب مرة واحدة)
    want = {}
    for b, n in todo[:MAX * 2]:
        for s in list(shingles(words(BK[b]["m"].get(n, ""))[:50]))[:40]: want.setdefault(s, set()).add((b, n))
    THM = {}
    for bid in THEMATIC:
        for path in vols_of(bid):
            vol = os.path.basename(path)[:-5]
            for i, pg in enumerate(jl(path, {}).get("pages") or []):
                if not isinstance(pg, str): continue
                hit = {}
                for s in shingles(words(pg)) & want.keys():
                    for key in want[s]: hit[key] = hit.get(key, 0) + 1
                for key, c in hit.items():
                    if c >= 3: THM.setdefault(key, []).append((c, vol, i + 1))
    rep, made = [], 0
    for b, n in todo:
        if made >= MAX or time.time() > T.DEADLINE[0]: break
        if covered(b, n): continue
        seed = (b, n)
        mem = [seed] + sorted((x for x in set(NB.get(seed, ())) | set(variants(seed)) if not covered(*x) and x != seed), key=lambda x: (ORDER.index(x[0]), float(x[1]) if re.match(r"^[\d.]+$", x[1]) else 0))[:40]
        # الروايات: متن كل رواية مع كتابها ورقمها (المختلف لفظه أولًا)
        seen, var = set(), []
        for x in mem:
            m = clean_matn(BK[x[0]]["m"].get(x[1], ""))
            k = " ".join(words(m)[:30])
            if not m or k in seen: continue
            seen.add(k); var.append((x, m[:700]))
        # نصوص الشروح: مواضع شرح كل رواية في شرحها، ثم الشروح الموضوعية
        refs, ex, budget = [], [], 60000
        for x in mem:
            for vol, p in (BK[x[0]]["links"].get(x[1], {}) or {}).get("sh") or []:
                if not any(vol.startswith(s) for s in SHR.get(x[0], [])) and not any(vol.startswith(s) for v in SHR.values() for s in v): continue
                for pp in (p, p + 1):
                    r = vol + ":" + str(pp)
                    if r in refs: continue
                    t = book_page(vol, pp)
                    if t and budget > 0: refs.append(r); ex.append("[[%s]] (%s، ص %d)\n%s" % (r, title_of(cat, vol), pp, t[:4500])); budget -= min(len(t), 4500)
        for c, vol, p in sorted((y for x in mem for y in THM.get(x, [])), reverse=True)[:4]:
            r = vol + ":" + str(p)
            if r in refs or budget <= 0: continue
            t = book_page(vol, p); refs.append(r); ex.append("[[%s]] (%s، ص %d)\n%s" % (r, title_of(cat, vol), p, t[:3500])); budget -= min(len(t), 3500)
        if not ex:
            rep.append("- %s:%s لم تُوجد له نصوص شرح في المكتبة بعد؛ يُعاد في جولة قادمة" % seed); continue
        prompt = PROMPT.format(riw="\n".join("- %s رقم %s: «%s»" % (BK[x[0]]["t"], x[1], m) for x, m in var[:14]), ex="\n\n".join(ex))
        if DRY:
            print("%s:%s روايات=%d (%s) نصوص=%d %s حجم=%d" % (seed[0], seed[1], len(mem), " ".join(x[0] + ":" + x[1] for x in mem[:8]), len(refs), " ".join(refs[:6]), len(prompt)), flush=True); made += 1; continue
        out = T.gemini(prompt)
        if not isinstance(out, dict) or not (out.get("ijmali") and (out.get("gharib") or out.get("murad"))):
            rep.append("- %s:%s تعذّر الشرح (رد غير صالح)" % seed); continue
        ok = set(refs)
        def clean(v):  # لا يبقى إلا العزو إلى نصوص أُرسلت فعلًا
            if isinstance(v, str): return re.sub(r"\[\[([^\]]+)\]\]", lambda m: m.group(0) if m.group(1) in ok else "", v).strip()
            if isinstance(v, list): return [y for y in (clean(z) for z in v) if y]
            if isinstance(v, dict): return {k: clean(z) for k, z in v.items()}
            return v
        out = clean(out)
        cid = "%s:%s" % seed
        rec = {"id": cid, "mem": [[x[0], x[1]] for x in mem], "riw": [[x[0], x[1]] for x, _ in var[:14]], "s": out, "refs": refs, "at": time.strftime("%Y-%m-%d"), "rev": 0}
        fn = "%s-%d" % (b, BK[b]["pos"].get(n, 0) // 100)
        fp = os.path.join(OUT, "c", fn + ".json"); C = jl(fp, {}); C[cid] = rec; js(fp, C)
        for x in mem:
            MAP.setdefault(x[0], {})[x[1]] = [cid, fn]
            st["books"][x[0]] = st["books"].get(x[0], 0) + 1
        for bb in {x[0] for x in mem}: js(os.path.join(OUT, "map", bb + ".json"), MAP[bb])
        st["done"] = st.get("done", 0) + 1; st["at"] = time.strftime("%Y-%m-%d"); made += 1
        js(os.path.join(OUT, "_state.json"), st, 1)
        rep.append("- %s: %d رواية، %d نصًّا من الشروح" % (cid, len(mem), len(refs)))
        print(rep[-1], flush=True)
    if DRY: return
    tot = {b: len(V["items"]) for b, V in BK.items()}
    st["cover"] = {b: "%d/%d" % (len(MAP.get(b, {})), tot[b]) for b in BK}; js(os.path.join(OUT, "_state.json"), st, 1)
    lp = os.path.join(ROOT, "tools", "sharh-report.md"); old = open(lp, encoding="utf-8").read().split("\n", 2)[-1] if os.path.exists(lp) else ""
    open(lp, "w", encoding="utf-8").write("# رحلة شرح السنة (tools/sharh-ai.py)\n\n## %s — شُرح %d عنقودًا؛ التغطية: %s\n%s\n\n%s" % (time.strftime("%Y-%m-%d"), made, json.dumps(st["cover"], ensure_ascii=False), "\n".join(rep), old[:200000]))
    open(os.path.join(ROOT, ".sharh-report.txt"), "w", encoding="utf-8").write("📜 <b>شرح السنة</b>: %d حديثًا برواياتها" % made if made else "")
    print("شُرح", made)


PROMPT = """أنت شارح للحديث النبوي على منهج أهل السنة، تكتب شرحًا موجزًا وافيًا لحديث برواياته، مستخلصًا من نصوص الشروح المعتمدة المرسلة إليك وحدها.

روايات الحديث في الكتب التسعة:
{riw}

نصوص الشروح من المكتبة (كل نص مسبوق بمرجعه [[...]]):
{ex}

اكتب شرحًا جامعًا للحديث برواياته كلها في موضع واحد، على مقصدين:
الأول: غريب الحديث ومعاني مفرداته، والمراد بجمله وعباراته بترتيب ألفاظه، وبيان المبهمات في متنه (من هو الرجل أو المرأة…)، وما فيه من المنسوخ والمجمل والمبيَّن والعام والخاص إن وُجد.
الثاني: أهم ما يُستنبط منه من مسائل فقهية وعقدية وأدبية وعلمية.
الشروط:
- موجز وافٍ لكل ألفاظ الحديث وسياقه ورواياته؛ لا توسع في الخلاف ولا الاعتراضات، بل الراجح أو المشهور بإيجاز.
- كل ما تكتبه من النصوص المرسلة وحدها؛ لا تضف من عندك قولًا ولا حكمًا على حديث ولا اسمًا. وأتبع كل نقطة بعزوها [[المرجع]] كما في النصوص.
- اذكر ما تزيده الروايات الأخرى من ألفاظ أو فوائد منسوبة إلى كتابها.
- عربية فصيحة سليمة بلا حشو.
أخرج JSON وحده بهذه الصيغة:
{{"gharib": [{{"w": "الكلمة", "m": "معناها [[مرجع]]"}}],
 "murad": "شرح جمل الحديث وعباراته بترتيبها، فقرةً لكل جملة، مع العزو",
 "mubhamat": ["بيان مبهم [[مرجع]]"],
 "usul": "المنسوخ والمجمل والمبيَّن والعام والخاص إن وُجد فيه، وإلا فارغ",
 "riwayat": "ما تزيده الروايات الأخرى من ألفاظ ومعانٍ، منسوبًا إلى كتبها",
 "ijmali": "المعنى الإجمالي للحديث في فقرة",
 "fawaid": {{"fiqh": ["فائدة فقهية [[مرجع]]"], "aqida": [], "adab": [], "ilm": []}}}}
"""

if __name__ == "__main__":
    main()
