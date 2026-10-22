// يدمج ملفات التحديث (updates/*.json) المصدَّرة من صفحة الإدارة في بيانات المكتبة:
//   الكتب ← data/catalog.json و data/books/، والمقالات المستوردة ← data/articles/، والمنشورات ← data/posts.json
// الاستخدام: node tools/merge-update.js   (يعمل تلقائيًا عبر GitHub Actions عند رفع ملف إلى مجلد updates)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), data = path.join(root, "data"), upd = path.join(root, "updates"), done = path.join(upd, "done");
const readJSON = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } };
const catPath = path.join(data, "catalog.json"), idxPath = path.join(data, "articles", "index.json"), postsPath = path.join(data, "posts.json");
const cat = readJSON(catPath, null); if (!cat) { console.error("catalog.json غير موجود"); process.exit(1); }
const idx = readJSON(idxPath, { v: 1, items: [] }), posts = readJSON(postsPath, { items: [] }), groups = {};
const merge = (arr, items) => { items.forEach(x => { const i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else arr[i] = Object.assign({}, arr[i], x); }); };
const files = fs.existsSync(upd) ? fs.readdirSync(upd).filter(f => f.endsWith(".json")) : [];
if (!files.length) { console.log("لا توجد ملفات تحديث"); process.exit(0); }
fs.mkdirSync(done, { recursive: true });
let touchedIdx = false, touchedPosts = false;
for (const f of files) {
  const u = JSON.parse(fs.readFileSync(path.join(upd, f), "utf8"));
  if (u.format !== "sdsl-update-1") { console.error("تنسيق غير معروف:", f); process.exit(1); }
  merge(cat.authors, u.authors || []);
  merge(cat.topics, u.topics || []);
  for (const b of u.books || []) {
    if (!/^[\w-]+$/.test(b.id)) { console.error("معرف غير صالح:", b.id); process.exit(1); }
    const sh = (u.shards || {})[b.id];
    delete b.edited;
    // تعديل مقال مستورد: يُكتب في ملفه الشهري وفهرس المقالات
    const ai = idx.items.find(x => x.id === b.id);
    if (ai) {
      if (sh) { const gp = path.join(data, "articles", ai.f + ".json"); const g = groups[ai.f] || (groups[ai.f] = readJSON(gp, {})); g[b.id] = { pages: sh.pages }; ai.n = sh.pages.length; }
      if (b.title) ai.t = b.title; if (b.authorId) ai.a = b.authorId; if (b.topicId) ai.tp = b.topicId; if ("pdf" in b) ai.pdf = b.pdf;
      touchedIdx = true; continue;
    }
    if (sh) {
      const s = JSON.stringify({ id: b.id, pages: sh.pages, toc: sh.toc || [], ...(sh.pl ? { pl: sh.pl } : {}) });
      fs.writeFileSync(path.join(data, "books", b.id + ".json"), s);
      b.n = sh.pages.length; b.size = Buffer.byteLength(s);
    }
    if (!cat.books.some(x => x.id === b.id) && !b.title) { console.warn("تخطي تعديل لعنصر غير معروف:", b.id); continue; }
    merge(cat.books, [b]);
  }
  for (const id of u.deleted || []) {
    cat.books = cat.books.filter(b => b.id !== id);
    const p = path.join(data, "books", id + ".json"); if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  if ((u.posts || []).length || (u.deletedPosts || []).length) {
    merge(posts.items, u.posts || []);
    const del = new Set(u.deletedPosts || []); posts.items = posts.items.filter(p => !del.has(p.id));
    posts.items.sort((x, y) => String(y.d || "").localeCompare(String(x.d || "")));
    touchedPosts = true;
  }
  fs.renameSync(path.join(upd, f), path.join(done, f));
  console.log("دُمج:", f, "—", (u.books || []).length, "عنصر،", (u.posts || []).length, "منشور");
}
for (const [g, obj] of Object.entries(groups)) fs.writeFileSync(path.join(data, "articles", g + ".json"), JSON.stringify(obj));
if (touchedIdx) fs.writeFileSync(idxPath, JSON.stringify(idx));
if (touchedPosts) fs.writeFileSync(postsPath, JSON.stringify(posts));
cat.version = Date.now();
fs.writeFileSync(catPath, JSON.stringify(cat));
