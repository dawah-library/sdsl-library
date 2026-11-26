/* خدمة شرح الكتب والمتون (المرحلة ٤، #/sharh): نسخة مشروحة يتميّز فيها كلام المؤلف عن كلام الشارح، وكل شرح مربوط بموضعه.
   البنية: الأصل والشرح كتابان مستقلان في المكتبة لا يُعدَّلان، والربط وحده في data/shp (tools/sharh-align.py يبنيه):
   _list.json الفهرس، <pid>.json المشروع (الأصل بمجلداته، والأعمال: شرح/حاشية/تعليق/تفريغ، لكل عمل مؤلفه ولونه ومجلداته وما يقابلها)،
   <pid>/<wid>.json المقاطع: {a,z: فقرات الشرح، m,u: الموضع في الأصل، c: الثقة، st: auto|review|ok|moved|none}.
   الإدارة: إنشاء المشروع («رفع شرح كتاب» بمساريه)، والسجل، والمراجعة جنبًا إلى جنب، والاعتماد. القراءة: أربع طرق عرض، وتعدد الشروح، والتصدير. */
const SHRH = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/shp/" + p + "?t=" + Math.floor(Date.now() / 60e3);
  const getJ = async p => { for (const u of [RAW(p), "data/shp/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const KINDS = { sharh: "شرح", hashiya: "حاشية", taliq: "تعليق", tafrigh: "شرح صوتي مفرَّغ" };
  const COLORS = ["#1f6f8b", "#a3462f", "#6b4fa3", "#3c7a3b", "#b88a2e", "#2f5e9e"];
  const MODES = [["auto", "تلقائي (المختصر حاشية والمطوّل منسدل)"], ["mix", "ممزوج بالمتن"], ["foot", "حواشٍ سفلية مرقمة"], ["drop", "حواشٍ منسدلة"], ["side", "لوحة جانبية متزامنة"]];
  const body = pg => String(pg || "").split(/^\s*_{4,}\s*$/m)[0];
  // مطابقة تمامًا لـunits_of وparas_of في tools/sharh-align.py
  function unitsOf(pages) { const out = []; pages.forEach((pg, i) => { let k = 0; body(pg).split("\n").map(l => l.trim()).filter(Boolean).forEach(para => { (para.length <= 420 ? [para] : para.split(/(?<=[.؟!:])\s+/).map(x => x.trim()).filter(Boolean)).forEach(t => { out.push([(i + 1) + "." + k, t.replace(/^#+\s*/, "")]); k++; }); }); }); return out; }
  function parasOf(pages) { const out = []; pages.forEach((pg, i) => String(pg || "").split("\n").forEach(l => { if (l.trim() && !/^\s*_{4,}\s*$/.test(l)) out.push([i + 1, l.trim()]); })); return out; }
  let LIST = null; const PJ = new Map(), AN = new Map();
  const list = async () => LIST || (LIST = (await getJ("_list.json")) || {});
  const proj = async id => { if (!PJ.has(id)) PJ.set(id, getJ(id + ".json")); return PJ.get(id); };
  const anchors = async (id, w) => { const k = id + "/" + w; if (!AN.has(k)) AN.set(k, getJ(k + ".json")); return AN.get(k); };
  const admin = () => isAdmin() || (typeof can === "function" && can("edit"));
  const mvols = b => b.set ? lib.books.filter(x => x.set === b.set).sort((x, y) => (x.vol || 0) - (y.vol || 0)).map(x => x.id) : [b.id];
  const title = b => b ? (b.setTitle || b.title) : "";

  /* ---------- الإدارة: المشاريع ---------- */
  async function page(q, id, sub) {
    if (id && sub === "review") return review(id, q);
    if (id) return project(id);
    const L = await list(), mine = Object.entries(L);
    view(`<h2>شرح الكتب والمتون</h2><p class="mut">نسخ مشروحة يتميّز فيها كلام المؤلف عن كلام الشارح، وكل شرح مربوط بموضعه من الكتاب. اختر كتابًا مشروحًا لتقرأه بشروحه، ${admin() ? "أو أنشئ مشروع شرح جديدًا." : ""}</p>
      ${mine.filter(([, v]) => v.st === "published" || admin()).map(([k, v]) => `<div class="bk"><a href="${v.st === "published" && v.matn ? "#/book/" + esc(v.matn[0]) + "/1?shx=1" : "#/sharh/" + esc(k)}"><b>${esc(v.t)}</b></a><span>${toAr(v.works || 0)} شرح • الإنجاز ${toAr(v.prog || 0)}٪${v.rev ? " • للمراجعة " + toAr(v.rev) : ""} • ${v.st === "published" ? "منشور" : "<em class=\"tag\">مسودة</em>"}${admin() ? ` • <a href="#/sharh/${esc(k)}">السجل والإدارة</a>` : ""}</span></div>`).join("") || '<p class="mut">لا مشاريع بعد.</p>'}
      ${admin() ? newForm() : ""}`);
  }
  function newForm() {
    const books = BOOKS().filter(b => !b.hidden).slice(0, 5000).map(b => `<option value="${esc(b.id)}">${esc(title(b))} — ${esc(A(b.authorId).name)}</option>`).join("");
    const aus = lib.authors.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("");
    return `<details class="card" open><summary><b>＋ رفع شرح كتاب</b></summary><form data-form="shnew">
      <fieldset><legend>الكتاب المشروح (الأصل)</legend>
      <label class="inl"><input type="radio" name="path" value="1" checked> موجود في المكتبة (يُستدعى بكل مجلداته، ويُرفع الشرح وحده)</label><br>
      <label class="inl"><input type="radio" name="path" value="2"> غير موجود: ارفع الأصل أولًا من <a href="#/admin?t=book" target="_blank">إضافة كتاب</a> ثم اختره هنا</label>
      <input name="mq" list="shbooks" placeholder="اكتب اسم الكتاب الأصل ثم اختره" required><datalist id="shbooks">${books}</datalist></fieldset>
      <fieldset><legend>الشرح أو الحاشية</legend><div class="row"><div><label>النوع</label><select name="kind">${Object.entries(KINDS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></div><div><label>عنوان العمل</label><input name="wt" placeholder="مثل: شرح العقيدة الطحاوية" required></div></div>
      <label>الشارح أو المحشّي</label><select name="au"><option value="__matn">صاحب الأصل نفسه</option>${aus}<option value="__new">+ اسم جديد</option></select><input name="aunew" placeholder="اسم الشارح الجديد" style="margin-top:4px">
      <label>مجلدات الشرح (من كتب المكتبة؛ ارفعها أولًا من <a href="#/admin?t=book" target="_blank">إضافة كتاب</a> أو <a href="#/admin?t=pdf" target="_blank">كتاب مصور</a> أو <a href="#/admin?t=tafrigh" target="_blank">رفع تفريغات</a> مع اختيار «الكتاب المشروح»)</label>
      <input name="sq" list="shbooks" placeholder="اكتب اسم مجلد الشرح ثم اختره (يمكن الإضافة على مراحل لاحقًا)"></fieldset>
      <div class="savebar"><button class="btn p">إنشاء المشروع وبدء المعالجة</button> <span id="shst" class="mut"></span></div>
      <p class="mut">المعالجة مجانية ضمن حصة Gemini (تضمينات وترجيح للمواضع المترددة فقط، بحد أقصى في كل جولة)، وتُحفظ حالتها فتُستكمل دون إعادة.</p></form></details>`;
  }
  const pick = v => lib.books.find(b => b.id === v || (b.setTitle || b.title) + " — " + A(b.authorId).name === v || title(b) === v);
  async function create(f) {
    const st = $("#shst"); if (typeof GH === "undefined" || !GH.on) return st.textContent = "فعّل الإدارة المباشرة أولًا.";
    const m = pick(f.mq.value.trim()); if (!m) return st.textContent = "اختر الكتاب الأصل من القائمة.";
    let au = f.au.value; if (au === "__matn") au = m.authorId; else if (au === "__new") { const nm = f.aunew.value.trim(); if (!nm) return st.textContent = "اكتب اسم الشارح."; au = "new:" + nm; }
    const sv = f.sq.value.trim() ? pick(f.sq.value.trim()) : null;
    const pid = String(m.set || m.id).replace(/[^\w-]/g, "").slice(0, 40), wid = "w" + Date.now().toString(36);
    st.textContent = "جارٍ الحفظ…";
    try {
      await GH.editJSON("data/shp/" + pid + ".json", P => {
        P = P || { id: pid, t: title(m), matn: mvols(m), st: "draft", created: today(), works: [] };
        P.works.push({ w: wid, kind: f.kind.value, t: f.wt.value.trim(), a: au, col: COLORS[P.works.length % COLORS.length], vols: sv ? (sv.set ? mvols(sv) : [sv.id]).map(b => ({ b, m: null })) : [] });
        return P; }, "شرح الكتب: مشروع «" + title(m) + "»");
      await queue(pid); location.hash = "#/sharh/" + pid;
    } catch (x) { st.textContent = x.message; }
  }
  const queue = pid => GH.editJSON("data/shp/_queue.json", o => { o = o || { items: [] }; if (!o.items.includes(pid)) o.items.push(pid); return o; }, "شرح الكتب: معالجة " + pid, true);
  async function project(id) {
    view('<p class="mut">جارٍ التحميل…</p>'); const P = await proj(id); if (!P) return view('<p class="note">المشروع غير موجود.</p>');
    const auName = a => !a ? "" : String(a).startsWith("new:") ? a.slice(4) : A(a).name;
    view(`<p><a href="#/sharh">← شرح الكتب</a></p><h2>${esc(P.t)}</h2><p class="mut">الأصل: ${P.matn.map(v => esc(title(B(v)) + (B(v) && B(v).vol != null ? " ج" + B(v).vol : ""))).slice(0, 12).join("، ")} • الحالة: ${P.st === "published" ? "منشور" : "مسودة"} • الإنجاز ${toAr(P.prog || 0)}٪ • للمراجعة ${toAr(P.rev || 0)}</p>
      ${P.works.map(w => { const g = w.log || {}; return `<section class="card shw" style="--c:${esc(w.col)}"><h3><i class="shdot"></i> ${esc(KINDS[w.kind] || "")}: ${esc(w.t)} <small class="mut">— ${esc(auName(w.a))}</small></h3>
        <p>المجلدات المرفوعة ${toAr(g.up || w.vols.length)} • المعالجة ${toAr(g.done || 0)} • المقاطع ${toAr(g.segs || 0)} • معتمدة ${toAr(g.ok || 0)} • مقترحة بثقة ${toAr(g.auto || 0)} • <b>للمراجعة ${toAr(g.rev || 0)}</b> • غير مربوطة (مقدمات واستطرادات) ${toAr(g.none || 0)}</p>
        <ol class="shvols">${w.vols.map((v, i) => `<li>${esc(title(B(v.b)) || v.b)}${B(v.b) && B(v.b).vol != null ? " ج" + B(v.b).vol : ""} ← <select data-shmap="${esc(w.w)}" data-i="${i}"><option value="">كل الأصل</option>${P.matn.map(m => `<option value="${esc(m)}"${(v.m || [])[0] === m ? " selected" : ""}>${esc(title(B(m)))}${B(m) && B(m).vol != null ? " ج" + B(m).vol : ""}</option>`).join("")}</select></li>`).join("")}</ol>
        <div class="row"><input data-shadd="${esc(w.w)}" list="shbooks2" placeholder="أضف مجلد شرح (على مراحل)"><a class="btn s p" href="#/sharh/${esc(id)}/review?w=${esc(w.w)}">مراجعة المطابقات</a></div></section>`; }).join("")}
      <datalist id="shbooks2">${BOOKS().filter(b => !b.hidden).slice(0, 5000).map(b => `<option value="${esc(b.id)}">${esc(title(b))}</option>`).join("")}</datalist>
      <div class="row"><button class="btn" data-shq="${esc(id)}">استكمال المعالجة (المجلدات الجديدة)</button><a class="btn" href="#/sharh">＋ شرح أو حاشية أخرى على الكتاب نفسه</a>${P.st !== "published" ? `<button class="btn p" data-shpub="${esc(id)}">اعتماد النسخة النهائية ونشرها</button>` : `<a class="btn p" href="#/book/${esc(P.matn[0])}/1?shx=1">قراءة النسخة المشروحة</a>`} <span id="shst2" class="mut"></span></div>`);
  }
  /* ---------- المراجعة جنبًا إلى جنب ---------- */
  async function review(id, q) {
    view('<p class="mut">جارٍ تحميل الأصل والشرح…</p>'); const P = await proj(id), w = P && P.works.find(x => x.w === q.w) || (P && P.works[0]); if (!w) return view('<p class="note">لا عمل.</p>');
    const A_ = await anchors(id, w.w); if (!A_) return view(`<p><a href="#/sharh/${esc(id)}">← المشروع</a></p><div class="note">لم تُعالج مجلدات هذا الشرح بعد؛ تبدأ المعالجة آليًّا خلال دقائق من الحفظ.</div>`);
    const U = {}; for (const v of P.matn) { try { const b = await loadBook(v); U[v] = Object.fromEntries(unitsOf(b.pages)); } catch (e) { } }
    const f = q.f || "review", rows = [];
    for (const [cv, d] of Object.entries(A_.vols || {})) { let b; try { b = await loadBook(cv); } catch (e) { continue; } const pr = parasOf(b.pages);
      d.segs.forEach((s, i) => { if (f === "all" || s.st === f) rows.push({ cv, i, s, t: pr.slice(s.a, s.z + 1).map(x => x[1]).join("\n") }); }); }
    window.__shr = { id, w: w.w, U };
    const opts = (s) => (s.alt || []).map(a => `<option value="${esc(a[0] + "|" + a[1])}">${esc((U[a[0]] || {})[a[1]] ? (U[a[0]][a[1]]).slice(0, 70) : a[1])} (${toAr(Math.round(a[2] * 100))}٪)</option>`).join("");
    view(`<p><a href="#/sharh/${esc(id)}">← المشروع</a></p><h2>مراجعة: ${esc(w.t)}</h2>
      <div class="chips">${[["review", "للمراجعة (منخفضة الثقة)"], ["auto", "مقترحة بثقة"], ["none", "غير مربوطة"], ["ok", "معتمدة"], ["all", "الكل"]].map(([k, t]) => `<a class="chip${f === k ? " x" : ""}" href="#/sharh/${esc(id)}/review?w=${esc(w.w)}&f=${k}">${t}</a>`).join("")}</div>
      ${f === "auto" && rows.length ? `<button class="btn p" data-shall>اعتماد كل المقترحات بثقة (${toAr(rows.length)})</button>` : ""} <span id="shst3" class="mut"></span>
      <div class="shrev">${rows.slice(0, 120).map(r => `<article class="shr${r.s.st === "review" ? " low" : ""}" data-cv="${esc(r.cv)}" data-i="${r.i}"><div class="shr-m"><small class="mut">الأصل ${r.s.u ? esc(r.s.m + " ص" + r.s.u.split(".")[0]) : "— غير مربوط"}</small><p>${esc(r.s.u ? (U[r.s.m] || {})[r.s.u] || "" : "")}</p></div>
        <div class="shr-c"><small class="mut">الشرح ص${toAr(r.s.p)} • الثقة ${toAr(Math.round(r.s.c * 100))}٪${r.s.st === "review" ? " ⚠️" : ""}</small><p>${esc(r.t.slice(0, 900))}${r.t.length > 900 ? "…" : ""}</p></div>
        <div class="row shr-a"><button class="btn s p" data-shok>اعتماد</button><select data-shmove><option value="">نقل إلى موضع آخر…</option>${opts(r.s)}<option value="__pick">اختيار من الأصل كله…</option></select><button class="btn s" data-shnone>ليس شرحًا لموضع (مقدمة/استطراد)</button></div></article>`).join("") || '<p class="mut">لا مقاطع في هذا التصنيف.</p>'}</div>${rows.length > 120 ? `<p class="mut">عُرض ١٢٠ من ${toAr(rows.length)}؛ اعتمد ثم حدّث الصفحة.</p>` : ""}`);
  }
  async function setSeg(cv, i, patch) {
    const { id, w } = window.__shr; await GH.editJSON("data/shp/" + id + "/" + w + ".json", A_ => { const s = A_.vols[cv].segs[i]; Object.assign(s, patch); return A_; }, "شرح الكتب: مراجعة مطابقة", true);
    AN.delete(id + "/" + w);
  }
  /* ---------- القارئ: عرض الشروح في الأصل ---------- */
  const PREF = () => Object.assign({ mode: "auto", off: [] }, S.shx || {});
  async function reader(b, p) {
    const rb = $("#rb"); if (!rb || !b) return; const L = await list(); const ent = Object.entries(L).find(([, v]) => (v.st === "published" || admin()) && (v.matn || []).includes(b.id)); if (!ent) return;
    const [pid] = ent, P = await proj(pid); if (!P) return; const pf = PREF(), on = P.works.filter(w => !pf.off.includes(w.w));
    const bar = document.getElementById("shxbar") || (rb.insertAdjacentHTML("beforebegin", `<div id="shxbar" class="shxbar"></div>`), document.getElementById("shxbar"));
    bar.innerHTML = `<b>📖 الشروح:</b> ${P.works.map(w => `<label class="chip shchip" style="--c:${esc(w.col)}"><input type="checkbox" data-shw="${esc(w.w)}"${pf.off.includes(w.w) ? "" : " checked"}> ${esc(w.t)}</label>`).join("")}
      <select data-shmode aria-label="طريقة العرض">${MODES.map(([k, t]) => `<option value="${k}"${pf.mode === k ? " selected" : ""}>${t}</option>`).join("")}</select><button class="btn s" data-shexp>تصدير النسخة المشروحة</button>${P.st !== "published" ? ' <em class="tag">مسودة للمشرفين</em>' : ""}`;
    const items = []; // [{w, unit, text, n}]
    for (const w of on) { const A_ = await anchors(pid, w.w); if (!A_) continue;
      for (const [cv, d] of Object.entries(A_.vols || {})) { const segs = d.segs.filter(s => s.m === b.id && s.u && +s.u.split(".")[0] === p && (s.st === "ok" || s.st === "moved" || s.st === "auto" || admin())); if (!segs.length) continue;
        let cb; try { cb = await loadBook(cv); } catch (e) { continue; } const pr = parasOf(cb.pages);
        segs.forEach(s => items.push({ w, s, u: s.u, text: pr.slice(s.a, s.z + 1).map(x => x[1]).join("\n"), cv })); } }
    if (!items.length || document.getElementById("rb") !== rb) return;
    const units = unitsOf(b.pages).filter(([u]) => +u.split(".")[0] === p), nz = t => norm(t).replace(/\s+/g, "");
    const blocks = [...rb.querySelectorAll("p,h1,h2,h3,h4,li,blockquote,div.verse")];
    const where = u => { const t = (units.find(x => x[0] === u) || [])[1]; if (!t) return null; const k = nz(t).slice(0, 24); return blocks.find(el => nz(el.textContent).includes(k)) || null; };
    // الموضع الدقيق داخل الفقرة (المتون القصيرة تُعرض فقرات مدمجة): بعد آخر كلمات الوحدة، وإلا في آخر الفقرة
    const put = (el, u, html) => { const t = (units.find(x => x[0] === u) || [])[1] || "", ws = t.replace(/[\u064B-\u0652\u0670\u0640]/g, "").split(/\s+/).filter(Boolean), tail = ws.slice(-2).join(" ");
      const W = [...el.querySelectorAll(".w")].filter(x => !x.closest(".shx,.shfn,.shdrop")), dz = x => x.replace(/[\u064B-\u0652\u0670\u0640]/g, "").trim(), tw2 = ws.slice(-2);
      if (W.length && tw2.length) { const start = ws.length > 2 ? ws.slice(0, 2) : null;
        for (let i = tw2.length - 1; i < W.length; i++) if (tw2.every((w, j) => dz(W[i - tw2.length + 1 + j].textContent) === w) && (!start || W.slice(Math.max(0, i - ws.length - 2), i).some((x, j, a) => dz(x.textContent) === start[0]))) { W[i].insertAdjacentHTML("afterend", html); return; } }
      if (tail.length >= 3) { const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let nd; while ((nd = tw.nextNode())) { if (nd.parentElement.closest(".shx,.shfn,.shdrop")) continue; const raw = nd.nodeValue.replace(/[\u064B-\u0652\u0670\u0640]/g, ""); const k = raw.indexOf(tail);
        if (k >= 0) { let i = 0, c = 0; while (i < nd.nodeValue.length && c < k + tail.length) { if (!/[\u064B-\u0652\u0670\u0640]/.test(nd.nodeValue[i])) c++; i++; } while (i < nd.nodeValue.length && /[\u064B-\u0652\u0670\u0640]/.test(nd.nodeValue[i])) i++;
          const rest = nd.splitText(i), span = document.createElement("span"); span.innerHTML = html; rest.parentNode.insertBefore(span, rest); return; } } }
      el.insertAdjacentHTML("beforeend", html); };
    const mode = pf.mode, fn = []; let n = 0;
    const html = (it) => `<div class="shx" style="--c:${esc(it.w.col)}"><b class="shxn">${esc(it.w.t)}</b>${it.s.st === "review" ? ' <em class="tag">موضع غير مؤكد</em>' : ""}${it.text.split("\n").map(l => `<p>${esc(l)}</p>`).join("")}</div>`;
    if (mode === "side") {
      document.body.classList.add("shside"); let side = document.getElementById("shxside"); if (!side) { document.body.insertAdjacentHTML("beforeend", '<aside id="shxside" class="shxside" aria-label="الشروح"></aside>'); side = document.getElementById("shxside"); }
      side.innerHTML = `<h3>الشروح على ص ${toAr(p)}</h3>` + items.map(it => `<section data-u="${esc(it.u)}">${html(it)}</section>`).join("");
      items.forEach(it => { const el = where(it.u); if (el) { el.classList.add("shanch"); el.style.setProperty("--c", it.w.col); el.onclick = () => { const s = side.querySelector(`[data-u="${it.u}"]`); if (s) s.scrollIntoView({ behavior: "smooth" }); }; } });
      return;
    }
    document.body.classList.remove("shside");
    items.forEach(it => { const el = where(it.u); if (!el) return; const long = it.text.length > 500, m = mode === "auto" ? (long ? "drop" : "foot") : mode; n++;
      if (m === "mix") put(el, it.u, html(it).replace('class="shx"', 'class="shx shmix"'));
      else if (m === "drop") put(el, it.u, ` <details class="shdrop" style="--c:${esc(it.w.col)}"><summary><sup>${toAr(n)}</sup></summary>${html(it)}</details>`);
      else { put(el, it.u, `<sup class="shfn" style="--c:${esc(it.w.col)}"><a href="#shf${n}" data-shfn="${n}">${toAr(n)}</a></sup>`); fn.push(`<li id="shf${n}" style="--c:${esc(it.w.col)}">${html(it)}</li>`); } });
    if (fn.length) rb.insertAdjacentHTML("beforeend", `<ol class="shfoot">${fn.join("")}</ol>`);
  }
  /* ---------- التصدير: PDF وWord ونص منسق ونسخة تفاعلية — بتمييز المؤلف عن الشارح وأرقام الحواشي وترتيب المجلدات ---------- */
  async function exportAll(kind, b) {
    const L = await list(), ent = Object.entries(L).find(([, v]) => (v.matn || []).includes(b.id)); if (!ent) return; const pid = ent[0], P = await proj(pid), pf = PREF();
    const ws = P.works.filter(w => !pf.off.includes(w.w)); toast("جارٍ إعداد النسخة المشروحة…");
    const by = {}; // matnVol|unit → [{w,text}]
    for (const w of ws) { const A_ = await anchors(pid, w.w); if (!A_) continue; for (const [cv, d] of Object.entries(A_.vols || {})) { let cb; try { cb = await loadBook(cv); } catch (e) { continue; } const pr = parasOf(cb.pages);
      d.segs.filter(s => s.u && (s.st === "ok" || s.st === "moved" || s.st === "auto")).forEach(s => (by[s.m + "|" + s.u] = by[s.m + "|" + s.u] || []).push({ w, text: pr.slice(s.a, s.z + 1).map(x => x[1]).join("\n") })); } }
    const vols = []; for (const v of P.matn) { try { const mb = await loadBook(v); vols.push({ v, b: mb, units: unitsOf(mb.pages) }); } catch (e) { } }
    const name = P.t + " — مع " + ws.map(w => w.t).join(" و"), legend = ws.map(w => `${w.t} (${KINDS[w.kind] || ""})`).join("، ");
    if (kind === "docx") {
      const pages = []; let k = 0;
      vols.forEach(V => { const pg = {}; V.units.forEach(([u, t]) => { const p = +u.split(".")[0]; const c = by[V.v + "|" + u] || []; (pg[p] = pg[p] || { t: [], f: [] }); let line = t; c.forEach(x => { pg[p].f.push("[" + x.w.t + "] " + x.text.replace(/\n/g, " ")); line += "(" + pg[p].f.length + ")"; }); pg[p].t.push(line); });
        Object.keys(pg).sort((a, b) => a - b).forEach((p, i) => pages.push({ i: ++k, t: (i === 0 && vols.length > 1 ? "# " + title(V.b) + (V.b.vol != null ? " — ج" + V.b.vol : "") + "\n" : "") + pg[p].t.join("\n") + (pg[p].f.length ? "\n_____\n" + pg[p].f.map((f, j) => "(" + (j + 1) + ") " + f).join("\n") : ""), l: PL(V.b, p - 1) || "" })); });
      const blob = await DOCX.build({ fmt: { cover: 1 }, title: name, author: A(B(P.matn[0]).authorId).name, pages, toc: [], opt: { fn: true, toc: false, pl: false }, url: siteLink("#/book/" + P.matn[0]), src: "المتن بنص مؤلفه، والشروح في الحواشي بأسماء أصحابها: " + legend, who: "", site: SITENAME, siteUrl: (CFG.siteUrl || "https://dawahlibrary.org").replace(/^https?:\/\//, "").replace(/\/+$/, "") });
      return dl(name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + ".docx", blob, blob.type);
    }
    if (kind === "txt") { const t = vols.map(V => (vols.length > 1 ? "■ " + title(V.b) + (V.b.vol != null ? " — ج" + V.b.vol : "") + "\n\n" : "") + V.units.map(([u, x]) => "【المتن】 " + x + (by[V.v + "|" + u] || []).map(c => "\n   «" + c.w.t + "»: " + c.text.replace(/\n/g, "\n   ")).join("")).join("\n\n")).join("\n\n\n"); return dl(name.slice(0, 80) + ".txt", name + "\n" + legend + "\n\n" + t, "text/plain"); }
    const css = `body{font-family:Amiri,'Traditional Arabic',serif;direction:rtl;line-height:1.95;max-width:820px;margin:auto;padding:16px;color:#14231f}.mt{font-weight:700;font-size:1.08em;margin:14px 0 4px}.sh{border-inline-start:4px solid var(--c);background:color-mix(in srgb,var(--c) 7%,#fff);padding:6px 12px;margin:4px 0 8px;font-size:.95em}.sh b{color:var(--c)}details summary{cursor:pointer;color:var(--c)}h1,h2{color:#0f5c4d;text-align:center}@media print{details{display:block}details>summary{display:none}}`;
    const inner = vols.map(V => (vols.length > 1 ? `<h2>${esc(title(V.b))}${V.b.vol != null ? " — ج" + V.b.vol : ""}</h2>` : "") + V.units.map(([u, x]) => `<p class="mt">${esc(x)}</p>` + (by[V.v + "|" + u] || []).map(c => `<details${kind === "pdf" ? " open" : ""} style="--c:${esc(c.w.col)}"><summary>${esc(c.w.t)}</summary><div class="sh" style="--c:${esc(c.w.col)}"><b>${esc(c.w.t)}:</b> ${c.text.split("\n").map(l => esc(l)).join("<br>")}</div></details>`).join("")).join("")).join("");
    const doc = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(name)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"><style>${css}</style></head><body><h1>${esc(name)}</h1><p style="text-align:center">المتن بالخط العريض، والشروح بألوانها وأسماء أصحابها — ${esc(SITENAME)}</p>${inner}`;
    if (kind === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); w.document.write(doc + `<script>onload=()=>setTimeout(()=>print(),800)<\/script></body></html>`); w.document.close(); }
    else dl(name.slice(0, 80) + ".html", doc + "</body></html>", "text/html");
  }
  document.addEventListener("change", e => {
    const t = e.target; if (t.matches("[data-shw]")) { const pf = PREF(); pf.off = t.checked ? pf.off.filter(x => x !== t.dataset.shw) : pf.off.concat(t.dataset.shw); S.shx = pf; saveS(); refreshPage(); }
    else if (t.matches("[data-shmode]")) { const pf = PREF(); pf.mode = t.value; S.shx = pf; saveS(); if (t.value !== "side") { document.body.classList.remove("shside"); const s = document.getElementById("shxside"); if (s) s.remove(); } refreshPage(); }
    else if (t.matches("[data-shmove]") && t.value) { const a = t.closest("[data-cv]"); let v = t.value;
      if (v === "__pick") { const all = Object.entries(window.__shr.U).flatMap(([m, us]) => Object.entries(us).map(([u, x]) => [m, u, x])); const s = prompt("اكتب كلمات من موضع الأصل الصحيح:"); if (!s) return; const w = norm(s); const hit = all.find(([, , x]) => norm(x).includes(w)); if (!hit) return toast("لم يوجد"); v = hit[0] + "|" + hit[1]; }
      const [m, u] = v.split("|"); setSeg(a.dataset.cv, +a.dataset.i, { m, u, st: "moved", c: 1 }).then(() => { a.remove(); toast("نُقل واعتُمد"); }).catch(x => toast(x.message)); }
    else if (t.matches("[data-shmap]")) { const pid = location.hash.split("/")[2]; GH.editJSON("data/shp/" + pid + ".json", P => { const w = P.works.find(x => x.w === t.dataset.shmap); w.vols[+t.dataset.i].m = t.value ? [t.value] : null; return P; }, "شرح الكتب: ربط مجلد الشرح بمجلد الأصل").then(() => { PJ.delete(pid); toast("حُفظ؛ يُعاد ربط هذا المجلد في المعالجة التالية"); }).catch(x => toast(x.message)); }
    else if (t.matches("[data-shadd]") && t.value) { const pid = location.hash.split("/")[2], b = B(t.value.trim()) || pick(t.value.trim()); if (!b) return toast("اختر من القائمة");
      GH.editJSON("data/shp/" + pid + ".json", P => { const w = P.works.find(x => x.w === t.dataset.shadd); (b.set ? mvols(b) : [b.id]).forEach(id => { if (!w.vols.some(v => v.b === id)) w.vols.push({ b: id, m: null }); }); return P; }, "شرح الكتب: إضافة مجلد شرح").then(() => queue(pid)).then(() => { PJ.delete(pid); project(pid); }).catch(x => toast(x.message)); }
  });
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-shok],[data-shnone],[data-shall],[data-shq],[data-shpub],[data-shexp]"); if (!el) return; e.preventDefault();
    try {
      if (el.matches("[data-shok],[data-shnone]")) { const a = el.closest("[data-cv]"); await setSeg(a.dataset.cv, +a.dataset.i, el.matches("[data-shok]") ? { st: "ok" } : { st: "none", m: null, u: null }); a.remove(); }
      else if (el.matches("[data-shall]")) { const { id, w } = window.__shr; el.disabled = true; await GH.editJSON("data/shp/" + id + "/" + w + ".json", A_ => { Object.values(A_.vols).forEach(v => v.segs.forEach(s => { if (s.st === "auto") s.st = "ok"; })); return A_; }, "شرح الكتب: اعتماد المقترحات بثقة"); AN.delete(id + "/" + w); $("#shst3").textContent = "✓ اعتُمدت"; }
      else if (el.matches("[data-shq]")) { await queue(el.dataset.shq); $("#shst2").textContent = "✓ تبدأ المعالجة خلال دقائق"; }
      else if (el.matches("[data-shpub]")) { const P = await proj(el.dataset.shpub); if ((P.rev || 0) && !confirm("بقي " + P.rev + " موضعًا للمراجعة؛ تظهر للقراء بعلامة «موضع غير مؤكد». أتعتمد النشر؟")) return;
        await GH.editJSON("data/shp/" + el.dataset.shpub + ".json", P => Object.assign(P, { st: "published", pubAt: today() }), "شرح الكتب: اعتماد ونشر «" + P.t + "»");
        await GH.editJSON("data/shp/_list.json", L => { L = L || {}; L[el.dataset.shpub] = Object.assign(L[el.dataset.shpub] || {}, { st: "published", matn: P.matn, t: P.t }); return L; }, "شرح الكتب: نشر", true); LIST = null; PJ.delete(el.dataset.shpub); project(el.dataset.shpub); }
      else if (el.matches("[data-shexp]")) { const c = cur(); if (!c) return; openSheet("تصدير النسخة المشروحة", `<p class="mut">يحافظ التصدير على التمييز بين كلام المؤلف وكلام الشارح، وأرقام الحواشي، وترتيب المجلدات، بالشروح المفعّلة الآن.</p><div class="row"><button class="btn p" data-shx="pdf">PDF</button><button class="btn" data-shx="docx">Word (حواشٍ حقيقية)</button><button class="btn" data-shx="txt">نص منسق</button><button class="btn" data-shx="html">نسخة تفاعلية (HTML)</button>${typeof prBtn==="function"?prBtn("شرح"):""}</div>`); window.__shxb = c.b; }
    } catch (x) { toast(x.message); }
  });
  document.addEventListener("click", e => { const el = e.target.closest("[data-shx]"); if (!el || !window.__shxb) return; e.preventDefault(); exportAll(el.dataset.shx, window.__shxb).catch(x => toast(x.message)); });
  document.addEventListener("submit", e => { const f = e.target.closest("[data-form=shnew]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); create(f); }, true);
  return { view: page, reader, unitsOf, parasOf };
})();
