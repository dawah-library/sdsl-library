// دالة خادم Vercel: روابط رفع مؤقتة إلى مخزن R2 لمهام GitHub Actions في مستودع المكتبة فقط.
// تثبت المهمة هويتها برمز OIDC من GitHub (لا مفاتيح في GitHub)، فيتحقق الخادم من توقيعه ومن أنه صادر لمستودعنا وفرعه الرئيس.
// POST /api/r2put  { keys: ["books/<id>/p0001.webp", ...] }  مع ترويسة Authorization: Bearer <رمز OIDC>
const crypto = require("crypto");
const { verifyOidc } = require("../lib/oidc");
const E = k => (process.env[k] || "").trim();
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function presignPut(key, ttl) {
  const host = E("R2_ACCOUNT_ID") + ".r2.cloudflarestorage.com";
  const amz = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), day = amz.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`, path = "/" + E("R2_BUCKET") + "/" + key.split("/").map(enc).join("/");
  const q = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": E("R2_ACCESS_KEY_ID") + "/" + scope, "X-Amz-Date": amz, "X-Amz-Expires": String(ttl), "X-Amz-SignedHeaders": "host" };
  const qs = Object.keys(q).sort().map(k => enc(k) + "=" + enc(q[k])).join("&");
  const canon = ["PUT", path, qs, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(canon)].join("\n");
  const kSig = hmac(hmac(hmac(hmac("AWS4" + E("R2_SECRET_ACCESS_KEY"), day), "auto"), "s3"), "aws4_request");
  return `https://${host}${path}?${qs}&X-Amz-Signature=${crypto.createHmac("sha256", kSig).update(sts).digest("hex")}`;
}

module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(o)); };
  // GET ?f=<اسم الملف>: رابط تنزيل مؤقت (10 دقائق) لكتاب في صندوق الرفع الخاص (Supabase Storage)، لمهام التحويل فقط.
  // (دُمج هنا لأن خطة Vercel المجانية تسمح باثنتي عشرة دالة فقط)
  if (req.method === "GET") {
    try { await verifyOidc(String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")); } catch (e) { return out(403, { message: "forbidden" }); }
    const name = new URL(req.url, "http://x").searchParams.get("f") || "";
    if (!/^up[0-9a-z]{4,30}\.pdf$/.test(name)) return out(400, { message: "bad name" });
    const key = E("SUPABASE_SECRET_KEY") || E("SUPABASE_SERVICE_ROLE_KEY"), h = { apikey: key, "content-type": "application/json" };
    if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
    const r = await fetch(E("SUPABASE_URL") + "/storage/v1/object/sign/inbox/" + name, { method: "POST", headers: h, body: JSON.stringify({ expiresIn: 600 }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.signedURL) return out(404, { message: "not found" });
    return out(200, { url: E("SUPABASE_URL") + "/storage/v1" + j.signedURL });
  }
  if (req.method !== "POST") return out(405, { message: "POST فقط" });
  if (!E("R2_ACCOUNT_ID") || !E("R2_ACCESS_KEY_ID") || !E("R2_SECRET_ACCESS_KEY") || !E("R2_BUCKET")) return out(503, { message: "R2 غير مهيأ" });
  try { await verifyOidc(String(req.headers.authorization || "").replace(/^Bearer\s+/i, "")); }
  catch (e) { return out(403, { message: "هوية غير مقبولة: " + e.message }); }
  let body = req.body;
  if (!body || typeof body !== "object") { const ch = []; for await (const c of req) ch.push(c); try { body = JSON.parse(Buffer.concat(ch).toString() || "{}"); } catch (e) { body = {}; } }
  const keys = (body.keys || []).filter(k => /^books\/[A-Za-z0-9_-]{1,80}\/(p\d{4}\.webp|book\.pdf)$/.test(k)).slice(0, 200);
  const urls = {}; keys.forEach(k => { urls[k] = presignPut(k, 3600); });
  out(200, { urls });
};
