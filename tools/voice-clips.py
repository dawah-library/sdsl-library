#!/usr/bin/env python3
"""مقاطع صوتية قصيرة للموقع: عبارات تشجيع الطلائع (بنين/بنات) وفواصل الإذاعة («والآن مع كتاب…»، «ونستكمل…»، الأذان…).
المواصفة: data/clips.json {"items": {"<معرّف>": {"t": "النص المشكول", "v": "gemini:Charon" | "edge:ar-SA-ZariyahNeural", "s": "أسلوب الأداء"}}}
الناتج: assets/clips/<معرّف>.mp3، والبصمات في data/clips-state.json (لا يُعاد المقطع ما لم يتغير نصه أو صوته).
بلا مفتاح Gemini أو عند نفاد الحصة: يتراجع إلى صوت Edge المناسب للجنس (حامد للذكر، زارية للأنثى).
تُضاف فواصل الإذاعة آليًّا من data/radio.json (لكل كتاب في البث): tools/voice-clips.py يولّد مواصفاتها قبل التسجيل."""
import asyncio, hashlib, importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data"); OUT = os.path.join(ROOT, "assets", "clips")
spec = importlib.util.spec_from_file_location("tts", os.path.join(ROOT, "tools", "tts.py")); TTS = importlib.util.module_from_spec(spec); spec.loader.exec_module(TTS)
FEMALE = {"Kore", "Aoede", "Leda", "Zephyr", "Callirrhoe", "Autonoe", "Despina", "Erinome", "Laomedeia", "Pulcherrima", "Sulafat", "Vindemiatrix", "Achernar", "Gacrux"}


def jl(p, d):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d


def radio_specs():
    """فواصل الإذاعة لكل كتاب في القنوات: بداية، استئناف، متابعة، ختام آخر مقطع، ختام العرض."""
    R = jl(os.path.join(D, "radio.json"), {}); cat = {b["id"]: b for b in (jl(os.path.join(D, "catalog.json"), {"books": []}).get("books") or [])}
    v = (R.get("voice") or "gemini:Charon"); out = {}
    for ch in R.get("channels") or []:
        for it in ch.get("items") or []:
            bid = it.get("book")
            if not bid: continue
            t = it.get("say") or (cat.get(bid) or {}).get("title") or ""
            a = it.get("by") or (cat.get(bid) or {}).get("author") or ""
            if not t: continue
            ta = "«%s»" % t + ("، لِـ%s" % a if a else "")
            for k, s in {"start": "والآنَ مع كتابِ %s." % ta, "resume": "ونستكملُ كتابَ %s." % ta, "next": "ونُتابعُ كتابَ «%s»." % t,
                         "next2": "ونستكملُ الاستماعَ إلى كتابِ «%s»." % t, "last": "ومع خِتامِ كتابِ «%s»." % t, "end": "كُنّا مع كتابِ %s. جزى اللهُ مؤلِّفَه خيرًا." % ta}.items():
                out["radio-%s-%s" % (bid, k)] = {"t": s, "v": v, "s": "اقرأ بأسلوب مذيع إذاعي هادئ وقور بنطق عربي فصيح دقيق:"}
    return out


async def make(cid, it, st):
    t, v = it["t"], it.get("v") or "gemini:Charon"; h = hashlib.sha1((t + "|" + v).encode()).hexdigest()[:12]
    p = os.path.join(OUT, cid + ".mp3")
    if st.get(cid) == h and os.path.exists(p): return False
    os.makedirs(OUT, exist_ok=True)
    if v.startswith("gemini:"):
        try: TTS.speak_gemini(t, v.split(":", 1)[1], p, it.get("s") or ""); st[cid] = h; return True
        except Exception as e: print("Gemini تعذر لـ", cid, str(e)[:120]); v = "edge:" + ("ar-SA-ZariyahNeural" if v.split(":", 1)[1] in FEMALE else "ar-SA-HamedNeural")
    await TTS.speak(t, v.split(":", 1)[1] if v.startswith("edge:") else v, "-5%", p); st[cid] = h; return True


async def main():
    C = jl(os.path.join(D, "clips.json"), {"items": {}}); items = dict(C.get("items") or {}); items.update(radio_specs())
    sp = os.path.join(D, "clips-state.json"); st = jl(sp, {})
    only = [x for x in os.environ.get("CLIPS_ONLY", "").split(",") if x]
    n = 0
    for cid, it in items.items():
        if only and not any(cid.startswith(o) for o in only): continue
        try:
            if await make(cid, it, st): n += 1; print("✓", cid)
        except Exception as e: print("✗", cid, str(e)[:160])
    json.dump(st, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
    # قائمة المقاطع المتاحة للواجهة
    json.dump(sorted(k for k in st if os.path.exists(os.path.join(OUT, k + ".mp3"))), open(os.path.join(OUT, "index.json"), "w"), ensure_ascii=False)
    print("سُجّل %d مقطعًا" % n)


if __name__ == "__main__":
    asyncio.run(main())
