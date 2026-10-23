// إشعارات الإدارة على أجهزة المديرين (Web Push) وفي جرس الإشعارات داخل الموقع — بلا تليجرام ولا مفاتيح إضافية
const crypto = require("crypto");
const SITE = (process.env.SITE_URL || "https://dawahlibrary.org").replace(/\/?$/, "/");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function vapid() {  // المفاتيح نفسها التي يستعملها api/remind.js (مشتقة من المفتاح السري)
  const sec = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VAPID_SEED;
  if (!sec) return null;
  const priv = crypto.createHash("sha256").update("dawah-vapid:" + sec).digest();
  const ec = crypto.createECDH("prime256v1"); ec.setPrivateKey(priv);
  return { publicKey: b64u(ec.getPublicKey()), privateKey: b64u(priv) };
}
const plain = h => String(h || "").replace(/<a [^>]*>[^<]*<\/a>/g, "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
async function adminPush(sb, html, url, quiet) {
  const v = vapid(); let wp = null;
  try { wp = require("web-push"); if (v) wp.setVapidDetails(SITE, v.publicKey, v.privateKey); } catch (e) { wp = null; }
  const admins = await sb("profiles?select=id&role=eq.admin");
  const ids = (admins || []).map(a => a.id); if (!ids.length) return { pushed: 0 };
  const lines = plain(html).split("\n").filter(Boolean), title = (lines[0] || "مكتبة الدعوة السلفية").slice(0, 120), body = lines.slice(1).join("\n").slice(0, 400);
  // جرس الإشعارات داخل الموقع
  try { await sb("notifications", { method: "POST", body: JSON.stringify(ids.map(id => ({ user_id: id, title, body, url: url || "#/admin?t=status" }))) }); } catch (e) { }
  let pushed = 0;
  if (wp && v && !quiet) {
    const subs = await sb("push_subs?select=*&user_id=in.(" + ids.map(x => '"' + x + '"').join(",") + ")");
    for (const s of subs || []) {
      try { await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: url || "#/admin?t=status", tag: "admin-" + Date.now() }), { TTL: 24 * 3600 }); pushed++; } catch (e) { }
    }
  }
  return { pushed };
}
module.exports = { adminPush };
