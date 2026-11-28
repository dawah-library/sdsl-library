#!/usr/bin/env python3
"""سلاسل الشروح والتفريغات التي تُكمَّل بدروس لاحقة، والكتاب المشروح (طلب المدير ٢٠ نوفمبر ٢٠٢٦).

cont(cat, key, entry): يضم الكتاب الجديد إلى سلسلة قائمة (key = set أو معرّف كتاب منفرد يصير أول السلسلة)،
  برقم المجلد/الدرس التالي، ويرث منها الكتاب المشروح (sharh/matn) والشيخ والموضوع والقسم.
matn_of(cat, text): الكتاب المشروح من نص حر (مثل «فقه السنة للسيد سابق»): معرّف كتاب المكتبة إن وُجد، وإلا الاسم نفسه.
SHARH_HINT: تعليمات تمييز المتن عن الشرح (سطر المتن يبدأ بـ «%% ») والحواشي الموجزة المنسوبة إلى قائلها.
"""
import re

SHARH_HINT = ("هذا شرح على متن «{m}». ميّز المتن المشروح من كلام الشارح: كل قطعة من المتن (ما يقرؤه القارئ أو الشيخ من الكتاب، "
              "أو المطبوع بخط مميز أو بين قوسين في أعلى الشرح) اكتبها في سطر مستقل يبدأ بـ «%% » بلفظها، ثم كلام الشارح بعدها فقرات عادية بلا علامة؛ "
              "فيكون الشرح ممزوجًا بالمتن في ترتيبه. ولا تجعل كلام الشارح متنًا، ولا تضع «%% » في غير كتب الشروح.")
FN_HINT = ("الحواشي (بعد سطر ____) موجزة ومخصوصة بالتعليقات الحديثية (التخريج والحكم على الحديث) والتعريفات (بالأعلام والمصطلحات والغريب) "
           "مما ورد في المتن أو الشرح نفسه لا من خارجهما، وكل حاشية تبدأ برقمها ثم ببيان قائلها بين معقوفين، مثل: (١) [الشارح]: … أو [المصنف]: … أو [المحقق]: …، "
           "مع وضع رقمها (١) في موضعه من النص.")


def norm(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or "")
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s)).strip()


def matn_of(cat, text):
    t = norm(text)
    if not t:
        return None, None
    best = None
    for b in cat.get("books", []):
        if b.get("type", "book") != "book" or "tafrigh" in (b.get("tags") or []) or b.get("hidden") and not b.get("ocr"):
            continue
        n = norm(b.get("setTitle") or b.get("title"))
        if len(n) >= 6 and (t == n or t.startswith(n + " ") or (" " + n + " ") in (" " + t + " ")) and (not best or len(n) > len(best[1])):
            best = (b["id"], n)
    if best:
        return best[0], None
    m = re.split(r"\s+(?:لل|ل)(?=\S)", text.strip(), 1)[0].strip()
    return None, m or text.strip()


ORD = ["الاول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
       "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"]
VOLW = re.compile(r"(?:\s*[-—–:،(\[]\s*)?(?:ال)?(?:جزء|مجلد|جز|ج|مج|مجموعه|شريط|درس|محاضره|حلقه)?\s*(?:رقم\s*)?(" + "|".join(ORD[::-1]) + r"|[\d٠-٩]+)\s*[)\]]?\s*$")


def vol_split(t):
    """(عنوان العمل بلا رقم المجلد، رقم المجلد أو None): «شرح صحيح مسلم — ج 2»، «… الجزء الثاني»، «… (3)»، «… 4»."""
    n = norm(t).replace("_", " "); v = None
    m = VOLW.search(n)
    if m and len(n[:m.start()].strip()) >= 4:
        x = m.group(1); v = ORD.index(x) + 1 if x in ORD else int(x.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
        n = n[:m.start()].strip()
    return n, v


def guess(cat, title, aid=None):
    """تكملة محتملة لعمل مرفوع: العنوان نفسه بعد نزع رقم المجلد (وللمؤلف نفسه إن عُرف)، بمجموعة واحدة فقط. يعيد (المفتاح، رقم المجلد) أو (None, None)."""
    b0, v = vol_split(title)
    if len(b0) < 6: return None, None
    keys = {}
    for b in cat.get("books", []):
        if b.get("type", "book") != "book" or (aid and b.get("authorId") != aid): continue
        if vol_split(b.get("setTitle") or b.get("title") or "")[0] == b0 or vol_split(b.get("title") or "")[0] == b0:
            keys[b.get("set") or b["id"]] = 1
    return (next(iter(keys)), v) if len(keys) == 1 else (None, None)


def cont(cat, key, entry, vol=None, unit="ج"):
    """يضم الكتاب الجديد إلى عمل قائم (key = set أو معرّف كتاب منفرد يصير المجلد الأول) برقم vol أو التالي،
    ويرث منه الكتاب المشروح (sharh/matn/sharhOn/fnLabel) والمؤلف والموضوع والقسم والوسوم. unit: «ج» للمجلدات المرفوعة (مصورة أو نصية)، و«الدرس» لتفريغ التسجيلات (transcribe.py)."""
    grp = [b for b in cat.get("books", []) if b.get("set") == key or (b["id"] == key and not b.get("set"))]
    if not grp:
        return False
    base = grp[0]
    if not base.get("set"):
        t0 = base.get("title") or base["id"]  # «شرح صحيح مسلم — ج 1» → «شرح صحيح مسلم»؛ والعنوان بلا رقم يبقى كما هو
        if vol_split(t0)[1] == 1: t0 = re.sub(r"\s*[-—–:(]?\s*(?:الجزء|المجلد|الجز|ج|مج)?\s*(?:الأول|الاول|1|١)\s*\)?\s*$", "", t0).strip() or t0
        base.update({"set": base["id"], "setTitle": t0, "vol": 1})
    s = base["set"]
    vol = int(vol) if vol else max(int(b.get("vol") or 1) for b in cat["books"] if b.get("set") == s and b["id"] != entry.get("id")) + 1
    entry.update({"set": s, "setTitle": base["setTitle"], "vol": vol})
    for k in ("authorId", "topicId", "col"):  # المجلد من العمل نفسه: مؤلفه وموضوعه وقسمه (لا قيم النموذج الافتراضية)
        if base.get(k): entry[k] = base[k]
    for k in ("sharh", "matn", "matnA", "sharhOn", "fnLabel"):
        if base.get(k) and not entry.get(k):
            entry[k] = base[k]
    if base.get("tags"): entry["tags"] = sorted(set((entry.get("tags") or []) + [t for t in base["tags"] if not t.startswith("tala:")]))
    t = entry.get("title") or ""
    if not t or vol_split(t)[0] == norm(base["setTitle"]) or norm(t) == norm(base["setTitle"]):
        entry["title"] = "%s — %s %d" % (base["setTitle"], unit, vol)
    entry["cont"] = key
    return True


def matn_name(cat, b):
    """اسم الكتاب المشروح لكتاب ما (من sharh أو matn)، أو None."""
    if not b:
        return None
    if b.get("sharh"):
        m = next((x for x in cat.get("books", []) if x["id"] == b["sharh"]), None)
        if m:
            return m.get("setTitle") or m.get("title")
    return b.get("matn")
