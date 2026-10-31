#!/usr/bin/env python3
"""كشف النقص في الكتب المحوّلة: يقارن عدد كلمات نص كل صفحة بعدد الكلمات التي يقرؤها Tesseract من صورتها.
إذا قلّ النص كثيرًا عن الصورة (سقط سطر أو فقرة أو حاشية) عُلِّمت الصفحة «(نقص محتمل)» في مواضع الشك ليقدّمها التدقيق.
وإذا زاد كثيرًا (تكرار أو حواشٍ مختلقة) عُلِّمت «(زيادة محتملة)».

الاستعمال (في GitHub Actions): python3 tools/ocr-audit.py [معرفات...]  (بلا معرفات: كتب الدعوة المحوّلة)
"""
import json, os, re, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
AR = re.compile(r"[ء-ي]{2,}")
DI = re.compile(r"[ً-ْٰـ]")


def words(t):
    return len(AR.findall(DI.sub("", t or "")))


def tess_words(pdf, p, td):
    base = os.path.join(td, "a%d" % p)
    subprocess.run(["pdftoppm", "-r", "150", "-gray", "-f", str(p), "-l", str(p), "-singlefile", "-png", pdf, base], check=True)
    r = subprocess.run(["tesseract", base + ".png", "-", "-l", "ara", "--psm", "3"], capture_output=True, text=True, timeout=180)
    os.remove(base + ".png")
    return words(r.stdout)


def main():
    import importlib.util
    spec = importlib.util.spec_from_file_location("o", os.path.join(ROOT, "tools", "ocr-pdf.py"))
    o = importlib.util.module_from_spec(spec); sys.argv = sys.argv[:1] + sys.argv[1:]; spec.loader.exec_module(o)
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    ids = sys.argv[1:] or [b["id"] for b in cat["books"] if b.get("ocr") and (b.get("col", "dawah") == "dawah" or b.get("upl"))]
    os.makedirs(os.path.join(ROOT, "data", "audit"), exist_ok=True)
    rep = []
    for bid in ids:
        b = next((x for x in cat["books"] if x["id"] == bid), None)
        path = os.path.join(ROOT, "data", "books", bid + ".json")
        if not b or not os.path.exists(path):
            continue
        pdf = o.local_pdf(bid)
        if not pdf:
            continue
        sh = json.load(open(path, encoding="utf-8"))
        off = int(b.get("pdfOffset") or 0)
        n = len(sh["pages"])
        with tempfile.TemporaryDirectory() as td, ThreadPoolExecutor(os.cpu_count() or 2) as ex:
            tw = list(ex.map(lambda i: tess_words(pdf, i + 1 + off, td), range(n)))
        allr = [[i + 1, words(sh["pages"][i]), tw[i]] for i in range(n)]
        res, unc = [], {k: [w for w in v if w not in ("(نقص محتمل)", "(زيادة محتملة)")] for k, v in (sh.get("unc") or {}).items()}
        for i in range(n):
            gw, t = words(sh["pages"][i]), tw[i]
            if t < 40:
                continue
            r = gw / t
            kind = "short" if r < 0.72 else ("long" if r > 1.45 and gw - t > 60 else "")
            if kind:
                res.append({"p": i + 1, "text": gw, "img": t, "r": round(r, 2), "k": kind})
                lab = "(نقص محتمل)" if kind == "short" else "(زيادة محتملة)"
                unc[str(i)] = (unc.get(str(i), []) + [lab])[:40]
        unc = {k: v for k, v in unc.items() if v}
        if unc: sh["unc"] = unc
        else: sh.pop("unc", None)
        s = json.dumps(sh, ensure_ascii=False, separators=(",", ":")); open(path, "w", encoding="utf-8").write(s)
        b["unc"] = sum(len(v) for v in unc.values()); b["size"] = len(s.encode())
        json.dump({"pages": n, "flag": res, "all": allr}, open(os.path.join(ROOT, "data", "audit", bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        rep.append("- %s: %d صفحة، يُشتبه في نقص %d وزيادة %d" % (b.get("title"), n, sum(1 for x in res if x["k"] == "short"), sum(1 for x in res if x["k"] == "long")))
        print(rep[-1], flush=True)
    json.dump(cat, open(os.path.join(ROOT, "data", "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".audit-report.txt"), "w", encoding="utf-8").write("🔍 <b>كشف النقص في الكتب المحوّلة</b>\n" + "\n".join(rep))


if __name__ == "__main__":
    main()
