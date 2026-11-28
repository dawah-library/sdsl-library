#!/usr/bin/env python3
"""تشكيل أحاديث قسم الحديث كلها (طلب المدير، ٢١ نوفمبر ٢٠٢٦): متون كتب السنة (data/hadith/k/<كتاب>/m<i>.json) ومطالعها
(l<i>.json من tools/hadith-lead.py) تُشكَّل تشكيلًا تامًّا صحيحًا، دفعة بعد دفعة، بالأولوية: الكتب التسعة ثم الأصغر فالأكبر.
- لا يُغيَّر حرف: يُقبل التشكيل فقط إذا طابق النصُّ بعد نزع الحركات النصَّ الأصلي بعد نزعها؛ وإلا بقي الأصل.
- ما كان مشكولًا (نسبة الحركات إلى الحروف ≥ ٠٫٣) لا يُعاد.
- الحالة: data/hadith/k/_tashkeel.json {"done": {"<كتاب>": [أرقام الأجزاء المكتملة]}, "n": المشكول, "upd"}.
- المحرك: Gemini بمفاتيح المهام الكبيرة موزَّعة (gkeys.Pool). الحد: HT_MAX طلبًا في الجولة (٣٠٠)، وHT_MINUTES.
- (تعديل ٢٨ نوفمبر بطلب المدير: «التشكيل كان للإسناد فقط لا لنص الحديث ومتنه») المتن أولًا: ما كان إسنادًا وحده
  («وحدثني… بمثله/بنحوه/بهذا الإسناد») يؤجَّل إلى ما بعد متون الكتب كلها (HT_ISNAD=1 يقدّمه)؛ والنص الذي لم يُقبل تشكيله مرتين
  لا يُعاد في كل جولة (كان يحبس المهمة في أجزاء مسلم نفسها فلا تبلغ بقية الكتب)؛ ومختارات القسم (الأربعون، رياض الصالحين،
  بلوغ المرام) تُشكَّل أولًا في الحقلين mv وfv (المتن والنص كما في الكتاب) فلا يُمس m وfull اللذان تعتمد عليهما أدوات أخرى.
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


ISN_ONLY = re.compile(r"^\s*(?:[\(\[]?[\d٠-٩]+[\)\]]?\s*[-–.]*\s*)*و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|ثنا|نا|حدثناه|وحدثناه)\b")
ISN_TAIL = re.compile(r"(?:بمثله|بنحوه|مثله|نحوه|بمعناه|بهذا الإسناد|بإسناده|بهذا الحديث|بمثل حديث|بنحو حديث|بمثل هذا|بنحو هذا)")
ISNAD_FIRST = os.environ.get("HT_ISNAD", "") == "1"
CUR = ["arbain", "riyad", "bulugh"]  # مختارات القسم: data/hadith/<كتاب>.json {id: {m, full, …}} ← mv وfv


def isn_only(t):
    """إسناد بلا متن مستقل (إحالة على متن سابق)."""
    t = DIA.sub("", t or "")
    return bool(ISN_ONLY.match(t)) and bool(ISN_TAIL.search(t)) and len(t) < 450


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


def run(todo, apply):
    """يرسل النصوص دفعات ويطبّق المقبول بـ apply(t, k, نص)؛ يعيد (المقبول، المرفوض) أو None إن نفدت الحصة قبل الإتمام."""
    ok = 0; bad = []; i = 0
    while i < len(todo):
        part, size = [], 0
        while i < len(todo) and len(part) < 16 and size < 4500:  # دفعات أصغر: الرد المشكول نحو ضعف النص، والطويل كان يُقطع
            part.append(todo[i]); size += min(len(todo[i][2]), CAP); i += 1
        r = gemini(PROMPT.format(items="\n".join(json.dumps({(t + ":" + k): v[:CAP]}, ensure_ascii=False) for t, k, v in part)))
        if r is None: return None if not ok else (ok, bad, False)
        if isinstance(r, list):  # بعض النماذج تعيد قائمة كائنات بدل كائن واحد
            rr = {}
            for o in r:
                if isinstance(o, dict): rr.update(o)
            r = rr
        if not isinstance(r, dict): r = {}
        for t, k, v in part:
            nv = r.get(t + ":" + k)
            if isinstance(nv, str) and skel(nv) == skel(v[:CAP]) and ratio(nv) >= 0.3:
                apply(t, k, nv + v[CAP:]); ok += 1
            else: bad.append(t + ":" + k)
        apply(None, None, None)  # حفظ بعد كل دفعة
    return ok, bad, True


def tried(S, key):
    return S.setdefault("tries", {}).setdefault(key, {})


def curated(S):
    """المختارات: المتن (m ← mv) والنص كما في الكتاب (full ← fv)؛ يعيد False إن نفدت الحصة."""
    for b in CUR:
        f = os.path.join(ROOT, "data", "hadith", b + ".json")
        if not os.path.exists(f) or b in S.get("cur_done", []): continue
        D = json.load(open(f, encoding="utf-8")); T = tried(S, "cur:" + b)
        todo = [(fld[0], k, d[fld]) for k, d in D.items() if isinstance(d, dict) for fld in ("m", "full")
                if d.get(fld) and not d.get(fld[0] + "v") and ratio(d[fld]) < 0.3 and T.get(fld[0] + ":" + k, 0) < 2]
        if todo:
            def ap(t, k, nv):
                if t is None: json.dump(D, open(f, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":")); return
                D[k][("m" if t == "m" else "f") + "v"] = nv
            r = run(todo, ap)
            if r is None: return False
            ok, bad, full = r
            for x in bad: T[x] = T.get(x, 0) + 1
            S["n"] = S.get("n", 0) + ok; print("  %s: شُكّل %d من %d" % (b, ok, len(todo)), flush=True)
            if not full: return False
        S.setdefault("cur_done", []).append(b)
    return True


def chunk(b, c, S, isnad=False):
    """يشكّل جزءًا واحدًا (٥٠٠ حديث) من كتاب: المتون (أو الأسانيد المفردة إن isnad)؛ True إن اكتمل، وNone إن نفدت الحصة."""
    mf, lf = os.path.join(K, b, "m%d.json" % c), os.path.join(K, b, "l%d.json" % c)
    M = json.load(open(mf, encoding="utf-8")); L = json.load(open(lf, encoding="utf-8")) if os.path.exists(lf) else {}
    T = tried(S, "%s/%d" % (b, c))
    todo = [("m", k, v) for k, v in M.items() if v and ratio(v) < 0.3 and isn_only(v) == isnad and T.get("m:" + k, 0) < 2]
    if not isnad: todo += [("l", k, v) for k, v in L.items() if v and ratio(v) < 0.3 and T.get("l:" + k, 0) < 2]
    if not todo: return True
    def ap(t, k, nv):
        if t is None: save(mf, M, lf, L); return
        (M if t == "m" else L)[k] = nv
    r = run(todo, ap)
    if r is None: return None
    ok, bad, full = r
    for x in bad: T[x] = T.get(x, 0) + 1
    S["n"] = S.get("n", 0) + ok
    print("  %s/m%d%s: شُكّل %d من %d" % (b, c, " (أسانيد)" if isnad else "", ok, len(todo)), flush=True)
    return None if not full else True  # المرفوض يُسجَّل في tries ولا يحبس الجزء؛ فلا تتكرر المحاولة على النص نفسه في كل جولة


def save(mf, M, lf, L):
    json.dump(M, open(mf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if L: json.dump(L, open(lf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def main():
    LST = json.load(open(os.path.join(K, "_list.json"), encoding="utf-8"))
    S = json.load(open(SP, encoding="utf-8")) if os.path.exists(SP) else {"done": {}, "n": 0}
    bs = sys.argv[1:] or (PRIO + sorted([b for b in LST if b not in PRIO], key=lambda b: LST[b].get("n", 0)))
    start = S.get("n", 0)
    if S.get("v") != 2:  # بعد تعديل ٢٨ نوفمبر: «المكتمل» القديم كان يعني الأسانيد وحدها في أكثره، فيُعاد فحص كل جزء بالمنطق الجديد
        S["done_v1"] = S.get("done", {}); S["done"] = {}; S["v"] = 2
    def save_state():
        S["upd"] = str(datetime.date.today()); json.dump(S, open(SP, "w", encoding="utf-8"), ensure_ascii=False)
    stop = False
    if not sys.argv[1:]:
        stop = not curated(S); save_state()
    for phase in ([True, False] if ISNAD_FIRST else [False, True]):
        if stop: break
        key = "done_isn" if phase else "done"; S.setdefault(key, {})
        for b in bs:
            if b not in LST: continue
            n = (LST[b].get("n", 0) + 499) // 500; done = set(S[key].get(b, []))
            for c in range(n):
                if c in done or not os.path.exists(os.path.join(K, b, "m%d.json" % c)): continue
                r = chunk(b, c, S, phase)
                if r is None: stop = True; break
                done.add(c); S[key][b] = sorted(done); save_state()
            save_state()
            if stop: break
    S["upd"] = str(datetime.date.today()); json.dump(S, open(SP, "w", encoding="utf-8"), ensure_ascii=False)
    full = sum(len(v) for v in S.get("done", {}).values()); tot = sum((x.get("n", 0) + 499) // 500 for x in LST.values())
    print("الطلبات %(req)d، مرفوض بحد اليوم أو غير متاح %(day)d، بحد الدقيقة %(min)d، أخطاء خادم %(err)d، ردود غير مكتملة %(bad)d" % STAT, flush=True)
    msg = "✍️ <b>تشكيل أحاديث قسم الحديث</b>: شُكّل في هذه الجولة %d نصًّا (متون الأحاديث ومطالعها، والمختارات أولًا). الأجزاء المكتملة متونها %d من %d (كل جزء ٥٠٠ حديث)." % (S["n"] - start, full, tot)
    print(msg); open(os.path.join(ROOT, ".ht-report.txt"), "w", encoding="utf-8").write(msg)


if __name__ == "__main__":
    main()
