/* الموسوعات العلمية المتخصصة (#/mawsua) — طلب المدير، ٢٠ نوفمبر ٢٠٢٦: عقيدة، فقه، تفسير، علوم القرآن، الفكر، الدعوة، اللغة، التاريخ،
   الآداب والأخلاق، التربية، الأسرة، السياسة الشرعية؛ على نمط الموسوعات المحكمة: أبواب ← فصول ← مسائل، وكل مسألة مادة محررة بأقسام ثابتة
   عمادها كلام مشايخ الدعوة السلفية في كتبهم ومقالاتهم وفتاواهم، وتكميلها من المراجع المتخصصة، وكل فقرة معزوة إلى موضعها (tools/mawsua.py).
   المسودات للإدارة حتى تعتمدها؛ ومنها: اعتماد المادة، وطابور التحرير، وإعادة المخطط. */
const MAWS = (() => {
  const R = "data/mawsua/", TR = {}, EN = {};
  const getJ = async p => { try { const r = await fetch(p + "?t=" + Math.floor(Date.now() / 120e3)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const adm = () => isAdmin() || (typeof can === "function" && can("edit"));
  const tree = async k => TR[k] || (TR[k] = await getJ(R + k + "/_tree.json"));
  const entry = async (k, id) => EN[id] || (EN[id] = await getJ(R + k + "/e/" + id + ".json"));
  const flat = t => { const L = []; (t && t.b || []).forEach((b, i) => b.f.forEach((f, j) => f.m.forEach(m => L.push(Object.assign({ bi: i, fi: j, bab: b.t, fasl: f.t }, m))))); return L; };
  const vis = m => m.e && (m.ok || adm());
  const crumbs = (...l) => `<p class="mwcr"><a href="#/mawsua">الموسوعات العلمية</a>${l.map(([t, h]) => " › " + (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join("")}</p>`;
  const ord = n => ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر"][n] || toAr(n);

  async function home(q) {
    const I = await getJ(R + "_index.json"); if (!I) return view('<div class="note">تعذر تحميل الموسوعات.</div>');
    const tot = I.items.reduce((a, x) => a + x.m, 0), ok = I.items.reduce((a, x) => a + x.ok, 0);
    view(`<section class="cmhero mwhero"><div><h2>الموسوعات العلمية المتخصصة</h2><p>موسوعات محكمة في العلوم الشرعية، عمادها ومرجعيتها كتب مشايخ الدعوة السلفية ومؤلفاتهم ومقالاتهم وفتاواهم، وتُكمَّل أبوابها ومسائلها من المراجع العلمية المتخصصة المشهورة في كل فن؛
      مرتبة على أبواب وفصول ومسائل على نمط الموسوعات العلمية المحكمة، بتحرير متناسق، وعزو كل فقرة إلى كتابها وصفحتها، ومراجعة كل مادة قبل نشرها.</p>
      <p class="mut">${toAr(I.items.length)} موسوعة${tot ? ` • ${toAr(tot)} مسألة في المخططات • ${toAr(ok)} مادة معتمدة` : " • تُعد المخططات الآن"}</p></div></section>
      <form class="sbox" data-form="mwq" style="max-width:none"><input name="q" type="search" value="${esc(q.q || "")}" placeholder="ابحث عن مسألة في الموسوعات كلها" aria-label="بحث في الموسوعات"><button class="btn">بحث</button></form><div id="mwres"></div>
      <div class="mwgrid">${I.items.map(x => `<a class="mwcard" href="#/mawsua/${x.k}"><i aria-hidden="true">${x.ic}</i><b>${esc(x.n)}</b><span>${esc(x.d)}</span><small>${x.m ? `${toAr(x.bab)} بابًا • ${toAr(x.m)} مسألة • ${toAr(adm() ? x.e : x.ok)} مادة ${adm() ? "محررة" : "منشورة"}` : "المخطط قيد الإعداد"}</small>${x.m ? `<em style="--p:${Math.round(100 * (adm() ? x.e : x.ok) / x.m)}%"></em>` : ""}</a>`).join("")}</div>
      <details class="card"><summary>منهج الموسوعات</summary><ul class="mwman"><li>المخطط: أبواب وفصول ومسائل على ترتيب كتب الفن المعتمدة، شاملة غير متداخلة، تراجعها الإدارة وتعدّلها.</li>
      <li>المادة: ${(I.secs || []).map(esc).join("، ")} — بأسلوب علمي متناسق.</li><li>العماد كلام مشايخ الدعوة بنصوصهم ومواضعهم، والتكميل من المراجع المتخصصة؛ ولا تُقبل فقرة بلا عزو إلى موضع في المكتبة، ولا اقتباس لا يوجد بحروفه في مصدره.</li>
      <li>كل مادة مسودة حتى يراجعها متخصص ويعتمدها؛ وما لم تكفِ مصادره يُترك حتى تُضاف مصادره.</li></ul></details>`);
    if (q.q) search(q.q, I);
  }
  async function search(term, I) {
    const box = $("#mwres"), w = norm(term).split(/\s+/).filter(Boolean); box.innerHTML = '<p class="mut">جارٍ البحث…</p>'; const out = [];
    for (const x of I.items) { if (!x.m) continue; const t = await tree(x.k); flat(t).forEach(m => { const h = norm(m.t + " " + (m.kw || []).join(" ") + " " + m.fasl + " " + m.bab); if (w.every(k => h.includes(k))) out.push([x, m]); }); }
    box.innerHTML = out.length ? `<div class="card"><p class="mut">${toAr(out.length)} مسألة</p><ul class="mwlist">${out.slice(0, 120).map(([x, m]) => `<li>${vis(m) ? `<a href="#/mawsua/${x.k}/${m.id}">${esc(m.t)}</a>` : `<span>${esc(m.t)}</span> <small class="mut">قيد التحرير</small>`} <small class="mut">— ${esc(x.n)} › ${esc(m.bab)}</small></li>`).join("")}</ul></div>` : '<p class="note">لا مسائل مطابقة.</p>';
  }
  async function enc(k, q) {
    const t = await tree(k), I = await getJ(R + "_index.json"), x = ((I || {}).items || []).find(y => y.k === k) || { n: k, ic: "📚", d: "" };
    if (!t) return view(crumbs([x.n]) + `<h2>${x.ic} ${esc(x.n)}</h2><p class="mut">${esc(x.d)}</p><div class="note">يُعد مخطط هذه الموسوعة الآن (الأبواب والفصول والمسائل)، ثم تُحرر مسائلها تباعًا.</div>${adm() ? admBar(k, null) : ""}`);
    const L = flat(t), done = L.filter(vis).length;
    view(crumbs([x.n]) + `<section class="mwhead"><i aria-hidden="true">${x.ic}</i><div><h2>${esc(x.n)}</h2><p class="mut">${esc(x.d)}</p><p class="mut">${toAr(t.b.length)} بابًا • ${toAr(L.length)} مسألة • ${toAr(done)} مادة ${adm() ? "محررة" : "منشورة"}${t.ok ? "" : adm() ? ' • <em class="tag">المخطط مسودة</em>' : ""}</p></div></section>
      ${adm() ? admBar(k, t) : ""}
      <div class="mwtree">${t.b.map((b, i) => `<details${i === 0 || q.b == i + 1 ? " open" : ""}><summary><b>الباب ${ord(i + 1)}:</b> ${esc(b.t)} <small class="mut">${toAr(b.f.reduce((a, f) => a + f.m.filter(vis).length, 0))}/${toAr(b.f.reduce((a, f) => a + f.m.length, 0))}</small></summary>
        ${b.f.map((f, j) => `<div class="mwf"><h4>الفصل ${ord(j + 1)}: ${esc(f.t)}</h4><ol>${f.m.map(m => `<li>${vis(m) ? `<a href="#/mawsua/${k}/${m.id}">${esc(m.t)}</a>${m.ok ? "" : ' <em class="tag">مسودة</em>'}` : `<span class="mwpend">${esc(m.t)}</span>${adm() && m.skip ? ` <small class="mut">(${esc(m.skip)})</small>` : ""}`}</li>`).join("")}</ol></div>`).join("")}</details>`).join("")}</div>`);
  }
  const admBar = (k, t) => `<div class="mwadm card"><b>🛡️ الإدارة:</b> <button class="btn s p" data-mw="q" data-k="${k}" data-n="20">حرّر ٢٠ مسألة تالية</button> <button class="btn s" data-mw="q" data-k="${k}" data-n="60">٦٠ مسألة</button> <button class="btn s" data-mw="plan" data-k="${k}">${t ? "إعادة المخطط" : "إعداد المخطط"}</button>${t && !t.ok ? ` <button class="btn s" data-mw="tok" data-k="${k}">اعتماد المخطط</button>` : ""} <span class="mut">التعديل اليدوي: data/mawsua/${k}/_tree.json</span> <span class="mwst mut"></span></div>`;

  async function art(k, id) {
    const t = await tree(k), L = flat(t), i = L.findIndex(m => m.id === id), m = L[i], E = m && m.e ? await entry(k, id) : null, I = await getJ(R + "_index.json"), x = ((I || {}).items || []).find(y => y.k === k) || { n: k };
    if (!E || !(E.ok || m.ok || adm())) return view(crumbs([x.n, "#/mawsua/" + k]) + '<div class="note">هذه المسألة قيد التحرير والمراجعة.</div>');
    const tags = Object.keys(E.src || {}), num = Object.fromEntries(tags.map((g, n) => [g, n + 1])), sup = c => c.map(g => `<button type="button" class="mwfn linkbtn" data-mw="fn" data-n="${num[g]}" title="${esc(E.src[g].t)}">${toAr(num[g])}</button>`).join("");
    const where = s => `«${esc(s.t)}»${s.a ? " — " + esc(s.a) : ""}، ص ${toAr(s.p)}`;
    const prev = L.slice(0, i).reverse().find(vis), next = L.slice(i + 1).find(vis), seeL = (E.see || []).map(s => L.find(y => norm(y.t) === norm(s))).filter(y => y && vis(y) && y.id !== id);
    view(crumbs([x.n, "#/mawsua/" + k], [m.bab, "#/mawsua/" + k + "?b=" + (m.bi + 1)]) + `<article class="mwart">
      <p class="mut">${esc(m.bab)} › ${esc(m.fasl)}</p><h2>${esc(E.t)}</h2>${E.ok || m.ok ? "" : '<p class="note">مسودة تنتظر المراجعة العلمية والاعتماد.</p>'}
      ${E.lead ? `<p class="mwlead">${esc(E.lead)}</p>` : ""}
      ${(E.s || []).map(s => `<section><h3>${esc(s.h)}</h3>${s.p.map(p => `<p>${esc(p.t)}${sup(p.c)}</p>`).join("")}</section>`).join("")}
      ${(E.q || []).length ? `<section><h3>نصوص مختارة</h3>${E.q.map(q => `<blockquote class="mwq">«${esc(q.t)}» <small>— ${where(E.src[q.c])} <a href="#/book/${esc(E.src[q.c].b)}/${E.src[q.c].p}?h=${encodeURIComponent(q.t.slice(0, 40))}">موضعه</a></small></blockquote>`).join("")}</section>` : ""}
      <section class="mwsrc"><h3>المصادر</h3><ol>${tags.map(g => `<li id="mwsrc-${num[g]}"><span class="tag">${E.src[g].k === "d" ? "مشايخ الدعوة" : "مرجع"}</span> <a href="#/book/${esc(E.src[g].b)}/${E.src[g].p}">${where(E.src[g])}</a></li>`).join("")}</ol></section>
      ${seeL.length ? `<p><b>مسائل ذات صلة:</b> ${seeL.map(y => `<a class="chip" href="#/mawsua/${k}/${y.id}">${esc(y.t)}</a>`).join(" ")}</p>` : ""}
      <div class="row"><button class="btn s" data-mw="copy">نسخ المادة بالعزو</button>${adm() && !(E.ok || m.ok) ? `<button class="btn s p" data-mw="ok" data-k="${k}" data-id="${esc(id)}">✓ اعتماد المادة ونشرها</button>` : ""}${adm() ? `<button class="btn s" data-mw="redo" data-k="${k}" data-id="${esc(id)}">إعادة التحرير</button>` : ""} <span class="mwst mut"></span></div>
      <nav class="mwnav">${prev ? `<a href="#/mawsua/${k}/${prev.id}">→ ${esc(prev.t)}</a>` : "<span></span>"}${next ? `<a href="#/mawsua/${k}/${next.id}">${esc(next.t)} ←</a>` : ""}</nav></article>`);
    window.__mwE = E;
  }
  function show(q, k, id) { q = q || {}; if (!k) return home(q); if (!id) return enc(k, q); return art(k, decodeURIComponent(id)); }

  document.addEventListener("submit", e => { const f = e.target.closest('[data-form="mwq"]'); if (!f) return; e.preventDefault(); location.hash = "#/mawsua?q=" + encodeURIComponent(f.q.value.trim()); }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-mw]"); if (!el) return; const a = el.dataset.mw, k = el.dataset.k, st = el.parentNode.querySelector(".mwst") || { textContent: "" };
    if (a === "fn") { const t = document.getElementById("mwsrc-" + el.dataset.n); if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("hl"); setTimeout(() => t.classList.remove("hl"), 1800); } return; }
    if (a === "copy") { const E = window.__mwE; if (!E) return; const tg = Object.keys(E.src || {}), n = Object.fromEntries(tg.map((g, i) => [g, i + 1]));
      const txt = `${E.t}\n\n${E.lead || ""}\n\n` + E.s.map(s => s.h + "\n" + s.p.map(p => p.t + " " + p.c.map(c => "[" + n[c] + "]").join("")).join("\n")).join("\n\n") + "\n\nالمصادر:\n" + tg.map(g => `[${n[g]}] ${E.src[g].t}${E.src[g].a ? "، " + E.src[g].a : ""}، ص ${E.src[g].p}`).join("\n") + "\n" + location.href;
      return navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast("نُسخت المادة بمصادرها")); }
    if (typeof GH === "undefined" || !GH.on) return st.textContent = "فعّل الإدارة المباشرة أولًا";
    const tp = R + k + "/_tree.json", each = (o, f) => (o.b || []).forEach(b => b.f.forEach(x => x.m.forEach(f)));
    try {
      if (a === "q" || a === "plan") { await GH.editJSON(R + "_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => x.k !== k || x.do !== a.replace("q", "build")); o.items.push(a === "plan" ? { k, do: "plan", force: 1 } : { k, do: "build", n: +el.dataset.n }); return o; }, "الموسوعات: طابور " + k, true); st.textContent = "✓ أُضيف إلى طابور التحرير؛ يبدأ خلال دقائق"; }
      else if (a === "tok") { await GH.editJSON(tp, o => Object.assign(o, { ok: 1 }), "الموسوعات: اعتماد مخطط " + k); TR[k] = null; st.textContent = "✓ اعتُمد المخطط"; }
      else if (a === "ok" || a === "redo") { const id = el.dataset.id;
        if (a === "ok") await GH.editJSON(R + k + "/e/" + id + ".json", o => Object.assign(o, { ok: 1, okAt: today() }), "الموسوعات: اعتماد مادة");
        await GH.editJSON(tp, o => { each(o, m => { if (m.id === id) { if (a === "ok") m.ok = 1; else { delete m.e; delete m.ok; delete m.skip; } } }); return o; }, "الموسوعات: " + (a === "ok" ? "اعتماد" : "إعادة تحرير") + " مسألة");
        if (a === "redo") await GH.editJSON(R + "_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).concat([{ k, do: "build", n: 1, ids: [id] }]); return o; }, "الموسوعات: إعادة تحرير", true);
        TR[k] = null; EN[id] = null; st.textContent = a === "ok" ? "✓ اعتُمدت ونُشرت" : "✓ أُعيدت إلى طابور التحرير"; }
    } catch (x) { st.textContent = x.message; }
  });
  return { show };
})();
