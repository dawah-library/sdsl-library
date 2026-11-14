#!/usr/bin/env python3
"""إعادة استيراد كتب التراث الأساسية من نسخ المكتبة الشاملة المشكولة عبر turath.io، كتابًا بعد كتاب (data/turathio-queue.json).

لكل كتاب: يبحث بين كتب مؤلفه في turath.io عن النسخ التي يطابق اسمها العنوان، ويقيس كثافة التشكيل في عينة من صفحاتها،
ويختار أكثرها تشكيلًا (بشرط ألا تقل عن TIO_MIN_TASH)، ثم يستورده بـ tools/import-turathio.py مع بقاء معرّف الكتاب في المكتبة.
يحفظ بعد كل كتاب، ويتوقف قبل مهلة المهمة ويكتب .tio-incomplete فتعيد المهمة تشغيل نفسها.
"""
import json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QP = os.path.join(ROOT, os.environ.get("TIO_QUEUE", "data/turathio-queue.json"))  # data/adab-queue.json: كتب الأدباء والعلماء المعاصرين
API = "https://api.turath.io"
DEADLINE = time.time() + 60 * float(os.environ.get("TIO_MINUTES", "300"))
MAX_BOOKS = int(os.environ.get("TIO_MAX_BOOKS", "1"))  # مهمة متدرجة غير عاجلة: كتاب واحد في التشغيل
MIN_TASH = float(os.environ.get("TIO_MIN_TASH", "0.15"))
REPORT = []


def get(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "sdsl-library (dawahlibrary.org) open-text importer"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(3 * (t + 1))
    return None


def norm(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or "")
    return re.sub(r"\s+", " ", s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")).strip()


def ratio(t):
    t = re.sub(r"<[^>]+>", "", t or "")
    d, l = len(re.findall(r"[ً-ْ]", t)), len(re.findall(r"[ء-ي]", t))
    return d / l if l > 80 else None


DATA = [None]


def books_of(death):
    if DATA[0] is None:
        DATA[0] = get("https://files.turath.io/data-v3.json") or {}
    ids = []
    for a in (DATA[0].get("authors") or {}).values():
        if a.get("death") == death:
            ids += a.get("books") or []
    return ids


def find(item):
    words = [w for w in norm(item["q"]).split() if len(w) > 2]
    cands = []
    for bid in books_of(item["death"]):
        meta = (get("%s/book?id=%s" % (API, bid)) or {}).get("meta") or {}
        name = norm(meta.get("name"))
        if not all(w in name for w in words):
            continue
        if re.search(r"شرح|حاشيه|تخريج|مختصر|زوائد|اطراف|فهارس|تعليق", name) and not re.search(r"شرح|حاشيه|مختصر", norm(item["q"])):
            continue
        rs = [ratio((get("%s/page?book_id=%s&pg=%d" % (API, bid, pg)) or {}).get("text")) for pg in (20, 90, 300)]
        rs = [r for r in rs if r is not None]
        r = sum(rs) / len(rs) if rs else 0
        cands.append({"b": bid, "name": meta.get("name"), "r": round(r, 3)})
        print("   مرشح %s «%s»: تشكيل %.0f٪" % (bid, meta.get("name"), 100 * r), flush=True)
    cands.sort(key=lambda c: -c["r"])
    return cands


def git_save(msg):
    subprocess.run(["bash", "tools/git-save.sh", msg, "data/books", "vols", "data/catalog.json", os.path.relpath(QP, ROOT), "data/articles"], cwd=ROOT)


# ---------- توسيع عناصر المؤلفين (au): كتب صاحبه في الشاملة، دون السياسية، ومجموعات المقالات أولًا ----------
POL = re.compile(r"سياس|انتخاب|برلمان|دستور|ديمقراط|الثوره|ثوره|حزب|الحكم ب|العلمانيه والدوله|الانقلاب|المظاهرات")
COLL = re.compile(r"مقالات|وحي القلم|النظرات|العبرات|اثار|جمهره|خواطر|من حديث النفس|تحت رايه القران|حديث القمر|اوراق|السحاب الاحمر|رسائل الاحزان|كلمات|صور وخواطر|ذكريات|كناشه|مجالس التذكير|فصول|نظرات|مختارات|ركائز|تاملات")
def topic_of(name):
    n = norm(name)
    for rx, t in ((r"تفسير|القران|ايات", "t2"), (r"عقيده|التوحيد|الايمان|الشرك|السنه والبدعه", "t1"), (r"حديث|الحديث|السنن|صحيح", "t3"), (r"فقه|احكام|الصلاه|الصيام|الزكاه|الحج", "t4"),
                  (r"سيره|الرسول|النبي", "t5"), (r"تاريخ|تراجم|اعلام|رجال|حضاره|الاندلس|قصه", "t18"), (r"نحو|لغه|العربيه|بلاغه|اعجاز|معجم|تحقيق النصوص", "t15"), (r"تربيه|الاسره|المراه|الشباب|الابناء|الاطفال|تزكيه|اخلاق|الرقائق|القلوب", "t8")):
        if re.search(rx, n): return t
    return "t17"
def expand(q, cat):
    have = {norm(b.get("setTitle") or b["title"]) for b in cat["books"]} | {norm(i.get("q", "")) for i in q["items"] if i.get("q")}
    out, cap = [], int(os.environ.get("TIO_PER_AUTHOR", "15"))
    for it in q["items"]:
        out.append(it)
        if not it.get("au") or it.get("expanded") is not None: continue
        if DATA[0] is None: DATA[0] = get("https://files.turath.io/data-v3.json") or {}
        key, d = norm(it["au"]), it.get("death")
        bids = []
        for a in (DATA[0].get("authors") or {}).values():
            nm, ad = norm(a.get("name") or a.get("n") or ""), a.get("death")
            if key in nm and (d is None or not ad or abs(int(ad) - int(d)) <= 1):
                bids += a.get("books") or []
        found = []
        for bid in bids[:80]:
            name = ((get("%s/book?id=%s" % (API, bid)) or {}).get("meta") or {}).get("name") or ""
            if not name or POL.search(norm(name)) or norm(name) in have: continue
            found.append((0 if COLL.search(norm(name)) else 1, name, bid))
        found.sort()
        it["expanded"] = len(found[:cap]); it["found"] = [x[1] for x in found[:cap]]
        REPORT.append("- %s: %d كتابًا في الشاملة%s" % (it["an"], len(found[:cap]), "" if found else " (لم يوجد؛ تُراجع سنة الوفاة أو الاسم)"))
        for c, name, bid in found[:cap]:
            have.add(norm(name))
            out.append({"id": "tio%s" % bid, "q": name, "b": bid, "a": it["a"], "an": it["an"], "tp": topic_of(name), "mintash": 0, "adab": 1, **({"art": 1} if c == 0 else {})})
    q["items"] = out


def main():
    inc = os.path.join(ROOT, ".tio-incomplete")
    if os.path.exists(inc): os.remove(inc)
    q = json.load(open(QP, encoding="utf-8"))
    done = set(q.get("done") or [])
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    if any(i.get("au") and i.get("expanded") is None for i in q["items"]):
        expand(q, cat); json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1); git_save("طابور كتب الأدباء والعلماء: توسيع المؤلفين")
    n_done = 0
    for it in q["items"]:
        if it["id"] in done or it.get("skip") or it.get("au"):
            continue
        if n_done >= MAX_BOOKS:
            break
        if time.time() > DEADLINE - 20 * 60:
            open(os.path.join(ROOT, ".tio-incomplete"), "w").write(it["id"]); break
        if not it.get("b"):
            print("== البحث عن نسخة مشكولة: %s" % it["q"], flush=True)
            c = find(it)
            it["cands"] = c[:5]
            if c and c[0]["r"] >= it.get("mintash", MIN_TASH):  # كتب لا تُطبع مشكولة (كعمدة الحفاظ) تُقبل بلا شرط التشكيل
                it["b"] = c[0]["b"]
            else:
                it["skip"] = "لا نسخة مشكولة كافية"
                REPORT.append("- «%s»: لم توجد نسخة مشكولة (أعلى كثافة %s)" % (it["q"], "%.0f٪" % (100 * c[0]["r"]) if c else "—"))
                json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1); continue
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        ex = next((b for b in cat["books"] if b["id"] == it["id"] or b.get("set") == it["id"]), {})
        env = dict(os.environ, TIO_BOOK=str(it["b"]), TIO_ID=it["id"], TIO_TITLE=ex.get("setTitle") or ex.get("title") or it.get("q0") or it["q"],  # q0: العنوان الكامل إذا اختُصر q للبحث
                   TIO_AUTHOR_ID=ex.get("authorId", "") or it.get("a", ""), TIO_AUTHOR=it.get("an", ""), TIO_TOPIC=ex.get("topicId") or it.get("tp", "t3"),
                   TIO_MINUTES=str(max(5, (DEADLINE - time.time()) / 60 - 15)))
        print("== استيراد «%s» من الشاملة %s" % (it["q"], it["b"]), flush=True)
        r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "import-turathio.py")], env=env, cwd=ROOT)
        if os.path.exists(os.path.join(ROOT, ".tio-incomplete")):
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1); break
        if r.returncode == 0:
            q.setdefault("done", []).append(it["id"]); done.add(it["id"]); n_done += 1
            if it.get("art"):  # مجموعة مقالات: تُقسَّم مقالات في «مقالات المكتبة العامة»
                subprocess.run([sys.executable, os.path.join(ROOT, "tools", "adab-articles.py"), it["id"]], cwd=ROOT)
            rep = os.path.join(ROOT, ".tio-report.txt")
            REPORT.append("- " + (open(rep, encoding="utf-8").read().strip() if os.path.exists(rep) else it["q"]))
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            git_save("تراث: «%s» بنسخة الشاملة المشكولة" % it["q"])
            cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
        else:
            it["skip"] = "تعذر الاستيراد"; REPORT.append("- «%s»: تعذر الاستيراد" % it["q"])
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    git_save("طابور استيراد التراث المشكول")
    if REPORT:
        open(os.path.join(ROOT, ".tio-batch-report.txt"), "w", encoding="utf-8").write("📚 <b>كتب التراث المشكولة</b>\n" + "\n".join(REPORT))
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
