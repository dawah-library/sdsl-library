#!/usr/bin/env python3
"""سجل إثراء المكتبة العامة (ب5-63): ما أُضيف فعلًا وما تعذّر وسببه، بحسب المؤلف. يُولَّد بعد كل استيراد → tools/enrich-log.md
لا يُذكر كتاب «مضافًا» إلا إن وُجد سجله في الفهرس فعلًا (ب5-62)."""
import json, os, re, datetime, collections
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lst = json.load(open(os.path.join(R, "tools", "turath-list.json"), encoding="utf-8"))["books"]
cat = json.load(open(os.path.join(R, "data", "catalog.json"), encoding="utf-8"))
have = {b["id"]: b for b in cat["books"]}; sets = collections.defaultdict(list)
for b in cat["books"]:
    if b.get("set"): sets[b["set"]].append(b)
rep = open(os.path.join(R, "tools", "turath-report.md"), encoding="utf-8").read() if os.path.exists(os.path.join(R, "tools", "turath-report.md")) else ""
why = {}
for sec in re.split(r"\n(?=## )", rep):
    m = re.match(r"## (.+)\n([\s\S]*)", sec)
    if m and "✗" in m.group(2): why[m.group(1).strip()] = re.search(r"✗[^\n]*", m.group(2)).group(0)[:200]
by = collections.OrderedDict()
for x in lst: by.setdefault(x.get("authorName", "؟"), []).append(x)
L = ["# سجل إثراء المكتبة العامة", "", f"> {datetime.date.today()} — يُولَّد آليًا بعد كل استيراد (tools/enrich-log.py). المصدر: مشروع OpenITI (نصوص المكتبة الشاملة بترقيم الطبعات).", ""]
tot = collections.Counter()
for a, xs in by.items():
    L.append(f"## {a}")
    for x in xs:
        vols = sets.get(x["id"]) or ([have[x["id"]]] if x["id"] in have else [])
        if vols:
            n = sum(v.get("n") or 0 for v in vols); tot["ok"] += 1
            L.append(f"- ✓ {x['title']} — {n} صفحة" + (f"، {len(vols)} مجلد" if len(vols) > 1 else "") + (f" — {vols[0].get('source','')[:80]}" if vols[0].get("source") else ""))
        elif x["title"] in why: tot["fail"] += 1; L.append(f"- ✗ {x['title']} — تعذّر: {why[x['title']]}")
        else: tot["wait"] += 1; L.append(f"- … {x['title']} — في انتظار الاستيراد")
    L.append("")
L[3:3] = [f"**المضاف فعلًا:** {tot['ok']} • **تعذّر:** {tot['fail']} • **في الانتظار:** {tot['wait']}", "",
          "**المعاصرون (ب5-4 … ب5-26):** كتبهم محفوظة الحقوق؛ لا تُنشر نصوصها إلا بإذن المؤلف أو الناشر، ويُكتفى ببياناتها وروابطها المشروعة حتى يصل الإذن (ب5-59، ب5-60، ب5-61).", ""]
open(os.path.join(R, "tools", "enrich-log.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print(dict(tot))
