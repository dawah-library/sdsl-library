#!/usr/bin/env python3
"""قضايا الفرقان بالمضمون لا بالعنوان (البند ٢٠): لكل قضية كلماتها الدالة، فتُقاس كثافة ورودها في نص كل كتاب ومقال
وفتوى من مكتبة الدعوة (لا العنوان وحده)، مع وزن أكبر لورودها في العناوين الداخلية والعنوان، وتُحفظ أعلى المواد
وأكثر صفحاتها صلة في data/furqan-match.json. القضايا: المدمجة (FURQAN في app.js) والمضافة يدويًا من الإدارة (data/furqan.json).
تشغيله: furqan.yml (عند تعديل data/furqan.json وأسبوعيًا)."""
import json, os, re, glob, math
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
def nz(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or ""); s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^ء-ي\s]", " ", s)

def builtin():
    """القضايا المدمجة من app.js: الاسم وبدائل التعبير المنتظمة."""
    src = open(os.path.join(ROOT, "app.js"), encoding="utf-8").read()
    m = re.search(r"const FURQAN=\[(.*?)\];", src)
    out = []
    for name, rx in re.findall(r'\["([^"]+)",/(.*?)/\]', m.group(1) if m else ""):
        kws = [k.strip("^$") for k in rx.split("|") if k.strip("^$")]
        out.append({"n": name, "kw": kws})
    return out

def main():
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))
    try: man = json.load(open(os.path.join(D, "furqan.json"), encoding="utf-8")).get("items", [])
    except Exception: man = []
    issues = builtin()
    for it in man:  # المضافة يدويًا (وتعديل كلمات المدمجة إن تكرر الاسم)
        kws = [nz(k).strip() for k in it.get("kw", []) if nz(k).strip()] or [nz(it["n"]).strip()]
        ex = next((x for x in issues if x["n"] == it["n"]), None)
        if ex: ex["kw"] = list(dict.fromkeys(ex["kw"] + kws))
        else: issues.append({"n": it["n"], "kw": kws, "manual": 1})
    rx = {x["n"]: re.compile("|".join(r"(?<![ء-ي])" + re.escape(k).replace(r"\ ", r"\s+") for k in x["kw"])) for x in issues}
    books = {b["id"]: b for b in cat["books"] if (b.get("col") or "dawah") == "dawah" and not b.get("demo") and not b.get("hidden")}
    try:  # المقالات والفتاوى والبيانات: في فهرسها الخاص (data/articles/index.json)، وكلها من مكتبة الدعوة إلا ما عُلّم بقسم آخر
        for x in json.load(open(os.path.join(D, "articles", "index.json"), encoding="utf-8"))["items"]:
            if (x.get("col") or "dawah") == "dawah" and not x.get("h"): books[x["id"]] = {"id": x["id"], "title": x.get("t", "")}
    except Exception: pass
    texts = {}
    for f in glob.glob(os.path.join(D, "books", "*.json")):
        bid = os.path.basename(f)[:-5]
        if bid in books:
            try: texts[bid] = json.load(open(f, encoding="utf-8")).get("pages") or []
            except Exception: pass
    for f in glob.glob(os.path.join(D, "articles", "*.json")):
        try: g = json.load(open(f, encoding="utf-8"))
        except Exception: continue
        for aid, a in g.items():
            if aid in books and isinstance(a, dict): texts[aid] = a.get("pages") or []
    # مرور واحد على كل نص: يُطبَّع مرة، وتُعدّ فيه كل القضايا (الوزن ×٣ لما في العناوين الداخلية)
    acc = {x["n"]: [] for x in issues}
    big = re.compile("|".join("(?P<g%d>%s)" % (i, rx[x["n"]].pattern) for i, x in enumerate(issues)))
    names = [x["n"] for x in issues]
    for bid, pages in texts.items():
        b = books[bid]; hits = {}; best = {}; words = 0
        for i, pg in enumerate(pages):
            if not isinstance(pg, str): continue
            for line in pg.split("\n"):
                w = 3 if line.lstrip().startswith("#") else 1; t = nz(line); words += len(t.split())
                for m in big.finditer(t):
                    k = names[int(m.lastgroup[1:])]; hits[k] = hits.get(k, 0) + w
                    pb = best.setdefault(k, {}); pb[i + 1] = pb.get(i + 1, 0) + w
        tt = nz(b.get("title", ""))
        for m in big.finditer(tt):
            k = names[int(m.lastgroup[1:])]; hits[k] = hits.get(k, 0) + 8; best.setdefault(k, {}).setdefault(1, 0)
        for k, h in hits.items():
            score = round(h * 1000 / max(words, 200) * math.log(1 + h), 2)
            if h >= 3 and score >= 1.5: acc[k].append([bid, score, max(best[k].items(), key=lambda z: z[1])[0]])
    res = {k: sorted(v, key=lambda z: -z[1])[:120] for k, v in acc.items()}
    json.dump({"note": "يولّده tools/furqan.py: [المعرّف، الدرجة، أكثر الصفحات صلة]", "issues": [{"n": x["n"], "manual": x.get("manual", 0)} for x in issues], "m": res},
              open(os.path.join(D, "furqan-match.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print({k: len(v) for k, v in res.items()})

if __name__ == "__main__":
    main()
