/* «المِسبار» (#/misbar): مقياس مستواك في العلوم الشرعية — طلب المدير، ٢٠ نوفمبر ٢٠٢٦، على فكرة «معلمة الدرر» باسم آخر.
   لكل قسم من أقسام الموسوعات العلمية ثلاثة اختبارات متدرجة (مبتدئ، متوسط، متقدم) من عشرة أسئلة تُسحب من بنك القسم:
   النجاح في ٧٠٪ فأكثر يفتح المستوى التالي (تخطي الاختبار)، وما دونه يُعاد (المثابرة)، ومع كل جواب تعليله و«تثقّف أكثر»: موضعه في المكتبة
   ومسألته في الموسوعة. البنوك من tools/misbar.py (data/misbar)، وتعتمدها الإدارة؛ والتقدم محفوظ على جهاز العضو. */
const MSB = (() => {
  const R = "data/misbar/", LV = { 1: "المبتدئ", 2: "المتوسط", 3: "المتقدم" }, BK = {};
  const getJ = async p => { try { const r = await fetch(p + "?t=" + Math.floor(Date.now() / 120e3)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const adm = () => isAdmin() || (typeof can === "function" && can("edit"));
  const PR = { get() { try { return JSON.parse(localStorage.getItem("misbar") || "{}"); } catch (e) { return {}; } }, set(o) { try { localStorage.setItem("misbar", JSON.stringify(o)); } catch (e) { } } };
  const nm = x => String(x.n || "").replace(/^موسوعة\s+/, "");
  const bank = async k => BK[k] || (BK[k] = await getJ(R + k + ".json"));
  const live = (I, x) => x.ok || adm();
  const open = (k, l, P) => l === 1 || (P[k] && (P[k][l - 1] || 0) >= 70);
  let RUN = null;

  async function home() {
    const I = await getJ(R + "_index.json"); if (!I) return view('<div class="note">تعذر تحميل المِسبار.</div>');
    const P = PR.get(), passed = Object.values(P).reduce((a, o) => a + [1, 2, 3].filter(l => (o[l] || 0) >= 70).length, 0);
    view(`<section class="msbhero"><h2>المِسبار</h2><p>مقياس مستواك في العلوم الشرعية</p>${passed ? `<p class="msbme">✦ اجتزت ${toAr(passed)} اختبارًا من ${toAr(I.items.length * 3)}</p>` : ""}</section>
      <div class="msbgrid">${I.items.map(x => { const n = (x.c[1] || 0) + (x.c[2] || 0) + (x.c[3] || 0), on = n >= 10 && live(I, x), p = P[x.k] || {};
        return `<a class="msbcard${on ? "" : " off"}" href="${on ? "#/misbar/" + x.k : "#/misbar"}"${on ? "" : ' aria-disabled="true"'}>${on ? "" : '<em class="msbsoon">قيد الإعداد</em>'}${on && !x.ok ? '<em class="msbsoon">مسودة</em>' : ""}<i aria-hidden="true">${x.ic}</i><b>${esc(nm(x))}</b><span>${esc(x.d)}</span>
          <span class="msblv">${[1, 2, 3].map(l => `<s class="${(p[l] || 0) >= 70 ? "ok" : open(x.k, l, P) ? "" : "lock"}" title="${LV[l]}${p[l] ? " — " + toAr(p[l]) + "٪" : ""}"></s>`).join("")}</span></a>`; }).join("")}</div>
      <h3 class="msbh">عن المِسبار</h3><div class="msbabout">
        <div><i>💡</i><b>الفكرة</b><p>نافذة تقيس بها مستواك في العلوم الشرعية، وتطوّر حصيلتك العلمية في أقسام متنوعة؛ أسئلتها من كتب مشايخ الدعوة السلفية ومقالاتهم ومن المراجع العلمية في المكتبة.</p></div>
        <div><i>⭐</i><b>الاختبارات</b><p>ثلاثة اختبارات في كل قسم تتفاوت صعوبتها: المبتدئ، والمتوسط، والمتقدم؛ في كل اختبار ${toAr(I.per || 10)} أسئلة تتجدد في كل مرة.</p></div>
        <div><i>❔</i><b>طريقة المشاركة</b><p>اختر القسم الذي تريد قياس مستواك فيه، وابدأ بالاختبار الأول، ثم تقدّم في الاختبارات؛ ولا يلزم تسجيل الدخول.</p></div></div>
      <h3 class="msbh">تعلّم مع المِسبار</h3><div class="msbabout">
        <div><i>🏅</i><b>تخطي الاختبار</b><p>إذا أجبت عن ${toAr(I.pass || 70)}٪ من الأسئلة أو أكثر انفتح لك الاختبار التالي.</p></div>
        <div><i>🔁</i><b>المثابرة</b><p>أعد الاختبار إن كانت نتيجتك أقل من ${toAr(I.pass || 70)}٪؛ فالأسئلة تتجدد، والعلم بالتكرار.</p></div>
        <div><i>🔗</i><b>تثقّف أكثر</b><p>بعد كل جواب تعليله، ورابط موضعه في الكتاب، ومسألته في الموسوعات العلمية للتوسع.</p></div></div>`);
  }
  async function sec(k) {
    const I = await getJ(R + "_index.json"), x = ((I || {}).items || []).find(y => y.k === k), B = await bank(k); if (!x || !B) return view('<div class="note">هذا القسم قيد الإعداد.</div>');
    const P = PR.get(), p = P[k] || {}, qs = (B.qs || []).filter(q => !q.x);
    view(`<p><a href="#/misbar">المِسبار</a> › ${esc(nm(x))}</p><section class="msbsec"><i aria-hidden="true">${x.ic}</i><div><h2>${esc(nm(x))}</h2><p class="mut">${esc(x.d)}</p></div></section>
      ${!B.ok ? `<p class="note">بنك الأسئلة مسودة (${toAr(qs.length)} سؤالًا) تراجعه الإدارة.${adm() ? ` <button class="btn s p" data-msb="bok" data-k="${k}">اعتماد بنك الأسئلة</button> <span class="msbst mut"></span>` : ""}</p>` : ""}
      <div class="msblevels">${[1, 2, 3].map(l => { const n = qs.filter(q => q.l === l).length, o = open(k, l, P) && n >= 4, s = p[l];
        return `<div class="msbl${o ? "" : " lock"}${(s || 0) >= 70 ? " ok" : ""}"><b>الاختبار ${["", "الأول", "الثاني", "الثالث"][l]}</b><span>المستوى ${LV[l]}</span><small class="mut">${toAr(n)} سؤالًا في البنك${s != null ? ` • أفضل نتيجة ${toAr(s)}٪` : ""}</small>
          ${o ? `<a class="btn ${(s || 0) >= 70 ? "" : "p"}" href="#/misbar/${k}/${l}">${s == null ? "ابدأ الاختبار" : (s || 0) >= 70 ? "أعد الاختبار" : "حاول مرة أخرى"}</a>` : `<span class="mut">🔒 ${n < 4 ? "قيد الإعداد" : "انجح في الاختبار السابق بـ٧٠٪ ليُفتح"}</span>`}</div>`; }).join("")}</div>
      <p><a class="btn s" href="#/mawsua/${k}">📚 ${esc(x.n)}: تعلّم المسائل</a></p>`);
  }
  async function test(k, l) {
    l = +l; const B = await bank(k), I = await getJ(R + "_index.json"), per = (I && I.per) || 10;
    if (!B || !open(k, l, PR.get())) return location.hash = "#/misbar/" + k;
    const pool = (B.qs || []).filter(q => !q.x && q.l === l).map(q => [Math.random(), q]).sort((a, b) => a[0] - b[0]).map(x => x[1]).slice(0, per);
    if (!pool.length) return view('<div class="note">لا أسئلة في هذا المستوى بعد.</div>');
    RUN = { k, l, qs: pool.map(q => Object.assign({}, q, { o: q.o.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]) })), i: 0, ok: 0, ans: [] };
    step();
  }
  function step() {
    const r = RUN, q = r.qs[r.i];
    view(`<p><a href="#/misbar/${r.k}">← ${esc(String((BK[r.k] || {}).n || "").replace(/^موسوعة\s+/, ""))}</a></p><div class="msbrun"><div class="msbbar"><i style="width:${Math.round(100 * r.i / r.qs.length)}%"></i></div>
      <p class="mut">الاختبار ${["", "الأول", "الثاني", "الثالث"][r.l]} (${LV[r.l]}) • السؤال ${toAr(r.i + 1)} من ${toAr(r.qs.length)}</p>
      <h3 class="msbq">${esc(q.q)}</h3><div class="msbopts">${q.o.map((o, j) => `<button class="msbo" data-msb="ans" data-j="${j}">${esc(o)}</button>`).join("")}</div><div id="msbfb"></div></div>`);
  }
  function answer(j) {
    const r = RUN, q = r.qs[r.i], pick = q.o[j], ok = pick === q.a; if (r.ans[r.i] != null) return; r.ans[r.i] = pick; if (ok) r.ok++;
    document.querySelectorAll(".msbo").forEach((b, n) => { b.disabled = true; if (q.o[n] === q.a) b.classList.add("ok"); else if (n === +j) b.classList.add("no"); });
    const s = q.s || {};
    $("#msbfb").innerHTML = `<div class="msbfb ${ok ? "ok" : "no"}"><b>${ok ? "✓ أحسنت" : "✗ الجواب الصحيح: " + esc(q.a)}</b>${q.e ? `<p>${esc(q.e)}</p>` : ""}
      <p class="msbmore">🔗 تثقّف أكثر: ${s.b ? `<a href="#/book/${esc(s.b)}/${s.p}">«${esc(s.t || "")}»${s.a ? " — " + esc(s.a) : ""}، ص ${toAr(s.p)}</a>` : ""}${q.m ? ` • <a href="#/mawsua/${r.k}/${esc(q.m)}" data-msb="mw">المسألة في الموسوعة: ${esc(q.mt || "")}</a>` : ""}</p>
      ${adm() ? `<button class="linkbtn" data-msb="hide" data-k="${r.k}" data-id="${esc(q.id)}">🛡️ إخفاء هذا السؤال من البنك</button> <span class="msbst mut"></span>` : ""}
      <p><button class="btn p" data-msb="next">${r.i + 1 < r.qs.length ? "السؤال التالي ←" : "النتيجة"}</button></p></div>`;
  }
  function done() {
    const r = RUN, pc = Math.round(100 * r.ok / r.qs.length), P = PR.get(); P[r.k] = P[r.k] || {}; P[r.k][r.l] = Math.max(P[r.k][r.l] || 0, pc); PR.set(P);
    const pass = pc >= 70, nx = r.l < 3 && pass;
    view(`<div class="msbres ${pass ? "ok" : "no"}"><div class="msbring" style="--p:${pc}%"><b>${toAr(pc)}٪</b></div><h2>${pass ? "أحسنت! تخطيت الاختبار" : "ثابر وأعد المحاولة"}</h2>
      <p>${toAr(r.ok)} إجابة صحيحة من ${toAr(r.qs.length)} في الاختبار ${["", "الأول", "الثاني", "الثالث"][r.l]} (${LV[r.l]}).${pass ? (nx ? " فُتح لك الاختبار التالي." : r.l === 3 ? " أتممت اختبارات هذا القسم، بارك الله فيك." : "") : " تحتاج ٧٠٪ لتخطي الاختبار، والأسئلة تتجدد في كل مرة."}</p>
      <div class="row">${nx ? `<a class="btn p" href="#/misbar/${r.k}/${r.l + 1}">الاختبار التالي</a>` : ""}<a class="btn${pass ? "" : " p"}" href="#/misbar/${r.k}/${r.l}" data-msb="again">${pass ? "أعد الاختبار" : "حاول مرة أخرى"}</a><a class="btn" href="#/misbar/${r.k}">القسم</a>
      <button class="btn" data-outr="share" data-t="${esc("قِست مستواي في «" + String((BK[r.k] || {}).n || "") + "» في المِسبار: " + pc + "٪ في المستوى " + LV[r.l])}" data-u="${esc(typeof siteLink === "function" ? siteLink("#/misbar/" + r.k) : location.href)}">⤴ شارك</button></div></div>
      <h3>مراجعة الإجابات</h3><ol class="msbrev">${r.qs.map((q, i) => `<li class="${r.ans[i] === q.a ? "ok" : "no"}"><b>${esc(q.q)}</b><br>${r.ans[i] === q.a ? "✓ " + esc(q.a) : `✗ ${esc(r.ans[i] || "—")} • الصحيح: ${esc(q.a)}`}${q.s && q.s.b ? ` <a href="#/book/${esc(q.s.b)}/${q.s.p}"><small>تثقّف أكثر</small></a>` : ""}</li>`).join("")}</ol>`);
  }
  function show(q, k, l) { if (!k) return home(); if (!l) return sec(k); return test(k, l); }

  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-msb]"); if (!el) return; const a = el.dataset.msb;
    if (a === "ans") return answer(el.dataset.j);
    if (a === "next") { RUN.i++; return RUN.i < RUN.qs.length ? step() : done(); }
    if (a === "again" && location.hash === el.getAttribute("href")) { e.preventDefault(); return test(RUN.k, RUN.l); }
    if (a === "bok" || a === "hide") { const st = el.parentNode.querySelector(".msbst") || { textContent: "" }, k = el.dataset.k;
      if (typeof GH === "undefined" || !GH.on) return st.textContent = "فعّل الإدارة المباشرة أولًا";
      try { await GH.editJSON(R + k + ".json", o => { if (a === "bok") o.ok = 1; else (o.qs || []).forEach(q => { if (q.id === el.dataset.id) q.x = 1; }); return o; }, a === "bok" ? "المسبار: اعتماد بنك " + k : "المسبار: إخفاء سؤال");
        if (a === "bok") await GH.editJSON(R + "_index.json", o => { (o.items || []).forEach(x => { if (x.k === k) x.ok = 1; }); return o; }, "المسبار: الفهرس");
        BK[k] = null; st.textContent = a === "bok" ? "✓ اعتُمد البنك" : "✓ أُخفي"; } catch (x) { st.textContent = x.message; } }
  });
  return { show };
})();
