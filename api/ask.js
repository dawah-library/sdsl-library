// «اسأل المكتبة» — وسيط خفيف بين المتصفح وGemini (الإصدار ٢، ٣٠ أكتوبر ٢٠٢٦).
// البحث في نصوص المكتبة يجري في المتصفح على الفهرس المقلوب (data/sx)، والخادم لا يحمّل شيئًا من النصوص:
// يتلقى المحادثة (بصيغة Gemini مع نتائج الأدوات)، ويضيف تعليمات المساعد وتعريف الأدوات من search.js،
// ويبث نص النموذج، أو يعيد طلبات الأدوات ليُنفذها المتصفح ثم يرسل جولة جديدة.
// متغيرات البيئة: GEMINI_API_KEY (مجاني من Google AI Studio)، GEMINI_MODEL اختياري،
// SUPABASE_URL وSUPABASE_ANON_KEY لقصر الخدمة على الأعضاء، SDSL_HOURLY_LIMIT (أسئلة العضو في الساعة، الافتراضي ٢٠).
require("../search.js");
const S = globalThis.SDSLSearch;
const hits = new Map();
function limited(id, first) {
  const now = Date.now(), win = 36e5, max = +(process.env.SDSL_HOURLY_LIMIT || 20), arr = (hits.get(id) || []).filter(t => now - t.at < win);
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
      else if (p.functionResponse && typeof p.functionResponse.name === "string") parts.push({ functionResponse: { name: p.functionResponse.name, response: p.functionResponse.response || {} } });
    }
    if (!parts.length) return null;
    size += JSON.stringify(parts).length; out.push({ role: c.role, parts });
  }
  if (size > 400000 || out[0].role !== "user") return null;
  return out;
}
module.exports = async (req, res) => {
  if (req.method === "POST" && await require("../lib/switch").stopped("ask", res, "المساعد العلمي")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "no_key", error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const contents = sanitize(body.contents);
  if (!contents) return res.status(400).json({ error: "محادثة غير صالحة أو طويلة جدًا؛ ابدأ محادثة جديدة." });
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام المساعد العلمي." });
  if (limited(user.id, !body.round)) return res.status(429).json({ error: "بلغت حد الأسئلة في الساعة، حاول بعد قليل." });
  const mode = S.MODES[body.mode] ? body.mode : "ask", col = ["dawah", "turath"].includes(body.col) ? body.col : "", bookId = typeof body.bookId === "string" ? body.bookId.slice(0, 80) : "";
  const deep = ["research", "compare", "gather", "summarize", "plan", "quiz"].includes(mode);
  const system = S.SYSTEM + "\n\nالمهمة: " + S.MODES[mode] +
    (col ? "\nنطاق البحث: " + (col === "turath" ? "المكتبة العامة فقط." : "كتب مشايخ الدعوة السلفية بمصر ومقالاتهم وفتاواهم فقط.") : "") +
    (bookId ? "\nنطاق البحث: كتاب واحد معرفه " + bookId + "." : "") +
    "\nاليوم: " + new Date().toISOString().slice(0, 10) + ".";
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
  const send = o => res.write(JSON.stringify(o) + "\n");
  for (let k = 0; k < models.length; k++) {
    let r;
    try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(models[k]) + ":streamGenerateContent?alt=sse", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: body.last ? undefined : TOOLS(), generationConfig: { maxOutputTokens: deep ? 8000 : 3500, temperature: 0.4 } })
      });
    } catch (e) { r = null; }
    if (!r || !r.ok || !r.body) {
      const st = r ? r.status : 0, t = r ? await r.text().catch(() => "") : "";
      if (k < models.length - 1 && (st === 429 || st >= 500 || st === 404 || !r)) { send({ t: "status", v: "يجرّب نموذجًا بديلًا…" }); continue; }
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
    send({ t: "done" });
    return res.end();
  }
  res.end();
};
