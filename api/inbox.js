// دالة خادم Vercel: رابط تنزيل مؤقت (10 دقائق) لكتاب مصور في صندوق الرفع الخاص — لمهام التحويل في GitHub فقط (رمز OIDC).
// بدلًا من حفظ رابط موقَّع في المستودع العام، يُحفظ اسم الملف فقط، ويطلب التحويل الرابط عند الحاجة.
const { verifyOidc } = require("../lib/oidc");
const E = k => (process.env[k] || "").trim();
module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(o)); };
  try { await verifyOidc(String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")); } catch (e) { return out(403, { error: "forbidden" }); }
  const name = new URL(req.url, "http://x").searchParams.get("f") || "";
  if (!/^up[0-9a-z]{4,30}\.pdf$/.test(name)) return out(400, { error: "bad name" });
  const key = E("SUPABASE_SECRET_KEY") || E("SUPABASE_SERVICE_ROLE_KEY"), h = { apikey: key, "content-type": "application/json" };
  if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const r = await fetch(E("SUPABASE_URL") + "/storage/v1/object/sign/inbox/" + name, { method: "POST", headers: h, body: JSON.stringify({ expiresIn: 600 }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.signedURL) return out(404, { error: "not found" });
  out(200, { url: E("SUPABASE_URL") + "/storage/v1" + j.signedURL });
};
