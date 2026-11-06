// فحص «خط المصحف» على الموقع الحي: تحميل خطوط QCF4 من jsDelivr وعرض الصفحات، مع لقطة في tools/reports
const { chromium } = require("playwright");
const SITE = process.env.SITE || "https://dawahlibrary.org";
(async () => {
  const b = await chromium.launch(), out = [];
  for (const pg of [1, 3, 300, 604]) {
    const p = await b.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1 }), errs = [];
    p.on("console", m => { if (/Content Security Policy|Refused|font/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    p.on("requestfailed", r => { if (/jsdelivr|qcf/.test(r.url())) errs.push("فشل: " + r.url() + " " + (r.failure() || {}).errorText); });
    await p.goto(SITE + "/#/mushaf/p/" + pg, { waitUntil: "networkidle" }).catch(e => errs.push(String(e)));
    await p.waitForTimeout(6000);
    const r = await p.evaluate(() => ({ qpage: !!document.querySelector(".qpage"), lines: document.querySelectorAll(".qpage .ql").length,
      fonts: [...document.fonts].filter(f => /QCF/.test(f.family)).map(f => f.family + ":" + f.status), text: !!document.querySelector(".qtext"),
      btn: (document.querySelector('[data-act="musmode"]') || {}).textContent || "" }));
    out.push(`ص${pg}: عرض الخط=${r.qpage} أسطر=${r.lines} نص عادي=${r.text} زر=${r.btn.trim()} خطوط=${r.fonts.join(",") || "—"}${errs.length ? " أخطاء: " + errs.join(" | ") : ""}`);
    if (pg === 3 || pg === 1) await p.screenshot({ path: `tools/reports/mushaf-live-${pg}.png`, fullPage: false });
    await p.close();
  }
  require("fs").writeFileSync("tools/reports/mushaf-live.txt", out.join("\n") + "\n"); console.log(out.join("\n")); await b.close();
})();
