#!/usr/bin/env python3
"""الركن الإخباري لمجلة المكتبة (البند ٣٧): عناوين الأخبار وموجزاتها بروابط مصادرها، لا نصوصها كاملة.
المصادر: بوابة الفتح، آخر الأنباء، الموقع الرسمي لحزب النور. لكل مصدر: خلاصة RSS إن وُجدت، وإلا بحث أخبار Google
مقصورًا على نطاق الموقع (لأن بعضها يرفض الطلبات الآلية). الناتج data/majalla-news.json (آخر ٢٠٠ خبر)."""
import json, re, html, time, os, sys, urllib.request, urllib.parse
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

OUT = "data/majalla-news.json"
SOURCES = [
    {"id": "fath", "name": "بوابة الفتح", "url": "https://fath-news.com", "host": "fath-news.com", "cat": "dawah"},
    {"id": "akher", "name": "آخر الأنباء", "url": "https://akheralanbaa.com", "host": "akheralanbaa.com", "cat": "auto"},
    {"id": "nour", "name": "حزب النور", "url": "https://alnourpartyeg.com", "host": "alnourpartyeg.com", "cat": "nour"},
]
UA = {"User-Agent": "Mozilla/5.0 (compatible; dawahlibrary-news/1.0; +https://dawahlibrary.org)"}
MUSLIM = re.compile(r"المسلم|الإسلام|غزة|فلسطين|الأقصى|القدس|مسجد|المساجد|الروهينجا|السودان|سوريا|اليمن|الأزهر|الحج|العمرة|رمضان|الأوقاف|الدعوة|إسلامي")
NOUR = re.compile(r"حزب النور|النور|مخيون|نواب النور")
DAWAH = re.compile(r"الدعوة السلفية|برهامي|الدعاة|السلفي")

def get(u, t=25):
    r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t)
    return r.read().decode("utf-8", "replace")

def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()

def rss(xml):
    root = ET.fromstring(xml.encode("utf-8"))
    for it in root.iter("item"):
        g = lambda k: (it.findtext(k) or "").strip()
        d = g("pubDate")
        try: d = parsedate_to_datetime(d).strftime("%Y-%m-%dT%H:%M:%SZ") if d else ""
        except Exception: d = ""
        src = it.find("source")
        yield {"title": clean(g("title")), "url": g("link"), "date": d, "sum": clean(g("description"))[:220], "via": src.text if src is not None else ""}

def fetch(s):
    for path in ("/feed", "/rss", "/ar/rss", "/feed/"):
        try:
            x = get(s["url"] + path)
            if "<rss" in x[:500] or "<item>" in x:
                L = list(rss(x))
                if L: return L, "rss"
        except Exception: pass
    q = urllib.parse.quote(f"site:{s['host']}")
    x = get(f"https://news.google.com/rss/search?q={q}&hl=ar&gl=EG&ceid=EG:ar")
    L = []
    for z in rss(x):
        z["title"] = re.sub(r"\s+-\s+[^-]{2,40}$", "", z["title"])  # إزالة اسم المصدر الملحق بالعنوان
        if z["sum"] and z["title"] in z["sum"]: z["sum"] = ""
        L.append(z)
    return L, "gnews"

def cat(s, t):
    if s["cat"] == "nour": return "nour"
    if NOUR.search(t) and "حزب" in t: return "nour"
    if s["cat"] == "dawah" or DAWAH.search(t): return "dawah"
    return "muslims" if MUSLIM.search(t) else "world"

def main():
    old = {}
    try: old = json.load(open(OUT, encoding="utf-8"))
    except Exception: pass
    items = {x["url"]: x for x in old.get("items", [])}
    seen_t = {re.sub(r"\W", "", x["title"]) for x in items.values()}
    rep = []
    for s in SOURCES:
        try:
            L, how = fetch(s); n = 0
            for z in L[:40]:
                if not z["title"] or not z["url"] or len(z["title"]) < 12: continue
                k = re.sub(r"\W", "", z["title"])
                if z["url"] in items or k in seen_t: continue
                seen_t.add(k); n += 1
                items[z["url"]] = {"title": z["title"], "url": z["url"], "date": z["date"] or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sum": z["sum"], "src": s["name"], "sid": s["id"], "cat": cat(s, z["title"] + " " + z["sum"])}
            rep.append(f"{s['name']}: {n} جديد ({how})")
        except Exception as e:
            rep.append(f"{s['name']}: تعذر ({str(e)[:80]})")
    L = sorted(items.values(), key=lambda x: x.get("date", ""), reverse=True)[:200]
    for x in L: x.pop("top", None)
    for c in ("dawah", "nour", "muslims", "world"):
        for x in [y for y in L if y["cat"] == c][:2]: x["top"] = 1
    out = {"updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sources": [{"name": s["name"], "url": s["url"]} for s in SOURCES], "items": L}
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("الركن الإخباري: " + "؛ ".join(rep))

if __name__ == "__main__":
    main()
