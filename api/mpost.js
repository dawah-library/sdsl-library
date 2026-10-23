// دالة خادم Vercel: نشر «مختارة» من كتاب في المكتبة باسم عضو.
// النشر مقصور على الاقتباس من الكتب: يتحقق الخادم من أن النص المقتبس موجود فعلًا في الصفحة المذكورة من الكتاب،
// ولا يقبل كلامًا شخصيًا. لا يستطيع العضو الكتابة في الجدول مباشرة؛ الخادم وحده يكتب بمفتاح الخدمة.
// POST /api/mpost  { b: معرف الكتاب, p: رقم الصفحة, t: النص المقتبس }  مع ترويسة Authorization: Bearer <رمز الدخول>
const fs = require("fs"), path = require("path");
const ROOT = process.cwd();
let CAT = null;
const norm = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/[^ء-يa-zA-Z0-9٠-٩]+/g, " ").replace(/\s+/g, " ").trim();
const sbKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
async function sb(p, opt = {}) {
  const key = sbKey(), h = { apikey: key, "Content-Type": "application/json", Prefer: "return=representation" };
  if (!/^sb_/.test(key)) h.Authorization = "Bearer " + key;
  const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + p, Object.assign({ headers: h }, opt));
  const t = await r.text(); if (!r.ok) throw new Error(r.status + " " + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
async function shard(b, origin) {
  if (!b.vf) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/books", b.id + ".json"), "utf8")); } catch (e) { } }
  try { const r = await fetch(origin + (b.vf ? "/vols/" : "/data/books/") + encodeURIComponent(b.id) + ".json"); if (r.ok) return await r.json(); } catch (e) { }
  return null;
}
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}
const out = (res, code, o) => { res.statusCode = code; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };

module.exports = async (req, res) => {
  if (req.method !== "POST") return out(res, 405, { message: "POST فقط" });
  if (!process.env.SUPABASE_URL || !sbKey()) return out(res, 503, { message: "الخادم غير مهيأ للنشر بعد." });
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return out(res, 401, { message: "سجّل الدخول أولًا." });
  const u = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_ANON_KEY || sbKey(), Authorization: "Bearer " + tok } });
  if (!u.ok) return out(res, 401, { message: "انتهت الجلسة؛ سجّل الدخول من جديد." });
  const user = await u.json();
  const q = await body(req), bid = String(q.b || "").slice(0, 80), p = parseInt(q.p, 10), t = String(q.t || "").replace(/\s+/g, " ").trim();
  if (!bid || !(p > 0) || t.length < 20) return out(res, 400, { message: "حدّد فقرة من الكتاب (عشرون حرفًا على الأقل)." });
  if (t.length > 1500) return out(res, 400, { message: "المختارة طويلة؛ الحد ١٥٠٠ حرف." });
  if (!CAT) CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "data/catalog.json"), "utf8"));
  const b = CAT.books.find(x => x.id === bid);
  if (!b) return out(res, 404, { message: "الكتاب غير موجود في المكتبة." });
  const origin = "https://" + (req.headers.host || "dawahlibrary.org"), sh = await shard(b, origin);
  if (!sh || !sh.pages) return out(res, 503, { message: "تعذر التحقق من نص الكتاب الآن." });
  // المقتبس يجب أن يكون من الصفحة نفسها (أو ممتدًا إلى التالية)
  const hay = norm((sh.pages[p - 1] || "") + " " + (sh.pages[p] || "")), needle = norm(t);
  if (!needle || !hay.includes(needle)) return out(res, 422, { message: "النشر مقصور على المختارات من الكتب: حدّد النص من صفحة الكتاب نفسها دون تغيير." });
  const au = (CAT.authors.find(a => a.id === b.authorId) || {}).name || "";
  const pl = sh.pl && sh.pl[p - 1] || "";
  let name = "عضو";
  try { const pg = await sb("member_pages?select=name&user_id=eq." + user.id); if (pg && pg[0]) name = pg[0].name; else name = (user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) || name; } catch (e) { }
  // حد بسيط لمنع الإغراق: عشرون مختارة في الساعة
  try { const since = new Date(Date.now() - 3600e3).toISOString(); const n = await sb("member_posts?select=id&user_id=eq." + user.id + "&created_at=gte." + since); if (n && n.length >= 20) return out(res, 429, { message: "بلغت حد النشر لهذه الساعة؛ حاول لاحقًا." }); } catch (e) { }
  const row = { user_id: user.id, user_name: name, body: "", quote: { b: bid, p, pl, t, title: b.setTitle || b.title, au } };
  try {
    const r = await sb("member_posts", { method: "POST", body: JSON.stringify(row) });
    try { const { notify, escH } = require("../lib/tg"); await notify(`📖 <b>مختارة جديدة</b> من ${escH(name)}\n«${escH(t.slice(0, 200))}${t.length > 200 ? "…" : ""}»\n— ${escH(row.quote.title)}`); } catch (e) { }
    return out(res, 200, { post: r[0] });
  }
  catch (e) { console.error("mpost", e.message); return out(res, 500, { message: "تعذر النشر الآن." }); }
};
