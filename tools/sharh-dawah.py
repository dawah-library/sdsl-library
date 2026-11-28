#!/usr/bin/env python3
"""شروح مشايخ الدعوة في قسم الحديث (طلب المدير، ٢٠ نوفمبر ٢٠٢٦): أن يكون لمشايخ الدعوة حضور في «شرح السنة».
المصدر: مشاريع «شرح الكتب» (data/shp) التي أصلها كتاب من الكتب التسعة، وشارحها من مشايخ الدعوة (col=dawah في الفهرس)،
مثل «شرح صحيح مسلم» للشيخ ياسر برهامي مربوطًا بصحيح مسلم.
الخطوتان:
  ١) الربط (بلا ذكاء اصطناعي): كل مقطع شرح مربوط بموضع في المتن يُنسب إلى رقم الحديث في قسم الحديث (من «٢٤٠ - (١٥٣)» في المتن،
     أو أحاديث الصفحة)، فيظهر تحت شرح الحديث: «من شرح الشيخ … — اقرأ شرحه لهذا الحديث (ص …)».
  ٢) الفوائد والترجيحات: يستخرجها النموذج من نص الشرح نفسه نقلًا حرفيًّا (يُتحقق آليًّا أن كل نقل موجود بنصه في الشرح، وما لم يوجد يُحذف)،
     وتبقى مسودة لا يراها إلا المشرفون حتى تعتمدها الإدارة من صفحة الحديث (قاعدة اعتماد المخرجات العلمية).
المخرج: data/sharh/dawah/<كتاب>.json = {رقم: [{w, an, sb, p, pz, f: [{k: faida|tarjih, m, q}], fst: draft|ok, at}]}
المتغيرات: DAWAH_MAX (عدد الأحاديث التي تُستخرج فوائدها في التشغيل، ٢٥)، DAWAH_AI=0 للربط وحده.
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("sharh_ai")  # يدوي فقط
import importlib.util, json, os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); H = os.path.join(D, "hadith")
OUT = os.path.join(D, "sharh", "dawah"); SHP = os.path.join(D, "shp")
ORDER = ["bukhari", "muslim", "abudawud", "nasai", "tirmidhi", "ibnmajah", "musnadahmad", "muwatta", "darimi"]
_sp = importlib.util.spec_from_file_location("sa", os.path.join(ROOT, "tools", "sharh-align.py")); SA = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(SA)
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
NUM = re.compile(r"^\s*[\d٠-٩]+\s*[-–]\s*\(([\d٠-٩]+)\)")
jl, js = SA.jl, SA.js


OWN = {}; OWNT = {}


def own_lines(sb):
    """كلام الشيخ وحده في كتاب شرحه (طلب المدير، ٢٨ نوفمبر): لا تُستخرج فوائده من أسانيد «الأصل» التي وُضعت في الحاشية
    (fna من tools/fn-asl.py)؛ وإن كان تعليقه هو الحواشي (fnLabel في الفهرس، مثل تعليق الشيخ ياسر برهامي على شرح النووي)
    فصلب الصفحة من أصل الكتاب لا من كلامه."""
    B = SA.shard(sb) or {}; A = {k for v in (B.get("fna") or {}).values() for k in v}
    cat = jl(os.path.join(D, "catalog.json")); lab = next((b.get("fnLabel") for b in cat["books"] if b["id"] == sb), None)
    F = set()
    if lab:
        for pg in B.get("pages") or []:
            m = re.search(r"^\s*_{4,}\s*$", pg or "", re.M)
            if m: F |= {l.strip()[:60] for l in pg[m.end():].split("\n") if l.strip()}
    return lambda t: t[:60] not in A and (not lab or t[:60] in F)


def hadith_index():
    """(كتاب المكتبة، الصفحة) ← [(كتاب قسم الحديث، الرقم)]، ومجموعة الأرقام لكل كتاب."""
    pg, nums = {}, {}
    for b in ORDER:
        idx = jl(os.path.join(H, "k", b + ".json"), {}) or {}
        for x in idx.get("items") or []:
            n = str(x[0]); nums.setdefault(b, set()).add(n)
            if "." not in n and len(x) > 2 and x[2]: pg.setdefault((x[1], int(x[2])), []).append((b, n))
    return pg, nums


def link_all():
    cat = jl(os.path.join(D, "catalog.json")); A = {a["id"]: a for a in cat["authors"]}
    PG, NUMS = hadith_index(); libs = {k[0] for k in PG}; LH = {}
    for (lb, _), L in PG.items(): LH.setdefault(lb, L[0][0])
    res = {}
    for f in sorted(os.listdir(SHP)):
        if not f.endswith(".json") or f.startswith("_"): continue
        P = jl(os.path.join(SHP, f)); matn = [v for v in (P or {}).get("matn", []) if v in libs]
        if not matn: continue
        U = {v: SA.units_of(SA.shard(v)["pages"]) for v in matn if SA.shard(v)}
        UI = {v: {u: i for i, (u, _) in enumerate(us)} for v, us in U.items()}
        for w in P.get("works", []):
            au = A.get(w.get("a")) or {}
            if au.get("col") != "dawah": continue  # حضور مشايخ الدعوة؛ وسائر الشروح تخدمها رحلة شرح السنة نفسها
            W = jl(os.path.join(SHP, P["id"], w["w"] + ".json"), {}) or {}
            for sb, V in (W.get("vols") or {}).items():
                raw = []
                for s in V.get("segs", []):
                    if s.get("st") not in ("ok", "auto", "moved") or not s.get("u") or s.get("m") not in UI: continue
                    v, us = s["m"], U[s["m"]]; i = UI[v].get(s["u"])
                    if i is None: continue
                    key = None
                    for j in range(i, max(-1, i - 60), -1):  # أقرب رقم حديث «٢٤٠ - (١٥٣)» قبل الموضع
                        m = NUM.match(us[j][1])
                        if m: key = m.group(1).translate(AR); break
                    hb = LH.get(v)
                    if not key or not hb or key not in NUMS.get(hb, ()):
                        L = PG.get((v, int(s["u"].split(".")[0]))) or []
                        if not L: continue
                        hb, key = L[0]
                    raw.append((s["a"], hb, key, s))
                # الاتساق: الشرح يمضي مع المتن بالترتيب، فرقمٌ يشذ عن جيرانه في الشرح (ربط خاطئ) لا يُنسب إليه
                raw.sort(key=lambda x: x[0]); f_ = lambda k: float(k) if re.match(r"^[\d.]+$", k) else -1e9
                for i, (_, hb, key, s) in enumerate(raw):
                    nb = [f_(raw[j][2]) for j in range(max(0, i - 3), min(len(raw), i + 4)) if j != i and raw[j][1] == hb]
                    if len(raw) > 3 and not any(abs(f_(key) - x) <= 12 for x in nb): continue
                    e = res.setdefault(hb, {}).setdefault(key, {})
                    r = e.setdefault((w["w"], sb), {"w": w["w"], "pj": P["id"], "a": w.get("a"), "an": au.get("name", ""), "t": w.get("t", ""), "sb": sb, "segs": []})
                    r["segs"].append([s["a"], s["z"], s["p"]])
    for hb, H_ in res.items():  # رقم معزول بعيد عن سائر ما شرحه الشارح من الكتاب (أكثر من ٤٠ حديثًا) ربطٌ شاذ
        ks = sorted(float(k) for k in H_ if re.match(r"^[\d.]+$", k))
        for k in list(H_):
            x = float(k) if re.match(r"^[\d.]+$", k) else None
            if x is not None and len(ks) > 5 and min((abs(x - y) for y in ks if y != x), default=0) > 40: H_.pop(k)
    return res


PROMPT = """أمامك حديث من {book} (رقم {n})، ونص شرح {an} له (تفريغ درس أو كتاب).
الحديث: «{matn}»

نص الشرح:
\"\"\"
{text}
\"\"\"

استخرج من نص الشرح وحده:
- أهم الفوائد (فقهية أو عقدية أو تربوية أو علمية) التي قررها الشارح — من ٢ إلى ٦.
- ترجيحات الشارح إن وجدت: كل موضع يذكر فيه خلافًا ثم يرجّح قولًا أو يختار اختيارًا.
الشرط الأهم: "q" نقل حرفي متصل من نص الشرح كما هو تمامًا (جملة أو جملتان، ٣٠–٤٠٠ حرف) بلا تغيير ولا تلخيص ولا إضافة؛ و"m" عنوان قصير للفائدة أو المسألة (لا يزيد على ١٠ كلمات) لا يضيف حكمًا.
لا تخترع شيئًا ليس في النص، ولا تنسب للشارح ما حكاه عن غيره على أنه قوله. إن لم يوجد ما يستخرج فأعد قائمة فارغة.
أخرج JSON وحده: {{"items": [{{"k": "faida" أو "tarjih", "m": "العنوان", "q": "النقل الحرفي"}}]}}
"""


def nz(s): return " ".join(SA.norm(s))


def extract(T, book, n, an, matn, text):
    out = T.gemini(PROMPT.format(book=book, n=n, an=an, matn=matn[:600], text=text[:24000]))
    if out is None: return None
    items = (out or {}).get("items") if isinstance(out, dict) else None
    full = nz(text); keep = []
    for x in items or []:
        q = str((x or {}).get("q") or "").strip().strip("«»\"")
        if not (25 <= len(q) <= 500) or len(nz(q)) < 15 or nz(q) not in full: continue  # النقل غير موجود بنصه: يُحذف
        keep.append({"k": "tarjih" if x.get("k") == "tarjih" else "faida", "m": str(x.get("m") or "")[:90], "q": q})
    return keep[:8]


def main():
    res = link_all(); os.makedirs(OUT, exist_ok=True)
    AI = os.environ.get("DAWAH_AI", "1") != "0"; MAX = int(os.environ.get("DAWAH_MAX", "25")); T = None
    if AI:
        import tashjir as T  # noqa: E402  مفاتيح Gemini المحجوزة لخدمات الكتب
        T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("DAWAH_MINUTES", "40"))
        if not T.KEYS: AI = False
    made, rep, PAGES = 0, [], {}
    for hb, H_ in res.items():
        fp = os.path.join(OUT, hb + ".json"); old = jl(fp, {}) or {}; new = {}
        MT = {}
        if AI:
            import glob
            for f in sorted(glob.glob(os.path.join(H, "k", hb, "m*.json"))): MT.update(jl(f, {}))
        bt = (jl(os.path.join(H, "k", hb + ".json"), {}) or {}).get("t", hb)
        for n in sorted(H_, key=lambda x: float(x) if re.match(r"^[\d.]+$", x) else 0):
            arr = []
            for (wid, sb), r in H_[n].items():
                segs = sorted(r["segs"]); prev = next((o for o in old.get(n, []) if o.get("w") == wid and o.get("sb") == sb), {})
                e = {"w": wid, "pj": r["pj"], "a": r["a"], "an": r["an"], "t": r["t"], "sb": sb, "p": segs[0][2], "pz": max(x[2] for x in segs), "segs": [x[:2] for x in segs]}
                for k in ("f", "fst", "at", "fby", "fx"):
                    if k in prev: e[k] = prev[k]
                if e.get("f"):  # تدقيق النسبة: ما نُقل من أصل الكتاب (شرح النووي أو أسانيد مسلم) لا من كلام الشيخ يُنقل إلى fx بسببه، ولا يُحذف
                    if sb not in OWNT:
                        if sb not in PAGES: PAGES[sb] = SA.paras_of(SA.shard(sb)["pages"]); OWN[sb] = own_lines(sb)
                        OWN.setdefault(sb, own_lines(sb)); OWNT[sb] = nz("\n".join(t for _, t in PAGES[sb] if OWN[sb](t)))
                    ok_ = [x for x in e["f"] if nz(x.get("q", "")) in OWNT[sb]]
                    if len(ok_) < len(e["f"]):
                        e.setdefault("fx", []).extend(dict(x, why="من أصل الكتاب لا من كلام الشيخ") for x in e["f"] if x not in ok_)
                        rep.append("- %s:%s: نُقلت %d فائدة من أصل الكتاب إلى المستبعد" % (hb, n, len(e["f"]) - len(ok_)))
                        if ok_: e["f"] = ok_
                        elif e.get("fst") != "ok": [e.pop(k, None) for k in ("f", "fst", "at")]  # تُستخرج من جديد من كلام الشيخ وحده
                if AI and "f" not in e and made < MAX and not (T.KEYS and len(T.EXH) >= max(1, len(T.KEYS) // 2)) and time.time() < T.DEADLINE[0]:
                    if sb not in PAGES: PAGES[sb] = SA.paras_of(SA.shard(sb)["pages"]); OWN[sb] = own_lines(sb)
                    text = "\n".join(PAGES[sb][i][1] for a, z in e["segs"] for i in range(a, min(z + 1, len(PAGES[sb]))) if OWN[sb](PAGES[sb][i][1]))
                    if len(nz(text)) < 40: continue  # لا كلام للشيخ في المقطع (أصل الكتاب وحده)
                    f = extract(T, bt, n, r["an"], re.sub(r"[ً-ْٰ]", "", MT.get(n, "")), text)
                    if f is not None:
                        e.update(f=f, fst="draft", at=time.strftime("%Y-%m-%d")); made += 1
                        rep.append("- %s:%s (%s): %d فائدة/ترجيح" % (hb, n, r["an"], len(f)))
                arr.append(e)
            new[n] = arr
        for n, arr in old.items():  # ما أضافته الإدارة يدويًّا أو ما لم يعد مربوطًا ويحمل فوائد معتمدة يبقى
            if n not in new: new[n] = [o for o in arr if o.get("fst") == "ok" or o.get("man")]
            if not new[n]: new.pop(n)
        js(fp, new)
        print("%s: %d حديثًا عليه شرح من مشايخ الدعوة" % (hb, len(new)), flush=True)
    print("\n".join(rep) or "لا استخراج في هذا التشغيل"); print("استُخرجت فوائد", made, "حديثًا")


if __name__ == "__main__":
    main()
