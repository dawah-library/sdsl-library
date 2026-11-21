/* الموسوعات العلمية المتخصصة (#/mawsua) — طلب المدير، ٢٠ نوفمبر ٢٠٢٦: عقيدة، فقه، تفسير، علوم القرآن، الفكر، الدعوة، اللغة، التاريخ،
   الآداب والأخلاق، التربية، الأسرة، السياسة الشرعية؛ على نمط الموسوعات المحكمة: أبواب ← فصول ← مسائل، وكل مسألة مادة محررة بأقسام ثابتة
   عمادها كلام مشايخ الدعوة السلفية في كتبهم ومقالاتهم وفتاواهم، وتكميلها من المراجع المتخصصة، وكل فقرة معزوة إلى موضعها (tools/mawsua.py).
   المسودات للإدارة حتى تعتمدها؛ ومنها: اعتماد المادة، وطابور التحرير، وإعادة المخطط. */
const MW_ICONS = { athar: "scroll-text", aqeeda: "shield-check", fiqh: "scale", tafsir: "book-open-text", quran: "book-marked", fikr: "compass", dawa: "megaphone", lugha: "type", tarikh: "history", adab: "heart-handshake", tarbiya: "sprout", usra: "house", siyasa: "landmark" },
  MW_HUE = { athar: 35, aqeeda: 160, fiqh: 200, tafsir: 145, quran: 120, fikr: 260, dawa: 15, lugha: 225, tarikh: 30, adab: 330, tarbiya: 95, usra: 0, siyasa: 185 };
const MAWS = (() => {
  const R = "data/mawsua/", TR = {}, EN = {};
  // أيقونات معيارية (Lucide، icons.js) لكل موسوعة بدل الصور المصغرة والرموز التعبيرية، ولون مميز لكل منها
  const MWI = MW_ICONS, MWH = k => MW_HUE[k] == null ? 160 : MW_HUE[k];
  const getJ = async p => { try { const r = await fetch(p + "?t=" + Math.floor(Date.now() / 120e3)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const adm = () => isAdmin() || (typeof can === "function" && can("edit"));
  const tree = async k => TR[k] || (TR[k] = await getJ(R + k + "/_tree.json"));
  const entry = async (k, id) => EN[id] || (EN[id] = await getJ(R + k + "/e/" + id + ".json"));
  const flat = t => { const L = []; (t && t.b || []).forEach((b, i) => b.f.forEach((f, j) => f.m.forEach(m => L.push(Object.assign({ bi: i, fi: j, bab: b.t, fasl: f.t }, m))))); return L; };
  const vis = m => m.e && (m.ok || adm());
  const crumbs = (...l) => `<p class="mwcr"><a href="#/mawsua">موسوعات الموقع</a>${l.map(([t, h]) => " › " + (h ? `<a href="${h}">${esc(t)}</a>` : esc(t))).join("")}</p>`;
  const ord = n => ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر"][n] || toAr(n);

  async function home(q) {
    const I = await getJ(R + "_index.json"); if (!I) return view('<div class="note">تعذر تحميل الموسوعات.</div>');
    const tot = I.items.reduce((a, x) => a + x.m, 0), ok = I.items.reduce((a, x) => a + x.ok, 0), AX = await getJ("data/athar/_index.json");
    // البطاقات: موسوعة آثار السلف أولًا ثم الموسوعات المتخصصة؛ وطريقتا عرض (طلب المدير): «استعراض» بأيقونات كتطبيقات الهاتف، و«قائمة» مفصلة
    const T = [{ k: "athar", h: "#/athar", n: "موسوعة آثار السلف", d: "وصايا الصحابة والتابعين ومن بعدهم إلى نهاية القرن الثالث وحكمهم ومواعظهم، بألفاظها معزوّة إلى مواضعها مع تخريجها", meta: AX ? `${toAr(AX.count || 0)} أثرًا من ${toAr((AX.people || []).length)} علمًا` : "آثار مرتبة بالأبواب والأعلام", p: 100 }]
      .concat(I.items.map(x => ({ k: x.k, h: "#/mawsua/" + x.k, n: x.n, d: x.d, meta: x.m ? `${toAr(x.bab)} بابًا • ${toAr(x.m)} مسألة • ${toAr(adm() ? x.e : x.ok)} مادة ${adm() ? "محررة" : "منشورة"}` : "المخطط قيد الإعداد", p: x.m ? Math.round(100 * (adm() ? x.e : x.ok) / x.m) : 0 })));
    window.__mwT = T;
    view(`<section class="cmhero mwhero"><div><h2>موسوعات الموقع</h2><p>موسوعة آثار السلف، والموسوعات العلمية المتخصصة: موسوعات محكمة في العلوم الشرعية، عمادها ومرجعيتها كتب مشايخ الدعوة السلفية ومؤلفاتهم ومقالاتهم وفتاواهم، وتُكمَّل أبوابها ومسائلها من المراجع العلمية المتخصصة المشهورة في كل فن؛
      مرتبة على أبواب وفصول ومسائل على نمط الموسوعات العلمية المحكمة، بتحرير متناسق، وعزو كل فقرة إلى كتابها وصفحتها، ومراجعة كل مادة قبل نشرها؛ ولكل موسوعة اختبارات «المِسبار» لقياس مستواك فيها.</p>
      <p class="mut">${toAr(I.items.length + 1)} موسوعة${tot ? ` • ${toAr(tot)} مسألة في المخططات • ${toAr(ok)} مادة معتمدة` : " • تُعد المخططات الآن"}</p></div></section>
      <form class="sbox" data-form="mwq" style="max-width:none"><input name="q" type="search" value="${esc(q.q || "")}" placeholder="ابحث عن مسألة في الموسوعات كلها" aria-label="بحث في الموسوعات"><button class="btn">بحث</button></form><div id="mwres"></div>
      <div class="mwbar"><h3>الموسوعات</h3><div class="mwview" role="group" aria-label="طريقة العرض"><button type="button" data-mwv="apps" title="استعراض بالأيقونات">${ic("layout-grid", 18)}<span>استعراض</span></button><button type="button" data-mwv="list" title="قائمة مفصلة">${ic("list", 18)}<span>قائمة</span></button></div></div>
      <div id="mwtiles"></div>
      <div id="msbhome"></div>
      <details class="card"><summary>منهج الموسوعات</summary><ul class="mwman"><li>المخطط: أبواب وفصول ومسائل على ترتيب كتب الفن المعتمدة، شاملة غير متداخلة، تراجعها الإدارة وتعدّلها.</li>
      <li>المادة: ${(I.secs || []).map(esc).join("، ")} — بأسلوب علمي متناسق.</li><li>العماد كلام مشايخ الدعوة بنصوصهم ومواضعهم، والتكميل من المراجع المتخصصة؛ ولا تُقبل فقرة بلا عزو إلى موضع في المكتبة، ولا اقتباس لا يوجد بحروفه في مصدره.</li>
      <li>كل مادة مسودة حتى يراجعها متخصص ويعتمدها؛ وما لم تكفِ مصادره يُترك حتى تُضاف مصادره.</li></ul></details>`);
    tiles();
    if (typeof MSB !== "undefined") MSB.homeBlock($("#msbhome"));
    if (q.q) search(q.q, I);
  }
  const mode = () => { try { return localStorage.getItem("mw_view") || "apps"; } catch (e) { return "apps"; } };
  function tiles(m) {
    const box = $("#mwtiles"), T = window.__mwT || []; if (!box) return; m = m || mode();
    document.querySelectorAll("[data-mwv]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mwv === m));
    box.innerHTML = m === "list"
      ? `<div class="mwrows">${T.map(x => `<a class="mwrow" href="${x.h}" style="--h:${MWH(x.k)}"><span class="mwai">${ic(MWI[x.k] || "book-marked", 24)}</span><span class="mwrt"><b>${esc(x.n)}</b><span>${esc(x.d)}</span><small>${x.meta}</small></span>${x.p ? `<em style="--p:${x.p}%"></em>` : ""}</a>`).join("")}</div>`
      : `<div class="mwapps">${T.map(x => `<a class="mwapp" href="${x.h}" style="--h:${MWH(x.k)}" title="${esc(x.d)}"><span class="mwai">${ic(MWI[x.k] || "book-marked", 30)}</span><b>${esc(x.n.replace(/^موسوعة\s+/, ""))}</b></a>`).join("")}</div>`;
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-mwv]"); if (!b) return; try { localStorage.setItem("mw_view", b.dataset.mwv); } catch (x) { } tiles(b.dataset.mwv); });
  async function search(term, I) {
    const box = $("#mwres"), w = norm(term).split(/\s+/).filter(Boolean); box.innerHTML = '<p class="mut">جارٍ البحث…</p>'; const out = [];
    for (const x of I.items) { if (!x.m) continue; const t = await tree(x.k); flat(t).forEach(m => { const h = norm(m.t + " " + (m.kw || []).join(" ") + " " + m.fasl + " " + m.bab); if (w.every(k => h.includes(k))) out.push([x, m]); }); }
    box.innerHTML = out.length ? `<div class="card"><p class="mut">${toAr(out.length)} مسألة</p><ul class="mwlist">${out.slice(0, 120).map(([x, m]) => `<li>${vis(m) ? `<a href="#/mawsua/${x.k}/${m.id}">${esc(m.t)}</a>` : `<span>${esc(m.t)}</span> <small class="mut">قيد التحرير</small>`} <small class="mut">— ${esc(x.n)} › ${esc(m.bab)}</small></li>`).join("")}</ul></div>` : '<p class="note">لا مسائل مطابقة.</p>';
  }
  async function enc(k, q) {
    const t = await tree(k), I = await getJ(R + "_index.json"), x = ((I || {}).items || []).find(y => y.k === k) || { n: k, ic: "📚", d: "" };
    if (!t) { setTimeout(() => typeof MSB !== "undefined" && MSB.encBlock($("#msbenc"), k), 0); return view(crumbs([x.n]) + `<h2>${esc(x.n)}</h2><p class="mut">${esc(x.d)}</p><div class="note">يُعد مخطط هذه الموسوعة الآن (الأبواب والفصول والمسائل)، ثم تُحرر مسائلها تباعًا.</div><div id="msbenc"></div>${adm() ? admBar(k, null) : ""}`); }
    const L = flat(t), done = L.filter(vis).length;
    view(crumbs([x.n]) + `<section class="mwhead" style="--h:${MWH(k)}"><span class="mwai">${ic(MWI[k] || "book-marked", 30)}</span><div><h2>${esc(x.n)}</h2><p class="mut">${esc(x.d)}</p><p class="mut">${toAr(t.b.length)} بابًا • ${toAr(L.length)} مسألة • ${toAr(done)} مادة ${adm() ? "محررة" : "منشورة"}${t.ok ? "" : adm() ? ' • <em class="tag">المخطط مسودة</em>' : ""}</p></div></section>
      <div id="msbenc"></div>${adm() ? admBar(k, t) : ""}
      <div class="mwtree">${t.b.map((b, i) => `<details${i === 0 || q.b == i + 1 ? " open" : ""}><summary><b>الباب ${ord(i + 1)}:</b> ${esc(b.t)} <small class="mut">${toAr(b.f.reduce((a, f) => a + f.m.filter(vis).length, 0))}/${toAr(b.f.reduce((a, f) => a + f.m.length, 0))}</small></summary>
        ${b.f.map((f, j) => `<div class="mwf"><h4>الفصل ${ord(j + 1)}: ${esc(f.t)}</h4><ol>${f.m.map(m => `<li>${vis(m) ? `<a href="#/mawsua/${k}/${m.id}">${esc(m.t)}</a>${m.ok ? "" : ' <em class="tag">مسودة</em>'}${m.rev && adm() ? ' <em class="tag">تحديث مقترح</em>' : ""}` : `<span class="mwpend">${esc(m.t)}</span>${adm() && m.skip ? ` <small class="mut">(${esc(m.skip)})</small>` : ""}`}</li>`).join("")}</ol></div>`).join("")}</details>`).join("")}</div>`);
    if (typeof MSB !== "undefined") MSB.encBlock($("#msbenc"), k);
  }
  const admBar = (k, t) => `<div class="mwadm card"><b>🛡️ الإدارة:</b> <button class="btn s p" data-mw="q" data-k="${k}" data-n="20">حرّر ٢٠ مسألة تالية</button> <button class="btn s" data-mw="q" data-k="${k}" data-n="60">٦٠ مسألة</button> <button class="btn s" data-mw="plan" data-k="${k}">${t ? "إعادة المخطط" : "إعداد المخطط"}</button>${t && !t.ok ? ` <button class="btn s" data-mw="tok" data-k="${k}">اعتماد المخطط</button>` : ""} <span class="mut">التعديل اليدوي: data/mawsua/${k}/_tree.json</span> <span class="mwst mut"></span></div>`;

  async function art(k, id, q) {
    q = q || {}; const t = await tree(k), L = flat(t), i = L.findIndex(m => m.id === id), m = L[i];
    // تحديث مقترح لمادة معتمدة من مصادر جديدة (tools/mawsua.py grow): المنشور باقٍ، والإدارة تعرض التحديث وتعتمده أو ترفضه
    const NE = m && m.rev && adm() ? await getJ(R + k + "/e/" + id + ".new.json") : null;
    let E = m && m.e ? await entry(k, id) : null; const showNew = NE && q.rev; if (showNew) E = NE;
    const I = await getJ(R + "_index.json"), x = ((I || {}).items || []).find(y => y.k === k) || { n: k };
    if (!E || !(E.ok || m.ok || adm())) return view(crumbs([x.n, "#/mawsua/" + k]) + '<div class="note">هذه المسألة قيد التحرير والمراجعة.</div>');
    const tags = Object.keys(E.src || {}), num = Object.fromEntries(tags.map((g, n) => [g, n + 1])), sup = c => c.map(g => `<button type="button" class="mwfn linkbtn" data-mw="fn" data-n="${num[g]}" title="${esc(E.src[g].t)}">${toAr(num[g])}</button>`).join("");
    const where = s => `«${esc(s.t)}»${s.a ? " — " + esc(s.a) : ""}، ص ${toAr(s.p)}`;
    const prev = L.slice(0, i).reverse().find(vis), next = L.slice(i + 1).find(vis), seeL = (E.see || []).map(s => L.find(y => norm(y.t) === norm(s))).filter(y => y && vis(y) && y.id !== id);
    view(crumbs([x.n, "#/mawsua/" + k], [m.bab, "#/mawsua/" + k + "?b=" + (m.bi + 1)]) + `<article class="mwart">
      <p class="mut">${esc(m.bab)} › ${esc(m.fasl)}</p><h2>${esc(E.t)}</h2>${E.ok || m.ok ? "" : '<p class="note">مسودة تنتظر المراجعة العلمية والاعتماد.</p>'}
      ${NE ? `<div class="note mwrev">${ic("history", 18)} ${showNew ? "تعرض الآن <b>التحديث المقترح</b>" : "لهذه المادة <b>تحديث مقترح</b>"} من مصادر جديدة لمشايخ الدعوة (${esc(NE.built || "")})${(NE.new || []).length ? ": " + NE.new.map(b => `«${esc(((typeof B === "function" && B(b)) || {}).title || b)}»`).join("، ") : ""}.
        <div class="row">${showNew ? `<a class="btn s" href="#/mawsua/${k}/${encodeURIComponent(id)}">عرض المنشور</a>` : `<a class="btn s" href="#/mawsua/${k}/${encodeURIComponent(id)}?rev=1">عرض التحديث</a>`}<button class="btn s p" data-mw="rev" data-k="${k}" data-id="${esc(id)}">✓ اعتماد التحديث ونشره</button><button class="btn s" data-mw="norev" data-k="${k}" data-id="${esc(id)}">رفض التحديث</button> <span class="mwst mut"></span></div></div>` : ""}
      ${E.lead ? `<p class="mwlead">${esc(E.lead)}</p>` : ""}
      ${(E.s || []).map(s => `<section><h3>${esc(s.h)}</h3>${s.p.map(p => `<p>${esc(p.t)}${sup(p.c)}</p>`).join("")}</section>`).join("")}
      ${(E.q || []).length ? `<section><h3>نصوص مختارة</h3>${E.q.map(q => `<blockquote class="mwq">«${esc(q.t)}» <small>— ${where(E.src[q.c])} <a href="#/book/${esc(E.src[q.c].b)}/${E.src[q.c].p}?h=${encodeURIComponent(q.t.slice(0, 40))}">موضعه</a></small></blockquote>`).join("")}</section>` : ""}
      <section class="mwsrc"><h3>المصادر</h3><ol>${tags.map(g => `<li id="mwsrc-${num[g]}"><span class="tag">${E.src[g].k === "d" ? "مشايخ الدعوة" : "مرجع"}</span> <a href="#/book/${esc(E.src[g].b)}/${E.src[g].p}">${where(E.src[g])}</a></li>`).join("")}</ol></section>
      ${seeL.length ? `<p><b>مسائل ذات صلة:</b> ${seeL.map(y => `<a class="chip" href="#/mawsua/${k}/${y.id}">${esc(y.t)}</a>`).join(" ")}</p>` : ""}
      <div class="row"><button class="btn s" data-mw="copy">نسخ المادة بالعزو</button>${adm() && !(E.ok || m.ok) ? `<button class="btn s p" data-mw="ok" data-k="${k}" data-id="${esc(id)}">✓ اعتماد المادة ونشرها</button>` : ""}${adm() ? `<button class="btn s" data-mw="redo" data-k="${k}" data-id="${esc(id)}">إعادة التحرير</button>` : ""} <span class="mwst mut"></span></div>
      <nav class="mwnav">${prev ? `<a href="#/mawsua/${k}/${prev.id}">→ ${esc(prev.t)}</a>` : "<span></span>"}${next ? `<a href="#/mawsua/${k}/${next.id}">${esc(next.t)} ←</a>` : ""}</nav></article>`);
    window.__mwE = E;
  }
  function show(q, k, id, l) { q = q || {}; if (!k) return home(q); if (id === "test" && typeof MSB !== "undefined") return MSB.show(q, k, l); if (!id) return enc(k, q); return art(k, decodeURIComponent(id), q); }

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
      else if (a === "rev" || a === "norev") { const id = el.dataset.id, np = R + k + "/e/" + id + ".new.json";
        if (a === "rev") { const N = JSON.parse((await GH.get(np)).text); await GH.editJSON(R + k + "/e/" + id + ".json", () => Object.assign(N, { ok: 1, okAt: today() }), "الموسوعات: اعتماد تحديث مادة"); }
        await GH.del(np, "الموسوعات: " + (a === "rev" ? "اعتماد" : "رفض") + " تحديث مقترح");
        await GH.editJSON(tp, o => { each(o, m => { if (m.id === id) delete m.rev; }); return o; }, "الموسوعات: تحديث مسألة");
        TR[k] = null; EN[id] = null; st.textContent = a === "rev" ? "✓ نُشر التحديث" : "✓ رُفض التحديث"; }
      else if (a === "ok" || a === "redo") { const id = el.dataset.id;
        if (a === "ok") await GH.editJSON(R + k + "/e/" + id + ".json", o => Object.assign(o, { ok: 1, okAt: today() }), "الموسوعات: اعتماد مادة");
        await GH.editJSON(tp, o => { each(o, m => { if (m.id === id) { if (a === "ok") m.ok = 1; else { delete m.skip; if (!m.ok) delete m.e; } } }); return o; }, "الموسوعات: " + (a === "ok" ? "اعتماد" : "إعادة تحرير") + " مسألة");
        if (a === "redo") await GH.editJSON(R + "_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).concat([{ k, do: "build", n: 1, ids: [id] }]); return o; }, "الموسوعات: إعادة تحرير", true);
        TR[k] = null; EN[id] = null; st.textContent = a === "ok" ? "✓ اعتُمدت ونُشرت" : "✓ أُعيدت إلى طابور التحرير"; }
    } catch (x) { st.textContent = x.message; }
  });
  return { show };
})();
