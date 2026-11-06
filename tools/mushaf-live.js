// فحص «خط المصحف» على الموقع الحي: تحميل خطوط QCF4 من jsDelivr وعرض الصفحات، مع لقطة في tools/reports
const pw = require("playwright"), ENG = process.env.ENGINE || "chromium";
const SITE = process.env.SITE || "https://dawahlibrary.org";
(async () => {
  const b = await pw[ENG].launch(), out = [], ctx = ENG === "webkit" ? await b.newContext(pw.devices["iPhone 13"]) : await b.newContext({ viewport: { width: 420, height: 900 } });
  for (const pg of [1, 3, 300, 604]) {
    const p = await ctx.newPage(), errs = [];
    p.on("console", m => { if (/Content Security Policy|Refused|font/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    p.on("requestfailed", r => { if (/jsdelivr|qcf/.test(r.url())) errs.push("فشل: " + r.url() + " " + (r.failure() || {}).errorText); });
    await p.goto(SITE + "/#/mushaf/p/" + pg, { waitUntil: "networkidle" }).catch(e => errs.push(String(e)));
    await p.waitForTimeout(6000);
    const r = await p.evaluate(() => ({ qpage: !!document.querySelector(".qpage"), lines: document.querySelectorAll(".qpage .ql").length,
      fonts: [...document.fonts].filter(f => /QCF/.test(f.family)).map(f => f.family + ":" + f.status), text: !!document.querySelector(".qtext"), err: (document.querySelector(".mqerr small") || {}).textContent || "",
      btn: (document.querySelector('[data-act="musmode"]') || {}).textContent || "" }));
    out.push(`[${ENG}] ص${pg}: عرض الخط=${r.qpage} أسطر=${r.lines} نص عادي=${r.text}${r.err ? " سبب=" + r.err : ""} زر=${r.btn.trim()} خطوط=${r.fonts.join(",") || "—"}${errs.length ? " أخطاء: " + errs.join(" | ") : ""}`);
    if (pg === 3 || pg === 1) await p.screenshot({ path: `tools/reports/mushaf-live-${ENG}-${pg}.png`, fullPage: false });
    await p.close();
  }
  require("fs").writeFileSync(`tools/reports/mushaf-live-${ENG}.txt`, out.join("\n") + "\n"); console.log(out.join("\n")); await b.close();
})();
