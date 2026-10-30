#!/usr/bin/env python3
"""كشف تكرار المؤلفين والمواد وتوحيدها (ب2-16، ب2-46 من وثيقة التطوير).

  python3 tools/dedupe.py                 # تقرير فقط → tools/dedupe-report.md
  python3 tools/dedupe.py --merge KEEP:DROP [KEEP:DROP ...]   # دمج بعد التحقق من الهوية

قواعد التطابق نفسها في manage.js (تبويب «التكرار والتوحيد»):
- الاسم نفسه بعد إزالة الألقاب والتشكيل ورموز الاتجاه وتوحيد الهمزات والتاء المربوطة والألف المقصورة؛
- أو الاسم الأقصر (كلمتان فأكثر) كلماته كلها في الأطول مع اتفاق الاسم الأول والأخير؛
- لا يُقترح دمج قسمين مختلفين، ولا سنتي وفاة مختلفتين، ولا زوج علّمه المشرف «شخصين مختلفين» (data/dup-distinct.json).
الدمج لا يحذف: ينقل المواد، ويضيف الاسم القديم إلى aliases، ويعلّم السجل القديم mergedInto،
ويكتب العملية في data/admin-log.json (op=amerge) فيمكن فكّها من «سجل التعديلات».
"""
import json, pathlib, re, sys, datetime, random, string

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
rd = lambda p: json.loads((D / p).read_text(encoding="utf-8"))
def wr(p, o): (D / p).write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

TITLES = {"الشيخ", "الدكتور", "د", "م", "أ", "ا", "المهندس", "الإمام", "الامام", "الحافظ", "العلامة", "الأستاذ", "الاستاذ", "فضيلة", "المحقق"}
def norm(s):
    s = re.sub(r"[ً-ْٰـ‎‏‪-‮⁦-⁩﻿]", "", s or "")
    s = re.sub("[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"[.\-]", " ", s)
def toks(s): return [w for w in norm(s).split() if w not in {norm(t) for t in TITLES}]
def sameish(x, y):
    a, b = toks(x), toks(y)
    if not a or not b: return 0
    if a == b: return 2
    s, l = (a, b) if len(a) <= len(b) else (b, a)
    return 1 if len(s) >= 2 and set(s) <= set(l) and s[0] == l[0] and s[-1] == l[-1] else 0

def load():
    cat = rd("catalog.json"); idx = rd("articles/index.json")
    try: distinct = set(rd("dup-distinct.json").get("pairs", []))
    except Exception: distinct = set()
    return cat, idx, distinct

def author_pairs(cat, idx, distinct):
    cnt = {}
    for b in cat["books"]: cnt[b["authorId"]] = cnt.get(b["authorId"], 0) + 1
    for x in idx["items"]: cnt[x["a"]] = cnt.get(x["a"], 0) + 1
    A = [a for a in cat["authors"] if not a.get("mergedInto")]; out = []
    for i in range(len(A)):
        for j in range(i + 1, len(A)):
            x, y = A[i], A[j]
            if (x.get("col") or "dawah") != (y.get("col") or "dawah"): continue
            if x["id"] == y["id"]: out.append((3, x, y, cnt.get(x["id"], 0), 0)); continue
            if x.get("died") and y.get("died") and x["died"] != y["died"]: continue
            if "|".join(sorted([x["id"], y["id"]])) in distinct: continue
            k = max(sameish(n, m) for n in [x["name"]] + x.get("aliases", []) for m in [y["name"]] + y.get("aliases", []))
            if k: out.append((k, x, y, cnt.get(x["id"], 0), cnt.get(y["id"], 0)))
    return out

def item_dups(cat, idx):
    g = {}
    key = lambda t: " ".join(norm(re.sub(r"[«»\"'()\[\]،,.:؛؟!\-–—]", " ", t)).split())
    sets = set()
    for b in cat["books"]:
        if b.get("hidden"): continue
        if b.get("set"):  # مجلدات العمل الواحد ليست تكرارًا: يُعدّ العمل مرة واحدة
            if b["set"] in sets: continue
            sets.add(b["set"])
        if b.get("ed", {}).get("w"): continue  # طبعة مربوطة بعملها (ليست تكرارًا)
        g.setdefault(("b", b["authorId"], key(b.get("setTitle") or b["title"])), []).append(b["id"])
    for x in idx["items"]:
        if x.get("h"): continue
        g.setdefault(("a", x["a"], key(x["t"])), []).append(x["id"])
    return [(k, v) for k, v in g.items() if len(v) > 1 and len(k[2]) >= 4]

def report():
    cat, idx, distinct = load()
    P, I = author_pairs(cat, idx, distinct), item_dups(cat, idx)
    L = ["# تقرير التكرار", "", f"> {datetime.date.today()} — أُنشئ بـ tools/dedupe.py. الدمج من «الإدارة ← التكرار والتوحيد» بعد التحقق من الهوية.", "",
         f"## مؤلفون محتمل تكرارهم ({len(P)})", "", "| النوع | الأول | الثاني |", "|---|---|---|"]
    kind = {3: "سجل مكرر", 2: "الاسم نفسه", 1: "اسم مختصر"}
    for k, x, y, cx, cy in P: L.append(f"| {kind[k]} | {x['name']} ({x['id']}، {cx} مادة) | {y['name']} ({y['id']}، {cy} مادة) |")
    L += ["", f"## مواد بالعنوان نفسه للمؤلف نفسه ({len(I)})", ""]
    for (t, a, ti), ids in I: L.append(f"- {'كتاب' if t == 'b' else 'مقال'} «{ti}» ({a}): {'، '.join(ids)}")
    (R / "tools" / "dedupe-report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))

def merge(pairs):
    cat, idx, _ = load()
    try: log = rd("admin-log.json")
    except Exception: log = {"v": 1, "items": []}
    for p in pairs:
        keep_id, drop_id = p.split(":")
        if keep_id == drop_id:  # السجل نفسه مكرر في الفهرس
            seen = False; n0 = len(cat["authors"]); out = []
            for a in cat["authors"]:
                if a["id"] == keep_id:
                    if seen: continue
                    seen = True
                out.append(a)
            cat["authors"] = out; print(f"أُزيل {n0 - len(out)} سجل مكرر للمؤلف {keep_id}")
            log["items"].insert(0, entry("file", [keep_id], [{"id": keep_id, "kind": "author", "field": "create", "from": "سجلان", "to": "سجل واحد"}], f"إزالة سجل مكرر للمؤلف «{a_name(cat, keep_id)}»"))
            continue
        k = next(a for a in cat["authors"] if a["id"] == keep_id); d = next(a for a in cat["authors"] if a["id"] == drop_id)
        if d.get("mergedInto"): print("مدموج سابقًا:", drop_id); continue
        ch = [{"id": drop_id, "kind": "author", "field": "mergedInto", "from": None, "to": keep_id}]
        for b in cat["books"]:
            if b["authorId"] == drop_id: b["authorId"] = keep_id; ch.append({"id": b["id"], "kind": "book", "field": "author", "from": drop_id, "to": keep_id})
        for x in idx["items"]:
            if x["a"] == drop_id: x["a"] = keep_id; ch.append({"id": x["id"], "kind": "article", "field": "author", "from": drop_id, "to": keep_id})
        k["aliases"] = sorted(set(k.get("aliases", []) + [d["name"]] + d.get("aliases", [])) - {k["name"]})
        for f in ("photo", "bio", "died"):
            if not k.get(f) and d.get(f): k[f] = d[f]
        d["mergedInto"] = keep_id; d["mergedAt"] = str(datetime.date.today())
        note = f"دمج المؤلف «{d['name']}» في «{k['name']}»"
        log["items"].insert(0, entry("amerge", [drop_id, keep_id], ch, note)); print(note, "—", len(ch) - 1, "مادة")
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    log["items"] = log["items"][:1000]
    wr("catalog.json", cat); wr("articles/index.json", idx); wr("admin-log.json", log)

def a_name(cat, i): return next((a["name"] for a in cat["authors"] if a["id"] == i), i)
def entry(op, ids, changes, note):
    kinds = sorted({c["kind"] for c in changes})
    return {"id": format(int(datetime.datetime.now().timestamp() * 1000), "x") + "".join(random.choices(string.ascii_lowercase + string.digits, k=4)),
            "at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"), "by": {"role": "tool", "uid": "dedupe"},
            "op": op, "kind": "+".join(kinds), "ids": ids, "changes": changes, "note": note}

def hide_identical(th=0.97):
    """المقالات المعادة نشرها بنصها (مثل «من تراث الدعوة»): يُخفى المتأخر ويبقى الأقدم. الإخفاء قابل للاستعادة."""
    import difflib
    cat, idx, _ = load(); by = {x["id"]: x for x in idx["items"]}; G = {}
    def body(i):
        f = by[i]["f"]; G.setdefault(f, rd(f"articles/{f}.json")); return " ".join(" ".join(G[f].get(i, {}).get("pages", [])).split())
    num = lambda i: int(re.sub(r"\D", "", i) or 0)
    try: log = rd("admin-log.json")
    except Exception: log = {"v": 1, "items": []}
    ch = []
    for (t, a, ti), ids in item_dups(cat, idx):
        if t != "a": continue
        ids = sorted(ids, key=num)  # أرقام صوت السلف تتزايد بتاريخ النشر؛ والتاريخ قد يغيب عن الأقدم
        keep = body(ids[0])
        for o in ids[1:]:
            r = difflib.SequenceMatcher(None, keep[:3000], body(o)[:3000]).ratio()
            if r >= th and abs(len(keep) - len(body(o))) < 0.03 * len(keep):
                by[o]["h"] = True; ch.append({"id": o, "kind": "article", "field": "hidden", "from": False, "to": True}); print(f"إخفاء {o} (مطابق {ids[0]} بنسبة {r:.2f}): {by[o]['t']}")
    if ch:
        log["items"].insert(0, entry("hide", [c["id"] for c in ch], ch, f"إخفاء {len(ch)} مقالًا معاد النشر بنصه (يبقى الأقدم)"))
        wr("articles/index.json", idx); wr("admin-log.json", log)

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--merge": merge(sys.argv[2:])
    if len(sys.argv) > 1 and sys.argv[1] == "--hide-identical": hide_identical()
    report()
