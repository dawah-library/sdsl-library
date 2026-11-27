#!/usr/bin/env python3
"""استيراد متن للحفظ من الشاملة (turath.io) نصًّا حرفيًّا بمصدره، مسودةً مخفية حتى تراجعه الإدارة (طلب المدير، ٢٧ نوفمبر).

الاستعمال: python3 tools/matn-import.py <معرف المتن في data/mutun.json> <رقم الكتاب في الشاملة> <معرف المؤلف> [المجلد المؤقت]
- يُنقل النص كما هو في المصدر دون أي تعديل (القاعدة: النص الشرعي حرفيًّا مع مصدره)، صفحةً لكل صفحة من المطبوع (ترقيم الكتاب موافق للمطبوع).
- يُضاف الكتاب إلى الفهرس مخفيًّا (hidden) فلا يراه إلا المشرفون، ويُربط بمتنه في «حفظ المتون» (الحقل b).
- تُكتب المواضع المشتبه في خطئها الطباعي في الحقل draft.sus للمراجعة، ولا يُصحَّح منها شيء آليًّا.
- الإظهار للعموم بعد المراجعة: إزالة hidden من سجل الكتاب في data/catalog.json (أو من «إدارة المواد»)."""
import json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.turath.io"


def get(url):
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "sdsl-library"}), timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            err = e; time.sleep(2 + 3 * k)
    raise SystemExit("تعذر الجلب: %s (%s)" % (url, err))


# مواضع مشتبهة: حرف مفرد ملصق بكلمة، أو كلمة ملتصقة بأخرى (لا تعريف بعدها)، أو همزة وصل في «ابن» على غير القياس
SUS = [(re.compile(r"(?<![ء-ي])[ةى](?=[ء-ي])"), "تاء مربوطة أو ألف مقصورة في أول كلمة"),
       (re.compile(r"(?<=[ء-ي])[ة](?=[ء-ي])"), "تاء مربوطة وسط كلمة (كلمتان ملتصقتان؟)"),
       (re.compile(r"(?<=[ء-ي])\s(?=[ء-ي](?:\s|$))"), "حرف مفرد منفصل (كلمة مقطوعة؟)"),
       (re.compile(r"\b(?:إبن|الإبن)\b"), "همزة «ابن»"),
       (re.compile(r"[ء-ي]{11,}"), "كلمة طويلة جدًّا (كلمتان ملتصقتان؟)")]


def main():
    if len(sys.argv) < 4: raise SystemExit(__doc__)
    mid, bid, aid = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    if not any(a["id"] == aid for a in json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))["authors"]): raise SystemExit("المؤلف غير موجود في الفهرس: " + aid)
    meta = get("%s/book?id=%d&ver=3" % (API, bid)).get("meta") or {}
    pages, toc, pl, sus, cur = [], [], [], [], None
    for pg in range(1, 400):
        j = get("%s/page?book_id=%d&pg=%d&ver=3" % (API, bid, pg))
        if not j or "text" not in j: break
        m = json.loads(j.get("meta") or "{}"); pp = str(m.get("page") or "")
        if not j.get("text") and not m: break
        txt = re.sub(r'<span data-type="title"[^>]*>(.*?)</span>', lambda x: "# " + x.group(1).strip(), j["text"]).strip()
        txt = re.sub(r"<[^>]+>", "", txt)
        if cur != pp or not pages:
            pages.append(txt); pl.append("ص " + pp if pp else ""); cur = pp
        else:
            pages[-1] += "\n" + txt
        for h in m.get("headings") or []:
            if not toc or toc[-1]["t"] != h: toc.append({"t": h, "p": len(pages)})
        for ln in txt.split("\n"):
            for rx, why in SUS:
                for x in rx.finditer(ln):
                    sus.append({"p": len(pages), "l": ln.strip()[:120], "w": why})
        if pg > 2 and not j.get("text"): break
    if not pages: raise SystemExit("لا نص")
    book = {"id": mid, "pages": pages, "toc": toc, "pl": pl}
    json.dump(book, open(os.path.join(ROOT, "data", "books", mid + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    cp = os.path.join(ROOT, "data", "catalog.json"); cat = json.load(open(cp, encoding="utf-8"))
    cat["books"] = [b for b in cat["books"] if b["id"] != mid]
    cat["books"].append({"id": mid, "title": (meta.get("name") or mid).split(" = ")[0].strip(), "authorId": aid, "topicId": "t4", "col": "turath", "type": "book",
                         "n": len(pages), "added": time.strftime("%Y-%m-%d"), "size": sum(len(p) for p in pages), "source": "المكتبة الشاملة (turath.io) الكتاب %d" % bid,
                         "license": "نص المكتبة الشاملة عبر turath.io (الكتاب %d)" % bid, "edInfo": {"info": meta.get("info") or ""}, "hidden": True,
                         "draft": {"why": "متن للحفظ: مسودة حتى تراجع الإدارة نصه على المطبوع", "sus": sus[:200], "at": time.strftime("%Y-%m-%d")}})
    open(cp, "w", encoding="utf-8").write(json.dumps(cat, ensure_ascii=False, separators=(",", ":")))
    mp = os.path.join(ROOT, "data", "mutun.json"); mt = json.load(open(mp, encoding="utf-8"))
    for x in mt["items"]:
        if x["id"] == mid: x["b"] = mid
    open(mp, "w", encoding="utf-8").write(json.dumps(mt, ensure_ascii=False, indent=1))
    print("استُورد «%s»: %d صفحة، %d بابًا، %d موضعًا مشتبهًا للمراجعة (مخفي حتى الاعتماد)" % (meta.get("name"), len(pages), len(toc), len(sus)))
    for s in sus: print("  ص%d: %s — %s" % (s["p"], s["w"], s["l"]))


if __name__ == "__main__":
    main()
