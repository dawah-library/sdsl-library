// استكشاف واجهة منصة مَلَكات (malakat.io) العامة: الأنشطة والمهارات والكتب والأقسام. الناتج tools/books-probe/report-malakat2.md
const fs = require("fs"), path = require("path");
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36", "accept": "application/json", "accept-language": "ar" };
const keysOf = (o, d = 0) => { if (d > 3 || o === null || typeof o !== "object") return typeof o; if (Array.isArray(o)) return o.length ? [keysOf(o[0], d + 1), "×" + o.length] : []; const r = {}; for (const k of Object.keys(o).slice(0, 40)) r[k] = keysOf(o[k], d + 1); return r; };
(async () => { const rep = ["# مَلَكات: الواجهة العامة — " + new Date().toISOString().slice(0, 16), ""];
  for (const p of ["api/categories", "api/books", "api/books/categories", "api/activities", "api/ac/skills", "api/ac/chapters", "api/search?searchWord=%D8%A7%D9%84%D9%86%D8%AD%D9%88", "api/home/contact", "api/epub/env_info", "api/activities?page=1&limit=5", "api/ac/skills?bookId=1"]) {
    let s = 0, b = ""; try { const r = await fetch("https://malakat.io/" + p, { headers: UA }); s = r.status; b = await r.text(); } catch (e) { b = e.message; }
    let j = null; try { j = JSON.parse(b); } catch (e) { }
    rep.push(`- \`${p}\` ← ${s} ${b.length}` + (j ? "\n  - `" + JSON.stringify(keysOf(j)).slice(0, 1200) + "`\n  - `" + b.slice(0, 1500).replace(/`/g, "'") + "`" : ""));
    await new Promise(r => setTimeout(r, 600)); }
  // نص الصفحة الرئيسة الظاهر بعد التشغيل غير متاح (تطبيق Angular)؛ عناوين الصفحات في الموجّه
  try { const h = await (await fetch("https://malakat.io/", { headers: UA })).text(); const js = [...h.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], "https://malakat.io/").href); const t = new Set();
    for (const u of js) { const b = await (await fetch(u, { headers: UA })).text(); for (const m of b.matchAll(/path:"([a-z0-9\-\/:]{2,60})"/g)) t.add(m[1]); for (const m of b.matchAll(/["'`]([؀-ۿ][؀-ۿ\s]{6,60})["'`]/g)) t.add("«" + m[1] + "»"); }
    rep.push("- مسارات الواجهة ونصوصها: " + [...t].slice(0, 250).join(" ، ")); } catch (e) { }
  fs.writeFileSync(path.join(__dirname, "books-probe", "report-malakat2.md"), rep.join("\n") + "\n"); console.log(rep.join("\n").slice(0, 2000)); })();
