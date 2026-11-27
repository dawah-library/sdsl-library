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
  /* ---------- تفضيلات الإشعارات والبريد (طلب المدير، ٢٠ نوفمبر ٢٠٢٦) ----------
     كل عضو مسجل بالبريد مشترك تلقائيًّا (مشغّل member_autosub)؛ وهنا يختار ما يصله في حسابه وجهازه وبريده (جدول member_prefs). */
  const NK = [["read", "📖 التذكير بالقراءة", "وردك اليومي، وتنبيه إن انقطعت عن القراءة أسبوعًا"], ["group", "⏰ القراءة الجماعية", "تذكير قبل موعد الجلسة بثلاث ساعات"],
    ["new", "📚 جديد الكتب", "ما يُرفع من كتب ومواد جديدة"], ["audio", "🎧 الصوتيات والإذاعة", "الكتب المسموعة الجديدة وما ينضم إلى الإذاعة"],
    ["hifz", "📿 ورد الحفظ اليومي", "تذكير بإشعار في الساعة التي تختارها لورد المتن الذي تحفظه، إن لم تحفظه بعد"], ["motiv", "✦ رسائل تحفيزية", "في فضل العلم والقراءة وعلو الهمة، ثلاث مرات في الأسبوع"], ["newsletter", "✉️ النشرة الأسبوعية", "كل خميس: جديد المكتبة وكتاب الأسبوع وفائدة علمية"]];
  async function prefs(box) {
    if (!box || typeof Auth === "undefined" || !Auth.sb || !Auth.user || !Cloud.on()) return;
    let P = { mail: true, push: true, off: [] };
    try { const { data } = await Auth.sb.from("member_prefs").select("*").eq("user_id", Auth.user.id).maybeSingle(); if (data) P = data; } catch (e) { }
    box.innerHTML = `<section class="card nprefs"><h3>🔔 الإشعارات والبريد</h3><p class="mut">بتسجيلك بالبريد صرت مشتركًا تلقائيًّا في هذه الرسائل؛ اختر ما يصلك منها.</p>
      <div class="row"><label class="inl"><input type="checkbox" data-np="mail"${P.mail !== false ? " checked" : ""}> الرسائل على بريدي</label><label class="inl"><input type="checkbox" data-np="push"${P.push !== false ? " checked" : ""}> إشعارات الجهاز</label></div>
      <ul class="nplist">${NK.map(([k, t, d]) => `<li><label class="inl"><input type="checkbox" data-nk="${k}"${(P.off || []).includes(k) ? "" : " checked"}> <b>${t}</b></label> <small class="mut">${d}</small></li>`).join("")}</ul><p class="mut npst"></p></section>`;
    box.onchange = async () => {
      const row = { user_id: Auth.user.id, mail: box.querySelector('[data-np="mail"]').checked, push: box.querySelector('[data-np="push"]').checked, off: [...box.querySelectorAll("[data-nk]")].filter(x => !x.checked).map(x => x.dataset.nk) };
      const st = box.querySelector(".npst"); st.textContent = "جارٍ الحفظ…";
      const { error } = await Auth.sb.from("member_prefs").upsert(row); st.textContent = error ? "تعذّر الحفظ: " + error.message : "✓ حُفظت تفضيلاتك";
    };
  }
  /* ---------- كتاب الأسبوع ---------- */
  let WK = null; const wk = async () => WK || (WK = await getJ("data/weekly.json"));
  const curWeek = W => { if (!W || !(W.weeks || []).length) return null; const t = new Date().toISOString().slice(0, 10); return [...W.weeks].reverse().find(w => w.from <= t) || (W.weeks[0].from > t ? Object.assign({ soon: 1 }, W.weeks[0]) : null); };
  const dayIdx = w => Math.max(0, Math.min(6, Math.floor((Date.now() - new Date(w.from + "T00:00:00").getTime()) / 864e5))) % Math.max(1, w.sn.length);
  const wkLinks = w => `<a class="btn s p" href="#/book/${esc(w.b)}/1">📖 اقرأ الكتاب</a>${w.tj ? `<a class="btn s" href="#/tashjir/${esc(w.b)}">🌳 التشجير</a>` : ""}${w.quiz ? `<a class="btn s" href="#/quizzes/${esc(w.b)}?l=easy">✅ اختبار تفاعلي</a>` : ""}`;
  async function homeCard(box) {  // في الرئيسية: غلاف الكتاب ومقتطف اليوم (يتجدد كل يوم من أيام الأسبوع)
    const W = await wk(); if (!box || !W || (W.st !== "ok" && !adm())) return; const w = curWeek(W); if (!w || !B(w.b)) return; const s = w.sn[dayIdx(w)];
    box.innerHTML = `<section class="wkcard" aria-label="كتاب الأسبوع">${typeof coverOf === "function" ? coverOf(B(w.b)) : ""}<div><small>📚 كتاب الأسبوع ${toAr(w.w)} من ٨${w.soon ? " — يبدأ " + esc(w.from) : ""}${W.st !== "ok" ? ' <em class="tag">مسودة</em>' : ""}</small><b>${esc(w.t)}</b><span class="mut">${esc(w.a)}</span>
      <blockquote>«${esc(s.t)}» <a href="#/book/${esc(w.b)}/${s.p}"><small>(ص ${toAr(s.p)})</small></a></blockquote><div class="row">${wkLinks(w)}<a class="btn s" href="#/weekly">✦ استعراض الكتاب</a></div></div></section>`;
  }
  /* استعراض «كتاب الأسبوع» (طلب المدير، ٢٠ نوفمبر ٢٠٢٦): كل شيء عن الكتاب في صفحة واحدة — الغلاف، والتعريف الموجز والشامل،
     وأبرز أفكاره بصفحاتها، والدراسة والتحليل، وخريطته، ومنتجاته في الموقع (القراءة والاستماع والخلاصة والتشجير والاختبار والكراسة والفيديو…)،
     ومقتطفات الأسبوع، والمؤلف؛ والملف العلمي من tools/weekly-dossier.py (data/weekly/<id>.json). ?w=N لأسبوع آخر من السلسلة. */
  const P = (t, n) => n === 1 ? "صفحة واحدة" : n === 2 ? "صفحتان" : toAr(n) + (n <= 10 ? " صفحات" : " صفحة");
  async function products(w, b) {
    const id = b.id, has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k), head = async u => { try { return (await fetch(u, { method: "HEAD" })).ok; } catch (e) { return false; } };
    const [su, ku, tj, vi, tr, qa, qz, au] = await Promise.all([getJ("data/summ/_list.json"), getJ("data/kurrasa/_list.json"), getJ("data/tashjir/_list.json"), getJ("data/video/_list.json"), getJ("data/tr/index.json"),
      head("data/qa/" + id + ".json"), w.quiz ? true : head("data/quizzes/" + id + ".json"), typeof AUDIO !== "undefined" ? AUDIO.load().catch(() => ({})) : {}]);
    const L = [["📖", "اقرأ الكتاب", "النص الكامل بفهرسه وترقيم المطبوع", "#/book/" + id + "/1", 1]];
    if (typeof AUDIO !== "undefined" && AUDIO.ready(au[id])) L.push(["🎧", "الكتاب المسموع", au[id].d ? "نحو " + toAr(Math.round(au[id].d / 60)) + " دقيقة استماع" : "استمع إليه كاملًا", "#/audio/" + id]);
    if (has(su, id)) L.push(["🧾", "خلاصة الكتاب", "اختصار فصوله بمستويات متعددة", "#/summary?b=" + encodeURIComponent(id) + "&r=20"]);
    if (has(tj, id) && (tj[id].ok || adm())) L.push(["🌳", "التشجير", "خريطة ذهنية لأبوابه ومسائله", "#/tashjir/" + id]);
    if (qz) L.push(["✅", "اختبر فهمك", "اختبار تفاعلي بثلاثة مستويات", "#/quizzes/" + id + "?l=easy"]);
    if (has(ku, id) && (ku[id].ok || adm())) L.push(["📘", "كراسة المذاكرة", "أسئلة وتمارين للمراجعة", "#/kurrasat/" + id]);
    if (vi && Array.isArray(vi[id]) && vi[id].length) L.push(["🎬", "فيديو تعريفي", toAr(vi[id].length) + " مقطعًا عن الكتاب", "#/video?b=" + encodeURIComponent(id)]);
    if (qa) L.push(["❓", "سؤال وجواب", "أسئلة يجيب عنها الكتاب", "#/qa/" + encodeURIComponent(id)]);
    if (tr && tr.l) { const ls = Object.entries(tr.l).filter(([, x]) => has(x, id)).map(([k]) => k); if (ls.length) L.push(["🌐", "الترجمات", ls.join("، "), "#/translate?l=" + encodeURIComponent(ls[0])]); }
    const sh = BOOKS().filter(x => x.sharh === id && !x.hidden && !VOL2(x)); if (sh.length) L.push(["🎙", "شروحه", toAr(sh.length) + " شرحًا مفرغًا", "#/book/" + sh[0].id + "/1"]);
    if (b.sharh && B(b.sharh)) L.push(["📜", "المتن المشروح", B(b.sharh).title, "#/book/" + b.sharh + "/1"]);
    L.push(["🆚", "قارنه بكتاب", "مقارنة علمية بكتاب آخر", "#/compare?a=" + encodeURIComponent(id)]);
    return L;
  }
  async function weekly(q) {
    q = q || {}; const W = await wk(); if (!W || !(W.weeks || []).length) return view('<p class="note">لا سلسلة بعد.</p>');
    const c = curWeek(W), w = (q.w && W.weeks[+q.w - 1]) || c || W.weeks[0], b = B(w.b); if (!b) return view('<p class="note">الكتاب غير متاح.</p>');
    const a0 = A(b.authorId) || {}, a = a0.name === "—" ? {} : a0, card = b.card || {}, live = W.st === "ok", isCur = c && c.w === w.w;
    view(`<p class="mut">جارٍ تحضير الاستعراض…</p>`);
    const [Dx, prods, full] = await Promise.all([getJ("data/weekly/" + w.b + ".json"), products(w, b), loadBook(w.b).catch(() => null)]);
    const Dd = Dx && (live || adm()) ? Dx : null, n = (full && full.pages.length) || b.n || 0, day = Math.max(1, Math.ceil(n / 7));
    const toc = full ? (full.toc || []).filter((t, i, L) => t.p && (!t.l || t.l <= 1) && !L.slice(0, i).some(x => x.t === t.t)).slice(0, 16) : [];
    const ideas = (Dd && Dd.ideas) || [], st = (Dd && Dd.study) || {}, quotes = (Dd && Dd.quotes) || [];
    const sec = (ic, t, h, cls) => h ? `<section class="wks${cls ? " " + cls : ""}"><h3><span aria-hidden="true">${ic}</span> ${t}</h3>${h}</section>` : "";
    const para = x => (Array.isArray(x) ? x : [x]).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join("");
    const pg = p => p ? ` <a class="wkpg" href="#/book/${esc(w.b)}/${p}">ص ${toAr(p)}</a>` : "";
    const s = w.sn[dayIdx(w)] || w.sn[0];
    view(`<p><a href="#/weekly">📚 كتاب الأسبوع</a>${q.w ? ` › الأسبوع ${toAr(w.w)}` : ""}</p>
      ${!live ? `<p class="note">السلسلة مسودة تنتظر اعتماد الإدارة.${adm() ? ` <button class="btn s p" data-outr="wkok">اعتماد السلسلة ونشرها</button>` : ""}</p>` : ""}
      <section class="wkhero"><div class="wkcov">${coverOf(b)}</div><div class="wkhi">
        <span class="wkbadge">📚 كتاب الأسبوع ${toAr(w.w)} من ${toAr(W.weeks.length)}${isCur ? " • هذا الأسبوع" : w.from > today() ? " • يبدأ " + esc(w.from) : ""}</span>
        <h2>${esc(b.setTitle || b.title)}</h2><p class="wkau"><a href="#/author/${esc(b.authorId)}">${esc(a.name || w.a)}</a>${a.died ? ` <small class="mut">(ت ${toAr(a.died)}هـ)</small>` : ""}</p>
        ${Dd && Dd.hook ? `<p class="wkhook">${esc(Dd.hook)}</p>` : ""}
        <div class="wkst"><span><b>${toAr(n)}</b>صفحة</span>${toc.length ? `<span><b>${toAr(toc.length)}</b>بابًا وفصلًا</span>` : ""}<span><b>${toAr(day)}</b>صفحة يوميًّا لتختمه في أسبوع</span>${ideas.length ? `<span><b>${toAr(ideas.length)}</b>فكرة محورية</span>` : ""}</div>
        <div class="row"><a class="btn p" href="#/book/${esc(w.b)}/1">📖 ابدأ القراءة الآن</a>${prods.slice(1, 3).map(x => `<a class="btn" href="${x[3]}">${x[0]} ${esc(x[1])}</a>`).join("")}<button class="btn" data-outr="share" data-t="${esc("📚 كتاب الأسبوع: «" + (b.setTitle || b.title) + "» — " + (a.name || w.a) + (Dd && Dd.brief ? "\n" + Dd.brief : ""))}" data-u="${esc(siteLink("#/weekly?w=" + w.w))}">⤴ شارك</button></div>
      </div></section>
      ${sec("✦", "تعريف موجز", para((Dd && Dd.brief) || card.summary), "wkbrief")}
      <blockquote class="wkday"><small>مقتطف اليوم</small>«${esc(s.t)}» <a href="#/book/${esc(w.b)}/${s.p}"><small>(ص ${toAr(s.p)})</small></a></blockquote>
      ${sec("📜", "التعريف الشامل", para(Dd && Dd.about))}
      ${sec("💡", "أبرز أفكار الكتاب", ideas.length ? `<ol class="wkideas">${ideas.map(x => `<li><b>${esc(x.t)}</b><p>${esc(x.d)}${pg(x.p)}</p></li>`).join("")}</ol>` : (card.parts || []).length ? `<div class="chips">${card.parts.map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : "")}
      ${sec("🔎", "دراسة وتحليل", (st.importance || st.method || st.structure || (st.features || []).length) ? `<div class="wkgrid">
        ${st.importance ? `<div><h4>أهمية الكتاب</h4><p>${esc(st.importance)}</p></div>` : ""}${st.method ? `<div><h4>منهج المؤلف</h4><p>${esc(st.method)}</p></div>` : ""}
        ${st.structure ? `<div><h4>بناء الكتاب</h4><p>${esc(st.structure)}</p></div>` : ""}${(st.features || []).length ? `<div><h4>مميزاته</h4><ul>${st.features.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${st.audience || card.audience ? `<div><h4>لمن يُقرأ</h4><p>${esc(st.audience || card.audience)}</p></div>` : ""}${(st.tips || []).length ? `<div><h4>كيف تقرؤه وتنتفع به</h4><ul>${st.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div>` : card.audience ? `<p>${esc(card.audience)}</p>` : "")}
      ${sec("🗺️", "خريطة الكتاب", toc.length ? `<ol class="wktoc">${toc.map(t => `<li><a href="#/book/${esc(w.b)}/${t.p}">${esc(t.t)}</a> <small class="mut">ص ${toAr(t.p)}</small></li>`).join("")}</ol>` : "")}
      ${sec("🧰", "الكتاب في المكتبة: منتجاته وخدماته", `<div class="wkprod">${prods.map(x => `<a href="${x[3]}"${x[4] ? ' class="on"' : ""}><i aria-hidden="true">${x[0]}</i><b>${esc(x[1])}</b><span>${esc(x[2])}</span></a>`).join("")}</div>`)}
      ${sec("❝", "من أقوال الكتاب", quotes.length ? quotes.map(x => `<blockquote class="wkq">«${esc(x.t)}»${pg(x.p)}</blockquote>`).join("") : "")}
      ${sec("🤔", "أسئلة يجيبك عنها الكتاب", (Dd && (Dd.questions || []).length) ? `<ul class="wkqs">${Dd.questions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")}
      ${sec("📅", "مقتطفات الأسبوع", `<ol class="wksn">${w.sn.map((x, k) => `<li${k === dayIdx(w) && isCur ? ' class="on"' : ""}>«${esc(x.t)}» <a href="#/book/${esc(w.b)}/${x.p}"><small>ص ${toAr(x.p)}</small></a> <button class="linkbtn" data-outr="share" data-t="${esc("«" + x.t + "»\n— " + w.t + "، " + w.a + "، ص " + x.p)}" data-u="${esc(siteLink("#/book/" + w.b + "/" + x.p))}" aria-label="مشاركة">⤴</button></li>`).join("")}</ol>`)}
      ${sec("👤", "المؤلف", a.name ? `<div class="wkau2">${a.photo ? `<img src="${esc(a.photo)}" alt="" loading="lazy">` : ""}<div><b><a href="#/author/${esc(b.authorId)}">${esc(a.name)}</a></b>${a.bio ? `<p>${esc(String(a.bio).slice(0, 600))}${String(a.bio).length > 600 ? "…" : ""}</p>` : ""}</div></div>` : "")}
      ${(card.keywords || []).length ? `<p class="chips">${card.keywords.map(k => `<a class="chip" href="#/search?q=${encodeURIComponent(k)}">${esc(k)}</a>`).join("")}</p>` : ""}
      ${!Dd && adm() ? `<p class="note">ملف الاستعراض العلمي (الأفكار والدراسة والتحليل) لم يُبنَ بعد لهذا الكتاب: شغّل مهمة «ملف كتاب الأسبوع» (weekly-dossier.yml).</p>` : ""}
      ${Dd ? `<p class="mut wknote">أُعد هذا الاستعراض من نص الكتاب نفسه، والأقوال منقولة بحروفها من صفحاتها؛ والمرجع هو الكتاب.</p>` : ""}
      <h3>السلسلة كاملة</h3><div class="wkser">${W.weeks.map(x => `<a href="#/weekly?w=${x.w}" class="${x.w === w.w ? "on" : ""}">${B(x.b) ? coverOf(B(x.b)) : ""}<small>الأسبوع ${toAr(x.w)}${c && c.w === x.w ? " • الحالي" : ""}</small><b>${esc(x.t)}</b><span class="mut">${esc(x.a)}</span></a>`).join("")}</div>`);
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
  return { awael, weekly, masala, newsletter, homeCard, founderBadge, prefs };
})();
