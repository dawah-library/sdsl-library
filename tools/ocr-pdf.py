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
    t = re.sub(r"([،؛؟])(?=[\u0621-\u064A«(])", r"\1 ", t)
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
GKEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 10)] if k.strip()]
# محرك إضافي مجاني: GitHub Models (نماذج OpenAI عبر رمز GitHub Actions نفسه، بلا حساب ولا مفتاح جديد) — يعمل بجوار Gemini
GHM_TOKEN = os.environ.get("GITHUB_MODELS_TOKEN", "").strip()
GHM_MODELS = [m for m in os.environ.get("GHM_MODELS", "openai/gpt-4.1,openai/gpt-4.1-mini").split(",") if m.strip()]
GHM_EXH = set()
NBOOKS = max(1, int(os.environ.get("OCR_NBOOKS", "1") or 1))
KW = max(1, len(GKEYS) // min(NBOOKS, max(1, len(GKEYS)))) if GKEYS else 1  # خيوط هذا الجهاز (مفتاح لكل خيط)
if GKEYS:  # في التحويل المتوازي يبدأ كل جهاز بمفاتيح مختلفة، فلا يتزاحم جهازان على مفتاح واحد
    _k = int(os.environ.get("GEMINI_KEY_START", "0") or 0) * KW % len(GKEYS); GKEYS = GKEYS[_k:] + GKEYS[:_k]
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
- الجداول: اكتبها جدولًا بصيغة Markdown (| خانة | خانة |) بالترتيب نفسه من اليمين.
- الرسوم والمشجّرات والخرائط والصور داخل الصفحة: لا تحاول نسخها، بل اكتب في موضعها سطرًا: [رسم: وصف قصير لمحتواه]، وانسخ ما فيها من كلمات مهمة داخل الوصف.
- إن كانت الصفحة مكتوبة بخط اليد (مخطوط) فاجعل أول سطر بعد رقم الصفحة: [مخطوط] ثم انسخها بأدق ما تستطيع، وضع كل كلمة غير متيقنة بين ⟪ ⟫.
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
HAND = set()  # صفحات مخطوطة بخط اليد: تُحال إلى المدقق الأقوى وتُعلَّم للمراجعة
REPORT = []
UNREVIEWED = []  # صفحات لم يراجعها Gemini (ازدحام أو نفاد الحصة)
UNCERTAIN = {}  # رقم الصفحة (من صفر) ← كلمات شكّ فيها المراجع
_glast = [0.0]
import threading
TL = threading.local()  # كل خيط مراجعة يعمل بمفتاح Gemini خاص به (TL.k) فتتضاعف السرعة بعدد المفاتيح
KLAST, KLOCK = {}, threading.Lock()


GFAIL = [0]  # إخفاقات Gemini المتتالية: بعد عدد منها يكمل الكتاب بـ Tesseract ويعلّم الصفحات لإعادة المراجعة لاحقًا


from collections import Counter
ERRS = Counter()  # أخطاء Gemini مجمَّعة للتقرير
KEXH = set()  # مفاتيح نفدت حصتها اليومية في كل النماذج
MEXH = set()  # (مفتاح، نموذج) نفدت حصته اليومية: لكل نموذج حصة مستقلة، فننتقل إلى النموذج البديل قبل ترك المفتاح
LITE = set()  # صفحات قرأها النموذج الخفيف (حين نفدت حصة الأساسي): تُعاد قراءتها بالأساسي لاحقًا


def _next_key(ki):
    for d in range(1, len(GKEYS) + 1):
        k = (ki + d) % len(GKEYS)
        if k not in KEXH: return k
    return None


def ghm_call(parts, max_tokens):
    """الطلب نفسه إلى GitHub Models (صيغة OpenAI)؛ يعيد النص، أو None إن نفدت حصته اليومية في كل نماذجه."""
    content = []
    for p in parts:
        if "text" in p: content.append({"type": "text", "text": p["text"]})
        elif "inline_data" in p: content.append({"type": "image_url", "image_url": {"url": "data:%s;base64,%s" % (p["inline_data"]["mime_type"], p["inline_data"]["data"]), "detail": "high"}})
    for m in GHM_MODELS:
        if m in GHM_EXH: continue
        body = json.dumps({"model": m, "messages": [{"role": "user", "content": content}], "temperature": 0, "max_tokens": min(max_tokens, 4000)}).encode()
        for attempt in range(4):
            try:
                req = urllib.request.Request("https://models.github.ai/inference/chat/completions", data=body, headers={"content-type": "application/json", "authorization": "Bearer " + GHM_TOKEN})
                with urllib.request.urlopen(req, timeout=300) as r: j = json.loads(r.read())
                t = ((j.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
                if t.strip(): TL.model = m; STATS["ghm"] = STATS.get("ghm", 0) + 1; return t
                break
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore"); ERRS["GitHub %s %s" % (m, e.code)] += 1
                print("    GitHub Models %s %s: %s" % (m, e.code, msg[:140]), flush=True)
                if e.code == 429 and re.search(r"day|daily|UserByDay", msg, re.I): GHM_EXH.add(m); break
                if e.code == 413 or e.code == 400: break  # الطلب أكبر من حد الخطة المجانية
                if e.code in (401, 403): GHM_EXH.update(GHM_MODELS); return None
                time.sleep(min(60, 10 * (attempt + 1)))
            except Exception as e:
                ERRS["GitHub اتصال"] += 1; time.sleep(5 * (attempt + 1))
    return None


def gemini_call(parts, max_tokens=8192, models=None, fail=None):
    """طلب واحد إلى Gemini مع إعادة المحاولة بصبر عند الازدحام، وتبديل المفتاح عند نفاد حصته؛ يعيد النص أو None.
    الخيوط المخصصة لـ GitHub Models تجرّبه أولًا، فإن نفدت حصته تحوّلت إلى Gemini."""
    if getattr(TL, "provider", "") == "ghm" and models is None:
        t = ghm_call(parts, max_tokens)
        if t is not None: return t
        TL.provider = ""  # نفدت حصة GitHub Models: يكمل هذا الخيط بـ Gemini
        if not GKEYS: return None
    if not GKEYS: return None
    fail = fail or GFAIL
    if fail[0] >= int(os.environ.get("GEMINI_MAX_FAILS", "25")) or len(KEXH) >= len(GKEYS):
        return None
    body = json.dumps({"contents": [{"role": "user", "parts": parts}],
                       "generationConfig": {"temperature": 0, "maxOutputTokens": max_tokens}}).encode()
    models = list(models or GMODELS); models_all = list(models)
    for attempt in range(9):
        ki = getattr(TL, "k", None)
        ki = (KI[0] if ki is None else ki) % len(GKEYS)
        if ki in KEXH:
            nk = _next_key(ki)
            if nk is None: return None
            ki = nk; TL.k = nk
        mm = [m for m in models if (ki, m) not in MEXH]
        if not mm:  # كل نماذج هذا المفتاح نفدت اليوم
            KEXH.add(ki); models = list(models_all)
            if len(KEXH) >= len(GKEYS): fail[0] = 99; return None
            continue
        models = mm
        with KLOCK:  # التباعد بين الطلبات لكل مفتاح على حدة (حد الطلبات في الدقيقة)
            nxt = max(time.time(), KLAST.get(ki, 0.0) + GDELAY); KLAST[ki] = nxt
        if nxt > time.time(): time.sleep(nxt - time.time())
        req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % models[0], data=body,
                                     headers={"content-type": "application/json", "x-goog-api-key": GKEYS[ki]})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.loads(r.read())
            c = (j.get("candidates") or [{}])[0]
            t = "".join(p.get("text", "") for p in (c.get("content") or {}).get("parts", []) if not p.get("thought"))
            if t.strip():
                fail[0] = 0
                TL.model = models[0]
                return t
            ERRS["%s رد فارغ (%s)" % (models[0], c.get("finishReason"))] += 1
            raise RuntimeError("رد فارغ: %s" % c.get("finishReason"))
        except urllib.error.HTTPError as e:
            msg = e.read()[:600].decode("utf-8", "ignore")
            daily = e.code == 429 and re.search(r"PerDay|per day|daily", msg, re.I)
            ERRS["%s %s%s" % (models[0], e.code, " (الحصة اليومية)" if daily else "")] += 1
            print("    Gemini %s %s: %s" % (models[0], e.code, msg[:160]), flush=True)
            if e.code == 404 and len(models) > 1: models.pop(0); continue
            if daily:  # نفدت حصة هذا النموذج على هذا المفتاح اليوم: جرّب النموذج البديل ثم المفاتيح الأخرى
                MEXH.add((ki, models[0])); print("    نفدت الحصة اليومية لـ %s على المفتاح %d" % (models[0], ki + 1), flush=True)
                continue
            if e.code == 429:  # حد الدقيقة: انتظر ثم أعد، وجرّب مفتاحًا آخر إن وُجد
                nk = _next_key(ki)
                if nk is not None and getattr(TL, "k", None) is not None: TL.k = nk
                time.sleep(min(60, 10 * (attempt + 1))); continue
            if e.code in (401, 403): fail[0] = 99; return None
            if e.code in (500, 503) and len(models) > 1 and attempt >= 3: models.pop(0)  # بعد عدة محاولات جرّب النموذج البديل
            time.sleep(min(90, 8 * 2 ** min(attempt, 3)))  # صبر متزايد على الازدحام المؤقت
        except Exception as e:
            ERRS["خطأ اتصال"] += 1
            print("    Gemini خطأ: %r" % e, flush=True); time.sleep(6 * (attempt + 1))
    fail[0] += 1
    return None


# ---------- الكتب الإلكترونية: استخراج طبقة النص مباشرة بلا تحويل ضوئي ----------
import unicodedata
COMMON = ["الله", "في", "من", "على", "التي", "الذي", "هذا", "قال", "إلى", "عن"]


def _score(t):
    w = re.findall(r"[\u0621-\u064A]+", t)
    return sum(1 for x in w if x in COMMON), sum(1 for x in w if x[::-1] in COMMON and x not in COMMON)


def textlayer(pdf, p):
    """نص الصفحة من طبقة PDF إن كانت سليمة، وإلا None (فتُحوَّل ضوئيًا)."""
    r = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), "-enc", "UTF-8", pdf, "-"], capture_output=True, text=True)
    t = re.sub(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", unicodedata.normalize("NFKC", r.stdout or "").replace("\x0c", ""))
    ar = len(re.findall(r"[\u0621-\u064A]", t))
    if ar < 40: return None
    if len(re.findall(r"[\uFFFD\u25A1]|[\u00C0-\u00FF]{3,}", t)) > 3: return None  # ترميز مكسور
    good, rev = _score(t)
    if rev > good:  # بعض ملفات العربية تخزن السطر مقلوبًا
        t = "\n".join(l[::-1].translate(str.maketrans("()[]{}«»", ")(][}{»«")) for l in t.split("\n")); good, rev = _score(t)
    if good < 2 or rev > good * 0.3: return None
    return re.sub(r"[ \t]+", " ", t).strip()


FORMAT_PROMPT = """أمامك نص صفحات من كتاب عربي مستخرج من ملف PDF إلكتروني (النص صحيح الحروف لكن تنسيقه مفقود).
أعد تنسيقه دون تغيير أي كلمة أو تشكيل، ولا تحذف ولا تضف شيئًا من عندك، إلا إصلاح عيوب الاستخراج الآلي المعروفة وحدها:
- حرف «لا» المركّب يخرج مقلوبًا: «بالد» صوابها «بلاد»، «اإلسالم» صوابها «الإسلام»، «ألجندته» صوابها «لأجندته»، «إل/أل/آل» داخل الكلمة صوابها «لإ/لأ/لآ» حيث يقتضي المعنى.
- مسافات زائدة داخل الكلمة أو كلمتان ملتصقتان، والتنوين أو الشدة المزاحة عن حرفها (مثل «إرضاًء» صوابها «إرضاءً»).
- ابدأ كل صفحة بسطر رقمها المطبوع إن ظهر في النص بالصيغة [ص: 12] وإلا [ص: -]، واحذف ترويسة الصفحة المتكررة ورقمها من المتن.
- العنوان الرئيس في سطر يبدأ بـ «# » والفرعي بـ «## ».
- كل فقرة في سطر واحد متصل (ادمج الأسطر المكسورة).
- الحواشي أسفل الصفحة: سطر ______ ثم كل حاشية في سطر برقمها.
- الشعر: كل بيت في سطر وبين الشطرين « ... ». والجداول بصيغة Markdown.
اكتب كل صفحة مسبوقة بسطر مستقل: ===== صفحة N ===== كما هو في المدخل، دون أي شيء آخر."""


def format_digital(texts):
    """تنسيق نص الصفحات الإلكترونية (طلب نصي بلا صور: سريع وزهيد)؛ يعيد قائمة أو None."""
    body = "\n".join("===== صفحة %d =====\n%s" % (k, t[:7000]) for k, t in enumerate(texts, 1))
    t = gemini_call([{"text": FORMAT_PROMPT + "\n\n" + body}], max_tokens=min(60000, 3500 * len(texts)))
    if not t: return None
    pieces = SEP.split(t)
    got = {int(pieces[i]): pieces[i + 1] for i in range(1, len(pieces) - 1, 2)}
    if sorted(got) != list(range(1, len(texts) + 1)): return None
    return [got[k].strip() for k in range(1, len(texts) + 1)]


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
        parts += [{"text": "===== صفحة %d =====" % k}, img_part(img)]
        if d.strip(): parts.append({"text": "مسودات الصفحة %d من أدوات تعرّف ضوئي أخرى:\n<<<\n%s\n>>>" % (k, d[:9000])})
    hint = "لكل صفحة صورتها ومسودة أو مسودتان من أدوات تعرّف ضوئي أخرى قد تحتوي أخطاء. اعتمد على الصورة أولًا وقارن بالمسودات (ما اتفقت عليه المسودتان والصورة فهو ثابت)، " if any(d.strip() for d in drafts) else "لكل صفحة صورتها. اقرأ كل صورة بعناية حرفًا حرفًا، "
    parts.append({"text": PROMPT + "\n\nأمامك %d صفحات متتالية، %sوما بقي فيه شك فضعه بين ⟪ ⟫. اكتب نص كل صفحة مسبوقًا بسطر مستقل بالصيغة:\n===== صفحة 1 =====\nثم نصها، وهكذا حتى الصفحة %d، دون أي شيء آخر." % (len(imgs), hint, len(imgs))})
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
    order = sorted(UNCERTAIN, key=lambda i: (i not in HAND, -len(UNCERTAIN[i])))[:limit]
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


_TESS_OK = []


def ensure_tesseract():
    """يثبَّت Tesseract عند الحاجة فقط (الاحتياط)، فلا يُضيَّع وقت تثبيته في كل تحويل."""
    if _TESS_OK or (shutil.which("tesseract") and os.path.exists(os.path.join(os.environ.get("TESSDATA_PREFIX", ""), "ara.traineddata"))): return
    print("  تثبيت Tesseract للاحتياط…", flush=True)
    subprocess.run(["bash", "-c", "which tesseract || (sudo apt-get update -qq && sudo apt-get install -y -qq tesseract-ocr)"], check=False)
    td = os.environ.get("TESSDATA_PREFIX") or os.path.join(ROOT, "tessdata"); os.makedirs(td, exist_ok=True); os.environ["TESSDATA_PREFIX"] = td
    f = os.path.join(td, "ara.traineddata")
    if not os.path.exists(f): urllib.request.urlretrieve("https://github.com/tesseract-ocr/tessdata_best/raw/main/ara.traineddata", f)
    _TESS_OK.append(1)


def tess_page(pdf, p, td):
    ensure_tesseract()
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


def ocr(pdf, first=1, last=None, only=None, prior=None):
    """١) الصفحات الإلكترونية: طبقة النص مباشرة مع تنسيق نصي سريع ٢) المصوَّرة: Gemini يقرأ الصور (مع مسودات Tesseract إن أُعدّت)
    ٣) مدقق ثانٍ أقوى لمواضع الشك والمخطوطات ٤) Tesseract احتياطيًا لما تعذّر على Gemini."""
    from concurrent.futures import ThreadPoolExecutor
    n = pages_count(pdf)
    last = min(last or n, n)
    nums = list(range(first, last + 1)) if not only else [p for p in only if 1 <= p <= n]
    STATS.update(gemini=0, tesseract=0, pro=0, digital=0); PNUM.clear(); UNCERTAIN.clear(); UNREVIEWED.clear(); HAND.clear(); LITE.clear(); GFAIL[0] = 0
    batch = max(1, int(os.environ.get("GEMINI_BATCH", "4")))
    ready = load_drafts(pdf)
    pages = [""] * len(nums); reviewed = [False] * len(nums)
    # ١) طبقة النص
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex: tl = list(ex.map(lambda p: textlayer(pdf, p), nums))
    dig = [i for i, t in enumerate(tl) if t]
    if dig:
        print("  صفحات إلكترونية (طبقة نص سليمة): %d من %d" % (len(dig), len(nums)), flush=True)
        REPORT.append("- صفحات إلكترونية استُخرج نصها مباشرة: %d من %d" % (len(dig), len(nums)))
        groups = [dig[k:k + 8] for k in range(0, len(dig), 8)]
        def fmt(job):
            wi, idx = job
            if GKEY and getattr(TL, "k", None) is None: TL.k = wi % len(GKEYS)
            res = format_digital([tl[i] for i in idx]) if GKEY else None
            for j, i in enumerate(idx):
                g = res[j] if res else tl[i]
                g = take_pnum(i, g) if res else g
                pages[i] = gemini_clean(g); reviewed[i] = True; STATS["digital"] += 1
        with ThreadPoolExecutor(max_workers=KW) as ex: list(ex.map(fmt, list(enumerate(groups))))
    scan = [i for i in range(len(nums)) if not reviewed[i]]
    print("  صفحات مصورة تُقرأ بالذكاء الاصطناعي: %d" % len(scan) + (" (مع مسودات Tesseract لـ %d)" % sum(1 for i in scan if nums[i] in ready) if ready else ""), flush=True)
    with tempfile.TemporaryDirectory() as td:
        def jpg(p):
            subprocess.run(["pdftoppm", "-r", os.environ.get("OCR_DPI", "200"), "-jpeg", "-jpegopt", "quality=82", "-f", str(p), "-l", str(p), "-singlefile", pdf, os.path.join(td, f"p{p}")], check=True)
        if (GKEY or GHM_TOKEN) and scan:
            with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex: list(ex.map(jpg, [nums[i] for i in scan]))
        def drafts_of(i):
            if prior and prior.get(nums[i]): return "[النص الحالي للصفحة، وقد يحتوي أخطاء قراءة]\n" + prior[nums[i]]
            r = ready.get(nums[i]) or {}
            d, su = r.get("t", ""), r.get("s", "")
            return ("[مسودة Tesseract]\n" + d if d else "") + ("\n\n[مسودة Surya]\n" + su if su else "")
        def accept(i, g):
            g = take_pnum(i, g)
            if g.lstrip().startswith("[مخطوط]"): HAND.add(i); g = g.lstrip()[len("[مخطوط]"):]
            words = [w.strip() for w in UNC.findall(g) if w.strip()]
            if words: UNCERTAIN[i] = words[:40]
            elif i in HAND: UNCERTAIN[i] = ["(صفحة مخطوطة)"]
            pages[i] = gemini_clean(UNC.sub(r"\1", g)); reviewed[i] = True
            if re.search(r"lite|mini", getattr(TL, "model", "") or ""): LITE.add(i)  # النماذج الخفيفة تُعاد مراجعتها لاحقًا بالأقوى
            else: LITE.discard(i)
        if (GKEY or GHM_TOKEN) and scan:
            groups = [scan[k:k + batch] for k in range(0, len(scan), batch)]
            GW = KW * int(os.environ.get("GEMINI_PER_KEY", "1"))
            HW = int(os.environ.get("GHM_WORKERS", "2")) if GHM_TOKEN else 0
            workers = GW + HW
            done = [0]; slots = iter(range(10 ** 6)); slot_lock = threading.Lock()
            def review(job):
                wi, idx = job
                if getattr(TL, "slot", None) is None:  # كل خيط يثبت على محرك واحد: مفاتيح Gemini أولًا ثم GitHub Models
                    with slot_lock: TL.slot = next(slots)
                    TL.k = TL.slot % max(1, len(GKEYS))
                    TL.provider = "ghm" if TL.slot >= GW else ""
                if getattr(TL, "provider", "") == "ghm" and len(idx) > 2:  # حد الخطة المجانية لحجم الطلب: صفحتان في الطلب
                    for k2 in range(0, len(idx), 2): review((wi, idx[k2:k2 + 2]))
                    return
                imgs = [os.path.join(td, f"p{nums[i]}.jpg") for i in idx]
                res = gemini_batch(imgs, [drafts_of(i) for i in idx]) if len(idx) > 1 else None
                if res:
                    for i, g in zip(idx, res): accept(i, g)
                else:
                    for i, img in zip(idx, imgs):
                        g = gemini_page(img, drafts_of(i))
                        if g is not None: accept(i, g)
                done[0] += len(idx); print(f"  روجعت {done[0]}/{len(scan)} صفحة", flush=True)
            print("  المراجعة بالتوازي: %d خيوط (%d Gemini على %d مفاتيح + %d GitHub Models)" % (workers, GW, len(GKEYS), HW), flush=True)
            with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="rv") as ex:
                list(ex.map(review, list(enumerate(groups))))
            if HAND: REPORT.append("- صفحات مخطوطة بخط اليد: %d (أُحيلت إلى المدقق الأقوى وتحتاج مراجعة بشرية)" % len(HAND))
            pro_pass(pdf, nums, pages, td)
        # ٤) الاحتياط: Tesseract لما لم يُقرأ (من المسودة الجاهزة إن وُجدت)
        rest = [i for i in range(len(nums)) if not reviewed[i]]
        if rest:
            print("  Tesseract احتياطيًا لـ %d صفحة" % len(rest), flush=True)
            need = [nums[i] for i in rest if not (ready.get(nums[i]) or {}).get("t")]
            if need:
                ensure_tesseract()
                with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex: got = dict(zip(need, ex.map(lambda p: tess_page(pdf, p, td), need)))
            else: got = {}
            for i in rest:
                r = ready.get(nums[i]) or {}
                pages[i] = r.get("s") or r.get("t") or got.get(nums[i], "")
        for i, ok in enumerate(reviewed):
            if ok: STATS["gemini"] += 1
            else:
                STATS["tesseract"] += 1
                if GKEY: UNREVIEWED.append(i)
    return pages


ONLY = os.environ.get("OCR_ONLY", "").strip()  # في التحويل المتوازي: كل جهاز يعالج كتابًا واحدًا
ONLY_BASE = os.path.basename(ONLY)[:-4] if ONLY.lower().endswith(".pdf") else ""


def assemble():
    # تجميع الملفات المرفوعة أجزاءً من صفحة الإدارة: <اسم>.pdf.part001… ثم <اسم>.ready
    for f in sorted(os.listdir(INBOX)):
        if f.endswith(".ready"):
            base = f[:-6]
            if ONLY_BASE and base != ONLY_BASE: continue
            parts = sorted(x for x in os.listdir(INBOX) if x.startswith(base + ".pdf.part"))
            up = os.path.join(INBOX, base + ".url")
            st = os.path.join(INBOX, base + ".store")
            if os.path.exists(st):  # رُفع الملف إلى صندوق الرفع الخاص: نطلب رابطًا مؤقتًا من الموقع برمز OIDC
                try:
                    tok = json.loads(urllib.request.urlopen(urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library", headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=20).read())["value"]
                    site = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
                    url = json.loads(urllib.request.urlopen(urllib.request.Request(site + "/api/r2put?f=" + base + ".pdf", headers={"Authorization": "Bearer " + tok}), timeout=30).read())["url"]
                    with urllib.request.urlopen(url, timeout=600) as r, open(os.path.join(INBOX, base + ".pdf"), "wb") as out: shutil.copyfileobj(r, out, 1 << 20)
                    os.remove(st); os.remove(os.path.join(INBOX, f)); print("نُزّل من صندوق الرفع:", base); continue
                except Exception as e:
                    print("تعذر تنزيل", base, e); continue
            if os.path.exists(up):  # الطريقة القديمة (رابط موقَّع محفوظ)
                url = open(up).read().strip()
                try:
                    with urllib.request.urlopen(url, timeout=600) as r, open(os.path.join(INBOX, base + ".pdf"), "wb") as out: shutil.copyfileobj(r, out, 1 << 20)
                    os.remove(up); os.remove(os.path.join(INBOX, f)); print("نُزّل من المخزن:", base); continue
                except Exception as e:
                    print("تعذر تنزيل", base, e); continue
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
            if consume and ONLY and ONLY != "pdf/%s.pdf" % f[:-5]: continue  # يخص جهازًا آخر
            ids.append(f[:-5])
            if consume: os.remove(os.path.join(INBOX, f))
    return ids


def plan():
    """يقسم صفحات الكتب المنتظرة على أجهزة متوازية لإعداد المسودات (Tesseract وSurya) بسرعة."""
    shards, books = [], []
    if os.path.isdir(INBOX):
        assemble()
        files = [os.path.join("ocr-inbox", f) for f in sorted(os.listdir(INBOX)) if f.lower().endswith(".pdf")]
        files += [os.path.join("pdf", b + ".pdf") for b in redo_ids() if local_pdf(b)]
        jobs = []
        for f in files:
            side = os.path.join(ROOT, f[:-4] + ".json")
            cfg = json.load(open(side, encoding="utf-8")) if f.startswith("ocr-inbox") and os.path.exists(side) else {}
            if f.startswith("ocr-inbox") and cfg.get("book") and not cfg.get("ocr"): continue  # ربط نسخة مصورة بلا تحويل
            n = pages_count(os.path.join(ROOT, f))
            if n: jobs.append((f, n))
        books = [f for f, _ in jobs]
        if os.environ.get("OCR_REREVIEW", "") == "1" or not books:  # إكمال الصفحات التي فاتتها المراجعة (يوميًا بعد تجدد الحصة)
            cat = json.load(open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
            need = [b for b in cat["books"] if (b.get("unrev") or b.get("lite") or b.get("unc")) and (b.get("img") == "r2" or os.path.exists(os.path.join(ROOT, b.get("pdfLocal") or "pdf/%s.pdf" % b["id"])))]
            need.sort(key=lambda b: (-(b.get("unrev") or 0), -(b.get("lite") or 0), -(b.get("unc") or 0)))  # الأحوج أولًا
            books += ["rereview:" + b["id"] for b in need][:6]
        if os.environ.get("OCR_TESS", "0") != "1":  # المسودات اختيارية: Gemini يقرأ الصور مباشرة
            jobs = []
        else:  # لا مسودات للكتب الإلكترونية (طبقة نص سليمة)
            jobs = [(f, n) for f, n in jobs if not textlayer(os.path.join(ROOT, f), min(n, 5))]
        total = sum(n for _, n in jobs); maxj = int(os.environ.get("OCR_MACHINES", "12"))
        size = max(int(os.environ.get("OCR_SHARD", "30")), -(-total // maxj)) if total else 1
        for f, n in jobs:
            for a in range(1, n + 1, size): shards.append({"path": f, "first": a, "last": min(n, a + size - 1)})
    out = json.dumps(shards, ensure_ascii=False)
    print("الأجزاء:", out)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as g: g.write("shards=%s\nany=%s\nbooks=%s\nnbooks=%d\n" % (out, "1" if shards else "0", json.dumps(books, ensure_ascii=False), len(books)))
    print("الكتب:", books)


def drafts_job(path, first, last):
    if os.path.isdir(INBOX): assemble()
    pdf = os.path.join(ROOT, path)
    res = make_drafts(pdf, list(range(int(first), int(last) + 1)))
    os.makedirs(os.path.join(ROOT, "drafts"), exist_ok=True)
    json.dump({"pages": res, "report": REPORT}, open(os.path.join(ROOT, "drafts", "%s-%04d.json" % (md5f(pdf), int(first))), "w", encoding="utf-8"), ensure_ascii=False)


def oidc_get(path):
    """طلب إلى الموقع بهوية مهمة GitHub (OIDC) دون مفاتيح."""
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library", headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=20).read())["value"]
    site = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
    return json.loads(urllib.request.urlopen(urllib.request.Request(site + path, headers={"Authorization": "Bearer " + tok}), timeout=30).read())


def local_pdf(bid):
    """نسخة الكتاب المصور محليًا: من المستودع إن وُجدت، وإلا من مخزن R2 الخاص (لا تُحفظ في المستودع العام)."""
    dest = os.path.join(PDFDIR, bid + ".pdf")
    if os.path.exists(dest): return dest
    try:
        url = oidc_get("/api/r2put?pdf=" + bid)["url"]
        os.makedirs(PDFDIR, exist_ok=True)
        with urllib.request.urlopen(url, timeout=600) as r, open(dest, "wb") as out: shutil.copyfileobj(r, out, 1 << 20)
        print("نُزّلت النسخة المصورة من المخزن:", bid); return dest
    except Exception as e:
        print("تعذر تنزيل النسخة المصورة", bid, e); return None


def rereview(bid):
    """التدقيق الدوري لكتاب محفوظ دون إعادته كله: يعيد قراءة الصفحات من صورها بالترتيب:
    ١) التي فاتتها مراجعة Gemini (نص Tesseract)  ٢) التي قرأها النموذج الخفيف  ٣) التي فيها كلمات مشكوك فيها."""
    sp = os.path.join(DATA, "books", bid + ".json")
    sh = json.load(open(sp, encoding="utf-8"))
    unrev, lite, unc0 = sorted(set(sh.get("unrev") or [])), sorted(set(sh.get("lite") or [])), dict(sh.get("unc") or {})
    order = unrev + [i for i in lite if i not in unrev] + [int(k) for k in sorted(unc0, key=lambda k: -len(unc0[k])) if int(k) not in unrev and int(k) not in lite]
    idx = sorted(order[:int(os.environ.get("OCR_REREVIEW_MAX", "320"))])
    cat_path = os.path.join(DATA, "catalog.json"); cat = json.load(open(cat_path, encoding="utf-8"))
    b = next((x for x in cat["books"] if x["id"] == bid), None)
    pdf = local_pdf(bid) if idx else None
    if not idx or not pdf: print("لا شيء لتدقيقه في", bid); return
    print("== تدقيق %s: %d صفحة (فاتتها المراجعة %d، خفيفة %d، فيها شك %d)" % (bid, len(idx), len(unrev), len(lite), len(unc0)), flush=True)
    # النص الحالي مسودةً يستعين بها Gemini مع الصورة
    os.environ["OCR_DRAFTS"] = ""
    new = ocr(pdf, only=[i + 1 for i in idx], prior={i + 1: sh["pages"][i] for i in idx})
    left, lite2, unc = set(unrev), set(lite), dict(unc0)
    fixed = 0
    for k, i in enumerate(idx):
        if k in UNREVIEWED: continue
        sh["pages"][i] = new[k]; fixed += 1
        left.discard(i)
        if k in LITE: lite2.add(i)
        else: lite2.discard(i)
        if k in UNCERTAIN: unc[str(i)] = UNCERTAIN[k]
        else: unc.pop(str(i), None)
    for key, val in (("unrev", sorted(left)), ("lite", sorted(lite2)), ("unc", unc)):
        if val: sh[key] = val
        else: sh.pop(key, None)
    s_ = json.dumps(sh, ensure_ascii=False, separators=(",", ":")); open(sp, "w", encoding="utf-8").write(s_)
    if b:
        b.update({"unrev": len(left), "lite": len(lite2), "unc": sum(len(v) for v in unc.values()), "size": len(s_.encode())})
        if not left: b["ocrEngine"] = "gemini+tesseract"
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("## تدقيق %s (%s)\n- أُعيدت قراءته: %d صفحة؛ بقي دون مراجعة: %d، بالنموذج الخفيف: %d، مواضع شك: %d" % ((b or {}).get("title", bid), bid, fixed, len(left), len(lite2), sum(len(v) for v in unc.values())))
    if ERRS: REPORT.append("- أخطاء Gemini: " + "، ".join("%s ×%d" % kv for kv in ERRS.most_common(6)))
    open(os.path.join(ROOT, "tools", "ocr-report.md"), "w", encoding="utf-8").write("# تقرير آخر تحويل — %s UTC\n\n" % datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M") + "\n".join(REPORT) + "\n")


def main():
    if ONLY.startswith("rereview:"): return rereview(ONLY.split(":", 1)[1])
    if not os.path.isdir(INBOX):
        print("لا يوجد مجلد ocr-inbox"); return
    assemble()
    redo = redo_ids(consume=True)  # طلبات إعادة التحويل من صفحة الإدارة: ocr-inbox/<id>.redo
    if ONLY: redo = [b for b in redo if ONLY == "pdf/%s.pdf" % b]
    for bid in redo:  # إعادة تحويل كتاب موجود من نسخته المصورة المحفوظة
        src = local_pdf(bid) or os.path.join(PDFDIR, bid + ".pdf")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(INBOX, "redo-" + bid + ".pdf"))
            json.dump({"book": bid, "ocr": True}, open(os.path.join(INBOX, "redo-" + bid + ".json"), "w", encoding="utf-8"))
        else:
            print("لا توجد نسخة مصورة محفوظة للكتاب", bid)
    pdfs = sorted(f for f in os.listdir(INBOX) if f.lower().endswith(".pdf"))
    if ONLY: pdfs = [f for f in pdfs if f[:-4] == ONLY_BASE or ONLY == "pdf/%s.pdf" % f[5:-4]]
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
        if not entry.get("img"): entry["pdf"] = f"pdf/{bid}.pdf"  # إن كان في مخزن R2 يبقى رابطه
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
            if LITE: shard["lite"] = sorted(LITE)
            s = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(DATA, "books", bid + ".json"), "w", encoding="utf-8").write(s)
            entry.update({"n": len(pages), "size": len(s.encode()), "ocr": True,
                          "source": " — ".join(x for x in [re.sub(r"\s*—?\s*نص محوَّل (آليًا|بالذكاء الاصطناعي).*$", "", entry.get("source", "")).strip(" —") if existing else "", "نص محوَّل بالذكاء الاصطناعي من نسخة مصورة، يُرجى الإبلاغ عن أي خطأ" if STATS["gemini"] > STATS["tesseract"] else "نص محوَّل آليًا من نسخة مصورة، يحتاج مراجعة"] if x),
                          "ocrEngine": ("gemini+pro" if STATS.get("pro") else "gemini") + "+tesseract" + ("+surya" if os.environ.get("OCR_SURYA", "1") == "1" else "") if STATS["gemini"] > STATS["tesseract"] else "tesseract",
                          "unc": sum(len(v) for v in UNCERTAIN.values()), "unrev": len(UNREVIEWED), "lite": len(LITE),
                          "pdfOffset": entry.get("pdfOffset", 0)})
        if not existing: cat["books"].append(entry)
        print(f"   تم: {entry.get('n', '?')} صفحة")
        if ERRS: REPORT.append("- أخطاء Gemini: " + "، ".join("%s ×%d" % kv for kv in ERRS.most_common(6))); ERRS.clear()
        if STATS.get("digital"): REPORT.append("- منها إلكترونية: %d" % STATS["digital"])
        REPORT.append("## %s (%s)\n- الصفحات: %s، راجعها Gemini: %d، دون مراجعة: %d، مواضع شك: %d" % (entry.get("title"), bid, entry.get("n", "?"), STATS["gemini"], STATS["tesseract"], sum(len(v) for v in UNCERTAIN.values())))
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "tools", "ocr-report.md"), "w", encoding="utf-8").write("# تقرير آخر تحويل — %s UTC\n\n" % datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M") + "\n".join(REPORT) + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--plan": plan()
    elif len(sys.argv) > 4 and sys.argv[1] == "--drafts": drafts_job(*sys.argv[2:5])
    elif len(sys.argv) > 1 and sys.argv[1] == "--cards": cards_job()
    else: main()
