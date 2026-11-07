#!/usr/bin/env python3
"""تعليق احترافي: (١) تجربة أداء: كل صوت يسجل مقاطع التجربة، ويحكم Gemini على النطق والأداء، فيُختار أفضل صوت؛
(٢) لكل مقطع عدة نسخ بالصوت المختار، تُفرَّغ وتقارن بالنص (نسبة خطأ الكلمات) مع درجتي النطق والأداء، وتُحفظ الأفضل
في promo/voice/best/sNN.wav، والتقرير في promo/voice/best/report.json."""
import base64, json, os, re, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(ROOT, "script2.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "voice", "best"); WORK = os.path.join(ROOT, ".takes")
os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
TTS = [m for m in os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts,gemini-2.5-pro-preview-tts,gemini-3.1-flash-tts-preview").split(",") if m]
JUDGE = [m for m in os.environ.get("GEMINI_JUDGE_MODEL", "gemini-pro-latest,gemini-3.8-flash,gemini-flash-latest").split(",") if m]
KEYS = [os.environ[k] for k in sorted(os.environ) if k.startswith("GEMINI_API_KEY") and os.environ[k]]
DEAD = set(); KI = [0]
SEG = {g["id"]: g for g in S["segments"]}
REPORT = {"audition": {}, "segments": {}}


def call(model, body, timeout=300):
    err = None
    for _ in range(len(KEYS)):
        k = KEYS[KI[0] % len(KEYS)]; KI[0] += 1
        if (k, model) in DEAD: continue
        try:
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                         data=json.dumps(body).encode(), headers={"content-type": "application/json", "x-goog-api-key": k})
            return json.load(urllib.request.urlopen(req, timeout=timeout))
        except urllib.error.HTTPError as e:
            err = f"{model} HTTP {e.code}"
            if e.code in (429, 403, 404, 400): DEAD.add((k, model))
        except Exception as e:
            err = f"{model} {e}"
    raise RuntimeError(err)


def tts(sid, voice, out):
    g = SEG[sid]
    prompt = S["style"].replace("TEXT:", "DIRECTOR'S NOTE FOR THIS LINE: " + S["notes"].get(sid, "") + "\nTEXT:") + "\n" + g["text"]
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseModalities": ["AUDIO"], "temperature": 1.0,
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    err = None
    for m in TTS:
        try:
            j = call(m, body)
            pcm = base64.b64decode(j["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-", "-af",
                            "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse", out],
                           input=pcm, check=True)
            return m
        except Exception as e:
            err = e
    raise RuntimeError(err)


DIAC = re.compile(r"[ً-ْٰـ]")
def norm(t):
    t = DIAC.sub("", t); t = re.sub(r"[إأآٱ]", "ا", t); t = t.replace("ة", "ه").replace("ى", "ي").replace("ئ", "ي").replace("ؤ", "و")
    t = t.replace("صلى الله عليه وسلم", "صلى الله عليه وسلم")
    return re.sub(r"[^ء-ي ]+", " ", t).split()


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp); d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(1, len(r))


def judge(sid, path):
    audio = base64.b64encode(open(path, "rb").read()).decode()
    q = ("You are a strict Classical Arabic diction coach and voice-over casting director. Listen to the audio.\n"
         "1) transcript: transcribe EXACTLY what is spoken, in Arabic letters with full diacritics as pronounced.\n"
         "2) issues: list every mispronounced, missing, extra or wrongly-vowelled word (wrong i'rab) compared to the REFERENCE, in Arabic.\n"
         "3) pron: 1-10 accuracy of Classical Arabic pronunciation versus the REFERENCE diacritics (10 = flawless).\n"
         "4) vo: 1-10 professional voice-over quality: deep, rich, warm (رخيم), dignified pacing, natural, no artifacts or glitches.\n"
         "5) instructions_read: true if any English or instructions were spoken.\n"
         "Return JSON only: {\"transcript\":\"\",\"issues\":[],\"pron\":0,\"vo\":0,\"instructions_read\":false}\nREFERENCE:\n" + SEG[sid]["text"])
    body = {"contents": [{"parts": [{"inlineData": {"mimeType": "audio/wav", "data": audio}}, {"text": q}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
    for m in JUDGE:
        try:
            j = call(m, body, 180)
            r = json.loads(j["candidates"][0]["content"]["parts"][0]["text"])
            w = wer(SEG[sid]["text"], r.get("transcript", ""))
            r["wer"] = round(w, 3); r["judge"] = m
            r["score"] = round(10 * (1 - min(1, w)) + 1.4 * float(r.get("pron", 0)) + float(r.get("vo", 0)) - (15 if r.get("instructions_read") else 0), 2)
            return r
        except Exception as e:
            print("  judge", m, e, flush=True)
    return {"score": 0, "error": "judge failed"}


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout or 0)


# ١) تجربة الأداء
best_voice, best_avg = None, -1
for v in S["voices"]:
    sc = []
    for sid in S["audition"]:
        p = os.path.join(WORK, f"aud_{v}_{sid}.wav")
        try:
            m = tts(sid, v, p); r = judge(sid, p); r.update(model=m, d=round(dur(p), 2)); sc.append(r["score"])
            REPORT["audition"].setdefault(v, {})[sid] = r
            print(f"تجربة {v} {sid}: {r['score']} (نطق {r.get('pron')} أداء {r.get('vo')} خطأ {r.get('wer')})", flush=True)
        except Exception as e:
            print("✗", v, sid, e, flush=True); sc.append(0)
    avg = sum(sc) / len(sc)
    REPORT["audition"].setdefault(v, {})["avg"] = round(avg, 2)
    if avg > best_avg: best_voice, best_avg = v, avg
FORCE = os.environ.get("PROMO_VOICE")
if FORCE: best_voice = FORCE
REPORT["voice"] = best_voice
print("الصوت المختار:", best_voice, round(best_avg, 2), flush=True)

# ٢) أفضل نسخة لكل مقطع
for g in S["segments"]:
    sid = g["id"]; cands = []
    aud = os.path.join(WORK, f"aud_{best_voice}_{sid}.wav")
    if os.path.exists(aud) and sid in REPORT["audition"].get(best_voice, {}): cands.append((REPORT["audition"][best_voice][sid], aud))
    for k in range(S["takes"]):
        if cands and max(c[0]["score"] for c in cands) >= 33 and cands[0][0].get("wer", 1) == 0: break  # نسخة كاملة بلا أخطاء
        p = os.path.join(WORK, f"{sid}_{k}.wav")
        try:
            m = tts(sid, best_voice, p); r = judge(sid, p); r.update(model=m, d=round(dur(p), 2)); cands.append((r, p))
            print(f"{sid} نسخة {k}: {r['score']} (نطق {r.get('pron')} أداء {r.get('vo')} خطأ {r.get('wer')}) {r.get('issues')}", flush=True)
        except Exception as e:
            print("✗", sid, k, e, flush=True)
    if not cands: print("لا نسخة لـ", sid); continue
    cands.sort(key=lambda c: -c[0]["score"])
    r, p = cands[0]
    subprocess.run(["cp", p, os.path.join(OUT, sid + ".wav")], check=True)
    REPORT["segments"][sid] = r
    print(f"✓ {sid} ← {r['score']}", flush=True)
    json.dump(REPORT, open(os.path.join(OUT, "report.json"), "w"), ensure_ascii=False, indent=1)
man = {f"best/{sid}": {"d": r.get("d"), "model": r.get("model"), "score": r.get("score")} for sid, r in REPORT["segments"].items()}
old = json.load(open(os.path.join(ROOT, "voice", "manifest.json"))) if os.path.exists(os.path.join(ROOT, "voice", "manifest.json")) else {}
old = {k: v for k, v in old.items() if not k.startswith("best/")}; old.update(man)
json.dump(old, open(os.path.join(ROOT, "voice", "manifest.json"), "w"), ensure_ascii=False, indent=1)
