#!/usr/bin/env python3
"""يحوّل صفحات كتاب جُلبت من المكتبة الشاملة (JSON: [[رقم، «ج١ - ص٣٠»، النص]]) إلى كتاب في المكتبة مقسَّم مجلدات (vols/<id>-vNN.json)
وإدخال الفهرس. استُعمل لـ«فقه السنة» للسيد سابق (shamela.ws/book/9486)، ويصلح لكتب غير موجودة في OpenITI/تراث.
الاستخدام: python3 tools/shamela-pages-build.py pages.json"""
import json, re, os, sys, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
ID, TITLE, AID, TOPIC = "fiqhsunna", "فقه السنة", "ta_sayyidsabiq", "t4"
SRC = "المكتبة الشاملة (shamela.ws/book/9486): نص كتاب «فقه السنة» بترقيم الطبعة المطبوعة (ج، ص)"
LIC = "نص مأخوذ من المكتبة الشاملة (المصدر مُثبَّت ورابطه)؛ الكتاب للشيخ سيد سابق (ت ١٤٢٠هـ) وحقوق الطبعة لأصحابها، وتُحذف المادة أو تُحوَّل إلى رابط للمصدر عند طلب أصحاب الحقوق"
P = json.load(open(sys.argv[1], encoding="utf8"))
rows = []; v, p = 1, 4
for n, h, t in P:
    m = re.match(r"ج(\d+) - ص(\d+)", h or "")
    if m: v, p = int(m.group(1)), int(m.group(2))
    else: p += 1
    JUNK = {"###### مسار الصفحة الحالية:", "ص:>>>اذهب", "+ - التشكيل", "بحــث", "تحميل الصفحة التالية", "تحميل الصفحة السابقة", "---"}  # بقايا واجهة الموقع
    ls = t.split("\n"); ne = [i for i, l in enumerate(ls) if l.strip()]; edge = set(ne[:6] + ne[-6:])
    ls = [l for i, l in enumerate(ls) if l.strip() not in JUNK and not l.strip().startswith("فهرس الكتاب") and not (i in edge and re.fullmatch(r"\d{1,2}", l.strip()))]
    t = re.sub(r"\n{3,}", "\n\n", "\n".join(ls)).strip()
    t = re.sub(r"(?m)^\[([^\]\n]{2,140})\]\s*$", r"# \1", t)
    rows.append((v, p, t))
vols = sorted({v for v, _, _ in rows}); today = datetime.date.today().isoformat()
os.makedirs(os.path.join(ROOT, "vols"), exist_ok=True); entries = []
for vv in vols:
    vp = [(p, t) for v, p, t in rows if v == vv]; bid = "%s-v%02d" % (ID, vv)
    toc = [{"t": l[2:].strip(), "p": i + 1} for i, (p, t) in enumerate(vp) for l in t.split("\n") if l.startswith("# ") and 2 < len(l) < 140][:1500]
    sh = {"id": bid, "pages": [t for _, t in vp], "toc": toc, "pl": ["ج%d ص%d" % (vv, p) for p, _ in vp]}
    s = json.dumps(sh, ensure_ascii=False, separators=(",", ":")); open(os.path.join(ROOT, "vols", bid + ".json"), "w", encoding="utf8").write(s)
    entries.append({"id": bid, "title": "%s — ج %d" % (TITLE, vv), "set": ID, "setTitle": TITLE, "vol": vv, "vols": len(vols), "vf": 1, "big": 1, "authorId": AID, "topicId": TOPIC, "col": "turath", "type": "book",
                    "n": len(vp), "size": len(s.encode("utf8")), "source": SRC, "license": LIC, "added": today, "shamela": "9486"})
cp = os.path.join(ROOT, "data", "catalog.json"); cat = json.load(open(cp, encoding="utf8"))
if not any(a["id"] == AID for a in cat["authors"]):
    cat["authors"].append({"id": AID, "name": "سيد سابق", "col": "turath", "died": 1420, "bio": "عالم أزهري مصري (ت ١٤٢٠هـ/٢٠٠٠م)، صاحب كتاب «فقه السنة» في الفقه الميسَّر بأدلته من الكتاب والسنة."})
ids = {e["id"] for e in entries}; cat["books"] = [b for b in cat["books"] if b["id"] not in ids] + entries; cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
json.dump(cat, open(cp, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
print(len(rows), "صفحة،", len(vols), "مجلدات", [e["n"] for e in entries])
