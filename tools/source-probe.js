// استكشاف المصادر (يعمل على خوادم GitHub لأن جلسات التطوير محجوبة عن هذه المواقع):
// لكل موقع: حالة الصفحة الرئيسة، وخلاصات RSS، وخريطة الموقع، وwp-json، وأقسام المقالات المحتملة وأنماط روابطها، وعينة روابط.
// الناتج tools/sources-probe.md لتُضبط به data/sources.json. الاستخدام: node tools/source-probe.js [رابط…]
const fs = require("fs"), path = require("path");
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "ar,en;q=0.8" };
const SITES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "https://fath-news.com", "https://www.fath-news.com", "https://alnourpartyeg.com", "https://www.alnourparty.org",
  "https://salafcenter.org", "https://www.al-forqan.net", "https://alforqanmag.com", "https://usus.org.sa", "https://ususacademy.com", "https://jusoor.co", "https://anasalafy.com/ar"];
const dec = s => String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n));
async function get(u) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 30000); try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: ac.signal }); const b = await r.text(); return { s: r.status, u: r.url, b }; } catch (e) { return { s: 0, e: e.message }; } finally { clearTimeout(t); } }
(async () => {
  const out = ["# استكشاف المصادر — " + new Date().toISOString().slice(0, 16).replace("T", " "), ""], js = {};
  for (const site of SITES) {
    const r = await get(site), rec = { site, status: r.s, final: r.u, err: r.e };
    out.push(`## ${site}`, `- الحالة: ${r.s || "تعذر (" + r.e + ")"}${r.u && r.u !== site ? " ← " + r.u : ""}`);
    if (r.s === 200) {
      const base = new URL(r.u).origin, title = (r.b.match(/<title[^>]*>([^<]*)/i) || [])[1];
      out.push(`- العنوان: ${dec(title || "").trim()}`);
      const feeds = [...r.b.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)].map(m => (m[0].match(/href=["']([^"']+)/) || [])[1]).filter(Boolean);
      for (const f of ["/feed", "/rss", "/rss.xml", "/feed.xml", "/ar/feed"]) { const x = await get(base + f); if (x.s === 200 && /<(rss|feed)\b/i.test(x.b)) feeds.push(base + f + ` (${(x.b.match(/<item\b|<entry\b/gi) || []).length} عنصر)`); }
      const wp = await get(base + "/wp-json/wp/v2/posts?per_page=3&_fields=link,title,categories"); if (wp.s === 200 && wp.b.trim().startsWith("[")) { out.push(`- wp-json: متاح — ${wp.b.slice(0, 300).replace(/\n/g, " ")}`); const cats = await get(base + "/wp-json/wp/v2/categories?per_page=100&_fields=id,name,count,link"); if (cats.s === 200) { try { rec.cats = JSON.parse(cats.b); out.push("- تصنيفات wp: " + rec.cats.map(c => `${dec(c.name)} (${c.id}، ${c.count})`).join("، ")); } catch (e) { } } }
      const sm = await get(base + "/sitemap.xml"); if (sm.s === 200 && /<(urlset|sitemapindex)/i.test(sm.b)) out.push(`- sitemap.xml: متاح (${(sm.b.match(/<loc>/g) || []).length} رابط) — ${[...sm.b.matchAll(/<loc>([^<]+)/g)].slice(0, 4).map(m => m[1]).join(" ، ")}`);
      out.push(`- خلاصات: ${[...new Set(feeds)].join(" ، ") || "لا توجد"}`);
      const links = [...new Set([...r.b.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => { try { return new URL(dec(m[1]), base).href + " | " + dec(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 50); } catch (e) { return ""; } }).filter(x => x.startsWith(base)))];
      const sec = links.filter(l => /مقال|رأي|كتاب|دراس|بحث|بحوث|فتاو|article|opinion|research|stud|categor|section|writers|blog/i.test(l)).slice(0, 25);
      out.push("- أقسام محتملة:", ...sec.map(l => "  - " + l));
      const pat = {}; links.forEach(l => { const p = l.split(" | ")[0].replace(base, "").replace(/\d{3,}/g, "N").replace(/\/[^/]*[؀-ۿ%][^/]*$/, "/SLUG").replace(/\?.*$/, "?…"); pat[p] = (pat[p] || 0) + 1; });
      out.push("- أنماط الروابط الأكثر:", ...Object.entries(pat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, n]) => `  - ${p} (${n})`));
      out.push("- عينة روابط:", ...links.filter(l => /\d{3,}/.test(l)).slice(0, 8).map(l => "  - " + l));
      rec.feeds = feeds; rec.sections = sec;
    }
    out.push(""); js[site] = rec;
  }
  fs.writeFileSync(path.join(__dirname, "sources-probe.md"), out.join("\n"));
  fs.writeFileSync(path.join(__dirname, "sources-probe.json"), JSON.stringify(js, null, 1));
  console.log(out.join("\n"));
})();
