#!/usr/bin/env python3
"""مطابقة النسخ المصورة بالنصية (يعمل على خوادم GitHub؛ المصورات في مخزن R2 الخاص تُجلب بهوية المهمة OIDC):
لكل كتاب مصور (pdf في الفهرس): يقارن عدد صفحات المصورة بعدد صفحات النص، ثم يأخذ عينة صفحات (كل ~١٠ صفحات، حتى MATCH_SAMPLE)،
ويستخرج نص صفحة المصورة (طبقة النص إن وُجدت، وإلا Tesseract العربي)، ويقيس تشابه الكلمات مع نص الصفحة المقابلة
وما حولها (±٣) فيعرف الإزاحة الصحيحة. النتائج:
  - إزاحة ثابتة في أغلب العينة (٦٠٪ فأكثر وتشابه كافٍ) ⇒ تُصحَّح pdfOffset في الفهرس آليًّا.
  - صفحة ضعيفة التشابه مع كل جاراتها ⇒ تُضاف إلى unrev في ملف الكتاب فيعيد التدقيق الدوري (ocr.yml rereview) قراءتها على الصورة.
  - التقرير: data/match/report.json و tools/match-report.md.
المتغيرات: MATCH_ONLY (كتب بعينها)، MATCH_SAMPLE (٢٤)، MATCH_APPLY=1 (تطبيق التصحيحات)."""
import json, os, re, subprocess, sys, tempfile, time, urllib.request, urllib.error, shutil
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 sdsl-bot'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, 'data')
def norm(s):
    s = re.sub(r'[ً-ْٰـ]', '', s or ''); s = re.sub(r'[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه')
    return [w for w in re.sub(r'[^ء-ي\s]', ' ', s).split() if len(w) > 2]
def jac(a, b):
    a, b = set(a), set(b); return len(a & b) / max(1, len(a | b))
def oidc_get(path):
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"] + "&audience=sdsl-library", headers={"Authorization": "bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]}), timeout=30).read())["value"]
    site = os.environ.get("SITE_URL", "https://dawahlibrary.org").rstrip("/")
    try: return json.loads(urllib.request.urlopen(urllib.request.Request(site + path, headers={"Authorization": "Bearer " + tok, "User-Agent": UA}), timeout=30).read())
    except urllib.error.HTTPError as e: raise RuntimeError("HTTP %d: %s" % (e.code, e.read()[:200].decode("utf-8", "ignore")))
def get_pdf(bid, tmp):
    loc = os.path.join(ROOT, 'pdf', bid + '.pdf')
    if os.path.exists(loc): return loc
    dest = os.path.join(tmp, bid + '.pdf')
    url = oidc_get("/api/r2put?pdf=" + bid)["url"]
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=600) as r, open(dest, 'wb') as out: shutil.copyfileobj(r, out, 1 << 20)
    return dest
def npages(pdf):
    out = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', out); return int(m.group(1)) if m else 0
CACHE = {}
def page_text(pdf, n, tmp):
    if (pdf, n) in CACHE: return CACHE[(pdf, n)]
    t = subprocess.run(['pdftotext', '-f', str(n), '-l', str(n), '-layout', pdf, '-'], capture_output=True, text=True).stdout
    if len(norm(t)) < 15:  # مصورة بلا طبقة نص: تعرّف ضوئي سريع
        base = os.path.join(tmp, 'p%d' % n)
        subprocess.run(['pdftoppm', '-f', str(n), '-l', str(n), '-r', '150', '-gray', '-png', pdf, base], capture_output=True)
        imgs = [f for f in os.listdir(tmp) if f.startswith('p%d' % n) and f.endswith('.png')]
        t = subprocess.run(['tesseract', os.path.join(tmp, imgs[0]), '-', '-l', 'ara', '--psm', '6'], capture_output=True, text=True).stdout if imgs else ''
        for f in imgs: os.remove(os.path.join(tmp, f))
    CACHE[(pdf, n)] = norm(t); return CACHE[(pdf, n)]
def align(T, P, off):
    """مطابقة رتيبة لكل صفحة نص بصفحة مصورة (برمجة ديناميكية): التشابه بالكلمات، مع غرامة على القفز."""
    n, N = len(T), len(P)
    if not n or not N: return [], []
    BAND = 10; NEG = -1e9
    sim = {}
    def S(i, j):
        k = (i, j)
        if k not in sim: sim[k] = jac(T[i], P[j]) if len(T[i]) >= 15 and len(P[j]) >= 15 else 0.0
        return sim[k]
    cand = [[j for j in range(max(0, i + off - BAND), min(N, i + off + BAND + 1))] for i in range(n)]
    dp = [{} for _ in range(n)]; bk = [{} for _ in range(n)]
    for j in cand[0]: dp[0][j] = S(0, j) - 0.02 * abs(j - off)
    for i in range(1, n):
        for j in cand[i]:
            best, arg = NEG, None
            for jp, v in dp[i - 1].items():
                if jp > j: continue
                jump = j - jp
                pen = 0 if jump == 1 else (0.04 if jump == 0 else 0.03 * (jump - 1))
                if v - pen > best: best, arg = v - pen, jp
            if arg is not None: dp[i][j] = best + S(i, j); bk[i][j] = arg
    j = max(dp[-1], key=dp[-1].get); path = [j]
    for i in range(n - 1, 0, -1): j = bk[i][j]; path.append(j)
    path.reverse()
    return [j + 1 for j in path], [S(i, path[i]) for i in range(n)]


def full_match(b, sh, pdf, N, tmp, apply):
    """مطابقة كل الصفحات (لا عينة): ينتج pmap عند اختلاف الترتيب، ويعلّم الصفحات التي لا تشبه صورتها."""
    from concurrent.futures import ThreadPoolExecutor
    pages = sh['pages']; off = int(b.get('pdfOffset') or 0)
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
        P = list(ex.map(lambda k: page_text(pdf, k, tempfile.mkdtemp(dir=tmp)), range(1, N + 1)))
    T = [norm(re.split(r'^\s*_{4,}\s*$', t or '', flags=re.M)[0]) for t in pages]
    pm, sc = align(T, P, off)
    linear = all(pm[i] == i + 1 + off for i in range(len(pm)))
    shifts = {}
    for i in range(len(pm)): shifts[pm[i] - i - 1] = shifts.get(pm[i] - i - 1, 0) + 1
    common = max(shifts, key=shifts.get) if shifts else 0
    weak = [i for i in range(len(pm)) if len(T[i]) >= 30 and len(P[pm[i] - 1]) >= 30 and sc[i] < 0.08]
    fixed = []
    if apply:
        if linear: sh.pop('pmap', None)
        elif all(pm[i] == i + 1 + common for i in range(len(pm))):
            sh.pop('pmap', None); b['pdfOffset'] = common; fixed.append('pdfOffset %d→%d' % (off, common))
        else:
            sh['pmap'] = pm; b['pdfOffset'] = 0; b['pmap'] = 1
            fixed.append('خريطة صفحات (%d صفحة خارج الترتيب البسيط)' % sum(1 for i in range(len(pm)) if pm[i] != i + 1 + common))
        if linear: b.pop('pmap', None)
        if weak:
            sh['unrev'] = sorted(set(sh.get('unrev') or []) | set(weak)); b['unrev'] = len(sh['unrev'])
            fixed.append('%d صفحة لا تشبه صورتها ← إعادة القراءة' % len(weak))
    return {'full': 1, 'avg': round(sum(sc) / max(1, len(sc)), 3), 'shift': common, 'linear': linear, 'weak': weak[:60], 'nweak': len(weak), 'fixed': fixed}


def main():
    cat = json.load(open(os.path.join(D, 'catalog.json'), encoding='utf-8')); only = [x for x in os.environ.get('MATCH_ONLY', '').split(',') if x]
    S = int(os.environ.get('MATCH_SAMPLE', '24')); apply = os.environ.get('MATCH_APPLY') == '1'
    FULL = os.environ.get('MATCH_FULL', '1') == '1'; deadline = time.time() + 60 * float(os.environ.get('MATCH_MINUTES', '100'))
    rp = os.path.join(D, 'match', 'report.json')
    try: old = json.load(open(rp, encoding='utf-8')).get('books', {})
    except Exception: old = {}
    rep = {'at': time.strftime('%Y-%m-%d %H:%M'), 'books': dict(old)}; md = ['# مطابقة النسخ المصورة بالنصية — ' + rep['at'], '']
    books = [b for b in cat['books'] if b.get('pdf') and not b.get('hidden') and (not only or b['id'] in only)]
    # المطابقة الكاملة لكل الصفحات: الكتب التي لم تُطابَق كاملة بعد أو تغيّر عدد صفحاتها، الأحدث أولًا
    if FULL and not only:
        books = [b for b in books if not (old.get(b['id']) or {}).get('full') or (old.get(b['id']) or {}).get('textPages') != b.get('n')]
        books.sort(key=lambda b: b.get('added') or '', reverse=True)
    for b in books:
        if time.time() > deadline: print('انتهى الوقت المخصص؛ البقية في الجولة القادمة'); break
        bid = b['id']; tmp = tempfile.mkdtemp()
        try:
            shp = os.path.join(D, 'books', bid + '.json'); sh = json.load(open(shp, encoding='utf-8')); pages = sh['pages']
            pdf = get_pdf(bid, tmp); N = npages(pdf); off = int(b.get('pdfOffset') or 0)
            if FULL:
                info = {'t': b['title'], 'textPages': len(pages), 'pdfPages': N, 'offset': off}
                info.update(full_match(b, sh, pdf, N, tmp, apply))
                if apply: json.dump(sh, open(shp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
                rep['books'][bid] = info; fixed = info['fixed']
                md.append('## %s (%s)\n- صفحات النص %d، المصورة %d، متوسط التطابق %d٪، %s\n- صفحات لا تشبه صورتها: %d%s\n' % (
                    b['title'], bid, len(pages), N, round(info['avg'] * 100), 'الترتيب مطابق' if info['linear'] else 'إزاحة غالبة %+d' % info['shift'],
                    info['nweak'], ('\n- التصحيح: ' + '؛ '.join(fixed)) if fixed else ''))
                print(bid, {k: v for k, v in info.items() if k != 'weak'}, flush=True)
                continue
            idx = sorted(set([0, len(pages) - 1] + list(range(2, len(pages), max(1, len(pages) // S)))))[:S + 2]
            res = []
            for i in idx:
                tw = norm(pages[i])
                if len(tw) < 20: continue
                best = max(((jac(tw, page_text(pdf, i + 1 + off + d, tmp)), d) for d in range(-3, 4) if 1 <= i + 1 + off + d <= N), default=(0, 0))
                res.append({'i': i, 's': round(best[0], 3), 'd': best[1]})
            ds = [r['d'] for r in res if r['s'] >= 0.2]; mode = max(set(ds), key=ds.count) if ds else 0; share = ds.count(mode) / max(1, len(res))
            weak = [r['i'] for r in res if r['s'] < 0.12]
            avg = round(sum(r['s'] for r in res) / max(1, len(res)), 3)
            info = {'t': b['title'], 'textPages': len(pages), 'pdfPages': N, 'offset': off, 'sample': len(res), 'avg': avg, 'shift': mode, 'shiftShare': round(share, 2), 'weak': weak}
            fixed = []
            if apply and mode and share >= 0.6:
                b['pdfOffset'] = off + mode; fixed.append('pdfOffset %d→%d' % (off, off + mode))
            if apply and weak:
                u = sorted(set(sh.get('unrev') or []) | set(weak)); sh['unrev'] = u; json.dump(sh, open(shp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
                b['unrev'] = len(u); fixed.append('%d صفحة إلى إعادة القراءة على الصورة' % len(weak))
            info['fixed'] = fixed; rep['books'][bid] = info
            md.append('## %s (%s)\n- العينة %d صفحة، متوسط التطابق %d٪، إزاحة %+d\n' % (b['title'], bid, len(res), round(avg * 100), mode))
            print(bid, info, flush=True)
        except Exception as e:
            rep['books'][bid] = {'t': b['title'], 'err': str(e)[:200]}; md.append('## %s\n- تعذر: %s\n' % (b['title'], str(e)[:200])); print('خطأ', bid, e, flush=True)
        finally: shutil.rmtree(tmp, ignore_errors=True)
        if apply:  # حفظ تدريجي: لا يضيع ما أُنجز إن انقطعت المهمة
            json.dump(cat, open(os.path.join(D, 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    os.makedirs(os.path.join(D, 'match'), exist_ok=True)
    json.dump(rep, open(rp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(ROOT, 'tools', 'match-report.md'), 'w', encoding='utf-8').write('\n'.join(md))
    if apply: json.dump(cat, open(os.path.join(D, 'catalog.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
if __name__ == '__main__':
    main()
