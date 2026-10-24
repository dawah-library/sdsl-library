#!/usr/bin/env python3
"""ترجمة أسماء الكتب والمؤلفين إلى الإنجليزية للواجهة الإنجليزية (data/i18n-cat-en.json) بـ Gemini، ترجمة اصطلاحية لا حرفية.
لا يترجم إلا الجديد؛ ويكتب الأسماء بنقحرة أكاديمية مألوفة (مثل: Ibn Taymiyyah, Fath al-Bari: Commentary on Sahih al-Bukhari)."""
import json, os, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "i18n-cat-en.json")
KEYS = [k for k in [os.environ.get("GEMINI_API_KEY", "")] + [os.environ.get("GEMINI_API_KEY_%d" % i, "") for i in range(2, 10)] if k.strip()]
PROMPT = """You are an expert translator of classical and modern Islamic Arabic literature. For each item give its established English rendering:
- Book titles: the conventional English form used by scholars (transliterated title in standard academic style, then a colon and a faithful English meaning when helpful), e.g. "فتح الباري شرح صحيح البخاري" -> "Fath al-Bari: Commentary on Sahih al-Bukhari"; "العقيدة الواسطية" -> "Al-Aqidah al-Wasitiyyah (The Wasiti Creed)". Keep volume markers as "— Vol. N".
- Person names: standard transliteration (e.g. "ابن قيم الجوزية" -> "Ibn Qayyim al-Jawziyyah", "الشيخ ياسر برهامي" -> "Shaykh Yasir Burhami").
Return ONLY a JSON object mapping each given key to its English string.

Items:
"""


def gemini(text):
    for k in KEYS:
        for m in ("gemini-flash-latest", "gemini-flash-lite-latest"):
            try:
                body = json.dumps({"contents": [{"role": "user", "parts": [{"text": text}]}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 16000}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % m, data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
                with urllib.request.urlopen(req, timeout=180) as r:
                    j = json.loads(r.read())
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except Exception as e:
                print("  ", m, str(e)[:120], flush=True)
                time.sleep(4)
    return None


def main():
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    out = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {"books": {}, "authors": {}}
    jobs = []
    for b in cat["books"]:
        if b.get("type", "book") == "book" and b["id"] not in out["books"]:
            jobs.append(("b:" + b["id"], b.get("title", "")))
    ap = os.path.join(ROOT, "data", "articles", "index.json")
    arts = [x for x in (json.load(open(ap, encoding="utf-8")).get("items", []) if os.path.exists(ap) else []) if x["id"] not in out["books"]]
    arts.sort(key=lambda x: x.get("d") or "", reverse=True)  # الأحدث أولًا
    jobs += [("b:" + x["id"], x.get("t", "")) for x in arts[: int(os.environ.get("ART_MAX", "600"))]]
    for a in cat["authors"]:
        if a["id"] not in out["authors"]:
            jobs.append(("a:" + a["id"], a.get("name", "")))
    print("للترجمة:", len(jobs))
    for i in range(0, len(jobs), 60):
        part = jobs[i:i + 60]
        res = gemini(PROMPT + json.dumps({k: v for k, v in part}, ensure_ascii=False))
        if not res:
            break
        for k, v in res.items():
            if isinstance(v, str) and v.strip():
                (out["books"] if k.startswith("b:") else out["authors"])[k[2:]] = v.strip()
        json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print("  %d/%d" % (min(i + 60, len(jobs)), len(jobs)), flush=True)


if __name__ == "__main__":
    main()
