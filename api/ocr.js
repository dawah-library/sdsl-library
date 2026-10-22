// دالة خادم Vercel: تحويل صورة صفحة كتاب إلى نص بالذكاء الاصطناعي (OCR)
// تُستدعى من الإدارة ← «تحويل المصور إلى نص» عند اختيار «بالذكاء الاصطناعي».
// تحتاج ANTHROPIC_API_KEY. وعند ضبط SUPABASE_URL و SUPABASE_ANON_KEY تُقصر على المشرفين.
const PROMPT = [
  "هذه صورة صفحة من كتاب عربي. انسخ نصها حرفيًا كما هو، دون شرح أو تعليق أو مقدمة.",
  "- احفظ التشكيل وعلامات الترقيم والأقواس كما في الصورة، ولا تصحح شيئًا ولا تُكمل كلمة مقطوعة.",
  "- اجعل كل فقرة في سطر مستقل.",
  "- اكتب العناوين في سطر يبدأ بـ «# ».",
  "- تجاهل ترويسة الصفحة المتكررة ورقمها.",
  "- إن كان في الصفحة حواشٍ فاكتبها في آخرها بعد سطر فيه «____».",
  "- إن كانت الصفحة فارغة فأعد كلمة: فارغة"
].join("\n");

async function staffFrom(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { id: "anon" };
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const h = { apikey: key, Authorization: "Bearer " + tok };
  const u = await fetch(url + "/auth/v1/user", { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  const r = await fetch(url + "/rest/v1/profiles?select=role&id=eq." + encodeURIComponent(user.id), { headers: h });
  const rows = r.ok ? await r.json() : [];
  return rows[0] && ["admin", "editor"].includes(rows[0].role) ? { id: user.id } : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد؛ استخدم التحويل المجاني أو فعّل المفتاح." });
  try {
    if (!(await staffFrom(req))) return res.status(401).json({ error: "التحويل بالذكاء الاصطناعي متاح للمشرفين فقط." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ""));
    if (!m) return res.status(400).json({ error: "صورة غير صالحة" });
    if (m[2].length > 6_000_000) return res.status(413).json({ error: "الصورة كبيرة جدًا" });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.SDSL_OCR_MODEL || process.env.SDSL_MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } }, { type: "text", text: PROMPT }] }]
      })
    });
    if (!r.ok) { console.error("anthropic", r.status, await r.text()); return res.status(502).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." }); }
    const out = await r.json();
    let text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
    if (text === "فارغة") text = "";
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "خطأ في الخادم." });
  }
};
