/* المسارات العلمية: برامج دراسة متدرجة من كتب المكتبة، يُحسب التقدم فيها من القراءة الفعلية (أبعد صفحة بلغها القارئ في كل كتاب)،
   مع اختبار قصير في كل كتاب بالمساعد العلمي، وشهادة إتمام قراءة من المكتبة تُنزَّل صورةً عند إتمام المسار. */
let PATHS = null;
async function loadPaths() { if (!PATHS) { try { PATHS = (await (await fetch("data/paths.json")).json()).paths || []; } catch (e) { PATHS = []; } } return PATHS.map(p => Object.assign({}, p, { books: p.books.filter(id => B(id)) })).filter(p => p.books.length); }
const pathPct = id => { const b = B(id); if (!b || !b.n) return 0; return Math.min(100, Math.round(100 * ((S.maxBy || {})[id] || (S.lastBy || {})[id] || 0) / b.n)); };
/* مساراتي وخطط القراءة: لكل مسار (مرشح من المكتبة أو يختاره العضو بنفسه) خطة اختيارية:
   بلا مدة، أو بمدة: بتاريخ انتهاء، أو بعدد صفحات يومي، أو بدقائق يومية؛ مع أيام إجازة من القراءة.
   الحفظ: جدول study_paths إن وُجد في قاعدة البيانات، وإلا على الجهاز (وتُرفع تلقائيًا إلى الحساب متى أُضيف الجدول). */
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ldate = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const fdate = d => new Date(d).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const SP = {
  rows: null, uid: null, local: false,
  k() { return "spaths:" + (Auth.user ? Auth.user.id : "-"); },
  async load() {
    if (!Auth.user) return (this.rows = []);
    if (this.rows && this.uid === Auth.user.id) return this.rows;
    this.uid = Auth.user.id; const loc = ls.get(this.k(), []);
    if (Mine.cloud() && !this.local) {
      const { data, error } = await Auth.sb.from("study_paths").select("*").eq("user_id", Auth.user.id).order("created_at");
      if (!error) {
        this.rows = data || [];
        const up = loc.filter(l => !this.rows.some(r => r.id === l.id));
        if (up.length) { const { error: e2 } = await Auth.sb.from("study_paths").upsert(up.map(r => Object.assign({}, r, { user_id: Auth.user.id }))); if (!e2) { this.rows.push(...up); ls.set(this.k(), []); } }
        return this.rows;
      }
      this.local = true;
    }
    return (this.rows = loc);
  },
  async save(r) {
    await this.load(); r.updated_at = new Date().toISOString();
    const i = this.rows.findIndex(x => x.id === r.id); if (i >= 0) this.rows[i] = Object.assign(this.rows[i], r); else this.rows.push(Object.assign({ created_at: r.updated_at }, r));
    if (Mine.cloud() && !this.local) { const { error } = await Auth.sb.from("study_paths").upsert(Object.assign({ user_id: Auth.user.id }, this.rows.find(x => x.id === r.id))); if (!error) return; this.local = true; }
    ls.set(this.k(), this.rows);
  },
  async del(id) {
    await this.load(); this.rows = this.rows.filter(x => x.id !== id);
    if (Mine.cloud() && !this.local) { const { error } = await Auth.sb.from("study_paths").delete().eq("user_id", Auth.user.id).eq("id", id); if (!error) return; this.local = true; }
    ls.set(this.k(), this.rows);
  },
  get(id) { return (this.rows || []).find(x => x.id === id); }
};
/* حساب الخطة: الصفحات المتبقية، والورد اليومي، وتاريخ الانتهاء، وورد اليوم */
function spState(books, plan, pid) {
  const bs = books.map(id => { const b = B(id), n = b ? (b.n || (b.pages || []).length) : 0; return { id, b, n, r: Math.min(n, (S.maxBy || {})[id] || 0) }; }).filter(x => x.b && x.n);
  const total = bs.reduce((s, x) => s + x.n, 0), read = bs.reduce((s, x) => s + x.r, 0), left = Math.max(0, total - read);
  const off = new Set((plan && plan.off) || []), isOff = d => off.size < 7 && off.has(d.getDay()), now = new Date(); now.setHours(0, 0, 0, 0);
  const rdays = (a, z) => { let c = 0; for (const d = new Date(a); d <= z; d.setDate(d.getDate() + 1)) if (!isOff(d)) c++; return c; };
  const addR = (a, k) => { const d = new Date(a); let c = 0; for (let g = 0; g < 4000; g++) { if (!isOff(d) && ++c >= k) return d; d.setDate(d.getDate() + 1); } return d; };
  let daily = 0, end = null, late = false;
  if (plan && plan.mode === "timed" && left) {
    if (plan.by === "days") { end = new Date(plan.end + "T00:00"); const rd = rdays(now, end); late = rd < 1; daily = Math.ceil(left / Math.max(1, rd)); }
    else { daily = plan.by === "minutes" ? Math.max(1, Math.floor((+plan.minutes || 20) / (+plan.mpp || 2))) : Math.max(1, +plan.daily || 10); end = addR(now, Math.ceil(left / daily)); }
  }
  // ورد اليوم: لقطة أول اليوم حتى لا يتغير الهدف أثناء القراءة
  let todayGoal = 0, todayRead = 0;
  if (daily && pid) { const k = "spday:" + pid, sn = ls.get(k, null), d0 = ldate(now); let s = sn && sn.d === d0 ? sn : { d: d0, read, daily: isOff(now) ? 0 : daily }; if (s !== sn) ls.set(k, s); todayGoal = s.daily; todayRead = Math.max(0, read - s.read); }
  const seg = []; let need = Math.max(0, todayGoal - todayRead);
  for (const x of bs) { if (!need) break; if (x.r >= x.n) continue; const a = x.r + 1, z = Math.min(x.n, x.r + need); seg.push({ b: x.b, id: x.id, a, z }); need -= z - x.r; }
  // توقع الإتمام من معدل القراءة الفعلي: سجل يومي لما قُرئ من كتب المسار
  let pace = 0, fc = null;
  if (pid) {
    const hk = "sphist:" + pid, hist = ls.get(hk, {}), d0 = ldate(now); hist[d0] = read;
    const ks = Object.keys(hist).sort(); while (ks.length > 30) delete hist[ks.shift()]; ls.set(hk, hist);
    const ref = ks.filter(k => k <= ldate(now.getTime() - 864e5)).filter(k => k >= ldate(now.getTime() - 14 * 864e5));
    if (ref.length) { const k0 = ref[0], days = Math.max(1, Math.round((now - new Date(k0 + "T00:00")) / 864e5)); pace = (read - hist[k0]) / days; }
    if (pace > 0 && left) { fc = new Date(now); fc.setDate(fc.getDate() + Math.ceil(left / pace)); }
  }
  return { pace, fc, bs, total, read, left, pct: total ? Math.round(read / total * 100) : 0, daily, end, late, offToday: isOff(now), todayGoal, todayRead, seg, cur: bs.find(x => x.r < x.n), mins: daily * (+(plan && plan.mpp) || 2) };
}
const pgs2 = n => n === 1 ? "صفحة واحدة" : n === 2 ? "صفحتان" : toAr(n) + (n > 2 && n < 11 ? " صفحات" : " صفحة");
function spForecast(st, plan) {
  if (!st.left) return "";
  if (!st.fc) return `<p class="mut">🔮 توقع الإتمام: يظهر بعد يومين من القراءة، محسوبًا من معدل قراءتك الفعلي.</p>`;
  let h = `<p>🔮 <b>بمعدل قراءتك الحالي</b> (نحو ${pgs2(Math.max(1, Math.round(st.pace)))} يوميًا) <b>تتم المسار ${esc(fdate(st.fc))}</b>`;
  if (st.end) { const dd = Math.round((st.fc - st.end) / 864e5); h += dd > 0 ? ` <span class="spbad">— بعد موعد خطتك بـ${toAr(dd)} يومًا؛ زد وردك قليلًا</span>` : dd < 0 ? ` <span class="ok">— قبل موعد خطتك بـ${toAr(-dd)} يومًا، أحسنت</span>` : ` <span class="ok">— في موعد خطتك تمامًا</span>`; }
  return h + "</p>";
}
function spSummary(st, plan) {
  if (!st.left) return `<p class="ok">أتممت قراءة كتب المسار، بارك الله فيك.</p>`;
  if (!plan || plan.mode !== "timed") return `<p class="mut">بلا مدة محددة: اقرأ على راحتك، ويُحسب تقدمك من قراءتك. بقي ${pgs2(st.left)}.</p>` + spForecast(st, plan);
  const offs = (plan.off || []).length ? ` • إجازة: ${plan.off.map(d => DAYS[d]).join("، ")}` : "";
  let h = `<p><b>الورد اليومي: ${pgs2(st.daily)}</b> (نحو ${toAr(st.mins)} دقيقة) • الختم المتوقع: ${esc(fdate(st.end))}${offs}</p>`;
  h += spForecast(st, plan);
  if (st.late) h += `<p class="note">انقضت المدة المحددة ولم يكتمل المسار؛ عدّل الخطة لتحديد موعد جديد.</p>`;
  if (st.offToday) h += `<p class="mut">اليوم يوم إجازة من القراءة.</p>`;
  else if (st.seg.length) h += `<div class="spday"><b>وردك اليوم${st.todayRead ? ` (قرأت ${pgs2(st.todayRead)} من ${pgs2(st.todayGoal)})` : ""}:</b>${st.seg.map(s => `<a class="btn s p nf" href="#/book/${s.id}/${s.a}">«${esc(s.b.setTitle || s.b.title)}» ص ${toAr(s.a)}–${toAr(s.z)}</a>`).join("")}</div>`;
  else if (st.todayGoal) h += `<p class="ok">✓ أتممت ورد اليوم، بارك الله فيك.</p>`;
  return h;
}
function spPlanForm(pid, plan, books) {
  plan = plan || { mode: "free" }; const by = plan.by || "days", end = plan.end || ldate(Date.now() + 30 * 864e5);
  return `<form data-form="spplan" data-id="${esc(pid)}" class="card spform"><h3>خطة القراءة</h3>
  <div class="seg"><label><input type="radio" name="mode" value="free"${plan.mode !== "timed" ? " checked" : ""}> بلا مدة محددة</label><label><input type="radio" name="mode" value="timed"${plan.mode === "timed" ? " checked" : ""}> بمدة محددة</label></div>
  <div class="sptimed">
   <label>طريقة التحديد</label><select name="by"><option value="days"${by === "days" ? " selected" : ""}>أختم في تاريخ معين</option><option value="pages"${by === "pages" ? " selected" : ""}>عدد صفحات يومي</option><option value="minutes"${by === "minutes" ? " selected" : ""}>مدة قراءة يومية بالدقائق</option></select>
   <div class="row"><div class="spby" data-by="days"><label>تاريخ الختم</label><input type="date" name="end" value="${esc(end)}" min="${ldate(Date.now())}"></div>
   <div class="spby" data-by="days"><label>أو بعد عدد أيام</label><input type="number" name="ndays" min="1" max="3650" placeholder="مثلًا ٦٠"></div>
   <div class="spby" data-by="pages"><label>صفحات يوميًا</label><input type="number" name="daily" min="1" max="500" value="${esc(plan.daily || 10)}"></div>
   <div class="spby" data-by="minutes"><label>دقائق يوميًا</label><input type="number" name="minutes" min="5" max="600" value="${esc(plan.minutes || 20)}"></div>
   <div><label>دقائق للصفحة تقريبًا</label><input type="number" name="mpp" min="0.5" max="15" step="0.5" value="${esc(plan.mpp || 2)}"></div></div>
   <label>أيام الإجازة من القراءة</label><div class="spoff">${DAYS.map((d, i) => `<label><input type="checkbox" name="off" value="${i}"${(plan.off || []).includes(i) ? " checked" : ""}> ${d}</label>`).join("")}</div>
   <div class="row" style="align-items:end"><div><label>وقت التذكير</label><input type="time" name="at" value="${esc(plan.at || "20:00")}"></div><label class="inl"><input type="checkbox" name="email" value="1"${plan.email === false ? "" : " checked"}> أرسل التذكير إلى بريدي أيضًا</label></div>
  </div>
  <p id="spest" class="note"></p><div class="row"><button class="btn p">احفظ الخطة</button></div></form>`;
}
function spReadForm(f) {
  const fd = new FormData(f), p = { mode: fd.get("mode"), by: fd.get("by"), off: fd.getAll("off").map(Number), at: fd.get("at") || "20:00", email: fd.get("email") === "1", mpp: +fd.get("mpp") || 2 };
  if (p.mode === "timed") { if (p.by === "days") { const nd = +fd.get("ndays"); p.end = nd ? ldate(Date.now() + (nd - 1) * 864e5) : fd.get("end"); } else if (p.by === "pages") p.daily = +fd.get("daily") || 10; else p.minutes = +fd.get("minutes") || 20; }
  return p;
}
function spEst(f, books) {
  const p = spReadForm(f), el = $("#spest"); f.querySelector(".sptimed").hidden = p.mode !== "timed";
  f.querySelectorAll(".spby").forEach(x => x.hidden = x.dataset.by !== p.by);
  if (!el) return; if (p.mode !== "timed") { el.textContent = "تقرأ على راحتك دون ورد يومي أو تذكير."; return; }
  if (p.off.length >= 7) { el.textContent = "اترك يومًا واحدًا على الأقل للقراءة."; return; }
  const st = spState(books, p); if (!st.left) { el.textContent = "أتممت كتب المسار."; return; }
  el.textContent = `بقي ${pgs2(st.left)}: تقرأ ${pgs2(st.daily)} في كل يوم قراءة (نحو ${toAr(st.mins)} دقيقة)، وتختم ${fdate(st.end)}${st.late ? " — التاريخ المختار مضى" : ""}.`;
}
async function vPaths(q, pid) {
  const P = await loadPaths(); try { await SP.load(); } catch (e) { }
  if (pid === "new") return spEdit(q.e);
  const mine = (SP.rows || []).filter(r => r.custom), rec = P.find(x => x.id === pid), own = SP.get(pid);
  const p = rec ? Object.assign({}, rec, { plan: own && own.plan }) : own && own.custom ? { id: own.id, t: own.title, d: "مسار اخترت كتبه بنفسك.", books: (own.books || []).filter(id => B(id)), plan: own.plan, custom: 1 } : null;
  if (pid) {
    if (!p) return view('<p class="note">المسار غير موجود.</p><p><a href="#/paths">← المسارات العلمية</a></p>');
    const quiz = ls.get("pquiz", {}), pcts = p.books.map(pathPct), done = p.books.every((id, i) => pcts[i] >= 90 && quiz[id]), st = spState(p.books, p.plan, p.id);
    view(`<p><a href="#/paths">← المسارات العلمية</a></p><div class="cmhero ph"><div><h2>${esc(p.t)}</h2><p>${esc(p.d)}</p></div>${p.custom ? `<div class="row"><a class="btn s nf" href="#/paths/new?e=${encodeURIComponent(p.id)}">تعديل الكتب</a><button class="btn s" data-act="spdel" data-id="${esc(p.id)}">حذف</button></div>` : ""}</div>
    <div class="card"><div class="prog"><i style="width:${st.pct}%"></i></div><small class="mut">قرأت ${toAr(st.pct)}٪ من المسار (${toAr(st.read)} من ${toAr(st.total)} صفحة)</small>${Auth.user ? spSummary(st, p.plan) : `<p class="note"><a href="#/account">سجّل الدخول</a> لتضع خطة قراءة بمدة وورد يومي وتذكير.</p>`}</div>
    ${Auth.user ? `<details class="card"${p.plan ? "" : " open"}><summary><b>${p.plan ? "تعديل خطة القراءة" : "ضع خطة لقراءة هذا المسار"}</b></summary>${spPlanForm(p.id, p.plan, p.books)}</details>` : ""}
    <ol class="pathl">${p.books.map((id, i) => { const b = B(id); return `<li class="${pcts[i] >= 90 ? "done" : ""}"><div><b>${esc(b.setTitle || b.title)}</b><span class="mut">${esc(A(b.authorId).name)}${b.n ? " • " + toAr(b.n) + " صفحة" : ""}</span><div class="prog"><i style="width:${pcts[i]}%"></i></div><small class="mut">قرأت ${toAr(pcts[i])}٪${quiz[id] ? " • ✓ اختبرت نفسك" : ""}</small></div>
    <div class="row"><a class="btn s p nf" href="#/book/${id}/${Math.max(1, (S.lastBy || {})[id] || 1)}">${pcts[i] ? "أكمل" : "ابدأ"}</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent("اختبرني في كتاب «" + (b.setTitle || b.title) + "» بعشرة أسئلة متدرجة مع الإجابات وتعليلها")}" data-act="pquiz" data-id="${id}">اختبر نفسك</a></div></li>`; }).join("")}</ol>
    ${done ? `<div class="card cert"><h3>أتممت المسار، بارك الله فيك</h3><p>نزّل شهادة إتمام القراءة باسمك.</p><form data-form="cert" data-id="${p.id}" class="stepper"><input name="n" required maxlength="60" placeholder="اسمك كما تريده في الشهادة" value="${esc((Auth.user && Auth.user.name) || "")}"><button class="btn p">نزّل الشهادة</button></form></div>` : `<p class="mut">تُتاح شهادة إتمام القراءة عند بلوغ ٩٠٪ من كل كتاب في المسار واختبار نفسك فيه.</p>`}`);
    const f = $('form[data-form="spplan"]'); if (f) { spEst(f, p.books); f.oninput = f.onchange = () => spEst(f, p.books); }
    return;
  }
  const card = (id, t, books, plan, tag) => { const st = spState(books, plan, Auth.user ? id : null); return `<a class="card" href="#/paths/${encodeURIComponent(id)}"><b>${esc(t)}</b><span>${toAr(books.length)} كتب • ${toAr(st.pct)}٪${plan && plan.mode === "timed" && st.left ? " • " + pgs2(st.daily) + " يوميًا • الختم " + st.end.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) : ""}${tag || ""}</span><i class="prog" style="--w:${st.pct}%"></i></a>`; };
  view(`<div class="cmhero ph"><div><h2>المسارات العلمية</h2><p>اختر مسارًا رشحته المكتبة، أو اصنع مسارك بنفسك من كتبها. ولكل مسار خطة اختيارية: بلا مدة، أو بمدة وورد يومي بالصفحات أو بالدقائق، مع أيام إجازة وتذكير.</p></div></div>
  <h3>مساراتي</h3>${Auth.user ? `<div class="grid">${mine.map(r => card(r.id, r.title, (r.books || []).filter(id => B(id)), r.plan)).join("")}<a class="card spnew" href="#/paths/new"><b>＋ اصنع مسارك</b><span>اختر الكتب وترتيبها بنفسك</span></a></div>` : `<p class="note"><a href="#/account">سجّل الدخول</a> لتصنع مسارك الخاص وتضع خطة لقراءته.</p>`}
  <h3>مسارات مرشحة من المكتبة</h3><div class="grid">${P.map(p => { const o = SP.get(p.id); return card(p.id, p.t, p.books, o && o.plan, o && o.plan && o.plan.mode === "timed" ? " • ✓ لك خطة" : ""); }).join("")}</div>`);
}
/* صانع المسار الخاص */
function spEdit(eid) {
  if (!Auth.user) return view('<p class="note"><a href="#/account">سجّل الدخول</a> لتصنع مسارك الخاص.</p>');
  const old = eid && SP.get(eid), sel = (old && old.books || []).filter(id => B(id));
  window.__spsel = sel.slice();
  view(`<p><a href="#/paths">← المسارات العلمية</a></p><h2>${old ? "تعديل مساري" : "اصنع مسارك"}</h2>
  <form data-form="spsave" data-id="${esc(old ? old.id : "")}"><label>اسم المسار</label><input name="t" required maxlength="80" value="${esc(old ? old.title : "")}" placeholder="مثلًا: مسار العقيدة الخاص بي">
  <label>الكتب بالترتيب</label><ol id="spsel" class="pathl"></ol>
  <div class="spsort"><label>رتّب لي الكتب</label><div class="row"><select id="spord"><option value="few">الأقل صفحات أولًا</option><option value="many">الأكثر صفحات أولًا</option><option value="mix">تنويع بين المؤلفين (كتاب لكل مؤلف بالتناوب)</option><option value="auth">مؤلفًا بعد مؤلف (إتمام كتب المؤلف ثم الانتقال)</option></select><button type="button" class="btn s" data-act="spsort">رتّب</button></div></div>
  <label>أضف كتابًا</label><input id="spq" type="search" placeholder="اكتب جزءًا من اسم الكتاب أو المؤلف"><div id="spres"></div>
  <div class="row" style="margin-top:12px"><button class="btn p">احفظ المسار</button></div></form>`);
  spPaint(); $("#spq").oninput = () => spFind($("#spq").value);
}
/* الترتيب الآلي: المجلدات المتتابعة من موسوعة واحدة تبقى وحدة واحدة بترتيبها */
function spOrder(s, how) {
  const units = []; s.forEach(id => { const b = B(id), k = b.setTitle || b.title, u = units[units.length - 1]; if (u && u.k === k) u.ids.push(id); else units.push({ k, a: b.authorId, ids: [id], n: 0 }); });
  units.forEach(u => u.n = u.ids.reduce((t, id) => t + (B(id).n || 0), 0));
  let out;
  if (how === "few" || how === "many") out = units.slice().sort((x, y) => how === "few" ? x.n - y.n : y.n - x.n);
  else {
    const g = new Map(); units.slice().sort((x, y) => x.n - y.n).forEach(u => { if (!g.has(u.a)) g.set(u.a, []); g.get(u.a).push(u); });
    const groups = [...g.values()].sort((x, y) => x[0].n - y[0].n);
    if (how === "auth") out = groups.flat();
    else { out = []; for (let i = 0; groups.some(q => q[i]); i++) groups.forEach(q => q[i] && out.push(q[i])); }
  }
  s.splice(0, s.length, ...out.flatMap(u => u.ids));
}
function spSets() { // الموسوعات متعددة المجلدات تُضاف كتابًا واحدًا بكل مجلداتها
  const m = new Map(); lib.books.filter(b => b.type !== "article" && !b.demo).forEach(b => { const k = b.setTitle || b.title; if (!m.has(k)) m.set(k, { t: k, a: b.authorId, ids: [] }); m.get(k).ids.push(b.id); }); return [...m.values()];
}
function spFind(s) {
  const el = $("#spres"), q = norm(s).trim(); if (!q) return (el.innerHTML = "");
  const r = spSets().filter(x => norm(x.t + " " + A(x.a).name).includes(q)).slice(0, 25);
  el.innerHTML = r.map(x => `<div class="spitem"><span><b>${esc(x.t)}</b> <small class="mut">${esc(A(x.a).name)}${x.ids.length > 1 ? " • " + toAr(x.ids.length) + " مجلدات" : ""}</small></span><button type="button" class="btn s" data-act="spadd" data-ids="${esc(x.ids.join(","))}">أضف</button></div>`).join("") || '<p class="mut">لا نتائج.</p>';
}
function spPaint() {
  const el = $("#spsel"); if (!el) return; const s = window.__spsel || [];
  el.innerHTML = s.map((id, i) => { const b = B(id); return `<li><div><b>${esc(b.setTitle ? b.setTitle + " — " + b.title.replace(b.setTitle, "").replace(/^[\s—-]+/, "") : b.title)}</b><span class="mut">${esc(A(b.authorId).name)}${b.n ? " • " + toAr(b.n) + " صفحة" : ""}</span></div><div class="row"><button type="button" class="btn s" data-act="spmv" data-i="${i}" data-d="-1" aria-label="لأعلى">▲</button><button type="button" class="btn s" data-act="spmv" data-i="${i}" data-d="1" aria-label="لأسفل">▼</button><button type="button" class="btn s" data-act="sprm" data-i="${i}" aria-label="حذف">✕</button></div></li>`; }).join("") || '<p class="mut">لم تختر كتبًا بعد.</p>';
}
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act, s = window.__spsel;
  if (a === "spadd" && s) { el.dataset.ids.split(",").forEach(id => { if (!s.includes(id)) s.push(id); }); el.textContent = "✓"; spPaint(); }
  else if (a === "spmv" && s) { const i = +el.dataset.i, j = i + +el.dataset.d; if (j >= 0 && j < s.length) { [s[i], s[j]] = [s[j], s[i]]; spPaint(); } }
  else if (a === "sprm" && s) { s.splice(+el.dataset.i, 1); spPaint(); }
  else if (a === "spsort" && s) { spOrder(s, $("#spord").value); spPaint(); toast("رُتّبت الكتب، ويمكنك تعديل الترتيب بالأسهم"); }
  else if (a === "spdel") { if (!confirm("حذف هذا المسار من مساراتك؟")) return; try { await SP.del(el.dataset.id); location.hash = "#/paths"; } catch (x) { alert(x.message); } }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest('[data-form="spsave"],[data-form="spplan"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
  try {
    if (f.dataset.form === "spsave") {
      const s = window.__spsel || []; if (!s.length) return toast("أضف كتابًا واحدًا على الأقل");
      const id = f.dataset.id || "my-" + Date.now().toString(36), old = SP.get(id);
      await SP.save({ id, title: f.t.value.trim(), books: s, custom: true, plan: old ? old.plan : { mode: "free" } }); location.hash = "#/paths/" + id;
    } else {
      const pid = f.dataset.id, p = spReadForm(f); if (p.mode === "timed" && p.off.length >= 7) return toast("اترك يومًا واحدًا على الأقل للقراءة");
      const rec = (await loadPaths()).find(x => x.id === pid), old = SP.get(pid);
      await SP.save({ id: pid, title: old ? old.title : rec && rec.t, books: old ? old.books : rec ? rec.books : [], custom: old ? !!old.custom : false, plan: p });
      ls.set("spday:" + pid, null); toast("حُفظت خطة القراءة"); route(); spSync("plan").catch(() => { });
    }
  } catch (x) { alert(x.message || x); }
}, true);
/* تذكير الورد اليومي للمسارات في جرس الإشعارات */
if (typeof Bell !== "undefined") {
  const _bl = Bell.load.bind(Bell);
  Bell.load = async function () {
    const out = await _bl(); if (!Auth.user) return out;
    try {
      const P = await loadPaths(), now = new Date(), seen = new Set(ls.get(Mine.k("seen"), []));
      for (const r of await SP.load()) {
        if (!r.plan || r.plan.mode !== "timed") continue;
        const rec = P.find(x => x.id === r.id), books = (rec ? rec.books : r.books || []).filter(id => B(id)), st = spState(books, r.plan, r.id);
        const [h, m] = String(r.plan.at || "20:00").split(":").map(Number);
        if (!st.seg.length || now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)) continue;
        const id = "spath:" + r.id + ":" + ldate(now), s0 = st.seg[0];
        out.push({ id, title: "وردك اليوم من مسار «" + (rec ? rec.t : r.title) + "»", body: `${pgs2(st.todayGoal - st.todayRead)}: «${s0.b.setTitle || s0.b.title}» من ص ${toAr(s0.a)}`, url: "#/book/" + s0.id + "/" + s0.a, at: now.toISOString(), local: 1, read: seen.has(id) });
      }
    } catch (x) { }
    return (this.items = out);
  };
}
async function cert(pid, name) {
  const p = (await loadPaths()).find(x => x.id === pid); if (!p) return; await document.fonts.ready;
  const W = 1600, H = 1130, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, H); x.strokeStyle = "#b88a2e"; x.lineWidth = 14; x.strokeRect(40, 40, W - 80, H - 80); x.strokeStyle = "#0f5c4d"; x.lineWidth = 4; x.strokeRect(70, 70, W - 140, H - 140);
  const logo = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = "assets/logo-sdsl.png"; }); if (logo) x.drawImage(logo, W / 2 - 80, 110, 160, 160);
  x.direction = "rtl"; x.textAlign = "center"; x.fillStyle = "#0f5c4d"; x.font = 'bold 64px Amiri, serif'; x.fillText("شهادة إتمام قراءة", W / 2, 350);
  x.fillStyle = "#2a241a"; x.font = '34px Amiri, serif'; x.fillText("تشهد " + SITENAME + " بأن", W / 2, 430);
  x.fillStyle = "#5a3f12"; x.font = 'bold 72px Amiri, serif'; x.fillText(name, W / 2, 530);
  x.fillStyle = "#2a241a"; x.font = '34px Amiri, serif'; x.fillText("أتمّ قراءة مسار «" + p.t + "» واختبر نفسه في كتبه:", W / 2, 610);
  x.font = '30px Amiri, serif'; const bt = p.books.map(id => "«" + (B(id).setTitle || B(id).title) + "»").join("، "); const words = bt.split(" "); let line = "", y = 670; words.forEach(w => { if (x.measureText(line + " " + w).width > W - 300) { x.fillText(line, W / 2, y); y += 46; line = w; } else line = line ? line + " " + w : w; }); x.fillText(line, W / 2, y);
  x.fillStyle = "#5b6b66"; x.font = '26px "IBM Plex Sans Arabic", sans-serif'; x.fillText("نسأل الله أن ينفعه بما قرأ، وأن يرزقه العلم النافع والعمل الصالح", W / 2, H - 230);
  x.fillText("التاريخ: " + new Date().toLocaleDateString("ar-EG", { dateStyle: "long" }) + "  •  " + (CFG.siteUrl || "dawahlibrary.org"), W / 2, H - 180);
  x.font = '20px "IBM Plex Sans Arabic", sans-serif'; x.fillText("شهادة تشجيعية بإتمام القراءة الذاتية، وليست إجازة علمية", W / 2, H - 120);
  c.toBlob(b => dl("شهادة-" + p.t + ".png", b), "image/png");
}
document.addEventListener("click", e => { const el = e.target.closest('[data-act="pquiz"]'); if (!el) return; const q = ls.get("pquiz", {}); q[el.dataset.id] = today(); ls.set("pquiz", q); });
document.addEventListener("submit", e => { const f = e.target.closest('[data-form="cert"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); cert(f.dataset.id, f.n.value.trim()); }, true);

/* أثناء القراءة: تهنئة عند إتمام كل كتاب من كتب مساراتك، ومزامنة التقدم إلى الحساب ليصل التذكير اليومي بالبريد وإشعارات الموقع */
const SPCHEER = ["«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة».", "قال الزهري: «العلم ذكرٌ لا يحبه إلا ذكورة الرجال».", "قال يحيى بن أبي كثير: «لا يُستطاع العلم براحة الجسم».", "قال الشافعي: «طلب العلم أفضل من صلاة النافلة».", "قيل للإمام أحمد: إلى متى تطلب العلم؟ قال: «مع المحبرة إلى المقبرة»."];
const spBooks = (r, P) => { const rec = P.find(x => x.id === r.id); return { t: rec ? rec.t : r.title, books: (rec ? rec.books : r.books || []).filter(id => B(id)) }; };
const spDone = id => { const b = B(id), n = b && (b.n || (b.pages || []).length); return n && ((S.maxBy || {})[id] || 0) >= n - 1; };
async function spCheck(bid) {
  if (!Auth.user || !B(bid) || !spDone(bid)) return;
  const rows = await SP.load(), P = await loadPaths(), fk = "spfin:" + Auth.user.id, fin = ls.get(fk, {}), b = B(bid);
  for (const r of rows) {
    const { t, books } = spBooks(r, P); if (!books.includes(bid)) continue;
    const unit = b.setTitle ? books.filter(id => B(id).setTitle === b.setTitle) : [bid];
    if (!unit.every(spDone)) continue; const key = r.id + ":" + (b.setTitle || bid); if (fin[key]) continue;
    fin[key] = ldate(Date.now()); ls.set(fk, fin);
    const st = spState(books, r.plan), units = [...new Set(books.map(id => B(id).setTitle || id))], doneU = units.filter(u => books.filter(id => (B(id).setTitle || id) === u).every(spDone)).length, next = st.cur;
    openDlg(`<div class="spcheer"><div class="spconf">🎉</div><h3>أتممت قراءة «${esc(b.setTitle || b.title)}»</h3><p>بارك الله لك فيما قرأت، ونفعك به، وزادك علمًا وعملًا.</p>
    <p class="mut">${esc(SPCHEER[Math.floor(Math.random() * SPCHEER.length)])}</p>
    <div class="prog"><i style="width:${st.pct}%"></i></div><p><b>${toAr(doneU)} من ${toAr(units.length)}</b> كتب في مسار «${esc(t)}» • ${toAr(st.pct)}٪</p>
    ${st.left ? `${st.fc ? `<p>🔮 بمعدلك الحالي تتم المسار ${esc(fdate(st.fc))}.</p>` : ""}<div class="row">${next ? `<a class="btn p nf" href="#/book/${next.id}/${next.r + 1}" data-act="closeDlg">ابدأ «${esc(next.b.setTitle || next.b.title)}»</a>` : ""}<a class="btn nf" href="#/ask?q=${encodeURIComponent("اختبرني في كتاب «" + (b.setTitle || b.title) + "» بعشرة أسئلة متدرجة مع الإجابات وتعليلها")}" data-act="closeDlg">اختبر نفسك فيه</a></div>`
      : `<p class="ok"><b>وبه أتممت المسار كله، فهنيئًا لك.</b></p><div class="row"><a class="btn p nf" href="#/paths/${encodeURIComponent(r.id)}" data-act="closeDlg">شهادة إتمام المسار</a></div>`}</div>`);
    try { if ("Notification" in window && Notification.permission === "granted") { const reg = await navigator.serviceWorker.getRegistration(); if (reg) reg.showNotification("🎉 أتممت «" + (b.setTitle || b.title) + "»", { body: "بارك الله لك. " + toAr(doneU) + " من " + toAr(units.length) + " في مسار «" + t + "»", tag: "spfin-" + key, icon: "assets/logo-sdsl-128.png" }); } } catch (x) { }
    return;
  }
}
/* حالة المسار تُرفع إلى الحساب: يقرؤها الخادم (api/remind.js) ليرسل التذكير اليومي في وقته، إلا يوم إجازة أو إن قرأ العضو اليوم */
async function spSync(force) {
  if (!Auth.user || !Mine.cloud()) return; const rows = await SP.load(); if (SP.local) return;
  const P = await loadPaths(), tz = -new Date().getTimezoneOffset(), today0 = ldate(Date.now());
  for (const r of rows) {
    if (!r.plan || r.plan.mode !== "timed") continue;
    const { books } = spBooks(r, P), st = spState(books, r.plan, r.id), [h, m] = String(r.plan.at || "20:00").split(":").map(Number);
    const prog = { d: today0, read: st.read, total: st.total, daily: st.daily, left: st.left, todayRead: st.todayRead, goal: st.todayGoal, last: force === "plan" ? (r.progress && r.progress.last) : today0, next: st.cur ? { id: st.cur.id, p: st.cur.r + 1, t: st.cur.b.setTitle || st.cur.b.title } : null };
    const hour = ((Math.floor((h * 60 + (m || 0) - tz) / 60) % 24) + 24) % 24;
    if (!force && r.progress && r.progress.read === prog.read && r.progress.d === prog.d) continue;
    try { await SP.save({ id: r.id, progress: prog, tz_offset: tz, hour_utc: hour }); } catch (x) { }
  }
}
if (typeof Mine !== "undefined" && Mine.touch) {
  const _mt = Mine.touch; let t = null;
  Mine.touch = (bid, p) => { _mt(bid, p); clearTimeout(t); t = setTimeout(() => { spCheck(bid).catch(() => { }); spSync().catch(() => { }); }, 3000); };
}
