/* مطبعة المجلة — بناء العدد وإخراجه صفحاتٍ A4 بـ Paged.js، ثم إصلاح الانقسامات وفحص الجودة.
   المعاملات: ?issue=<معرّف العدد> (من data/majalla.json) أو ?src=draft (مسودة محفوظة من محرر العدد في localStorage)
              &mode=digital|print (رقمي للشاشة، أو للطباعة بخلفية بيضاء وحواف قص 3مم) &auto=1 (للتصدير الآلي بلا واجهة)
   الناتج: window.MJP_DONE = {pages, issues, passes, fixes} — تقرؤه أداة التصدير tools/majalla-pdf.js. */
(async function () {
  "use strict";
  const { esc, toAr, ordinal, fmtDate, icon, star8, patternURL, motif, STY, NCATS, SITE, PUBLISHER } = MJP;
  const Q = new URLSearchParams(location.search), MODE = Q.get("mode") === "print" ? "print" : "digital", AUTO = Q.get("auto") === "1";
  const BASE = "../";
  document.documentElement.classList.add("mode-" + MODE);
  if (AUTO) document.documentElement.classList.add("auto");
  const ui = document.getElementById("mpui"), stat = t => { const s = document.getElementById("mpst"); if (s) s.textContent = t; };

  // ---------- البيانات ----------
  let D, x;
  try {
    D = await fetch(BASE + "data/majalla.json", { cache: "no-cache" }).then(r => r.json());
    if (Q.get("src") === "draft") { try { x = JSON.parse(localStorage.getItem("majpress:draft") || "null"); } catch (e) { x = null; } }
    if (!x) x = (D.issues || []).find(i => i.id === Q.get("issue")) || (D.issues || []).slice().sort((a, b) => (b.no || 0) - (a.no || 0))[0];
    if (!x) throw new Error("لا يوجد عدد");
  } catch (e) { stat("تعذر تحميل العدد: " + e.message); window.MJP_DONE = { error: e.message }; return; }
  const NAME = D.name || "مجلة مكتبة الدعوة السلفية";
  document.title = `${NAME} — العدد ${toAr(x.no || "")}: ${x.title || x.theme || ""}`;
  stat("جارٍ جمع مواد العدد من المكتبة…");
  const news = await fetch(BASE + "data/majalla-news.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  const C = await MJP.compile(x, MJP.Library(BASE), { news });

  // ---------- البناء ----------
  // تنبيه: Paged.js يقيس الصفحة الأولى بهوامش الصفحة العادية قبل تطبيق صفحة الغلاف، فلا يبدأ عنصر في الغلاف تحت ٢٤٠مم (وإلا نُقل إلى صفحة ثانية)
  const issueLine = `العدد ${ordinal(x.no || 1)} • ${x.hijri ? esc(x.hijri) : esc(fmtDate(x.date))}`;
  const secs = C.secs.filter(s => s.items.length || s.live === "news");
  const allItems = secs.flatMap(s => s.items);
  const nDawah = allItems.filter(o => o.col === "مكتبة الدعوة السلفية").length, nGen = allItems.filter(o => o.col === "المكتبة العامة").length;
  const tone = s => s.corner === "kids" ? "tone-kids" : s.corner === "women" ? "tone-women" : /الأسرة/.test(s.t) ? "tone-soft" : "";
  const LET = ["أ", "ب", "ج", "د", "هـ"];
  // العنوان: الأقواس القرآنية والآية بخط أميري
  const ttl = t => esc(t).replace(/﴿([^﴾]*)﴾/g, '<span class="ay">﴿$1﴾</span>');

  function cover() {
    const hl = []; secs.forEach(s => { if (s.items[0] && hl.length < 8 && s.items[0].st !== "quiz") hl.push(s.items[0]); });
    return `<section class="cover" style="--pat-gold:${patternURL("#e1c98d", .16)}"><div class="bg"></div><div class="frame"></div>
      <div class="top"><img src="${BASE}assets/logo-sdsl.png" alt="شعار المكتبة"><div class="pub"><b>${esc(PUBLISHER)}</b>مجلة علمية ثقافية دورية</div><div class="no"><small>العدد</small><b>${toAr(x.no || "")}</b></div></div>
      <div class="mast"><div class="nm">${esc(NAME)}</div><div class="tg">من الوحيين وتراث السلف ومؤلفات مشايخ الدعوة السلفية</div>
        <div class="dt">${x.hijri ? `<span>${esc(x.hijri)}</span><i>${star8(30)}</i>` : ""}<span>${esc(fmtDate(x.date))}</span></div></div>
      <div class="art">${motif(C.motif)}</div>
      <div class="theme"><div class="kk">موضوع العدد</div><h1>${esc(x.title || x.theme || "")}</h1>${x.sub ? `<p>${esc(x.sub)}</p>` : ""}</div>
      <div class="inside"><div class="h2">في هذا العدد</div><ol>${hl.map(o => `<li><a href="#${o.id}"><span>${ttl(o.title)}</span></a></li>`).join("")}</ol>
      <div class="foot"><span>${esc(SITE.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span><span>${toAr(allItems.length)} مادة في ${toAr(secs.length)} بابًا</span></div></div></section>`;
  }

  function toc() {
    const rows = secs.map((s, i) => `<div class="toc-sec"><div class="h3"><span class="n">${toAr(String(i + 1).padStart(2, "0"))}</span><a href="#${s.id}">${esc(s.t)}</a></div>${s.live === "news" && !s.items.length ? `<div class="toc-row"><span class="t">أبرز أخبار الأسبوع</span><span class="ld"></span><a class="pg" href="#${s.id}"></a></div>` : ""}${s.items.map(o => `<div class="toc-row"><span class="t">${ttl(o.title)}${o.author ? `<small>${esc(o.author)}</small>` : ""}</span><span class="ld"></span><a class="pg" href="#${o.id}"></a></div>`).join("")}</div>`);
    const half = Math.ceil(rows.length / 2);
    // توازن العمودين بعدد الأسطر لا بعدد الأبواب
    const w = secs.map(s => 1.3 + Math.max(1, s.items.length) * 1.5), tot = w.reduce((a, b) => a + b, 0); let acc = 0, cut = half;
    for (let i = 0; i < w.length; i++) { acc += w[i]; if (acc >= tot / 2) { cut = i + 1; break; } }
    return `<section class="front toc" id="toc"><div class="toc-head"><h2>فهرس العدد</h2><div class="meta">${esc(NAME)}<br>${issueLine}</div></div>
      <div class="toc-cols"><div><div class="toc-sec"><div class="h3"><span class="n st">${star8(30)}</span><a href="#editorial">الافتتاحية: كلمة هيئة التحرير</a></div></div>${rows.slice(0, cut).join("")}</div><div>${rows.slice(cut).join("")}</div></div>
</section>`;
  }

  function editorial() {
    if (!x.intro) return "";
    const ps = String(x.intro).split(/\n+/).filter(Boolean);
    return `<section class="front editorial" id="editorial"><div class="bsm">بسم الله الرحمن الرحيم</div><div class="ed-head"><div class="kk">كلمة هيئة التحرير</div><h2>الافتتاحية</h2><svg class="orn" viewBox="0 0 160 10" aria-hidden="true"><path d="M0 5h66M94 5h66" stroke="currentColor" stroke-width="1"/><g fill="currentColor" transform="translate(80 5)"><rect x="-4" y="-4" width="8" height="8"/><rect x="-4" y="-4" width="8" height="8" transform="rotate(45)"/></g><circle cx="70" cy="5" r="1.4" fill="currentColor"/><circle cx="90" cy="5" r="1.4" fill="currentColor"/></svg></div>
      <div class="body">${ps.map(p => `<p>${MJP.inline(p)}</p>`).join("")}</div><div class="sign">هيئة التحرير</div>
      <div class="facts"><div><b>${toAr(secs.length)}</b><span>بابًا</span></div><div><b>${toAr(allItems.length)}</b><span>مادة</span></div><div><b>${toAr(nDawah)}</b><span>من مكتبة الدعوة السلفية</span></div><div><b>${toAr(nGen)}</b><span>من المكتبة العامة</span></div></div>
      <div class="method"><b>منهج العدد:</b> تُنقل النصوص بلفظها من كتب المكتبة ومقالاتها وفتاواها دون تصرف، ويُذكر مع كل مادة مصدرها وصفحاتها ورابط قراءتها. وما كان من العناوين المميزة أو «مقدمة المجلة» فهو من إعداد هيئة التحرير.</div><div class="imprint"><b>المجلة</b><span>${esc(NAME)} — مجلة علمية ثقافية دورية</span><b>تصدر عن</b><span>${esc(PUBLISHER)}</span><b>العدد</b><span>${ordinal(x.no || 1)} — ${esc(fmtDate(x.date))}${x.hijri ? " — " + esc(x.hijri) : ""}</span><b>على الشبكة</b><span><a href="${SITE}#/majalla/${esc(x.id)}">${esc(SITE.replace(/^https?:\/\//, ""))}#/majalla/${esc(x.id)}</a></span><span class="wide">النصوص منقولة بلفظها من مصادرها في المكتبة، ولكل مادة رابط قراءتها في مصدرها. العناوين المميزة والمقدمات من إعداد المجلة.</span></div></section>`;
  }

  function itemHead(o, s) {
    const kind = STY[o.st] || "مقال";
    return `<header class="ihead"><div class="kk">${esc(kind)}${o.col ? ` <span>• ${esc(o.col)}</span>` : ""}</div><h3>${ttl(o.title || "مادة")}</h3>
      <div class="by">${o.author ? `<b>${esc(o.author)}</b>` : ""}${o.died ? `<span>(ت ${toAr(o.died)}هـ)</span>` : ""}${o.orig ? `<span>من ${o.book ? "كتاب" : ""} «${esc(o.orig)}»</span>` : ""}${o.orig && o.it.title ? `<span class="ed">— العنوان من إعداد المجلة</span>` : ""}</div>
      ${o.it.intro ? `<div class="enote"><b>مقدمة المجلة</b>${esc(o.it.intro)}</div>` : ""}</header>`;
  }
  const srcLine = o => !o.src && !o.url ? "" : `<div class="src"><b>المصدر:</b><span>${o.url ? `<a href="${esc(o.url)}">${esc(o.src)}</a>` : esc(o.src || "—")}</span>${o.url ? `<a class="go" href="${esc(o.url)}">اقرأه في المكتبة</a>` : ""}</div>`;

  function itemBody(o) {
    if (o.err && !o.text) return `<p class="err">تعذر تحميل النص: ${esc(o.err)}</p>`;
    if (o.st === "quiz") {
      const qs = o.it.qs || [];
      return (o.blocks.length ? MJP.render(o.blocks, o.st, { hTag: "div" }) : "") + `<ol class="quiz">${qs.map((z, i) => `<li><div class="q"><span class="mk">${toAr(i + 1)}</span><span>${esc(z.q)}</span></div><div class="opts">${z.o.map((op, j) => `<span>${LET[j] || ""}) ${esc(op)}</span>`).join("")}</div></li>`).join("")}</ol>`;
    }
    const B = o.blocks; if (!B.length) return "";
    // آخر كتلة مع سطر المصدر في وحدة لا تنقسم (إن لم تكن فقرة طويلة)، فلا ينفصل المصدر عن المادة
    const last = B[B.length - 1], short = (last.s || "").length < 700 || last.t === "v";
    return `<div class="body">${MJP.render(short ? B.slice(0, -1) : B, o.st, { hTag: "div" })}${short ? `<div class="tail">${MJP.render([last], o.st, { hTag: "div" })}</div>` : ""}</div>`;
  }

  function item(o, s) {
    const cls = ["item", "it-" + o.st, tone(s), o.book && o.col === "المكتبة العامة" && !["quote", "quiz"].includes(o.st) ? "cls" : ""].filter(Boolean).join(" ");
    const body = itemBody(o);
    if (o.st === "quote") return `<article class="${cls}" id="${o.id}"><div class="qframe">${itemHead(o, s)}${body}${srcLine(o)}</div></article>`;
    const hasTail = /<div class="tail">/.test(body);
    return `<article class="${cls}" id="${o.id}">${itemHead(o, s)}${hasTail ? body.replace(/<\/div><\/div>$/, srcLine(o) + "</div></div>") : body + srcLine(o)}${o.st === "quiz" && (o.it.qs || []).length ? `<p class="answers">مفتاح الإجابات: ${(o.it.qs || []).map((z, i) => `${toAr(i + 1)}- ${LET[z.a] || ""}`).join("، ")}</p>` : ""}</article>`;
  }

  function newsBlock() {
    const L = C.news; if (!L.length) return `<p class="news-note">تُجمع الأخبار آليًّا من مصادرها المعتمدة وتظهر هنا عند التحديث.</p>`;
    const G = NCATS.map(c => [c, L.filter(z => MJP.ncat(z) === c[0]).slice(0, c[0] === "dawah" || c[0] === "nour" ? 4 : 3)]).filter(g => g[1].length);
    const it = (z, lead) => `<div class="news-it${lead ? " lead" : ""}"><a class="t" href="${esc(z.url)}">${esc(z.title)}</a>${z.sum ? `<p>${esc(z.sum)}</p>` : ""}<div class="m"><b>${esc(z.src || "")}</b>${z.date ? `<span>${esc(fmtDate(z.date))}</span>` : ""}<a href="${esc(z.url)}">الخبر في مصدره</a></div></div>`;
    return G.map(([c, a]) => `<div class="news-grp"><h4>${icon(c[2], "ni")}<span>${esc(c[1])}</span></h4>${a.map((z, i) => it(z, i === 0)).join("")}</div>`).join("") + `<p class="news-note">أبرز الأخبار حتى تاريخ العدد من المصادر المعتمدة (آخر الأنباء، حزب النور، بوابة الفتح): عناوين وموجزات بروابط مصادرها، ولا تُنقل نصوصها كاملة. وآخر الأخبار المحدَّثة في صفحة الركن الإخباري بالموقع.</p>`;
  }

  // الأبواب: يبدأ الباب صفحة جديدة إن كان أول الأبواب أو مقال العدد أو ركنًا دائمًا (تفضيلًا يُلغى إن ترك فراغًا كبيرًا)
  const sections = secs.map((s, i) => {
    const pref = i === 0 || /مقال العدد/.test(s.t) || !!s.corner;
    return `<section class="sec${pref ? " newpage" : ""}" id="${s.id}" data-k="${s.id}"${pref ? ' data-soft="1"' : ""}><header class="sec-head"><div class="no">${toAr(String(i + 1).padStart(2, "0"))}</div><div class="tx"><h2 class="sec-name">${esc(s.t)}</h2>${s.meta.tag ? `<span class="tg">${esc(s.meta.tag)}</span>` : ""}</div><div class="ic">${icon(s.meta.icon)}</div></header>
      ${s.live === "news" ? newsBlock() : ""}${s.items.map((o, k) => (k ? `<div class="item-sep">${star8(30)}</div>` : "") + item(o, s)).join("")}</section>`;
  });

  const back = `<section class="back" style="--pat-gold:${patternURL("#e1c98d", .12)}"><div class="bg"></div><div class="in"><img src="${BASE}assets/logo-sdsl.png" alt=""><div class="nm">${esc(NAME)}</div><div class="pb">تصدر عن ${esc(PUBLISHER)}</div>
    <div class="ay">﴿قُلْ هَٰذِهِ سَبِيلِي أَدْعُو إِلَى اللَّهِۚ عَلَىٰ بَصِيرَةٍ أَنَا وَمَنِ اتَّبَعَنِي﴾</div><div class="ayr">[يوسف: ١٠٨]</div>
    <a class="url" href="${SITE}#/majalla">${esc(SITE.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>
    <div class="note">${esc(NAME)} — العدد ${ordinal(x.no || 1)} — ${esc(fmtDate(x.date))}. حقوق النصوص لأصحابها؛ تُتاح للقراءة والانتفاع العلمي مع العزو إلى المصدر، ولا يجوز إعادة نشرها تجاريًّا.</div></section>`;

  const SRC = document.createElement("div");
  SRC.className = "doc";
  SRC.innerHTML = cover() + toc() + editorial() + `<div style="--pat-green:${patternURL("#0b3b2e", .07)}">` + sections.join("") + `</div>` + back;
  // مفاتيح ثابتة لكل كتلة قابلة للنقل (لتطبيق إصلاحات الانقسام في الجولة التالية)
  let kc = 0; SRC.querySelectorAll("p, li, .mj-h, .mj-poem, .mj-qa, .news-it, .news-grp, .ihead, .item, .tail, .item-sep").forEach(e => { if (!e.dataset.k) e.dataset.k = "b" + (kc++); });
  window.MJP_SRC = () => SRC.outerHTML;
  // الاسم ورقم العدد في الترويسة والتذييل
  const dynCSS = `@page { @top-right { width: 58%; content: "${NAME.replace(/"/g, "")}"; font-family: "MJ Amiri", serif; font-weight: 700; font-size: 10.5pt; color: #0b3b2e; vertical-align: bottom; padding-bottom: 3.2mm; } @bottom-right { content: "${issueLine.replace(/"/g, "")}"; font-family: "MJ Cairo", sans-serif; font-size: 7.6pt; color: #6f7772; vertical-align: middle; } } `;

  // ---------- الإخراج والإصلاح ----------
  // ورقة واحدة: Paged.js يأخذ مقاس الصفحة وحواف القص من قاعدة @page الأولى، فتُدمج إعدادات النسخة فيها
  const CSSURL = new URL("press.css", location.href).href;
  let CSSTEXT = await fetch(CSSURL).then(r => r.text());
  if (MODE === "print") CSSTEXT = CSSTEXT.replace("margin: 25mm 19mm 22mm 19mm;", "margin: 25mm 19mm 22mm 19mm; bleed: 3mm;" + (Q.get("marks") === "1" ? " marks: crop cross;" : ""));
  CSSTEXT += "\n" + dynCSS;
  const head0 = new Set([...document.head.children]);
  const stage = document.getElementById("mpstage");
  const hints = new Set(), dropped = new Set(), log = [];
  let flow = null, issues = [];
  const mm = 96 / 25.4;

  async function renderOnce() {
    [...document.head.children].forEach(e => { if (!head0.has(e)) e.remove(); });
    stage.innerHTML = "";
    const src = SRC.cloneNode(true);
    src.querySelectorAll("[data-k]").forEach(e => { const k = e.dataset.k; if (hints.has(k)) e.classList.add("brk"); if (dropped.has(k)) e.classList.remove("newpage"); });
    const prev = new Paged.Previewer();
    flow = await prev.preview(src.outerHTML, [{ [CSSURL]: CSSTEXT }], stage);
    runningHeads();
    return flow;
  }

  // الترويسة الجارية: اسم الباب الذي تبدأ به الصفحة أو الممتد إليها (string-set في Paged.js لا يعمل هنا، فيُملأ بعد الإخراج)
  function runningHeads() {
    let cur = "";
    stage.querySelectorAll(".pagedjs_page").forEach(pg => {
      if (pg.querySelector(".front")) cur = "";
      const h = pg.querySelector(".pagedjs_page_content .sec-name"), cont = pg.querySelector(".pagedjs_page_content [data-split-from]");
      const name = h && !(cont && cont.closest(".sec") && cont.closest(".sec") !== h.closest(".sec") && cur) ? h.textContent.trim() : cur;
      const last = [...pg.querySelectorAll(".pagedjs_page_content .sec-name")].pop(); cur = last ? last.textContent.trim() : cur;
      pg.style.setProperty("--pagedjs-string-first-sect", JSON.stringify(name || cur || ""));
      // فاصل المواد إن وقع أول الصفحة لا معنى له: يُخفى
      const f0 = pg.querySelector(".pagedjs_page_content .item-sep"); if (f0) { const r = f0.getBoundingClientRect(), A = pg.querySelector(".pagedjs_page_content").getBoundingClientRect(); if (r.top - A.top < 30) f0.style.visibility = "hidden"; }
    });
  }

  const BLOCKS = "p, li, .bt, .mj-h, .mj-qa, .ihead, .sec-head, .src, .news-it, .news-grp h4, .toc-row, .toc-sec .h3, .quiz > li, .answers, .item-sep, .facts, .method, .imprint, .sign, .enote";
  const HEADS = ".ihead, .sec-head, .mj-h, .mj-qa, .item-sep, .news-grp h4";
  function inspect() {
    const pages = [...stage.querySelectorAll(".pagedjs_page")], out = [], fixes = [];
    let minFs = 99;
    pages.forEach((pg, i) => {
      const n = i + 1, isCover = pg.classList.contains("pagedjs_cover_page") || !!pg.querySelector(".cover, .back");
      const area = pg.querySelector(".pagedjs_page_content"); if (!area) return;
      const A = area.getBoundingClientRect();
      const els = [...area.querySelectorAll(BLOCKS)].filter(e => e.getClientRects().length);
      const text = area.innerText.replace(/\s+/g, "");
      if (!isCover && text.length < 12) { out.push({ page: n, type: "empty", msg: "صفحة فارغة" }); return; }
      if (isCover) return;
      // تجاوز حدود الصفحة
      els.forEach(e => { const r = e.getBoundingClientRect(); if (r.bottom > A.bottom + 2 || r.left < A.left - 2 || r.right > A.right + 2) out.push({ page: n, type: "overflow", msg: "عنصر يتجاوز حدود الصفحة: «" + (e.innerText || "").trim().slice(0, 40) + "…»" }); });
      // أصغر خط
      els.slice(0, 60).forEach(e => { const f = parseFloat(getComputedStyle(e).fontSize); if (f && f < minFs) minFs = f; });
      // الامتلاء
      const bottom = Math.max(A.top, ...els.map(e => e.getBoundingClientRect().bottom)), fill = (bottom - A.top) / A.height;
      pg.dataset.fill = Math.round(fill * 100);
      const lastPage = i === pages.length - 1 || pages[i + 1].querySelector(".back");
      // آخر كتلة في الصفحة
      const last = els.slice().sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom).pop();
      const keyOf = e => { const k = e.closest("[data-k]"); return k && k.dataset.k; };
      if (last && last.matches(HEADS)) {
        let tgt = last.matches(".ihead") ? last.closest(".item") : last;
        if (last.matches(".item-sep")) tgt = last.nextElementSibling || last;
        const sec = last.closest(".sec"); if (last.matches(".sec-head") || (tgt && tgt.matches(".item") && sec && sec.querySelector(".item") === tgt && !sec.querySelector(".news-grp"))) tgt = sec;
        if (tgt && keyOf(tgt)) fixes.push({ k: keyOf(tgt), page: n, why: "عنوان منفصل عن مادته في آخر الصفحة" });
        out.push({ page: n, type: "orphan", msg: "عنوان في آخر الصفحة منفصل عن نصه: «" + last.innerText.trim().slice(0, 40) + "»" });
      } else if (last) {
        // عنوان يتبعه سطر أو سطران فقط في آخر الصفحة
        const prevH = [...area.querySelectorAll(".ihead, .sec-head, .mj-h")].filter(h => h.getBoundingClientRect().bottom <= last.getBoundingClientRect().top + 2).pop();
        const lh = parseFloat(getComputedStyle(last).lineHeight) || 20;
        if (prevH && last.hasAttribute("data-split-to") && A.bottom - prevH.getBoundingClientRect().bottom < lh * 2.6) {
          let tgt = prevH.matches(".ihead") ? prevH.closest(".item") : prevH; const sec = prevH.closest(".sec");
          if (prevH.matches(".sec-head") || (tgt && tgt.matches(".item") && sec && sec.querySelector(".item") === tgt)) tgt = sec;
          if (tgt && keyOf(tgt)) fixes.push({ k: keyOf(tgt), page: n, why: "عنوان يتبعه سطر واحد في آخر الصفحة" });
        }
      }
      // باب يبدأ في الربع الأخير من الصفحة
      area.querySelectorAll(".sec-head").forEach(h => { const top = h.getBoundingClientRect().top; if (top > A.top + A.height * 0.72) { const s = h.closest(".sec"); if (s && keyOf(s) && !dropped.has(keyOf(s))) fixes.push({ k: keyOf(s), page: n, why: "باب يبدأ في أسفل الصفحة" }); } });
      // سطر منفرد أعلى الصفحة (بقية فقرة)
      const first = els.slice().sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (first && first.hasAttribute("data-split-from") && first.matches("p, li")) { const lh = parseFloat(getComputedStyle(first).lineHeight) || 20; if (first.getBoundingClientRect().height < lh * 1.5) {
        // إن كان جزء الفقرة في الصفحة السابقة قصيرًا (٤ أسطر فأقل) تُنقل الفقرة كلها
        const prevFrag = i > 0 && pages[i - 1].querySelector(`[data-ref="${first.dataset.ref}"]`);
        if (prevFrag && first.dataset.k && prevFrag.getBoundingClientRect().height <= lh * 4.2) fixes.push({ k: first.dataset.k, page: n, why: "سطر منفرد أعلى الصفحة: نُقلت الفقرة كاملة" });
        out.push({ page: n, type: "widow", msg: "سطر منفرد أعلى الصفحة (بقية فقرة)" }); } }
      // التوازن: صفحة قليلة الامتلاء
      if (!lastPage && fill < 0.5) {
        const nx = pages[i + 1] && pages[i + 1].querySelector(".sec.newpage .sec-head, .sec .sec-head");
        const nsec = nx && nx.closest(".sec");
        const nfirst = pages[i + 1] && [...pages[i + 1].querySelectorAll(".pagedjs_page_content " + BLOCKS)][0];
        if (nsec && nsec.dataset.soft && nfirst && nsec.contains(nfirst) && !dropped.has(nsec.dataset.k) && fill < 0.62) fixes.push({ k: nsec.dataset.k, page: n, drop: true, why: "إلغاء بدء الباب في صفحة جديدة لملء فراغ" });
        out.push({ page: n, type: fill < 0.3 ? "sparse" : "unbalanced", msg: (fill < 0.3 ? "صفحة شبه فارغة" : "صفحة غير متوازنة") + ` (امتلاؤها ${toAr(Math.round(fill * 100))}٪)` });
      }
    });
    if (minFs < 9.3) out.push({ page: 0, type: "font", msg: `أصغر خط ${toAr((minFs * 0.75).toFixed(1))} نقطة (أقل من الحد ٧ نقاط)` });
    return { pages: pages.length, out, fixes };
  }

  stat("جارٍ إخراج الصفحات…");
  await document.fonts.ready;
  try { await Promise.all(["400 12px 'MJ Naskh'", "700 12px 'MJ Naskh'", "400 12px 'MJ Amiri'", "700 12px 'MJ Amiri'", "400 12px 'MJ Cairo'", "600 12px 'MJ Cairo'", "700 12px 'MJ Cairo'"].map(f => document.fonts.load(f, "ابجد"))); } catch (e) { }
  let res, pass = 0;
  for (pass = 1; pass <= 6; pass++) {
    stat(`جارٍ إخراج الصفحات… (الجولة ${toAr(pass)})`);
    await renderOnce(); res = inspect();
    const nf = res.fixes.filter(f => f.drop ? !dropped.has(f.k) : !hints.has(f.k));
    if (!nf.length) break;
    // إصلاح واحد لكل صفحة في الجولة: تعديل صفحة يغيّر ما بعدها
    const seen = new Set(); nf.forEach(f => { if (seen.has(f.page)) return; seen.add(f.page); if (f.drop) dropped.add(f.k); else hints.add(f.k); log.push(`ص${toAr(f.page)}: ${f.why}`); });
  }
  issues = res.out;
  const fontsOK = ["MJ Naskh", "MJ Amiri", "MJ Cairo"].map(f => [f, document.fonts.check(`12px '${f}'`, "ابجد")]);
  fontsOK.filter(f => !f[1]).forEach(f => issues.push({ page: 0, type: "font", msg: "لم يُحمَّل الخط " + f[0] }));
  window.MJP_DONE = { pages: res.pages, issues, passes: pass, fixes: log, mode: MODE, issue: x.id, title: document.title };

  // ---------- واجهة المعاينة ----------
  if (AUTO) return;
  const T = { empty: "صفحات فارغة", overflow: "تجاوز المحتوى", orphan: "عناوين منفصلة", sparse: "صفحات شبه فارغة", unbalanced: "صفحات غير متوازنة", widow: "أسطر منفردة", font: "الخطوط" };
  const byType = {}; issues.forEach(z => (byType[z.type] = byType[z.type] || []).push(z));
  const pages = [...stage.querySelectorAll(".pagedjs_page")];
  issues.forEach(z => { if (z.page) pages[z.page - 1].classList.add("mp-warn", "mp-" + z.type); });
  pages.forEach((p, i) => p.setAttribute("data-pn", toAr(i + 1)));
  document.getElementById("mprep").innerHTML = `<h3>تقرير الإخراج</h3>
    <p><b>${toAr(res.pages)}</b> صفحة • ${MODE === "print" ? "نسخة الطباعة" : "النسخة الرقمية"} • ${toAr(pass)} جولة إخراج</p>
    <ul class="mpchk">${["empty", "overflow", "orphan", "sparse", "unbalanced", "widow", "font"].map(k => `<li class="${byType[k] ? "bad" : "ok"}">${byType[k] ? "⚠" : "✓"} ${T[k]}: ${byType[k] ? toAr(byType[k].length) : "لا شيء"}</li>`).join("")}</ul>
    ${issues.length ? `<ol class="mpis">${issues.map(z => `<li>${z.page ? `<a href="#" data-go="${z.page}">ص ${toAr(z.page)}</a> — ` : ""}${esc(z.msg)}</li>`).join("")}</ol>` : `<p class="ok">لا ملاحظات: العدد جاهز للاعتماد.</p>`}
    ${log.length ? `<details><summary>إصلاحات آلية (${toAr(log.length)})</summary><ul>${log.map(l => `<li>${esc(l)}</li>`).join("")}</ul></details>` : ""}`;
  const pdfURL = `${BASE}data/majalla/pdf/${encodeURIComponent(x.id)}${MODE === "print" ? "-print" : ""}.pdf`;
  fetch(pdfURL, { method: "HEAD" }).then(r => { if (r.ok) { const a = document.getElementById("mpdl"); a.href = pdfURL; a.hidden = false; } }).catch(() => { });
  stat(`${toAr(res.pages)} صفحة`);
  document.getElementById("mpgo").max = res.pages;
  ui.classList.add("ready"); document.body.classList.add("mpready");
  const goto = n => { const p = pages[n - 1]; if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); };
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); goto(+g.dataset.go); return; }
    const b = e.target.closest("[data-mp]"); if (!b) return; const a = b.dataset.mp;
    if (a === "print") window.print();
    else if (a === "redo") location.reload();
    else if (a === "mode") { Q.set("mode", MODE === "print" ? "digital" : "print"); location.search = Q.toString(); }
    else if (a === "rep") document.body.classList.toggle("mp-rep");
    else if (["one", "spread", "grid"].includes(a)) { document.body.dataset.view = a; document.querySelectorAll("[data-mp=one],[data-mp=spread],[data-mp=grid]").forEach(z => z.classList.toggle("on", z === b)); }
  });
  document.getElementById("mpgo").addEventListener("change", e => goto(+e.target.value));
  document.getElementById("mpzoom").addEventListener("change", e => { document.documentElement.style.setProperty("--mpz", e.target.value); });
  document.getElementById("mpmode").textContent = MODE === "print" ? "التحويل إلى النسخة الرقمية" : "معاينة نسخة الطباعة";
  if (issues.length) document.body.classList.add("mp-rep");
})();
