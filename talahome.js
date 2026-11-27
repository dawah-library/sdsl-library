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
    const next = nl.x ? `<div class="tlhnext"><small>القادم لك في «${SERIES[nl.x.s] || nl.x.s}» ${nl.x.s === "asas" ? "المستوى " + toAr(nl.x.v) : "الجزء " + toAr(nl.x.v)}</small><h3>${esc(nl.x.l)}</h3><div class="bar"><i style="width:${nl.pct}%"></i></div><small>أتممت ${toAr(nl.pct)}٪ من منهج مرحلتك (${toAr(nl.i)} من ${toAr(nl.L.length)} درسًا)</small>
        <div class="row"><a class="btn" href="#/book/${esc(nl.x.b)}/${nl.x.p}">▶ ادرس الدرس</a><button class="btn s" data-tlh="done" data-k="${k}" data-id="${esc(nl.x.b + ":" + nl.x.p)}">✓ أتممته</button></div></div>`
      : `<div class="tlhnext"><small>القادم لك</small><h3>${nl.L.length ? "أتممت منهج مرحلتك! 🎉" : "سُلّم القراءة لمرحلتك"}</h3><p>${nl.L.length ? "تابع القراءة من سُلّم مرحلتك، أو انتقل إلى المرحلة التالية." : "تمارين «البداية» قيد الإعداد؛ ابدأ بقراءات مرحلتك المختارة."}</p><a class="btn" href="#/talaea/ladder?k=${k}">📚 سُلّم القراءة</a></div>`;
    const T = [["📖", "درسي", `#/talaea/manhaj?k=${k}`], ["❓", "سؤال اليوم", "#tlhq", Q && !answered(Q) ? "جديد" : ""], ["📚", "قصص", "#/talaea/qasas"], ["🎮", "ألعاب", "#/talaea/games?g=quiz&k=" + k], ["🎬", "مقاطع", "#/talaea/video"], ["🧩", "ألغاز", "#/talaea/games?g=lughz&k=" + k],
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
  return { home };
})();
