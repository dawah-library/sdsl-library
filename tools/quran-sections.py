#!/usr/bin/env python3
"""التقسيم الموضوعي للسور (بند 7ج، 7ب): مقاطع لكل سورة (من آية إلى آية، عنوان موضوع) ومقصد عام للسورة،
مسودات آلية للمراجعة تُبنى من تفسير السعدي والميسر المرسلين مع النص؛ تظهر في المصحف تظليلًا يستمر عبر الصفحات (mushaf.js).
المخرجات: data/quran/sections/<رقم السورة>.json = {"s":n,"maqsad":"...","sec":[[من،إلى،"عنوان"]…],"draft":1,"at":"..."}
مفتاح الإيقاف: quran_sections. المتغيرات: QSEC_MAX (عدد السور في التشغيل، 12)، QSEC_ONLY (سورة بعينها)، QSEC_MINUTES (60).
لا يكتب النموذج من عنده: المقاطع تُبنى على المعنى الظاهر في التفسير، وكل مسودة تحمل draft=1 حتى تُراجع."""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.join(ROOT, "data", "quran"); OUT = os.path.join(Q, "sections")
MAX = int(os.environ.get("QSEC_MAX", "12")); T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("QSEC_MINUTES", "60"))
def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def validate(sec, n):
    """مقاطع متصلة بلا فجوة ولا تداخل، تغطي 1..n، وعدد معقول."""
    if not isinstance(sec, list) or not 1 <= len(sec) <= max(2, n // 2 + 1): return None
    out, nxt = [], 1
    for x in sec:
        if not (isinstance(x, list) and len(x) == 3 and isinstance(x[0], int) and isinstance(x[1], int) and isinstance(x[2], str)): return None
        if x[0] != nxt or x[1] < x[0] or x[1] > n or not 3 <= len(x[2].strip()) <= 90: return None
        out.append([x[0], x[1], x[2].strip()]); nxt = x[1] + 1
    return out if nxt == n + 1 else None
PROMPT = """قسّم السورة موضوعيًا إلى مقاطع متصلة من آية إلى آية بناءً على المعنى الظاهر في التفسير المرسل وحده، وحدّد مقصدها العام.

السورة: {name} ({n} آية)
الآيات:
{ayat}

تفسير السعدي (للاستئناس بالمعنى):
{tafsir}

الشروط: المقاطع متصلة تبدأ بالآية 1 وتنتهي بالآية {n} بلا فجوة ولا تداخل؛ لكل مقطع عنوان موضوعي قصير (3 إلى 10 كلمات) من معنى الآيات نفسه؛ ولا تكثر التقسيم (للسور القصيرة مقطع إلى ثلاثة، وللطوال بحسب الموضوعات الكبرى)؛ والمقصد جملة أو جملتان مما يظهر من التفسير، بلا اجتهاد من عندك.
أخرج JSON وحده: {{"maqsad": "المقصد العام", "sec": [[1, 7, "عنوان المقطع"]]}}"""
def main():
    sw = (jl(os.path.join(ROOT, "data", "switches.json"), {}) or {}).get("s") or {}
    if sw.get("all_jobs") is False or sw.get("quran_sections") is False: print("موقوف من المفاتيح"); return
    if not T.KEYS: print("لا مفاتيح Gemini"); return
    os.makedirs(OUT, exist_ok=True)
    qs = jl(os.path.join(Q, "uthmani.json"))["suras"]; made = 0
    only = os.environ.get("QSEC_ONLY")
    for sura in qs:
        s = sura["n"]
        if only and str(s) != only: continue
        fp = os.path.join(OUT, "%d.json" % s)
        if os.path.exists(fp) and not only: continue
        if made >= MAX or time.time() > T.DEADLINE[0]: break
        if len(T.EXH) >= max(1, len(T.KEYS) // 2): print("ضاقت الحصة؛ يُستكمل غدًا"); break
        ay = [a.replace("\ufeff", "") for a in sura["ayat"]]; n = len(ay)
        tf = jl(os.path.join(Q, "tafsir", "saddi", "%d.json" % s), None)
        tt = ""
        if isinstance(tf, dict): tf = tf.get("ayat") or tf.get("a") or list(tf.values())
        if isinstance(tf, list): tt = "\n".join("%d: %s" % (i + 1, (x if isinstance(x, str) else json.dumps(x, ensure_ascii=False))[:500]) for i, x in enumerate(tf))[:30000]
        out = T.gemini(PROMPT.format(name=sura["name"], n=n, ayat="\n".join("%d: %s" % (i + 1, a) for i, a in enumerate(ay))[:40000], tafsir=tt or "(غير متوفر)"))
        if out is None: print("تعذّر النموذج؛ يُستكمل غدًا"); break
        sec = validate(out.get("sec") if isinstance(out, dict) else None, n)
        if not sec: print("سورة %d: تقسيم غير صالح، يُعاد لاحقًا" % s); continue
        json.dump({"s": s, "maqsad": str(out.get("maqsad") or "")[:600], "sec": sec, "draft": 1, "at": time.strftime("%Y-%m-%d")}, open(fp, "w", encoding="utf-8"), ensure_ascii=False)
        made += 1; print("سورة %d: %d مقاطع" % (s, len(sec)), flush=True)
    print("تم", made)
if __name__ == "__main__": main()
