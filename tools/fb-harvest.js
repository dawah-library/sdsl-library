// «زائر بلا حساب»: يجلب أحدث منشورات حسابات فيسبوك العامة (صفحات وحسابات شخصية) كما يراها أي زائر غير مسجّل،
// بلا رمز ولا تسجيل دخول ولا حساب. فيسبوك يعرض للزائر أحدث منشور أو اثنين ثم يطلب الدخول، فتعمل المهمة كل ساعة
// (fb-harvest.yml) لتلتقط كل جديد في ساعته. الناتج data/fb-inbox.json، ويقرؤه tools/source-import.js (fbDiscover)
// فيمر بمسار المراجعة أو النشر التلقائي نفسه. يقرأ المنشورات من بيانات JSON المضمّنة في الصفحة وردود graphql.
// الاستخدام: node tools/fb-harvest.js [معرّف_مصدر ...]
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { chromium } = require("playwright-core");
const DATA = path.join(__dirname, "..", "data"), SRC = path.join(DATA, "sources.json"), BOX = path.join(DATA, "fb-inbox.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PAR = +process.env.FB_PAR || 4, MAX_AGE = (+process.env.FB_MAX_AGE_DAYS || 10) * 864e5, STALE = 7 * 864e5;
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// يمشي في كائنات JSON: كل رسالة نصية مع أقرب تاريخ إنشاء ورابط ومعرّف منشور في سياقها
function walk(o, acc, ctx) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, acc, ctx); return; }
  const c = { ...ctx };
  if (typeof o.creation_time === "number") c.t = o.creation_time;
  if (typeof o.url === "string" && /facebook\.com\/.*(\/posts\/|\/videos\/|\/reel\/|permalink|story_fbid|\/photo)/.test(o.url) && !/comment_id=/.test(o.url)) c.u = o.url.split("?")[0];
  if (o.post_id && /^\d+$/.test(String(o.post_id))) c.id = String(o.post_id);
  const m = o.message && typeof o.message.text === "string" ? o.message.text : "";
  if (m.length > 15) { const k = m.slice(0, 100); if (!acc.has(k)) acc.set(k, { text: m }); }
  for (const v of Object.values(o)) walk(v, acc, c);
  if (m.length > 15) { const a = acc.get(m.slice(0, 100)); a.t = a.t || c.t; a.u = a.u || c.u; a.id = a.id || c.id; }
}
const blobsOf = s => { const r = []; for (const line of String(s).split("\n")) { const x = line.trim(); if (x[0] === "{" || x[0] === "[") try { r.push(JSON.parse(x)); } catch (e) { } } return r; };
const keyOf = p => p.id ? "p" + p.id.slice(-14) : "h" + crypto.createHash("md5").update(p.text.replace(/\s+/g, " ").trim().slice(0, 300)).digest("hex").slice(0, 13);

async function harvest(br, s) {
  const url = "https://www.facebook.com/" + (/^\d+$/.test(s.fb) ? "profile.php?id=" + s.fb : s.fb);
  const ctx = await br.newContext({ userAgent: UA, locale: "ar-EG", viewport: { width: 1280, height: 2400 } });
  await ctx.route("**/*", r => /^(image|media|font)$/.test(r.request().resourceType()) ? r.abort() : r.continue());
  const p = await ctx.newPage(), blobs = [];
  p.on("response", async r => { if (/\/api\/graphql|\/ajax\//.test(r.url())) { try { blobs.push(...blobsOf(await r.text())); } catch (e) { } } });
  let res = { n: 0, err: "" };
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); await p.waitForTimeout(3500);
    if (/\/login|checkpoint/.test(p.url())) throw new Error("تحويل إلى صفحة الدخول (حساب غير عام أو مقيّد)");
    for (let i = 0; i < 6; i++) {
      const close = await p.$('div[role=dialog] [aria-label="إغلاق"], div[role=dialog] [aria-label="Close"]');
      if (close) { await close.click().catch(() => { }); await p.waitForTimeout(600); }
      await p.mouse.wheel(0, 3000); await p.waitForTimeout(1500);
    }
    for (const t of await p.$$eval('script[type="application/json"]', es => es.map(e => e.textContent))) { try { blobs.push(JSON.parse(t)); } catch (e) { } }
    const acc = new Map(); blobs.forEach(b => walk(b, acc, {}));
    res.posts = [...acc.values()].filter(x => x.t && Date.now() - x.t * 1000 < MAX_AGE).map(x => ({ src: s.id, k: keyOf(x), u: x.u || url, t: x.t, text: x.text }));
    res.n = res.posts.length;
  } catch (e) { res.err = e.message.slice(0, 160); }
  await ctx.close();
  return res;
}

(async () => {
  const only = process.argv.slice(2), conf = readJSON(SRC, { sources: [] });
  const list = conf.sources.filter(s => s.type === "facebook" && s.fb && s.fb !== "share" && s.fb !== "login" && (only.length ? only.includes(s.id) : s.on !== false));
  const box = readJSON(BOX, { v: 1, items: [], st: {} }); box.st = box.st || {};
  const have = new Set(box.items.map(x => x.src + "|" + x.k));
  const br = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--lang=ar"] });
  let added = 0, i = 0;
  await Promise.all(Array.from({ length: Math.min(PAR, list.length) }, async () => {
    while (i < list.length) {
      const s = list[i++], r = await harvest(br, s), st = box.st[s.id] || (box.st[s.id] = {});
      st.at = new Date().toISOString(); st.err = r.err || undefined; st.n = r.n;
      for (const x of r.posts || []) { if (have.has(x.src + "|" + x.k)) continue; have.add(x.src + "|" + x.k); box.items.push(Object.assign(x, { at: st.at })); added++; st.lastNew = st.at; }
      if (r.n) st.lastSeen = st.at;
      console.log(`[${s.id}] ${r.err ? "خطأ: " + r.err : "منشورات ظاهرة: " + r.n}`);
      await sleep(1500);
    }
  }));
  await br.close();
  // الحسابات التي لم يظهر منها منشور أسبوعًا (تغيّر في فيسبوك أو حساب مقيّد) — تُعرض في التقرير
  box.stale = list.filter(s => { const st = box.st[s.id] || {}; return !st.lastSeen || Date.now() - Date.parse(st.lastSeen) > STALE; }).map(s => s.id);
  box.items = box.items.sort((a, b) => b.t - a.t).slice(0, 3000); box.lastRun = new Date().toISOString(); box.lastAdded = added;
  fs.writeFileSync(BOX, JSON.stringify(box, null, 1));
  console.log(`الحسابات: ${list.length} | جديد في الصندوق: ${added} | بلا منشور ظاهر أسبوعًا: ${box.stale.length}`);
})();
