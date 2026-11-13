#!/usr/bin/env node
// الترجمة المسبقة للكتب والمقالات (طابور data/tr/_queue.json يملؤه فريق الترجمة من #/translate):
// تُترجَم الصفحات الناقصة بالنواة نفسها التي تستعملها الدالة (lib/trcore.js) وتُحفظ في data/tr/<اللغة>/<المعرّف>.json
// فتُقرأ للجميع بلا تكلفة متكررة، وتتاح للتحميل كاملة. الصفحات المراجَعة علميًّا (s:"r") لا تُمس أبدًا.
// البيئة: GEMINI_API_KEY…_20 (بلا المفاتيح المحجوزة لخدمات الكتب)، TR_PAGES (حد الجولة)، TR_ONLY=<id> اختياري.
const fs = require("fs"), path = require("path"), TRC = require("../lib/trcore");
const ROOT = path.join(__dirname, ".."), rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const wr = (f, o, c) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, c ? 0 : 1)); };
const NAMES = ["GEMINI_API_KEY"].concat(Array.from({ length: 19 }, (_, i) => "GEMINI_API_KEY_" + (i + 2)));
const ALL = NAMES.map(n => (process.env[n] || "").trim()).filter(Boolean), RES = Math.min(+(process.env.STUDY_KEYS || 6), Math.max(0, ALL.length - 1));
const KEYS = RES ? ALL.slice(0, ALL.length - RES) : ALL;

const cfg = rd("data/tr-config.json"), cat = rd("data/catalog.json");
let aidx = null; try { aidx = rd("data/articles/index.json").items || []; } catch (e) { aidx = []; }
const author = id => ((cat.authors || []).find(a => a.id === id) || {}).name || "";
function source(id) {
  const b = cat.books.find(x => x.id === id);
  if (b && b.type !== "article") {
    for (const f of [(b.vf ? "vols/" : "data/books/") + id + ".json", "data/books/" + id + ".json", "vols/" + id + ".json"]) { try { return { b, pages: rd(f).pages }; } catch (e) { } }
    return null;
  }
  const x = aidx.find(y => y.id === id); if (!x) return null;
  try { return { b: b || { id, title: x.t, authorId: x.a, type: "article", fa: x.fa, c: x.c }, pages: (rd("data/articles/" + x.f + ".json")[id] || {}).pages }; } catch (e) { return null; }
}
const kindOf = b => b.sharh ? "sharh" : b.type !== "article" ? "book" : (b.fa || /^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c || "")) ? "fatwa" : /بيان/.test(b.c || b.title || "") ? "statement" : "article";
function reindex(idx, l, id, st, total) {
  const ps = Object.values(st.p || {}); idx.l[l] = idx.l[l] || {};
  idx.l[l][id] = [ps.length, ps.filter(x => x.s === "r").length, total];
}

(async () => {
  const Q = rd("data/tr/_queue.json"), idx = (() => { try { return rd("data/tr/index.json"); } catch (e) { return { v: 1, l: {} }; } })();
  idx.l = idx.l || {};
  let budget = +(process.env.TR_PAGES || (cfg.batch || {}).pages || 250), done = 0, fails = 0;
  if (!KEYS.length) { console.log("لا مفاتيح Gemini"); return; }
  const on = new Set((cfg.langs || []).filter(x => x.on !== false).map(x => x.k));
  for (const it of Q.items || []) {
    if (it.st === "done" || (process.env.TR_ONLY && it.id !== process.env.TR_ONLY)) continue;
    const src = source(it.id); if (!src || !src.pages) { it.st = "missing"; continue; }
    const from = Math.max(1, +it.from || 1), to = Math.min(src.pages.length, +it.to || src.pages.length);
    let complete = true;
    for (const l of [].concat(it.l || [])) {
      if (!on.has(l)) continue;
      const f = "data/tr/" + l + "/" + it.id + ".json";
      let st; try { st = rd(f); } catch (e) { st = { id: it.id, l, p: {} }; }
      st.v = src.b.size || 0;
      for (let p = from; p <= to; p++) {
        if (st.p[p]) continue;
        if (budget <= 0 || fails > 12) { complete = false; break; }
        const text = src.pages[p - 1];
        try {
          const out = await TRC.translatePage({ text, lang: l, title: src.b.title, author: author(src.b.authorId), kind: kindOf(src.b) }, cfg, KEYS);
          out.s = "m"; out.at = new Date().toISOString().slice(0, 10); st.p[p] = out; budget--; done++;
          if (done % 10 === 0) { wr(f, st, true); reindex(idx, l, it.id, st, src.pages.length); wr("data/tr/index.json", idx); console.log(`${it.id} ${l}: ${Object.keys(st.p).length}/${src.pages.length}`); }
        } catch (e) { fails++; complete = false; console.log("تعذّرت", it.id, l, p, e.message); }
      }
      wr(f, st, true); reindex(idx, l, it.id, st, src.pages.length);
      if (budget <= 0) complete = false;
    }
    it.st = complete ? "done" : "part"; it.upd = new Date().toISOString().slice(0, 10);
    if (budget <= 0) break;
  }
  wr("data/tr/index.json", idx); wr("data/tr/_queue.json", Q);
  console.log(`تُرجمت ${done} صفحة في هذه الجولة؛ تعذّر ${fails}.`);
})();
