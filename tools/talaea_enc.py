#!/usr/bin/env python3
"""موسوعة الطلائع: بناء الدروس بلا نموذج. يقرأ tools/talaea_lessons/*.json،
ويتحقق أن كل نص منقول (ty=نقل) موجود حرفيًا في صفحة الكتاب المذكورة، ثم يكتب
data/mawsua/talaea/e/<id>.json ويحدّث _tree.json و_index.json. لا حذف: إضافة وتحديث فقط."""
import json, glob, os, re, sys
R = "data/mawsua/"
# ملف الأسلوب لكل مرحلة (آلي دائم): كل درس جديد أو مُثرى يمر بهذه الفحوص قبل النشر.
# max_sent: أقصى متوسط كلمات الجملة في كلام المحرر، max_quote: أقصى كلمات النص المنقول الواحد،
# max_share: أقصى نسبة للمنقول من كلمات الدرس، need_parent: قسم «للوالدين» إلزامي، need_task: قسم نشاط/تفكير إلزامي.
AGE = {
 "6-9":   {"id": "a1", "max_sent": 12, "max_quote": 25,  "max_share": .30, "need_parent": True,  "ic": "baby",           "hue": 28,  "name": "من 6 إلى 9 سنوات"},
 "9-12":  {"id": "a2", "max_sent": 16, "max_quote": 45,  "max_share": .40, "need_parent": True,  "ic": "backpack",       "hue": 165, "name": "من 9 إلى 12 سنة"},
 "12-15": {"id": "a3", "max_sent": 22, "max_quote": 70,  "max_share": .50, "need_parent": False, "ic": "graduation-cap", "hue": 215, "name": "من 12 إلى 15 سنة"},
 "15-20": {"id": "a4", "max_sent": 30, "max_quote": 130, "max_share": .60, "need_parent": False, "ic": "trophy",         "hue": 265, "name": "من 15 إلى 20 سنة"},
}
FIELD_IC = {"aqeeda": "shield-check", "fiqh": "scale", "sira": "footprints", "hadith": "quote", "akhlaq": "heart-handshake", "tarbiya": "sprout", "tarajim": "circle-user", "qasas": "book-open", "adab": "pen-line", "dawa": "megaphone", "manhaj": "compass", "thaqafa": "lightbulb", "tiqnia": "zap", "ai": "bot"}
def words(t): return len(t.split())
def style_check(L):
    """يعيد قائمة مشكلات الأسلوب للمرحلة؛ فارغة = مقبول."""
    A = AGE[L["age"]]; bad = []; own = []; q = 0
    for s in L["s"]:
        for p in s["p"]:
            if p.get("ty") == "نقل":
                w = words(p["t"]); q += w
                if w > A["max_quote"]: bad.append(f"منقول طويل ({w} كلمة) لهذه المرحلة")
            else: own.append(p["t"])
    sents = [x for t in own + [L["lead"]] for x in re.split(r"[.؟!:]", t) if x.strip()]
    avg = sum(words(x) for x in sents) / max(1, len(sents))
    if avg > A["max_sent"]: bad.append(f"متوسط الجملة {avg:.1f} كلمة (الحد {A['max_sent']})")
    tot = q + sum(words(t) for t in own)
    if tot and q / tot > A["max_share"]: bad.append(f"نسبة المنقول {q/tot:.0%} (الحد {A['max_share']:.0%})")
    hs = [s["h"] for s in L["s"]]
    if A["need_parent"] and not any(h.startswith("للوالدين") for h in hs): bad.append("قسم «للوالدين» مفقود")
    if not any(h.startswith(("للتفكير", "للتطبيق", "نشاط")) for h in hs): bad.append("قسم نشاط/تفكير مفقود")
    return bad
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
        sb = style_check(L)
        if sb:
            print("FAIL أسلوب المرحلة:", L["id"], "؛ ".join(sb)); bad += 1; continue
        e = {"id": L["id"], "t": L["t"], "bab": L["band"], "fasl": cell["t"], "lead": L["lead"], "s": L["s"],
             "src": L["src"], "see": L.get("see", []), "age": L["age"], "ic": AGE[L["age"]]["ic"], "ok": 1, "auto": 0, "built": L["built"]}
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
