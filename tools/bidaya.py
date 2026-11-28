#!/usr/bin/env python3
"""منهج «البداية» للطلائع (١٥–٢٠ سنة) من نصوص المكتبة (طلب المدير، ٢٧ نوفمبر ٢٠٢٦).

الخطة في data/bidaya/plan.json: ثلاثة أجزاء، وسبعة مسارات (العقيدة، التفسير، الحديث، الأعلام، الفقه، الآداب وقضايا الشباب، القضايا المنهجية)،
ولكل درس مصادره: آيات (بتفسير السعدي والمختصر والميسر)، أو حديث من الأربعين، أو بحث في كتب محددة (الدعوة أولًا)، أو مقالات الدعوة وفتاواها.

لكل درس خطوتان:
  ١) الجمع (بلا نموذج): نصوص المصادر حرفيًّا بمراجعها (الكتاب والصفحة) ← data/bidaya/src/<الدرس>.json
  ٢) الصياغة (Gemini بمفاتيح خدمات الكتب): درس بأسلوب سلسلة «البداية»: تمهيد وأهداف ونصوص منقولة وشرح تربوي معزو وفوائد وقصة أو نشاط وتقويم
     ← data/bidaya/l/<الدرس>.json بحالة «مسودة» (st=draft) لا يراه الطلاب حتى تعتمده الإدارة (st=ok) من صفحة الدرس.
الضوابط الآلية بعد الصياغة: لا يبقى من «النصوص المنقولة» إلا ما وُجد حرفيًّا في مصدره، ولا عزو إلا إلى نص أُرسل فعلًا،
وكل ما بين ﴿ ﴾ يُطابَق على المصحف؛ وما خالف يُحذف أو يُعلَّم في warn للمراجعة.

الاستعمال:
  python3 tools/bidaya.py --extract            الجمع وحده لكل الدروس (بلا مفاتيح)
  python3 tools/bidaya.py [--max 6] [--only ID] الجمع ثم صياغة ما لم يُصغ بعد (BD_MAX، BD_MINUTES)"""
import glob, json, os, re, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data", "bidaya")
J = lambda p: json.load(open(p, encoding="utf-8"))
def W(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
DIAC = re.compile(r"[ً-ْٰـۖ-ۭ]")
def norm(s): return re.sub(r"\s+", " ", re.sub(r"[^ء-ي0-9 ]", " ", DIAC.sub("", str(s or "")).replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا").replace("ة", "ه").replace("ى", "ي"))).strip()
def plain(s): return re.sub(r"\n{3,}", "\n\n", re.sub(r"<[^>]+>|^#+\s*|@@\s*", "", str(s or ""), flags=re.M)).strip()

CAT = None
def cat():
    global CAT
    if CAT is None:
        c = J(os.path.join(ROOT, "data", "catalog.json")); CAT = {"b": {b["id"]: b for b in c["books"]}, "a": {a["id"]: a["name"] for a in c["authors"]}}
    return CAT
_BK = {}
def book(bid):
    if bid in _BK: return _BK[bid]
    b = cat()["b"].get(bid); p = None
    for f in (os.path.join(ROOT, "vols", bid + ".json"), os.path.join(ROOT, "data", "books", bid + ".json")):
        if os.path.exists(f): p = f; break
    _BK[bid] = (J(p) if p else {}) | {"meta": b or {}}; return _BK[bid]
def vols(bid):  # العمل متعدد المجلدات: كل مجلداته
    b = cat()["b"].get(bid) or {}
    if not b.get("set"): return [bid]
    return sorted([x["id"] for x in cat()["b"].values() if x.get("set") == b["set"] and x.get("type") != "article"], key=lambda i: cat()["b"][i].get("vol") or 0)
def label(bid, i):
    bk = book(bid); pl = bk.get("pl") or []; m = bk["meta"]; t = (m.get("setTitle") or m.get("title") or bid).split(" — ")[0]
    return "%s، %s" % (t, pl[i] if i < len(pl) and pl[i] else "ص %d" % (i + 1))

def normap(t):  # النص المطبَّع مع موضع كل حرف منه في الأصل (التشكيل يغيّر الطول)
    out, mp, sp = [], [], False
    for i, ch in enumerate(t):
        if DIAC.match(ch): continue
        c = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي"}.get(ch, ch)
        if not re.match(r"[\u0621-\u064A0-9]", c): c = " "
        if c == " ":
            if sp: continue
            sp = True
        else: sp = False
        out.append(c); mp.append(i)
    return "".join(out), mp
def excerpt(text, terms, n=1300):
    t = plain(text); nt, mp = normap(t)
    hits = [nt.find(x) for x in terms if nt.find(x) >= 0]
    pos = min(hits) if hits else 0
    k = mp[pos] if mp and pos < len(mp) else 0; a = max(0, k - n // 3); b = min(len(t), a + n)
    s = t[a:b]
    if a > 0: s = s[s.find(" ") + 1:]
    m = re.search(r"[.!؟:]\s", s[::-1][:200]); s = s[:len(s) - m.start()] if m and b < len(t) else s
    return s.strip()

def search_books(ids, q, per=2, top=4):
    terms = [norm(x) for x in q if norm(x)]; hits = []
    for bid in ids:
        dawah = (cat()["b"].get(bid) or {}).get("col", "dawah") == "dawah"
        for vid in vols(bid)[:40]:
            pages = book(vid).get("pages") or []
            for i, pg in enumerate(pages):
                np_ = norm(pg); c = [min(3, np_.count(t)) * (3 if " " in t else 1) for t in terms]; k = sum(1 for x in c if x)
                if k: hits.append((sum(c) * k * k * (1.5 if dawah else 1), vid, i))  # تغطية الكلمات المتعددة أهم من تكرار كلمة واحدة
    hits.sort(key=lambda x: -x[0]); out, cnt = [], {}
    for sc, vid, i in hits:
        k = cat()["b"].get(vid, {}).get("set") or vid
        if cnt.get(k, 0) >= per: continue
        cnt[k] = cnt.get(k, 0) + 1
        out.append({"ref": "%s:%d" % (vid, i + 1), "src": label(vid, i), "text": excerpt(book(vid)["pages"][i], terms)})
        if len(out) >= top: break
    return out

_ART = None
def search_arts(q, top=2):
    global _ART
    if _ART is None: _ART = [x for x in J(os.path.join(ROOT, "data", "articles", "index.json"))["items"] if (x.get("col") or "dawah") == "dawah" and not x.get("h")]
    terms = [norm(x) for x in q if norm(x)]; hits = []
    for x in _ART:
        t = norm(x.get("t")); sc = sum(3 for k in terms if k in t)
        if sc: hits.append((sc + (1 if x.get("fa") else 0), x))
    hits.sort(key=lambda h: -h[0]); out = []
    for sc, x in hits[:top * 3]:
        try: g = J(os.path.join(ROOT, "data", "articles", x["f"] + ".json")); pg = (g.get(x["id"]) or {}).get("pages") or []
        except Exception: continue
        if not pg: continue
        au = cat()["a"].get(x.get("a"), "")
        out.append({"ref": "%s:1" % x["id"], "src": "«%s»%s" % (x["t"], " — " + au if au else ""), "text": plain(pg[0])[:2200]})
        if len(out) >= top: break
    return out

QUR = None
def quran():
    global QUR
    if QUR is None: QUR = J(os.path.join(ROOT, "data", "quran", "uthmani.json"))
    return QUR
def ayat(s, a, b):
    Q = quran()["suras"][s - 1]; name = re.sub(r"^سُ?ورَةُ\s*", "", Q.get("name", "")); out = []
    txt = " ".join("%s (%d)" % (re.sub(r"^﻿?بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*", "", Q["ayat"][i - 1]) if i == 1 and s not in (1, 9) else Q["ayat"][i - 1].replace("﻿", ""), i) for i in range(a, b + 1))
    out.append({"ref": "q:%d:%d-%d" % (s, a, b), "src": "سورة %s: %d–%d" % (name, a, b), "text": txt, "quran": 1})
    for k, n in (("saddi", "تفسير السعدي"), ("mokhtasar", "المختصر في التفسير"), ("muyassar", "التفسير الميسر")):
        try: T = J(os.path.join(ROOT, "data", "quran", "tafsir", k, "%d.json" % s))
        except Exception: continue
        t = "\n".join("(%d) %s" % (i, plain(T.get(str(i), ""))) for i in range(a, b + 1) if T.get(str(i)))
        if t: out.append({"ref": "tf:%s:%d:%d-%d" % (k, s, a, b), "src": "%s، سورة %s %d–%d" % (n, name, a, b), "text": t[:6000]})
    return out

def hadith(key):
    H = J(os.path.join(ROOT, "data", "hadith", "arbain.json")).get(key) or {}
    if not H: return []
    n = key.split("-")[-1]; p = None
    for i, pg in enumerate(book("arbain").get("pages") or []):
        if norm(H.get("m", ""))[:40] in norm(pg): p = i; break
    return [{"ref": "arbain:%s" % (p + 1 if p is not None else n), "src": "الأربعون النووية، الحديث %s" % n, "text": plain(H.get("full") or H.get("m")), "hadith": 1}]

def extract(L):
    pack = []
    for s in L["src"]:
        if "ayat" in s: pack += ayat(*s["ayat"])
        elif "hadith" in s: pack += hadith(s["hadith"])
        elif "b" in s: pack += search_books(s["b"], s.get("q") or [L["t"]])
        elif "art" in s: pack += search_arts(s["art"])
    return pack

STYLE = {"aqida": "درس عقيدة على منهج أهل السنة والجماعة كما في «المنة شرح اعتقاد أهل السنة»: تعريف المسألة، وأدلتها من الكتاب والسنة، وأقوال السلف، والرد المختصر على المخالف، وأثر المسألة في السلوك.",
         "tafsir": "درس تفسير وتدبر: معاني المفردات، والمعنى الإجمالي للآيات مقطعًا مقطعًا، وهدايات الآيات وما يستفيده الشاب منها في حياته.",
         "hadith": "درس حديث: نص الحديث، وراويه في سطر، ومعاني المفردات، والمعنى الإجمالي، والفوائد مرتبة (عقدية، فقهية وعملية، تربوية وسلوكية).",
         "alam": "قصة علم من الصحابة أو التابعين أو الأئمة بأسلوب تربوي مشوّق: نشأته، ومواقف من حياته، والدروس المستفادة لشاب اليوم.",
         "fiqh": "درس فقه ميسر للبالغين: التعريف، والحكم ودليله، والشروط والأركان أو الضوابط، وأمثلة تطبيقية من واقع الشباب، وأشهر الأخطاء، دون تفصيل الخلاف إلا ما يحتاجه.",
         "adab": "درس آداب وقضايا الشباب: المفهوم، والأدلة، ومواقف من السلف، والتطبيق في واقع الشاب المعاصر، وخطوات عملية.",
         "tech": "درس في التقنية وأحكامها وآدابها: الواقع (الهاتف أو وسائل التواصل أو الذكاء الاصطناعي)، والأحكام والضوابط الشرعية من النصوص، والآداب، والمحاذير، وخطوات عملية يطبقها الشاب، بلغة قريبة غير منفّرة.",
         "dawa": "درس لتنمية الحس الدعوي وتحمل مسؤولية خدمة الدين: الفضل والأدلة، ونماذج من الصحابة والسلف، ووسائل عملية تناسب الشاب في محيطه، وآداب الداعية، ومشروع صغير يبدؤه الطالب.",
         "lugha": "درس أدبي لغوي ينمّي الذائقة: نصوص مختارة من القرآن أو الحديث أو الشعر أو النثر من المصادر، وشرح مفرداتها وجمالها البلاغي، وصلة اللغة بفهم الدين، وتدريب على الحفظ أو الكتابة أو الإلقاء.",
         "intima": "درس في الانتماء للدعوة السلفية والبناء الدعوي: المفهوم، وأدلته من الكتاب والسنة، وتقريره بنصوص مشايخ الدعوة من المصادر، ونماذج من الصحابة والسلف، ثم الصورة العملية في حياة الشاب داخل مجموعته الدعوية (العلم والشورى والإصلاح والتعاون)، مع التحذير من التعصب والتفلت.",
         "manhaj": "درس منهجي من قضايا «الفرقان» بلغة هادئة منصفة: تحرير المسألة، وأدلتها، وأقوال العلماء، والضوابط، والتحذير من الغلو والتفريط، وموقف الدعوة السلفية كما في مصادرها."}
PROMPT = """أنت معدّ مناهج تربوية علمية على منهج أهل السنة والجماعة، تكتب درسًا من سلسلة «البداية لمن سلك طريق الهداية» لطلاب المرحلة الثانوية والجامعية (١٥–٢٠ سنة)، بعد سلسلتي «الأساس» و«البنيان».
عنوان الدرس: {t}
المسار: {u}. {style}
الجزء: {part} ({age}).

القيم الحاكمة للمنهج كله (طلب المدير، ٢٨ نوفمبر ٢٠٢٦) — يخدمها كل درس في موضوعه دون تكلف:
بناء شخصية إسلامية متكاملة، ثم اندماجها مع مجموعة دعوية تقوم بأعباء لا يقوم بها أفراد بلا تنسيق، ثم السعي بكل متاح لخدمة الدين ونفع المسلمين؛
وتكوين جيل سلفي رباني على بصيرة وهدى، يجمع العلم والعمل والدعوة والإصلاح، ويظهر عليه أثر التوحيد والاتباع والتزكية؛
والدعوة السلفية جماعة تقوم على العلم والشورى والإصلاح والتعاون.

نصوص المصادر من المكتبة (كل نص مسبوق بمرجعه [[...]]):
{src}

اكتب الدرس من هذه النصوص وحدها، بعربية فصيحة سهلة تخاطب الشاب، دون حشو. الشروط:
- لا تضف حكمًا ولا قولًا ولا حديثًا ولا أثرًا من عندك؛ وأتبع كل معلومة بعزوها [[المرجع]] كما في النصوص.
- «النصوص» تنقل فيها الآيات والأحاديث والأقوال المهمة حرفيًّا كما وردت في المصادر، كل نص بمرجعه؛ ولا تكتب آية إلا من نص المصحف المرسل أو كما وردت في المصادر.
- «bina» توجيه تربوي من مقتضى الدرس نفسه، لا تُنسب فيه أقوال ولا أحكام بلا عزو.
- الأسئلة من مضمون الدرس، متدرجة، ولكل سؤال جوابه وتعليله المعزو.
أخرج JSON وحده:
{{"intro": "تمهيد قصير مشوّق (٣–٤ جمل)",
 "goals": ["أن يعرف…", "أن يستدل…", "أن يطبّق…"],
 "nusus": [{{"ref": "المرجع", "t": "النص حرفيًّا"}}],
 "sharh": [{{"h": "عنوان فرعي", "p": "فقرة الشرح [[مرجع]]"}}],
 "fawaid": ["فائدة [[مرجع]]"],
 "qissa": "قصة أو موقف من السلف من النصوص إن وُجد [[مرجع]]، أو فارغ",
 "nashat": "نشاط عملي أو واجب أسبوعي يطبّقه الطالب",
 "bina": ["٢–٤ نقاط توجيهية قصيرة: صلة الدرس بالقيم الحاكمة أعلاه (أثره في التوحيد أو الاتباع أو التزكية، وفي تكامل الشخصية، وفي العمل مع المجموعة الدعوية، وفي خدمة الدين ونفع المسلمين)؛ توجيه تربوي لا حكم فيه، وما كان من نص المصادر يُعزى [[مرجع]]"],
 "qs": [{{"k": "tf", "q": "عبارة", "a": true, "w": "التعليل [[مرجع]]"}}, {{"k": "mcq", "q": "سؤال", "o": ["أ", "ب", "ج", "د"], "a": 0, "w": "…"}}, {{"k": "open", "q": "سؤال مقالي", "a": "عناصر الإجابة"}}]}}
اكتب ٣–٦ مقاطع في «sharh»، و٤–٨ فوائد، و٦–٨ أسئلة متنوعة."""

QN = None
def qnorm():
    global QN
    if QN is None:  # الرسم العثماني والإملائي معًا (الكتب تنقل الآيات بالإملائي غالبًا)
        imla = J(os.path.join(ROOT, "data", "quran", "quran.json"))
        QN = norm(" ".join(a for Q in (quran(), imla) for s in Q["suras"] for a in s["ayat"]))
    return QN
def check(out, pack):
    refs = {p["ref"] for p in pack}; srcn = {p["ref"]: norm(p["text"]) for p in pack}; warn = []
    def clean(v):
        if isinstance(v, str):
            v = re.sub(r"\[\[([^\]]+)\]\]", lambda m: m.group(0) if m.group(1) in refs else "", v).strip()
            for a in re.findall(r"﴿([^﴾]{6,})﴾", v):
                if norm(a) and norm(a) not in qnorm(): warn.append("آية لم تطابق المصحف: " + a[:60])
            return v
        if isinstance(v, list): return [y for y in (clean(z) for z in v) if y not in ("", None, [], {})]
        if isinstance(v, dict): return {k: clean(z) for k, z in v.items()}
        return v
    out = clean(out); keep = []
    for n in out.get("nusus") or []:
        t = norm((n or {}).get("t")); r = (n or {}).get("ref")
        if t and r in srcn and t[:80] in srcn[r]: keep.append(n)
        elif t and any(t[:80] in x for x in srcn.values()): keep.append(n)
        else: warn.append("نص منقول لم يوجد حرفيًّا في مصدره فحُذف: " + str((n or {}).get("t"))[:60])
    out["nusus"] = keep
    out["qs"] = [q for q in out.get("qs") or [] if isinstance(q, dict) and q.get("q") and (q.get("k") == "open" or q.get("a") is not None)]
    return out, warn

# ===== الدمج مع كتب «البداية» الرسمية إذا رُفعت (طلب المدير، ٢٧ نوفمبر): الرسمي مقدَّم، والمولَّد لا يُكرره =====
STOPW = {"في", "من", "على", "عن", "الى", "الي", "مع", "بين", "ما", "لا", "او", "ثم", "التي", "الذي", "وهو", "هو", "ان", "حتي", "كل", "درس", "الدرس", "باب"}
def toks(t): return {w[2:] if w.startswith("ال") and len(w) > 4 else w for w in norm(re.sub(r"[()«»\[\]:–\-]", " ", t)).split() if len(w) > 2 and w not in STOPW}
def official():
    out = []
    for b in cat()["b"].values():
        t = norm(b.get("setTitle") or b.get("title"))
        if b.get("type") == "article" or not t.startswith("البدايه") or "النهايه" in t: continue  # لا «البداية والنهاية» لابن كثير
        if "الهدايه" in t or b.get("authorId") == "w5" or "سلك" in t: out.append(b)
    return sorted(out, key=lambda b: (b.get("set") or b["id"], b.get("vol") or 0))
def off_lessons(books):
    ids = {b["id"] for b in books}; L, seen = [], set()
    try: ex = J(os.path.join(ROOT, "data", "tala-ex.json"))["items"]
    except Exception: ex = []
    for x in ex:
        if x.get("b") in ids and (x["b"], x.get("l")) not in seen: seen.add((x["b"], x.get("l"))); L.append({"b": x["b"], "p": x.get("lp") or x.get("p"), "l": x.get("l"), "v": x.get("v")})
    if not L:  # قبل استخراج التمارين: فهرس الكتاب نفسه
        for b in books:
            for t in book(b["id"]).get("toc") or []:
                if 3 <= len(t.get("t", "")) <= 80 and (t["t"], b["id"]) not in seen: seen.add((t["t"], b["id"])); L.append({"b": b["id"], "p": t.get("p", 1), "l": t["t"], "v": b.get("vol") or 1})
    return L
def merge(plan):
    books = official(); mp = os.path.join(D, "merge.json")
    if not books:
        if os.path.exists(mp): os.remove(mp)
        return {}
    OL = off_lessons(books); dup = {}
    for pt in plan["parts"]:
        for L in pt["lessons"]:
            a = toks(L["t"]); best = (0, None)
            for o in OL:
                b_ = toks(o["l"] or ""); sc = len(a & b_) / max(1, min(len(a), len(b_))) if a and b_ else 0
                sura = next((s_.get("ayat") for s_ in L["src"] if "ayat" in s_), None)
                if sura:  # درس تفسير: السورة نفسها في الكتاب الرسمي
                    nm = norm(quran()["suras"][sura[0] - 1].get("name", "")).replace("سوره", "").strip()
                    if nm and nm in norm(o["l"] or ""): sc = max(sc, .9)
                if sc > best[0]: best = (sc, o)
            if best[0] >= .6: dup[L["id"]] = dict(best[1], score=round(best[0], 2))
    W(mp, {"note": "دروس «البداية» المولَّدة التي يغطيها الكتاب الرسمي (tools/bidaya.py --merge)؛ لا تُصاغ، وصفحتها تحيل إلى الرسمي، والمصوغ منها قبلُ يبقى «إثراء»",
           "at": time.strftime("%Y-%m-%d"), "books": [b["id"] for b in books], "official": OL, "dup": dup})
    print("الكتب الرسمية:", len(books), "• دروسها:", len(OL), "• دروس مولَّدة يغطيها الرسمي:", len(dup))
    return dup

def main():
    plan = J(os.path.join(D, "plan.json")); args = sys.argv[1:]
    dup = merge(plan)
    if "--merge" in args: return
    only = args[args.index("--only") + 1] if "--only" in args else None
    mx = int(args[args.index("--max") + 1]) if "--max" in args else int(os.environ.get("BD_MAX", "6"))
    LS = [(pi, pt, L) for pi, pt in enumerate(plan["parts"]) for L in pt["lessons"] if not only or L["id"] == only]
    LS.sort(key=lambda x: not x[1].get("prio"))  # الأجزاء المقدَّمة بطلب المدير (prio) تُصاغ أولًا
    idxp = os.path.join(D, "index.json"); idx = J(idxp) if os.path.exists(idxp) else {"lessons": {}}
    made, rep, t0 = 0, [], time.time()
    for pi, pt, L in LS:
        sp = os.path.join(D, "src", L["id"] + ".json")
        sig = json.dumps(L["src"], ensure_ascii=False, sort_keys=True)
        if not os.path.exists(sp) or J(sp).get("sig") != sig:
            pack = extract(L); W(sp, {"id": L["id"], "sig": sig, "at": time.strftime("%Y-%m-%d"), "pack": pack})
        if "--extract" in args: continue
        lp = os.path.join(D, "l", L["id"] + ".json")
        if os.path.exists(lp) and not only: continue
        if L["id"] in dup and not only: continue  # يغطيه كتاب البداية الرسمي: لا تكرار
        if made >= mx or time.time() - t0 > 60 * float(os.environ.get("BD_MINUTES", "40")): break
        pack = J(sp)["pack"]
        if not pack: rep.append("- %s: لا مصادر؛ تُراجع كلمات البحث في الخطة" % L["id"]); continue
        import tashjir as T  # مفاتيح خدمات الكتب وبدائل النماذج
        prompt = PROMPT.format(t=L["t"], u=plan["units"][L["u"]][0], style=STYLE[L["u"]], part=pt["t"], age=pt["age"],
                               src="\n\n".join("[[%s]] (%s)\n%s" % (p["ref"], p["src"], p["text"]) for p in pack)[:60000])
        out = T.gemini(prompt)
        if out is None: rep.append("- تعذر الوصول إلى النموذج (حصة)؛ يُستكمل في الجولة التالية"); break
        if not isinstance(out, dict) or not out.get("sharh"): rep.append("- %s: رد غير صالح" % L["id"]); continue
        out, warn = check(out, pack)
        rec = {"id": L["id"], "t": L["t"], "u": L["u"], "part": pi + 1, "src": [{"ref": p["ref"], "src": p["src"]} for p in pack], **out,
               "warn": warn, "st": "draft", "at": time.strftime("%Y-%m-%d")}
        W(lp, rec); idx["lessons"][L["id"]] = {"st": "draft", "at": rec["at"], "w": len(warn)}; made += 1
        rep.append("- %s «%s»: %d مقاطع، %d سؤالًا%s" % (L["id"], L["t"], len(out.get("sharh") or []), len(out.get("qs") or []), "، %d تنبيهًا" % len(warn) if warn else ""))
        print(rep[-1], flush=True)
    if "--extract" not in args:
        idx["at"] = time.strftime("%Y-%m-%d"); idx["n"] = sum(len(p["lessons"]) for p in plan["parts"]); W(idxp, idx)
        open(os.path.join(ROOT, ".bidaya-report.txt"), "w", encoding="utf-8").write(("📗 <b>منهج البداية</b>: صيغ %d درسًا مسودةً للمراجعة\n" % made + "\n".join(rep[:20])) if made else "")
    print("صيغ", made)

if __name__ == "__main__":
    main()
