// حدّ بسيط لعدد الطلبات لكل عنوان IP (في ذاكرة كل نسخة من الدالة) — يمنع الإغراق واستنزاف الحصص
const B = new Map();
function ipOf(req) { return String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?"; }
function limited(req, key, max, windowMs) {
  const k = key + "|" + ipOf(req), now = Date.now(), a = (B.get(k) || []).filter(t => now - t < windowMs);
  a.push(now); B.set(k, a);
  if (B.size > 5000) for (const [kk, v] of B) if (!v.length || now - v[v.length - 1] > windowMs) B.delete(kk);
  return a.length > max;
}
module.exports = { limited, ipOf };
