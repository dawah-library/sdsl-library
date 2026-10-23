// التحقق من مستخدم Supabase (عضو أو مشرف) من رمز الدخول
const E = k => (process.env[k] || "").trim();
async function userOf(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || !E("SUPABASE_URL")) return null;
  const u = await fetch(E("SUPABASE_URL") + "/auth/v1/user", { headers: { apikey: E("SUPABASE_ANON_KEY"), Authorization: "Bearer " + tok } });
  if (!u.ok) return null;
  const user = await u.json(); if (!user || !user.id) return null;
  const p = await fetch(E("SUPABASE_URL") + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(user.id), { headers: { apikey: E("SUPABASE_ANON_KEY"), Authorization: "Bearer " + tok } });
  const rows = p.ok ? await p.json() : [];
  return { id: user.id, email: user.email, name: (user.user_metadata || {}).name || (user.user_metadata || {}).full_name || "", role: (rows[0] && rows[0].role) || "member" };
}
module.exports = { userOf };
