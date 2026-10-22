#!/usr/bin/env python3
"""تحويل الكتب المصورة (PDF) إلى نص بالتعرف الضوئي (Tesseract) — يعمل تلقائيًا عبر GitHub Actions.

ضع ملف PDF في مجلد ocr-inbox/ باسم: «عنوان الكتاب - اسم المؤلف.pdf»
ويمكن إرفاق ملف بنفس الاسم وامتداد .json فيه إعدادات اختيارية:
  {"title": "...", "author": "...", "topic": "t1", "col": "dawah", "offset": 0, "book": "معرف كتاب موجود", "ocr": true, "tags": ["furqan:فقه الخلاف"]}
  - book: لربط ملف PDF بكتاب نصي موجود بدل إنشاء كتاب جديد (بلا تحويل إلا إذا ocr=true)
  - offset: الفرق بين رقم صفحة النص ورقم صفحة PDF (مثلًا 4 إذا كانت صفحة النص 1 هي صفحة PDF رقم 5)
النتيجة: data/books/<id>.json + إدخال في data/catalog.json + نقل الملف إلى pdf/<id>.pdf
"""
import json, os, re, subprocess, sys, tempfile, hashlib, shutil, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX, PDFDIR, DATA = os.path.join(ROOT, "ocr-inbox"), os.path.join(ROOT, "pdf"), os.path.join(ROOT, "data")
LANG = os.environ.get("OCR_LANG", "ara")
AR = re.compile(r"[ء-ي]")


def norm(s):
    s = re.sub(r"[ً-ٰٟـ]", "", s or "")
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"^(الشيخ|الدكتور|د\.?|دكتور|م\.?|أ\.?)\s*", "", s.strip())
    return re.sub(r"(^|\s)(عبد|ابو|أبو)\s+", r"\1\2", re.sub(r"\s+", " ", s)).strip()


def pages_count(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 0


def fix_punct(t):
    t = re.sub(r"\s*,\s*", "، ", t)
    t = t.replace("?", "؟").replace(";", "؛")
    t = re.sub(r"\s+([،؛؟.:])", r"\1", t)
    return t


def clean_page(t):
    t = fix_punct(t)
    lines = [l.strip() for l in t.replace("\f", "").split("\n")]
    out, buf = [], ""
    for l in lines:
        if not l:
            if buf: out.append(buf); buf = ""
            continue
        if re.fullmatch(r"[\d٠-٩\-–—\s()]+", l):  # رقم الصفحة المطبوع
            continue
        buf = (buf + " " + l).strip() if buf else l
    if buf: out.append(buf)
    # سطر قصير منفرد في أول الصفحة غالبًا عنوان
    res = []
    for i, p in enumerate(out):
        if len(p) < 45 and len(AR.findall(p)) >= 3 and not re.search(r"[.،:؛]$", p) and i < 2:
            res.append("# " + p)
        else:
            res.append(p)
    return "\n".join(res)


def ocr(pdf, first=1, last=None):
    n = pages_count(pdf)
    last = min(last or n, n)
    pages = []
    with tempfile.TemporaryDirectory() as td:
        for p in range(first, last + 1):
            img = os.path.join(td, f"p{p}")
            subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
            r = subprocess.run(["tesseract", img + ".png", "-", "-l", LANG, "--psm", "4"], capture_output=True, text=True)
            pages.append(clean_page(r.stdout))
            print(f"  صفحة {p}/{last}: {len(pages[-1])} حرف", flush=True)
    return pages


def main():
    if not os.path.isdir(INBOX):
        print("لا يوجد مجلد ocr-inbox"); return
    pdfs = sorted(f for f in os.listdir(INBOX) if f.lower().endswith(".pdf"))
    if not pdfs:
        print("لا توجد ملفات PDF"); return
    os.makedirs(PDFDIR, exist_ok=True)
    cat_path = os.path.join(DATA, "catalog.json")
    cat = json.load(open(cat_path, encoding="utf-8"))
    for f in pdfs:
        path = os.path.join(INBOX, f)
        side = os.path.join(INBOX, f[:-4] + ".json")
        cfg = json.load(open(side, encoding="utf-8")) if os.path.exists(side) else {}
        base = f[:-4]
        title, author = (base.split(" - ", 1) + [""])[:2] if " - " in base else (base, "")
        title, author = cfg.get("title", title).strip(), cfg.get("author", author).strip()
        bid = cfg.get("book") or ("p" + hashlib.md5(base.encode()).hexdigest()[:8])
        print(f"== {f} → {bid}")
        dest = os.path.join(PDFDIR, bid + ".pdf")
        shutil.move(path, dest)
        if os.path.exists(side): os.remove(side)
        existing = next((b for b in cat["books"] if b["id"] == bid), None)
        entry = existing or {"id": bid, "title": title, "type": "book", "col": cfg.get("col", "dawah"),
                             "topicId": cfg.get("topic", "t1"), "added": datetime.date.today().isoformat()}
        entry["pdf"] = f"pdf/{bid}.pdf"
        if "offset" in cfg: entry["pdfOffset"] = int(cfg["offset"])
        if cfg.get("tags"): entry["tags"] = sorted(set(entry.get("tags", []) + cfg["tags"]))
        do_ocr = cfg.get("ocr", existing is None)
        if not existing:
            # المؤلف: مطابقة مع الموجود أو إضافة جديد
            aid = None
            if author:
                for a in cat["authors"]:
                    na, nb = norm(a["name"]), norm(author)
                    if na and nb and (na == nb or (len(nb) >= 4 and (nb in na or na in nb))):
                        aid = a["id"]; break
                if not aid:
                    aid = "w" + str(sum(1 for a in cat["authors"] if re.fullmatch(r"w\d+", a["id"])) + 1)
                    cat["authors"].append({"id": aid, "name": author, "col": entry["col"], "bio": "", "auto": True})
            entry["authorId"] = aid or "a8"
        if do_ocr:
            pages = ocr(dest)
            shard = {"id": bid, "pages": pages, "toc": [], "pl": [f"ص {i+1}" for i in range(len(pages))]}
            s = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(DATA, "books", bid + ".json"), "w", encoding="utf-8").write(s)
            entry.update({"n": len(pages), "size": len(s.encode()), "ocr": True,
                          "source": (entry.get("source", "") + " — " if existing and entry.get("source") else "") + "نص محوَّل آليًا من نسخة مصورة، يحتاج مراجعة",
                          "pdfOffset": entry.get("pdfOffset", 0)})
        if not existing: cat["books"].append(entry)
        print(f"   تم: {entry.get('n', '?')} صفحة")
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
