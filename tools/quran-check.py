#!/usr/bin/env python3
"""فحص الآيات في الكتب: كل نص بين ﴿ ﴾ (أو { }) يُقارن بنص المصحف، ويُتحقق من أن السورة المذكورة في حاشيته هي سورته.

النتيجة لكل كتاب في data/quran-check/<id>.json:
  {"n": عدد الآيات المفحوصة, "ok": المطابقة, "issues": [{"p": رقم الصفحة من 1, "t": النص في الكتاب,
     "k": "near"|"missing"|"sura", "best": أقرب نص في المصحف, "s": السورة, "a": الآية, "r": نسبة التطابق, "diff": [كلمات مختلفة]}]}
وتُضاف مواضع الخلل إلى مواضع الشك في الكتاب (unc) ليراجعها المدقق، ولا يُغيَّر نص الكتاب آليًا.
نص المصحف (الرسم الإملائي المبسط) يُحفظ مرة واحدة في data/quran/quran.json من مصدر مفتوح.

الاستعمال: python3 tools/quran-check.py [معرفات الكتب...]  (بلا معرفات: كتب مكتبة الدعوة)
"""
import difflib, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QP = os.path.join(ROOT, "data", "quran", "quran.json")
OUT = os.path.join(ROOT, "data", "quran-check")
VERSE = re.compile(r"[﴿{]\s*([^{}﴿﴾]{4,1500}?)\s*[﴾}]")
DROP = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]")


def norm(t):
    t = DROP.sub("", t or "")
    t = t.replace("ٱ", "ا").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ؤ", "و").replace("ئ", "ي")
    t = t.replace("ء", "").replace("ة", "ه").replace("ى", "ي").replace("ی", "ي")
    t = re.sub(r"[^ء-ي ]", " ", t)
    t = re.sub(r"\bالايه\b|\bالايات\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def skel(w):
    """هيكل الكلمة دون الألف والواو والياء: يجمع بين الرسم العثماني والإملائي (الصلوه/الصلاه، الكتب/الكتاب)."""
    return re.sub(r"[اوي]", "", w)


def load_quran():
    if os.path.exists(QP):
        return json.load(open(QP, encoding="utf-8"))
    q = None
    for url in ("https://api.alquran.cloud/v1/quran/quran-simple-clean", "https://api.alquran.cloud/v1/quran/quran-simple"):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "sdsl-library"}), timeout=120) as r:
                j = json.loads(r.read())
            q = {"src": url, "suras": [{"n": s["number"], "name": s["name"], "ayat": [a["text"] for a in s["ayahs"]]} for s in j["data"]["surahs"]]}
            break
        except Exception as e:
            print("تعذر", url, e)
    if not q:
        sys.exit("تعذر تنزيل نص المصحف")
    os.makedirs(os.path.dirname(QP), exist_ok=True)
    json.dump(q, open(QP, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    return q


class Index:
    def __init__(self, q):
        self.words, self.pos = [], []  # كل كلمات المصحف متتابعة، وموضع كل كلمة (سورة، آية)
        self.sname = {}
        for s in q["suras"]:
            self.sname[s["n"]] = norm(re.sub(r"^سورة\s*", "", s["name"]))
            for i, a in enumerate(s["ayat"], 1):
                for w in norm(a).split():
                    self.words.append(skel(w)); self.pos.append((s["n"], i))
        self.tri = {}
        for i in range(len(self.words) - 2):
            self.tri.setdefault(tuple(self.words[i:i + 3]), []).append(i)

    def find(self, text):
        ws = [skel(w) for w in norm(text).split()]
        if len(ws) < 3:
            return None
        votes = {}
        for i in range(len(ws) - 2):
            for p in self.tri.get(tuple(ws[i:i + 3]), [])[:300]:
                votes[p - i] = votes.get(p - i, 0) + 1
        if not votes:
            return {"r": 0.0}
        start = max(votes, key=votes.get)
        start = max(0, start)
        cand = self.words[start:start + len(ws)]
        sm = difflib.SequenceMatcher(None, ws, cand, autojunk=False)
        r = sm.ratio()
        diff = [" ".join(ws[a:b]) for tag, a, b, c, d in sm.get_opcodes() if tag != "equal" and b > a][:8]
        s, a = self.pos[min(start, len(self.pos) - 1)]
        return {"r": round(r, 3), "s": s, "a": a, "start": start, "len": len(ws), "diff": diff}

    def text_at(self, q, start, n):
        s0, a0 = self.pos[start]; s1, a1 = self.pos[min(start + n - 1, len(self.pos) - 1)]
        out = []
        for s in q["suras"]:
            if s0 <= s["n"] <= s1:
                for i, t in enumerate(s["ayat"], 1):
                    if (s["n"], i) >= (s0, a0) and (s["n"], i) <= (s1, a1):
                        out.append(t)
        return " ".join(out)[:600]


FN_REF = re.compile(r"^\s*\(([\d٠-٩]{1,3})\)\s*(?:من\s+)?(?:سورة\s+)?([^\s\d٠-٩(]+(?:\s+[^\s\d٠-٩(]+)?)\s+(?:الآية|الآيات|الآيتان|آية|من الآية)")


def fn_suras(page):
    """رقم الحاشية ← اسم السورة المذكور فيها."""
    out = {}
    if "____" not in page:
        return out
    for line in page.split("____", 1)[1].split("\n"):
        line = line.strip("_ ").strip()
        m = FN_REF.match(line)
        if m:
            out[m.group(1).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))] = norm(m.group(2))
    return out


def check_book(bid, q, ix):
    path = os.path.join(ROOT, "data", "books", bid + ".json")
    if not os.path.exists(path):
        return None
    sh = json.load(open(path, encoding="utf-8"))
    res = {"n": 0, "ok": 0, "issues": []}
    for pi, page in enumerate(sh["pages"]):
        body = page.split("____")[0] if page else ""
        fns = fn_suras(page or "")
        for m in VERSE.finditer(body):
            raw = m.group(1)
            parts = [x for x in re.split(r"\.{2,}|…", raw) if len(norm(x).split()) >= 3]
            if not parts:
                continue
            res["n"] += 1
            bad = None
            for part in parts:
                f = ix.find(part)
                if not f or f.get("r", 0) >= 0.97:
                    continue
                kind = "near" if f["r"] >= 0.6 else "missing"
                bad = {"p": pi + 1, "t": raw[:400], "k": kind, "r": f["r"], "diff": f.get("diff", [])}
                if "start" in f:
                    bad.update({"s": f["s"], "a": f["a"], "best": ix.text_at(q, f["start"], f["len"]) if kind == "near" else ""})
                break
            if not bad:
                # السورة المذكورة في الحاشية التي تلي الآية مباشرة (إن وُجدت)
                tail = body[m.start() - 40:m.start()]
                mk = re.findall(r"\(([\d٠-٩]{1,3})\)", tail)
                f = ix.find(parts[0])
                if mk and f and f.get("s"):
                    k = mk[-1].translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))
                    named = fns.get(k)
                    real = ix.sname.get(f["s"], "")
                    if named and real and named not in real and real not in named:
                        bad = {"p": pi + 1, "t": raw[:400], "k": "sura", "r": f["r"], "s": f["s"], "a": f["a"], "named": named, "real": real}
            if bad:
                res["issues"].append(bad)
            else:
                res["ok"] += 1
    return res, sh, path


def main():
    q = load_quran()
    ix = Index(q)
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    ids = sys.argv[1:] or [b["id"] for b in cat["books"] if b.get("col", "dawah") == "dawah" and b.get("type", "book") == "book" and not b.get("demo")]
    os.makedirs(OUT, exist_ok=True)
    rep, summary = [], {}
    for bid in ids:
        r = check_book(bid, q, ix)
        if not r:
            continue
        res, sh, path = r
        json.dump(res, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        summary[bid] = {"n": res["n"], "bad": len(res["issues"])}
        # مواضع الخلل إلى مواضع الشك في الكتاب ليقدّمها التدقيق
        if res["issues"]:
            unc = dict(sh.get("unc") or {})
            for it in res["issues"]:
                k = str(it["p"] - 1)
                lab = "(آية: %s)" % (" ".join(it.get("diff") or []) or it["t"][:30])
                if lab not in unc.get(k, []):
                    unc[k] = (unc.get(k, []) + [lab])[:40]
            sh["unc"] = unc
            s = json.dumps(sh, ensure_ascii=False, separators=(",", ":"))
            open(path, "w", encoding="utf-8").write(s)
            for b in cat["books"]:
                if b["id"] == bid:
                    b["unc"] = sum(len(v) for v in unc.values()); b["size"] = len(s.encode())
        rep.append("- %s: %d آية، فيها %d موضع خلل" % (bid, res["n"], len(res["issues"])))
        print(rep[-1], flush=True)
    json.dump(cat, open(os.path.join(ROOT, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    lst = os.path.join(OUT, "_list.json")
    old = json.load(open(lst, encoding="utf-8")) if os.path.exists(lst) else {}
    old.update(summary)
    json.dump(old, open(lst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".quran-report.txt"), "w", encoding="utf-8").write("📖 <b>فحص الآيات</b>\n" + "\n".join(rep))


if __name__ == "__main__":
    main()
