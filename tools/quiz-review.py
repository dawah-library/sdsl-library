#!/usr/bin/env python3
"""إعادة مراجعة الاختبارات المكتملة (طلب المدير ٢٠ نوفمبر ٢٠٢٦).

لكل سؤال في data/quizzes/<كتاب>.json مع نص صفحته من الكتاب:
  - تدقيق السؤال والبدائل والجواب والتعليل: صحيح بحسب النص، متسق المعنى (السؤال والجواب والتعليل يقول كلها شيئًا واحدًا)، وبلا جوابين.
  - تصحيح ما يُصلح، وحذف ما لا يُصلح (يُعلَّم ok=false ولا يُحذف من الملف، فيبقى للإدارة).
  - تلميح h للسهل والمتوسط: يعين على الجواب ولا يذكره.
يُعلَّم المراجَع rv=2، فتُستأنف المراجعة من حيث توقفت إن نفدت الحصة أو المهلة. لا يُنشئ أسئلة جديدة.
المتغيرات: QR_ONLY (كتب بعينها)، QR_MINUTES، QR_COMMIT=1.
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("quiz_review")  # يدوي فقط
import json, os, re, sys, time, subprocess, glob, random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QD = os.path.join(ROOT, "data", "quizzes")
LEVELS = ("easy", "mid", "hard")
REPORT = []

PROMPT = """أنت مراجع علمي دقيق لأسئلة اختبار على كتاب «{title}». لكل سؤال أدناه: نوعه ومستواه ونصه وبدائله وجوابه وتعليله، ونص صفحته من الكتاب.
راجع كل سؤال مراجعة تامة:
١) الصحة: الجواب صحيح بحسب نص الكتاب ومراد المؤلف، وليس بين البدائل جواب صحيح آخر.
٢) الاتساق: السؤال والجواب والتعليل متفقة في المعنى لا يناقض بعضها بعضًا؛ والتعليل يشرح الجواب نفسه.
٣) الوضوح: السؤال تام السياق مفهوم بنفسه؛ والبدائل عبارات تامة المعنى صحيحة اللغة من جنس الجواب؛ وفي «صح أم خطأ» العبارة الخاطئة تحريف ظاهر للمعنى لا للفظ آية أو حديث؛ وفي «أكمل» المحذوف بلفظ الكتاب.
٤) التلميح h (للسهل والمتوسط فقط): جملة قصيرة تعين الطالب على الوصول إلى الجواب (تذكّر بالباب أو القاعدة أو المعنى أو العلة أو تستبعد خطأً شائعًا)، ولا تذكر الجواب ولا لفظه ولا تجعله ظاهرًا.
أخرج JSON: {{"r": [ {{"i": رقم_السؤال, "ok": true أو false, "fix": {{"q": "...", "opts": [...], "a": "...", "e": "..."}}, "h": "التلميح"}} ]}}
- ok=true إن كان السؤال سليمًا كما هو (ومعه h للسهل والمتوسط).
- ok=false مع fix كامل (السؤال والبدائل والجواب والتعليل بعد التصحيح، و a مطابق لأحد البدائل حرفيًا في الاختيار من متعدد) إن أمكن إصلاحه.
- ok=false بلا fix إن كان لا يُصلح (خارج النص، أو مقتطع، أو له أكثر من جواب لا يُرفع، أو تافه).
- لا تُدخل معلومة من خارج الكتاب.

{items}"""

TY = {"mcq": "اختيار من متعدد", "tf": "صح أم خطأ", "cloze": "أكمل"}


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def commit(msg):
    if os.environ.get("QR_COMMIT") != "1":
        return
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", "data/quizzes")
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


def valid(q):
    t, a = q.get("type"), str(q.get("a") or "").strip()
    if q.get("lvl") not in LEVELS or not q.get("q") or not a or len(q["q"]) < 15:
        return False
    if t == "mcq":
        o = [str(x).strip() for x in (q.get("opts") or []) if str(x).strip()]
        if len(o) != 4 or len(set(o)) != 4 or a not in o:
            return False
        random.shuffle(o)  # لا تستقر الإجابة الصحيحة في الموضع الأول
        q["opts"] = o
    elif t == "tf":
        if a not in ("صح", "خطأ"):
            return False
    elif t == "cloze":
        if "……" not in q["q"] and "..." not in q["q"]:
            return False
    else:
        return False
    return True


def leaks(h, a):
    """التلميح لا يذكر الجواب: يُرد إن تضمّن لفظ الجواب القصير أو أغلب كلماته."""
    hn, an = " ".join(T.norm(h)), T.norm(a)
    if not an:
        return False
    if len(an) <= 3 and " ".join(an) in hn:
        return True
    return sum(1 for w in an if len(w) > 2 and w in hn.split()) >= max(2, int(len(an) * 0.7))


def review_book(bid, cat, deadline):
    p = os.path.join(QD, bid + ".json")
    d = jload(p, None)
    if not d or not d.get("qs"):
        return 0
    todo = [i for i, q in enumerate(d["qs"]) if q.get("rv") != 2 and q.get("ok") is not False]
    if not todo:
        return 0
    src = T.source(bid, cat)
    if not src:
        print("  بلا نص:", bid, flush=True); return 0
    title, _au, pages, _sh = src
    done = 0
    for k in range(0, len(todo), 12):
        if time.time() > deadline or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        part = todo[k:k + 12]
        items = "\n\n".join("سؤال %d (%s، %s): %s%s\nالجواب: %s\nالتعليل: %s\nنص الصفحة %d: %s" % (
            j, TY.get(q["type"], q["type"]), {"easy": "سهل", "mid": "متوسط", "hard": "متقدم"}[q["lvl"]], q["q"],
            ("\nالبدائل: " + " | ".join(q.get("opts") or [])) if q["type"] == "mcq" else "", q["a"], q.get("e", ""), q["p"],
            (body(pages[q["p"] - 1]) if 0 < q["p"] <= len(pages) else "")[:1800] + (("\n" + body(pages[q["p"]])[:600]) if q["p"] < len(pages) else ""))
            for j, q in ((j, d["qs"][i]) for j, i in enumerate(part)))
        rv = T.gemini(PROMPT.format(title=title, items=items))
        if not rv:
            break  # حصة أو خطأ: يُستأنف لاحقًا
        verdict = {x["i"]: x for x in rv.get("r", []) if isinstance(x, dict) and isinstance(x.get("i"), int)}
        for j, i in enumerate(part):
            q, v = d["qs"][i], verdict.get(j)
            if v is None:
                continue
            if not v.get("ok"):
                fx = v.get("fix") if isinstance(v.get("fix"), dict) else None
                n = dict(q)
                if fx:
                    n.update({kk: vv for kk, vv in fx.items() if kk in ("q", "opts", "a", "e") and vv})
                if fx and valid(n):
                    n["fixd"] = 1; q = n
                else:
                    q["ok"] = False; q["drop"] = "مراجعة ٢٠ نوفمبر"  # لا يُعرض، ويبقى في الملف للإدارة
            h = str(v.get("h") or "").strip()
            if q["lvl"] in ("easy", "mid") and h and not leaks(h, q["a"]):
                q["h"] = h[:220]
            q["rv"] = 2
            d["qs"][i] = q; done += 1
        jsave(p, d)
        print("  %s: روجع %d" % (bid, done), flush=True)
    return done


def reindex():
    ip = os.path.join(QD, "index.json")
    ix = jload(ip, {"items": []})
    for x in ix.get("items", []):
        d = jload(os.path.join(QD, x["b"] + ".json"), {})
        ok = [q for q in d.get("qs", []) if q.get("ok")]
        x["n"] = len(ok)
        x["lv"] = {l: sum(1 for q in ok if q.get("lvl") == l) for l in LEVELS}
    jsave(ip, ix)


def main():
    cat = jload(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    deadline = time.time() + 60 * float(os.environ.get("QR_MINUTES", "200"))
    only = [x for x in os.environ.get("QR_ONLY", "").split(",") if x]
    files = [os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(QD, "*.json"))) if not f.endswith("index.json")]
    left = 0
    for bid in (only or files):
        n = review_book(bid, cat, deadline)
        d = jload(os.path.join(QD, bid + ".json"), {})
        qs = d.get("qs", [])
        rem = sum(1 for q in qs if q.get("rv") != 2 and q.get("ok") is not False)
        left += rem
        if n:
            fixed = sum(1 for q in qs if q.get("fixd")); dropped = sum(1 for q in qs if q.get("drop"))
            hints = sum(1 for q in qs if q.get("h"))
            b = next((x for x in cat["books"] if x["id"] == bid), {})
            REPORT.append("مراجعة اختبار «%s»: روجع %d، صُحح %d، استُبعد %d، تلميحات %d%s" % (b.get("title", bid), n, fixed, dropped, hints, ("، بقي %d" % rem) if rem else ""))
            reindex()
            commit("مراجعة الاختبارات: «%s»" % b.get("title", bid))
    reindex()
    REPORT.append("اكتملت مراجعة الاختبارات كلها." if not left else "بقي %d سؤالًا للمراجعة (تُستأنف في الجولة القادمة)." % left)
    print("\n".join(REPORT))
    open(os.path.join(ROOT, ".qr-report.txt"), "w", encoding="utf-8").write("\n".join(REPORT))


if __name__ == "__main__":
    main()
