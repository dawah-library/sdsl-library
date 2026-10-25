#!/usr/bin/env python3
"""فهرس مواضع تفسير الآيات: لكل آية، صفحة تفسيرها في كل تفسير بالمكتبة.
يمرّ على الآيات بالترتيب، ويبحث عن أول كلمات الآية في صفحات التفسير من آخر موضع وُجد (التفاسير مرتبة على المصحف)،
فإن لم توجد أخذ موضع الآية السابقة (علامة ~). المخرج: data/tafidx/<سورة>.json = {"آية": [[معرف المجلد، الصفحة، دقيق؟]...]}.
لإضافة تفسير: أضفه إلى TAFASIR (بادئة معرفات مجلداته في vols/ أو data/books/) وشغّل المهمة tafidx.yml."""
import json, os, re, glob
TAFASIR = [("ibnkathir", "تفسير ابن كثير"), ("baghawitafsir", "تفسير البغوي")]
TASH = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ﻿]")
def norm(s):
    s = TASH.sub("", s); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return " ".join(re.sub(r"[^ء-ي]+", " ", s).split())
def pages(prefix):
    out = []
    for f in sorted(glob.glob(f"vols/{prefix}-v*.json") + glob.glob(f"data/books/{prefix}*.json")):
        d = json.load(open(f, encoding="utf-8")); vid = d.get("id") or os.path.basename(f)[:-5]
        for i, p in enumerate(d.get("pages", [])): out.append((vid, i + 1, " " + norm(p) + " "))
    return out
Q = json.load(open("data/quran/quran.json", encoding="utf-8"))["suras"]
ayat = [(s["n"], j + 1, norm(a)) for s in Q for j, a in enumerate(s["ayat"])]
res = {}; stat = {}
for pre, name in TAFASIR:
    P = pages(pre); ptr = 0; last = None; ok = 0
    if not P: continue
    for k, (su, ay, t) in enumerate(ayat):
        w = t.split()
        if su > 1 and ay == 1 and w[:4] == "بسم الله الرحمن الرحيم".split(): w = w[4:] or w
        keys = [" " + " ".join(w[:n]) + " " for n in (7, 5, 4) if len(w) >= n] or [" " + " ".join(w + ayat[k + 1][2].split()[:3] if k + 1 < len(ayat) else w) + " "]
        hit = None
        for key in keys:
            for j in range(ptr, min(len(P), ptr + 80)):
                if key in P[j][2]: hit = j; break
            if hit is not None: break
        if hit is not None: ptr = hit; last = (P[hit][0], P[hit][1], 1); ok += 1
        elif last: last = (last[0], last[1], 0)
        else: last = (P[0][0], P[0][1], 0)
        res.setdefault(su, {}).setdefault(ay, []).append([last[0], last[1], last[2]])
    stat[name] = (ok, len(ayat))
os.makedirs("data/tafidx", exist_ok=True)
for su, d in res.items(): json.dump(d, open(f"data/tafidx/{su}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump({"tafasir": [[p, n] for p, n in TAFASIR]}, open("data/tafidx/_meta.json", "w", encoding="utf-8"), ensure_ascii=False)
for n, (o, t) in stat.items(): print(f"{n}: {o}/{t} آية بموضع دقيق ({round(100*o/t)}%)")
