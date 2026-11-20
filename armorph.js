/* المحلل الصرفي العربي الخفيف للبحث (يعمل في المتصفح وفي Node):
   norm: توحيد الهمزات والتاء المربوطة والألف المقصورة وحذف التشكيل والتطويل.
   stem: الجذع الخفيف (حذف السوابق واللواحق الشائعة) — للبحث «بالكلمة ومشتقاتها».
   root: الجذر الثلاثي على طريقة ISRI (Taghva 2005) مبسطة — للبحث «بالجذر».
   لا يغيّر النص المعروض أبدًا؛ يُستعمل للمطابقة فقط. القرار في DECISIONS.md (ق-٣). */
(function (G) {
  "use strict";
  const strip = s => String(s).replace(/[ً-ٰٟۖ-ۭـ]/g, "");
  const norm = s => strip(s).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ؤئ]/g, "ء");
  const P3 = ["كال", "بال", "ولل", "وال", "فال", "فلل"], P2 = ["ال", "لل"], P1 = ["و", "ف", "ب", "ك", "ل", "س"];
  const S3 = ["تمل", "همل", "تان", "تين", "كمل", "كما", "هما", "تما"], S2 = ["ون", "ات", "ان", "ين", "تن", "كم", "هن", "نا", "يا", "ها", "تم", "كن", "ني", "وا", "ما", "هم", "يه", "يين"], S1 = ["ه", "ي", "ك", "ت", "ا", "ن"];
  const C = new Map();
  /* السوابق تُحذف قبل توحيد الهمزات: «ألسنة» ليست «ال+سنة» (المحدد بألف بلا همزة فقط)؛ ويُعلَّم آخر التاء المربوطة */
  function pre(w) {
    let s = strip(w).replace(/[^ء-ي]/g, "");
    for (const p of P3) if (s.startsWith(p) && s.length - 3 >= 3) { s = s.slice(3); break; }
    for (const p of P2) if (s.startsWith(p) && s.length - 2 >= 3) { s = s.slice(2); break; }
    return [norm(s), /ة$/.test(s)];
  }
  function stem(w) {
    [w] = pre(w); if (w.length < 4) return w;
    if (w.length >= 5 && /^[وف]/.test(w)) w = w.slice(1);
    for (const s of S3) if (w.endsWith(s) && w.length - 3 >= 3) { w = w.slice(0, -3); break; }
    for (const s of S2) if (w.endsWith(s) && w.length - 2 >= 3) { w = w.slice(0, -2); break; }
    if (w.length >= 4 && /[هي]$/.test(w)) w = w.slice(0, -1);
    return w;
  }
  // أنماط الأوزان (موضع الحروف الأصلية بعد حذف الزوائد) — ISRI pr4/pr53/pr54/pr63
  function root(w) {
    const k = w; if (C.has(k)) return C.get(k);
    let [s, tm] = pre(w);
    if (tm && s.length >= 3) s = s.slice(0, -1);                          // التاء المربوطة ليست من الجذر
    if (s.length >= 4 && /^[وف]/.test(s)) s = s.slice(1);
    for (const x of S3) if (s.endsWith(x) && s.length - 3 >= 3) { s = s.slice(0, -3); break; }
    for (const x of S2) if (s.endsWith(x) && s.length - 2 >= 3) { s = s.slice(0, -2); break; }
    if (s.length >= 5) for (const x of S1) if (s.endsWith(x) && s.length - 1 >= 3) { s = s.slice(0, -1); break; }
    let r = s;
    if (s.length === 4) r = pr4(s);
    else if (s.length === 5) r = pr5(s);
    else if (s.length === 6) r = pr6(s);
    r = r.replace(/^ء/, "ا");
    if (r.length === 2) r = r + r[1];  // المضعف: مد ← مدد
    if (r.length === 3) r = r[0] + r.slice(1).replace(/[اويء]/g, "ي");  // المعتل والمهموز: صلا/صلو/صلي، قال/قول ← حرف علة واحد
    if (C.size > 200000) C.clear(); C.set(k, r); return r;
  }
  function pr4(s) {
    const [a, b, c, d] = s;
    if (a === "م" && b !== "ا") return b + c + d;                       // مفعل: موحد، مكتب
    if (a === "ي" || (a === "ت" && b !== "ا" && c !== "ا")) return b + c + d;        // المضارع: يقول، تكتب
    if (c === "ا" && d === "ه") return a + b + c;                       // فعاة: صلاة، زكاة
    if (b === "ا" || b === "و" || b === "ي") return a + c + d;          // فاعل، فوعل، فيعل
    if (c === "ا" || c === "و" || c === "ي") return a + b + d;          // فعال، فعول، فعيل
    if (d === "ه" || d === "ت") return a + b + c;                       // فعله
    if (a === "م" || a === "ا" || a === "ت" || a === "ي" || a === "ن") return b + c + d; // مفعل، افعل، تفعل، يفعل
    return s;
  }
  function pr5(s) {
    const [a, b, c, d, e] = s;
    if (a === "ا" && c === "ت") return b + d + e;                       // افتعل
    if (a === "ا" && b === "ن") return c + d + e;                       // انفعل
    if (a === "م" && c === "ا") return b + d + e;                       // مفاعل
    if (a === "م" && d === "و") return b + c + e;                       // مفعول
    if (a === "م" && d === "ي") return b + c + e;                       // مفعيل
    if (a === "ت" && c === "ا") return b + d + e;                       // تفاعل
    if (a === "م" && c === "ت") return b + d + e;                       // مفتعل
    if (a === "ت" && b !== "ا") return pr4(s.slice(1));                // تفعّل
    if (b === "ا" && d === "و") return a + c + e;                       // فاعول
    if (c === "ا" && d === "ي") return a + b + e;                       // فعاليل
    if (b === "ا" && d === "ي") return a + c + e;                       // فاعيل
    if (c === "ا" && e === "ه") return a + b + d;                       // فعاله
    if (c === "ي" && e === "ه") return a + b + d;                       // فعيله
    if (d === "ا" && e === "ن") return a + b + c;                       // فعلان
    if (a === "م" || a === "ي" || a === "ت" || a === "ا" || a === "ن") return pr4(s.slice(1));
    if (e === "ه" || e === "ت") return pr4(s.slice(0, 4));
    return s.slice(0, 3);
  }
  function pr6(s) {
    if (s.startsWith("است")) return s.slice(3);                          // استفعل
    if (s[0] === "م" && s[1] === "س" && s[2] === "ت") return s.slice(3); // مستفعل
    if (s[0] === "م" && s[3] === "ا") return s[1] + s[2] + s[4];        // مفعال…
    if (s[0] === "ا" && s[2] === "ت" && s[4] === "ا") return s[1] + s[3] + s[5]; // افتعال
    if (s[0] === "ا" && s[1] === "ن" && s[4] === "ا") return s[2] + s[3] + s[5]; // انفعال
    if (s[0] === "ت" && s[2] === "ا") return s[1] + s[3] + s[4];        // تفاعيل…
    return pr5(s.slice(1));
  }
  const words = t => strip(t).split(/[^ء-ي]+/).filter(Boolean);  // بلا توحيد: السوابق والتاء المربوطة تُقرأ من الأصل
  /* مطابِق للصفحة بحسب الوضع: word (الكلمة كما هي) | stem (مشتقاتها) | root (جذرها).
     يعيد دالة (النص الأصلي) ← مجموعة الكلمات المطابقة (موحَّدة) (للتلوين) أو null. */
  function matcher(q, mode) {
    const qs = words(q); if (!qs.length) return null;
    const key = mode === "root" ? root : stem, want = qs.map(key);
    const pre = want.map(k => { const L = [...k].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); return new RegExp(mode === "root" ? L.join("[ء-ي]{0,3}") : L.join("")); });
    return function (text, all) {
      const nt = norm(text); if (!(all ? pre.every(r => r.test(nt)) : pre.some(r => r.test(nt)))) return null;
      const hit = new Set(), found = new Set();
      for (const w of words(text)) { const k = key(w), j = want.indexOf(k); if (j >= 0) { hit.add(norm(w)); found.add(j); } }
      return (all ? found.size === want.length : found.size) ? hit : null;
    };
  }
  const century = died => died ? Math.ceil(+died / 100) : 15;  // من لا وفاة له في الفهرس معاصر (ق ١٥)
  G.ARMORPH = { norm, strip, stem, root, words, matcher, century };
})(typeof globalThis !== "undefined" ? globalThis : this);
