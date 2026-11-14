#!/usr/bin/env python3
"""التحقق من مرشحات موسوعة آثار السلف (tools/athar/cand.json) بنموذج مجاني (Groq)، ثم النشر.

لكل مرشح يحكم النموذج: أهو قول لعلم من السلف بنفسه (وصية، حكمة، موعظة، تقرير عقدي، أدب، عبادة…) لا حديث مرفوع ولا قصة
ولا حكم فقهي جزئي ولا إسناد؛ ومن قائله الحقيقي من قائمة الأعلام؛ وأول القول وآخره بألفاظ النص؛ وبابه؛ وعنوانًا موضوعيًا قصيرًا.
ثم يُقتطع القول من نص المصدر نفسه بين أوله وآخره (فلا يُنشر إلا نص موجود بلفظه)، وإلا رُفض.
المتغيرات: GROQ_API_KEY، GROQ_MODELS، ATHAR_MAX (حد المرشحات في الجولة)، ATHAR_MINUTES.
"""
import json, os, re, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("athar", os.path.join(os.path.dirname(os.path.abspath(__file__)), "athar.py"))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)

CD = A.CAND_DIR
KEY = os.environ.get("GROQ_API_KEY", "").strip()
MODELS = [m.strip() for m in os.environ.get("GROQ_MODELS", "openai/gpt-oss-120b,qwen/qwen3-32b,llama-3.3-70b-versatile").split(",") if m.strip()]
DEAD = set()
T0, LIMIT = time.time(), int(os.environ.get("ATHAR_MINUTES", "150")) * 60
BATCH = 8
TOPIC_KEYS = [k for k, _, _ in A.TOPICS] + [A.GENERAL[0]]
TOPIC_TXT = "، ".join("%s=%s" % (k, n) for k, n, _ in A.TOPICS) + "، %s=%s" % A.GENERAL

PROMPT = """أنت محقق في آثار السلف. لكل نص أدناه (مقطع من كتاب مسند أو تراجم أو رقائق) حدّد هل فيه قول لعلم من أعلام السلف بنفسه يصلح لموسوعة «وصايا السلف وحكمهم»:
يُقبل: وصية، نصيحة، حكمة، موعظة، تقرير في العقيدة أو السنة والاتباع أو العلم أو العبادة أو التزكية أو الأخلاق أو الهمة أو الترغيب والترهيب.
يُرفض: الحديث المرفوع إلى النبي ﷺ، والقصة والخبر التاريخي، والمسألة الفقهية الجزئية (ميراث، بيوع، نجاسات…)، وكلام الجرح والتعديل والرواة، وكلام المصنف أو المحقق، والنص المبتور.
القائل يجب أن يكون صاحب القول نفسه (لا الراوي عنه)، ومن هذه القائمة بالاسم كما هو: {people}
أخرج JSON حرفيًا: {{"r": [{{"i": رقم النص, "ok": true/false, "w": "القائل من القائمة", "a": "أول القول: ٣–٦ كلمات منسوخة حرفيًا من النص", "z": "آخر القول: ٣–٦ كلمات منسوخة حرفيًا من النص", "k": ["مفتاح الباب", "مفتاح ثانٍ اختياري"], "t": "عنوان موضوعي قصير ٢–٦ كلمات"}}]}}
مفاتيح الأبواب: {topics}
انسخ أول القول وآخره كما في النص تمامًا بحروفه، ولا تُدخل في القول «قال فلان» ولا الإسناد.

النصوص:
{texts}"""


def call(prompt):
    for m in MODELS:
        if m in DEAD: continue
        body = json.dumps({"model": m, "messages": [{"role": "user", "content": prompt}], "temperature": 0, "max_tokens": 4000, "response_format": {"type": "json_object"}}).encode()
        for attempt in range(3):
            try:
                req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=body, headers={"content-type": "application/json", "authorization": "Bearer " + KEY})
                j = json.load(urllib.request.urlopen(req, timeout=120))
                t = j["choices"][0]["message"]["content"]
                t = re.sub(r"<think>[\s\S]*?</think>", "", t).strip()
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore")
                print("  Groq", m, e.code, msg[:120], flush=True)
                if e.code in (401, 403, 404) or (e.code == 429 and re.search(r"per day|TPD|RPD|daily", msg, re.I)): DEAD.add(m); break
                if e.code == 413: return None
                time.sleep(20 * (attempt + 1))
            except Exception as e:
                print("  خطأ", m, str(e)[:120], flush=True); time.sleep(5)
    return None


def nzs(s):
    return re.sub(r"\s+", " ", re.sub(r"[ً-ْٰـ]", "", s or "")).strip()


def cut(u, a, z):
    """يقتطع القول من النص بين أوله وآخره بلفظه (مع تجاهل التشكيل والمسافات في المطابقة)."""
    if not a or not z: return None
    # فهرس من النص المطبَّع إلى الأصل
    orig, idx, out = u, [], []
    for i, ch in enumerate(orig):
        if re.match(r"[ً-ْٰـ]", ch): continue
        if ch.isspace():
            if out and out[-1] == " ": continue
            ch = " "
        out.append(ch); idx.append(i)
    norm = "".join(out)
    a, z = nzs(a).strip(" «»\"،,.:"), nzs(z).strip(" «»\"،,.:")
    i = norm.find(a)
    if i < 0: return None
    j = norm.find(z, i)
    if j < 0: return None
    j += len(z)
    q = orig[idx[i]: idx[min(j, len(idx)) - 1] + 1].strip(" «»\"،,")
    return q if 20 <= len(q) <= 1200 else None


def main():
    if not KEY: print("لا مفتاح Groq"); A.publish(); return
    cand = json.load(open(os.path.join(CD, "cand.json"), encoding="utf-8"))["items"]
    vp = os.path.join(CD, "verified.json")
    V = json.load(open(vp, encoding="utf-8")) if os.path.exists(vp) else {"items": {}}
    people = sorted({x["w"] for x in cand} | {p[0] for p in json.load(open(os.path.join(A.ROOT, "tools", "athar-people.json"), encoding="utf-8"))["people"]})
    todo = [c for c in cand if c["id"] not in V["items"]][:int(os.environ.get("ATHAR_MAX", "2000"))]
    print("للفحص: %d من %d" % (len(todo), len(cand)), flush=True)
    done = ok = 0
    for b in range(0, len(todo), BATCH):
        if time.time() - T0 > LIMIT or len(DEAD) == len(MODELS): break
        part = todo[b:b + BATCH]
        texts = "\n\n".join("[%d] (القائل المرشح: %s)\n%s" % (i + 1, c["w"], c["u"][-1100:]) for i, c in enumerate(part))
        r = call(PROMPT.format(people="، ".join(people), topics=TOPIC_TXT, texts=texts))
        if not r or not isinstance(r.get("r"), list): continue
        res = {int(x.get("i", 0)): x for x in r["r"] if isinstance(x, dict)}
        for i, c in enumerate(part):
            x = res.get(i + 1)
            if x is None: continue
            rec = {"id": c["id"], "ok": False}
            if x.get("ok") and x.get("w") in people:
                q = cut(c["u"], x.get("a"), x.get("z"))
                if q:
                    ks = [k for k in (x.get("k") or []) if k in TOPIC_KEYS][:2] or c["k"]
                    rec = {"id": c["id"], "ok": True, "q": q, "w": x["w"], "t": str(x.get("t") or "").strip()[:60], "k": ks, "r": c["r"], "x": c["x"]}
                    ok += 1
            V["items"][c["id"]] = rec; done += 1
        if (b // BATCH) % 10 == 0:
            json.dump(V, open(vp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
            print("  فُحص %d، قُبل %d" % (done, ok), flush=True)
    json.dump(V, open(vp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("الجولة: فُحص %d، قُبل %d" % (done, ok))
    A.publish()


if __name__ == "__main__":
    main()
