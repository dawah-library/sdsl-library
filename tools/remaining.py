#!/usr/bin/env python3
"""يولّد tools/remaining.md (البنود المتبقية) من tools/plan-tasks.json. شغّله بعد تحديث حالات البنود."""
import json, os, datetime, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(R, "tools", "plan-tasks.json"), encoding="utf-8"))
rows = [r for r in d["rows"] if r["st"] in ("todo", "check", "owner")]
by = collections.OrderedDict()
for r in rows: by.setdefault(r["ch"], []).append(r)
c = collections.Counter(r["st"] for r in rows)
L = ["# البنود المتبقية من وثيقة التطوير (حتى %s)" % datetime.date.today().isoformat(), "",
     "مولَّد من tools/plan-tasks.json بـ tools/remaining.py. الحالات: todo لم يبدأ (%d)، check منفَّذ جزئيًا يحتاج تحققًا وإكمالًا (%d)، owner يحتاج قرار صاحب المكتبة (%d)." % (c["todo"], c["check"], c["owner"]), ""]
for ch, rs in by.items():
    L.append("## الباب %s — %s" % (ch, rs[0].get("chap") or d["chapters"].get(str(ch), "")))
    L += ["- [%s] %s: %s" % (r["st"], r["id"], r["text"]) for r in rs]
    L.append("")
open(os.path.join(R, "tools", "remaining.md"), "w", encoding="utf-8").write("\n".join(L))
print(dict(c))
