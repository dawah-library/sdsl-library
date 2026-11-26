#!/usr/bin/env python3
"""تدقيق أسماء المؤلفين في data/catalog.json وتنقيتها (طلب المدير: قسم المؤلفين).
بلا أي حذف: التنقية إعادة تسمية فقط، والاسم الأصلي يُحفظ في aliases. الدمج لا يُجرى هنا (يُعرض للمراجعة البشرية).
الاستخدام:
  python3 tools/author-clean.py            تقرير فقط (لا كتابة)
  python3 tools/author-clean.py --apply    يطبق التنقية القطعية ويكتب المشتبه في data/author-review.json
"""
import json, re, sys, collections, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CAT = os.path.join(ROOT, 'data', 'catalog.json'); REV = os.path.join(ROOT, 'data', 'author-review.json')
IDX = os.path.join(ROOT, 'data', 'articles', 'index.json')
APPLY = '--apply' in sys.argv

def bare(s):
    s = re.sub('[\u064B-\u0652\u0640]', '', s or ''); s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'^(الشيخ|الدكتور|دكتور|الاستاذ|الامام|د\.?|م\.?)\s+', '', s.strip())
    s = re.sub(r'\s*-?\s*(حفظه الله|رحمه الله)\s*-?$', '', s)
    return re.sub(r'\s+', ' ', s).strip()

DAYS = r'(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)'
def clean_name(n):
    """تنقية قطعية: رموز أول الاسم، وأقواس الأرقام والتواريخ والنجمة. (عبارات الترحم تبقى كما كتبها المصدر.)"""
    o = n
    n = re.sub(r'^[\s/\\\-–—*•.:،]+', '', n)
    n = re.sub(r'\s*\((?:[\d\s\-/.*٠-٩]+|' + DAYS + r'[^)]*|\*+)\)\s*$', '', n)
    n = re.sub(r'\s*\(\*+\)\s*$', '', n)
    n = re.sub(r'[\s*/.:،]+$', '', n); n = re.sub(r'\s+', ' ', n).strip()
    return n

def suspicious(n):
    return len(n) > 45 or bool(re.search(r'تمهيد|مقدمة|بين يدي|إعداد|^\W|\d{2,}', n))

cat = json.load(open(CAT, encoding='utf-8')); A = cat['authors']
use = collections.Counter(b['authorId'] for b in cat['books'])
try: arts = collections.Counter(x.get('a') for x in json.load(open(IDX, encoding='utf-8'))['items'])
except Exception: arts = collections.Counter()
rep = {'renamed': [], 'review_name': [], 'dup_same_col': [], 'dup_cross_col': []}
taken = collections.defaultdict(set)
for a in A:
    if not a.get('mergedInto'): taken[(a.get('col') or 'dawah', bare(a['name']))].add(a['id'])
for a in A:
    if a.get('mergedInto'): continue
    n = a['name']; col = a.get('col') or 'dawah'
    c2 = clean_name(n) if col != 'turath' else n   # المكتبة العامة: القوسان فيها بيان طبعة مقصود
    if c2 != n and len(bare(c2)) >= 3 and not suspicious(c2):
        clash = [i for i in taken[(col, bare(c2))] if i != a['id']]
        if clash: rep['review_name'].append({'id': a['id'], 'name': n, 'why': 'الاسم المنقى يطابق مؤلفًا موجودًا', 'with': clash})
        else:
            rep['renamed'].append({'id': a['id'], 'from': n, 'to': c2})
            if APPLY:
                a['name'] = c2; al = a.setdefault('aliases', [])
                if n not in al: al.append(n)
    elif suspicious(n) and col != 'turath':
        rep['review_name'].append({'id': a['id'], 'name': n, 'why': 'اسم مشتبه (عنوان أو مقدمة أو تاريخ)', 'books': use[a['id']], 'articles': arts[a['id']]})
g = collections.defaultdict(list)
for a in A:
    if not a.get('mergedInto'): g[bare(a['name'])].append(a)
for k, v in g.items():
    if len(v) > 1:
        cols = {(x.get('col') or 'dawah') for x in v}
        (rep['dup_cross_col'] if len(cols) > 1 else rep['dup_same_col']).append({'name': k, 'ids': [(x['id'], x.get('col'), use[x['id']], arts[x['id']]) for x in v]})
print(json.dumps(rep, ensure_ascii=False, indent=1))
if APPLY:
    if rep['renamed']:
        import time; cat['version'] = int(time.time() * 1000)
        open(CAT, 'w', encoding='utf-8').write(json.dumps(cat, ensure_ascii=False, separators=(',', ':')))
    R = json.load(open(REV, encoding='utf-8')) if os.path.exists(REV) else {'items': []}
    have = {(x.get('kind'), x.get('id') or x.get('name')) for x in R['items']}
    for x in rep['review_name']:
        if ('name', x['id']) not in have: R['items'].append(dict(x, kind='name'))
    for x in rep['dup_same_col'] + rep['dup_cross_col']:
        if ('dup', x['name']) not in have: R['items'].append(dict(x, kind='dup'))
    json.dump(R, open(REV, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('تم الحفظ.')
else: print('تقرير فقط: لم يُكتب شيء (استعمل --apply).')
