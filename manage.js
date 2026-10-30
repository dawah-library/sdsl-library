/* إدارة المواد (الباب الثاني ١ من وثيقة التطوير):
   - تبويب «إدارة المواد»: تصفية الكتب والمقالات، واختيار فردي أو جماعي، وتعديل البيانات، والنقل بين المؤلفين والتصنيفات والأقسام، والإخفاء والاستعادة.
   - الضغط المطول (أو الزر الأيمن) على بطاقة مادة يفتح قائمة إجراءات للمشرف، وكل إجراء متاح أيضًا من التبويب.
   - «سجل التعديلات»: كل عملية تُسجَّل في data/admin-log.json بقيمها السابقة واللاحقة، ويمكن التراجع عنها.
   - «الخدمات والمفاتيح»: data/switches.json يوقف خدمات الموقع والمهام الآلية ويعيد تشغيلها.
   لا حذف نهائي: «الإخفاء» يحجب المادة عن الزوار ويبقيها للمشرفين وفي السجل. */
const MG = (() => {
  const LOG = "data/admin-log.json", SW = "data/switches.json", PER = 50;
  const FIELDS = { title: ["title", "t"], author: ["authorId", "a"], topic: ["topicId", "tp"], col: ["col", "col"], hidden: ["hidden", "h"] };
  const LABEL = { title: "العنوان", author: "المؤلف", topic: "التصنيف", col: "القسم", hidden: "الإخفاء" };
  const kindOfId = id => (CAT.books.some(b => b.id === id) ? "book" : "article");
  const raw = () => CAT.books.filter(b => !b.demo).concat(ARTS_IDX);
  const sel = new Set();
  let F = {};
  const who = () => ({ role: (typeof Cloud !== "undefined" && Cloud.role) || (GH.token ? "key" : "?"), uid: Auth.user ? String(Auth.user.id).slice(0, 8) : "" });
  const fmtV = (field, v) => field === "author" ? (A(v).name || v) : field === "topic" ? (T(v).name || v) : field === "col" ? (COL[v] || v || COL.dawah) : field === "hidden" ? (v ? "مخفي" : "ظاهر") : String(v ?? "");
  // المواد المحمّلة كلها بأسماء حقول الكتب (المقالات تُحوَّل بـ artFromIdx)، أما الملفات فالمقالات فيها بأسماء مختصرة
  const cur = (it, field) => field === "col" ? (it.col || "dawah") : field === "hidden" ? !!it.hidden : it[FIELDS[field][0]];

  // يطبّق قائمة تغييرات [{id,field,to}] على الملفات (آخر نسخة من المستودع)، ويعيد التغييرات الفعلية بقيمها السابقة
  async function apply(list, op, note) {
    if (!GH.on) throw new Error("الحفظ يحتاج حساب مشرف (أو مفتاح الإدارة المباشرة).");
    const books = list.filter(c => kindOfId(c.id) === "book"), arts = list.filter(c => kindOfId(c.id) === "article"), done = [];
    const run = (rows, kind) => obj => {
      const arr = kind === "book" ? obj.books : obj.items, by = new Map(arr.map(x => [x.id, x]));
      rows.forEach(c => {
        const x = by.get(c.id); if (!x) return; const k = FIELDS[c.field][kind === "book" ? 0 : 1];
        const from = c.field === "col" ? (x[k] || "dawah") : c.field === "hidden" ? !!x[k] : x[k];
        if (from === c.to) return;
        if (c.field === "hidden" && !c.to) delete x[k]; else if (c.field === "col" && c.to === "dawah" && kind === "article") delete x[k]; else x[k] = c.to;
        done.push({ id: c.id, kind, field: c.field, from, to: c.to });
      });
      if (kind === "book") obj.version = Date.now(); return obj;
    };
    const msg = (op === "undo" ? "تراجع: " : "إدارة المواد: ") + (note || op) + " (" + list.length + ")";
    if (books.length) await GH.editJSON("data/catalog.json", run(books, "book"), msg, true);
    if (arts.length) await GH.editJSON("data/articles/index.json", run(arts, "article"), msg, true);
    // المحلي: يظهر الأثر فورًا
    done.forEach(c => {
      const x = c.kind === "book" ? CAT.books.find(b => b.id === c.id) : ARTS_IDX.find(b => b.id === c.id); if (!x) return;
      const k = FIELDS[c.field][0]; if (c.field === "hidden" && !c.to) delete x[k]; else x[k] = c.to;
    });
    merge();
    if (done.length) await log({ op, kind: [...new Set(done.map(c => c.kind))].join("+"), ids: [...new Set(done.map(c => c.id))], changes: done, note });
    return done;
  }
  async function log(e) {
    const ent = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), by: who() }, e);
    await GH.editJSON(LOG, o => { o = o && o.items ? o : { v: 1, items: [] }; o.items.unshift(ent); o.items = o.items.slice(0, 1000); return o; }, "سجل التعديلات: " + (e.note || e.op), true);
    return ent;
  }

  // ===== التبويب: إدارة المواد =====
  function filtered() {
    const w = norm(F.q || "").split(/\s+/).filter(Boolean);
    return raw().filter(b => (F.k === "art" ? isArt(b) : F.k === "book" ? !isArt(b) : true) && (!F.c || (b.col || "dawah") === F.c) && (!F.a || b.authorId === F.a) && (!F.t || b.topicId === F.t) &&
      (F.h === "1" ? b.hidden : F.h === "0" ? !b.hidden : true) && (!w.length || w.every(k => norm(b.title + " " + (A(b.authorId).name || "")).includes(k))))
      .sort((x, y) => (y.added || y.date || "").localeCompare(x.added || x.date || ""));
  }
  const opt = (arr, v, empty) => (empty ? `<option value="">${empty}</option>` : "") + arr.map(x => `<option value="${esc(x.id)}"${x.id === v ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  const sortedAuthors = () => [...lib.authors].sort((x, y) => x.name.localeCompare(y.name, "ar"));
  function itemsBody(q) {
    F = { k: q.k || "", c: q.c || "", a: q.a || "", t: q.tp || "", h: q.h || "", q: q.q || "", pg: +q.pg || 1 };
    const r = filtered(), np = Math.max(1, Math.ceil(r.length / PER)); F.pg = Math.min(Math.max(1, F.pg), np);
    const page = r.slice((F.pg - 1) * PER, F.pg * PER);
    const u = o => { const n = Object.assign({}, F, o), p = new URLSearchParams({ t: "items" }); ["k", "c", "a", "q", "h"].forEach(k => n[k] && p.set(k, n[k])); if (n.t) p.set("tp", n.t); if (n.pg > 1) p.set("pg", n.pg); return "#/admin?" + p; };
    return `${needGH()}<p class="mut">صفِّ المواد، ثم اختر واحدة أو أكثر لتعديلها أو نقلها أو إخفائها. كل عملية تُسجَّل ويمكن التراجع عنها من «سجل التعديلات». اضغط مطولًا (أو بالزر الأيمن) على أي بطاقة في المكتبة لإجراءات سريعة.</p>
    <form class="mgf" data-form="mgfilter"><div class="row">
     <div><label>النوع</label><select name="k">${[["", "الكل"], ["book", "الكتب"], ["art", "المقالات والفتاوى والبيانات"]].map(([v, l]) => `<option value="${v}"${F.k === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
     <div><label>القسم</label><select name="c"><option value="">الكل</option>${["dawah", "turath"].map(v => `<option value="${v}"${F.c === v ? " selected" : ""}>${esc(COL[v])}</option>`).join("")}</select></div>
     <div><label>الحالة</label><select name="h">${[["", "الكل"], ["0", "ظاهرة"], ["1", "مخفية"]].map(([v, l]) => `<option value="${v}"${F.h === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>
     <div class="row"><div><label>المؤلف</label><select name="a">${opt(sortedAuthors(), F.a, "الكل")}</select></div>
     <div><label>التصنيف</label><select name="tp">${opt(lib.topics, F.t, "الكل")}</select></div>
     <div><label>بحث في العنوان والمؤلف</label><input name="q" type="search" value="${esc(F.q)}"></div></div>
     <button class="btn">تصفية</button> <a class="btn" href="#/admin?t=items">مسح</a></form>
    <p class="mut">${toAr(r.length)} مادة • صفحة ${toAr(F.pg)} من ${toAr(np)}</p>
    <div class="mglist">${page.map(b => `<label class="mgrow${b.hidden ? " hid" : ""}"><input type="checkbox" data-mgid="${esc(b.id)}"${sel.has(b.id) ? " checked" : ""}>
      <span class="mgt"><b>${esc(b.title)}</b>${b.hidden ? ' <em class="tag">مخفي</em>' : ""}<br><span class="mut">${esc(A(b.authorId).name || "—")} • ${esc(T(b.topicId).name || "—")} • ${esc(COL[b.col || "dawah"])} • ${isArt(b) ? ({ fatwa: "فتوى", statement: "بيان" }[kindOf(b)] || "مقال") : "كتاب"}</span></span>
      <button type="button" class="btn s" data-act="mgedit" data-id="${esc(b.id)}">تعديل</button></label>`).join("") || '<p class="note">لا توجد مواد مطابقة.</p>'}</div>
    <div class="mgbar" id="mgbar"><b id="mgn">٠ محدد</b>
     <button class="btn s" data-act="mgselpage">تحديد الصفحة</button><button class="btn s" data-act="mgselall" data-n="${r.length}">تحديد كل النتائج (${toAr(r.length)})</button><button class="btn s" data-act="mgselnone">إلغاء التحديد</button>
     <span class="mgops"><button class="btn p s" data-act="mgmove">نقل / تعديل جماعي</button><button class="btn s" data-act="mghide" data-v="1">إخفاء</button><button class="btn s" data-act="mghide" data-v="0">استعادة</button></span></div>
    <div class="row" style="justify-content:center;gap:8px">${F.pg > 1 ? `<a class="btn" href="${u({ pg: F.pg - 1 })}">السابق</a>` : ""}${F.pg < np ? `<a class="btn" href="${u({ pg: F.pg + 1 })}">التالي</a>` : ""}</div>`;
  }
  const count = () => { const n = $("#mgn"); if (n) n.textContent = toAr(sel.size) + " محدد"; };

  // نافذة تعديل/نقل: لعنصر واحد كل الحقول، وللمجموعة الحقول التي تختار تغييرها فقط
  function editDlg(ids) {
    const one = ids.length === 1 ? raw().find(b => b.id === ids[0]) : null;
    const anyBook = ids.some(id => kindOfId(id) === "book");
    openDlg(`<h3>${one ? "تعديل: " + esc(one.title) : "نقل وتعديل " + toAr(ids.length) + " مادة"}</h3>
     ${one ? "" : `<p class="mut">اترك الحقل على «بلا تغيير» ليبقى كما هو في كل مادة.</p><details><summary>المواد المحددة</summary><ul class="mgprev">${ids.slice(0, 40).map(id => `<li>${esc((raw().find(b => b.id === id) || {}).title || id)}</li>`).join("")}${ids.length > 40 ? `<li>و${toAr(ids.length - 40)} أخرى…</li>` : ""}</ul></details>`}
     <form data-form="mgsave">
      ${one ? `<label>العنوان</label><input name="title" value="${esc(one.title)}" required>` : ""}
      <label>المؤلف</label><input name="aq" placeholder="ابحث عن المؤلف…" list="mgal" autocomplete="off"><datalist id="mgal">${sortedAuthors().map(a => `<option value="${esc(a.name)}">`).join("")}</datalist>
      <select name="author">${one ? "" : '<option value="">— بلا تغيير —</option>'}${opt(sortedAuthors(), one ? one.authorId : "")}</select>
      <p class="mut">النقل إلى مؤلف آخر يكون عند ثبوت خطأ النسبة. لإضافة مؤلف جديد استعمل «الأقسام والأسماء ← المؤلفون».</p>
      <label>التصنيف</label><select name="topic">${one ? "" : '<option value="">— بلا تغيير —</option>'}${opt(lib.topics.filter(t => one ? (isArt(one) ? t.for === "articles" : t.for !== "articles") : true), one ? one.topicId : "")}</select>
      <label>القسم</label><select name="col">${one ? "" : '<option value="">— بلا تغيير —</option>'}${["dawah", "turath"].map(v => `<option value="${v}"${one && (one.col || "dawah") === v ? " selected" : ""}>${esc(COL[v])}</option>`).join("")}</select>
      ${!one && anyBook && ids.some(id => kindOfId(id) === "article") ? '<p class="note">التحديد يجمع كتبًا ومقالات؛ التصنيف يُطبَّق على ما يناسبه فقط.</p>' : ""}
      <label>ملاحظة السجل (اختياري)</label><input name="note" placeholder="مثال: تصحيح نسبة بعد المراجعة">
      <div class="savebar"><button class="btn p">${one ? "حفظ" : "مراجعة ثم تنفيذ"}</button> <span id="mgst" class="mut" role="status"></span></div></form>`);
    const f = $("#dlgb form"); f.dataset.ids = JSON.stringify(ids);
    f.aq.oninput = () => { const a = lib.authors.find(x => x.name === f.aq.value); if (a) f.author.value = a.id; };
  }
  async function saveForm(f) {
    const ids = JSON.parse(f.dataset.ids), fd = new FormData(f), st = $("#mgst"), one = ids.length === 1 ? raw().find(b => b.id === ids[0]) : null, list = [];
    const topicOk = (id, tid) => { const t = lib.topics.find(x => x.id === tid); return t && ((kindOfId(id) === "article") === (t.for === "articles")); };
    ids.forEach(id => {
      if (one && fd.get("title").trim() && fd.get("title").trim() !== one.title) list.push({ id, field: "title", to: fd.get("title").trim() });
      ["author", "topic", "col"].forEach(k => { const v = fd.get(k); if (v && (k !== "topic" || topicOk(id, v))) list.push({ id, field: k, to: v }); });
    });
    const items = raw(), real = list.filter(c => { const it = items.find(b => b.id === c.id); return it && cur(it, c.field) !== c.to; });
    if (!real.length) { st.textContent = "لا تغيير."; return; }
    if (!one && !confirm(`سيُطبَّق ${real.length} تغييرًا على ${new Set(real.map(c => c.id)).size} مادة. متابعة؟`)) return;
    f.querySelector("button").disabled = true; st.textContent = "جارٍ الحفظ…";
    try { const d = await apply(real, one ? "edit" : "move", fd.get("note") || (one ? "تعديل «" + one.title + "»" : "نقل جماعي")); dlg().close(); sel.clear(); toast("حُفظ " + toAr(d.length) + " تغييرًا، ويظهر للجميع خلال دقيقة."); route(); }
    catch (e) { st.textContent = e.message; f.querySelector("button").disabled = false; }
  }
  async function hide(ids, v) {
    const items = raw(), list = ids.filter(id => { const it = items.find(b => b.id === id); return it && !!it.hidden !== v; }).map(id => ({ id, field: "hidden", to: v }));
    if (!list.length) return toast(v ? "المحدد مخفي أصلًا." : "المحدد ظاهر أصلًا.");
    if (!confirm((v ? "إخفاء " : "استعادة ") + toAr(list.length) + " مادة؟" + (v ? "\nتُحجب عن الزوار وتبقى للمشرفين، ويمكن استعادتها." : ""))) return;
    try { await apply(list, v ? "hide" : "restore", (v ? "إخفاء " : "استعادة ") + list.length + " مادة"); sel.clear(); toast("تم."); route(); } catch (e) { alert(e.message); }
  }

  // ===== سجل التعديلات =====
  async function logBody() {
    const box = $("#mglog"); if (!box) return;
    let o; try { o = JSON.parse((await GH.get(LOG)).text); } catch (e) { o = { items: [] }; }
    const items = (o && o.items) || [];
    box.innerHTML = items.length ? items.slice(0, 200).map(e => `<div class="mglog${e.undone ? " und" : ""}"><div><b>${esc(e.note || e.op)}</b> <span class="mut">• ${new Date(e.at).toLocaleString("ar-EG")} • ${esc(e.by && e.by.role || "")}</span>${e.undone ? ' <em class="tag">تُرُوجِع عنه</em>' : ""}</div>
      <details><summary>${toAr((e.changes || []).length)} تغييرًا على ${toAr((e.ids || []).length)} مادة</summary><ul>${(e.changes || []).slice(0, 60).map(c => `<li>${esc((raw().find(b => b.id === c.id) || {}).title || c.id)}: ${LABEL[c.field] || c.field} «${esc(fmtV(c.field, c.from))}» ← «${esc(fmtV(c.field, c.to))}»</li>`).join("")}</ul></details>
      ${!e.undone && e.op !== "undo" && e.op !== "switch" ? `<button class="btn s" data-act="mgundo" data-id="${esc(e.id)}">تراجع</button>` : ""}</div>`).join("") : '<p class="note">لا توجد تعديلات مسجلة بعد.</p>';
    box._items = items;
  }
  async function undo(id) {
    const box = $("#mglog"), e = (box && box._items || []).find(x => x.id === id); if (!e) return;
    const items = raw(), list = [], skip = [];
    (e.changes || []).forEach(c => { const it = items.find(b => b.id === c.id); if (!it) return skip.push(c); (cur(it, c.field) === c.to ? list : skip).push({ id: c.id, field: c.field, to: c.from }); });
    if (!list.length) return alert("لا يمكن التراجع: تغيّرت هذه المواد بعد العملية.");
    if (!confirm(`التراجع عن ${toAr(list.length)} تغييرًا${skip.length ? ` (ويُترك ${toAr(skip.length)} لأنه تغيّر بعدها)` : ""}؟`)) return;
    try {
      await apply(list, "undo", "«" + (e.note || e.op) + "»");
      await GH.editJSON(LOG, o => { const x = (o.items || []).find(y => y.id === id); if (x) x.undone = new Date().toISOString(); return o; }, "سجل التعديلات: تعليم تراجع", true);
      toast("تم التراجع."); logBody();
    } catch (err) { alert(err.message); }
  }

  // ===== الخدمات والمفاتيح =====
  const SWITCHES = [
    ["خدمات الموقع", [["ask", "المساعد العلمي («اسأل المكتبة»)"], ["translate", "الترجمة السياقية وترجمة الصفحات"], ["import", "الاستيراد اليدوي من صوت السلف (api/import)"], ["notify", "التذكير وإشعارات الأجهزة"]]],
    ["المهام الآلية (GitHub Actions)", [["all_jobs", "كل المهام الآلية (المفتاح الرئيسي)"], ["import_salafvoice", "استيراد مقالات صوت السلف اليومي"], ["ocr", "تحويل الكتب المصورة إلى نص"], ["tashkeel", "التشكيل"], ["curate", "انتقاء منشورات المشايخ وتدقيق سؤال وجواب"], ["tashjir", "تشجير الكتب"], ["import_turath", "استيراد كتب المكتبة العامة (OpenITI وturath.io)"], ["i18n", "ترجمة الأسماء والعناوين للواجهة الإنجليزية"], ["tts", "تحويل النص إلى صوت"], ["cards", "بطاقات تعريف الكتب"], ["gloss", "فهرس معاني الكلمات"], ["review", "مراجعة الصفحات"]]]];
  async function swBody() {
    const box = $("#mgsw"); if (!box) return;
    let o; try { o = JSON.parse((await GH.get(SW)).text) || {}; } catch (e) { o = {}; }
    const s = o.s || {};
    box.innerHTML = `<p class="mut">أوقف أي خدمة أو مهمة آلية مؤقتًا وأعد تشغيلها متى شئت. يسري التغيير خلال دقائق دون إعادة نشر. المهمة الموقوفة تُتخطى في كل تشغيل (المجدول واليدوي) حتى تعيد تفعيلها هنا. ${o.at ? "آخر تعديل: " + new Date(o.at).toLocaleString("ar-EG") : ""}</p>
     <form data-form="mgsw">${SWITCHES.map(([g, l]) => `<h3>${g}</h3>${l.map(([k, n]) => `<label class="swrow"><input type="checkbox" name="${k}"${s[k] === false ? "" : " checked"}> <span>${esc(n)}</span> <em class="tag ${s[k] === false ? "off" : "on"}">${s[k] === false ? "موقوفة" : "تعمل"}</em></label>`).join("")}`).join("")}
     <div class="savebar"><button class="btn p">حفظ المفاتيح</button> <span id="swst" class="mut" role="status"></span></div></form>`;
  }
  async function swSave(f) {
    const st = $("#swst"), s = {}, all = SWITCHES.flatMap(([, l]) => l.map(([k]) => k));
    all.forEach(k => { if (!f[k].checked) s[k] = false; });
    if (!GH.on) { st.textContent = "يحتاج حساب مشرف."; return; }
    st.textContent = "جارٍ الحفظ…";
    try {
      let before = {}; await GH.editJSON(SW, o => { before = (o && o.s) || {}; return { v: 1, at: new Date().toISOString(), by: who().role, s }; }, "مفاتيح الخدمات: " + (Object.keys(s).length ? "موقوف " + Object.keys(s).join("، ") : "كلها تعمل"), false);
      const ch = all.filter(k => (before[k] !== false) !== (s[k] !== false)).map(k => ({ id: k, kind: "settings", field: "switch", from: before[k] !== false, to: s[k] !== false }));
      if (ch.length) await log({ op: "switch", kind: "settings", ids: ch.map(c => c.id), changes: ch, note: "مفاتيح الخدمات" });
      toast("حُفظت المفاتيح."); swBody();
    } catch (e) { st.textContent = e.message; }
  }

  // ===== الضغط المطول/الزر الأيمن على بطاقة =====
  let lpT = 0, lpFired = false;
  const cardId = a => { const m = (a.getAttribute("href") || "").match(/#\/book\/([^/?]+)/); return m && decodeURIComponent(m[1]); };
  function menu(id, x, y) {
    const it = raw().find(b => b.id === id); if (!it) return;
    openSheet(it.title, `<div class="tools-grid"><button data-act="mgedit" data-id="${esc(id)}">✎ تعديل البيانات أو النقل</button><button data-act="mghide1" data-id="${esc(id)}" data-v="${it.hidden ? 0 : 1}">${it.hidden ? "↺ استعادة" : "⊘ إخفاء"}</button><a href="#/book/${encodeURIComponent(id)}/1">فتح</a><a href="#/admin?t=items&q=${encodeURIComponent(it.title.slice(0, 30))}">في «إدارة المواد»</a></div>`);
  }
  const staff = () => typeof Cloud !== "undefined" && (Cloud.staff() || GH.token);
  document.addEventListener("pointerdown", e => { const a = e.target.closest("a.bk"); if (!a || !staff() || e.button) return; lpFired = false; clearTimeout(lpT);
    lpT = setTimeout(() => { const id = cardId(a); if (id) { lpFired = true; menu(id); } }, 550); });
  ["pointerup", "pointercancel", "pointermove"].forEach(ev => document.addEventListener(ev, e => { if (ev === "pointermove" && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return; clearTimeout(lpT); }, { passive: true }));
  document.addEventListener("click", e => { if (lpFired && e.target.closest("a.bk")) { e.preventDefault(); e.stopImmediatePropagation(); lpFired = false; } }, true);
  document.addEventListener("contextmenu", e => { const a = e.target.closest("a.bk"); if (!a || !staff()) return; const id = cardId(a); if (!id) return; e.preventDefault(); menu(id); });

  // ===== الأفعال =====
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=mg]"); if (!el) return; const a = el.dataset.act;
    if (a === "mgedit") { e.preventDefault(); closeSheet(); editDlg([el.dataset.id]); }
    else if (a === "mgselpage") { $$("[data-mgid]").forEach(c => { c.checked = true; sel.add(c.dataset.mgid); }); count(); }
    else if (a === "mgselall") { filtered().forEach(b => sel.add(b.id)); $$("[data-mgid]").forEach(c => c.checked = true); count(); }
    else if (a === "mgselnone") { sel.clear(); $$("[data-mgid]").forEach(c => c.checked = false); count(); }
    else if (a === "mgmove") { if (!sel.size) return toast("حدّد مادة أولًا."); editDlg([...sel]); }
    else if (a === "mghide") { if (!sel.size) return toast("حدّد مادة أولًا."); hide([...sel], el.dataset.v === "1"); }
    else if (a === "mghide1") { closeSheet(); hide([el.dataset.id], el.dataset.v === "1"); }
    else if (a === "mgundo") undo(el.dataset.id);
  });
  document.addEventListener("change", e => { const c = e.target.closest("[data-mgid]"); if (!c) return; c.checked ? sel.add(c.dataset.mgid) : sel.delete(c.dataset.mgid); count(); });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f.dataset || !/^mg/.test(f.dataset.form || "")) return; e.preventDefault();
    if (f.dataset.form === "mgfilter") { const p = new URLSearchParams({ t: "items" }); new FormData(f).forEach((v, k) => v && p.set(k, v)); location.hash = "#/admin?" + p; }
    else if (f.dataset.form === "mgsave") saveForm(f);
    else if (f.dataset.form === "mgsw") swSave(f);
  }, true);

  return {
    tabs: () => [["items", "إدارة المواد"], ["log", "سجل التعديلات"]].concat(isAdmin() ? [["switches", "الخدمات والمفاتيح"]] : []),
    body(tab, q) {
      if (tab === "items") { setTimeout(count, 0); return itemsBody(q); }
      if (tab === "log") { setTimeout(logBody, 0); return `${needGH()}<p class="mut">كل تعديل أو نقل أو إخفاء من «إدارة المواد»، وكل تغيير في مفاتيح الخدمات. «تراجع» يعيد القيم السابقة لما لم يتغير بعد العملية، ويُسجَّل التراجع نفسه.</p><div id="mglog" class="mut">جارٍ التحميل…</div>`; }
      if (tab === "switches") { setTimeout(swBody, 0); return `${needGH()}<div id="mgsw" class="mut">جارٍ التحميل…</div>`; }
      return null;
    }, apply, undo
  };
})();
