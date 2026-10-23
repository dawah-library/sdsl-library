// دالة خادم Vercel: تذكير الأعضاء بوردهم اليومي وإرسال إشعارات المكتبة إلى أجهزتهم (Web Push).
// يستدعيها GitHub Actions كل ساعة (.github/workflows/remind.yml). استدعاؤها آمن ومتكرر:
// كل مشروع قراءة يُذكَّر مرة واحدة في اليوم على الأكثر، وكل إشعار عام يُرسل مرة واحدة.
// متغيرات البيئة في Vercel: SUPABASE_URL، و SUPABASE_SECRET_KEY (أو SUPABASE_SERVICE_ROLE_KEY)
// مفاتيح VAPID تُشتق تلقائيًا من المفتاح السري فلا تحتاج إعدادًا إضافيًا.
const crypto = require("crypto");
const SITE = (process.env.SITE_URL || "https://dawahlibrary.org").replace(/\/?$/, "/");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function vapid() {
  const sec = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VAPID_SEED;
  if (!sec) return null;
  const priv = crypto.createHash("sha256").update("dawah-vapid:" + sec).digest();
  const ec = crypto.createECDH("prime256v1"); ec.setPrivateKey(priv);
  return { publicKey: b64u(ec.getPublicKey()), privateKey: b64u(priv) };
}
const sbKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
async function sb(path, opt = {}) {
  const key = sbKey();
  const h = { apikey: key, "Content-Type": "application/json", Prefer: "return=representation" };
  if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, Object.assign({ headers: h }, opt));
  const t = await r.text(); if (!r.ok) throw new Error(path.split("?")[0] + ": " + r.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
const inList = ids => "(" + ids.map(x => '"' + String(x).replace(/"/g, "") + '"').join(",") + ")";

module.exports = async (req, res) => {
  if (require("../lib/rate").limited(req, "remind", 10, 60 * 60e3)) return res.status(429).json({ ok: false });
  res.setHeader("cache-control", "no-store");
  const q = req.query || {};
  const v = vapid();
  if (q.key) return res.status(v ? 200 : 503).json(v ? { publicKey: v.publicKey } : { message: "أضف SUPABASE_SECRET_KEY في إعدادات Vercel لتفعيل إشعارات الجهاز." });
  if (!v || !process.env.SUPABASE_URL) return res.status(503).json({ message: "الإعداد ناقص: SUPABASE_URL و SUPABASE_SECRET_KEY" });
  let webpush = null;
  try { webpush = require("web-push"); webpush.setVapidDetails(SITE, v.publicKey, v.privateKey); } catch (e) { console.warn("web-push", e.message); }
  const now = new Date(), H = now.getUTCHours(), todayUTC = now.toISOString().slice(0, 10), log = { plans: 0, notified: 0, pushed: 0, removed: 0, broadcasts: 0 };
  async function pushTo(subs, payload) {
    if (!webpush) return;
    for (const s of subs) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 }); log.pushed++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { try { await sb("push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" }); log.removed++; } catch (x) {} } }
    }
  }
  try {
    // 1) تذكير الورد اليومي
    const plans = await sb(`reading_plans?select=*&active=eq.true&hour_utc=lte.${H}&or=(last_sent.is.null,last_sent.lt.${todayUTC})&limit=500`);
    const due = (plans || []).filter(p => {
      const off = (p.tz_offset || 0) * 60000, localToday = new Date(now.getTime() + off).toISOString().slice(0, 10);
      const lr = p.last_read ? new Date(new Date(p.last_read).getTime() + off).toISOString().slice(0, 10) : "";
      return lr !== localToday;
    });
    log.plans = due.length;
    if (due.length) {
      const subs = await sb("push_subs?select=*&user_id=in." + inList([...new Set(due.map(p => p.user_id))]));
      for (const p of due) {
        const at = p.last_page || p.start_page || 1, url = "/book/" + p.book_id + "/" + at;
        const title = "وردك اليوم من «" + (p.title || "كتابك") + "»", body = (p.daily === 1 ? "صفحة واحدة" : p.daily === 2 ? "صفحتان" : p.daily <= 10 ? p.daily + " صفحات" : p.daily + " صفحة") + " — تابع من صفحة " + at;
        await sb("notifications", { method: "POST", body: JSON.stringify({ user_id: p.user_id, title, body, url: "#" + url }) });
        log.notified++;
        await pushTo((subs || []).filter(s => s.user_id === p.user_id), { title, body, url, tag: "plan-" + p.book_id });
      }
      // لا نحدّث إلا من أُرسل إليهم فعلًا، ونعلّم الباقين كذلك حتى لا يتكرر فحصهم اليوم
    }
    for (const p of plans || []) await sb(`reading_plans?user_id=eq.${p.user_id}&book_id=eq.${encodeURIComponent(p.book_id)}`, { method: "PATCH", body: JSON.stringify({ last_sent: todayUTC }) });
    // 2) الإشعارات العامة من المشرفين
    const bc = await sb("broadcasts?select=*&pushed=eq.false&order=created_at.asc&limit=5");
    if (bc && bc.length) {
      const all = await sb("push_subs?select=*&limit=5000");
      for (const b of bc) {
        await sb("broadcasts?id=eq." + b.id, { method: "PATCH", body: JSON.stringify({ pushed: true }) });
        await pushTo(all || [], { title: b.title, body: b.body || "", url: (b.url || "/").replace(/^#/, ""), tag: "bc-" + b.id });
        log.broadcasts++;
      }
    }
    return res.status(200).json(Object.assign({ ok: true, hourUTC: H, webpush: !!webpush }, log));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: String(e.message || e) });
  }
};
