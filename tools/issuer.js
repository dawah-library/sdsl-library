// الجهة المصدِرة للبيان (طلب المدير، ٢٧ نوفمبر ٢٠٢٦): ما يُستجلب من موقع صوت السلف لا يُنسب إلى «صوت السلف» (a8)
// إذا كان للنص جهة مصدرة معلنة في عنوانه: «بيان من الدعوة السلفية» ← الدعوة السلفية (a9)، «بيان من حزب النور» ← حزب النور (a10)،
// والبيان المشترك ← الدعوة السلفية، ومعها حزب النور في co (فيظهر في صفحتي الجهتين، وتبقى بيانات كل جهة منفصلة).
// يستعمله الاستيراد اليومي (tools/daily-import.js)، ويُطبَّق على المستجلب سابقًا بـ: node tools/issuer.js --apply
const norm = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .replace(/["«»“”'()]/g, " ").replace(/\s+/g, " ").trim();
const DAWAH = "a9", NOUR = "a10";
// ← {a, co} أو null إن لم تُعلن جهة مصدرة
function issuer(title) {
  const t = norm(title);
  const head = t.match(/^(?:بيان|بلاغ|تصريح|نداء|رساله|تنويه|توضيح|اعلان)(?:\s+(?:هام|عاجل|مشترك))?\s+(?:صادر\s+)?(?:من|عن|ل)?\s*(.{0,80})/);
  const lead = head ? head[1] : t.match(/^((?:ال)?دعوه السلفيه|حزب النور)\s+(?:تعلن|يعلن|تدين|يدين|تحذر|يحذر|تطالب|يطالب|تنعي|ينعي|تهنئ|يهنئ|تؤكد|يؤكد|تستنكر|يستنكر|ترحب|يرحب)/) ? t : null;
  if (!lead) return null;
  const d = /^(?:مجلس اداره\s+|مجلس شوري\s+)?(?:ال)?دعوه السلفيه/.test(lead), n = /^(?:الهيئه العليا ل|المكتب الاعلامي ل|رئيس )?حزب النور/.test(lead);
  const both = /^(?:ال)?دعوه السلفيه\s+و\s*حزب النور|^حزب النور\s+و\s*(?:ال)?دعوه السلفيه/.test(lead);
  if (both) return { a: DAWAH, co: [NOUR] };
  if (d) return { a: DAWAH };
  if (n) return { a: NOUR };
  return null;
}
module.exports = { issuer };

if (require.main === module) {
  const fs = require("fs"), path = require("path"), P = path.join(__dirname, "..", "data", "articles", "index.json");
  const apply = process.argv.includes("--apply"), J = JSON.parse(fs.readFileSync(P, "utf8"));
  let n = 0; const by = {};
  for (const x of J.items) {
    if (x.a !== "a8" || x.iss) continue;
    const r = issuer(x.t); if (!r) continue;
    n++; by[r.a + (r.co ? "+" + r.co.join(",") : "")] = (by[r.a + (r.co ? "+" + r.co.join(",") : "")] || 0) + 1;
    if (!apply) { if (n <= 40) console.log(r.a, r.co || "", "|", x.t); continue; }
    x.a = r.a; x.iss = "a8"; if (r.co) x.co = r.co;  // iss: النسبة السابقة محفوظة للمراجعة والاسترجاع
  }
  console.log("المعاد نسبته:", n, JSON.stringify(by));
  if (apply) fs.writeFileSync(P, JSON.stringify(J, null, J.__indent || undefined) + (fs.readFileSync(P, "utf8").endsWith("\n") ? "\n" : ""));
}
