#!/usr/bin/env python3
"""التدقيق الحديثي (التخريج) لكتاب من كتب المكتبة: python3 tools/takhrij.py <الكتاب>
لكل حديث مرفوع في الكتاب (النص بين علامات الاقتباس بعد «صلى الله عليه وسلم/ﷺ/قال رسول الله»):
  - عزو المؤلف نفسه بعده (رواه/أخرجه … ومعه الحكم بين معقوفين إن ذكره).
  - مواضعه في كتب السنة بالمكتبة بالمطابقة النصية (نافذة كلمات متتابعة بعد التطبيع)، مرتبة: الصحيحان ثم السنن ثم غيرها.
  - حكم الترمذي إن ورد عقب الحديث في جامعه.
لا يُصدر حكمًا من خارج المصادر؛ وما لم يُعثر عليه يُعلَّم (nf) للمراجعة اليدوية. المخرجات data/takhrij/<الكتاب>.json"""
import json, os, re, sys, glob, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS = [("bukhari", "صحيح البخاري"), ("muslim", "صحيح مسلم"), ("abudawud", "سنن أبي داود"), ("tirmidhi", "جامع الترمذي"), ("nasai", "سنن النسائي"), ("ibnmajah", "سنن ابن ماجه"),
         ("musnadahmad", "مسند أحمد"), ("muwatta", "موطأ مالك"), ("darimi", "سنن الدارمي"), ("sunankubra", "السنن الكبرى للبيهقي"), ("shuabiman", "شعب الإيمان"), ("adabmufrad", "الأدب المفرد"),
         ("riyad", "رياض الصالحين"), ("bulugh", "بلوغ المرام"), ("jamiulum", "جامع العلوم والحكم"), ("masabih", "مصابيح السنة")]
def norm(s):
    s = re.sub(r'[ً-ْٰـ]', '', s or ''); s = re.sub(r'[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'\s+', ' ', re.sub(r'[^ء-ي0-9\s]', ' ', s)).strip()
def pages_of(bid):
    out = []
    for f in [os.path.join(ROOT, 'data', 'books', bid + '.json')] + sorted(glob.glob(os.path.join(ROOT, 'vols', bid + '-v*.json'))) + sorted(glob.glob(os.path.join(ROOT, 'data', 'books', bid + '-v*.json'))):
        if os.path.exists(f):
            d = json.load(open(f, encoding='utf-8')); vid = os.path.basename(f)[:-5]
            out += [(vid, i + 1, p) for i, p in enumerate(d.get('pages') or [])]
    return out
CUE = re.compile(r'(?:صلى الله عليه وسلم|ﷺ|صلى الله عليه وآله وسلم)\s*(?:-\s*)?(?:أنه\s+)?(?:قال|يقول)?\s*:?\s*[«"(]([^»")\n]{12,500})[»")]')
CITE = re.compile(r'^[\s.،:)»"\]\-–]*\(?\s*((?:رواه|أخرجه|متفق عليه)[^.\n]{0,120})')
GRADE = re.compile(r'(هذا حديث|حديث)\s+((?:حسن|صحيح|غريب)(?:\s+(?:حسن|صحيح|غريب))*)')
def main(bid):
    src = json.load(open(os.path.join(ROOT, 'data', 'books', bid + '.json'), encoding='utf-8'))['pages']
    corpus = []
    for k, name in BOOKS:
        for vid, p, t in pages_of(k): corpus.append((k, name, vid, p, norm(t), t))
    print('صفحات كتب السنة:', len(corpus), flush=True)
    items, seen = [], set()
    for i, pg in enumerate(src):
        body = re.split(r'^\s*_{4,}\s*$', pg, flags=re.M)[0]
        for m in CUE.finditer(body):
            t = re.sub(r'\s*\(¬\d*\s*$', '', m.group(1)).strip(' ،,'); n = norm(t); ws = n.split()
            if len(ws) < 4 or n in seen: continue
            seen.add(n)
            after = body[m.end():m.end() + 160]; cm = CITE.match(after); cite = cm.group(1).strip() if cm else ''
            wins = [' '.join(ws[j:j + 6]) for j in range(0, max(1, len(ws) - 5), 3)][:6] if len(ws) >= 6 else [n]
            loc, grade = [], []
            for k, name, vid, p, nt, raw in corpus:
                if any(w in nt for w in wins):
                    if not any(x[0] == k for x in loc) or len([x for x in loc if x[0] == k]) < 2:
                        loc.append([k, name, vid, p])
                    if k == 'tirmidhi' and not grade:
                        pos = min((nt.find(w) for w in wins if w in nt), default=-1)
                        g = GRADE.search(nt[pos:pos + 900]) if pos >= 0 else None
                        if g: grade = ['قال الترمذي: ' + g.group(0), vid, p]
                if len(loc) >= 10: break
            items.append({'p': i + 1, 't': t[:400], 'cite': cite, 'loc': loc, 'g': grade, 'nf': 0 if loc else 1})
    out = {'b': bid, 'at': time.strftime('%Y-%m-%d'), 'n': len(items), 'found': sum(1 for x in items if x['loc']), 'books': [k for k, _ in BOOKS], 'items': items}
    os.makedirs(os.path.join(ROOT, 'data', 'takhrij'), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, 'data', 'takhrij', bid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('أحاديث:', out['n'], '— وُجدت مواضعها:', out['found'])
if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'uluwhimma')
