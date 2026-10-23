// دالة خادم Vercel: ترجمة صفحة من كتاب بالذكاء الاصطناعي (Gemini) لعرضها داخل صفحة القراءة.
// الطلب: GET /api/translate?id=<كتاب>&p=<رقم الصفحة>&l=<رمز اللغة>
// النتيجة تُخزَّن في شبكة Vercel سنة كاملة، فكل صفحة تُترجم إلى كل لغة مرة واحدة فقط للجميع (تكلفة شبه معدومة).
const fs = require("fs"), path = require("path");
const ROOT = process.cwd();
const LANGS = { en: "English", fr: "French", es: "Spanish", tr: "Turkish", de: "German", "zh-CN": "Simplified Chinese", ru: "Russian", ur: "Urdu", id: "Indonesian", ms: "Malay", bn: "Bengali", fa: "Persian", sw: "Swahili", ha: "Hausa" };
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m, i, a) => m && a.indexOf(m) === i);
let CAT = null;

async function pageText(id, p, origin) {
  if (!CAT) CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "data/catalog.json"), "utf8"));
  const b = CAT.books.find(x => x.id === id);
  if (!b) return null;
  let sh = null;
  if (!b.vf) { try { sh = JSON.parse(fs.readFileSync(path.join(ROOT, "data/books", id + ".json"), "utf8")); } catch (e) { } }
  if (!sh) { try { const r = await fetch(origin + (b.vf ? "/vols/" : "/data/books/") + encodeURIComponent(id) + ".json"); if (r.ok) sh = await r.json(); } catch (e) { } }
  const t = sh && sh.pages && sh.pages[p - 1];
  return t == null ? null : { b, text: String(t) };
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

module.exports = async (req, res) => {
  const u = new URL(req.url, "https://" + (req.headers.host || "dawahlibrary.org"));
  const id = (u.searchParams.get("id") || "").slice(0, 80), p = parseInt(u.searchParams.get("p") || "0", 10), l = u.searchParams.get("l") || "";
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (!id || !(p > 0) || !LANGS[l]) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad request" })); }
  if (!process.env.GEMINI_API_KEY) { res.statusCode = 503; return res.end(JSON.stringify({ error: "no key" })); }
  const pg = await pageText(id, p, u.origin);
  if (!pg) { res.statusCode = 404; return res.end(JSON.stringify({ error: "not found" })); }
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
