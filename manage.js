/* إدارة المواد (الباب الثاني ١ من وثيقة التطوير):
   - تبويب «إدارة المواد»: تصفية الكتب والمقالات، واختيار فردي أو جماعي، وتعديل البيانات، والنقل بين المؤلفين والتصنيفات والأقسام، والإخفاء والاستعادة.
   - الضغط المطول (أو الزر الأيمن) على بطاقة مادة يفتح قائمة إجراءات للمشرف، وكل إجراء متاح أيضًا من التبويب.
   - «سجل التعديلات»: كل عملية تُسجَّل في data/admin-log.json بقيمها السابقة واللاحقة، ويمكن التراجع عنها.
   - «الخدمات والمفاتيح»: data/switches.json يوقف خدمات الموقع والمهام الآلية ويعيد تشغيلها.
   لا حذف نهائي: «الإخفاء» يحجب المادة عن الزوار ويبقيها للمشرفين وفي السجل. */
const MG = (() => {
  const LOG = "data/admin-log.json", SW = "data/switches.json", PER = 50;
  const FIELDS = { title: ["title", "t"], author: ["authorId", "a"], topic: ["topicId", "tp"], col: ["col", "col"], hidden: ["hidden", "h"], set: ["set", "set"], setTitle: ["setTitle", "setTitle"], vol: ["vol", "vol"], vols: ["vols", "vols"], ed: ["ed", "ed"], tps: ["tps", "tps"] };
  const LABEL = { title: "العنوان", author: "المؤلف", topic: "التصنيف", col: "القسم", hidden: "الإخفاء", set: "العمل", setTitle: "عنوان العمل", vol: "رقم المجلد", vols: "عدد المجلدات", file: "ملف النص", create: "إضافة", mergedInto: "دُمج في", ed: "الطبعة", tps: "موضوعات إضافية" };
  const kindOfId = id => (CAT.books.some(b => b.id === id) ? "book" : "article");
  const raw = () => CAT.books.filter(b => !b.demo).concat(ARTS_IDX);
  const sel = new Set();
  let F = {};
  const who = () => ({ role: (typeof Cloud !== "undefined" && Cloud.role) || (GH.token ? "key" : "?"), uid: Auth.user ? String(Auth.user.id).slice(0, 8) : "" });
  const fmtV = (field, v) => field === "author" ? (A(v).name || v) : field === "topic" ? (T(v).name || v) : field === "col" ? (COL[v] || v || COL.dawah) : field === "hidden" ? (v ? "مخفي" : "ظاهر") : field === "tps" ? (Array.isArray(v) && v.length ? v.map(t => T(t).name || t).join("، ") : "—") : field === "ed" ? (v && typeof v === "object" ? (typeof ED !== "undefined" ? ED.label(v, 1) : JSON.stringify(v)) + (v.main ? " (المعتمدة)" : "") : String(v ?? "—")) : String(v ?? "");
  // المواد المحمّلة كلها بأسماء حقول الكتب (المقالات تُحوَّل بـ artFromIdx)، أما الملفات فالمقالات فيها بأسماء مختصرة
  const cur = (it, field) => field === "col" ? (it.col || "dawah") : field === "hidden" ? !!it.hidden : it[FIELDS[field][0]];

  // يطبّق قائمة تغييرات [{id,field,to}] على الملفات (آخر نسخة من المستودع)، ويعيد التغييرات الفعلية بقيمها السابقة
  async function apply(list, op, note, quiet) {
    if (!GH.on) throw new Error("الحفظ يحتاج حساب مشرف (أو مفتاح الإدارة المباشرة).");
    const books = list.filter(c => kindOfId(c.id) === "book"), arts = list.filter(c => kindOfId(c.id) === "article"), done = [];
    const run = (rows, kind) => obj => {
      const arr = kind === "book" ? obj.books : obj.items, by = new Map(arr.map(x => [x.id, x]));
      rows.forEach(c => {
        const x = by.get(c.id); if (!x) return; const k = FIELDS[c.field][kind === "book" ? 0 : 1];
        const from = c.field === "col" ? (x[k] || "dawah") : c.field === "hidden" ? !!x[k] : x[k];
        if (from === c.to) return;
        if ((c.field === "hidden" || c.field === "tps") && !c.to) delete x[k]; else if (c.field === "col" && c.to === "dawah" && kind === "article") delete x[k]; else x[k] = c.to;
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
      const k = FIELDS[c.field][0]; if ((c.field === "hidden" || c.field === "tps") && !c.to) delete x[k]; else x[k] = c.to;
    });
    merge();
    if (done.length && !quiet) await log({ op, kind: [...new Set(done.map(c => c.kind))].join("+"), ids: [...new Set(done.map(c => c.id))], changes: done, note });
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
      ${one ? `<label>موضوعات إضافية (تظهر المادة فيها أيضًا دون نسخة مكررة)</label><select name="tps" multiple size="5">${lib.topics.filter(t => (isArt(one) ? t.for === "articles" : t.for !== "articles") && t.id !== one.topicId).map(t => `<option value="${esc(t.id)}"${(one.tps || []).includes(t.id) ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>` : ""}
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
      if (one) { const tp = fd.getAll("tps").filter(t => t !== (fd.get("topic") || one.topicId)), old = one.tps || []; if (tp.join() !== old.join()) list.push({ id, field: "tps", to: tp.length ? tp : null }); }
      ["author", "topic", "col"].forEach(k => { const v = fd.get(k); if (v && (k !== "topic" || topicOk(id, v))) list.push({ id, field: k, to: v }); });
    });
    const items = raw(), real = list.filter(c => { const it = items.find(b => b.id === c.id); return it && JSON.stringify(cur(it, c.field) ?? null) !== JSON.stringify(c.to ?? null); });
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
      ${!e.undone && e.op !== "undo" && e.op !== "switch" && e.op !== "file" && e.op !== "mark" ? `<button class="btn s" data-act="mgundo" data-id="${esc(e.id)}">تراجع</button>` : ""}</div>`).join("") : '<p class="note">لا توجد تعديلات مسجلة بعد.</p>';
    box._items = items;
  }
  async function undo(id) {
    const box = $("#mglog"), e = (box && box._items || []).find(x => x.id === id); if (!e) return;
    if (e.op === "amerge") { try { await unmergeAuthor(e); } catch (err) { alert(err.message); } return; }
    if (e.op === "add") { if (!confirm("التراجع عن الإضافة يُخفي المواد المضافة (" + toAr((e.ids || []).length) + ") ولا يحذفها. متابعة؟")) return;
      try { await apply((e.ids || []).filter(i => raw().some(b => b.id === i)).map(i => ({ id: i, field: "hidden", to: true })), "undo", "«" + (e.note || e.op) + "»");
        await GH.editJSON(LOG, o => { const x = (o.items || []).find(y => y.id === id); if (x) x.undone = new Date().toISOString(); return o; }, "سجل التعديلات: تعليم تراجع", true); toast("أُخفيت المواد المضافة."); logBody(); } catch (err) { alert(err.message); } return; }
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
    ["المهام الآلية (GitHub Actions)", [["all_jobs", "كل المهام الآلية (المفتاح الرئيسي)"], ["import_salafvoice", "استيراد مقالات صوت السلف اليومي"], ["ocr", "تحويل الكتب المصورة إلى نص"], ["tashkeel", "التشكيل"], ["curate", "انتقاء منشورات المشايخ وتدقيق سؤال وجواب"], ["tashjir", "تشجير الكتب"], ["import_turath", "استيراد كتب المكتبة العامة (OpenITI وturath.io)"], ["i18n", "ترجمة الأسماء والعناوين للواجهة الإنجليزية"], ["tts", "تحويل النص إلى صوت"], ["cards", "بطاقات تعريف الكتب"], ["gloss", "فهرس معاني الكلمات"], ["alam", "فهرس الأعلام والرواة"], ["review", "مراجعة الصفحات"]]]];
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


  // ===== كتاب متعدد المجلدات (الباب ٣.٤) =====
  // كل مجلد سجل في الفهرس يجمعه الحقل set، وصفحة الكتاب وقوائمه تعرضه عملًا واحدًا.
  // العدد والمعدود: مجلد واحد، مجلدان، ٣–١٠ مجلدات، ١١ فأكثر مجلدًا
  const nVol = (n, ar) => { const d = ar ? toAr(n) : n; return n === 1 ? "مجلد واحد" : n === 2 ? "مجلدان" : n >= 3 && n <= 10 ? d + " مجلدات" : d + " مجلدًا"; };
  const arDig = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const volFromName = n => { const m = arDig(n.replace(/\.(txt|pdf)$/i, "")).match(/(?:ج|جزء|مجلد|vol|v|part)[\s_.-]*(\d{1,3})|(\d{1,3})(?!.*\d)/i); return m ? +(m[1] || m[2]) : null; };
  const sets = () => { const m = new Map(); raw().filter(b => b.set).forEach(b => { const x = m.get(b.set) || { id: b.set, title: b.setTitle || b.title, vols: [] }; x.vols.push(b); m.set(b.set, x); }); m.forEach(x => x.vols.sort((a, b) => (a.vol || 0) - (b.vol || 0))); return [...m.values()].sort((a, b) => a.title.localeCompare(b.title, "ar")); };
  const volTitle = (t, v) => t + (v ? " — ج " + v : " — المقدمة");
  const toPagesOf = text => splitPages(text, /\n-{3,}\n|\f/.test(text) ? "mark" : "auto", 1800);
  function volsBody() {
    const S = sets(), singles = raw().filter(b => !b.set && !isArt(b)).sort((a, b) => a.title.localeCompare(b.title, "ar"));
    const authors = sortedAuthors();
    return `${needGH()}<p class="mut">العمل متعدد المجلدات يظهر كتابًا واحدًا في المكتبة، وفي صفحته شريط المجلدات للتنقل بينها. كل مجلد يُرفع نصًّا (.txt) أو نسخة مصورة (PDF تُحوَّل إلى نص آليًا). كل ما يُحفظ هنا يُسجَّل في «سجل التعديلات».</p>
    <details open><summary><b>١) عمل جديد بمجلداته</b></summary><form data-form="mgvnew">
     <label>عنوان العمل</label><input name="title" required placeholder="مثال: فتح المجيد شرح كتاب التوحيد">
     <div class="row"><div><label>المؤلف</label><select name="aid">${opt(authors)}<option value="__new">+ مؤلف جديد</option></select><input name="aidnew" placeholder="اسم المؤلف الجديد" style="margin-top:4px"></div>
      <div><label>القسم</label><select name="col"><option value="dawah">${esc(COL.dawah)}</option><option value="turath">${esc(COL.turath)}</option></select></div>
      <div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t => t.for !== "articles"))}</select></div></div>
     <label>بيانات الطبعة (المحقق، الناشر، السنة — اختياري)</label><input name="source">
     <label>ملفات المجلدات (نص .txt أو PDF، يمكن اختيارها كلها معًا)</label><input type="file" name="files" accept=".txt,text/plain,.pdf,application/pdf" multiple required>
     <div id="mgvrows" class="mglist"></div><p id="mgvdup" class="note" hidden></p>
     <div class="savebar"><button class="btn p">حفظ العمل ومجلداته</button> <span id="mgvst" class="mut" role="status"></span></div></form></details>
    <details><summary><b>٢) إضافة مجلد إلى عمل قائم</b> (أو تحويل كتاب مفرد إلى عمل متعدد المجلدات)</summary><form data-form="mgvadd">
     <label>العمل</label><select name="set" required><option value="">— اختر —</option><optgroup label="أعمال متعددة المجلدات">${S.map(x => `<option value="set:${esc(x.id)}">${esc(x.title)} (${nVol(x.vols.length, 1)})</option>`).join("")}</optgroup><optgroup label="كتب مفردة (تصير المجلد الأول)">${singles.map(b => `<option value="book:${esc(b.id)}">${esc(b.title)}</option>`).join("")}</optgroup></select>
     <div class="row"><div><label>رقم المجلد</label><input name="vol" type="number" min="0" required></div><div><label>الملف (.txt أو PDF)</label><input type="file" name="file" accept=".txt,text/plain,.pdf,application/pdf" required></div></div>
     <p class="mut">إن كان رقم المجلد موجودًا يُسأل قبل استبدال نصه، ويبقى النص السابق في تاريخ المستودع.</p>
     <div class="savebar"><button class="btn p">إضافة المجلد</button> <span id="mgvast" class="mut" role="status"></span></div></form></details>
    <details><summary><b>٣) ترتيب مجلدات عمل وتصحيح أرقامها واستبدال ملفاتها</b></summary>
     <label>العمل</label><select id="mgvord"><option value="">— اختر —</option>${S.map(x => `<option value="${esc(x.id)}">${esc(x.title)}</option>`).join("")}</select><div id="mgvordbox"></div></details>`;
  }
  function wireVols() {
    const f = $('form[data-form="mgvnew"]'); if (!f) return;
    f.files.onchange = () => {
      const fs = [...f.files.files].map((x, i) => ({ x, v: volFromName(x.name) })); let next = 1;
      fs.sort((a, b) => (a.v ?? 999) - (b.v ?? 999) || a.x.name.localeCompare(b.x.name, "ar", { numeric: true }));
      fs.forEach(r => { if (r.v == null) r.v = next; next = Math.max(next, r.v + 1); });
      f._rows = fs;
      $("#mgvrows").innerHTML = fs.map((r, i) => `<div class="mgrow"><span class="mgt">${esc(r.x.name)} <span class="mut">(${/\.pdf$/i.test(r.x.name) ? "مصور، يُحوَّل إلى نص" : "نص"}، ${toAr(Math.round(r.x.size / 1024))} ك.ب)</span></span><label>ج <input type="number" min="0" value="${r.v}" data-vi="${i}" style="width:70px"></label></div>`).join("");
      const dups = fs.map(r => r.v).filter((v, i, a) => a.indexOf(v) !== i);
      $("#mgvdup").hidden = !dups.length; $("#mgvdup").textContent = dups.length ? "أرقام مجلدات مكررة: " + [...new Set(dups)].map(toAr).join("، ") + " — صحّحها قبل الحفظ." : "";
    };
    f.title.oninput = () => { const t = norm(f.title.value.trim()); if (t.length < 4) { $("#mgvdup").hidden = true; return; }
      const hit = sets().find(x => norm(x.title) === t) || raw().find(b => !isArt(b) && norm(b.setTitle || b.title) === t);
      $("#mgvdup").hidden = !hit; if (hit) $("#mgvdup").textContent = "يوجد عمل بهذا العنوان: «" + (hit.title || hit.setTitle) + "». لإضافة مجلدات إليه استعمل القسم ٢ حتى لا يتكرر السجل."; };
    const o = $("#mgvord"); if (o) o.onchange = () => ordBox(o.value);
  }
  // حفظ نصوص المجلدات في إيداع واحد ثم إضافة سجلاتها إلى الفهرس (قراءة آخر نسخة)، ثم تسجيل العملية
  async function saveTextVols(metas, shards, note) {
    await GH.batch(metas.map((m, i) => ({ path: "data/books/" + m.id + ".json", text: JSON.stringify(shards[i]) })), "مجلدات: " + note, t => { const st = $("#mgvst") || $("#mgvast"); if (st) st.textContent = t; });
    const created = [];
    await GH.editJSON("data/catalog.json", c => { metas.forEach(m => { const ex = c.books.find(b => b.id === m.id); if (ex) Object.assign(ex, m); else { c.books.push(m); created.push(m.id); } }); c.version = Date.now(); return c; }, "فهرس: " + note, true);
    metas.forEach((m, i) => { SH.set(m.id, shards[i]); const ex = CAT.books.find(b => b.id === m.id); if (ex) Object.assign(ex, m); else CAT.books.push(m); });
    merge();
    if (created.length) await log({ op: "add", kind: "book", ids: created, changes: created.map(id => ({ id, kind: "book", field: "create", from: null, to: (metas.find(m => m.id === id) || {}).title })), note });
  }
  async function syncVols(setId) { // عدد المجلدات في كل سجلات العمل
    const vs = raw().filter(b => b.set === setId), n = Math.max(vs.length, ...vs.map(b => +b.vol || 0));
    const ch = vs.filter(b => b.vols !== n).map(b => ({ id: b.id, field: "vols", to: n }));
    if (ch.length) await apply(ch, "edit", "عدد مجلدات «" + (vs[0].setTitle || "") + "»");
  }
  async function newWork(f) {
    const st = $("#mgvst"), fd = new FormData(f), rows = f._rows || [];
    if (!rows.length) return st.textContent = "اختر ملفات المجلدات.";
    rows.forEach((r, i) => { const inp = f.querySelector(`[data-vi="${i}"]`); r.v = +inp.value; });
    const vs = rows.map(r => r.v); if (new Set(vs).size !== vs.length) return st.textContent = "أرقام المجلدات مكررة.";
    const title = String(fd.get("title")).trim(), col = fd.get("col"); if (!title) return;
    if (!confirm(`حفظ «${title}» في ${nVol(rows.length, 1)}؟`)) return;
    f.querySelector("button").disabled = true;
    try {
      const aid = await newAuthor(fd, "aid", col), setId = "s" + Date.now().toString(36), base = { set: setId, setTitle: title, vols: Math.max(rows.length, ...vs), authorId: aid, topicId: fd.get("tid"), col, type: "book", source: String(fd.get("source") || "").trim(), added: today() };
      const texts = rows.filter(r => !/\.pdf$/i.test(r.x.name)), pdfs = rows.filter(r => /\.pdf$/i.test(r.x.name)), metas = [], shards = [];
      for (const r of texts) { st.textContent = "قراءة " + r.x.name + "…"; const pages = toPagesOf(await r.x.text()); if (!pages.length) throw new Error("ملف فارغ: " + r.x.name);
        const id = setId + "-v" + String(r.v).padStart(2, "0"), sh = { id, pages, toc: [] }, s = JSON.stringify(sh);
        metas.push(Object.assign({}, base, { id, vol: r.v, title: volTitle(title, r.v), n: pages.length, size: s.length })); shards.push(sh); }
      if (metas.length) await saveTextVols(metas, shards, "«" + title + "» (" + nVol(metas.length) + (metas.length > 2 && metas.length < 11 ? " نصية" : " نصي") + ")");
      for (const r of pdfs) { const b0 = "up" + Date.now().toString(36) + "v" + r.v;
        await pdfUpload(r.x, b0, { title, setTitle: title, set: setId, vol: r.v, authorId: aid, topic: fd.get("tid"), col, source: base.source, ocr: true }, t => st.textContent = t); }
      if (pdfs.length) await log({ op: "file", kind: "book", ids: [setId], changes: pdfs.map(r => ({ id: setId + "/ج" + r.v, kind: "book", field: "file", from: null, to: r.x.name })), note: "رفع " + nVol(pdfs.length) + (pdfs.length > 2 && pdfs.length < 11 ? " مصورة" : " مصور") + " لـ«" + title + "» للتحويل" });
      st.textContent = "✓ حُفظ" + (metas.length ? ` ${nVol(metas.length, 1)} ${metas.length > 2 && metas.length < 11 ? "نصية" : "نصي"} (تظهر خلال دقيقة)` : "") + (pdfs.length ? `، ورُفع ${nVol(pdfs.length, 1)} ${pdfs.length > 2 && pdfs.length < 11 ? "مصورة" : "مصور"} للتحويل (${pdfs.length > 1 ? "تظهر" : "يظهر"} بعد اكتمال تحويله)` : "") + ".";
      f.reset(); $("#mgvrows").innerHTML = ""; f._rows = [];
    } catch (e) { st.textContent = e.message; } finally { f.querySelector("button").disabled = false; }
  }
  async function addVol(f) {
    const st = $("#mgvast"), fd = new FormData(f), file = f.file.files[0], vol = +fd.get("vol"), [kind, ref] = String(fd.get("set")).split(":");
    if (!file || !ref) return; f.querySelector("button").disabled = true;
    try {
      let setId = ref, first;
      if (kind === "book") { // تحويل كتاب مفرد إلى المجلد الأول من عمل
        first = raw().find(b => b.id === ref); setId = "s" + Date.now().toString(36);
        if (vol === 1) throw new Error("الكتاب نفسه سيصير المجلد ١؛ اختر رقمًا آخر للمجلد الجديد.");
        await apply([{ id: first.id, field: "set", to: setId }, { id: first.id, field: "setTitle", to: first.title }, { id: first.id, field: "vol", to: 1 }, { id: first.id, field: "title", to: volTitle(first.title, 1) }], "edit", "تحويل «" + first.title + "» إلى عمل متعدد المجلدات");
      } else first = raw().find(b => b.set === setId);
      const setTitle = first.setTitle || first.title.replace(/\s+—\s+ج\s+\d+$/, ""), ex = raw().find(b => b.set === setId && +b.vol === vol);
      if (ex && !confirm(`المجلد ${toAr(vol)} موجود («${ex.title}»). استبدال نصه؟`)) throw new Error("أُلغي.");
      if (/\.pdf$/i.test(file.name)) {
        await pdfUpload(file, "up" + Date.now().toString(36) + "v" + vol, Object.assign({ title: setTitle, setTitle, set: setId, vol, authorId: first.authorId, topic: first.topicId, col: first.col || "dawah", source: first.source || "", ocr: true }, ex ? { book: ex.id } : {}), t => st.textContent = t);
        await log({ op: "file", kind: "book", ids: [ex ? ex.id : setId], changes: [{ id: ex ? ex.id : setId + "/ج" + vol, kind: "book", field: "file", from: ex ? ex.title : null, to: file.name }], note: "رفع المجلد " + vol + " من «" + setTitle + "» للتحويل" });
        st.textContent = "✓ رُفع للتحويل، ويظهر بعد اكتماله.";
      } else {
        const pages = toPagesOf(await file.text()); if (!pages.length) throw new Error("الملف فارغ.");
        const id = ex ? ex.id : setId + "-v" + String(vol).padStart(2, "0"), sh = { id, pages, toc: [] }, sz = JSON.stringify(sh).length;
        const meta = Object.assign({}, ex || { set: setId, setTitle, authorId: first.authorId, topicId: first.topicId, col: first.col || "dawah", type: "book", source: first.source || "", added: today() }, { id, vol, title: volTitle(setTitle, vol), n: pages.length, size: sz });
        await saveTextVols([meta], [sh], (ex ? "استبدال" : "إضافة") + " المجلد " + vol + " من «" + setTitle + "»");
        if (ex) await log({ op: "file", kind: "book", ids: [id], changes: [{ id, kind: "book", field: "file", from: "النص السابق (في تاريخ المستودع)", to: file.name }], note: "استبدال نص المجلد " + vol + " من «" + setTitle + "»" });
        st.textContent = "✓ حُفظ المجلد " + toAr(vol) + "، ويظهر خلال دقيقة.";
      }
      await syncVols(setId);
    } catch (e) { st.textContent = e.message; } finally { f.querySelector("button").disabled = false; }
  }
  function ordBox(setId) {
    const box = $("#mgvordbox"); if (!setId) { box.innerHTML = ""; return; }
    const x = sets().find(s => s.id === setId); if (!x) return;
    box.innerHTML = `<form data-form="mgvord" data-set="${esc(setId)}"><label>عنوان العمل</label><input name="st" value="${esc(x.title)}">
     <div class="mglist">${x.vols.map(b => `<div class="mgrow"><label>ج <input type="number" min="0" name="v:${esc(b.id)}" value="${+b.vol || 0}" style="width:70px"></label><span class="mgt">${esc(b.title)} <span class="mut">(${toAr(b.n || 0)} صفحة)</span></span><label class="btn s">استبدال النص<input type="file" accept=".txt,text/plain" data-rep="${esc(b.id)}" hidden></label></div>`).join("")}</div>
     <div class="savebar"><button class="btn p">حفظ الترتيب والعنوان</button> <span id="mgvost" class="mut" role="status"></span></div></form>`;
    $$("[data-rep]").forEach(inp => inp.onchange = async () => { const b = raw().find(y => y.id === inp.dataset.rep), file = inp.files[0], st = $("#mgvost"); if (!file || !confirm("استبدال نص «" + b.title + "» بالملف " + file.name + "؟")) return;
      try { const pages = toPagesOf(await file.text()), sh = { id: b.id, pages, toc: [] }; await saveTextVols([Object.assign({}, b, { n: pages.length, size: JSON.stringify(sh).length })], [sh], "استبدال نص «" + b.title + "»");
        await log({ op: "file", kind: "book", ids: [b.id], changes: [{ id: b.id, kind: "book", field: "file", from: "النص السابق (في تاريخ المستودع)", to: file.name }], note: "استبدال نص «" + b.title + "»" }); st.textContent = "✓ استُبدل النص."; } catch (e) { st.textContent = e.message; } });
  }
  async function saveOrd(f) {
    const st = $("#mgvost"), setId = f.dataset.set, x = sets().find(s => s.id === setId), title = f.st.value.trim(), ch = [];
    const nv = x.vols.map(b => ({ b, v: +f["v:" + b.id].value }));
    if (new Set(nv.map(r => r.v)).size !== nv.length) return st.textContent = "أرقام المجلدات مكررة.";
    nv.forEach(({ b, v }) => { if ((+b.vol || 0) !== v) ch.push({ id: b.id, field: "vol", to: v }); const t = volTitle(title, v); if (b.title !== t) ch.push({ id: b.id, field: "title", to: t }); if (b.setTitle !== title) ch.push({ id: b.id, field: "setTitle", to: title }); });
    if (!ch.length) return st.textContent = "لا تغيير.";
    try { await apply(ch, "edit", "ترتيب مجلدات «" + title + "»"); st.textContent = "✓ حُفظ."; ordBox(setId); } catch (e) { st.textContent = e.message; }
  }

  // ===== كشف التكرار وتوحيد السجلات (ب2-16، ب2-46) =====
  // المؤلف: الاسم نفسه بعد التطبيع، أو اسم قصير كلماته كلها في الاسم الأطول مع اتفاق الاسم الأول والأخير (سعيد السواح ⊂ سعيد محمد السواح).
  // الدمج لا يحذف: ينقل المواد (بالسجل) ويضيف الاسم إلى الأسماء البديلة ويعلّم السجل القديم mergedInto فيحوَّل رابطه إلى المؤلف الموحَّد.
  const TITLES = /^(الشيخ|الدكتور|د|م|أ|المهندس|الإمام|الامام|الحافظ|العلامة|الأستاذ|الاستاذ|فضيلة|المحقق)$/;
  const nameToks = s => norm(String(s || "").replace(/[‎‏‪-‮⁦-⁩﻿]/g, "")).replace(/[.\-ـ]/g, " ").split(/\s+/).filter(w => w && !TITLES.test(w)).map(w => w === "ابو" || w === "أبو" ? "ابو" : w);
  const sameish = (x, y) => { const a = nameToks(x), b = nameToks(y); if (!a.length || !b.length) return 0; const ja = a.join(" "), jb = b.join(" "); if (ja === jb) return 2;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a]; if (s.length < 2) return 0; const L = new Set(l);
    return s.every(w => L.has(w)) && s[0] === l[0] && s[s.length - 1] === l[l.length - 1] ? 1 : 0; };
  const DISTINCT = "data/dup-distinct.json"; // أزواج قرر المشرف أنها لشخصين مختلفين
  let distinct = null;
  async function loadDistinct() { if (distinct) return distinct; try { distinct = new Set((JSON.parse((await GH.get(DISTINCT)).text).pairs || [])); } catch (e) { distinct = new Set(); } return distinct; }
  const pairKey = (a, b) => [a, b].sort().join("|");
  function authorDups() {
    const as = CAT.authors.filter(a => !a.mergedInto), out = [], cnt = id => raw().filter(b => b.authorId === id).length;
    const seen = new Set();
    for (let i = 0; i < as.length; i++) for (let j = i + 1; j < as.length; j++) {
      const x = as[i], y = as[j]; if ((x.col || "dawah") !== (y.col || "dawah")) continue;
      const names = [x.name].concat(x.aliases || []), names2 = [y.name].concat(y.aliases || []);
      let k = 0; names.forEach(n => names2.forEach(m => { k = Math.max(k, sameish(n, m)); }));
      if (x.id === y.id) k = 3; // السجل نفسه مكرر في الفهرس
      if (!k || (x.died && y.died && x.died !== y.died)) continue; // سنة الوفاة المختلفة تعني شخصين
      const key = pairKey(x.id, y.id) + (x.id === y.id ? "#" + i : ""); if (seen.has(key)) continue; seen.add(key);
      const cx = cnt(x.id), cy = cnt(y.id);
      out.push({ x, y, k, cx, cy, key: pairKey(x.id, y.id) });
    }
    return out;
  }
  function itemDups() {
    const g = new Map();
    const sets = new Set(); raw().filter(b => !b.hidden && !(b.set && (sets.has(b.set) || !sets.add(b.set)))).forEach(b => { const t = norm((b.setTitle || b.title || "").replace(/[«»"'()\[\]،,.:؛؟!\-–—]/g, " ")).replace(/\s+/g, " ").trim(); if (t.length < 4) return;
      const k = (isArt(b) ? "a" : "b") + "|" + b.authorId + "|" + t; (g.get(k) || g.set(k, []).get(k)).push(b); });
    return [...g.values()].filter(l => l.length > 1 && !(l.every(b => b.ed && b.ed.w) && new Set(l.map(b => b.ed.w)).size === 1)); // الطبعات المربوطة ليست تكرارًا
  }
  async function dupsBody() {
    const box = $("#mgdup"); if (!box) return;
    const D = await loadDistinct(), ad = authorDups().filter(p => !D.has(p.key)), id = itemDups();
    const an = a => `<b>${esc(a.name)}</b> <span class="mut">(${esc(a.id)}${a.died ? "، ت " + toAr(a.died) + "هـ" : ""})</span>`;
    box.innerHTML = `<p class="mut">يقارن الأسماء بعد إزالة الألقاب والتشكيل وتوحيد الهمزات، ويقترح ما يحتمل أنه سجل واحد. <b>تحقّق من الهوية قبل الدمج</b>: الدمج ينقل الكتب والمقالات ويُبقي الاسم القديم اسمًا بديلًا يطابقه الاستيراد مستقبلًا، ويحوّل رابط المؤلف القديم، ويمكن التراجع عنه من «سجل التعديلات».</p>
     <h3>مؤلفون محتمل تكرارهم (${toAr(ad.length)})</h3>
     <div class="mglist">${ad.map(p => { const [keep, drop] = p.x.id === p.y.id ? [p.x, p.y] : (p.cy > p.cx ? [p.y, p.x] : [p.x, p.y]);
       return `<div class="mgrow"><span class="mgt">${an(p.x)} — ${toAr(p.cx)} مادة<br>${an(p.y)} — ${toAr(p.cy)} مادة<br><em class="tag">${p.k === 3 ? "سجل مكرر بالمعرّف نفسه" : p.k === 2 ? "الاسم نفسه" : "اسم مختصر من الآخر"}</em></span>
        <span><button class="btn p s" data-act="mgamerge" data-keep="${esc(keep.id)}" data-drop="${esc(drop.id)}"${p.x.id === p.y.id ? ' data-same="1"' : ""}>${p.x.id === p.y.id ? "حذف السجل المكرر" : "دمج «" + esc(drop.name) + "» في «" + esc(keep.name) + "»"}</button>
        ${p.x.id === p.y.id ? "" : `<button class="btn s" data-act="mgamerge" data-keep="${esc(drop.id)}" data-drop="${esc(keep.id)}">العكس</button><button class="btn s" data-act="mgdistinct" data-key="${esc(p.key)}">شخصان مختلفان</button>`}</span></div>`; }).join("") || '<p class="note">لا يوجد تكرار محتمل في المؤلفين.</p>'}</div>
     <h3>مواد بالعنوان نفسه للمؤلف نفسه (${toAr(id.length)})</h3>
     <div class="mglist">${id.map(l => `<div class="mgrow"><span class="mgt"><b>${esc(l[0].setTitle || l[0].title)}</b> — ${esc(A(l[0].authorId).name)}<br>${l.map(b => `<a href="#/book/${encodeURIComponent(b.id)}/1">${esc(b.id)}</a> <span class="mut">(${toAr(b.n || 0)} ص${b.source ? "، " + esc(b.source.slice(0, 50)) : ""})</span>`).join("<br>")}</span>
       <span>${l.slice(1).map(b => `<button class="btn s" data-act="mghide1" data-id="${esc(b.id)}" data-v="1">إخفاء ${esc(b.id)}</button>`).join(" ")}</span></div>`).join("") || '<p class="note">لا توجد مواد مكررة.</p>'}</div>
     <p class="mut">ملاحظة: إن كانت المادتان طبعتين مختلفتين للكتاب نفسه فلا تُخفِ إحداهما؛ اربطهما من «طبعات الكتاب».</p>`;
  }
  async function mergeAuthor(keepId, dropId, same) {
    const keep = CAT.authors.find(a => a.id === keepId), drop = CAT.authors.find(a => a.id === dropId); if (!keep || !drop) return;
    if (same) { if (!confirm("السجل «" + keep.name + "» مكرر في الفهرس بالمعرّف نفسه. إزالة النسخة الزائدة؟ (المواد لا تتأثر)")) return;
      await GH.editJSON("data/catalog.json", c => { let seen = false; c.authors = c.authors.filter(a => a.id !== keepId || (seen ? false : (seen = true))); c.version = Date.now(); return c; }, "إزالة سجل مؤلف مكرر: " + keep.name, true);
      let seen = false; CAT.authors = CAT.authors.filter(a => a.id !== keepId || (seen ? false : (seen = true))); merge();
      await log({ op: "file", kind: "author", ids: [keepId], changes: [{ id: keepId, kind: "author", field: "create", from: "سجلان", to: "سجل واحد" }], note: "إزالة سجل مكرر للمؤلف «" + keep.name + "»" });
      toast("أُزيل السجل المكرر."); return dupsBody(); }
    const items = raw().filter(b => b.authorId === dropId);
    if (!confirm(`دمج «${drop.name}» (${toAr(items.length)} مادة) في «${keep.name}»؟\nتأكد أنهما الشخص نفسه.`)) return;
    try {
      const done = items.length ? await apply(items.map(b => ({ id: b.id, field: "author", to: keepId })), "move", "دمج المؤلف «" + drop.name + "» في «" + keep.name + "»", true) : [];
      await GH.editJSON("data/catalog.json", c => { const k = c.authors.find(a => a.id === keepId), d = c.authors.find(a => a.id === dropId); if (!k || !d) return c;
        k.aliases = [...new Set((k.aliases || []).concat([d.name], d.aliases || []).filter(n => n !== k.name))];
        if (!k.photo && d.photo) k.photo = d.photo; if (!k.bio && d.bio) k.bio = d.bio; if (!k.died && d.died) k.died = d.died;
        d.mergedInto = keepId; d.mergedAt = today(); c.version = Date.now(); return c; }, "دمج المؤلف «" + drop.name + "» في «" + keep.name + "»", true);
      keep.aliases = [...new Set((keep.aliases || []).concat([drop.name]))]; drop.mergedInto = keepId; merge();
      await log({ op: "amerge", kind: "author", ids: [dropId, keepId], changes: [{ id: dropId, kind: "author", field: "mergedInto", from: null, to: keepId }].concat(done), note: "دمج المؤلف «" + drop.name + "» في «" + keep.name + "»" });
      toast("دُمج المؤلفان، ونُقل " + toAr(done.length) + " مادة."); dupsBody();
    } catch (e) { alert(e.message); }
  }
  async function unmergeAuthor(e) { // تراجع عن الدمج: إعادة المواد وإلغاء mergedInto
    const ch = e.changes || [], m = ch.find(c => c.field === "mergedInto"); if (!m) return false;
    const items = raw(), back = ch.filter(c => c.field === "author").filter(c => { const it = items.find(b => b.id === c.id); return it && it.authorId === c.to; }).map(c => ({ id: c.id, field: "author", to: c.from }));
    if (!confirm(`فك الدمج وإعادة ${toAr(back.length)} مادة إلى مؤلفها السابق؟`)) return true;
    if (back.length) await apply(back, "undo", "فك دمج المؤلف");
    await GH.editJSON("data/catalog.json", c => { const d = c.authors.find(a => a.id === m.id), k = c.authors.find(a => a.id === m.to); if (d) { delete d.mergedInto; delete d.mergedAt; } if (k && d) k.aliases = (k.aliases || []).filter(n => n !== d.name); c.version = Date.now(); return c; }, "فك دمج مؤلف", true);
    const d = CAT.authors.find(a => a.id === m.id); if (d) delete d.mergedInto; merge();
    await GH.editJSON(LOG, o => { const x = (o.items || []).find(y => y.id === e.id); if (x) x.undone = new Date().toISOString(); return o; }, "سجل التعديلات: تعليم تراجع", true);
    toast("فُكّ الدمج."); logBody(); return true;
  }

  // ===== تقارير الاستيراد والفهرسة وإعادة المحاولة (ب2-18) =====
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + p + "?t=" + Date.now();
  const REPORTS = [["tools/turath-report.md", "استيراد كتب المكتبة العامة (OpenITI)"], ["tools/ocr-report.md", "تحويل الكتب المصورة"], ["data/import-log.txt", "الاستيراد اليومي من صوت السلف"], ["tools/alam-report.md", "فهرس الأعلام والرواة"], ["tools/dedupe-report.md", "التكرار"], ["tools/health-report.md", "الصيانة اليومية"]];
  async function repBody() {
    const box = $("#mgrep"); if (!box) return;
    const [txts, list] = await Promise.all([Promise.all(REPORTS.map(([p]) => fetch(RAW(p)).then(r => r.ok ? r.text() : "").catch(() => ""))), fetch(RAW("tools/turath-list.json")).then(r => r.json()).catch(() => ({ books: [] }))]);
    const byTitle = new Map((list.books || []).map(b => [norm(b.title), b.id]));
    // الكتب التي تعذر استيرادها: أقسام «## العنوان» تليها سطور ✗
    const fails = []; (txts[0] || "").split(/\n(?=## )/).forEach(sec => { const m = sec.match(/^## (.+)\n([\s\S]*)/); if (m && /✗/.test(m[2])) fails.push({ t: m[1].trim(), why: (m[2].match(/✗[^\n]*/) || [""])[0].slice(0, 220), id: byTitle.get(norm(m[1].trim())) }); });
    const lines = t => esc(t).split("\n").slice(-400).map(l => /✗|خطأ|تعذر|فشل|error/i.test(l) ? `<b class="bad">${l}</b>` : /^#+ /.test(l) ? `<b>${l.replace(/^#+ /, "")}</b>` : l).join("\n");
    box.innerHTML = `<p class="mut">تقارير آخر تشغيل للمهام الآلية، وما تعذر استيراده أو فهرسته وسببه. صحّح السبب (مثل اسم الكتاب في OpenITI في tools/turath-list.json أو رفع الملف)، ثم أعد المحاولة.</p>
     <h3>كتب تعذر استيرادها (${toAr(fails.length)})</h3>${fails.length ? `<form data-form="mgretry"><div class="mglist">${fails.map(f => `<label class="mgrow"><input type="checkbox" name="id" value="${esc(f.id || "")}"${f.id ? "" : " disabled"}><span class="mgt"><b>${esc(f.t)}</b><br><span class="mut">${esc(f.why)}</span></span></label>`).join("")}</div>
       <div class="savebar"><button class="btn p">إعادة محاولة المحدد</button> <span id="mgrst" class="mut" role="status"></span></div></form>` : '<p class="mut">لا شيء.</p>'}
     ${REPORTS.map(([p, l], i) => `<details${i === 0 ? "" : ""}><summary><b>${esc(l)}</b> <span class="mut">(${esc(p)})</span></summary><pre class="mgreport">${txts[i] ? lines(txts[i]) : "لا تقرير بعد."}</pre></details>`).join("")}`;
  }
  async function retry(f) {
    const ids = new FormData(f).getAll("id").filter(Boolean), st = $("#mgrst"); if (!ids.length) return st.textContent = "اختر كتابًا.";
    try { await GH.editJSON("data/retry.json", o => Object.assign({}, o || {}, { v: 1, at: new Date().toISOString(), turath: ids }), "إعادة محاولة الاستيراد: " + ids.join("، "), false);
      await log({ op: "file", kind: "book", ids, changes: ids.map(id => ({ id, kind: "book", field: "file", from: null, to: "إعادة محاولة الاستيراد" })), note: "إعادة محاولة استيراد " + ids.length + " كتاب" });
      st.textContent = "✓ بدأت إعادة المحاولة (مهمة الاستيراد)، والنتيجة في هذا التقرير بعد انتهائها."; } catch (e) { st.textContent = e.message; }
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
    else if (a === "mgamerge") mergeAuthor(el.dataset.keep, el.dataset.drop, el.dataset.same === "1");
    else if (a === "mgdistinct") { if (!confirm("تعليمهما شخصين مختلفين فلا يُقترح دمجهما مرة أخرى؟")) return; GH.editJSON(DISTINCT, o => { o = o && o.pairs ? o : { v: 1, pairs: [] }; if (!o.pairs.includes(el.dataset.key)) o.pairs.push(el.dataset.key); return o; }, "تكرار المؤلفين: شخصان مختلفان", true).then(() => { (distinct || (distinct = new Set())).add(el.dataset.key); dupsBody(); }).catch(err => alert(err.message)); }
  });
  document.addEventListener("change", e => { const c = e.target.closest("[data-mgid]"); if (!c) return; c.checked ? sel.add(c.dataset.mgid) : sel.delete(c.dataset.mgid); count(); });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f.dataset || !/^mg/.test(f.dataset.form || "")) return; e.preventDefault();
    if (f.dataset.form === "mgfilter") { const p = new URLSearchParams({ t: "items" }); new FormData(f).forEach((v, k) => v && p.set(k, v)); location.hash = "#/admin?" + p; }
    else if (f.dataset.form === "mgsave") saveForm(f);
    else if (f.dataset.form === "mgsw") swSave(f);
    else if (f.dataset.form === "mgvnew") newWork(f);
    else if (f.dataset.form === "mgvadd") addVol(f);
    else if (f.dataset.form === "mgvord") saveOrd(f);
    else if (f.dataset.form === "mgretry") retry(f);
  }, true);

  return {
    tabs: () => [["items", "إدارة المواد"], ["vols", "كتاب متعدد المجلدات"], ["dups", "التكرار والتوحيد"], ["reports", "تقارير الاستيراد والفهرسة"], ["log", "سجل التعديلات"]].concat(isAdmin() ? [["switches", "الخدمات والمفاتيح"]] : []),
    body(tab, q) {
      if (tab === "items") { setTimeout(count, 0); return itemsBody(q); }
      if (tab === "log") { setTimeout(logBody, 0); return `${needGH()}<p class="mut">كل تعديل أو نقل أو إخفاء من «إدارة المواد»، وكل تغيير في مفاتيح الخدمات. «تراجع» يعيد القيم السابقة لما لم يتغير بعد العملية، ويُسجَّل التراجع نفسه.</p><div id="mglog" class="mut">جارٍ التحميل…</div>`; }
      if (tab === "vols") { setTimeout(wireVols, 0); return volsBody(); }
      if (tab === "reports") { setTimeout(repBody, 0); return `${needGH()}<div id="mgrep" class="mut">جارٍ تحميل التقارير…</div>`; }
      if (tab === "dups") { setTimeout(dupsBody, 0); return `${needGH()}<div id="mgdup" class="mut">جارٍ الفحص…</div>`; }
      if (tab === "switches") { setTimeout(swBody, 0); return `${needGH()}<div id="mgsw" class="mut">جارٍ التحميل…</div>`; }
      return null;
    }, apply, undo, log, sets, volFromName, sameish, nameToks
  };
})();
