#!/usr/bin/env python3
"""طبقة موحّدة لنماذج توليد الفيديو (المرحلة ٦): لقطات خلفية متحركة لمشاهد فيديو الكتاب، يُختار المزوّد والنموذج بحسب الجودة والاستعمال.
المزوّدون (يُضاف غيرهم بدالة واحدة في PROVIDERS):
  - veo:   Google Veo عبر واجهة Gemini (GEMINI_VIDEO_KEY أو GEMINI_API_KEY بحساب مفعّل الدفع). النماذج: veo-3.0-fast-generate-001 (أسرع وأرخص)، veo-3.0-generate-001 (أعلى جودة).
  - fal:   fal.ai بمفتاح واحد (FAL_KEY) لعدة نماذج: Kling ‏(fal-ai/kling-video/v2.1/standard/text-to-video)، Wan ‏(fal-ai/wan/v2.2-a14b/text-to-video)، Hailuo/MiniMax ‏(fal-ai/minimax/hailuo-02/standard/text-to-video)، Luma ‏(fal-ai/luma-dream-machine/ray-2-flash).
  - local: خلفيات متحركة مجانية تُولَّد محليًّا (تدرجات وزخارف إسلامية وهالات ضوء وورق) بألوان السمة — الافتراضي المجاني.
  - none:  بلا خلفية متحركة (الشرائح المرسومة وحدها).
الضوابط: لقطات مناظر وعمارة وكتب وخط عربي وطبيعة وأشكال مجردة فقط — بلا بشر ولا وجوه ولا حيوانات ولا تجسيد لنبي أو صحابي ولا رموز دينية لغير الإسلام؛
والصوت من الراوي وحده (اللقطة تُكتم)، ولا موسيقى. السقف لكل فيديو VIDEO_GEN_MAX_SECONDS (الافتراضي ٤٨ ثانية مولَّدة)، والاستهلاك يُسجَّل في
data/video/_gen-usage.json، والتكلفة التقديرية تُعرض في الواجهة قبل الطلب (video.js) من COST هنا.
"""
import json, os, time, urllib.request, urllib.error, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USAGE = os.path.join(ROOT, "data", "video", "_gen-usage.json")
SAFE = ("Cinematic, slow gentle camera movement, soft natural light, no text, no letters. "
        "Absolutely no people, no human figures, no faces, no hands, no animals, no birds, no religious figures, no crosses, no statues, no music instruments. ")
# تقديري بالدولار لكل ثانية مولَّدة (يُراجع من صفحة المزوّد)؛ يعرضه video.js قبل الطلب
COST = {"veo:veo-3.0-fast-generate-001": 0.10, "veo:veo-3.0-generate-001": 0.40, "fal:fal-ai/kling-video/v2.1/standard/text-to-video": 0.05,
        "fal:fal-ai/wan/v2.2-a14b/text-to-video": 0.08, "fal:fal-ai/minimax/hailuo-02/standard/text-to-video": 0.045, "fal:fal-ai/luma-dream-machine/ray-2-flash": 0.08}


def _j(url, body=None, headers=None, method=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=dict({"content-type": "application/json"}, **(headers or {})), method=method)
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def _dl(url, path, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f: f.write(r.read())
    return path


def veo(model, prompt, secs, aspect, path):
    key = os.environ.get("GEMINI_VIDEO_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key: raise RuntimeError("لا مفتاح Veo")
    base = "https://generativelanguage.googleapis.com/v1beta/"
    op = _j(base + "models/%s:predictLongRunning" % model, {"instances": [{"prompt": prompt}], "parameters": {"aspectRatio": "9:16" if aspect in ("9:16", "4:5") else "16:9", "personGeneration": "dont_allow"}}, {"x-goog-api-key": key})
    for _ in range(90):
        time.sleep(10); st = _j(base + op["name"], headers={"x-goog-api-key": key})
        if st.get("done"):
            vids = (((st.get("response") or {}).get("generateVideoResponse") or {}).get("generatedSamples") or [])
            if not vids: raise RuntimeError("Veo: لا ناتج (%s)" % str(st.get("error"))[:120])
            return _dl(vids[0]["video"]["uri"], path, {"x-goog-api-key": key})
    raise RuntimeError("Veo: انتهت المهلة")


def fal(model, prompt, secs, aspect, path):
    key = os.environ.get("FAL_KEY")
    if not key: raise RuntimeError("لا مفتاح fal.ai")
    H = {"Authorization": "Key " + key}
    sub = _j("https://queue.fal.run/" + model, {"prompt": prompt, "aspect_ratio": "9:16" if aspect in ("9:16", "4:5") else ("1:1" if aspect == "1:1" else "16:9"), "duration": "5" if secs <= 6 else "10", "negative_prompt": "people, person, face, human, hands, animal, bird, text, watermark"}, H)
    for _ in range(120):
        time.sleep(8); st = _j(sub["status_url"], headers=H)
        if st.get("status") == "COMPLETED":
            r = _j(sub["response_url"], headers=H); v = (r.get("video") or {}).get("url") or ((r.get("videos") or [{}])[0]).get("url")
            if not v: raise RuntimeError("fal: لا ناتج")
            return _dl(v, path)
        if st.get("status") in ("FAILED", "ERROR"): raise RuntimeError("fal: فشل")
    raise RuntimeError("fal: انتهت المهلة")


# ———— المجاني (بلا مفاتيح ولا تكلفة): خلفيات متحركة تُولَّد محليًّا بـffmpeg وPillow بألوان سمة الفيديو ————
# الأنماط: aurora (تدرج لوني يتحرك ببطء)، pattern (زخرفة هندسية إسلامية ثمانية تنساب)، light (هالة ضوء تتهادى)، paper (ورق عتيق بخطوط)، auto (يتناوب)
LOCAL = ["pattern", "aurora", "light", "paper"]


def _rgb(h, d=(15, 61, 51)):
    h = str(h or "").lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) if len(h) == 6 else d


def _shade(c, f): return tuple(max(0, min(255, int(x * f))) for x in c)


def _hex(c): return "0x%02x%02x%02x" % c


def _star_tile(path, W, H, acc, alpha=46):
    """زخرفة نجمة ثمانية متكررة (خطوط رفيعة شفافة) بعرض ضعف الإطار لتنساب أفقيًّا."""
    from PIL import Image, ImageDraw
    import math
    im = Image.new("RGBA", (W * 2, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); s = 180; col = acc + (alpha,)
    for cy in range(-s, H + s, s):
        for cx in range(-s, W * 2 + s, s):
            for rot in (0, math.pi / 4):
                pts = [(cx + s * 0.42 * math.cos(rot + k * math.pi / 2), cy + s * 0.42 * math.sin(rot + k * math.pi / 2)) for k in range(4)]
                d.polygon(pts, outline=col, width=2)
            d.ellipse([cx - s * 0.12, cy - s * 0.12, cx + s * 0.12, cy + s * 0.12], outline=col, width=2)
    im.save(path)


def _glow(path, size, c):
    from PIL import Image, ImageDraw, ImageFilter
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([size * 0.2, size * 0.2, size * 0.8, size * 0.8], fill=c + (120,)); im.filter(ImageFilter.GaussianBlur(size // 6)).save(path)


def local(style, prompt, secs, aspect, path):
    import subprocess, tempfile
    th = json.loads(os.environ.get("VG_THEME") or "{}"); W, H = {"9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350)}.get(aspect, (1920, 1080))
    bg, acc = _rgb(th.get("bg")), _rgb(th.get("acc"), (212, 175, 55)); dur = max(6, secs)
    light = sum(bg) / 3 > 150  # سمة فاتحة (ورقية): الورق؛ وإلا تتناوب الداكنة
    if style == "auto": L_ = ["paper", "light", "pattern"] if light else ["pattern", "aurora", "light"]; style = L_[int(os.environ.get("VG_IDX", "0")) % len(L_)]
    if style == "paper" and not light: style = "pattern"
    tmp = tempfile.mkdtemp(); grad = "gradients=s=%dx%d:c0=%s:c1=%s:c2=%s:nb_colors=3:speed=0.008:rate=20:duration=%d" % (W, H, _hex(bg), _hex(_shade(bg, 1.45)), _hex(_shade(bg, 0.7)), dur)
    if style == "paper": grad = "gradients=s=%dx%d:c0=0xf4ecd8:c1=0xe9dcc0:speed=0.006:rate=20:duration=%d" % (W, H, dur)
    ins, fc = ["-f", "lavfi", "-i", grad], "[0:v]format=rgba[b]"
    if style in ("pattern", "paper"):
        pt = os.path.join(tmp, "p.png"); _star_tile(pt, W, H, (110, 90, 60) if style == "paper" else acc, 34 if style == "paper" else 46)
        ins += ["-loop", "1", "-i", pt]; fc += ";[b][1:v]overlay=x='-mod(t*14\\,%d)':y=0[b]" % W
    if style in ("light", "aurora"):
        g = os.path.join(tmp, "g.png"); sz = int(min(W, H) * 0.9); _glow(g, sz, acc if style == "light" else _shade(bg, 2.2))
        ins += ["-loop", "1", "-i", g]; k = len([x for x in ins if x == "-i"]) - 1
        fc += ";[b][%d:v]overlay=x='(W-w)/2+(W/3)*sin(t/3)':y='(H-h)/2+(H/6)*cos(t/4)'[b]" % k
    fc += ";[b]vignette=PI/5,format=yuv420p[v]"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + ins + ["-filter_complex", fc, "-map", "[v]", "-t", str(dur), "-r", "20", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", path], check=True)
    return path


PROVIDERS = {"veo": veo, "fal": fal, "local": local}


def budget_left(cap):
    u = json.load(open(USAGE, encoding="utf-8")) if os.path.exists(USAGE) else {}
    return u


def clip(engine, vis, secs, aspect, path, spent):
    """engine = "<مزوّد>:<نموذج>". يعيد مسار اللقطة أو None (فتبقى الشريحة المرسومة). spent: قائمة يُجمع فيها ما وُلّد في هذا الفيديو."""
    if not engine or engine == "none": return None
    prov, model = engine.split(":", 1)
    if prov == "local":  # مجاني بلا سقف
        try: return local(model, vis, max(8, int(secs)), os.environ.get("VG_ASPECT", ""), path)
        except Exception as e: print("  الخلفية المحلية تعذرت:", str(e)[:160]); return None
    if not vis: return None
    cap = float(os.environ.get("VIDEO_GEN_MAX_SECONDS", "48") or 0); s = 5 if secs <= 6 else 10
    if sum(spent) + s > cap: return None
    try: PROVIDERS[prov](model, SAFE + str(vis)[:600], s, os.environ.get("VG_ASPECT", ""), path)
    except Exception as e: print("  توليد اللقطة تعذر:", str(e)[:160]); return None
    spent.append(s)
    u = budget_left(cap); mon = datetime.date.today().strftime("%Y-%m"); e = u.setdefault(mon, {"secs": 0, "usd": 0, "clips": 0})
    e["secs"] += s; e["clips"] += 1; e["usd"] = round(e["usd"] + s * COST.get(engine, 0.1), 2)
    json.dump(u, open(USAGE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return path
