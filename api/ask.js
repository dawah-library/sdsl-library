// «اسأل المكتبة» — وسيط خفيف بين المتصفح وGemini (الإصدار ٢، ٣٠ أكتوبر ٢٠٢٦).
// البحث في نصوص المكتبة يجري في المتصفح على الفهرس المقلوب (data/sx)، والخادم لا يحمّل شيئًا من النصوص:
// يتلقى المحادثة (بصيغة Gemini مع نتائج الأدوات)، ويضيف تعليمات المساعد وتعريف الأدوات من search.js،
// ويبث نص النموذج، أو يعيد طلبات الأدوات ليُنفذها المتصفح ثم يرسل جولة جديدة.
// متغيرات البيئة: GEMINI_API_KEY (مجاني من Google AI Studio)، GEMINI_MODEL اختياري،
// SUPABASE_URL وSUPABASE_ANON_KEY لقصر الخدمة على الأعضاء، SDSL_HOURLY_LIMIT (أسئلة العضو في الساعة، الافتراضي ٢٠).
// محرك ثانٍ: Claude من Anthropic (ANTHROPIC_API_KEY في متغيرات الخادم، وASK_CLAUDE_MODEL اختياري)؛ يعمل أولًا متى وُجد مفتاحه
// ومفتاح «ask_claude» غير موقوف، وGemini بديله عند تعذره. المحادثة تصل بصيغة Gemini وتُترجم هنا، ورد Claude الكامل
// (ومنه كتل التفكير) يُعاد إلى المتصفح جزءًا معتمًا {cl} ليُرسل كما هو في الجولة التالية.
require("../search.js");
const S = globalThis.SDSLSearch;
const hits = new Map();
function limited(id, first, lim) {
  const now = Date.now(), win = 36e5, max = +(lim || process.env.SDSL_HOURLY_LIMIT || 20), arr = (hits.get(id) || []).filter(t => now - t.at < win);
  const q = arr.filter(t => t.first).length, all = arr.length;
  if (first && q >= max) return true;
  if (all >= max * 10) return true;                     // جولات الأدوات كذلك محدودة
  arr.push({ at: now, first: !!first }); hits.set(id, arr); return false;
}
async function userFrom(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !tok) return null;
  try { const r = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } }); if (!r.ok) return null; const u = await r.json(); return u && u.id ? { id: u.id } : null; } catch (e) { return null; }
}
function clean(sc) { const o = JSON.parse(JSON.stringify(sc)); (function f(x) { if (x && typeof x === "object") { if (Array.isArray(x.enum)) { x.enum = x.enum.filter(v => v !== ""); if (!x.enum.length) delete x.enum; } Object.values(x).forEach(f); } })(o); if (o.properties && !Object.keys(o.properties).length) return undefined; return o; }
const TOOLS = () => [{ functionDeclarations: S.TOOLS.map(t => Object.assign({ name: t.name, description: t.description }, clean(t.input_schema) ? { parameters: clean(t.input_schema) } : {})) }];
// صيغة المحادثة الواردة من المتصفح: أدوار user/model وأجزاء text/functionCall/functionResponse فقط، بحدود للحجم
function sanitize(contents) {
  if (!Array.isArray(contents) || !contents.length || contents.length > 40) return null;
  let size = 0; const out = [];
  for (const c of contents) {
    if (!c || (c.role !== "user" && c.role !== "model") || !Array.isArray(c.parts)) return null;
    const parts = [];
    for (const p of c.parts.slice(0, 16)) {
      if (typeof p.text === "string") parts.push(Object.assign({ text: p.text.slice(0, 14000) }, p.thoughtSignature ? { thoughtSignature: String(p.thoughtSignature).slice(0, 20000) } : {}));
      else if (p.functionCall && typeof p.functionCall.name === "string") parts.push(Object.assign({ functionCall: { name: p.functionCall.name, args: p.functionCall.args || {} } }, p.functionCall.id ? {} : {}, p.thoughtSignature ? { thoughtSignature: String(p.thoughtSignature).slice(0, 20000) } : {}));
      else if (p.inlineData && c.role === "user" && /^(image\/(png|jpeg|webp|gif)|application\/pdf|audio\/[a-z0-9.+-]+|text\/plain)$/.test(String(p.inlineData.mimeType)) && typeof p.inlineData.data === "string" && p.inlineData.data.length < 9e6) parts.push({ inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } });
      else if (p.functionResponse && typeof p.functionResponse.name === "string") parts.push({ functionResponse: { name: p.functionResponse.name, response: p.functionResponse.response || {} } });
      else if (Array.isArray(p.cl) && c.role === "model" && JSON.stringify(p.cl).length < 300000) { const cl = p.cl.filter(b => b && ["text", "thinking", "redacted_thinking", "tool_use", "fallback"].includes(b.type)); if (cl.length) parts.push({ cl }); }
    }
    if (!parts.length) return null;
    size += JSON.stringify(parts).length; out.push({ role: c.role, parts });
  }
  if (size > 20e6 || out[0].role !== "user") return null;
  return out;
}
// ---------- Groq (مجاني، واجهة متوافقة مع OpenAI): بديل عن Gemini، ومراجع لغوي للجواب ----------
const GROQ_MODELS = () => (process.env.GROQ_MODELS || "openai/gpt-oss-120b,qwen/qwen3-32b,llama-3.3-70b-versatile").split(",").map(x => x.trim()).filter(Boolean);
async function groqChat(body, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 60000);
  try {
    for (const model of GROQ_MODELS()) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", signal: ac.signal, headers: { "content-type": "application/json", authorization: "Bearer " + process.env.GROQ_API_KEY }, body: JSON.stringify(Object.assign({ model }, body)) }).catch(() => null);
      if (r && r.ok) { const j = await r.json(); return (j.choices || [])[0] || null; }
      if (r) console.error("groq", model, r.status, (await r.text().catch(() => "")).slice(0, 160));
    }
  } finally { clearTimeout(t); }
  return null;
}
function toOpenAI(system, contents) {
  const msgs = [{ role: "system", content: system }]; let ids = [];
  contents.forEach((c, ci) => {
    const ps = c.parts.filter(p => !p.cl);
    if (c.role === "model") {
      const tc = ps.filter(p => p.functionCall).map((p, i) => ({ id: "c" + ci + "_" + i, type: "function", function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) } }));
      ids = tc.map(x => x.id); const text = ps.filter(p => p.text).map(p => p.text).join("");
      if (text || tc.length) msgs.push(Object.assign({ role: "assistant", content: text || null }, tc.length ? { tool_calls: tc } : {}));
    } else {
      let k = 0; ps.forEach(p => { if (p.text) msgs.push({ role: "user", content: p.text }); else if (p.functionResponse && ids[k]) msgs.push({ role: "tool", tool_call_id: ids[k++], content: JSON.stringify((p.functionResponse.response || {}).result ?? {}).slice(0, 20000) }); });
      ids = [];
    }
  });
  return msgs;
}
async function viaGroq(system, contents, body, deep, send) {
  const ch = await groqChat({ messages: toOpenAI(system, contents), tools: body.last ? undefined : CL_TOOLS().map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })), max_tokens: deep ? 8000 : 4000, temperature: 0.3 }, 90000);
  const m = ch && ch.message; if (!m) return false;
  if (m.content) send({ t: "text", v: m.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim() });
  const tc = (m.tool_calls || []).map(x => { let a = {}; try { a = JSON.parse(x.function.arguments || "{}"); } catch (e) { } return { name: x.function.name, args: a }; });
  if (tc.length) send({ t: "calls", calls: tc, parts: (m.content ? [{ text: m.content }] : []).concat(tc.map(c => ({ functionCall: c }))) });
  send({ t: "done", engine: "groq" }); return true;
}
// المراجعة اللغوية للجواب النهائي: تحسين الفصاحة والترقيم والتنسيق وحده؛ وتُرفض إن غيّرت نقلًا «…» أو رابطًا [[…]]
async function review(text) {
  if (!process.env.GROQ_API_KEY || text.length < 250 || !(await require("../lib/switch").on("ask_review"))) return null;
  const ch = await groqChat({ messages: [{ role: "system", content: "أنت مدقق لغوي عربي. حسّن لغة النص التالي: الفصاحة، وسلامة النحو والإملاء، وعلامات الترقيم، وتنسيق Markdown (العناوين والقوائم). لا تغيّر المعنى ولا الأحكام ولا الترتيب، ولا تحذف شيئًا ولا تضف معلومة. انقل كل ما بين «» وكل [[...]] وكل آية وحديث بلفظه حرفًا بحرف. أخرج النص المحسَّن وحده بلا مقدمة." }, { role: "user", content: text }], max_tokens: 6000, temperature: 0.1 }, 30000);
  let out = ch && ch.message && ch.message.content; if (!out) return null;
  out = out.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const keep = s => (s.match(/«[^»]{3,}»|\[\[[^\]]+\]\]|﴿[^﴾]+﴾/g) || []);
  if (keep(text).some(q => !out.includes(q)) || out.length < text.length * 0.8 || out.length > text.length * 1.3) return null;
  return out;
}
// Workers AI: صيغ بحث بديلة للسؤال الأول (مرادفات ومصطلحات) تُضاف إلى التعليمات
async function expand(q) {
  const AI = globalThis.__CF_AI; if (!AI || !q || !(await require("../lib/switch").on("ask_expand"))) return "";
  try {
    const run = AI.run(process.env.CF_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: "أعطِ ٥ صيغ بحث عربية قصيرة (مرادفات، ومصطلحات فقهية أو حديثية، وألفاظ قرآنية) تفيد في البحث عن جواب السؤال في كتب شرعية. سطر لكل صيغة، بلا ترقيم ولا شرح." }, { role: "user", content: q.slice(0, 600) }], max_tokens: 120 });
    const r = await Promise.race([run, new Promise(ok => setTimeout(() => ok(null), 5000))]);
    const t = String((r && (r.response || r.result && r.result.response)) || "").split("\n").map(x => x.replace(/^[-*\d.)\s]+/, "").trim()).filter(x => x && x.length < 60).slice(0, 5);
    return t.length ? "\nصيغ بحث مقترحة (استعن بها مع صيغك): " + t.join("، ") : "";
  } catch (e) { return ""; }
}

// ---------- Claude ----------
const CL_TOOLS = () => S.TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: clean(t.input_schema) || { type: "object", properties: {} } }));
// صيغة Gemini ← رسائل Claude: نص المستخدم، وطلبات الأدوات tool_use بمعرّفات ثابتة، ونتائجها tool_result بالترتيب نفسه
function toClaude(contents) {
  const msgs = []; let lastIds = [];
  contents.forEach((c, ci) => {
    if (c.role === "model") {
      const cl = c.parts.find(p => p.cl);
      const content = cl ? cl.cl : c.parts.map((p, pi) => p.text ? { type: "text", text: p.text } : p.functionCall ? { type: "tool_use", id: "g" + ci + "_" + pi, name: p.functionCall.name, input: p.functionCall.args || {} } : null).filter(Boolean);
      lastIds = content.filter(b => b.type === "tool_use").map(b => b.id);
      if (content.length) msgs.push({ role: "assistant", content });
    } else {
      let k = 0; const content = c.parts.map(p => p.inlineData ? (/^image\//.test(p.inlineData.mimeType) ? { type: "image", source: { type: "base64", media_type: p.inlineData.mimeType, data: p.inlineData.data } } : p.inlineData.mimeType === "application/pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.inlineData.data } } : null) : p.text ? { type: "text", text: p.text } : p.functionResponse && lastIds[k] ? { type: "tool_result", tool_use_id: lastIds[k++], content: JSON.stringify((p.functionResponse.response || {}).result ?? p.functionResponse.response ?? {}).slice(0, 30000) } : null).filter(Boolean);
      if (content.length) msgs.push({ role: "user", content });
      lastIds = [];
    }
  });
  return msgs;
}
let AnthropicCtor = null;
function claudeClient() { if (!AnthropicCtor) { const m = require("@anthropic-ai/sdk"); AnthropicCtor = m.default || m.Anthropic || m; } return new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 }); }
// يعيد true إن أجاب (أو أنهى الجولة)، وfalse إن تعذر قبل أي نص فيُجرَّب Gemini
async function viaClaude(system, contents, body, deep, send) {
  let sent = false;
  try {
    const stream = claudeClient().beta.messages.stream({
      model: process.env.ASK_CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: deep ? 32000 : 12000,
      system,
      messages: toClaude(contents),
      tools: body.last ? undefined : CL_TOOLS(),
      output_config: { effort: deep ? "high" : "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" && ev.delta.text) { sent = true; send({ t: "text", v: ev.delta.text }); }
    }
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") { if (!sent) return false; send({ t: "done" }); return true; }
    const uses = msg.content.filter(b => b.type === "tool_use");
    if (uses.length) {
      const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
      const parts = (text ? [{ text }] : []).concat(uses.map(b => ({ functionCall: { name: b.name, args: b.input || {} } })), [{ cl: msg.content }]);
      send({ t: "calls", calls: uses.map(b => ({ name: b.name, args: b.input || {} })), parts });
    }
    send({ t: "done", engine: "claude" });
    return true;
  } catch (e) {
    console.error("claude", e && (e.status || "") , e && e.message);
    if (sent) { send({ t: "done" }); return true; }
    return false;
  }
}


// ---------- إعدادات المساعد وصلاحيات الأعضاء (data/ask-config.json + profiles.role/perms) ----------
const SW = () => require("../lib/switch");
async function profileOf(req, user) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!user || !url) return { role: "guest", perms: [] };
  try { const r = await fetch(url + "/rest/v1/profiles?select=role,perms&id=eq." + encodeURIComponent(user.id), { headers: { apikey: key, Authorization: "Bearer " + tok } }); const j = r.ok ? await r.json() : []; return { role: (j[0] && j[0].role) || "member", perms: (j[0] && j[0].perms) || [] }; } catch (e) { return { role: "member", perms: [] }; }
}
const STAFF = r => /^(admin|partner|editor)$/.test(r);
function allowed(cfg, feat, prof, perm) { const v = ((cfg && cfg.features) || {})[feat] || "perm"; if (v === "off") return false; if (v === "all") return prof.role !== "guest" || feat === "stt"; if (STAFF(prof.role)) return true; if (v === "staff") return false; return (prof.perms || []).includes(perm); }
// تفريغ الصوت إلى نص (البحث الصوتي، وأسئلة المساعد المسجلة، والملفات الصوتية المرفوعة)
async function sttGemini(b64, mime, hint) {
  const prompt = "فرّغ الكلام العربي في هذا التسجيل حرفيًّا بدقة عالية، بالإملاء الصحيح للمصطلحات الشرعية والعلمية وأسماء الكتب والأعلام (مثل: صلى الله عليه وسلم، رضي الله عنه، ابن تيمية، صحيح البخاري). أخرج النص وحده بلا مقدمة." + (hint ? "\nسياق مساعد: " + String(hint).slice(0, 300) : "");
  for (const m of [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter(Boolean)) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0 } }) }).catch(() => null);
    if (r && r.ok) { const j = await r.json(); const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("").trim(); if (t) return t; }
  }
  return "";
}
// المصادر الخارجية: بحث Google المؤسَّس وقراءة الروابط (Gemini) مقصورًا على المواقع التي اختارها العضو أو أذنت بها الإدارة
async function webContext(q, web, cfg) {
  if (!process.env.GEMINI_API_KEY || !q) return "";
  const okDom = d => cfg.webAnyDomain || (cfg.webDomains || []).some(x => d === x || d.endsWith("." + x));
  const urls = (web.urls || []).filter(u => /^https?:\/\//.test(u)).slice(0, 5).filter(u => { try { return okDom(new URL(u).hostname.replace(/^www\./, "")); } catch (e) { return false; } });
  const sites = (web.sites || []).map(x => String(x).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]).filter(okDom).slice(0, 6);
  if (!urls.length && !sites.length) return "";
  const prompt = "ابحث عن جواب السؤال التالي في المصادر المحددة فقط، وانقل النصوص المهمة بألفاظها بين «» مع رابط كل نقل واسم الموقع، ثم ملخصًا قصيرًا. لا تضف من عندك.\nالسؤال: " + q.slice(0, 1500) + (sites.length ? "\nالمواقع: " + sites.map(x => "site:" + x).join(" OR ") : "") + (urls.length ? "\nالروابط: " + urls.join("\n") : "");
  try { const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.GEMINI_WEB_MODEL || "gemini-flash-latest") + ":generateContent", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }, { url_context: {} }], generationConfig: { temperature: 0.2, maxOutputTokens: 3000 } }) });
    if (!r.ok) return ""; const j = await r.json(), t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("").trim();
    return t ? "\n\nنتائج من مصادر خارجية اختارها العضو (ليست من المكتبة؛ إذا نقلت منها فاذكر اسم الموقع ورابطه صراحةً، ولا تحِلها بصيغة [[...]]، وميّزها عن نصوص المكتبة):\n" + t.slice(0, 12000) : ""; } catch (e) { return ""; }
}
const STYLE = { naql: "اعتمد على النقل: أكثر من النصوص المنقولة بألفاظها من الكتب مع الإحالة، وأقلّ من كلامك.", tahlil: "اعتمد على التحليل: انقل الشواهد الأساسية ثم حلّلها وبيّن وجه الدلالة.", istintaj: "اعتمد على الاستنتاج: استخلص النتائج والفوائد من النصوص بعد إيرادها، مع بيان أنها استنتاج.", mix: "وازن بين النقل والتحليل والاستنتاج." };
const FORM = { generated: "صُغ الجواب بأسلوبك العلمي الفصيح المتصل، مع الإحالات.", composed: "ركّب الجواب من النقول نفسها منسقةً بين عناوين وروابط قصيرة منك تربط بينها، دون إعادة صياغتها." };

module.exports = async (req, res) => {
  if (req.method === "POST" && await require("../lib/switch").stopped("ask", res, "المساعد العلمي")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) return res.status(503).json({ code: "no_key", error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const cfg = await SW().json("data/ask-config.json", { features: {} }) || { features: {} };
  if (body.op === "stt") {  // البحث الصوتي وأسئلة المساعد المسجلة
    const u0 = await userFrom(req), p0 = await profileOf(req, u0), ip = String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "ip").split(",")[0];
    if (!allowed(cfg, "stt", p0, "ask_vision")) return res.status(403).json({ error: "التفريغ الصوتي غير متاح." });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "لم يُضبط مفتاح التفريغ." });
    if (typeof body.audio !== "string" || body.audio.length > 14e6 || !/^audio\/|^video\/webm/.test(String(body.mime))) return res.status(400).json({ error: "ملف صوتي غير صالح (الحد نحو ١٠ ميجابايت)." });
    if (limited("stt:" + (u0 ? u0.id : ip), true)) return res.status(429).json({ error: "كثرت الطلبات، حاول بعد قليل." });
    const text = await sttGemini(body.audio, body.mime, body.hint).catch(() => "");
    return res.status(text ? 200 : 502).json(text ? { text } : { error: "تعذّر التفريغ" });
  }
  const contents = sanitize(body.contents);
  if (!contents) return res.status(400).json({ error: "محادثة غير صالحة أو طويلة جدًا؛ ابدأ محادثة جديدة." });
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام المساعد العلمي." });
  const prof = await profileOf(req, user);
  // المرفقات (صور وملفات وصوت): لمن أذنت له الإدارة؛ وإلا تُحذف ويُنبَّه
  let dropped = false; const visOk = allowed(cfg, "vision", prof, "ask_vision");
  if (!visOk) contents.forEach(c => { const n = c.parts.length; c.parts = c.parts.filter(p => !p.inlineData); if (c.parts.length < n) dropped = true; if (!c.parts.length) c.parts.push({ text: "(مرفق)" }); });
  const lim = (cfg.limits || {})[STAFF(prof.role) ? "staff" : (prof.perms || []).some(x => /^ask_/.test(x)) ? "perm" : "member"];
  if (limited(user.id, !body.round, lim)) return res.status(429).json({ error: "بلغت حد الأسئلة في الساعة، حاول بعد قليل." });
  const ENG = cfg.engines || {}, engine = allowed(cfg, "models", prof, "ask_models") && ["claude", "gemini", "groq"].includes(body.engine) && ENG[body.engine] !== false ? body.engine : (ENG[cfg.defaultEngine] !== false && cfg.defaultEngine !== "auto" ? cfg.defaultEngine : "auto");
  const mode = S.MODES[body.mode] ? body.mode : "ask", col = ["dawah", "turath"].includes(body.col) ? body.col : "", bookId = typeof body.bookId === "string" ? body.bookId.slice(0, 80) : "";
  const deep = ["research", "compare", "gather", "summarize", "plan", "quiz"].includes(mode);
  let system = S.SYSTEM + "\n\nالمهمة: " + S.MODES[mode] +
    (col ? "\nنطاق البحث: " + (col === "turath" ? "المكتبة العامة فقط." : "كتب مشايخ الدعوة السلفية بمصر ومقالاتهم وفتاواهم فقط.") : "") +
    (bookId ? "\nنطاق البحث: كتاب واحد معرفه " + bookId + "." : "") +
    "\nاليوم: " + new Date().toISOString().slice(0, 10) + ".";
  const st = body.style || {}; if (STYLE[st.basis]) system += "\nأسلوب الجواب: " + STYLE[st.basis]; if (FORM[st.form]) system += "\n" + FORM[st.form];
  system += "\nميّز في جوابك بين النقل (بين «» مع الإحالة) والتحليل والاستنتاج، ونسّق الجواب بعناوين وقوائم وجداول عند الحاجة، بعربية فصيحة سليمة النحو والإملاء." + (cfg.extra ? "\nتوجيه الإدارة: " + String(cfg.extra).slice(0, 2000) : "");
  if (contents.some(c => c.parts.some(p => p.inlineData))) system += "\nفي المحادثة مرفقات (صور أو ملفات أو صوت) من العضو: اقرأها وحلّلها بحسب سؤاله، وإن كانت نصًّا مصوّرًا فانقل نصه بدقة قبل التعليق عليه.";
  if (!body.round) { const lastQ = (contents[contents.length - 1].parts.find(x => x.text) || {}).text; system += await expand(lastQ);
    if (body.web && allowed(cfg, "web", prof, "ask_web")) system += await webContext(lastQ, body.web, cfg); }
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
  const send = o => res.write(JSON.stringify(o) + "\n");
  if (dropped) send({ t: "status", v: "تحليل المرفقات غير مفعّل لحسابك؛ أُرسل السؤال بلا مرفقات." });
  if (engine === "groq" && process.env.GROQ_API_KEY) { if (await viaGroq(system, contents, body, deep, send)) return res.end(); }
  if (engine !== "gemini" && engine !== "groq" && process.env.ANTHROPIC_API_KEY && await require("../lib/switch").on("ask_claude")) {
    if (await viaClaude(system, contents, body, deep, send)) return res.end();
    if (!process.env.GEMINI_API_KEY) { send({ t: "error", code: "server", v: "تعذر الاتصال بنموذج الذكاء الاصطناعي." }); return res.end(); }
    send({ t: "status", v: "يجرّب نموذجًا بديلًا…" });
  }
  // Gemini لا يعرف أجزاء Claude المعتمة: تُحذف، ويبقى ما يقابلها من نص وطلبات أدوات
  const gcontents = contents.map(c => ({ role: c.role, parts: c.parts.filter(p => !p.cl) })).filter(c => c.parts.length);
  for (let k = 0; k < models.length; k++) {
    let r;
    try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(models[k]) + ":streamGenerateContent?alt=sse", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: gcontents, tools: body.last ? undefined : TOOLS(), generationConfig: { maxOutputTokens: deep ? 8000 : 3500, temperature: 0.4 } })
      });
    } catch (e) { r = null; }
    if (!r || !r.ok || !r.body) {
      const st = r ? r.status : 0, t = r ? await r.text().catch(() => "") : "";
      if (k < models.length - 1 && (st === 429 || st >= 500 || st === 404 || !r)) { send({ t: "status", v: "يجرّب نموذجًا بديلًا…" }); continue; }
      if (process.env.GROQ_API_KEY && await require("../lib/switch").on("ask_groq")) { send({ t: "status", v: "يجرّب نموذجًا بديلًا…" }); if (await viaGroq(system, contents, body, deep, send)) return res.end(); }
      let gm = ""; try { const e = JSON.parse(t).error || {}; gm = (e.status || "") + " " + String(e.message || "").slice(0, 160); } catch (x) { gm = String(t).slice(0, 160); }
      send({ t: "error", code: st === 429 ? "quota" : "server", detail: "Gemini " + st + " " + gm.trim(), v: st === 429 ? "نفدت الحصة المجانية للمساعد مؤقتًا. جرّب بعد قليل." : "تعذر الاتصال بنموذج الذكاء الاصطناعي." });
      return res.end();
    }
    const parts = [], calls = []; let buf = ""; const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true }); let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue; let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
        const c = (ev.candidates || [])[0]; if (!c || !c.content) continue;
        for (const p of c.content.parts || []) { parts.push(p); if (p.text && !p.thought) send({ t: "text", v: p.text }); if (p.functionCall) calls.push({ name: p.functionCall.name, args: p.functionCall.args || {} }); }
      }
    }
    if (calls.length) send({ t: "calls", calls, parts: parts.filter(p => !p.thought || p.functionCall) });
    else { const full = parts.filter(p => p.text && !p.thought).map(p => p.text).join(""), rv = await review(full).catch(() => null); if (rv) send({ t: "replace", v: rv }); }
    send({ t: "done" });
    return res.end();
  }
  res.end();
};
