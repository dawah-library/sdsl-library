// الاستجلاب الدوري من المصادر الأساسية الأخرى والمصادر الإثرائية (الباب الرابع من وثيقة التطوير)
// — لا ينشر شيئًا مباشرة: كل مادة جديدة تُوضع في قائمة مراجعة إدارية data/import-review.json بحالة pending،
//   ويعتمدها المشرف من «الإدارة ← مراجعة المستجلب» فتُضاف إلى المقالات بقسمها ومصدرها ومؤلفها (ب4-12، ب4-13، ب4-40، ب4-44).
// — يحفظ المصدر الأصلي ورابطه وتاريخ النشر (ب4-11)، ويمنع التكرار داخل المصدر وبين المصادر بالعنوان والنص (ب4-8، ب4-37، ب4-38)،
//   ويتخطى التهاني والتعازي والأخبار والمقاطع المرئية بلا نص (ب4-9، ب4-10)، ويسجّل وقت المراجعة ونتائجها وأخطاءها (ب4-35، ب4-41، ب4-42).
// المصادر وإعداداتها في data/sources.json (تُعدَّل من الإدارة)؛ المصدر الموقوف أو المحجوب (403) يُسجَّل ولا يوقف غيره.
// الاستخدام: node tools/source-import.js [معرّف_المصدر]
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data");
const SRC = path.join(DATA, "sources.json"), Q = path.join(DATA, "import-review.json"), IDX = path.join(DATA, "articles", "index.json");
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || "").replace(/[ً-ْـ​-‏‪-‮﻿]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
const T = t => norm(String(t || "").replace(/\(?من تراث الدعوة\)?/g, "").replace(/[«»"'()\[\]،,.:؛؟!\-–—]/g, " "));
const decode = s => String(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">");
// ترويسات متصفح عادي (بعض الخوادم تقطع الاتصال مع وكلاء غير معروفين)، مع إعادة المحاولة عند الانقطاع المؤقت
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7", "accept-language": "ar,en;q=0.8" };
async function get(u, tries = 3) {
  for (let t = 1; ; t++) {
    try { const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 45000); const r = await fetch(u, { headers: UA, redirect: "follow", signal: ac.signal }); const body = await r.text(); clearTimeout(tm); if (!r.ok) throw new Error("HTTP " + r.status); return body; }
    catch (e) { if (t >= tries || /HTTP 4(03|04|10)/.test(e.message)) throw e; await sleep(3000 * t); }
  }
}
const shingles = s => { const w = norm(s).split(" "), o = new Set(); for (let i = 0; i + 3 <= w.length; i++) o.add(w.slice(i, i + 3).join(" ")); return o; };
const jacc = (a, b) => { let c = 0; b.forEach(x => a.has(x) && c++); return c / Math.max(1, a.size + b.size - c); };

// النص الرئيس للصفحة: أكثف كتلة فقرات عربية (بلا قوائم الروابط والقوائم الجانبية)
function mainText(html, sel) {
  let h = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|nav|footer|aside|noscript)[\s\S]*?<\/\1>/gi, " ");
  if (sel) { const m = h.match(new RegExp(sel, "i")); if (m) h = m[1] || m[0]; }
  const blocks = [];
  h.split(/<\/(?:div|section|article|td)>/i).forEach(b => {
    const links = (b.match(/<a\b/gi) || []).length, paras = b.split(/<\/p>|<br\s*\/?>|\n/i).map(x => decode(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()).filter(x => (x.match(/[ء-ي]/g) || []).length > 25);
    const len = paras.join(" ").length; if (len > 300 && links < len / 120) blocks.push({ len, paras });
  });
  blocks.sort((a, b) => b.len - a.len);
  return blocks.length ? cssOut(blocks[0].paras.join("\n")) : "";
}
function meta(html, prop) { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i")); return m ? decode(m[1]).trim() : ""; }

// نص من محتوى HTML جاهز (من واجهة ووردبريس أو خلاصة RSS)
const htmlText = h => cssOut(decode(String(h).replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|h\d|li|blockquote)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).split("\n").map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"));
// أسطر تنسيق Word المتسربة (mso-…، font-family…) تُحذف، ويُنظَّف السطر منها
const cssOut = t => t.split("\n").map(l => l.replace(/[\w-]+\s*:\s*[^;:\u0600-\u06FF]{1,60};/g, " ").replace(/\s+/g, " ").trim()).filter(l => (l.match(/[\u0621-\u064A]/g) || []).length > 3 && !/mso-|font-family|text-align|line-height/i.test(l)).join("\n");
const tag = (x, n) => { const m = x.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\/${n}>`, "i")); return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : ""; };
// الاكتشاف الآلي لطريقة الجلب من رابط الموقع: واجهة ووردبريس ← خلاصة RSS ← خريطة الموقع ← روابط الصفحات المحددة (lists/linkRx) ← روابط الرئيسية
async function discover(s, ctx, L) {
  const base = (s.base || "").replace(/\/$/, ""), out = []; out.mode = "";
  const fail = (u, e) => { ctx.errors.push({ src: s.id, url: u, err: e.message }); L(`تعذر ${u}: ${e.message}`); if (/HTTP 403/.test(e.message)) out.err = 1; };
  if (base && s.mode !== "html") {
    try { const j = JSON.parse(await get(base + "/wp-json/wp/v2/posts?per_page=" + (s.perRun || 30) + (s.wpCats ? "&categories=" + s.wpCats : "") + "&_embed=author&_fields=id,date,link,title,content,_embedded,_links", 1));
      if (Array.isArray(j) && j.length) { j.forEach(p => out.push({ id: "wp" + p.id, u: p.link, title: decode(htmlText(p.title && p.title.rendered || "")), date: String(p.date || "").slice(0, 10), html: p.content && p.content.rendered || "", author: ((p._embedded && p._embedded.author && p._embedded.author[0]) || {}).name || "" })); out.mode = "wp-json"; return out; } } catch (e) { }
    for (const f of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/ar/feed"]) {
      try { const x = await get(base + f, 1); if (!/<(rss|feed)\b/i.test(x)) continue;
        x.split(/<item\b|<entry\b/i).slice(1).forEach(it => { const u = decode(tag(it, "link") || ((it.match(/<link[^>]+href=["']([^"']+)/) || [])[1] || "")); if (!u) return;
          out.push({ u, title: decode(htmlText(tag(it, "title"))), date: (Date.parse(tag(it, "pubDate") || tag(it, "updated") || tag(it, "published")) ? new Date(tag(it, "pubDate") || tag(it, "updated") || tag(it, "published")).toISOString().slice(0, 10) : ""), html: tag(it, "content:encoded") || "" }); });
        if (out.length) { out.mode = "rss"; out.forEach(e => { if (htmlText(e.html).length < 600) delete e.html; }); return out; } } catch (e) { if (/403/.test(e.message)) { fail(base + f, e); break; } }
    }
  }
  const lists = (s.lists && s.lists.length ? s.lists : base ? [base + "/"] : []), rx = new RegExp(s.linkRx || (base ? base.replace(/[.]/g, "\\.") + "/[^\"'\\s<>#?]*\\d{3,}[^\"'\\s<>#?]*" : "$^"), "g");
  for (const lp of lists) {
    try { const h = await get(lp);
      if (!s.linkRx) { // روابط المقالات من الصفحة: الموقع نفسه، وفي مسارها رقم، لا أقسام ولا وسوم ولا صفحات تالية
        for (const m of h.matchAll(/href=["']([^"'#]+)["']/g)) { let u; try { u = new URL(decode(m[1]), lp); } catch (e) { continue; }
          if (u.host.replace(/^www\./, "") !== new URL(lp).host.replace(/^www\./, "") || !/\d{3,}/.test(u.pathname) || /\/(category|tag|page|author|search|wp-content|uploads)\//i.test(u.pathname) || /\.(jpg|png|pdf|mp3|mp4)$/i.test(u.pathname)) continue;
          const v = u.origin + u.pathname; if (!out.some(e => e.u === v)) out.push({ u: v }); }
        await sleep(s.delayMs || 1500); continue; }
      let m; while ((m = rx.exec(h))) { const u = decode(m[0].startsWith("http") ? m[0] : new URL(m[0], lp).href); if (!out.some(e => e.u === u)) out.push({ u }); } }
    catch (e) { fail(lp, e); }
    await sleep(s.delayMs || 1500);
  }
  if (!out.length && base) { // خريطة الموقع: أحدث الروابط
    try { let x = await get(base + "/sitemap.xml", 1); const sub = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]); if (/<sitemapindex/i.test(x) && sub.length) x = await get(sub.filter(u => /post|article|news/i.test(u)).pop() || sub[0], 1);
      [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1])).filter(u => /\d{3,}|\/\d{4}\//.test(u)).slice(-(s.perRun || 40)).reverse().forEach(u => out.push({ u })); if (out.length) out.mode = "sitemap"; } catch (e) { }
  } else if (out.length) out.mode = "html";
  return out;
}

async function runSource(s, ctx) {
  const st = s.state || (s.state = {}), log = []; const L = m => { log.push(m); console.log(`[${s.id}] ${m}`); };
  const seen = new Set(st.seen || []); let added = 0, skipped = 0, errs = 0;
  const ents = await discover(s, ctx, L), links = ents.map(e => e.u);
  st.mode = ents.mode || st.mode; if (ents.err) errs++;
  L(`روابط: ${links.length} (${ents.mode || "—"})`);
  for (const en of ents.slice(0, s.perRun || 40)) {
    const u = en.u, key = String(en.id || (u.match(/\d{3,}/) || [u])[0]); if (seen.has(key)) continue;
    try {
      const html = en.html || await get(u); if (!en.html) await sleep(s.delayMs || 1500);
      let title = en.title || meta(html, "og:title") || decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""); title = title.replace(new RegExp("\\s*[-|–]\\s*(" + (s.siteSuffix || "$^") + ").*$"), "").trim();
      let author = en.author || meta(html, "author") || meta(html, "article:author") || ((html.match(/(?:بقلم|كتبه|الكاتب)\s*[:：]\s*([^<\n]{3,40})/) || [])[1] || "").trim(); if (/^https?:|حزب النور|السلفي|^admin$/i.test(author)) author = ""; const am = title.match(/[.،]\s*(?:د\/|الشيخ\/|م\/|أ\/|د\.|الشيخ)\s*([^.()]+)$/); if (am) { author = am[1].trim(); title = title.slice(0, am.index).trim(); }
      const text = en.html ? htmlText(en.html) : mainText(html, s.contentRx), date = (en.date || meta(html, "article:published_time") || (html.match(/\b(20\d\d-\d\d-\d\d)/) || [])[1] || "").slice(0, 10);
      seen.add(key);
      const reason = /^(تهنئة|تعزية)|بخالص العزاء/.test(title) ? "تهنئة/تعزية" : (s.skipRx && new RegExp(s.skipRx).test(title)) ? "خارج النطاق (خبر/مقطع)" : text.length < (s.minChars || 600) ? "بلا نص كافٍ (مقطع مرئي أو صوتي)" : "";
      if (reason) { skipped++; continue; }
      // التكرار: في الفهرس القائم (مصادر أخرى) أو في قائمة المراجعة
      const tw = ctx.idx.items.find(x => T(x.t) === T(title)), qd = ctx.q.items.find(x => T(x.t) === T(title));
      let dup = null; if (tw) dup = tw.id; else if (qd) dup = qd.id;
      if (!dup) { const S1 = shingles(text); for (const x of ctx.q.items.slice(-400)) if (x.text && jacc(S1, shingles(x.text)) > 0.8) { dup = x.id; break; } }
      if (dup) { skipped++; L(`مكرر (${dup}): ${title}`); continue; }
      ctx.q.items.push({ id: s.id + key, src: s.id, srcName: s.name, col: s.col || "dawah", u, t: title, author, d: date, text: text.slice(0, 60000), st: "pending", at: new Date().toISOString(), lic: s.lic || "" });
      added++; L(`+ للمراجعة: ${title}${author ? " — " + author : ""}`);
    } catch (e) { errs++; ctx.errors.push({ src: s.id, url: u, err: e.message }); L(`خطأ ${u}: ${e.message}`); if (/HTTP 4(03|29)/.test(e.message)) { L("المصدر يرفض الطلبات الآلية الآن؛ توقف."); break; } }
  }
  st.seen = [...seen].slice(-5000); st.lastRun = new Date().toISOString(); st.last = { added, skipped, errs };
  return { id: s.id, added, skipped, errs };
}

(async () => {
  const conf = readJSON(SRC, { sources: [] }), only = process.argv[2];
  const ctx = { idx: readJSON(IDX, { items: [] }), q: readJSON(Q, { v: 1, items: [] }), errors: [] };
  const res = [];
  for (const s of conf.sources) { if (only && s.id !== only) continue; if (s.on === false || !((s.lists || []).length || s.base)) { res.push({ id: s.id, off: true }); continue; } res.push(await runSource(s, ctx)); }
  ctx.q.items = ctx.q.items.slice(-3000); ctx.q.errors = ctx.errors.slice(-200); ctx.q.lastRun = new Date().toISOString(); ctx.q.results = res;
  fs.writeFileSync(Q, JSON.stringify(ctx.q)); fs.writeFileSync(SRC, JSON.stringify(conf, null, 1));
  console.log(JSON.stringify(res));
})();
