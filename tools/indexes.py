#!/usr/bin/env python3
"""الفهارس الفنية الآلية لكل كتاب: الآيات، والأحاديث، والأعلام.

يقرأ data/books/<id>.json و vols/<id>.json ويكتب data/idx/<id>.json:
  {"q": [[نص الآية, العزو, الصفحة], ...], "h": [[طرف الحديث, الصفحة], ...], "a": [[العلم, [الصفحات]], ...]}
الاستعمال: python3 tools/indexes.py [معرفات...]  (بلا معرفات: الكتب التي تغيّر نصها منذ آخر فهرسة)
"""
import json, os, re, sys, glob, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "idx")
CAP = 4000
TASH = re.compile(r"[ً-ْٰـ]")
VERSE = re.compile(r"[{﴿]\s*([^{}﴿﴾]{6,600}?)\s*[}﴾]")
REF = re.compile(r"^\s*[\[(]\s*([ء-ي ]{2,20}?)\s*[:：]\s*([\d٠-٩]{1,3}(?:\s*[-–]\s*[\d٠-٩]{1,3})?)\s*[\])]")
PROPHET = re.compile(r'(?:صلى الله عليه وسلم|ﷺ|صلى الله عليه وآله وسلم)\s*[:،]?\s*(?:أنه\s+)?(?:قال|يقول|كان يقول)?\s*[:،]?\s*(?:«([^«»]{8,400})»|"([^"]{8,400})"|“([^“”]{8,400})”)')
PROPHET2 = re.compile(r'(?:قال رسول الله|قال النبي|عن النبي|أن رسول الله|أن النبي)\s*(?:صلى الله عليه وسلم|ﷺ)?\s*(?:قال)?\s*[:،]?\s*(?:«([^«»]{8,400})»|"([^"]{8,400})"|“([^“”]{8,400})”)')
HONOR = re.compile(r"((?:[ء-ي]+\s+){1,5})(?:رحمه|رحمها) الله|((?:[ء-ي]+\s+){1,5})رضي الله (?:عنه|عنها|عنهما)(?![ء-ي])")
STOP = set("قال وقال عن وعن أن وأن إن روى وروى حديث وحديث كان وكان ذكر وذكر ذكره رواه قول وقول فقال يقول وهو هو هذا وهذا الإمام والإمام الشيخ والشيخ العلامة الحافظ شيخ الإسلام الصحابي الجليل في من إلى على حتى ثم أخرجه قاله نقله كما ما ولا لا قد فقد لقد عنها عنه أبيه أمه جده يعني أي أيضا وكذا كذا العلماء الأئمة السلف".split())
LEAD = set("ابن أبو أبي أبا أم بن عبد عبيد".split())


def clean(t): return re.sub(r"\s+", " ", TASH.sub("", t)).strip()


def name_of(chunk):
    w = [x for x in chunk.split() if x]
    # نأخذ آخر الكلمات قبل الدعاء حتى نصل إلى كلمة توقف
    out = []
    for x in reversed(w):
        if x in STOP or (x.startswith("و") and x[1:] in STOP): break
        out.insert(0, x)
        if len(out) >= 4: break
    while out and out[0] in ("بن", "و"): out.pop(0)
    if not out: return ""
    if len(out) > 1 and out[0][:1] in "لبف" and out[0][1:2] in "عأاسمحزيجخ" and len(out[0]) > 3 and out[1] in ("بن", "ابن"): out[0] = out[0][1:]
    li = next((i for i, x in enumerate(out) if x in LEAD), None)
    if li is None: out = out[-1:]
    else: out = out[max(0, li - 1):] if out[li] == "بن" else out[li:]
    if len(out) == 1 and out[0][:1] in "لب" and len(out[0]) >= 5 and out[0][1:2] in "عأاسمحزيجخ": out[0] = out[0][1:]  # بلا «ابن/أبو/بن/عبد» نأخذ الاسم الأخير وحده
    n = " ".join(out)
    if len(n) < 3 or (len(out) == 1 and len(n) < 4): return ""
    return n


def build(pages):
    q, h, a = [], [], {}
    seen_q, seen_h = set(), set()
    for i, t in enumerate(pages):
        if not t: continue
        p = i + 1
        for m in VERSE.finditer(t):
            v = clean(m.group(1))
            if not re.search(r"[ء-ي]{2}", v) or len(v.split()) < 2: continue
            r = REF.match(t[m.end():m.end() + 40]); ref = ("%s: %s" % (r.group(1).strip(), r.group(2))) if r else ""
            k = v[:60]
            if k in seen_q: continue
            seen_q.add(k); q.append([v if len(v) <= 160 else v[:160].rsplit(" ", 1)[0] + "…", ref, p])
        for rx in (PROPHET, PROPHET2):
            for m in rx.finditer(t):
                v = clean(next(g for g in m.groups() if g)); k = v[:50]
                if k in seen_h: continue
                seen_h.add(k); h.append([v if len(v) <= 140 else v[:140].rsplit(" ", 1)[0] + "…", p])
        for m in HONOR.finditer(t):
            if t.rfind("{", 0, m.start()) > t.rfind("}", 0, m.start()) or t.rfind("﴿", 0, m.start()) > t.rfind("﴾", 0, m.start()): continue  # داخل آية
            n = name_of(clean(m.group(1) or m.group(2) or ""))
            if n: a.setdefault(n, [])
            if n and (not a[n] or a[n][-1] != p): a[n].append(p)
    h.sort(key=lambda x: x[0])
    al = sorted(([n, ps] for n, ps in a.items()), key=lambda x: re.sub(r"^(ال|أبو |أبي |ابن |أم )", "", x[0]))
    return {"q": q[:CAP], "h": h[:CAP], "a": al[:CAP]}


def main():
    os.makedirs(OUT, exist_ok=True)
    want = set(sys.argv[1:])
    stamp_p = os.path.join(OUT, "_stamps.json")
    stamps = json.load(open(stamp_p)) if os.path.exists(stamp_p) else {}
    files = glob.glob(os.path.join(ROOT, "data", "books", "*.json")) + glob.glob(os.path.join(ROOT, "vols", "*.json"))
    meta = {}
    for f in files:
        bid = os.path.basename(f)[:-5]
        if want and bid not in want: continue
        raw = open(f, "rb").read(); sig = hashlib.md5(raw).hexdigest()[:12]
        if not want and stamps.get(bid) == sig and os.path.exists(os.path.join(OUT, bid + ".json")): continue
        try: pages = json.loads(raw).get("pages") or []
        except Exception: continue
        ix = build(pages)
        stamps[bid] = sig
        if not (ix["q"] or ix["h"] or ix["a"]):
            if os.path.exists(os.path.join(OUT, bid + ".json")): os.remove(os.path.join(OUT, bid + ".json"))
            continue
        json.dump(ix, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        meta[bid] = [len(ix["q"]), len(ix["h"]), len(ix["a"])]
        print(bid, *meta[bid])
    json.dump(stamps, open(stamp_p, "w"), separators=(",", ":"))
    # قائمة الكتب التي لها فهارس وأعدادها، يقرؤها القارئ ليظهر التبويب
    lp = os.path.join(OUT, "_list.json")
    lst = json.load(open(lp)) if os.path.exists(lp) else {}
    lst.update(meta)
    lst = {k: v for k, v in lst.items() if os.path.exists(os.path.join(OUT, k + ".json"))}
    json.dump(lst, open(lp, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
