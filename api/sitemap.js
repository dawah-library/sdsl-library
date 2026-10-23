// خريطة الموقع لمحركات البحث (/sitemap.xml) وملف robots.txt
const fs = require("fs"), path = require("path");
const read = p => JSON.parse(fs.readFileSync(path.join(process.cwd(), p), "utf8"));
const x = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
module.exports = (req, res) => {
  const base = (process.env.SITE_URL || "https://dawahlibrary.org").replace(/\/$/, "") + "/";
  res.setHeader("cache-control", "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400");
  if (/robots=1/.test(req.url || "")) {
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.status(200).end(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /account\nDisallow: /favs\n\nSitemap: ${base}sitemap.xml\n`);
  }
  const cat = read("data/catalog.json"); let arts = [], posts = [];
  try { arts = read("data/articles/index.json").items || []; } catch (e) { }
  try { posts = read("data/posts.json").items || []; } catch (e) { }
  const urls = [];
  const add = (p, d, pr) => urls.push(`<url><loc>${x(base + p)}</loc>${d ? `<lastmod>${x(String(d).slice(0, 10))}</lastmod>` : ""}${pr ? `<priority>${pr}</priority>` : ""}</url>`);
  add("", null, "1.0");
  ["library?c=dawah", "library?c=turath", "articles", "fatawa", "bayanat", "furqan", "tafrighat", "posts", "authors", "tarajim", "about", "dawah", "history", "contact", "ask"].forEach(p => add(p, null, "0.8"));
  cat.books.filter(b => !b.demo).forEach(b => add("book/" + b.id + "/1", b.added, b.col === "dawah" ? "0.9" : "0.7"));
  arts.forEach(a => add("book/" + a.id + "/1", a.d, "0.6"));
  cat.authors.forEach(a => add("author/" + a.id, null, "0.6"));
  posts.filter(p => !p.demo).forEach(p => add("post/" + p.id, p.date, "0.4"));
  res.setHeader("content-type", "application/xml; charset=utf-8");
  res.status(200).end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
};
