// قراءة ملفات البيانات: على Vercel من نظام الملفات، وعلى Cloudflare Pages من ذاكرة يملؤها المهايئ
// (functions/_lib/adapter.js) بنسخ الملفات الثابتة نفسها. الملف الناقص يُسجَّل ليجلبه المهايئ ويعيد المحاولة.
const key = p => String(p).replace(/\\/g, "/").replace(/^.*?(?=(?:^|\/)(?:data\/|index\.html$))\/?/, "");
module.exports = {
  readFileSync(p, enc) {
    const V = globalThis.__VFS;
    if (V) { const k = key(p); if (V.has(k)) return V.get(k); (globalThis.__VFS_MISS || new Set()).add(k); const e = new Error("ENOENT " + k); e.code = "ENOENT"; throw e; }
    return require("fs").readFileSync(p, enc);
  },
  key
};
