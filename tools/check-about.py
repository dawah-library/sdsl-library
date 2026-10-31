#!/usr/bin/env python3
"""يتحقق أن صفحة التعريف بالمكتبة (about.js) تشمل كل خدمات الموقع:
- كل مسار في موجّه app.js (v==="x") مذكور في عناصر ABOUT_SECS (الحقل الثالث) أو في قائمة التجاهل.
- كل ملف سكربت في index.html مذكور في ABOUT_MODULES.
يكتب النواقص في .about-missing.txt ويخرج بـ 1 إن وُجدت."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda f: open(os.path.join(ROOT, f), encoding="utf-8").read()
IGNORE = {"about", "account", "admin", "contact", "pick", "tarjama"}  # صفحات إدارية أو مساعدة لا خدمات مستقلة
app, about, idx = rd("app.js"), rd("about.js"), rd("index.html")
routes = set(r for c in re.findall(r'if\(((?:v==="[a-z]+"\|?\|?)+)\)\s*return\s+v[A-Z]', app) for r in re.findall(r'"([a-z]+)"', c)) | set(re.findall(r'href="#/([a-z]+)', idx))
covered = set(" ".join(re.findall(r'\["[^"]+", "[^"]+", "([a-z ]+)"\]', about)).split())
mods = set(re.findall(r'<script src="([a-z0-9-]+)\.js"', idx))
mcov = set(re.search(r'ABOUT_MODULES = "([^"]*)"', about).group(1).split())
miss_r, miss_m = sorted(routes - covered - IGNORE), sorted(mods - mcov)
out = []
if miss_r: out.append("صفحات غير مذكورة في التعريف بالمكتبة: " + "، ".join("#/" + r for r in miss_r))
if miss_m: out.append("ملفات خدمات جديدة لم تُدرج في التعريف بالمكتبة: " + "، ".join(m + ".js" for m in miss_m))
if out:
    open(os.path.join(ROOT, ".about-missing.txt"), "w", encoding="utf-8").write("\n".join(out))
    print("\n".join("::warning::" + x for x in out)); sys.exit(1)
# فحص بنيوي: كل عنصر في ABOUT_SECS مصفوفة (فاصلة ناقصة بين عنصرين تجعل JavaScript يقرؤهما فهرسة فتتعطل الصفحة)
import subprocess as _sp
_r = _sp.run(["node", "-e", "const s=require('fs').readFileSync(process.argv[1],'utf8');const m=s.match(/const ABOUT_SECS = (\\[[\\s\\S]*?\\n\\]);/);const S=eval(m[1]);let b=[];S.forEach(([t,L])=>L.forEach((x,j)=>{if(!Array.isArray(x)||x.length<2)b.push(t+' #'+(j+1))}));if(b.length){console.log(b.join(', '));process.exit(1)}", "about.js"], capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _r.returncode: print("::warning::خلل في بنية ABOUT_SECS (فاصلة ناقصة؟): " + (_r.stdout or _r.stderr).strip()); sys.exit(1)
print("صفحة التعريف بالمكتبة تشمل كل الخدمات (%d صفحة، %d ملفًا)." % (len(routes), len(mods)))
