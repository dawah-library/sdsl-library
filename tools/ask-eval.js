#!/usr/bin/env node
// قياس مرحلة الاسترجاع في المساعد العلمي (المرحلة أ من خطة رفع المساعدين): بلا نموذج ذكاء اصطناعي ولا حصص.
// لكل سؤال من مجموعة التقييم (data/eval/ask-questions.json: فتاوى المكتبة ومرجع كل منها كتابًا وصفحة) يُنفَّذ ترتيب المرشحات
// نفسه الذي يستعمله askx.js على الفهرس المقلوب data/sx (يُبنى بـ tools/build-sx.py)، ثم يُقاس موضع المرجع الصحيح.
// المقاييس: كتاب المرجع ضمن أفضل 8 كتب، وصفحته ضمن أفضل 10 و30 صفحة مرشحة (بتسامح صفحة واحدة لاختلاف الترقيم).
// لكل سؤال صيغتان: «كاملة» (نص السؤال) و«مختصرة» (أطول 3 كلمات مفتاحية فقط: بحث أعضاء قصير).
// الاستعمال: node tools/ask-eval.js [--make]   (--make يبني قائمة الأسئلة من data/qa/_index.json بترتيب ثابت)
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, ".."), SX = path.join(R, "data", "sx"), OUT = path.join(R, "data", "eval");
require(path.join(R, "search.js")); const S = globalThis.SDSLSearch;
const T = (() => { const a = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; a[n] = c >>> 0; } return a; })();
const crc = s => { let c = 0xFFFFFFFF; for (const b of Buffer.from(s, "utf8")) c = T[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const P3 = /^[وفبلك](?=...)/;
const rj = f => JSON.parse(fs.readFileSync(f, "utf8"));
if (process.argv.includes("--make")) {
  const cat = rj(path.join(R, "data", "catalog.json")), ok = new Set(cat.books.filter(b => !b.hidden && !b.demo && (b.col || "dawah") === "dawah").map(b => b.id).concat(rj(path.join(R, "data", "articles", "index.json")).items.filter(a => !a.h && a.col !== "turath").map(a => a.id)));
  const items = rj(path.join(R, "data", "qa", "_index.json")).items.filter(x => ["fatwa", "suil", "sj"].includes(x[4]) && ok.has(x[2]) && x[1].length >= 30 && x[1].length <= 150 && !/^سُئل عن\s/.test(x[1]) || false);
  const seen = new Set(), pick = [];
  for (const x of items.sort((a, b) => crc(a[0]) - crc(b[0]))) { if (seen.has(x[2])) continue; seen.add(x[2]); pick.push({ id: x[0], q: x[1], book: x[2], page: x[3], kind: x[4] }); if (pick.length >= 100) break; }
  fs.writeFileSync(path.join(OUT, "ask-questions.json"), JSON.stringify({ note: "مجموعة التقييم (100 سؤال من فتاوى المكتبة بمرجع كتاب/صفحة): اختارها المساعد التنفيذي بترتيب ثابت وتنتظر مراجعة المستخدم.", items: pick }, null, 1)); console.log("أسئلة:", pick.length); process.exit(0);
}
const D = rj(path.join(SX, "_docs.json")), shards = new Map();
const shard = t => { const n = crc(t) % (D.shards || 2048); if (!shards.has(n)) { const f = path.join(SX, n + ".json"); shards.set(n, fs.existsSync(f) ? rj(f) : {}); } return shards.get(n)[t]; };
function run(q, relax) {
  const ts = S.terms(q); if (!ts.length) return { books: [], pages: [] };
  const N = D.n || 1, score = new Map();
  ts.forEach((t, j) => { const e = shard(t) || (P3.test(t) ? shard(t.replace(P3, "")) : null); if (!e) return; const idf = Math.log(1 + (N + 1) / (e[0] + .5));
    e[1].split(" ").forEach(x => { const [k, p, f] = x.split("."), id = D.k[k]; if (!id) return; const key = id + ":" + p, v = score.get(key) || { s: 0, m: new Set() }; v.s += idf * (1 + Math.log(+f || 1)); v.m.add(j); score.set(key, v); }); });
  let cand = [...score].map(([k, v]) => [k, v.s * Math.pow(v.m.size / ts.length, 2), v.m.size]);
  const full = cand.filter(c => c[2] === ts.length); if (!relax && ts.length > 1 && full.length >= 4) cand = full;
  cand.sort((a, b) => b[1] - a[1]);
  const byBook = new Map(); cand.forEach(([k, v]) => { const id = k.split(":")[0], l = byBook.get(id) || []; if (l.length < 3) l.push(v); byBook.set(id, l); });
  const books = [...byBook].map(([id, l]) => [id, l.reduce((a, b) => a + b, 0) + l[0]]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return { books, pages: cand.map(c => c[0]), nt: ts.length };
}
const kw = q => [...new Set(S.terms(q))].sort((a, b) => b.length - a.length).slice(0, 3).join(" ");
const Q = rj(path.join(OUT, "ask-questions.json")).items, res = [];
for (const it of Q) {
  const row = { id: it.id, book: it.book, page: it.page };
  for (const [name, q, rx] of [["full", it.q, 0], ["short", kw(it.q), 0], ["relaxed", it.q, 1]]) {
    const r = run(q, rx), bi = r.books.indexOf(it.book), pi = r.pages.findIndex(k => { const [b, p] = k.split(":"); return b === it.book && Math.abs(+p - it.page) <= 1; });
    row[name] = { terms: r.nt, bookRank: bi < 0 ? null : bi + 1, pageRank: pi < 0 ? null : pi + 1 };
  }
  res.push(row);
}
const rate = (n, f) => Math.round(100 * res.filter(f).length / res.length);
const sm = n => ({ book_at8: rate(n, r => r[n].bookRank && r[n].bookRank <= 8), page_at10: rate(n, r => r[n].pageRank && r[n].pageRank <= 10), page_at30: rate(n, r => r[n].pageRank && r[n].pageRank <= 30), missing: rate(n, r => !r[n].pageRank) });
const out = { at: new Date().toISOString(), n: res.length, pagesIndexed: D.n, summary: { full: sm("full"), short: sm("short"), relaxed: sm("relaxed") }, rows: res };
fs.writeFileSync(path.join(OUT, "ask-eval.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.summary), "pages", D.n);
