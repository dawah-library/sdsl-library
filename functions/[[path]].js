// صفحات الموقع على Cloudflare Pages: نفس عمل إعادة التوجيه في vercel.json —
// صفحة index.html مع عنوان ووصف ونص مناسب لكل كتاب أو مقال (api/page.js) لمحركات البحث ومعاينة الروابط.
// الملفات الثابتة (js/css/data/الصور…) مستثناة من هذه الدالة في _routes.json فلا تُحسب طلباتها.
import { run } from "./_lib/adapter.js";
import page from "../api/page.js";
import sitemap from "../api/sitemap.js";

const SCAN = /(?:\.(?:php|asp|aspx|jsp|cgi|env|ini|bak|sql)$|^\/(?:wp-|\.git|\.env|cgi-bin|xmlrpc))/i;
const REDIR = [[/^\/author\/w73\/?$/, "/author/w53", 301], [/^\/book\/umda(?:\/.*)?$/, "/book/umdafiqh/1", 302]];

export async function onRequest(ctx) {
  const u = new URL(ctx.request.url), p = u.pathname;
  if (u.hostname === "www.dawahlibrary.org" || u.hostname.endsWith(".pages.dev") && ctx.env.CANONICAL_REDIRECT === "1")
    return Response.redirect("https://dawahlibrary.org" + p + u.search, 301);
  for (const [rx, to, c] of REDIR) if (rx.test(p)) return Response.redirect(new URL(to, u).href, c);
  if (SCAN.test(p)) { const r = await ctx.env.ASSETS.fetch(new URL("/404.html", u)); return new Response(r.body, { status: 404, headers: r.headers }); }
  if (p === "/sitemap.xml") return run(sitemap, ctx, { url: "/api/sitemap", preload: ["data/catalog.json"], retry: true });
  if (p === "/robots.txt") return run(sitemap, ctx, { url: "/api/sitemap?robots=1", preload: ["data/catalog.json"], retry: true });
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return ctx.next(); // ملف ثابت غير مستثنى صراحة
  const sub = p.replace(/^\/+/, "/");
  return run(page, ctx, { url: "/api/page?__p=" + encodeURIComponent(sub) + (u.search ? "&" + u.search.slice(1) : ""), preload: ["index.html", "data/catalog.json"], retry: true });
}
