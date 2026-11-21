#!/usr/bin/env python3
"""مطلع الحديث من روايته في الكتاب (طلب المدير، ٢١ نوفمبر ٢٠٢٦): يُعرض الحديث في قسم الحديث بأسلوب القراءة المعتاد —
«عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللهُ عَنْهُ، قَالَ: قَالَ رَسُولُ اللهِ ﷺ: …» أو «سَمِعْتُ رَسُولَ اللهِ ﷺ يَقُولُ» أو «حَدَّثَنَا الصَّادِقُ الْمَصْدُوقُ» —
بلفظ الكتاب والرواية نفسها، لا اسم الصحابي وحده.
لكل حديث: يُطابَق أول متنه في صفحته من الكتاب (والسابقة لها)، ويُرجع إلى أول سطر الحديث (صيغ التحديث)، ثم يُقتطع من النص الواقع
قبل المتن ما يبدأ بذكر الصحابي («عن فلان»، «سمعت»، «أن فلانًا») أو بذكر النبي ﷺ — فهو المطلع، وما قبله الإسناد.
المخرج: data/hadith/k/<كتاب>/l<i>.json بجانب أجزاء المتون (m<i>.json، ٥٠٠ حديث لكل جزء): {"رقم": "المطلع"}، وما لم يُعرف مطلعه لا يُكتب.
الاستعمال: python3 tools/hadith-lead.py [كتاب…]  (بلا وسائط: الكتب كلها)"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); K = os.path.join(ROOT, "data", "hadith", "k")
DIA = re.compile(r"[ً-ْٰـ]")
CHAIN0 = re.compile(r"^\s*(?:[\(\[]?[\d٠-٩]+[\)\]]?\s*[-–.ـ/]*\s*)*(?:و)?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني|ثنا|سمعت|قال\s+(?:أبو|حدثنا|أخبرنا))")
PROPH = re.compile(r"(?:^|\s)(?:و?قال|أن|عن|سمعت|سمع|قالت|يقول|رأيت|كان)\s+(?:رسول\s+الله|النبي|نبي\s+الله)")
LEADV = r"(?:عن|سمعت|أن|أنه|أنها|قال|قالت|حدثني|حدثنا|أخبرني|أخبرنا)"


def nmap(s):
    out, idx = [], []
    for i, c in enumerate(s):
        if DIA.match(c): continue
        c = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"}.get(c, c)
        if not re.match(r"[ء-ي0-9٠-٩]", c): c = " "
        if c == " " and out and out[-1] == " ": continue
        out.append(c); idx.append(i)
    return "".join(out), idx


def body(t): return re.sub(r"<[^>]+>", "", re.split(r"^\s*_{4,}\s*$", t or "", flags=re.M)[0])


def lead_of(pages, p, matn, sah):
    prev = body(pages[p - 2]) if p >= 2 else ""
    txt = prev + "\n" + body(pages[p - 1] if 0 < p <= len(pages) else "")
    N, idx = nmap(txt); w = [x for x in nmap(matn)[0].split() if len(x) > 1]
    if len(w) < 2: return ""
    k = -1; pn = len(nmap(prev)[0])
    for L in (6, 4, 3):
        key = " ".join(w[:L]); k = N.find(key, max(0, pn - 400))
        if k < 0: k = N.find(key)
        if k >= 0: break
    if k < 0: return ""
    pos = idx[k]; lines = txt[:pos].split("\n"); j = len(lines) - 1
    while j >= 0 and not CHAIN0.match(DIA.sub("", lines[j])): j -= 1
    if j < 0 or len(lines) - 1 - j > 6: return ""
    pre = "\n".join(lines[j:]); pn2, pidx = nmap(pre)
    st = -1
    if sah:
        sn = nmap(sah)[0].strip()
        if len(sn) >= 3:
            for m in re.finditer(r"(?:^|\s)%s\s+(?:\S+\s+){0,1}%s" % (LEADV, re.escape(sn)), pn2): st = m.start()
            if st < 0:
                i = pn2.rfind(sn)
                if i >= 0: st = i
    if st < 0:
        ms = list(PROPH.finditer(pn2))
        if ms: st = ms[-1].start()
    if st < 0: return ""
    while st < len(pn2) and pn2[st] == " ": st += 1
    lead = pre[pidx[st]:] if st < len(pidx) else ""
    lead = re.sub(r"#?\s*\[ص:\s*[\d٠-٩]+\]\s*|^#+\s*", " ", lead, flags=re.M)
    lead = re.sub(r"\s+", " ", lead).strip()
    lead = re.sub(r"[\s«\"(\[،:-]+$", "", lead).strip()
    if len(lead) < 4 or len(lead) > 400: return ""
    if nmap(lead)[0].strip() and nmap(matn)[0].startswith(nmap(lead)[0].strip()[:20]): return ""  # المتن يبدأ بالمطلع نفسه
    return lead


def pages_of(vid, cache={}):
    if vid not in cache:
        cache.clear()
        for f in (os.path.join(ROOT, "data", "books", vid + ".json"), os.path.join(ROOT, "vols", vid + ".json")):
            if os.path.exists(f):
                try: cache[vid] = json.load(open(f, encoding="utf-8")).get("pages") or []
                except Exception: cache[vid] = []
                break
        else: cache[vid] = []
    return cache[vid]


def run(b):
    ix = json.load(open(os.path.join(K, b + ".json"), encoding="utf-8")).get("items") or []
    got = tot = 0
    for c in range(0, len(ix), 500):
        mf = os.path.join(K, b, "m%d.json" % (c // 500))
        if not os.path.exists(mf): continue
        M = json.load(open(mf, encoding="utf-8")); out = {}
        for x in ix[c:c + 500]:
            m = M.get(str(x[0])) or ""
            if not m: continue
            tot += 1; L = lead_of(pages_of(x[1]), int(x[2] or 0), m, x[5] if len(x) > 5 else "")
            if L: out[str(x[0])] = L; got += 1
        lf = os.path.join(K, b, "l%d.json" % (c // 500))
        if out: json.dump(out, open(lf, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        elif os.path.exists(lf): os.remove(lf)
    print("%-16s %6d/%6d (%d%%)" % (b, got, tot, 100 * got // max(1, tot)), flush=True)
    return got, tot


if __name__ == "__main__":
    L = json.load(open(os.path.join(K, "_list.json"), encoding="utf-8"))
    bs = sys.argv[1:] or list(L)
    G = T = 0
    for b in bs:
        g, t = run(b); G += g; T += t
    print("المجموع: %d من %d" % (G, T))
