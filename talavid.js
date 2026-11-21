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
  const adm = () => (typeof isAdmin === "function" && isAdmin()) || (typeof Cloud !== "undefined" && Cloud.staff && Cloud.staff());
  const AGES = [["t1", "٥–٨ سنوات"], ["t2", "٩–١٢ سنة"], ["t3", "١٢–١٥ سنة"], ["t4", "١٥–٢٠ سنة"]];
  let LIST = null, QS = null;
  const list = async f => (LIST && !f) ? LIST : (LIST = await getj("data/video/_list.json", {}));
  const stories = async () => QS || (QS = await getj("data/tala-qasas.json", { items: [] }));
  const vids = async (age, g) => Object.entries(await list()).filter(([id]) => id.startsWith("tala-")).flatMap(([id, l]) => l.map(v => Object.assign({ id }, v)))
    .filter(v => (v.ok || adm()) && (!age || !v.tala || v.tala === age) && (!g || !v.g || v.g === g)).reverse();
  const card = v => `<figure class="tvc"><video controls preload="none" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : ""}></video>
    <figcaption><b>${esc(v.t || "")}</b><span class="mut">${esc((AGES.find(a => a[0] === v.tala) || [])[1] || "")}${v.g ? " • " + (v.g === "g" ? "البنات" : "البنين") : ""} • ${toAr(Math.round((v.d || 0) / 60) || 1)} د${v.cartoon ? " • رسوم تعليمية" : ""}${v.ok ? "" : ' • <em class="tag">بانتظار الاعتماد</em>'}</span></figcaption></figure>`;
  // الضوابط الشرعية للرسوم والمقاطع المرئية (بفتاوى الشيخ ياسر برهامي من المكتبة)
  const RULES = [["تجوز الرسوم الكرتونية التعليمية للأطفال لحاجتهم إلى اللعب وتوسعة المدارك، قياسًا على إقرار النبي ﷺ لعب عائشة رضي الله عنها بالبنات وفرسها ذي الجناحين.", "sv100"],
    ["الرسوم المتحركة للأطفال إذا قُصد بها التربية الإسلامية وتعليم ما ينفع فهي جائزة.", "sv2046"], ["كرتون الأطفال مباح للنصوص الدالة على لعب البنات؛ وتصوير الفيديو ليس رسمًا.", "sv2240"],
    ["لا يجوز قطعًا تشخيص الأنبياء بالصور الكرتونية؛ فقصص الأنبياء والصحابة والتابعين تُعرض بالمناظر والخط وحدها بلا شخصيات.", "sv1428"],
    ["لا تُركَّب الرسوم على تلاوة القرآن؛ لأن الله أمر بالإنصات.", "sv22238"], ["الكبار لهم المناظر والنصوص؛ «أما الكبار فالوقت أغلى من ذلك»، فمرحلة ١٥–٢٠ بلا رسوم شخصيات.", "sv100"],
    ["لا تُطبع صور الشخصيات ولا تُعلَّق ولا توضع على الملابس؛ فالإذن للعب المُهان لا للتعظيم.", "sv3316"], ["بلا موسيقى، وباللباس الساتر، وبلا ما يخدش الحياء.", "sv22149"]];
  const rules = () => `<details class="card tvrules"><summary><b>⚖️ الضوابط الشرعية للمقاطع المرئية والرسوم</b></summary><ul>${RULES.map(([t, id]) => `<li>${esc(t)} <a href="#/book/${id}/1">(الفتوى)</a></li>`).join("")}</ul><p class="mut">من فتاوى الشيخ ياسر برهامي على موقع صوت السلف في المكتبة.</p></details>`;
  async function view(q, C) {
    const k = (C.kid() || {}).track || "", g = C.sx() || "", age = q.a || k, L = await vids(age, g);
    C.view_(C.head("المقاطع المرئية", true) + `<h2 class="talat">🎬 المقاطع المرئية</h2><p>قصص وفقرات وموضوعات علمية في مقاطع مرئية قصيرة بمونتاج وإخراج يناسب كل مرحلة عمرية.</p>
      <nav class="chips">${[["", "كل المراحل"]].concat(AGES).map(([a, n]) => `<a class="chip${a === age ? " on" : ""}" href="#/talaea/video${a ? "?a=" + a : "?a="}">${n}</a>`).join("")}</nav>
      <div class="tvgrid">${L.map(card).join("") || '<div class="note">لا مقاطع معتمدة لهذه المرحلة بعد؛ تُضاف تباعًا بإذن الله.</div>'}</div>
      ${rules()}${adm() ? await form() : ""}</div>`);
  }
  async function form() { const Q = await stories();
    return `<section class="card tvform"><h3>🛠️ تحويل قصة أو فقرة أو موضوع إلى مقطع مرئي (للإدارة)</h3>
      <p class="mut">ينتج بمحرك «فيديوهات الكتب» بإعداد المرحلة: عدد المشاهد، وطول عبارة الراوي، ولغته، وألوان القسم؛ والمسودة تُراجع في <a href="#/video">صفحة الفيديوهات</a> ثم تُعتمد قبل ظهورها للأطفال.</p>
      <form data-form="tvreq"><label>المصدر<select name="src"><option value="">نص حر (فقرة أو موضوع علمي)</option>${(Q.items || []).map(x => `<option value="${esc(x.id)}">${esc(x.ic || "")} ${esc(x.n)}</option>`).join("")}</select></label>
      <div data-tvtext><label>العنوان<input name="title" maxlength="80" placeholder="مثال: آداب الطعام"></label><label>النص<textarea name="text" rows="6" placeholder="الصق الفقرة أو الموضوع من كتب المكتبة"></textarea></label></div>
      <div class="row"><label>المرحلة<select name="age">${AGES.map(([a, n]) => `<option value="${a}"${a === "t2" ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>القسم<select name="g"><option value="">الجميع</option><option value="b">البنين</option><option value="g">البنات</option></select></label>
      <label>المقاس<select name="asp"><option value="16:9">أفقي ١٦:٩</option><option value="9:16">عمودي للهاتف ٩:١٦</option><option value="both">كلاهما</option></select></label></div>
      <label class="inl"><input type="checkbox" name="cartoon" checked> رسوم كرتونية تعليمية (للمراحل حتى ١٥ سنة، وفي غير قصص الأنبياء والصحابة)</label>
      <label class="inl"><input type="checkbox" name="script" checked> إعداد النص أولًا للمراجعة (مونتاج) قبل الإخراج</label>
      <button class="btn p">أرسل إلى الإنتاج</button> <span id="tvst" class="mut" role="status"></span></form></section>`; }
  document.addEventListener("change", e => { const s = e.target.closest("[data-form=tvreq] select[name=src]"); if (!s) return; const t = s.form.querySelector("[data-tvtext]"); if (t) t.hidden = !!s.value; });
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-form=tvreq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), st = $("#tvst"), src = String(fd.get("src") || ""), text = String(fd.get("text") || "").trim(), title = String(fd.get("title") || "").trim();
    if (!src && (text.length < 80 || !title)) { st.textContent = "اكتب عنوانًا ونصًّا لا يقل عن سطرين."; return; }
    if (typeof GH === "undefined" || !GH.on) { st.textContent = "فعّل الإدارة المباشرة أولًا."; return; }
    const age = String(fd.get("age")), asp = String(fd.get("asp")), it = { id: src ? "tala-" + src : "tala-t" + Date.now().toString(36), age, g: String(fd.get("g") || ""), aspects: asp === "both" ? ["16:9", "9:16"] : [asp], cartoon: fd.get("cartoon") ? 1 : 0, tone: "warm", aud: "kids", sfx: 0 };
    if (!src) { it.text = text.slice(0, 12000); it.title = title.slice(0, 80); }
    if (fd.get("script")) it.phase = "script";
    st.textContent = "جارٍ الإرسال…";
    try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "الطلائع: طلب مقطع مرئي — " + (title || src)); st.textContent = "✓ أُرسل؛ يبدأ الإنتاج خلال دقائق، وتظهر المسودة في صفحة الفيديوهات."; f.reset(); }
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
  return { view, storyBlock, rules };
})();
