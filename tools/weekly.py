#!/usr/bin/env python3
"""سلسلة «كتاب الأسبوع» (المرحلة ٩): ثمانية أسابيع، لكل أسبوع كتاب من كتب مشايخ الدعوة، وسبعة مقتطفات قصيرة بنصها
(واحد لكل يوم يظهر في الرئيسية) مع رقم صفحته، ورابط القراءة، والتشجير والاختبار إن وُجدا.
المقتطفات تُنقل بحروفها من الكتاب (الفوائد المستخرجة من الكتاب أولًا data/fawaid.json، ثم جمل تامة من مطالع فصوله)؛ لا صياغة آلية.
المخرج: data/weekly.json — تعدّله الإدارة بحرية (ترتيب الكتب، المقتطفات)، وst=draft حتى تعتمده من #/weekly.
الاستعمال: python3 tools/weekly.py [تاريخ البدء YYYY-MM-DD] [--force]
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
jl = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d


def sentences(pages, toc, n=14):
    """جمل تامة (٧٠–٢٦٠ حرفًا) من مطالع الفصول، بنصها ورقم صفحتها؛ بلا آيات مبتورة ولا حواشٍ."""
    out, seen = [], set()
    starts = [t.get("p") for t in toc if t.get("p")] or list(range(1, len(pages) + 1, max(1, len(pages) // 20)))
    for p in starts:
        if not (1 <= p <= len(pages)): continue
        body = re.split(r"^\s*_{4,}\s*$", pages[p - 1] or "", flags=re.M)[0]
        for k, para in enumerate(body.split("\n")):
            para = para.strip()
            if k == 0 and not para.startswith("#"): continue  # أول فقرة في الصفحة قد تكون تتمة الصفحة السابقة
            if para.startswith("#") or len(para) < 70: continue
            for s in re.split(r"(?<=[.؟!])\s+", para)[:1]:  # أول جملة في الفقرة وحدها: بداية حقيقية لا من وسط نص منقول
                s = s.strip(); bare = re.sub(r"[\u064B-\u0652\u0670\u0640]", "", s)
                if not (70 <= len(s) <= 260) or not re.search(r"[.؟!]$", s) or "...." in s or "…" in s or re.match(r"^([\d٠-٩]|الحمد لله|إن الحمد|إنَّ الحمد|بسم الله|أما بعد|فإن أصدق|وبعد|قال|وقال|ويحكى|وعن|عن|التعريف)", bare): continue
                if s.count("﴿") != s.count("﴾") or s.count("«") != s.count("»") or s.count('"') % 2 or s in seen: continue
                seen.add(s); out.append({"t": s, "p": p}); break
            if len(out) >= n: return out
    return out


def main():
    start = next((a for a in sys.argv[1:] if re.match(r"\d{4}-\d\d-\d\d$", a)), None)
    wp = os.path.join(D, "weekly.json"); old = jl(wp)
    if old and old.get("st") == "ok" and "--force" not in sys.argv: print("الخطة معتمدة؛ لا تُستبدل (--force للاستبدال)"); return
    cat = jl(os.path.join(D, "catalog.json")); A = {a["id"]: a for a in cat["authors"]}
    tj = jl(os.path.join(D, "tashjir", "_list.json"), {}) or {}; qz = {f[:-5] for f in os.listdir(os.path.join(D, "quizzes")) if f.endswith(".json")}
    fw = {}
    for x in (jl(os.path.join(D, "fawaid.json"), {}) or {}).get("items", []): fw.setdefault(x["b"], []).append({"t": x["text"].strip("() "), "p": x["p"]})
    cands = [b for b in cat["books"] if (b.get("col") or "dawah") == "dawah" and (b.get("type") or "book") == "book" and not b.get("hidden") and not (b.get("ocr") and (b.get("unrev") or b.get("lite"))) and 30 <= (b.get("n") or 0) <= 400 and not b.get("vol")]
    cands.sort(key=lambda b: (-(b["id"] in tj) - (b["id"] in qz) - (b["id"] in fw), -(b.get("n") or 0)))
    d0 = datetime.date.fromisoformat(start) if start else datetime.date.today() + datetime.timedelta(days=(5 - datetime.date.today().weekday()) % 7)  # يبدأ السبت
    weeks, used = [], set()
    for b in cands:
        if len(weeks) >= 8: break
        if (b.get("authorId"), ) in used and len(cands) > 16: continue  # تنويع المؤلفين ما أمكن
        p = os.path.join(D, "books", b["id"] + ".json")
        if not os.path.exists(p): continue
        sh = jl(p); sn = [x for x in fw.get(b["id"], []) if 40 <= len(x["t"]) <= 320 and not re.match(r"^(و?عن|ويحكى|وقال)\s", x["t"])][:7]
        sn += [x for x in sentences(sh["pages"], sh.get("toc") or []) if x["t"] not in {y["t"] for y in sn}][:7 - len(sn)]
        if len(sn) < 4: continue
        used.add((b.get("authorId"), ))
        weeks.append({"w": len(weeks) + 1, "from": str(d0 + datetime.timedelta(weeks=len(weeks))), "b": b["id"], "t": b["title"], "a": A.get(b.get("authorId"), {}).get("name", ""),
                      "sn": sn, "tj": b["id"] in tj, "quiz": b["id"] in qz})
    json.dump({"note": "كتاب الأسبوع — tools/weekly.py؛ المقتطفات بنص الكتاب وصفحته. st=ok بعد اعتماد الإدارة", "st": "draft", "weeks": weeks},
              open(wp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("خطة %d أسابيع من %s" % (len(weeks), d0))


if __name__ == "__main__":
    main()
