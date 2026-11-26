#!/usr/bin/env python3
"""قسم «خطب الجمعة» (طلب المدير، ٢١ نوفمبر ٢٠٢٦) — المعالجة: الفهرسة، والتحقق العلمي، والإعداد من مصادر المكتبة، والمتابعة الدورية.

الأوامر:
  reindex            يبني data/khutab/index.json (البحث والتصنيف) وwords.json (البحث في المضمون) من data/khutab/t/*.json.
  verify [slug…]     يتحقق من كل موضوع ويكتب تقريره في الحقل qa (الآيات بأرقامها، والأحاديث والنقول بنصوصها في مصادرها).
  gen                يعالج طابور الإعداد data/khutab/queue.json: بحث واسترجاع من المكتبة ← خطة ← ثلاثة نماذج ← شرح الأدلة ← تحقق ← مسودة.
  watch              المتابعة: المواسم القادمة، والمواد الجديدة، والموضوعات غير المغطاة، والإثراء، والتكرار ← data/khutab/watch.json.
  materials          يستخرج نصوص المواد المرفوعة (PDF/Word/نص) إلى data/khutab/mat/<id>.json.

قواعد الجودة (ق: لا اختلاق):
- نص القرآن لا يكتبه النموذج أبدًا: يكتب المرجع {q:السورة:الآية} فيُدرج النص من المصحف العثماني المعتمد في الموقع؛
  ويُطلب منه أول كلمات الآية فيُطابَق، ويُصحَّح الرقم آليًّا إن وُجد اللفظ في غير موضعه، وإلا رُفض الدليل.
- الأحاديث والآثار والنقول تُؤخذ من مقاطع المكتبة المسترجعة بمعرّفاتها فقط، ويُتحقق أن نصها موجود بحروفه (بعد التطبيع) في مصدرها.
- المراجع ([^r1]) تشير إلى مصدر من المصادر المسترجعة وصفحته، ونصها المنقول يُطابَق في الصفحة.
- لا يُنشر شيء آليًّا: المخرج مسودة (st=draft) حتى يراجعها المشرف ويعتمدها من لوحة الإدارة؛ والنموذج المعتمد لا يُستبدل، بل تُحفظ المسودة الجديدة بجواره (alt).
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("khutab")  # يدوي فقط
import datetime, glob, hashlib, json, math, os, re, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
D = os.path.join(ROOT, "data"); K = os.path.join(D, "khutab"); T = os.path.join(K, "t")
MODEL = os.environ.get("KH_MODEL", "gemini-flash-latest")
MODELS = {"1": "الخطبة الميسرة", "2": "الخطبة العلمية التأصيلية", "3": "الخطبة البلاغية المؤثرة"}


def jl(p, d=None):
    try:
        with open(p, encoding="utf-8") as f: return json.load(f)
    except Exception: return d


def js(p, o, compact=False):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: json.dump(o, f, ensure_ascii=False, indent=None if compact else 1)


def today(): return datetime.date.today().isoformat()


# ---------------- التطبيع مع خريطة المواضع ----------------
DIAC = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
HON = {"\uFD41": " رضي الله عنه ", "\uFD42": " رضي الله عنها ", "\uFD44": " رضي الله عنهما ", "\uFD40": " رحمه الله ", "\uFDFA": " صلى الله عليه وسلم ", "\uFD4C": " صلى الله عليه وسلم "}
MAPC = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"})


def norm(s):
    s = str(s or "")
    for a, b in HON.items(): s = s.replace(a, b)
    s = s.replace("ﷺ", " صلى الله عليه وسلم ")
    s = DIAC.sub("", s).translate(MAPC)
    s = re.sub(r"[^\u0621-\u064A0-9a-zA-Z]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def nmap(orig):
    """التطبيع حرفًا حرفًا مع موضع كل حرف في الأصل (لاقتطاع النص المشكول بحروفه)."""
    out, idx, sp = [], [], True
    for i, ch in enumerate(orig):
        if DIAC.match(ch): continue
        c = ch.translate(MAPC)
        if re.match(r"[\u0621-\u064A0-9a-zA-Z]", c): out.append(c); idx.append(i); sp = False
        elif not sp: out.append(" "); idx.append(i); sp = True
    return "".join(out), idx


def find_span(orig, needle):
    """موضع النص (بعد التطبيع) في الأصل: (بداية، نهاية) بحروف الأصل، أو None."""
    n = norm(needle)
    if not n: return None
    s, idx = nmap(orig); k = s.find(n)
    if k < 0: return None
    a, b = idx[k], idx[min(len(idx) - 1, k + len(n) - 1)] + 1
    while b < len(orig) and DIAC.match(orig[b]): b += 1
    return a, b


def contains(hay, needle, parts=True):
    """هل النص المنقول موجود في المصدر؟ النقل المختصر بـ«…» يُتحقق من كل قطعة منه."""
    h = " " + norm(hay) + " "
    segs = [x for x in re.split(r"\s*(?:…|\.\.\.)\s*", needle or "") if norm(x)] if parts else [needle]
    return bool(segs) and all(norm(x) in h for x in segs)


# ---------------- المصادر ----------------
CAT = None; ARTS = None; GROUPS = {}; SHARDS = {}


def cat():
    global CAT
    if CAT is None: CAT = jl(os.path.join(D, "catalog.json"), {"books": [], "authors": [], "topics": []})
    return CAT


def arts():
    global ARTS
    if ARTS is None: ARTS = {x["id"]: x for x in (jl(os.path.join(D, "articles", "index.json"), {}) or {}).get("items", [])}
    return ARTS


def shard(bid):
    if bid not in SHARDS:
        SHARDS[bid] = None
        for p in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
            if os.path.exists(p): SHARDS[bid] = jl(p); break
    return SHARDS[bid]


def art_pages(aid):
    x = arts().get(aid)
    if not x or not x.get("f"): return []
    g = GROUPS.get(x["f"])
    if g is None: g = GROUPS[x["f"]] = jl(os.path.join(D, "articles", x["f"] + ".json"), {}) or {}
    return (g.get(aid) or {}).get("pages") or []


def mat_pages(mid):
    return (jl(os.path.join(K, "mat", mid + ".json"), {}) or {}).get("pages") or []


def pages_of(b):
    if not b: return []
    if b.startswith("km-"): return mat_pages(b)
    if b in arts(): return art_pages(b)
    s = shard(b); return (s or {}).get("pages") or []


def page_text(b, p=None):
    P = pages_of(b)
    if not P: return ""
    if p and 1 <= int(p) <= len(P): return P[int(p) - 1] + "\n" + (P[int(p)] if int(p) < len(P) else "")  # النقل قد يمتد إلى الصفحة التالية
    return "\n".join(P)


def title_of(b):
    if not b: return ""
    if b.startswith("km-"):
        m = next((x for x in (jl(os.path.join(K, "materials.json"), {}) or {}).get("items", []) if x.get("id") == b), None); return (m or {}).get("t", b)
    a = arts().get(b)
    if a: return a.get("t", b)
    x = next((y for y in cat()["books"] if y["id"] == b), None)
    return (x or {}).get("setTitle") or (x or {}).get("title") or b


# ---------------- القرآن ----------------
QUR = None


def quran():
    global QUR
    if QUR is None:
        q = jl(os.path.join(D, "quran", "uthmani.json"), {"suras": []})["suras"]
        QUR = []
        for s in q:
            ay = [re.sub(r"^[\ufeff\s]*", "", a).replace("۞ ", "") for a in s["ayat"]]
            if s["n"] not in (1, 9) and ay: ay[0] = re.sub(r"^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*", "", ay[0])
            QUR.append({"n": s["n"], "name": re.sub(r"^سوره\s*", "", norm(s["name"])), "ayat": ay})
    return QUR


def qtext(s, a, b=None):
    Q = quran()
    if not (1 <= s <= len(Q)): return None
    ay = Q[s - 1]["ayat"]; b = b or a
    if not (1 <= a <= b <= len(ay)): return None
    return " ".join(ay[a - 1:b])


def qfind(snip):
    """موضع الآية من أول كلماتها (لتصحيح رقم خاطئ)."""
    n = norm(snip)
    if len(n) < 8: return None
    for S in quran():
        for i, a in enumerate(S["ayat"]):
            if norm(a).startswith(n) or (len(n) > 20 and n in norm(a)): return S["n"], i + 1
    return None


QTOK = re.compile(r"\{q:(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\}")
HTOK = re.compile(r"\{([hav]):([A-Za-z0-9_-]+)\}")
RTOK = re.compile(r"\[\^([A-Za-z0-9_-]+)\]")


# ---------------- الأحاديث من المكتبة ----------------
HIDX = None


def hidx():
    global HIDX
    if HIDX is None:
        HIDX = {}
        for x in (jl(os.path.join(D, "hadith", "index.json"), {}) or {}).get("items", []): HIDX[x[0]] = x
    return HIDX


HB = {}


def hbook(b):
    if b not in HB: HB[b] = jl(os.path.join(D, "hadith", b + ".json"), {}) or {}
    return HB[b]


def lib_hadith(hid, excerpt=None):
    """نص الحديث مشكولًا من الكتاب نفسه في المكتبة، وموضعه في القارئ، وتخريجه كما في الكتاب."""
    x = hidx().get(hid)
    if not x: return None
    b = x[1]; R = hbook(b).get(hid) or {}
    m = excerpt or R.get("m") or x[6]
    P = pages_of(b); best = None
    for i, pg in enumerate(P):
        sp = find_span(pg, m)
        if sp: best = (i + 1, pg[sp[0]:sp[1]]); break
    if not best:  # النص غير موجود في نسخة القارئ: يُكتفى بنص قسم الحديث
        if not contains(R.get("full", ""), m): return None
        best = (None, m)
    src = x[7] or ""
    if src.strip() in ("رواه", ""):
        mm = re.search(r"رواه\s*\n?\s*(\S+)", " ".join(P[best[0] - 1:best[0] + 1]) if best[0] else "")
        src = ("رواه " + mm.group(1)) if mm else src
    return {"k": "h", "t": best[1].strip(" \"'«»"), "who": x[5], "src": src.replace('"', " ").strip(), "g": x[8] or "", "lib": hid, "b": b, "p": best[0]}


# ---------------- المحلل اللغوي للخطبة (مطابق لـparse في khutab.js) ----------------
def blocks(body):
    """[(نوع، نص)] — الأنواع: part, h2, h3, tr, note, poem, li, dua, ev, p."""
    out = []
    for ln in (body or "").split("\n"):
        s = ln.strip()
        if not s: continue
        if out and re.fullmatch(r"(\[\^[A-Za-z0-9_-]+\]\s*)+", s):  # سطر علامات مراجع وحده يلحق بما قبله
            out[-1] = (out[-1][0], out[-1][1] + s); continue
        m = re.match(r"^==\s*(.+?)\s*==$", s)
        if m: out.append(("part", m.group(1))); continue
        for pre, k in (("### ", "h3"), ("## ", "h2"), (">> ", "tr"), ("!! ", "note"), ("% ", "poem"), ("- ", "li"), ("~ ", "dua")):
            if s.startswith(pre): out.append((k, s[len(pre):])); break
        else:
            out.append(("ev" if re.fullmatch(r"\{[qhav]:[^}]+\}", s) else "p", s))
    return out


def plain(body, topic=None):
    """النص المقروء (للبحث وعدّ الكلمات)."""
    t = QTOK.sub(lambda m: "﴿" + (qtext(int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))) or "") + "﴾", body or "")
    ev = (topic or {}).get("ev") or {}
    t = HTOK.sub(lambda m: "«" + (ev.get(m.group(2)) or {}).get("t", "") + "»", t)
    t = RTOK.sub("", t).replace("**", "")
    t = re.sub(r"^(==.*==|#+ |>> |!! .*|% |- |~ )", "", t, flags=re.M)
    return t


# ---------------- التحقق ----------------
def verify(tp):
    errs, warns = [], []
    ev, refs = tp.get("ev") or {}, tp.get("refs") or {}
    used_ev, used_r = set(), set()
    for mk, M in sorted((tp.get("models") or {}).items()):
        body = M.get("body") or ""; nm = MODELS.get(mk, mk)
        if not body.strip(): warns.append(f"{nm}: لم تُكتب بعد"); continue
        B = blocks(body); parts = [b for b in B if b[0] == "part"]
        if len(parts) < 2: errs.append(f"{nm}: يلزم تقسيمها إلى خطبتين (== الخطبة الأولى == و== الخطبة الثانية ==)")
        first = next((b[1] for b in B if b[0] in ("p", "li")), "")
        if not re.search(r"الحمد|نحمده", norm(first)): warns.append(f"{nm}: الافتتاح لا يبدأ بالحمد والثناء")
        if "صلى الله عليه وسلم" not in norm(body) and "ﷺ" not in body: warns.append(f"{nm}: لا صلاة على النبي ﷺ في الخطبة")
        for m in QTOK.finditer(body):
            s, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))
            if not qtext(s, a, b): errs.append(f"{nm}: مرجع آية غير صحيح {m.group(0)}")
            elif b - a > 6: warns.append(f"{nm}: مقطع قرآني طويل {m.group(0)} (أكثر من ٧ آيات)")
        for m in re.finditer(r"﴿([^﴾]{6,})﴾", body):
            warns.append(f"{nm}: نص قرآني مكتوب يدويًّا «{m.group(1)[:30]}…» — استعمل {{q:السورة:الآية}} ليُدرج من المصحف")
        for m in HTOK.finditer(body):
            used_ev.add(m.group(2))
            if m.group(2) not in ev: errs.append(f"{nm}: دليل غير معرّف {m.group(0)}")
        for m in RTOK.finditer(body):
            used_r.add(m.group(1))
            if m.group(1) not in refs: errs.append(f"{nm}: مرجع غير معرّف [^{m.group(1)}]")
        n = len(norm(plain(body, tp)).split())
        if n < 450: warns.append(f"{nm}: قصيرة ({n} كلمة)")
        if n > 3200: warns.append(f"{nm}: طويلة ({n} كلمة)")
        M["words"] = n
    for k, e in ev.items():
        e["ok"] = False
        if e.get("k") == "h" and e.get("lib"):
            x = hidx().get(e["lib"]); R = hbook((x or [0, ""])[1]).get(e["lib"]) or {}
            src_txt = page_text(e.get("b"), e.get("p")) if e.get("p") else ""
            e["ok"] = bool(x) and (contains(src_txt, e.get("t", "")) or contains(R.get("full", ""), e.get("t", "")))
        elif e.get("vs"):
            e["ok"] = contains(page_text(e["vs"].get("b"), e["vs"].get("p")), e.get("t", ""))
        elif e.get("b"):
            e["ok"] = contains(page_text(e.get("b"), e.get("p")), e.get("t", ""))
        if not e["ok"]: errs.append(f"الدليل {k}: نصه غير موجود بحروفه في مصدره ({e.get('lib') or (e.get('vs') or {}).get('b') or e.get('b') or 'بلا مصدر'})")
        if e.get("k") == "h" and not e.get("src"): errs.append(f"الدليل {k}: بلا تخريج")
        for w in e.get("w") or []:
            if len(w) > 2 and isinstance(w[2], dict) and w[2].get("b") and not contains(page_text(w[2]["b"], w[2].get("p")), w[1]):
                warns.append(f"معنى «{w[0]}» في الدليل {k}: لم يوجد بنصه في مصدره")
    for k, r in refs.items():
        r["ok"] = True
        if r.get("u"): continue
        if not r.get("b"): errs.append(f"المرجع {k}: بلا مصدر"); r["ok"] = False; continue
        if not pages_of(r["b"]): errs.append(f"المرجع {k}: المصدر {r['b']} غير موجود في المكتبة"); r["ok"] = False; continue
        if r.get("p") and int(r["p"]) > len(pages_of(r["b"])): errs.append(f"المرجع {k}: الصفحة {r['p']} خارج الكتاب"); r["ok"] = False
        if r.get("q") and not contains(page_text(r["b"], r.get("p")), r["q"]): errs.append(f"المرجع {k}: النص المنقول غير موجود في الصفحة المذكورة"); r["ok"] = False
    for k in set(ev) - used_ev: warns.append(f"الدليل {k} غير مستعمل في أي نموذج")
    qt = {}  # نص الآيات من المصحف المعتمد (تقرؤه الصفحة العامة دون تحميل المصحف كاملًا)
    for M in (tp.get("models") or {}).values():
        for m in QTOK.finditer(M.get("body") or ""):
            s, a, b = int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))
            if qtext(s, a, b): qt["%d:%d" % (s, a) + ("-%d" % b if b != a else "")] = " ".join(quran()[s - 1]["ayat"][i - 1] + (" (%s)" % str(i).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")) if i < b else "") for i in range(a, b + 1))
    tp["qt"] = qt
    tp["qa"] = {"at": today(), "errs": errs, "warns": warns}
    return errs, warns


# ---------------- الفهرسة ----------------
def topics():
    out = []
    for p in sorted(glob.glob(os.path.join(T, "*.json"))):
        x = jl(p)
        if x and x.get("s"): out.append(x)
    return out


def reindex():
    items, words = [], {}
    for tp in topics():
        ms = {k: (v.get("st") or "draft") for k, v in (tp.get("models") or {}).items() if (v.get("body") or "").strip()}
        evk = []
        for M in (tp.get("models") or {}).values():
            for m in QTOK.finditer(M.get("body") or ""): evk.append("q:%s:%s" % (m.group(1), m.group(2)))
        for k, e in (tp.get("ev") or {}).items():
            evk.append(norm(e.get("t", ""))[:70])
        txt = " ".join(plain(M.get("body"), tp) for M in (tp.get("models") or {}).values())
        W = sorted(set(w for w in norm(txt).split() if len(w) > 2))
        words[tp["s"]] = " ".join(W)
        items.append({"s": tp["s"], "t": tp.get("t"), "sub": tp.get("sub", ""), "sum": tp.get("sum", ""), "cats": tp.get("cats", []), "seas": tp.get("seas", []),
                      "kw": tp.get("kw", []), "st": tp.get("st", "draft"), "ms": ms, "feat": bool(tp.get("feat")), "sched": tp.get("sched", ""),
                      "ev": list(dict.fromkeys(evk)), "upd": tp.get("upd") or tp.get("at", ""), "at": tp.get("at", ""),
                      "n": sum((v.get("words") or 0) for v in (tp.get("models") or {}).values()), "qe": len(((tp.get("qa") or {}).get("errs")) or [])})
    js(os.path.join(K, "index.json"), {"v": int(time.time()), "items": items})
    js(os.path.join(K, "words.json"), words, compact=True)
    print("الفهرس: %d موضوعًا" % len(items))


def cmd_verify(slugs):
    for p in sorted(glob.glob(os.path.join(T, "*.json"))):
        tp = jl(p)
        if not tp or (slugs and tp.get("s") not in slugs): continue
        e, w = verify(tp); js(p, tp)
        print("%s: %d خطأ، %d تنبيه" % (tp["s"], len(e), len(w)))
        for x in e: print("  ✗", x)
        for x in w: print("  ·", x)
    reindex()


# ---------------- التقويم الهجري (الجدولي الكويتي — للتنبيه المسبق فقط، والواجهة تستعمل أم القرى) ----------------
def hijri(d):
    jd = d.toordinal() + 1721424.5 + 0.5
    jd = math.floor(jd)
    l = jd - 1948440 + 10632; n = (l - 1) // 10631; l = l - 10631 * n + 354
    j = ((10985 - l) // 5316) * ((50 * l) // 17719) + (l // 5670) * ((43 * l) // 15238)
    l = l - ((30 - j) // 15) * ((17719 * j) // 50) - (j // 16) * ((15238 * j) // 43) + 29
    m = (24 * l) // 709; dd = l - (709 * m) // 24; y = 30 * n + j - 30
    return y, m, dd


def season_hits(cats, days=60):
    """المواسم التي تحل خلال المدة: [(id, أول يوم، عدد الأيام الباقية)]."""
    out, t0 = {}, datetime.date.today()
    for i in range(days):
        d = t0 + datetime.timedelta(days=i); y, m, dd = hijri(d)
        for S in cats.get("seasons", []):
            h, g = S.get("h"), S.get("g")
            hit = False
            for r in ([h] if h and not isinstance(h[0], list) else (h or [])):
                if r and (r[0], r[1]) <= (m, dd) <= (r[2], r[3]): hit = True
            for r in ([g] if g and not isinstance(g[0], list) else (g or [])):
                if r and (r[0], r[1]) <= (d.month, d.day) <= (r[2], r[3]): hit = True
            if hit and S["id"] not in out: out[S["id"]] = (d.isoformat(), i)
    return out


# ---------------- الاسترجاع (BM25 مبسط على مقاطع المكتبة) ----------------
PREF = re.compile(r"^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل)(?=..)")


def stem(w):
    w = PREF.sub("", w)
    return re.sub(r"(ات|ون|ين|ها|هم|كم|نا|ه)$", "", w) if len(w) > 5 else w


def toks(s): return [stem(w) for w in norm(s).split() if len(w) > 1]


STOP = set(toks("في من على الى عن ان او ثم قد لا ما هذا هذه ذلك التي الذي الذين كان كانت هو هي هم مع كل بين عند لم لن اذا حتى بل قال تعالى الله صلى عليه وسلم رضي عنه رسول"))


def corpus(prefer_ids=()):
    """المقاطع: (sid, b, p, text, weight, kind). الأولوية لمكتبة الدعوة: خطب «موعظة الأسبوع» ثم مقالاتها وفتاواها وكتبها، ثم المواد المختارة، ثم المكتبة العامة المحددة."""
    out = []
    for aid, x in arts().items():
        if x.get("h") or x.get("col") in ("ithra", "turath") or not x.get("f"): continue
        w = 1.6 if x.get("tp") == "st15" else 1.25
        for i, pg in enumerate(art_pages(aid)): out.append((aid, i + 1, pg, w, "fatwa" if re.match(r"(أسئلة|الاستفتاء)", x.get("c") or "") else ("khutba" if x.get("tp") == "st15" else "article")))
    for b in cat()["books"]:
        if b.get("col") == "dawah" and b.get("type") == "book" and not b.get("hidden"):
            for i, pg in enumerate(pages_of(b["id"])): out.append((b["id"], i + 1, pg, 1.3, "book"))
    for m in (jl(os.path.join(K, "materials.json"), {}) or {}).get("items", []):
        if m.get("use") and m.get("id"):
            src = m.get("lib") or m["id"]
            for i, pg in enumerate(pages_of(src)): out.append((src, i + 1, pg, 1.5, "material"))
    extra = set(os.environ.get("KH_TURATH", "riyad").split()) | set(prefer_ids)
    for b in extra:
        if b in arts() or b.startswith("km-"): continue
        for i, pg in enumerate(pages_of(b)): out.append((b, i + 1, pg, 0.8, "turath"))
    return out


def retrieve(query, n=24, only=None, boost=()):
    q = [w for w in toks(query) if w not in STOP and len(w) > 2]
    if not q: return []
    C = corpus(only or ()) if not only else [c for c in corpus(only) if c[0] in only]
    N = len(C) or 1; df = {w: 0 for w in q}; TOK = []
    for c in C:
        tt = toks(c[2][:6000]); TOK.append(tt); st = set(tt)
        for w in q:
            if w in st: df[w] += 1
    avg = sum(len(t) for t in TOK) / N if N else 1; res = []
    for c, tt in zip(C, TOK):
        if not tt: continue
        sc = 0.0
        for w in q:
            f = tt.count(w)
            if f: sc += math.log(1 + (N - df[w] + .5) / (df[w] + .5)) * f * 2.2 / (f + 1.2 * (.25 + .75 * len(tt) / avg))
        if sc > 0: res.append((sc * c[3] * (2.5 if c[0] in boost else 1), c))
    res.sort(key=lambda x: -x[0]); seen = {}; out = []
    for sc, c in res:
        if seen.get(c[0], 0) >= 2: continue  # مقطعان على الأكثر من المصدر الواحد
        seen[c[0]] = seen.get(c[0], 0) + 1; out.append({"b": c[0], "p": c[1], "t": c[2][:2400], "kind": c[4], "sc": round(sc, 2), "title": title_of(c[0])})
        if len(out) >= n: break
    return out


def hadith_cands(query, n=18):
    q = [w for w in toks(query) if w not in STOP and len(w) > 2]; out = []
    for hid, x in hidx().items():
        if x[1] not in ("riyad", "bulugh", "arbain"): continue
        R = hbook(x[1]).get(hid) or {}; t = toks((R.get("m") or x[6]) + " " + x[4])
        sc = sum(t.count(w) for w in q)
        if sc: out.append((sc, hid))
    out.sort(key=lambda z: -z[0]); res = []
    for _, hid in out[:n * 2]:
        e = lib_hadith(hid)
        if e: res.append(e)
        if len(res) >= n: break
    return res


QREF = re.compile(r"[\(\[]\s*([\u0621-\u064A ]{2,20})\s*:\s*([\d٠-٩]{1,3})(?:\s*[-–]\s*([\d٠-٩]{1,3}))?\s*[\)\]]")
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def ayat_from(passages, query, n=16):
    names = {S["name"]: S["n"] for S in quran()}; hits = {}
    for P in passages:
        for m in QREF.finditer(P["t"]):
            s = names.get(norm(m.group(1)).replace("سوره ", ""))
            if s:
                a = int(m.group(2).translate(AR)); key = (s, a)
                if qtext(s, a): hits[key] = hits.get(key, 0) + 1
    q = [w for w in toks(query) if w not in STOP and len(w) > 2]
    for S in quran():
        for i, a in enumerate(S["ayat"]):
            sc = sum(toks(a).count(w) for w in q)
            if sc >= 2: hits[(S["n"], i + 1)] = hits.get((S["n"], i + 1), 0) + sc * .5
    top = sorted(hits.items(), key=lambda z: -z[1])[:n]; out = []
    for (s, a), _ in top:
        mk = (jl(os.path.join(D, "quran", "tafsir", "mokhtasar", "%d.json" % s), {}) or {}).get(str(a), "")
        out.append({"ref": "%d:%d" % (s, a), "sura": quran()[s - 1]["name"], "t": qtext(s, a), "tafsir": mk[:500]})
    return out


# ---------------- Gemini ----------------
EXH = set()


def gemini(prompt, temp=0.6, mx=16000):
    from gkeys import keys as _k, Pool as _P
    KEYS = _k("study"); POOL = _P(KEYS)
    if not KEYS: print("لا مفاتيح Gemini"); return None
    for rnd in range(5):
        for k in POOL.order(EXH):
            if not POOL.ready(k): continue
            POOL.pace(k)
            try:
                body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": temp, "responseMimeType": "application/json", "maxOutputTokens": mx, "thinkingConfig": {"thinkingBudget": int(os.environ.get("KH_THINK", "1024"))}}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % MODEL, data=body, headers={"content-type": "application/json", "x-goog-api-key": KEYS[k]})
                with urllib.request.urlopen(req, timeout=300) as r: j = json.loads(r.read())
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore")
                if e.code == 429 and re.search(r"day|PerDay", msg, re.I) and not re.search(r"PerMinute", msg): EXH.add(k); continue
                POOL.cool(k, 45 if e.code == 429 else 15)
            except Exception as e:
                print("gemini:", str(e)[:120]); POOL.cool(k, 10)
        if len(EXH) >= len(KEYS): return None
        w = POOL.wait(EXH)
        if w > 0: time.sleep(min(w, 60))
    return None


SPEC = """صيغة كتابة الخطبة (سطر لكل فقرة):
== الخطبة الأولى ==   ثم   == الخطبة الثانية ==   (إلزامي)
## عنوان محور   ### عنوان فرعي
>> عبارة انتقال يقولها الخطيب بين المحاور
!! تنبيه للخطيب لا يُلقى (وقفة، نبرة، سؤال للتفكر)
- عنصر في تعداد       % صدر البيت *** عجزه       ~ دعاء
{q:السورة:الآية} أو {q:السورة:من-إلى} في سطر مستقل لإدراج الآية من المصحف (لا تكتب نص الآية أبدًا)
{h:H3} في سطر مستقل لإدراج حديث من قائمة الأحاديث بمعرّفه، و{v:S5x1} لنص من مقطع مصدر (أثر أو نقل) بعد تعريفه في quotes
**عبارة** لتمييز ما يحتاج الخطيب إلى التنبه له، و[^S5] بعد الجملة المستفادة من المصدر S5 (علامة مرجع): علامة واحدة (اثنتان على الأكثر) للفقرة، لا بعد كل جملة، ولا تُكدَّس العلامات."""

STYLE = {
    "1": "النموذج الأول: خطبة ميسرة مباشرة؛ عبارات قصيرة واضحة قريبة من عامة الناس، سهلة الحفظ والإلقاء، بلا تعقيد ولا تكلف؛ ثلاثة محاور عملية في الغالب، وخاتمة بخطوات تطبيقية.",
    "2": "النموذج الثاني: خطبة علمية تأصيلية؛ أوسع في الأدلة ووجوه الدلالة، تربط المسألة بالكتاب والسنة وكلام أهل العلم من المصادر المعطاة (بعلامات المراجع)، وتعرّف المصطلحات وتذكر الضوابط والاستثناءات، دون أن تصير درسًا جافًا.",
    "3": "النموذج الثالث: خطبة بلاغية مؤثرة؛ استهلال قوي فيه براعة استهلال، وتصوير بياني، وحسن انتقال، وتأثير وجداني صادق، ومشاهد من القرآن والسنة، مع الاعتدال والصدق العلمي والبعد عن المبالغة والتهويل.",
}


def example(mk):
    """مثال على الصيغة والأسلوب من النموذج التأسيسي المعتمد في القسم (للشكل لا للمضمون)."""
    tp = jl(os.path.join(T, "hifz-al-lisan.json")) or {}
    b = ((tp.get("models") or {}).get(mk) or {}).get("body") or ""
    if not b: return ""
    b = "\n".join(b.split("\n")[:34])
    return "## مثال على الصيغة والأسلوب لهذا النموذج من خطبة أخرى (لا تنقل منه شيئًا من المضمون ولا معرفاته):\n" + b + "\n…\n\n"


def gen_item(it):
    title = it.get("t", "").strip(); kw = it.get("kw") or []
    q = title + " " + " ".join(kw)
    only = it.get("srcs") or None
    P = retrieve(q, 22, only, set(it.get("hint") or []))
    for i, x in enumerate(P): x["sid"] = "S%d" % (i + 1)
    H = hadith_cands(q)
    for i, x in enumerate(H): x["hid"] = "H%d" % (i + 1)
    A = ayat_from(P, q)
    if not P and not H: return None, "لا مصادر ذات صلة في المكتبة"
    ctx = "## مصادر من المكتبة (S)\n" + "\n\n".join("[%s] «%s» (%s) ص%s:\n%s" % (x["sid"], x["title"], x["kind"], x["p"], x["t"][:1800]) for x in P)
    ctx += "\n\n## أحاديث موثقة من المكتبة (H) — لا تستعمل حديثًا من غيرها\n" + "\n".join("[%s] %s — %s %s" % (x["hid"], norm(x["t"])[:400], x["src"], x["g"]) for x in H)
    ctx += "\n\n## آيات مرشحة (يجوز غيرها بمرجعها)\n" + "\n".join("{q:%s} %s — المختصر: %s" % (x["ref"], x["t"][:200], x["tafsir"][:240]) for x in A)
    base = ("أنت خطيب وعالم سلفي من مشايخ الدعوة السلفية بمصر، تعدّ خطبة جمعة عن «%s». المرجعية العقدية والفقهية والتفسيرية: مكتبة الدعوة السلفية (المصادر S الأولى في القائمة)، ويُستفاد من الفتاوى فيها في الترجيح. "
            "لا تنشئ معلومة من غير المصادر المعطاة، ولا تنسب قولًا لعالم إلا إن كان في مقطع معطى، ولا أرقام صفحات من عندك. %s\n%s\n" % (title, ("ملاحظات المشرف: " + it["note"]) if it.get("note") else "", SPEC))
    plan = gemini(base + ctx + "\n\nالمطلوب الآن: خطة لثلاثة نماذج مختلفة حقًّا في البناء وترتيب الأفكار وطريقة الخطاب (لا مجرد تغيير ألفاظ):\n" + "\n".join(STYLE.values()) +
                  '\nأعد JSON: {"sum":"ملخص الموضوع في سطرين","kw":["كلمات مفتاحية"],"sub":"عنوان فرعي جامع","models":{"1":{"title":"","outline":["محور: الأدلة المختارة"]},"2":{...},"3":{...}}}', .5, 6000)
    if not plan: return None, "تعذر الاتصال بالنموذج (الخطة)"
    out = {"models": {}, "quotes": {}}
    for mk in it.get("models") or ["1", "2", "3"]:
        mk = str(mk); pm = (plan.get("models") or {}).get(mk) or {}
        r = gemini(base + ctx + "\n\n" + example(mk) + STYLE[mk] + "\nالخطة: " + json.dumps(pm, ensure_ascii=False) +
                   "\nاكتب الخطبة كاملة جاهزة للإلقاء بالصيغة المذكورة: الأولى (افتتاح بالحمد والثناء والشهادتين والصلاة على النبي ﷺ بصياغة مناسبة للموضوع، ثم «أما بعد»، ثم المحاور) والثانية (حمد وصلاة، ثم تتمة عملية، ثم الدعاء). "
                   "من ١٢٠٠ إلى ٢٢٠٠ كلمة. لكل آية اذكر أول كلماتها في qcheck. لكل أثر أو نقل تريد إيراده بنصه أضف إلى quotes معرّفًا مثل S5x1 بنصه الحرفي المنسوخ من المقطع S5.\n"
                   'أعد JSON: {"title":"","body":"نص الخطبة","qcheck":{"السورة:الآية":"أول كلمات الآية"},"quotes":{"S5x1":{"s":"S5","t":"النص الحرفي","who":"القائل","src":"العزو كما في المصدر"}}}', .75, 30000)
        if not r or not r.get("body"):  # محاولة ثانية بمفتاح آخر
            r = gemini(base + ctx + "\n\n" + example(mk) + STYLE[mk] + "\nالخطة: " + json.dumps(pm, ensure_ascii=False) + "\nاكتب الخطبة كاملة بالصيغة المذكورة (١٢٠٠–٢٠٠٠ كلمة) وأعد JSON: {\"title\":\"\",\"body\":\"\",\"qcheck\":{},\"quotes\":{}}", .7, 30000)
        if not r or not r.get("body"): continue
        body = r["body"]
        for ref, snip in (r.get("qcheck") or {}).items():  # تصحيح أرقام الآيات من لفظها
            m = re.match(r"(\d+):(\d+)", ref)
            if not m: continue
            s, a = int(m.group(1)), int(m.group(2)); real = qtext(s, a) or ""
            if snip and norm(snip)[:15] not in norm(real):
                fx = qfind(snip)
                if fx: body = re.sub(r"\{q:%d:%d(-\d+)?\}" % (s, a), "{q:%d:%d}" % fx, body)
        out["models"][mk] = {"title": r.get("title") or pm.get("title") or title, "body": body, "st": "draft", "at": today(), "by": "gemini"}
        out["quotes"].update(r.get("quotes") or {})
    if not out["models"]: return None, "تعذر توليد النماذج"
    # الأدلة والمراجع من المعرفات
    ev, refs = {}, {}
    HM = {x["hid"]: x for x in H}; PM = {x["sid"]: x for x in P}
    for mk, M in out["models"].items():
        def hsub(m):
            k, idd = m.group(1), m.group(2)
            if k == "h" and idd in HM:
                e = dict(HM[idd]); e.pop("hid", None); nid = "h" + e["lib"].split("-")[0][:2] + re.sub(r"\D", "", e["lib"]); ev[nid] = e; return "{h:%s}" % nid
            if k == "v" and idd in out["quotes"]:
                qq = out["quotes"][idd]; src = PM.get(qq.get("s")) or {}
                nid = "a" + hashlib.md5(qq.get("t", "").encode()).hexdigest()[:5]  # معرّف من النص: لا تصادم مع أدلة نموذج سابق
                ev[nid] = {"k": "a", "t": qq.get("t", ""), "who": qq.get("who", ""), "src": qq.get("src", ""), "vs": {"b": src.get("b"), "p": src.get("p")}}
                return "{a:%s}" % nid
            return m.group(0)
        M["body"] = re.sub(r"\{([hv]):([A-Za-z0-9_-]+)\}", hsub, M["body"])

        def rsub(m):
            idd = m.group(1)
            if idd in PM:
                x = PM[idd]; nid = "r" + hashlib.md5((x["b"] + str(x["p"])).encode()).hexdigest()[:5]
                refs[nid] = {"b": x["b"], "p": x["p"], "t": x["title"]}; return "[^%s]" % nid
            return ""
        M["body"] = RTOK.sub(rsub, M["body"])
        M["body"] = re.sub(r"((?:\s*\[\^[\w-]+\])+)", lambda m: "".join(list(dict.fromkeys(re.findall(r"\[\^[\w-]+\]", m.group(1))))[:2]), M["body"])
    # شرح الأدلة: المعاني ووجه الاستدلال والفوائد، مقيدة بنص الدليل والمختصر
    if ev or QTOK.search(" ".join(M["body"] for M in out["models"].values())):
        qs = sorted(set("%s:%s" % (m.group(1), m.group(2)) for M in out["models"].values() for m in QTOK.finditer(M["body"])))
        items = [{"id": k, "t": norm(e["t"])[:500]} for k, e in ev.items()] + [{"id": "q" + r, "t": qtext(*map(int, r.split(":"))), "tafsir": ((jl(os.path.join(D, "quran", "tafsir", "mokhtasar", r.split(":")[0] + ".json"), {}) or {}).get(r.split(":")[1], ""))[:600]} for r in qs]
        notes = gemini("لكل دليل مما يلي في خطبة «%s»: وجه الاستدلال به في الخطبة (سطر أو سطران)، وفائدتان أو ثلاث يحتاجها الخطيب، والكلمات الغريبة فيه (الكلمة كما وردت فقط، بلا معنى). لا تخرج عن نص الدليل وتفسير المختصر المعطى.\n%s\n"
                       'أعد JSON: {"<id>":{"dl":"","f":[""],"w":["كلمة"]}}' % (title, json.dumps(items, ensure_ascii=False)), .3, 8000) or {}
        qn = {}
        for k, v in notes.items():
            words = [gloss_word(w) for w in (v.get("w") or [])[:6]]
            rec = {"dl": v.get("dl", ""), "f": (v.get("f") or [])[:4], "w": [w for w in words if w]}
            if k in ev: ev[k].update(rec)
            elif k.startswith("q"): qn[k[1:]] = rec
        out["qn"] = qn
    out.update({"ev": ev, "refs": refs, "plan": plan, "src": [x["b"] for x in P]})
    return out, ""


GL = {}


def gloss_word(w):
    """معنى الكلمة من معاجم المكتبة وشروحها (data/gloss) بنصه وموضعه — لا معنى من النموذج."""
    n = norm(w).replace(" ", "")
    for c in dict.fromkeys([n, PREF.sub("", n), n[1:] if n[:1] in "وفبلك" else n]):
        if len(c) < 2: continue
        f = os.path.join(D, "gloss", "%04x-%04x.json" % (ord(c[0]), ord(c[1])))
        if f not in GL: GL[f] = jl(f, {}) or {}
        L = GL[f].get(c)
        if L:
            pick = next((x for x in L if x[0].split("-")[0] in ("sihah", "lisan", "mukhtar", "nihaya", "maqayis", "fathbari", "nawawimuslim")), L[0])
            return [w, pick[3][:260], {"b": pick[0], "p": pick[1]}]
    return None


def slugify(t):
    s = norm(t).replace(" ", "-")[:50]
    return s or "t" + hashlib.md5(t.encode()).hexdigest()[:6]


def cmd_gen():
    qp = os.path.join(K, "queue.json"); Q = jl(qp, {"items": []}) or {"items": []}
    lp = os.path.join(K, "log.json"); L = jl(lp, {"items": []}) or {"items": []}
    mx = int(os.environ.get("KH_MAX", "3")); done = 0; rest = []
    t0 = time.time(); tmax = 60 * float(os.environ.get("KH_MINUTES", "70"))
    for it in Q.get("items", []):
        if done >= mx or time.time() - t0 > tmax or len(EXH) >= 20: rest.append(it); continue
        s = it.get("s") or slugify(it.get("t", "")); p = os.path.join(T, s + ".json")
        print("إعداد:", it.get("t"), s)
        r, err = gen_item(it); done += 1
        if not r:
            print("  ✗", err)
            it["tries"] = it.get("tries", 0) + 1
            if it["tries"] < 3: rest.append(it)  # يُعاد في جولة لاحقة (نفاد الحصة أو خلل عابر)
            L["items"].append({"id": it.get("id"), "s": s, "t": it.get("t"), "at": today(), "ok": False, "msg": err + (" — يُعاد لاحقًا" if it["tries"] < 3 else "")}); continue
        miss = [m for m in (it.get("models") or ["1", "2", "3"]) if str(m) not in r["models"]]
        if miss and it.get("tries", 0) < 2:  # نموذج لم يكتمل: يُعاد وحده
            rest.append(dict(it, models=miss, tries=it.get("tries", 0) + 1))
        tp = jl(p) or {"s": s, "t": it.get("t"), "cats": it.get("cats", []), "seas": it.get("seas", []), "st": "draft", "at": today(), "models": {}, "ev": {}, "refs": {}, "qn": {}, "log": []}
        tp.setdefault("models", {}); tp.setdefault("ev", {}); tp.setdefault("refs", {}); tp.setdefault("qn", {}); tp.setdefault("log", [])
        tp["sum"] = tp.get("sum") or (r["plan"] or {}).get("sum", ""); tp["sub"] = tp.get("sub") or (r["plan"] or {}).get("sub", "")
        tp["kw"] = list(dict.fromkeys((tp.get("kw") or []) + (it.get("kw") or []) + ((r["plan"] or {}).get("kw") or [])))[:14]
        for k, v in r["ev"].items(): tp["ev"].setdefault(k, v)
        tp["refs"].update(r["refs"]); tp["qn"].update(r.get("qn") or {})
        for mk, M in r["models"].items():
            if (tp["models"].get(mk) or {}).get("st") == "ok": tp.setdefault("alt", {})[mk] = M  # المعتمد لا يُستبدل
            else: tp["models"][mk] = M
        tp["src"] = list(dict.fromkeys((tp.get("src") or []) + r["src"]))
        tp["upd"] = today(); tp["log"].append({"at": today(), "by": "gemini", "a": "مسودة من %d مصدرًا" % len(r["src"])})
        if tp.get("st") == "ok" and tp.get("alt"): pass
        elif tp.get("st") != "ok": tp["st"] = "draft"
        e, w = verify(tp)
        if not e:  # ما سلم من أخطاء التحقق ينتقل إلى «قيد المراجعة» (ولا يُنشر إلا باعتماد)
            for M in tp["models"].values():
                if M.get("st") == "draft" and (M.get("body") or "").strip(): M["st"] = "review"
            if tp.get("st") == "draft": tp["st"] = "review"
        js(p, tp)
        L["items"].append({"id": it.get("id"), "s": s, "t": it.get("t"), "at": today(), "ok": True, "msg": "مسودة: %d خطأ، %d تنبيه" % (len(e), len(w))})
    Q["items"] = rest; js(qp, Q)
    ok = sum(1 for x in L["items"][-done:] if x.get("ok")) if done else 0
    open(os.environ.get("KH_STATUS", "/tmp/kh-gen-status"), "w").write("%d %d\n" % (ok, len(rest)))  # للمهمة: هل تُستأنف الجولة التالية
    L["items"] = L["items"][-300:]; js(lp, L); reindex()


# ---------------- المتابعة الدورية ----------------
def cmd_watch():
    cats = jl(os.path.join(K, "cats.json"), {}) or {}; idx = (jl(os.path.join(K, "index.json"), {}) or {}).get("items", [])
    W = jl(os.path.join(K, "watch.json"), {}) or {}; last = W.get("at", "2026-01-01")
    have = {norm(x["t"]) for x in idx}
    up = season_hits(cats, int(os.environ.get("KH_LEAD", "60")))
    upcoming = []
    for sid, (d, n) in sorted(up.items(), key=lambda z: z[1][1]):
        S = next((x for x in cats.get("seasons", []) if x["id"] == sid), {})
        ok = [x["s"] for x in idx if sid in (x.get("seas") or []) and x.get("st") == "ok"]
        upcoming.append({"id": sid, "t": S.get("t", sid), "from": d, "in": n, "ready": len(ok), "need": max(0, int(S.get("need", 4)) - len(ok)), "ideas": S.get("ideas", [])})
    sug = []
    for u in upcoming:
        for idea in u["ideas"]:
            if norm(idea) not in have and u["need"] > 0: sug.append({"t": idea, "kind": "season", "seas": [u["id"]], "why": "موسم %s بعد %d يومًا" % (u["t"], u["in"])})
    # خطب «موعظة الأسبوع» الجديدة وموضوعاتها غير المغطاة
    for aid, x in arts().items():
        if x.get("tp") != "st15" or x.get("h"): continue
        t = re.sub(r"\s*\(موعظة الأسبوع\)\s*", "", x.get("t", "")).strip()
        core = re.sub(r"^.*?\)\s*", "", t) if ")" in t[:30] else t
        if any(len(set(norm(core).split()) & set(h.split())) >= max(2, len(norm(core).split()) // 2) for h in have): continue
        if (x.get("ad") or "") >= last or len(sug) < 40:
            sug.append({"t": core, "kind": "new" if (x.get("ad") or "") >= last else "uncovered", "src": [aid], "why": "من «موعظة الأسبوع» بصوت السلف"})
    # التصنيفات الفقيرة
    cnt = {}
    for x in idx:
        for c in x.get("cats") or []: cnt[c] = cnt.get(c, 0) + 1
    thin = [{"id": c["id"], "t": c["t"], "n": cnt.get(c["id"], 0)} for c in cats.get("topics", []) if cnt.get(c["id"], 0) < 3]
    # المراجعة: أخطاء التحقق، أو نماذج ناقصة، أو قدم التحديث
    rev = []
    for x in idx:
        why = []
        if x.get("qe"): why.append("%d خطأ في التحقق" % x["qe"])
        if len(x.get("ms") or {}) < 3: why.append("نماذج ناقصة (%d من ٣)" % len(x.get("ms") or {}))
        if x.get("upd") and x["upd"] < (datetime.date.today() - datetime.timedelta(days=365)).isoformat(): why.append("لم يحدث منذ سنة")
        if why: rev.append({"s": x["s"], "t": x["t"], "why": "، ".join(why)})
    # الإثراء: مصادر جديدة قريبة من موضوع قائم
    enrich = []
    new_src = [aid for aid, x in arts().items() if (x.get("ad") or "") >= last and not x.get("h") and x.get("col") not in ("ithra", "turath")][:400]
    if new_src and idx:
        for x in idx[:60]:
            r = retrieve(x["t"] + " " + " ".join(x.get("kw") or []), 3, new_src)
            if r and r[0]["sc"] > 6: enrich.append({"s": x["s"], "t": x["t"], "src": [{"b": y["b"], "title": y["title"]} for y in r]})
    # التكرار
    dup = []
    for i, a in enumerate(idx):
        for b in idx[i + 1:]:
            A, B = set(norm(a["t"]).split()), set(norm(b["t"]).split())
            if A and B and len(A & B) / len(A | B) >= .6: dup.append([a["s"], b["s"]])
    seen = set(); sug2 = []
    for s in sug:
        k = norm(s["t"])
        if k and k not in seen: seen.add(k); sug2.append(s)
    W = {"at": today(), "upcoming": upcoming, "sug": sug2[:80], "thin": thin, "review": rev, "enrich": enrich, "dup": dup}
    js(os.path.join(K, "watch.json"), W)
    print("المتابعة: %d موسمًا قريبًا، %d مقترحًا، %d للمراجعة، %d للإثراء" % (len(upcoming), len(sug2), len(rev), len(enrich)))
    # الإعداد الآلي للمواسم القريبة (مفتاح khutab_auto، معطل افتراضيًّا)؛ المخرج مسودات لا تُنشر إلا باعتماد
    sw = ((jl(os.path.join(D, "switches.json"), {}) or {}).get("s") or {})
    if sw.get("khutab_auto") is True:
        qp = os.path.join(K, "queue.json"); Q = jl(qp, {"items": []}) or {"items": []}
        inq = {norm(x.get("t", "")) for x in Q["items"]}; n = 0
        for s in sug2:
            if s["kind"] == "season" and norm(s["t"]) not in inq and n < int(os.environ.get("KH_AUTO_MAX", "2")):
                Q["items"].append({"id": "auto" + hashlib.md5(s["t"].encode()).hexdigest()[:6], "t": s["t"], "seas": s.get("seas", []), "kw": [], "by": "watch", "at": today()}); n += 1
        js(qp, Q)


# ---------------- استخراج نصوص المواد ----------------
def cmd_materials():
    mp = os.path.join(K, "materials.json"); M = jl(mp, {"items": []}) or {"items": []}; ch = False
    for m in M["items"]:
        f = m.get("file")
        if not f or m.get("x") or not os.path.exists(os.path.join(ROOT, f)): continue
        pages = []
        if f.lower().endswith(".pdf"):
            import subprocess
            try:
                out = subprocess.run(["pdftotext", "-layout", os.path.join(ROOT, f), "-"], capture_output=True, text=True, timeout=600).stdout
                pages = [p.strip() for p in out.split("\f") if p.strip()]
            except Exception as e: print("pdftotext:", e)
        elif f.lower().endswith(".txt"):
            pages = [p for p in re.split(r"\n{3,}", open(os.path.join(ROOT, f), encoding="utf-8", errors="ignore").read()) if p.strip()]
        if pages and sum(len(norm(p)) for p in pages) > 200:
            js(os.path.join(K, "mat", m["id"] + ".json"), {"id": m["id"], "t": m.get("t"), "pages": pages}); m["x"] = "ok"; m["np"] = len(pages)
        else: m["x"] = "ocr"  # مصور بلا طبقة نص: يحتاج التحويل الضوئي من «إدارة المواد»
        ch = True
    if ch: js(mp, M)


if __name__ == "__main__":
    a = sys.argv[1:] or ["reindex"]
    {"reindex": lambda: reindex(), "verify": lambda: cmd_verify(a[1:]), "gen": cmd_gen, "watch": cmd_watch, "materials": cmd_materials}[a[0]]()
