#!/usr/bin/env python3
"""جمل قراءة وتمارين للمستوى المتوسط في #/arabic (تعليم العربية لغير الناطقين بها، البند ٢٤).

يقتطع جملًا قصيرة تامة من مقالات مشايخ الدعوة في التزكية والسيرة والتربية (نص إلكتروني لا آلي)
بنصها كما هي مع موضعها، فلا يُكتب شيء من الذاكرة. ويُعلِّم في كل جملة حروف الجر الظاهرة
(في، إلى، على، عن) لتمرين «حرف الجر»، وتُستعمل الجملة كلها لتمرين «رتّب الكلمات».

الناتج: data/arabic-mid.json  {"v":..., "s":[{"t":نص, "a":معرّف المقال, "w":عدد الكلمات, "j":[مواضع حروف الجر]}]}
الاستعمال: python3 tools/arabic-mid.py
"""
import json, os, re, random, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATS = {"التزكية", "من نور الوحيين", "السيرة والتاريخ", "أطفالنا", "شبابنا", "المرأة والأسرة", "آداب طالب العلم",
        "التربية والسلوك", "من تراجم السلف", "فتية الإسلام", "يا باغي الخير أقبل", "الزهد والرقائق"}
JARR = {"في", "إلى", "على", "عن"}
AR = re.compile(r"^[ء-يـ ،]+$")  # حروف عربية ومسافات وفاصلة فقط (بلا أرقام ولا أقواس ولا اقتباس)
BAD = re.compile(r"صدام|أمريك|إسرائيل|يهود|نصار|حزب|انتخاب|برلمان|ثور|سياس|حكوم|رئيس|مظاهر|قتل|ذبح|إعدام|دم|كفر|كافر|شيع|رافض|علمان|ليبرال|أوروب|غرب|الاتحاد|دول|قال|يقول|رواه|حدثنا|صلى الله|رضي الله|رحمه الله|تعالى|ﷺ")
PER = 4  # أقصى عدد من المقال الواحد
LIMIT = 900


def sentences(text):
    for part in re.split(r"[.؟!\n]+", text):
        s = re.sub(r"\s+", " ", part.replace("ـ", "")).strip(" ،-–—")
        if not s or not AR.match(s) or BAD.search(s):
            continue
        w = s.replace("،", " ").split()
        if 6 <= len(w) <= 13 and all(len(x) <= 12 for x in w) and not s.startswith(("و ", "ف ")) and not any(len(x) == 1 and x not in "و" for x in w):  # لا كلمة مقطوعة (حرف منفرد)
            yield s, w


def main():
    idx = json.load(open(os.path.join(ROOT, "data/articles/index.json"), encoding="utf-8"))["items"]
    want = {}
    for i in idx:
        if i.get("fa") or i.get("col") == "ithra":
            continue
        c = (i.get("c") or "").split(" › ")[-1]
        if c in CATS:
            want.setdefault(i.get("f") or "undated", []).append(i["id"])
    out, seen = [], set()
    for f, ids in sorted(want.items()):
        p = os.path.join(ROOT, "data/articles", f + ".json")
        if not os.path.exists(p):
            continue
        data = json.load(open(p, encoding="utf-8"))
        for aid in ids:
            x = data.get(aid)
            if not x:
                continue
            n = 0
            for s, w in sentences("\n".join(x.get("pages") or [])):
                k = re.sub(r"[ً-ْـ]", "", s)
                if k in seen:
                    continue
                seen.add(k)
                toks = s.replace("،", " ").split()
                j = [i for i, t in enumerate(toks) if t in JARR]
                out.append({"t": s, "a": aid, "w": len(toks), "j": j})
                n += 1
                if n >= PER:
                    break
    random.Random(24).shuffle(out)
    # توازن: نصف الجمل فيها حرف جر على الأقل
    withj = [x for x in out if x["j"]][: LIMIT // 2]
    rest = [x for x in out if not x["j"]][: LIMIT - len(withj)]
    res = sorted(withj + rest, key=lambda x: (x["w"], x["t"]))
    for x in res:
        if not x["j"]:
            del x["j"]
    json.dump({"v": 1, "note": "جمل من مقالات مشايخ الدعوة بنصها (tools/arabic-mid.py)", "s": res},
              open(os.path.join(ROOT, "data/arabic-mid.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(res), "جملة؛ بحروف جر:", len(withj), collections.Counter(x["w"] for x in res).most_common(4))


if __name__ == "__main__":
    main()
