/* القراءة الجماعية (#/groups، #/group/<id>) وتحدي القراءة (#/challenges، #/challenge/<id>) وصلاحيات التفويض (#/perms، للمدير).
   البيانات في Supabase (group_reads/group_members/group_log، challenges/challenge_entries/challenge_pages، profiles.perms)
   والكتابة كلها عبر دوال الخادم (gr_*، ch_*) التي تتحقق من الصلاحية وترسل الإشعارات.
   تحدي القراءة: وقت فتح الصفحة يُسجَّل على الخادم (ch_seen)، ولا تُقبل ✓ (ch_mark) إلا بعد البقاء عليها min_dwell ثانية. */
const GRP = (() => {
  const sb = () => Auth.sb, need = () => { if (!Auth.user || !sb()) { view(`<div class="note">سجّل الدخول لتشارك. <a href="#/account">الدخول</a></div>`); return true; } return false; };
  const rpc = async (f, a) => { const { data, error } = await sb().rpc(f, a || {}); if (error) throw new Error(error.message); return data; };
  const T = b => b ? (b.setTitle || b.title) : "", D = s => s ? new Date(s).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }) : "";
  const dayOf = g => Math.floor((Date.now() - new Date(g.start_date + "T00:00:00").getTime()) / 864e5) + 1;
  const range = (g, k) => { const n = g.end_page - g.start_page + 1, per = Math.ceil(n / g.days), a = g.start_page + (k - 1) * per; return [Math.min(a, g.end_page), Math.min(a + per - 1, g.end_page)]; };
  const err = e => toast(e.message || String(e));
  const bookOpts = sel => BOOKS().filter(b => !b.demo && !b.hidden && !VOL2(b)).sort((x, y) => T(x).localeCompare(T(y), "ar")).map(b => `<option value="${b.id}"${b.id === sel ? " selected" : ""}>${esc(T(b))} — ${esc(A(b.authorId).name)}</option>`).join("");

  // ———— القراءة الجماعية ————
  async function list(q) {
    view(`<div class="cmhero"><div><h2>القراءة الجماعية</h2><p>اقرؤوا كتابًا واحدًا معًا في مدة محددة: وِرد يومي، وتسجيل حضور، وخط إنجاز مشترك.</p></div></div>
    <div class="row" style="margin:10px 0"><button class="btn p" data-act="grnew">＋ ابدأ قراءة جماعية</button><button class="btn" data-act="grnew" data-req="1">اطلب من الإدارة إعلان قراءة</button></div><div id="grl" class="mut">جارٍ التحميل…</div>`);
    if (!sb()) { $("#grl").textContent = "يتطلب الاتصال بحسابات المكتبة."; return; }
    const { data, error } = await sb().from("group_reads").select("*").in("status", isAdmin() ? ["active", "requested", "done"] : ["active", "done"]).order("official", { ascending: false }).order("start_date", { ascending: false }).limit(100);
    if (error) { $("#grl").textContent = "تعذّر الاتصال بالخادم الآن؛ أعد المحاولة بعد قليل."; return; }
    const card = g => { const b = B(g.book_id), d = dayOf(g); return `<a class="bk hasc" href="#/group/${g.id}">${b ? coverOf(b) : ""}<b>${esc(g.title)} ${g.official ? '<em class="tag">من الإدارة</em>' : ""}${g.status === "requested" ? '<em class="tag">طلب ينتظر الاعتماد</em>' : ""}${g.status === "done" ? '<em class="tag">انتهت</em>' : ""}</b><span>${esc(T(b))} • ${d < 1 ? "تبدأ " + D(g.start_date) : d > g.days ? "انتهت مدتها" : "اليوم " + toAr(d) + " من " + toAr(g.days)} • الموعد ${esc(g.read_time || "")}${g.visibility === "invite" ? " • بالدعوة" : ""}</span></a>`; };
    const l = data || [];
    $("#grl").innerHTML = l.length ? l.map(card).join("") : "<p>لا قراءات جماعية بعد. ابدأ أول قراءة وادعُ إخوانك.</p>";
  }
  async function form(req) {
    if (!Auth.user) { location.hash = "#/account"; return; }
    const c = (typeof cur === "function" && cur()) || null, b0 = c ? c.b : null;
    openSheet(req ? "طلب قراءة جماعية من الإدارة" : "قراءة جماعية جديدة", `<form id="grf" data-form="noop" class="grform">
      <label>الكتاب</label><select name="b">${bookOpts(b0 && b0.id)}</select>
      <label>عنوان القراءة</label><input name="t" required maxlength="120" value="${b0 ? esc("قراءة جماعية: " + T(b0)) : ""}">
      <div class="row"><div><label>تبدأ</label><input type="date" name="s" value="${today()}"></div><div><label>عدد الأيام</label><input type="number" name="d" min="1" max="365" value="14"></div><div><label>الموعد</label><input type="time" name="tm" value="21:00"></div></div>
      <div class="row"><div><label>من صفحة</label><input type="number" name="f" min="1" value="1"></div><div><label>إلى صفحة</label><input type="number" name="to" min="1" placeholder="آخر الكتاب"></div></div>
      ${req ? "" : `<label>المشاركة</label><select name="v"><option value="public">عامة: يراها الأعضاء وينضمون</option><option value="invite">بالدعوة فقط</option></select>
      <label>ادعُ أعضاء (اكتب جزءًا من الاسم)</label><input id="grinv" autocomplete="off" placeholder="ابحث عن عضو"><div id="grsug" class="chips"></div><div id="grsel" class="chips"></div>`}
      <label>ملاحظة</label><textarea name="n" rows="2" maxlength="600" placeholder="منهج القراءة، أو مجلس المدارسة…"></textarea>
      <button class="btn p" style="margin-top:10px">${req ? "أرسل الطلب" : "ابدأ"}</button> <span class="mut" id="grst"></span></form>`, () => {
      const f = $("#grf"), sel = new Map(), inp = $("#grinv");
      f.b.onchange = () => { const b = B(f.b.value); if (b) f.t.value = "قراءة جماعية: " + T(b); };
      if (inp) { let tm; inp.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { const q = inp.value.trim(); if (q.length < 2) { $("#grsug").innerHTML = ""; return; } try { const l = await rpc("member_search", { q }); $("#grsug").innerHTML = l.filter(x => x.id !== Auth.user.id).map(x => `<button type="button" class="chip" data-u="${x.id}" data-n="${esc(x.name || "")}">＋ ${esc(x.name || "")}</button>`).join("") || '<span class="mut">لا نتائج</span>'; } catch (e) { } }, 300); };
        $("#grsug").onclick = e => { const x = e.target.closest("[data-u]"); if (!x) return; sel.set(x.dataset.u, x.dataset.n); $("#grsel").innerHTML = [...sel].map(([u, n]) => `<button type="button" class="chip on" data-x="${u}">${esc(n)} ✕</button>`).join(""); };
        $("#grsel").onclick = e => { const x = e.target.closest("[data-x]"); if (!x) return; sel.delete(x.dataset.x); x.remove(); }; }
      f.addEventListener("submit", async e => { e.preventDefault(); const b = B(f.b.value); if (!b) return; const st = $("#grst"); st.textContent = "جارٍ…";
        try { const id = await rpc("gr_create", { p_book: b.id, p_title: f.t.value.trim(), p_note: f.n.value.trim() || null, p_start: f.s.value || today(), p_days: +f.d.value || 14, p_from: +f.f.value || 1, p_to: +f.to.value || b.n || 1, p_time: f.tm.value, p_vis: f.v ? f.v.value : "public", p_invite: [...sel.keys()], p_official: !!req || isAdmin() });
          closeSheet(); toast(req ? "أُرسل الطلب إلى الإدارة" : "بدأت القراءة الجماعية"); location.hash = "#/group/" + id; } catch (e2) { st.textContent = e2.message; } });
    });
  }
  async function one(id) {
    if (need()) return;
    const { data: g, error } = await sb().from("group_reads").select("*").eq("id", id).maybeSingle();
    if (error || !g) { view(`<div class="note">القراءة غير موجودة أو ليست متاحة لك.</div>`); return; }
    const b = B(g.book_id), board = await rpc("gr_board", { g: +id }).catch(() => []), me = (board || []).find(x => x.user_id === Auth.user.id);
    const { data: myl } = await sb().from("group_log").select("day_no,pages,note").eq("group_id", id).eq("user_id", Auth.user.id);
    const done = new Map((myl || []).map(x => [x.day_no, x])), d = dayOf(g), joined = me && me.status === "joined", owner = g.owner === Auth.user.id, adm = isAdmin();
    const members = (board || []).filter(x => x.status === "joined"), allDays = members.length * g.days, tot = members.reduce((s, x) => s + +x.days_done, 0);
    const days = Array.from({ length: g.days }, (_, i) => i + 1);
    view(`<div class="cmhero"><div><h2>${esc(g.title)}</h2><p>${esc(T(b))} — ${esc(A(b && b.authorId).name || "")}</p></div></div>
    <p>${g.official ? '<em class="tag">من الإدارة</em> ' : ""}من ${D(g.start_date)} لمدة ${toAr(g.days)} يومًا • الصفحات ${toAr(g.start_page)}–${toAr(g.end_page)} • الورد نحو ${toAr(Math.ceil((g.end_page - g.start_page + 1) / g.days))} صفحة يوميًا • الموعد ${esc(g.read_time || "")}</p>${g.note ? `<p class="note">${esc(g.note)}</p>` : ""}
    <div class="row">${joined ? `<a class="btn p" href="#/book/${g.book_id}/${range(g, Math.min(Math.max(d, 1), g.days))[0]}">اقرأ ورد اليوم</a><button class="btn" data-act="grleave" data-g="${g.id}">مغادرة</button>` : g.status === "active" ? `<button class="btn p" data-act="grjoin" data-g="${g.id}">انضم إلى القراءة</button>` : ""}
    ${(owner || adm) ? `<button class="btn" data-act="grinvite" data-g="${g.id}">دعوة أعضاء</button>${g.status !== "done" ? `<button class="btn" data-act="grst" data-g="${g.id}" data-s="done">إنهاء</button>` : ""}` : ""}
    ${adm && g.status === "requested" ? `<button class="btn p" data-act="grst" data-g="${g.id}" data-s="active" data-o="1">اعتماد وإعلان من الإدارة</button>` : ""}<button class="btn" data-act="grshare" data-g="${g.id}">مشاركة</button></div>
    <h3>خط الإنجاز المشترك</h3><div class="grbar"><i style="width:${allDays ? Math.round(tot * 100 / allDays) : 0}%"></i></div><p class="mut">${toAr(tot)} وِردًا مسجَّلًا من ${toAr(allDays)} • ${toAr(members.length)} مشاركًا</p>
    <h3>الخط الزمني</h3><div class="grdays">${days.map(k => { const [a, z] = range(g, k), dn = done.get(k), past = k < d, now = k === d;
      return `<div class="grday${dn ? " ok" : past ? " late" : now ? " now" : ""}"><b>${toAr(k)}</b><span>ص ${toAr(a)}–${toAr(z)}</span>${joined && k <= d + 1 ? `<button class="btn s${dn ? "" : " p"}" data-act="grlog" data-g="${g.id}" data-k="${k}" data-p="${z - a + 1}">${dn ? "✓ قرأته" : "سجّل"}</button>` : ""}</div>`; }).join("")}</div>
    <p class="mut">يمكنك تسجيل وِرد يوم فاتك متى قرأته؛ والضغط على «✓ قرأته» يلغي التسجيل.</p>
    <h3>المشاركون</h3><div class="sttab"><table><thead><tr><th>العضو</th><th>الأوراد</th><th>الإنجاز</th><th>آخر تسجيل</th></tr></thead><tbody>${(board || []).map(x => `<tr${x.user_id === Auth.user.id ? ' class="me"' : ""}><td>${esc(x.name || "—")}${x.status === "invited" ? ' <em class="tag">مدعو</em>' : x.status === "left" ? ' <em class="tag">غادر</em>' : ""}</td><td>${toAr(x.days_done)} / ${toAr(g.days)}</td><td><div class="grbar sm"><i style="width:${Math.round(x.days_done * 100 / g.days)}%"></i></div></td><td>${x.last_at ? esc(D(x.last_at)) : ""}</td></tr>`).join("")}</tbody></table></div>`);
  }
  async function act(a, el) {
    const g = +el.dataset.g;
    try {
      if (a === "grnew") return form(!!el.dataset.req);
      if (a === "grjoin") { await rpc("gr_join", { g }); toast("انضممت، وفقك الله"); }
      else if (a === "grleave") { if (!confirm("مغادرة القراءة الجماعية؟")) return; await rpc("gr_join", { g, p_leave: true }); }
      else if (a === "grlog") { const on = el.textContent.includes("✓"); await rpc("gr_log", { g, p_day: +el.dataset.k, p_pages: on ? -1 : +el.dataset.p }); }
      else if (a === "grst") { await rpc("gr_status", { g, p_status: el.dataset.s, p_official: el.dataset.o ? true : null }); }
      else if (a === "grshare") { const u = location.origin + "/#/group/" + g; navigator.share ? navigator.share({ url: u, title: document.title }).catch(() => { }) : navigator.clipboard.writeText(u).then(() => toast("نُسخ الرابط")); return; }
      else if (a === "grinvite") {
        openSheet("دعوة أعضاء", `<input id="giq" placeholder="اكتب جزءًا من الاسم" autocomplete="off"><div id="gis" class="chips" style="margin-top:8px"></div>`, () => { let tm; $("#giq").oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { const q = $("#giq").value.trim(); if (q.length < 2) return; const l = await rpc("member_search", { q }).catch(() => []); $("#gis").innerHTML = l.map(x => `<button class="chip" data-u="${x.id}">＋ ${esc(x.name || "")}</button>`).join(""); }, 300); };
          $("#gis").onclick = async e => { const x = e.target.closest("[data-u]"); if (!x) return; try { const n = await rpc("gr_invite", { g, uids: [x.dataset.u] }); x.textContent = n ? "✓ دُعي" : "مدعو من قبل"; x.disabled = true; } catch (e2) { err(e2); } }; }); return;
      }
      one(g);
    } catch (e) { err(e); }
  }

  // ———— تحدي القراءة ————
  let MY = null; // تحدياتي النشطة {id, books, req, min_dwell, ends_at}
  async function mine() { if (MY) return MY; MY = []; if (!Auth.user || !sb()) return MY;
    const { data } = await sb().from("challenge_entries").select("challenge_id,finished_at,challenges(id,title,books,req,min_dwell,starts_at,ends_at,status)").eq("user_id", Auth.user.id);
    MY = (data || []).map(x => Object.assign({}, x.challenges, { finished_at: x.finished_at })).filter(c => c && c.status === "open" && new Date(c.ends_at) > new Date()); return MY; }
  // في القارئ: إن كانت الصفحة من صفحات تحدٍّ مشترك فيه، يُسجَّل فتحها ويظهر زر ✓
  async function onPage(b, k) {
    const bar = $("#chbar"); if (bar) bar.remove(); if (!b || !Auth.user) return;
    const l = (await mine()).filter(c => (c.req[b.id] || []).includes(k) && new Date(c.starts_at) <= new Date()); if (!l.length) return;
    const c = l[0]; rpc("ch_seen", { c: c.id, bid: b.id, pg: k }).catch(() => { });
    const el = document.createElement("div"); el.id = "chbar"; el.innerHTML = `<span>🏁 ${esc(c.title)}</span><button class="btn s p" data-act="chmark" data-c="${c.id}" data-b="${b.id}" data-k="${k}">✓ قرأت هذه الصفحة</button>`; document.body.appendChild(el);
  }
  async function mark(el) {
    try { const r = await rpc("ch_mark", { c: +el.dataset.c, bid: el.dataset.b, pg: +el.dataset.k });
      if (!r.ok) return toast(r.why + (r.wait ? ` (بقي ${toAr(r.wait)} ثانية)` : ""));
      el.textContent = `✓ ${toAr(r.got)} من ${toAr(r.need)}`; el.disabled = true; if (r.done) { toast("🎉 أتممت التحدي، بارك الله فيك"); MY = null; }
    } catch (e) { err(e); }
  }
  // الصفحات المطلوبة: تُستثنى صفحات الفهرس (أسطر «عنوان ..... رقم») والصفحات شبه الفارغة
  function reqPages(b) { const TL = /[.…·_\-ـ]{3,}\s*\(?[\d٠-٩]{1,4}\)?\s*$/m; const out = [];
    (b.pages || []).forEach((p, i) => { const t = plain(p || ""), lines = t.split("\n").filter(x => x.trim()), toc = lines.filter(x => TL.test(x)).length;
      if (strip(t).replace(/\s/g, "").length < 40) return; if (lines.length > 4 && toc / lines.length > 0.4) return; out.push(i + 1); }); return out; }
  async function chList() {
    view(`<div class="cmhero"><div><h2>تحدي القراءة</h2><p>تنافس على إتمام كتاب في مدة محددة: افتح كل صفحة واقرأها ثم علّمها ✓، والأسبق إلى الإتمام أولًا.</p></div></div>${isAdmin() ? '<button class="btn p" data-act="chnew">＋ تحدٍّ جديد</button>' : ""}<div id="chl" class="mut">جارٍ التحميل…</div>`);
    if (!sb()) return;
    const { data, error } = await sb().from("challenges").select("*").order("starts_at", { ascending: false }).limit(50);
    if (error) { $("#chl").textContent = "تعذّر الاتصال بالخادم الآن؛ أعد المحاولة بعد قليل."; return; }
    const now = new Date();
    $("#chl").innerHTML = (data || []).map(c => { const s = new Date(c.starts_at), e = new Date(c.ends_at), n = Object.values(c.req || {}).reduce((x, y) => x + y.length, 0);
      return `<a class="bk" href="#/challenge/${c.id}"><b>🏁 ${esc(c.title)} ${c.status === "draft" ? '<em class="tag">مسودة</em>' : now < s ? '<em class="tag">قريبًا</em>' : now > e || c.status === "closed" ? '<em class="tag">انتهى</em>' : '<em class="tag on">جارٍ الآن</em>'}</b><span>${c.books.map(id => esc(T(B(id)))).join("، ")} • ${toAr(n)} صفحة • ${D(c.starts_at)} – ${D(c.ends_at)}</span></a>`; }).join("") || "<p>لا تحديات معلنة بعد.</p>";
  }
  async function chOne(id) {
    if (need()) return;
    const { data: c } = await sb().from("challenges").select("*").eq("id", id).maybeSingle(); if (!c) { view('<div class="note">التحدي غير موجود.</div>'); return; }
    const [board, ent] = await Promise.all([rpc("ch_board", { c: +id }).catch(() => []), sb().from("challenge_entries").select("finished_at").eq("challenge_id", id).eq("user_id", Auth.user.id).maybeSingle()]);
    const { data: pg } = await sb().from("challenge_pages").select("book_id,page,checked_at").eq("challenge_id", id).eq("user_id", Auth.user.id);
    const got = new Set((pg || []).filter(x => x.checked_at).map(x => x.book_id + ":" + x.page)), now = new Date(), live = now >= new Date(c.starts_at) && now <= new Date(c.ends_at) && c.status === "open", joined = !!(ent && ent.data);
    const need_ = Object.values(c.req || {}).reduce((x, y) => x + y.length, 0);
    view(`<div class="cmhero"><div><h2>🏁 ${esc(c.title)}</h2><p>${esc(c.descr || "")}</p></div></div>
    <p>من ${new Date(c.starts_at).toLocaleString("ar-EG")} إلى ${new Date(c.ends_at).toLocaleString("ar-EG")} • ${toAr(need_)} صفحة مطلوبة • لا تُقبل علامة ✓ إلا بعد ${toAr(c.min_dwell)} ثانية من فتح الصفحة.</p>
    ${joined ? `<p><b>إنجازك:</b> ${toAr(got.size)} من ${toAr(need_)}${ent.data.finished_at ? " • 🎉 أتممت" : ""}</p><div class="grbar"><i style="width:${Math.round(got.size * 100 / Math.max(1, need_))}%"></i></div>` : c.status === "open" && now < new Date(c.ends_at) ? `<button class="btn p" data-act="chjoin" data-c="${c.id}">اشترك في التحدي</button>` : ""}
    ${c.books.map(bid => { const b = B(bid), r = c.req[bid] || [], first = r.find(p => !got.has(bid + ":" + p)) || r[0] || 1;
      return `<div class="bk hasc">${b ? coverOf(b) : ""}<b>${esc(T(b))}</b><span>${toAr(r.filter(p => got.has(bid + ":" + p)).length)} من ${toAr(r.length)} صفحة ${joined && live ? `• <a href="#/book/${bid}/${first}">${got.size ? "تابع من الصفحة " + toAr(first) : "ابدأ القراءة"}</a>` : ""}</span></div>`; }).join("")}
    ${isAdmin() ? `<div class="row" style="margin:8px 0">${c.status !== "closed" ? `<button class="btn s" data-act="chclose" data-c="${c.id}">إغلاق التحدي</button>` : ""}</div>` : ""}
    <h3>لوحة المتسابقين</h3><div class="sttab"><table><thead><tr><th>#</th><th>المتسابق</th><th>الصفحات</th><th>الإتمام</th></tr></thead><tbody>${(board || []).map((x, i) => `<tr${x.user_id === Auth.user.id ? ' class="me"' : ""}><td>${x.finished_at ? ["🥇", "🥈", "🥉"][i] || toAr(i + 1) : ""}</td><td>${esc(x.name || "—")}</td><td>${toAr(x.checked)} / ${toAr(need_)}</td><td>${x.finished_at ? esc(new Date(x.finished_at).toLocaleString("ar-EG")) : ""}</td></tr>`).join("") || '<tr><td colspan="4" class="mut">لا متسابقين بعد</td></tr>'}</tbody></table></div>`);
  }
  async function chNew() {
    const now = new Date(), wk = new Date(Date.now() + 7 * 864e5), iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    openSheet("تحدٍّ جديد", `<form id="chf" data-form="noop"><label>العنوان</label><input name="t" required maxlength="120"><label>الوصف والجوائز</label><textarea name="d" rows="2"></textarea>
     <label>الكتب (اختر واحدًا أو أكثر)</label><select name="b" multiple size="6">${bookOpts()}</select>
     <div class="row"><div><label>البداية</label><input type="datetime-local" name="s" value="${iso(now)}"></div><div><label>النهاية</label><input type="datetime-local" name="e" value="${iso(wk)}"></div><div><label>أقل مدة على الصفحة (ثانية)</label><input type="number" name="m" min="3" max="600" value="20"></div></div>
     <p class="mut">تُستثنى صفحات الفهرس والصفحات شبه الفارغة آليًا.</p><button class="btn p">أنشئ التحدي</button> <span id="chst" class="mut"></span></form>`, () => {
      $("#chf").addEventListener("submit", async e => { e.preventDefault(); const f = e.target, ids = [...f.b.selectedOptions].map(o => o.value), st = $("#chst"); if (!ids.length) return st.textContent = "اختر كتابًا";
        st.textContent = "جارٍ حساب صفحات الكتب…"; const bs = ids.map(B); await loadMany(bs); const req = {}; bs.forEach(b => req[b.id] = reqPages(b));
        const { data, error } = await sb().from("challenges").insert({ title: f.t.value.trim(), descr: f.d.value.trim() || null, books: ids, req, starts_at: new Date(f.s.value).toISOString(), ends_at: new Date(f.e.value).toISOString(), min_dwell: +f.m.value || 20 }).select("id").single();
        if (error) return st.textContent = error.message; closeSheet(); location.hash = "#/challenge/" + data.id; });
    });
  }

  // ———— صلاحيات التفويض (للمدير) ————
  const PERMS = [["upload", "رفع الكتب والتفريغات والمقالات والكتب المصورة"], ["edit", "تعديل نصوص الكتب وتصحيحها (المراجعة والتدقيق)"], ["export_text", "تنزيل الكتب نصًا قابلًا للتحرير (Word/نص/Markdown كاملة)"], ["kurrasa", "إعداد الكراسات"], ["convert", "تحويل الكتب والمقالات ومراجعتها"], ["tashjir", "التشجير والخرائط الذهنية"], ["stats", "الاطلاع على سجل قراءة الأعضاء"]];
  async function perms() {
    if (!(Cloud.role === "admin" || GH.token)) { view('<div class="note">هذه الصفحة للمدير. سجّل الدخول بحساب المدير.</div>'); return; }
    view(`<h2>صلاحيات التفويض</h2><p class="mut">امنح عضوًا بعينه صلاحية خدمة محددة دون أن يصير مشرفًا. المدير يملكها كلها.</p><input id="pmq" placeholder="ابحث عن عضو بالاسم" autocomplete="off"><div id="pml" style="margin-top:10px"></div>`);
    const show = async ids => { const { data } = await sb().from("profiles").select("id,name,role,perms").in("id", ids); $("#pml").innerHTML = (data || []).map(p => `<div class="stsec" style="margin:8px 0"><b>${esc(p.name || "—")}</b> <em class="tag">${esc(p.role)}</em><div>${PERMS.map(([k, n]) => `<label class="inl"><input type="checkbox" data-pm="${p.id}" value="${k}"${(p.perms || []).includes(k) ? " checked" : ""}> ${esc(n)}</label>`).join("<br>")}</div></div>`).join("") || '<p class="mut">لا نتائج</p>'; };
    const { data: hasP } = await sb().from("profiles").select("id").neq("perms", "{}").limit(50); if (hasP && hasP.length) show(hasP.map(x => x.id));
    let tm; $("#pmq").oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { const q = $("#pmq").value.trim(); if (q.length < 2) return; const l = await rpc("member_search", { q }).catch(() => []); show(l.map(x => x.id)); }, 300); };
    $("#pml").onchange = async e => { const x = e.target.closest("[data-pm]"); if (!x) return; const u = x.dataset.pm, ps = [...document.querySelectorAll(`[data-pm="${u}"]:checked`)].map(i => i.value);
      const { error } = await sb().from("profiles").update({ perms: ps }).eq("id", u); toast(error ? error.message : "حُفظت الصلاحيات"); };
  }
  let MYP = null; const can = async p => { if (isAdmin()) return true; if (!Auth.user || !sb()) return false; if (!MYP) MYP = await rpc("my_perms").catch(() => []); return (MYP || []).includes("*") || (MYP || []).includes(p); };

  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (/^gr/.test(a)) { e.preventDefault(); act(a, el); }
    else if (a === "chmark") mark(el); else if (a === "chnew") chNew();
    else if (a === "chjoin") rpc("ch_join", { c: +el.dataset.c }).then(() => { MY = null; chOne(el.dataset.c); }).catch(err);
    else if (a === "chclose") sb().from("challenges").update({ status: "closed" }).eq("id", el.dataset.c).then(() => chOne(el.dataset.c)); });
  return { list, one, chList, chOne, onPage, perms, can };
})();
