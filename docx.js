/* تصدير Word الحقيقي (DOCX) للنص المدقق: اتجاه من اليمين، وخطوط عربية، وعناوين بأنماط Word (تظهر في جزء التنقل)،
   وفهرس مربوط بالعناوين، وحواشٍ سفلية حقيقية مربوطة بأرقامها في المتن، وجداول، وأبيات شعر في الوسط،
   وغلاف بشعار المكتبة، وصفحة حقوق وبيانات الإصدار، وترويسة وتذييل بأرقام الصفحات. يُفتح في Word وLibreOffice وGoogle Docs وPages.
   للإدارة ومن تمنحه صلاحية «export_text». */
const DOCX = (() => {
  const x = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const AR = "٠١٢٣٤٥٦٧٨٩", nrm = s => String(s).replace(/[٠-٩]/g, d => AR.indexOf(d)), toA = n => String(n).replace(/\d/g, d => AR[d]);
  // التنسيق: يختاره المستخدم في نافذة التصدير (meta.fmt)، وهذه قيمه الافتراضية
  const DEF = { font: "Traditional Arabic", hfont: "Traditional Arabic", bs: 15, h1: 17, h2: 15, h3: 14, fs: 11, cb: "1D2622", c1: "0F5C4D", c2: "0F5C4D", ca: "B88A2E", line: 1.5, jc: "both", ind: 1, page: "A4", mar: "normal", hb: 1, cover: 1 };
  let F = Object.assign({}, DEF), FONT = F.font, HFONT = F.hfont;
  const hp = pt => Math.round(pt * 2), LN = () => Math.round(240 * F.line);
  const rpr = (o = {}) => `<w:rPr><w:rFonts w:ascii="${o.f || FONT}" w:hAnsi="${o.f || FONT}" w:cs="${o.f || FONT}"/>${o.b ? "<w:b/><w:bCs/>" : ""}${o.i ? "<w:i/><w:iCs/>" : ""}${o.c ? `<w:color w:val="${o.c}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}${o.sup ? '<w:vertAlign w:val="superscript"/>' : ""}<w:rtl/></w:rPr>`;
  const run = (t, o) => `<w:r>${rpr(o)}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  // نص فيه **عريض**: يُحوَّل إلى مقاطع
  const runs = (t, o = {}, fnRef) => { const out = []; String(t).split(/(\*\*[^*]+\*\*)/).forEach(seg => { if (!seg) return; const bold = /^\*\*[^*]+\*\*$/.test(seg), s = bold ? seg.slice(2, -2) : seg;
      if (!fnRef) { out.push(run(s, Object.assign({}, o, bold ? { b: true } : {}))); return; }
      // علامات الحواشي «(١)» في المتن تصير مراجع حواشٍ حقيقية
      // العلامة الأصلية كما في الطبعة (أرقامًا أو حروفًا) علامةً مخصصة للحاشية؛ ولا تُعدّ «(أ)» في أول السطر علامة (هي ترقيم فقرة)
      let last = 0; s.replace(/\(([\d٠-٩]{1,3}|[\u0621-\u064A])\)/g, (m, d, i) => { if (i === 0 && !o.notStart) return m; const id = fnRef(nrm(d)); if (!id) return m; if (i > last) out.push(run(s.slice(last, i), Object.assign({}, o, bold ? { b: true } : {}))); out.push(/^[\d٠-٩]+$/.test(d) ? `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`  /* الأرقام: ترقيم Word نفسه، والحروف: العلامة الأصلية */
        : `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteReference w:customMarkFollows="1" w:id="${id}"/></w:r><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:t>${x("(" + d + ")")}</w:t></w:r>`); last = i + m.length; return m; });
      if (last < s.length) out.push(run(s.slice(last), Object.assign({}, o, bold ? { b: true } : {}))); }); return out.join(""); };
  const para = (inner, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ""}${o.keep ? "<w:keepNext/>" : ""}${o.pb ? "<w:pageBreakBefore/>" : ""}<w:bidi/><w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 80 : o.after}" w:line="${o.line || 360}" w:lineRule="auto"/>${o.ind ? `<w:ind w:firstLine="${o.ind}"/>` : ""}<w:jc w:val="${o.jc || "both"}"/></w:pPr>${inner}</w:p>`;
  let BM = 0; const bookmark = (name, inner) => { const id = ++BM; return `<w:bookmarkStart w:id="${id}" w:name="${x(name)}"/>${inner}<w:bookmarkEnd w:id="${id}"/>`; };
  const table = rows => { const n = Math.max(...rows.map(r => r.length)); return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:bidiVisual/><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${["top", "start", "bottom", "end", "insideH", "insideV"].map(k => `<w:${k} w:val="single" w:sz="4" w:color="999999"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${Array(n).fill('<w:gridCol w:w="2000"/>').join("")}</w:tblGrid>${rows.map((r, ri) => `<w:tr>${Array.from({ length: n }, (_, i) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${ri === 0 ? '<w:shd w:val="clear" w:fill="E8F2EC"/>' : ""}</w:tcPr>${para(runs(r[i] || "", { sz: 26, b: ri === 0 }), { jc: "center", after: 0, line: 300 })}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>${para("", { after: 60 })}`; };

  async function build(meta) {
    // meta: {title, author, pages:[{i, t, l}], toc:[{t,p,l}], opt:{fn,toc,pl}, url, src, who, site, siteUrl}
    F = Object.assign({}, DEF, meta.fmt || {}); FONT = F.font; HFONT = F.hfont;
    ["cb", "c1", "c2", "ca"].forEach(k => { F[k] = String(F[k] || DEF[k]).replace("#", "").toUpperCase(); if (!/^[0-9A-F]{6}$/.test(F[k])) F[k] = DEF[k]; });
    ["bs", "h1", "h2", "h3", "fs", "line"].forEach(k => { F[k] = +F[k] || DEF[k]; });
    BM = 0; const footnotes = []; let fnId = 1; const body = [], heads = new Map();
    (meta.toc || []).forEach((t, k) => { if (!heads.has(t.p)) heads.set(t.p, []); heads.get(t.p).push({ t: t.t, l: t.l || 1, bm: "h" + k }); });
    // الغلاف
    let logo = null; try { const r = await fetch("assets/logo-sdsl-128.png"); if (r.ok) logo = new Uint8Array(await r.arrayBuffer()); } catch (e) { }
    if (logo && F.cover) body.push(para(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1143000" cy="1143000"/><wp:docPr id="1" name="logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1143000" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, { jc: "center", before: 600, after: 200 }));
    if (F.cover) {
    body.push(para(run(meta.site, { sz: 30, c: F.c1, b: true }), { jc: "center", after: 600 }));
    body.push(para(run(meta.title, { sz: 56, b: true, c: F.c1, f: HFONT }), { style: "Title", jc: "center", after: 300, line: 480 }));
    if (meta.author) body.push(para(run(meta.author, { sz: 36, c: "5B6B66" }), { jc: "center", after: 1200 }));
    body.push(para(run(meta.siteUrl, { sz: 24, c: F.ca }), { jc: "center", after: 0 })); }
    // صفحة الحقوق والبيانات
    const d = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    body.push(para(run("بيانات النسخة الرقمية", { sz: 32, b: true, c: F.c1 }), { jc: "center", pb: !!F.cover, before: F.cover ? 1200 : 0, after: 300 }));
    [["الكتاب", meta.title], ["المؤلف", meta.author], ["المصدر في المكتبة", meta.url], meta.src ? ["مصدر النص", meta.src] : null, ["تاريخ التنزيل", d], meta.who ? ["نُزّلت لـ", meta.who] : null].filter(Boolean)
      .forEach(([k, v]) => body.push(para(run(k + ": ", { b: true, sz: 28 }) + run(v || "—", { sz: 28 }), { jc: "start", after: 60 })));
    body.push(para(run(`هذه النسخة النصية من إعداد «${meta.site}» (${meta.siteUrl}): تحويل النص وتدقيقه وضبطه وتنسيقه وفهرسته جهدُ فريق المكتبة. يُرجى عند النقل منها أو نشرها الإشارة إلى المكتبة مصدرًا ورابط الكتاب فيها، وعدم نسبة هذا الجهد إلى غيرها. وحقوق المؤلف في كتابه محفوظة له كما هي.`, { sz: 26, c: "5B6B66" }), { before: 400, after: 0, line: 380 }));
    // الفهرس
    if (meta.opt.toc && (meta.toc || []).length) {
      body.push(para(run("الفهرس", { sz: 34, b: true, c: F.c1, f: HFONT }), { jc: "center", pb: true, after: 240 }));
      meta.toc.forEach((t, k) => body.push(para(`<w:hyperlink w:anchor="h${k}">${run(t.t, { sz: t.l === 2 ? 26 : 28, c: "1D2622" })}</w:hyperlink><w:r>${rpr({ sz: 26 })}<w:tab/></w:r>${run(t.pl || toA(t.p), { sz: 24, c: "5B6B66" })}`, { jc: "start", after: 40, line: 320, style: t.l === 2 ? "TOC2" : "TOC1" })));
    }
    // المتن: يبدأ في صفحة جديدة
    body.push(para("", { pb: true, after: 0 }));
    let first = true;
    for (const pg of meta.pages) {
      const raw = String(pg.t || ""), cut = raw.search(/^\s*_{4,}\s*$/m), main = cut >= 0 ? raw.slice(0, cut) : raw, fnTxt = cut >= 0 ? raw.slice(cut).replace(/^\s*_{4,}\s*\n?/, "") : "";
      // حواشي الصفحة: «(١) نص الحاشية» (السطر الذي لا يبدأ برقم تابع لما قبله)
      const fmap = {}; let lastK = null;
      if (meta.opt.fn) fnTxt.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => { const m = /^\(?([\d٠-٩]{1,3}|[\u0621-\u064A])\)\s*[-–.:]?\s*(.+)$/.exec(l) || /^([\d٠-٩]{1,3})\s*[-–.:]\s*(.+)$/.exec(l); if (m) { lastK = nrm(m[1]); fmap[lastK] = { t: m[2], id: 0, mk: m[1] }; } else if (lastK) fmap[lastK].t += " " + l; });
      const fnRef = k => { const f = fmap[k]; if (!f || f.id) return 0; f.id = ++fnId; footnotes.push([f.id, f.t, f.mk]); return f.id; };  // كل حاشية تُربط بأول علامة لها فقط
      const hs = (heads.get(pg.i) || []).slice();
      const lines = (typeof joinLines === "function" ? joinLines(main) : main).split("\n").map(l => l.replace(/\s+$/, "")).filter(l => l.trim());
      let tbl = [];
      const flush = () => { if (tbl.length) { body.push(table(tbl)); tbl = []; } };
      lines.forEach(l => { const s = l.trim();
        if (/^\|.*\|$/.test(s)) { if (!/^\|[\s:|-]+\|$/.test(s)) tbl.push(s.slice(1, -1).split("|").map(c => c.trim())); return; } flush();
        const h = /^(#{1,3})\s*(.+)$/.exec(s);
        if (h) { const lv = h[1].length, t = h[2].replace(/\*\*/g, "").replace(/^AUTO\s*/, ""), hi = hs.findIndex(z => z.t.replace(/\s+/g, "") === t.replace(/\s+/g, "")) ; const hh = hi >= 0 ? hs.splice(hi, 1)[0] : null;
          const inner = runs(t, { b: !!F.hb, sz: hp(lv === 1 ? F.h1 : lv === 2 ? F.h2 : F.h3), c: lv === 1 ? F.c1 : F.c2, f: HFONT }, fnRef);
          body.push(para(hh ? bookmark(hh.bm, inner) : inner, { style: "Heading" + Math.min(3, lv), jc: "center", keep: true, before: first ? 0 : 240, after: 120 })); first = false; return; }
        if (/^@@/.test(s)) { body.push(para(runs(s.replace(/^@@\s*/, ""), { b: true, sz: hp(F.h3), c: F.c2, f: HFONT }, fnRef), { jc: "start", keep: true, before: 120 })); return; }
        if (/\.{3}|…/.test(s) && s.length < 160 && !/[.؟!]\s*$/.test(s.replace(/\.{3}|…/g, ""))) { body.push(para(runs(s.replace(/\s*(\.{3}|…)\s*/g, "      "), { sz: hp(F.bs), c: F.cb }, fnRef), { jc: "center", after: 40, line: LN() })); return; } // بيت شعر
        body.push(para(runs(s, { sz: hp(F.bs), c: F.cb }, fnRef), { ind: F.ind ? 440 : 0, jc: F.jc, line: LN() })); first = false;
      });
      flush();
      // عناوين الفهرس التي لم تظهر في متن صفحتها: إشارة مرجعية في أولها حتى يعمل الرابط
      hs.forEach(z => body.push(para(bookmark(z.bm, ""), { after: 0 })));
      // حواشٍ بلا علامة في المتن: تبقى في آخر الصفحة بخط أصغر
      const orphan = Object.entries(fmap).filter(([, f]) => !f.id);
      if (orphan.length) orphan.forEach(([k, f]) => body.push(para(run(`(${toA(k)}) ${f.t}`, { sz: hp(F.fs), c: "5B6B66" }), { after: 20, line: 280 })));
      if (meta.opt.pl) body.push(para(run(`[${pg.l}]`, { sz: 18, c: "999999" }), { jc: "center", after: 120 }));
    }
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    const NS = `xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`;
    const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rHdr"/><w:footerReference w:type="default" r:id="rFtr"/><w:footnotePr><w:numFmt w:val="hindiNumbers"/><w:numRestart w:val="eachPage"/></w:footnotePr>${(() => { const P = { A4: [11906, 16838], A5: [8391, 11906], Letter: [12240, 15840], B5: [9979, 14175] }[F.page] || [11906, 16838], m = { narrow: 850, normal: 1300, wide: 1800 }[F.mar] || 1300; return `<w:pgSz w:w="${P[0]}" w:h="${P[1]}"/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="600" w:footer="600" w:gutter="0"/>`; })()}<w:titlePg/><w:bidi/></w:sectPr>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join("")}${sect}</w:body></w:document>`;
    const hdr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(run(meta.title, { sz: 20, c: "5B6B66" }) + `<w:r>${rpr({ sz: 20 })}<w:tab/></w:r>` + run(meta.site, { sz: 20, c: "0F5C4D", b: true }), { jc: "both", after: 0, style: "Header" })}</w:hdr>`;
    const ftr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${para(run(meta.siteUrl + " — ", { sz: 18, c: "999999" }) + `<w:r>${rpr({ sz: 20 })}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rpr({ sz: 20 })}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>${rpr({ sz: 20 })}<w:fldChar w:fldCharType="separate"/></w:r>${run("1", { sz: 20 })}<w:r>${rpr({ sz: 20 })}<w:fldChar w:fldCharType="end"/></w:r>`, { jc: "center", after: 0, style: "Footer" })}</w:ftr>`;
    const fns = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${NS}><w:footnote w:type="separator" w:id="0"><w:p><w:pPr><w:bidi/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="1"><w:p><w:pPr><w:bidi/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>${footnotes.map(([id, t, mk]) => `<w:footnote w:id="${id}">${para((/^[\d٠-٩]+$/.test(mk) ? `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:rtl/></w:rPr><w:footnoteRef/></w:r>` + run(" ", { sz: hp(F.fs) }) : run("(" + mk + ") ", { sz: hp(F.fs), b: true })) + run(t, { sz: hp(F.fs) }), { style: "FootnoteText", after: 0, line: 280 })}</w:footnote>`).join("")}</w:footnotes>`;
    const st = (id, name, o) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${o.next ? `<w:next w:val="Normal"/>` : ""}<w:qFormat/><w:pPr><w:bidi/>${o.ol != null ? `<w:outlineLvl w:val="${o.ol}"/>` : ""}</w:pPr><w:rPr><w:rFonts w:cs="${FONT}"/>${o.b ? "<w:b/><w:bCs/>" : ""}${o.c ? `<w:color w:val="${o.c}"/>` : ""}<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/><w:rtl/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${hp(F.bs)}"/><w:szCs w:val="${hp(F.bs)}"/><w:rtl/><w:lang w:val="ar-EG" w:bidi="ar-EG"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:bidi/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/></w:pPr></w:style>
      ${st("Title", "Title", { b: 1, sz: 56, c: F.c1 })}${st("Heading1", "heading 1", { b: F.hb, sz: hp(F.h1), c: F.c1, ol: 0, next: 1 })}${st("Heading2", "heading 2", { b: F.hb, sz: hp(F.h2), c: F.c2, ol: 1, next: 1 })}${st("Heading3", "heading 3", { b: F.hb, sz: hp(F.h3), c: F.c2, ol: 2, next: 1 })}
      ${st("TOC1", "toc 1", { sz: 28 })}${st("TOC2", "toc 2", { sz: 26 })}${st("Header", "header", { sz: 20 })}${st("Footer", "footer", { sz: 18 })}${st("FootnoteText", "footnote text", { sz: hp(F.fs) })}
      <w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
      <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:bidiVisual/></w:tblPr></w:style></w:styles>`;
    const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:footnotePr><w:numFmt w:val="hindiNumbers"/><w:numRestart w:val="eachPage"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="ar-EG" w:bidi="ar-EG"/></w:settings>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const files = [
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="r2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="r3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
      ["word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rSty" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rSet" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rFn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/><Relationship Id="rHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${logo ? '<Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : ""}</Relationships>`],
      ["word/document.xml", doc], ["word/styles.xml", styles], ["word/settings.xml", settings], ["word/footnotes.xml", fns], ["word/header1.xml", hdr], ["word/footer1.xml", ftr],
      ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(meta.title)}</dc:title><dc:creator>${x(meta.author || "")}</dc:creator><cp:lastModifiedBy>${x(meta.site)}</cp:lastModifiedBy><dc:publisher>${x(meta.site)}</dc:publisher><dc:description>${x("نسخة نصية من " + meta.site + " — " + meta.url)}</dc:description><dc:language>ar</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`],
      ["docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${x(meta.site)}</Application><Company>${x(meta.site)}</Company></Properties>`]
    ];
    if (logo) files.push(["word/media/logo.png", logo]);
    const blob = EXT.zip(files);
    return new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  return { build };
})();
