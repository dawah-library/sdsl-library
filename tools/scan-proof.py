#!/usr/bin/env python3
"""تدقيق الكتب النصية على مصورة طبعتها (يعمل على خوادم GitHub).

بعد ربط الكتاب بمصورته (tools/edition-attach.py) ومطابقة صفحاته (tools/pdf-match.py)، الصفحات التي لا تشبه صورتها
تُعلَّم في unrev. هذه الأداة تقرأ كل صفحة منها مع صورتها (Gemini يرى الصورة والنص معًا) وتقترح التصحيحات القطعية:
سقط أو زيادة أو تصحيف عن المطبوع، وحاشية مختلطة بالمتن، وعنوان غير معلَّم. لا تُطبَّق التصحيحات آليًّا:
تُضاف إلى data/proof/<id>.json (بالصيغة نفسها لتدقيق النصوص) فتراجعها الإدارة وتعتمدها في #/proof.
وتُزال الصفحة من unrev بعد قراءتها (وتُسجَّل في scan: إن لم تختلف عن صورتها فلا اقتراح).

المتغيرات: SP_ONLY (كتب بعينها)، SP_PAGES (أقصى صفحات الجولة، ٦٠).
"""
import importlib.util, json, os, re, subprocess, sys, tempfile, time, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "proof")
sys.argv = sys.argv[:1]
os.environ.setdefault("OCR_KEY_ROLE", "study")  # التدقيق على المصورة من خدمات الكتب: يبدأ بالمفاتيح المحجوزة لها
sp = importlib.util.spec_from_file_location("ocr", os.path.join(ROOT, "tools", "ocr-pdf.py")); O = importlib.util.module_from_spec(sp); sp.loader.exec_module(O)
sp2 = importlib.util.spec_from_file_location("pm", os.path.join(ROOT, "tools", "pdf-match.py")); PM = importlib.util.module_from_spec(sp2); sp2.loader.exec_module(PM)
PROMPT = """أمامك صورة صفحة من الطبعة المطبوعة لكتاب «{title}»، ونص الصفحة نفسها في مكتبتنا (منقول من مصدر إلكتروني).
قارن النص بالصورة كلمة كلمة، واقترح التصحيحات القطعية فقط ليطابق النص المطبوع، وأخرج JSON وحده:
{{"same": true أو false, "fx": [{{"k": "نوع", "from": "العبارة في نصنا حرفيًّا (٢-٨ كلمات تميّزها)", "to": "صوابها كما في الصورة", "why": "سبب مختصر"}}]}}
الأنواع k: «سقط» (كلمة أو سطر في الصورة ساقط من النص: from = ما قبله مباشرة، to = هو مع الساقط)، «زيادة»، «تصحيف» (كلمة تخالف المطبوع)،
«حاشية» (حاشية مختلطة بالمتن: to = "______\\n" + أولها)، «عنوان» (عنوان في الصورة غير معلَّم: to = "# " + السطر).
لا تغيّر التشكيل وحده، ولا علامات الترقيم، ولا ما لا يظهر في الصورة بوضوح. إن كانت الصفحة في الصورة غير الصفحة في النص فأخرج {{"same": false, "fx": []}}.

نص الصفحة في مكتبتنا:
{text}"""
H = lambda t: hashlib.md5((t or "").encode("utf-8")).hexdigest()[:10]
jl = lambda p, d: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
def js(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def main():
    cat = jl(os.path.join(D, "catalog.json"), {"books": []}); only = [x for x in os.environ.get("SP_ONLY", "").split(",") if x]
    budget = int(os.environ.get("SP_PAGES", "60")); lst = jl(os.path.join(OUT, "_list.json"), {}); changed = False
    for b in cat["books"]:
        if budget <= 0: break
        if b.get("ocr") or b.get("img") != "r2" or not b.get("unrev") or (only and b["id"] not in only): continue
        shp = os.path.join(D, "books", b["id"] + ".json")
        if not os.path.exists(shp): shp = os.path.join(ROOT, "vols", b["id"] + ".json")
        sh = jl(shp, None)
        if not sh: continue
        todo = [i for i in (sh.get("unrev") or []) if 0 <= i < len(sh["pages"])][:budget]
        if not todo: continue
        print("==", b.get("title"), len(todo), "صفحة", flush=True)
        tmp = tempfile.mkdtemp(); pdf = PM.get_pdf(b["id"], tmp); off = int(b.get("pdfOffset") or 0); pm = sh.get("pmap")
        outp = os.path.join(OUT, b["id"] + ".json"); R = jl(outp, {"id": b["id"], "pages": {}}); done = []
        for i in todo:
            k = pm[i] if pm and i < len(pm) else i + 1 + off
            img = os.path.join(tmp, "p%d" % k)
            subprocess.run(["pdftoppm", "-r", "150", "-f", str(k), "-l", str(k), "-jpeg", "-singlefile", pdf, img], check=False)
            if not os.path.exists(img + ".jpg"): continue
            t = O.gemini_call([O.img_part(img + ".jpg"), {"text": PROMPT.format(title=b.get("setTitle") or b["title"], text=sh["pages"][i][:6000])}], max_tokens=4096)
            if t is None: break  # نفدت الحصة: يُستأنف في الجولة القادمة
            m = re.search(r"\{[\s\S]*\}", t); r = {}
            try: r = json.loads(m.group(0)) if m else {}
            except Exception: pass
            page = sh["pages"][i]; ok = []
            for f in (r.get("fx") or []):
                a, z = str(f.get("from") or ""), str(f.get("to") or "")
                if a and a != z and page.count(a) == 1 and len(a) <= 300: ok.append({"k": str(f.get("k") or ""), "from": a, "to": z, "why": "على المصورة: " + str(f.get("why") or "")[:140]})
            prev = R["pages"].get(str(i + 1)) or {}
            R["pages"][str(i + 1)] = {"h": H(page), "fx": (prev.get("fx") or []) + ok, "scan": 1 if r.get("same", True) else 0, "at": time.strftime("%Y-%m-%d")}
            done.append(i); budget -= 1
        if done:
            sh["unrev"] = [i for i in sh.get("unrev") or [] if i not in done]
            if not sh["unrev"]: sh.pop("unrev")
            js(shp, sh); js(outp, R); b["unrev"] = len(sh.get("unrev") or [])
            if not b["unrev"]: b.pop("unrev")
            n = sum(len(v.get("fx") or []) for v in R["pages"].values())
            lst[b["id"]] = {"t": b.get("setTitle") or b["title"], "n": n, "done": len(R["pages"]), "of": len(sh["pages"]), "upd": time.strftime("%Y-%m-%d"), "scan": 1}
            js(os.path.join(OUT, "_list.json"), lst); changed = True
            print("  قُرئت %d صفحة على صورها، والاقتراحات حتى الآن %d" % (len(done), n), flush=True)
    if changed: json.dump(cat, open(os.path.join(D, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
