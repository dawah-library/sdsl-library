// الجولة الثانية لاستكشاف مصادر الكتب (بعد tools/books-probe.js): تفاصيل تكفي لبناء أدوات الاستيراد.
// ١) تراث: بنية ملف الكتاب الكامل books-v3 (مفاتيحه حروف حركات مموّهة) وروابط المصورات pdf_links.
// ٢) جامع الكتب الإسلامية: نقاط قراءة الصفحات في backend.ketabonline.com/api/v2، والطبعات (copies)، وملفات pdf للأجزاء.
// الناتج: tools/books-probe/report2.md
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "books-probe");
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept": "application/json,text/html,*/*;q=0.8", "accept-language": "ar" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u, opt = {}) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 60000); try { const r = await fetch(u, { method: opt.m || "GET", headers: { ...UA, ...(opt.h || {}) }, redirect: "follow", signal: ac.signal }); const b = opt.m === "HEAD" ? "" : await r.text(); await sleep(700); return { s: r.status, u: r.url, ct: r.headers.get("content-type") || "", len: r.headers.get("content-length"), b }; } catch (e) { return { s: 0, e: e.message, b: "" }; } finally { clearTimeout(t); } }
const rep = ["# استكشاف مصادر الكتب — الجولة الثانية — " + new Date().toISOString().slice(0, 16).replace("T", " "), ""];
const keysOf = (o, d = 0) => { if (d > 3 || o === null || typeof o !== "object") return typeof o; if (Array.isArray(o)) return o.length ? [keysOf(o[0], d + 1), "×" + o.length] : []; const r = {}; for (const k of Object.keys(o).slice(0, 40)) r[k] = keysOf(o[k], d + 1); return r; };
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
(async () => {
  rep.push("## تراث: ملف الكتاب الكامل books-v3");
  for (const id of [735, 11430]) {
    const r = await get(`https://files.turath.io/books-v3/${id}.json`), j = J(r.b);
    rep.push(`### الكتاب ${id}: ${r.s} ${r.b.length} حرفًا`);
    if (j) for (const [k, v] of Object.entries(j)) {
      rep.push(`- المفتاح «${k}» (U+${k.codePointAt(0).toString(16)}): ` + "`" + JSON.stringify(keysOf(v)).slice(0, 900) + "`");
      if (Array.isArray(v) && v.length > 20) rep.push("  - العنصر ٢٠: `" + JSON.stringify(v[20]).slice(0, 1500) + "`", "  - العنصر ٢١: `" + JSON.stringify(v[21]).slice(0, 800) + "`");
      else if (v && typeof v === "object") { const ks = Object.keys(v); for (const kk of ks) { const x = v[kk]; if (Array.isArray(x) && x.length > 20 && typeof x[0] !== "object") rep.push(`  - «${kk}» عينة: ` + "`" + JSON.stringify(x.slice(0, 12)).slice(0, 600) + "`"); else if (x && typeof x === "object" && !Array.isArray(x)) rep.push(`  - «${kk}» أول ٨: ` + "`" + JSON.stringify(Object.entries(x).slice(0, 8)).slice(0, 700) + "`"); } }
    }
  }
  // روابط المصورة: pdf_links.root + files (اسم|الجزء)
  rep.push("", "## تراث: المصورات (pdf_links)");
  const m = J((await get("https://api.turath.io/book?id=735")).b) || {}, pl = (m.meta || {}).pdf_links || {};
  rep.push("- pdf_links: `" + JSON.stringify(pl) + "`");
  for (const base of ["https://files.turath.io/pdf", "https://files.turath.io/pdfs", "https://pdf.turath.io", "https://archive.org/download"]) {
    const f = (pl.files || [""])[1] || (pl.files || [""])[0], name = String(f).split("|")[0], u = base + (pl.root || "/") + name;
    const r = await get(u, { m: "HEAD" }); rep.push(`- ${u} ← ${r.s} ${r.ct} ${r.len || ""}${r.u && r.u !== u ? " ← " + r.u : ""}`);
  }
  const app = await get("https://app.turath.io/"); const pdfRefs = [...new Set([...app.b.matchAll(/["'`]([^"'`\s]{0,60}(?:pdf|files\.turath)[^"'`\s]{0,80})["'`]/gi)].map(x => x[1]))].slice(0, 40);
  rep.push("- إشارات pdf في واجهة تراث: " + pdfRefs.join(" ، "));
  // كتاب للشيخ ابن عثيمين للتجربة (مطابقة المطبوع ورقم المجلد)
  const s = J((await get("https://api.turath.io/search?q=" + encodeURIComponent("الشرح الممتع") + "&ver=3")).b);
  if (s) rep.push("- بحث «الشرح الممتع»: " + (s.data || []).slice(0, 6).map(x => { const mm = J(x.meta) || {}; return x.book_id + " " + mm.book_name; }).join(" ، "));

  rep.push("", "## جامع الكتب الإسلامية: الواجهة البرمجية");
  const B = "https://backend.ketabonline.com/api/v2";
  const bk = J((await get(B + "/books/1")).b) || {}, d = bk.data || {};
  rep.push("- parts: `" + JSON.stringify(d.parts).slice(0, 800) + "`", "- index أول ٣: `" + JSON.stringify((d.index || []).slice(0, 3)).slice(0, 800) + "`", "- copies: `" + JSON.stringify(d.copies).slice(0, 400) + "`", "- print_status/content_status/type/is_free: " + [d.print_status, d.content_status, d.type, d.is_free, d.price].join(" / "));
  const pid = (d.parts && d.parts[0] && d.parts[0].page_id) || (d.index && d.index[0] && d.index[0].page_id) || 1;
  for (const u of [`/books/1/pages?page=1`, `/books/1/pages/1`, `/books/1/page/1`, `/pages/${pid}`, `/pages?book_id=1&page=1`, `/books/1/read?page=1`, `/books/1/parts/1/pages?page=1`, `/books/1/content?page=1`, `/books/1/pages?part=1&page=1&limit=3`, `/books?q=${encodeURIComponent("الشرح الممتع")}`, `/books?limit=3&sort=downloads`, `/categories`, `/authors?q=${encodeURIComponent("ابن عثيمين")}`, `/pages?limit=6&q=${encodeURIComponent("النية")}`]) {
    const r = await get(B + u), j = J(r.b); rep.push(`- \`${u}\` ← ${r.s} ${r.b.length}` + (j ? " `" + JSON.stringify(keysOf(j)).slice(0, 900) + "`" : ""));
    if (j && r.s === 200) rep.push("  - مقتطف: `" + r.b.slice(0, 900).replace(/`/g, "'") + "`");
  }
  // كتب لها مصورة وترقيم موافق للمطبوع
  const lst = J((await get(B + "/books?limit=20&sort=downloads")).b);
  const ids = ((lst && (lst.data || lst.books || [])) || []).map(x => x.id).filter(Boolean).slice(0, 8);
  for (const id of ids) { const x = (J((await get(B + "/books/" + id)).b) || {}).data || {}; rep.push(`- كتاب ${id}: ${x.title} | النوع ${x.type} | مجاني ${x.is_free} | الترقيم: ${((x.meta || []).find(m => m.name === "الترقيم") || {}).value || ""} | الطبعة: ${(x.bibliography || "").replace(/\s+/g, " ").slice(0, 120)} | أجزاء ${x.parts_count} | pdf: ${(x.parts || []).map(p => p.pdf_url).filter(Boolean).slice(0, 2).join(" ")} | طبعات أخرى: ${(x.copies || []).length}`); }
  // روابط القراءة في سكربتات الواجهة (Nuxt) حول api/v2
  const home = await get("https://ketabonline.com/ar"), js = [...new Set([...home.b.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], "https://ketabonline.com").href))];
  const ctx = new Set();
  for (const u of js.slice(0, 25)) { const r = await get(u); for (const mm of r.b.matchAll(/.{0,90}(?:\/pages|\/read|page_id|pdf_url|copies|print_pg|is_encrypted).{0,90}/g)) ctx.add(mm[0].replace(/\s+/g, " ")); }
  rep.push("- سياقات في السكربتات:", ...[...ctx].slice(0, 40).map(x => "  - `" + x.replace(/`/g, "'") + "`"));
  fs.writeFileSync(path.join(OUT, "report2.md"), rep.join("\n") + "\n");
  console.log(rep.join("\n").slice(0, 2000));
})();
