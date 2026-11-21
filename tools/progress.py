#!/usr/bin/env python3
"""متابعة إنجاز الكتب من رفعها حتى اكتمال كل خدماتها، بنسبة مئوية ووقت متوقع (data/progress.json)، وتقديمها آليًا إلى الخدمات.

لكل كتاب من كتب مكتبة الدعوة (والكتب المرفوعة في صندوق التحويل) مراحل بأوزان مجموعها ١٠٠:
  الرفع والظهور في القسم ٥ | التحويل الأولي ١٥ | التدقيق على الصور ٢٥ | مواضع الشك ٥ | فحص الآيات ٥ | البطاقة والفهرس ٥
  التشكيل ١٥ | اعتماد التشكيل ٥ | فوائد المشايخ ٤ | سؤال وجواب ٣ | التشجير ٤ | الفهارس الفنية ٣ | الصوتيات ٦
والوقت المتوقع من سرعة تقدم الكتاب في الأيام الماضية (يُحفظ سجل يومي)، وإلا من سرعة التدقيق العامة.

التقديم الآلي (حين يكتمل تدقيق نص الكتاب): التشجير، والصوتيات بعد اعتماد الإدارة لتشكيله.
يكتب .progress-dispatch بأسماء المهام التي تحتاج تشغيلًا، فتشغّلها المهمة.
"""
import datetime, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, "data", *p)
TODAY = datetime.date.today().isoformat()


def jl(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


# ---------- جاهزية الرفع (طلب المدير، ٢١ نوفمبر ٢٠٢٦) ----------
# مؤشر يحدد ملاءمة رفع كتب مصورة وتفريغات جديدة بناءً على نسبة إنجاز المرفوع سابقًا: الصفحات المنتظرة للتدقيق، وسرعة التدقيق اليومية،
# وصندوق التحويل، وطوابير التفريغ، ونسبة الكتب المصورة المكتملة تدقيقًا. الحدود قابلة للضبط من data/switches.json ← ready.
READY_DEF = {"green_days": 3, "yellow_days": 10, "green_core": 85, "inbox_max": 3, "tf_max": 6, "horizon": 5}


def readiness(books, out, inbox, pending, speed, prev):
    cfg = dict(READY_DEF, **((jl(D("switches.json"), {}) or {}).get("ready") or {}))
    ocr = [b for b in books if b.get("ocr")]
    pages = sum(max(1, int(b.get("n") or 1)) for b in ocr) or 1
    done_books = sum(1 for b in ocr if not int(b.get("unrev") or 0) and not int(b.get("lite") or 0))
    core = round(100.0 * (1 - pending / pages), 1)  # نسبة صفحات الكتب المصورة المدققة
    avg = round(sum(r["pct"] for r in out.values()) / max(1, len(out)), 1)  # متوسط إنجاز الكتب بكل خدماتها
    tq = len((jl(D("transcribe", "_queue.json"), {}) or {}).get("items") or []) + len((jl(D("tfedit", "_queue.json"), {}) or {}).get("items") or [])
    sp = speed if speed and speed > 0 else None
    days = round(pending / sp, 1) if sp else (0 if not pending else None)
    reasons = []
    if days is None: reasons.append("سرعة التدقيق غير معروفة بعد (أقل من يومين من القياس) أو متوقفة")
    elif days > cfg["yellow_days"]: reasons.append("الصفحات المنتظرة تحتاج نحو %s يومًا بالسرعة الحالية" % days)
    if len(inbox) > cfg["inbox_max"]: reasons.append("%d كتابًا في صندوق التحويل لم يبدأ" % len(inbox))
    if tq > cfg["tf_max"]: reasons.append("%d تفريغًا في طابور التجهيز" % tq)
    if days is not None and days <= cfg["green_days"] and core >= cfg["green_core"] and len(inbox) <= cfg["inbox_max"] and tq <= cfg["tf_max"]: lv = "green"
    elif days is not None and days <= cfg["yellow_days"] and len(inbox) <= cfg["inbox_max"] * 2: lv = "yellow"
    else: lv = "red"
    # السعة المقترحة: ما يمكن للتدقيق إنجازه في الأفق (horizon أيام) بعد المنتظر
    cap = max(0, int((sp or 0) * cfg["horizon"] - pending)) if lv != "red" else 0
    msg = {"green": "مناسب لرفع كتب مصورة وتفريغات جديدة", "yellow": "رفع محدود: يُرفع ما لا يتجاوز السعة المقترحة، والأولوية لإكمال المرفوع",
           "red": "يُفضَّل تأجيل الرفع حتى ينخفض المنتظر"}[lv]
    r = {"lv": lv, "msg": msg, "pending": pending, "speed": sp, "days": days, "core": core, "avg": avg, "ocr_books": len(ocr), "done_books": done_books,
         "inbox": len(inbox), "tf_queue": tq, "cap_pages": cap, "cap_books": cap // 250, "why": reasons, "since": prev.get("since") if prev.get("lv") == lv else TODAY, "cfg": cfg}
    if prev.get("lv") and prev.get("lv") != lv:  # تغيّر المستوى: إشعار للإدارة (progress.yml يرسله)
        icon = {"green": "🟢", "yellow": "🟡", "red": "🔴"}[lv]
        open(os.path.join(ROOT, ".ready-change"), "w", encoding="utf-8").write("%s <b>جاهزية الرفع: %s</b>\nالمنتظر للتدقيق %d صفحة • السرعة %s صفحة/يوم • نحو %s يومًا\nتدقيق المصورات %s%% • متوسط إنجاز الكتب %s%%%s%s" % (
            icon, msg, pending, sp or "—", days if days is not None else "—", core, avg, ("\nالسعة المقترحة: نحو %d صفحة (%d كتابًا تقريبًا)" % (cap, cap // 250)) if cap else "", ("\n" + "؛ ".join(reasons)) if reasons else ""))
    return r


def main():
    cat = jl(D("catalog.json"), {"books": []})
    tk = jl(D("tashkeel", "_list.json"), {})
    fw = jl(D("fawaid.json"), {"items": [], "done": {}})
    qa = jl(D("qa", "_index.json"), {"items": []})
    tj = jl(D("tashjir", "_list.json"), {})
    tjq = jl(D("tashjir", "_queue.json"), {"items": []})
    au = jl(D("audio", "_list.json"), {})
    auq = jl(D("audio", "_queue.json"), {"items": []})
    idx = jl(D("idx", "_list.json"), {})
    qc = jl(D("quran-check", "_list.json"), {})
    paths = jl(D("paths.json"), {"paths": []})
    old = jl(D("progress.json"), {"books": {}})
    qa_books = {}
    for it in qa.get("items", []):
        if len(it) > 2:
            qa_books[it[2]] = qa_books.get(it[2], 0) + 1
    in_paths = {b for p in paths.get("paths", []) for b in p.get("books", [])}
    fw_n = {}
    for it in fw.get("items", []):
        fw_n[it.get("b")] = fw_n.get(it.get("b"), 0) + 1

    books = [b for b in cat["books"] if (b.get("col", "dawah") == "dawah" or b.get("upl")) and b.get("type", "book") == "book" and not b.get("demo")]
    out, dispatch = {}, set()
    sw = (jl(D("switches.json"), {}) or {}).get("s") or {}
    au_only = set(jl(D("audio", "_settings.json"), {}).get("only") or [])
    tj_off = sw.get("tashjir") is False or sw.get("all_jobs") is False  # الموقوف لا يُضاف إلى طابوره فلا تتكدس الطلبات
    tj_have = set(tj) | {x.get("id") if isinstance(x, dict) else x for x in tjq.get("items", [])}
    au_have = set(au) | {x.get("id") if isinstance(x, dict) else x for x in auq.get("items", [])}

    for b in books:
        bid, n = b["id"], max(1, int(b.get("n") or 1))
        unrev, lite, unc = int(b.get("unrev") or 0), int(b.get("lite") or 0), int(b.get("unc") or 0)
        ocr = bool(b.get("ocr"))
        st = []

        def add(key, label, w, frac, note=""):
            frac = max(0.0, min(1.0, frac))
            st.append({"k": key, "t": label, "w": w, "f": round(frac, 3), "note": note})

        add("up", "الرفع والظهور في القسم", 5, 1.0)
        add("ocr", "التحويل الأولي إلى نص", 15, (n - unrev) / n if ocr else 1.0, ("%d صفحة لم تُقرأ بالذكاء الاصطناعي" % unrev) if unrev else "")
        add("rev", "التدقيق على صور الصفحات", 25, (n - lite - unrev) / n if ocr else 1.0, ("بقي %d صفحة" % (lite + unrev)) if (lite or unrev) else "")
        add("unc", "مواضع الشك", 5, 1.0 if not unc else max(0.0, 1 - unc / max(10.0, n * 0.3)), ("%d موضعًا" % unc) if unc else "")
        q = qc.get(bid)
        add("quran", "فحص الآيات", 5, 0.0 if q is None else (1.0 if not q.get("bad") else max(0.0, 1 - q["bad"] / max(1, q.get("n", 1)))),
            "لم يُفحص بعد" if q is None else ("%d آية، %d موضع خلل" % (q.get("n", 0), q.get("bad", 0))))
        add("card", "بطاقة التعريف والفهرس", 5, 1.0 if b.get("card") else 0.5, "" if b.get("card") else "البطاقة لم تُعدّ بعد")
        t = tk.get(bid) or {}
        add("tash", "التشكيل المدقق", 15, (t.get("n", 0) / max(1, t.get("of", n))) if t else 0.0, ("%d من %d صفحة" % (t.get("n", 0), t.get("of", n))) if t else "يبدأ بعد اكتمال التدقيق")
        add("tashok", "اعتماد التشكيل من الإدارة", 5, 1.0 if t.get("ok") else 0.0, "" if t.get("ok") else "ينتظر «اعتماد العرض»")
        done_fw = fw.get("done", {}).get(bid, 0)
        add("fawaid", "انتقاء فوائد المشايخ", 4, done_fw / n, ("%d فائدة" % fw_n.get(bid, 0)) if done_fw else "")
        text_ready = (not ocr) or (unrev == 0 and lite == 0)
        add("qa", "سؤال وجواب", 3, 1.0 if (qa_books.get(bid) or text_ready) else 0.0, ("%d سؤالًا" % qa_books.get(bid, 0)) if qa_books.get(bid) else ("لا أسئلة صريحة في نص الكتاب" if text_ready else "بعد اكتمال التدقيق"))
        j = tj.get(bid) or {}
        add("tashjir", "التشجير", 4, 1.0 if j.get("ok") else (0.7 if j else (0.1 if bid in tj_have else 0.0)), "معتمد" if j.get("ok") else ("جاهز ينتظر الاعتماد" if j else ("في الطابور" if bid in tj_have else "")))
        add("idx", "الفهارس الفنية", 3, 1.0 if bid in idx else 0.0)
        a = au.get(bid) or {}
        add("audio", "الصوتيات", 6, (a.get("n", 0) / max(1, a.get("of", n)) * (1.0 if a.get("ok") else 0.8)) if a else (0.05 if bid in au_have else 0.0),
            ("%d من %d صفحة" % (a.get("n", 0), a.get("of", n))) if a else "بعد اعتماد التشكيل")
        pct = round(sum(s["w"] * s["f"] for s in st), 1)
        nxt = next((s for s in st if s["f"] < 1.0), None)

        hist = [h for h in (old.get("books", {}).get(bid, {}).get("h") or []) if h[0] != TODAY][-20:] + [[TODAY, pct]]
        eta = None
        if len(hist) >= 2:
            d0, p0 = hist[max(0, len(hist) - 8)]
            days = max(1, (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(d0)).days)
            rate = (pct - p0) / days
            if rate > 0.05:
                eta = round((100 - pct) / rate, 1)
        out[bid] = {"t": b.get("setTitle") or b.get("title"), "a": b.get("authorId"), "topic": b.get("topicId"), "added": b.get("added"), "n": n,
                    "pct": pct, "next": nxt["t"] if nxt else "اكتمل", "eta": eta, "st": st, "h": hist, "path": bid in in_paths}

        # (أُلغي التقديم الآلي إلى طابوري التشجير والصوتيات بقرار المدير ٢٠ نوفمبر: تُضاف الكتب إليهما من الإدارة يدويًّا)

    # الكتب المرفوعة التي لم تُحوَّل بعد (صندوق التحويل)
    inbox = []
    for f in sorted(glob.glob(os.path.join(ROOT, "ocr-inbox", "*.json"))):
        cfg = jl(f, {})
        base = f[:-5]
        # رفع غير مكتمل (أجزاء بلا علامة اكتمال): لا يدخل التحويل أبدًا، فلا يُعرض كتابًا ينتظر (كان يظهر مكررًا عند ٣٪)
        if not any(os.path.exists(base + x) for x in (".pdf", ".ready", ".store", ".url")): continue
        if cfg.get("title"):
            inbox.append({"t": cfg["title"], "f": os.path.basename(f)[:-5], "pct": 3, "next": "ينتظر التحويل إلى نص"})

    # سرعة التدقيق العامة (صفحات في اليوم) من مجموع الصفحات الخفيفة عبر الأيام
    tot = sum(int(b.get("lite") or 0) + int(b.get("unrev") or 0) for b in books)
    th = [h for h in (old.get("lite_h") or []) if h[0] != TODAY][-20:] + [[TODAY, tot]]
    speed = None
    if len(th) >= 2:
        d0, v0 = th[max(0, len(th) - 8)]
        days = max(1, (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(d0)).days)
        speed = round((v0 - tot) / days, 1)
    for bid, r in out.items():
        if r["eta"] is None and speed and speed > 0:
            b = next(x for x in books if x["id"] == bid)
            left = int(b.get("lite") or 0) + int(b.get("unrev") or 0)
            if left:
                r["eta"] = round(left / speed + 2, 1)  # + يومان تقريبًا للتشكيل والخدمات
    ready = readiness(books, out, inbox, tot, speed, old.get("ready") or {})
    res = {"upd": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M"), "speed": speed, "pending_pages": tot, "lite_h": th,
           "ready": ready, "books": out, "inbox": inbox}
    json.dump(res, open(D("progress.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, ".progress-dispatch"), "w").write("\n".join(sorted(dispatch)))
    for bid, r in sorted(out.items(), key=lambda kv: -kv[1]["pct"]):
        print("%5.1f%%  %s  ← %s%s" % (r["pct"], r["t"], r["next"], ("  (≈%s يوم)" % r["eta"]) if r["eta"] else ""))


if __name__ == "__main__":
    main()
