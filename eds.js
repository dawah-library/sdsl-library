/* طبعات الكتاب (ب2-53 … ب2-68 من وثيقة التطوير).
   - الكتاب عمل واحد، وكل طبعة سجل مستقل بنصه ومصورته وبياناته، يجمعها الحقل ed.w (معرّف العمل = وحدة الطبعة الأولى).
     الوحدة: الكتاب المفرد، أو العمل متعدد المجلدات كله (set). ed = {w, n: الطبعة, y: السنة, pub: الناشر, tah: المحقق, note, main, at}.
   - القوائم تعرض الطبعة المعتمدة وحدها (main، وإلا الأولى)؛ وفي صفحة الكتاب شريط الطبعات ليختار القارئ.
   - رفع طبعة جديدة لا يمس الطبعات السابقة ولا يستبدل نصوصها؛ والمصوّرة تُحوَّل مع طبعة نصية سابقة مرجعًا لكشف مواضع الشك فقط
     (tools/ocr-pdf.py ref_compare) دون نقل شيء منها.
   - مقارنة الطبعات #/editions/<أ>?b=<ب>&p=<صفحة>: الصفحة المقابلة تُحدَّد بتداخل الكلمات، والفروق كلمة كلمة مصنفة
     (ضبط/إملاء، لفظ، داخل آية، داخل نص منقول، في اسم علم). */
const ED = (() => {
  const unit = b => b.set || b.id;
  const work = b => (b.ed && b.ed.w) || null;
  const all = () => CAT.books.concat(typeof LOCAL !== "undefined" ? LOCAL.catalog.books : []).filter(b => !b.demo);
  const firstOf = recs => recs.slice().sort((x, y) => (x.vol || 0) - (y.vol || 0))[0];
  // وحدات العمل الواحد: كل طبعة (كتاب أو عمل بمجلداته) بسجلها الأول
  function units(w) {
    if (!w) return [];
    const m = new Map();
    lib.books.filter(b => b.type !== "article" && (work(b) === w || unit(b) === w)).forEach(b => { const u = unit(b); (m.get(u) || m.set(u, []).get(u)).push(b); });
    return [...m.entries()].map(([u, recs]) => ({ u, b: firstOf(recs), recs, ed: (recs.find(r => r.ed) || {}).ed || {} }))
      .sort((x, y) => (+x.ed.y || 9999) - (+y.ed.y || 9999) || String(x.ed.n || "").localeCompare(String(y.ed.n || ""), "ar"));
  }
  const workOf = b => work(b) || (lib.books.some(x => work(x) === unit(b)) ? unit(b) : null);
  let MU = new Map(), MUn = -1, MUl = null;
  function mainUnit(w) { if (MUl !== lib.books || MUn !== lib.books.length) { MU = new Map(); MUn = lib.books.length; MUl = lib.books; } if (MU.has(w)) return MU.get(w); const us = units(w);
    const r = (us.find(x => x.ed.main) || us.find(x => x.u === w) || us[0] || {}).u; MU.set(w, r); return r; }
  // يُخفى من القوائم: طبعة غير معتمدة (القارئ يصل إليها من شريط الطبعات)
  const secondary = b => { const w = work(b); return !!w && unit(b) !== mainUnit(w); };
  const label = (e, full) => [e.n || (full ? "طبعة غير محددة" : ""), e.tah && "تحقيق " + e.tah, e.pub, e.y && toAr(e.y)].filter(Boolean).join("، ");
  const avail = b => [b.n ? "نص" : "", b.pdf || b.img ? "مصورة" : ""].filter(Boolean).join(" + ") || "بيانات فقط";

  function strip(b) {
    const w = workOf(b); if (!w) return "";
    const us = units(w); if (us.length < 2) return "";
    const cur = unit(b), mu = mainUnit(w);
    return `<nav class="edstrip" aria-label="طبعات الكتاب"><b>الطبعات (${toAr(us.length)})</b><div class="chips">${us.map(x => `<a class="chip${x.u === cur ? " x" : ""}" href="#/book/${encodeURIComponent(x.b.id)}/1"${x.u === cur ? ' aria-current="page"' : ""} title="${esc(avail(x.b))}">${esc(label(x.ed) || "طبعة " + toAr(us.indexOf(x) + 1))}${x.u === mu ? " ✓" : ""}</a>`).join("")}</div>
      <a class="lnk" href="#/editions/${encodeURIComponent(b.id)}?b=${encodeURIComponent((us.find(x => x.u !== cur) || us[0]).b.id)}">قارن الطبعات</a></nav>`;
  }

  // ===== إدارة الطبعات (للمشرفين) =====
  function dlgHtml(b) {
    const w = workOf(b) || unit(b), us = units(w).length ? units(w) : [{ u: unit(b), b, recs: [b], ed: b.ed || {} }], mu = mainUnit(w) || unit(b);
    const e = b.ed || {}, k = SDSLSearch.norm((b.setTitle || b.title).replace(/\s+—\s+ج\s+\d+$/, ""));
    const linked = new Set(us.map(x => x.u));
    // كشف طبعات محتملة غير مربوطة (ب2-56): العنوان نفسه أو المتضمن للمؤلف نفسه
    const maybe = lib.books.filter(x => x.type !== "article" && !linked.has(unit(x)) && !(x.set && x.vol > 1) && x.authorId === b.authorId && (() => { const t = SDSLSearch.norm(x.setTitle || x.title); return t === k || (k.length > 6 && (t.includes(k) || k.includes(t))); })());
    const others = lib.books.filter(x => x.type !== "article" && !linked.has(unit(x)) && !(x.set && x.vol > 1) && x.authorId === b.authorId).sort((x, y) => x.title.localeCompare(y.title, "ar"));
    const textEds = us.filter(x => x.b.n && !x.b.ocr || x.b.n && x.b.ocr && !x.b.unrev);
    return `<h3>طبعات «${esc(b.setTitle || b.title)}»</h3>
     <p class="mut">الكتاب عمل واحد، وكل طبعة سجل مستقل بنصه ونسخته المصورة وبياناته. لا يُستبدل نص طبعة بنص أخرى، والطبعة المعتمدة (✓) هي التي تظهر في القوائم.</p>
     <div class="mglist">${us.map(x => `<div class="mgrow"><span class="mgt"><b>${esc(label(x.ed, 1))}</b>${x.u === mu ? ' <em class="tag on">المعتمدة</em>' : ""}${x.u === unit(b) ? ' <em class="tag">الحالية</em>' : ""}<br><span class="mut">${esc(x.b.id)} • ${esc(avail(x.b))}${x.recs.length > 1 ? " • " + toAr(x.recs.length) + " مجلدات" : ""}${x.ed.at ? " • أضيفت " + esc(x.ed.at) : ""}${x.b.source ? " • " + esc(x.b.source.slice(0, 60)) : ""}</span></span>
       <span>${x.u === mu ? "" : `<button class="btn s" data-act="edmain" data-w="${esc(w)}" data-u="${esc(x.u)}">اعتمادها</button>`}<a class="btn s" href="#/book/${encodeURIComponent(x.b.id)}/1">فتح</a></span></div>`).join("")}</div>
     <details open><summary><b>بيانات هذه الطبعة</b></summary><form data-form="edmeta" data-id="${esc(b.id)}" data-w="${esc(w)}">
      <div class="row"><div><label>الطبعة</label><input name="n" value="${esc(e.n || "")}" placeholder="الطبعة الثانية"></div><div><label>سنة النشر</label><input name="y" value="${esc(e.y || "")}" inputmode="numeric" placeholder="1425"></div></div>
      <div class="row"><div><label>الناشر</label><input name="pub" value="${esc(e.pub || "")}"></div><div><label>المحقق</label><input name="tah" value="${esc(e.tah || "")}"></div></div>
      <label>ملاحظة (ما يميز الطبعة)</label><input name="note" value="${esc(e.note || "")}">
      <div class="savebar"><button class="btn p">حفظ بيانات الطبعة</button> <span id="edst" class="mut" role="status"></span></div></form></details>
     ${maybe.length ? `<p class="note">قد تكون هذه طبعات أخرى للكتاب نفسه (العنوان والمؤلف متطابقان): ${maybe.map(x => `<button class="lnk" data-act="edlink" data-w="${esc(w)}" data-id="${esc(x.id)}">${esc(x.setTitle || x.title)} (${esc(x.id)})</button>`).join("، ")}</p>` : ""}
     <details><summary><b>ربط كتاب موجود طبعةً لهذا العمل</b></summary><div class="row"><select id="edother"><option value="">— من كتب المؤلف نفسه —</option>${others.map(x => `<option value="${esc(x.id)}">${esc(x.setTitle || x.title)}${x.source ? " — " + esc(x.source.slice(0, 40)) : ""}</option>`).join("")}</select><button class="btn s" data-act="edlink" data-w="${esc(w)}" data-sel="1">ربط</button></div></details>
     <details><summary><b>رفع طبعة جديدة</b> (نص أو نسخة مصورة)</summary><form data-form="ednew" data-id="${esc(b.id)}" data-w="${esc(w)}">
      <p class="mut">${textEds.length ? `توجد نسخة نصية سابقة (${esc(label(textEds[0].ed, 1))})؛ إن رفعت مصورة تُستعمل مرجعًا لتعليم الكلمات المختلفة للمراجعة، ولا يُنقل منها نص إلى الطبعة الجديدة.` : "لا توجد نسخة نصية سابقة لهذا العمل؛ تُحوَّل المصورة دون مرجع."}</p>
      <div class="row"><div><label>الطبعة</label><input name="n" required placeholder="الطبعة الثالثة"></div><div><label>سنة النشر</label><input name="y" inputmode="numeric"></div></div>
      <div class="row"><div><label>الناشر</label><input name="pub"></div><div><label>المحقق</label><input name="tah"></div></div>
      ${textEds.length ? `<label>الطبعة المرجعية للتحويل</label><select name="ref">${textEds.map(x => `<option value="${esc(x.b.id)}">${esc(label(x.ed, 1))}</option>`).join("")}<option value="">بلا مرجع</option></select>` : ""}
      <label>الملف (.txt أو PDF)</label><input type="file" name="file" accept=".txt,text/plain,.pdf,application/pdf" required>
      <div class="savebar"><button class="btn p">رفع الطبعة</button> <span id="ednst" class="mut" role="status"></span></div></form></details>`;
  }
  const open = id => { const b = B(id); if (!b) return; openDlg(dlgHtml(b)); };
  const recsOf = u => all().filter(x => unit(x) === u);
  const edOf = (u, w, extra) => { const r = recsOf(u)[0] || {}; return Object.assign({}, r.ed || {}, { w }, extra || {}); };
  async function setEd(u, w, extra, note) { // يكتب ed على كل سجلات الوحدة (المجلدات معًا)
    const to = edOf(u, w, extra); Object.keys(to).forEach(k => (to[k] === "" || to[k] == null) && delete to[k]);
    return MG.apply(recsOf(u).map(x => ({ id: x.id, field: "ed", to })), "edit", note);
  }
  async function saveMeta(f) {
    const st = $("#edst"), b = B(f.dataset.id), w = f.dataset.w, fd = new FormData(f), x = {};
    ["n", "y", "pub", "tah", "note"].forEach(k => x[k] = String(fd.get(k) || "").trim());
    if (x.y && !/^\d{3,4}$/.test(x.y)) return st.textContent = "السنة أرقام فقط (هجرية أو ميلادية).";
    st.textContent = "جارٍ الحفظ…";
    try { if (unit(b) !== w && !units(w).some(z => z.u === w && z.ed.w)) await setEd(w, w, {}, "تعيين العمل الأصل"); // الطبعة الأولى تحمل ed.w أيضًا
      await setEd(unit(b), w, x, "بيانات طبعة «" + (b.setTitle || b.title) + "»"); st.textContent = "✓ حُفظ."; open(b.id); } catch (e) { st.textContent = e.message; }
  }
  async function link(w, id) {
    const x = B(id); if (!x) return;
    if (!confirm(`ربط «${x.setTitle || x.title}» طبعةً لهذا العمل؟ يبقى نصه ومصورته كما هما، ويُخفى من القوائم إلا إن اعتمدته.`)) return;
    try { if (!recsOf(w).some(r => r.ed && r.ed.w)) await setEd(w, w, { at: (recsOf(w)[0] || {}).added || today() }, "تعيين العمل الأصل");
      await setEd(unit(x), w, { at: today() }, "ربط «" + (x.setTitle || x.title) + "» طبعةً"); toast("رُبطت الطبعة."); open(id); } catch (e) { alert(e.message); }
  }
  async function setMain(w, u) {
    const us = units(w); if (!confirm("اعتماد هذه الطبعة لتظهر في القوائم بدل غيرها؟")) return;
    try { const ch = [];
      us.forEach(x => recsOf(x.u).forEach(r => { const to = Object.assign({}, r.ed || {}, { w }); if (x.u === u) to.main = true; else delete to.main; if (JSON.stringify(to) !== JSON.stringify(r.ed || {})) ch.push({ id: r.id, field: "ed", to }); }));
      if (ch.length) await MG.apply(ch, "edit", "اعتماد طبعة"); toast("اعتُمدت الطبعة."); open((us.find(x => x.u === u) || {}).b.id); } catch (e) { alert(e.message); }
  }
  async function upload(f) {
    const st = $("#ednst"), b = B(f.dataset.id), w = f.dataset.w, fd = new FormData(f), file = f.file.files[0]; if (!file) return;
    const ed = { w, at: today() }; ["n", "y", "pub", "tah"].forEach(k => { const v = String(fd.get(k) || "").trim(); if (v) ed[k] = v; });
    const title = (b.setTitle || b.title).replace(/\s+—\s+ج\s+\d+$/, ""), src = [ed.tah && "تحقيق: " + ed.tah, ed.pub, ed.n, ed.y].filter(Boolean).join(" — ");
    f.querySelector("button").disabled = true;
    try {
      if (!recsOf(w).some(r => r.ed && r.ed.w)) await setEd(w, w, { at: (recsOf(w)[0] || {}).added || "" }, "تعيين العمل الأصل");
      if (/\.pdf$/i.test(file.name)) {
        await pdfUpload(file, "up" + Date.now().toString(36) + "e", { title, authorId: b.authorId, topic: b.topicId, col: b.col || "dawah", source: src, ocr: true, ed, refBook: String(fd.get("ref") || "") || undefined }, t => st.textContent = t);
        await MG.log({ op: "file", kind: "book", ids: [w], changes: [{ id: w + "/ed", kind: "book", field: "ed", from: null, to: file.name }], note: "رفع طبعة مصورة «" + (ed.n || "") + "» من «" + title + "» للتحويل" });
        st.textContent = "✓ رُفعت للتحويل، وتظهر في شريط الطبعات بعد اكتماله. الطبعات السابقة لم تتغير.";
      } else {
        const pages = splitPages(await file.text(), "auto", 1800); if (!pages.length) throw new Error("الملف فارغ.");
        const meta = { id: "u" + Date.now().toString(36), title, authorId: b.authorId, topicId: b.topicId, col: b.col || "dawah", type: "book", source: src, ed };
        await saveItem(meta, pages, []);
        await MG.log({ op: "add", kind: "book", ids: [meta.id], changes: [{ id: meta.id, kind: "book", field: "create", from: null, to: title + " — " + (ed.n || "طبعة") }], note: "إضافة طبعة نصية لـ«" + title + "»" });
        st.textContent = "✓ أضيفت الطبعة (" + toAr(pages.length) + " صفحة).";
      }
    } catch (e) { st.textContent = e.message; } finally { f.querySelector("button").disabled = false; }
  }

  // ===== المقارنة =====
  const DI = /[ً-ْٰـ]/g;
  const nrm = w => w.replace(DI, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^ء-يa-z0-9]/gi, "") || w; // الرموز (ﷺ، ¶) تقارن بنفسها
  const toks = t => String(t || "").replace(/^#+\s*/gm, "").replace(/\n+/g, " ¶ ").split(/\s+/).filter(Boolean);
  // أطول تتابع مشترك على مستوى الكلمات (بعد التطبيع)، ثم تجميع الفروق في كتل
  function diff(A, Bw) {
    const a = A.map(nrm), b = Bw.map(nrm), n = a.length, m = b.length;
    if (n * m > 4e6) return null; // صفحة ضخمة جدًا
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] && a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ops = []; let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] && a[i] === b[j]) { ops.push({ t: A[i] === Bw[j] ? "=" : "~", a: A[i], b: Bw[j], ai: i, bj: j }); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { ops.push({ t: "+", b: Bw[j], bj: j }); j++; }
      else { ops.push({ t: "-", a: A[i], ai: i }); i++; }
    }
    const out = []; // دمج الحذف والإضافة المتجاورين في «تغيير»
    ops.forEach(o => { const l = out[out.length - 1];
      if (o.t === "=" || o.t === "~") return out.push(o);
      if (l && (l.t === "-" || l.t === "+" || l.t === "x") && l.t !== "=") { l.t = "x"; if (o.a) (l.as = l.as || (l.a ? [l.a] : [])).push(o.a); if (o.b) (l.bs = l.bs || (l.b ? [l.b] : [])).push(o.b); if (l.ai == null && o.ai != null) l.ai = o.ai; return; }
      out.push(Object.assign({}, o, o.a ? { as: [o.a] } : {}, o.b ? { bs: [o.b] } : {})); });
    return out;
  }
  // سياق كل كلمة: داخل آية ﴿﴾، أو نص منقول «»، أو بعد ابن/بن/أبو (اسم علم)
  function ctxMap(W) {
    const c = []; let q = 0, g = 0;
    W.forEach((w, i) => { if (/﴿/.test(w)) q++; if (/«/.test(w)) g++;
      const prev = (W[i - 1] || "").replace(DI, ""); c.push({ q: q > 0, g: g > 0, nm: /^(ابن|بن|بنت|أبو|أبي|أبا|أم|الإمام|الحافظ|الشيخ)$/.test(prev) });
      if (/﴾/.test(w)) q = Math.max(0, q - 1); if (/»/.test(w)) g = Math.max(0, g - 1); });
    return c;
  }
  function classify(ops, A) {
    const ca = ctxMap(A), S = { spell: 0, word: 0, add: 0, del: 0, q: 0, g: 0, nm: 0 };
    ops.forEach(o => { if (o.t === "=") return;
      const at = o.ai != null ? ca[o.ai] || {} : {};
      if (o.t === "~") { S.spell++; o.k = "spell"; }
      else if (o.t === "+") { S.add++; o.k = "add"; } else if (o.t === "-") { S.del++; o.k = "del"; } else { S.word++; o.k = "word"; }
      if (o.t !== "~" && o.ai != null) { if (at.q) { S.q++; o.q = 1; } if (at.g) { S.g++; o.g = 1; } if (at.nm) { S.nm++; o.nm = 1; } } });
    return S;
  }
  function bestPage(bw, pages, guess) { // الصفحة المقابلة: أعلى تداخل كلمات حول الموضع المتناسب، ثم في الكتاب كله إن ضعف
    const A = new Set(bw.map(nrm).filter(w => w.length > 2)); const sc = j => { let c = 0; toks(pages[j]).forEach(w => A.has(nrm(w)) && c++); return c / Math.max(1, A.size); };
    let best = -1, bs = -1; const scan = js => js.forEach(j => { if (j < 0 || j >= pages.length) return; const s = sc(j); if (s > bs) { bs = s; best = j; } });
    scan(Array.from({ length: 25 }, (_, k) => guess - 12 + k)); if (bs < 0.35) scan(pages.map((_, j) => j));
    return { j: best, s: bs };
  }
  const render = (ops, side, hideSpell) => ops.map(o => {
    const w = side === "a" ? (o.as || (o.a ? [o.a] : [])) : (o.bs || (o.b ? [o.b] : []));
    const s = (side === "a" ? (o.t === "~" ? o.a : null) : (o.t === "~" ? o.b : null));
    if (o.t === "=") return esc(o[side] || "").replace("¶", "<br>");
    if (o.t === "~") return hideSpell ? esc(s) : `<mark class="ed-sp" title="اختلاف في الضبط أو الإملاء">${esc(s)}</mark>`;
    if (!w.length) return side === "a" && o.t === "+" ? '<span class="ed-gap" title="زيادة في الطبعة الأخرى">⌃</span>' : side === "b" && o.t === "-" ? '<span class="ed-gap" title="ليست في هذه الطبعة">⌃</span>' : "";
    const cls = "ed-" + (o.t === "+" ? "add" : o.t === "-" ? "del" : "chg") + (o.q ? " ed-q" : "") + (o.g ? " ed-g" : "") + (o.nm ? " ed-nm" : "");
    return `<mark class="${cls}">${w.map(esc).join(" ").replace(/¶/g, "<br>")}</mark>`;
  }).join(" ");

  async function vEditions(idA, q) {
    const a0 = B(idA); if (!a0) return view('<h2>مقارنة الطبعات</h2><p class="note">الكتاب غير موجود.</p>');
    const w = workOf(a0), us = units(w), other = q.b && B(q.b) ? B(q.b) : (us.find(x => x.u !== unit(a0)) || {}).b;
    if (!other) return view(`<h2>مقارنة الطبعات</h2><p class="note">لا توجد طبعة أخرى مربوطة بهذا الكتاب. يربط المشرف الطبعات من «طبعات الكتاب» في أدوات القراءة.</p><a class="btn" href="#/book/${encodeURIComponent(idA)}/1">العودة إلى الكتاب</a>`);
    view(`<h2>مقارنة الطبعات</h2><p class="mut">جارٍ تحميل النصين…</p>`);
    let A, Bk; try { [A, Bk] = await Promise.all([loadBook(a0.id), loadBook(other.id)]); } catch (e) { return view(`<h2>مقارنة الطبعات</h2><p class="note">${esc(e.message)}</p>`); }
    const p = Math.max(1, Math.min(A.pages.length, +q.p || 1)), aw = toks(A.pages[p - 1]);
    const guess = Math.round((p - 1) * Bk.pages.length / Math.max(1, A.pages.length));
    const bp = q.bp ? { j: Math.max(0, Math.min(Bk.pages.length - 1, +q.bp - 1)), s: 1 } : bestPage(aw, Bk.pages, guess);
    const bw = toks(Bk.pages[bp.j] || ""), ops = diff(aw, bw), hide = q.sp === "0";
    const S = ops ? classify(ops, aw) : null;
    const u = o => "#/editions/" + encodeURIComponent(o.a || a0.id) + "?" + new URLSearchParams(Object.assign({ b: other.id, p }, hide ? { sp: "0" } : {}, o.x || {})).toString();
    const sel = (name, cur) => `<select data-edsel="${name}">${us.map(x => `<option value="${esc(x.b.id)}"${x.b.id === cur ? " selected" : ""}>${esc(label(x.ed, 1))}</option>`).join("")}</select>`;
    const total = S ? S.word + S.add + S.del : 0;
    view(`<h2>مقارنة الطبعات: ${esc(a0.setTitle || a0.title)}</h2>
     <p class="mut">تُقابل الصفحة بأقرب صفحة في الطبعة الأخرى بتداخل الكلمات، ثم تُعلَّم الفروق كلمة كلمة. المقارنة آلية للمساعدة في المراجعة، ولا تغيّر نص أي طبعة.</p>
     <div class="row edcmpbar"><div><label>الطبعة (أ)</label>${sel("a", a0.id)}</div><div><label>الطبعة (ب)</label>${sel("b", other.id)}</div></div>
     <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">${p > 1 ? `<a class="btn s" href="${u({ x: { p: p - 1 } })}">السابقة</a>` : ""}<span>صفحة ${toAr(p)} من ${toAr(A.pages.length)} في (أ) ↔ صفحة ${toAr(bp.j + 1)} في (ب)${bp.s < 0.35 ? ' <em class="tag off">مقابلة ضعيفة</em>' : ""}</span>${p < A.pages.length ? `<a class="btn s" href="${u({ x: { p: p + 1 } })}">التالية</a>` : ""}
      <a class="btn s" href="${hide ? u({ x: { sp: "" } }).replace(/&?sp=/, "") : u({ x: { sp: "0" } })}">${hide ? "إظهار فروق الضبط والإملاء" : "إخفاء فروق الضبط والإملاء"}</a></div>
     ${S ? `<div class="chips edsum"><span class="chip">${toAr(total)} فرقًا في الكلمات</span><span class="chip">${toAr(S.spell)} في الضبط أو الإملاء</span>${S.q ? `<span class="chip warn">${toAr(S.q)} داخل آيات — راجعها</span>` : ""}${S.g ? `<span class="chip warn">${toAr(S.g)} داخل نصوص منقولة «»</span>` : ""}${S.nm ? `<span class="chip warn">${toAr(S.nm)} في أسماء أعلام</span>` : ""}</div>` : '<p class="note">الصفحة أطول من حد المقارنة.</p>'}
     <div class="edcmp"><section><h3>(أ) ${esc(label((a0.ed || {}), 1))}</h3><div class="edtx" dir="rtl">${ops ? render(ops, "a", hide) : esc(A.pages[p - 1])}</div><a class="lnk" href="#/book/${encodeURIComponent(a0.id)}/${p}">افتح في الكتاب</a></section>
      <section><h3>(ب) ${esc(label((other.ed || {}), 1))}</h3><div class="edtx" dir="rtl">${ops ? render(ops, "b", hide) : esc(Bk.pages[bp.j] || "")}</div><a class="lnk" href="#/book/${encodeURIComponent(other.id)}/${bp.j + 1}">افتح في الكتاب</a></section></div>
     <p class="mut edleg"><mark class="ed-chg">تغيير</mark> <mark class="ed-add">زيادة</mark> <mark class="ed-del">نقص</mark> <mark class="ed-sp">ضبط/إملاء</mark> <mark class="ed-chg ed-q">في آية</mark> <mark class="ed-chg ed-nm">في اسم علم</mark></p>`);
    $$("[data-edsel]").forEach(s => s.onchange = () => { const v = s.value, isA = s.dataset.edsel === "a"; location.hash = "#/editions/" + encodeURIComponent(isA ? v : a0.id) + "?" + new URLSearchParams({ b: isA ? other.id : v, p: 1 }); });
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=ed]"); if (!el) return; const a = el.dataset.act;
    if (a === "eds") { e.preventDefault(); if (typeof closeSheet === "function") closeSheet(); open(el.dataset.id || (parse().p[1])); }
    else if (a === "edmain") setMain(el.dataset.w, el.dataset.u);
    else if (a === "edlink") { const id = el.dataset.sel ? ($("#edother") || {}).value : el.dataset.id; if (id) link(el.dataset.w, id); }
  });
  document.addEventListener("submit", e => { const f = e.target; if (!f.dataset || !/^ed/.test(f.dataset.form || "")) return; e.preventDefault();
    if (f.dataset.form === "edmeta") saveMeta(f); else if (f.dataset.form === "ednew") upload(f); }, true);

  return { strip, secondary, units, workOf, label, view: vEditions, open, diff, classify, bestPage, toks };
})();
