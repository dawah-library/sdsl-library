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

/* البريد: يعمل متى ضُبطت في Vercel متغيرات SMTP_HOST وSMTP_USER وSMTP_PASS (واختياريًا SMTP_PORT وSMTP_FROM)،
   مثل Gmail بكلمة مرور التطبيقات (smtp.gmail.com، 465). عنوان العضو من حسابه في Supabase. */
let MAILER;
async function mailTo(uid, title, body, url, pid, pr) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  if (MAILER === undefined) { try { const nm = require("nodemailer"), port = +(process.env.SMTP_PORT || 465); MAILER = nm.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); } catch (e) { MAILER = null; } }
  if (!MAILER) return false;
  const key = sbKey(), h = { apikey: key }; if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const u = await (await fetch(process.env.SUPABASE_URL + "/auth/v1/admin/users/" + uid, { headers: h })).json();
  if (!u || !u.email) return false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pct = pr.total ? Math.round(pr.read / pr.total * 100) : 0, link = SITE + "#" + url, edit = SITE + "#/paths/" + encodeURIComponent(pid);
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e1d8;border-radius:14px;background:#fffdf8;color:#222;line-height:1.9">
<h2 style="color:#0f5c4d;margin:0 0 8px">مكتبة الدعوة السلفية الرقمية</h2><h3 style="margin:0 0 10px">${esc(title)}</h3><p>${esc(body)}.</p>
<div style="background:#eee;border-radius:8px;height:10px;overflow:hidden"><div style="background:#0f5c4d;height:10px;width:${pct}%"></div></div><p style="font-size:13px;color:#666">قرأت ${pct}٪ من المسار، وبقي ${pr.left} صفحة.</p>
<p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#0f5c4d;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold">ابدأ وردك الآن</a></p>
<p style="font-size:12px;color:#999">«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة». لإيقاف التذكير بالبريد أو تغيير وقته: <a href="${edit}">خطة المسار</a>.</p></div>`;
  await MAILER.sendMail({ from: process.env.SMTP_FROM || `"مكتبة الدعوة السلفية الرقمية" <${process.env.SMTP_USER}>`, to: u.email, subject: title, text: body + "\n" + link, html });
  return true;
}
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
    // 1-ب) تذكير ورد المسارات العلمية (جدول study_paths): في وقت العضو، إلا يوم إجازته أو إن قرأ اليوم أو أتم المسار
    try {
      const rows = await sb(`study_paths?select=user_id,id,title,plan,progress,tz_offset,last_sent&hour_utc=lte.${H}&or=(last_sent.is.null,last_sent.lt.${todayUTC})&limit=500`);
      const dueP = (rows || []).filter(r => {
        const pl = r.plan || {}, pr = r.progress || {}; if (pl.mode !== "timed" || !pr.next || !pr.left) return false;
        const loc = new Date(now.getTime() + (r.tz_offset || 0) * 60000), lt = loc.toISOString().slice(0, 10);
        if ((pl.off || []).includes(loc.getUTCDay())) return false;
        return pr.last !== lt;
      });
      log.paths = dueP.length;
      if (dueP.length) {
        const subs = await sb("push_subs?select=*&user_id=in." + inList([...new Set(dueP.map(r => r.user_id))]));
        for (const r of dueP) {
          const pr = r.progress, d = pr.daily || 10, pg = d === 1 ? "صفحة واحدة" : d === 2 ? "صفحتان" : d <= 10 ? d + " صفحات" : d + " صفحة";
          const url = "/book/" + pr.next.id + "/" + pr.next.p, title = "وردك اليوم من مسار «" + (r.title || "مسارك") + "»", body = pg + " — تابع «" + pr.next.t + "» من صفحة " + pr.next.p;
          await sb("notifications", { method: "POST", body: JSON.stringify({ user_id: r.user_id, title, body, url: "#" + url }) });
          await pushTo((subs || []).filter(s => s.user_id === r.user_id), { title, body, url, tag: "spath-" + r.id });
          if (r.plan.email !== false) { try { if (await mailTo(r.user_id, title, body, url, r.id, pr)) log.emailed = (log.emailed || 0) + 1; } catch (e) { console.error("mail", e.message); } }
        }
      }
      for (const r of rows || []) await sb(`study_paths?user_id=eq.${r.user_id}&id=eq.${encodeURIComponent(r.id)}`, { method: "PATCH", body: JSON.stringify({ last_sent: todayUTC }) });
    } catch (e) { if (!/study_paths/.test(e.message)) console.error("paths", e.message); log.paths = "غير مفعّل: " + String(e.message).slice(0, 80); }
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
