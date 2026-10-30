#!/usr/bin/env python3
"""يولّد إعدادات Cloudflare Pages (_headers و_routes.json) من vercel.json وملفات الجذر،
فتبقى الاستضافتان متطابقتين. يُشغَّل آليًا في البناء (أمر البناء: python3 tools/cf-config.py)."""
import json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
v = json.loads((R / "vercel.json").read_text(encoding="utf-8"))
root = sorted(p.name for p in R.iterdir() if p.is_file() and p.suffix in (".js", ".css", ".ico", ".webmanifest", ".html", ".json", ".txt", ".png", ".svg") and not p.name.startswith(("_", ".")) and p.name not in ("package.json", "package-lock.json", "vercel.json", "index.html"))
H = {h["source"]: h["headers"] for h in v["headers"]}
sec = H["/((?!setup-db\\.html).*)"]
out = ["/*"] + [f"  {h['key']}: {h['value']}" for h in sec] + ["", "/setup-db.html", "  ! Content-Security-Policy", ""]
cc = lambda src: next(h["value"] for h in H[src] if h["key"] == "Cache-Control")
for d in ("data", "assets", "vendor"):
    out += [f"/{d}/*", f"  Cache-Control: {cc('/data/(.*)' if d == 'data' else '/(assets|vendor)/(.*)')}", ""]
for f in ("favicon.ico", "manifest.webmanifest", "404.html"):
    out += [f"/{f}", f"  Cache-Control: {cc('/(favicon\\.ico|manifest\\.webmanifest|404\\.html)')}", ""]
for f in root:
    if f.endswith((".js", ".css")) and f != "sw.js":
        out += [f"/{f}", f"  Cache-Control: {cc('/:file([^/]+\\.(?:js|css))')}", ""]
out += ["/sw.js", "  Cache-Control: no-cache", "", "/api/*", "  X-Robots-Tag: noindex", ""]
(R / "_headers").write_text("\n".join(out), encoding="utf-8")
dirs = sorted(p.name for p in R.iterdir() if p.is_dir() and not p.name.startswith((".", "_")) and p.name not in ("api", "functions", "lib", "node_modules", "tools", "supabase"))
ex = ["/", "/index.html"] + [f"/{d}/*" for d in dirs] + [f"/{f}" for f in root if f not in ("robots.txt",)]
assert len(ex) + 1 <= 100, "Cloudflare: 100 rules max"
(R / "_routes.json").write_text(json.dumps({"version": 1, "include": ["/*"], "exclude": ex}, indent=1) + "\n", encoding="utf-8")
print("headers:", len(out), "lines | routes exclude:", len(ex))
