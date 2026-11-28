/* واجهة الطلائع الجديدة (طلب المدير، ٢٧ نوفمبر — البند ١٦؛ التصميم في docs/tala-design-proposal.html).
   أول دخول: اختيار المرحلة ببطاقات كبيرة (الاسم والصورة اختياريان من ملف الطفل في tala.js).
   الرئيسية: «القادم لك» (الدرس التالي في المنهج المرتب: الأساس ١–٢ ← ٣–٦ ← البنيان ← البداية، مع نسبة الإتمام)، وأزرار كبيرة بأيقونات لكل أنشطة القسم،
   و«سؤال اليوم» من الأسئلة المعتمدة المصنفة بالسن والباب والصعوبة (tools/tala-audit.py ← data/tala-home.json)، وتقدم الأسبوع بأقوى الأبواب وأضعفها.
   لا يُحذف شيء: الصفحة الكاملة القديمة في «كل محتوى القسم» (#/talaea?all=1). التقدم في S.talaH ويُزامَن مع الحساب (Prefs). */
const TLH = (() => {
  const STG = [["t1", "المستكشفون الصغار", "٥–٨ سنوات • الأساس ١–٢", "🧸", "a1"], ["t2", "براعم المعرفة", "٩–١٢ سنة • الأساس ٣–٦", "🌱", "a2"], ["t3", "رواد العلم", "١٢–١٥ سنة • البنيان", "🧭", "a3"], ["t4", "الناشئة", "١٥–٢٠ سنة • البداية", "🎓", "a4"]];
  const SERIES = { asas: "الأساس", bunyan: "البنيان", bidaya: "البداية" };
  let H = null; const data = async () => H || (H = await fetch("data/tala-home.json").then(r => r.ok ? r.json() : null).catch(() => null) || { pool: {}, lessons: {}, sub: {} });
  const st = () => { const s = (S.talaH = S.talaH || {}); s.done = s.done || {}; s.log = s.log || []; return s; };
  const save = () => { saveS(); try { Prefs.push(); } catch (e) { } };
  const day = () => today();
  const hash = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  function stageOf(ctx) { const k = ctx.kid && ctx.kid(); return (k && k.track) || st().stage || null; }
  function stagePick(ctx) {
    return ctx.view_(ctx.head("اختر مرحلتك") + `<section class="tlh"><div class="tlhtop"><div class="tlhav">🌟</div><div><b>أهلًا بك في الطلائع</b><small>اختر مرحلتك لنجهّز لك ما يناسبك</small></div></div>
      <div class="tlhages">${STG.map(([k, n, a, i, c]) => `<button class="tlhage ${c}" data-tlh="stage" data-k="${k}"><i aria-hidden="true">${i}</i><b>${n}</b><small>${a}</small></button>`).join("")}</div>
      <p class="mut">يمكن تغيير المرحلة في أي وقت. الاسم والصورة والقسم (بنين/بنات) اختيارية من <a href="#/talaea?all=1">صفحة القسم</a>، ولولي الأمر <a href="#/talaea/parents">ركن الوالدين</a>.</p></section></div>`);
  }
  // الدرس التالي: أول درس لم يُعلَّم منتهيًا في منهج المرحلة
  function nextLesson(D, k) {
    const L = (D.lessons || {})[k] || [], dn = st().done[k] || [], i = L.findIndex(x => !dn.includes(x.b + ":" + x.p));
    return { L, i, x: i >= 0 ? L[i] : null, pct: L.length ? Math.round(100 * dn.filter(d => L.some(x => x.b + ":" + x.p === d)).length / L.length) : 0 };
  }
  // سؤال اليوم: ثابت لليوم، لا يتكرر ما أُجيب عنه، ويقدّم الباب الأضعف أحيانًا
  function todayQ(D, k) {
    const P = (D.pool || {})[k] || [], s = st(), seen = new Set(s.log.map(x => x.q));
    if (!P.length) return null;
    if (s.qd && s.qd.d === day() && s.qd.k === k) { const f = P.find(x => x.q === s.qd.q); if (f) return f; } const fresh = P.filter(x => !seen.has(x.q)), A = fresh.length ? fresh : P;
    const weak = weakest(D); const W = weak ? A.filter(x => x.s === weak) : [];
    const src = W.length && hash(day()) % 3 === 0 ? W : A, pick = src[hash(day() + k) % src.length];
    s.qd = { d: day(), k, q: pick.q }; return pick;
  }
  function stats(D) {
    const w = Date.now() - 7 * 864e5, L = st().log.filter(x => new Date(x.at).getTime() >= w), by = {};
    L.forEach(x => { const b = by[x.s] = by[x.s] || [0, 0]; b[1]++; if (x.ok) b[0]++; }); return { n: L.length, ok: L.filter(x => x.ok).length, by };
  }
  function weakest(D) { const b = stats(D).by, ks = Object.keys(b).filter(k => b[k][1] >= 2); return ks.sort((x, y) => b[x][0] / b[x][1] - b[y][0] / b[y][1])[0] || null; }
  const answered = q => st().log.find(x => x.q === q.q && x.at.slice(0, 10) === day());

  async function home(q, ctx) {
    const D = await data(), k = q.k && STG.some(s => s[0] === q.k) ? q.k : stageOf(ctx);
    if (!k || q.stage) return stagePick(ctx);
    const S0 = STG.find(s => s[0] === k), kd = ctx.kid && ctx.kid(), nl = nextLesson(D, k), Q = todayQ(D, k), sts = stats(D), SN = D.sub || {};
    const best = Object.keys(sts.by).sort((x, y) => sts.by[y][0] / sts.by[y][1] - sts.by[x][0] / sts.by[x][1])[0], weak = weakest(D);
    // ١٥–٢٠: «القادم لك» من منهج البداية (الدروس المعتمدة، والمسودات للمشرفين)
    let bdNext = null; if (k === "t4") { const plan = await getB("plan.json"), idx = (await getB("index.json")) || { lessons: {} }, dn4 = st().done.t4 || [];
      const MG = await getB("merge.json"), DP = (MG && MG.dup) || {}, OFF = (MG && MG.official) || [], o1 = OFF.find(o => !dn4.includes("bdo:" + o.b + ":" + o.p));
      if (o1) bdNext = { off: o1, n: OFF.length, d: OFF.filter(o => dn4.includes("bdo:" + o.b + ":" + o.p)).length, v: OFF.length };
      else if (plan) { const all = plan.parts.flatMap(p => p.lessons.map(l => Object.assign({ pt: p.t }, l))).filter(x => !DP[x.id]), vis = all.filter(x => (idx.lessons[x.id] || {}).st === "ok" || (staff() && idx.lessons[x.id]));
        bdNext = { x: vis.find(x => !dn4.includes("bd:" + x.id)), n: all.length, d: all.filter(x => dn4.includes("bd:" + x.id)).length, v: vis.length }; } }
    const next = bdNext && bdNext.off ? `<div class="tlhnext"><small>القادم لك في كتاب «البداية»</small><h3>${esc(bdNext.off.l)}</h3><div class="bar"><i style="width:${Math.round(100 * bdNext.d / Math.max(1, bdNext.n))}%"></i></div><small>أتممت ${toAr(bdNext.d)} من ${toAr(bdNext.n)} درسًا</small>
        <div class="row"><a class="btn" href="#/book/${esc(bdNext.off.b)}/${bdNext.off.p || 1}">▶ ادرس الدرس</a><button class="btn s" data-tlh="done" data-k="t4" data-id="${esc("bdo:" + bdNext.off.b + ":" + bdNext.off.p)}">✓ أتممته</button><a class="btn s" href="#/talaea/bidaya">📗 الفهرس</a></div></div>` : bdNext ? `<div class="tlhnext"><small>القادم لك في «البداية»${bdNext.x ? " — " + esc(bdNext.x.pt) : ""}</small><h3>${bdNext.x ? esc(bdNext.x.t) : bdNext.v ? "أتممت المتاح من البداية! 🎉" : "منهج البداية قيد الإعداد"}</h3><div class="bar"><i style="width:${Math.round(100 * bdNext.d / Math.max(1, bdNext.n))}%"></i></div><small>أتممت ${toAr(bdNext.d)} من ${toAr(bdNext.n)} درسًا</small>
        <div class="row">${bdNext.x ? `<a class="btn" href="#/talaea/bidaya?l=${bdNext.x.id}">▶ ادرس الدرس</a>` : ""}<a class="btn s" href="#/talaea/bidaya">📗 فهرس البداية</a></div></div>` : nl.x ? `<div class="tlhnext"><small>القادم لك في «${SERIES[nl.x.s] || nl.x.s}» ${nl.x.s === "asas" ? "المستوى " + toAr(nl.x.v) : "الجزء " + toAr(nl.x.v)}</small><h3>${esc(nl.x.l)}</h3><div class="bar"><i style="width:${nl.pct}%"></i></div><small>أتممت ${toAr(nl.pct)}٪ من منهج مرحلتك (${toAr(nl.i)} من ${toAr(nl.L.length)} درسًا)</small>
        <div class="row"><a class="btn" href="#/book/${esc(nl.x.b)}/${nl.x.p}">▶ ادرس الدرس</a><button class="btn s" data-tlh="done" data-k="${k}" data-id="${esc(nl.x.b + ":" + nl.x.p)}">✓ أتممته</button></div></div>`
      : `<div class="tlhnext"><small>القادم لك</small><h3>${nl.L.length ? "أتممت منهج مرحلتك! 🎉" : "سُلّم القراءة لمرحلتك"}</h3><p>${nl.L.length ? "تابع القراءة من سُلّم مرحلتك، أو انتقل إلى المرحلة التالية." : "تمارين «البداية» قيد الإعداد؛ ابدأ بقراءات مرحلتك المختارة."}</p><a class="btn" href="#/talaea/ladder?k=${k}">📚 سُلّم القراءة</a></div>`;
    const T = [["📖", "درسي", k === "t4" ? "#/talaea/bidaya" : `#/talaea/manhaj?k=${k}`], ["❓", "سؤال اليوم", "#tlhq", Q && !answered(Q) ? "جديد" : ""], ["📚", "قصص", "#/talaea/qasas"], ["🎮", "ألعاب", "#/talaea/games?g=quiz&k=" + k], ["🎬", "مقاطع", "#/talaea/video"], ["🧩", "ألغاز", "#/talaea/games?g=lughz&k=" + k],
      ["✅", "صح أم خطأ", "#/talaea/games?g=tf"], ["📿", "أذكاري", "#/talaea/games?g=adhkar"], ["📚", "سُلّم القراءة", `#/talaea/ladder?k=${k}`], ["🛤️", "مساري", `#/talaea/track?k=${k}`], ["👨‍👩‍👧", "للوالدين", "#/talaea/parents"], ["🗂️", "كل محتوى القسم", "#/talaea?all=1"]];
    const path = (D.lessons || {})[k] || [], groups = [...new Map(path.map(x => [x.s + x.v, x])).values()], dn = st().done[k] || [];
    const pathHtml = groups.length ? `<h4>مساري في المنهج</h4><div class="tlhpath">${groups.map(g => { const L = path.filter(x => x.s === g.s && x.v === g.v), d = L.filter(x => dn.includes(x.b + ":" + x.p)).length, cur = nl.x && nl.x.s === g.s && nl.x.v === g.v;
      return `<div class="tlhstep${d === L.length ? " done" : cur ? " now" : ""}"><div class="c">${d === L.length ? "✓" : cur ? "📘" : "🔒"}</div>${SERIES[g.s] || g.s} ${toAr(g.v)}<small>${toAr(d)}/${toAr(L.length)}</small></div>`; }).join("")}</div>` : "";
    const qHtml = Q ? qCard(Q, k, SN) : '<p class="mut">تُضاف أسئلة مرحلتك قريبًا.</p>';
    ctx.view_(ctx.head(S0[1]) + `<section class="tlh"><div class="tlhtop"><div class="tlhav">${kd && kd.av ? esc(kd.av) : S0[3]}</div><div><b>أهلًا${kd && kd.name ? " يا " + esc(kd.name) : " بك"}</b><small>${S0[1]} • ${S0[2].split(" • ")[0]}</small></div>
        ${kd ? "" : `<button class="lnk" data-tlh="change">تغيير المرحلة</button>`}</div>
      ${next}
      <div class="tlhgrid">${T.map(([i, n, h, dot]) => `<a class="tlhtile" href="${h}"><i aria-hidden="true">${i}</i>${n}${dot ? `<span class="dot">${dot}</span>` : ""}</a>`).join("")}</div>
      ${pathHtml}
      <h4 id="tlhq">سؤال اليوم</h4><div id="tlhqb">${qHtml}</div>
      <h4>تقدمك هذا الأسبوع</h4><p class="mut">${sts.n ? `${toAr(sts.n)} سؤالًا • ${toAr(sts.ok)} صحيحة${best ? ` • أقوى أبوابك «${esc(SN[best] || best)}»` : ""}${weak && weak !== best ? `، ونقترح أن تراجع «${esc(SN[weak] || weak)}»` : ""}.` : "أجب عن سؤال اليوم ليبدأ سجل تقدمك."}</p>
      </section></div>`);
  }
  function qCard(Q, k, SN) {
    const a = answered(Q), opts = Q.k === "tf" ? [["true", "✓ صح"], ["false", "✗ خطأ"]] : (Q.o || []).map((o, i) => [String(i), o]);
    const right = Q.k === "tf" ? String(!!Q.a) : String(Q.a), DF = { 1: "سهل", 2: "متوسط", 3: "متقدم" };
    return `<div class="tlhq" data-k="${k}"><span class="tag">${esc(SN[Q.s] || "")} • ${DF[Q.d] || ""}${Q.l ? " • " + esc(Q.l) : ""}</span><p>${esc(Q.q)}</p>
      ${opts.map(([v, t]) => `<button class="tlhopt${a ? (v === right ? " ok" : v === a.v ? " no" : "") : ""}" data-tlh="ans" data-v="${esc(v)}"${a ? " disabled" : ""}>${esc(t)}</button>`).join("")}
      ${a ? `<p class="${a.ok ? "okm" : "nom"}">${a.ok ? "أحسنت! ⭐" : "ليست هذه؛ والصواب ما ظُلِّل بالأخضر."}</p>${Q.w ? `<p class="mut">لماذا؟ ${esc(Q.w)}</p>` : ""}${Q.b ? `<a class="lnk" href="#/book/${esc(Q.b)}/${Q.p}">موضعه من الدرس ←</a>` : Q.src ? `<a class="lnk" href="${esc(Q.src)}">من «${esc(Q.st || "المصدر")}» ←</a>` : ""}` : ""}</div>`;
  }
  /* ===== «البداية» (١٥–٢٠ سنة): منهج من نصوص المكتبة (tools/bidaya.py ← data/bidaya) — المسودات للمشرفين، والمعتمد (st=ok) للجميع ===== */
  const RAWB = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/bidaya/" + p;
  const getB = async p => { for (const u of [RAWB(p) + "?t=" + Math.floor(Date.now() / 300e3), "data/bidaya/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const staff = () => typeof isAdmin === "function" && isAdmin();
  const cite = (t, L) => esc(t || "").replace(/\[\[([^\]]+)\]\]/g, (m, r) => { const s_ = (L.src || []).find(x => x.ref === r); const [id, pg] = r.split(":"); return /^(q|tf|arbain)$/.test(id) ? `<sup class="bdc" title="${esc(s_ ? s_.src : r)}">[${esc(s_ ? s_.src : r)}]</sup>` : `<a class="bdc" href="#/book/${esc(id)}/${esc(pg || 1)}" title="${esc(s_ ? s_.src : r)}">[${esc(s_ ? s_.src : r)}]</a>`; });
  async function bidaya(q, ctx) {
    const plan = await getB("plan.json"), idx = (await getB("index.json")) || { lessons: {} }, MG = (await getB("merge.json")) || null; if (!plan) return ctx.view_(ctx.head("البداية", true) + '<p class="note">تعذّر تحميل المنهج.</p></div>');
    const DUP = (MG && MG.dup) || {};
    const ok = id => (idx.lessons[id] || {}).st === "ok", vis = id => ok(id) || (staff() && idx.lessons[id]);
    if (q.l) return lesson(q.l, plan, idx, ctx, DUP);
    const offH = MG && (MG.official || []).length ? `<h3>📕 من كتاب «البداية» الرسمي</h3><p class="mut">دروس السلسلة نفسها تُقدَّم أولًا، وما يغطيه منها لا يُكرر في المنهج المكمّل أدناه.</p><ol class="bdoff">${MG.official.map(o => `<li><a href="#/book/${esc(o.b)}/${o.p || 1}">${esc(o.l)}</a>${(st().done.t4 || []).includes("bdo:" + o.b + ":" + o.p) ? " ✓" : ""}</li>`).join("")}</ol><h3>📗 المنهج المكمّل من نصوص المكتبة</h3>` : "";
    const U = plan.units, dn = st().done.t4 || [];
    ctx.view_(ctx.head("البداية", true) + `<section class="tlh bd"><h2 class="talat">📗 البداية لمن سلك طريق الهداية</h2><p>منهج المرحلة ١٥–٢٠ سنة بعد «الأساس» و«البنيان»: عقيدة، وتفسير، وحديث وفوائده، وأعلام وقدوات، وفقه العبادات والمعاملات، وآداب وقضايا الشباب، وقضايا منهجية — من كتب مشايخ الدعوة والمكتبة العامة بنصوصها وعزوها.</p>
      ${staff() ? `<p class="note">للمشرفين: ${toAr(Object.keys(idx.lessons).length)} درسًا مصوغًا من ${toAr(plan.parts.reduce((n, p) => n + p.lessons.length, 0))}، المعتمد منها ${toAr(Object.values(idx.lessons).filter(x => x.st === "ok").length)}. المسودات تظهر لك وحدك حتى تعتمدها.</p>` : ""}
      ${offH}${plan.parts.map(pt => `<h3>${esc(pt.t)} <span class="mut">(${esc(pt.age)})</span></h3>${Object.keys(U).map(u => { const L = pt.lessons.filter(x => x.u === u); return L.length ? `<details class="bdu"${pt === plan.parts[0] ? " open" : ""}><summary>${U[u][1]} ${esc(U[u][0])} <span class="mut">(${toAr(L.filter(x => vis(x.id)).length)}/${toAr(L.length)})</span></summary><ol>${L.map(x => `<li>${DUP[x.id] ? `<a href="#/book/${esc(DUP[x.id].b)}/${DUP[x.id].p || 1}">${esc(x.t)}</a> <em class="tag">في الكتاب الرسمي</em>${vis(x.id) ? ` <a class="mut" href="#/talaea/bidaya?l=${x.id}">إثراء</a>` : ""}` : vis(x.id) ? `<a href="#/talaea/bidaya?l=${x.id}">${esc(x.t)}</a>${ok(x.id) ? "" : ' <em class="tag">مسودة</em>'}${dn.includes("bd:" + x.id) ? " ✓" : ""}` : `<span class="mut">${esc(x.t)} — قيد الإعداد</span>`}</li>`).join("")}</ol></details>` : ""; }).join("")}`).join("")}</section></div>`);
  }
  async function lesson(id, plan, idx, ctx, DUP) {
    const L = await getB("l/" + id + ".json"); if (!L || (L.st !== "ok" && !staff())) return ctx.view_(ctx.head("البداية", true) + '<p class="note">الدرس قيد الإعداد والمراجعة.</p></div>');
    const all = plan.parts.flatMap(p => p.lessons), i = all.findIndex(x => x.id === id), nx = all.slice(i + 1).find(x => (idx.lessons[x.id] || {}).st === "ok" || (staff() && idx.lessons[x.id])), U = plan.units[L.u] || ["", ""];
    const qs = (L.qs || []).map((x, k) => `<div class="tlhq bdq" data-k="${k}"><p><b>${toAr(k + 1)}.</b> ${esc(x.q)}</p>${x.k === "open" ? `<details><summary>عناصر الإجابة</summary><p>${cite(x.a, L)}</p></details>` : (x.k === "tf" ? [["true", "✓ صح"], ["false", "✗ خطأ"]] : (x.o || []).map((o, j) => [String(j), o])).map(([v, t]) => `<button class="tlhopt" data-bdq="${k}" data-v="${esc(v)}">${esc(t)}</button>`).join("") + `<p class="bdw" hidden>${cite(x.w, L)}</p>`}</div>`).join("");
    ctx.view_(ctx.head("البداية", true) + `<article class="tlh bd bdl" data-id="${esc(id)}"><p class="mut"><a href="#/talaea/bidaya">📗 البداية</a> › ${U[1]} ${esc(U[0])} › الجزء ${toAr(L.part)}</p><h2 class="talat">${esc(L.t)}</h2>${DUP && DUP[id] ? `<div class="note">📕 هذا الدرس في كتاب «البداية» الرسمي: <a href="#/book/${esc(DUP[id].b)}/${DUP[id].p || 1}">«${esc(DUP[id].l)}» ←</a>. ما يلي إثراء له من نصوص المكتبة.</div>` : ""}
      ${L.st !== "ok" ? `<div class="note"><b>مسودة للمراجعة</b> — لا يراها الطلاب حتى تعتمدها. ${(L.warn || []).length ? "تنبيهات الفحص الآلي: " + L.warn.map(esc).join("؛ ") : "اجتاز الفحص الآلي (النصوص المنقولة موجودة حرفيًّا في مصادرها، والآيات مطابقة للمصحف)."}${L.by ? " • " + esc(L.by) : ""}${typeof GH !== "undefined" && GH.on ? ` <button class="btn s p" data-bdok="${esc(id)}">✓ اعتماد الدرس</button>` : " (الاعتماد بمفتاح الإدارة المباشرة)"}</div>` : ""}
      <p class="bdintro">${cite(L.intro, L)}</p>
      ${(L.goals || []).length ? `<h3>🎯 أهداف الدرس</h3><ul>${L.goals.map(g => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}
      ${(L.nusus || []).length ? `<h3>📜 النصوص</h3>${L.nusus.map(n => `<blockquote class="bdn">${esc(n.t)}<small>${cite("[[" + n.ref + "]]", L)}</small></blockquote>`).join("")}` : ""}
      ${(L.sharh || []).map(x => `<h3>${esc(x.h)}</h3><p>${cite(x.p, L)}</p>`).join("")}
      ${L.qissa ? `<h3>🐪 من سير السلف</h3><p>${cite(L.qissa, L)}</p>` : ""}
      ${(L.fawaid || []).length ? `<h3>💡 الفوائد</h3><ol>${L.fawaid.map(f => `<li>${cite(f, L)}</li>`).join("")}</ol>` : ""}
      ${L.nashat ? `<h3>🛠️ نشاط عملي</h3><p>${esc(L.nashat)}</p>` : ""}
      ${(L.bina || []).length ? `<h3>🌱 أثر الدرس في بناء الجيل</h3><ul class="bdbina">${L.bina.map(f => `<li>${cite(f, L)}</li>`).join("")}</ul>` : ""}
      ${qs ? `<h3>📝 التقويم</h3>${qs}` : ""}
      <h3>📚 مصادر الدرس</h3><ul class="mut">${(L.src || []).map(x => `<li>${esc(x.src)}</li>`).join("")}</ul>
      <div class="row"><button class="btn p" data-tlh="done" data-k="t4" data-id="bd:${esc(id)}">✓ أتممت الدرس</button>${nx ? `<a class="btn" href="#/talaea/bidaya?l=${nx.id}">الدرس التالي ←</a>` : ""}<a class="btn s" href="#/talaea/bidaya">فهرس البداية</a></div></article></div>`);
  }
  document.addEventListener("click", async e => {
    const q = e.target.closest("[data-bdq]"); if (q) { const box = q.closest(".bdq"), id = q.closest(".bdl").dataset.id, L = await getB("l/" + id + ".json"), x = (L.qs || [])[+q.dataset.bdq]; if (!x) return;
      const right = x.k === "tf" ? String(!!x.a) : String(x.a); box.querySelectorAll("[data-bdq]").forEach(b => { b.disabled = true; if (b.dataset.v === right) b.classList.add("ok"); else if (b === q) b.classList.add("no"); }); const w = box.querySelector(".bdw"); if (w) w.hidden = false; return; }
    const ok = e.target.closest("[data-bdok]"); if (ok) { const id = ok.dataset.bdok; if (!confirm("اعتماد الدرس وإظهاره للطلاب؟")) return;
      try { await GH.editJSON("data/bidaya/l/" + id + ".json", o => { o.st = "ok"; o.okby = (Auth.user && Auth.user.name) || "admin"; o.okat = today(); return o; }, "البداية: اعتماد " + id);
        await GH.editJSON("data/bidaya/index.json", o => { o.lessons[id] = Object.assign(o.lessons[id] || {}, { st: "ok" }); return o; }, "البداية: فهرس " + id); toast("اعتُمد، ويظهر للطلاب خلال دقائق"); } catch (x) { toast(x.message); } return; }
  });
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-tlh]"); if (!b) return; e.preventDefault(); const a = b.dataset.tlh, s = st();
    if (a === "stage") { s.stage = b.dataset.k; save(); location.hash = "#/talaea"; if (typeof route === "function") route(); return; }
    if (a === "change") { location.hash = "#/talaea?stage=1"; return; }
    if (a === "done") { const k = b.dataset.k; s.done[k] = s.done[k] || []; if (!s.done[k].includes(b.dataset.id)) s.done[k].push(b.dataset.id); save(); toast("أحسنت! انتقل إلى الدرس التالي ⭐"); if (typeof route === "function") route(); return; }
    if (a === "ans") { const box = b.closest(".tlhq"), k = box.dataset.k, D = await data(), Q = todayQ(D, k); if (!Q || answered(Q)) return;
      const right = Q.k === "tf" ? String(!!Q.a) : String(Q.a), ok = b.dataset.v === right;
      s.log.push({ q: Q.q, s: Q.s, ok, v: b.dataset.v, at: new Date().toISOString() }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
      if (ok) { const T = S.tala = S.tala || { stars: 0, done: {} }; T.stars = (T.stars || 0) + 2; const el = $("#tstars"); if (el) el.textContent = toAr(T.stars); }
      save(); $("#tlhqb").innerHTML = qCard(Q, k, D.sub || {}); }
  });
  return { home, bidaya };
})();
