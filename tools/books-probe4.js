// استكشاف موقع إثراء (ithraa.io) — يعمل على خوادم GitHub: الصفحة الرئيسة، وملف robots وخريطة الموقع، والسكربتات ونقاط الاتصال
// المذكورة فيها (api)، وبيانات الإطار المضمّنة (__NEXT_DATA__ / __NUXT__)، وعينة صفحات كتاب إن وُجدت، والشروط.
// الناتج: tools/books-probe/report4.md (والعينات ithraa-*.txt)
const fs = require("fs"), path = require("path"), vm = require("vm");
const OUT = path.join(__dirname, "books-probe"); fs.mkdirSync(OUT, { recursive: true });
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept": "text/html,application/json,*/*;q=0.8", "accept-language": "ar,en;q=0.8" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 30000); try { const r = await fetch(u, { headers: UA, redirect: "follow", signal: ac.signal }); const b = await r.text(); await sleep(700); return { s: r.status, u: r.url, ct: r.headers.get("content-type") || "", b }; } catch (e) { return { s: 0, e: e.message, b: "", ct: "" }; } finally { clearTimeout(t); } }
const rep = ["# استكشاف إثراء (ithraa.io) — " + new Date().toISOString().slice(0, 16).replace("T", " "), ""];
const save = (n, t) => fs.writeFileSync(path.join(OUT, "ithraa-" + n), String(t).slice(0, 60000));
const keysOf = (o, d = 0) => { if (d > 3 || o === null || typeof o !== "object") return typeof o; if (Array.isArray(o)) return o.length ? [keysOf(o[0], d + 1), "×" + o.length] : []; const r = {}; for (const k of Object.keys(o).slice(0, 50)) r[k] = keysOf(o[k], d + 1); return r; };
const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
async function probe(label, u, name) {
  const r = await get(u); let l = `- ${label}: \`${u}\` ← ${r.s || "تعذر " + r.e} ${r.ct.split(";")[0]} ${r.b.length} حرفًا${r.u && r.u !== u ? " ← " + r.u : ""}`;
  const j = J(r.b); if (j) l += "\n  - البنية: `" + JSON.stringify(keysOf(j)).slice(0, 1500) + "`\n  - مقتطف: `" + r.b.slice(0, 1200).replace(/`/g, "'") + "`";
  else if (r.b && !/xml/.test(r.ct)) l += "\n  - النص الظاهر: " + txt(r.b).slice(0, 900);
  else if (r.b) l += "\n  - " + r.b.slice(0, 900).replace(/\s+/g, " ");
  rep.push(l); if (name) save(name, r.b); r.j = j; return r;
}
(async () => {
  const B = "https://ithraa.io";
  for (const p of ["/robots.txt", "/sitemap.xml", "/sitemap-index.xml", "/manifest.json"]) await probe(p, B + p);
  const h = await probe("الرئيسة", B + "/", "home.html");
  const base = h.u || B + "/";
  // بيانات الإطار المضمّنة
  for (const rx of [/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/, /<script>window\.__NUXT__=([\s\S]*?)<\/script>/]) { const m = h.b.match(rx); if (m) { save("framedata.txt", m[1]); const j = J(m[1]); rep.push("- بيانات الإطار: " + (j ? "`" + JSON.stringify(keysOf(j)).slice(0, 2500) + "`" : m[1].slice(0, 1500))); } }
  // الروابط الداخلية وأنماطها
  const links = [...new Set([...h.b.matchAll(/href=["']([^"'#]+)["']/g)].map(m => { try { return new URL(m[1], base).href; } catch (e) { return ""; } }).filter(x => x.startsWith(new URL(base).origin)))];
  rep.push(`- روابط داخلية (${links.length}): ` + links.slice(0, 80).join(" ، "));
  // نقاط الاتصال في السكربتات
  const js = [...new Set([...h.b.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], base).href))].slice(0, 30), hits = new Set(), hosts = new Set();
  for (const s of js) { const r = await get(s); for (const m of r.b.matchAll(/["'`]((?:https?:\/\/[a-z0-9.-]+)?\/(?:api|v\d|graphql|rest|books?|pages?|search|authors?|read|content|chapters?|toc|pdf|files)[^"'`\s]{0,90})["'`]/gi)) hits.add(m[1]); for (const m of r.b.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) hosts.add(m[1]); }
  rep.push(`- السكربتات: ${js.length}`, "- نقاط الاتصال المذكورة: " + [...hits].slice(0, 150).join(" ، "), "- النطاقات المذكورة: " + [...hosts].slice(0, 60).join(" ، "));
  // صفحات مرشحة: أول روابط تبدو كتبًا أو أقسامًا
  const cand = links.filter(l => /book|kitab|كتاب|read|library|category|cat|author|search|about|terms|privacy/i.test(decodeURIComponent(l))).slice(0, 10);
  let i = 0; for (const l of cand) { const r = await probe("صفحة " + (++i), l, "page" + i + ".html"); const m = r.b.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (m) { const j = J(m[1]); if (j) rep.push("  - __NEXT_DATA__: `" + JSON.stringify(keysOf(j.props || j)).slice(0, 2000) + "`"); } }
  // سياقات الاتصال في السكربتات (عنوان الواجهة، والمسارات المبنية على api)
  const ctx = new Set();
  for (const s of js) { const r = await get(s); for (const m of r.b.matchAll(/.{0,120}(?:apiUrl|baseUrl|api\/|\/api|environment|endpoint|HttpClient|\.get\(|\.post\().{0,160}/g)) { const x = m[0].replace(/\s+/g, " "); if (/api|Url|http/.test(x)) ctx.add(x); } }
  rep.push("- سياقات الاتصال:", ...[...ctx].slice(0, 120).map(x => "  - `" + x.replace(/`/g, "'") + "`"));
  // قيم الإعداد (api_url) وثوابت المسارات (booksRoutes/homeRoutes) ثم تجربة القراءة العامة
  let api = "", routes = {};
  for (const s of js) { const r = await get(s);
    const m = r.b.match(/api_url\s*:\s*["'`]([^"'`]+)["'`]/); if (m && !api) api = m[1];
    for (const mm of r.b.matchAll(/\b([A-Z][A-Z_]{3,40})\s*:\s*["'`]([a-zA-Z0-9_\/\-]{3,80})["'`]/g)) routes[mm[1]] = mm[2]; }
  rep.push("- api_url: " + api, "- ثوابت المسارات: `" + JSON.stringify(routes).slice(0, 3000) + "`");
  if (api) { const A = new URL(api, B).href.replace(/\/?$/, "/");
    for (const k of ["GET_ALL_BOOKS", "GET_BOOKS_CATEGORIES", "GET_ANNOTATIONS_COUNT", "GET_DICTIONARIES_COUNT", "GET_FAVOURITE_ANNOTATIONS", "GET_CATEGORIES_COUNT", "GET_MEMBERS_COUNT"]) if (routes[k]) await probe(k, A + routes[k] + (k === "GET_ALL_BOOKS" ? "/0?page=1&limit=5" : ""));
    const L = await get(A + (routes.GET_ALL_BOOKS || "books/getAllBooks") + "/0?page=1&limit=5"), j = J(L.b), list = j && (j.message?.books || j.message || j.books || j.data); const one = Array.isArray(list) ? list[0] : null;
    if (one) { rep.push("- أول كتاب: `" + JSON.stringify(one).slice(0, 1500) + "`"); const id = one.book_id || one.id;
      for (const k of ["GET_BOOK_CHAPTERS", "GET_PUBLIC_COPIES_OF_BOOK"]) if (routes[k]) await probe(k, A + routes[k] + "/" + id + (k === "GET_PUBLIC_COPIES_OF_BOOK" ? "/0" : ""));
      await probe("وصف الكتاب", A + "books/bookDescription/" + id); await probe("فصول", A + "chapters/book/" + id); }
  }
  // واجهات شائعة
  for (const p of ["/api", "/api/books", "/api/v1/books", "/api/search?q=%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9", "/api/categories", "/books", "/search?q=%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9"]) await probe(p, B + p);
  for (const sub of ["api", "app", "backend", "files", "cdn"]) await probe("نطاق " + sub, `https://${sub}.ithraa.io/`);
  fs.writeFileSync(path.join(OUT, "report4.md"), rep.join("\n") + "\n"); console.log(rep.join("\n").slice(0, 3000));
})();
