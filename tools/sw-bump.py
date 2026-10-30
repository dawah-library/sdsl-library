#!/usr/bin/env python3
"""يرفع رقم إصدار عامل الخدمة (V في sw.js) إذا تغيّر محتوى أي ملف واجهة منذ آخر رفع.

عامل الخدمة يقدّم ملفات الواجهة من الجهاز دون طلبها من Vercel (لخفض طلبات CDN)،
فلا تصل النسخة الجديدة إلا برفع V. يحفظ هذا السكربت بصمة الملفات في tools/sw-hash.txt
ويرفع V آليًا عند اختلافها، فلا يُنسى الرفع يدويًا.
الاستعمال: python3 tools/sw-bump.py  (يطبع bumped أو unchanged)
"""
import hashlib, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
sw = root / "sw.js"
src = sw.read_text(encoding="utf-8")
core = json.loads(re.search(r"CORE=(\[[^\]]*\])", src).group(1))
files = sorted({c for c in core if c not in ("./",)} |
               {p.relative_to(root).as_posix() for p in root.glob("*.js") if p.name != "sw.js"} |
               {"style.css", "index.html"})
h = hashlib.sha256()
for f in files:
    p = root / f
    if p.is_file():
        h.update(f.encode()); h.update(p.read_bytes())
digest = h.hexdigest()[:16]
hf = root / "tools" / "sw-hash.txt"
old = hf.read_text().strip() if hf.exists() else ""
if old == digest:
    print("unchanged"); sys.exit(0)
m = re.search(r'const V="sdsl-v(\d+)"', src)
n = int(m.group(1)) + (1 if old else 0)  # أول تشغيل: يسجّل البصمة فقط
src = src.replace(m.group(0), f'const V="sdsl-v{n}"')
sw.write_text(src, encoding="utf-8")
hf.write_text(digest + "\n")
print(f"bumped sdsl-v{n}" if old else f"recorded sdsl-v{n}")
