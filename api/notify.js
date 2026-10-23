// دالة خادم Vercel: إشعارات الإدارة على تليجرام.
// - مهام GitHub Actions (برمز OIDC): نص حر عن التحويل والاستيراد والأخطاء.
// - الأعضاء (برمز الدخول): أحداث محددة فقط بقوالب ثابتة (رسالة للإدارة، اقتراح تصحيح، عضو جديد).
const { verifyOidc } = require("../lib/oidc");
const { userOf } = require("../lib/auth");
const { notify, escH } = require("../lib/tg");
const RATE = new Map();
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const ch = []; for await (const c of req) ch.push(c);
  try { return JSON.parse(Buffer.concat(ch).toString() || "{}"); } catch (e) { return {}; }
}
module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  if (req.method !== "POST") return out(405, { ok: false });
  const b = await body(req), tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let text = "";
  if (req.headers["x-auth"] === "oidc") {
    try { await verifyOidc(tok); } catch (e) { return out(403, { ok: false, reason: e.message }); }
    text = String(b.text || "").slice(0, 3800);
  } else {
    const u = await userOf(req); if (!u) return out(401, { ok: false });
    const now = Date.now(), last = RATE.get(u.id) || 0; if (now - last < 20e3) return out(429, { ok: false }); RATE.set(u.id, now);
    const who = escH(b.name || u.name || u.email || "عضو"), sub = escH(String(b.subject || "").slice(0, 120)), det = escH(String(b.detail || "").slice(0, 300));
    text = b.kind === "msg" ? `📩 <b>رسالة جديدة للإدارة</b> من ${who}\n${sub}\n${det}\n<a href="https://dawahlibrary.org/messages">افتح الرسائل</a>`
      : b.kind === "corr" ? `📝 <b>اقتراح تصحيح</b> من ${who}\n${sub}\n${det}`
      : b.kind === "signup" ? `👤 <b>عضو جديد</b>: ${who}`
      : "";
    if (!text) return out(400, { ok: false });
  }
  const r = await notify(text);
  out(200, { ok: !!(r && r.ok), reason: r && r.reason });
};
