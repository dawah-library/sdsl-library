// خدمة «التنسيق وإعادة الصياغة» للأعضاء: تدقيق لغوي، وتنسيق التفريغات، وإعادة صياغتها بأسلوب كتابي، مع الأمانة في المضمون.
// متغيرات البيئة: GEMINI_API_KEY، GEMINI_MODEL اختياري، SUPABASE_URL وSUPABASE_ANON_KEY (للأعضاء فقط)، SDSL_EDIT_HOURLY (الافتراضي ٢٠).
const hits = new Map();
function limited(id) {
  const now = Date.now(), max = +(process.env.SDSL_EDIT_HOURLY || 20), arr = (hits.get(id) || []).filter(t => now - t < 36e5);
  if (arr.length >= max) return true; arr.push(now); hits.set(id, arr); return false;
}
async function userFrom(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !tok) return null;
  try { const r = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } }); if (!r.ok) return null; const u = await r.json(); return u && u.id ? { id: u.id } : null; } catch (e) { return null; }
}
const RULES = "قواعد ملزمة: لا تضف معلومة ولا رأيًا ولا شرحًا من عندك، ولا تحذف شيئًا من المضمون، ولا تغيّر حكمًا أو ترجيحًا؛ والآيات والأحاديث والآثار بلفظها حرفًا بحرف. أخرج النص الناتج وحده بلا مقدمة ولا تعليق.";
const MODES = {
  proof: "دقّق النص التالي لغويًا: صحّح الأخطاء الإملائية والنحوية والصرفية وأخطاء الكتابة الظاهرة وعلامات الترقيم فقط، وأبقِ ألفاظ الكاتب وأسلوبه وترتيبه كما هي.",
  fmt: "نسّق النص التالي (وهو غالبًا تفريغ درس صوتي): صحّح أخطاء التفريغ الإملائية والنحوية، وضع علامات الترقيم، وقسّمه فقرات، وضع عنوانًا فرعيًا قصيرًا يبدأ بـ «# » عند الانتقال إلى مسألة جديدة، واحذف الحشو الكلامي (يعني، طيب، إيه…) والتكرار اللفظي المتتابع؛ مع إبقاء ألفاظ المتكلم وأسلوبه.",
  rw: "أعد صياغة النص التالي (وهو غالبًا تفريغ درس صوتي) بعربية فصيحة متصلة بأسلوب كتابي كأنه مقال، مع عناوين فرعية تبدأ بـ «# » عند الانتقال إلى مسألة جديدة، وحذف ما لا يناسب الكتابة من النداءات والتكرار والاستطراد الشفهي، دون زيادة أو نقص في المعنى.",
  short: "اختصر النص التالي إلى نحو ثلثه بعبارات قريبة جدًا من ألفاظ الكاتب، بسياقة متصلة سليمة، مع الإبقاء على المسائل كلها بترتيبها."
};
module.exports = async (req, res) => {
  if (req.method === "POST" && await require("../lib/switch").stopped("edit", res, "التنسيق وإعادة الصياغة")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const mode = MODES[body.mode] ? body.mode : "", text = String(body.text || "").trim();
  if (!mode) return res.status(400).json({ error: "اختر نوع الخدمة." });
  if (text.length < 20) return res.status(400).json({ error: "النص قصير جدًا." });
  if (text.length > 12000) return res.status(400).json({ error: "الحد ١٢٠٠٠ حرف في المرة الواحدة؛ قسّم النص." });
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام الخدمة." });
  if (limited(user.id)) return res.status(429).json({ error: "بلغت حد الاستخدام في الساعة، حاول بعد قليل." });
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  for (let k = 0; k < models.length; k++) {
    let r; try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(models[k]) + ":generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: "أنت محرر لغوي متقن للنصوص الشرعية العربية. " + RULES } ] }, contents: [{ role: "user", parts: [{ text: MODES[mode] + "\n\nالنص:\n" + text }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 12000 } })
      });
    } catch (e) { r = null; }
    if (!r || !r.ok) { if (k < models.length - 1) continue; return res.status(r && r.status === 429 ? 429 : 502).json({ error: r && r.status === 429 ? "نفدت الحصة المجانية مؤقتًا. جرّب بعد قليل." : "تعذر الاتصال بالخدمة الآن." }); }
    const j = await r.json(), out = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (!out) { if (k < models.length - 1) continue; return res.status(502).json({ error: "لم يرجع النموذج نصًا." }); }
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ text: out, mode });
  }
};
