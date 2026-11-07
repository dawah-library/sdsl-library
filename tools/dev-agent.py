#!/usr/bin/env python3
"""الوكيل البرمجي للمساعد التقني (#/dev) — يُشغَّل من .github/workflows/dev-agent.yml.

دورة الطلب (data/dev-requests.json):
  pending   ← كتبه المدير (أو أضاف متابعة) — الوكيل ينفّذه في الفرع agent/dev/<id>
  doing     ← قيد التنفيذ
  review    ← نُفّذ واجتاز الفحص، وينتظر اعتماد المدير (رابط الفروق في الطلب)
  approved  ← اعتمده المدير من الموقع — الوكيل يدمجه في main فيُنشر
  done      ← نُشر (أو أُجيب دون تعديل)
  need      ← يحتاج توضيحًا من المدير (السؤال في r)
  rejected  ← رفضه المدير (يُحذف الفرع) أو تعذر
الأوامر:
  pick                 يختار العمل التالي ويكتبه في GITHUB_OUTPUT (act=run|merge|close|none, id, branch, eng, auto)
  prompt <id>          يكتب نص التكليف في .dev-prompt.md
  set <id> k=v ...     يحدّث حقول الطلب (القيم JSON إن أمكن، وإلا نص)
  log <id> <نص>        يضيف سطرًا إلى سجل الطلب (h)
  status k=v ...       يحدّث data/dev-agent.json (حالة المحركات وآخر التشغيلات)
"""
import json, os, sys, time

P = "data/dev-requests.json"
S = "data/dev-agent.json"
now = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def load(p=P):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return {"items": []}


def save(o, p=P):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=1)


def find(o, i):
    for x in o.get("items", []):
        if x.get("id") == i:
            return x
    sys.exit(f"لا يوجد طلب {i}")


def out(**kw):
    g = os.environ.get("GITHUB_OUTPUT")
    lines = [f"{k}={v}" for k, v in kw.items()]
    if g:
        with open(g, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    print(" ".join(lines))


def pick():
    o = load()
    L = o.get("items", [])
    # الطلب العالق في «قيد التنفيذ» أكثر من ساعتين (توقف التشغيل) يعود معلّقًا
    for x in L:
        if x.get("st") == "doing" and x.get("t0") and time.time() - time.mktime(time.strptime(x["t0"], "%Y-%m-%dT%H:%M:%SZ")) > 7200:
            x["st"] = "pending"
            x.setdefault("h", []).append({"at": now(), "by": "agent", "m": "توقف التشغيل السابق؛ أُعيد الطلب إلى الانتظار."})
            save(o)
    for st, act in (("approved", "merge"), ("rejected", "close")):
        for x in L:
            if x.get("st") == st and (act == "merge" or x.get("br")) and not x.get("closed"):
                return out(act=act, id=x["id"], branch=x.get("br") or "agent/dev/" + x["id"], eng=x.get("eng") or "auto", auto=x.get("auto") or 0)
    pend = sorted([x for x in L if x.get("st") == "pending" and x.get("eng") != "session"], key=lambda x: (x.get("p") or 2, x.get("at") or ""))
    if pend:
        x = pend[0]
        return out(act="run", id=x["id"], branch=x.get("br") or "agent/dev/" + x["id"], eng=x.get("eng") or "auto", auto=x.get("auto") or 0)
    out(act="none", id="", branch="", eng="", auto=0)


KINDS = {"feature": "تطوير أو إضافة", "fix": "إصلاح خلل", "content": "محتوى وبيانات", "ops": "مهمة تشغيلية"}


def prompt(i):
    x = find(load(), i)
    hist = "\n".join(f"- [{h.get('at','')[:16]}] {'المدير' if h.get('by') == 'admin' else 'الوكيل'}: {h.get('m','')}" for h in x.get("h", [])[-12:])
    tpl = open("tools/agents/dev-agent-prompt.md", encoding="utf-8").read()
    txt = tpl.format(
        id=i, kind=KINDS.get(x.get("k"), x.get("k", "")), prio={1: "عاجلة", 2: "عادية", 3: "لاحقًا"}.get(x.get("p"), "عادية"),
        dele="مأذون للحذف وما يمس حسابات الأعضاء لهذا الطلب وحده" if x.get("del") else "غير مأذون بالحذف ولا بما يمس حسابات الأعضاء",
        text=x.get("t", ""), hist=hist or "(لا متابعات سابقة)", extra=os.environ.get("DEV_EXTRA", "").strip() or "(لا شيء)")
    open(".dev-prompt.md", "w", encoding="utf-8").write(txt)
    print(f"التكليف: {len(txt)} حرفًا")


def parse(v):
    try:
        return json.loads(v)
    except Exception:
        return v


def setf(i, kv):
    o = load()
    x = find(o, i)
    for a in kv:
        k, _, v = a.partition("=")
        if v == "":
            x.pop(k, None)
        elif v.startswith("@"):  # القيمة من ملف
            x[k] = open(v[1:], encoding="utf-8").read().strip()[:6000]
        else:
            x[k] = parse(v)
    x["u"] = now()
    save(o)


def log(i, m):
    o = load()
    x = find(o, i)
    if m.startswith("@"):
        m = open(m[1:], encoding="utf-8").read().strip()
    x.setdefault("h", []).append({"at": now(), "by": "agent", "m": m[:4000]})
    x["h"] = x["h"][-40:]
    save(o)


def status(kv):
    s = load(S) if os.path.exists(S) else {}
    for a in kv:
        k, _, v = a.partition("=")
        if k == "run":
            s.setdefault("runs", []).insert(0, parse(v))
            s["runs"] = s["runs"][:25]
        else:
            s[k] = parse(v)
    s["at"] = now()
    save(s, S)


if __name__ == "__main__":
    c = sys.argv[1] if len(sys.argv) > 1 else ""
    if c == "pick":
        pick()
    elif c == "prompt":
        prompt(sys.argv[2])
    elif c == "set":
        setf(sys.argv[2], sys.argv[3:])
    elif c == "log":
        log(sys.argv[2], " ".join(sys.argv[3:]))
    elif c == "status":
        status(sys.argv[2:])
    else:
        print(__doc__)
