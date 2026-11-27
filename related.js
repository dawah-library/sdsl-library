/* الكتب المتصلة بالكتاب (طلب المدير، ٢٧ نوفمبر): الأصل وشروحه، والمتن وتفريغاته، والطبعات، وكتب المؤلف نفسه.
   روابط داخلية لتنقل القارئ ولفهرسة محركات البحث؛ يستعملها القارئ (app.js) وصفحات الخادم (api/page.js) بالمنطق نفسه.
   الصلة تُستنتج من البيانات وحدها: الحقول sharh/matn، ومعرّف العمل في الطبعات ed.w، وعناوين «شرح …/تفريغ …/حاشية …» المطابقة لعنوان كتاب في المكتبة. */
(function (root) {
  const norm = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[«»"'()\[\]{}،,.:؛!؟\-–—_]/g, " ").replace(/\s+/g, " ").trim();
  const main = s => norm(String(s || "").split(/\s[-–—:]\s|[(:]/)[0]);
  const PRE = /^(?:الشرح المختصر علي|الشرح الموجز علي|التعليقات علي|التعليق علي|تعليقات علي|تعليق علي|دروس في|(?:ال)?شرح|تفريغ|حاشيه|تهذيب|مختصر|اختصار|دروس)\s+/;
  const isTr = b => !b.notf && ((b.tags || []).includes("tafrigh") || /تفريغ|دروس صوتية/.test(b.source || ""));
  // العناوين المرشحة للأصل: «شرح X»، «Y شرح X»، «Y في شرح X»، «Y بشرح X»، «حاشية فلان على X»، «X (شرح …)» — مع تقصير الذيل كلمة كلمة («صحيح مسلم بن الحجاج» ← «صحيح مسلم»)
  function cands(t) {
    const nt = norm(t), out = [], push = r => { r = norm(r); const w = r.split(" "); for (let k = w.length; k >= 2; k--) { const x = w.slice(0, k).join(" "); if (x.length >= 7 && x !== nt) out.push(x); } };
    const m = nt.match(PRE); if (m) push(nt.slice(m[0].length));
    const m2 = nt.match(/(?:^|\s)(?:في |ب|ل)?شرح\s+(.+)$/); if (m2) push(m2[1]);
    const m3 = nt.match(/^(?:حاشيه|تعليقات?|التعليقات?|الحاشيه).*?\sعلي\s+(.+)$/); if (m3) push(m3[1]);
    const m4 = String(t || "").match(/\(\s*(?:شرح|حاشية)\s+([^)]+)\)/); if (m4) push(m4[1]);
    const m5 = String(t || "").match(/^(.+?)\s+(?:شرح|تفريغ|تعليقات)\s/); if (m5 && /تعليقات|تفريغ/.test(t)) push(m5[1]);
    return out;
  }
  let IX = null, IXl = null, IXn = -1;
  // فهرس مرة واحدة لكل قائمة كتب: العنوان المطبَّع ← الكتب، والعمل ← طبعاته، والمؤلف ← كتبه، والأصل ← ما كُتب عليه
  function index(books) {
    if (IX && IXl === books && IXn === books.length) return IX;
    const first = new Map(); books.forEach(b => { if (b.type === "article" || b.demo || b.hidden) return; const u = b.set || b.id, o = first.get(u); if (!o || (+b.vol || 0) < (+o.vol || 0)) first.set(u, b); });
    const L = [...first.values()], byT = new Map(), byW = new Map(), byA = new Map(), up = new Map(), kids = new Map();
    const add = (m, k, b) => { if (!k || k.length < 4) return; const l = m.get(k) || m.set(k, []).get(k); if (!l.includes(b)) l.push(b); };
    L.forEach(b => { const t = b.setTitle || b.title; add(byT, norm(t), b); const mt = main(t); if (mt !== norm(t)) add(byT, mt, b);
      if (b.ed && b.ed.w) add(byW, b.ed.w, b); add(byA, b.authorId, b); });
    const idOf = new Map(L.map(b => [b.id, b]));
    L.forEach(b => { const u = b.set || b.id, ps = [];
      if (b.sharh) { const o = idOf.get(b.sharh) || books.find(x => x.id === b.sharh); if (o) ps.push(first.get(o.set || o.id) || o); }
      if (b.matn) ps.push(...(byT.get(norm(b.matn)) || byT.get(main(b.matn)) || []));
      for (const c of cands(b.setTitle || b.title)) { const l = byT.get(c); if (l) { ps.push(...l.filter(x => (x.set || x.id) !== u && x.authorId !== b.authorId || (x.set || x.id) !== u && b.sharh)); if (l.length) break; } }
      const uniq = [...new Set(ps)].filter(x => (x.set || x.id) !== u).slice(0, 3); if (uniq.length) { up.set(u, uniq); uniq.forEach(p => add(kids, p.set || p.id, b)); } });
    IX = { L, first, byT, byW, byA, up, kids }; IXl = books; IXn = books.length; return IX;
  }
  // ← [{k, t, items:[كتب]}]
  function of(b, books, opt) {
    opt = opt || {}; if (!b || b.type === "article") return [];
    const X = index(books), me = X.first.get(b.set || b.id) || b, u = me.set || me.id, seen = new Set([u]);
    const take = (l, lim) => { const out = []; for (const x of l || []) { const v = x.set || x.id; if (seen.has(v)) continue; seen.add(v); out.push(x); if (out.length >= (lim || 12)) break; } return out; };
    const G = [], trT = x => isTr(x) || /^تفريغ/.test(norm(x.setTitle || x.title));
    const orig = take(X.up.get(u), 3); if (orig.length) G.push({ k: "orig", t: trT(me) ? "الكتاب المشروح في الدروس" : "الأصل (المتن)", items: orig });
    const ks = take(X.kids.get(u), 16), tr = ks.filter(trT), sh = ks.filter(x => !tr.includes(x));
    if (sh.length) G.push({ k: "sharh", t: "شروحه وحواشيه ومختصراته", items: sh });
    if (tr.length) G.push({ k: "tafrigh", t: "تفريغات دروسه", items: tr });
    // الطبعات (عمل واحد)
    const w = (me.ed && me.ed.w) || ((X.byW.get(u) || []).length ? u : null);
    if (w && !opt.noEd) { const eds = take((X.byW.get(w) || []).concat(X.first.get(w) ? [X.first.get(w)] : []), 8); if (eds.length) G.push({ k: "ed", t: "طبعات أخرى", items: eds }); }
    // من كتب المؤلف نفسه (الأقرب موضوعًا أولًا)
    const au = (X.byA.get(me.authorId) || []).filter(x => !(x.ed && x.ed.w && x.ed.w !== (x.set || x.id))).slice().sort((x, y) => (y.topicId === me.topicId) - (x.topicId === me.topicId));
    const mine = take(au, opt.auLim || 8); if (mine.length) G.push({ k: "au", t: "من كتب المؤلف نفسه", items: mine });
    return G;
  }
  const RELB = { of, norm, main };
  if (typeof module !== "undefined" && module.exports) module.exports = RELB; else root.RELB = RELB;
})(typeof window !== "undefined" ? window : this);
