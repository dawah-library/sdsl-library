#!/usr/bin/env python3
"""موسوعة الطلائع: بناء الدروس بلا نموذج. يقرأ tools/talaea_lessons/*.json،
ويتحقق أن كل نص منقول (ty=نقل) موجود حرفيًا في صفحة الكتاب المذكورة، ثم يكتب
data/mawsua/talaea/e/<id>.json ويحدّث _tree.json و_index.json. لا حذف: إضافة وتحديث فقط."""
import json, glob, os, re, sys
R = "data/mawsua/"
def norm(s): return re.sub(r"\s+", " ", s).strip()
def page(b, p):
    d = json.load(open(f"data/books/{b}.json", encoding="utf-8"))
    return norm(d["pages"][p - 1]) if 0 < p <= len(d["pages"]) else ""
def build():
    tree = json.load(open(R + "talaea/_tree.json", encoding="utf-8"))
    cells = {f["cell"]: f for b in tree["b"] for f in b["f"]}
    bad = 0
    for fn in sorted(glob.glob("tools/talaea_lessons/*.json")):
        L = json.load(open(fn, encoding="utf-8"))
        cell = cells[L["cell"]]
        for s in L["s"]:
            for p in s["p"]:
                if p.get("ty") == "نقل":
                    src = L["src"][p["c"][0]]
                    if norm(p["t"]) not in page(src["b"], src["p"]):
                        print("FAIL نقل غير مطابق:", L["id"], p["t"][:40]); bad += 1
        if bad: continue
        e = {"id": L["id"], "t": L["t"], "bab": L["band"], "fasl": cell["t"], "lead": L["lead"], "s": L["s"],
             "src": L["src"], "see": L.get("see", []), "age": L["age"], "ok": 1, "auto": 0, "built": L["built"]}
        os.makedirs(R + "talaea/e", exist_ok=True)
        json.dump(e, open(R + f"talaea/e/{L['id']}.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        ms = [m for m in cell["m"] if m["id"] != L["id"]]
        ms.append({"id": L["id"], "t": L["t"], "kw": L.get("kw", []), "e": 1, "ok": 1}); cell["m"] = ms
        cell["lessons"] = len(ms); cell["st"] = "published"
    if bad: sys.exit(1)
    tree["ok"] = 1; tree["status"] = "published"
    json.dump(tree, open(R + "talaea/_tree.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n = sum(len(f["m"]) for b in tree["b"] for f in b["f"])
    I = json.load(open(R + "_index.json", encoding="utf-8"))
    it = next((x for x in I["items"] if x["k"] == "talaea"), None)
    if not it:
        it = {"k": "talaea", "n": "موسوعة الطلائع", "d": "موسوعة تربوية للأعمار ٦–٢٠ سنة: العقيدة والفقه والسيرة والحديث والأخلاق والتربية والتراجم والقصص والأدب والدعوة والمنهج والثقافة العامة والتقنية والذكاء الاصطناعي", "ic": "🌱"}
        I["items"].append(it)
    it.update({"bab": len(tree["b"]), "m": n, "e": n, "ok": n, "rev": 0})
    json.dump(I, open(R + "_index.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("lessons", n)
if __name__ == "__main__": build()
