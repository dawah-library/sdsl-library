#!/usr/bin/env python3
"""خدمة شرح الكتب والمتون — محرك المطابقة (المرحلة ٤ من خطة المدير، ٢٠ نوفمبر ٢٠٢٦).

البنية الملزمة: نص الأصل ونص الشرح كتابان مستقلان في المكتبة لا يُعدَّلان أبدًا، وبينهما «طبقة ربط» (anchors) فقط:
  data/shp/_list.json            فهرس المشاريع
  data/shp/<pid>.json            المشروع: الأصل (مجلداته)، والشروح والحواشي (لكل عمل مؤلفه ولونه ومجلداته وما يقابلها من الأصل)، والحالة والسجل
  data/shp/<pid>/<wid>.json      الربط لكل عمل: لكل مجلد شرح قائمة مقاطع تغطي نصه كله بلا نقص ولا تكرار،
                                  ولكل مقطع: موضعه في الشرح (فقرات a..z)، والموضع المشروح في الأصل (مجلد، وحدة)، والثقة، والحالة.
الوحدة في الأصل: فقرة (أو جملة من فقرة طويلة) — المعرّف "<صفحة>.<ترتيبها في الصفحة>"، تُحسب حتميًّا من النص (unitsOf في sharh.js مطابقة).
الفقرات في الشرح: كل سطر غير فارغ من الصفحة بترتيبه (والحواشي معها)، مرقمة تسلسليًّا في المجلد كله.

المراحل: (١) تقسيم الأصل إلى وحدات (٢) تقسيم الشرح إلى مقاطع عند «قوله…» ونحوها (٣) مرشحون لكل مقطع: مطابقة اللفظ المقتبس،
ثم تشابه دلالي (تضمينات Gemini إن توفر مفتاح، وإلا تشابه معجمي) (٤) ترتيب رتيب يحفظ تسلسل الأصل مع السماح بالتقديم والتأخير بعقوبة
(٥) ترجيح بنموذج لغوي للمواضع المترددة (٦) الثقة: ≥ ٠٫٨ «مقترح بثقة»، وما دونها «للمراجعة» — ولا يوضع مقطع في موضع لا تسنده قرينة: st=none.
الحالة تُحفظ بعد كل مجلد، فإضافة مجلدات لاحقًا لا تعيد ما عولج، وما اعتمده المراجع (st=ok) لا يُمس أبدًا.

الاستعمال: python3 tools/sharh-align.py [معرف المشروع…] [--redo]   (بلا معرفات: كل مشروع فيه مجلدات لم تُعالج)
المتغيرات: SHP_LLM=0 لإيقاف الترجيح بالنموذج، SHP_EMB=0 لإيقاف التضمينات، SHP_MAXLLM (أقصى طلبات الترجيح في الجولة، ٦٠).
"""
import datetime, hashlib, json, math, os, re, sys, time, urllib.request, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); SHP = os.path.join(D, "shp")
sys.path.insert(0, os.path.join(ROOT, "tools"))
DI = re.compile(r"[ً-ْٰـ]")
LEM = re.compile(r"^\s*(?:#+\s*)?(?:\(?\d+\)?\s*[-–.]?\s*)?(قوله|وقوله|قال المصنف|قال المؤلف|قال الناظم|قال الماتن|قال الشيخ|قال الطحاوي|قال رحمه الله|قال -رحمه الله-)(?:\s*(?:ﷺ|صلى الله عليه وسلم|-صلى الله عليه وسلم-|تعالى|رحمه الله|-رحمه الله-))?\s*[:،]?\s*(.*)$")
REPORT = []


def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def js(p, o, ind=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, **({"indent": ind} if ind else {"separators": (",", ":")}))


def norm(s):
    s = DI.sub("", s or "")
    s = re.sub("[إأآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ئ", "ي").replace("ؤ", "و").replace("ء", "")
    return re.sub(r"[^ء-ي0-9 ]+", " ", s).split()


def shard(bid):
    for p in (os.path.join(D, "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p): return jl(p)
    return None


def body(pg):
    return re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0]


def units_of(pages):
    """وحدات الأصل: [(id, text)] — مطابقة تمامًا لـunitsOf في sharh.js."""
    out = []
    for i, pg in enumerate(pages, 1):
        k = 0
        for para in [l.strip() for l in body(pg).split("\n") if l.strip()]:
            parts = [para] if len(para) <= 420 else [x.strip() for x in re.split(r"(?<=[.؟!:])\s+", para) if x.strip()]
            for t in parts:
                out.append(("%d.%d" % (i, k), re.sub(r"^#+\s*", "", t))); k += 1
    return out


def paras_of(pages):
    """فقرات الشرح المسطحة: [(page, text)] — كل سطر غير فارغ (والحواشي) عدا خط الفصل؛ مطابقة لـparasOf في sharh.js."""
    out = []
    for i, pg in enumerate(pages, 1):
        for l in (pg or "").split("\n"):
            if l.strip() and not re.match(r"^\s*_{4,}\s*$", l): out.append((i, l.strip()))
    return out


def lemma_of(t):
    if t.startswith("%% "):  # سطر متن في التفريغات والشروح المصفوفة (series.py: المتن المقروء يبدأ بـ «%% »)
        s = " ".join(t[3:].split()[:14]); return s if len(norm(s)) >= 2 else None
    m = LEM.match(DI.sub("", t))  # الشروح المشكولة: «قَوْلُهُ ﷺ: (…)»
    if not m: return None
    s = m.group(2).strip()
    q = re.match(r'^["«“\(](.+?)["»”\)]', s)
    s = q.group(1) if q else re.split(r"[:]\s|\.\s", s)[0]
    s = re.sub(r"\s*(\.\.\.|…|إلى آخره|إلخ|الخ)\s*$", "", s)
    return s if len(norm(s)) >= 1 else None


def segments(paras):
    """يقسم فقرات المجلد مقاطع تغطيها كلها: يبدأ مقطع جديد عند كل «قوله…»؛ وإن قلّت هذه العلامات فعند العناوين أو كل ~١٢٠٠ حرف."""
    marks = [i for i, (_, t) in enumerate(paras) if lemma_of(t)]
    starts = set(marks)
    if len(marks) < max(3, len(paras) * 0.02):
        starts, size = set(), 0
        for i, (_, t) in enumerate(paras):
            if i == 0 or t.startswith("#") or size > 1200: starts.add(i); size = 0
            size += len(t)
    starts.add(0); st = sorted(starts); segs = []
    for j, a in enumerate(st):
        z = (st[j + 1] - 1) if j + 1 < len(st) else len(paras) - 1
        lem = lemma_of(paras[a][1]); segs.append({"a": a, "z": z, "p": paras[a][0], "lem": lem or ""})
    assert sum(s["z"] - s["a"] + 1 for s in segs) == len(paras)  # التغطية الكاملة لنص الشرح
    return segs


# ---------- التشابه ----------
def tfidf(docs):
    df = collections.Counter(); bags = []
    for d in docs:
        w = norm(d); g = w + [w[i] + "_" + w[i + 1] for i in range(len(w) - 1)]
        c = collections.Counter(g); bags.append(c); df.update(set(c))
    N = len(docs) + 1
    vecs = []
    for c in bags:
        v = {k: (1 + math.log(n)) * math.log(N / (1 + df[k])) for k, n in c.items()}
        s = math.sqrt(sum(x * x for x in v.values())) or 1; vecs.append({k: x / s for k, x in v.items()})
    return vecs


def inverted(V):
    inv = collections.defaultdict(list)
    for i, v in enumerate(V):
        for k, w in v.items(): inv[k].append((i, w))
    return inv


def topk(q, inv, k, terms=40):
    """استرجاع سريع بالفهرس المقلوب (لا مقارنة شاملة): يكفي للمتون الكبيرة كالصحيحين."""
    acc = collections.defaultdict(float)
    for t, w in sorted(q.items(), key=lambda x: -x[1])[:terms]:
        post = inv.get(t)
        if not post or len(post) > 6000: continue  # كلمة شائعة جدًّا لا تميّز
        for i, x in post: acc[i] += w * x
    return sorted(((v, i) for i, v in acc.items()), reverse=True)[:k]


def cos(a, b):
    if isinstance(a, dict): return sum(x * b.get(k, 0) for k, x in a.items())
    return sum(x * y for x, y in zip(a, b))


def gem_keys():
    try:
        import gkeys; return [k for _, k in gkeys.keys("study")] or [k for _, k in gkeys.keys()]
    except Exception:
        return [os.environ[k] for k in ["GEMINI_API_KEY"] + ["GEMINI_API_KEY_%d" % i for i in range(2, 21)] if os.environ.get(k)]


KEYS = gem_keys(); KI = [0]


def post(url, body):
    for _ in range(max(1, len(KEYS))):
        k = KEYS[KI[0] % len(KEYS)]
        try:
            r = urllib.request.Request(url, json.dumps(body).encode(), {"content-type": "application/json", "x-goog-api-key": k})
            return json.load(urllib.request.urlopen(r, timeout=120))
        except Exception as e:
            KI[0] += 1; err = e
    raise err


def embed(texts):
    """تضمينات Gemini (gemini-embedding-001) دفعات من ١٠٠؛ None إن تعذر."""
    if not KEYS or os.environ.get("SHP_EMB") == "0": return None
    out = []
    try:
        for i in range(0, len(texts), 100):
            b = post("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
                     {"requests": [{"model": "models/gemini-embedding-001", "content": {"parts": [{"text": t[:2000]}]}, "taskType": "SEMANTIC_SIMILARITY", "outputDimensionality": 256} for t in texts[i:i + 100]]})
            for e in b["embeddings"]:
                v = e["values"]; s = math.sqrt(sum(x * x for x in v)) or 1; out.append([x / s for x in v])
        return out
    except Exception as e:
        REPORT.append("التضمينات تعذرت (%s)؛ استُعمل التشابه المعجمي" % str(e)[:80]); return None


LLM_LEFT = [int(os.environ.get("SHP_MAXLLM", "60"))]


def llm_pick(seg_text, cands):
    """يختار النموذج الموضع المشروح من المرشحين أو «لا شيء»؛ يعيد (الفهرس أو -1، الثقة) أو None."""
    if not KEYS or os.environ.get("SHP_LLM") == "0" or LLM_LEFT[0] <= 0: return None
    LLM_LEFT[0] -= 1
    prompt = ("أمامك مقطع من شرح على متن، ومواضع مرشحة من المتن. حدد الموضع الذي يشرحه المقطع بفهم المعنى (قد لا يعيد الشارح لفظ المتن، "
              "وقد يقول «قوله كذا» أو «يريد بهذا»)، أو -1 إن لم يكن شرحًا لأي منها (مقدمة أو استطراد عام).\n"
              "أخرج JSON فقط: {\"pick\": رقم المرشح أو -1, \"conf\": 0..1}\n\nالمقطع:\n" + seg_text[:3500] + "\n\nالمرشحون:\n" +
              "\n".join("[%d] %s" % (i, t[:500]) for i, t in enumerate(cands)))
    for model in ("gemini-flash-latest", "gemini-flash-lite-latest"):
        try:
            r = post("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model,
                     {"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}})
            t = "".join(p.get("text", "") for p in r["candidates"][0]["content"]["parts"] if not p.get("thought"))
            j = json.loads(t); return int(j.get("pick", -1)), float(j.get("conf", 0.5))
        except Exception:
            continue
    return None


def pratio(a, b):
    """أعلى تشابه بين a وأي مقطع من b بطوله (جزئي)."""
    import difflib
    if not a or not b: return 0.0
    if a in b: return 1.0
    if len(b) <= len(a): return difflib.SequenceMatcher(None, a, b).ratio()
    sm = difflib.SequenceMatcher(None, b, a); best = 0.0
    for blk in sm.get_matching_blocks():
        st = max(0, blk.a - blk.b); best = max(best, difflib.SequenceMatcher(None, a, b[st:st + len(a)]).ratio())
    return best


# ---------- المطابقة ----------
def align(matn_units, segs, paras):
    """matn_units: [(vol, uid, text)] بترتيب الأصل. يعيد لكل مقطع: m, u, c, st, alt."""
    seg_txt = [" ".join(t for _, t in paras[s["a"]:s["z"] + 1]) for s in segs]
    utxt = [t for _, _, t in matn_units]; nu = [" ".join(norm(t)) for t in utxt]
    emb = embed(utxt + [x[:2000] for x in seg_txt]) if len(utxt) <= 4000 else None  # المتون الكبيرة: تشابه معجمي بفهرس مقلوب (حفظًا للحصة والوقت)
    if emb: U, S = emb[:len(utxt)], emb[len(utxt):]
    else: V = tfidf(utxt + seg_txt); U, S = V[:len(utxt)], V[len(utxt):]
    V0 = tfidf(utxt + [(s["lem"] or seg_txt[j][:300]) for j, s in enumerate(segs)]); U0, S0 = V0[:len(utxt)], V0[len(utxt):]  # مرشحو اللفظ المقتبس
    nus = [u.replace(" ", "") for u in nu]; nws = [set(u.split()) for u in nu]
    INV0 = inverted(U0); INV = inverted(U) if not emb else None
    wix = collections.defaultdict(set)
    for i, ws_ in enumerate(nws):
        for w in ws_: wix[w].add(i)
    cand = []
    big = len(utxt) > 4000; WIN = None  # المتن الكبير: نافذة التغطية من قرائن اللفظ المقتبس، والتشابه المعجمي يُعاير
    for j, s in enumerate(segs):
        sc = []
        lem = " ".join(norm(s["lem"])) if s["lem"] else ""
        if lem:  # اللفظ المقتبس: أقوى قرينة — مطابقة تقريبية تتحمل فروق النسخ («شي/شيء»، «بعدما/بعد ما»)، وببادئة اللفظ إن طال بكلام الشارح
            lw = lem.split(); hits = []
            cnt = collections.Counter(i for w in set(lw[:5]) for i in (wix.get(w) or ()) if len(wix.get(w) or ()) < 8000)
            pool = [i for i, c in cnt.most_common(60) if c >= min(2, len(set(lw[:5])))] or [i for _, i in topk(S0[j], INV0, 25)]
            for k in [len(lw)] + [x for x in (10, 7, 5, 3) if x < len(lw)]:
                L0 = "".join(lw[:k]); hits = [(i, pratio(L0, nus[i])) for i in pool]; hits = [(i, r) for i, r in hits if r >= 0.86]
                if hits: break
            top = max((r for _, r in hits), default=0); hits = [(i, r) for i, r in hits if r >= top - 0.02]
            hits = [(i, r) for i, r in hits if not utxt[i].startswith("(^")]  # حواشي المحقق ليست من المتن
            for i, r in hits: sc.append((i, (1.0 if r >= 0.92 and k >= 3 else 0.9) if len(hits) == 1 else 0.74))  # لفظ يتكرر في مواضع (كالأسانيد): يحسمه الترتيب لا اللفظ
        sims = [(v, i) for v, i in topk(S[j], INV, 300) if WIN is None or WIN[0] <= i <= WIN[1]][:5] if INV is not None else sorted(((cos(S[j], U[i]), i) for i in range(len(U))), reverse=True)[:5]
        for v, i in sims:
            if not any(i == x for x, _ in sc): sc.append((i, max(0.0, min(0.85, v * (2.2 if INV is not None else 1)))))
        cand.append(sorted(sc, key=lambda x: -x[1])[:6])
        if big and WIN is None and j == len(segs) - 1: pass
    if big:  # جولة ثانية بالنافذة: ما بين أول قرينة لفظية وآخرها (بهامش) — الشرح يغطي جزءًا من المتن الكبير غالبًا
        hit = sorted(i for cs in cand for i, v in cs if v >= 0.86)
        if len(hit) >= 3:
            lo, hi = hit[max(0, len(hit) // 20)], hit[min(len(hit) - 1, len(hit) - 1 - len(hit) // 20)]; WIN = (max(0, lo - 150), hi + 300)
            for j, s in enumerate(segs):
                keep = [(i, v) for i, v in cand[j] if v >= 0.74]
                extra = [(i, max(0.0, min(0.85, v * 2.2))) for v, i in topk(S[j], INV, 300) if WIN[0] <= i <= WIN[1]][:5]
                cand[j] = sorted(keep + [x for x in extra if not any(x[0] == y for y, _ in keep)], key=lambda x: -x[1])[:6]
    # ترتيب رتيب: برمجة ديناميكية على المرشحين؛ الرجوع إلى الوراء يُعاقب ولا يُمنع (الشارح قد يقدّم ويؤخّر)
    best = [{} for _ in segs]
    for j, cs in enumerate(cand):
        for i, v in cs + [(-1, 0.15)]:
            if j == 0: best[j][i] = (v, None); continue
            opts = []
            for pi, (pv, _) in best[j - 1].items():
                pen = 0 if i == -1 or pi == -1 or i >= pi else (0.25 if pi - i < 8 else 0.45)
                opts.append((pv + v - pen, pi))
            best[j][i] = max(opts)
    path = [None] * len(segs); cur = max(best[-1], key=lambda k: best[-1][k][0]) if segs else None
    for j in range(len(segs) - 1, -1, -1): path[j] = cur; cur = best[j][cur][1]
    out = []
    for j, s in enumerate(segs):
        i = path[j]; cs = cand[j]; v = dict(cs).get(i, 0.15 if i == -1 else 0)
        top = cs[0][1] if cs else 0; second = cs[1][1] if len(cs) > 1 else 0
        c = v if s["lem"] and v >= 0.9 else (min(0.78, v + 0.25 * (top - second)) if i is not None and i != -1 else 0.3)
        if c < 0.8 and cs:  # موضع متردد: ترجيح النموذج اللغوي
            r = llm_pick(seg_txt[j], [utxt[x] for x, _ in cs])
            if r:
                k, lc = r
                if k == -1: i, c = -1, lc * 0.9
                elif 0 <= k < len(cs): i = cs[k][0]; c = max(c, lc * (0.95 if i == path[j] else 0.85))
        rec = {"a": s["a"], "z": s["z"], "p": s["p"], "lem": s["lem"][:200], "c": round(c, 2),
               "alt": [[matn_units[x][0], matn_units[x][1], round(y, 2)] for x, y in cs[:4]]}
        if i is None or i == -1: rec.update({"m": None, "u": None, "st": "none" if j == 0 or c >= 0.6 else "review"})
        else: rec.update({"m": matn_units[i][0], "u": matn_units[i][1], "st": "auto" if c >= 0.8 else "review"})
        rec["_i"] = i; out.append(rec)
    # الاتساق المحلي: موضع متردد يقع بين جاريه الموثوقين في ترتيب المتن (وقريبًا منهما) يُرفع إلى «مقترح بثقة»؛ وموضع موثوق يشذ بعيدًا عنهما يُنزل للمراجعة
    good = [k for k, r in enumerate(out) if r["_i"] not in (None, -1) and r["c"] >= 0.9]
    for k, r in enumerate(out):
        i = r["_i"]
        if i in (None, -1): continue
        pv = next((out[g]["_i"] for g in reversed(good) if g < k), None); nx = next((out[g]["_i"] for g in good if g > k), None)
        if pv is None or nx is None: continue
        inside = pv - 3 <= i <= nx + 3 and nx - pv <= 600
        if inside and 0.6 <= r["c"] < 0.8: r["c"] = 0.82; r["st"] = "auto"
        elif not inside and r["st"] == "auto" and nx - pv <= 600 and r["c"] < 1.0: r["c"] = 0.65; r["st"] = "review"
    for r in out: r.pop("_i", None)
    return out


def run(pid, redo=False):
    pp = os.path.join(SHP, pid + ".json"); P = jl(pp)
    if not P: REPORT.append("%s: لا مشروع" % pid); return
    matn = [v for v in P.get("matn", []) if shard(v)]
    mu_all = {v: units_of(shard(v)["pages"]) for v in matn}
    for w in P.get("works", []):
        ap = os.path.join(SHP, pid, w["w"] + ".json"); A = jl(ap, {"w": w["w"], "vols": {}})
        for cv in w.get("vols", []):
            b = cv["b"]; old = A["vols"].get(b)
            if old and old.get("done") and not redo: continue
            sh = shard(b)
            if not sh: REPORT.append("%s/%s: مجلد الشرح %s غير موجود بعد" % (pid, w["w"], b)); continue
            mv = [v for v in (cv.get("m") or matn) if v in mu_all]
            units = [(v, uid, t) for v in mv for uid, t in mu_all[v]]
            paras = paras_of(sh["pages"]); segs = segments(paras)
            res = align(units, segs, paras)
            if old:  # ما اعتمده المراجع أو نقله لا يُمس
                keep = {(x["a"], x["z"]): x for x in old.get("segs", []) if x.get("st") in ("ok", "moved")}
                res = [keep.get((x["a"], x["z"]), x) for x in res]
            A["vols"][b] = {"done": True, "at": datetime.date.today().isoformat(), "np": len(paras), "segs": res,
                            "h": hashlib.md5(json.dumps(sh["pages"], ensure_ascii=False).encode()).hexdigest()[:10]}
            js(ap, A)
            n = collections.Counter(x["st"] for x in res)
            REPORT.append("%s / %s / %s: %d مقطعًا — بثقة %d، للمراجعة %d، غير مربوط %d" % (pid, w.get("t", w["w"]), b, len(res), n["auto"] + n["ok"], n["review"], n["none"]))
        stat(P, w, A)
    P["at"] = datetime.date.today().isoformat(); js(pp, P, 1)
    L = jl(os.path.join(SHP, "_list.json"), {}) or {}
    L[pid] = {"t": P.get("t", pid), "matn": P.get("matn", []), "st": P.get("st", "draft"), "works": len(P.get("works", [])), "prog": P.get("prog", 0), "rev": P.get("rev", 0), "at": P["at"]}
    js(os.path.join(SHP, "_list.json"), L, 1)


def stat(P, w, A):
    """سجل المشروع: المجلدات المرفوعة والمعالجة، والمواضع التي تحتاج مراجعة، ونسبة الإنجاز."""
    segs = [x for v in A["vols"].values() for x in v.get("segs", [])]
    w["log"] = {"up": len(w.get("vols", [])), "done": sum(1 for v in w.get("vols", []) if (A["vols"].get(v["b"]) or {}).get("done")),
                "segs": len(segs), "ok": sum(1 for x in segs if x["st"] in ("ok", "moved")), "auto": sum(1 for x in segs if x["st"] == "auto"),
                "rev": sum(1 for x in segs if x["st"] == "review"), "none": sum(1 for x in segs if x["st"] == "none")}
    tot = sum(x["log"]["segs"] for x in P["works"] if x.get("log")) or 1
    P["rev"] = sum(x["log"]["rev"] for x in P["works"] if x.get("log"))
    P["prog"] = round(100 * sum(x["log"]["ok"] + x["log"]["none"] for x in P["works"] if x.get("log")) / tot)


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not ids: ids = [k for k in (jl(os.path.join(SHP, "_list.json"), {}) or {})]
    for pid in ids: run(pid, "--redo" in sys.argv)
    print("\n".join(REPORT) or "لا مشاريع تحتاج معالجة")
