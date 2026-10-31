// فحص الموقع الحي بمتصفح آلي بعد كل نشر: يفتح صفحات الأقسام والخدمات على الجوال، ويسجّل أخطاء JavaScript والملفات المفقودة
// والصفحات العالقة على «جارٍ التحميل». الناتج tools/live-smoke.md، ويخرج بخطأ إن وُجد خلل (فيصل الإشعار إلى الإدارة).
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const BASE = process.env.SITE_URL || "https://dawahlibrary.org/";
const R = ["", "#/dawah", "#/library", "#/library?c=turath", "#/articles", "#/fatawa", "#/bayanat", "#/posts", "#/community", "#/audio", "#/radio", "#/ask", "#/tarajim", "#/tarajim?t=aam",
  "#/alam", "#/history", "#/about", "#/furqan", "#/ithra", "#/qa", "#/book/uluwhimma/5", "#/author/a1", "#/authors", "#/search?q=%D8%A7%D9%84%D8%AA%D9%88%D8%AD%D9%8A%D8%AF", "#/mine", "#/hifz",
  "#/tashjir", "#/quizzes", "#/paths", "#/paths/aqida1", "#/releases", "#/talaea", "#/talaea?s=g", "#/talaea/track?k=t3&s=b", "#/qabasat", "#/tafrighat", "#/summary?b=uluwhimma&r=10",
  "#/contact", "#/majalla", "#/majalla/i1", "#/takhrij/uluwhimma", "#/account"];
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true }), p = await ctx.newPage(), bad = [];
  let errs = []; p.on("pageerror", e => errs.push("JS: " + e.message.slice(0, 160)));
  p.on("response", r => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE) && !/\/api\//.test(u)) errs.push(r.status() + " " + u.slice(BASE.length - 1, 140)); });
  for (const h of R) {
    errs = [];
    try { await p.goto(BASE + h, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) { errs.push("تحميل: " + e.message.slice(0, 80)); }
    await p.waitForTimeout(2500);
    const t = await p.evaluate(() => (document.querySelector("#app") || document.body).innerText.trim()).catch(() => "");
    if (/^جارٍ تحميل المكتبة/.test(t) || t.length < 40) errs.push("الصفحة لم تكتمل: «" + t.slice(0, 50) + "»");
    if (errs.length) bad.push("- " + (h || "/") + ": " + [...new Set(errs)].join(" | "));
    console.log((errs.length ? "✗ " : "✓ ") + (h || "/"));
  }
  await b.close();
  const md = "# فحص الموقع الحي — " + new Date().toISOString().slice(0, 16).replace("T", " ") + "\n\n" + (bad.length ? bad.join("\n") : "كل الصفحات (" + R.length + ") تعمل بلا أخطاء.");
  fs.writeFileSync(path.join(__dirname, "live-smoke.md"), md); console.log(md);
  if (bad.length) { fs.writeFileSync(path.join(__dirname, "..", ".smoke-report.txt"), "⚠️ <b>فحص الموقع الحي</b>: " + bad.length + " صفحة فيها خلل\n" + bad.slice(0, 12).join("\n")); process.exit(1); }
})();
