#!/usr/bin/env python3
"""مخزن الكتب المصورة على Cloudflare R2.

لكل كتاب مصور يُرفع إلى R2:
  books/<id>/book.pdf          الملف الأصلي (للتنزيل والحفظ الدائم)
  books/<id>/p0001.webp …      صورة خفيفة لكل صفحة (نحو 100 ك.ب) يعرضها القارئ بجوار النص
ثم يُكتب في data/catalog.json للكتاب: img="r2" و imgN (عدد الصفحات) و pdf="r2".
المخزن خاص (غير عام): القارئ يطلب روابط مؤقتة موقَّعة من /api/pages للأعضاء المسجلين فقط.

الاستعمال:
  python3 tools/r2-store.py            يرفع كل كتاب له نسخة في pdf/ ولم يُرفع بعد
  python3 tools/r2-store.py <id> ...   كتب بعينها (ولو رُفعت من قبل)
يعمل فقط إذا ضُبطت الأسرار: R2_ACCOUNT_ID و R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY و R2_BUCKET
وإلا يخرج بهدوء.
لا يحذف شيئًا من المستودع.
"""
import json, os, subprocess, sys, tempfile, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, "data", "catalog.json")
ENV = {k: os.environ.get(k, "").strip() for k in ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]}
WIDTH = int(os.environ.get("R2_IMG_WIDTH", "1100"))
QUALITY = int(os.environ.get("R2_IMG_QUALITY", "62"))


def client():
    import boto3
    from botocore.config import Config
    return boto3.client("s3", endpoint_url="https://%s.r2.cloudflarestorage.com" % ENV["R2_ACCOUNT_ID"],
                        aws_access_key_id=ENV["R2_ACCESS_KEY_ID"], aws_secret_access_key=ENV["R2_SECRET_ACCESS_KEY"],
                        region_name="auto", config=Config(retries={"max_attempts": 5, "mode": "standard"}))


def pages(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("Pages:"): return int(line.split()[1])
    return 0


def store(s3, bid, pdf):
    from PIL import Image
    n = pages(pdf)
    if not n: print("  تعذر قراءة", pdf); return None
    pre = "books/%s/" % bid
    s3.upload_file(pdf, ENV["R2_BUCKET"], pre + "book.pdf",
                   ExtraArgs={"ContentType": "application/pdf", "CacheControl": "public, max-age=31536000, immutable"})
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for a in range(1, n + 1, 20):  # دفعات حتى لا يمتلئ القرص في الكتب الكبيرة
            b = min(n, a + 19)
            subprocess.run(["pdftoppm", "-r", "130", "-f", str(a), "-l", str(b), "-png", pdf, os.path.join(tmp, "x")], check=True)
            for f in sorted(os.listdir(tmp)):
                if not f.endswith(".png"): continue
                k = int(f.rsplit("-", 1)[1][:-4]); src = os.path.join(tmp, f); dst = src[:-4] + ".webp"
                im = Image.open(src); im = im.convert("RGB")
                if im.width > WIDTH: im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
                im.save(dst, "WEBP", quality=QUALITY, method=6)
                total += os.path.getsize(dst)
                s3.upload_file(dst, ENV["R2_BUCKET"], pre + "p%04d.webp" % k,
                               ExtraArgs={"ContentType": "image/webp", "CacheControl": "public, max-age=31536000, immutable"})
                os.remove(src); os.remove(dst)
            print("  صفحات %d–%d من %d" % (a, b, n))
    print("  تم: %d صفحة، متوسط الصورة %d ك.ب" % (n, total / n / 1024))
    return n


def main():
    if not all(ENV.values()):
        print("مخزن R2 غير مضبوط بعد (الأسرار ناقصة) — تخطٍّ."); return
    cat = json.load(open(CAT, encoding="utf-8"))
    want = set(sys.argv[1:])
    todo = []
    for b in cat["books"]:
        local = os.path.join(ROOT, "pdf", b["id"] + ".pdf")
        if want and b["id"] not in want: continue
        if b.get("pdf", "").startswith("pdf/") and b["pdf"] != "pdf/%s.pdf" % b["id"]: continue  # مجلد يشارك ملف كتاب آخر
        if not want and (b.get("img") or not os.path.exists(local)): continue
        if os.path.exists(local): todo.append((b, local))
        elif want: print("لا توجد نسخة محلية للكتاب", b["id"])
    if not todo: print("لا جديد للرفع."); return
    s3 = client()
    for b, local in todo:
        print("==", b["id"], b.get("title", ""))
        n = store(s3, b["id"], local)
        if not n: continue
        b["img"] = "r2"
        b["imgN"] = n
        b["pdfLocal"] = "pdf/%s.pdf" % b["id"]  # تبقى إلى أن يُؤذن بإزالتها من المستودع
        b["pdf"] = "r2"
        # كتب المجموعة المتعددة المجلدات التي تشترك في الملف نفسه
        for x in cat["books"]:
            if x is not b and x.get("pdf") == "pdf/%s.pdf" % b["id"]:
                x.update({k: b[k] for k in ("img", "imgN", "pdfLocal", "pdf")})
    cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
    json.dump(cat, open(CAT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
