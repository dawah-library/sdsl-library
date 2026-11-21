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
  // مصادر المقاطع: كل محتوى الطلائع جاهزًا للاختيار (بلا كتابة نص)، والسيناريو والأسلوب والمدة من الذكاء الاصطناعي
  const SRCS = [["__ls", "📘 دروس كتب المنهج (الأساس، البنيان، البداية)"], ["__sup", "🌱 قصص وتوجيهات ومقالات تربوية للمرحلة"], ["__un", "📙 وحدات «المنة»: الاتباع والتزكية"], ["__par", "👪 للوالدين والمربين"], ["__qs", "📚 قصص الأنبياء والصحابة والتابعين"], ["", "✍️ نص حر (فقرة أو موضوع)"]];
  async function form() {
    return `<section class="card tvform"><h3>🛠️ صناعة مقطع مرئي من محتوى الطلائع (للإدارة وفريق الطلائع)</h3>
      <p class="mut">اختر المادة من محتوى القسم، فيقرأها الذكاء الاصطناعي ويختار لها أنسب أسلوب عرض (قصة، حوار بشخصيات وأصوات، شرح بأمثلة، سؤال وجواب، خطوات عملية…) ومدتها وعدد مشاهدها بحسب المادة والمرحلة، ثم تُراجع المسودة في <a href="#/video">صفحة الفيديوهات</a> وتُعتمد قبل ظهورها للأطفال.</p>
      <form data-form="tvreq"><div class="row"><label>المادة<select name="src">${SRCS.map(([v, n], i) => `<option value="${v}"${i ? "" : " selected"}>${n}</option>`).join("")}</select></label>
      <label>المرحلة<select name="age">${AGES.map(([a, n]) => `<option value="${a}"${a === "t2" ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>القسم<select name="g"><option value="">البنين والبنات</option><option value="b">البنين</option><option value="g">البنات</option></select></label></div>
      <div data-tvls>${await lsPicker()}</div><div data-tvany hidden></div>
      <div data-tvtext hidden><label>العنوان<input name="title" maxlength="80" placeholder="مثال: آداب الطعام"></label><label>النص<textarea name="text" rows="6" placeholder="الصق الفقرة أو الموضوع من كتب المكتبة"></textarea></label></div>
      <div class="row"><label>السيناريو والمدة<select name="plan"><option value="auto">يختارهما الذكاء الاصطناعي بحسب المادة والمرحلة (مستحسن)</option><option value="fixed">الإعداد الثابت للمرحلة</option></select></label>
      <label>المقاس<select name="asp"><option value="16:9">أفقي ١٦:٩</option><option value="9:16">عمودي للهاتف ٩:١٦</option><option value="both">كلاهما</option></select></label></div>
      <label class="inl"><input type="checkbox" name="cartoon" checked> رسوم كرتونية تعليمية (حتى ١٥ سنة، وتُمنع آليًّا في قصص الأنبياء والصحابة ودروس القرآن)</label>
      <label class="inl"><input type="checkbox" name="script" checked> إعداد السيناريو أولًا للمراجعة قبل الإخراج</label>
      <button class="btn p">أرسل إلى الإنتاج</button> <span id="tvst" class="mut" role="status"></span></form></section>`; }
  // اختيار الدروس: السلسلة ← المستوى (المجلد) ← دروسه مصنفة بموادها، ومرحلة المقطع تتبع المستوى
  let MJ = null; const mjs = async () => MJ || (MJ = typeof TALA !== "undefined" && TALA.mj ? await TALA.mj() : null);
  const pick = (x, name, type) => `<label class="inl tvl1"><input type="${type || "checkbox"}" name="${name || "ls"}" value="${esc(typeof x.v === "string" ? x.v : JSON.stringify(x.v))}"> ${esc(x.t)}${x.m ? ` <span class="mut">${esc(x.m)}</span>` : ""}</label>`;
  const grp = (t, items, open) => items.length ? `<details class="mjsub"${open ? " open" : ""}><summary><b>${esc(t)}</b> <span class="mut">(${toAr(items.length)})</span></summary>${items.join("")}</details>` : "";
  const artItem = b => ({ t: b.title, m: (A(b.authorId) || {}).name || "", v: { b: b.id, p: 1, z: 99, t: b.title } });
  // كتاب موسوم للمرحلة: فصوله من فهرسه؛ والمقال كله مادة واحدة
  const bookItems = async b => { if (isArt(b)) return [artItem(b)]; let full = b; try { full = await loadBook(b.id); } catch (e) { }
    const toc = (full.toc || []).filter(t => t.p).sort((x, y) => x.p - y.p); if (!toc.length) return [{ t: b.title, v: { b: b.id, p: 1, z: 10, t: b.title } }];
    return toc.slice(0, 40).map((t, i) => ({ t: String(t.t).slice(0, 80), m: "ص " + toAr(t.p), v: { b: b.id, p: t.p, z: Math.min(((toc[i + 1] || {}).p || t.p + 10) - 1, t.p + 10), t: String(t.t).slice(0, 80) } })); };
  let SEQ = 0;
  async function fillAny(f) {
    const my = ++SEQ, box = f.querySelector("[data-tvany]"), src = f.src.value, a = f.age.value, M = await mjs(); if (!box) return;
    box.innerHTML = '<p class="mut">جارٍ التحميل…</p>'; let h = "";
    if (src === "__sup") {
      h += ((M && M.support && M.support[a]) || []).map(([g, ids]) => grp(g, ids.map(id => B(id)).filter(Boolean).map(b => pick(artItem(b))), true)).join("");
      const tagged = lib.books.filter(b => !b.hidden && (b.tags || []).includes("tala:" + a) && (!f.g.value || !(b.tags || []).some(t => /^tala:[bg]$/.test(t)) || (b.tags || []).includes("tala:" + f.g.value)));
      const arts = tagged.filter(b => isArt(b)), bks = tagged.filter(b => !isArt(b));
      h += grp("📄 مقالات وموضوعات للمرحلة", arts.slice(0, 60).map(b => pick(artItem(b))), false);
      h += bks.slice(0, 40).map(b => `<details class="mjsub" data-tvbk="${esc(b.id)}"><summary><b>📗 ${esc(b.setTitle || b.title)}${b.vol ? " — ج" + toAr(b.vol) : ""}</b> <span class="mut">(افتح لاختيار فصل)</span></summary><p class="mut">…</p></details>`).join("");
    } else if (src === "__un") h = ((M && M.units && M.units[a]) || []).map(u => grp(u.t, u.ls.map(l => pick({ t: l.t, m: "ص " + toAr(l.p) + "–" + toAr(l.to), v: { b: u.b, p: l.p, z: l.to, t: l.t } })), true)).join("");
    else if (src === "__par") h = grp("للوالدين والمربين", ((M && M.parents) || []).map(id => B(id)).filter(Boolean).map(b => pick(artItem(b))), true);
    else if (src === "__qs") { const Q = await stories(); h = `<div class="tvqs">${(Q.items || []).map(x => pick({ t: (x.ic || "") + " " + x.n, v: x.id }, "qs", "radio")).join("")}</div><p class="mut">قصص الأنبياء والصحابة والتابعين تُعرض بالمناظر والخط وحدها بلا شخصيات.</p>`; }
    if (my !== SEQ) return;  // اختيار أحدث سبق هذا التحميل
    box.innerHTML = h ? (src === "__qs" ? "" : '<p class="mut">اختر مادة واحدة أو حتى أربعًا (يُصنع منها مقطع واحد).</p>') + h : '<p class="note">لا محتوى في هذا الباب لهذه المرحلة بعد.</p>'; }
  // فصول الكتاب الموسوم تُحمَّل عند فتحه فقط
  document.addEventListener("toggle", async e => { const d = e.target; if (!d.matches || !d.matches("[data-tvbk]") || !d.open || d.dataset.f) return; d.dataset.f = 1;
    const b = B(d.dataset.tvbk); if (!b) return; const items = await bookItems(b); d.querySelector("p").outerHTML = items.map(x => pick(x)).join(""); }, true);
  async function lsPicker() { const M = await mjs(); if (!M) return '<p class="mut">المنهج غير متاح الآن.</p>';
    return `<div class="row"><label>الكتاب<select name="ser">${M.series.map(x => `<option value="${esc(x.k)}">${esc(x.t)} — ${esc(x.for)}</option>`).join("")}</select></label><label>المستوى<select name="lv"></select></label></div><div class="tvlsl" data-tvlsl><p class="mut">اختر المستوى لتظهر دروسه.</p></div>`; }
  async function fillLv(f) { const M = await mjs(), x = M && M.series.find(y => y.k === f.ser.value), sel = f.lv, box = f.querySelector("[data-tvlsl]"); if (!x || !sel) return;
    const vols = x.set ? lib.books.filter(b => b.set === x.set && !b.hidden).sort((a, b) => (a.vol || 0) - (b.vol || 0)) : [];
    if (!vols.length) { sel.innerHTML = ""; box.innerHTML = `<p class="note">«${esc(x.t)}» يُضاف إلى المكتبة قريبًا، ثم تظهر دروسه هنا.</p>`; return; }
    sel.innerHTML = vols.map(b => { const l = (x.levels || []).find(y => +y.vol === +b.vol); return `<option value="${esc(b.id)}" data-st="${esc((l && l.stage) || x.stage || "t2")}">${esc(l ? l.t + " (" + l.age + ")" : "ج " + toAr(b.vol || 1))}</option>`; }).join(""); fillLs(f); }
  async function fillLs(f) { const box = f.querySelector("[data-tvlsl]"), o = f.lv && f.lv.selectedOptions[0]; if (!o) return; box.innerHTML = '<p class="mut">جارٍ تحميل الدروس…</p>';
    if (f.age && o.dataset.st) f.age.value = o.dataset.st;
    const L = await TALA.mjLessons(o.value), by = {}; L.forEach(x => (by[x.s] = by[x.s] || { n: x.sn, i: x.si, l: [] }).l.push(x));
    box.innerHTML = L.length ? `<p class="mut">اختر درسًا أو حتى أربعة دروس (يُصنع منها مقطع واحد).</p>` + Object.values(by).map(g => grp(g.i + " " + g.n, g.l.map(x => pick({ t: x.t, m: "ص " + toAr(x.p), v: { b: o.value, p: x.p, z: x.z, t: x.t, s: x.s } })), true)).join("") : '<p class="note">لم تُقسَّم دروس هذا المستوى بعد (قيد التدقيق).</p>'; }
  document.addEventListener("change", e => { const f = e.target.closest("[data-form=tvreq]"); if (!f) return; const n = e.target.name;
    if (n === "src" || ((n === "age" || n === "g") && f.src.value !== "__ls")) { const v = f.src.value, t = f.querySelector("[data-tvtext]"), l = f.querySelector("[data-tvls]"), an = f.querySelector("[data-tvany]");
      if (t) t.hidden = v !== ""; if (l) l.hidden = v !== "__ls"; if (an) an.hidden = !v || v === "__ls"; if (v && v !== "__ls") fillAny(f); }
    else if (n === "ser") fillLv(f); else if (n === "lv") fillLs(f);
    else if (n === "ls" && f.querySelectorAll("[name=ls]:checked").length > 4) { e.target.checked = false; toast("أربع مواد على الأكثر في المقطع الواحد"); } });
  new MutationObserver(() => { const f = document.querySelector("[data-form=tvreq]"); if (f && f.lv && !f.dataset.lvf) { f.dataset.lvf = 1; fillLv(f); } }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-form=tvreq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), st = $("#tvst"), kind = String(fd.get("src") || ""), text = String(fd.get("text") || "").trim(), title = String(fd.get("title") || "").trim();
    const ls = kind && kind !== "__qs" ? fd.getAll("ls").map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean) : [], qs = kind === "__qs" ? String(fd.get("qs") || "") : "";
    if (kind === "__qs" && !qs) { st.textContent = "اختر قصة."; return; }
    if (kind && kind !== "__qs" && !ls.length) { st.textContent = "اختر مادة واحدة على الأقل."; return; }
    if (!kind && (text.length < 80 || !title)) { st.textContent = "اكتب عنوانًا ونصًّا لا يقل عن سطرين."; return; }
    if (typeof GH === "undefined" || !(GH.on || GH.proxied)) { st.textContent = "فعّل الإدارة المباشرة أولًا."; return; }
    const age = String(fd.get("age")), asp = String(fd.get("asp")), it = { id: ls.length ? "tala-l" + Date.now().toString(36) : qs ? "tala-" + qs : "tala-t" + Date.now().toString(36), age, g: String(fd.get("g") || ""), aspects: asp === "both" ? ["16:9", "9:16"] : [asp], cartoon: fd.get("cartoon") ? 1 : 0, tone: "warm", aud: "kids", sfx: 0, plan: String(fd.get("plan") || "auto") };
    if (!kind) { it.text = text.slice(0, 12000); it.title = title.slice(0, 80); }
    if (ls.length) { it.lessons = ls; it.ser = kind === "__ls" ? String(fd.get("ser") || "") : kind.slice(2); it.title = ls.length === 1 ? ls[0].t : ls.map(x => x.t).slice(0, 3).join("، "); }
    if (fd.get("script")) it.phase = "script";
    st.textContent = "جارٍ الإرسال…";
    try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "الطلائع: طلب مقطع مرئي — " + (it.title || title || qs)); st.textContent = "✓ أُرسل؛ يبدأ الإنتاج خلال دقائق، وتظهر المسودة في صفحة الفيديوهات، وبعد اعتمادها يظهر المقطع في مرحلته وعند مادته."; f.querySelectorAll("[name=ls]:checked,[name=qs]:checked").forEach(x => x.checked = false); }
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
