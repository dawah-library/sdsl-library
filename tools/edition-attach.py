#!/usr/bin/env python3
"""ربط الكتاب النصي بمصوّرة طبعته نفسها (يعمل على خوادم GitHub).

مصدر المصوّرة: «تراث» (files.turath.io/pdf/<root>/<ملف>، وبديله archive.org/download/<root>/<ملف>) وهي مصورات
الطبعة التي أُخذ منها نص المكتبة الشاملة، وترقيم صفحات النص موافق لها ("[ترقيم الكتاب موافق للمطبوع]").
يُعرف الكتاب في تراث بأحد أمرين:
  - pdfSrc في الفهرس (يكتبه tools/import-turathio.py عند الاستيراد)،
  - أو رقم الشاملة في ترخيص نسخ OpenITI ("Shamela_0025794" ← كتاب تراث 25794)، بعد التحقق من تطابق العنوان.
لكل مجلد: يُنزَّل ملفه إلى pdf/<id>.pdf، ثم يرفعه tools/r2-store.py إلى المخزن الخاص (صور الصفحات للقارئ: النص | المصورة | معًا)،
ثم يطابق tools/pdf-match.py صفحات النص بصفحات المصوّرة (الإزاحة، والصفحات المختلفة تُعلَّم للتدقيق على صورها).
ما لم يمكن ربطه بيقين (عدد الملفات لا يوافق المجلدات، أو العنوان مختلف) يُذكر في التقرير ولا يُخمَّن.

الاستعمال: python3 tools/edition-attach.py [معرّفات الكتب أو الأعمال…]   (بلا معرّفات: EA_MAX كتابًا مما لم يُربط)
الناتج: data/catalog.json (pdfSrc وedInfo؛ وpdf/img يكتبهما r2-store بعد الرفع)، وtools/edition-report.md
"""
import json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, "data", "catalog.json")
UA = {"User-Agent": "sdsl-library (dawahlibrary.org) edition matcher"}
MAX = int(os.environ.get("EA_MAX", "3"))
MAXMB = int(os.environ.get("EA_MAX_MB", "400"))
REP = []
V3META = {"ٌ": "id", "ٍ": "name", "ُ": "printed", "ِ": "pdf_links", "ّ": "info"}


def jget(u):
    try:
        return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read())
    except Exception:
        return None


def norm(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or "")
    s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return set(w for w in re.sub(r"[^ء-ي\s]", " ", s).split() if len(w) > 2 and w not in ("كتاب", "شرح", "تحقيق"))


def meta(tio):
    j = jget("https://api.turath.io/book?id=%s" % tio) or {}
    return j.get("meta") or {}


def download(root, name, dest):
    from urllib.parse import quote
    rel = quote(((root or "").strip("/") + "/" + name).strip("/"), safe="/")  # مسارات تراث عربية بمسافات
    urls = [name] if name.startswith("http") else [base + "/" + rel for base in ("https://files.turath.io/pdf", "https://archive.org/download")]
    for u in urls:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=900) as r, open(dest, "wb") as out:
                size = 0
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    size += len(b); out.write(b)
                    if size > MAXMB << 20: raise RuntimeError("أكبر من %d م.ب" % MAXMB)
            if size > 10000: return u
        except Exception as e:
            REP.append("  - تعذر %s: %s" % (u, e))
    if os.path.exists(dest): os.remove(dest)
    return None


def plan(cat, key):
    """المجلدات ← ملف المصوّرة لكلٍّ منها. key: معرّف كتاب مفرد أو عمل متعدد المجلدات (set)."""
    vols = sorted([b for b in cat["books"] if b.get("set") == key], key=lambda b: b.get("vol", 0)) or [b for b in cat["books"] if b["id"] == key]
    if not vols: return None, "غير موجود"
    b0 = vols[0]
    if all((v.get("pdfSrc") or {}).get("url") for v in vols):  # جامع الكتب: لكل جزء ملفه (import-ketab.py)
        return [(v, v["pdfSrc"]["url"]) for v in vols], dict(b0["pdfSrc"])
    src = b0.get("pdfSrc")
    if not src:
        m = re.search(r"Shamela_0*(\d+)", b0.get("license", "") + " " + (b0.get("openiti") or "").replace("Shamela", "Shamela_"))
        if not m: return None, "لا رقم للشاملة"
        mt = meta(m.group(1))
        pl = mt.get("pdf_links") or {}
        if not pl.get("files"): return None, "لا مصوّرة في تراث للكتاب %s" % m.group(1)
        a, b = norm(mt.get("name")), norm(b0.get("setTitle") or b0.get("title"))
        if not a or len(a & b) / max(1, min(len(a), len(b))) < 0.5: return None, "العنوان في تراث «%s» لا يطابق" % mt.get("name")
        src = {"tio": int(m.group(1)), "root": pl.get("root"), "files": pl["files"], "info": (mt.get("info") or "")[:600]}
    files = src.get("files") or []
    lab = [f.split("|", 1) for f in files]
    if not b0.get("pdfSrc") and len(vols) > 1:  # نسخ OpenITI الكبيرة مقسمة بالحجم لا بأجزاء المطبوع: لا ربط بالترتيب
        return None, "مجلدات المكتبة مقسمة بالحجم لا بأجزاء المطبوع؛ يُعاد استيراده من تراث (TIO) ليُربط جزءًا جزءًا"
    if len(vols) == 1 and len(files) == 2 and any(len(x) == 2 and re.search(r"مقدم", x[1]) for x in lab):
        return [(vols[0], next(x[0] for x in lab if not (len(x) == 2 and re.search(r"مقدم", x[1]))))], src
    if len(vols) == 1 and len(files) == 1: return [(vols[0], lab[0][0])], src
    named = {x[1].strip(): x[0] for x in lab if len(x) == 2}
    if named and all(str(v.get("pdfSrc", {}).get("vol") or v.get("vol")) in named for v in vols):
        return [(v, named[str(v.get("pdfSrc", {}).get("vol") or v.get("vol"))]) for v in vols], src
    body = [x for x in lab if not (len(x) == 2 and re.search(r"مقدم|فهارس|غلاف", x[1]))]
    if len(body) == len(vols): return [(v, body[i][0]) for i, v in enumerate(vols)], src
    return None, "عدد الملفات (%d) لا يوافق المجلدات (%d): %s" % (len(files), len(vols), "، ".join(files[:8]))


def main():
    try: sw = (json.load(open(os.path.join(ROOT, "data", "switches.json"), encoding="utf-8")) or {}).get("s") or {}
    except Exception: sw = {}
    if (sw.get("edition") is False or sw.get("all_jobs") is False) and not sys.argv[1:]: print("موقوف من «الخدمات والمفاتيح»"); open(os.path.join(ROOT, ".ea-ids"), "w").write(""); return
    cat = json.load(open(CAT, encoding="utf-8"))
    want = sys.argv[1:]
    if not want:  # الأقدم أولًا من كتب التراث النصية التي لا مصوّرة لها
        seen = []
        for b in cat["books"]:
            k = b.get("set") or b["id"]
            if b.get("col") == "turath" and not b.get("img") and not b.get("ocr") and not b.get("eaSkip") and (b.get("pdfSrc") or "Shamela" in (b.get("license") or "")) and k not in seen:
                seen.append(k)
        want = seen[:MAX]
    os.makedirs(os.path.join(ROOT, "pdf"), exist_ok=True)
    done = []
    for key in want:
        p, src = plan(cat, key)
        REP.append("## %s" % key)
        if not p:
            REP.append("- لم يُربط: " + src)
            for b in cat["books"]:
                if b["id"] == key or b.get("set") == key: b["eaSkip"] = src[:120]
            continue
        for b, name in p:
            dest = os.path.join(ROOT, "pdf", b["id"] + ".pdf")
            u = download(src["root"], name, dest)
            if not u: REP.append("- %s: تعذر تنزيل %s" % (b["id"], name)); continue
            b["pdfSrc"] = {**(b.get("pdfSrc") or {}), **{k: v for k, v in src.items() if k not in ("info", "url")}, "file": name}
            # لا يُكتب pdf هنا: يكتبه r2-store بعد نجاح الرفع ("r2")، فلا يشير الفهرس إلى ملف غير موجود
            done.append(b["id"]); REP.append("- %s ← %s (%.0f م.ب)" % (b["id"], u, os.path.getsize(dest) / 1e6))
        if src.get("info") and p: p[0][0].setdefault("edInfo", {"info": src["info"]})
    json.dump(cat, open(CAT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "tools", "edition-report.md"), "w", encoding="utf-8").write("# ربط الكتب بمصورات طبعاتها\n\n" + "\n".join(REP) + "\n")
    open(os.path.join(ROOT, ".ea-ids"), "w").write(" ".join(done))
    print("\n".join(REP)); print("للرفع:", " ".join(done))


if __name__ == "__main__":
    main()
