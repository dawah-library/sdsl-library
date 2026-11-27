#!/usr/bin/env python3
"""بيانات حزب النور والدعوة السلفية من «جامع البيانات» في أنا السلفي ومن أخبار الموقع الرسمي للحزب.
تُضاف مباشرة إلى المقالات (قسم البيانات) بمصدرها ورابطها، مع منع التكرار بالعنوان المطبَّع مع ما في الفهرس (وفيه صوت السلف).
الاستخدام: python3 tools/party-statements.py [--max N] [--dry]"""
import json, re, sys, time, urllib.request, urllib.parse, html, os, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ADIR = os.path.join(ROOT, "data", "articles"); IDX = os.path.join(ADIR, "index.json")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}
MAXN = int(sys.argv[sys.argv.index("--max") + 1]) if "--max" in sys.argv else 60
DRY = "--dry" in sys.argv
def get(u, t=3):
    u = urllib.parse.quote(u, safe=":/?&=%")
    for i in range(t):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read().decode("utf8", "ignore")
        except Exception as e:
            if i == t - 1: raise
            time.sleep(3)
def norm(s):
    s = re.sub(r"[\u064b-\u0652\u0640\u200b-\u200f]", "", str(s or ""))
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[«»\"'()\[\]،,.:؛؟!\-–—]", " ", s)
    return re.sub(r"\s+", " ", s).strip()
BAYAN = re.compile(r"^(بيان|صدر بيان)|^بيان")
def kind(t):  # party / dawah / None
    if not re.match(r"^\s*بيان", t): return None
    if re.search(r"حزب النور|الهيئة العليا|الأمانة العامة|نواب النور", t): return "party"
    if re.search(r"الدعوة السلفية|صوت السلف|مجلس إدارة الدعوة", t): return "dawah"
    return None
def shing(t):
    w = re.sub(r"[^\u0621-\u064a ]", " ", norm(t)).split(); return {" ".join(w[i:i+3]) for i in range(len(w) - 2)}
_oldsh = None
def is_dup_text(text, idx):  # تطابق نصي مع بيان قائم (صوت السلف أصل): جاكار 0.5 فأكثر
    global _oldsh
    if _oldsh is None:
        _oldsh = []; cache = {}
        for x in idx["items"]:
            if x.get("tp") == "at17" or re.match(r"^\s*[\"«]?بيان", x.get("t") or ""):
                g = x.get("f")
                if g not in cache: cache[g] = json.load(open(os.path.join(ADIR, g + ".json"), encoding="utf8"))
                _oldsh.append(shing(" ".join(cache[g].get(x["id"], {}).get("pages", []))))
    s = shing(text)
    return any(len(s & o) / max(1, len(s | o)) >= 0.5 for o in _oldsh)
def clean(x): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", x))).strip()
def article(u):
    h = get(u)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S); t = clean(m.group(1)) if m else ""
    d = (re.findall(r"20\d\d-\d\d-\d\d", h) or [""])[0]
    body = h[m.end():] if m else h
    body = re.split(r"مواد ذات صلة|اقرأ أيضا|شارك الخبر|<footer", body)[0]
    ps = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S):
        p = clean(p)
        if len(re.findall(r"[ء-ي]", p)) > 15 and p not in ps: ps.append(p)
    return t, d, "\n".join(ps)
def candidates():
    out = {}
    for p in range(1, 40):
        try: h = get("https://anasalafy.com/ar/category/" + urllib.parse.quote("جامع-البيانات") + f"?page={p}")
        except Exception: break
        ls = re.findall(r'href="(https://anasalafy\.com/ar/(\d+)-[^"]+)"', h)
        if not ls: break
        for u, i in ls:
            t = urllib.parse.unquote(u.split(f"/{i}-", 1)[1]).replace("-", " ")
            out.setdefault(u, ("anasalafy", i, t))
        time.sleep(0.2)
    for cat in ("news", "party-leader-activity"):
        for p in range(1, 8):
            try: h = get(f"https://alnourpartyeg.com/ar/category/{cat}?page={p}")
            except Exception: break
            for u, i in re.findall(r'href="(https://alnourpartyeg\.com/ar/(\d+)-[^"]+)"', h):
                t = urllib.parse.unquote(u.split(f"/{i}-", 1)[1]).replace("-", " ")
                out.setdefault(u, ("alnour", i, t))
            time.sleep(0.2)
    return out
def main():
    idx = json.load(open(IDX, encoding="utf8")); have = {norm(x["t"]) for x in idx["items"] if x.get("t")}
    haveu = {x.get("u") for x in idx["items"]}; pre = {n[:35] for n in have}
    CF = "/tmp/ps-cands.json"
    if os.path.exists(CF): cands = {k: tuple(v) for k, v in json.load(open(CF)).items()}
    else: cands = candidates(); json.dump(cands, open(CF, "w"))
    print("مرشحون:", len(cands), "بيانات بالعنوان:", sum(1 for v in cands.values() if kind(v[2])))
    groups = {}; got = {"party": 0, "dawah": 0}; today = datetime.date.today().isoformat(); seen_t = set()
    from concurrent.futures import ThreadPoolExecutor
    todo = [u for u, (src, i, slug) in cands.items() if kind(slug) and u not in haveu and norm(slug)[:35] not in pre]
    def safe(u):
        try: return article(u)
        except Exception as e: return None
    with ThreadPoolExecutor(8) as ex: PF = dict(zip(todo, ex.map(safe, todo)))
    print("جُلب:", len(PF))
    for u, (src, i, slug) in cands.items():
        if got["party"] + got["dawah"] >= MAXN: break
        k = kind(slug)
        if not k or u in haveu or norm(slug)[:35] in pre: continue
        if PF.get(u) is None: continue
        t, d, text = PF[u]
        k = kind(t) or k; nt = norm(t); d = ""  # التاريخ في الصفحة تاريخ تعديل لا نشر، فلا يُسجَّل
        if not t or len(text) < 150 or nt in have or nt in seen_t or is_dup_text(text, idx): continue
        seen_t.add(nt); sid = ("as" if src == "anasalafy" else "an") + i
        g = "undated"
        if g not in groups: groups[g] = json.load(open(os.path.join(ADIR, g + ".json"), encoding="utf8")) if os.path.exists(os.path.join(ADIR, g + ".json")) else {}
        groups[g][sid] = {"pages": [text]}
        idx["items"].append({"id": sid, "t": t, "a": "a10" if k == "party" else "a9", "tp": "at17", "c": "بيانات " + ("حزب النور" if k == "party" else "الدعوة السلفية"), "d": d, "u": u, "f": g, "n": 1, "ad": today, "src": src})
        _oldsh.append(shing(text)); got[k] += 1; print("✓", k, d, t[:70])
    print("الجديد:", got)
    if DRY or not any(got.values()): return
    for g, o in groups.items(): json.dump(o, open(os.path.join(ADIR, g + ".json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(idx, open(IDX, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
main()
