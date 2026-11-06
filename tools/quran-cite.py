#!/usr/bin/env python3
"""فهرس الآيات في كتب الدعوة ومقالاتها (للمصحف الرقمي #/mushaf): كل موضع عُزيت فيه آية بصيغة [السورة: رقم] أو [السورة: رقم-رقم]
في كتب مكتبة الدعوة ومقالاتها وفتاواها، مع موجز من كلام المؤلف بعد الآية (ما يستفاد منها) ورقم الصفحة.
المخرج: data/qcite/<سورة>.json = {"آية": [[المعرّف، الصفحة، "الموجز"]...]} (الكتب أولًا، حتى ٢٥ موضعًا للآية)، و_meta.json بالعناوين.
تشغيله: qcite.yml أسبوعيًا وعند تعديل الأداة."""
import json, os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "qcite")
DIA = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه"); return re.sub(r"\s+", " ", s).strip()
def sura_names():
    q = json.load(open(os.path.join(D, "quran", "quran.json"), encoding="utf-8"))["suras"]; m = {}
    for s in q:
        n = re.sub(r"^سوره\s+", "", nz(s["name"])); m[n] = s["n"]; m[re.sub(r"^ال", "", n)] = s["n"]
    for k, v in {"الاسراء": 17, "بني اسرائيل": 17, "المؤمن": 40, "غافر": 40, "حم السجده": 41, "فصلت": 41, "التوبه": 9, "براءه": 9, "الدهر": 76, "الانسان": 76, "تبارك": 67, "الملك": 67, "عم": 78, "النبا": 78, "الطلاق": 65, "التحريم": 66, "المجادله": 58, "الممتحنه": 60, "الصف": 61, "قريش": 106, "الاخلاص": 112, "المسد": 111, "تبت": 111}.items():
        m.setdefault(k, v)
    return m, {s["n"]: len(s["ayat"]) for s in q}
# [البقرة: ٢٥٥] و[البقرة: ٢٥٥-٢٥٧] في الكتب، و(البقرة:216) و(آل عمران: من الآية17) في المقالات
CITE = re.compile(r"[\[(]\s*(?:سورة\s+|سوره\s+)?([ء-يً-ْ ]{2,22}?)\s*:\s*(?:من\s+)?(?:الآية|الاية|الآيات|الايات|آية|اية)?\s*([\d٠-٩۰-۹]{1,3})(?:\s*[-–،,]\s*([\d٠-٩۰-۹]{1,3}))?\s*[\])]")
def main():
    names, counts = sura_names()
    cat = json.load(open(os.path.join(D, "catalog.json"), encoding="utf-8"))
    meta = {b["id"]: [b.get("setTitle") or b["title"], b.get("authorId", ""), "b"] for b in cat["books"] if (b.get("col") or "dawah") == "dawah" and not b.get("demo") and not b.get("hidden")}
    texts = []
    for f in glob.glob(os.path.join(D, "books", "*.json")):
        bid = os.path.basename(f)[:-5]
        if bid in meta:
            try: texts.append((bid, json.load(open(f, encoding="utf-8")).get("pages") or []))
            except Exception: pass
    try:
        for x in json.load(open(os.path.join(D, "articles", "index.json"), encoding="utf-8"))["items"]:
            if (x.get("col") or "dawah") == "dawah" and not x.get("h"): meta[x["id"]] = [x.get("t", ""), x.get("a", ""), "fatwa" if x.get("fa") else "a"]
        for f in glob.glob(os.path.join(D, "articles", "*.json")):
            if os.path.basename(f) == "index.json": continue
            g = json.load(open(f, encoding="utf-8"))
            for aid, a in g.items():
                if aid in meta and isinstance(a, dict):
                    pg = a.get("pages"); texts.append((aid, pg if isinstance(pg, list) else [pg] if isinstance(pg, str) else []))
    except Exception as e: print("المقالات:", e)
    idx = {}
    for bid, pages in texts:
        for i, pg in enumerate(pages):
            if not isinstance(pg, str) or not ("[" in pg or "(" in pg): continue
            body = pg.split("______")[0]
            for m in CITE.finditer(body):
                s = names.get(nz(m.group(1))) or names.get(re.sub(r"^ال", "", nz(m.group(1))))
                if not s: continue
                a1 = int(m.group(2).translate(AR)); a2 = int((m.group(3) or m.group(2)).translate(AR))
                if not (1 <= a1 <= counts[s]) or a2 < a1 or a2 - a1 > 20: continue
                after = body[m.end(): m.end() + 400]
                after = re.split(r"(?<=[.؟!])\s", re.sub(r"\s+", " ", re.sub(r"[#*]|\(\s*[\d٠-٩]+\s*\)", "", after)).strip(), maxsplit=2)
                snip = " ".join(after[:2]).strip(" ،,.-")[:170]
                if len(snip) < 25 or snip.startswith(("[", "﴿", "{")): snip = ""
                for a in range(a1, a2 + 1):
                    idx.setdefault(s, {}).setdefault(str(a), []).append([bid, i + 1, snip])
    os.makedirs(OUT, exist_ok=True); used = set(); tot = 0
    order = {"b": 0, "a": 1, "fatwa": 2}
    for s, ay in idx.items():
        out = {}
        for a, l in ay.items():
            seen = set(); ll = []
            for x in sorted(l, key=lambda z: (order.get(meta[z[0]][2], 3), 0 if z[2] else 1)):
                if (x[0], x[1]) in seen: continue
                seen.add((x[0], x[1])); ll.append(x)
            out[a] = ll[:25]; used.update(x[0] for x in out[a]); tot += len(out[a])
        json.dump(out, open(os.path.join(OUT, "%d.json" % s), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({k: meta[k] for k in used}, open(os.path.join(OUT, "_meta.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("سور:", len(idx), "مواضع:", tot, "مصادر:", len(used))

if __name__ == "__main__":
    main()
