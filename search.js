/* محرك البحث المشترك: يعمل في المتصفح وفي دالة الخادم (api/ask.js)
   lib = {authors, topics, books:[{id,title,authorId,col,type,demo,pages?,pl?}]}
   الكتب التي لم تُحمَّل نصوصها (pages غير موجودة) تُتخطّى. */
(function (G) {
  "use strict";
  const strip = s => String(s).replace(/[ً-ٰٟۖ-ۭـ]/g, "");
  const plain = s => String(s).replace(/^# /gm, "");
  const norm = s => strip(s).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
  const STOP = new Set("في من على عن الى إلى ما ماذا هل كيف لماذا متى اين أين هو هي هم ذلك هذا هذه التي الذي الذين كان كانت ان أن إن او أو ثم مع عند كل بين قد لا لم لن حتى اذا إذا يا و ف ب ل اريد أريد اشرح وضح بين ابحث عن حكم قول قال".split(" ").map(norm));
  const cache = new WeakMap();
  const pn = b => { let c = cache.get(b); if (!c || c.src !== b.pages) { c = { src: b.pages, n: b.pages.map(p => norm(plain(p))) }; cache.set(b, c); } return c.n; };
  function terms(q) {
    const out = [];
    norm(q).replace(/[^ء-ي0-9a-z\s]/g, " ").split(/\s+/).forEach(w => {
      if (!w || STOP.has(w) || w.length < 2) return;
      let v = w.replace(/^(و|ف)(?=ال)/, "").replace(/^(وال|فال|بال|كال|لل|ال)(?=..)/, "");
      if (v.length < 2) v = w;
      if (!out.includes(v)) out.push(v);
    });
    return out;
  }
  const label = (b, i) => (b.pl && b.pl[i]) || (b.type === "article" ? "" : "ص " + (i + 1));
  const kind = b => b.type === "article" ? "مقال" : "كتاب";
  const colName = b => b.col === "turath" ? "تراث" : "مكتبة الدعوة السلفية";
  function excerpt(text, ts, max) {
    const s = strip(plain(text)), n = norm(s); let at = -1;
    for (const t of ts) { const k = n.indexOf(t); if (k >= 0 && (at < 0 || k < at)) at = k; }
    const a = Math.max(0, (at < 0 ? 0 : at) - Math.floor(max / 3));
    return (a ? "…" : "") + s.slice(a, a + max).trim() + (a + max < s.length ? "…" : "");
  }
  function pick(lib, o) {
    return lib.books.filter(b => b.pages && (o.includeDemo || !b.demo) && (!o.col || (b.col || "dawah") === o.col) && (!o.bookId || b.id === o.bookId) && (!o.authorId || b.authorId === o.authorId) && (!o.type || (b.type || "book") === o.type));
  }
  /** opts: {col, bookId, authorId, type, k, max, includeDemo} */
  function search(lib, q, opts) {
    opts = opts || {};
    const ts = terms(q), k = opts.k || 8, max = opts.max || 900;
    if (!ts.length) return [];
    const books = pick(lib, opts);
    let N = 0; const df = ts.map(() => 0);
    books.forEach(b => pn(b).forEach(p => { N++; ts.forEach((t, j) => { if (p.includes(t)) df[j]++; }); }));
    const idf = df.map(d => Math.log(1 + (N + 1) / (d + 0.5)));
    const phrase = ts.length > 1 ? norm(q).replace(/\s+/g, " ").trim() : "";
    const hits = [];
    books.forEach(b => pn(b).forEach((p, i) => {
      let s = 0, m = 0;
      ts.forEach((t, j) => { const c = p.split(t).length - 1; if (c) { m++; s += idf[j] * (1 + Math.log(c)); } });
      if (!m) return;
      s *= m / ts.length;
      if (phrase && p.includes(phrase)) s *= 2;
      if (p.length < 120) s *= 0.6;
      hits.push({ b, i, s });
    }));
    hits.sort((x, y) => y.s - x.s);
    return hits.slice(0, k).map(h => ({ ref: h.b.id + ":" + (h.i + 1), book: h.b.title, kind: kind(h.b), author: ((lib.authors.find(a => a.id === h.b.authorId) || {}).name) || "", collection: colName(h.b), page: label(h.b, h.i), date: h.b.date || undefined, text: excerpt(h.b.pages[h.i], ts, max) }));
  }
  function getPage(lib, ref) {
    const m = /^([^:]+):(\d+)$/.exec(String(ref || "").trim()); if (!m) throw new Error("صيغة المرجع غير صحيحة، مثال: riyad:30");
    const b = lib.books.find(x => x.id === m[1]); if (!b) throw new Error("الكتاب غير موجود");
    if (!b.pages) throw new Error("نص هذا الكتاب لم يُحمَّل");
    const i = +m[2] - 1; if (i < 0 || i >= b.pages.length) throw new Error("رقم الصفحة خارج الكتاب (عدد الصفحات " + b.pages.length + ")");
    const a = lib.authors.find(x => x.id === b.authorId) || {};
    return { ref: b.id + ":" + (i + 1), book: b.title, kind: kind(b), author: a.name || "", page: label(b, i), text: plain(b.pages[i]).slice(0, 6000) };
  }
  function catalog(lib) {
    return lib.books.filter(b => !b.demo).map(b => ({ id: b.id, title: b.title, kind: kind(b), author: (lib.authors.find(a => a.id === b.authorId) || {}).name || "", collection: colName(b), pages: b.n || (b.pages || []).length }));
  }
  const SYSTEM = [
    "أنت «مساعد المكتبة» في «مكتبة الدعوة السلفية الرقمية». تساعد الباحث على الوصول إلى ما في نصوص المكتبة وفهمه.",
    "القواعد:",
    "1. اعتمد على النصوص التي تعيدها أدوات المكتبة (search_library و get_page و list_books). ابحث قبل أن تجيب، وجرّب أكثر من صيغة (كلمة مفردة، مرادف، لفظ الحديث) إن لم تجد.",
    "2. وثّق كل نقل أو معلومة بمرجعها بالصيغة [[المرجع]] كما يظهر في حقل ref، مثل [[riyad:31]]. لا تخترع مرجعًا لم تُعِده الأدوات.",
    "3. عند الاقتباس انقل النص حرفيًا بين «».",
    "4. ميّز بين ما ورد في كتب مشايخ الدعوة السلفية بمصر ومقالاتهم، وما ورد في كتب التراث.",
    "5. إن لم تجد في المكتبة ما يجيب فقل ذلك صراحة. وإن أضفت شيئًا من معرفتك العامة فافصله تحت عنوان «من خارج نصوص المكتبة» ونبّه أنه غير موثق منها. لا تنسب إلى عالم قولًا لم تجده.",
    "6. لا تختلق آية ولا حديثًا ولا حكمًا على حديث، ولا تُصدر فتوى شخصية في نازلة السائل؛ اعرض ما في النصوص وانصحه بسؤال أهل العلم فيما يخصه.",
    "7. اكتب بالعربية الفصحى الواضحة، بعناوين قصيرة (##) ونقاط عند الحاجة، ودون إطالة لا فائدة منها."
  ].join("\n");
  const MODES = {
    ask: "أجب عن السؤال إجابة مركزة موثقة.",
    research: "اكتب بحثًا علميًا منظمًا: مقدمة قصيرة، ثم المسائل مرتبة مع الأدلة والنقول الموثقة من المكتبة، ثم خلاصة، ثم «المراجع» بقائمة الكتب والصفحات التي استعملتها. ابحث بعدة صيغ قبل الكتابة.",
    explain: "اشرح النص المعطى: معنى الألفاظ الغريبة، والمعنى الإجمالي، وما يستفاد منه، مستعينًا بما في المكتبة من نصوص ذات صلة."
  };
  const TOOLS = [
    { name: "search_library", description: "يبحث في نصوص كتب المكتبة ومقالاتها ويعيد أفضل المقاطع مع مرجع كل مقطع (ref) واسم الكتاب أو المقال والمؤلف والصفحة.", input_schema: { type: "object", properties: { query: { type: "string", description: "كلمات البحث بالعربية" }, collection: { type: "string", enum: ["", "dawah", "turath"], description: "dawah لكتب مشايخ الدعوة ومقالاتهم، turath لكتب التراث، أو فارغ للكل" }, book_id: { type: "string", description: "اختياري: معرف كتاب محدد" } }, required: ["query"] } },
    { name: "get_page", description: "يعيد النص الكامل لصفحة من كتاب أو مقال بمرجعها، مثل riyad:31. استعمله لقراءة سياق مقطع وجدته.", input_schema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] } },
    { name: "list_books", description: "يعيد قائمة الكتب والمقالات المتاحة في المكتبة بمعرفاتها ومؤلفيها وقسمها.", input_schema: { type: "object", properties: {} } }
  ];
  function runTool(lib, name, input, scope) {
    input = input || {}; scope = scope || {};
    if (name === "search_library") return search(lib, String(input.query || ""), { col: scope.col || String(input.collection || ""), bookId: scope.bookId || String(input.book_id || ""), k: 8 });
    if (name === "get_page") return getPage(lib, input.ref);
    if (name === "list_books") return catalog(lib).filter(b => !scope.col || (scope.col === "turath") === (b.collection === "تراث"));
    throw new Error("أداة غير معروفة");
  }
  G.SDSLSearch = { norm, strip, plain, terms, search, getPage, catalog, label, SYSTEM, MODES, TOOLS, runTool };
})(typeof globalThis !== "undefined" ? globalThis : this);
