/* قسم «المصادر الإثرائية» (ب3-5 … ب3-10، ب4-15 … ب4-31 من وثيقة التطوير) — #/ithra
   قسم مستقل يقابل مكتبة الدعوة والمكتبة العامة: مقالات وبحوث ودراسات من مراكز ومجلات خارج المصادر الأساسية
   (مركز سلف، مجلة الفرقان الكويتية، أكاديمية أسس، مركز جسور…). كل مادة بالحقل col="ithra" ومصدرها src ورابطها الأصلي url.
   - مؤلفوه سجلات مستقلة (col="ithra") لا تُدمج آليًا مع مؤلفي مكتبة الدعوة (ب3-9، ب4-31)؛ وتُستبعد مواده من قوائم مقالات الدعوة وكتبها.
   - lic="link": لم يتوفر إذن بإعادة النشر كاملًا، فيُعرض الملخص والبيانات والرابط الأصلي فقط (ب4-30).
   - البحث والقراءة والتصدير خدمات مشتركة مع بقية الأقسام، مع بقاء هوية المصدر (ب3-10). */
const ITHRA = (() => {
  const SOURCES = [["salaf", "مركز سلف للبحوث والدراسات"], ["furqan", "مجلة الفرقان الكويتية"], ["usus", "أكاديمية أسس للأبحاث والعلوم"], ["jusur", "مركز جسور للبحوث والدراسات"], ["other", "مصادر أخرى"]];
  const srcName = k => (SOURCES.find(s => s[0] === k) || [k, k || "مصدر غير محدد"])[1];
  const items = () => lib.books.filter(b => bc(b) === "ithra" && !VOL2(b));
  const KINDS = { article: "مقال", research: "بحث ودراسة", book: "كتاب", report: "تقرير" };
  const kind = b => b.ik || (isArt(b) ? "article" : "book");
  const card = b => `<a class="bk ith" href="#/book/${encodeURIComponent(b.id)}/1"><b>${esc(b.title)}${b.lic === "link" ? ' <em class="tag">ملخص ورابط</em>' : ""}</b><span>${esc(A(b.authorId).name)} • ${esc(srcName(b.src))} • ${KINDS[kind(b)] || ""}${b.date ? " • " + esc(typeof fmtDate === "function" ? fmtDate(b.date) : b.date) : ""}</span>${b.sum ? `<p>${esc(b.sum.slice(0, 220))}</p>` : ""}</a>`;
  function view_(q) {
    const f = { s: q.s || "", k: q.k || "", t: q.t || "", a: q.a || "", q: (q.q || "").trim(), o: q.o || "new", pg: +q.pg || 1 }, PER = 20, all = items();
    let r = all.filter(b => (!f.s || b.src === f.s) && (!f.k || kind(b) === f.k) && (!f.t || inTopic(b, f.t)) && (!f.a || b.authorId === f.a));
    if (f.q) { const w = norm(f.q).split(/\s+/).filter(Boolean); r = r.filter(b => w.every(x => norm(b.title + " " + (A(b.authorId).name || "") + " " + (b.sum || "")).includes(x))); }
    r = f.o === "title" ? r.sort((x, y) => x.title.localeCompare(y.title, "ar")) : f.o === "author" ? r.sort((x, y) => (A(x.authorId).name || "").localeCompare(A(y.authorId).name || "", "ar")) : r.sort((x, y) => (y.date || y.added || "").localeCompare(x.date || x.added || ""));
    const np = Math.max(1, Math.ceil(r.length / PER)), pg = Math.min(f.pg, np), url = o => "#/ithra?" + new URLSearchParams(Object.entries(Object.assign({}, f, o)).filter(([k, v]) => v && !(k === "pg" && v === 1) && !(k === "o" && v === "new")));
    const cnt = k => all.filter(b => b.src === k).length, topics = lib.topics.filter(t => all.some(b => inTopic(b, t.id)));
    const authors = lib.authors.filter(a => all.some(b => b.authorId === a.id)).sort((x, y) => x.name.localeCompare(y.name, "ar"));
    view(`<h2>${esc(COL.ithra)}</h2><p class="mut">مقالات وبحوث ودراسات علمية وشرعية من مراكز ومجلات خارج المصادر الأساسية للدعوة، مستقلة عن مكتبة الدعوة والمكتبة العامة، بمؤلفيها وتصنيفاتها، مع حفظ المصدر الأصلي ورابطه. ما لم يُؤذن بإعادة نشره كاملًا يُعرض ملخصه وبياناته ورابطه فقط.</p>
     <nav class="chips ithsrc">${[["", "كل المصادر", all.length]].concat(SOURCES.map(([k, n]) => [k, n, cnt(k)])).filter(x => !x[0] || x[2]).map(([k, n, c]) => `<a class="chip${f.s === k ? " x" : ""}" href="${url({ s: k, pg: 1 })}">${esc(n)} (${toAr(c)})</a>`).join("")}</nav>
     <form data-form="ithq" class="row ithf"><input name="q" type="search" value="${esc(f.q)}" placeholder="ابحث في العناوين والمؤلفين والملخصات">
      <select name="k"><option value="">كل الأنواع</option>${Object.entries(KINDS).map(([k, n]) => `<option value="${k}"${f.k === k ? " selected" : ""}>${n}</option>`).join("")}</select>
      <select name="t"><option value="">كل الموضوعات</option>${topics.map(t => `<option value="${t.id}"${f.t === t.id ? " selected" : ""}>${esc(topicLabel(t))}</option>`).join("")}</select>
      <select name="a"><option value="">كل المؤلفين</option>${authors.map(a => `<option value="${a.id}"${f.a === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
      <select name="o">${[["new", "الأحدث"], ["title", "حسب العنوان"], ["author", "حسب المؤلف"]].map(([k, n]) => `<option value="${k}"${f.o === k ? " selected" : ""}>${n}</option>`).join("")}</select>
      <input type="hidden" name="s" value="${esc(f.s)}"><button class="btn">عرض</button></form>
     <p class="mut">${toAr(r.length)} مادة${np > 1 ? ` • صفحة ${toAr(pg)} من ${toAr(np)}` : ""}</p>
     <div class="list">${r.slice((pg - 1) * PER, pg * PER).map(card).join("") || `<p class="note">${all.length ? "لا نتائج مطابقة." : "لم تُضف مواد إثرائية بعد. تُضاف من «الإدارة» (القسم: المصادر الإثرائية) أو بالاستجلاب الدوري من المصادر بعد مراجعتها."}</p>`}</div>
     <div class="row" style="justify-content:center;gap:8px">${pg > 1 ? `<a class="btn" href="${url({ pg: pg - 1 })}">السابق</a>` : ""}${pg < np ? `<a class="btn" href="${url({ pg: pg + 1 })}">التالي</a>` : ""}</div>`);
  }
  // في صفحة القراءة: هوية المصدر والرابط الأصلي، وعند عدم الإذن الملخص والرابط فقط
  const note = b => bc(b) !== "ithra" ? "" : `<div class="src-note ith">من ${esc(COL.ithra)}: ${esc(srcName(b.src))}${b.url ? ` — <a href="${esc(b.url)}" target="_blank" rel="noopener">المصدر الأصلي</a>` : ""}${b.lic === "link" ? "<br>لم يُؤذن بإعادة نشر النص كاملًا؛ المعروض ملخص وبيانات المادة، والنص في مصدره." : ""}</div>`;
  document.addEventListener("submit", e => { const f = e.target; if (!f.dataset || f.dataset.form !== "ithq") return; e.preventDefault(); e.stopImmediatePropagation();
    const p = new URLSearchParams(); new FormData(f).forEach((v, k) => v && !(k === "o" && v === "new") && p.set(k, v)); go("#/ithra?" + p); }, true);
  return { view: view_, note, SOURCES, srcName, items };
})();
