#!/usr/bin/env python3
"""استيراد كتاب من واجهة turath.io المفتوحة (نصوص المكتبة الشاملة) للكتب غير الموجودة في OpenITI، كالموسوعة الفقهية الكويتية.

الاستعمال (في GitHub Actions): TIO_BOOK=11430 TIO_ID=mawsuakuwaitiyya TIO_TITLE="الموسوعة الفقهية الكويتية" \
  TIO_AUTHOR_ID=ta_kuwayt TIO_AUTHOR="وزارة الأوقاف والشؤون الإسلامية بالكويت" TIO_TOPIC=t4 python3 tools/import-turathio.py
يحفظ كل جزء في vols/<id>-vNN.json بتسمية صفحات الطبعة (ج N ص M) وفهرس من العناوين، ويضيف الأجزاء إلى الفهرس العام.
"""
import concurrent.futures as cf, gzip, html, json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.turath.io"
BOOK = os.environ["TIO_BOOK"]
BID = os.environ["TIO_ID"]
CONC = int(os.environ.get("TIO_CONC", "6"))
# الاستئناف: الصفحات المجلوبة تُحفظ في .tio-cache (تحفظه المهمة بين التشغيلات)، ويتوقف الجلب قبل مهلة المهمة
CACHE = os.path.join(ROOT, ".tio-cache", "%s.json.gz" % BOOK)
DEADLINE = time.time() + 60 * float(os.environ.get("TIO_MINUTES", "250"))


def get(url, tries=6):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "sdsl-library (dawahlibrary.org) open-text importer"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(3 * (t + 1))
        except Exception:
            time.sleep(3 * (t + 1))
    return None


def clean(t):
    t = re.sub(r"<span[^>]*data-type=['\"]title['\"][^>]*>(.*?)</span>", lambda m: "\n# " + re.sub(r"<[^>]+>", "", m.group(1)).strip() + "\n", t, flags=re.S)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    t = re.sub(r"^\s*_{5,}\s*$", "____", t, flags=re.M)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def main():
    meta = get("%s/book?id=%s&include=indexes" % (API, BOOK)) or {}
    m = meta.get("meta") or {}
    print("الكتاب:", m.get("name"), flush=True)
    heads = []
    idx = meta.get("indexes") or {}
    for h in (idx.get("headings") or []):
        heads.append((int(h.get("page") or 0), h.get("title") or "", int(h.get("level") or 1)))
    # الصفحات تباعًا حتى النهاية
    pages, pg = {}, 1
    if os.path.exists(CACHE):
        c = json.load(gzip.open(CACHE, "rt", encoding="utf-8"))
        pages = {int(k): v for k, v in c.get("pages", {}).items()}
        pg = int(c.get("next", 1))
        print("  استئناف: %d صفحة محفوظة، من الصفحة %d" % (len(pages), pg), flush=True)

    def save(nxt):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with gzip.open(CACHE, "wt", encoding="utf-8") as f:
            json.dump({"next": nxt, "pages": pages}, f, ensure_ascii=False)

    misses, step = 0, 200
    while misses < 3:
        if time.time() > DEADLINE:
            save(pg)
            open(os.path.join(ROOT, ".tio-incomplete"), "w").write(str(pg))
            print("  توقف قبل المهلة عند الصفحة %d (%d صفحة)؛ يُستأنف في تشغيل جديد" % (pg, len(pages)), flush=True)
            return
        batch = list(range(pg, pg + step))
        with cf.ThreadPoolExecutor(CONC) as ex:
            res = list(ex.map(lambda n: (n, get("%s/page?book_id=%s&pg=%d" % (API, BOOK, n))), batch))
        got = 0
        for n, j in res:
            if j and j.get("text") is not None:
                pages[n] = j
                got += 1
        misses = misses + 1 if got == 0 else 0
        print("  حتى الصفحة %d: %d صفحة" % (pg + step - 1, len(pages)), flush=True)
        pg += step
        if (pg // step) % 5 == 0:
            save(pg)
    save(pg)
    if not pages:
        sys.exit("لم تُجلب أي صفحة")
    order = sorted(pages)
    vols = {}
    for n in order:
        j = pages[n]
        v = str((j.get("meta") or {}).get("vol") or "1")
        vols.setdefault(v, []).append((n, j))
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    aid = os.environ.get("TIO_AUTHOR_ID", "ta_" + BID)
    if not any(a["id"] == aid for a in cat["authors"]):
        cat["authors"].append({"id": aid, "name": os.environ.get("TIO_AUTHOR", ""), "col": "turath", "bio": ""})
    cat["books"] = [b for b in cat["books"] if b.get("set") != BID and b["id"] != BID]
    title = os.environ.get("TIO_TITLE") or m.get("name") or BID
    keys = sorted(vols, key=lambda x: (len(x), x))
    os.makedirs(os.path.join(ROOT, "vols"), exist_ok=True)
    for k, v in enumerate(keys, 1):
        rows = vols[v]
        id_ = "%s-v%02d" % (BID, k)
        pg_text = [clean(j.get("text") or "") for n, j in rows]
        pl = ["ج%s ص%s" % (v, (j.get("meta") or {}).get("page", "")) for n, j in rows]
        pos = {n: i for i, (n, j) in enumerate(rows)}
        toc = [{"t": t, "p": pos[p] + 1, "l": 2 if lv > 1 else 1} for p, t, lv in heads if p in pos and t]
        if not toc:  # العناوين من النص
            for i, t in enumerate(pg_text):
                for h in re.findall(r"^# (.{2,80})$", t, re.M)[:2]:
                    toc.append({"t": h, "p": i + 1, "l": 1})
        sh = {"id": id_, "pages": pg_text, "toc": toc[:2000], "pl": pl}
        s = json.dumps(sh, ensure_ascii=False, separators=(",", ":"))
        open(os.path.join(ROOT, "vols", id_ + ".json"), "w", encoding="utf-8").write(s)
        cat["books"].append({"id": id_, "title": "%s — ج %d" % (title, k), "set": BID, "setTitle": title, "vol": k, "vols": len(keys), "vf": 1, "big": 1,
                             "authorId": aid, "topicId": os.environ.get("TIO_TOPIC", "t4"), "col": "turath", "type": "book", "n": len(pg_text), "size": len(s),
                             "source": "نص المكتبة الشاملة عبر turath.io (الكتاب %s)" % BOOK, "added": time.strftime("%Y-%m-%d")})
        print("  ج %s: %d صفحة" % (v, len(pg_text)), flush=True)
    cat["version"] = int(time.time() * 1000)
    json.dump(cat, open(os.path.join(ROOT, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".tio-report.txt"), "w", encoding="utf-8").write("📚 أضيف إلى قسم التراث: «%s» — %d جزءًا، %d صفحة" % (title, len(keys), len(order)))


if __name__ == "__main__":
    main()
