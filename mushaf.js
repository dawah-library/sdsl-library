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
  const RECS = [["Alafasy_128kbps", "مشاري العفاسي"], ["Husary_128kbps", "محمود خليل الحصري"], ["Husary_Muallim_128kbps", "الحصري — المصحف المعلّم"], ["Minshawy_Murattal_128kbps", "محمد صديق المنشاوي"], ["Abdul_Basit_Murattal_192kbps", "عبد الباسط عبد الصمد"]];
  const rec = () => { try { return localStorage.getItem("mus_rec") || RECS[0][0]; } catch (e) { return RECS[0][0]; } };
  const aurl = (s, a) => `https://everyayah.com/data/${rec()}/${String(s).padStart(3, "0")}${String(a).padStart(3, "0")}.mp3`;
  let AU = null, PLAY = null;
  // إعدادات التلاوة: تكرار الآية، وتكرار المقطع (الصفحة أو السورة)، والنطاق، والسرعة، والاستماع بالضغط على الآية
  const PO = () => { try { return Object.assign({ rep: 1, loop: 1, scope: "page", speed: 1, tap: 0 }, JSON.parse(localStorage.getItem("mus_play") || "{}")); } catch (e) { return { rep: 1, loop: 1, scope: "page", speed: 1, tap: 0 }; } };
  const POs = o => { try { localStorage.setItem("mus_play", JSON.stringify(o)); } catch (e) { } };
  const curPage = () => { try { const p = parse().p; return p[0] === "mushaf" && p[1] === "p" ? +p[2] || 0 : 0; } catch (e) { return 0; } };
  const suraList = s => Array.from({ length: (META[s] || []).length }, (_, i) => [s, i + 1]);
  function playerHtml() { const o = PO(), sel = (k, L) => `<select data-mpo="${k}">${L.map(([v, t]) => `<option value="${v}"${String(o[k]) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    return `<details class="mplayer"><summary>🎧 إعدادات التلاوة</summary><div class="row">
      <label>النطاق ${sel("scope", [["page", "الصفحة"], ["sura", "السورة كاملة"], ["ayah", "آية واحدة"]])}</label>
      <label>تكرار الآية ${sel("rep", [[1, "مرة"], [2, "مرتان"], [3, "٣ مرات"], [5, "٥ مرات"], [7, "٧ مرات"], [10, "١٠ مرات"]])}</label>
      <label>تكرار المقطع ${sel("loop", [[1, "مرة"], [2, "مرتان"], [3, "٣ مرات"], [5, "٥ مرات"], [0, "بلا توقف"]])}</label>
      <label>السرعة ${sel("speed", [[0.6, "٠٫٦×"], [0.75, "٠٫٧٥×"], [0.9, "٠٫٩×"], [1, "عادية"], [1.15, "١٫١٥×"], [1.25, "١٫٢٥×"], [1.5, "١٫٥×"]])}</label>
      <label class="inl"><input type="checkbox" data-mpo="tap"${o.tap ? " checked" : ""}> الاستماع إلى الآية بالضغط عليها</label></div></details>`; }
  function stopAu() { if (AU) { AU.pause(); AU = null; } PLAY = null; document.querySelectorAll(".may.play").forEach(x => x.classList.remove("play")); const b = $("#mplay"); if (b) b.textContent = "▶ تلاوة"; }
  function playList(L, i, onEnd, r, loop) { const o = PO(); r = r || 0; loop = loop || 1;
    if (!L[i]) { if (!+o.loop || loop < +o.loop) return playList(L, 0, onEnd, 0, loop + 1); stopAu(); if (onEnd) onEnd(); return; }
    const [s, a] = L[i];
    // تلاوة السورة عبر الصفحات: إن كانت الآية في صفحة أخرى انتقل إليها وأكمل منها
    const pn = pageOf(s, a), cp = curPage(); if (cp && pn && pn !== cp) { window.__musCont = { L, i, onEnd, loop, n: pn }; location.hash = "#/mushaf/p/" + pn; return; }
    document.querySelectorAll(".may.play").forEach(x => x.classList.remove("play"));
    const el = document.getElementById("ay" + s + "_" + a) || document.getElementById("ay" + a); if (el) { el.classList.add("play"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    document.querySelectorAll(".qg.play").forEach(x => x.classList.remove("play")); document.querySelectorAll(`.qg[data-k="${s}:${a}"]`).forEach(x => x.classList.add("play"));
    AU = new Audio(aurl(s, a)); AU.playbackRate = +o.speed || 1; PLAY = { L, i, onEnd };
    AU.onended = () => PLAY && (r + 1 < (+o.rep || 1) ? playList(L, i, onEnd, r + 1, loop) : playList(L, i + 1, onEnd, 0, loop));
    AU.onerror = () => { toast("تعذّر تشغيل التلاوة"); stopAu(); }; AU.play().catch(() => stopAu()); const b = $("#mplay"); if (b) b.textContent = "⏸ إيقاف"; }
  const scopeList = (n, s, a) => { const o = PO(); return o.scope === "sura" ? suraList(s || (PG[n] || [[1]])[0][0]).filter(x => !a || x[1] >= a) : o.scope === "ayah" && s ? [[s, a]] : (PG[n] || []).filter(x => !a || x[0] !== s || x[1] >= a); };
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
    view(`<div class="mnav"><a class="btn s" href="#/mushaf">☰ الفهرس</a><button class="btn s" data-act="musmode">${Q4 ? "Aa نص عادي" : "📖 خط المصحف"}</button><a class="btn s" href="#/mushaf/${suras[0]}">${esc(nm(suras[0]))} (سورة كاملة)</a><button class="btn s p" id="mplay" data-act="musplay" data-n="${n}">▶ تلاوة</button><button class="btn s" data-act="musfull" title="ملء الشاشة لقراءة صفحات المصحف">⛶ تكبير</button><select id="mrec" aria-label="القارئ">${RECS.map(([k, t]) => `<option value="${k}"${k === rec() ? " selected" : ""}>${t}</option>`).join("")}</select><form id="mpj" data-form="noop" class="row" style="gap:4px"><input name="p" type="number" min="1" max="604" value="${n}" style="width:6em" aria-label="رقم الصفحة"><button class="btn s">انتقل</button></form></div>${playerHtml()}
    <div class="mfbar"><button data-act="musfull" aria-label="خروج من ملء الشاشة">✕</button><button data-act="muszoom" data-d="-1" aria-label="تصغير">－</button><button data-act="muszoom" data-d="1" aria-label="تكبير">＋</button>${n > 1 ? `<a href="#/mushaf/p/${n - 1}" aria-label="الصفحة السابقة">›</a>` : ""}<span>${AR(n)}</span>${n < 604 ? `<a href="#/mushaf/p/${n + 1}" aria-label="الصفحة التالية">‹</a>` : ""}<button data-act="musplay" data-n="${n}" aria-label="تلاوة">▶</button></div>
    <div class="mpage mp"><div class="mph"><span>${suras.map(s => esc(nm(s))).join(" • ")}</span><span>الجزء ${AR(m0[1])} • الحزب ${AR(Math.ceil(m0[2] / 4))}</span></div>
    ${!Q4 && qmode() === "qcf" ? `<p class="note mqerr">تعذّر تحميل خط المصحف على هذا الجهاز الآن، فعُرض النص العثماني. <button class="btn s p" data-act="musretry">إعادة المحاولة</button>${QERR.length ? `<small class="mut" dir="ltr">${esc(QERR.slice(-2).join(" | ").slice(0, 160))}</small>` : ""}</p>` : ""}
    ${Q4 || `<div class="qtext">${body}</div>`}<div class="mpf"><span>${AR(n)}</span></div></div>
    <div class="mnav mnb">${n > 1 ? `<a class="btn" href="#/mushaf/p/${n - 1}" rel="prev">الصفحة ${AR(n - 1)} ›</a>` : "<span></span>"}${n < 604 ? `<a class="btn" href="#/mushaf/p/${n + 1}" rel="next">‹ الصفحة ${AR(n + 1)}</a>` : "<span></span>"}</div>`);  /* كاتجاه المصحف: السابقة يمينًا والتالية يسارًا */
    $("#mpj").addEventListener("submit", e => { e.preventDefault(); location.hash = "#/mushaf/p/" + e.target.p.value; });
    if (Q4) { fit(); window.onresize = fit; }
    $("#mrec").onchange = e => { try { localStorage.setItem("mus_rec", e.target.value); } catch (x) { } };
    if (window.__musAuto === n) { window.__musAuto = 0; setTimeout(() => $("#mplay") && $("#mplay").click(), 400); }
    if (window.__musCont && window.__musCont.n === n) { const c = window.__musCont; window.__musCont = null; setTimeout(() => playList(c.L, c.i, c.onEnd, 0, c.loop), 300); }
    applyFull();
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
  // غريب الآية (أو الآيات) من «السراج»: الكلمة ومعناها، لكل قسم يعرض آية (المصحف، والقارئ، والمجلة، والعربية لغير الناطقين…)
  async function gharib(s, a, to) { const g = (await tf("siraj", s)) || {}, out = []; for (let k = a; k <= Math.max(a, to || a); k++) (Array.isArray(g[k]) ? g[k] : []).forEach(([w, m]) => w && m && out.push([w, m, k])); return out; }
  async function gharibHtml(s, a, to) { let L = []; try { L = await gharib(s, a, to); } catch (e) { }
    return L.length ? `<dl class="qgr">${L.map(([w, m, k]) => `<dt>﴿${esc(w)}﴾${to > a ? ` <small class="mut">(${AR(k)})</small>` : ""}</dt><dd>${esc(m)}</dd>`).join("")}</dl>` : "لا كلمات غريبة في هذه الآية في «السراج»."; }
  async function showTf(k, s, a) { const t = await tf(k, s), el = $("#musmk"); if (!el) return; el.textContent = sjTxt(t[a]) || (k === "siraj" ? "لا غريب في هذه الآية في «السراج»، أو لم يُستخرج بعد." : "غير متاح لهذه الآية بعد.");
    document.querySelectorAll("#mustk .chip").forEach(c => c.classList.toggle("on", c.dataset.k === k)); }
  async function sheet(s, a) {
    const k = s + ":" + a, t = ayah(s, a), inSel = SEL().includes(k);
    const inMus = /^#\/mushaf/.test(location.hash), until = +(sheet.to || 0) > a ? +sheet.to : 0; sheet.to = 0;
    openSheet(`${nmP(s)}: ${AR(a)}${until ? "–" + AR(until) : ""}`, `<p class="mqt big">${words(t, s, a)} ﴿${AR(a)}﴾${until ? Array.from({ length: Math.min(until, Q.suras[s - 1].ayat.length) - a }, (_, i) => " " + words(ayah(s, a + i + 1), s, a + i + 1) + ` ﴿${AR(a + i + 1)}﴾`).join("") : ""}</p>
    <p class="mut" style="font-size:.82rem;margin-top:-4px">اضغط أي كلمة لمعناها وغريبها في كتب الغريب والمعاجم.</p>
    <div class="row">${inMus ? "" : `<a class="btn s p" href="#/mushaf/${s}?a=${a}" data-act="closeSheet">📖 موضعها في المصحف</a>`}<button class="btn s" data-act="musone" data-s="${s}" data-a="${a}">▶ استمع</button><button class="btn s${inSel ? "" : " p"}" data-act="musadd" data-k="${k}">${inSel ? "✓ في التصدير (إزالة)" : "＋ أضفها إلى التصدير"}</button><button class="btn s" data-act="muscopy" data-k="${k}">نسخ</button>${t.split(/\s+/).length >= 3 && typeof tafsirSheet === "function" ? `<button class="btn s" data-act="mustaf" data-k="${k}">اقرأ التفسير هنا</button>` : ""}</div>
    <h4>غريب الآية <small class="mut">(السراج في بيان غريب القرآن)</small></h4><div id="musgr" class="mut">…</div>
    <div class="chips" id="mustk">${TFS.map(([k, n]) => `<button class="chip${k === tfk() ? " on" : ""}" data-act="mustk" data-k="${k}" data-s="${s}" data-a="${a}">${n}</button>`).join("")}</div><div id="musmk" class="mut tfbox">…</div>
    <h4>مواضع تفسيرها في التفاسير</h4><div id="mustf" class="mut">…</div>
    <h4>ما قيل فيها في كتب الدعوة ومقالاتها</h4><div id="musct" class="mut">جارٍ التحميل…</div>
    <h4>تعليقي على الآية <small class="mut">(خاص بك على هذا الجهاز)</small></h4><textarea id="musn" rows="3" maxlength="2000" style="width:100%" placeholder="فائدة أو تدبر…">${esc(NOTE()[k] || "")}</textarea>`, () => {
      $("#musn").addEventListener("input", e => { setNote(k, e.target.value.trim()); const b = document.querySelector(`#ay${a} .mno`); if (b) b.classList.toggle("hasn", !!e.target.value.trim()); });
    });
    showTf(tfk(), s, a);
    gharibHtml(s, a, until).then(h => { const el = $("#musgr"); if (el) el.innerHTML = h; });
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
    if (a === "musplay") { if (PLAY) return stopAu(); const n = +el.dataset.n, sc = PO().scope; el.textContent = "⏸ إيقاف";
      playList(scopeList(n), 0, sc === "page" ? () => { if (n < 604) { window.__musAuto = n + 1; location.hash = "#/mushaf/p/" + (n + 1); } } : null); }
    else if (a === "musone") { stopAu(); playList([[+el.dataset.s, +el.dataset.a]], 0); }
    else if (a === "musfull") { const on = !document.body.classList.contains("mfull"); try { localStorage.setItem("mus_full", on ? "1" : ""); } catch (x) { } applyFull(true); }
    else if (a === "muszoom") { const z = Math.max(1, Math.min(3, (+localStorage.getItem("mus_zoom") || 1) + 0.25 * +el.dataset.d)); try { localStorage.setItem("mus_zoom", z); } catch (x) { } applyFull(); }
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
  // ملء الشاشة: الصفحة وحدها بعرض الهاتف، مع تكبير وتصغير، ويبقى عند التنقل بين الصفحات حتى الخروج منه
  function applyFull(toggle) { let on = false; try { on = localStorage.getItem("mus_full") === "1"; } catch (e) { } const inPage = !!curPage();
    document.body.classList.toggle("mfull", on && inPage); document.body.style.setProperty("--mz", (+localStorage.getItem("mus_zoom") || 1));
    if (toggle) { try { if (on && inPage && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => { }); } catch (e) { } }
    setTimeout(fit, 30); }
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("mfull")) { try { localStorage.setItem("mus_full", ""); } catch (e) { } applyFull(); } });
  document.addEventListener("change", e => { const t = e.target.closest("[data-mpo]"); if (!t) return; const o = PO(); o[t.dataset.mpo] = t.type === "checkbox" ? (t.checked ? 1 : 0) : t.value; POs(o); if (AU && t.dataset.mpo === "speed") AU.playbackRate = +o.speed || 1; });
  // الاستماع بالضغط على الآية (عند تفعيله): يتلو الآية بإعدادات التكرار والسرعة بدل فتح بطاقة الكلمة
  document.addEventListener("click", e => { if (!PO().tap || !curPage()) return; const g = e.target.closest(".qg[data-k], .may"); if (!g || e.target.closest(".mno")) return;
    let s, a; if (g.dataset.k) [s, a] = g.dataset.k.split(":").map(Number); else { const m = (g.id || "").match(/ay(\d+)_(\d+)/); if (!m) return; s = +m[1]; a = +m[2]; }
    if (!s || !a) return; e.preventDefault(); e.stopImmediatePropagation(); stopAu(); const o = PO(); playList(o.scope === "ayah" ? [[s, a]] : scopeList(curPage(), s, a), 0); }, true);
  window.addEventListener("hashchange", () => { setTimeout(bar, 50); if (!curPage()) document.body.classList.remove("mfull"); if (PLAY && !window.__musAuto && !window.__musCont) stopAu(); else if (AU && window.__musAuto) { AU.pause(); AU = null; PLAY = null; } });
  // نافذة الآية من أي صفحة (ربط عزو الآيات في الكتب: QREF أدناه)
  async function ref(s, a, to) { try { await load(); } catch (e) { location.hash = "#/mushaf/" + s + "?a=" + a; return; } if (!Q.suras[s - 1] || !Q.suras[s - 1].ayat[a - 1]) return; sheet.to = to || 0; sheet(s, a); }
  return { view: (q, s, n) => s === "p" ? mpage(n) : s ? sura(s, q) : index(q), ref, gharib, gharibHtml };
})();

/* ربط الآيات في كل الكتب والمقالات بالمصحف (طلب المدير، ٧ نوفمبر): كل عزو بصيغة [السورة: رقم] أو (السورة: الآية رقم)
   أو [سورة السورة، الآية رقم] في نص القارئ أو حواشيه يصير رابطًا؛ بالضغط تُفتح نافذة الآية (نصها، ومعاني كلماتها بالضغط على الكلمة،
   والتفاسير، وما قيل فيها في كتب الدعوة) وزر «موضعها في المصحف» (#/mushaf/<سورة>?a=<آية>). يعمل على كل ما يُعرض داخل .rd دون تغيير النص المحفوظ. */
const QREF = (() => {
  const N = ["الفاتحه","البقره","ال عمران","النساء","المائده","الانعام","الاعراف","الانفال","التوبه","يونس","هود","يوسف","الرعد","ابراهيم","الحجر","النحل","الاسراء","الكهف","مريم","طه","الانبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجده","الاحزاب","سبا","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشوري","الزخرف","الدخان","الجاثيه","الاحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعه","الحديد","المجادله","الحشر","الممتحنه","الصف","الجمعه","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقه","المعارج","نوح","الجن","المزمل","المدثر","القيامه","الانسان","المرسلات","النبا","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الاعلي","الغاشيه","الفجر","البلد","الشمس","الليل","الضحي","الشرح","التين","العلق","القدر","البينه","الزلزله","العاديات","القارعه","التكاثر","العصر","الهمزه","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الاخلاص","الفلق","الناس"];
  const N_ = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];
  const C = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
  const nz = x => String(x || "").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
  const M = {}; N.forEach((n, i) => { M[n] = i + 1; M[n.replace(/^ال/, "")] = M[n.replace(/^ال/, "")] || i + 1; });
  Object.entries({ "بني اسرائيل": 17, "المؤمن": 40, "حم السجده": 41, "براءه": 9, "الدهر": 76, "هل اتي": 76, "تبارك": 67, "عم": 78, "عم يتساءلون": 78, "تبت": 111, "اللهب": 111, "الم نشرح": 94, "الانشراح": 94, "اقرا": 96, "قل هو الله احد": 112, "التوحيد": 112, "المعوذتين": 113, "سبح": 87, "الملائكه": 35, "الاحقاف": 46, "ن": 68, "ياسين": 36, "النساء الصغري": 65 }).forEach(([k, v]) => M[k] = M[k] || v);
  const D = "[0-9٠-٩۰-۹]{1,3}", W = "(?:الآيات|الآية|الايات|الاية|آية|اية|آيه|ايه)";
  const RX = new RegExp(`[\\[(]\\s*(?:سورة\\s+|سوره\\s+)?([\\u0621-\\u064A\\u064B-\\u0652\\u0670\\u0671 ]{1,22}?)\\s*(?::|،|,)\\s*(?:من\\s+)?${W}?\\s*(?:رقم\\s*)?(${D})(?:\\s*[-–،,]\\s*(${D}))?\\s*[\\])]`, "g");
  // صيغة الحواشي بلا أقواس: «سورة البقرة: الآية ١٩٠» و«سورة النساء، الآية ٥٩»
  const RX2 = new RegExp(`سورة\\s+([\\u0621-\\u064A\\u064B-\\u0652\\u0670\\u0671 ]{1,22}?)\\s*[،,:]?\\s*(?:من\\s+)?${W}\\s*(?:رقم\\s*)?(${D})(?:\\s*[-–،,]\\s*(${D}))?`, "g");
  const num = x => +String(x).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const sura = n => { const k = nz(n).replace(/^سوره\s+/, "").replace(/(\s+(الايه|الايات|ايه|رقم|من))+$/, "").trim(); return M[k] || M[k.replace(/^ال/, "")] || 0; };
  const SKIP = "A,BUTTON,TEXTAREA,INPUT,SELECT,SCRIPT,STYLE,CODE";
  const AREA = ".rd,.qscan,.majtext,.sumtx,.kurtext,.tjwrap";  // حيث يُربط عزو الآيات بنافذتها (التفسير وغريب السراج)
  const ok = el => el && el.closest(AREA) && !el.closest(SKIP + ",[contenteditable=true],.qref");
  // الكلمات في القارئ يلف كلًّا منها عنصر span.w، فالعزو يمتد على عناصر متجاورة: تُجمع نصوص أبناء الحاوية ثم يُلف ما يغطيه العزو برابط
  // (تبقى عناصر الكلمات كما هي داخل الرابط فلا تتأثر التعليقات والتظليل)
  function linkIn(E) {
    if (!ok(E) || E.classList.contains("w")) return;
    const ch = [...E.childNodes], off = []; let str = "";
    ch.forEach(n => { off.push(str.length); str += n.nodeType === 3 ? n.nodeValue : n.nodeType === 1 ? n.textContent : ""; });
    if (str.length < 6 || !/[:،,]/.test(str)) return;
    const hits = []; let m; RX.lastIndex = 0; RX2.lastIndex = 0;
    const ms = []; while ((m = RX.exec(str))) ms.push(m); while ((m = RX2.exec(str))) { const x = m; if (!ms.some(y => x.index < y.index + y[0].length && y.index < x.index + x[0].length)) ms.push(x); }
    for (m of ms) { const s_ = sura(m[1]), a = num(m[2]), b = m[3] ? num(m[3]) : 0; if ((s_ === 38 || s_ === 50) && !/[﴾})»]\s*$/.test(str.slice(Math.max(0, m.index - 6), m.index))) continue;  // «ص: ٨٣» كثيرًا ما تكون رقم صفحة
      if (s_ && a && a <= C[s_ - 1] && !(b && (b < a || b > C[s_ - 1]))) hits.push([m.index, m.index + m[0].length, s_, a, b]); }
    const at = p => { let i = 0; while (i + 1 < ch.length && off[i + 1] <= p) i++; return i; };
    hits.sort((x, y) => x[0] - y[0]);
    for (const [st, en, s_, a, b] of hits.reverse()) {
      let i = at(st), j = at(en - 1);
      const seg = ch.slice(i, j + 1); if (seg.some(n => n.nodeType === 1 && (n.matches(SKIP + ",.qref") || n.querySelector("a,button,.qref")))) continue;
      let first = ch[i], last = ch[j];
      if (last.nodeType === 3 && en - off[j] < last.nodeValue.length) last.splitText(en - off[j]);
      if (first.nodeType === 3 && st > off[i]) { first = first.splitText(st - off[i]); if (i === j) last = first; }
      const x = document.createElement("a"); x.className = "qref"; x.href = "#/mushaf/" + s_ + "?a=" + a; x.dataset.s = s_; x.dataset.a = a; if (b) x.dataset.b = b;
      x.title = "افتح الآية: تفسيرها ومعاني كلماتها وموضعها في المصحف";
      first.parentNode.insertBefore(x, first); let n = first; while (n) { const nx = n === last ? null : n.nextSibling; x.appendChild(n); n = nx; }
    }
  }
  // الآيات التي لا عزو لها في الكتاب: مواضعها من tools/qref-fix.py (الحقل qadd: [ترتيب الآية في الصفحة، آخر كلمة، سورة، آية، آخر آية])
  // يُعرض بعد الآية رابط صغير إلى المصحف دون تغيير نص الكتاب
  const VRX = /[﴿{]\s*([^{}﴿﴾]{4,1500}?)\s*[﴾}]/g, AD = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  // تعليم نص الآية رابطًا (كلماتها span.w أو نص مجرد يُلف بعنصر): بالضغط تُفتح نافذة الآية
  function markRange(tn, st, en, s_, a, b) {
    tn.forEach(([node, o]) => {
      const L = node.nodeValue.length; if (o + L <= st || o >= en || !node.parentNode) return;
      const p = node.parentElement; if (!p || p.closest("a,.qvl")) return;
      let el = p.classList.contains("w") || p.classList.contains("qv") ? p : null;
      if (!el) { let n = node; const x = Math.max(0, st - o), y = Math.min(L, en - o); if (y <= x) return; if (y < L) n.splitText(y); if (x > 0) n = n.splitText(x); el = document.createElement("span"); n.parentNode.insertBefore(el, n); el.appendChild(n); }
      el.classList.add("qvl"); el.dataset.s = s_; el.dataset.a = a; if (b) el.dataset.b = b; el.title = "اضغط للآية في المصحف: تفسيرها ومعاني كلماتها";
    });
  }
  function textMap(rd, withRef) {
    const tn = [], w = document.createTreeWalker(rd, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest(withRef ? ".fnb,.fns" : ".fnb,.fns,.qref") ? 2 : 1 });
    let str = ""; while (w.nextNode()) { tn.push([w.currentNode, str.length]); str += w.currentNode.nodeValue; } return [tn, str];
  }
  const DONE = new WeakMap();
  function addIn(rd) {
    if (!rd || !rd.dataset || !rd.dataset.id || typeof SH === "undefined" || DONE.get(rd) === rd.firstChild) return;  // يُعاد إن تغيّر محتوى الصفحة
    const sh = SH.get(rd.dataset.id), L = sh && sh.qadd && sh.qadd[String(+rd.dataset.p - 1)]; if (!sh) return; DONE.set(rd, rd.firstChild); if (!L || !L.length) return;
    const [tn, str] = textMap(rd);
    const vs = []; let m; VRX.lastIndex = 0; while ((m = VRX.exec(str))) { const lw = nz(m[1]).split(" "); vs.push({ st: m.index, end: m.index + m[0].length, lw: lw[lw.length - 1] }); }
    const used = new Set(), ins = [];
    L.forEach(([k, lw, s_, a, b, q]) => {
      let v = vs[k] && vs[k].lw === lw && !used.has(k) ? k : -1;
      if (v < 0) { let best = -1; vs.forEach((x, i) => { if (x.lw === lw && !used.has(i) && (best < 0 || Math.abs(i - k) < Math.abs(best - k))) best = i; }); v = best; }
      if (v < 0) return; used.add(v); ins.push([vs[v].st, vs[v].end, s_, a, b, q]);
    });
    const seen = new Set(); ins.sort((x, y) => x[0] - y[0]).forEach(x => { const k = x[2] + ":" + x[3]; if (seen.has(k)) x[5] = 1; seen.add(k); });  // عزو واحد للآية في الصفحة (التفاسير تكرر أجزاءها)
    ins.sort((x, y) => y[0] - x[0]).forEach(([st, pos, s_, a, b, q]) => {
      if (!q) {  // عزو صغير بعد الآية (أضافته المكتبة)
        let i = tn.length - 1; while (i > 0 && tn[i][1] >= pos) i--; const [node, o] = tn[i]; const at = pos - o;
        const x = document.createElement("a"); x.className = "qref qadd"; x.href = "#/mushaf/" + s_ + "?a=" + a; x.dataset.s = s_; x.dataset.a = a; if (b) x.dataset.b = b;
        x.title = "عزو الآية (أضافته المكتبة): تفسيرها ومعاني كلماتها وموضعها في المصحف"; x.textContent = "[" + N_[s_ - 1] + ": " + AD(a) + (b ? "-" + AD(b) : "") + "]";
        const host = node.parentElement && node.parentElement.classList.contains("w") && at >= node.nodeValue.length ? node.parentElement : null;
        if (host) host.after(x); else { const r = node.splitText(Math.min(at, node.nodeValue.length)); r.parentNode.insertBefore(x, r); }
      }
      markRange(tn, st, pos, s_, a, b);
    });
    DONE.set(rd, rd.firstChild);
  }
  // الآية المعزوّة في النص: يصير نصها رابطًا إلى الموضع نفسه الذي يشير إليه عزوها التالي لها
  function markCited(rd) {
    if (!rd || !rd.querySelector("a.qref:not(.qadd)")) return;
    const [tn, str] = textMap(rd, true), refs = [];
    tn.forEach(([n, o]) => { const r = n.parentElement && n.parentElement.closest("a.qref:not(.qadd)"); if (r && !refs.some(x => x[0] === r)) refs.push([r, o]); });
    let m; VRX.lastIndex = 0;
    while ((m = VRX.exec(str))) { const e = m.index + m[0].length, r = refs.find(([x, o]) => o >= e && o - e <= 45);
      if (r && !/[﴿{]/.test(str.slice(e, r[1]))) markRange(tn, m.index, e, r[0].dataset.s, r[0].dataset.a, r[0].dataset.b || 0); }
  }
  function scan(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 3)) return;
    if (root.nodeType === 1) { const rds = root.matches && root.matches(".rd[data-id]") ? [root] : [...(root.querySelectorAll ? root.querySelectorAll(".rd[data-id]") : [])]; const up = root.closest && root.closest(".rd[data-id]"); if (up) rds.push(up); rds.forEach(r => { try { addIn(r); } catch (e) { } }); setTimeout(() => rds.forEach(r => { try { markCited(r); } catch (e) { } }), 0); }
    if (root.nodeType === 3) return linkIn(root.parentElement);
    if (!(root.closest(AREA) || root.querySelector(AREA))) return;
    const E = new Set(), w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const p = w.currentNode.parentElement; if (!p) continue; E.add(p.classList.contains("w") || p.classList.contains("qv") ? p.parentElement : p); }
    E.forEach(e => { try { linkIn(e); } catch (x) { } });
  }
  let pend = new Set(), tm = 0;
  const run = () => { tm = 0; const l = [...pend]; pend = new Set(); l.forEach(n => { if (n.isConnected) try { scan(n); } catch (e) { } }); };
  new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains("qref")) return; pend.add(n); })); if (pend.size && !tm) tm = setTimeout(run, 60); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", e => { const v = e.target.closest(".rd .qvl"); if (!v || e.target.closest("a") || String(getSelection()).trim()) return; e.preventDefault(); e.stopPropagation();
    MUS.ref(+v.dataset.s, +v.dataset.a, +v.dataset.b || 0); }, true);
  document.addEventListener("click", e => { const el = e.target.closest("a.qref"); if (!el || e.ctrlKey || e.metaKey || e.button || String(getSelection()).trim()) return; e.preventDefault(); e.stopPropagation();
    MUS.ref(+el.dataset.s, +el.dataset.a, +el.dataset.b || 0); }, true);
  return { scan, sura };
})();