// نسبة منشورات فيسبوك المستجلبة إلى صاحبها الفعلي في قائمة المؤلفين.
// لا يمس آلية الجلب (fb-harvest.js وGraph API): يعمل بعد الجلب فقط في خطوة الربط بالمؤلف.
// - لمصدر له aid صالح: يُستعمل (مع اتباع mergedInto).
// - بلا aid: مطابقة تامة بالاسم أو الأسماء البديلة ← يُربط.
// - لا تطابق: يُنشأ مؤلف مقترح (auto + status "مقترح" + fb) فلا يظهر المنشور باسم المكتبة؛
//   وإن وُجد مؤلف قريب الاسم يُسجَّل في data/author-review.json لتختار الإدارة الدمج (لا دمج آلي).
// - الأسماء «(غير معروف: ...)» لا يُنشأ لها مؤلف (تنتظر اسمًا من الإدارة).
// الاستخدام: node tools/fb-author.js            (تقرير فقط، لا كتابة)
//            node tools/fb-author.js --apply    (يكتب aid في sources.json، المؤلفين في catalog.json، authorId في posts.json)
const fs = require("fs"), path = require("path");
const DATA = path.join(__dirname, "..", "data");
const P = { cat: path.join(DATA, "catalog.json"), src: path.join(DATA, "sources.json"), posts: path.join(DATA, "posts.json"), rev: path.join(DATA, "author-review.json") };
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const norm = s => String(s || "").replace(/[ً-ْـ​-‏‪-‮﻿]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
const bare = s => norm(s).replace(/^(الشيخ|الدكتور|دكتور|الاستاذ|الاستاذه|المهندس|د[.\/]?|م[.\/]|ا[.\/])\s*/, "").replace(/\s*-?\s*(حفظه الله|رحمه الله)$/, "").replace(/(^|\s)(عبد|ابو)\s+/g, "$1$2").replace(/\s+/g, " ").trim();
const tok = s => bare(s).split(/\s+/).filter(Boolean);
const unknown = n => /^\(?\s*غير معروف/.test(String(n || ""));
const live = cat => cat.authors.filter(a => (a.col || "dawah") === "dawah" && !a.mergedInto);
const follow = (cat, id) => { let a = cat.authors.find(x => x.id === id), n = 0; while (a && a.mergedInto && n++ < 5) a = cat.authors.find(x => x.id === a.mergedInto); return a; };

// يعيد { aid, created, near } أو null إن لم يصلح الاسم. يعدّل cat في الذاكرة فقط.
function resolveAuthor(src, cat) {
  const cur = src.aid && follow(cat, src.aid); if (cur) return { aid: cur.id, created: false, near: null };
  const name = String(src.author || src.name || "").trim(); if (!name || unknown(name)) return null;
  const b = bare(name); if (b.length < 3) return null;
  const L = live(cat);
  const exact = L.find(a => bare(a.name) === b || (a.aliases || []).some(x => bare(x) === b)); if (exact) return { aid: exact.id, created: false, near: null };
  const nb = tok(name);
  const near = nb.length >= 2 ? L.filter(a => [a.name].concat(a.aliases || []).some(n => { const t = tok(n), S = t.length <= nb.length ? t : nb, G = t.length <= nb.length ? nb : t; return S.length >= 2 && S[0] === G[0] && S[S.length - 1] === G[G.length - 1]; })).map(a => a.id) : [];
  const id = "w" + (Math.max(0, ...cat.authors.filter(a => /^w\d+$/.test(a.id)).map(a => +a.id.slice(1))) + 1);
  const rec = { id, name, col: "dawah", bio: "", auto: true, status: "مقترح" }; if (src.url) rec.fb = src.url;
  cat.authors.push(rec); return { aid: id, created: true, near };
}

function saveReview(items) { if (!items.length) return; const R = readJSON(P.rev, { items: [] }); items.forEach(x => { if (!R.items.some(y => y.aid === x.aid && y.src === x.src)) R.items.push(x); }); fs.writeFileSync(P.rev, JSON.stringify(R)); }

// الإصلاح الرجعي: يملأ aid للمصادر بلا aid، ويحدد authorId للمنشورات المستجلبة من فيسبوك التي بلا مؤلف.
function backfill(apply) {
  const cat = readJSON(P.cat), S = readJSON(P.src), PO = readJSON(P.posts), rep = { sources: [], posts: 0, skipped: [], review: [] };
  const fbs = S.sources.filter(s => s.type === "facebook");
  for (const s of fbs) {
    if (s.aid && follow(cat, s.aid)) continue;
    const r = resolveAuthor(s, cat);
    if (!r) { rep.skipped.push(s.id + " (" + (s.author || s.name) + ")"); continue; }
    s.aid = r.aid; rep.sources.push({ src: s.id, aid: r.aid, name: s.author || s.name, created: r.created, near: r.near });
    if (r.near && r.near.length) rep.review.push({ src: s.id, aid: r.aid, name: s.author || s.name, near: r.near, at: new Date().toISOString() });
  }
  const byPrefix = new Map(fbs.map(s => [s.id.replace(/^fb-/, "").slice(0, 12), s]));
  for (const p of PO.items) {
    if (p.authorId || p.src !== "فيس بوك") continue;
    const m = String(p.id).match(/^fb(.*?)(p\d+|pfbid.*|\d+)$/); let s = null;
    for (const [k, v] of byPrefix) if (String(p.id).startsWith("fb" + k) && v.aid) { s = v; break; }
    if (s) { p.authorId = s.aid; rep.posts++; }
  }
  rep.unmatchedPosts = PO.items.filter(p => !p.authorId && p.src === "فيس بوك").map(p => p.id);
  if (apply) {
    if (rep.sources.some(x => x.created)) { cat.version = Date.now(); fs.writeFileSync(P.cat, JSON.stringify(cat)); }
    fs.writeFileSync(P.src, JSON.stringify(S, null, 1)); fs.writeFileSync(P.posts, JSON.stringify(PO)); saveReview(rep.review);
  }
  return rep;
}
module.exports = { resolveAuthor, backfill, saveReview, bare };
if (require.main === module) { const apply = process.argv.includes("--apply"), r = backfill(apply); console.log(JSON.stringify(r, null, 1)); console.log(apply ? "تم الحفظ." : "تقرير فقط: لم يُكتب شيء (استعمل --apply)."); }
