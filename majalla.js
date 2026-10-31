/* «مجلة المكتبة» (الباب ٣١ من وثيقة التطوير): أعداد دورية تُبنى من محتوى المكتبة نفسه.
   البيانات في data/majalla.json: {v, name, issues:[{id, no, title, theme, date, status, intro, secs:[{t, items:[...]}], log:[...]}]}.
   المادة: {ref, p, p2} لسجل في المكتبة (كتاب ونطاق صفحات، أو مقال/فتوى كاملًا)، أو {text, author, src} لنص ملصوق.
   العنوان التحريري (title) والمقدمة (intro) من إعداد المجلة ويُميَّزان عن النص الأصلي، والنص الأصلي لا يُغيَّر.
   الحالات: draft مسودة، review قيد المراجعة، approved معتمد، published منشور؛ لا يرى الزائر إلا المنشور، والنشر للمدير وحده. */
const MAJ = (() => {
  const P = "data/majalla.json", NAME = "مجلة مكتبة الدعوة السلفية";
  const ST = [["draft", "مسودة"], ["review", "قيد المراجعة"], ["approved", "معتمد للنشر"], ["published", "منشور"]];
  const stName = k => (ST.find(s => s[0] === k) || ST[0])[1];
  let D = null, ED = null; // ED: العدد المفتوح للتحرير (نسخة محلية حتى الحفظ)
  const load = async (fresh) => { if (D && !fresh) return D; try { const r = await fetch(P + (fresh ? "?fresh=1" : ""), { cache: "no-cache" }); D = r.ok ? await r.json() : null; } catch (e) { D = null; } D = D && D.issues ? D : { v: 1, name: NAME, issues: [] }; return D; };
  const staff = () => typeof isAdmin === "function" && isAdmin();
  const canPublish = () => (typeof GH !== "undefined" && GH.on) || (typeof Cloud !== "undefined" && Cloud.staff() && Cloud.role === "admin");
  const visible = () => D.issues.filter(x => x.status === "published" || staff()).sort((a, b) => (b.no || 0) - (a.no || 0));
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return d || ""; } };
  const kindAr = b => ({ article: "مقال", fatwa: "فتوى", statement: "بيان", book: "من كتاب" })[kindOf(b)] || "مادة";
  const itemTitle = it => { const b = it.ref && B(it.ref); return it.title || (b ? b.title : "") || "مادة"; };
  const itemOrig = it => { const b = it.ref && B(it.ref); return b ? b.title : ""; };
  const itemAuthor = it => { const b = it.ref && B(it.ref); return b ? A(b.authorId).name : (it.author || ""); };
    const anchor = (si, ii) => `m${si}-${ii}`;
  const used = (except) => new Set(D.issues.filter(x => x.id !== except).flatMap(x => (x.secs || []).flatMap(s => s.items.map(i => i.ref).filter(Boolean))));

  // أنماط عرض المادة في العدد: مقال، حديث، تفسير، فتوى، قبس، ترجمة علم، أدب
  const STY = [["art", "مقال"], ["tafsir", "تأملات قرآنية"], ["hadith", "حديث وأثر"], ["fatwa", "فتوى"], ["quote", "قبس"], ["bio", "ترجمة علم"], ["adab", "أدب ونثر"]];
  const styOf = it => it.st || (it.ref && kindOf(B(it.ref) || {}) === "fatwa" ? "fatwa" : "art");

  // نص المادة من المكتبة: المقال كاملًا، ومن الكتاب نطاق صفحات لا يتجاوز خمسًا؛ ويُقتطع منه موضع محدد (from … to) إن حُدد
  async function itemText(it) {
    let t;
    if (!it.ref) t = it.text || "";
    else { const b = await loadBook(it.ref);
      if (kindOf(b) !== "book") t = b.pages.join("\n");
      else { const p = Math.max(1, it.p || 1), p2 = Math.min(b.pages.length, Math.max(p, it.p2 || p), p + 4); t = b.pages.slice(p - 1, p2).join("\n"); } }
    if (it.from) { const i = t.indexOf(it.from); if (i >= 0) { t = t.slice(i); if (it.to) { const j = t.indexOf(it.to); if (j >= 0) t = t.slice(0, j + it.to.length); } } }
    return t;
  }
  // تنظيف العرض فقط (لا يغير المصدر): أرقام الحواشي الملتصقة، وترقيم الفقرات، وعلامات الصفحات
  function blocks(t) {
    return String(t || "").split(/\n+/).map(s => s.replace(/\[ص:\s*\d+\]/g, "").replace(/\[\[[^\]]*\]\]/g, "").replace(/([ء-يً-ْ])\d{1,2}(?=[\s،.:؛!؟)»"]|$)/g, "$1").trim())
      .filter(s => s && !/^#\s*[\d\s\-–—.]*$/.test(s) && s !== "#" && !/^\(\d+\/\d+\)$/.test(s) && !/^[-–—\s*]+$/.test(s)).map(s => /^#\s*/.test(s) ? { h: s.replace(/^#\s*(AUTO\s*)?/, "").replace(/^\d+\s*[-–]\s*/, "") } : { p: s });
  }
  const html = (t, sty) => blocks(t).map(b => b.h ? `<h5>${esc(b.h)}</h5>` : sty === "fatwa" && /^(السؤال|الجواب)\s*:?$/.test(b.p) ? `<p class="mjlab">${esc(b.p.replace(/\s*:$/, ""))}</p>` : `<p>${esc(b.p)}</p>`).join("");
  const srcLink = it => { const b = it.ref && B(it.ref); if (!b) return it.src ? esc(it.src) : ""; const pg = kindOf(b) === "book" ? "/" + (it.p || 1) : ""; return `<a href="#/book/${esc(b.id)}${pg}">${esc(b.setTitle || b.title)}${pg ? " — ص" + toAr(it.p || 1) + (it.p2 > it.p ? "–" + toAr(it.p2) : "") : ""}</a>`; };
  const colOf = it => { const b = it.ref && B(it.ref); return b ? (bc(b) === "dawah" ? "مكتبة الدعوة السلفية" : COL.turath || "المكتبة العامة") : ""; };

  // ---------- صفحات الزائر ----------
  async function show(q, id) {
    view(`<h2>${NAME}</h2><p class="mut">جارٍ التحميل…</p>`);
    await load();
    if (id) return issue(id, q || {});
    const L = visible(), sq = String((q && q.q) || "").trim();
    view(`<div class="majhead"><h2>${esc(D.name || NAME)}</h2><p class="mut">مجلة دورية تجمع في كل عدد موضوعًا علميًا أو دعويًا من كتب المكتبة ومقالاتها وفتاواها، مرتبةً في أبواب، مع روابط القراءة في مصادرها الأصلية. العناوين والمقدمات التحريرية من إعداد المجلة، والنصوص كما هي في مصادرها.</p>
      <form class="sbox" data-form="majq" style="max-width:none"><input name="q" type="search" value="${esc(sq)}" placeholder="ابحث في أعداد المجلة: العناوين والكتّاب والنصوص" aria-label="بحث في المجلة"><button class="btn">بحث</button></form></div>
     ${staff() ? `<p><a class="btn s" href="#/admin?t=majalla">إدارة أعداد المجلة</a></p>` : ""}
     <div id="majres"></div>
     <div class="majlist">${L.map(x => `<a class="majcard" href="#/majalla/${esc(x.id)}"><span class="majcov"><span class="majno">العدد ${toAr(x.no || "")}</span><b>${esc(x.title || x.theme || "")}</b></span><span class="mut">${esc(fmtDate(x.date))}${x.status !== "published" ? ` • <span class="rb ad">${esc(stName(x.status))}</span>` : ""}</span><small class="mut">${esc((x.secs || []).map(s => s.t).join(" • "))}</small></a>`).join("") || '<div class="note">لم يصدر عدد بعد. تُعدّ الأعداد من «الإدارة ← مجلة المكتبة» وتظهر هنا بعد اعتمادها ونشرها.</div>'}</div>`);
    if (sq) search(sq, L);
  }

  // البحث في المجلة: العناوين والكتّاب فورًا، ثم نصوص المواد بعد تحميلها
  async function search(sq, L) {
    const el = document.getElementById("majres"), w = norm(sq).split(/\s+/).filter(Boolean); if (!el || !w.length) return;
    el.innerHTML = '<p class="mut">جارٍ البحث في نصوص الأعداد…</p>';
    const hits = [];
    for (const x of L) for (const [si, s] of (x.secs || []).entries()) for (const [ii, it] of s.items.entries()) {
      let t = ""; try { t = await itemText(it); } catch (e) { }
      const hay = norm(itemTitle(it) + " " + itemAuthor(it) + " " + s.t + " " + t);
      if (w.every(k => hay.includes(k))) { const nt = norm(t), k0 = nt.indexOf(w[0]); hits.push({ x, si, ii, it, snip: k0 >= 0 ? t.slice(Math.max(0, k0 - 60), k0 + 140) : "" }); }
    }
    if (!document.getElementById("majres")) return;
    el.innerHTML = `<h3>نتائج البحث (${toAr(hits.length)})</h3>` + (hits.map(h => `<a class="bk" href="#/majalla/${esc(h.x.id)}?m=${anchor(h.si, h.ii)}"><b>${esc(itemTitle(h.it))}</b><span>العدد ${toAr(h.x.no || "")} • ${esc(h.x.secs[h.si].t)} • ${esc(itemAuthor(h.it))}</span>${h.snip ? `<small class="mut">…${esc(h.snip)}…</small>` : ""}</a>`).join("") || '<p class="mut">لا نتائج.</p>');
  }

  async function issue(id, q) {
    const x = D.issues.find(y => y.id === id);
    if (!x || (x.status !== "published" && !staff())) return view(`<p><a href="#/majalla">${NAME}</a> ›</p><div class="note">هذا العدد غير موجود أو لم يُنشر بعد.</div>`);
    const secs = x.secs || [], fav = S.favs.includes("maj:" + x.id), all = secs.flatMap(s => s.items);
    const nDawah = all.filter(it => it.ref && bc(B(it.ref) || {}) === "dawah").length, nGen = all.filter(it => it.ref && bc(B(it.ref) || {}) !== "dawah").length;
    const toc = secs.map((s, si) => `<li><b>${esc(s.t)}</b><ol>${s.items.map((it, ii) => `<li><a href="#/majalla/${esc(x.id)}" data-majgo="${anchor(si, ii)}">${esc(itemTitle(it))}</a> <span class="mut">— ${esc(itemAuthor(it))}</span></li>`).join("")}</ol></li>`).join("");
    view(`<p class="noprint"><a href="#/majalla">${NAME}</a> › العدد ${toAr(x.no || "")}</p>
     <article id="majissue" class="majissue">
      <header class="majcover"><div class="majname">${esc(D.name || NAME)}</div><div class="majmeta">العدد ${toAr(x.no || "")} • ${esc(fmtDate(x.date))}${x.hijri ? " • " + esc(x.hijri) : ""}</div>${x.status !== "published" ? `<div class="rb ad">${esc(stName(x.status))} — لا يراه الزوار</div>` : ""}
       <h2>${esc(x.title || x.theme || "")}</h2>${x.sub ? `<p class="majsub">${esc(x.sub)}</p>` : ""}
       <div class="majin"><b>في هذا العدد</b><ul>${all.slice(0, 8).map(it => `<li>${esc(itemTitle(it))}</li>`).join("")}</ul></div>
       <div class="majmix">${toAr(all.length)} مادة: ${toAr(nDawah)} من مكتبة الدعوة السلفية، و${toAr(nGen)} من المكتبة العامة</div></header>
      <div class="row noprint majtools"><button class="btn p s" data-majact="flip" data-id="${esc(x.id)}">📖 تصفح كملف مصور</button><button class="btn s" data-majact="zip" data-id="${esc(x.id)}">تحميل صورًا</button><button class="btn s" data-majact="pdf">PDF / طباعة</button><button class="btn s" data-majact="word" data-id="${esc(x.id)}">Word</button><button class="btn s" data-majact="fav" data-id="${esc(x.id)}">${fav ? "★ في المفضلة" : "☆ حفظ العدد"}</button><button class="btn s" data-majact="share" data-id="${esc(x.id)}">مشاركة</button>${staff() ? `<a class="btn s" href="#/admin?t=majalla&i=${esc(x.id)}">تحرير العدد</a>` : ""}</div>
      <form class="sbox noprint" data-form="majiq" style="max-width:none"><input name="q" type="search" placeholder="ابحث في هذا العدد" aria-label="بحث في العدد"><button class="btn">بحث</button></form><p id="majiqr" class="mut noprint" role="status"></p>
      <div class="majbody">
      <nav class="majtoc"><h3>فهرس العدد</h3><ol>${toc}</ol></nav>
      ${x.intro ? `<section class="majintro"><h3>افتتاحية العدد</h3>${html(x.intro)}<p class="mut" style="text-align:left">— هيئة التحرير</p></section>` : ""}
      ${secs.map((s, si) => `<section class="majsec"><h3 class="majsect"><span>${esc(s.t)}</span></h3>${s.items.map((it, ii) => `<div class="majitem mj-${styOf(it)}" id="${anchor(si, ii)}"><div class="mjkind">${esc((STY.find(z => z[0] === styOf(it)) || STY[0])[1])}${colOf(it) ? " • " + esc(colOf(it)) : ""}</div><h4>${esc(itemTitle(it))}</h4><p class="mut mjby">${esc(itemAuthor(it))}${itemOrig(it) && itemOrig(it) !== itemTitle(it) ? ` • من «${esc(itemOrig(it))}» <small>(العنوان أعلاه من إعداد المجلة)</small>` : ""}</p>${it.intro ? `<aside class="majnote"><b>مقدمة المجلة:</b> ${esc(it.intro)}</aside>` : ""}<div class="majtext" data-mt="${si}-${ii}"><p class="mut">جارٍ تحميل النص…</p></div><p class="majsrc mut">المصدر: ${srcLink(it)}</p></div>`).join("")}</section>`).join("")}
      </div>
      <footer class="majfoot mut">${esc(D.name || NAME)} — العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))}. النصوص منقولة بلفظها من مصادرها في المكتبة، والعناوين المميزة والمقدمات من إعداد المجلة.</footer>
     </article>`);
    const jobs = [];
    secs.forEach((s, si) => s.items.forEach((it, ii) => { const el = document.querySelector(`[data-mt="${si}-${ii}"]`);
      jobs.push(itemText(it).then(t => { if (el) el.innerHTML = html(t, styOf(it)) || '<p class="mut">لا نص.</p>'; }).catch(e => { if (el) el.innerHTML = `<p class="mut">تعذر تحميل النص (${esc(e.message)}).</p>`; })); }));
    if (q.m) Promise.all(jobs).then(() => { const el = document.getElementById(q.m); if (el) { el.scrollIntoView({ behavior: "smooth" }); el.classList.add("mjhit"); } });
    if (q.v === "pages") flip(x.id);
  }

  // تصدير Word: مستند HTML يفتحه Word بتنسيقه واتجاهه
  async function word(id) {
    const x = D.issues.find(y => y.id === id); if (!x) return;
    toast("جارٍ تجهيز ملف Word…");
    let body = `<h1 style="text-align:center">${esc(D.name || NAME)}</h1><p style="text-align:center">العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))}</p><h2 style="text-align:center">${esc(x.title || x.theme || "")}</h2>`;
    if (x.intro) body += `<h3>افتتاحية العدد</h3>${html(x.intro)}`;
    body += `<h3>فهرس العدد</h3>` + (x.secs || []).map(s => `<p><b>${esc(s.t)}</b>: ${s.items.map(it => esc(itemTitle(it))).join("، ")}</p>`).join("");
    for (const s of x.secs || []) {
      body += `<h2>${esc(s.t)}</h2>`;
      for (const it of s.items) {
        let t = ""; try { t = await itemText(it); } catch (e) { t = "(تعذر تحميل النص)"; }
        const b = it.ref && B(it.ref), link = b ? siteLink("#/book/" + b.id + (kindOf(b) === "book" ? "/" + (it.p || 1) : "")) : "";
        body += `<h3>${esc(itemTitle(it))}</h3><p><i>${esc(itemAuthor(it))}${itemOrig(it) && itemOrig(it) !== itemTitle(it) ? " — من «" + esc(itemOrig(it)) + "»" : ""}</i></p>${it.intro ? `<p style="border-right:3px solid #b88a2e;padding-right:8px"><b>مقدمة المجلة:</b> ${esc(it.intro)}</p>` : ""}${html(t, styOf(it))}<p><small>المصدر: ${b ? `<a href="${esc(link)}">${esc(b.setTitle || b.title)}</a>` : esc(it.src || "")}</small></p>`;
      }
    }
    body += `<hr><p><small>${esc(D.name || NAME)} — العدد ${toAr(x.no || "")} — ${esc(fmtDate(x.date))} — ${esc(SITENAME)} ${esc(siteLink(""))}</small></p>`;
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(D.name || NAME)} ${x.no || ""}</title><style>body{direction:rtl;font-family:'Traditional Arabic',Amiri,serif;font-size:16pt}h1,h2,h3{font-family:Amiri,serif;color:#0f5c4d}</style></head><body dir="rtl">${body}</body></html>`;
    save(new Blob(["﻿", doc], { type: "application/msword" }), `majalla-${x.no || x.id}.doc`);
  }
  function save(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  // ---------- العدد ملفًّا مصورًا: صفحات A4 تُرسم على لوحة (canvas) ----------
  // التخطيط مرة واحدة إلى عمليات رسم لكل صفحة، ثم تُرسم الصفحة المطلوبة وحدها (للتصفح والتحميل) فلا تُحفظ صور العدد كله في الذاكرة.
  const PW = 1240, PH = 1754, MX = 105, TOP = 170, BOT = PH - 150, CW = PW - 2 * MX;
  const C = { ink: "#1d2622", mut: "#5b6b66", ac: "#0f5c4d", gold: "#b88a2e", paper: "#fbf8f0", soft: "#f3ecd9", green2: "#e8f2ec" };
  const F = (s, w, f) => `${w || 400} ${s}px "${f || "Amiri"}", serif`, FS = (s, w) => `${w || 500} ${s}px "IBM Plex Sans Arabic", sans-serif`;
  let MC = null; // لوحة القياس
  const meas = (font, t) => { MC = MC || document.createElement("canvas").getContext("2d"); MC.font = font; MC.direction = "rtl"; return MC.measureText(t).width; };
  function wrapL(font, text, max) { const out = []; String(text).split(/\n/).forEach(par => { let l = ""; par.split(/\s+/).filter(Boolean).forEach(w => { const t = l ? l + " " + w : w; if (meas(font, t) > max && l) { out.push(l); l = w; } else l = t; }); if (l) out.push(l); }); return out; }

  async function layout(x) {
    await Promise.all(["Amiri", "IBM Plex Sans Arabic", "Aref Ruqaa"].map(f => typeof loadFont === "function" ? loadFont(f) : 0));
    try { await Promise.all([document.fonts.load(F(40)), document.fonts.load(F(40, 700)), document.fonts.load(FS(30)), document.fonts.load(FS(30, 700)), document.fonts.load(F(80, 700, "Aref Ruqaa"))]); } catch (e) { }
    const pages = [], marks = []; let pg = null, y = 0, sec = "";
    const np = () => { pg = { ops: [], sec }; pages.push(pg); y = TOP; };
    const room = h => { if (!pg || y + h > BOT) np(); };
    const text = (s, font, color, opt) => { pg.ops.push(Object.assign({ t: "text", s, font, color, x: PW - MX, y, al: "right" }, opt || {})); };
    const para = (s, o) => { o = o || {}; const fs = o.fs || 33, lh = Math.round(fs * (o.lh || 1.9)), font = o.font || F(fs, o.w), w = CW - (o.ind || 0) * 2, L = wrapL(font, s, w);
      L.forEach(l => { room(lh); if (o.bg) pg.ops.push({ t: "rect", x: MX - 14, y: y - fs * 0.95, w: CW + 28, h: lh, c: o.bg }); if (o.bar) pg.ops.push({ t: "rect", x: PW - MX + 8, y: y - fs * 0.95, w: 6, h: lh, c: o.bar }); text(l, font, o.color || C.ink, o.al === "center" ? { x: PW / 2, al: "center", y: y } : { x: PW - MX - (o.ind || 0), y: y }); y += lh; }); y += o.after == null ? Math.round(lh * 0.35) : o.after; };
    // ١- الغلاف (يُرسم بعناصره الخاصة) ٢- الفهرس (يُملأ بأرقام الصفحات بعد التخطيط)
    // صفحات الفهرس: صفوف الأبواب والمواد تُقسم على ما يلزم من صفحات (أرقام الصفحات تُقرأ من marks عند الرسم)
    const rows = (x.secs || []).flatMap((s, si) => [{ sec: s.t }].concat(s.items.map((it, ii) => ({ si, ii, title: itemTitle(it) }))));
    const tocP = []; let hy = 0, cur = []; rows.forEach(r => { const h = r.sec ? 74 : 54; if (hy + h + (r.sec ? 54 : 0) > BOT - (tocP.length ? 220 : 400)) { tocP.push(cur); cur = []; hy = 0; } cur.push(r); hy += h; }); if (cur.length) tocP.push(cur);
    pages.push({ cover: true, ops: [] }); tocP.forEach((r, k) => pages.push({ toc: true, rows: r, first: !k, ops: [] }));
    if (x.intro) { sec = "افتتاحية العدد"; np(); para("افتتاحية العدد", { font: F(54, 700), color: C.ac, fs: 54, lh: 1.6 }); pg.ops.push({ t: "rect", x: PW - MX - 220, y: y - 18, w: 220, h: 5, c: C.gold }); y += 24;
      blocks(x.intro).forEach(b => para(b.h || b.p, { fs: 34 })); para("— هيئة التحرير", { font: FS(28, 600), color: C.gold, fs: 28 }); }
    for (const [si, s] of (x.secs || []).entries()) {
      sec = s.t; np();
      pg.ops.push({ t: "band", y: y - 40, h: 96, s: s.t }); y += 100;
      for (const [ii, it] of s.items.entries()) {
        const sty = styOf(it); let t = ""; try { t = await itemText(it); } catch (e) { t = "تعذر تحميل النص."; }
        if (ii > 0) { if (y > BOT - 360) np(); else { pg.ops.push({ t: "orn", y: y + 10 }); y += 80; } }
        marks.push({ si, ii, page: pages.length - 1, title: itemTitle(it), sec: s.t });
        const kind = (STY.find(z => z[0] === sty) || STY[0])[1] + (colOf(it) ? " • " + colOf(it) : "");
        room(220); para(kind, { font: FS(24, 600), color: C.gold, fs: 24, lh: 1.5, after: 34 });
        para(itemTitle(it), { font: F(sty === "quote" ? 46 : 50, 700), color: C.ac, fs: 50, lh: 1.45, after: 6 });
        para(itemAuthor(it) + (itemOrig(it) && itemOrig(it) !== itemTitle(it) ? " — من «" + itemOrig(it) + "»" : ""), { font: FS(26, 500), color: C.mut, fs: 26, lh: 1.6, after: 18 });
        if (it.intro) para("مقدمة المجلة: " + it.intro, { font: FS(26, 400), fs: 26, lh: 1.8, bg: C.soft, color: "#4a3a14" });
        const B_ = blocks(t);
        if (sty === "quote") { y += 10; B_.forEach(b => para(b.h || b.p, { font: F(40, 400), fs: 40, lh: 1.9, al: "center", color: C.ac, bg: C.green2 })); y += 10; }
        else B_.forEach(b => {
          if (b.h) return para(b.h, { font: F(36, 700), color: C.ac, fs: 36, lh: 1.6 });
          if (sty === "fatwa" && /^(السؤال|الجواب)\s*:?$/.test(b.p)) return para(b.p.replace(/\s*:$/, ""), { font: FS(28, 700), color: b.p.startsWith("السؤال") ? C.gold : C.ac, fs: 28, lh: 1.5, after: 2 });
          const qv = /^[«"]|﴿|\{/.test(b.p) && b.p.length < 240;
          para(b.p, sty === "hadith" || sty === "tafsir" ? { fs: 33, bar: qv ? C.gold : null, color: qv ? C.ac : C.ink } : sty === "adab" && / \.\.\. /.test(b.p) ? { fs: 33, al: "center", color: "#4a3a14" } : { fs: 33 });
        });
        para("المصدر: " + (it.ref ? (B(it.ref).setTitle || B(it.ref).title) + (kindOf(B(it.ref)) === "book" ? "، ص " + toAr(it.p || 1) + (it.p2 > it.p ? "–" + toAr(it.p2) : "") : "") : it.src || ""), { font: FS(22, 400), color: C.mut, fs: 22, lh: 1.6 });
      }
    }
    // الغلاف الخلفي
    pages.push({ back: true, ops: [] });
    return { pages, marks, x };
  }

  const IMG = {}; const img = src => IMG[src] || (IMG[src] = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
  function star(c, x, y, r) { c.beginPath(); for (let k = 0; k < 2; k++) { c.save(); c.translate(x, y); c.rotate(k * Math.PI / 4); c.rect(-r, -r, 2 * r, 2 * r); c.restore(); } }
  function pattern(c, alpha) { c.save(); c.strokeStyle = `rgba(227,190,106,${alpha})`; c.lineWidth = 2; for (let y = 0; y < PH + 140; y += 140) for (let x = (y / 140 % 2) * 70; x < PW + 140; x += 140) { star(c, x, y, 30); c.stroke(); } c.restore(); }
  async function drawPage(cv, L, n) {
    const p = L.pages[n], x = L.x, c = cv.getContext("2d"), name = D.name || NAME; cv.width = PW; cv.height = PH; c.direction = "rtl";
    const [emb, logo] = await Promise.all([img("assets/logo-sdsl.png"), img("assets/logo.jpg")]);
    const center = (s, y, font, color) => { c.font = font; c.fillStyle = color; c.textAlign = "center"; c.fillText(s, PW / 2, y); };
    if (p.cover || p.back) {
      const g = c.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, "#0f5c4d"); g.addColorStop(1, "#06261f"); c.fillStyle = g; c.fillRect(0, 0, PW, PH); pattern(c, .13);
      c.strokeStyle = "#e3be6a"; c.lineWidth = 4; c.strokeRect(46, 46, PW - 92, PH - 92); c.lineWidth = 1.5; c.strokeRect(62, 62, PW - 124, PH - 124);
      if (p.back) { if (emb) c.drawImage(emb, PW / 2 - 130, 520, 260, 260); center(SITENAME, 880, FS(40, 700), "#fff"); center(siteLink("").replace(/^https?:\/\//, "").replace(/\/$/, ""), 945, FS(32, 500), "#e3be6a"); center(name + " — العدد " + toAr(x.no || ""), 1060, F(38), "#f3ecd9"); center("﴿قُلْ هَٰذِهِ سَبِيلِي أَدْعُو إِلَى اللَّهِ عَلَىٰ بَصِيرَةٍ﴾", 1250, F(40), "#e3be6a"); return; }
      c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(62, 140, PW - 124, 250);
      center(name, 280, F(84, 700, "Aref Ruqaa"), "#f7e7b8");
      center("مجلة دورية تصدر عن " + SITENAME, 350, FS(28, 500), "#d8e8e0");
      center("العدد " + toAr(x.no || "") + "  •  " + fmtDate(x.date) + (x.hijri ? "  •  " + x.hijri : ""), 470, FS(34, 600), "#e3be6a");
      const T = wrapL(F(96, 700), x.title || x.theme || "", PW - 260); T.forEach((l, i) => center(l, 650 + i * 130, F(96, 700), "#ffffff"));
      let y = 650 + T.length * 130; if (x.sub) { wrapL(F(40), x.sub, PW - 300).forEach(l => { center(l, y, F(40), "#f3ecd9"); y += 62; }); }
      y = Math.max(y + 40, 940); const bh = 130 + 6 * 56; c.fillStyle = "rgba(255,255,255,.93)"; c.beginPath(); c.roundRect ? c.roundRect(150, y, PW - 300, bh, 26) : c.rect(150, y, PW - 300, bh); c.fill();
      center("في هذا العدد", y + 70, F(46, 700), C.ac); c.fillStyle = C.gold; c.fillRect(PW / 2 - 90, y + 92, 180, 4);
      L.marks.slice(0, 6).forEach((m, i) => { c.font = F(32); c.fillStyle = C.ink; c.textAlign = "right"; const t = wrapL(F(32), m.title, PW - 400)[0]; c.fillText("◆ " + t, PW - 200, y + 160 + i * 56); });
      if (emb) c.drawImage(emb, 120, PH - 235, 110, 110); if (logo) { const lw = 100, lh = lw * logo.height / logo.width; c.fillStyle = "#fff"; c.fillRect(PW - 230, PH - 245, lw + 16, lh + 16); c.drawImage(logo, PW - 222, PH - 237, lw, lh); }
      center(siteLink("").replace(/^https?:\/\//, "").replace(/\/$/, ""), PH - 130, FS(30, 600), "#e3be6a"); return;
    }
    c.fillStyle = C.paper; c.fillRect(0, 0, PW, PH);
    c.strokeStyle = C.gold; c.lineWidth = 2; c.strokeRect(40, 40, PW - 80, PH - 80);
    // الترويسة والتذييل
    c.font = F(30, 700, "Aref Ruqaa"); c.fillStyle = C.ac; c.textAlign = "right"; c.fillText(name, PW - MX, 105);
    c.font = FS(24, 500); c.fillStyle = C.mut; c.textAlign = "left"; c.fillText(p.toc ? "فهرس العدد" : p.sec || "", MX, 105);
    c.fillStyle = C.gold; c.fillRect(MX, 125, CW, 2);
    c.fillStyle = C.gold; c.fillRect(MX, PH - 120, CW, 1.5); c.font = FS(22, 500); c.fillStyle = C.mut; c.textAlign = "right"; c.fillText("العدد " + toAr(x.no || "") + " • " + fmtDate(x.date), PW - MX, PH - 78); c.textAlign = "left"; c.fillText(siteLink("").replace(/^https?:\/\//, "").replace(/\/$/, ""), MX, PH - 78);
    c.save(); c.translate(PW / 2, PH - 86); c.fillStyle = C.ac; star(c, 0, 0, 26); c.fill(); c.restore(); c.font = FS(24, 700); c.fillStyle = "#fff"; c.textAlign = "center"; c.fillText(toAr(n + 1), PW / 2, PH - 78);
    if (emb) { c.globalAlpha = .045; c.drawImage(emb, PW / 2 - 330, PH / 2 - 330, 660, 660); c.globalAlpha = 1; }
    if (p.toc) {
      let y = 230; if (p.first) { center("فهرس العدد", y, F(60, 700), C.ac); y += 40; c.fillStyle = C.gold; c.fillRect(PW / 2 - 110, y, 220, 4); y += 90; }
      for (const r of p.rows) { if (r.sec) { c.fillStyle = C.green2; c.fillRect(MX, y - 42, CW, 58); c.font = F(36, 700); c.fillStyle = C.ac; c.textAlign = "right"; c.fillText(r.sec, PW - MX - 16, y); y += 74; continue; }
        const m = L.marks.find(k => k.si === r.si && k.ii === r.ii), t = wrapL(F(31), r.title, CW - 170)[0];
        c.font = F(31); c.fillStyle = C.ink; c.textAlign = "right"; c.fillText(t, PW - MX - 30, y); c.textAlign = "left"; c.font = FS(28, 700); c.fillStyle = C.gold; c.fillText(m ? toAr(m.page + 1) : "", MX + 10, y);
        c.strokeStyle = "rgba(184,138,46,.4)"; c.setLineDash([3, 8]); c.beginPath(); c.moveTo(MX + 70, y - 8); c.lineTo(PW - MX - 40 - meas(F(31), t), y - 8); c.stroke(); c.setLineDash([]); y += 54; }
      return;
    }
    for (const o of p.ops) {
      if (o.t === "rect") { c.fillStyle = o.c; c.fillRect(o.x, o.y, o.w, o.h); }
      else if (o.t === "band") { const g = c.createLinearGradient(0, 0, PW, 0); g.addColorStop(0, "#08332b"); g.addColorStop(1, "#0f5c4d"); c.fillStyle = g; c.fillRect(MX - 20, o.y, CW + 40, o.h); c.save(); c.beginPath(); c.rect(MX - 20, o.y, CW + 40, o.h); c.clip(); c.strokeStyle = "rgba(227,190,106,.25)"; c.lineWidth = 2; for (let k = 0; k < 14; k++) { star(c, MX + k * 90, o.y + o.h / 2, 22); c.stroke(); } c.restore(); c.font = F(46, 700); c.fillStyle = "#f7e7b8"; c.textAlign = "center"; c.fillText(o.s, PW / 2, o.y + o.h / 2 + 16); }
      else if (o.t === "orn") { c.fillStyle = C.gold; c.fillRect(PW / 2 - 200, o.y, 160, 2); c.fillRect(PW / 2 + 40, o.y, 160, 2); c.save(); c.translate(PW / 2, o.y + 1); star(c, 0, 0, 12); c.fill(); c.restore(); }
      else if (o.t === "text") { c.font = o.font; c.fillStyle = o.color; c.textAlign = o.al; c.fillText(o.s, o.x, o.y); }
    }
  }

  // عارض الصفحات: تقليب بالأزرار والسحب والأسهم، وقفز من الفهرس، وتحميل الصفحة أو العدد كاملًا صورًا (ZIP)
  let LAY = null;
  async function getLayout(id) { const x = D.issues.find(y => y.id === id); if (!x) throw new Error("العدد غير موجود"); if (LAY && LAY.x === x) return LAY; toast("جارٍ تجهيز صفحات العدد…"); LAY = await layout(x); return LAY; }
  async function flip(id, start) {
    const L = await getLayout(id); let n = start || 0;
    document.getElementById("majfb")?.remove();
    document.body.insertAdjacentHTML("beforeend", `<div id="majfb" class="majfb" role="dialog" aria-label="تصفح العدد" data-noswipe><div class="mjbar"><button class="btn s" data-fb="close" aria-label="إغلاق">✕</button><select data-fb="go" aria-label="انتقل إلى موضوع"><option value="0">الغلاف</option>${L.pages.map((p, k) => p.toc && p.first ? `<option value="${k}">فهرس العدد</option>` : "").join("")}${L.marks.map(m => `<option value="${m.page}">${esc(m.sec)} › ${esc(m.title)}</option>`).join("")}</select><span id="mjpn" class="mut"></span><button class="btn s" data-fb="png">تحميل الصفحة</button><button class="btn s" data-fb="zip">العدد صورًا</button></div><div class="mjstage"><button class="mjnav" data-fb="next" aria-label="الصفحة التالية">‹</button><canvas id="mjcv" width="${PW}" height="${PH}"></canvas><button class="mjnav" data-fb="prev" aria-label="الصفحة السابقة">›</button></div></div>`);
    const cv = document.getElementById("mjcv"), pn = document.getElementById("mjpn"), sel = document.querySelector("[data-fb=go]");
    const show_ = async k => { n = Math.max(0, Math.min(L.pages.length - 1, k)); cv.classList.remove("in"); await drawPage(cv, L, n); void cv.offsetWidth; cv.classList.add("in"); pn.textContent = "صفحة " + toAr(n + 1) + " من " + toAr(L.pages.length); };
    const fb = document.getElementById("majfb");
    fb.addEventListener("click", async e => { const b = e.target.closest("[data-fb]"); if (!b || b.tagName === "SELECT") return; const a = b.dataset.fb;
      if (a === "close") { fb.remove(); document.removeEventListener("keydown", key); } else if (a === "next") show_(n + 1); else if (a === "prev") show_(n - 1);
      else if (a === "png") cv.toBlob(bl => save(bl, `majalla-${L.x.no || L.x.id}-p${n + 1}.png`)); else if (a === "zip") zip(id); });
    sel.onchange = () => show_(+sel.value);
    const key = e => { if (!document.getElementById("majfb")) return; if (e.key === "ArrowLeft") show_(n + 1); else if (e.key === "ArrowRight") show_(n - 1); else if (e.key === "Escape") fb.querySelector("[data-fb=close]").click(); };
    document.addEventListener("keydown", key);
    let sx = null; cv.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true }); cv.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show_(dx > 0 ? n + 1 : n - 1); sx = null; });
    show_(n);
  }
  async function zip(id) {
    const L = await getLayout(id), cv = document.createElement("canvas"), files = [];
    for (let i = 0; i < L.pages.length; i++) { toast("جارٍ رسم الصفحات " + toAr(i + 1) + " من " + toAr(L.pages.length)); await drawPage(cv, L, i); const bl = await new Promise(r => cv.toBlob(r, "image/jpeg", .9)); files.push([`majalla-${L.x.no || L.x.id}-${String(i + 1).padStart(2, "0")}.jpg`, new Uint8Array(await bl.arrayBuffer())]); }
    save(new Blob([EXT.zip(files)], { type: "application/zip" }), `majalla-${L.x.no || L.x.id}-images.zip`); toast("حُفظ العدد صورًا");
  }

  // ---------- المسودة الآلية ----------
  // تختار من المقالات والفتاوى والكتب ما يطابق كلمات الموضوع في العنوان أو القسم، دون تكرار ما نُشر في أعداد سابقة،
  // وبتنويع الكتّاب (مادة واحدة لكل كاتب في الباب، إلا الفتاوى فأغلبها لمفتٍ واحد)، ثم تبحث في نص الكتب المرشحة عن الصفحة الأنسب.
  async function autoDraft(theme, except) {
    const w = norm(theme).split(/\s+/).filter(s => s.length > 1); if (!w.length) throw new Error("اكتب كلمات الموضوع");
    const skip = used(except), score = b => { const t = norm(b.title), tp = norm(topicLabel(T(b.topicId))); return w.reduce((n, k) => n + (t.includes(k) ? 3 : 0) + (tp.includes(k) ? 1 : 0), 0); };
    const pick = (list, n, per = 1) => { const seen = {}, out = []; list.map(b => [b, score(b)]).filter(([b, s]) => s > 0 && !skip.has(b.id) && !b.hidden && !b.h).sort((x, y) => y[1] - x[1] || (y[0].date || "").localeCompare(x[0].date || "")).forEach(([b]) => { if (out.length < n && (seen[b.authorId] || 0) < per) { seen[b.authorId] = (seen[b.authorId] || 0) + 1; out.push(b); } }); return out; };
    const books = async (list, n) => { const out = []; for (const b of pick(list, n * 3)) { if (out.length >= n) break; try { const bb = await loadBook(b.id); let best = 0, bp = 1; bb.pages.forEach((pg, i) => { const t = norm(pg); const s = w.reduce((m, k) => m + (t.includes(k) ? 1 : 0), 0); if (s > best) { best = s; bp = i + 1; } }); if (best) out.push({ ref: b.id, p: bp, p2: Math.min(bb.pages.length, bp + 1) }); } catch (e) { } } return out; };
    const secs = [
      { t: "مقالات العدد", items: pick(ARTS(), 4).map(b => ({ ref: b.id })) },
      { t: "فتاوى في الموضوع", items: pick(FATWAS(), 4, 4).map(b => ({ ref: b.id })) },
      { t: "من كتب مشايخ الدعوة", items: await books(BOOKS().filter(b => bc(b) === "dawah"), 2) },
      { t: "من المكتبة العامة", items: await books(BOOKS().filter(b => bc(b) === "turath" && !b.vf), 2) }
    ].filter(s => s.items.length);
    if (!secs.length) throw new Error("لم توجد مواد مطابقة؛ جرّب كلمات أخرى");
    return secs;
  }

  // ---------- الإدارة ----------
  async function admin(q) {
    await load(true);
    const L = D.issues.slice().sort((a, b) => (b.no || 0) - (a.no || 0)), id = q && q.i;
    if (id && L.some(x => x.id === id)) { ED = JSON.parse(JSON.stringify(L.find(x => x.id === id))); setTimeout(paint, 0); return `<div id="majed"></div>`; }
    const next = Math.max(0, ...L.map(x => x.no || 0)) + 1;
    return `<p class="mut">كل عدد يُبنى من مواد المكتبة نفسها (بروابطها وبنصها الأصلي)، ويمكن لصق نص جديد. اكتب الموضوع فتُعدّ المجلة مسودة آلية تراجعها وتعدّلها، ثم ترسلها للمراجعة، ويعتمدها المدير وينشرها.</p>
     <form data-form="majnew" class="relform"><div class="row"><div><label>رقم العدد</label><input name="no" type="number" min="1" value="${next}"></div><div><label>تاريخ العدد</label><input name="date" type="date" value="${today()}"></div></div>
      <label>موضوع العدد (كلمات يُبحث بها في المكتبة)</label><input name="theme" required maxlength="120" placeholder="مثل: الصيام، بر الوالدين، التوحيد">
      <label>عنوان العدد (اختياري؛ الافتراضي الموضوع)</label><input name="title" maxlength="160">
      <div class="savebar"><button class="btn p" name="auto" value="1">إنشاء مسودة آلية</button> <button class="btn" name="auto" value="0">عدد فارغ</button> <span id="majst" class="mut"></span></div></form>
     <h3>الأعداد (${toAr(L.length)})</h3>${L.map(x => `<div class="bk"><b>العدد ${toAr(x.no || "")}: ${esc(x.title || x.theme || "")}</b><span>${esc([fmtDate(x.date), stName(x.status), (x.secs || []).reduce((n, s) => n + s.items.length, 0) + " مادة"].join(" • "))}</span> <a class="btn s" href="#/admin?t=majalla&i=${esc(x.id)}">تحرير</a> <a class="btn s" href="#/majalla/${esc(x.id)}">معاينة</a></div>`).join("") || '<p class="mut">لا أعداد بعد.</p>'}`;
  }

  function paint() {
    const el = document.getElementById("majed"); if (!el || !ED) return;
    const x = ED, ns = (x.secs || []).length;
    const stOpts = ST.filter(([k]) => k !== "published" || canPublish() || x.status === "published").map(([k, l]) => `<option value="${k}"${x.status === k ? " selected" : ""}>${l}</option>`).join("");
    el.innerHTML = `<p><a href="#/admin?t=majalla">كل الأعداد</a> › العدد ${toAr(x.no || "")} <a class="btn s" href="#/majalla/${esc(x.id)}">معاينة المحفوظ</a></p>
     <div class="row"><div><label>رقم العدد</label><input data-majf="no" type="number" min="1" value="${esc(x.no || "")}"></div><div><label>التاريخ</label><input data-majf="date" type="date" value="${esc(x.date || "")}"></div><div><label>الحالة</label><select data-majf="status">${stOpts}</select></div></div>
     <label>عنوان العدد</label><input data-majf="title" maxlength="160" value="${esc(x.title || "")}">
     <div class="row"><div><label>عنوان فرعي للغلاف</label><input data-majf="sub" maxlength="200" value="${esc(x.sub || "")}"></div><div><label>التاريخ الهجري (اختياري)</label><input data-majf="hijri" maxlength="40" value="${esc(x.hijri || "")}"></div></div>
     <label>افتتاحية العدد (من إعداد المجلة)</label><textarea data-majf="intro" rows="4" maxlength="4000">${esc(x.intro || "")}</textarea>
     ${(x.secs || []).map((s, si) => `<fieldset class="majsecd"><legend><input data-majsec="${si}" value="${esc(s.t)}" maxlength="80" aria-label="اسم الباب"></legend>
       ${s.items.map((it, ii) => `<div class="majit"><div><b>${toAr(ii + 1)}. ${esc(itemTitle(it))}</b> <span class="mut">${esc(itemAuthor(it))}${it.ref ? " • " + esc(kindAr(B(it.ref) || {})) + (kindOf(B(it.ref) || {}) === "book" ? ` ص${toAr(it.p || 1)}${it.p2 > it.p ? "–" + toAr(it.p2) : ""}` : "") : " • نص ملصوق"}</span></div>
        <div class="row"><input data-majit="${si}.${ii}.title" placeholder="عنوان تحريري (اختياري؛ الأصلي: ${esc(itemOrig(it) || "—")})" value="${esc(it.title || "")}" maxlength="160">${kindOf(B(it.ref) || {}) === "book" ? `<input data-majit="${si}.${ii}.p" type="number" min="1" style="max-width:90px" value="${it.p || 1}" aria-label="من صفحة"><input data-majit="${si}.${ii}.p2" type="number" min="1" style="max-width:90px" value="${it.p2 || it.p || 1}" aria-label="إلى صفحة">` : ""}</div>
        <div class="row"><div><label>نمط العرض</label><select data-majst="${si}.${ii}">${STY.map(([k, l]) => `<option value="${k}"${styOf(it) === k ? " selected" : ""}>${l}</option>`).join("")}</select></div><div><label>المقتطف يبدأ من عبارة (اختياري)</label><input data-majit="${si}.${ii}.from" value="${esc(it.from || "")}" maxlength="200"></div><div><label>وينتهي بعبارة</label><input data-majit="${si}.${ii}.to" value="${esc(it.to || "")}" maxlength="200"></div></div>
        <textarea data-majit="${si}.${ii}.intro" rows="2" maxlength="1500" placeholder="مقدمة المجلة لهذه المادة (اختياري)">${esc(it.intro || "")}</textarea>
        <div class="majbtns"><button class="btn s" data-majact="up" data-k="${si}.${ii}" ${ii ? "" : "disabled"}>↑</button><button class="btn s" data-majact="down" data-k="${si}.${ii}" ${ii < s.items.length - 1 ? "" : "disabled"}>↓</button>${ns > 1 ? `<select data-majact="move" data-k="${si}.${ii}" aria-label="نقل إلى باب"><option value="">نقل إلى باب…</option>${x.secs.map((t, k) => k !== si ? `<option value="${k}">${esc(t.t)}</option>` : "").join("")}</select>` : ""}<button class="btn s" data-majact="rm" data-k="${si}.${ii}">إزالة من العدد</button></div></div>`).join("") || '<p class="mut">لا مواد في هذا الباب.</p>'}
       <div class="row"><input data-majadd="${si}" placeholder="أضف مادة: معرّفها أو رابطها في المكتبة (مثل ‎#/book/sv123‎)"><button class="btn s" data-majact="add" data-k="${si}">إضافة</button></div>
       <details><summary>لصق نص جديد في هذا الباب</summary><input data-majpaste="${si}.title" placeholder="العنوان" maxlength="160"><input data-majpaste="${si}.author" placeholder="الكاتب" maxlength="120"><input data-majpaste="${si}.src" placeholder="المصدر" maxlength="200"><textarea data-majpaste="${si}.text" rows="5" maxlength="40000" placeholder="النص"></textarea><button class="btn s" data-majact="paste" data-k="${si}">إضافة النص</button></details>
       <button class="btn s" data-majact="rmsec" data-k="${si}">حذف الباب من العدد</button></fieldset>`).join("")}
     <div class="row"><input id="majnewsec" placeholder="اسم باب جديد" maxlength="80"><button class="btn s" data-majact="addsec">إضافة باب</button></div>
     <details><summary>إعادة إنشاء المسودة الآلية بموضوع آخر (يستبدل الأبواب الحالية)</summary><div class="row"><input id="majretheme" value="${esc(x.theme || "")}" maxlength="120"><button class="btn s" data-majact="regen">إنشاء</button></div></details>
     <div class="savebar"><button class="btn p" data-majact="save">حفظ العدد</button> <span id="majst" class="mut">${x.log && x.log.length ? "آخر تعديل: " + esc(fmtDate(x.log[x.log.length - 1].at)) : ""}</span></div>
     ${x.log && x.log.length ? `<details><summary>سجل العدد</summary><ul class="mut">${x.log.slice(-30).reverse().map(l => `<li>${esc(fmtDate(l.at))} — ${esc(l.by)}: ${esc(l.act)}</li>`).join("")}</ul></details>` : ""}`;
  }
  const at = k => { const [si, ii] = k.split(".").map(Number); return [ED.secs[si], ii, si]; };
  const who = () => (typeof Cloud !== "undefined" && Cloud.role === "admin") || (typeof GH !== "undefined" && GH.on) ? "المدير" : "محرر";
  const refOf = s => { s = String(s || "").trim(); const m = s.match(/#\/book\/([^/?#\s]+)/); const id = m ? decodeURIComponent(m[1]) : s; return B(id) ? id : ""; };

  async function persist(x, act) {
    x.log = (x.log || []).concat({ at: new Date().toISOString(), by: who(), act }).slice(-200);
    await GH.editJSON(P, d => { d = d && d.issues ? d : { v: 1, name: NAME, issues: [] }; const i = d.issues.findIndex(y => y.id === x.id); if (i >= 0) d.issues[i] = x; else d.issues.push(x); return d; }, "مجلة المكتبة: " + act + " — العدد " + (x.no || x.id));
    D = null;
  }

  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form=majq],[data-form=majiq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const q = String(new FormData(f).get("q") || "").trim();
    if (f.dataset.form === "majq") { location.hash = "#/majalla" + (q ? "?q=" + encodeURIComponent(q) : ""); return; }
    // البحث داخل العدد: يميّز المواد المطابقة ويخفي غيرها، ويقفز إلى أولها
    const w = norm(q).split(/\s+/).filter(Boolean), its = [...document.querySelectorAll(".majitem")]; let n = 0;
    its.forEach(el => { const ok = !w.length || w.every(k => norm(el.innerText).includes(k)); el.hidden = !ok; el.classList.toggle("mjhit", ok && !!w.length); if (ok && w.length) n++; });
    document.querySelectorAll(".majsec").forEach(sc => { sc.hidden = ![...sc.querySelectorAll(".majitem")].some(el => !el.hidden); });
    const r = document.getElementById("majiqr"); if (r) r.textContent = w.length ? (n ? `${toAr(n)} مادة تطابق «${q}». امسح البحث لعرض العدد كاملًا.` : "لا مواد مطابقة في هذا العدد.") : "";
    const first = its.find(el => !el.hidden && w.length); if (first) first.scrollIntoView({ behavior: "smooth" });
  }, true);

  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=majnew]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), st = f.querySelector("#majst"), auto = e.submitter ? e.submitter.value === "1" : true;
    const x = { id: "i" + Date.now().toString(36), no: +fd.get("no") || 1, date: fd.get("date") || today(), theme: String(fd.get("theme") || "").trim(), title: String(fd.get("title") || "").trim() || String(fd.get("theme") || "").trim(), status: "draft", intro: "", secs: [] };
    try { if (auto) { st.textContent = "جارٍ البحث في المكتبة وإعداد المسودة…"; x.secs = await autoDraft(x.theme, x.id); } else x.secs = [{ t: "مقالات العدد", items: [] }];
      st.textContent = "جارٍ الحفظ…"; await persist(x, auto ? "إنشاء مسودة آلية بموضوع «" + x.theme + "»" : "إنشاء عدد فارغ"); location.hash = "#/admin?t=majalla&i=" + x.id; }
    catch (err) { st.textContent = "تعذر: " + err.message; }
  }, true);

  document.addEventListener("input", e => {
    const t = e.target; if (!ED || !t.closest("#majed")) return;
    if (t.dataset.majf) ED[t.dataset.majf] = t.dataset.majf === "no" ? +t.value : t.value;
    else if (t.dataset.majsec) ED.secs[+t.dataset.majsec].t = t.value;
    else if (t.dataset.majit) { const [si, ii, k] = t.dataset.majit.split("."), it = ED.secs[+si].items[+ii]; if (k === "p" || k === "p2") it[k] = Math.max(1, +t.value || 1); else if (t.value.trim()) it[k] = t.value; else delete it[k]; }
  });

  document.addEventListener("change", e => {
    const t = e.target; if (ED && t.dataset.majst) { const [si, ii] = t.dataset.majst.split(".").map(Number); ED.secs[si].items[ii].st = t.value; return; }
    if (!ED || t.dataset.majact !== "move" || t.value === "") return;
    const [s, ii] = at(t.dataset.k); ED.secs[+t.value].items.push(s.items.splice(ii, 1)[0]); paint();
  });

  document.addEventListener("click", async e => {
    const g = e.target.closest("[data-majgo]"); if (g) { e.preventDefault(); const el = document.getElementById(g.dataset.majgo); if (el) el.scrollIntoView({ behavior: "smooth" }); return; }
    const el = e.target.closest("[data-majact]"); if (!el || el.tagName === "SELECT") return; e.preventDefault(); e.stopImmediatePropagation();
    const a = el.dataset.majact;
    if (a === "pdf") return window.print();
    if (a === "flip") { await load(); return flip(el.dataset.id).catch(err => toast("تعذر: " + err.message)); }
    if (a === "zip") { await load(); return zip(el.dataset.id).catch(err => toast("تعذر: " + err.message)); }
    if (a === "word") { await load(); return word(el.dataset.id); }
    if (a === "fav") { const k = "maj:" + el.dataset.id; S.favs = S.favs.includes(k) ? S.favs.filter(y => y !== k) : [...S.favs, k]; saveS(); el.textContent = S.favs.includes(k) ? "★ في المفضلة" : "☆ حفظ العدد"; return; }
    if (a === "share") { const x = D && D.issues.find(y => y.id === el.dataset.id), url = location.origin + location.pathname + "#/majalla/" + el.dataset.id, t = (D.name || NAME) + " — العدد " + ((x && x.no) || "") + ": " + ((x && x.title) || ""); if (navigator.share) navigator.share({ title: t, url }).catch(() => { }); else { navigator.clipboard.writeText(t + "\n" + url).then(() => toast("نُسخ الرابط")); } return; }
    if (!ED) return;
    const st = document.getElementById("majst");
    if (a === "up" || a === "down") { const [s, ii] = at(el.dataset.k), j = a === "up" ? ii - 1 : ii + 1; [s.items[ii], s.items[j]] = [s.items[j], s.items[ii]]; paint(); }
    else if (a === "rm") { const [s, ii] = at(el.dataset.k); s.items.splice(ii, 1); paint(); }
    else if (a === "rmsec") { if (!ED.secs[+el.dataset.k].items.length || confirm("حذف الباب وما فيه من العدد؟ (لا تُحذف المواد من المكتبة)")) { ED.secs.splice(+el.dataset.k, 1); paint(); } }
    else if (a === "addsec") { const v = (document.getElementById("majnewsec").value || "").trim(); if (v) { ED.secs.push({ t: v, items: [] }); paint(); } }
    else if (a === "add") { const si = +el.dataset.k, inp = document.querySelector(`[data-majadd="${si}"]`), id = refOf(inp.value); if (!id) { st.textContent = "لم يُعثر على هذه المادة في المكتبة."; return; }
      if (ED.secs.some(s => s.items.some(i => i.ref === id))) { st.textContent = "هذه المادة موجودة في العدد."; return; }
      const prev = used(ED.id); ED.secs[si].items.push(kindOf(B(id)) === "book" ? { ref: id, p: 1, p2: 1 } : { ref: id }); paint(); document.getElementById("majst").textContent = prev.has(id) ? "تنبيه: نُشرت هذه المادة في عدد سابق." : "أُضيفت."; }
    else if (a === "paste") { const si = el.dataset.k, v = k => (document.querySelector(`[data-majpaste="${si}.${k}"]`).value || "").trim(), text = v("text");
      if (!text || !v("title")) { st.textContent = "اكتب العنوان والنص."; return; } ED.secs[+si].items.push({ title: v("title"), author: v("author"), src: v("src"), text }); paint(); }
    else if (a === "regen") { const th = (document.getElementById("majretheme").value || "").trim(); st.textContent = "جارٍ إعداد المسودة…"; try { ED.secs = await autoDraft(th, ED.id); ED.theme = th; paint(); } catch (err) { st.textContent = err.message; } }
    else if (a === "save") {
      if (ED.status === "published" && !canPublish()) { st.textContent = "النشر للمدير وحده؛ اختر «قيد المراجعة»."; return; }
      el.disabled = true; st.textContent = "جارٍ الحفظ…";
      try { await persist(ED, "حفظ (" + stName(ED.status) + ")"); st.textContent = "حُفظ ✓"; } catch (err) { st.textContent = "تعذر الحفظ: " + err.message; }
      el.disabled = false;
    }
  }, true);

  const favCards = () => { if (!D) return ""; const L = D.issues.filter(x => S.favs.includes("maj:" + x.id) && x.status === "published"); return L.length ? `<h3>أعداد المجلة</h3>${L.map(x => `<a class="bk" href="#/majalla/${esc(x.id)}"><b>العدد ${toAr(x.no || "")}: ${esc(x.title || "")}</b><span>${esc(fmtDate(x.date))}</span></a>`).join("")}` : ""; };
  return { view: show, admin, load, favCards };
})();
