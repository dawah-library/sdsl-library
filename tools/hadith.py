#!/usr/bin/env python3
"""قسم الحديث (البند ١٩): يستخرج الأحاديث من كتب الحديث المرتبة في المكتبة (رياض الصالحين، الأربعون النووية، بلوغ المرام…)
بنصها كما في الكتاب: الباب، والصحابي، والمتن، والتخريج، وحكم المصنف إن ذكره، والشرح الموجز الذي يليه في الكتاب نفسه.
المخرج: data/hadith/index.json (للترتيب الموضوعي وبالكتاب وبالأطراف وبالصحابي) وdata/hadith/<كتاب>.json (المتن الكامل والشرح).
لا يُكتب شيء من الذاكرة: كل حقل مقتطع من نص الكتاب، ومعه رقم صفحته للرجوع إليه."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "hadith")
BOOKS = [("arbain", "الأربعون النووية"), ("riyad", "رياض الصالحين"), ("bulugh", "بلوغ المرام")]
DIA = re.compile(r"[ً-ْٰـ]")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", s).strip()
ORD = r"(?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|الحادي عشر|الثاني عشر|الثالث عشر|الرابع عشر|الخامس عشر|السادس عشر|السابع عشر|الثامن عشر|التاسع عشر|العشرون|[\d٠-٩]{1,4})"
START = re.compile(r"^\s*(?:«\s*)?(?:" + ORD + r"\s*[:\-–.]\s*)?(?:«\s*)?و?عن\s+(?!ذلك|هذا|هذه)")
TAKH = re.compile(r"((?:متفق عليه|رواه|أخرجه|أخرجاه|رواهما|خرجه)(?:[^\n.:]|:(?!\n)|:\n){0,220}?)(?:[.\n]|$)")
HUKM = re.compile(r"(حديث\s+(?:حسن\s+صحيح|حسن|صحيح|ضعيف|غريب)[^.،\n]{0,40}|ب?إسناد\s+(?:صحيح|حسن|ضعيف)|وصححه\s+[^.،\n]{2,40}|وحسنه\s+[^.،\n]{2,40}|وضعفه\s+[^.،\n]{2,40}|وإسناده\s+(?:صحيح|حسن|ضعيف)[^.،\n]{0,20})")
SAH = re.compile(r"عن\s+((?:أبي|أم|ابن|عبد|أبى)?\s*[^\n،:]{2,60}?)\s+رضي\s+الله\s+(?:تعالى\s+)?عنه(?:ما|م|ا)?")
SAH2 = re.compile(r"عن\s+((?:أبي|أم|ابن|عبد)?\s*[ء-ي]+(?:\s+(?:بن|ابن|بنت)\s+[ء-ي]+){0,3})")

def matn(t):
    """المتن: ما بين علامات التنصيص، وإلا ما بعد «قال/قالت/فقال/يقول:»، وإلا النص بعد ذكر الصحابي."""
    t = t.strip()
    m = re.search(r"[«\"“]([^»\"”]{12,})[»\"”]", t)
    if m:
        q = m.group(1).strip()
        if not re.match(r"^و?عن\s", q): return q
        t = q  # الحديث كله بين «» ومعه راويه (كالأربعين): يُستخرج المتن من داخله
        m2 = re.search(r"[\"“]([^\"”]{12,})[\"”]", t)
        if m2: return m2.group(1).strip()
    m = re.search(r"(?:قال|قالت|فقال|فقالت|يقول|تقول)\s*:\s*(.{12,})", t, re.S)
    if m: return m.group(1).strip(" \"«»")
    t = re.sub(r"^.*?رضي\s+الله\s+(?:تعالى\s+)?عنه(?:ما|م|ا)?\s*[،,:]?\s*", "", t, count=1, flags=re.S)
    return t.strip(" \"«»")

def parse(bid, title):
    d = json.load(open(os.path.join(D, "books", bid + ".json"), encoding="utf-8")); pages = d.get("pages") or []
    toc = sorted((x for x in (d.get("toc") or []) if x.get("p")), key=lambda x: x["p"]); ti = 0; bab = ""; kitab = ""
    out = []; cur = None
    def close():
        nonlocal cur
        if not cur: return
        body = "\n".join(cur["lines"]).strip(); tk = TAKH.search(body); hk = HUKM.search(body)
        head = body[: tk.end()] if tk else body
        sharh = body[tk.end():].strip(" .،\n") if tk else ""
        sm = SAH.search(head) or SAH2.search(head)
        mt = matn(head[: tk.start()] if tk else head)
        if len(nz(mt)) >= 15:
            out.append({"b": bid, "p": cur["p"], "k": cur["k"], "bab": cur["bab"], "sah": re.sub(r"\s+", " ", sm.group(1)).strip(" -") if sm else "",
                        "m": mt, "full": head.strip(), "t": tk.group(1).strip() if tk else "", "h": hk.group(1).strip() if hk else "",
                        "sh": re.sub(r"\n{2,}", "\n", sharh)[:900]})
        cur = None
    for i, pg in enumerate(pages):
        if not isinstance(pg, str): continue
        while ti < len(toc) and toc[ti]["p"] <= i + 1:
            t = toc[ti].get("t", ""); (kitab := t) if (toc[ti].get("l") or 1) == 1 and re.match(r"^(كتاب|باب)?", t) and t.startswith("كتاب") else None
            bab = t; ti += 1
        for line in pg.split("______")[0].split("\n"):
            l = line.strip()
            if not l: continue
            if l.startswith("#"):
                h = l.lstrip("#").strip()
                if h:
                    close()
                    if h.startswith("كتاب"): kitab = h
                    bab = h
                if bid == "arbain" and re.match(r"الحديث", h or ""): cur = {"p": i + 1, "k": kitab, "bab": h, "lines": []}
                continue
            if START.match(l) and (bid != "arbain"):
                close(); cur = {"p": i + 1, "k": kitab, "bab": bab, "lines": [re.sub(r"^\s*" + ORD + r"\s*[:\-–.]\s*", "", l)]}
            elif cur is not None:
                cur["lines"].append(l)
    close()
    return out

def main():
    os.makedirs(OUT, exist_ok=True); idx = []; n = 0
    for bid, title in BOOKS:
        if not os.path.exists(os.path.join(D, "books", bid + ".json")): continue
        L = parse(bid, title); det = {}
        for k, h in enumerate(L, 1):
            hid = "%s-%d" % (bid, k); n += 1
            # الطرف من كلام النبي ﷺ لا من صيغة الرواية («سمعت رسول الله ﷺ يقول:»)
            core = re.sub(r"^(?:سمعت|سمعنا|ان|أن|قال|كان)?\s*(?:رسول الله|النبي|نبي الله)[^:«\"]{0,60}?(?:يقول|قال|فقال)\s*[:،]?\s*", "", nz(h["m"]))
            tarf = " ".join((core if len(core.split()) >= 4 else nz(h["m"])).split()[:6])
            idx.append([hid, bid, h["p"], h["k"], h["bab"], h["sah"], tarf, h["t"][:90], h["h"]])
            det[hid] = {"m": h["m"], "full": h["full"], "sh": h["sh"]}
        json.dump(det, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(bid, len(L))
    json.dump({"note": "يولّده tools/hadith.py من نصوص الكتب: [المعرف، الكتاب، الصفحة، الكتاب الفقهي، الباب، الصحابي، الطرف، التخريج، الحكم]", "books": dict(BOOKS), "items": idx},
              open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("المجموع", n)

if __name__ == "__main__":
    main()
