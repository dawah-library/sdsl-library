/* قوالب الطباعة (طلب المدير، ٢٧ نوفمبر — البند ١٨ من وثيقة الطلبات غير المنفذة).
   - كراسات من أقسامها: «ورقة اختبار» فارغة للطباعة (اسم وتاريخ، ودوائر الاختيار، ومربعات صح/خطأ، وسطور «أكمل»، ومفتاح الإجابة في صفحة مستقلة)،
     و«ورقة مراجعة» (السؤال وجوابه وتعليله وصفحته من الكتاب) — من صفحة اختبار الكتاب (#/quizzes/<كتاب>) بالأسئلة المعروضة نفسها.
   - التصدير بمقاس الطباعة (A4، A5، B5، نصف A4 للطي) لصفحات المجلة والطلائع والموسوعات: نسخة نظيفة من محتوى الصفحة بترويسة المكتبة وتذييلها.
   - الأزرار تُضاف إلى تلك الصفحات من هنا دون تعديل ملفات أقسامها (majalla.js، tala.js، mawsua.js، learn.js)، فلا تتعارض مع تطويرها. */
const PRT = (() => {
  const SIZES = [["A4", "A4"], ["A5", "A5 (كتيّب)"], ["B5", "B5"], ["A4h", "نصف A4 (للطي، صفحتان في الورقة)"]];
  const pageCss = sz => sz === "A4h" ? "@page{size:A4 landscape;margin:12mm}body{column-count:2;column-gap:16mm;column-rule:1px dashed #bbb}" : `@page{size:${sz};margin:${sz === "A5" ? "14mm 12mm" : "18mm 15mm"}}`;
  const fsz = sz => sz === "A4" ? 14 : 12.5;
  const BASE = (sz, extra) => `${pageCss(sz)}body{font-family:Amiri,'Traditional Arabic',serif;font-size:${fsz(sz)}pt;line-height:1.85;color:#14231f;direction:rtl}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b88a2e;padding-bottom:4px;margin-bottom:8px;color:#0f5c4d;font-size:10pt;column-span:all}.hd img{height:30px}
h1{color:#0f5c4d;font-size:1.5em;margin:6px 0 4px;column-span:all}h2,h3{color:#0f5c4d;page-break-after:avoid;break-after:avoid}
.ft{margin-top:12px;text-align:center;color:#5b6b66;font-size:9pt;border-top:1px solid #d6dfda;padding-top:4px;column-span:all}
img{max-width:100%;height:auto}a{color:inherit;text-decoration:none}.pb{page-break-before:always;break-before:page}${extra || ""}`;
  const shell = (title, sz, body, extra) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"><style>${BASE(sz, extra)}</style></head><body>
<div class="hd"><span>${esc(SITENAME)}</span><img src="${location.origin}/assets/logo-sdsl-128.png" alt=""><span>dawahlibrary.org</span></div>${body}
<div class="ft">${esc(SITENAME)} — dawahlibrary.org — ${esc(today())}</div><script>onload=()=>setTimeout(()=>print(),700)<\/script></body></html>`;
  const openW = html => { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html); w.document.close(); };
  const sizeSel = () => `<label>المقاس</label><select name="sz">${SIZES.map(([k, l]) => `<option value="${k}"${(S.prtSz || "A4") === k ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  const TY = { mcq: "اختر الإجابة الصحيحة", tf: "ضع علامة (✓) أو (✗)", cloze: "أكمل" };

  /* ===== كراسات الاختبار والمراجعة ===== */
  async function quizQs(id) {
    let d = null; try { const r = await fetch("data/quizzes/" + id + ".json"); d = r.ok ? await r.json() : null; } catch (e) { }
    const all = ((d && d.qs) || []).filter(x => x.ok), shown = [...document.querySelectorAll(".qz .qq .qt")].map(p => p.textContent.trim());
    const byQ = new Map(all.map(x => [String(x.q).trim(), x]));
    const qs = shown.map(t => byQ.get(t)).filter(Boolean);
    // الخيارات بترتيبها المعروض
    document.querySelectorAll(".qz .qq").forEach((fs, i) => { const x = qs[i]; if (x && x.type === "mcq") { const o = [...fs.querySelectorAll(".qo input")].map(inp => inp.value); if (o.length) qs[i] = Object.assign({}, x, { opts: o }); } });
    return qs.length ? qs : all.slice(0, 30);
  }
  function quizSheet(id) {
    const b = B(id); if (!b) return;
    openSheet("كراسة من الاختبار", `<form id="prtq" data-form="noop"><label>القالب</label>
      <label class="inl"><input type="radio" name="k" value="exam" checked> ورقة اختبار للطباعة (بلا إجابات، ومفتاح الإجابة في صفحة مستقلة)</label>
      <label class="inl"><input type="radio" name="k" value="review"> ورقة مراجعة (السؤال وجوابه وتعليله وصفحته)</label>
      ${sizeSel()}<label class="inl"><input type="checkbox" name="key" checked> إلحاق مفتاح الإجابة بورقة الاختبار</label>
      <div class="savebar"><button class="btn p">🖨 طباعة / PDF</button></div></form>`);
    $("#prtq").onsubmit = async e => { e.preventDefault(); const f = e.target, sz = f.sz.value; S.prtSz = sz; saveS(); closeSheet();
      const qs = await quizQs(id), t = b.setTitle || b.title, lvl = ((typeof parse === "function" && parse().q) || {}).l || "easy", LV = { easy: "سهل", mid: "متوسط", hard: "متقدم" }[lvl] || "";
      if (f.k.value === "exam") {
        const body = `<h1>اختبار: ${esc(t)}</h1><p>المستوى: ${esc(LV)} • عدد الأسئلة: ${toAr(qs.length)}</p>
<div class="who"><span>الاسم: ........................................</span><span>التاريخ: ..................</span><span>الدرجة: ....... / ${toAr(qs.length)}</span></div>
${qs.map((x, i) => `<div class="q"><p><b>${toAr(i + 1)}.</b> <small>${TY[x.type] || ""}</small><br>${esc(x.q)}</p>${x.type === "mcq" ? `<ol class="op">${(x.opts || []).map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : x.type === "tf" ? '<p class="tf">( صح )  ( خطأ )</p>' : '<p class="ln">..............................................................................</p>'}</div>`).join("")}
${f.key.checked ? `<section class="pb"><h2>مفتاح الإجابة</h2><ol class="key">${qs.map(x => `<li>${esc(x.a)} <small>(ص ${toAr(x.p)})</small></li>`).join("")}</ol></section>` : ""}`;
        openW(shell("اختبار " + t, sz, body, `.who{display:flex;flex-wrap:wrap;gap:18px;justify-content:space-between;border:1px solid #0f5c4d;border-radius:8px;padding:6px 10px;margin:8px 0 12px;column-span:all}
.q{break-inside:avoid;page-break-inside:avoid;margin:0 0 8px}.q p{margin:2px 0}small{color:#7a6a4a}.op{list-style:none;padding:0;margin:2px 0;display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}.op li::before{content:"◯ ";color:#0f5c4d}.tf{letter-spacing:2px}.ln{color:#999}.key{columns:2}`));
      } else {
        const body = `<h1>مراجعة: ${esc(t)}</h1><p>${toAr(qs.length)} سؤالًا بأجوبتها، من نص الكتاب مع أرقام صفحاتها.</p>
${qs.map((x, i) => `<div class="q"><p><b>${toAr(i + 1)}.</b> ${esc(x.q)}</p><p class="a">الجواب: <b>${esc(x.a)}</b></p>${x.e ? `<p class="e">${esc(x.e)}</p>` : ""}<p class="e">الكتاب ص ${toAr(x.p)}</p></div>`).join("")}`;
        openW(shell("مراجعة " + t, sz, body, `.q{break-inside:avoid;page-break-inside:avoid;border-right:4px solid #b88a2e;padding:2px 10px;margin:0 0 8px}.q p{margin:2px 0}.a{color:#0f5c4d}.e{color:#5b6b66;font-size:.85em}`));
      } };
  }

  /* ===== التصدير بمقاس الطباعة: المجلة والطلائع والموسوعات ===== */
  const ROOTS = { majalla: "المجلة", talaea: "الطلائع", tala: "الطلائع", mawsua: "الموسوعات" };
  function pageSheet() {
    const sec = (parse().p || [])[0], h = document.querySelector("main h1, main h2"), title = (h ? h.textContent : document.title).trim();
    openSheet("طباعة بمقاس", `<form id="prtp" data-form="noop"><p class="mut">نسخة نظيفة من محتوى هذه الصفحة (${esc(ROOTS[sec] || "")}) بترويسة المكتبة، للطباعة أو الحفظ PDF.</p>
      ${sizeSel()}<label class="inl"><input type="checkbox" name="img" checked> الصور والرسوم</label><label class="inl"><input type="checkbox" name="open" checked> فتح الأقسام المطوية</label>
      <div class="savebar"><button class="btn p">🖨 طباعة / PDF</button></div></form>`);
    $("#prtp").onsubmit = e => { e.preventDefault(); const f = e.target, sz = f.sz.value; S.prtSz = sz; saveS(); closeSheet();
      const src = document.querySelector("main"); if (!src) return; const c = src.cloneNode(true);
      c.querySelectorAll(".noprint,.prtbar,button,form,nav,select,input,textarea,script,.savebar,.tabs,.chips,.bnav,.sheet,dialog,[hidden]").forEach(x => x.remove());
      if (!f.img.checked) c.querySelectorAll("img,svg,canvas,video,audio").forEach(x => x.remove()); else c.querySelectorAll("video,audio,canvas").forEach(x => x.remove());
      if (f.open.checked) c.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
      c.querySelectorAll("a[href^='#/']").forEach(a => a.setAttribute("href", location.origin + "/" + a.getAttribute("href")));
      openW(shell(title, sz, c.innerHTML, "main,section,article{display:block}details summary{font-weight:700;color:#0f5c4d}p{margin:5px 0;text-align:justify}blockquote{border-right:3px solid #b88a2e;margin:6px 0;padding:2px 10px}.card,.bk{border:1px solid #e2e7e5;border-radius:6px;padding:4px 8px;margin:4px 0;break-inside:avoid}")); };
  }

  /* ===== أزرار الأقسام: تُضاف بعد رسم الصفحة ===== */
  function inject() {
    const p = (typeof parse === "function" ? parse().p : []) || [], main = document.querySelector("main"); if (!main || main.querySelector(".prtbar")) return;
    let html = "";
    if (p[0] === "quizzes" && p[1] && main.querySelector(".qz")) html = `<button class="btn s" data-prt="quiz" data-id="${esc(p[1])}">🖨 كراسة: ورقة اختبار أو مراجعة</button>`;
    else if (ROOTS[p[0]] && p[1]) html = `<button class="btn s" data-prt="page">🖨 طباعة بمقاس (A4، A5، B5)</button>`;
    if (!html) return; const h = main.querySelector("h1, h2"); if (!h) return;
    h.insertAdjacentHTML("afterend", `<div class="row prtbar noprint">${html}</div>`);
  }
  let t = 0; const later = () => { clearTimeout(t); t = setTimeout(inject, 350); };
  window.addEventListener("hashchange", later);
  const mo = () => { const m = document.querySelector("main"); if (m) new MutationObserver(later).observe(m, { childList: true }); else setTimeout(mo, 500); }; mo(); later();
  document.addEventListener("click", e => { const b = e.target.closest("[data-prt]"); if (!b) return; e.preventDefault(); b.dataset.prt === "quiz" ? quizSheet(b.dataset.id) : pageSheet(); });
  return { quizSheet, pageSheet };
})();
