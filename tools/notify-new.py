#!/usr/bin/env python3
"""إشعار تليجرام بالجديد بعد مهمة آلية (طلب المدير، ٢١ نوفمبر ٢٠٢٦): يقارن ملف البيانات في آخر إيداع (HEAD) بنسخته بعد المهمة،
ويرسل ملخص الجديد وحده عبر tools/notify.py (لا يُرسل شيء إن لم يجدّ شيء). يُشغَّل قبل خطوة الحفظ.
الأنواع:
  news  — جديد «الركن الإخباري» في المجلة (data/majalla-news.json): العناوين بروابطها ومصادرها.
  mawsua — ما حُرِّر من مواد الموسوعات العلمية في الجولة (data/mawsua/_index.json)، وأنه بانتظار الاعتماد.
  video — الفيديوهات الجديدة (data/video/_list.json): كتب المكتبة ومقاطع الطلائع، وأنها بانتظار الاعتماد.
الاستعمال: python3 tools/notify-new.py news|video"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import importlib.util as _u  # noqa: E402
_s = _u.spec_from_file_location("notify", os.path.join(ROOT, "tools", "notify.py")); N = _u.module_from_spec(_s); _s.loader.exec_module(N)
SITE = "https://dawahlibrary.org"


def old(path):
    try: return json.loads(subprocess.run(["git", "show", "HEAD:" + path], cwd=ROOT, capture_output=True, text=True, check=True).stdout or "null")
    except Exception: return None


def cur(path):
    try: return json.load(open(os.path.join(ROOT, path), encoding="utf-8"))
    except Exception: return None


def news():
    a, b = old("data/majalla-news.json") or {}, cur("data/majalla-news.json") or {}
    seen = {x.get("url") for x in a.get("items") or []}
    new = [x for x in b.get("items") or [] if x.get("url") and x["url"] not in seen]
    if not new: return None
    by = {}
    for x in new: by.setdefault(x.get("src") or "أخرى", []).append(x)
    lines = ["📰 <b>جديد الركن الإخباري في المجلة</b> (%d)" % len(new)]
    for src, L in by.items():
        lines.append("\n<b>%s</b>" % N.esc(src))
        lines += ['• <a href="%s">%s</a>' % (N.esc(x["url"]), N.esc(x.get("title", "")[:140])) for x in L[:6]]
        if len(L) > 6: lines.append("… و%d غيرها" % (len(L) - 6))
    lines.append('\n<a href="%s/majalla">افتح المجلة</a>' % SITE)
    return "\n".join(lines)


def video():
    a, b = old("data/video/_list.json") or {}, cur("data/video/_list.json") or {}
    have = {v.get("f") for l in a.values() for v in l}
    new = [(k, v) for k, l in b.items() for v in l if v.get("f") and v["f"] not in have]
    if not new: return None
    AG = {"t1": "٥–٨", "t2": "٩–١٢", "t3": "١٢–١٥", "t4": "١٥–٢٠"}
    lines = ["🎬 <b>فيديوهات جديدة</b> (%d) — بانتظار الاعتماد" % len(new)]
    for k, v in new[:10]:
        kind = ("الطلائع %s سنة" % AG.get(v.get("tala"), "")) if k.startswith("tala-") else "كتاب"
        lines.append("• %s <i>(%s، %s، %s ث)</i>" % (N.esc(v.get("t", k)), kind, v.get("aspect", ""), v.get("d", "")))
    lines.append('\n<a href="%s/video">راجع واعتمد في صفحة الفيديوهات</a>' % SITE)
    return "\n".join(lines)


def mawsua():
    a, b = old("data/mawsua/_index.json") or {}, cur("data/mawsua/_index.json") or {}
    A = {x["k"]: x for x in a.get("items") or []}; rows = []
    for x in b.get("items") or []:
        o = A.get(x["k"], {}); de, dm = x.get("e", 0) - o.get("e", 0), x.get("m", 0) - o.get("m", 0)
        if de > 0 or (dm > 0 and not o.get("m")): rows.append((x, de, dm))
    if not rows: return None
    lines = ["📚 <b>الموسوعات العلمية</b>: جولة تحرير جديدة"]
    for x, de, dm in rows:
        lines.append("• %s: %s%s" % (N.esc(x.get("n", x["k"])), ("+%d مادة محررة (المجموع %d من %d)" % (de, x.get("e", 0), x.get("m", 0))) if de > 0 else "",
                                      (" مخطط جديد بـ%d مسألة" % x.get("m", 0)) if dm > 0 and not (a and any(i["k"] == x["k"] and i.get("m") for i in a.get("items") or [])) else ""))
    lines.append('\nالمواد مسودات حتى تعتمدها: <a href="%s/mawsua">افتح الموسوعات</a>' % SITE)
    return "\n".join(lines)


if __name__ == "__main__":
    k = (sys.argv[1:] or [""])[0]
    msg = {"news": news, "video": video, "mawsua": mawsua}.get(k, lambda: None)()
    print(msg or "لا جديد")
    if msg: N.send(msg)
