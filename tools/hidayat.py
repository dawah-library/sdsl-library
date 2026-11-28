#!/usr/bin/env python3
"""هدايات وفوائد الآيات (بلا نموذج): يبني data/hidayat/<سورة>.json من tools/hidayat_src/<سورة>.json.
المصدر المكتوب: {"a": {"<آية>": [{"t": "الهداية في عبارة قصيرة", "s": "saddi", "q": "مقتطف حرفي من نص ذلك التفسير للآية"}]}}
فحوص آلية: المقتطف q موجود حرفيًا (بعد توحيد المسافات والتشكيل) في نص تفسير المفتاح s عند الآية أو
المجموعة التي تشملها؛ الهداية من 3 إلى 22 كلمة (عناصر مختصرة)؛ لا تكرار؛ لا هداية بلا عزو.
فشل فحص أي عنصر يوقف بناء السورة كلها. الاستعمال: python3 tools/hidayat.py [سورة…]"""
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {"saddi": "data/quran/tafsir/saddi/{s}.json", "mokhtasar": "data/quran/tafsir/mokhtasar/{s}.json",
       "muyassar": "data/quran/tafsir/muyassar/{s}.json", "siraj": "data/quran/tafsir/siraj/{s}.json"}
TASH = re.compile(r"[ً-ْٰـ]")
def nz(t): return re.sub(r"\s+", " ", TASH.sub("", t)).strip()
def tafsir_for(sk, s, a):
    d = json.load(open(os.path.join(ROOT, SRC[sk].format(s=s)), encoding="utf-8"))
    ks = sorted(int(k) for k in d if k.isdigit() and int(k) <= a)
    return nz(d[str(ks[-1])]) if ks else ""
def build(s):
    p = os.path.join(ROOT, f"tools/hidayat_src/{s}.json")
    if not os.path.exists(p): return 0
    S = json.load(open(p, encoding="utf-8")); out = {}; bad = 0
    for a, items in S["a"].items():
        seen = set()
        for x in items:
            w = len(x["t"].split()); ok = True
            if x["s"] not in SRC: print("مصدر غير معروف", x["s"]); ok = False
            elif nz(x["q"]) not in tafsir_for(x["s"], s, int(a)): print(f"FAIL {s}:{a} المقتطف غير موجود في {x['s']}: {x['q'][:40]}"); ok = False
            if not 3 <= w <= 22: print(f"FAIL {s}:{a} طول الهداية {w} كلمة"); ok = False
            if x["t"] in seen: print(f"FAIL {s}:{a} مكرر"); ok = False
            seen.add(x["t"]); bad += not ok
            out.setdefault(a, []).append({"t": x["t"], "s": x["s"], "q": x["q"]})
    if bad: sys.exit(1)
    os.makedirs(os.path.join(ROOT, "data/hidayat"), exist_ok=True)
    json.dump({"v": 1, "a": out}, open(os.path.join(ROOT, f"data/hidayat/{s}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return sum(len(v) for v in out.values())
def main():
    ss = [int(x) for x in sys.argv[1:]] or sorted(int(os.path.basename(f)[:-5]) for f in glob.glob(os.path.join(ROOT, "tools/hidayat_src/*.json")))
    n = {s: build(s) for s in ss}
    I = {"v": 1, "s": {str(s): n for s, n in n.items() if n}}
    ip = os.path.join(ROOT, "data/hidayat/_index.json")
    old = json.load(open(ip, encoding="utf-8")) if os.path.exists(ip) else {"v": 1, "s": {}}
    old["s"].update(I["s"]); json.dump(old, open(ip, "w", encoding="utf-8"), ensure_ascii=False)
    print("هدايات:", sum(old["s"].values()), "في", len(old["s"]), "سورة")
if __name__ == "__main__": main()
