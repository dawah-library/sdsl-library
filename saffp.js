/* نافذة «صف التفريغ» (saff.js): يُحمَّل قبل Paged.js فيضبط إعداده، ويُظهر حالة الصف ثم شريط «طباعة / حفظ PDF». */
(function () {
  var bar = document.createElement("div"); bar.id = "saffbar";
  bar.innerHTML = '<b>جارٍ صف الكتاب وتقسيمه صفحات…</b>';
  var css = document.createElement("style");
  css.textContent = "#saffbar{position:fixed;top:0;inset-inline:0;z-index:99;background:#0f5c4d;color:#fff;font:15px/1.6 'Noto Naskh Arabic',Amiri,sans-serif;padding:8px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;direction:rtl;box-shadow:0 2px 8px #0004}#saffbar button{font:inherit;background:#b88a2e;color:#fff;border:0;border-radius:8px;padding:6px 14px;cursor:pointer}#saffbar small{opacity:.85}"
    + "@media screen{html{background:#5b6360}body{margin:0;padding-top:60px}.pagedjs_pages{display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0 40px}.pagedjs_page{background:#fff;box-shadow:0 4px 18px #0006}}@media print{#saffbar{display:none!important}html,body{background:none;padding:0}}";
  document.documentElement.appendChild(css); document.documentElement.appendChild(bar);
  window.PagedConfig = {
    auto: true,
    after: function (flow) {
      var n = (flow && flow.total) || document.querySelectorAll(".pagedjs_page").length;
      // أرقام صفحات الفهرس من مواضع الفصول بعد التقسيم
      var ar = function (x) { return String(x).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); };
      // ترقيم الحواشي: مع كل صفحة أو متصلًا، وكل علامة في المتن برقم حاشيتها
      var k = 0, per = document.body.dataset.fnum !== "all";
      document.querySelectorAll(".pagedjs_page").forEach(function (pg) { if (per) k = 0;
        pg.querySelectorAll("[data-footnote-call]").forEach(function (c) { k++; var v = ar(k), id = c.getAttribute("data-footnote-call"); c.setAttribute("data-n", v);
          var m = document.querySelector('[data-footnote-marker="' + id + '"]'); if (m) m.setAttribute("data-n", v); }); });
      document.querySelectorAll('.toc a[href^="#"]').forEach(function (a) { var t = document.getElementById(a.getAttribute("href").slice(1)), pg = t && t.closest(".pagedjs_page"), pn = a.querySelector(".pn"); if (pg && pn) pn.textContent = ar(pg.dataset.pageNumber || ""); });
      bar.innerHTML = '<b>اكتمل الصف: ' + String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }) + ' صفحة</b><button id="saffprint">طباعة / حفظ PDF</button><small>في نافذة الطباعة: اختر «حفظ بصيغة PDF»، والهوامش «الافتراضية»، وفعّل «رسومات الخلفية» ليظهر الغلاف.</small>';
      document.getElementById("saffprint").onclick = function () { window.print(); };
    }
  };
})();
