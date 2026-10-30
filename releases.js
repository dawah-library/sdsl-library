/* «جديد الإصدارات» (الباب ٣٣ من وثيقة التطوير): عرض الكتب والإصدارات الجديدة لمشايخ الدعوة ولدور النشر.
   البيانات في data/releases.json وتُدار من «الإدارة ← جديد الإصدارات». الإعلان المدفوع يُوسم بوضوح «إعلان مدفوع»،
   ولا يُعرض تصنيف فارغ. لا يُنشر إصدار إلا بعد اعتماده من الإدارة (approved). */
const REL = (() => {
  const P = "data/releases.json", NEWDAYS = 60;
  const CATS = [["aqeeda", "العقيدة والمنهج"], ["tafsir", "التفسير وعلوم القرآن"], ["hadith", "الحديث وعلومه"], ["fiqh", "الفقه وأصوله"], ["dawah", "الدعوة والتربية"], ["history", "التاريخ والتراجم"], ["studies", "الدراسات والأبحاث"], ["other", "موضوعات أخرى"]];
  const ROLES = ["تأليف", "تحقيق", "ترجمة", "شرح", "إعداد"];
  let D = null;
  const load = async (fresh) => { if (D && !fresh) return D; try { const r = await fetch(P + (fresh ? "?fresh=1" : "")); D = r.ok ? await r.json() : { items: [] }; } catch (e) { D = { items: [] }; } D.items = D.items || []; return D; };
  const cat = k => (CATS.find(c => c[0] === k) || [k, k])[1];
  const isNew = x => x.date && (Date.now() - new Date(x.date)) / 864e5 <= NEWDAYS;
  const pub = () => (D ? D.items : []).filter(x => x.approved && !x.hidden && (!x.until || x.until >= today()));
  const safeUrl = u => /^https:\/\//i.test(u || "") ? u : "";
  const badges = x => (x.sponsored ? '<span class="rb ad">إعلان مدفوع</span>' : "") + (isNew(x) ? '<span class="rb nw">إصدار جديد</span>' : "") + (x.pick ? '<span class="rb pk">مختارات المحررين</span>' : "");
  const meta = x => [x.author && (x.role || "تأليف") + ": " + x.author, x.publisher && "الناشر: " + x.publisher, x.vols > 1 && toAr(x.vols) + " مجلدات", x.edition && "الطبعة " + x.edition, x.year && "سنة النشر " + toAr(x.year)].filter(Boolean).map(esc).join(" • ");
  const cover = x => safeUrl(x.cover) ? `<img class="rc" src="${esc(x.cover)}" alt="غلاف ${esc(x.title)}" loading="lazy">` : `<div class="rc ph" aria-hidden="true">${esc(x.title.slice(0, 18))}</div>`;
  const card = x => `<a class="rel" href="#/releases/${esc(x.id)}">${cover(x)}<div><div>${badges(x)}</div><b>${esc(x.title)}</b><span class="mut">${meta(x)}</span>${x.desc ? `<p>${esc(cut(x.desc, 150))}</p>` : ""}<small class="mut">${esc(cat(x.cat))} • أُضيف ${esc(x.date || "")}</small></div></a>`;
  function cut(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  async function show(q, id) {
    view_(`<h2>جديد الإصدارات</h2><p class="mut">جارٍ التحميل…</p>`);
    await load(); const all = pub();
    if (id) {
      const x = all.find(y => y.id === id);
      if (!x) return view_(`<p><a href="#/releases">جديد الإصدارات</a> ›</p><div class="note">هذا الإصدار غير موجود أو لم يُعتمد بعد.</div>`);
      return view_(`<p><a href="#/releases">جديد الإصدارات</a> › <a href="#/releases?c=${esc(x.cat)}">${esc(cat(x.cat))}</a></p>
       <article class="reld">${cover(x)}<div><div>${badges(x)}</div><h2>${esc(x.title)}</h2><p class="mut">${meta(x)}</p>${x.desc ? `<p style="white-space:pre-line">${esc(x.desc)}</p>` : ""}
       <p class="mut">التصنيف: ${esc(cat(x.cat))}${x.date ? " • تاريخ الإضافة: " + esc(x.date) : ""}</p>
       ${safeUrl(x.link) ? `<p><a class="btn p" href="${esc(x.link)}" target="_blank" rel="noopener sponsored">${x.sponsored ? "صفحة الناشر" : "الشراء أو التواصل مع الناشر"}</a></p>` : ""}
       ${x.bookId && typeof B === "function" && B(x.bookId) ? `<p><a class="btn" href="#/book/${esc(x.bookId)}">اقرأه في المكتبة</a></p>` : ""}
       ${x.sponsored ? '<p class="note">هذا إعلان مدفوع من الناشر؛ عرضه لا يعني تزكية المكتبة لمحتواه.</p>' : ""}</div></article>`);
    }
    const f = { c: q.c || "", t: q.t || "", q: q.q || "", m: q.m === "list" ? "list" : "grid" };
    let r = all.filter(x => (!f.c || x.cat === f.c) && (!f.t || (f.t === "dawah" ? x.dawah : !x.dawah)));
    if (f.q.trim()) { const w = norm(f.q).split(/\s+/).filter(Boolean); r = r.filter(x => w.every(k => norm([x.title, x.author, x.publisher, x.desc].join(" ")).includes(k))); }
    r.sort((a, b) => (b.featured - a.featured) || (b.date || "").localeCompare(a.date || ""));
    const u = o => { const n = Object.assign({}, f, o), p = new URLSearchParams(); ["c", "t", "q", "m"].forEach(k => { if (n[k] && !(k === "m" && n[k] === "grid")) p.set(k, n[k]); }); return "#/releases" + (p.toString() ? "?" + p : ""); };
    const used = CATS.filter(c => all.some(x => x.cat === c[0])), feat = all.filter(x => x.featured).slice(0, 4), picks = all.filter(x => x.pick).slice(0, 4);
    view_(`<h2>جديد الإصدارات <span class="mut">(${toAr(r.length)})</span></h2>
     <p class="mut">جديد كتب مشايخ الدعوة السلفية بمصر وإصدارات دور النشر والمكتبات. الإعلانات المدفوعة موسومة بوضوح، ولا يُنشر إصدار إلا بعد مراجعة الإدارة.</p>
     ${all.length ? `<div class="tabs sub" role="tablist">${[["", "الكل"], ["dawah", "كتب مشايخ الدعوة"], ["pub", "دور النشر والمكتبات"]].map(([v, l]) => `<a role="tab" aria-selected="${f.t === v}" href="${u({ t: v })}">${l}</a>`).join("")}</div>
     ${used.length ? `<div class="chips">${[["", "كل التصنيفات"], ...used].map(([v, l]) => `<a class="chip${f.c === v ? " x" : ""}" href="${u({ c: v })}">${esc(l)}</a>`).join("")}</div>` : ""}
     <form class="sbox" data-form="relq" style="margin:8px 0;max-width:none">${["c", "t", "m"].map(k => `<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="ابحث بالعنوان أو المؤلف أو الناشر" aria-label="بحث في الإصدارات"><button class="btn">بحث</button></form>
     <p class="mut nf">طريقة العرض: <a href="${u({ m: "grid" })}"${f.m === "grid" ? ' style="font-weight:700"' : ""}>شبكة</a> • <a href="${u({ m: "list" })}"${f.m === "list" ? ' style="font-weight:700"' : ""}>قائمة</a></p>
     ${!f.c && !f.t && !f.q && feat.length ? `<h3>إصدارات مميزة</h3><div class="relg">${feat.map(card).join("")}</div>` : ""}
     ${!f.c && !f.t && !f.q && picks.length ? `<h3>مختارات المحررين</h3><div class="relg">${picks.map(card).join("")}</div>` : ""}
     <div class="${f.m === "list" ? "rell" : "relg"}">${r.map(card).join("") || '<div class="note">لا توجد إصدارات مطابقة.</div>'}</div>`
        : `<div class="note">لم تُضف إصدارات بعد. يُضيفها فريق المكتبة من «الإدارة ← جديد الإصدارات»، ويمكن لدور النشر والمكتبات طلب عرض إصداراتها من <a href="#/contact">تواصل معنا</a>.</div>`}`);
  }
  const view_ = h => view(h);

  // ---------- الإدارة ----------
  async function admin() {
    await load(true); const L = D.items.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const opt = (arr, v) => arr.map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${l}</option>`).join("");
    return `<p class="mut">إصدار جديد يظهر في صفحة <a href="#/releases">جديد الإصدارات</a> بعد تعليمه «معتمد». الإعلان المدفوع يُوسم تلقائيًا للزائر، ويمكن تحديد تاريخ انتهاء لعرضه.</p>
     <form data-form="relsave" class="relform"><input type="hidden" name="id">
      <div class="row"><div><label>عنوان الكتاب *</label><input name="title" required maxlength="200"></div><div><label>المؤلف أو المحقق أو المترجم</label><input name="author" maxlength="120"></div><div><label>الصفة</label><select name="role">${ROLES.map(r => `<option>${r}</option>`).join("")}</select></div></div>
      <div class="row"><div><label>دار النشر أو المكتبة</label><input name="publisher" maxlength="120"></div><div><label>التصنيف</label><select name="cat">${opt(CATS, "other")}</select></div><div><label>تاريخ الإضافة</label><input name="date" type="date" value="${today()}"></div></div>
      <div class="row"><div><label>عدد المجلدات</label><input name="vols" type="number" min="1" max="200"></div><div><label>الطبعة</label><input name="edition" maxlength="40"></div><div><label>سنة النشر</label><input name="year" type="number" min="1300" max="2100"></div></div>
      <label>نبذة مختصرة</label><textarea name="desc" rows="4" maxlength="2000"></textarea>
      <div class="row"><div><label>رابط صورة الغلاف (https)</label><input name="cover" type="url" placeholder="https://"></div><div><label>رابط الشراء أو التواصل (https، باعتماد الإدارة)</label><input name="link" type="url" placeholder="https://"></div><div><label>معرّف الكتاب في المكتبة (اختياري)</label><input name="bookId" maxlength="80"></div></div>
      <fieldset class="secs"><legend>العرض</legend><label class="inl"><input type="checkbox" name="approved" checked> معتمد للنشر</label><label class="inl"><input type="checkbox" name="dawah"> من كتب مشايخ الدعوة</label><label class="inl"><input type="checkbox" name="featured"> إصدار مميز</label><label class="inl"><input type="checkbox" name="pick"> مختارات المحررين</label><label class="inl"><input type="checkbox" name="sponsored"> إعلان مدفوع</label><label class="inl">ينتهي العرض في <input name="until" type="date" style="width:auto"></label></fieldset>
      <div class="savebar"><button class="btn p">حفظ الإصدار</button> <button type="reset" class="btn">جديد</button> <span id="relst" class="mut"></span></div></form>
     <h3>الإصدارات (${toAr(L.length)})</h3>${L.map(x => `<div class="bk"><b>${esc(x.title)}</b><span>${esc([x.publisher, x.date, x.approved ? "معتمد" : "بانتظار الاعتماد", x.hidden ? "مخفي" : "", x.sponsored ? "إعلان" : ""].filter(Boolean).join(" • "))}</span> <button class="btn s" data-act="reledit" data-id="${esc(x.id)}">تعديل</button> <button class="btn s" data-act="relhide" data-id="${esc(x.id)}">${x.hidden ? "إظهار" : "إخفاء"}</button></div>`).join("") || '<p class="mut">لا توجد إصدارات بعد.</p>'}`;
  }
  const FIELDS = ["title", "author", "role", "publisher", "cat", "date", "vols", "edition", "year", "desc", "cover", "link", "bookId", "until"], FLAGS = ["approved", "dawah", "featured", "pick", "sponsored"];
  async function save(f) {
    const fd = new FormData(f), st = f.querySelector("#relst"), o = {};
    FIELDS.forEach(k => { const v = String(fd.get(k) || "").trim(); if (v) o[k] = /^(vols|year)$/.test(k) ? +v : v; });
    FLAGS.forEach(k => { o[k] = !!fd.get(k); });
    for (const k of ["cover", "link"]) if (o[k] && !safeUrl(o[k])) { st.textContent = "الروابط يجب أن تبدأ بـ https://"; return; }
    const id = fd.get("id") || "r" + Date.now().toString(36);
    st.textContent = "جارٍ الحفظ…";
    try {
      await GH.editJSON(P, d => { d = d && d.items ? d : { v: 1, items: [] }; const i = d.items.findIndex(x => x.id === id); const prev = i >= 0 ? d.items[i] : {}; const x = Object.assign({ id }, i >= 0 ? { hidden: prev.hidden } : {}, o); if (i >= 0) d.items[i] = x; else d.items.unshift(x); return d; }, (fd.get("id") ? "تعديل إصدار: " : "إصدار جديد: ") + o.title);
      st.textContent = "حُفظ ✓"; D = null; setTimeout(route, 600);
    } catch (e) { st.textContent = "تعذر الحفظ: " + e.message; }
  }
  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form]"); if (!f) return;
    if (f.dataset.form === "relsave") { e.preventDefault(); e.stopImmediatePropagation(); save(f); }
    else if (f.dataset.form === "relq") { e.preventDefault(); e.stopImmediatePropagation(); const p = new URLSearchParams(); new FormData(f).forEach((v, n) => { if (v && !(n === "m" && v === "grid")) p.set(n, v); }); location.hash = "#/releases" + (p.toString() ? "?" + p : ""); }
  }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act^=rel]"); if (!el) return; e.preventDefault(); e.stopImmediatePropagation();
    const id = el.dataset.id, x = D && D.items.find(y => y.id === id); if (!x) return;
    if (el.dataset.act === "reledit") {
      const f = document.querySelector("form[data-form=relsave]"), E = k => f.elements.namedItem(k); E("id").value = id;
      FIELDS.forEach(k => { if (E(k)) E(k).value = x[k] == null ? "" : x[k]; }); FLAGS.forEach(k => { E(k).checked = !!x[k]; });
      f.scrollIntoView({ behavior: "smooth" });
    } else if (el.dataset.act === "relhide") {
      el.disabled = true;
      try { await GH.editJSON(P, d => { const y = d.items.find(z => z.id === id); if (y) y.hidden = !y.hidden; return d; }, (x.hidden ? "إظهار" : "إخفاء") + " إصدار: " + x.title); D = null; route(); }
      catch (err) { el.disabled = false; alert("تعذر الحفظ: " + err.message); }
    }
  }, true);
  return { view: show, admin, load, pub };
})();
