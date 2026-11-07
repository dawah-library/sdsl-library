/* «مطبعة المجلة» (majpress) — النواة المشتركة لإخراج أعداد المجلات.
   يستعملها: صفحة الإخراج majpress/index.html (معاينة صفحات A4 وتصدير PDF)، وصفحة العدد في الموقع (majalla.js)، وأداة التصدير tools/majalla-pdf.js.
   المبدأ: النص العلمي لا يُغيَّر؛ ما يجري هنا تصنيف للعرض فقط (آية، حديث، بيت شعر، سؤال/جواب، قائمة، عنوان فرعي)
   وحذف علامات التحويل التي ليست من النص (أرقام صفحات المصدر، علامات الحواشي الملتصقة، رموز # الفارغة).
   يعمل في المتصفح (MJP عام) وفي Node (module.exports) للاختبار. */
(function (root) {
  "use strict";
  const SITE = "https://dawahlibrary.org/";
  const PUBLISHER = "المكتبة الرقمية للدعوة السلفية بمصر";
  const AR = "٠١٢٣٤٥٦٧٨٩";
  const toAr = n => String(n == null ? "" : n).replace(/\d/g, d => AR[d]);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
  const ordinal = n => ORD[n] || toAr(n);

  // ---------- الهوية: أنماط المواد ----------
  // st: نمط العرض المحفوظ في العدد؛ tpl: قالب الإخراج
  const STY = { news: "خبر", quiz: "نشاط ومسابقة", art: "مقال", tafsir: "تأملات قرآنية", hadith: "حديث وأثر", fatwa: "فتوى", quote: "قبس", bio: "ترجمة علَم", adab: "أدب ونثر", book: "من كتاب" };

  // ---------- سجل الأبواب: أيقونة وسطر تعريفي وقالب لكل باب معروف (ويُستنتج من اسمه) ----------
  const SECTIONS = [
    [/قرآن|تأملات|تفسير/, "quran", "وقفات مع آيات الكتاب العزيز"],
    [/مشكاة|النبوة|حديث|السنة/, "lamp", "من هدي النبي ﷺ وآثار السلف"],
    [/مقال العدد|ملف العدد/, "pen", "المقال الرئيس في موضوع العدد"],
    [/مشايخ|كتب الدعوة/, "books", "فصول من مؤلفات مشايخ الدعوة السلفية"],
    [/فتاو|فتوى/, "qa", "أسئلة وأجوبة من أهل العلم"],
    [/تراث|كنوز/, "scroll", "نفائس من كتب الأئمة والمتقدمين"],
    [/آداب/, "star", "آداب ومعالم في الطريق"],
    [/أعلام|تراجم|سير/, "medal", "سير وتراجم تُحيي القدوة"],
    [/تاريخ/, "hourglass", "عبر ودروس من صفحات التاريخ"],
    [/معاصر|قضايا/, "globe", "قضايا العصر في ميزان الشرع"],
    [/إخبار|أخبار/, "news", "أخبار العالم والمسلمين والدعوة"],
    [/الأسرة/, "home", "في بناء البيت المسلم وتربية الأبناء"],
    [/الطفل|الطلاب|الصغار/, "kids", "للأطفال والطلاب: توجيه وأنشطة"],
    [/النساء|الفتيات|المرأة/, "flower", "للمرأة المسلمة والفتاة"],
    [/الأدبي|أدب/, "feather", "واحة الأدب: نثر وشعر ونوادر"],
    [/قبسات|اقتباس|درر/, "quote", "درر وفوائد مختارة"]
  ];
  const secMeta = s => { const m = SECTIONS.find(([re]) => re.test(s.t || "")) || [null, s.corner === "kids" ? "kids" : "star", ""]; return { icon: s.icon || m[1], tag: s.tag || m[2] }; };

  // أيقونات خطية بسيطة موحدة (مسار واحد بخط ذهبي) — تُرسم بـ SVG فتبقى متجهة في PDF
  const ICONS = {
    quran: '<path d="M8 40V14c6-3 12-3 16 1 4-4 10-4 16-1v26c-6-3-12-3-16 1-4-4-10-4-16-1z"/><path d="M24 15v26"/><path d="M24 6l2 3 3 1-3 1-2 3-2-3-3-1 3-1z"/>',
    lamp: '<path d="M24 6v6"/><path d="M16 12h16l-3 8H19z"/><path d="M14 20h20v4c0 9-4 16-10 16S14 33 14 24z"/><path d="M24 26c2 3 2 6 0 8-2-2-2-5 0-8z"/>',
    pen: '<path d="M34 6l8 8-22 22-10 2 2-10z"/><path d="M30 10l8 8"/><path d="M8 42h32"/>',
    books: '<path d="M8 40V10h8v30M16 40V14h8v26M24 40l6-28 8 2-6 28z"/><path d="M6 42h36"/>',
    qa: '<path d="M6 10h24v14H16l-6 5v-5H6z"/><path d="M34 18h8v14h-4v5l-6-5H22v-4"/>',
    scroll: '<path d="M12 8h22a4 4 0 0 1 0 8H12a4 4 0 0 1 0-8z"/><path d="M12 16v20a4 4 0 0 0 4 4h22a4 4 0 0 0 0-8H18"/><path d="M18 22h14M18 28h10"/>',
    star: '<path d="M24 4l5 7 8 1-1 8 6 6-7 4-1 8-8-1-6 6-5-7-8-1 1-8-6-6 7-4 1-8 8 1z"/><circle cx="24" cy="24" r="6"/>',
    medal: '<circle cx="24" cy="28" r="12"/><path d="M18 6l6 10 6-10"/><path d="M24 22l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"/>',
    hourglass: '<path d="M12 6h24M12 42h24"/><path d="M14 6c0 10 10 12 10 18S14 32 14 42M34 6c0 10-10 12-10 18s10 8 10 18"/>',
    globe: '<circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c6 6 6 28 0 34M24 7c-6 6-6 28 0 34"/>',
    news: '<path d="M8 10h26v28H12a4 4 0 0 1-4-4z"/><path d="M34 16h6v18a4 4 0 0 1-4 4"/><path d="M13 16h16M13 22h16M13 28h10"/>',
    home: '<path d="M6 22L24 8l18 14"/><path d="M11 19v21h26V19"/><path d="M20 40V28h8v12"/>',
    kids: '<circle cx="24" cy="18" r="10"/><path d="M24 28c-1 4 1 6 0 8s-2 4 0 6"/><path d="M20 15h0M28 15h0M20 21c2 2 6 2 8 0"/>',
    flower: '<circle cx="24" cy="20" r="4"/><path d="M24 16c-3-7 3-10 0-12 3 2 3 5 0 12zM28 20c7-3 10 3 12 0-2 3-5 3-12 0zM20 20c-7-3-10 3-12 0 2 3 5 3 12 0zM24 24c-3 7 3 10 0 12"/><path d="M24 36v6M18 40c3-3 9-3 12 0"/>',
    feather: '<path d="M38 8C22 10 12 22 12 38l4-4c10 0 20-8 22-26z"/><path d="M8 42l14-14"/>',
    quote: '<path d="M10 30c0-9 4-14 10-16v4c-3 2-4 4-4 6h4v10H10zM28 30c0-9 4-14 10-16v4c-3 2-4 4-4 6h4v10H28z"/>'
  };
  const icon = (k, cls) => `<svg class="${cls || "ico"}" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.star}</svg>`;

  // زخارف: نجمة ثمانية، ونقش هندسي خفيف للخلفيات، وفاصل
  const star8 = (r, fill) => `<svg viewBox="-50 -50 100 100" aria-hidden="true"><g fill="${fill || "currentColor"}"><rect x="-${r}" y="-${r}" width="${2 * r}" height="${2 * r}"/><rect x="-${r}" y="-${r}" width="${2 * r}" height="${2 * r}" transform="rotate(45)"/></g></svg>`;
  // نقش «خاتم سليمان» المتشابك: بلاطة 80×80 تُكرَّر خلفيةً (بنسبة شفافية منخفضة)
  const patternTile = (color, op) => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><g fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.1"><rect x="22" y="22" width="36" height="36"/><rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)"/><circle cx="40" cy="40" r="7"/><path d="M0 0l22 22M80 0L58 22M0 80l22-22M80 80L58 58M40 0v4M40 76v4M0 40h4M76 40h4"/></g></svg>`;
  const patternURL = (color, op) => "url('data:image/svg+xml," + encodeURIComponent(patternTile(color, op)) + "')"; // علامة مفردة: تُضمَّن في style="…"

  // ---------- زخرفة الغلاف بحسب موضوع العدد ----------
  // motif في العدد يحدد الرسم، وإلا يُستنتج من الموضوع
  const MOTIFS = [[/علم|طلب|كتاب|قراءة/, "book"], [/صيام|رمضان|هلال/, "crescent"], [/حج|مكة|كعبة/, "kaaba"], [/صلاة|مسجد|جمعة/, "mosque"], [/أسرة|بيت|أولاد|تربية/, "home"], [/قرآن|تفسير/, "quran"]];
  const motifOf = x => x.motif || (MOTIFS.find(([re]) => re.test((x.theme || "") + " " + (x.title || ""))) || [0, "star"])[1];
  function motif(k) {
    const G = 'stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    const rays = n => Array.from({ length: n }, (_, i) => { const a = Math.PI * (1.05 + 0.9 * i / (n - 1)); return `<path d="M${(150 + 62 * Math.cos(a)).toFixed(1)} ${(128 + 62 * Math.sin(a)).toFixed(1)}L${(150 + 112 * Math.cos(a)).toFixed(1)} ${(128 + 112 * Math.sin(a)).toFixed(1)}" stroke-width="${i % 2 ? 1.2 : 2.2}" opacity="${i % 2 ? .55 : .9}"/>`; }).join("");
    const ring = `<g ${G} stroke-width="1.4" opacity=".7"><circle cx="150" cy="150" r="138"/><circle cx="150" cy="150" r="128" stroke-dasharray="2 6"/></g><g ${G} stroke-width="1.6" opacity=".9"><rect x="52" y="52" width="196" height="196"/><rect x="52" y="52" width="196" height="196" transform="rotate(45 150 150)"/></g>`;
    const body = {
      book: `<g ${G}>${rays(13)}<g stroke-width="3"><path d="M64 214c30-14 62-14 86 6 24-20 56-20 86-6v-74c-30-14-62-14-86 6-24-20-56-20-86-6z"/><path d="M150 146v74"/></g><g stroke-width="1.6" opacity=".8"><path d="M80 160c20-7 40-6 56 3M80 176c20-7 40-6 56 3M80 192c20-7 40-6 56 3M164 163c16-9 36-10 56-3M164 179c16-9 36-10 56-3M164 195c16-9 36-10 56-3"/></g></g>`,
      crescent: `<g ${G} stroke-width="3"><path d="M180 80a72 72 0 1 0 0 140 58 58 0 1 1 0-140z"/><path d="M196 120l6 12 13 2-10 9 3 13-12-7-12 7 3-13-10-9 13-2z"/></g>`,
      mosque: `<g ${G} stroke-width="3"><path d="M100 220v-60c0-26 22-44 50-56 28 12 50 30 50 56v60z"/><path d="M150 104V84M144 84h12M70 220V120M64 120h12l-6-14zM230 220V120M224 120h12l-6-14z"/><path d="M130 220v-34a20 20 0 0 1 40 0v34M56 220h188"/></g>`,
      kaaba: `<g ${G} stroke-width="3"><path d="M90 120l60-24 60 24v90l-60 24-60-24z"/><path d="M90 120l60 24 60-24M150 144v90"/><path d="M90 140l60 24 60-24" stroke-width="5" opacity=".8"/></g>`,
      home: `<g ${G} stroke-width="3"><path d="M70 160l80-66 80 66"/><path d="M90 146v74h120v-74"/><path d="M134 220v-44h32v44"/><path d="M150 112l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z"/></g>`,
      quran: `<g ${G} stroke-width="3"><path d="M150 214l-70-34v-70l70 34 70-34v70z"/><path d="M150 144v70M80 110l-14 8v70l84 40 84-40v-70l-14-8"/></g>`,
      star: ""
    };
    return `<svg class="motif" viewBox="0 0 300 300" aria-hidden="true">${ring}${body[k] != null ? body[k] : body.book}</svg>`;
  }

  // ---------- المكتبة: الفهرس والمقالات ونصوص الكتب ----------
  function Library(base, fetchJSON) {
    base = base || "";
    const fj = fetchJSON || (async (u) => { const r = await fetch(base + u, { cache: "no-cache" }); if (!r.ok) throw new Error("تعذر تحميل " + u); return r.json(); });
    let books = null, authors = null; const groups = {}, shards = {};
    const init = async () => {
      if (books) return;
      const [cat, ai] = await Promise.all([fj("data/catalog.json"), fj("data/articles/index.json").catch(() => ({ items: [] }))]);
      books = new Map(); authors = new Map((cat.authors || []).map(a => [a.id, a]));
      (cat.books || []).forEach(b => books.set(b.id, b));
      (ai.items || []).forEach(x => { if (!books.has(x.id)) books.set(x.id, { id: x.id, title: x.t, authorId: x.a, f: x.f, type: "article", col: x.col || "dawah", c: x.c, fa: x.fa, url: x.u, src: x.src }); });
    };
    const B = id => books && books.get(id);
    const A = id => { let a = authors.get(id); if (a && a.mergedInto && authors.get(a.mergedInto)) a = authors.get(a.mergedInto); return a || { name: "" }; };
    const isFatwa = b => !!(b.fa || /^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c || ""));
    const kindOf = b => b.type !== "article" ? "book" : isFatwa(b) ? "fatwa" : "article";
    async function pages(id) {
      const b = B(id); if (!b) throw new Error("مادة غير موجودة: " + id);
      if (shards[id]) return shards[id];
      if (b.f) { groups[b.f] = groups[b.f] || fj("data/articles/" + encodeURIComponent(b.f) + ".json"); const g = await groups[b.f]; if (!g[id]) throw new Error("المقال غير موجود في ملفه"); return (shards[id] = g[id].pages); }
      let sh; if (b.vf) { sh = await fj("vols/" + encodeURIComponent(id) + ".json").catch(() => fj("https://raw.githubusercontent.com/dawah-library/sdsl-library/main/vols/" + encodeURIComponent(id) + ".json")); }
      else sh = await fj("data/books/" + encodeURIComponent(id) + ".json");
      return (shards[id] = sh.pages || []);
    }
    return { init, B, A, kindOf, pages };
  }

  // نص المادة: المقال كاملًا، ومن الكتاب نطاق صفحات لا يتجاوز خمسًا، ثم اقتطاع الموضع (from … to) إن حُدد — منطق majalla.js نفسه
  function sliceText(all, it, isBook) {
    let t;
    // وصل الصفحات: إن انتهت الصفحة وسط جملة وُصلت بالتالية بمسافة لا بسطر جديد (فلا تنقسم الفقرة في العرض)
    const join = P => P.reduce((a, pg) => { pg = String(pg || "").trim(); if (!a) return pg; return a + (/([.!؟?:]["»”)]?|[»﴾}\]*])$/.test(a.trimEnd()) || /^#/.test(a.slice(a.lastIndexOf("\n") + 1)) || /^(#|[-*•]\s|\(\d+\/\d+\)$)/.test(pg) ? "\n" : " ") + pg; }, "");
    if (!isBook) t = join(all);
    else { const p = Math.max(1, it.p || 1), p2 = Math.min(all.length, Math.max(p, it.p2 || p), p + 4); t = join(all.slice(p - 1, p2)); }
    if (it.from) { const i = t.indexOf(it.from); if (i >= 0) { t = t.slice(i); if (it.to) { const j = t.indexOf(it.to); if (j >= 0) t = t.slice(0, j + it.to.length); } } }
    return t;
  }

  async function resolveItem(L, it, sec) {
    const st = it.st || "art";
    const o = { it, st, sec, title: it.title || "", orig: "", author: it.author || "", died: "", col: "", src: it.src || "", url: "", text: "", book: false, ref: it.ref || "" };
    if (it.ref) {
      const b = L.B(it.ref);
      if (!b) { o.text = ""; o.err = "المادة غير موجودة في المكتبة"; return o; }
      const a = L.A(b.authorId); o.book = L.kindOf(b) === "book";
      o.orig = b.setTitle || b.title || ""; o.title = it.title || b.title || ""; o.author = a.name || it.author || ""; o.died = a.died || "";
      o.col = (b.col || "dawah") === "dawah" ? "مكتبة الدعوة السلفية" : "المكتبة العامة";
      if (!it.st && L.kindOf(b) === "fatwa") o.st = "fatwa";
      const pg = o.book ? (it.p || 1) : 0;
      o.src = o.orig + (o.book ? "، ص " + toAr(it.p || 1) + (it.p2 > it.p ? "–" + toAr(it.p2) : "") : "");
      o.url = SITE + "#/book/" + encodeURIComponent(b.id) + (pg ? "/" + pg : "");
      try { o.text = sliceText(await L.pages(it.ref), it, o.book); } catch (e) { o.err = e.message; }
    } else o.text = it.text || "";
    if (o.title && o.orig && o.title === o.orig) o.orig = "";
    return o;
  }

  // ---------- تحليل النص إلى كتل عرض ----------
  const isMarker = s => /^\(\d+\/\d+\)$/.test(s) || /^[-–—_*•\s]+$/.test(s) || s === "#" || /^#+\s*$/.test(s);
  function clean(s) {
    return s.replace(/^@@\s*/, "").replace(/^<<\s*/, "").replace(/\[ص:\s*\d+\]/g, "").replace(/\[\[[^\]]*\]\]/g, "").replace(/\s*\(\d+\/\d+\)\s*/g, " ")
      .replace(/\s*«[\d٠-٩]{1,2}»/g, "")                         // علامات الحواشي «2» في المطبوع
      .replace(/([ء-يً-ْ»])\s?\(([\d٠-٩]{1,2})\)(?=[\s،.:؛!؟]|$)/g, "$1") // »(٤) إحالة إلى حاشية غير منقولة
      .replace(/([ء-يً-ْ])\d{1,2}(?=[\s،.:؛!؟)»"]|$)/g, "$1")   // رقم حاشية ملتصق بالكلمة
      .replace(/\s{2,}/g, " ").trim();
  }
  const VERSE = /^(.{6,70}?)\s+(?:\.\.\.|…)\s+(.{6,70})$/;
  const LABEL_Q = /^(السؤال|سؤال)\s*[:：]?\s*/, LABEL_A = /^(الجواب|الإجابة|الجـواب)\s*[:：]?\s*/;
  function parse(text, st, pasted) {
    const out = []; let num = null;
    const lines = String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
    // آية منقولة بلا أقواس في سطر مستقل يليه رقمها: «كما قال تعالى:» ⏎ نص ⏎ [البينة: 8] — تُعلَّم آية للعرض
    for (let i = 1; i < lines.length - 1; i++) if (/تعالى\s*[:：]$/.test(lines[i - 1]) && lines[i].length < 140 && !/[{﴿]/.test(lines[i]) && /^\[[ء-ي\s]{2,20}\s*[:：]\s*[\d٠-٩]/.test(lines[i + 1])) { lines[i] = "{" + lines[i] + "} " + lines[i + 1]; lines.splice(i + 1, 1); }
    for (let raw of lines) {
      if (isMarker(raw)) continue;
      const hn = raw.match(/^#+\s*([\d٠-٩]+)\s*[-–]\s*(.*)$/);
      if (hn) { if (!hn[2].trim()) { num = toAr(hn[1]); continue; } out.push({ t: "h", s: clean(hn[2]), n: toAr(hn[1]), lv: 3 }); continue; }
      const hh = raw.match(/^(#+)\s*(?:AUTO\s*)?(.*)$/);
      if (hh) { const s = clean(hh[2]).replace(/^\(\d+\)\s*/, m => m); if (s) out.push({ t: "h", s, lv: Math.min(4, hh[1].length + 2) }); continue; }
      const s = clean(raw); if (!s) continue;
      if (st === "fatwa" || /^(السؤال|الجواب|الإجابة)\s*[:：]/.test(s)) {
        const q = s.match(LABEL_Q), a = s.match(LABEL_A);
        if (q && (s.length < 12 || /^(السؤال|سؤال)\s*[:：]/.test(s))) { out.push({ t: "lab", k: "q", s: "السؤال" }); const r = s.slice(q[0].length).trim(); if (r) out.push({ t: "p", s: r }); continue; }
        if (a && (s.length < 12 || /^(الجواب|الإجابة)\s*[:：]/.test(s))) { out.push({ t: "lab", k: "a", s: "الجواب" }); const r = s.slice(a[0].length).trim(); if (r) out.push({ t: "p", s: r }); continue; }
      }
      const v = s.match(VERSE); if (v && !/[{﴿]/.test(s)) { out.push({ t: "v", a: v[1], b: v[2] }); continue; }
      if (s.length < 100 && !/[.،؛:]/.test(s) && ((s.match(/ـ{2,}|ـ\s/g) || []).length >= 2 || (out.length && out[out.length - 1].t === "v1" && s.length < 80))) { out.push({ t: "v1", s: s.replace(/\s*ـ+\s*/g, m => /\s/.test(m) ? "" : m) }); continue; }
      const li = s.match(/^[-*•]\s+(.*)$/); if (li) { out.push({ t: "li", s: li[1] }); continue; }
      const ol = s.match(/^([\d٠-٩]{1,2})\s*[-–)]\s*(.+)$/) || s.match(/^((?:أولًا|ثانيًا|ثالثًا|رابعًا|خامسًا|سادسًا|سابعًا|ثامنًا|تاسعًا|عاشرًا|أولا|ثانيا|ثالثا|رابعا|خامسا))\s*[:：-]\s*(.+)$/);
      if (ol) { out.push({ t: "ol", m: toAr(ol[1]), s: ol[2] }); continue; }
      if (s.length < 48 && /[:：]$/.test(s) && !/(تعالى|قال|يقول|وسلم|ﷺ)\s*[:：]$/.test(s) && !/^(و?قال|و?يقول|و?عن|روى)\s/.test(s)) { out.push({ t: "h", s: s.replace(/\s*[:：]$/, ""), lv: 5 }); continue; }
      const b = { t: "p", s }; if (num) { b.n = num; num = null; } out.push(b);
    }
    // القوائم الملصوقة: ثلاثة أسطر قصيرة متتالية فأكثر في نص ملصوق تُعرض قائمة
    if (pasted) for (let i = 0; i < out.length; i++) { let j = i; while (j < out.length && out[j].t === "p" && out[j].s.length < 120 && !/[:：]$/.test(out[j].s)) j++; if (j - i >= 3) { for (let k = i; k < j; k++) out[k].t = "li"; i = j; } }
    // الفقرة الأولى في المقال «مدخل» إن لم تكن خطبة الحاجة المعتادة
    return out;
  }

  // تنسيق داخل الفقرة: الآيات، ومتون الأحاديث بعد الصلاة على النبي ﷺ، والتخريج، وإحالات الآيات
  const AYREF = /\[([ء-ي\s]{2,20})\s*[:：]\s*([\d٠-٩\s\-–,،]{1,12})\]/g;
  function inline(s) {
    let h = esc(s);
    h = h.replace(/\{\s*([^{}]{2,900}?)\s*\}/g, (m, a) => `<span class="ay">﴿${a}﴾</span>`).replace(/﴿\s*([^﴿﴾]{2,900}?)\s*﴾/g, (m, a) => `<span class="ay">﴿${a}﴾</span>`);
    h = h.replace(/(<span class="ay">[^<]*<\/span>)<\/span>/g, "$1"); // حماية من التداخل
    h = h.replace(AYREF, (m, su, n) => `<span class="ayref">[${su.trim()}: ${toAr(n.trim())}]</span>`);
    // نمط المقالات: «( نص الآية ) (عبس:18 -19)» — الإحالة بين قوسين، والآية قبلها بين قوسين: تُميَّز مع بقاء أقواسها
    h = h.replace(/\(\s?([ء-ي]{2,12}(?:\s[ء-ي]{2,12})?)\s?[:：]\s?([\d٠-٩]{1,3}(?:\s?[-–]\s?[\d٠-٩]{1,3})?)\s?\)/g, (m, su, n) => `<span class="ayref">(${su}: ${toAr(n.replace(/\s/g, ""))})</span>`);
    h = h.replace(/\((\s?[^()<>]{3,500}?\s?)\)(\s*)(?=<span class="ayref">\()/g, (m, a, sp) => `<span class="ay">(${a})</span>${sp}`);
    h = h.replace(/(صلى الله عليه وسلم|ﷺ|عليه الصلاة والسلام|عليه السلام)((?:\s*-)?\s*(?:قال|أنه قال|يقول)?\s*[:،]?\s*)(«[^«»]{4,700}»|&quot;[^&]{4,700}?&quot;|\(\s[^()]{4,700}?\s\))/g, (m, a, b, c) => `${a}${b}<span class="hd">${c}</span>`);
    h = h.replace(/\((?:\s*)(رواه|أخرجه|متفق عليه|صححه|حسنه|رواه البخاري|رواه مسلم)([^()]{0,220})\)/g, (m) => `<span class="tk">${m}</span>`);
    h = h.replace(/(^|\s)(متفق عليه|رواه (?:البخاري|مسلم|الترمذي|أبو داود|النسائي|ابن ماجه|أحمد)(?: وغيره)?)([.،]?)(?=\s|$)/g, (m, a, b, c) => `${a}<span class="tk">${b}${c}</span>`);
    return h;
  }
  // الفقرة كلها آية أو حديث قصير: تُعرض كتلة مميزة
  const blockKind = s => { const t = s.replace(/^(قال|وقال)\s+(الله\s+)?تعالى\s*[:：]?\s*/, ""); if (/^[{﴿][^{}﴿﴾]+[}﴾]\s*(\[[^\]]+\])?\.?$/.test(t)) return "ayah"; return ""; };

  // ---------- تحويل الكتل إلى HTML (يشترك فيه الموقع وصفحة الإخراج) ----------
  function render(blocks, st, opt) {
    opt = opt || {}; const H = opt.hTag; // في الإخراج تُرسم العناوين الفرعية div حتى لا تزحم فهرس PDF الداخلي
    let h = "", list = null, qb = false; const close = () => { if (list) { h += list === "poem" ? "</div>" : `</${list}>`; list = null; } };
    blocks.forEach((b, i) => {
      if (b.t === "li" || b.t === "ol") { const tag = b.t === "li" ? "ul" : "ol"; if (list !== tag) { close(); h += `<${tag} class="mj-list">`; list = tag; } h += b.t === "ol" ? `<li><span class="mk">${esc(b.m)}</span>${inline(b.s)}</li>` : `<li>${inline(b.s)}</li>`; return; }
      if (b.t === "v" || b.t === "v1") { if (list !== "poem") { close(); h += `<div class="mj-poem">`; list = "poem"; } h += b.t === "v" ? `<div class="bt"><span>${esc(b.a)}</span><span>${esc(b.b)}</span></div>` : `<div class="bt one"><span>${esc(b.s)}</span></div>`; return; }
      close();
      if (b.t === "h") { const tg = H || (b.lv >= 5 ? "h6" : "h5"); h += `<${tg} class="mj-h${b.lv >= 5 ? " lab" : ""}">${b.n ? `<span class="num">${esc(b.n)}</span>` : ""}${esc(b.s)}</${tg}>`; }
      else if (b.t === "lab") { if (qb) { h += "</div>"; qb = false; } h += `<div class="mj-qa ${b.k}"><span>${b.s}</span></div>`; if (b.k === "q") { h += `<div class="qbox">`; qb = true; } }
      else { const k = blockKind(b.s); h += `<p class="${[k ? "mj-" + k : "", b.n ? "hn" : "", i === 0 && st === "art" && b.s.length > 140 && !/^الحمد لله/.test(b.s) ? "lead" : ""].filter(Boolean).join(" ")}"${b.n ? ` data-n="${esc(b.n)}"` : ""}>${b.n ? `<span class="num">${esc(b.n)}</span>` : ""}${inline(b.s)}</p>`; }
    });
    close(); if (qb) h += "</div>"; return h;
  }

  // ---------- العدد كاملًا: يحمّل المواد ويحللها (غير مرتبط بالواجهة) ----------
  async function compile(x, L, opt) {
    opt = opt || {};
    await L.init();
    const secs = [];
    for (const [si, s] of (x.secs || []).entries()) {
      const items = [];
      for (const [ii, it] of (s.items || []).entries()) {
        const o = await resolveItem(L, it, s.t); o.id = `m${si}-${ii}`;
        o.blocks = o.st === "quiz" ? parse(it.text || "", "quiz", true) : parse(o.text, o.st, !it.ref);
        items.push(o);
      }
      secs.push({ si, t: s.t, corner: s.corner || "", live: s.live || "", meta: secMeta(s), items, id: `s${si}` });
    }
    // أخبار العدد: لقطته المحفوظة عند صدوره، وإلا أخبار الشهر السابق لتاريخه
    const news = secs.some(s => s.live === "news") ? issueNews(x, opt.news) : [];
    return { x, secs, news, motif: motifOf(x) };
  }

  const fmtDate = d => { try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return d || ""; } };
  // ---------- الركن الإخباري (يشترك فيه الموقع وملف PDF) ----------
  const NCATS = [["dawah", "أخبار الدعوة السلفية", "lamp"], ["nour", "أخبار حزب النور", "medal"], ["muslims", "أخبار المسلمين", "star"], ["egypt", "الشأن المصري", "home"], ["region", "الأخبار الإقليمية", "globe"], ["world", "أخبار العالم", "news"]];
  const ncat = z => NCATS.some(c => c[0] === z.cat) ? z.cat : "world";
  const SRCC = { "آخر الأنباء": "akher", "حزب النور": "nour", "بوابة الفتح": "fath" };
  // أخبار العدد: لقطته المحفوظة عند صدوره، وإلا أخبار الشهر السابق لتاريخه حتى أسبوع بعده
  function issueNews(x, N) {
    if (x.news && (x.news.items || []).length) return x.news.items;
    const d0 = Date.parse(x.date), until = d0 + 7 * 864e5, since = d0 - 35 * 864e5;
    return ((N && N.items) || []).filter(z => { const d = Date.parse(z.date); return !z.date || (d <= until && d >= since); });
  }
  const ago = d => { const m = (Date.now() - Date.parse(d)) / 6e4; if (!(m >= 0)) return ""; if (m < 60) return "منذ " + toAr(Math.max(1, Math.round(m))) + " دقيقة"; if (m < 1440) return "منذ " + toAr(Math.round(m / 60)) + " ساعة"; if (m < 2880) return "أمس"; if (m < 43200) return "منذ " + toAr(Math.round(m / 1440)) + " أيام"; return fmtDate(d); };
  // بطاقات الأخبار للموقع: لكل قسم شريط عنوان، وأول خبر فيه بارز، والعنوان كاملًا والموجز والمصدر والتاريخ والرابط
  function newsHTML(L, opt) {
    opt = opt || {}; const per = opt.per || 5;
    const G = NCATS.map(c => [c, L.filter(z => ncat(z) === c[0]).slice(0, per)]).filter(g => g[1].length);
    if (!G.length) return '<p class="mjn-empty">تُجمع الأخبار آليًّا من مصادرها المعتمدة، وتظهر هنا عند أول تحديث.</p>';
    const card = (z, lead) => `<article class="mjn-card${lead ? " lead" : ""}"><a class="mjn-t" href="${esc(z.url)}" target="_blank" rel="noopener nofollow">${esc(z.title)}</a>${z.sum ? `<p class="mjn-s">${esc(z.sum)}</p>` : ""}<div class="mjn-m"><span class="mjn-src s-${SRCC[z.src] || "x"}">${esc(z.src || "")}</span>${z.date ? `<time datetime="${esc(z.date)}" title="${esc(fmtDate(z.date))}">${esc(opt.abs ? fmtDate(z.date) : ago(z.date))}</time>` : ""}${(z.also || []).length ? `<span class="mjn-also">ونشرته أيضًا: ${z.also.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener nofollow">${esc(a.src)}</a>`).join("، ")}</span>` : ""}<a class="mjn-go" href="${esc(z.url)}" target="_blank" rel="noopener nofollow">الخبر في مصدره ↗</a></div></article>`;
    return `<div class="mjn">${G.map(([c, a]) => `<section class="mjn-g" data-cat="${c[0]}"><h4 class="mjn-h">${icon(c[2], "mjn-i")}<span>${esc(c[1])}</span><small>${toAr(a.length)}</small></h4><div class="mjn-list">${a.map((z, i) => card(z, i === 0 && opt.lead !== false)).join("")}</div></section>`).join("")}</div>`;
  }

  const MJP = { SITE, PUBLISHER, STY, SECTIONS, NCATS, ncat, issueNews, newsHTML, ago, toAr, esc, ordinal, fmtDate, icon, star8, patternURL, motif, motifOf, secMeta, Library, sliceText, resolveItem, parse, inline, render, compile };
  if (typeof module !== "undefined" && module.exports) module.exports = MJP; else root.MJP = MJP;
})(typeof self !== "undefined" ? self : this);
