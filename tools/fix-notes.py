#!/usr/bin/env python3
"""ينزل الحواشي التي بقيت في متن الصفحات إلى موضعها بعد سطر ______ (notes_split في tools/ocr-pdf.py).
  python3 tools/fix-notes.py            # كل الكتب المحوَّلة من نسخ مصورة
  python3 tools/fix-notes.py pdbfbb888  # كتاب بعينه
لا يغيّر حرفًا من النص؛ ينقل الأسطر فقط. والتحويل الجديد والتدقيق الدوري يطبقانها آليًا."""
import importlib.util, json, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ocr", os.path.join(R, "tools", "ocr-pdf.py")); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
cat = json.load(open(os.path.join(R, "data", "catalog.json"), encoding="utf-8"))
ids = sys.argv[1:] or [b["id"] for b in cat["books"] if b.get("ocr") and not b.get("vf")]
for bid in ids:
    f = os.path.join(R, "data", "books", bid + ".json")
    if not os.path.exists(f): continue
    sh = json.load(open(f, encoding="utf-8")); n = 0
    for i, p in enumerate(sh["pages"]):
        q = m.notes_split(p)
        if q != p: sh["pages"][i] = q; n += 1
    if n:
        s = json.dumps(sh, ensure_ascii=False, separators=(",", ":")); open(f, "w", encoding="utf-8").write(s)
        b = next(x for x in cat["books"] if x["id"] == bid); b["size"] = len(s.encode())
        print(f"{bid}: نُقلت حواشي {n} صفحة — {b['title']}")
json.dump(cat, open(os.path.join(R, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
