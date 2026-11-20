// نقل حركات النموذج إلى النص الأصلي كلمةً كلمة (نظير transfer في tools/tashkeel.py): لا يتغير حرف ولا كلمة ولا علامة ترقيم أبدًا؛
// الكلمة التي تغيّرت حروفها عند النموذج تبقى كما في الأصل، والكلمة المشكولة في الأصل (آية أو حديث مضبوط) تبقى بضبطها.
const AR = /[ء-يٱ]/, DI = /[ً-ْٰ]/;
const skel = t => [...t].filter(c => AR.test(c)).join("");
const ratio = t => { const l = [...t].filter(c => AR.test(c)).length; return l ? [...t].filter(c => DI.test(c)).length / l : 1; };
function units(t) { const u = []; for (const c of t) { if (AR.test(c)) u.push([c, ""]); else if (DI.test(c) && u.length) u[u.length - 1][1] += c; } return u; }
function transfer(src, out) {
  const st = src.split(/(\s+)/), ot = out.split(/\s+/).filter(t => skel(t)); let oi = 0, ok = 0, tot = 0; const res = [];
  for (const t of st) {
    const sk = skel(t); if (!sk || /^\s+$/.test(t)) { res.push(t); continue; } tot++;
    if (DI.test(t) && ratio(t) > 0.5) { res.push(t); for (let j = oi; j < Math.min(oi + 4, ot.length); j++) if (skel(ot[j]) === sk) { oi = j + 1; break; } ok++; continue; }
    let hit = -1; for (let j = oi; j < Math.min(oi + 6, ot.length); j++) if (skel(ot[j]) === sk) { hit = j; break; }
    if (hit < 0) { res.push(t); continue; }
    const u = units(ot[hit]); oi = hit + 1; let k = 0, b = "";
    for (const c of t) { if (AR.test(c)) { b += c + (k < u.length ? u[k][1] : ""); k++; } else if (!DI.test(c)) b += c; }
    res.push(b); ok++;
  }
  return { text: res.join(""), cover: tot ? ok / tot : 1 };
}
// التشكيل الجزئي: الشدة في كل موضع، وحركة آخر الكلمة (الإعراب والتنوين) فقط؛ والكلمة المشكولة في الأصل تبقى كاملة
function partial(full, src) {
  const keep = new Set(src.split(/\s+/).filter(t => DI.test(t) && ratio(t) > 0.5));
  return full.split(/(\s+)/).map(t => {
    if (keep.has(t) || !skel(t)) return t;
    const u = units(t), n = u.length; let k = 0, b = "";
    for (const c of t) { if (AR.test(c)) { k++; b += c; } else if (DI.test(c)) { if (c === "ّ" || k === n) b += c; } else b += c; }
    return b;
  }).join("");
}
module.exports = { transfer, partial, skel };
