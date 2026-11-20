#!/usr/bin/env python3
"""التدقيق العلمي الشامل لكتاب (المرحلة ٢ من خطة المدير، ٢٠ نوفمبر ٢٠٢٦).

يجمع في تقرير واحد لكل كتاب: (١) فحص الآيات (data/quran-check)، (٢) نص حديث أو أثر بين قوسي الآية،
(٣) علامات التنصيص والأقواس غير المغلقة، (٤) الكلمات المكررة متتابعة، (٥) الصفحات المشوهة من طبقة النص
(tools/ocr-quality.py: المفتتة ورموز الخطوط) التي تُعاد قراءتها من المصورة.

لا يغيّر نص الكتاب: التصحيحات القطعية تُضاف اقتراحاتٍ إلى data/proof/<id>.json فتعتمدها الإدارة في #/proof،
وما يحتاج نظرًا يبقى في التقرير data/audit/sci/<id>.json. لا يُغيَّر لفظ آية ولا حديث ولا نقل هنا أبدًا:
المقترح تصحيح علامات فقط (أقواس، تنصيص)، واللفظ يُصحَّح من المصورة بالتدقيق الدوري.

الاستعمال: python3 tools/sci-audit.py <معرفات…> [--propose]
"""
import hashlib, importlib.util, json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
H = lambda t: hashlib.md5((t or "").encode("utf-8")).hexdigest()[:10]
DI = re.compile(r"[ً-ْٰـ]")
EOQ = re.compile(r"\s*،?\s*(ا\.\s?هـ|اهـ|انتهى)")


def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def js(p, o, compact=True):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))


def quality():
    sp = importlib.util.spec_from_file_location("oq", os.path.join(ROOT, "tools", "ocr-quality.py"))
    m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m


def audit(bid):
    cat = jl(os.path.join(D, "catalog.json")); b = next((x for x in cat["books"] if x["id"] == bid), None)
    if not b: sys.exit("لا يوجد كتاب " + bid)
    sh = jl(os.path.join(D, "books", bid + ".json")) or jl(os.path.join(ROOT, "vols", bid + ".json")); P = sh["pages"]
    qc = jl(os.path.join(D, "quran-check", bid + ".json"), {}) or {}
    oq = quality(); full = "\n".join(P)
    rep = {"id": bid, "t": b["title"], "at": datetime.date.today().isoformat(), "pages": len(P),
           "quran": {"n": qc.get("n", 0), "ok": qc.get("ok", 0)}, "items": [], "bad": []}
    fx = {}
    add = lambda p, k, frm, to, why: fx.setdefault(p, []).append({"k": k, "from": frm, "to": to, "why": why})
    item = lambda p, k, t, note: rep["items"].append({"p": p, "k": k, "t": t[:300], "note": note})
    # ١) الآيات: لفظ قريب من المصحف أو ناقص ← للمراجعة على المصورة (لا تصحيح آلي للفظ هنا)
    for i in qc.get("issues", []):
        if i["k"] in ("near", "missing") and i.get("r", 0) >= 0.6:
            item(i["p"], "آية", i["t"], "لفظ يخالف المصحف (%d٪) — أقرب آية: %s:%s" % (round(i["r"] * 100), i.get("s"), i.get("a")))
    # ٢) حديث أو كلام بين قوسي الآية: ﴿…﴾ دائمًا، و{…} إن كان الكتاب يستعمل ﴿﴾ للآيات (فالمعقوفان تحويل خاطئ لهما)
    braces_q = "﴿" in full
    for i in qc.get("issues", []):
        if i["k"] != "nq": continue
        t, p = i["t"], i["p"]; pg = P[p - 1]
        for o, c in (("﴿", "﴾"), ("{", "}")):
            if o == "{" and not braces_q: continue
            frm = o + t + c
            if pg.count(frm) == 1:
                add(p, "قوس", frm, "«" + t + "»", "ليس آية من القرآن: يوضع بين علامتي التنصيص لا بين قوسي الآية (يُطابَق على المصورة)")
                break
    # ٣) التنصيص غير المغلق في الفقرة؛ وإن انتهى النقل بـ«ا.هـ» فالإغلاق قبلها قطعي
    for pi, pg in enumerate(P, 1):
        for para in pg.split("\n"):
            no, nc = para.count("«"), para.count("»")
            if no == nc: continue
            k = para.rfind("«"); m = EOQ.search(para, k) if no > nc and k >= 0 else None
            if m and "»" not in para[k:m.start()] and no - nc == 1:
                seg = para[max(k, m.start() - 30):m.end()]
                if pg.count(seg) == 1:
                    add(pi, "تنصيص", seg, seg[:m.start() - max(k, m.start() - 30)] + "»" + seg[m.start() - max(k, m.start() - 30):], "النقل ينتهي بـ«ا.هـ» ولم تُغلق علامة التنصيص قبله"); continue
            item(pi, "تنصيص", para, "علامات التنصيص غير متوازنة (« %d، » %d): يُنظر أين ينتهي النقل — وقد يمتد النقل إلى فقرة تالية" % (no, nc))
    # ٤) كلمة مكررة متتابعة (قد تكون مقصودة كالتوكيد؛ للمراجعة فقط)
    for pi, pg in enumerate(P, 1):
        for m in re.finditer(r"(?<![ء-ي])([ء-ي]{2,})\s+\1(?![ء-ي])", DI.sub("", pg)):
            if m.group(1) not in ("لا", "كلا", "حتى"): item(pi, "تكرار", m.group(0), "كلمة مكررة متتابعة")
    # ٥) الصفحات المشوهة من طبقة النص ← تُعاد قراءتها من المصورة (unrev)
    rep["bad"] = [i + 1 for i, t in enumerate(P) if oq.page_bad(t)]
    for p in rep["bad"]: fx.pop(p, None)  # الصفحة المشوهة تُعاد قراءتها كلها من المصورة؛ لا اقتراحات جزئية عليها
    rep["fx"] = sum(len(v) for v in fx.values())
    return rep, fx, sh


def propose(bid, fx, sh):
    pp = os.path.join(D, "proof", bid + ".json"); R = jl(pp) or {"id": bid, "pages": {}}
    n = 0
    for p, L in fx.items():
        pg = R["pages"].setdefault(str(p), {"h": H(sh["pages"][p - 1]), "fx": []}); old = {(x["from"], x["to"]) for x in pg.get("fx", [])}
        for f in L:
            if (f["from"], f["to"]) not in old: pg.setdefault("fx", []).append(f); n += 1
        pg["at"] = datetime.date.today().isoformat()
    js(pp, R)
    lp = os.path.join(D, "proof", "_list.json"); Lst = jl(lp, {})
    e = Lst.setdefault(bid, {"t": (next((b["title"] for b in jl(os.path.join(D, "catalog.json"))["books"] if b["id"] == bid), bid)), "n": 0, "done": 0, "of": len(sh["pages"])})
    e["n"] = sum(len(v.get("fx") or []) for v in R["pages"].values()); e["upd"] = datetime.date.today().isoformat(); e["sci"] = 1
    js(lp, Lst)
    return n


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    for bid in ids:
        rep, fx, sh = audit(bid)
        js(os.path.join(D, "audit", "sci", bid + ".json"), rep, compact=False)
        n = propose(bid, fx, sh) if "--propose" in sys.argv else 0
        print("%s «%s»: آيات %d (مطابقة %d)، اقتراحات قطعية %d (أضيف %d)، للمراجعة %d، صفحات تُعاد من المصورة %d" % (
            bid, rep["t"], rep["quran"]["n"], rep["quran"]["ok"], rep["fx"], n, len(rep["items"]), len(rep["bad"])))
