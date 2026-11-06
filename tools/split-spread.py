#!/usr/bin/env python3
"""تقسيم الكتاب المصور «وجهين في الصورة» (صفحتان مطبوعتان في صفحة PDF واحدة) إلى صفحاته الأصلية:
كل صفحة عريضة (العرض > ١٫١٥ × الطول) تُقسم نصفين من المنتصف، والنصف الأيمن أولًا (ترتيب الكتاب العربي)، والصفحة غير العريضة تبقى كما هي.
الناتج pdf/<id>.pdf محليًا في المهمة (لا يُودع في المستودع)، ثم يرفعه r2-store.py إلى المخزن الخاص بدل الأصل، وتُطلب إعادة تحويله.
الاستعمال: python3 tools/split-spread.py <id>"""
import os, sys, subprocess, tempfile, importlib.util, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def main(bid):
    sp = importlib.util.spec_from_file_location("pm", os.path.join(ROOT, "tools", "pdf-match.py")); pm = importlib.util.module_from_spec(sp); sp.loader.exec_module(pm)
    with tempfile.TemporaryDirectory() as tmp:
        src = pm.get_pdf(bid, tmp)
        subprocess.run(["pdftoppm", "-r", "200", "-jpeg", "-jpegopt", "quality=88", src, os.path.join(tmp, "p")], check=True)
        out, n_split = [], 0
        for f in sorted(glob.glob(os.path.join(tmp, "p-*.jpg"))):
            im = Image.open(f).convert("RGB"); w, h = im.size
            if w > h * 1.15:
                mid = w // 2; out += [im.crop((mid, 0, w, h)), im.crop((0, 0, mid, h))]; n_split += 1  # الأيمن ثم الأيسر
            else: out.append(im)
        os.makedirs(os.path.join(ROOT, "pdf"), exist_ok=True); dest = os.path.join(ROOT, "pdf", bid + ".pdf")
        out[0].save(dest, save_all=True, append_images=out[1:], resolution=200)
        print("قُسّمت %d صفحة عريضة؛ الصفحات الآن %d" % (n_split, len(out)))
if __name__ == "__main__":
    main(sys.argv[1])
