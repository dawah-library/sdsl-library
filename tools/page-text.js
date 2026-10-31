// جلب نص صفحة ويب (على خوادم GitHub، لأن جلسات التطوير محجوبة عن بعض المواقع) وحفظه في tools/pages/<الاسم>.txt للقراءة والاقتباس.
// الاستخدام: node tools/page-text.js <الرابط> <الاسم>
const fs = require("fs"), path = require("path");
const [url, name] = process.argv.slice(2);
const decode = s => String(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">");
(async () => {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept-language": "ar" } });
  const html = await r.text(); let h = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style|nav|footer|aside|noscript)[\s\S]*?<\/\1>/gi, " ");
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  const blocks = []; h.split(/<\/(?:div|section|article|td)>/i).forEach(b => { const links = (b.match(/<a\b/gi) || []).length, ps = b.split(/<\/p>|<br\s*\/?>|<\/h\d>|<\/li>|\n/i).map(x => decode(x.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()).filter(x => (x.match(/[ء-ي]/g) || []).length > 10); const len = ps.join(" ").length; if (len > 300 && links < len / 120) blocks.push({ len, ps }); });
  blocks.sort((a, b) => b.len - a.len);
  const out = "العنوان: " + title + "\nالرابط: " + url + "\nالحالة: " + r.status + "\n\n" + (blocks[0] ? blocks[0].ps.join("\n") : "(لم يُستخرج نص)");
  fs.mkdirSync(path.join(__dirname, "pages"), { recursive: true }); fs.writeFileSync(path.join(__dirname, "pages", (name || "page") + ".txt"), out); console.log(out.slice(0, 3000));
})();
