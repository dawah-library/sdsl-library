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
  const TFS = [["mokhtasar", "المختصر في التفسير"], ["muyassar", "التفسير الميسر"], ["saddi", "تفسير السعدي"], ["siraj", "السراج في غريب القرآن"]];
  const sjTxt = v => Array.isArray(v) ? v.map(([w, m]) => "﴿" + w + "﴾: " + m).join("\n") : (v || "");
  const sk = t => strip(String(t || "")).replace(/[^\u0621-\u064A]/g, "").replace(/[أإآٱ]/g, "ا").replace(/[اوىي]/g, "");  // «السراج في بيان غريب القرآن»: يُضاف متى وُجد مصدر موثوق (نسخة spa5k الموسومة به هي تفسير السعدي في الحقيقة)
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

  // الفهرس: يتحكم القارئ في نوعه (السور، الأجزاء، الأحزاب، الأرباع) وشكله (بطاقات أو قائمة) وما يظهر فيه، ويُحفظ على جهازه
  const MADANI = new Set([2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110]);  // بحسب مصحف المدينة
  const IXD = { v: "suras", lay: "grid", ay: 1, pg: 1, ty: 1 };
  const ixo = () => { try { return Object.assign({}, IXD, JSON.parse(localStorage.getItem("mus_ix") || "{}")); } catch (e) { return Object.assign({}, IXD); } };
  const ixs = o => { try { localStorage.setItem("mus_ix", JSON.stringify(o)); } catch (e) { } };
  const words3 = (s, a, n) => String(ayah(s, a)).split(/\s+/).slice(0, n || 4).join(" ");
  function marks(i) {  // أول آية في كل جزء أو حزب أو ربع: [الرقم، السورة، الآية، الصفحة]
    const out = [], seen = new Set();
    if (!META) return out;
    Object.keys(META).map(Number).sort((a, b) => a - b).forEach(s => META[s].forEach((m, k) => { const x = i === "juz" ? m[1] : i === "hizb" ? Math.ceil(m[2] / 4) : m[2]; if (!seen.has(x)) { seen.add(x); out.push([x, s, k + 1, m[0]]); } }));
    return out;
  }
  function ixHtml() {
    const o = ixo(), tabs = [["suras", "السور"], ["juz", "الأجزاء"], ["hizb", "الأحزاب"], ["rub", "أرباع الأحزاب"]];
    const ctl = `<div class="mixc"><div class="chips">${tabs.map(([k, n]) => `<button class="chip${o.v === k ? " on" : ""}" data-act="musix" data-k="v" data-v="${k}">${n}</button>`).join("")}</div>
      <div class="chips"><button class="chip${o.lay === "grid" ? " on" : ""}" data-act="musix" data-k="lay" data-v="grid">▦ بطاقات</button><button class="chip${o.lay === "list" ? " on" : ""}" data-act="musix" data-k="lay" data-v="list">☰ قائمة</button>
      ${o.v === "suras" ? `<label class="inl"><input type="checkbox" data-act="musixc" data-k="ay"${o.ay ? " checked" : ""}> عدد الآيات</label><label class="inl"><input type="checkbox" data-act="musixc" data-k="pg"${o.pg ? " checked" : ""}> الصفحة</label><label class="inl"><input type="checkbox" data-act="musixc" data-k="ty"${o.ty ? " checked" : ""}> مكية/مدنية</label>` : ""}</div></div>`;
    const cls = "msuras" + (o.lay === "list" ? " mlist" : "");
    if (o.v === "suras") return ctl + `<div class="${cls}">${Q.suras.map(s => { const pg = PG ? pageOf(s.n, 1) : 0, inf = [o.ay ? AR(s.ayat.length) + " آية" : "", o.pg && pg ? "ص " + AR(pg) : "", o.ty ? (MADANI.has(s.n) ? "مدنية" : "مكية") : ""].filter(Boolean).join(" • ");
      return `<a href="#/mushaf/${s.n}"><b>${AR(s.n)}</b><span>${esc(nm(s.n))}</span>${inf ? `<small>${inf}</small>` : ""}</a>`; }).join("")}</div>`;
    const L = marks(o.v), nmK = { juz: "الجزء", hizb: "الحزب", rub: "الربع" };
    if (!L.length) return ctl + '<p class="mut">بيانات الصفحات غير متاحة.</p>';
    if (o.v === "rub") return ctl + `<div class="${cls} mrub">${L.map(([x, s, a, pg]) => { const q4 = (x - 1) % 4, hz = Math.ceil(x / 4);
      return `<a href="#/mushaf/p/${pg}"><b>${q4 ? ["", "¼", "½", "¾"][q4] : "حزب " + AR(hz)}</b><span class="mqt">${esc(words3(s, a, 5))}…</span><small>${esc(nm(s))} ${AR(a)} • ص ${AR(pg)}</small></a>`; }).join("")}</div>`;
    return ctl + `<div class="${cls}">${L.map(([x, s, a, pg]) => `<a href="#/mushaf/p/${pg}"><b>${AR(x)}</b><span>${nmK[o.v]} ${o.v === "juz" ? (JUZN[x - 1] || "") : ""}</span><small>${esc(nm(s))} ${AR(a)} • ص ${AR(pg)}</small><em class="mqt">${esc(words3(s, a))}…</em></a>`).join("")}</div>`;
  }
  const JUZN = ["الم", "سيقول", "تلك الرسل", "لن تنالوا", "والمحصنات", "لا يحب الله", "وإذا سمعوا", "ولو أننا", "قال الملأ", "واعلموا", "يعتذرون", "وما من دابة", "وما أبرئ", "ربما", "سبحان", "قال ألم", "اقترب", "قد أفلح", "وقال الذين", "أمن خلق", "اتل ما أوحي", "ومن يقنت", "وما لي", "فمن أظلم", "إليه يرد", "حم", "قال فما خطبكم", "قد سمع", "تبارك", "عم"];
  async function index(q) {
    await load(); const qq = (q.q || "").trim();
    let res = "";
    if (qq) { const w = norm(qq).split(/\s+/).filter(Boolean), hits = []; Q.suras.forEach(s => s.ayat.forEach((t, i) => { const n = norm(t); if (hits.length < 200 && w.every(x => n.includes(x))) hits.push([s.n, i + 1]); }));
      res = `<p class="mut">${AR(hits.length)} آية${hits.length >= 200 ? " (أول ٢٠٠)" : ""}</p>` + hits.map(([s, a]) => `<a class="bk" href="#/mushaf/${s}?a=${a}"><p class="mqt">${esc(ayah(s, a))} ﴿${AR(a)}﴾</p><span>${esc(nm(s))} • الآية ${AR(a)}</span></a>`).join(""); }
    view(`<div class="cmhero"><div><h2>المصحف</h2><p>اقرأ السورة، واضغط رقم أي آية لترى مواضع تفسيرها، وما قاله مشايخ الدعوة فيها في كتبهم ومقالاتهم وفتاواهم، وانقل الآيات بتفسيرها أو تعليقك.</p></div></div>
    <form class="sbox" data-form="noop" id="musq"><input name="q" type="search" value="${esc(qq)}" placeholder="ابحث عن آية بكلماتها" aria-label="ابحث في الآيات"><button class="btn p">بحث</button></form>
    ${(() => { let l = 0; try { l = +localStorage.getItem("mus_last") || 0; } catch (e) { } return `<div class="row"><a class="btn p" href="#/mushaf/p/${l || 1}">📖 ${l ? "تابع القراءة من الصفحة " + AR(l) : "اقرأ بصفحات المصحف"}</a>${[1, 2, 5, 10, 20, 30].map(j => "").join("")}</div>`; })()}
    ${qq ? "" : `<div class="row mus-off"><button class="btn s" data-act="musoff" data-v="text">${offState("mushaf-text", "نص المصحف والمختصر والسراج")}</button><button class="btn s" data-act="musoff" data-v="pages">${offState("mushaf-pages", "صفحات المصحف بخطه")}</button></div>`}
    <div id="musres">${res}</div>${qq ? "" : ixHtml()}`);
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
  // التلاوة: مقاطع الآيات من everyayah.com بصوت القارئ المختار، وتظليل الآية المتلوّة، والانتقال إلى الصفحة التالية
  const RECS = [["Alafasy_128kbps", "مشاري العفاسي"], ["Husary_128kbps", "محمود خليل الحصري"], ["Minshawy_Murattal_128kbps", "محمد صديق المنشاوي"], ["Abdul_Basit_Murattal_192kbps", "عبد الباسط عبد الصمد"]];
  const rec = () => { try { return localStorage.getItem("mus_rec") || RECS[0][0]; } catch (e) { return RECS[0][0]; } };
  const aurl = (s, a) => `https://everyayah.com/data/${rec()}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
  let AU = null, PLAY = null;
  function stopAu() { if (AU) { AU.pause(); AU = null; } PLAY = null; document.querySelectorAll(".may.play").forEach(x => x.classList.remove("play")); const b = $("#mplay"); if (b) b.textContent = "▶ تلاوة"; }
  function playList(L, i, onEnd) { if (!L[i]) { stopAu(); if (onEnd) onEnd(); return; } const [s, a] = L[i]; document.querySelectorAll(".may.play").forEach(x => x.classList.remove("play"));
    const el = document.getElementById("ay" + s + "_" + a) || document.getElementById("ay" + a); if (el) { el.classList.add("play"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    document.querySelectorAll(".qg.play").forEach(x => x.classList.remove("play")); document.querySelectorAll(`.qg[data-k="${s}:${a}"]`).forEach(x => x.classList.add("play"));
    AU = new Audio(aurl(s, a)); PLAY = { L, i, onEnd }; AU.onended = () => PLAY && playList(L, i + 1, onEnd); AU.onerror = () => { toast("تعذّر تشغيل التلاوة"); stopAu(); }; AU.play().catch(() => stopAu()); }
  // عرض «خط المصحف»: صفحات مصحف المدينة ١٤٤١هـ بخطوط QCF4 (مجمع الملك فهد، تُحمَّل من jsDelivr) وبيانات أسطرها (data/quran/qcf)
  const QCFV = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.1.0/fonts-woff2/", FONTS = {};
  // تحميل خط الصفحة مع إعادة المحاولة؛ لا يُحفظ الفشل حتى لا تتعطل الصفحات بعد انقطاع عابر
  const QERR = [];
  // مصدران لحزمة الخطوط نفسها (quran-qcf4@1.1.0): jsDelivr ثم unpkg إن رفض الأول
  const QCFS = [QCFV, "https://unpkg.com/quran-qcf4@1.1.0/fonts-woff2/"];
  const qurl = (f, i) => `${QCFS[i || 0]}${f}${/QBSML/.test(f) ? "" : "_W"}.woff2`;
  // طريقة ثانية (لبعض متصفحات iPhone): قاعدة @font-face ثم طلب تحميلها
  const qcss = f => { if (!document.getElementById("qf_" + f)) { const st = document.createElement("style"); st.id = "qf_" + f; st.textContent = `@font-face{font-family:"${f}";src:url("${qurl(f, 0)}") format("woff2"),url("${qurl(f, 1)}") format("woff2");font-display:block}`; document.head.appendChild(st); }
    return document.fonts.load(`20px "${f}"`, "ﭑ").then(L => L.length > 0 || document.fonts.check(`20px "${f}"`)).catch(e => { QERR.push(f + ": " + (e && e.message || e)); return false; }); };
  const qload = (f, n) => new FontFace(f, `url(${qurl(f, 0)}) format("woff2"), url(${qurl(f, 1)}) format("woff2")`).load().then(x => { document.fonts.add(x); return true; })
    .catch(e => { QERR.push(f + ": " + (e && (e.message || e.name) || e)); return n > 0 ? new Promise(r => setTimeout(r, 700)).then(() => qload(f, n - 1)) : qcss(f); });
  const qfont = f => FONTS[f] || (FONTS[f] = qload(f, 2).then(ok => { if (!ok) delete FONTS[f]; return ok; }));
  const qmode = () => { try { return localStorage.getItem("mus_mode2") || "qcf"; } catch (e) { return "qcf"; } };  // mus_mode2: يبدأ الجميع بخط المصحف
  function fit() { const box = $(".qpage"); if (!box) return; const W = box.clientWidth - 4, lines = [...box.querySelectorAll(".ql:not(.qc)")]; if (!lines.length) return;
    box.style.fontSize = "20px"; let mx = 0; lines.forEach(l => { let w = 0; for (const c of l.children) w += c.getBoundingClientRect().width; mx = Math.max(mx, w); });
    const fs = Math.min(46, Math.max(11, 20 * W * 0.97 / Math.max(1, mx))); box.style.fontSize = fs.toFixed(2) + "px"; }
  async function qcfPage(n) {
    const D = await fetch("data/quran/qcf/" + n + ".json").then(r => r.ok ? r.json() : null).catch(() => null); if (!D) return null;
    const fonts = new Set([D.f]); D.l.forEach(l => l.forEach(w => { const x = w.find(v => typeof v === "string" && v.startsWith("@")); if (x) fonts.add(x.slice(1)); }));
    const ok = await Promise.all([...fonts].map(qfont)); if (ok.some(x => !x)) return null;
    const centered = n <= 2, html = D.l.map(l => { const t0 = l[0] && l[0][0], cls = t0 === "h" ? " qh" : t0 === "b" ? " qb" : ""; const c = centered || cls ? " qc" : "";
      return `<div class="ql${cls}${c}">${l.map(w => { const f = (w.find(v => typeof v === "string" && v.startsWith("@")) || "@" + D.f).slice(1), k = w[2] || "", [s_, a_] = k.split(":");
        if (w[0] === "w") return `<span class="qg" style="font-family:'${f}'" data-act="musw" data-s="${s_}" data-a="${a_}" data-k="${k}" data-t="${esc(w[3] || "")}">${w[1]}</span>`;
        if (w[0] === "e") return `<span class="qg qe" style="font-family:'${f}'" data-act="musay" data-s="${s_}" data-a="${a_}" data-k="${k}" title="الآية ${a_}">${w[1]}</span>`;
        return `<span class="qg" style="font-family:'${f}'">${w[1]}</span>`; }).join("")}</div>`; }).join("");
    return `<div class="qpage" dir="rtl">${html}</div>`;
  }
  async function mpage(n) {
    await load(); if (!PG) return sura(1, {});
    n = Math.max(1, Math.min(604, +n || 1)); const L = PG[n] || [], m0 = META[L[0][0]][L[0][1] - 1], suras = [...new Set(L.map(x => x[0]))];
    try { localStorage.setItem("mus_last", n); } catch (e) { }
    let body = "";
    L.forEach(([s, a]) => { if (a === 1) body += `<div class="msban"><span>${esc(Q.suras[s - 1].name)}</span></div>${s !== 1 && s !== 9 ? `<p class="mbasm">${BASMT}</p>` : ""}`;
      const sj = META[s][a - 1][3]; body += `<span class="may" id="ay${s}_${a}">${words(ayah(s, a), s, a)} <button class="mno" data-act="musay" data-s="${s}" data-a="${a}" aria-label="الآية ${a}">${AR(a)}</button>${sj ? '<span class="msj" title="موضع سجدة">۩</span>' : ""}</span> `; });
    const Q4 = qmode() === "qcf" ? await qcfPage(n) : null;
    view(`<div class="mnav"><a class="btn s" href="#/mushaf">☰ الفهرس</a><button class="btn s" data-act="musmode">${Q4 ? "Aa نص عادي" : "📖 خط المصحف"}</button><a class="btn s" href="#/mushaf/${suras[0]}">${esc(nm(suras[0]))} (سورة كاملة)</a><button class="btn s p" id="mplay" data-act="musplay" data-n="${n}">▶ تلاوة</button><select id="mrec" aria-label="القارئ">${RECS.map(([k, t]) => `<option value="${k}"${k === rec() ? " selected" : ""}>${t}</option>`).join("")}</select><form id="mpj" data-form="noop" class="row" style="gap:4px"><input name="p" type="number" min="1" max="604" value="${n}" style="width:6em" aria-label="رقم الصفحة"><button class="btn s">انتقل</button></form></div>
    <div class="mpage mp"><div class="mph"><span>${suras.map(s => esc(nm(s))).join(" • ")}</span><span>الجزء ${AR(m0[1])} • الحزب ${AR(Math.ceil(m0[2] / 4))}</span></div>
    ${!Q4 && qmode() === "qcf" ? `<p class="note mqerr">تعذّر تحميل خط المصحف على هذا الجهاز الآن، فعُرض النص العثماني. <button class="btn s p" data-act="musretry">إعادة المحاولة</button>${QERR.length ? `<small class="mut" dir="ltr">${esc(QERR.slice(-2).join(" | ").slice(0, 160))}</small>` : ""}</p>` : ""}
    ${Q4 || `<div class="qtext">${body}</div>`}<div class="mpf"><span>${AR(n)}</span></div></div>
    <div class="mnav mnb">${n > 1 ? `<a class="btn" href="#/mushaf/p/${n - 1}" rel="prev">الصفحة ${AR(n - 1)} ›</a>` : "<span></span>"}${n < 604 ? `<a class="btn" href="#/mushaf/p/${n + 1}" rel="next">‹ الصفحة ${AR(n + 1)}</a>` : "<span></span>"}</div>`);  /* كاتجاه المصحف: السابقة يمينًا والتالية يسارًا */
    $("#mpj").addEventListener("submit", e => { e.preventDefault(); location.hash = "#/mushaf/p/" + e.target.p.value; });
    if (Q4) { fit(); window.onresize = fit; }
    $("#mrec").onchange = e => { try { localStorage.setItem("mus_rec", e.target.value); } catch (x) { } };
    if (window.__musAuto === n) { window.__musAuto = 0; setTimeout(() => $("#mplay") && $("#mplay").click(), 400); }
    let x0 = null; const pg = $(".mpage"); pg.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    pg.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 70) location.hash = "#/mushaf/p/" + Math.max(1, Math.min(604, n + (dx > 0 ? 1 : -1))); x0 = null; }, { passive: true });
    bar();
  }
  // الكلمة: غريبها (السراج إن توفر، ثم المعاجم) وتفسير آيتها من «المختصر»
  // كتب الغريب المرتبة على الجذور (tools/gharib.py): جذر الكلمة من المدونة القرآنية ثم مدخله في «المفردات» و«عمدة الحفاظ»
  const JC = {}, jget = u => JC[u] || (JC[u] = fetch(u).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  const nkJ = x => { x = String(x || "").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱءؤئ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0627-\u064A]/g, ""); return x.length > 3 ? x.replace(/^ال(?=..)/, "") : x; };
  const skJ = x => nkJ(x).replace(/[اوي]/g, "");
  async function rootOf(w, s, a) { const L = (await jget(`data/quran/roots/${s}.json`))[a] || [], me = nkJ(w), ms = skJ(w);
    const x = L.find(y => y[0] === me) || L.find(y => skJ(y[0]) === ms) || L.find(y => y[1] && ms.length > 1 && (skJ(y[0]).includes(ms) || ms.includes(skJ(y[0])))); return x && x[1] || ""; }
  const rVar = r => { const k = nkJ(r), c = [k]; if (k.length === 3 && k[1] === k[2]) c.push(k.slice(0, 2)); if (/[اوي]$/.test(k)) for (const v of "اوي") c.push(k.slice(0, -1) + v);
    if (k.length === 3 && /[اوي]/.test(k[1])) for (const v of "اوي") c.push(k[0] + v + k[2]); return [...new Set(c)]; };
  async function lexOf(b, r) { for (const v of rVar(r)) { const d = await jget(`data/quran/lex/${b}/${v.charCodeAt(0).toString(16).padStart(4, "0")}.json`); if (d[v]) return [v].concat(d[v]); } return null; }
  async function lexBox(id, b, r) { const el = $("#" + id); if (!el) return; const e = r && await lexOf(b, r);
    el.innerHTML = e ? `<p class="lexr">${esc(e[3].length > 900 ? e[3].slice(0, 900) + "…" : e[3]).replace(/\n/g, "<br>")}</p><a class="chip" href="#/book/${esc(e[1])}/${e[2]}" data-act="closeSheet">مادة «${esc(e[0])}» في الكتاب كاملة</a>` : (r ? `لا مادة «${esc(r)}» فيه.` : "لا جذر لهذه الكلمة (حرف أو اسم علم)."); }
  async function wsheet(w, s, a) {
    const clean = strip(w).replace(/[^\u0621-\u064A]/g, "");
    openSheet("«" + w + "»", `<p class="mqt">${esc(ayah(s, a))} ﴿${AR(a)}﴾</p><h4>المختصر في التفسير <small class="mut">(مركز تفسير)</small></h4><div id="mwm" class="mut">…</div>
     <h4>غريب الكلمة <small class="mut">(السراج في بيان غريب القرآن)</small></h4><div id="mwg" class="mut">…</div>
     <h4>المفردات في غريب القرآن <small class="mut">(الراغب الأصفهاني)</small> <span id="mwrt" class="mut"></span></h4><div id="mwr" class="mut">…</div>
     <div id="mwuh"></div><div class="row" style="margin-top:8px"><button class="btn s p" data-act="muswlex" data-w="${esc(clean)}" data-s="${s}" data-a="${a}">المعاجم وكتب الشريعة</button><button class="btn s" data-act="musay" data-s="${s}" data-a="${a}">الآية: التفاسير وما قيل فيها</button></div>`);
    Promise.all([rootOf(w, s, a), jget("data/quran/lex/_meta.json")]).then(([r, M]) => { const t = $("#mwrt"); if (t && r) t.textContent = "• الجذر: " + r; lexBox("mwr", "mufradat", r);
      if ((M.umdathuffaz || {}).n) { const h = $("#mwuh"); if (h) { h.innerHTML = '<h4>عمدة الحفاظ في تفسير أشرف الألفاظ <small class="mut">(السمين الحلبي)</small></h4><div id="mwu" class="mut">…</div>'; lexBox("mwu", "umdathuffaz", r); } } });
    mukh(s).then(t => { const el = $("#mwm"); if (el) el.innerHTML = t[a] ? esc(t[a]) : "غير متاح."; });
    const g = await tf("siraj", s), el = $("#mwg"); if (!el) return;
    const L = (g && g[a]) || [], me = sk(clean).replace(/^(ف|ب|ل|ك)(?=...)/, ""), hit = Array.isArray(L) ? L.filter(([w2]) => { const x = sk(w2); return me.length >= 2 && (x.includes(me) || me.includes(x)); }) : [];
    el.innerHTML = L.length ? `${(hit.length ? hit : L).map(([w2, m]) => `<p><b>﴿${esc(w2)}﴾</b>: ${esc(m)}</p>`).join("")}${hit.length ? "" : '<p class="mut">غريب هذه الآية في «السراج» (لم تُفرد الكلمة المختارة).</p>'}<p class="mut" style="font-size:.8rem">«السراج في بيان غريب القرآن» للدكتور محمد بن عبد العزيز الخضيري</p>`
      : 'لا غريب لهذه الكلمة في «السراج»؛ اضغط «المعاجم وكتب الشريعة».';
  }
  async function showTf(k, s, a) { const t = await tf(k, s), el = $("#musmk"); if (!el) return; el.textContent = sjTxt(t[a]) || (k === "siraj" ? "لا غريب في هذه الآية في «السراج»، أو لم يُستخرج بعد." : "غير متاح لهذه الآية بعد.");
    document.querySelectorAll("#mustk .chip").forEach(c => c.classList.toggle("on", c.dataset.k === k)); }
  async function sheet(s, a) {
    const k = s + ":" + a, t = ayah(s, a), inSel = SEL().includes(k);
    openSheet(`${nmP(s)}: ${AR(a)}`, `<p class="mqt big">${esc(t)} ﴿${AR(a)}﴾</p>
    <div class="row"><button class="btn s" data-act="musone" data-s="${s}" data-a="${a}">▶ استمع</button><button class="btn s${inSel ? "" : " p"}" data-act="musadd" data-k="${k}">${inSel ? "✓ في التصدير (إزالة)" : "＋ أضفها إلى التصدير"}</button><button class="btn s" data-act="muscopy" data-k="${k}">نسخ</button>${t.split(/\s+/).length >= 3 && typeof tafsirSheet === "function" ? `<button class="btn s" data-act="mustaf" data-k="${k}">اقرأ التفسير هنا</button>` : ""}</div>
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
     <fieldset><legend>المحتوى</legend><label class="inl"><input type="radio" name="c" value="a" checked> الآيات وحدها</label><br><label class="inl"><input type="radio" name="c" value="ac"> الآيات مع موجزات من كتب الدعوة (أول موضعين)</label><br><label>مع التفسير</label><select name="tf"><option value="">بلا تفسير</option>${TFS.filter(t => t[0] !== "siraj").map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select><label class="inl"><input type="checkbox" name="g"> مع غريب الكلمات (السراج)</label><br><label class="inl"><input type="checkbox" name="n" checked> مع تعليقي تحت كل آية</label><br><label class="inl"><input type="checkbox" name="r" checked> مع العزو [السورة: رقم]</label></fieldset>
     <div class="row"><div><label>الصيغة</label><select name="f"><option value="txt">نص</option><option value="doc">Word</option><option value="png">صورة</option></select></div><div><label>الخط</label><select name="ff"><option value="Amiri Quran">أميري قرآن</option><option value="Amiri">أميري</option><option value="Traditional Arabic">Traditional Arabic</option><option value="IBM Plex Sans Arabic">بلكس</option></select></div><div><label>الحجم</label><input type="number" name="fs" value="22" min="12" max="48"></div></div>
     <button class="btn p">تصدير</button></form>`, () => { $("#musx").addEventListener("submit", e => { e.preventDefault(); run(e.target); }); });
  }
  async function run(f) {
    const l = SEL().map(k => k.split(":").map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]), withC = f.c.value === "ac", notes = NOTE(), M = withC ? await meta() : {};
    const blocks = [];
    for (const [s, a] of l) { const C = withC ? await cites(s) : {}, cs = withC ? (C[a] || []).filter(x => M[x[0]] && x[2]).slice(0, 2).map(x => ({ t: x[2], src: M[x[0]][0] + (A(M[x[0]][1]).name ? "، " + A(M[x[0]][1]).name : "") })) : [];
      const T = f.tf.value ? await tf(f.tf.value, s) : {}, Gr = f.g.checked ? await tf("siraj", s) : {}, tx = (T[a] || "").replace(/^[\s\S]*\[التفسير\]\s*/, "").trim();
      blocks.push({ t: ayah(s, a), ref: `[${nmP(s)}: ${AR(a)}]`, cs, tf: tx, g: sjTxt(Gr[a]), n: f.n.checked ? notes[s + ":" + a] || "" : "" }); }
    const TFN = f.tf.value ? (TFS.find(t => t[0] === f.tf.value) || [, ""])[1] : "";
    const ref = f.r.checked, F = f.f.value, ff = f.ff.value, fs = +f.fs.value || 22;
    if (F === "txt") return dl("آيات.txt", blocks.map(b => `﴿${b.t}﴾${ref ? " " + b.ref : ""}` + (b.g ? "\nالغريب:\n" + b.g : "") + (b.tf ? `\n${TFN}: ${b.tf}` : "") + b.cs.map(c => `\n— ${c.t}… (${c.src})`).join("") + (b.n ? "\nتعليقي: " + b.n : "")).join("\n\n") + "\n\n" + SITENAME, "text/plain");
    if (F === "doc") return dl("آيات.doc", `<html><head><meta charset="utf-8"><style>body{direction:rtl;font-family:'${ff}',serif;font-size:${fs}pt}.a{text-align:center;line-height:2}.r{font-size:${Math.round(fs * .6)}pt;color:#777}.c{font-family:'Traditional Arabic',serif;font-size:${Math.round(fs * .65)}pt;color:#333;border-right:3pt solid #b88a2e;padding-right:8pt}.n{font-size:${Math.round(fs * .65)}pt;color:#0f5c4d}.t{font-family:'Traditional Arabic',serif;font-size:${Math.round(fs * .65)}pt;text-align:justify}.g{font-size:${Math.round(fs * .62)}pt;color:#6b4e16}</style></head><body dir="rtl">${blocks.map(b => `<p class="a">﴿${esc(b.t)}﴾ ${ref ? `<span class="r">${esc(b.ref)}</span>` : ""}</p>${b.g ? `<p class="g">${esc(b.g).replace(/\n/g, "<br>")}</p>` : ""}${b.tf ? `<p class="t"><b>${esc(TFN)}:</b> ${esc(b.tf).replace(/\n+/g, "<br>")}</p>` : ""}${b.cs.map(c => `<p class="c">${esc(c.t)}… <i>(${esc(c.src)})</i></p>`).join("")}${b.n ? `<p class="n">تعليقي: ${esc(b.n)}</p>` : ""}`).join("<hr>")}<p class="r">${esc(SITENAME)}</p></body></html>`, "application/msword");
    // صورة: لوحة بهوية المكتبة
    try { await document.fonts.load(`${fs}px "${ff}"`); } catch (e) { }
    const W = 1080, P = 70, cv = document.createElement("canvas"), x = cv.getContext("2d"), lines = [];
    const wrap = (t, font, max) => { x.font = font; const ws = t.split(/\s+/), out = []; let ln = ""; ws.forEach(w => { const tt = ln ? ln + " " + w : w; if (x.measureText(tt).width > max && ln) { out.push(ln); ln = w; } else ln = tt; }); if (ln) out.push(ln); return out; };
    const AF = `${fs * 1.6}px "${ff}"`, CF = `${fs}px "Amiri"`, RF = `${fs * .9}px "Amiri"`;
    blocks.forEach((b, i) => { if (i) lines.push(["sep"]); wrap(`﴿${b.t}﴾`, AF, W - 2 * P).forEach(t => lines.push(["a", t])); if (ref) lines.push(["r", b.ref]); if (b.g) b.g.split("\n").forEach(gl => wrap(gl, CF, W - 2 * P).forEach(t => lines.push(["g", t]))); if (b.tf) wrap(TFN + ": " + b.tf.replace(/\n+/g, " "), CF, W - 2 * P).forEach(t => lines.push(["t", t])); b.cs.forEach(c => wrap(c.t + "… (" + c.src + ")", CF, W - 2 * P - 20).forEach(t => lines.push(["c", t]))); if (b.n) wrap("تعليقي: " + b.n, CF, W - 2 * P).forEach(t => lines.push(["n", t])); });
    const lh = { a: fs * 2.6, r: fs * 1.6, c: fs * 1.7, n: fs * 1.7, g: fs * 1.7, t: fs * 1.7, sep: fs * 1.4 }; cv.width = W; cv.height = Math.min(16000, P * 2 + 60 + lines.reduce((h, l) => h + lh[l[0]], 0));
    x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, cv.height); x.strokeStyle = "#b88a2e"; x.lineWidth = 4; x.strokeRect(24, 24, W - 48, cv.height - 48);
    x.direction = "rtl"; let y = P + 20;
    lines.forEach(([k, t]) => { y += lh[k]; if (k === "sep") { x.strokeStyle = "rgba(184,138,46,.4)"; x.lineWidth = 1; x.beginPath(); x.moveTo(W * .3, y - lh.sep / 2); x.lineTo(W * .7, y - lh.sep / 2); x.stroke(); return; }
      x.textAlign = k === "a" || k === "r" ? "center" : "right"; x.font = k === "a" ? AF : k === "r" ? RF : CF; x.fillStyle = k === "a" ? "#14231f" : k === "n" ? "#0f5c4d" : k === "g" ? "#6b4e16" : k === "r" ? "#8a7a5a" : "#333"; x.fillText(t, k === "a" || k === "r" ? W / 2 : W - P - 10, y); });
    x.textAlign = "center"; x.font = `18px "Amiri"`; x.fillStyle = "#8a7a5a"; x.fillText(SITENAME, W / 2, cv.height - 40);
    cv.toBlob(bl => dl("آيات.png", bl, "image/png"), "image/png");
  }
  // حفظ المصحف دون إنترنت: النص والتفسير المختصر وغريب السراج، أو صفحات مصحف المدينة بخطوطها (الخطوط مشتركة بين الصفحات)
  const offText = () => ["data/quran/quran.json", "data/quran/uthmani.json", "data/quran/meta.json", "data/quran/quran-tash.json"].concat(...Array.from({ length: 114 }, (_, i) => ["mokhtasar", "siraj"].map(k => `data/quran/tafsir/${k}/${i + 1}.json`)));
  async function offPages(say) { const pages = Array.from({ length: 604 }, (_, i) => `data/quran/qcf/${i + 1}.json`), fonts = new Set(); let i = 0;
    const q = pages.slice(); await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const u = q.shift(); try { const D = await fetch(u).then(r => r.json()); fonts.add(D.f); D.l.forEach(l => l.forEach(w => { const x = w.find(v => typeof v === "string" && v.startsWith("@")); if (x) fonts.add(x.slice(1)); })); } catch (e) { } say("جارٍ تجهيز الصفحات… " + AR(Math.round(100 * ++i / 604)) + "٪"); } }));
    return [...fonts].map(f => qurl(f, 0)).concat(["data/quran/quran.json", "data/quran/uthmani.json", "data/quran/meta.json"]); }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "musoff") { const t = el.dataset.v === "text"; return offSave(t ? "mushaf-text" : "mushaf-pages", t ? offText() : offPages, el, t ? "نص المصحف والمختصر والسراج" : "صفحات المصحف بخطه"); }
    if (a === "musplay") { if (PLAY) return stopAu(); const n = +el.dataset.n; el.textContent = "⏸ إيقاف"; playList(PG[n] || [], 0, () => { if (n < 604) { window.__musAuto = n + 1; location.hash = "#/mushaf/p/" + (n + 1); } }); }
    else if (a === "musone") { stopAu(); AU = new Audio(aurl(+el.dataset.s, +el.dataset.a)); AU.play().catch(() => toast("تعذّر تشغيل التلاوة")); }
    else if (a === "musay") sheet(+el.dataset.s, +el.dataset.a);
    else if (a === "musix" || a === "musixc") { const o = ixo(); o[el.dataset.k] = a === "musixc" ? (el.checked ? 1 : 0) : el.dataset.v; ixs(o); const r = $("#musres"); if (r) { const box = document.createElement("div"); box.innerHTML = ixHtml(); [...document.querySelectorAll(".mixc, .msuras")].forEach(x => x.remove()); r.after(...box.children); } }
    else if (a === "musretry") { Object.keys(FONTS).forEach(k => delete FONTS[k]); QERR.length = 0; const m = location.hash.match(/p\/(\d+)/); if (m) mpage(+m[1]); }
    else if (a === "musw") wsheet(el.dataset.t || el.textContent, +el.dataset.s, +el.dataset.a);
    else if (a === "musmode") { try { localStorage.setItem("mus_mode2", qmode() === "qcf" ? "text" : "qcf"); } catch (x) { } const m = location.hash.match(/p\/(\d+)/); if (m) mpage(+m[1]); }
    else if (a === "mustk") { try { localStorage.setItem("mus_tf", el.dataset.k); } catch (x) { } showTf(el.dataset.k, +el.dataset.s, +el.dataset.a); }
    else if (a === "muswlex") { closeSheet(); setTimeout(() => typeof wordSheet === "function" && wordSheet(el.dataset.w, ayah(+el.dataset.s, +el.dataset.a), "lug"), 150); }
    else if (a === "musadd") { const l = SEL(), k = el.dataset.k, i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else l.push(k); setSel(l); const sp = $("#ay" + k.split(":")[1]); if (sp) sp.classList.toggle("sel", i < 0); el.textContent = i >= 0 ? "＋ أضفها إلى التصدير" : "✓ في التصدير (إزالة)"; }
    else if (a === "muscopy") { const [s, n] = el.dataset.k.split(":").map(Number); navigator.clipboard && navigator.clipboard.writeText(`﴿${ayah(s, n)}﴾ [${nmP(s)}: ${n}]`).then(() => toast("نُسخت")); }
    else if (a === "mustaf") { const [s, n] = el.dataset.k.split(":").map(Number); closeSheet(); setTimeout(() => tafsirSheet(Q.suras[s - 1].ayat[n - 1]), 150); }
    else if (a === "musexp") exportDlg(); else if (a === "musclr") { if (confirm("مسح الآيات المختارة؟")) { setSel([]); document.querySelectorAll(".may.sel").forEach(x => x.classList.remove("sel")); } } });
  window.addEventListener("hashchange", () => { setTimeout(bar, 50); if (PLAY && !window.__musAuto) stopAu(); else if (AU && window.__musAuto) { AU.pause(); AU = null; PLAY = null; } });
  return { view: (q, s, n) => s === "p" ? mpage(n) : s ? sura(s, q) : index(q) };
})();
