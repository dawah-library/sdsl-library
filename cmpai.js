/* المقارنة العلمية بين الكتب (المرحلة ٣-ج، #/compare?ai=1): كتابان فأكثر، بحث فوري عن الكتب أثناء الكتابة، اختيار محاور المقارنة
   (أو مقارنة عامة، أو تتبع مسألة/مصطلح)، ونتائج منظمة (اتفاق/اختلاف) بإحالات إلى الصفحات. متاحة لكل الأعضاء؛ وما يُرسل للنشر
   لا يظهر في «المقارنات المنشورة» (#/compare?pub=1) إلا بعد اعتماد الإدارة (#/compare?rev=1). الجدول: public.comparisons.
   المادة تُجمع في المتصفح من نص كل كتاب (مواضع المسألة بالبحث، أو فهرسه ومختصره وتشجيره للمقارنة العامة) ثم تُرسل إلى /api/edit (mode=compare). */
const CMPAI = (() => {
  const AXES = [["topics", "الموضوعات والأبواب"], ["issues", "المسائل العلمية"], ["terms", "المصطلحات والمفاهيم"], ["method", "مناهج المؤلفين وطرق العرض والاستدلال"], ["tarjih", "الأقوال والترجيحات"], ["one", "معالجة موضوع واحد في الكتب"]];
  const MAXB = 6, BUDGET = 56000;
  let pick = [];
  const getJ = async p => { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const title = b => b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title;
  const tabs = k => `<div class="tabs" role="tablist"><a role="tab" aria-selected="${k === "side"}" href="#/compare">جنبًا إلى جنب (كتابان)</a><a role="tab" aria-selected="${k === "ai"}" href="#/compare?ai=1">مقارنة علمية (كتابان فأكثر)</a><a role="tab" aria-selected="${k === "pub"}" href="#/compare?pub=1">المقارنات المنشورة</a>${isAdmin() || (typeof can === "function" && can("edit")) ? `<a role="tab" aria-selected="${k === "rev"}" href="#/compare?rev=1">مراجعة المقارنات</a>` : ""}</div>`;

  async function page(q) {
    if (q.pub) return pub(q); if (q.rev) return rev(); if (q.id) return one(+q.id);
    pick = String(q.b || "").split(",").map(x => B(x)).filter(Boolean).slice(0, MAXB);
    view(`<h2>المقارنة العلمية بين الكتب</h2>${tabs("ai")}<p class="mut">اختر كتابين أو أكثر (حتى ${toAr(MAXB)})، ثم محاور المقارنة، أو اكتب مسألة أو مصطلحًا لتتبعه فيها. تُستخرج أوجه الاتفاق والاختلاف منظمة بإحالات إلى مواضعها. الخدمة للأعضاء ومجانية ضمن الحصة اليومية للخادم (حد الاستخدام في الساعة لكل عضو).</p>
      <form data-form="cmpai" class="card cmpai"><label for="cmpq">الكتب</label><div id="cmpch" class="chips"></div><input id="cmpq" type="search" autocomplete="off" placeholder="اكتب حروفًا من اسم الكتاب أو المؤلف" aria-label="ابحث عن كتاب"><div id="cmpsug" class="cmpsug" role="listbox"></div>
      <label style="margin-top:10px">محاور المقارنة (يمكن الجمع بين أكثر من محور)</label><div class="chips">${AXES.map(([k, t]) => `<label class="chip"><input type="checkbox" name="ax" value="${k}"> ${t}</label>`).join("")}<label class="chip"><input type="checkbox" name="ax" value="general"${q.t ? "" : " checked"}> مقارنة عامة شاملة</label></div>
      <label for="cmpt" style="margin-top:10px">مسألة أو موضوع أو مصطلح يُتتبَّع في الكتب (اختياري)</label><input id="cmpt" name="t" value="${esc(q.t || "")}" placeholder="مثل: حجية خبر الآحاد، أو: التوسل">
      <div class="savebar"><button class="btn p">قارن</button> <span id="cmpst" class="mut"></span></div></form><div id="cmpout"></div>`);
    chips(); const inp = $("#cmpq");
    inp.addEventListener("input", () => sug(inp.value)); inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const f = $("#cmpsug [data-pick]"); if (f) f.click(); } });
  }
  function chips() { const el = $("#cmpch"); if (el) el.innerHTML = pick.map(b => `<span class="chip x">${esc(title(b))} <small class="mut">${esc(A(b.authorId).name)}</small> <button type="button" class="linkbtn" data-unpick="${esc(b.id)}" aria-label="إزالة">×</button></span>`).join("") || '<span class="mut">لم تختر كتابًا بعد.</span>'; }
  function sug(s) {
    const box = $("#cmpsug"), w = norm(s).trim().split(/\s+/).filter(Boolean); if (!box) return; if (!w.length) { box.innerHTML = ""; return; }
    const have = new Set(pick.map(b => b.id)), r = lib.books.filter(b => !b.hidden && !have.has(b.id) && (typeof isArt !== "function" || !isArt(b)) && (!b.set || !b.vol || b.vol === 1 || b.vol === 0)).map(b => [b, norm(title(b) + " " + A(b.authorId).name)]).filter(([, t]) => w.every(x => t.includes(x))).slice(0, 12);
    box.innerHTML = r.map(([b]) => `<button type="button" class="cmps" data-pick="${esc(b.id)}" role="option"><b>${esc(title(b))}</b> <span class="mut">${esc(A(b.authorId).name)}${b.set ? " • " + toAr(b.vols || 1) + " مج" : ""}</span></button>`).join("") || '<p class="mut">لا كتاب مطابق.</p>';
  }
  // مادة كل كتاب: مواضع المسألة (بحث صرفي في نصه) إن وُجدت مسألة، وإلا فهرسه ومختصره المحرر وتشجيره ومطالع فصوله
  async function material(b, topic, cap) {
    const set = b.set ? lib.books.filter(x => x.set === b.set).sort((x, y) => (x.vol || 0) - (y.vol || 0)) : [b]; const out = [];
    for (const v of set.slice(0, 12)) { try { await loadBook(v.id); } catch (e) { } }
    const vols = set.filter(v => v.pages);
    if (topic) {
      const hits = SDSLSearch.search({ books: vols, authors: lib.authors, topics: lib.topics }, topic, { k: 14, max: Math.max(500, Math.floor(cap / 14)), includeDemo: true });
      hits.forEach(h => out.push(`[${h.ref}] (${h.page || ""}) ${h.text || ""}`));
    }
    if (!topic || out.length < 3) {
      let S = null, T = null; try { const L = await getJ("data/summ/_list.json"); if (L && L[b.id]) S = await getJ("data/summ/" + b.id + ".json"); } catch (e) { } try { T = typeof TSJ !== "undefined" ? await TSJ.map(b.id) : null; } catch (e) { }
      if (T && T.s) out.push("خلاصة الكتاب: " + T.s);
      if (S && S.chs) S.chs.forEach(c => out.push(`[${b.id}:${c.p[0]}] فصل «${c.t}»: ${c.k || ""} ${String(c.r10 || "").replace(/\[ص\s*\d+\]/g, "")}`));
      else vols.forEach(v => (v.toc || []).filter(t => (t.l || 1) <= 2).slice(0, 60).forEach(t => out.push(`[${v.id}:${t.p}] ${t.t}: ${String(v.pages[t.p - 1] || "").split(/^\s*_{4,}\s*$/m)[0].replace(/^#.*$/gm, "").replace(/\s+/g, " ").slice(0, 380)}`)));
    }
    let s = out.join("\n"); if (s.length > cap) s = s.slice(0, cap) + "\n…"; return s;
  }
  async function run(f) {
    const st = $("#cmpst"), out = $("#cmpout"); if (typeof Auth === "undefined" || !Auth.user) return toast("سجّل الدخول لاستخدام المقارنة");
    if (pick.length < 2) return toast("اختر كتابين على الأقل");
    const axes = [...f.querySelectorAll("[name=ax]:checked")].map(x => x.value), topic = f.t.value.trim(); if (!axes.length && !topic) return toast("اختر محورًا أو اكتب مسألة");
    const btn = f.querySelector("button.p"); btn.disabled = true;
    try {
      st.textContent = "جارٍ جمع المادة من الكتب…"; const cap = Math.floor(BUDGET / pick.length), books = [];
      for (const b of pick) books.push({ id: b.id, title: title(b), author: A(b.authorId).name, died: A(b.authorId).died || "", text: await material(b, topic, cap) });
      st.textContent = "جارٍ التحليل والمقارنة… قد يستغرق دقيقة أو اثنتين";
      const r = await fetch("/api/edit", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + (Auth.token || "") }, body: JSON.stringify({ mode: "compare", books, axes: axes.map(k => (AXES.find(x => x[0] === k) || [k, k === "general" ? "مقارنة عامة شاملة" : k])[1]), topic }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "تعذر التنفيذ");
      window.__cmp = { books: pick.map(b => b.id), axes, topic, result: j.result, title: (topic ? "«" + topic + "» في: " : "مقارنة بين: ") + pick.map(title).join("، ") };
      out.innerHTML = render(window.__cmp) + `<div class="row" style="margin-top:12px"><button class="btn" data-cmpsave="private">💾 حفظ في مقارناتي</button><button class="btn p" data-cmpsave="pending">📤 إرسال للنشر (بعد اعتماد الإدارة)</button><button class="btn" data-cmpcopy>نسخ</button> <span id="cmpsv" class="mut"></span></div>`;
      st.textContent = ""; out.scrollIntoView({ behavior: "smooth" });
    } catch (x) { st.textContent = x.message; } finally { btn.disabled = false; }
  }
  // النتيجة: {summary, axes:[{axis, agree:[{point, refs:[ref]}], differ:[{point, views:[{book, view, refs:[ref]}]}]}], notes}
  const refLink = r => { const m = /^([^:\s]+):(\d+)$/.exec(String(r || "").trim()); if (!m || !B(m[1])) return ""; const b = B(m[1]); return `<a class="cref" href="#/book/${esc(m[1])}/${m[2]}">${esc((b.setTitle || b.title).slice(0, 30))} ${esc(PL(b, +m[2] - 1) || "ص " + toAr(+m[2]))}</a>`; };
  const refs = a => (a || []).map(refLink).filter(Boolean).join(" ");
  function render(c) {
    const R = c.result || {}, bn = id => { const b = B(id); return b ? title(b) : id; };
    return `<article class="cmpres"><h3>${esc(c.title || "")}</h3>${R.summary ? `<p class="brief">${esc(R.summary)}</p>` : ""}
      ${(R.axes || []).map(a => `<section class="cmpax"><h4>${esc(a.axis || "")}</h4>
        ${(a.agree || []).length ? `<h5>✅ أوجه الاتفاق</h5><ul>${a.agree.map(x => `<li>${esc(x.point || "")} ${refs(x.refs)}</li>`).join("")}</ul>` : ""}
        ${(a.differ || []).length ? `<h5>↔️ أوجه الاختلاف</h5>${a.differ.map(x => `<div class="cmpdif"><b>${esc(x.point || "")}</b><table class="kurtb"><tr><th>الكتاب</th><th>الموقف</th><th>الموضع</th></tr>${(x.views || []).map(v => `<tr><td>${esc(bn(v.book))}</td><td>${esc(v.view || "")}</td><td>${refs(v.refs)}</td></tr>`).join("")}</table></div>`).join("")}` : ""}</section>`).join("")}
      ${R.notes ? `<p class="mut">${esc(R.notes)}</p>` : ""}<p class="note">مقارنة آلية من نصوص الكتب في المكتبة؛ راجع المواضع المحال إليها قبل الاعتماد عليها أو نسبة قول إلى مؤلف.</p></article>`;
  }
  const asText = c => { const R = c.result || {}; return [c.title, R.summary, ...(R.axes || []).map(a => "■ " + a.axis + "\n" + (a.agree || []).map(x => "✓ " + x.point + " " + (x.refs || []).join(" ")).join("\n") + "\n" + (a.differ || []).map(x => "↔ " + x.point + "\n" + (x.views || []).map(v => "  - " + v.book + ": " + v.view + " " + (v.refs || []).join(" ")).join("\n")).join("\n"))].filter(Boolean).join("\n\n"); };
  async function save(status) {
    const c = window.__cmp, st = $("#cmpsv"); if (!c || !Auth.sb) return;
    const nm = (Auth.user.user_metadata || {}).name || "";
    const { error } = await Auth.sb.from("comparisons").insert({ title: c.title.slice(0, 300), books: c.books, axes: c.axes, topic: c.topic || null, result: c.result, status, user_name: nm });
    st.textContent = error ? "تعذّر الحفظ: " + error.message : status === "pending" ? "✓ أُرسلت للمراجعة؛ تظهر في المقارنات المنشورة بعد اعتماد الإدارة" : "✓ حُفظت في مقارناتك";
  }
  async function list(filter) { if (typeof Auth === "undefined" || !Auth.sb) return []; let q = Auth.sb.from("comparisons").select("id,title,books,axes,topic,status,user_name,created_at,user_id").order("created_at", { ascending: false }).limit(100); q = filter(q); const { data } = await q; return data || []; }
  const card = (x, extra) => `<div class="bk"><a href="#/compare?id=${x.id}"><b>${esc(x.title)}</b></a><span>${esc(x.user_name || "")} • ${esc(String(x.created_at || "").slice(0, 10))}${x.status !== "approved" ? ` • <em class="tag">${({ private: "خاصة", pending: "بانتظار الاعتماد", rejected: "مرفوضة" })[x.status] || x.status}</em>` : ""}</span>${extra || ""}</div>`;
  async function pub() {
    view(`<h2>المقارنات المنشورة</h2>${tabs("pub")}<div id="cmpl"><p class="mut">جارٍ التحميل…</p></div>`);
    const a = await list(q => q.eq("status", "approved")), mine = Auth && Auth.user ? await list(q => q.eq("user_id", Auth.user.id).neq("status", "approved")) : [];
    $("#cmpl").innerHTML = (a.map(x => card(x)).join("") || '<p class="mut">لا مقارنات منشورة بعد.</p>') + (mine.length ? `<h3>مقارناتي</h3>${mine.map(x => card(x, x.status === "private" ? ` <button class="btn s" data-cmpsend="${x.id}">إرسال للنشر</button>` : "")).join("")}` : "");
  }
  async function rev() {
    if (!(isAdmin() || can("edit"))) return view('<div class="note">مراجعة المقارنات للإدارة ومن فُوّض.</div>');
    view(`<h2>مراجعة المقارنات قبل النشر</h2>${tabs("rev")}<div id="cmpl"><p class="mut">جارٍ التحميل…</p></div>`);
    const a = await list(q => q.eq("status", "pending"));
    $("#cmpl").innerHTML = a.map(x => card(x, ` <button class="btn s p" data-cmpst="approved" data-id="${x.id}">اعتماد ونشر</button> <button class="btn s" data-cmpst="rejected" data-id="${x.id}">رفض</button>`)).join("") || '<p class="mut">لا مقارنات تنتظر المراجعة.</p>';
  }
  async function one(id) {
    view(`<p><a href="#/compare?pub=1">← المقارنات</a></p><div id="cmpone"><p class="mut">جارٍ التحميل…</p></div>`);
    const { data } = await Auth.sb.from("comparisons").select("*").eq("id", id).maybeSingle();
    $("#cmpone").innerHTML = data ? render(data) + `<p class="mut">أعدّها: ${esc(data.user_name || "عضو")} • ${esc(String(data.created_at).slice(0, 10))}</p>` : '<p class="note">المقارنة غير موجودة أو لم تُعتمد بعد.</p>';
  }
  document.addEventListener("click", async e => {
    const p = e.target.closest("[data-pick]"); if (p) { const b = B(p.dataset.pick); if (b && pick.length < MAXB) { pick.push(b); chips(); $("#cmpq").value = ""; $("#cmpsug").innerHTML = ""; $("#cmpq").focus(); } else if (pick.length >= MAXB) toast("الحد " + MAXB + " كتب"); return; }
    const u = e.target.closest("[data-unpick]"); if (u) { pick = pick.filter(b => b.id !== u.dataset.unpick); chips(); return; }
    const s = e.target.closest("[data-cmpsave]"); if (s) { s.disabled = true; await save(s.dataset.cmpsave); return; }
    if (e.target.closest("[data-cmpcopy]") && window.__cmp) { try { await navigator.clipboard.writeText(asText(window.__cmp)); toast("نُسخت"); } catch (x) { } return; }
    const d = e.target.closest("[data-cmpsend]"); if (d) { const { error } = await Auth.sb.from("comparisons").update({ status: "pending" }).eq("id", +d.dataset.cmpsend); toast(error ? error.message : "أُرسلت للمراجعة"); if (!error) pub(); return; }
    const r = e.target.closest("[data-cmpst]"); if (r) { const { error } = await Auth.sb.from("comparisons").update({ status: r.dataset.cmpst, reviewed_at: new Date().toISOString() }).eq("id", +r.dataset.id); toast(error ? error.message : "تم"); if (!error) rev(); }
  });
  document.addEventListener("submit", e => { const f = e.target.closest("[data-form=cmpai]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); run(f); }, true);
  return { view: page };
})();
