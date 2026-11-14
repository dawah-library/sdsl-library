#!/usr/bin/env python3
"""الربط العكسي بين الشروح والأحاديث (بعد tools/hadith-links.py):
١) data/hadith/links/_rev/<ملف الشرح>.json = {صفحة: [[كتاب، رقم]…]}: من صفحة الشرح إلى الحديث الذي تشرحه (يظهر في القارئ «هذا الموضع شرح حديث…»).
٢) sh2 في روابط كل كتاب: الحديث الذي ليس له شرح مباشر يأخذ مواضع شرح الحديث نفسه في كتاب آخر عبر التخريج (t)،
   فيرتفع عدد الأحاديث الموصولة بشروحها (النسائي وابن ماجه والدارمي ورياض الصالحين…)."""
import json, os, glob, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); L = os.path.join(ROOT, "data", "hadith", "links")
D = {os.path.basename(f)[:-5]: json.load(open(f, encoding="utf-8")) for f in glob.glob(os.path.join(L, "*.json"))}
rev = collections.defaultdict(lambda: collections.defaultdict(list)); n2 = 0
for b, d in D.items():
    for n, v in d.items():
        for f, p in v.get("sh") or []: rev[f][str(p)].append([b, n])
for b, d in D.items():
    for n, v in d.items():
        if v.get("sh"): v.pop("sh2", None); continue
        got = []
        for tb, tn in v.get("t") or []:
            for f, p in (D.get(tb, {}).get(tn, {}).get("sh") or [])[:2]:
                if [f, p, tb, tn] not in got: got.append([f, p, tb, tn])
        if got: v["sh2"] = got[:4]; n2 += 1
        else: v.pop("sh2", None)
    json.dump(d, open(os.path.join(L, b + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
os.makedirs(os.path.join(L, "_rev"), exist_ok=True)
for f, m in rev.items():
    json.dump({p: x[:6] for p, x in m.items()}, open(os.path.join(L, "_rev", f + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("صفحات شرح موصولة بأحاديثها:", sum(len(m) for m in rev.values()), "في", len(rev), "ملفًا؛ أحاديث وُصلت بشرح عبر التخريج:", n2)
