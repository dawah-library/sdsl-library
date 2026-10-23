// دالة خادم Vercel: جلب مقال من موقع صوت السلف واستخراج عنوانه وكاتبه وتاريخه وقسمه ونصه.
// تُستدعى من صفحة الإدارة: api/import?url=https://salafvoice.com/article.aspx?a=25748
// تقبل روابط المواقع المسموح بها فقط.
const ALLOWED = ["salafvoice.com", "www.salafvoice.com", "anasalafy.com", "www.anasalafy.com"];
const MONTHS = { "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "مايو": 5, "يونيو": 6, "يوليو": 7, "أغسطس": 8, "اغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12 };
const KNOWN = ["ياسر برهامي", "محمد إسماعيل المقدم", "أحمد حطيبة", "أحمد فريد", "سعيد عبد العظيم", "سعيد عبدالعظيم", "عبد المنعم الشحات", "عبدالمنعم الشحات", "السيد حسين العفاني", "سعيد محمود", "علاء بكر", "صوت السلف"];

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…", rlm: "", lrm: "", zwnj: "‌", zwj: "‍", ndash: "–", mdash: "—" };
const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const textOf = h => decode(h.replace(/<[^>]+>/g, " ")).replace(/[ \t ]+/g, " ").trim();
const arabic = s => (s.match(/[ء-ي]/g) || []).length;

// صفحات صوت السلف لها حقول ثابتة: العنوان والتاريخ ومسار القسم وجسم المقال
function extractSalafvoice(html, url) {
  const grab = id => { const m = html.match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</span>', "i")); return m ? textOf(m[1]) : ""; };
  const title = grab("ContentPlaceHolder1_lblTitle");
  const dateTxt = grab("ContentPlaceHolder1_lblDate");
  const bc = (html.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/i) || [])[1] || "";
  const crumbs = [...bc.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(m => textOf(m[1])).filter(t => t && t !== "الرئيسية");
  const i = html.indexOf('id="FatwaA"'); if (i < 0 || !title) return null;
  let j = html.indexOf('id="FatwaF"', i); if (j < 0) j = html.indexOf('class="panel panel-success"', i + 50); if (j < 0) j = i + 200000;
  const body = html.slice(i, j).replace(/^[^>]*>/, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ");
  let lines = body.split(/<\/?(?:p|div|br|h[1-6]|li|tr|blockquote)[^>]*>/i).map(textOf).filter(l => l && arabic(l) + (l.match(/\d/g) || []).length > 0);
  let author = "";
  for (let k = 0; k < Math.min(lines.length, 4); k++) {
    const m = lines[k].match(/^(?:كتبه|بقلم|كتبته|إعداد|اعداد)\s*[\/:：]?\s*(.{3,60})$/);
    if (m) { author = m[1]; lines.splice(k, 1); break; }
  }
  for (let k = lines.length - 1; k >= Math.max(0, lines.length - 3) && !author; k--) {
    const m = lines[k].match(/^(?:كتبه|بقلم|كتبته)\s*[\/:：]?\s*(.{3,60})$/); if (m) { author = m[1]; lines.splice(k, 1); }
  }
  author = author.replace(/^\s*[\/:：]\s*/, "").replace(/^(الشيخ|الدكتور|د[.\/]|م[.\/]|أ[.\/])\s*/, "").replace(/\s*[-–(]?\s*(حفظه الله|رحمه الله)\s*[-–)]?\s*\.?$/, "").trim();
  if (author && arabic(author) < 4) author = "";
  while (lines.length && /^(صوت السلف|www\.salafvoice\.com)$/.test(lines[lines.length - 1])) lines.pop();
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  let date = "";
  const dm = dateTxt.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (dm && MONTHS[dm[2]]) date = `${dm[3]}-${String(MONTHS[dm[2]]).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  return { url, title: title.replace(/\s+/g, " "), author: author || "صوت السلف", date, category: crumbs.join(" › "), text, structured: true };
}

function extract(html, url) {
  if (html.includes("ContentPlaceHolder1_lblTitle")) { const r = extractSalafvoice(html, url); if (r && r.text.length > 0) return r; }
  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript|svg|iframe|select|button)\b[\s\S]*?<\/\1>/gi, " ");
  const og = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
  const tt = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const hs = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m => m[1]);
  const cand = [og, ...hs, tt].filter(Boolean).map(textOf).map(t => t.replace(/\s*[-|–]\s*(صوت السلف|موقع أنا السلفي|أنا السلفي).*$/, "").replace(/^(صوت السلف|أنا السلفي)\s*[-|–]\s*/, "").trim())
    .filter(t => arabic(t) >= 4 && !/^(صوت السلف|أنا السلفي|الرئيسية)$/.test(t));
  let title = (cand[0] || "").replace(/\s*[-|–]\s*(صوت السلف|موقع أنا السلفي|أنا السلفي).*$/, "").replace(/^(صوت السلف|أنا السلفي)\s*[-|–]\s*/, "").trim();

  // الكتل النصية: نقسم عند وسوم الكتل
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  const blocks = body.split(/<\/?(?:p|div|br|h[1-6]|li|td|tr|section|article|blockquote|span class="[^"]*(?:title|head)[^"]*")[^>]*>/i)
    .map(textOf).filter(Boolean);

  // أطول سلسلة متصلة من الكتل العربية الطويلة (نص المقال)
  let best = [0, -1, 0], cur = [0, -1, 0], gap = 0;
  blocks.forEach((b, i) => {
    const good = arabic(b) >= 25 && b.length >= 40;
    if (good) { if (cur[1] < 0) cur = [i, i, 0]; cur[1] = i; cur[2] += b.length; gap = 0; }
    else if (cur[1] >= 0 && ++gap > 3) { if (cur[2] > best[2]) best = cur; cur = [0, -1, 0]; gap = 0; }
  });
  if (cur[2] > best[2]) best = cur;
  let lines = best[1] >= 0 ? blocks.slice(best[0], best[1] + 1) : [];
  // إزالة السطور المكررة وسطور الواجهة
  const seen = new Set();
  lines = lines.filter(l => { const k = l.slice(0, 80); if (seen.has(k)) return false; seen.add(k); return !/^(شارك|مشاركة|طباعة|أرسل لصديق|تعليقات|اقرأ أيضا|المزيد|كتبه|بقلم)/.test(l) && l !== title; });
  const DATE_LINE = /^(السبت|الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة)?\s*\d{1,2}\s+\S+\s+\d{4}/;
  let text = lines.join("\n").replace(/\\r\\n|\\n|\r\n/g, "\n");
  // يقطع ما بعد نهاية المقال: روابط الموقع وقوائم المقالات الأخرى
  const cut = text.search(/www\.salafvoice\.com|salafvoice\.com|موقع أنا السلفي|\n\s*\d{4}-\d{2}-\d{2}\b/);
  if (cut > 200) text = text.slice(0, cut);
  let tl = text.split("\n").map(l => l.trim()).filter(Boolean);
  const okTitle = l => l && arabic(l) >= 4 && l.length < 110 && !/[.،؛:]\s*$/.test(l) && !(DATE_LINE.test(l) || /هـ\s*$/.test(l)) && !/^(صوت السلف|الرئيسية|المقالات)$/.test(l) && !/^(كتبه|بقلم|الكاتب|المؤلف)/.test(l);
  if (!title) title = tl.slice(0, 3).find(okTitle) || blocks.slice(Math.max(0, best[0] - 4), best[0]).reverse().find(okTitle) || "";
  const isDate = l => (DATE_LINE.test(l) || /هـ\s*$/.test(l)) && l.length < 90;
  while (tl.length && (tl[0] === title || isDate(tl[0]))) tl.shift();
  while (tl.length && (/^(صوت السلف|موقع أنا السلفي|أنا السلفي)$/.test(tl[tl.length - 1]) || arabic(tl[tl.length - 1]) < 3)) tl.pop();
  text = tl.join("\n").trim();

  // الكاتب والتاريخ والقسم من رأس الصفحة (قبل النص)
  const headText = blocks.slice(Math.max(0, best[0] - 25), best[0] + 1).join(" \n ");
  const all = blocks.join(" \n ");
  let author = (headText.match(/(?:كتبه|بقلم|الكاتب|المؤلف)\s*[:：\/]?\s*([^\n|،]{4,40})/) || [])[1] || "";
  author = author.replace(/\s*(السبت|الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|\d).*$/, "").trim();
  const kn = KNOWN.find(n => author.includes(n)); if (kn) author = kn;
  if (!author) author = KNOWN.find(n => headText.includes(n)) || KNOWN.find(n => all.slice(0, 4000).includes(n)) || "";
  author = author.replace(/^\s*[\/:：]\s*/, "").replace(/^(الشيخ|الدكتور|د[.\/]|م[.\/]|أ[.\/])\s*/, "").trim();
  let date = "";
  const dm = all.match(/(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/);
  if (dm) date = `${dm[3]}-${String(MONTHS[dm[2]]).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  else { const im = all.match(/(20\d\d)[-/](\d{1,2})[-/](\d{1,2})/); if (im) date = `${im[1]}-${im[2].padStart(2, "0")}-${im[3].padStart(2, "0")}`; }
  const cm = headText.match(/([^\n›»]{2,30})\s*[›»]\s*([^\n›»]{2,30})(?=\s|$)/);
  const category = cm && arabic(cm[1]) >= 3 && arabic(cm[2]) >= 3 && !/الرئيسية/.test(cm[2]) ? (cm[1].trim() + " › " + cm[2].trim()) : "";
  return { url, title, author, date, category, text };
}

async function handler(req, res) {
  const who = await require("../lib/auth").userOf(req);  // جلب صفحات من مواقع خارجية: للمشرفين فقط
  if (!who || !/^(admin|editor)$/.test(who.role)) return res.status(403).json({ error: "للمشرفين فقط" });
  let u;
  try { u = new URL(String((req.query && req.query.url) || "")); } catch (e) { return res.status(400).json({ error: "رابط غير صالح" }); }
  if (!/^https?:$/.test(u.protocol) || !ALLOWED.includes(u.hostname)) return res.status(400).json({ error: "هذا الموقع غير مسموح بالاستيراد منه" });
  try {
    let r, url = u.href;
    for (let hop = 0; hop < 4; hop++) {  // اتباع التحويلات داخل المواقع المسموح بها فقط (منع SSRF)
      r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (SDSL importer)", "accept-language": "ar" }, redirect: "manual" });
      if (r.status < 300 || r.status >= 400) break;
      const nx = new URL(r.headers.get("location") || "", url);
      if (!/^https?:$/.test(nx.protocol) || !ALLOWED.includes(nx.hostname)) return res.status(400).json({ error: "تحويل إلى موقع غير مسموح" });
      url = nx.href;
    }
    if (!r.ok) return res.status(502).json({ error: "رد الموقع برمز " + r.status });
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "";
    let cs = (ct.match(/charset=([\w-]+)/i) || [])[1];
    let html = new TextDecoder(cs || "utf-8").decode(buf);
    const meta = (html.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
    if (!cs && meta && !/utf-?8/i.test(meta)) html = new TextDecoder(meta).decode(buf);
    const out = extract(html, u.href);
    if (!out.text || out.text.length < 200) return res.status(422).json({ error: "لم أتمكن من استخراج نص المقال من هذه الصفحة", partial: out });
    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "تعذر جلب الصفحة" });
  }
}
module.exports = handler;
module.exports.extract = extract;
