// «زائر بلا حساب»: يجلب أحدث منشورات حسابات فيسبوك العامة (صفحات وحسابات شخصية) كما يراها أي زائر غير مسجّل،
// بلا رمز ولا تسجيل دخول ولا حساب. فيسبوك يعرض للزائر أحدث منشور أو اثنين ثم يطلب الدخول، فتعمل المهمة كل ساعة
// (fb-harvest.yml) لتلتقط كل جديد في ساعته. الناتج data/fb-inbox.json، ويقرؤه tools/source-import.js (fbDiscover)
// فيمر بمسار المراجعة أو النشر التلقائي نفسه. يقرأ المنشورات من بيانات JSON المضمّنة في الصفحة وردود graphql.
// التناوب (قرار المدير ٢١ نوفمبر): فيسبوك يحوّل الزائر إلى صفحة الدخول بعد نحو ٨ صفحات متتالية، فتزور كل جولة
// FB_PER_RUN حسابات (٦ افتراضيًّا) أقدمها زيارةً، واحدًا بعد واحد بمهلة بينها، وتتوقف الجولة عند أول تحويل إلى الدخول
// احترامًا للحد؛ فيدور كل حساب نحو مرة كل ٧ ساعات. لا تعدد عناوين ولا إعادة محاولة لتجاوز الحد.
// الاستخدام: node tools/fb-harvest.js [معرّف_مصدر ...]
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { chromium } = require("playwright-core");
const DATA = path.join(__dirname, "..", "data"), SRC = path.join(DATA, "sources.json"), BOX = path.join(DATA, "fb-inbox.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PER_RUN = +process.env.FB_PER_RUN || 6, GAP = (+process.env.FB_GAP_S || 12) * 1000, MAX_AGE = (+process.env.FB_MAX_AGE_DAYS || 10) * 864e5, STALE = 7 * 864e5;
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// يمشي في كائنات JSON: كل رسالة نصية مع أقرب تاريخ إنشاء ورابط ومعرّف منشور في سياقها، ويعلّم المنشور المرفق به مقطع مرئي
// (video): يعيد مفاتيح الرسائل في الفرع وهل فيه مقطع، فإذا اجتمعا في عقدة المنشور (لها تاريخ أو معرّف) عُلّمت رسائلها.
const isVid = o => o.__typename === "Video" || o.is_reel === true || typeof o.playable_url === "string" || typeof o.browser_native_hd_url === "string" || (typeof o.url === "string" && /facebook\.com\/(reel\/|watch|.*\/videos\/)/.test(o.url));
function walk(o, acc, ctx) {
  if (!o || typeof o !== "object") return { ks: [], v: false };
  if (Array.isArray(o)) { const r = { ks: [], v: false }; for (const x of o) { const y = walk(x, acc, ctx); r.ks.push(...y.ks); r.v = r.v || y.v; } return r; }
  const c = { ...ctx };
  if (typeof o.creation_time === "number") c.t = o.creation_time;
  if (typeof o.url === "string" && /facebook\.com\/.*(\/posts\/|\/videos\/|\/reel\/|permalink|story_fbid|\/photo)/.test(o.url) && !/comment_id=/.test(o.url)) c.u = o.url.split("?")[0];
  if (o.post_id && /^\d+$/.test(String(o.post_id))) c.id = String(o.post_id);
  const m = o.message && typeof o.message.text === "string" ? o.message.text : "", k = m.slice(0, 100);
  if (m.length > 15 && !acc.has(k)) acc.set(k, { text: m });
  const r = { ks: m.length > 15 ? [k] : [], v: isVid(o) };
  for (const v of Object.values(o)) { const y = walk(v, acc, c); r.ks.push(...y.ks); r.v = r.v || y.v; }
  if (m.length > 15) { const a = acc.get(k); a.t = a.t || c.t; a.u = a.u || c.u; a.id = a.id || c.id; }
  if (r.v && r.ks.length && (typeof o.creation_time === "number" || o.post_id)) for (const kk of r.ks) acc.get(kk).video = true;
  return r;
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
    res.posts = [...acc.values()].filter(x => x.t && Date.now() - x.t * 1000 < MAX_AGE).map(x => ({ src: s.id, k: keyOf(x), u: x.u || url, t: x.t, text: x.text, video: !!(x.video || /\/(reel|videos)\//.test(x.u || "")) || undefined }));
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
  // نصيب هذه الجولة: الأقدم زيارةً أولًا (ولم يُزر قط قبل الجميع)
  const turn = only.length ? list : list.slice().sort((a, b) => Date.parse((box.st[a.id] || {}).at || 0) - Date.parse((box.st[b.id] || {}).at || 0)).slice(0, PER_RUN);
  const br = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--lang=ar"] });
  let added = 0;
  for (const s of turn) {
    const r = await harvest(br, s), st = box.st[s.id] || (box.st[s.id] = {});
    if (/الدخول/.test(r.err)) { console.log(`[${s.id}] حوّل فيسبوك إلى صفحة الدخول؛ تتوقف الجولة ويُكمل الدور في الجولة التالية`); box.wall = st.at = new Date().toISOString(); st.err = r.err; st.n = 0; break; } // يُسجَّل زائرًا فينتقل إلى آخر الدور (لا يعلق الدور عند حساب مقيّد)
    st.at = new Date().toISOString(); st.err = r.err || undefined; st.n = r.n;
    for (const x of r.posts || []) { if (have.has(x.src + "|" + x.k)) continue; have.add(x.src + "|" + x.k); box.items.push(Object.assign(x, { at: st.at })); added++; st.lastNew = st.at; }
    if (r.n) st.lastSeen = st.at;
    console.log(`[${s.id}] ${r.err ? "خطأ: " + r.err : "منشورات ظاهرة: " + r.n}`);
    await sleep(GAP);
  }
  await br.close();
  // الحسابات التي لم يظهر منها منشور أسبوعًا (تغيّر في فيسبوك أو حساب مقيّد) — تُعرض في التقرير
  box.stale = list.filter(s => { const st = box.st[s.id] || {}; return !st.lastSeen || Date.now() - Date.parse(st.lastSeen) > STALE; }).map(s => s.id);
  box.items = box.items.sort((a, b) => b.t - a.t).slice(0, 3000); box.lastRun = new Date().toISOString(); box.lastAdded = added;
  fs.writeFileSync(BOX, JSON.stringify(box, null, 1));
  console.log(`الحسابات: ${list.length} | زِيرَ في هذه الجولة: ${turn.length} | جديد في الصندوق: ${added} | بلا منشور ظاهر أسبوعًا: ${box.stale.length}`);
})();
