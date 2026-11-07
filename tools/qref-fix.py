#!/usr/bin/env python3
"""تصحيح عزو الآيات في الكتب والمقالات (طلب المدير، ٧ نوفمبر ٢٠٢٦: «مكتبة الدعوة هي الأساس والأولوية»).

لكل عزو بصيغة [السورة: رقم] أو (السورة: من الآية رقم) أو [سورة السورة، الآية رقم] أو «سورة كذا، الآية رقم» في حاشية،
يُعرف نص الآية المعزوّة (﴿ ﴾ أو { } قبل العزو مباشرة، أو الآية التي تحمل رقم الحاشية)، ويُبحث عنه في المصحف (فهرس tools/quran-check.py):
  - إن طابق النص موضعًا وحيدًا في المصحف (٩٠٪ فأكثر، ٤ كلمات فأكثر) والعزو يشير إلى غيره ← يُصحَّح اسم السورة و/أو رقم الآية
    في العزو نفسه بأسلوبه (الأقواس والأرقام العربية أو الهندية كما هي)، ولا يُمس شيء آخر من النص.
  - ولا يُصحَّح إن كان نص الآية المعزوّة نفسها يحوي المقتبس (آية متكررة في أكثر من سورة)، ولا الآيات المقطّعة بنقاط.
  - الآيات التي لا عزو لها لا يُضاف إلى نصها شيء (حفاظًا على موافقة المطبوع)، بل تُحفظ مواضعها في الحقل qadd للكتاب
    {"<صفحة>": [[ترتيب الآية في الصفحة، آخر كلمة، سورة، آية، آخر آية]]}، فيعرض القارئ بعدها رابطًا صغيرًا إلى المصحف (QREF في mushaf.js).
كل تصحيح يُسجَّل في الكتاب (qref) وفي tools/qref-report.md للمراجعة. الترتيب: مقالات المدير، ثم كتب مكتبة الدعوة وتفريغاتها،
ثم مقالاتها وفتاواها، ثم المكتبة العامة (data/books ثم vols). الحالة: data/qref/_state.json (بصمة كل ملف، فلا يُعاد إلا ما تغيّر).
الاستعمال: python3 tools/qref-fix.py [--dry] [--only dawah|turath|articles] [معرفات...]   (QREF_MAX_MIN: حد الدقائق)
"""
import glob, hashlib, json, os, re, sys, time, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
_spec = importlib.util.spec_from_file_location("qc", os.path.join(os.path.dirname(os.path.abspath(__file__)), "quran-check.py"))
qc = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(qc)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
OWNER = "w50"  # المدير: عبد الرحمن راضي العماري
DIA = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", s).strip()
AR_D, EN_D = "٠١٢٣٤٥٦٧٨٩", "0123456789"
def num(x): return int(str(x).translate(str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")))
def like(n, sample):  # الرقم بأسلوب الأصل (عربي هندي، أو فارسي، أو غربي)
    if re.search("[٠-٩]", sample): return str(n).translate(str.maketrans(EN_D, AR_D))
    if re.search("[۰-۹]", sample): return str(n).translate(str.maketrans(EN_D, "۰۱۲۳۴۵۶۷۸۹"))
    return str(n)

Q = qc.load_quran(); IX = qc.Index(Q)
CNT = [len(s["ayat"]) for s in Q["suras"]]
PRETTY = [DIA.sub("", re.sub(r"^سُورَةُ\s*", "", unicodedata.normalize("NFC", s["name"]))).replace("ٱ", "ا").strip() for s in Q["suras"]]
PRETTY[33], PRETTY[77] = "سبأ", "النبأ"
SM = {}
for i, s in enumerate(Q["suras"], 1):
    n = re.sub(r"^سوره\s+", "", nz(s["name"])); SM[n] = i; SM.setdefault(re.sub(r"^ال", "", n), i)
for k, v in {"بني اسرائيل": 17, "المؤمن": 40, "حم السجده": 41, "براءه": 9, "الدهر": 76, "هل اتي": 76, "تبارك": 67, "عم": 78, "تبت": 111, "اللهب": 111,
             "الانشراح": 94, "الم نشرح": 94, "اقرا": 96, "الملائكه": 35, "ن": 68, "ياسين": 36, "الاعلي": 87, "الضحي": 93, "الشوري": 42}.items():
    SM.setdefault(k, v)
def sura_of(n):
    k = re.sub(r"^سوره\s+", "", nz(n)); k = re.sub(r"(\s+(الايه|الايات|ايه|رقم|من))+$", "", k).strip()
    return SM.get(k) or SM.get(re.sub(r"^ال", "", k)) or 0
AMBIG = {38, 50}  # «ص» و«ق»: كثيرًا ما تكون «ص: ٨٣» إحالة إلى صفحة، فلا تُصحَّح ولا تُعدّ

DG = r"[0-9٠-٩۰-۹]{1,3}"; W = r"(?:الآيات|الآية|الايات|الاية|آية|اية|آيه|ايه|الآيتان|الآيتين)"
# مطابق لـ RX في mushaf.js (بين قوسين)، والثاني لصيغة الحواشي بلا أقواس: «سورة البقرة، الآية ٢٥٥»
CITE = re.compile(r"[\[(]\s*(?:سورة\s+|سوره\s+)?(?P<n>[ء-يً-ْٰٱ ]{1,22}?)\s*(?::|،|,)\s*(?:من\s+)?" + W + r"?\s*(?:رقم\s*)?(?P<a>" + DG + r")(?:\s*[-–،,]\s*(?P<b>" + DG + r"))?\s*[\])]")
CITE2 = re.compile(r"سورة\s+(?P<n>[ء-يً-ْٰٱ ]{1,22}?)\s*[،,:]?\s*(?:من\s+)?" + W + r"\s*(?:رقم\s*)?(?P<a>" + DG + r")(?:\s*[-–،,]\s*(?P<b>" + DG + r"))?")
VERSE = re.compile(r"[﴿{]\s*([^{}﴿﴾]{4,1500}?)\s*[﴾}]")
PAREN = re.compile(r"\(\s*([^()\[\]]{8,1500}?)\s*\)\s*[.,،]?\s*$")
FNM = re.compile(r"^\s*\(?\s*([0-9٠-٩۰-۹]{1,3})\s*\)")


def locate(raw):
    """موضع النص في المصحف: (سورة، أول آية، آخر آية) إن كان وحيدًا موثوقًا، وإلا None."""
    if re.search(r"\.{2,}|…", raw): return None
    f = IX.find(raw)
    if not f or f.get("r", 0) < 0.9 or not f.get("uniq") or f.get("len", 0) < 4: return None
    a, z = f["span"]; s0, a0 = IX.pos[a]; s1, a1 = IX.pos[max(a, z - 1)]
    if s0 != s1: return None
    return s0, a0, a1


def contains(raw, s, a, b, thr=0.8):
    """هل الآية (أو الآيات) المعزوّة تحوي المقتبس؟ (للآيات المتكررة، وللمقتبس من آيتين)."""
    if not (1 <= s <= 114) or a < 1 or a > CNT[s - 1]: return False
    t = " ".join(Q["suras"][s - 1]["ayat"][a - 1:max(a, min(b or a, CNT[s - 1]))])
    qs = [qc.skel(w) for w in qc.norm(raw).split() if qc.skel(w)]; ts = set(qc.skel(w) for w in qc.norm(t).split())
    return bool(qs) and sum(1 for w in qs if w in ts) >= thr * len(qs)


def fix_cite(m, loc, log, ctx):
    """يعيد نص العزو مصحَّحًا إن كان خطأ، وإلا كما هو."""
    s, a = sura_of(m.group("n")), num(m.group("a")); b = num(m.group("b")) if m.group("b") else 0
    raw = ctx; ls, la, lb = loc
    if s in AMBIG or not s and len(nz(m.group("n"))) <= 2: return None
    if s and contains(raw, s, a, b): return None
    if s != ls:  # تغيير السورة: نص أطول (٥ كلمات فأكثر)، ولا يشبه المقتبس الآية المعزوّة ولو قليلًا
        if len(qc.norm(raw).split()) < 5 or (s and contains(raw, s, a, b, 0.6)): return None
        if not s and nz(PRETTY[ls - 1]).replace("ال", "") not in nz(m.group("n")).replace("ال", ""): return None
        if not s: s = ls  # اسم السورة صحيح وفي آخره «الآية رقم» ونحوها: يبقى الاسم كما هو
    if s == ls and (a <= la <= (b or a) or la <= a <= lb): return None  # العزو يشير إلى جزء من المقتبس
    txt, g = m.group(0), m.start(0); ed = []  # (بداية، نهاية، بديل) نسبةً إلى العزو
    if s != ls: ed.append((m.start("n") - g, m.end("n") - g, PRETTY[ls - 1]))
    ed.append((m.start("a") - g, m.end("a") - g, like(la, m.group("a"))))
    if lb != la:
        if m.group("b"): ed.append((m.start("b") - g, m.end("b") - g, like(lb, m.group("a"))))
        else: ed.append((m.end("a") - g, m.end("a") - g, "-" + like(lb, m.group("a"))))
    elif m.group("b"): ed.append((m.end("a") - g, m.end("b") - g, ""))
    out = txt
    for x, y, r in sorted(ed, reverse=True): out = out[:x] + r + out[y:]
    if out == txt: return None
    log.append({"from": txt, "to": out, "v": raw[:120], "s": ls, "a": la, "b": lb if lb != la else 0})
    return out


def fix_page(page, log):
    body, sep, foot = (page or "").partition("____")
    verses = list(VERSE.finditer(body))
    # (١) العزو بعد الآية مباشرة (في المتن)
    out, last, cited = [], 0, set()
    c1 = list(CITE.finditer(body)); c2 = [m for m in CITE2.finditer(body) if not any(x.start() <= m.start() < x.end() for x in c1)]
    for m in c1 + c2:
        pv = [v for v in verses if v.end() <= m.start() and m.start() - v.end() <= 40 and not CITE.search(body, v.end(), m.start())]
        if pv: v = pv[-1]; cited.add(v.start()); vt = v.group(1)
        else:  # مقالات صوت السلف: الآية بين قوسين عاديين ثم العزو «( … ) (البقرة:10)»
            pm = PAREN.search(body, max(0, m.start() - 1600), m.start())
            if not pm: continue
            vt = pm.group(1)
        loc = locate(vt)
        if not loc: continue
        new = fix_cite(m, loc, log, vt)
        if new: out.append((m.start(), m.end(), new))
    # (٢) العزو في الحاشية: الآية يتبعها رقم الحاشية «﴾(١)» والحاشية «(١) [البقرة: ٢٥٥]» أو «(١) سورة البقرة، الآية ٢٥٥»
    fout = []
    if sep:
        marks = {}
        for v in verses:
            mm = re.match(r"\s*\(\s*([0-9٠-٩۰-۹]{1,3})\s*\)", body[v.end():v.end() + 8])
            if mm: marks.setdefault(num(mm.group(1)), v); cited.add(v.start())
        pos = 0
        for line in foot.split("\n"):
            mk = FNM.match(line)
            if mk and num(mk.group(1)) in marks:
                v = marks[num(mk.group(1))]; loc = locate(v.group(1))
                if loc:
                    for rx in (CITE, CITE2):
                        m = rx.search(line)
                        if m:
                            new = fix_cite(m, loc, log, v.group(1))
                            if new: fout.append((pos + m.start(), pos + m.end(), new))
                            break
            pos += len(line) + 1
    # (٣) الآيات بلا عزو: مواضعها للقارئ (لا يُغيَّر النص)
    add = []
    for k, v in enumerate(verses):
        if v.start() in cited: continue
        after, before = body[v.end():v.end() + 40], body[max(0, v.start() - 60):v.start()]
        if CITE.match(after.lstrip()) or re.match(r"\s*\(\s*[0-9٠-٩۰-۹]{1,3}\s*\)", after) or re.search(r"سورة|سوره", before): continue
        loc = locate(v.group(1))
        if loc:
            lw = nz(v.group(1)).split()
            add.append([k, lw[-1] if lw else "", loc[0], loc[1], loc[2] if loc[2] != loc[1] else 0])
    for a, z, new in sorted(out, reverse=True): body = body[:a] + new + body[z:]
    for a, z, new in sorted(fout, reverse=True): foot = foot[:a] + new + foot[z:]
    return body + sep + foot, add


def do_doc(doc, label, rep, dry):
    """doc: {"pages": [...]}؛ يعيد هل تغيّر."""
    log, qadd, changed = [], {}, False
    for i, p in enumerate(doc.get("pages") or []):
        if not isinstance(p, str) or not p: continue
        if not (CITE.search(p) or CITE2.search(p) or "﴿" in p or "{" in p): continue
        before = len(log); np, add = fix_page(p, log)
        for x in log[before:]: x["p"] = i + 1
        if np != p and not dry: doc["pages"][i] = np; changed = True
        if add: qadd[str(i)] = add
    if log:
        rep.append("- %s: صُحّح %d عزوًا%s" % (label, len(log), "" if not dry else " (تجربة)"))
        for x in log[:6]: rep.append("    - ص %d: %s ← %s  «%s…»" % (x["p"], x["from"], x["to"], x["v"][:50]))
        if not dry: doc["qref"] = (doc.get("qref") or []) + log; changed = True
    if (doc.get("qadd") or {}) != qadd and not dry:
        if qadd: doc["qadd"] = qadd
        else: doc.pop("qadd", None)
        changed = True
    return changed, len(log), sum(len(v) for v in qadd.values())


def main():
    args = [a for a in sys.argv[1:]]; dry = "--dry" in args; only = None
    if "--only" in args: only = args[args.index("--only") + 1]
    ids = [a for a in args if not a.startswith("--") and a != only]
    deadline = time.time() + 60 * float(os.environ.get("QREF_MAX_MIN", "40"))
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))
    sp = os.path.join(D, "qref", "_state.json"); st = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {"h": {}, "n": {}}
    books = [b for b in cat["books"] if (b.get("type") or "book") == "book" and not b.get("demo")]
    dawah = [b for b in books if (b.get("col") or "dawah") == "dawah"]; turath = [b for b in books if (b.get("col") or "dawah") != "dawah"]
    order = [("data/books/%s.json" % b["id"], b) for b in sorted(dawah, key=lambda b: (b.get("authorId") != OWNER, b["id"]))]
    arts = sorted(glob.glob(os.path.join(D, "articles", "*.json")))
    arts = [p for p in arts if not p.endswith("index.json")]
    order_t = [(("vols/" if b.get("vf") else "data/books/") + b["id"] + ".json", b) for b in turath]
    plan = []
    if not only or only == "articles": plan.append(("articles", None))
    if not only or only == "dawah": plan += [("book", x) for x in order]
    if not only or only == "turath": plan += [("book", x) for x in order_t]
    if ids: plan = [("book", (("vols/" if b.get("vf") else "data/books/") + b["id"] + ".json", b)) for b in books if b["id"] in ids]
    rep, tot, tadd, done = [], 0, 0, 0
    aidx = {}
    try: aidx = {i["id"]: i for i in json.load(open(os.path.join(D, "articles", "index.json"), encoding="utf-8"))["items"]}
    except Exception: pass

    def run_file(rel, docs_of, label_of):
        nonlocal tot, tadd, done
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path): return
        raw = open(path, "rb").read(); h = hashlib.md5(raw).hexdigest()
        if st["h"].get(rel) == h and not ids: return
        o = json.loads(raw); ch = False
        for key, doc in docs_of(o):
            c, n, na = do_doc(doc, label_of(key, doc), rep, dry); ch |= c; tot += n; tadd += na
            if n: st["n"][key] = st["n"].get(key, 0) + n
        if ch and not dry:
            s = json.dumps(o, ensure_ascii=False, separators=(",", ":")); open(path, "w", encoding="utf-8").write(s); raw = s.encode()
        st["h"][rel] = hashlib.md5(raw).hexdigest(); done += 1

    for kind, x in plan:
        if time.time() > deadline: rep.append("- (توقف عند حد الوقت؛ يُستكمل في الجولة القادمة)"); break
        if kind == "articles":
            # مقالات المدير أولًا ثم مقالات مكتبة الدعوة وفتاواها
            own = {i for i, it in aidx.items() if it.get("a") == OWNER}
            files = sorted(arts, key=lambda p: not any(k in own for k in (json.load(open(p, encoding="utf-8")) or {}).keys()))
            for p in files:
                if time.time() > deadline: break
                run_file(os.path.relpath(p, ROOT), lambda o: [(k, v) for k, v in o.items() if isinstance(v, dict)],
                         lambda k, v: "مقال «%s»" % (aidx.get(k, {}).get("t") or k)[:60])
        else:
            rel, b = x
            run_file(rel, lambda o: [(b["id"], o)], lambda k, v: "«%s» (%s)" % ((b.get("setTitle") or b["title"])[:60], b["id"]))
    if not dry:
        os.makedirs(os.path.dirname(sp), exist_ok=True); json.dump(st, open(sp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        lp = os.path.join(ROOT, "tools", "qref-report.md"); old = open(lp, encoding="utf-8").read().split("\n", 2)[-1] if os.path.exists(lp) else ""
        if rep: open(lp, "w", encoding="utf-8").write("# تصحيح عزو الآيات (tools/qref-fix.py)\n\n## %s\n" % time.strftime("%Y-%m-%d") + "\n".join(rep[:3000]) + "\n\n" + old[:400000])
        open(os.path.join(ROOT, ".qref-report.txt"), "w", encoding="utf-8").write("📖 <b>تصحيح عزو الآيات</b>: %d تصحيحًا في %d ملفًا، و%d آية بلا عزو رُبطت بالمصحف" % (tot, done, tadd) if tot or tadd else "")
    print("\n".join(rep[:400])); print("المجموع: %d تصحيحًا، %d ملفًا، %d آية بلا عزو رُبطت" % (tot, done, tadd))


if __name__ == "__main__":
    main()
