#!/usr/bin/env python3
"""روابط قسم الحديث من نصوص المكتبة نفسها:
١) موضع شرح كل حديث في شرحه المشهور الموجود في المكتبة: البخاري ← فتح الباري لابن حجر (وابن رجب)، مسلم ← المنهاج للنووي،
   أبو داود ← عون المعبود، الترمذي ← تحفة الأحوذي، الموطأ ← الاستذكار، بلوغ المرام ← سبل السلام، الأربعون ← جامع العلوم والحكم.
   الطريقة: مقاطع رباعية الكلمات من متن الحديث تُطلب في صفحات الشرح، وتُختار الصفحة الأكثر اتفاقًا مع مراعاة ترتيب الشرح للكتاب.
٢) التخريج من كتب السنة في المكتبة: مواضع الحديث نفسه في الكتب الأخرى (اتفاق المقاطع بين المتون).
٣) فهرس بدايات المتون (links/_tx) لفتح نتيجة البحث في موضعها من القسم.
المخرج: data/hadith/links/<الكتاب>.json = {رقم الحديث أو معرّفه: {"sh": [[ملف المجلد، صفحة]…], "t": [[كتاب، رقم]…]}}"""
import json, os, re, glob, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); H = os.path.join(ROOT, "data", "hadith"); OUT = os.path.join(H, "links")
SH = {"bukhari": ["fathbari", "fathbarirajab"], "muslim": ["nawawimuslim"], "abudawud": ["awnmabud"], "tirmidhi": ["tuhfaahwadhi"],
      "muwatta": ["istidhkar"], "bulugh": ["subulsalam"], "arbain": ["jamiulum"]}
DIA = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
STOPW = set("صلى الله عليه وسلم رسول النبي قال قالت عن في من على أن إن ان ما لا يا ثم أو او".split())
def words(s):
    s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return [w for w in re.sub(r"[^ء-ي ]", " ", s).split() if len(w) > 1]
def sh(ws, k=4): return {hash(" ".join(ws[i:i + k])) for i in range(len(ws) - k + 1) if not all(w in STOPW for w in ws[i:i + k])}
def matns():
    """(كتاب، رقم) ← المتن، من كتب السنة الثمانية والمختارات الثلاث"""
    out = {}
    for f in sorted(glob.glob(os.path.join(H, "k", "*.json"))):
        b = os.path.basename(f)[:-5]
        if b.startswith("_"): continue
        for m in sorted(glob.glob(os.path.join(H, "k", b, "m*.json"))):
            for n, t in json.load(open(m, encoding="utf-8")).items(): out[(b, n)] = t
    for b in ("arbain", "riyad", "bulugh"):
        p = os.path.join(H, b + ".json")
        if os.path.exists(p):
            for i, x in json.load(open(p, encoding="utf-8")).items(): out[(b, i)] = x.get("m") or ""
    return out
def vols(bid): return sorted(glob.glob(os.path.join(ROOT, "vols", bid + "-v*.json"))) or ([os.path.join(ROOT, "data", "books", bid + ".json")] if os.path.exists(os.path.join(ROOT, "data", "books", bid + ".json")) else [])
def main():
    M = matns(); print("متون:", len(M))
    S = {k: sh(words(t)[:60]) for k, t in M.items()}
    df = collections.Counter(x for v in S.values() for x in v)
    S = {k: {x for x in v if df[x] <= 40} for k, v in S.items()}  # المقاطع الشائعة لا تميّز
    res = collections.defaultdict(dict)
    # ١) مواضع الشرح
    for b, sbooks in SH.items():
        keys = [k for k in M if k[0] == b]
        if not keys: continue
        want = collections.defaultdict(list)
        for k in keys:
            for x in S[k]: want[x].append(k)
        for sb in sbooks:
            hits = collections.defaultdict(collections.Counter); pos = []
            for vf in vols(sb):
                vid = os.path.basename(vf)[:-5]
                for i, pg in enumerate(json.load(open(vf, encoding="utf-8")).get("pages") or []):
                    if not isinstance(pg, str): continue
                    P = len(pos); pos.append((vid, i + 1))
                    for x in sh(words(pg)):
                        for k in want.get(x, ()): hits[k][P] += 1
            prev, n = -1, 0
            order = sorted(keys, key=lambda k: (float(k[1]) if re.match(r"^[\d.]+$", str(k[1])) else 0, str(k[1])))
            for k in order:
                c = hits.get(k)
                if not c: continue
                best = max(c.values())
                if best < 3: continue
                cand = sorted(P for P, v in c.items() if v >= max(3, best * 0.6))
                after = [P for P in cand if P >= prev - 30]
                P = after[0] if after else max(c, key=c.get)
                prev = max(prev, P); n += 1
                res[b].setdefault(str(k[1]), {}).setdefault("sh", []).append(list(pos[P]))
            print(b, "←", sb, ":", n, "من", len(keys))
    # ٢) التخريج من الكتب الأخرى
    inv = collections.defaultdict(list)
    for k, v in S.items():
        for x in v: inv[x].append(k)
    nt = 0
    for k, v in S.items():
        if len(v) < 3: continue
        c = collections.Counter(o for x in v for o in inv[x] if o[0] != k[0])
        per = {}
        for o, cnt in c.items():
            if cnt >= max(4, len(v) * 0.3) and cnt > per.get(o[0], (None, 0))[1]: per[o[0]] = (o, cnt)
        if per:
            res[k[0]].setdefault(str(k[1]), {})["t"] = [[o[0], o[1]] for o, _ in sorted(per.values(), key=lambda z: -z[1])]; nt += 1
    print("أحاديث لها تخريج:", nt)
    os.makedirs(OUT, exist_ok=True)
    # ٣) فهرس بدايات المتون لربط نتائج البحث (ومنها الموسوعة الحديثية) بموضع الحديث في القسم: مفتاحه أول ثلاث كلمات
    TX = collections.defaultdict(lambda: collections.defaultdict(list))
    for k, t in M.items():
        w = words(t)
        for off in (0, 1):
            if len(w) >= off + 3:
                key = " ".join(w[off:off + 3]); TX[key[:1]][key].append([k[0], k[1]])
    os.makedirs(os.path.join(OUT, "_tx"), exist_ok=True)
    for c, d in TX.items(): json.dump({k: v[:12] for k, v in d.items()}, open(os.path.join(OUT, "_tx", "%04x.json" % ord(c)), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for b, d in res.items(): json.dump(d, open(os.path.join(OUT, b + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
if __name__ == "__main__":
    main()
