#!/usr/bin/env python3
"""موجّه إثراء الكتب الجديدة (بطلب المالك: «إذا رفعتُ كتبًا فأثرِ منها الأقسام بحسب موضوعاتها»).

يمر على كل كتاب لم يمر عليه (data/enrich-state.json) بعد أن يصير نصه جاهزًا (إلكتروني، أو اكتمل تدقيقه على المصورة)،
فيوجّهه إلى خدمات الأقسام بحسب نوعه وموضوعه، ولا يكتب نصًّا من عنده:
  - كتب القصص (عنوانها يدل عليها، أو الوسم story): تُعلَّم للطلائع (tala:<المراحل>) وتُستخرج قصصها (tools/tala-stories.py)
    فتظهر في «قصة اليوم» ومكتبة الطلائع. مراحلها: «للأطفال/للصغار» ← t1 وt2؛ وإلا t2 وt3 (وt4 للكبير).
  - كتب الدعوة في العقيدة والتزكية والتربية والفقه والسيرة والآداب والمنهج: طابور التشجير (خريطة ذهنية بالمضمون)،
    وطابور الاختبارات والمختصرات (study-ai)، فتظهر في «اختبارات الكتب» و«اختصار الكتب» و«الخرائط الذهنية».
  - كتب السيرة والتراجم والتاريخ: تُعلَّم للطلائع الكبار (tala:t3 وt4) لسلّم القراءة.
  - كتب المكتبة العامة الجديدة: طابور التدقيق (proof) وربط مصوّرة طبعتها (edition.yml يومي).
  - كتب الحديث: تُذكر في التقرير لمطابقتها بكتب السنة (يدويًّا عند الحاجة).
التقرير: tools/enrich-new.md. مفتاح الإيقاف: enrich في «الخدمات والمفاتيح».
"""
import datetime, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
jl = lambda p, d: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
def js(p, o, indent=None): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
STORY = re.compile(r"قصص|قصة|حكاي|للأطفال|للصغار|للناشئة|للفتيان|مغامر|حياة الصحابة|رجال حول الرسول|صور من حياة|أبطال")
KIDS = re.compile(r"للأطفال|للصغار|الطفل|براعم|الصغير")
TJ_TOPICS = {"t1", "t6", "t8", "t4", "t5", "t11", "t19", "t20", "t14", "t2", "t12"}   # موضوعات تفيدها الخرائط والاختبارات
TALA_BIG = {"t5", "t18"}


def ready(b): return not b.get("ocr") or (b.get("unrev") or 0) + (b.get("unc") or 0) == 0  # المراجَع بالنموذج الخفيف جاهز لخدمات الدراسة


def addq(path, item, key="id"):
    q = jl(path, {"items": []}); q.setdefault("items", [])
    if any((x.get(key) if isinstance(x, dict) else x) == item[key] for x in q["items"]): return False
    q["items"].append(item); js(path, q, indent=1); return True


def main():
    sw = (jl(os.path.join(D, "switches.json"), {}) or {}).get("s") or {}
    if sw.get("enrich") is False or sw.get("all_jobs") is False: print("موقوف من المفاتيح"); return
    cat = jl(os.path.join(D, "catalog.json"), {"books": []}); sp = os.path.join(D, "enrich-state.json")
    st = jl(sp, None)
    first = st is None
    st = st or {"note": "الكتب التي مرّ عليها موجّه الإثراء (tools/enrich-new.py)", "seen": []}
    seen = set(st["seen"]); rep = []; changed = False
    works = {}
    for b in cat["books"]:
        if b.get("hidden") or b.get("demo") or (b.get("type") or "book") != "book": continue
        works.setdefault(b.get("set") or b["id"], []).append(b)
    for k, vs in works.items():
        if k in seen: continue
        if not all(ready(v) for v in vs): continue  # ينتظر اكتمال تدقيقه (ويُوجَّه بعده ولو كان موجودًا من قبل)
        if first:  # أول تشغيل: يُسجَّل الجاهز الموجود دون توجيه (الأقسام بُنيت عليه من قبل)، ويُوجَّه الجديد بعدها
            seen.add(k); continue
        b = vs[0]; t = b.get("setTitle") or b["title"]; col = b.get("col") or "dawah"; tp = b.get("topicId"); did = []
        if STORY.search(t) or "story" in (b.get("tags") or []):
            stages = ["t1", "t2"] if KIDS.search(t) else (["t2", "t3"] if (b.get("n") or 0) < 300 else ["t3", "t4"])
            for v in vs:
                tags = set(v.get("tags") or []); tags |= {"tala:" + s for s in stages} | {"story"}; v["tags"] = sorted(tags)
            changed = True; did.append("الطلائع (قصص، المراحل %s)" % "، ".join(stages))
        elif tp in TALA_BIG and col == "dawah":
            for v in vs: v["tags"] = sorted(set(v.get("tags") or []) | {"tala:t3", "tala:t4"})
            changed = True; did.append("سلّم قراءة الطلائع الكبار")
        if col == "dawah" and tp in TJ_TOPICS:
            if addq(os.path.join(D, "tashjir", "_queue.json"), {"id": vs[0]["id"], "auto": 1}): did.append("الخرائط الذهنية")
            if addq(os.path.join(D, "study-queue.json"), {"id": vs[0]["id"], "do": ["quiz", "summ"]}): did.append("الاختبارات والمختصرات")
        if col == "turath":
            if addq(os.path.join(D, "proof", "_queue.json"), {"id": vs[0]["id"]}): did.append("التدقيق")
            did.append("ربط مصورة الطبعة (يوميًّا)")
        if tp in {"t3", "t13"}: did.append("قسم الحديث: يُراجع ربطه بكتب السنة")
        seen.add(k)
        rep.append("- %s «%s» (%s): %s" % (datetime.date.today().isoformat(), t, col, "، ".join(did) or "لا خدمة إضافية لموضوعه"))
    st["seen"] = sorted(seen); js(sp, st, indent=0)
    if changed:
        cat["version"] = int(datetime.datetime.now().timestamp() * 1000)
        json.dump(cat, open(os.path.join(D, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if rep:
        lp = os.path.join(ROOT, "tools", "enrich-new.md"); old = open(lp, encoding="utf-8").read().split("\n", 2)[-1] if os.path.exists(lp) else ""
        open(lp, "w", encoding="utf-8").write("# إثراء الأقسام من الكتب الجديدة (tools/enrich-new.py)\n\n" + "\n".join(rep) + "\n" + old)
    print("سُجّل أول مرة" if first else "وُجّه %d كتابًا" % len(rep)); print("\n".join(rep))


if __name__ == "__main__":
    main()
