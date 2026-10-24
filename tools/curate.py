#!/usr/bin/env python3
"""انتقاء «منشورات المشايخ» وتدقيق «سؤال وجواب» تدقيقًا علميًا دوريًا (Gemini، بالحصة المجانية).

1) الفوائد (data/fawaid.json): من كتب الدعوة المكتمل تدقيقها، يختار النموذج مقاطع تامة المعنى تصلح منشورًا مستقلًا
   (فائدة علمية، شرح عبارة، تعليق، تنبيه، قاعدة)، ويعيد بداية المقطع ونهايته بلفظهما؛ فيُقتطع النص من الكتاب نفسه
   بحروفه (لا صياغة للنموذج)، ويُمد إلى حدود الجمل، ثم تراجعه جولة ثانية: هل هو تام المعنى مفيد مستقل؟ ويُجدول نشره يوميًا.
   وتُحذف تلقائيًا الفائدة التي تغيّر نص صفحتها بعد التصحيح (البصمة h) حتى يعاد انتقاؤها.
2) مراجعة سؤال وجواب (data/qa/_review.json): يحكم النموذج هل الجواب المنقول يجيب السؤال جوابًا تامًا؛
   فيعلَّم ok أو flag (للمشرف) — ولا يُخفى شيء آليًا؛ الإخفاء والتصحيح للمشرف.
المتغيرات: CUR_MODE=fawaid|qa|all، CUR_MAX (حد الطلبات)، CUR_PER_DAY (فوائد تُنشر يوميًا).
"""
import datetime, hashlib, json, os, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 10)] if k.strip()]
MODEL = os.environ.get("CUR_MODEL", "gemini-flash-latest")
BUDGET = [int(os.environ.get("CUR_MAX", "80"))]
EXH = set()
DIAC = re.compile(r"[\u064B-\u0652\u0670\u0640]")
REPORT = []


def gemini(prompt):
    if BUDGET[0] <= 0:
        return None
    for k in range(len(KEYS)):
        if k in EXH:
            continue
        for attempt in range(4):
            try:
                body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json", "maxOutputTokens": 16000}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % MODEL, data=body, headers={"content-type": "application/json", "x-goog-api-key": KEYS[k]})
                with urllib.request.urlopen(req, timeout=240) as r:
                    j = json.loads(r.read())
                BUDGET[0] -= 1
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore")
                if e.code == 429 and re.search(r"day|PerDay", msg, re.I):
                    EXH.add(k); break
                time.sleep(15 * (attempt + 1))
            except Exception:
                time.sleep(5 * (attempt + 1))
    return None


def nmap(s):
    """نص مطبّع (بلا تشكيل، والألفات موحدة) مع خريطة مواضعه إلى النص الأصلي."""
    out, idx = [], []
    for i, c in enumerate(s):
        if DIAC.match(c):
            continue
        c = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"}.get(c, c)
        if not re.match(r"[\u0621-\u064A0-9]", c):
            c = " "
        if c == " " and out and out[-1] == " ":
            continue
        out.append(c); idx.append(i)
    return "".join(out), idx


def locate(text, start, end):
    n, idx = nmap(text)
    s1 = nmap(start)[0].strip(); e1 = nmap(end)[0].strip()
    if len(s1) < 8 or len(e1) < 8:
        return None
    a = n.find(s1)
    if a < 0:
        return None
    b = n.find(e1, a)
    if b < 0:
        return None
    ia, ib = idx[a], idx[min(len(idx) - 1, b + len(e1) - 1)] + 1
    # التوسيع إلى حدود الجمل
    pre = text.rfind("\n", 0, ia)
    if ia - pre < 60 and pre >= 0:
        ia = pre + 1
    m = re.search(r"[.؟!»]", text[ib:ib + 220])
    if m:
        ib = ib + m.end()
    return text[ia:ib].strip()


def fp(t):
    return hashlib.md5(DIAC.sub("", t or "").encode()).hexdigest()[:10]


PICK = """أنت محرر علمي في مكتبة الدعوة السلفية. من النص الآتي (من كتاب «{title}» لـ{author}، والصفحات معلّمة بـ[ص N])
اختر ما يصلح «منشورًا» مستقلًا يفيد القارئ وحده دون سياقه: فائدة علمية تامة، أو شرح عبارة أو مصطلح، أو تعليق على أمر، أو تنبيه، أو قاعدة.
الشروط: تام المعنى من أوله إلى آخره، لا يبدأ بضمير يعود على ما قبله ولا بأداة ربط معلّقة، ولا ينتهي في منتصف فكرة؛ بين ٣٠ و٢٢٠ كلمة؛ لا تختر فهارس ولا مقدمات شكلية ولا عناوين.
أعد JSON: {{"items": [ {{"type": "فائدة|شرح|تعليق|تنبيه|قاعدة", "page": رقم_الصفحة, "start": "أول ٨ كلمات من المقطع بلفظها حرفيًا", "end": "آخر ٨ كلمات من المقطع بلفظها حرفيًا"}} ]}}
اختر من ٠ إلى {n} مقاطع فقط، والأجود أولًا. إن لم يوجد ما يستحق فأعد قائمة فارغة.

{text}"""

CHECK = """قيّم كل مقطع منقول من كتاب: هل هو تام المعنى مستقل يُفهم وحده، مفيد علميًا، لا يحتاج سياقًا قبله ولا بعده؟
أعد JSON: {{"r": [ {{"i": رقمه, "ok": true أو false}} ]}}

{items}"""


def fawaid(cat):
    p = os.path.join(ROOT, "data", "fawaid.json")
    F = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"items": [], "done": {}}
    books = [b for b in cat["books"] if b.get("col") == "dawah" and b.get("type", "book") == "book" and not b.get("demo") and not (b.get("ocr") and (b.get("unrev") or b.get("lite")))]
    au = {a["id"]: a["name"] for a in cat["authors"]}
    shards = {}
    def shard(bid):
        if bid not in shards:
            pth = os.path.join(ROOT, "data", "books", bid + ".json")
            shards[bid] = json.load(open(pth, encoding="utf-8")) if os.path.exists(pth) else None
        return shards[bid]
    # إسقاط ما تغيّر نصه
    keep = []
    for it in F["items"]:
        sh = shard(it["b"])
        if sh and 0 < it["p"] <= len(sh["pages"]) and DIAC.sub("", it["text"])[:40] in DIAC.sub("", (sh["pages"][it["p"] - 1] or "") + (sh["pages"][it["p"]] if it["p"] < len(sh["pages"]) else "")):
            keep.append(it)
    dropped = len(F["items"]) - len(keep)
    F["items"] = keep
    new = []
    for b in books:
        sh = shard(b["id"])
        if not sh:
            continue
        pages = sh["pages"]
        done = F["done"].get(b["id"], 0)
        while done < len(pages) and BUDGET[0] > 2:
            a, z = done, min(len(pages), done + 8)
            text = "\n".join("[ص %d]\n%s" % (i + 1, re.split(r"^\s*_{4,}\s*$", pages[i] or "", flags=re.M)[0]) for i in range(a, z))
            done = z
            if len(re.sub(r"\s", "", text)) < 600:
                continue
            r = gemini(PICK.format(title=b.get("setTitle") or b["title"], author=au.get(b.get("authorId"), ""), n=3, text=text[:40000])) or {}
            for x in r.get("items", [])[:3]:
                pg = int(x.get("page") or a + 1)
                src = "\n".join(pages[max(0, pg - 1):min(len(pages), pg + 1)])
                t = locate(src, x.get("start", ""), x.get("end", ""))
                if t and 150 <= len(t) <= 1600:
                    new.append({"id": fp(b["id"] + t), "b": b["id"], "p": pg, "t": x.get("type", "فائدة"), "text": t})
        F["done"][b["id"]] = done
        if BUDGET[0] <= 2:
            break
    # جولة التدقيق الثانية
    ok = []
    for k in range(0, len(new), 12):
        part = new[k:k + 12]
        rv = gemini(CHECK.format(items="\n\n".join("مقطع %d:\n%s" % (i, x["text"]) for i, x in enumerate(part))))
        good = {r.get("i") for r in (rv or {}).get("r", []) if r.get("ok")} if rv else set()
        ok += [x for i, x in enumerate(part) if i in good]
    have = {x["id"] for x in F["items"]}
    ok = [x for x in ok if x["id"] not in have]
    # جدولة النشر: عدد ثابت يوميًا بعد آخر تاريخ مجدول
    per = int(os.environ.get("CUR_PER_DAY", "4"))
    last = max([x.get("date", "") for x in F["items"]] + [datetime.date.today().isoformat()])
    d = datetime.date.fromisoformat(last)
    n_on = sum(1 for x in F["items"] if x.get("date") == last)
    for x in ok:
        if n_on >= per:
            d += datetime.timedelta(days=1); n_on = 0
        x["date"] = d.isoformat(); n_on += 1
        F["items"].append(x)
    json.dump(F, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("منشورات المشايخ: أضيفت %d فائدة مدققة (سُحبت %d تغيّر نصها)، والمجدول حتى %s" % (len(ok), dropped, d.isoformat()))


QA_CHECK = """أنت مدقق علمي. لكل سؤال وجواب منقولين من كتاب: هل الجواب يجيب السؤال جوابًا تامًا مفهومًا؟ وهل السؤال واضح؟
أعد JSON: {{"r": [ {{"i": رقمه, "ok": true أو false, "why": "سبب قصير إن كان false"}} ]}}

{items}"""


def qa_review():
    ip, rp = os.path.join(ROOT, "data", "qa", "_index.json"), os.path.join(ROOT, "data", "qa", "_review.json")
    if not os.path.exists(ip):
        return
    idx = json.load(open(ip, encoding="utf-8"))["items"]
    rev = json.load(open(rp, encoding="utf-8")) if os.path.exists(rp) else {}
    todo = [r for r in idx if r[0] not in rev]
    todo.sort(key=lambda r: 0 if r[2].startswith("p") or not r[2].split("-")[0].isalpha() else 1)
    files, n_ok, n_flag = {}, 0, 0
    for k in range(0, len(todo), 15):
        if BUDGET[0] <= 0:
            break
        part = []
        for r in todo[k:k + 15]:
            if r[2] not in files:
                files[r[2]] = {x["id"]: x for x in json.load(open(os.path.join(ROOT, "data", "qa", r[2] + ".json"), encoding="utf-8"))["items"]}
            it = files[r[2]].get(r[0])
            if it:
                part.append(it)
        rv = gemini(QA_CHECK.format(items="\n\n".join("%d) س: %s\nج: %s" % (i, x["q"], x["a"][:1200]) for i, x in enumerate(part))))
        if not rv:
            break
        for r in rv.get("r", []):
            i = r.get("i")
            if isinstance(i, int) and 0 <= i < len(part):
                if r.get("ok"):
                    rev[part[i]["id"]] = {"s": "ok", "by": "auto", "at": datetime.date.today().isoformat()}; n_ok += 1
                else:
                    rev[part[i]["id"]] = {"s": "flag", "why": (r.get("why") or "")[:160], "by": "auto", "at": datetime.date.today().isoformat()}; n_flag += 1
    json.dump(rev, open(rp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("سؤال وجواب: رُوجع %d (سليم %d، وعُلّم للمشرف %d)" % (n_ok + n_flag, n_ok, n_flag))


def main():
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    mode = os.environ.get("CUR_MODE", "all")
    if mode in ("fawaid", "all"):
        fawaid(cat)
    if mode in ("qa", "all"):
        qa_review()
    if REPORT:
        open(os.path.join(ROOT, ".cur-report.txt"), "w", encoding="utf-8").write("🔎 <b>الانتقاء والتدقيق العلمي</b>\n" + "\n".join(REPORT))
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
