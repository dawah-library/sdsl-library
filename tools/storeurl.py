"""رابط تنزيل مؤقت لملف في صندوق الرفع الخاص (Supabase Storage: inbox) مباشرة بالمفتاح السري من أسرار المهمة،
فلا يمر بالموقع (كان جدار Cloudflare يحجب طلبات خوادم GitHub برمز 403 فتتعطل خدمات التفريغ والتسجيلات والتحويل)."""
import json, os, urllib.request, urllib.error


def direct_url(name, bucket="inbox"):
    key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    base = os.environ.get("SUPABASE_URL", "https://nqxkkdexpodjjwfdkxoq.supabase.co").rstrip("/")
    if not key: return None
    last = ""
    for auth in (False, True):
        h = {"apikey": key, "content-type": "application/json"}
        if auth or not key.startswith("sb_"): h["Authorization"] = "Bearer " + key
        try:
            j = json.loads(urllib.request.urlopen(urllib.request.Request(base + "/storage/v1/object/sign/%s/%s" % (bucket, name), data=b'{"expiresIn": 3600}', headers=h, method="POST"), timeout=30).read())
            su = j.get("signedURL") or j.get("signedUrl")
            if su: return su if su.startswith("http") else base + "/storage/v1" + su
        except urllib.error.HTTPError as e: last = "%s %s" % (e.code, e.read()[:200])
        except Exception as e: last = str(e)
    print("  تعذّر الرابط المباشر من Supabase:", last, flush=True)
    return None
