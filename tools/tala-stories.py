#!/usr/bin/env python3
"""قصص الشخصيات الإسلامية الملهمة لقسم الطلائع (للطلاب والطالبات): من مقالات مشايخ الدعوة في المكتبة نفسها.

يختار المقالات التي موضوعها شخصية (صحابي أو صحابية أو تابعي أو عالم أو بطل) من أقسام: من تراجم السلف، وفتية الإسلام،
والسيرة والتاريخ، وأطفالنا، وغيرها، بعناوين تدل على الشخصية («من أبطال الإسلام»، «أعلام في زمن الصبا»، «رضي الله عنه/عنها»،
وأسماء الصحابة والصحابيات المشهورين)، ويستبعد المقالات السياسية. لكل قصة: الشخصية، والعنوان، ومقتطف من نص المقال نفسه
(أول فقرتين، بلا تعديل)، والمراحل المناسبة، وللطالبات (g) إن كانت الشخصية امرأة.
الناتج: data/tala-stories.json — يقرؤه tala.js («قصة اليوم» في بطاقة الطفل اليومية).
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOMEN = ["خديجة", "عائشة", "فاطمة", "أسماء بنت", "سمية", "أم سليم", "نسيبة", "أم عمارة", "الخنساء", "حفصة", "زينب", "أم سلمة", "صفية", "أم حرام", "الشفاء", "رملة", "أم حبيبة", "ميمونة", "جويرية", "سودة", "أم أيمن", "أم الفضل", "أم المؤمنين", "الصحابية", "-رضي الله عنها-", "مريم ابنة", "آسية", "هاجر", "أم موسى"]
MEN = ["أبو بكر", "الصديق", "عمر بن", "الفاروق", "عثمان بن عفان", "علي بن أبي طالب", "خالد بن الوليد", "سعد بن", "أبو عبيدة", "الزبير", "طلحة", "بلال", "مصعب", "عبد الله بن", "معاذ", "أنس بن", "أبو هريرة", "البراء", "حمزة", "جعفر", "أسامة", "زيد بن", "سلمان", "أبو ذر", "حذيفة", "عمرو بن", "معاوية", "النعمان", "المثنى", "هاشم بن", "القعقاع", "صلاح الدين", "نور الدين", "عماد الدين", "عمر بن عبد العزيز", "أويس", "طاوس", "الربيع بن", "سعيد بن", "الحسن البصري", "أحمد بن حنبل", "الإمام أحمد", "شيخ الإسلام", "ابن تيمية", "الشافعي", "مالك بن", "البخاري", "-رضي الله عنه-", "الصحابي", "أبطال الإسلام", "أعلام في زمن الصبا", "الأمين", "الغلام", "الفتى"]
BAD = re.compile(r"مقتل|استشهاد|ذاكرة التاريخ|قتال|معركة الجمل|صفين|الخوارج|البيعة|جهود|إسرائيل|فلسطين|الصليبي|الفاطمية|الشيعي|انتخاب|حزب|الحرب|العدوان|سقوط|ثورة|فتنة|مناقشة|شبهة|الرد على|ميزان")
CATS = {"من تراجم السلف", "فتية الإسلام", "السيرة والتاريخ", "أطفالنا", "شبابنا", "من نور الوحيين", "التزكية", "مع الدعاة", "القسم الأدبي"}


def excerpt(pages):
    t = re.sub(r"<[^>]+>", " ", "\n".join(pages or []))
    paras = [p.strip() for p in t.split("\n") if len(p.strip()) > 60 and not re.match(r"^(الحمد لله|بسم الله)", p.strip())]
    s = " ".join(paras[:2])
    return (s[:420].rsplit(" ", 1)[0] + "…") if len(s) > 420 else s


VOLC = {}
KEY = re.compile(r"(?<![\u0621-\u064A])(أحد السابقين|أحد العشرة|من السابقين|أسلم|شهد بدرا|شهد بدرًا|كان من|كان |هاجر|صاحب رسول الله|الإمام|أم المؤمنين|حب رسول الله|فقيه|سيد|أمين هذه الأمة|خليفة رسول الله|حواري)")
def virtue(h):
    """من صفحة الترجمة نفسها في «السير»: ما بعد النسب، أول جملة تذكر الفضل (أحد السابقين، أسلم، شهد بدرًا…)، بنصها."""
    b = str(h.get("b")); fp = os.path.join(ROOT, "vols", b + ".json")
    if b not in VOLC:
        try: VOLC[b] = json.load(open(fp, encoding="utf-8"))["pages"]
        except Exception: VOLC[b] = None
    P = VOLC[b]
    if not P: return ""
    i = max(0, int(h["p"]) - 1); t = re.sub(r"\s+", " ", " ".join(P[i:i + 2]))
    k = t.find(h["n"][:18]); t = t[k:] if k >= 0 else t
    t = re.sub(r"^#\s*", "", t)
    m = KEY.search(t, 20)
    if not m or m.start() > 700: return ""
    s = t[m.start():m.start() + 420]
    s = re.split(r"\s_{4,}|\(\d+\)\s*_", s)[0]
    return (s.rsplit(" ", 1)[0] + "…") if len(s) >= 420 else s


STORY_RX = re.compile(r"قصص|قصة|حكاي|للأطفال|للصغار|للناشئة|للفتيان|مغامر|الأذكياء|الفرج بعد الشدة|حياة الصحابة|رجال حول الرسول|صور من حياة|أبطال")
SAFE_TURATH = {"qisasanbiya", "adhkiya"}
KIDBAD = re.compile(r"قبر|ضريح|مشهد|سجن|حبس|قتل|دم |دمه|خمر|عشق|غناء|جارية|جواري|سحر|كاهن|منام|رؤيا|الحجاج|صلب|زنا|فاحشة")
ISNAD = re.compile(r"^(?:[\d٠-٩:\s\-–.]+)?(?:(?:و?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|قال|عن|سمعت)\b[^،:«\u0022]{0,80}[،:]\s*){1,12})")
def ready(b):  # لا يُبنى على نص لم يكتمل تدقيقه (دليل المعايير)
    return not b.get("ocr") or (b.get("unrev") or 0) + (b.get("lite") or 0) + (b.get("unc") or 0) == 0
def book_stories():
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8")); res = []; seen = set()
    for b in cat["books"]:
        k = b.get("set") or b["id"]; t = b.get("setTitle") or b["title"]
        tala = [x[5:] for x in b.get("tags", []) if x.startswith("tala:")]
        if b.get("hidden") or b.get("demo") or (b.get("type") or "book") != "book" or not (STORY_RX.search(t) or "story" in b.get("tags", [])) or not ready(b): continue  # علامة الطلائع وحدها لا تجعل الكتاب قصصًا
        # من المكتبة العامة: كتب القصص الموثوقة وحدها (بعض كتب الأخبار فيها ما لا يناسب الأطفال)؛ وكتب الدعوة المرفوعة كلها
        if (b.get("col") or "dawah") == "turath" and k not in SAFE_TURATH and "story" not in b.get("tags", []): continue
        fp = os.path.join(ROOT, "data", "books", b["id"] + ".json")
        if not os.path.exists(fp): fp = os.path.join(ROOT, "vols", b["id"] + ".json")
        try: sh = json.load(open(fp, encoding="utf-8"))
        except Exception: continue
        pages = sh.get("pages") or []; n = 0
        for e in sh.get("toc") or []:
            h = re.sub(r"\s+", " ", e.get("t") or "").strip(" :"); p_ = int(e.get("p") or 0)
            if len(h.split()) < 3 or re.fullmatch(r"[\d٠-٩\s\-–.()]+", h) or not (0 < p_ <= len(pages)) or (b["id"], p_) in seen or BAD.search(h): continue
            if re.search(r"تراجم أبواب|مقدمة|الفهرس|فهرس|خاتمة الكتاب|المصادر", h): continue
            seen.add((b["id"], p_))
            lines = re.sub(r"^#+\s*", "", pages[p_ - 1], flags=re.M).split("\n"); key = re.sub(r"^[\d٠-٩\s\-–.:]+", "", h)[:15]
            j = next((i for i, x in enumerate(lines) if key and key in x), -1); body = "\n".join(lines[j + 1:] if j >= 0 else lines)  # ما بعد سطر العنوان
            body = re.split(r"^\s*_{4,}\s*$", body, flags=re.M)[0]
            ex = " ".join(x.strip() for x in body.split("\n") if len(x.strip()) > 30)
            ex = ISNAD.sub("", ex).lstrip(" :،-")[:420]  # الأسانيد تُحذف من المقتطف (والنص كاملًا في موضعه)
            if len(ex) < 120 or KIDBAD.search(h + " " + ex) or len(re.findall(r"الباب|الفصل", ex)) >= 3: continue  # لا صفحات فهارس
            h = re.sub(r"^[\d٠-٩\s\-–.:]+", "", h)
            res.append({"id": "%s:%d" % (b["id"], p_), "b": b["id"], "p": p_, "t": h + " — من «" + t + "»", "who": h, "g": "g" if any(w in h for w in WOMEN) else "", "st": tala or ["t3", "t4"], "ex": ex.rsplit(" ", 1)[0] + "…", "a": b.get("authorId")})
            n += 1
            if n >= 80: break
    return res


def main():
    idx = json.load(open(os.path.join(ROOT, "data", "articles", "index.json"), encoding="utf-8"))["items"]
    want = {}
    for i in idx:
        c, t = (i.get("c") or "").split(" › ")[-1], i.get("t") or ""
        if i.get("fa") or i.get("col") == "ithra" or c not in CATS or BAD.search(t): continue
        has = lambda n: re.search(r"(?<![\u0621-\u064A])" + re.escape(n) + r"(?![\u0621-\u064A])", t) and not re.search(r"سورة " + re.escape(n), t)
        w = next((n for n in WOMEN if has(n)), None); m = None if w else next((n for n in MEN if has(n)), None)
        if not (w or m): continue
        want.setdefault(i.get("f") or "undated", []).append((i, "g" if w else "", w or m))
    out = []
    for f, rows in want.items():
        p = os.path.join(ROOT, "data", "articles", f + ".json")
        if not os.path.exists(p): continue
        D = json.load(open(p, encoding="utf-8"))
        for i, g, who in rows:
            x = D.get(i["id"]) or {}; ex = excerpt(x.get("pages"))
            if len(ex) < 120: continue
            kids = (i.get("c") or "").endswith(("فتية الإسلام", "أطفالنا")) or re.search(r"أعلام في زمن الصبا|الأمين|الغلام|الفتى|أبطال", i["t"])
            out.append({"id": i["id"], "t": i["t"], "who": who, "g": g, "st": ["t2", "t3", "t4"] if kids else ["t3", "t4"], "ex": ex, "a": i.get("a")})
    # قصص من كتب القصص في المكتبة (المعلّمة tala:… أو ما يدل عنوانه على القصص) بعد اكتمال تدقيقها: كل عنوان في فهرسها قصة
    out += book_stories()
    out.sort(key=lambda x: x["t"])
    # شخصيات من «سير أعلام النبلاء» للذهبي في المكتبة (الصحابة والصحابيات المشهورون): أول الترجمة بنصها ورابط موضعها
    import glob
    A = []
    for fp in glob.glob(os.path.join(ROOT, "data", "a3lam", "c*.json")): A += json.load(open(fp, encoding="utf-8"))
    FIG = [("أسماء بنت أبي بكر", "g"), ("أم سليم", "g"), ("أم عمارة نسيبة", "g"), ("أم سلمة أم المؤمنين", "g"), ("أم حرام بنت ملحان", "g"), ("أم أيمن", "g"), ("رقية بنت رسول الله", "g"), ("فاطمة بنت رسول الله", "g"), ("عائشة أم المؤمنين", "g"), ("خديجة أم المؤمنين", "g"), ("حفصة بنت عمر", "g"), ("زينب بنت جحش", "g"), ("أم كلثوم بنت رسول الله", "g"), ("صفية بنت عبد المطلب", "g"), ("الشفاء بنت عبد الله", "g"),
           ("أبو بكر الصديق", ""), ("عمر بن الخطاب", ""), ("عثمان بن عفان", ""), ("علي بن أبي طالب", ""), ("أبو عبيدة بن الجراح", ""), ("سعد بن أبي وقاص", ""), ("الزبير بن العوام", ""), ("طلحة بن عبيد الله", ""), ("عبد الرحمن بن عوف", ""), ("سعيد بن زيد", ""), ("حمزة بن عبد المطلب", ""), ("مصعب بن عمير", ""), ("بلال بن رباح", ""), ("معاذ بن جبل", ""), ("أبي بن كعب", ""), ("زيد بن ثابت", ""), ("عبد الله بن مسعود", ""), ("عبد الله بن عباس", ""), ("عبد الله بن عمر", ""), ("أنس بن مالك", ""), ("أبو هريرة", ""), ("خالد بن الوليد", ""), ("سلمان الفارسي", ""), ("أبو ذر", ""), ("جعفر بن أبي طالب", ""), ("أسامة بن زيد", ""), ("البراء بن مالك", ""), ("أبو موسى الأشعري", ""), ("عمرو بن العاص", ""), ("عمر بن عبد العزيز", ""), ("سعيد بن المسيب", ""), ("الحسن البصري", ""), ("أويس القرني", "")]
    figs = []
    for nm, g in FIG:
        nz = lambda t: re.sub("[أإآ]", "ا", re.sub(r"[\u064B-\u0652]", "", t or ""))
        key = nz(nm.replace(" أم المؤمنين", "").replace("بنت رسول الله", "بنت رسول الله"))
        cand = [x for x in A if str(x.get("b", "")) in ("siyar-v00", "siyar-v01", "siyar-v02", "siyar-v03", "siyar-v04", "siyar-v05") and (nz(x.get("n")) == key or nz(x.get("n")).startswith(key + " ") or nz(x.get("n")).startswith("قصة " + key))]  # الاسم أول الترجمة بحدوده (لا «حفصة بنت عمر» لعمر)
        cand.sort(key=lambda x: (not nz(x.get("n")).startswith(key), str(x.get("b"))))
        h = cand[0] if cand else None
        if not h: continue
        ex = virtue(h)
        if ex: figs.append({"who": nm, "g": g, "n": h["n"], "ex": ex, "b": h["b"], "p": int(h["p"]), "pl": h.get("pl", "")})
    json.dump({"note": "قصص الشخصيات الملهمة للطلائع من مقالات المكتبة، وتراجم من سير أعلام النبلاء (tools/tala-stories.py)", "items": out, "figs": figs}, open(os.path.join(ROOT, "data", "tala-stories.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(figs), "شخصية من السير؛", len(out), "قصة؛ للطالبات:", sum(1 for x in out if x["g"] == "g"), "؛ للصغار:", sum(1 for x in out if "t2" in x["st"]))


if __name__ == "__main__":
    main()
