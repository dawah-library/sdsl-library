// ممرّ ملفات الصوت والفيديو من إصدارات GitHub:
//   /au/<كتاب>/<ملف>.mp3    ← audio-<كتاب>
//   /au/v/<كتاب>/<ملف>.mp4  ← video-<كتاب> (فيديوهات مراجعات الكتب)
// GitHub يرسل الملف بنوع application/octet-stream وكمرفق للتنزيل (مع nosniff)، فيرفض Safari على iPhone تشغيله؛
// هنا يُعاد بنوعه الصحيح (audio/mpeg أو video/mp4) مع دعم المقاطع (Range) والتخزين المؤقت في شبكة Cloudflare.
const REPO = "dawah-library/sdsl-library";
export async function onRequest(ctx) {
  const u = new URL(ctx.request.url);
  const a = u.pathname.match(/^\/au\/([\w-]{1,60})\/([\w.-]{1,80}\.mp3)$/), v = u.pathname.match(/^\/au\/v\/([\w-]{1,60})\/([\w.-]{1,90}\.mp4)$/);
  const m = v || a;
  if (!m) return new Response("not found", { status: 404 });
  const repo = (ctx.env && (v ? ctx.env.VIDEO_REPO : ctx.env.AUDIO_REPO)) || REPO;
  const src = `https://github.com/${repo}/releases/download/${v ? "video" : "audio"}-${m[1]}/${m[2]}`;
  const range = ctx.request.headers.get("range");
  let r = await fetch(src, { headers: range ? { range } : {}, redirect: "follow", cf: { cacheEverything: true, cacheTtl: 604800 } });
  if (!r.ok && r.status !== 206) return new Response("media unavailable", { status: r.status === 404 ? 404 : 502, headers: { "cache-control": "no-store" } });
  const h = new Headers();
  for (const k of ["content-length", "content-range", "etag", "last-modified"]) { const x = r.headers.get(k); if (x) h.set(k, x); }
  h.set("content-type", v ? "video/mp4" : "audio/mpeg"); h.set("accept-ranges", "bytes"); h.set("access-control-allow-origin", "*");
  h.set("cache-control", "public, max-age=86400");
  h.set("content-disposition", u.searchParams.has("dl") ? `attachment; filename="${m[2]}"` : "inline");
  return new Response(ctx.request.method === "HEAD" ? null : r.body, { status: r.status, headers: h });
}
