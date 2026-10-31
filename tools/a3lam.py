#!/usr/bin/env python3
"""موسوعة أعلام المسلمين (التراجم العامة): من «سير أعلام النبلاء» في المكتبة (مرتب بالطبقات، أي زمنيًّا)،
لكل علم: ترجمة موجزة منقولة بنصها مع موضعها، وتصنيفه بالفن من ألقابه في أول ترجمته، وقرنه بحسب طبقته في السير،
ومراجع للتوسع من كتب التراجم والجرح والتعديل الأخرى في المكتبة (مطابقة بالاسم، يُنبَّه عليها).
المخرجات: data/a3lam/c<القرن>.json و data/a3lam/_index.json. يُعاد بناؤه بعد alam.py."""
import json, glob, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AL = os.path.join(ROOT, 'data', 'alam'); OUT = os.path.join(ROOT, 'data', 'a3lam')
os.makedirs(OUT, exist_ok=True)
E = {}
for f in glob.glob(os.path.join(AL, 'e-*.json')): E.update(json.load(open(f, encoding='utf-8')))
K = {}
for f in glob.glob(os.path.join(AL, '0*.json')): K.update(json.load(open(f, encoding='utf-8')).get('k', {}))
SRC = {s[0]: s[1] for s in json.load(open(os.path.join(AL, '_meta.json'), encoding='utf-8'))['sources']}
def norm(s):
    s = re.sub(r'[ً-ْٰـ]', '', s or ''); s = re.sub(r'[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', re.sub(r'[^ء-ي\s]', ' ', s)).strip()
# القرن بحسب مجلد السير (ترتيب الذهبي بالطبقات؛ تقريبي)
def century(v):
    return 1 if v <= 4 else 2 if v <= 8 else 3 if v <= 13 else 4 if v <= 16 else 5 if v <= 18 else 6 if v <= 20 else 7
FIELDS = [('sahaba', 'الصحابة', r'له صحبة|صاحب رسول الله|الصحابي|شهد بدرا|من السابقين الأولين|أم المؤمنين'),
          ('khulafa', 'الخلفاء والأمراء', r'الخليفة|أمير المؤمنين|السلطان|الملك|الأمير|الوزير|صاحب (مصر|الشام|حلب|دمشق)'),
          ('quran', 'القراء والمفسرون', r'المقرئ|مقرئ|القارئ|المفسر|صاحب التفسير|شيخ القراء'),
          ('fiqh', 'الفقهاء والقضاة', r'الفقيه|فقيه|مفتي|المفتي|القاضي|قاضي|شيخ (الحنفية|المالكية|الشافعية|الحنابلة)'),
          ('hadith', 'المحدثون والرواة', r'الحافظ|المحدث|محدث|المسند|مسند|الثقة|حدث عن|سمع'),
          ('lugha', 'اللغويون والأدباء', r'النحوي|اللغوي|الأديب|الشاعر|البليغ|الكاتب|صاحب (الأمالي|كتاب)'),
          ('tarikh', 'المؤرخون والإخباريون', r'المؤرخ|الأخباري|الإخباري|صاحب التاريخ|النسابة'),
          ('zuhd', 'الزهاد والعباد', r'الزاهد|العابد|الواعظ|القدوة|الولي')]
def fields(x, v):
    head = x.split('*', 1)[-1][:260] if '*' in x else x[:260]
    fs = [k for k, _, rx in FIELDS if re.search(rx, head)]
    if v <= 3 and 'sahaba' not in fs and re.search(r'رضي الله عنه|صحب', x[:300]): fs.insert(0, 'sahaba')
    return fs[:3] or ['other']
def brief(x):
    x = re.sub(r'^\d+\s*-\s*', '', x).replace('**', '*'); x = re.sub(r'\(\d+\)', '', x); x = re.sub(r'\s+', ' ', x).strip()
    return x if len(x) < 250 else x[:250].rsplit(' ', 1)[0] + '…'
by = collections.defaultdict(list); n = 0
for id_, e in E.items():
    if e.get('s') != 'siyar': continue
    v = int(id_.split('.')[1]); c = century(v); k = norm(e['n'])
    refs = []
    ws = k.split(' '); kw = set(w for w in ws if len(w) > 2 and w not in ('ابن', 'ابو', 'بن', 'عبد'))
    for m in (len(ws), 5, 4, 3):  # الاسم كاملًا ثم أوائله، بشرط تشابه الاسمين (ثلاث كلمات مميزة مشتركة على الأقل)
        for r in (K.get(' '.join(ws[:m])) or []):
            x = E.get(r)
            if r.startswith('siyar') or r in refs or not x: continue
            if len(kw & set(norm(x['n']).split(' '))) >= min(3, len(kw)): refs.append(r)
        if len(refs) >= 6: break
    refs = refs[:6]
    R = []
    for r in refs:
        x = E.get(r)
        if x: R.append([SRC.get(x['s'], x['s']).split(' ')[0] + ' ' + SRC.get(x['s'], '').split(' ', 1)[-1].split(' ل')[0] if False else SRC.get(x['s'], x['s']), x['b'], x['p'], x.get('pl', '')])
    by[c].append({'i': id_, 'n': e['n'], 'v': v, 'o': int(id_.split('.')[2]), 'f': fields(e['x'], v), 'x': brief(e['x']), 'b': e['b'], 'p': e['p'], 'pl': e.get('pl', ''), 'r': R})
    n += 1
idx = {'v': 1, 'src': 'سير أعلام النبلاء للذهبي', 'fields': [[k, l] for k, l, _ in FIELDS] + [['other', 'أعلام آخرون']], 'c': {}}
for c, L in by.items():
    L.sort(key=lambda z: (z['v'], z['o']))
    json.dump(L, open(os.path.join(OUT, 'c%d.json' % c), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    idx['c'][str(c)] = {'n': len(L), 'f': dict(collections.Counter(f for z in L for f in z['f']))}
json.dump(idx, open(os.path.join(OUT, '_index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('أعلام:', n, {c: len(L) for c, L in sorted(by.items())})
