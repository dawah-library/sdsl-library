/* تصدير الكتب: الصفحة أو الفصل أو نطاق صفحات أو الكتاب كاملًا، بصيغ PDF (بقوالب ومقاسات) وWord وEPUB وHTML وMarkdown ونص،
   مع الحواشي والفهرس، والتشكيل بحسب اختيار القارئ. الكتاب كاملًا للأعضاء المسجلين؛ وللزوار حتى ٥٠ صفحة. */
const EXT = {
  // ملف ZIP بلا ضغط (لصيغة EPUB)
  crcT: null,
  crc(u8) { if (!this.crcT) { this.crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; this.crcT[n] = c >>> 0; } } let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = this.crcT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; },
  zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    files.forEach(([name, data]) => {
      const nm = enc.encode(name), d = typeof data === "string" ? enc.encode(data) : data, crc = this.crc(d);
      const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0)];
      parts.push(new Uint8Array(head), nm, d);
      cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += head.length + nm.length + d.length;
    });
    const csize = cen.reduce((s, x) => s + x.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
    return new Blob([...parts, ...cen, end], { type: "application/epub+zip" });
  },
  x: s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  // صفحة الكتاب إلى HTML: العناوين والفقرات والحواشي
  pageHtml(t, opt) {
    t = String(t || ""); const cut = t.search(/^\s*_{4,}\s*$/m), body = cut >= 0 ? t.slice(0, cut) : t, fn = cut >= 0 ? t.slice(cut).replace(/^\s*_{4,}\s*\n?/, "").trim() : "";
    const lines = (typeof joinLines === "function" ? joinLines(body) : body).split("\n").filter(l => l.trim());
    let h = lines.map(l => /^#{1,3}\s/.test(l) ? `<h3>${this.x(l.replace(/^#+\s*/, "").replace(/\*\*/g, ""))}</h3>` : `<p>${this.x(l.replace(/\*\*/g, ""))}</p>`).join("");
    if (fn && opt.fn) h += `<div class="fn">${fn.split("\n").filter(Boolean).map(l => `<p>${this.x(l)}</p>`).join("")}</div>`;
    return h;
  }
};
const EXT_TPL = {
  classic: { n: "كلاسيكي (ورقي)", css: "body{font-family:Amiri,'Traditional Arabic',serif;background:#fbf7ee;color:#2a241a}h1,h2,h3{color:#5a3f12}" },
  modern: { n: "حديث", css: "body{font-family:'IBM Plex Sans Arabic','Noto Naskh Arabic',sans-serif;color:#14231f}h1,h2,h3{color:#0f5c4d}" },
  green: { n: "هوية المكتبة", css: "body{font-family:Amiri,serif;color:#14231f}h1{background:#0f5c4d;color:#fff;padding:14px;border-radius:10px}h3{color:#0f5c4d;border-bottom:2px solid #b88a2e;padding-bottom:4px}" },
  compact: { n: "مضغوط (للطباعة الاقتصادية)", css: "body{font-family:'Traditional Arabic',Amiri,serif;font-size:13pt!important;line-height:1.7!important}" }
};
function expDlg() {
  const c = cur(); if (!c) return; const b = c.b, n = b.pages.length, ch = (b.toc || []).filter(t => t.p <= c.p).pop(), nx = ch ? (b.toc || []).find(t => t.p > ch.p && (t.l || 1) <= (ch.l || 1)) : null;
  const chA = ch ? ch.p : 1, chZ = nx ? nx.p - 1 : n, member = !!Auth.user;
  openDlg(`<h3>تصدير ${isArt(b) ? "المقال" : "الكتاب"}</h3>
  <form data-form="expx" class="expx"><label>النطاق</label><div class="seg">
   <label><input type="radio" name="sc" value="page" checked> الصفحة الحالية</label>
   ${ch ? `<label><input type="radio" name="sc" value="ch" data-a="${chA}" data-z="${chZ}"> الفصل: ${esc(ch.t.slice(0, 40))}</label>` : ""}
   <label><input type="radio" name="sc" value="range"> نطاق صفحات</label>
   <label><input type="radio" name="sc" value="all"> ${b.set ? "المجلد كاملًا" : "الكتاب كاملًا"}${member ? "" : " (للأعضاء)"}</label></div>
  <div class="row"><div><label>من صفحة</label><input name="a" type="number" min="1" max="${n}" value="${c.p}"></div><div><label>إلى صفحة</label><input name="z" type="number" min="1" max="${n}" value="${c.p}"></div></div>
  <label>الصيغة</label><select name="f"><option value="pdf">PDF (طباعة بقالب)</option><option value="doc">Word</option><option value="epub">EPUB (كتاب إلكتروني)</option><option value="html">صفحة HTML</option><option value="md">Markdown</option><option value="txt">نص عادي</option></select>
  <div class="row"><div><label>القالب</label><select name="tpl">${Object.entries(EXT_TPL).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("")}</select></div><div><label>مقاس الصفحة (PDF)</label><select name="sz"><option value="A4">A4</option><option value="A5">A5 (كتاب)</option><option value="Letter">Letter</option></select></div></div>
  <label class="chk"><input type="checkbox" name="fn" checked> الحواشي</label><label class="chk"><input type="checkbox" name="toc" checked> فهرس في أول الملف</label><label class="chk"><input type="checkbox" name="pl" checked> أرقام صفحات الطبعة</label>
  ${typeof hasTash !== "function" || hasTash(b) || isArt(b) ? `<label class="chk"><input type="checkbox" name="tash"${S.tash ? " checked" : ""}> بالتشكيل${typeof origTash === "function" && (b.col || "dawah") !== "dawah" && origTash(b) ? " (تشكيل الطبعة)" : ""}</label>` : ""}
  <p class="mut">${member ? "" : "للزوار حتى ٥٠ صفحة في المرة؛ وللأعضاء الكتاب كاملًا."}</p>
  <button class="btn p">تصدير</button> <span id="expst" class="mut"></span></form>`);
}
async function expRun(f) {
  const c = cur(); if (!c) return; const b = c.b, n = b.pages.length, sc = f.sc.value;
  let a = c.p, z = c.p;
  if (sc === "ch") { const r = f.querySelector('input[value="ch"]'); a = +r.dataset.a; z = +r.dataset.z; }
  else if (sc === "range") { a = Math.max(1, +f.a.value || 1); z = Math.min(n, Math.max(a, +f.z.value || a)); }
  else if (sc === "all") { if (!Auth.user) return needLogin("تصدير الكتاب كاملًا متاح للأعضاء المسجلين مجانًا."); a = 1; z = n; }
  if (!Auth.user && z - a + 1 > 50) z = a + 49;
  if (f.tash && f.tash.checked !== !!S.tash) { S.tash = f.tash.checked; saveS(); if (typeof refreshPage === "function") refreshPage(); }
  const fm = f.f.value, tpl = EXT_TPL[f.tpl.value] || EXT_TPL.classic, opt = { fn: f.fn.checked, toc: f.toc.checked, pl: f.pl.checked };
  const au = A(b.authorId).name, title = b.setTitle ? b.title : b.title, safe = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + (a === 1 && z === n ? "" : ` (${a}-${z})`);
  const pages = []; for (let i = a; i <= z; i++) pages.push({ i, t: shownText(b, i - 1), l: PL(b, i - 1) || "ص " + i });
  const toc = (b.toc || []).filter(t => t.p >= a && t.p <= z);
  const foot = SITENAME + (CFG.siteUrl ? " — " + CFG.siteUrl : ""), src = b.source || "";
  if (fm === "txt") return dl(safe + ".txt", `${title}\n${au}\n\n` + pages.map(p => plain(opt.fn ? p.t : p.t.split(/^\s*_{4,}\s*$/m)[0]).trim() + (opt.pl ? `\n— ${p.l} —` : "")).join("\n\n") + `\n\n${foot}`, "text/plain");
  if (fm === "md") return dl(safe + ".md", `# ${title}\n\n**${au}**\n\n` + (opt.toc && toc.length ? "## الفهرس\n\n" + toc.map(t => `- ${t.t} (ص ${t.p})`).join("\n") + "\n\n" : "") + pages.map(p => p.t.replace(/^\s*_{4,}\s*$/m, "\n---\n").replace(/^#\s/gm, "### ") + (opt.pl ? `\n\n*— ${p.l} —*` : "")).join("\n\n") + `\n\n${foot}\n`, "text/markdown");
  const X = EXT.x.bind(EXT), tocH = opt.toc && toc.length ? `<nav class="toc"><h2>الفهرس</h2>${toc.map(t => `<p class="l${t.l || 1}"><a href="#p${t.p}">${X(t.t)}</a><span>${X(PL(b, t.p - 1) || t.p)}</span></p>`).join("")}</nav>` : "";
  const css = `@page{size:${f.sz.value};margin:18mm 16mm}body{font-size:16pt;line-height:2;max-width:760px;margin:auto;padding:16px;text-align:justify}h1{text-align:center;font-size:26pt}h2{text-align:center}.au{text-align:center;font-size:15pt}.pg{page-break-after:always;margin-bottom:24px}.pl{text-align:center;color:#888;font-size:11pt}p{margin:0 0 .35em;text-indent:1.2em}h3{text-align:center;font-size:17pt}.fn{border-top:1px solid #aaa;margin-top:10px;padding-top:6px;font-size:12pt;line-height:1.7}.fn p{text-indent:0}.toc p{display:flex;justify-content:space-between;text-indent:0;border-bottom:1px dotted #bbb}.toc .l2{padding-right:1.5em;font-size:.92em}.toc a{color:inherit;text-decoration:none}.foot{text-align:center;color:#888;font-size:11pt;margin-top:30px}${tpl.css}`;
  const body = pages.map(p => `<div class="pg" id="p${p.i}">${EXT.pageHtml(p.t, opt)}${opt.pl ? `<p class="pl">— ${X(p.l)} —</p>` : ""}</div>`).join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${X(title)}</title><style>${css}</style></head><body><h1>${X(title)}</h1><p class="au">${X(au)}</p>${src ? `<p class="pl">${X(src)}</p>` : ""}${tocH}${body}<p class="foot">${X(foot)}</p></body></html>`;
  if (fm === "html") return dl(safe + ".html", html, "text/html");
  if (fm === "doc") return dl(safe + ".doc", html, "application/msword");
  if (fm === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html + "<script>onload=()=>setTimeout(()=>print(),400)<\/script>"); w.document.close(); return; }
  if (fm === "epub") {
    const id = "urn:sdsl:" + b.id + ":" + a + "-" + z, chunks = []; let curC = null;
    pages.forEach(p => { const t = toc.find(x => x.p === p.i && (x.l || 1) === 1); if (!curC || (t && curC.pages.length) || curC.pages.length >= 40) { curC = { t: t ? t.t : (curC ? "تابع — " + p.l : "البداية"), pages: [] }; chunks.push(curC); } curC.pages.push(p); });
    const xh = (t, inner) => `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ar" lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${X(t)}</title><link rel="stylesheet" href="style.css"/></head><body>${inner}</body></html>`;
    const fix = h => h.replace(/<br>/g, "<br/>");
    const files = [["mimetype", "application/epub+zip"], ["META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
      ["OEBPS/style.css", `body{direction:rtl;text-align:justify;line-height:1.9;font-family:Amiri,serif}h1,h2,h3{text-align:center}p{text-indent:1.2em;margin:0 0 .3em}.fn{border-top:1px solid #999;font-size:.85em}.pl{text-align:center;color:#888;font-size:.8em}`],
      ["OEBPS/title.xhtml", xh(title, `<h1>${X(title)}</h1><p style="text-align:center">${X(au)}</p><p class="pl">${X(foot)}</p>`)]];
    chunks.forEach((ch, k) => files.push([`OEBPS/c${k + 1}.xhtml`, xh(ch.t, ch.pages.map(p => fix(EXT.pageHtml(p.t, opt)) + (opt.pl ? `<p class="pl">— ${X(p.l)} —</p>` : "")).join(""))]));
    files.push(["OEBPS/nav.xhtml", xh("الفهرس", `<nav epub:type="toc" id="toc"><h2>الفهرس</h2><ol><li><a href="title.xhtml">${X(title)}</a></li>${chunks.map((ch, k) => `<li><a href="c${k + 1}.xhtml">${X(ch.t)}</a></li>`).join("")}</ol></nav>`)]);
    files.push(["OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid" dir="rtl"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bid">${X(id)}</dc:identifier><dc:title>${X(title)}</dc:title><dc:creator>${X(au)}</dc:creator><dc:language>ar</dc:language><dc:publisher>${X(SITENAME)}</dc:publisher><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="t" href="title.xhtml" media-type="application/xhtml+xml"/>${chunks.map((ch, k) => `<item id="c${k + 1}" href="c${k + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine page-progression-direction="rtl"><itemref idref="t"/>${chunks.map((ch, k) => `<itemref idref="c${k + 1}"/>`).join("")}</spine></package>`]);
    return dl(safe + ".epub", EXT.zip(files));
  }
}
document.addEventListener("submit", async e => { const f = e.target.closest('[data-form="expx"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const st = $("#expst"); st.textContent = "جارٍ التجهيز…"; try { await expRun(f); st.textContent = "تم"; } catch (x) { st.textContent = x.message; } }, true);
document.addEventListener("change", e => { const r = e.target.closest('[data-form="expx"] input[name="sc"]'); if (!r) return; const f = r.form; if (r.value === "ch") { f.a.value = r.dataset.a; f.z.value = r.dataset.z; } else if (r.value === "all") { f.a.value = 1; f.z.value = f.a.max; } });
