#!/usr/bin/env python3
"""أحكام المحدثين المعاصرين على أحاديث السنن الأربع في قسم الحديث (البند ١٩).

المصدر: مجموعة hadith-api المفتوحة (fawazahmed0، ملك عام) وفيها أحكام الألباني (من صحيح السنن وضعيفها)
وشعيب الأرناؤوط وأحمد شاكر وبشار عواد معروف وزبير علي زئي، مرقّمة بترقيم المصنف.
لا يُقبل حكم إلا بعد التحقق من أن متن الحديث في نسخة المكتبة (data/hadith/k) هو نفسه في المصدر
(تطابق ألفاظ المتن)، فإن اختلف الرقم بُحث في الأرقام المجاورة؛ وما لم يتطابق يُترك.

الناتج: data/hadith/grades/<الكتاب>.json = {"src":..., "g": {رقم: [[المحدث، الحكم]]}}
الاستعمال: python3 tools/hadith-grades.py [مجلد فيه ara-<book>.json]   (بلا مجلد: يُنزَّل من GitHub)
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, "data", "hadith", "k")
OUT = os.path.join(ROOT, "data", "hadith", "grades")
URL = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/ara-%s.min.json"
BOOKS = ["abudawud", "tirmidhi", "nasai", "ibnmajah"]
WHO = {"Al-Albani": "الألباني", "Shuaib Al Arnaut": "شعيب الأرناؤوط", "Ahmad Muhammad Shakir": "أحمد شاكر",
       "Bashar Awad Maarouf": "بشار عواد معروف", "Zubair Ali Zai": "زبير علي زئي"}
G = {"Sahih": "صحيح", "Hasan": "حسن", "Daif": "ضعيف", "Hasan Sahih": "حسن صحيح", "Very Daif": "ضعيف جدًا",
     "Sahih Isnaad": "صحيح الإسناد", "Isnaad Sahih": "إسناده صحيح", "Hasan Isnaad": "حسن الإسناد", "Isnaad Hasan": "إسناده حسن",
     "Daif Isnaad": "ضعيف الإسناد", "Very Daif Isnaad": "ضعيف الإسناد جدًا", "Sanad Daif": "إسناده ضعيف",
     "Sahih Lighairihi": "صحيح لغيره", "Hasan Lighairihi": "حسن لغيره", "Mawdu": "موضوع", "Munkar": "منكر", "Shadh": "شاذ",
     "Batil": "باطل", "Sahih Maqtu": "صحيح مقطوع", "Sahih Muquf": "صحيح موقوف", "Sahih Isnaad Maqtu": "صحيح الإسناد مقطوع",
     "Sahih Isnaad Mauquf": "صحيح الإسناد موقوف", "Daif Maqtu": "ضعيف مقطوع", "Daif Isnaad Maqtu": "ضعيف الإسناد مقطوع",
     "Maqtu": "مقطوع", "Mauquf": "موقوف", "Mursal": "مرسل", "Sahih Isnaad Mursal": "صحيح الإسناد مرسل", "Sahih Mutawatir": "صحيح متواتر",
     "Sahih Hadith": "صحيح الحديث", "Sahih Matn": "صحيح المتن", "Hasan Sahih Isnaad": "حسن صحيح الإسناد", "Daif Munkar": "ضعيف منكر",
     "Munkar Daif": "منكر ضعيف", "Daif Muquf": "ضعيف موقوف", "Isnaad Malool": "إسناده معلول",
     "Sahih - Agreed Upon": "صحيح، متفق عليه", "Sahih - Bukhari And Muslim": "صحيح، متفق عليه", "Sahih Bukhari": "صحيح، رواه البخاري",
     "Sahih Muslim": "صحيح، رواه مسلم"}
DIA = re.compile(r"[ً-ٰٟـ‏‎]")


def nz(s):
    s = DIA.sub("", s or "")
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^ء-ي ]+", " ", s).split()


def load(b, src):
    p = os.path.join(src, "ara-%s.json" % b) if src else None
    if p and os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    with urllib.request.urlopen(URL % b, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))


def sim(m, text_tokens):
    w = [x for x in nz(m) if len(x) > 2][:14]
    if len(w) < 3:
        return 0
    return sum(1 for x in w if x in text_tokens) / len(w)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    for b in BOOKS:
        D = json.load(open(os.path.join(K, b + ".json"), encoding="utf-8"))
        items = D["items"]
        M = {}
        for i in range(0, len(items), 500):
            p = os.path.join(K, b, "m%d.json" % (i // 500))
            if os.path.exists(p):
                M.update(json.load(open(p, encoding="utf-8")))
        H = load(b, src)["hadiths"]
        by = {}
        for h in H:
            by.setdefault(int(h["hadithnumber"]), []).append(h)
        tok = {}
        out, miss, off, inv = {}, 0, 0, None
        for x in items:
            n = x[0]
            if not isinstance(n, int) and not (isinstance(n, float) and n.is_integer()):
                continue
            n = int(n)
            m = M.get(str(x[0])) or x[6] or ""
            best, bs = None, 0
            # الأرقام قد تختلف بين الطبعات بفرق يتغير تدريجيًا: يُبحث حول الرقم نفسه ثم حول آخر فرق ثبت
            for base in dict.fromkeys((n, n + off)):
                for d in (0, -1, 1, -2, 2, -3, 3, -4, 4, -6, 6, -8, 8, -12, 12):
                    for h in by.get(base + d, []):
                        t = tok.get(id(h)) or tok.setdefault(id(h), set(nz(h["text"])))
                        s = sim(m, t)
                        if s > bs:
                            best, bs = h, s
                    if bs >= 0.85:
                        break
                if bs >= 0.85:
                    break
            if (not best or bs < 0.7) and len([w for w in nz(m) if len(w) > 2]) >= 6:
                # بحث عام بالألفاظ النادرة للمتن عند اختلاف الترتيب، ويُشترط تطابق أعلى
                if inv is None:
                    inv, df = {}, {}
                    for h in H:
                        t = tok.get(id(h)) or tok.setdefault(id(h), set(nz(h["text"])))
                        for w in t:
                            inv.setdefault(w, []).append(h)
                cand = {}
                for w in sorted(set(w for w in nz(m) if len(w) > 2), key=lambda w: len(inv.get(w, ())))[:4]:
                    for h in inv.get(w, [])[:400]:
                        cand[id(h)] = h
                ok = [(abs(int(h["hadithnumber"]) - n - off), -s, h) for h in cand.values() for s in [sim(m, tok[id(h)])] if s >= 0.85]
                best, bs = (min(ok, key=lambda z: (z[0], z[1]))[2], 0.85) if ok else (None, 0)  # الأقرب موضعًا عند تكرار المتن
            if not best or bs < 0.7:
                miss += 1
                continue
            off = int(best["hadithnumber"]) - n
            g = sorted(([WHO[z["name"]], G[z["grade"].strip()]] for z in best.get("grades", []) if z["name"] in WHO and z["grade"].strip() in G), key=lambda r: list(WHO.values()).index(r[0]))
            if g:
                out[str(n)] = g
        json.dump({"src": "hadith-api (fawazahmed0، ملك عام): أحكام الألباني والأرناؤوط وشاكر ومعروف وزبير علي زئي بترقيم المصنف، بعد مطابقة المتن",
                   "g": out}, open(os.path.join(OUT, b + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(b, "أحاديث:", len(items), "بأحكام:", len(out), "لم يتطابق:", miss)


if __name__ == "__main__":
    main()
