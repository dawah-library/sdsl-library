/* واجهة الموقع بالإنجليزية: ترجمة عناصر الواجهة (لا نصوص الكتب) من data/i18n-en.json، مع اتجاه من اليسار إلى اليمين.
   نصوص الكتب والمقالات وأسماء الكتب والمؤلفين تبقى بالعربية (المحتوى الأصلي)، وللصفحات ترجمة اختيارية داخل القارئ. */
(function () {
  let set = {}; try { set = JSON.parse(localStorage.getItem("set") || "{}") || {}; } catch (e) { }
  const EN = set.ui === "en";
  window.UI_LANG = EN ? "en" : "ar";
  if (!EN) return;
  const H = document.documentElement; H.lang = "en"; H.dir = "ltr"; H.classList.add("ui-en");
  const SKIP = ".rd,.aptext,.gmore,.ptext,.pquote,.cmt p,.rulestx,textarea,input,select option[data-noi18n],script,style,[data-noi18n],.bk>b,.acard2>b,.acard2 .acov em,.rhead h2,.ahead h1,.alink,[data-author],.post header b,.tt,.aptx b,.rnow b,.amark .lnk,.gitem summary b,.dict,.wmenu b,.q p,.tocl span,.toclist a,.chips .chip[href*='author'],.abrief p";
  let D = null, RX = null;
  const AD = s => s.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/،/g, ",").replace(/؛/g, ";").replace(/؟/g, "?");
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function tr(s) {
    const t = s.trim(); if (!t || !/[ء-ي]/.test(t)) return null;
    const k = t.replace(/[.:،]+$/, "");
    if (D[t]) return s.replace(t, D[t]);
    const ago = /^منذ\s+(.+)$/.exec(t); if (ago) { const r = tr(ago[1]); return s.replace(t, AD((r || ago[1]).trim()) + " ago"); }
    if (D[k]) return s.replace(t, D[k] + t.slice(k.length).replace(/،/g, ","));
    // استبدال العبارات المعروفة داخل النص (الأطول أولًا، بحدود الكلمات)
    const out = s.replace(RX, m => D[m] || m);
    if (out === s) return null;
    // لا نخلط: إن بقي معظم النص عربيًا (عنوان كتاب أو اسم) يُترك كما هو
    const ar = x => (x.match(/[\u0621-\u064A]/g) || []).length;
    return ar(out) > ar(s) * 0.3 ? null : AD(out);
  }
  function walk(root) {
    if (!D) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 ? (n.matches && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT
    });
    const list = []; let n; while ((n = tw.nextNode())) list.push(n);
    list.forEach(x => { if (x.__i18n === x.nodeValue) return; const v = tr(x.nodeValue); if (v != null) { x.nodeValue = v; } x.__i18n = x.nodeValue; });
    (root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label],[title]") : []).forEach(el => {
      if (el.closest(SKIP.replace(/,?(textarea|input)/g, ""))) return;
      ["placeholder", "aria-label", "title"].forEach(a => { const v = el.getAttribute(a); if (v && /[ء-ي]/.test(v)) { const t = tr(v); if (t != null) el.setAttribute(a, t); } });
    });
  }
  // أسماء الكتب والمؤلفين بالإنجليزية تحت أسمائها العربية
  let CATEN = { books: {}, authors: {} };
  fetch("data/i18n-cat-en.json").then(r => r.ok ? r.json() : null).then(j => { if (j) { CATEN = j; q.add(document.body); if (!raf) raf = requestAnimationFrame(flush); } }).catch(() => { });
  function names(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('a.bk[href^="#/book/"]:not([data-en]),a.acard2[href^="#/audio/"]:not([data-en])').forEach(a => { a.dataset.en = 1; const id = a.getAttribute("href").split("/")[2]; const t = CATEN.books[id]; if (t) a.querySelector("b") && a.querySelector("b").insertAdjacentHTML("afterend", `<small class="entitle" data-noi18n>${t.replace(/[<>&]/g, "")}</small>`); });
    root.querySelectorAll("[data-author]:not([data-en])").forEach(el => { el.dataset.en = 1; const n = CATEN.authors[el.dataset.author]; if (n) el.title = n; });
    const h = root.querySelector && root.querySelector(".rhead h2:not([data-en])"); if (h) { h.dataset.en = 1; const id = (location.pathname.split("/")[2] || (location.hash.split("/")[2] || "")); const t = CATEN.books[id]; if (t) h.insertAdjacentHTML("afterend", `<p class="entitle" data-noi18n>${t.replace(/[<>&]/g, "")}</p>`); }
  }
  let q = new Set(), raf = 0;
  const flush = () => { raf = 0; const roots = [...q]; q.clear(); roots.forEach(r => { if (r.isConnected) { const e = r.nodeType === 3 ? r.parentNode : r; walk(e); names(e); } }); if (document.title && /[ء-ي]/.test(document.title)) { const t = tr(document.title); if (t) document.title = t; } };
  const mo = new MutationObserver(ms => { ms.forEach(m => { if (m.type === "characterData") q.add(m.target); else m.addedNodes.forEach(x => q.add(x)); }); if (!raf) raf = requestAnimationFrame(flush); });
  fetch("data/i18n-en.json").then(r => r.json()).then(j => {
    D = j.ui || {};
    const keys = Object.keys(D).filter(k => k.length >= 2).sort((a, b) => b.length - a.length);
    RX = new RegExp("(?<![\\u0621-\\u064A])(" + keys.map(esc).join("|") + ")(?![\\u0621-\\u064A])", "g");
    walk(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }).catch(() => { });
})();
