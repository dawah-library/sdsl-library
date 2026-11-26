#!/usr/bin/env python3
"""بنك أسئلة الطلائع المتجدد (طلب المدير، ٢١ نوفمبر ٢٠٢٦): تحديث دوري لبنك الأسئلة والألعاب لتجنب التكرار،
وربط المحتوى بالمصادر العلمية الجديدة في الموقع.

- المصادر الجديدة منذ آخر جولة (data/tala-bank.json ← seen): مقالات مكتبة الدعوة وكتبها الموجهة للنشء (قسم «فتية الإسلام»/«شبابنا»،
  كاتب الطلائع، العناوين الموجهة للصغار والطلاب والفتيات)، ومواد الموسوعات المعتمدة (العقيدة، الآداب، التربية، التاريخ والسيرة)،
  وقصص الطلائع (data/tala-qasas.json).
- لكل مصدر: أسئلة اختيار من متعدد (mc) وصح أو خطأ (tf) لمرحلة أو أكثر (t1–t4) ولقسم (b/g) أو للجميع، بعبارة تناسب السن،
  مع "ev" عبارة الدليل منسوخة بحروفها من المصدر؛ ويُرفض السؤال الذي لا يوجد دليله في نصه، أو جوابه ليس بين خياراته، أو خياراته مكررة.
- كل سؤال جديد مسودة (ok=0) حتى تعتمده الإدارة من «الإدارة ← الطلائع ← بنك الأسئلة»؛ ثم تسحب الألعاب منه ما لم يره الطفل.
- المحرك: tashjir.gemini (مفاتيح خدمات الكتب موزَّعة بـ gkeys.Pool). الحد: TB_MAX مصدرًا في الجولة (الافتراضي ١٢).
الاستعمال: python3 tools/tala-bank.py [--max N]"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("tala_bank")  # يدوي فقط
import datetime, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "tala-bank.json")
import tashjir as T  # noqa: E402
import time  # noqa: E402
T0 = time.time(); MIN = float(os.environ.get("TB_MINUTES", "45"))
T.DEADLINE[0] = T0 + (MIN - 20) * 60  # tashjir.gemini يتوقف عند DEADLINE + ٢٠ دقيقة: فيبقى وقت للحفظ قبل مهلة المهمة

jl = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
DIA = re.compile(r"[ً-ْٰـ]")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", re.sub(r"[^ء-ي0-9 ]", " ", s)).strip()

KID = re.compile(r"للأطفال|للصغار|يا صغيري|حكاية|قصة|قصص|فتية|الفتيان|الناشئ|الطلاب|طالب|المذاكرة|الامتحان|تحت العشرين|الطلائع|يا بني|الشباب|شبابنا|أختي|الفتاة|الفتيات")
ADULT = re.compile(r"قانون|الزنا|لوط|الفاحشة|حزب|انتخاب|البرلمان|التكفير|النسوية|بيان|محاكمة|الشذوذ|الطلاق|الزواج العرفي|جرائم")
GIRL = re.compile(r"أختي|الفتاة|الفتيات|بنتي|ابنتي|للفتيات|يا فتاة")
MW_OK = ("aqeeda", "adab", "tarbiya", "tarikh", "quran", "tafsir")

PROMPT = """أنت معلّم مسلم متخصص في تربية النشء، تعدّ أسئلة مسابقات تعليمية ممتعة لقسم «طلائع الدعوة السلفية» من النص الآتي وحده.
المصدر: «{title}»{au}. المراحل: t1 (٥–٨ سنوات)، t2 (٩–١٢)، t3 (١٢–١٥)، t4 (١٥–٢٠).
أعدّ حتى {n} أسئلة متنوعة (اختيار من متعدد "mc" بثلاثة خيارات خاطئة معقولة، و"tf" صح أو خطأ)، بعبارة قصيرة واضحة تناسب السن، تقيس فهم معنى نافع
(عقيدة، عبادة، خلق، سيرة، قرآن، لغة) لا حفظ أرقام الصفحات ولا أسماء الكتب. التزم ما في النص ولا تضف معلومة من خارجه.
لكل سؤال:
- "k": المراحل المناسبة (مثل ["t2","t3"])، و"g": "b" أو "g" إن كان خاصًا بالبنين أو البنات، وإلا "".
- "ev": عبارة الدليل (٥–٢٠ كلمة) منسوخة بحروفها من النص.
- "why": تعليل قصير مشجع (أقل من ٢٥ كلمة).
أخرج JSON: {{"items": [{{"t": "mc", "q": "السؤال؟", "a": "الجواب الصحيح", "o": ["خطأ١", "خطأ٢", "خطأ٣"], "k": ["t2"], "g": "", "ev": "…", "why": "…"}}, {{"t": "tf", "q": "عبارة", "v": true, "k": ["t1","t2"], "g": "", "ev": "…", "why": "…"}}]}}
لا تُدخل ما يخص الكبار (السياسة، الخلافات، أحكام النكاح والطلاق). إن لم يصلح النص لأسئلة الأطفال فأعد قائمة فارغة.

النص:
{text}"""


def sources(cat, seen):
    """المصادر الجديدة غير المقروءة: (معرّف، عنوان، مؤلف، نص، رابط، g)."""
    au = {a["id"]: a.get("name", "") for a in cat["authors"]}; out = []
    ix = (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", []); grp = {}
    for a in sorted(ix, key=lambda x: x.get("d") or x.get("ad") or "", reverse=True):
        if a["id"] in seen or a.get("col") in ("turath", "ithra") or not a.get("f") or a.get("fa") or a.get("h"): continue
        t = a.get("t") or ""
        if ADULT.search(t) or not (KID.search(t) or a.get("tp") in ("st7", "at9") or a.get("a") == "w5"): continue
        if a["f"] not in grp: grp[a["f"]] = jl(os.path.join(D, "articles", a["f"] + ".json"), {}) or {}
        txt = "\n".join(re.split(r"^\s*_{4,}\s*$", p or "", flags=re.M)[0] for p in (grp[a["f"]].get(a["id"]) or {}).get("pages") or [])
        if len(txt) > 600: out.append((a["id"], t, au.get(a.get("a"), ""), txt[:14000], "#/book/%s/1" % a["id"], "g" if GIRL.search(t) else ""))
    for k in MW_OK:
        for f in sorted((os.listdir(os.path.join(D, "mawsua", k, "e")) if os.path.isdir(os.path.join(D, "mawsua", k, "e")) else [])):
            if not f.endswith(".json") or f.endswith(".new.json"): continue
            e = jl(os.path.join(D, "mawsua", k, "e", f), {}) or {}; sid = "mw:" + k + ":" + e.get("id", f[:-5])
            if not e.get("ok") or sid in seen: continue
            txt = (e.get("lead") or "") + "\n" + "\n".join(p.get("t", "") for s in e.get("s") or [] for p in s.get("p") or [])
            if len(txt) > 400: out.append((sid, e.get("t", ""), "الموسوعات العلمية", txt[:10000], "#/mawsua/%s/%s" % (k, e.get("id", "")), ""))
    Q = jl(os.path.join(D, "tala-qasas.json"), {}) or {}
    for x in Q.get("items") or []:
        sid = "qs:" + x.get("id", "")
        if sid in seen: continue
        txt = "\n".join("[%s]\n%s" % (k, v) for k, v in (x.get("s") or {}).items())
        if len(txt) > 300: out.append((sid, x.get("n", ""), "قصص الطلائع", txt[:12000], "#/talaea/qasas?id=%s" % x.get("id", ""), "g" if x.get("g") == "g" else ""))
    return out


def valid(it, txt):
    n = nz(txt); ev = nz(it.get("ev") or "")
    if len(ev.split()) < 4 or ev not in n: return "الدليل ليس في النص"
    q = (it.get("q") or "").strip()
    if len(q) < 8 or re.search(r"الصفحة|الكتاب|المؤلف|النص المذكور|المقال", q): return "سؤال عن المصدر لا المعنى"
    k = [x for x in it.get("k") or [] if x in ("t1", "t2", "t3", "t4")]
    if not k: return "بلا مرحلة"
    if it.get("t") == "mc":
        a, o = (it.get("a") or "").strip(), [str(x).strip() for x in it.get("o") or [] if str(x).strip()]
        if not a or len(o) < 2 or a in o or len(set(nz(x) for x in o + [a])) < len(o) + 1: return "خيارات غير صالحة"
    elif it.get("t") == "tf":
        if not isinstance(it.get("v"), bool): return "صح أو خطأ بلا قيمة"
    else: return "نوع غير معروف"
    return None


def main():
    mx = int(os.environ.get("TB_MAX", "12"))
    if "--max" in sys.argv: mx = int(sys.argv[sys.argv.index("--max") + 1])
    cat = jl(os.path.join(D, "catalog.json"))
    B = jl(OUT, {"note": "", "items": [], "seen": []}) or {"items": [], "seen": []}
    B["note"] = "بنك أسئلة الطلائع المتجدد (tools/tala-bank.py): مسودات ok=0 حتى تعتمدها الإدارة؛ x=1 مخفي."
    seen = set(B.get("seen") or []); have = {x["id"] for x in B["items"]}
    src = sources(cat, seen); print("مصادر جديدة:", len(src), flush=True)
    added, rej, done = 0, {}, 0
    def save():
        B["seen"] = sorted(seen); B["upd"] = str(datetime.date.today())
        json.dump(B, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    for sid, title, au, txt, link, g0 in src[:mx]:
        if time.time() - T0 > (MIN - 8) * 60: break  # المهلة: يُحفظ ما أُنجز، والباقي للجولة القادمة
        r = T.gemini(PROMPT.format(title=title, au=("، " + au) if au else "", n=8, text=txt))
        if r is None: break  # نفدت الحصة: يبقى المصدر للجولة القادمة
        done += 1; seen.add(sid)
        for it in (r or {}).get("items") or []:
            why = valid(it, txt)
            if why: rej[why] = rej.get(why, 0) + 1; continue
            iid = hashlib.md5((sid + it["q"]).encode()).hexdigest()[:10]
            if iid in have: continue
            x = {"id": iid, "t": it["t"], "q": it["q"].strip(), "k": [k for k in it["k"] if k in ("t1", "t2", "t3", "t4")], "g": it.get("g") if it.get("g") in ("b", "g") else g0,
                 "ev": it["ev"].strip(), "why": (it.get("why") or "").strip()[:200], "src": {"id": sid, "t": title, "u": link}, "at": str(datetime.date.today()), "ok": 0}
            if it["t"] == "mc": x["a"] = it["a"].strip(); x["o"] = [str(o).strip() for o in it["o"]][:3]
            else: x["v"] = bool(it["v"])
            B["items"].append(x); have.add(iid); added += 1
        save()  # بعد كل مصدر: لا يضيع المنجز إن انتهت المهلة أو تعثر الخادم
    save()
    msg = "🌟 <b>بنك أسئلة الطلائع</b>: قُرئ %d مصدرًا جديدًا (من %d)، وأضيف %d سؤالًا مسودة للاعتماد%s. المعتمد %d، والمسودات %d." % (
        done, len(src), added, (" (رُفض %s)" % "، ".join("%s %d" % kv for kv in rej.items())) if rej else "", sum(1 for x in B["items"] if x.get("ok")), sum(1 for x in B["items"] if not x.get("ok") and not x.get("x")))
    print(msg); open(os.path.join(ROOT, ".tb-report.txt"), "w", encoding="utf-8").write(msg)


if __name__ == "__main__":
    main()
