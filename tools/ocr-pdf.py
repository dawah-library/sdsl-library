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
# يمكن إضافة مفاتيح Gemini أخرى من حسابات Google مختلفة (GEMINI_API_KEY_2 … _5) فتتضاعف الحصة اليومية المجانية
GKEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 6)] if k.strip()]
GKEY = GKEYS[0] if GKEYS else ""
KI = [0]
GMODELS = [m for m in [os.environ.get("GEMINI_OCR_MODEL"), "gemini-flash-latest", "gemini-flash-lite-latest"] if m]
GDELAY = 60.0 / float(os.environ.get("GEMINI_RPM", "8"))
PROMPT = """انسخ نص هذه الصفحة من كتاب عربي مطبوع نسخًا حرفيًا دقيقًا.
- حافظ على الكلمات والتشكيل وعلامات الترقيم وأقواس الآيات ﴿ ﴾ والأحاديث كما هي تمامًا، ولا تصحح ولا تشرح ولا تلخص.
- تجاهل ترويسة الصفحة المتكررة أعلاها (اسم الكتاب أو الباب) ورقم الصفحة والزخارف.
- ابدأ إخراج كل صفحة بسطر فيه رقم الصفحة المطبوع كما يظهر في الصورة (أعلاها أو أسفلها) بالصيغة: [ص: 12] ، وإن لم يظهر رقم فاكتب: [ص: -]
- العناوين: العنوان الرئيس (باب، فصل، مبحث، مقدمة، خاتمة…) في سطر مستقل يبدأ بـ «# »، والعنوان الفرعي داخله في سطر يبدأ بـ «## ».
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


def gemini_call(parts, max_tokens=8192, models=None, fail=None):
    """طلب واحد إلى Gemini مع إعادة المحاولة وتبديل النموذج عند الازدحام؛ يعيد النص أو None."""
    fail = fail or GFAIL
    if fail[0] >= int(os.environ.get("GEMINI_MAX_FAILS", "6")):
        return None
    body = json.dumps({"contents": [{"role": "user", "parts": parts}],
                       "generationConfig": {"temperature": 0, "maxOutputTokens": max_tokens}}).encode()
    models = list(models or GMODELS)
    for attempt in range(4):
        wait = GDELAY - (time.time() - _glast[0])
        if wait > 0: time.sleep(wait)
        _glast[0] = time.time()
        req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % models[0], data=body,
                                     headers={"content-type": "application/json", "x-goog-api-key": GKEYS[KI[0] % len(GKEYS)]})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.loads(r.read())
            c = (j.get("candidates") or [{}])[0]
            t = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []) if not p.get("thought"))
            if t.strip():
                fail[0] = 0
                return t
            raise RuntimeError("رد فارغ: %s" % c.get("finishReason"))
        except urllib.error.HTTPError as e:
            msg = e.read()[:300].decode("utf-8", "ignore")
            print("    Gemini %s %s: %s" % (models[0], e.code, msg[:160]), flush=True)
            if e.code == 404 and len(models) > 1: models.pop(0); continue
            if e.code == 429 and len(GKEYS) > 1 and attempt < 3:  # نفدت حصة هذا المفتاح: انتقل إلى المفتاح التالي
                KI[0] += 1; print("    الانتقال إلى مفتاح Gemini رقم %d" % (KI[0] % len(GKEYS) + 1), flush=True); continue
            if e.code in (401, 403): fail[0] = 99; return None
            if e.code in (429, 500, 503) and len(models) > 1 and attempt >= 1: models.pop(0)  # جرّب نموذجًا آخر عند الازدحام
            time.sleep(min(30, 4 * (attempt + 1)))
        except Exception as e:
            print("    Gemini خطأ: %r" % e, flush=True); time.sleep(4 * (attempt + 1))
    fail[0] += 1
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
PNUM_RE = re.compile(r"^\s*\[\s*ص\s*[:：]\s*([^\]]*)\]\s*\n?")
PNUM = {}  # رقم الصفحة (من صفر) ← رقمها المطبوع


def take_pnum(i, g):
    m = PNUM_RE.match(g or "")
    if not m: return g
    v = m.group(1).translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")).strip()
    if re.fullmatch(r"\d{1,4}", v): PNUM[i] = int(v)
    return g[m.end():]


def printed_labels(n):
    """ترقيم الطبعة الورقية لكل صفحة: من الأرقام التي قرأها Gemini، مع إكمال الفجوات بالتتابع."""
    if len(PNUM) < max(3, n * 0.25): return None
    # الإزاحة الغالبة (رقم مطبوع − ترتيب الصفحة) لتجاهل القراءات الشاذة
    from collections import Counter
    off = Counter(v - i for i, v in PNUM.items()).most_common(1)[0][0]
    out = []
    for i in range(n):
        v = PNUM.get(i)
        if v is None or abs((v - i) - off) > 2: v = i + off
        out.append("ص %d" % v if v >= 1 else "")
    return out


def gemini_clean(t):
    t = fix_punct(t)
    lines = [l.rstrip() for l in t.split("\n")]
    out = []
    for l in lines:
        s = l.strip()
        if not s or re.fullmatch(r"[\d٠-٩\-–—\s()]+", s): continue
        if s.startswith("#"): s = re.sub(r"^(#{1,2})#*\s*", lambda m: m.group(1) + " ", s)
        s = s[:3] + re.sub(r"\s+#+\s*(?=\S)", " — ", s[3:]); s = re.sub(r"\s*#+$", "", s)
        out.append(s)
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


# ---------- المدقق الثاني: نموذج أقوى يعيد قراءة الصفحات التي بقي فيها شك فقط ----------
PROMODELS = [m for m in [os.environ.get("GEMINI_PRO_MODEL", "gemini-2.5-pro"), "gemini-pro-latest"] if m]
PFAIL = [0]
PRO_PROMPT = """أمامك صورة صفحة من كتاب عربي مطبوع، وتحتها قراءة أولية لها أعدّها مدقق آخر، وفيها كلمات مشكوك فيها بين ⟪ ⟫.
راجع القراءة كلها على الصورة بعناية، وصحح كل ما يخالف الصورة، واحسم الكلمات المشكوك فيها بالنظر الدقيق في الصورة.
حافظ على تنسيق القراءة نفسه (العناوين بـ «# »، والحواشي بعد سطر ______، والفقرات في أسطر متصلة).
ما بقي فيه شك حقيقي بعد التدقيق فاتركه بين ⟪ ⟫. أخرج نص الصفحة كاملًا فقط دون أي تعليق.
القراءة الأولية:
<<<
{text}
>>>"""


def pro_pass(pdf, nums, pages, td):
    """يعيد قراءة الصفحات ذات مواضع الشك بنموذج أدق وبصورة أوضح (حصته المجانية أقل، فيقتصر على الأشد شكًّا)."""
    limit = int(os.environ.get("OCR_PRO_MAX", "60"))
    if not GKEY or limit <= 0 or not UNCERTAIN: return
    order = sorted(UNCERTAIN, key=lambda i: -len(UNCERTAIN[i]))[:limit]
    fixed = 0; t0 = time.time(); PFAIL[0] = 0
    for i in order:
        if PFAIL[0] >= 2: print("  توقف المدقق الثاني (الحصة أو الازدحام)", flush=True); break
        img = os.path.join(td, "hi%d" % nums[i])
        subprocess.run(["pdftoppm", "-r", "260", "-jpeg", "-jpegopt", "quality=88", "-f", str(nums[i]), "-l", str(nums[i]), "-singlefile", pdf, img], check=True)
        before = UNCERTAIN[i]
        marked = pages[i]
        for w in before: marked = marked.replace(w, "⟪%s⟫" % w, 1)
        g = gemini_call([img_part(img + ".jpg"), {"text": PRO_PROMPT.format(text=marked[:12000])}], models=PROMODELS, fail=PFAIL)
        if not g: continue
        words = [w.strip() for w in UNC.findall(g) if w.strip()]
        g = PNUM_RE.sub("", g, count=1)
        pages[i] = gemini_clean(UNC.sub(r"\1", g).replace("[صفحة بلا نص]", "").strip())
        if words: UNCERTAIN[i] = words[:40]
        else: UNCERTAIN.pop(i, None)
        fixed += 1
    if fixed:
        print("  المدقق الثاني راجع %d صفحة في %d دقيقة" % (fixed, (time.time() - t0) // 60), flush=True)
        REPORT.append("- المدقق الثاني (%s): أعاد قراءة %d صفحة فيها شك" % (PROMODELS[0], fixed))
    STATS["pro"] = fixed


CARD_PROMPT = """أمامك بداية كتاب عربي (صفحة العنوان وبيانات النشر والمقدمة) وفهرس عناوينه. استخرج بطاقة تعريف بالكتاب بصيغة JSON فقط، بهذه الحقول:
{"title": "عنوان الكتاب كما في صفحة العنوان", "subtitle": "العنوان الفرعي إن وُجد", "author": "اسم المؤلف أو المعدّ كما في صفحة العنوان", "intro_by": "من قدّم للكتاب إن وُجد", "editor": "المحقق أو المراجع إن وُجد",
 "publisher": "الناشر ومدينته", "edition": "رقم الطبعة", "year": "سنة الطبع هجريًا وميلاديًا", "printed_pages": "عدد الصفحات المطبوع إن ذُكر",
 "summary": "تعريف موجز بالكتاب في 3 إلى 5 جمل: موضوعه ومقصده وأهم ما يعالجه، بأسلوب علمي محايد",
 "parts": ["أهم أبواب الكتاب أو محاوره في عبارات قصيرة (حتى 8)"], "keywords": ["كلمات مفتاحية (حتى 8)"], "audience": "لمن يُنصح به في جملة قصيرة"}
لا تخترع ما ليس في النص: اترك الحقل فارغًا "" إن لم يُذكر. أخرج JSON صحيحًا فقط."""


def make_card(pages, toc):
    if not GKEY: return None
    head, total = [], 0
    for t in pages:
        if not t.strip(): continue
        head.append(t); total += len(t)
        if total > 14000: break
    titles = "\n".join(("  " if x.get("l") == 2 else "") + x["t"] for x in toc[:120])
    g = gemini_call([{"text": CARD_PROMPT + "\n\nبداية الكتاب:\n<<<\n" + "\n\n".join(head)[:16000] + "\n>>>\n\nالفهرس:\n<<<\n" + titles + "\n>>>"}], max_tokens=4096)
    if not g: return None
    m = re.search(r"\{.*\}", g, re.S)
    try:
        card = json.loads(m.group(0)) if m else None
    except Exception:
        card = None
    if not isinstance(card, dict): return None
    return {k: v for k, v in card.items() if v not in ("", None, [], {})}


TOCLINE = re.compile(r"^#*\s*(.{3,150}?)\s*[.…·_\-ـ]{3,}\s*\(?([\d٠-٩۰-۹]{1,4})\)?\s*$")
DIG = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def toc_from_printed(pages, pl):
    """فهرس الكتاب المطبوع نفسه (سطر العنوان ثم نقاط ثم رقم الصفحة) مربوطًا بصفحات النص عبر ترقيم الطبعة."""
    rows, where = [], set()
    for i, t in enumerate(pages):
        hits = [TOCLINE.match(l.strip()) for l in t.split("\n")]
        hits = [h for h in hits if h]
        if len(hits) >= 4:
            where.add(i); rows += [(h.group(1).strip(" #:"), int(h.group(2).translate(DIG))) for h in hits]
    if len(rows) < 5: return None
    num = {}
    for i, lab in enumerate(pl or []):
        m = re.search(r"(\d+)\s*$", lab or "")
        if m: num.setdefault(int(m.group(1)), i + 1)
    out = []
    for t, n in rows:
        p = num.get(n)
        if p and p - 1 not in where: out.append({"t": t, "p": p})
    if len(out) < max(5, len(rows) * 0.6): return None
    return toc_levels(out)


ORD = ["أول", "ثاني", "ثالث", "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر"]


def ordinal(t):
    m = re.match(r"^(أول|ثاني|ثان|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر)[ًٌاٍَُِّْ]*\s*[:：\-–]?", t.replace("أولا", "أول").replace("ثانيا", "ثاني"))
    if not m: return None
    w = m.group(1); w = "ثاني" if w == "ثان" else w
    return ORD.index(w) + 1 if w in ORD else None


def toc_levels(toc):
    """مستويات الفهرس: العناصر المرقمة (أولًا، ثانيًا…) في التسلسل الرئيس مستوى أول، والتسلسلات الداخلية وما بينها مستوى ثانٍ."""
    main_exp, sub_exp, seen_main = 1, None, False
    for x in toc:
        k = ordinal(x["t"])
        if k is None:
            if seen_main: x["l"] = 2
            continue
        if sub_exp is not None and k == sub_exp: x["l"] = 2; sub_exp += 1
        elif k == main_exp: main_exp += 1; seen_main = True; sub_exp = None; x.pop("l", None)
        elif seen_main: x["l"] = 2; sub_exp = k + 1
    return toc


def make_toc(pages):
    toc = []
    for i, t in enumerate(pages):
        for l in t.split("\n"):
            lv = 2 if l.startswith("## ") else 1 if l.startswith("# ") else 0
            name = l[lv + 1:].strip()
            if lv and 1 < len(name) < 120:
                toc.append({"t": name, "p": i + 1, **({"l": 2} if lv == 2 else {})})
    return toc


def cards_job():
    """بطاقات تعريف للكتب الموجودة التي ليس لها بطاقة (من نصها، دون صور)."""
    cat_path = os.path.join(DATA, "catalog.json"); cat = json.load(open(cat_path, encoding="utf-8"))
    limit = int(os.environ.get("CARDS_MAX", "25")); done = 0
    ids = [x.strip() for x in os.environ.get("CARD_IDS", "").split(",") if x.strip()]
    for b in cat["books"]:
        if done >= limit: break
        if ids and b["id"] not in ids: continue
        if not ids and (b.get("card") or b.get("col", "dawah") != "dawah" or b.get("type") == "article" or b.get("vf") or b.get("demo")): continue
        fp = os.path.join(DATA, "books", b["id"] + ".json")
        if not os.path.exists(fp): continue
        sh = json.load(open(fp, encoding="utf-8"))
        card = make_card(sh.get("pages", []), sh.get("toc", []))
        if card:
            b["card"] = card; done += 1; print("بطاقة:", b["title"], flush=True)
        elif GFAIL[0] >= 6: break
    if done:
        cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
        json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("أُنشئت %d بطاقة" % done)


def md5f(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()


def tess_page(pdf, p, td):
    img = os.path.join(td, f"t{p}")
    subprocess.run(["pdftoppm", "-r", "300", "-gray", "-png", "-f", str(p), "-l", str(p), "-singlefile", pdf, img], check=True)
    r = subprocess.run(["tesseract", img + ".png", "-", "-l", LANG, "--psm", "4"], capture_output=True, text=True)
    try: os.remove(img + ".png")
    except OSError: pass
    return clean_page(r.stdout)


def make_drafts(pdf, nums):
    """مسودات Tesseract (بالتوازي) وSurya لمجموعة صفحات: {رقم: {"t": .., "s": ..}}"""
    from concurrent.futures import ThreadPoolExecutor
    with tempfile.TemporaryDirectory() as td:
        with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
            tess = list(ex.map(lambda p: tess_page(pdf, p, td), nums))
    print("  اكتملت مسودات Tesseract: %d صفحة" % len(tess), flush=True)
    sur = surya_drafts(pdf, nums)
    return {p: {"t": t, "s": sur.get(p, "")} for p, t in zip(nums, tess)}


def load_drafts(pdf):
    """مسودات جاهزة أعدّتها أجهزة متوازية (مجلد OCR_DRAFTS) لهذا الملف."""
    d = os.environ.get("OCR_DRAFTS", "")
    if not d or not os.path.isdir(d): return {}
    key, out = md5f(pdf), {}
    for root, _, files in os.walk(d):
        for f in files:
            if f.startswith(key) and f.endswith(".json"):
                for k, v in json.load(open(os.path.join(root, f), encoding="utf-8")).get("pages", {}).items(): out[int(k)] = v
    return out


def ocr(pdf, first=1, last=None):
    """١) مسودات Tesseract لكل الصفحات بالتوازي ٢) Gemini يقرأ الصور ويراجع المسودات ويصحح ويعلّم الشك، عدة صفحات في الطلب."""
    from concurrent.futures import ThreadPoolExecutor
    n = pages_count(pdf)
    last = min(last or n, n)
    nums = list(range(first, last + 1))
    STATS.update(gemini=0, tesseract=0, pro=0); PNUM.clear(); UNCERTAIN.clear(); UNREVIEWED.clear(); GFAIL[0] = 0
    batch = max(1, int(os.environ.get("GEMINI_BATCH", "4")))
    ready = load_drafts(pdf)
    have = [p for p in nums if p in ready]
    print("  المحرك: Tesseract" + (" + Surya" if os.environ.get("OCR_SURYA", "1") == "1" and (shutil.which("surya_ocr") or have) else "") + (" ثم مراجعة Gemini (%d صفحات في الطلب) ثم مدقق ثانٍ لمواضع الشك" % batch if GKEY else ""), flush=True)
    if have:
        print("  مسودات جاهزة من الأجهزة المتوازية: %d صفحة" % len(have), flush=True); REPORT.append("- مسودات من أجهزة متوازية: %d صفحة" % len(have))
    with tempfile.TemporaryDirectory() as td:
        missing = [p for p in nums if p not in ready]
        if missing: ready.update(make_drafts(pdf, missing))
        if GKEY:
            from concurrent.futures import ThreadPoolExecutor
            def jpg(p):
                subprocess.run(["pdftoppm", "-r", "170", "-jpeg", "-jpegopt", "quality=82", "-f", str(p), "-l", str(p), "-singlefile", pdf, os.path.join(td, f"p{p}")], check=True)
            with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex: list(ex.map(jpg, nums))
        drafts = [ready[p].get("t", "") for p in nums]
        sur = {p: ready[p].get("s", "") for p in nums if ready[p].get("s")}
        # المسودة الافتراضية إن لم يراجع Gemini: Surya إن وُجدت (أدق)، وإلا Tesseract
        pages = [sur.get(p) or d for p, d in zip(nums, drafts)]; reviewed = [False] * len(nums)
        both = [("[مسودة Tesseract]\n" + d + ("\n\n[مسودة Surya]\n" + sur[p] if sur.get(p) else "")) for p, d in zip(nums, drafts)]
        def accept(i, g):
            g = take_pnum(i, g)
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
            pro_pass(pdf, nums, pages, td)
        for i, ok in enumerate(reviewed):
            if ok: STATS["gemini"] += 1
            else:
                STATS["tesseract"] += 1
                if GKEY: UNREVIEWED.append(i)
    return pages


def assemble():
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


def redo_ids(consume=False):
    ids = [x.strip() for x in os.environ.get("REOCR", "").split(",") if x.strip()]
    for f in sorted(os.listdir(INBOX)):
        if f.endswith(".redo"):
            ids.append(f[:-5])
            if consume: os.remove(os.path.join(INBOX, f))
    return ids


def plan():
    """يقسم صفحات الكتب المنتظرة على أجهزة متوازية لإعداد المسودات (Tesseract وSurya) بسرعة."""
    shards = []
    if os.path.isdir(INBOX):
        assemble()
        files = [os.path.join("ocr-inbox", f) for f in sorted(os.listdir(INBOX)) if f.lower().endswith(".pdf")]
        files += [os.path.join("pdf", b + ".pdf") for b in redo_ids() if os.path.exists(os.path.join(PDFDIR, b + ".pdf"))]
        jobs = []
        for f in files:
            side = os.path.join(ROOT, f[:-4] + ".json")
            cfg = json.load(open(side, encoding="utf-8")) if f.startswith("ocr-inbox") and os.path.exists(side) else {}
            if f.startswith("ocr-inbox") and cfg.get("book") and not cfg.get("ocr"): continue  # ربط نسخة مصورة بلا تحويل
            n = pages_count(os.path.join(ROOT, f))
            if n: jobs.append((f, n))
        total = sum(n for _, n in jobs); maxj = int(os.environ.get("OCR_MACHINES", "12"))
        size = max(int(os.environ.get("OCR_SHARD", "30")), -(-total // maxj)) if total else 1
        for f, n in jobs:
            for a in range(1, n + 1, size): shards.append({"path": f, "first": a, "last": min(n, a + size - 1)})
    out = json.dumps(shards, ensure_ascii=False)
    print("الأجزاء:", out)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as g: g.write("shards=%s\nany=%s\n" % (out, "1" if shards else "0"))


def drafts_job(path, first, last):
    if os.path.isdir(INBOX): assemble()
    pdf = os.path.join(ROOT, path)
    res = make_drafts(pdf, list(range(int(first), int(last) + 1)))
    os.makedirs(os.path.join(ROOT, "drafts"), exist_ok=True)
    json.dump({"pages": res, "report": REPORT}, open(os.path.join(ROOT, "drafts", "%s-%04d.json" % (md5f(pdf), int(first))), "w", encoding="utf-8"), ensure_ascii=False)


def main():
    if not os.path.isdir(INBOX):
        print("لا يوجد مجلد ocr-inbox"); return
    assemble()
    redo = redo_ids(consume=True)  # طلبات إعادة التحويل من صفحة الإدارة: ocr-inbox/<id>.redo
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
            toc = make_toc(pages)
            pl = printed_labels(len(pages))
            ptoc = toc_from_printed(pages, pl or ["ص %d" % (i + 1) for i in range(len(pages))])
            if ptoc:  # فهرس الطبعة نفسها أدق من العناوين المستخرجة؛ وتبقى العناوين التي قبله (التقديم والمقدمة)
                first = min(x["p"] for x in ptoc)
                toc = [x for x in toc if x["p"] < first and x.get("l") != 2] + ptoc; REPORT.append("- الفهرس: من فهرس الطبعة المطبوع (%d عنوانًا)" % len(ptoc))
            shard = {"id": bid, "pages": pages, "toc": toc, "pl": pl or [f"ص {i+1}" for i in range(len(pages))]}
            if pl: entry["printed"] = True; REPORT.append("- ترقيم الطبعة الورقية: قُرئ في %d صفحة" % len(PNUM))
            card = make_card(pages, toc)
            if card:
                entry["card"] = card; REPORT.append("- بطاقة التعريف: ✓")
                if not author and not existing and card.get("author"):  # المؤلف من صفحة العنوان إن لم يُحدَّد عند الرفع
                    nm = card["author"]
                    hit = next((a for a in cat["authors"] if norm(a["name"]) and (norm(a["name"]) in norm(nm) or norm(nm) in norm(a["name"]))), None)
                    if hit: entry["authorId"] = hit["id"]
                    else:
                        aid = "w" + str(sum(1 for a in cat["authors"] if re.fullmatch(r"w\d+", a["id"])) + 1)
                        cat["authors"].append({"id": aid, "name": nm, "col": entry["col"], "bio": "", "auto": True}); entry["authorId"] = aid
                if not existing and card.get("title") and re.match(r"^up[0-9a-z]+", entry.get("title", "")): entry["title"] = card["title"]
            if UNCERTAIN: shard["unc"] = {str(k): v for k, v in UNCERTAIN.items()}
            if UNREVIEWED: shard["unrev"] = UNREVIEWED[:]
            s = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(DATA, "books", bid + ".json"), "w", encoding="utf-8").write(s)
            entry.update({"n": len(pages), "size": len(s.encode()), "ocr": True,
                          "source": " — ".join(x for x in [re.sub(r"\s*—?\s*نص محوَّل (آليًا|بالذكاء الاصطناعي).*$", "", entry.get("source", "")).strip(" —") if existing else "", "نص محوَّل بالذكاء الاصطناعي من نسخة مصورة، يُرجى الإبلاغ عن أي خطأ" if STATS["gemini"] > STATS["tesseract"] else "نص محوَّل آليًا من نسخة مصورة، يحتاج مراجعة"] if x),
                          "ocrEngine": ("gemini+pro" if STATS.get("pro") else "gemini") + "+tesseract" + ("+surya" if os.environ.get("OCR_SURYA", "1") == "1" else "") if STATS["gemini"] > STATS["tesseract"] else "tesseract",
                          "unc": sum(len(v) for v in UNCERTAIN.values()), "unrev": len(UNREVIEWED),
                          "pdfOffset": entry.get("pdfOffset", 0)})
        if not existing: cat["books"].append(entry)
        print(f"   تم: {entry.get('n', '?')} صفحة")
        REPORT.append("## %s (%s)\n- الصفحات: %s، راجعها Gemini: %d، دون مراجعة: %d، مواضع شك: %d" % (entry.get("title"), bid, entry.get("n", "?"), STATS["gemini"], STATS["tesseract"], sum(len(v) for v in UNCERTAIN.values())))
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "tools", "ocr-report.md"), "w", encoding="utf-8").write("# تقرير آخر تحويل — %s UTC\n\n" % datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M") + "\n".join(REPORT) + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--plan": plan()
    elif len(sys.argv) > 4 and sys.argv[1] == "--drafts": drafts_job(*sys.argv[2:5])
    elif len(sys.argv) > 1 and sys.argv[1] == "--cards": cards_job()
    else: main()
