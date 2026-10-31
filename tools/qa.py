#!/usr/bin/env python3
"""قسم «سؤال وجواب من الكتب»: يستخرج الأسئلة وأجوبتها كما وردت بنصها في الكتب، بلا صياغة من الذكاء الاصطناعي.

الأنماط: «س: … ج: …» و«السؤال: … الجواب: …»، و«فإن قيل: … قيل/قلنا/فالجواب: …»، و«وسئل … عن … فأجاب: …»،
وعناوين الأبواب المصوغة سؤالًا («# ما حكم …؟») مع ما تحتها، وفتاوى صوت السلف (السؤال والجواب).
الجواب يُقتطع عند نهاية جملة، فإن طال أشير إلى إكماله في موضعه من الكتاب.
المخرجات: data/qa/<كتاب>.json {items:[{id,q,a,p,k,more}]} و data/qa/_index.json (الأسئلة للبحث والتصفح).
المراجعة: data/qa/_review.json (يكتبه tools/qa-review.py والمشرف): لكل سؤال حالة ok أو hide أو تصحيح للسؤال/حدود الجواب.
"""
import glob, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "qa")
TURATH = ["majmufatawa", "ilam", "iqtida", "minhajsunna", "fawaid", "jawabkafi", "miftahsaada", "wabil", "ubudiyya", "rafmalam", "siyasa", "furqanawliya", "tawhid", "barbahari"]
MAXA = 1400
PER_BOOK = int(os.environ.get("QA_PER_BOOK", "400"))
DIAC = re.compile(r"[ً-ْٰ]")


def clean(t):
    t = re.sub(r"PageEnd\w+|ms\d+", " ", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


def cut_answer(a):
    """يقطع الجواب عند آخر نهاية جملة قبل الحد؛ ويعيد (النص، هل له بقية)."""
    a = a.strip()
    if len(a) <= MAXA:
        return a, False
    seg = a[:MAXA]
    m = list(re.finditer(r"[.؟!»]\s", seg))
    end = m[-1].end() if m and m[-1].end() > MAXA * 0.5 else MAXA
    return seg[:end].strip(), True


def qid(bid, p, q):
    return hashlib.md5(("%s|%d|%s" % (bid, p, DIAC.sub("", q))).encode()).hexdigest()[:10]


PAT_SJ = re.compile(r"(?:^|\n)\s*(?:س|السؤال|سؤال)\s*[:\-–]\s*(.{8,500}?)\s*\n?\s*(?:ج|الجواب|جواب)\s*[:\-–]\s*(.+?)(?=\n\s*(?:س|السؤال|سؤال)\s*[:\-–]|\Z)", re.S)
PAT_QIL = re.compile(r"(?:فإن|فان|وإن|ولو)\s+قيل\s*[:،]?\s*([^\n]{8,300}?[؟?.])\s*(?:\n\s*)?(?:قيل|قلنا|فالجواب|والجواب|فيقال|قلت|الجواب)\s*[:،]\s*(.+?)(?=(?:فإن|فان|وإن|ولو)\s+قيل|\n#|\Z)", re.S)
PAT_SUIL = re.compile(r"(?:و?سئل|و?سُئل)\s*(?:[^\n:]{0,80}?)\s+عن\s+(.{8,400}?)\s*[.:]?\s*(?:فأجاب|فقال|الجواب)\s*[:،]?\s*(.+?)(?=\n\s*(?:و?سئل|#)|\Z)", re.S)
PAT_HEAD = re.compile(r"^#+\s*(.{8,200}[؟?])\s*$", re.M)


def extract(bid, pages, typ="book"):
    out, seen = [], set()
    def add(q, a, p, k):
        q = re.sub(r"\s*#.*$", "", clean(q), flags=re.S).strip(" :-–\n"); a = re.sub(r"^#+\s*", "", clean(a), flags=re.M)
        if "\n" in q or "«" in q and "»" not in q:
            return
        if not (8 <= len(q) <= 450) or len(a) < 60 or not re.search(r"[ء-ي]", q):
            return
        a = re.sub(r"^[\s(]+", "", a)
        a = re.sub(r"^(?:شيخ الإسلام|الشيخ|فأجاب)[^\n]{0,140}?(?:فقال|أجاب)\s*[:،]?\s*\n?", "", a)
        a2, more = cut_answer(a)
        key = DIAC.sub("", q)[:80]
        if key in seen:
            return
        seen.add(key)
        out.append({"id": qid(bid, p, q), "q": q, "a": a2, "p": p, "k": k, "more": more})
    for i, raw in enumerate(pages):
        t = str(raw or "")
        m = re.search(r"^\s*_{4,}\s*$", t, re.M)
        if m:
            t = t[:m.start()]
        p = i + 1
        for m in PAT_SJ.finditer(t):
            add(m.group(1), m.group(2), p, "sj")
        for m in PAT_QIL.finditer(t):
            add("فإن قيل: " + m.group(1), m.group(2), p, "qil")
        if bid.startswith("majmufatawa"):
            for m in PAT_SUIL.finditer(t):
                add("سُئل عن " + m.group(1), m.group(2), p, "suil")
        heads = list(PAT_HEAD.finditer(t))
        for j, m in enumerate(heads):
            end = heads[j + 1].start() if j + 1 < len(heads) else len(t)
            body = t[m.end():end]
            if len(body.strip()) < 80 and p < len(pages):  # الجواب في الصفحة التالية
                nx = str(pages[p] or "")
                body += "\n" + re.split(r"^#", nx, maxsplit=1, flags=re.M)[0]
            add(m.group(1), body, p, "head")
        if len(out) >= PER_BOOK:
            break
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    review = {}
    rp = os.path.join(OUT, "_review.json")
    if os.path.exists(rp):
        review = json.load(open(rp, encoding="utf-8"))
    index = []
    for f in glob.glob(os.path.join(OUT, "*.json")):
        if not os.path.basename(f).startswith("_"):
            os.remove(f)
    groups = {}
    def art_pages(f, aid):
        g = groups.get(f)
        if g is None:
            try:
                g = groups[f] = json.load(open(os.path.join(ROOT, "data", "articles", f + ".json"), encoding="utf-8"))
            except Exception:
                g = groups[f] = {}
        return (g.get(aid) or {}).get("pages")
    # المصادر: كتب الفهرس، ثم مقالات مكتبة الدعوة وفتاواها (data/articles) وكانت خارج القسم
    srcs = [(b, b.get("type", "book")) for b in cat["books"]]
    ip = os.path.join(ROOT, "data", "articles", "index.json")
    if os.path.exists(ip):
        for x in json.load(open(ip, encoding="utf-8"))["items"]:
            if x.get("h") or x.get("col") == "ithra":
                continue
            srcs.append(({"id": x["id"], "title": x["t"], "f": x["f"], "col": "dawah"}, "fatwa" if x.get("fa") else "article"))
    # أسئلة مستخرجة بالمساعدة الآلية من كتب الدعوة ومقالاتها (data/qa/_ai.json يكتبه tools/curate.py): الجواب بنص المصدر
    aip = os.path.join(OUT, "_ai.json")
    AI = {}
    if os.path.exists(aip):
        for it in json.load(open(aip, encoding="utf-8")).get("items", []):
            AI.setdefault(it["b"], []).append({k: v for k, v in it.items() if k != "b"})
    seen_ids = set()
    for b, typ in srcs:
        base = re.sub(r"-v\d+$", "", b["id"])
        if b.get("demo") or b["id"] in seen_ids:
            continue
        seen_ids.add(b["id"])
        if typ == "book" and not (b.get("col") == "dawah" or base in TURATH):
            continue
        pages = None
        if typ in ("article", "fatwa", "statement") and b.get("f"):
            pages = art_pages(b["f"], b["id"])
        else:
            for pth in (os.path.join(ROOT, "data", "books", b["id"] + ".json"), os.path.join(ROOT, "vols", b["id"] + ".json")):
                if os.path.exists(pth):
                    try:
                        pages = json.load(open(pth, encoding="utf-8")).get("pages")
                    except Exception:
                        pages = None
                    break
        if not pages:
            continue
        items = extract(b["id"], pages, typ)
        if typ == "fatwa" and not items and pages:  # الفتوى: عنوانها سؤالها
            txt = "\n".join(pages)
            m = re.search(r"(?:الجواب|الجواب:)\s*[:\-]?\s*(.+)", txt, re.S)
            a, more = cut_answer(clean(m.group(1) if m else txt))
            items = [{"id": qid(b["id"], 1, b["title"]), "q": b["title"], "a": a, "p": 1, "k": "fatwa", "more": more}]
        have = {DIAC.sub("", it["q"])[:80] for it in items}
        items += [it for it in AI.get(b["id"], []) if DIAC.sub("", it["q"])[:80] not in have]
        # تطبيق المراجعة: إخفاء، أو تصحيح السؤال أو الجواب (من النص نفسه)
        keep = []
        for it in items:
            r = review.get(it["id"]) or {}
            if r.get("s") == "hide":
                continue
            if r.get("q"):
                it["q"] = r["q"]
            if r.get("a"):
                it["a"] = r["a"]
            if r.get("s") == "ok":
                it["ok"] = 1
            keep.append(it)
        if not keep:
            continue
        json.dump({"id": b["id"], "items": keep}, open(os.path.join(OUT, b["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        for it in keep:
            index.append([it["id"], it["q"][:220], b["id"], it["p"], it["k"]] + ([1] if it.get("ok") else []))
        print("%-24s %4d" % (b["id"], len(keep)), flush=True)
    json.dump({"n": len(index), "items": index}, open(os.path.join(OUT, "_index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("المجموع:", len(index))


if __name__ == "__main__":
    main()
