#!/usr/bin/env python3
"""إعادة استيراد كتب التراث الأساسية من نسخ المكتبة الشاملة المشكولة عبر turath.io، كتابًا بعد كتاب (data/turathio-queue.json).

لكل كتاب: يبحث بين كتب مؤلفه في turath.io عن النسخ التي يطابق اسمها العنوان، ويقيس كثافة التشكيل في عينة من صفحاتها،
ويختار أكثرها تشكيلًا (بشرط ألا تقل عن TIO_MIN_TASH)، ثم يستورده بـ tools/import-turathio.py مع بقاء معرّف الكتاب في المكتبة.
يحفظ بعد كل كتاب، ويتوقف قبل مهلة المهمة ويكتب .tio-incomplete فتعيد المهمة تشغيل نفسها.
"""
import json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QP = os.path.join(ROOT, "data", "turathio-queue.json")
API = "https://api.turath.io"
DEADLINE = time.time() + 60 * float(os.environ.get("TIO_MINUTES", "300"))
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
    subprocess.run(["bash", "tools/git-save.sh", msg, "data/books", "vols", "data/catalog.json", "data/turathio-queue.json"], cwd=ROOT)


def main():
    inc = os.path.join(ROOT, ".tio-incomplete")
    if os.path.exists(inc): os.remove(inc)
    q = json.load(open(QP, encoding="utf-8"))
    done = set(q.get("done") or [])
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    for it in q["items"]:
        if it["id"] in done or it.get("skip"):
            continue
        if time.time() > DEADLINE - 20 * 60:
            open(os.path.join(ROOT, ".tio-incomplete"), "w").write(it["id"]); break
        if not it.get("b"):
            print("== البحث عن نسخة مشكولة: %s" % it["q"], flush=True)
            c = find(it)
            it["cands"] = c[:5]
            if c and c[0]["r"] >= MIN_TASH:
                it["b"] = c[0]["b"]
            else:
                it["skip"] = "لا نسخة مشكولة كافية"
                REPORT.append("- «%s»: لم توجد نسخة مشكولة (أعلى كثافة %s)" % (it["q"], "%.0f٪" % (100 * c[0]["r"]) if c else "—"))
                json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1); continue
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        ex = next((b for b in cat["books"] if b["id"] == it["id"] or b.get("set") == it["id"]), {})
        env = dict(os.environ, TIO_BOOK=str(it["b"]), TIO_ID=it["id"], TIO_TITLE=ex.get("setTitle") or ex.get("title") or it["q"],
                   TIO_AUTHOR_ID=ex.get("authorId", ""), TIO_AUTHOR="", TIO_TOPIC=ex.get("topicId", "t3"),
                   TIO_MINUTES=str(max(5, (DEADLINE - time.time()) / 60 - 15)))
        print("== استيراد «%s» من الشاملة %s" % (it["q"], it["b"]), flush=True)
        r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "import-turathio.py")], env=env, cwd=ROOT)
        if os.path.exists(os.path.join(ROOT, ".tio-incomplete")):
            json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, indent=1); break
        if r.returncode == 0:
            q.setdefault("done", []).append(it["id"]); done.add(it["id"])
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
