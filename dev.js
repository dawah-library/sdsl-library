/* المساعد التقني (#/dev، للمدير): يكتب المدير طلب التطوير أو التعديل أو الإصلاح بلغته (إضافة قسم، تعديل واجهة، صنع أداة أو مفتاح،
   إصلاح خلل، تشغيل مهمة)، فيُحفظ في data/dev-requests.json. وجلسة Claude Code مجدولة (مرتين يوميًا) تقرأ الطلبات المعلّقة،
   فتنفّذها في المستودع وخدمات التشغيل (GitHub وVercel وSupabase) وفق قواعد HANDOFF.md، ثم تكتب ما فعلته في الطلب نفسه.
   لا يُنفَّذ الحذف ولا ما يمس حسابات الأعضاء إلا بإذن صريح في نص الطلب. */
const DEV = (() => {
  const P = "data/dev-requests.json", ST = { pending: ["⏳", "بانتظار التنفيذ"], doing: ["⚙️", "قيد التنفيذ"], done: ["✅", "نُفِّذ"], need: ["❓", "يحتاج توضيحًا"], rejected: ["⛔", "لم يُنفَّذ"] };
  const get = async () => { try { return JSON.parse((await GH.get(P)).text) || { items: [] }; } catch (e) { return { items: [] }; } };
  async function page(q) {
    if (!(Cloud.role === "admin" || GH.token)) return view('<div class="note">المساعد التقني للمدير.</div>');
    view(`<div class="cmhero"><div><h2>المساعد التقني</h2><p>اكتب ما تريد تطويره أو تعديله أو إصلاحه في الموقع، كما تكتبه لمبرمج. ينفّذه المساعد في جولاته المجدولة (مرتين يوميًا)، ويكتب لك هنا ما فعله.</p></div></div>
    <form id="devf" data-form="noop" class="card"><label>الطلب</label><textarea name="t" rows="5" required maxlength="4000" placeholder="مثال: أضف في صفحة المؤلف زرًا لتنزيل قائمة كتبه بصيغة Excel"></textarea>
     <div class="row"><div><label>النوع</label><select name="k"><option value="feature">تطوير أو إضافة</option><option value="fix">إصلاح خلل</option><option value="content">محتوى وبيانات</option><option value="ops">مهمة تشغيلية (مفاتيح، مهام آلية، نشر)</option></select></div><div><label>الأولوية</label><select name="p"><option value="2">عادية</option><option value="1">عاجلة</option><option value="3">لاحقًا</option></select></div></div>
     <label class="inl"><input type="checkbox" name="del"> أأذن بالحذف أو ما يمس حسابات الأعضاء إن لزم لهذا الطلب</label><br><button class="btn p">أرسل الطلب</button> <span id="devst" class="mut"></span></form>
    <h3>الطلبات</h3><div id="devl" class="mut">جارٍ التحميل…</div>`);
    $("#devf").addEventListener("submit", async e => { e.preventDefault(); const f = e.target, st = $("#devst"); st.textContent = "جارٍ الحفظ…";
      const it = { id: "d" + Date.now().toString(36), t: f.t.value.trim(), k: f.k.value, p: +f.p.value, del: f.del.checked ? 1 : 0, st: "pending", at: new Date().toISOString() };
      try { await GH.editJSON(P, o => { o = o && o.items ? o : { items: [] }; o.items.push(it); return o; }, "طلب للمساعد التقني: " + it.t.slice(0, 60)); st.textContent = "✓ أُرسل، ويُنفَّذ في الجولة القادمة"; f.reset(); list(); } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
    list();
  }
  async function list() {
    const el = $("#devl"); if (!el) return; const o = await get(), L = (o.items || []).slice().reverse();
    el.innerHTML = L.length ? L.map(x => `<div class="stsec" style="margin:8px 0"><b>${(ST[x.st] || ["", ""])[0]} ${esc((ST[x.st] || ["", x.st])[1])}</b> <span class="mut">${esc(new Date(x.at).toLocaleString("ar-EG"))}${x.p === 1 ? " • عاجل" : ""}</span><p style="white-space:pre-line">${esc(x.t)}</p>${x.r ? `<div class="note" style="white-space:pre-line">${esc(x.r)}</div>` : ""}${x.st === "need" ? `<form data-form="noop" class="devans" data-id="${esc(x.id)}"><input name="a" placeholder="توضيحك" required><button class="btn s p">أرسل التوضيح</button></form>` : ""}${x.st === "pending" ? `<button class="btn s" data-act="devcancel" data-id="${esc(x.id)}">إلغاء</button>` : ""}</div>`).join("") : "<p>لا طلبات بعد.</p>";
    el.querySelectorAll(".devans").forEach(f => f.addEventListener("submit", async e => { e.preventDefault(); const id = f.dataset.id, a = f.a.value.trim();
      await GH.editJSON(P, o => { const x = o.items.find(y => y.id === id); if (x) { x.t += "\n\nتوضيح المدير: " + a; x.st = "pending"; } return o; }, "توضيح طلب للمساعد التقني"); list(); }));
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act=devcancel]"); if (!el) return;
    if (!confirm("إلغاء الطلب؟")) return; await GH.editJSON(P, o => { o.items = o.items.filter(x => x.id !== el.dataset.id); return o; }, "إلغاء طلب للمساعد التقني"); list(); });
  // لوحة التشغيل (#/ops): حالة كل مهمة آلية (آخر تشغيل من GitHub Actions)، والمفاتيح، وطابور التحويل والتدقيق، والنشر
  async function ops() {
    if (!(Cloud.role === "admin" || GH.token)) return view('<div class="note">لوحة التشغيل للمدير.</div>');
    view(`<div class="cmhero"><div><h2>لوحة التشغيل</h2><p>حالة المهام الآلية والمفاتيح وطابور الكتب في مكان واحد. تُحدَّث عند فتح الصفحة.</p></div></div>
      <div class="row"><a class="btn s" href="#/admin">الخدمات والمفاتيح (الإيقاف والتشغيل)</a><a class="btn s" href="https://github.com/${esc(CFG.repo || "dawah-library/sdsl-library")}/actions" target="_blank" rel="noopener">صفحة المهام في GitHub</a><button class="btn s" data-act="opsre">تحديث</button></div>
      <div class="stgrid" id="opsk"><p class="mut">…</p></div><h3>المهام الآلية</h3><div id="opsw" class="mut">جارٍ التحميل…</div>`);
    const J = u => fetch(u + (u.includes("?") ? "&" : "?") + "fresh=" + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null), repo = CFG.repo || "dawah-library/sdsl-library", ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 60 ? toAr(m) + " د" : m < 2880 ? toAr(Math.round(m / 60)) + " س" : toAr(Math.round(m / 1440)) + " يوم"; };
    const [K, PR, CU, DB] = await Promise.all([J("data/keys-status.json"), J("data/progress.json"), J("data/cf-usage.json"), J("data/db-backups.json")]);
    const kk = (K && K.keys) || [], ok = kk.filter(k => k.status === "ok").length, tts = Object.entries((K && K.tts) || {}), bk = Object.values((PR && PR.books) || {}).filter(b => b.pct < 100);
    const tile = (n, t, s, bad) => `<div class="sttile${bad ? " bad" : ""}"><b>${n}</b><span>${t}</span>${s ? `<small>${s}</small>` : ""}</div>`;
    const el = $("#opsk"); if (el) el.innerHTML = tile(toAr(ok) + "/" + toAr(kk.length), "مفاتيح Gemini تعمل", K && K.at ? "فُحصت منذ " + ago(K.at.replace("Z", ":00Z")) : "", ok < kk.length)
      + tile(toAr(tts.filter(([, v]) => /^ok/.test(v)).length) + "/" + toAr(tts.length), "نماذج الصوت متاحة", tts.map(([k, v]) => k.replace("gemini-", "") + (/^ok/.test(v) ? " ✓" : " ✗")).join("، "))
      + tile(toAr((PR && PR.pending_pages) || 0), "صفحة تنتظر التدقيق", PR ? "حتى " + esc(PR.upd) + " • " + toAr(bk.length) + " كتابًا قيد التجهيز" : "")
      + tile(CU && CU.last_deploys && CU.last_deploys[0] ? (CU.last_deploys[0].status === "success" ? "✓" : "✗") : "—", "آخر نشر على Cloudflare", CU && CU.last_deploys && CU.last_deploys[0] ? "منذ " + ago(CU.last_deploys[0].at) : "", CU && CU.last_deploys && CU.last_deploys[0] && CU.last_deploys[0].status !== "success")
      + (() => { const L = DB && DB.items && DB.items[DB.items.length - 1]; return tile(L ? "✓" : "—", "آخر نسخة احتياطية للقاعدة", L ? esc(L.d) + " • " + toAr(L.rows) + " صفًّا في " + toAr(L.tables) + " جدولًا" : "أسبوعيًّا كل جمعة (لم تُنشأ بعد)", L && (Date.now() - new Date(L.d)) > 9 * 864e5); })()
      + (kk.length && ok < kk.length ? `<p class="note" style="grid-column:1/-1">${(() => { const q = kk.filter(k => k.status === "quota"), o = kk.filter(k => k.status !== "ok" && k.status !== "quota"); return (q.length ? "نفدت حصة اليوم في " + toAr(q.length) + " مفتاحًا (تعود تلقائيًّا في اليوم التالي): " + q.map(k => esc(k.name.replace("GEMINI_API_KEY", "مفتاح"))).join("، ") + ". " : "") + (o.length ? "مفاتيح فيها خلل تحتاج استبدالًا: " + o.map(k => esc(k.name) + " (" + esc(k.status) + ")").join("، ") : ""); })()}</p>` : "");
    const [W, R] = await Promise.all([J(`https://api.github.com/repos/${repo}/actions/workflows?per_page=100`), J(`https://api.github.com/repos/${repo}/actions/runs?per_page=100`)]), w = $("#opsw"); if (!w) return;
    if (!W || !R) { w.innerHTML = '<p class="note">تعذّر الوصول إلى GitHub الآن (حد الطلبات للزوار ٦٠ في الساعة). افتح صفحة المهام في GitHub.</p>'; return; }
    const last = {}; (R.workflow_runs || []).forEach(r => { if (!last[r.workflow_id]) last[r.workflow_id] = r; });
    const rows = (W.workflows || []).filter(x => x.state === "active").map(x => ({ x, r: last[x.id] })), rank = o => !o.r ? 3 : o.r.status !== "completed" ? 1 : o.r.conclusion === "failure" ? 0 : 2;
    rows.sort((a, b) => rank(a) - rank(b) || (b.r ? new Date(b.r.updated_at) : 0) - (a.r ? new Date(a.r.updated_at) : 0));
    const fail = rows.filter(o => rank(o) === 0).length, run = rows.filter(o => rank(o) === 1).length;
    w.innerHTML = `<p class="mut">${toAr(rows.length)} مهمة • تعمل الآن ${toAr(run)} • متعثرة في آخر تشغيل ${toAr(fail)}</p><div class="sttab"><table><thead><tr><th>المهمة</th><th>آخر تشغيل</th><th>الحالة</th></tr></thead><tbody>${rows.map(({ x, r }) => { const st = !r ? ["—", "mut"] : r.status !== "completed" ? ["⏳ يعمل", "gr-h"] : r.conclusion === "success" ? ["✓ نجح", "gr-s"] : r.conclusion === "failure" ? ["✗ تعثّر", "gr-x"] : [esc(r.conclusion || ""), "gr-d"];
      return `<tr><td>${esc(x.name)}</td><td>${r ? "منذ " + ago(r.updated_at) : "<span class=mut>لم يعمل مؤخرًا</span>"}</td><td>${r ? `<a class="grb ${st[1]}" href="${esc(r.html_url)}" target="_blank" rel="noopener">${st[0]}</a>` : st[0]}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="mut">«لم يعمل مؤخرًا» يعني أنه ليس بين آخر ١٠٠ تشغيل. حارس المهام يعيد تشغيل المتأخر تلقائيًّا، والصيانة المجدولة تُصلح المتعثر وتنبّه الإدارة.</p>`;
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-act=opsre]")) ops(); });
  return { view: page, ops };
})();
