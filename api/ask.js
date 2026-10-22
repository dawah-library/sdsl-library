// دالة خادم Vercel: «اسأل المكتبة»
// متغيرات البيئة المطلوبة في Vercel ← Settings ← Environment Variables:
//   ANTHROPIC_API_KEY  (إلزامي)
//   SUPABASE_URL و SUPABASE_ANON_KEY  (لقصر الخدمة على المستخدمين المسجلين)
//   SDSL_MODEL  (اختياري، الافتراضي claude-sonnet-5-5)
require("../search.js");
const fs = require("fs"), path = require("path");
const S = globalThis.SDSLSearch;
let LIB = null;
function lib() {
  if (LIB) return LIB;
  const root = path.join(process.cwd(), "data");
  const cat = JSON.parse(fs.readFileSync(path.join(root, "catalog.json"), "utf8"));
  cat.books.forEach(b => {
    if (b.demo) return;
    try { const sh = JSON.parse(fs.readFileSync(path.join(root, "books", b.id + ".json"), "utf8")); b.pages = sh.pages; if (sh.pl) b.pl = sh.pl; }
    catch (e) { console.warn("missing shard", b.id); }
  });
  return (LIB = cat);
}
const hits = new Map(); // حد بسيط للطلبات في الذاكرة (يُستبدل بجدول عند التوسع)

function limited(key) {
  const now = Date.now(), win = 60 * 60 * 1000, max = +(process.env.SDSL_HOURLY_LIMIT || 30);
  const arr = (hits.get(key) || []).filter(t => now - t < win);
  if (arr.length >= max) return true;
  arr.push(now); hits.set(key, arr); return false;
}

async function userFrom(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { id: "anon:" + (req.headers["x-forwarded-for"] || "ip").split(",")[0] };
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const r = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id } : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
  try {
    const user = await userFrom(req);
    if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام المحادثة." });
    if (limited(user.id)) return res.status(429).json({ error: "تجاوزت عدد الأسئلة المسموح في الساعة، حاول لاحقًا." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const mode = S.MODES[body.mode] ? body.mode : "ask";
    const scope = { col: ["dawah", "turath"].includes(body.col) ? body.col : "", bookId: typeof body.bookId === "string" ? body.bookId : "" };
    const turns = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
    if (!turns.length || turns[turns.length - 1].role !== "user") return res.status(400).json({ error: "رسالة غير صالحة" });
    while (turns[0].role !== "user") turns.shift();

    const system = S.SYSTEM + "\n\nالمهمة: " + S.MODES[mode] +
      (scope.col ? "\nنطاق البحث: " + (scope.col === "turath" ? "كتب التراث فقط." : "كتب مشايخ الدعوة السلفية فقط.") : "") +
      (scope.bookId ? "\nنطاق البحث: كتاب واحد معرفه " + scope.bookId + "." : "");
    const msgs = turns.slice();
    const used = [];
    for (let round = 0; round < 7; round++) {
      const last = round === 6;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.SDSL_MODEL || "claude-sonnet-5-5", max_tokens: 3000, system, messages: msgs, tools: last ? undefined : S.TOOLS })
      });
      if (!r.ok) { console.error("anthropic", r.status, await r.text()); return res.status(502).json({ error: "تعذر الاتصال بخدمة الذكاء الاصطناعي." }); }
      const out = await r.json();
      const calls = (out.content || []).filter(c => c.type === "tool_use");
      if (out.stop_reason !== "tool_use" || !calls.length) {
        const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
        return res.status(200).json({ text, searches: used });
      }
      msgs.push({ role: "assistant", content: out.content });
      msgs.push({ role: "user", content: calls.map(c => {
        let content;
        try { const v = S.runTool(lib(), c.name, c.input, scope); content = JSON.stringify(v).slice(0, 30000); if (c.name === "search_library") used.push(String(c.input.query || "")); }
        catch (e) { return { type: "tool_result", tool_use_id: c.id, content: "Error: " + e.message, is_error: true }; }
        return { type: "tool_result", tool_use_id: c.id, content };
      }) });
    }
    return res.status(200).json({ text: "تعذر إكمال الإجابة، جرّب سؤالًا أضيق.", searches: used });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "خطأ في الخادم." });
  }
};
