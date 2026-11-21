#!/usr/bin/env python3
"""الإصدار الدوري لمجلة المكتبة (طلب المدير ٢١ نوفمبر).

الجدول في data/majalla.json ← plan:
  {"auto": 1, "every": "month" أو عدد أيام, "day": يوم الشهر, "prep": أيام فتح العدد قبل موعده,
   "grace": أيام التعديل بعد صدوره, "themes": [موضوعات الأعداد القادمة بالترتيب]}

دورة العدد:
  ١) قبل موعده بـ prep يومًا يُنشأ «العدد القادم» بحالة open: يضيف إليه المدير والفريق أبوابًا ومشاركات، وتُقبل فيه مشاركات المؤلفين والقراء.
  ٢) يوم موعده يصدر آليًّا: يبقى كل ما أُضيف يدويًّا، ويُستكمل ما نقص من أبواب العدد المعتادة من مواد المكتبة بموضوعه (it.auto=1)،
     فإن لم تُضف مشاركة يدوية واحدة صدر العدد آليًّا كاملًا.
  ٣) بعد صدوره يبقى قابلًا للتعديل للفريق حتى edUntil (grace يومًا)، ثم للمدير وحده.

الاختيار الآلي مثل «المسودة الآلية» في majalla.js: ما طابق كلمات الموضوع في العنوان أو التصنيف، دون تكرار ما نُشر،
وبتنويع الكتّاب، وأنسب صفحة في الكتب المرشحة، والركن الأدبي من مقالات أعلام الأدب.
"""
import datetime, json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")
P = os.path.join(D, "majalla.json")
DRY = os.environ.get("MAJ_DRY") == "1"
# موضوعات احتياطية إن لم تحدد الإدارة موضوع العدد القادم (يُختار أول ما لم يُستعمل)
THEMES = ["التوحيد", "الصلاة", "بر الوالدين", "طلب العلم", "الدعوة إلى الله", "الأخلاق", "الصبر", "التوبة", "الأسرة", "الشباب",
          "السنة", "القرآن", "الإخلاص", "الصدق", "الأمانة", "الصحابة", "السيرة النبوية", "الزكاة", "الحج", "الصيام", "الذكر والدعاء",
          "الأمر بالمعروف", "الفتن", "اليوم الآخر", "الحياء", "الأخوة", "التربية", "المرأة المسلمة"]
# أبواب العدد المعتادة التي تُستكمل آليًّا إن لم يملأها الفريق (الاسم، والركن إن وُجد)
SECS = [("مقالات العدد", ""), ("فتاوى في الموضوع", ""), ("من كتب مشايخ الدعوة", ""), ("من المكتبة العامة", ""), ("الركن الأدبي", "adab")]


def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def norm(s):
    s = re.sub(r"[ً-ْٰـ]", "", s or "")
    return s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا").replace("ى", "ي").replace("ة", "ه").lower()


def today():  # تاريخ القاهرة
    return (datetime.datetime.utcnow() + datetime.timedelta(hours=2)).date()


def pdate(s):
    try: return datetime.date.fromisoformat(str(s)[:10])
    except Exception: return None


def next_pub(plan, last):
    """موعد العدد التالي بعد آخر عدد صادر."""
    every, day = plan.get("every", "month"), int(plan.get("day") or 1)
    base = last or today()
    if every == "month":
        y, m = base.year + (base.month // 12), base.month % 12 + 1
        if not last:  # أول عدد آلي: أقرب يوم «day» قادم
            d0 = base.replace(day=min(day, 28))
            return d0 if d0 >= base else datetime.date(y, m, min(day, 28))
        return datetime.date(y, m, min(day, 28))
    return base + datetime.timedelta(days=max(7, int(every)))


# ---------- الاختيار الآلي ----------
def library():
    cat = jl(os.path.join(D, "catalog.json"), {"books": [], "topics": [], "authors": []})
    arts = jl(os.path.join(D, "articles", "index.json"), {"items": []})["items"]
    tps = {t["id"]: t for t in cat.get("topics", [])}
    lab = lambda tid: (lambda t: ((t.get("parent") or "") + " " + t.get("name", "")) if t else "")(tps.get(tid))
    books = [dict(b, kind="book", tl=lab(b.get("topicId"))) for b in cat["books"] if not b.get("demo") and not b.get("hidden") and (b.get("type") or "book") == "book" and (b.get("col") or "dawah") != "ithra" and not (b.get("set") and (b.get("vol") or 1) > 1)]
    items = []
    for a in arts:
        if a.get("h") or (a.get("col") or "dawah") == "ithra": continue
        c = a.get("c") or ""
        kind = "fatwa" if (a.get("fa") or re.match(r"^(أسئلة|الاستفتاء|من فقه الواقع)", c)) else "statement" if (a.get("tp") == "at17" or re.search(r"بيانات|(^|›\s*)بيان", c)) else "article"
        items.append({"id": a["id"], "title": a.get("t", ""), "authorId": a.get("a"), "col": a.get("col") or "dawah", "date": a.get("d") or "", "kind": kind, "tl": lab(a.get("tp")) + " " + c})
    return cat, books, items


def draft(theme, skip, data, cat, books, items):
    w = [k for k in norm(theme).split() if len(k) > 1]
    if not w: return []
    score = lambda b: sum((3 if k in norm(b["title"]) else 0) + (1 if k in norm(b.get("tl", "")) else 0) for k in w)

    def pick(lst, n, per=1):
        seen, out = {}, []
        for b in sorted([b for b in lst if b["id"] not in skip and score(b) > 0], key=lambda b: (score(b), b.get("date", "")), reverse=True):
            if len(out) >= n: break
            if seen.get(b.get("authorId"), 0) < per:
                seen[b.get("authorId")] = seen.get(b.get("authorId"), 0) + 1; out.append(b)
        return out

    def from_books(lst, n):
        out = []
        for b in pick(lst, n * 3):
            if len(out) >= n: break
            sh = jl(os.path.join(D, "books", b["id"] + ".json"), None)
            if not sh or not sh.get("pages"): continue
            best, bp = 0, 0
            for i, pg in enumerate(sh["pages"]):
                if not isinstance(pg, str): continue
                t = norm(pg); s = sum(1 for k in w if k in t)
                if s > best: best, bp = s, i + 1
            if best: out.append({"ref": b["id"], "p": bp, "p2": bp, "auto": 1})
        return out

    arts = [x for x in items if x["kind"] == "article"]
    adq = [norm(f.get("q", "")) for f in (data.get("adab") or []) if f.get("q")]
    adab_ids = {a["id"] for a in cat.get("authors", []) if any(q and q in norm(a.get("name", "")) for q in adq)}
    adab = [x for x in arts if x["col"] == "turath" and x.get("authorId") in adab_ids and x["id"] not in skip]
    random.shuffle(adab); adab.sort(key=lambda b: -score(b))
    seen, adab_out = set(), []
    for b in adab:
        if len(adab_out) < 2 and b.get("authorId") not in seen: seen.add(b.get("authorId")); adab_out.append({"ref": b["id"], "st": "adab", "auto": 1})
    return [
        {"t": "مقالات العدد", "items": [{"ref": b["id"], "auto": 1} for b in pick(arts, 4)]},
        {"t": "فتاوى في الموضوع", "items": [{"ref": b["id"], "auto": 1} for b in pick([x for x in items if x["kind"] == "fatwa"], 4, 4)]},
        {"t": "من كتب مشايخ الدعوة", "items": from_books([b for b in books if (b.get("col") or "dawah") == "dawah"], 2)},
        {"t": "من المكتبة العامة", "items": from_books([b for b in books if b.get("col") == "turath" and not b.get("vf")], 2)},
        {"t": "الركن الأدبي", "corner": "adab", "items": adab_out},
    ]


def log(x, act):
    x["log"] = (x.get("log") or []) + [{"at": datetime.datetime.utcnow().isoformat() + "Z", "by": "الإصدار الآلي", "act": act}]
    x["log"] = x["log"][-200:]


def main():
    data = jl(P, None)
    if not data or "issues" not in data: print("لا بيانات للمجلة"); return
    plan = data.get("plan") or {}
    if not plan.get("auto"): print("الإصدار الآلي غير مفعّل (plan.auto)"); return
    t0, issues, changed, report = today(), data["issues"], False, []
    prep, grace = int(plan.get("prep", 7)), int(plan.get("grace", 2))
    up = sorted([x for x in issues if x.get("status") != "published" and x.get("pub")], key=lambda x: x["pub"])
    nxt = up[0] if up else None
    if not nxt:
        pubs = [pdate(x.get("pub") or x.get("date")) for x in issues if x.get("status") == "published"]
        due = next_pub(plan, max([p for p in pubs if p], default=None))
        if t0 >= due - datetime.timedelta(days=prep):
            used = {norm(x.get("theme") or "") for x in issues}
            q = [t for t in (plan.get("themes") or []) if t.strip()]
            theme = q.pop(0) if q else next((t for t in THEMES if norm(t) not in used), random.choice(THEMES))
            plan["themes"] = q
            nxt = {"id": "i" + format(int(datetime.datetime.utcnow().timestamp() * 1000), "x")[-9:], "no": max([x.get("no") or 0 for x in issues], default=0) + 1,
                   "date": due.isoformat(), "pub": due.isoformat(), "theme": theme, "title": theme, "status": "open", "intro": "", "secs": []}
            log(nxt, "فُتح العدد للمشاركات حتى %s بموضوع «%s»" % (due.isoformat(), theme))
            issues.append(nxt); changed = True
            report.append("📝 فُتح العدد %d «%s» للمشاركات؛ يصدر %s" % (nxt["no"], theme, due.isoformat()))
    if nxt and pdate(nxt.get("pub")) and t0 >= pdate(nxt["pub"]):
        cat, books, items = library()
        skip = {i.get("ref") for x in issues if x is not nxt for s in x.get("secs", []) for i in s.get("items", []) if i.get("ref")}
        skip |= {i.get("ref") for s in nxt.get("secs", []) for i in s.get("items", []) if i.get("ref")}
        manual = sum(len(s.get("items", [])) for s in nxt.get("secs", []))
        have = {norm(s.get("t", "")) for s in nxt.get("secs", []) if s.get("items")} | {s.get("corner") for s in nxt.get("secs", []) if s.get("items") and s.get("corner")}
        added = 0
        for s in draft(nxt.get("theme") or nxt.get("title") or "", skip, data, cat, books, items):
            if not s["items"] or norm(s["t"]) in have or (s.get("corner") and s["corner"] in have): continue
            ex = next((y for y in nxt["secs"] if norm(y.get("t", "")) == norm(s["t"])), None)
            if ex: ex["items"] += s["items"]
            else: nxt["secs"].append(s)
            added += len(s["items"])
        if not any(s.get("items") for s in nxt.get("secs", [])):
            report.append("⚠️ العدد %s: لم توجد مواد بموضوع «%s»؛ يبقى مفتوحًا حتى يُغيَّر موضوعه" % (nxt.get("no"), nxt.get("theme")))
        else:
            nxt["secs"] = [s for s in nxt["secs"] if s.get("items")]
            nxt["status"] = "published"; nxt["date"] = nxt["pub"]
            nxt["publishedAt"] = datetime.datetime.utcnow().isoformat() + "Z"
            nxt["edUntil"] = (pdate(nxt["pub"]) + datetime.timedelta(days=grace)).isoformat()
            log(nxt, "صدر آليًّا: %d مادة من الإدارة والمشاركات، و%d مادة استُكملت من المكتبة" % (manual, added))
            report.append("📖 صدر العدد %d «%s»: %d مادة يدوية + %d آلية؛ التعديل متاح حتى %s" % (nxt["no"], nxt.get("title"), manual, added, nxt["edUntil"]))
        changed = True
    if changed and not DRY:
        data["plan"] = plan
        json.dump(data, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(ROOT, ".maj-report.txt"), "w", encoding="utf-8").write("\n".join(report))
    print("\n".join(report) or "لا جديد: %s" % (("العدد القادم %s يصدر %s" % (nxt.get("no"), nxt.get("pub"))) if nxt else "لم يحن فتح العدد القادم"))


if __name__ == "__main__":
    main()
