#!/usr/bin/env python3
"""دمج ثلاثي لملفات JSON عند تعارض حفظين متزامنين (مثل catalog.json): يُستعمل أثناء git rebase.
:1 الأصل المشترك، :2 النسخة الأحدث على الخادم، :3 تعديلنا. القوائم التي عناصرها لها id تُدمج عنصرًا عنصرًا."""
import json, subprocess, sys
f = sys.argv[1]
def stage(n):
    try: return subprocess.run(["git", "show", ":%d:%s" % (n, f)], capture_output=True, check=True).stdout.decode("utf-8")
    except subprocess.CalledProcessError: return None
tb, tu, tm = stage(1), stage(2), stage(3)
base, up, mine = (json.loads(t) if t else None for t in (tb, tu, tm))
MISS = object()
def idlist(x): return isinstance(x, list) and x and all(isinstance(i, dict) and "id" in i for i in x)
def merge(b, u, m):
    if m == b: return u
    if u == b or u is MISS: return m
    if m is MISS: return MISS if u == b else u
    if isinstance(u, dict) and isinstance(m, dict):
        b = b if isinstance(b, dict) else {}
        out = {}
        for k in list(u.keys()) + [k for k in m.keys() if k not in u]:
            v = merge(b.get(k, MISS), u.get(k, MISS), m.get(k, MISS))
            if v is not MISS: out[k] = v
        if "version" in out and isinstance(u.get("version"), int) and isinstance(m.get("version"), int): out["version"] = max(u["version"], m["version"])
        return out
    if (idlist(u) or u == []) and (idlist(m) or m == []):
        bm = {i["id"]: i for i in (b if idlist(b) else [])}
        um, mm = {i["id"]: i for i in u}, {i["id"]: i for i in m}
        ids = [i["id"] for i in u] + [i["id"] for i in m if i["id"] not in um]
        out = []
        for i in ids:
            v = merge(bm.get(i, MISS), um.get(i, MISS), mm.get(i, MISS))
            if v is not MISS: out.append(v)
        return out
    return m
res = merge(base if base is not None else {}, up if up is not None else MISS, mine if mine is not None else MISS)
compact = tu is not None and tu.count("\n") < 3
with open(f, "w", encoding="utf-8") as fh:
    json.dump(res, fh, ensure_ascii=False, separators=(",", ":") if compact else None, indent=None if compact else 1)
print("دُمج تلقائيًا:", f)
