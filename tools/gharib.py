#!/usr/bin/env python3
"""معاني مفردات القرآن في المصحف الرقمي من كتب الغريب المعتمدة: «المفردات في غريب القرآن» للراغب الأصفهاني (mufradat)
و«عمدة الحفاظ في تفسير أشرف الألفاظ» للسمين الحلبي (umdathuffaz بعد استيراده)؛ و«السراج» مرتب بالآيات (tools/siraj.py).
الكتابان مرتبان على الجذور، فيُعرف جذر كل كلمة في المصحف من «المدونة القرآنية العربية» (Quranic Arabic Corpus، رخصة GNU GPL،
بنسخة mustafa0x/quran-morphology) ثم يُطلب الجذر في مداخل الكتاب «# جذر».
المخرج: data/quran/roots/<سورة>.json = {آية: [[هيكل الكلمة، الجذر]…]} وdata/quran/lex/<كتاب>/<رمز الحرف الأول>.json = {مفتاح الجذر: [ملف المجلد، صفحة، المدخل]}."""
import json, os, re, glob, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.join(ROOT, "data", "quran")
MORPH = os.environ.get("MORPH", "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt")
BOOKS = [("mufradat", "المفردات في غريب القرآن للراغب الأصفهاني"), ("umdathuffaz", "عمدة الحفاظ في تفسير أشرف الألفاظ للسمين الحلبي")]
DIA = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
def nk(s):  # مفتاح الجذر: بلا تشكيل ولا همزات ولا «ال»
    s = DIA.sub("", s or "").strip(); s = re.sub("[أإآٱءؤئ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^ا-ي]", "", s); return re.sub(r"^ال(?=..)", "", s) if len(s) > 3 else s
def sk(s): return re.sub("[اويى]", "", nk(s))
def roots():
    src = os.environ.get("MORPH_FILE")
    txt = open(src, encoding="utf-8").read() if src else urllib.request.urlopen(MORPH, timeout=120).read().decode("utf-8")
    W = {}
    for l in txt.splitlines():
        p = l.split("\t")
        if len(p) < 4: continue
        s, a, w, _ = map(int, p[0].split(":")); e = W.setdefault((s, a, w), ["", ""]); e[0] += p[1]
        m = re.search(r"ROOT:([^|]+)", p[3])
        if m and not e[1]: e[1] = m.group(1)
    out = {}
    for (s, a, w), (t, r) in sorted(W.items()): out.setdefault(s, {}).setdefault(str(a), []).append([nk(t), r])
    os.makedirs(os.path.join(Q, "roots"), exist_ok=True)
    for s, d in out.items(): json.dump(d, open(os.path.join(Q, "roots", "%d.json" % s), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("الجذور:", sum(len(v) for d in out.values() for v in d.values()), "كلمة")
def pages(bid):
    f = os.path.join(ROOT, "data", "books", bid + ".json")
    fs = [f] if os.path.exists(f) else sorted(glob.glob(os.path.join(ROOT, "vols", bid + "-v*.json")))
    for f in fs:
        for i, p in enumerate(json.load(open(f, encoding="utf-8")).get("pages") or []): yield os.path.basename(f)[:-5], i + 1, p if isinstance(p, str) else ""
def lex(bid):
    out, cur, started = {}, None, False
    for vid, n, pg in pages(bid):
        for l in pg.split("\n"):
            m = re.match(r"^#+\s*(.+?)\s*$", l)
            if m:
                h = m.group(1)
                if re.match(r"^(?:كتاب|باب|حرف)\s+(?:ال)?[ء-ي]+$", h) or re.match(r"^فصل", h): started = True; cur = None; continue
                k = nk(re.sub(r"\(.*?\)|[\d٠-٩\-–:.]", "", h))
                if started and 2 <= len(k) <= 5 and len(h) < 30:
                    cur = out.setdefault(k, [vid, n, ""]); continue
                if re.search(r"فهرس|الفهارس|خاتمة", h): started = False
                cur = None; continue
            if cur is not None and len(cur[2]) < 3000: cur[2] += l.strip() + "\n"
    out = {k: [v[0], v[1], v[2].strip()[:3000]] for k, v in out.items() if len(v[2].strip()) > 20}
    if out:
        D = os.path.join(Q, "lex", bid); os.makedirs(D, exist_ok=True)
        for f in glob.glob(os.path.join(D, "*.json")): os.remove(f)
        by = {}
        for k, v in out.items(): by.setdefault("%04x" % ord(k[0]), {})[k] = v  # ملف لكل حرف أول يُحمَّل عند الطلب
        for c, d in by.items(): json.dump(d, open(os.path.join(D, c + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(bid, "مداخل:", len(out))
    return len(out)
if __name__ == "__main__":
    if "--no-roots" not in sys.argv: roots()
    meta = {b: {"t": t, "n": lex(b)} for b, t in BOOKS}
    json.dump(meta, open(os.path.join(Q, "lex", "_meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
