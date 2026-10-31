// الاستيراد اليومي لمقالات صوت السلف — يعمل تلقائيًا عبر GitHub Actions (.github/workflows/daily-import.yml)
// يبدأ من أقدم مقال (أصغر رقم) ويتقدم كل يوم بدفعة، ويحفظ موضعه في data/import-state.json
// - يضيف كل كاتب جديد تلقائيًا إلى قائمة المؤلفين (بصفحة جاهزة لكتبه لاحقًا)
// - يجمع المقالات في ملفات شهرية data/articles/YYYY-MM.json وفهرس واحد data/articles/index.json
// الاستخدام اليدوي: node tools/daily-import.js [عدد المقالات]
const fs = require("fs"), path = require("path");
const { extract } = require("../api/import.js");

const ROOT = path.join(__dirname, ".."), DATA = path.join(ROOT, "data"), ADIR = path.join(DATA, "articles");
const STATE = path.join(DATA, "import-state.json"), CAT = path.join(DATA, "catalog.json"), IDX = path.join(ADIR, "index.json");
const BASE = "https://salafvoice.com/article.aspx?a=";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const strip = s => String(s).replace(/[ً-ٰٟـ]/g, "");
const norm = s => strip(String(s || "").replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
const bare = s => norm(s).replace(/^(الشيخ|الدكتور|دكتور|الأستاذ|الاستاذ|د[.\/]?|م[.\/]|أ[.\/]|ا[.\/])\s*/, "").replace(/\s*-?\s*(حفظه الله|رحمه الله)$/, "").replace(/(^|\s)(عبد|ابو|أبو)\s+/g, "$1$2").replace(/\s+/g, " ").trim();

// خريطة أقسام صوت السلف إلى موضوعات المقالات في المكتبة
const TOPIC_WORDS = [["المنهج السلفي", "at1"], ["قضايا معاصرة", "at2"], ["طالب العلم", "at3"], ["مذاهب فكرية", "at4"], ["التزكية", "at5"], ["السيرة", "at6"], ["التاريخ", "at6"],
  ["مع الدعاة", "at7"], ["زاد الداعية", "at7"], ["المرأة", "at8"], ["الأسرة", "at8"], ["شبابنا", "at9"], ["أطفالنا", "at10"], ["المسلمون حول العالم", "at11"], ["حوارات", "at12"],
  ["حدث وتعليق", "at13"], ["أدب", "at14"], ["نور الوحيين", "at15"], ["فقه الواقع", "at16"], ["بيان", "at17"], ["الاستفتاء", "at18"], ["فتاوى", "at18"]];

async function getHtml(url) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (SDSL daily importer; dawah library)", "accept-language": "ar" }, redirect: "follow" });
  if (r.status === 404 || r.status === 500 || r.status === 410) return null; // رقم محذوف أو غير موجود
  if (!r.ok) throw new Error("HTTP " + r.status);
  const buf = await r.arrayBuffer();
  const cs = ((r.headers.get("content-type") || "").match(/charset=([\w-]+)/i) || [])[1];
  let html = new TextDecoder(cs || "utf-8").decode(buf);
  const meta = (html.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  if (!cs && meta && !/utf-?8/i.test(meta)) html = new TextDecoder(meta).decode(buf);
  return html;
}

async function main() {
  const st = Object.assign({ next: 1, perRun: 150, fatwaAuthor: "a2", maxMisses: 60, delayMs: 1500, latestHint: 25750, imported: 0, lastRun: null, newAuthors: [] }, readJSON(STATE, {}));
  const want = +(process.argv[2] || process.env.IMPORT_COUNT || st.perRun);
  const cat = readJSON(CAT, null); if (!cat) throw new Error("catalog.json غير موجود");
  fs.mkdirSync(ADIR, { recursive: true });
  const idx = readJSON(IDX, { v: 1, items: [] });
  const have = new Set(idx.items.map(x => x.id).concat(cat.books.map(b => b.id), st.skipped || []));
  // التهاني والتعازي الصادرة باسم الدعوة لا تُستورد (قرار الإدارة ٣٠ أكتوبر ٢٠٢٦)؛ الفتاوى عن حكم التهنئة والعزاء تبقى
  const isGreeting = t => { const x = norm(t || ""); return /الدعوه السلفيه/.test(x) && (/^"?\s*(تعزيه|تهنئه)/.test(x) || /بخالص العزاء/.test(x)); };
  if (!cat.topics.some(t => t.id === "at0")) cat.topics.push({ id: "at0", name: "غير مصنف", for: "articles" });
  if (!cat.topics.some(t => t.id === "at18")) cat.topics.push({ id: "at18", name: "فتاوى واستشارات", for: "articles" });

  const LOG = []; const log = m => { console.log(m); LOG.push(m); };
  const authorId = name => {
    const b = bare(name || "صوت السلف"); if (!b) return "a8";
    // الأسماء البديلة (aliases) تطابَق تامًّا أولًا، ثم الاسم الرسمي بالاحتواء
    const live = cat.authors.filter(a => (a.col || "dawah") === "dawah" && !a.mergedInto); // المدموج يُطابَق باسمه البديل في السجل الموحَّد
    const exact = live.find(a => (a.aliases || []).some(x => bare(x) === b));
    if (exact) return exact.id;
    const hit = live.find(a => (bare(a.name) === b || bare(a.name).includes(b) || b.includes(bare(a.name))) && bare(a.name).length >= 4);
    if (hit) return hit.id;
    // الاسم المختصر من الآخر مع اتفاق الاسم الأول والأخير (سعيد السواح ~ سعيد محمد السواح): يُنسب ويُسجَّل للمراجعة في «التكرار والتوحيد»
    const tk = x => bare(x).split(/\s+/).filter(Boolean), nb = tk(name);
    const near = nb.length >= 2 && live.find(a => [a.name].concat(a.aliases || []).some(n => { const t = tk(n), [S, L] = t.length <= nb.length ? [t, nb] : [nb, t]; return S.length >= 2 && S[0] === L[0] && S[S.length - 1] === L[L.length - 1] && S.every(w => L.includes(w)); }));
    if (near) { (st.nearAuthors = st.nearAuthors || []).push(name.trim() + " → " + near.id); log("  ~ نُسب إلى «" + near.name + "» بتقارب الاسم: " + name.trim()); return near.id; }
    const id = "w" + (Math.max(0, ...cat.authors.filter(a => /^w\d+$/.test(a.id)).map(a => +a.id.slice(1))) + 1); // أكبر رقم +1 (العدّ يكرر الأرقام بعد الدمج)
    cat.authors.push({ id, name: name.trim(), col: "dawah", bio: "", auto: true });
    st.newAuthors.push(name.trim()); log("  + كاتب جديد: " + name.trim());
    return id;
  };
  // الأقسام تطابق تقسيم صوت السلف: القسم الفرعي (الأخير في المسار) مع حفظ القسم الأب
  const GENERIC = new Set(["المقالات الفرعية", "عام", "المقالات"].map(norm));
  const topicId = (category, title, text) => {
    const parts = String(category || "").split("›").map(x => x.trim()).filter(x => x && !GENERIC.has(norm(x)));
    if (/الاستفتاء|فتاوى|الفتاوى/.test(category || "") || /^\s*(السؤال|سؤال)\s*:/.test(text)) {
      if (!parts.length) return "at18";
    }
    if (!parts.length) return "at0";
    const leaf = parts[parts.length - 1], parent = parts.length > 1 ? parts[0] : "";
    const hit = cat.topics.find(t => t.for === "articles" && norm(t.name) === norm(leaf));
    if (hit) { if (parent && !hit.parent) hit.parent = parent; return hit.id; }
    const id = "st" + (cat.topics.filter(t => /^st\d+$/.test(t.id)).length + 1);
    cat.topics.push({ id, name: leaf, for: "articles", parent, auto: true });
    log("  + قسم جديد: " + (parent ? parent + " › " : "") + leaf);
    return id;
  };

  const sampled = {};
  // دمج الكتّاب المكررين (مثل «عبد المنعم» و«عبدالمنعم») مع إعادة ربط مقالاتهم
  for (const w of cat.authors.filter(a => a.auto && !a.mergedInto)) {
    const twin = cat.authors.find(a => !a.auto && !a.mergedInto && (a.col || "dawah") === "dawah" && bare(a.name).length >= 4 && (bare(a.name) === bare(w.name) || bare(a.name).includes(bare(w.name)) || bare(w.name).includes(bare(a.name))));
    if (twin) { idx.items.forEach(x => { if (x.a === w.id) x.a = twin.id; }); cat.authors = cat.authors.filter(a => a !== w); log("  = دُمج الكاتب «" + w.name + "» في «" + twin.name + "»"); }
  }
  // فتاوى صوت السلف لا تذكر اسم المفتي، والموقع هو الموقع الرسمي للشيخ ياسر برهامي؛ تُنسب إليه افتراضيًا (fatwaAuthor في import-state.json، أو "" لإلغاء ذلك)
  const isFatwa = c => /^(أسئلة|الاستفتاء|من فقه الواقع)/.test(c || "");
  if (st.fatwaAuthor) idx.items.forEach(x => { if (x.a === "a8" && isFatwa(x.c)) { x.a = st.fatwaAuthor; x.fa = 1; } });
  const groups = {}; const loadGroup = g => groups[g] || (groups[g] = readJSON(path.join(ADIR, g + ".json"), {}));
  let got = 0, errs = 0, stop = false;
  // معالجة رقم واحد: "ok" أو "miss" أو "have" أو "err"
  async function one(id) {
    const sid = "sv" + id, url = BASE + id;
    if (have.has(sid)) return "have";
    try {
      const html = await getHtml(url);
      if (html) { const isF = /أسئلة|الاستفتاء/.test((html.match(/<ol class="breadcrumb">([\s\S]*?)<\/ol>/i) || [""])[0]); const key = isF ? "fatwa" : "article";
        if (!sampled[key]) { sampled[key] = true; fs.mkdirSync(path.join(ROOT, "tools", "samples"), { recursive: true }); fs.writeFileSync(path.join(ROOT, "tools", "samples", "last-" + key + ".html"), html); } }
      const a = html ? extract(html, url) : null;
      await sleep(st.delayMs);
      if (!a || !a.text || a.text.length < 200 || !a.title) { log(`${id}: لا يوجد مقال`); return "miss"; }
      { // صفحة بلا نص مقال: التُقط شريط «مواد ذات صلة» (أسطر تبدأ بتاريخ) أو مسار التنقل بدل العنوان
        const ls = a.text.split(/\n/).filter(l => l.trim()), dl = ls.filter(l => /^\d{4}-\d{2}-\d{2} /.test(l.trim())).length;
        if (/^الرئيسية\s*»/.test(a.title) || (ls.length && dl / ls.length > 0.4)) { log(`${id}: لا يوجد مقال (شريط مواد ذات صلة)`); return "miss"; }
        a.title = a.title.replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
      }
      { // إعادة نشر مقال قائم بنصه (مثل «من تراث الدعوة»): لا يُستورد مرة ثانية (ب2-16)
        const T = t => norm(String(t || "").replace(/\(?من تراث الدعوة\)?/g, "").replace(/[«»"'()\[\]،,.:؛؟!\-–—]/g, " ")).replace(/\s+/g, " ").trim();
        const tw = idx.items.find(x => !x.h && T(x.t) === T(a.title));
        if (tw) { const old = ((loadGroup(tw.f)[tw.id] || {}).pages || []).join(" "), sh = s => { const w = norm(s).split(/\s+/), o = new Set(); for (let i = 0; i + 3 <= w.length; i++) o.add(w.slice(i, i + 3).join(" ")); return o; };
          const A1 = sh(old), B1 = sh(a.text); let c = 0; B1.forEach(x => A1.has(x) && c++); const j = c / Math.max(1, A1.size + B1.size - c);
          if (j >= 0.85) { (st.skipped = st.skipped || []).push(sid); have.add(sid); log(`${id}: تخطٍّ (إعادة نشر ${tw.id} بنصه، تطابق ${Math.round(j * 100)}٪) ${a.title}`); return "have"; } }
      }
      if (isGreeting(a.title)) { (st.skipped = st.skipped || []).push(sid); have.add(sid); log(`${id}: تخطٍّ (تهنئة/تعزية) ${a.title}`); return "have"; }
      errs = 0; if (id > st.latestHint) st.latestHint = id;
      const g = /^\d{4}-\d{2}/.test(a.date) ? a.date.slice(0, 7) : "undated";
      const text = a.text.length > 7000 ? a.text.split(/\n/).reduce((ps, l) => { const last = ps[ps.length - 1]; if (last.length + l.length > 5000) ps.push(l); else ps[ps.length - 1] = last ? last + "\n" + l : l; return ps; }, [""]) : [a.text];
      loadGroup(g)[sid] = { pages: text };
      const aid0 = authorId(a.author), fat = st.fatwaAuthor && aid0 === "a8" && isFatwa(a.category);
      idx.items.push({ id: sid, t: a.title, a: fat ? st.fatwaAuthor : aid0, ...(fat ? { fa: 1 } : {}), tp: topicId(a.category, a.title, a.text), c: a.category || "", d: a.date || "", u: url, f: g, n: text.length, ad: new Date().toISOString().slice(0, 10) });
      have.add(sid); got++; log(`${id}: ✓ ${a.title} — ${a.author || "؟"} [${a.category || "بلا قسم"}]`);
      return "ok";
    } catch (e) { log(`${id}: خطأ ${e.message}`); errs++; if (/HTTP 4(03|29)/.test(e.message) || errs >= 8) { log("توقف مؤقتًا: الموقع يرفض الطلبات أو لا يستجيب الآن."); stop = true; } await sleep(st.delayMs); return "err"; }
  }
  // ١) الجديد المنشور بعد آخر رقم معروف (فتاوى وبيانات ومقالات اليوم)
  let h = (st.headNext || st.latestHint + 1), hm = 0;
  while (!stop && hm < 25) { const r = await one(h); if (r === "ok" || r === "have") { hm = 0; st.headNext = h + 1; } else hm++; h++; }
  // ٢) من الأحدث إلى الأقدم: نصف الدفعة، حتى يظهر الحديث من الفتاوى والبيانات أولًا
  let back = st.backNext || st.latestHint, bGot = got, bTried = 0;
  while (!stop && got - bGot < Math.ceil(want / 2) && bTried < want * 3 && back > st.next) { await one(back); back--; bTried++; }
  st.backNext = back;
  // ٣) من الأقدم إلى الأحدث: بقية الدفعة
  let id = st.next, tried = 0;
  while (!stop && got < want && tried < want * 4 && id < back) { await one(id); id++; tried++; }
  for (const [g, obj] of Object.entries(groups)) fs.writeFileSync(path.join(ADIR, g + ".json"), JSON.stringify(obj));
  idx.items.sort((x, y) => (x.d || "").localeCompare(y.d || "") || x.id.localeCompare(y.id));
  fs.writeFileSync(IDX, JSON.stringify(idx));
  cat.version = Date.now(); fs.writeFileSync(CAT, JSON.stringify(cat));
  Object.assign(st, { next: Math.min(id, back + 1), imported: (st.imported || 0) + got, lastRun: new Date().toISOString() });
  fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
  log(`\nاستُورد ${got} مقالًا. الموضع التالي: ${id}. المجموع: ${st.imported}.`);
  fs.writeFileSync(path.join(DATA, "import-log.txt"), `آخر تشغيل: ${st.lastRun}\n` + LOG.join("\n") + "\n");
}
main().catch(e => { console.error(e); process.exit(1); });
