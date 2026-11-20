#!/usr/bin/env python3
"""النشرة البريدية الأسبوعية (المرحلة ٩): جديد الكتب والإصدارات في أسبوعها، والتطويرات الجديدة في المنصة، وفائدة علمية مختارة
بنصها وعزوها، وكتاب الأسبوع برابطه؛ مع رابط إلغاء الاشتراك بضغطة في كل رسالة.
- العدد يُحفظ علنًا (بلا عناوين) في data/newsletter/<التاريخ>.json ويُعرض أرشيفه في #/newsletter.
- الإرسال: Resend (RESEND_API_KEY) إلى المؤكَّدين في public.subscribers (SUPABASE_URL + SUPABASE_SECRET_KEY) ممن اختاروا newsletter.
- بلا مفاتيح: يُبنى العدد ويُحفظ ولا يُرسل. NL_DRY=1 للتجربة دون إرسال.
"""
import datetime, html, json, os, random, re, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data")
SITE = (os.environ.get("SITE_URL") or "https://dawahlibrary.org").rstrip("/")
jl = lambda p, d=None: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
E = html.escape


def build(today):
    cat = jl(os.path.join(D, "catalog.json")); A = {a["id"]: a for a in cat["authors"]}; since = str(today - datetime.timedelta(days=7))
    new = [b for b in cat["books"] if (b.get("added") or "") >= since and not b.get("hidden") and not (b.get("vol") or 0) > 1][:12]
    rel = [x for x in (jl(os.path.join(D, "releases.json"), {}) or {}).get("items", []) if str(x.get("at") or x.get("d") or "") >= since][:5]
    fw = (jl(os.path.join(D, "fawaid.json"), {}) or {}).get("items", []); random.seed(str(today)); f = random.choice(fw) if fw else None
    wk = jl(os.path.join(D, "weekly.json"), {}) or {}; cur = None
    if wk.get("st") == "ok": cur = next((w for w in reversed(wk.get("weeks", [])) if w["from"] <= str(today)), None)
    dev = []
    ab = os.path.join(ROOT, "docs", "requirements-2026-11.md")
    if os.path.exists(ab): dev = [re.sub(r"\s+", " ", m).strip() for m in re.findall(r"^\| ([^|]{6,90}) \| [^|]+ \| منجز", open(ab, encoding="utf-8").read(), re.M)][:5]
    return {"date": str(today), "new": [{"id": b["id"], "t": b.get("setTitle") or b["title"], "a": A.get(b.get("authorId"), {}).get("name", "")} for b in new],
            "rel": [{"t": x.get("t") or x.get("title"), "u": x.get("u") or x.get("url")} for x in rel],
            "faida": {"t": f["text"].strip("() "), "b": f["b"], "p": f["p"], "bt": next((b.get("setTitle") or b["title"] for b in cat["books"] if b["id"] == f["b"]), "")} if f else None,
            "week": {"b": cur["b"], "t": cur["t"], "a": cur["a"], "sn": cur["sn"][0]} if cur else None, "dev": dev}


def html_of(N, unsub):
    li = lambda xs: "".join("<li>%s</li>" % x for x in xs)
    h = ['<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;padding:22px;border:1px solid #e5e1d8;border-radius:14px;background:#fffdf8;color:#222;line-height:1.9">',
         '<h2 style="color:#0f5c4d;margin:0">مكتبة الدعوة السلفية الرقمية</h2><p style="color:#7a6a4a;margin:0 0 14px">النشرة الأسبوعية — %s</p>' % E(N["date"])]
    if N.get("week"): w = N["week"]; h.append('<h3 style="color:#0f5c4d">📖 كتاب الأسبوع: %s</h3><p>%s</p><blockquote style="border-right:4px solid #b88a2e;margin:0;padding:6px 12px;background:#f7f1e3">«%s» <small>(ص %s)</small></blockquote><p><a href="%s/book/%s/1">اقرأ الكتاب</a></p>' % (E(w["t"]), E(w["a"]), E(w["sn"]["t"]), w["sn"]["p"], SITE, E(w["b"])))
    if N["new"]: h.append('<h3 style="color:#0f5c4d">🆕 جديد الكتب</h3><ul>%s</ul>' % li('<a href="%s/book/%s/1">%s</a> — %s' % (SITE, E(b["id"]), E(b["t"]), E(b["a"])) for b in N["new"]))
    if N["rel"]: h.append('<h3 style="color:#0f5c4d">📚 جديد الإصدارات</h3><ul>%s</ul>' % li(E(r["t"] or "") for r in N["rel"]))
    if N["dev"]: h.append('<h3 style="color:#0f5c4d">🛠️ جديد المنصة</h3><ul>%s</ul>' % li(E(x) for x in N["dev"]))
    if N.get("faida"): f = N["faida"]; h.append('<h3 style="color:#0f5c4d">💡 فائدة علمية</h3><p>«%s»</p><p style="font-size:13px;color:#666">— %s، ص %s • <a href="%s/book/%s/%s">موضعها</a></p>' % (E(f["t"]), E(f["bt"]), f["p"], SITE, E(f["b"]), f["p"]))
    h.append('<p style="font-size:12px;color:#999;margin-top:22px">وصلتك هذه الرسالة لاشتراكك في النشرة. <a href="%s">إلغاء الاشتراك بضغطة</a> • <a href="%s/newsletter">الأرشيف</a></p></div>' % (unsub, SITE))
    return "".join(h)


def sb(path, method="GET", body=None):
    k = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY"); h = {"apikey": k, "content-type": "application/json"}
    if not k.startswith("sb_"): h["Authorization"] = "Bearer " + k
    req = urllib.request.Request(os.environ["SUPABASE_URL"] + "/rest/v1/" + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    today = datetime.date.today(); N = build(today)
    os.makedirs(os.path.join(D, "newsletter"), exist_ok=True)
    json.dump(N, open(os.path.join(D, "newsletter", N["date"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    idx = jl(os.path.join(D, "newsletter", "_index.json"), {"items": []}); idx["items"] = [x for x in idx["items"] if x != N["date"]] + [N["date"]]
    json.dump(idx, open(os.path.join(D, "newsletter", "_index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    key = os.environ.get("RESEND_API_KEY")
    if not key or not os.environ.get("SUPABASE_URL") or os.environ.get("NL_DRY") == "1": print("بُني العدد ولم يُرسل (لا مفاتيح أو تجربة)"); return
    subs = sb("subscribers?select=email,token&confirmed=eq.true&unsub_at=is.null&kinds=cs.%7Bnewsletter%7D&limit=5000")
    sent = 0
    for i in range(0, len(subs), 90):  # دفعات Resend (١٠٠ كحد)
        batch = [{"from": os.environ.get("MAIL_FROM") or "مكتبة الدعوة السلفية الرقمية <noreply@dawahlibrary.org>", "to": s["email"], "subject": "النشرة الأسبوعية — " + N["date"],
                  "html": html_of(N, "%s/api/notify?unsub=%s&k=newsletter" % (SITE, s["token"])), "headers": {"List-Unsubscribe": "<%s/api/notify?unsub=%s&k=newsletter>" % (SITE, s["token"])}} for s in subs[i:i + 90]]
        req = urllib.request.Request("https://api.resend.com/emails/batch", data=json.dumps(batch).encode(), headers={"Authorization": "Bearer " + key, "content-type": "application/json"})
        try: urllib.request.urlopen(req, timeout=60); sent += len(batch)
        except Exception as e: print("تعذر دفعة:", str(e)[:120])
    N["sent"] = sent; json.dump(N, open(os.path.join(D, "newsletter", N["date"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("أُرسلت النشرة إلى %d مشتركًا" % sent)


if __name__ == "__main__":
    main()
