// خدمة «التنسيق وإعادة الصياغة» للأعضاء: تدقيق لغوي، وتنسيق التفريغات، وإعادة صياغتها بأسلوب كتابي، مع الأمانة في المضمون؛ والتشكيل الدقيق (كامل أو جزئي) بضمان عدم تغيير الحروف.
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
// التشكيل الدقيق (المرحلة ٣-ه): جولة تشكيل ثم جولة تدقيق مستقلة، ولا يُقبل من النموذج إلا الحركات (lib/harakat.js)
const TK1 = "أنت عالم بالعربية متقن للنحو والصرف والدلالة. شكّل النص الآتي تشكيلًا تامًّا صحيحًا: اضبط أواخر الكلمات بحسب إعرابها في سياقها، وبنية الكلمات بحسب معناها في الجملة (ميّز ما يختلف ضبطه باختلاف المعنى، والمبني للمعلوم من المبني للمجهول)، وضع الشدة والتنوين، وهمزات الوصل بلا حركة، والأعلام بضبطها المشهور. لا تغيّر أي حرف ولا كلمة ولا علامة ترقيم ولا ترتيبًا، ولا تضف ولا تحذف، ولا تصحح الإملاء، وما كان مشكولًا في الأصل (الآيات والأحاديث المضبوطة) اتركه بضبطه. أعد النص المشكول وحده بلا شرح.\n\nالنص:\n";
const TK2 = "أنت مدقق نحوي وصرفي خبير. فيما يلي نص مشكول آليًّا: راجع تشكيله كلمةً كلمة وصحح كل خطأ في الإعراب أو ضبط البنية أو الشدة والتنوين بحسب السياق والمعنى. لا تغيّر حرفًا ولا كلمة ولا علامة ترقيم، ولا تضف ولا تحذف. أعد النص كاملًا مشكولًا بلا شرح.\n\nالنص:\n";
async function gem(models, sys, prompt) {
  for (let k = 0; k < models.length; k++) {
    let r; try {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(models[k]) + ":generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 16000 } })
      });
    } catch (e) { r = null; }
    if (!r || !r.ok) { if (k < models.length - 1) continue; const e = new Error(r && r.status === 429 ? "نفدت الحصة المجانية مؤقتًا. جرّب بعد قليل." : "تعذر الاتصال بالخدمة الآن."); e.status = r && r.status === 429 ? 429 : 502; throw e; }
    const j = await r.json(), out = ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (out) return out; if (k === models.length - 1) { const e = new Error("لم يرجع النموذج نصًا."); e.status = 502; throw e; }
  }
}
// المقارنة العلمية بين الكتب (المرحلة ٣-ج): المادة يجمعها المتصفح من نصوص الكتب بوسوم [كتاب:صفحة]، والإحالات تُقبل منها وحدها
const CMP = `أنت باحث شرعي محقق يقارن بين كتب بدقة وأمانة. أمامك مادة من {n} كتب، وكل مقطع يبدأ بوسم موضعه [المعرف:الصفحة].
المحاور المطلوبة: {axes}.{topic}
القواعد: لا تنسب إلى مؤلف إلا ما في مادته، ولا تخترع موقفًا لم يرد؛ وإن لم يتناول كتاب مسألة فقل ذلك صراحة. انقل المصطلحات بلفظها، وميّز بين قول المؤلف وما نقله عن غيره. الإحالات من الوسوم الواردة في المادة فقط بالصيغة "المعرف:الصفحة".
أخرج JSON فقط: {"summary": "خلاصة المقارنة في ٣–٥ جمل", "axes": [{"axis": "اسم المحور", "agree": [{"point": "وجه الاتفاق", "refs": ["id:p"]}], "differ": [{"point": "موضع الاختلاف", "views": [{"book": "معرف الكتاب", "view": "موقفه أو معالجته بإيجاز", "refs": ["id:p"]}]}]}], "notes": "ملحوظات منهجية أو حدود المادة"}

{books}`;
async function compare(req, res, body) {
  const books = (Array.isArray(body.books) ? body.books : []).slice(0, 6).map(b => ({ id: String(b.id || "").slice(0, 60), title: String(b.title || "").slice(0, 200), author: String(b.author || "").slice(0, 120), died: String(b.died || "").slice(0, 10), text: String(b.text || "").slice(0, 30000) }));
  if (books.length < 2) return res.status(400).json({ error: "اختر كتابين على الأقل." });
  const total = books.reduce((n, b) => n + b.text.length, 0); if (total > 60000) return res.status(400).json({ error: "المادة أكبر من الحد؛ قلّل عدد الكتب." });
  const user = await userFrom(req); if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام الخدمة." });
  if (limited(user.id)) return res.status(429).json({ error: "بلغت حد الاستخدام في الساعة، حاول بعد قليل." });
  const axes = (Array.isArray(body.axes) ? body.axes : []).map(x => String(x).slice(0, 80)).slice(0, 8), topic = String(body.topic || "").slice(0, 200);
  const prompt = CMP.replace("{n}", books.length).replace("{axes}", axes.join("، ") || "مقارنة عامة شاملة").replace("{topic}", topic ? `\nالمسألة المتتبَّعة: «${topic}» — قارن معالجة كل كتاب لها وفق المحاور.` : "")
    .replace("{books}", books.map(b => `=== الكتاب ${b.id}: «${b.title}» — ${b.author}${b.died ? " (ت " + b.died + "هـ)" : ""} ===\n${b.text}`).join("\n\n"));
  const models = [process.env.GEMINI_COMPARE_MODEL, "gemini-pro-latest", process.env.GEMINI_MODEL, "gemini-flash-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  let out; try { out = await gem(models, "أنت باحث علمي أمين، تخرج JSON صحيحًا فقط.", prompt); } catch (e) { return res.status(e.status || 502).json({ error: e.message }); }
  let r; try { r = JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (e) { return res.status(502).json({ error: "تعذر تنظيم النتيجة؛ أعد المحاولة." }); }
  const ok = new Set(), ids = new Set(books.map(b => b.id)); books.forEach(b => (b.text.match(/\[[^\]:\s]+:\d+\]/g) || []).forEach(t => ok.add(t.slice(1, -1))));
  const fr = a => (Array.isArray(a) ? a : []).map(String).filter(x => ok.has(x)).slice(0, 6);  // إحالة لم ترد في المادة تُحذف
  r.axes = (Array.isArray(r.axes) ? r.axes : []).map(a => ({ axis: String(a.axis || ""), agree: (a.agree || []).map(x => ({ point: String(x.point || ""), refs: fr(x.refs) })), differ: (a.differ || []).map(x => ({ point: String(x.point || ""), views: (x.views || []).filter(v => ids.has(String(v.book))).map(v => ({ book: String(v.book), view: String(v.view || ""), refs: fr(v.refs) })) })) }));
  res.setHeader("cache-control", "no-store");
  return res.status(200).json({ result: { summary: String(r.summary || ""), axes: r.axes, notes: String(r.notes || "") } });
}
// ElevenLabs لإدارة الصوتيات (المرحلة ٥): قائمة الأصوات والنماذج، وحالة الباقة، وعينة قصيرة — للمشرفين وحدهم، والمفتاح في الخادم فقط
const EL_MODELS = [["eleven_multilingual_v2", "Multilingual v2 — الأدق والأثبت للكتب الطويلة (١ رصيد/حرف)"], ["eleven_v3", "Eleven v3 — الأكثر تعبيرًا وأداءً (١ رصيد/حرف، أقل ثباتًا في النصوص الطويلة)"],
  ["eleven_turbo_v2_5", "Turbo v2.5 — توازن الجودة والسرعة (٠٫٥ رصيد/حرف)"], ["eleven_flash_v2_5", "Flash v2.5 — الأسرع والأرخص للمعاينات (٠٫٥ رصيد/حرف)"]];
async function staff(req) {
  const u = await userFrom(req); if (!u) return null; const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try { const r = await fetch(url + "/rest/v1/profiles?id=eq." + u.id + "&select=role,perms", { headers: { apikey: key, Authorization: "Bearer " + tok } }); const [p] = await r.json();
    return p && (["admin", "partner"].includes(p.role) || (p.role === "editor" && (p.perms || []).some(x => /audio|radio/.test(x)))) ? u : null; } catch (e) { return null; }
}
async function eleven(req, res, body) {
  const key = process.env.ELEVENLABS_API_KEY; if (!key) return res.status(503).json({ error: "لم يُضبط مفتاح ElevenLabs على الخادم (ELEVENLABS_API_KEY)." });
  const u = await staff(req); if (!u) return res.status(403).json({ error: "لإدارة الصوتيات فقط." });
  const H = { "xi-api-key": key, "content-type": "application/json" }, op = String(body.op || "");
  try {
    if (op === "status") { const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: H }), j = await r.json(); return res.status(r.ok ? 200 : 502).json({ tier: j.tier, used: j.character_count, limit: j.character_limit, reset: j.next_character_count_reset_unix, models: EL_MODELS }); }
    if (op === "voices") { const r = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=false", { headers: H }), j = await r.json();
      return res.status(r.ok ? 200 : 502).json({ voices: (j.voices || []).map(v => ({ id: v.voice_id, name: v.name, cat: v.category, lang: ((v.labels || {}).language || (v.verified_languages || []).map(x => x.language).join(",") || ""), accent: (v.labels || {}).accent || "", gender: (v.labels || {}).gender || "", desc: (v.labels || {}).description || v.description || "", preview: v.preview_url })), models: EL_MODELS }); }
    if (op === "preview") {
      if (limited("el:" + u.id)) return res.status(429).json({ error: "بلغت حد المعاينات في الساعة." });
      const text = String(body.text || "").slice(0, 400), vid = String(body.voice || "").replace(/[^\w]/g, ""), o = body.settings || {}; if (!text || !vid) return res.status(400).json({ error: "النص والصوت مطلوبان." });
      const model = EL_MODELS.some(m => m[0] === o.model) ? o.model : "eleven_flash_v2_5";
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + vid + "?output_format=mp3_44100_64", { method: "POST", headers: H, body: JSON.stringify({ text, model_id: model, ...(model.includes("v2_5") ? { language_code: "ar" } : {}), voice_settings: { stability: +o.stability || 0.55, similarity_boost: +o.similarity || 0.8, style: +o.style || 0, speed: +o.speed || 1, use_speaker_boost: o.boost !== false } }) });
      if (!r.ok) return res.status(502).json({ error: "ElevenLabs: " + (await r.text()).slice(0, 200) });
      const buf = new Uint8Array(await r.arrayBuffer()); let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      res.setHeader("cache-control", "no-store"); return res.status(200).json({ audio: "data:audio/mpeg;base64," + btoa(bin), chars: text.length, model });
    }
    return res.status(400).json({ error: "عملية غير معروفة" });
  } catch (e) { return res.status(502).json({ error: "تعذر الاتصال بـElevenLabs." }); }
}
module.exports = async (req, res) => {
  if (req.method === "POST" && await require("../lib/switch").stopped("edit", res, "التنسيق وإعادة الصياغة")) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST فقط" });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "لم يُضبط مفتاح الذكاء الاصطناعي على الخادم بعد." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  if (body.mode === "compare") return compare(req, res, body);
  if (body.mode === "eleven") return eleven(req, res, body);
  const mode = MODES[body.mode] || body.mode === "tashkeel" ? body.mode : "", text = String(body.text || "").trim();
  if (!mode) return res.status(400).json({ error: "اختر نوع الخدمة." });
  if (text.length < 20) return res.status(400).json({ error: "النص قصير جدًا." });
  if (text.length > 12000) return res.status(400).json({ error: "الحد ١٢٠٠٠ حرف في المرة الواحدة؛ قسّم النص." });
  const user = await userFrom(req);
  if (!user) return res.status(401).json({ error: "سجّل الدخول لاستخدام الخدمة." });
  if (limited(user.id)) return res.status(429).json({ error: "بلغت حد الاستخدام في الساعة، حاول بعد قليل." });
  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
  if (mode === "tashkeel") {
    const H = require("../lib/harakat");
    try {
      const sys = "أنت عالم بالعربية ونحوها وصرفها، تضبط النصوص الشرعية والحديثية واللغوية والأدبية ضبطًا دقيقًا دون أن تغيّر حرفًا منها.";
      const one = H.transfer(text, await gem(models, sys, TK1 + text));
      let fin = one; try { const two = H.transfer(text, await gem(models, sys, TK2 + one.text)); if (two.cover >= one.cover * 0.95) fin = two; } catch (e) { }  // جولة التدقيق اختيارية إن نفدت الحصة
      res.setHeader("cache-control", "no-store");
      return res.status(200).json({ text: body.part ? H.partial(fin.text, text) : fin.text, mode, cover: Math.round(fin.cover * 100) });
    } catch (e) { return res.status(e.status || 502).json({ error: e.message }); }
  }
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
