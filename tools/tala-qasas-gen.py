#!/usr/bin/env python3
"""صياغة قصص القدوات للطلائع من كتب المكتبة: «صور من حياة الصحابة» و«صور من حياة الصحابيات» لعبد الرحمن رأفت الباشا،
وسلاسل الشيخ مصطفى دياب القصصية («الأمين» في سيرة أبي عبيدة، و«أعلام في زمن الصبا»).

لكل شخصية: يُقرأ فصلها من الكتاب (يُكتشف أول الفصل باسم الشخصية ثم سطر مقتبس) ويُصاغ بالذكاء الاصطناعي
بنفس بنية data/tala-qasas.json (قصة لكل مرحلة، أحداث، أدلة «من أنا؟»، أسئلة، فوائد، نشاط، نقاش)، معتمدًا على النص وحده.
تُحفظ في data/tala-qasas-gen.json غير معتمدة (rev=0)، ولا تظهر للأطفال حتى يعتمدها المدير من صفحة القصص (data/tala-qasas-ok.json).
TQ_MAX: أقصى عدد شخصيات في التشغيل (الافتراضي ١٢)، TQ_ONLY: معرّفات بعينها، TQ_LIST=1 يطبع الفصول المكتشفة فقط.
"""
import json, os, re, sys, time, datetime, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tashjir as T  # noqa: E402  (gemini ومفاتيح خدمات الكتب)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "tala-qasas-gen.json")
BASE = os.path.join(ROOT, "data", "tala-qasas.json")
BASHA = [("tio30089-v01", "sah", "صور من حياة الصحابة", 1), ("tio30089-v02", "sah", "صور من حياة الصحابة", 2), ("tio14542-v01", "sahb", "صور من حياة الصحابيات", 1)]
DIAB = [("w5-amin", "sah", "أبو عبيدة بن الجراح", "سلسلة «الأمين»", r"^الأمين ?\(\d+\)"), ("w5-alam-ali", "sah", "علي بن أبي طالب", "سلسلة «أعلام في زمن الصبا»", r"^أعلام في زمن الصبا")]
# فصول لشخصيات لها قصة أساسية في data/tala-qasas.json (تُربط بها من الواجهة ولا تُصاغ مرة أخرى)
BASE_CH = {("tio30089-v01", 8), ("tio30089-v01", 168), ("tio30089-v01", 298), ("tio30089-v01", 530), ("tio14542-v01", 30), ("tio14542-v01", 42), ("tio14542-v01", 87), ("tio14542-v01", 100)}
HAR = re.compile(r"[ً-ْٰ]")


def jl(p, d):
    try:
        return json.load(open(p))
    except Exception:
        return d


def plain(s):
    return HAR.sub("", s or "")


def key(name):
    """مفتاح للمقارنة بين الأسماء (بلا تشكيل ولا ال ولا ألقاب)."""
    s = plain(name)
    s = re.sub(r"[^ء-ي ]", " ", s)
    s = re.sub(r"\b(ال)?(أنصاري|الأنصاري|التيمي|الدوسي|صاحب|رضي|الله|عنه|عنها)\b", " ", s)
    return " ".join(w[2:] if w.startswith("ال") and len(w) > 4 else w for w in s.split())[:40]


def chapters(P):
    out = []
    for i, p in enumerate(P):
        L = [x.strip().lstrip("#").strip() for x in p.split("\n") if x.strip()]
        L = [x for x in L if not re.match(r"^(الكتاب|المجلد) ", plain(x))]
        if len(L) < 3:
            continue
        nm = L[0]
        if len(nm) > 45 or re.search(r"[.:،؟!\"«»()]", nm):
            continue
        if any(re.match(r'^["«\[]', L[k]) for k in (1, 2)):
            if out and key(out[-1][1]) == key(plain(nm)):
                continue  # تكرار عنوان الفصل في صفحته الثانية
            out.append((i + 1, plain(nm)))
    return out


def sources():
    S = []
    for bid, cat, title, vol in BASHA:
        P = jl(os.path.join(ROOT, "vols", bid + ".json"), {}).get("pages") or []
        ch = chapters(P)
        if bid == "tio14542-v01" and P and "حليمة" in plain(P[1] if len(P) > 1 else ""):
            ch = [(2, "حليمة السعدية")] + ch
        for k, (p, nm) in enumerate(ch):
            end = ch[k + 1][0] - 1 if k + 1 < len(ch) else len(P)
            if nm.startswith("آل ") or end - p > 30:
                end = min(end, p + 30)
            S.append({"id": "b-" + bid[-6:] + "-" + str(p), "c": cat, "n": nm, "b": bid, "p": p, "to": end,
                      "from": "%s (ج %d) لعبد الرحمن رأفت الباشا، ص %d–%d" % (title, vol, p, end),
                      "text": "\n".join(re.sub(r"\(\^\S+\)", "", x) for x in P[p - 1:end])})
    ix = jl(os.path.join(ROOT, "data", "articles", "index.json"), {}).get("items") or []
    for sid, cat, nm, series, rx in DIAB:
        arts = sorted([x for x in ix if x.get("a") == "w5" and re.search(rx, x.get("t", ""))], key=lambda x: int(re.sub(r"\D", "", x["id"]) or 0))
        txt, first = [], None
        for a in arts:
            d = jl(os.path.join(ROOT, "data", "articles", a.get("f", "undated") + ".json"), {}).get(a["id"]) or {}
            if d.get("pages"):
                first = first or a["id"]; txt.append("## " + a["t"] + "\n" + "\n".join(d["pages"]))
        if txt:
            S.append({"id": sid, "c": cat, "n": nm, "b": first, "p": 1, "from": "%s للشيخ مصطفى دياب (%d مقالات)" % (series, len(txt)), "text": "\n\n".join(txt)})
    return S


PROMPT = """أنت كاتب قصص إسلامية للأطفال والناشئة على منهج أهل السنة والجماعة (السلفية)، بلغة عربية فصيحة سليمة.
أمامك فصل عن «{name}» من {src}.
المطلوب: إعادة صياغة سيرته قصةً لثلاث مراحل عمرية، وأنشطة تفاعلية، معتمدًا على هذا النص وحده.

قواعد صارمة:
- لا تضف معلومة ليست في النص. وإن أمكن، اختر من النص ما ثبت في القرآن والسنة الصحيحة، واترك المبالغات والروايات الغريبة.
- الآيات بين ﴿﴾ بنصها، والأحاديث بين «» مع ذكر مخرّجها إن ذكره النص. ولا تصف شكل النبي ﷺ أو الصحابة وصفًا تخيليًّا.
- t1 (٥–٨ سنوات): ٣–٥ جمل قصيرة مرحة مع رموز تعبيرية مناسبة، ومشهد واحد محبب.
- t2 (٩–١٢): فقرتان أو ثلاث، فيها أهم مواقفه.
- t3 (١٢–١٨): ٣–٤ فقرات أعمق، فيها الدروس والمنهج وأثره.
- الأسئلة: لكل مرحلة ٢ (t1، t2) و٣ (t3)، كل سؤال مصفوفة: [السؤال، الإجابة الصحيحة، خطأ١، خطأ٢]، والإجابات قصيرة.
- ev: أربعة أحداث بترتيب وقوعها. cl: ثلاثة أدلة بصيغة المتكلم «أنا…» من الأعم إلى الأخص، لا تذكر الاسم.
- fa: ثلاث فوائد. act: نشاط عملي لكل مرحلة. nq: سؤال نقاش للناشئة. lq: لقبه أو وصفه القصير. ic: رمز تعبيري واحد.
- n: اسمه المشهور مع «رضي الله عنه/عنها» إن كان صحابيًّا.
- إن لم يكن الفصل عن شخص واحد معروف (مثل مقدمة أو أسرة)، فأعد {{"skip": "السبب"}}.

أعد JSON فقط بهذه البنية:
{{"n": "", "ic": "", "lq": "", "s": {{"t1": "", "t2": "", "t3": ""}}, "ev": ["", "", "", ""], "cl": ["", "", ""],
 "q": {{"t1": [["", "", "", ""]], "t2": [], "t3": []}}, "fa": ["", "", ""], "act": {{"t1": "", "t2": "", "t3": ""}}, "nq": ""}}

النص:
{text}"""


def valid(r):
    try:
        assert r.get("n") and all(r["s"].get(t) for t in ("t1", "t2", "t3"))
        assert len(r["ev"]) >= 3 and len(r["cl"]) >= 3
        for t in ("t1", "t2", "t3"):
            assert r["q"][t] and all(isinstance(q, list) and len(q) == 4 and all(isinstance(x, str) and x for x in q) for q in r["q"][t])
            assert r["act"].get(t)
        return True
    except Exception:
        return False


def commit(msg):
    if os.environ.get("TQ_COMMIT") != "1":
        return
    subprocess.run(["bash", "tools/git-save.sh", msg, "data/tala-qasas-gen.json"], cwd=ROOT)


def main():
    S = sources()
    if os.environ.get("TQ_LIST"):
        for s in S:
            print(s["id"], s["n"], "|", s["from"], len(s["text"]))
        return
    out = jl(OUT, {"note": "", "items": []})
    out["note"] = "قصص قدوات مصوغة للطلائع من كتب الباشا وسلاسل الشيخ مصطفى دياب (tools/tala-qasas-gen.py)؛ لا تظهر حتى يعتمدها المدير (data/tala-qasas-ok.json)."
    have = {x["id"] for x in out["items"]} | {x["id"] for x in out.get("skip", [])}
    base = {key(x["n"]) for x in jl(BASE, {}).get("items", [])}
    only = [x for x in os.environ.get("TQ_ONLY", "").split(",") if x]
    T.DEADLINE[0] = time.time() + 60 * float(os.environ.get("TQ_MINUTES", "90"))
    todo = [s for s in S if s["id"] in only] if only else [s for s in S if s["id"] not in have and (s["b"], s["p"]) not in BASE_CH and key(s["n"]) not in base]
    n = 0
    for s in todo[: int(os.environ.get("TQ_MAX", "12"))]:
        if time.time() > T.DEADLINE[0] or (T.KEYS and len(T.EXH) >= len(T.KEYS)):
            break
        print("قصة:", s["n"], "—", s["from"], flush=True)
        r = T.gemini(PROMPT.format(name=s["n"], src=s["from"], text=s["text"][:60000]))
        if isinstance(r, list) and r:
            r = r[0]
        if not isinstance(r, dict):
            print("  لا رد", flush=True); continue
        if r.get("skip"):
            out.setdefault("skip", []).append({"id": s["id"], "n": s["n"], "why": str(r["skip"])[:200]}); print("  تُرك:", r["skip"], flush=True); continue
        if not valid(r):
            print("  رد ناقص؛ يُعاد في تشغيل لاحق", flush=True); continue
        it = {"id": s["id"], "c": s["c"], "n": r["n"], "ic": r.get("ic") or "⭐", "lq": r.get("lq", ""), "s": r["s"], "ev": r["ev"][:4], "cl": r["cl"][:3],
              "q": {t: r["q"][t][:3] for t in ("t1", "t2", "t3")}, "fa": (r.get("fa") or [])[:3], "act": r["act"], "nq": r.get("nq", ""),
              "src": s["from"], "b": s["b"], "p": s["p"], "dup": key(r["n"]) in base or key(s["n"]) in base, "rev": 0, "at": str(datetime.date.today()), "model": T.MODEL}
        out["items"] = [x for x in out["items"] if x["id"] != s["id"]] + [it]
        json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
        n += 1
        print("  ✓", it["n"], flush=True)
        if n % 4 == 0:
            commit("قصص الطلائع: صياغة %d قصص من كتب القدوات" % n)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
    print("صيغت %d قصة؛ المجموع %d، والمتبقي %d" % (n, len(out["items"]), len([s for s in S if s["id"] not in {x["id"] for x in out["items"]}])), flush=True)
    commit("قصص الطلائع: صياغة قصص القدوات من كتب الباشا ومصطفى دياب")


if __name__ == "__main__":
    main()
