/* مساحة الفريق الإدارية (ب2-69 … ب2-85 من وثيقة التطوير) — #/team
   لا تظهر إلا للمدير وأعضاء الفريق (editor/admin)، وحمايتها في قاعدة البيانات نفسها (RLS في supabase/team.sql)
   لا في الواجهة وحدها: المحادثة الخاصة (members) لا يقرؤها غير أطرافها، وملفاتها في حاوية خاصة بالمسار <رقم النقاش>/.
   الأنواع: مهمة، نقاش، قرار، طلب مراجعة واعتماد، اجتماع، ملاحظة، محادثة خاصة. كل تغيير حالة يُسجَّل في team_audit،
   وتغيير الأدوار والصلاحيات يسجّله مشغّل في القاعدة. الإشعارات الداخلية تصل جرس الإشعارات بمشغّل team_notify.
   تتكامل مع «إدارة المواد» وسجل بنود الوثيقة (tools/plan-tasks.json) دون أن تحل محلها. */
const TEAM = (() => {
  const KINDS = { task: "مهمة", discussion: "نقاش", decision: "قرار", review: "طلب مراجعة واعتماد", meeting: "اجتماع", note: "ملاحظة", chat: "محادثة خاصة" };
  const ST = { open: "مفتوح", doing: "قيد التنفيذ", review: "بانتظار المراجعة", approved: "معتمد", rejected: "مرفوض", done: "منجز", closed: "مغلق" };
  const FLOW = { task: ["open", "doing", "review", "done", "closed"], review: ["open", "approved", "rejected", "closed"], decision: ["open", "approved", "doing", "done", "closed"], meeting: ["open", "done", "closed"], discussion: ["open", "closed"], note: ["open", "closed"], chat: ["open", "closed"] };
  const PERMS = [["content", "إدارة المحتوى والمواد"], ["review", "المراجعة والاعتماد العلمي"], ["audio", "الصوتيات والراديو"], ["tech", "الشؤون الفنية والخوادم"], ["community", "مراقبة المجتمع"], ["team", "تنظيم الفريق والاجتماعات"]];
  let people = null;
  const sb = () => Auth.sb, me = () => Auth.user && Auth.user.id;
  const isAdm = () => Cloud.role === "admin";
  async function team() { if (people) return people; const { data } = await sb().from("profiles").select("id,name,role,team_perms").in("role", ["editor", "admin"]); people = data || []; return people; }
  const nm = id => ((people || []).find(p => p.id === id) || {}).name || "عضو";
  const sections = () => (typeof ABOUT_SECS !== "undefined" ? ABOUT_SECS : []).flatMap(([g, items]) => items.map(([n]) => g + " › " + n));
  const audit = (action, target, detail) => sb().from("team_audit").insert({ actor: me(), action, target: String(target), detail: detail || {} }).then(() => { });
  const due = d => d ? `<span class="${d < today() ? "tmlate" : ""}">${d < today() ? "متأخرة: " : "موعدها "}${esc(d)}</span>` : "";
  const gate = () => {
    if (!Auth.user) return view(`<h2>مساحة الفريق</h2><p><a href="#/account?next=%23%2Fteam">سجّل الدخول</a> أولًا.</p>`), false;
    if (!Cloud.staff()) return view(`<h2>مساحة الفريق</h2><p class="note">هذا القسم خاص بإدارة المكتبة وفريقها.</p>`), false;
    return true;
  };

  async function vTeam(id, q) {
    if (!gate()) return; await team();
    if (id && /^\d+$/.test(id)) return thread(+id);
    const k = q.k || "", tab = q.t || "list";
    const tabs = [["list", "الكل"], ["task", "المهام"], ["discussion", "النقاشات"], ["decision", "القرارات"], ["review", "المراجعة والاعتماد"], ["meeting", "الاجتماعات"], ["chat", "المحادثات الخاصة"], ["sections", "الأقسام والخدمات"], ["plan", "بنود الوثيقة"]].concat(isAdm() ? [["people", "الأعضاء والصلاحيات"]] : []).concat([["audit", "سجل القرارات والتعديلات"]]);
    const cur = tab !== "list" ? tab : (k || "list");
    const nav = `<nav class="chips tmnav">${tabs.map(([v, l]) => `<a class="chip${cur === v ? " x" : ""}" href="#/team?${KINDS[v] ? "k=" + v : v === "list" ? "" : "t=" + v}">${l}</a>`).join("")}</nav>`;
    const head = `<h2>مساحة الفريق</h2><p class="mut">خاصة بالمدير وأعضاء الفريق المأذون لهم؛ لا يراها غيرهم. للتواصل وتنظيم العمل والقرارات، وإدارة المحتوى نفسها في <a href="#/admin?t=items">إدارة المواد</a>.</p>${nav}`;
    if (tab === "people") return people_(head);
    if (tab === "audit") return audit_(head);
    if (tab === "sections") return view(head + `<p class="mut">مراجعة منظمة لأقسام الموقع وخدماته: افتح نقاش مراجعة لأي خدمة، وتجمع المساحة ملاحظاتها وقراراتها.</p><div class="mglist">${sections().map(s => `<div class="mgrow"><span class="mgt">${esc(s)}</span><button class="btn s" data-act="tmnew" data-k="review" data-sec="${esc(s)}">طلب مراجعة</button><a class="btn s" href="#/team?q=${encodeURIComponent(s.split(" › ")[1])}">نقاشاتها</a></div>`).join("")}</div>`);
    if (tab === "plan") return plan_(head);
    view(head + `<p class="mut">جارٍ التحميل…</p>`);
    let qy = sb().from("team_threads").select("*").order("updated_at", { ascending: false }).limit(300);
    if (k) qy = qy.eq("kind", k);
    const { data, error } = await qy; if (error) return view(head + `<p class="note">${esc(error.message)}</p>`);
    let rows = data || []; const s = (q.q || "").trim();
    if (s) rows = rows.filter(r => SDSLSearch.norm(r.title + " " + r.body + " " + (r.section || "")).includes(SDSLSearch.norm(s)));
    if (q.mine) rows = rows.filter(r => r.assignee === me());
    const open = rows.filter(r => !/^(done|closed|approved|rejected)$/.test(r.status)), shut = rows.filter(r => !open.includes(r));
    const card = r => `<a class="bk tmrow" href="#/team/${r.id}"><b><em class="tag">${KINDS[r.kind]}</em> ${esc(r.title)}${r.members ? ' <em class="tag">خاصة</em>' : ""}</b><span>${ST[r.status]}${r.assignee ? " • المسؤول: " + esc(nm(r.assignee)) : ""}${r.due ? " • " + due(r.due) : ""}${r.section ? " • " + esc(r.section.split(" › ").pop()) : ""}${r.meta && r.meta.at ? " • " + esc(new Date(r.meta.at).toLocaleString("ar-EG")) : ""} • ${esc(ago(r.updated_at))}</span></a>`;
    view(head + `<div class="row tmtools"><form data-form="tmsearch" class="stepper"><input name="q" type="search" value="${esc(s)}" placeholder="بحث في المساحة"><input type="hidden" name="k" value="${esc(k)}"><button class="btn">بحث</button></form>
      <button class="btn p" data-act="tmnew" data-k="${esc(k || "task")}">+ ${k ? "إضافة " + KINDS[k] : "جديد"}</button> <a class="btn s" href="#/team?${k ? "k=" + k + "&" : ""}mine=1">المسند إليّ</a></div>
      <h3>الجاري (${toAr(open.length)})</h3><div class="msgs">${open.map(card).join("") || '<p class="mut">لا شيء جارٍ.</p>'}</div>
      ${shut.length ? `<details><summary>المنتهي (${toAr(shut.length)})</summary><div class="msgs">${shut.map(card).join("")}</div></details>` : ""}`);
  }

  function newDlg(kind, sec, plan) {
    const ppl = people || [];
    openDlg(`<h3>جديد في مساحة الفريق</h3><form data-form="tmnew">
      <label>النوع</label><select name="kind">${Object.entries(KINDS).map(([v, l]) => `<option value="${v}"${v === kind ? " selected" : ""}>${l}</option>`).join("")}</select>
      <label>العنوان</label><input name="title" required maxlength="200" value="${esc(plan ? plan.id + ": " + plan.text.slice(0, 150) : "")}">
      <label>التفاصيل</label><textarea name="body" rows="5" maxlength="20000"></textarea>
      <label>القسم أو الخدمة</label><input name="section" list="tmsecs" value="${esc(sec || "")}"><datalist id="tmsecs">${sections().map(s => `<option value="${esc(s)}">`).join("")}</datalist>
      <div class="row tmonly" data-for="task review decision"><div><label>المسؤول</label><select name="assignee"><option value="">—</option>${ppl.map(p => `<option value="${p.id}">${esc(p.name || "عضو")}</option>`).join("")}</select></div><div><label>الموعد</label><input name="due" type="date"></div></div>
      <div class="tmonly" data-for="meeting"><div class="row"><div><label>موعد الاجتماع</label><input name="at" type="datetime-local"></div><div><label>رابط الاجتماع المرئي</label><input name="link" type="url" placeholder="https://"></div></div>
       <button type="button" class="btn s" data-act="tmjitsi">إنشاء رابط اجتماع مرئي (Jitsi Meet، مجاني بلا حساب)</button></div>
      <div class="tmonly" data-for="chat"><label>أطراف المحادثة الخاصة (لا يراها غيرهم ولا المدير إن لم يكن منهم)</label>${ppl.filter(p => p.id !== me()).map(p => `<label class="inl"><input type="checkbox" name="m" value="${p.id}"> ${esc(p.name || "عضو")}</label>`).join("") || '<p class="mut">لا أعضاء آخرون في الفريق بعد.</p>'}</div>
      ${plan ? `<input type="hidden" name="plan" value="${esc(plan.id)}">` : ""}
      <div class="savebar"><button class="btn p">إنشاء</button> <span id="tmst" class="mut" role="status"></span></div></form>`);
    const f = $("#dlgb form"), sync = () => $$("#dlgb .tmonly").forEach(el => el.hidden = !el.dataset.for.split(" ").includes(f.kind.value));
    f.kind.onchange = sync; sync();
  }
  async function create(f) {
    const fd = new FormData(f), kind = fd.get("kind"), st = $("#tmst");
    const row = { kind, title: String(fd.get("title")).trim(), body: String(fd.get("body") || "").trim(), section: String(fd.get("section") || "").trim() || null, created_by: me(), meta: {} };
    if (/^(task|review|decision)$/.test(kind)) { if (fd.get("assignee")) row.assignee = fd.get("assignee"); if (fd.get("due")) row.due = fd.get("due"); }
    if (kind === "meeting") { if (fd.get("at")) row.meta.at = new Date(fd.get("at")).toISOString(); const l = String(fd.get("link") || "").trim(); if (/^https:\/\//.test(l)) row.meta.link = l; }
    if (kind === "chat") { const m = fd.getAll("m"); if (!m.length) return st.textContent = "اختر طرفًا واحدًا على الأقل."; row.members = [me()].concat(m); }
    if (fd.get("plan")) row.meta.plan = fd.get("plan");
    f.querySelector("button.p").disabled = true; st.textContent = "جارٍ الحفظ…";
    const { data, error } = await sb().from("team_threads").insert(row).select("id").single();
    if (error) { st.textContent = error.message; f.querySelector("button.p").disabled = false; return; }
    if (kind === "decision" || kind === "review") audit(kind === "decision" ? "قرار جديد" : "طلب مراجعة", data.id, { title: row.title });
    dlg().close(); go("#/team/" + data.id);
  }

  async function thread(id) {
    const [{ data: t, error }, { data: posts }] = await Promise.all([sb().from("team_threads").select("*").eq("id", id).maybeSingle(), sb().from("team_posts").select("*").eq("thread_id", id).order("created_at")]);
    if (error || !t) return view(`<p><a href="#/team">← مساحة الفريق</a></p><p class="note">غير موجود، أو ليس لك الاطلاع عليه.</p>`);
    const can = t.created_by === me() || t.assignee === me() || isAdm(), flow = FLOW[t.kind] || ["open", "closed"];
    const files = (posts || []).filter(p => p.file);
    let urls = {}; if (files.length) { const { data: su } = await sb().storage.from("team").createSignedUrls(files.map(p => p.file), 3600); (su || []).forEach((x, i) => urls[files[i].file] = x.signedUrl); }
    view(`<p><a href="#/team${t.kind ? "?k=" + t.kind : ""}">← مساحة الفريق</a></p>
     <h2><em class="tag">${KINDS[t.kind]}</em> ${esc(t.title)}${t.members ? ' <em class="tag">خاصة: ' + t.members.map(u => esc(nm(u))).join("، ") + "</em>" : ""}</h2>
     <p class="mut">أنشأه ${esc(nm(t.created_by))} • ${esc(new Date(t.created_at).toLocaleString("ar-EG"))}${t.section ? " • " + esc(t.section) : ""}${t.meta && t.meta.plan ? ` • من بنود الوثيقة: <b>${esc(t.meta.plan)}</b>` : ""}</p>
     ${t.kind === "meeting" ? `<div class="card">${t.meta.at ? "<b>الموعد:</b> " + esc(new Date(t.meta.at).toLocaleString("ar-EG")) + "<br>" : ""}${t.meta.link ? `<a class="btn p" href="${esc(t.meta.link)}" target="_blank" rel="noopener">دخول الاجتماع المرئي</a>` : '<span class="mut">لا رابط مرئي؛ يُعقد حسب الاتفاق.</span>'}</div>` : ""}
     ${t.body ? `<div class="card tmbody">${linkify(esc(t.body)).replace(/\n/g, "<br>")}</div>` : ""}
     <form class="row tmstate" data-form="tmstate" data-id="${t.id}"><div><label>الحالة</label><select name="status"${can ? "" : " disabled"}>${flow.map(s => `<option value="${s}"${s === t.status ? " selected" : ""}>${ST[s]}</option>`).join("")}</select></div>
      ${/^(task|review|decision)$/.test(t.kind) ? `<div><label>المسؤول</label><select name="assignee"${can ? "" : " disabled"}><option value="">—</option>${(people || []).map(p => `<option value="${p.id}"${p.id === t.assignee ? " selected" : ""}>${esc(p.name || "عضو")}</option>`).join("")}</select></div><div><label>الموعد</label><input name="due" type="date" value="${esc(t.due || "")}"${can ? "" : " disabled"}></div>` : ""}
      ${t.kind === "decision" ? `<div><label>متابعة التنفيذ</label><input name="impl" value="${esc((t.meta && t.meta.impl) || "")}" placeholder="ما نُفّذ وما بقي"${can ? "" : " disabled"}></div>` : ""}
      ${can ? '<div><label>&nbsp;</label><button class="btn">حفظ</button></div>' : ""}</form>
     <h3>الردود والملفات (${toAr((posts || []).length)})</h3>
     <div class="dmthread tmposts">${(posts || []).map(p => `<div class="dmm${p.user_id === me() ? " me" : ""}"><small><b>${esc(nm(p.user_id))}</b> • ${esc(ago(p.created_at))}</small>${p.body ? `<p>${linkify(esc(p.body)).replace(/\n/g, "<br>")}</p>` : ""}${p.file ? `<p>📎 ${urls[p.file] ? `<a href="${esc(urls[p.file])}" target="_blank" rel="noopener">${esc(p.file.split("/").pop().replace(/^\d+-/, ""))}</a>` : esc(p.file.split("/").pop())}</p>` : ""}</div>`).join("") || '<p class="mut">لا ردود بعد.</p>'}</div>
     <form data-form="tmpost" data-id="${t.id}" class="dmform"><textarea name="t" maxlength="20000" placeholder="اكتب ردًّا أو ملاحظة…"></textarea><label class="btn s">📎 ملف<input type="file" name="f" hidden></label><button class="btn p">إرسال</button><span id="tmpst" class="mut"></span></form>
     ${isAdm() ? `<p><button class="btn s" data-act="tmdel" data-id="${t.id}">حذف (المدير)</button></p>` : ""}`);
  }
  async function saveState(f) {
    const id = +f.dataset.id, fd = new FormData(f), { data: t } = await sb().from("team_threads").select("*").eq("id", id).single();
    const up = { status: fd.get("status"), updated_at: new Date().toISOString() };
    if (f.assignee) up.assignee = fd.get("assignee") || null; if (f.due) up.due = fd.get("due") || null;
    if (f.impl) up.meta = Object.assign({}, t.meta || {}, { impl: String(fd.get("impl") || "") });
    const { error } = await sb().from("team_threads").update(up).eq("id", id); if (error) return alert(error.message);
    const ch = {}; ["status", "assignee", "due"].forEach(k => { if (k in up && (up[k] || null) !== (t[k] || null)) ch[k] = [t[k], up[k]]; });
    if (up.meta && up.meta.impl !== ((t.meta || {}).impl || "")) ch.impl = [(t.meta || {}).impl || "", up.meta.impl];
    if (Object.keys(ch).length) {
      await audit("تحديث " + KINDS[t.kind], id, Object.assign({ title: t.title }, ch));
      if (ch.assignee && up.assignee && up.assignee !== me()) sb().from("notifications").insert({ user_id: up.assignee, title: "أُسند إليك: " + t.title, url: "#/team/" + id }).then(() => { });
      if (ch.status) sb().from("team_posts").insert({ thread_id: id, user_id: me(), body: "— غيّر الحالة: " + ST[t.status] + " ← " + ST[up.status] }).then(() => { });
    }
    toast("حُفظ."); thread(id);
  }
  async function post(f) {
    const id = +f.dataset.id, body = f.t.value.trim(), file = f.f.files[0], st = $("#tmpst"); if (!body && !file) return;
    const b = f.querySelector("button"); b.disabled = true;
    try { let path = null;
      if (file) { if (file.size > 25 * 1048576) throw new Error("حد الملف ٢٥ ميجابايت."); st.textContent = "جارٍ رفع الملف…";
        path = id + "/" + Date.now() + "-" + file.name.replace(/[^\w.؀-ۿ-]+/g, "_").slice(-80);
        const { error: ue } = await sb().storage.from("team").upload(path, file, { contentType: file.type || "application/octet-stream" }); if (ue) throw new Error(ue.message); }
      const { error } = await sb().from("team_posts").insert({ thread_id: id, user_id: me(), body, file: path }); if (error) throw new Error(error.message);
      thread(id);
    } catch (e) { st.textContent = e.message; b.disabled = false; }
  }

  async function people_(head) {
    view(head + '<p class="mut">جارٍ التحميل…</p>');
    const { data } = await sb().from("profiles").select("id,name,role,team_perms").order("name");
    const all = data || [];
    view(head + `<p class="mut">أعضاء الفريق وصلاحياتهم. يمنحها المدير أو يعدّلها أو يسحبها، ويُسجَّل كل تغيير آليًا في «سجل القرارات والتعديلات». المدير له كل الصلاحيات.</p>
     <div class="mglist">${all.filter(p => p.role !== "member" || all.length < 60).map(p => `<form class="mgrow" data-form="tmperm" data-id="${p.id}"><span class="mgt"><b>${esc(p.name || "عضو")}</b> <em class="tag">${({ admin: "مدير", editor: "عضو فريق", sheikh: "حساب شيخ", member: "عضو" })[p.role] || p.role}</em><br>
       ${p.role === "admin" ? '<span class="mut">كل الصلاحيات</span>' : p.role === "editor" ? PERMS.map(([k, l]) => `<label class="inl"><input type="checkbox" name="p" value="${k}"${(p.team_perms || []).includes(k) ? " checked" : ""}> ${l}</label>`).join("") : ""}</span>
       ${p.role === "admin" || p.id === me() ? "" : `<span><select name="role"><option value="member"${p.role === "member" ? " selected" : ""}>عضو</option><option value="editor"${p.role === "editor" ? " selected" : ""}>عضو فريق</option>${p.role === "sheikh" ? '<option value="sheikh" selected>حساب شيخ</option>' : ""}</select><button class="btn s">حفظ</button></span>`}</form>`).join("")}</div>`);
  }
  async function savePerm(f) {
    const fd = new FormData(f), role = fd.get("role"), perms = fd.getAll("p");
    if (!confirm(role === "editor" ? "منح عضوية الفريق بالصلاحيات المحددة؟" : "سحب عضوية الفريق وصلاحياتها؟")) return;
    const { error } = await sb().from("profiles").update({ role, team_perms: role === "editor" ? perms : [] }).eq("id", f.dataset.id);
    if (error) return alert(error.message); people = null; toast("حُفظت الصلاحيات، وسُجّل التغيير."); vTeam(null, { t: "people" });
  }
  async function audit_(head) {
    const { data } = await sb().from("team_audit").select("*").order("at", { ascending: false }).limit(300);
    const fmt = d => Object.entries(d || {}).filter(([k]) => k !== "title" && k !== "name").map(([k, v]) => `${({ status: "الحالة", assignee: "المسؤول", due: "الموعد", impl: "التنفيذ", role: "الدور", perms: "الصلاحيات" })[k] || k}: ${Array.isArray(v) ? v.map(x => esc(k === "status" ? ST[x] || x || "—" : k === "assignee" ? (x ? nm(x) : "—") : Array.isArray(x) ? x.join("، ") || "—" : x || "—")).join(" ← ") : esc(String(v))}`).join(" • ");
    view(head + `<p class="mut">القرارات الإدارية والفنية ومتابعة تنفيذها، وتغييرات الصلاحيات. السجل للاطلاع ولا يُعدَّل من الواجهة. وتعديلات المحتوى نفسها في <a href="#/admin?t=log">سجل التعديلات</a>.</p>
     <div class="msgs">${(data || []).map(a => `<div class="bk"><b>${esc(a.action === "perms" ? "تغيير صلاحيات: " + ((a.detail || {}).name || "عضو") : a.action + ((a.detail || {}).title ? ": " + a.detail.title : ""))}</b><span>${esc(nm(a.actor))} • ${esc(new Date(a.at).toLocaleString("ar-EG"))}${/^\d+$/.test(a.target || "") && a.action !== "perms" ? ` • <a href="#/team/${a.target}">فتح</a>` : ""}<br>${fmt(a.detail)}</span></div>`).join("") || '<p class="mut">السجل فارغ.</p>'}</div>`);
  }
  let PLAN = null;
  async function plan_(head) {
    view(head + '<p class="mut">جارٍ تحميل بنود الوثيقة…</p>');
    try { PLAN = PLAN || await (await fetch("https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/tools/plan-tasks.json")).json(); } catch (e) { return view(head + '<p class="note">تعذر تحميل سجل البنود.</p>'); }
    const rows = PLAN.rows.filter(r => r.kind !== "rule" && r.st !== "rule"), ch = new Map();
    rows.forEach(r => { const c = ch.get(r.ch) || ch.set(r.ch, { n: r.chap, s: {} }).get(r.ch); c.s[r.st] = (c.s[r.st] || 0) + 1; });
    const L = { done: "منجز", check: "يحتاج تحققًا", todo: "لم يبدأ", owner: "قرار المالك" };
    view(head + `<p class="mut">حالة بنود وثيقة التطوير (من tools/plan-tasks.json). أنشئ مهمة لأي باب لتوزيع العمل ومتابعته هنا.</p>
     <div class="mglist">${[...ch].map(([k, c]) => `<div class="mgrow"><span class="mgt"><b>الباب ${toAr(k)}: ${esc(c.n || "")}</b><br><span class="mut">${Object.entries(c.s).map(([s, n]) => (L[s] || s) + " " + toAr(n)).join(" • ")}</span></span><button class="btn s" data-act="tmplan" data-ch="${k}">مهمة لهذا الباب</button></div>`).join("")}</div>`);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=tm]"); if (!el) return; const a = el.dataset.act;
    if (a === "tmnew") { e.preventDefault(); team().then(() => newDlg(el.dataset.k || "task", el.dataset.sec)); }
    else if (a === "tmjitsi") { const f = el.closest("form"); f.link.value = "https://meet.jit.si/dawahlibrary-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
    else if (a === "tmplan") { const c = (PLAN.rows.find(r => r.ch === +el.dataset.ch) || {}); newDlg("task", "", { id: "الباب " + el.dataset.ch, text: c.chap || "" }); }
    else if (a === "tmdel") { if (confirm("حذف هذا العنصر وردوده نهائيًا؟")) sb().from("team_threads").delete().eq("id", +el.dataset.id).then(({ error }) => { if (error) return alert(error.message); audit("حذف", el.dataset.id, {}); go("#/team"); }); }
  });
  document.addEventListener("submit", e => {
    const f = e.target; if (!f.dataset || !/^tm/.test(f.dataset.form || "")) return; e.preventDefault(); e.stopImmediatePropagation();
    const k = f.dataset.form;
    if (k === "tmnew") create(f); else if (k === "tmpost") post(f); else if (k === "tmstate") saveState(f); else if (k === "tmperm") savePerm(f);
    else if (k === "tmsearch") { const p = new URLSearchParams(); if (f.q.value) p.set("q", f.q.value); if (f.k.value) p.set("k", f.k.value); go("#/team?" + p); }
  }, true);
  return { view: vTeam };
})();
