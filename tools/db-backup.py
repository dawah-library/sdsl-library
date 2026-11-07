#!/usr/bin/env python3
"""نسخة احتياطية أسبوعية لجداول قاعدة Supabase (المخطط العام) إلى مخزن R2 الخاص.

النسخ التلقائي في Supabase يحفظ ٧ أيام فقط؛ هذه النسخة تبقى في R2: backups/db/<التاريخ>.json.gz
وفيها كل صفوف جداول المخطط public (الحسابات العامة profiles، والتعليقات، والمنشورات، وخطط القراءة، والقراءة الجماعية…).
لا تشمل جدول المصادقة auth.users (كلمات المرور والبريد يحفظها Supabase نفسه).
الرفع برمز OIDC عبر /api/r2put (بلا مفاتيح R2 في GitHub). ويُكتب سجل بلا بيانات (التاريخ وعدد الصفوف) في data/db-backups.json.
لا يحذف شيئًا ولا يعدّل القاعدة (قراءة فقط).

الأسرار: SUPABASE_SECRET_KEY (أو SUPABASE_ACCESS_TOKEN لجلبه). الاستعمال: python3 tools/db-backup.py
"""
import datetime, gzip, json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get("SUPABASE_URL", "https://nqxkkdexpodjjwfdkxoq.supabase.co").rstrip("/")
KEY = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
SITE = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
UA = "sdsl-library-backup/1.0 (GitHub Actions)"  # لا هوية متصفح: Supabase يرفض المفتاح السري من المتصفحات


def tables():
    """الجداول من القاعدة نفسها (وصف PostgREST) مع ما في ملفات supabase/*.sql، فلا يفوت جدول أُنشئ بترحيل."""
    names = set()
    for f in os.listdir(os.path.join(ROOT, "supabase")):
        if f.endswith(".sql"):
            sql = open(os.path.join(ROOT, "supabase", f), encoding="utf-8").read()
            names |= set(x.lower() for x in re.findall(r"create table (?:if not exists )?(?:public\.)?\"?([a-z_0-9]+)", sql, re.I))
    try:
        spec = json.loads(urllib.request.urlopen(urllib.request.Request(URL + "/rest/v1/", headers=hdr()), timeout=60).read())
        names |= set((spec.get("definitions") or {}).keys())
    except Exception as e:
        print("::warning::تعذّر وصف الجداول من القاعدة:", e)
    return sorted(names)


def hdr():
    h = {"apikey": KEY, "Accept": "application/json", "User-Agent": UA}
    if not KEY.startswith("sb_"): h["Authorization"] = "Bearer " + KEY  # المفتاح القديم (JWT)
    return h


def dump(t):
    rows, off, step = [], 0, 1000
    while True:
        req = urllib.request.Request("%s/rest/v1/%s?select=*&limit=%d&offset=%d" % (URL, t, step, off), headers=hdr())
        try:
            part = json.loads(urllib.request.urlopen(req, timeout=60).read())
        except urllib.error.HTTPError as e:
            return None, "%d %s" % (e.code, e.read()[:120].decode("utf-8", "replace"))
        rows += part
        if len(part) < step: return rows, ""
        off += step


def oidc():
    u = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library"
    r = urllib.request.Request(u, headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())["value"]


def upload(key, data):
    body = json.dumps({"keys": [key]}).encode()
    r = urllib.request.Request(SITE + "/api/r2put", data=body, method="POST", headers={"content-type": "application/json", "authorization": "Bearer " + oidc(), "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 sdsl-bot"})
    url = json.loads(urllib.request.urlopen(r, timeout=60).read())["urls"][key]
    urllib.request.urlopen(urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": "application/gzip"}), timeout=300).read()


def main():
    if not KEY:
        print("::warning::لا مفتاح Supabase سري؛ تُركت النسخة الاحتياطية"); return 0
    day = datetime.date.today().isoformat()
    out, counts, errs = {"at": datetime.datetime.utcnow().isoformat() + "Z", "project": URL, "tables": {}}, {}, {}
    for t in tables():
        rows, err = dump(t)
        if rows is None: errs[t] = err; print("تعذّر:", t, err); continue
        out["tables"][t] = rows; counts[t] = len(rows)
    if not counts:
        print("::error::لم يُقرأ أي جدول"); return 1
    data = gzip.compress(json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9)
    key = "backups/db/%s.json.gz" % day
    upload(key, data)
    print("رُفعت النسخة:", key, "%.1f ك.ب" % (len(data) / 1024), "جداول:", len(counts), "صفوف:", sum(counts.values()))
    lp = os.path.join(ROOT, "data", "db-backups.json")
    log = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {"note": "سجل النسخ الاحتياطية لقاعدة البيانات في R2 (بلا بيانات): tools/db-backup.py", "items": []}
    log["items"] = [x for x in log["items"] if x.get("d") != day] + [{"d": day, "key": key, "kb": round(len(data) / 1024, 1), "rows": sum(counts.values()), "tables": len(counts), "errors": errs}]
    log["items"] = log["items"][-60:]
    json.dump(log, open(lp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
