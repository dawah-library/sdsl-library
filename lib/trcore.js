// نواة الترجمة المشتركة بين الدالة (api/translate.js) ومهمة الترجمة المسبقة (tools/tr-book.js):
// تقسيم الصفحة إلى متن وحواشٍ، وعزل الآيات والأحاديث برموز ⟦Q1⟧ ⟦H1⟧ فيُعاد نصها العربي الأصلي من المصدر نفسه
// (لا من النموذج) فلا يُحرَّف حرف منها، ويُترجَم معناها وحده؛ ثم بناء التكليف وقراءة الناتج.
const AR_DIAC = /[ً-ْٰـ]/g;
const strip = s => String(s || "").replace(AR_DIAC, "");
const HDCUE = /(?:ﷺ|صلى الله عليه وسلم|صلى الله عليه وآله وسلم|عليه الصلاة والسلام|رسول الله|النبي|نبي الله|قال الله تعالى في الحديث القدسي|في الحديث|حديث)\s*(?:\([^)]{0,6}\))?\s*[-–—]?\s*(?:أنه\s+)?(?:فقال|قال|يقول|قالت)?\s*[-–—]?\s*[:،]?\s*$/;

// الصفحة ← {main, fn, seg}: seg يحفظ النصوص الأصلية للآيات (Q) والأحاديث (H) بلفظها
function segment(text) {
  let t = String(text || "").replace(/<[^>]+>/g, "");
  const cut = t.search(/^\s*_{4,}\s*$/m);
  let main = cut >= 0 ? t.slice(0, cut).trimEnd() : t, fn = cut >= 0 ? t.slice(cut).replace(/^\s*_{4,}\s*\n?/, "").trim() : "";
  const seg = {}; let nq = 0, nh = 0;
  const mark = s => s
    .replace(/﴿[^﴾]{2,}﴾|\{[^{}]*[ء-ي][^{}]*[ء-ي][^{}]*\}/g, m => { const k = "Q" + (++nq); seg[k] = m.replace(/^\{|\}$/g, x => x === "{" ? "﴿" : "﴾"); return "⟦" + k + "⟧"; })
    .replace(/«([^»]{6,})»/g, (m, inner, off, all) => {
      const before = strip(all.slice(Math.max(0, off - 70), off));
      if (!HDCUE.test(before)) return m;
      const k = "H" + (++nh); seg[k] = m; return "⟦" + k + "⟧";
    });
  main = mark(main); fn = mark(fn);
  return { main, fn, seg };
}

// المصطلحات الواردة في الصفحة من المسرد (العام «*» ثم مسرد اللغة يغلبه)
function terms(cfg, lang, text) {
  const g = (cfg && cfg.glossary) || {}, all = Object.assign({}, g["*"] || {}, g[lang] || {}), s = strip(text), out = [];
  for (const [ar, tr] of Object.entries(all)) if (tr && s.includes(strip(ar))) out.push(ar + " = " + tr);
  return out.slice(0, 60);
}

const KIND = { book: "a book", sharh: "a commentary (sharḥ) on another book", fatwa: "a fatwa (legal verdict answering a question)", article: "an article", statement: "an official statement", research: "a research paper" };

function prompt(o) {
  const L = o.llm, segL = Object.entries(o.seg || {}).map(([k, v]) => k + ": " + v).join("\n");
  return `You are a senior translator of classical and contemporary Arabic Islamic scholarship (Sunni, Salafi methodology) into ${L}.
Translate the page below from ${KIND[o.kind] || KIND.book}${o.title ? " titled «" + o.title + "»" : ""}${o.author ? " by " + o.author : ""}${o.topic ? " (subject: " + o.topic + ")" : ""}.

Principles:
- Convey the precise meaning in the scholarly and juristic context, not a word-for-word rendering; keep the author's tone and register (formal, exhortative, polemical, etc.) and every nuance of hedging, preference (tarjīḥ) and certainty. Never add, omit, soften or explain anything of your own.
- Islamic technical terms: use the standard ${L} rendering; for key terms add the established transliteration in parentheses the first time on the page. Follow this glossary strictly:
${(o.terms || []).join("\n") || "(none)"}
- Honorifics: render ﷺ / صلى الله عليه وسلم, رضي الله عنه, رحمه الله, تعالى in the conventional ${L} way.
- Tokens like ⟦Q1⟧ (Qur'an verse) and ⟦H1⟧ (Prophetic hadith) stand for sacred texts kept in their Arabic original. Leave every token exactly where it is in "main" and "fn" (do not translate or remove it), and give for each token a faithful translation of its meaning in "q" (verses) and "h" (hadiths). For verses use an accepted, reverent translation of the meanings.
- Lines starting with "# " or "## " are headings: keep the marker. Keep paragraph breaks (\\n) and footnote numbers like (1).
${o.kind === "sharh" ? "- This is a commentary: wherever the commentator quotes the base text (matn) being explained (often in parentheses or after «قوله» / «قال المصنف»), wrap the translation of that quoted base text in ⟪ and ⟫ so it stays distinguished from the commentary.\n" : ""}- Names of people, books and places: standard transliteration.
- "main" is the body of the page; "fn" is the footnotes (hawāshī), translate them separately; if "fn" is empty return "".

Reply with JSON only: {"main": "...", "fn": "...", "q": {"Q1": "..."}, "h": {"H1": "..."}}

SACRED TEXTS (for meaning only):
${segL || "(none)"}

MAIN:
${String(o.main || "").replace(AR_DIAC, "").slice(0, 9000)}

FOOTNOTES:
${String(o.fn || "").replace(AR_DIAC, "").slice(0, 4000)}`;
}

// ناتج النموذج ← سجل الصفحة المخزَّن. miss: رموز حذفها النموذج (تُعرض في آخر الصفحة كي لا يضيع نص مقدس)
function parse(txt, sg) {
  let j = null; const s = String(txt || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { j = JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}/); if (m) try { j = JSON.parse(m[0]); } catch (e2) { } }
  if (!j || typeof j.main !== "string") return null;
  const out = { main: j.main.trim(), fn: String(j.fn || "").trim(), q: {}, h: {}, seg: sg.seg };
  for (const k of Object.keys(sg.seg)) {
    const m = (k[0] === "Q" ? j.q : j.h) || {}; (k[0] === "Q" ? out.q : out.h)[k] = String(m[k] || "").trim();
    if (!(out.main + out.fn).includes("⟦" + k + "⟧")) (out.miss = out.miss || []).push(k);
  }
  if (/[ء-ي]{4,}(?:\s+[ء-ي]{2,}){6,}/.test(out.main.replace(/⟦[QH]\d+⟧/g, "")) && !/^(ur|fa|ar)$/.test(sg.lang || "")) return null; // بقي النص عربيًّا: ترجمة فاشلة
  return out;
}

const MODELS = m => [m, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-flash-lite-latest"].filter((x, i, a) => x && a.indexOf(x) === i);
// keys: مصفوفة مفاتيح (المهمة) أو مفتاح واحد (الدالة)
async function gemini(text, keys, model) {
  keys = [].concat(keys || []).filter(Boolean); let last = "";
  for (const m of MODELS(model)) for (const key of keys) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" } })
      });
      if (!r.ok) { last = m + " " + r.status; if (r.status === 404 || r.status === 400) break; continue; }
      const j = await r.json(), t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || "").join("").trim();
      if (t) return { text: t, model: m };
    } catch (e) { last = m + " " + e.message; }
  }
  throw new Error(last || "no model");
}

// ترجمة صفحة كاملة: segment ← prompt ← gemini ← parse (مع محاولة ثانية إن فسد الناتج)
async function translatePage(o, cfg, keys, model) {
  const sg = segment(o.text); sg.lang = o.lang;
  if (!(sg.main + sg.fn).replace(/⟦[QH]\d+⟧/g, "").trim() && !Object.keys(sg.seg).length) return { main: "", fn: "", q: {}, h: {}, seg: {} };
  const lang = (cfg.langs || []).find(x => x.k === o.lang) || {};
  const p = prompt(Object.assign({}, o, sg, { llm: lang.llm || lang.n || o.lang, terms: terms(cfg, o.lang, o.text) }));
  for (let i = 0; i < 2; i++) {
    const r = await gemini(p, keys, model), out = parse(r.text, sg);
    if (out) { out.e = r.model; return out; }
  }
  throw new Error("bad output");
}

module.exports = { segment, terms, prompt, parse, gemini, translatePage, strip };
