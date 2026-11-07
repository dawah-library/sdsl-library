#!/usr/bin/env python3
"""التعليق الصوتي للفيديو التعريفي: يسجّل كل مقطع من promo/script.json بأصوات Gemini (WAV بجودة كاملة 24kHz)
في promo/voice/<الصوت>/<المقطع>.wav، ويتخطى ما سُجّل بنصه نفسه (بصمة النص في manifest.json)."""
import base64, hashlib, json, os, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(ROOT, "script.json"), encoding="utf-8"))
MODELS = [m for m in os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-2.5-pro-preview-tts,gemini-2.5-flash-preview-tts").split(",") if m]
KEYS = [os.environ[k] for k in sorted(os.environ) if k.startswith("GEMINI_API_KEY") and os.environ[k]]
DEAD = set()
MAN_P = os.path.join(ROOT, "voice", "manifest.json")
MAN = json.load(open(MAN_P)) if os.path.exists(MAN_P) else {}


def tts(text, voice, out):
    body = json.dumps({"contents": [{"parts": [{"text": S["style"] + "\n\n" + text}]}],
                       "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}).encode()
    err = None
    for m in MODELS:
        for k in KEYS:
            if (k, m) in DEAD: continue
            try:
                req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent", data=body,
                                             headers={"content-type": "application/json", "x-goog-api-key": k})
                j = json.load(urllib.request.urlopen(req, timeout=300))
                pcm = base64.b64decode(j["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-",
                                "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
                                out], input=pcm, check=True)
                d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
                want = len(text) / 13.0
                if d > want * 2.2 + 4 or d < want * 0.4:
                    err = f"مدة غير متناسبة {d:.1f}ث (المتوقع {want:.1f})"; print(" ", m, err, flush=True); continue
                return m, round(d, 2)
            except urllib.error.HTTPError as e:
                err = f"{m} HTTP {e.code}"
                if e.code in (429, 404, 403, 400): DEAD.add((k, m))
            except Exception as e:
                err = f"{m} {e}"
    raise RuntimeError(err)


ok = fail = 0
for v in S["voices"]:
    os.makedirs(os.path.join(ROOT, "voice", v), exist_ok=True)
    for sg in S["segments"]:
        h = hashlib.sha1((S["style"] + sg["text"]).encode()).hexdigest()[:12]
        key = f"{v}/{sg['id']}"
        out = os.path.join(ROOT, "voice", v, sg["id"] + ".wav")
        if MAN.get(key, {}).get("h") == h and os.path.exists(out): continue
        try:
            m, d = tts(sg["text"], v, out)
            MAN[key] = {"h": h, "d": d, "model": m}; ok += 1
            print("✓", key, d, m, flush=True)
        except Exception as e:
            fail += 1; print("✗", key, e, flush=True)
        json.dump(MAN, open(MAN_P, "w"), ensure_ascii=False, indent=1)
        time.sleep(1)
print(f"سُجّل {ok}، تعذّر {fail}")
