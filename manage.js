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
     <div><label>القسم</label><select name="c"><option value="">الكل</option>${["dawah", "turath", "ithra"].map(v => `<option value="${v}"${F.c === v ? " selected" : ""}>${esc(COL[v])}</option>`).join("")}</select></div>
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
      <label>القسم</label><select name="col">${one ? "" : '<option value="">— بلا تغيير —</option>'}${["dawah", "turath", "ithra"].map(v => `<option value="${v}"${one && (one.col || "dawah") === v ? " selected" : ""}>${esc(COL[v])}</option>`).join("")}</select>
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
    ["المهام الآلية (GitHub Actions)", [["all_jobs", "كل المهام الآلية (المفتاح الرئيسي)"], ["import_salafvoice", "استيراد مقالات صوت السلف اليومي"], ["ocr", "تحويل الكتب المصورة إلى نص"], ["tashkeel", "التشكيل"], ["curate", "انتقاء منشورات المشايخ وتدقيق سؤال وجواب"], ["tashjir", "تشجير الكتب"], ["study_ai", "الاختبارات والاختصارات المحرَّرة"], ["edu_ai", "كراسات المكتبة وتجهيز التفريغات"], ["edit", "خدمة التنسيق وإعادة الصياغة"], ["import_turath", "استيراد كتب المكتبة العامة (OpenITI وturath.io)"], ["i18n", "ترجمة الأسماء والعناوين للواجهة الإنجليزية"], ["tts", "تحويل النص إلى صوت"], ["cards", "بطاقات تعريف الكتب"], ["gloss", "فهرس معاني الكلمات"], ["alam", "فهرس الأعلام والرواة"], ["import_sources", "الاستجلاب الدوري من المصادر (أنا السلفي، الفتح، الإثرائية…)"], ["review", "مراجعة الصفحات"]]]];
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
  // الأعمال التي ما زالت مجلداتها في صندوق التحويل (ocr-inbox): تُتاح لإضافة مجلد إليها قبل اكتمال التحويل
  let PEND = null;
  async function pendingSets(force) {
    if (PEND && !force) return PEND; const m = new Map();
    try {
      const L = await (await GH.api("/contents/ocr-inbox?ref=" + GH.branch)).json();
      await Promise.all((Array.isArray(L) ? L : []).filter(x => /\.json$/.test(x.name)).map(async x => {
        try { const c = await (await fetch("https://raw.githubusercontent.com/" + GH.repo + "/" + GH.branch + "/ocr-inbox/" + encodeURIComponent(x.name) + "?t=" + Date.now())).json();
          if (c && c.set) { const s = m.get(c.set) || { id: c.set, title: c.setTitle || c.title, cfg: c, vols: [] }; s.vols.push({ vol: +c.vol || 0, f: x.name.replace(/\.json$/, "") }); m.set(c.set, s); } } catch (e) { }
      }));
    } catch (e) { }
    m.forEach(s => s.vols.sort((a, b) => a.vol - b.vol)); return (PEND = m);
  }
  // بيانات العمل المشتركة لأي مجلد جديد: من مجلد منشور، أو من إعدادات مجلد قيد التحويل
  async function volBase(setId) {
    const f = raw().find(b => b.set === setId);
    if (f) return { setTitle: f.setTitle || f.title.replace(/\s+—\s+ج\s+\d+$/, ""), authorId: f.authorId, topicId: f.topicId, col: f.col || "dawah", source: f.source || "", tags: f.tags };
    const P = (await pendingSets()).get(setId); if (!P) throw new Error("العمل غير موجود.");
    const c = P.cfg; return { setTitle: c.setTitle || c.title, authorId: c.authorId, topicId: c.topic, col: c.col || "dawah", source: c.source || "", tags: c.tags };
  }
  // رفع مجلد (PDF للتحويل أو نص) إلى عمل؛ ex: سجل المجلد القائم بالرقم نفسه (للاستبدال)
  async function putVol(setId, base, vol, file, ex, say) {
    const pend = (await pendingSets()).get(setId);
    if (!ex && pend && pend.vols.some(v => v.vol === vol)) throw new Error("المجلد " + toAr(vol) + " مرفوع وقيد التحويل الآن؛ انتظر اكتماله ثم استبدله إن لزم.");
    if (/\.pdf$/i.test(file.name)) {
      await pdfUpload(file, "up" + Date.now().toString(36) + "v" + vol, Object.assign({ title: base.setTitle, setTitle: base.setTitle, set: setId, vol, authorId: base.authorId, topic: base.topicId, col: base.col, source: base.source, ocr: true }, base.tags ? { tags: base.tags } : {}, ex ? { book: ex.id } : {}), say);
      await log({ op: "file", kind: "book", ids: [ex ? ex.id : setId], changes: [{ id: ex ? ex.id : setId + "/ج" + vol, kind: "book", field: "file", from: ex ? ex.title : null, to: file.name }], note: (ex ? "استبدال" : "رفع") + " المجلد " + vol + " من «" + base.setTitle + "» للتحويل" });
      if (pend) pend.vols.push({ vol, f: "" });
      return "✓ رُفع المجلد " + toAr(vol) + " للتحويل، ويظهر في مكانه بعد اكتماله.";
    }
    const pages = toPagesOf(await file.text()); if (!pages.length) throw new Error("الملف فارغ.");
    const id = ex ? ex.id : setId + "-v" + String(vol).padStart(2, "0"), sh = { id, pages, toc: [] }, sz = JSON.stringify(sh).length;
    const meta = Object.assign({}, ex || { set: setId, setTitle: base.setTitle, authorId: base.authorId, topicId: base.topicId, col: base.col, type: "book", source: base.source, added: today() }, base.tags && !ex ? { tags: base.tags } : {}, { id, vol, title: volTitle(base.setTitle, vol), n: pages.length, size: sz });
    await saveTextVols([meta], [sh], (ex ? "استبدال" : "إضافة") + " المجلد " + vol + " من «" + base.setTitle + "»");
    if (ex) await log({ op: "file", kind: "book", ids: [id], changes: [{ id, kind: "book", field: "file", from: "النص السابق (في تاريخ المستودع)", to: file.name }], note: "استبدال نص المجلد " + vol + " من «" + base.setTitle + "»" });
    if (raw().some(b => b.set === setId)) await syncVols(setId);
    return "✓ حُفظ المجلد " + toAr(vol) + "، ويظهر خلال دقيقة.";
  }
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
     <label>العمل</label><select name="set" required><option value="">— اختر —</option><optgroup label="أعمال متعددة المجلدات">${S.map(x => `<option value="set:${esc(x.id)}">${esc(x.title)} (${nVol(x.vols.length, 1)})</option>`).join("")}</optgroup><optgroup label="أعمال قيد التحويل" data-pend="add"></optgroup><optgroup label="كتب مفردة (تصير المجلد الأول)">${singles.map(b => `<option value="book:${esc(b.id)}">${esc(b.title)}</option>`).join("")}</optgroup></select>
     <div class="row"><div><label>رقم المجلد</label><input name="vol" type="number" min="0" required></div><div><label>الملف (.txt أو PDF)</label><input type="file" name="file" accept=".txt,text/plain,.pdf,application/pdf" required></div></div>
     <p class="mut">إن كان رقم المجلد موجودًا يُسأل قبل استبدال نصه، ويبقى النص السابق في تاريخ المستودع.</p>
     <div class="savebar"><button class="btn p">إضافة المجلد</button> <span id="mgvast" class="mut" role="status"></span></div></form></details>
    <details id="mgvd3"><summary><b>٣) مجلدات العمل: ترتيبها وأرقامها، والناقص منها ورفعه، واستبدال ملفاتها</b></summary>
     <label>العمل</label><select id="mgvord"><option value="">— اختر —</option><optgroup label="أعمال منشورة">${S.map(x => `<option value="${esc(x.id)}">${esc(x.title)} (${nVol(x.vols.length, 1)})</option>`).join("")}</optgroup><optgroup label="أعمال قيد التحويل" data-pend="ord"></optgroup></select><div id="mgvordbox"></div></details>`;
  }
  function wireVols(q) {
    const f = $('form[data-form="mgvnew"]'); if (!f) return;
    pendingSets(true).then(P => { const S = new Set(sets().map(x => x.id)), ps = [...P.values()].filter(x => !S.has(x.id));
      const a = $('[data-pend="add"]'), o = $('[data-pend="ord"]');
      if (a) { a.innerHTML = ps.map(x => `<option value="pend:${esc(x.id)}">${esc(x.title)} (${toAr(x.vols.length)} قيد التحويل: ج ${x.vols.map(v => toAr(v.vol)).join("، ")})</option>`).join(""); if (!ps.length) a.remove(); }
      if (o) { o.innerHTML = ps.map(x => `<option value="${esc(x.id)}">${esc(x.title)} (قيد التحويل)</option>`).join(""); if (!ps.length) o.remove(); }
      if (q && q.s) { const sel = $("#mgvord"); if (sel && [...sel.options].some(op => op.value === q.s)) { sel.value = q.s; $("#mgvd3").open = true; ordBox(q.s); $("#mgvd3").scrollIntoView({ block: "start" }); } }
    });
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
    const vs = raw().filter(b => b.set === setId), n = Math.max(vs.length, ...vs.map(b => +b.vol || 0), ...vs.map(b => +b.vols || 0)); // يُحفظ العدد الكلي المعلن ولو نقصت مجلدات
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
    if (!file || !ref || !vol && vol !== 0) return; f.querySelector("button").disabled = true;
    try {
      let setId = ref;
      if (kind === "book") { // تحويل كتاب مفرد إلى المجلد الأول من عمل
        const first = raw().find(b => b.id === ref); setId = "s" + Date.now().toString(36);
        if (vol === 1) throw new Error("الكتاب نفسه سيصير المجلد ١؛ اختر رقمًا آخر للمجلد الجديد.");
        await apply([{ id: first.id, field: "set", to: setId }, { id: first.id, field: "setTitle", to: first.title }, { id: first.id, field: "vol", to: 1 }, { id: first.id, field: "title", to: volTitle(first.title, 1) }], "edit", "تحويل «" + first.title + "» إلى عمل متعدد المجلدات");
      }
      const base = await volBase(setId), ex = raw().find(b => b.set === setId && +b.vol === vol);
      if (ex && !confirm(`المجلد ${toAr(vol)} موجود («${ex.title}»). استبدال نصه؟`)) throw new Error("أُلغي.");
      st.textContent = await putVol(setId, base, vol, file, ex, t => st.textContent = t); f.reset();
    } catch (e) { st.textContent = e.message; } finally { f.querySelector("button").disabled = false; }
  }
  async function ordBox(setId) {
    const box = $("#mgvordbox"); if (!setId) { box.innerHTML = ""; return; }
    box.innerHTML = '<p class="mut">جارٍ التحميل…</p>';
    const x = sets().find(s => s.id === setId) || { id: setId, title: "", vols: [] }, P = (await pendingSets()).get(setId), pv = P ? P.vols.filter(v => !x.vols.some(b => +b.vol === v.vol)) : [];
    if (!x.title && P) x.title = P.title;
    const have = new Set([...x.vols.map(b => +b.vol || 0), ...pv.map(v => v.vol)]), declared = Math.max(0, ...x.vols.map(b => +b.vols || 0));
    const total = Math.max(declared - (have.has(0) ? 1 : 0), ...have, 1), miss = []; // المقدمة (ج ٠) لا تُعد من المجلدات المرقّمة for (let v = 1; v <= total; v++) if (!have.has(v)) miss.push(v);
    box.innerHTML = `<form data-form="mgvord" data-set="${esc(setId)}">${x.vols.length ? `<div class="row"><div><label>عنوان العمل</label><input name="st" value="${esc(x.title)}"></div><div><label>عدد مجلدات العمل كاملًا</label><input name="tot" type="number" min="1" value="${total}" style="width:90px"></div></div>` : `<p><b>${esc(x.title)}</b> — كل مجلداته قيد التحويل؛ يمكنك رفع الناقص منها الآن، والترتيب يُتاح بعد اكتمال التحويل.</p>`}
     <div class="mglist">${x.vols.map(b => `<div class="mgrow" data-row="${esc(b.id)}"><span class="vbtns"><button type="button" class="btn s" data-mv="-1" aria-label="تقديم">▲</button><button type="button" class="btn s" data-mv="1" aria-label="تأخير">▼</button></span><label>ج <input type="number" min="0" name="v:${esc(b.id)}" value="${+b.vol || 0}" style="width:70px"></label><span class="mgt"><a href="#/book/${esc(b.id)}/1">${esc(b.title)}</a> <span class="mut">(${toAr(b.n || 0)} صفحة)</span></span><label class="btn s">استبدال الملف<input type="file" accept=".txt,text/plain,.pdf,application/pdf" data-rep="${esc(b.id)}" hidden></label></div>`).join("")}
      ${pv.map(v => `<div class="mgrow"><span class="mgt">ج ${toAr(v.vol)} — <span class="tag">قيد التحويل إلى نص</span></span></div>`).join("")}
      <div class="mgrow"><span class="mgt">مجلد آخر برقم</span><input type="number" min="0" id="mgvnn" value="${total + 1}" style="width:70px"><label class="btn s">اختر ملفه (PDF أو نص)<input type="file" accept=".txt,text/plain,.pdf,application/pdf" data-miss="" hidden></label></div>
      ${miss.map(v => `<div class="mgrow vmiss"><span class="mgt">ج ${toAr(v)} — <b>ناقص</b></span><label class="btn s p">رفع المجلد ${toAr(v)} (PDF أو نص)<input type="file" accept=".txt,text/plain,.pdf,application/pdf" data-miss="${v}" hidden></label></div>`).join("")}</div>
     <p class="mut">لإضافة مجلد برقم أكبر: زد «عدد مجلدات العمل كاملًا» واحفظ، فيظهر المجلد الناقص هنا للرفع. والأسهم تبدّل رقم المجلد مع ما قبله أو بعده.</p>
     ${x.vols.length ? `<div class="savebar"><button class="btn p">حفظ الترتيب والعنوان والعدد</button> <span id="mgvost" class="mut" role="status"></span></div>` : `<span id="mgvost" class="mut" role="status"></span>`}</form>`;
    const st = () => $("#mgvost");
    $$("#mgvordbox [data-mv]").forEach(bt => bt.onclick = () => { const row = bt.closest(".mgrow"), rows = [...$$("#mgvordbox .mgrow[data-row]")], i = rows.indexOf(row), j = i + +bt.dataset.mv; if (j < 0 || j >= rows.length) return;
      const a = row.querySelector("input[type=number]"), b = rows[j].querySelector("input[type=number]"); [a.value, b.value] = [b.value, a.value]; if (+bt.dataset.mv < 0) rows[j].before(row); else rows[j].after(row); });
    $$("#mgvordbox [data-rep]").forEach(inp => inp.onchange = async () => { const b = raw().find(y => y.id === inp.dataset.rep), file = inp.files[0]; if (!file || !confirm("استبدال «" + b.title + "» بالملف " + file.name + "؟" + (/\.pdf$/i.test(file.name) ? "\n(يُحوَّل إلى نص ثم يحل محل النص الحالي)" : ""))) return;
      try { st().textContent = await putVol(setId, await volBase(setId), +b.vol || 0, file, b, t => st().textContent = t); } catch (e) { st().textContent = e.message; } });
    $$("#mgvordbox [data-miss]").forEach(inp => inp.onchange = async () => { const file = inp.files[0], v = inp.dataset.miss === "" ? +$("#mgvnn").value : +inp.dataset.miss; if (!file) return; if (inp.dataset.miss === "" && raw().some(b => b.set === setId && +b.vol === v)) { st().textContent = "المجلد " + toAr(v) + " موجود؛ استبدله من صفّه."; return; } inp.disabled = true;
      try { st().textContent = await putVol(setId, await volBase(setId), v, file, null, t => st().textContent = t); setTimeout(() => ordBox(setId), 800); } catch (e) { st().textContent = e.message; inp.disabled = false; } });
  }
  async function saveOrd(f) {
    const st = $("#mgvost"), setId = f.dataset.set, x = sets().find(s => s.id === setId), title = f.st.value.trim(), ch = [];
    const nv = x.vols.map(b => ({ b, v: +f["v:" + b.id].value }));
    if (new Set(nv.map(r => r.v)).size !== nv.length) return st.textContent = "أرقام المجلدات مكررة.";
    nv.forEach(({ b, v }) => { if ((+b.vol || 0) !== v) ch.push({ id: b.id, field: "vol", to: v }); const t = volTitle(title, v); if (b.title !== t) ch.push({ id: b.id, field: "title", to: t }); if (b.setTitle !== title) ch.push({ id: b.id, field: "setTitle", to: title }); });
    const tot = Math.max(+f.tot.value || 0, ...nv.map(r => r.v)); nv.forEach(({ b }) => { if ((+b.vols || 0) !== tot) ch.push({ id: b.id, field: "vols", to: tot }); });
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
  const REPORTS = [["tools/turath-report.md", "استيراد كتب المكتبة العامة (OpenITI)"], ["tools/ocr-report.md", "تحويل الكتب المصورة"], ["data/import-log.txt", "الاستيراد اليومي من صوت السلف"], ["tools/alam-report.md", "فهرس الأعلام والرواة"], ["tools/dedupe-report.md", "التكرار"], ["tools/health-report.md", "الصيانة اليومية"], ["data/keys-status.json", "حالة مفاتيح Gemini (بالأسماء فقط)"]];
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

  // ===== مراجعة المستجلب وإدارة المصادر (الباب الرابع) =====
  // الاستجلاب الدوري (tools/source-import.js) لا ينشر: يضع الجديد هنا بحالة pending حتى يعتمده المشرف بمؤلفه وقسمه وموضوعه.
  const QP = "data/import-review.json", SP = "data/sources.json";
  let QD = null, SD = null;
  async function impBody(q) {
    const box = $("#mgimp"); if (!box) return;
    try { [QD, SD] = await Promise.all([GH.get(QP).then(r => JSON.parse(r.text)).catch(() => ({ items: [] })), GH.get(SP).then(r => JSON.parse(r.text)).catch(() => ({ sources: [] }))]); } catch (e) { box.textContent = e.message; return; }
    const st = q.st || "pending", items = (QD.items || []).filter(x => x.st === st).slice(-200).reverse();
    const authorsFor = col => lib.authors.filter(a => (a.col || "dawah") === col).sort((x, y) => x.name.localeCompare(y.name, "ar"));
    const guess = x => { const n = norm(String(x.author || "").replace(/^(الشيخ|د|م|أ)\.?\/?\s*/, "")); if (!n) return ""; const a = lib.authors.find(a => (a.col || "dawah") === x.col && [a.name].concat(a.aliases || []).some(m => norm(m).includes(n) || n.includes(norm(m).replace(/^الشيخ\s*/, "")))); return a ? a.id : ""; };
    box.innerHTML = `<p class="mut">الاستجلاب الدوري يضع المواد الجديدة هنا ولا ينشر شيئًا قبل اعتمادك؛ راجع العنوان والمؤلف والقسم والموضوع. آخر تشغيل: ${QD.lastRun ? new Date(QD.lastRun).toLocaleString("ar-EG") : "لم يعمل بعد"}.</p>
     <nav class="chips">${[["pending", "بانتظار المراجعة"], ["approved", "المعتمد"], ["rejected", "المرفوض"]].map(([k, l]) => `<a class="chip${st === k ? " x" : ""}" href="#/admin?t=imports&st=${k}">${l} (${toAr((QD.items || []).filter(x => x.st === k).length)})</a>`).join("")}</nav>
     <div class="mglist">${items.map(x => `<form class="mgrow imprev" data-form="mgimp" data-id="${esc(x.id)}"><span class="mgt"><b>${esc(x.t)}</b><br><span class="mut">${esc(x.srcName || x.src)} • ${esc(x.d || "بلا تاريخ")} • ${toAr((x.text || "").length)} حرفًا • <a href="${esc(x.u)}" target="_blank" rel="noopener">الأصل</a>${x.author ? " • في المصدر: " + esc(x.author) : ""}</span>
        <details><summary>النص</summary><div class="mgreport">${esc((x.text || "").slice(0, 3000))}</div></details>
        ${st === "pending" ? `<div class="row"><select name="a"><option value="">— المؤلف —</option>${authorsFor(x.col).map(a => `<option value="${a.id}"${a.id === guess(x) ? " selected" : ""}>${esc(a.name)}</option>`).join("")}<option value="__new">+ مؤلف جديد: ${esc(x.author || "")}</option></select>
         <select name="tp">${lib.topics.filter(t => t.for === "articles").map(t => `<option value="${t.id}">${esc(topicLabel(t))}</option>`).join("")}</select>
         <select name="col">${["dawah", "ithra"].map(c => `<option value="${c}"${c === x.col ? " selected" : ""}>${esc(COL[c])}</option>`).join("")}</select></div>
         <input name="t" value="${esc(x.t)}"><input name="an" value="${esc(x.author || "")}" placeholder="اسم المؤلف الجديد">` : `<em class="tag">${x.st === "approved" ? "اعتُمد: " + esc(x.aid || "") : "رُفض" + (x.why ? ": " + esc(x.why) : "")}</em>`}</span>
        ${st === "pending" ? `<span><button class="btn p s" name="go" value="ok">اعتماد ونشر</button><button class="btn s" name="go" value="no">رفض</button></span>` : ""}</form>`).join("") || '<p class="note">لا شيء هنا.</p>'}</div>
     <h3>المصادر (بترتيب الأولوية)</h3><p class="mut">حدّد رابط قائمة المقالات لكل مصدر ثم فعّله؛ يُراجَع يوميًا، ويُسجَّل وقت آخر مراجعة ونتيجتها. تعديل المصادر يشغّل الاستجلاب فورًا.</p>
     <div class="mglist">${(SD.sources || []).map((x, i) => `<form class="mgrow" data-form="mgsrc" data-i="${i}"><span class="mgt"><b>${esc(x.name)}</b> <em class="tag">${esc(COL[x.col] || x.col)}</em> ${x.lic === "link" ? '<em class="tag">ملخص ورابط</em>' : ""}<br>
       <span class="mut">${x.state && x.state.lastRun ? "آخر مراجعة " + new Date(x.state.lastRun).toLocaleString("ar-EG") + (x.state.last ? ` — جديد ${toAr(x.state.last.added)}، متخطى ${toAr(x.state.last.skipped)}، أخطاء ${toAr(x.state.last.errs)}` : "") : "لم يُراجَع بعد"}${x.note ? " • " + esc(x.note) : ""}</span>
       <input name="base" value="${esc(x.base || "")}" placeholder="رابط الموقع (يُكتشف آليًا: ووردبريس، RSS، خريطة الموقع، الرئيسية)"><input name="lists" value="${esc((x.lists || []).join(" "))}" placeholder="روابط قوائم مقالات إضافية (اختياري)">${x.state && x.state.mode ? `<span class="mut">طريقة الجلب: ${esc(x.state.mode)}</span>` : ""}</span>
       <span><label class="inl"><input type="checkbox" name="on"${x.on !== false && ((x.lists || []).length || x.base) ? " checked" : ""}${x.id === "salafvoice" ? " disabled" : ""}> مفعّل</label><button class="btn s">حفظ</button></span></form>`).join("")}</div>
     <h3>حسابات فيسبوك</h3><p class="mut">اختر الصفحات والحسابات التي تُستجلب منشوراتها، فتدخل هذه القائمة للمراجعة قبل النشر. يجري الجلب عبر واجهة فيسبوك الرسمية (Graph API) برمز من الصفحة يُحفظ سرًّا في GitHub باسم <code>FB_TOKENS</code> ({"معرّف الحساب": "الرمز"})، ولا يُستعمل الزحف على فيسبوك. الحسابات الشخصية والصفحات التي لم تمنح رمزًا تُضاف منشوراتها يدويًّا من النموذج الثاني.</p>
     <div class="mglist">${(SD.sources || []).map((x, i) => [x, i]).filter(([x]) => x.type === "facebook").map(([x, i]) => `<form class="mgrow" data-form="mgfb" data-i="${i}"><span class="mgt"><b>${esc(x.name)}</b> <em class="tag">${esc(({ page: "صفحة", person: "شخصية", group: "مجموعة" })[x.kind] || "صفحة")}</em> <em class="tag">${esc(COL[x.col] || x.col)}</em>${x.lic === "link" ? ' <em class="tag">ملخص ورابط</em>' : ""} <em class="tag">${(x.to || "posts") === "posts" ? "→ المنشورات" : "→ المقالات"}</em>${x.auto ? ' <em class="tag">نشر تلقائي</em>' : ""}<br><span class="mut">${esc(x.fb)}${x.author ? " • المؤلف: " + esc(x.author) : ""} • ${x.state && x.state.lastRun ? "آخر مراجعة " + new Date(x.state.lastRun).toLocaleString("ar-EG") + (x.state.last ? " — جديد " + toAr(x.state.last.added) : "") : "لم يُراجَع بعد"}${x.state && x.state.mode === "fb-notoken" ? " • ⚠️ لا رمز لهذا الحساب بعد" : ""}</span></span>
       <span><label class="inl"><input type="checkbox" name="on"${x.on !== false ? " checked" : ""}> مفعّل</label><button class="btn s" name="go" value="save">حفظ</button><button class="btn s" name="go" value="del">إزالة الحساب</button></span></form>`).join("") || '<p class="mut">لا حسابات بعد.</p>'}</div>
     <form class="card" data-form="mgfbadd"><b>إضافة حساب فيسبوك</b><div class="row"><div><label>الاسم</label><input name="name" required maxlength="80" placeholder="مثال: صفحة الشيخ فلان"></div><div><label>رابط الصفحة أو اسم المستخدم أو المعرّف</label><input name="fb" required maxlength="200" dir="ltr" placeholder="https://www.facebook.com/…"></div></div>
      <div class="row"><div><label>النوع</label><select name="kind"><option value="page">صفحة</option><option value="person">حساب شخصي</option><option value="group">مجموعة</option></select></div><div><label>القسم</label><select name="col"><option value="dawah">${esc(COL.dawah)}</option><option value="ithra">${esc(COL.ithra)}</option></select></div><div><label>النشر</label><select name="lic"><option value="">النص كاملًا (بإذن صاحب الحساب)</option><option value="link">ملخص ورابط</option></select></div><div><label>تُعرض في</label><select name="to"><option value="posts">المنشورات</option><option value="articles">المقالات</option></select></div><div><label>النشر</label><select name="auto"><option value="">بعد مراجعة الإدارة</option><option value="1">تلقائيًا (للمنشورات فقط)</option></select></div><div><label>المؤلف في المكتبة (اختياري)</label><input name="author" maxlength="80" list="mgauthors"></div></div>
      <datalist id="mgauthors">${lib.authors.slice(0, 600).map(a => `<option value="${esc(a.name)}">`).join("")}</datalist><button class="btn p">إضافة الحساب</button></form>
     <form class="card" data-form="mgfbpost"><b>إضافة منشور من فيسبوك يدويًّا</b><div class="row"><div><label>الحساب</label><select name="src">${(SD.sources || []).filter(x => x.type === "facebook").map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("") || '<option value="">— أضف حسابًا أولًا —</option>'}</select></div><div><label>رابط المنشور</label><input name="u" required dir="ltr" placeholder="https://www.facebook.com/…"></div><div><label>التاريخ</label><input name="d" type="date" value="${today()}"></div></div>
      <label>العنوان (اختياري؛ الافتراضي أول سطر)</label><input name="t" maxlength="160"><label>نص المنشور</label><textarea name="text" required rows="6"></textarea><button class="btn p">إضافة إلى المراجعة</button></form>
     ${(QD.errors || []).length ? `<details><summary>أخطاء الاستجلاب (${toAr(QD.errors.length)})</summary><pre class="mgreport">${QD.errors.slice(-60).map(e => esc(e.src + " — " + e.url + " — " + e.err)).join("\n")}</pre></details>` : ""}`;
  }
  async function impDecide(f, go) {
    const id = f.dataset.id, x = (QD.items || []).find(y => y.id === id); if (!x) return;
    const fd = new FormData(f);
    if (go === "no") { const why = prompt("سبب الرفض (اختياري):", "") ; await GH.editJSON(QP, o => { const y = o.items.find(z => z.id === id); if (y) { y.st = "rejected"; y.why = why || ""; } return o; }, "مراجعة المستجلب: رفض " + id, true); toast("رُفض."); return route(); }
    let aid = fd.get("a"), col = fd.get("col") || x.col, title = String(fd.get("t") || x.t).trim();
    if (!aid && x.to !== "posts") return toast("اختر المؤلف.");
    try {
      if (aid === "__new") { const n = String(fd.get("an") || "").trim(); if (!n) return toast("اكتب اسم المؤلف."); aid = (col === "ithra" ? "ix" : "w") + Date.now().toString(36); const au = { id: aid, name: n, col, bio: "", auto: true }; await GH.editJSON("data/catalog.json", c => { c.authors.push(au); return c; }, "مؤلف جديد من الاستجلاب: " + n, true); CAT.authors.push(au); }
      if (x.to === "posts") { // منشور فيسبوك ← قسم «المنشورات»
        const pid = "fb" + id.replace(/[^a-z0-9]/gi, "").slice(-20), post = Object.assign({ id: pid, date: x.d || today(), text: x.text || "", url: x.u, src: "فيس بوك" }, aid && aid !== "__lib" ? { authorId: aid } : {});
        await GH.editJSON("data/posts.json", o => { o = o || { items: [] }; if (!o.items.some(y => y.id === pid)) o.items.unshift(post); return o; }, "منشور من فيسبوك: " + title.slice(0, 50), true);
        if (typeof POSTS !== "undefined" && Array.isArray(POSTS)) POSTS.unshift(post);
        await GH.editJSON(QP, o => { const y = o.items.find(z => z.id === id); if (y) { y.st = "approved"; y.aid = aid; delete y.text; } return o; }, "مراجعة المستجلب: اعتماد " + id, true);
        toast("نُشر في «المنشورات»."); return route(); }
      const g = /^\d{4}-\d{2}/.test(x.d || "") ? x.d.slice(0, 7) : "undated", text = x.text || "";
      const pages = text.length > 7000 ? text.split("\n").reduce((ps, l) => { const last = ps[ps.length - 1]; if (last.length + l.length > 5000) ps.push(l); else ps[ps.length - 1] = last ? last + "\n" + l : l; return ps; }, [""]) : [text];
      const body = x.lic === "link" ? [text.slice(0, 900) + "…\n\n[النص كاملًا في مصدره الأصلي]"] : pages;
      await GH.editJSON("data/articles/" + g + ".json", o => { o = o || {}; o[id] = { pages: body }; return o; }, "استجلاب: " + title, true);
      const item = { id, t: title, a: aid, tp: fd.get("tp"), c: x.srcName || "", d: x.d || "", u: x.u, f: g, n: body.length, ad: today(), src: x.src };
      if (col !== "dawah") item.col = col; if (x.lic) item.lic = x.lic; if (x.lic === "link") item.sum = text.slice(0, 400);
      await GH.editJSON("data/articles/index.json", o => { if (!o.items.some(y => y.id === id)) o.items.push(item); return o; }, "استجلاب: " + title, true);
      ARTS_IDX.push(artFromIdx(item)); merge();
      await GH.editJSON(QP, o => { const y = o.items.find(z => z.id === id); if (y) { y.st = "approved"; y.aid = aid; delete y.text; } return o; }, "مراجعة المستجلب: اعتماد " + id, true);
      await log({ op: "add", kind: "article", ids: [id], changes: [{ id, kind: "article", field: "create", from: null, to: title }], note: "اعتماد مادة مستجلبة من " + (x.srcName || x.src) });
      toast("نُشرت المادة."); route();
    } catch (e) { alert(e.message); }
  }
  async function srcSave(f) {
    const i = +f.dataset.i, lists = f.lists.value.split(/\s+/).filter(u => /^https:\/\//.test(u)), base = /^https:\/\//.test(f.base.value.trim()) ? f.base.value.trim() : "", on = f.on.checked && (lists.length > 0 || !!base);
    try { await GH.editJSON(SP, o => { const x = o.sources[i]; x.lists = lists; x.base = base; x.on = on; return o; }, "مصادر الاستجلاب: " + (SD.sources[i] || {}).name, false); toast(on ? "حُفظ وفُعّل، ويبدأ الاستجلاب خلال دقائق." : "حُفظ."); route(); } catch (e) { alert(e.message); }
  }

  // ===== حسابات فيسبوك (data/sources.json: type=facebook) يجلبها tools/source-import.js عبر Graph API برمز FB_TOKENS =====
  const fbId = v => { v = String(v || "").trim().replace(/\/+$/, ""); const m = v.match(/facebook\.com\/(?:profile\.php\?id=(\d+)|groups\/([^/?#]+)|([^/?#]+))/i); return m ? (m[1] || m[2] || m[3]) : v.replace(/^@/, ""); };
  async function fbAdd(f) {
    const fb = fbId(f.fb.value), name = f.name.value.trim(); if (!fb || !name) return toast("اكتب الاسم والرابط.");
    const id = "fb-" + fb.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30) || "fb-" + Date.now().toString(36);
    try { await GH.editJSON(SP, o => { o.sources = o.sources || []; if (!o.sources.some(x => x.id === id)) o.sources.push(Object.assign({ id, type: "facebook", name, fb, kind: f.kind.value, col: f.col.value, lic: f.lic.value, author: f.author.value.trim(), on: true, to: f.to.value, minChars: f.to.value === "posts" ? 60 : 300, perRun: 25, delayMs: 1000 }, f.auto.value && f.to.value === "posts" ? { auto: 1 } : {}, (() => { const a = lib.authors.find(x => norm(x.name) === norm(f.author.value.trim())); return a ? { aid: a.id } : {}; })())); return o; }, "حساب فيسبوك للاستجلاب: " + name, false); toast("أُضيف الحساب؛ يُراجَع مع الاستجلاب الدوري."); route(); } catch (e) { alert(e.message); }
  }
  async function fbEdit(f, go) {
    const i = +f.dataset.i, x = SD.sources[i]; if (!x) return;
    if (go === "del" && !confirm("إزالة الحساب من الاستجلاب؟ (لا تُحذف المواد المنشورة منه)")) return;
    try { await GH.editJSON(SP, o => { const k = o.sources.findIndex(y => y.id === x.id); if (k >= 0) { if (go === "del") o.sources.splice(k, 1); else o.sources[k].on = f.on.checked; } return o; }, (go === "del" ? "إزالة حساب فيسبوك: " : "حساب فيسبوك: ") + x.name, false); toast("حُفظ."); route(); } catch (e) { alert(e.message); }
  }
  async function fbPost(f) {
    const s = (SD.sources || []).find(x => x.id === f.src.value); if (!s) return toast("أضف الحساب أولًا.");
    const text = f.text.value.trim(), u = f.u.value.trim(); if (!/^https:\/\//.test(u) || text.length < 40) return toast("اكتب رابط المنشور ونصه.");
    const t = f.t.value.trim() || text.split("\n")[0].slice(0, 90);
    try { await GH.editJSON(QP, o => { o = o || { items: [] }; o.items = o.items || []; o.items.push({ id: s.id + "m" + Date.now().toString(36), src: s.id, srcName: s.name, col: s.col || "dawah", u, t, author: s.author || "", d: f.d.value || today(), text, st: "pending", at: new Date().toISOString(), lic: s.lic || "", to: s.to || "posts" }); return o; }, "منشور فيسبوك للمراجعة: " + t, true); toast("أُضيف إلى قائمة المراجعة."); route(); } catch (e) { alert(e.message); }
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
    else if (f.dataset.form === "mgimp") impDecide(f, (e.submitter && e.submitter.value) || "ok");
    else if (f.dataset.form === "mgsrc") srcSave(f);
    else if (f.dataset.form === "mgfbadd") fbAdd(f);
    else if (f.dataset.form === "mgfb") fbEdit(f, (e.submitter && e.submitter.value) || "save");
    else if (f.dataset.form === "mgfbpost") fbPost(f);
  }, true);

  return {
    tabs: () => [["items", "إدارة المواد"], ["vols", "كتاب متعدد المجلدات"], ["dups", "التكرار والتوحيد"], ["imports", "مراجعة المستجلب"], ["reports", "تقارير الاستيراد والفهرسة"], ["log", "سجل التعديلات"]].concat(isAdmin() ? [["switches", "الخدمات والمفاتيح"]] : []),
    body(tab, q) {
      if (tab === "items") { setTimeout(count, 0); return itemsBody(q); }
      if (tab === "log") { setTimeout(logBody, 0); return `${needGH()}<p class="mut">كل تعديل أو نقل أو إخفاء من «إدارة المواد»، وكل تغيير في مفاتيح الخدمات. «تراجع» يعيد القيم السابقة لما لم يتغير بعد العملية، ويُسجَّل التراجع نفسه.</p><div id="mglog" class="mut">جارٍ التحميل…</div>`; }
      if (tab === "vols") { setTimeout(() => wireVols(q), 0); return volsBody(); }
      if (tab === "imports") { setTimeout(() => impBody(q), 0); return `${needGH()}<div id="mgimp" class="mut">جارٍ التحميل…</div>`; }
      if (tab === "reports") { setTimeout(repBody, 0); return `${needGH()}<div id="mgrep" class="mut">جارٍ تحميل التقارير…</div>`; }
      if (tab === "dups") { setTimeout(dupsBody, 0); return `${needGH()}<div id="mgdup" class="mut">جارٍ الفحص…</div>`; }
      if (tab === "switches") { setTimeout(swBody, 0); return `${needGH()}<div id="mgsw" class="mut">جارٍ التحميل…</div>`; }
      return null;
    }, apply, undo, log, sets, volFromName, sameish, nameToks
  };
})();
