#!/usr/bin/env python3
"""الركن الإخباري لمجلة المكتبة: أخبار مصر والمنطقة والعالم والمسلمين وحزب النور والدعوة السلفية
من مصادرها المعتمدة: آخر الأنباء، والموقع الرسمي لحزب النور، وبوابة الفتح.

لكل خبر: العنوان كاملًا، وموجز الخبر (الفقرة الأولى أو وصف المصدر، لا النص كاملًا)، والمصدر وتاريخه، ورابط الخبر الأصلي.
طرق الجلب بالترتيب لكل مصدر: واجهة ووردبريس (عنوان وموجز) ← خلاصة RSS ← خريطة الأخبار ← أخبار Google مقصورة على نطاق الموقع
(ويُفك رابط Google إلى رابط الخبر الحقيقي، ثم يُقرأ موجزه من صفحته).
التنظيف: حذف الصفحات التي ليست أخبارًا (صفحات النواب والكتّاب والأقسام)، وما مضى عليه أكثر من MAX_AGE يومًا، والمكرر بين المصادر.
اللقطة: لكل عدد منشور حديث (لم يمض على تاريخه SNAP_DAYS أيام) تُحفظ أحدث الأخبار في العدد نفسه (news)، فتبقى ثابتة بعد ذلك.
الاستعمال: python3 tools/majalla-news.py   (NEWS_DRY=1 للتجربة بلا حفظ، مع تقرير مفصل)"""
import json, re, html, time, os, sys, urllib.request, urllib.parse, datetime
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

OUT = "data/majalla-news.json"
MAJ = "data/majalla.json"
DRY = os.environ.get("NEWS_DRY") == "1"
MAX_AGE = int(os.environ.get("NEWS_MAX_AGE", "45"))      # أيام، للأخبار العامة
KEEP_AGE = 180                                           # أخبار حزب النور والدعوة السلفية (تصدر أقل) تبقى أطول
MAX_ITEMS = 300
FETCH_PAGES = int(os.environ.get("NEWS_FETCH", "70"))    # صفحات أخبار تُقرأ لاستخراج الموجز في الجولة
SNAP_DAYS = 10
SOURCES = [
    {"id": "akher", "name": "آخر الأنباء", "url": "https://akheralanbaa.com", "host": "akheralanbaa.com", "cat": "auto"},
    {"id": "nour", "name": "حزب النور", "url": "https://alnourpartyeg.com", "host": "alnourpartyeg.com", "cat": "nour"},
    {"id": "fath", "name": "بوابة الفتح", "url": "https://fath-news.com", "host": "fath-news.com", "cat": "auto"},
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; dawahlibrary-news/2.0; +https://dawahlibrary.org)", "Accept-Language": "ar,en;q=0.8"}
NOW = time.time()
LOG = []
def log(s):
    LOG.append(s); print(s, flush=True)

# ---------- التصنيف ----------
# الترتيب: الدعوة السلفية ← حزب النور ← المسلمون ← المنطقة ← العالم ← مصر (والمصادر مصرية فالأصل الشأن المصري)
DAWAH = re.compile(r"الدعوة السلفية|السلفيين|السلفية بمصر|برهامي|جمعية الدعاة|عبد المنعم الشحات|محمد إسماعيل المقدم|الشيخ أحمد فريد|نائب رئيس الدعوة|متحدث الدعوة")
NOUR = re.compile(r"حزب النور|نواب النور|النور بـ|أمانة النور|مخيون|نائب (?:حزب )?النور|\"النور\"|«النور»")
MUSLIM = re.compile(r"المسلمين|المسلمون|الإسلامية|الإسلامي|العالم الإسلامي|الأقصى|القدس|غزة|فلسطين|الفلسطيني|الضفة|الروهينجا|الإيغور|كشمير|مسلمي|الحج|العمرة|منظمة التعاون الإسلامي")
EGYPT = re.compile(r"مصر|المصري|المصرية|القاهرة|الجيزة|الإسكندرية|محافظ|محافظة|الجنيه|السيسي|مدبولي|مجلس النواب|مجلس الشيوخ|البرلمان المصري|وزير(?:ة)? (?:التموين|التعليم|الصحة|الأوقاف|الكهرباء|الإسكان|الزراعة|الري|النقل|المالية|العمل|التضامن)|وزارة (?:التموين|التعليم|الصحة|الكهرباء|الإسكان|الزراعة|الري|النقل|المالية|العمل|التضامن)|قناة السويس|الضبعة|البحيرة|الدقهلية|الشرقية|المنوفية|الغربية|القليوبية|كفر الشيخ|دمياط|بورسعيد|الإسماعيلية|السويس|الفيوم|بني سويف|المنيا|أسيوط|سوهاج|قنا|الأقصر|أسوان|مطروح|سيناء|الأرصاد|الثانوية العامة|جنيه|الحكومة|متحدث الحكومة|رئيس الوزراء")
WORLD = re.compile(r"ترامب|أمريكا|الأمريكي|الأمريكية|واشنطن|البيت الأبيض|الكونجرس|روسيا|موسكو|بوتين|أوكرانيا|الصين|بكين|أوروبا|الأوروبي|الناتو|بريطانيا|لندن|فرنسا|ألمانيا|اليابان|الهند|الأمم المتحدة|مجلس الأمن|العالمي|عالميًا|البورصات العالمية")
REGION = re.compile(r"السعودية|الرياض|الإمارات|الكويت|قطر|البحرين|عمان|الخليج|إيران|طهران|العراق|بغداد|سوريا|سورية|دمشق|لبنان|بيروت|الأردن|ليبيا|تونس|الجزائر|المغرب|اليمن|الحوثي|السودان|الدعم السريع|إثيوبيا|الصومال|تركيا|أنقرة|إسرائيل|الاحتلال|نتنياهو|الكنيست|الجامعة العربية|الشرق الأوسط")
CATS = [("dawah", DAWAH), ("nour", NOUR), ("muslims", MUSLIM), ("region", REGION), ("world", WORLD), ("egypt", EGYPT)]

def cat(s, t):
    for k, re_ in CATS:
        if k == "nour" and s["cat"] == "nour": return "nour"
        if re_.search(t): return k
    return "nour" if s["cat"] == "nour" else "egypt"   # مصادر مصرية: ما لا علامة فيه فهو من الشأن المصري

# ---------- أدوات ----------
def get(u, t=25, data=None, headers=None):
    h = dict(UA); h.update(headers or {})
    u = urllib.parse.quote(u, safe=":/?&=%#+,;@!$'()*~")   # روابط بحروف عربية
    r = urllib.request.urlopen(urllib.request.Request(u, data=data, headers=h), timeout=t)
    raw = r.read(); cs = r.headers.get_content_charset() or "utf-8"
    return raw.decode(cs, "replace"), r.geturl()

def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = s.replace("‏", "").replace("‎", "")
    return re.sub(r"\s+", " ", s).strip()

def iso(d):
    if not d: return ""
    try: return parsedate_to_datetime(d).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception: pass
    try:
        x = datetime.datetime.fromisoformat(d.replace("Z", "+00:00"))
        if not x.tzinfo: x = x.replace(tzinfo=datetime.timezone.utc)
        return x.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception: return ""

def age_days(d):
    try: return (NOW - datetime.datetime.fromisoformat(d.replace("Z", "+00:00")).timestamp()) / 86400
    except Exception: return 0

def brief(s, n=420):
    """موجز الخبر: أول جملة أو جملتين دون تجاوز n حرفًا، ويُقطع عند نهاية جملة لا وسط كلمة."""
    s = clean(s)
    s = re.sub(r"^(?:[^\s]{2,30}\s?[-–:|]\s?)?(?:كتب|كتبت|متابعة|خاص|القاهرة|وكالات)\s?[-–:|][^.،]{0,40}[-–:|]\s?", "", s)  # «كتب: فلان -»
    if len(s) <= n: return s
    cut = s[:n]
    m = max(cut.rfind("."), cut.rfind("؛"), cut.rfind("!"), cut.rfind("؟"))
    if m > n * 0.5: return cut[:m + 1]
    return cut[:cut.rfind(" ")].rstrip("،,:؛ ") + "…"

def tkey(t):
    return re.sub(r"[^\w]", "", re.sub(r"[إأآا]", "ا", t)).replace("ة", "ه").replace("ى", "ي")

STOP = set("في من على إلى عن مع بعد قبل خلال حول بين أن إن التي الذي الذين هذا هذه ذلك تلك و أو ثم كما لا ما لم لن قد هو هي".split())
def words(t):
    t = re.sub(r"[إأآ]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    return {w[2:] if w.startswith("ال") and len(w) > 4 else w for w in re.findall(r"[\w]+", t) if w not in STOP and len(w) > 2}

def similar(a, b):
    A, B = words(a), words(b)
    if not A or not B: return False
    return len(A & B) / min(len(A), len(B)) >= 0.7 and len(A & B) >= 4

# الصفحات التي ليست أخبارًا: صفحات النواب والكتّاب والأقسام والبرامج
JUNK = re.compile(r"^(?:النائب|الكاتب|المحرر|المهندس|الدكتور|الشيخ)\s?«?[^\s]+(?:\s[^\s]+){0,3}$|^(?:حزب النور\s?-\s?الموقع الرسمي|برنامج الحزب|تفاعلي النور|انجازات نواب النور|إنجازات نواب النور|من نحن|اتصل بنا|الرئيسية|أرشيف|الأخبار|مقالات)$|^[^\s]+\s?\|\s?[^\s]+$")
def max_age(s, t):
    return KEEP_AGE if s["cat"] == "nour" or DAWAH.search(t) or NOUR.search(t) else MAX_AGE

def is_news(title):
    t = title.strip()
    if len(t) < 22 or len(t.split()) < 4: return False
    if JUNK.search(t): return False
    return True

def strip_site(t, s):
    t = re.sub(r"\s+[-–|]\s+(?:%s|[^-–|]{2,30})$" % re.escape(s["name"]), "", t).strip()
    return re.sub(r"^عاجل\s?\|\s?", "عاجل: ", t)

# ---------- طرق الجلب ----------
def via_wp(s):
    x, _ = get(s["url"] + "/wp-json/wp/v2/posts?per_page=40&_fields=link,date_gmt,title,excerpt")
    L = json.loads(x)
    return [{"title": clean(p["title"]["rendered"]), "url": p["link"], "date": iso((p.get("date_gmt") or "") + "Z"), "sum": brief(p.get("excerpt", {}).get("rendered", ""))} for p in L if isinstance(p, dict)]

def rss_items(xml):
    root = ET.fromstring(xml.encode("utf-8"))
    out = []
    for it in root.iter("item"):
        g = lambda k: (it.findtext(k) or "").strip()
        desc = g("description") or g("{http://purl.org/rss/1.0/modules/content/}encoded")
        out.append({"title": clean(g("title")), "url": g("link"), "date": iso(g("pubDate")), "sum": brief(desc)})
    return out

def via_rss(s):
    for path in ("/feed", "/rss", "/rss.xml", "/feed.xml", "/ar/rss", "/index.php/feed", "/feed/"):
        try:
            x, _ = get(s["url"] + path)
            if "<rss" in x[:800] or "<item>" in x:
                L = rss_items(x)
                if L: return L
        except Exception: pass
    raise RuntimeError("لا خلاصة")

def via_sitemap(s):
    for path in ("/news-sitemap.xml", "/sitemap-news.xml", "/sitemap_news.xml"):
        try:
            x, _ = get(s["url"] + path)
            if "<urlset" not in x: continue
            root = ET.fromstring(x.encode("utf-8")); out = []
            for u in root:
                loc = date = title = ""
                for e in u.iter():
                    tag = e.tag.split("}")[-1]
                    if tag == "loc" and not loc: loc = (e.text or "").strip()
                    elif tag == "publication_date": date = iso((e.text or "").strip())
                    elif tag == "title": title = clean(e.text)
                if loc and title: out.append({"title": title, "url": loc, "date": date, "sum": ""})
            if out: return out[:60]
        except Exception: pass
    raise RuntimeError("لا خريطة أخبار")

def via_html(s):
    """روابط الأخبار من الصفحة الرئيسة وأقسام الأخبار: <a href=".../ar/123456-…">عنوان</a> (إن سمح الموقع بالطلب)"""
    out, seen = [], set()
    for path in ("/", "/ar", "/ar/category/news", "/ar/news"):
        try: page, _ = get(s["url"] + path, t=20)
        except Exception: continue
        for href, txt in re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', page, re.S | re.I):
            t = clean(txt)
            if not re.search(r"/ar/\d{3,}[-/]|/news/\d{3,}", href) or len(t) < 22: continue
            u = urllib.parse.urljoin(s["url"] + "/", href).split("#")[0]
            if u in seen: continue
            seen.add(u); out.append({"title": t, "url": u, "date": "", "sum": ""})
    if not out: raise RuntimeError("لا روابط أخبار")
    return out[:50]

def bing_snips(s):
    """موجزات أخبار المصدر من خلاصة أخبار Bing العامة (وصف لكل خبر)، لإكمال الموجز حين لا تُتاح صفحة الخبر."""
    q = urllib.parse.quote(f"site:{s['host']}")
    x = ""
    for fmt in ("RSS", "rss"):
        try:
            x, _ = get(f"https://www.bing.com/news/search?q={q}&format={fmt}&setlang=ar&cc=EG")
            if "<rss" in x[:500]: break
        except Exception: x = ""
    if "<rss" not in x[:500]: raise RuntimeError("لا خلاصة Bing")
    out = []
    for z in rss_items(x):
        m = re.search(r"[?&]url=([^&]+)", z["url"])
        if m: z["url"] = urllib.parse.unquote(m.group(1))
        z["title"] = strip_site(z["title"], s)
        out.append(z)
    return out

def via_gnews(s):
    # أحدث أخبار المصدر، ثم أخبار حزب النور والدعوة السلفية فيه (تصدر أقل فتُطلب مدة أطول)
    qs = [f"site:{s['host']} when:30d"] + ([] if s["cat"] == "nour" else [f'site:{s["host"]} "حزب النور"', f'site:{s["host"]} "الدعوة السلفية"'])
    out, seen = [], set()
    for q in qs:
        try: x, _ = get("https://news.google.com/rss/search?q=" + urllib.parse.quote(q) + "&hl=ar&gl=EG&ceid=EG:ar")
        except Exception: continue
        for z in rss_items(x):
            z["title"] = strip_site(z["title"], s); z["sum"] = ""; z["gn"] = 1
            if z["url"] in seen: continue
            seen.add(z["url"]); out.append(z)
    if not out: raise RuntimeError("لا نتائج")
    return out

def gn_decode(u):
    """فك رابط أخبار Google (news.google.com/rss/articles/…) إلى رابط الخبر في موقعه."""
    m = re.search(r"/articles/([^?/]+)", u)
    if not m: return u
    gid = m.group(1)
    page, _ = get(f"https://news.google.com/articles/{gid}?hl=ar&gl=EG&ceid=EG:ar", t=20)
    sg = re.search(r'data-n-a-sg="([^"]+)"', page); ts = re.search(r'data-n-a-ts="([^"]+)"', page)
    if not (sg and ts): return u
    req = [[["Fbv4je", json.dumps(["garturlreq", [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1, None, None, None, None, None, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0], gid, int(ts.group(1)), sg.group(1)]), None, "generic"]]]
    body = urllib.parse.urlencode({"f.req": json.dumps(req)}).encode()
    x, _ = get("https://news.google.com/_/DotsSplashUi/data/batchexecute", t=20, data=body, headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"})
    part = json.loads(x.split("\n\n", 1)[1])[:-2]
    real = json.loads(part[0][2])[1]
    return real if real.startswith("http") else u

def meta(page, *names):
    for n in names:
        m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]+content=["\']([^"\']+)' % re.escape(n), page, re.I) or \
            re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']%s["\']' % re.escape(n), page, re.I)
        if m: return clean(m.group(1))
    return ""

def enrich(z, s):
    """يكمّل الخبر من صفحته: الرابط الحقيقي، والعنوان الكامل، والموجز، والتاريخ."""
    if "news.google.com" in z["url"]:
        z["url"] = gn_decode(z["url"])
    page, final = get(z["url"], t=20)
    if s["host"] in final: z["url"] = final.split("#")[0]
    t = meta(page, "og:title", "twitter:title")
    if t:
        t = strip_site(t, s)
        if len(t) > len(z["title"]) and (z["title"].rstrip("… .")[:20] in t or similar(t, z["title"])): z["title"] = t
    d = meta(page, "og:description", "description", "twitter:description")
    if not d or similar(d, z["title"]) and len(d) < len(z["title"]) + 30:
        # الفقرة الأولى من متن الخبر
        for p in re.findall(r"<p[^>]*>(.*?)</p>", page, re.S | re.I):
            p = clean(p)
            if len(p) > 80 and not similar(p, z["title"]): d = p; break
    if d and not similar(d, z["title"]) or (d and len(d) > len(z["title"]) + 40): z["sum"] = brief(d)
    if not z.get("date"):
        z["date"] = iso(meta(page, "article:published_time", "og:updated_time", "date", "pubdate"))
    if not z.get("date"):
        m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', page) or re.search(r'<time[^>]+datetime="([^"]+)"', page)
        if m: z["date"] = iso(m.group(1))
    return z

# ---------- الجولة ----------
def main():
    old = {}
    try: old = json.load(open(OUT, encoding="utf-8"))
    except Exception: pass
    S = {s["id"]: s for s in SOURCES}
    # تنظيف المحفوظ بالقواعد الحالية
    items = []
    for x in old.get("items", []):
        if x.get("sid") not in S or not is_news(x["title"]) or age_days(x.get("date", "")) > max_age(S[x["sid"]], x["title"]): continue
        items.append(x)
    dropped = len(old.get("items", [])) - len(items)
    rep = []
    budget = FETCH_PAGES
    for s in SOURCES:
        got, how = [], ""
        for name, fn in (("wp", via_wp), ("rss", via_rss), ("sitemap", via_sitemap), ("html", via_html), ("gnews", via_gnews)):
            try:
                got = [z for z in fn(s) if z.get("title") and z.get("url")]
                if got: how = name; break
            except Exception as e:
                if DRY: log(f"  {s['name']} [{name}]: {str(e)[:90]}")
        n = n_sum = 0
        for z in got[:70]:
            z["title"] = strip_site(z["title"], s)
            if not is_news(z["title"]) or age_days(z.get("date", "")) > max_age(s, z["title"]): continue
            if any(x["url"] == z["url"] or tkey(x["title"]) == tkey(z["title"]) for x in items): continue
            if (not z.get("sum") or z.get("gn")) and budget > 0:
                budget -= 1
                try: enrich(z, s)
                except Exception as e:
                    if DRY: log(f"  تعذر إكمال «{z['title'][:40]}»: {str(e)[:80]}")
            if any(x["url"] == z["url"] for x in items): continue
            if how == "html" and not z.get("date"):   # بلا تاريخ نشر: لا يُعرض خبرًا قديمًا على أنه جديد
                if DRY: log(f"  بلا تاريخ: {z['title'][:60]}")
                continue
            if age_days(z.get("date", "")) > max_age(s, z["title"]):
                if DRY: log(f"  قديم ({z['date'][:10]}): {z['title'][:60]}")
                continue
            n += 1; n_sum += 1 if z.get("sum") else 0
            items.append({"title": z["title"], "url": z["url"], "date": z.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sum": z.get("sum", ""), "src": s["name"], "sid": s["id"], "cat": ""})
        rep.append(f"{s['name']}: {n} جديد ({how or 'تعذر'})، بموجز {n_sum}")
    # موجزات Bing لما بقي بلا موجز
    for s in SOURCES:
        try: B = bing_snips(s)
        except Exception as e:
            if DRY: log(f"  Bing {s['name']}: {str(e)[:80]}")
            continue
        k = 0
        for x in items:
            if x["sid"] != s["id"] or x.get("sum"): continue
            b = next((b for b in B if b["url"] == x["url"] or similar(b["title"], x["title"])), None)
            if b and b.get("sum") and not similar(b["sum"], x["title"]):
                x["sum"] = brief(b["sum"]); x.pop("nosum", None); k += 1
        # المصدر الذي لم يُجلب منه شيء: أخباره من الخلاصة نفسها
        if not any(x["sid"] == s["id"] and age_days(x.get("date", "")) < 3 for x in items):
            for b in B[:30]:
                if is_news(b["title"]) and age_days(b.get("date", "")) <= max_age(s, b["title"]) and not any(b["url"] == x["url"] or similar(b["title"], x["title"]) for x in items):
                    items.append({"title": b["title"], "url": b["url"], "date": b.get("date") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sum": brief(b.get("sum", "")), "src": s["name"], "sid": s["id"], "cat": ""}); k += 1
        if DRY: log(f"  Bing {s['name']}: {len(B)} خبرًا، أُكمل أو أُضيف منها {k}")
    # إكمال موجز المحفوظ الذي بلا موجز (بقية الحصة)
    for x in sorted(items, key=lambda y: y.get("date", ""), reverse=True):
        if budget <= 0: break
        if x.get("sum") or x.get("nosum"): continue
        budget -= 1
        try: enrich(x, S[x["sid"]])
        except Exception: pass
        if not x.get("sum"): x["nosum"] = 1
    # إزالة المكرر بين المصادر: يبقى الأقدم (السابق بالخبر)، ويُضم موجز الآخر إن خلا منه
    items.sort(key=lambda y: y.get("date", ""))
    uniq = []
    for x in items:
        d = next((u for u in uniq if similar(u["title"], x["title"]) and abs(age_days(u.get("date", "")) - age_days(x.get("date", ""))) < 3), None)
        if d:
            if not d.get("sum") and x.get("sum"): d["sum"] = x["sum"]
            d.setdefault("also", [])
            if x["src"] != d["src"] and not any(a["src"] == x["src"] for a in d["also"]): d["also"].append({"src": x["src"], "url": x["url"]})
            continue
        uniq.append(x)
    # وصف عام للموقع يتكرر في كل صفحاته ليس موجزًا للخبر
    from collections import Counter
    gen = Counter((x["sid"], x.get("sum")) for x in uniq if x.get("sum"))
    for x in uniq:
        if x.get("sum") and gen[(x["sid"], x["sum"])] > 1 or re.match(r"^حزب سياسي مصر", x.get("sum") or ""): x["sum"] = ""
    for x in uniq: x["cat"] = cat(S[x["sid"]], x["title"] + " " + (x.get("sum") or ""))
    L = sorted(uniq, key=lambda x: x.get("date", ""), reverse=True)[:MAX_ITEMS]
    for x in L: x.pop("top", None)
    for c in ("dawah", "nour", "muslims", "egypt", "region", "world"):
        for x in [y for y in L if y["cat"] == c and y.get("sum")][:1] or [y for y in L if y["cat"] == c][:1]: x["top"] = 1
    from collections import Counter
    cc = Counter(x["cat"] for x in L)
    out = {"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sources": [{"name": s["name"], "url": s["url"]} for s in SOURCES], "items": L}
    log("الركن الإخباري: " + "؛ ".join(rep) + f"؛ حُذف {dropped} قديم أو ليس خبرًا؛ المكرر المدموج {len(items) - len(uniq)}؛ الأقسام: " + "، ".join(f"{k} {v}" for k, v in cc.items()) + f"؛ بموجز {sum(1 for x in L if x.get('sum'))} من {len(L)}")
    if DRY:
        for c in ("dawah", "nour", "muslims", "egypt", "region", "world"):
            for x in [y for y in L if y["cat"] == c][:3]: log(f"  <{c}> {x['date'][:10]} {x['src']}: {x['title'][:70]} | {(x.get('sum') or '')[:90]}")
        for x in L[:0]: log(f"  [{x['cat']}] {x['date'][:10]} {x['src']}: {x['title'][:80]} | {(x.get('sum') or '')[:80]} | {x['url'][:70]}")
        return
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    snapshot(L)

def snapshot(L):
    """لقطة أخبار العدد: أحدث الأخبار حتى تاريخ صدوره (وتتجدد ما دام العدد حديثًا)، ثم تبقى ثابتة في العدد."""
    try: D = json.load(open(MAJ, encoding="utf-8"))
    except Exception: return
    ch = False
    for x in D.get("issues", []):
        if not any(s.get("live") == "news" for s in x.get("secs", [])): continue
        try: d0 = datetime.datetime.fromisoformat(x["date"]).replace(tzinfo=datetime.timezone.utc).timestamp()
        except Exception: continue
        if NOW - d0 > SNAP_DAYS * 86400 and x.get("news"): continue   # عدد قديم: لقطته ثابتة
        until = d0 + 7 * 86400; since = d0 - 35 * 86400
        pick = []
        for c in ("dawah", "nour", "muslims", "egypt", "region", "world"):
            C = [y for y in L if y["cat"] == c and since <= datetime.datetime.fromisoformat(y["date"].replace("Z", "+00:00")).timestamp() <= until]
            C.sort(key=lambda y: (1 if y.get("sum") else 0, y["date"]), reverse=True)
            pick += C[:4 if c in ("dawah", "nour") else 3]
        snap = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "items": [{k: y[k] for k in ("title", "url", "date", "sum", "src", "cat") if y.get(k)} for y in pick]}
        if pick and [i["url"] for i in snap["items"]] != [i["url"] for i in (x.get("news") or {}).get("items", [])]:
            x["news"] = snap; ch = True
    if ch:
        json.dump(D, open(MAJ, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        log("حُدّثت لقطة أخبار العدد في data/majalla.json")

if __name__ == "__main__":
    main()
