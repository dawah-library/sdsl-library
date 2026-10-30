#!/usr/bin/env python3
"""سُلّم القراءة لقسم «الطلائع» (الباب ٣٤): يختار لكل مرحلة عمرية كتبًا ومقالات من المكتبة نفسها ويرتبها مستويات.

المنهجية (تُعرض للوالدين في القسم):
  - المستكشفون الصغار (٥–٧): يقرأ الوالد للطفل: أحاديث قصيرة من الأربعين النووية، وقصص من السيرة، ومقالات أدبية قصيرة.
  - براعم المعرفة (٨–١٠): نصوص قصيرة يقرؤها الطفل بنفسه: السيرة، و«من نور الوحيين» القصيرة، والأربعون النووية.
  - رواد العلم (١١–١٣): السيرة والتراجم (من أعلام السلف)، والتزكية القصيرة، ومتون مختصرة (لمعة الاعتقاد، الآجرومية).
  - الناشئة (١٤+): «شبابنا» والتزكية وعلو الهمة والمتون (الواسطية، كتاب التوحيد، الورقات) ومقالات «مع الدعاة».
  الترتيب: الأقصر والأسهل أولًا، والتنويع بين الكتاب والمقال وبين الموضوعات، وكل مستوى نحو ٢٠–٣٠ دقيقة،
  ثم سؤال تأمل ونجوم. تُستبعد الموضوعات السياسية والخلافية والفتاوى والبيانات، والمقالات الطويلة على المراحل الصغرى.
الناتج data/tala-plan.json، ويعدّله المدير من «الإدارة ← الطلائع» (المخفي والمضاف يدويًا في data/tala.json يُحترم).
"""
import json, os, re, collections

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(R, "data")
rd = lambda p, d=None: json.load(open(os.path.join(D, p), encoding="utf-8")) if os.path.exists(os.path.join(D, p)) else d

cat = rd("catalog.json"); idx = rd("articles/index.json")["items"]; tala = rd("tala.json", {})
T = {t["id"]: t["name"] for t in cat["topics"]}
B = {b["id"]: b for b in cat["books"]}
ban = set((tala.get("planHide") or []))
BAD = re.compile(r"سياس|انتخاب|حزب|برلمان|ثور|فتنة|قتال|جهاد|إرهاب|اغتيال|شيعة|الشيعي|إلحاد|طلاق|زواج|زوج|نكاح|حيض|جماع|عورة|الحدود|الرجم|القصاص|خمر|مخدر|انتحار|تحرش|اغتصاب|حرب|غزة|مذبح|دماء|قتل|الردة|المرتد|كفر|تكفير|بدعة|الجماعات|الإخوان|داعش")
STOPTOP = {"at2", "at4", "at13", "at16", "at17", "at18", "at11", "at8", "st28"}  # قضايا معاصرة، مذاهب، حدث وتعليق، فقه الواقع، بيانات، فتاوى، العالم، المرأة والأسرة، الحجاب

def art_len(x):
    return x.get("n", 1) * 5000 if x.get("n", 1) > 1 else None

# أطوال المقالات الفعلية من ملفاتها
groups = {}
def text_of(x):
    g = groups.setdefault(x["f"], rd(f"articles/{x['f']}.json", {}))
    return " ".join((g.get(x["id"]) or {}).get("pages") or [])

POOL = {  # (موضوعات، أقصى طول بالحروف، عدد)
    "t1": (["at6", "st9", "at15"], 1800, 12),
    "t2": (["at6", "at15", "st9", "at5"], 3000, 18),
    "t3": (["at6", "at5", "at15", "at9", "st55", "st9"], 5000, 24),
    "t4": (["at9", "at5", "at7", "at15", "at6", "st55", "at1"], 8000, 30),
}
BOOKS = {  # (الكتاب، من، إلى، عنوان المستوى) — مقاطع قصيرة متدرجة
    "t1": [("arbain", 1, 81, 6), ("qisasanbiya", 1, 60, 4)],
    "t2": [("arbain", 1, 81, 5), ("fusul", 1, 68, 5), ("qisasanbiya", 1, 120, 6)],
    "t3": [("p92d51e73", 1, 200, 8), ("aclamsalaf", 1, 222, 8), ("lumca", 1, 39, 6), ("ajurrumiyya", 1, 32, 6), ("tuhfatatfal", 1, 30, 5), ("usulthalatha", 1, 40, 5)],
    "t4": [("uluwhimma", 1, 200, 10), ("wasitiyya", 1, 72, 8), ("tawhid", 1, 145, 10), ("waraqat", 1, 25, 6), ("p4289f23d", 1, 150, 10), ("ajurrihamala", 1, 123, 10), ("shamail", 1, 120, 8)],
}
LV = {"t1": 4, "t2": 4, "t3": 5, "t4": 6}  # عناصر في كل مستوى

def main():
    plan = {"v": 1, "method": __doc__.split("المنهجية (تُعرض للوالدين في القسم):")[1].split("الناتج")[0].strip(), "tracks": {}, "parents": []}
    used = set()
    for k, (tops, mx, want) in POOL.items():
        arts = []
        for x in idx:
            if x.get("h") or x.get("col") == "ithra" or x["id"] in ban or x["id"] in used or x.get("fa") or x["tp"] not in tops or x["tp"] in STOPTOP: continue
            if BAD.search(x["t"]) or re.search(r"\(\d+\)|\d+\s*[-–]\s*\d+", x["t"]) and k in ("t1", "t2"): continue  # سلاسل الحلقات للكبار
            t = text_of(x)
            if not (300 < len(t) <= mx) or BAD.search(t[:4000]): continue
            arts.append((tops.index(x["tp"]), len(t), x))
        arts.sort(key=lambda a: (a[1], a[0]))
        # تنويع الموضوعات: بالتناوب بين الموضوعات
        byt = collections.defaultdict(list)
        for a in arts: byt[a[0]].append(a)
        pick = []
        while len(pick) < want and any(byt.values()):
            for t_ in sorted(byt):
                if byt[t_] and len(pick) < want: pick.append(byt[t_].pop(0))
        per = []  # مقاطع كل كتاب، ثم التناوب بين الكتب
        for bid, a, z, step in BOOKS[k]:
            b = B.get(bid)
            if not b: continue
            z = min(z, b.get("n") or z)
            per.append([{"b": bid, "p": p, "q": min(z, p + step - 1), "m": max(5, step * 3)} for p in range(a, z + 1, step)])
        items = [x for row in __import__("itertools").zip_longest(*per) for x in row if x]
        arts_items = [{"a": x["id"], "m": max(3, round(n / 900))} for _, n, x in pick]
        for _, _, x in pick: used.add(x["id"])
        # المزج: كتاب ثم مقال بالتناوب، ثم التقسيم إلى مستويات
        seq, bi, ai = [], 0, 0
        while bi < len(items) or ai < len(arts_items):
            if bi < len(items): seq.append(items[bi]); bi += 1
            if ai < len(arts_items): seq.append(arts_items[ai]); ai += 1
        seq = seq[: LV[k] * 12]
        plan["tracks"][k] = [seq[i:i + LV[k]] for i in range(0, len(seq), LV[k])]
    # دليل الوالدين: مقالات «أطفالنا» و«التربية والسلوك»
    plan["parents"] = [x["id"] for x in sorted([x for x in idx if x["tp"] in ("at10", "st55") and not x.get("h") and not BAD.search(x["t"])], key=lambda x: x.get("d") or "")][-40:]
    json.dump(plan, open(os.path.join(D, "tala-plan.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for k, lv in plan["tracks"].items(): print(k, len(lv), "مستويات،", sum(len(l) for l in lv), "عنصرًا")
    print("دليل الوالدين:", len(plan["parents"]))

if __name__ == "__main__":
    main()
