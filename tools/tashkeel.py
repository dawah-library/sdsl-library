#!/usr/bin/env python3
"""تشكيل الكتب غير المشكولة تشكيلًا مدققًا نحويًا ولغويًا، مجانًا.

المرحلة الأولى: Gemini يشكّل الصفحة تشكيلًا تامًا بحسب الإعراب والصرف.
المرحلة الثانية: جولة تدقيق مستقلة (Gemini Pro إن أتاحت الحصة، وإلا Gemini بتعليمات المدقق) تراجع التشكيل كلمة كلمة وتصحح أخطاء الإعراب والضبط.
(كانت GitHub Models محركًا ثانيًا، وقد أوقفتها GitHub نهائيًا في ٣٠ يوليو ٢٠٢٦.)
الضمان: لا يُقبل من النموذج إلا الحركات؛ تُنقل حركاته إلى حروف النص الأصلي نفسه كلمةً كلمة، وأي كلمة تغيّرت حروفها تبقى كما في الأصل.
فلا يتغير حرف ولا كلمة ولا علامة ترقيم في الكتاب أبدًا.

المخرجات منفصلة عن نص الكتاب: data/tashkeel/<كتاب>/<k>.json (كل ٥٠ صفحة في ملف) و data/tashkeel/_list.json
ولكل صفحة بصمة نصها الأصلي (h)؛ فإذا صُحّح نص الصفحة لاحقًا أعيد تشكيلها تلقائيًا، ولا يُعرض تشكيل قديم على نص جديد.
لا تُشكَّل كتب التحويل الآلي (OCR) إلا بعد اكتمال تدقيقها (لا صفحات بلا مراجعة ولا صفحات خفيفة).
"""
import concurrent.futures as cf, json, os, re, sys, threading, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "tashkeel")
CH = 50
T0 = time.time()
MAXMIN = float(os.environ.get("TK_MAX_MIN", "300"))
GKEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 21)] if k.strip()]
GMODEL = os.environ.get("TK_GEMINI_MODEL", "gemini-flash-latest")
PRO = os.environ.get("TK_PRO_MODEL", "gemini-pro-latest")
GHM = os.environ.get("GITHUB_MODELS_TOKEN", "").strip()
GHM_MODEL = os.environ.get("TK_GHM_MODEL", "openai/gpt-4.1")
MAX_PAGES = int(os.environ.get("TK_MAX_PAGES", "400"))
DIAC = re.compile(r"[ً-ْٰ]")
AR = re.compile(r"[ء-يٱ-ۓ]")
LOCK = threading.Lock()
EXH = set()  # (محرك، مفتاح) نفدت حصته اليوم
STATS = {"gemini": 0, "review": 0, "pages": 0, "fail": 0}
REPORT = []
ERRS = []


def log(*a):
    print(*a, flush=True)


def left():
    return MAXMIN * 60 - (time.time() - T0)


def fnv(s):
    """بصمة النص (FNV-1a) بالطريقة نفسها في الموقع."""
    h = 0x811c9dc5
    for c in s:
        h ^= ord(c)
        h = (h * 0x01000193) & 0xffffffff
    d, out = "0123456789abcdefghijklmnopqrstuvwxyz", ""
    while True:
        h, r = divmod(h, 36)
        out = d[r] + out
        if not h:
            return out


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def diac_ratio(t):
    letters = len(AR.findall(t))
    return len(DIAC.findall(t)) / letters if letters else 1.0


# ---------- نقل الحركات إلى النص الأصلي مع ضمان عدم تغيير الحروف ----------
def units(tok):
    """[(حرف، حركاته)] لحروف الكلمة العربية."""
    out = []
    for c in tok:
        if AR.match(c):
            out.append([c, ""])
        elif DIAC.match(c) and out:
            out[-1][1] += c
    return out


def skel(tok):
    return "".join(c for c in tok if AR.match(c))


def transfer(src, out):
    """يعيد النص الأصلي بعينه مع حركات النموذج حيث تطابقت حروف الكلمة؛ ونسبة الكلمات المشكولة."""
    stoks = re.split(r"(\s+)", src)
    otoks = [t for t in re.split(r"\s+", out) if skel(t)]
    oi, ok, total = 0, 0, 0
    res = []
    for t in stoks:
        sk = skel(t)
        if not sk or t.isspace():
            res.append(t)
            continue
        total += 1
        if DIAC.search(t) and diac_ratio(t) > 0.5:  # كلمة مشكولة في الأصل (آية مثلًا): تبقى كما هي
            res.append(t)
            # تجاوز نظيرتها في المخرجات
            for j in range(oi, min(oi + 4, len(otoks))):
                if skel(otoks[j]) == sk:
                    oi = j + 1
                    break
            ok += 1
            continue
        hit = None
        for j in range(oi, min(oi + 6, len(otoks))):  # بحث قريب يتحمل كلمة زائدة أو ناقصة
            if skel(otoks[j]) == sk:
                hit = j
                break
        if hit is None:
            res.append(t)
            continue
        u = units(otoks[hit])
        oi = hit + 1
        k, b = 0, []
        for c in t:
            if AR.match(c):
                b.append(c + (u[k][1] if k < len(u) else ""))
                k += 1
            elif DIAC.match(c):
                continue  # الحركات تأتي من المخرجات
            else:
                b.append(c)
        res.append("".join(b))
        ok += 1
    return "".join(res), (ok / total if total else 1.0)


# ---------- المحركات ----------
def post(url, body, headers, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=dict({"content-type": "application/json"}, **headers))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        try:
            return json.loads(raw)
        except Exception:
            raise RuntimeError("رد غير مفهوم %s من %s: %s" % (r.status, r.geturl(), raw[:160].decode("utf-8", "ignore")))


def gemini(prompt, model, key):
    j = post("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model,
             {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0, "maxOutputTokens": 16000}},
             {"x-goog-api-key": key})
    parts = ((j.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()


def ghm(prompt):
    return ghm1(prompt, "https://models.github.ai/inference/chat/completions")


def ghm1(prompt, url):
    model = GHM_MODEL if "github.ai" in url else GHM_MODEL.split("/")[-1]
    j = post(url, {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": 4000},
             {"authorization": "Bearer " + GHM, "accept": "application/vnd.github+json", "x-github-api-version": "2022-11-28"})
    return (((j.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()


def call(engine, prompt, slot=0):
    """engine: g (Gemini flash) أو pro (Gemini Pro) أو ghm. يعيد النص أو None (نفاد الحصة)."""
    keys = list(range(len(GKEYS)))
    order = keys[slot % max(1, len(keys)):] + keys[:slot % max(1, len(keys))]
    tries = [("ghm", None)] if engine == "ghm" else [(engine, k) for k in order]
    for eng, k in tries:
        if (eng, k) in EXH:
            continue
        for attempt in range(5):
            try:
                if eng == "ghm":
                    t = ghm(prompt)
                else:
                    t = gemini(prompt, GMODEL if eng == "g" else PRO, GKEYS[k])
                if t:
                    return t
                break
            except urllib.error.HTTPError as e:
                msg = e.read()[:400].decode("utf-8", "ignore")
                ERRS.append("%s %s %s" % (eng, e.code, re.sub(r"\s+", " ", msg)[:160]))
                if e.code == 429 and re.search(r"day|daily|PerDay|UserByDay|quota", msg, re.I) and not re.search(r"PerMinute|per minute", msg, re.I):
                    with LOCK:
                        EXH.add((eng, k))
                    log("  نفدت الحصة اليومية:", eng, k)
                    break
                if e.code in (400, 401, 403, 404, 413):
                    with LOCK:
                        EXH.add((eng, k))
                    log("  محرك غير متاح:", eng, e.code, msg[:120])
                    break
                time.sleep(min(90, 15 * (attempt + 1)))
            except Exception as e:
                ERRS.append("%s %s" % (eng, str(e)[:160]))
                time.sleep(5 * (attempt + 1))
    return None


P1 = """أنت عالم بالعربية متقن للنحو والصرف واللغة. شكّل النص الآتي تشكيلًا تامًا صحيحًا:
- اضبط أواخر الكلمات بحسب إعرابها في سياقها، واضبط بنية الكلمات (الأوزان والمشتقات وأبنية الأفعال للمعلوم والمجهول) ضبطًا صحيحًا فصيحًا.
- ضع الشدة حيث تجب، والتنوين، وهمزات الوصل بلا حركة.
- لا تغيّر أي حرف ولا كلمة ولا علامة ترقيم، ولا تضف شيئًا ولا تحذف، ولا تصحح الإملاء، وحافظ على الأسطر كما هي.
- ما كان مشكولًا في الأصل (كالآيات) اتركه بتشكيله.
- أسماء الأعلام: اضبطها بضبطها المشهور.
أعد النص المشكول وحده بلا شرح.

النص:
"""
P2 = """أنت مدقق لغوي خبير في النحو والصرف. فيما يلي نص عربي مشكول آليًا. راجع تشكيله كلمة كلمة، وصحح كل خطأ في الإعراب (أواخر الكلمات) أو في ضبط البنية أو في الشدة والتنوين،
مع مراعاة السياق ومعاني الجمل. لا تغيّر أي حرف ولا كلمة ولا علامة ترقيم، ولا تضف ولا تحذف، وحافظ على الأسطر.
أعد النص كاملًا مشكولًا بعد التصحيح، بلا شرح.

النص:
"""


def clean_out(t):
    t = re.sub(r"^```[a-z]*\s*|\s*```$", "", t.strip())
    return t


def tashkeel_page(src, slot):
    """يشكّل صفحة ويدققها؛ يعيد (النص المشكول، المحرك، المدقق) أو None."""
    first = call("g", P1 + src, slot) if GKEYS else None
    m1 = GMODEL
    if first is None and GHM:
        first, m1 = call("ghm", P1 + src), GHM_MODEL
    if first is None:
        return None
    STATS["gemini"] += 1
    d1, r1 = transfer(src, clean_out(first))
    if r1 < 0.8:
        log("  تطابق ضعيف بعد التشكيل (%.0f%%)" % (r1 * 100))
        ERRS.append("تطابق ضعيف %.0f%%: %s" % (r1 * 100, clean_out(first)[:120].replace("\n", " ")))
        return None
    # التدقيق بمحرك مستقل عن الأول
    rev, m2 = None, ""
    if GHM and m1 != GHM_MODEL and len(d1) < 6000:
        rev, m2 = call("ghm", P2 + d1), GHM_MODEL
    if rev is None and GKEYS:
        rev, m2 = call("pro", P2 + d1, slot), PRO
    if rev is None and GKEYS:  # مراجعة ثانية مستقلة بالنموذج نفسه بتعليمات المدقق
        rev, m2 = call("g", P2 + d1, slot + 1), GMODEL + "/مراجعة"
    if rev:
        d2, r2 = transfer(src, clean_out(rev))
        if r2 >= max(0.8, r1 - 0.05) and diac_ratio(d2) >= diac_ratio(d1) * 0.85:
            STATS["review"] += 1
            return d2, m1, m2
    return d1, m1, ""


def ready_books(cat):
    """الكتب المؤهلة للتشكيل: نصها غير مشكول. والمحوّلة آليًا تُشكَّل صفحاتها المدققة وحدها، وتُعاد الصفحة إن تغيّر نصها بعد التدقيق (بصمة FNV)."""
    out = []
    for b in cat["books"]:
        if b.get("demo") or b.get("type") in ("article", "fatwa", "statement"):
            continue
        out.append(b)  # المحوّل آليًا يُشكَّل صفحةً صفحة: الصفحات المدققة فقط (انظر main)، فلا ينتظر الكتاب اكتمال تدقيقه كله
    out.sort(key=lambda b: (0 if b.get("col") == "dawah" else 1, b.get("n") or 9999))
    return out


def shard(bid):
    for p in (os.path.join(ROOT, "data", "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p):
            return jload(p, None)
    return None


def main():
    cat = jload(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    lst = jload(os.path.join(OUT, "_list.json"), {})
    q = jload(os.path.join(OUT, "_queue.json"), {"items": []})
    pri = [x["id"] if isinstance(x, dict) else x for x in q.get("items", [])]
    only = [x for x in os.environ.get("TK_ONLY", "").split(",") if x.strip()]
    books = {b["id"]: b for b in ready_books(cat)}
    if os.environ.get("TK_ALLOW_ALL", "0") != "1":  # بقرار الإدارة: خدمة التشكيل لكتب مكتبة الدعوة وحدها في هذه المرحلة
        books = {i: b for i, b in books.items() if b.get("col") == "dawah" or b.get("upl")}
    # كتب الدعوة تُشكَّل تلقائيًا، والطابور يقدّم بعضها على بعض
    auto = [i for i, b in books.items() if (b.get("col") == "dawah" or b.get("upl")) and i not in pri]
    order = [i for i in (only or pri) if i in books] + ([] if only else auto)
    if not GKEYS and not GHM:
        log("لا محرك متاح")
        return
    budget = MAX_PAGES
    for bid in order:
        if budget <= 0 or left() < 300 or (len(EXH) >= len(GKEYS) + (1 if GHM else 0) and GKEYS):
            break
        sh = shard(bid)
        if not sh or not sh.get("pages"):
            continue
        pages = sh["pages"]
        sample = " ".join(pages[: min(len(pages), 40)])
        if diac_ratio(sample) > 0.35 and bid not in only:  # الكتاب مشكول أصلًا
            continue
        chunks = {}
        todo = []
        notyet = set(sh.get("lite") or []) | set(sh.get("unrev") or []) | {int(k) for k in (sh.get("unc") or {})}  # لم يكتمل تدقيقها النصي
        for i, t in enumerate(pages):
            if len(skel(t)) < 20 or i in notyet:
                continue
            k = i // CH
            if k not in chunks:
                chunks[k] = jload(os.path.join(OUT, bid, "%d.json" % k), {})
            e = chunks[k].get(str(i + 1))
            if e and e.get("h") == fnv(t):
                continue
            todo.append(i)
        if not todo:
            continue
        todo = todo[:budget]
        b = books[bid]
        log("%s «%s»: %d صفحة للتشكيل" % (bid, b.get("setTitle") or b["title"], len(todo)))
        done = 0

        def work(job):
            n, i = job
            if left() < 240:
                return i, None
            return i, tashkeel_page(pages[i], n)  # الحواشي تُشكَّل مع الصفحة

        workers = max(1, min(8, len(GKEYS) * 2 + (2 if GHM else 0)))
        with cf.ThreadPoolExecutor(workers) as ex:
            for i, r in ex.map(work, list(enumerate(todo))):
                if not r:
                    STATS["fail"] += 1
                    continue
                t, m1, m2 = r
                k = i // CH
                chunks[k][str(i + 1)] = {"t": t, "h": fnv(pages[i]), "m": m1, "r": m2}
                done += 1
                STATS["pages"] += 1
                if done % 20 == 0:
                    for kk, c in chunks.items():
                        if c:
                            jsave(os.path.join(OUT, bid, "%d.json" % kk), c)
        for kk, c in chunks.items():
            if c:
                jsave(os.path.join(OUT, bid, "%d.json" % kk), c)
        n_all = sum(1 for i, t in enumerate(pages) if len(skel(t)) >= 20)
        have = sum(1 for c in chunks.values() for v in c.values())
        revd = sum(1 for c in chunks.values() for v in c.values() if v.get("r"))
        lst[bid] = {"n": have, "of": n_all, "rev": revd, "upd": time.strftime("%Y-%m-%d"), "ok": (lst.get(bid) or {}).get("ok", 0)}
        jsave(os.path.join(OUT, "_list.json"), lst)
        budget -= done
        REPORT.append("«%s»: شُكّلت %d صفحة (مجموعها %d من %d، ودُقق منها %d)" % (b.get("setTitle") or b["title"], done, have, n_all, revd))
    rep = "✍️ <b>تشكيل الكتب</b>\n" + "\n".join(REPORT[:20]) + "\nصفحات: %d • دُققت بمحرك ثانٍ: %d • تعذّر: %d" % (STATS["pages"], STATS["review"], STATS["fail"])
    open(os.path.join(ROOT, ".tk-report.txt"), "w", encoding="utf-8").write(rep if REPORT else "")
    log(rep)
    from collections import Counter
    for e, n in Counter(ERRS).most_common(8):
        print("::warning::%s × %d" % (e, n), flush=True)


if __name__ == "__main__":
    main()
