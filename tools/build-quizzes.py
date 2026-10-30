#!/usr/bin/env python3
"""اختبارات من «سؤال وجواب» المستخرجة من نصوص الكتب (data/qa): السؤال بنصه والجواب الصحيح بنصه من الكتاب،
والبدائل أجوبة أسئلة أخرى من الكتاب نفسه. لا يُكتب شيء من خارج الكتاب. لا يمس الأسئلة التي أعدتها الإدارة يدويًا."""
import json, glob, random, re, pathlib, datetime
R = pathlib.Path(__file__).resolve().parent.parent; Q = R / "data" / "quizzes"; Q.mkdir(exist_ok=True)
cat = {b["id"]: b for b in json.loads((R / "data/catalog.json").read_text(encoding="utf-8"))["books"]}
def cut(s, n):
    s = re.sub(r"\s+", " ", s).strip(); s = re.split(r"(?<=[.؟!:])\s", s)[0] if len(s) > n else s
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"
idx = json.loads((Q / "index.json").read_text(encoding="utf-8")) if (Q / "index.json").exists() else {"v": 1, "items": []}
items = {x["b"]: x for x in idx["items"]}
for f in sorted(glob.glob(str(R / "data/qa/*.json"))):
    bid = pathlib.Path(f).stem
    if bid.startswith("_") or bid not in cat or cat[bid].get("hidden"): continue
    qa = [x for x in json.loads(open(f, encoding="utf-8").read())["items"] if len(x.get("q", "")) >= 30 and len(x.get("a", "")) >= 30 and not re.match(r"^\(?\d*\)?\s*هل\s", x["q"].strip())]
    if len(qa) < 8: continue
    out_f = Q / (bid + ".json")
    old = json.loads(out_f.read_text(encoding="utf-8")) if out_f.exists() else {"qs": []}
    manual = [q for q in old.get("qs", []) if q.get("src") != "qa"]
    rnd = random.Random(bid); qs = []
    for x in qa[:60]:
        a = cut(x["a"], 220); others = [cut(y["a"], 220) for y in qa if y is not x]
        dis = [o for o in rnd.sample(others, min(len(others), 6)) if o != a][:3]
        if len(dis) < 3: continue
        opts = dis + [a]; rnd.shuffle(opts)
        qs.append({"id": "qa" + x["id"], "type": "mcq", "lvl": "hard", "q": cut(x["q"], 400), "opts": opts, "a": a, "p": x.get("p", 1), "ok": True, "src": "qa"})
    qs.sort(key=lambda q: len(q["q"]) + len(q["a"]))
    for i, q in enumerate(qs): q["lvl"] = ("easy", "mid", "hard")[min(2, i * 3 // max(1, len(qs)))]
    allq = manual + qs
    out_f.write_text(json.dumps({"v": 1, "b": bid, "at": str(datetime.date.today()), "qs": allq}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lv = {}
    for q in allq:
        if q.get("ok"): lv[q["lvl"]] = lv.get(q["lvl"], 0) + 1
    items[bid] = {"b": bid, "n": sum(lv.values()), "lv": lv}
idx["items"] = sorted(items.values(), key=lambda x: -x["n"])
(Q / "index.json").write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(idx["items"]), "كتابًا،", sum(x["n"] for x in idx["items"]), "سؤالًا")
