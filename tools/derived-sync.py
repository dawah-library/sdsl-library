#!/usr/bin/env python3
"""المصدر الواحد: نص الكتاب المعتمد (data/books|vols/<id>.json) هو الأصل، وكل ما سواه مشتق منه (المرحلة ٢، ٢٠ نوفمبر ٢٠٢٦).

بعد أي تصحيح للنص يكشف هذا الفحص المشتقات الأقدم من آخر تعديل للنص ويعيد توليدها من المصدر:
  - الصوتيات والإذاعة: tts.py يعيد في جولته المجدولة (TTS_REFRESH=1) كل صفحة تغيّرت بصمة نصها، والإذاعة تقرأ ملف الصوت نفسه.
    هنا يُتحقق فقط ويُبلَّغ بالصفحات القديمة (بصمة tts نفسها).
  - الاختصار والاختبار (data/summ، data/quizzes) ← data/study-queue.json؛ التشجير ← data/tashjir/_queue.json؛
    الكراسة ← data/kurrasa/_queue.json. ولا يُطلب التوليد قبل اكتمال مراجعة النص على المصورة (unrev/lite).
  - الفيديو: يُبلَّغ فقط (خدمة مكلفة: إعادة الإخراج بقرار الإدارة).
  - التصدير (Word/PDF/النص) والقارئ: يُبنيان من النص مباشرة عند الطلب؛ ويُحدَّث «size» في الفهرس ليتجاوز المتصفح نسخته المخزنة.
الاستعمال: python3 tools/derived-sync.py [معرفات…|--changed|--auto] [--apply]
  --auto: بصمات النص والتشكيل (data/audit/derived-state.json) لكل كتاب له مشتقات، فما تغيّر يُعاد: التشكيل ثم الصوت (refresh) ثم الإذاعة تبعًا؛ تشغّله derived.yml   (بلا معرفات: كل الكتب التي تغيّر نصها في آخر ٣٠ يومًا)
التقرير: data/audit/derived.json
"""
import datetime, hashlib, importlib.util, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")


def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def js(p, o, ind=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, **({"indent": ind} if ind else {"separators": (",", ":")}))


def git_date(path):
    """تاريخ آخر تعديل للمحتوى (git)، وإن كان في الشجرة تعديل لم يُودَع فاليوم."""
    rel = os.path.relpath(path, ROOT)
    if subprocess.run(["git", "diff", "--quiet", "--", rel], cwd=ROOT).returncode: return datetime.date.today().isoformat()
    r = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() or "0000-00-00"


def text_path(b):
    for p in (os.path.join(ROOT, "vols", b["id"] + ".json") if b.get("vf") else None, os.path.join(D, "books", b["id"] + ".json")):
        if p and os.path.exists(p): return p


def md5_file(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()[:12]


def md5_dir(d):
    h = hashlib.md5()
    for f in sorted(os.listdir(d)): h.update(f.encode()); h.update(open(os.path.join(d, f), "rb").read())
    return h.hexdigest()[:12]


bid_in = lambda changed, b: b["id"] in changed


def stale_audio(bid, man):
    """صفحات الصوت التي تغيّر نصها (ببصمة tts.py نفسها)؛ None إن تعذر استيراد tts."""
    try:
        sp = importlib.util.spec_from_file_location("tts", os.path.join(ROOT, "tools", "tts.py")); t = importlib.util.module_from_spec(sp); sp.loader.exec_module(t)
        sh = jl(text_path({"id": bid})); P = sh["pages"]
        return [int(k) for k, v in (man.get("pages") or {}).items() if v.get("d") and k.isdigit() and int(k) <= len(P)
                and v.get("h") != t.h(t.speakable(t.clean(t.tashkeel_text(bid, int(k), P[int(k) - 1])), False))]
    except Exception:
        return None


def enqueue(path, bid, extra=None):
    q = jl(path, {"items": []}) or {"items": []}
    if any((x.get("id") if isinstance(x, dict) else x) == bid for x in q["items"]): return False
    q["items"].insert(0, dict({"id": bid, "why": "تصحيح النص"}, **(extra or {}))); js(path, q, 1); return True


def main():
    apply = "--apply" in sys.argv; ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--changed" in sys.argv:  # في المهام (نسخة git سطحية): الكتب التي غيّرت هذه الجولةُ نصَّها ولم تُودَع بعد
        out = subprocess.run(["git", "diff", "--name-only", "--", "data/books", "vols"], cwd=ROOT, capture_output=True, text=True).stdout.split()
        ids = [os.path.basename(f)[:-5] for f in out if f.endswith(".json")]
        dq = os.path.join(D, "audit", "derived-queue.json")  # ما صُحّح من الموقع (#/proof أو تحرير الصفحة) يُسجَّل هنا
        ids += [x for x in (jl(dq, {}) or {}).get("items", []) if x not in ids]
        if apply and os.path.exists(dq): js(dq, {"items": []}, 1)
        if not ids: print("لا نص تغيّر في هذه الجولة"); return
    cp = os.path.join(D, "catalog.json"); cat = jl(cp); cmod = False
    changed = {}  # المعرف ← (تغيّر النص؟، تغيّر التشكيل؟) — في وضع --auto بالبصمات المحفوظة
    if "--auto" in sys.argv:
        stp = os.path.join(D, "audit", "derived-state.json"); st = jl(stp, {}) or {}
        dq = os.path.join(D, "audit", "derived-queue.json"); qd = (jl(dq, {}) or {}).get("items", [])
        cand = {f[:-5] for d in ("audio", "summ", "tashjir", "kurrasa", "quizzes") for f in os.listdir(os.path.join(D, d)) if f.endswith(".json") and not f.startswith("_")}
        cand |= {x for x in os.listdir(os.path.join(D, "tashkeel")) if os.path.isdir(os.path.join(D, "tashkeel", x))} | set(qd)
        for b in cat["books"]:
            if b["id"] not in cand: continue
            tp = text_path(b)
            if not tp: continue
            th = md5_file(tp); kd = os.path.join(D, "tashkeel", b["id"])
            kh = md5_dir(kd) if os.path.isdir(kd) else ""
            old = st.get(b["id"])
            if old is None and b["id"] not in qd: st[b["id"]] = [th, kh]; continue  # أول مرة: تُحفظ البصمة فقط
            if b["id"] in qd or old != [th, kh]:
                changed[b["id"]] = (b["id"] in qd or not old or old[0] != th, bool(old) and old[1] != kh)
            st[b["id"]] = [th, kh]
        if apply: js(stp, st); js(dq, {"items": []}, 1)
        ids = list(changed)
        if not ids: print("لا نص ولا تشكيل تغيّر"); return
    since = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
    vids = jl(os.path.join(D, "video", "_list.json"), {}) or {}
    rep = {"at": datetime.date.today().isoformat(), "books": []}
    for b in cat["books"]:
        if ids and b["id"] not in ids: continue
        tp = text_path(b)
        if not tp: continue
        src = datetime.date.today().isoformat() if bid_in(changed, b) else git_date(tp)
        if not ids and src < since: continue
        bid, r = b["id"], {"id": b["id"], "t": b["title"], "src": src, "stale": [], "queued": [], "note": []}
        reviewed = not (b.get("ocr") and (b.get("unrev") or b.get("lite")))
        sz = os.path.getsize(tp)
        if b.get("size") and b["size"] != sz:
            r["note"].append("حُدّث مقاس النص في الفهرس (%s ← %s) ليجلب المتصفح النسخة المصححة" % (b["size"], sz))
            if apply: b["size"] = sz; cmod = True
        for kind, path, key, q, extra in (("الاختصار", "summ", "built", "study-queue.json", {"do": ["summ"]}),
                                           ("الاختبار", "quizzes", "at", "study-queue.json", {"do": ["quiz"]}),
                                           ("التشجير", "tashjir", "built", "tashjir/_queue.json", None),
                                           ("الكراسة", "kurrasa", "built", "kurrasa/_queue.json", None)):
            o = jl(os.path.join(D, path, bid + ".json"))
            if not o or (o.get(key) or "") >= src: continue
            r["stale"].append("%s (بُني %s)" % (kind, o.get(key)))
            if not reviewed: r["note"].append("%s: يُعاد بعد اكتمال مراجعة النص على المصورة" % kind); continue
            if apply:
                qp = os.path.join(D, q)
                if q == "study-queue.json":
                    sq = jl(qp, {"items": []}); e = next((x for x in sq["items"] if x.get("id") == bid), None)
                    if e: e["do"] = sorted(set(e.get("do") or []) | set(extra["do"]))
                    else: sq["items"].insert(0, {"id": bid, "do": extra["do"]})
                    js(qp, sq); r["queued"].append(kind)
                elif enqueue(qp, bid): r["queued"].append(kind)
        ct, ck = changed.get(bid, (False, False))
        if ct and os.path.isdir(os.path.join(D, "tashkeel", bid)):  # صُحّح النص: يُعاد تشكيل الصفحات المتغيرة (tashkeel.py يقارن البصمات)
            r["stale"].append("التشكيل")
            if reviewed and apply and enqueue(os.path.join(D, "tashkeel", "_queue.json"), bid): r["queued"].append("التشكيل")
        man = jl(os.path.join(D, "audio", bid + ".json"))
        if man and (ct or ck):  # الصوت يتبع النص والتشكيل صفحةً صفحة، والإذاعة تقرأ ملفات الصوت نفسها
            r["stale"].append("الصوت والإذاعة (الصفحات المتغيرة)")
            if not reviewed: r["note"].append("الصوت: يُعاد بعد اكتمال مراجعة النص على المصورة")
            elif apply:
                q = jl(os.path.join(D, "audio", "_queue.json"), {"items": []}) or {"items": []}
                e = next((x for x in q["items"] if x.get("id") == bid), None)
                if e: e["refresh"] = 1
                else: q["items"].insert(0, {"id": bid, "refresh": 1, "voice": man.get("v")})
                js(os.path.join(D, "audio", "_queue.json"), q, 1); r["queued"].append("الصوت")
        elif man and not changed:
            sa = stale_audio(bid, man)
            if sa: r["stale"].append("الصوت: نحو %d صفحة بتقدير محلي (والإذاعة تبعًا له)" % len(sa)); r["note"].append("الصوت يُعاد آليًّا في الجولة المجدولة (TTS_REFRESH)" + ("" if reviewed else " بعد اكتمال مراجعة النص"))
            elif sa is None: r["note"].append("تعذر حساب بصمات الصوت محليًّا؛ الجولة المجدولة تتولاها")
        for v in vids.get(bid, []):
            if (v.get("at") or "") < src: r["stale"].append("فيديو %s (%s) — إعادة الإخراج بقرار الإدارة" % (v.get("f"), v.get("at")))
        rep["books"].append(r)
    if apply and cmod: js(cp, cat)
    js(os.path.join(D, "audit", "derived.json"), rep, 1)
    for r in rep["books"]:
        print("%s «%s» (النص %s): قديم: %s%s" % (r["id"], r["t"], r["src"], "، ".join(r["stale"]) or "لا شيء", (" | أُعيد طلب: " + "، ".join(r["queued"])) if r["queued"] else ""))
        for n in r["note"]: print("   -", n)


if __name__ == "__main__":
    os.chdir(ROOT); main()
