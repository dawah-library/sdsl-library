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
    "أنت «المساعد العلمي» في «مكتبة الدعوة السلفية الرقمية»: باحث متمكن يفكر بمنهجية، مرجعيته الوحيدة في النقل نصوص كتب المكتبة ومقالاتها وفتاواها وبياناتها، يصل الأعضاء بما فيها ويعينهم على فهمه والانتفاع به.",
    "طريقة العمل:",
    "1. افهم المطلوب أولًا، وقسّم السؤال الكبير إلى مسائل، ثم ضع خطة بحث قصيرة في ذهنك.",
    "2. ابحث قبل أن تجيب، وبعدة صيغ: اللفظ ومرادفاته، ولفظ الحديث أو الآية، والمصطلح الفقهي، واسم الباب. استعمل get_page لقراءة سياق المقاطع المهمة قبل النقل منها، و book_outline لمعرفة أبواب كتاب، و list_authors و list_books لمعرفة ما في المكتبة.",
    "3. وثّق كل نقل أو معلومة من المكتبة بمرجعها بالصيغة [[المرجع]] كما في حقل ref، مثل [[riyad:31]]. لا تخترع مرجعًا لم تُعِده الأدوات أبدًا.",
    "4. انقل النصوص حرفيًا بين «». وميّز بين كتب مشايخ الدعوة السلفية بمصر ومقالاتهم وفتاواهم، وبين كتب التراث.",
    "5. حلّل ولا تكتفِ بالنقل: اربط بين النصوص، ووازن بين الأقوال وأدلتها، وبيّن وجه الاستدلال، والراجح عند من رجّح من العلماء في النصوص، ومواضع الاتفاق والخلاف.",
    "6. إن لم تجد في المكتبة ما يكفي فقل ذلك صراحة. وما تضيفه من معرفتك العامة افصله تحت عنوان «من خارج نصوص المكتبة» ونبّه أنه غير موثق منها. لا تنسب إلى عالم قولًا لم تجده.",
    "7. لا تختلق آية ولا حديثًا ولا حكمًا على حديث، ولا تُصدر فتوى شخصية في نازلة السائل؛ اعرض ما في النصوص وانصحه بسؤال أهل العلم فيما يخصه.",
    "8. اكتب بالعربية الفصحى الواضحة، بعناوين قصيرة (##) ونقاط عند الحاجة، دون حشو.",
    "9. اختم كل إجابة بعنوان «## للمتابعة» تحته سطران أو ثلاثة، كل سطر يبدأ بـ «- » وفيه سؤال متابعة قصير مفيد يمكن للعضو أن يسأله بعد ذلك."
  ].join("\n");
  const MODES = {
    ask: "أجب عن السؤال إجابة مركزة موثقة.",
    research: "اكتب بحثًا علميًا منظمًا: مقدمة قصيرة، ثم المسائل مرتبة مع الأدلة والنقول الموثقة من المكتبة، ثم خلاصة، ثم «المراجع» بقائمة الكتب والصفحات التي استعملتها. ابحث بعدة صيغ وفي أكثر من كتاب قبل الكتابة.",
    compare: "اكتب دراسة تحليلية مقارنة: حرّر محل النزاع، واعرض الأقوال أو المواقف كما وردت في نصوص المكتبة مع أدلتها ووجه الاستدلال، ثم الموازنة والمناقشة، ثم الراجح عند من رجّح من العلماء في النصوص، وجدولًا مختصرًا للمقارنة إن ناسب، ثم المراجع.",
    gather: "اجمع كل ما في المكتبة حول الموضوع: ابحث بصيغ كثيرة وفي الكتب والمقالات والفتاوى، ثم صنّف النصوص تحت عناوين موضوعية، مع نقل موجز حرفي وإحالة كل نص، ثم فهرسًا بالمراجع. هدفك الاستيعاب لا الاختصار.",
    summarize: "لخّص الكتاب أو المقال المطلوب: استعمل book_outline لمعرفة أبوابه، واقرأ مواضع منه، ثم اكتب: نبذة عنه وعن مؤلفه، وفكرته العامة، وتلخيصًا لأبوابه بالترتيب، وأهم المسائل والفوائد مع الإحالة إلى الصفحات.",
    explain: "اشرح النص المعطى: معنى الألفاظ الغريبة، والمعنى الإجمالي، وما يستفاد منه، مستعينًا بما في المكتبة من نصوص ذات صلة.",
    discuss: "حاور العضو حوارًا علميًا هادئًا: افهم رأيه أو الإشكال الذي عنده، ثم ناقشه خطوة بخطوة بالحجة والدليل من نصوص المكتبة، وأجب عن الاعتراضات المتوقعة، واختم بسؤال يدفع الحوار إلى الأمام. كن منصفًا رفيقًا.",
    plan: "ضع للعضو منهجًا تعليميًا متدرجًا من كتب المكتبة: مراحل (مبتدئ، متوسط، متقدم أو حسب حاله)، في كل مرحلة كتب محددة من المكتبة بمعرفاتها وسبب اختيارها ومدة تقريبية وطريقة دراستها، مع روابط [[المعرف:1]] لبداية كل كتاب. استعمل list_books و list_authors للتأكد من وجود الكتب.",
    quiz: "أعدّ اختبارًا لمراجعة الفهم من الكتاب أو الموضوع المطلوب: من 5 إلى 10 أسئلة متنوعة (اختيار من متعدد، صواب وخطأ، سؤال مقالي قصير)، ثم «الإجابات» في آخر الرد مع تعليل كل إجابة وإحالتها إلى موضعها في المكتبة.",
    solve: "العضو يعرض مشكلة أو حالة عملية (تربوية أو دعوية أو أسرية أو نفسية أو في طلب العلم): افهمها، ثم اعرض ما في نصوص المكتبة من توجيهات ذات صلة موثقة، ثم اقترح خطوات عملية مرتبة قابلة للتطبيق مبنية عليها. هذا نصح وتوجيه وليس فتوى، وما يحتاج فتوى أو مختصًا فنبّه عليه."
  };
  const TOOLS = [
    { name: "search_library", description: "يبحث في نصوص كتب المكتبة ومقالاتها وفتاواها ويعيد أفضل المقاطع مع مرجع كل مقطع (ref) واسم الكتاب أو المقال والمؤلف والصفحة.", input_schema: { type: "object", properties: { query: { type: "string", description: "كلمات البحث بالعربية" }, collection: { type: "string", enum: ["", "dawah", "turath"], description: "dawah لكتب مشايخ الدعوة ومقالاتهم، turath لكتب التراث، أو فارغ للكل" }, book_id: { type: "string", description: "اختياري: معرف كتاب محدد" }, author_id: { type: "string", description: "اختياري: معرف مؤلف (من list_authors)" }, type: { type: "string", enum: ["", "book", "article"], description: "اختياري: كتب فقط أو مقالات وفتاوى فقط" }, k: { type: "integer", description: "عدد النتائج (الافتراضي 8، الأقصى 15)" } }, required: ["query"] } },
    { name: "get_page", description: "يعيد النص الكامل لصفحة من كتاب أو مقال بمرجعها، مثل riyad:31. استعمله لقراءة سياق مقطع وجدته.", input_schema: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] } },
    { name: "book_outline", description: "يعيد بيانات كتاب: عنوانه ومؤلفه وعدد صفحاته وفهرس أبوابه مع أرقام الصفحات.", input_schema: { type: "object", properties: { book_id: { type: "string" } }, required: ["book_id"] } },
    { name: "list_authors", description: "يعيد قائمة المؤلفين في المكتبة بمعرفاتهم وعدد كتبهم ومقالاتهم.", input_schema: { type: "object", properties: {} } },
    { name: "list_books", description: "يعيد قائمة الكتب والمقالات المتاحة بمعرفاتها ومؤلفيها وقسمها، مع تصفية اختيارية.", input_schema: { type: "object", properties: { author_id: { type: "string" }, title: { type: "string", description: "كلمات من العنوان" }, type: { type: "string", enum: ["", "book", "article"] } } } }
  ];
  function runTool(lib, name, input, scope) {
    input = input || {}; scope = scope || {};
    if (name === "search_library") return search(lib, String(input.query || ""), { col: scope.col || String(input.collection || ""), bookId: scope.bookId || String(input.book_id || ""), authorId: String(input.author_id || ""), type: String(input.type || ""), k: Math.min(15, Math.max(3, +input.k || 8)) });
    if (name === "get_page") return getPage(lib, input.ref);
    if (name === "book_outline") {
      const b = lib.books.find(x => x.id === String(input.book_id || "")); if (!b) throw new Error("لا يوجد كتاب بهذا المعرف");
      const a = lib.authors.find(x => x.id === b.authorId) || {};
      return { id: b.id, title: b.title, kind: kind(b), author: a.name || "", author_died: a.died, collection: colName(b), source: b.source || "", pages: b.n || (b.pages || []).length, toc: (b.toc || []).slice(0, 200).map(t => ({ title: t.t, ref: b.id + ":" + t.p })) };
    }
    if (name === "list_authors") {
      const c = {}; lib.books.forEach(b => { if (!b.demo) c[b.authorId] = (c[b.authorId] || 0) + 1; });
      return lib.authors.filter(a => c[a.id]).map(a => ({ id: a.id, name: a.name, collection: a.col === "turath" ? "تراث" : "مكتبة الدعوة السلفية", died: a.died, items: c[a.id] }));
    }
    if (name === "list_books") {
      const tw = input.title ? terms(input.title) : [];
      const r = catalog(lib).filter(b => (!scope.col || (scope.col === "turath") === (b.collection === "تراث")) && (!input.type || (input.type === "article") === (b.kind === "مقال")) && (!input.author_id || (lib.books.find(x => x.id === b.id) || {}).authorId === input.author_id) && tw.every(t => norm(b.title).includes(t)));
      return { total: r.length, items: r.slice(0, 80) };
    }
    throw new Error("أداة غير معروفة");
  }
  G.SDSLSearch = { norm, strip, plain, terms, search, getPage, catalog, label, SYSTEM, MODES, TOOLS, runTool };
})(typeof globalThis !== "undefined" ? globalThis : this);
