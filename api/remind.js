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
// إدراج أو تحديث (upsert) بلا المساس بالأعمدة غير المرسلة
async function sbUp(table, row) {
  const key = sbKey(), h = { apikey: key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
  if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + table, { method: "POST", headers: h, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(table + ": " + r.status + " " + (await r.text()).slice(0, 200));
}
const inList = ids => "(" + ids.map(x => '"' + String(x).replace(/"/g, "") + '"').join(",") + ")";

/* البريد: يعمل متى ضُبط في Vercel RESEND_API_KEY (يرسل من noreply@dawahlibrary.org)، أو متغيرات SMTP_HOST وSMTP_USER وSMTP_PASS (واختياريًا SMTP_PORT وSMTP_FROM)،
   مثل Gmail بكلمة مرور التطبيقات (smtp.gmail.com، 465). عنوان العضو من حسابه في Supabase. */
let MAILER;
async function mailTo(uid, title, body, url, pid, pr) {
  const resend = process.env.RESEND_API_KEY;
  if (!resend && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)) return false;
  if (resend) MAILER = { sendMail: async m => { const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + resend, "Content-Type": "application/json" }, body: JSON.stringify(m) }); if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200)); } };
  else if (MAILER === undefined) { try { const nm = require(process.env.SDSL_MAILER_MODULE || "nodemailer"), port = +(process.env.SMTP_PORT || 465); MAILER = nm.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); } catch (e) { MAILER = null; } }
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
  await MAILER.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_FROM || (resend ? "مكتبة الدعوة السلفية الرقمية <noreply@dawahlibrary.org>" : `"مكتبة الدعوة السلفية الرقمية" <${process.env.SMTP_USER}>`), to: u.email, subject: title, text: body + "\n" + link, html });
  return true;
}
/* بريد عام للعضو (طلب المدير، ٢٠ نوفمبر ٢٠٢٦): تذكير القراءة الجماعية، والحث على مواصلة القراءة؛ مع رابط إدارة التفضيلات */
async function mailMsg(uid, title, body, url, btn) {
  if (!(await mailTo.ready())) return false;
  const key = sbKey(), h = { apikey: key }; if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const u = await (await fetch(process.env.SUPABASE_URL + "/auth/v1/admin/users/" + uid, { headers: h })).json(); if (!u || !u.email) return false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), link = SITE + "#" + String(url).replace(/^#/, "");
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e1d8;border-radius:14px;background:#fffdf8;color:#222;line-height:1.9">
<h2 style="color:#0f5c4d;margin:0 0 8px">مكتبة الدعوة السلفية الرقمية</h2><h3 style="margin:0 0 10px">${esc(title)}</h3><p>${esc(body)}</p>
<p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#0f5c4d;color:#fff;padding:12px 26px;border-radius:10px;text-decoration:none;font-weight:bold">${esc(btn || "افتح المكتبة")}</a></p>
<p style="font-size:12px;color:#999">«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة». لإيقاف هذا النوع من الرسائل أو تغييره: <a href="${SITE}#/account">حسابي ← الإشعارات والبريد</a>.</p></div>`;
  await MAILER.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_FROM || "مكتبة الدعوة السلفية الرقمية <noreply@dawahlibrary.org>", to: u.email, subject: title, text: body + "\n" + link, html });
  return true;
}
mailTo.ready = async () => {
  const resend = process.env.RESEND_API_KEY;
  if (resend) { MAILER = { sendMail: async m => { const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + resend, "Content-Type": "application/json" }, body: JSON.stringify(m) }); if (!r.ok) throw new Error("resend " + r.status); } }; return true; }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  if (MAILER === undefined) { try { const nm = require(process.env.SDSL_MAILER_MODULE || "nodemailer"), port = +(process.env.SMTP_PORT || 465); MAILER = nm.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); } catch (e) { MAILER = null; } }
  return !!MAILER;
};
// وقت القاهرة (مواعيد القراءة الجماعية بتوقيتها)
function cairo(d) {
  const P = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${P.year}-${P.month}-${P.day}`, min: (+P.hour % 24) * 60 + +P.minute, hour: +P.hour % 24, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(P.weekday) };
}
const MOTIV = [
  ["✦ طلب العلم عبادة", "قال ﷺ: «من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة». اجعل لك اليوم نصيبًا من القراءة ولو صفحات قليلة."],
  ["📖 القليل الدائم", "«أحب الأعمال إلى الله أدومها وإن قل». عشر صفحات كل يوم تختم بها في السنة عشرات الكتب بإذن الله."],
  ["🔥 علو الهمة", "قال ابن الجوزي: «من علامة كمال العقل علو الهمة». ارفع همتك، وابدأ اليوم كتابًا كنت تؤجله."],
  ["🌿 العلم قبل القول والعمل", "بوّب البخاري: «باب العلم قبل القول والعمل». تعلّم ما تصح به عبادتك ومعاملتك؛ مكتبتك بين يديك."],
  ["⏳ الوقت رأس مالك", "قال الحسن البصري: «يا ابن آدم إنما أنت أيام، كلما ذهب يوم ذهب بعضك». اغتنم وقتك بقراءة نافعة."],
  ["🤝 القراءة مع الرفقة", "شارك في القراءة الجماعية؛ فالرفقة الصالحة تعين على المواصلة، والمذاكرة تثبّت العلم."],
  ["✍️ قيّد العلم", "«قيّدوا العلم بالكتاب». دوّن فوائدك وأنت تقرأ، واستعن بالتعليقات والعلامات في المكتبة."],
];
module.exports = async (req, res) => {
  if (require("../lib/rate").limited(req, "remind", 10, 60 * 60e3)) return res.status(429).json({ ok: false });
  res.setHeader("cache-control", "no-store");
  const q = req.query || {};
  const v = vapid();
  if (q.key) return res.status(v ? 200 : 503).json(v ? { publicKey: v.publicKey } : { message: "أضف SUPABASE_SECRET_KEY في إعدادات Vercel لتفعيل إشعارات الجهاز." });
  if (!(await require("../lib/switch").on("notify"))) return res.status(200).json({ ok: true, paused: true, message: "التذكير والإشعارات موقوفة من الإدارة" });
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
    // 1-ج) الاشتراك التلقائي للأعضاء (طلب المدير، ٢٠ نوفمبر ٢٠٢٦) — تفضيلات العضو في member_prefs (لا صف = الكل مفعّل)
    const C = cairo(now); let MAILN = 0; const MAILCAP = +(process.env.SDSL_MAIL_RUN || 90);
    const prefsOf = async ids => { const m = {}; if (!ids.length) return m; try { (await sb("member_prefs?select=*&user_id=in." + inList(ids)) || []).forEach(p => m[p.user_id] = p); } catch (e) { } return m; };
    const allow = (p, kind, ch) => !p || (!(p.off || []).includes(kind) && (ch === "mail" ? p.mail !== false : ch === "push" ? p.push !== false : true));
    async function tell(uids, kind, title, body, url, btn, tag) {  // إشعار في الحساب + الجهاز + البريد بحسب التفضيلات
      uids = [...new Set(uids)]; if (!uids.length) return; const P = await prefsOf(uids), subs = await sb("push_subs?select=*&user_id=in." + inList(uids));
      for (const u of uids) {
        if (!allow(P[u], kind)) continue;
        await sb("notifications", { method: "POST", body: JSON.stringify({ user_id: u, title, body, url: "#" + url.replace(/^#/, "") }) });
        if (allow(P[u], kind, "push")) await pushTo((subs || []).filter(s => s.user_id === u), { title, body, url: url.replace(/^#/, ""), tag });
        if (allow(P[u], kind, "mail") && MAILN < MAILCAP) { try { if (await mailMsg(u, title, body, url, btn)) { MAILN++; log.emailed = (log.emailed || 0) + 1; } } catch (e) { console.error("mail", e.message); } }
      }
    }
    const state = async k => { try { const [r] = await sb("notify_state?k=eq." + k + "&select=v"); return r ? r.v : null; } catch (e) { return undefined; } };
    const setState = (k, v) => sbUp("notify_state", { k, v, at: new Date().toISOString() });
    const getSite = async p => { try { const r = await fetch(SITE + p + "?t=" + Date.now()); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    // تذكير القراءة الجماعية قبل موعدها بثلاث ساعات (الموعد بتوقيت القاهرة؛ مرة في اليوم لكل مجموعة)
    try {
      const G = await sb(`group_reads?select=id,book_id,title,owner,start_date,days,week_days,read_time,remind_on&status=eq.active&limit=300`);
      log.groups = 0;
      for (const g of G || []) {
        if (g.remind_on === C.date || !/^\d{1,2}:\d{2}/.test(g.read_time || "")) continue;
        const [hh, mm] = g.read_time.split(":").map(Number), diff = hh * 60 + mm - C.min; if (!(diff > 0 && diff <= 180)) continue;
        const d0 = Date.parse(g.start_date + "T00:00:00Z"), dt = Date.parse(C.date + "T00:00:00Z"); if (dt < d0) continue;
        const wd = (g.week_days || []).filter(x => x >= 0 && x <= 6); let k;
        if (wd.length && wd.length < 7) { if (!wd.includes(C.wd)) continue; k = 0; for (let t = d0; t <= dt; t += 864e5) if (wd.includes(new Date(t).getUTCDay())) k++; }
        else k = Math.round((dt - d0) / 864e5) + 1;
        if (k < 1 || k > g.days) continue;
        const mem = (await sb(`group_members?select=user_id&group_id=eq.${g.id}&status=eq.joined`) || []).map(x => x.user_id).concat([g.owner]);
        await sb("group_reads?id=eq." + g.id, { method: "PATCH", body: JSON.stringify({ remind_on: C.date }) });
        await tell(mem, "group", "⏰ القراءة الجماعية بعد ثلاث ساعات: «" + g.title + "»", "موعد ورد اليوم (" + k + " من " + g.days + ") الساعة " + g.read_time + " بتوقيت القاهرة. استعد وشارك إخوانك.", "/group/" + g.id, "افتح المجموعة", "grp-" + g.id);
        log.groups++;
      }
    } catch (e) { if (!/remind_on|group_reads/.test(e.message)) console.error("groups", e.message); log.groups = "غير مفعّل: " + String(e.message).slice(0, 80); }
    // جديد المكتبة والصوتيات والإذاعة: إعلان يومي (الساعة ١٨ بتوقيت القاهرة) بما أُضيف منذ آخر إعلان
    if (C.hour === 18 || q.force === "new") try {
      const seen = await state("seen");
      if (seen !== undefined) {
        const [cat, au] = await Promise.all([getSite("data/catalog.json"), getSite("data/audio/_list.json")]);
        const bk = ((cat && cat.books) || []).filter(b => !b.hidden && !b.demo && !((b.vol || 0) > 1)), aus = Object.entries(au || {}).filter(([, x]) => x && x.ok && !x.preview);
        if (!seen) await setState("seen", { books: bk.map(b => b.id), audio: aus.map(([k]) => k) });
        else {
          const sb0 = new Set(seen.books || []), sa0 = new Set(seen.audio || []), nb = bk.filter(b => !sb0.has(b.id)), na = aus.filter(([k]) => !sa0.has(k));
          const ttl = b => b.setTitle || b.title;
          if (nb.length) await sb("broadcasts", { method: "POST", body: JSON.stringify({ kind: "new", title: nb.length === 1 ? "📚 جديد المكتبة: «" + ttl(nb[0]) + "»" : "📚 " + nb.length + " كتب ومواد جديدة في المكتبة", body: nb.slice(0, 6).map(ttl).join("، ").slice(0, 400), url: nb.length === 1 ? "#/book/" + nb[0].id + "/1" : "#/library?s=new" }) });
          if (na.length) await sb("broadcasts", { method: "POST", body: JSON.stringify({ kind: "audio", title: na.length === 1 ? "🎧 انضم إلى الصوتيات والإذاعة: «" + (na[0][1].t || "") + "»" : "🎧 " + na.length + " كتب مسموعة جديدة في الصوتيات والإذاعة", body: na.slice(0, 6).map(([, x]) => x.t).join("، ").slice(0, 400), url: na.length === 1 ? "#/audio/" + na[0][0] : "#/audio" }) });
          if (nb.length || na.length || (seen.books || []).length !== bk.length) await setState("seen", { books: bk.map(b => b.id), audio: aus.map(([k]) => k) });
          log.newBooks = nb.length; log.newAudio = na.length;
        }
      }
    } catch (e) { console.error("new", e.message); }
    // رسائل تحفيزية: السبت والاثنين والأربعاء الساعة ٨ صباحًا بتوقيت القاهرة، بالتناوب بين رسائل ثابتة ووصايا العلم من كتب المكتبة
    if ((C.hour === 8 && [6, 1, 3].includes(C.wd)) || q.force === "motiv") try {
      const st = (await state("motiv")) || { i: 0 };
      if (st.d !== C.date) {
        let t, b, u = "/";
        if (st.i % 2 === 0) [t, b] = MOTIV[(st.i / 2) % MOTIV.length];
        else { const Q = ((await getSite("data/quotes.json")) || {}).items || [], x = Q.length ? Q[((st.i - 1) / 2) % Q.length] : null; if (x) { t = "✦ من وصايا العلم والقراءة"; b = "«" + x.t.slice(0, 220) + "» — " + (x.title || "") + "، ص " + x.p; u = "/book/" + x.b + "/" + x.p; } else [t, b] = MOTIV[0]; }
        await sb("broadcasts", { method: "POST", body: JSON.stringify({ kind: "motiv", title: t, body: b, url: "#" + u }) });
        await setState("motiv", { i: st.i + 1, d: C.date }); log.motiv = 1;
      }
    } catch (e) { console.error("motiv", e.message); }
    // الحث على مواصلة القراءة: من انقطع أسبوعًا (آخر قراءة بين ٧ و٩٠ يومًا)، مرة في الأسبوع على الأكثر، الساعة ١٩ بتوقيت القاهرة
    if (C.hour === 19 || q.force === "nudge") try {
      const from = new Date(now - 90 * 864e5).toISOString(), to = new Date(now - 7 * 864e5).toISOString();
      const R = await sb(`book_reads?select=user_id,book_id,last_page,last_at&last_at=gte.${from}&order=last_at.desc&limit=5000`);
      const last = {}; (R || []).forEach(r => { if (!last[r.user_id]) last[r.user_id] = r; });
      const cand = Object.values(last).filter(r => r.last_at < to), P = await prefsOf(cand.map(r => r.user_id).slice(0, 400)), wk = new Date(now - 7 * 864e5).toISOString().slice(0, 10);
      const due = cand.filter(r => !(P[r.user_id] && P[r.user_id].last_nudge && P[r.user_id].last_nudge > wk)).slice(0, 80);
      const cat = due.length ? await getSite("data/catalog.json") : null, T = id => (((cat && cat.books) || []).find(b => b.id === id) || {}).title || "كتابك";
      for (const r of due) {
        await sbUp("member_prefs", { user_id: r.user_id, last_nudge: todayUTC });
        await tell([r.user_id], "read", "📖 اشتقنا إلى قراءتك", "توقفتَ في «" + T(r.book_id) + "» عند صفحة " + (r.last_page || 1) + ". عُد إليه اليوم ولو بصفحات يسيرة؛ فالقليل الدائم خير من الكثير المنقطع.", "/book/" + r.book_id + "/" + (r.last_page || 1), "تابع القراءة", "nudge");
      }
      log.nudged = due.length;
    } catch (e) { if (!/member_prefs|book_reads/.test(e.message)) console.error("nudge", e.message); }
    // 2) الإشعارات العامة من المشرفين والإعلانات الآلية (من أوقف نوعها في تفضيلاته لا تصله على جهازه)
    const bc = await sb("broadcasts?select=*&pushed=eq.false&order=created_at.asc&limit=5");
    if (bc && bc.length) {
      const all = await sb("push_subs?select=*&limit=5000");
      let offP = []; try { offP = await sb("member_prefs?select=user_id,push,off&or=(push.eq.false,off.neq.{})&limit=5000") || []; } catch (e) { }
      for (const b of bc) {
        await sb("broadcasts?id=eq." + b.id, { method: "PATCH", body: JSON.stringify({ pushed: true }) });
        const no = new Set(offP.filter(p => p.push === false || (b.kind && (p.off || []).includes(b.kind))).map(p => p.user_id));
        await pushTo((all || []).filter(s => !no.has(s.user_id)), { title: b.title, body: b.body || "", url: (b.url || "/").replace(/^#/, ""), tag: "bc-" + b.id });
        log.broadcasts++;
      }
    }
    return res.status(200).json(Object.assign({ ok: true, hourUTC: H, webpush: !!webpush }, log));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: String(e.message || e) });
  }
};
