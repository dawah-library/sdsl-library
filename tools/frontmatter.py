#!/usr/bin/env python3
"""ما هو خارج مضمون الكتاب: صفحة العنوان وبيانات الطبعة والنشر والحقوق، والفهارس وثبت المراجع.
تستعمله الصوتيات (فلا تُقرأ) والتشجير (فلا تُشجَّر) والخلاصات. لكل كتاب استثناءات من الإدارة: {"front": n, "back": n, "pages": [..]}."""
import re

FN = re.compile(r"^\s*_{4,}\s*$", re.M)
PUB = re.compile(r"ISBN|ردمك|رقم الإيداع|الترقيم الدولي|حقوق الطبع|جميع الحقوق|الحقوق محفوظة|محفوظة للمؤلف|محفوظة للناشر|للنشر والتوزيع|للطباعة والنشر|"
                 r"دار [^\s]+ للنشر|الناشر\s*:|الطبعة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|[\d٠-٩])|طبعة\s+[\d٠-٩]|ط\s*[\d٠-٩]+\s*[،,]|"
                 r"هاتف|تليفون|فاكس|جوال|ص\.\s*ب|صندوق بريد|البريد الإلكتروني|e-?mail|www\.|https?://|@[a-z]|\.com\b|\.net\b|\.org\b|"
                 r"تصميم الغلاف|الإخراج الفني|التنضيد|الصف الإلكتروني|المطبعة|مطابع|طُبع ب|طبع ب", re.I)
TITLEP = re.compile(r"(^|\s)(تأليف|بقلم|كتبه|كتبَهُ|بقَلَم|جمع وترتيب|جمع وإعداد|إعداد|تحقيق|حققه|قدم له|قدَّم له|توزيع|دار [^\s]+)(\s|$)")
TAILP = re.compile(r"^\s*#*\s*(من إصداراتنا|من إصدارات|صدر للمؤلف|صدر حديثًا|ملاحظات|ملاحظات للقارئ|للتواصل|نبذة عن الناشر)")
TOCL = re.compile(r"(\.{3,}|…{2,}|[-ـ_]{4,})\s*[\d٠-٩]+\s*$|\s[\d٠-٩]{1,4}\s*$")
TOCH = re.compile(r"^\s*#*\s*(فهرس|الفهرس|فهرس الموضوعات|فهرس المحتويات|المحتويات|المحتوى|الفهارس|فهرس الآيات|فهرس الأحاديث|فهرس الأعلام|ثبت المراجع|المراجع والمصادر|المصادر والمراجع|قائمة المراجع)\s*$")
NUMSYM = re.compile(r"^[\s\d٠-٩\-–—_=*•·■□◆◇●○★☆~|/\\.,،:؛()\[\]{}<>«»\"'ـ]+$")


def skip_page(bid, p, n, raw, cfg=None):
    """هل الصفحة كلها خارج مضمون الكتاب؟ صفحة العنوان والطبعة والنشر في أوله، والفهارس والمراجع في آخره، وما تحدده الإدارة."""
    cfg = cfg or {}
    if p in set(cfg.get("pages") or []) or p <= int(cfg.get("front") or 0) or (cfg.get("back") and p > n - int(cfg["back"])):
        return True
    t = FN.split(str(raw or ""))[0]
    ls = [re.sub(r"\s*\|\s*", " ", l).strip(" .") for l in t.split("\n") if l.strip() and not re.match(r"^\s*\|?\s*:?-{3}", l)]
    ls = [l for l in ls if l and not re.match(r"^(الموضوع|الصفحة)(\s+(الموضوع|الصفحة))?$", l)]
    body = " ".join(ls)
    if not ls:
        return True
    head = p <= max(6, n // 25)
    tail = p > n - max(8, n // 15)
    if head or tail:
        pub = sum(1 for l in ls if PUB.search(l))
        if pub >= 2 or (pub and len(body) < 600):
            return True
        if head and p <= 3 and len(body) < 160 and not re.search(r"[.؟!:]\s*$", body):  # صفحة العنوان والإهداء القصير
            return True
        if head and p <= 4 and len(body) < 700 and TITLEP.search(re.sub(r"[\u064B-\u0652\u0640]", "", body)) and not re.search(r"[\u0621-\u064A\u064B-\u0652]{2,}[.؟!]\s", t):  # صفحة العنوان: المؤلف والمحقق والناشر
            return True
        if tail and len(body) < 400 and TAILP.match(ls[0]):
            return True
    tocs = sum(1 for l in ls if TOCL.search(l) and len(l) < 120)
    if len(ls) >= 5 and tocs >= (0.4 if tail else 0.5) * len(ls):  # فهرس أو ثبت مراجع: أسطر قصيرة تنتهي بأرقام الصفحات
        return True
    if (head or tail) and TOCH.match(ls[0]) and tocs >= 0.3 * len(ls):
        return True
    if tail and TOCH.match(ls[0]) and len(ls) >= 4 and sum(1 for l in ls if len(l) < 90) >= 0.8 * len(ls):  # ثبت المراجع
        return True
    return False




def content_range(pages, cfg=None):
    """أول صفحة وآخر صفحة من مضمون الكتاب (بعد صفحات العنوان والنشر وقبل الفهارس)."""
    n = len(pages)
    a = 1
    while a < n and skip_page("", a, n, pages[a - 1], cfg) and a <= max(6, n // 25):
        a += 1
    z = n
    while z > a and skip_page("", z, n, pages[z - 1], cfg) and z > n - max(8, n // 15):
        z -= 1
    return a, z
