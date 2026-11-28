#!/usr/bin/env python3
"""حواشي «الأصل» في كتب الشروح (طلب المدير، ٢٨ نوفمبر ٢٠٢٦).

المشكلة: في تفريغ «شرح صحيح مسلم» للشيخ ياسر برهامي (p1f08a935) وُضعت أسانيد أحاديث صحيح مسلم في الحاشية اختصارًا
(المتن في الصفحة بسطر «%% » ورقم الحاشية عليه، والإسناد في الحاشية)، فعُدّت هذه الحواشي من تعليق الشيخ وشرحه.
الحل: يقارن كل سطر حاشية بنص الكتاب المشروح نفسه في المكتبة (الحقل sharh في الفهرس، مثل "muslim" ← data/books/muslim.json)
بشنغلات الكلمات (٤ كلمات بعد نزع الحركات وتوحيد الهمزات)، ويُعدّ السطر من «الأصل» إذا:
  - وُجد أكثر من ٦٠٪ من شنغلاته في الأصل، و
  - بدأ بصيغة إسناد (حدثنا، أخبرنا…)، أو كان رقمه على سطر متن «%% » في الصفحة، أو كان مشكولًا كنص الأصل (والتعليق غير مشكول)؛
  - أو بدأ بصيغة إسناد وتكررت فيه صيغ التحديث و«عن» مرتين فأكثر (إسناد شوّهه التحويل فقلّ وجوده في الأصل؛ وتعليق الشارح لا يبدأ بصيغة التحديث)؛
  - ولا يُعدّ منه ما بدأ بكلام الشارح («وذلك من حديث…»، «قوله ﷺ…»، «أي…»، «رواية مسلم…») وإن نقل لفظ الحديث؛
  - وسطر التتمة بلا رقم بعد سطر من الأصل يتبعه إن وُجد أكثره في الأصل.
وما سوى ذلك تعليق الشارح (ولو نقل فيه حديثًا بلفظه: «وذلك من حديث…»، فالنقل داخل كلامه لا يُنزع).
لا يُغيَّر حرف من نص الكتاب: المخرج حقل fna في ملف الكتاب = {"<صفحة>": ["أول ٦٠ حرفًا من السطر بعد التشذيب", …]}،
وfnaSrc اسم الأصل. يقرؤه القارئ (app.js: «أسانيد الأحاديث من …» منفصلة عن تعليق الشيخ)، وsharh.js (المقطع)، وsharh-dawah.py
(لا تُستخرج فوائد الشيخ من الإسناد). بلا نموذج؛ يُعاد بعد كل تصحيح للكتاب (sharh.yml).
المجلدات اللاحقة (تنبيه المدير: «نفس المشكلة ستكون في باقي ملفات شرح صحيح مسلم التي سترفع»): الكتاب الجديد بلا sharh
يرث sharh وfnLabel من مجلد سابق للمؤلف نفسه بعنوانه نفسه (بعد نزع «— ج ٢»، «الجزء الثاني»، الأرقام)، ويُضاف إلى مجلدات عمله في
مشروع الشرح (data/shp/<مشروع>.json، works[].vols) فيعالجه «استكمال المعالجة» دون إدخال يدوي؛ ثم تُميَّز حواشيه. يعمل في enrich.yml
(عند كل كتاب جديد) وفي sharh.yml (جولتان يوميًّا، فيلحق ما اكتمل تحويله من المصورة بعد رفعه).
الاستعمال: python3 tools/fn-asl.py [معرف الكتاب…]   (بلا معرف: كل كتاب له sharh وأصله موجود)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
DI = re.compile(r"[ً-ْٰـ]"); AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
# رقم الحاشية «(٣)»، وما شوّهه التحويل «3( )»
NOTE = re.compile(r"^\s*(?:\(\s*([\d٠-٩]+)\s*\)|([\d٠-٩]+)\s*\(\s*\))"); SEP = re.compile(r"^\s*_{4,}\s*$", re.M)
CHAIN = re.compile(r"^و?(?:حدثن[اي]ه?|اخبرن[اي]ه?|انبان[اي]ه?|ثنا|سمعت)$")
ISN = re.compile(r"^(?:و?(?:حدثن[اي]ه?|اخبرن[اي]ه?|انبان[اي]|ثنا|سمعت)|عن)$")
# كلام الشارح وإن نقل حديثًا بلفظه: «وذلك من حديث…»، «قوله ﷺ…»، «أي…»، «رواية مسلم…»
TALK = re.compile(r"^(?:و?ذلك|قوله|اي|يعني|فهنا|هنا|هذا|وهذا|وهذه|هذه|رواي[هة]|والمراد|المراد|انظر|وانظر|قال\s+الشيخ|تعليق|وفيه|فيه|لان|لكن|وهو|فهو)$")
SKIP = {"المصنف", "مسلم", "الامام"}  # «[المصنف]: وحدثنا…»
TITLES = {"muslim": "صحيح مسلم", "bukhari": "صحيح البخاري"}
KEY = 60


def words(t):
    t = DI.sub("", t or ""); t = re.sub("[أإآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    return re.findall(r"[ء-ي]+", t)


def grams(w, n=4):
    return {" ".join(w[i:i + n]) for i in range(len(w) - n + 1)}


def vocal(t):
    ar = len(re.findall(r"[ء-ي]", t)); return len(DI.findall(t)) / ar if ar else 0


def classify(pages, G):
    out = {}; prev = False
    for i, p in enumerate(pages, 1):
        m = SEP.search(p or "")
        if not m: prev = False; continue
        body, fn = p[:m.start()], p[m.end():]
        mt = set()
        for l in body.split("\n"):
            if l.startswith("%% "): mt |= {x.translate(AR) for x in re.findall(r"\(([\d٠-٩]+)\)", l)}
        keys = []
        for l in [x.strip() for x in fn.split("\n") if x.strip()]:
            mm = NOTE.match(l); k = (mm.group(1) or mm.group(2)).translate(AR) if mm else None
            w = words(l[mm.end():] if mm else l); g = grams(w)
            cov = len(g & G) / len(g) if g else 0
            w0 = w[1:] if w[:1] and w[0] in SKIP and len(w) > 1 and CHAIN.match(w[1]) else w
            ch = bool(w0) and bool(CHAIN.match(w0[0])); talk = bool(w0) and bool(TALK.match(w0[0]))
            nisn = sum(1 for x in w0 if ISN.match(x))  # إسناد تشوّه في التحويل: صيغ التحديث و«عن» متكررة
            if talk: asl = False
            elif k is not None:
                asl = (cov >= 0.6 and (ch or k in mt or (vocal(l) >= 0.3 and len(w) >= 6))) or (ch and (k in mt or nisn >= 2))
            else:  # تتمة بلا رقم: تتبع ما قبلها إن كانت من الأصل، أو كانت إسنادًا موجودًا في الأصل
                asl = (cov >= 0.5 and (prev or (ch and cov >= 0.6))) or (ch and nisn >= 2)
            if asl: keys.append(l[:KEY])
            prev = asl
        if keys: out[str(i)] = keys
    return out


def classify_body(pages, GN, GM):
    """صلب الصفحة في شرحٍ على شرح (sharhOn: الشيخ ياسر برهامي يشرح شرح النووي على صحيح مسلم): سطر «من الأصل المشروح» إذا وُجد
    ١٥٪ فأكثر من شنغلاته في شرح النووي (تختلف الطبعات فلا يُشترط أكثر)، أو أكثره في صحيح مسلم، أو كان مشكولًا كالمطبوع (والتفريغ غير مشكول)؛
    وما سوى ذلك كلام الشيخ في الدرس (شرحه، وما ينقله من كتب أخرى). السطر القصير يتبع ما قبله. أسطر المتن «%% » والعناوين لا تُدرج (لها علاماتها)."""
    out = {}
    for i, p in enumerate(pages, 1):
        m = SEP.search(p or ""); body = p[:m.start()] if m else (p or ""); keys = []; prev = True
        for l in [x.strip() for x in body.split("\n") if x.strip()]:
            if l.startswith(("#", "%% ", "@@ ")): continue
            w = words(l); g = grams(w)
            if len(g) < 3: asl = prev
            else: asl = len(g & GN) / len(g) >= 0.15 or len(g & GM) / len(g) >= 0.5 or vocal(l) >= 0.3
            if asl: keys.append(l[:KEY])
            prev = asl
        if keys: out[str(i)] = keys
    return out


VOLW = re.compile(r"(?:\s*[-—–:،(]\s*)?(?:الجزء|المجلد|الجز|ج|مج|المجموعة|الشريط|الدرس|المحاضرة)?\s*(?:[\d٠-٩]+|الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر)\s*\)?\s*$")


def base(t):
    t = DI.sub("", t or "").strip()
    for _ in range(3): t = VOLW.sub("", t).strip(" -—–:،()")
    t = re.sub("[أإآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه")
    return re.sub(r"\s+", " ", t)


def inherit(cat):
    """المجلدات الجديدة لشرح قائم: ترث sharh وfnLabel وتُسجَّل في مشروع الشرح. يعيد عدد ما تغيّر."""
    books = cat["books"]; src = [b for b in books if b.get("sharh")]; ch = 0
    for b in books:
        if b.get("sharh") or not b.get("authorId") or b.get("type") not in (None, "book"): continue
        sib = next((x for x in src if x.get("authorId") == b["authorId"] and x.get("col") == b.get("col") and base(x.get("title")) == base(b.get("title"))), None)
        if not sib: continue
        b["sharh"] = sib["sharh"]
        for k in ("fnLabel", "sharhOn"):
            if sib.get(k) and not b.get(k): b[k] = sib[k]
        ch += 1; print("%s «%s»: مجلد من «%s» (%s) — ورث الأصل %s" % (b["id"], b.get("title"), sib.get("title"), sib["id"], sib["sharh"]))
        sd = os.path.join(D, "shp")
        for f in sorted(os.listdir(sd)) if os.path.isdir(sd) else []:
            if not f.endswith(".json") or f.startswith("_"): continue
            P = json.load(open(os.path.join(sd, f), encoding="utf-8")); dirty = False
            for w in P.get("works") or []:
                vs = w.get("vols") or []
                if any(v.get("b") == sib["id"] for v in vs) and not any(v.get("b") == b["id"] for v in vs):
                    vs.append({"b": b["id"], "m": None}); w["vols"] = vs; dirty = True
                    print("  أُضيف إلى مجلدات «%s» في مشروع %s (يعالَج بـ«استكمال المعالجة»)" % (w.get("t"), f[:-5]))
            if dirty: json.dump(P, open(os.path.join(sd, f), "w", encoding="utf-8"), ensure_ascii=False, indent=1)  # بتنسيق sharh-align.py
    return ch


def bpath(bid):
    for p in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p): return p
    return None


def main():
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))
    if inherit(cat):
        import time; cat["version"] = int(time.time() * 1000)
        json.dump(cat, open(os.path.join(D, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    ids = sys.argv[1:] or [b["id"] for b in cat["books"] if b.get("sharh")]
    by = {b["id"]: b for b in cat["books"]}; cache = {}
    for bid in ids:
        b = by.get(bid) or {}; src = b.get("sharh"); f = bpath(bid); sf = bpath(src) if src else None
        if not src or not f or not sf: continue
        if src not in cache:
            G = set()
            for p in json.load(open(sf, encoding="utf-8")).get("pages") or []: G |= grams(words(p))
            cache[src] = G
        B = json.load(open(f, encoding="utf-8")); old = (B.get("fna"), B.get("basl"))
        fna = classify(B.get("pages") or [], cache[src]); B["fna"] = fna; B["fnaSrc"] = TITLES.get(src) or (by.get(src) or {}).get("title") or src
        on = b.get("sharhOn")  # شرح على شرح: مجموعة مجلدات الشرح المشروح (nawawimuslim)
        if on:
            if on not in cache:
                G = set(); vs = [x for x in cat["books"] if x.get("set") == on or x["id"] == on]
                for v in vs:
                    vp = bpath(v["id"])
                    if vp:
                        for p in json.load(open(vp, encoding="utf-8")).get("pages") or []: G |= grams(words(p))
                cache[on] = G; cache[on + ":t"] = (vs[0].get("setTitle") or vs[0].get("title")) if vs else on
            B["basl"] = classify_body(B.get("pages") or [], cache[on], cache[src]); B["baslSrc"] = cache[on + ":t"]
        else: B.pop("basl", None); B.pop("baslSrc", None)
        n = sum(len(v) for v in fna.values()); nb = sum(len(v) for v in (B.get("basl") or {}).values())
        if old == (B.get("fna"), B.get("basl")): print("%s: بلا تغيير (%d حاشية و%d سطرًا من الأصل)" % (bid, n, nb)); continue
        json.dump(B, open(f, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("%s: %d سطر حاشية من «%s»، و%d سطرًا في الصلب من «%s»" % (bid, n, B["fnaSrc"], nb, B.get("baslSrc") or "—"))


if __name__ == "__main__":
    main()
