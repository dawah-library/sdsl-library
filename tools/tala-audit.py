#!/usr/bin/env python3
"""فحص قسم الطلائع وتصنيف أسئلته بالسن والباب والصعوبة، وقياس «قبل» (طلب المدير، ٢٧ نوفمبر — البند ١٦).

يقرأ ولا يعدّل مصادر القسم: data/tala-ex.json (تمارين الأساس والبنيان بنصها)، data/tala-ex-ok.json (اعتماداتها)،
data/tala-bank.json (البنك المتجدد)، data/tala-riddles.json (الألغاز).
يكتب:
  data/tala-audit.json  فهرس تصنيف لكل سؤال {المعرّف: [المرحلة، الباب، الصعوبة]} مع ملخص القياس، لتستعمله الواجهة لاحقًا.
  tools/tala-audit.md   التقرير: التوزيع والفجوات ومؤشرات الجودة («قبل»)؛ ويُعاد تشغيله بعد التطوير للمقارنة («بعد»).
التصنيف آلي بقواعد صريحة (لا نموذج لغوي):
  المرحلة: السلسلة والمجلد (الأساس ١–٢ ← t1، ٣–٦ ← t2، البنيان ← t3، البداية ← t4)، أو حقل k في البنك والألغاز.
  الباب: كلمات عنوان الدرس ونص السؤال على أبواب منهج الطلائع (data/tala-manhaj.json subjects).
  الصعوبة ١–٣: نوع السؤال (صح/خطأ ١، اختيار وإكمال ٢، مفتوح ٣) معدّلًا بطول السؤال وبالمرحلة."""
import json, os, re, sys, time, hashlib, collections as C

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"[ً-ْـ]", "", str(s or "")).replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")).strip()
TRN = {"t1": "٥–٨", "t2": "٩–١٢", "t3": "١٢–١٥", "t4": "١٥–١٨", "t5": "١٨–٢٠"}


def main():
    man = J("data/tala-manhaj.json")
    SUB = [(k, n, re.compile(norm(rx))) for k, n, _, rx in man["subjects"]]
    # كلمات إضافية شائعة في عناوين دروس الأساس والبنيان (تكمّل قواعد المنهج، ولا تُغيّرها)
    EXTRA = [("kawn", r"مخلوقات|حيوان|طائر|حقيقه علميه|حقائق علميه|السلحفاه|قنفذ|ريمورا|الكيوي|الغلموت|قرد|الدوده|النحل|النمل|البحر|الفضاء|الكون"),
             ("sira", r"معجزات الرسول|عبادته ﷺ|صلاته ﷺ|اخلاقه ﷺ|اصحاب الزرع"), ("aqida", r"المقيت|الرؤوف|الوكيل|الظاهر|الباطن|القدوس|الحي القيوم|المقتدر|اعبدوا ربكم|قيام الساعه"),
             ("adhkar", r"اثقل الكلمات|عند التعجب"), ("fiqh", r"عرفه|السواك|الاغتسال|الاظفار|النظافه"),
             ("adab", r"الرجاء|الرغبه|الرهبه|الخشوع|مشاعر المؤمن|الرفق|الاستئذان|تصاحب|الاتحاد|اصلح نفسك"), ("quran", r"سوره|القران|ايه|تلاوه|تجويد"), ("aqida", r"الله|الملائكه|الكتب|الرسل|اليوم الاخر|القدر|الشرك|الجنه|النار|اسماء"),
             ("fiqh", r"طهار|وضوء|صلاه|صوم|صيام|زكاه|حج|غسل|تيمم|اذان|مسجد|عيد"), ("sira", r"النبي|غزوه|هجره|صحابي|قصه|نبي|موسي|ابراهيم|يوسف|نوح"),
             ("adab", r"بر|صدق|امانه|احترام|اداب|حياء|رحمه|تعاون|نظافه|جار|والدين"), ("adhkar", r"ذكر|اذكار|دعاء|استغفار"), ("hadith", r"حديث|عن النبي|قال رسول")]
    EX = [(k, re.compile(rx)) for k, rx in EXTRA]
    SN = dict({k: n for k, n, _ in SUB}, kawn="آيات الله في الكون")

    def subj(*txt):  # عنوان الدرس أولًا ثم نص السؤال: الباب يتبع الدرس
        for part in [txt[0]] + [" ".join(txt)] if txt and txt[0] else [" ".join(t for t in txt if t)]:
            k = subj1(part)
            if k != "other": return k
        return "other"

    def subj1(t):
        t = norm(t)
        for k, n, rx in SUB:
            if rx.search(t): return k
        for k, rx in EX:
            if rx.search(t): return k
        return "other"

    def diff(kind, q, tr):
        d = {"tf": 1, "mcq": 2, "mc": 2, "fill": 2, "open": 3}.get(kind, 2)
        if len(str(q)) > 140: d += 1
        if tr in ("t3", "t4") and kind in ("mcq", "mc", "open"): d += 1
        if tr == "t1" and d > 1: d -= 1
        return max(1, min(3, d))

    okmap = (J("data/tala-ex-ok.json").get("ok") or {})
    pool = {t: [] for t in ("t1", "t2", "t3", "t4")}   # أسئلة معتمدة لها إجابة (صح/خطأ واختيار) لواجهة «سؤال اليوم»
    lessons = {t: [] for t in ("t1", "t2", "t3", "t4")}  # دروس المنهج مرتبة لـ«القادم لك»
    seenL = set()
    rows = []  # (المصدر، المعرّف، المرحلة، الباب، الصعوبة، معتمد، له إجابة، له مصدر، نص)
    for x in J("data/tala-ex.json")["items"]:
        tr = "t3" if x.get("s") == "bunyan" else "t4" if x.get("s") == "bidaya" else ("t1" if int(x.get("v") or 1) <= 2 else "t2")
        key = "%s:%s:%s" % (x.get("b"), x.get("p"), norm(x.get("q"))[:40])
        ok = bool(x.get("ok")) or bool(okmap.get(key))
        iid = "ex:" + hashlib.md5(("%s|%s|%s" % (x.get("b"), x.get("p"), x.get("q"))).encode()).hexdigest()[:10]
        rows.append(("ex", iid, tr, subj(x.get("l"), x.get("q")), diff(x.get("k"), x.get("q"), tr), ok, x.get("a") not in (None, ""), bool(x.get("b")), norm(x.get("q"))))
        sb, df = rows[-1][3], rows[-1][4]
        lk = (x.get("s"), int(x.get("v") or 1), x.get("b"), int(x.get("lp") or x.get("p") or 1), x.get("l"))
        if lk not in seenL: seenL.add(lk); lessons[tr].append(lk)
        if ok and x.get("k") in ("tf", "mcq") and x.get("a") not in (None, ""):
            it = {"q": x["q"], "k": x["k"], "a": x["a"], "b": x.get("b"), "p": x.get("p"), "l": x.get("l"), "s": sb, "d": df}
            if x.get("o"): it["o"] = x["o"]
            if x.get("why"): it["w"] = x["why"]
            pool[tr].append(it)
    for x in J("data/tala-bank.json")["items"]:
        if x.get("x"): continue
        if x.get("ok") and x.get("t") == "mc" and x.get("a"):
            for t in (x.get("k") or ["t2"]):
                if t in pool: pool[t].append({"q": x["q"], "k": "mcq", "a": 0, "o": [x["a"]] + (x.get("o") or []), "src": (x.get("src") or {}).get("u"), "st": (x.get("src") or {}).get("t"), "s": subj(x.get("q")), "d": 2, "w": x.get("why") or ""})
        for tr in (x.get("k") or ["t2"])[:1]:
            rows.append(("bank", "bank:" + x["id"], tr, subj(x.get("q"), (x.get("src") or {}).get("t")), diff(x.get("t"), x.get("q"), tr), bool(x.get("ok")), bool(x.get("a")), bool(x.get("src")), norm(x.get("q"))))
    # أسئلة دروس «البداية» المعتمدة (st=ok) ← مرحلة ١٥–٢٠ (tools/bidaya.py)
    import glob as _g
    for f in sorted(_g.glob(os.path.join(ROOT, "data", "bidaya", "l", "*.json"))):
        L = J(os.path.relpath(f, ROOT))
        if L.get("st") != "ok": continue
        for i, x in enumerate(L.get("qs") or []):
            if x.get("k") not in ("tf", "mcq") or x.get("a") is None: continue
            sb = {"aqida": "aqida", "tafsir": "quran", "hadith": "hadith", "alam": "sira", "fiqh": "fiqh", "adab": "adab", "manhaj": "other"}.get(L.get("u"), "other")
            rows.append(("bidaya", "bd:%s:%d" % (L["id"], i), "t4", sb, diff(x["k"], x["q"], "t4"), True, True, True, norm(x["q"])))
            it = {"q": x["q"], "k": x["k"], "a": x["a"], "l": L["t"], "s": sb, "d": rows[-1][4], "src": "#/talaea/bidaya?l=" + L["id"], "st": "البداية: " + L["t"]}
            if x.get("o"): it["o"] = x["o"]
            if x.get("w"): it["w"] = re.sub(r"\[\[[^\]]+\]\]", "", x["w"]).strip()
            pool["t4"].append(it)
    for x in J("data/tala-riddles.json")["items"]:
        rows.append(("riddle", "rd:" + x["id"], (x.get("k") or ["t1"])[0], "riddle", 1 if len(x.get("q", "")) < 60 else 2, True, bool(x.get("a")), False, norm(x.get("q"))))

    n = len(rows)
    by_tr, by_sub, by_dif = C.Counter(r[2] for r in rows), C.Counter(r[3] for r in rows), C.Counter(r[4] for r in rows)
    grid = C.Counter((r[2], r[3]) for r in rows)
    dup = sum(c - 1 for c in C.Counter(r[8] for r in rows).values() if c > 1)
    ok = sum(r[5] for r in rows); ans = sum(r[6] for r in rows); src = sum(r[7] for r in rows)
    trs = ["t1", "t2", "t3", "t4", "t5"]; subs = [k for k, _, _ in SUB] + ["kawn", "riddle", "other"]
    gaps = [(t, s) for t in trs[:4] for s in [k for k, _, _ in SUB] if grid[(t, s)] < 10]
    M = {"at": time.strftime("%Y-%m-%d"), "n": n, "approved": ok, "with_answer": ans, "with_source": src, "duplicates": dup,
         "by_track": dict(by_tr), "by_subject": dict(by_sub), "by_difficulty": {str(k): v for k, v in by_dif.items()}, "gaps": len(gaps)}
    out = {"note": "tools/tala-audit.py — تصنيف أسئلة الطلائع بالمرحلة والباب والصعوبة (آلي بقواعد صريحة؛ لا يعدّل المصادر)", "m": M,
           "keys": {"tr": TRN, "sub": dict(SN, riddle="ألغاز", other="غير مصنف")}, "c": {r[1]: [r[2], r[3], r[4]] for r in rows}}
    json.dump(out, open(os.path.join(ROOT, "data", "tala-audit.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    for t in lessons: lessons[t].sort(key=lambda k: (k[0] != "asas", k[1], k[3]))
    json.dump({"note": "tools/tala-audit.py — مجمع «سؤال اليوم» (المعتمد ذو الإجابة) ودروس «القادم لك» لكل مرحلة، لواجهة الطلائع (talahome.js)", "at": M["at"],
               "sub": dict(SN, riddle="ألغاز", other="متنوع"), "pool": pool, "lessons": {t: [{"s": k[0], "v": k[1], "b": k[2], "p": k[3], "l": k[4]} for k in L_] for t, L_ in lessons.items()}},
              open(os.path.join(ROOT, "data", "tala-home.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    pc = lambda a: "%d٪" % round(100 * a / max(1, n))
    L = ["# فحص قسم الطلائع (tools/tala-audit.py)", "", "آخر تشغيل: %s. الأرقام «قبل» التطوير؛ يُعاد التشغيل بعده للمقارنة." % M["at"], "",
         "## المؤشرات العامة", "| المؤشر | القيمة |", "|---|---|",
         "| عدد الأسئلة (تمارين المنهج + البنك + الألغاز) | %d |" % n, "| المعتمد للعرض | %d (%s) |" % (ok, pc(ok)),
         "| له إجابة | %d (%s) |" % (ans, pc(ans)), "| له مصدر (كتاب وصفحة أو مقال) | %d (%s) |" % (src, pc(src)),
         "| مكرر بالنص | %d |" % dup, "| خانات (مرحلة × باب) دون ١٠ أسئلة | %d من %d |" % (len(gaps), 4 * len(SUB)), "",
         "## التوزيع بالمرحلة العمرية", "| المرحلة | السن | الأسئلة |", "|---|---|---|"] + \
        ["| %s | %s | %d |" % (t, TRN[t], by_tr.get(t, 0)) for t in trs] + ["", "## التوزيع بالباب والمرحلة", "| الباب | " + " | ".join(TRN[t] for t in trs) + " | المجموع |", "|---" * (len(trs) + 2) + "|"] + \
        ["| %s | %s | %d |" % (dict(SN, riddle="ألغاز", other="غير مصنف")[s], " | ".join(str(grid[(t, s)]) for t in trs), by_sub.get(s, 0)) for s in subs] + \
        ["", "## التوزيع بالصعوبة", "| الصعوبة | الأسئلة |", "|---|---|"] + ["| %s | %d |" % ({1: "سهل", 2: "متوسط", 3: "متقدم"}[d], by_dif.get(d, 0)) for d in (1, 2, 3)] + \
        ["", "## الفجوات (أقل من ١٠ أسئلة)", ", ".join("%s/%s" % (TRN[t], SN[s]) for t, s in gaps) or "لا فجوات",
         "", "## ملاحظات", "- المرحلة الثانوية (١٥–١٨) بلا تمارين منهجية: «البداية لمن سلك طريق الهداية» لم تُستخرج تمارينه بعد، وما فيها من البنك وحده.",
         "- ١٨–٢٠ سنة (المطلوب حتى سن ٢٠) بلا مسار ولا أسئلة بعد.",
         "- التصنيف بالقواعد تقريبي؛ «غير مصنف» يُراجع يدويًّا أو بمدقق الجودة العلمية."]
    open(os.path.join(ROOT, "tools", "tala-audit.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(json.dumps(M, ensure_ascii=False))


if __name__ == "__main__":
    main()
