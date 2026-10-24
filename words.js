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
  d.innerHTML = `<b>${esc(w.textContent.replace(/[^؀-ۿ]/g, ""))}</b><button data-act="wsec" data-s="lug">📖 المعاني اللغوية</button><button data-act="wsec" data-s="shr">⚖️ في كتب الشريعة</button><button data-act="wsec" data-s="tr">🌐 ${esc(lang)}</button>`;
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
