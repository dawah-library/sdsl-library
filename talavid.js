/* المقاطع المرئية للطلائع (طلب المدير، ٢١ نوفمبر ٢٠٢٦): تحويل القصص والفقرات والموضوعات العلمية إلى مقاطع مرئية بمونتاج وإخراج
   مناسب لكل مرحلة عمرية، خدمةً ونشاطًا من خدمات قسم الطلائع (#/talaea/video).
   الإنتاج بمحرك «فيديوهات الكتب» نفسه (tools/book-video.py ← video.yml) مستفيدًا من إعداداته وتجاربه: مسودة النص قبل الإخراج، وقاموس النطق،
   والانتقالات الهادئة، وبلا موسيقى، والاعتماد قبل النشر؛ وإعداد كل مرحلة (TALA_AGE): عدد المشاهد وطول العبارة ولغة الراوي.
   الضوابط الشرعية (docs/tala-media.md) مبنية على فتاوى الشيخ ياسر برهامي في المكتبة. */
const TVID = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + p;
  const getj = async (p, d) => { try { const r = await fetch(RAW(p) + "?t=" + Math.floor(Date.now() / 60e3)); return r.ok ? await r.json() : d; } catch (e) { try { const r = await fetch(p); return r.ok ? await r.json() : d; } catch (x) { return d; } } };
  const PROXY = () => /dawahlibrary\.org$|\.pages\.dev$/.test(location.hostname);
  const url = (bid, f) => PROXY() ? location.origin + "/au/v/" + bid + "/" + f : "https://github.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/releases/download/video-" + bid + "/" + f;
  const adm = () => (typeof isAdmin === "function" && isAdmin()) || (typeof Cloud !== "undefined" && Cloud.staff && Cloud.staff()) || (typeof can === "function" && (can("tala") || can("video")));
  const AGES = [["t1", "٥–٨ سنوات"], ["t2", "٩–١٢ سنة"], ["t3", "١٢–١٥ سنة"], ["t4", "١٥–٢٠ سنة"]];
  let LIST = null, QS = null;
  const list = async f => (LIST && !f) ? LIST : (LIST = await getj("data/video/_list.json", {}));
  const stories = async () => QS || (QS = await getj("data/tala-qasas.json", { items: [] }));
  const vids = async (age, g) => Object.entries(await list()).filter(([id]) => id.startsWith("tala-")).flatMap(([id, l]) => l.map(v => Object.assign({ id }, v)))
    .filter(v => (v.ok || adm()) && (!age || !v.tala || v.tala === age) && (!g || !v.g || v.g === g)).reverse();
  const card = v => `<figure class="tvc"><video controls preload="none" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : ""}></video>
    <figcaption><b>${esc(v.t || "")}</b>${(v.ls || []).length ? `<span class="mut">📘 من ${v.ls.slice(0, 3).map(r => { const [b, p] = r.split(":"), bk = B(b); return `<a href="#/book/${esc(b)}/${esc(p)}">${esc(bk ? (bk.setTitle || bk.title) + (bk.vol ? " ج" + toAr(bk.vol) : "") : b)} ص ${toAr(+p)}</a>`; }).join("، ")}</span>` : ""}<span class="mut">${esc((AGES.find(a => a[0] === v.tala) || [])[1] || "")}${v.g ? " • " + (v.g === "g" ? "البنات" : "البنين") : ""} • ${toAr(Math.round((v.d || 0) / 60) || 1)} د${v.cartoon ? " • رسوم تعليمية" : ""}${v.ok ? "" : ' • <em class="tag">بانتظار الاعتماد</em>'}</span></figcaption></figure>`;
  // الضوابط الشرعية للرسوم والمقاطع المرئية (بفتاوى الشيخ ياسر برهامي من المكتبة)
  const RULES = [["تجوز الرسوم الكرتونية التعليمية للأطفال لحاجتهم إلى اللعب وتوسعة المدارك، قياسًا على إقرار النبي ﷺ لعب عائشة رضي الله عنها بالبنات وفرسها ذي الجناحين.", "sv100"],
    ["الرسوم المتحركة للأطفال إذا قُصد بها التربية الإسلامية وتعليم ما ينفع فهي جائزة.", "sv2046"], ["كرتون الأطفال مباح للنصوص الدالة على لعب البنات؛ وتصوير الفيديو ليس رسمًا.", "sv2240"],
    ["لا يجوز قطعًا تشخيص الأنبياء بالصور الكرتونية؛ فقصص الأنبياء والصحابة والتابعين تُعرض بالمناظر والخط وحدها بلا شخصيات.", "sv1428"],
    ["لا تُركَّب الرسوم على تلاوة القرآن؛ لأن الله أمر بالإنصات.", "sv22238"], ["الكبار لهم المناظر والنصوص؛ «أما الكبار فالوقت أغلى من ذلك»، فمرحلة ١٥–٢٠ بلا رسوم شخصيات.", "sv100"],
    ["لا تُطبع صور الشخصيات ولا تُعلَّق ولا توضع على الملابس؛ فالإذن للعب المُهان لا للتعظيم.", "sv3316"], ["بلا موسيقى، وباللباس الساتر، وبلا ما يخدش الحياء.", "sv22149"]];
  const rules = () => `<details class="card tvrules"><summary><b>⚖️ الضوابط الشرعية للمقاطع المرئية والرسوم</b></summary><ul>${RULES.map(([t, id]) => `<li>${esc(t)} <a href="#/book/${id}/1">(الفتوى)</a></li>`).join("")}</ul><p class="mut">من فتاوى الشيخ ياسر برهامي على موقع صوت السلف في المكتبة.</p></details>`;
  async function view(q, C) {
    const k = (C.kid() || {}).track || "", g = C.sx() || "", age = q.l ? "" : (q.a || k), L = (await vids(age, g)).filter(v => !q.l || (v.ls || []).includes(q.l));
    C.view_(C.head("المقاطع المرئية", true) + `<h2 class="talat">🎬 المقاطع المرئية</h2><p>قصص وفقرات وموضوعات علمية في مقاطع مرئية قصيرة بمونتاج وإخراج يناسب كل مرحلة عمرية.</p>
      <nav class="chips">${[["", "كل المراحل"]].concat(AGES).map(([a, n]) => `<a class="chip${a === age ? " on" : ""}" href="#/talaea/video${a ? "?a=" + a : "?a="}">${n}</a>`).join("")}</nav>
      <div class="tvgrid">${L.map(card).join("") || '<div class="note">لا مقاطع معتمدة لهذه المرحلة بعد؛ تُضاف تباعًا بإذن الله.</div>'}</div>
      ${rules()}${adm() ? await form() : ""}</div>`);
  }
  async function form() { const Q = await stories();
    return `<section class="card tvform"><h3>🛠️ تحويل قصة أو فقرة أو موضوع إلى مقطع مرئي (للإدارة)</h3>
      <p class="mut">ينتج بمحرك «فيديوهات الكتب» بإعداد المرحلة: عدد المشاهد، وطول عبارة الراوي، ولغته، وألوان القسم؛ والمسودة تُراجع في <a href="#/video">صفحة الفيديوهات</a> ثم تُعتمد قبل ظهورها للأطفال.</p>
      <form data-form="tvreq"><label>المصدر<select name="src"><option value="__ls" selected>📘 درس أو دروس من كتب المنهج (الأساس، البنيان، البداية) — بلا كتابة نص</option><option value="">نص حر (فقرة أو موضوع علمي)</option>${(Q.items || []).map(x => `<option value="${esc(x.id)}">${esc(x.ic || "")} ${esc(x.n)}</option>`).join("")}</select></label>
      <div data-tvls>${await lsPicker()}</div>
      <div data-tvtext hidden><label>العنوان<input name="title" maxlength="80" placeholder="مثال: آداب الطعام"></label><label>النص<textarea name="text" rows="6" placeholder="الصق الفقرة أو الموضوع من كتب المكتبة"></textarea></label></div>
      <div class="row"><label>المرحلة<select name="age">${AGES.map(([a, n]) => `<option value="${a}"${a === "t2" ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>القسم<select name="g"><option value="">الجميع</option><option value="b">البنين</option><option value="g">البنات</option></select></label>
      <label>المقاس<select name="asp"><option value="16:9">أفقي ١٦:٩</option><option value="9:16">عمودي للهاتف ٩:١٦</option><option value="both">كلاهما</option></select></label></div>
      <label class="inl"><input type="checkbox" name="cartoon" checked> رسوم كرتونية تعليمية (للمراحل حتى ١٥ سنة، وفي غير قصص الأنبياء والصحابة)</label>
      <label class="inl"><input type="checkbox" name="script" checked> إعداد النص أولًا للمراجعة (مونتاج) قبل الإخراج</label>
      <button class="btn p">أرسل إلى الإنتاج</button> <span id="tvst" class="mut" role="status"></span></form></section>`; }
  // اختيار الدروس: السلسلة ← المستوى (المجلد) ← دروسه مصنفة بموادها، ومرحلة المقطع تتبع المستوى
  let MJ = null; const mjs = async () => MJ || (MJ = typeof TALA !== "undefined" && TALA.mj ? await TALA.mj() : null);
  async function lsPicker() { const M = await mjs(); if (!M) return '<p class="mut">المنهج غير متاح الآن.</p>';
    return `<div class="row"><label>الكتاب<select name="ser">${M.series.map(x => `<option value="${esc(x.k)}">${esc(x.t)} — ${esc(x.for)}</option>`).join("")}</select></label><label>المستوى<select name="lv"></select></label></div><div class="tvlsl" data-tvlsl><p class="mut">اختر المستوى لتظهر دروسه.</p></div>`; }
  async function fillLv(f) { const M = await mjs(), x = M && M.series.find(y => y.k === f.ser.value), sel = f.lv, box = f.querySelector("[data-tvlsl]"); if (!x || !sel) return;
    const vols = x.set ? lib.books.filter(b => b.set === x.set && !b.hidden).sort((a, b) => (a.vol || 0) - (b.vol || 0)) : [];
    if (!vols.length) { sel.innerHTML = ""; box.innerHTML = `<p class="note">«${esc(x.t)}» يُضاف إلى المكتبة قريبًا، ثم تظهر دروسه هنا.</p>`; return; }
    sel.innerHTML = vols.map(b => { const l = (x.levels || []).find(y => +y.vol === +b.vol); return `<option value="${esc(b.id)}" data-st="${esc((l && l.stage) || x.stage || "t2")}">${esc(l ? l.t + " (" + l.age + ")" : "ج " + toAr(b.vol || 1))}</option>`; }).join(""); fillLs(f); }
  async function fillLs(f) { const box = f.querySelector("[data-tvlsl]"), o = f.lv && f.lv.selectedOptions[0]; if (!o) return; box.innerHTML = '<p class="mut">جارٍ تحميل الدروس…</p>';
    if (f.age && o.dataset.st) f.age.value = o.dataset.st;
    const L = await TALA.mjLessons(o.value), by = {}; L.forEach(x => (by[x.s] = by[x.s] || { n: x.sn, i: x.si, l: [] }).l.push(x));
    box.innerHTML = L.length ? `<p class="mut">اختر درسًا أو حتى أربعة دروس (يُصنع منها مقطع واحد).</p>` + Object.values(by).map(g => `<details class="mjsub" open><summary>${g.i} <b>${esc(g.n)}</b> <span class="mut">(${toAr(g.l.length)})</span></summary>${g.l.map(x => `<label class="inl tvl1"><input type="checkbox" name="ls" value="${esc(JSON.stringify({ b: o.value, p: x.p, z: x.z, t: x.t, s: x.s }))}"> ${esc(x.t)} <span class="mut">ص ${toAr(x.p)}</span></label>`).join("")}</details>`).join("") : '<p class="note">لم تُقسَّم دروس هذا المستوى بعد (قيد التدقيق).</p>'; }
  document.addEventListener("change", e => { const f = e.target.closest("[data-form=tvreq]"); if (!f) return;
    if (e.target.name === "src") { const t = f.querySelector("[data-tvtext]"), l = f.querySelector("[data-tvls]"); if (t) t.hidden = e.target.value !== ""; if (l) l.hidden = e.target.value !== "__ls"; }
    else if (e.target.name === "ser") fillLv(f); else if (e.target.name === "lv") fillLs(f);
    else if (e.target.name === "ls" && f.querySelectorAll("[name=ls]:checked").length > 4) { e.target.checked = false; toast("أربعة دروس على الأكثر في المقطع الواحد"); } });
  new MutationObserver(() => { const f = document.querySelector("[data-form=tvreq]"); if (f && f.lv && !f.dataset.lvf) { f.dataset.lvf = 1; fillLv(f); } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-form=tvreq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), st = $("#tvst"), src = String(fd.get("src") || ""), text = String(fd.get("text") || "").trim(), title = String(fd.get("title") || "").trim();
    const ls = src === "__ls" ? fd.getAll("ls").map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean) : [];
    if (src === "__ls" && !ls.length) { st.textContent = "اختر درسًا واحدًا على الأقل."; return; }
    if (!src && (text.length < 80 || !title)) { st.textContent = "اكتب عنوانًا ونصًّا لا يقل عن سطرين."; return; }
    if (typeof GH === "undefined" || !(GH.on || GH.proxied)) { st.textContent = "فعّل الإدارة المباشرة أولًا."; return; }
    const age = String(fd.get("age")), asp = String(fd.get("asp")), it = { id: ls.length ? "tala-l" + Date.now().toString(36) : src ? "tala-" + src : "tala-t" + Date.now().toString(36), age, g: String(fd.get("g") || ""), aspects: asp === "both" ? ["16:9", "9:16"] : [asp], cartoon: fd.get("cartoon") ? 1 : 0, tone: "warm", aud: "kids", sfx: 0 };
    if (!src) { it.text = text.slice(0, 12000); it.title = title.slice(0, 80); }
    if (ls.length) { it.lessons = ls; it.ser = String(fd.get("ser") || ""); it.title = ls.length === 1 ? ls[0].t : "دروس: " + ls.map(x => x.t).slice(0, 3).join("، "); }
    if (fd.get("script")) it.phase = "script";
    st.textContent = "جارٍ الإرسال…";
    try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "الطلائع: طلب مقطع مرئي — " + (it.title || title || src)); st.textContent = "✓ أُرسل؛ يبدأ الإنتاج خلال دقائق، وتظهر المسودة في صفحة الفيديوهات، وبعد اعتمادها يظهر المقطع في مرحلته وعند دروسه في المنهج."; f.querySelectorAll("[name=ls]:checked").forEach(x => x.checked = false); }
    catch (x) { st.textContent = "تعذر: " + x.message; } }, true);
  // داخل صفحة القصة: المقطع المعتمد لهذه القصة ومرحلتها، وزر طلبه للإدارة
  async function storyBlock(id, age) { const L = ((await list())["tala-" + id] || []).filter(v => (v.ok || adm()) && (!v.tala || v.tala === age));
    if (L.length) return `<div class="card"><h3>🎬 شاهد القصة مرئية</h3>${L.slice(-1).map(v => card(Object.assign({ id: "tala-" + id }, v))).join("")}</div>`;
    return adm() ? `<p><button class="btn s" data-act="tvstory" data-id="${esc(id)}" data-a="${esc(age)}">🎬 حوّل القصة إلى مقطع مرئي لهذه المرحلة</button> <span class="mut" id="tvs-${esc(id)}"></span></p>` : ""; }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act=tvstory]"); if (!el) return; const st = document.getElementById("tvs-" + el.dataset.id);
    if (typeof GH === "undefined" || !GH.on) { if (st) st.textContent = "فعّل الإدارة المباشرة أولًا."; return; }
    try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push({ id: "tala-" + el.dataset.id, age: el.dataset.a, aspects: ["16:9"], tone: "warm", aud: "kids", phase: "script" }); return o; }, "الطلائع: مقطع مرئي لقصة " + el.dataset.id);
      el.disabled = true; if (st) st.textContent = "✓ أُرسل؛ تظهر مسودته في صفحة الفيديوهات."; } catch (x) { if (st) st.textContent = x.message; } });
  // يملأ موضع المقطع في صفحة القصة بعد رسمها (talaqasas.js يضع #tvstory)
  new MutationObserver(() => { const el = document.getElementById("tvstory"); if (!el || el.dataset.f) return; el.dataset.f = 1; storyBlock(el.dataset.id, el.dataset.a).then(h => { if (document.body.contains(el)) el.innerHTML = h; }); }).observe(document.documentElement, { childList: true, subtree: true });
  // علامة 🎬 عند كل درس في المنهج له مقطع (tala.js يضع [data-tvl="كتاب:صفحة"])
  new MutationObserver(async () => { const els = [...document.querySelectorAll("[data-tvl]:not([data-f])")]; if (!els.length) return; els.forEach(e => e.dataset.f = 1);
    const L = await list(), m = new Map(); Object.entries(L).filter(([id]) => id.startsWith("tala-")).forEach(([, l]) => l.forEach(v => (v.ok || adm()) && (v.ls || []).forEach(r => m.set(r, v))));
    els.forEach(e => { const v = m.get(e.dataset.tvl); if (v) e.innerHTML = `<a class="tag" href="#/talaea/video?l=${encodeURIComponent(e.dataset.tvl)}" title="شاهد الدرس مرئيًّا">🎬 مرئي${v.ok ? "" : " (مسودة)"}</a>`; }); }).observe(document.documentElement, { childList: true, subtree: true });
  return { view, storyBlock, rules };
})();
