/* أدوات الدراسة: «اختبارات الكتب» (الباب ١٧ من الوثيقة) و«اختصار الكتب» (خدمة جديدة).
   - النصوص كلها من كتب المكتبة نفسها، ولا يُولَّد نص من خارجها: الاختصار استخلاصي بألفاظ المؤلف،
     ومسودات الأسئلة الآلية تُستخرج من جمل الكتاب ولا تُعرض للأعضاء قبل مراجعة الإدارة واعتمادها.
   - البيانات: data/quizzes/index.json وdata/quizzes/<الكتاب>.json. نتائج العضو تُحفظ على جهازه فقط (خصوصية). */
const LRN = (() => {
  const STOP = new Set("في من على إلى الى عن مع هذا هذه ذلك تلك الذي التي الذين اللذين ما ماذا لم لن لا إن ان أن كان كانت يكون قد قال قالوا ثم أو او بل كل بعض غير عند إذا اذا إذ حتى وهو وهي هو هي هم هن أنه انه أنها انها به بها له لها فيه فيها منه منها عليه عليها ولا وما ومن وفي وقد وأن وإن وكان والله الله تعالى رضي عنه عنهم صلى وسلم عليه السلام رحمه بن ابن أبو ابو أبي ابي أي اي ليس كما فإن فان لأن لان وهذا وذلك لكن ولكن إلا الا يا".split(" "));
  const words = s => norm(s).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const clean = t => String(t || "").split(/^\s*_{4,}\s*$/m)[0];            // بلا الحواشي
  // الكتاب إلى أقسام (بحسب العناوين) وجمل مع رقم الصفحة
  function sections(b) {
    const out = []; let cur = { h: "", p: 1, s: [] };
    (b.pages || []).forEach((pg, i) => {
      const body = typeof joinLines === "function" ? joinLines(clean(pg)) : clean(pg);
      body.split("\n").forEach(line => {
        const l = line.trim(); if (!l) return;
        if (/^#{1,3}\s/.test(l)) { if (cur.s.length || cur.h) out.push(cur); cur = { h: l.replace(/^#+\s*/, "").replace(/\*\*/g, ""), p: i + 1, s: [] }; return; }
        l.replace(/\*\*/g, "").split(/(?<=[.!؟?:؛])\s+/).forEach(t => { t = t.trim(); if (t.length >= 20) cur.s.push({ t, p: i + 1 }); });
      });
    });
    if (cur.s.length || cur.h) out.push(cur);
    return out;
  }
  // وزن الكلمات: تكرارها في الكتاب مقابل انتشارها في الأقسام (tf-idf مبسط)
  function weights(secs) {
    const tf = new Map(), df = new Map(), N = Math.max(1, secs.length);
    secs.forEach(sc => { const seen = new Set(); sc.s.forEach(x => words(x.t).forEach(w => { tf.set(w, (tf.get(w) || 0) + 1); seen.add(w); })); seen.forEach(w => df.set(w, (df.get(w) || 0) + 1)); });
    const W = new Map(); tf.forEach((n, w) => W.set(w, Math.log(1 + n) * Math.log(1 + N / (df.get(w) || 1))));
    return W;
  }
  const scoreOf = (t, W) => { const ws = words(t); if (!ws.length) return 0; let s = 0; new Set(ws).forEach(w => s += W.get(w) || 0); return s / Math.sqrt(ws.length + 4); };

  /* ================= اختصار الكتب ================= */
  const RATIOS = [[50, "نصف الكتاب"], [30, "ثلث تقريبًا"], [20, "الخُمس"], [10, "العُشر"], [5, "خلاصة مركزة"], [0, "موجز دقيق (أهم جملة في كل باب)"]];
  function abridge(b, r) {
    const secs = sections(b), W = weights(secs), nw = t => t.split(/\s+/).length;
    const ow = secs.reduce((n, sc) => n + sc.s.reduce((m, x) => m + nw(x.t), 0), 0), budget = Math.max(40, Math.round(ow * (r || 3) / 100));
    // ترتيب عام للجمل بوزنها، مع تقديم أول جملة في كل باب، ثم الانتقاء حتى تبلغ نسبة الاختصار المطلوبة من عدد الكلمات
    const all = []; secs.forEach((sc, si) => sc.s.forEach((x, i) => all.push({ ...x, si, i, v: scoreOf(x.t, W) * (i === 0 ? 1.3 : 1), w: nw(x.t) })));
    let used = 0; const pick = new Set();
    // أولًا: أهم جملة من كل باب (ليشمل المختصر أبواب الكتاب)، حتى نصف المقدار؛ ثم الأعلى وزنًا من الكتاب كله
    const best = secs.map((_, si) => all.filter(x => x.si === si).sort((a, c) => c.v - a.v)[0]).filter(Boolean).sort((a, c) => c.v - a.v);
    for (const x of best) { if (used + x.w > budget * .55) continue; pick.add(x); used += x.w; }
    for (const x of all.slice().sort((a, c) => c.v - a.v)) { if (used >= budget) break; if (pick.has(x)) continue; if (used + x.w > budget * 1.08 && used > budget * .6) continue; pick.add(x); used += x.w; }
    const res = secs.map((sc, si) => ({ h: sc.h, p: sc.p, s: all.filter(x => x.si === si && pick.has(x)) })).filter(x => x.s.length || (r === 0 && x.h));
    return { res, all: all.length, total: pick.size, ow, sw: used };
  }
  const absHtml = (A, pg) => A.res.map(sc => `${sc.h ? `<h3>${esc(sc.h)}${pg ? ` <small>(ص ${toAr(sc.p)})</small>` : ""}</h3>` : ""}${sc.s.map(x => `<p>${esc(x.t)}${pg ? ` <small class="pref">(ص ${toAr(x.p)})</small>` : ""}</p>`).join("")}`).join("");
  async function vSummary(q) {
    const b = q.b && B(q.b), r = RATIOS.some(x => String(x[0]) === q.r) ? +q.r : 20;
    const pick = `<form class="sbox" data-form="sumpick" style="max-width:none"><input name="t" list="sumbooks" placeholder="اكتب اسم الكتاب ثم اختره" aria-label="اختر الكتاب" value="${b ? esc(b.setTitle && b.vol ? b.title : b.title) : ""}"><datalist id="sumbooks">${BOOKS().filter(x => !x.hidden && !isArt(x)).slice(0, 4000).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist><button class="btn p">اختيار</button></form>`;
    const intro = `<h2>اختصار الكتب</h2><p class="mut">اختر كتابًا ونسبة الاختصار، فتحصل على مختصر بألفاظ المؤلف نفسه: تُنتقى أهم جمل كل باب آليًا مع الإبقاء على عناوين الأبواب وترتيبها، ومع رقم الصفحة للرجوع إلى الأصل. لا يُضاف إلى الكتاب كلام من خارجه.</p>${pick}`;
    if (!b) { const sug = BOOKS().filter(x => !x.hidden && !isArt(x) && !x.vol && (x.n || 0) >= 20).sort((a, c) => (bc(a) === "dawah" ? 0 : 1) - (bc(c) === "dawah" ? 0 : 1) || (c.added || "").localeCompare(a.added || "")).slice(0, 12);
      return view(intro + `<div class="lvls"><div class="lvl"><b>١. اختر الكتاب</b><span>من القائمة أو من «أدوات القراءة» داخل أي كتاب</span></div><div class="lvl"><b>٢. اختر النسبة</b><span>من النصف إلى موجز دقيق بأهم جملة في كل باب</span></div><div class="lvl"><b>٣. اقرأ أو حمّل PDF</b><span>بهوية المكتبة ورقم صفحة كل جملة في الأصل</span></div></div>
       <h3>كتب مقترحة للاختصار</h3><div class="newg">${sug.map(x => `<a class="newc" style="text-decoration:none;color:inherit" href="#/summary?b=${encodeURIComponent(x.id)}&r=20"><b>${esc(x.title)}</b><br><span class="mut">${esc(A_(x))}</span></a>`).join("")}</div>`); }
    view(intro + `<p class="mut">جارٍ تحميل الكتاب…</p>`);
    try { await loadBook(b.id); } catch (e) { return view(intro + `<div class="note">تعذر تحميل نص الكتاب: ${esc(e.message)}</div>`); }
    const A = abridge(b, r), u = v => `#/summary?b=${encodeURIComponent(b.id)}&r=${v}`;
    view(intro + `<h3 style="margin-top:14px">${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title)} <span class="mut">— ${esc(A_(b))}</span></h3>
     <div class="chips" role="radiogroup" aria-label="نسبة الاختصار">${RATIOS.map(([v, l]) => `<a class="chip${v === r ? " x" : ""}" role="radio" aria-checked="${v === r}" href="${u(v)}">${v ? toAr(v) + "٪ — " : ""}${l}</a>`).join("")}</div>
     <p class="mut">المختصر: ${toAr(A.sw)} كلمة من ${toAr(A.ow)} (${toAr(Math.round(A.sw * 100 / Math.max(1, A.ow)))}٪)، في ${toAr(A.res.length)} بابًا.</p>
     <div class="row" style="margin:6px 0 12px"><button class="btn p" data-act="sumpdf" data-b="${esc(b.id)}" data-r="${r}">تحميل المختصر PDF</button> <a class="btn" href="#/book/${esc(b.id)}/1">قراءة الأصل</a></div>
     <div id="sumorg"></div>
     <article class="sumtx">${absHtml(A, true) || '<div class="note">لا يتسع نص هذا الكتاب للاختصار.</div>'}</article>`);
    sumOrg(b);
  }
  // «الخلاصة المنظمة»: خلاصة الكتاب وأقسامه وأبوابه من تشجيره (data/tashjir) — صياغة آلية دققت كل نقطة بنص صفحتها،
  // مع رابط كل باب إلى موضعه؛ وإن لم يُشجَّر الكتاب بعد يطلبه المشرف بضغطة فيُعدّ آليًا.
  async function sumOrg(b) {
    const box = $("#sumorg"); if (!box || typeof TSJ === "undefined") return;
    const L = await TSJ.index(), inf = L[b.id];
    if (!inf || !(inf.ok || isAdmin())) {
      box.innerHTML = isAdmin() && typeof GH !== "undefined" && GH.on ? `<div class="note">لا توجد خلاصة منظمة لهذا الكتاب بعد. <button class="btn s" data-act="sumreq" data-b="${esc(b.id)}">اطلب إعداد الخلاصة والتشجير</button> <span id="sumreqs" class="mut"></span></div>` : ""; return; }
    const m = await TSJ.map(b.id); if (!m || !m.c) return;
    const pg = p => `<a href="#/book/${esc(b.id)}/${(p && p[0]) || 1}">${p && p[0] ? "ص " + toAr(p[0]) + (p[1] && p[1] !== p[0] ? "–" + toAr(p[1]) : "") : ""}</a>`;
    box.innerHTML = `<details class="sumorg" open><summary><b>الخلاصة المنظمة للكتاب</b> <span class="mut">— صياغة آلية مدققة بنص الصفحات، فراجع الأصل عند الاستشهاد</span></summary>
      ${m.s ? `<p class="brief">${esc(m.s)}</p>` : ""}
      ${m.c.map(g => `<section><h4>${esc(g.t)} <small class="mut">${pg(g.p)}</small></h4>${g.s ? `<p>${esc(g.s)}</p>` : ""}<ul>${(g.c || []).map(ch => `<li><b>${esc(ch.t)}</b> <small class="mut">${pg(ch.p)}</small>${ch.s ? `<br>${esc(ch.s)}` : ""}</li>`).join("")}</ul></section>`).join("")}
      <p><a class="btn s" href="#/tashjir/${esc(b.id)}">عرض التشجير التفصيلي</a></p></details>`;
  }
  document.addEventListener("click", async e => {
    const el = e.target.closest('[data-act="sumreq"]'); if (!el) return; e.preventDefault(); el.disabled = true;
    try { await GH.editJSON("data/tashjir/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => (x.id || x) !== el.dataset.b); o.items.unshift({ id: el.dataset.b }); return o; }, "طلب خلاصة وتشجير: " + el.dataset.b); const s = $("#sumreqs"); if (s) s.textContent = "أُضيف في أول الطابور؛ يُعدّ خلال ساعات."; }
    catch (x) { toast(x.message); el.disabled = false; }
  });
  const A_ = b => (typeof A === "function" ? A(b.authorId).name : "") || "";
  function pdf(id, r) {
    const b = B(id); if (!b || !b.pages) return;
    const A2 = abridge(b, r), o = location.origin, lbl = (RATIOS.find(x => x[0] === r) || [r, ""])[1], day = today(), title = b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مختصر ${esc(title)} — مكتبة الدعوة السلفية الرقمية</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap">
<style>@page{size:A4;margin:22mm 16mm 20mm}body{font-family:Amiri,'Traditional Arabic',serif;font-size:14pt;line-height:1.95;color:#14231f}
.cover{text-align:center;border:3px double #0f5c4d;border-radius:14px;padding:26px 18px;margin-bottom:18px;page-break-after:always;min-height:230mm;display:flex;flex-direction:column;justify-content:center;gap:10px}
.cover img{width:120px;margin:0 auto}.cover h1{color:#0f5c4d;font-size:26pt;margin:6px 0}.cover .au{font-size:16pt}.cover .m{color:#5b6b66;font-size:12pt}
h3{color:#0f5c4d;border-bottom:2px solid #b88a2e;padding-bottom:3px;margin:18px 0 6px;page-break-after:avoid}p{margin:6px 0;text-align:justify}small{color:#7a6a4a;font-size:9pt}
.hd{position:fixed;top:-14mm;left:0;right:0;display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:#0f5c4d;border-bottom:1px solid #b88a2e;padding-bottom:2mm}.hd img{height:9mm}
.ft{position:fixed;bottom:-13mm;left:0;right:0;text-align:center;font-size:8.5pt;color:#5b6b66;border-top:1px solid #d6dfda;padding-top:2mm}
.wm{position:fixed;top:45%;left:0;right:0;text-align:center;font-size:54pt;color:rgba(15,92,77,.05);transform:rotate(-25deg);z-index:-1}</style></head><body>
<div class="hd"><span>مكتبة الدعوة السلفية الرقمية</span><img src="${o}/assets/logo-sdsl-128.png" alt=""><span>dawahlibrary.org</span></div>
<div class="ft">مختصر استخلاصي بألفاظ المؤلف من «${esc(title)}» — أُعدّ آليًا في مكتبة الدعوة السلفية الرقمية (dawahlibrary.org) بتاريخ ${day}. يُنشر للانتفاع العلمي مع العزو، ولا يُغني عن الأصل.</div>
<div class="wm">مكتبة الدعوة السلفية الرقمية</div>
<section class="cover"><img src="${o}/assets/logo-sdsl-128.png" alt="شعار المكتبة"><div class="m">مكتبة الدعوة السلفية الرقمية</div><h1>مختصر ${esc(title)}</h1><div class="au">${esc(A_(b))}</div>
<div class="m">نسبة الاختصار: ${r ? toAr(r) + "٪ — " : ""}${esc(lbl)} • ${toAr(A2.sw)} كلمة من ${toAr(A2.ow)}</div><div class="m">الجمل منقولة بنصها من الكتاب، مع رقم صفحتها في الأصل.<br>رابط الأصل: ${o}/book/${esc(b.id)}/1</div></section>
${absHtml(A2, true)}<script>onload=()=>setTimeout(()=>print(),600)<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html); w.document.close();
  }

  /* ================= اختبارات الكتب ================= */
  const LV = { easy: "سهل", mid: "متوسط", hard: "متقدم" }, TY = { mcq: "اختيار من متعدد", tf: "صح أم خطأ", cloze: "أكمل النص" };
  const IDX = "data/quizzes/index.json", QF = id => "data/quizzes/" + id + ".json";
  const getJ = async (p, fresh) => { try { const r = await fetch(p + (fresh ? "?fresh=1" : "")); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // مسودة آلية: جمل من الكتاب، والكلمة المحذوفة من أعلى كلماته وزنًا؛ والبدائل من كلمات الكتاب نفسه
  function draft(b, n = 30) {
    const secs = sections(b), W = weights(secs), pool = [];
    secs.forEach(sc => sc.s.forEach(x => { if (x.t.length >= 40 && x.t.length <= 200 && !/[«»"]/.test(x.t.slice(0, 2))) pool.push({ ...x, v: scoreOf(x.t, W) }); }));
    pool.sort((a, c) => c.v - a.v);
    // الصيغة الأصلية للكلمة (بهمزاتها) لتظهر البدائل بإملاء الكتاب نفسه فلا تدل على الجواب
    const surf = new Map(); secs.forEach(sc => sc.s.forEach(x => x.t.split(/\s+/).forEach(w => { const o = w.replace(/[^\u0621-\u064A]/g, ""), k = norm(o).replace(/[^\u0621-\u064A]/g, ""); if (o && !surf.has(k)) surf.set(k, o); })));
    const top = [...W.entries()].sort((a, c) => c[1] - a[1]).slice(0, 300).map(e => surf.get(e[0]) || e[0]);
    const out = [], used = new Set();
    for (const x of pool) {
      if (out.length >= n) break;
      const toks = x.t.split(/\s+/), cand = toks.map((w, i) => [i, w, W.get(norm(w).replace(/[^ء-ي]/g, "")) || 0]).filter(c => c[1].replace(/[^ء-ي]/g, "").length > 3 && c[2] > 0).sort((a, c) => c[2] - a[2])[0];
      if (!cand) continue; const key = cand[1].replace(/[^ء-يً-ْ]/g, ""), nk = norm(key); if (used.has(nk)) continue; used.add(nk);
      const dis = shuffle(top.filter(w => norm(w) !== nk && Math.abs(w.length - key.length) <= 2)).slice(0, 3);
      if (dis.length < 3) continue;
      const blank = toks.map((w, i) => i === cand[0] ? w.replace(key, "……") : w).join(" "), k = out.length % 3;
      if (k === 0) out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "mcq", lvl: "easy", q: blank, opts: shuffle([key, ...dis]), a: key, p: x.p, ctx: x.t });
      else if (k === 1) { const tr = Math.random() < .5; out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "tf", lvl: "mid", q: tr ? x.t : toks.map((w, i) => i === cand[0] ? w.replace(key, dis[0]) : w).join(" "), a: tr ? "صح" : "خطأ", p: x.p, ctx: x.t }); }
      else out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "cloze", lvl: "hard", q: blank, a: key, p: x.p, ctx: x.t });
    }
    return out.map(q => Object.assign(q, { ok: false, auto: true }));
  }
  const R = () => (S.qres = S.qres || []);
  async function vQuizzes(q, id) {
    const ix = (await getJ(IDX)) || { items: [] }, items = (ix.items || []).filter(x => x.n > 0 && B(x.b));
    if (!id) {
      const mine = R().slice(-12).reverse();
      return view(`<h2>اختبارات الكتب</h2><p class="mut">اختبر فهمك لكتب المكتبة بثلاثة مستويات: سهل ومتوسط ومتقدم. الأسئلة مأخوذة من نص الكتاب ومراجَعة من إدارة المكتبة، ولكل سؤال رقم صفحته للرجوع إليه. نتائجك تُحفظ على جهازك فقط.</p>
       <div class="lvls">${[["easy","سهل","أسئلة قصيرة، مع زر مساعدة يحيل إلى الصفحة"],["mid","متوسط","نصوص أطول ومساعدة عند الحاجة"],["hard","متقدم","مسائل علمية دقيقة بلا مساعدة"]].map(([k,n,d])=>`<div class="lvl lv-${k}"><b>${n}</b><span>${d}</span></div>`).join("")}</div>
       ${items.length ? [["dawah","كتب مشايخ الدعوة السلفية"],["turath","المكتبة العامة"]].map(([c,cn])=>{const L2=items.filter(x=>bc(B(x.b))===c);return L2.length?`<h3>${cn} <span class="mut">(${toAr(L2.length)})</span></h3><div class="newg">${L2.map(x => { const b = B(x.b); return `<section class="newc"><h3>${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title.replace(b.setTitle,"").replace(/^\s*[—-]\s*/,"") : b.title)}</h3><span class="mut">${esc(A_(b))} • ${toAr(x.n)} سؤالًا</span><div class="chips" style="margin-top:8px">${Object.keys(LV).filter(l => (x.lv || {})[l]).map(l => `<a class="chip" href="#/quizzes/${esc(x.b)}?l=${l}">${LV[l]} (${toAr(x.lv[l])})</a>`).join("")}</div></section>`; }).join("")}</div>`:""}).join("")+'<p class="mut">الأسئلة منقولة بنصها من مواضع «السؤال والجواب» في الكتب، وبدائلها من أجوبة الكتاب نفسه، وتراجعها الإدارة وتضيف إليها.</p>' : '<div class="note">لم تُعتمد اختبارات بعد. تُعدّها الإدارة من «الإدارة ← اختبارات الكتب» وتراجعها قبل نشرها.</div>'}
       ${mine.length ? `<h3>نتائجي السابقة</h3>${mine.map(m => { const b = B(m.b); return `<div class="bk"><b>${esc(b ? b.title : m.b)} — ${LV[m.l] || ""}</b><span>${toAr(m.s)} من ${toAr(m.n)} • ${esc(m.at)}</span> <a class="btn s" href="#/quizzes/${esc(m.b)}?l=${m.l}">إعادة</a></div>`; }).join("")}<button class="btn s" data-act="qzclear">مسح نتائجي من هذا الجهاز</button>` : ""}`);
    }
    const b = B(id), d = await getJ(QF(id)), l = LV[q.l] ? q.l : "easy";
    const qs = shuffle(((d && d.qs) || []).filter(x => x.ok && x.lvl === l)).slice(0, 10);
    if (!b || !qs.length) return view(`<p><a href="#/quizzes">اختبارات الكتب</a> ›</p><div class="note">لا توجد أسئلة معتمدة لهذا المستوى بعد.</div>`);
    CUR = { b: id, l, qs };
    view(`<p><a href="#/quizzes">اختبارات الكتب</a> › ${esc(b.title)}</p><h2>اختبار: ${esc(b.title)} <span class="mut">— ${LV[l]}</span></h2>
     <form data-form="qzrun" class="qz">${qs.map((x, i) => `<fieldset class="qq" data-i="${i}"><legend><b>${toAr(i + 1)}.</b> <span class="mut">${TY[x.type]}</span></legend><p class="qt">${esc(x.q)}</p>
      ${x.type === "mcq" ? x.opts.map(o => `<label class="inl qo"><input type="radio" name="a${i}" value="${esc(o)}" required> ${esc(o)}</label>`).join("") : x.type === "tf" ? ["صح", "خطأ"].map(o => `<label class="inl qo"><input type="radio" name="a${i}" value="${o}" required> ${o}</label>`).join("") : `<input name="a${i}" required placeholder="اكتب الكلمة الناقصة" autocomplete="off">`}
      ${l !== "hard" ? `<details class="qh"><summary>مساعدة</summary><p class="mut">راجع <a href="#/book/${esc(id)}/${x.p}" target="_blank">الصفحة ${toAr(x.p)} من الكتاب</a>.</p></details>` : ""}<div class="qr" hidden></div></fieldset>`).join("")}
      <div class="savebar"><button class="btn p">تصحيح الإجابات</button></div></form><div id="qzres"></div>`);
  }
  let CUR = null;
  function grade(f) {
    if (!CUR) return; const fd = new FormData(f); let s = 0;
    CUR.qs.forEach((x, i) => {
      const v = String(fd.get("a" + i) || "").trim(), ok = norm(v).replace(/[^ء-ي]/g, "") === norm(x.a).replace(/[^ء-ي]/g, ""), el = f.querySelector(`.qq[data-i="${i}"] .qr`);
      if (ok) s++; el.hidden = false; el.className = "qr " + (ok ? "ok" : "no");
      el.innerHTML = ok ? "✔ إجابة صحيحة" : `✘ الإجابة الصحيحة: <b>${esc(x.a)}</b>${x.type === "tf" && x.ctx ? `<br><span class="mut">نص الكتاب: «${esc(x.ctx)}»</span>` : ""} — <a href="#/book/${esc(CUR.b)}/${x.p}" target="_blank">ص ${toAr(x.p)}</a>`;
    });
    const n = CUR.qs.length, pc = Math.round(s * 100 / n);
    const fb = pc >= 90 ? "ممتاز، فهمٌ متمكن للكتاب. جرّب المستوى الأعلى." : pc >= 70 ? "جيد جدًا. راجع الأسئلة التي أخطأت فيها من صفحاتها." : pc >= 50 ? "جيد. يحسن أن تعيد قراءة المواضع المشار إليها ثم تعيد الاختبار." : "تحتاج إلى مراجعة الكتاب. ابدأ بالصفحات المشار إليها ثم أعد المحاولة.";
    $("#qzres").innerHTML = `<div class="note qzsum"><b>نتيجتك: ${toAr(s)} من ${toAr(n)} (${toAr(pc)}٪)</b><br>${fb}</div><a class="btn" href="#/quizzes/${esc(CUR.b)}?l=${CUR.l}&r=${Date.now()}">اختبار جديد</a> <a class="btn" href="#/quizzes">كل الاختبارات</a>`;
    R().push({ b: CUR.b, l: CUR.l, s, n, at: today() }); if (S.qres.length > 100) S.qres = S.qres.slice(-100); saveS();
    f.querySelector(".savebar").hidden = true; $("#qzres").scrollIntoView({ behavior: "smooth" });
  }
  // ---------- الإدارة ----------
  async function admin(q) {
    const id = q.b && B(q.b) ? q.b : "", ix = (await getJ(IDX, true)) || { items: [] };
    let h = `<p class="mut">اختر كتابًا، ثم أنشئ مسودة أسئلة آلية من نصه أو أضف أسئلة يدويًا. لا يظهر سؤال للأعضاء قبل تعليمه «معتمد» بعد مراجعته والتأكد من مطابقته للنص ووضوح إجابته.</p>
     <form data-form="qzpick" class="sbox" style="max-width:none"><input name="t" list="qzbooks" placeholder="اسم الكتاب" value="${id ? esc(B(id).title) : ""}"><datalist id="qzbooks">${BOOKS().filter(x => !x.hidden && !isArt(x)).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist><button class="btn">فتح</button></form>
     ${(ix.items || []).length ? `<p class="mut">كتب لها اختبارات: ${ix.items.map(x => `<a href="#/admin?t=quizzes&b=${esc(x.b)}">${esc((B(x.b) || {}).title || x.b)} (${toAr(x.n)})</a>`).join(" • ")}</p>` : ""}`;
    if (!id) return h;
    const d = (await getJ(QF(id), true)) || { b: id, qs: [] };
    QD = d;
    h += `<h3>${esc(B(id).title)} — ${toAr(d.qs.length)} سؤالًا (${toAr(d.qs.filter(x => x.ok).length)} معتمد)</h3>
     <div class="row"><button class="btn" data-act="qzdraft" data-b="${esc(id)}">إنشاء مسودة آلية (٣٠ سؤالًا)</button> <button class="btn" data-act="qzadd">سؤال يدوي</button></div>
     <form data-form="qzsave" data-b="${esc(id)}"><div id="qzlist">${d.qs.map(rowQ).join("")}</div><div class="savebar"><button class="btn p">حفظ الأسئلة</button> <span id="qzst" class="mut"></span></div></form>`;
    return h;
  }
  let QD = null;
  const rowQ = (x, i) => `<fieldset class="qzrow" data-id="${esc(x.id)}"><div class="row"><select name="type">${Object.entries(TY).map(([k, v]) => `<option value="${k}"${k === x.type ? " selected" : ""}>${v}</option>`).join("")}</select><select name="lvl">${Object.entries(LV).map(([k, v]) => `<option value="${k}"${k === x.lvl ? " selected" : ""}>${v}</option>`).join("")}</select><input name="p" type="number" min="1" value="${x.p || 1}" title="الصفحة" style="width:90px"><label class="inl"><input type="checkbox" name="ok"${x.ok ? " checked" : ""}> معتمد</label><button type="button" class="btn s" data-act="qzdel">حذف</button></div>
    <label>السؤال (استعمل …… لموضع الكلمة الناقصة)</label><textarea name="q" rows="2">${esc(x.q)}</textarea>
    <div class="row"><div><label>البدائل (للاختيار من متعدد، يفصل بينها |)</label><input name="opts" value="${esc((x.opts || []).join(" | "))}"></div><div><label>الإجابة الصحيحة</label><input name="a" value="${esc(x.a)}"></div></div>${x.ctx ? `<p class="mut">نص الكتاب: «${esc(x.ctx)}»</p>` : ""}</fieldset>`;
  function collect(f) {
    return [...f.querySelectorAll(".qzrow")].map(r => { const g = n => r.querySelector(`[name=${n}]`); const prev = (QD.qs || []).find(x => x.id === r.dataset.id) || {};
      const o = { id: r.dataset.id, type: g("type").value, lvl: g("lvl").value, p: +g("p").value || 1, ok: g("ok").checked, q: g("q").value.trim(), a: g("a").value.trim() };
      if (o.type === "mcq") o.opts = g("opts").value.split("|").map(s => s.trim()).filter(Boolean); if (o.type === "tf" && !/^(صح|خطأ)$/.test(o.a)) o.a = "صح";
      if (prev.ctx) o.ctx = prev.ctx; if (prev.auto) o.auto = true; return o; }).filter(o => o.q && o.a);
  }
  async function save(f) {
    const id = f.dataset.b, qs = collect(f), st = $("#qzst");
    const bad = qs.filter(x => x.ok && x.type === "mcq" && (!x.opts || x.opts.length < 2 || !x.opts.includes(x.a)));
    if (bad.length) { st.textContent = "سؤال اختيار من متعدد معتمد لا تتضمن بدائله الإجابة الصحيحة؛ صححه أولًا."; return; }
    st.textContent = "جارٍ الحفظ…";
    try {
      await GH.editJSON(QF(id), () => ({ v: 1, b: id, at: today(), qs }), "اختبارات: " + B(id).title + " (" + qs.filter(x => x.ok).length + " معتمد)");
      const lv = {}; qs.filter(x => x.ok).forEach(x => lv[x.lvl] = (lv[x.lvl] || 0) + 1);
      await GH.editJSON(IDX, d => { d = d && d.items ? d : { v: 1, items: [] }; d.items = d.items.filter(x => x.b !== id); if (qs.length) d.items.push({ b: id, n: qs.filter(x => x.ok).length, lv }); return d; }, "فهرس الاختبارات");
      st.textContent = "حُفظ ✓";
    } catch (e) { st.textContent = "تعذر الحفظ: " + e.message; }
  }
  // ---------- الربط بالواجهة ----------
  const pickId = t => { const x = BOOKS().find(b => b.title === String(t).trim()); return x && x.id; };
  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form]"); if (!f) return; const k = f.dataset.form; if (!/^(sumpick|qzrun|qzpick|qzsave)$/.test(k)) return;
    e.preventDefault(); e.stopImmediatePropagation(); const fd = new FormData(f);
    if (k === "sumpick") { const id = pickId(fd.get("t")); if (id) location.hash = "#/summary?b=" + encodeURIComponent(id) + "&r=20"; else toast("اختر اسم الكتاب من القائمة"); }
    else if (k === "qzpick") { const id = pickId(fd.get("t")); if (id) location.hash = "#/admin?t=quizzes&b=" + encodeURIComponent(id); else toast("اختر اسم الكتاب من القائمة"); }
    else if (k === "qzrun") grade(f); else if (k === "qzsave") save(f);
  }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act^=qz],[data-act=sumpdf]"); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); const a = el.dataset.act;
    if (a === "sumpdf") pdf(el.dataset.b, +el.dataset.r);
    else if (a === "qzclear") { if (confirm("مسح نتائج الاختبارات من هذا الجهاز؟")) { S.qres = []; saveS(); route(); } }
    else if (a === "qzdraft") { el.disabled = true; el.textContent = "جارٍ التحليل…"; try { const b = await loadBook(el.dataset.b), qs = draft(b); QD.qs = QD.qs.concat(qs); $("#qzlist").insertAdjacentHTML("beforeend", qs.map(rowQ).join("")); el.textContent = "أُضيفت " + toAr(qs.length) + " مسودة — راجعها ثم احفظ"; } catch (err) { el.disabled = false; el.textContent = "تعذر: " + err.message; } }
    else if (a === "qzadd") { const x = { id: "q" + Date.now().toString(36), type: "mcq", lvl: "easy", q: "", a: "", opts: [], p: 1, ok: false }; QD.qs.push(x); $("#qzlist").insertAdjacentHTML("beforeend", rowQ(x)); }
    else if (a === "qzdel") el.closest(".qzrow").remove();
  }, true);
  return { vSummary, vQuizzes, admin, abridge, draft, sections };
})();
