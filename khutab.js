/* قسم «خطب الجمعة» (طلب المدير، ٢١ نوفمبر ٢٠٢٦) — مرجع متجدد للخطباء:
   #/khutab                     الرئيسية: البحث الذكي، الجمعة القادمة وتقويم الجمعات بالهجري، المواسم القريبة، التصنيفات، المميزة، المفضلة والمتابعة، المقترحات.
   #/khutab/<موضوع>?m=1..3      صفحة الموضوع: ثلاثة نماذج (ميسرة، علمية تأصيلية، بلاغية مؤثرة)، والخطبة مقسمة إلى الأولى والثانية،
                                وأدلتها بترتيب ورودها، ومعاني الكلمات وشرح النصوص (المختصر في التفسير، وشروح الحديث)، والمراجع بعلامات مرجعية.
   #/khutab/<موضوع>/deliver     وضع الإلقاء: خط كبير، وإبقاء الشاشة مضاءة، والتنقل بين الخطبتين، وتمرير تلقائي، والعودة إلى موضع القراءة.
   التحميل: PDF وWord وصور (صفحة صفحة) ونص؛ بمقاسات A4 ونصف A4 وربع A4 بإعادة ضبط ذكية للخط والهوامش، والمراجع بجوار النص أو حواشي سفلية لكل صفحة.
   #/khutab/admin               لوحة الإدارة: الإحصاء والمتابعة، والموضوعات، والمحرر، والتصنيفات، والمواد، والطابور.
   البيانات: data/khutab (cats.json، index.json، words.json، t/<موضوع>.json، materials.json، queue.json، watch.json)؛ المعالجة: tools/khutab.py وkhutab.yml.
   الجودة: نص القرآن يُدرج من المصحف المعتمد بمرجعه {q:س:آ} لا بكتابة اليد، والأحاديث والنقول من مصادر المكتبة بنصها وموضعها، ولا يُنشر إلا المعتمد. */
const KHT = (() => {
  const P = "data/khutab/", MN = { 1: "الميسرة", 2: "العلمية التأصيلية", 3: "البلاغية المؤثرة" };
  const MD = { 1: "عبارات واضحة قريبة من عامة الناس، سهلة الحفظ والإلقاء", 2: "أوسع في الأدلة ووجوه الدلالة وكلام أهل العلم، بلا جفاف", 3: "استهلال قوي وتصوير بياني وانتقالات مؤثرة، مع الاعتدال والصدق" };
  const IC = (n, z) => (typeof ic === "function" && typeof ICONS !== "undefined" && ICONS[n]) ? ic(n, z || 18) : (n && !/^[a-z0-9-]+$/.test(n) ? E(n) : "");
  const MIc = { 1: "book-text", 2: "layers", 3: "sparkles" }, MI = new Proxy({}, { get: (o, k) => IC(MIc[k], 16) });
  const STN = { draft: "مسودة", review: "قيد المراجعة", ok: "معتمدة", rej: "مرفوضة" };
  const SUR = "الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس".split(" ").map(s => s.replace("_", " "));
  const A2 = n => (typeof toAr === "function" ? toAr(n) : String(n));
  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const N = s => (typeof norm === "function" ? norm(s) : String(s || "").toLowerCase()).replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/[^\u0621-\u064A0-9a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const adm = () => (typeof isAdmin === "function" && isAdmin()) || (typeof can === "function" && can("khutab"));
  const appr = () => typeof isAdmin === "function" && isAdmin();
  const ls = { g(k, d) { try { const v = localStorage.getItem("kh_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, s(k, v) { try { localStorage.setItem("kh_" + k, JSON.stringify(v)); } catch (e) { } } };
  const getJ = async (p, fresh) => { try { const r = await fetch(p + (p.includes("?") ? "&" : "?") + (fresh ? "fresh=1&t=" + Date.now() : "t=" + Math.floor(Date.now() / 300e3))); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  let CATS = null, IDX = null, WORDS = null, WATCH = null, QUR = null, FRESH = false;
  const TP = {};
  const cats = async () => CATS || (CATS = (await getJ(P + "cats.json", FRESH)) || { topics: [], seasons: [] });
  const idx = async () => IDX || (IDX = ((await getJ(P + "index.json", FRESH)) || { items: [] }).items);
  const topic = async s => TP[s] || (TP[s] = await getJ(P + "t/" + encodeURIComponent(s) + ".json", FRESH));
  const catT = id => ((CATS && CATS.topics.concat(CATS.seasons).find(c => c.id === id)) || { t: id, ic: "" });
  const cic = (c, z) => IC(catT(c).ic, z || 14);
  const pubOk = x => adm() || x.st === "ok" || Object.values(x.ms || {}).includes("ok") || (CATS && CATS.pub_review && x.st === "review");
  const modelsOf = (tp) => Object.keys(tp.models || {}).filter(k => (tp.models[k].body || "").trim() && (adm() || tp.models[k].st === "ok" || (CATS && CATS.pub_review && tp.models[k].st === "review"))).sort();
  const mins = w => Math.max(1, Math.round((w || 0) / 115));

  /* ---------- التقويم الهجري (أم القرى) ---------- */
  const HM = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  function hij(d) { try { const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d); const g = t => +((p.find(x => x.type === t) || {}).value || "0").replace(/\D/g, ""); return { y: g("year"), m: g("month"), d: g("day") }; } catch (e) { return null; } }
  const hijS = d => { const h = hij(d); return h ? `${A2(h.d)} ${HM[h.m - 1]} ${A2(h.y)}هـ` : ""; };
  const gS = d => d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  const inR = (r, a, b) => { const L = r && !Array.isArray(r[0]) ? [r] : (r || []); return L.some(x => x && (x[0] * 100 + x[1]) <= (a * 100 + b) && (a * 100 + b) <= (x[2] * 100 + x[3])); };
  function seasonsOn(d) { const h = hij(d); return (CATS ? CATS.seasons : []).filter(S => (h && S.h && inR(S.h, h.m, h.d)) || (S.g && inR(S.g, d.getMonth() + 1, d.getDate()))).map(S => S.id); }
  function fridays(n) { const out = [], d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); for (let i = 0; i < n; i++) { const x = new Date(d); x.setDate(d.getDate() + 7 * i); out.push(x); } return out; }
  function upcoming(days) { const out = {}, d = new Date(); for (let i = 0; i < days; i++) { const x = new Date(d); x.setDate(d.getDate() + i); seasonsOn(x).forEach(s => { if (!(s in out)) out[s] = i; }); } return out; }

  /* ---------- القرآن ---------- */
  async function quran() { if (QUR) return QUR; const j = await getJ("data/quran/uthmani.json"); QUR = (j && j.suras || []).map(s => s.ayat.map((a, i) => { a = a.replace(/^[\ufeff\s]+/, "").replace("۞ ", ""); return i === 0 && s.n !== 1 && s.n !== 9 ? a.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, "") : a; })); return QUR; }
  const qkey = (s, a, b) => s + ":" + a + (b && b !== a ? "-" + b : "");
  function qtxt(tp, s, a, b) { const k = qkey(s, a, b), Q = tp.qt || {}; if (Q[k]) return Q[k]; if (QUR && QUR[s - 1]) { const L = QUR[s - 1].slice(a - 1, (b || a)); if (L.length) return L.map((x, i) => x + " (" + A2(a + i) + ")").join(" ").replace(/ \([٠-٩]+\)$/, ""); } return null; }
  const qcite = (s, a, b) => `[${SUR[s - 1] || s}: ${A2(a)}${b && b !== a ? "-" + A2(b) : ""}]`;
  async function ensureQ(tp) { const need = []; Object.values(tp.models || {}).forEach(M => (M.body || "").replace(/\{q:(\d+):(\d+)(?:-(\d+))?\}/g, (m, s, a, b) => { if (!(tp.qt || {})[qkey(+s, +a, b ? +b : 0)]) need.push(1); return m; })); if (need.length) await quran(); }

  /* ---------- المحلل (مطابق لـblocks في tools/khutab.py) ---------- */
  function parse(body) {
    const out = [];
    (body || "").split("\n").forEach(ln => {
      const s = ln.trim(); if (!s) return;
      if (out.length && /^(\[\^[\w-]+\]\s*)+$/.test(s)) { out[out.length - 1].x += s; return; }
      let m = s.match(/^==\s*(.+?)\s*==$/); if (m) return out.push({ k: "part", x: m[1] });
      for (const [p, k] of [["### ", "h3"], ["## ", "h2"], [">> ", "tr"], ["!! ", "note"], ["% ", "poem"], ["- ", "li"], ["~ ", "dua"]]) if (s.startsWith(p)) return out.push({ k, x: s.slice(p.length) });
      m = s.match(/^\{([qhav]):([^}]+)\}((?:\[\^[\w-]+\])*)$/); if (m) return out.push({ k: "ev", t: m[1], id: m[2], x: m[3] || "" });
      out.push({ k: "p", x: s });
    });
    return out;
  }
  /* الأدلة بترتيب ورودها */
  function evOrder(tp, body) {
    const L = [], seen = new Set();
    (body || "").replace(/\{(q|h|a|v):([^}]+)\}/g, (m, t, id) => { const k = t === "q" ? "q:" + id : id; if (!seen.has(k)) { seen.add(k); L.push(t === "q" ? { q: id } : { id }); } return m; });
    return L;
  }

  /* ---------- العرض ---------- */
  // ctx: {tp, refs: Map id->n, fn: [] (للحواشي), mode: "screen"|"print", refMode: "mark"|"inline"|"foot"|"hide", evMode: "inline"|"foot", evNo: Map}
  function inline(x, C) {
    let h = E(x);
    h = h.replace(/\{q:(\d+):(\d+)(?:-(\d+))?\}/g, (m, s, a, b) => { const t = qtxt(C.tp, +s, +a, b ? +b : 0); return `<span class="khqi">﴿${E(t || "…")}﴾ <small>${qcite(+s, +a, b ? +b : 0)}</small></span>`; });
    h = h.replace(/\{([hav]):([\w-]+)\}/g, (m, k, id) => { const e = (C.tp.ev || {})[id]; return e ? `«${E(e.t)}»` : m; });
    h = h.replace(/\*\*(.+?)\*\*/g, '<mark class="khimp">$1</mark>');
    h = h.replace(/\[\^([\w-]+)\]/g, (m, id) => refMark(id, C));
    return h;
  }
  function refLabel(r) { if (!r) return ""; const bt = r.t || (typeof lib !== "undefined" && (lib.books.find(b => b.id === r.b) || {}).title) || r.b || ""; return bt + (r.p && !/^sv/.test(r.b || "") ? "، ص " + A2(r.pl || r.p) : ""); }
  function refMark(id, C) {
    const r = (C.tp.refs || {})[id]; if (!r || C.refMode === "hide") return "";
    if (C.refMode === "inline") return ` <small class="khrin">(${E(refLabel(r))})</small>`;
    if (C.refMode === "foot") { C.fn.push(E(refLabel(r)) + (r.q ? " — «" + E(r.q) + "»" : "")); return `<sup class="fnm">*</sup>`; }
    if (!C.refs.has(id)) C.refs.set(id, C.refs.size + 1);
    return `<sup class="khref" data-r="${E(id)}" tabindex="0" role="button" aria-label="المرجع">${A2(C.refs.get(id))}</sup>`;
  }
  function evCite(e) { return e.k === "h" ? [e.src, e.g && !String(e.src || "").includes(e.g) ? e.g : ""].filter(Boolean).join("، ") : [e.who, e.src].filter(Boolean).join("، "); }
  function evBlock(b, C) {
    const tail = b.x ? inline(b.x, C) : "";
    if (b.t === "q") {
      const m = b.id.match(/^(\d+):(\d+)(?:-(\d+))?$/); if (!m) return "";
      const s = +m[1], a = +m[2], e = m[3] ? +m[3] : 0, t = qtxt(C.tp, s, a, e), k = "q:" + b.id;
      const no = C.evNo && C.evNo.get(k);
      const cite = C.evMode === "foot" ? ((C.fn.push(qcite(s, a, e)), `<sup class="fnm">*</sup>`)) : `<cite>${qcite(s, a, e)}</cite>`;
      return `<blockquote class="khay" data-ev="${E(k)}">${no && C.mode === "screen" ? `<span class="khno" title="دليل رقم ${A2(no)}">${A2(no)}</span>` : ""}<p>﴿${E(t || "…")}﴾ ${cite}${tail}</p>${C.withEv ? evNote(C.tp, k) : ""}</blockquote>`;
    }
    const ev = (C.tp.ev || {})[b.id]; if (!ev) return `<p class="kherr">[دليل غير معرّف: ${E(b.id)}]</p>`;
    const no = C.evNo && C.evNo.get(b.id), cl = ev.k === "h" ? "khhd" : "khat";
    const cite = C.evMode === "foot" ? (C.fn.push(E(evCite(ev))), `<sup class="fnm">*</sup>`) : `<cite>${ev.k === "h" ? "(" + E(evCite(ev)) + ")" : "— " + E(evCite(ev))}</cite>`;
    return `<blockquote class="${cl}" data-ev="${E(b.id)}">${no && C.mode === "screen" ? `<span class="khno">${A2(no)}</span>` : ""}<p>«${E(ev.t)}» ${cite}${tail}</p>${C.withEv ? evNote(C.tp, b.id) : ""}</blockquote>`;
  }
  function blockHTML(b, C, i) {
    const d = C.mode === "screen" ? ` data-i="${i}"` : "";
    switch (b.k) {
      case "h2": return `<h4 class="khh2"${d}>${inline(b.x, C)}</h4>`;
      case "h3": return `<h5 class="khh3"${d}>${inline(b.x, C)}</h5>`;
      case "tr": return `<p class="khtr"${d}><span aria-hidden="true">⟵</span> ${inline(b.x, C)}</p>`;
      case "note": return C.notes === false ? "" : `<p class="khnote"${d}><span>تنبيه للخطيب:</span> ${inline(b.x, C)}</p>`;
      case "poem": { const [a, c] = b.x.split(/\s*\*\*\*\s*/); return `<p class="khpoem"${d}><span>${inline(a || "", C)}</span><span>${inline(c || "", C)}</span></p>`; }
      case "dua": return `<p class="khdua"${d}>${inline(b.x, C)}</p>`;
      case "li": return `<li${d}>${inline(b.x, C)}</li>`;
      case "ev": return evBlock(b, C).replace("<blockquote", `<blockquote${d}`);
      default: return `<p${d}>${inline(b.x, C)}</p>`;
    }
  }
  /* الخطبة إلى أجزاء: [{n, title, items:[{b, html, i}]}] */
  function render(tp, mk, C) {
    const B = parse(tp.models[mk].body); const parts = []; let cur = null;
    C.evNo = new Map(); evOrder(tp, tp.models[mk].body).forEach((x, i) => C.evNo.set(x.q ? "q:" + x.q : x.id, i + 1));
    B.forEach((b, i) => {
      if (b.k === "part") { cur = { n: parts.length + 1, title: b.x, items: [] }; parts.push(cur); return; }
      if (!cur) { cur = { n: 1, title: "الخطبة الأولى", items: [] }; parts.push(cur); }
      cur.items.push({ b, i, html: blockHTML(b, C, i) });
    });
    return parts;
  }
  const joinItems = items => { let h = "", inUl = false; items.forEach(it => { if (it.b.k === "li" && !inUl) { h += '<ul class="khul">'; inUl = true; } if (it.b.k !== "li" && inUl) { h += "</ul>"; inUl = false; } h += it.html; }); return h + (inUl ? "</ul>" : ""); };
  function evNote(tp, k) {
    const e = k.startsWith("q:") ? ((tp.qn || {})[k.slice(2).replace(/-\d+$/, "")] || {}) : ((tp.ev || {})[k] || {});
    const w = (e.w || []).map(x => `<li><b>${E(x[0])}</b>: ${E(x[1])}${x[2] && x[2].b ? ` <a class="mut" href="#/book/${E(x[2].b)}/${x[2].p}">(${E(bookT(x[2].b))})</a>` : ""}</li>`).join("");
    const sh = e.sh ? `<p><b>شرح موجز:</b> ${E(e.sh)}${e.shs ? ` <a class="mut" href="#/book/${E(e.shs.b)}/${e.shs.p}">(مستفاد من ${E(e.shs.t || bookT(e.shs.b))})</a>` : ""}</p>` : "";
    const qx = k.startsWith("q:") ? `<div class="khtf" data-tf="${E(k.slice(2))}"><small class="mut">التفسير المختصر…</small></div>` : "";
    const lnk = !k.startsWith("q:") && (e.lib || e.b || (e.vs || {}).b) ? `<p class="mut">المصدر: ${e.lib ? `<a href="#/hadith/x/${E(e.lib)}">قسم الحديث</a> • ` : ""}${(e.b || (e.vs || {}).b) ? `<a href="#/book/${E(e.b || e.vs.b)}/${e.p || (e.vs || {}).p || 1}">${E(bookT(e.b || e.vs.b))}${(e.p || (e.vs || {}).p) && !/^sv/.test(e.b || e.vs.b) ? "، ص " + A2(e.p || e.vs.p) : ""}</a>` : ""}${e.ok === false ? ' <span class="khbad">لم يُتحقق من نصه</span>' : e.ok ? ' <span class="khgood" title="نصه مطابق لمصدره في المكتبة">✓ موثَّق</span>' : ""}</p>` : "";
    if (!w && !sh && !e.dl && !(e.f || []).length && !qx && !lnk) return "";
    return `<div class="khevn">${e.dl ? `<p><b>وجه الاستدلال:</b> ${E(e.dl)}</p>` : ""}${qx}${sh}${w ? `<p><b>معاني الكلمات:</b></p><ul>${w}</ul>` : ""}${(e.f || []).length ? `<p><b>فوائد للخطيب:</b></p><ul>${e.f.map(f => `<li>${E(f)}</li>`).join("")}</ul>` : ""}${lnk}<p class="mut khlbl">الشروح الموجزة صياغة تحريرية مستفادة من المصادر المذكورة؛ والنقول بنصها.</p></div>`;
  }
  const bookT = b => { if (!b) return ""; const x = typeof lib !== "undefined" && lib.books.find(y => y.id === b); return x ? (x.setTitle || x.title) : b; };
  async function fillTafsir(root) {
    for (const el of root.querySelectorAll("[data-tf]:not([data-done])")) {
      el.dataset.done = 1; const [s, ab] = el.dataset.tf.split(":"), [a, b] = ab.split("-").map(Number);
      const T = await getJ("data/quran/tafsir/mokhtasar/" + s + ".json"); if (!T) { el.remove(); continue; }
      const L = []; for (let i = a; i <= (b || a); i++) if (T[i]) L.push(T[i]);
      el.innerHTML = L.length ? `<p><b>التفسير المختصر:</b> ${E(L.join(" "))} <a class="mut" href="#/mushaf/${s}/${a}">(المختصر في التفسير — المصحف)</a></p>` : "";
    }
  }

  /* ---------- البحث ---------- */
  function surahQ(q) {
    const m = q.match(/^(\d{1,3})\s*[:،,]\s*(\d{1,3})$/); if (m) return m[1] + ":" + m[2];
    const n = N(q).replace(/^سوره /, ""), mm = n.match(/^(.+?)\s+(\d{1,3})$/);
    if (mm) { const i = SUR.findIndex(s => N(s) === mm[1]); if (i >= 0) return (i + 1) + ":" + mm[2]; }
    return null;
  }
  async function search(q, o) {
    const L = (await idx()).filter(pubOk); q = (q || "").trim();
    const T = N(q).split(" ").filter(w => w.length > 1), qk = surahQ(q);
    if (o.content && T.length && !WORDS) WORDS = (await getJ(P + "words.json")) || {};
    const res = [];
    L.forEach(x => {
      if (o.c && !(x.cats || []).includes(o.c)) return; if (o.s && !(x.seas || []).includes(o.s)) return;
      if (o.m && !(o.m in (x.ms || {}))) return; if (o.st && x.st !== o.st) return;
      if (!T.length && !qk) return res.push({ x, sc: (x.feat ? 2 : 0) + (x.upd || "").localeCompare("2000") * 0, why: [] });
      let sc = 0; const why = new Set();
      const tt = N(x.t + " " + (x.sub || "")), su = N(x.sum || ""), kw = N((x.kw || []).join(" ")), cn = N((x.cats || []).concat(x.seas || []).map(c => catT(c).t).join(" ")), ev = (x.ev || []).join(" | "), W = WORDS ? " " + (WORDS[x.s] || "") + " " : "";
      if (qk && (x.ev || []).some(e => e === "q:" + qk || e.startsWith("q:" + qk.split(":")[0] + ":") && e === "q:" + qk)) { sc += 10; why.add("فيها الآية"); }
      if (N(q) && tt.includes(N(q))) { sc += 8; why.add("في العنوان"); }
      T.forEach(w => { const r = w.replace(/^(وال|بال|فال|ال|و)/, ""), hit = s => s.includes(w) || (r.length > 2 && s.includes(r));
        if (hit(tt)) { sc += 4; why.add("في العنوان"); } if (hit(kw)) { sc += 3; why.add("في الكلمات المفتاحية"); } if (hit(su)) { sc += 2; why.add("في الملخص"); }
        if (hit(cn)) { sc += 2; why.add("في التصنيف"); } if (hit(ev)) { sc += 2.5; why.add("في الأدلة"); } if (W && (W.includes(" " + w) || (r.length > 2 && W.includes(" " + r)))) { sc += 1; why.add("في المضمون"); } });
      if (sc > 0) res.push({ x, sc: sc + (x.st === "ok" ? .5 : 0), why: [...why] });
    });
    return res.sort((a, b) => b.sc - a.sc || (b.x.upd || "").localeCompare(a.x.upd || ""));
  }
  function similar(x, L, n) {
    const S = a => new Set((a.cats || []).map(c => "c" + c).concat((a.kw || []).map(N)).concat((a.ev || []).filter(e => e.startsWith("q:"))).concat(N(a.t).split(" ")));
    const A = S(x); return L.filter(y => y.s !== x.s && pubOk(y)).map(y => { const B = S(y); let k = 0; A.forEach(v => B.has(v) && k++); return { y, k: k / (A.size + B.size - k || 1) }; }).filter(z => z.k > .05).sort((a, b) => b.k - a.k).slice(0, n || 4).map(z => z.y);
  }

  /* ---------- البطاقات ---------- */
  const badge = st => `<span class="khst khst-${E(st || "draft")}">${E(STN[st] || st)}</span>`;
  function card(x, why) {
    const ms = Object.keys(x.ms || {}).sort(), fav = ls.g("fav", []).includes(x.s);
    return `<a class="khcard" href="#/khutab/${encodeURIComponent(x.s)}">${x.feat ? '<span class="khfeat" title="مميزة">★</span>' : ""}<h4>${E(x.t)}${fav ? " <small>♥</small>" : ""}</h4>${x.sub ? `<p class="khsub">${E(x.sub)}</p>` : ""}${x.sum ? `<p class="mut khsum">${E(x.sum.slice(0, 170))}${x.sum.length > 170 ? "…" : ""}</p>` : ""}
      <div class="khmeta">${(x.cats || []).slice(0, 3).map(c => `<span class="chip sm">${cic(c)} ${E(catT(c).t)}</span>`).join("")}${(x.seas || []).map(c => `<span class="chip sm khseas">${cic(c)} ${E(catT(c).t)}</span>`).join("")}</div>
      <div class="khmeta mut"><span>${ms.map(m => MI[m]).join(" ")} ${A2(ms.length)} ${ms.length === 1 ? "نموذج" : "نماذج"}</span>${x.n ? `<span>≈ ${A2(mins(x.n / Math.max(1, ms.length)))} دقيقة للنموذج</span>` : ""}${adm() && x.st !== "ok" ? badge(x.st) : ""}${adm() && x.qe ? `<span class="khbad">${A2(x.qe)} ملاحظة تحقق</span>` : ""}</div>
      ${why && why.length ? `<div class="khwhy">${why.map(w => `<span>${E(w)}</span>`).join("")}</div>` : ""}</a>`;
  }

  /* ---------- الرئيسية ---------- */
  async function home(q) {
    view('<p class="mut">جارٍ تحميل خطب الجمعة…</p>');
    await cats(); const L = (await idx()).filter(pubOk);
    if (!WATCH) WATCH = (await getJ(P + "watch.json")) || {};
    const qs = q.q || "", hasQ = qs || q.c || q.s || q.m;
    const opt = (arr, v) => arr.map(c => `<option value="${E(c.id)}"${c.id === v ? " selected" : ""}>${E(c.t)}</option>`).join("");
    const form = `<form class="khsrch" data-form="khs"><input name="q" type="search" value="${E(qs)}" placeholder="ابحث بعنوان، أو كلمة، أو آية (الحجرات ١٢)، أو حديث…" aria-label="بحث في خطب الجمعة"><button class="btn p">بحث</button>
      <div class="khflt"><select name="c" aria-label="التصنيف"><option value="">كل الموضوعات</option>${opt(CATS.topics, q.c)}</select><select name="s" aria-label="الموسم"><option value="">كل المواسم</option>${opt(CATS.seasons, q.s)}</select>
      <select name="m" aria-label="النموذج"><option value="">كل النماذج</option>${[1, 2, 3].map(m => `<option value="${m}"${String(m) === q.m ? " selected" : ""}>${MN[m]}</option>`).join("")}</select>
      <label class="inl"><input type="checkbox" name="x"${q.x !== "0" ? " checked" : ""}> في المضمون كاملًا</label>${adm() ? `<select name="st" aria-label="الحالة"><option value="">كل الحالات</option>${Object.entries(STN).map(([k, v]) => `<option value="${k}"${k === q.st ? " selected" : ""}>${v}</option>`).join("")}</select>` : ""}</div></form>`;
    const nOk = L.filter(x => x.st === "ok").length, nK = L.reduce((s, x) => s + Object.keys(x.ms || {}).length, 0);
    const hero = `<section class="khhero"><div><h2>${IC("mic-vocal", 30)} خطب الجمعة</h2><p>مرجع متجدد للخطباء: لكل موضوع ثلاثة نماذج — <b>ميسرة</b> و<b>علمية تأصيلية</b> و<b>بلاغية مؤثرة</b> — بأدلة مرتبة، وشروح موجزة، ومراجع من مكتبة الدعوة السلفية، مع وضع للإلقاء وتحميل بمقاسات المنبر.</p>
      <p class="mut">${A2(L.length)} موضوعًا • ${A2(nK)} خطبة${adm() ? ` • ${A2(nOk)} معتمد` : ""}${adm() ? ` • <a href="#/khutab/admin">${IC("settings", 15)} لوحة إدارة الخطب</a>` : ""}</p></div></section>`;
    if (hasQ) {
      const R = await search(qs, { c: q.c, s: q.s, m: q.m, st: q.st, content: q.x !== "0" });
      const sug = (WATCH.sug || []).filter(s => qs && N(s.t).includes(N(qs).split(" ")[0])).slice(0, 4);
      return view(`${hero}${form}<p class="mut">${A2(R.length)} نتيجة${qs ? ` لـ«${E(qs)}»` : ""}</p><div class="khgrid">${R.map(r => card(r.x, r.why)).join("")}</div>
        ${!R.length ? `<p class="note">لا خطب في هذا بعد.${adm() ? ` <a href="javascript:void 0" data-kh="qadd" data-t="${E(qs)}">أضفه إلى طابور الإعداد</a>` : " اقترحه على الإدارة من «تواصل معنا»."}</p>` : ""}
        ${sug.length ? `<h3>موضوعات مقترحة قريبة لم تُعدّ بعد</h3><ul>${sug.map(s => `<li>${E(s.t)} <small class="mut">${E(s.why || "")}</small>${adm() ? ` <a href="javascript:void 0" data-kh="qadd" data-t="${E(s.t)}" data-src="${E((s.src || []).join(" "))}" data-seas="${E((s.seas || []).join(" "))}">أعدّ مسودة</a>` : ""}</li>`).join("")}</ul>` : ""}`);
    }
    // الجمعة القادمة وتقويم الجمعات
    const F = fridays(6), up = upcoming(60);
    const cal = `<section class="khcal"><h3>${IC("calendar-days")} الجمعات القادمة</h3><div class="khfri">${F.map((d, i) => { const ss = seasonsOn(d), iso = d.toISOString().slice(0, 10), sch = L.filter(x => x.sched === iso);
      return `<div class="khday${i === 0 ? " now" : ""}"><b>${i === 0 ? "الجمعة القادمة" : E(gS(d))}</b><span>${i === 0 ? E(gS(d)) + " • " : ""}${E(hijS(d))}</span>${ss.map(s => `<a class="chip sm khseas" href="#/khutab?s=${s}">${cic(s)} ${E(catT(s).t)}</a>`).join("")}${sch.map(x => `<a class="khsch" href="#/khutab/${encodeURIComponent(x.s)}">${IC("flag", 14)} ${E(x.t)}</a>`).join("")}</div>`; }).join("")}</div></section>`;
    const upS = Object.entries(up).sort((a, b) => a[1] - b[1]).map(([s, n]) => ({ S: catT(s), id: s, n, L: L.filter(x => (x.seas || []).includes(s)) }));
    const seas = upS.length ? `<section><h3>${IC("moon-star")} مواسم قريبة</h3>${upS.map(u => `<div class="khup"><h4>${cic(u.id, 18)} ${E(u.S.t)} <small class="mut">${u.n ? "بعد " + A2(u.n) + " يومًا" : "الآن"}</small></h4>${u.L.length ? `<div class="khgrid">${u.L.slice(0, 4).map(x => card(x)).join("")}</div>` : `<p class="mut">لم تُعتمد خطب لهذا الموسم بعد${(u.S.ideas || []).length ? "؛ موضوعات مقترحة: " + u.S.ideas.map(E).join("، ") : ""}.</p>`}</div>`).join("")}</section>` : "";
    const seen = ls.g("seen", {}), pos = ls.g("pos", {}), favs = ls.g("fav", []);
    const recent = Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([s]) => L.find(x => x.s === s)).filter(Boolean).slice(0, 4);
    const mine = (favs.length || recent.length) ? `<section class="khmine">${recent.length ? `<h3>${IC("history")} تابع من حيث توقفت</h3><div class="khgrid">${recent.map(x => { const k = Object.keys(pos).find(p => p.startsWith(x.s + "/")); return card(x).replace("</a>", k ? `<span class="khres">استئناف ${MI[k.split("/")[1]] || ""} ${E(MN[k.split("/")[1]] || "")}</span></a>` : "</a>"); }).join("")}</div>` : ""}
      ${favs.length ? `<h3>${IC("heart")} مفضلتي</h3><div class="khgrid">${favs.map(s => L.find(x => x.s === s)).filter(Boolean).map(x => card(x)).join("")}</div>` : ""}</section>` : "";
    const feat = L.filter(x => x.feat).slice(0, 6), latest = L.slice().sort((a, b) => (b.upd || "").localeCompare(a.upd || "")).slice(0, 6);
    const cnt = id => L.filter(x => (x.cats || []).includes(id) || (x.seas || []).includes(id)).length;
    const grid = (arr, k) => `<div class="khcats">${arr.map(c => `<a href="#/khutab?${k}=${E(c.id)}" class="${cnt(c.id) ? "" : "zero"}"><span class="khci">${IC(c.ic, 22)}</span><b>${E(c.t)}</b>${cnt(c.id) ? `<small class="khcn">${A2(cnt(c.id))}</small>` : ""}</a>`).join("")}</div>`;
    const sv = (typeof lib !== "undefined" ? lib.books.filter(b => b.topicId === "st15" && !b.hidden) : []).slice(-8).reverse();
    const sug = (WATCH.sug || []).filter(s => s.kind !== "season").slice(0, 8);
    view(`${hero}${form}${cal}${seas}${mine}
      ${feat.length ? `<section><h3>${IC("star")} خطب مختارة</h3><div class="khgrid">${feat.map(x => card(x)).join("")}</div></section>` : ""}
      <section><h3>${IC("layout-grid")} التصنيف الموضوعي</h3>${grid(CATS.topics, "c")}</section><section><h3>${IC("calendar-heart")} التصنيف الموسمي</h3>${grid(CATS.seasons, "s")}</section>
      ${latest.length ? `<section><h3>${IC("badge-plus")} أحدث الموضوعات</h3><div class="khgrid">${latest.map(x => card(x)).join("")}</div></section>` : ""}
      ${sv.length ? `<section><h3>${IC("radio")} من «موعظة الأسبوع» بموقع صوت السلف</h3><p class="mut">من مصادر القسم الأولى: عناصر الخطب المقترحة لمشايخ الدعوة، بنصوصها في المكتبة.</p><ul class="khsv">${sv.map(b => `<li><a href="#/book/${E(b.id)}/1">${E(b.title)}</a></li>`).join("")}</ul></section>` : ""}
      ${sug.length ? `<section><h3>${IC("lightbulb")} موضوعات تحتاج إلى إعداد</h3><p class="mut">مما رصدته المتابعة الدورية في مواد المكتبة ولم يُغطَّ بعد.</p><ul>${sug.map(s => `<li>${E(s.t)} <small class="mut">${E(s.why || "")}</small>${adm() ? ` <a href="javascript:void 0" data-kh="qadd" data-t="${E(s.t)}" data-src="${E((s.src || []).join(" "))}">أعدّ مسودة</a>` : ""}</li>`).join("")}</ul></section>` : ""}
      <p class="note">منهج القسم: المادة العلمية من مكتبة الدعوة السلفية أولًا ثم بقية المكتبة، ونص القرآن من المصحف المعتمد بالموقع، والأحاديث والنقول بنصوصها ومواضعها، ولا تُنشر خطبة إلا بعد مراجعة علمية وتحريرية.</p>`);
  }

  /* ---------- صفحة الموضوع ---------- */
  const PREF = () => Object.assign({ fs: 1.25, lh: 2.1, gap: 1, theme: "", refs: 1, notes: 1, tab: "k" }, ls.g("prefs", {}));
  async function show(s, q) {
    view('<p class="mut">جارٍ التحميل…</p>'); await cats(); const tp = await topic(s);
    if (!tp) return view('<p class="note">الموضوع غير موجود. <a href="#/khutab">← خطب الجمعة</a></p>');
    const MS = modelsOf(tp); if (!MS.length) return view(`<p class="note">لم تُعتمد خطب هذا الموضوع بعد. <a href="#/khutab">← خطب الجمعة</a></p>`);
    await ensureQ(tp);
    const mk = MS.includes(String(q.m)) ? String(q.m) : MS[0], M = tp.models[mk], pf = PREF();
    const seen = ls.g("seen", {}); seen[s] = Date.now(); ls.s("seen", seen);
    const fav = ls.g("fav", []).includes(s), tab = q.v || pf.tab || "k", pos = ls.g("pos", {})[s + "/" + mk];
    const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: pf.refs ? "mark" : "hide", notes: !!pf.notes, withEv: tab === "e" };
    const parts = render(tp, mk, C);
    const L = await idx(), me = L.find(x => x.s === s) || { s, t: tp.t, cats: tp.cats, kw: tp.kw, ev: [] };
    const sim = similar(me, L, 4);
    const evL = evOrder(tp, M.body);
    const tabs = [["k", "scroll-text", "الخطبة"], ["e", "network", "الخطبة مع الأدلة"], ["d", "list-checks", "أدلة الخطبة"], ["w", "book-a", "المعاني والشروح"], ["r", "library", "المراجع"]];
    const body = tab === "d" ? evList(tp, mk, evL) : tab === "w" ? meanings(tp, evL) : tab === "r" ? refList(tp, mk) :
      parts.map(p => `<section class="khpart" id="kp${p.n}"><h3 class="khpt">${E(p.title)}</h3>${joinItems(p.items)}</section>`).join("");
    const st = M.st !== "ok" ? `<div class="khwarn">⚠️ هذه الخطبة <b>${E(STN[M.st] || M.st)}</b> — ${M.st === "rej" ? "رُفضت ولم تُنشر." : "لم تُعتمد بعد للنشر، ولا يراها إلا المشرفون" + (CATS.pub_review ? " والزوار بهذه العلامة" : "") + "."}${(tp.qa || {}).errs && tp.qa.errs.length ? ` <b>${A2(tp.qa.errs.length)} ملاحظة تحقق</b>.` : ""}</div>` : "";
    view(`<nav class="khcrumb"><a href="#/khutab">${IC("mic-vocal", 14)} خطب الجمعة</a>${(tp.cats || []).slice(0, 1).map(c => ` › <a href="#/khutab?c=${E(c)}">${E(catT(c).t)}</a>`).join("")}</nav>
      <header class="khhead"><h2>${E(tp.t)}</h2>${tp.sub ? `<p class="khsub">${E(tp.sub)}</p>` : ""}${tp.sum ? `<p class="mut">${E(tp.sum)}</p>` : ""}
       <div class="khmeta">${(tp.cats || []).map(c => `<a class="chip sm" href="#/khutab?c=${E(c)}">${cic(c)} ${E(catT(c).t)}</a>`).join("")}${(tp.seas || []).map(c => `<a class="chip sm khseas" href="#/khutab?s=${E(c)}">${cic(c)} ${E(catT(c).t)}</a>`).join("")}</div></header>
      <div class="khmodels" role="tablist" aria-label="نماذج الخطبة">${MS.map(k => `<a role="tab" aria-selected="${k === mk}" class="khm${k === mk ? " on" : ""}" href="#/khutab/${encodeURIComponent(s)}?m=${k}${tab !== "k" ? "&v=" + tab : ""}"><b>${MI[k]} الخطبة ${MN[k]}</b><span>${E(tp.models[k].title || "")}</span><small>${E(MD[k])} • ≈ ${A2(mins(tp.models[k].words))} دقيقة${adm() && tp.models[k].st !== "ok" ? " • " + E(STN[tp.models[k].st] || "") : ""}</small></a>`).join("")}</div>
      ${st}
      <div class="khbar"><button class="btn p" data-kh="deliver" data-s="${E(s)}" data-m="${mk}">${IC("mic-vocal", 16)} إلقاء الخطبة</button><button class="btn" data-kh="export" data-s="${E(s)}" data-m="${mk}">${IC("download", 16)} تحميل وطباعة</button>
       <button class="btn" data-kh="fav" data-s="${E(s)}" aria-pressed="${fav}">${IC("heart", 16)} ${fav ? "في المفضلة" : "المفضلة"}</button><button class="btn" data-kh="share" data-t="${E(tp.t)}">${IC("rss", 16)} مشاركة</button><button class="btn" data-kh="copy" data-s="${E(s)}" data-m="${mk}">${IC("file-text", 16)} نسخ النص</button>
       ${adm() ? `<a class="btn" href="#/khutab/edit/${encodeURIComponent(s)}?m=${mk}">${IC("pencil", 16)} تحرير</a>` : ""}${pos && pos.y > .03 ? `<button class="btn" data-kh="resume" data-y="${pos.y}">${IC("history", 16)} تابع من موضعك (${A2(Math.round(pos.y * 100))}٪)</button>` : ""}</div>
      <div class="khview"><div class="chips" role="tablist">${tabs.map(([k, i, t]) => `<a class="chip${k === tab ? " x" : ""}" href="#/khutab/${encodeURIComponent(s)}?m=${mk}&v=${k}">${IC(i, 15)} ${t}</a>`).join("")}</div>
       <div class="khtools" aria-label="خيارات العرض"><button data-kh="fs" data-d="-1" title="تصغير الخط">ا−</button><button data-kh="fs" data-d="1" title="تكبير الخط">ا+</button><button data-kh="lh" title="المسافات بين الأسطر">↕</button><button data-kh="gap" title="المسافات بين الفقرات">¶</button><button data-kh="theme" title="الوضع الليلي">${IC("moon-star", 15)}</button><button data-kh="refs" aria-pressed="${!!pf.refs}" title="إظهار المراجع أو إخفاؤها">${pf.refs ? "المراجع ✓" : "المراجع ✗"}</button><button data-kh="notes" aria-pressed="${!!pf.notes}" title="تنبيهات الخطيب">${pf.notes ? "التنبيهات ✓" : "التنبيهات ✗"}</button></div></div>
      ${tab === "k" || tab === "e" ? `<nav class="khparts">${parts.map(p => `<a href="javascript:void 0" data-kh="part" data-n="${p.n}">${E(p.title)}</a>`).join("")}<span class="mut">${A2(evL.length)} دليلًا • ≈ ${A2(mins(M.words))} دقيقة</span></nav>` : ""}
      <article class="khtext${pf.theme === "dark" ? " khdark" : ""}" style="--khfs:${pf.fs}rem;--khlh:${pf.lh};--khgap:${pf.gap}em" data-s="${E(s)}" data-m="${mk}">${body}</article>
      ${sim.length ? `<section><h3>خطب ذات صلة</h3><div class="khgrid">${sim.map(x => card(x)).join("")}</div></section>` : ""}
      ${(tp.src || []).length ? `<section class="mut"><h4>مصادر إعداد الموضوع في المكتبة</h4><ul class="khsv">${tp.src.map(b => `<li><a href="#/book/${E(b)}/1">${E(bookT(b))}</a></li>`).join("")}</ul></section>` : ""}
      ${(tp.log || []).length ? `<p class="mut khlog">آخر تحديث: ${E(tp.upd || tp.at || "")}${M.rev ? " • راجعها: " + E(M.rev) : ""}</p>` : ""}`);
    const art = $("#app .khtext"); if (art) { fillTafsir(art); trackPos(art, s, mk); }
  }
  function trackPos(el, s, mk) {
    let t = 0; const save = () => { const r = el.getBoundingClientRect(), h = el.offsetHeight - innerHeight; if (h <= 0) return; const y = Math.min(1, Math.max(0, -r.top / h)); const P0 = ls.g("pos", {}); P0[s + "/" + mk] = { y: +y.toFixed(3), at: Date.now() }; ls.s("pos", P0); };
    const on = () => { if (!document.body.contains(el)) return removeEventListener("scroll", on); clearTimeout(t); t = setTimeout(save, 400); }; addEventListener("scroll", on, { passive: true });
  }
  function evList(tp, mk, evL) {
    // تجميع الأدلة بالمحور الذي وردت فيه
    const B = parse(tp.models[mk].body); let part = "", ax = "", n = 0; const groups = []; const seen = new Set();
    B.forEach(b => { if (b.k === "part") { part = b.x; ax = ""; } else if (b.k === "h2") ax = b.x;
      (b.k === "ev" ? `{${b.t}:${b.id}}` + b.x : b.x || "").replace(/\{(q|h|a|v):([^}]+)\}/g, (m, t, id) => { const k = t === "q" ? "q:" + id : id; if (seen.has(k)) return m; seen.add(k); const g = part + " › " + (ax || "المقدمة"); let G = groups[groups.length - 1]; if (!G || G.g !== g) groups.push(G = { g, L: [] }); G.L.push(k); return m; }); });
    const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: "hide" };
    return `<p class="mut">الأدلة مرتبة بحسب ورودها في الخطبة (لا بترتيب المصحف أو الكتب)، ليسهل حفظها ومراجعتها قبل الإلقاء. اضغط أي كلمة في الدليل لمعناها من معاجم المكتبة.</p>
      ${groups.map(G => `<h4 class="khgrp">${E(G.g.replace(/^ › /, ""))}</h4>${G.L.map(k => { n++; const blk = k.startsWith("q:") ? { k: "ev", t: "q", id: k.slice(2), x: "" } : { k: "ev", t: "h", id: k, x: "" }; return `<div class="khevc"><span class="khno">${A2(n)}</span>${evBlock(blk, C)}</div>`; }).join("")}`).join("")}`;
  }
  function meanings(tp, evL) {
    const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: "hide" };
    return `<p class="mut">خدمة مساندة للخطيب: معاني الكلمات، والشرح الإجمالي للآيات من «المختصر في التفسير»، وشروح الأحاديث من كتب الشروح في المكتبة، ووجه الاستدلال، وأهم الفوائد. اضغط أي كلمة في نص الدليل لمعناها.</p>
      ${evL.map((x, i) => { const k = x.q ? "q:" + x.q : x.id, blk = x.q ? { k: "ev", t: "q", id: x.q, x: "" } : { k: "ev", t: "h", id: x.id, x: "" };
        return `<details class="khmean"${i < 3 ? " open" : ""}><summary><span class="khno">${A2(i + 1)}</span> ${x.q ? "﴿" + E((qtxt(tp, ...x.q.split(/[:-]/).map(Number)) || "").split(" ").slice(0, 7).join(" ")) + "…﴾" : "«" + E(((tp.ev[x.id] || {}).t || "").split(" ").slice(0, 8).join(" ")) + "…»"}</summary>${evBlock(blk, C)}${evNote(tp, k) || '<p class="mut">لم تُضف شروح لهذا الدليل بعد.</p>'}</details>`; }).join("")}`;
  }
  function refList(tp, mk) {
    const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: "mark" }; render(tp, mk, C);
    const used = [...C.refs.entries()];
    const evs = evOrder(tp, tp.models[mk].body).filter(x => x.id).map(x => tp.ev[x.id]).filter(Boolean);
    return `<p class="mut">العزو المختصر يظهر في المتن علامةً صغيرة؛ اضغطها لبيانات المصدر، أو افتح المصدر في المكتبة مباشرة.</p>
      <h4>مراجع هذه الخطبة</h4>${used.length ? `<ol class="khrefs">${used.map(([id, n]) => { const r = tp.refs[id]; return `<li value="${n}"><a href="#/book/${E(r.b)}/${r.p || 1}">${E(refLabel(r))}</a>${r.q ? `<blockquote>«${E(r.q)}»</blockquote>` : ""}${r.ok === false ? ' <span class="khbad">لم يُتحقق</span>' : ""}</li>`; }).join("")}</ol>` : '<p class="mut">لا علامات مراجع في هذا النموذج.</p>'}
      <h4>مصادر الأدلة</h4><ul class="khrefs">${evs.map(e => `<li>«${E(e.t.split(" ").slice(0, 8).join(" "))}…» — ${E(evCite(e))}: ${e.lib ? `<a href="#/hadith/x/${E(e.lib)}">قسم الحديث</a> • ` : ""}<a href="#/book/${E(e.b || (e.vs || {}).b)}/${e.p || (e.vs || {}).p || 1}">${E(bookT(e.b || (e.vs || {}).b))}</a>${e.ok ? ' <span class="khgood">✓</span>' : ""}</li>`).join("")}</ul>`;
  }
  /* نافذة المرجع */
  function refPop(el) {
    document.querySelectorAll(".khpop").forEach(x => x.remove());
    const art = el.closest("[data-s]"), tp = TP[art && art.dataset.s]; if (!tp) return; const r = (tp.refs || {})[el.dataset.r]; if (!r) return;
    const d = document.createElement("div"); d.className = "khpop"; d.setAttribute("role", "dialog");
    d.innerHTML = `<b>${E(refLabel(r))}</b>${r.q ? `<p>«${E(r.q)}»</p>` : ""}<p><a href="#/book/${E(r.b)}/${r.p || 1}">افتح المصدر في المكتبة ←</a></p><button class="x" aria-label="إغلاق">✕</button>`;
    document.body.appendChild(d); const b = el.getBoundingClientRect(); d.style.top = (scrollY + b.bottom + 6) + "px"; d.style.left = Math.max(8, Math.min(innerWidth - d.offsetWidth - 8, b.left - d.offsetWidth / 2)) + "px";
  }
  /* معنى الكلمة من معاجم المكتبة (data/gloss) */
  async function glossPop(word, x, y) {
    document.querySelectorAll(".khpop").forEach(el => el.remove());
    const w = N(word).replace(/\s/g, ""); if (w.length < 2) return; const cands = [...new Set([w, w.replace(/^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل)(?=..)/, ""), w.replace(/^(و|ف)/, "")])];
    let hit = null;
    for (const c of cands) { if (c.length < 2) continue; const f = "data/gloss/" + [c[0], c[1]].map(ch => ch.charCodeAt(0).toString(16).padStart(4, "0")).join("-") + ".json"; const G = await getJ(f); if (G && G[c]) { hit = [c, G[c]]; break; } }
    const d = document.createElement("div"); d.className = "khpop"; d.innerHTML = hit ? `<b>${E(word)}</b>${hit[1].slice(0, 2).map(e => `<p>${E(e[3])} <a class="mut" href="#/book/${E(e[0])}/${e[1]}">(${E(bookT(e[0]))})</a></p>`).join("")}<button class="x" aria-label="إغلاق">✕</button>` : `<b>${E(word)}</b><p class="mut">لم يوجد في معاجم المكتبة.</p><button class="x" aria-label="إغلاق">✕</button>`;
    document.body.appendChild(d); d.style.top = (scrollY + y + 12) + "px"; d.style.left = Math.max(8, Math.min(innerWidth - d.offsetWidth - 8, x - 140)) + "px";
  }

  /* ---------- وضع الإلقاء ---------- */
  let WL = null, AS = 0, AST = null, T0 = 0;
  async function deliver(s, q) {
    await cats(); const tp = await topic(s); if (!tp) return show(s, q); const MS = modelsOf(tp); const mk = MS.includes(String(q.m)) ? String(q.m) : MS[0]; if (!mk) return show(s, q);
    await ensureQ(tp); const pf = Object.assign({ dfs: 1.9, dlh: 1.95, dth: "dark", dn: 1 }, ls.g("dprefs", {}));
    const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: "hide", notes: !!pf.dn }; const parts = render(tp, mk, C);
    document.querySelectorAll(".khdlv").forEach(x => x.remove());
    const d = document.createElement("div"); d.className = "khdlv th-" + pf.dth; d.style.cssText = `--dfs:${pf.dfs}rem;--dlh:${pf.dlh}`; d.dataset.s = s; d.dataset.m = mk;
    d.innerHTML = `<div class="khdbar"><button data-kd="exit" aria-label="خروج من وضع الإلقاء">✕</button>${parts.map(p => `<button data-kd="part" data-n="${p.n}">${E(p.title.replace("الخطبة ", ""))}</button>`).join("")}
      <button data-kd="fs" data-d="-1" aria-label="تصغير">ا−</button><button data-kd="fs" data-d="1" aria-label="تكبير">ا+</button><button data-kd="lh" aria-label="المسافات">↕</button><button data-kd="th" aria-label="الألوان">◐</button><button data-kd="nt" aria-label="تنبيهات الخطيب" aria-pressed="${!!pf.dn}">✎</button>
      <button data-kd="auto" aria-label="تمرير تلقائي">▶︎</button><span class="khclock" aria-live="off">٠٠:٠٠</span><span class="khwl" title="إبقاء الشاشة مضاءة"></span></div><div class="khprog"><i></i></div>
      <div class="khdtext"><h2>${E(tp.models[mk].title || tp.t)}</h2>${parts.map(p => `<section class="khpart" id="kd${p.n}"><h3 class="khpt">${E(p.title)}</h3>${joinItems(p.items)}</section>`).join('<div class="khsep" aria-hidden="true">✦ ✦ ✦<br><small>الجلسة بين الخطبتين</small></div>')}<p class="khend">— انتهت الخطبة —</p></div>`;
    document.body.appendChild(d); document.body.classList.add("khdl"); T0 = Date.now();
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch (e) { }
    wake(true); clock();
    const box = d.querySelector(".khdtext"), key = s + "/" + mk + "/d", P0 = ls.g("pos", {})[key];
    if (P0 && P0.y > .02) setTimeout(() => { box.scrollTop = P0.y * (box.scrollHeight - box.clientHeight); toast && toast("↩︎ عدت إلى موضعك؛ اضغط «الأولى» للبدء من أول الخطبة"); }, 60);
    let tm = 0; box.addEventListener("scroll", () => { const y = box.scrollTop / Math.max(1, box.scrollHeight - box.clientHeight); d.querySelector(".khprog i").style.width = (y * 100) + "%"; clearTimeout(tm); tm = setTimeout(() => { const P1 = ls.g("pos", {}); P1[key] = { y: +y.toFixed(3), at: Date.now() }; ls.s("pos", P1); }, 500); }, { passive: true });
  }
  async function wake(on) { try { if (on && "wakeLock" in navigator) { WL = await navigator.wakeLock.request("screen"); const i = document.querySelector(".khwl"); if (i) i.textContent = "☀︎"; WL.addEventListener("release", () => { const j = document.querySelector(".khwl"); if (j) j.textContent = ""; }); } else if (!on && WL) { WL.release(); WL = null; } } catch (e) { } }
  function clock() { const c = document.querySelector(".khclock"); if (!c) return; const t = Math.floor((Date.now() - T0) / 1000); c.textContent = A2(String(Math.floor(t / 60)).padStart(2, "0")) + ":" + A2(String(t % 60).padStart(2, "0")); setTimeout(clock, 1000); }
  function exitDeliver() { document.querySelectorAll(".khdlv").forEach(x => x.remove()); document.body.classList.remove("khdl"); wake(false); clearInterval(AST); AS = 0; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && document.querySelector(".khdlv")) wake(true); });
  ["hashchange", "popstate"].forEach(ev => window.addEventListener(ev, () => setTimeout(() => { if (!/\/deliver/.test(location.pathname + location.hash) && document.querySelector(".khdlv")) exitDeliver(); }, 0)));

  /* ---------- النص المجرد ---------- */
  function plainText(tp, mk, part) {
    const C = { tp, refs: new Map(), fn: [], mode: "print", refMode: "foot", evMode: "inline", notes: false };
    const parts = render(tp, mk, C).filter(p => !part || p.n === part); const tmp = document.createElement("div");
    const lines = [tp.models[mk].title || tp.t, ""];
    let fnN = 0; const fns = [];
    parts.forEach(p => { lines.push("— " + p.title + " —", ""); p.items.forEach(it => { tmp.innerHTML = it.html; tmp.querySelectorAll("sup.fnm").forEach(x => x.textContent = "[" + (++fnN) + "]"); tmp.querySelectorAll(".khno").forEach(x => x.remove()); let t = tmp.textContent.trim(); if (it.b.k === "li") t = "• " + t; if (/h[23]/.test(it.b.k)) t = "◆ " + t; if (t) lines.push(t, ""); }); });
    C.fn.forEach(f => { tmp.innerHTML = f; fns.push(tmp.textContent); });
    if (fns.length) { lines.push("ـــــــــــ", "المراجع:"); fns.forEach((f, i) => lines.push("[" + (i + 1) + "] " + f)); }
    lines.push("", "من قسم «خطب الجمعة» — مكتبة الدعوة السلفية الرقمية: " + location.origin + "/#/khutab/" + tp.s);
    return lines.join("\n");
  }

  /* ---------- التحميل: الترقيم الذكي للصفحات ---------- */
  const PAPER = { a4: { w: 210, h: 297, t: "A4 كامل", fs: 15, m: [16, 18, 20], hd: 9 }, a5: { w: 148, h: 210, t: "نصف A4 (A5)", fs: 14, m: [10, 12, 15], hd: 8 }, a6: { w: 105, h: 148, t: "ربع A4 (A6)", fs: 12.5, m: [6, 8, 10], hd: 7 } };
  const PCSS = (o) => `@page{size:${o.P.w}mm ${o.P.h}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}
    .khpg{width:${o.P.w}mm;height:${o.P.h}mm;padding:${o.mg}mm;display:flex;flex-direction:column;direction:rtl;font-family:Amiri,"Traditional Arabic",serif;font-size:${o.fs}pt;line-height:${o.lh};color:#1b1b1b;background:#fff;overflow:hidden;page-break-after:always;break-after:page;position:relative}
    .khpg:last-child{page-break-after:auto}.khph{display:flex;justify-content:space-between;font-size:${o.P.hd}pt;color:#7a6a40;border-bottom:.3mm solid #c9b27a;padding-bottom:1mm;margin-bottom:2mm}
    .khpb{flex:1;overflow:hidden}.khpb p,.khpb li{margin:0 0 ${(o.gap * .55).toFixed(2)}em;text-align:justify}.khpb ul{margin:0 0 .5em;padding-inline-start:1.1em}
    .khpt{font-size:1.25em;text-align:center;color:#0f5c4d;margin:0 0 .5em;border-bottom:.4mm double #c9b27a;padding-bottom:.2em}.khh2{font-size:1.1em;color:#0f5c4d;margin:.5em 0 .3em}.khh3{font-size:1em;color:#0f5c4d;margin:.4em 0 .2em}
    .khay{margin:.3em 0 .55em;padding:.2em .6em;border-inline-start:1mm solid #0f5c4d;background:#f3f8f5;font-family:"Amiri Quran",Amiri,serif}.khay p{margin:0;text-align:justify}.khay cite{font-style:normal;font-size:.75em;color:#0f5c4d;font-family:Amiri,serif}
    .khhd,.khat{margin:.3em 0 .55em;padding:.2em .6em;border-inline-start:1mm solid #b88a2e;background:#fbf6ea}.khhd p,.khat p{margin:0;text-align:justify}.khhd cite,.khat cite{font-style:normal;font-size:.75em;color:#7a5a12}
    .khqi{font-family:"Amiri Quran",Amiri,serif;color:#0f5c4d}.khqi small{font-family:Amiri;font-size:.72em}
    mark.khimp{background:none;color:inherit;font-weight:700;border-bottom:.35mm solid #b88a2e}.khtr{color:#7a5a12;font-style:italic}.khnote{font-size:.8em;color:#666;border:.2mm dashed #aaa;padding:.1em .4em}.khnote span{font-weight:700}
    .khdua{text-align:center!important;color:#0f5c4d}.khpoem{display:flex;justify-content:space-around;gap:1em}.khrin{font-size:.7em;color:#666}
    sup.fnm,sup.khref{font-size:.65em;color:#b88a2e;font-family:Amiri}.khpf{border-top:.3mm solid #c9b27a;margin-top:1mm;padding-top:1mm;font-size:${(o.fs * .68).toFixed(1)}pt;line-height:1.45;color:#333}.khpf p{margin:0}.khpf:empty{display:none}
    .khpn{text-align:center;font-size:${o.P.hd}pt;color:#7a6a40;margin-top:1mm}.khcover{text-align:center;color:#0f5c4d;margin-bottom:.6em}.khcover h1{font-size:1.45em;margin:0}.khcover p{margin:0;font-size:.8em;color:#7a6a40}`;
  let FONTCSS = null;
  async function fontsEmbed() {
    if (FONTCSS !== null) return FONTCSS; FONTCSS = "";
    try { const r = await fetch("https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Amiri+Quran&display=swap"); let css = await r.text();
      const blocks = css.match(/@font-face\s*{[^}]+}/g) || []; const keep = blocks.filter(b => /U\+06|U\+FB|U\+FE|U\+0-|U\+0000/.test(b) || !/unicode-range/.test(b));
      const out = []; for (const b of keep) { const u = (b.match(/url\(([^)]+)\)/) || [])[1]; if (!u) continue; const f = await fetch(u); const buf = new Uint8Array(await f.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); out.push(b.replace(u, "data:font/woff2;base64," + btoa(s))); }
      FONTCSS = out.join("\n"); } catch (e) { FONTCSS = ""; }
    return FONTCSS;
  }
  /* تقسيم الخطبة إلى صفحات بالمقاس المختار: كتل كاملة، وتُقسم الفقرة الطويلة بين صفحتين، والعنوان لا يبقى آخر الصفحة، والحواشي في أسفل صفحتها */
  async function paginate(tp, mk, o) {
    const C = { tp, refs: new Map(), fn: [], mode: "print", refMode: o.refs, evMode: o.ev, notes: o.notes };
    let parts = render(tp, mk, C); if (o.part) parts = parts.filter(p => p.n === o.part);
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-30000px;top:0;visibility:hidden"; host.innerHTML = `<style>${PCSS(o)}</style>`; document.body.appendChild(host);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const pages = []; let pg, pb, pf;
    const head = (pt) => `<div class="khph"><span>${E(tp.models[mk].title || tp.t)}</span><span>${E(pt)}</span></div>`;
    const newPage = (pt) => { pg = document.createElement("div"); pg.className = "khpg"; pg.innerHTML = (o.head ? head(pt) : "") + '<div class="khpb"></div><div class="khpf"></div><div class="khpn"></div>'; host.appendChild(pg); pb = pg.querySelector(".khpb"); pf = pg.querySelector(".khpf"); pages.push(pg); };
    const over = () => pb.scrollHeight > pb.clientHeight + 1;
    const blockEl = (html, fns) => { const t = document.createElement("template"); t.innerHTML = html.trim(); const el = t.content.firstElementChild || document.createElement("span"); el._fn = fns; return el; };
    const place = (el) => { pb.appendChild(el); (el._fn || []).forEach(f => { const p = document.createElement("p"); p.innerHTML = f; p.className = "fnl"; pf.appendChild(p); }); };
    const unplace = (el) => { el.remove(); (el._fn || []).forEach(() => pf.lastElementChild && pf.lastElementChild.remove()); };
    const render1 = (b, cls) => { C.fn = []; const h = blockHTML(b, C, 0); return blockEl(cls ? h : h, C.fn.slice()); };
    parts.forEach((p, pi) => {
      if (!pg || o.newPart || pi === 0) newPage(p.title);
      if (pi === 0 && o.head) { const cv = document.createElement("div"); cv.className = "khcover"; cv.innerHTML = `<h1>${E(tp.models[mk].title || tp.t)}</h1><p>${E(tp.t)} — الخطبة ${E(MN[mk])}</p>`; pb.appendChild(cv); }
      const pt = blockEl(`<h3 class="khpt">${E(p.title)}</h3>`, []); place(pt);
      const queue = p.items.map(it => it.b.k === "li" ? Object.assign({}, it.b, { k: "p", x: "• " + it.b.x }) : it.b);
      for (let qi = 0; qi < queue.length; qi++) {
        const b = queue[qi]; if (b.k === "note" && !o.notes) continue;
        let el = render1(b); place(el);
        if (!over()) continue;
        unplace(el);
        const split = ["p", "dua", "tr"].includes(b.k) && b.x.split(" ").length > 6;
        if (split) { // أكبر جزء من الفقرة يسع ما بقي من الصفحة
          const W = b.x.split(" "); let lo = 1, hi = W.length - 1, best = 0;
          while (lo <= hi) { const mid = (lo + hi) >> 1; const part1 = fixSplit(W.slice(0, mid).join(" ")); const e1 = render1(Object.assign({}, b, { x: part1[0] })); place(e1); const ok = !over(); unplace(e1); if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1; }
          if (best >= 4) { const [a, rest] = fixSplit(W.slice(0, best).join(" ")); const e1 = render1(Object.assign({}, b, { x: a })); e1.style.textAlignLast = "justify"; place(e1); queue.splice(qi + 1, 0, Object.assign({}, b, { x: rest + W.slice(best).join(" ") })); newPage(p.title); continue; }
        }
        // العنوان لا يبقى وحده في آخر الصفحة
        const last = pb.lastElementChild; const carry = last && /^H[3-5]$/.test(last.tagName) && pb.children.length > 1 ? last : null; if (carry) unplace(carry);
        newPage(p.title); if (carry) place(carry);
        el = render1(b); place(el);
        let k = 1; while (over() && k < 6) { el.style.fontSize = (1 - k * .07) + "em"; k++; } // كتلة أطول من صفحة كاملة (نادر في المقاس الصغير)
      }
    });
    pages.forEach((pg, i) => { let n = 0; const ms = pg.querySelectorAll(".khpb sup.fnm"), fl = pg.querySelectorAll(".khpf .fnl"); ms.forEach(m => m.textContent = "(" + A2(++n) + ")"); fl.forEach((f, j) => f.insertAdjacentHTML("afterbegin", "(" + A2(j + 1) + ") ")); pg.querySelector(".khpn").textContent = "– " + A2(i + 1) + " –"; });
    const html = pages.map(p => p.outerHTML); host.remove();
    return html;
  }
  function fixSplit(s) { // لا تنقسم علامة ** بين صفحتين
    const n = (s.match(/\*\*/g) || []).length; return n % 2 ? [s + "**", "**"] : [s, ""];
  }
  function optsFrom(f) {
    const P0 = PAPER[f.paper.value], mi = { n: 0, m: 1, w: 2 }[f.mar.value];
    return { P: P0, fs: +f.fs.value || P0.fs, lh: +f.lh.value, gap: 1, mg: P0.m[mi], refs: f.refs.value, ev: f.ev.value, part: +f.part.value || 0, notes: f.notes.checked, head: f.head.checked, newPart: f.np.checked };
  }
  function exportSheet(s, mk) {
    const tp = TP[s]; if (!tp) return;
    const h = `<form id="khexp" class="khexp"><div class="row"><label>الصيغة<select name="fmt"><option value="pdf">PDF (طباعة أو حفظ)</option><option value="docx">Word قابل للتحرير</option><option value="img">صور الصفحات (PNG)</option><option value="txt">نص سهل النسخ</option></select></label>
      <label>حجم الورق<select name="paper">${Object.entries(PAPER).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join("")}</select></label></div>
      <div class="row"><label>حجم الخط (نقطة)<input name="fs" type="number" min="9" max="28" step=".5" value="15"></label><label>تباعد الأسطر<select name="lh"><option value="1.55">متقارب</option><option value="1.75" selected>متوسط</option><option value="2">واسع</option></select></label><label>الهوامش<select name="mar"><option value="n">ضيقة</option><option value="m" selected>عادية</option><option value="w">واسعة</option></select></label></div>
      <div class="row"><label>المراجع<select name="refs"><option value="foot">حواشٍ سفلية</option><option value="inline">بجوار النص</option><option value="hide">إخفاء</option></select></label><label>عزو الأدلة<select name="ev"><option value="inline">ضمن المتن</option><option value="foot">في الحواشي</option></select></label>
      <label>الجزء<select name="part"><option value="0">الخطبة كاملة</option><option value="1">الخطبة الأولى</option><option value="2">الخطبة الثانية</option></select></label></div>
      <div class="row"><label class="inl"><input type="checkbox" name="head" checked> العنوان وترويسة الصفحات</label><label class="inl"><input type="checkbox" name="np" checked> الخطبة الثانية في صفحة جديدة</label><label class="inl"><input type="checkbox" name="notes"> تنبيهات الخطيب</label></div>
      <p class="mut khexph">يُعاد ضبط الخط والهوامش والمسافات لكل مقاس (لا تصغير آلي)؛ والمقاسات الصغيرة مهيأة لحملها على المنبر.</p>
      <div class="khprev" aria-label="معاينة"></div><button class="btn p">⬇️ تحميل</button> <span class="mut" id="khexst" role="status"></span></form>`;
    openSheet("تحميل الخطبة وطباعتها", h, () => {
      const f = $("#khexp"); const sync = () => { const P0 = PAPER[f.paper.value]; if (!f.fs.dataset.touched) f.fs.value = P0.fs; prev(); };
      let pt = 0; const prev = () => { clearTimeout(pt); pt = setTimeout(async () => { if (!["pdf", "img"].includes(f.fmt.value)) { f.querySelector(".khprev").innerHTML = ""; return; } const o = optsFrom(f), pg = await paginate(tp, mk, o);
        const sc = Math.min(1, 300 / (o.P.w * 3.78)); f.querySelector(".khprev").innerHTML = `<p class="mut">${A2(pg.length)} ${pg.length > 10 ? "صفحة" : "صفحات"} — معاينة الأولى:</p><div class="khpv" style="width:${o.P.w * 3.78 * sc}px;height:${o.P.h * 3.78 * sc}px"><div style="transform:scale(${sc});transform-origin:top right"><style>${PCSS(o)}</style>${pg[0] || ""}</div></div>`; }, 250); };
      f.fs.addEventListener("input", () => f.fs.dataset.touched = 1); f.paper.onchange = sync; f.addEventListener("change", e => { if (e.target !== f.paper) prev(); }); sync();
      f.onsubmit = async e => { e.preventDefault(); const st = $("#khexst"); st.textContent = "جارٍ الإعداد…"; try { await doExport(tp, mk, f.fmt.value, optsFrom(f), st); } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
    });
  }
  const fileBase = (tp, mk) => (tp.t + " - " + MN[mk]).replace(/[\\/:*?"<>|]/g, "");
  const dl = (name, blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); };
  async function doExport(tp, mk, fmt, o, st) {
    const base = fileBase(tp, mk) + (o.part ? " - " + (o.part === 1 ? "الأولى" : "الثانية") : "");
    if (fmt === "txt") { const t = plainText(tp, mk, o.part); try { await navigator.clipboard.writeText(t); } catch (e) { } dl(base + ".txt", new Blob([t], { type: "text/plain;charset=utf-8" })); st.textContent = "✓ نُسخ النص وحُفظ ملفًّا"; return; }
    if (fmt === "docx") { dl(base + ".docx", docx(tp, mk, o)); st.textContent = "✓ حُفظ ملف Word"; return; }
    const pages = await paginate(tp, mk, o);
    if (fmt === "pdf") {
      const fr = document.createElement("iframe"); fr.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px"; document.body.appendChild(fr);
      const dd = fr.contentDocument; dd.open(); dd.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${E(base)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Amiri+Quran&display=swap"><style>${PCSS(o)}</style></head><body>${pages.join("")}</body></html>`); dd.close();
      st.textContent = "جارٍ تحميل الخطوط…"; try { await new Promise(r => setTimeout(r, 300)); await fr.contentDocument.fonts.ready; } catch (e) { }
      fr.contentWindow.focus(); fr.contentWindow.print(); st.textContent = "✓ اختر «حفظ بصيغة PDF» أو الطابعة"; setTimeout(() => fr.remove(), 60e3); return;
    }
    // صور الصفحات
    st.textContent = "جارٍ تضمين الخطوط…"; const fc = await fontsEmbed(), files = [];
    const W = Math.round(o.P.w * 3.7795), H = Math.round(o.P.h * 3.7795), SC = 2.5;
    for (let i = 0; i < pages.length; i++) {
      st.textContent = `جارٍ رسم الصفحة ${A2(i + 1)} من ${A2(pages.length)}…`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SC}" height="${H * SC}"><foreignObject width="${W}" height="${H}" transform="scale(${SC})"><div xmlns="http://www.w3.org/1999/xhtml"><style>${fc}${PCSS(o)}</style>${pages[i].replace(/<br>/g, "<br/>")}</div></foreignObject></svg>`;
      const img = new Image(); img.decoding = "sync"; await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error("تعذّر رسم الصفحة")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
      const cv = document.createElement("canvas"); cv.width = W * SC; cv.height = H * SC; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, "image/png")); files.push([base + " - " + String(i + 1).padStart(2, "0") + ".png", new Uint8Array(await blob.arrayBuffer())]);
    }
    if (files.length === 1) dl(files[0][0], new Blob([files[0][1]], { type: "image/png" })); else dl(base + " (صور).zip", new Blob([EXT.zip(files)], { type: "application/zip" }));
    st.textContent = `✓ حُفظت ${A2(files.length)} صورة`;
  }
  /* Word: مستند حقيقي من اليمين، بأنماط، وحواشٍ سفلية حقيقية، وبمقاس الورق والهوامش المختارة */
  function docx(tp, mk, o) {
    const X = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const tw = mm => Math.round(mm * 56.693), hp = pt => Math.round(pt * 2), FN = [];
    const run = (t, rp) => t ? `<w:r><w:rPr><w:rtl/>${rp || ""}</w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>` : "";
    const fnRef = (txt) => { FN.push(txt); return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteReference w:id="${FN.length + 1}"/></w:r>`; };
    const inl = (x, base) => { // ** و{q:} و{h:} و[^r]
      let out = ""; const re = /(\*\*.+?\*\*|\{q:\d+:\d+(?:-\d+)?\}|\{[hav]:[\w-]+\}|\[\^[\w-]+\])/g; let last = 0, m;
      while ((m = re.exec(x))) { out += run(x.slice(last, m.index), base); const t = m[0];
        if (t.startsWith("**")) out += run(t.slice(2, -2), (base || "") + "<w:b/><w:bCs/>");
        else if (t.startsWith("{q:")) { const [, s, a, b] = t.match(/\{q:(\d+):(\d+)(?:-(\d+))?\}/); out += run("﴿" + (qtxt(tp, +s, +a, b ? +b : 0) || "") + "﴾ ", '<w:color w:val="0F5C4D"/><w:rFonts w:cs="Amiri Quran"/>') + run(qcite(+s, +a, b ? +b : 0), '<w:color w:val="0F5C4D"/><w:szCs w:val="' + hp(o.fs * .75) + '"/>'); }
        else if (t.startsWith("{")) { const e = tp.ev[t.slice(3, -1)]; if (e) out += run("«" + e.t + "»", base); }
        else { const r = tp.refs[t.slice(2, -1)]; if (r && o.refs === "foot") out += fnRef(refLabel(r)); else if (r && o.refs === "inline") out += run(" (" + refLabel(r) + ")", '<w:color w:val="666666"/><w:szCs w:val="' + hp(o.fs * .7) + '"/>'); }
        last = m.index + t.length; }
      return out + run(x.slice(last), base);
    };
    const para = (style, content, extra) => `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:bidi/>${extra || ""}</w:pPr>${content}</w:p>`;
    const B = parse(tp.models[mk].body); let body = para("KTitle", run(tp.models[mk].title || tp.t)) + para("KSub", run(tp.t + " — الخطبة " + MN[mk])); let pn = 0, skip = false;
    B.forEach(b => {
      if (b.k === "part") { pn++; skip = o.part && pn !== o.part; if (skip) return; body += para("Heading1", run(b.x), pn > 1 && o.newPart ? "<w:pageBreakBefore/>" : ""); return; }
      if (skip || (!pn && o.part > 1)) return; if (!pn) pn = 1;
      if (b.k === "h2") body += para("Heading2", inl(b.x)); else if (b.k === "h3") body += para("Heading3", inl(b.x));
      else if (b.k === "tr") body += para("KTr", run("⟵ ") + inl(b.x)); else if (b.k === "note") { if (o.notes) body += para("KNote", run("تنبيه للخطيب: ") + inl(b.x)); }
      else if (b.k === "dua") body += para("KDua", inl(b.x)); else if (b.k === "li") body += para("KList", run("• ") + inl(b.x));
      else if (b.k === "poem") body += para("KDua", inl(b.x.replace(/\s*\*\*\*\s*/, "     ")));
      else if (b.k === "ev") {
        if (b.t === "q") { const [, s, a, e] = b.id.match(/(\d+):(\d+)(?:-(\d+))?/); const cite = qcite(+s, +a, e ? +e : 0); body += para("KAyah", run("﴿" + (qtxt(tp, +s, +a, e ? +e : 0) || "") + "﴾ ") + (o.ev === "foot" ? fnRef(cite) : run(cite, '<w:szCs w:val="' + hp(o.fs * .75) + '"/>')) + inl(b.x)); }
        else { const e = tp.ev[b.id]; if (e) body += para(e.k === "h" ? "KHadith" : "KAthar", run("«" + e.t + "» ") + (o.ev === "foot" ? fnRef(evCite(e)) : run(e.k === "h" ? "(" + evCite(e) + ")" : "— " + evCite(e), '<w:szCs w:val="' + hp(o.fs * .75) + '"/>')) + inl(b.x)); }
      } else body += para("Normal", inl(b.x));
    });
    const sect = `<w:sectPr><w:pgSz w:w="${tw(o.P.w)}" w:h="${tw(o.P.h)}"/><w:pgMar w:top="${tw(o.mg + 2)}" w:right="${tw(o.mg)}" w:bottom="${tw(o.mg + 2)}" w:left="${tw(o.mg)}" w:header="${tw(o.mg / 2)}" w:footer="${tw(o.mg / 2)}" w:gutter="0"/><w:bidi/></w:sectPr>`;
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;
    const sty = (id, name, rp, pp, based) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>${based ? `<w:basedOn w:val="${based}"/>` : ""}<w:qFormat/><w:pPr><w:bidi/>${pp || ""}</w:pPr><w:rPr><w:rtl/>${rp || ""}</w:rPr></w:style>`;
    const F = `<w:rFonts w:ascii="Amiri" w:hAnsi="Amiri" w:cs="Amiri"/>`, sz = pt => `<w:sz w:val="${hp(pt)}"/><w:szCs w:val="${hp(pt)}"/>`, ln = Math.round(240 * o.lh * .85);
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>${F}${sz(o.fs)}<w:lang w:bidi="ar-EG"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="${Math.round(o.fs * 7)}" w:line="${ln}" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
      ${sty("Normal", "Normal")}${sty("KTitle", "Title", '<w:b/><w:bCs/><w:color w:val="0F5C4D"/>' + sz(o.fs * 1.6), '<w:jc w:val="center"/>', "Normal")}${sty("KSub", "Subtitle", '<w:color w:val="7A6A40"/>' + sz(o.fs * .85), '<w:jc w:val="center"/><w:spacing w:after="240"/>', "Normal")}
      ${sty("Heading1", "heading 1", '<w:b/><w:bCs/><w:color w:val="0F5C4D"/>' + sz(o.fs * 1.3), '<w:keepNext/><w:jc w:val="center"/><w:spacing w:before="240" w:after="160"/><w:outlineLvl w:val="0"/><w:pBdr><w:bottom w:val="double" w:sz="6" w:space="2" w:color="C9B27A"/></w:pBdr>', "Normal")}
      ${sty("Heading2", "heading 2", '<w:b/><w:bCs/><w:color w:val="0F5C4D"/>' + sz(o.fs * 1.12), '<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/>', "Normal")}${sty("Heading3", "heading 3", '<w:b/><w:bCs/><w:color w:val="0F5C4D"/>', '<w:keepNext/><w:outlineLvl w:val="2"/>', "Normal")}
      ${sty("KAyah", "آية", '<w:color w:val="0F5C4D"/><w:rFonts w:ascii="Amiri Quran" w:hAnsi="Amiri Quran" w:cs="Amiri Quran"/>', '<w:shd w:val="clear" w:fill="F3F8F5"/><w:ind w:start="200" w:end="200"/><w:pBdr><w:right w:val="single" w:sz="18" w:space="6" w:color="0F5C4D"/></w:pBdr>', "Normal")}
      ${sty("KHadith", "حديث", '<w:color w:val="5A3F12"/>', '<w:shd w:val="clear" w:fill="FBF6EA"/><w:ind w:start="200" w:end="200"/><w:pBdr><w:right w:val="single" w:sz="18" w:space="6" w:color="B88A2E"/></w:pBdr>', "Normal")}${sty("KAthar", "أثر ونقل", '<w:color w:val="5A3F12"/>', '<w:ind w:start="300" w:end="300"/>', "Normal")}
      ${sty("KTr", "انتقال", '<w:i/><w:iCs/><w:color w:val="7A5A12"/>', "", "Normal")}${sty("KNote", "تنبيه للخطيب", '<w:color w:val="777777"/>' + sz(o.fs * .8), "", "Normal")}${sty("KDua", "دعاء", '<w:color w:val="0F5C4D"/>', '<w:jc w:val="center"/>', "Normal")}${sty("KList", "تعداد", "", '<w:ind w:start="360"/>', "Normal")}
      ${sty("FootnoteText", "footnote text", sz(o.fs * .7), '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', "Normal")}<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/><w:color w:val="B88A2E"/></w:rPr></w:style></w:styles>`;
    const fns = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${NS}><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="1"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${FN.map((t, i) => `<w:footnote w:id="${i + 2}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:bidi/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${run(" " + t)}</w:p></w:footnote>`).join("")}</w:footnotes>`;
    const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}><w:footnotePr><w:footnote w:id="0"/><w:footnote w:id="1"/></w:footnotePr><w:defaultTabStop w:val="720"/></w:settings>`;
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const drels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`;
    return new Blob([EXT.zip([["[Content_Types].xml", ct], ["_rels/.rels", rels], ["word/document.xml", doc], ["word/styles.xml", styles], ["word/footnotes.xml", fns], ["word/settings.xml", settings], ["word/_rels/document.xml.rels", drels]])], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  /* ---------- الإدارة ---------- */
  async function save(tp, msg) {
    if (typeof GH === "undefined" || !GH.on) throw new Error("الحفظ يحتاج تسجيل الدخول بحساب الإدارة (الإدارة المباشرة)");
    tp.upd = today(); await ensureQ(tp); await quran(); tp.qt = {};
    Object.values(tp.models || {}).forEach(M => (M.body || "").replace(/\{q:(\d+):(\d+)(?:-(\d+))?\}/g, (m, s, a, b) => { const k = qkey(+s, +a, b ? +b : 0), L = (QUR[s - 1] || []).slice(a - 1, b ? +b : +a); if (L.length) tp.qt[k] = L.map((x, i) => x + " (" + A2(+a + i) + ")").join(" ").replace(/ \([٠-٩]+\)$/, ""); return m; }));
    await GH.put(P + "t/" + tp.s + ".json", JSON.stringify(tp, null, 1), msg);
    const it = idxItem(tp);
    await GH.editJSON(P + "index.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => x.s !== tp.s).concat([it]); o.v = Date.now(); return o; }, "خطب الجمعة: الفهرس", true);
    TP[tp.s] = tp; IDX = null; FRESH = true;
  }
  function idxItem(tp) {
    const ms = {}, ev = []; let n = 0;
    Object.entries(tp.models || {}).forEach(([k, M]) => { if ((M.body || "").trim()) { ms[k] = M.st || "draft"; n += M.words || (M.body.split(/\s+/).length); (M.body || "").replace(/\{q:(\d+):(\d+)/g, (m, s, a) => (ev.push("q:" + s + ":" + a), m)); } });
    Object.values(tp.ev || {}).forEach(e => ev.push(N(e.t).slice(0, 70)));
    return { s: tp.s, t: tp.t, sub: tp.sub || "", sum: tp.sum || "", cats: tp.cats || [], seas: tp.seas || [], kw: tp.kw || [], st: tp.st || "draft", ms, feat: !!tp.feat, sched: tp.sched || "", ev: [...new Set(ev)], upd: tp.upd || "", at: tp.at || "", n, qe: ((tp.qa || {}).errs || []).length };
  }
  function lightVerify(tp) {
    const errs = [], warns = [];
    Object.entries(tp.models || {}).forEach(([k, M]) => { const b = M.body || "", nm = "الخطبة " + MN[k]; if (!b.trim()) return;
      if ((b.match(/^==.*==$/gm) || []).length < 2) errs.push(nm + ": يلزم تقسيمها إلى خطبتين (== الخطبة الأولى == و== الخطبة الثانية ==)");
      b.replace(/\{q:(\d+):(\d+)(?:-(\d+))?\}/g, (m, s, a, e) => { const S = QUR && QUR[s - 1]; if (!S || +a < 1 || +a > S.length || (e && (+e < +a || +e > S.length))) errs.push(nm + ": مرجع آية غير صحيح " + m); return m; });
      b.replace(/\{([hav]):([\w-]+)\}/g, (m, t, id) => { if (!(tp.ev || {})[id]) errs.push(nm + ": دليل غير معرّف " + m); return m; });
      b.replace(/\[\^([\w-]+)\]/g, (m, id) => { if (!(tp.refs || {})[id]) errs.push(nm + ": مرجع غير معرّف " + m); return m; });
      (b.match(/﴿[^﴾]{6,}﴾/g) || []).forEach(x => warns.push(nm + ": نص قرآني مكتوب باليد " + x.slice(0, 24) + "… — استعمل {q:السورة:الآية}"));
      if (!/الحمد|نحمده/.test(b.split("\n").find(l => l.trim() && !/^==/.test(l.trim())) || "")) warns.push(nm + ": الافتتاح لا يبدأ بالحمد"); });
    return { errs, warns };
  }
  const AT = [["dash", "gauge", "اللوحة والمتابعة"], ["topics", "list", "الموضوعات"], ["new", "badge-plus", "موضوع جديد"], ["queue", "activity", "طابور الإعداد"], ["mats", "download", "المواد"], ["cats", "layout-grid", "التصنيفات"]];
  async function admin(q) {
    if (!adm()) return view('<p class="note">هذه الصفحة للإدارة.</p>');
    FRESH = true; CATS = null; IDX = null; WATCH = null; await cats(); const L = await idx(); const tab = q.tab || "dash";
    const nav = `<nav class="chips">${AT.map(([k, i, t]) => `<a class="chip${k === tab ? " x" : ""}" href="${k === "new" ? "#/khutab/edit/_new" : "#/khutab/admin?tab=" + k}">${IC(i, 15)} ${t}</a>`).join("")}</nav>`;
    const hdr = `<p><a href="#/khutab">← خطب الجمعة</a></p><h2>${IC("settings", 24)} إدارة قسم خطب الجمعة</h2>${nav}${typeof GH !== "undefined" && !GH.on ? '<p class="note">للحفظ: فعّل «الإدارة المباشرة» بتسجيل الدخول بحساب الإدارة.</p>' : ""}`;
    if (tab === "topics") return view(hdr + topicsTable(L));
    if (tab === "cats") return view(hdr + catsEditor());
    if (tab === "mats") return view(hdr + await matsView());
    if (tab === "queue") return view(hdr + await queueView(q));
    const W = (WATCH = (await getJ(P + "watch.json", true)) || {});
    const cnt = k => L.filter(x => x.st === k).length, full = L.filter(x => Object.keys(x.ms || {}).length === 3).length;
    const Q = (await getJ(P + "queue.json", true)) || { items: [] }, LG = ((await getJ(P + "log.json", true)) || { items: [] }).items.slice(-6).reverse();
    const sugL = (W.sug || []).slice(0, 30);
    view(hdr + `<div class="khstats">${[["الموضوعات", L.length], ["معتمدة", cnt("ok")], ["قيد المراجعة", cnt("review")], ["مسودات", cnt("draft")], ["مكتملة النماذج الثلاثة", full], ["ناقصة", L.length - full], ["في طابور الإعداد", Q.items.length], ["مميزة", L.filter(x => x.feat).length]].map(([t, n]) => `<div><b>${A2(n)}</b><span>${t}</span></div>`).join("")}</div>
      <section><h3>${IC("moon-star")} المواسم القادمة <small class="mut">(متابعة ${E(W.at || "—")})</small></h3>${(W.upcoming || []).length ? `<ul>${W.upcoming.map(u => `<li><b>${E(u.t)}</b> بعد ${A2(u.in)} يومًا (${E(u.from)}): ${A2(u.ready)} معتمدة${u.need ? ` — <span class="khbad">تحتاج ${A2(u.need)}</span>` : " ✓"}${(u.ideas || []).map(i => ` <a href="javascript:void 0" class="chip sm" data-kh="qadd" data-t="${E(i)}" data-seas="${E(u.id)}">+ ${E(i)}</a>`).join("")}</li>`).join("")}</ul>` : '<p class="mut">لا مواسم خلال الستين يومًا القادمة.</p>'}</section>
      ${(W.review || []).length ? `<section><h3>🔍 تحتاج إلى مراجعة أو تحسين</h3><ul>${W.review.map(r => `<li><a href="#/khutab/edit/${encodeURIComponent(r.s)}">${E(r.t)}</a> — <span class="mut">${E(r.why)}</span></li>`).join("")}</ul></section>` : ""}
      ${(W.enrich || []).length ? `<section><h3>➕ مواد جديدة لإثراء خطب قائمة</h3><ul>${W.enrich.map(r => `<li><a href="#/khutab/edit/${encodeURIComponent(r.s)}">${E(r.t)}</a>: ${r.src.map(x => `<a href="#/book/${E(x.b)}/1">${E(x.title)}</a>`).join("، ")}</li>`).join("")}</ul></section>` : ""}
      ${(W.dup || []).length ? `<section><h3>⚠️ موضوعات متقاربة (تجنب التكرار)</h3><ul>${W.dup.map(d => `<li>${d.map(s => `<a href="#/khutab/${encodeURIComponent(s)}">${E((L.find(x => x.s === s) || {}).t || s)}</a>`).join(" ↔ ")}</li>`).join("")}</ul></section>` : ""}
      ${(W.thin || []).length ? `<section><h3>🗂️ تصنيفات تحتاج إلى خطب</h3><div class="chips">${W.thin.map(c => `<a class="chip sm" href="javascript:void 0" data-kh="qadd" data-t="" data-cats="${E(c.id)}">${E(c.t)} (${A2(c.n)})</a>`).join("")}</div></section>` : ""}
      <section><h3>💡 موضوعات مقترحة للإعداد</h3><p class="mut">من «موعظة الأسبوع» بصوت السلف ومواد المكتبة الجديدة والمواسم، مما لم يُغطَّ بعد. «أعدّ مسودة» يضيفه إلى الطابور، فتُعدّ ثلاثة نماذج من مصادر المكتبة وتبقى مسودة حتى تعتمدها.</p>
       <ul class="khsug">${sugL.map(s => `<li><b>${E(s.t)}</b> <small class="mut">${E(s.why || "")}</small>${(s.src || []).map(b => ` <a class="mut" href="#/book/${E(b)}/1">[المصدر]</a>`).join("")} <a href="javascript:void 0" class="btn sm" data-kh="qadd" data-t="${E(s.t)}" data-src="${E((s.src || []).join(" "))}" data-seas="${E((s.seas || []).join(" "))}">أعدّ مسودة</a></li>`).join("")}</ul></section>
      <section><h3>آخر عمليات الإعداد</h3>${LG.length ? `<ul>${LG.map(x => `<li>${x.ok ? "✓" : "✗"} ${x.s ? `<a href="#/khutab/edit/${encodeURIComponent(x.s)}">${E(x.t || x.s)}</a>` : E(x.t || "")} — <span class="mut">${E(x.msg || "")} (${E(x.at)})</span></li>`).join("")}</ul>` : '<p class="mut">لا شيء بعد.</p>'}</section>`);
  }
  function topicsTable(L) {
    const ms = x => [1, 2, 3].map(m => { const s = (x.ms || {})[m]; return `<span class="khst khst-${s || "none"}" title="${MN[m]}: ${s ? STN[s] : "لم تُكتب"}">${MI[m]}</span>`; }).join("");
    const rv = L.filter(x => !x.qe && Object.values(x.ms || {}).includes("review")).length;
    return `<p class="mut">${A2(L.length)} موضوعًا. ★ تمييز الموضوع، والتاريخ جدولته لجمعة بعينها.</p>${appr() ? `<div class="khwarn">${IC("clipboard-check", 16)} ${A2(rv)} موضوعًا قيد المراجعة سلمت من أخطاء التحقق العلمي. راجع ما تشاء منها ثم حدده و<button class="btn sm" data-kh="bulkok">اعتمد المحدد</button> <label class="inl"><input type="checkbox" data-kh-all> تحديد كل ما سلم من الأخطاء</label> <span id="khbst" class="mut"></span></div>` : ""}<div class="khtbl"><table><thead><tr>${appr() ? "<th></th>" : ""}<th>الموضوع</th><th>النماذج</th><th>الحالة</th><th>التحقق</th><th>★</th><th>📌 الجمعة</th><th></th></tr></thead><tbody>
      ${L.slice().sort((a, b) => (b.upd || "").localeCompare(a.upd || "")).map(x => `<tr>${appr() ? `<td>${!x.qe && Object.values(x.ms || {}).includes("review") ? `<input type="checkbox" data-kh-ok="${E(x.s)}" aria-label="تحديد للاعتماد">` : ""}</td>` : ""}<td><a href="#/khutab/${encodeURIComponent(x.s)}">${E(x.t)}</a><br><small class="mut">${(x.cats || []).map(c => E(catT(c).t)).join("، ")}</small></td><td>${ms(x)}</td><td>${badge(x.st)}</td><td>${x.qe ? `<span class="khbad">${A2(x.qe)}</span>` : "✓"}</td>
       <td><button class="btn sm" data-kh="feat" data-s="${E(x.s)}" aria-pressed="${!!x.feat}">${x.feat ? "★" : "☆"}</button></td><td><input type="date" value="${E(x.sched || "")}" data-kh-sched="${E(x.s)}" aria-label="جدولة"></td><td><a class="btn sm" href="#/khutab/edit/${encodeURIComponent(x.s)}">تحرير</a> <button class="btn sm" data-kh="qadd" data-t="${E(x.t)}" data-s="${E(x.s)}">إعادة إعداد</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function catsEditor() {
    const row = (c, k) => `<tr data-k="${k}"><td><input name="id" value="${E(c.id)}" size="9" dir="ltr" aria-label="المعرف"></td><td><input name="ic" value="${E(c.ic || "")}" size="2" aria-label="الأيقونة"></td><td><input name="t" value="${E(c.t)}" aria-label="الاسم"></td>${k === "seasons" ? `<td><input name="h" value="${E(c.h ? JSON.stringify(c.h) : "")}" dir="ltr" size="14" placeholder="[9,1,9,30]" aria-label="المدى الهجري"></td><td><input name="g" value="${E(c.g ? JSON.stringify(c.g) : "")}" dir="ltr" size="10" aria-label="المدى الميلادي"></td><td><input name="need" type="number" value="${c.need || 0}" style="width:4em" aria-label="المطلوب"></td><td><input name="ideas" value="${E((c.ideas || []).join("، "))}" aria-label="موضوعات مقترحة"></td>` : ""}<td><button type="button" class="btn sm" data-kh="up">↑</button><button type="button" class="btn sm" data-kh="del">✕</button></td></tr>`;
    const tbl = (k, t, cols) => `<h3>${t}</h3><div class="khtbl"><table data-kc="${k}"><thead><tr><th>المعرف</th><th></th><th>الاسم</th>${cols}<th></th></tr></thead><tbody>${CATS[k].map(c => row(c, k)).join("")}</tbody></table></div><button type="button" class="btn sm" data-kh="addcat" data-k="${k}">+ إضافة</button>`;
    return `<form id="khcats"><p class="mut">التصنيفات قابلة للإضافة والتعديل والترتيب بلا تعديل برمجي. المدى الهجري [شهر، يوم، شهر، يوم] (أو قائمة مدايات) يُظهر الموسم في «المواسم القادمة» وتقويم الجمعات، ويُنبّه في المتابعة قبل حلوله.</p>
      ${tbl("topics", "التصنيف الموضوعي", "")}${tbl("seasons", "التصنيف الموسمي", "<th>المدى الهجري</th><th>المدى الميلادي</th><th>المطلوب</th><th>موضوعات مقترحة</th>")}
      <p><label class="inl"><input type="checkbox" name="pub_review"${CATS.pub_review ? " checked" : ""}> إظهار الخطب «قيد المراجعة» للزوار بعلامة واضحة (الافتراضي: لا يظهر إلا المعتمد)</label></p><button class="btn p">حفظ التصنيفات</button> <span id="khcst" class="mut"></span></form>
      <template id="khrow-topics">${row({ id: "", t: "" }, "topics")}</template><template id="khrow-seasons">${row({ id: "", t: "" }, "seasons")}</template>`;
  }
  async function matsView() {
    const M = (await getJ(P + "materials.json", true)) || { items: [] };
    return `<form id="khmat" class="card"><h3>📥 رفع مادة أو ربطها</h3><p class="mut">تُدخَل المادة في منظومة الاستفادة العلمية (الاسترجاع عند إعداد الخطب) فقط إذا اخترت ذلك؛ فلا يدخل ملف تلقائيًّا دون مراجعة.</p>
      <div class="row"><label>العنوان<input name="t" required></label><label>النوع<select name="k"><option value="text">نص خطبة مكتوب</option><option value="docx">ملف Word</option><option value="pdf">ملف PDF</option><option value="audio">تسجيل صوتي (يُفرَّغ)</option><option value="tr">تفريغ صوتي (نص)</option><option value="article">مقال أو بحث</option><option value="book">كتاب في الخطب والمواعظ</option><option value="lib">مادة موجودة في المكتبة</option></select></label></div>
      <div class="row"><label>المؤلف أو الخطيب<input name="a"></label><label>المصدر<input name="src" placeholder="موقع، دار نشر، مسجد…"></label></div>
      <div class="row"><label>التصنيف<select name="c" multiple size="4">${CATS.topics.concat(CATS.seasons).map(c => `<option value="${E(c.id)}">${E(c.t)}</option>`).join("")}</select></label><label>الموضوعات (كلمات مفصولة بفواصل)<input name="kw"></label></div>
      <label>الملف<input type="file" name="f" accept=".pdf,.docx,.txt,audio/*,.mp3,.m4a,.ogg,.wav"></label><label>أو النص<textarea name="x" rows="5"></textarea></label><label>أو معرّف مادة في المكتبة (كتاب أو مقال)<input name="lib" dir="ltr" placeholder="sv23753"></label>
      <label class="inl"><input type="checkbox" name="use" checked> أدخلها في منظومة الاستفادة العلمية</label><label>ملاحظات<input name="n"></label><button class="btn p">رفع وإضافة</button> <span id="khmst" class="mut" role="status"></span></form>
      <h3>المواد (${A2(M.items.length)})</h3><div class="khtbl"><table><thead><tr><th>المادة</th><th>النوع</th><th>التصنيف</th><th>الحالة</th><th>في المنظومة</th><th>أضيفت</th></tr></thead><tbody>${M.items.slice().reverse().map(m => `<tr><td>${m.lib ? `<a href="#/book/${E(m.lib)}/1">${E(m.t)}</a>` : E(m.t)}<br><small class="mut">${E([m.a, m.src].filter(Boolean).join(" • "))}</small></td><td>${E(m.k)}</td><td><small>${(m.c || []).map(c => E(catT(c).t)).join("، ")}</small></td>
        <td><small>${m.x === "ok" ? "✓ نُص (" + A2(m.np || 0) + " ص)" : m.x === "ocr" ? '<span class="khbad">مصور بلا نص: حوّله من «إدارة المواد»</span>' : m.tr ? "بانتظار التفريغ" : m.file ? "بانتظار الاستخراج" : "✓"}</small></td><td><input type="checkbox" data-kh-use="${E(m.id)}"${m.use ? " checked" : ""} aria-label="في المنظومة"></td><td><small>${E(m.at || "")}</small></td></tr>`).join("")}</tbody></table></div>`;
  }
  async function queueView(q) {
    const Q = (await getJ(P + "queue.json", true)) || { items: [] }, LG = ((await getJ(P + "log.json", true)) || { items: [] }).items.slice(-30).reverse();
    return `<form id="khq" class="card"><h3>➕ إضافة موضوع إلى طابور الإعداد</h3><p class="mut">يُبحث في مكتبة الدعوة السلفية أولًا (خطب «موعظة الأسبوع» ومقالات صوت السلف وفتاواه وكتب المشايخ)، ثم المواد المختارة وبقية المكتبة؛ وتُعدّ النماذج الثلاثة بالأدلة والمراجع، ثم تُتحقق آليًّا، وتبقى مسودة حتى تعتمدها.</p>
      <div class="row"><label>عنوان الموضوع<input name="t" required value="${E(q.t || "")}"></label><label>معرّف ثابت (اختياري)<input name="s" dir="ltr" value="${E(q.s || "")}"></label></div><label>كلمات مفتاحية (بفواصل)<input name="kw"></label>
      <div class="row"><label>التصنيف<select name="c" multiple size="4">${CATS.topics.map(c => `<option value="${E(c.id)}"${(q.cats || "").split(" ").includes(c.id) ? " selected" : ""}>${E(c.t)}</option>`).join("")}</select></label><label>الموسم<select name="se" multiple size="4">${CATS.seasons.map(c => `<option value="${E(c.id)}"${(q.seas || "").split(" ").includes(c.id) ? " selected" : ""}>${E(c.t)}</option>`).join("")}</select></label></div>
      <div class="row">${[1, 2, 3].map(m => `<label class="inl"><input type="checkbox" name="m${m}" checked> ${MI[m]} ${MN[m]}</label>`).join("")}</div>
      <label>الاقتصار على مصادر محددة (معرّفات مفصولة بمسافات؛ فارغ = البحث في المكتبة كلها)<input name="src" dir="ltr" value="${E(q.src || "")}"></label><label>توجيهات للإعداد<textarea name="n" rows="2" placeholder="مثل: التركيز على الواقع المعاصر، أو أدلة بعينها"></textarea></label><button class="btn p">أضف إلى الطابور</button> <span id="khqst" class="mut" role="status"></span></form>
      <h3>في الطابور (${A2(Q.items.length)})</h3>${Q.items.length ? `<ul>${Q.items.map(x => `<li>${E(x.t)} <small class="mut">${E(x.at || "")} • ${E((x.models || [1, 2, 3]).map(m => MN[m]).join("، "))}</small></li>`).join("")}</ul>` : '<p class="mut">فارغ.</p>'}
      <h3>السجل</h3>${LG.length ? `<ul>${LG.map(x => `<li>${x.ok ? "✓" : "✗"} ${E(x.t || x.s)} — <span class="mut">${E(x.msg || "")} (${E(x.at)})</span></li>`).join("")}</ul>` : '<p class="mut">لا شيء بعد.</p>'}`;
  }
  /* المحرر */
  async function edit(s, q) {
    if (!adm()) return view('<p class="note">هذه الصفحة للإدارة.</p>');
    FRESH = true; await cats(); await quran();
    let tp = s === "_new" ? { s: "", t: "", sub: "", sum: "", cats: [], seas: [], kw: [], st: "draft", models: {}, ev: {}, refs: {}, qn: {}, log: [], at: today() } : (TP[s] = await getJ(P + "t/" + encodeURIComponent(s) + ".json", true));
    if (!tp) return view('<p class="note">غير موجود.</p>');
    window.__khEdit = tp; const mk = String(q.m || "1"); const M = tp.models[mk] || (tp.models[mk] = { title: "", body: "", st: "draft" });
    const tb = [["== الخطبة الأولى ==", "الأولى"], ["== الخطبة الثانية ==", "الثانية"], ["## ", "محور"], ["### ", "فرعي"], [">> ", "انتقال"], ["!! ", "تنبيه للخطيب"], ["{q:1:1}", "آية"], ["{h:}", "حديث"], ["**نص**", "تمييز"], ["[^r1]", "مرجع"], ["- ", "تعداد"], ["~ ", "دعاء"], ["% صدر *** عجز", "شعر"]];
    const qa = lightVerify(tp), wqa = tp.qa || {};
    const evRows = Object.entries(tp.ev || {}).map(([k, e]) => `<tr><td dir="ltr">${E(k)}</td><td>${E(e.k)}</td><td>${E((e.t || "").slice(0, 70))}…</td><td>${E(evCite(e))}</td><td>${e.ok ? "✓" : e.ok === false ? '<span class="khbad">✗</span>' : "—"}</td></tr>`).join("");
    view(`<p><a href="#/khutab/admin?tab=topics">← الموضوعات</a>${tp.s ? ` • <a href="#/khutab/${encodeURIComponent(tp.s)}?m=${mk}">عرض</a>` : ""}</p><h2>✏️ ${tp.s ? "تحرير: " + E(tp.t) : "موضوع جديد"}</h2>
      <form id="khed" class="khed" data-m="${mk}"><fieldset><legend>بيانات الموضوع</legend><div class="row"><label>العنوان<input name="t" value="${E(tp.t)}" required></label><label>المعرّف (لاتيني)<input name="s" value="${E(tp.s)}" dir="ltr" ${tp.s ? "readonly" : 'required pattern="[a-z0-9-]+"'}></label></div>
        <label>العنوان الفرعي<input name="sub" value="${E(tp.sub || "")}"></label><label>الملخص<textarea name="sum" rows="2">${E(tp.sum || "")}</textarea></label><label>كلمات مفتاحية (بفواصل)<input name="kw" value="${E((tp.kw || []).join("، "))}"></label>
        <div class="row"><label>التصنيف<select name="cats" multiple size="5">${CATS.topics.map(c => `<option value="${E(c.id)}"${(tp.cats || []).includes(c.id) ? " selected" : ""}>${E(c.t)}</option>`).join("")}</select></label><label>الموسم<select name="seas" multiple size="5">${CATS.seasons.map(c => `<option value="${E(c.id)}"${(tp.seas || []).includes(c.id) ? " selected" : ""}>${E(c.t)}</option>`).join("")}</select></label>
        <label>جدولة لجمعة<input type="date" name="sched" value="${E(tp.sched || "")}"></label><label class="inl"><input type="checkbox" name="feat"${tp.feat ? " checked" : ""}> مميزة</label></div></fieldset>
       <nav class="chips">${[1, 2, 3].map(m => `<a class="chip${String(m) === mk ? " x" : ""}" href="#/khutab/edit/${encodeURIComponent(tp.s || "_new")}?m=${m}">${MI[m]} ${MN[m]} ${tp.models[m] && tp.models[m].body ? "(" + E(STN[tp.models[m].st] || "") + ")" : "(فارغ)"}</a>`).join("")}</nav>
       <fieldset><legend>${MI[mk]} الخطبة ${MN[mk]}</legend><div class="row"><label>عنوان الخطبة<input name="mt" value="${E(M.title || "")}"></label><label>الحالة<select name="mst">${Object.entries(STN).map(([k, v]) => `<option value="${k}"${k === (M.st || "draft") ? " selected" : ""}${k === "ok" && !appr() ? " disabled" : ""}>${v}</option>`).join("")}</select></label></div>
        ${tp.alt && tp.alt[mk] ? `<div class="khwarn">مسودة جديدة مقترحة لهذا النموذج المعتمد (${E(tp.alt[mk].at || "")}). <button type="button" class="btn sm" data-kh="altuse" data-m="${mk}">اعتمدها بدل الحالية (تعود إلى المراجعة)</button> <button type="button" class="btn sm" data-kh="altdrop" data-m="${mk}">تجاهلها</button><details><summary>عرضها</summary><pre class="khpre">${E(tp.alt[mk].body)}</pre></details></div>` : ""}
        <div class="khtb">${tb.map(([x, t]) => `<button type="button" class="btn sm" data-kh="ins" data-x="${E(x)}">${t}</button>`).join("")}</div>
        <div class="khsplit"><textarea name="body" rows="26" dir="rtl" spellcheck="false" aria-label="نص الخطبة">${E(M.body || "")}</textarea><div class="khlive khtext" data-s="${E(tp.s)}"></div></div>
        <details><summary>دليل الصيغة</summary><p class="mut">سطر لكل فقرة. <code>{q:49:12}</code> أو <code>{q:14:24-26}</code> يدرج الآية من المصحف (لا تكتب نصها). <code>{h:معرف}</code> يدرج حديثًا أو أثرًا أو نقلًا من «الأدلة». <code>[^r1]</code> علامة مرجع. <code>**…**</code> تمييز. والأسطر: <code>## محور</code>، <code>&gt;&gt; انتقال</code>، <code>!! تنبيه للخطيب</code>، <code>- تعداد</code>، <code>~ دعاء</code>، <code>% صدر *** عجز</code>.</p></details></fieldset>
       <fieldset><legend>الأدلة (${A2(Object.keys(tp.ev || {}).length)}) والمراجع (${A2(Object.keys(tp.refs || {}).length)})</legend>
        <div class="khtbl"><table><thead><tr><th>المعرف</th><th>النوع</th><th>النص</th><th>العزو</th><th>موثق</th></tr></thead><tbody>${evRows}</tbody></table></div>
        <div class="row"><label>إضافة حديث من قسم الحديث (المعرّف، مثل riyad-1284)<input name="hid" dir="ltr"></label><button type="button" class="btn sm" data-kh="addh">أضف</button></div>
        <details><summary>إضافة أثر أو نقل من مصدر في المكتبة</summary><div class="row"><label>المعرف<input name="nid" dir="ltr" placeholder="n1"></label><label>القائل<input name="nwho"></label><label>العزو<input name="nsrc"></label></div><label>النص المنقول بحروفه<textarea name="nt" rows="2"></textarea></label><div class="row"><label>المصدر (معرّف الكتاب أو المقال)<input name="nb" dir="ltr"></label><label>الصفحة<input name="np" type="number"></label></div><button type="button" class="btn sm" data-kh="addn">أضف</button></details>
        <details><summary>إضافة مرجع</summary><div class="row"><label>المعرف<input name="rid" dir="ltr" placeholder="r7"></label><label>المصدر (معرّف)<input name="rb" dir="ltr"></label><label>الصفحة<input name="rp" type="number"></label></div><label>عنوان العزو<input name="rt"></label><label>النص المستفاد (اختياري، يُطابَق في الصفحة)<textarea name="rq" rows="2"></textarea></label><button type="button" class="btn sm" data-kh="addr">أضف</button></details>
        <details><summary>تحرير متقدم (JSON للأدلة والمراجع والشروح)</summary><p class="mut">لكل دليل: dl وجه الاستدلال، f الفوائد، w معاني الكلمات [[الكلمة، المعنى، {b، p}]]، sh شرح موجز وshs مصدره؛ ولشروح الآيات qn بمفتاح «السورة:الآية».</p><textarea name="json" rows="12" dir="ltr" spellcheck="false">${E(JSON.stringify({ ev: tp.ev, refs: tp.refs, qn: tp.qn || {} }, null, 1))}</textarea></details></fieldset>
       <fieldset><legend>التحقق</legend><div class="khqa">${qa.errs.map(x => `<p class="khbad">✗ ${E(x)}</p>`).join("")}${qa.warns.map(x => `<p class="mut">· ${E(x)}</p>`).join("")}${!qa.errs.length && !qa.warns.length ? '<p class="khgood">✓ لا ملاحظات في الفحص السريع</p>' : ""}
        ${wqa.at ? `<p class="mut">التحقق العلمي الكامل (المطابقة بالمصادر) — ${E(wqa.at)}: ${A2((wqa.errs || []).length)} خطأ، ${A2((wqa.warns || []).length)} تنبيه</p>${(wqa.errs || []).map(x => `<p class="khbad">✗ ${E(x)}</p>`).join("")}${(wqa.warns || []).slice(0, 12).map(x => `<p class="mut">· ${E(x)}</p>`).join("")}` : '<p class="mut">يُجرى التحقق الكامل آليًّا بعد كل حفظ (khutab.yml).</p>'}</div></fieldset>
       <fieldset><legend>المراجعة والاعتماد</legend><label>ملاحظة المراجعة<input name="note" placeholder="سبب الرفض أو ما عُدّل"></label>
        <div class="row"><button class="btn p" name="act" value="save">💾 حفظ</button><button class="btn" name="act" value="review">📤 إرسال للمراجعة</button>${appr() ? `<button class="btn" name="act" value="ok">✅ اعتماد هذا النموذج</button><button class="btn" name="act" value="rej">⛔ رفض</button>` : ""}<button type="button" class="btn" data-kh="regen" data-m="${mk}">🔄 إعادة توليد مسودة من مصادر محددة</button></div>
        <label>مصادر إعادة التوليد (معرّفات بمسافات؛ افتراضيًّا مصادر الموضوع)<input name="rsrc" dir="ltr" value="${E((tp.src || []).join(" "))}"></label><span id="khest" class="mut" role="status"></span></fieldset></form>
      ${(tp.log || []).length ? `<details><summary>سجل الموضوع</summary><ul>${tp.log.slice().reverse().map(l => `<li>${E(l.at)} — ${E(l.by || "")}: ${E(l.a)}</li>`).join("")}</ul></details>` : ""}`);
    const f = $("#khed"), live = f.querySelector(".khlive"); let t = 0;
    const upd = () => { clearTimeout(t); t = setTimeout(() => { try { const j = JSON.parse(f.json.value); Object.assign(tp, j); } catch (e) { } M.body = f.body.value; const C = { tp, refs: new Map(), fn: [], mode: "screen", refMode: "mark", notes: true };
      live.innerHTML = render(tp, mk, C).map(p => `<section class="khpart"><h3 class="khpt">${E(p.title)}</h3>${joinItems(p.items)}</section>`).join(""); }, 300); };
    f.body.addEventListener("input", upd); f.json.addEventListener("change", upd); upd();
  }
  function collect(f, tp, mk) {
    tp.t = f.t.value.trim(); if (!tp.s) tp.s = f.s.value.trim(); tp.sub = f.sub.value.trim(); tp.sum = f.sum.value.trim(); tp.kw = f.kw.value.split(/[،,]/).map(x => x.trim()).filter(Boolean);
    tp.cats = [...f.cats.selectedOptions].map(o => o.value); tp.seas = [...f.seas.selectedOptions].map(o => o.value); tp.sched = f.sched.value; tp.feat = f.feat.checked;
    try { const j = JSON.parse(f.json.value); tp.ev = j.ev || tp.ev; tp.refs = j.refs || tp.refs; tp.qn = j.qn || tp.qn; } catch (e) { throw new Error("صيغة JSON في «التحرير المتقدم» غير صحيحة"); }
    const M = tp.models[mk] || (tp.models[mk] = {}); M.title = f.mt.value.trim(); M.body = f.body.value.replace(/\r/g, ""); M.st = f.mst.value; M.at = M.at || today(); M.words = (M.body.match(/\S+/g) || []).length;
  }
  const who = () => (typeof Auth !== "undefined" && Auth.user && (Auth.user.name || Auth.user.email)) || "الإدارة";
  async function edSubmit(f, act) {
    const tp = window.__khEdit, mk = f.dataset.m || "1", st = $("#khest");
    try { collect(f, tp, mk); } catch (x) { return st.textContent = x.message; }
    if (!/^[a-z0-9-]+$/.test(tp.s)) return st.textContent = "المعرّف بحروف لاتينية صغيرة وأرقام وشرطات";
    const M = tp.models[mk], qa = lightVerify(tp), note = f.note.value.trim();
    if (act === "ok") { if (qa.errs.length || ((tp.qa || {}).errs || []).length) return st.textContent = "لا يُعتمد وفيه أخطاء تحقق؛ أصلحها ثم احفظ لينتهي التحقق الكامل"; M.st = "ok"; M.rev = who(); M.rat = today(); }
    if (act === "review") M.st = "review"; if (act === "rej") { M.st = "rej"; M.rn = note; }
    const sts = Object.values(tp.models).filter(x => (x.body || "").trim()).map(x => x.st);
    tp.st = sts.includes("ok") ? "ok" : sts.includes("review") ? "review" : sts.every(x => x === "rej") && sts.length ? "rej" : "draft";
    (tp.log = tp.log || []).push({ at: today(), by: who(), a: { save: "حفظ", review: "إرسال للمراجعة", ok: "اعتماد", rej: "رفض" }[act] + " — " + MN[mk] + (note ? ": " + note : "") });
    st.textContent = "جارٍ الحفظ…";
    try { await save(tp, "خطب الجمعة: " + ({ save: "تحرير", review: "للمراجعة", ok: "اعتماد", rej: "رفض" }[act]) + " «" + tp.t + "» (" + MN[mk] + ")"); st.textContent = "✓ حُفظ؛ يُجرى التحقق الكامل خلال دقائق"; if (/_new/.test(location.pathname + location.hash)) location.hash = "#/khutab/edit/" + tp.s + "?m=" + mk; }
    catch (x) { st.textContent = "تعذّر: " + (x.message || x); }
  }
  async function enqueue(it, st) {
    if (typeof GH === "undefined" || !GH.on) { const m = "الإضافة إلى الطابور تحتاج الإدارة المباشرة"; if (st) st.textContent = m; else toast(m); return; }
    it.id = "q" + Date.now().toString(36); it.at = today(); it.by = who();
    await GH.editJSON(P + "queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).concat([it]); return o; }, "خطب الجمعة: إعداد «" + it.t + "»");
    const m = "✓ أضيف إلى طابور الإعداد؛ تظهر المسودة في «الموضوعات» خلال دقائق"; if (st) st.textContent = m; else toast(m);
  }
  async function readDocx(file) { // نص ملف Word بفك الضغط في المتصفح
    const u8 = new Uint8Array(await file.arrayBuffer()), dv = new DataView(u8.buffer); let e = u8.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    let off = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
    for (let i = 0; i < n; i++) { const nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true), name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl));
      if (name === "word/document.xml") { const m = dv.getUint16(lo + 8, true), cs = dv.getUint32(lo + 18, true), ln = dv.getUint16(lo + 26, true), le = dv.getUint16(lo + 28, true), data = u8.subarray(lo + 30 + ln + le, lo + 30 + ln + le + cs);
        const raw = m === 0 ? data : new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
        const xml = new TextDecoder().decode(raw); return xml.split(/<\/w:p>/).map(p => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, "")).join("")).map(s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')).join("\n"); }
      off += 46 + nl + xl + cl; }
    throw new Error("ليس ملف Word صالحًا");
  }
  const pagesOf = t => { const out = []; let cur = ""; t.split(/\n/).forEach(l => { if ((cur + l).length > 2200 && cur) { out.push(cur.trim()); cur = ""; } cur += l + "\n"; }); if (cur.trim()) out.push(cur.trim()); return out; };
  async function matSubmit(f) {
    const st = $("#khmst"); if (typeof GH === "undefined" || !GH.on) return st.textContent = "الرفع يحتاج الإدارة المباشرة";
    const id = "km-" + Date.now().toString(36), file = f.f.files[0], k = f.k.value;
    const m = { id, t: f.t.value.trim(), k, a: f.a.value.trim(), src: f.src.value.trim(), c: [...f.c.selectedOptions].map(o => o.value), kw: f.kw.value.split(/[،,]/).map(x => x.trim()).filter(Boolean), n: f.n.value.trim(), use: f.use.checked, at: today(), by: who() };
    const btn = f.querySelector("button.p"); btn.disabled = true;
    try {
      if (f.lib.value.trim()) { m.lib = f.lib.value.trim(); }
      else if (file && /\.docx$/i.test(file.name)) { st.textContent = "جارٍ استخراج نص Word…"; const t = await readDocx(file); await GH.put(P + "mat/" + id + ".json", JSON.stringify({ id, t: m.t, pages: pagesOf(t) }), "خطب الجمعة: مادة «" + m.t + "»"); m.x = "ok"; m.np = pagesOf(t).length; }
      else if (file && /\.pdf$/i.test(file.name)) { if (file.size > 40 * 1048576) throw new Error("أكبر من ٤٠ م.ب؛ ارفعه من «إدارة المواد» كتابًا"); st.textContent = "جارٍ رفع PDF…"; m.file = P + "in/" + id + ".pdf"; await GH.put(m.file, new Uint8Array(await file.arrayBuffer()), "خطب الجمعة: ملف «" + m.t + "»", null); }
      else if (file && /\.txt$/i.test(file.name)) { const t = await file.text(); await GH.put(P + "mat/" + id + ".json", JSON.stringify({ id, t: m.t, pages: pagesOf(t) }), "خطب الجمعة: مادة «" + m.t + "»"); m.x = "ok"; }
      else if (file && (/^audio\//.test(file.type) || /\.(mp3|m4a|ogg|wav|opus|aac)$/i.test(file.name))) { if (typeof trUpload !== "function") throw new Error("رفع الصوت غير متاح"); const src = await trUpload(file, "kh" + Date.now().toString(36), t => st.textContent = t); const tid = "tr" + Date.now().toString(36);
        await GH.editJSON("data/transcribe/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).concat([{ id: tid, t: m.t, a: "", src: [src], at: today(), ctx: "مادة لقسم خطب الجمعة" + (m.a ? " — " + m.a : "") }]); return o; }, "تفريغ (خطب الجمعة): «" + m.t + "»"); m.tr = tid; }
      else if (f.x.value.trim()) { const t = f.x.value; await GH.put(P + "mat/" + id + ".json", JSON.stringify({ id, t: m.t, pages: pagesOf(t) }), "خطب الجمعة: مادة «" + m.t + "»"); m.x = "ok"; m.np = pagesOf(t).length; }
      else throw new Error("اختر ملفًّا أو اكتب النص أو معرّف مادة من المكتبة");
      await GH.editJSON(P + "materials.json", o => { o = o || { items: [] }; o.items = (o.items || []).concat([m]); return o; }, "خطب الجمعة: المواد");
      st.textContent = "✓ أضيفت" + (m.tr ? "؛ وأُرسل التسجيل إلى طابور التفريغ، ثم اربط الكتاب الناتج بها" : m.file ? "؛ يُستخرج نصها خلال دقائق" : ""); f.reset(); setTimeout(() => admin({ tab: "mats" }), 1200);
    } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } finally { btn.disabled = false; }
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener("submit", e => {
    const f = e.target; if (!f.id && f.dataset.form !== "khs") return;
    if (f.dataset.form === "khs") { e.preventDefault(); e.stopImmediatePropagation(); const p = new URLSearchParams(); ["q", "c", "s", "m", "st"].forEach(k => f[k] && f[k].value && p.set(k, f[k].value.trim())); if (!f.x.checked) p.set("x", "0"); location.hash = "#/khutab" + (p.toString() ? "?" + p : ""); return; }
    if (f.id === "khed") { e.preventDefault(); e.stopImmediatePropagation(); edSubmit(f, (e.submitter && e.submitter.value) || "save"); }
    else if (f.id === "khmat") { e.preventDefault(); e.stopImmediatePropagation(); matSubmit(f); }
    else if (f.id === "khq") { e.preventDefault(); e.stopImmediatePropagation(); enqueue({ t: f.t.value.trim(), s: f.s.value.trim() || undefined, kw: f.kw.value.split(/[،,]/).map(x => x.trim()).filter(Boolean), cats: [...f.c.selectedOptions].map(o => o.value), seas: [...f.se.selectedOptions].map(o => o.value), models: [1, 2, 3].filter(m => f["m" + m].checked).map(String), srcs: f.src.value.split(/\s+/).filter(Boolean), note: f.n.value.trim() }, $("#khqst")); }
    else if (f.id === "khcats") { e.preventDefault(); e.stopImmediatePropagation(); const st = $("#khcst");
      try { const rd = k => [...f.querySelectorAll(`table[data-kc=${k}] tbody tr`)].map(tr => { const g = n => (tr.querySelector(`[name=${n}]`) || {}).value; const o = { id: g("id").trim(), t: g("t").trim(), ic: g("ic").trim() }; if (k === "seasons") { if (g("h")) o.h = JSON.parse(g("h")); if (g("g")) o.g = JSON.parse(g("g")); o.need = +g("need") || 0; o.ideas = g("ideas").split(/[،,]/).map(x => x.trim()).filter(Boolean); const old = CATS.seasons.find(x => x.id === o.id); if (old && old.lead) o.lead = old.lead; } return o; }).filter(o => o.id && o.t);
        const C2 = Object.assign({}, CATS, { topics: rd("topics"), seasons: rd("seasons"), pub_review: f.pub_review.checked });
        if (!GH.on) throw new Error("الحفظ يحتاج الإدارة المباشرة"); st.textContent = "جارٍ الحفظ…"; GH.put(P + "cats.json", JSON.stringify(C2, null, 1), "خطب الجمعة: التصنيفات").then(() => { CATS = C2; st.textContent = "✓ حُفظت"; }).catch(x => st.textContent = "تعذّر: " + x.message);
      } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } }
  }, true);
  document.addEventListener("change", async e => {
    const t = e.target;
    if (t.dataset && t.dataset.khSched !== undefined) { try { const s = t.dataset.khSched, tp = await getJ(P + "t/" + s + ".json", true); tp.sched = t.value; await save(tp, "خطب الجمعة: جدولة «" + tp.t + "»"); toast("✓ جُدولت"); } catch (x) { toast(x.message); } }
    if (t.dataset && t.dataset.khAll !== undefined) document.querySelectorAll("[data-kh-ok]").forEach(x => x.checked = t.checked);
    if (t.dataset && t.dataset.khUse) { try { await GH.editJSON(P + "materials.json", o => { const m = o.items.find(x => x.id === t.dataset.khUse); if (m) m.use = t.checked; return o; }, "خطب الجمعة: المواد في المنظومة"); toast("✓"); } catch (x) { toast(x.message); } }
  });
  document.addEventListener("click", async e => {
    const pop = e.target.closest(".khpop .x"); if (pop) return pop.parentElement.remove();
    const rf = e.target.closest("sup.khref"); if (rf) { e.preventDefault(); return refPop(rf); }
    if (!e.target.closest(".khpop")) document.querySelectorAll(".khpop").forEach(x => x.remove());
    const wq = e.target.closest(".khtext .khhd p, .khtext .khay p, .khtext .khat p, .khdtext .khhd p");
    if (wq && !e.target.closest("a,cite,sup") && !document.querySelector(".khdlv")) { const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null; if (r && r.startContainer.nodeType === 3) { const s = r.startContainer.textContent, i = r.startOffset; const a = s.slice(0, i).search(/[^\s«»،.:؛]+$/), b = s.slice(i).search(/[\s«»،.:؛]/); const w = s.slice(a < 0 ? i : a, b < 0 ? s.length : i + b); if (w && w.length > 1) glossPop(w, e.clientX, e.clientY); } }
    const kd = e.target.closest("[data-kd]");
    if (kd) { const d = kd.closest(".khdlv"), box = d.querySelector(".khdtext"), a = kd.dataset.kd, pf = Object.assign({ dfs: 1.9, dlh: 1.95, dth: "dark", dn: 1 }, ls.g("dprefs", {}));
      if (a === "exit") { exitDeliver(); location.hash = "#/khutab/" + encodeURIComponent(d.dataset.s) + "?m=" + d.dataset.m; return; }
      if (a === "part") { const el = d.querySelector("#kd" + kd.dataset.n); box.scrollTo({ top: el.offsetTop - 50, behavior: "smooth" }); return; }
      if (a === "fs") pf.dfs = Math.max(1.1, Math.min(4, pf.dfs + .15 * kd.dataset.d)); if (a === "lh") pf.dlh = pf.dlh >= 2.4 ? 1.6 : +(pf.dlh + .2).toFixed(2);
      if (a === "th") pf.dth = { dark: "sepia", sepia: "light", light: "dark" }[pf.dth] || "dark"; if (a === "nt") { pf.dn = pf.dn ? 0 : 1; d.querySelectorAll(".khnote").forEach(n => n.hidden = !pf.dn); kd.setAttribute("aria-pressed", !!pf.dn); }
      if (a === "auto") { AS = (AS + 1) % 4; kd.textContent = ["▶︎", "▶︎¹", "▶︎²", "▶︎³"][AS]; clearInterval(AST); if (AS) AST = setInterval(() => { box.scrollTop += AS * .6; }, 30); }
      ls.s("dprefs", pf); d.style.setProperty("--dfs", pf.dfs + "rem"); d.style.setProperty("--dlh", pf.dlh); d.className = "khdlv th-" + pf.dth; return; }
    const el = e.target.closest("[data-kh]"); if (!el) return; const a = el.dataset.kh; if (!["ins"].includes(a)) e.preventDefault();
    const pf = PREF(), rer = () => { ls.s("prefs", pf); const art = $("#app .khtext"); if (art && !["refs", "notes"].includes(a)) { art.style.setProperty("--khfs", pf.fs + "rem"); art.style.setProperty("--khlh", pf.lh); art.style.setProperty("--khgap", pf.gap + "em"); art.classList.toggle("khdark", pf.theme === "dark"); } else if (typeof window.route === "function") window.route(); };
    if (a === "fs") { pf.fs = Math.max(.9, Math.min(2.6, +(pf.fs + .1 * el.dataset.d).toFixed(2))); rer(); }
    else if (a === "lh") { pf.lh = pf.lh >= 2.6 ? 1.7 : +(pf.lh + .2).toFixed(1); rer(); } else if (a === "gap") { pf.gap = pf.gap >= 2 ? .5 : +(pf.gap + .5).toFixed(1); rer(); }
    else if (a === "theme") { pf.theme = pf.theme === "dark" ? "" : "dark"; rer(); } else if (a === "refs") { pf.refs = pf.refs ? 0 : 1; rer(); } else if (a === "notes") { pf.notes = pf.notes ? 0 : 1; rer(); }
    else if (a === "part") { const t = $("#kp" + el.dataset.n); if (t) t.scrollIntoView({ behavior: "smooth" }); }
    else if (a === "resume") { const art = $("#app .khtext"); scrollTo({ top: art.offsetTop + +el.dataset.y * (art.offsetHeight - innerHeight), behavior: "smooth" }); }
    else if (a === "deliver") location.hash = "#/khutab/" + encodeURIComponent(el.dataset.s) + "/deliver?m=" + el.dataset.m;
    else if (a === "export") exportSheet(el.dataset.s, el.dataset.m);
    else if (a === "copy") { const t = plainText(TP[el.dataset.s], el.dataset.m); try { await navigator.clipboard.writeText(t); toast("✓ نُسخ نص الخطبة مع مراجعها"); } catch (x) { toast("تعذّر النسخ"); } }
    else if (a === "fav") { const F = ls.g("fav", []), s = el.dataset.s, i = F.indexOf(s); if (i >= 0) F.splice(i, 1); else F.unshift(s); ls.s("fav", F); el.innerHTML = IC("heart", 16) + (i >= 0 ? " المفضلة" : " في المفضلة"); el.setAttribute("aria-pressed", i < 0); toast(i >= 0 ? "أزيلت من المفضلة" : "♥ أضيفت إلى المفضلة"); }
    else if (a === "share") { const d = { title: el.dataset.t + " — خطب الجمعة", url: location.href }; if (navigator.share) navigator.share(d).catch(() => { }); else { try { await navigator.clipboard.writeText(d.url); toast("نُسخ الرابط"); } catch (x) { } } }
    else if (a === "qadd") { if (!el.dataset.t) { location.hash = "#/khutab/admin?tab=queue&cats=" + (el.dataset.cats || ""); return; } if (confirm("إضافة «" + el.dataset.t + "» إلى طابور الإعداد؟ تُعدّ مسودة بالنماذج الثلاثة من مصادر المكتبة.")) enqueue({ t: el.dataset.t, s: el.dataset.s || undefined, kw: [], seas: (el.dataset.seas || "").split(" ").filter(Boolean), cats: (el.dataset.cats || "").split(" ").filter(Boolean), srcs: [], hint: (el.dataset.src || "").split(" ").filter(Boolean), models: ["1", "2", "3"] }); }
    else if (a === "bulkok") { const L2 = [...document.querySelectorAll("[data-kh-ok]:checked")].map(x => x.dataset.khOk), st = $("#khbst"); if (!L2.length) return st.textContent = "حدد موضوعات أولًا";
      if (!confirm("اعتماد النماذج «قيد المراجعة» في " + L2.length + " موضوعًا ونشرها للعامة؟")) return; let n = 0;
      for (const s of L2) { try { st.textContent = `جارٍ الاعتماد ${A2(++n)} من ${A2(L2.length)}…`; const tp = await getJ(P + "t/" + s + ".json", true); if (((tp.qa || {}).errs || []).length) continue;
        Object.values(tp.models).forEach(M => { if (M.st === "review") { M.st = "ok"; M.rev = who(); M.rat = today(); } }); tp.st = "ok"; (tp.log = tp.log || []).push({ at: today(), by: who(), a: "اعتماد جماعي بعد المراجعة" }); await save(tp, "خطب الجمعة: اعتماد «" + tp.t + "»"); } catch (x) { st.textContent = "تعذّر: " + x.message; return; } }
      st.textContent = "✓ اعتُمدت"; admin({ tab: "topics" }); }
    else if (a === "feat") { try { const tp = await getJ(P + "t/" + el.dataset.s + ".json", true); tp.feat = !tp.feat; await save(tp, "خطب الجمعة: تمييز «" + tp.t + "»"); el.textContent = tp.feat ? "★" : "☆"; } catch (x) { toast(x.message); } }
    else if (a === "ins") { const ta = $("#khed textarea[name=body]"); const x = el.dataset.x, line = /^(==|##|###|>>|!!|- |~ |% |\{)/.test(x); const s0 = ta.selectionStart; const sel = ta.value.slice(s0, ta.selectionEnd); const ins = x === "**نص**" && sel ? "**" + sel + "**" : (line && s0 && ta.value[s0 - 1] !== "\n" ? "\n" : "") + x; ta.setRangeText(ins, s0, ta.selectionEnd, "end"); ta.focus(); ta.dispatchEvent(new Event("input")); }
    else if (a === "addh") { const f = $("#khed"), hid = f.hid.value.trim(); if (!hid) return; const bk = hid.split("-")[0]; const H = await getJ("data/hadith/" + bk + ".json"); const x = H && H[hid]; if (!x) return toast("لم يوجد في قسم الحديث"); const tp = window.__khEdit; const j = JSON.parse(f.json.value); const id = "h" + hid.replace(/\D/g, ""); j.ev[id] = { k: "h", t: x.m, lib: hid, b: bk, src: (x.full.match(/(متفق عليه|رواه[^.]*)\.?\s*$/) || [, ""])[1], g: "" }; f.json.value = JSON.stringify(j, null, 1); f.json.dispatchEvent(new Event("change")); toast("أضيف الدليل " + id + " — أدرجه بـ{h:" + id + "}"); }
    else if (a === "addn") { const f = $("#khed"), j = JSON.parse(f.json.value), id = f.nid.value.trim() || "n" + (Object.keys(j.ev).length + 1); j.ev[id] = { k: /^a/.test(id) ? "a" : "n", t: f.nt.value.trim(), who: f.nwho.value.trim(), src: f.nsrc.value.trim(), vs: { b: f.nb.value.trim(), p: +f.np.value || 1 } }; f.json.value = JSON.stringify(j, null, 1); f.json.dispatchEvent(new Event("change")); toast("أضيف " + id + " — أدرجه بـ{a:" + id + "}"); }
    else if (a === "addr") { const f = $("#khed"), j = JSON.parse(f.json.value), id = f.rid.value.trim() || "r" + (Object.keys(j.refs).length + 1); j.refs[id] = { b: f.rb.value.trim(), p: +f.rp.value || 1, t: f.rt.value.trim() || bookT(f.rb.value.trim()) }; if (f.rq.value.trim()) j.refs[id].q = f.rq.value.trim(); f.json.value = JSON.stringify(j, null, 1); f.json.dispatchEvent(new Event("change")); toast("أضيف المرجع — اكتب [^" + id + "] بعد الجملة"); }
    else if (a === "altuse" || a === "altdrop") { const tp = window.__khEdit, m = el.dataset.m; if (a === "altuse") { tp.models[m] = Object.assign({}, tp.alt[m], { st: "review" }); } delete tp.alt[m]; try { await save(tp, "خطب الجمعة: " + (a === "altuse" ? "اعتماد المسودة الجديدة للمراجعة" : "تجاهل مسودة") + " «" + tp.t + "»"); window.route(); } catch (x) { toast(x.message); } }
    else if (a === "regen") { const f = $("#khed"), tp = window.__khEdit; enqueue({ t: tp.t, s: tp.s, kw: tp.kw, cats: tp.cats, seas: tp.seas, models: [el.dataset.m], srcs: f.rsrc.value.split(/\s+/).filter(Boolean), note: f.note.value.trim() }, $("#khest")); }
    else if (a === "addcat") { const tb = document.querySelector(`table[data-kc=${el.dataset.k}] tbody`); tb.insertAdjacentHTML("beforeend", $("#khrow-" + el.dataset.k).innerHTML); }
    else if (a === "up") { const tr = el.closest("tr"); if (tr.previousElementSibling) tr.parentNode.insertBefore(tr, tr.previousElementSibling); }
    else if (a === "del") el.closest("tr").remove();
  });
  document.addEventListener("keydown", e => { const d = document.querySelector(".khdlv"); if (!d) return; const box = d.querySelector(".khdtext");
    if (e.key === "Escape") { exitDeliver(); location.hash = "#/khutab/" + encodeURIComponent(d.dataset.s) + "?m=" + d.dataset.m; } else if (e.key === " " || e.key === "PageDown" || e.key === "ArrowDown") { e.preventDefault(); box.scrollBy({ top: box.clientHeight * (e.key === "ArrowDown" ? .25 : .7), behavior: "smooth" }); } else if (e.key === "PageUp" || e.key === "ArrowUp") { e.preventDefault(); box.scrollBy({ top: -box.clientHeight * (e.key === "ArrowUp" ? .25 : .7), behavior: "smooth" }); } });

  /* الموجّه: #/khutab، #/khutab/admin، #/khutab/edit/<s>، #/khutab/<s>، #/khutab/<s>/deliver */
  function router(q, a, b) {
    a = a ? decodeURIComponent(a) : ""; FRESH = false;
    if (!a) return home(q); if (a === "admin") return admin(q); if (a === "edit") return edit(decodeURIComponent(b || "_new"), q);
    if (b === "deliver") return deliver(a, q); exitDeliver(); return show(a, q);
  }
  return { route: router, parse, plainText };
})();
