// دالة الترجمة: ترجمة صفحات الكتب والمقالات والفتاوى بالذكاء الاصطناعي لعرضها داخل صفحة القراءة (نظام الترجمة #/translate).
// الطلب: GET /api/translate?id=<كتاب>&p=<رقم الصفحة>&l=<رمز اللغة>&f=2  ← ترجمة منظَّمة (lib/trcore.js): متن وحواشٍ،
//   والآيات والأحاديث بنصها العربي الأصلي مع ترجمة معانيها. وPOST ?op=fb: بلاغ عضو عن خطأ في ترجمة (data/tr/_feedback.json).
// النتيجة تُخزَّن في شبكة التوزيع سنة، والترجمات المعتمدة والمسبقة محفوظة في المستودع data/tr/<اللغة>/<الكتاب>.json.
const fs = require("../lib/fs"), path = require("path");
const TRC = require("../lib/trcore");
const ROOT = process.cwd();
const LANGS0 = { en: "English", fr: "French", es: "Spanish", tr: "Turkish", de: "German", "zh-CN": "Simplified Chinese", ru: "Russian", ur: "Urdu", hi: "Hindi", id: "Indonesian", ms: "Malay", bn: "Bengali", fa: "Persian", sw: "Swahili", ha: "Hausa" };
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
async function trCfg() {
  const c = await require("../lib/switch").json("data/tr-config.json", null);
  if (c && Array.isArray(c.langs) && c.langs.length) return c;
  return { langs: Object.entries(LANGS0).map(([k, llm]) => ({ k, llm, n: llm, on: true })), glossary: {} };
}
let AIDX = null;
let CAT = null;

async function pageText(id, p, origin) {
  if (!CAT) CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "data/catalog.json"), "utf8"));
  let b = CAT.books.find(x => x.id === id), sh = null;
  // المقالات والفتاوى والبيانات: نصها في مجموعات data/articles/<f>.json بحسب فهرسها
  if (!b || b.type === "article") {
    try { if (!AIDX) AIDX = (await (await fetch(origin + "/data/articles/index.json")).json()).items || []; } catch (e) { AIDX = null; }
    const x = (AIDX || []).find(y => y.id === id);
    if (!x) return null;
    b = b || { id, title: x.t, authorId: x.a, type: "article", size: 0 }; b.fa = b.fa || x.fa; b.c = b.c || x.c;
    try { const g = await (await fetch(origin + "/data/articles/" + encodeURIComponent(x.f) + ".json")).json(); sh = g[id]; } catch (e) { }
  } else {
    if (!b.vf) { try { sh = JSON.parse(fs.readFileSync(path.join(ROOT, "data/books", id + ".json"), "utf8")); } catch (e) { } }
    if (!sh) { try { const r = await fetch((b.vf ? "https://raw.githubusercontent.com/" + (process.env.GITHUB_REPO || "dawah-library/sdsl-library") + "/main/vols/" : origin + "/data/books/") + encodeURIComponent(id) + ".json"); if (r.ok) sh = await r.json(); } catch (e) { } }
  }
  const t = sh && sh.pages && sh.pages[p - 1];
  return t == null ? null : { b, text: String(t) };
}
const kindOf = b => b.sharh ? "sharh" : b.type !== "article" ? "book" : (b.fa || /^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c || "")) ? "fatwa" : /بيان/.test(b.c || b.title || "") ? "statement" : "article";
const authorName = id => { try { return ((CAT.authors || []).find(a => a.id === id) || {}).name || ""; } catch (e) { return ""; } };

// بلاغ عضو عن خطأ في الترجمة: يُلحق بـ data/tr/_feedback.json (يراجعه فريق الترجمة في #/translate)
async function feedback(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ message: "POST فقط" });
  const b = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const id = String(b.id || "").slice(0, 80), l = String(b.l || "").slice(0, 8), p = parseInt(b.p, 10) || 0, msg = String(b.msg || "").trim().slice(0, 1500), sug = String(b.sug || "").trim().slice(0, 3000);
  if (!/^[\w.-]+$/.test(id) || !/^[a-zA-Z-]{2,8}$/.test(l) || !(p > 0) || msg.length < 3) return res.status(400).json({ message: "اكتب وصف الخطأ" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let uid = "";
  try { if (url && key && tok) { const r = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + tok } }); if (r.ok) uid = ((await r.json()) || {}).id || ""; } } catch (e) { }
  if (!uid) return res.status(401).json({ message: "سجّل الدخول لإرسال البلاغ" });
  const { limited } = require("../lib/rate");
  if (limited(req, "trfb", 10, 60 * 60e3)) return res.status(429).json({ message: "بلاغات كثيرة، حاول لاحقًا" });
  const tokGh = process.env.GITHUB_WRITE_TOKEN, REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
  if (!tokGh) return res.status(503).json({ message: "الخدمة غير متاحة الآن" });
  const H = { Authorization: "Bearer " + tokGh, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "sdsl-library" }, P = "https://api.github.com/repos/" + REPO + "/contents/data/tr/_feedback.json";
  for (let t = 0; t < 3; t++) {
    let sha = null, o = { v: 1, items: [] };
    const g = await fetch(P, { headers: H }); if (g.ok) { const j = await g.json(); sha = j.sha; try { o = JSON.parse(Buffer.from(j.content, "base64").toString("utf8")); } catch (e) { } }
    o.items = (o.items || []).concat([{ id, l, p, msg, sug, u: uid.slice(0, 8), at: new Date().toISOString().slice(0, 16), st: "new" }]).slice(-500);
    const r = await fetch(P, { method: "PUT", headers: H, body: JSON.stringify({ message: "بلاغ ترجمة: " + id + " ص " + p + " (" + l + ")", content: Buffer.from(JSON.stringify(o, null, 1)).toString("base64"), sha: sha || undefined }) });
    if (r.ok) return res.status(200).json({ ok: true });
    if (r.status !== 409 && r.status !== 422) break;
  }
  return res.status(502).json({ message: "تعذّر حفظ البلاغ الآن" });
}

async function gemini(prompt) {
  let last = "";
  for (const m of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } })
      });
      if (!r.ok) { last = m + " " + r.status; console.error("translate", last, (await r.text()).slice(0, 200)); continue; }
      const j = await r.json();
      const out = (((j.candidates || [])[0] || {}).content || {}).parts;
      const t = (out || []).map(x => x.text || "").join("").trim();
      if (t) return t;
    } catch (e) { last = m + " " + e.message; }
  }
  throw new Error(last || "no model");
}

// أحكام المحدثين من «الموسوعة الحديثية» في الدرر السنية (dorar.net/dorar_api.json): ?dorar=<طرف الحديث>
// يعيد الأحاديث المطابقة بأحكام المحدثين القدماء والمعاصرين ومصادرها، مع العزو والرابط؛ ويُخزَّن أسبوعًا.
async function dorar(req, res, q) {
  q = String(q || "").trim().slice(0, 160); if (q.length < 6) return res.status(400).json({ message: "اكتب طرف الحديث" });
  try {
    const r = await fetch("https://dorar.net/dorar_api.json?skey=" + encodeURIComponent(q), { headers: { "User-Agent": "dawahlibrary.org" } });
    const j = await r.json(), html = String((j && j.ahadith && j.ahadith.result) || "");
    const plain = x => x.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const items = html.split(/<div class="hadith"[^>]*>/).slice(1).map(h => {
      const [m, info = ""] = h.split(/<div class="hadith-info"[^>]*>/), I = plain(info);
      const g = I.match(/الراوي:\s*(.*?)\s*المحدث:\s*(.*?)\s*المصدر:\s*(.*?)\s*الصفحة أو الرقم:\s*(.*?)\s*خلاصة حكم المحدث:\s*(.*)$/) || [];
      return { matn: plain(m).replace(/^\d+\s*-\s*/, ""), rawi: g[1] || "", muhaddith: g[2] || "", src: g[3] || "", page: g[4] || "", hukm: (g[5] || "").replace(/^\[|\]$/g, "") };
    }).filter(x => x.matn && x.hukm).slice(0, 15);
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
    return res.status(200).json({ src: "الموسوعة الحديثية — الدرر السنية (dorar.net)", items });
  } catch (e) { return res.status(502).json({ message: "تعذّر الوصول إلى الدرر السنية الآن" }); }
}

// الشرح الموجز للحديث على طريقة «الموسوعة الحديثية»: يُلخَّص من نص شرحه المشهور في المكتبة وحده (فتح الباري، المنهاج للنووي، عون المعبود…)
// الطلب: ?sharh=<كتاب>&n=<رقم الحديث>؛ المتن وموضع الشرح يُقرآن من المستودع (tools/hadith-links.py) لا من الطلب، والنتيجة تُخزَّن للجميع.
const SNAME = { fathbari: "فتح الباري لابن حجر", fathbarirajab: "فتح الباري لابن رجب", nawawimuslim: "المنهاج شرح صحيح مسلم للنووي", awnmabud: "عون المعبود", tuhfaahwadhi: "تحفة الأحوذي", istidhkar: "الاستذكار لابن عبد البر", subulsalam: "سبل السلام للصنعاني", jamiulum: "جامع العلوم والحكم لابن رجب" };
async function sharh(req, res, b, n) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  b = String(b || ""); n = String(n || "");
  if (!/^[a-z]{3,12}$/.test(b) || !/^[\w.-]{1,20}$/.test(n)) return res.status(400).json({ message: "طلب غير صحيح" });
  const { limited } = require("../lib/rate");
  if (limited(req, "sh", 30, 10 * 60e3)) return res.status(429).json({ message: "طلبات كثيرة، حاول بعد قليل" });
  const RAWG = "https://raw.githubusercontent.com/" + (process.env.GITHUB_REPO || "dawah-library/sdsl-library") + "/main/data/hadith/";
  try {
    const L = await (await fetch(RAWG + "links/" + b + ".json")).json(), e = L[n];
    if (!e || !e.sh || !e.sh.length) return res.status(404).json({ message: "لم يُحدَّد موضع شرح هذا الحديث بعد" });
    let matn = "";
    if (/^(arbain|riyad|bulugh)$/.test(b)) { const D = await (await fetch(RAWG + b + ".json")).json(); matn = (D[n] || {}).m || ""; }
    else { const K = await (await fetch(RAWG + "k/" + b + ".json")).json(), k = (K.items || []).findIndex(x => String(x[0]) === n); if (k >= 0) { const M = await (await fetch(RAWG + "k/" + b + "/m" + Math.floor(k / 500) + ".json")).json(); matn = M[n] || ""; } }
    if (!matn) return res.status(404).json({ message: "الحديث غير موجود" });
    const [vid, p] = e.sh[0], sb = vid.replace(/-v\d+$/, ""), origin = "https://" + (req.headers.host || "dawahlibrary.org");
    const a = await pageText(vid, p, origin), z = await pageText(vid, p + 1, origin);
    const src = ((a && a.text) || "") + "\n" + ((z && z.text) || "");
    if (src.trim().length < 200) return res.status(404).json({ message: "نص الشرح غير متاح" });
    if (await require("../lib/switch").stopped("translate", res, "الشرح الموجز")) return;
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: "الخدمة غير متاحة الآن" });
    const prompt = `أنت باحث في شروح الحديث. هذا حديث نبوي، ثم نص من كتاب «${SNAME[sb] || sb}» في موضع شرحه.
اكتب «شرحًا موجزًا» للحديث على طريقة «الموسوعة الحديثية» في الدرر السنية: فقرة أو فقرتان تبيّن المعنى الإجمالي، ثم «وفي الحديث:» مع ٣–٥ فوائد قصيرة.
الشروط: اعتمد على النص المقتبس من الشرح وحده، ولا تضف حكمًا أو قولًا أو حديثًا من خارجه، ولا تذكر خلافًا لم يذكره؛ وبلغة عربية فصيحة سهلة؛ ودون عناوين أخرى أو مقدمات.
وإن لم يكن النص المقتبس شرحًا لهذا الحديث فاكتب فقط: لا يتناول هذا الموضعُ الحديثَ.

الحديث: «${String(matn).slice(0, 1200)}»

نص الشرح:
${src.replace(/<[^>]+>/g, "").slice(0, 12000)}`;
    const text = await gemini(prompt);
    res.setHeader("cache-control", "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000");
    return res.status(200).json({ text, src: SNAME[sb] || sb, at: [vid, p] });
  } catch (err) { res.setHeader("cache-control", "no-store"); return res.status(502).json({ message: "تعذّر إعداد الشرح الآن" }); }
}

module.exports = async (req, res) => {
  if (req.query && req.query.dorar) return dorar(req, res, req.query.dorar);
  if (req.query && req.query.sharh) return sharh(req, res, req.query.sharh, req.query.n);
  if (req.query && req.query.op === "fb") return feedback(req, res);
  const u = new URL(req.url, "https://" + (req.headers.host || "dawahlibrary.org"));
  const id = (u.searchParams.get("id") || "").slice(0, 80), p = parseInt(u.searchParams.get("p") || "0", 10), l = u.searchParams.get("l") || "";
  res.setHeader("content-type", "application/json; charset=utf-8");
  const CFG = await trCfg(), LG = (CFG.langs || []).find(x => x.k === l && x.on !== false), LANGS = { [l]: LG && (LG.llm || LG.n) };
  if (!u.searchParams.get("w") && (!id || !(p > 0)) || !LG) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad request" })); }
  if (await require("../lib/switch").stopped("translate", res, "الترجمة")) return;
  if (!process.env.GEMINI_API_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ error: "no key" })); }
  const { limited } = require("../lib/rate");
  if (limited(req, "tr", 60, 10 * 60e3)) { res.statusCode = 429; return res.end(JSON.stringify({ error: "busy" })); }
  // ترجمة كلمة في سياقها (للضغطة المطولة على الكلمة في القارئ)
  const w = (u.searchParams.get("w") || "").trim();
  if (w) {
    const ctx = (u.searchParams.get("ctx") || "").slice(0, 320);
    if (w.length > 40 || /[<>{}]/.test(w + ctx)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad" })); }
    const prompt = `You are an expert translator of classical Islamic Arabic texts. Translate the Arabic word «${w}» as it is used in this sentence: «${ctx}» into ${LANGS[l]}.
Reply in exactly two lines, in ${LANGS[l]}:
1) the best equivalent (1–4 words; you may give two alternatives separated by " / "), and if it is an Islamic technical term add its standard transliteration in parentheses;
2) one short sentence explaining the precise meaning intended in this context.
No other text.`;
    try { const text = await gemini(prompt); res.setHeader("cache-control", "public, max-age=86400, s-maxage=31536000"); return res.end(JSON.stringify({ text })); }
    catch (e) { res.statusCode = 502; res.setHeader("cache-control", "no-store"); return res.end(JSON.stringify({ error: "busy" })); }
  }
  const pg = await pageText(id, p, u.origin);
  const v = u.searchParams.get("v");  // رقم الإصدار يجب أن يطابق الكتاب (لا يُتلاعب به لتجاوز التخزين واستنزاف الحصة)
  if (pg && v && String(pg.b.size || 0) !== v) { res.statusCode = 400; return res.end(JSON.stringify({ error: "stale" })); }
  if (!pg) { res.statusCode = 404; return res.end(JSON.stringify({ error: "not found" })); }
  // الترجمة المنظَّمة (f=2): متن وحواشٍ، والآيات والأحاديث بنصها الأصلي، والمسرد، ونوع المادة (كتاب/شرح/فتوى/مقال)
  if (u.searchParams.get("f") === "2") {
    try {
      const out = await TRC.translatePage({ text: pg.text, lang: l, title: pg.b.title, author: authorName(pg.b.authorId), kind: kindOf(pg.b) }, CFG, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
      out.s = "m"; out.at = new Date().toISOString().slice(0, 10);
      res.setHeader("cache-control", "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000");
      return res.end(JSON.stringify(out));
    } catch (e) { res.statusCode = 502; res.setHeader("cache-control", "no-store"); return res.end(JSON.stringify({ error: "busy" })); }
  }
  const src = pg.text.replace(/^#+ /gm, "").replace(/[ً-ْ]/g, "").trim();
  if (!src) { res.setHeader("cache-control", "public, s-maxage=31536000"); return res.end(JSON.stringify({ text: "" })); }
  const prompt = `Translate the following page from an Arabic Islamic book into ${LANGS[l]}.
Rules: translate faithfully and completely, keep paragraph breaks; keep Quran verses as an accepted meaning-translation followed by the reference if present; use standard transliterations for Islamic terms (e.g. Tawhid, Sunnah, Salaf) with a brief gloss the first time; keep footnote numbers like (1); do not add commentary, headings or notes of your own. Output only the translation.

Book: ${pg.b.title}

${src.slice(0, 9000)}`;
  try {
    const text = await gemini(prompt);
    res.setHeader("cache-control", "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000");
    res.end(JSON.stringify({ text, engine: "gemini" }));
  } catch (e) {
    res.statusCode = 502; res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: "busy" }));
  }
};
