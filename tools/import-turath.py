#!/usr/bin/env python3
"""استيراد كتب التراث من مشروع OpenITI (نصوص المكتبة الشاملة بترقيم الطبعة الورقية).

يقرأ tools/turath-list.json، ويبحث عن كل كتاب في مستودعات OpenITI على GitHub، ويختار أكمل نسخة
(ويفضّل المأخوذة من الشاملة)، ثم يحوّلها إلى صيغة المكتبة:
  - صفحات مطابقة لصفحات الطبعة الورقية مع تسميتها (ج1 ص5) لربطها لاحقًا بالنسخ المصورة لنفس الطبعة.
  - الفهرس من عناوين الأبواب.
  - الأسطر المكسورة تُدمج في فقرات متصلة.
  - الكتب الكبيرة متعددة المجلدات تُقسَّم مجلدات (vols/<id>-vNN.json) تُعرض في المكتبة كتابًا واحدًا.
يعمل على GitHub Actions (يحتاج اتصالًا بالإنترنت)، ويكتب تقريره في tools/turath-report.md

الاستخدام:  python3 tools/import-turath.py            (كل الكتب غير المستوردة)
            ONLY=fathbari,tabari python3 tools/import-turath.py
            PARSE_FILE=sample.mARkdown python3 tools/import-turath.py   (اختبار التحليل محليًا)
"""
import json, os, re, sys, math, time, datetime, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
VOLS = os.path.join(ROOT, "vols")
API = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN", "")
SPLIT_BYTES = int(os.environ.get("SPLIT_MB", "3")) * 1024 * 1024
report = []


def log(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    report.append(s)


def get(url, raw=False, tries=4):
    h = {"User-Agent": "sdsl-library-importer"}
    if TOKEN and url.startswith(API):
        h["Authorization"] = "Bearer " + TOKEN
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=120) as r:
                b = r.read()
                return b.decode("utf-8") if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if t == tries - 1:
                raise
        except Exception:
            if t == tries - 1:
                raise
        time.sleep(3 * (t + 1))


def repo_for(died):
    return "%04dAH" % (int(math.ceil(died / 25.0)) * 25)


def keyn(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def alts(s):
    return [keyn(x) for x in s.split("|") if x.strip()]


_dir_cache = {}


def listdir(repo, path):
    k = repo + "/" + path
    if k not in _dir_cache:
        _dir_cache[k] = get("%s/repos/OpenITI/%s/contents/%s" % (API, repo, path)) or []
    return _dir_cache[k]


def find(item):
    repo = repo_for(item["died"])
    authors = [d for d in listdir(repo, "data") if d.get("type") == "dir" and d["name"].startswith("%04d" % item["died"])]
    akeys = alts(item["author"])
    cand = [d["name"] for d in authors if any(k in keyn(d["name"]) for k in akeys)]
    if not cand:
        log("  ✗ لم يُعثر على المؤلف. مؤلفو سنة %d في %s: %s" % (item["died"], repo, ", ".join(d["name"] for d in authors[:40]) or "لا أحد"))
        return None
    bkeys = alts(item["book"])
    for a in cand:
        books = [d["name"] for d in listdir(repo, "data/" + a) if d.get("type") == "dir"]
        for bk in bkeys:  # البدائل بالترتيب: الأول أولى
            hit = [b for b in books if bk in keyn(b.split(".", 1)[-1])]
            if hit:
                hit.sort(key=len)
                return repo, a, hit[0]
    log("  ✗ لم يُعثر على الكتاب عند %s. كتبه: %s" % ("، ".join(cand), ", ".join(
        b["name"].split(".", 1)[-1] for a in cand for b in listdir(repo, "data/" + a) if b.get("type") == "dir")))
    return None


def pick_version(repo, a, b):
    files = [f for f in listdir(repo, "data/%s/%s" % (a, b)) if f.get("type") == "file" and not f["name"].endswith((".yml", ".md"))]
    if not files:
        return None
    rank = lambda f: (f["name"].endswith(".mARkdown") * 4 + f["name"].endswith(".completed") * 3 + f["name"].endswith(".inProgress") * 1,
                      "Shamela" in f["name"], f.get("size", 0))
    files.sort(key=rank, reverse=True)
    return files[0]


# ---------------- تحليل صيغة OpenITI mARkdown ----------------
PAGE = re.compile(r"PageV(\d+)P(\d+)")


def parse(text):
    meta = {}
    if "#META#Header#End#" in text:
        head, body = text.split("#META#Header#End#", 1)
        for line in head.splitlines():
            m = re.match(r"#META#\s*(.+?)\s*(?:::|:)\s*(.*)$", line)
            if m:
                meta[m.group(1).strip()] = m.group(2).strip()
    else:
        body = text
    parts = PAGE.split(body)
    pages = []  # [(vol, page, text)]
    # parts: [text0, v1, p1, text1, v2, p2, text2...]; العلامة تأتي في نهاية الصفحة
    for i in range(1, len(parts), 3):
        pages.append([int(parts[i]), int(parts[i + 1]), parts[i - 1]])
    tail = parts[-1] if len(parts) % 3 == 1 else ""
    if pages and tail.strip():
        pages[-1][2] += tail
    if not pages:
        pages = [[1, 1, body]]
    return meta, [(v, p, clean(t)) for v, p, t in pages]


def clean(t):
    t = re.sub(r"\bms\d+\b|Milestone\d+|@[A-Z0-9_]+@?\S*", "", t)
    lines, out = t.split("\n"), []
    for ln in lines:
        s = ln.rstrip()
        if not s.strip():
            continue
        if s.startswith("~~"):  # سطر مكمِّل للفقرة السابقة
            s = s[2:].strip()
            if out:
                out[-1] += " " + s
            else:
                out.append(s)
            continue
        m = re.match(r"^(?:#\s+)?###\s*([|$]+)\s*(.*)$", s)
        if m:
            out.append("# " + m.group(2).strip())
            continue
        s = re.sub(r"^#\s+", "", s)
        out.append(s.strip())
    t = "\n".join(out)
    t = t.replace("%~%", " ... ").replace("#~:", "")
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def heads(text):
    return [l[2:].strip() for l in text.split("\n") if l.startswith("# ") and 2 < len(l) < 140]


def source_of(meta):
    def g(*ks):
        for k in ks:
            for mk, v in meta.items():
                if k in mk and v and v != "NODATA":
                    return v
        return ""
    ed, pub, edn = g("المحقق"), g("الناشر"), g("الطبعة")
    return " — ".join(x for x in [("تحقيق: " + ed) if ed else "", pub, edn] if x)


def build(item, meta, pages, vname, cat):
    vols = sorted(set(v for v, _, _ in pages))
    multi = len(vols) > 1
    label = lambda v, p: ("ج%d ص%d" % (v, p)) if multi else ("ص %d" % p)
    src = source_of(meta)
    sham = re.search(r"Shamela(\d+)", vname)
    lic = "نص مفتوح من مشروع OpenITI (رخصة CC BY-NC-SA 4.0)" + ("، أصله من المكتبة الشاملة Shamela_%s" % sham.group(1) if sham else "")
    aid = author_id(item, cat)
    today = datetime.date.today().isoformat()
    total = sum(len(t.encode("utf-8")) for _, _, t in pages)
    entries = []
    if multi and total > SPLIT_BYTES:
        os.makedirs(VOLS, exist_ok=True)
        for v in vols:
            vp = [(p, t) for vv, p, t in pages if vv == v]
            bid = "%s-v%02d" % (item["id"], v)
            toc = [{"t": h, "p": i + 1} for i, (p, t) in enumerate(vp) for h in heads(t)][:600]
            sh = {"id": bid, "pages": [t for _, t in vp], "toc": toc, "pl": [label(v, p) for p, _ in vp]}
            s = json.dumps(sh, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(VOLS, bid + ".json"), "w", encoding="utf-8").write(s)
            entries.append({"id": bid, "title": "%s — ج %d" % (item["title"], v), "set": item["id"], "setTitle": item["title"], "vol": v, "vols": len(vols),
                            "vf": 1, "big": 1, "authorId": aid, "topicId": item.get("topic", "t3"), "col": "turath", "type": "book",
                            "n": len(vp), "size": len(s.encode("utf-8")), "source": src, "license": lic, "added": today, "openiti": vname})
    else:
        toc = [{"t": h, "p": i + 1} for i, (v, p, t) in enumerate(pages) for h in heads(t)][:1500]
        sh = {"id": item["id"], "pages": [t for _, _, t in pages], "toc": toc, "pl": [label(v, p) for v, p, _ in pages]}
        s = json.dumps(sh, ensure_ascii=False, separators=(",", ":"))
        open(os.path.join(DATA, "books", item["id"] + ".json"), "w", encoding="utf-8").write(s)
        entries.append({"id": item["id"], "title": item["title"], "authorId": aid, "topicId": item.get("topic", "t3"), "col": "turath", "type": "book",
                        "n": len(pages), "size": len(s.encode("utf-8")), "source": src, "license": lic, "added": today, "openiti": vname})
    return entries, total


def author_id(item, cat):
    name = item["authorName"]
    norm = lambda s: re.sub(r"^(الإمام|الشيخ|شيخ الإسلام|الحافظ)\s+", "", s).replace("أ", "ا").replace("إ", "ا").strip()
    for a in cat["authors"]:
        if a.get("col") == "turath" and (norm(a["name"]) == norm(name) or (a.get("died") == item["died"] and norm(name) in norm(a["name"]))):
            return a["id"]
    aid = "ta_" + keyn(item["author"].split("|")[0])
    if not any(a["id"] == aid for a in cat["authors"]):
        cat["authors"].append({"id": aid, "name": name, "col": "turath", "died": item["died"], "bio": ""})
    return aid


def main():
    if os.environ.get("PARSE_FILE"):  # اختبار محلي للتحليل
        meta, pages = parse(open(os.environ["PARSE_FILE"], encoding="utf-8").read())
        print(json.dumps({"meta": meta, "source": source_of(meta), "pages": pages[:6]}, ensure_ascii=False, indent=1))
        return
    lst = json.load(open(os.path.join(ROOT, "tools", "turath-list.json"), encoding="utf-8"))["books"]
    only = set(x for x in os.environ.get("ONLY", "").split(",") if x)
    cat_path = os.path.join(DATA, "catalog.json")
    cat = json.load(open(cat_path, encoding="utf-8"))
    have = set(b["id"] for b in cat["books"]) | set(b.get("set") for b in cat["books"] if b.get("set"))
    log("# تقرير استيراد كتب التراث — " + datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))
    added = 0
    for item in lst:
        if only and item["id"] not in only:
            continue
        if item["id"] in have and not os.environ.get("REPLACE"):
            continue
        log("\n## " + item["title"])
        try:
            f = find(item)
            if not f:
                continue
            repo, a, b = f
            ver = pick_version(repo, a, b)
            if not ver:
                log("  ✗ لا توجد نسخة نصية في " + b)
                continue
            log("  النسخة: %s (%d ك.ب)" % (ver["name"], ver.get("size", 0) // 1024))
            text = get(ver["download_url"], raw=True)
            meta, pages = parse(text)
            entries, total = build(item, meta, pages, ver["name"], cat)
            ids = set(e["id"] for e in entries)
            cat["books"] = [x for x in cat["books"] if x["id"] not in ids and x.get("set") != item["id"]] + entries
            log("  ✓ أُضيف: %d صفحة، %d مجلد، %.1f م.ب — %s" % (len(pages), len(entries), total / 1048576, source_of(meta) or "بلا بيانات طبعة"))
            added += 1
            cat["version"] = int(time.time() * 1000)
            json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        except Exception as e:
            log("  ✗ خطأ: %r" % e)
    log("\nالمضاف في هذا التشغيل: %d" % added)
    open(os.path.join(ROOT, "tools", "turath-report.md"), "w", encoding="utf-8").write("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
