#!/usr/bin/env python3
"""«العقل المتعلّم» للمساعد العلمي: يقرأ المكتبة آليًّا، ويتعلم من محادثات الأعضاء وتقييمهم، ويختبر نفسه ليقيس تقدّمه.

لا يُعاد تدريب أوزان نموذج (لا يتاح مجانًا ولا يؤمن معه الخطأ)، بل يتطور «ما يعرفه المساعد وكيف يعمل» حول النماذج:
١) القراءة (read): يقرأ صفحات الكتب بالترتيب (كتب مشايخ الدعوة، ثم التفريغات، ثم المقالات والفتاوى، ثم المكتبة العامة)،
   ويقدّم ما سأل عنه الأعضاء ولم يجد له المساعد جوابًا كافيًا (الفجوات)، ويستخرج من كل مقطع «بطاقات علمية»:
   سؤال تجيب عنه الصفحة، وخلاصة الجواب، ونص مقتبس بلفظه، ومرجعه (الكتاب:الصفحة)، ونوعه، وبابه.
   لا تُقبل بطاقة إلا إن وُجد اقتباسها بحروفه في الصفحة نفسها، وتُحذف المكررة.
٢) التعلّم من المحادثات (learn): من جدول ask_learn (أسئلة وأجوبة بلا هوية أصحابها، وتقييم 👍/👎 وتصحيح العضو):
   - الجواب المستحسن الموثق بمراجع موجودة يصير بطاقة «سؤال متكرر» (faq) يستدعيها المساعد بعدُ.
   - الجواب المنتقد مع التصحيح يُستخلص منه «درس» عام قصير (توجيه في طريقة العمل) يضاف إلى تعليمات المساعد تلقائيًّا،
     وللإدارة إيقاف أي درس من صفحة «العقل المتعلّم» (#/brain).
   - الأسئلة الضعيفة (بلا مراجع أو منتقدة) تصير «فجوات» توجّه القراءة القادمة إلى موضوعها.
٣) الاختبار الذاتي (eval): أسئلة من البطاقات بصياغة جديدة، يُقاس هل يسترجع الفهرس بطاقتها الصحيحة (دقة الاسترجاع)،
   مع نسبة رضا الأعضاء؛ ويُحفظ المنحنى في data/brain/_meta.json ليُرى التطور يومًا بيوم.
المخرجات: data/brain/cards/<n>.json (البطاقات)، data/brain/ix/<n>.json (فهرس الكلمات)، lessons.json، gaps.json، _meta.json.
المتغيرات: GROQ_API_KEY، GEMINI_API_KEY…، SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY (للتعلّم من المحادثات)،
BRAIN_MINUTES، BRAIN_CHUNKS (حد المقاطع في الجولة)، BRAIN_ENGINES (ترتيب المحركات، الافتراضي groq,gemini).
"""
import os as _o, sys as _s; _s.path.insert(0,_o.path.dirname(_o.path.abspath(__file__))); import manual_guard; manual_guard.guard("brain")  # يدوي فقط
import json, os, re, sys, time, zlib, random, urllib.request, urllib.error, importlib.util, collections

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "brain")
T0, LIMIT = time.time(), int(os.environ.get("BRAIN_MINUTES", "150")) * 60
CHUNKS = int(os.environ.get("BRAIN_CHUNKS", "160"))
ENGINES = [e.strip() for e in os.environ.get("BRAIN_ENGINES", "groq,gemini").split(",") if e.strip()]
PER_SHARD, IXN = 500, 128
REPORT = []


def _mod(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file)); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


SX = _mod("build_sx", "build-sx.py")  # التطبيع والجذوع مطابقة لـ terms() في search.js
import tashjir as T  # noqa: E402  مصدر النصوص (الكتب والمقالات) ومحرك Gemini بمفاتيح خدمات الكتب
from frontmatter import content_range  # noqa: E402
T.DEADLINE[0] = T0 + LIMIT - 25 * 60

KINDS = {"hukm": "حكم", "dalil": "دليل", "tarif": "تعريف", "tarjih": "ترجيح", "qaida": "قاعدة", "faida": "فائدة", "manhaj": "منهج", "aqida": "عقيدة", "tarbiya": "تزكية وتربية", "faq": "سؤال متكرر"}

PROMPT = """أنت باحث شرعي يبني «ذاكرة علمية» لمساعد بحثي. أمامك صفحات من «{title}» لـ{author}، كل صفحة تبدأ بعلامة [ص N].
استخرج أهم المسائل العلمية في هذه الصفحات (من ٠ إلى {k} مسائل)، لكل مسألة:
q: سؤال طبيعي قصير يسأله طالب علم وتجيب عنه الصفحة (بلا إحالة إلى الكتاب).
a: خلاصة الجواب كما في النص في سطر أو سطرين، بلا زيادة من عندك ولا ترجيح لم يذكره المؤلف.
s: اقتباس حرفي من الصفحة (٨ إلى ٤٠ كلمة) يدل على الجواب، منسوخ بحروفه تمامًا.
p: رقم الصفحة N التي فيها الاقتباس.
k: نوعها، واحد من: {kinds}.
t: الباب في كلمتين أو ثلاث (مثل: الطهارة، التوحيد، طلب العلم، الدعوة، السيرة).
تجاهل: الفهارس، والمقدمات الشكلية، وكلام الناشر والمحقق، والأسانيد المجردة، والمسائل التي لا يفهم جوابها إلا بسياق طويل.
أخرج JSON حرفيًا: {{"r": [{{"q": "…", "a": "…", "s": "…", "p": 0, "k": "…", "t": "…"}}]}}

الصفحات:
{text}"""

LESSON = """أنت مشرف على جودة «المساعد العلمي» لمكتبة شرعية. هذه أسئلة أعضاء وأجوبة المساعد التي انتقدوها مع ملاحظاتهم.
استخلص منها دروسًا عامة في طريقة العمل تمنع تكرار الخطأ (لا أحكامًا في مسائل بعينها)، كل درس جملة واحدة آمرة واضحة،
مثل: «إذا سُئلت عن حكم حديث فانقل حكم المحدّث بلفظه ولا تحكم من عندك». لا تكرر ما في الدروس الحالية، ولا تخالف المنهج: النقل من نصوص المكتبة موثقًا.
الدروس الحالية:
{cur}

الحالات:
{cases}

أخرج JSON: {{"r": [{{"t": "الدرس", "why": "سببه في كلمات"}}]}} (من ٠ إلى ٥ دروس)."""

PARA = """أعد صياغة كل سؤال من الأسئلة التالية بألفاظ مختلفة كما يسأله عضو عادي (بلا نسخ ألفاظه)، بنفس المعنى.
أخرج JSON: {{"r": ["…", "…"]}} بالترتيب نفسه.
{qs}"""


# ---------- المحركات ----------
GROQ_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_MODELS = [m.strip() for m in os.environ.get("GROQ_MODELS", "openai/gpt-oss-120b,qwen/qwen3-32b,llama-3.3-70b-versatile").split(",") if m.strip()]
GDEAD = set()


def groq(prompt):
    if not GROQ_KEY: return None
    for m in GROQ_MODELS:
        if m in GDEAD: continue
        body = json.dumps({"model": m, "messages": [{"role": "user", "content": prompt}], "temperature": 0.1, "max_tokens": 5000, "response_format": {"type": "json_object"}}).encode()
        for attempt in range(3):
            try:
                req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=body, headers={"content-type": "application/json", "authorization": "Bearer " + GROQ_KEY, "user-agent": "dawahlibrary-brain/1.0 (+https://dawahlibrary.org)", "accept": "application/json"})
                j = json.load(urllib.request.urlopen(req, timeout=150))
                t = re.sub(r"<think>[\s\S]*?</think>", "", j["choices"][0]["message"]["content"]).strip()
                return json.loads(re.sub(r"^```json|```$", "", t))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore"); print("  Groq", m, e.code, msg[:110], flush=True)
                if e.code in (401, 403, 404, 413) or (e.code == 429 and re.search(r"per day|TPD|RPD|daily", msg, re.I)): GDEAD.add(m); break
                time.sleep(15 * (attempt + 1))
            except Exception as e:
                print("  Groq خطأ", m, str(e)[:100], flush=True); time.sleep(4)
    return None


def llm(prompt):
    for e in ENGINES:
        if time.time() - T0 > LIMIT: return None
        r = groq(prompt) if e == "groq" else T.gemini(prompt) if e == "gemini" else None
        if r: return r
    return None


def dead():
    return (not GROQ_KEY or len(GDEAD) == len(GROQ_MODELS)) and ("gemini" not in ENGINES or not T.KEYS or len(T.EXH) >= len(T.KEYS))


# ---------- التخزين ----------
def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def jw(p, o, ind=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"; json.dump(o, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":") if ind is None else None, indent=ind); os.replace(tmp, p)


class Store:
    """البطاقات في شرائح من ٥٠٠، والفهرس في ١٢٨ ملفًّا بحسب crc32 للكلمة (كفهرس البحث data/sx)."""
    def __init__(self):
        self.meta = jl(os.path.join(OUT, "_meta.json"), {})
        self.n = self.meta.get("cards", 0); self.shards = {}; self.ix = {}; self.dirty = set(); self.ixdirty = set()
        self.seen = None

    def shard(self, s):
        if s not in self.shards: self.shards[s] = jl(os.path.join(OUT, "cards", "%d.json" % s), [])
        return self.shards[s]

    def ixf(self, k):
        if k not in self.ix: self.ix[k] = jl(os.path.join(OUT, "ix", "%d.json" % k), {})
        return self.ix[k]

    def terms(self, c):
        ts = list(dict.fromkeys(SX.stems(c["q"] + " " + c.get("t", "")) + SX.stems(c["a"])[:10]))
        return ts[:24]

    def candidates(self, ts, cap=60):
        sc = collections.Counter()
        for t in ts:
            for i in self.ixf(zlib.crc32(t.encode()) % IXN).get(t, [])[-400:]: sc[i] += 1
        return [i for i, _ in sc.most_common(cap)]

    def get(self, i):
        sh = self.shard(i // PER_SHARD); j = i % PER_SHARD
        return sh[j] if j < len(sh) else None

    def dup(self, c):
        ts = self.terms(c); a = grams(c["q"] + " " + c["a"])
        for i in self.candidates(ts, 30):
            o = self.get(i)
            if not o: continue
            if o.get("r") == c.get("r") and sim(grams(o["q"]), grams(c["q"])) > 0.5: return True
            if sim(grams(o["q"] + " " + o["a"]), a) > 0.62: return True
        return False

    def add(self, c):
        if self.dup(c): return False
        i = self.n; self.n += 1; c["i"] = i
        s = i // PER_SHARD; self.shard(s).append(c); self.dirty.add(s)
        for t in self.terms(c):
            k = zlib.crc32(t.encode()) % IXN; self.ixf(k).setdefault(t, []).append(i); self.ixdirty.add(k)
        return True

    def save(self):
        for s in self.dirty: jw(os.path.join(OUT, "cards", "%d.json" % s), self.shards[s])
        for k in self.ixdirty: jw(os.path.join(OUT, "ix", "%d.json" % k), self.ix[k])
        self.dirty.clear(); self.ixdirty.clear()
        self.meta.update({"cards": self.n, "per": PER_SHARD, "ixn": IXN, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        jw(os.path.join(OUT, "_meta.json"), self.meta, 1)


def grams(s):
    w = SX.NONW.sub(" ", SX.norm(s)).split()
    return {" ".join(w[i:i + 3]) for i in range(max(1, len(w) - 2))}


def sim(a, b):
    return len(a & b) / max(1, min(len(a), len(b)))


def nz(s):
    return re.sub(r"\s+", " ", SX.TASH.sub("", s or "")).strip()


def exact(page, quote):
    """الاقتباس بلفظه من الصفحة (مع تجاهل التشكيل والمسافات)، أو None."""
    q = nz(quote).strip(" «»\"،.:")
    if len(q.split()) < 5: return None
    src, idx, out = page, [], []
    for i, ch in enumerate(src):
        if SX.TASH.match(ch): continue
        if ch.isspace():
            if out and out[-1] == " ": continue
            ch = " "
        out.append(ch); idx.append(i)
    n = "".join(out); j = n.find(q)
    if j < 0: return None
    return src[idx[j]: idx[j + len(q) - 1] + 1].strip()


# ---------- القراءة ----------
def order(cat, gaps):
    """ترتيب القراءة: الكتب المتصلة بالفجوات أولًا، ثم كتب الدعوة، ثم التفريغات، ثم مقالات الدعوة وفتاواها، ثم المكتبة العامة."""
    tr = lambda b: "tafrigh" in (b.get("tags") or []) or re.search("تفريغ|دروس صوتية", b.get("source") or "")
    books = [b for b in cat["books"] if not b.get("hidden") and not b.get("demo") and b.get("type") != "pdf"]
    gw = [w for g in gaps[:20] for w in SX.stems(g["q"])]
    def gscore(b):
        s = SX.norm((b.get("setTitle") or "") + " " + b.get("title", "") + " " + " ".join(t.get("t", "") for t in (b.get("toc") or [])[:80]))
        return sum(1 for w in gw if w in s)
    rank = lambda b: (-min(gscore(b), 5), 0 if b.get("col", "dawah") == "dawah" and not tr(b) else 1 if tr(b) else 3 if b.get("col") == "turath" else 2, b.get("n") or 0)
    ids = [b["id"] for b in sorted(books, key=rank)]
    try:
        arts = [x for x in jl(os.path.join(ROOT, "data", "articles", "index.json"), {"items": []})["items"] if x.get("col", "dawah") == "dawah" and not x.get("h")]
        k = next((i for i, x in enumerate(ids) if (next((b for b in books if b["id"] == x), {}).get("col") == "turath")), len(ids))
        ids[k:k] = [x["id"] for x in arts]
    except Exception: pass
    return ids


def read(st):
    cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})
    prog = st.meta.setdefault("read", {})  # معرف ← آخر صفحة قُرئت
    gaps = jl(os.path.join(OUT, "gaps.json"), {"items": []})["items"]
    done = added = 0
    for bid in order(cat, gaps):
        if done >= CHUNKS or time.time() - T0 > LIMIT or dead(): break
        pos = prog.get(bid, 0)
        if pos == -1: continue
        try: src = T.source(bid, cat)
        except Exception as e: print("تعذر:", bid, e); continue
        if not src: continue
        title, au, pages, _ = src
        if not pages: prog[bid] = -1; continue
        a, z = content_range(pages) if len(pages) > 8 else (1, len(pages))
        p = max(pos + 1, a)
        while p <= z and done < CHUNKS and time.time() - T0 < LIMIT and not dead():
            grp, size = [], 0
            while p <= z and size < 5200:
                body = re.split(r"^\s*_{4,}\s*$", pages[p - 1] or "", maxsplit=1, flags=re.M)[0].strip()
                if len(body) > 120: grp.append((p, body[:4500])); size += len(body[:4500])
                p += 1
            if not grp: continue
            k = max(2, min(8, size // 900))
            r = llm(PROMPT.format(title=title, author=au, k=k, kinds="، ".join(k_ for k_ in KINDS if k_ != "faq"), text="\n\n".join("[ص %d]\n%s" % x for x in grp)))
            if r is None: p = grp[0][0]; break  # تعذر المحرك: تُعاد هذه الصفحات في الجولة القادمة
            done += 1; P = dict(grp)
            for x in (r.get("r") or [])[:10]:
                try:
                    pg = int(x.get("p") or 0); q, ans = str(x.get("q") or "").strip(), str(x.get("a") or "").strip()
                    if pg not in P or len(q) < 8 or len(ans) < 8: continue
                    s = exact(P[pg], str(x.get("s") or "")) or next((exact(P[o], str(x.get("s") or "")) for o in P if o != pg), None)
                    if not s: continue
                    c = {"q": q[:220], "a": ans[:500], "s": s[:700], "r": "%s:%d" % (bid, pg), "k": x.get("k") if x.get("k") in KINDS else "faida", "t": str(x.get("t") or "")[:40]}
                    if st.add(c): added += 1
                except Exception: continue
            prog[bid] = grp[-1][0]
            if done % 10 == 0: st.save(); print("  قُرئ %d مقطعًا، أضيفت %d بطاقة (الكتاب %s ص %d)" % (done, added, bid, prog[bid]), flush=True)
        if p > z: prog[bid] = -1  # اكتملت قراءته
    st.meta["pages_read"] = sum(v for v in prog.values() if v > 0) + 0
    st.meta["books_done"] = sum(1 for v in prog.values() if v == -1)
    st.save(); REPORT.append("📚 قرأ %d مقطعًا وأضاف %d بطاقة علمية (المجموع %d)" % (done, added, st.n))


# ---------- التعلّم من المحادثات ----------
SB, SK = (os.environ.get("SUPABASE_URL", "").strip() or "https://nqxkkdexpodjjwfdkxoq.supabase.co").rstrip("/"), (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY") or "").strip()


def sb(path, method="GET", body=None):
    req = urllib.request.Request(SB + "/rest/v1/" + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"apikey": SK, "authorization": "Bearer " + SK, "content-type": "application/json", "prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=60) as r:
        t = r.read(); return json.loads(t) if t else None


def bookids():
    cat = jl(os.path.join(ROOT, "data", "catalog.json"), {"books": []})
    s = {b["id"] for b in cat["books"]}
    try: s |= {x["id"] for x in jl(os.path.join(ROOT, "data", "articles", "index.json"), {"items": []})["items"]}
    except Exception: pass
    return s


def learn(st):
    if not SB or not SK: REPORT.append("ℹ️ التعلّم من المحادثات ينتظر مفتاح Supabase للخادم في أسرار المستودع"); return
    since = st.meta.get("learn_at", "2000-01-01T00:00:00Z")
    try: rows = sb("ask_learn?select=id,at,q,a,refs,searches,vote,note,mode&at=gt.%s&order=at.asc&limit=2000" % urllib.request.quote(since)) or []
    except Exception as e: REPORT.append("⚠️ تعذرت قراءة المحادثات: %s" % str(e)[:120]); return
    ids, fb = bookids(), st.meta.setdefault("feedback", {"up": 0, "down": 0, "n": 0, "days": {}})
    gaps = jl(os.path.join(OUT, "gaps.json"), {"items": []}); G = {g["k"]: g for g in gaps["items"]}
    bad, faq = [], 0
    for x in rows:
        day = str(x.get("at", ""))[:10]; d = fb["days"].setdefault(day, [0, 0, 0]); d[0] += 1; fb["n"] += 1
        v = int(x.get("vote") or 0)
        if v > 0: fb["up"] += 1; d[1] += 1
        if v < 0: fb["down"] += 1; d[2] += 1
        refs = [r for r in (x.get("refs") or []) if r.split(":")[0] in ids]
        q, a = (x.get("q") or "").strip(), (x.get("a") or "").strip()
        if not q: continue
        if v > 0 and refs and len(a) > 80:  # جواب مستحسن موثق: سؤال متكرر يُسترجع بعدُ
            summ = re.sub(r"\[\[[^\]]+\]\]", "", re.split(r"\n##\s*للمتابعة", a)[0]); summ = re.sub(r"[#*>]+", "", summ).strip()
            if st.add({"q": q[:220], "a": summ[:900], "s": "", "r": refs[0], "rs": refs[:6], "k": "faq", "t": "أسئلة الأعضاء"}): faq += 1
        if v < 0 or not refs:  # فجوة: سؤال لم يُجب جوابًا موثقًا أو انتقده العضو
            key = " ".join(sorted(set(SX.stems(q)))[:6])
            if key: g = G.setdefault(key, {"k": key, "q": q[:200], "n": 0}); g["n"] += 1; g["at"] = day
        if v < 0 and (x.get("note") or "").strip(): bad.append(x)
    gaps["items"] = sorted(G.values(), key=lambda g: (-g["n"], g.get("at", "")), reverse=False)[:300]
    jw(os.path.join(OUT, "gaps.json"), gaps, 1)
    L = jl(os.path.join(OUT, "lessons.json"), {"items": []})
    if bad and not dead():
        cur = "\n".join("- " + l["t"] for l in L["items"] if l.get("on", True)) or "(لا شيء)"
        cases = "\n\n".join("سؤال: %s\nمقتطف الجواب: %s\nملاحظة العضو: %s" % (b["q"][:300], (b.get("a") or "")[:700], b["note"][:400]) for b in bad[-25:])
        r = llm(LESSON.format(cur=cur, cases=cases))
        for y in (r or {}).get("r", [])[:5]:
            t = str(y.get("t") or "").strip()
            if 12 < len(t) < 260 and not any(sim(grams(t), grams(l["t"])) > 0.5 for l in L["items"]):
                L["items"].append({"id": "l%d" % (int(time.time()) % 10**8 + len(L["items"])), "t": t, "why": str(y.get("why") or "")[:160], "at": time.strftime("%Y-%m-%d"), "on": True, "auto": 1})
        L["items"] = L["items"][-60:]; jw(os.path.join(OUT, "lessons.json"), L, 1)
    if rows: st.meta["learn_at"] = rows[-1]["at"]
    fb["days"] = dict(sorted(fb["days"].items())[-120:])
    st.save(); REPORT.append("💬 تعلّم من %d محادثة: %d سؤالًا متكررًا موثقًا، %d فجوة، %d درسًا فعّالًا" % (len(rows), faq, len(gaps["items"]), sum(1 for l in L["items"] if l.get("on", True))))


# ---------- الاختبار الذاتي ----------
def evaluate(st):
    if st.n < 20: return
    rnd = random.Random(int(time.strftime("%Y%m%d")))
    sample = [c for c in (st.get(i) for i in rnd.sample(range(st.n), min(40, st.n))) if c and c.get("k") != "faq"][:30]
    r = llm(PARA.format(qs="\n".join("%d. %s" % (i + 1, c["q"]) for i, c in enumerate(sample)))) if sample else None
    qs = [str(x) for x in (r or {}).get("r", [])][:len(sample)]
    if len(qs) < len(sample) * 0.6:  # تعذرت إعادة الصياغة (نفاد الحصة): لا يُقاس بالسؤال الأصلي لأنه يضخّم الدقة زيفًا
        REPORT.append("🧪 تأجل الاختبار الذاتي: تعذرت إعادة صياغة الأسئلة في هذه الجولة"); return
    hit = sum(1 for c, q in zip(sample, qs) if c["i"] in rank(st, q)[:5])
    fb = st.meta.get("feedback", {}); nv = fb.get("up", 0) + fb.get("down", 0); sat = round(100 * fb.get("up", 0) / nv) if nv else None
    h = st.meta.setdefault("eval", []); h.append({"d": time.strftime("%Y-%m-%d"), "recall": round(100 * hit / max(1, len(qs))), "n": len(qs), "cards": st.n, "sat": sat})
    st.meta["eval"] = h[-180:]; st.save()
    REPORT.append("🧪 الاختبار الذاتي: دقة الاسترجاع %d٪ من %d سؤالًا مُعاد الصياغة، ورضا الأعضاء %s" % (h[-1]["recall"], len(qs), "%d٪" % sat if sat is not None else "— (لا تقييمات بعد)"))


def rank(st, q):
    """الترتيب نفسه في المتصفح (askx.js recall): تطابق الكلمات موزونًا بندرتها."""
    ts = list(dict.fromkeys(SX.stems(q))); sc = collections.Counter()
    for t in ts:
        post = st.ixf(zlib.crc32(t.encode()) % IXN).get(t, [])
        w = 1 / (1 + len(post) / 50)
        for i in post: sc[i] += w
    return [i for i, _ in sc.most_common(10)]


def main():
    cmds = sys.argv[1:] or ["learn", "read", "eval"]
    st = Store()
    for c in cmds:
        if time.time() - T0 > LIMIT: break
        {"read": read, "learn": learn, "eval": evaluate}[c](st)
    print("\n".join(REPORT))
    rp = os.environ.get("GITHUB_STEP_SUMMARY")
    if rp: open(rp, "a", encoding="utf-8").write("\n".join(REPORT) + "\n")


if __name__ == "__main__":
    main()
