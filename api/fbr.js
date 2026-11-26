// حلّ رابط مشاركة فيسبوك (facebook.com/share/…) إلى رابط الصفحة الفعلي ومعرّفها. للإدارة فقط.
// لا يفتح إلا نطاقات facebook.com/fb.com ويتبع التحويلات يدويًا (حتى 5) فلا يُستعمل وسيطًا لمواقع أخرى.
const { userOf } = require("../lib/auth");
const OK = h => /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(h);
module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  const u = await userOf(req); if (!u || u.role !== "admin") return out(401, { ok: false });
  let cur; try { cur = new URL(new URL(req.url, "https://x.invalid").searchParams.get("u") || ""); } catch (e) { return out(400, { ok: false, reason: "رابط غير صالح" }); }
  for (let i = 0; i < 6; i++) {
    if (!/^https:$/.test(cur.protocol) || !OK(cur.hostname)) return out(400, { ok: false, reason: "ليس رابط فيسبوك" });
    const r = await fetch(cur.href, { redirect: "manual", headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "accept-language": "ar,en" } });
    const loc = r.headers.get("location");
    if (!loc || r.status < 300 || r.status > 399) break;
    cur = new URL(loc, cur);
    if (/^\/login/.test(cur.pathname)) { const n = cur.searchParams.get("next"); if (n) { try { cur = new URL(n); } catch (e) { } } break; }
  }
  const m = cur.pathname.match(/^\/(profile\.php|people\/[^/]+\/(\d+)|([A-Za-z0-9.\-_]+))/);
  let h = null;
  if (m) { if (m[1] === "profile.php") { const id = cur.searchParams.get("id"); if (id) h = "profile.php?id=" + id; } else h = m[2] || m[3]; }
  if (!h || /^(share|sharer|login|groups|watch|pages|story\.php|permalink\.php|photo|l\.php)$/i.test(h)) return out(200, { ok: false, reason: "تعذّر استخراج الصفحة من الرابط" });
  out(200, { ok: true, handle: h, url: "https://www.facebook.com/" + h + (h.startsWith("profile.php") ? "" : "/") });
};
