#!/usr/bin/env python3
"""كاشف جودة نص الكتب المصورة: يفحص كل صفحة من كل كتاب محوَّل (ocr) ويعلّم الصفحة المشوهة
(رموز دخيلة مثل «الم!ن»، وكلمات لا وجود لها في العربية، وسطور مبعثرة كلمة كلمة) فيضيفها إلى unrev
في ملف الكتاب، فيعيد التدقيق الدوري (ocr.yml ← rereview) قراءتها من صورتها بالنموذج الأقوى.
المعجم المرجعي: كلمات الكتب النصية الموثوقة في المكتبة (غير المحوَّلة آليًا).
الاستعمال: python3 tools/ocr-quality.py [--apply] [معرّفات…]
يُستورد أيضًا: from ocr_quality import page_bad (يستعمله ocr-pdf.py بعد إعادة القراءة)."""
import json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
AR = re.compile(r"[ء-ي]+")
_LEX = []


def norm(w):
    return re.sub("[إأآٱ]", "ا", w).replace("ة", "ه").replace("ى", "ي")


def lexicon():
    if _LEX: return _LEX[0]
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))
    c = collections.Counter(); n = 0
    for b in cat["books"]:
        if b.get("ocr") or n >= 160: continue
        f = os.path.join(D, "books", b["id"] + ".json")
        try: pages = json.load(open(f, encoding="utf-8"))["pages"]
        except Exception: continue
        for p in pages: c.update(norm(w) for w in AR.findall(re.sub(r"[ً-ْـ]", "", p)))
        n += 1
    _LEX.append({w for w, k in c.items() if k >= 2})
    return _LEX[0]


def score(t):
    """(نسبة الكلمات المجهولة، نسبة الرموز الدخيلة، متوسط كلمات السطر) أو None للصفحة القصيرة."""
    t = re.sub(r"[ً-ْـ]", "", re.split(r"^\s*_{4,}\s*$", t or "", flags=re.M)[0])
    ws = AR.findall(t)
    if len(ws) < 15: return None
    L = lexicon()
    unk = sum(1 for w in ws if norm(w) not in L) / len(ws)
    junk = len(re.findall(r"[ء-ي][!|<>_~^\\]|[!|<>_~^\\][ء-ي]|[ء-ي][0-9٠-٩][ء-ي]", t)) / len(ws)
    lines = [l for l in t.splitlines() if l.strip()]
    wpl = len(ws) / max(1, len(lines))
    return unk, junk, wpl, len(lines)


def page_bad(t):
    s = score(t)
    if not s: return False
    unk, junk, wpl, nl = s
    return unk > 0.2 or junk > 0.03 or (nl > 35 and wpl < 2.5)


def main():
    apply = "--apply" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    cp = os.path.join(D, "catalog.json"); cat = json.load(open(cp, encoding="utf-8"))
    rep, changed = [], 0
    for b in cat["books"]:
        if not b.get("ocr") or (only and b["id"] not in only): continue
        sp = os.path.join(D, "books", b["id"] + ".json")
        if not os.path.exists(sp): continue
        sh = json.load(open(sp, encoding="utf-8"))
        bad = [i for i, p in enumerate(sh["pages"]) if page_bad(p)]
        old = set(sh.get("unrev") or [])
        new = sorted(old | set(bad))
        if bad: rep.append("%s «%s»: %d صفحة مشوهة من %d%s" % (b["id"], b.get("title", ""), len(bad), len(sh["pages"]), " (جديدة %d)" % len(set(bad) - old) if set(bad) - old else ""))
        if apply and new != sorted(old):
            sh["unrev"] = new
            open(sp, "w", encoding="utf-8").write(json.dumps(sh, ensure_ascii=False, separators=(",", ":")))
            b["unrev"] = len(new); changed += 1
    if apply and changed:
        json.dump(cat, open(cp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("\n".join(rep) or "لا صفحات مشوهة")
    print("كتب حُدِّثت:", changed)


if __name__ == "__main__":
    main()
