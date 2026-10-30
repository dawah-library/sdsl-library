/* التعريف بالأعلام والرواة (ب2-21 … ب2-36 من وثيقة التطوير)
   - أثناء القراءة: تحديد الاسم ثم «👤 التعريف بالعلم» في شريط التحديد، أو الضغط المطول على كلمة من الاسم ثم «👤 العلم»
     (من قائمة معاني الكلمات نفسها، دون وظيفة مكررة — ب2-32).
   - المصدر: data/alam (tools/alam.py) من كتب التراجم والجرح والتعديل في المكتبة نفسها؛ يُعرض النص منقولًا بحروفه مع عزوه
     وموضعه، ولا تُنشأ ترجمة ولا يُنسب حكم بلا مصدر (ب2-35). الربط بين الاسم والترجمة آلي بتطابق الاسم ويُنبَّه عليه (ب2-34)،
     وعند تعدد من يحمل الاسم تُعرض الاحتمالات دون جزم (ب2-36)، وإن اختلفت عبارات الأئمة في الراوي يُنبَّه على الخلاف (ب2-33).
   - #/alam: بحث مستقل في الأعلام (ب2-30)، وصفحة العلم تجمع تراجمه وأقوال الأئمة فيه ومواضع ذكره في كتب المكتبة (ب2-31). */
const ALAM = (() => {
  const raw = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/alam/" + p;
  const SH = new Map(); let META = null;
  const SRC = { siyar: "سير أعلام النبلاء", istiab: "الاستيعاب", isaba: "الإصابة", tahdhibtahdhib: "تهذيب التهذيب", taqrib: "تقريب التهذيب", kashif: "الكاشف", mizan: "ميزان الاعتدال", jarhtadil: "الجرح والتعديل", aclamsalaf: "من أعلام السلف", lib: "مؤلفو المكتبة" };
  const KIND = { t: "ترجمة", s: "صحابي", j: "جرح وتعديل", a: "مؤلف في المكتبة" };
  const norm = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^ء-ي\s]/g, " ")
    .replace(/(^|\s)عبد\s+/g, "$1عبد").replace(/(^|\s)(ابي|ابا)(?=\s)/g, "$1ابو").replace(/\s+/g, " ").trim();
  const shardOf = k => { const t = k.split(" "); let w = t.length > 1 && /^(ابو|ابن|ام|بنت)$/.test(t[0]) ? t[1] : t[0]; if (w.startsWith("ال") && w.length > 3) w = w.slice(2);
    const c = w ? (w.length > 1 ? w.slice(0, 2) : w + "_") : "__"; return [...c].map(x => x.codePointAt(0).toString(16).padStart(4, "0")).join("-"); };
  const PK = new Map(), packOf = id => { const p = id.split("."); return p.length < 3 ? p[0] : p[0] + "." + p[1] + "." + Math.floor(+p[2] / 400); };
  const loadPack = k => { if (!PK.has(k)) PK.set(k, fetch(raw("e-" + k + ".json")).then(r => r.ok ? r.json() : {}).catch(() => ({}))); return PK.get(k); };
  async function ents(ids) { const ps = [...new Set(ids.slice(0, 60).map(packOf))], got = await Promise.all(ps.map(loadPack)), all = Object.assign({}, ...got); return ids.slice(0, 60).filter(id => all[id]).map(id => Object.assign({ id }, all[id])); }
  const load = s => { if (!SH.has(s)) SH.set(s, fetch(raw(s + ".json")).then(r => r.ok ? r.json() : { k: {}, m: {} }).catch(() => ({ k: {}, m: {} }))); return SH.get(s); };
  const meta = async () => META || (META = await fetch(raw("_meta.json")).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  const STOP = /^(قال|وقال|عن|وعن|حدثنا|حدثني|اخبرنا|اخبرني|سمعت|روي|رواه|ذكر|ذكره|قاله|الامام|الحافظ|الشيخ|العلامه|شيخ|الاسلام|رضي|رحمه|الله|عنه|عنها|تعالي|و|ف)$/;
  // مفاتيح البحث من النص المحدد: النص كله، ثم بعد حذف ألفاظ الرواية والألقاب، ثم نوافذ متناقصة
  function candidates(text) {
    let t = norm(text).split(" ").filter(Boolean).map(w => w.length > 3 && /^[وفب]/.test(w) && !/^(بن|ابو|ابن)$/.test(w) && /^[وفب](ابو|ابن|عبد|ال)/.test(w) ? w.slice(1) : w);
    while (t.length && STOP.test(t[0])) t.shift(); while (t.length && STOP.test(t[t.length - 1])) t.pop();
    const out = []; for (let n = Math.min(6, t.length); n >= 1; n--) for (let i = 0; i + n <= t.length; i++) { const k = t.slice(i, i + n).join(" "); if (k.length >= (n === 1 ? 4 : 5) && !out.includes(k)) out.push(k); }
    return out.slice(0, 18);
  }
  async function lookup(text) {
    const ks = candidates(text);
    for (const k of ks) { const s = await load(shardOf(k)); const ids = s.k[k];
      if (ids && ids.length) { const es = await ents(ids); return { key: k, q: text, es: rank(es, k), m: s.m[k] || [] }; } }
    for (const k of ks) { const s = await load(shardOf(k)); if (s.m[k]) return { key: k, es: [], m: s.m[k] }; }
    return { key: ks[0] || norm(text), es: [], m: [] };
  }
  // الأقرب: ما يبدأ اسمه بالمفتاح، ثم الأطول ترجمة (الأشهر غالبًا)؛ ومؤلفو المكتبة أولًا عند التطابق التام
  function rank(es, k) { const sc = e => { const n = norm(e.n); return (n === k ? 4 : n.startsWith(k) ? 3 : 1) + (e.s === "lib" && n.includes(k) ? 1 : 0); };
    return es.sort((a, b) => sc(b) - sc(a) || (b.L || 0) - (a.L || 0)); }
  const where = e => e.s === "lib" ? "" : `${esc(SRC[e.s] || e.s)}${e.pl ? "، " + esc(e.pl) : ""}`;
  const open1 = e => e.s === "lib" ? (e.tj ? `#/tarjama/${e.a}` : `#/author/${e.a}`) : `#/book/${encodeURIComponent(e.b)}/${e.p}`;
  function grades(es) { const g = [...new Set(es.filter(e => e.t === "j" && e.g).map(e => e.g))]; return g.length > 1 ? g : null; }
  function entryHtml(e, full) {
    return `<div class="alm"><b>${esc(e.n)}</b> <em class="tag">${KIND[e.t] || ""}</em>${e.d ? `<span class="mut"> • «${esc(e.d)}»</span>` : ""}
      ${e.x ? `<blockquote class="almq">${esc(e.x)}${e.x.length >= 215 ? "…" : ""}<cite>${e.s === "lib" ? "من بيانات المكتبة" : "— " + where(e)}</cite></blockquote>` : ""}
      ${e.r ? `<p class="almr">${e.r.map(r => `<q>${esc(r)}</q>`).join(" ")} <span class="mut">— ${where(e)}</span></p>` : ""}
      <a class="btn s" href="${open1(e)}">${e.s === "lib" ? (e.tj ? "الترجمة المفصلة" : "صفحة المؤلف") : "الترجمة كاملة في المصدر"}</a></div>`;
  }
  async function mentionsHtml(m) {
    if (!m || !m.length) return "";
    const items = m.filter(([b]) => typeof B === "function" && B(b)).slice(0, 15);
    if (!items.length) return "";
    return `<h4>ورد ذكره في كتب المكتبة</h4><ul class="almm">${items.map(([b, ps]) => { const x = B(b); return `<li><a href="#/book/${encodeURIComponent(b)}/${ps[0]}">${esc(x.setTitle || x.title)}</a> <span class="mut">ص ${ps.slice(0, 6).map(p => `<a href="#/book/${encodeURIComponent(b)}/${p}">${toAr(p)}</a>`).join("، ")}</span></li>`; }).join("")}</ul>`;
  }
  async function body(r, full) {
    const es = r.es, tr = es.filter(e => e.t !== "j"), jr = es.filter(e => e.t === "j"), g = grades(jr), many = new Set(tr.map(e => norm(e.n))).size > 1;
    const m = await meta(), hasJ = (m.sources || []).some(s => s[2] === "j");
    if (!es.length && !r.m.length) return `<p class="note">لم أجد ترجمة لـ«${esc(r.key)}» في كتب التراجم الموجودة في المكتبة. لا تُنشأ ترجمة دون مصدر.</p><p class="mut">جرّب تحديد الاسم كاملًا (مثل: عبد الله بن عمر)، أو ابحث في <a href="#/alam?q=${encodeURIComponent(r.key)}">صفحة الأعلام</a>.</p>`;
    return `<p class="mut almnote">الربط بين الاسم والترجمة آلي بتطابق الاسم؛ والنصوص المعروضة منقولة بحروفها من مصادرها مع موضعها.${many ? " <b>يحمل هذا الاسم أكثر من علم؛ فاختر المقصود بحسب السياق، ولا يُجزم بواحد منها.</b>" : ""}</p>
      ${tr.length ? `<h4>${many ? "الاحتمالات (" + toAr(tr.length) + ")" : "الترجمة"}</h4>${tr.slice(0, full ? 30 : 6).map(e => entryHtml(e, full)).join("")}${!full && tr.length > 6 ? `<p><a href="#/alam?q=${encodeURIComponent(r.key)}">و${toAr(tr.length - 6)} احتمالات أخرى…</a></p>` : ""}` : ""}
      <h4>أقوال أئمة الجرح والتعديل</h4>${jr.length ? (g ? `<p class="note">اختلفت عبارات الأئمة في هذا الاسم (${g.join("، ")})؛ وقد يرجع ذلك إلى اختلاف الرواة المتسمّين به، أو إلى اختلاف معتبر في الحكم عليه. راجع المواضع.</p>` : "") + jr.slice(0, full ? 30 : 6).map(e => entryHtml(e, full)).join("")
        : `<p class="mut">${hasJ ? "لم يرد هذا الاسم في كتب الجرح والتعديل الموجودة في المكتبة." : "لم تُضف كتب الجرح والتعديل إلى المكتبة بعد (يجري استيراد تقريب التهذيب والكاشف والميزان وغيرها)؛ وتظهر أقوال الأئمة هنا بنصها وعزوها عند اكتماله."}</p>`}
      ${await mentionsHtml(r.m)}`;
  }
  async function sheet(text) {
    const t = String(text || "").trim(); if (!t) return;
    openSheet("التعريف بالعلم", `<p class="mut">جارٍ البحث عن «${esc(t.slice(0, 60))}»…</p>`);
    const r = await lookup(t);
    const el = $("#sheetB"); if (!el) return;
    el.innerHTML = `<h3 class="almh">${esc(t.length < 60 ? t : r.key)}</h3>${await body(r, false)}<p><a class="btn" href="#/alam?q=${encodeURIComponent(r.key)}">صفحة العلم كاملة</a></p>`;
  }
  async function page(q) {
    const s = (q.q || "").trim(), m = await meta();
    view(`<h2>الأعلام والرواة</h2><p class="mut">تعريف بالصحابة والتابعين والعلماء والرواة من كتب التراجم والجرح والتعديل في المكتبة (${(m.sources || []).map(x => esc(x[1])).join("، ") || "…"})، ومؤلفي المكتبة؛ مع مواضع ذكرهم في الكتب. أثناء القراءة: حدّد الاسم ثم اضغط «👤 العلم».</p>
      <form data-form="almq" class="stepper"><input name="q" type="search" value="${esc(s)}" placeholder="اسم العلم: أبو هريرة، سفيان الثوري، ابن عمر…" required><button class="btn p">بحث</button></form><div id="almres">${s ? '<p class="mut">جارٍ البحث…</p>' : ""}</div>`);
    if (s) { const r = await lookup(s), box = $("#almres"); if (box) box.innerHTML = `<h3 class="almh">${esc(s)}</h3>` + await body(r, true); }
  }
  // زر شريط التحديد وقائمة الكلمة
  document.addEventListener("click", e => {
    const el = e.target.closest('[data-act="selalam"],[data-act="walam"]'); if (!el) return; e.preventDefault();
    if (el.dataset.act === "selalam") { let t = String(getSelection()).trim(); if (!t && typeof SELC !== "undefined" && SELC) try { t = SELC.r.toString().trim(); } catch (x) { } if (!t) return toast("حدّد اسم العلم أولًا."); if (t.split(/\s+/).length > 10) return toast("حدّد الاسم وحده (عشر كلمات على الأكثر)."); sheet(t); }
    else { const mn = el.closest(".wmenu"); const ctx = (mn && mn._ctx) || ""; const w = (mn && mn._w) || ""; mn && mn.remove();
      // الاسم حول الكلمة: الكلمة مع ما يسبقها ويليها من كلمات الاسم (أبو، ابن، بن، عبد…)
      const ws = ctx.split(/\s+/), i = ws.findIndex(x => x === w); let a = i, b = i;
      if (i >= 0) { while (a > 0 && i - a < 3 && /^(أبو|أبي|أبا|ابن|بن|عبد|أم|بنت|و?عن)$|^ال/.test(ws[a - 1].replace(/[^؀-ۿ]/g, "")) ) a--; if (/^(بن|ابن|أبي|أبو|عبد)$/.test(ws[i + 1] || "")) b = Math.min(ws.length - 1, i + 2); else if (/^ال/.test(ws[i + 1] || "")) b = i + 1; }
      sheet(i >= 0 ? ws.slice(a, b + 1).join(" ") : w); }
  });
  document.addEventListener("submit", e => { const f = e.target; if (f.dataset && f.dataset.form === "almq") { e.preventDefault(); e.stopImmediatePropagation(); go("#/alam?q=" + encodeURIComponent(f.q.value.trim())); } }, true);
  return { lookup, sheet, candidates, view: page, norm };
})();
