// دالة خادم Vercel: ربط بوت تليجرام بحساب المدير (المدير فقط).
// GET: حالة الربط. POST: يأخذ آخر محادثة خاصة ضغط صاحبها Start في البوت ويحفظها، ثم يرسل رسالة تأكيد.
const { userOf } = require("../lib/auth");
const { notify, tgApi, sb, E } = require("../lib/tg");
module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(o)); };
  const u = await userOf(req); if (!u || u.role !== "admin") return out(403, { message: "للمدير فقط." });
  if (!E("TELEGRAM_BOT_TOKEN")) return out(200, { token: false, linked: false, message: "أضف TELEGRAM_BOT_TOKEN في إعدادات Vercel أولًا." });
  const me = await tgApi("getMe"); if (!me.ok) return out(200, { token: false, linked: false, message: "رمز البوت غير صحيح." });
  let cur = null; try { const r = await sb("app_settings?select=value&key=eq.telegram_chat"); cur = r && r[0] && r[0].value; } catch (e) { }
  if (req.method !== "POST") return out(200, { token: true, bot: me.result.username, linked: !!(cur && cur.id), name: cur && cur.name });
  const up = await tgApi("getUpdates", { limit: 50, allowed_updates: ["message"] });
  const msgs = ((up && up.result) || []).map(x => x.message).filter(m => m && m.chat && m.chat.type === "private");
  const m = msgs[msgs.length - 1];
  if (!m) return out(200, { token: true, bot: me.result.username, linked: false, message: `افتح البوت @${me.result.username} في تليجرام واضغط Start، ثم أعد المحاولة.` });
  const val = { id: m.chat.id, name: [m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || m.chat.username || "", by: u.email, at: new Date().toISOString() };
  await sb("app_settings", { method: "POST", body: JSON.stringify({ key: "telegram_chat", value: val }) });
  await notify("✅ <b>تم ربط إشعارات مكتبة الدعوة السلفية الرقمية</b>\nستصلك هنا أخبار التحويل والرفع والاستيراد ورسائل الأعضاء والأخطاء لحظة بلحظة.", { chat: val.id });
  out(200, { token: true, bot: me.result.username, linked: true, name: val.name });
};
