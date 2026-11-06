#!/usr/bin/env python3
"""«السراج في بيان غريب القرآن» (د. محمد بن عبد العزيز الخضيري، دار المنهاج ١٤٣٥هـ) للمصحف الرقمي:
الكتاب جدول في كل صفحة: رقم الآية | الكلمة | معناها، وترويسة السورة أعلى الصفحة. تُقرأ صفحاته من المصورة الخاصة (R2) بـ Gemini
قراءة جدولية (٣ صفحات في الطلب)، ويُتحقق من كل سطر: رقم الآية داخل السورة، والكلمة موجودة في نص الآية من المصحف (بلا تشكيل).
المخرج: data/quran/tafsir/siraj/<سورة>.json = {"آية": [[الكلمة، معناها]...]} و_meta.json (المصدر وما لم يُطابَق).
المتغيرات: SIRAJ_ID (معرّف الكتاب في الفهرس)، SIRAJ_FROM/SIRAJ_TO (نطاق الصفحات)، والعمل يُستأنف من data/quran/tafsir/siraj/_work.json."""
import json, os, re, sys, time, base64, subprocess, tempfile, glob, urllib.request, urllib.error, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.join(ROOT, "data", "quran"); OUT = os.path.join(Q, "tafsir", "siraj")
KEYS = [os.environ[k] for k in sorted(os.environ) if k.startswith("GEMINI_API_KEY") and os.environ[k]]
MODELS = [m for m in os.environ.get("SIRAJ_MODELS", "gemini-flash-latest,gemini-3.5-flash,gemini-flash-lite-latest").split(",") if m]
DEAD = set(); DEADLINE = time.time() + 60 * float(os.environ.get("SIRAJ_MINUTES", "200"))
PROMPT = ("هذه صفحات من كتاب «السراج في بيان غريب القرآن». كل صفحة جدول من ثلاثة أعمدة (من اليمين): رقم الآية، والكلمة القرآنية بين ﴿ ﴾، ومعناها؛ "
          "وفي أعلى الصفحة اسم السورة (في الصفحة الفردية غالبًا) أو اسم الكتاب. انقل الجدول كله بدقة حرفًا حرفًا، بالتشكيل كما في الصورة، "
          "وأخرج JSON فقط: {\"pages\": [{\"sura\": \"اسم السورة في الترويسة إن وُجد وإلا \\\"\\\"\", \"start\": \"اسم سورة تبدأ داخل الصفحة إن وُجد عنوانها\", "
          "\"rows\": [{\"a\": رقم الآية, \"w\": \"الكلمة بلا الأقواس\", \"m\": \"المعنى\", \"s\": \"اسم السورة إن بدأت سورة جديدة قبل هذا السطر وإلا \\\"\\\"\"}]}]} "
          "بترتيب الصفحات المعطاة. السطر الذي يكمل معنى السطر السابق يُضم إليه. لا تضف شيئًا من عندك، ولا تنقل المقدمات والفهارس.")
DIA = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
AR = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
def nz(s): s = DIA.sub("", s or ""); s = re.sub("[أإآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي"); return re.sub(r"[^ء-ي ]", " ", s).split()
def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def js(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
def gem(imgs):
    parts = [{"text": PROMPT}] + [{"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(open(i, "rb").read()).decode()}} for i in imgs]
    body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}).encode()
    for m in MODELS:
        for k in KEYS:
            if (m, k) in DEAD: continue
            try:
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % m, data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
                j = json.load(urllib.request.urlopen(req, timeout=300))
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"])
                return json.loads(t[t.find("{"): t.rfind("}") + 1])
            except urllib.error.HTTPError as e:
                if e.code in (429, 403, 404): DEAD.add((m, k))
            except Exception: pass
    return None
def main():
    names = {}
    for s in json.load(open(os.path.join(Q, "quran.json"), encoding="utf-8"))["suras"]:
        n = " ".join(nz(s["name"])).replace("سوره ", ""); names[n] = s["n"]; names[re.sub(r"^ال", "", n)] = s["n"]
    ayat = {s["n"]: s["ayat"] for s in json.load(open(os.path.join(Q, "quran.json"), encoding="utf-8"))["suras"]}
    sid = lambda x: names.get(" ".join(nz(x)).replace("سوره ", "")) or names.get(re.sub(r"^ال", "", " ".join(nz(x)).replace("سوره ", ""))) if x else None
    W = jl(os.path.join(OUT, "_work.json"), {"pages": {}})
    with tempfile.TemporaryDirectory() as tmp:
        bid = os.environ.get("SIRAJ_ID", "")
        if not bid and not os.environ.get("SIRAJ_PDF"):  # يُعرف الكتاب بعنوانه بعد رفعه من «الإدارة ← كتاب مصور»
            cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
            b = next((x for x in cat["books"] if "غريب القرآن" in (x.get("title") or "") and "السراج" in (x.get("title") or "") and x.get("pdf")), None)
            if not b: print("لم يُرفع كتاب السراج بعد"); return
            bid = b["id"]
            if jl(os.path.join(OUT, "_meta.json"), {}).get("done"): print("اكتمل استخراج السراج"); return
        if os.environ.get("SIRAJ_PDF"): pdf = os.environ["SIRAJ_PDF"]
        else:
            spm = importlib.util.spec_from_file_location("pm", os.path.join(ROOT, "tools", "pdf-match.py")); pm = importlib.util.module_from_spec(spm); spm.loader.exec_module(pm)
            pdf = pm.get_pdf(bid, tmp)
        n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout).group(1))
        a0, z0 = int(os.environ.get("SIRAJ_FROM", "1")), int(os.environ.get("SIRAJ_TO", str(n)))
        todo = [p for p in range(a0, z0 + 1) if str(p) not in W["pages"]]
        for k in range(0, len(todo), 3):
            if time.time() > DEADLINE or (KEYS and len(DEAD) >= len(KEYS) * len(MODELS)): break
            grp = todo[k:k + 3]; imgs = []
            for p in grp:
                base = os.path.join(tmp, "p%d" % p); subprocess.run(["pdftoppm", "-f", str(p), "-l", str(p), "-r", "130", "-jpeg", "-singlefile", pdf, base], check=True); imgs.append(base + ".jpg")
            r = gem(imgs)
            if not r: print("  تعذّر", grp, flush=True); continue
            for p, pg in zip(grp, (r.get("pages") or []) + [{}] * 3): W["pages"][str(p)] = pg
            js(os.path.join(OUT, "_work.json"), W); print("  ص", grp, sum(len((W["pages"][str(p)] or {}).get("rows") or []) for p in grp), "سطرًا", flush=True)
    # التجميع بالترتيب: تتبع السورة من الترويسات وعناوين البدء، والتحقق من الكلمة في نص الآية
    out, cur, miss, okn = {}, None, [], 0
    for p in sorted(W["pages"], key=int):
        pg = W["pages"][p] or {}
        if sid(pg.get("start") or ""): pass
        elif sid(pg.get("sura") or ""): cur = cur if cur and cur > sid(pg["sura"]) else sid(pg["sura"])
        for row in pg.get("rows") or []:
            if sid(row.get("s") or "") : cur = sid(row["s"])
            elif sid(pg.get("start") or "") and cur and sid(pg["start"]) > cur and int(str(row.get("a") or 0).translate(AR) or 0) == 1: cur = sid(pg["start"])
            try: a = int(str(row.get("a")).translate(AR))
            except Exception: continue
            w, m = str(row.get("w") or "").strip(" ﴿﴾()"), str(row.get("m") or "").strip()
            if not cur or not w or not m: continue
            s = cur
            # إن لم توجد الكلمة في الآية فلعل السورة تغيّرت: جرّب السورة التالية
            def has(s_, a_):
                sk = lambda t: re.sub("[اوي]", "", t)  # هيكل الحروف: الرسم العثماني يحذف الألف والواو والياء أحيانًا
                return s_ in ayat and 1 <= a_ <= len(ayat[s_]) and all(sk(x) in sk(" ".join(nz(ayat[s_][a_ - 1]))) for x in nz(w)[:2])
            if not has(s, a) and has(s + 1, a): s = cur = s + 1
            if not has(s, a): miss.append([p, s, a, w]); continue
            out.setdefault(s, {}).setdefault(str(a), []).append([w, m]); okn += 1
    for s, d in out.items(): js(os.path.join(OUT, "%d.json" % s), d)
    js(os.path.join(OUT, "_meta.json"), {"src": "السراج في بيان غريب القرآن، د. محمد بن عبد العزيز الخضيري، دار المنهاج، الرياض، ط١ ١٤٣٥هـ", "rows": okn, "suras": len(out), "miss": miss[:500], "pages": len(W["pages"]), "done": 1 if len(W["pages"]) >= n - 2 else 0})
    print("السور:", len(out), "الأسطر المطابقة:", okn, "غير المطابقة:", len(miss))
if __name__ == "__main__":
    main()
