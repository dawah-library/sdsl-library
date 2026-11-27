/* ربط العضو بصفحة المؤلف وصلاحيات صفحته (طلب المدير، ٢٧ نوفمبر — البند ٤ من وثيقة الطلبات غير المنفذة).
   الجداول في supabase/migrations/2026-11-27-author-claims.sql: author_claims (الطلب والقرار)، author_pages (صورة الصفحة ونبذتها)، author_drafts (كتب مسودة).
   - على صفحة المؤلف: «🪪 هذه صفحتي» بدليل الهوية ووسيلة التواصل؛ والطلب يُراجَع يدويًّا (لا ربط بتطابق الاسم).
   - بعد القبول، على صفحته وحدها: تغيير الصورة والنبذة، ونشر المنشورات (دور «حساب شيخ» القائم)، ورفع كتب تبقى مسودة حتى تعتمدها الإدارة.
   - الإدارة (#/admin?t=claims): الطلبات بانتظار المراجعة، والروابط المعتمدة وسحبها، والمسودات المرفوعة واعتمادها أو ردها. */
const CLM = (() => {
  const on = () => typeof Cloud !== "undefined" && Cloud.on() && Auth.sb;
  const sb = () => Auth.sb;
  const C = new Map();  // ذاكرة قصيرة لكل مؤلف
  async function state(aid, force) {
    if (!on()) return { ok: [], mine: null, page: null };
    if (C.has(aid) && !force && Date.now() - C.get(aid).at < 60e3) return C.get(aid);
    const [ok, pg, mine] = await Promise.all([
      sb().from("author_claims").select("user_id").eq("author_id", aid).eq("status", "approved"),
      sb().from("author_pages").select("bio,photo,updated_at").eq("author_id", aid).maybeSingle(),
      Auth.user ? sb().from("author_claims").select("id,status,note,created_at").eq("author_id", aid).eq("user_id", Auth.user.id).order("created_at", { ascending: false }).limit(1) : Promise.resolve({ data: [] })]);
    const r = { at: Date.now(), ok: (ok.data || []).map(x => x.user_id), page: pg.data || null, mine: (mine.data || [])[0] || null };
    C.set(aid, r); return r;
  }
  const owner = (st) => !!(Auth.user && st.mine && st.mine.status === "approved");

  /* ===== صفحة المؤلف ===== */
  async function paint(aid) {
    const ent = document.querySelector(".ent"); if (!ent || ent.dataset.clm === aid) return; ent.dataset.clm = aid;
    let st; try { st = await state(aid); } catch (e) { return; }
    if ((parse().p || [])[1] !== aid) return;
    // صورة الصفحة ونبذتها من صاحبها
    if (st.page && st.page.photo) { const av = ent.querySelector(".ehead .aav"); if (av) { const im = document.createElement("img"); im.className = av.className; im.src = st.page.photo; im.alt = ""; av.replaceWith(im); } }
    if (st.page && st.page.bio) { let br = ent.querySelector(".abrief"); if (!br) { ent.querySelector(".ehead").insertAdjacentHTML("afterend", '<div class="abrief"><p></p></div>'); br = ent.querySelector(".abrief"); } br.querySelector("p").textContent = st.page.bio; }
    const eid = ent.querySelector(".eid"); if (st.ok.length && eid && !eid.querySelector(".ebadge.ver")) eid.insertAdjacentHTML("beforeend", ' <span class="ebadge ver" title="ربطت الإدارة هذه الصفحة بحساب صاحبها بعد التحقق من هويته">✔ صفحة موثّقة يديرها صاحبها</span>');
    const act = ent.querySelector(".eact"); if (!act) return;
    let h = "";
    if (owner(st)) h = `<button class="btn s p" data-clm="edit" data-id="${aid}">✏️ تعديل صفحتي</button><button class="btn s" data-clm="draft" data-id="${aid}">📤 رفع كتاب (مسودة)</button><a class="btn s" href="#/posts?k=posts">✍️ منشور جديد</a><button class="btn s" data-clm="mydrafts" data-id="${aid}">مسوداتي</button>`;
    else if (st.mine && st.mine.status === "pending") h = `<em class="tag">🪪 طلبك ربط هذه الصفحة بحسابك قيد المراجعة</em> <button class="lnk" data-clm="withdraw" data-id="${aid}" data-c="${st.mine.id}">سحب الطلب</button>`;
    else if (!st.ok.length || !Auth.user) h = `<button class="btn s" data-clm="claim" data-id="${aid}">🪪 هذه صفحتي</button>${st.mine && st.mine.status === "rejected" ? ` <span class="mut">رُدّ طلبك السابق${st.mine.note ? ": " + esc(st.mine.note) : ""}</span>` : ""}`;
    if (h) act.insertAdjacentHTML("beforeend", `<span class="clmbar">${h}</span>`);
  }
  function claimForm(aid) {
    if (!Auth.user) return typeof needLogin === "function" ? needLogin("ربط صفحة المؤلف بحسابك يحتاج حسابًا في المكتبة.") : null;
    if (!on()) return toast("يحتاج قاعدة الحسابات");
    const a = A(aid);
    openSheet("هذه صفحتي", `<form id="clmf" data-form="noop"><p>تطلب ربط حسابك بصفحة <b>${esc(a.name)}</b>، فتغيّر صورتها ونبذتها، وتنشر منشوراتك باسمها، وترفع كتبك مسودةً تعتمدها الإدارة.</p>
      <p class="mut">تتحقق الإدارة من هويتك قبل القبول، ولا يُمنح الربط بمجرد تطابق الاسم. للإدارة أن ترفض الطلب أو تسحب الربط في أي وقت.</p>
      <label>ما يثبت أنك صاحب الصفحة (إلزامي)</label><textarea name="ev" required minlength="10" maxlength="2000" rows="4" placeholder="مثال: رابط صفحتي الرسمية أو قناتي، أو من يعرفني من المشايخ، أو جهة عملي…"></textarea>
      <label>وسيلة تواصل للتحقق (اختياري)</label><input name="ct" maxlength="200" placeholder="هاتف أو بريد أو رابط حساب موثق">
      <div class="savebar"><button class="btn p">إرسال الطلب</button> <span id="clmst" class="mut" role="status"></span></div></form>`);
    $("#clmf").onsubmit = async e => { e.preventDefault(); const f = e.target, st = $("#clmst"); st.textContent = "جارٍ الإرسال…";
      const { error } = await sb().from("author_claims").insert({ user_id: Auth.user.id, author_id: aid, evidence: f.ev.value.trim(), contact: f.ct.value.trim() || null });
      if (error) { st.textContent = /duplicate|unique/i.test(error.message) ? "لك طلب قائم لهذه الصفحة." : error.message; return; }
      closeSheet(); toast("أُرسل طلبك إلى الإدارة، ويصلك القرار في جرس الإشعارات"); C.delete(aid); repaint(aid); };
  }
  // الصورة تُصغَّر على الجهاز (مربعة ٣٢٠ بكسل، JPEG) قبل الحفظ
  const shrink = file => new Promise((res, rej) => { const im = new Image(); im.onload = () => { const n = 320, c = document.createElement("canvas"); c.width = c.height = n; const s = Math.min(im.width, im.height), x = c.getContext("2d");
    x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, n, n); res(c.toDataURL("image/jpeg", .85)); URL.revokeObjectURL(im.src); }; im.onerror = () => rej(new Error("صورة غير صالحة")); im.src = URL.createObjectURL(file); });
  async function editForm(aid) {
    const st = await state(aid, true); if (!owner(st) && !(typeof Cloud !== "undefined" && Cloud.staff())) return toast("لصاحب الصفحة المعتمد وحده");
    const a = A(aid), bio = (st.page && st.page.bio) || a.bio || "";
    openSheet("تعديل صفحتي", `<form id="clme" data-form="noop"><label>الصورة (تُقص مربعة وتُصغَّر)</label><input type="file" name="ph" accept="image/jpeg,image/png,image/webp">
      <div class="row">${st.page && st.page.photo ? `<img src="${st.page.photo}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover"> <label class="inl"><input type="checkbox" name="rmph"> إزالة الصورة</label>` : ""}</div>
      <label>النبذة (تظهر أعلى صفحتك)</label><textarea name="bio" maxlength="1500" rows="6">${esc(bio)}</textarea>
      <div class="savebar"><button class="btn p">حفظ</button> <span id="clmest" class="mut" role="status"></span></div></form>`);
    $("#clme").onsubmit = async e => { e.preventDefault(); const f = e.target, s = $("#clmest"); s.textContent = "جارٍ الحفظ…";
      try { const row = { author_id: aid, bio: f.bio.value.trim() || null, updated_by: Auth.user.id, updated_at: new Date().toISOString() };
        if (f.ph.files[0]) { if (f.ph.files[0].size > 8 * 1048576) throw new Error("الصورة أكبر من ٨ م.ب"); row.photo = await shrink(f.ph.files[0]); }
        else if (f.rmph && f.rmph.checked) row.photo = null; else if (st.page) row.photo = st.page.photo || null;
        const { error } = await sb().from("author_pages").upsert(row); if (error) throw new Error(error.message);
        closeSheet(); toast("حُفظت صفحتك"); C.delete(aid); route(); } catch (x) { s.textContent = x.message; } };
  }
  function draftForm(aid) {
    openSheet("رفع كتاب (مسودة)", `<form id="clmd" data-form="noop"><p class="mut">يبقى ما ترفعه مسودة لا يظهر لأحد حتى تراجعه الإدارة وتعتمده، ثم تضيفه إلى صفحتك.</p>
      <label>العنوان</label><input name="t" required minlength="2" maxlength="200"><label>النوع</label><select name="k"><option value="book">كتاب</option><option value="article">مقال</option><option value="tafrigh">تفريغ درس</option></select>
      <label>الملف (PDF أو Word أو نص أو EPUB، حتى ٥٠ م.ب)</label><input type="file" name="f" required accept=".pdf,.doc,.docx,.txt,.epub,application/pdf">
      <label>ملاحظة للإدارة (اختياري)</label><textarea name="n" maxlength="1000" rows="3" placeholder="الطبعة، الناشر، حقوق النشر…"></textarea>
      <div class="savebar"><button class="btn p">رفع</button> <span id="clmdst" class="mut" role="status"></span></div></form>`);
    $("#clmd").onsubmit = async e => { e.preventDefault(); const f = e.target, s = $("#clmdst"), file = f.f.files[0]; if (!file) return;
      if (file.size > 50 * 1048576) return s.textContent = "الملف أكبر من ٥٠ م.ب";
      s.textContent = "جارٍ الرفع…"; const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i) || [, "pdf"])[1].toLowerCase(), path = aid + "/" + Date.now().toString(36) + "." + ext;
      const up = await sb().storage.from("author-drafts").upload(path, file, { contentType: file.type || "application/octet-stream" }); if (up.error) return s.textContent = up.error.message;
      const { error } = await sb().from("author_drafts").insert({ author_id: aid, user_id: Auth.user.id, title: f.t.value.trim(), kind: f.k.value, note: f.n.value.trim() || null, file: path });
      if (error) return s.textContent = error.message; closeSheet(); toast("رُفع، وهو الآن مسودة بانتظار الإدارة"); };
  }
  async function myDrafts(aid) {
    const { data } = await sb().from("author_drafts").select("title,kind,status,admin_note,created_at").eq("author_id", aid).eq("user_id", Auth.user.id).order("created_at", { ascending: false });
    const ST = { pending: "بانتظار الإدارة", approved: "✓ اعتُمد", rejected: "رُدّ" };
    openSheet("مسوداتي", (data || []).length ? data.map(d => `<div class="bk"><b>${esc(d.title)}</b><span>${ST[d.status] || d.status} • ${esc((d.created_at || "").slice(0, 10))}${d.admin_note ? " • " + esc(d.admin_note) : ""}</span></div>`).join("") : '<p class="mut">لا مسودات بعد.</p>');
  }
  function repaint(aid) { const e = document.querySelector(".ent"); if (e) { delete e.dataset.clm; e.querySelectorAll(".clmbar,.ebadge.ver").forEach(x => x.remove()); } paint(aid); }

  /* ===== الإدارة ===== */
  async function admin(el) {
    if (!el) return; if (!on()) { el.textContent = "يحتاج قاعدة الحسابات."; return; }
    el.innerHTML = '<p class="mut">جارٍ التحميل…</p>';
    const [cl, dr] = await Promise.all([sb().from("author_claims").select("*").in("status", ["pending", "approved"]).order("created_at", { ascending: false }).limit(200),
      sb().from("author_drafts").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(100)]);
    if (cl.error) { el.innerHTML = `<p class="note">${esc(cl.error.message)} — طبّق ترحيل supabase/migrations/2026-11-27-author-claims.sql أولًا.</p>`; return; }
    const ids = [...new Set((cl.data || []).map(x => x.user_id).concat((dr.data || []).map(x => x.user_id)))];
    const nm = {}; if (ids.length) { const { data } = await sb().from("member_pages").select("user_id,name").in("user_id", ids); (data || []).forEach(p => nm[p.user_id] = p.name); }
    const same = (u, a) => nm[u] && typeof RELB !== "undefined" && RELB.norm(nm[u]).includes(RELB.norm(A(a).name).replace(/^(الشيخ|الدكتور) /, ""));
    const P = (cl.data || []).filter(x => x.status === "pending"), OK = (cl.data || []).filter(x => x.status === "approved");
    const row = x => `<div class="card clmrow" data-c="${x.id}"><b><a href="#/member/${x.user_id}">${esc(nm[x.user_id] || "عضو")}</a> ← <a href="#/author/${esc(x.author_id)}">${esc(A(x.author_id).name)}</a></b>
      ${same(x.user_id, x.author_id) ? '<em class="tag">الاسم مطابق — لا يكفي وحده</em>' : ""}<p>${esc(x.evidence)}</p>${x.contact ? `<p class="mut">التواصل: ${esc(x.contact)}</p>` : ""}<p class="mut">${esc((x.created_at || "").slice(0, 16).replace("T", " "))}</p>
      <div class="row">${x.status === "pending" ? '<button class="btn s p" data-clmA="approved">قبول بعد التحقق</button><button class="btn s" data-clmA="rejected">رفض</button>' : '<button class="btn s" data-clmA="revoked">سحب الربط</button>'}</div></div>`;
    el.innerHTML = `<p class="mut">طلبات الأعضاء ربط حساباتهم بصفحات المؤلفين. تحقق من الهوية بالدليل ووسيلة التواصل؛ تطابق الاسم وحده لا يكفي. القبول يمنح العضو على صفحته وحدها: الصورة والنبذة، والنشر باسمها، ورفع الكتب مسودة.</p>
      <h3>بانتظار المراجعة (${toAr(P.length)})</h3>${P.map(row).join("") || '<p class="mut">لا طلبات.</p>'}
      <h3>الروابط المعتمدة (${toAr(OK.length)})</h3>${OK.map(row).join("") || '<p class="mut">لا روابط بعد.</p>'}
      <h3>مسودات الكتب المرفوعة (${toAr((dr.data || []).length)})</h3>${(dr.data || []).map(d => `<div class="card" data-d="${d.id}"><b>${esc(d.title)}</b> <span class="mut">${esc(A(d.author_id).name)} • ${esc(nm[d.user_id] || "")} • ${esc((d.created_at || "").slice(0, 10))}</span>${d.note ? `<p>${esc(d.note)}</p>` : ""}
        <div class="row"><button class="btn s" data-clmF="${esc(d.file || "")}">⬇ الملف</button><button class="btn s p" data-clmD="approved">اعتماد</button><button class="btn s" data-clmD="rejected">رد</button><a class="btn s" href="#/admin?t=book">إضافته كتابًا</a></div></div>`).join("") || '<p class="mut">لا مسودات.</p>'}<span id="clmadst" class="mut" role="status"></span>`;
    el.onclick = async e => { const b = e.target.closest("[data-clmA],[data-clmD],[data-clmF]"); if (!b) return; const s = $("#clmadst");
      try {
        if (b.dataset.clmf != null || b.hasAttribute("data-clmF")) { const { data, error } = await sb().storage.from("author-drafts").createSignedUrl(b.getAttribute("data-clmF"), 600); if (error) throw error; open(data.signedUrl, "_blank"); return; }
        const note = b.getAttribute("data-clmA") === "approved" || b.getAttribute("data-clmD") === "approved" ? null : prompt("ملاحظة للعضو (اختياري)") || null;
        if (b.hasAttribute("data-clmA")) { const v = b.getAttribute("data-clmA"); if (v === "revoked" && !confirm("سحب ربط هذا الحساب بالصفحة؟")) return;
          const { error } = await sb().from("author_claims").update({ status: v, note }).eq("id", b.closest("[data-c]").dataset.c); if (error) throw error; }
        else { const { error } = await sb().from("author_drafts").update({ status: b.getAttribute("data-clmD"), admin_note: note, reviewed_at: new Date().toISOString() }).eq("id", b.closest("[data-d]").dataset.d); if (error) throw error; }
        C.clear(); admin(el);
      } catch (x) { s.textContent = x.message || String(x); } };
  }

  /* ===== التوصيل ===== */
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => { const p = (typeof parse === "function" ? parse().p : []) || []; if (p[0] === "author" && p[1]) paint(p[1]); }, 300); };
  window.addEventListener("hashchange", later); const mo = () => { const m = document.querySelector("main"); if (m) new MutationObserver(later).observe(m, { childList: true }); else setTimeout(mo, 500); }; mo(); later();
  document.addEventListener("click", e => { const b = e.target.closest("[data-clm]"); if (!b) return; e.preventDefault(); const a = b.dataset.clm, id = b.dataset.id;
    if (a === "claim") claimForm(id); else if (a === "edit") editForm(id); else if (a === "draft") draftForm(id); else if (a === "mydrafts") myDrafts(id);
    else if (a === "withdraw") { if (!confirm("سحب طلبك؟")) return; sb().from("author_claims").delete().eq("id", b.dataset.c).then(({ error }) => { if (error) return toast(error.message); C.delete(id); repaint(id); }); } });
  return { admin, state, paint };
})();
