/* حفظ المتون (#/hifz) على هيكل تطبيقات حفّاظ المتون:
   - سلّم موضوعي متدرج (data/mutun.json): العلوم × ثلاث مراحل (التأسيس، البناء، التمكّن)، وترتيب داخل كل مرحلة، وشروح كل متن من المكتبة.
   - المتن مقسَّم «أورادًا» (مقاطع): للمنظوم أبيات (٥ افتراضًا)، وللمنثور فقرات بقدر نحو ٦٠ كلمة لا تتجاوز أبواب المتن.
   - خطة يومية يختارها الطالب (ورد أو أكثر)، و«ورد اليوم»: الجديد، ثم المراجعة القريبة (الأوراد الخمسة السابقة)، ثم البعيدة (بطاقات التكرار المتباعد).
   - طرق الحفظ والتثبيت في جلسة الورد: القراءة والاستماع مع عدّاد التكرار، والإخفاء التدريجي، والحروف الأولى، والربط بما قبله،
     واختبار «أكمل الكلمة» و«رتّب» و«اكتب من حفظك» بمقارنة كلمة بكلمة، وتسجيل الصوت والاستماع إليه.
   - ما يُحفظ يصير بطاقة في المراجعة المتباعدة (HZ في hifz.js)، والتقدم محفوظ ومتزامن بالحساب (S.mtn).
   - للإدارة: إضافة متن (من كتاب في المكتبة أو بلصق نصه فيُنشأ كتابًا)، وتصنيفه علمًا ومرحلة وترتيبًا، وتعديل ذلك. */
const MTN = (() => {
  let D = null;
  const load = async () => { if (D) return D; for (const u of ["https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/mutun.json?t=" + Math.floor(Date.now() / 300e3), "data/mutun.json"]) { try { const r = await fetch(u); if (r.ok) { D = await r.json(); break; } } catch (e) { } } return (D = D || { sci: [], lv: [], items: [] }); };
  const P = () => (S.mtn = S.mtn || {}), push = () => { saveS(); try { Prefs.push(); } catch (e) { } };
  const nz = s => norm(String(s || "")).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(Boolean);
  const day = () => new Date().toISOString().slice(0, 10);

  /* ---------- تقسيم المتن إلى وحدات (بيت أو جملة) ثم أوراد ---------- */
  const SEGC = new Map();
  async function segs(it) {
    if (SEGC.has(it.id)) return SEGC.get(it.id);
    const b = await loadBook(it.b), toc = (b.toc || []).filter(t => (t.l || 1) === 1), heads = new Set(toc.map(t => t.p));
    const units = []; let head = "";
    b.pages.forEach((pg, i) => String(pg || "").split(/^\s*_{4,}\s*$/m)[0].split("\n").forEach(l => {
      l = l.trim(); if (!l || /^\[(رسم|صورة|جدول)/.test(l)) return;
      if (/^#{1,3}\s/.test(l)) { head = l.replace(/^#+\s*/, ""); units.push({ h: head, p: i + 1 }); return; }
      if (it.kind === "nazm" && /\.\.\.|…|\t|\s{3,}/.test(l)) units.push({ t: l.replace(/\s*(\.\.\.|…|\t|\s{3,})\s*/, " ... "), p: i + 1, bayt: 1 });
      else if (it.kind === "nazm") units.push({ t: l, p: i + 1 });
      else l.split(/(?<=[.؟!:])\s+/).forEach(s => { s = s.trim(); if (s.length > 2) units.push({ t: s, p: i + 1 }); });
    }));
    const per = it.kind === "nazm" ? (+it.per || 5) : (+it.per || 60), out = []; let cur = null, w = 0, h = "";
    units.forEach(u => {
      if (u.h) { h = u.h; if (cur && cur.u.length) { out.push(cur); cur = null; w = 0; } return; }
      if (!cur) cur = { h, u: [], p: u.p };
      cur.u.push(u); w += it.kind === "nazm" ? 1 : u.t.split(/\s+/).length;
      if (w >= per) { out.push(cur); cur = null; w = 0; }
    });
    if (cur && cur.u.length) out.push(cur);
    void heads; SEGC.set(it.id, out); return out;
  }
  const segText = s => s.u.map(u => u.t).join(it_kind(s) ? "\n" : " ");
  const it_kind = s => s.u.some(u => u.bayt);

  /* ---------- الواجهة الرئيسية: سلّم المتون، ومحفوظاتي، والمراجعة ---------- */
  async function main(q, a, b2, c) {
    const d = await load();
    if (a === "m" && b2) return c != null && c !== "" ? session(d, b2, +c, q) : matn(d, b2, q);
    if (typeof HZ !== "undefined") await HZ.pull();
    const tab = q.t || (Object.keys(P()).length ? "mine" : "ladder"), l = typeof HZ !== "undefined" ? HZ.all() : [], due = typeof HZ !== "undefined" ? HZ.due(l) : [];
    const mine = d.items.filter(x => P()[x.id]);
    const tabs = `<div class="tabs" role="tablist">${[["ladder", "سلّم المتون"], ["mine", "محفوظاتي وورد اليوم"], ["cards", "بطاقات المراجعة"]].concat(isAdmin() ? [["admin", "إضافة متن وتصنيفه"]] : []).map(([k, t]) => `<a role="tab" aria-selected="${tab === k}" href="#/hifz?t=${k}">${t}</a>`).join("")}</div>`;
    const head = `<div class="cmhero hz"><div><h2>حفظ المتون</h2><p>سلّم موضوعي متدرج للمتون العلمية: اختر المتن المناسب لمرحلتك، وحدّد وردك اليومي، واحفظ بطرق متنوعة (التكرار المسموع، والإخفاء التدريجي، والربط، واختبار الحفظ)، ثم ثبّته بالمراجعة القريبة والمتباعدة.</p></div>
      <div class="row">${due.length ? `<button class="btn p" data-act="hzgo">▶ مراجعة اليوم (${toAr(due.length)})</button>` : ""}<a class="btn" href="#/hifz?t=mine">ورد اليوم</a></div></div>`;
    let body = "";
    if (tab === "ladder") {
      const s0 = q.s || "";
      body = `<nav class="chips">${[["", "كل العلوم", "📚"]].concat(d.sci).map(([k, n, i]) => `<a class="chip${s0 === k ? " x" : ""}" href="#/hifz?t=ladder${k ? "&s=" + k : ""}">${i} ${esc(n)}</a>`).join("")}</nav>
        <p class="mut">الترتيب المقترح: ابدأ بالمرحلة الأولى في العلم الذي تحتاجه، ولا تنتقل إلى ما بعدها حتى تتقن ما قبلها. المتن غير المتاح بعد في المكتبة يُضاف من الإدارة.</p>
        ${d.lv.map(([lv, ln, ld]) => { const its = d.items.filter(x => x.lv === lv && (!s0 || x.sci === s0)).sort((x, y) => d.sci.findIndex(s => s[0] === x.sci) - d.sci.findIndex(s => s[0] === y.sci) || (x.ord || 0) - (y.ord || 0)); return its.length ? `<section class="mlv"><h3>${esc(ln)} <small class="mut">— ${esc(ld)}</small></h3><div class="mgrid">${its.map(x => card(d, x)).join("")}</div></section>` : ""; }).join("")}`;
    } else if (tab === "mine") {
      body = mine.length ? `<div class="mgrid">${mine.map(x => card(d, x, 1)).join("")}</div><div id="mtoday"></div>` : `<p class="note">لم تبدأ حفظ متن بعد. اختر من <a href="#/hifz?t=ladder">سلّم المتون</a> ثم «ابدأ الحفظ».</p>`;
      setTimeout(() => today(d, mine), 0);
    } else if (tab === "cards") { setTimeout(() => cardsTab(), 0); body = '<div id="hzold"></div>'; }
    else if (tab === "admin" && isAdmin()) body = adminForm(d);
    view(head + tabs + `<div style="margin-top:10px">${body}</div><div id="hzbox"></div>`);
  }
  function card(d, x, mine) {
    const s = d.sci.find(z => z[0] === x.sci) || ["", "", "📘"], p = P()[x.id], ok = x.b && B(x.b);
    const pct = p && p.n ? Math.round(100 * (p.d || 0) / p.n) : 0;
    return `<a class="mcard${ok ? "" : " soon"}" href="${ok ? "#/hifz/m/" + esc(x.id) : "#/hifz?t=" + (isAdmin() ? "admin&add=" + esc(x.id) : "ladder")}"><span class="mic">${s[2]}</span><b>${esc(x.t)}</b><small class="mut">${esc(s[1])}${x.au ? " • " + esc(x.au) : ok ? " • " + esc(A(B(x.b).authorId).name) : ""} • ${x.kind === "nazm" ? "منظوم" : "منثور"}</small>
      ${ok ? (p ? `<span class="mbar"><i style="width:${pct}%"></i></span><small>${toAr(p.d || 0)} من ${toAr(p.n || 0)} وردًا${p.d >= p.n ? " • ✓ أتممته" : ""}</small>` : `<small class="mut">لم تبدأ</small>`) : `<small class="mut">غير متاح بعد${isAdmin() ? " — أضفه" : ""}</small>`}</a>`;
  }
  async function today(d, mine) {
    const el = $("#mtoday"); if (!el) return; const rows = [];
    for (const x of mine) { const p = P()[x.id]; if (!x.b || !B(x.b)) continue; let ss; try { ss = await segs(x); } catch (e) { continue; } p.n = ss.length;
      const nx = Math.min(p.d || 0, ss.length - 1), pd = +p.pd || 1, doneToday = (p.log || {})[day()] || 0, left = Math.max(0, pd - doneToday);
      const near = []; for (let k = Math.max(0, (p.d || 0) - 5); k < (p.d || 0); k++) near.push(k);
      const days = Math.ceil(Math.max(0, ss.length - (p.d || 0)) / pd), fin = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
      rows.push(`<div class="mtd"><h4>${esc(x.t)} <small class="mut">— الورد ${toAr(nx + 1)} من ${toAr(ss.length)} • الختم المتوقع ${fin}</small></h4>
        ${(p.d || 0) < ss.length ? `<p>${left ? `🆕 <b>الجديد:</b> <a class="btn s p" href="#/hifz/m/${esc(x.id)}/${p.d || 0}">احفظ الورد ${toAr((p.d || 0) + 1)}</a> <span class="mut">(${toAr(left)} من ورد اليوم)</span>` : "✓ أتممت جديد اليوم"}</p>` : "<p>✓ أتممت حفظ المتن؛ استمر في المراجعة.</p>"}
        ${near.length ? `<p>🔁 <b>المراجعة القريبة:</b> ${near.map(k => `<a class="chip" href="#/hifz/m/${esc(x.id)}/${k}?m=test">${toAr(k + 1)}</a>`).join("")}</p>` : ""}</div>`); }
    push(); el.innerHTML = rows.length ? `<h3>ورد اليوم</h3>${rows.join("")}<p class="mut">والمراجعة البعيدة في «بطاقات المراجعة» أو زر «مراجعة اليوم».</p>` : "";
  }
  function cardsTab() {
    const el = $("#hzold"); if (!el || typeof HZ === "undefined") return; const l = HZ.all(), books = [...new Set(l.map(c => c.b))];
    el.innerHTML = `<div class="cmstats"><a><b>${toAr(l.length)}</b><span>بطاقة</span></a><a><b>${toAr(HZ.due(l).length)}</b><span>مستحقة اليوم</span></a><a><b>${toAr(l.filter(c => (c.iv || 0) >= 21).length)}</b><span>متقنة</span></a></div>
      <p class="mut">كل ورد تحفظه يصير بطاقة تُعرض عليك في أوقات متباعدة بحسب إتقانك (اليوم، ثم بعد ٣ أيام، ثم أسبوع…). وتنشئ بطاقة من أي كتاب بتحديد نص ثم «بطاقة حفظ».</p>
      ${books.map(id => { const cs = l.filter(c => c.b === id), dd = HZ.due(cs).length; return `<div class="bk"><b>${esc((B(id) || {}).title || id)}</b><span>${toAr(cs.length)} بطاقة • مستحقة ${toAr(dd)}</span><div class="row" style="margin-top:6px">${dd ? `<button class="btn s p" data-act="hzgo" data-b="${id}">راجع</button>` : ""}<button class="btn s" data-act="hzlist" data-b="${id}">البطاقات</button><button class="btn s danger" data-act="hzdel" data-b="${id}">حذف المجموعة</button></div></div>`; }).join("") || '<p class="note">لا بطاقات بعد.</p>'}`;
  }

  /* ---------- صفحة المتن: التعريف والشروح والخطة والأوراد ---------- */
  async function matn(d, id, q) {
    const x = d.items.find(i => i.id === id); if (!x || !x.b || !B(x.b)) return view('<p class="note">المتن غير متاح بعد.</p><p><a href="#/hifz">← حفظ المتون</a></p>');
    view('<p class="mut" style="padding:30px;text-align:center">جارٍ تجهيز المتن…</p>');
    let ss; try { ss = await segs(x); } catch (e) { return view(`<p class="note">${esc(e.message)}</p>`); }
    const b = B(x.b), s = d.sci.find(z => z[0] === x.sci) || ["", "", ""], lv = d.lv.find(z => z[0] === x.lv) || [0, ""], p = P()[x.id];
    const sh = BOOKS().filter(y => (y.sharh && (y.sharh === b.id || y.sharh === b.set)) || (/شرح|حاشية|تعليق/.test(y.title) && norm(y.title).includes(norm(x.t).split(" ").slice(-2).join(" ")) && y.id !== b.id)).slice(0, 8);
    if (p) { p.n = ss.length; push(); }
    view(`<p><a href="#/hifz?t=ladder&s=${esc(x.sci)}">← سلّم المتون</a></p><div class="mhead"><span class="mic big">${s[2]}</span><div><h2>${esc(x.t)}</h2><p class="mut">${esc(A(b.authorId).name)} • ${esc(s[1])} • ${esc(lv[1])} • ${x.kind === "nazm" ? "منظوم" : "منثور"} • ${toAr(ss.length)} وردًا</p></div></div>
      ${p ? `<div class="card"><b>خطتك:</b> ${toAr(p.pd || 1)} ورد في اليوم • حفظت ${toAr(p.d || 0)} من ${toAr(ss.length)} <span class="mbar"><i style="width:${Math.round(100 * (p.d || 0) / ss.length)}%"></i></span>
        <form class="row" data-form="mplan" data-id="${esc(x.id)}" style="gap:6px;margin-top:6px"><label>الورد اليومي <select name="pd">${[1, 2, 3, 5].map(n => `<option${n === +(p.pd || 1) ? " selected" : ""}>${n}</option>`).join("")}</select></label><button class="btn s">تحديث</button><button class="btn s danger" type="button" data-mt="stop" data-id="${esc(x.id)}">إيقاف حفظ المتن</button></form></div>`
      : `<form class="card" data-form="mplan" data-id="${esc(x.id)}"><b>ابدأ الحفظ</b><p class="mut">اختر قدر وردك اليومي؛ الأفضل القليل الدائم. يُقترح ${x.kind === "nazm" ? "خمسة أبيات" : "ورد واحد (نحو ستين كلمة)"} يوميًا للمبتدئ.</p><label>الورد اليومي <select name="pd"><option>1</option><option>2</option><option>3</option><option>5</option></select></label> <button class="btn p">ابدأ</button> <span class="mut">الختم المتوقع بورد واحد: بعد ${toAr(ss.length)} يومًا.</span></form>`}
      ${sh.length ? `<p><b>شروحه في المكتبة:</b> ${sh.map(y => `<a class="chip" href="#/book/${esc(y.id)}/1">${esc(y.setTitle || y.title)}</a>`).join("")}</p>` : ""}
      <p class="row" style="gap:6px"><a class="btn s" href="#/book/${esc(b.id)}/1">قراءة المتن كاملًا</a>${typeof AUDIO !== "undefined" ? `<a class="btn s" href="#/audio/${esc(b.id)}">🎧 الاستماع (إن سُجّل)</a>` : ""}<a class="btn s" href="#/quizzes/${esc(b.id)}?l=easy">اختبار في المتن</a></p>
      <h3>الأوراد</h3><ol class="mlist">${ss.map((g, i) => `<li class="${p && i < (p.d || 0) ? "done" : p && i === (p.d || 0) ? "now" : ""}"><a href="#/hifz/m/${esc(x.id)}/${i}">${g.h && (i === 0 || ss[i - 1].h !== g.h) ? `<b class="mh">${esc(g.h)}</b><br>` : ""}${esc(strip(g.u[0].t).split(/\s+/).slice(0, 9).join(" "))} …</a> ${p && i < (p.d || 0) ? "✓" : ""}</li>`).join("")}</ol>`);
  }

  /* ---------- جلسة الورد: طرق الحفظ والتثبيت ---------- */
  const MODES = [["read", "١. اقرأ واستمع"], ["hide", "٢. الإخفاء التدريجي"], ["first", "٣. الحروف الأولى"], ["link", "٤. الربط بما قبله"], ["test", "٥. اختبر حفظك"]];
  let SES = null;
  async function session(d, id, k, q) {
    const x = d.items.find(i => i.id === id); if (!x || !x.b) return view('<p class="note">المتن غير متاح.</p>');
    let ss; try { ss = await segs(x); } catch (e) { return view(`<p class="note">${esc(e.message)}</p>`); }
    const g = ss[k]; if (!g) return location.hash = "#/hifz/m/" + id;
    const m = MODES.some(z => z[0] === q.m) ? q.m : "read", nazm = it_kind(g);
    SES = { x, ss, k, g, nazm, lvl: +q.lv || 1, rep: 0 };
    const units = g.u.map(u => S.tash ? u.t : strip(u.t));
    const show = t => esc(t).replace(/ \.\.\. /, '<span class="sep">۝</span>');
    let inner = "";
    if (m === "read") inner = `<p class="mut">اقرأ الورد بتأنٍّ مع فهم معناه، واستمع إليه، وكرّره حتى تحفظه (يُقترح ١٠ مرات فأكثر). تحفظ ${nazm ? "البيت بعد البيت ثم تجمعها" : "الجملة بعد الجملة ثم تصلها"}.</p>
      <div class="mtext">${units.map((t, i) => `<p data-u="${i}">${show(t)} <button class="lnk" data-mt="say" data-u="${i}" aria-label="استمع">🔊</button></p>`).join("")}</div>
      <div class="row mrep"><button class="btn p" data-mt="sayall">🔊 استمع للورد</button><button class="btn" data-mt="rep">تكرار: <b id="mrc">٠</b> / ١٠</button><button class="btn" data-mt="rec">🎙 سجّل تلاوتك</button><audio id="mrecp" controls hidden></audio></div>`;
    else if (m === "hide" || m === "first") { const lv = SES.lvl;
      inner = `<p class="mut">${m === "hide" ? "تُخفى كلمات أكثر في كل مستوى؛ استحضر المخفي من حفظك ثم اضغط الكلمة لتراها." : "تظهر الحروف الأولى من كل كلمة؛ استرجع الكلمة كاملة، واضغطها لتظهر."}</p>
      ${m === "hide" ? `<div class="seg">${[1, 2, 3, 4].map(n => `<a href="#/hifz/m/${esc(id)}/${k}?m=hide&lv=${n}" class="${n === lv ? "on" : ""}">${["", "ربع", "نصف", "ثلاثة أرباع", "الكل"][n]}</a>`).join("")}</div>` : ""}
      <div class="mtext">${units.map((t, i) => `<p>${t.split(/(\s+)/).map((w, j) => /\s/.test(w) || w === "..." ? (w === "..." ? '<span class="sep">۝</span>' : w) : (m === "first" || hid(i, j, lv)) ? `<button class="mw" data-w="${esc(w)}">${m === "first" ? esc(firstOf(w)) + "…" : "▁▁▁"}</button>` : esc(w)).join("")}</p>`).join("")}</div>`; }
    else if (m === "link") { const prev = k ? ss[k - 1] : null;
      inner = `<p class="mut">الربط يمنع انقطاع الحفظ بين الأوراد: اقرأ آخر ما سبق ثم أول هذا الورد مرارًا حتى يتصلا.</p>${prev ? `<div class="mtext prev"><p>${show(S.tash ? prev.u[prev.u.length - 1].t : strip(prev.u[prev.u.length - 1].t))}</p></div><div class="mlinkarrow">⬇</div>` : '<p class="note">هذا أول ورد في المتن.</p>'}<div class="mtext"><p>${show(units[0])}</p>${units[1] ? `<p>${show(units[1])}</p>` : ""}</div>`; }
    else { const keys = units.map(t => { const ws = t.split(/\s+/).filter(w => w !== "..." && strip(w).replace(/[^ء-ي]/g, "").length >= 3); return ws.length ? ws[Math.floor(ws.length / 2)] : null; });
      inner = `<div class="seg">${[["cl", "أكمل الكلمة"], ["ord", "رتّب"], ["full", "اكتب من حفظك"]].map(([t, n]) => `<a href="#/hifz/m/${esc(id)}/${k}?m=test&tt=${t}" class="${(q.tt || "cl") === t ? "on" : ""}">${n}</a>`).join("")}</div>`
        + ((q.tt || "cl") === "cl" ? `<form data-form="mcl" class="mtext">${units.map((t, i) => keys[i] ? `<p>${esc(t).replace(esc(keys[i]), `<input name="w${i}" data-a="${esc(keys[i])}" autocomplete="off" size="${Math.max(4, keys[i].length)}">`).replace(/ \.\.\. /, '<span class="sep">۝</span>')}</p>` : `<p>${show(t)}</p>`).join("")}<button class="btn p">صحّح</button> <span id="mres"></span></form>`
        : (q.tt === "ord") ? `<p class="mut">رتّب ${nazm ? "الأبيات" : "الجمل"} كما في المتن: اضغطها بالترتيب.</p><div class="mord" id="mord">${[...units.keys()].sort(() => Math.random() - .5).map(i => `<button class="btn mo" data-mt="ord" data-i="${i}">${show(units[i])}</button>`).join("")}</div><ol id="mordout" class="mtext"></ol><span id="mres"></span>`
        : `<form data-form="mfull"><p class="mut">اكتب الورد من حفظك (لا يُشترط التشكيل)، ثم قارن.</p><textarea name="t" style="min-height:160px" dir="rtl"></textarea><button class="btn p">قارن</button></form><div id="mres"></div>`); }
    view(`<p><a href="#/hifz/m/${esc(id)}">← ${esc(x.t)}</a></p><h2>الورد ${toAr(k + 1)} من ${toAr(ss.length)}${g.h ? ` <small class="mut">— ${esc(g.h)}</small>` : ""}</h2>
      <nav class="tabs mmodes">${MODES.map(([z, n]) => `<a href="#/hifz/m/${esc(id)}/${k}?m=${z}" aria-selected="${z === m}">${n}</a>`).join("")}</nav>${inner}
      <div class="savebar">${k ? `<a class="btn" href="#/hifz/m/${esc(id)}/${k - 1}?m=${m}">→ السابق</a>` : ""}<button class="btn p" data-mt="done">✓ حفظت هذا الورد</button>${k < ss.length - 1 ? `<a class="btn" href="#/hifz/m/${esc(id)}/${k + 1}">التالي ←</a>` : ""}<a class="btn s" href="#/book/${esc(x.b)}/${g.p}">موضعه في الكتاب</a></div>`);
  }
  const hid = (i, j, lv) => ((i * 7 + j * 13) % 8) < lv * 2;
  const firstOf = w => { const m = strip(w).match(/[ء-ي]/); return m ? m[0] : w.slice(0, 1); };
  const say = t => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(strip(t).replace(/\.\.\./g, "،")); u.lang = "ar-SA"; const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang)); if (v) u.voice = v; u.rate = .85; speechSynthesis.speak(u); return u; } catch (e) { toast("المتصفح لا يدعم القراءة الصوتية"); } };
  let REC = null;
  document.addEventListener("click", async e => {
    const w = e.target.closest(".mw"); if (w) { w.outerHTML = `<b class="mrev">${esc(w.dataset.w)}</b>`; return; }
    const el = e.target.closest("[data-mt]"); if (!el) return; e.preventDefault(); const a = el.dataset.mt;
    if (a === "say" && SES) say(SES.g.u[+el.dataset.u].t);
    else if (a === "sayall" && SES) { const u = say(SES.g.u.map(x => x.t).join("، ")); if (u) u.onend = () => { SES.rep++; const c = $("#mrc"); if (c) c.textContent = toAr(SES.rep); }; }
    else if (a === "rep" && SES) { SES.rep++; $("#mrc").textContent = toAr(SES.rep); if (SES.rep === 10) toast("أحسنت؛ جرّب الآن «الإخفاء التدريجي»"); }
    else if (a === "rec") { try { if (REC && REC.state === "recording") { REC.stop(); el.textContent = "🎙 سجّل تلاوتك"; return; } const st = await navigator.mediaDevices.getUserMedia({ audio: true }), ch = []; REC = new MediaRecorder(st); REC.ondataavailable = x => ch.push(x.data); REC.onstop = () => { st.getTracks().forEach(t => t.stop()); const au = $("#mrecp"); au.src = URL.createObjectURL(new Blob(ch, { type: REC.mimeType })); au.hidden = false; }; REC.start(); el.textContent = "⏹ أوقف التسجيل"; } catch (x) { toast("تعذر الوصول إلى الميكروفون"); } }
    else if (a === "ord" && SES) { const out = $("#mordout"), i = +el.dataset.i, n = out.children.length; const ok = i === n; out.insertAdjacentHTML("beforeend", `<li class="${ok ? "ok" : "no"}">${esc(strip(SES.g.u[i].t))}</li>`); el.remove(); if (!$("#mord").children.length) { const bad = out.querySelectorAll(".no").length; $("#mres").innerHTML = bad ? `<span class="warn">${toAr(bad)} في غير موضعه؛ أعد المحاولة.</span>` : "✔ الترتيب صحيح"; } }
    else if (a === "done" && SES) { const p = P(), id = SES.x.id; p[id] = p[id] || { pd: 1, d: 0, st: day() }; if (SES.k >= (p[id].d || 0)) { p[id].d = SES.k + 1; p[id].log = p[id].log || {}; p[id].log[day()] = (p[id].log[day()] || 0) + 1; const ks = Object.keys(p[id].log); if (ks.length > 60) delete p[id].log[ks[0]]; } p[id].n = SES.ss.length; push();
      if (typeof HZ !== "undefined") HZ.add([{ id: "m" + id + ":" + SES.k, b: SES.x.b, p: SES.g.p, cue: (SES.g.h ? SES.g.h + " — " : "") + strip(SES.g.u[0].t).split(/\s+/).slice(0, 5).join(" ") + " …", text: SES.g.u.map(u => u.t).join("\n") }]);
      toast("أحسنت! أُضيف الورد إلى المراجعة المتباعدة"); location.hash = SES.k < SES.ss.length - 1 && ((p[id].log || {})[day()] || 0) < (+p[id].pd || 1) ? "#/hifz/m/" + id + "/" + (SES.k + 1) : "#/hifz?t=mine"; }
    else if (a === "stop") { if (!confirm("إيقاف حفظ هذا المتن؟ يبقى ما حفظته في بطاقات المراجعة.")) return; delete P()[el.dataset.id]; push(); location.hash = "#/hifz?t=mine"; }
  });
  // مقارنة كلمة بكلمة (بلا تشكيل ولا همزات)
  const toks = s => String(s || "").split(/\s+/).map(w => [nz(w).join(""), w]).filter(x => x[0]);
  function diff(a, b) { const TA = toks(a), TB = toks(b), A = TA.map(x => x[0]), Bw = TB.map(x => x[0]), n = A.length, m = Bw.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === Bw[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0; while (i < n && j < m) { if (A[i] === Bw[j]) { out.push([0, TA[i][1]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { out.push([-1, TA[i][1]]); i++; } else { out.push([1, TB[j][1]]); j++; } }
    while (i < n) out.push([-1, TA[i++][1]]); while (j < m) out.push([1, TB[j++][1]]); return { out, sc: n ? L[0][0] / n : 0 }; }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=mplan],[data-form=mcl],[data-form=mfull],[data-form=madd]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const k = f.dataset.form;
    if (k === "mplan") { const p = P(), id = f.dataset.id; p[id] = Object.assign(p[id] || { d: 0, st: day() }, { pd: +f.pd.value || 1 }); push(); toast("حُفظت خطتك"); location.hash = p[id].d ? "#/hifz?t=mine" : "#/hifz/m/" + id + "/0"; }
    else if (k === "mcl") { let ok = 0, n = 0; f.querySelectorAll("input[data-a]").forEach(i => { n++; const g = nz(i.value).join(" ") === nz(i.dataset.a).join(" "); if (g) ok++; i.classList.toggle("ok", g); i.classList.toggle("no", !g); if (!g) i.title = i.dataset.a; }); $("#mres").textContent = `${toAr(ok)} من ${toAr(n)} — ${ok === n ? "ممتاز" : "مرّر على الخانة الحمراء لترى الصواب"}`; }
    else if (k === "mfull" && SES) { const r = diff(SES.g.u.map(u => strip(u.t).replace(/\.\.\./g, " ")).join(" "), f.t.value), pc = Math.round(r.sc * 100); $("#mres").innerHTML = `<p class="note"><b>المطابقة ${toAr(pc)}٪</b> — ${pc >= 95 ? "حفظ متقن، أحسنت" : pc >= 80 ? "جيد، راجع المواضع المظللة" : "يحتاج إلى مزيد تكرار"}</p><div class="mtext mdiff">${r.out.map(([t, w]) => t === 0 ? esc(w) : t < 0 ? `<del title="سقط من حفظك">${esc(w)}</del>` : `<ins title="زيادة أو خطأ">${esc(w)}</ins>`).join(" ")}</div><p class="mut"><del>المشطوب</del> سقط منك، و<ins>المظلل</ins> زيادة أو خطأ.</p>`; }
    else if (k === "madd") await saveAdd(f);
  }, true);

  /* ---------- الإدارة: إضافة متن وتصنيفه ---------- */
  function adminForm(d) {
    const pre = d.items.find(x => x.id === parse().q.add) || {};
    const sel = (n, arr, v) => `<select name="${n}">${arr.map(([k, t]) => `<option value="${k}"${String(k) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    return `${needGH()}<form class="card" data-form="madd"><h3>${pre.id ? "إتاحة المتن: " + esc(pre.t) : "إضافة متن إلى السلّم"}</h3><input type="hidden" name="id" value="${esc(pre.id || "")}">
      <label>اسم المتن</label><input name="t" required value="${esc(pre.t || "")}">
      <div class="row"><div><label>العلم</label>${sel("sci", d.sci.map(s => [s[0], s[2] + " " + s[1]]), pre.sci)}</div><div><label>المرحلة</label>${sel("lv", d.lv.map(l => [l[0], l[1]]), pre.lv || 1)}</div><div><label>الترتيب في المرحلة</label><input name="ord" type="number" min="1" value="${pre.ord || 1}"></div><div><label>نوعه</label>${sel("kind", [["nathr", "منثور"], ["nazm", "منظوم (أبيات)"]], pre.kind || "nathr")}</div></div>
      <label>المتن من كتاب في المكتبة</label><input name="b" list="mbooks" placeholder="اكتب اسم الكتاب واختره" value="${pre.b && B(pre.b) ? esc(B(pre.b).title) : ""}"><datalist id="mbooks">${BOOKS().filter(x => !x.hidden && !isArt(x)).slice(0, 5000).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist>
      <details${pre.b ? "" : " open"}><summary>أو الصق نص المتن (يُنشأ كتابًا في المكتبة العامة)</summary><label>المؤلف</label><input name="au" value="${esc(pre.au || "")}"><label>النص (للمنظوم: كل بيت في سطر، والشطران بينهما « ... »؛ والسطر الذي يبدأ بـ «# » عنوان باب)</label><textarea name="text" style="min-height:200px" dir="rtl"></textarea><label>المصدر أو الطبعة</label><input name="src"></details>
      <label>حجم الورد (أبيات للمنظوم، أو كلمات للمنثور؛ اختياري)</label><input name="per" type="number" min="1" value="${pre.per || ""}">
      <div class="savebar"><button class="btn p">حفظ</button> <span id="maddst" class="mut"></span></div></form>
      <h3>المتون في السلّم</h3>${d.items.map(x => `<div class="bk"><b>${esc(x.t)}</b><span>${esc((d.sci.find(s => s[0] === x.sci) || [])[1] || "")} • المرحلة ${toAr(x.lv)} • ${toAr(x.ord || 1)}${x.b && B(x.b) ? "" : " • غير متاح"}</span> <a class="btn s" href="#/hifz?t=admin&add=${esc(x.id)}">تعديل</a></div>`).join("")}`;
  }
  async function saveAdd(f) {
    const st = $("#maddst"), fd = new FormData(f); if (!GH.on) { st.textContent = "فعّل الإدارة المباشرة أولًا."; return; }
    try {
      const t = String(fd.get("t")).trim(); let bid = ""; const bt = String(fd.get("b") || "").trim(), text = String(fd.get("text") || "").trim();
      if (bt) { const x = BOOKS().find(y => y.title === bt); if (!x) throw new Error("اختر الكتاب من القائمة"); bid = x.id; }
      else if (text) { st.textContent = "جارٍ إنشاء كتاب المتن…"; const aname = String(fd.get("au") || "").trim(); let aid = (lib.authors.find(a => norm(a.name) === norm(aname)) || {}).id;
        if (!aid && aname) { aid = "u_a" + Date.now().toString(36); await ghSaveAuthor({ id: aid, name: aname, col: "turath", bio: "" }); }
        const pages = splitPages(text, "auto", 1800), toc = []; pages.forEach((pg, i) => pg.split("\n").forEach(l => { if (/^#\s/.test(l)) toc.push({ t: l.replace(/^#\s*/, ""), p: i + 1 }); }));
        bid = "mt" + Date.now().toString(36); await ghSaveBook({ id: bid, title: t, authorId: aid || "a8", topicId: (lib.topics.find(z => z.for !== "articles") || {}).id, col: "turath", type: "book", tags: ["matn"], source: String(fd.get("src") || "").trim() }, pages, toc); }
      const id = String(fd.get("id") || "").trim() || bid || "m" + Date.now().toString(36);
      const it = { id, t, sci: fd.get("sci"), lv: +fd.get("lv"), ord: +fd.get("ord") || 1, kind: fd.get("kind") }; if (bid) it.b = bid; if (+fd.get("per")) it.per = +fd.get("per"); if (fd.get("au")) it.au = String(fd.get("au")).trim();
      await GH.editJSON("data/mutun.json", o => { o = o || D; const ex = o.items.find(x => x.id === id); if (ex) Object.assign(ex, it); else o.items.push(it); return o; }, "حفظ المتون: " + t);
      D = null; SEGC.delete(id); st.textContent = "✓ حُفظ، ويظهر في السلّم خلال دقيقة."; setTimeout(() => location.hash = "#/hifz?t=ladder&s=" + it.sci, 900);
    } catch (e) { st.textContent = e.message; }
  }
  return { view: main, load, segs };
})();
