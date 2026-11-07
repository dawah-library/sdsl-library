// فحص دخان محلي بعد تعديل الوكيل: يفتح أهم الصفحات ويجمع أخطاء JavaScript. الاستخدام: node tools/agent-smoke.js [مسارات إضافية…]
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/json" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(process.cwd(), p);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); r.end(d); }); }).listen(8799);
(async () => {
  const routes = ["#/", "#/library", "#/authors", "#/majalla", "#/posts", "#/stats", "#/paths", "#/mushaf", "#/hadith", "#/talaea", "#/about"].concat(process.argv.slice(2));
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on("pageerror", e => errs.push(p.url().split("#")[1] + ": " + e.message));
  for (const r of routes) { try { await p.goto("http://localhost:8799/" + r, { waitUntil: "domcontentloaded", timeout: 30000 }); await p.waitForTimeout(1800); } catch (e) { errs.push(r + ": " + e.message); } }
  await b.close(); srv.close();
  if (errs.length) { console.log("أخطاء الواجهة:\n" + [...new Set(errs)].join("\n")); process.exit(1); }
  console.log("فحص الدخان: " + routes.length + " صفحة بلا أخطاء");
})();
