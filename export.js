/* تصدير الكتب: الصفحة أو الفصل أو نطاق صفحات أو الكتاب كاملًا، بصيغ PDF (بقوالب ومقاسات) وWord وEPUB وHTML وMarkdown ونص،
   مع الحواشي والفهرس، والتشكيل بحسب اختيار القارئ. الكتاب كاملًا للأعضاء المسجلين؛ وللزوار حتى ٥٠ صفحة. والنص القابل للتحرير لأكثر من ٥٠ صفحة للمدير ومن فوّضه (export_text). */
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
// خيارات التنسيق عند التصدير: الخطوط والأحجام والألوان والتباعد والمحاذاة والصفحة، بقوالب جاهزة، وتُحفظ على الجهاز
const EXF = {
  fonts: ["Traditional Arabic", "Simplified Arabic", "Sakkal Majalla", "Arabic Typesetting", "Amiri", "Noto Naskh Arabic", "Scheherazade New", "Lateef", "Arial", "Times New Roman", "Tahoma", "Calibri", "Cairo", "Tajawal", "IBM Plex Sans Arabic", "Aref Ruqaa", "Reem Kufi"],
  presets: {
    lib: { n: "هوية المكتبة", font: "Traditional Arabic", hfont: "Traditional Arabic", bs: 15, h1: 17, h2: 15, h3: 14, fs: 11, cb: "#1d2622", c1: "#0f5c4d", c2: "#0f5c4d", ca: "#b88a2e", line: 1.5, jc: "both", ind: 1, page: "A4", mar: "normal", hb: 1, cover: 1 },
    classic: { n: "كلاسيكي تراثي", font: "Traditional Arabic", hfont: "Aref Ruqaa", bs: 16, h1: 20, h2: 17, h3: 15, fs: 12, cb: "#2a241a", c1: "#7a3e1d", c2: "#5a3f12", ca: "#b88a2e", line: 1.5, jc: "both", ind: 1, page: "A4", mar: "normal", hb: 1, cover: 1 },
    modern: { n: "حديث واضح", font: "Simplified Arabic", hfont: "Cairo", bs: 14, h1: 18, h2: 15, h3: 13, fs: 10, cb: "#14231f", c1: "#1f6f8b", c2: "#2f5e9e", ca: "#1f6f8b", line: 1.3, jc: "both", ind: 0, page: "A4", mar: "normal", hb: 1, cover: 1 },
    book: { n: "كتاب مطبوع (A5)", font: "Traditional Arabic", hfont: "Traditional Arabic", bs: 14, h1: 16, h2: 14, h3: 13, fs: 10, cb: "#000000", c1: "#000000", c2: "#000000", ca: "#555555", line: 1.15, jc: "both", ind: 1, page: "A5", mar: "narrow", hb: 1, cover: 1 },
    large: { n: "خط كبير مريح", font: "Sakkal Majalla", hfont: "Sakkal Majalla", bs: 20, h1: 24, h2: 21, h3: 19, fs: 14, cb: "#1d2622", c1: "#0f5c4d", c2: "#3c7a3b", ca: "#b88a2e", line: 1.6, jc: "right", ind: 0, page: "A4", mar: "wide", hb: 1, cover: 1 },
    plain: { n: "مسودة للتحرير", font: "Arial", hfont: "Arial", bs: 13, h1: 16, h2: 14, h3: 13, fs: 10, cb: "#000000", c1: "#000000", c2: "#000000", ca: "#000000", line: 1.15, jc: "right", ind: 0, page: "A4", mar: "normal", hb: 1, cover: 0 }
  },
  load() { try { return Object.assign({}, this.presets.lib, JSON.parse(localStorage.getItem("exp_fmt") || "{}")); } catch (e) { return Object.assign({}, this.presets.lib); } },
  save(o) { try { localStorage.setItem("exp_fmt", JSON.stringify(o)); } catch (e) { } },
  read(f) { const o = {}; ["font", "hfont", "cb", "c1", "c2", "ca", "jc", "page", "mar"].forEach(k => { if (f["x_" + k]) o[k] = f["x_" + k].value; }); ["bs", "h1", "h2", "h3", "fs", "line"].forEach(k => { if (f["x_" + k]) o[k] = +f["x_" + k].value; }); ["ind", "hb", "cover"].forEach(k => { if (f["x_" + k]) o[k] = f["x_" + k].checked ? 1 : 0; }); return o; },
  html(o) { const sel = (k, L) => `<select name="x_${k}">${L.map(([v, t]) => `<option value="${esc(v)}"${String(o[k]) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`, ff = this.fonts.map(f => [f, f]), num = (k, a, b, st) => `<input name="x_${k}" type="number" min="${a}" max="${b}" step="${st || 1}" value="${o[k]}" style="width:5em">`, col = k => `<input name="x_${k}" type="color" value="${esc(o[k])}">`;
    return `<details class="expfmt"><summary>🎨 خيارات التنسيق (الخطوط والألوان والأحجام)</summary>
     <div class="chips">${Object.entries(this.presets).map(([k, v]) => `<button type="button" class="chip" data-expp="${k}">${esc(v.n)}</button>`).join("")}</div>
     <div class="expgrid">
      <label>خط النص ${sel("font", ff)}</label><label>حجمه ${num("bs", 9, 30)} نقطة</label><label>لونه ${col("cb")}</label>
      <label>خط العناوين ${sel("hfont", ff)}</label><label class="inl"><input type="checkbox" name="x_hb"${o.hb ? " checked" : ""}> عناوين عريضة</label><span></span>
      <label>العنوان الرئيسي ${num("h1", 10, 40)} نقطة</label><label>لونه ${col("c1")}</label><span></span>
      <label>العنوان الفرعي ${num("h2", 9, 34)} نقطة</label><label>لونه ${col("c2")}</label><label>عنوان ثالث ${num("h3", 9, 30)}</label>
      <label>الحواشي ${num("fs", 8, 20)} نقطة</label><label>لون الزخرفة ${col("ca")}</label><span></span>
      <label>تباعد الأسطر ${sel("line", [[1, "مفرد"], [1.15, "١٫١٥"], [1.3, "١٫٣"], [1.5, "١٫٥"], [1.6, "١٫٦"], [2, "مزدوج"]])}</label><label>المحاذاة ${sel("jc", [["both", "ضبط الطرفين"], ["right", "إلى اليمين"], ["center", "توسيط"]])}</label><label class="inl"><input type="checkbox" name="x_ind"${o.ind ? " checked" : ""}> مسافة أول السطر</label>
      <label>الصفحة ${sel("page", [["A4", "A4"], ["A5", "A5 (كتاب)"], ["B5", "B5"], ["Letter", "Letter"]])}</label><label>الهوامش ${sel("mar", [["narrow", "ضيقة"], ["normal", "عادية"], ["wide", "واسعة"]])}</label><label class="inl"><input type="checkbox" name="x_cover"${o.cover ? " checked" : ""}> غلاف بالشعار</label>
     </div><p class="mut">صفحة بيانات النسخة وحقوق المكتبة تُضاف دائمًا. والخطوط تظهر كما اخترتها إن كانت مثبتة على الجهاز الذي يُفتح عليه الملف.</p></details>`; },
  css(o) { const fam = f => `"${f}",'Traditional Arabic',Amiri,serif`; return `body{font-family:${fam(o.font)}!important;font-size:${o.bs}pt!important;line-height:${o.line * 1.33}!important;color:${o.cb}!important;text-align:${o.jc === "both" ? "justify" : o.jc}!important}p{text-indent:${o.ind ? "1.2em" : "0"}!important}h1,h2,h3,.toc h2{font-family:${fam(o.hfont)}!important;font-weight:${o.hb ? 700 : 400}!important}h1{font-size:${o.h1 + 8}pt!important;color:${o.c1}!important;background:none!important}h2{font-size:${o.h1}pt!important;color:${o.c1}!important}h3{font-size:${o.h2}pt!important;color:${o.c2}!important;border-color:${o.ca}!important}.fn{font-size:${o.fs}pt!important}@page{size:${o.page};margin:${{ narrow: "12mm", normal: "18mm", wide: "25mm" }[o.mar] || "18mm"}}`; }
};
document.addEventListener("click", e => { const b = e.target.closest("[data-expp]"); if (!b) return; const f = b.closest("form"), o = EXF.presets[b.dataset.expp]; if (!f || !o) return;
  Object.entries(o).forEach(([k, v]) => { const el = f["x_" + k]; if (!el) return; if (el.type === "checkbox") el.checked = !!v; else el.value = v; }); toast("طُبّق قالب «" + o.n + "»"); });
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
  <label>الصيغة</label><select name="f"><option value="pdf">PDF (طباعة بقالب)</option><option value="docx" data-tx="1">Word منسّق (DOCX) — النص المدقق قابلًا للتحرير</option><option value="doc" data-tx="1">Word (نسخة مبسطة)</option><option value="epub">EPUB (كتاب إلكتروني)</option><option value="html" data-tx="1">صفحة HTML</option><option value="md" data-tx="1">Markdown</option><option value="txt" data-tx="1">نص عادي</option></select><p class="mut" id="extxn" hidden>صيغ النص القابل للتحرير (Word وغيرها) للإدارة ومن تمنحه الإدارة صلاحية «تنزيل النص».</p>
  <div class="row"><div><label>القالب</label><select name="tpl">${Object.entries(EXT_TPL).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("")}</select></div><div><label>مقاس الصفحة (PDF)</label><select name="sz"><option value="A4">A4</option><option value="A5">A5 (كتاب)</option><option value="Letter">Letter</option></select></div></div>
  ${EXF.html(EXF.load())}
  <label class="chk"><input type="checkbox" name="fn" checked> الحواشي</label><label class="chk"><input type="checkbox" name="toc" checked> فهرس في أول الملف</label><label class="chk"><input type="checkbox" name="pl" checked> أرقام صفحات الطبعة</label>
  ${typeof hasTash !== "function" || hasTash(b) || isArt(b) ? `<label class="chk"><input type="checkbox" name="tash"${S.tash ? " checked" : ""}> بالتشكيل${typeof origTash === "function" && (b.col || "dawah") !== "dawah" && origTash(b) ? " (تشكيل الطبعة)" : ""}</label>` : ""}
  <p class="mut">${member ? "" : "للزوار حتى ٥٠ صفحة في المرة؛ وللأعضاء الكتاب كاملًا."}</p>
  <button class="btn p">تصدير</button> <span id="expst" class="mut"></span></form>`);
  // النص القابل للتحرير للإدارة ومن تأذن له وحدهم: تُخفى صيغه عن غيرهم
  (async () => { const ok = typeof GRP !== "undefined" && await GRP.can("export_text"); const sel = document.querySelector("form.expx [name=f]"); if (!sel) return;
    if (!ok) { sel.querySelectorAll("[data-tx]").forEach(o => o.remove()); const n = $("#extxn"); if (n) n.hidden = false; } else sel.value = "docx"; })();
}
async function expRun(f) {
  const c = cur(); if (!c) return; const b = c.b, n = b.pages.length, sc = f.sc.value;
  let a = c.p, z = c.p;
  if (sc === "ch") { const r = f.querySelector('input[value="ch"]'); a = +r.dataset.a; z = +r.dataset.z; }
  else if (sc === "range") { a = Math.max(1, +f.a.value || 1); z = Math.min(n, Math.max(a, +f.z.value || a)); }
  else if (sc === "all") { if (!Auth.user) return needLogin("تصدير الكتاب كاملًا متاح للأعضاء المسجلين مجانًا."); a = 1; z = n; }
  if (!Auth.user && z - a + 1 > 50) z = a + 49;
  // النص القابل للتحرير (غير PDF) لأكثر من ٥٠ صفحة: للمدير ومن فوّضه (صلاحية export_text)؛ ويبقى PDF للأعضاء
  if (["docx", "doc", "html", "md", "txt"].includes(f.f.value) && !(typeof GRP !== "undefined" && await GRP.can("export_text"))) { const st = $("#expst"); if (st) st.textContent = "تنزيل النص القابل للتحرير متاح للإدارة ومن تمنحه الإدارة هذه الصلاحية؛ اختر PDF أو EPUB، أو اطلب الصلاحية من الإدارة."; return; }
  if (f.tash && f.tash.checked !== !!S.tash) { S.tash = f.tash.checked; saveS(); if (typeof refreshPage === "function") refreshPage(); }
  const fm = f.f.value, tpl = EXT_TPL[f.tpl.value] || EXT_TPL.classic, opt = { fn: f.fn.checked, toc: f.toc.checked, pl: f.pl.checked };
  const fmt = Object.assign(EXF.load(), EXF.read(f)); EXF.save(fmt);
  const au = A(b.authorId).name, title = b.setTitle ? b.title : b.title, safe = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + (a === 1 && z === n ? "" : ` (${a}-${z})`);
  const pages = []; for (let i = a; i <= z; i++) pages.push({ i, t: shownText(b, i - 1), l: PL(b, i - 1) || "ص " + i });
  const toc = (b.toc || []).filter(t => t.p >= a && t.p <= z);
  const foot = SITENAME + (CFG.siteUrl ? " — " + CFG.siteUrl : ""), src = b.source || "";
  if (fm === "txt") return dl(safe + ".txt", `${title}\n${au}\n\n` + pages.map(p => plain(opt.fn ? p.t : p.t.split(/^\s*_{4,}\s*$/m)[0]).trim() + (opt.pl ? `\n— ${p.l} —` : "")).join("\n\n") + `\n\n${foot}`, "text/plain");
  if (fm === "md") return dl(safe + ".md", `# ${title}\n\n**${au}**\n\n` + (opt.toc && toc.length ? "## الفهرس\n\n" + toc.map(t => `- ${t.t} (ص ${t.p})`).join("\n") + "\n\n" : "") + pages.map(p => p.t.replace(/^\s*_{4,}\s*$/m, "\n---\n").replace(/^#\s/gm, "### ") + (opt.pl ? `\n\n*— ${p.l} —*` : "")).join("\n\n") + `\n\n${foot}\n`, "text/markdown");
  const X = EXT.x.bind(EXT), tocH = opt.toc && toc.length ? `<nav class="toc"><h2>الفهرس</h2>${toc.map(t => `<p class="l${t.l || 1}"><a href="#p${t.p}">${X(t.t)}</a><span>${X(PL(b, t.p - 1) || t.p)}</span></p>`).join("")}</nav>` : "";
  const css = `@page{size:${f.sz.value};margin:18mm 16mm}body{font-size:16pt;line-height:2;max-width:760px;margin:auto;padding:16px;text-align:justify}h1{text-align:center;font-size:26pt}h2{text-align:center}.au{text-align:center;font-size:15pt}.pg{page-break-after:always;margin-bottom:24px}.pl{text-align:center;color:#888;font-size:11pt}p{margin:0 0 .35em;text-indent:1.2em}h3{text-align:center;font-size:17pt}.fn{border-top:1px solid #aaa;margin-top:10px;padding-top:6px;font-size:12pt;line-height:1.7}.fn p{text-indent:0}.toc p{display:flex;justify-content:space-between;text-indent:0;border-bottom:1px dotted #bbb}.toc .l2{padding-right:1.5em;font-size:.92em}.toc a{color:inherit;text-decoration:none}.foot{text-align:center;color:#888;font-size:11pt;margin-top:30px}${tpl.css}`;
  const body = pages.map(p => `<div class="pg" id="p${p.i}">${EXT.pageHtml(p.t, opt)}${opt.pl ? `<p class="pl">— ${X(p.l)} —</p>` : ""}</div>`).join("");
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${X(title)}</title><style>${css}${EXF.css(fmt)}</style></head><body><h1>${X(title)}</h1><p class="au">${X(au)}</p>${src ? `<p class="pl">${X(src)}</p>` : ""}${tocH}${body}<p class="foot">${X(foot)}</p></body></html>`;
  if (fm === "html") return dl(safe + ".html", html, "text/html");
  if (fm === "doc") return dl(safe + ".doc", html, "application/msword");
  if (fm === "docx") { const st = $("#expst"); if (st) st.textContent = "جارٍ إعداد ملف Word…";
    const nm = (Auth.user && ((Auth.user.user_metadata || {}).name || (Auth.user.user_metadata || {}).full_name || Auth.user.email)) || "";
    const blob = await DOCX.build({ fmt, title, author: au, pages, toc: toc.map(t => Object.assign({}, t, { pl: PL(b, t.p - 1) || "" })), opt, url: siteLink("#/book/" + b.id), src, who: nm, site: SITENAME, siteUrl: (CFG.siteUrl || "https://dawahlibrary.org").replace(/^https?:\/\//, "").replace(/\/+$/, "") });
    if (st) st.textContent = ""; return dl(safe + ".docx", blob, blob.type); }
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
