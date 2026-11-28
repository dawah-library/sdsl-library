#!/usr/bin/env python3
"""توزيع مفاتيح Gemini بين المهام (الحد اليومي لكل مشروع Google، ولكل مفتاح مشروعه).

خدمات الكتب (التدقيق، والاختصارات، والاختبارات، والتشجير، والكراسات، وتجهيز التفريغات) كانت تعمل بعد أن
يستنفد التحويل الضوئي والتشكيل حصة اليوم كلها، فتنجح المهمة ولا تُخرج شيئًا. فيُحجز لها آخر STUDY_KEYS
مفتاحًا (الافتراضي ٦ من ٢٠): لا تمسها المهام الكبيرة، وتبدأ بها خدمات الكتب ثم تنتقل إلى بقية المفاتيح.
STUDY_KEYS=0 يلغي الحجز.
"""
import hashlib, os, time

NAMES = ["GEMINI_API_KEY"] + ["GEMINI_API_KEY_%d" % i for i in range(2, 21)]


def _all():
    return [(n, os.environ.get(n, "").strip()) for n in NAMES if os.environ.get(n, "").strip()]


def _reserved_n(total):
    try:
        n = int(os.environ.get("STUDY_KEYS", "6") or 0)
    except ValueError:
        n = 6
    return max(0, min(n, total - 1)) if total > 1 else 0  # يبقى للمهام الكبيرة مفتاح واحد على الأقل


def _dev_n(total):
    """أول DEV_KEYS مفتاحًا (الافتراضي ٢) محجوزة للمساعد التقني (الوكيل البرمجي): لا تمسها المهام الكبيرة ولا خدمات الكتب،
    فلا يتعطل الوكيل لنفاد الحصة اليومية التي تستنفدها المهام الأخرى."""
    try: n = int(os.environ.get("DEV_KEYS", "2") or 0)
    except ValueError: n = 2
    return max(0, min(n, total - 2)) if total > 3 else 0


def _rot(a):
    """موازنة الحمل (طلب المدير، ٢١ نوفمبر ٢٠٢٦): كانت كل المهام تبدأ بالمفتاح الأول نفسه فتتكدس طلباتها عليه ويُرفض بحد الدقيقة
    بينما بقية المفاتيح خاملة. فتُدار القائمة بإزاحة ثابتة لكل مهمة (رقم التشغيل واسم المهمة)، فتبدأ المهام المتزامنة بمفاتيح مختلفة.
    GKEYS_ROTATE=0 يلغيها."""
    if len(a) < 2 or os.environ.get("GKEYS_ROTATE", "1") == "0": return a
    seed = os.environ.get("GITHUB_RUN_ID", "") + os.environ.get("GITHUB_JOB", "") + os.environ.get("GITHUB_WORKFLOW", "")
    if not seed: return a
    o = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(a)
    return a[o:] + a[:o]


def keys(role="bulk"):
    """role="bulk": التحويل والتشكيل ونحوهما — بلا المفاتيح المحجوزة.
    role="study": خدمات الكتب — المحجوزة أولًا ثم البقية.
    كل مجموعة تُدار بإزاحة خاصة بالمهمة (_rot) مع بقاء الحجز كما هو."""
    ks = [v for _, v in _all()]
    d = _dev_n(len(ks))
    if role == "dev": return ks[:d] + _rot(ks[d:])
    ks = ks[d:]
    r = _reserved_n(len(ks))
    if not r:
        return _rot(ks)
    if role == "study":
        return _rot(ks[-r:]) + _rot(ks[:-r])
    if role == "books":  # جولات التحويل المسائية والليلية: بعد أن تأخذ خدمات الكتب حاجتها صباحًا، يكمل التدقيق بمفاتيحها أيضًا (العامة أولًا)
        return _rot(ks[:-r]) + _rot(ks[-r:])
    return _rot(ks[:-r])


class Pool:
    """توزيع الطلبات على المفاتيح بانتظام واستقرار داخل المهمة:
    - pace(k): فاصل أدنى بين طلبين على المفتاح نفسه (GKEYS_GAP ثوانٍ، الافتراضي ٤ ≈ ١٥ طلبًا في الدقيقة، حد الطبقة المجانية).
    - cool(k, s): تهدئة المفتاح بعد رفض حد الدقيقة (429) أو خطأ الخادم، والانتقال فورًا إلى غيره بدل الانتظار عليه.
    - order(): ترتيب دوّار يبدأ كل طلب بالمفتاح التالي (round-robin) فيتوزع الحمل ولا يُستنفد مفتاح واحد قبل غيره.
    - wait(): ما يلزم انتظاره إن كانت المفاتيح المتاحة كلها في التهدئة."""
    def __init__(self, ks):
        self.ks = list(ks); self.last = {}; self.until = {}; self.i = 0
        try: self.gap = float(os.environ.get("GKEYS_GAP", "4"))
        except ValueError: self.gap = 4.0
        self.n = {}

    def order(self, skip=()):
        n = len(self.ks); st = self.i % max(1, n); self.i += 1
        return [k for k in [(st + j) % n for j in range(n)] if k not in skip]

    def ready(self, k): return time.time() >= self.until.get(k, 0)

    def cool(self, k, s): self.until[k] = max(self.until.get(k, 0), time.time() + s)

    def pace(self, k):
        w = self.last.get(k, 0) + self.gap - time.time()
        if w > 0: time.sleep(w)
        self.last[k] = time.time(); self.n[k] = self.n.get(k, 0) + 1

    def wait(self, skip=()):
        t = [self.until.get(k, 0) for k in range(len(self.ks)) if k not in skip]
        return max(0.0, min(t) - time.time()) if t else 0.0

    def report(self):
        """توزيع الطلبات على المفاتيح في هذه المهمة (للسجل): «مفتاح#ترتيبه: عدد»."""
        return "، ".join("#%d:%d" % (k + 1, v) for k, v in sorted(self.n.items()))


# ---- قياس الاستهلاك (للقياس فقط: لا يغيّر الطلبات ولا نتائجها) ----
# يعدّ طلبات generativelanguage لكل نموذج وحالة في هذا التشغيل، ويطبع سطر «USAGE {…}» في سجل التشغيل عند الخروج،
# ويكتب data/usage/<تاريخ>-<مهمة>-<رقم التشغيل>.json (يُثبَّت في المستودع فقط حيث تضيف خطوة الحفظ data/usage).
def _install_usage_counter():
    import atexit, json, urllib.request, urllib.error
    if getattr(urllib.request, "_sdsl_usage", False): return
    urllib.request._sdsl_usage = True
    stats = {}
    orig = urllib.request.urlopen

    def _count(req, code):
        try:
            u = req.full_url if hasattr(req, "full_url") else str(req)
            if "generativelanguage.googleapis.com" not in u: return
            m = u.split("/models/")[-1].split(":")[0].split("?")[0] if "/models/" in u else "other"
            k = "%s|%s" % (m, code)
            stats[k] = stats.get(k, 0) + 1
        except Exception:
            pass

    def wrapped(req, *a, **kw):
        try:
            r = orig(req, *a, **kw)
        except urllib.error.HTTPError as e:
            _count(req, e.code); raise
        except Exception:
            _count(req, "err"); raise
        _count(req, getattr(r, "status", 200))
        return r
    urllib.request.urlopen = wrapped

    def _dump():
        if not stats: return
        try:
            wf = os.environ.get("GITHUB_WORKFLOW", "local")
            tot = sum(stats.values()); ok = sum(v for k, v in stats.items() if k.endswith("|200"))
            rec = {"workflow": wf, "run": os.environ.get("GITHUB_RUN_ID", ""), "at": time.strftime("%Y-%m-%dT%H:%MZ", time.gmtime()),
                   "total": tot, "ok": ok, "by_model_status": stats}
            print("USAGE " + json.dumps(rec, ensure_ascii=False))
            d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "usage")
            os.makedirs(d, exist_ok=True)
            # اسم فريد لكل جهاز: أجهزة المصفوفة المتوازية (٢٤ جهاز مراجعة في ocr.yml) كانت تكتب الملف نفسه فيتعارض الحفظ (add/add) في كل جولة (٢٨ نوفمبر)
            tag = "".join(c if c.isalnum() else "_" for c in (os.environ.get("OCR_ONLY") or os.environ.get("GITHUB_JOB") or ""))[-24:]
            fn = "%s-%s-%s%s-%d.json" % (time.strftime("%Y%m%d", time.gmtime()), "".join(c if c.isalnum() else "_" for c in wf)[:30], rec["run"] or "x", ("-" + tag) if tag else "", os.getpid())
            json.dump(rec, open(os.path.join(d, fn), "w", encoding="utf-8"), ensure_ascii=False)
        except Exception:
            pass
    atexit.register(_dump)


if os.environ.get("USAGE_LOG", "1") != "0":
    _install_usage_counter()
