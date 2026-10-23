// التحقق من رمز OIDC الصادر من GitHub Actions لمستودع المكتبة (فرع main)
const crypto = require("crypto");
const REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
const AUD = "sdsl-library";
let JWKS = null, JWKS_AT = 0;
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

module.exports = { verifyOidc };
