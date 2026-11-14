#!/usr/bin/env python3
"""موسوعة آثار السلف (#/athar): وصايا الصحابة والتابعين ومن بعدهم إلى نهاية القرن الثالث وأقوالهم، تُجمع من كتب المكتبة نفسها
بألفاظها، مع العزو إلى الكتاب والصفحة ورقم الأثر، وتخريج الأثر من بقية الكتب التي ورد فيها، دون تكرار.

الطريقة:
- المصادر بالأولوية (كتب السنة والاعتقاد المسندة، ثم التراجم، ثم الرقائق والتزكية) — SOURCES أدناه.
- الوحدة: الأثر المرقم «# ٣٧٦ -» في الكتب المسندة، والفقرة في غيرها.
- القائل: آخر علم من tools/athar-people.json يليه «قال/يقول/قالت» في الوحدة، فما بعده هو قوله بلفظه.
- تُستبعد الأحاديث المرفوعة (قال رسول الله ﷺ…)، وما قصر أو طال جدًا، وكلام المصنف والمحقق.
- الموضوعات بمعجم ألفاظ لكل باب (TOPICS)، وقد يقع الأثر في بابين.
- التكرار: يُعرف بتقارب الألفاظ لنفس القائل؛ فيُحفظ أول ما ورد (بأولوية المصدر) وتصير بقية المواضع تخريجًا له.
المخرجات: data/athar/_index.json (الأعلام والأبواب والعدد والمصادر) وdata/athar/<باب>.json (المواد).
"""
import json, os, re, sys, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "athar")
CAND_DIR = os.path.join(ROOT, "tools", "athar")

# (المعرّف، الوصف) بالأولوية: كتب السنة والاعتقاد أولًا ثم التراجم ثم الرقائق
SOURCES = [
    ("darimi", "سنة"), ("adabmufrad", "سنة"), ("ibnabishayba-v07", "سنة"), ("ibnabishayba-v06", "سنة"), ("ibnabishayba-v05", "سنة"),
    ("abdrazzaq-v11", "سنة"), ("abdrazzaq-v10", "سنة"), ("shuabiman-v01", "سنة"), ("shuabiman-v02", "سنة"), ("shuabiman-v03", "سنة"),
    ("shuabiman-v04", "سنة"), ("shuabiman-v05", "سنة"), ("shuabiman-v06", "سنة"), ("shuabiman-v07", "سنة"),
    ("lalikai", "اعتقاد"), ("ibnbatta", "اعتقاد"), ("ajurrisharia", "اعتقاد"),
    ("jamibayan", "علم"), ("iqtidailm", "علم"),
    ("sifatsafwa", "تراجم"), ("tadhkirahuffaz", "تراجم")] + [("siyar-v%02d" % i, "تراجم") for i in range(1, 14)] + [
    ("jamiulum", "رقائق"), ("lataif", "رقائق"), ("mukhtasarminhaj", "رقائق"), ("madarij-v01", "رقائق"), ("madarij-v02", "رقائق"),
    ("madarij-v03", "رقائق"), ("adabshariyya-v01", "رقائق"), ("adabshariyya-v02", "رقائق"), ("adabshariyya-v03", "رقائق"), ("uyunakhbar", "رقائق")]

TOPICS = [
    ("aqeeda", "العقيدة والتوحيد والإيمان", r"التوحيد|الإيمان|يؤمن|القدر|الصفات|القرآن كلام|الرؤية|الشرك|الكفر|النفاق|المنافق|أسماء الله|عرشه|العرش|الاستواء|الجهمي|القدري|المرجئ|الخوارج|الرافض|الشيعة|الصحابة|أصحاب رسول الله|السلف"),
    ("sunna", "السنة والاتباع وذم البدع", r"السنة|سنة|البدع|بدعة|مبتدع|اتبعوا|الاتباع|اتباع|الأهواء|أهل الأهواء|الهوى|الجماعة|الفرقة|المراء|الجدال|الخصومات|الكلام في الدين|الرأي|أصحاب الرأي|الأثر|الآثار"),
    ("ilm", "العلم وطلبه وآدابه", r"العلم|العالم|العلماء|طلب|تعلم|يتعلم|المعلم|الحديث|الفقه|الفتيا|أفتى|الكتاب|حفظ|الجهل|جاهل|السؤال|لا أدري"),
    ("ibadat", "العبادات والذكر والقرآن", r"الصلاة|صلى|الصيام|صام|القرآن|قراءة|الذكر|ذكر الله|الدعاء|دعا|قيام الليل|الليل|السجود|الحج|الصدقة|تصدق|الزكاة|الاستغفار|التسبيح|المسجد|الجمعة|رمضان"),
    ("qulub", "التزكية وأعمال القلوب", r"الإخلاص|أخلص|الرياء|يرائي|النية|القلب|قلبه|القلوب|الخشية|الخوف|يخاف|الرجاء|المحبة|يحب الله|التوكل|اليقين|الصبر|الشكر|التوبة|تاب|الورع|التقوى|اتق الله|المراقبة|المحاسبة|حاسبوا|العجب|الغفلة|البكاء|الحزن|الرضا|الحياء من الله"),
    ("zuhd", "الزهد والدنيا والآخرة", r"الدنيا|الزهد|زاهد|الآخرة|الموت|الميت|القبر|الأمل|الغنى|الفقر|المال|الدرهم|الدينار|القناعة|الفناء|العمر|الأجل"),
    ("akhlaq", "الأخلاق والآداب والمعاملة", r"اللسان|الصمت|الكلام|الغيبة|النميمة|الحلم|الغضب|الصدق|الكذب|الحياء|التواضع|الكبر|الحسد|الجار|الوالدين|البر|الإخوان|الأخ|الصاحب|الصحبة|الجليس|المجالسة|حسن الخلق|الخلق|الرفق|العفو|الأمانة|الوفاء|الظلم|المؤمن"),
    ("himma", "الهمة واغتنام الوقت والعمل", r"الوقت|الساعة|ساعة|الأيام|يومك|غدا|التسويف|الهمة|العمل|يعمل|اعمل|الكسل|البطالة|الفراغ|اغتنم|بادروا|قبل أن"),
    ("targhib", "الترغيب والترهيب", r"الجنة|النار|جهنم|العذاب|الثواب|الحساب|القيامة|الميزان|الصراط|عقاب|الذنوب|الذنب|المعاصي|المعصية|الخطيئة|السيئة"),
    ("dawa", "الأمر بالمعروف والدعوة والولاة", r"المعروف|المنكر|الأمر بالمعروف|السلطان|الأمير|الإمام|الولاة|الحق|النصيحة|الفتنة|الفتن"),
]
GENERAL = ("hikam", "حكم ومواعظ جامعة")

AR = "٠١٢٣٤٥٦٧٨٩"


def nz(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or "")
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^ء-ي ]+", " ", s)


def words(s):
    return [w for w in nz(s).split() if len(w) > 1]


def load_pages(bid):
    for p in (os.path.join(ROOT, "data", "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p):
            d = json.load(open(p, encoding="utf-8"))
            return d.get("pages") or [], d.get("pl") or []
    return [], []


MARFU = re.compile(r"(رسول الله|النبي)\s*(صلى الله عليه وسلم|ﷺ)?\s*[،,]?\s*(قال|يقول|أنه قال|كان يقول|فقال)|عن النبي|عن رسول الله|سمعت رسول الله|قال رسول الله|قال النبي|قال الله تعالى|قال الله عز وجل")
TAIL = re.compile(r"\s*(\[تعليق المحقق\].*|\[ص:\s*[\d٠-٩]+\]\s*|أخرجه .{0,80}$|رواه .{0,80}$)", re.S)


def build_people():
    P = json.load(open(os.path.join(ROOT, "tools", "athar-people.json"), encoding="utf-8"))["people"]
    alias = []
    for name, tier, death, al in P:
        for a in al:
            alias.append((a, name))
    alias.sort(key=lambda x: -len(x[0]))
    info = {name: {"t": tier, "d": death} for name, tier, death, _ in P}
    # الاسم ثم «قال/يقول/قالت/كان يقول» ثم نص القول (مع تعقيب اختياري مثل «رضي الله عنه»)
    alt = "|".join(re.escape(a) for a, _ in alias)
    rx = re.compile(r"(?<![ء-ي])(" + alt + r")(?![ء-ي])(?!\s*بن\b)(?!\s*عليه السلام)(?!\s*عليه الصلاة)\s*(?:\([^)]{0,30}\))?\s*[،,]?\s*(?:رضي الله عنه[ما]*|رحمه الله|رحمة الله عليه|-\s*رحمه الله\s*-)?\s*[،,]?\s*(?:أنه\s+)?(?:قال|قالت|يقول|كان يقول|يقال)\s*[:،,]?\s*")
    amap = dict(alias)
    return rx, amap, info


def clean_quote(q):
    q = TAIL.sub("", q)
    q = re.sub(r"\[ص:\s*[\d٠-٩]+\]", " ", q)
    q = re.sub(r"\s*«?\s*\d{1,3}\s*»?\s*$", "", q)
    q = re.sub(r"[ \t]+", " ", q).strip(" ,،.-–")
    if q.startswith("«") and q.count("«") == 1 and "»" in q: q = q[1:q.rindex("»")]
    elif q.startswith('"') and q.count('"') >= 2: q = q[1:q.rindex('"')]
    q = q.strip(" \"«»")
    return q


def units(pages, numbered):
    """وحدات الآثار مع صفحتها: الآثار المرقمة («# ٣٧٦ -») أو الفقرات."""
    if numbered:
        cur, start, num = [], 1, ""
        for i, pg in enumerate(pages):
            for line in str(pg or "").split("\n"):
                m = re.match(r"^#\s*([\d٠-٩]+)\s*-\s*$", line.strip())
                if m:
                    if cur: yield start, num, " ".join(cur)
                    cur, start, num = [], i + 1, m.group(1)
                elif not re.match(r"^#\s*(\[ص|$)", line.strip()):
                    cur.append(line.strip())
        if cur: yield start, num, " ".join(cur)
    else:
        for i, pg in enumerate(pages):
            body = re.split(r"^\s*_{4,}\s*$", str(pg or ""), flags=re.M)[0]
            for para in body.split("\n"):
                if len(para) > 40: yield i + 1, "", para.strip()


def label(pl, page):
    """رقم صفحة الطبعة: أقرب رقم صحيح سابق (بعض الصفحات المستوردة رقمها «ج0 ص0»)."""
    for i in range(min(page, len(pl)) - 1, max(-1, page - 8), -1):
        l = (pl[i] or "").strip()
        if l and not re.search(r"ص\s*0$|^ج0", l): return l
    return ""


def topics_of(q):
    hits = []
    for k, n, rx in TOPICS:
        c = len(re.findall(rx, q))
        if c: hits.append((c, k))
    hits.sort(reverse=True)
    return [k for _, k in hits[:2]] or [GENERAL[0]]


def main():
    rx, amap, info = build_people()
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    B = {b["id"]: b for b in cat["books"]}
    items, by_person = [], defaultdict(list)
    stats = {}
    for bid, kind in SOURCES:
        if bid not in B: continue
        pages, pl = load_pages(bid)
        if not pages: continue
        numbered = sum(1 for p in pages[:200] if re.search(r"^#\s*[\d٠-٩]+\s*-\s*$", str(p or ""), re.M)) > 20
        n0 = len(items)
        for page, num, txt in units(pages, numbered):
            if MARFU.search(txt[-400:]) and not rx.search(txt[-400:]): continue
            ms = list(rx.finditer(txt))
            if not ms: continue
            m = ms[-1]
            who = amap[m.group(1)]
            q = clean_quote(txt[m.end():])
            if MARFU.search(q[:60]): continue  # يروي حديثًا مرفوعًا لا قوله
            if not (25 <= len(q) <= 900) or len(words(q)) < 5: continue
            if re.search(r"^(حدثنا|أخبرنا|حدثني|أخبرني|عن\s|سمعت|رأيت|كنت|كان\s|كانوا|جاء|جئت|خطبنا|بينما|بينا|أوصاني رسول|قلت|قال رجل|أتيت|دخلت|دخل|خرج|خرجنا|لما|إن رسول|أن رسول|إن النبي|أن النبي)", q): continue  # سرد وقصص وروايات لا قول
            if re.search(r"رسول الله|النبي صلى|النبي ﷺ|حدثنا|أخبرنا|\bثنا\b|\bنا\s|\bأنا\s|حدثني|أخبرني|سمعت\s", q[:160]): continue  # مرفوع أو بقية إسناد
            if re.search(r"\bقال\s+[\u0621-\u064A]+\s*(بن|:)", q[:60]): continue  # قول منقول عن غيره
            w = words(q)
            sig = set(zip(w, w[1:], w[2:]))
            dup = None
            for it in by_person[who]:
                inter = len(sig & it["_sig"])
                if inter and inter / max(1, min(len(sig), len(it["_sig"]))) > 0.6: dup = it; break
            ref = {"b": bid, "p": page, "l": label(pl, page), "n": num}
            if dup:
                if len(dup["x"]) < 6 and not any(r["b"] == bid for r in [dup["r"]] + dup["x"]): dup["x"].append(ref)
                continue
            it = {"id": "%s-%s" % (bid, num or page), "q": q, "w": who, "r": ref, "x": [], "k": topics_of(q), "_sig": sig, "u": re.sub(r"\[ص:\s*[\d٠-٩]+\]", " ", txt)[-1500:]}
            items.append(it); by_person[who].append(it)
        stats[bid] = len(items) - n0
        print("%s: %d" % (bid, stats[bid]), flush=True)
    for it in items: it.pop("_sig", None)
    os.makedirs(CAND_DIR, exist_ok=True)
    json.dump({"note": "مرشحات موسوعة الآثار قبل التحقق (tools/athar.py)؛ يتحقق منها tools/athar-ai.py", "items": items, "stats": stats},
              open(os.path.join(CAND_DIR, "cand.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("المرشحات: %d أثرًا من %d علمًا" % (len(items), len(by_person)))
    publish()


def publish():
    """ينشر المتحقق منه وحده: data/athar/<باب>.json و_index.json."""
    _, _, info = build_people()
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    B = {b["id"]: b for b in cat["books"]}
    vp = os.path.join(CAND_DIR, "verified.json")
    V = json.load(open(vp, encoding="utf-8")) if os.path.exists(vp) else {"items": {}}
    cp = os.path.join(CAND_DIR, "cand.json")
    total = len(json.load(open(cp, encoding="utf-8"))["items"]) if os.path.exists(cp) else 0
    items = [v for v in V["items"].values() if v.get("ok")]
    os.makedirs(OUT, exist_ok=True)
    tnames = dict((k, n) for k, n, _ in TOPICS); tnames[GENERAL[0]] = GENERAL[1]
    by_topic, by_person, src = defaultdict(list), defaultdict(int), defaultdict(int)
    for it in items:
        pub = {k: it[k] for k in ("id", "q", "w", "t", "k", "r", "x") if k in it}
        for k in it["k"] or [GENERAL[0]]: by_topic[k].append(pub)
        by_person[it["w"]] += 1; src[it["r"]["b"]] += 1
    for f in os.listdir(OUT):
        if f.endswith(".json") and f != "_index.json": os.remove(os.path.join(OUT, f))
    for k, L in by_topic.items():
        json.dump({"k": k, "n": tnames.get(k, k), "items": L}, open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    people = sorted(({"n": w, "t": info.get(w, {}).get("t", "b"), "d": info.get(w, {}).get("d", 0), "c": c} for w, c in by_person.items()), key=lambda x: ("stab".index(x["t"]), -x["c"]))
    idx = {"note": "موسوعة آثار السلف — tools/athar.py ثم tools/athar-ai.py", "count": len(items), "checked": len(V["items"]), "candidates": total,
           "topics": [{"k": k, "n": tnames[k], "c": len(by_topic.get(k, []))} for k in tnames],
           "people": people, "sources": [{"b": b, "c": c, "t": B.get(b, {}).get("setTitle") or B.get(b, {}).get("title", b)} for b, c in sorted(src.items(), key=lambda x: -x[1])]}
    json.dump(idx, open(os.path.join(OUT, "_index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("المنشور: %d أثرًا متحققًا منه (من %d مرشحًا، فُحص %d)" % (len(items), total, len(V["items"])))


if __name__ == "__main__":
    publish() if "--publish" in sys.argv else main()
