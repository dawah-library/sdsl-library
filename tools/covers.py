#!/usr/bin/env python3
"""أغلفة الكتب المصغرة: لكل كتاب له نسخة مصورة (pdf في الفهرس) يُبحث في أول COVERS_SCAN صفحات (٨) عن صفحة الغلاف نفسها:
أول صفحة ملوّنة (نسبة البكسلات الملونة ≥ ٣٪؛ الغلاف المطبوع ملون، وصفحات العنوان والنص أبيض وأسود)، فتُرسم صورةً صغيرة
(عرض ٢٠٠ بكسل، JPEG) في assets/covers/<id>.jpg، وتُكتب قائمة المعرّفات في data/covers.json فتعرضها الواجهة بجوار اسم الكتاب.
المصورات في مخزن R2 الخاص تُجلب بهوية المهمة (OIDC) كما في pdf-match.py. الكتب بلا مصورة تعرض الواجهة لها غلافًا مولَّدًا بالهوية.
المتغيرات: COVERS_ONLY (معرّفات بعينها)، COVERS_FORCE=1 (إعادة الرسم)، COVERS_PAGE (رقم الصفحة، الافتراضي ١)،
وdata/covers.json قد يحمل "page": {"<id>": رقم} لاختيار صفحة بعينها، و"skip": [..] لاستبعاد كتاب، و"manual": [..] لأغلفة رفعتها الإدارة (لا تُستبدل).
إن لم توجد صفحة ملونة تُستعمل الصفحة الأولى ويُذكر الكتاب في "bw" وفي tools/covers-report.md لتراجعه الإدارة (أو ترفع غلافه من بطاقة الكتاب)."""
import json, os, subprocess, sys, tempfile, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "covers"); LIST = os.path.join(ROOT, "data", "covers.json")

def colorful(path):
    """نسبة البكسلات الملونة (تشبع وإضاءة كافيان): الأغلفة ملونة، وصفحات العنوان والنص رمادية."""
    from PIL import Image
    im = Image.open(path).convert("HSV"); im.thumbnail((100, 140))
    d = im.tobytes(); n = len(d) // 3
    return sum(1 for i in range(0, n * 3, 3) if d[i + 1] > 64 and d[i + 2] > 40) / max(1, n)

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
    manual = set(meta.get("manual", []))
    books = [b for b in cat["books"] if b.get("pdf") and not b.get("demo") and b["id"] not in skip and b["id"] not in manual and (not only or b["id"] in only)]
    done, fail, bw, info = 0, [], [], {}
    old_bw = set(meta.get("bw", []))
    with tempfile.TemporaryDirectory() as tmp:
        for b in books:
            bid = b["id"]; dest = os.path.join(OUT, bid + ".jpg")
            if os.path.exists(dest) and not force and bid not in only: continue
            if time.time() > deadline: break
            try:
                pdf = pm.get_pdf(bid, tmp); n = pages.get(bid)
                if not n:  # ابحث عن صفحة الغلاف الملونة في أول الصفحات
                    scan = int(os.environ.get("COVERS_SCAN", "8")); base = os.path.join(tmp, "s_" + bid)
                    subprocess.run(["pdftoppm", "-f", "1", "-l", str(scan), "-scale-to-x", "80", "-scale-to-y", "-1", "-png", pdf, base], capture_output=True, timeout=180)
                    shots = sorted(f for f in os.listdir(tmp) if f.startswith("s_" + bid) and f.endswith(".png"))
                    for f in shots:
                        k = int(f.rsplit("-", 1)[1][:-4]); c = colorful(os.path.join(tmp, f))
                        if c >= 0.03 and not n: n = k; info[bid] = round(c, 3)
                        os.remove(os.path.join(tmp, f))
                    if not n: n = 1; bw.append(bid)
                base = os.path.join(tmp, "c_" + bid)
                subprocess.run(["pdftoppm", "-f", str(n), "-l", str(n), "-scale-to-x", "200", "-scale-to-y", "-1", "-jpeg", "-jpegopt", "quality=72,progressive=y", "-singlefile", pdf, base], check=True, capture_output=True, timeout=120)
                os.replace(base + ".jpg", dest); done += 1; meta.setdefault("v", {})[bid] = format(int(time.time()), "x"); print("✓", bid, "ص", n, b.get("title"))
                if not pdf.startswith(os.path.join(ROOT, "pdf")): os.remove(pdf)
            except Exception as e:
                fail.append(bid); print("✗", bid, e, file=sys.stderr)
    ids = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".jpg"))
    redone = {b["id"] for b in books}
    bwl = sorted((old_bw - redone | set(bw)) & set(ids) - manual)
    meta.update({"note": "يولّده tools/covers.py (covers.yml)", "ids": ids, "bw": bwl})
    for k in ("page", "skip", "manual"): meta.setdefault(k, {} if k == "page" else [])
    t = {b["id"]: b.get("setTitle") or b.get("title") for b in cat["books"]}
    open(os.path.join(ROOT, "tools", "covers-report.md"), "w", encoding="utf-8").write(
        "# أغلفة الكتب المصغرة\n\nالمجموع: %d غلافًا (منها %d رفعتها الإدارة).\n\n## لم تُوجد في أول صفحاتها صفحة غلاف ملونة (استُعملت الصفحة الأولى)\n\n" % (len(ids), len(manual))
        + ("\n".join("- %s (`%s`): راجعها، وحدّد صفحة الغلاف في data/covers.json (\"page\")، أو ارفع غلافه من بطاقة الكتاب." % (t.get(i, i), i) for i in bwl) or "لا شيء.") + "\n")
    json.dump(meta, open(LIST, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("رُسم", done, "غلافًا، المجموع", len(ids), "، تعذّر", len(fail))

if __name__ == "__main__":
    main()
