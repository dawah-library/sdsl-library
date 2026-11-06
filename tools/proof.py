#!/usr/bin/env python3
"""تدقيق الكتب النصية (البندان ٤٠ و٤١): كتب مكتبة الدعوة الإلكترونية (غير المصورة) تلقائيًا، وكتب المكتبة العامة بطلب الإدارة
(data/proof/_queue.json). يقرأ Gemini الصفحات (٤ في الطلب) ويقترح تصحيحات قطعية فقط: أخطاء الطباعة والإملاء والتصحيف،
وفصل الحواشي عن المتن، وتعليم العناوين؛ دون تغيير الأسلوب ولا الألفاظ الصحيحة. كل اقتراح {p, from, to, why, k} يُقبل
إن وُجد «from» في الصفحة مرة واحدة. الناتج data/proof/<id>.json، ولا يُطبَّق شيء إلا باعتماد الإدارة أو المفوَّض (#/proof).
المتغيرات: PROOF_PAGES (أقصى صفحات الجولة، ٤٠٠)، PROOF_ONLY."""
import json, os, re, sys, time, hashlib, importlib.util
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); OUT = os.path.join(D, "proof")
sp = importlib.util.spec_from_file_location("tj", os.path.join(ROOT, "tools", "tashjir.py")); tj = importlib.util.module_from_spec(sp); sp.loader.exec_module(tj)
PROMPT = """أنت مدقق لغوي ومصحح طباعي متقن لكتب العلم الشرعي. أمامك صفحات من كتاب «{title}» مفصولة بعلامات [ص N].
اقترح التصحيحات القطعية فقط، وأخرج JSON: {{"fx": [{{"p": رقم الصفحة, "k": "نوع", "from": "العبارة الخاطئة كما هي في النص حرفيًا (٢-٨ كلمات تميّزها)", "to": "صوابها", "why": "سبب مختصر"}}]}}
الأنواع k: «طباعة» (حرف ساقط أو زائد أو مقلوب، كلمتان ملتصقتان أو كلمة مفصولة)، «إملاء» (همزة أو تاء أو ألف قطعية الخطأ)، «آية» (خطأ في لفظ آية قرآنية عن المصحف)، «عنوان» (سطر هو عنوان فصل أو مسألة وليس عليه علامة #: اجعل to = "# " + السطر)، «حاشية» (حاشية سفلية مختلطة بالمتن: from = أول الحاشية، to = "______\\n" + أول الحاشية).
القواعد: لا تغيّر أسلوب المؤلف ولا ألفاظًا صحيحة لها وجه، ولا علامات الترقيم إلا لخطأ ظاهر، ولا تصحح أقوال العلماء المنقولة بلفظها إلا خطأً طباعيًا ظاهرًا، ولا تقترح ما تشك فيه. إن لم تجد شيئًا فأخرج {{"fx": []}}.

{text}"""
def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def js(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
H = lambda t: hashlib.md5((t or "").encode("utf-8")).hexdigest()[:10]
def main():
    cat = jl(os.path.join(D, "catalog.json"), {"books": []}); q = jl(os.path.join(OUT, "_queue.json"), {"items": []})
    req = [x["id"] if isinstance(x, dict) else x for x in q.get("items", [])]
    only = [x for x in os.environ.get("PROOF_ONLY", "").split(",") if x]
    auto = [b["id"] for b in cat["books"] if (b.get("col") or "dawah") == "dawah" and not b.get("ocr") and not b.get("demo") and (b.get("type") or "book") == "book" and os.path.exists(os.path.join(D, "books", b["id"] + ".json"))]
    todo = only or (req + [x for x in auto if x not in req])
    budget = int(os.environ.get("PROOF_PAGES", "120")); deadline = time.time() + 60 * float(os.environ.get("PROOF_MINUTES", "100")); lst = jl(os.path.join(OUT, "_list.json"), {})
    for bid in todo:
        if budget <= 0 or time.time() > deadline or (tj.KEYS and len(tj.EXH) >= len(tj.KEYS)): break
        b = next((x for x in cat["books"] if x["id"] == bid), None); pth = os.path.join(D, "books", bid + ".json")
        if not b or not os.path.exists(pth): continue
        pages = jl(pth, {}).get("pages") or []; outp = os.path.join(OUT, bid + ".json"); R = jl(outp, {"id": bid, "pages": {}})
        todo_p = [i for i, t in enumerate(pages) if isinstance(t, str) and len(t) > 120 and (R["pages"].get(str(i + 1)) or {}).get("h") != H(t)]
        if not todo_p: continue
        print("تدقيق:", b.get("title"), len(todo_p), "صفحة", flush=True)
        for k in range(0, len(todo_p), 4):
            if budget <= 0 or time.time() > deadline: break
            grp = todo_p[k:k + 4]; text = "\n".join("[ص %d]\n%s" % (i + 1, pages[i][:5000]) for i in grp)
            r = tj.gemini(PROMPT.format(title=b.get("setTitle") or b["title"], text=text))
            if r is None: break
            fx = [f for f in (r.get("fx") or []) if isinstance(f, dict)]
            for i in grp:
                page = pages[i]; ok = []
                for f in fx:
                    if int(f.get("p") or 0) != i + 1: continue
                    a, z = str(f.get("from") or ""), str(f.get("to") or "")
                    if not a or a == z or page.count(a) != 1 or len(a) > 300: continue
                    ok.append({"k": str(f.get("k") or ""), "from": a, "to": z, "why": str(f.get("why") or "")[:160]})
                R["pages"][str(i + 1)] = {"h": H(page), "fx": ok}
            budget -= len(grp); js(outp, R)
        n = sum(len(v.get("fx") or []) for v in R["pages"].values()); lst[bid] = {"t": b.get("setTitle") or b["title"], "n": n, "done": len(R["pages"]), "of": len(pages), "upd": time.strftime("%Y-%m-%d")}
        js(os.path.join(OUT, "_list.json"), lst)
        if bid in req and len(R["pages"]) >= len([t for t in pages if isinstance(t, str) and len(t) > 120]):
            q["items"] = [x for x in q["items"] if (x["id"] if isinstance(x, dict) else x) != bid]; js(os.path.join(OUT, "_queue.json"), q)
    print("انتهت الجولة")
if __name__ == "__main__":
    main()
