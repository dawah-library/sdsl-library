// مفاتيح الخدمات (data/switches.json): تكتبها الإدارة من «الإدارة ← الخدمات والمفاتيح».
// تُقرأ من المستودع مباشرة (لا من نسخة النشر) فيسري الإيقاف خلال دقائق دون إعادة نشر،
// وتُخزَّن دقيقة في الذاكرة. عند تعذر القراءة تعمل الخدمة (الفشل لا يوقف المكتبة).
const REPO = process.env.GITHUB_REPO || "dawah-library/sdsl-library";
let cache = { at: 0, s: {} };
async function switches() {
  if (Date.now() - cache.at < 60e3) return cache.s;
  try {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 1500);
    const r = await fetch("https://raw.githubusercontent.com/" + REPO + "/main/data/switches.json", { signal: ac.signal });
    clearTimeout(t);
    if (r.ok) cache = { at: Date.now(), s: ((await r.json()) || {}).s || {} };
    else if (r.status === 404) cache = { at: Date.now(), s: {} };
  } catch (e) { cache.at = Date.now() - 45e3; } // أعد المحاولة بعد ١٥ ثانية، وابقَ على آخر قيمة
  return cache.s;
}
// true إن كانت الخدمة تعمل
async function on(name) { const s = await switches(); return s[name] !== false; }
// يرد ٥٠٣ برسالة واضحة إن كانت الخدمة موقوفة، ويعيد true عندها
async function stopped(name, res, label) {
  if (await on(name)) return false;
  res.statusCode = 503; res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify({ error: "paused", message: (label ? "خدمة «" + label + "»" : "هذه الخدمة") + " موقوفة مؤقتًا من إدارة المكتبة. حاول لاحقًا." }));
  return true;
}
module.exports = { on, stopped, switches };
