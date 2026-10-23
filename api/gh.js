// دالة خادم Vercel: الحفظ في مستودع GitHub نيابة عن المشرفين المسجلين بحساباتهم، بلا مفتاح على أجهزتهم.
// متغيرات البيئة في Vercel:
//   GITHUB_WRITE_TOKEN  مفتاح GitHub (Fine-grained) بصلاحية Contents: Read and write على المستودع فقط
//   SUPABASE_URL و SUPABASE_ANON_KEY  للتحقق من أن صاحب الطلب مدير أو محرر
//   GITHUB_REPO (اختياري، الافتراضي dawah-library/sdsl-library)
const REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
const ALLOWED = /^\/(contents\/(data|vols|ocr-inbox|pdf|assets\/posts|assets\/authors|updates)\/[^?]+(\?ref=[\w.-]+)?)?$/;

async function staffOf(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !tok) return null;
  const u = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } });
  if (!u.ok) return null;
  const user = await u.json(); if (!user || !user.id) return null;
  const p = await fetch(url + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(user.id), { headers: { apikey: key, Authorization: "Bearer " + tok } });
  const rows = p.ok ? await p.json() : [];
  const role = rows[0] && rows[0].role;
  return /^(admin|editor)$/.test(role || "") ? { id: user.id, email: user.email, role } : null;
}

module.exports = async (req, res) => {
  try {
    if (!process.env.GITHUB_WRITE_TOKEN) return res.status(503).json({ message: "لم يُضبط مفتاح الحفظ (GITHUB_WRITE_TOKEN) على الخادم بعد." });
    const who = await staffOf(req);
    if (!who) return res.status(403).json({ message: "هذه العملية للمشرفين فقط. سجّل الدخول بحساب الإدارة." });
    const path = String((req.query && req.query.p) || new URL(req.url, "http://x").searchParams.get("p") || "");
    if (!ALLOWED.test(path)) return res.status(400).json({ message: "مسار غير مسموح." });
    if (!["GET", "PUT"].includes(req.method)) return res.status(405).json({ message: "طريقة غير مسموحة." });
    let body;
    if (req.method === "PUT") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      b.message = String(b.message || "تعديل من صفحة الإدارة") + "\n\nبواسطة: " + (who.email || who.id);
      body = JSON.stringify(b);
    }
    const accept = String(req.headers.accept || "").includes("raw") ? "application/vnd.github.raw+json" : "application/vnd.github+json";
    const r = await fetch("https://api.github.com/repos/" + REPO + path, {
      method: req.method, body,
      headers: { Authorization: "Bearer " + process.env.GITHUB_WRITE_TOKEN, Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", "User-Agent": "sdsl-library" }
    });
    const text = await r.text();
    res.setHeader("content-type", r.headers.get("content-type") || "application/json");
    res.setHeader("cache-control", "no-store");
    return res.status(r.status).end(text);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "خطأ في خادم الحفظ." });
  }
};
