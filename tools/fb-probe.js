// فحص (٢): جلب منشورات فيسبوك العامة بمتصفح بلا دخول ولا رمز — يقرأ بيانات JSON المضمّنة في الصفحة
// وردود graphql، ويستخرج كل منشور (المعرّف، النص الكامل، التاريخ، الرابط). يعمل على خوادم GitHub (fb-probe.yml).
const { chromium } = require("playwright-core");
const TARGETS = (process.env.FB_IDS || "Salafiacall,yasserborhamy,samh.mhmd.bsywny,100010404454280,memara60,d.la.rmdan,AlnourPartyOfficialPage").split(",");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const out = []; const L = (...a) => { const s = a.join(" "); console.log(s); out.push(s); };
function walk(o, acc, ctx) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { o.forEach(x => walk(x, acc, ctx)); return; }
  const c = { ...ctx };
  if (o.creation_time) c.t = o.creation_time;
  if (typeof o.url === "string" && /\/(posts|videos|reel|permalink|photo)/.test(o.url)) c.u = o.url;
  if (o.post_id) c.id = o.post_id;
  if (o.message && typeof o.message.text === "string" && o.message.text.length > 15) {
    const k = o.message.text.slice(0, 80); const prev = acc.get(k) || {};
    acc.set(k, { text: o.message.text, t: prev.t || c.t, u: prev.u || c.u, id: prev.id || c.id });
  }
  for (const v of Object.values(o)) walk(v, acc, c);
  // التاريخ والرابط قد يأتيان في أخوة الرسالة لا آبائها
  if (o.message && typeof o.message.text === "string") { const a = acc.get(o.message.text.slice(0, 80)); if (a) { a.t = a.t || c.t; a.u = a.u || c.u; } }
}
const parseBlobs = s => { const r = []; for (const line of s.split(/\n/)) { const x = line.trim(); if (x[0] === "{" || x[0] === "[") try { r.push(JSON.parse(x)); } catch (e) {} } return r; };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--lang=ar"] });
  for (const id of TARGETS) {
    const ctx = await br.newContext({ userAgent: UA, locale: "ar-EG", viewport: { width: 1280, height: 2400 } });
    for (const page of ["https://www.facebook.com/" + (/^\d+$/.test(id) ? "profile.php?id=" + id : id)].concat(/^\d+$/.test(id) ? ["https://www.facebook.com/" + id] : [])) {
      L("\n==== " + id + " ← " + page);
      const p = await ctx.newPage(); const blobs = []; let wall = 0;
      p.on("response", async r => { if (/\/api\/graphql|\/ajax\//.test(r.url())) { try { blobs.push(...parseBlobs(await r.text())); } catch (e) {} } });
      try {
        await p.goto(page, { waitUntil: "domcontentloaded", timeout: 45000 });
        await p.waitForTimeout(4000);
        for (let i = 0; i < 8; i++) {
          const close = await p.$('div[role=dialog] [aria-label="إغلاق"], div[role=dialog] [aria-label="Close"]');
          if (close) { wall++; await close.click().catch(() => {}); await p.waitForTimeout(800); }
          await p.mouse.wheel(0, 3000); await p.waitForTimeout(1800);
        }
        const scripts = await p.$$eval('script[type="application/json"]', es => es.map(e => e.textContent));
        scripts.forEach(s => { try { blobs.push(JSON.parse(s)); } catch (e) {} });
        const acc = new Map(); blobs.forEach(b => walk(b, acc, {}));
        const posts = [...acc.values()].sort((a, b) => (b.t || 0) - (a.t || 0));
        L("الرابط النهائي:", p.url().slice(0, 70), "| كتل JSON:", blobs.length, "| نوافذ دخول أُغلقت:", wall, "| منشورات:", posts.length);
        posts.slice(0, 12).forEach(x => L("  •", x.t ? new Date(x.t * 1000).toISOString().slice(0, 16) : "؟", "| طول", x.text.length, "|", (x.u || "").split("?")[0].slice(0, 90), "|", x.text.slice(0, 100).replace(/\n/g, " ")));
      } catch (e) { L("خطأ", e.message); }
      await p.close();
    }
    await ctx.close();
  }
  await br.close();
})();
