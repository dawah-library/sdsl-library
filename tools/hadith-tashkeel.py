#!/usr/bin/env python3
"""تشكيل أحاديث قسم الحديث كلها (طلب المدير، ٢١ نوفمبر ٢٠٢٦): متون كتب السنة (data/hadith/k/<كتاب>/m<i>.json) ومطالعها
(l<i>.json من tools/hadith-lead.py) تُشكَّل تشكيلًا تامًّا صحيحًا، دفعة بعد دفعة، بالأولوية: الكتب التسعة ثم الأصغر فالأكبر.
- لا يُغيَّر حرف: يُقبل التشكيل فقط إذا طابق النصُّ بعد نزع الحركات النصَّ الأصلي بعد نزعها؛ وإلا بقي الأصل.
- ما كان مشكولًا (نسبة الحركات إلى الحروف ≥ ٠٫٣) لا يُعاد.
- الحالة: data/hadith/k/_tashkeel.json {"done": {"<كتاب>": [أرقام الأجزاء المكتملة]}, "n": المشكول, "upd"}.
- المحرك: Gemini بمفاتيح المهام الكبيرة موزَّعة (gkeys.Pool). الحد: HT_MAX طلبًا في الجولة (٣٠٠)، وHT_MINUTES.
الاستعمال: python3 tools/hadith-tashkeel.py [كتاب…]"""
import datetime, json, os, re, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); K = os.path.join(ROOT, "data", "hadith", "k"); SP = os.path.join(K, "_tashkeel.json")
from gkeys import keys as _gkeys, Pool as _Pool  # noqa: E402
KEYS = _gkeys("bulk"); POOL = _Pool(KEYS); EXH = set()
# نماذج flash كلها (لكل نموذج حصة يومية مستقلة لكل مفتاح)، لا الخفيفة حفاظًا على دقة الإعراب
MODELS = [m.strip() for m in os.environ.get("HT_MODELS", "gemini-3-flash-preview,gemini-flash-latest,gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash").split(",") if m.strip()]
STAT = {"req": 0, "ok": 0, "day": 0, "min": 0, "err": 0, "bad": 0}
MEXH = set(); BUDGET = [int(os.environ.get("HT_MAX", "300"))]; DEADLINE = time.time() + 60 * float(os.environ.get("HT_MINUTES", "140"))
DIA = re.compile(r"[ً-ْٰ]")
# صحيح البخاري آخر الكتب التسعة: متونه في المكتبة مختلطة بتعليق المحقق وأرقام المواضع حتى تُنقّى
PRIO = ["muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "muwatta", "darimi", "musnadahmad", "adabmufrad", "shamail", "amalyawm", "bukhari"]
PROMPT = """أنت عالم بالعربية والحديث متقن للنحو والصرف. شكّل كل نص من نصوص الأحاديث الآتية تشكيلًا تامًّا صحيحًا فصيحًا كما في كتب السنة المحققة:
- اضبط أواخر الكلمات بإعرابها وبنية الكلمات، وضع الشدة والتنوين، وأسماء الرواة والصحابة بضبطها المشهور.
- لا تغيّر أي حرف ولا كلمة ولا علامة ترقيم ولا رقمًا، ولا تضف ولا تحذف شيئًا، ولا تصحح الإملاء؛ و«ﷺ» تبقى كما هي.
أعد JSON بالمفاتيح نفسها: {{"المفتاح": "النص مشكولًا"}}

{items}"""


CAP = 1500  # أقصى ما يُرسل من النص الواحد (الباقي يُلحق كما هو)، فلا يطول الرد فيُقطع


def ratio(t):
    ar = len(re.findall(r"[ء-ي]", t or "")); return len(DIA.findall(t or "")) / ar if ar else 1


def skel(t):
    """هيكل النص للمقارنة: الحروف والأرقام وحدها بترتيبها (لا يُقبل تشكيل غيّر حرفًا، ويُتسامح في الفراغات وعلامات الترقيم)."""
    return re.sub(r"[^\u0621-\u064A0-9٠-٩ﷺ]", "", DIA.sub("", (t or "").replace("ٰ", "").replace("ـ", "")))


def gemini(prompt):
    if BUDGET[0] <= 0 or time.time() > DEADLINE: return None
    for rnd in range(6):
        for k in POOL.order(EXH):
            if not POOL.ready(k): continue
            for model in MODELS:
                if (k, model) in MEXH: continue
                if time.time() > DEADLINE: return None
                POOL.pace(k); STAT["req"] += 1
                try:
                    body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 30000}}).encode()
                    req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model, data=body, headers={"content-type": "application/json", "x-goog-api-key": KEYS[k]})
                    with urllib.request.urlopen(req, timeout=240) as r: j = json.loads(r.read())
                    BUDGET[0] -= 1
                    t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                    try: return json.loads(re.sub(r"^```json|```$", "", t.strip()))
                    except ValueError: STAT["bad"] += 1; print("  رد غير مكتمل (يُتخطى ويُعاد في الجولة القادمة)", flush=True); return {}
                except urllib.error.HTTPError as e:
                    msg = e.read()[:2000].decode("utf-8", "ignore")
                    if (e.code == 429 and re.search(r"PerDay|per day|exceeded your current quota", msg, re.I) and not re.search(r"PerMinute", msg)) or e.code in (400, 403, 404):
                        MEXH.add((k, model)); STAT["day"] += 1
                        if STAT["day"] <= 5 or STAT["day"] % 20 == 0: print("  حصة/نموذج غير متاح: مفتاح#%d %s %s %s" % (k + 1, model, e.code, re.sub(r"\s+", " ", msg)[:90]), flush=True)
                        continue
                    STAT["min" if e.code == 429 else "err"] += 1
                    POOL.cool(k, 45 if e.code == 429 else 15); break
                except Exception as e:
                    print("  خطأ", str(e)[:100], flush=True); POOL.cool(k, 10); break
            if all((k, m) in MEXH for m in MODELS): EXH.add(k)
        if len(EXH) >= len(KEYS): return None
        w = POOL.wait(EXH)
        if w > 0: time.sleep(min(w, 60))
    return None


def chunk(b, c, S):
    """يشكّل جزءًا واحدًا (٥٠٠ حديث) من كتاب؛ يعيد True إن اكتمل، وNone إن نفدت الحصة."""
    mf, lf = os.path.join(K, b, "m%d.json" % c), os.path.join(K, b, "l%d.json" % c)
    M = json.load(open(mf, encoding="utf-8")); L = json.load(open(lf, encoding="utf-8")) if os.path.exists(lf) else {}
    todo = [("m", k, v) for k, v in M.items() if v and ratio(v) < 0.3] + [("l", k, v) for k, v in L.items() if v and ratio(v) < 0.3]
    if not todo: return True
    ok = 0; i = 0
    while i < len(todo):
        part, size = [], 0
        while i < len(todo) and len(part) < 16 and size < 4500:  # دفعات أصغر: الرد المشكول نحو ضعف النص، والطويل كان يُقطع
            part.append(todo[i]); size += min(len(todo[i][2]), CAP); i += 1
        r = gemini(PROMPT.format(items="\n".join(json.dumps({(t + ":" + k): v[:CAP]}, ensure_ascii=False) for t, k, v in part)))
        if r is None:
            if ok: save(mf, M, lf, L)
            return None
        if isinstance(r, list):  # بعض النماذج تعيد قائمة كائنات بدل كائن واحد
            rr = {}
            for o in r:
                if isinstance(o, dict): rr.update(o)
            r = rr
        if not isinstance(r, dict): r = {}
        for t, k, v in part:
            nv = r.get(t + ":" + k)
            if isinstance(nv, str) and skel(nv) == skel(v[:CAP]) and ratio(nv) >= 0.3:
                nv = nv + v[CAP:]
                (M if t == "m" else L)[k] = nv; ok += 1
        if ok: save(mf, M, lf, L)  # حفظ بعد كل دفعة: لا يضيع المنجز إن توقفت المهمة
    save(mf, M, lf, L); S["n"] = S.get("n", 0) + ok
    print("  %s/m%d: شُكّل %d من %d" % (b, c, ok, len(todo)), flush=True)
    return ok >= len(todo) * 0.98  # لا يُعدّ الجزء مكتملًا إلا إن شُكّل كله تقريبًا؛ وإلا أُعيد ما بقي منه في جولة قادمة


def save(mf, M, lf, L):
    json.dump(M, open(mf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if L: json.dump(L, open(lf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def main():
    LST = json.load(open(os.path.join(K, "_list.json"), encoding="utf-8"))
    S = json.load(open(SP, encoding="utf-8")) if os.path.exists(SP) else {"done": {}, "n": 0}
    bs = sys.argv[1:] or (PRIO + sorted([b for b in LST if b not in PRIO], key=lambda b: LST[b].get("n", 0)))
    start = S.get("n", 0)
    for b in bs:
        if b not in LST: continue
        n = (LST[b].get("n", 0) + 499) // 500; done = set(S["done"].get(b, []))
        for c in range(n):
            if c in done or not os.path.exists(os.path.join(K, b, "m%d.json" % c)): continue
            r = chunk(b, c, S)
            if r is None: break
            if r: done.add(c); S["done"][b] = sorted(done)
            S["upd"] = str(datetime.date.today()); json.dump(S, open(SP, "w", encoding="utf-8"), ensure_ascii=False)
        else: continue
        break
    S["upd"] = str(datetime.date.today()); json.dump(S, open(SP, "w", encoding="utf-8"), ensure_ascii=False)
    full = sum(len(v) for v in S["done"].values()); tot = sum((x.get("n", 0) + 499) // 500 for x in LST.values())
    print("الطلبات %(req)d، مرفوض بحد اليوم أو غير متاح %(day)d، بحد الدقيقة %(min)d، أخطاء خادم %(err)d، ردود غير مكتملة %(bad)d" % STAT, flush=True)
    msg = "✍️ <b>تشكيل أحاديث قسم الحديث</b>: شُكّل في هذه الجولة %d نصًّا (متنًا أو مطلعًا). الأجزاء المكتملة %d من %d (كل جزء ٥٠٠ حديث)." % (S["n"] - start, full, tot)
    print(msg); open(os.path.join(ROOT, ".ht-report.txt"), "w", encoding="utf-8").write(msg)


if __name__ == "__main__":
    main()
