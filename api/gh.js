// دالة خادم Vercel: الحفظ في مستودع GitHub نيابة عن المشرفين المسجلين بحساباتهم، بلا مفتاح على أجهزتهم.
// متغيرات البيئة في Vercel:
//   GITHUB_WRITE_TOKEN  مفتاح GitHub (Fine-grained) بصلاحية Contents: Read and write على المستودع فقط
//   SUPABASE_URL و SUPABASE_ANON_KEY  للتحقق من أن صاحب الطلب مدير أو محرر
//   GITHUB_REPO (اختياري، الافتراضي dawah-library/sdsl-library)
const REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
const ALLOWED = /^\/(contents\/(data|vols|ocr-inbox|pdf|assets\/posts|assets\/authors|assets\/covers|updates)\/[^?]+(\?ref=[\w.-]+)?)?$/;

// المستودع عام: لا يُكتب بريد المشرف في رسائل الحفظ، بل صفته ومعرّف مختصر لا يكشف هويته
const ROLE_AR = w => (w.role === "admin" ? "مشرف" : w.role === "delegate" ? "مفوَّض" : "محرر") + " #" + String(w.id || "").slice(0, 6);
// صلاحيات التفويض (profiles.perms): العضو المفوَّض يكتب في مسارات خدمته فقط
const PERM_PATHS = { upload: /^(data\/books\/|data\/articles\/|ocr-inbox\/|pdf\/|data\/catalog\.json$)/, edit: /^(data\/books\/|data\/articles\/|vols\/|data\/catalog\.json$|data\/tashkeel\/)/, kurrasa: /^data\/kurrasa\//, tashjir: /^data\/tashjir\//, convert: /^(ocr-inbox\/|pdf\/|data\/review-requests\.json$|data\/tashkeel\/_queue\.json$|data\/transcribe\/_queue\.json$)/ };
const delegateOk = (who, p) => who.role !== "delegate" || who.perms.some(k => PERM_PATHS[k] && PERM_PATHS[k].test(String(p).replace(/^\/?contents\//, "").replace(/\?.*$/, "")));
async function staffOf(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !tok) return null;
  const u = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } });
  if (!u.ok) return null;
  const user = await u.json(); if (!user || !user.id) return null;
  const p = await fetch(url + "/rest/v1/profiles?select=role,perms&id=eq." + encodeURIComponent(user.id), { headers: { apikey: key, Authorization: "Bearer " + tok } });
  const rows = p.ok ? await p.json() : [];
  const role = rows[0] && rows[0].role === "partner" ? "admin" : rows[0] && rows[0].role;
  if (/^(admin|editor)$/.test(role || "")) return { id: user.id, email: user.email, role };
  const perms = ((rows[0] && rows[0].perms) || []).filter(k => PERM_PATHS[k]);
  return perms.length ? { id: user.id, email: user.email, role: "delegate", perms } : null;
}

const GHH = () => ({ Authorization: "Bearer " + process.env.GITHUB_WRITE_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "sdsl-library" });
async function gh(path, method, body) {
  const r = await fetch("https://api.github.com/repos/" + REPO + path, { method: method || "GET", headers: GHH(), body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || ("GitHub " + r.status)); e.status = r.status; throw e; }
  return j;
}
async function batch(req, res, who) {
  if (req.method !== "POST") return res.status(405).json({ message: "طريقة غير مسموحة." });
  const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const files = Array.isArray(b.files) ? b.files : [];
  if (!files.length || files.length > 60) return res.status(400).json({ message: "عدد الملفات بين ١ و٦٠ في الدفعة." });
  for (const f of files) {
    const p = String(f.path || "");
    if (!ALLOWED.test("/contents/" + p) || !delegateOk(who, p) || /(^|\/)\.\.(\/|$)/.test(p) || (typeof f.text !== "string" && typeof f.b64 !== "string"))
      return res.status(400).json({ message: "مسار غير مسموح: " + p });
  }
  const branch = String(b.branch || "main").replace(/[^\w.-]/g, "");
  const message = String(b.message || "حفظ دفعة من صفحة الإدارة") + "\n\nبواسطة: " + ROLE_AR(who);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ref = await gh("/git/ref/heads/" + branch), base = await gh("/git/commits/" + ref.object.sha);
      const tree = [];
      for (const f of files) {
        const blob = await gh("/git/blobs", "POST", typeof f.b64 === "string" ? { content: f.b64, encoding: "base64" } : { content: f.text, encoding: "utf-8" });
        tree.push({ path: String(f.path), mode: "100644", type: "blob", sha: blob.sha });
      }
      const t = await gh("/git/trees", "POST", { base_tree: base.tree.sha, tree });
      const c = await gh("/git/commits", "POST", { message, tree: t.sha, parents: [ref.object.sha] });
      await gh("/git/refs/heads/" + branch, "PATCH", { sha: c.sha, force: false });
      try { await require("../lib/tg").notify("🛠️ <b>حفظ من الإدارة</b>: " + require("../lib/tg").escH(String(b.message || "").split("\n")[0]) + " (" + files.length + " ملفات)\n" + require("../lib/tg").escH(who.email || ""), { quiet: true }); } catch (e) { }
      res.setHeader("cache-control", "no-store");
      return res.status(200).json({ ok: true, commit: c.sha, files: files.length });
    } catch (e) {
      if (e.status === 422 && attempt < 2) continue; // تقدّم الفرع أثناء الحفظ: أعد على الأحدث
      return res.status(e.status && e.status < 500 ? e.status : 502).json({ message: "تعذر الحفظ: " + e.message });
    }
  }
}

module.exports = async (req, res) => {
  try {
    if (!process.env.GITHUB_WRITE_TOKEN) return res.status(503).json({ message: "لم يُضبط مفتاح الحفظ (GITHUB_WRITE_TOKEN) على الخادم بعد." });
    const who = await staffOf(req);
    if (!who) return res.status(403).json({ message: "هذه العملية للمشرفين فقط. سجّل الدخول بحساب الإدارة." });
    // حفظ عدة ملفات في إيداع واحد (رفع المجلدات والكتب الكبيرة): ?batch=1 بطريقة POST
    // {message, files:[{path, text}|{path, b64}]} — كل مسار يُتحقق منه بالقائمة المسموحة نفسها، فلا يكتب خارجها
    if (new URL(req.url, "http://x").searchParams.get("batch") === "1") return batch(req, res, who);
    const path = String((req.query && req.query.p) || new URL(req.url, "http://x").searchParams.get("p") || "");
    if (!ALLOWED.test(path)) return res.status(400).json({ message: "مسار غير مسموح." });
    if (req.method === "PUT" && !delegateOk(who, path)) return res.status(403).json({ message: "صلاحيتك المفوَّضة لا تشمل هذا الملف." });
    if (!["GET", "PUT", "DELETE"].includes(req.method)) return res.status(405).json({ message: "طريقة غير مسموحة." });
    if (req.method === "DELETE" && who.role !== "admin") return res.status(403).json({ message: "الحذف النهائي للمدير وحده." });
    let body;
    if (req.method === "PUT" || req.method === "DELETE") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      b.message = String(b.message || "تعديل من صفحة الإدارة") + "\n\nبواسطة: " + ROLE_AR(who);
      body = JSON.stringify(b);
    }
    const accept = String(req.headers.accept || "").includes("raw") ? "application/vnd.github.raw+json" : "application/vnd.github+json";
    const r = await fetch("https://api.github.com/repos/" + REPO + path, {
      method: req.method, body,
      headers: { Authorization: "Bearer " + process.env.GITHUB_WRITE_TOKEN, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "sdsl-library" }
    });
    const text = await r.text();
    if ((req.method === "PUT" || req.method === "DELETE") && r.ok) {  // إشعار تليجرام بحفظ الإدارة (عدا أجزاء الملفات)
      const msg = String((JSON.parse(body).message || "")).split("\n")[0];
      if (!/\(جزء \d+\)|^رابط كتاب|^إعدادات كتاب/.test(msg)) {
        try { await require("../lib/tg").notify("🛠️ <b>حفظ من الإدارة</b>: " + require("../lib/tg").escH(msg) + "\n" + require("../lib/tg").escH(who.email || ""), { quiet: true }); } catch (e) { }
      }
    }
    res.setHeader("content-type", r.headers.get("content-type") || "application/json");
    res.setHeader("cache-control", "no-store");
    return res.status(r.status).end(text);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "خطأ في خادم الحفظ." });
  }
};
