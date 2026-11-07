#!/usr/bin/env python3
"""الاعتماد التلقائي لتصحيحات التدقيق التي لم تُراجَع (بطلب المالك: «إن لم أقم بالخطوات اليدوية فقم بها تلقائيًا»).

يطبّق على نص الكتاب اقتراحات data/proof/<id>.json التي مضى عليها PROOF_AUTO_DAYS أيام (٣ افتراضيًا) دون مراجعة، بشروط:
  - الكتاب من مكتبة الدعوة، أو من الكتب المشهورة (قائمة tools/turath-list.json وطابور turath.io، أو المربوطة بمصورة طبعتها).
  - نوع التصحيح آمن: «طباعة» أو «إملاء» أو «آية» (تصحيح لفظ آية بنص المصحف) أو «تصحيف» (من المقارنة بالمصورة).
    أما «عنوان» و«حاشية» و«سقط» و«زيادة» فتبقى لاعتماد الإدارة لأنها تغيّر بنية الصفحة.
  - التغيير صغير: فرق لا يتجاوز ثلاثة أحرف أو ربع طول العبارة، وعدد الكلمات لا يزيد ولا ينقص أكثر من كلمة.
  - العبارة موجودة في الصفحة مرة واحدة.
كل ما يُطبَّق يُسجَّل في data/proof/_auto-log.json (الكتاب، والصفحة، وقبل، وبعد) فيمكن التراجع عنه، ويظهر في #/proof.
مفتاح الإيقاف: proof_auto في «الخدمات والمفاتيح» (data/switches.json).
"""
import datetime, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, "data"); P = os.path.join(D, "proof")
DAYS = float(os.environ.get("PROOF_AUTO_DAYS", "3"))
SAFE = {"طباعة", "إملاء", "آية", "تصحيف"}
jl = lambda p, d: json.load(open(p, encoding="utf-8")) if os.path.exists(p) else d
def js(p, o): json.dump(o, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


def lev(a, b):
    if len(a) < len(b): a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def small(a, b):
    d = lev(a, b)
    return d <= max(3, len(a) // 4) and abs(len(a.split()) - len(b.split())) <= 1


def famous_ids(cat):
    s = set()
    try: s |= {x["id"] for x in jl(os.path.join(ROOT, "tools", "turath-list.json"), {"books": []})["books"]}
    except Exception: pass
    try: s |= {x["id"] for x in jl(os.path.join(D, "turathio-queue.json"), {"items": []})["items"]}
    except Exception: pass
    return s


def main():
    sw = (jl(os.path.join(D, "switches.json"), {}) or {}).get("s") or {}
    if sw.get("proof_auto") is False: print("الاعتماد التلقائي موقوف من المفاتيح"); return
    cat = jl(os.path.join(D, "catalog.json"), {"books": []}); by = {b["id"]: b for b in cat["books"]}; fam = famous_ids(cat)
    lst = jl(os.path.join(P, "_list.json"), {}); log = jl(os.path.join(P, "_auto-log.json"), {"note": "تصحيحات طُبّقت تلقائيًا بعد مهلة المراجعة (tools/proof-auto.py)", "items": []})
    today = datetime.date.today(); total = 0
    for f in sorted(os.listdir(P)):
        if f.startswith("_") or not f.endswith(".json"): continue
        bid = f[:-5]; b = by.get(bid)
        if not b: continue
        if not ((b.get("col") or "dawah") == "dawah" or bid in fam or (b.get("set") or "") in fam or b.get("img") == "r2"): continue
        R = jl(os.path.join(P, f), {"pages": {}}); since = (lst.get(bid) or {}).get("upd") or "2000-01-01"
        shp = os.path.join(D, "books", bid + ".json")
        if not os.path.exists(shp): shp = os.path.join(ROOT, "vols", bid + ".json")
        sh = jl(shp, None)
        if not sh: continue
        done = 0
        for p, v in R["pages"].items():
            at = v.get("at") or since
            try:
                if (today - datetime.date.fromisoformat(at[:10])).days < DAYS: continue
            except Exception: continue
            i = int(p) - 1
            if not (0 <= i < len(sh["pages"])) or not isinstance(sh["pages"][i], str): continue
            keep = []
            for x in v.get("fx") or []:
                a, z = x.get("from") or "", x.get("to") or ""
                if x.get("k") in SAFE and a and a != z and small(a, z) and sh["pages"][i].count(a) == 1:
                    sh["pages"][i] = sh["pages"][i].replace(a, z)
                    log["items"].append({"id": bid, "p": int(p), "k": x.get("k"), "from": a, "to": z, "at": today.isoformat()}); done += 1
                else:
                    keep.append(x)
            v["fx"] = keep
        if done:
            js(shp, sh); js(os.path.join(P, f), R)
            e = lst.setdefault(bid, {"t": b.get("setTitle") or b.get("title")})
            e["n"] = sum(len(v.get("fx") or []) for v in R["pages"].values()); e["auto"] = e.get("auto", 0) + done
            total += done; print("%s: طُبّق %d تصحيحًا تلقائيًا" % (b.get("title"), done))
    if total:
        log["items"] = log["items"][-20000:]
        js(os.path.join(P, "_auto-log.json"), log); js(os.path.join(P, "_list.json"), lst)
    print("المجموع:", total)


if __name__ == "__main__":
    main()
