#!/usr/bin/env node
/* تصدير أعداد المجلة PDF من «مطبعة المجلة» (majpress) بمتصفح Chromium:
   نص حقيقي قابل للبحث والنسخ، وخطوط مضمَّنة، وروابط قابلة للنقر، وفهرس داخلي (Bookmarks) من عناوين الأبواب والمواد، وحجم A4.
   الاستعمال: node tools/majalla-pdf.js [معرّف العدد…]   (بلا معرّف: كل الأعداد المنشورة)
   الناتج: data/majalla/pdf/<id>.pdf (رقمي) و<id>-print.pdf (للطباعة: خلفية بيضاء وحواف قص 3مم)، وتقرير الفحص data/majalla/pdf/report.json
   يتوقف بخطأ إن وُجدت صفحات فارغة أو تجاوز للمحتوى (MAJ_STRICT=0 لتعطيل ذلك). */
const fs = require("fs"), path = require("path"), http = require("http");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("playwright-core")); }
const ROOT = path.resolve(__dirname, ".."), OUT = path.join(ROOT, "data/majalla/pdf");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

function serve() {
  return new Promise(ok => {
    const s = http.createServer((q, r) => {
      let f = decodeURIComponent(q.url.split("?")[0]); if (f.endsWith("/")) f += "index.html";
      const p = path.join(ROOT, f); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(r);
    }).listen(0, () => ok(s));
  });
}

(async () => {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data/majalla.json"), "utf8"));
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : D.issues.filter(x => x.status === "published").map(x => x.id);
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch();
  const report = fs.existsSync(path.join(OUT, "report.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "report.json"), "utf8")) : {};
  let bad = 0;
  for (const id of ids) for (const mode of ["digital", "mobile", "print"]) {
    const page = await browser.newPage();
    page.on("pageerror", e => console.error("خطأ في الصفحة:", e.message));
    await page.goto(`http://localhost:${port}/majpress/?issue=${encodeURIComponent(id)}&mode=${mode}&auto=1`);
    await page.waitForFunction(() => window.MJP_DONE, null, { timeout: 600000 });
    const r = await page.evaluate(() => window.MJP_DONE);
    if (r.error) throw new Error(id + ": " + r.error);
    const file = path.join(OUT, id + (mode === "digital" ? "" : "-" + mode) + ".pdf");
    await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
    const kb = Math.round(fs.statSync(file).size / 1024);
    const hard = r.issues.filter(z => ["empty", "overflow", "font"].includes(z.type));
    bad += hard.length;
    report[id + ":" + mode] = { pages: r.pages, kb, passes: r.passes, fixes: r.fixes, issues: r.issues, at: new Date().toISOString() };
    console.log(`${id} [${mode}] ${r.pages} صفحة، ${kb} ك.ب، ${r.issues.length} ملاحظة${hard.length ? "، منها " + hard.length + " حرجة" : ""}`);
    r.issues.forEach(z => console.log(`  - ${z.page ? "ص" + z.page + ": " : ""}${z.msg}`));
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  await browser.close(); srv.close();
  if (bad && process.env.MAJ_STRICT !== "0") { console.error(`ملاحظات حرجة: ${bad}`); process.exit(2); }
})().catch(e => { console.error(e); process.exit(1); });
