/* الضغطة المطولة على الكلمة في القارئ: المعاني اللغوية، والمعنى في كتب الشريعة (التفسير وشروح الحديث والفقه وأصوله والعقيدة)،
   وترجمة الكلمة في سياقها إلى اللغة الثانية التي يختارها القارئ.
   الفهرس: data/gloss (يبنيه tools/gloss.py من كتب المكتبة نفسها)، ويُقرأ من مستودع النصوص على GitHub عند الحاجة. */
const GL = {
  books: null, sh: new Map(),
  raw: p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/gloss/" + p,
  key(w) {
    w = String(w || "").replace(/[^ء-يٱً-ْ]/g, "").replace(/[ً-ْٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
    for (const p of ["وبال", "فبال", "وال", "فال", "بال", "كال", "ولل", "لل", "ال"]) if (w.startsWith(p) && w.length - p.length >= 2) return w.slice(p.length);
    return w.length >= 4 && "وفبكل".includes(w[0]) ? w.slice(1) : w;
  },
  shard(k) { return [...k.slice(0, 2)].map(c => c.codePointAt(0).toString(16).padStart(4, "0")).join("-"); },
  async load(k) {
    const s = this.shard(k); if (!this.sh.has(s)) this.sh.set(s, fetch(this.raw(s + ".json")).then(r => r.ok ? r.json() : {}).catch(() => ({})));
    return (await this.sh.get(s))[k] || [];
  },
  async meta() { if (!this.books) { try { this.books = (await (await fetch(this.raw("_books.json"))).json()).books || {}; } catch (e) { this.books = {}; } } return this.books; },
  // مداخل الكلمة: الكلمة نفسها، ثم جذورها المحتملة (للمعاجم)
  async lookup(word) {
    const k = this.key(word), keys = [k];
    try { roots(word).forEach(r => { const rk = this.key(r); if (!keys.includes(rk)) keys.push(rk); }); } catch (e) { }
    if (k.length > 3 && /(ه|ات|ون|ين|ان)$/.test(k)) keys.push(k.replace(/(ه|ات|ون|ين|ان)$/, ""));
    const all = [], seen = new Set();
    for (const kk of keys.slice(0, 6)) for (const e of await this.load(kk)) { const id = e[0] + ":" + e[1]; if (!seen.has(id)) { seen.add(id); all.push(e.concat([kk === k ? 0 : 1])); } }
    return all;
  }
};
const GCAT = { tafsir: "في كتب التفسير", hadith: "في شروح الحديث", fiqh: "في كتب الفقه والموسوعة الفقهية", usul: "في أصول الفقه", aqida: "في كتب العقيدة والفتاوى" };
const GTYP = { l: "مدخل معجمي", h: "مدخل في الموسوعة", d: "تعريف لغوي وشرعي", q: "شرح الموضع", m: "بيان المعنى", a: "تفسير الكلمة" };
const wctx = el => { const p = el.closest("p") || el.parentElement; const ws = [...p.querySelectorAll(".w")], i = ws.indexOf(el); return ws.slice(Math.max(0, i - 12), i + 13).map(x => x.textContent).join(" "); };

/* القائمة الصغيرة فوق الكلمة */
function wordMenu(w) {
  document.querySelectorAll(".wmenu,.rxpick").forEach(x => x.remove());
  const r = w.getBoundingClientRect(), d = document.createElement("div"), lang = (TRL.find(x => x[0] === (S.lang2 || "en")) || TRL[0])[1];
  d.className = "wmenu"; d.setAttribute("role", "menu");
  d.innerHTML = `<b>${esc(w.textContent.replace(/[^؀-ۿ]/g, ""))}</b><button data-act="wsec" data-s="lug">📖 المعاني اللغوية</button><button data-act="wsec" data-s="shr">⚖️ في كتب الشريعة</button><button data-act="wsec" data-s="tr">🌐 ${esc(lang)}</button><button data-act="walam">👤 العلم</button>`;
  d._w = w.textContent; d._ctx = wctx(w); const rb = w.closest(".rd"); d._b = rb && rb.dataset.id; d._p = rb && +rb.dataset.p;
  document.body.appendChild(d);
  const W = d.offsetWidth; d.style.top = (scrollY + r.top - d.offsetHeight - 10) + "px"; d.style.left = Math.max(8, Math.min(innerWidth - W - 8, r.left + r.width / 2 - W / 2)) + "px";
  if (r.top < d.offsetHeight + 70) d.style.top = (scrollY + r.bottom + 10) + "px";
  setTimeout(() => { const off = e => { if (!d.contains(e.target)) { d.remove(); document.removeEventListener("pointerdown", off, true); } }; document.addEventListener("pointerdown", off, true); }, 0);
}

/* لوحة معاني الكلمة */
async function wordSheet(word, ctx, focus, bid, p) {
  const w = String(word).replace(/[^؀-ۿ]/g, ""); if (!w) return;
  const lang = S.lang2 || "en";
  openSheet("«" + w + "»", `<div class="wsheet">
  <details class="wsec" data-s="lug" ${focus === "lug" ? "open" : ""}><summary>📖 المعاني اللغوية</summary><div id="wlug" class="mut">جارٍ البحث في المعاجم…</div></details>
  <details class="wsec" data-s="shr" ${focus === "shr" ? "open" : ""}><summary>⚖️ المعنى في كتب الشريعة <small class="mut">(الحقيقة الشرعية أخص من المعنى اللغوي، وعليها المعوّل في فهم النصوص)</small></summary><div id="wshr" class="mut">جارٍ البحث في كتب التفسير والشروح والفقه…</div></details>
  <details class="wsec" data-s="tr" ${focus === "tr" ? "open" : ""}><summary>🌐 الترجمة</summary><div class="row" style="align-items:center"><select id="wlang" aria-label="اللغة الثانية">${TRL.map(([k, t]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><span class="mut">لغتك الثانية في الموقع</span></div><div id="wtr" class="wtr mut">…</div></details>
  <div class="row" style="margin-top:10px"><a class="btn s nf" href="#/search?q=${encodeURIComponent(w)}" data-act="closeSheet">🔎 ابحث عنها في المكتبة</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent("ما معنى «" + w + "» في قوله: «" + ctx + "»؟ اذكر المعنى اللغوي، ثم توجيه المفسرين وشراح الحديث والفقهاء للمعنى المراد في هذا السياق، مع الإحالة.")}" data-act="closeSheet">💬 اسأل المساعد عن معناها في سياقها</a></div></div>`);
  window.__wsheet = { w, ctx, bid, p };
  const sec = document.querySelector(`.wsec[data-s="${focus}"]`); if (sec) setTimeout(() => sec.scrollIntoView({ block: "nearest" }), 80);
  // المعجم + الفهرس
  const [entries, books] = await Promise.all([GL.lookup(w), GL.meta()]);
  if (!window.__wsheet || window.__wsheet.w !== w) return;
  const cw = new Set(norm(ctx).split(/\s+/).filter(x => x.length > 2)), score = e => (e[4] ? 1 : 0) * -2 + norm(e[3]).split(/\s+/).filter(x => cw.has(x)).length;
  const item = e => { const b = B(e[0]); return `<details class="gitem"><summary><b>${esc(b ? (b.setTitle || b.title) : e[0])}</b> <span class="mut">${esc((b && PL(b, e[1] - 1)) || "ص " + toAr(e[1]))} • ${GTYP[e[2]] || ""}</span></summary><p>${esc(e[3])}</p><div class="row"><button class="btn s" data-act="gmore" data-b="${esc(e[0])}" data-p="${e[1]}">المزيد من الشرح</button><a class="btn s nf" href="#/book/${esc(e[0])}/${e[1]}?h=${encodeURIComponent(w)}" data-act="closeSheet">افتح الموضع في الكتاب</a></div></details>`; };
  // اللغوي: مختار الصحاح ثم بقية المعاجم
  let mk = ""; try { if (!DICT) DICT = window.__DICT__ || await (await fetch("data/dict/mukhtar.json")).json(); const found = roots(w).map(r => DICT[r]).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2); mk = found.map(x => `<details class="gitem" open><summary><b>مختار الصحاح</b> <span class="mut">مادة (${esc(x.r)})</span></summary><p>${esc(x.t.length > 700 ? x.t.slice(0, 700) + "…" : x.t)}</p></details>`).join(""); } catch (e) { }
  const lex = entries.filter(e => books[e[0]] === "lex").sort((a, b) => score(b) - score(a)).slice(0, 6);
  const el1 = $("#wlug"); if (el1) { el1.className = ""; el1.innerHTML = (mk + lex.map(item).join("")) || `<p class="mut">لم أجد الكلمة في معاجم المكتبة.</p>`; el1.insertAdjacentHTML("beforeend", `<p class="mut" style="font-size:.8rem">معاجم أخرى: <a target="_blank" rel="noopener" href="https://www.almaany.com/ar/dict/ar-ar/${encodeURIComponent(w)}/">المعاني</a> • <a target="_blank" rel="noopener" href="https://www.baheth.info/all.jsp?term=${encodeURIComponent(w)}">الباحث العربي</a></p>`); }
  const sh = entries.filter(e => books[e[0]] && books[e[0]] !== "lex"), g = {};
  sh.sort((a, b) => score(b) - score(a)).forEach(e => (g[books[e[0]]] = g[books[e[0]]] || []).push(e));
  const el2 = $("#wshr"); if (el2) { el2.className = ""; el2.innerHTML = Object.keys(GCAT).filter(c => g[c]).map(c => `<h4>${GCAT[c]}</h4>${g[c].slice(0, 5).map(item).join("")}`).join("") || `<p class="mut">لم أجد شرحًا صريحًا لهذه الكلمة في كتب الشريعة بالمكتبة. جرّب «اسأل المساعد عن معناها في سياقها».</p>`; }
  wordTr(w, ctx, lang);
}
async function wordTr(w, ctx, lang) {
  const el = $("#wtr"); if (!el) return; el.className = "wtr mut"; el.textContent = "جارٍ الترجمة…";
  try {
    const r = await fetch(`/api/translate?l=${encodeURIComponent(lang)}&w=${encodeURIComponent(w)}&ctx=${encodeURIComponent(strip(ctx).slice(0, 300))}`); const j = await r.json();
    if (!r.ok || !j.text) throw new Error("x");
    const [a, b] = j.text.split(/\n+/); el.className = "wtr"; el.dir = /^(ur|fa)$/.test(lang) ? "rtl" : "ltr"; el.innerHTML = `<b>${esc((a || "").replace(/^1\)\s*/, ""))}</b>${b ? `<p>${esc(b.replace(/^2\)\s*/, ""))}</p>` : ""}`;
  } catch (e) { try { const t = await mymemory(w, lang); el.className = "wtr"; el.dir = "ltr"; el.innerHTML = `<b>${esc(t)}</b><p class="mut">ترجمة معجمية عامة (تعذرت الترجمة السياقية الآن).</p>`; } catch (x) { el.textContent = "تعذرت الترجمة الآن."; } }
}
async function glossMore(bid, p) {
  const st = window.__wsheet || {}, w = st.w || "";
  openDlg('<p class="mut">جارٍ تحميل الموضع من الكتاب…</p>');
  try {
    const b = await loadBook(bid), raw = String(b.pages[p - 1] || ""), t = strip(raw).replace(/^#+\s*/gm, ""), n = norm(t), k = norm(w).replace(/^(وال|فال|بال|ال|و|ف|ب)/, "");
    let at = k ? n.indexOf(k) : -1; if (at < 0) at = 0;
    const a = Math.max(0, at - 450), seg = t.slice(a, a + 1500), hi = esc(seg).replace(new RegExp(esc(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), m => `<mark>${m}</mark>`);
    openDlg(`<h3>${esc(b.setTitle || b.title)}</h3><p class="mut">${esc(A(b.authorId).name)} • ${esc(PL(b, p - 1) || "صفحة " + toAr(p))}</p><div class="gmore">${a ? "… " : ""}${hi.replace(/\n/g, "<br>")}${a + 1500 < t.length ? " …" : ""}</div>
    <div class="row" style="margin-top:10px"><a class="btn p nf" href="#/book/${esc(bid)}/${p}?h=${encodeURIComponent(w)}" data-act="closeDlg">افتح الموضع في الكتاب</a></div>`);
  } catch (e) { openDlg(`<p class="note">تعذر تحميل الموضع: ${esc(e.message)}</p>`); }
}

/* الضغطة المطولة (لمس أو فأرة) على الكلمة، والنقر بالزر الأيمن */
(function wordPress() {
  let t = null, sx = 0, sy = 0, fired = false;
  document.addEventListener("pointerdown", e => { const w = e.target.closest(".rd .w"); if (!w || e.button > 0) return; fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { fired = true; wordMenu(w); if (navigator.vibrate) navigator.vibrate(10); }, 480); });
  document.addEventListener("pointermove", e => { if (t && (Math.abs(e.clientX - sx) > 9 || Math.abs(e.clientY - sy) > 9)) { clearTimeout(t); t = null; } }, { passive: true });
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, () => { clearTimeout(t); t = null; }, true));
  document.addEventListener("click", e => { if (fired && e.target.closest(".rd .w")) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
  document.addEventListener("contextmenu", e => { const w = e.target.closest(".rd .w"); if (!w) return; if (matchMedia("(pointer:fine)").matches) { e.preventDefault(); wordMenu(w); } });
})();
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
  if (a === "wsec") { const m = el.closest(".wmenu"); if (!m) return; m.remove(); try { getSelection().removeAllRanges(); } catch (x) { } wordSheet(m._w, m._ctx, el.dataset.s, m._b, m._p); }
  else if (a === "gmore") glossMore(el.dataset.b, +el.dataset.p);
});
document.addEventListener("change", e => { if (e.target.id === "wlang") { S.lang2 = e.target.value; saveS(); const st = window.__wsheet; if (st) wordTr(st.w, st.ctx, S.lang2); } });

/* شرح العبارة: عند تحديد أكثر من كلمة في القارئ («📚 شرح العبارة» في شريط التحديد).
   يبحث عن العبارة بنصها ثم بألفاظ قريبة منها (أغلب كلماتها متقاربة في موضع واحد)، ويقدّم المواضع التي يعقبها بيان
   (أي، يعني، معناه، المراد، قوله…) في كتب الشريعة، ثم ورودها في كتب مشايخ الدعوة، ثم في كتب التراث.
   المرحلة الأولى: كتب المكتبة غير الموسوعية + شروح الفهرس (data/gloss). والموسوعات الكبيرة (التفسير وشروح الحديث والفقه والعقيدة) عند الطلب. */
const PHS = new Set("في من على الى عن ما لا ان او ثم قد هو هي هم ذلك هذا هذه التي الذي الذين كان كانت مع بل لم لن اذا كل به له لها وهو وهي وما ولا فان انه الا حتى اي قال يا ولم وقد لقد عند منه فيه".split(" "));
const PHEXP = /(^|[^ء-ي])(اي|يعني|معناه|معني|المراد|يريد|ارادوا|تفسيره|بمعني|والمعني|ومعناه|قوله)([^ء-ي]|$)/;
const PHCATS = { tafsir: "التفسير", hadith: "شروح الحديث", fiqh: "الفقه وأصوله", aqida: "العقيدة" };
function phPrep(text) {
  const toks = norm(strip(text)).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, 14);
  const keys = [...new Set(toks.filter(w => !PHS.has(w)).map(w => { for (const p of ["وبال", "فبال", "وال", "فال", "بال", "كال", "لل", "ال"]) if (w.startsWith(p) && w.length - p.length >= 2) return w.slice(p.length); return w.length >= 4 && "وفب".includes(w[0]) ? w.slice(1) : w; }).filter(w => w.length >= 2))].slice(0, 8);
  const rx = new RegExp(toks.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^ء-ي]+"));
  return { toks, keys, rx, need: Math.max(2, Math.ceil(keys.length * .75)) };
}
function phFind(p, q) {
  const base = strip(plain(p)), nb = norm(base), m = q.rx.exec(nb);
  if (m) return { s: 100, at: m.index, len: m[0].length, base, exact: 1 };
  if (q.keys.length < 2) return null;
  let have = 0; for (const k of q.keys) if (nb.includes(k)) have++;
  if (have < q.need) return null;
  const tk = [...nb.matchAll(/[ء-ي]+/g)], W = q.toks.length * 2 + 4; let best = 0, bj = -1, be = -1;
  for (let j = 0; j < tk.length; j++) {
    if (!q.keys.some(k => tk[j][0].includes(k))) continue;
    const got = new Set(); let e = j;
    for (let x = j; x < Math.min(tk.length, j + W); x++) for (const k of q.keys) if (!got.has(k) && tk[x][0].includes(k)) { got.add(k); e = x; }
    if (got.size > best) { best = got.size; bj = j; be = e; if (best === q.keys.length) break; }
  }
  if (best < q.need) return null;
  return { s: Math.round(best / q.keys.length * 80), at: tk[bj].index, len: tk[be].index + tk[be][0].length - tk[bj].index, base };
}
function phScan(books, q, skip) {
  const out = [];
  for (const b of books) {
    if (!b.pages) continue; let n = 0;
    for (let i = 0; i < b.pages.length && n < 3; i++) {
      if (skip && b.id === skip.b && i + 1 === skip.p) continue;
      const h = phFind(b.pages[i], q); if (!h) continue;
      const nb = norm(h.base), around = nb.slice(Math.max(0, h.at - 40), h.at) + " " + nb.slice(h.at + h.len, h.at + h.len + 160);
      h.ex = PHEXP.test(around); h.b = b; h.i = i; h.s += h.ex ? 30 : 0; out.push(h); n++;
    }
  }
  return out;
}
function phItem(h, phrase) {
  const b = h.b, a = Math.max(0, h.at - 90), z = h.at + h.len, t = h.base;
  const snip = (a ? "…" : "") + esc(t.slice(a, h.at)) + "<mark>" + esc(t.slice(h.at, z)) + "</mark>" + esc(t.slice(z, z + 260)) + (z + 260 < t.length ? "…" : "");
  return `<details class="gitem"${h.ex ? " open" : ""}><summary><b>${esc(b.setTitle || b.title)}</b> <span class="mut">${esc(A(b.authorId).name)} • ${esc(PL(b, h.i) || "ص " + toAr(h.i + 1))}${h.exact ? "" : " • ألفاظ قريبة"}${h.ex ? " • فيه بيان" : ""}</span></summary><p>${snip}</p><div class="row"><a class="btn s nf" href="#/book/${esc(b.id)}/${h.i + 1}?h=${encodeURIComponent(h.exact ? phrase : t.slice(h.at, z))}" data-act="closeSheet">افتح الموضع في الكتاب</a></div></details>`;
}
async function phraseSheet(text, bid, p) {
  const phrase = strip(String(text)).replace(/\s+/g, " ").trim(), q = phPrep(phrase);
  if (q.toks.length < 2) { toast("للكلمة الواحدة: اضغط عليها ضغطًا مطولًا"); return; }
  const src = bid && B(bid), ask = `اشرح العبارة «${phrase}»${src ? ` الواردة في «${src.setTitle || src.title}»` : ""}: معناها، وما قاله فيها أهل التفسير وشراح الحديث والفقهاء، وما ورد فيها في كتب مشايخ الدعوة السلفية، مع الإحالة إلى المواضع.`;
  openSheet("شرح العبارة", `<div class="wsheet"><p class="phq">«${esc(phrase.length > 160 ? phrase.slice(0, 160) + "…" : phrase)}»</p>
  <div id="phres"><p class="mut">جارٍ البحث عن العبارة وما يقاربها في كتب المكتبة…</p></div>
  <div class="phmore"><p class="mut" style="margin:10px 0 4px">ابحث أيضًا في الموسوعات الكبيرة (أبطأ):</p><div class="row">${Object.entries(PHCATS).map(([c, t]) => `<button class="btn s" data-act="phcat" data-c="${c}">${t}</button>`).join("")}</div></div>
  <div class="row" style="margin-top:10px"><a class="btn s nf" href="#/search?q=${encodeURIComponent(phrase)}&mode=phrase" data-act="closeSheet">🔎 بحث العبارة في المكتبة كلها</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent(ask)}" data-act="closeSheet">💬 اسأل المساعد عن شرحها</a></div></div>`);
  const st = window.__phsheet = { phrase, q, hits: [], skip: bid ? { b: bid, p } : null, done: new Set() };
  const el = $("#phres"), [cats] = await Promise.all([GL.meta()]);
  const first = lib.books.filter(b => !b.big && b.type !== "article" && !b.demo);
  await loadMany(first, (i, n) => { if (window.__phsheet === st && i % 4 === 0) progress(el, i, n, "جارٍ تحميل الكتب للبحث"); });
  if (window.__phsheet !== st) return;
  st.hits = phScan(first, q, st.skip);
  // شروح الفهرس: مداخل كلمات العبارة التي يجتمع فيها أكثر ألفاظها
  try {
    const seen = new Set(st.hits.map(h => h.b.id + ":" + (h.i + 1)));
    for (const k of q.keys.slice(0, 4)) for (const e of await GL.load(k)) {
      const id = e[0] + ":" + e[1], b = B(e[0]); if (seen.has(id) || !b || cats[e[0]] === "lex") continue;
      const h = phFind(e[3], q); if (!h) continue; seen.add(id);
      Object.assign(h, { b, i: e[1] - 1, ex: true, s: h.s + 40 }); st.hits.push(h);
    }
  } catch (x) { }
  phRender();
}
function phRender() {
  const st = window.__phsheet, el = $("#phres"); if (!st || !el) return;
  GL.meta().then(cats => {
    const H = st.hits.slice().sort((a, b) => b.s - a.s), sh = H.filter(h => h.ex && cats[h.b.id] && cats[h.b.id] !== "lex"), shs = new Set(sh);
    const dw = H.filter(h => !shs.has(h) && bc(h.b) === "dawah"), tr = H.filter(h => !shs.has(h) && bc(h.b) !== "dawah");
    const sec = (t, a, n) => a.length ? `<h4>${t} <small class="mut">(${toAr(a.length)})</small></h4>${a.slice(0, n).map(h => phItem(h, st.phrase)).join("")}` : "";
    el.innerHTML = (sec("📖 بيانها في كتب الشريعة", sh, 8) + sec("🕌 في كتب مشايخ الدعوة", dw, 8) + sec("📚 في كتب التراث", tr, 8)) ||
      `<p class="mut">لم أجد العبارة ولا ألفاظًا قريبة منها في الكتب التي بُحث فيها. جرّب البحث في الموسوعات الكبيرة أدناه، أو اسأل المساعد.</p>`;
    if (st.done.size) el.insertAdjacentHTML("afterbegin", `<p class="mut" style="font-size:.85rem">شمل البحث أيضًا: ${[...st.done].map(c => PHCATS[c]).join("، ")}.</p>`);
  });
}
async function phCat(c, btn) {
  const st = window.__phsheet; if (!st || st.done.has(c)) return; btn.disabled = true;
  const cats = await GL.meta(), list = lib.books.filter(b => b.big && (cats[b.id] === c || (c === "fiqh" && cats[b.id] === "usul")));
  await loadMany(list, (i, n) => { if (window.__phsheet === st) btn.textContent = PHCATS[c] + " " + toAr(Math.round(i / n * 100)) + "٪"; });
  if (window.__phsheet !== st) return;
  const seen = new Set(st.hits.map(h => h.b.id + ":" + (h.i + 1)));
  phScan(list, st.q, st.skip).forEach(h => { if (!seen.has(h.b.id + ":" + (h.i + 1))) st.hits.push(h); });
  st.done.add(c); btn.textContent = "✓ " + PHCATS[c]; phRender();
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
  if (a === "selexp") { const s = String(getSelection()).trim(), rb = selRd() || $("#rb"); if (!s) return; try { getSelection().removeAllRanges(); } catch (x) { } $("#selq").hidden = true; phraseSheet(s, rb && rb.dataset.id, rb && +rb.dataset.p); }
  else if (a === "phcat") phCat(el.dataset.c, el);
});

/* تفسير الآية وشرح الحديث (من شريط التحديد):
   - الآية: يُتعرّف عليها من نص المصحف (data/quran/quran.json)، ثم يُفتح موضعها في كل تفسير من الفهرس المسبق data/tafidx (يبنيه tools/ayah-index.py).
   - الحديث: يظهر الزر إذا سبق التحديدَ ذكرُ النبي ﷺ أو «حديث»؛ ويُبحث عن متنه في كتب شروح السنة عند الطلب، مع رابط الدرر السنية. */
const QR = {
  d: null, all: "", at: [],
  n: s => norm(strip(String(s))).replace(/﻿/g, "").replace(/[^ء-ي]+/g, " ").replace(/\s+/g, " ").trim(),
  async load() {
    if (this.d) return this.d;
    if (!this._p) this._p = fetch("data/quran/quran.json").then(r => r.json()).then(j => { const at = [], parts = []; let o = 1;
      j.suras.forEach(s => s.ayat.forEach((a, i) => { const t = this.n(a); at.push({ s: s.n, a: i + 1, o, e: o + t.length, t, name: s.name }); parts.push(t); o += t.length + 3; }));
      this.all = " " + parts.join(" | ") + " "; this.at = at; return (this.d = j); }).catch(() => null);
    return this._p;
  },
  // يعيد الآيات التي يقع فيها التحديد (من آية إلى آية)، أو null
  find(sel) {
    if (!this.d) return null; const s = this.n(sel).split(" "); if (s.length < 3) return null;
    const rx = new RegExp(s.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "")).join("(?: \\| | )")), m = rx.exec(this.all); if (!m) return null;
    const a0 = this.at.findIndex(x => x.e >= m.index), a1 = this.at.findIndex(x => x.e >= m.index + m[0].length - 1);
    return a0 < 0 ? null : this.at.slice(a0, Math.max(a0, a1) + 1);
  }
};
const HADITH_SH = [["fathbari", "فتح الباري (ابن حجر)"], ["nawawimuslim", "شرح النووي على مسلم"], ["awnmabud", "عون المعبود (أبو داود)"], ["tuhfaahwadhi", "تحفة الأحوذي (الترمذي)"], ["subulsalam", "سبل السلام"], ["naylawtar", "نيل الأوطار"], ["tamhid", "التمهيد (ابن عبد البر)"], ["jamiulum", "جامع العلوم والحكم (ابن رجب)"], ["majmufatawa", "مجموع الفتاوى (ابن تيمية)"], ["zadmaad", "زاد المعاد (ابن القيم)"]];
const HCTX = /(صلى الله عليه وسلم|ﷺ|رسول الله|النبي|نبي الله|حديث|مرفوعا|يرفعه|عن [^\s]+ (?:بن|رضي))/;
function selCtx() { try { const r = getSelection().getRangeAt(0), p = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest("p,div"); const pre = document.createRange(); pre.setStart(p, 0); pre.setEnd(r.startContainer, r.startOffset); return pre.toString().slice(-160); } catch (e) { return ""; } }
document.addEventListener("selectionchange", () => {
  const bar = $("#selq"); if (!bar) return; const s = String(getSelection()).trim(), inRd = typeof selRd === "function" && selRd();
  if (inRd && !QR.d) QR.load();
  const ay = inRd && s.length > 8 && QR.find(s), wc = s.split(/\s+/).length, had = inRd && !ay && wc >= 4 && (HCTX.test(selCtx()) || HCTX.test(s.slice(0, 60)));
  bar.querySelector('[data-act="seltaf"]').hidden = !ay; bar.querySelector('[data-act="selhad"]').hidden = !had;
});
async function tafsirSheet(sel) {
  await QR.load(); const ay = QR.find(sel); if (!ay) return toast("لم أتعرّف على آية في التحديد");
  const f = ay[0], l = ay[ay.length - 1], ref = `${f.name.replace(/[ً-ْٰ]/g, "").replace(/سوره/, "سورة")} ${toAr(f.a)}${l.a !== f.a ? "–" + toAr(l.a) : ""}`;
  const qa = QR.d.suras[f.s - 1].ayat.slice(f.a - 1, (l.s === f.s ? l.a : f.a)).map((t, i) => t.replace(/﻿/, "") + " ﴿" + toAr(f.a + i) + "﴾").join(" ");
  openSheet("تفسير " + ref, `<div class="wsheet"><p class="phq">${esc(qa)}</p><div id="tfres"><p class="mut">جارٍ تحميل التفاسير…</p></div>
  <div class="row" style="margin-top:10px"><a class="btn s nf" target="_blank" rel="noopener" href="https://tafsir.app/${f.s}/${f.a}">التفاسير الأخرى في tafsir.app ↗</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent("فسّر قوله تعالى: ﴿" + qa.replace(/﴿[^﴾]*﴾/g, "") + "﴾ [" + ref + "] من تفسير ابن كثير والبغوي وغيرهما من كتب المكتبة، مع الإحالة")}" data-act="closeSheet">💬 اسأل المساعد</a></div></div>`);
  let idx = {}, meta = {}; try { [idx, meta] = await Promise.all([fetch(`data/tafidx/${f.s}.json`).then(r => r.json()), fetch("data/tafidx/_meta.json").then(r => r.json())]); } catch (e) { }
  const ents = idx[f.a] || [], el = $("#tfres"); if (!el) return;
  if (!ents.length) { el.innerHTML = '<p class="mut">لم أجد هذه الآية في فهرس التفاسير بعد.</p>'; return; }
  el.innerHTML = ents.map((e, i) => `<details class="gitem" ${i === 0 ? "open" : ""} id="tf${i}"><summary><b>${esc(((meta.tafasir || []).find(t => e[0].startsWith(t[0])) || [0, B(e[0]) ? B(e[0]).setTitle || B(e[0]).title : e[0]])[1])}</b> <span class="mut">${esc(PL(B(e[0]) || {}, e[1] - 1) || "ص " + toAr(e[1]))}${e[2] ? "" : " • موضع تقريبي"}</span></summary><div class="tftext mut">جارٍ التحميل…</div><div class="row"><a class="btn s nf" href="#/book/${esc(e[0])}/${e[1]}?h=${encodeURIComponent(f.t.split(" ").slice(0, 5).join(" "))}" data-act="closeSheet">افتح التفسير في الكتاب</a></div></details>`).join("");
  ents.forEach(async (e, i) => {
    const box = document.querySelector(`#tf${i} .tftext`); if (!box) return;
    try {
      const b = await loadBook(e[0]), pg = strip(plain(b.pages[e[1] - 1] || "")) + "\n" + strip(plain(b.pages[e[1]] || ""));
      const key = QR.n(f.t).split(" ").slice(0, 4).join(" "), nb = norm(pg).replace(/[^ء-ي\n]+/g, " "); let at = 0;
      // موضع الآية في الصفحة: أقرب عبارة تبدأ بكلماتها
      const words = key.split(" "), rx = new RegExp(words.join("[^ء-ي]+")), m = rx.exec(norm(pg)); if (m) at = m.index;
      const t = pg.slice(Math.max(0, at - 20), at + 1600);
      box.className = "tftext"; box.innerHTML = esc(t).replace(/\n/g, "<br>") + (pg.length > at + 1600 ? "…" : "");
    } catch (x) { box.textContent = "تعذر تحميل التفسير الآن."; }
  });
}
async function hadithSheet(sel) {
  const txt = strip(String(sel)).replace(/\s+/g, " ").trim(), core = txt.replace(/^.*?(?:صلى الله عليه وسلم|ﷺ)\s*[:«"]?\s*/, "").replace(/^(?:قال|يقول)\s*[:«"]?\s*/, "") || txt;
  const q = phPrep(core.split(" ").length >= 4 ? core : txt);
  openSheet("شرح الحديث", `<div class="wsheet"><p class="phq">«${esc(txt.length > 220 ? txt.slice(0, 220) + "…" : txt)}»</p>
  <details class="wsec hdsec" open><summary>📝 الشرح الإجمالي وفوائد الحديث</summary><div id="hdai" class="mut">جارٍ الإعداد…</div></details>
  <details class="wsec hdsec"><summary>🔤 غريب الكلمات</summary><div id="hdgh" class="mut">جارٍ البحث في «النهاية في غريب الحديث» والمعاجم…</div></details>
  <details class="wsec hdsec"><summary>📚 مواضعه في كتب السنة</summary><div id="hdloc" class="mut">جارٍ البحث في كتب السنة…</div></details>
  <details class="wsec hdsec"><summary>📖 مواضعه في شروح الحديث</summary>
  <p class="mut" style="margin:6px 0">اختر كتاب الشرح ليُبحث فيه عن الحديث (تُحمّل مجلداته أول مرة):</p>
  <div class="row hdbtns">${HADITH_SH.map(([p, t]) => `<button class="btn s" data-act="hdsrch" data-p="${p}">${esc(t)}</button>`).join("")}<button class="btn s p" data-act="hdall">ابحث فيها كلها</button></div>
  <div id="hdres"></div></details>
  <div class="row" style="margin-top:10px"><a class="btn s nf" target="_blank" rel="noopener" href="https://dorar.net/hadith/search?q=${encodeURIComponent(core.split(" ").slice(0, 12).join(" "))}">الحكم والشرح في الدرر السنية ↗</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent("اشرح حديث: «" + txt.slice(0, 400) + "» وخرّجه، مستعينًا بشروح السنة في المكتبة (فتح الباري وشرح النووي وغيرهما) مع الإحالة")}" data-act="closeSheet">💬 اسأل المساعد</a></div></div>`);
  window.__hd = { q, phrase: core, hits: [], done: new Set() };
  hdExtra(window.__hd, txt, core);
}
// المدخل يخص الكلمة: يبدأ بها، أو يذكر جذرها بين قوسين كما في «النهاية» (طرق)
const hdHead = (t, w, kk) => { t = String(t || ""); let rs = []; try { rs = roots(w) || []; } catch (e) { } return norm(t.slice(0, 40)).replace(/^\W+/, "").startsWith(kk) || rs.some(r => r && t.slice(0, 200).includes("(" + r + ")")); };
// أقسام نافذة الحديث: مواضعه في كتب السنة (فهرس البحث)، وغريب كلماته (النهاية والمعاجم)، والشرح الإجمالي والفوائد (المساعد مستندًا إلى شروح المكتبة)
const HD_SUNNA = /^(bukhari|muslim|abudawud|tirmidhi|nasai|ibnmajah|musnadahmad|muwatta|darimi|sunankubra|riyad|bulugh|umdaahkam|arbain|adabmufrad|shamail|masabih|jamiusul|shuabiman|baghawisunna|talkhishabir)(-v\d+)?$/;
async function hdExtra(st, txt, core) {
  const words = [...new Set(core.split(/\s+/).map(w => w.replace(/[^\u0621-\u064A]/g, "")).filter(w => w.length >= 4))].slice(0, 30);
  // ١- مواضعه في كتب السنة
  (async () => { const el = $("#hdloc"); let r = null; try { r = await SX.search(core.split(" ").slice(0, 14).join(" "), { k: 30 }); } catch (e) { }
    if (window.__hd !== st || !el) return; const L = (r || []).filter(h => HD_SUNNA.test(h.ref.split(":")[0])).slice(0, 10);
    el.className = ""; el.innerHTML = L.length ? L.map(h => { const [b, p] = h.ref.split(":"); return `<div class="gitem"><a href="#/book/${esc(b)}/${p}" data-act="closeSheet"><b>${esc(h.book)}</b> <span class="mut">${esc(h.page || "")}</span></a><p>${esc(String(h.text || "").slice(0, 260))}</p></div>`; }).join("") : '<p class="mut">لم يُعثر على مواضعه في كتب السنة المفهرسة. جرّب تحديد جزء أقصر من متن الحديث.</p>'; })();
  // ٢- غريب الكلمات: المعاجم وكتب الغريب أولًا
  (async () => { const el = $("#hdgh"), out = []; const B_ = await GL.meta().catch(() => ({}));
    for (const w of words) { if (out.length >= 8) break; let es = []; try { es = await GL.lookup(w); } catch (e) { } const kk = GL.key(w), lx = es.filter(e => (e[2] === "l" || /nihaya|mukhtar|lisan|qamus|maqayis|sihah|mufradat/.test(e[0])) && hdHead(e[3], w, kk)).sort((a, b) => (/nihaya/.test(b[0]) ? 1 : 0) - (/nihaya/.test(a[0]) ? 1 : 0) || a[4] - b[4]);
      if (lx[0]) out.push([w, lx[0]]); }
    if (window.__hd !== st || !el) return; el.className = "";
    el.innerHTML = out.length ? out.map(([w, e]) => { const b = B(e[0]); return `<div class="gitem"><b>${esc(w)}</b>: ${esc(String(e[3]).slice(0, 300))}<br><a class="mut" href="#/book/${esc(e[0])}/${e[1]}" data-act="closeSheet">${esc(b ? (b.setTitle || b.title) : e[0])} • ص ${toAr(e[1])}</a></div>`; }).join("") : '<p class="mut">لم تُعثر على كلمات غريبة في المعاجم المفهرسة.</p>'; })();
  // ٣- الشرح الإجمالي والفوائد
  const el = $("#hdai"); if (!el) return;
  if (typeof AI === "undefined" || !AI.viaServer || !Auth.token) {
    el.className = ""; el.innerHTML = `<p>يُعدّ المساعد العلمي شرحًا موجزًا للحديث وفوائده من شروح السنة في المكتبة للأعضاء المسجلين. <a href="#/account" data-act="closeSheet">سجّل الدخول</a>، أو ابحث في الشروح أدناه.</p>`; return; }
  el.innerHTML = '<p class="mut">يبحث المساعد في شروح السنة بالمكتبة…</p>';
  const prompt = `حديث: «${txt.slice(0, 600)}»\nابحث عنه في شروح الحديث بالمكتبة (فتح الباري، شرح النووي، عون المعبود، تحفة الأحوذي، جامع العلوم والحكم وغيرها)، ثم اكتب بإيجاز وبهذه العناوين:\n## الشرح الإجمالي\n(ثلاثة إلى خمسة أسطر)\n## من فوائد الحديث\n(أربع إلى سبع نقاط)\n## مصادر الشرح\n(الكتب والصفحات التي اعتمدت عليها)\nلا تزد على ما في الشروح، ولا تحكم على الحديث إلا بنقل حكم من كتاب في المكتبة مع عزوه.`;
  try { const ans = await AI.viaServer({ turns: [{ role: "user", content: prompt }], mode: "explain", onText: t => { if (window.__hd === st) { el.className = ""; el.innerHTML = md(t); } }, onStatus: t => { if (window.__hd === st && !el.dataset.t) el.innerHTML = `<p class="mut">${esc(t)}</p>`; } });
    if (window.__hd === st) { el.className = ""; el.innerHTML = md(ans) + '<p class="mut" style="font-size:.8rem">شرح آلي من المساعد العلمي مستند إلى شروح المكتبة؛ راجع المصدر عند الاستشهاد.</p>'; } }
  catch (e) { if (window.__hd === st) { el.className = ""; el.innerHTML = e && e.text ? md(e.text) : `<p class="mut">تعذر الشرح الآلي الآن${e && e.code === "quota" ? " (انتهت حصة الساعة)" : ""}؛ ابحث في الشروح أدناه.</p>`; } }
}
// لمس الحديث المميَّز في القارئ (عند تفعيل «تمييز الأحاديث») يفتح نافذته
document.addEventListener("click", e => {
  const w = e.target.closest(".rd .w.hd"); if (!w || !document.body.classList.contains("mk-h") || String(getSelection()).trim()) return;
  const p = w.closest("p"), ws = [...p.querySelectorAll(".w")], i = ws.indexOf(w); let a = i, z = i;
  while (a > 0 && ws[a - 1].classList.contains("hd")) a--; while (z < ws.length - 1 && ws[z + 1].classList.contains("hd")) z++;
  hadithSheet(ws.slice(a, z + 1).map(x => x.textContent).join(" "));
});
async function hdSearch(pre, btn) {
  const st = window.__hd; if (!st || st.done.has(pre)) return; st.done.add(pre); btn.disabled = true; const label = btn.textContent;
  const list = lib.books.filter(b => b.id === pre || b.id.startsWith(pre + "-v"));
  await loadMany(list, (i, n) => { btn.textContent = label + " " + toAr(Math.round(i / n * 100)) + "٪"; });
  if (window.__hd !== st) return;
  const found = phScan(list, st.q, null).sort((a, b) => b.s - a.s).slice(0, 4);
  btn.textContent = (found.length ? "✓ " : "— ") + label; st.hits.push(...found.map(h => Object.assign(h, { pre })));
  const el = $("#hdres"); if (!el) return;
  const order = HADITH_SH.map(x => x[0]), H = st.hits.slice().sort((a, b) => order.indexOf(a.pre) - order.indexOf(b.pre) || b.s - a.s);
  el.innerHTML = H.length ? H.map(h => phItem(h, st.phrase)).join("") : '<p class="mut">لم أجد الحديث في الشروح التي بُحث فيها بعد.</p>';
}
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
  if (a === "seltaf" || a === "selhad") { const s = String(getSelection()).trim(); if (!s) return; try { getSelection().removeAllRanges(); } catch (x) { } $("#selq").hidden = true; a === "seltaf" ? tafsirSheet(s) : hadithSheet(s); }
  else if (a === "hdsrch") hdSearch(el.dataset.p, el);
  else if (a === "hdall") { el.disabled = true; for (const b of document.querySelectorAll('[data-act="hdsrch"]')) await hdSearch(b.dataset.p, b); el.textContent = "✓ بُحث فيها كلها"; }
});
