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
const UA = { "user-agent": "Mozilla/5.0 (SDSL library importer; +https://dawahlibrary.org)", "accept-language": "ar" };
async function get(u) { const r = await fetch(u, { headers: UA, redirect: "follow" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); }
const shingles = s => { const w = norm(s).split(" "), o = new Set(); for (let i = 0; i + 3 <= w.length; i++) o.add(w.slice(i, i + 3).join(" ")); return o; };
const jacc = (a, b) => { let c = 0; b.forEach(x => a.has(x) && c++); return c / Math.max(1, a.size + b.size - c); };

// النص الرئيس للصفحة: أكثف كتلة فقرات عربية (بلا قوائم الروابط والقوائم الجانبية)
function mainText(html, sel) {
  let h = html.replace(/<(script|style|nav|footer|aside|noscript)[\s\S]*?<\/\1>/gi, " ");
  if (sel) { const m = h.match(new RegExp(sel, "i")); if (m) h = m[1] || m[0]; }
  const blocks = [];
  h.split(/<\/(?:div|section|article|td)>/i).forEach(b => {
    const links = (b.match(/<a\b/gi) || []).length, paras = b.split(/<\/p>|<br\s*\/?>|\n/i).map(x => decode(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()).filter(x => (x.match(/[ء-ي]/g) || []).length > 25);
    const len = paras.join(" ").length; if (len > 300 && links < len / 120) blocks.push({ len, paras });
  });
  blocks.sort((a, b) => b.len - a.len);
  return blocks.length ? blocks[0].paras.join("\n") : "";
}
function meta(html, prop) { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i")); return m ? decode(m[1]).trim() : ""; }

async function runSource(s, ctx) {
  const st = s.state || (s.state = {}), log = []; const L = m => { log.push(m); console.log(`[${s.id}] ${m}`); };
  const seen = new Set(st.seen || []); let added = 0, skipped = 0, errs = 0;
  const links = [];
  for (const lp of s.lists || []) {
    try { const h = await get(lp); const rx = new RegExp(s.linkRx, "g"); let m; while ((m = rx.exec(h))) { const u = decode(m[0].startsWith("http") ? m[0] : new URL(m[0], lp).href); if (!links.includes(u)) links.push(u); } }
    catch (e) { errs++; L(`تعذرت قائمة ${lp}: ${e.message}`); ctx.errors.push({ src: s.id, url: lp, err: e.message }); }
    await sleep(s.delayMs || 1500);
  }
  L(`روابط: ${links.length}`);
  for (const u of links.slice(0, s.perRun || 40)) {
    const key = (u.match(/\d{3,}/) || [u])[0]; if (seen.has(key)) continue;
    try {
      const html = await get(u); await sleep(s.delayMs || 1500);
      let title = meta(html, "og:title") || decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""); title = title.replace(new RegExp("\\s*[-|–]\\s*" + (s.siteSuffix || "$^") + ".*$"), "").trim();
      let author = ""; const am = title.match(/[.،]\s*(?:د\/|الشيخ\/|م\/|أ\/|د\.|الشيخ)\s*([^.()]+)$/); if (am) { author = am[1].trim(); title = title.slice(0, am.index).trim(); }
      const text = mainText(html, s.contentRx), date = (meta(html, "article:published_time") || (html.match(/\b(20\d\d-\d\d-\d\d)/) || [])[1] || "").slice(0, 10);
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
  for (const s of conf.sources) { if (only && s.id !== only) continue; if (s.on === false || !(s.lists || []).length) { res.push({ id: s.id, off: true }); continue; } res.push(await runSource(s, ctx)); }
  ctx.q.items = ctx.q.items.slice(-3000); ctx.q.errors = ctx.errors.slice(-200); ctx.q.lastRun = new Date().toISOString(); ctx.q.results = res;
  fs.writeFileSync(Q, JSON.stringify(ctx.q)); fs.writeFileSync(SRC, JSON.stringify(conf, null, 1));
  console.log(JSON.stringify(res));
})();
