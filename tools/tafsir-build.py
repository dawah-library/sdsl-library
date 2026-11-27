#!/usr/bin/env python3
"""تفاسير المصحف المطولة وتدقيق نسخ الموقع على المصحف (طلب المدير، ٢٧ نوفمبر ٢٠٢٦).

١) الطبري (جامع البيان، بتحقيق شاكر حيث وُجد)، والقرطبي (الجامع لأحكام القرآن)، وابن كثير (تفسير القرآن العظيم):
   من مجموعة spa5k/tafsir_api المفتوحة (مصدرها QUL/tarteel)، وفيها نص المقطع مكررًا لكل آية من آياته؛
   فيُجمع المكرر المتتالي مقطعًا واحدًا [من، إلى] ويُبنى ملف لكل صفحة من صفحات مصحف المدينة (٦٠٤):
   vols/tafsir/<المفتاح>/<الصفحة>.json = {"k","p","g": [[السورة، أول آية، آخر آية، النص]…]}
   والمقطع العابر لصفحتين يُكرر في كلتيهما. الحواشي [[…]] تبقى في النص وتعرضها الواجهة حواشيَ مرقمة.
   (vols/tafsir خارج نشر Cloudflare لحد عدد الملفات، ويُقرأ من المستودع كسائر vols.)
٢) التدقيق على المصحف لكل تفسير (الثلاثة والمختصر والميسر والسعدي):
   - الشمول: لكل آية من ٦٢٣٦ تفسير (أو مقطع يشملها)، ولا مفاتيح زائدة على عدد آيات السورة.
   - المحاذاة: أول آية مقتبسة ﴿…﴾ في المقطع ينبغي أن تكون من آياته؛ فإن كانت من الآية المجاورة فقط عُدّ «انزياحًا محتملًا».
   - النظافة: علامات الاتجاه، والمسافات الصلبة، و\\" المهربة، وأرقام صفحات المطبوع «< 1-599 >»، وأقواس الحواشي غير المتوازنة.
٣) إصلاح نسخ الموقع الصغيرة (data/quran/tafsir): الميسر ← فصل «تسمية السورة/مقاصدها» إلى المفتاح "0" (مقدمة السورة)
   بدل إلصاقها بتفسير الآية الأولى؛ السعدي ← تنظيف ما سبق، وملء الآيات المفسرة مع ما قبلها بنص مقطعها (كما في سائر المصادر).
التقرير: data/quran-check/tafsir-audit.json.

الاستعمال: python3 tools/tafsir-build.py [--fetch] [--only tabari,qurtubi,ibnkathir] [--no-fix]
  TF_CACHE: مجلد نسخة المصدر (الافتراضي /tmp/tafsir-src)؛ --fetch ينزّل الناقص منه."""
import json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = os.path.join(ROOT, "data", "quran")
OUT = os.path.join(ROOT, "vols", "tafsir")
REP = os.path.join(ROOT, "data", "quran-check", "tafsir-audit.json")
BIG = {"tabari": ("ar-tafsir-al-tabari", "جامع البيان عن تأويل آي القرآن (تفسير الطبري)"),
       "qurtubi": ("ar-tafseer-al-qurtubi", "الجامع لأحكام القرآن (تفسير القرطبي)"),
       "ibnkathir": ("ar-tafsir-ibn-kathir", "تفسير القرآن العظيم (تفسير ابن كثير)")}
SMALL = {"mokhtasar": "المختصر في التفسير", "muyassar": "التفسير الميسر", "saddi": "تفسير السعدي"}
RAW = "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/%s/%d.json"
DROP = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]")


def norm(t):
    t = DROP.sub("", t or "")
    for a, b in (("ٱ", "ا"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ؤ", "و"), ("ئ", "ي"), ("ء", ""), ("ة", "ه"), ("ى", "ي"), ("ی", "ي")):
        t = t.replace(a, b)
    t = re.sub(r"[^ء-ي ]", " ", t)
    return re.sub(r"[اوي]", "", re.sub(r"\s+", " ", t)).strip()  # هيكل بلا حروف المد: يجمع الرسم العثماني والإملائي


def clean(t):
    t = (t or "").replace("‏", "").replace("‎", "").replace("\xa0", " ").replace("﻿", "").replace('\\"', '"')
    t = re.sub(r"\s*<\s*\d+\s*-\s*\d+\s*>\s*", " ", t)          # رقم الجزء-الصفحة من المطبوع
    t = re.sub(r"[ \t]+\n", "\n", re.sub(r"[ \t]{2,}", " ", t))
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def get(u, tries=4):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "sdsl-library"}), timeout=120))
        except Exception as e:
            err = e; time.sleep(2 * (i + 1))
    raise err


def fetch(cache, ed):
    os.makedirs(os.path.join(cache, ed), exist_ok=True)
    def one(s):
        p = os.path.join(cache, ed, "%d.json" % s)
        if not os.path.exists(p) or os.path.getsize(p) < 50:
            json.dump(get(RAW % (ed, s)), open(p, "w", encoding="utf-8"), ensure_ascii=False)
    with ThreadPoolExecutor(8) as ex: list(ex.map(one, range(1, 115)))


def load_mushaf():
    U = json.load(open(os.path.join(Q, "quran.json"), encoding="utf-8"))["suras"]
    M = json.load(open(os.path.join(Q, "meta.json"), encoding="utf-8"))["s"]
    ay = [[norm(a) for a in s["ayat"]] for s in U]
    return ay, M


def first_quote(t):
    for m in re.finditer(r"﴿([^﴾]{3,400})﴾|\{([^{}\d][^{}]{2,400})\}", t):
        q = norm(m.group(1) or m.group(2))
        if len(q.split()) >= 2: return q
    return ""


def align(ay, s, a, b, t):
    """0: لا اقتباس يُحكم به، 1: أول اقتباس من آيات المقطع، -1: من الآية المجاورة فقط (انزياح محتمل)."""
    q = first_quote(t)
    if not q: return 0
    A = ay[s - 1]
    if any(q in A[i - 1] for i in range(a, b + 1)): return 1
    # الاقتباس قد يمتد على آيتين متتاليتين
    if any(q in (A[i - 1] + " " + A[i]) for i in range(max(1, a - 1), min(len(A), b + 1))): return 1
    near = [i for i in (a - 1, b + 1) if 1 <= i <= len(A) and q in A[i - 1]]
    return -1 if near else 0


def lex(ay, s, a, b, t):
    """للتفاسير التي تشرح بالمعنى (المختصر والميسر): نسبة ألفاظ الآية في نص تفسيرها، مقارنةً بالآية المجاورة.
    -1 إن كانت المجاورة أقرب بوضوح (انزياح محتمل)، 1 إن كانت آيات المقطع أقرب، 0 إن تعذر الحكم."""
    A, T = ay[s - 1], set(w for w in norm(t[:3000]).split() if len(w) >= 3)
    if not T: return 0
    def sc(i):
        W = [w for w in A[i - 1].split() if len(w) >= 3]
        return sum(w in T for w in W) / len(W) if len(W) >= 3 else None
    own = [x for x in (sc(i) for i in range(a, b + 1)) if x is not None]
    if not own: return 0
    o = max(own); nb = [x for x in (sc(i) for i in (a - 1, b + 1) if 1 <= i <= len(A)) if x is not None]
    if nb and max(nb) >= o + .35 and o < .25: return -1
    return 1 if o >= .2 else 0


def groups_big(cache, ed):
    out = {}
    for s in range(1, 115):
        L = json.load(open(os.path.join(cache, ed, "%d.json" % s), encoding="utf-8"))
        L = L.get("ayahs", L) if isinstance(L, dict) else L
        G = []
        for x in sorted(L, key=lambda x: int(x.get("ayah") or x.get("verse"))):
            a, t = int(x.get("ayah") or x.get("verse")), clean(x.get("text"))
            if G and G[-1][2] == t and G[-1][1] == a - 1: G[-1][1] = a
            else: G.append([a, a, t])
        out[s] = G
    return out


def audit(key, G, ay):
    """G: {سورة: [[من، إلى، نص]…]} ← سطر التقرير."""
    r = {"name": BIG.get(key, (0, SMALL.get(key)))[1], "groups": 0, "covered": 0, "missing": [], "extra": [], "empty": [],
         "aligned": 0, "quoted": 0, "shift": [], "fn_unbalanced": [], "dirty": 0}
    for s, L in G.items():
        n = len(ay[s - 1]); seen = set()
        for a, b, t in L:
            r["groups"] += 1
            if b > n or a < 1: r["extra"].append("%d:%d" % (s, a)); continue
            seen.update(range(a, b + 1))
            if not t.strip(): r["empty"].append("%d:%d" % (s, a)); continue
            if t.count("[[") != t.count("]]"): r["fn_unbalanced"].append("%d:%d" % (s, a))
            if re.search(r"[‏\xa0]|\\\"|<\s*\d+-\d+\s*>", t): r["dirty"] += 1
            v = align(ay, s, a, b, t) or lex(ay, s, a, b, t)
            if v: r["quoted"] += 1
            if v == 1: r["aligned"] += 1
            if v == -1: r["shift"].append("%d:%d-%d" % (s, a, b))
        miss = [a for a in range(1, n + 1) if a not in seen]
        r["covered"] += n - len(miss); r["missing"] += ["%d:%d" % (s, a) for a in miss]
    r["align_pct"] = round(100 * r["aligned"] / max(1, r["quoted"]), 1)
    for k in ("missing", "extra", "empty", "shift", "fn_unbalanced"): r["n_" + k] = len(r[k]); r[k] = r[k][:60]
    return r


def build_pages(key, G, M):
    pages = {}
    for s, L in G.items():
        for a, b, t in L:
            for p in sorted({M[str(s)][i - 1][0] for i in range(a, b + 1)}):
                pages.setdefault(p, []).append([s, a, b, t])
    d = os.path.join(OUT, key); os.makedirs(d, exist_ok=True)
    for p in range(1, 605):
        json.dump({"k": key, "p": p, "g": pages.get(p, [])}, open(os.path.join(d, "%d.json" % p), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    return sum(len(json.dumps(v, ensure_ascii=False).encode()) for v in pages.values())


def small_groups(key, fix):
    """نسخة الموقع الصغيرة ← مقاطع (المكرر المتتالي مقطع واحد)، مع إصلاحها إن طُلب."""
    G, changed = {}, 0
    for s in range(1, 115):
        p = os.path.join(Q, "tafsir", key, "%d.json" % s)
        d = json.load(open(p, encoding="utf-8")); o = json.dumps(d, ensure_ascii=False)
        if fix:
            for k in list(d):
                if isinstance(d[k], str): d[k] = clean(d[k])
            if key == "muyassar" and "[التفسير]" in d.get("1", ""):
                intro, body = d["1"].split("[التفسير]", 1)
                d["0"] = intro.strip(); d["1"] = body.strip()
            if key == "saddi":   # الآية المفسرة مع ما قبلها: نص مقطعها (الواجهة تجمع المتطابق المتتالي)
                last = None
                for a in range(1, len(AY[s - 1]) + 1):
                    if str(a) in d: last = d[str(a)]
                    elif last: d[str(a)] = last
            d = {k: d[k] for k in sorted(d, key=int)}
            if json.dumps(d, ensure_ascii=False) != o:
                json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":")); changed += 1
        L = []
        for k in sorted((k for k in d if k.isdigit() and k != "0"), key=int):
            a, t = int(k), d[k]
            if L and L[-1][2] == t and L[-1][1] == a - 1: L[-1][1] = a
            else: L.append([a, a, t])
        G[s] = L
    return G, changed


def main():
    global AY
    args = sys.argv[1:]
    only = next((a.split("=", 1)[1] if "=" in a else args[args.index(a) + 1] for a in args if a.startswith("--only")), "")
    keys = [k for k in BIG if not only or k in only.split(",")]
    cache = os.environ.get("TF_CACHE", "/tmp/tafsir-src")
    AY, M = load_mushaf()
    rep = json.load(open(REP, encoding="utf-8")) if os.path.exists(REP) else {}
    rep["date"] = time.strftime("%Y-%m-%d"); rep.setdefault("t", {})
    for k in keys:
        ed = BIG[k][0]
        if "--fetch" in args: fetch(cache, ed)
        G = groups_big(cache, ed)
        size = build_pages(k, G, M)
        r = audit(k, G, AY); r["src"] = "spa5k/tafsir_api: " + ed; r["bytes"] = size
        rep["t"][k] = r
        print("%s: %d مقطع، شمول %d/6236، محاذاة %.1f%%، انزياح محتمل %d، حواشٍ غير متوازنة %d، %.1f م.ب" % (k, r["groups"], r["covered"], r["align_pct"], r["n_shift"], r["n_fn_unbalanced"], size / 1e6))
    if not only:
        for k in SMALL:
            G, ch = small_groups(k, "--no-fix" not in args)
            r = audit(k, G, AY); r["fixed_files"] = ch; rep["t"][k] = r
            print("%s: شمول %d/6236، محاذاة %.1f%%، انزياح محتمل %d، ملفات أُصلحت %d" % (k, r["covered"], r["align_pct"], r["n_shift"], ch))
    os.makedirs(os.path.dirname(REP), exist_ok=True)
    json.dump(rep, open(REP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


AY = None
if __name__ == "__main__":
    main()
