#!/usr/bin/env python3
"""فهرس معاني الكلمات من كتب المكتبة (للضغطة المطولة على الكلمة في القارئ).

يجمع لكل كلمة المواضع التي تُشرح فيها شرحًا صريحًا في:
  - المعاجم (الصحاح، مقاييس اللغة، مختار الصحاح، وما يضاف): مداخل الجذور «# [جذر]».
  - كتب التفسير وشروح الحديث والفقه وأصوله والعقيدة: «قوله: كلمة …»، «كلمة: أي …»، «ومعنى كلمة …»، «والمراد بكلمة …»،
    «كلمة في اللغة/لغةً … وفي الشرع/شرعًا/اصطلاحًا …»، وعناوين مداخل الموسوعات الفقهية.
المخرجات: data/gloss/<حرفان>.json  {مفتاح: [[كتاب، صفحة، نوع، مقتطف], …]} و data/gloss/_books.json (تصنيف الكتب)
الأنواع: l مدخل معجم، d تعريف لغوي/شرعي، q «قوله»، m «معنى/المراد»، a «أي»، h عنوان مدخل في موسوعة.
"""
import glob, json, os, re, collections, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "gloss")
CAT = {  # بادئة المعرّف ← التصنيف
    "lex": ["mukhtar", "sihah", "maqayis", "lisan", "qamus", "nihaya", "mufradat", "fiqhlugha", "tajarus", "mukhassas"],
    "tafsir": ["saadi", "ibnkathir", "tabari", "qurtubi", "baghawi"],
    "hadith": ["fathbari", "nawawimuslim", "subulsalam", "naylawtar", "istidhkar", "tamhid"],
    "fiqh": ["mawsuakuwaitiyya", "qawaidfiqhiyya", "mughni", "majmunawawi", "rawdmurbi", "bidayatmujtahid", "ilam", "shafiiumm", "mudawwana"],
    "usul": ["rawdatnazir", "muwafaqat", "risala"],
    "aqida": ["majmufatawa", "minhajsunna", "iqtida"],
}
SNIP = int(os.environ.get("GLOSS_SNIP", "190"))
PER_BOOK = 2
PER_KEY = 28
DIAC = re.compile(r"[ً-ْٰـ]")
STOP = set("""في من على عن الى إلى ما لا لم لن هو هي هم هن ذلك هذا هذه التي الذي الذين كان كانت قد وقد ثم أن إن او أو بل قال يقال وقال قيل كما مثل أي ومنه منه عنه به له لها فيه فيها
إذا اذا حتى بعد قبل كل بعض غير بين عند مع وهو وهي فهو فهي انه أنه إنه ولا وما فلا فما يعني يريد اي وأي تعالى عز وجل رسول النبي الله صلى عليه وسلم رضي""".split())


def norm(s):
    s = DIAC.sub("", s)
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return s


def key(w):
    """مفتاح الكلمة: بلا تشكيل ولا حروف عطف وجر ولا أداة التعريف."""
    w = norm(re.sub(r"[^ء-يٱً-ْ]", "", w))
    for p in ("وبال", "فبال", "وال", "فال", "بال", "كال", "ولل", "لل", "ال"):
        if w.startswith(p) and len(w) - len(p) >= 2:
            w = w[len(p):]
            break
    else:
        if len(w) >= 4 and w[0] in "وفبكل":
            w = w[1:]
    return w


def cat_of(bid):
    base = re.sub(r"-v\d+$", "", bid)
    for c, l in CAT.items():
        if base in l:
            return c
    return None


def snippet(t, at):
    s = re.sub(r"PageEnd\w+|ms\d+|#+", " ", t[at:at + SNIP * 2 + 40])
    s = re.sub(r"\s+", " ", s).strip()
    return (s[:SNIP].rsplit(" ", 1)[0] + "…") if len(s) > SNIP else s


QAWL = re.compile(r"(?:^|[\s.،(])(?:و?قوله)\s*[:،]?\s*(?:تعالى\s*[:،]?\s*|صلى الله عليه وسلم\s*[:،]?\s*)?[{«(\"]?\s*([ء-ي]{2,})(?:\s+([ء-ي]{2,}))?")
AYY = re.compile(r"(?:^|[\s.،(])([ء-ي]{3,})\s*[:،)]?\s+(?:أي|اي)\s+[ء-ي]")
MAANA = re.compile(r"(?:ومعنى|معنى|والمراد\s+ب|المراد\s+ب|وأصل|وحقيقة)\s*[(«]?\s*(?:ال)?([ء-ي]{3,})")
DEF = re.compile(r"(?:^|[\s.،(])([ء-ي]{3,})\s*[:،]?\s+(?:في\s+اللغة|لغة|في\s+الشرع|شرعا|اصطلاحا|في\s+الاصطلاح)(?=[\s:،.])")
HEAD_LEX = re.compile(r"^#+\s*[\[(]\s*([ء-ي]{2,6})\s*[\])]", re.M)
HEAD = re.compile(r"^#+\s*([^\n#]{2,40})$", re.M)


def load(path):
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return None


def main():
    os.makedirs(OUT, exist_ok=True)
    cat = load(os.path.join(ROOT, "data", "catalog.json")) or {"books": []}
    books = [b for b in cat["books"] if cat_of(b["id"])]
    idx = collections.defaultdict(list)
    seen = collections.Counter()
    t0 = time.time()
    used = {}
    for b in books:
        bid, c = b["id"], cat_of(b["id"])
        sh = load(os.path.join(ROOT, "vols", bid + ".json")) or load(os.path.join(ROOT, "data", "books", bid + ".json"))
        if not sh or not sh.get("pages"):
            continue
        used[bid] = c
        n0 = len(idx)
        for i, page in enumerate(sh["pages"]):
            raw = str(page or "")
            cut = re.search(r"^\s*_{4,}\s*$", raw, re.M)
            if cut:
                raw = raw[:cut.start()]
            t = DIAC.sub("", raw)
            hits = []
            if c == "lex":
                for m in HEAD_LEX.finditer(t):
                    hits.append((key(m.group(1)), "l", m.end()))
            elif c == "fiqh" and re.sub(r"-v\d+$", "", bid) == "mawsuakuwaitiyya":
                for m in HEAD.finditer(t):
                    h = m.group(1).strip(" :.")
                    if 1 <= len(h.split()) <= 3 and not re.search(r"\d|فصل|باب|مبحث|المطلب|التعريف|الحكم|أحكام", h):
                        hits.append((key(h.split()[-1] if len(h.split()) > 1 else h), "h", m.start()))
            for m in DEF.finditer(t):
                hits.append((key(m.group(1)), "d", m.start(1)))
            for m in MAANA.finditer(t):
                hits.append((key(m.group(1)), "m", m.start()))
            if c in ("hadith", "tafsir", "lex"):
                for m in QAWL.finditer(t):
                    hits.append((key(m.group(1)), "q", m.start()))
                for m in AYY.finditer(t):
                    hits.append((key(m.group(1)), "a", m.start(1)))
            for k, typ, at in hits:
                if len(k) < 2 or k in STOP or norm(k) in STOP:
                    continue
                sk = (k, bid)
                if seen[sk] >= PER_BOOK:
                    continue
                seen[sk] += 1
                idx[k].append([bid, i + 1, typ, snippet(t, at)])
        print("%-22s %-7s مفاتيح جديدة %d (المجموع %d) %.0fs" % (bid, c, len(idx) - n0, len(idx), time.time() - t0), flush=True)
    rank = {"l": 0, "h": 0, "d": 1, "m": 2, "q": 3, "a": 4}
    shards = collections.defaultdict(dict)
    for k, l in idx.items():
        l.sort(key=lambda e: rank[e[2]])
        # توزيع عادل على التصنيفات قبل القص
        by = collections.defaultdict(list)
        for e in l:
            by[used[e[0]]].append(e)
        out = []
        while len(out) < PER_KEY and any(by.values()):
            for c in list(by):
                if by[c]:
                    out.append(by[c].pop(0))
        shards["-".join("%04x" % ord(ch) for ch in k[:2])][k] = out
    for f in glob.glob(os.path.join(OUT, "*.json")):
        os.remove(f)
    total = 0
    for s, d in shards.items():
        p = os.path.join(OUT, s + ".json")
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        total += os.path.getsize(p)
    json.dump({"books": used, "keys": len(idx), "built": time.strftime("%Y-%m-%d")}, open(os.path.join(OUT, "_books.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("مفاتيح: %d • ملفات: %d • الحجم: %.1f م.ب" % (len(idx), len(shards), total / 1e6))


if __name__ == "__main__":
    main()
