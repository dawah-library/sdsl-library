#!/usr/bin/env python3
"""فهرس البحث المقلوب للمساعد العلمي (data/sx/) — يُبنى عند النشر ولا يُحفظ في المستودع.

لماذا: كان المساعد يحمّل نصوص المكتبة كلها (~٥٥٠ م.ب) في الخادم مع كل سؤال، فلا يعمل على الاستضافة المجانية.
الآن يبحث المتصفح في هذا الفهرس (يجلب بضعة ملفات صغيرة لكلمات السؤال)، ثم يحمّل نصوص الكتب المرشحة فقط
ويرتّبها بمحرك البحث نفسه (search.js). يشمل كتب المكتبة كلها بمجلداتها (vols) والمقالات.

البنية:
  data/sx/_docs.json         {"k": {مفتاح: معرف}, "n": عدد الصفحات المفهرسة}
  data/sx/<0..2047>.json     {"كلمة": [عدد الصفحات الكلي, "مفتاح.صفحة.تكرار ..."]}
المفتاح ثابت لكل كتاب (crc32 للمعرف) فلا تتغير الملفات كلها حين يُضاف كتاب.
التطبيع مطابق لـ terms() في search.js.
"""
import json, os, re, sys, zlib, array, collections, pathlib, time

R = pathlib.Path(__file__).resolve().parent.parent
OUT = R / "data" / "sx"
SHARDS, CAP = 2048, 160          # عدد الملفات، وأقصى عدد صفحات محفوظ لكل كلمة (الأعلى تكرارًا)
TASH = re.compile("[ً-ٰٟۖ-ۭـ]")
NONW = re.compile("[^ء-ي0-9a-z\\s]")
STOP = set("في من على عن الى إلى ما ماذا هل كيف لماذا متى اين أين هو هي هم ذلك هذا هذه التي الذي الذين كان كانت ان أن إن او أو ثم مع عند كل بين قد لا لم لن حتى اذا إذا يا".split())
P1 = re.compile("^(و|ف)(?=ال)"); P2 = re.compile("^(وال|فال|بال|كال|لل|ال)(?=..)"); P3 = re.compile("^[وفبلك](?=...)")

def norm(s):
    s = TASH.sub("", s)
    return s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا").replace("ى", "ي").replace("ة", "ه").lower()

def stems(text):
    out = []
    for w in NONW.sub(" ", norm(text.replace("# ", ""))).split():
        if len(w) < 2 or w in STOP: continue
        v = P2.sub("", P1.sub("", w))
        if len(v) < 2: v = w
        out.append(v)
        v2 = P3.sub("", v)
        if v2 != v: out.append(v2)
    return out

def key(i): return format(zlib.crc32(i.encode()) & 0xFFFFFF, "x")

def main():
    t0 = time.time()
    cat = json.loads((R / "data" / "catalog.json").read_text(encoding="utf-8"))
    docs, codes = {}, {}
    def add_doc(i):
        k = key(i)
        if k in docs and docs[k] != i: print("تصادم مفتاح:", i, docs[k]); return None
        docs[k] = i; codes.setdefault(k, len(codes)); return codes[k]
    term_doc, term_tf = collections.defaultdict(lambda: array.array("Q")), collections.defaultdict(lambda: array.array("B"))
    npages = 0
    def index(i, pages):
        nonlocal npages
        d = add_doc(i)
        if d is None: return
        for p, txt in enumerate(pages):
            body = re.split(r"^\s*_{4,}\s*$", txt or "", maxsplit=1, flags=re.M)[0]
            c = collections.Counter(stems(body))
            npages += 1
            code = (d << 20) | p
            for t, n in c.items():
                term_doc[t].append(code); term_tf[t].append(min(n, 255))
    for b in cat["books"]:
        if b.get("hidden") or b.get("demo"): continue
        f = (R / "vols" / (b["id"] + ".json")) if b.get("vf") else (R / "data" / "books" / (b["id"] + ".json"))
        if not f.exists(): continue
        try: index(b["id"], json.loads(f.read_text(encoding="utf-8")).get("pages") or [])
        except Exception as e: print("تعذر:", b["id"], e)
    try:
        items = json.loads((R / "data" / "articles" / "index.json").read_text(encoding="utf-8"))["items"]
        groups = collections.defaultdict(list)
        for x in items:
            if not x.get("h"): groups[x["f"]].append(x["id"])
        for g, ids in groups.items():
            gf = R / "data" / "articles" / (g + ".json")
            if not gf.exists(): continue
            data = json.loads(gf.read_text(encoding="utf-8"))
            for i in ids:
                if i in data: index(i, data[i].get("pages") or [])
    except FileNotFoundError: pass
    inv = {v: k for k, v in codes.items()}
    shards = [dict() for _ in range(SHARDS)]
    limit = max(50, int(npages * 0.25))           # كلمة في أكثر من ربع الصفحات لا تفيد البحث
    for t, ds in term_doc.items():
        df = len(ds)
        if df > limit: continue
        tf = term_tf[t]
        idx = sorted(range(df), key=lambda j: -tf[j])[:CAP] if df > CAP else range(df)
        post = " ".join(f"{inv[ds[j] >> 20]}.{(ds[j] & 0xFFFFF) + 1}.{tf[j]}" for j in idx)
        shards[zlib.crc32(t.encode()) % SHARDS][t] = [df, post]
    OUT.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(shards):
        (OUT / f"{i}.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "_docs.json").write_text(json.dumps({"k": docs, "n": npages, "shards": SHARDS}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"sx: {len(docs)} مادة، {npages} صفحة، {len(term_doc)} كلمة، {size/1048576:.1f} م.ب، {time.time()-t0:.0f} ث")

if __name__ == "__main__":
    main()
