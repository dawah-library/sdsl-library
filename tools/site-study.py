#!/usr/bin/env python3
"""التحديث الآلي لدراسة الموقع (#/sitestudy).

يقيس حالة الموقع الآن من المستودع (الفهرس، ومؤشر التجهيز، وملفات الواجهة، وrobots.txt، وخطة التدشين…)،
ثم يعيد كتابة الأجزاء المعلَّمة بـ <!--AUTO:x--> في data/site-study.html:
  meta (تاريخ التحديث والإصدار)، verdict (الحكم العام)، numbers (الأرقام)، scores (التقييم)، changes (ما تغيّر ومؤشرات المتابعة).
ويحفظ لقطة يومية في data/site-study-history.json، ويعلّم بنود خطة التدشين التي رُصد إنجازها (data/launch-plan.json).
التقديرات اليدوية للمحاور غير القابلة للقياس الآلي في data/site-study-base.json (يعدّلها المدير أو الوكيل).
الاستخدام: python3 tools/site-study.py [--dry]
"""
import json, os, re, sys, glob, datetime, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
STUDY, HIST, BASE, PLAN = "data/site-study.html", "data/site-study-history.json", "data/site-study-base.json", "data/launch-plan.json"
AR = "٠١٢٣٤٥٦٧٨٩"
MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]


def ar(x):
    return str(x).replace(".", "٫").translate(str.maketrans("0123456789", AR))


def num(n):  # فواصل الآلاف بلا فاصلة لتبقى كما في الدراسة
    return ar(n)


def rd(p, d=None):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def txt(p):
    try:
        return open(p, encoding="utf-8").read()
    except Exception:
        return ""


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def clamp(x, a=1.0, b=10.0):
    return round(max(a, min(b, x)), 1)


# ———— القياس ————
def measure():
    m = {}
    cat = rd("data/catalog.json", {}) or {}
    books = [b for b in cat.get("books", []) if not b.get("demo")]
    m["books"] = len(books)
    m["dawah"] = sum(1 for b in books if b.get("col") == "dawah")
    m["turath"] = sum(1 for b in books if b.get("col") == "turath")
    m["authors"] = len(cat.get("authors", []))
    m["topics"] = len(cat.get("topics", []))
    m["pdf"] = sum(1 for b in books if b.get("pdf"))
    m["card"] = sum(1 for b in books if b.get("card"))
    m["tash"] = sum(1 for b in books if b.get("tash"))
    m["lite"] = sum(1 for b in books if b.get("lite"))
    m["unrev"] = sum(1 for b in books if b.get("unrev"))
    pr = rd("data/progress.json", {}) or {}
    m["pending"] = int(pr.get("pending_pages") or 0)
    pb = list((pr.get("books") or {}).values())
    m["prep_avg"] = round(sum(x.get("pct", 0) for x in pb) / len(pb), 1) if pb else 0
    m["prep_done"] = sum(1 for x in pb if x.get("pct", 0) >= 95)
    m["prep_n"] = len(pb)
    idx = txt("index.html")
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', idx)
    m["scripts"] = len(scripts)
    m["deferred"] = len(re.findall(r'<script[^>]+(?:defer|async|type="module")', idx))
    js = 0
    for s in scripts:
        f = s.split("?")[0].lstrip("/")
        if os.path.exists(f):
            js += os.path.getsize(f)
    m["js_kb"] = round(js / 1024)
    m["app_kb"] = round(os.path.getsize("app.js") / 1024) if os.path.exists("app.js") else 0
    fams = set()
    for href in re.findall(r'href="https://fonts\.googleapis\.com/css2\?([^"]+)"', idx):
        fams.update(re.findall(r"family=([^:&]+)", href))
    m["fonts"] = len(fams)
    about = txt("about.js")
    sec = about[about.find("const ABOUT_SECS"):about.find("];\n", about.find("const ABOUT_SECS"))]
    m["services"] = len(re.findall(r'^\s{4}\["[^"]{2,60}", "', sec, re.M))
    rob = txt("robots.txt")
    m["seo_internal"] = not re.search(r"^Disallow:\s*/book/\*/\s*$", rob, re.M)
    m["ai_bots_blocked"] = bool(re.search(r"GPTBot|Google-Extended", rob))
    m["opensearch"] = os.path.exists("opensearch.xml") and "opensearchdescription" in idx
    m["hreflang"] = "hreflang" in idx or "hreflang" in txt("api/page.js")
    m["jsonld"] = "schema.org" in txt("api/page.js")
    m["sitemap"] = os.path.exists("api/sitemap.js")
    m["terms"] = any(os.path.exists(p) for p in ("terms.html", "data/terms.json")) or "#/terms" in txt("app.js")
    m["cite"] = "const CITE=" in txt("app.js")
    m["doors"] = 'data-hs="start"' in txt("app.js")
    m["server_search"] = os.path.exists("api/search.js") or os.path.isdir("data/search-index")
    m["workflows"] = len(glob.glob(".github/workflows/*.yml"))
    m["api"] = len(glob.glob("api/*.js"))
    sw = re.search(r'const V="([^"]+)"', txt("sw.js"))
    m["sw"] = sw.group(1) if sw else ""
    plan = rd(PLAN, {"items": []}) or {"items": []}
    m["plan_done"] = sum(1 for x in plan["items"] if x.get("st") == "done")
    m["plan_n"] = len(plan["items"])
    manual = (rd(BASE, {}) or {}).get("flags", {})
    m["search_console"] = bool(manual.get("search_console"))
    return m


# ———— التقييم ————
AXES = [  # المفتاح، الاسم، آلي؟
    ("tools", "أدوات خدمة النص والتعلم", 0), ("security", "الأمان والحماية", 0), ("reader", "تجربة القراءة", 0),
    ("auto", "الأتمتة والتشغيل", 0), ("design", "الهوية والتصميم", 0), ("community", "المجتمع والتفاعل", 0),
    ("search", "البحث", 1), ("content", "حجم المحتوى وتغطيته", 1), ("reliab", "الموثوقية العلمية للنص", 1),
    ("arch", "البنية والاستدامة", 0), ("seo", "الظهور في محركات البحث", 1), ("perf", "الأداء والسرعة", 1)]


def score(m, base):
    b = base.get("scores", {})
    s = {k: float(b.get(k, 6)) for k, _, _ in AXES}
    s["content"] = clamp(2 + min(4.5, m["dawah"] * 0.03) + min(3.5, m["books"] / 1000))
    s["reliab"] = clamp(2.5 + 7 * m["prep_avg"] / 100 - min(1.5, m["pending"] / 20000))
    s["perf"] = clamp(10 - max(0, m["scripts"] - m["deferred"] - 10) * 0.06 - max(0, m["js_kb"] / 1024 - 0.4) * 1.2 - max(0, m["fonts"] - 2) * 0.25)
    s["seo"] = clamp(3 + (3 if m["seo_internal"] else 0) + (0.5 if m["opensearch"] else 0) + (1 if m["search_console"] else 0)
                     + (0.5 if m["hreflang"] else 0) + (1 if m["sitemap"] else 0) + (0.5 if m["jsonld"] else 0))
    s["search"] = clamp(float(b.get("search", 6)) + (2 if m["server_search"] else 0))
    overall = round(sum(s.values()) / len(s), 1)
    return s, overall


def verdict(o):
    if o < 6.5:
        return "غير جاهز بعدُ للإعلان العام؛ الأولوية لاستكمال الأساس."
    if o < 7.5:
        return "جاهز لإطلاق تجريبي محدود، وغير جاهز بعدُ لإعلان تدشين عام واسع."
    if o < 8.5:
        return "جاهز لإعلان التدشين مع متابعة النواقص المتبقية."
    return "جاهز للتدشين العام بمستوى ينافس المكتبات العالمية."


# ———— مؤشرات المتابعة (الهدف قبل الإعلان) ————
def tracks(m):
    T = [
        ("صفحات تنتظر المراجعة", num(m["pending"]), "صفر في حزمة التدشين", m["pending"] == 0, m["pending"] < 3000),
        ("متوسط تجهيز كتب الدعوة", ar(m["prep_avg"]) + "٪", "٩٠٪ فأكثر", m["prep_avg"] >= 90, m["prep_avg"] >= 70),
        ("كتب الدعوة المكتملة (٩٥٪+)", f'{num(m["prep_done"])} من {num(m["prep_n"])}', "كلها", m["prep_n"] and m["prep_done"] == m["prep_n"], m["prep_done"] >= m["prep_n"] / 2),
        ("ملفات JavaScript في الصفحة الأولى", num(m["scripts"] - m["deferred"]), "١٥ أو أقل", m["scripts"] - m["deferred"] <= 15, m["scripts"] - m["deferred"] <= 30),
        ("حجم شيفرة الواجهة", num(m["js_kb"]) + " ك.ب", "٨٠٠ ك.ب أو أقل", m["js_kb"] <= 800, m["js_kb"] <= 1400),
        ("عائلات الخطوط", num(m["fonts"]), "٢–٣", m["fonts"] <= 3, m["fonts"] <= 4),
        ("فهرسة صفحات الكتب الداخلية", "مسموحة" if m["seo_internal"] else "ممنوعة", "مسموحة للمعتمد", m["seo_internal"], False),
        ("Google Search Console", "مفعّلة" if m["search_console"] else "غير مفعّلة", "مفعّلة", m["search_console"], False),
        ("بحث شامل على الخادم", "قائم" if m["server_search"] else "غير قائم", "قائم", m["server_search"], False),
        ("شروط الاستخدام وسياسة الحقوق", "قائمة" if m["terms"] else "غير قائمة", "قائمة", m["terms"], False),
        ("توثيق المرجع بالصيغ المعيارية", "قائم" if m["cite"] else "غير قائم", "قائم", m["cite"], False),
        ("خطة التدشين", f'{num(m["plan_done"])} من {num(m["plan_n"])}', "كلها", m["plan_n"] and m["plan_done"] == m["plan_n"], m["plan_done"] >= m["plan_n"] / 2),
    ]
    return T


# ———— تعليم بنود الخطة المرصودة آليًّا ————
def plan_auto(m, dry):
    P = rd(PLAN)
    if not P:
        return []
    rules = {"t1": m["scripts"] - m["deferred"] <= 15 and m["js_kb"] <= 800, "t2": m["server_search"], "t3": m["seo_internal"],
             "t5": m["cite"], "t6": m["doors"], "t7": m["opensearch"], "p3": m["search_console"], "p6": m["terms"]}
    done = []
    for x in P.get("items", []):
        if rules.get(x.get("id")) and x.get("st") != "done":
            x["st"] = "done"
            x["note"] = ((x.get("note") or "") + " · رُصد إنجازه آليًّا").strip(" ·")
            done.append(x["t"])
    if done and not dry:
        P["upd"] = datetime.date.today().isoformat()
        json.dump(P, open(PLAN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return done


# ———— التوليد ————
def bar(v):
    c = "" if v >= 6.5 else (' class="w"' if v >= 5 else ' class="b"')
    return f'<div class="score"><span>{{n}}</span><div class="bar"><i{c} style="width:{round(v * 10)}%"></i></div><em>{ar(f"{v:.1f}")}</em></div>'


def build(m, s, o, prev, newly, today):
    d = datetime.date.fromisoformat(today)
    dstr = f"{ar(d.day)} {MONTHS[d.month - 1]} {ar(d.year)}"
    B = {}
    B["meta"] = (f'<div class="meta"><span>الدراسة الأصلية: ١٤ نوفمبر ٢٠٢٦</span><span>آخر تحديث آلي: {dstr}</span>'
                 f'<span>النطاق: dawahlibrary.org ومستودع sdsl-library</span><span>إصدار عامل الخدمة: {esc(m["sw"])}</span></div>')
    B["verdict"] = (f'<div class="verdict">\n  <strong class="big">التقييم العام: {ar(f"{o:.1f}")} من ١٠. {verdict(o)}</strong>\n'
                    '  الموقع يتفوق على أغلب المكتبات العربية في <b>أدوات خدمة النص</b> (التشجير، الاختبارات، الكراسات، التشكيل، الحواشي، التخريج، الحفظ، المصحف والحديث، المساعد العلمي، العمل دون إنترنت)، وفي <b>الأمان</b> و<b>الأتمتة</b>. '
                    'والتقييم يُحدَّث آليًّا من حالة الموقع؛ فانظر «التحديث الآلي» لما تغيّر ولمؤشرات المتابعة وأهدافها قبل الإعلان.\n</div>')
    tiles = [(num(m["books"]), "كتابًا في الفهرس"), (num(m["dawah"]), "كتابًا لمشايخ الدعوة"), (num(m["turath"]), "كتابًا في المكتبة العامة (التراث)"),
             (num(m["authors"]), f'مؤلفًا · {num(m["topics"])} موضوعًا'), (num(m["pending"]), "صفحة تنتظر المراجعة"),
             ("~" + num(m["services"]), "خدمة معرَّفة في صفحة التعريف"), (num(m["scripts"]), "ملف JavaScript في الصفحة الأولى"),
             (num(m["js_kb"]), "ك.ب شيفرة الواجهة قبل الضغط")]
    B["numbers"] = ('<div class="stats">\n' + "\n".join(f'  <div class="stat"><b>{a}</b><span>{b}</span></div>' for a, b in tiles) + "\n</div>\n"
                    f'<p class="legend">من الكتب: {num(m["pdf"])} مربوطة بمصوراتها (PDF)، و{num(m["card"])} لها بطاقة تعريف، و{num(m["tash"])} مشكولة تشكيلًا مدققًا، '
                    f'و{num(m["lite"])} محوَّلة بالنموذج الخفيف، و{num(m["unrev"])} فيها صفحات لم تُراجَع. متوسط تجهيز كتب الدعوة {ar(m["prep_avg"])}٪. '
                    f'المهام الآلية: {num(m["workflows"])}، ودوال الخادم: {num(m["api"])}.</p>')
    names = {k: n for k, n, _ in AXES}
    auto = {k for k, _, a in AXES if a}
    order = sorted(s, key=lambda k: -s[k])
    B["scores"] = ('<div class="scores">\n' + "\n".join("  " + bar(s[k]).replace("{n}", names[k] + (" ⟳" if k in auto else "")) for k in order) + "\n</div>\n"
                   '<p class="legend">⟳ محور يُحسب آليًّا من حالة الموقع عند كل تحديث؛ وسائر المحاور تقدير ثابت يُعدَّل في <code>data/site-study-base.json</code>.</p>')
    # ما تغيّر
    rows = []
    if prev:
        pm, ps = prev.get("m", {}), prev.get("s", {})
        labels = [("books", "الكتب"), ("dawah", "كتب الدعوة"), ("pending", "صفحات تنتظر المراجعة"), ("prep_avg", "متوسط التجهيز ٪"),
                  ("scripts", "ملفات JS"), ("js_kb", "حجم الشيفرة ك.ب"), ("services", "الخدمات"), ("plan_done", "بنود الخطة المنجزة")]
        better_low = {"pending", "scripts", "js_kb"}
        for k, n in labels:
            a, b = pm.get(k), m.get(k)
            if a is None or a == b:
                continue
            good = (b < a) if k in better_low else (b > a)
            rows.append(f'<tr><td>{n}</td><td>{ar(a)}</td><td>{ar(b)}</td><td class="{"y" if good else "x"}">{"▲" if b > a else "▼"} {ar(round(abs(b - a), 1))}</td></tr>')
        po = prev.get("o")
        if po is not None and po != o:
            rows.insert(0, f'<tr><td><b>التقييم العام</b></td><td>{ar(po)}</td><td>{ar(o)}</td><td class="{"y" if o > po else "x"}">{"▲" if o > po else "▼"} {ar(round(abs(o - po), 1))}</td></tr>')
        for k in s:
            if ps.get(k) is not None and ps[k] != s[k]:
                rows.append(f'<tr><td>محور: {names[k]}</td><td>{ar(ps[k])}</td><td>{ar(s[k])}</td><td class="{"y" if s[k] > ps[k] else "x"}">{"▲" if s[k] > ps[k] else "▼"} {ar(round(abs(s[k] - ps[k]), 1))}</td></tr>')
    pd = prev.get("d") if prev else None
    ch = (f'<p>منذ لقطة {ar(pd)}:</p><div class="tbl"><table class="sm"><thead><tr><th>المؤشر</th><th>قبل</th><th>الآن</th><th>التغير</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>'
          if rows else ('<p class="legend">لا تغيّر في المؤشرات منذ لقطة ' + ar(pd) + '.</p>' if pd else '<p class="legend">هذه أول لقطة؛ تظهر المقارنة بدءًا من التحديث القادم.</p>'))
    if newly:
        ch += '<p><b>بنود في خطة التدشين رُصد إنجازها آليًّا:</b></p><ul>' + "".join(f"<li>{esc(t)}</li>" for t in newly) + "</ul>"
    tr = "".join(f'<tr><td>{n}</td><td>{v}</td><td>{g}</td><td class="{"y" if ok else ("p" if mid else "x")}">{"متحقق" if ok else ("قريب" if mid else "لم يتحقق")}</td></tr>'
                 for n, v, g, ok, mid in tracks(m))
    ch += f'<h3>مؤشرات المتابعة قبل الإعلان</h3><div class="tbl"><table class="sm"><thead><tr><th>المؤشر</th><th>الآن</th><th>الهدف</th><th>الحالة</th></tr></thead><tbody>{tr}</tbody></table></div>'
    ch += '<p class="legend">يُحدَّث هذا القسم والأرقام والتقييم آليًّا كل يوم وعند كل تغيير في الواجهة، ويدويًّا بزر «حدّث الدراسة الآن».</p>'
    B["changes"] = ch
    return B


def main():
    dry = "--dry" in sys.argv
    today = datetime.date.today().isoformat()
    base = rd(BASE, {}) or {}
    m = measure()
    newly = plan_auto(m, dry)
    if newly:
        m = measure()
    s, o = score(m, base)
    H = rd(HIST, {"items": []}) or {"items": []}
    items = [x for x in H.get("items", []) if x.get("d") != today]
    prev = items[-1] if items else None
    B = build(m, s, o, prev, newly, today)
    html = txt(STUDY)
    for k, v in B.items():
        html, n = re.subn(rf"<!--AUTO:{k}-->.*?<!--/AUTO:{k}-->", lambda _: f"<!--AUTO:{k}-->{v}<!--/AUTO:{k}-->", html, flags=re.S)
        if not n:
            print("تنبيه: لا علامة لـ", k)
    print(f"التقييم {o} · كتب {m['books']} · معلّق {m['pending']} · JS {m['scripts']}/{m['js_kb']}KB · خطة {m['plan_done']}/{m['plan_n']}")
    if dry:
        return
    open(STUDY, "w", encoding="utf-8").write(html)
    items.append({"d": today, "o": o, "s": s, "m": m})
    H["items"] = items[-400:]
    json.dump(H, open(HIST, "w", encoding="utf-8"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
