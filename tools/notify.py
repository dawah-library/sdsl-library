#!/usr/bin/env python3
"""إشعار تليجرام من مهام GitHub Actions عبر الموقع (/api/notify) برمز OIDC — بلا مفاتيح في GitHub.
الاستعمال: python3 tools/notify.py "نص الرسالة (HTML بسيط)"  أو  --file tools/ocr-report.md "عنوان"
لا يُفشل المهمة أبدًا إن تعذر الإرسال."""
import json, os, sys, re, urllib.request

# الموقع خلف جدار Cloudflare يرفض توقيع urllib الافتراضي (خطأ 1010): ترويسة متصفح لكل الطلبات
_UA_OPENER = urllib.request.build_opener(); _UA_OPENER.addheaders = [("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 sdsl-bot")]; urllib.request.install_opener(_UA_OPENER)

SITE = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")


def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def send(text):
    try:
        u = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library"
        tok = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=20).read())["value"]
        run = "%s/%s/actions/runs/%s" % (os.environ.get("GITHUB_SERVER_URL", "https://github.com"), os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GITHUB_RUN_ID", ""))
        body = json.dumps({"text": text + '\n<a href="%s">التفاصيل</a>' % run}).encode()
        r = urllib.request.Request(SITE + "/api/notify", data=body, method="POST", headers={"content-type": "application/json", "authorization": "Bearer " + tok, "x-auth": "oidc"})
        print("notify:", urllib.request.urlopen(r, timeout=20).read()[:120])
    except Exception as e:
        print("notify skipped:", e)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--file":
        path, title = a[1], (a[2] if len(a) > 2 else "")
        t = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        t = re.sub(r"^# .*\n", "", t).strip()
        t = re.sub(r"^## (.*)$", lambda m: "<b>📘 " + esc(m.group(1)) + "</b>", esc(t), flags=re.M)
        send(("<b>" + esc(title) + "</b>\n" if title else "") + t[:3300])
    elif a:
        send(" ".join(a))
