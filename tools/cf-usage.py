#!/usr/bin/env python3
"""فحص استهلاك Cloudflare: طلبات الدوال يوميًا (الحد المجاني ١٠٠٬٠٠٠)، والأخطاء، وعمليات النشر، وتخزين R2، وحالة الموقع."""
import json, os, datetime, urllib.request, urllib.error
T, A, CF = os.environ["T"], os.environ["A"], os.environ.get("CF", "https://api.cloudflare.com/client/v4")
UA = "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0 sdsl-bot"
def call(path, body=None):
    r = urllib.request.Request(CF + path, data=json.dumps(body).encode() if body else None, headers={"Authorization": "Bearer " + T, "content-type": "application/json"})
    try: return json.loads(urllib.request.urlopen(r, timeout=40).read())
    except urllib.error.HTTPError as e: return {"http": e.code, "err": e.read()[:400].decode("utf-8", "ignore")}
def gql(q, v): return call("/graphql", {"query": q, "variables": v})
out = {"at": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")}
d0 = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
q = """query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){
 pagesFunctionsInvocationsAdaptiveGroups(limit:20,filter:{date_geq:$d},orderBy:[date_ASC]){sum{requests errors subrequests} dimensions{date}}
 workersInvocationsAdaptive(limit:200,filter:{date_geq:$d},orderBy:[date_ASC]){sum{requests errors} dimensions{date scriptName status}}
 r2StorageAdaptiveGroups(limit:5,filter:{date_geq:$d},orderBy:[date_DESC]){max{payloadSize objectCount} dimensions{date bucketName}}
 r2OperationsAdaptiveGroups(limit:50,filter:{date_geq:$d}){sum{requests} dimensions{actionType}}
 httpRequestsAdaptiveGroups:httpRequests1dGroups(limit:8,filter:{date_geq:$d},orderBy:[date_ASC]){sum{requests cachedRequests bytes} dimensions{date}}
}}}"""
r = gql(q, {"a": A, "d": d0})
out["graphql_errors"] = [e.get("message") for e in (r.get("errors") or [])][:8] or r.get("err")
acc = (((r.get("data") or {}).get("viewer") or {}).get("accounts") or [{}])[0] if r.get("data") else {}
pf = {}
for g in acc.get("pagesFunctionsInvocationsAdaptiveGroups") or []: pf[g["dimensions"]["date"]] = g["sum"]
wk = {}
for g in acc.get("workersInvocationsAdaptive") or []:
    k = g["dimensions"]["date"]; wk.setdefault(k, {"requests": 0, "errors": 0}); wk[k]["requests"] += g["sum"]["requests"]; wk[k]["errors"] += g["sum"]["errors"]
out["functions_per_day"] = pf; out["workers_per_day"] = wk
out["r2_storage"] = [dict(g["dimensions"], gb=round(g["max"]["payloadSize"] / 1e9, 2), objects=g["max"]["objectCount"]) for g in acc.get("r2StorageAdaptiveGroups") or []]
out["r2_ops_7d"] = {g["dimensions"]["actionType"]: g["sum"]["requests"] for g in acc.get("r2OperationsAdaptiveGroups") or []}
dp = call("/accounts/%s/pages/projects/sdsl-library/deployments?per_page=10" % A)
out["deployments_total"] = (dp.get("result_info") or {}).get("total_count"); out["deploy_err"] = dp.get("err")
out["last_deploys"] = [{"at": x.get("created_on"), "status": (x.get("latest_stage") or {}).get("status")} for x in (dp.get("result") or [])[:5]]
st = {}
for p in ("/", "/book/umdafiqh/3", "/api/pages?check=1", "/data/catalog.json", "/sitemap.xml"):
    try:
        with urllib.request.urlopen(urllib.request.Request("https://dawahlibrary.org" + p, headers={"User-Agent": UA}), timeout=30) as x: st[p] = x.status
    except urllib.error.HTTPError as e: st[p] = "%d %s" % (e.code, e.read()[:120].decode("utf-8", "ignore"))
    except Exception as e: st[p] = str(e)[:120]
out["live"] = st
print(json.dumps(out, ensure_ascii=False, indent=1))
json.dump(out, open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "cf-usage.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
