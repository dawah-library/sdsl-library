// استكشاف بنية المصادر الجديدة (أنا السلفي، بوابة الفتح): يحفظ عينات HTML والخرائط في tools/samples/src لضبط مستخرج النصوص
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "samples", "src"); fs.mkdirSync(OUT, { recursive: true });
const UA = { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", "accept-language": "ar,en;q=0.8" };
const get = async u => { try { const r = await fetch(u, { headers: UA, redirect: "follow" }); const t = await r.text(); return { s: r.status, u: r.url, t }; } catch (e) { return { s: 0, u, t: String(e) }; } };
const save = (n, x) => fs.writeFileSync(path.join(OUT, n), x);
(async () => {
  const sites = { anasalafy: "https://anasalafy.com", fath: "https://fath-news.com" };
  const rep = [];
  for (const [k, base] of Object.entries(sites)) {
    for (const p of ["/", "/robots.txt", "/sitemap.xml", "/sitemap_index.xml", "/feed", "/rss", "/ar", "/ar/category/articles", "/ar/category/%D8%AF%D8%B1%D9%88%D8%B3-%D9%85%D9%81%D8%B1%D8%BA%D8%A9"]) {
      const r = await get(base + p); rep.push(`${k} ${p} → ${r.s} ${r.u} (${r.t.length})`);
      if (r.s === 200) save(`${k}${p.replace(/[^\w]+/g, "_") || "_root"}.txt`, r.t.slice(0, 400000));
    }
    // روابط مقالات من الرئيسية
    const home = (await get(base + (k === "anasalafy" ? "/ar" : "/"))).t;
    const links = [...new Set([...home.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]))];
    save(`${k}_links.txt`, links.join("\n"));
    const arts = links.filter(l => /\/\d{3,}/.test(l)).slice(0, 4);
    for (const [i, l] of arts.entries()) { const u = l.startsWith("http") ? l : base + (l.startsWith("/") ? "" : "/") + l; const r = await get(u); rep.push(`${k} art ${u} → ${r.s} (${r.t.length})`); if (r.s === 200) save(`${k}_art${i}.html`, r.t); }
  }
  save("report.txt", rep.join("\n")); console.log(rep.join("\n"));
})();
