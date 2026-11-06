/* المصحف الرقمي (البند ١٦): #/mushaf فهرس السور والبحث في الآيات، و#/mushaf/<سورة>?a=<آية> عرض السورة.
   بالضغط على رقم الآية تُفتح نافذتها: مواضع تفسيرها في التفاسير (data/tafidx)، و«ما قيل فيها في كتب الدعوة ومقالاتها» بموجزات
   من كلام المشايخ بعد الآية مع الانتقال إلى الموضع (data/qcite يبنيه tools/quran-cite.py)، وتعليق العضو الخاص (على جهازه).
   والتصدير: الآيات المختارة وحدها، أو مع موجزات كتب الدعوة، أو مع تعليق العضو، بصيغة نص أو Word أو صورة، وبخط وحجم يختارهما. */
const MUS = (() => {
  let Q = null, QT = null; const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p;
  const getJ = async p => { for (const u of [RAW(p), "data/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  let META = null, PG = null; // صفحات مصحف المدينة (data/quran/meta.json: [صفحة، جزء، ربع حزب، سجدة] لكل آية)
  const load = async () => { if (Q) return; [Q, QT, META] = await Promise.all([fetch("data/quran/quran.json").then(r => r.json()), fetch("data/quran/uthmani.json").then(r => r.json()).catch(() => fetch("data/quran/quran-tash.json").then(r => r.json()).catch(() => null)), fetch("data/quran/meta.json").then(r => r.json()).then(j => j.s).catch(() => null)]);
    if (META) { PG = {}; Object.entries(META).forEach(([s, L]) => L.forEach((m, i) => (PG[m[0]] = PG[m[0]] || []).push([+s, i + 1]))); } };
  const pageOf = (s, a) => META && META[s] ? META[s][a - 1][0] : 0;
  const TAF = {}, tf = async (k, s) => TAF[k + s] || (TAF[k + s] = fetch("data/quran/tafsir/" + k + "/" + s + ".json").then(r => r.ok ? r.json() : {}).catch(() => ({}))), mukh = s => tf("mokhtasar", s);
  const TFS = [["mokhtasar", "المختصر في التفسير"], ["muyassar", "التفسير الميسر"], ["saddi", "تفسير السعدي"]];  // «السراج في بيان غريب القرآن»: يُضاف متى وُجد مصدر موثوق (نسخة spa5k الموسومة به هي تفسير السعدي في الحقيقة)
  const tfk = () => { try { return localStorage.getItem("mus_tf") || "mokhtasar"; } catch (e) { return "mokhtasar"; } };
  const nm = s => Q.suras[s - 1].name.replace(/^سُورَةُ\s*/, ""), nmP = s => strip(nm(s)).replace(/ٱ/g, "ا");
  // البسملة تُفصل عن الآية الأولى في كل سورة (عدا الفاتحة، فهي آيتها الأولى)، وتُعرض سطرًا مستقلًا
  const BASM = /^بِسْمِ\s+[ٱا]للَّهِ\s+[ٱا]لرَّحْمَ[ٰـ]?نِ\s+[ٱا]لرَّحِيمِ\s*/;
  const unB = t => { const w = t.split(/\s+/); return w.length > 4 && norm(strip(w.slice(0, 4).join(" "))).replace(/[ٱ]/g, "ا") === norm("بسم الله الرحمن الرحيم") ? w.slice(4).join(" ") : t.replace(BASM, ""); };
  const ayah = (s, a) => { const t = ((QT && QT.suras[s - 1].ayat[a - 1]) || Q.suras[s - 1].ayat[a - 1] || "").replace(/﻿/g, ""); return a === 1 && s !== 1 ? unB(t) : t; };
  const BASMT = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
  const words = (t, s, a) => t.split(/\s+/).filter(Boolean).map(w => `<span class="qw" data-act="musw" data-s="${s}" data-a="${a}">${esc(w)}</span>`).join(" ");
  const CC = {}, cites = async s => CC[s] || (CC[s] = getJ("qcite/" + s + ".json").then(x => x || {})), CMETA = { p: null }, meta = () => CMETA.p || (CMETA.p = getJ("qcite/_meta.json").then(x => x || {}));
  const TF = {}, taf = async s => TF[s] || (TF[s] = fetch("data/tafidx/" + s + ".json").then(r => r.json()).catch(() => ({})));
  const SEL = () => { try { return JSON.parse(localStorage.getItem("mus_sel") || "[]"); } catch (e) { return []; } }, setSel = l => { try { localStorage.setItem("mus_sel", JSON.stringify(l)); } catch (e) { } bar(); };
  const NOTE = () => { try { return JSON.parse(localStorage.getItem("mus_notes") || "{}"); } catch (e) { return {}; } }, setNote = (k, v) => { const o = NOTE(); if (v) o[k] = v; else delete o[k]; try { localStorage.setItem("mus_notes", JSON.stringify(o)); } catch (e) { } };
  const AR = n => toAr(n);

  async function index(q) {
    await load(); const qq = (q.q || "").trim();
    let res = "";
    if (qq) { const w = norm(qq).split(/\s+/).filter(Boolean), hits = []; Q.suras.forEach(s => s.ayat.forEach((t, i) => { const n = norm(t); if (hits.length < 200 && w.every(x => n.includes(x))) hits.push([s.n, i + 1]); }));
      res = `<p class="mut">${AR(hits.length)} آية${hits.length >= 200 ? " (أول ٢٠٠)" : ""}</p>` + hits.map(([s, a]) => `<a class="bk" href="#/mushaf/${s}?a=${a}"><p class="mqt">${esc(ayah(s, a))} ﴿${AR(a)}﴾</p><span>${esc(nm(s))} • الآية ${AR(a)}</span></a>`).join(""); }
    view(`<div class="cmhero"><div><h2>المصحف</h2><p>اقرأ السورة، واضغط رقم أي آية لترى مواضع تفسيرها، وما قاله مشايخ الدعوة فيها في كتبهم ومقالاتهم وفتاواهم، وانقل الآيات بتفسيرها أو تعليقك.</p></div></div>
    <form class="sbox" data-form="noop" id="musq"><input name="q" type="search" value="${esc(qq)}" placeholder="ابحث عن آية بكلماتها" aria-label="ابحث في الآيات"><button class="btn p">بحث</button></form>
    ${(() => { let l = 0; try { l = +localStorage.getItem("mus_last") || 0; } catch (e) { } return `<div class="row"><a class="btn p" href="#/mushaf/p/${l || 1}">📖 ${l ? "تابع القراءة من الصفحة " + AR(l) : "اقرأ بصفحات المصحف"}</a>${[1, 2, 5, 10, 20, 30].map(j => "").join("")}</div>`; })()}
    <div id="musres">${res}</div>${qq ? "" : `<div class="msuras">${Q.suras.map(s => `<a href="#/mushaf/${s.n}"><b>${AR(s.n)}</b><span>${esc(nm(s.n))}</span><small>${AR(s.ayat.length)} آية</small></a>`).join("")}</div>`}`);
    $("#musq").addEventListener("submit", e => { e.preventDefault(); const v = e.target.q.value.trim(); location.hash = "#/mushaf" + (v ? "?q=" + encodeURIComponent(v) : ""); });
    bar();
  }
  async function sura(s, q) {
    await load(); s = Math.max(1, Math.min(114, +s || 1)); const S_ = Q.suras[s - 1], sel = new Set(SEL()), notes = NOTE();
    view(`<div class="mnav"><a class="btn s" href="#/mushaf">☰ السور</a>${s > 1 ? `<a class="btn s" href="#/mushaf/${s - 1}">‹ ${esc(nm(s - 1))}</a>` : ""}${s < 114 ? `<a class="btn s" href="#/mushaf/${s + 1}">${esc(nm(s + 1))} ›</a>` : ""}</div>
    <div class="mpage"><h2 class="msh">${esc(Q.suras[s - 1].name)}</h2>${s !== 1 && s !== 9 ? '<p class="mbasm">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>' : ""}
    ${PG ? `<p style="text-align:center"><a class="btn s" href="#/mushaf/p/${pageOf(s, 1)}">📖 اعرضها بصفحات المصحف (من الصفحة ${AR(pageOf(s, 1))})</a></p>` : ""}
    <p class="qtext">${S_.ayat.map((_, i) => { const a = i + 1, k = s + ":" + a, pb = PG && a > 1 && pageOf(s, a) !== pageOf(s, a - 1) ? `<span class="mpb">صفحة ${AR(pageOf(s, a))}</span>` : ""; return `${pb}<span class="may${sel.has(k) ? " sel" : ""}" id="ay${a}">${words(ayah(s, a), s, a)} <button class="mno${notes[k] ? " hasn" : ""}" data-act="musay" data-s="${s}" data-a="${a}" aria-label="الآية ${a}: التفسير وما قيل فيها">﴿${AR(a)}﴾</button></span> `; }).join("")}</p></div>
    <p class="mut" style="text-align:center;font-size:.85rem">اضغط رقم الآية لتفسيرها وما قيل فيها، ولإضافتها إلى «التصدير».</p>`);
    if (q && q.a) { const el = $("#ay" + q.a); if (el) { el.classList.add("hl"); setTimeout(() => el.scrollIntoView({ block: "center" }), 100); } }
    bar();
  }
  async function mpage(n) {
    await load(); if (!PG) return sura(1, {});
    n = Math.max(1, Math.min(604, +n || 1)); const L = PG[n] || [], m0 = META[L[0][0]][L[0][1] - 1], suras = [...new Set(L.map(x => x[0]))];
    try { localStorage.setItem("mus_last", n); } catch (e) { }
    let body = "";
    L.forEach(([s, a]) => { if (a === 1) body += `<div class="msban"><span>${esc(Q.suras[s - 1].name)}</span></div>${s !== 1 && s !== 9 ? `<p class="mbasm">${BASMT}</p>` : ""}`;
      const sj = META[s][a - 1][3]; body += `<span class="may" id="ay${s}_${a}">${words(ayah(s, a), s, a)} <button class="mno" data-act="musay" data-s="${s}" data-a="${a}" aria-label="الآية ${a}">${AR(a)}</button>${sj ? '<span class="msj" title="موضع سجدة">۩</span>' : ""}</span> `; });
    view(`<div class="mnav"><a class="btn s" href="#/mushaf">☰ الفهرس</a><a class="btn s" href="#/mushaf/${suras[0]}">${esc(nm(suras[0]))} (سورة كاملة)</a><form id="mpj" data-form="noop" class="row" style="gap:4px"><input name="p" type="number" min="1" max="604" value="${n}" style="width:6em" aria-label="رقم الصفحة"><button class="btn s">انتقل</button></form></div>
    <div class="mpage mp"><div class="mph"><span>${suras.map(s => esc(nm(s))).join(" • ")}</span><span>الجزء ${AR(m0[1])} • الحزب ${AR(Math.ceil(m0[2] / 4))}</span></div>
    <div class="qtext">${body}</div><div class="mpf">${AR(n)}</div></div>
    <div class="mnav mnb">${n < 604 ? `<a class="btn" href="#/mushaf/p/${n + 1}" rel="next">‹ الصفحة ${AR(n + 1)}</a>` : "<span></span>"}${n > 1 ? `<a class="btn" href="#/mushaf/p/${n - 1}" rel="prev">الصفحة ${AR(n - 1)} ›</a>` : ""}</div>`);
    $("#mpj").addEventListener("submit", e => { e.preventDefault(); location.hash = "#/mushaf/p/" + e.target.p.value; });
    let x0 = null; const pg = $(".mpage"); pg.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    pg.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 70) location.hash = "#/mushaf/p/" + Math.max(1, Math.min(604, n + (dx > 0 ? 1 : -1))); x0 = null; }, { passive: true });
    bar();
  }
  // الكلمة: غريبها (السراج إن توفر، ثم المعاجم) وتفسير آيتها من «المختصر»
  async function wsheet(w, s, a) {
    const clean = strip(w).replace(/[^\u0621-\u064A]/g, "");
    openSheet("«" + w + "»", `<p class="mqt">${esc(ayah(s, a))} ﴿${AR(a)}﴾</p><h4>المختصر في التفسير <small class="mut">(مركز تفسير)</small></h4><div id="mwm" class="mut">…</div>
     <h4>غريب الكلمة</h4><div id="mwg" class="mut">…</div><div class="row" style="margin-top:8px"><button class="btn s p" data-act="muswlex" data-w="${esc(clean)}" data-s="${s}" data-a="${a}">المعاجم وكتب الشريعة</button><button class="btn s" data-act="musay" data-s="${s}" data-a="${a}">الآية: التفاسير وما قيل فيها</button></div>`);
    mukh(s).then(t => { const el = $("#mwm"); if (el) el.innerHTML = t[a] ? esc(t[a]) : "غير متاح."; });
    const g = await tf("siraj", s), el = $("#mwg"); if (!el) return;
    let v = g && g[a]; if (v) { const nw = norm(clean).replace(/^(و|ف|ب|ل|ك)(?=...)/, "").replace(/^ال(?=..)/, ""), segs = v.split(/\n+|(?<=[.。])\s+(?=[\u0621-\u064A﴿(«])/).filter(x => x.trim());
      const hit = segs.filter(x => nw.length >= 2 && norm(strip(x)).includes(nw)); if (hit.length) v = hit.join("\n"); } el.innerHTML = v ? esc(v) + '<p class="mut" style="font-size:.8rem">من «السراج في بيان غريب القرآن»</p>' : 'يُعرض هنا غريب الكلمة من «السراج في بيان غريب القرآن» متى أُضيف إلى المكتبة؛ وإلى ذلك اضغط «المعاجم وكتب الشريعة».';
  }
  async function showTf(k, s, a) { const t = await tf(k, s), el = $("#musmk"); if (!el) return; el.textContent = t[a] || "غير متاح لهذه الآية بعد.";
    document.querySelectorAll("#mustk .chip").forEach(c => c.classList.toggle("on", c.dataset.k === k)); }
  async function sheet(s, a) {
    const k = s + ":" + a, t = ayah(s, a), inSel = SEL().includes(k);
    openSheet(`${nmP(s)}: ${AR(a)}`, `<p class="mqt big">${esc(t)} ﴿${AR(a)}﴾</p>
    <div class="row"><button class="btn s${inSel ? "" : " p"}" data-act="musadd" data-k="${k}">${inSel ? "✓ في التصدير (إزالة)" : "＋ أضفها إلى التصدير"}</button><button class="btn s" data-act="muscopy" data-k="${k}">نسخ</button>${t.split(/\s+/).length >= 3 && typeof tafsirSheet === "function" ? `<button class="btn s" data-act="mustaf" data-k="${k}">اقرأ التفسير هنا</button>` : ""}</div>
    <div class="chips" id="mustk">${TFS.map(([k, n]) => `<button class="chip${k === tfk() ? " on" : ""}" data-act="mustk" data-k="${k}" data-s="${s}" data-a="${a}">${n}</button>`).join("")}</div><div id="musmk" class="mut tfbox">…</div>
    <h4>مواضع تفسيرها في التفاسير</h4><div id="mustf" class="mut">…</div>
    <h4>ما قيل فيها في كتب الدعوة ومقالاتها</h4><div id="musct" class="mut">جارٍ التحميل…</div>
    <h4>تعليقي على الآية <small class="mut">(خاص بك على هذا الجهاز)</small></h4><textarea id="musn" rows="3" maxlength="2000" style="width:100%" placeholder="فائدة أو تدبر…">${esc(NOTE()[k] || "")}</textarea>`, () => {
      $("#musn").addEventListener("input", e => { setNote(k, e.target.value.trim()); const b = document.querySelector(`#ay${a} .mno`); if (b) b.classList.toggle("hasn", !!e.target.value.trim()); });
    });
    showTf(tfk(), s, a);
    taf(s).then(ix => { const el = $("#mustf"); if (!el) return; const L = (ix && ix[a]) || [];
      el.innerHTML = L.length ? L.map(e => `<a class="chip" href="#/book/${esc(e[0])}/${e[1]}" data-act="closeSheet">${esc(e[0].startsWith("ibnkathir") ? "تفسير ابن كثير" : e[0].startsWith("baghawi") ? "تفسير البغوي" : (B(e[0]) || {}).title || e[0])}${e[2] ? "" : " (تقريبي)"}</a>`).join(" ") : "لم تُفهرس بعد."; });
    const [C, M] = await Promise.all([cites(s), meta()]), L = (C[a] || []).filter(x => M[x[0]]), el = $("#musct"); if (!el) return;
    const kind = { b: "كتاب", a: "مقال", fatwa: "فتوى" };
    el.innerHTML = L.length ? `<p class="mut">${AR(L.length)} موضعًا${L.length >= 25 ? " (أبرزها)" : ""}</p>` + L.map(x => { const m = M[x[0]]; return `<a class="bk ar" href="#/book/${esc(x[0])}/${x[1]}" data-act="closeSheet"><b>${esc(m[0])}</b><span>${esc(kind[m[2]] || "")} • ${esc(A(m[1]).name || "")}${m[2] === "b" ? " • ص " + AR(x[1]) : ""}</span>${x[2] ? `<p>${esc(x[2])}…</p>` : ""}</a>`; }).join("") : "لم يُعثر على موضع عُزيت فيه هذه الآية بعد.";
  }
  function bar() {
    let el = $("#musbar"); const l = SEL(), on = parse().p[0] === "mushaf";
    if (!on || !l.length) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement("div"); el.id = "musbar"; document.body.appendChild(el); }
    el.hidden = false; el.innerHTML = `<span>${AR(l.length)} آية مختارة</span><button class="btn s p" data-act="musexp">تصدير</button><button class="btn s" data-act="musclr">مسح</button>`;
  }
  async function exportDlg() {
    const l = SEL(); if (!l.length) return;
    openSheet("تصدير الآيات", `<form id="musx" data-form="noop"><p class="mut">${AR(l.length)} آية مختارة.</p>
     <fieldset><legend>المحتوى</legend><label class="inl"><input type="radio" name="c" value="a" checked> الآيات وحدها</label><br><label class="inl"><input type="radio" name="c" value="ac"> الآيات مع موجزات من كتب الدعوة (أول موضعين)</label><br><label class="inl"><input type="checkbox" name="n" checked> مع تعليقي تحت كل آية</label><br><label class="inl"><input type="checkbox" name="r" checked> مع العزو [السورة: رقم]</label></fieldset>
     <div class="row"><div><label>الصيغة</label><select name="f"><option value="txt">نص</option><option value="doc">Word</option><option value="png">صورة</option></select></div><div><label>الخط</label><select name="ff"><option value="Amiri Quran">أميري قرآن</option><option value="Amiri">أميري</option><option value="Traditional Arabic">Traditional Arabic</option><option value="IBM Plex Sans Arabic">بلكس</option></select></div><div><label>الحجم</label><input type="number" name="fs" value="22" min="12" max="48"></div></div>
     <button class="btn p">تصدير</button></form>`, () => { $("#musx").addEventListener("submit", e => { e.preventDefault(); run(e.target); }); });
  }
  async function run(f) {
    const l = SEL().map(k => k.split(":").map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]), withC = f.c.value === "ac", notes = NOTE(), M = withC ? await meta() : {};
    const blocks = [];
    for (const [s, a] of l) { const C = withC ? await cites(s) : {}, cs = withC ? (C[a] || []).filter(x => M[x[0]] && x[2]).slice(0, 2).map(x => ({ t: x[2], src: M[x[0]][0] + (A(M[x[0]][1]).name ? "، " + A(M[x[0]][1]).name : "") })) : [];
      blocks.push({ t: ayah(s, a), ref: `[${nmP(s)}: ${AR(a)}]`, cs, n: f.n.checked ? notes[s + ":" + a] || "" : "" }); }
    const ref = f.r.checked, F = f.f.value, ff = f.ff.value, fs = +f.fs.value || 22;
    if (F === "txt") return dl("آيات.txt", blocks.map(b => `﴿${b.t}﴾${ref ? " " + b.ref : ""}` + b.cs.map(c => `\n— ${c.t}… (${c.src})`).join("") + (b.n ? "\nتعليقي: " + b.n : "")).join("\n\n") + "\n\n" + SITENAME, "text/plain");
    if (F === "doc") return dl("آيات.doc", `<html><head><meta charset="utf-8"><style>body{direction:rtl;font-family:'${ff}',serif;font-size:${fs}pt}.a{text-align:center;line-height:2}.r{font-size:${Math.round(fs * .6)}pt;color:#777}.c{font-family:'Traditional Arabic',serif;font-size:${Math.round(fs * .65)}pt;color:#333;border-right:3pt solid #b88a2e;padding-right:8pt}.n{font-size:${Math.round(fs * .65)}pt;color:#0f5c4d}</style></head><body dir="rtl">${blocks.map(b => `<p class="a">﴿${esc(b.t)}﴾ ${ref ? `<span class="r">${esc(b.ref)}</span>` : ""}</p>${b.cs.map(c => `<p class="c">${esc(c.t)}… <i>(${esc(c.src)})</i></p>`).join("")}${b.n ? `<p class="n">تعليقي: ${esc(b.n)}</p>` : ""}`).join("<hr>")}<p class="r">${esc(SITENAME)}</p></body></html>`, "application/msword");
    // صورة: لوحة بهوية المكتبة
    try { await document.fonts.load(`${fs}px "${ff}"`); } catch (e) { }
    const W = 1080, P = 70, cv = document.createElement("canvas"), x = cv.getContext("2d"), lines = [];
    const wrap = (t, font, max) => { x.font = font; const ws = t.split(/\s+/), out = []; let ln = ""; ws.forEach(w => { const tt = ln ? ln + " " + w : w; if (x.measureText(tt).width > max && ln) { out.push(ln); ln = w; } else ln = tt; }); if (ln) out.push(ln); return out; };
    const AF = `${fs * 1.6}px "${ff}"`, CF = `${fs}px "Amiri"`, RF = `${fs * .9}px "Amiri"`;
    blocks.forEach((b, i) => { if (i) lines.push(["sep"]); wrap(`﴿${b.t}﴾`, AF, W - 2 * P).forEach(t => lines.push(["a", t])); if (ref) lines.push(["r", b.ref]); b.cs.forEach(c => wrap(c.t + "… (" + c.src + ")", CF, W - 2 * P - 20).forEach(t => lines.push(["c", t]))); if (b.n) wrap("تعليقي: " + b.n, CF, W - 2 * P).forEach(t => lines.push(["n", t])); });
    const lh = { a: fs * 2.6, r: fs * 1.6, c: fs * 1.7, n: fs * 1.7, sep: fs * 1.4 }; cv.width = W; cv.height = Math.min(16000, P * 2 + 60 + lines.reduce((h, l) => h + lh[l[0]], 0));
    x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, cv.height); x.strokeStyle = "#b88a2e"; x.lineWidth = 4; x.strokeRect(24, 24, W - 48, cv.height - 48);
    x.direction = "rtl"; let y = P + 20;
    lines.forEach(([k, t]) => { y += lh[k]; if (k === "sep") { x.strokeStyle = "rgba(184,138,46,.4)"; x.lineWidth = 1; x.beginPath(); x.moveTo(W * .3, y - lh.sep / 2); x.lineTo(W * .7, y - lh.sep / 2); x.stroke(); return; }
      x.textAlign = k === "a" || k === "r" ? "center" : "right"; x.font = k === "a" ? AF : k === "r" ? RF : CF; x.fillStyle = k === "a" ? "#14231f" : k === "n" ? "#0f5c4d" : k === "r" ? "#8a7a5a" : "#333"; x.fillText(t, k === "a" || k === "r" ? W / 2 : W - P - 10, y); });
    x.textAlign = "center"; x.font = `18px "Amiri"`; x.fillStyle = "#8a7a5a"; x.fillText(SITENAME, W / 2, cv.height - 40);
    cv.toBlob(bl => dl("آيات.png", bl, "image/png"), "image/png");
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "musay") sheet(+el.dataset.s, +el.dataset.a);
    else if (a === "musw") wsheet(el.textContent, +el.dataset.s, +el.dataset.a);
    else if (a === "mustk") { try { localStorage.setItem("mus_tf", el.dataset.k); } catch (x) { } showTf(el.dataset.k, +el.dataset.s, +el.dataset.a); }
    else if (a === "muswlex") { closeSheet(); setTimeout(() => typeof wordSheet === "function" && wordSheet(el.dataset.w, ayah(+el.dataset.s, +el.dataset.a), "lug"), 150); }
    else if (a === "musadd") { const l = SEL(), k = el.dataset.k, i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else l.push(k); setSel(l); const sp = $("#ay" + k.split(":")[1]); if (sp) sp.classList.toggle("sel", i < 0); el.textContent = i >= 0 ? "＋ أضفها إلى التصدير" : "✓ في التصدير (إزالة)"; }
    else if (a === "muscopy") { const [s, n] = el.dataset.k.split(":").map(Number); navigator.clipboard && navigator.clipboard.writeText(`﴿${ayah(s, n)}﴾ [${nmP(s)}: ${n}]`).then(() => toast("نُسخت")); }
    else if (a === "mustaf") { const [s, n] = el.dataset.k.split(":").map(Number); closeSheet(); setTimeout(() => tafsirSheet(Q.suras[s - 1].ayat[n - 1]), 150); }
    else if (a === "musexp") exportDlg(); else if (a === "musclr") { if (confirm("مسح الآيات المختارة؟")) { setSel([]); document.querySelectorAll(".may.sel").forEach(x => x.classList.remove("sel")); } } });
  window.addEventListener("hashchange", () => setTimeout(bar, 50));
  return { view: (q, s, n) => s === "p" ? mpage(n) : s ? sura(s, q) : index(q) };
})();
