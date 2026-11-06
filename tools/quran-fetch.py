#!/usr/bin/env python3
"""بيانات المصحف والتفسير (تعمل في GitHub Actions):
 ١) أرقام صفحات مصحف المدينة والأجزاء والأحزاب ومواضع السجود لكل آية (alquran.cloud، رواية حفص) ← data/quran/meta.json
    بصيغة {"s": [[صفحة، جزء، ربع حزب، سجدة؟]…] لكل سورة}، والنص العثماني ← data/quran/uthmani.json.
 ٢) «المختصر في التفسير» (مركز تفسير، عبر QuranEnc: arabic_mokhtasar) ← data/quran/tafsir/mukhtasar/<سورة>.json
 ٣) قائمة ترجمات وتفاسير QuranEnc العربية ← tools/quranenc-list.md (للبحث عن غيرها كالسراج في غريب القرآن).
 ٤) ما يُذكر في QF_EXTRA من مفاتيح QuranEnc الأخرى (مثل كتاب غريب) يُجلب بالطريقة نفسها إلى data/quran/tafsir/<المفتاح>/."""
import json, os, time, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.join(ROOT, "data", "quran")
UA = {"User-Agent": "sdsl-library (dawahlibrary.org)"}
def get(u, tries=4):
    for t in range(tries):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))
        except Exception as e: err = e; time.sleep(3 * (t + 1))
    raise err
def save(p, o): os.makedirs(os.path.dirname(p), exist_ok=True); json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
def main():
    rep = []
    try:
        d = get("https://api.alquran.cloud/v1/quran/quran-uthmani")["data"]["surahs"]
        meta = {str(s["number"]): [[a["page"], a["juz"], a["hizbQuarter"], 1 if a.get("sajda") else 0] for a in s["ayahs"]] for s in d}
        save(os.path.join(Q, "meta.json"), {"src": "api.alquran.cloud quran-uthmani", "s": meta})
        save(os.path.join(Q, "uthmani.json"), {"src": "api.alquran.cloud quran-uthmani", "suras": [{"n": s["number"], "name": s["name"], "ayat": [a["text"] for a in s["ayahs"]]} for s in d]})
        rep.append("✓ أرقام الصفحات والأجزاء والأحزاب، والنص العثماني")
    except Exception as e: rep.append("✗ meta: %s" % e)
    keys = ["arabic_mokhtasar"] + [k for k in os.environ.get("QF_EXTRA", "").split(",") if k]
    for key in keys:
        n = 0
        for s in range(1, 115):
            p = os.path.join(Q, "tafsir", key.replace("arabic_", ""), "%d.json" % s)
            if os.path.exists(p) and os.environ.get("QF_FORCE") != "1": n += 1; continue
            try:
                r = get("https://quranenc.com/api/v1/translation/sura/%s/%d" % (key, s))["result"]
                save(p, {str(x["aya"]): (x.get("translation") or "").strip() for x in r}); n += 1
            except Exception as e: rep.append("✗ %s سورة %d: %s" % (key, s, e)); break
            time.sleep(.3)
        rep.append("%s: %d سورة" % (key, n))
    try:
        L = get("https://quranenc.com/api/v1/translations/list/ar")["translations"]
        open(os.path.join(ROOT, "tools", "quranenc-list.md"), "w", encoding="utf-8").write("# QuranEnc: الترجمات والتفاسير المتاحة\n\n" + "\n".join("- `%s` — %s (%s)" % (x["key"], x.get("title", ""), x.get("language_iso_code", "")) for x in L))
        rep.append("قائمة QuranEnc: %d" % len(L))
    except Exception as e: rep.append("✗ list: %s" % e)
    print("\n".join(rep))
if __name__ == "__main__":
    main()
