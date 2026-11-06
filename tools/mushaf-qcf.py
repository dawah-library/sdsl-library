#!/usr/bin/env python3
"""بيانات صفحات مصحف المدينة (١٤٤١هـ) بخط عثمان طه للعرض المطابق للمطبوع: من حزمة quran-qcf4 (بياناتها برخصة MIT).
لكل صفحة أسطرها الخمسة عشر وكلماتها برموز خطوط QCF4 (مجمع الملك فهد)، فتظهر الصفحة كما في المصحف المطبوع سطرًا بسطر.
الخطوط لا تُنسخ إلى المستودع (حقوقها لمجمع الملك فهد، للعرض القرآني فقط)، وتُحمَّل من حزمتها المنشورة على jsDelivr.
المخرج: data/quran/qcf/<صفحة>.json = {"f": خط الصفحة، "l": [[ [نوع، رمز، "سورة:آية"، نص] ... ] لكل سطر]}
الأنواع: w كلمة، e رقم آية، q ربع حزب، h ترويسة سورة، b بسملة. الاستعمال: python3 tools/mushaf-qcf.py <مجلد الحزمة>"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, "data", "quran", "qcf")
T = {"word": "w", "end": "e", "quarter": "q", "surah_header": "h", "bismillah": "b"}
def main(src):
    os.makedirs(OUT, exist_ok=True); tot = 0
    for p in range(1, 605):
        d = json.load(open(os.path.join(src, "pages", "%03d.json" % p), encoding="utf-8")); L = []
        for ln in d["lines"]:
            row = []
            for w in ln["words"]:
                t = T.get(w.get("type"), "w"); it = [t, w.get("char", "")]
                if t in ("w", "e"): it += [w.get("verse_key") or "", w.get("text", "") if t == "w" else ""]
                elif t == "h": it += [str(w.get("sura") or "")]
                if w.get("font") and w["font"] != d["font"]: it.append("@" + w["font"])
                row.append(it)
            L.append(row)
        json.dump({"f": d["font"], "l": L}, open(os.path.join(OUT, "%d.json" % p), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":")); tot += 1
    print("صفحات:", tot)
if __name__ == "__main__":
    main(sys.argv[1])
