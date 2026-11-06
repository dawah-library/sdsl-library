#!/usr/bin/env python3
"""كتب السنة المشهورة في قسم الحديث (البند ٤٥): يستخرج الأحاديث المسندة من نصوص الصحيحين والسنن والموطأ وغيرها في المكتبة.
بداية الحديث: سطر يبدأ بصيغة الأداء (حدثنا/حدثني/أخبرنا/أخبرني/أنبأنا…) وقد يسبقها رقم المصنف أو «#».
لكل حديث: رقمه عند المصنف إن ورد في النص (وإلا تسلسله في نسخة المكتبة)، والكتاب والباب، والصحابي (الراوي الأعلى)،
والمتن (ما بين «» وإلا ما بعد آخر «قال» بعد ذكر النبي ﷺ)، والطرف، والصفحة للرجوع إلى النص كاملًا بإسناده.
المخرج: data/hadith/k/<الكتاب>.json = {"t": العنوان، "items": [[رقم، صفحة، كتاب، باب، صحابي، طرف]], "m": {رقم: متن}}
وdata/hadith/k/_list.json. يُحمَّل كل كتاب عند طلبه فلا يثقل القسم."""
import json, os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "hadith", "k")
BOOKS = [("bukhari", "صحيح البخاري"), ("muslim", "صحيح مسلم"), ("abudawud", "سنن أبي داود"), ("tirmidhi", "جامع الترمذي"), ("nasai", "سنن النسائي"), ("ibnmajah", "سنن ابن ماجه"), ("muwatta", "موطأ مالك"), ("darimi", "سنن الدارمي")]
DIA = re.compile(r"[ً-ْٰـ]")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", s).strip()
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
START = re.compile(r"^\s*#?\s*(?:\(?\s*([\d٠-٩]{1,5})\s*\)?\s*[-–.]?\s*)?(?:و)?(?:حدثنا|حدثني|حدثناه|حدثنيه|أخبرنا|أخبرني|أخبرناه|أنبأنا|أنبأني|ثنا|نا)\b")
NUMLINE = re.compile(r"^\s*#?\s*([\d٠-٩]{1,5})\s*[-–]\s*$")
PROPHET = r"(?:رسول الله|النبي|نبي الله)"
def sahabi(t):
    m = re.search(r"عن\s+((?:أبي|أبى|أم|ابن|عبد)?\s*[ء-ي]+(?:\s+(?:بن|ابن|بنت)\s+(?:عبد\s+)?[ء-ي]+){0,3})[،,\s]+(?:رضي الله[^،:]*[،:]?\s*)?(?:قال|قالت|أن|أنه|أنها|يقول|عن)\s*:?\s*(?:قال\s+)?" + PROPHET, t)
    if m: return m.group(1).strip()
    L = re.findall(r"عن\s+((?:أبي|أبى|أم|ابن|عبد)?\s*[ء-ي]+(?:\s+(?:بن|ابن|بنت)\s+(?:عبد\s+)?[ء-ي]+){0,3})", t.split("«")[0])
    r = L[-1].strip() if L else ""
    return "" if r in ("أبيه", "أمه", "جده", "رجل", "عمه", "أبي") or r.startswith("بن") or len(r) < 3 else r
def matn(t):
    if " * " in t: return t.split(" * ", 1)[1][:1500].strip()  # نسخة النسائي وغيرها: «*» بين الإسناد والمتن
    q = re.findall(r"«([^»]{6,})»", t) or re.findall(r'"([^"]{6,})"', t)
    if q: return " … ".join(x.strip() for x in q)[:1500]
    m2 = list(re.finditer(PROPHET + r"(?:\s*-?\s*صلى الله عليه (?:وآله )?وسلم\s*-?)?\s*(?:(?:قال|يقول|فقال)\s*)?:\s*", t))
    if m2: return t[m2[-1].end():][:1500].strip(" *")
    m = list(re.finditer(PROPHET + r"[^:]{0,40}?(?:قال|يقول|فقال)\s*:?\s*", t))
    r = (t[m[-1].end():] if m else t)[:1500].strip(" *")
    if re.match(r"^(?:و)?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا)", r):  # لا متن ظاهر: ما بعد آخر «قال:» بعد الإسناد
        k = [x.end() for x in re.finditer(r"(?:قال|قالت|يقول)\s*:\s*", r)]
        if k: r = r[k[-1]:]
    return r
def pages_of(bid):
    fs = [os.path.join(D, "books", bid + ".json")] if os.path.exists(os.path.join(D, "books", bid + ".json")) else sorted(glob.glob(os.path.join(ROOT, "vols", bid + "-v*.json")))
    out = []
    for f in fs:
        vid = os.path.basename(f)[:-5]
        for i, p in enumerate(json.load(open(f, encoding="utf-8")).get("pages") or []): out.append((vid, i + 1, p if isinstance(p, str) else ""))
    return out
NUMD = [0]
def parse(bid):
    NUMD[0] = 0
    items, kitab, bab, cur, pend, seq = [], "", "", None, None, 0
    def close():
        nonlocal cur
        if cur:
            t = re.sub(r"\s+", " ", " ".join(cur["l"])).strip(); m = matn(t)
            if len(nz(m)) >= 12: items.append([cur["n"], cur["v"], cur["p"], kitab, bab, sahabi(t), " ".join(nz(m).split()[:7]), m])
        cur = None
    for vid, p, pg in pages_of(bid):
        for line in re.sub(r"<[^>]+>", "", pg.split("______")[0]).split("\n"):
            l = line.strip()
            if not l: continue
            mn = NUMLINE.match(l)
            if mn: pend = int(mn.group(1).translate(AR)); continue
            h = l.lstrip("#").strip()
            if l.startswith("#") and re.match(r"^(?:[\d٠-٩]+\s*[-–]\s*)?كتاب\b", h): close(); kitab = re.sub(r"^[\d٠-٩]+\s*[-–]\s*", "", h)[:90]; continue
            if re.match(r"^\(?\s*(?:[\d٠-٩]+\s*[-–]?\s*)?باب\b", h) and len(h) < 220: close(); bab = re.sub(r"^\(?\s*[\d٠-٩]+\s*[-–]?\s*|\)\s*$", "", h)[:160]; continue
            m = START.match(l)
            if m:
                close(); seq += 1; NUMD[0] += 1 if (m.group(1) or pend) else 0; n = int(m.group(1).translate(AR)) if m.group(1) else (pend or seq); pend = None
                cur = {"n": n, "v": vid, "p": p, "l": [re.sub(r"^\s*#?\s*\(?\s*[\d٠-٩]{1,5}\s*\)?\s*[-–.]?\s*", "", l)]}
            elif cur is not None and not l.startswith("#"):
                if re.match(r"^قال (?:أبو عيسى|أبو داود|أبو عبد الرحمن|مالك|أبو محمد)", l): close(); continue  # كلام المصنف بعد الحديث
                cur["l"].append(l)
    close()
    return items
def main():
    os.makedirs(OUT, exist_ok=True); lst = {}
    for bid, title in BOOKS:
        if not pages_of(bid): continue
        L = parse(bid)
        seen = set(); rows, M = [], {}
        for n, v, p, k, b, s, tarf, m in L:
            key = n
            while key in seen: key = round(key + 0.01, 2)  # رقم مكرر (روايات تحت رقم واحد)
            seen.add(key); rows.append([key, v, p, k, b, s, tarf]); M[str(key)] = m
        # الفهرس خفيف، والمتون في أجزاء (٥٠٠ حديث للجزء) تُحمَّل عند الحاجة
        for k in range(0, len(rows), 500):
            os.makedirs(os.path.join(OUT, bid), exist_ok=True)
            json.dump({str(r[0]): M[str(r[0])] for r in rows[k:k + 500]}, open(os.path.join(OUT, bid, "m%d.json" % (k // 500)), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        json.dump({"t": title, "items": rows}, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        lst[bid] = {"t": title, "n": len(rows), "seq": 1 if NUMD[0] < len(rows) * 0.5 else 0}; print(title, len(rows))
    json.dump(lst, open(os.path.join(OUT, "_list.json"), "w", encoding="utf-8"), ensure_ascii=False)
if __name__ == "__main__":
    main()
