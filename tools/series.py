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


def cont(cat, key, entry):
    grp = [b for b in cat.get("books", []) if b.get("set") == key or (b["id"] == key and not b.get("set"))]
    if not grp:
        return False
    base = grp[0]
    if not base.get("set"):
        base.update({"set": base["id"], "setTitle": base.get("title") or base["id"], "vol": 1})
    s = base["set"]
    vol = max(int(b.get("vol") or 1) for b in cat["books"] if b.get("set") == s) + 1
    entry.update({"set": s, "setTitle": base["setTitle"], "vol": vol})
    for k in ("sharh", "matn", "matnA", "authorId", "topicId", "col"):
        if base.get(k) and not entry.get(k):
            entry[k] = base[k]
    t = entry.get("title") or ""
    if not t or norm(t) == norm(base["setTitle"]):
        entry["title"] = "%s — الدرس %d" % (base["setTitle"], vol)
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
