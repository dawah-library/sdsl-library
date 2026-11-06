#!/usr/bin/env python3
"""تمارين «الأساس» و«البنيان» للطلائع (البند ١٧): تُستخرج أسئلة الكتابين بنصها (اختر من بين الأقواس، وضع علامة ✓/✗،
وأكمل، وأجب) مع الدرس الذي تتبعه وصفحتها، إلى data/tala-ex.json؛ فتصير أسئلة تفاعلية في قسم الطلائع بحسب المرحلة.
الكتابان لا يذكران الإجابات: فإن وُجد مفتاح Gemini تُقترح الإجابة من نص الدرس نفسه (الصفحات السابقة للتمرين) وتُعلَّم «غير مراجعة»
(v=0) حتى يعتمدها المدير من صفحة الطلائع؛ ولا تُعرض للأطفال إجابة غير معتمدة (يرجعون إلى الدرس مع الوالد).
الاستعمال: python3 tools/tala-ex.py [--answer N]"""
import json, os, re, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUTF = os.path.join(D, "tala-ex.json")
DG = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
HEAD = re.compile(r"^(?:#+\s*)?(?:[\d٠-٩]+\s*)?(اختر|ضع علامة|أكمل|أجب|صل بين|علل|رتب)")
ITEM = re.compile(r"^\s*(?:\(\s*\)\s*)?[\d٠-٩]+\s*[-–.)]\s*(.+)$")
BAD = re.compile(r"^\W*([\d٠-٩]|ما |ماذا|اذكر|المناقشة|التطبيق|سؤال|أسئلة|اسئلة|تدريب|قيم|فكر|تأمل|لماذا|كيف|هل |علل|ناقش|المفردات|معاني|الفوائد|من هذا|يتربى|نتعلم|في جلسة|لغويات|حقيقة)|ضع علامة|اختر|أكمل|أجب|صل |العمود|:$")
def series():
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))["books"]
    out = []
    for b in cat:
        st = b.get("setTitle") or ""
        if st.startswith("الأساس") or st.startswith("البنيان"):
            out.append((b["id"], "asas" if st.startswith("الأساس") else "bunyan", int(b.get("vol") or 1)))
    return sorted(out, key=lambda x: (x[1] != "asas", x[2]))
def extract(bid, ser, vol):
    bk = json.load(open(os.path.join(D, "books", bid + ".json"), encoding="utf-8")); pages = bk.get("pages") or []
    # اسم الدرس من فهرس الكتاب (أعلى مستويين) لا من العناوين الداخلية للتمارين
    toc = sorted([t for t in (bk.get("toc") or []) if t.get("p") and (t.get("l") or 1) <= 2 and not re.match(r"^(المستوى|البنيان|الأساس|المقدمة|مقدمة|الفهرس)", t.get("t", "")) and not BAD.search(t.get("t", "")) and not re.search(r"[_\u200f]|\.\.|[0-9]", t.get("t", "")) and len(t.get("t", "").split()) >= 2], key=lambda t: t["p"])
    def les(pg):
        c = [t for t in toc if t["p"] <= pg]
        return (c[-1]["t"].strip(), c[-1]["p"]) if c else None
    out = []; lesson = ""; lp = 1
    for i, pg in enumerate(pages):
        if not isinstance(pg, str): continue
        lines = [l.strip() for l in pg.split("\n")]
        kind = None; k = 0
        while k < len(lines):
            l = lines[k]; h = HEAD.match(l.lstrip("#@< "))
            if l.startswith("#") and not h and len(l) < 90 and not re.match(r"^#+\s*[\d٠-٩]+\s*$", l):
                t = l.lstrip("#@< ").strip()
                if t and not re.search(r"تمارين|أنشطة|نشاط|التقويم|الأهداف", t) and not re.match(r"^([\d٠-٩]|ما |ماذا|اذكر|المناقشة|التطبيق|سؤال|أسئلة|اسئلة|تدريب|قيّم|قيم|فكر|تأمل|لماذا|كيف|هل |علل|ناقش|المفردات|معاني|الفوائد|من هذا|يتربى|نتعلم)", t): lesson, lp = t, i + 1
            if h:
                lt = les(i + 1)
                if lt: lesson, lp = lt
                kind = {"اختر": "mcq", "ضع علامة": "tf", "أكمل": "fill"}.get(h.group(1), "open"); k += 1; continue
            if kind:
                m = ITEM.match(l)
                if m:
                    q = m.group(1).strip()
                    if kind == "mcq":
                        opts = None; mo = re.search(r"\(([^()]{3,200})\)\s*$", q)
                        if not mo and k + 1 < len(lines) and re.match(r"^\(.*\)$", lines[k + 1]): mo = re.match(r"^\((.*)\)$", lines[k + 1]); k += 1
                        if mo:
                            opts = [o.strip() for o in re.split(r"\s+-\s+|\s*–\s*|،\s*", mo.group(1)) if o.strip()]
                            q = q[: mo.start()].strip() if mo.string == q else q
                        if opts and 2 <= len(opts) <= 6: out.append({"s": ser, "v": vol, "b": bid, "p": i + 1, "l": lesson, "lp": lp, "k": "mcq", "q": re.sub(r"\.{3,}", " …… ", q), "o": opts})
                    elif kind == "tf":
                        q = re.sub(r"\(\s*\)\s*$", "", q).strip()
                        if len(q) > 6: out.append({"s": ser, "v": vol, "b": bid, "p": i + 1, "l": lesson, "lp": lp, "k": "tf", "q": q})
                    else:
                        out.append({"s": ser, "v": vol, "b": bid, "p": i + 1, "l": lesson, "lp": lp, "k": kind, "q": re.sub(r"\.{3,}", " …… ", q)})
                elif l.startswith("#") or (l and not l.startswith("(") and len(l) > 140): kind = None
            k += 1
    return out
def answer(items, n):
    """إجابة مقترحة من نص الدرس نفسه (Gemini)، تُعلَّم غير مراجعة."""
    import importlib.util
    sp = importlib.util.spec_from_file_location("tj", os.path.join(ROOT, "tools", "tashjir.py")); tj = importlib.util.module_from_spec(sp); sp.loader.exec_module(tj)
    cache = {}; done = 0
    for it in items:
        if done >= n: break
        if it.get("a") is not None or it["k"] not in ("mcq", "tf"): continue
        if it["b"] not in cache: cache[it["b"]] = json.load(open(os.path.join(D, "books", it["b"] + ".json"), encoding="utf-8"))["pages"]
        ctx = "\n".join(p for p in cache[it["b"]][max(0, it["lp"] - 1): it["p"]] if isinstance(p, str))[-9000:]
        if it["k"] == "mcq":
            pr = "من نص الدرس التالي فقط، اختر الإجابة الصحيحة. أخرج JSON: {\"i\": رقم الخيار الصحيح من 0, \"why\": \"العبارة من الدرس الدالة\"}\nالسؤال: %s\nالخيارات: %s\n\nالدرس:\n%s" % (it["q"], json.dumps(it["o"], ensure_ascii=False), ctx)
        else:
            pr = "من نص الدرس التالي فقط: هل العبارة صحيحة أم خطأ؟ أخرج JSON: {\"ok\": true أو false, \"why\": \"العبارة من الدرس الدالة\"}\nالعبارة: %s\n\nالدرس:\n%s" % (it["q"], ctx)
        r = tj.gemini(pr)
        if not isinstance(r, dict): continue
        if it["k"] == "mcq" and isinstance(r.get("i"), int) and 0 <= r["i"] < len(it["o"]): it["a"] = r["i"]
        elif it["k"] == "tf" and isinstance(r.get("ok"), bool): it["a"] = r["ok"]
        else: continue
        it["why"] = str(r.get("why", ""))[:300]; it["ok"] = 0; done += 1
    return done
def main():
    old = {}
    if os.path.exists(OUTF):
        for x in json.load(open(OUTF, encoding="utf-8")).get("items", []): old[(x["b"], x["p"], x["q"])] = x
    items = []
    for bid, ser, vol in series():
        for it in extract(bid, ser, vol):
            o = old.get((it["b"], it["p"], it["q"]))
            if o:
                for k in ("a", "why", "ok"):
                    if k in o: it[k] = o[k]
            items.append(it)
    if "--answer" in sys.argv:
        n = int(sys.argv[sys.argv.index("--answer") + 1]) if len(sys.argv) > sys.argv.index("--answer") + 1 else 200
        print("إجابات مقترحة:", answer(items, n))
    json.dump({"note": "يولّده tools/tala-ex.py من تمارين الأساس والبنيان بنصها؛ a إجابة مقترحة من الدرس لا تُعرض إلا بعد اعتماد المدير (ok=1)", "items": items},
              open(OUTF, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print(len(items), Counter((x["s"], x["k"]) for x in items))

if __name__ == "__main__":
    main()
