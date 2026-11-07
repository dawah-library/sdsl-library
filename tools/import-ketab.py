#!/usr/bin/env python3
"""استيراد كتاب من «جامع الكتب الإسلامية» (ketabonline.com) — للكتب المجانية التي لا توجد في تراث/OpenITI (يعمل على خوادم GitHub).

ما كشفه الاستكشاف (tools/books-probe/report2.md و report3.md):
  - بيانات الكتاب: backend.ketabonline.com/api/v2/books/<id> ← العنوان والوصف (بطاقة الطبعة)، والأجزاء parts
    (page_id أول صفحة، وعدد الصفحات، والاسم، وpdf_url)، والفهرس index (title، title_level، page_id، part_name)، وis_free.
  - معرّفات صفحات الجزء: /api/v2/books/<id>/pages?part=<n>
  - نص الصفحة: صفحة القراءة ketabonline.com/ar/books/<id>/read?part=<n>&page=<page_id> وفيها window.__NUXT__
    ← data[0].pageInView.content (HTML: g-title عنوان، g-paragraph فقرة، والحواشي بعد فاصل).
لا يُستورد كتاب غير مجاني (is_free=0) ولا كتاب له is_encrypted. الجلب متمهّل (KT_CONC طلبان معًا افتراضيًا).
يحفظ مثل import-turathio: data/books/<id>.json (أو vols/<id>-vNN.json للكبير) بتسمية الصفحات (ج N ص M)، ويضيفه إلى الفهرس.

الاستعمال: KT_BOOK=3159 KT_ID=ghidhaalbab KT_AUTHOR_ID=ta_saffarini KT_TOPIC=t6 python3 tools/import-ketab.py
            KT_DRY=1 … (تجربة: أول ١٠ صفحات إلى tools/books-probe/ketab-import-sample.md دون تعديل الفهرس)
"""
import concurrent.futures as cf, html, json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://backend.ketabonline.com/api/v2"
BOOK, BID = os.environ["KT_BOOK"], os.environ.get("KT_ID", "kt" + os.environ["KT_BOOK"])
CONC, DRY = int(os.environ.get("KT_CONC", "2")), os.environ.get("KT_DRY") == "1"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 sdsl-library (dawahlibrary.org) importer", "Accept-Language": "ar"}
DEADLINE = time.time() + 60 * float(os.environ.get("KT_MINUTES", "200"))


def get(u, js=True, tries=5):
    for t in range(tries):
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90).read().decode("utf-8", "replace")
            time.sleep(0.4)
            return json.loads(b) if js else b
        except Exception:
            time.sleep(3 * (t + 1))
    return None


def nuxt(page_html):
    """قيمة window.__NUXT__ (دالة تُستدعى بمعاملات) تُقيَّم في Node بمعزل."""
    m = re.search(r"<script>window\.__NUXT__=([\s\S]*?)</script>", page_html or "")
    if not m: return None
    js = "const vm=require('vm');const c={window:{}};vm.runInNewContext('window.__NUXT__='+require('fs').readFileSync(0,'utf8'),c,{timeout:8000});const d=(c.window.__NUXT__.data||[])[0]||{};process.stdout.write(JSON.stringify({p:d.pageInView||null}))"
    r = subprocess.run(["node", "-e", js], input=m.group(1), capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout).get("p")
    except Exception: return None


def to_text(h):
    """HTML الصفحة ← نص المكتبة: العناوين «# »، والفقرات أسطر، والحواشي بعد «____»."""
    h = re.sub(r'<a[^>]*class="g-copy"[\s\S]*?</a>', "", h or "")
    h = re.sub(r'<div[^>]*class="[^"]*g-title[^"]*"[^>]*>([\s\S]*?)</div>', lambda m: "\n# " + re.sub(r"<[^>]+>", "", m.group(1)).strip() + "\n", h)
    h = re.sub(r'<(?:div|p)[^>]*class="[^"]*(?:hamesh|footnote|g-fn|g-margin)[^"]*"[^>]*>', "\n____\n", h, count=1)
    h = re.sub(r"<br\s*/?>|</p>|</div>", "\n", h)
    t = html.unescape(re.sub(r"<[^>]+>", "", h))
    t = re.sub(r"[ \t ]+", " ", t)
    t = re.sub(r"\n\s*\n+", "\n", t)
    return t.strip()


def main():
    b = (get("%s/books/%s" % (API, BOOK)) or {}).get("data") or {}
    if not b: sys.exit("الكتاب غير موجود")
    if not b.get("is_free") or b.get("price"): sys.exit("الكتاب غير مجاني في الموقع؛ لا يُستورد")
    parts = b.get("parts") or []
    if any(p.get("is_encrypted") for p in parts): sys.exit("الكتاب مشفّر؛ لا يُستورد")
    title = re.sub(r"<[^>]+>", "", b.get("title") or BID)
    print("الكتاب:", title, "| الأجزاء:", len(parts), flush=True)
    vols, report = [], []
    for k, p in enumerate(parts, 1):
        ids = (get("%s/books/%s/pages?part=%s" % (API, BOOK, p.get("name") or k)) or {}).get("data") or []
        if DRY: ids = ids[:10]
        def one(pid):
            if time.time() > DEADLINE: return pid, None
            pv = nuxt(get("https://ketabonline.com/ar/books/%s/read?part=%s&page=%s" % (BOOK, p.get("name") or k, pid), js=False))
            return pid, pv
        with cf.ThreadPoolExecutor(CONC) as ex: res = list(ex.map(one, ids))
        rows = [(pid, pv) for pid, pv in res if pv and pv.get("content") is not None]
        if len(rows) < len(ids) and not DRY: sys.exit("انتهى الوقت أو تعذرت صفحات (%d من %d) — يُعاد التشغيل" % (len(rows), len(ids)))
        pages = [to_text(pv["content"]) for pid, pv in rows]
        pl = [("ج%s ص%s" % (p.get("name") or k, pv.get("page") or pv.get("number") or "")) if len(parts) > 1 else ("ص %s" % (pv.get("page") or pv.get("number") or i + 1)) for i, (pid, pv) in enumerate(rows)]
        pos = {pid: i for i, (pid, pv) in enumerate(rows)}
        toc = [{"t": re.sub(r"<[^>]+>", "", x.get("title") or ""), "p": pos[x["page_id"]] + 1, **({"l": 2} if (x.get("title_level") or 1) > 1 else {})} for x in (b.get("index") or []) if x.get("page_id") in pos and str(x.get("part_name") or k) == str(p.get("name") or k)]
        vols.append({"name": p.get("name") or str(k), "pages": pages, "pl": pl, "toc": toc, "pdf": p.get("pdf_url")})
        report.append("ج %s: %d صفحة%s" % (p.get("name") or k, len(pages), "، ومصورة" if p.get("pdf_url") else ""))
        print(report[-1], flush=True)
    info = re.sub(r"\r", "", b.get("description") or "")
    if DRY:
        v = vols[0]
        out = ["# تجربة استيراد من جامع الكتب: %s" % title, "", "```", info, "```", "", "- الأجزاء: " + "، ".join(report), "- أول بيانات صفحة: `%s`" % json.dumps({k: v for k, v in (res[0][1] or {}).items() if k != "content"}, ensure_ascii=False)[:800], ""]
        for i in range(min(4, len(v["pages"]))): out += ["## %s" % v["pl"][i], "```", v["pages"][i][:1500], "```"]
        out += ["", "- الفهرس: " + json.dumps(v["toc"][:10], ensure_ascii=False)]
        open(os.path.join(ROOT, "tools", "books-probe", "ketab-import-sample.md"), "w", encoding="utf-8").write("\n".join(out) + "\n"); print("\n".join(out)[:3000]); return
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    aid = os.environ.get("KT_AUTHOR_ID") or "ta_kt%s" % ((b.get("authors") or [{}])[0].get("id") or BOOK)
    if not any(a["id"] == aid for a in cat["authors"]):
        cat["authors"].append({"id": aid, "name": os.environ.get("KT_AUTHOR") or (b.get("authors") or [{}])[0].get("name", ""), "col": "turath", "bio": ""})
    cat["books"] = [x for x in cat["books"] if x.get("set") != BID and x["id"] != BID]
    base = {"authorId": aid, "topicId": os.environ.get("KT_TOPIC", "t4"), "col": "turath", "type": "book", "added": time.strftime("%Y-%m-%d"),
            "source": "نص جامع الكتب الإسلامية (ketabonline.com، الكتاب %s)" % BOOK, "license": "كتاب مجاني في جامع الكتب الإسلامية (الكتاب %s)" % BOOK,
            "edInfo": {"info": info[:800], "printed": 1 if "موافق للمطبوع" in info else 0}}
    for k, v in enumerate(vols, 1):
        multi = len(vols) > 1
        id_ = "%s-v%02d" % (BID, k) if multi else BID
        s = json.dumps({"id": id_, "pages": v["pages"], "toc": v["toc"][:3000], "pl": v["pl"]}, ensure_ascii=False, separators=(",", ":"))
        d = os.path.join(ROOT, "vols" if multi else "data/books"); os.makedirs(d, exist_ok=True)
        open(os.path.join(d, id_ + ".json"), "w", encoding="utf-8").write(s)
        e = dict(base, id=id_, title=("%s — ج %s" % (title, v["name"])) if multi else title, n=len(v["pages"]), size=len(s.encode()))
        if multi: e.update({"set": BID, "setTitle": title, "vol": k, "vols": len(vols), "vf": 1, "big": 1})
        if v["pdf"]: e["pdfSrc"] = {"ketab": int(BOOK), "url": v["pdf"]}
        cat["books"].append(e)
    cat["version"] = int(time.time() * 1000)
    json.dump(cat, open(os.path.join(ROOT, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".kt-report.txt"), "w", encoding="utf-8").write("📚 أضيف من جامع الكتب: «%s» — %s" % (title, "، ".join(report)))


if __name__ == "__main__":
    main()
