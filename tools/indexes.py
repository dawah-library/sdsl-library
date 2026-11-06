#!/usr/bin/env python3
"""الفهارس الفنية الآلية لكل كتاب: الآيات، والأحاديث، والأعلام.

يقرأ data/books/<id>.json و vols/<id>.json ويكتب data/idx/<id>.json:
  {"q": [[نص الآية, العزو, الصفحة], ...], "h": [[طرف الحديث, الصفحة], ...], "a": [[العلم, [الصفحات]], ...]}
الاستعمال: python3 tools/indexes.py [معرفات...]  (بلا معرفات: الكتب التي تغيّر نصها منذ آخر فهرسة)
"""
import json, os, re, sys, glob, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "idx")
CAP = 4000
IVER = "v2:"  # يُرفع عند تغيير طريقة الفهرسة فيُعاد بناء فهارس كل الكتب
TASH = re.compile(r"[ً-ْٰـ]")
VERSE = re.compile(r"[{﴿]\s*([^{}﴿﴾]{6,600}?)\s*[}﴾]")
REF = re.compile(r"^\s*[\[(]\s*([ء-ي ]{2,20}?)\s*[:：]\s*([\d٠-٩]{1,3}(?:\s*[-–]\s*[\d٠-٩]{1,3})?)\s*[\])]")
PROPHET = re.compile(r'(?:صلى الله عليه وسلم|ﷺ|صلى الله عليه وآله وسلم)\s*[:،]?\s*(?:أنه\s+)?(?:قال|يقول|كان يقول)?\s*[:،]?\s*(?:«([^«»]{8,400})»|"([^"]{8,400})"|“([^“”]{8,400})”)')
PROPHET2 = re.compile(r'(?:قال رسول الله|قال النبي|عن النبي|أن رسول الله|أن النبي)\s*(?:صلى الله عليه وسلم|ﷺ)?\s*(?:قال)?\s*[:،]?\s*(?:«([^«»]{8,400})»|"([^"]{8,400})"|“([^“”]{8,400})”)')
HONOR = re.compile(r"((?:[ء-ي]+\s+){1,5})(?:رحمه|رحمها) الله|((?:[ء-ي]+\s+){1,5})رضي الله (?:عنه|عنها|عنهما)(?![ء-ي])")
STOP = set("قال وقال عن وعن أن وأن إن روى وروى حديث وحديث كان وكان ذكر وذكر ذكره رواه قول وقول فقال يقول وهو هو هذا وهذا الإمام والإمام الشيخ والشيخ العلامة الحافظ شيخ الإسلام الصحابي الجليل في من إلى على حتى ثم أخرجه قاله نقله كما ما ولا لا قد فقد لقد عنها عنه أبيه أمه جده يعني أي أيضا وكذا كذا العلماء الأئمة السلف".split())
LEAD = set("ابن أبو أبي أبا أم بن عبد عبيد".split())


# ===== تصحيح الآيات بنص المصحف (data/quran/quran.json): نص الآية كما في المصحف، وعزوها إن غاب =====
QSK = re.compile(r"[^ء-ي]")
def skel(w):
    """هيكل الكلمة للمطابقة بين الرسم العثماني والإملائي: بلا تشكيل ولا ألفات ولا همزات (يٓأيها = يا أيها، ءامنوا = آمنوا، وحدة = واحدة)."""
    w = TASH.sub("", w)
    w = re.sub("[ٰۖ-ۭٓ-ٟ]", "", w).replace("ٱ", "ا")
    w = QSK.sub("", w)
    w = re.sub("[اأإآءئؤى]", "", w).replace("ة", "ه")
    return w
_Q = None
MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭ]")
def unmark(t): return MARKS.sub("", t.replace("ا\u0653", "آ").replace("\u0640", "").replace("ٱ", "ا"))
def quran():
    global _Q
    if _Q is None:
        try:
            src = json.load(open(os.path.join(ROOT, "data", "quran", "quran.json"), encoding="utf-8"))["suras"]
        except Exception:
            _Q = False; return _Q
        nm = lambda s: re.sub(r"^سورة\s+", "", unmark(s["name"])).strip()
        words, S, owner = [], [], []  # words: [(سورة، آية، الكلمة)]، S: هيكل المصحف متصلًا، owner: رقم الكلمة لكل حرف
        for s in src:
            for a, t in enumerate(s["ayat"], 1):
                if a == 1 and s["n"] not in (1, 9): t = re.sub(r"^بسم الله الرحمن الرحيم\s*", "", t)
                for w in t.split():
                    k = skel(w)
                    if not k: continue
                    words.append((s["n"], a, unmark(w))); S.append(k); owner.extend([len(words) - 1] * len(k))
        _Q = {"names": {nm(s): s["n"] for s in src}, "nums": {s["n"]: nm(s) for s in src}, "w": words, "S": "".join(S), "o": owner}
    return _Q
AR2 = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"); EN2 = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
def fix_verse(v, ref):
    """يطابق هيكل الاقتباس (حروفًا متصلة، فلا يضر اختلاف الرسم العثماني والإملائي) بالمصحف، مفضّلًا موضع العزو؛ فيعيد [نص المصحف، العزو]."""
    Q = quran()
    if not Q: return None
    qw = [k for k in (skel(w) for w in re.sub(r"[\d٠-٩]+|[۝…]", " ", v).split()) if k]
    if len(qw) < 2: return None
    W, S, O = Q["w"], Q["S"], Q["o"]
    pref = None
    if ref:
        m = re.match(r"(.+?):\s*([\d٠-٩]+)", ref); sn = Q["names"].get(unmark(m.group(1)).strip()) if m else None
        if sn: pref = (sn, int(m.group(2).translate(AR2)))
    for cut in range(len(qw), max(1, int(len(qw) * .8)) - 1, -1):  # يُقبل سقوط آخر الاقتباس (كلمات مقطوعة)
        if cut < 2: break
        key = "".join(qw[:cut])
        if len(key) < 7: break
        hits, st = [], 0
        while len(hits) < 60:
            x = S.find(key, st)
            if x < 0: break
            hits.append(x); st = x + 1
        if not hits: continue
        if pref: hits.sort(key=lambda x: (W[O[x]][0] != pref[0], abs(W[O[x]][1] - pref[1])))
        x = hits[0]; i, j = O[x], O[x + len(key) - 1]
        if not pref and len(hits) > 1 and len(key) < 14: return None  # عبارة قصيرة متكررة بلا عزو: لا تخمين
        a, b = W[i], W[j]
        r = "%s: %s" % (Q["nums"][a[0]], str(a[1]).translate(EN2)) + ("-" + str(b[1]).translate(EN2) if a[0] == b[0] and b[1] != a[1] else "")
        return [" ".join(z[2] for z in W[i:j + 1]), r]
    return None

# ===== الأعلام: أسماء معروفة لقبول الاسم المفرد =====
_KN = None
def known():
    global _KN
    if _KN is None:
        _KN = set("عائشة عمر عثمان علي معاذ جابر أنس مالك أحمد الشافعي البخاري مسلم الحسن الحسين حاطب بلال سلمان خديجة فاطمة حفصة أسماء ميمونة صفية زينب طلحة الزبير سعد سعيد معاوية العباس عكرمة مجاهد قتادة عطاء الأوزاعي الثوري سفيان شعبة الطبري القرطبي النووي الذهبي السيوطي الألباني الشنقيطي الخطابي الأشعري حكمي البنا شاكر عامر ثابت".split())
        for f in glob.glob(os.path.join(ROOT, "data", "a3lam", "c*.json")):
            try:
                for x in json.load(open(f, encoding="utf-8")):
                    w = re.sub(r"[\[\]()«»]", " ", x.get("n") or "").split()
                    if w and len(w) <= 8: _KN.add(w[0]); _KN.add(w[-1])
            except Exception: pass
    return _KN
NOTNAME = re.compile(r"(?:ها|هما|هم|هن|كم|نا|ني|ه)$")
VERBISH = re.compile(r"^(?:ي|ت|ن)[ء-ي]{2,}(?:ون|ان|ين)?$")
def norm_name(n):
    w = n.split()
    if not w: return ""
    # حرف العطف أو الجر الملتصق: وعثمان، فعائشة، لعمر، وعبد الله
    if len(w[0]) > 3 and w[0][0] in "وفل" and (w[0][1:] in known() or w[0][1:] in LEAD or (len(w) > 1 and w[1] in ("بن", "ابن"))): w[0] = w[0][1:]
    if w[0] in ("أبي", "أبا") and not (len(w) > 1 and w[1] == "بن"): w[0] = "أبو"  # أبي بكر ← أبو بكر (لا أُبيّ بن كعب)
    if w[0] in ("الله", "الرحمن") and len(w) > 1 and w[1] == "بن": w.insert(0, "عبد")  # «الله بن عمرو» ← عبد الله بن عمرو
    if w[0] == "الرحمن" and len(w) > 1: w.insert(0, "عبد")
    n = " ".join(w)
    if n in ("الله", "المؤمنين", "أم المؤمنين", "رسول الله", "النبي") or n.startswith("الله "): return ""
    if len(w) == 1:
        x = w[0]
        if x not in known() and not (x.startswith("ال") and x.endswith("ي") and len(x) >= 5): return ""
        if x not in known() and (NOTNAME.search(x) or VERBISH.match(x)): return ""
    return n


def clean(t): return re.sub(r"\s+", " ", TASH.sub("", t)).strip()


def name_of(chunk):
    w = [x for x in chunk.split() if x]
    # نأخذ آخر الكلمات قبل الدعاء حتى نصل إلى كلمة توقف
    out = []
    for x in reversed(w):
        if x in STOP or (x.startswith("و") and x[1:] in STOP): break
        out.insert(0, x)
        if len(out) >= 4: break
    while out and out[0] in ("بن", "و"): out.pop(0)
    if not out: return ""
    if len(out) > 1 and out[0][:1] in "لبف" and out[0][1:2] in "عأاسمحزيجخ" and len(out[0]) > 3 and out[1] in ("بن", "ابن"): out[0] = out[0][1:]
    li = next((i for i, x in enumerate(out) if x in LEAD), None)
    if li is None: out = out[-1:]
    else: out = out[max(0, li - 1):] if out[li] == "بن" else out[li:]
    if len(out) == 1 and out[0][:1] in "لب" and len(out[0]) >= 5 and out[0][1:2] in "عأاسمحزيجخ": out[0] = out[0][1:]  # بلا «ابن/أبو/بن/عبد» نأخذ الاسم الأخير وحده
    n = " ".join(out)
    if len(n) < 3 or (len(out) == 1 and len(n) < 4): return ""
    return n


def build(pages):
    q, h, a = [], [], {}
    seen_q, seen_h = set(), set()
    for i, t in enumerate(pages):
        if not t: continue
        p = i + 1
        for m in VERSE.finditer(t):
            v = clean(m.group(1))
            if not re.search(r"[ء-ي]{2}", v) or len(v.split()) < 2: continue
            r = REF.match(t[m.end():m.end() + 40]); ref = ("%s: %s" % (r.group(1).strip(), r.group(2))) if r else ""
            fx = fix_verse(v, ref)
            if fx:
                v = fx[0]
                if not ref or ref.split(":")[0].strip() != fx[1].split(":")[0].strip(): ref = fx[1]
            else:
                v = unmark(re.sub(r"[\s۝]*[\d٠-٩]+\s*$", "", v)).replace("۝", " ")
            k = v[:60]
            if k in seen_q: continue
            seen_q.add(k); q.append([v if len(v) <= 160 else v[:160].rsplit(" ", 1)[0] + "…", ref, p])
        for rx in (PROPHET, PROPHET2):
            for m in rx.finditer(t):
                v = clean(next(g for g in m.groups() if g)); v = re.sub(r"\s*-{2,}\s*", " ", re.sub(r"^[\s.…،\-–]+|[\s.…،\-–]+$", "", v)); k = v[:50]
                if len(v.split()) < 2: continue
                if k in seen_h: continue
                seen_h.add(k); h.append([v if len(v) <= 140 else v[:140].rsplit(" ", 1)[0] + "…", p])
        for m in HONOR.finditer(t):
            if t.rfind("{", 0, m.start()) > t.rfind("}", 0, m.start()) or t.rfind("﴿", 0, m.start()) > t.rfind("﴾", 0, m.start()): continue  # داخل آية
            n = norm_name(name_of(clean(m.group(1) or m.group(2) or "")))
            if n: a.setdefault(n, [])
            if n and (not a[n] or a[n][-1] != p): a[n].append(p)
    h.sort(key=lambda x: x[0])
    al = sorted(([n, ps] for n, ps in a.items()), key=lambda x: re.sub(r"^(ال|أبو |أبي |ابن |أم )", "", x[0]))
    return {"q": q[:CAP], "h": h[:CAP], "a": al[:CAP]}


def main():
    os.makedirs(OUT, exist_ok=True)
    want = set(sys.argv[1:])
    stamp_p = os.path.join(OUT, "_stamps.json")
    stamps = json.load(open(stamp_p)) if os.path.exists(stamp_p) else {}
    files = glob.glob(os.path.join(ROOT, "data", "books", "*.json")) + glob.glob(os.path.join(ROOT, "vols", "*.json"))
    meta = {}
    for f in files:
        bid = os.path.basename(f)[:-5]
        if want and bid not in want: continue
        raw = open(f, "rb").read(); sig = IVER + hashlib.md5(raw).hexdigest()[:12]
        if not want and stamps.get(bid) == sig and os.path.exists(os.path.join(OUT, bid + ".json")): continue
        try: pages = json.loads(raw).get("pages") or []
        except Exception: continue
        ix = build(pages)
        stamps[bid] = sig
        if not (ix["q"] or ix["h"] or ix["a"]):
            if os.path.exists(os.path.join(OUT, bid + ".json")): os.remove(os.path.join(OUT, bid + ".json"))
            continue
        json.dump(ix, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        meta[bid] = [len(ix["q"]), len(ix["h"]), len(ix["a"])]
        print(bid, *meta[bid])
    json.dump(stamps, open(stamp_p, "w"), separators=(",", ":"))
    # قائمة الكتب التي لها فهارس وأعدادها، يقرؤها القارئ ليظهر التبويب
    lp = os.path.join(OUT, "_list.json")
    lst = json.load(open(lp)) if os.path.exists(lp) else {}
    lst.update(meta)
    lst = {k: v for k, v in lst.items() if os.path.exists(os.path.join(OUT, k + ".json"))}
    json.dump(lst, open(lp, "w"), separators=(",", ":"))


if __name__ == "__main__":
    main()
