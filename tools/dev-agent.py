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
  keys                 أسماء متغيرات مفاتيح Gemini بترتيب الوكيل (المحجوزة له في tools/gkeys.py أولًا)
  probe <model>        يفحص بطلب واحد صغير أن للمفتاح GEMINI_API_KEY حصة في النموذج: ok|quota|gone|bad (رمز الخروج 0 مع ok)
  reset_at             موعد تجدد الحصة اليومية المجانية (منتصف الليل بتوقيت المحيط الهادئ) بصيغة ISO
"""
import json, os, sys, time, urllib.request, urllib.error

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
    # الطلب العالق في «قيد التنفيذ» أكثر من ساعتين (توقف التشغيل) يُعاد تنفيذه (دون حفظ هنا؛ التنفيذ يحدّث حالته)
    for x in L:
        if x.get("st") == "doing" and x.get("t0") and time.time() - time.mktime(time.strptime(x["t0"], "%Y-%m-%dT%H:%M:%SZ")) > 7200:
            x["st"] = "pending"
    for st, act in (("approved", "merge"), ("rejected", "close")):
        for x in L:
            if x.get("st") == st and (act == "merge" or x.get("br")) and not x.get("closed"):
                return out(act=act, id=x["id"], branch=x.get("br") or "agent/dev/" + x["id"], eng=x.get("eng") or "auto", auto=x.get("auto") or 0)
    # نفدت حصة Gemini المجانية في كل المفاتيح والنماذج: لا تشغيل حتى تتجدد (إلا مع محرك Claude)، فلا تُهدر الجولات
    qu = (load(S) if os.path.exists(S) else {}).get("quota_until") or ""
    if qu and qu > now() and not (os.environ.get("CLAUDE_CODE_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY")) and os.environ.get("DEV_FORCE") != "1":
        print(f"حصة Gemini نافدة حتى {qu}")
        return out(act="none", id="", branch="", eng="", auto=0)
    pend = sorted([x for x in L if x.get("st") == "pending" and x.get("eng") != "session"], key=lambda x: (sum("تعذر تشغيل محرك" in (h.get("m") or "") for h in (x.get("h") or [])), x.get("p") or 2, x.get("at") or ""))  # المتعثر يتأخر فلا يحجز الطابور
    if pend:
        x = pend[0]
        return out(act="run", id=x["id"], branch=x.get("br") or "agent/dev/" + x["id"], eng=x.get("eng") or "auto", auto=x.get("auto") or 0)
    out(act="none", id="", branch="", eng="", auto=0)


KINDS = {"feature": "تطوير أو إضافة", "fix": "إصلاح خلل", "content": "محتوى وبيانات", "ops": "مهمة تشغيلية"}


def prompt(i):
    x = find(load(), i)
    hist = "\n".join(f"- [{h.get('at','')[:16]}] {'المدير' if h.get('by') == 'admin' else 'فريق القسم' if h.get('by') == 'team' else 'الوكيل'}: {h.get('m','')}" for h in x.get("h", [])[-12:])
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
    h = x.setdefault("h", [])
    if h and h[-1].get("by") == "agent" and h[-1].get("m") == m[:4000]:  # تكرار الرسالة نفسها (تعثر متتابع) لا يملأ السجل
        h[-1]["n"] = (h[-1].get("n") or 1) + 1
        h[-1]["at"] = now()
    else:
        h.append({"at": now(), "by": "agent", "m": m[:4000]})
    x["h"] = h[-40:]
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


def keynames():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gkeys
    names = [n for n, _ in gkeys._all()]
    d = gkeys._dev_n(len(names))
    # المحجوزة للوكيل أولًا، ثم البقية من الآخر (أقلها استهلاكًا من التحويل)؛ والمفتاح الأول GEMINI_API_KEY آخرًا
    # لأنه مفتاح الموقع نفسه (المساعد العلمي والترجمة والتحرير في الدوال) فلا يستنفد الوكيل حصته
    order = names[:d] + names[d:][::-1]
    return [n for n in order if n != "GEMINI_API_KEY"] + [n for n in order if n == "GEMINI_API_KEY"]


def probe(model):
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if not k:
        print("bad"); return 1
    body = json.dumps({"contents": [{"parts": [{"text": "ok"}]}], "generationConfig": {"maxOutputTokens": 4}}).encode()
    rq = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=body,
                                headers={"content-type": "application/json", "x-goog-api-key": k})
    try:
        urllib.request.urlopen(rq, timeout=30).read()
        r = "ok"
    except urllib.error.HTTPError as e:
        t = e.read().decode("utf-8", "ignore")[:400]
        r = "quota" if e.code == 429 else "gone" if e.code == 404 else "bad" if e.code in (400, 401, 403) and "API key" in t else "quota" if e.code >= 500 else "bad"
    except Exception:
        r = "quota"  # عطل شبكة عابر: يُعامل كغير متاح الآن
    print(r)
    return 0 if r == "ok" else 1


def reset_at():
    # منتصف الليل بتوقيت المحيط الهادئ ≈ 08:00 UTC (07:00 صيفًا)؛ نأخذ 08:05 احتياطًا
    t = time.time()
    base = int(t - (t % 86400)) + 8 * 3600 + 300
    if base <= t:
        base += 86400
    print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(base)))


def notify(path):
    L = [x for x in load(path).get("items", []) if x.get("u", "") > time.strftime("%Y-%m-%dT%H:%M", time.gmtime(time.time() - 3600))]
    M = {"review": "🔍 بانتظار اعتمادك", "done": "✅ نُفّذ", "need": "❓ يحتاج توضيحًا", "pending": "⏳ يُعاد"}
    for x in L:
        h = (x.get("h") or [{}])[-1]
        if x.get("st") == "pending" and h.get("by") == "agent" and (h.get("n") or 1) > 1:
            continue  # تعثر متكرر نفسه: أُبلغ المدير به أول مرة
        if x.get("st") in M:
            print(f"🛠️ المساعد التقني — {M[x['st']]}: {x.get('t', '')[:80]}\n#/dev")


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
    elif c == "notify":
        notify(sys.argv[2])
    elif c == "status":
        status(sys.argv[2:])
    elif c == "keys":
        print(" ".join(keynames()))
    elif c == "probe":
        sys.exit(probe(sys.argv[2]))
    elif c == "reset_at":
        reset_at()
    else:
        print(__doc__)
