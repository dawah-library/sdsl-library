#!/usr/bin/env python3
"""كراسات المكتبة: تحويل الكتاب إلى كراسة مذاكرة ومراجعة (نحو صفحة لكل عشر صفحات من الأصل).

لكل قسم من الكتاب: عنوان وتمهيد، وكتل متنوعة: أهم المسائل، تعريفات، جدول، خريطة ذهنية، خطوات، نص بلفظه (دليل أو قول للمؤلف)،
تنبيه، وأسئلة مراجعة بأجوبتها؛ مع رقم صفحة الأصل. وفي أولها خلاصة الكتاب وخريطته، وفي آخرها أسئلة شاملة.
الأمانة: لا يُضاف رأي ولا معلومة من خارج الكتاب، ولا تُغيَّر آراء المؤلف، وتشمل الأقسام موضوعات الكتاب كلها بترتيبها؛
والنصوص المنقولة يُتحقق من وجودها بلفظها في صفحتها وإلا حُذفت.
الطابور: data/kurrasa/_queue.json (تختار الإدارة الكتب). المخرجات: data/kurrasa/<كتاب>.json و _list.json (ok=1 منشور).
المتغيرات: KR_ONLY، KR_MINUTES، KR_MAX، KR_COMMIT=1.
"""
import json, math, os, re, sys, time, subprocess, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402
from frontmatter import content_range  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "kurrasa")
REPORT = []
KINDS = {"para", "points", "def", "table", "map", "steps", "quote", "note", "qs", "compare", "sum"}
# نسبة الاختصار: صفحة كراسة لكل R صفحة من الأصل (٥ مفصّلة، ١٠ متوسطة، ٢٠ موجزة) ⇒ عدد الأقسام وكثافة الكتل
# ٢: نصف الأصل (نص الكتاب مختصرًا إلى نحو نصفه في فقرات para مع وسائل المذاكرة)، ١: دون اختصار (نص الكتاب كاملًا بلفظه + وسائل المذاكرة)
RATIO = {1: (3, 6, "دون اختصار: نص القسم يُعرض كاملًا بلفظه (يُضاف آليًا)، فأخرج وسائل المذاكرة وحدها: خريطة القسم وتعريفاته وتنبيهاته وتلخيصه وأسئلته"),
         2: (4, 8, "نصف الأصل: أعد كتابة نص القسم كله مختصرًا إلى نحو نصف طوله في كتل para متتابعة بترتيب الأصل، تستوفي كل مسألة ودليل ومثال ذكره المؤلف بأوجز من لفظه وأقرب إليه، ثم وسائل المذاكرة (ويجوز تكرار كتل para بقدر الحاجة)"),
         5: (6, 9, "مفصّلة: اشرح كل مسألة ببند، واستوعب التقسيمات والأدلة والأمثلة التي ذكرها المؤلف"),
         10: (5, 7, "متوسطة: أهم المسائل والتقسيمات والأدلة"),
         20: (4, 5, "موجزة: أصول المسائل فقط")}
STYLES = {"para": "نص الكتاب (مختصرًا أو كاملًا)", "sum": "تلخيص", "table": "جداول", "map": "تشجيرات وخرائط ذهنية", "compare": "مقارنات", "qs": "أسئلة وأجوبة", "points": "أهم المسائل",
          "def": "تعريفات", "steps": "خطوات ومراحل", "quote": "نصوص بلفظها", "note": "تنبيهات"}


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def commit(msg):
    if os.environ.get("KR_COMMIT") != "1":
        return
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", "data/kurrasa")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    run("git", "commit", "-qm", msg)
    for _ in range(5):
        run("git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main")
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=ROOT).returncode == 0:
            return
        time.sleep(5)


def body(pg):
    return re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0]


def sections(sh, pages, target):
    """تقسيم مضمون الكتاب إلى أقسام متقاربة الحجم على حدود فصوله."""
    ca, cz = content_range(pages)
    starts = sorted({t["p"] for t in (sh.get("toc") or []) if t.get("p") and t.get("l", 1) == 1 and ca <= t["p"] <= cz} | {ca})
    bounds = [(a, (starts[i + 1] - 1) if i + 1 < len(starts) else cz) for i, a in enumerate(starts)]
    size = lambda a, z: sum(len(body(pages[i])) for i in range(a - 1, z))
    total = max(1, size(ca, cz)); per = total / max(1, target)
    out, cur = [], None
    for a, z in bounds:
        while size(a, z) > per * 1.6 and z - a >= 2:  # الفصل الطويل يُقسَّم
            m, acc = a, 0
            while m < z and acc + len(body(pages[m - 1])) < per:
                acc += len(body(pages[m - 1])); m += 1
            m = max(a, min(z - 1, m - 1))
            if cur:
                out.append(cur); cur = None
            out.append((a, m)); a = m + 1
        if cur and size(cur[0], z) <= per * 1.25:
            cur = (cur[0], z)
        else:
            if cur:
                out.append(cur)
            cur = (a, z)
    if cur:
        out.append(cur)
    return [x for x in out if x[0] <= x[1]]


SEC_PROMPT = """أنت معلّم ومصمم مذكرات تعليمية متقن. حوّل هذا القسم من كتاب «{title}» لـ{author} (ص {a}–{b}){chap} إلى صفحة من «كراسة مذاكرة ومراجعة» عصرية.
أخرج JSON حرفيًا: {{"t": "عنوان القسم", "lead": "تمهيد في جملة أو جملتين", "blocks": [ ... ]}}
درجة التفصيل: {depth}. عدد الكتل {bmin} إلى {bmax}، متنوعة بحسب ما يناسب المادة، ولا تكرر نوعًا أكثر من مرتين.
الأنواع المسموح بها في هذه الكراسة فقط: {allowed}.{must}
أنواع الكتل:
 {{"k": "para", "t": "عنوان فرعي من عناوين الأصل أو مناسب له", "items": ["فقرة متصلة", ...]}}   نص القسم مختصرًا (لنصف الأصل فقط: كتل para أولًا تغطي القسم كله، ٢–٥ فقرات في الكتلة)
 {{"k": "points", "t": "عنوان", "items": ["مسألة أو فكرة موجزة", ...]}}            أهم المسائل (٣–٧)
 {{"k": "def", "items": [{{"t": "مصطلح", "d": "تعريفه كما في الكتاب", "p": صفحة}}]}}   تعريفات ذكرها المؤلف
 {{"k": "table", "t": "عنوان الجدول", "head": ["عمود", "عمود"], "rows": [["خلية", "خلية"]]}}   جدول تصنيف أو مقارنة (٢–٤ أعمدة، ٢–٧ صفوف، خلايا قصيرة)
 {{"k": "map", "t": "عنوان", "root": "الفكرة الأم", "c": [{{"t": "فرع", "c": ["فرع صغير", ...]}}]}}   خريطة ذهنية (٢–٦ فروع)
 {{"k": "steps", "t": "عنوان", "items": ["خطوة/مرحلة", ...]}}                       مراحل أو ترتيب أو شروط مرقّمة
 {{"k": "compare", "t": "عنوان", "a": "الطرف الأول", "b": "الطرف الثاني", "rows": [["وجه", "عند الأول", "عند الثاني"]]}}
 {{"k": "quote", "t": "نص منقول بلفظه حرفيًا من الكتاب (دليل أو قاعدة أو قول مهم للمؤلف) ٨–٤٠ كلمة", "by": "قائله إن لم يكن المؤلف", "p": صفحة}}
 {{"k": "note", "t": "تنبيه أو فائدة مهمة نبّه عليها المؤلف"}}
 {{"k": "sum", "t": "تلخيص القسم في فقرة متصلة (٣–٦ جمل) قريبة من ألفاظ المؤلف"}}   (قبل الأسئلة في آخر القسم)
 {{"k": "qs", "items": [{{"q": "سؤال مراجعة تام السياق يفهمه الدارس دون الرجوع إلى النص", "a": "جوابه الموجز من الكتاب"}}]}}   (٣–٥ أسئلة، كتلة واحدة في آخر القسم)
شروط الأمانة الصارمة:
- لا تضف معلومة ولا رأيًا ولا مثالًا من خارج النص، ولا تغيّر آراء المؤلف ولا ترجيحاته، ولا تنسب إليه ما لم يقله.
- اشمل موضوعات القسم كلها بترتيبها دون إخلال، وأوجز العبارة إيجازًا لا يغيّر المعنى، وقرّبها من ألفاظ المؤلف.
- النص المنقول (quote) بلفظه حرفًا بحرف، والآيات والأحاديث بلفظها.
- تجاهل صفحة العنوان وبيانات النشر والفهارس.
- اجعل العبارات قصيرة مناسبة للعرض المرئي (البند غالبًا أقل من ٢٠ كلمة)، لكن لا تُسقط مسألة من مسائل القسم.
- الجدول والمقارنة والخريطة لا تُستعمل إلا حين تكون في المادة تقسيمات أو أطراف أو فروع حقيقية.

النص (مقسّم بعلامات [ص N]):
{text}"""

BOOK_PROMPT = """هذه أقسام كراسة مذاكرة لكتاب «{title}» لـ{author}، بعناوينها وتمهيداتها:
{secs}
أخرج JSON حرفيًا: {{"s": "خلاصة الكتاب ومقصده في ثلاث جمل أمينة", "goals": ["ما يستفيده الدارس من الكتاب (٣–٥ بنود قصيرة)"], "qs": [{{"q": "سؤال شامل تام السياق", "a": "جوابه الموجز"}}]}}
اجعل الأسئلة الشاملة ٥–٨ تربط بين الأقسام، ولا تضف شيئًا من خارج ما سبق."""


def clean_block(b, pages, a, z):
    if not isinstance(b, dict) or b.get("k") not in KINDS:
        return None
    k = b["k"]
    if k == "para":
        b["items"] = [str(x).strip() for x in b.get("items") or [] if len(str(x).strip()) > 20][:8]
        b["t"] = str(b.get("t") or "").strip()[:120]
        return b if b["items"] else None
    if k in ("points", "steps"):
        b["items"] = [str(x).strip() for x in b.get("items") or [] if str(x).strip()][:8]
        return b if len(b["items"]) >= 2 else None
    if k == "def":
        b["items"] = [x for x in b.get("items") or [] if isinstance(x, dict) and x.get("t") and x.get("d")][:5]
        return b if b["items"] else None
    if k == "table":
        h = [str(x) for x in b.get("head") or []][:4]
        rows = [[str(c) for c in r][:len(h)] for r in b.get("rows") or [] if isinstance(r, list) and len(r) >= 2][:8]
        if len(h) < 2 or len(rows) < 2:
            return None
        b["head"], b["rows"] = h, [r + [""] * (len(h) - len(r)) for r in rows]
        return b
    if k == "compare":
        rows = [[str(c) for c in r][:3] for r in b.get("rows") or [] if isinstance(r, list) and len(r) >= 3][:7]
        return b if b.get("a") and b.get("b") and len(rows) >= 2 and b.update({"rows": rows}) is None else None
    if k == "map":
        c = []
        for x in b.get("c") or []:
            if isinstance(x, dict) and x.get("t"):
                c.append({"t": str(x["t"]), "c": [str(y) for y in (x.get("c") or []) if str(y).strip()][:4]})
            elif isinstance(x, str) and x.strip():
                c.append({"t": x, "c": []})
        b["c"] = c[:6]
        return b if b.get("root") and len(b["c"]) >= 2 else None
    if k == "quote":
        p = int(b.get("p") or a) if str(b.get("p") or "").isdigit() else a
        p = min(max(p, a), z)
        for pp in (p, p - 1, p + 1):
            if T.found(b.get("t", ""), pages, pp):
                b["p"] = pp; return b
        return None  # نص لم يُعثر عليه بلفظه: يُحذف
    if k in ("note", "sum"):
        return b if str(b.get("t") or "").strip() else None
    if k == "qs":
        b["items"] = [x for x in b.get("items") or [] if isinstance(x, dict) and x.get("q") and x.get("a")][:5]
        return b if b["items"] else None
    return None


def opts_of(item):
    o = item if isinstance(item, dict) else {}
    r = int(o.get("r") or 10); r = r if r in RATIO else 10
    st = [x for x in (o.get("st") or list(STYLES)) if x in STYLES] or list(STYLES)
    st = [x for x in st if x != "para"] + (["para"] if r <= 2 else [])  # نص الكتاب لنصف الأصل ودون الاختصار فقط
    return r, st


def multi(item, cat):
    """كراسة من عدة مصادر: src = [{b: معرّف كتاب أو مقال, a: من صفحة, z: إلى صفحة}] تُجمع كتابًا واحدًا،
    لكل مصدر عنوان في فهرسه، مع خريطة الصفحات (الصفحة في الكراسة ← المصدر وصفحته) للرجوع إلى الأصل."""
    pages, toc, vmap, aus = [], [], [], []
    for s in item.get("src") or []:
        r = T.source(s.get("b"), cat)
        if not r: continue
        t, au, pg, sh = r; a = max(1, int(s.get("a") or 1)); z = min(len(pg), int(s.get("z") or len(pg)))
        if a > z: continue
        toc.append({"t": t if (a, z) == (1, len(pg)) else "%s (ص %d–%d)" % (t, a, z), "p": len(pages) + 1, "l": 1})
        for i in range(a - 1, z): pages.append(pg[i]); vmap.append([s["b"], i + 1])
        if au and au not in aus: aus.append(au)
    if not pages: return None
    return item.get("t") or toc[0]["t"], "، ".join(aus[:3]), pages, {"toc": toc, "pages": pages}, vmap


def build(bid, cat, item=None):
    vmap = None
    if isinstance(item, dict) and item.get("src"):
        r = multi(item, cat)
        if not r: return "missing"
        title, au, pages, sh, vmap = r
    else:
        src = T.source(bid, cat)
        if not src:
            return "missing"
        title, au, pages, sh = src
    n = len(pages)
    R, ST = opts_of(item)
    bmin, bmax, depth = RATIO[R]
    target = max(3, min(60, round(n / R))) if R >= 5 else max(3, min(80, round(n / (6 if R == 2 else 5))))
    secs = sections(sh, pages, target - 1 if target > 3 else target)
    if isinstance(item, dict) and item.get("sample"): secs = secs[:1]  # صفحة تجريبية: القسم الأول وحده للمعاينة قبل الاعتماد
    wp = os.path.join(OUT, "_work", bid + ".json")
    work = jload(wp, {})
    if work.get("_o") != [R, ST]:  # تغيّرت الخيارات: يبدأ من جديد
        work = {"_o": [R, ST]}
    allowed = "، ".join("%s (%s)" % (k, STYLES[k]) for k in ST)
    must = ("\nفي آخر القسم دائمًا: " + " ثم ".join(x for x, k in (("كتلة sum", "sum"), ("كتلة qs", "qs")) if k in ST) + ".") if ("sum" in ST or "qs" in ST) else ""
    out = []
    toc = sh.get("toc") or []
    for a, z in secs:
        key = "%d-%d" % (a, z)
        if key in work:
            if work[key]:
                out.append(work[key])
            continue
        if time.time() > T.DEADLINE[0]:
            REPORT.append("%s: انتهت المهلة، يُستأنف" % title); return None
        chap = [x["t"] for x in toc if x.get("p") and a <= x["p"] <= z][:6]
        text = "\n".join("[ص %d]\n%s" % (i + 1, body(pages[i])[:5000]) for i in range(a - 1, z))
        if len(re.sub(r"\s", "", text)) < 300:
            work[key] = None; continue
        r = T.gemini(SEC_PROMPT.format(title=title, author=au, a=a, b=z, chap=(" — " + "، ".join(chap)) if chap else "", text=text[:80000],
                                       depth=depth, bmin=bmin + ((z - a + 1) if R == 2 else 0), bmax=bmax + (2 * (z - a + 1) if R == 2 else 0),
                                       allowed="، ".join(x for x in allowed.split("، ") if not (R == 1 and x.startswith("para"))), must=must))
        if not r:
            return None  # تعذّر مقطع: لا يُحفظ ناقصًا، ويُستأنف من حيث توقف في الجولة القادمة (المنجز محفوظ في _work)
        bl = [x for x in (clean_block(b, pages, a, z) for b in r.get("blocks") or []) if x and x["k"] in ST and not (R == 1 and x["k"] == "para")]
        if R == 1:  # النص كاملًا بلفظه من الأصل، كل ثلاث فقرات كتلة (حتى لا تطول الكتلة عن الصفحة)
            paras = [l.strip() for i in range(a - 1, z) for l in body(pages[i]).split("\n") if len(l.strip()) > 2]
            full, buf, cur = [], [], ""
            for l in paras:
                if l.startswith("#"):
                    if buf: full.append({"k": "para", "t": cur, "items": buf, "full": 1}); buf = []
                    cur = l.lstrip("# ").strip(); continue
                buf.append(l)
                if len(buf) >= 3: full.append({"k": "para", "t": cur, "items": buf, "full": 1}); buf, cur = [], ""
            if buf: full.append({"k": "para", "t": cur, "items": buf, "full": 1})
            bl = full + bl
        elif R == 2:
            bl = [x for x in bl if x["k"] == "para"] + [x for x in bl if x["k"] != "para"]
        sm, qs = [b for b in bl if b["k"] == "sum"], [b for b in bl if b["k"] == "qs"]
        bl = [b for b in bl if b["k"] not in ("qs", "sum")] + sm[:1] + qs[:1]  # تلخيص القسم ثم أسئلته في آخره
        sec = {"t": str(r.get("t") or (chap[0] if chap else "")).strip(), "lead": str(r.get("lead") or "").strip(), "p": [a, z], "blocks": bl}
        work[key] = sec; out.append(sec)
        jsave(wp, work)
        print("  قسم ص%d-%d: %d كتلة" % (a, z, len(bl)), flush=True)
    if not out or len(out) < sum(1 for k, v in work.items() if k != "_o" and v):
        return None
    top = T.gemini(BOOK_PROMPT.format(title=title, author=au, secs="\n".join("%d. %s — %s" % (i + 1, s["t"], s["lead"]) for i, s in enumerate(out)))) or {}
    k = {"id": bid, "t": title, "a": au, "n": n, "s": str(top.get("s") or "").strip(), "goals": [str(x) for x in top.get("goals") or []][:6],
         "qs": [x for x in top.get("qs") or [] if isinstance(x, dict) and x.get("q") and x.get("a")][:8],
         "secs": out, "r": R, "st": ST, "built": str(datetime.date.today()), "model": T.MODEL}
    if vmap: k["map"] = vmap; k["src"] = item.get("src")
    if isinstance(item, dict) and item.get("sample"): k["sample"] = 1
    if os.path.exists(wp):
        os.remove(wp)
    return k


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = jload(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    qp, lp = os.path.join(OUT, "_queue.json"), os.path.join(OUT, "_list.json")
    q, lst = jload(qp, {"items": []}), jload(lp, {})
    T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("KR_MINUTES", "120"))
    only = [x for x in os.environ.get("KR_ONLY", "").split(",") if x]
    todo = only or [x["id"] if isinstance(x, dict) else x for x in q.get("items", [])]
    items = {(x["id"] if isinstance(x, dict) else x): x for x in q.get("items", [])}
    for bid in todo[: int(os.environ.get("KR_MAX", "4"))]:
        if time.time() > T.DEADLINE[0] or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        bb = next((x for x in cat["books"] if x["id"] == bid), {})
        if bb.get("ocr") and (bb.get("unrev") or 0) > max(3, (bb.get("n") or 0) * 0.05):  # الأولوية للتدقيق: تُعدّ الكراسة بعد مراجعة أغلب النص على الصور (ولو بالنموذج الخفيف)
            print("  ينتظر اكتمال التدقيق:", bid, flush=True); continue
        print("كراسة:", bid, flush=True)
        try:
            k = build(bid, cat, items.get(bid))
        except Exception as e:
            print("  خطأ:", str(e)[:200], flush=True); k = None
        if k == "missing":
            q["items"] = [x for x in q.get("items", []) if (x["id"] if isinstance(x, dict) else x) != bid]
            jsave(qp, q); continue
        if not k:
            continue
        jsave(os.path.join(OUT, bid + ".json"), k)
        nb = sum(len(s["blocks"]) for s in k["secs"])
        lst[bid] = {"t": k["t"], "a": k["a"], "secs": len(k["secs"]), "blocks": nb, "r": k["r"], "upd": k["built"], "ok": 0 if k.get("sample") else (lst.get(bid) or {}).get("ok", 1)}
        if k.get("sample"): lst[bid]["sample"] = 1; lst[bid]["item"] = {x: v for x, v in items.get(bid, {}).items() if x != "sample"}
        jsave(lp, lst)
        q["items"] = [x for x in q.get("items", []) if (x["id"] if isinstance(x, dict) else x) != bid]
        jsave(qp, q)
        REPORT.append("✓ كراسة «%s»: %d قسمًا، %d كتلة" % (k["t"], len(k["secs"]), nb))
        commit("كراسة: «%s»" % k["t"])
    open(os.path.join(ROOT, ".kr-report.txt"), "w", encoding="utf-8").write(("📘 <b>كراسات المكتبة</b>\n" + "\n".join(REPORT)) if REPORT else "")
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
