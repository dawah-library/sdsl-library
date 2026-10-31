#!/usr/bin/env python3
"""حارس المهام: جدولة GitHub تفوّت كثيرًا من التشغيلات المجدولة (التذكير الساعي، والاستيراد اليومي…).
يقرأ مواعيد cron من ملفات المهام، ويحسب أطول فاصل متوقع بين تشغيلين، فإن مضى على آخر تشغيل للمهمة (بأي سبب)
أكثر من الفاصل ×١٫٥ (ونصف ساعة سماحًا) شغّلها يدويًا (workflow_dispatch). يعمل كل ٢٠ دقيقة وبعد كل نشر للموقع.
المفاتيح الموقوفة من «الإدارة ← الخدمات والمفاتيح» تحترمها كل مهمة بنفسها (وظيفة gate)، فلا يتجاوزها الحارس."""
import glob, json, os, re, subprocess, datetime
REPO = os.environ.get('GITHUB_REPOSITORY', 'dawah-library/sdsl-library'); ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {'watchdog.yml', 'turathio-batch.yml'}
def gh(*a):
    r = subprocess.run(['gh', *a], capture_output=True, text=True); return r.stdout if r.returncode == 0 else ''
def gap_hours(crons):
    """أطول فاصل بين مواعيد اليوم (بالساعات) لمجموعة cron بسيطة."""
    if not crons: return None
    times = []
    for c in crons:
        m, h, dom, mon, dow = c.split()
        if dow != '*': return 24 * 7
        if h == '*': return 1
        if h.startswith('*/'): return int(h[2:])
        for hh in h.split(','): times.append(int(hh) + int(m) / 60)
    times.sort(); gaps = [b - a for a, b in zip(times, times[1:])] + [24 - times[-1] + times[0]]
    return max(gaps)
now = datetime.datetime.now(datetime.timezone.utc); fired = []
for f in sorted(glob.glob(os.path.join(ROOT, '.github', 'workflows', '*.yml'))):
    name = os.path.basename(f); src = open(f, encoding='utf-8').read()
    if name in SKIP or 'workflow_dispatch' not in src: continue
    crons = re.findall(r'cron:\s*"([^"]+)"', src); g = gap_hours(crons)
    if not g: continue
    j = gh('api', f'repos/{REPO}/actions/workflows/{name}/runs?per_page=1', '-q', '.workflow_runs[0] | [.created_at, .status] | @tsv').strip()
    if not j: continue
    t, status = j.split('\t')
    if status in ('queued', 'in_progress', 'pending', 'waiting', 'requested'): continue
    age = (now - datetime.datetime.fromisoformat(t.replace('Z', '+00:00'))).total_seconds() / 3600
    if age > g * 1.5 + 0.5:
        (os.environ.get('DRY') or gh('workflow', 'run', name, '-R', REPO, '--ref', 'main')); fired.append(f'{name} (آخر تشغيل قبل {age:.1f} ساعة، والمتوقع كل {g:g})')
print('شُغّل:' if fired else 'كل المهام في مواعيدها.', *fired, sep='\n')
