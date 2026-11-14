/* المساعد التقني (#/dev، للمدير): يكتب المدير طلب التطوير أو التعديل أو الإصلاح بلغته (إضافة قسم، تعديل واجهة، صنع أداة أو مفتاح،
   إصلاح خلل، تشغيل مهمة)، فيُحفظ في data/dev-requests.json. وجلسة Claude Code مجدولة (مرتين يوميًا) تقرأ الطلبات المعلّقة،
   فتنفّذها في المستودع وخدمات التشغيل (GitHub وVercel وSupabase) وفق قواعد HANDOFF.md، ثم تكتب ما فعلته في الطلب نفسه.
   لا يُنفَّذ الحذف ولا ما يمس حسابات الأعضاء إلا بإذن صريح في نص الطلب. */
const DEV = (() => {
  const PASTED = [];  // صور لُصقت في مربع الطلب
  const P = "data/dev-requests.json", ST = { pending: ["⏳", "بانتظار التنفيذ"], doing: ["⚙️", "قيد التنفيذ"], done: ["✅", "نُفِّذ"], need: ["❓", "يحتاج توضيحًا"], rejected: ["⛔", "لم يُنفَّذ"], review: ["🔍", "نُفّذ وينتظر اعتمادك"], approved: ["🚀", "معتمد، جارٍ النشر"] };
  const ENG = { auto: "تلقائي (Claude ثم Gemini)", claude: "Claude", gemini: "Gemini", session: "جلسة Claude المجدولة" };
  const get = async () => { try { return JSON.parse((await GH.get(P)).text) || { items: [] }; } catch (e) { return { items: [] }; } };
  // قوالب طلبات شائعة تُملأ في المربع ثم يكمّلها المدير
  const TPL = [["إصلاح خلل", "في صفحة: …\nالمشكلة: …\nالمتوقع: …"], ["قسم أو خدمة جديدة", "أضف قسمًا/خدمة: …\nمكانه في الموقع: …\nمن يراه: الزوار / الأعضاء / المدير"], ["استيراد كتاب", "استورد كتاب «…» لـ … (من تراث أو جامع الكتب أو OpenITI)، الطبعة المفضلة: …"], ["تدقيق كتاب", "دقّق كتاب «…» على مصورته وطبّق التصحيحات القطعية"], ["تعديل نص أو بيانات", "في كتاب/مقال «…» الصفحة …: غيّر «…» إلى «…»"], ["تقرير أو إحصاء", "أريد تقريرًا عن: …"]];
  // آخر صفحة كان فيها المدير قبل فتح المساعد (يُتتبع الحاليّ والسابق لأن الموجّه قد يرسم الصفحة قبل هذا المستمع)
  const here = () => (typeof HERE === "function" ? HERE() : location.hash) || "";
  let CUR = here(), PREV = "";
  const lastPage = () => (CUR && !/^#\/(dev|ops)/.test(CUR) ? CUR : PREV) || "";
  const track = () => { const h = here(); if (h === CUR) return; if (!/^#\/(dev|ops)/.test(CUR)) PREV = CUR; CUR = h; };
  // الموقع يستعمل روابط بلا «#» (pushState)، فيُتتبع الانتقال من الموجّه نفسه
  setTimeout(() => { if (typeof route === "function" && !route.__dev) { const _r = route; window.route = route = function () { track(); return _r.apply(this, arguments); }; route.__dev = 1; } }, 0);
  window.addEventListener("popstate", track);
  // الطلبات المنجزة أو التي تنتظر جواب المدير ولم يرها بعد: تظهر شارة في الشريط الجانبي
  async function badge() { if (!(Cloud.role === "admin" || GH.token)) return; try { const o = await fetch("data/dev-requests.json?fresh=" + Date.now()).then(r => r.json()); let seen = {}; try { seen = JSON.parse(localStorage.getItem("dev_seen") || "{}"); } catch (e) { }
      const n = (o.items || []).filter(x => /^(done|need|rejected)$/.test(x.st) && seen[x.id] !== x.st).length, a = document.querySelector('#side a[href="#/dev"]'); if (a) { let b = a.querySelector(".devb"); if (!b) { b = document.createElement("em"); b.className = "devb"; a.appendChild(b); } b.textContent = n ? toAr(n) : ""; b.hidden = !n; } } catch (e) { } }
  setTimeout(badge, 4000);
  async function page(q) {
    if (!(Cloud.role === "admin" || GH.token)) return view('<div class="note">المساعد التقني للمدير.</div>');
    view(`<div class="cmhero"><div><h2>المساعد التقني</h2><p>اكتب ما تريد تطويره أو تعديله أو إصلاحه في الموقع، كما تكتبه لمبرمج. ينفّذه الوكيل البرمجي فور إرساله في فرع مستقل، ويعرض عليك النتيجة ورابط التعديلات، فلا يُنشر إلا باعتمادك. ويمكنك متابعة أي طلب بتعليمات إضافية كالمحادثة مع المبرمج. وللتشغيل الفوري لأي مهمة آلية: <a href="#/ops">لوحة التشغيل</a>.</p></div></div>
    <div class="chips devtpl">${TPL.map(([n, t]) => `<button class="chip" data-act="devtpl" data-t="${esc(t)}">${esc(n)}</button>`).join("")}</div>
    <form id="devf" data-form="noop" class="card"><label>الطلب</label><textarea name="t" rows="5" required maxlength="4000" placeholder="مثال: أضف في صفحة المؤلف زرًا لتنزيل قائمة كتبه بصيغة Excel"></textarea>
     <div class="row"><div><label>النوع</label><select name="k"><option value="feature">تطوير أو إضافة</option><option value="fix">إصلاح خلل</option><option value="content">محتوى وبيانات</option><option value="ops">مهمة تشغيلية (مفاتيح، مهام آلية، نشر)</option></select></div><div><label>الأولوية</label><select name="p"><option value="2">عادية</option><option value="1">عاجلة</option><option value="3">لاحقًا</option></select></div><div><label>المنفّذ</label><select name="e">${Object.entries(ENG).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
     <label>الصفحة المعنية (اختياري)</label><input name="u" dir="ltr" value="${esc(lastPage())}" placeholder="#/book/…">
     <label>صور توضيحية (لقطات شاشة أو تصميمات؛ اختياري، ويمكن اللصق في مربع الطلب)</label><input type="file" name="img" multiple accept="image/*"><div id="devimgs" class="axatt"></div>
     <label class="inl"><input type="checkbox" name="auto"> انشر مباشرة إن اجتاز الفحص الآلي (للتعديلات الصغيرة فقط)</label><br>
     <label class="inl"><input type="checkbox" name="del"> أأذن بالحذف أو ما يمس حسابات الأعضاء إن لزم لهذا الطلب</label><br><button class="btn p">أرسل الطلب</button> <span id="devst" class="mut"></span></form>
    <details class="card" id="devbr"><summary><b>تقارير جولات المساعد</b></summary><div class="mut">…</div></details>
    <div id="devag" class="mut"></div><h3>الطلبات</h3><div id="devl" class="mut">جارٍ التحميل…</div>`);
    fetch("data/dev-agent.json?fresh=" + Date.now()).then(r => r.ok ? r.json() : null).then(a => { const el = $("#devag"); if (!el || !a) return; const e = a.engines || {}, L = (a.runs || [])[0];
      el.innerHTML = `<p class="note">محركات الوكيل: Claude ${e.claude ? "✓" : "✗ (يلزم سر CLAUDE_CODE_OAUTH_TOKEN)"} • Gemini ${e.gemini ? "✓ " + toAr(e.gemini) + " مفتاحًا" : "✗"}${L ? " • آخر تشغيل: " + esc(new Date(L.at).toLocaleString("ar-EG")) + (L.ok ? " ✓" : " ✗") : ""}</p>`; }).catch(() => { });
    fetch("data/dev-brief.json?fresh=" + Date.now()).then(r => r.ok ? r.json() : null).then(o => { const el = $("#devbr div"); if (!el) return; const L = ((o && (o.items || o)) || []); const A = Array.isArray(L) ? L.slice(-10).reverse() : [];
      el.innerHTML = A.length ? A.map(x => `<p><b>${esc(x.at || "")}</b><br>${(x.done || []).map(esc).join("<br>")}${(x.issues || []).length ? `<br><span class="mut">ملاحظات: ${(x.issues || []).map(esc).join("، ")}</span>` : ""}</p>`).join("") : "لم تُكتب تقارير بعد؛ تُكتب بعد كل جولة."; }).catch(() => { });
    $("#devf [name=t]").addEventListener("paste", e => { const fs = [...((e.clipboardData || {}).files || [])].filter(x => /^image\//.test(x.type)); if (!fs.length) return; e.preventDefault(); PASTED.push(...fs); $("#devimgs").innerHTML = PASTED.map(x => `<span class="axchip">🖼 ${esc(x.name || "صورة")}</span>`).join(""); });
    $("#devf").addEventListener("submit", async e => { e.preventDefault(); const f = e.target, st = $("#devst"); st.textContent = "جارٍ الحفظ…";
      const it = { id: "d" + Date.now().toString(36), t: f.t.value.trim() + (f.u.value.trim() ? "\n\nالصفحة: " + f.u.value.trim() : ""), k: f.k.value, p: +f.p.value, del: f.del.checked ? 1 : 0, st: "pending", at: new Date().toISOString(), eng: f.e.value, auto: f.auto.checked ? 1 : 0, by: "admin", h: [{ at: new Date().toISOString(), by: "admin", m: f.t.value.trim() }] };
      try { const imgs = [...(f.img.files || [])].concat(PASTED.splice(0)).slice(0, 6);
        for (let i = 0; i < imgs.length; i++) { st.textContent = "يرفع الصورة " + toAr(i + 1) + "…"; const ext = (imgs[i].type.split("/")[1] || "png").replace("jpeg", "jpg"), path = "data/dev-att/" + it.id + "-" + (i + 1) + "." + ext;
          await GH.put(path, new Uint8Array(await imgs[i].arrayBuffer()), "المساعد التقني: صورة مرفقة", null); (it.img = it.img || []).push(path); }
        if (it.img) it.t += "\n\nصور مرفقة من المدير (اقرأها وحلّلها قبل التنفيذ): " + it.img.join("، ");
        await GH.editJSON(P, o => { o = o && o.items ? o : { items: [] }; o.items.push(it); return o; }, "طلب للمساعد التقني: " + it.t.slice(0, 60)); $("#devimgs").innerHTML = ""; st.textContent = "✓ أُرسل، ويبدأ تنفيذه خلال دقائق"; f.reset(); list(); } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
    list();
  }
  async function list() {
    const el = $("#devl"); if (!el) return; const o = await get(), L = (o.items || []).slice().reverse();
    try { const seen = {}; (o.items || []).forEach(x => seen[x.id] = x.st); localStorage.setItem("dev_seen", JSON.stringify(seen)); } catch (e) { } setTimeout(badge, 300);
    el.innerHTML = L.length ? L.map(x => `<div class="stsec" style="margin:8px 0"><b>${(ST[x.st] || ["", ""])[0]} ${esc((ST[x.st] || ["", x.st])[1])}</b> <span class="mut">${esc(new Date(x.at).toLocaleString("ar-EG"))}${x.p === 1 ? " • عاجل" : ""}</span><p style="white-space:pre-line">${esc(x.t)}</p>${x.eng ? ` <span class="tag">${esc(ENG[x.eng] || x.eng)}</span>` : ""}${x.r ? `<div class="note" style="white-space:pre-line">${esc(x.r)}</div>` : ""}${x.files ? `<p class="mut">الملفات: ${esc(x.files)}</p>` : ""}<p>${x.diff ? `<a class="btn s" href="${esc(x.diff)}" target="_blank" rel="noopener">عرض التعديلات</a> ` : ""}${x.pr ? `<a class="btn s" href="${esc(x.pr)}" target="_blank" rel="noopener">طلب الدمج</a> ` : ""}${x.run ? `<a class="btn s" href="${esc(x.run)}" target="_blank" rel="noopener">سجل التنفيذ</a>` : ""}</p>${(x.h || []).length > 1 ? `<details><summary>المحادثة (${toAr(x.h.length)})</summary>${x.h.map(h => `<p style="white-space:pre-line"><b>${h.by === "admin" ? "المدير" : "الوكيل"}</b> <span class="mut">${esc(new Date(h.at).toLocaleString("ar-EG"))}</span><br>${esc(h.m)}</p>`).join("")}</details>` : ""}${x.st === "review" ? `<div class="row"><button class="btn s p" data-act="devok" data-id="${esc(x.id)}">✓ اعتماد ونشر</button><button class="btn s danger" data-act="devno" data-id="${esc(x.id)}">رفض</button></div>` : ""}${/^(review|done|rejected)$/.test(x.st) && !x.closed ? `<form data-form="noop" class="devans" data-id="${esc(x.id)}"><input name="a" placeholder="تعديل أو متابعة على هذا الطلب…" required><button class="btn s">أرسل للوكيل</button></form>` : ""}${x.st === "need" ? `<form data-form="noop" class="devans" data-id="${esc(x.id)}"><input name="a" placeholder="توضيحك" required><button class="btn s p">أرسل التوضيح</button></form>` : ""}${x.st === "pending" ? `<button class="btn s" data-act="devcancel" data-id="${esc(x.id)}">إلغاء</button>` : ""}</div>`).join("") : "<p>لا طلبات بعد.</p>";
    el.querySelectorAll(".devans").forEach(f => f.addEventListener("submit", async e => { e.preventDefault(); const id = f.dataset.id, a = f.a.value.trim();
      await GH.editJSON(P, o => { const x = o.items.find(y => y.id === id); if (x) { x.t += "\n\nمتابعة المدير: " + a; x.st = "pending"; (x.h = x.h || []).push({ at: new Date().toISOString(), by: "admin", m: a }); } return o; }, "متابعة طلب للمساعد التقني"); list(); }));
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act=devok],[data-act=devno]"); if (!el) return; const ok = el.dataset.act === "devok";
    if (!confirm(ok ? "اعتماد التعديل ونشره على الموقع؟" : "رفض التعديل وحذف فرعه؟")) return; el.disabled = true;
    await GH.editJSON(P, o => { const x = o.items.find(y => y.id === el.dataset.id); if (x) { x.st = ok ? "approved" : "rejected"; (x.h = x.h || []).push({ at: new Date().toISOString(), by: "admin", m: ok ? "اعتمدتُ التعديل." : "رفضتُ التعديل." }); } return o; }, (ok ? "اعتماد" : "رفض") + " طلب للمساعد التقني"); list(); });
  document.addEventListener("click", e => { const el = e.target.closest("[data-act=devtpl]"); if (!el) return; const f = $("#devf"); if (f) { f.t.value = el.dataset.t; f.t.focus(); } });
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
    w.innerHTML = `<p class="mut">${toAr(rows.length)} مهمة • تعمل الآن ${toAr(run)} • متعثرة في آخر تشغيل ${toAr(fail)}</p><div class="sttab"><table><thead><tr><th>المهمة</th><th>آخر تشغيل</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(({ x, r }) => { const st = !r ? ["—", "mut"] : r.status !== "completed" ? ["⏳ يعمل", "gr-h"] : r.conclusion === "success" ? ["✓ نجح", "gr-s"] : r.conclusion === "failure" ? ["✗ تعثّر", "gr-x"] : [esc(r.conclusion || ""), "gr-d"];
      return `<tr><td>${esc(x.name)}</td><td>${r ? "منذ " + ago(r.updated_at) : "<span class=mut>لم يعمل مؤخرًا</span>"}</td><td>${r ? `<a class="grb ${st[1]}" href="${esc(r.html_url)}" target="_blank" rel="noopener">${st[0]}</a>` : st[0]}</td><td><button class="btn s" data-act="opsrun" data-w="${esc(String(x.path).split("/").pop())}" data-n="${esc(x.name)}" title="تشغيل الآن">▶</button></td></tr>`; }).join("")}</tbody></table></div>
      <p class="mut">«لم يعمل مؤخرًا» يعني أنه ليس بين آخر ١٠٠ تشغيل. حارس المهام يعيد تشغيل المتأخر تلقائيًّا، والصيانة المجدولة تُصلح المتعثر وتنبّه الإدارة.</p>`;
  }
  // تشغيل مهمة الآن: طلب في data/run-requests.json تنفذه مهمة run-requests.yml خلال دقيقة
  async function runNow(w, n) { if (!confirm("تشغيل «" + n + "» الآن؟")) return;
    try { await GH.editJSON("data/run-requests.json", o => { o = o && o.items ? o : { items: [] }; o.items.push({ w, at: new Date().toISOString(), by: (Auth.user && Auth.user.name) || "المدير" }); return o; }, "تشغيل مهمة: " + n); toast("أُرسل الطلب؛ تبدأ المهمة خلال دقيقة تقريبًا"); }
    catch (e) { toast("تعذّر: " + (e.message || e)); } }
  document.addEventListener("click", e => { if (e.target.closest("[data-act=opsre]")) ops(); const r = e.target.closest("[data-act=opsrun]"); if (r) runNow(r.dataset.w, r.dataset.n); });
  return { view: page, ops, badge };
})();
