/* نظام الترجمة متعددة اللغات (TRX): قراءة الكتب والمقالات والفتاوى والبحوث والشروح بلغات عالمية.
   - قائمة «لغة القراءة» 🌐 في الرأس وفي القارئ؛ واللغات وإعداداتها من data/tr-config.json (يديرها المدير في #/translate).
   - الترجمة المنظَّمة (api/translate?f=2 ← lib/trcore.js): متن وحواشٍ منفصلة، والآيات والأحاديث بنصها العربي الأصلي
     يعاد من المصدر نفسه مع ترجمة معانيها، ومتن الشرح مميَّز عن الشرح، والمسرد الاصطلاحي لكل لغة.
   - الترجمات المحفوظة (data/tr/<اللغة>/<المعرّف>.json): مسبقة بالمهمة tr-books.yml أو مراجَعة بيد فريق الترجمة؛ تُقرأ أولًا.
   - عرض: تحت الأصل، أو بجانبه، أو الترجمة وحدها مع زر «النص العربي الأصلي» في كل وقت؛ وتنبيه «آلية / مراجَعة علميًّا».
   - الاتجاه والخط لكل لغة (الأوردية بالنستعليق من اليمين، والهندية والبنغالية بخطوطهما)، والتحميل HTML/Word/PDF/نص.
   - الصلاحيات: translate (مراجعة الترجمات وتعديلها واعتمادها)، translate_admin (اللغات والمسرد والطابور)، والمدير يملكهما. */
const TRX = (() => {
  let CFG = null, IDX = null;
  const MEM = new Map(), STORE = new Map(), FONTS = new Set();
  const FONT = {
    "noto-serif": ["Noto Serif", '"Noto Serif",Georgia,"Times New Roman",serif'],
    nastaliq: ["Noto Nastaliq Urdu", '"Noto Nastaliq Urdu","Jameel Noori Nastaleeq","Urdu Typesetting",serif'],
    naskh: ["Noto Naskh Arabic", '"Noto Naskh Arabic",Amiri,serif'],
    devanagari: ["Noto Sans Devanagari", '"Noto Sans Devanagari","Mangal",sans-serif'],
    bengali: ["Noto Sans Bengali", '"Noto Sans Bengali","Vrinda",sans-serif'],
    sc: ["Noto Sans SC", '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif']
  };
  const UI = { // عبارات قليلة بلغة الترجمة (والعربية لما سواها)
    en: { fn: "Footnotes", mean: "Meaning", hd: "Hadith", q: "Qur'an", orig: "Arabic original" },
    ur: { fn: "حواشی", mean: "ترجمہ", hd: "حدیث", q: "قرآن", orig: "عربی متن" },
    hi: { fn: "पाद-टिप्पणियाँ", mean: "अर्थ", hd: "हदीस", q: "क़ुरआन", orig: "मूल अरबी" },
    bn: { fn: "পাদটীকা", mean: "অর্থ", hd: "হাদীস", q: "কুরআন", orig: "মূল আরবি" }
  };
  const u = (l, k) => (UI[l] || UI.en)[k];
  const E = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);

  async function cfg() {
    if (CFG) return CFG;
    try { CFG = await (await fetch("data/tr-config.json", { cache: "no-cache" })).json(); } catch (e) { CFG = null; }
    if (!CFG || !Array.isArray(CFG.langs)) CFG = { langs: (typeof TRL !== "undefined" ? TRL : [["en", "English"]]).map(([k, n]) => ({ k, n, ar: n, dir: /^(ur|fa)$/.test(k) ? "rtl" : "ltr", on: true })), glossary: {}, notice: {} };
    return CFG;
  }
  const langs = () => ((CFG && CFG.langs) || []).filter(x => x.on !== false);
  const L = k => ((CFG && CFG.langs) || []).find(x => x.k === k) || { k, n: k, ar: k, dir: "ltr" };
  const fontCss = l => (FONT[L(l).font] || FONT["noto-serif"])[1];
  function loadFont(l) {
    const f = (FONT[L(l).font] || [])[0]; if (!f || FONTS.has(f)) return; FONTS.add(f);
    const k = document.createElement("link"); k.rel = "stylesheet"; k.href = "https://fonts.googleapis.com/css2?family=" + f.replace(/ /g, "+") + ":wght@400;700&display=swap"; document.head.appendChild(k);
  }
  const canTr = () => { try { return isAdmin() || can("translate") || can("translate_admin"); } catch (e) { return false; } };
  const canAdm = () => { try { return isAdmin() || can("translate_admin"); } catch (e) { return false; } };
  async function index() {
    if (IDX) return IDX;
    try { IDX = await (await fetch("data/tr/index.json", { cache: "no-cache" })).json(); } catch (e) { IDX = { l: {} }; }
    IDX.l = IDX.l || {}; return IDX;
  }
  // الملف المحفوظ للكتاب بهذه اللغة (إن وُجد في الفهرس)
  async function stored(l, id) {
    const k = l + "|" + id; if (STORE.has(k)) return STORE.get(k);
    const ix = await index(), e = (ix.l[l] || {})[id]; let st = null;
    if (e) try { const r = await fetch(`data/tr/${encodeURIComponent(l)}/${encodeURIComponent(id)}.json?n=${e[0]}.${e[1]}`); if (r.ok) st = await r.json(); } catch (x) { }
    STORE.set(k, st); return st;
  }
  // سجل ترجمة الصفحة: المحفوظ ← الدالة المنظَّمة ← الدالة القديمة (نص) ← MyMemory
  async function page(b, p, l, noFallback) {
    const key = b.id + "|" + p + "|" + l; if (MEM.has(key)) return MEM.get(key);
    let rec = null; const st = await stored(l, b.id);
    if (st && st.p && st.p[p]) rec = st.p[p];
    if (!rec) try { const r = await fetch(`/api/translate?id=${encodeURIComponent(b.id)}&p=${p}&l=${encodeURIComponent(l)}&v=${b.size || 0}&f=2`); if (r.ok) { rec = await r.json(); if (typeof rec.main !== "string") rec = null; } } catch (e) { }
    if (!rec && !noFallback) {
      let t = ""; try { const r = await fetch(`/api/translate?id=${encodeURIComponent(b.id)}&p=${p}&l=${encodeURIComponent(l)}&v=${b.size || 0}`); if (r.ok) t = (await r.json()).text || ""; } catch (e) { }
      if (!t && typeof mymemory === "function" && b.pages) try { t = await mymemory(strip(plain(b.pages[p - 1] || "")), l); } catch (e) { }
      if (t) rec = { main: t, fn: "", q: {}, h: {}, seg: {}, s: "m", e: "basic" };
    }
    if (rec) MEM.set(key, rec); return rec;
  }

  // ———— الإخراج ————
  function inline(s, rec, l) {
    return E(s).replace(/⟪([\s\S]*?)⟫/g, '<b class="trmt">$1</b>').replace(/⟦([QH]\d+)⟧/g, (m, k) => {
      const ar = (rec.seg || {})[k]; if (!ar) return "";
      const mean = ((k[0] === "Q" ? rec.q : rec.h) || {})[k] || "";
      return `<span class="trs ${k[0] === "Q" ? "trq" : "trhd"}"><span class="trar" lang="ar" dir="rtl">${E(ar)}</span>${mean ? `<span class="trmn"><i>${E(u(l, k[0] === "Q" ? "q" : "hd"))} — ${E(u(l, "mean"))}:</i> ${E(mean)}</span>` : ""}</span>`;
    });
  }
  function body(rec, l) {
    const lines = String(rec.main || "").split(/\n+/).filter(x => x.trim()).map(x => {
      const h2 = /^##\s/.test(x), h = /^#\s/.test(x) || h2; x = x.replace(/^#+\s*/, "");
      return h ? `<p class="trhd2${h2 ? " s" : ""}">${inline(x, rec, l)}</p>` : `<p>${inline(x, rec, l)}</p>`;
    }).join("");
    const miss = (rec.miss || []).map(k => `<p>${inline("⟦" + k + "⟧", rec, l)}</p>`).join("");
    const fn = String(rec.fn || "").trim() ? `<div class="trfn"><b>${E(u(l, "fn"))}</b>${rec.fn.split(/\n+/).filter(x => x.trim()).map(x => `<p>${inline(x, rec, l)}</p>`).join("")}</div>` : "";
    return lines + miss + fn;
  }
  function notice(rec, l) {
    const n = (CFG && CFG.notice) || {}, s = rec.s === "r" ? "r" : "m", m = n[s] || {};
    const tl = m[l] || m.en || "", ar = m.ar || (s === "r" ? "ترجمة مراجَعة علميًّا." : "ترجمة آلية غير مراجَعة.");
    return `<div class="trnote ${s}" role="note"><b>${s === "r" ? "✓ مراجَعة علميًّا" : "⚙ ترجمة آلية"}</b> ${E(ar)}${tl && l !== "ar" ? `<span dir="${L(l).dir}" lang="${E(l)}">${E(tl)}</span>` : ""}${s === "r" && rec.at ? ` <small>(${E(rec.at)})</small>` : ""}</div>`;
  }

  // ———— القارئ ————
  const MODES = [["below", "تحت الأصل"], ["side", "بجانبه"], ["only", "الترجمة وحدها"]];
  function applyMode() {
    const m = S.tr ? (S.trm || "below") : "";
    document.body.classList.toggle("trm-side", m === "side"); document.body.classList.toggle("trm-only", m === "only");
  }
  async function render(b, p) {
    await cfg(); applyMode();
    const box = $("#trv"), l = S.tr;
    if (!box) { const sc = $("#scr"); if (l && sc && !$("#trscn")) sc.insertAdjacentHTML("beforebegin", `<p class="note" id="trscn">🌐 الترجمة (${E(L(l).n)}) تظهر في وضع تقليب الصفحات؛ غيّر طريقة التصفح من «المظهر».</p>`); return; }
    if (!l) { box.hidden = true; return; }
    box.hidden = false; box.dataset.p = p; box.setAttribute("data-noi18n", ""); loadFont(l);
    const lg = L(l), head = `<div class="trh"><span>🌐 ${E(lg.n)}${lg.ar && lg.ar !== lg.n ? " — " + E(lg.ar) : ""}</span>
      <span class="seg trmodes" role="radiogroup" aria-label="طريقة عرض الترجمة">${MODES.map(([k, t]) => `<button type="button" role="radio" aria-checked="${(S.trm || "below") === k}" data-trx="mode" data-m="${k}">${t}</button>`).join("")}</span>
      <button class="btn s nf" data-trx="orig">النص العربي الأصلي</button><button class="btn s nf" data-act="tr">تغيير اللغة</button><button class="btn s nf" data-act="trset" data-l="">إيقاف</button></div>`;
    if (!String(b.pages[p - 1] || "").trim()) { box.innerHTML = head + '<p class="mut">صفحة بلا نص.</p>'; return; }
    if (!MEM.has(b.id + "|" + p + "|" + l)) box.innerHTML = head + '<p class="mut">جارٍ ترجمة الصفحة ترجمة تراعي السياق العلمي والشرعي…</p>';
    const rec = await page(b, p, l);
    const el = $("#trv"); if (!el || +el.dataset.p !== p || S.tr !== l) return;
    if (!rec) { el.innerHTML = head + `<p class="note">تعذرت الترجمة الآن. <a target="_blank" rel="noopener" href="https://translate.google.com/?sl=ar&tl=${encodeURIComponent(l)}&text=${encodeURIComponent(strip(plain(b.pages[p - 1])).slice(0, 1500))}">افتحها في مترجم جوجل</a></p>`; return; }
    el.innerHTML = head + notice(rec, l) + `<div class="trt" dir="${lg.dir || "ltr"}" lang="${E(l)}" style="font-family:${E(fontCss(l)).replace(/&quot;/g, "'")}">${body(rec, l)}</div>
      <div class="row trfoot"><button class="btn s nf" data-trx="report">⚑ أبلغ عن خطأ في الترجمة</button>${canTr() ? `<button class="btn s" data-trx="edit">✎ تعديل الترجمة واعتمادها</button>` : ""}<button class="btn s nf" data-trx="dl">⬇ تحميل الترجمة</button>${rec.e ? `<small class="mut">${E(rec.e === "basic" ? "ترجمة مبسطة" : "")}</small>` : ""}</div>`;
  }
  function dlg() {
    cfg().then(() => {
      const ls = langs(), core = ls.filter(x => x.core), rest = ls.filter(x => !x.core);
      const btn = x => `<button class="btn s${S.tr === x.k ? " p" : ""}" data-act="trset" data-l="${E(x.k)}" title="${E(x.ar || "")}"><span dir="${x.dir || "ltr"}">${E(x.n)}</span>${x.ar && x.ar !== x.n ? ` <small>${E(x.ar)}</small>` : ""}</button>`;
      openDlg(`<h3>🌐 لغة القراءة</h3><p class="mut">اختر لغة فتظهر ترجمة كل صفحة من الكتب والمقالات والفتاوى والبحوث وأنت تتنقل، ويمكنك تغييرها في أي وقت، والرجوع إلى النص العربي الأصلي متاح دائمًا.</p>
      <b>اللغات الأساسية</b><div class="row trls">${core.map(btn).join("")}</div>${rest.length ? `<b>لغات أخرى</b><div class="row trls">${rest.map(btn).join("")}</div>` : ""}
      <b>طريقة العرض</b><div class="row">${MODES.map(([k, t]) => `<button class="btn s${(S.trm || "below") === k ? " p" : ""}" data-trx="mode" data-m="${k}">${t}</button>`).join("")}</div>
      ${S.tr ? '<button class="btn s nf danger" data-act="trset" data-l="" style="margin-top:8px">إيقاف الترجمة (العربية فقط)</button>' : ""}
      <p class="note">الترجمة تراعي المصطلحات الشرعية وتحفظ الآيات والأحاديث بنصها العربي مع ترجمة معانيها. ما لم يُعلَّم «مراجَعة علميًّا» فهو ترجمة آلية لا يُعتمد عليها في الفتوى أو النقل. <a href="#/translate">الكتب المترجمة ونظام الترجمة</a></p>`);
    });
  }

  // ———— البلاغ والتعديل ————
  function report(b, p, l) {
    openDlg(`<h3>⚑ بلاغ عن خطأ في الترجمة</h3><p class="mut">${E(b.title)} — صفحة ${toAr(p)} — ${E(L(l).ar || L(l).n)}</p>
    <label>ما الخطأ؟ (مصطلح، معنى، سقط، تحريف…)</label><textarea id="trfm" rows="3" required></textarea>
    <label>الصواب المقترح (اختياري)</label><textarea id="trfs" rows="3" dir="auto"></textarea>
    <button class="btn p" id="trfgo" style="margin-top:8px">إرسال إلى فريق الترجمة</button> <span id="trfst" class="mut"></span>`);
    $("#trfgo").onclick = async () => {
      const st = $("#trfst"), msg = $("#trfm").value.trim(); if (msg.length < 3) { st.textContent = "اكتب وصف الخطأ"; return; }
      if (!Auth.user) { st.textContent = "سجّل الدخول لإرسال البلاغ"; return; }
      st.textContent = "جارٍ الإرسال…";
      try {
        const r = await fetch("/api/translate?op=fb", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + (Auth.token || "") }, body: JSON.stringify({ id: b.id, p, l, msg, sug: $("#trfs").value }) });
        const j = await r.json().catch(() => ({})); st.textContent = r.ok ? "✓ وصل البلاغ، جزاك الله خيرًا" : (j.message || "تعذّر الإرسال");
      } catch (e) { st.textContent = "تعذّر الإرسال"; }
    };
  }
  async function saveRec(b, p, l, rec, total) {
    await GH.editJSON(`data/tr/${l}/${b.id}.json`, st => { st = st || { id: b.id, l, p: {} }; st.p = st.p || {}; st.v = b.size || st.v || 0; st.p[p] = rec; return st; }, `ترجمة (${l}): ${b.title} ص ${p}${rec.s === "r" ? " — مراجَعة علميًّا" : ""}`, true);
    await GH.editJSON("data/tr/index.json", ix => {
      ix = ix || { v: 1, l: {} }; ix.l = ix.l || {}; ix.l[l] = ix.l[l] || {};
      const e = ix.l[l][b.id] || [0, 0, total]; const st = STORE.get(l + "|" + b.id), old = st && st.p && st.p[p];
      if (!old) e[0]++; if (rec.s === "r" && !(old && old.s === "r")) e[1]++; if (rec.s !== "r" && old && old.s === "r") e[1] = Math.max(0, e[1] - 1); e[2] = total;
      ix.l[l][b.id] = e; return ix;
    }, "فهرس الترجمات", true);
    const st = STORE.get(l + "|" + b.id) || { id: b.id, l, p: {} }; st.p[p] = rec; STORE.set(l + "|" + b.id, st); MEM.set(b.id + "|" + p + "|" + l, rec); IDX = null;
  }
  async function edit(b, p, l) {
    const rec = Object.assign({ main: "", fn: "", q: {}, h: {}, seg: {} }, await page(b, p, l, true) || {});
    const toks = Object.keys(rec.seg || {}), dir = L(l).dir || "ltr";
    openDlg(`<h3>✎ تعديل الترجمة واعتمادها</h3><p class="mut">${E(b.title)} — صفحة ${toAr(p)} — ${E(L(l).ar || L(l).n)}. الرموز ⟦Q1⟧ و⟦H1⟧ مواضع الآيات والأحاديث بنصها العربي الأصلي: أبقها في مكانها. و⟪ ⟫ يميّز متن الكتاب المشروح.</p>
    <details><summary>النص العربي الأصلي</summary><div class="rd trsrc">${pageHtml(b.pages[p - 1], "", [], b)}</div></details>
    <label>المتن</label><textarea id="tre-m" rows="10" dir="${dir}" lang="${E(l)}">${E(rec.main)}</textarea>
    <label>الحواشي</label><textarea id="tre-f" rows="4" dir="${dir}" lang="${E(l)}">${E(rec.fn)}</textarea>
    ${toks.map(k => `<label>${k[0] === "Q" ? "معنى الآية" : "ترجمة الحديث"} ${k}: <span class="trar" dir="rtl">${E(rec.seg[k])}</span></label><textarea data-tok="${k}" rows="2" dir="${dir}">${E(((k[0] === "Q" ? rec.q : rec.h) || {})[k] || "")}</textarea>`).join("")}
    <label class="inl"><input type="checkbox" id="tre-r"${rec.s === "r" ? " checked" : ""}> اعتمادها «مراجَعة علميًّا» (يظهر للقراء تنبيه المراجعة بدل الترجمة الآلية)</label>
    <div class="row" style="margin-top:8px"><button class="btn p" id="tre-go">حفظ</button>${rec.main ? "" : '<button class="btn s" id="tre-ai">ترجمة آلية أولًا</button>'}<span id="tre-st" class="mut"></span></div>`);
    if ($("#tre-ai")) $("#tre-ai").onclick = async () => { $("#tre-st").textContent = "جارٍ الترجمة…"; MEM.delete(b.id + "|" + p + "|" + l); const r = await page(b, p, l, true); if (r) { MEM.set(b.id + "|" + p + "|" + l, r); edit(b, p, l); } else $("#tre-st").textContent = "تعذّرت الترجمة الآلية الآن"; };
    $("#tre-go").onclick = async () => {
      const st = $("#tre-st"), main = $("#tre-m").value.trim(); if (!main) { st.textContent = "المتن فارغ"; return; }
      const lost = toks.filter(k => !(main + $("#tre-f").value).includes("⟦" + k + "⟧"));
      const out = { main, fn: $("#tre-f").value.trim(), q: {}, h: {}, seg: rec.seg || {}, s: $("#tre-r").checked ? "r" : "m", at: today(), e: rec.e === "human" || $("#tre-r").checked ? "human" : rec.e, by: (Cloud.role || "staff") };
      if (lost.length) out.miss = lost;
      $$("[data-tok]").forEach(x => { const k = x.dataset.tok; (k[0] === "Q" ? out.q : out.h)[k] = x.value.trim(); });
      st.textContent = "جارٍ الحفظ…";
      try { await saveRec(b, p, l, out, b.pages.length); st.textContent = "✓ حُفظت" + (lost.length ? " (تنبيه: حُذف موضع " + lost.join("، ") + " فيُعرض في آخر الصفحة)" : ""); setTimeout(() => { const d = typeof window.dlg === "function" ? window.dlg() : null; if (d && d.open) d.close(); render(b, p); }, 700); }
      catch (e) { st.textContent = "تعذّر: " + (e.message || e); }
    };
  }

  // ———— التحميل بتنسيق موافق لكل لغة ————
  function docHtml(b, l, recs, au) {
    const lg = L(l), f = fontCss(l), ff = (FONT[lg.font] || FONT["noto-serif"])[0];
    const rv = recs.filter(([, r]) => r && r.s === "r").length, n = recs.filter(([, r]) => r).length;
    const note = rv === n ? (((CFG.notice || {}).r || {})[l] || (CFG.notice || {}).r && CFG.notice.r.en || "") : (((CFG.notice || {}).m || {})[l] || ((CFG.notice || {}).m || {}).en || "");
    return `<!doctype html><html lang="${E(l)}" dir="${lg.dir || "ltr"}"><head><meta charset="utf-8"><title>${E(b.title)} (${E(lg.n)})</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${ff.replace(/ /g, "+")}:wght@400;700&family=Amiri:wght@400;700&display=swap">
<style>@page{size:A4;margin:20mm 18mm}body{font-family:${f};font-size:12.5pt;line-height:${lg.font === "nastaliq" ? 2.3 : 1.7};max-width:760px;margin:auto;padding:16px;color:#1b1b1b}
h1{font-size:20pt;margin:0 0 4px}h1+p{margin-top:0;color:#555}.ar{font-family:Amiri,"Traditional Arabic",serif;direction:rtl;unicode-bidi:isolate}
.note{border:1px solid #c9b98a;background:#faf6e8;padding:8px 10px;border-radius:6px;font-size:10.5pt}.pg{page-break-inside:auto;margin:18px 0;border-top:1px solid #ddd;padding-top:8px}
.pgn{font-size:9pt;color:#888}.trhd2{font-weight:700;font-size:14pt;margin:14px 0 6px}.trhd2.s{font-size:12.5pt}.trs{display:block;margin:8px 0;padding:6px 10px;border-${lg.dir === "rtl" ? "right" : "left"}:3px solid #2e7d5b;background:#f3f8f5}
.trhd{border-color:#8a6d1f;background:#fbf7ec}.trar{display:block;font-family:Amiri,serif;direction:rtl;text-align:right;font-size:14pt;line-height:2}.trmn{display:block}.trmt{color:#7a2e0e}
.trfn{font-size:10.5pt;border-top:1px solid #ccc;margin-top:10px;padding-top:4px;color:#333}</style></head><body>
<h1>${E(b.title)}</h1><p class="ar">${E(au)}</p><p>${E(lg.n)}${lg.ar ? " — " + E(lg.ar) : ""}</p><p class="note">${E(note)}<br><span class="ar">${E(((CFG.notice || {})[rv === n ? "r" : "m"] || {}).ar || "")}</span></p>
${recs.map(([p, r]) => `<div class="pg"><div class="pgn">— ${p} —</div>${r ? body(r, l) : '<p class="ar">[لم تُترجم بعد]</p>'}</div>`).join("")}
<p class="note">${E(typeof SITENAME !== "undefined" ? SITENAME : "")} ${E(typeof CFG_SITE !== "undefined" ? CFG_SITE : location.origin)}</p></body></html>`;
  }
  async function download(b, l) {
    l = l || S.tr || "en"; await cfg(); const st = await stored(l, b.id), have = st && st.p ? Object.keys(st.p).length : 0, n = b.pages ? b.pages.length : (b.n || 1), c = cur();
    openDlg(`<h3>⬇ تحميل الترجمة</h3><p class="mut">${E(b.title)} — المحفوظ مترجمًا: ${toAr(have)} من ${toAr(n)} صفحة. الصفحات غير المحفوظة تُترجم الآن (حتى ٤٠ صفحة في المرة).</p>
    <label>اللغة</label><select id="tdl-l">${langs().map(x => `<option value="${E(x.k)}"${x.k === l ? " selected" : ""}>${E(x.n)} — ${E(x.ar || "")}</option>`).join("")}</select>
    <div class="row"><div><label>من صفحة</label><input id="tdl-f" type="number" min="1" max="${n}" value="${have > 0 ? 1 : (c && c.b.id === b.id ? c.p : 1)}"></div><div><label>إلى صفحة</label><input id="tdl-t" type="number" min="1" max="${n}" value="${have > 0 ? n : Math.min(n, (c && c.b.id === b.id ? c.p : 1) + 9)}"></div></div>
    <label>الصيغة</label><select id="tdl-x"><option value="html">صفحة HTML</option><option value="doc">Word (DOC)</option><option value="pdf">PDF (طباعة)</option><option value="txt">نص TXT</option></select>
    <button class="btn p" id="tdl-go" style="margin-top:10px">تحميل</button> <span id="tdl-st" class="mut"></span>`);
    $("#tdl-go").onclick = async () => {
      const L2 = $("#tdl-l").value, f = Math.max(1, +$("#tdl-f").value || 1), t = Math.min(n, +$("#tdl-t").value || f), x = $("#tdl-x").value, s = $("#tdl-st"), B2 = await loadBook(b.id);
      if (t - f > 1500) { s.textContent = "الحد ١٥٠٠ صفحة في الملف"; return; }
      const recs = []; let live = 0;
      for (let p = f; p <= t; p++) {
        const sv = await stored(L2, b.id); let r = sv && sv.p && sv.p[p];
        if (!r && String(B2.pages[p - 1] || "").trim()) { if (live >= 40) { recs.push([p, null]); continue; } live++; s.textContent = `جارٍ ترجمة ص ${toAr(p)}…`; r = await page(B2, p, L2, true); }
        recs.push([p, r || null]);
      }
      const au = (typeof A === "function" ? A(b.authorId).name : "") || "", name = (b.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 70)) + " (" + L2 + ")";
      if (x === "txt") { await dl(name + ".txt", b.title + "\n" + au + "\n\n" + recs.map(([p, r]) => `— ${p} —\n` + (r ? (r.main + (r.fn ? "\n____\n" + r.fn : "")).replace(/⟦([QH]\d+)⟧/g, (m, k) => (r.seg[k] || "") + " [" + (((k[0] === "Q" ? r.q : r.h) || {})[k] || "") + "]").replace(/[⟪⟫]/g, "") : "")).join("\n\n"), "text/plain"); s.textContent = "✓"; return; }
      const h = docHtml(B2, L2, recs, au);
      if (x === "html") await dl(name + ".html", h, "text/html");
      else if (x === "doc") await dl(name + ".doc", h.replace("<html ", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" '), "application/msword");
      else { const w = window.open("", "_blank"); if (!w) { s.textContent = "اسمح بالنوافذ المنبثقة للطباعة"; return; } w.document.write(h.replace("</body>", "<script>onload=()=>setTimeout(()=>print(),600)<\/script></body>")); w.document.close(); }
      s.textContent = "✓" + (recs.some(([, r]) => !r) ? " (بعض الصفحات لم تُترجم بعد؛ أضف الكتاب إلى طابور الترجمة المسبقة)" : "");
    };
  }

  // ———— صفحة نظام الترجمة #/translate ————
  async function vw(q) {
    await cfg(); const ix = await index(), ls = langs(), sel = (q && q.l) || S.tr || "en";
    const rows = Object.entries(ix.l[sel] || {}).map(([id, e]) => [B(id), e]).filter(([b]) => b).sort((a, b) => b[1][1] - a[1][1] || b[1][0] - a[1][0]);
    const stat = ls.map(x => { const o = ix.l[x.k] || {}, v = Object.values(o); return `<a class="chip${x.k === sel ? " x" : ""}" href="#/translate?l=${encodeURIComponent(x.k)}"><span dir="${x.dir || "ltr"}">${E(x.n)}</span> <small>${toAr(v.length)} مادة • ${toAr(v.reduce((a, e) => a + e[0], 0))} ص • ${toAr(v.reduce((a, e) => a + e[1], 0))} مراجَعة</small></a>`; }).join("");
    view(`<h2>🌐 الترجمة متعددة اللغات</h2>
    <p class="mut">اقرأ كتب المكتبة ومقالاتها وفتاواها وبحوثها وشروحها بلغتك: اختر «لغة القراءة» ثم افتح أي مادة، فتظهر ترجمة كل صفحة مع إمكان الرجوع إلى النص العربي الأصلي. الآيات والأحاديث تبقى بنصها العربي مع ترجمة معانيها، والحواشي منفصلة عن المتن.</p>
    <div class="row"><button class="btn p" data-act="rlang">🌐 لغة القراءة: ${S.tr ? E(L(S.tr).n) : "العربية (بلا ترجمة)"}</button></div>
    <h3>المواد المترجمة والمحفوظة</h3><nav class="chips">${stat}</nav>
    <div class="trlist">${rows.length ? rows.slice(0, 300).map(([b, e]) => `<a class="bk" href="#/book/${b.id}/1" data-trl="${E(sel)}"><b>${E(b.title)}</b><span>${toAr(e[0])} من ${toAr(e[2] || b.n || e[0])} صفحة${e[1] ? ` • <em class="tag">${toAr(e[1])} مراجَعة علميًّا</em>` : ""}</span></a>`).join("") : '<p class="mut">لا مواد محفوظة بهذه اللغة بعد؛ تُترجم أي صفحة فوريًّا عند فتحها.</p>'}</div>
    ${canTr() ? '<h3>البلاغات والمراجعة</h3><div id="trfb" class="mut">جارٍ التحميل…</div>' : ""}
    ${canAdm() ? adminHtml() : ""}`);
    if (canTr()) fbList();
    if (canAdm()) wireAdmin();
  }
  async function fbList() {
    let o = { items: [] }; try { o = await (await fetch("data/tr/_feedback.json", { cache: "no-cache" })).json(); } catch (e) { }
    const it = (o.items || []).map((x, i) => [x, i]).filter(([x]) => x.st !== "done").reverse();
    $("#trfb").innerHTML = it.length ? it.slice(0, 100).map(([x, i]) => { const b = B(x.id); return `<div class="card trfbi"><b>${E(b ? b.title : x.id)}</b> — ص ${toAr(x.p)} — ${E(L(x.l).ar || x.l)} <small class="mut">${E(x.at)}</small><p>${E(x.msg)}</p>${x.sug ? `<p dir="auto"><i>المقترح:</i> ${E(x.sug)}</p>` : ""}<div class="row"><a class="btn s" href="#/book/${E(x.id)}/${x.p}" data-trl="${E(x.l)}">افتح الصفحة</a><button class="btn s" data-trx="fbdone" data-i="${i}">تمت المعالجة</button></div></div>`; }).join("") : '<p class="mut">لا بلاغات مفتوحة.</p>';
  }
  function adminHtml() {
    const g = CFG.glossary || {}, ls = CFG.langs || [];
    return `<h3>إدارة اللغات</h3><p class="mut">فعّل اللغات أو عطّلها، أو عدّلها، أو احذفها، أو أضف لغة جديدة (لا تُحذف الترجمات المحفوظة بحذف اللغة). امنح أعضاء الفريق صلاحية «مراجعة الترجمات» أو «إدارة الترجمة» من <a href="#/perms">صلاحيات التفويض</a>.</p>
    <div class="tblw"><table class="trlangs"><tr><td>الرمز</td><td>الاسم بلغته</td><td>بالعربية</td><td>اسمها للنموذج</td><td>الاتجاه</td><td>الخط</td><td>مفعّلة</td><td>أساسية</td><td></td></tr>
    ${ls.map((x, i) => `<tr data-li="${i}"><td dir="ltr">${E(x.k)}</td><td><input data-f="n" value="${E(x.n)}"></td><td><input data-f="ar" value="${E(x.ar || "")}"></td><td><input data-f="llm" dir="ltr" value="${E(x.llm || "")}"></td><td><select data-f="dir"><option${x.dir !== "rtl" ? " selected" : ""}>ltr</option><option${x.dir === "rtl" ? " selected" : ""}>rtl</option></select></td><td><select data-f="font">${Object.keys(FONT).map(k => `<option${(x.font || "noto-serif") === k ? " selected" : ""}>${k}</option>`).join("")}</select></td><td><input type="checkbox" data-f="on"${x.on !== false ? " checked" : ""}></td><td><input type="checkbox" data-f="core"${x.core ? " checked" : ""}></td><td><button class="btn s danger" data-trx="ldel" data-i="${i}">حذف</button></td></tr>`).join("")}</table></div>
    <form id="tradd" class="row" data-form="noop"><input name="k" dir="ltr" placeholder="الرمز (مثل ta أو so)" required pattern="[a-zA-Z-]{2,8}" style="width:9em"><input name="n" placeholder="اسمها بلغتها" required><input name="ar" placeholder="اسمها بالعربية" required><input name="llm" dir="ltr" placeholder="English name (Tamil)" required><select name="dir"><option>ltr</option><option>rtl</option></select><button class="btn s">إضافة لغة</button></form>
    <button class="btn p" data-trx="lsave">حفظ إعدادات اللغات</button> <span id="trlst" class="mut"></span>
    <h3>المسرد الاصطلاحي</h3><p class="mut">سطر لكل مصطلح: «المصطلح العربي = ترجمته». «*» مسرد عام لكل اللغات (نقحرة)، ومسرد اللغة يغلبه. يُلزم النموذج به فتتحسن الترجمة كلما رُوجع.</p>
    <select id="trgl">${["*"].concat(ls.map(x => x.k)).map(k => `<option value="${E(k)}">${k === "*" ? "عام (*)" : E(L(k).ar || k)}</option>`).join("")}</select>
    <textarea id="trgt" rows="10" dir="auto">${E(Object.entries(g["*"] || {}).map(([a, t]) => a + " = " + t).join("\n"))}</textarea>
    <button class="btn p" data-trx="gsave">حفظ المسرد</button> <span id="trgst" class="mut"></span>
    <h3>الترجمة المسبقة وحفظ الترجمات</h3><p class="mut">أضف كتابًا أو مقالًا فتترجمه المهمة الآلية كاملًا (٢٥٠ صفحة في الجولة) وتحفظه، فيُقرأ بلا انتظار ولا تكلفة متكررة، ويُتاح تحميله كاملًا. الصفحات المراجَعة لا تُمس.</p>
    <form id="trqf" data-form="noop"><input id="trqb" list="trqdl" placeholder="اكتب اسم الكتاب أو المقال أو معرّفه" autocomplete="off" style="width:100%"><datalist id="trqdl"></datalist>
    <div class="row">${(CFG.langs || []).filter(x => x.on !== false).map(x => `<label class="inl"><input type="checkbox" name="ql" value="${E(x.k)}"${((CFG.batch || {}).langs || []).includes(x.k) ? " checked" : ""}> ${E(x.ar || x.n)}</label>`).join("")}</div>
    <button class="btn p">أضف إلى الطابور</button> <span id="trqst" class="mut"></span></form><div id="trq" class="mut"></div>`;
  }
  async function saveCfg(fn, msg, stEl) {
    stEl.textContent = "جارٍ الحفظ…";
    try { await GH.editJSON("data/tr-config.json", o => { o = o || CFG; fn(o); return o; }, msg); CFG = null; await cfg(); stEl.textContent = "✓ حُفظت (تسري خلال دقائق)"; }
    catch (e) { stEl.textContent = "تعذّر: " + (e.message || e); }
  }
  async function wireAdmin() {
    const gl = $("#trgl"), gt = $("#trgt"); gl.onchange = () => { gt.value = Object.entries((CFG.glossary || {})[gl.value] || {}).map(([a, t]) => a + " = " + t).join("\n"); };
    $("#tradd").onsubmit = e => { e.preventDefault(); const f = new FormData(e.target), k = String(f.get("k")).trim(); if ((CFG.langs || []).some(x => x.k === k)) { toast("اللغة موجودة"); return; }
      saveCfg(o => { o.langs.push({ k, n: f.get("n"), ar: f.get("ar"), llm: f.get("llm"), dir: f.get("dir"), font: f.get("dir") === "rtl" ? "naskh" : "noto-serif", on: true }); }, "الترجمة: إضافة لغة " + k, $("#trlst")).then(() => vw({ l: k })); };
    const dl2 = $("#trqdl"), qb = $("#trqb"); qb.oninput = () => { const s = qb.value.trim(); if (s.length < 2) return; dl2.innerHTML = lib.books.filter(b => b.title.includes(s) || b.id === s).slice(0, 15).map(b => `<option value="${E(b.id)}">${E(b.title)}</option>`).join(""); };
    $("#trqf").onsubmit = async e => {
      e.preventDefault(); const st = $("#trqst"), b = B(qb.value.trim()), ls = $$('[name="ql"]:checked').map(x => x.value);
      if (!b) { st.textContent = "اختر مادة من القائمة"; return; } if (!ls.length) { st.textContent = "اختر لغة"; return; }
      const ids = b.set && b.vols ? lib.books.filter(x => x.set === b.set && x.id !== b.id).map(x => x.id).concat([b.id]) : [b.id];
      st.textContent = "جارٍ الإضافة…";
      try { await GH.editJSON("data/tr/_queue.json", o => { o = o || { v: 1, items: [] }; ids.forEach(id => { o.items = o.items.filter(x => x.id !== id || x.st === "done"); o.items.push({ id, l: ls, at: today(), st: "new" }); }); return o; }, "طابور الترجمة: " + b.title); st.textContent = "✓ أُضيف؛ تبدأ الترجمة خلال دقائق"; queue(); }
      catch (x) { st.textContent = "تعذّر: " + (x.message || x); }
    };
    queue();
  }
  async function queue() {
    let o = { items: [] }; try { o = await (await fetch("data/tr/_queue.json", { cache: "no-cache" })).json(); } catch (e) { }
    const ST = { new: "ينتظر", part: "جارٍ", done: "منجز", missing: "النص غير موجود" };
    const el = $("#trq"); if (el) el.innerHTML = (o.items || []).slice(-40).reverse().map(x => { const b = B(x.id); return `<div>• ${E(b ? b.title : x.id)} — ${E([].concat(x.l).map(k => L(k).ar || k).join("، "))} — <b>${ST[x.st] || x.st}</b> <small>${E(x.upd || x.at || "")}</small></div>`; }).join("") || "الطابور فارغ.";
  }

  // ———— الأحداث ————
  document.addEventListener("click", async e => {
    const a = e.target.closest("[data-trx],[data-act=rlang],[data-trl]"); if (!a) return;
    if (a.dataset.trl) { if (S.tr !== a.dataset.trl) { S.tr = a.dataset.trl; saveS(); } return; }
    if (a.dataset.act === "rlang") { e.preventDefault(); dlg(); return; }
    const k = a.dataset.trx, c = cur();
    if (k === "mode") { S.trm = a.dataset.m; saveS(); applyMode(); $$('[data-trx="mode"]').forEach(x => { const on = x.dataset.m === S.trm; x.setAttribute("aria-checked", on); x.classList.toggle("p", on && x.classList.contains("btn")); }); return; }
    if (k === "orig") { document.body.classList.toggle("tr-showar"); a.classList.toggle("p"); const rb = $("#rb"); if (rb && document.body.classList.contains("tr-showar")) rb.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (k === "report" && c) return report(c.b, c.p, S.tr);
    if (k === "edit" && c) return edit(c.b, c.p, S.tr);
    if (k === "dl" && c) return download(c.b, S.tr);
    if (k === "ldel") { const x = CFG.langs[+a.dataset.i]; if (!x || !confirm("حذف لغة «" + (x.ar || x.n) + "» من القائمة؟ (تبقى ترجماتها المحفوظة)")) return; return saveCfg(o => { o.langs = o.langs.filter(y => y.k !== x.k); }, "الترجمة: حذف لغة " + x.k, $("#trlst")).then(() => vw({})); }
    if (k === "lsave") { const rows = $$(".trlangs tr[data-li]"); return saveCfg(o => { rows.forEach(r => { const x = o.langs.find(y => y.k === CFG.langs[+r.dataset.li].k); if (!x) return; r.querySelectorAll("[data-f]").forEach(f => { x[f.dataset.f] = f.type === "checkbox" ? f.checked : f.value.trim(); }); if (!x.core) delete x.core; }); }, "الترجمة: إعدادات اللغات", $("#trlst")); }
    if (k === "gsave") { const g = $("#trgl").value, m = {}; $("#trgt").value.split("\n").forEach(s => { const i = s.indexOf("="); if (i > 0) { const ar = s.slice(0, i).trim(), t = s.slice(i + 1).trim(); if (ar && t) m[ar] = t; } }); return saveCfg(o => { o.glossary = o.glossary || {}; o.glossary[g] = m; }, "الترجمة: المسرد (" + g + ")", $("#trgst")); }
    if (k === "fbdone") { a.disabled = true; try { await GH.editJSON("data/tr/_feedback.json", o => { const x = (o.items || [])[+a.dataset.i]; if (x) { x.st = "done"; x.done = today(); } return o; }, "بلاغات الترجمة: معالجة"); a.closest(".trfbi").remove(); } catch (x) { a.disabled = false; toast("تعذّر: " + (x.message || x)); } }
  });
  cfg().then(applyMode);
  return { cfg, render, dlg, view: vw, download, page, langs, L };
})();
