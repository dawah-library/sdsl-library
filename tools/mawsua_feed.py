#!/usr/bin/env python3
"""تغذية الموسوعات آليًّا بكل ما يضاف للمكتبة (بلا Gemini ولا حصة).
يقرأ الفهرس (المكتبة العامة ومكتبة الدعوة السلفية) ويقارنه بـ data/mawsua/_feed_seen.json، ثم يكتب في data/mawsua/_feed.json:
  enc[k].new     معرّفات الكتب الجديدة المتصلة بالموسوعة (بموضوعها أو بألفاظ نطاقها)
  enc[k].primary معرّفات المراجع الأولى للموسوعة (مكتبة الدعوة السلفية)؛ في السياسة الشرعية: كتب العمل السياسي والإمارة والحكم والسياسة الشرعية
وهو ملف تقرؤه مراحل التحرير (mawsua.py) لتقديم primary ولتضم new إلى المواضع عند التحرير. لا يحذف شيئًا ولا يمس المخططات ولا الطابور."""
import json, os, re, sys, time
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
OUT = os.path.join(D, "mawsua")
def jl(p, d=None):
    try: return json.load(open(p, encoding="utf-8"))
    except Exception: return d
def nz(s): return re.sub(r"[\u064B-\u0652\u0640]", "", (s or "")).replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
SIYASA = ["العمل السياسي", "حزب النور", "السياسه الشرعيه", "كتاب الاماره", "كتاب الحكم", "شرح الاماره", "شرح الحكم", "الاماره", "الاحكام السلطانيه", "الولايه", "الشوري", "الديمقراطيه", "الانتخابات", "البرلمان", "الخلافه", "الجهاد", "السياسه"]
def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mawsua as M
    cat = jl(os.path.join(D, "catalog.json")); books = cat["books"]
    seen = jl(os.path.join(OUT, "_feed_seen.json"), {"ids": []}) or {"ids": []}; first = not seen["ids"]; old = set(seen["ids"])
    feed = jl(os.path.join(OUT, "_feed.json"), {"enc": {}}) or {"enc": {}}
    for e in M.ENC:
        k, name, desc, topics = e[0], e[1], e[2], e[4]
        words = [nz(w) for w in re.split(r"[،,\s]+", desc) if len(w) > 3]
        slot = feed["enc"].setdefault(k, {"new": [], "primary": []})
        for b in books:
            if b.get("hidden") or b.get("demo"): continue
            hay = nz(b.get("title", "") + " " + " ".join((b.get("card") or {}).get("keywords") or []))
            rel = b.get("topicId") in topics or sum(1 for w in words if w in hay) >= 2
            if k == "siyasa" and (b.get("col") or "dawah") == "dawah" and (b.get("topicId") in topics or any(w in hay for w in SIYASA)): 
                if b["id"] not in slot["primary"]: slot["primary"].append(b["id"])
            if rel and not first and b["id"] not in old and b["id"] not in slot["new"]: slot["new"].append(b["id"])
    seen["ids"] = sorted(set(old) | {b["id"] for b in books}); seen["at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    feed["at"] = seen["at"]
    for p, o in (("_feed.json", feed), ("_feed_seen.json", seen)):
        json.dump(o, open(os.path.join(OUT, p), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print({k: (len(v["new"]), len(v["primary"])) for k, v in feed["enc"].items()})
if __name__ == "__main__": main()
