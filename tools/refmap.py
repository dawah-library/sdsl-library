#!/usr/bin/env python3
"""الطبعة المرجعية وخريطة الترقيم (المرحلة ١، البند ٢) — المصدر الواحد لترقيم الكتب المعتمدة.

الملف: data/refmap/<معرف الكتاب أو المجموعة>.json
{
  "id": "...", "status": "draft" | "approved",          # المسودة لا تُعرض للقراء؛ المعتمدة تُشتق منها أرقام القارئ
  "ref": {"title","muhaqqiq","publisher","edition","year","vols"},   # الطبعة المرجعية
  "vols": [{"book": "<معرف مجلد المكتبة>", "part": 1,              # الجزء في المطبوع
            "runs": [[صفحة_القارئ, رقم_المطبوع, الجزء]...],       # من صفحة القارئ هذه يبدأ ترقيم متصل؛ null = بلا رقم (مقدمة/فهرس)
            "fix": {"صفحة_القارئ": "تسمية خاصة"}}],               # استثناءات فردية (لوحات، صفحات مكررة الرقم…)
  "chapters": [{"t": "عنوان الباب", "book": "...", "p": صفحة_القارئ}],  # أبواب الطبعة (اختياري)
  "by": "...", "at": "YYYY-MM-DD", "note": "..."
}

الأوامر:
  --draft <id>   ينشئ مسودة من الموجود (pl في نص الكتاب، edInfo في الفهرس) ويُعلّم الشواذ للمراجعة
  --apply        يشتق من الخرائط المعتمدة وحدها: pl في data/books|vols/<id>.json وrefEd في الفهرس (لا يمس النص)
  --check        تقرير: الخرائط وحالتها وشواذها
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data", "refmap")
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
EN = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def rd(p):
    with open(p, encoding="utf-8") as f: return json.load(f)


def wr(p, o, compact=False):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))


def shard(bid):
    for p in (f"data/books/{bid}.json", f"vols/{bid}.json"):
        q = os.path.join(ROOT, p)
        if os.path.exists(q): return q
    return None


def parse(lbl):
    """'ج1 ص3' أو '٣' ← (الجزء، الصفحة)؛ غير الصالح (ج0 ص0) ← (None, None)."""
    s = str(lbl or "").translate(AR)
    m = re.search(r"ج\s*(\d+)\D+(\d+)", s) or None
    if m: v, p = int(m.group(1)), int(m.group(2))
    else:
        m = re.search(r"(\d+)\s*$", s); v, p = None, int(m.group(1)) if m else None
    if p == 0 or v == 0: return (None, None)
    return (v, p)


def runs_of(pl):
    """يضغط تسميات الصفحات إلى مقاطع متصلة [صفحة القارئ، رقم المطبوع، الجزء]، ويعيد (runs, الجزء الغالب, شواذ).
    صفحتان للقارئ على رقم مطبوع واحد (تقسيم الشاملة) مقطعان متتاليان بالرقم نفسه، ولا تُعدّان شذوذًا."""
    runs, odd, parts, prev, pv = [], [], {}, None, None
    for i, l in enumerate(pl, 1):
        v, p = parse(l)
        if v: parts[v] = parts.get(v, 0) + 1
        if p is None:
            odd.append(i)
            if not runs or runs[-1][1] is not None: runs.append([i, None, None])
            prev = None; continue
        if prev is not None and v == pv and p == prev + 1 and runs and runs[-1][1] is not None:
            prev = p; continue
        if prev is not None and v == pv and p < prev: odd.append(i)   # رجوع في الترقيم داخل الجزء: يراجَع
        runs.append([i, p, v]); prev, pv = p, v
    part = max(parts, key=parts.get) if parts else None
    return runs, part, odd


def labels(vol, n):
    """يشتق تسمية كل صفحة قارئ من المقاطع والاستثناءات."""
    out, runs, fx = [], sorted(vol.get("runs") or [], key=lambda r: r[0]), vol.get("fix") or {}
    j = -1
    for i in range(1, n + 1):
        while j + 1 < len(runs) and runs[j + 1][0] <= i: j += 1
        if str(i) in fx: out.append(fx[str(i)]); continue
        if j < 0 or runs[j][1] is None: out.append(""); continue
        part = (runs[j][2] if len(runs[j]) > 2 else None) or vol.get("part")
        pg = runs[j][1] + (i - runs[j][0])
        out.append(f"ج{part} ص{pg}" if part else f"ص {pg}")
    return out


def draft(bid):
    cat = rd(os.path.join(ROOT, "data/catalog.json"))
    bs = [b for b in cat["books"] if b["id"] == bid or b.get("set") == bid]
    if not bs: sys.exit(f"لا يوجد كتاب أو مجموعة بالمعرف {bid}")
    bs.sort(key=lambda b: b.get("vol") or 0)
    e = next((b.get("edInfo") for b in bs if b.get("edInfo")), None) or {}
    k = next((b.get("card") for b in bs if b.get("card")), None) or {}   # بطاقة الكتاب المستخرجة من المصورة
    ref = {"title": bs[0].get("setTitle") or bs[0]["title"], "muhaqqiq": e.get("muh") or k.get("editor", ""),
           "publisher": e.get("pub") or k.get("publisher", ""), "edition": e.get("ed") or k.get("edition", ""),
           "year": k.get("year", ""), "vols": len(bs), "pages": k.get("printed_pages", "")}
    vols, review = [], []
    for b in bs:
        p = shard(b["id"]); pl = (rd(p).get("pl") if p else None) or []
        runs, part, odd = runs_of(pl) if pl else ([[1, 1, b.get("vol")]], b.get("vol"), [])
        vols.append({"book": b["id"], "part": part or b.get("vol") or None, "runs": runs, "fix": {}})
        if odd: review.append({"book": b["id"], "pages": odd[:200], "count": len(odd)})
        if not pl: review.append({"book": b["id"], "note": "لا ترقيم مطبوع في النص: يُدخل من المصورة"})
    o = {"id": bid, "status": "draft", "ref": ref, "vols": vols, "chapters": [], "review": review,
         "by": "tools/refmap.py --draft", "at": __import__("datetime").date.today().isoformat(), "note": ""}
    os.makedirs(D, exist_ok=True); out = os.path.join(D, bid + ".json")
    if os.path.exists(out) and rd(out).get("status") == "approved": sys.exit("الخريطة معتمدة؛ لا تُستبدل بمسودة")
    wr(out, o); print(out, "مواضع للمراجعة:", sum(r.get("count", 1) for r in review))


def apply():
    cat_p = os.path.join(ROOT, "data/catalog.json"); cat = rd(cat_p); byid = {b["id"]: b for b in cat["books"]}; ch = 0; ce = False
    for f in sorted(glob.glob(os.path.join(D, "*.json"))):
        m = rd(f)
        if m.get("status") != "approved": continue
        r = m.get("ref") or {}
        for v in m.get("vols") or []:
            p = shard(v["book"])
            if not p or v["book"] not in byid: print("تخطٍّ:", v["book"]); continue
            s = rd(p); n = len(s.get("pages") or [])
            pl = labels(v, n)
            if s.get("pl") != pl:
                s["pl"] = pl; wr(p, s, compact=True); ch += 1
            e = {"map": m["id"], "ed": " — ".join(x for x in (r.get("publisher"), r.get("edition")) if x), "ok": 1}
            if byid[v["book"]].get("refEd") != e: byid[v["book"]]["refEd"] = e; ce = True
    if ch or ce: wr(cat_p, cat, compact=True)
    print("مجلدات حُدّث ترقيمها:", ch)


def check():
    for f in sorted(glob.glob(os.path.join(D, "*.json"))):
        m = rd(f); print(m["id"], m.get("status"), "مجلدات:", len(m.get("vols") or []), "للمراجعة:", sum(r.get("count", 1) for r in m.get("review") or []))


if __name__ == "__main__":
    os.chdir(ROOT); a = sys.argv[1:]
    if a[:1] == ["--draft"] and len(a) > 1: [draft(x) for x in a[1:]]
    elif a[:1] == ["--apply"]: apply()
    else: check()
