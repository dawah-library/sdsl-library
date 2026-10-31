/* «مجلة المكتبة» (الباب ٣١ من وثيقة التطوير): أعداد دورية تُبنى من محتوى المكتبة نفسه.
   البيانات في data/majalla.json: {v, name, issues:[{id, no, title, theme, date, status, intro, secs:[{t, items:[...]}], log:[...]}]}.
   المادة: {ref, p, p2} لسجل في المكتبة (كتاب ونطاق صفحات، أو مقال/فتوى كاملًا)، أو {text, author, src} لنص ملصوق.
   العنوان التحريري (title) والمقدمة (intro) من إعداد المجلة ويُميَّزان عن النص الأصلي، والنص الأصلي لا يُغيَّر.
   الحالات: draft مسودة، review قيد المراجعة، approved معتمد، published منشور؛ لا يرى الزائر إلا المنشور، والنشر للمدير وحده. */
const MAJ = (() => {
  const P = "data/majalla.json", NAME = "مجلة مكتبة الدعوة السلفية";
  const ST = [["draft", "مسودة"], ["review", "قيد المراجعة"], ["approved", "معتمد للنشر"], ["published", "منشور"]];
  const stName = k => (ST.find(s => s[0] === k) || ST[0])[1];
  let D = null, ED = null; // ED: العدد المفتوح للتحرير (نسخة محلية حتى الحفظ)
  const load = async (fresh) => { if (D && !fresh) return D; try { const r = await fetch(P + (fresh ? "?fresh=1" : ""), { cache: "no-cache" }); D = r.ok ? await r.json() : null; } catch (e) { D = null; } D = D && D.issues ? D : { v: 1, name: NAME, issues: [] }; return D; };
  const staff = () => typeof isAdmin === "function" && isAdmin();
  const canPublish = () => (typeof GH !== "undefined" && GH.on) || (typeof Cloud !== "undefined" && Cloud.staff() && Cloud.role === "admin");
  const visible = () => D.issues.filter(x => x.status === "published" || staff()).sort((a, b) => (b.no || 0) - (a.no || 0));
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return d || ""; } };
  const kindAr = b => ({ article: "مقال", fatwa: "فتوى", statement: "بيان", book: "من كتاب" })[kindOf(b)] || "مادة";
  const itemTitle = it => { const b = it.ref && B(it.ref); return it.title || (b ? b.title : "") || "مادة"; };
  const itemOrig = it => { const b = it.ref && B(it.ref); return b ? b.title : ""; };
  const itemAuthor = it => { const b = it.ref && B(it.ref); return b ? A(b.authorId).name : (it.author || ""); };
  const paras = t => String(t || "").split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => `<p>${esc(s)}</p>`).join("");
  const anchor = (si, ii) => `m${si}-${ii}`;
  const used = (except) => new Set(D.issues.filter(x => x.id !== except).flatMap(x => (x.secs || []).flatMap(s => s.items.map(i => i.ref).filter(Boolean))));

  // نص المادة من المكتبة: المقال كاملًا، ومن الكتاب نطاق صفحات لا يتجاوز خمسًا
  async function itemText(it) {
    if (!it.ref) return it.text || "";
    const b = await loadBook(it.ref);
    if (kindOf(b) !== "book") return b.pages.join("\n");
    const p = Math.max(1, it.p || 1), p2 = Math.min(b.pages.length, Math.max(p, it.p2 || p), p + 4);
    return b.pages.slice(p - 1, p2).join("\n");
  }
  const srcLink = it => { const b = it.ref && B(it.ref); if (!b) return it.src ? esc(it.src) : ""; const pg = kindOf(b) === "book" ? "/" + (it.p || 1) : ""; return `<a href="#/book/${esc(b.id)}${pg}">${esc(b.title)}${pg ? " — ص" + toAr(it.p || 1) + (it.p2 > it.p ? "–" + toAr(it.p2) : "") : ""}</a>`; };

  // ---------- صفحات الزائر ----------
  async function show(q, id) {
    view(`<h2>${NAME}</h2><p class="mut">جارٍ التحميل…</p>`);
    await load();
    if (id) return issue(id);
    const L = visible();
    view(`<div class="majhead"><h2>${esc(D.name || NAME)}</h2><p class="mut">مجلة دورية تجمع في كل عدد موضوعًا علميًا أو دعويًا من كتب المكتبة ومقالاتها وفتاواها، مرتبةً في أبواب، مع روابط القراءة في مصادرها الأصلية. العناوين والمقدمات التحريرية من إعداد المجلة، والنصوص كما هي في مصادرها.</p></div>
     ${staff() ? `<p><a class="btn s" href="#/admin?t=majalla">إدارة أعداد المجلة</a></p>` : ""}
     <div class="majlist">${L.map(x => `<a class="majcard" href="#/majalla/${esc(x.id)}"><span class="majno">العدد ${toAr(x.no || "")}</span><b>${esc(x.title || x.theme || "")}</b><span class="mut">${esc(fmtDate(x.date))}${x.status !== "published" ? ` • <span class="rb ad">${esc(stName(x.status))}</span>` : ""}</span><small class="mut">${esc((x.secs || []).map(s => s.t).join(" • "))}</small></a>`).join("") || '<div class="note">لم يصدر عدد بعد. تُعدّ الأعداد من «الإدارة ← مجلة المكتبة» وتظهر هنا بعد اعتمادها ونشرها.</div>'}</div>`);
  }

  async function issue(id) {
    const x = D.issues.find(y => y.id === id);
    if (!x || (x.status !== "published" && !staff())) return view(`<p><a href="#/majalla">${NAME}</a> ›</p><div class="note">هذا العدد غير موجود أو لم يُنشر بعد.</div>`);
    const secs = x.secs || [], fav = S.favs.includes("maj:" + x.id);
    const toc = secs.map((s, si) => `<li><b>${esc(s.t)}</b><ol>${s.items.map((it, ii) => `<li><a href="#/majalla/${esc(x.id)}" data-majgo="${anchor(si, ii)}">${esc(itemTitle(it))}</a> <span class="mut">— ${esc(itemAuthor(it))}</span></li>`).join("")}</ol></li>`).join("");
    view(`<p class="noprint"><a href="#/majalla">${NAME}</a> › العدد ${toAr(x.no || "")}</p>
     <article id="majissue" class="majissue">
      <header class="majmast"><div class="majname">${esc(D.name || NAME)}</div><div>العدد ${toAr(x.no || "")} • ${esc(fmtDate(x.date))}</div>${x.status !== "published" ? `<div class="rb ad">${esc(stName(x.status))} — لا يراه الزوار</div>` : ""}<h2>${esc(x.title || x.theme || "")}</h2></header>
      <div class="row noprint majtools"><button class="btn s" data-majact="fav" data-id="${esc(x.id)}">${fav ? "★ في المفضلة" : "☆ حفظ العدد"}</button><button class="btn s" data-majact="share" data-id="${esc(x.id)}">مشاركة</button><button class="btn s" data-majact="pdf">PDF / طباعة</button><button class="btn s" data-majact="word" data-id="${esc(x.id)}">Word</button>${staff() ? `<a class="btn s" href="#/admin?t=majalla&i=${esc(x.id)}">تحرير العدد</a>` : ""}</div>
      ${x.intro ? `<section class="majintro"><h3>افتتاحية العدد</h3>${paras(x.intro)}</section>` : ""}
      <nav class="majtoc"><h3>فهرس العدد</h3><ol>${toc}</ol></nav>
      ${secs.map((s, si) => `<section class="majsec"><h3 class="majsect">${esc(s.t)}</h3>${s.items.map((it, ii) => `<div class="majitem" id="${anchor(si, ii)}"><h4>${esc(itemTitle(it))}</h4><p class="mut">${esc(itemAuthor(it))}${itemOrig(it) && itemOrig(it) !== itemTitle(it) ? ` • العنوان الأصلي: «${esc(itemOrig(it))}» <small>(العنوان أعلاه من إعداد المجلة)</small>` : ""}${it.ref ? " • " + esc(kindAr(B(it.ref) || {})) : ""}</p>${it.intro ? `<aside class="majnote"><b>مقدمة المجلة:</b> ${esc(it.intro)}</aside>` : ""}<div class="majtext" data-mt="${si}-${ii}"><p class="mut">جارٍ تحميل النص…</p></div><p class="majsrc mut">المصدر: ${srcLink(it)}</p></div>`).join("")}</section>`).join("")}
      <footer class="majfoot mut">${esc(D.name || NAME)} — العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))}. النصوص منقولة بلفظها من مصادرها في المكتبة، وما عدا ذلك من إعداد المجلة.</footer>
     </article>`);
    for (let si = 0; si < secs.length; si++) for (let ii = 0; ii < secs[si].items.length; ii++) {
      const el = document.querySelector(`[data-mt="${si}-${ii}"]`);
      itemText(secs[si].items[ii]).then(t => { if (el) el.innerHTML = paras(t) || '<p class="mut">لا نص.</p>'; }).catch(e => { if (el) el.innerHTML = `<p class="mut">تعذر تحميل النص (${esc(e.message)}).</p>`; });
    }
  }

  // تصدير Word: مستند HTML يفتحه Word بتنسيقه واتجاهه
  async function word(id) {
    const x = D.issues.find(y => y.id === id); if (!x) return;
    toast("جارٍ تجهيز ملف Word…");
    let body = `<h1 style="text-align:center">${esc(D.name || NAME)}</h1><p style="text-align:center">العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))}</p><h2 style="text-align:center">${esc(x.title || x.theme || "")}</h2>`;
    if (x.intro) body += `<h3>افتتاحية العدد</h3>${paras(x.intro)}`;
    body += `<h3>فهرس العدد</h3>` + (x.secs || []).map(s => `<p><b>${esc(s.t)}</b>: ${s.items.map(it => esc(itemTitle(it))).join("، ")}</p>`).join("");
    for (const s of x.secs || []) {
      body += `<h2>${esc(s.t)}</h2>`;
      for (const it of s.items) {
        let t = ""; try { t = await itemText(it); } catch (e) { t = "(تعذر تحميل النص)"; }
        const b = it.ref && B(it.ref), link = b ? location.origin + location.pathname + "#/book/" + b.id + (kindOf(b) === "book" ? "/" + (it.p || 1) : "") : "";
        body += `<h3>${esc(itemTitle(it))}</h3><p><i>${esc(itemAuthor(it))}${itemOrig(it) && itemOrig(it) !== itemTitle(it) ? " — العنوان الأصلي: «" + esc(itemOrig(it)) + "»" : ""}</i></p>${it.intro ? `<p style="border-right:3px solid #b88a2e;padding-right:8px"><b>مقدمة المجلة:</b> ${esc(it.intro)}</p>` : ""}${paras(t)}<p><small>المصدر: ${b ? `<a href="${esc(link)}">${esc(b.title)}</a>` : esc(it.src || "")}</small></p>`;
      }
    }
    body += `<hr><p><small>${esc(D.name || NAME)} — العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))}</small></p>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(D.name || NAME)} ${x.no || ""}</title><style>body{direction:rtl;font-family:'Traditional Arabic',Amiri,serif;font-size:16pt}h1,h2,h3{font-family:Amiri,serif}</style></head><body dir="rtl">${body}</body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" })); a.download = `majalla-${x.no || x.id}.doc`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------- المسودة الآلية ----------
  // تختار من المقالات والفتاوى والكتب ما يطابق كلمات الموضوع في العنوان أو القسم، دون تكرار ما نُشر في أعداد سابقة،
  // وبتنويع الكتّاب (مادة واحدة لكل كاتب في الباب، إلا الفتاوى فأغلبها لمفتٍ واحد)، ثم تبحث في نص الكتب المرشحة عن الصفحة الأنسب.
  async function autoDraft(theme, except) {
    const w = norm(theme).split(/\s+/).filter(s => s.length > 1); if (!w.length) throw new Error("اكتب كلمات الموضوع");
    const skip = used(except), score = b => { const t = norm(b.title), tp = norm(topicLabel(T(b.topicId))); return w.reduce((n, k) => n + (t.includes(k) ? 3 : 0) + (tp.includes(k) ? 1 : 0), 0); };
    const pick = (list, n, per = 1) => { const seen = {}, out = []; list.map(b => [b, score(b)]).filter(([b, s]) => s > 0 && !skip.has(b.id) && !b.hidden && !b.h).sort((x, y) => y[1] - x[1] || (y[0].date || "").localeCompare(x[0].date || "")).forEach(([b]) => { if (out.length < n && (seen[b.authorId] || 0) < per) { seen[b.authorId] = (seen[b.authorId] || 0) + 1; out.push(b); } }); return out; };
    const books = async (list, n) => { const out = []; for (const b of pick(list, n * 3)) { if (out.length >= n) break; try { const bb = await loadBook(b.id); let best = 0, bp = 1; bb.pages.forEach((pg, i) => { const t = norm(pg); const s = w.reduce((m, k) => m + (t.includes(k) ? 1 : 0), 0); if (s > best) { best = s; bp = i + 1; } }); if (best) out.push({ ref: b.id, p: bp, p2: Math.min(bb.pages.length, bp + 1) }); } catch (e) { } } return out; };
    const secs = [
      { t: "مقالات العدد", items: pick(ARTS(), 4).map(b => ({ ref: b.id })) },
      { t: "فتاوى في الموضوع", items: pick(FATWAS(), 4, 4).map(b => ({ ref: b.id })) },
      { t: "من كتب مشايخ الدعوة", items: await books(BOOKS().filter(b => bc(b) === "dawah"), 2) },
      { t: "من المكتبة العامة", items: await books(BOOKS().filter(b => bc(b) === "turath" && !b.vf), 2) }
    ].filter(s => s.items.length);
    if (!secs.length) throw new Error("لم توجد مواد مطابقة؛ جرّب كلمات أخرى");
    return secs;
  }

  // ---------- الإدارة ----------
  async function admin(q) {
    await load(true);
    const L = D.issues.slice().sort((a, b) => (b.no || 0) - (a.no || 0)), id = q && q.i;
    if (id && L.some(x => x.id === id)) { ED = JSON.parse(JSON.stringify(L.find(x => x.id === id))); setTimeout(paint, 0); return `<div id="majed"></div>`; }
    const next = Math.max(0, ...L.map(x => x.no || 0)) + 1;
    return `<p class="mut">كل عدد يُبنى من مواد المكتبة نفسها (بروابطها وبنصها الأصلي)، ويمكن لصق نص جديد. اكتب الموضوع فتُعدّ المجلة مسودة آلية تراجعها وتعدّلها، ثم ترسلها للمراجعة، ويعتمدها المدير وينشرها.</p>
     <form data-form="majnew" class="relform"><div class="row"><div><label>رقم العدد</label><input name="no" type="number" min="1" value="${next}"></div><div><label>تاريخ العدد</label><input name="date" type="date" value="${today()}"></div></div>
      <label>موضوع العدد (كلمات يُبحث بها في المكتبة)</label><input name="theme" required maxlength="120" placeholder="مثل: الصيام، بر الوالدين، التوحيد">
      <label>عنوان العدد (اختياري؛ الافتراضي الموضوع)</label><input name="title" maxlength="160">
      <div class="savebar"><button class="btn p" name="auto" value="1">إنشاء مسودة آلية</button> <button class="btn" name="auto" value="0">عدد فارغ</button> <span id="majst" class="mut"></span></div></form>
     <h3>الأعداد (${toAr(L.length)})</h3>${L.map(x => `<div class="bk"><b>العدد ${toAr(x.no || "")}: ${esc(x.title || x.theme || "")}</b><span>${esc([fmtDate(x.date), stName(x.status), (x.secs || []).reduce((n, s) => n + s.items.length, 0) + " مادة"].join(" • "))}</span> <a class="btn s" href="#/admin?t=majalla&i=${esc(x.id)}">تحرير</a> <a class="btn s" href="#/majalla/${esc(x.id)}">معاينة</a></div>`).join("") || '<p class="mut">لا أعداد بعد.</p>'}`;
  }

  function paint() {
    const el = document.getElementById("majed"); if (!el || !ED) return;
    const x = ED, ns = (x.secs || []).length;
    const stOpts = ST.filter(([k]) => k !== "published" || canPublish() || x.status === "published").map(([k, l]) => `<option value="${k}"${x.status === k ? " selected" : ""}>${l}</option>`).join("");
    el.innerHTML = `<p><a href="#/admin?t=majalla">كل الأعداد</a> › العدد ${toAr(x.no || "")} <a class="btn s" href="#/majalla/${esc(x.id)}">معاينة المحفوظ</a></p>
     <div class="row"><div><label>رقم العدد</label><input data-majf="no" type="number" min="1" value="${esc(x.no || "")}"></div><div><label>التاريخ</label><input data-majf="date" type="date" value="${esc(x.date || "")}"></div><div><label>الحالة</label><select data-majf="status">${stOpts}</select></div></div>
     <label>عنوان العدد</label><input data-majf="title" maxlength="160" value="${esc(x.title || "")}">
     <label>افتتاحية العدد (من إعداد المجلة)</label><textarea data-majf="intro" rows="4" maxlength="4000">${esc(x.intro || "")}</textarea>
     ${(x.secs || []).map((s, si) => `<fieldset class="majsecd"><legend><input data-majsec="${si}" value="${esc(s.t)}" maxlength="80" aria-label="اسم الباب"></legend>
       ${s.items.map((it, ii) => `<div class="majit"><div><b>${toAr(ii + 1)}. ${esc(itemTitle(it))}</b> <span class="mut">${esc(itemAuthor(it))}${it.ref ? " • " + esc(kindAr(B(it.ref) || {})) + (kindOf(B(it.ref) || {}) === "book" ? ` ص${toAr(it.p || 1)}${it.p2 > it.p ? "–" + toAr(it.p2) : ""}` : "") : " • نص ملصوق"}</span></div>
        <div class="row"><input data-majit="${si}.${ii}.title" placeholder="عنوان تحريري (اختياري؛ الأصلي: ${esc(itemOrig(it) || "—")})" value="${esc(it.title || "")}" maxlength="160">${kindOf(B(it.ref) || {}) === "book" ? `<input data-majit="${si}.${ii}.p" type="number" min="1" style="max-width:90px" value="${it.p || 1}" aria-label="من صفحة"><input data-majit="${si}.${ii}.p2" type="number" min="1" style="max-width:90px" value="${it.p2 || it.p || 1}" aria-label="إلى صفحة">` : ""}</div>
        <textarea data-majit="${si}.${ii}.intro" rows="2" maxlength="1500" placeholder="مقدمة المجلة لهذه المادة (اختياري)">${esc(it.intro || "")}</textarea>
        <div class="majbtns"><button class="btn s" data-majact="up" data-k="${si}.${ii}" ${ii ? "" : "disabled"}>↑</button><button class="btn s" data-majact="down" data-k="${si}.${ii}" ${ii < s.items.length - 1 ? "" : "disabled"}>↓</button>${ns > 1 ? `<select data-majact="move" data-k="${si}.${ii}" aria-label="نقل إلى باب"><option value="">نقل إلى باب…</option>${x.secs.map((t, k) => k !== si ? `<option value="${k}">${esc(t.t)}</option>` : "").join("")}</select>` : ""}<button class="btn s" data-majact="rm" data-k="${si}.${ii}">إزالة من العدد</button></div></div>`).join("") || '<p class="mut">لا مواد في هذا الباب.</p>'}
       <div class="row"><input data-majadd="${si}" placeholder="أضف مادة: معرّفها أو رابطها في المكتبة (مثل ‎#/book/sv123‎)"><button class="btn s" data-majact="add" data-k="${si}">إضافة</button></div>
       <details><summary>لصق نص جديد في هذا الباب</summary><input data-majpaste="${si}.title" placeholder="العنوان" maxlength="160"><input data-majpaste="${si}.author" placeholder="الكاتب" maxlength="120"><input data-majpaste="${si}.src" placeholder="المصدر" maxlength="200"><textarea data-majpaste="${si}.text" rows="5" maxlength="40000" placeholder="النص"></textarea><button class="btn s" data-majact="paste" data-k="${si}">إضافة النص</button></details>
       <button class="btn s" data-majact="rmsec" data-k="${si}">حذف الباب من العدد</button></fieldset>`).join("")}
     <div class="row"><input id="majnewsec" placeholder="اسم باب جديد" maxlength="80"><button class="btn s" data-majact="addsec">إضافة باب</button></div>
     <details><summary>إعادة إنشاء المسودة الآلية بموضوع آخر (يستبدل الأبواب الحالية)</summary><div class="row"><input id="majretheme" value="${esc(x.theme || "")}" maxlength="120"><button class="btn s" data-majact="regen">إنشاء</button></div></details>
     <div class="savebar"><button class="btn p" data-majact="save">حفظ العدد</button> <span id="majst" class="mut">${x.log && x.log.length ? "آخر تعديل: " + esc(fmtDate(x.log[x.log.length - 1].at)) : ""}</span></div>
     ${x.log && x.log.length ? `<details><summary>سجل العدد</summary><ul class="mut">${x.log.slice(-30).reverse().map(l => `<li>${esc(fmtDate(l.at))} — ${esc(l.by)}: ${esc(l.act)}</li>`).join("")}</ul></details>` : ""}`;
  }
  const at = k => { const [si, ii] = k.split(".").map(Number); return [ED.secs[si], ii, si]; };
  const who = () => (typeof Cloud !== "undefined" && Cloud.role === "admin") || (typeof GH !== "undefined" && GH.on) ? "المدير" : "محرر";
  const refOf = s => { s = String(s || "").trim(); const m = s.match(/#\/book\/([^/?#\s]+)/); const id = m ? decodeURIComponent(m[1]) : s; return B(id) ? id : ""; };

  async function persist(x, act) {
    x.log = (x.log || []).concat({ at: new Date().toISOString(), by: who(), act }).slice(-200);
    await GH.editJSON(P, d => { d = d && d.issues ? d : { v: 1, name: NAME, issues: [] }; const i = d.issues.findIndex(y => y.id === x.id); if (i >= 0) d.issues[i] = x; else d.issues.push(x); return d; }, "مجلة المكتبة: " + act + " — العدد " + (x.no || x.id));
    D = null;
  }

  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=majnew]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), st = f.querySelector("#majst"), auto = e.submitter ? e.submitter.value === "1" : true;
    const x = { id: "i" + Date.now().toString(36), no: +fd.get("no") || 1, date: fd.get("date") || today(), theme: String(fd.get("theme") || "").trim(), title: String(fd.get("title") || "").trim() || String(fd.get("theme") || "").trim(), status: "draft", intro: "", secs: [] };
    try { if (auto) { st.textContent = "جارٍ البحث في المكتبة وإعداد المسودة…"; x.secs = await autoDraft(x.theme, x.id); } else x.secs = [{ t: "مقالات العدد", items: [] }];
      st.textContent = "جارٍ الحفظ…"; await persist(x, auto ? "إنشاء مسودة آلية بموضوع «" + x.theme + "»" : "إنشاء عدد فارغ"); location.hash = "#/admin?t=majalla&i=" + x.id; }
    catch (err) { st.textContent = "تعذر: " + err.message; }
  }, true);

  document.addEventListener("input", e => {
    const t = e.target; if (!ED || !t.closest("#majed")) return;
    if (t.dataset.majf) ED[t.dataset.majf] = t.dataset.majf === "no" ? +t.value : t.value;
    else if (t.dataset.majsec) ED.secs[+t.dataset.majsec].t = t.value;
    else if (t.dataset.majit) { const [si, ii, k] = t.dataset.majit.split("."), it = ED.secs[+si].items[+ii]; if (k === "p" || k === "p2") it[k] = Math.max(1, +t.value || 1); else if (t.value.trim()) it[k] = t.value; else delete it[k]; }
  });

  document.addEventListener("change", e => {
    const t = e.target; if (!ED || t.dataset.majact !== "move" || t.value === "") return;
    const [s, ii] = at(t.dataset.k); ED.secs[+t.value].items.push(s.items.splice(ii, 1)[0]); paint();
  });

  document.addEventListener("click", async e => {
    const g = e.target.closest("[data-majgo]"); if (g) { e.preventDefault(); const el = document.getElementById(g.dataset.majgo); if (el) el.scrollIntoView({ behavior: "smooth" }); return; }
    const el = e.target.closest("[data-majact]"); if (!el || el.tagName === "SELECT") return; e.preventDefault(); e.stopImmediatePropagation();
    const a = el.dataset.majact;
    if (a === "pdf") return window.print();
    if (a === "word") { await load(); return word(el.dataset.id); }
    if (a === "fav") { const k = "maj:" + el.dataset.id; S.favs = S.favs.includes(k) ? S.favs.filter(y => y !== k) : [...S.favs, k]; saveS(); el.textContent = S.favs.includes(k) ? "★ في المفضلة" : "☆ حفظ العدد"; return; }
    if (a === "share") { const x = D && D.issues.find(y => y.id === el.dataset.id), url = location.origin + location.pathname + "#/majalla/" + el.dataset.id, t = (D.name || NAME) + " — العدد " + ((x && x.no) || "") + ": " + ((x && x.title) || ""); if (navigator.share) navigator.share({ title: t, url }).catch(() => { }); else { navigator.clipboard.writeText(t + "\n" + url).then(() => toast("نُسخ الرابط")); } return; }
    if (!ED) return;
    const st = document.getElementById("majst");
    if (a === "up" || a === "down") { const [s, ii] = at(el.dataset.k), j = a === "up" ? ii - 1 : ii + 1; [s.items[ii], s.items[j]] = [s.items[j], s.items[ii]]; paint(); }
    else if (a === "rm") { const [s, ii] = at(el.dataset.k); s.items.splice(ii, 1); paint(); }
    else if (a === "rmsec") { if (!ED.secs[+el.dataset.k].items.length || confirm("حذف الباب وما فيه من العدد؟ (لا تُحذف المواد من المكتبة)")) { ED.secs.splice(+el.dataset.k, 1); paint(); } }
    else if (a === "addsec") { const v = (document.getElementById("majnewsec").value || "").trim(); if (v) { ED.secs.push({ t: v, items: [] }); paint(); } }
    else if (a === "add") { const si = +el.dataset.k, inp = document.querySelector(`[data-majadd="${si}"]`), id = refOf(inp.value); if (!id) { st.textContent = "لم يُعثر على هذه المادة في المكتبة."; return; }
      if (ED.secs.some(s => s.items.some(i => i.ref === id))) { st.textContent = "هذه المادة موجودة في العدد."; return; }
      const prev = used(ED.id); ED.secs[si].items.push(kindOf(B(id)) === "book" ? { ref: id, p: 1, p2: 1 } : { ref: id }); paint(); document.getElementById("majst").textContent = prev.has(id) ? "تنبيه: نُشرت هذه المادة في عدد سابق." : "أُضيفت."; }
    else if (a === "paste") { const si = el.dataset.k, v = k => (document.querySelector(`[data-majpaste="${si}.${k}"]`).value || "").trim(), text = v("text");
      if (!text || !v("title")) { st.textContent = "اكتب العنوان والنص."; return; } ED.secs[+si].items.push({ title: v("title"), author: v("author"), src: v("src"), text }); paint(); }
    else if (a === "regen") { const th = (document.getElementById("majretheme").value || "").trim(); st.textContent = "جارٍ إعداد المسودة…"; try { ED.secs = await autoDraft(th, ED.id); ED.theme = th; paint(); } catch (err) { st.textContent = err.message; } }
    else if (a === "save") {
      if (ED.status === "published" && !canPublish()) { st.textContent = "النشر للمدير وحده؛ اختر «قيد المراجعة»."; return; }
      el.disabled = true; st.textContent = "جارٍ الحفظ…";
      try { await persist(ED, "حفظ (" + stName(ED.status) + ")"); st.textContent = "حُفظ ✓"; } catch (err) { st.textContent = "تعذر الحفظ: " + err.message; }
      el.disabled = false;
    }
  }, true);

  const favCards = () => { if (!D) return ""; const L = D.issues.filter(x => S.favs.includes("maj:" + x.id) && x.status === "published"); return L.length ? `<h3>أعداد المجلة</h3>${L.map(x => `<a class="bk" href="#/majalla/${esc(x.id)}"><b>العدد ${toAr(x.no || "")}: ${esc(x.title || "")}</b><span>${esc(fmtDate(x.date))}</span></a>`).join("")}` : ""; };
  return { view: show, admin, load, favCards };
})();
