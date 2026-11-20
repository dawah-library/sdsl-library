/* المجتمع والتواصل (المرحلة ٩):
   #/awael       «كن من الأوائل»: تسجيل بالبريد، وشارة «عضو مؤسس» في الملف الشخصي عند الإطلاق (is_founder).
   #/weekly      «كتاب الأسبوع»: ثمانية أسابيع (data/weekly.json)، مقتطف يومي بنصه وصفحته، ورابط القراءة والتشجير والاختبار؛ وبطاقته في الرئيسية.
   #/masala      «المسألة الواحدة»: أقوال مشايخ الدعوة في مسألة من كتبهم ومقالاتهم وفتاواهم، مجمّعة بالمؤلف مع التوثيق والإحالة؛ وما تنشره الإدارة في data/masail.
   #/newsletter  النشرة الأسبوعية: اشتراك وإلغاء سهلان، وأرشيف الأعداد. التسجيل عبر /api/notify (x-sub)، والعناوين في Supabase لا في المستودع. */
const OUTR = (() => {
  const getJ = async p => { try { const r = await fetch(p + (p.includes("?") ? "&" : "?") + "t=" + Math.floor(Date.now() / 300e3)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const adm = () => isAdmin() || (typeof can === "function" && can("edit"));
  const subForm = (kind, label) => `<form class="sbox outsub" data-form="outsub" data-kind="${kind}" style="max-width:520px"><input name="email" type="email" required placeholder="بريدك الإلكتروني" aria-label="البريد الإلكتروني" autocomplete="email"><button class="btn p">${label}</button></form><p class="mut outst"></p>`;
  async function subscribe(f) {
    const st = f.nextElementSibling, b = f.querySelector("button"); b.disabled = true; st.textContent = "جارٍ التسجيل…";
    try { const r = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json", "x-sub": "1" }, body: JSON.stringify({ sub: f.dataset.kind, email: f.email.value.trim() }) }), j = await r.json().catch(() => ({}));
      st.textContent = j.message || (r.ok ? "✓ سُجّل" : "تعذّر التسجيل الآن"); if (r.ok) f.reset(); } catch (e) { st.textContent = "تعذّر الاتصال."; } finally { b.disabled = false; }
  }
  /* ---------- كن من الأوائل ---------- */
  function awael() {
    view(`<section class="cmhero"><div><h2>🌱 كن من الأوائل</h2><p>سجّل بريدك لتكون من أوائل المنضمين إلى مكتبة الدعوة السلفية الرقمية عند إطلاقها الرسمي، وتحصل على شارة <b>«عضو مؤسس»</b> في ملفك الشخصي — حين تنشئ حسابك بالبريد نفسه.</p></div></section>
      ${subForm("waitlist", "سجّلني")}<p class="mut">لا يُستعمل بريدك إلا لهذا الغرض، ويمكنك إلغاء التسجيل بضغطة من أي رسالة. وللنشرة الأسبوعية: <a href="#/newsletter">اشترك هنا</a>.</p>`);
  }
  async function founderBadge(box) {
    if (!box || typeof Auth === "undefined" || !Auth.sb || !Auth.user) return;
    try { const { data } = await Auth.sb.rpc("is_founder"); if (data) box.insertAdjacentHTML("afterbegin", '<span class="founder" title="سجّل في «كن من الأوائل» قبل الإطلاق">🌱 عضو مؤسس</span>'); } catch (e) { }
  }
  /* ---------- كتاب الأسبوع ---------- */
  let WK = null; const wk = async () => WK || (WK = await getJ("data/weekly.json"));
  const curWeek = W => { if (!W || !(W.weeks || []).length) return null; const t = new Date().toISOString().slice(0, 10); return [...W.weeks].reverse().find(w => w.from <= t) || (W.weeks[0].from > t ? Object.assign({ soon: 1 }, W.weeks[0]) : null); };
  const dayIdx = w => Math.max(0, Math.min(6, Math.floor((Date.now() - new Date(w.from + "T00:00:00").getTime()) / 864e5))) % Math.max(1, w.sn.length);
  const wkLinks = w => `<a class="btn s p" href="#/book/${esc(w.b)}/1">📖 اقرأ الكتاب</a>${w.tj ? `<a class="btn s" href="#/tashjir/${esc(w.b)}">🌳 التشجير</a>` : ""}${w.quiz ? `<a class="btn s" href="#/quizzes/${esc(w.b)}?l=easy">✅ اختبار تفاعلي</a>` : ""}`;
  async function homeCard(box) {  // في الرئيسية: غلاف الكتاب ومقتطف اليوم (يتجدد كل يوم من أيام الأسبوع)
    const W = await wk(); if (!box || !W || (W.st !== "ok" && !adm())) return; const w = curWeek(W); if (!w || !B(w.b)) return; const s = w.sn[dayIdx(w)];
    box.innerHTML = `<section class="wkcard" aria-label="كتاب الأسبوع">${typeof coverOf === "function" ? coverOf(B(w.b)) : ""}<div><small>📚 كتاب الأسبوع ${toAr(w.w)} من ٨${w.soon ? " — يبدأ " + esc(w.from) : ""}${W.st !== "ok" ? ' <em class="tag">مسودة</em>' : ""}</small><b>${esc(w.t)}</b><span class="mut">${esc(w.a)}</span>
      <blockquote>«${esc(s.t)}» <a href="#/book/${esc(w.b)}/${s.p}"><small>(ص ${toAr(s.p)})</small></a></blockquote><div class="row">${wkLinks(w)}<a class="btn s" href="#/weekly">السلسلة</a></div></div></section>`;
  }
  async function weekly() {
    const W = await wk(); if (!W) return view('<p class="note">لا سلسلة بعد.</p>'); const c = curWeek(W);
    view(`<h2>📚 كتاب الأسبوع</h2><p class="mut">سلسلة تعريفية تفاعلية لثمانية أسابيع: في كل أسبوع كتاب من كتب مشايخ الدعوة، ومقتطف قصير منه كل يوم بنصه وصفحته، ورابط القراءة المباشر، والتشجير أو الاختبار التفاعلي.${W.st !== "ok" ? " <b>(مسودة تنتظر اعتماد الإدارة)</b>" : ""}</p>
      ${adm() && W.st !== "ok" ? `<p><button class="btn p" data-outr="wkok">اعتماد السلسلة ونشرها</button> <span class="mut">ويمكن تعديل الكتب والمقتطفات في data/weekly.json</span></p>` : ""}
      ${W.weeks.map(w => `<article class="card wkrow${c && c.w === w.w ? " on" : ""}"><h3>الأسبوع ${toAr(w.w)} <small class="mut">(من ${esc(w.from)})</small>: ${esc(w.t)} <small>— ${esc(w.a)}</small></h3>
        <ol class="wksn">${w.sn.map(s => `<li>«${esc(s.t)}» <a href="#/book/${esc(w.b)}/${s.p}"><small>ص ${toAr(s.p)}</small></a> <button class="linkbtn" data-outr="share" data-t="${esc("«" + s.t + "»\n— " + w.t + "، " + w.a + "، ص " + s.p)}" data-u="${esc(siteLink("#/book/" + w.b + "/" + s.p))}">⤴</button></li>`).join("")}</ol><div class="row">${wkLinks(w)}</div></article>`).join("")}`);
  }
  /* ---------- المسألة الواحدة ---------- */
  async function masala(q) {
    const term = String(q.q || "").trim(), M = (await getJ("data/masail/_index.json")) || { items: [] };
    if (q.s) return masalaPub(q.s);
    view(`<h2>🧭 المسألة الواحدة</h2><p class="mut">أقوال مشايخ الدعوة السلفية في مسألة واحدة من كتبهم ومقالاتهم وفتاواهم، مجمّعة بحسب الشيخ، مع نص كل قول وموضعه للتوثيق والإحالة. البحث بالكلمة ومشتقاتها.</p>
      <form class="sbox" data-form="outmas" style="max-width:none"><input name="q" type="search" value="${esc(term)}" placeholder="اكتب المسألة، مثل: حكم المشاركة السياسية، أو: الولاء والبراء"><button class="btn p">اجمع الأقوال</button></form>
      ${M.items.length ? `<h3>مسائل محررة</h3><div class="chips">${M.items.map(x => `<a class="chip" href="#/masala?s=${encodeURIComponent(x.s)}">${esc(x.t)} <small>${toAr(x.n)}</small></a>`).join("")}</div>` : ""}<div id="masout"></div>`);
    if (!term) return; const out = $("#masout");
    const books = lib.books.filter(b => bc(b) === "dawah" && !b.hidden && !b.demo); await loadMany(books, (i, k) => progress(out, i, k, "جارٍ جمع النصوص"));
    const MM = typeof ARMORPH !== "undefined" ? ARMORPH.matcher(term, "stem") : null, w = norm(term).split(/\s+/).filter(Boolean), hits = [];
    // الصلة: كلمات المسألة متقاربة (في نافذة ١٠ كلمات) أو العبارة بنصها؛ وتُرتب المواضع بقوة الصلة
    const ST = typeof ARMORPH !== "undefined" ? ARMORPH.stem : (x => norm(x)), qs = (typeof ARMORPH !== "undefined" ? ARMORPH.words(term) : w).map(ST), ph = norm(term).trim();
    const rel = t => { const ws = (typeof ARMORPH !== "undefined" ? ARMORPH.words(t) : norm(t).split(/\s+/)).map(ST); let best = 0; const pos = qs.map(q => ws.reduce((a, x, k) => (x === q && a.push(k), a), []));
      if (pos.some(p => !p.length)) return 0; if (qs.length === 1) return pos[0].length;
      pos[0].forEach(k => { if (pos.slice(1).every(P => P.some(j => Math.abs(j - k) <= 10))) best++; }); return best * 2 + (norm(t).includes(ph) ? 5 : 0); };
    books.forEach(b => (b.pages || []).forEach((p, i) => { const t = plain(String(p || "").split(/^\s*_{4,}\s*$/m)[0]); if (MM ? !MM(t, true) : !w.every(x => norm(t).includes(x))) return; const sc = rel(t); if (sc > 0) hits.push({ b, i, t, sc }); }));
    hits.sort((x, y) => y.sc - x.sc); hits.splice(400);
    const by = {}; hits.forEach(h => (by[h.b.authorId] = by[h.b.authorId] || []).push(h));
    const snip = t => { const n = norm(t); let k = n.indexOf(w[0] || ""); k = Math.max(0, k - 120); return (k ? "…" : "") + strip(t).slice(k, k + 420) + "…"; };
    window.__mas = { term, hits };
    out.innerHTML = `<p class="mut">${toAr(hits.length)} موضعًا عند ${toAr(Object.keys(by).length)} من المشايخ${hits.length >= 400 ? " (أول ٤٠٠)" : ""}.</p>
      ${Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([aid, L]) => `<section class="card masa"><h3>${esc(A(aid).name)} <small class="mut">${toAr(L.length)} موضعًا</small></h3>${L.slice(0, 12).map((h, j) => `<div class="masq"><p>${esc(snip(h.t))}</p><p class="mut">— «${esc(h.b.setTitle || h.b.title)}»${isArt(h.b) ? " (مقال)" : ""}، <a href="#/book/${esc(h.b.id)}/${h.i + 1}?h=${encodeURIComponent(term)}">${esc(PL(h.b, h.i) || "ص " + toAr(h.i + 1))}</a>${adm() ? ` <label class="inl"><input type="checkbox" data-mas="${hits.indexOf(h)}"> للنشر</label>` : ""}</p></div>`).join("")}${L.length > 12 ? `<p class="mut">و${toAr(L.length - 12)} موضعًا آخر.</p>` : ""}</section>`).join("") || '<div class="note">لا نصوص مطابقة؛ جرّب صيغة أخرى للمسألة.</div>'}
      ${adm() && hits.length ? `<div class="savebar"><input id="mast" placeholder="عنوان المسألة المحررة" value="${esc(term)}"><button class="btn p" data-outr="maspub">نشر المسألة بالمواضع المختارة</button> <span id="masst" class="mut"></span></div>` : ""}
      <p class="note">جمع آلي من نصوص المكتبة؛ اقرأ كل قول في سياقه من موضعه قبل نسبته أو الاستشهاد به.</p>`;
  }
  async function masalaPub(s) {
    const M = await getJ("data/masail/" + encodeURIComponent(s) + ".json"); if (!M) return view('<p class="note">المسألة غير موجودة.</p>');
    const by = {}; (M.items || []).forEach(x => (by[x.a] = by[x.a] || []).push(x));
    view(`<p><a href="#/masala">← المسألة الواحدة</a></p><h2>🧭 ${esc(M.t)}</h2><p class="mut">أقوال مشايخ الدعوة في المسألة بنصوصها ومواضعها${M.at ? " • حُررت " + esc(M.at) : ""}.</p>
      ${Object.entries(by).map(([aid, L]) => `<section class="card masa"><h3>${esc(A(aid).name)}</h3>${L.map(x => `<div class="masq"><p>${esc(x.q)}</p><p class="mut">— «${esc(x.bt)}»، <a href="#/book/${esc(x.b)}/${x.p}">${esc(x.l || "ص " + toAr(x.p))}</a></p></div>`).join("")}</section>`).join("")}`);
  }
  /* ---------- النشرة ---------- */
  async function newsletter(q) {
    const I = (await getJ("data/newsletter/_index.json")) || { items: [] }, d = q.d || "", N = d ? await getJ("data/newsletter/" + d + ".json") : null;
    view(`<h2>✉️ النشرة البريدية الأسبوعية</h2><p class="mut">كل أسبوع: جديد الكتب والإصدارات، والتطويرات الجديدة في المنصة، وفائدة علمية مختارة، ورابط كتاب الأسبوع. الاشتراك والإلغاء بضغطة.</p>
      ${subForm("newsletter", "اشترك")}${N ? `<article class="card"><h3>عدد ${esc(N.date)}</h3>${N.week ? `<p>📖 كتاب الأسبوع: <a href="#/book/${esc(N.week.b)}/1">${esc(N.week.t)}</a></p>` : ""}${(N.new || []).length ? `<h4>جديد الكتب</h4><ul>${N.new.map(b => `<li><a href="#/book/${esc(b.id)}/1">${esc(b.t)}</a> — ${esc(b.a)}</li>`).join("")}</ul>` : ""}${(N.dev || []).length ? `<h4>جديد المنصة</h4><ul>${N.dev.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${N.faida ? `<h4>فائدة</h4><blockquote>«${esc(N.faida.t)}» — <a href="#/book/${esc(N.faida.b)}/${N.faida.p}">${esc(N.faida.bt)}، ص ${toAr(N.faida.p)}</a></blockquote>` : ""}</article>` : ""}
      <h3>الأرشيف</h3>${I.items.length ? `<div class="chips">${I.items.slice().reverse().map(x => `<a class="chip${x === d ? " x" : ""}" href="#/newsletter?d=${esc(x)}">${esc(x)}</a>`).join("")}</div>` : '<p class="mut">يصدر أول عدد قريبًا.</p>'}`);
  }
  document.addEventListener("submit", e => { const f = e.target.closest("[data-form=outsub],[data-form=outmas]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (f.dataset.form === "outsub") subscribe(f); else location.hash = "#/masala?q=" + encodeURIComponent(f.q.value.trim()); }, true);
  document.addEventListener("click", async e => { const el = e.target.closest("[data-outr]"); if (!el) return; e.preventDefault(); const a = el.dataset.outr;
    if (a === "share") { const d = { title: "كتاب الأسبوع", text: el.dataset.t, url: el.dataset.u }; if (navigator.share) navigator.share(d).catch(() => { }); else { try { await navigator.clipboard.writeText(d.text + "\n" + d.url); toast("نُسخ"); } catch (x) { } } }
    else if (a === "wkok") { try { await GH.editJSON("data/weekly.json", o => Object.assign(o, { st: "ok", okAt: today() }), "كتاب الأسبوع: اعتماد السلسلة"); WK = null; toast("اعتُمدت السلسلة"); weekly(); } catch (x) { toast(x.message); } }
    else if (a === "maspub") { const M = window.__mas, st = $("#masst"); if (!M || !GH.on) return st.textContent = "فعّل الإدارة المباشرة أولًا";
      const pick = [...document.querySelectorAll("[data-mas]:checked")].map(x => M.hits[+x.dataset.mas]); if (!pick.length) return st.textContent = "اختر المواضع";
      const t = $("#mast").value.trim() || M.term, s = norm(t).replace(/\s+/g, "-").slice(0, 60);
      const items = pick.map(h => ({ a: h.b.authorId, b: h.b.id, bt: h.b.setTitle || h.b.title, p: h.i + 1, l: PL(h.b, h.i) || "", q: (() => { const n = norm(h.t), k = Math.max(0, n.indexOf(norm(M.term).split(/\s+/)[0]) - 200); return (k ? "…" : "") + strip(h.t).slice(k, k + 700) + "…"; })() }));
      try { await GH.put("data/masail/" + s + ".json", JSON.stringify({ t, s, at: today(), items }, null, 1), "المسألة الواحدة: «" + t + "»");
        await GH.editJSON("data/masail/_index.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => x.s !== s).concat([{ s, t, n: items.length }]); return o; }, "المسألة الواحدة: الفهرس", true);
        st.textContent = "✓ نُشرت"; } catch (x) { st.textContent = x.message; } }
  });
  return { awael, weekly, masala, newsletter, homeCard, founderBadge };
})();
