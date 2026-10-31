#!/usr/bin/env python3
"""اختبارات الكتب، تتجدد أسبوعيًا وتتنوع أساليبها (الباب ١٧):
  - من «سؤال وجواب» (data/qa): السؤال والجواب بنصهما، والبدائل أجوبة أخرى من الكتاب نفسه.
  - من نص الكتاب نفسه: «أكمل النص» (كلمة محذوفة يكتبها القارئ)، و«اختر الكلمة الصحيحة» (بدائلها من مفردات الكتاب)،
    و«صح أم خطأ» (العبارة كما في الكتاب، أو بكلمة مبدلة تجعلها خطأ، ويُعرض نص الكتاب بعد الإجابة).
  - لا تُستعمل جمل فيها آية أو حديث أو صلاة على النبي ﷺ في التبديل والحذف، صونًا للنصوص الشرعية.
  - التجديد: تُختار جمل مختلفة كل أسبوع (البذرة = الكتاب + رقم الأسبوع)، وتبقى أسئلة الإدارة اليدوية كما هي."""
import json, glob, random, re, pathlib, datetime
R = pathlib.Path(__file__).resolve().parent.parent; Q = R / "data" / "quizzes"; Q.mkdir(exist_ok=True)
cat = {b["id"]: b for b in json.loads((R / "data/catalog.json").read_text(encoding="utf-8"))["books"]}
def cut(s, n):
    s = re.sub(r"\s+", " ", s).strip(); s = re.split(r"(?<=[.؟!:])\s", s)[0] if len(s) > n else s
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + "…"
idx = json.loads((Q / "index.json").read_text(encoding="utf-8")) if (Q / "index.json").exists() else {"v": 1, "items": []}
items = {x["b"]: x for x in idx["items"]}
WEEK = datetime.date.today().isocalendar()[1] + datetime.date.today().year * 100
STOP = set("الذي التي الذين هذا هذه ذلك تلك كان كانت يكون فيه فيها عليه عليها إليه إلى على عن من في مع ثم أو أن إن لا لم لن قد كل بعض غير بين عند حتى إذا لما كما وهو وهي هو هي هم ما ولا وقد فإن وإن وأن الله تعالى".split())
SACRED = re.compile(r"[﴿﴾«»ﷺ]|صلى الله عليه|رضي الله|قال تعالى|قال رسول|عليه السلام")
def sents(pages):
    for i, pg in enumerate(pages):
        body = re.split(r"^\s*_{4,}\s*$", pg, flags=re.M)[0]
        for s_ in re.split(r"(?<=[.؟!])\s+|\n+", body):
            s_ = s_.strip().lstrip("#").strip(); w = s_.split()
            if 9 <= len(w) <= 28 and not SACRED.search(s_) and not re.search(r"\d{3,}|[A-Za-z]", s_): yield i + 1, s_
def textq(bid, pages, rnd):
    S = list(sents(pages)); out = []
    if len(S) < 30: return out
    vocab = [w for _, s_ in S for w in s_.split() if len(w) >= 4 and re.fullmatch(r"[\u0621-\u064A\u064B-\u0652]+", w) and w not in STOP]
    for k, (p, s_) in enumerate(rnd.sample(S, min(len(S), 45))):
        w = s_.split(); cand = [i for i, x in enumerate(w) if i > 1 and len(x) >= 4 and re.fullmatch(r"[\u0621-\u064A\u064B-\u0652]+", x) and x not in STOP]
        if not cand: continue
        j = rnd.choice(cand); key = w[j]; blank = " ".join(w[:j] + ["……"] + w[j + 1:])
        kind = ("cloze", "mcqw", "tf")[k % 3]; qid = "tx%s%d" % (WEEK, k)
        if kind == "cloze": out.append({"id": qid, "type": "cloze", "lvl": "hard", "q": blank, "a": key, "p": p, "ok": True, "src": "text", "ctx": s_})
        elif kind == "mcqw":
            dis = [x for x in dict.fromkeys(rnd.sample(vocab, min(len(vocab), 40))) if x != key and abs(len(x) - len(key)) <= 2][:3]
            if len(dis) < 3: continue
            opts = dis + [key]; rnd.shuffle(opts)
            out.append({"id": qid, "type": "mcq", "lvl": "easy", "q": "اختر الكلمة الصحيحة: " + blank, "opts": opts, "a": key, "p": p, "ok": True, "src": "text"})
        else:
            tr = rnd.random() < 0.5; alt = next((x for x in rnd.sample(vocab, min(len(vocab), 40)) if x != key and abs(len(x) - len(key)) <= 2), None)
            if not tr and not alt: continue
            out.append({"id": qid, "type": "tf", "lvl": "mid", "q": s_ if tr else " ".join(w[:j] + [alt] + w[j + 1:]), "a": "صح" if tr else "خطأ", "p": p, "ok": True, "src": "text", "ctx": s_})
    return out

def book_pages(bid):
    f = R / "data" / "books" / (bid + ".json")
    try: return json.loads(f.read_text(encoding="utf-8")).get("pages") or []
    except Exception: return []

for bid, b in cat.items():  # كتب بلا «سؤال وجواب»: أسئلة من نصها (كتب الدعوة والمتون القصيرة)
    if b.get("hidden") or b.get("vf") or b.get("type") == "article" or (R / "data/qa" / (bid + ".json")).exists(): continue
    if (b.get("col") or "dawah") != "dawah" and (b.get("n") or 0) > 400: continue
    pages = book_pages(bid)
    if len(pages) < 5: continue
    sh = json.loads((R / "data/books" / (bid + ".json")).read_text(encoding="utf-8"))
    bad = set(sh.get("lite") or []) | set(sh.get("unrev") or [])  # لا أسئلة من صفحات لم يكتمل تدقيقها
    pages = [("" if i in bad else t) for i, t in enumerate(pages)]
    out_f = Q / (bid + ".json"); old = json.loads(out_f.read_text(encoding="utf-8")) if out_f.exists() else {"qs": []}
    manual = [q for q in old.get("qs", []) if q.get("src") not in ("qa", "text")]
    tq = textq(bid, pages, random.Random("%s-%d" % (bid, WEEK)))
    if len(tq) < 9 and not manual: continue
    allq = manual + tq
    out_f.write_text(json.dumps({"v": 1, "b": bid, "at": str(datetime.date.today()), "qs": allq}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lv = {}
    for q in allq:
        if q.get("ok"): lv[q["lvl"]] = lv.get(q["lvl"], 0) + 1
    items[bid] = {"b": bid, "n": sum(lv.values()), "lv": lv}

for f in sorted(glob.glob(str(R / "data/qa/*.json"))):
    bid = pathlib.Path(f).stem
    if bid.startswith("_") or bid not in cat or cat[bid].get("hidden"): continue
    qa = [x for x in json.loads(open(f, encoding="utf-8").read())["items"] if len(x.get("q", "")) >= 30 and len(x.get("a", "")) >= 30 and not re.match(r"^\(?\d*\)?\s*هل\s", x["q"].strip())]
    if len(qa) < 8: continue
    out_f = Q / (bid + ".json")
    old = json.loads(out_f.read_text(encoding="utf-8")) if out_f.exists() else {"qs": []}
    manual = [q for q in old.get("qs", []) if q.get("src") not in ("qa", "text")]
    rnd = random.Random("%s-%d" % (bid, WEEK)); qs = []
    rnd.shuffle(qa)
    for x in qa[:60]:
        a = cut(x["a"], 220); others = [cut(y["a"], 220) for y in qa if y is not x]
        dis = [o for o in rnd.sample(others, min(len(others), 6)) if o != a][:3]
        if len(dis) < 3: continue
        opts = dis + [a]; rnd.shuffle(opts)
        qs.append({"id": "qa" + x["id"], "type": "mcq", "lvl": "hard", "q": cut(x["q"], 400), "opts": opts, "a": a, "p": x.get("p", 1), "ok": True, "src": "qa"})
    qs.sort(key=lambda q: len(q["q"]) + len(q["a"]))
    for i, q in enumerate(qs): q["lvl"] = ("easy", "mid", "hard")[min(2, i * 3 // max(1, len(qs)))]
    allq = manual + qs + textq(bid, book_pages(bid), random.Random("t%s-%d" % (bid, WEEK)))[:24]
    out_f.write_text(json.dumps({"v": 1, "b": bid, "at": str(datetime.date.today()), "qs": allq}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lv = {}
    for q in allq:
        if q.get("ok"): lv[q["lvl"]] = lv.get(q["lvl"], 0) + 1
    items[bid] = {"b": bid, "n": sum(lv.values()), "lv": lv}
idx["items"] = sorted(items.values(), key=lambda x: -x["n"])
(Q / "index.json").write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(idx["items"]), "كتابًا،", sum(x["n"] for x in idx["items"]), "سؤالًا")
