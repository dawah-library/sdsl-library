#!/usr/bin/env python3
"""تشجير الكتب (خرائط ذهنية): للكتب التي تختارها الإدارة فقط (data/tashjir/_queue.json).

ثلاثة مستويات: تشجير عام للكتاب (أقسامه الكبرى)، ومتوسط للفصول والأبواب، وتفصيلي للموضوعات ونقاطها.
كل عقدة مربوطة بصفحاتها، ولكل نقطة تفصيلية عبارة قصيرة منقولة بلفظها من الكتاب يُتحقق من وجودها في الصفحة (v=1)،
وما لم يُعثر عليه يُعلَّم v=0 للمراجعة. ثم جولة تدقيق علمي ثانية تقارن كل نقطة بنص صفحتها وتصحح أو تحذف.
المخرجات: data/tashjir/<كتاب>.json و data/tashjir/_list.json (ok=1: يُنشر مباشرة، وللإدارة إيقافه).
"""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from frontmatter import content_range  # noqa: E402  صفحات العنوان والنشر والفهارس لا تُشجَّر

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "tashjir")
KEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 21)] if k.strip()]
MODEL = os.environ.get("TJ_MODEL", "gemini-flash-latest")
DIAC = re.compile(r"[ً-ْٰـ]")
EXH = set()


def norm(s):
    s = DIAC.sub("", s or "")
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"[^ء-ي0-9 ]+", " ", s).split()


def gemini(prompt, schema_hint=""):
    for k in range(len(KEYS)):
        if k in EXH:
            continue
        for attempt in range(3):
            if time.time() > DEADLINE[0] + 20 * 60:  # حد صارم قبل مهلة المهمة (330 د) حتى لا تُلغى ويضيع المنجز
                print("  تجاوز المهلة؛ أُوقفت طلبات Gemini", flush=True)
                return None
            try:
                body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                   "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json", "maxOutputTokens": 30000}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % MODEL, data=body,
                                             headers={"content-type": "application/json", "x-goog-api-key": KEYS[k]})
                with urllib.request.urlopen(req, timeout=150) as r:
                    j = json.loads(r.read())
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore")
                print("  Gemini", e.code, msg[:120], flush=True)
                if e.code == 429 and re.search(r"day|PerDay", msg, re.I):
                    EXH.add(k); break
                time.sleep(20 * (attempt + 1))
            except Exception as e:
                print("  خطأ", str(e)[:120], flush=True)
                time.sleep(5 * (attempt + 1))
    return None


def found(quote, pages, p):
    """هل العبارة موجودة بلفظها في الصفحة (أو جارتيها)؟"""
    q = " ".join(norm(quote))
    if len(q) < 6:
        return False
    for i in (p - 1, p - 2, p):
        if 0 <= i < len(pages) and q in " ".join(norm(pages[i])):
            return True
    return False


CH_PROMPT = """أنت باحث شرعي متقن تُعدّ خريطة ذهنية (تشجيرًا) دقيقة لفصل من كتاب «{title}» لـ{author}، من الصفحة {a} إلى {b}.
النص مقسّم بعلامات [ص N]. أخرج JSON بهذا الشكل حرفيًا:
{{"t": "عنوان الفصل كما في الكتاب أو أقرب عنوان دال", "s": "خلاصة الفصل في جملة واحدة أمينة", "p": [{a}, {b}],
 "c": [ {{"t": "عنوان موضوع", "s": "خلاصته في جملة", "p": [من, إلى],
          "c": [ {{"t": "نقطة موجزة (لا تزيد على ١٥ كلمة) تعبّر عن فكرة الكتاب بأمانة", "k": "نوعها", "p": رقم_الصفحة, "q": "عبارة قصيرة من ٤ إلى ١٢ كلمة منقولة بلفظها حرفيًا من النص تدل على النقطة"}} ] }} ],
 "m": [ {{"t": "مصطلح عرّفه المؤلف في هذا الفصل", "d": "تعريفه بلفظ الكتاب أو أقرب ما يكون إليه", "p": رقم_الصفحة}} ]}}
نوع النقطة k واحد من: تعريف، حكم، دليل، قاعدة، شرط، قسم، مثال، تنبيه، خلاف، فائدة، رد (على شبهة أو قول).
القواعد: لا تُدخل رأيًا ولا معلومة من خارج النص؛ رتّب الموضوعات بترتيب ورودها؛ من ٣ إلى ٨ موضوعات، ولكل موضوع من ٢ إلى ٦ نقاط؛ الصفحات من الأرقام المذكورة فقط؛ العبارة q يجب أن تكون منسوخة كما هي.
تجاهل تمامًا: صفحة العنوان، وبيانات الطبعة والنشر والحقوق والتوزيع، والفهارس، والإهداء، وأسماء الدور والمطابع؛ فلا تجعل منها موضوعًا ولا نقطة. والمصطلحات m ما عرّفه المؤلف صراحةً فقط (قد تكون فارغة).

النص:
{text}"""

BOOK_PROMPT = """هذه خلاصات فصول كتاب «{title}» لـ{author} بترتيبها. أخرج JSON: {{"s": "خلاصة الكتاب في جملتين أمينتين", "g": [ {{"t": "عنوان قسم كبير من أقسام الكتاب", "s": "خلاصته", "i": [أرقام الفصول التابعة له بالترتيب] }} ]}}
اجعل الأقسام من ٢ إلى ٧، ولا يتكرر فصل في قسمين، وتشمل كل الفصول.

الفصول:
{chs}"""

REV_PROMPT = """أنت مدقق علمي. لكل نقطة أدناه نص صفحتها من كتاب «{title}». تحقق هل النقطة تعبّر عن مراد الكتاب بأمانة ودقة.
أخرج JSON: {{"r": [ {{"i": رقم_النقطة, "ok": true أو false, "fix": "صياغة مصححة أمينة إن لزم وإلا فارغ"}} ]}}

{items}"""


def chapters(sh, n):
    toc = [t for t in (sh.get("toc") or []) if t.get("l", 1) == 1 and t.get("p")]
    starts = sorted(set([1] + [t["p"] for t in toc]))
    if len(starts) < 3:  # بلا فهرس: أجزاء من ١٥ صفحة
        starts = list(range(1, n + 1, 15))
    out = []
    for i, a in enumerate(starts):
        b = (starts[i + 1] - 1) if i + 1 < len(starts) else n
        while b - a + 1 > 30:  # الفصول الطويلة تُقسّم
            out.append((a, a + 24)); a += 25
        if b >= a:
            out.append((a, b))
    return out


ARTS = None


def source(bid, cat):
    """الكتاب أو المقال: (العنوان، المؤلف، الصفحات، الفهرس) أو None إن لم يوجد."""
    global ARTS
    au = {a["id"]: a["name"] for a in cat["authors"]}
    b = next((x for x in cat["books"] if x["id"] == bid), None)
    if b:
        for p in (os.path.join(ROOT, "data", "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
            if os.path.exists(p):
                sh = json.load(open(p, encoding="utf-8"))
                return b.get("setTitle") or b["title"], au.get(b.get("authorId"), ""), sh.get("pages") or [], sh
        return None
    if ARTS is None:
        ip = os.path.join(ROOT, "data", "articles", "index.json")
        ARTS = {x["id"]: x for x in json.load(open(ip, encoding="utf-8"))["items"]} if os.path.exists(ip) else {}
    x = ARTS.get(bid)
    if not x:
        return None
    g = json.load(open(os.path.join(ROOT, "data", "articles", x["f"] + ".json"), encoding="utf-8"))
    pages = []
    for pg in (g.get(bid) or {}).get("pages") or []:  # المقال الطويل يُقسَّم مقاطع (~٣٠٠٠ حرف) تُعامل كالصفحات
        cur = ""
        for para in (pg or "").split("\n"):
            if len(cur) + len(para) > 3000 and cur:
                pages.append(cur); cur = ""
            cur += para + "\n"
        if cur.strip():
            pages.append(cur)
    return x["t"], au.get(x.get("a"), ""), pages, {}


def build(bid, cat):
    src = source(bid, cat)
    if not src or not any((p or "").strip() for p in src[2]):
        print("  غير موجود أو بلا نص:", bid, flush=True)
        return "missing"
    title, au, pages, sh = src
    # ذاكرة التقدّم: الفصول المنجزة تُحفظ وتُودَع في المستودع، فتُستأنف من حيث توقفت إن انتهت مهلة المهمة
    wp = os.path.join(OUT, "_work", bid + ".json")
    work = json.load(open(wp, encoding="utf-8")) if os.path.exists(wp) else {}
    chs = []
    ca, cz = content_range(pages)
    for a, z in chapters(sh, len(pages)):
        a, z = max(a, ca), min(z, cz)
        if a > z:
            continue
        key = "%d-%d" % (a, z)
        if key in work:
            if work[key]:
                chs.append(work[key])
            continue
        if time.time() > DEADLINE[0]:
            print("  انتهت مهلة الجولة؛ يُستأنف الكتاب في الجولة القادمة", flush=True)
            return None
        text = "\n".join("[ص %d]\n%s" % (i + 1, re.sub(r"^\s*_{4,}[\s\S]*$", "", pages[i] or "", flags=re.M)[:4000]) for i in range(a - 1, z))
        if len(re.sub(r"\s", "", text)) < 300:
            work[key] = None
            continue
        r = gemini(CH_PROMPT.format(title=title, author=au, a=a, b=z, text=text[:60000]))
        if not r:
            print("  تعذر الفصل", a, z, flush=True)
            if len(EXH) >= len(KEYS):
                return None
            continue
        for tp in r.get("c", []):
            for pt in tp.get("c", []):
                pt["v"] = 1 if found(pt.get("q", ""), pages, int(pt.get("p") or a)) else 0
        chs.append(r); work[key] = r
        os.makedirs(os.path.dirname(wp), exist_ok=True)
        json.dump(work, open(wp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("  الفصل %d-%d: %d موضوعات" % (a, z, len(r.get("c", []))), flush=True)
        if len(work) % 6 == 0:
            commit("تشجير «%s»: تقدّم (%d فصلًا)" % (title, len(work)))
    if not chs:
        return None
    top = gemini(BOOK_PROMPT.format(title=title, author=au, chs="\n".join("%d. %s — %s (ص %s)" % (i + 1, c.get("t", ""), c.get("s", ""), c.get("p")) for i, c in enumerate(chs)))) or {}
    groups = []
    used = set()
    for g in top.get("g", []):
        idx = [i - 1 for i in g.get("i", []) if isinstance(i, int) and 0 < i <= len(chs) and i - 1 not in used]
        used.update(idx)
        if idx:
            kids = [chs[i] for i in idx]
            groups.append({"t": g.get("t", ""), "s": g.get("s", ""), "p": [kids[0]["p"][0], kids[-1]["p"][-1]], "c": kids})
    rest = [chs[i] for i in range(len(chs)) if i not in used]
    if rest:
        groups.append({"t": "فصول أخرى", "s": "", "p": [rest[0]["p"][0], rest[-1]["p"][-1]], "c": rest})
    # تدقيق علمي للنقاط غير الموثقة أو كلها إن اتسعت الحصة
    pts = []
    for g in groups:
        for ch in g["c"]:
            for tp in ch.get("c", []):
                for pt in tp.get("c", []):
                    pts.append(pt)
    for k in range(0, len(pts), 25):
        part = pts[k:k + 25]
        items = "\n\n".join("نقطة %d: %s\nنص الصفحة %s: %s" % (i, pt.get("t", ""), pt.get("p"), (pages[int(pt.get("p") or 1) - 1] or "")[:1800]) for i, pt in enumerate(part))
        rv = None if time.time() > DEADLINE[0] else gemini(REV_PROMPT.format(title=title, items=items))
        if not rv:
            break
        for r in rv.get("r", []):
            i = r.get("i")
            if isinstance(i, int) and 0 <= i < len(part):
                if r.get("ok") is False and r.get("fix"):
                    part[i]["t"] = r["fix"]; part[i]["r"] = "fix"
                elif r.get("ok") is False:
                    part[i]["r"] = "bad"
                else:
                    part[i]["r"] = "ok"
    terms = []
    for ch in chs:
        for x in ch.pop("m", None) or []:
            if isinstance(x, dict) and x.get("t") and x.get("d") and not any(norm(x["t"]) == norm(y["t"]) for y in terms):
                terms.append({"t": x["t"].strip(), "d": x["d"].strip(), "p": int(x.get("p") or ch["p"][0])})
    m = {"id": bid, "t": title, "a": au, "s": top.get("s", ""), "p": [1, len(pages)], "c": groups, "m": terms, "built": time.strftime("%Y-%m-%d"), "model": MODEL}
    k = [0]
    def ids(n):  # معرّف ثابت لكل عقدة (للتصحيح اليدوي)
        k[0] += 1; n["i"] = k[0]
        for c in n.get("c", []):
            ids(c)
    for g in m["c"]:
        ids(g)
    return m


DEADLINE = [time.time() + 3e4]


def commit(msg):
    """إيداع فوري في المستودع (حتى لا يضيع المنجز إن انتهت مهلة المهمة قبل خطوة الحفظ)."""
    if os.environ.get("TJ_COMMIT") != "1":
        return
    import subprocess
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", "data/tashjir")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    run("git", "commit", "-qm", msg)
    for _ in range(5):
        run("git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main")
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=ROOT).returncode == 0:
            return
        time.sleep(5)


FRONT_RX = re.compile(r"صفحة العنوان|بيانات (النشر|الطبع|الكتاب)|حقوق الطبع|منافذ (توزيع|النشر)|الناشر|دار النشر|الفهرس|فهرس الموضوعات")


def prune(bid):
    """تنقية خريطة قائمة: حذف فروع صفحة العنوان وبيانات النشر والفهارس، وإعادة حساب عدد النقاط."""
    fp = os.path.join(OUT, bid + ".json")
    m = json.load(open(fp, encoding="utf-8"))
    src = source(bid, json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8")))
    ca, cz = content_range(src[2]) if src else (1, 10 ** 6)

    def bad(n):
        p = n.get("p")
        a, z = (p[0], p[-1]) if isinstance(p, list) and p else (p or 0, p or 0)
        return (z and z < ca) or (a and a > cz) or bool(FRONT_RX.search(n.get("t", "")))

    def walk(n):
        n["c"] = [walk(c) for c in n.get("c", []) if not bad(c)]
        n["c"] = [c for c in n["c"] if c.get("c") or c.get("q") or not isinstance(c.get("p"), list)]
        return n
    before = json.dumps(m, ensure_ascii=False)
    for g in m.get("c", []):
        walk(g)
    m["c"] = [g for g in m["c"] if g.get("c")]
    for g in m["c"]:  # نطاق كل غصن بعد التنقية
        ps = [c["p"] for c in g["c"] if isinstance(c.get("p"), list)]
        if ps:
            g["p"] = [min(p[0] for p in ps), max(p[-1] for p in ps)]
    if json.dumps(m, ensure_ascii=False) != before:
        json.dump(m, open(fp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        lp = os.path.join(OUT, "_list.json"); lst = json.load(open(lp, encoding="utf-8"))
        if bid in lst:
            lst[bid]["n"] = sum(1 for g in m["c"] for ch in g["c"] for tp in ch.get("c", []) for pt in tp.get("c", []))
            json.dump(lst, open(lp, "w", encoding="utf-8"), ensure_ascii=False)
        print("نُقّيت:", bid)


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    qp, lp = os.path.join(OUT, "_queue.json"), os.path.join(OUT, "_list.json")
    q = json.load(open(qp, encoding="utf-8")) if os.path.exists(qp) else {"items": []}
    lst = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    only = [x for x in os.environ.get("TJ_ONLY", "").split(",") if x]
    todo = only or [x["id"] if isinstance(x, dict) else x for x in q.get("items", [])]
    done = []
    drop = []
    t0 = time.time()
    DEADLINE[0] = t0 + 60 * float(os.environ.get("TJ_MINUTES", "280"))
    # طلبات الإدارة أولًا، ثم الأقصر فالأطول (فيظهر المنجز سريعًا)
    size = {b["id"]: b.get("n") or 9999 for b in cat["books"]}
    req = {x["id"] for x in q.get("items", []) if isinstance(x, dict) and not x.get("auto")}
    if not only:
        todo.sort(key=lambda b: (0 if b in req else 1, size.get(b, 50)))
    for bid in todo[: int(os.environ.get("TJ_MAX", "6"))]:
        if time.time() > DEADLINE[0] or (KEYS and len(EXH) >= len(KEYS)):
            break
        print("تشجير:", bid, flush=True)
        try:
            m = build(bid, cat)
        except Exception as e:  # خطأ في كتاب لا يوقف البقية
            print("  خطأ في", bid, str(e)[:200], flush=True); m = None
        if m == "missing":
            drop.append(bid); continue
        if not m:
            continue
        json.dump(m, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        n = sum(1 for g in m["c"] for ch in g["c"] for tp in ch.get("c", []) for pt in tp.get("c", []))
        # يُنشر مباشرة (بقرار المالك)، وللإدارة إيقاف عرضه من صفحته
        lst[bid] = {"t": m["t"], "n": n, "upd": m["built"], "ok": (lst.get(bid) or {}).get("ok", 1)}
        done.append(bid)
        # حفظ بعد كل كتاب حتى لا يضيع المنجز إن انقطعت المهمة
        q["items"] = [x for x in q.get("items", []) if (x["id"] if isinstance(x, dict) else x) not in done + drop]
        json.dump(q, open(qp, "w", encoding="utf-8"), ensure_ascii=False)
        json.dump(lst, open(lp, "w", encoding="utf-8"), ensure_ascii=False)
        wp = os.path.join(OUT, "_work", bid + ".json")
        if os.path.exists(wp):
            os.remove(wp)
        commit("تشجير الكتب: «%s»" % m["t"])
    q["items"] = [x for x in q.get("items", []) if (x["id"] if isinstance(x, dict) else x) not in done + drop]
    json.dump(q, open(qp, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(lst, open(lp, "w", encoding="utf-8"), ensure_ascii=False)
    if done:
        open(os.path.join(ROOT, ".tj-report.txt"), "w", encoding="utf-8").write("🌳 <b>تشجير الكتب</b>: جُهّز تشجير %s، ونُشر في صفحة التشجير." % "، ".join("«%s»" % lst[d]["t"] for d in done))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--prune":
        for f in sorted(os.listdir(OUT)):
            if f.endswith(".json") and not f.startswith("_"):
                prune(f[:-5])
    else:
        main()
