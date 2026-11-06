#!/usr/bin/env python3
"""أغلفة الكتب المصغرة: لكل كتاب له نسخة مصورة (pdf في الفهرس) تُرسم الصفحة الأولى من المصورة صورةً صغيرة
(عرض ٢٠٠ بكسل، JPEG) في assets/covers/<id>.jpg، وتُكتب قائمة المعرّفات في data/covers.json فتعرضها الواجهة بجوار اسم الكتاب.
المصورات في مخزن R2 الخاص تُجلب بهوية المهمة (OIDC) كما في pdf-match.py. الكتب بلا مصورة تعرض الواجهة لها غلافًا مولَّدًا بالهوية.
المتغيرات: COVERS_ONLY (معرّفات بعينها)، COVERS_FORCE=1 (إعادة الرسم)، COVERS_PAGE (رقم الصفحة، الافتراضي ١)،
وdata/covers.json قد يحمل "page": {"<id>": رقم} لاختيار صفحة أخرى لكتاب غلافه ليس الأولى، و"skip": [..] لاستبعاد كتاب."""
import json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "covers"); LIST = os.path.join(ROOT, "data", "covers.json")

def main():
    import importlib.util
    spec = importlib.util.spec_from_file_location("pm", os.path.join(ROOT, "tools", "pdf-match.py"))
    pm = importlib.util.module_from_spec(spec); spec.loader.exec_module(pm)
    os.makedirs(OUT, exist_ok=True)
    cat = json.load(open(os.path.join(ROOT, "data/catalog.json"), encoding="utf-8"))
    try: meta = json.load(open(LIST, encoding="utf-8"))
    except Exception: meta = {}
    pages, skip = meta.get("page", {}), set(meta.get("skip", []))
    only = set(filter(None, os.environ.get("COVERS_ONLY", "").replace(",", " ").split()))
    force = os.environ.get("COVERS_FORCE") == "1"; deadline = time.time() + 60 * float(os.environ.get("COVERS_MINUTES", "80"))
    books = [b for b in cat["books"] if b.get("pdf") and not b.get("demo") and b["id"] not in skip and (not only or b["id"] in only)]
    done, fail = 0, []
    with tempfile.TemporaryDirectory() as tmp:
        for b in books:
            bid = b["id"]; dest = os.path.join(OUT, bid + ".jpg")
            if os.path.exists(dest) and not force and bid not in only: continue
            if time.time() > deadline: break
            try:
                pdf = pm.get_pdf(bid, tmp); n = int(pages.get(bid) or os.environ.get("COVERS_PAGE") or 1)
                base = os.path.join(tmp, "c_" + bid)
                subprocess.run(["pdftoppm", "-f", str(n), "-l", str(n), "-scale-to-x", "200", "-scale-to-y", "-1", "-jpeg", "-jpegopt", "quality=72,progressive=y", "-singlefile", pdf, base], check=True, capture_output=True, timeout=120)
                os.replace(base + ".jpg", dest); done += 1; print("✓", bid, b.get("title"))
                if not pdf.startswith(os.path.join(ROOT, "pdf")): os.remove(pdf)
            except Exception as e:
                fail.append(bid); print("✗", bid, e, file=sys.stderr)
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".jpg"))
    meta.update({"note": "يولّده tools/covers.py (covers.yml)", "ids": ids})
    meta.setdefault("page", {}); meta.setdefault("skip", [])
    json.dump(meta, open(LIST, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("رُسم", done, "غلافًا، المجموع", len(ids), "، تعذّر", len(fail))

if __name__ == "__main__":
    main()
