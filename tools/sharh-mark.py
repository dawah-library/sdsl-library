#!/usr/bin/env python3
"""تمييز المتن من الشرح في كتب الشروح والتفريغات الموجودة (طلب المدير ٢٠ نوفمبر ٢٠٢٦).

الكتب الجديدة يميّزها التحويل والتفريغ بأنفسهما (سطر المتن يبدأ بـ «%% »، tools/series.py)؛ وهذه الأداة للكتب المنجزة قبل ذلك:
تُرسل نصوص الصفحات (بلا الحواشي) مرقّمة الأسطر، ويُطلب أرقام الأسطر التي هي من المتن المشروح فقط، فتُسبق بـ «%% »
دون أي تغيير آخر في النص (لا يُعاد كتابة شيء). الطابور: data/sharh-mark/_queue.json {"items": [{"id": "<كتاب>"}]}،
والتقدم في data/sharh-mark/_state.json (آخر صفحة لكل كتاب) فتُستأنف من حيث توقفت.
المتغيرات: SM_ONLY، SM_MINUTES، SM_COMMIT=1.
"""
import json, os, re, sys, time, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402
import series as S  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data", "sharh-mark")
REPORT = []
PROMPT = """هذه صفحات من «{title}»، وهو شرح على «{m}». كل سطر مسبوق برقمه بين معقوفين، والصفحات مفصولة بـ [ص N].
حدد الأسطر التي هي من نص المتن المشروح «{m}» نفسه (القطعة التي يوردها الشارح أو يقرؤها ثم يشرحها، كالحديث بإسناده أو عبارة المصنف)،
لا كلام الشارح، ولا ما يستشهد به الشارح من آيات وأحاديث وأقوال في أثناء شرحه، ولا العناوين.
أخرج JSON فقط: {{"m": {{"<رقم الصفحة>": [أرقام الأسطر]}}}} — وإن لم يكن في الصفحة متن فلا تذكرها."""


def jl(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def js(p, o, compact=False):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))


def commit(msg, paths):
    if os.environ.get("SM_COMMIT") != "1":
        return
    run = lambda *a: subprocess.run(list(a), cwd=ROOT)
    run("git", "add", *paths)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    run("git", "commit", "-qm", msg)
    for _ in range(5):
        run("git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main")
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=ROOT).returncode == 0:
            return
        time.sleep(5)


def split(pg):
    m = re.search(r"^\s*_{4,}\s*$", pg or "", flags=re.M)
    return (pg[:m.start()], pg[m.start():]) if m else (pg or "", "")


def mark_book(bid, cat, st, deadline):
    b = next((x for x in cat["books"] if x["id"] == bid), None)
    mn = S.matn_name(cat, b)
    if not mn:
        REPORT.append("%s: لا كتاب مشروح مسجَّل له (sharh أو matn)، فلا تمييز" % bid); return True
    p = os.path.join(ROOT, "data", "books", bid + ".json")
    sh = jl(p, None)
    if not sh:
        return True
    pages = sh["pages"]; start = int(st.get(bid, 0)); title = b.get("setTitle") or b["title"]; n = 0
    while start < len(pages):
        if time.time() > deadline or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        batch, size = [], 0
        while start + len(batch) < len(pages) and size < 14000 and len(batch) < 10:
            body, _ = split(pages[start + len(batch)]); batch.append(body); size += len(body)
        txt = "\n".join("[ص %d]\n" % (start + k + 1) + "\n".join("[%d] %s" % (i, l) for i, l in enumerate(body.split("\n")) if l.strip())
                        for k, body in enumerate(batch))
        r = T.gemini(PROMPT.format(title=title, m=mn) + "\n\n" + txt)
        if r is None:
            break
        for k in range(len(batch)):
            pi = start + k
            ids = {int(x) for x in ((r.get("m") or {}).get(str(pi + 1)) or []) if str(x).isdigit()}
            if not ids:
                continue
            body, fn = split(pages[pi]); L = body.split("\n")
            for i in ids:
                if i < len(L) and L[i].strip() and not re.match(r"^(#|%% |\|)", L[i]):
                    L[i] = "%% " + re.sub(r"^(@@|<<) ", "", L[i]); n += 1
            pages[pi] = "\n".join(L) + fn
        start += len(batch); st[bid] = start
        js(p, sh, compact=True); js(os.path.join(D, "_state.json"), st)
        print("  %s: ص %d/%d" % (bid, start, len(pages)), flush=True)
        if start % 100 < len(batch):
            commit("تمييز المتن من الشرح: «%s» (%d/%d)" % (title, start, len(pages)), ["data/books/" + bid + ".json", "data/sharh-mark"])
    REPORT.append("تمييز المتن في «%s»: %d سطرًا من المتن، الصفحات %d/%d" % (title, n, start, len(pages)))
    return start >= len(pages)


def main():
    cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    qp, sp = os.path.join(D, "_queue.json"), os.path.join(D, "_state.json")
    q, st = jl(qp, {"items": []}), jl(sp, {})
    deadline = time.time() + 60 * float(os.environ.get("SM_MINUTES", "150"))
    only = [x for x in os.environ.get("SM_ONLY", "").split(",") if x]
    ids = only or [x["id"] for x in q.get("items", [])]
    for bid in ids:
        if mark_book(bid, cat, st, deadline):
            q["items"] = [x for x in q.get("items", []) if x["id"] != bid]
        js(qp, q); js(sp, st)
        commit("تمييز المتن من الشرح: %s" % bid, ["data/books/" + bid + ".json", "data/sharh-mark"])
    open(os.path.join(ROOT, ".sm-report.txt"), "w", encoding="utf-8").write("\n".join(REPORT))
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
