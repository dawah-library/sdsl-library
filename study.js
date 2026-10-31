/* منظومة الانتفاع بالكتاب (المرحلة الأولى من «الرؤية التطويرية الشاملة»): تُضاف فوق الموجود دون تغييره.
   - دفتري: دفتر فوائد موحد من تعليقات القارئ (جدول notes) بأنواعها (فائدة، اقتباس، ملاحظة، مصطلح، سؤال، ملخص) ووسومها،
     يُصنَّف بالكتاب والمؤلف والعلم والتاريخ والوسم، ويُبحث فيه، ويُصدَّر Markdown وWord وPDF، ويُحوَّل إلى مسودة بحث موثقة.
   - إنجازي: هدف قراءة يومي، ووقت القراءة وصفحاتها، وسلسلة الاستمرار، والكتب المتمَّة، وإنجازات هادئة (بلا سباق أرقام).
   - رفوفي: أقرأه الآن، وأريد قراءته، وأتممته، ورفوف يسميها القارئ.
   - في القارئ: «اسأل عن الفقرة» (المساعد مقيدًا بالكتاب والصفحة) و«توثيق» (إحالة علمية جاهزة).
   - الرئيسية: هدف اليوم، ومراجعة اليوم، ومسارك، ومقترح لك.
   سجل القراءة والرفوف على الجهاز (S.rlog وS.shelves) وتُرفع مع تفضيلات العضو. */
const STUDY = (() => {
  const KINDS = [["fa", "فائدة", "💡"], ["q", "اقتباس", "❝"], ["n", "ملاحظة", "📝"], ["t", "مصطلح", "📖"], ["s", "سؤال/إشكال", "❓"], ["m", "ملخص", "🧾"]];
  const kName = k => (KINDS.find(x => x[0] === k) || KINDS[2]);
  const push = () => { try { if (typeof Prefs !== "undefined") Prefs.push(); } catch (e) { } }; // مزامنة الرفوف والهدف مع حساب العضو
  const day = (d = new Date()) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };

  // ---------- سجل القراءة: يُحتسب الوقت حين يكون القارئ مفتوحًا ظاهرًا ونشِطًا (تفاعل في آخر دقيقتين) ----------
  let lastAct = Date.now();
  ["pointerdown", "keydown", "scroll", "touchstart", "wheel"].forEach(ev => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
  const log = () => (S.rlog = S.rlog || {});
  setInterval(() => {
    const m = location.pathname.match(/^\/book\/([^/]+)\/(\d+)/) || location.hash.match(/^#\/book\/([^/]+)\/(\d+)/);
    if (!m || document.hidden || Date.now() - lastAct > 120e3) return;
    const L = log(), d = day(), e = L[d] || (L[d] = { s: 0, p: [] }); e.s += 30;
    const key = decodeURIComponent(m[1]) + ":" + m[2]; if (!e.p.includes(key)) e.p.push(key);
    const ks = Object.keys(L).sort(); while (ks.length > 400) delete L[ks.shift()];
    saveS();
  }, 30e3);
  const goal = () => +(S.rgoal || 20);
  function stats() {
    const L = log(), d0 = day(), mins = d => Math.round(((L[d] || {}).s || 0) / 60);
    let streak = 0; for (let i = 0; i < 400; i++) { const d = day(Date.now() - i * 864e5); if (mins(d) >= Math.min(5, goal())) streak++; else if (i > 0) break; }
    const week = [...Array(7)].map((_, i) => { const d = day(Date.now() - (6 - i) * 864e5); return { d, m: mins(d), p: ((L[d] || {}).p || []).length }; });
    const done = lib.books.filter(b => !isArt(b) && b.n > 5 && ((S.maxBy || {})[b.id] || 0) >= b.n * 0.9);
    const total = Object.values(L).reduce((n, e) => n + (e.s || 0), 0) / 60;
    return { today: mins(d0), streak, week, done, total: Math.round(total), pages: Object.values(L).reduce((n, e) => n + (e.p || []).length, 0) };
  }

  // ---------- الرفوف ----------
  const SH0 = [["now", "أقرأه الآن"], ["want", "أريد قراءته"], ["done", "أتممته"]];
  const shelves = () => (S.shelves = S.shelves || { now: [], want: [], done: [] });
  const shelfName = k => (S.shelfNames || {})[k] || (SH0.find(x => x[0] === k) || [k, k])[1];

  // ---------- مكتبتي: دفتري وإنجازي ورفوفي ----------
  async function mine(t, box, q) {
    if (t === "stats") return box.innerHTML = statsHtml();
    if (t === "shelves") return box.innerHTML = shelvesHtml();
    box.innerHTML = '<p class="mut">جارٍ تحميل دفترك…</p>';
    const all = await Mine.allNotes(); NB = all;
    box.innerHTML = notebookHtml(all, q);
  }
  let NB = [];
  const meta = n => { const b = B(n.book_id) || {}; return { b, au: A(b.authorId).name || "", tp: T(b.topicId).name || "", date: String(n.created_at || n.updated_at || "").slice(0, 10) }; };
  function notebookHtml(all, q) {
    const k = q.k || "", g = q.g || "b", s = String(q.q || "").trim(), ws = s ? norm(s).split(/\s+/) : [];
    const L = all.filter(n => (!k || (n.kind || "n") === k) && (!ws.length || ws.every(w => norm([n.quote, n.note, (n.tags || []).join(" "), n.title].join(" ")).includes(w))));
    const keyOf = n => { const m = meta(n); return g === "a" ? m.au : g === "t" ? m.tp || "بلا تصنيف" : g === "d" ? m.date.slice(0, 7) : g === "w" ? ((n.tags || [])[0] || "بلا وسم") : (n.title || m.b.title || n.book_id); };
    const G = new Map(); L.forEach(n => { const kk = keyOf(n); if (!G.has(kk)) G.set(kk, []); G.get(kk).push(n); });
    const u = o => "#/mine?" + new URLSearchParams(Object.assign({ t: "book", k, g, q: s }, o)).toString().replace(/(^|&)[a-z]=(?=&|$)/g, "");
    const counts = Object.fromEntries(KINDS.map(([kk]) => [kk, all.filter(n => (n.kind || "n") === kk).length]));
    return `<p class="mut">كل ما استخرجته من الكتب في دفتر واحد: الفوائد والاقتباسات والملاحظات والمصطلحات والأسئلة والملخصات، مرتبطة بمواضعها. حدّد نصًّا في أي كتاب ثم «📒 فائدة» أو «تعليق».</p>
      <nav class="chips"><a class="chip${!k ? " x" : ""}" href="${u({ k: "" })}">الكل (${toAr(all.length)})</a>${KINDS.map(([kk, l, ic]) => counts[kk] ? `<a class="chip${k === kk ? " x" : ""}" href="${u({ k: kk })}">${ic} ${l} (${toAr(counts[kk])})</a>` : "").join("")}</nav>
      <div class="row nbbar"><form class="sbox" data-form="nbq" style="max-width:none;flex:1"><input name="q" type="search" value="${esc(s)}" placeholder="ابحث في دفترك"><button class="btn">بحث</button></form>
       <label>الترتيب <select data-act="nbg">${[["b", "بالكتاب"], ["a", "بالمؤلف"], ["t", "بالعلم"], ["d", "بالتاريخ"], ["w", "بالوسم"]].map(([v, l]) => `<option value="${v}"${g === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><button class="btn s" data-act="nbx" data-f="md">Markdown</button><button class="btn s" data-act="nbx" data-f="doc">Word</button><button class="btn s" data-act="nbx" data-f="pdf">PDF</button><button class="btn s p" data-act="nbx" data-f="research">من الفوائد إلى مسودة بحث</button><button class="btn s" data-act="nbx" data-f="review">أضف الفوائد إلى المراجعة</button></div>
      ${L.length ? [...G.entries()].map(([kk, ns]) => `<h3 class="nbh">${esc(kk)} <span class="mut">(${toAr(ns.length)})</span></h3>${ns.map(nbItem).join("")}`).join("") : `<p class="note">${all.length ? "لا نتائج مطابقة." : "دفترك فارغ بعد. حدّد نصًّا في أي كتاب ثم اضغط «📒 فائدة»."}</p>`}`;
  }
  const nbItem = n => { const [, l, ic] = kName(n.kind || "n"), m = meta(n); return `<div class="nbi k-${n.kind || "n"}"><div class="nbm"><span class="tag">${ic} ${l}</span> <a href="#/book/${esc(n.book_id)}/${n.page}">${esc(n.title || m.b.title || n.book_id)} — ${esc((m.b.id && PL(m.b, n.page - 1)) || "ص " + toAr(n.page))}</a>${m.au ? ` <span class="mut">• ${esc(m.au)}</span>` : ""}${(n.tags || []).map(t => ` <a class="chip" href="#/mine?t=book&g=w&q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join("")}</div>
    <blockquote>${esc(n.quote)}</blockquote>${n.note ? `<p>${esc(n.note)}</p>` : ""}<button class="btn s" data-act="noteopenid" data-id="${esc(n.id)}" data-b="${esc(n.book_id)}">تعديل</button></div>`; };
  const cite = (b, p) => { const a = A(b.authorId).name, ed = b.ed && (b.ed.n || b.ed.pub) ? [b.ed.n && "الطبعة " + b.ed.n, b.ed.pub, b.ed.y].filter(Boolean).join("، ") : (b.source || ""); return `${a}، «${b.setTitle || b.title}»${b.vol ? "، ج" + b.vol : ""}${ed ? "، " + ed : ""}، ${PL(b, p - 1) || "ص " + p}. ${SITENAME}: ${siteLink("#/book/" + b.id + "/" + p)}`; };
  function exportNB(f) {
    const L = NB; if (!L.length) return toast("دفترك فارغ");
    const rows = L.map(n => { const b = B(n.book_id) || { title: n.title || n.book_id, id: n.book_id }; return { n, b, c: b.authorId ? cite(b, n.page) : (n.title || "") + "، ص " + n.page }; });
    if (f === "review") { if (typeof HZ === "undefined" || !HZ.add) return toast("المراجعة غير متاحة"); const cards = rows.filter(r => (r.n.kind || "n") === "fa" || r.n.kind === "t").map(r => ({ id: "nb" + r.n.id, b: r.n.book_id, p: r.n.page, cue: r.n.note || (r.n.kind === "t" ? "عرّف المصطلح" : "تذكّر الفائدة") + " — " + (r.b.setTitle || r.b.title || ""), text: r.n.quote })); const k = HZ.add(cards); return toast(k ? `أُضيفت ${toAr(k)} بطاقة إلى «حفظ المتون» للمراجعة المتباعدة` : cards.length ? "أُضيفت من قبل" : "لا فوائد أو مصطلحات لإضافتها"); }
    if (f === "md") return dl("دفتري.md", new Blob(["# دفتر فوائدي\n\n" + rows.map(r => `- **${kName(r.n.kind || "n")[1]}**: «${r.n.quote}»${r.n.note ? "\n  - " + r.n.note : ""}\n  - ${r.c}`).join("\n")], { type: "text/markdown" }));
    // مسودة البحث: الفوائد مجمعة بالعلم ثم الكتاب، وكل نقل بإحالته في حاشية مرقمة
    const research = f === "research";
    let fnN = 0; const fns = [];
    const groups = new Map(); rows.forEach(r => { const k = research ? (T(r.b.topicId).name || "مباحث عامة") : (r.b.setTitle || r.b.title); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const body = [...groups.entries()].map(([k, rs]) => `<h2>${esc(k)}</h2>` + rs.map(r => { fnN++; fns.push(r.c); return `<p>${research ? "" : `<b>${kName(r.n.kind || "n")[1]}:</b> `}«${esc(r.n.quote)}»<sup>[${fnN}]</sup>${r.n.note ? `<br><i>${esc(r.n.note)}</i>` : ""}</p>`; }).join("")).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${research ? "مسودة بحث" : "دفتر فوائدي"}</title><style>body{direction:rtl;font-family:'Traditional Arabic',Amiri,serif;font-size:15pt;line-height:1.9}h1,h2{color:#0f5c4d}sup{color:#b88a2e}.fn{font-size:11pt;border-top:1px solid #999;margin-top:20px;padding-top:8px}</style></head><body dir="rtl"><h1>${research ? "مسودة بحث: " + esc(S.rtitle || "عنوان البحث") : "دفتر فوائدي"}</h1>${research ? "<p><i>[مقدمة البحث: …]</i></p>" : ""}${body}<div class="fn"><b>الإحالات</b>${fns.map((c, i) => `<p>[${i + 1}] ${esc(c)}</p>`).join("")}</div></body></html>`;
    if (f === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); w.document.write(html.replace("</body>", "<script>onload=()=>setTimeout(()=>print(),400)<\/script></body>")); w.document.close(); return; }
    dl(research ? "مسودة-بحث.doc" : "دفتري.doc", new Blob(["﻿", html], { type: "application/msword" }));
  }

  function statsHtml() {
    const st = stats(), g = goal(), pct = Math.min(100, Math.round(st.today * 100 / g)), mx = Math.max(g, ...st.week.map(w => w.m), 1);
    const ach = [[st.done.length >= 1, "📗", "أتممت أول كتاب"], [st.done.length >= 5, "📚", "خمسة كتب"], [st.done.length >= 10, "🏛️", "عشرة كتب"], [st.streak >= 7, "🔥", "أسبوع متصل من القراءة"], [st.streak >= 30, "🌙", "شهر متصل"], [st.total >= 600, "⏳", "عشر ساعات قراءة"], [((S.qres || []).length) >= 5, "📝", "خمسة اختبارات"]];
    return `<div class="stgrid"><div class="stc"><b>اليوم</b><div class="ring" style="--p:${pct}"><span>${toAr(st.today)}<small>/${toAr(g)} د</small></span></div><label>هدفي اليومي <select data-act="rgoal">${[10, 20, 30, 45, 60].map(v => `<option value="${v}"${g === v ? " selected" : ""}>${toAr(v)} دقيقة</option>`).join("")}</select></label></div>
      <div class="stc"><b>الاستمرار</b><div class="big">${toAr(st.streak)}</div><span class="mut">يومًا متصلًا</span></div>
      <div class="stc"><b>كتب أتممتها</b><div class="big">${toAr(st.done.length)}</div><span class="mut">${toAr(st.total)} دقيقة و${toAr(st.pages)} صفحة إجمالًا</span></div></div>
      <h3>أسبوعك</h3><div class="wkbars">${st.week.map(w => `<div><i style="height:${Math.round(w.m * 100 / mx)}%" title="${toAr(w.m)} دقيقة"></i><small>${new Date(w.d).toLocaleDateString("ar-EG", { weekday: "short" })}</small></div>`).join("")}</div>
      <h3>إنجازاتك</h3><div class="achs">${ach.map(([ok, ic, t]) => `<span class="ach${ok ? " on" : ""}">${ic} ${t}</span>`).join("")}</div>
      ${st.done.length ? `<h3>كتب أتممتها</h3>${st.done.map(b => `<a class="bk" href="#/book/${b.id}/1"><b>${esc(b.setTitle || b.title)}</b><span>${esc(A(b.authorId).name)}</span></a>`).join("")}` : ""}
      <p class="mut">يُحتسب وقت القراءة حين يكون الكتاب مفتوحًا وأنت تتصفحه. والغاية الفهم والانتفاع والإخلاص، لا عدد الصفحات.</p>`;
  }
  function shelvesHtml() {
    const sh = shelves(), keys = [...SH0.map(x => x[0]), ...Object.keys(sh).filter(k => !SH0.some(x => x[0] === k))];
    return `<p class="mut">رتّب كتبك في رفوف: من «أدوات القراءة» في أي كتاب ← «أضف إلى رف»، أو أنشئ رفًّا باسمك.</p>
      <form class="row" data-form="shnew"><input name="n" maxlength="40" placeholder="اسم رف جديد (مثل: كتب العقيدة)"><button class="btn s">إنشاء رف</button></form>
      ${keys.map(k => `<h3>${esc(shelfName(k))} <span class="mut">(${toAr((sh[k] || []).length)})</span></h3>${(sh[k] || []).map(id => B(id)).filter(Boolean).map(b => `<div class="bk"><a href="#/book/${b.id}/${Math.max(1, (S.lastBy || {})[b.id] || 1)}"><b>${esc(b.setTitle || b.title)}</b></a><span>${esc(A(b.authorId).name)}${b.n ? " • " + toAr(Math.min(100, Math.round(100 * ((S.maxBy || {})[b.id] || 0) / b.n))) + "٪" : ""}</span><button class="btn s" data-act="shrm" data-k="${esc(k)}" data-id="${esc(b.id)}">إزالة</button></div>`).join("") || '<p class="mut">فارغ.</p>'}`).join("")}`;
  }
  function shelfDlg(id) {
    const sh = shelves(), keys = [...SH0.map(x => x[0]), ...Object.keys(sh).filter(k => !SH0.some(x => x[0] === k))];
    openSheet("أضف إلى رف", `<div class="row" style="flex-direction:column;gap:6px">${keys.map(k => `<label class="inl"><input type="checkbox" data-act="shtog" data-k="${esc(k)}" data-id="${esc(id)}"${(sh[k] || []).includes(id) ? " checked" : ""}> ${esc(shelfName(k))}</label>`).join("")}</div><p><a href="#/mine?t=shelves" data-act="closeSheet">رفوفي</a></p>`);
  }

  // ---------- الرئيسية: لوحة الطالب ----------
  async function home(el) {
    if (!el) return; const st = stats(), g = goal(), pct = Math.min(100, Math.round(st.today * 100 / g));
    let due = 0; try { if (typeof HZ !== "undefined") due = HZ.due().length; } catch (e) { }
    const sp = (typeof SP !== "undefined" && SP.rows || []).find(r => r.plan && r.plan.mode === "timed");
    const recent = Object.keys(S.lastBy || {}).slice(-6).map(B).filter(Boolean), tps = new Set(recent.map(b => b.topicId)), seen = new Set(Object.keys(S.lastBy || {}));
    const sug = lib.books.filter(b => !isArt(b) && !VOL2(b) && !b.hidden && tps.has(b.topicId) && !seen.has(b.id)).sort((a, b) => (bc(a) === "dawah" ? 0 : 1) - (bc(b) === "dawah" ? 0 : 1) || (a.n || 0) - (b.n || 0)).slice(0, 4);
    el.innerHTML = `<div class="sthome"><a class="sth" href="#/mine?t=stats"><b>🌱 هدف اليوم</b><div class="bar"><i style="width:${pct}%"></i></div><span>${toAr(st.today)} من ${toAr(g)} دقيقة${st.streak > 1 ? ` • 🔥 ${toAr(st.streak)} أيام` : ""}</span></a>
      ${due ? `<a class="sth" href="#/hifz"><b>🔁 مراجعة اليوم</b><span>${toAr(due)} بطاقة مستحقة</span></a>` : ""}
      ${sp ? `<a class="sth" href="#/paths/${encodeURIComponent(sp.id)}"><b>🎯 مسارك</b><span>${esc(sp.title || "")}</span></a>` : `<a class="sth" href="#/paths"><b>🎯 اختر مسارًا علميًا</b><span>١١ علمًا بثلاثة مستويات</span></a>`}
      <a class="sth" href="#/mine?t=book"><b>📒 دفتري</b><span>فوائدك من الكتب في مكان واحد</span></a></div>
      ${sug.length ? `<h2>مقترح لك</h2><p class="mut">من موضوعات ما قرأته مؤخرًا.</p><div class="newg">${sug.map(b => `<a class="newc" style="text-decoration:none;color:inherit" href="#/book/${b.id}/1"><b>${esc(b.setTitle || b.title)}</b><br><span class="mut">${esc(A(b.authorId).name)}</span></a>`).join("")}</div>` : ""}`;
  }


  // ---------- قارن بين كتابين: كتابان متجاوران، ومسألة يُبحث عنها فيهما مع تظليلها والتنقل بين مواضعها ----------
  async function compare(q) {
    const opts = BOOKS().filter(b => !b.hidden).slice(0, 4000).map(b => `<option value="${esc(b.id)}">${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title)} — ${esc(A(b.authorId).name)}</option>`).join("");
    const term = String(q.q || "").trim();
    view(`<h2>قارن بين كتابين</h2><p class="mut">اختر كتابين واكتب المسألة أو العبارة، فتظهر مواضعها في كليهما جنبًا إلى جنب مع تظليلها؛ وانتقل بين المواضع لمقارنة كلام المؤلفَين. النصوص بلفظها، والحكم بينها للقارئ.</p>
      <form class="cmpf" data-form="cmp"><select name="a" aria-label="الكتاب الأول">${opts}</select><select name="b" aria-label="الكتاب الثاني">${opts}</select><input name="q" value="${esc(term)}" placeholder="المسألة أو العبارة (مثل: الإخلاص)"><button class="btn p">قارن</button></form>
      <div class="cmp"><section id="cmpA"></section><section id="cmpB"></section></div>`);
    const f = document.querySelector("[data-form=cmp]"); if (q.a) f.a.value = q.a; if (q.b) f.b.value = q.b; else if (!q.a) f.b.selectedIndex = Math.min(1, f.b.options.length - 1);
    if (q.a && q.b) { pane("cmpA", q.a, term, +q.pa || 0); pane("cmpB", q.b, term, +q.pb || 0); }
  }
  async function pane(elId, id, term, k) {
    const el = document.getElementById(elId); if (!el) return; el.innerHTML = '<p class="mut">جارٍ التحميل…</p>';
    let b; try { b = await loadBook(id); } catch (e) { el.innerHTML = `<p class="note">${esc(e.message)}</p>`; return; }
    const w = norm(term).split(/\s+/).filter(Boolean), hits = w.length ? b.pages.map((p, i) => [i, norm(p)]).filter(([, t]) => w.every(x => t.includes(x))).map(([i]) => i) : [0];
    if (!hits.length) { el.innerHTML = `<h3>${esc(b.setTitle || b.title)}</h3><p class="note">لم ترد «${esc(term)}» في هذا الكتاب بلفظها.</p>`; return; }
    k = Math.max(0, Math.min(k, hits.length - 1)); const i = hits[k];
    const rx = w.length ? new RegExp("(" + term.split(/\s+/).filter(Boolean).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g") : null;
    const txt = String(b.pages[i] || "").split(/^\s*_{4,}\s*$/m)[0].split(/\n+/).filter(Boolean).map(l => `<p>${rx ? esc(l).replace(rx, "<mark>$1</mark>") : esc(l)}</p>`).join("");
    el.innerHTML = `<h3>${esc(b.setTitle || b.title)}</h3><p class="mut">${esc(A(b.authorId).name)} • <a href="#/book/${esc(b.id)}/${i + 1}">${esc(PL(b, i) || "ص " + toAr(i + 1))}</a>${w.length ? ` • الموضع ${toAr(k + 1)} من ${toAr(hits.length)}` : ""}</p>
      ${w.length && hits.length > 1 ? `<div class="row"><button class="btn s" data-act="cmpgo" data-el="${elId}" data-id="${esc(id)}" data-k="${k - 1}"${k ? "" : " disabled"}>السابق</button><button class="btn s" data-act="cmpgo" data-el="${elId}" data-id="${esc(id)}" data-k="${k + 1}"${k < hits.length - 1 ? "" : " disabled"}>التالي</button></div>` : ""}
      <div class="cmpt">${txt}</div><button class="btn s" data-act="cmpcite" data-id="${esc(id)}" data-p="${i + 1}">📎 توثيق هذا الموضع</button>`;
    el.dataset.term = term;
  }
  document.addEventListener("submit", e => { const f = e.target.closest("[data-form=cmp]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); location.hash = "#/compare?" + new URLSearchParams({ a: f.a.value, b: f.b.value, q: f.q.value.trim() }); }, true);
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act=cmpgo],[data-act=cmpcite]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "cmpgo") return pane(el.dataset.el, el.dataset.id, document.getElementById(el.dataset.el).dataset.term || "", +el.dataset.k);
    const b = B(el.dataset.id); try { await navigator.clipboard.writeText(cite(b, +el.dataset.p)); toast("نُسخت الإحالة"); } catch (x) { } });

  // ---------- القارئ: صفحتان متقابلتان، والتنقل بين نتائج البحث داخل الكتاب، واختصارات لوحة المفاتيح ----------
  const HITS = new Map();
  function reader(b, p, h, o) {
    const desk = document.querySelector(".desk"), paper = document.getElementById("paper"); if (!desk || !paper) return;
    const n = b.pages.length;
    if (S.spread && innerWidth >= 1100 && !o.scroll && o.pv === "text" && !o.art && n > 1) {
      const q = p < n ? p + 1 : 0;
      desk.classList.add("spreadon");
      if (q) {
        paper.insertAdjacentHTML("afterend", `<article class="paper spread2" aria-label="صفحة ${q}"><div class="run"><span>${esc(b.title)}</span><span>${esc(chapterOf(b, q))}</span></div><div class="rd" data-id="${esc(b.id)}" data-p="${q}">${pageHtml(b.pages[q - 1], h, uncOf(b, q - 1), b)}</div><div class="foot">— ${toAr(q)} —${PL(b, q - 1) ? `<small>${esc(PL(b, q - 1))}</small>` : ""}</div></article>`);
        try { paintNotes(document.querySelector(".spread2 .rd")); } catch (e) { }
        const pg = document.querySelector(".pgb b"); if (pg) pg.textContent = toAr(p) + "–" + toAr(q);
        const nx = document.querySelector("#rbar [data-act=next]"); if (nx) nx.disabled = q >= n;
      }
    }
    if (h && n > 1) {
      const k = b.id + "|" + h; let hits = HITS.get(k);
      if (!hits) { const w = norm(h).split(/\s+/).filter(Boolean); hits = []; b.pages.forEach((t, i) => { const x = norm(plain(t)); if (w.every(z => x.includes(z))) hits.push(i + 1); }); HITS.set(k, hits); }
      const i = hits.indexOf(p), prev = [...hits].reverse().find(x => x < p), next = hits.find(x => x > p), u = x => `#/book/${encodeURIComponent(b.id)}/${x}?h=${encodeURIComponent(h)}`;
      desk.insertAdjacentHTML("beforebegin", `<div class="srchnav" role="navigation" aria-label="نتائج البحث في الكتاب"><span>🔎 «${esc(h)}»: ${hits.length ? (i >= 0 ? `الموضع ${toAr(i + 1)} من ${toAr(hits.length)} صفحة` : `${toAr(hits.length)} صفحة`) : "لا نتائج"}</span>
        ${prev ? `<a class="btn s" href="${u(prev)}">→ السابق</a>` : ""}${next ? `<a class="btn s" href="${u(next)}">التالي ←</a>` : ""}<a class="btn s" href="#/book/${encodeURIComponent(b.id)}/${p}" aria-label="إنهاء البحث">✕</a></div>`);
    }
    const hint = document.querySelector(".hint"); if (hint && matchMedia("(pointer:fine)").matches && !hint.dataset.k) { hint.dataset.k = 1; hint.insertAdjacentHTML("beforeend", ' • اضغط <kbd>?</kbd> لاختصارات لوحة المفاتيح'); }
  }
  const KEYS = [["→ ←", "الصفحة السابقة / التالية"], ["Home / End", "أول الكتاب / آخره"], ["T", "الفهرس"], ["G", "الانتقال إلى صفحة"], ["S أو /", "البحث داخل الكتاب"], ["B", "علامة على الصفحة"], ["L", "استمع (قراءة صوتية)"], ["D", "صفحتان متقابلتان / صفحة واحدة"], ["+ / −", "تكبير الخط / تصغيره"], ["F", "ملء الشاشة"], ["N", "قيّد النص المحدد فائدة في دفتري"], ["?", "هذه القائمة"]];
  document.addEventListener("keydown", e => {
    const rb = document.getElementById("rb"); if (!rb || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName) || (document.getElementById("dlg") || {}).open) return;
    const sh = document.getElementById("sheet"); if (sh && !sh.hidden) return;
    const click = a => { const el = document.querySelector(`#rbar [data-act=${a}]`) || document.querySelector(`[data-act=${a}]`); if (el && !el.disabled) { e.preventDefault(); el.click(); } };
    const b = B(rb.dataset.id); const c = e.code;
    if (e.key === "?" || (c === "Slash" && e.shiftKey)) { e.preventDefault(); openDlg(`<h3>اختصارات لوحة المفاتيح في القارئ</h3><table class="kbt">${KEYS.map(([k, t]) => `<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(t)}</td></tr>`).join("")}</table><p class="mut">تعمل الحروف بأي لغة للوحة المفاتيح.</p>`); return; }
    if (c === "KeyT") click("toc"); else if (c === "KeyG") click("goto"); else if (c === "KeyB") click("mark"); else if (c === "KeyL") click("tts");
    else if (c === "KeyS" || c === "Slash") { e.preventDefault(); click("more"); setTimeout(() => { const i = document.querySelector("[data-form=inbook] input"); if (i) i.focus(); }, 120); }
    else if (c === "Home" && b) { e.preventDefault(); turn(0, 1); } else if (c === "End" && b) { e.preventDefault(); turn(0, b.pages.length); }
    else if (c === "KeyD") { e.preventDefault(); S.spread = !S.spread; saveS(); push(); if (S.spread && innerWidth < 1100) toast("الصفحتان المتقابلتان تظهران على الشاشات العريضة"); route(); }
    else if (c === "Equal" || c === "NumpadAdd" || c === "Minus" || c === "NumpadSubtract") { e.preventDefault(); S.size = Math.max(1, Math.min(2.4, +(S.size || 1.2) + (/Equal|Add/.test(c) ? .1 : -.1))); saveS(); applyLook(); push(); }
    else if (c === "KeyN" && String(getSelection()).trim()) { const el = document.querySelector("[data-act=selfa]"); if (el) { e.preventDefault(); el.click(); } }
  });
  // ---------- الأحداث ----------
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "nbx") { e.preventDefault(); return exportNB(el.dataset.f); }
    if (a === "noteopenid") { e.preventDefault(); const n = NB.find(x => String(x.id) === el.dataset.id); if (n) noteDlg(n); return; }
    if (a === "shelfadd") { e.preventDefault(); const c = typeof cur === "function" && cur(); if (c) shelfDlg(c.b.set || c.b.id); return; }
    if (a === "shtog") { const sh = shelves(), k = el.dataset.k, id = el.dataset.id; sh[k] = (sh[k] || []).filter(x => x !== id); if (el.checked) sh[k].unshift(id); saveS(); push(); toast(el.checked ? "أُضيف إلى «" + shelfName(k) + "»" : "أُزيل"); return; }
    if (a === "shrm") { const sh = shelves(); sh[el.dataset.k] = (sh[el.dataset.k] || []).filter(x => x !== el.dataset.id); saveS(); push(); route(); return; }
    if (a === "selcite" || a === "selaskp") {
      const s0 = String(getSelection()).trim().replace(/\s+/g, " "), rd = typeof selRd === "function" && selRd(); if (!s0 || !rd) return;
      const b = B(rd.dataset.id), p = +rd.dataset.p; try { getSelection().removeAllRanges(); } catch (x) { } $("#selq").hidden = true;
      if (a === "selcite") { const c = cite(b, p); try { await navigator.clipboard.writeText("«" + s0.slice(0, 1500) + "»\n" + c); toast("نُسخ النص بإحالته العلمية"); } catch (x) { openDlg(`<h3>التوثيق</h3><p>${esc(c)}</p>`); } return; }
      location.hash = "#/ask?b=" + encodeURIComponent(b.id) + "&p=" + p + "&q=" + encodeURIComponent("اشرح هذه الفقرة من «" + (b.setTitle || b.title) + "» (" + (PL(b, p - 1) || "ص " + p) + ") شرحًا ميسرًا، وبيّن مصطلحاتها وفكرتها الأساسية ودليلها، مفرّقًا بين كلام المؤلف وشرحك:\n«" + s0.slice(0, 1200) + "»");
    }
  });
  document.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset.act === "rgoal") { S.rgoal = +el.value; saveS(); push(); route(); }
    if (el.dataset.act === "nbg") { const q = new URLSearchParams(location.hash.split("?")[1] || location.search.slice(1)); q.set("t", "book"); q.set("g", el.value); location.hash = "#/mine?" + q; }
  });
  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form=nbq],[data-form=shnew]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (f.dataset.form === "nbq") { const v = f.q.value.trim(); location.hash = "#/mine?t=book" + (v ? "&q=" + encodeURIComponent(v) : ""); }
    else { const n = f.n.value.trim(); if (!n) return; const sh = shelves(), k = "c" + Date.now().toString(36); sh[k] = []; S.shelfNames = Object.assign(S.shelfNames || {}, { [k]: n }); saveS(); push(); route(); }
  }, true);
  return { KINDS, mine, home, stats, cite, shelfName, compare, reader };
})();
