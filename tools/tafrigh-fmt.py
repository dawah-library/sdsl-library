#!/usr/bin/env python3
"""تجهيز التفريغات: تدقيق لغوي وتنسيق، وإعادة صياغة بأسلوب كتابي (خدمة للقارئ بجانب النص كما أُلقي).

لكل صفحة من التفريغ نسختان محفوظتان في data/tfedit/<كتاب>.json:
  f «منسَّق ومدقَّق»: ألفاظ الشيخ نفسها بعد تصحيح أخطاء التفريغ الإملائية والنحوية الظاهرة، وعلامات الترقيم والفقرات
    والعناوين الفرعية، وحذف الحشو الكلامي والتكرار اللفظي الذي لا معنى له (مثل: يعني، طيب، إيه، التكرار المتتابع).
  r «بأسلوب كتابي»: صياغة فصيحة متصلة للمضمون نفسه، بلا زيادة ولا نقص في المعنى، والآيات والأحاديث بلفظها.
التفريغ المصور (PDF) لا يُجهَّز إلا بعد اكتمال تحويله ومراجعته على الصور (unrev وlite صفر).
الطابور: data/tfedit/_queue.json ثم كل التفريغات (وسم tafrigh) التي لم تُجهَّز، الأقصر فالأطول.
المتغيرات: TF_ONLY، TF_MINUTES، TF_MAX، TF_COMMIT=1.
"""
import json, os, re, sys, time, subprocess, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "tfedit")
REPORT = []

PROMPT = """أنت محرر لغوي متقن لتفريغات الدروس الشرعية. هذه صفحات من تفريغ «{title}» لـ{author}، مقسّمة بعلامات [ص N].
لكل صفحة أخرج نسختين، بصيغة JSON حرفيًا: {{"pages": [ {{"p": رقم_الصفحة, "f": "…", "r": "…"}} ]}}
f — «منسَّق ومدقَّق»: ألفاظ الشيخ نفسها، مع:
  • تصحيح أخطاء التفريغ الإملائية والنحوية الظاهرة والكلمات التي أخطأ المفرّغ في سماعها إن كان صوابها بيّنًا من السياق.
  • علامات الترقيم، وتقسيم الكلام فقرات، وعنوان فرعي قصير يبدأ بـ «# » عند انتقال الكلام إلى مسألة جديدة.
  • حذف الحشو الكلامي (يعني، طيب، إيه، ها، فاهمين) والتكرار اللفظي المتتابع الذي لا يضيف معنى، دون حذف شيء من المضمون.
  • الإبقاء على الآيات والأحاديث بلفظها، وعلى الأسلوب الخطابي للشيخ.
r — «بأسلوب كتابي»: صياغة المضمون نفسه بعربية فصيحة متصلة كأنه مقال مكتوب، بلا زيادة معلومة ولا نقص ولا تغيير لرأي الشيخ أو ترجيحه،
  مع حذف ما لا يناسب الكتابة (النداءات والتكرار والاستطراد الشفهي)، والآيات والأحاديث بلفظها، وبالعناوين الفرعية نفسها.
لا تضف شرحًا ولا تعليقًا من عندك. إن كانت الصفحة فارغة أو غير مفهومة فاجعل f وr فارغتين.

النص:
{text}"""


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def commit(msg):
    if os.environ.get("TF_COMMIT") != "1":
        return
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", "data/tfedit")
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


def do_book(bid, cat, lst):
    src = T.source(bid, cat)
    if not src:
        return "missing"
    title, au, pages, sh = src
    fp = os.path.join(OUT, bid + ".json")
    d = jload(fp, {"id": bid, "pages": {}})
    todo = [i + 1 for i, pg in enumerate(pages) if str(i + 1) not in d["pages"] and len(body(pg).strip()) > 30]
    k = 0
    while k < len(todo):
        if time.time() > T.DEADLINE[0]:
            break
        grp, size = [], 0
        while k < len(todo) and len(grp) < 4 and size < 9000:
            p = todo[k]; grp.append(p); size += len(body(pages[p - 1])); k += 1
        text = "\n".join("[ص %d]\n%s" % (p, body(pages[p - 1])[:6000]) for p in grp)
        r = T.gemini(PROMPT.format(title=title, author=au, text=text))
        if not r:
            if len(T.EXH) >= len(T.KEYS):
                break
            continue
        for x in r.get("pages") or []:
            try:
                p = int(x.get("p"))
            except Exception:
                continue
            if p in grp and (x.get("f") or x.get("r")):
                d["pages"][str(p)] = {"f": str(x.get("f") or "").strip(), "r": str(x.get("r") or "").strip()}
        d.update({"t": title, "a": au, "n": len(pages), "built": str(datetime.date.today()), "model": T.MODEL})
        jsave(fp, d)
        print("  %s: %d/%d صفحة" % (title, len(d["pages"]), len(pages)), flush=True)
    full = len(d["pages"]) >= sum(1 for pg in pages if len(body(pg).strip()) > 30)
    lst[bid] = {"t": title, "n": len(d["pages"]), "of": len(pages), "done": 1 if full else 0, "upd": str(datetime.date.today())}
    jsave(os.path.join(OUT, "_list.json"), lst)
    return full


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = jload(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    qp, lp = os.path.join(OUT, "_queue.json"), os.path.join(OUT, "_list.json")
    q, lst = jload(qp, {"items": []}), jload(lp, {})
    T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("TF_MINUTES", "120"))
    only = [x for x in os.environ.get("TF_ONLY", "").split(",") if x]
    todo = only or [x["id"] if isinstance(x, dict) else x for x in q.get("items", [])]
    if not only:
        tf = [b for b in cat["books"] if "tafrigh" in (b.get("tags") or []) and not b.get("hidden") and not b.get("demo")
              and not (b.get("unrev") or b.get("lite")) and not (lst.get(b["id"]) or {}).get("done")]
        tf.sort(key=lambda b: b.get("n") or 999)
        todo += [b["id"] for b in tf if b["id"] not in todo]
    for bid in todo[: int(os.environ.get("TF_MAX", "8"))]:
        if time.time() > T.DEADLINE[0] or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        b = next((x for x in cat["books"] if x["id"] == bid), {})
        if b.get("unrev") or b.get("lite"):
            print("  لم تكتمل مراجعة تحويله بعد:", bid); continue
        print("تفريغ:", bid, b.get("title", ""), flush=True)
        try:
            r = do_book(bid, cat, lst)
        except Exception as e:
            print("  خطأ:", str(e)[:200], flush=True); r = False
        if r in ("missing", True):
            q["items"] = [x for x in q.get("items", []) if (x["id"] if isinstance(x, dict) else x) != bid]
            jsave(qp, q)
        if r is True:
            REPORT.append("✓ تفريغ «%s»: منسَّق ومدقَّق وبأسلوب كتابي" % b.get("title", bid))
        commit("تجهيز التفريغات: %s" % b.get("title", bid))
    open(os.path.join(ROOT, ".tf-report.txt"), "w", encoding="utf-8").write(("🎙 <b>تجهيز التفريغات</b>\n" + "\n".join(REPORT)) if REPORT else "")
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
