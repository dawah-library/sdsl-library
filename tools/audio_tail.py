"""كشف «الفرقعة/التشويش» في ختام مقاطع صوتيات Gemini (صوت «تش» مفاجئ نحو ٠٫٢٥ ث بعد صمت قصير).
الشكل الثابت: كلام ينتهي ← صمت ≥ ٠٫١ ث ← دفقة عالية الطاقة (RMS > ٠٫١٥) عالية التردد (عبور الصفر > ٠٫٢) حتى آخر الملف.
find_cut يعيد زمن القص (ثوانٍ من بداية الملف) أو None إن لم توجد الدفقة. الكلام الطبيعي لا يطابق شرط الطاقة مع التردد معًا."""
import math

FR = 0.02  # ثانية للإطار


def _frames(x, sr):
    w = int(sr * FR)
    out = []
    for i in range(0, len(x) - w + 1, w):
        f = x[i:i + w]
        r = math.sqrt(sum(v * v for v in f) / w)
        z = sum(1 for k in range(1, w) if (f[k] > 0) != (f[k - 1] > 0)) / w
        out.append((r, z))
    return out


def find_cut(x, sr=24000):
    """x: عيّنات float بين -1 و1 لمقطع كامل أو لذيله؛ يعيد (زمن القص من بداية x) أو None."""
    fr = _frames(x, sr)
    n = len(fr)
    if n < 40:
        return None
    lo = max(0, n - 40)  # آخر ٠٫٨ ث
    # آخر إطار هادئ بعد الدفقة نفسها: نبحث عن أبكر صمتٍ طوله ≥ ٥ إطارات تليه دفقة تمتد للنهاية
    best = None
    i = lo
    while i < n - 5:
        if all(fr[k][0] < 0.012 for k in range(i, i + 5)):
            j = i
            while j < n and fr[j][0] < 0.012:
                j += 1
            tail = fr[j:]
            loud = [f for f in tail if f[0] > 0.1]
            if tail and len(tail) <= 30 and len(loud) >= max(3, int(len(tail) * 0.5)) and sum(f[1] for f in loud) / len(loud) > 0.2 and tail[-1][0] > 0.05:
                best = i
                break
            i = j
        else:
            i += 1
    if best is None:
        return None
    return (best + 5) * FR  # يُبقي ٠٫١ ث من الصمت بعد آخر كلمة
