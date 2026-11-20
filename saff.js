/* صف التفريغ (#/saff و#/saff/<id>): إخراج التفريغ كتابًا مصفوفًا للطباعة على طريقة إصدارات دور النشر.
   - النص: كما أُلقي، أو «منسَّق ومدقَّق»، أو «بأسلوب كتابي» (data/tfedit، من خدمة تنسيق التفريغ للقراءة #/tahrir).
   - الضبط: توحيد المسافات وعلامات الترقيم والأقواس وعلامات التنصيص، ووصل الجملة المقطوعة بين صفحات الأصل، وحذف العناوين المكررة.
   - الصف: غلاف، وصفحة بيانات وحقوق، وتنبيه التحرير، وفهرس بأرقام صفحاته الحقيقية (أول الكتاب أو آخره)، وفصول تبدأ بصفحة جديدة،
     وعناوين جارية (اسم الكتاب / الفصل)، وترقيم صفحات بالأرقام العربية، وحواشٍ أسفل صفحاتها، وضبط الطرفين، ومنع الأسطر اليتيمة.
   يُصف في نافذة مستقلة بمكتبة Paged.js (vendor/paged.polyfill.min.js، رخصة MIT) ثم «طباعة / حفظ PDF»؛ وWord المصفوف للإدارة ومن تأذن له. */
const SAFF = (() => {
  const RAWD = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Math.floor(Date.now() / 300e3);
  const getJ = async p => { for (const u of [RAWD(p), "data/" + p]) { try { const r = await fetch(u, { cache: "no-cache" }); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const TF = new Map(), tf = id => (TF.has(id) || TF.set(id, getJ("tfedit/" + id + ".json")), TF.get(id));
  const SZ = { A5: ["148mm 210mm", "A5 (١٤٫٨×٢١ سم) — الكتاب الصغير"], B5: ["170mm 240mm", "١٧×٢٤ سم — مقاس الكتب الشائع"], A4: ["210mm 297mm", "A4 (٢١×٢٩٫٧ سم)"] };
  const FONTS = [["Amiri", "أميري (نسخ كلاسيكي)"], ["Noto Naskh Arabic", "نوتو نسخ"], ["Scheherazade New", "شهرزاد"], ["Traditional Arabic", "Traditional Arabic (إن كان مثبتًا)"]];
  const DEF = { src: "f", size: "B5", font: "Amiri", fs: 14, lh: 1.85, chap: "page", toc: "start", hdr: 1, cover: 1, rights: 1, clean: 1, fnum: "page" };
  const load = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem("saff_o") || "{}")); } catch (e) { return Object.assign({}, DEF); } };
  const save = o => { try { localStorage.setItem("saff_o", JSON.stringify(o)); } catch (e) { } };
  const X = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const AR = "٠١٢٣٤٥٦٧٨٩", dig = s => String(s).replace(/[٠-٩]/g, d => AR.indexOf(d));

  // ضبط النص: المسافات وعلامات الترقيم والأقواس والتنصيص
  function clean(t) {
    return String(t || "").replace(/\*\*/g, "").replace(/ـ+/g, "").replace(/[ \t ]+/g, " ")
      .replace(/(?<=[؀-ۿ])\s*,\s*(?=[؀-ۿ])/g, "، ").replace(/(?<=[؀-ۿ])\s*;\s*/g, "؛ ").replace(/(?<=[؀-ۿ])\s*\?/g, "؟")
      .replace(/\s+([،؛:.؟!)\]»﴾}])/g, "$1").replace(/([(\[«﴿{])\s+/g, "$1")
      .replace(/([،؛؟!])(?=[^\s\d)\]»﴾.،؛؟!"'…-])/g, "$1 ").replace(/(?<=[؀-ۿ])\.(?=[؀-ۿ])/g, ". ")
      .replace(/\.{3,}|…+/g, "…").replace(/"([^"\n]{1,300})"/g, "«$1»").replace(/ {2,}/g, " ").trim();
  }
  // نص الصفحة وحواشيها من الأصل: الحواشي بعد سطر ____ بأرقام (١) أو [١]
  function splitFn(t) {
    t = String(t || ""); const cut = t.search(/^\s*_{4,}\s*$/m); if (cut < 0) return { body: t, fn: {} };
    const fn = {}; let last = null;
    t.slice(cut).replace(/^\s*_{4,}\s*\n?/, "").split("\n").forEach(l => { const m = l.match(/^\s*[(\[]([0-9٠-٩]{1,3})[)\]]\s*[-–:]?\s*(.*)$/) || l.match(/^\s*([0-9٠-٩]{1,3})\s*[-–:.]?\s+(\D.*)$/); if (m) { last = dig(m[1]); fn[last] = m[2].trim(); } else if (last && l.trim()) fn[last] += " " + l.trim(); });
    return { body: t.slice(0, cut), fn };
  }
  // فصول الكتاب من صفحات التفريغ
  function chapters(b, d, o) {
    const n = b.pages.length, chs = []; let cur = { t: "", p: 1, ps: [] };
    const norm0 = s => (typeof norm === "function" ? norm(s) : s);
    for (let i = 1; i <= n; i++) {
      const e = d && d.pages && d.pages[String(i)], useEd = o.src !== "o" && e && (e[o.src] || e.f);
      const { body, fn } = useEd ? { body: e[o.src] || e.f, fn: {} } : splitFn(b.pages[i - 1]);
      const txt = typeof joinLines === "function" && !useEd ? joinLines(body) : body, used = new Set();
      String(txt).split(/\n+/).map(l => l.trim()).filter(Boolean).forEach((l, k) => {
        const hm = l.match(/^(#{1,3})\s+(.*)$/);
        if (hm) { const h = clean(hm[2]).replace(/[:：]$/, ""); if (!h) return;
          if (hm[1].length > 1) { cur.ps.push({ h, p: i }); return; }
          if (norm0(h) === norm0(cur.t || "") || chs.some(c => norm0(c.t) === norm0(h) && c.p >= i - 1)) return; // عنوان مكرر في رأس الصفحة
          if (cur.ps.length || cur.t) chs.push(cur); cur = { t: h, p: i, ps: [] }; return; }
        let s = o.clean ? clean(l) : l;
        // علامات الحواشي في المتن: كل علامة لها حاشية تُستبدل مرة واحدة
        const fns = []; s = s.replace(/\s?[(\[]([0-9٠-٩]{1,3})[)\]]/g, (m, g) => { const kx = dig(g); if (fn[kx] == null || used.has(kx)) return m; used.add(kx); fns.push(o.clean ? clean(fn[kx]) : fn[kx]); return "\u0001" + (fns.length - 1) + "\u0002"; });
        const last = cur.ps[cur.ps.length - 1];
        if (k === 0 && last && last.t != null && !/[.؟!:»)\]﴿﴾…]$/.test(last.t)) { const off = last.f.length; last.t += " " + s.replace(/\u0001(\d+)\u0002/g, (m, g) => "\u0001" + (+g + off) + "\u0002"); last.f.push(...fns); return; } // وصل الجملة المقطوعة بين صفحتين
        cur.ps.push({ t: s, f: fns, p: i });
      });
    }
    if (cur.ps.length || cur.t) chs.push(cur);
    for (let i = chs.length - 1; i > 0; i--) if (!chs[i - 1].ps.length && chs[i - 1].t && chs[i].t) { chs[i].t = chs[i - 1].t + " — " + chs[i].t; chs[i].p = chs[i - 1].p; chs.splice(i - 1, 1); } // عنوان بلا نص يُضم إلى ما بعده
    // الفصل الحقيقي: عناوين الدروس والمجالس والأبواب إن وُجدت (وما سواها عنوان فرعي في سياقه)؛ وإن كثرت العناوين بلا دروس اتصل النص بلا صفحات جديدة
    const LES = /^(?:ال)?(?:درس|مجلس|محاضرة|حلقة|لقاء|باب|فصل|شريط|مقدمة|خاتمة|كتاب)\b|^(?:الدرس|المجلس|المحاضرة|الحلقة|اللقاء)\s/;
    const les = chs.filter(c => LES.test(c.t || ""));
    if (les.length >= 2) { const out = []; chs.forEach(c => { if (!out.length || LES.test(c.t || "")) out.push(c); else { const l = out[out.length - 1]; if (c.t) l.ps.push({ h: c.t, p: c.p }); l.ps.push(...c.ps); } }); chs.length = 0; chs.push(...out); }
    const dense = les.length < 2 && chs.length > Math.max(3, n / 4);
    return chs.map((c, i) => Object.assign(c, { t: c.t || (i === 0 ? "تمهيد" : "تابع"), id: "c" + (i + 1), lv: dense ? 0 : 1 }));
  }
  // فقرة مصفوفة: الآيات بخط المصحف، والحواشي في مواضعها
  const para = x => X(x.t).replace(/﴿[^﴾]{1,900}﴾/g, m => `<span class="q">${m}</span>`).replace(/\u0001(\d+)\u0002/g, (m, g) => `<span class="fn">${X(x.f[+g] || "")}</span>`);

  function bookHtml(b, d, o, chs) {
    const a = A(b.authorId), title = b.setTitle || b.title, kind = { o: "تفريغ الدروس كما أُلقيت", f: "تفريغ منسَّق ومدقَّق", r: "تفريغ محرَّر بأسلوب كتابي" }[o.src];
    const org = location.origin, date = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }), url = typeof siteLink === "function" ? siteLink("#/book/" + b.id) : org + "/book/" + b.id;
    const toc = `<section class="toc"><h2 class="fh">الفهرس</h2><ol>${chs.map(c => `<li><a href="#${c.id}"><span>${X(c.t)}</span><span class="dl"></span><span class="pn"></span></a></li>`).join("")}</ol></section>`;
    return `${o.cover ? `<section class="cover"><div class="cv-site"><img src="${org}/assets/logo-sdsl.png" alt=""><p>${X(SITENAME)}</p></div><div class="cv-mid"><h1>${X(title)}</h1><p class="cv-kind">${X(kind)}</p></div><div class="cv-au"><p>${X(a.name || "")}</p></div></section>` : ""}
${o.rights ? `<section class="rights"><h1 class="rt">${X(title)}</h1><p class="rau">${X(a.name || "")}</p><dl>
  <dt>أصل الكتاب</dt><dd>${X(b.source || "تفريغ دروس صوتية")}</dd><dt>نوع النص</dt><dd>${X(kind)}</dd><dt>الصف والإخراج</dt><dd>${X(SITENAME)} — خدمة «صف التفريغ»</dd><dt>تاريخ الصف</dt><dd>${X(date)}</dd><dt>رابط النسخة</dt><dd dir="ltr">${X(url)}</dd></dl>
  <p class="rnote">الحقوق محفوظة لأصحابها. يُؤذن بطباعة هذه النسخة ونشرها لغرض دعوي غير تجاري، مع ذكر المصدر وعدم التغيير في النص.</p></section>` : ""}
${o.src !== "o" ? `<section class="note"><h2 class="fh">تنبيه</h2><p>${o.src === "r" ? "هذه النسخة صياغة كتابية أعدّتها المكتبة لكلام الشيخ في دروسه المفرّغة، بلا زيادة في المعنى ولا نقص ولا تغيير لرأي أو ترجيح، مع حذف ما لا يناسب الكتابة من التكرار والاستطراد الشفهي؛ فالعبارات عبارات المكتبة والمضمون مضمون الشيخ، ويُرجع إلى النص كما أُلقي عند النقل الحرفي." : "هذه النسخة ألفاظ الشيخ نفسها بعد تصحيح أخطاء التفريغ الظاهرة، ووضع علامات الترقيم والفقرات والعناوين، وحذف الحشو الكلامي والتكرار اللفظي الذي لا يضيف معنى."}</p></section>` : ""}
${o.toc === "start" ? toc : ""}
${chs.map((c, i) => `<section class="chap${i ? "" : " first"}${c.lv ? "" : " sub"}" id="${c.id}">${i ? "" : `<span class="bt">${X(title)}</span>`}<h2 class="ct">${X(c.t)}</h2>${c.ps.map(x => x.h ? `<h3>${X(x.h)}</h3>` : `<p>${para(x)}</p>`).join("")}</section>`).join("\n")}
${o.toc === "end" ? toc : ""}
<section class="colo"><p class="end">تم بحمد الله وتوفيقه</p><p>${X(SITENAME)} • ${X(org.replace(/^https?:\/\//, ""))}</p></section>`;
  }
  function bookCss(o) {
    const [size] = SZ[o.size] || SZ.B5, m = o.size === "A4" ? "22mm 20mm 24mm 20mm" : o.size === "A5" ? "17mm 14mm 19mm 14mm" : "20mm 17mm 22mm 17mm";
    const ff = `"${o.font}","Amiri","Traditional Arabic",serif`, small = Math.max(9, o.fs - 4);
    return `@page{size:${size};margin:${m};@footnote{border-top:.5pt solid #000;margin-top:3mm;padding-top:1.5mm}
  ${o.hdr ? `@top-center{content:string(ch);font-family:${ff};font-size:${small}pt;color:#333;border-bottom:.5pt solid #555;padding-bottom:1mm;vertical-align:bottom;width:100%}` : ""}
  @bottom-center{content:counter(page,arabic-indic);font-family:${ff};font-size:${small + 1}pt}}
${o.hdr ? `@page:left{@top-center{content:string(bt)}}` : ""}
@page cover{margin:0;@top-center{content:none;border:0}@bottom-center{content:none}}
@page front{@top-center{content:none;border:0}@bottom-center{content:none}}
@page:blank{@top-center{content:none;border:0}@bottom-center{content:none}}
html{direction:rtl}.pagedjs_page_content{direction:ltr}.pagedjs_page_content>div{direction:rtl}body{font-family:${ff};font-size:${o.fs}pt;line-height:${o.lh};color:#000;text-align:justify;font-kerning:normal}
.bt{string-set:bt content(text);display:none}
.cover{page:cover;break-after:page;height:${(SZ[o.size] || SZ.B5)[0].split(" ")[1]};display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;padding:22mm 14mm;box-sizing:border-box;border:3mm double #0f5c4d;background:#fbf8f0}
.cv-site img{width:26mm}.cv-site p{margin:2mm 0 0;color:#0f5c4d;font-size:${small + 2}pt}.cover h1{font-size:${o.fs + 16}pt;line-height:1.5;color:#0f5c4d;margin:0 0 5mm}.cv-kind{color:#7a5a1a;font-size:${o.fs}pt}.cv-au p{font-size:${o.fs + 5}pt;font-weight:700}
.rights,.note,.toc{page:front;break-after:page}.rights{display:flex;flex-direction:column;justify-content:flex-end;font-size:${small + 1}pt;line-height:1.7}.rt{font-size:${o.fs + 4}pt;text-align:center;margin:0}.rau{text-align:center;margin:0 0 8mm}
.rights dl{display:grid;grid-template-columns:auto 1fr;gap:1mm 4mm;border-top:.5pt solid #000;border-bottom:.5pt solid #000;padding:3mm 0;margin:0}.rights dt{font-weight:700}.rights dd{margin:0}.rnote{font-size:${small}pt;text-align:center;margin-top:4mm}
.fh{text-align:center;font-size:${o.fs + 4}pt;margin:0 0 6mm}
.toc ol{list-style:none;padding:0;margin:0}.toc li{margin:0 0 1.5mm;break-inside:avoid}.toc a{color:#000;text-decoration:none;display:flex;align-items:baseline}.toc .dl{flex:1;border-bottom:1.2pt dotted #555;margin:0 2mm;min-width:8mm}.toc .pn{min-width:6mm;text-align:left}
.chap{break-before:${o.chap === "right" ? "right" : o.chap === "page" ? "page" : "auto"}}.chap.first{break-before:page}
.chap.sub:not(.first){break-before:auto}.chap.sub .ct{margin-top:8mm}
.ct{string-set:ch content(text);text-align:center;font-size:${o.fs + 5}pt;line-height:1.5;margin:${o.chap === "cont" ? "8mm" : "14mm"} 0 7mm;padding-bottom:2.5mm;border-bottom:.8pt solid #000;break-after:avoid}
h3{font-size:${o.fs + 1.5}pt;margin:4mm 0 1.5mm;break-after:avoid;text-align:right}
p{margin:0;text-indent:1.4em;orphans:2;widows:2}h2+p,h3+p{text-indent:0}
section[data-align-last-split-element],div[data-align-last-split-element],h2,h3,.ct{text-align-last:auto!important}
.q{font-family:"Amiri Quran","Amiri",serif;font-size:.97em}
.fn{float:footnote;font-size:${small + 1}pt;line-height:1.55;text-indent:0;text-align:justify}
.fn::footnote-call{content:"(" counter(footnote,arabic-indic) ")";font-size:.72em;vertical-align:super;line-height:0}
.fn::footnote-marker{content:"(" counter(footnote-marker,arabic-indic) ") "}
[data-footnote-call]::after{content:"(" attr(data-n) ")"!important}[data-note=footnote]::marker{content:"(" attr(data-n) ") "!important}
.colo{text-align:center;margin-top:12mm;font-size:${small + 1}pt}.colo .end{font-size:${o.fs + 2}pt;font-weight:700}`;
  }
  // نافذة الصف: Paged.js يقسم النص صفحات ثم يظهر شريط «طباعة / حفظ PDF»
  function preview(b, o, html, w) {
    w = w || window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
    const org = location.origin, fam = "family=Amiri:ital,wght@0,400;0,700;1,400&family=Amiri+Quran&family=Noto+Naskh+Arabic:wght@400;700&family=Scheherazade+New:wght@400;700";
    w.document.open(); w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${X(b.setTitle || b.title)} — صف للطباعة</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fam}&display=block"><style>${bookCss(o)}</style>
<script src="${org}/saffp.js"><\/script><script src="${org}/vendor/paged.polyfill.min.js"><\/script></head><body data-fnum="${o.fnum}">${html}</body></html>`); w.document.close();
  }
  // Word مصفوف (للإدارة ومن تأذن له): الفصول صفحات، والحواشي في مواضعها
  async function word(b, o, chs) {
    if (typeof DOCX === "undefined") throw new Error("أداة Word غير محمّلة");
    const pages = chs.map((c, i) => { const fl = []; const body = c.ps.map(x => x.h ? "## " + x.h : x.t.replace(/\u0001(\d+)\u0002/g, (m, g) => { fl.push(x.f[+g] || ""); return "(" + fl.length + ")"; })).join("\n");
      return { i: i + 1, t: "# " + c.t + "\n" + body + (fl.length ? "\n_____\n" + fl.map((f, k) => "(" + (k + 1) + ") " + f).join("\n") : ""), l: "" }; });
    const fmt = Object.assign({}, typeof EXF !== "undefined" ? EXF.presets.book : {}, { font: o.font, hfont: o.font, bs: o.fs, page: o.size === "B5" ? "B5" : o.size, line: o.lh > 1.7 ? 1.5 : 1.3, cover: o.cover ? 1 : 0 });
    const nm = (Auth.user && ((Auth.user.user_metadata || {}).name || Auth.user.email)) || "";
    const blob = await DOCX.build({ fmt, title: b.setTitle || b.title, author: A(b.authorId).name, pages, toc: o.toc ? chs.map((c, i) => ({ t: c.t, p: i + 1, l: 1, pl: "" })) : [], opt: { fn: true, toc: !!o.toc, pl: false },
      url: typeof siteLink === "function" ? siteLink("#/book/" + b.id) : "", src: b.source || "", who: nm, site: SITENAME, siteUrl: (CFG.siteUrl || "https://dawahlibrary.org").replace(/^https?:\/\//, "").replace(/\/+$/, "") });
    dl((b.setTitle || b.title).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + " (مصفوف).docx", blob, blob.type);
  }

  async function page(q, id) {
    const b0 = B(id); if (!b0) return view('<p class="note">التفريغ غير موجود. <a href="#/saff">← صف التفريغ</a></p>');
    view('<p class="mut" style="padding:30px;text-align:center">جارٍ تحميل التفريغ…</p>');
    let b; try { b = await loadBook(id); } catch (e) { return view(`<p class="note">${esc(e.message)}</p>`); }
    const d = await tf(id), has = !!(d && d.pages && Object.keys(d.pages).length), o = load(); if (!has && o.src !== "o") o.src = "o";
    const ed = has ? Object.keys(d.pages).length : 0, n = b.pages.length, title = b.setTitle || b.title;
    const sel = (k, L) => `<select name="${k}">${L.map(([v, t]) => `<option value="${v}"${String(o[k]) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    const chk = (k, t) => `<label class="inl"><input type="checkbox" name="${k}"${o[k] ? " checked" : ""}> ${t}</label>`;
    view(`<p><a href="#/saff">← صف التفريغ</a> • <a href="#/book/${esc(id)}/1">التفريغ في القارئ</a>${has ? ` • <a href="#/tfbook/${esc(id)}">النسخة المحررة للقراءة</a>` : ""}</p>
     <section class="saff"><h1>صف «${esc(title)}» للطباعة</h1><p class="mut">${esc(A(b.authorId).name || "")} • ${toAr(n)} صفحة في الأصل${has ? ` • جاهز منه للتنسيق ${toAr(ed)} صفحة` : " • لم يُجهَّز تنسيقه بعد، فيُصف كما أُلقي"}</p>
     <form data-form="saff" class="saffform" data-id="${esc(id)}">
      <fieldset><legend>النص</legend><div class="seg">${[["f", "منسَّق ومدقَّق"], ["r", "بأسلوب كتابي"], ["o", "كما أُلقي"]].map(([v, t]) => `<label><input type="radio" name="src" value="${v}"${o.src === v ? " checked" : ""}${v !== "o" && !has ? " disabled" : ""}> ${t}</label>`).join("")}</div>${chk("clean", "ضبط النص: المسافات وعلامات الترقيم والأقواس والتنصيص")}</fieldset>
      <fieldset><legend>الصفحة والخط</legend><div class="row"><div><label>مقاس الكتاب</label>${sel("size", Object.entries(SZ).map(([k, v]) => [k, v[1]]))}</div><div><label>الخط</label>${sel("font", FONTS)}</div></div>
       <div class="row"><div><label>حجم خط المتن</label>${sel("fs", [12, 13, 14, 15, 16, 18].map(v => [v, toAr(v) + " نقطة"]))}</div><div><label>تباعد الأسطر</label>${sel("lh", [[1.6, "متقارب"], [1.85, "معتدل"], [2.1, "واسع"]])}</div></div></fieldset>
      <fieldset><legend>الإخراج</legend><div class="row"><div><label>بداية الفصل</label>${sel("chap", [["page", "صفحة جديدة"], ["right", "صفحة فردية (كالمطبوعات)"], ["cont", "متصل"]])}</div><div><label>الفهرس</label>${sel("toc", [["start", "أول الكتاب"], ["end", "آخر الكتاب"], ["", "بلا فهرس"]])}</div></div>
       <div class="row"><div><label>ترقيم الحواشي</label>${sel("fnum", [["page", "يبدأ مع كل صفحة"], ["all", "متصل"]])}</div><div></div></div>
       ${chk("cover", "غلاف بالشعار")} ${chk("rights", "صفحة البيانات والحقوق")} ${chk("hdr", "عناوين جارية أعلى الصفحات")}</fieldset>
      <button class="btn p" data-saff="pdf">${ic("printer", 18)} معاينة الصف وطباعته (PDF)</button> <button class="btn" data-saff="docx" hidden>Word مصفوف</button> <span class="mut" id="saffst"></span>
      <p class="mut">تُفتح نافذة يُقسَّم فيها الكتاب صفحاتٍ بعناوينها الجارية وأرقامها وحواشيها، ثم اختر «طباعة / حفظ PDF» واحفظه بصيغة PDF${n > 300 ? "، وقد يستغرق الكتاب الكبير دقيقة أو أكثر" : ""}.</p></form></section>`);
    if (typeof GRP !== "undefined" && await GRP.can("export_text")) { const x = document.querySelector('[data-saff="docx"]'); if (x) x.hidden = false; }
  }
  function read(f) {
    const o = load(); ["src", "size", "font", "chap", "toc", "fnum"].forEach(k => { const el = f.elements[k]; if (el) o[k] = el.value; });
    o.fs = +f.fs.value || 14; o.lh = +f.lh.value || 1.85; ["clean", "cover", "rights", "hdr"].forEach(k => o[k] = f[k].checked ? 1 : 0); save(o); return o;
  }
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-saff]"); if (!btn) return; e.preventDefault(); const f = btn.closest("form"), id = f.dataset.id, st = $("#saffst");
    const b = B(id); if (!b || !b.pages) return; if (!Auth.user && b.pages.length > 50) return needLogin("صف التفريغات الطويلة متاح للأعضاء المسجلين مجانًا.");
    const o = read(f), w = btn.dataset.saff === "pdf" ? window.open("", "_blank") : null; // تُفتح النافذة مع النقرة لئلا يمنعها المتصفح
    try { st.textContent = "جارٍ التجهيز…"; const d = await tf(id), chs = chapters(b, d, o); if (!chs.length) throw new Error("لا نص في هذا التفريغ");
      if (btn.dataset.saff === "docx") await word(b, o, chs);
      else preview(b, o, bookHtml(b, d, o, chs), w);
      st.textContent = `تم: ${toAr(chs.length)} فصلًا`; } catch (x) { if (w) w.close(); st.textContent = x.message; }
  });
  // صفحة الخدمة: التعريف بها، وقائمة التفريغات
  async function list(q) {
    const l = lib.books.filter(b => !b.demo && !b.hidden && isTranscript(b) && !(typeof VOL2 === "function" && VOL2(b)));
    const ready = (await getJ("tfedit/_list.json")) || {}, w = norm(q.q || "").trim(), r = w ? l.filter(b => norm((b.setTitle || b.title) + " " + (A(b.authorId).name || "")).includes(w)) : l;
    r.sort((x, y) => (ready[y.id] ? 1 : 0) - (ready[x.id] ? 1 : 0) || (y.added || "").localeCompare(x.added || ""));
    view(`<section class="saff"><h1>${ic("printer", 26)} صف التفريغ</h1>
      <div class="saffi"><div><h3>${ic("pen-line", 18)} تنسيق التفريغ للقراءة</h3><p>يُصحَّح التفريغ ويُرقَّم ويُقسَّم فقرات وعناوين ويُحذف الحشو الكلامي («منسَّق ومدقَّق»)، أو يُصاغ بأسلوب كتابي، ويُقرأ في الموقع بجانب النص كما أُلقي.</p><a class="btn s" href="#/tahrir">خدمة التنسيق</a></div>
       <div><h3>${ic("printer", 18)} صف التفريغ للطباعة</h3><p>يُخرج التفريغ كتابًا مصفوفًا كإصدارات دور النشر: غلاف وصفحة حقوق، وفهرس بأرقام صفحاته، وفصول تبدأ بصفحات جديدة، وعناوين جارية، وترقيم الصفحات، وحواشٍ أسفل صفحاتها، وضبط النص والمسافات، بمقاسات A5 و١٧×٢٤ وA4.</p></div></div>
      <form class="sbox" data-form="saffq"><input name="q" type="search" value="${esc(q.q || "")}" placeholder="ابحث في التفريغات" aria-label="بحث"><button class="btn p">بحث</button></form>
      <p class="mut">${toAr(r.length)} تفريغًا${Object.keys(ready).length ? ` • ${toAr(Object.keys(ready).length)} منها جاهز بالتنسيق` : ""}</p>
      <div class="saffl">${r.slice(0, 200).map(b => `<a href="#/saff/${esc(b.id)}"><b>${esc(b.setTitle || b.title)}</b><span>${esc(A(b.authorId).name || "")}</span>${ready[b.id] ? '<em>منسَّق</em>' : ""}</a>`).join("") || '<p class="mut">لا توجد تفريغات مطابقة.</p>'}</div></section>`);
  }
  document.addEventListener("submit", e => { const f = e.target.closest('[data-form="saffq"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); location.hash = "#/saff" + (f.q.value.trim() ? "?q=" + encodeURIComponent(f.q.value.trim()) : ""); }, true);
  return { view: (q, id) => id ? page(q, id) : list(q), chapters, clean, bookHtml, bookCss };
})();
