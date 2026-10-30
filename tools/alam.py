#!/usr/bin/env python3
"""فهرس الأعلام والرواة (ب2-21 … ب2-36 من وثيقة التطوير) → data/alam/

يبنيه من كتب التراجم والجرح والتعديل الموجودة في المكتبة نفسها (لا من مصادر خارجية ولا بتوليد آلي):
  - كل ترجمة: اسم العلم كما في عنوانها، ومقطع حرفي من أولها (لا يُعاد صياغته)، وعبارة الوفاة إن وردت، وموضعها (الكتاب والصفحة).
  - كتب الجرح والتعديل (التقريب، الكاشف، الميزان، الجرح والتعديل، تهذيب التهذيب): عبارة الحكم كما وردت بنصها مع عزوها.
  - مواضع ذكر العلم في كتب المكتبة: من فهارس الأعلام الآلية (data/idx، tools/indexes.py).
  - التراجم الموسعة لمشايخ الدعوة (data/tarajim.json) ومؤلفو المكتبة (data/catalog.json).
الربط بين الاسم المحدد في القارئ والترجمة آلي بتطابق الاسم؛ فإن تعددت الاحتمالات تُعرض كلها ولا يُجزم بواحد (ب2-36)،
ويُميَّز في الواجهة بين النص المنقول من المصدر وبين الربط الآلي (ب2-34).

الملفات: data/alam/<حرف>.json = {"k": {مفتاح: [معرّفات]}, "e": {معرّف: ترجمة}, "m": {مفتاح: [[كتاب, [صفحات]], …]}}
والحرف أول حرف من الاسم بعد «أبو/ابن/ال». والواجهة: words.js (التعريف بالعلم) و#/alam.
"""
import json, os, re, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "alam")
DI = re.compile(r"[ً-ْٰـ]")

# المصادر: (معرّف العمل في الفهرس، الوصف، النوع) — ما لم يُستورد بعد يُتخطى، ويُضم تلقائيًا عند استيراده
SOURCES = [
    ("siyar", "سير أعلام النبلاء للذهبي", "t"),
    ("istiab", "الاستيعاب في معرفة الأصحاب لابن عبد البر", "s"),
    ("isaba", "الإصابة في تمييز الصحابة لابن حجر", "s"),
    ("tahdhibtahdhib", "تهذيب التهذيب لابن حجر", "j"),
    ("taqrib", "تقريب التهذيب لابن حجر", "j"),
    ("kashif", "الكاشف للذهبي", "j"),
    ("mizan", "ميزان الاعتدال للذهبي", "j"),
    ("jarhtadil", "الجرح والتعديل لابن أبي حاتم", "j"),
    ("aclamsalaf", "من أعلام السلف", "t"),
]
# ألفاظ الجرح والتعديل (الأقوى أولًا داخل كل مرتبة)؛ تُستخرج العبارة كما وردت
JARH = r"(?:ثقة ثقة|ثقة ثبت|ثقة حافظ|ثقة متقن|ثقة|ثبت|حجة|إمام حافظ|صدوق له أوهام|صدوق يخطئ|صدوق يهم|صدوق سيء الحفظ|صدوق|لا بأس به|ليس به بأس|مقبول|مستور|مجهول الحال|مجهول|لين الحديث|لين|ضعيف جدا|ضعيف|منكر الحديث|متروك الحديث|متروك|واه|ليس بثقة|ليس بشيء|كذاب|يضع الحديث|متهم بالكذب|متهم|وثقه[^.،\n]{0,30}|ضعفه[^.،\n]{0,30}|صحابي)"
JARH_RX = re.compile(r"(?:^|[\s،:.(])(" + JARH + r")(?=[\s،.)]|$)")
GRADE = [("ثقة|ثبت|حجة|إمام|وثقه", "توثيق"), ("صدوق|لا بأس|ليس به بأس|مقبول", "توسط"), ("مستور|مجهول", "جهالة"), ("لين|ضعيف|ضعفه|منكر|واه|ليس بشيء|ليس بثقة", "تضعيف"), ("متروك|كذاب|يضع|متهم", "ترك"), ("صحابي", "صحبة")]
DEATH = re.compile(r"((?:مات|توفي|تُوفي|وفاته|توفى|قتل|استشهد)[^.\n]{0,30}?سنة\s+[^\n.،؛]{3,45})")
NAME_CUT = re.compile(r"\s(?:قدم|مذكور|يعد|يُعد|روى|ويقال|له\s|كان|شهد|من\s|أسلم|يكنى|هو\s|قيل|أمه|وهو|نزل|سكن|حديثه|في\s|ذكره|لم\s|لا\s|اختلف|أدرك|ولد|أحد\s|صحابي|الإمام\s|الحافظ\s|العلامة\s|الشيخ\s|صاحب\s|مولى\s|حليف\s)")


def norm(s):
    s = DI.sub("", s or "")
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^ء-ي\s]", " ", s)
    s = re.sub(r"\bعبد\s+", "عبد", s)
    s = re.sub(r"\b(ابي|ابا)\b", "ابو", s)
    return " ".join(s.split())


def shard_of(key):
    t = key.split()
    w = t[1] if len(t) > 1 and t[0] in ("ابو", "ابن", "ام", "بنت") else t[0]
    w = w[2:] if w.startswith("ال") and len(w) > 3 else w
    return (w[:2] if len(w) > 1 else w + "_") if w else "__"


def pack_of(eid):  # «taqrib.1.2445» → «taqrib.1.6»؛ و«lib.a1» → «lib»
    p = eid.split(".")
    return p[0] if len(p) < 3 else "%s.%s.%d" % (p[0], p[1], int(p[2]) // 400)


def fname(c):  # اسم الملف بالرموز الست عشرية (كفهرس المعاني data/gloss)
    return "-".join("%04x" % ord(x) for x in c)


def clean_name(h):
    h = re.sub(r"^\s*(?:[\d٠-٩]+\s*[-–]?\s*)+", "", h)  # أرقام التراجم (وأكثر من رقم في الميزان)
    h = re.sub(r"\(\s*\d+\s*\)", "", h)                     # أرقام الحواشي
    h = re.sub(r"\*?\s*\([^)]{0,30}\)\s*$", "", h)          # رموز الكتب الستة (ع) (خ، د)
    h = h.replace("*", "").strip(" -–،:")
    m = NAME_CUT.search(" " + h)
    if m and m.start() > 6: h = h[:m.start() - 1]
    return " ".join(h.split()[:9])


def keys_for(name):
    t = norm(name).split()
    if not t: return []
    ks = {" ".join(t[:n]) for n in (2, 3, 4) if len(t) >= n and t[n - 1] not in ("بن", "ابن", "ابو", "ام", "بنت")} | {" ".join(t)}
    nis = [w for w in t[1:] if w.startswith("ال") and len(w) >= 5 and w not in ("الله", "الرحمن", "الدين")]
    for w in nis:  # النسبة واللقب: «الثوري»، و«سفيان الثوري»
        ks.add(w)
        if t[0] not in ("ابو", "ابن", "ام"): ks.add(t[0] + " " + w)
    for i, w in enumerate(t[:-1]):                         # الكنية أينما وردت: أبو هريرة
        if w in ("ابو", "ام") and i + 1 < len(t): ks.add(w + " " + t[i + 1])
    if len(t) >= 3 and t[1] == "بن": ks.add("ابن " + t[2])  # عبد الله بن عمر → ابن عمر (مفتاح ضعيف يعرض الاحتمالات)
    return [k for k in ks if len(k) >= 5]


def load_work(cat, wid):
    recs = sorted([b for b in cat["books"] if b.get("set") == wid or b["id"] == wid], key=lambda b: b.get("vol") or 0)
    out = []
    for b in recs:
        f = os.path.join(ROOT, "vols", b["id"] + ".json") if b.get("vf") else os.path.join(DATA, "books", b["id"] + ".json")
        if os.path.exists(f):
            try: out.append((b, json.load(open(f, encoding="utf-8"))))
            except Exception: pass
    return out


def entries(b, sh, kind):
    """تراجم المجلد: من عناوين «# » في الصفحات، ثم أسطر مرقمة «123- اسم…» في كتب الرجال المختصرة."""
    pages = sh.get("pages") or []; pl = sh.get("pl") or []
    flat = []  # (صفحة، سطر)
    for i, p in enumerate(pages):
        for ln in p.split("\n"): flat.append((i, ln))
    heads = [(k, i, ln[2:].strip()) for k, (i, ln) in enumerate(flat) if ln.startswith("# ")]
    if kind == "j" and len(heads) < 50:  # التقريب والكاشف: كل ترجمة سطر مرقم
        heads = [(k, i, ln.strip()) for k, (i, ln) in enumerate(flat) if re.match(r"^\s*\d{1,5}\s*[-–]\s*\S", ln)]
    out = []
    for n, (k, i, h) in enumerate(heads):
        if re.match(r"^(حرف|باب|ذكر|فصل|الطبقة|المجلد|مقدمة|تنبيه|فهرس)\b", h) or len(h) < 4: continue
        name = clean_name(h)
        if len(norm(name).split()) < 2: continue
        end = heads[n + 1][0] if n + 1 < len(heads) else min(len(flat), k + 60)
        body = "\n".join(ln for _, ln in flat[k + 1:end])[:2500]
        whole = (h + "\n" + body)
        e = {"n": name, "b": b["id"], "p": i + 1, "x": re.sub(r"\s+", " ", (h + " " + body))[:220].strip(), "L": len(body)}
        if pl and i < len(pl) and pl[i]: e["pl"] = pl[i]
        # عبارة الوفاة في الترجمة القصيرة وحدها: في التراجم الطويلة قد تكون وفاة غيره ممن ذُكر فيها (لا يُنسب إليه ما لم يثبت)
        m = DEATH.search(whole) if len(body) < 900 else None
        if m: e["d"] = m.group(1).strip()
        if kind == "j":
            hits = [x.group(1).strip() for x in JARH_RX.finditer(whole[:900])]
            if hits:
                e["r"] = list(dict.fromkeys(hits))[:4]
                e["g"] = next((g for rx, g in GRADE if re.search(rx, e["r"][0])), "")
        out.append(e)
    return out


def main():
    cat = json.load(open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    E, K, M = {}, collections.defaultdict(set), collections.defaultdict(list)
    report = []
    for wid, label, kind in SOURCES:
        vols = load_work(cat, wid)
        if not vols: report.append(f"- {label}: غير موجود في المكتبة بعد"); continue
        n0 = len(E)
        for b, sh in vols:
            for k, e in enumerate(entries(b, sh, kind)):
                eid = f"{wid}.{b.get('vol') or 0}.{k}"
                e.update({"s": wid, "t": kind}); E[eid] = e
                for key in keys_for(e["n"]): K[key].add(eid)
        report.append(f"- {label}: {len(E) - n0} ترجمة")
    # مؤلفو المكتبة وتراجم مشايخ الدعوة الموسعة
    try: TJ = json.load(open(os.path.join(DATA, "tarajim.json"), encoding="utf-8")).get("items", {})
    except Exception: TJ = {}
    for a in cat["authors"]:
        if a.get("mergedInto"): continue
        e = {"n": a["name"], "s": "lib", "t": "a", "a": a["id"]}
        if a.get("died"): e["d"] = "ت %sهـ" % a["died"]
        x = (TJ.get(a["id"]) or {}).get("brief") or a.get("bio") or ""
        if x: e["x"] = x[:300]
        if a["id"] in TJ: e["tj"] = 1
        eid = "lib." + a["id"]; E[eid] = e
        for key in keys_for(re.sub(r"^(الشيخ|الإمام|الحافظ|شيخ الإسلام|الدكتور|د\.|م\.|المهندس|العلامة)\s+", "", a["name"])) + [norm(a["name"])]: K[key].add(eid)
    # مواضع الذكر في كتب المكتبة (فهارس الأعلام)
    for f in glob.glob(os.path.join(DATA, "idx", "*.json")):
        bid = os.path.basename(f)[:-5]
        if bid.startswith("_"): continue
        try: ix = json.load(open(f, encoding="utf-8"))
        except Exception: continue
        for nm, pages in ix.get("a", []):
            k = norm(nm)
            if len(k) >= 3: M[k].append([bid, pages[:12]])
    # الكتابة مقسمة بالحرف الأول
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, "*.json")): os.remove(f)
    # المفاتيح والمواضع في ملفات صغيرة بالحرفين الأولين، والتراجم نفسها في حزم (e-<المصدر>.<المجلد>.<الحزمة>) تُجلب عند الحاجة
    shards = collections.defaultdict(lambda: {"k": {}, "m": {}})
    for key, ids in K.items():  # الأشهر أولًا (الأطول ترجمة)، وحد ٦٠ احتمالًا للمفتاح الواحد
        shards[shard_of(key)]["k"][key] = sorted(ids, key=lambda i: -(E[i].get("L") or 0))[:60]
    packs = collections.defaultdict(dict)
    for eid, e in E.items(): packs[pack_of(eid)][eid] = e
    for pk, es in packs.items():
        open(os.path.join(OUT, "e-" + pk + ".json"), "w", encoding="utf-8").write(json.dumps(es, ensure_ascii=False, separators=(",", ":")))
    for key, refs in M.items():
        shards[shard_of(key)]["m"][key] = sorted(refs, key=lambda r: -len(r[1]))[:40]
    total = 0
    for c, s in shards.items():
        txt = json.dumps(s, ensure_ascii=False, separators=(",", ":")); total += len(txt.encode())
        open(os.path.join(OUT, fname(c) + ".json"), "w", encoding="utf-8").write(txt)
    meta = {"v": 1, "sources": [[w, l, k] for w, l, k in SOURCES if load_work(cat, w)], "n": len(E), "keys": len(K), "shards": len(shards), "packs": len(packs)}
    json.dump(meta, open(os.path.join(OUT, "_meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
    report.append(f"- المجموع: {len(E)} ترجمة، {len(K)} مفتاحًا، {len(M)} اسمًا مذكورًا في الكتب، {len(shards)} ملفًا ({total // 1024} ك.ب)")
    open(os.path.join(ROOT, "tools", "alam-report.md"), "w", encoding="utf-8").write("# فهرس الأعلام\n\n" + "\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
