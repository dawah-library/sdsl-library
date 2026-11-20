/* «العقل المتعلّم» (#/brain): تطور المساعد العلمي بقراءته الآلية للمكتبة وتعلّمه من محادثات الأعضاء (tools/brain.py).
   للجميع: الأرقام ومنحنى الاختبار الذاتي ورضا الأعضاء، وتجربة الذاكرة العلمية بسؤال. وللإدارة: إيقاف الدروس المستخلصة
   أو تعديلها أو إضافة درس، والفجوات التي يوجّه إليها القراءة القادمة. */
const BRAIN = (() => {
  const j = p => SX.brain(p);
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  function chart(h, k, label) {
    const L = h.slice(-60); if (!L.length) return '<p class="mut">لا قياسات بعد.</p>';
    const W = 600, H = 120, bw = W / Math.max(L.length, 1);
    return `<figure class="brch"><svg viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="${esc(label)}">${L.map((x, i) => { const v = Math.max(0, Math.min(100, x[k] || 0)), h_ = v / 100 * H;
      return `<rect x="${i * bw + 1}" y="${H - h_}" width="${Math.max(2, bw - 2)}" height="${h_}" rx="2"><title>${esc(x.d)}: ${v}٪</title></rect>`; }).join("")}
      <text x="${W}" y="${H + 15}" text-anchor="end">${esc(L[0].d)}</text><text x="0" y="${H + 15}">${esc(L[L.length - 1].d)}</text></svg><figcaption>${esc(label)}: آخر قياس ${toAr(L[L.length - 1][k] || 0)}٪</figcaption></figure>`;
  }
  async function page(q) {
    view('<p class="mut" style="padding:30px;text-align:center">جارٍ التحميل…</p>');
    const [M, L, G] = await Promise.all([j("_meta.json"), j("lessons.json"), j("gaps.json")]); const m = M || {}, fb = m.feedback || {}, ev = m.eval || [], adm = isAdmin();
    const ls = (L && L.items) || [], gs = (G && G.items) || [];
    view(`<section class="brain"><h1>${ic("brain", 26)} العقل المتعلّم للمساعد العلمي</h1>
      <p class="lead">يتطور <a href="#/ask">المساعد العلمي</a> تلقائيًّا: يقرأ كتب المكتبة آليًّا فيبني «ذاكرة علمية» من المسائل الموثقة بنصوصها ومراجعها، ويتعلم من أسئلة الأعضاء وتقييمهم وتصحيحهم، ويوجّه قراءته إلى ما سُئل عنه ولم يجد له جوابًا كافيًا، ثم يختبر نفسه ليقيس تقدّمه.</p>
      <div class="brst">${[["بطاقة علمية في الذاكرة", m.cards || 0], ["صفحة قرأها", m.pages_read || 0], ["كتابًا أتم قراءته", m.books_done || 0], ["محادثة تعلّم منها", fb.n || 0], ["درسًا يعمل به", ls.filter(x => x.on !== false).length], ["رضا الأعضاء", pct(fb.up || 0, (fb.up || 0) + (fb.down || 0)) + "٪"]].map(([t, v]) => `<div><b>${typeof v === "number" ? toAr(v) : esc(String(v).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]))}</b><span>${t}</span></div>`).join("")}</div>
      <h2>كيف يتعلم؟</h2><ol class="brhow"><li><b>القراءة:</b> يقرأ كل بضع ساعات صفحات جديدة (كتب مشايخ الدعوة أولًا، ثم التفريغات، ثم المقالات والفتاوى، ثم المكتبة العامة)، ويستخرج منها مسائل بسؤالها وخلاصة جوابها واقتباس بلفظه ومرجعها، ولا يقبل بطاقة إلا إن وُجد اقتباسها بحروفه في الصفحة، ويحذف المكرر.</li>
        <li><b>المحادثات:</b> الجواب الذي يستحسنه الأعضاء وهو موثق بمراجع يصير «سؤالًا متكررًا» يستدعيه بعدُ، والجواب المنتقد مع التصحيح يُستخلص منه درس عام في طريقة العمل يضاف إلى تعليماته، والسؤال الذي لم يُجب جوابًا موثقًا يصير «فجوة» يقرأ في موضوعها أولًا. تُحفظ الأسئلة بلا اسم العضو ولا بريده، وله إيقاف المشاركة.</li>
        <li><b>الاختبار الذاتي:</b> يعيد صياغة أسئلة من ذاكرته ويقيس هل يصل إلى موضعها الصحيح، مع نسبة رضا الأعضاء، فيظهر التطور يومًا بيوم.</li></ol>
      <div class="brgrid">${chart(ev, "recall", "دقة الاسترجاع في الاختبار الذاتي")}${chart(Object.entries(fb.days || {}).map(([d, a]) => ({ d, sat: pct(a[1], a[1] + a[2]) })).filter(x => x.sat || 1), "sat", "رضا الأعضاء اليومي")}</div>
      <h2>جرّب ذاكرته العلمية</h2><form class="sbox" data-form="brq"><input name="q" type="search" value="${esc(q.q || "")}" placeholder="اكتب مسألة، مثل: حكم المسح على الجوربين" aria-label="مسألة"><button class="btn p">ابحث</button></form><div id="brres"></div>
      <h2>الدروس المستفادة من المحادثات</h2>${ls.length ? `<ol class="brls">${ls.map(x => `<li class="${x.on === false ? "off" : ""}"><span>${esc(x.t)}</span>${x.why ? `<small class="mut"> — ${esc(x.why)}</small>` : ""}${adm ? ` <button class="btn s" data-brl="${esc(x.id)}">${x.on === false ? "تفعيل" : "إيقاف"}</button> <button class="btn s" data-brd="${esc(x.id)}">حذف</button>` : ""}</li>`).join("")}</ol>` : '<p class="mut">لا دروس بعد؛ تُستخلص من تصحيحات الأعضاء للأجوبة المنتقدة.</p>'}
      ${adm ? `<form data-form="brladd" class="row"><input name="t" placeholder="درس جديد يلتزمه المساعد (توجيه عام في طريقة العمل)" style="flex:1"><button class="btn s">إضافة</button></form>` : ""}
      <h2>فجوات يقرأ فيها أولًا</h2>${gs.length ? `<ul class="brgaps">${gs.slice(0, 25).map(g => `<li>${esc(g.q)} <small class="mut">(${toAr(g.n)})</small></li>`).join("")}</ul>` : '<p class="mut">لا فجوات مسجلة بعد.</p>'}
      <p class="mut">آخر تحديث: ${esc(m.at || "—")}</p></section>`);
    if (q.q) search(q.q);
  }
  async function search(t) {
    const el = $("#brres"); if (!el) return; el.innerHTML = '<p class="mut">يبحث…</p>';
    const r = await SX.recall({ query: t, k: 8 }); const cs = (r && r.cards) || [];
    el.innerHTML = cs.length ? cs.map(c => `<article class="brcard"><b>${esc(c.question)}</b><p>${esc(c.answer)}</p>${c.quote ? `<blockquote>«${esc(c.quote)}»</blockquote>` : ""}<p class="mut">${c.kind && /متكرر/.test(c.kind) ? "سؤال متكرر • " : ""}${c.ref ? `<a href="#/book/${esc(c.ref.split(":")[0])}/${esc(c.ref.split(":")[1])}">${esc(c.source || c.ref)}</a>` : ""}${c.topic ? " • " + esc(c.topic) : ""}</p></article>`).join("") : `<p class="mut">${esc((r && r.note) || "لا نتائج")}</p>`;
  }
  const editL = async (fn, msg) => { if (typeof GH === "undefined" || !GH.on) return toast("فعّل الإدارة المباشرة أولًا"); await GH.editJSON("data/brain/lessons.json", o => { o = o && o.items ? o : { items: [] }; fn(o); return o; }, msg); toast("حُفظ؛ يسري خلال دقائق"); setTimeout(() => page({}), 600); };
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-brl]"); if (a) return editL(o => { const x = o.items.find(i => i.id === a.dataset.brl); if (x) x.on = x.on === false; }, "العقل المتعلم: تفعيل/إيقاف درس");
    const d = e.target.closest("[data-brd]"); if (d && confirm("حذف هذا الدرس؟")) return editL(o => { o.items = o.items.filter(i => i.id !== d.dataset.brd); }, "العقل المتعلم: حذف درس");
  });
  document.addEventListener("submit", e => {
    const f = e.target.closest('[data-form="brq"],[data-form="brladd"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (f.dataset.form === "brq") return search(f.q.value.trim());
    const t = f.t.value.trim(); if (t.length < 10) return toast("اكتب الدرس جملة واضحة");
    editL(o => o.items.push({ id: "m" + Date.now().toString(36), t: t.slice(0, 260), at: today(), on: true, by: "admin" }), "العقل المتعلم: درس من الإدارة");
  }, true);
  return { view: q => page(q || {}) };
})();
