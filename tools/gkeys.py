#!/usr/bin/env python3
"""توزيع مفاتيح Gemini بين المهام (الحد اليومي لكل مشروع Google، ولكل مفتاح مشروعه).

خدمات الكتب (التدقيق، والاختصارات، والاختبارات، والتشجير، والكراسات، وتجهيز التفريغات) كانت تعمل بعد أن
يستنفد التحويل الضوئي والتشكيل حصة اليوم كلها، فتنجح المهمة ولا تُخرج شيئًا. فيُحجز لها آخر STUDY_KEYS
مفتاحًا (الافتراضي ٦ من ٢٠): لا تمسها المهام الكبيرة، وتبدأ بها خدمات الكتب ثم تنتقل إلى بقية المفاتيح.
STUDY_KEYS=0 يلغي الحجز.
"""
import os

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


def keys(role="bulk"):
    """role="bulk": التحويل والتشكيل ونحوهما — بلا المفاتيح المحجوزة.
    role="study": خدمات الكتب — المحجوزة أولًا ثم البقية."""
    ks = [v for _, v in _all()]
    d = _dev_n(len(ks))
    if role == "dev": return ks[:d] + ks[d:]
    ks = ks[d:]
    r = _reserved_n(len(ks))
    if not r:
        return ks
    if role == "study":
        return ks[-r:] + ks[:-r]
    return ks[:-r]
