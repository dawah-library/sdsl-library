// يدمج ملفات التحديث (updates/*.json) المصدَّرة من صفحة الإدارة في data/catalog.json و data/books/
// الاستخدام: node tools/merge-update.js   (يعمل تلقائيًا عبر GitHub Actions عند رفع ملف إلى مجلد updates)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), data = path.join(root, "data"), upd = path.join(root, "updates"), done = path.join(upd, "done");
const catPath = path.join(data, "catalog.json");
const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
const merge = (arr, items) => { items.forEach(x => { const i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else arr[i] = Object.assign({}, arr[i], x); }); };
const files = fs.existsSync(upd) ? fs.readdirSync(upd).filter(f => f.endsWith(".json")) : [];
if (!files.length) { console.log("لا توجد ملفات تحديث"); process.exit(0); }
fs.mkdirSync(done, { recursive: true });
for (const f of files) {
  const u = JSON.parse(fs.readFileSync(path.join(upd, f), "utf8"));
  if (u.format !== "sdsl-update-1") { console.error("تنسيق غير معروف:", f); process.exit(1); }
  merge(cat.authors, u.authors || []);
  merge(cat.topics, u.topics || []);
  for (const b of u.books || []) {
    const sh = (u.shards || {})[b.id];
    if (!/^[\w-]+$/.test(b.id)) { console.error("معرف غير صالح:", b.id); process.exit(1); }
    if (sh) {
      const s = JSON.stringify({ id: b.id, pages: sh.pages, toc: sh.toc || [], ...(sh.pl ? { pl: sh.pl } : {}) });
      fs.writeFileSync(path.join(data, "books", b.id + ".json"), s);
      b.n = sh.pages.length; b.size = Buffer.byteLength(s);
    }
    delete b.edited;
    merge(cat.books, [b]);
  }
  for (const id of u.deleted || []) {
    cat.books = cat.books.filter(b => b.id !== id);
    const p = path.join(data, "books", id + ".json"); if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  fs.renameSync(path.join(upd, f), path.join(done, f));
  console.log("دُمج:", f, "—", (u.books || []).length, "عنصر");
}
cat.version = Date.now();
fs.writeFileSync(catPath, JSON.stringify(cat));
