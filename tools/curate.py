#!/usr/bin/env python3
"""انتقاء «منشورات المشايخ» وتدقيق «سؤال وجواب» تدقيقًا علميًا دوريًا (Gemini، بالحصة المجانية).

1) الفوائد (data/fawaid.json): من كتب الدعوة المكتمل تدقيقها، يختار النموذج مقاطع تامة المعنى تصلح منشورًا مستقلًا
   (فائدة علمية، شرح عبارة، تعليق، تنبيه، قاعدة)، ويعيد بداية المقطع ونهايته بلفظهما؛ فيُقتطع النص من الكتاب نفسه
   بحروفه (لا صياغة للنموذج)، ويُمد إلى حدود الجمل، ثم تراجعه جولة ثانية: هل هو تام المعنى مفيد مستقل؟ ويُجدول نشره يوميًا.
   وتُحذف تلقائيًا الفائدة التي تغيّر نص صفحتها بعد التصحيح (البصمة h) حتى يعاد انتقاؤها.
2) مراجعة سؤال وجواب (data/qa/_review.json): يحكم النموذج هل الجواب المنقول يجيب السؤال جوابًا تامًا؛
   فيعلَّم ok أو flag (للمشرف) — ولا يُخفى شيء آليًا؛ الإخفاء والتصحيح للمشرف.
المتغيرات: CUR_MODE=fawaid|qa|all، CUR_MAX (حد الطلبات)، CUR_PER_DAY (فوائد تُنشر يوميًا).
"""
import datetime, hashlib, json, os, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from gkeys import keys as _gkeys  # noqa: E402  (tools/gkeys.py)
KEYS = _gkeys("bulk")
MODEL = os.environ.get("CUR_MODEL", "gemini-flash-latest")
BUDGET = [int(os.environ.get("CUR_MAX", "80"))]
# حد زمني يترك وقتًا للحفظ قبل مهلة المهمة (حين تتزاحم المهام على حصة Gemini نفسها)
DEADLINE = time.time() + 60 * float(os.environ.get("CUR_MINUTES", "95"))
EXH = set()
DIAC = re.compile(r"[\u064B-\u0652\u0670\u0640]")
REPORT = []


def gemini(prompt):
    if BUDGET[0] <= 0 or time.time() > DEADLINE:
        return None
    for k in range(len(KEYS)):
        if k in EXH:
            continue
        for attempt in range(4):
            if time.time() > DEADLINE:
                return None
            try:
                body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json", "maxOutputTokens": 16000}}).encode()
                req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % MODEL, data=body, headers={"content-type": "application/json", "x-goog-api-key": KEYS[k]})
                with urllib.request.urlopen(req, timeout=240) as r:
                    j = json.loads(r.read())
                BUDGET[0] -= 1
                t = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"] if not p.get("thought"))
                return json.loads(re.sub(r"^```json|```$", "", t.strip()))
            except urllib.error.HTTPError as e:
                msg = e.read()[:300].decode("utf-8", "ignore")
                if e.code == 429 and re.search(r"day|PerDay", msg, re.I):
                    EXH.add(k); break
                time.sleep(15 * (attempt + 1))
            except Exception:
                time.sleep(5 * (attempt + 1))
    return None


def nmap(s):
    """نص مطبّع (بلا تشكيل، والألفات موحدة) مع خريطة مواضعه إلى النص الأصلي."""
    out, idx = [], []
    for i, c in enumerate(s):
        if DIAC.match(c):
            continue
        c = {"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه"}.get(c, c)
        if not re.match(r"[\u0621-\u064A0-9]", c):
            c = " "
        if c == " " and out and out[-1] == " ":
            continue
        out.append(c); idx.append(i)
    return "".join(out), idx


def locate(text, start, end):
    n, idx = nmap(text)
    s1 = nmap(start)[0].strip(); e1 = nmap(end)[0].strip()
    if len(s1) < 8 or len(e1) < 8:
        return None
    a = n.find(s1)
    if a < 0:
        return None
    b = n.find(e1, a)
    if b < 0:
        return None
    ia, ib = idx[a], idx[min(len(idx) - 1, b + len(e1) - 1)] + 1
    # التوسيع إلى حدود الجمل: البداية من أول الجملة (بعد آخر نقطة أو علامة استفهام أو سطر جديد قبلها في حدود ٢٥٠ حرفًا)،
    # والنهاية إلى آخر الجملة؛ فلا يبدأ المنشور ولا ينتهي في منتصف فكرة
    m0 = list(re.finditer(r"[.؟!:]\s|\n", text[max(0, ia - 250):ia]))
    if m0:
        ia = max(0, ia - 250) + m0[-1].end()
    elif ia <= 250:
        ia = 0
    m = re.search(r"[.؟!»)](?=\s|$)", text[ib:ib + 260])
    if m:
        ib = ib + m.end()
    return polish(text[ia:ib])


# ---------- جودة المنشور (طلب المدير، ٢١ نوفمبر ٢٠٢٦): جمل تامة المعنى واضحة السياق ذات فائدة، بلا مقدمات ولا مقتطفات مبتورة ----------
FN_MARK = re.compile(r"\s*(\(¬?\d{1,3}\)|\[\d{1,3}\]|¬\d{1,3}|\(\*+\))")
OPEN_BAD = re.compile(r"^(و|ف|ثم|أو|أم|بل|لكن|لكنه|ولكن|حتى|إذ|إذن|أي|يعني|وهذا|وهذه|وذلك|فهذا|فهذه|فذلك|هذا|هذه|ذلك|تلك|هؤلاء|هو|هي|هم|وهو|وهي|وهم|فهو|فهي|"
                      r"كما|كذلك|لذلك|لذا|ولهذا|فلهذا|ولذلك|وعليه|وعلى هذا|فإن|فإنه|فإنها|وإن|وإنما|إلا|غير أن|مع أن|والثاني|والثالث|الثاني|الثالث|ثانيًا|ثالثًا|"
                      r"أيضًا|أيضا|وأيضًا|منها|ومنها|فيه|فيها|عليه|عليها|قوله|وقوله|قلت|قالوا|المسألة الثانية)(\s|،|:)")
INTRO = re.compile(r"^(الحمد لله|إن الحمد لله|بسم الله الرحمن|أما بعد|وبعد|مقدمة|تمهيد|المقدمة|فهذا كتاب|فهذه رسالة|هذا الكتاب|في هذا الكتاب|في هذه الرسالة|"
                   r"نبدأ|نستكمل|نواصل|نكمل|كنا قد|كنا نتكلم|توقفنا|في الدرس|في المحاضرة|في اللقاء|في الحلقة|الدرس|المحاضرة|اللقاء|الحلقة|"
                   r"السلام عليكم|أيها الإخوة|أيها الأحبة|إخواني|أحبتي|معاشر|الفصل|الباب|المبحث|المطلب|فصل|باب)")
REFS = re.compile(r"كما تقدم|كما سبق|سبق ذكره|سبق بيانه|كما سيأتي|سيأتي بيانه|سيأتي إن شاء الله|المذكور آنفًا|المذكورة آنفًا|انظر ص|انظر:? ?الصفحة|في الصفحة السابقة|في الحلقة السابقة|في المقال السابق|المذكور أعلاه|السابق ذكره")
CLOSE_OK = re.compile(r"[.؟!»)\]﴿﴾»\"]\s*(اهـ|اه|ا\.هـ)?\.?\s*$")


def polish(t):
    """تنظيف المقطع: رموز الحواشي ونجومها، والفراغات والأسطر الزائدة، وعلامات القطع في طرفيه."""
    t = FN_MARK.sub("", t or "")
    t = re.sub(r"^[\s…\.\-–—،:؛]+", "", t); t = re.sub(r"[\s…]+$", "", t)
    t = re.sub(r"[ \t]+", " ", t); t = re.sub(r"\n{3,}", "\n\n", t)
    if t.startswith("(") and t.count("(") > t.count(")"): t = t[1:]
    return t.strip()


def strip_fatwa_intro(t):
    """جواب الفتوى بلا خطبة الحاجة («الحمد لله، والصلاة والسلام على رسول الله، أما بعد؛»)."""
    t = re.sub(r"^.{0,40}?(الجواب|الإجابة)\s*:?\s*", "", t, flags=re.S) if re.match(r"^.{0,40}?(الجواب|الإجابة)\s*:", t, re.S) else t
    t2 = re.sub(r"^\s*الحمد لله[^.؛]{0,120}?(أما بعد|وبعد)\s*[؛:،]?\s*", "", t, flags=re.S).strip()
    if t2 != t.strip(): t2 = re.sub(r"^ف(?=إن|إنه|إنها|إنما|لا |يجوز|يجب|الواجب|الصحيح|الراجح)", "", t2)  # «أما بعد؛ فإن…» ← «إن…»
    return t2


def quality(t):
    """None إن صلح المقطع منشورًا مستقلًا، وإلا سبب رفضه."""
    if not t: return "فارغ"
    w = len(re.findall(r"[\u0621-\u064A]+", t))
    if w < 25: return "قصير"
    if w > 300: return "طويل"
    head = DIAC.sub("", t[:60]).lstrip("«\"(")
    if INTRO.match(head): return "مقدمة"
    if OPEN_BAD.match(head): return "يبدأ بربط أو إحالة"
    if REFS.search(DIAC.sub("", t)): return "إحالة إلى سياق"
    if not CLOSE_OK.search(t): return "مبتور الآخر"
    for a, b in ("()", "«»", "[]", "﴿﴾"):  # فرق واحد يُحتمل (اختلاف علامات النقل في المصدر)، وأكثر منه قطع داخل نقل
        if abs(t.count(a) - t.count(b)) > 1: return "قوس مفتوح"
    if re.search(r"[(«﴿\[][^)»﴾\]]{0,80}$", t) and not re.search(r"[)»﴾\]]", t[-80:]): return "قوس مفتوح في آخره"
    if len(re.findall(r"\d", t)) > max(12, len(t) // 25): return "أرقام وفهارس"
    return None


def fp(t):
    return hashlib.md5(DIAC.sub("", t or "").encode()).hexdigest()[:10]


PICK = """أنت محرر علمي في مكتبة الدعوة السلفية. من النص الآتي (من كتاب «{title}» لـ{author}، والصفحات معلّمة بـ[ص N])
اختر ما يصلح «منشورًا» مستقلًا يفيد القارئ وحده دون سياقه: فائدة علمية تامة، أو شرح عبارة أو مصطلح، أو تعليق على أمر، أو تنبيه، أو قاعدة.
الشروط الملزمة:
- جمل تامة المعنى واضحة السياق: يبدأ بأول جملة وينتهي بنهاية جملة، ويُفهم مغزاه كاملًا دون ما قبله وما بعده.
- لا يبدأ بضمير أو اسم إشارة يعود على ما قبله (هذا، ذلك، هو…) ولا بأداة ربط معلّقة (و، ف، ثم، لكن، كما، لذلك، ومنها…)، ولا يحيل إلى ما سبق أو سيأتي.
- استبعد: المقدمات وخطب الحاجة والافتتاحيات والترحيب، وتمهيد الدروس («في الدرس الماضي»، «نستكمل»)، والفهارس والعناوين، وتراجم الإسناد المجردة، والمقتطفات المبتورة التي تخلّ بالمغزى.
- ذو فائدة علمية ظاهرة (حكم، قاعدة، معنى، تنبيه، توجيه تربوي، رد شبهة)؛ بين ٣٠ و٢٢٠ كلمة.{extra}
أعد JSON: {{"items": [ {{"type": "فائدة|شرح|تعليق|تنبيه|قاعدة|فتوى", "page": رقم_الصفحة, "start": "أول ٨ كلمات من المقطع بلفظها حرفيًا", "end": "آخر ٨ كلمات من المقطع بلفظها حرفيًا", "score": درجة الفائدة من ١ إلى ٥}} ]}}
اختر من ٠ إلى {n} مقاطع فقط، والأجود أولًا، ولا تختر ما درجته دون ٤. إن لم يوجد ما يستحق فأعد قائمة فارغة.

{text}"""

CHECK = """أنت مدقق علمي. قيّم كل مقطع منقول من كتاب أو فتوى أو مقال ليُنشر منشورًا مستقلًا:
١) تام المعنى: أوله أول جملة وآخره آخر جملة، لا بتر يخل بالمغزى. ٢) واضح السياق: يُفهم وحده دون ما قبله وما بعده، لا إحالة فيه.
٣) ليس مقدمة ولا افتتاحية ولا تمهيدًا لدرس ولا فهرسًا. ٤) ذو فائدة علمية ظاهرة. ٥) لا يوهم خلاف مقصود قائله إذا اقتُطع.
أعد JSON: {{"r": [ {{"i": رقمه, "ok": true فقط إن تحققت الخمسة, "why": "سبب قصير إن كان false"}} ]}}

{items}"""


ARTIDX, GROUPS = None, {}


def art_index():
    global ARTIDX
    if ARTIDX is None:
        ip = os.path.join(ROOT, "data", "articles", "index.json")
        ARTIDX = json.load(open(ip, encoding="utf-8"))["items"] if os.path.exists(ip) else []
    return ARTIDX


def art_pages(x):
    g = GROUPS.get(x["f"])
    if g is None:
        try:
            g = GROUPS[x["f"]] = json.load(open(os.path.join(ROOT, "data", "articles", x["f"] + ".json"), encoding="utf-8"))
        except Exception:
            g = GROUPS[x["f"]] = {}
    return (g.get(x["id"]) or {}).get("pages") or []


def dawah_articles():
    """مقالات مكتبة الدعوة الصالحة للانتقاء: غير مخفية ولا إثرائية ولا فتاوى ولا بيانات، ولها نص كافٍ؛ الأحدث أولًا."""
    out = [x for x in art_index() if not x.get("h") and x.get("col") not in ("ithra", "turath") and x.get("f") and not x.get("fa") and not re.match(r"(أسئلة|الاستفتاء|من فقه الواقع)", x.get("c") or "") and x.get("tp") not in ("at16", "at17")]
    return sorted(out, key=lambda x: x.get("d") or "", reverse=True)


FAT_HINT = """
- هذا نص فتوى (سؤال وجواب): اختر من الجواب وحده ما يحمل الحكم وتعليله تامًّا، بلا خطبة الحاجة («الحمد لله… أما بعد»)، وبلا نص السؤال؛ فالسؤال يُعرض عنوانًا للمنشور."""


def dawah_fatwas():
    """فتاوى الدعوة السلفية (صوت السلف) غير المخفية، الأحدث أولًا."""
    out = [x for x in art_index() if not x.get("h") and x.get("col") not in ("ithra", "turath") and x.get("f") and (x.get("fa") or re.match(r"(أسئلة|الاستفتاء|من فقه الواقع)", x.get("c") or ""))]
    return sorted(out, key=lambda x: x.get("d") or "", reverse=True)


def fawaid(cat):
    p = os.path.join(ROOT, "data", "fawaid.json")
    F = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"items": [], "done": {}}
    books = [b for b in cat["books"] if b.get("col") == "dawah" and b.get("type", "book") == "book" and not b.get("demo") and not (b.get("ocr") and (b.get("unrev") or b.get("lite")))]
    au = {a["id"]: a["name"] for a in cat["authors"]}
    shards = {}
    AX = {x["id"]: x for x in art_index()}
    def shard(bid):
        if bid not in shards:
            pth = os.path.join(ROOT, "data", "books", bid + ".json")
            if os.path.exists(pth):
                shards[bid] = json.load(open(pth, encoding="utf-8"))
            elif bid in AX:
                shards[bid] = {"pages": art_pages(AX[bid])}
            else:
                shards[bid] = None
        return shards[bid]
    # إسقاط ما تغيّر نصه
    keep = []
    for it in F["items"]:
        sh = shard(it["b"])
        if sh and 0 < it["p"] <= len(sh["pages"]) and re.sub(r"\s+", " ", DIAC.sub("", polish(it["text"])))[:40] in re.sub(r"\s+", " ", DIAC.sub("", FN_MARK.sub("", (sh["pages"][it["p"] - 1] or "") + "\n" + (sh["pages"][it["p"]] if it["p"] < len(sh["pages"]) else "")))):
            keep.append(it)
    dropped = len(F["items"]) - len(keep)
    # فحص الجودة على المجدول والمنشور سابقًا: ما لم يستوف الشروط يُخفى (hide="q" بسببه) ولا يُحذف؛ وللإدارة إظهاره
    hid = 0
    for it in keep:
        if it.get("hide"): continue
        t2 = polish(it["text"])
        if t2 != it["text"] and t2: it["text"] = t2
        why = quality(it["text"])
        if why: it["hide"] = "q"; it["why"] = why; hid += 1
    F["items"] = keep
    new, rej = [], {}

    def take(r, sid, pages, p0, n, kind, q=None):
        """يقتطع المقاطع المختارة بحروفها من المصدر ويمررها على فحص الجودة الآلي قبل جولة التدقيق."""
        for x in (r or {}).get("items", [])[:n]:
            try: sc = float(x.get("score") or 4)
            except (TypeError, ValueError): sc = 4
            if sc < 4: rej["درجة الفائدة"] = rej.get("درجة الفائدة", 0) + 1; continue
            try: pg = int(x.get("page") or p0)
            except (TypeError, ValueError): pg = p0
            pg = max(1, min(len(pages), pg))
            src = "\n".join(pages[max(0, pg - 1):min(len(pages), pg + 1)])
            if kind == "f": src = strip_fatwa_intro(src)
            t = locate(src, x.get("start", ""), x.get("end", ""))
            if kind == "f" and t: t = strip_fatwa_intro(t)
            why = quality(t) or (None if t and 150 <= len(t) <= 1800 else "الطول")
            if why: rej[why] = rej.get(why, 0) + 1; continue
            it = {"id": fp(sid + t), "b": sid, "p": pg, "t": "فتوى" if kind == "f" else x.get("type", "فائدة"), "k": kind, "text": t}
            if q: it["q"] = q
            new.append(it)
    half = BUDGET[0] * 3 // 5  # الكتب أولًا (٤٠٪ من الحصة)، ثم الفتاوى والمقالات مناصفة
    for b in books:
        sh = shard(b["id"])
        if not sh:
            continue
        pages = sh["pages"]
        done = F["done"].get(b["id"], 0)
        while done < len(pages) and BUDGET[0] > half:
            a, z = done, min(len(pages), done + 8)
            text = "\n".join("[ص %d]\n%s" % (i + 1, re.split(r"^\s*_{4,}\s*$", pages[i] or "", flags=re.M)[0]) for i in range(a, z))
            done = z
            if len(re.sub(r"\s", "", text)) < 600:
                continue
            r = gemini(PICK.format(title=b.get("setTitle") or b["title"], author=au.get(b.get("authorId"), ""), n=3, extra="", text=text[:40000]))
            if r is None:  # تعذر الطلب (نفاد الحصة أو المهلة): لا تُعدّ هذه الصفحات مقروءة، ويُستأنف منها لاحقًا
                done = a
                BUDGET[0] = min(BUDGET[0], 2)
                break
            take(r, b["id"], pages, a + 1, 3, "b")
        F["done"][b["id"]] = done
        if BUDGET[0] <= half:
            break
    # الفتاوى والمقالات: كل مادة طلب واحد، الأحدث أولًا، ولا تُعاد مادة قُرئت؛ الفتاوى إلى نصف الباقي ثم المقالات
    nart, nfat = 0, 0
    mid = max(2, BUDGET[0] // 2)
    for kind, lst in (("f", dawah_fatwas()), ("a", dawah_articles())):
        for x in lst:
            if BUDGET[0] <= (mid if kind == "f" else 2) or F["done"].get(x["id"]):
                continue
            pages = art_pages(x)
            text = "\n".join("[ص %d]\n%s" % (i + 1, re.split(r"^\s*_{4,}\s*$", pg or "", flags=re.M)[0][:9000]) for i, pg in enumerate(pages[:6]))
            F["done"][x["id"]] = 1
            if len(re.sub(r"\s", "", text)) < (500 if kind == "f" else 900):
                continue
            r = gemini(PICK.format(title=x["t"], author=au.get(x.get("a"), ""), n=1 if kind == "f" else 2, extra=FAT_HINT if kind == "f" else "", text=text[:40000]))
            if r is None:
                F["done"].pop(x["id"], None); break
            if kind == "f": nfat += 1
            else: nart += 1
            take(r, x["id"], pages, 1, 1 if kind == "f" else 2, kind, q=x["t"] if kind == "f" else None)
    # جولة التدقيق الثانية
    ok = []
    for k in range(0, len(new), 12):
        part = new[k:k + 12]
        rv = gemini(CHECK.format(items="\n\n".join("مقطع %d:\n%s" % (i, x["text"]) for i, x in enumerate(part))))
        good = {r.get("i") for r in (rv or {}).get("r", []) if r.get("ok") is True} if rv else set()
        ok += [x for i, x in enumerate(part) if i in good]
    have = {x["id"] for x in F["items"]}
    ok = [x for x in ok if x["id"] not in have]
    # جدولة النشر: عدد ثابت يوميًا بعد آخر تاريخ مجدول
    per = int(os.environ.get("CUR_PER_DAY", "8"))
    # تُملأ الأيام من اليوم فصاعدًا حتى لا تخلو أيام من منشورات جديدة
    cnt = {}
    for x in F["items"]:
        cnt[x.get("date", "")] = cnt.get(x.get("date", ""), 0) + 1
    d = datetime.date.today()
    for x in ok:
        while cnt.get(d.isoformat(), 0) >= per:
            d += datetime.timedelta(days=1)
        x["date"] = d.isoformat(); cnt[x["date"]] = cnt.get(x["date"], 0) + 1
        F["items"].append(x)
    json.dump(F, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("منشورات المشايخ: أضيفت %d فائدة مدققة (كتب %d، فتاوى %d، مقالات %d؛ قُرئت %d فتوى و%d مقالًا)، ورُفض آليًّا %d مقطعًا (%s)، وأُخفي %d من السابق لم يستوف الشروط، وسُحبت %d تغيّر نصها؛ والمجدول حتى %s" % (
        len(ok), sum(1 for x in ok if x.get("k", "b") == "b"), sum(1 for x in ok if x.get("k") == "f"), sum(1 for x in ok if x.get("k") == "a"), nfat, nart,
        sum(rej.values()), "، ".join("%s %d" % kv for kv in sorted(rej.items(), key=lambda kv: -kv[1])) or "—", hid, dropped, d.isoformat()))


QA_PICK = """أنت محرر علمي في مكتبة الدعوة السلفية. من النص الآتي (من «{title}» لـ{author}، والصفحات معلّمة بـ[ص N])
استخرج أسئلة يجيب عنها النص نفسه جوابًا تامًا واضحًا: سؤال قصير طبيعي يسأله القارئ (ما حكم…؟ ما معنى…؟ لماذا…؟ ما الفرق بين…؟ كيف…؟)،
وجوابه مقطع من النص بلفظه. لا تؤلف جوابًا من عندك، ولا تختر سؤالًا لا يجيبه المقطع كاملًا، ولا أسئلة عن المؤلف أو الكتاب نفسه.
أعد JSON: {{"items": [ {{"q": "السؤال", "page": رقم_الصفحة, "start": "أول ٨ كلمات من الجواب بلفظها حرفيًا", "end": "آخر ٨ كلمات من الجواب بلفظها حرفيًا"}} ]}}
من ٠ إلى {n} أسئلة، والأنفع أولًا؛ والجواب بين ٢٥ و٢٥٠ كلمة. إن لم يوجد فأعد قائمة فارغة.

{text}"""


def qa_ai(cat):
    """أسئلة وأجوبة من كتب الدعوة المدققة ومقالاتها: السؤال مصوغ آليًا، والجواب مقطع بنص المصدر (k="ai")،
    يُحفظ في data/qa/_ai.json ويدمجه tools/qa.py في القسم. نصف الحصة المتبقية للكتب ونصفها للمقالات."""
    p = os.path.join(ROOT, "data", "qa", "_ai.json")
    Q = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"items": [], "done": {}}
    au = {a["id"]: a["name"] for a in cat["authors"]}
    have = {DIAC.sub("", x["q"])[:80] for x in Q["items"]}
    added = 0
    def take(r, src_id, pages, a0):
        nonlocal added
        for x in (r or {}).get("items", [])[:4]:
            q = (x.get("q") or "").strip()
            if not (8 <= len(q) <= 200) or DIAC.sub("", q)[:80] in have:
                continue
            pg = int(x.get("page") or a0)
            src = "\n".join(pages[max(0, pg - 1):min(len(pages), pg + 1)])
            t = locate(src, x.get("start", ""), x.get("end", ""))
            if t and 120 <= len(t) <= 1800:
                have.add(DIAC.sub("", q)[:80]); added += 1
                Q["items"].append({"id": "ai" + fp(src_id + q), "b": src_id, "q": q, "a": t, "p": pg, "k": "ai", "more": False})
    start = BUDGET[0]
    books = [b for b in cat["books"] if b.get("col") == "dawah" and b.get("type", "book") == "book" and not b.get("demo") and not b.get("hidden") and not (b.get("ocr") and (b.get("unrev") or b.get("lite")))]
    for b in books:
        if BUDGET[0] <= start // 2:
            break
        pth = os.path.join(ROOT, "data", "books", b["id"] + ".json")
        if not os.path.exists(pth):
            continue
        pages = json.load(open(pth, encoding="utf-8")).get("pages") or []
        done = Q["done"].get(b["id"], 0)
        while done < len(pages) and BUDGET[0] > start // 2:
            a, z = done, min(len(pages), done + 10)
            text = "\n".join("[ص %d]\n%s" % (i + 1, re.split(r"^\s*_{4,}\s*$", pages[i] or "", flags=re.M)[0]) for i in range(a, z))
            done = z
            if len(re.sub(r"\s", "", text)) < 800:
                continue
            r = gemini(QA_PICK.format(title=b.get("setTitle") or b["title"], author=au.get(b.get("authorId"), ""), n=4, text=text[:40000]))
            if r is None:
                done = a; break
            take(r, b["id"], pages, a + 1)
        Q["done"][b["id"]] = done
    for x in dawah_articles():
        if BUDGET[0] <= 2:
            break
        if Q["done"].get(x["id"]):
            continue
        pages = art_pages(x)
        text = "\n".join("[ص %d]\n%s" % (i + 1, (pg or "")[:9000]) for i, pg in enumerate(pages[:6]))
        Q["done"][x["id"]] = 1
        if len(re.sub(r"\s", "", text)) < 900:
            continue
        r = gemini(QA_PICK.format(title=x["t"], author=au.get(x.get("a"), ""), n=3, text=text[:40000]))
        if r is None:
            Q["done"].pop(x["id"], None); break
        take(r, x["id"], pages, 1)
    json.dump(Q, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("سؤال وجواب من كتب الدعوة ومقالاتها: أضيف %d سؤالًا (المجموع %d)" % (added, len(Q["items"])))


QA_CHECK = """أنت مدقق علمي. لكل سؤال وجواب منقولين من كتاب: هل الجواب يجيب السؤال جوابًا تامًا مفهومًا؟ وهل السؤال واضح؟
أعد JSON: {{"r": [ {{"i": رقمه, "ok": true أو false, "why": "سبب قصير إن كان false"}} ]}}

{items}"""


def qa_review():
    ip, rp = os.path.join(ROOT, "data", "qa", "_index.json"), os.path.join(ROOT, "data", "qa", "_review.json")
    if not os.path.exists(ip):
        return
    idx = json.load(open(ip, encoding="utf-8"))["items"]
    rev = json.load(open(rp, encoding="utf-8")) if os.path.exists(rp) else {}
    todo = [r for r in idx if r[0] not in rev]
    todo.sort(key=lambda r: 0 if r[2].startswith("p") or not r[2].split("-")[0].isalpha() else 1)
    files, n_ok, n_flag = {}, 0, 0
    for k in range(0, len(todo), 15):
        if BUDGET[0] <= 0:
            break
        part = []
        for r in todo[k:k + 15]:
            if r[2] not in files:
                files[r[2]] = {x["id"]: x for x in json.load(open(os.path.join(ROOT, "data", "qa", r[2] + ".json"), encoding="utf-8"))["items"]}
            it = files[r[2]].get(r[0])
            if it:
                part.append(it)
        rv = gemini(QA_CHECK.format(items="\n\n".join("%d) س: %s\nج: %s" % (i, x["q"], x["a"][:1200]) for i, x in enumerate(part))))
        if not rv:
            break
        for r in rv.get("r", []):
            i = r.get("i")
            if isinstance(i, int) and 0 <= i < len(part):
                if r.get("ok"):
                    rev[part[i]["id"]] = {"s": "ok", "by": "auto", "at": datetime.date.today().isoformat()}; n_ok += 1
                else:
                    rev[part[i]["id"]] = {"s": "flag", "why": (r.get("why") or "")[:160], "by": "auto", "at": datetime.date.today().isoformat()}; n_flag += 1
    json.dump(rev, open(rp, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    REPORT.append("سؤال وجواب: رُوجع %d (سليم %d، وعُلّم للمشرف %d)" % (n_ok + n_flag, n_ok, n_flag))


def main():
    cat = json.load(open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8"))
    mode = os.environ.get("CUR_MODE", "all")
    total = BUDGET[0]
    if mode in ("fawaid", "all"):
        BUDGET[0] = total // 3 if mode == "all" else total
        fawaid(cat)
    if mode in ("qa", "all"):
        BUDGET[0] = total // 3 if mode == "all" else total // 2
        qa_ai(cat)
        BUDGET[0] = max(BUDGET[0], total // 3 if mode == "all" else total // 2)
        qa_review()
    if REPORT:
        open(os.path.join(ROOT, ".cur-report.txt"), "w", encoding="utf-8").write("🔎 <b>الانتقاء والتدقيق العلمي</b>\n" + "\n".join(REPORT))
    print("\n".join(REPORT))


if __name__ == "__main__":
    main()
