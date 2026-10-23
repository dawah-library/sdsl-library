// إرسال إشعارات الإدارة إلى تليجرام (بوت المكتبة ← حساب المدير)
// يحتاج TELEGRAM_BOT_TOKEN في Vercel، ورقم المحادثة يُحفظ في جدول app_settings (المفتاح telegram_chat) عند «ربط تليجرام».
const E = k => (process.env[k] || "").trim();
const sbKey = () => E("SUPABASE_SECRET_KEY") || E("SUPABASE_SERVICE_ROLE_KEY");
let CHAT = null, CHAT_AT = 0;

async function sb(path, opt = {}) {
  const key = sbKey(), h = { apikey: key, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" };
  if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const r = await fetch(E("SUPABASE_URL") + "/rest/v1/" + path, Object.assign({ headers: h }, opt));
  const t = await r.text(); if (!r.ok) throw new Error(r.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
async function chatId() {
  if (E("TELEGRAM_CHAT_ID")) return E("TELEGRAM_CHAT_ID");
  if (CHAT && Date.now() - CHAT_AT < 300e3) return CHAT;
  try { const r = await sb("app_settings?select=value&key=eq.telegram_chat"); CHAT = r && r[0] && r[0].value && r[0].value.id; CHAT_AT = Date.now(); } catch (e) { }
  return CHAT;
}
async function tgApi(method, body) {
  const r = await fetch("https://api.telegram.org/bot" + E("TELEGRAM_BOT_TOKEN") + "/" + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json();
}
const escH = s => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
// text بصيغة HTML البسيطة التي يقبلها تليجرام (<b> <i> <a>)
// يرسل إلى هاتف المدير (إشعار الجهاز وجرس الموقع) دائمًا، وإلى تليجرام أيضًا إن رُبط
async function notify(text, opt = {}) {
  let push = null, tg = null;
  if (!opt.chat) { try { push = await require("./push").adminPush(sb, text, opt.url, opt.quiet); } catch (e) { push = { error: e.message }; } }
  if (E("TELEGRAM_BOT_TOKEN")) {
    const id = opt.chat || await chatId();
    if (id) tg = await tgApi("sendMessage", { chat_id: id, text: String(text).slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true });
  }
  return { ok: !!((tg && tg.ok) || (push && push.pushed >= 0 && !push.error)), push, tg: tg && tg.ok };
}
module.exports = { notify, tgApi, sb, escH, E };
