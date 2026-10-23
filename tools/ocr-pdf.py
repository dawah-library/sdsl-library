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
مرفق أيضًا مسودة أو مسودتان لهذه الصفحة من أدوات تعرّف ضوئي أخرى (Tesseract وSurya)، وقد تحتوي أخطاء حروف وكلمات:
<<<
{draft}
>>>
اعتمد على الصورة أولًا، واستعن بالمسودة مرجعًا ثانيًا للمقارنة: إن اختلفت قراءتك عن المسودة في كلمة فتحقق منها في الصورة جيدًا، وإن بقي شك فضعها بين ⟪ ⟫."""
STATS = {"gemini": 0, "tesseract": 0}
REPORT = []
UNREVIEWED = []  # صفحات لم يراجعها Gemini (ازدحام أو نفاد الحصة)
UNCERTAIN = {}  # رقم الصفحة (من صفر) ← كلمات شكّ فيها المراجع
_glast = [0.0]


GFAIL = [0]  # إخفاقات Gemini المتتالية: بعد عدد منها يكمل الكتاب بـ Tesseract ويعلّم الصفحات لإعادة المراجعة لاحقًا


def gemini_call(parts, max_tokens=8192):
    """طلب واحد إلى Gemini مع إعادة المحاولة وتبديل النموذج عند الازدحام؛ يعيد النص أو None."""
    if GFAIL[0] >= int(os.environ.get("GEMINI_MAX_FAILS", "6")):
        return None
    body = json.dumps({"contents": [{"role": "user", "parts": parts}],
                       "generationConfig": {"temperature": 0, "maxOutputTokens": max_tokens}}).encode()
    models = list(GMODELS)
    for attempt in range(4):
        wait = GDELAY - (time.time() - _glast[0])
        if wait > 0: time.sleep(wait)
        _glast[0] = time.time()
        req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % models[0], data=body,
                                     headers={"content-type": "application/json", "x-goog-api-key": GKEY})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.loads(r.read())
            c = (j.get("candidates") or [{}])[0]
            t = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []) if not p.get("thought"))
            if t.strip():
                GFAIL[0] = 0
                return t
            raise RuntimeError("رد فارغ: %s" % c.get("finishReason"))
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode("utf-8", "ignore")
            print("    Gemini %s %s: %s" % (models[0], e.code, msg[:160]), flush=True)
            if e.code == 404 and len(models) > 1: models.pop(0); continue
            if e.code in (401, 403): GFAIL[0] = 99; return None
            if e.code in (429, 500, 503) and len(models) > 1 and attempt >= 1: models.pop(0)  # جرّب نموذجًا آخر عند الازدحام
            time.sleep(min(30, 4 * (attempt + 1)))
        except Exception as e:
            print("    Gemini خطأ: %r" % e, flush=True); time.sleep(4 * (attempt + 1))
    GFAIL[0] += 1
    return None


def img_part(img):
    return {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(open(img, "rb").read()).decode()}}


def gemini_page(img, draft=""):
    t = gemini_call([img_part(img), {"text": PROMPT + (REVIEW.format(draft=draft[:9000]) if draft.strip() else "")}])
    return t.replace("[صفحة بلا نص]", "").strip() if t else None


SEP = re.compile(r"^\s*=+\s*صفحة\s*(\d+)\s*=+\s*$", re.M)


def gemini_batch(imgs, drafts):
    """عدة صفحات في طلب واحد لتوفير الحصة؛ يعيد قائمة بنص كل صفحة أو None إن اختل التقسيم."""
    parts = []
    for k, (img, d) in enumerate(zip(imgs, drafts), 1):
        parts += [{"text": "===== صفحة %d =====" % k}, img_part(img), {"text": "مسودات الصفحة %d من أدوات تعرّف ضوئي أخرى:\n<<<\n%s\n>>>" % (k, d[:9000])}]
    parts.append({"text": PROMPT + "\n\nأمامك %d صفحات متتالية، لكل صفحة صورتها ومسودة أو مسودتان من أدوات تعرّف ضوئي أخرى قد تحتوي أخطاء. اعتمد على الصورة أولًا وقارن بالمسودات (ما اتفقت عليه المسودتان والصورة فهو ثابت)، وما بقي فيه شك فضعه بين ⟪ ⟫. اكتب نص كل صفحة مسبوقًا بسطر مستقل بالصيغة:\n===== صفحة 1 =====\nثم نصها، وهكذا حتى الصفحة %d، دون أي شيء آخر." % (len(imgs), len(imgs))})
    t = gemini_call(parts, max_tokens=min(60000, 4000 * len(imgs)))
    if not t: return None
    pieces = SEP.split(t)
    got = {int(pieces[i]): pieces[i + 1] for i in range(1, len(pieces) - 1, 2)}
    if sorted(got) != list(range(1, len(imgs) + 1)):
        print("    تقسيم الصفحات غير مطابق (%s)، تُراجع صفحة صفحة" % sorted(got), flush=True); return None
    return [got[k].replace("[صفحة بلا نص]", "").strip() for k in range(1, len(imgs) + 1)]


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


def surya_drafts(pdf, nums):
    """مسودة ثانية من Surya (مفتوح المصدر، أدق من Tesseract في العربية). تعيد {رقم الصفحة: نص} أو {} إن تعذر."""
    if os.environ.get("OCR_SURYA", "1") != "1":
        return {}
    if not shutil.which("surya_ocr"):
        REPORT.append("- Surya غير مثبت على الخادم"); return {}
    out = tempfile.mkdtemp()
    cmd = ["surya_ocr", pdf, "--output_dir", out, "--page_range", "%d-%d" % (nums[0] - 1, nums[-1] - 1)]
    t0 = time.time()
    try:
        subprocess.run(cmd, check=True, timeout=int(os.environ.get("SURYA_MAX_MIN", "150")) * 60,
                       env=dict(os.environ, TORCH_DEVICE="cpu"), capture_output=True)
    except Exception as e:
        err = (getattr(e, "stderr", b"") or b"")[-600:].decode("utf-8", "ignore")
        print("  تعذر Surya: %r %s" % (e, err), flush=True); REPORT.append("- تعذر Surya: %s\n```\n%s\n```" % (str(e)[:200], err)); return {}
    res = {}
    for root, _, files in os.walk(out):
        for f in files:
            if f.endswith(".json"):
                data = json.load(open(os.path.join(root, f), encoding="utf-8"))
                for pages in (data.values() if isinstance(data, dict) else [data]):
                    for k, pg in enumerate(pages if isinstance(pages, list) else []):
                        lines = [l.get("text", "") for l in pg.get("text_lines", []) if l.get("text", "").strip()]
                        num = pg.get("page", k + nums[0])
                        if num == 0 or (isinstance(num, int) and num < nums[0]): num = nums[0] + k  # ترقيم من صفر في بعض الإصدارات
                        res[int(num)] = fix_punct("\n".join(lines))
    print("  اكتملت مسودات Surya: %d صفحة في %d دقيقة" % (len(res), (time.time() - t0) // 60), flush=True)
    REPORT.append("- Surya: %d صفحة في %d دقيقة" % (len(res), (time.time() - t0) // 60))
    return res


def ocr(pdf, first=1, last=None):
    """١) مسودات Tesseract لكل الصفحات بالتوازي ٢) Gemini يقرأ الصور ويراجع المسودات ويصحح ويعلّم الشك، عدة صفحات في الطلب."""
    from concurrent.futures import ThreadPoolExecutor
    n = pages_count(pdf)
    last = min(last or n, n)
    nums = list(range(first, last + 1))
    STATS.update(gemini=0, tesseract=0); UNCERTAIN.clear(); UNREVIEWED.clear(); GFAIL[0] = 0
    batch = max(1, int(os.environ.get("GEMINI_BATCH", "4")))
    print("  المحرك: Tesseract" + (" + Surya" if os.environ.get("OCR_SURYA", "1") == "1" and shutil.which("surya_ocr") else "") + (" ثم مراجعة Gemini (%d صفحات في الطلب)" % batch if GKEY else ""), flush=True)
    with tempfile.TemporaryDirectory() as td:
        def tess(p):
            img = os.path.join(td, f"p{p}")
            subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
            r = subprocess.run(["tesseract", img + ".png", "-", "-l", LANG, "--psm", "4"], capture_output=True, text=True)
            if GKEY:
                subprocess.run(["pdftoppm", "-r", "170", "-jpeg", "-jpegopt", "quality=82", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
            try: os.remove(img + ".png")
            except OSError: pass
            return clean_page(r.stdout)
        with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
            drafts = list(ex.map(tess, nums))
        print("  اكتملت مسودات Tesseract: %d صفحة" % len(drafts), flush=True)
        sur = surya_drafts(pdf, nums)
        # المسودة الافتراضية إن لم يراجع Gemini: Surya إن وُجدت (أدق)، وإلا Tesseract
        pages = [sur.get(p) or d for p, d in zip(nums, drafts)]; reviewed = [False] * len(nums)
        both = [("[مسودة Tesseract]\n" + d + ("\n\n[مسودة Surya]\n" + sur[p] if sur.get(p) else "")) for p, d in zip(nums, drafts)]
        def accept(i, g):
            words = [w.strip() for w in UNC.findall(g) if w.strip()]
            if words: UNCERTAIN[i] = words[:40]
            pages[i] = gemini_clean(UNC.sub(r"\1", g)); reviewed[i] = True
        if GKEY:
            for s0 in range(0, len(nums), batch):
                idx = list(range(s0, min(s0 + batch, len(nums))))
                imgs = [os.path.join(td, f"p{nums[i]}.jpg") for i in idx]
                res = gemini_batch(imgs, [both[i] for i in idx]) if len(idx) > 1 else None
                if res:
                    for i, g in zip(idx, res): accept(i, g)
                else:
                    for i, img in zip(idx, imgs):
                        g = gemini_page(img, both[i])
                        if g is not None: accept(i, g)
                print(f"  روجعت حتى صفحة {nums[idx[-1]]}/{last}", flush=True)
        for i, ok in enumerate(reviewed):
            if ok: STATS["gemini"] += 1
            else:
                STATS["tesseract"] += 1
                if GKEY: UNREVIEWED.append(i)
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
        REPORT.append("## %s (%s)\n- الصفحات: %s، راجعها Gemini: %d، دون مراجعة: %d، مواضع شك: %d" % (entry.get("title"), bid, entry.get("n", "?"), STATS["gemini"], STATS["tesseract"], sum(len(v) for v in UNCERTAIN.values())))
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "tools", "ocr-report.md"), "w", encoding="utf-8").write("# تقرير آخر تحويل — %s UTC\n\n" % datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M") + "\n".join(REPORT) + "\n")


if __name__ == "__main__":
    main()
