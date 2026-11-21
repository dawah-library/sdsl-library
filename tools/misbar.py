#!/usr/bin/env python3
"""«المِسبار»: مقياس مستواك في العلوم الشرعية (طلب المدير، ٢٠ نوفمبر ٢٠٢٦) — لكل قسم من أقسام الموسوعات العلمية ثلاثة اختبارات
متدرجة (مبتدئ، متوسط، متقدم)، تُتخطى بالنجاح في ٧٠٪ فأكثر، ويُعاد الاختبار إن قل عن ذلك، ومع كل جواب «تثقّف أكثر»: مصدره في المكتبة
ومسألته في الموسوعة.

بنك الأسئلة: من مواضع كل مسألة في مخطط الموسوعة (data/mawsua/<k>/_tree.json) — كلام مشايخ الدعوة أولًا ثم المراجع —
بأسئلة عامة في العلم نفسه (لا «ماذا قال المؤلف في كتابه»)، اختيار من أربعة، مع التعليل والمستوى والمصدر.
تُرفض الأسئلة التي ليس جوابها بين خياراتها، أو المكررة، أو المحالة إلى «الكتاب/النص/المؤلف»، أو بلا مصدر من المواضع المرسلة.
المخرج: data/misbar/<k>.json (ok=0 حتى تعتمد الإدارة البنك من #/misbar؛ ولها إخفاء أي سؤال)، وdata/misbar/_index.json.
الطابور: data/misbar/_queue.json {"items": [{"k": "aqeeda", "n": 60}]}؛ والقسم بلا مخطط يبقى في الطابور حتى يُعد مخططه.
"""
import datetime, hashlib, importlib.util, json, os, random, re, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
spec = importlib.util.spec_from_file_location("mawsua", os.path.join(HERE, "mawsua.py")); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
OUT = os.path.join(M.D, "misbar"); jl, jw, nz = M.jl, M.jw, M.nz
LV = {1: "مبتدئ", 2: "متوسط", 3: "متقدم"}

PROMPT = """أنت لجنة اختبارات علمية تعد أسئلة «المِسبار» لقياس مستوى طالب العلم في «{name}».
لكل مسألة أدناه مواضع من كتب مشايخ الدعوة السلفية ومقالاتهم (د…) ومن المراجع العلمية (م…). اكتب لكل مسألة سؤالين من نوع الاختيار من أربعة:
- السؤال عام في العلم نفسه يفهمه من لم يقرأ المصدر؛ لا تقل «في الكتاب» ولا «ذكر المؤلف» ولا «حسب النص».
- الجواب الصحيح مقرر صراحة في المواضع، والخيارات الثلاثة الأخرى خاطئة يقينًا ومعقولة الشكل، متقاربة الطول.
- "l": المستوى ١ مبتدئ (التعريفات والمسلّمات)، ٢ متوسط (التفصيل والأدلة والفروق)، ٣ متقدم (الضوابط والخلاف المعتبر والتطبيق)؛ نوّع المستويات.
- "e": تعليل الجواب في سطر أو سطرين من المواضع، و"c": رمز الموضع الذي يقرره.
أخرج JSON: {{"r": [{{"m": "رقم المسألة", "l": 1, "q": "…", "o": ["…", "…", "…", "…"], "a": "نص الخيار الصحيح كما هو", "e": "…", "c": "د1"}}]}}

{blocks}"""


def gen(e, n=60):
    k = e[0]; tree = jl(os.path.join(M.OUT, k, "_tree.json"))
    if not tree: print("  لا مخطط بعد:", k); return 0, True
    bp = os.path.join(OUT, k + ".json"); bank = jl(bp, {"k": k, "n": e[1], "ok": 0, "qs": []}) or {}
    have = {nz(q["q"]) for q in bank.get("qs", [])}; used = {q.get("m") for q in bank.get("qs", [])}
    ms = [m for b in tree["b"] for f in b["f"] for m in f["m"] if m["id"] not in used]
    random.seed(k + str(len(bank.get("qs", [])))); random.shuffle(ms)
    if not ms: print("  اكتمل بنك", k); return 0, False
    C = M.corpus(e); added = 0; r = {}
    while ms and added < n and time.time() - M.T0 < M.LIMIT:
        batch, ms = ms[:5], ms[5:]; tags, blocks, owner = {}, [], {}
        for i, m in enumerate(batch, 1):
            hits = M.find(C, m)[:3]
            if not hits: continue
            lines = []
            for h in hits:
                tg = ("د" if h[0] == "d" else "م") + str(1 + sum(1 for x in tags.values() if x[0] == h[0]))
                tags[tg] = h; owner[tg] = m; lines.append("[%s] «%s»، ص %d:\n%s" % (tg, h[2], h[4], M.window(h, m, 900)))
            blocks.append("المسألة %d: %s\n%s" % (i, m["t"], "\n".join(lines)))
        if not blocks: continue
        r = M.T.gemini(PROMPT.format(name=e[1], blocks="\n\n".join(blocks)))
        if not r: break
        for x in r.get("r") or []:
            q, o, a, c = (x.get("q") or "").strip(), [str(y).strip() for y in (x.get("o") or [])], str(x.get("a") or "").strip(), x.get("c")
            random.shuffle(o)  # لا يستقر الجواب الصحيح في موضع واحد
            if not q or len(o) != 4 or a not in o or len(set(o)) != 4 or c not in tags or nz(q) in have: continue
            if re.search(r"(في|حسب|ذكر|يرى) (هذا )?(الكتاب|النص|المؤلف|الكاتب|المقال|الموضع)", q): continue
            h, m = tags[c], owner[c]; have.add(nz(q))
            bank.setdefault("qs", []).append({"id": hashlib.md5(q.encode()).hexdigest()[:8], "l": max(1, min(3, int(x.get("l") or 1))), "q": q, "o": o, "a": a, "e": (x.get("e") or "").strip(),
                                              "m": m["id"], "mt": m["t"], "s": {"b": h[1], "p": h[4], "t": h[2], "a": h[3]}})
            added += 1
        bank.update({"k": k, "n": e[1], "upd": str(datetime.date.today()), "ok": 1, "auto": 1}); jw(bp, bank)  # اعتماد ونشر تلقائيان (طلب المدير، ٢١ نوفمبر)؛ وللإدارة إخفاء أي سؤال
        print("  %s: +%d (المجموع %d)" % (k, added, len(bank["qs"])), flush=True)
    return added, bool(ms) or added < n and r is None  # بقيت مسائل أو نفدت الحصة


def index():
    items = []
    for e in M.ENC:
        b = jl(os.path.join(OUT, e[0] + ".json"), {}) or {}; qs = [q for q in b.get("qs", []) if not q.get("x")]
        items.append({"k": e[0], "n": e[1], "ic": e[3], "d": e[2], "ok": b.get("ok", 0), "c": {str(l): sum(1 for q in qs if q["l"] == l) for l in (1, 2, 3)}})
    jw(os.path.join(OUT, "_index.json"), {"note": "tools/misbar.py — المِسبار", "pass": 70, "per": 10, "items": items})


def main():
    E = {e[0]: e for e in M.ENC}; a = sys.argv[1:]
    if a and a[0] in E: gen(E[a[0]], int(a[1]) if len(a) > 1 else 60)
    else:
        qp = os.path.join(OUT, "_queue.json"); Q = jl(qp, {"items": []}) or {"items": []}; rest = []
        for it in Q.get("items", []):
            e = E.get(it.get("k")); n = int(it.get("n") or 60)
            if not e: continue
            if time.time() - M.T0 > M.LIMIT: rest.append(it); continue
            d, more = gen(e, n)
            if d < n and more: rest.append(dict(it, n=n - d))
        jw(qp, {"items": rest})
    index()


if __name__ == "__main__":
    main()
