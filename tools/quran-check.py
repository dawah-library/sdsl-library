#!/usr/bin/env python3
"""فحص الآيات في الكتب: كل نص بين ﴿ ﴾ (أو { }) يُقارن بنص المصحف، ويُتحقق من أن السورة المذكورة في حاشيته هي سورته.

النتيجة لكل كتاب في data/quran-check/<id>.json:
  {"n": عدد الآيات المفحوصة, "ok": المطابقة, "issues": [{"p": رقم الصفحة من 1, "t": النص في الكتاب,
     "k": "near"|"missing"|"sura", "best": أقرب نص في المصحف, "s": السورة, "a": الآية, "r": نسبة التطابق, "diff": [كلمات مختلفة]}]}
التصحيح الآلي (QFIX=1، الافتراضي): الآية التي تطابق المصحف بنسبة ٨٠٪ فأكثر مطابقةً وحيدة الموضع (٤ كلمات فأكثر) يُستبدل نصها
بنص المصحف المشكول (الرسم الإملائي) للكلمات المطابقة نفسها؛ وكذلك الآية التي فات التحويلَ قوساها بعد «قال تعالى» ونحوها إن طابقت
٨٥٪ فأكثر فتُحاط بـ ﴿ ﴾. ويُسجَّل كل تصحيح في الكتاب (qfix) للمراجعة، وما دون ذلك يبقى في مواضع الشك (unc) ليراجعه المدقق.
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
    t = re.sub(r"\bالليل", "اليل", t)  # الرسم العثماني «ٱلَّيْل» بلام واحدة
    return re.sub(r"\s+", " ", t).strip()


def skel(w):
    """هيكل الكلمة دون الألف والواو والياء: يجمع بين الرسم العثماني والإملائي (الصلوه/الصلاه، الكتب/الكتاب)."""
    return re.sub(r"[اوي]", "", w)


QTP = os.path.join(ROOT, "data", "quran", "quran-tash.json")


def load_tash(q):
    """نص المصحف المشكول (الرسم الإملائي) لاستبدال الآيات المصححة؛ وإن تعذر فالنص غير المشكول."""
    if os.path.exists(QTP):
        return json.load(open(QTP, encoding="utf-8"))
    try:
        with urllib.request.urlopen(urllib.request.Request("https://api.alquran.cloud/v1/quran/quran-simple", headers={"User-Agent": "Mozilla/5.0 sdsl-library"}), timeout=120) as r:
            j = json.loads(r.read())
        t = {"src": "quran-simple", "suras": [{"n": s["number"], "ayat": [a["text"] for a in s["ayahs"]]} for s in j["data"]["surahs"]]}
        json.dump(t, open(QTP, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        return t
    except Exception as e:
        print("تعذر تنزيل المصحف المشكول:", e)
        return q


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
    def __init__(self, q, qt=None):
        self.words, self.pos, self.orig = [], [], []  # كل كلمات المصحف متتابعة، وموضع كل كلمة (سورة، آية)، ولفظها المشكول
        self.sname = {}
        tash = {s["n"]: s["ayat"] for s in (qt or q)["suras"]}
        for s in q["suras"]:
            self.sname[s["n"]] = re.sub(r"^سوره\s*", "", norm(s["name"]))
            for i, a in enumerate(s["ayat"], 1):
                def glue(txt):
                    out, pend = [], []
                    for w in txt.split():
                        if skel(norm(w).replace(" ", "")):
                            out.append(" ".join(pend + [w])); pend = []
                        elif norm(w).strip():
                            pend.append(w)  # كلمة بلا هيكل (يا، أو) تُلصق بما بعدها؛ وعلامات الوقف تُترك
                    return out
                ta = glue((tash.get(s["n"]) or s["ayat"])[i - 1])
                ks = [k for k in (skel(w) for w in norm(a).split()) if k]
                if len(ta) != len(ks):  # اختلاف التجزئة: يُستعمل النص غير المشكول
                    ta = glue(a)
                for j, k in enumerate(ks):
                    self.words.append(k); self.pos.append((s["n"], i)); self.orig.append(ta[j] if j < len(ta) else "")
        self.tri = {}
        for i in range(len(self.words) - 2):
            self.tri.setdefault(tuple(self.words[i:i + 3]), []).append(i)

    def find(self, text):
        ws = [k for k in (skel(w) for w in norm(text).split()) if k]
        if len(ws) < 3:
            return None
        votes = {}
        for i in range(len(ws) - 2):
            for p in self.tri.get(tuple(ws[i:i + 3]), [])[:300]:
                votes[p - i] = votes.get(p - i, 0) + 1
        if not votes:
            return {"r": 0.0}
        ranked = sorted(votes.items(), key=lambda kv: -kv[1])
        start = max(0, ranked[0][0])
        uniq = len(ranked) == 1 or ranked[1][1] < ranked[0][1]
        cand = self.words[start:start + len(ws)]
        sm = difflib.SequenceMatcher(None, ws, cand, autojunk=False)
        r = sm.ratio()
        diff = [" ".join(ws[a:b]) for tag, a, b, c, d in sm.get_opcodes() if tag != "equal" and b > a][:8]
        s, a = self.pos[min(start, len(self.pos) - 1)]
        mb = [m for m in sm.get_matching_blocks() if m.size]
        span = (start + mb[0].b, start + mb[-1].b + mb[-1].size) if mb else (start, start)
        return {"r": round(r, 3), "s": s, "a": a, "start": start, "len": len(ws), "diff": diff, "uniq": uniq, "span": span,
                "lead": mb[0].a if mb else 0, "tail": len(ws) - (mb[-1].a + mb[-1].size) if mb else 0}

    def exact(self, f):
        """نص المصحف المشكول للكلمات المطابقة (بلا زيادة في أولها أو آخرها)."""
        a, z = f["span"]
        return " ".join(w for w in self.orig[a:z] if w).strip()

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
    """أسماء السور المذكورة في حواشي الصفحة (قائمة؛ فأرقام الحواشي قد تتكرر في الصفحة)."""
    out = []
    if "____" not in (page or ""):
        return out
    for line in page.split("____", 1)[1].split("\n"):
        line = line.strip("_ ").strip()
        m = FN_REF.match(line)
        if m:
            v = re.sub(r"^(?:من\s+)?(?:سوره\s+)?", "", norm(m.group(2)))
            v = re.sub(r"\s+من$", "", v).strip()
            if v:
                out.append(v)
    return out


def check_book(bid, q, ix):
    path = os.path.join(ROOT, "data", "books", bid + ".json")
    if not os.path.exists(path):
        return None
    sh = json.load(open(path, encoding="utf-8"))
    res = {"n": 0, "ok": 0, "issues": []}
    qok = {norm(x) for x in sh.get("qok") or []}
    fixes = []
    for pi, page in enumerate(sh["pages"]):
        body = page.split("____")[0] if page else ""
        if FIX and body:
            nb = fix_page(body, ix, pi, fixes)
            if nb != body:
                page = nb + (page[len(body):] if page else ""); sh["pages"][pi] = page; body = nb
        fns = fn_suras(page or "") + fn_suras(sh["pages"][pi - 1] if pi else "") + fn_suras(sh["pages"][pi + 1] if pi + 1 < len(sh["pages"]) else "")
        for m in VERSE.finditer(body):
            raw = m.group(1)
            if norm(raw) in qok:  # أكّد المدقق صحته (قراءة أخرى، أو حروف مقطعة للتمثيل...)
                res["n"] += 1; res["ok"] += 1
                continue
            parts = [x for x in re.split(r"\.{2,}|…", raw) if len(norm(x).split()) >= 3]
            if not parts:
                continue
            res["n"] += 1
            bad = None
            for part in parts:
                f = ix.find(part)
                if not f or f.get("r", 0) >= 0.97:
                    continue
                kind = "near" if f["r"] >= 0.6 else ("missing" if f["r"] > 0 else "nq")  # nq: نص بين قوسي الآية وليس من القرآن (حديث أو عنوان)
                bad = {"p": pi + 1, "t": raw[:400], "k": kind, "r": f["r"], "diff": f.get("diff", [])}
                if "start" in f:
                    bad.update({"s": f["s"], "a": f["a"], "best": ix.text_at(q, f["start"], f["len"]) if kind == "near" else ""})
                break
            if not bad:
                # السورة: يُكتفى بأن تُذكر سورة الآية في إحدى حواشي الصفحة (أرقام الحواشي قد تتكرر في الصفحة الواحدة)
                f = ix.find(parts[0])
                named = fns
                if f and f.get("s") and f.get("uniq") and f.get("len", 0) >= 5 and named:
                    real = ix.sname.get(f["s"], "")
                    if real and not any(real in x or x in real for x in named):
                        bad = {"p": pi + 1, "t": raw[:400], "k": "sura", "r": f["r"], "s": f["s"], "a": f["a"], "named": "، ".join(named), "real": real}
            if bad:
                res["issues"].append(bad)
            else:
                res["ok"] += 1
    junk = [i for i, pg in enumerate(sh["pages"]) if len(JUNK.findall((pg or "").split("____")[0])) >= 3]
    if junk:
        res["junk"] = len(junk)
        sh["unrev"] = sorted(set(sh.get("unrev") or []) | set(junk))  # تُعاد قراءتها على الصورة في جولة التدقيق القادمة
    if fixes:
        res["fixed"] = len(fixes)
        sh["qfix"] = (sh.get("qfix") or []) + fixes
    return res, sh, path


FIX = os.environ.get("QFIX", "1") == "1"
# حروف ليست من العربية (رموز خط المصحف الخاص حين يُحوَّل نصًّا): صفحتها تُعاد قراءتها من الصورة
JUNK = re.compile(r"[ٹٺٻټٽپڀځڂڃڄڅچڇڈډڊڋڌڍڎڏڐڑڒړڔڕږڗڙښڛڜڝڞڟڠڡڢڣڤڥڦڧڨکڪګڬڭڮگڰڱڲڳڴڵڶڷڸڹںڻڼڽھڿۀہۂۃۄۅۆۇۈۉۊۋیۍێۏېۑےۓ\ue000-\uf8ff]")


def qiraa(raw, new):
    """فرق قراءة محتمل (تاء/ياء/نون في أول الفعل، وألف المد ونحوها): لا يُستبدل بنص حفص، ويبقى للمدقق."""
    a, b = norm(raw).split(), norm(new).split()
    if len(a) != len(b):
        return False
    d = [(x, y) for x, y in zip(a, b) if x != y]
    return bool(d) and all(len(x) == len(y) and x[1:] == y[1:] and {x[0], y[0]} <= set("تينا") for x, y in d)
CUE = re.compile(r"(قال\s+(الله\s+)?(تعالى|سبحانه|عز وجل|جل وعلا|جل جلاله)|قوله\s+(تعالى|سبحانه|عز وجل)|يقول\s+(الله\s+)?(تعالى|سبحانه|عز وجل))\s*[:：]?\s*")


def fix_page(body, ix, pi, fixes):
    """تصحيح الآيات بين ﴿ ﴾ بنص المصحف، وإحاطة الآية التي فات التحويلَ قوساها بعد «قال تعالى» ونحوها."""
    def rep(m):
        raw = m.group(1)
        if re.search(r"\.{2,}|…", raw):
            return m.group(0)  # آية مقطّعة بنقاط: تُترك للمراجعة
        f = ix.find(raw)
        if not f or f.get("r", 0) >= 0.999 or f.get("r", 0) < 0.8 or not f.get("uniq") or f.get("len", 0) < 4:
            return m.group(0)
        if f["lead"] or f["tail"]:
            return m.group(0)  # أول الآية أو آخرها لم يطابق: يُترك للمدقق
        new = ix.exact(f)
        if not new or len(new.split()) < 3 or qiraa(raw, new):
            return m.group(0)
        fixes.append({"p": pi + 1, "from": raw[:300], "to": new[:300], "r": f["r"], "s": f["s"], "a": f["a"]})
        return "﴿" + new + "﴾"
    body = VERSE.sub(rep, body)
    out = []
    for line in body.split("\n"):
        if "﴿" not in line and "{" not in line:
            m = CUE.search(line)
            if m:
                rest = line[m.end():]
                op = re.match(r"\s*[(\[]?\s*", rest).end()  # قوس عادي فاتح بدل قوسي الآية
                seg = re.split(r"[.؟!»)\]]|\s[-–]\s|\(\d|\s(أي|يعني|وقال|وقوله)[:\s]", rest[op:], 1)[0].rstrip("،, ")
                if 4 <= len(seg.split()) <= 80 and not re.search(r"[A-Za-z\d٠-٩]", seg):
                    f = ix.find(seg)
                    if f and f.get("r", 0) >= 0.97 and f.get("uniq") and not f["lead"] and not f["tail"]:
                        new = ix.exact(f)
                        if new and len(new.split()) >= 4:
                            after = rest[op + len(seg):]
                            after = re.sub(r"^\s*[)\]]", "", after) if op and rest[:op].strip() else after
                            fixes.append({"p": pi + 1, "from": seg[:300], "to": new[:300], "r": f["r"], "s": f["s"], "a": f["a"], "wrap": 1})
                            line = line[:m.end()] + "﴿" + new + "﴾" + after
        out.append(line)
    return "\n".join(out)


def main():
    q = load_quran()
    ix = Index(q, load_tash(q) if FIX else None)
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    ids = sys.argv[1:] or [b["id"] for b in cat["books"] if (b.get("col", "dawah") == "dawah" or b.get("upl")) and b.get("type", "book") == "book" and not b.get("demo")]
    os.makedirs(OUT, exist_ok=True)
    rep, summary = [], {}
    for bid in ids:
        r = check_book(bid, q, ix)
        if not r:
            continue
        res, sh, path = r
        json.dump(res, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        summary[bid] = {"n": res["n"], "bad": sum(1 for x in res["issues"] if x["k"] in ("near", "missing")),
                        "warn": sum(1 for x in res["issues"] if x["k"] in ("sura", "nq"))}
        # مواضع الخلل إلى مواضع الشك في الكتاب ليقدّمها التدقيق
        unc = {k: [w for w in v if not str(w).startswith("(آية:")] for k, v in (sh.get("unc") or {}).items()}
        unc = {k: v for k, v in unc.items() if v}
        if True:
            for it in [x for x in res["issues"] if x["k"] in ("near", "missing")]:
                k = str(it["p"] - 1)
                lab = "(آية: %s)" % (" ".join(it.get("diff") or []) or it["t"][:30])
                if lab not in unc.get(k, []):
                    unc[k] = (unc.get(k, []) + [lab])[:40]
            if unc: sh["unc"] = unc
            else: sh.pop("unc", None)
            s = json.dumps(sh, ensure_ascii=False, separators=(",", ":"))
            open(path, "w", encoding="utf-8").write(s)
            for b in cat["books"]:
                if b["id"] == bid:
                    b["unc"] = sum(len(v) for v in unc.values()); b["size"] = len(s.encode())
                    if sh.get("unrev"): b["unrev"] = len(sh["unrev"])
        rep.append("- %s: %d آية، فيها %d موضع خلل%s" % (bid, res["n"], len(res["issues"]), ("، وصُحّح %d" % res["fixed"] if res.get("fixed") else "") + ("، و%d صفحة رموزها غريبة تُعاد قراءتها" % res["junk"] if res.get("junk") else "")))
        print(rep[-1], flush=True)
    json.dump(cat, open(os.path.join(ROOT, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    lst = os.path.join(OUT, "_list.json")
    old = json.load(open(lst, encoding="utf-8")) if os.path.exists(lst) else {}
    old.update(summary)
    json.dump(old, open(lst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".quran-report.txt"), "w", encoding="utf-8").write("📖 <b>فحص الآيات</b>\n" + "\n".join(rep))


if __name__ == "__main__":
    main()
