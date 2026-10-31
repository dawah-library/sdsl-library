#!/usr/bin/env python3
"""فحص مفاتيح Gemini (GEMINI_API_KEY … _20): يجرّب كل مفتاح بطلب صغير ويكتب حالته في data/keys-status.json
بالاسم فقط (لا يُكتب المفتاح ولا جزء منه)، فيرى المدير في الإدارة أي المفاتيح تعمل وأيها نفدت حصته أو تعطّل."""
import json, os, urllib.request, urllib.error, datetime
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = ["GEMINI_API_KEY"] + ["GEMINI_API_KEY_%d" % i for i in range(2, 21)]
out, seen, models = [], {}, []
for n in names:
    k = os.environ.get(n, "").strip()
    if not k: continue
    st = "ok"
    if k in seen: st = "dup:" + seen[k]
    else:
        seen[k] = n
        body = json.dumps({"contents": [{"parts": [{"text": "قل: نعم"}]}], "generationConfig": {"maxOutputTokens": 5}}).encode()
        if not models:  # قائمة النماذج المتاحة (للتحقق من أسماء نماذج الصوت والتشكيل)
            try:
                j = json.load(urllib.request.urlopen(urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", headers={"x-goog-api-key": k}), timeout=40))
                models.extend(m["name"].split("/")[-1] for m in j.get("models", []))
            except Exception as e: print("models:", e)
        req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent", data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
        try: urllib.request.urlopen(req, timeout=40).read()
        except urllib.error.HTTPError as e:
            st = {429: "quota", 400: "invalid", 401: "invalid", 403: "denied"}.get(e.code, "http%d" % e.code)
        except Exception as e: st = "error"
    out.append({"name": n, "status": st, "type": "AQ" if k.startswith("AQ.") else "AIza" if k.startswith("AIza") else "other"})
    print(n, st)
res = {"models": [m for m in models if "gemini" in m], "at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "keys": out, "working": sum(1 for x in out if x["status"] in ("ok", "quota"))}
json.dump(res, open(os.path.join(R, "data", "keys-status.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("العاملة:", res["working"], "من", len(out))
