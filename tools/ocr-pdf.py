#!/usr/bin/env python3
"""تحويل الكتب المصورة (PDF) إلى نص بالتعرف الضوئي (Tesseract) — يعمل تلقائيًا عبر GitHub Actions.

ضع ملف PDF في مجلد ocr-inbox/ باسم: «عنوان الكتاب - اسم المؤلف.pdf»
ويمكن إرفاق ملف بنفس الاسم وامتداد .json فيه إعدادات اختيارية:
  {"title": "...", "author": "...", "topic": "t1", "col": "dawah", "offset": 0, "book": "معرف كتاب موجود", "ocr": true, "tags": ["furqan:فقه الخلاف"]}
  - book: لربط ملف PDF بكتاب نصي موجود بدل إنشاء كتاب جديد (بلا تحويل إلا إذا ocr=true)
  - offset: الفرق بين رقم صفحة النص ورقم صفحة PDF (مثلًا 4 إذا كانت صفحة النص 1 هي صفحة PDF رقم 5)
النتيجة: data/books/<id>.json + إدخال في data/catalog.json + نقل الملف إلى pdf/<id>.pdf
"""
import json, os, re, subprocess, sys, tempfile, hashlib, shutil, datetime, base64, time, urllib.request, urllib.error

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
    # Tesseract يقرأ الفاصلة العربية «،» غالبًا علامة » ؛ نصححها إن لم يسبقها قوس تنصيص مفتوح قريب
    t = re.sub(r"(?<![«\s])»(?=\s|$)", lambda m: "»" if "«" in t[max(0, m.start() - 80):m.start()] else "،", t)
    return t


def garbage(l):
    """سطر مشوَّه من زخارف الصفحة أو ترويستها: حروف قليلة ورموز كثيرة أو كلمات مقطعة."""
    s = l.lstrip("# ").strip()
    if len(s) < 4: return True
    letters = len(AR.findall(s)); other = len(re.findall(r"[^\s\u0600-\u06FF]", s))
    words = s.split(); short = sum(1 for w in words if len(w) <= 2)
    if len(s) < 40 and (other > letters * 0.3 or (len(words) >= 2 and short / len(words) > 0.5)): return True
    return False


def clean_page(t):
    t = fix_punct(t)
    lines = [l.strip() for l in t.replace("\f", "").split("\n")]
    out, buf = [], ""
    for l in lines:
        if l and garbage(l):
            continue
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


# ---------- التحويل بالذكاء الاصطناعي (Gemini) إن وُجد المفتاح، وإلا Tesseract ----------
GKEY = os.environ.get("GEMINI_API_KEY", "")
GMODELS = [m for m in [os.environ.get("GEMINI_OCR_MODEL"), "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"] if m]
GDELAY = 60.0 / float(os.environ.get("GEMINI_RPM", "8"))
PROMPT = """انسخ نص هذه الصفحة من كتاب عربي مطبوع نسخًا حرفيًا دقيقًا.
- حافظ على الكلمات والتشكيل وعلامات الترقيم وأقواس الآيات ﴿ ﴾ والأحاديث كما هي تمامًا، ولا تصحح ولا تشرح ولا تلخص.
- تجاهل ترويسة الصفحة المتكررة أعلاها (اسم الكتاب أو الباب) ورقم الصفحة والزخارف.
- العناوين: اكتب كل عنوان في سطر مستقل يبدأ بـ «# ».
- الفقرات: كل فقرة في سطر واحد متصل (ادمج الأسطر المكسورة والكلمات المقطوعة في نهاية السطر).
- الشعر: كل بيت في سطر، وافصل بين الشطرين بـ « ... ».
- الحواشي أسفل الصفحة: إن وُجدت فاكتب بعد المتن سطرًا فيه ______ ثم كل حاشية في سطر برقمها كما في الكتاب، مثل: (1) نص الحاشية.
- إن كانت الصفحة فارغة أو صورة بلا نص فاكتب: [صفحة بلا نص]
- كل كلمة لم تتأكد من قراءتها (لضعف الطباعة أو الصورة) ضعها بين ⟪ ⟫ مثل: ⟪كلمة⟫، ليراجعها مدقق بشري.
أخرج النص فقط دون أي مقدمة أو تعليق."""
REVIEW = """
مرفق أيضًا مسودة لهذه الصفحة من أداة تعرّف ضوئي أخرى (Tesseract)، وقد تحتوي أخطاء حروف وكلمات:
<<<
{draft}
>>>
اعتمد على الصورة أولًا، واستعن بالمسودة مرجعًا ثانيًا للمقارنة: إن اختلفت قراءتك عن المسودة في كلمة فتحقق منها في الصورة جيدًا، وإن بقي شك فضعها بين ⟪ ⟫."""
STATS = {"gemini": 0, "tesseract": 0}
UNREVIEWED = []  # صفحات لم يراجعها Gemini (ازدحام أو نفاد الحصة)
UNCERTAIN = {}  # رقم الصفحة (من صفر) ← كلمات شكّ فيها المراجع
_glast = [0.0]


GFAIL = [0]  # إخفاقات Gemini المتتالية: بعد عدد منها يكمل الكتاب بـ Tesseract ويعلّم الصفحات لإعادة المراجعة لاحقًا


def gemini_page(img, draft=""):
    if GFAIL[0] >= int(os.environ.get("GEMINI_MAX_FAILS", "6")):
        return None
    data = base64.b64encode(open(img, "rb").read()).decode()
    prompt = PROMPT + (REVIEW.format(draft=draft[:6000]) if draft.strip() else "")
    body = json.dumps({"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": "image/jpeg", "data": data}}, {"text": prompt}]}],
                       "generationConfig": {"temperature": 0, "maxOutputTokens": 8192}}).encode()
    models = list(GMODELS)
    for attempt in range(4):
        wait = GDELAY - (time.time() - _glast[0])
        if wait > 0: time.sleep(wait)
        _glast[0] = time.time()
        req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % models[0], data=body,
                                     headers={"content-type": "application/json", "x-goog-api-key": GKEY})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                j = json.loads(r.read())
            c = (j.get("candidates") or [{}])[0]
            t = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []) if not p.get("thought"))
            if t.strip():
                GFAIL[0] = 0
                return t.replace("[صفحة بلا نص]", "").strip()
            raise RuntimeError("رد فارغ: %s" % c.get("finishReason"))
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode("utf-8", "ignore")
            print("    Gemini %s %s: %s" % (models[0], e.code, msg[:160]), flush=True)
            if e.code == 404 and len(models) > 1: models.pop(0); continue
            if e.code in (401, 403): GFAIL[0] = 99; return None
            if e.code in (429, 500, 503) and len(models) > 1 and attempt >= 1: models.pop(0)  # جرّب نموذجًا آخر عند الازدحام
            time.sleep(min(30, 4 * (attempt + 1)))
        except Exception as e:
            print("    Gemini خطأ: %r" % e, flush=True); time.sleep(5 * (attempt + 1))
    GFAIL[0] += 1
    return None


UNC = re.compile(r"⟪\s*([^⟪⟫]{1,60}?)\s*⟫")


def gemini_clean(t):
    t = fix_punct(t)
    lines = [l.rstrip() for l in t.split("\n")]
    out = []
    for l in lines:
        s = l.strip()
        if not s or re.fullmatch(r"[\d٠-٩\-–—\s()]+", s): continue
        out.append(re.sub(r"^#+\s*", "# ", s) if s.startswith("#") else s)
    return "\n".join(out)


def ocr(pdf, first=1, last=None):
    n = pages_count(pdf)
    last = min(last or n, n)
    pages = []
    STATS.update(gemini=0, tesseract=0); UNCERTAIN.clear(); UNREVIEWED.clear(); GFAIL[0] = 0
    print("  المحرك: " + ("Gemini مع Tesseract احتياطيًا" if GKEY else "Tesseract"), flush=True)
    with tempfile.TemporaryDirectory() as td:
        for p in range(first, last + 1):
            img = os.path.join(td, f"p{p}")
            # ١) مسودة Tesseract (مجانية وسريعة) ٢) Gemini يقرأ الصورة ويراجع المسودة ويصحح ويعلّم مواضع الشك
            subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
            r = subprocess.run(["tesseract", img + ".png", "-", "-l", LANG, "--psm", "4"], capture_output=True, text=True)
            draft = clean_page(r.stdout)
            text = None
            if GKEY:
                subprocess.run(["pdftoppm", "-r", "170", "-jpeg", "-jpegopt", "quality=82", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
                g = gemini_page(img + ".jpg", draft)
                if g is not None:
                    words = [w.strip() for w in UNC.findall(g) if w.strip()]
                    if words: UNCERTAIN[len(pages)] = words[:40]
                    text = gemini_clean(UNC.sub(r"\1", g)); STATS["gemini"] += 1
            if text is None:
                text = draft; STATS["tesseract"] += 1
                if GKEY: UNREVIEWED.append(len(pages))
            pages.append(text)
            print(f"  صفحة {p}/{last}: {len(pages[-1])} حرف", flush=True)
    return pages


def main():
    if not os.path.isdir(INBOX):
        print("لا يوجد مجلد ocr-inbox"); return
    # تجميع الملفات المرفوعة أجزاءً من صفحة الإدارة: <اسم>.pdf.part001… ثم <اسم>.ready
    for f in sorted(os.listdir(INBOX)):
        if f.endswith(".ready"):
            base = f[:-6]; parts = sorted(x for x in os.listdir(INBOX) if x.startswith(base + ".pdf.part"))
            n = int((open(os.path.join(INBOX, f)).read().strip() or "0"))
            if not parts or (n and len(parts) != n):
                print("أجزاء ناقصة للملف", base, len(parts), "من", n); continue
            with open(os.path.join(INBOX, base + ".pdf"), "wb") as out:
                for x in parts: out.write(open(os.path.join(INBOX, x), "rb").read()); os.remove(os.path.join(INBOX, x))
            os.remove(os.path.join(INBOX, f)); print("جُمِّع:", base, len(parts), "أجزاء")
    redo = [x.strip() for x in os.environ.get("REOCR", "").split(",") if x.strip()]
    for f in sorted(os.listdir(INBOX)):  # طلبات إعادة التحويل من صفحة الإدارة: ocr-inbox/<id>.redo
        if f.endswith(".redo"):
            redo.append(f[:-5]); os.remove(os.path.join(INBOX, f))
    for bid in redo:  # إعادة تحويل كتاب موجود من نسخته المصورة المحفوظة
        src = os.path.join(PDFDIR, bid + ".pdf")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(INBOX, "redo-" + bid + ".pdf"))
            json.dump({"book": bid, "ocr": True}, open(os.path.join(INBOX, "redo-" + bid + ".json"), "w", encoding="utf-8"))
        else:
            print("لا توجد نسخة مصورة محفوظة للكتاب", bid)
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
            toc = [{"t": l[2:].strip(), "p": i + 1} for i, t in enumerate(pages) for l in t.split("\n") if l.startswith("# ") and 2 < len(l) < 120]
            shard = {"id": bid, "pages": pages, "toc": toc, "pl": [f"ص {i+1}" for i in range(len(pages))]}
            if UNCERTAIN: shard["unc"] = {str(k): v for k, v in UNCERTAIN.items()}
            if UNREVIEWED: shard["unrev"] = UNREVIEWED[:]
            s = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(DATA, "books", bid + ".json"), "w", encoding="utf-8").write(s)
            entry.update({"n": len(pages), "size": len(s.encode()), "ocr": True,
                          "source": " — ".join(x for x in [re.sub(r"\s*—?\s*نص محوَّل (آليًا|بالذكاء الاصطناعي).*$", "", entry.get("source", "")).strip(" —") if existing else "", "نص محوَّل بالذكاء الاصطناعي من نسخة مصورة، يُرجى الإبلاغ عن أي خطأ" if STATS["gemini"] > STATS["tesseract"] else "نص محوَّل آليًا من نسخة مصورة، يحتاج مراجعة"] if x),
                          "ocrEngine": "gemini+tesseract" if STATS["gemini"] > STATS["tesseract"] else "tesseract",
                          "unc": sum(len(v) for v in UNCERTAIN.values()), "unrev": len(UNREVIEWED),
                          "pdfOffset": entry.get("pdfOffset", 0)})
        if not existing: cat["books"].append(entry)
        print(f"   تم: {entry.get('n', '?')} صفحة")
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
