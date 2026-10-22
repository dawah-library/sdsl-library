// دالة خادم Vercel: «اسأل المكتبة»
// متغيرات البيئة المطلوبة في Vercel ← Settings ← Environment Variables:
//   GEMINI_API_KEY     مفتاح Google AI Studio المجاني (Gemini Flash) — يكفي وحده لتشغيل المساعد مجانًا
//   ANTHROPIC_API_KEY  مفتاح Anthropic (مدفوع، أدق للدراسات الطويلة) — إن وُجد يُقدَّم على Gemini
//   SDSL_PROVIDER      اختياري: anthropic أو gemini لفرض أحدهما
//   GEMINI_MODEL       اختياري، الافتراضي gemini-flash-latest
//   SUPABASE_URL و SUPABASE_ANON_KEY  (لقصر الخدمة على المستخدمين المسجلين)
//   SDSL_MODEL  (اختياري، الافتراضي claude-sonnet-5-5)
//   SDSL_HOURLY_LIMIT  (اختياري، عدد الأسئلة لكل عضو في الساعة، الافتراضي 30)
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
    try { const sh = JSON.parse(fs.readFileSync(path.join(root, "books", b.id + ".json"), "utf8")); b.pages = sh.pages; if (sh.pl) b.pl = sh.pl; if (sh.toc) b.toc = sh.toc; }
    catch (e) { console.warn("missing shard", b.id); }
  });
  // المقالات المستوردة: فهرس + ملفات شهرية (الأحدث أولًا، بحد أقصى للذاكرة)
  try {
    const idx = JSON.parse(fs.readFileSync(path.join(root, "articles", "index.json"), "utf8")).items || [];
    const byGroup = {}; idx.forEach(x => (byGroup[x.f] = byGroup[x.f] || []).push(x));
    let budget = +(process.env.SDSL_ARTICLES_MB || 120) * 1048576;
    for (const g of Object.keys(byGroup).sort().reverse()) {
      const p = path.join(root, "articles", g + ".json"); if (!fs.existsSync(p)) continue;
      const size = fs.statSync(p).size; if (size > budget) break; budget -= size;
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      byGroup[g].forEach(x => { if (data[x.id]) cat.books.push({ id: x.id, title: x.t, authorId: x.a, topicId: x.tp, date: x.d, type: "article", col: "dawah", pages: data[x.id].pages }); });
    }
  } catch (e) { /* لا توجد مقالات بعد */ }
  return (LIB = cat);
}
const PROVIDER = () => { const f = process.env.SDSL_PROVIDER; if (f === "gemini" && process.env.GEMINI_API_KEY) return "gemini"; if (f === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic"; return process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GEMINI_API_KEY ? "gemini" : ""; };
const hits = new Map(); // حد بسيط للطلبات في الذاكرة (يُستبدل بجدول عند التوسع)

function limited(key) {
  const now = Date.now(), win = 60 * 60 * 1000, max = +(process.env.SDSL_HOURLY_LIMIT || (PROVIDER() === "gemini" ? 12 : 30));
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


async function runAnthropic({ system, msgs, deep, maxRounds, budget, t0, send, toolLabel, runOne, used }) {
    for (let round = 0; round < maxRounds; round++) {
      const last = round === maxRounds - 1 || Date.now() - t0 > budget * 0.6;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.SDSL_MODEL || "claude-sonnet-5-5", max_tokens: deep ? 8000 : 3500, stream: true, system, messages: msgs, tools: last ? undefined : S.TOOLS })
      });
      if (!r.ok || !r.body) { console.error("anthropic", r.status, await r.text()); send({ t: "error", v: "تعذر الاتصال بخدمة الذكاء الاصطناعي." }); return true; }
      // قراءة بث Anthropic وإعادة بناء المحتوى
      const blocks = []; let stop = null, buf = "";
      const dec = new TextDecoder();
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let nl; while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.type === "content_block_start") { const cb = Object.assign({}, ev.content_block); if (cb.type === "tool_use") { cb.json = ""; cb.input = {}; } if (cb.type === "text") cb.text = ""; blocks[ev.index] = cb; }
          else if (ev.type === "content_block_delta") {
            const cb = blocks[ev.index]; if (!cb) continue;
            if (ev.delta.type === "text_delta") { cb.text += ev.delta.text; send({ t: "text", v: ev.delta.text }); }
            else if (ev.delta.type === "input_json_delta") cb.json += ev.delta.partial_json;
          }
          else if (ev.type === "content_block_stop") { const cb = blocks[ev.index]; if (cb && cb.type === "tool_use") { try { cb.input = cb.json ? JSON.parse(cb.json) : {}; } catch (e) { cb.input = {}; } delete cb.json; send({ t: "status", v: toolLabel(cb) }); } }
          else if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
          else if (ev.type === "error") { send({ t: "error", v: "انقطعت خدمة الذكاء الاصطناعي، أعد المحاولة." }); return true; }
        }
      }
      const content = blocks.filter(Boolean), calls = content.filter(c => c.type === "tool_use");
      if (stop !== "tool_use" || !calls.length) { send({ t: "done", searches: used }); return true; }
      send({ t: "reset" });
      msgs.push({ role: "assistant", content });
      msgs.push({ role: "user", content: calls.map(c => {
        let out;
        try { out = JSON.stringify(runOne(c.name, c.input)).slice(0, 30000); }
        catch (e) { return { type: "tool_result", tool_use_id: c.id, content: "Error: " + e.message, is_error: true }; }
        return { type: "tool_result", tool_use_id: c.id, content: out };
      }) });
      send({ t: "status", v: "يحلل ما وجده (" + used.length + " بحثًا حتى الآن)…" });
    }
  return false;
}

// Gemini (Google AI Studio) — له حصة مجانية يومية لنماذج Flash
const gTools = () => [{ functionDeclarations: S.TOOLS.map(t => ({ name: t.name, description: t.description, parameters: clean(t.input_schema) })) }];
function clean(sc) { const o = JSON.parse(JSON.stringify(sc)); (function f(x) { if (x && typeof x === "object") { if (Array.isArray(x.enum)) { x.enum = x.enum.filter(v => v !== ""); if (!x.enum.length) delete x.enum; } Object.values(x).forEach(f); } })(o); if (o.properties && !Object.keys(o.properties).length) delete o.properties; return o; }
async function runGemini({ system, msgs, deep, maxRounds, budget, t0, send, toolLabel, runOne, used }) {
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  let model = models.shift();
  let useQuery = false;
  const contents = msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  for (let round = 0; round < maxRounds; round++) {
    const last = round === maxRounds - 1 || Date.now() - t0 > budget * 0.6;
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":streamGenerateContent?alt=sse" + (useQuery ? "&key=" + encodeURIComponent(process.env.GEMINI_API_KEY) : ""), {
      method: "POST", headers: Object.assign({ "content-type": "application/json" }, useQuery ? {} : { "x-goog-api-key": process.env.GEMINI_API_KEY }),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: last ? undefined : gTools(), generationConfig: { maxOutputTokens: deep ? 8000 : 3500, temperature: 0.4 } })
    });
    if (!r.ok || !r.body) {
      const t = await r.text(); console.error("gemini", model, r.status, t.slice(0, 500));
      if ((r.status === 404 || r.status === 400 && /model/i.test(t)) && models.length) { model = models.shift(); round--; continue; }
      if ((r.status === 401 || r.status === 403) && !useQuery) { useQuery = true; round--; continue; }
      let gm = ""; try { const e = JSON.parse(t).error || {}; gm = (e.status || "") + " " + String(e.message || "").slice(0, 160); } catch (x) { gm = t.slice(0, 160); }
      send({ t: "error", code: r.status === 429 ? "quota" : "server", detail: "Gemini " + r.status + " " + gm.trim(), v: r.status === 429 ? "نفدت الحصة المجانية للمساعد مؤقتًا. جرّب بعد قليل أو غدًا." : r.status === 401 || r.status === 403 ? "مفتاح Gemini غير مقبول." : "تعذر الاتصال بخدمة الذكاء الاصطناعي." }); return true;
    }
    const parts = []; let buf = ""; const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let nl; while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
        const c = (ev.candidates || [])[0]; if (!c || !c.content) continue;
        for (const p of c.content.parts || []) {
          parts.push(p);
          if (p.text && !p.thought) send({ t: "text", v: p.text });
          if (p.functionCall) send({ t: "status", v: toolLabel({ name: p.functionCall.name, input: p.functionCall.args || {} }) });
        }
      }
    }
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) { send({ t: "done", searches: used }); return true; }
    send({ t: "reset" });
    contents.push({ role: "model", parts });
    contents.push({ role: "user", parts: calls.map(p => {
      const fc = p.functionCall; let result;
      try { result = runOne(fc.name, fc.args || {}); } catch (e) { result = { error: e.message }; }
      let txt = JSON.stringify(result); if (txt.length > 30000) result = { truncated: txt.slice(0, 30000) };
      return { functionResponse: Object.assign({ name: fc.name, response: { result } }, fc.id ? { id: fc.id } : {}) };
    }) });
    send({ t: "status", v: "يحلل ما وجده (" + used.length + " بحثًا حتى الآن)…" });
  }
  return false;
}

module.exports = async (req, res) => {
  // فحص سريع من المتصفح: /api/ask?check=1 (لا يكشف المفتاح)
  if (req.method === "GET" && /check=1/.test(req.url || "")) {
    const out = { provider: PROVIDER() || "none", gemini_key: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 3) + "… (" + process.env.GEMINI_API_KEY.length + ")" : "missing", anthropic_key: process.env.ANTHROPIC_API_KEY ? "set" : "missing", supabase: process.env.SUPABASE_URL ? "set" : "missing", tests: [] };
    if (process.env.GEMINI_API_KEY) {
      for (const m of [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest"].filter((x, i, a) => x && a.indexOf(x) === i)) {
        for (const how of ["header", "query"]) {
          try {
            const u = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent" + (how === "query" ? "?key=" + encodeURIComponent(process.env.GEMINI_API_KEY) : "");
            const r = await fetch(u, { method: "POST", headers: Object.assign({ "content-type": "application/json" }, how === "header" ? { "x-goog-api-key": process.env.GEMINI_API_KEY } : {}), body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "قل: نعم" }] }], generationConfig: { maxOutputTokens: 20 } }) });
            const t = await r.text(); let msg = ""; try { const j = JSON.parse(t); msg = j.error ? (j.error.status + " " + j.error.message).slice(0, 200) : "OK: " + (((j.candidates || [])[0] || {}).content || { parts: [{}] }).parts.map(p => p.text || "").join("").slice(0, 40); } catch (e) { msg = t.slice(0, 200); }
            out.tests.push({ model: m, auth: how, status: r.status, msg });
            if (r.ok) break;
          } catch (e) { out.tests.push({ model: m, auth: how, error: String(e.message || e) }); }
        }
        if (out.tests.some(t => t.status === 200)) break;
      }
    }
    const ok = out.tests.find(t => t.status === 200);
    const esc = x => String(x == null ? "" : x).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فحص المساعد</title><style>body{font-family:system-ui;padding:16px;line-height:1.8;background:#f2f5f1}td,th{border:1px solid #ccd;padding:6px;font-size:13px;direction:ltr;text-align:left}table{border-collapse:collapse;width:100%;background:#fff}.ok{color:#0a7a3d;font-weight:700}.no{color:#b3261e;font-weight:700}</style></head><body>
<h2>فحص اتصال المساعد</h2>
<p>المزوّد: <b>${esc(out.provider)}</b><br>مفتاح Gemini: <b>${esc(out.gemini_key)}</b><br>مفتاح Anthropic: ${esc(out.anthropic_key)}<br>Supabase: ${esc(out.supabase)}</p>
<p class="${ok ? "ok" : "no"}">${ok ? "✓ الاتصال بـ Gemini يعمل (" + esc(ok.model) + ")" : "✗ لم ينجح أي اتصال بـ Gemini"}</p>
<table><tr><th>model</th><th>auth</th><th>status</th><th>message</th></tr>${out.tests.map(t => `<tr><td>${esc(t.model)}</td><td>${esc(t.auth)}</td><td>${esc(t.status || "")}</td><td>${esc(t.msg || t.error)}</td></tr>`).join("")}</table></body></html>`;
    res.setHeader("content-type", "text/html; charset=utf-8"); res.setHeader("cache-control", "no-store");
    return res.status(200).end(html);
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  const provider = PROVIDER();
  if (!provider) return res.status(503).json({ code: "no_key", error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
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

    const deep = ["research", "compare", "gather", "summarize", "plan", "quiz"].includes(mode);
    const system = S.SYSTEM + "\n\nالمهمة: " + S.MODES[mode] +
      (scope.col ? "\nنطاق البحث: " + (scope.col === "turath" ? "كتب التراث فقط." : "كتب مشايخ الدعوة السلفية فقط.") : "") +
      (scope.bookId ? "\nنطاق البحث: كتاب واحد معرفه " + scope.bookId + "." : "");
    const msgs = turns.slice(), used = [], t0 = Date.now(), budget = (+process.env.SDSL_MAX_SECONDS || 240) * 1000;
    const maxRounds = provider === "gemini" ? (deep ? 7 : 5) : (deep ? 14 : 8);
    res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" });
    const send = o => res.write(JSON.stringify(o) + "\n");
    const toolLabel = c => c.name === "search_library" ? "يبحث في المكتبة عن: «" + (c.input.query || "") + "»" : c.name === "get_page" ? "يقرأ " + (c.input.ref || "") : c.name === "book_outline" ? "يطالع فهرس كتاب " + (c.input.book_id || "") : c.name === "list_authors" ? "يستعرض المؤلفين" : "يستعرض الكتب";
    const runOne = (name, input) => { const v = S.runTool(lib(), name, input, scope); if (name === "search_library") used.push(String(input.query || "")); return v; };
    send({ t: "status", v: "يفهم السؤال ويخطط للبحث…" });
    const ctx = { system, msgs, deep, maxRounds, budget, t0, send, toolLabel, runOne, used };
    const finished = provider === "gemini" ? await runGemini(ctx) : await runAnthropic(ctx);
    if (finished) return res.end();
    send({ t: "text", v: "تعذر إكمال الإجابة، جرّب سؤالًا أضيق." }); send({ t: "done", searches: used }); return res.end();
  } catch (e) {
    console.error(e);
    if (res.headersSent) { try { res.write(JSON.stringify({ t: "error", v: "خطأ في الخادم." }) + "\n"); } catch (x) {} return res.end(); }
    return res.status(500).json({ error: "خطأ في الخادم." });
  }
};
