#!/usr/bin/env python3
"""مزج الصوت: التعليق (promo/voice/<الصوت>) في مواضعه من cues.json + مؤثرات مولّدة (بلا معازف): نفَس هواء خفيف،
وهبّة انتقال بين المشاهد، وضربة عميقة مع كشف الشعار. ثم دمجه مع الفيديو الصامت.
python3 promo/mix.py <silent.mp4> <cues.json> <voice> <out.mp4>"""
import json, subprocess, sys, os, numpy as np
from scipy.signal import butter, sosfilt
SR = 48000
vid, cuesp, voice, out = sys.argv[1:5]
C = json.load(open(cuesp)); T = C["total"] + 0.5
N = int(T * SR); mix = np.zeros(N); rng = np.random.default_rng(3)
ROOT = os.path.dirname(os.path.abspath(__file__))

def load(path):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).astype(float)

def add(sig, t, g=1.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < N: mix[i:j] += sig[:j - i] * g

def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)
def lp(x, f): return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)

def whoosh(d=1.6, lo=300, hi=3200):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for k in range(0, n, seg):  # مرشح يتحرك صعودًا ثم نزولًا
        p = k / n; f = lo + (hi - lo) * np.sin(np.pi * p) ** 1.5
        out[k:k + seg] = bp(x[k:k + seg + 0], max(60, f * 0.6), min(SR / 2 - 100, f * 1.4))[:len(out[k:k + seg])]
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return out * env / (np.abs(out).max() + 1e-9)

def boom(d=3.5, f0=55):
    t = np.linspace(0, d, int(d * SR)); f = f0 * (1 + 1.2 * np.exp(-t * 6))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.4)
    s += lp(rng.standard_normal(len(t)), 180) * np.exp(-t * 3) * 0.6
    return s / np.abs(s).max()

def riser(d=2.5):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for k in range(0, n, seg):
        f = 200 + 5000 * (k / n) ** 2
        out[k:k + seg] = bp(x[k:k + seg], f * 0.7, min(SR / 2 - 100, f * 1.3))[:len(out[k:k + seg])]
    env = np.linspace(0, 1, n) ** 2.5
    return out * env / (np.abs(out).max() + 1e-9)

def air():  # نفَس هواء منخفض جدًا طوال الفيلم
    x = lp(rng.standard_normal(N), 420); x /= np.abs(x).max()
    t = np.arange(N) / SR; return x * (0.6 + 0.4 * np.sin(2 * np.pi * t / 11))

mix += air() * 0.035
sc = {s["id"]: s for s in C["scenes"]}
for s in C["scenes"]:
    if s["id"] not in ("s01", "s04"): add(whoosh(1.5), max(0, s["start"] - 0.5), 0.16)
add(riser(2.6), sc["s04"]["start"] - 2.3, 0.18)
add(boom(4.0, 48), C["flash"], 0.55)
add(whoosh(1.2, 1500, 7000), C["flash"] + 0.1, 0.10)
add(whoosh(1.4), C["free"] - 0.4, 0.14)
add(boom(5.0, 42), sc["s11"]["start"] + 0.1, 0.38)
# التعليق
vo = np.zeros(N)
for s in C["scenes"]:
    p = os.path.join(ROOT, "voice", voice, s["id"] + ".wav")
    if os.path.exists(p):
        v = load(p); i = int(s["voiceAt"] * SR); j = min(N, i + len(v)); vo[i:j] += v[:j - i]
    else: print("لا صوت:", p)
vo /= (np.abs(vo).max() + 1e-9)
# خفض المؤثرات تحت الصوت
envv = lp(np.abs(vo), 4); duck = 1 - 0.55 * np.clip(envv / (envv.max() + 1e-9) * 4, 0, 1)
final = vo * 0.92 + mix * duck
fade = int(1.5 * SR); final[-fade:] *= np.linspace(1, 0, fade)
final /= max(1.0, np.abs(final).max() / 0.97)
tmp = out + ".wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-ac", "2", tmp], input=final.astype(np.float64).tobytes(), check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vid, "-i", tmp, "-af", "loudnorm=I=-15:TP=-1.2:LRA=9", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out], check=True)
os.remove(tmp); print("✓", out)
