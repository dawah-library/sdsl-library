#!/usr/bin/env python3
"""ملف «كتاب الأسبوع» (طلب المدير، ٢٠ نوفمبر ٢٠٢٦): استعراض شامل للكتاب في #/weekly —
تعريف موجز، وتعريف شامل، وأبرز الأفكار بصفحاتها، ودراسة وتحليل (الأهمية، المنهج، البناء، المميزات، القارئ المستهدف،
طريقة القراءة)، وأسئلة للتأمل، وأقوال مختارة من الكتاب بنصها. المصدر: نص الكتاب نفسه (مطالع الفصول وفهرسه)،
وخلاصة فصوله إن وُجدت (data/summ)، وبطاقة الكتاب في الفهرس.
- الأقوال المختارة تُقبل فقط إن وُجدت بحروفها في الصفحة المذكورة (لا نص منسوب لم يُتحقق منه)، والصفحات تُحصر في حدود الكتاب.
- المخرج: data/weekly/<id>.json (st=draft حتى تعتمده الإدارة مع السلسلة؛ يُعرض للإدارة قبل الاعتماد).
- الاستعمال: python3 tools/weekly-dossier.py [معرّف…] [--next] [--force]
  بلا معرّف: كتب السلسلة كلها التي لا ملف لها؛ --next: الأسبوع الحالي والقادم وحدهما؛ --force: إعادة البناء.
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("weekly")  # يدوي فقط
import datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "weekly")
import tashjir as T  # noqa: E402  محرك Gemini بمفاتيح خدمات الكتب
jl = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
DIA = re.compile(r"[ً-ْٰـ]")
nz = lambda s: re.sub(r"\s+", " ", re.sub("[أإآٱ]", "ا", DIA.sub("", s or "")).replace("ى", "ي").replace("ة", "ه")).strip()

PROMPT = """أنت باحث شرعي متخصص يعدّ «ملف كتاب الأسبوع» في مكتبة الدعوة السلفية الرقمية: استعراض علمي شامل جذاب محفز على قراءة الكتاب،
بأسلوب عربي رصين واضح، أمين لما في الكتاب نفسه، بلا مبالغة ولا مدح عام ولا معلومات من خارجه (لا تذكر تاريخ تأليف أو طبعات أو أخبارًا عن المؤلف لم ترد في النص).
الكتاب: «{title}» — {author}. عدد صفحاته {n}.
{card}
فهرس الكتاب (العنوان ← الصفحة):
{toc}
{summ}
مقتطفات من نص الكتاب، كل مقطع يبدأ بعلامة [ص N]:
{text}

أخرج JSON حرفيًا بهذه البنية:
{{"brief": "تعريف موجز في جملتين أو ثلاث: ما الكتاب وما غايته ولمن",
 "about": ["التعريف الشامل في ٣–٤ فقرات: موضوع الكتاب وقضيته، وكيف عالجها المؤلف، وأهم ما انتهى إليه، وصلته بحاجة القارئ اليوم"],
 "ideas": [{{"t": "عنوان الفكرة في ٣–٨ كلمات", "d": "شرحها في جملتين أو ثلاث كما قررها المؤلف", "p": رقم الصفحة}}],
 "study": {{"importance": "أهمية الكتاب وقيمته العلمية (فقرة)", "method": "منهج المؤلف وأسلوبه في العرض والاستدلال (فقرة)",
   "structure": "بناء الكتاب وتقسيمه وتسلسل أبوابه (فقرة)", "features": ["ميزة", "…"], "audience": "لمن يُقرأ ومستواه",
   "tips": ["توجيه عملي لقراءته والانتفاع به", "…"]}},
 "quotes": [{{"t": "جملة مؤثرة منسوخة بحروفها من المقتطفات (١٥–٤٥ كلمة)", "p": رقم صفحتها}}],
 "questions": ["سؤال تأملي يثير الرغبة في القراءة ويجيب عنه الكتاب", "…"],
 "hook": "عبارة دعوة قصيرة محفزة (سطر واحد) لقراءة الكتاب هذا الأسبوع"}}
الأفكار من ٦ إلى ١٠ مرتبة بترتيب الكتاب، والمميزات ٣–٦، والتوجيهات ٣–٥، والأقوال ٤–٦، والأسئلة ٣–٥.
أرقام الصفحات من علامات [ص N] أو الفهرس فقط."""


def body(pg):
    return re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0].strip()


def sample(pages, toc, lim=60000):
    """مطالع الفصول (نحو ١٥٠٠ حرف من كل فصل) ثم صفحات موزعة على الكتاب حتى الحد."""
    starts = sorted({t["p"] for t in toc if t.get("p") and 1 <= t["p"] <= len(pages)}) or list(range(1, len(pages) + 1, max(1, len(pages) // 30)))
    per = max(900, min(3000, lim // max(1, len(starts)))); out, n = [], 0
    for p in starts:
        t = body(pages[p - 1])[:per]
        if len(t) < 60: continue
        out.append("[ص %d]\n%s" % (p, t)); n += len(t)
        if n > lim: break
    return "\n\n".join(out)


def build(b, A, force=False):
    op = os.path.join(OUT, b["id"] + ".json")
    if os.path.exists(op) and not force: print("  موجود:", b["id"]); return None
    sh = jl(os.path.join(D, "books", b["id"] + ".json"))
    if not sh or not sh.get("pages"): print("  لا نص:", b["id"]); return None
    pages, toc = sh["pages"], [t for t in (sh.get("toc") or []) if t.get("p")]
    su = jl(os.path.join(D, "summ", b["id"] + ".json"), {}) or {}
    card = b.get("card") or {}
    cardt = ("بطاقة الكتاب: " + card.get("summary", "") + (" الأقسام: " + "، ".join(card.get("parts") or []) if card.get("parts") else "")) if card else ""
    summ = ("خلاصة الفصول:\n" + "\n".join("- %s (ص %s): %s" % (c.get("t", ""), (c.get("p") or [""])[0], c.get("k", "")) for c in (su.get("chs") or [])[:60])) if su.get("chs") else ""
    tocs = "\n".join("%s%s ← %d" % ("  " * max(0, (t.get("l") or 1) - 1), t.get("t", "")[:90], t["p"]) for t in toc[:160]) or "(لا فهرس)"
    author = A.get(b.get("authorId"), {}).get("name", "")
    r = T.gemini(PROMPT.format(title=b["title"], author=author, n=len(pages), card=cardt, toc=tocs, summ=summ, text=sample(pages, toc)))
    if not r or not r.get("brief"): print("  تعذر التوليد:", b["id"]); return None
    n = len(pages); okp = lambda p: isinstance(p, int) and 1 <= p <= n
    r["ideas"] = [x for x in (r.get("ideas") or []) if x.get("t") and x.get("d")][:10]
    for x in r["ideas"]:
        if not okp(x.get("p")): x.pop("p", None)
    # الأقوال: لا يُقبل إلا ما وُجد بحروفه (بعد إزالة التشكيل) في صفحته أو ما يجاورها
    qs = []
    for q in r.get("quotes") or []:
        t, p = (q.get("t") or "").strip(" «»\"'"), q.get("p")
        if not t or not okp(p): continue
        hit = next((k for k in (p, p - 1, p + 1) if 1 <= k <= n and nz(t) in nz(body(pages[k - 1]))), None)
        if hit: qs.append({"t": t, "p": hit})
    r["quotes"] = qs[:6]
    r.update({"id": b["id"], "t": b["title"], "a": author, "n": n, "built": str(datetime.date.today()), "model": "gemini"})
    os.makedirs(OUT, exist_ok=True)
    json.dump(r, open(op, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("  ✓", b["id"], "أفكار", len(r["ideas"]), "أقوال متحقق منها", len(qs))
    return r


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]; force = "--force" in sys.argv
    cat = jl(os.path.join(D, "catalog.json")); A = {a["id"]: a for a in cat["authors"]}; BK = {b["id"]: b for b in cat["books"]}
    W = jl(os.path.join(D, "weekly.json"), {}) or {}; weeks = W.get("weeks") or []
    if not args:
        t = str(datetime.date.today()); args = [w["b"] for w in weeks]
        if "--next" in sys.argv:
            cur = [w for w in weeks if w["from"] <= t]; i = weeks.index(cur[-1]) if cur else -1
            args = [w["b"] for w in weeks[max(0, i):i + 2]]
    done = 0
    for bid in args:
        if bid in BK and build(BK[bid], A, force): done += 1
    print("بُني %d ملفًا" % done)


if __name__ == "__main__":
    main()
