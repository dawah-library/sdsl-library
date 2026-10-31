#!/usr/bin/env python3
"""النشر الآلي لمواد المصادر الإثرائية (col=ithra) من قائمة المراجعة data/import-review.json.
لا يُنشر النص كاملًا: lic=link فيُعرض ملخص (٩٠٠ حرف) ورابط المصدر الأصلي، كما في الاعتماد اليدوي (manage.js impDecide).
يعمل للمصادر التي فيها auto=true في data/sources.json (تفعيل المدير ٣١ أكتوبر ٢٠٢٦)، بعد كل استجلاب (sources.yml).
المؤلف: اسم الكاتب إن وُجد (سجل مستقل col=ithra)، وإلا المصدر نفسه. التصنيف والنوع بالكلمات المفتاحية."""
import json, re, os, datetime
ROOT = os.path.join(os.path.dirname(__file__), '..'); D = lambda *p: os.path.join(ROOT, 'data', *p)
load = lambda p, d=None: json.load(open(p)) if os.path.exists(p) else d
src = load(D('sources.json')); Q = load(D('import-review.json')); idx = load(D('articles', 'index.json')); cat = load(D('catalog.json'))
auto = {s['id']: s for s in src['sources'] if s.get('auto') and s.get('col') == 'ithra'}
# التصنيف الموضوعي لأقسام المقالات (at/st) بالكلمات المفتاحية؛ الافتراضي «مذاهب فكرية في الميزان»
TOP = [('st57', r'البيوع|الفقه|فقه|كتاب البيوع|المزارعة|الزكاة|الصيام|الصلاة|الطلاق|النكاح|الربا|القواعد الفقهية|مسائل لا تصح'),
       ('st85', r'صحيح مسلم|صحيح البخاري|حديث|السنة النبوية|الرواية'),
       ('st8', r'عقيد|التوحيد|الأشاعرة|الأشعري|علم الكلام|الصفات|القرآن الكريم|عذاب القبر|المعجزة|الإيمان|الشرك|البدع|القبور'),
       ('st71', r'الصوفية|الزيدية|الحوثي|الشيعة|الرافضة|الفرق|المذاهب الإسلامية|النوحية|اليهود'),
       ('st4', r'الملاحدة|الإلحاد|العلمان|الليبرال|النسوية|التنوير|الحداثة|الوعي'),
       ('st84', r'تاريخ|التاريخ|ابن تيمية|محمد بن عبد الوهاب|الوهابية|صلاح الدين|الفاتح|أبي حنيفة|علي بن أبي طالب|الحنابلة|ترجمة|أعلام'),
       ('at8', r'الزوج|الأسرة|المرأة|الأبناء|الأولاد|الوفاء'),
       ('st55', r'الأخلاق|التربية|السلوك|القلب|الإنجاز|معلم')]
def topic(t):
    for k, rx in TOP:
        if re.search(rx, t): return k
    return 'st4'
def kind(x):
    t = x['t']
    if re.search(r'تعريف بكتاب|عرض وتعريف|كتاب:|نقد كتاب|قراءة في كتاب', t): return 'book'
    if re.search(r'دراسة|الجزء|بحث|أوراق|مدخل|قواعد|الأصول|موقف', t) or len(x.get('text', '')) > 6000: return 'research'
    return 'article'
def clean_author(a):
    a = re.sub(r'^(الشيخ|الكاتب)\s*:\s*', '', (a or '').strip()); a = re.sub(r'\s+', ' ', a)
    return '' if (not a or re.fullmatch(r'(الفرقان|مركز سلف.*|admin)', a)) else a
names = {a['name']: a['id'] for a in cat['authors'] if a.get('col') == 'ithra'}
def author(name):
    if name in names: return names[name]
    aid = 'ix' + format(int(datetime.datetime.now().timestamp() * 1000) + len(names), 'x')
    cat['authors'].append({'id': aid, 'name': name, 'col': 'ithra', 'bio': '', 'auto': True}); names[name] = aid; return aid
have = {x['id'] for x in idx['items']}; groups = {}; n = 0
for x in Q['items']:
    s = auto.get(x.get('src'))
    if not s or x.get('st') != 'pending' or x['id'] in have: continue
    text = x.get('text', '')
    if len(text) < 300: continue
    aid = author(clean_author(x.get('author')) or s['name'])
    g = x['d'][:7] if re.match(r'\d{4}-\d{2}', x.get('d') or '') else 'undated'
    if g not in groups: groups[g] = load(D('articles', g + '.json'), {})
    body = text[:900] + '…\n\n[النص كاملًا في مصدره الأصلي]'
    groups[g][x['id']] = {'pages': [body]}
    item = {'id': x['id'], 't': x['t'], 'a': aid, 'tp': topic(x['t'] + ' ' + text[:400]), 'c': x.get('srcName', ''), 'd': x.get('d', ''), 'u': x['u'], 'f': g,
            'n': len(body), 'ad': datetime.date.today().isoformat(), 'src': x['src'], 'col': 'ithra', 'lic': 'link', 'sum': text[:400], 'ik': kind(x)}
    idx['items'].append(item); x['st'] = 'approved'; x['aid'] = aid; x.pop('text', None); n += 1
for g, o in groups.items(): json.dump(o, open(D('articles', g + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
if n:
    json.dump(idx, open(D('articles', 'index.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(Q, open(D('import-review.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    json.dump(cat, open(D('catalog.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('نُشر', n, 'مادة إثرائية')
