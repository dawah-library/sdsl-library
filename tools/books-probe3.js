// الجولة الثالثة: جامع الكتب الإسلامية — فك بيانات صفحة القراءة (window.__NUXT__) لمعرفة مكان نص الصفحة وحواشيها وترقيمها،
// وشروط استعمال الموقع (هل يأذن بالنقل)، وقائمة «كتب الألباني». الناتج: tools/books-probe/report3.md
const fs = require("fs"), path = require("path"), vm = require("vm");
const OUT = path.join(__dirname, "books-probe");
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept-language": "ar" };
async function get(u) { try { const r = await fetch(u, { headers: UA }); return { s: r.status, b: await r.text() }; } catch (e) { return { s: 0, b: "" }; } }
const rep = ["# جامع الكتب الإسلامية — الجولة الثالثة — " + new Date().toISOString().slice(0, 16), ""];
function nuxt(html) { const m = html.match(/<script>window\.__NUXT__=([\s\S]*?)<\/script>/); if (!m) return null; const ctx = { window: {} }; try { vm.runInNewContext("window.__NUXT__=" + m[1], ctx, { timeout: 5000 }); return ctx.window.__NUXT__; } catch (e) { return { err: e.message }; } }
function walk(o, p, out, d = 0) { if (d > 8 || !o) return; if (typeof o === "string") { if (o.length > 120 && /[ء-ي]/.test(o)) out.push([p, o.length, o.slice(0, 300)]); return; } if (typeof o !== "object") return; for (const k of Object.keys(o).slice(0, 200)) walk(o[k], p + "." + k, out, d + 1); }
(async () => {
  for (const u of ["https://ketabonline.com/ar/books/1/read?part=1&page=10", "https://ketabonline.com/ar/books/3159/read?page=20"]) {
    const r = await get(u), N = nuxt(r.b); rep.push("## " + u + " ← " + r.s);
    if (!N) { rep.push("- لا __NUXT__"); continue; }
    const out = []; walk(N, "N", out); rep.push("- نصوص طويلة في البيانات:", ...out.slice(0, 25).map(([p, n, t]) => `  - \`${p}\` (${n}): ${t.replace(/\s+/g, " ")}`));
    const keys = []; (function k(o, p, d) { if (d > 5 || !o || typeof o !== "object") return; for (const x of Object.keys(o).slice(0, 60)) { keys.push(p + "." + x); k(o[x], p + "." + x, d + 1); } })(N, "N", 0);
    rep.push("- المفاتيح: " + keys.filter(x => /page|part|text|content|footnote|hamesh|print|number/i.test(x)).slice(0, 80).join(" ، "));
  }
  for (const u of ["https://ketabonline.com/ar/pages/terms-and-conditions", "https://ketabonline.com/ar/pages/about"]) { const r = await get(u), N = nuxt(r.b), out = []; walk(N, "N", out); rep.push("## " + u + " ← " + r.s, ...out.slice(0, 6).map(([p, n, t]) => "- " + t.replace(/\s+/g, " ").slice(0, 300))); const txt = r.b.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); const i = txt.search(/حقوق|نسخ|نقل|استخدام|يحظر|يمنع/); rep.push("- مقتطف: " + txt.slice(Math.max(0, i - 200), i + 1500)); }
  const al = await get("https://backend.ketabonline.com/api/v2/books?category=" + encodeURIComponent("9") + "&limit=5");
  rep.push("## قسم (رقم 9) ← " + al.s + " " + al.b.slice(0, 600));
  const cats = JSON.parse((await get("https://backend.ketabonline.com/api/v2/categories?limit=100")).b || "{}");
  rep.push("## الأقسام: " + ((cats.data || []).map(c => c.id + ":" + c.name + "(" + c.books_count + ")").join("، ")));
  fs.writeFileSync(path.join(OUT, "report3.md"), rep.join("\n") + "\n"); console.log(rep.join("\n").slice(0, 3000));
})();
