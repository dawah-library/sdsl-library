#!/usr/bin/env python3
"""يفحص ذيل كل مقطع في data/audio/<كتاب>.json (بطلب جزء أخير من الملف فقط) ويسجل في بيان الصفحة:
  "e": زمن (ثوانٍ) يوقف عنده المشغّل المقطع قبل دفقة التشويش، و"tc": 1 علامة أنه فُحص.
لا يعدّل الملفات الصوتية ولا يحذف شيئًا. الاستخدام: python3 tools/audio-tail-scan.py [--limit N] [--book ID]"""
import json, os, glob, subprocess, sys, struct, tempfile, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from audio_tail import find_cut

BASE = os.environ.get("AU_BASE", "https://dawahlibrary.org/au/")
TAIL = 60000  # بايت (≈ ١٠ ث عند ٤٨ كيلوبت)


def tail_pcm(url):
    req = urllib.request.Request(url, headers={"Range": "bytes=-%d" % TAIL, "User-Agent": "sdsl-audio-tail"})
    data = urllib.request.urlopen(req, timeout=60).read()
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(data)
    raw = f.name + ".raw"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f.name, "-f", "f32le", "-ac", "1", "-ar", "24000", raw], check=True)
    b = open(raw, "rb").read()
    os.unlink(f.name); os.unlink(raw)
    return struct.unpack("<%df" % (len(b) // 4), b)


def main():
    lim = 10 ** 9; only = None; a = sys.argv[1:]
    if "--limit" in a: lim = int(a[a.index("--limit") + 1])
    if "--book" in a: only = a[a.index("--book") + 1]
    done = cut = 0
    for fn in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "data", "audio", "*.json"))):
        if os.path.basename(fn).startswith("_"): continue
        m = json.load(open(fn, encoding="utf8"))
        if only and m.get("id") != only: continue
        ch = False
        for k, p in m.get("pages", {}).items():
            if not p.get("d") or p.get("tc"): continue
            if done >= lim: break
            try:
                x = tail_pcm("%s%s/p%04d.mp3" % (BASE, m["id"], int(k)))
                t = find_cut(x)
                p["tc"] = 1
                if t is not None:
                    p["e"] = round(p["d"] - len(x) / 24000 + t, 2)
                    cut += 1
                ch = True; done += 1
            except Exception as e:
                print("تخطي", m["id"], k, e)
        if ch: json.dump(m, open(fn, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print("فُحص", done, "ووُجد تشويش في", cut)


if __name__ == "__main__":
    main()
