#!/usr/bin/env python3
"""اختبارات محرَّرة واختصارات محرَّرة للكتب (Gemini)، مع تدقيق ثانٍ لكل سؤال.

الاختبارات (data/quizzes/<كتاب>.json، src="ai"):
  - ثلاثة مستويات: سهل (يُعرض منها ١٥ سؤالًا)، متوسط (٣٠)، متقدم (٥٠)؛ ويُعدّ لكل مستوى مخزون أكبر ليتجدد الاختبار.
  - أنواع متنوعة: اختيار من متعدد، صح أم خطأ، و«أكمل» للأحاديث والآثار والقواعد والتعريفات التي يحسن حفظها.
  - كل سؤال تام السياق مفهوم بنفسه، ومعه عبارة الكتاب التي يقوم عليها (يُتحقق من وجودها في الصفحة) وتعليل موجز ورقم الصفحة.
  - جولة مراجعة ثانية تحذف الغامض والمقتطع وما له أكثر من جواب، أو تصححه.
الاختصارات (data/summ/<كتاب>.json):
  - لكل فصل ثلاث درجات (نحو النصف، والربع، والعُشر) وفكرته المحورية، بعبارات قريبة جدًا من ألفاظ المؤلف وسياقة متصلة سليمة،
    مع رقم صفحة الأصل لكل فقرة، ونسبة ما بقي من ألفاظ المؤلف (lit) ليُنبَّه القارئ إن كان الاختصار بتصرف.
الطابور: data/study-queue.json {"items": [{"id": "<كتاب>", "do": ["quiz", "summ"]}]}، ثم كتب مكتبة الدعوة الأقصر فالأطول.
المتغيرات: ST_ONLY (كتب بعينها)، ST_DO (quiz,summ)، ST_MINUTES، ST_MAX، ST_COMMIT=1.
"""
import json, math, os, re, sys, time, random, subprocess, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402  (gemini، norm، found، source، chapters)
from frontmatter import content_range  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QD, SD = os.path.join(ROOT, "data", "quizzes"), os.path.join(ROOT, "data", "summ")
LEVELS = {"easy": 15, "mid": 30, "hard": 50}           # ما يُعرض في الاختبار الواحد
POOL = {k: int(v * 1.5) for k, v in LEVELS.items()}     # المخزون لكل مستوى (يتجدد منه الاختبار)
REPORT = []


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def commit(msg):
    if os.environ.get("ST_COMMIT") != "1":
        return
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", "data/quizzes", "data/summ", "data/study-queue.json")
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


def chunks(sh, pages):
    """فصول الكتاب داخل مضمونه (بلا العنوان والنشر والفهارس)، تُدمج القصيرة وتُقسم الطويلة."""
    ca, cz = content_range(pages)
    out = []
    for a, z in T.chapters(sh, len(pages)):
        a, z = max(a, ca), min(z, cz)
        if a > z:
            continue
        if out and (out[-1][1] - out[-1][0] + 1 < 5 or z - a + 1 < 3) and z - out[-1][0] + 1 <= 22:
            out[-1] = (out[-1][0], z)
        else:
            out.append((a, z))
    res = []  # المقطع الطويل يُقسَّم (حتى ١٢ صفحة) فلا يُقتطع آخره عند إرساله
    for a, z in out:
        n = z - a + 1; k = max(1, math.ceil(n / 12)); step = math.ceil(n / k)
        for i in range(k):
            x = a + i * step
            if x <= z:
                res.append((x, min(z, x + step - 1)))
    return res


def text_of(pages, a, z, lim=3800):
    return "\n".join("[ص %d]\n%s" % (i + 1, body(pages[i])[:lim]) for i in range(a - 1, z))


def toc_title(sh, a):
    t = [x for x in (sh.get("toc") or []) if x.get("p") and x["p"] <= a]
    return t[-1]["t"] if t else ""


# ---------------------------------------------------------------- الاختبارات
QUIZ_PROMPT = """أنت معلّم شرعي متقن تُعدّ أسئلة اختبار لفهم كتاب «{title}» لـ{author}، من الصفحة {a} إلى {b}{chap}.
النص مقسّم بعلامات [ص N]. أخرج JSON بهذا الشكل حرفيًا:
{{"qs": [ {{"lvl": "easy|mid|hard", "type": "mcq|tf|cloze", "q": "نص السؤال", "opts": ["أربعة بدائل للاختيار من متعدد فقط"], "a": "الجواب", "e": "تعليل موجز من كلام الكتاب", "p": رقم_الصفحة, "src": "عبارة من ٥ إلى ٢٠ كلمة منقولة حرفيًا من النص يقوم عليها السؤال"}} ]}}
المطلوب: {ne} أسئلة سهلة، و{nm} متوسطة، و{nh} متقدمة.
المستويات:
- السهل: معلومة صريحة واضحة (تعريف، حكم ظاهر، قائل قول مشهور، مقصد الباب).
- المتوسط: فهم وربط داخل الفصل (علة، شرط، فرق بين أمرين، تطبيق على صورة، ثمرة مسألة).
- المتقدم: مسائل دقيقة (استثناء، ترجيح وسببه، وجه الاستدلال بالدليل، قيد أو ضابط، مقارنة بين أقوال).
الأنواع:
- نحو النصف «اختيار من متعدد» mcq: أربعة بدائل معقولة من جنس واحد، وجواب واحد صحيح بلا لبس، و a مطابق لأحد البدائل حرفيًا.
- نحو الثلث «صح أم خطأ» tf: عبارة تامة المعنى؛ والعبارة الخاطئة تحريف واضح لمضمون الكتاب (حكم أو نسبة أو علة) لا لفظ تافه، و a «صح» أو «خطأ».
- والباقي «أكمل» cloze: للأحاديث والآثار والقواعد والضوابط والتعريفات التي يحسن حفظها فقط؛ اذكر قبلها ما يعرّف بها (مثل: أكمل الحديث الذي استدل به المؤلف على كذا: …)، واحذف كلمة أو كلمتين مفتاحيتين واكتب مكانهما ……، و a هو المحذوف بلفظه في الكتاب.
شروط صارمة:
- كل سؤال مفهوم بنفسه تام المعلومات: اذكر سياقه (المسألة أو الباب أو القائل) حتى لا يقرأ الطالب جملة مقتطعة مبهمة، ولا تبدأ بضمير أو اسم إشارة يعود على ما لم يُذكر.
- الجواب منصوص في النص أو مفهوم منه بوضوح، ولا تُدخل معلومة أو رأيًا من خارجه، ولا تخالف مراد المؤلف.
- لا تسأل عن أرقام الصفحات ولا ترتيب الفصول ولا بيانات الطبعة والنشر ولا عن ألفاظ لا يتعلق بها فهم.
- النصوص الشرعية بلفظها؛ ولا يكون الخطأ في «صح أم خطأ» تحريفًا للفظ آية أو حديث، بل في نسبة الحكم أو الفهم.
- لا تكرر سؤالًا بصيغة أخرى، ونوّع الموضوعات على صفحات المقطع كلها.

النص:
{text}"""

REVIEW_PROMPT = """أنت مراجع اختبارات علمية دقيق لكتاب «{title}». لكل سؤال أدناه نص صفحته من الكتاب.
احكم على كل سؤال: هل هو واضح تام السياق مفهوم بنفسه، وجوابه صحيح وحيد بحسب النص، وبدائله (إن وُجدت) معقولة وليس فيها جواب صحيح آخر، ومستواه مناسب؟
أخرج JSON: {{"r": [ {{"i": رقم_السؤال, "ok": true أو false, "fix": {{"q": "...", "opts": [...], "a": "...", "e": "..."}} }} ]}}
- إن أمكن إصلاح السؤال بإكمال سياقه أو تصحيح جوابه أو بدائله فاجعل ok=false وضع الإصلاح كاملًا في fix.
- إن كان مقتطعًا لا يُصلح، أو خارج النص، أو تافهًا، فاجعل ok=false بلا fix.

{items}"""


def valid(q):
    t, a = q.get("type"), str(q.get("a") or "").strip()
    if q.get("lvl") not in LEVELS or not q.get("q") or not a or len(q["q"]) < 15:
        return False
    if t == "mcq":
        o = [str(x).strip() for x in (q.get("opts") or []) if str(x).strip()]
        if len(o) != 4 or len(set(o)) != 4 or a not in o:
            return False
        q["opts"] = o
    elif t == "tf":
        if a not in ("صح", "خطأ"):
            return False
    elif t == "cloze":
        if "……" not in q["q"] and "..." not in q["q"]:
            return False
        q["q"] = q["q"].replace("...", "……")
        if len(a.split()) > 4:
            return False
    else:
        return False
    if re.search(r"(في|من) الصفحة|رقم الصفحة|الطبعة|دار النشر", q["q"]):
        return False
    return True


def quiz_book(bid, cat):
    src = T.source(bid, cat)
    if not src:
        return None
    title, au, pages, sh = src
    ch = chunks(sh, pages)
    if not ch:
        return None
    sizes = [sum(len(body(pages[i])) for i in range(a - 1, z)) for a, z in ch]
    tot = max(1, sum(sizes))
    wp = os.path.join(QD, "_work", bid + ".json")
    work = jload(wp, {})
    qs = []
    for (a, z), sz in zip(ch, sizes):
        key = "%d-%d" % (a, z)
        if key in work:
            qs += work[key]; continue
        if time.time() > T.DEADLINE[0]:
            REPORT.append("%s: انتهت المهلة، يُستأنف" % title); return None
        share = sz / tot
        ne, nm, nh = (max(1, round(POOL[k] * share)) for k in ("easy", "mid", "hard"))
        if sz < 600:
            work[key] = []; continue
        r = T.gemini(QUIZ_PROMPT.format(title=title, author=au, a=a, b=z, chap=(" (" + toc_title(sh, a) + ")") if toc_title(sh, a) else "",
                                        ne=ne, nm=nm, nh=nh, text=text_of(pages, a, z)[:60000]))
        if not r:
            if len(T.EXH) >= len(T.KEYS):
                return None
            continue
        got = []
        for q in r.get("qs", []):
            if not isinstance(q, dict) or not valid(q):
                continue
            p = int(q.get("p") or a) if str(q.get("p") or "").isdigit() else a
            q["p"] = min(max(p, a), z)
            if not T.found(q.get("src", ""), pages, q["p"]) and not T.found(q.get("src", ""), pages, q["p"] + 1):
                continue  # لا سؤال بلا أصل ظاهر في الكتاب
            got.append(q)
        work[key] = got; qs += got
        jsave(wp, work)
        print("  اختبار %s ص%d-%d: %d سؤالًا" % (title, a, z, len(got)), flush=True)
    # المراجعة الثانية
    out = []
    for k in range(0, len(qs), 18):
        part = qs[k:k + 18]
        items = "\n\n".join("سؤال %d (%s، %s): %s%s\nالجواب: %s\nنص الصفحة %d: %s" % (
            i, q["type"], q["lvl"], q["q"], ("\nالبدائل: " + " | ".join(q["opts"])) if q["type"] == "mcq" else "", q["a"], q["p"], body(pages[q["p"] - 1])[:1600])
            for i, q in enumerate(part))
        rv = T.gemini(REVIEW_PROMPT.format(title=title, items=items))
        verdict = {}
        if rv:
            for x in rv.get("r", []):
                if isinstance(x, dict) and isinstance(x.get("i"), int):
                    verdict[x["i"]] = x
        for i, q in enumerate(part):
            v = verdict.get(i)
            if v is None:
                if rv is None:
                    q["rev"] = 0; out.append(q)  # لم تتم المراجعة (حصة): يبقى، ويُراجع في الجولة القادمة
                continue
            if v.get("ok"):
                q["rev"] = 1; out.append(q)
            elif isinstance(v.get("fix"), dict):
                n = dict(q); n.update({kk: vv for kk, vv in v["fix"].items() if kk in ("q", "opts", "a", "e") and vv})
                if valid(n):
                    n["rev"] = 2; out.append(n)
    # إزالة المكرر
    seen, final = set(), []
    for q in out:
        k = " ".join(T.norm(q["q"]))[:80]
        if k in seen:
            continue
        seen.add(k); final.append(q)
    for i, q in enumerate(final):
        q["ctx"] = q.pop("src", "")  # عبارة الكتاب التي يقوم عليها السؤال: تُعرض بعد الإجابة
        q.update({"id": "ai%s%d" % (bid[-4:], i), "ok": True, "src": "ai"})
    if os.path.exists(wp):
        os.remove(wp)
    return final


def save_quiz(bid, qs):
    fp = os.path.join(QD, bid + ".json")
    old = jload(fp, {"qs": []})
    manual = [q for q in old.get("qs", []) if q.get("src") not in ("qa", "text", "ai")]
    allq = manual + qs
    jsave(fp, {"v": 2, "b": bid, "at": str(datetime.date.today()), "qs": allq, "ai": 1})
    ip = os.path.join(QD, "index.json")
    idx = jload(ip, {"v": 1, "items": []})
    lv = {}
    for q in allq:
        if q.get("ok"):
            lv[q["lvl"]] = lv.get(q["lvl"], 0) + 1
    idx["items"] = [x for x in idx.get("items", []) if x["b"] != bid] + [{"b": bid, "n": sum(lv.values()), "lv": lv, "ai": 1}]
    idx["items"].sort(key=lambda x: (-(x.get("ai") or 0), -x["n"]))
    jsave(ip, idx)


# ---------------------------------------------------------------- الاختصارات
SUMM_PROMPT = """اختصر المقطع التالي من كتاب «{title}» لـ{author} (ص {a}–{b}){chap} بثلاث درجات.
أخرج JSON حرفيًا: {{"t": "عنوان المقطع كما في الكتاب أو أقرب عنوان دال", "k": "الفكرة المحورية في جملة واحدة", "r50": "…", "r25": "…", "r10": "…"}}
- r50 في نحو نصف حجم النص، و r25 في نحو ربعه، و r10 في نحو عُشره (فقرة أو فقرتان).
- التزم ألفاظ المؤلف وعباراته ما أمكن، ولا تغيّرها إلا للربط والإيجاز؛ واحذف الاستطراد والتكرار وكثرة الأمثلة وسلاسل الأسانيد.
- اجعل السياقة متصلة سليمة: كل جملة مفهومة في موضعها، بلا ضمائر معلّقة ولا انتقال مبتور.
- الآيات والأحاديث إن أبقيتها فبلفظها كاملًا، ولا تضف معلومة أو رأيًا من خارج النص، ولا تخالف مراد المؤلف ولا ترجّح ما لم يرجّحه.
- قسّم كل درجة فقرات بسطر جديد، وضع في آخر كل فقرة رقم صفحة الأصل بين معقوفين مثل [ص {a}].
- تجاهل صفحة العنوان وبيانات النشر والفهارس إن وُجدت.

النص:
{text}"""


def lit(summary, src_tokens):
    """نسبة ألفاظ الاختصار الموجودة بترتيبها في الأصل (رباعيات الكلمات)."""
    w = T.norm(re.sub(r"\[ص\s*\d+\]", " ", summary))
    if len(w) < 8:
        return 1.0
    grams = [" ".join(w[i:i + 4]) for i in range(len(w) - 3)]
    return round(sum(1 for g in grams if g in src_tokens) / max(1, len(grams)), 2)


def summ_book(bid, cat):
    src = T.source(bid, cat)
    if not src:
        return None
    title, au, pages, sh = src
    ch = chunks(sh, pages)
    wp = os.path.join(SD, "_work", bid + ".json")
    work = jload(wp, {})
    out = []
    for a, z in ch:
        key = "%d-%d" % (a, z)
        if key in work:
            if work[key]:
                out.append(work[key])
            continue
        if time.time() > T.DEADLINE[0]:
            REPORT.append("%s: انتهت المهلة، يُستأنف" % title); return None
        txt = text_of(pages, a, z, 6000)
        if len(re.sub(r"\s", "", txt)) < 400:
            work[key] = None; continue
        r = T.gemini(SUMM_PROMPT.format(title=title, author=au, a=a, b=z, chap=(" — " + toc_title(sh, a)) if toc_title(sh, a) else "", text=txt[:70000]))
        if not r or not r.get("r50"):
            if len(T.EXH) >= len(T.KEYS):
                return None
            continue
        st = " ".join(T.norm(" ".join(body(pages[i]) for i in range(a - 1, z))))
        srcg = set()
        tk = st.split()
        for i in range(len(tk) - 3):
            srcg.add(" ".join(tk[i:i + 4]))
        c = {"t": (r.get("t") or toc_title(sh, a) or "").strip(), "p": [a, z], "k": (r.get("k") or "").strip(),
             "ow": len(tk), "lit": {}}
        for lv in ("r50", "r25", "r10"):
            s = str(r.get(lv) or "").strip()
            c[lv] = s
            c["lit"][lv[1:]] = lit(s, srcg)
        work[key] = c; out.append(c)
        jsave(wp, work)
        print("  اختصار %s ص%d-%d" % (title, a, z), flush=True)
    if not out:
        return None
    if os.path.exists(wp):
        os.remove(wp)
    return {"id": bid, "t": title, "a": au, "built": str(datetime.date.today()), "model": T.MODEL, "chs": out}


# ---------------------------------------------------------------- التشغيل
def main():
    cat = jload(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    qp = os.path.join(ROOT, "data", "study-queue.json")
    q = jload(qp, {"items": []})
    do_all = [x for x in os.environ.get("ST_DO", "quiz,summ").split(",") if x]
    T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("ST_MINUTES", "280"))
    only = [x for x in os.environ.get("ST_ONLY", "").split(",") if x]
    todo = []
    for x in q.get("items", []):
        todo.append((x["id"], [d for d in (x.get("do") or do_all) if d in do_all]))
    if only:
        todo = [(b, do_all) for b in only]
    elif os.environ.get("ST_AUTO", "1") == "1":  # كتب مكتبة الدعوة (والمرفوعة للعامة) الأقصر فالأطول
        sl = jload(os.path.join(SD, "_list.json"), {})
        have_q = {x["b"] for x in jload(os.path.join(QD, "index.json"), {"items": []}).get("items", []) if x.get("ai")}
        books = [b for b in cat["books"] if (b.get("col", "dawah") == "dawah" or b.get("upl")) and b.get("type", "book") == "book"
                 and not b.get("hidden") and not b.get("demo") and 20 <= (b.get("n") or 0) <= 500 and not (b.get("unrev") or 0) > 20]
        books.sort(key=lambda b: b.get("n") or 999)
        for b in books:
            need = [d for d in do_all if (d == "quiz" and b["id"] not in have_q) or (d == "summ" and b["id"] not in sl)]
            if need and all(t[0] != b["id"] for t in todo):
                todo.append((b["id"], need))
    lst = jload(os.path.join(SD, "_list.json"), {})
    done = 0
    for bid, dos in todo[: int(os.environ.get("ST_MAX", "12"))]:
        if time.time() > T.DEADLINE[0] or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        b = next((x for x in cat["books"] if x["id"] == bid), {})
        print("كتاب:", bid, b.get("title", ""), dos, flush=True)
        ok = True
        try:
            if "quiz" in dos:
                qs = quiz_book(bid, cat)
                if qs is not None and len(qs) >= 8:
                    save_quiz(bid, qs)
                    c = {k: sum(1 for x in qs if x["lvl"] == k) for k in LEVELS}
                    REPORT.append("✓ اختبار «%s»: سهل %d، متوسط %d، متقدم %d" % (b.get("title", bid), c["easy"], c["mid"], c["hard"]))
                elif qs is None:
                    ok = False
            if "summ" in dos:
                s = summ_book(bid, cat)
                if s:
                    jsave(os.path.join(SD, bid + ".json"), s)
                    lst[bid] = {"t": s["t"], "n": len(s["chs"]), "upd": s["built"]}
                    jsave(os.path.join(SD, "_list.json"), lst)
                    REPORT.append("✓ اختصار «%s»: %d مقطعًا" % (b.get("title", bid), len(s["chs"])))
                else:
                    ok = False
        except Exception as e:
            print("  خطأ:", str(e)[:200], flush=True); ok = False
        if ok:
            q["items"] = [x for x in q.get("items", []) if x["id"] != bid]
            jsave(qp, q)
        done += 1
        commit("اختبارات واختصارات محرَّرة: %s" % b.get("title", bid))
    open(os.path.join(ROOT, ".st-report.txt"), "w", encoding="utf-8").write(("📝 <b>الاختبارات والاختصارات</b>\n" + "\n".join(REPORT)) if REPORT else "")
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
