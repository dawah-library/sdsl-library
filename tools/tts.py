#!/usr/bin/env python3
"""صوتيات المكتبة: تحويل نصوص الكتب إلى صوت مجانًا (أصوات Edge العصبية عبر edge-tts) وحفظها في «إصدارات» GitHub.

لكل كتاب إصدار باسم audio-<المعرف>، وفيه ملف صوتي لكل صفحة pNNNN.mp3، وملف بيان data/audio/<المعرف>.json
فيه مدة كل صفحة وتوقيت جملها (لإظهار النص متزامنًا أثناء الاستماع)، وبصمة نصها (تُعاد الصفحة إذا تغيّر نصها بعد التدقيق).
الطابور data/audio/_queue.json:
  {"items": [{"id": "<كتاب>", "voice": "ar-SA-HamedNeural", "rate": "-5%"},   # "pages": [3, 7] لإعادة صفحات بعينها
             {"id": "<كتاب>", "rec": {"f": "au....mp3", "t": "عنوان التسجيل", "p": 1}}]}
المتغيرات: TTS_MAX_MIN (حد دقائق التشغيل)، TTS_CONC (التوازي)، TTS_ONLY (كتب بعينها)، TTS_REFRESH=1 (إعادة الصفحات التي تغيّر نصها)
"""
import asyncio, glob, hashlib, json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUD = os.path.join(ROOT, "data", "audio")
REPO = os.environ.get("GITHUB_REPOSITORY", "dawah-library/sdsl-library")
T0 = time.time()
MAXMIN = float(os.environ.get("TTS_MAX_MIN", "300"))
CONC = int(os.environ.get("TTS_CONC", "6"))
VOICE = os.environ.get("TTS_VOICE", "gemini:Charon")  # الافتراضي: أصوات Gemini الأحدث، وعند نفاد الحصة Edge
EDGE_FALLBACK = os.environ.get("TTS_EDGE_FALLBACK", "ar-SA-HamedNeural")
VOICES = {"ar-SA-HamedNeural": "حامد (سعودي)", "ar-EG-ShakirNeural": "شاكر (مصري)", "ar-SA-ZariyahNeural": "زارية", "ar-EG-SalmaNeural": "سلمى",
          "ar-AE-HamdanNeural": "حمدان", "ar-KW-FahedNeural": "فهد (كويتي)", "ar-QA-MoazNeural": "معاذ", "ar-JO-TaimNeural": "تيم"}
WORK = os.path.join(ROOT, ".tts-work")
REPORT = []


def log(*a):
    print(*a, flush=True)


def jload(p, d):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return d


def jsave(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def left():
    return MAXMIN * 60 - (time.time() - T0)


def shard(bid):
    for p in (os.path.join(ROOT, "data", "books", bid + ".json"), os.path.join(ROOT, "vols", bid + ".json")):
        if os.path.exists(p):
            return jload(p, None)
    return None


def catalog():
    return jload(os.path.join(ROOT, "data", "catalog.json"), {"books": [], "authors": []})


FN = re.compile(r"^\s*_{4,}\s*$", re.M)


LEX = []


def clean(t):
    """نص الصفحة كما يُقرأ: بلا حواشٍ ولا علامات تنسيق ولا أرقام إحالات."""
    t = str(t or "")
    m = FN.search(t)
    if m:
        t = t[:m.start()]
    t = re.sub(r"-*\s*NO PAGE\s*NO\s*-*", " ", t, flags=re.I)
    t = re.sub(r"\[\[[^\]]*\]\]", " ", t)
    t = re.sub(r"\[(?:مخطوط|رسم[^\]]*|جدول[^\]]*|صورة[^\]]*)\]", " ", t)
    t = re.sub(r"^#+\s*", "", t, flags=re.M)
    t = t.replace("**", "").replace("ﷺ", " صلى الله عليه وسلم ").replace("ﷻ", " جل جلاله ")
    for w, r in LEX:  # قاموس النطق من الإدارة (data/audio/_lexicon.json): كلمة كاملة ← نطقها
        t = re.sub(r"(?<![\u0621-\u064A])" + re.escape(w) + r"(?![\u0621-\u064A])", r, t)
    t = re.sub(r"[﴿﴾{}]", " ", t)
    t = re.sub(r"\(\s*[\d٠-٩]{1,3}\s*\)", " ", t)  # أرقام الحواشي
    t = re.sub(r"^\s*[-–—]?\s*[\d٠-٩]{1,4}\s*[-–—]?\s*$", "", t, flags=re.M)  # أرقام الصفحات المنفردة
    t = re.sub(r"[ \t]+", " ", t)
    lines = [l.strip() for l in t.split("\n")]
    out = []
    for l in lines:  # دمج الأسطر المكسورة في جمل
        if out and l and out[-1] and not re.search(r"[.؟!:؛»)\]]$", out[-1]):
            out[-1] += " " + l
        else:
            out.append(l)
    t = "\n".join(x for x in out if x)
    return t.strip()


def h(t):
    return hashlib.md5(t.encode("utf-8")).hexdigest()[:10]


def gh(*args, check=True):
    r = subprocess.run(["gh"] + list(args), capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError("gh %s: %s" % (" ".join(args[:3]), r.stderr.strip()[:300]))
    return r


def ensure_release(tag, title):
    if gh("release", "view", tag, "-R", REPO, check=False).returncode == 0:
        return
    gh("release", "create", tag, "-R", REPO, "--title", title, "--notes", "ملفات صوتية لكتاب في مكتبة الدعوة السلفية الرقمية (تُعرض في قسم صوتيات المكتبة).", "--latest=false")


def upload(tag, files):
    for i in range(0, len(files), 25):
        part = files[i:i + 25]
        for attempt in range(4):
            r = gh("release", "upload", tag, "-R", REPO, "--clobber", *part, check=False)
            if r.returncode == 0:
                break
            log("  إعادة الرفع:", r.stderr.strip()[:200])
            time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError("تعذر رفع الملفات الصوتية")


def commit(msg):
    if os.environ.get("TTS_COMMIT") != "1":
        return
    subprocess.run(["git", "add", "data/audio"], cwd=ROOT)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
        return
    subprocess.run(["git", "commit", "-qm", msg], cwd=ROOT, check=True)
    for _ in range(5):
        subprocess.run(["git", "pull", "-q", "--rebase", "-X", "theirs", "origin", "main"], cwd=ROOT)
        if subprocess.run(["git", "push", "-q", "origin", "HEAD:main"], cwd=ROOT).returncode == 0:
            return
        time.sleep(4)


PUN = re.compile(r"[.؟!:؛،\n]")


def phrases(text, words):
    """تقسيم نص الصفحة إلى عبارات قصيرة بتوقيتها، بمطابقة كلمات الصوت على النص الأصلي (لإبراز العبارة أثناء الاستماع)."""
    pos, cur = [], 0
    for ms, w in words:
        w = w.strip()
        if not w:
            continue
        i = text.find(w, cur)
        if i < 0 or i - cur > 200:
            continue
        pos.append((ms, i, i + len(w)))
        cur = i + len(w)
    if not pos:
        return []
    out, start, n = [], 0, 0
    for k, (ms, a, b) in enumerate(pos):
        n += 1
        nxt = pos[k + 1][1] if k + 1 < len(pos) else len(text)
        gap = text[b:nxt]
        if k + 1 == len(pos) or (n >= 4 and PUN.search(gap)) or n >= 22:
            seg = text[pos[start][1]:nxt].strip()
            if seg:
                out.append([pos[start][0], seg])
            start, n = k + 1, 0
    return out


# الأحدث أولًا، ثم الأقدم عند عدم توفره أو نفاد حصته
GEM_TTS_MODELS = [m for m in os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts").split(",") if m.strip()]
GEM_DEAD = set()  # (مفتاح، نموذج) نفدت حصته في هذا التشغيل


def speak_gemini(text, voice, path, style=""):
    """أصوات Gemini (طبقات صوتية أقرب إلى الطبيعية، ضمن الحصة المجانية لمفاتيح Gemini). الصوت: Charon أو Orus أو Kore…
    لا يعيد مواضع الكلمات، فيُقدَّر توقيت الجمل بنسبة طولها إلى مدة المقطع."""
    import base64, json as _j, urllib.request, tempfile
    keys = [os.environ[k] for k in sorted(os.environ) if k.startswith("GEMINI_API_KEY") and os.environ[k]]
    if not keys: raise RuntimeError("لا مفتاح Gemini")
    prompt = (style or "اقرأ النص التالي بالعربية الفصحى قراءة علمية هادئة واضحة، مع مراعاة التشكيل كما هو، دون زيادة أو حذف:") + "\n\n" + text
    body = _j.dumps({"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}).encode()
    err = None
    import urllib.error
    pairs = [(m, k) for m in GEM_TTS_MODELS for k in keys if (k, m) not in GEM_DEAD]
    for m, k in pairs:
        try:
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent", data=body, headers={"content-type": "application/json", "x-goog-api-key": k})
            j = _j.load(urllib.request.urlopen(req, timeout=300))
            pcm = base64.b64decode(j["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
            with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as f: f.write(pcm)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", f.name, "-b:a", "48k", path], check=True)
            os.unlink(f.name)
            break
        except urllib.error.HTTPError as e:
            err = e
            if e.code in (429, 404, 403): GEM_DEAD.add((k, m))
            continue
        except Exception as e:
            err = e; continue
    else:
        raise RuntimeError("Gemini TTS: %s" % err)
    dur = mp3_secs(path) * 1000
    sents = [x for x in re.split(r"(?<=[.؟!:؛])\s+|\n+", text) if x.strip()]
    tot = sum(len(x) for x in sents) or 1; at = 0; out = []
    for x in sents: out.append([int(at / tot * dur), x.strip()]); at += len(x)
    return out


async def speak(text, voice, rate, path):
    if str(voice).startswith("gemini:"):  # محرك Gemini بدل Edge
        try: return speak_gemini(text, voice.split(":", 1)[1], path)
        except Exception as e:  # نفدت حصة كل المفاتيح: يكمل بصوت Edge المجاني فلا يتوقف التحويل
            log("Gemini TTS غير متاح الآن (%s)، يكمل بصوت %s" % (str(e)[:120], EDGE_FALLBACK))
            voice, rate = EDGE_FALLBACK, "-5%"
    import edge_tts
    buf, words, sents = bytearray(), [], []
    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:
        comm = edge_tts.Communicate(text, voice, rate=rate)
    async for ch in comm.stream():
        if ch["type"] == "audio":
            buf.extend(ch["data"])
        elif ch["type"] == "WordBoundary":
            words.append([int(ch["offset"] / 10000), ch["text"]])
        elif ch["type"] == "SentenceBoundary":
            sents.append([int(ch["offset"] / 10000), ch["text"]])
    if not buf:
        raise RuntimeError("لا صوت")
    open(path, "wb").write(bytes(buf))
    return phrases(text, words) or sents


def mp3_secs(path):
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
        return round(float(r.stdout.strip()), 1)
    except Exception:
        return round(os.path.getsize(path) / 6000.0, 1)  # 48 كيلوبت/ث تقريبًا


def _fnv(s):
    h = 0x811c9dc5
    for c in s: h ^= ord(c); h = (h * 0x01000193) & 0xffffffff
    d, out = "0123456789abcdefghijklmnopqrstuvwxyz", ""
    while True:
        h, r = divmod(h, 36); out = d[r] + out
        if not h: return out


_TK = {}
def tashkeel_text(bid, p, raw):
    """النص المشكول المدقق للصفحة إن وُجد ولم يتغير نصها بعده (data/tashkeel)، فيتحسن النطق كثيرًا؛ وإلا النص كما هو."""
    k = (p - 1) // 50; key = (bid, k)
    if key not in _TK: _TK[key] = jload(os.path.join(ROOT, "data", "tashkeel", bid, "%d.json" % k), {})
    e = _TK[key].get(str(p))
    return e["t"] if e and e.get("h") == _fnv(raw) and e.get("t") else raw


async def tts_book(item, lst):
    bid = item["id"]
    sh = shard(bid)
    cat = catalog()
    b = next((x for x in cat["books"] if x["id"] == bid), None)
    if not sh or not b:
        REPORT.append("%s: الكتاب غير موجود" % bid)
        return True
    voice = item.get("voice") or VOICE
    rate = item.get("rate") or "-5%"
    tag = "audio-" + bid
    mp = os.path.join(AUD, bid + ".json")
    man = jload(mp, {"id": bid, "v": voice, "rel": tag, "pages": {}, "rec": []})
    if not item.get("voice") and man.get("pages") and man.get("v"): voice = man["v"]  # كتاب بدأ بصوت يكمل به فلا تختلط الأصوات
    if man.get("v") != voice and item.get("force"):
        man["pages"] = {}
    man["v"] = voice
    man["title"] = b.get("setTitle") or b["title"]
    pages = sh.get("pages") or []
    first, last = int(item.get("from") or 1), int(item.get("to") or len(pages))
    only_p = {int(x) for x in (item.get("pages") or [])}  # صفحات بعينها يعيد تسجيلها المشرف بعد مراجعة السماع
    todo = []
    for p in range(first, min(last, len(pages)) + 1):
        if only_p and p not in only_p:
            continue
        tx = clean(tashkeel_text(bid, p, pages[p - 1]))
        cur = man["pages"].get(str(p))
        if len(tx) < 3:
            man["pages"][str(p)] = {"d": 0, "h": h(tx)}
            continue
        force = bool(item.get("force")) or p in only_p or bid in [x.strip() for x in os.environ.get("TTS_FORCE", "").split(",")]
        if cur and cur.get("d") and not force and (cur.get("h") == h(tx) or os.environ.get("TTS_REFRESH") != "1"):
            continue
        todo.append((p, tx))
    if not todo:
        save_book(man, b, lst, len(pages))
        return True
    ensure_release(tag, "صوتيات: " + man["title"])
    os.makedirs(WORK, exist_ok=True)
    log("%s «%s»: %d صفحة للتحويل بصوت %s" % (bid, man["title"], len(todo), voice))
    sem = asyncio.Semaphore(CONC)
    done = []

    async def one(p, tx):
        async with sem:
            if left() < 240:
                return
            path = os.path.join(WORK, "p%04d.mp3" % p)
            for attempt in range(5):
                try:
                    sents = await speak(tx, voice, rate, path)
                    done.append((p, tx, path, sents))
                    return
                except Exception as e:
                    log("  ص %d محاولة %d: %s" % (p, attempt + 1, str(e)[:120]))
                    await asyncio.sleep(3 * (attempt + 1))

    BATCH = 40
    for i in range(0, len(todo), BATCH):
        if left() < 300:
            break
        done.clear()
        await asyncio.gather(*[one(p, tx) for p, tx in todo[i:i + BATCH]])
        if not done:
            continue
        upload(tag, [d[2] for d in done])
        for p, tx, path, sents in done:
            man["pages"][str(p)] = {"d": mp3_secs(path), "h": h(tx), "s": sents}
            os.remove(path)
        save_book(man, b, lst, len(pages))
        if (i // BATCH) % 3 == 2 or i + BATCH >= len(todo) or left() < 600:  # حفظ دوري كل ١٢٠ صفحة تقريبًا
            commit("صوتيات المكتبة: «%s» (%d صفحة)" % (man["title"], sum(1 for v in man["pages"].values() if v.get("d"))))
        log("  حُفظت %d صفحة، بقي من الوقت %d دقيقة" % (len(done), left() // 60))
    remaining = [p for p, _ in todo if not (man["pages"].get(str(p)) or {}).get("d")]
    REPORT.append("%s «%s»: %d صفحة مسموعة%s" % (bid, man["title"], sum(1 for v in man["pages"].values() if v.get("d")), (" — بقي %d" % len(remaining)) if remaining else " — اكتمل"))
    return not remaining


def save_book(man, b, lst, total):
    jsave(os.path.join(AUD, man["id"] + ".json"), man)
    ps = man["pages"]
    secs = sum(v.get("d", 0) for v in ps.values()) + sum(r.get("d", 0) for r in man.get("rec", []))
    prev = lst.get(man["id"]) or {}
    lst[man["id"]] = {"ok": prev.get("ok", 1), "n": sum(1 for v in ps.values() if v.get("d")), "of": total, "d": round(secs), "v": man["v"], "vn": VOICES.get(man["v"], man["v"]),
                      "t": man["title"], "a": b.get("authorId", ""), "c": b.get("col", ""), "rec": len(man.get("rec", [])), "upd": time.strftime("%Y-%m-%d"),
                      "ds": [round((ps.get(str(i)) or {}).get("d", 0)) for i in range(1, total + 1)],
                      "rd": [[r.get("f"), round(r.get("d", 0)), r.get("t", "")] for r in man.get("rec", [])]}
    jsave(os.path.join(AUD, "_list.json"), lst)


def oidc_get(path):
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library", headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=20).read())["value"]
    site = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
    return json.loads(urllib.request.urlopen(urllib.request.Request(site + path, headers={"Authorization": "Bearer " + tok}), timeout=30).read())


def rec_book(item, lst):
    """تسجيل بشري رفعه المشرف إلى صندوق الرفع: يُنقل إلى إصدار الكتاب ويُضاف إلى بيانه."""
    bid, r = item["id"], item["rec"]
    b = next((x for x in catalog()["books"] if x["id"] == bid), None)
    if not b:
        REPORT.append("%s: الكتاب غير موجود" % bid)
        return True
    ext = os.path.splitext(r["f"])[1].lower() or ".mp3"
    os.makedirs(WORK, exist_ok=True)
    tmp = os.path.join(WORK, "rec" + ext)
    url = oidc_get("/api/r2put?f=" + r["f"])["url"]
    with urllib.request.urlopen(url, timeout=900) as s, open(tmp, "wb") as o:
        o.write(s.read())
    tag = "audio-" + bid
    mp = os.path.join(AUD, bid + ".json")
    man = jload(mp, {"id": bid, "v": "", "rel": tag, "pages": {}, "rec": []})
    man["title"] = b.get("setTitle") or b["title"]
    man.setdefault("v", "")
    n = len(man.setdefault("rec", [])) + 1
    name = os.path.join(WORK, "rec%03d%s" % (n, ext))
    os.replace(tmp, name)
    ensure_release(tag, "صوتيات: " + man["title"])
    upload(tag, [name])
    man["rec"].append({"t": r.get("t") or "تسجيل %d" % n, "f": os.path.basename(name), "p": int(r.get("p") or 1), "d": mp3_secs(name), "by": r.get("by", "")})
    os.remove(name)
    sh = shard(bid)
    save_book(man, b, lst, len((sh or {}).get("pages") or []))
    REPORT.append("%s «%s»: أضيف التسجيل «%s»" % (bid, man["title"], man["rec"][-1]["t"]))
    return True


SAMPLE = "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ، الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ، وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُولِ اللَّهِ. أَمَّا بَعْدُ: فَإِنَّ طَلَبَ الْعِلْمِ مِنْ أَفْضَلِ الْقُرُبَاتِ، وَبِهِ يَعْرِفُ الْعَبْدُ رَبَّهُ وَيَعْبُدُهُ عَلَى بَصِيرَةٍ."


async def samples():
    """عينات الأصوات للاختيار في «إدارة الصوتيات»: إصدار audio-voices، ملف لكل صوت (gemini-Charon.mp3، ar-SA-HamedNeural.mp3…)."""
    V = jload(os.path.join(AUD, "_voices.json"), {})
    names = ["gemini:" + v[0] for v in V.get("gemini", [])] + [v[0] for v in V.get("edge", [])]
    have = set()
    r = gh("release", "view", "audio-voices", "-R", REPO, "--json", "assets", check=False)
    if r.returncode == 0:
        have = {a["name"] for a in json.loads(r.stdout).get("assets", [])}
    ensure_release("audio-voices", "عينات أصوات الصوتيات")
    tmp = os.path.join(ROOT, ".voices"); os.makedirs(tmp, exist_ok=True)
    files, done = [], []
    for v in names:
        fn = v.replace(":", "-") + ".mp3"
        if fn in have and os.environ.get("TTS_SAMPLES") != "all":
            continue
        try:
            if v.startswith("gemini:"):
                speak_gemini(SAMPLE, v.split(":", 1)[1], os.path.join(tmp, fn))
            else:
                await speak(SAMPLE, v, "-5%", os.path.join(tmp, fn))
            files.append(os.path.join(tmp, fn)); done.append(v)
        except Exception as e:
            log("عينة", v, "تعذرت:", str(e)[:150])
    if files:
        upload("audio-voices", files)
    log("عينات الأصوات:", len(done), "جديدة من", len(names))


def del_book(it, lst):
    """حذف الكتاب المسموع (من الإدارة): إصداره وملف بيانه وسطره في القائمة؛ ثم إعادة تسجيله (redo) أو استبعاده من التلقائي."""
    bid = it["id"]
    gh("release", "delete", "audio-" + bid, "-R", REPO, "--yes", "--cleanup-tag", check=False)
    p = os.path.join(AUD, bid + ".json")
    if os.path.exists(p):
        os.remove(p)
    lst.pop(bid, None)
    jsave(os.path.join(AUD, "_list.json"), lst)
    sp = os.path.join(AUD, "_settings.json"); st = jload(sp, {}); skip = set(st.get("skip") or [])
    if it.get("redo"):
        skip.discard(bid)
        it.clear(); it.update({"id": bid})  # يبقى في الطابور فيُسجَّل من جديد بالصوت الافتراضي
        REPORT.append("%s: حُذف التسجيل ويُعاد تسجيله" % bid)
        st["skip"] = sorted(skip); jsave(sp, st)
        commit("صوتيات: حذف «%s» لإعادة تسجيله" % bid)
        return False
    skip.add(bid); st["skip"] = sorted(skip); jsave(sp, st)
    REPORT.append("%s: حُذف التسجيل" % bid)
    commit("صوتيات: حذف «%s»" % bid)
    return True


async def main():
    os.makedirs(AUD, exist_ok=True)
    if os.environ.get("TTS_SAMPLES"):
        return await samples()
    global VOICE
    VOICE = jload(os.path.join(AUD, "_settings.json"), {}).get("voice") or VOICE  # الصوت الافتراضي الذي تختاره الإدارة
    global LEX
    LEX = [x for x in jload(os.path.join(AUD, "_lexicon.json"), {}).get("words", []) if len(x) == 2 and x[0]]
    qp = os.path.join(AUD, "_queue.json")
    q = jload(qp, {"items": []})
    lst = jload(os.path.join(AUD, "_list.json"), {})
    only = [x for x in os.environ.get("TTS_ONLY", "").split(",") if x.strip()]
    items = q.get("items", [])
    if only:
        items = [{"id": x} for x in only] + [i for i in items if i["id"] not in only]
    if os.environ.get("TTS_AUTO") == "1" and not only:  # التحويل التلقائي (قرار المدير ٣١ أكتوبر): كتب مكتبة الدعوة أولًا، الأقصر فالأطول، ثم المختار من المكتبة العامة
        cat = catalog(); have = {i["id"] for i in items}
        pick = set(jload(os.path.join(AUD, "_auto.json"), {}).get("turath") or [])
        skip = set(jload(os.path.join(AUD, "_settings.json"), {}).get("skip") or [])
        cands = [b for b in cat["books"] if b["id"] not in skip and not b.get("hidden") and not b.get("demo") and b.get("type", "book") == "book" and not b.get("vf") and b["id"] not in have
                 and ((b.get("col") or "dawah") == "dawah" or b["id"] in pick) and not (lst.get(b["id"], {}).get("n") and lst[b["id"]].get("n", 0) >= lst[b["id"]].get("of", 1))]
        cands.sort(key=lambda b: (0 if (b.get("col") or "dawah") == "dawah" else 1, b.get("n") or 9999))
        items += [{"id": b["id"]} for b in cands[:int(os.environ.get("TTS_AUTO_BOOKS", "6"))]]
    if os.environ.get("TTS_REFRESH") == "1":  # الكتب المسموعة التي تغيّر نصها بعد التدقيق
        items += [{"id": k, "voice": v.get("v")} for k, v in lst.items() if v.get("n") and not any(i["id"] == k for i in items)]
    left_items = []
    for it in items:
        if left() < 300:
            left_items.append(it)
            continue
        try:
            ok = del_book(it, lst) if it.get("del") else rec_book(it, lst) if it.get("rec") else await tts_book(it, lst)
        except Exception as e:
            log("خطأ في", it.get("id"), e)
            REPORT.append("%s: خطأ — %s" % (it.get("id"), str(e)[:160]))
            ok = False
            it["err"] = (it.get("err") or 0) + 1
        if not ok and (it.get("err") or 0) < 4:
            left_items.append(it)
    keep = [i for i in left_items if i.get("id")]
    q["items"] = keep
    jsave(qp, q)
    commit("صوتيات المكتبة: تحديث الطابور")
    rep = "🎧 <b>صوتيات المكتبة</b>\n" + "\n".join(REPORT[:30]) if REPORT else ""
    if rep:
        open(os.path.join(ROOT, ".tts-report.txt"), "w", encoding="utf-8").write(rep)
    log("\n".join(REPORT))


if __name__ == "__main__":
    asyncio.run(main())
