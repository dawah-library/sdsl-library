// ممرّ ملفات الصوت: /au/<كتاب>/<ملف>.mp3 ← إصدارات GitHub (audio-<كتاب>).
// GitHub يرسل الملف بنوع application/octet-stream وكمرفق للتنزيل، فيرفض Safari على iPhone تشغيله؛
// هنا يُعاد بنوع audio/mpeg مع دعم المقاطع (Range) والتخزين المؤقت في شبكة Cloudflare.
const REPO = "dawah-library/sdsl-library";
export async function onRequest(ctx) {
  const u = new URL(ctx.request.url), m = u.pathname.match(/^\/au\/([\w-]{1,60})\/([\w.-]{1,80}\.mp3)$/);
  if (!m) return new Response("not found", { status: 404 });
  const src = `https://github.com/${(ctx.env && ctx.env.AUDIO_REPO) || REPO}/releases/download/audio-${m[1]}/${m[2]}`;
  const range = ctx.request.headers.get("range");
  let r = await fetch(src, { headers: range ? { range } : {}, redirect: "follow", cf: { cacheEverything: true, cacheTtl: 604800 } });
  if (!r.ok && r.status !== 206) return new Response("audio unavailable", { status: r.status === 404 ? 404 : 502, headers: { "cache-control": "no-store" } });
  const h = new Headers();
  for (const k of ["content-length", "content-range", "etag", "last-modified"]) { const v = r.headers.get(k); if (v) h.set(k, v); }
  h.set("content-type", "audio/mpeg"); h.set("accept-ranges", "bytes"); h.set("access-control-allow-origin", "*");
  h.set("cache-control", "public, max-age=86400"); h.set("content-disposition", "inline");
  return new Response(ctx.request.method === "HEAD" ? null : r.body, { status: r.status, headers: h });
}
