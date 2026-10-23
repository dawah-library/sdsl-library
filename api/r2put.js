// دالة خادم Vercel: روابط رفع مؤقتة إلى مخزن R2 لمهام GitHub Actions في مستودع المكتبة فقط.
// تثبت المهمة هويتها برمز OIDC من GitHub (لا مفاتيح في GitHub)، فيتحقق الخادم من توقيعه ومن أنه صادر لمستودعنا وفرعه الرئيس.
// POST /api/r2put  { keys: ["books/<id>/p0001.webp", ...] }  مع ترويسة Authorization: Bearer <رمز OIDC>
const crypto = require("crypto");
const REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
const AUD = "sdsl-library";
const E = k => (process.env[k] || "").trim();
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
let JWKS = null, JWKS_AT = 0;

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

const b64u = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
async function verifyOidc(tok) {
  const [h, p, sg] = String(tok).split("."); if (!sg) throw new Error("bad token");
  const head = JSON.parse(b64u(h).toString()), claims = JSON.parse(b64u(p).toString());
  if (head.alg !== "RS256") throw new Error("alg");
  if (!JWKS || Date.now() - JWKS_AT > 3600e3) { JWKS = (await (await fetch("https://token.actions.githubusercontent.com/.well-known/jwks")).json()).keys; JWKS_AT = Date.now(); }
  const jwk = JWKS.find(k => k.kid === head.kid); if (!jwk) throw new Error("kid");
  const ok = crypto.createVerify("RSA-SHA256").update(h + "." + p).verify(crypto.createPublicKey({ key: jwk, format: "jwk" }), b64u(sg));
  if (!ok) throw new Error("signature");
  const now = Date.now() / 1000;
  if (claims.iss !== "https://token.actions.githubusercontent.com") throw new Error("iss");
  if ((Array.isArray(claims.aud) ? !claims.aud.includes(AUD) : claims.aud !== AUD)) throw new Error("aud");
  if (!(claims.exp > now) || (claims.nbf && claims.nbf > now + 60)) throw new Error("expired");
  if (claims.repository !== REPO || claims.ref !== "refs/heads/main") throw new Error("repo");
  return claims;
}

module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(o)); };
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
