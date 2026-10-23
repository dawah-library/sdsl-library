// دالة خادم Vercel: روابط مؤقتة موقَّعة لصور صفحات الكتاب المصور في مخزن R2 الخاص — للأعضاء المسجلين فقط.
// GET /api/pages?b=<كتاب>&from=<أول صفحة>&n=<عدد>[&pdf=1]  مع ترويسة Authorization: Bearer <رمز الدخول>
// متغيرات Vercel: R2_ACCOUNT_ID، R2_ACCESS_KEY_ID، R2_SECRET_ACCESS_KEY، R2_BUCKET، SUPABASE_URL، SUPABASE_ANON_KEY
const crypto = require("crypto");
const E = k => (process.env[k] || "").trim();
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// توقيع رابط GET بطريقة AWS SigV4 (يقبلها R2)
function presign(key, ttl, extra) {
  const host = E("R2_ACCOUNT_ID") + ".r2.cloudflarestorage.com", now = new Date();
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), day = amz.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`, path = "/" + E("R2_BUCKET") + (key ? "/" + key.split("/").map(enc).join("/") : "");
  const q = Object.assign({}, extra || {}, { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": E("R2_ACCESS_KEY_ID") + "/" + scope, "X-Amz-Date": amz, "X-Amz-Expires": String(ttl), "X-Amz-SignedHeaders": "host" });
  const qs = Object.keys(q).sort().map(k => enc(k) + "=" + enc(q[k])).join("&");
  const canon = ["GET", path, qs, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(canon)].join("\n");
  const kSig = hmac(hmac(hmac(hmac("AWS4" + E("R2_SECRET_ACCESS_KEY"), day), "auto"), "s3"), "aws4_request");
  return `https://${host}${path}?${qs}&X-Amz-Signature=${crypto.createHmac("sha256", kSig).update(sts).digest("hex")}`;
}

module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "private, no-store"); res.end(JSON.stringify(o)); };
  if (!E("R2_ACCOUNT_ID") || !E("R2_ACCESS_KEY_ID") || !E("R2_SECRET_ACCESS_KEY") || !E("R2_BUCKET")) return out(503, { message: "مخزن الكتب المصورة غير مهيأ بعد." });
  // فحص صحة مفاتيح المخزن (لا يكشف شيئًا): /api/pages?check=1
  if (new URL(req.url, "http://x").searchParams.get("check")) {
    try { const r = await fetch(presign("", 60, { "list-type": "2", "max-keys": "1" })); return out(r.ok ? 200 : 502, { ok: r.ok, status: r.status }); }
    catch (e) { return out(502, { ok: false, error: e.message }); }
  }
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return out(401, { message: "النسخة المصورة للأعضاء المسجلين." });
  const u = await fetch(E("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: E("SUPABASE_ANON_KEY"), Authorization: "Bearer " + tok } });
  if (!u.ok) return out(401, { message: "انتهت الجلسة؛ سجّل الدخول من جديد." });
  const sp = new URL(req.url, "http://x").searchParams, b = sp.get("b") || "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(b)) return out(400, { message: "كتاب غير صالح." });
  const from = Math.max(1, parseInt(sp.get("from") || "1", 10)), n = Math.min(30, Math.max(1, parseInt(sp.get("n") || "10", 10)));
  const ttl = 3600, urls = {};
  for (let p = from; p < from + n; p++) urls[p] = presign(`books/${b}/p${String(p).padStart(4, "0")}.webp`, ttl);
  const o = { urls, ttl };
  if (sp.get("pdf")) o.pdf = presign(`books/${b}/book.pdf`, ttl);
  out(200, o);
};
