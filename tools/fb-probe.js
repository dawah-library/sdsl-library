// فحص طرق جلب منشورات فيسبوك العامة بلا رمز ولا تسجيل دخول (يعمل على خوادم GitHub: fb-probe.yml).
// الطرق: (١) أداة «الصفحة» المضمّنة الرسمية plugins/page.php، (٢) الصفحة العامة بمتصفح بلا دخول،
// (٣) أداة «المنشور» المضمّنة plugins/post.php لنص منشور معروف الرابط، (٤) نسخة الجوال m.facebook.com.
const { chromium } = require("playwright-core");
const TARGETS = (process.env.FB_IDS || "Salafiacall,yasserborhamy,samh.mhmd.bsywny,100010404454280,memara60").split(",");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const out = [];
const L = (...a) => { const s = a.join(" "); console.log(s); out.push(s); };
const unesc = s => { try { return JSON.parse('"' + s + '"'); } catch (e) { return s; } };
const msgs = html => [...new Set([...html.matchAll(/"message":\{(?:"delight_ranges":\[\],)?[^{}]*?"text":"((?:[^"\\]|\\.){20,})"/g)].map(m => unesc(m[1])))];
const links = html => [...new Set([...html.matchAll(/https?:\\?\/\\?\/www\.facebook\.com\\?\/[^"]*?(?:\\?\/posts\\?\/|story_fbid=|permalink\.php|pfbid)[^"\\&]*/g)].map(m => m[0].replace(/\\\//g, "/")))].slice(0, 5);
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--lang=ar"] });
  const ctx = await br.newContext({ userAgent: UA, locale: "ar-EG", viewport: { width: 1280, height: 2400 } });
  for (const id of TARGETS) {
    L("\n==== " + id);
    const page = "https://www.facebook.com/" + (/^\d+$/.test(id) ? "profile.php?id=" + id : id);
    // ١) أداة الصفحة المضمّنة
    try {
      const u = "https://www.facebook.com/plugins/page.php?href=" + encodeURIComponent(page) + "&tabs=timeline&width=500&height=3000&small_header=true&locale=ar_AR";
      const r = await fetch(u, { headers: { "user-agent": UA, "accept-language": "ar" } }); const h = await r.text();
      const t = [...h.matchAll(/<div[^>]+(?:userContent|_5pbx)[^>]*>([\s\S]*?)<\/div>/g)].map(m => m[1].replace(/<[^>]+>/g, " ").trim());
      L("١-خام plugin/page:", r.status, h.length, "منشورات:", t.length, t[0] ? "| " + t[0].slice(0, 120) : "");
      const p = await ctx.newPage(); await p.goto(u, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      const txt = await p.evaluate(() => [...document.querySelectorAll(".userContent,._5pbx,[data-testid=post_message]")].map(e => e.innerText.trim()).filter(Boolean)).catch(() => []);
      const body = await p.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => "");
      L("١-متصفح plugin/page: منشورات:", txt.length, txt[0] ? "| " + txt[0].slice(0, 160).replace(/\n/g, " ") : "| نص الصفحة: " + body.replace(/\n/g, " ").slice(0, 200));
      await p.close();
    } catch (e) { L("١ خطأ", e.message); }
    // ٢) الصفحة العامة بمتصفح بلا دخول
    let found = [];
    try {
      const p = await ctx.newPage(); let gql = "";
      p.on("response", async r => { if (/graphql|ajax/.test(r.url())) { try { gql += await r.text(); } catch (e) {} } });
      await p.goto(page, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
      await p.waitForTimeout(4000);
      for (const sel of ['[aria-label="إغلاق"]', '[aria-label="Close"]', 'div[role=dialog] [role=button]']) { const b = await p.$(sel); if (b) { await b.click().catch(() => {}); break; } }
      for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 2500); await p.waitForTimeout(1500); }
      const html = await p.content() + gql;
      const m = msgs(html); found = links(html);
      L("٢-متصفح الصفحة:", p.url().slice(0, 80), "| نصوص منشورات:", m.length, "| روابط منشورات:", found.length, "| تسجيل؟", /login/.test(p.url()) ? "نعم" : "لا");
      m.slice(0, 3).forEach(s => L("   •", s.slice(0, 160).replace(/\n/g, " ")));
      found.slice(0, 2).forEach(s => L("   ↳", s));
      await p.close();
    } catch (e) { L("٢ خطأ", e.message); }
    // ٣) أداة المنشور المضمّنة لأول رابط
    if (found[0]) try {
      const u = "https://www.facebook.com/plugins/post.php?href=" + encodeURIComponent(found[0]) + "&width=500&locale=ar_AR";
      const r = await fetch(u, { headers: { "user-agent": UA } }); const h = await r.text();
      const t = (h.match(/<div[^>]+(?:userContent|_5pbx)[^>]*>([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || "";
      L("٣-plugin/post:", r.status, h.length, "| نص:", t.replace(/<[^>]+>/g, " ").trim().slice(0, 160));
    } catch (e) { L("٣ خطأ", e.message); }
    // ٤) نسخة الجوال
    try {
      const r = await fetch(page.replace("www.", "m."), { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36", "accept-language": "ar" }, redirect: "follow" });
      const h = await r.text(); L("٤-m.facebook:", r.status, r.url.slice(0, 70), h.length, "| نصوص:", msgs(h).length);
    } catch (e) { L("٤ خطأ", e.message); }
  }
  await br.close();
  require("fs").mkdirSync("tools/fb-probe", { recursive: true });
  require("fs").writeFileSync("tools/fb-probe/report.md", out.join("\n") + "\n");
})();
