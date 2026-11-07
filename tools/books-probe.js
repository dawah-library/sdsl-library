// استكشاف مصادر الكتب النصية (تراث، والمكتبة الشاملة، وجامع الكتب الإسلامية) — يعمل على خوادم GitHub
// لأن جلسات التطوير محجوبة عن هذه المواقع. لا يجلب كتبًا: صفحات قليلة لكل موقع لمعرفة بنيته (الواجهات البرمجية،
// وبيانات الطبعة، وترقيم المطبوع، والحواشي، والعناوين، وروابط المصورات، وملف robots) حتى تُبنى أدوات الاستيراد عليها.
// الناتج: tools/books-probe/report.md وعينات مختصرة tools/books-probe/*.txt
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "books-probe"); fs.mkdirSync(OUT, { recursive: true });
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept": "text/html,application/json,*/*;q=0.8", "accept-language": "ar,en;q=0.8" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u, opt = {}) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 30000); try { const r = await fetch(u, { headers: { ...UA, ...(opt.h || {}) }, redirect: "follow", signal: ac.signal }); const b = await r.text(); await sleep(800); return { s: r.status, u: r.url, ct: r.headers.get("content-type") || "", b }; } catch (e) { return { s: 0, e: e.message, b: "" }; } finally { clearTimeout(t); } }
const rep = ["# استكشاف مصادر الكتب النصية — " + new Date().toISOString().slice(0, 16).replace("T", " "), ""];
const save = (name, txt) => fs.writeFileSync(path.join(OUT, name), String(txt).slice(0, 40000));
const keysOf = (o, d = 0) => { if (d > 3 || o === null || typeof o !== "object") return typeof o; if (Array.isArray(o)) return o.length ? [keysOf(o[0], d + 1), "×" + o.length] : []; const r = {}; for (const k of Object.keys(o).slice(0, 60)) r[k] = keysOf(o[k], d + 1); return r; };
async function probe(label, u, opt = {}) {
  const r = await get(u, opt); let line = `- ${label}: \`${u}\` ← ${r.s || "تعذر " + r.e} ${r.ct.split(";")[0]} ${r.b.length} حرفًا${r.u && r.u !== u ? " ← " + r.u : ""}`;
  if (/json/.test(r.ct) || /^\s*[\[{]/.test(r.b)) { try { const j = JSON.parse(r.b); line += "\n  - البنية: `" + JSON.stringify(keysOf(j)).slice(0, 1500) + "`"; r.j = j; } catch (e) { } }
  rep.push(line); if (opt.save) save(opt.save, r.b); return r;
}
// روابط الواجهات البرمجية المذكورة في ملفات السكربت (لمعرفة نقاط الاتصال الخفية)
async function endpoints(label, html, base) {
  const js = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], base).href))].slice(0, 25), hits = new Set();
  for (const s of js) { const r = await get(s); for (const m of r.b.matchAll(/["'`]((?:https?:\/\/[a-z0-9.-]+)?\/(?:api|v\d|ajax|search|book|books|page|pages|author|reader|read|pdf|toc|index|content)[^"'`\s]{0,80})["'`]/gi)) hits.add(m[1]); }
  rep.push(`- ${label}: ${js.length} ملف سكربت، ونقاط اتصال مذكورة فيها (${hits.size}):`, "  - " + [...hits].slice(0, 120).join(" ، "));
}
const textSample = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500);
const classes = h => { const c = {}; for (const m of h.matchAll(/class=["']([^"']+)["']/g)) m[1].split(/\s+/).forEach(x => c[x] = (c[x] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => k + ":" + v).join(" "); };
(async () => {
  // ---------- تراث (turath.io) ----------
  rep.push("## تراث (turath.io)");
  for (const u of ["https://turath.io/robots.txt", "https://app.turath.io/robots.txt"]) { const r = await probe("robots", u); rep.push("```\n" + r.b.slice(0, 600) + "\n```"); }
  const tb = await probe("بيانات كتاب (البخاري ت البغا)", "https://api.turath.io/book?id=735&include=indexes", { save: "turath-book.json" });
  if (tb.j && tb.j.meta) rep.push("  - meta: `" + JSON.stringify(tb.j.meta).slice(0, 2500) + "`");
  if (tb.j && tb.j.indexes) rep.push("  - indexes (مقتطف): `" + JSON.stringify(tb.j.indexes).slice(0, 1500) + "`");
  const tp = await probe("صفحة", "https://api.turath.io/page?book_id=735&pg=20", { save: "turath-page.json" });
  if (tp.j) rep.push("  - الصفحة: `" + JSON.stringify(tp.j).slice(0, 2500) + "`");
  for (const [l, u] of [["بحث في الكتب", "https://api.turath.io/search?q=%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9&ver=3"], ["بحث بالعنوان", "https://api.turath.io/books?q=%D8%A7%D9%84%D9%85%D8%BA%D9%86%D9%8A"], ["مؤلف", "https://api.turath.io/author?id=1"], ["فئات", "https://api.turath.io/categories"], ["قائمة الكتب", "https://files.turath.io/data.json"], ["ملف كتاب كامل", "https://files.turath.io/books/735.json"], ["ملف كتاب v3", "https://files.turath.io/books-v3/735.json"]]) { const r = await probe(l, u, { save: "turath-" + l.replace(/\s+/g, "_") + ".txt" }); if (r.j) rep.push("  - مقتطف: `" + JSON.stringify(r.j).slice(0, 1200) + "`"); }
  const th = await probe("الواجهة", "https://app.turath.io/", { save: "turath-home.html" }); if (th.b) await endpoints("سكربتات تراث", th.b, th.u || "https://app.turath.io/");
  const tbp = await probe("صفحة كتاب في الواجهة", "https://app.turath.io/book/735", { save: "turath-bookpage.html" }); if (tbp.b) rep.push("  - النص الظاهر: " + textSample(tbp.b).slice(0, 800));
  // ---------- المكتبة الشاملة (shamela.ws) ----------
  rep.push("", "## المكتبة الشاملة (shamela.ws)");
  { const r = await probe("robots", "https://shamela.ws/robots.txt"); rep.push("```\n" + r.b.slice(0, 900) + "\n```"); }
  const sh = await probe("الرئيسة", "https://shamela.ws/", { save: "shamela-home.html" });
  if (sh.b) { await endpoints("سكربتات الشاملة", sh.b, "https://shamela.ws/"); rep.push("  - الأصناف (classes): " + classes(sh.b)); }
  const sb = await probe("بطاقة كتاب", "https://shamela.ws/book/1681", { save: "shamela-book.html" });
  if (sb.b) { rep.push("  - النص الظاهر: " + textSample(sb.b)); rep.push("  - الأصناف: " + classes(sb.b)); rep.push("  - روابط pdf/archive: " + [...new Set([...sb.b.matchAll(/href=["']([^"']*(?:pdf|archive\.org|waqfeya|download)[^"']*)["']/gi)].map(m => m[1]))].slice(0, 20).join(" ، ")); }
  const sp = await probe("صفحة من الكتاب", "https://shamela.ws/book/1681/20", { save: "shamela-page.html" });
  if (sp.b) { rep.push("  - النص الظاهر: " + textSample(sp.b)); rep.push("  - الأصناف: " + classes(sp.b)); rep.push("  - عينة HTML للنص: ```" + (sp.b.match(/<div[^>]+class=["'][^"']*nass[^"']*["'][\s\S]{0,2500}/i) || [sp.b.slice(sp.b.length / 3, sp.b.length / 3 + 2500)])[0].replace(/`/g, "'") + "```"); }
  for (const [l, u] of [["بحث", "https://shamela.ws/search?q=%D8%A7%D9%84%D9%86%D9%8A%D8%A9"], ["مؤلف", "https://shamela.ws/author/256"], ["قسم", "https://shamela.ws/category/6"], ["خريطة", "https://shamela.ws/sitemap.xml"], ["تنزيل الكتاب", "https://shamela.ws/book/1681/download"], ["واجهة json", "https://shamela.ws/api/book/1681"]]) { const r = await probe(l, u, { save: "shamela-" + l.replace(/\s+/g, "_") + ".txt" }); if (r.b && !r.j) rep.push("  - " + textSample(r.b).slice(0, 500)); }
  // ---------- جامع الكتب الإسلامية (ketabonline.com) ----------
  rep.push("", "## جامع الكتب الإسلامية (ketabonline.com)");
  { const r = await probe("robots", "https://ketabonline.com/robots.txt"); rep.push("```\n" + r.b.slice(0, 900) + "\n```"); }
  const kh = await probe("الرئيسة", "https://ketabonline.com/ar", { save: "ketab-home.html" });
  if (kh.b) { await endpoints("سكربتات جامع الكتب", kh.b, kh.u || "https://ketabonline.com/ar"); rep.push("  - النص الظاهر: " + textSample(kh.b).slice(0, 600)); const nd = kh.b.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (nd) { save("ketab-nextdata.json", nd[1]); try { rep.push("  - __NEXT_DATA__: `" + JSON.stringify(keysOf(JSON.parse(nd[1]))).slice(0, 1500) + "`"); } catch (e) { } } }
  const kl = [...new Set([...(kh.b || "").matchAll(/href=["'](\/ar\/books?\/[^"'#?]+)["']/g)].map(m => m[1]))].slice(0, 5); rep.push("  - روابط كتب من الرئيسة: " + kl.join(" ، "));
  for (const [l, u] of [["كتاب", kl[0] ? "https://ketabonline.com" + kl[0] : "https://ketabonline.com/ar/books/1"], ["قراءة", "https://ketabonline.com/ar/books/1/read?part=1&page=10"], ["خريطة", "https://ketabonline.com/sitemap.xml"], ["واجهة", "https://backend.ketabonline.com/api/v2/books/1"], ["واجهة٢", "https://ketabonline.com/api/books/1"]]) { const r = await probe(l, u, { save: "ketab-" + l + ".txt" }); if (r.b && !r.j) { rep.push("  - " + textSample(r.b).slice(0, 700)); rep.push("  - الأصناف: " + classes(r.b).slice(0, 800)); const nd = r.b.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (nd) { save("ketab-" + l + "-nextdata.json", nd[1]); try { rep.push("  - __NEXT_DATA__: `" + JSON.stringify(keysOf(JSON.parse(nd[1]))).slice(0, 2500) + "`"); } catch (e) { } } } }
  fs.writeFileSync(path.join(OUT, "report.md"), rep.join("\n") + "\n");
  console.log(rep.join("\n").slice(0, 3000));
})();
