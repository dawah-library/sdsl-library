#!/usr/bin/env python3
"""مجموعات المقالات (وحي القلم، النظرات، جمهرة المقالات، آثار الإبراهيمي…) مقالاتٍ مستقلة في «مقالات المكتبة العامة».

لكل كتاب مستورد (data/books/<id>.json أو مجلداته vols/<id>-vNN.json): كل عنوان رئيس في فهرسه مقالٌ صفحاته من موضعه إلى العنوان التالي.
النص في data/articles/adab-<id>.json، والمقالات في data/articles/index.json بالقسم col=turath (فتظهر في #/articles?c=turath
وفي صفحة الكاتب، ويختار منها الركن الأدبي في المجلة). لا يمس المقالات الموجودة، ويعيد بناء مقالات الكتاب نفسه إن أعيد تشغيله.
الاستعمال: python3 tools/adab-articles.py <معرّف الكتاب> [...]"""
import json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AD = os.path.join(ROOT, "data", "articles")
SKIP = re.compile(r"^(المقدمة|مقدمة|تقديم|الفهرس|فهرس|المحتويات|الإهداء|إهداء|ترجمة المؤلف|كلمة الناشر|مقدمة الناشر|تمهيد|المراجع|المصادر)\b")


def vols_of(bid, cat):
    """مجلدات الكتاب بترتيبها: [(معرّف المجلد، ملفه)]"""
    vs = sorted([b for b in cat["books"] if b.get("set") == bid], key=lambda b: b.get("vol") or 0)
    if vs:
        return [(b["id"], os.path.join(ROOT, "vols", b["id"] + ".json")) for b in vs], vs[0]
    b = next((x for x in cat["books"] if x["id"] == bid), None)
    return ([(bid, os.path.join(ROOT, "data", "books", bid + ".json"))] if b else []), b


def main(bid):
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    vols, meta = vols_of(bid, cat)
    if not vols:
        print("لا كتاب:", bid); return 0
    title = meta.get("setTitle") or meta["title"]
    texts, items, n = {}, [], 0
    for vid, path in vols:
        if not os.path.exists(path):
            continue
        sh = json.load(open(path, encoding="utf-8"))
        pages, toc = sh.get("pages") or [], [t for t in (sh.get("toc") or []) if t.get("p") and (t.get("l") or 1) == 1]
        if len(toc) < 3:  # بلا فهرس كافٍ: العناوين من الدرجة الثانية
            toc = [t for t in (sh.get("toc") or []) if t.get("p")]
        for i, t in enumerate(toc):
            a, z = t["p"], (toc[i + 1]["p"] - 1 if i + 1 < len(toc) else len(pages))
            name = re.sub(r"\s+", " ", str(t.get("t") or "")).strip(" *#-")
            if z < a or not name or SKIP.match(name) or z - a > 40:
                continue
            body = [p for p in pages[a - 1:z] if isinstance(p, str)]
            if sum(len(p) for p in body) < 600:
                continue
            n += 1
            aid = "ad-%s-%d" % (bid, n)
            texts[aid] = {"pages": body}
            items.append({"id": aid, "t": name[:140], "a": meta["authorId"], "tp": meta.get("topicId") or "t17", "c": title, "d": "",
                          "u": "#/book/%s/%d" % (vid, a), "f": "adab-" + bid, "n": sum(len(p) for p in body), "ad": time.strftime("%Y-%m-%d"),
                          "col": "turath", "src": "book", "lic": meta.get("source") or meta.get("license") or ""})
    if not items:
        print("لا مقالات في فهرس «%s»" % title); return 0
    json.dump(texts, open(os.path.join(AD, "adab-%s.json" % bid), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    ip = os.path.join(AD, "index.json")
    idx = json.load(open(ip, encoding="utf-8"))
    idx["items"] = [x for x in idx["items"] if x.get("f") != "adab-" + bid] + items
    json.dump(idx, open(ip, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("«%s»: %d مقالًا في مقالات المكتبة العامة" % (title, len(items)))
    return len(items)


if __name__ == "__main__":
    for b in sys.argv[1:]:
        main(b)
