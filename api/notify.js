// دالة خادم Vercel: إشعارات الإدارة على تليجرام.
// - مهام GitHub Actions (برمز OIDC): نص حر عن التحويل والاستيراد والأخطاء.
// - الأعضاء (برمز الدخول): أحداث محددة فقط بقوالب ثابتة (رسالة للإدارة، اقتراح تصحيح، عضو جديد).
const { verifyOidc } = require("../lib/oidc");
const { userOf } = require("../lib/auth");
const { notify, escH } = require("../lib/tg");
const RATE = new Map();
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const ch = []; for await (const c of req) ch.push(c);
  try { return JSON.parse(Buffer.concat(ch).toString() || "{}"); } catch (e) { return {}; }
}
/* المرحلة ٩: قائمة «كن من الأوائل» والنشرة البريدية الأسبوعية — جدول public.subscribers (لا تُحفظ العناوين في المستودع العام).
   POST {sub: "waitlist"|"newsletter", email} ← يُسجَّل ويُرسل بريد تأكيد (Resend) فيه رابط التأكيد ورابط الإلغاء؛
   GET ?confirm=<token> تأكيد، ?unsub=<token>[&k=newsletter] إلغاء بضغطة. يحتاج SUPABASE_SECRET_KEY، وRESEND_API_KEY للبريد. */
const SITE_ = (process.env.SITE_URL || "https://dawahlibrary.org").replace(/\/+$/, "");
const sbH = () => { const k = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "", h = { apikey: k, "content-type": "application/json" }; if (!/^sb_/.test(k)) h.Authorization = "Bearer " + k; return h; };
const SUBR = new Map();
async function subs(req, res, out) {
  const url = new URL(req.url, SITE_), q = Object.fromEntries(url.searchParams), base = process.env.SUPABASE_URL + "/rest/v1/subscribers";
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return out(503, { ok: false, message: "الاشتراك غير مهيأ بعد." });
  const page = (t, m) => { res.statusCode = 200; res.setHeader("content-type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${t}</title><body style="font-family:Tahoma,Arial;max-width:520px;margin:60px auto;padding:20px;text-align:center;line-height:2"><h2 style="color:#0f5c4d">${t}</h2><p>${m}</p><p><a href="${SITE_}">مكتبة الدعوة السلفية الرقمية</a></p></body></html>`); };
  if (req.method === "GET") {
    const tk = String(q.confirm || q.unsub || "").replace(/[^0-9a-f-]/gi, ""); if (!tk) return out(400, { ok: false });
    const r = await fetch(base + "?token=eq." + tk + "&select=id,kinds", { headers: sbH() }), [row] = await r.json().catch(() => []); if (!row) return page("الرابط غير صالح", "لم نجد هذا الاشتراك.");
    if (q.confirm) { await fetch(base + "?id=eq." + row.id, { method: "PATCH", headers: sbH(), body: JSON.stringify({ confirmed: true }) }); return page("تم التأكيد ✓", "جزاك الله خيرًا؛ تأكد اشتراكك."); }
    const kinds = q.k ? (row.kinds || []).filter(k => k !== q.k) : [];
    await fetch(base + "?id=eq." + row.id, { method: "PATCH", headers: sbH(), body: JSON.stringify({ kinds, unsub_at: kinds.length ? null : new Date().toISOString() }) });
    return page("أُلغي الاشتراك", q.k === "newsletter" ? "لن تصلك النشرة الأسبوعية بعد الآن." : "أُزيل بريدك من قوائمنا.");
  }
  const b = await body(req), email = String(b.email || "").trim().toLowerCase(), kind = b.sub === "newsletter" ? "newsletter" : "waitlist";
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return out(400, { ok: false, message: "بريد غير صالح." });
  const ip = String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || ""), now = Date.now(); if (now - (SUBR.get(ip) || 0) < 8e3) return out(429, { ok: false, message: "حاول بعد لحظات." }); SUBR.set(ip, now);
  const ex = await (await fetch(base + "?email=eq." + encodeURIComponent(email) + "&select=id,kinds,token,confirmed", { headers: sbH() })).json().catch(() => []);
  let row = ex[0];
  if (row) { const kinds = [...new Set([...(row.kinds || []), kind])]; await fetch(base + "?id=eq." + row.id, { method: "PATCH", headers: sbH(), body: JSON.stringify({ kinds, unsub_at: null }) }); }
  else { const r = await fetch(base, { method: "POST", headers: Object.assign(sbH(), { Prefer: "return=representation" }), body: JSON.stringify({ email, kinds: [kind] }) }); row = (await r.json().catch(() => []))[0]; if (!r.ok || !row) return out(502, { ok: false, message: "تعذّر التسجيل الآن." }); }
  if (process.env.RESEND_API_KEY && !row.confirmed) {
    const c = SITE_ + "/api/notify?confirm=" + row.token, u = SITE_ + "/api/notify?unsub=" + row.token;
    await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: process.env.MAIL_FROM || "مكتبة الدعوة السلفية الرقمية <noreply@dawahlibrary.org>", to: email,
      subject: kind === "waitlist" ? "تأكيد التسجيل في «كن من الأوائل»" : "تأكيد الاشتراك في النشرة الأسبوعية",
      html: `<div dir="rtl" style="font-family:Tahoma,Arial;max-width:520px;margin:auto;line-height:2"><h2 style="color:#0f5c4d">مكتبة الدعوة السلفية الرقمية</h2><p>${kind === "waitlist" ? "سجّلت في قائمة «كن من الأوائل»؛ وتحصل على شارة «عضو مؤسس» في ملفك عند الإطلاق إن شاء الله." : "اشتركت في النشرة الأسبوعية: جديد الكتب، والتطويرات، وفائدة علمية، وكتاب الأسبوع."}</p><p><a href="${c}" style="background:#0f5c4d;color:#fff;padding:10px 22px;border-radius:10px;text-decoration:none">تأكيد البريد</a></p><p style="font-size:12px;color:#888">لم تطلب هذا؟ <a href="${u}">ألغِ الاشتراك</a>.</p></div>` }) }).catch(() => { });
  }
  return out(200, { ok: true, message: process.env.RESEND_API_KEY ? "✓ سُجّل؛ أرسلنا إليك رسالة تأكيد." : "✓ سُجّل بريدك." });
}
module.exports = async (req, res) => {
  const out = (c, o) => { res.statusCode = c; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  if (req.method === "GET" && /[?&](confirm|unsub)=/.test(req.url || "")) return subs(req, res, out);
  if (req.method !== "POST") return out(405, { ok: false });
  if (req.headers["x-sub"] === "1") return subs(req, res, out);
  const b = await body(req), tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let text = "";
  if (req.headers["x-auth"] === "oidc") {
    try { await verifyOidc(tok); } catch (e) { return out(403, { ok: false, reason: e.message }); }
    text = String(b.text || "").slice(0, 3800);
  } else {
    const u = await userOf(req); if (!u) return out(401, { ok: false });
    const now = Date.now(), last = RATE.get(u.id) || 0; if (now - last < 20e3) return out(429, { ok: false }); RATE.set(u.id, now);
    const who = escH(b.name || u.name || u.email || "عضو"), sub = escH(String(b.subject || "").slice(0, 120)), det = escH(String(b.detail || "").slice(0, 300));
    text = b.kind === "msg" ? `📩 <b>رسالة جديدة للإدارة</b> من ${who}\n${sub}\n${det}\n<a href="https://dawahlibrary.org/messages">افتح الرسائل</a>`
      : b.kind === "corr" ? `📝 <b>اقتراح تصحيح</b> من ${who}\n${sub}\n${det}`
      : b.kind === "signup" ? `👤 <b>عضو جديد</b>: ${who}`
      : b.kind === "tkreq" ? `✍️ <b>طلب ${String(b.subject || "").startsWith("مراجعة") ? "مراجعة نص" : "تشكيل"} كتاب</b> من ${who}\n${sub}\n${det}\n<a href="https://dawahlibrary.org/admin?t=tashkeel">إدارة التشكيل</a>`
      : b.kind === "report" ? `🚩 <b>بلاغ عن منشور في مجتمع المكتبة</b> من ${who}\n${sub}\n${det}\n<a href="https://dawahlibrary.org/community?k=reports">افتح البلاغات</a>`
      : "";
    if (!text) return out(400, { ok: false });
  }
  const r = await notify(text);
  out(200, { ok: !!(r && r.ok), reason: r && r.reason });
};
