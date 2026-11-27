#!/usr/bin/env python3
"""فهرس دروس سلاسل الطلائع (بند 8أ): الأساس والبنيان (كتب الدعوة المنظمة دروسًا) من فهارس مجلداتها، بلا نموذج ولا حصص.
المخرج: data/video/lessons.json = {"series":[{"set","title","lessons":[{"b":معرّف المجلد,"v":رقم المجلد,"t":العنوان,"p":أول صفحة,"e":آخر صفحة,"goals":["…"]}]}]}
يُستعمل في واجهة الفيديو لاختيار الدرس قبل التوليد. يعمل محليًا: python3 tools/lesson-index.py"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
SERIES = ["الأساس", "البنيان في تربية الفتيان", "البداية"]
GENERIC = re.compile(r"^(الأهداف|الأهداف الإجمالية|المناقشة|تقويم|التقويم|أسئلة|تمارين|الفهرس|المقدمة|المحتويات|[١-٩0-9]+\s*[-.)])")
def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def main():
    cat = jl(os.path.join(D, "catalog.json"), {"books": []})["books"]; out = []
    for title in SERIES:
        vols = sorted((b for b in cat if b.get("col") == "dawah" and b.get("setTitle") == title), key=lambda b: int(b.get("vol") or 0))
        if not vols: continue
        les = []
        for b in vols:
            bb = jl(os.path.join(D, "books", b["id"] + ".json"), {}); toc = [x for x in bb.get("toc") or [] if x.get("t")]; n = int(b.get("n") or len(bb.get("pages") or []))
            top = [x for x in toc if not x.get("l") or x.get("l") == 1]
            for i, x in enumerate(top):
                t = re.sub(r"^[#@\s]+", "", str(x["t"])).strip()
                if not t or GENERIC.match(t) or len(t) > 90 or re.sub(r"[\u064B-\u0652\u0670ْ]", "", t).replace("ال", "") in ("بنيان", "اساس") or t.startswith(("الأساس المستوى", "البنيان —")): continue
                e = (top[i + 1]["p"] - 1) if i + 1 < len(top) else n
                goals = [re.sub(r"^#+\s*", "", str(y["t"])).strip() for y in toc if y.get("l") == 2 and x["p"] <= y["p"] <= max(e, x["p"]) and not GENERIC.match(str(y["t"]).strip())][:6]
                les.append({"b": b["id"], "v": int(b.get("vol") or 0), "t": t, "p": x["p"], "e": max(e, x["p"]), "goals": goals})
        out.append({"set": vols[0].get("set"), "title": title, "lessons": les})
    json.dump({"series": out, "at": __import__("time").strftime("%Y-%m-%d")}, open(os.path.join(D, "video", "lessons.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    for s in out: print(s["title"], len(s["lessons"]), "درسًا")
if __name__ == "__main__": main()
