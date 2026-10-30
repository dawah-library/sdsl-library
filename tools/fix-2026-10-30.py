#!/usr/bin/env python3
"""تصحيحات المحتوى (الباب الثاني ٤ من وثيقة التطوير، ٣٠ أكتوبر ٢٠٢٦).

يحفظ كل ما يُحذف أو يُعدَّل في tools/removed/2026-10-30.json لاسترجاعه عند الحاجة.
آمن عند إعادة التشغيل: ما نُفّذ لا يُنفّذ مرتين.
"""
import json, pathlib, re

R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
rd = lambda p: json.loads((D / p).read_text(encoding="utf-8"))
def wr(p, o):
    (D / p).write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

bk_path = R / "tools" / "removed" / "2026-10-30.json"
bk_path.parent.mkdir(exist_ok=True)
bk = json.loads(bk_path.read_text(encoding="utf-8")) if bk_path.exists() else {"books": [], "articles": [], "authors": [], "changes": []}
cat = rd("catalog.json")
A = {a["id"]: a for a in cat["authors"]}

# ١) الكتب التجريبية: demo=true ونصها يصرّح بأنه تجريبي
demo = [b for b in cat["books"] if b.get("demo")]
for b in demo:
    f = D / "books" / f"{b['id']}.json"
    txt = f.read_text(encoding="utf-8") if f.exists() else ""
    if txt and "نص تجريبي" not in txt:
        print("تخطٍّ: معلّم demo لكن نصه غير تجريبي:", b["id"]); continue
    bk["books"].append({"meta": b, "file": json.loads(txt) if txt else None})
    cat["books"] = [x for x in cat["books"] if x["id"] != b["id"]]
    if f.exists(): f.unlink()
    print("حُذف التجريبي:", b["id"], b["title"])
removed_ids = {x["meta"]["id"] for x in bk["books"]}

# ٢) «علم التلاوة» → أبو إدريس محمد بن عبدالفتاح (w88 هو نفسه «محمد عبد الفتاح أبو إدريس»)
ABU_IDRIS = "أبو إدريس محمد بن عبدالفتاح"
w88 = A.get("w88")
if w88 and w88["name"] != ABU_IDRIS:
    bk["changes"].append({"author": "w88", "name": w88["name"]})
    w88.setdefault("aliases", [])
    if w88["name"] not in w88["aliases"]: w88["aliases"].append(w88["name"])
    w88["name"] = ABU_IDRIS
for b in cat["books"]:
    if b["id"] == "p26b6ca3f" and b.get("authorId") != "w88":
        bk["changes"].append({"book": b["id"], "authorId": b["authorId"]}); b["authorId"] = "w88"
        print("علم التلاوة ←", ABU_IDRIS)

# ٣) توحيد «رجب أبو بسيسة»: w73 («بسيسية» + رمز اتجاه خفي) يُدمج في w53
if "w73" in A:
    w53 = A["w53"]; w53.setdefault("aliases", [])
    alias = re.sub(r"[​-‏‪-‮⁦-⁩﻿]", "", A["w73"]["name"])
    if alias not in w53["aliases"]: w53["aliases"].append(alias)
    for b in cat["books"]:
        if b.get("authorId") == "w73":
            bk["changes"].append({"book": b["id"], "authorId": "w73"}); b["authorId"] = "w53"; print("نُقل إلى w53:", b["title"])
    bk["authors"].append(A["w73"]); cat["authors"] = [a for a in cat["authors"] if a["id"] != "w73"]
    print("دُمج w73 في w53")

# ٤) التهاني والتعازي الصادرة باسم الدعوة (لا الفتاوى في حكمها)
norm = lambda s: re.sub(r"[ً-ٰٟـ]", "", s or "").replace("ة", "ه").replace("ى", "ي").translate(str.maketrans("أإآ", "ااا"))
def greeting(t):
    x = norm(t)
    return "الدعوه السلفيه" in x and (re.match(r'^"?\s*(تعزيه|تهنئه)', x) or "بخالص العزاء" in x)
idx = rd("articles/index.json")
hit = [x for x in idx["items"] if greeting(x["t"])]
groups = {}
for x in hit:
    g = groups.setdefault(x["f"], rd(f"articles/{x['f']}.json"))
    bk["articles"].append({"meta": x, "body": g.pop(x["id"], None)})
for f, g in groups.items(): wr(f"articles/{f}.json", g)
idx["items"] = [x for x in idx["items"] if not greeting(x["t"])]
wr("articles/index.json", idx)
print("حُذفت تهانٍ وتعازٍ:", len(hit))
st = rd("import-state.json")
st["skipped"] = sorted(set(st.get("skipped", [])) | {x["meta"]["id"] for x in bk["articles"]})
wr("import-state.json", st)

# ٥) آثار الكتب المحذوفة في الفهارس الجانبية
i18 = rd("i18n-cat-en.json")
for k in removed_ids | {x["meta"]["id"] for x in bk["articles"]}:
    for sec in i18.values():
        if isinstance(sec, dict): sec.pop(k, None)
wr("i18n-cat-en.json", i18)
try:
    s = rd("idx/_stamps.json")
    for k in removed_ids: s.pop(k, None)
    wr("idx/_stamps.json", s)
except FileNotFoundError: pass

import time
cat["version"] = int(time.time() * 1000)
wr("catalog.json", cat)
bk_path.write_text(json.dumps(bk, ensure_ascii=False, indent=1), encoding="utf-8")
print("النسخة الاحتياطية:", bk_path.relative_to(R))
