#!/usr/bin/env python3
"""عبارات فضل القراءة وطلب العلم في واجهة المكتبة (data/quotes.json).
كل عبارة تُقتطع بنصها من صفحة الكتاب نفسها (بين بداية ونهاية محددتين)، فلا يُكتب نص بالذاكرة،
ويُحفظ معها الكتاب والصفحة فيمكن الانتقال إلى موضعها. إن تغيّر نص الصفحة ولم توجد العبارة تُسقط وتُذكر.
الاستعمال: python3 tools/quotes.py  (أضف عبارة جديدة إلى القائمة Q ثم أعد التشغيل)."""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = "ً-ْٰـ"
MAP = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"})

def nz(s):
    """يطبّع النص ويعيد معه موضع كل حرف في الأصل."""
    out, idx = [], []
    for i, ch in enumerate(s):
        if re.match("[" + D + "]", ch):
            continue
        out.append(ch.translate(MAP)); idx.append(i)
    return "".join(out), idx

# (الكتاب، الصفحة، بداية النص، نهايته، النوع، القائل، نهاية العزو بعد النص أو "")
# النص والعزو كلاهما يُقتطعان من الصفحة؛ والقائل وصف يُكتب هنا (مثل: النبي ﷺ، معاذ بن جبل رضي الله عنه).
Q = [
    ("p1acef349", 51, "يرفع الله الذين امنوا منكم", "العلم درجات", "آية", "", "[المجادله: ١١]"),
    ("bukhari", 137, "وقل رب زدني علما", "زدني علما", "آية", "", "[طه: 114"),
    ("riyad", 356, "من سلك طريقا يلتمس فيه علما", "طريقا الي الجنه", "حديث", "النبي ﷺ", "رواه مسلم"),
    ("riyad", 357, "ان العلماء ورثه الانبياء", "اخذ بحظ وافر", "حديث", "النبي ﷺ", "رواه ابو داود والترمذي"),
    ("riyad", 356, "اذا مات ابن ادم انقطع عمله", "ولد صالح يدعو له", "حديث", "النبي ﷺ", "رواه مسلم"),
    ("p82fcc95d", 271, "نضر الله امرا سمع منا حديثا", "اوعي من سامع", "حديث", "النبي ﷺ", ""),
    ("p82fcc95d", 271, "من يرد الله به خيرا يفقهه في الدين", "يفقهه في الدين", "حديث", "النبي ﷺ", ""),
    ("tadhkirasami", 5, "تعلموا العلم فان تعلمه حسنه", "من لا يعلمه صدقه", "أثر", "معاذ بن جبل رضي الله عنه", ""),
    ("muslim", 1486, "لا يستطاع العلم براحه الجسم", "براحه الجسم", "أثر", "يحيى بن أبي كثير", ""),
    ("p0d9227b8", 129, "العلم لا يعطيك بعضه", "حتي تعطيه كلك", "قول", "", ""),
    ("uyunakhbar", 564, "تعلموا العلم فان تكونوا صغار قوم", "كبار قوم اخرين", "أثر", "عروة بن الزبير لبنيه", ""),
    ("riyad", 356, "من دعا الي هدي", "من اجورهم شيئا", "حديث", "النبي ﷺ", "رواه مسلم"),
]

def cut(raw, n, idx, s, e, start=0):
    i = n.find(nz(s)[0], start); j = n.find(nz(e)[0], i) if i >= 0 else -1
    if i < 0 or j < 0: return None, -1
    k = j + len(nz(e)[0])
    end = idx[k - 1] + 1
    while end < len(raw) and re.match("[" + D + "]", raw[end]): end += 1  # حركات آخر حرف
    return raw[idx[i]: end], k

def clean(t):
    t = re.sub(r"\(\s*[\d٠-٩]+\s*\)|\*\*|#+", "", t)  # أرقام الحواشي والوسوم
    t = re.sub(r"\s+([,،.])", r"\1", re.sub(r"\s+", " ", t))
    return t.strip(" ،,.«»\"{}﴿﴾")

def main():
    cat = json.load(open(os.path.join(ROOT, "data/catalog.json"), encoding="utf-8"))
    books = {b["id"]: b for b in cat["books"]}
    authors = {a["id"]: a for a in cat["authors"]}
    out, miss = [], []
    for bid, pg, s, e, kind, who, r in Q:
        f = os.path.join(ROOT, "data/books", bid + ".json")
        b = books.get(bid)
        if not b or not os.path.exists(f):
            miss.append((bid, pg, s, "الكتاب غير موجود")); continue
        pages = json.load(open(f, encoding="utf-8")).get("pages") or []
        if pg > len(pages) or not isinstance(pages[pg - 1], str):
            miss.append((bid, pg, s, "الصفحة غير موجودة")); continue
        raw = pages[pg - 1]; n, idx = nz(raw)
        t, k = cut(raw, n, idx, s, e)
        if t is None:
            miss.append((bid, pg, s, "العبارة غير موجودة في الصفحة")); continue
        ref = ""
        if r:
            j = n.find(nz(r)[0], k)
            if 0 <= j - k < 40: ref = clean(raw[idx[j]: idx[j + len(nz(r)[0]) - 1] + 1])
            if kind == "آية" and ref and not ref.endswith("]"): ref = "[" + ref.lstrip("[") + "]"
            if kind == "آية" and ref and not ref.startswith("["): ref = "[" + ref
        it = {"t": clean(t), "k": kind, "b": bid, "p": pg, "title": b.get("setTitle") or b.get("title"),
              "author": (authors.get(b.get("authorId")) or {}).get("name", "")}
        if who: it["who"] = who
        if ref: it["ref"] = ref
        out.append(it)
    json.dump({"note": "يولّده tools/quotes.py من نصوص الكتب؛ لا يُعدَّل يدويًا", "items": out},
              open(os.path.join(ROOT, "data/quotes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(len(out), "عبارة")
    for m in miss: print("تعذّر:", *m, file=sys.stderr)

if __name__ == "__main__":
    main()
