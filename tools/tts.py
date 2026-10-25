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
VOICE = os.environ.get("TTS_VOICE", "ar-SA-HamedNeural")
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


async def speak(text, voice, rate, path):
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
        tx = clean(pages[p - 1])
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
    lst[man["id"]] = {"ok": prev.get("ok", 0), "n": sum(1 for v in ps.values() if v.get("d")), "of": total, "d": round(secs), "v": man["v"], "vn": VOICES.get(man["v"], man["v"]),
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


async def main():
    os.makedirs(AUD, exist_ok=True)
    qp = os.path.join(AUD, "_queue.json")
    q = jload(qp, {"items": []})
    lst = jload(os.path.join(AUD, "_list.json"), {})
    only = [x for x in os.environ.get("TTS_ONLY", "").split(",") if x.strip()]
    items = q.get("items", [])
    if only:
        items = [{"id": x} for x in only] + [i for i in items if i["id"] not in only]
    if os.environ.get("TTS_REFRESH") == "1":  # الكتب المسموعة التي تغيّر نصها بعد التدقيق
        items += [{"id": k, "voice": v.get("v")} for k, v in lst.items() if v.get("n") and not any(i["id"] == k for i in items)]
    left_items = []
    for it in items:
        if left() < 300:
            left_items.append(it)
            continue
        try:
            ok = rec_book(it, lst) if it.get("rec") else await tts_book(it, lst)
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
