"""فحص مفتاح ElevenLabs بلا استهلاك أحرف (GET /v1/voices) وحفظ قائمة الأصوات المتاحة في data/audio/_eleven-voices.json (بلا المفتاح)."""
import os, json, urllib.request, urllib.error, datetime
key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not key: print("لا مفتاح في البيئة"); raise SystemExit(1)
try:
    with urllib.request.urlopen(urllib.request.Request("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": key}), timeout=60) as r:
        j = json.loads(r.read()); print("HTTP", r.status)
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode("utf-8", "replace")[:300]); raise SystemExit(1)
V = [{"id": v["voice_id"], "name": v.get("name"), "category": v.get("category"), "labels": v.get("labels") or {}, "desc": (v.get("description") or "")[:200], "preview": v.get("preview_url")} for v in j.get("voices", [])]
print("عدد الأصوات", len(V))
for v in V: print(v["id"], v["name"], v["category"], json.dumps(v["labels"], ensure_ascii=False))
os.makedirs("data/audio", exist_ok=True)
json.dump({"upd": str(datetime.date.today()), "voices": V}, open("data/audio/_eleven-voices.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
