/* قسم الحديث (البند ١٩): #/hadith — الأحاديث بنصها من كتب المكتبة المرتبة (tools/hadith.py ← data/hadith):
   ترتيب موضوعي (الكتاب والباب)، وبحسب المصدر، ومعجمي بأطراف الأحاديث، وبحسب الصحابي؛ مع التخريج وحكم المصنف وشرحه الموجز
   من الكتاب نفسه ورقم الصفحة، وشروح كتب الحديث في المكتبة، والإعراب بالمساعد للأعضاء.
   التصدير: يختار القارئ ما يظهر (الراوي، المتن، التخريج، الحكم، الشرح، المصدر) والخط والحجم والقالب، نصًا أو Word أو صورة. */
const HDS = (() => {
  let IX = null, BK = {}; const DET = {};
  const load = async () => { if (!IX) { try { const j = await (await fetch("data/hadith/index.json")).json(); IX = j.items || []; BK = j.books || {}; } catch (e) { IX = []; } } return IX; };
  const det = async b => DET[b] || (DET[b] = fetch("data/hadith/" + b + ".json").then(r => r.json()).then(D => { for (const k in D) { const d = D[k]; if (d && d.mv) d.m = d.mv; if (d && d.fv) d.full = d.fv; } return D; }).catch(() => ({})));  // mv/fv: المتن والنص مشكولين (tools/hadith-tashkeel.py)
  const F = r => ({ id: r[0], b: r[1], p: r[2], k: r[3], bab: r[4], sah: r[5], tarf: r[6], t: r[7], h: r[8] });
  const LET = "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");
  const first = s => { const c = norm(s || "").replace(/^(و|ف)(?=..)/, "")[0] || ""; return c === "أ" || c === "إ" || c === "آ" ? "ا" : c; };
  const PER = 30;
  // كتب السنة (tools/kutub.py ← data/hadith/k): فهرس كل كتاب يُحمَّل عند طلبه، والمتون في أجزاء
  const RAWK = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/hadith/k/" + p;
  const KC = {}, kidx = b => KC[b] || (KC[b] = fetch(RAWK(b + ".json")).then(r => r.json()).catch(() => ({ items: [] })));
  // أحكام المحدثين المعاصرين على السنن الأربع (tools/hadith-grades.py ← data/hadith/grades)، بعد مطابقة المتن
  const GRC = {}, kgrades = b => GRC[b] || (GRC[b] = fetch(RAWK("").replace("/k/", "/grades/") + b + ".json").then(r => r.ok ? r.json() : {}).catch(() => ({})));
  const grCls = g => /موضوع|باطل|منكر|جدًا/.test(g) ? "gr-x" : /ضعيف|شاذ|معلول/.test(g) ? "gr-d" : /حسن/.test(g) && !/صحيح/.test(g) ? "gr-h" : /صحيح/.test(g) ? "gr-s" : "";
  async function gradesBox(b, n) { const el = $("#hdgr"); if (!el) return; const G = await kgrades(b), l = (G.g || {})[String(n)];
    if (!$("#hdgr")) return; if (!l) { el.remove(); return; }
    el.innerHTML = `<h3>أحكام المحدثين المعاصرين</h3><ul class="hdgr">${l.map(([w, g]) => `<li><b>${esc(w)}</b>: <span class="grb ${grCls(g)}">${esc(g)}</span></li>`).join("")}</ul><p class="mut">حكم الألباني من «صحيح السنن» و«ضعيفها»، والأرناؤوط وأحمد شاكر وبشار عواد من تحقيقاتهم، بترقيم المصنف بعد مطابقة المتن؛ والمصدر مجموعة hadith-api المفتوحة. للتوسع: أحكام المحدثين من الموسوعة الحديثية أدناه.</p>`; }
  // مطلع الحديث بلفظ روايته في الكتاب («عن فلان قال: قال رسول الله ﷺ…»): tools/hadith-lead.py ← data/hadith/k/<كتاب>/l<i>.json
  const LC2 = {}, klead = (b, i) => LC2[b + i] || (LC2[b + i] = fetch(RAWK(b + "/l" + i + ".json")).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  const SAYV = /(?:قال|قالت|يقول|تقول|فقال|فقالت|يقول:|قال:)\s*[:،]?\s*$/;
  // رموز الترضي والترحم المركبة (U+FD40–FD4F) لا تعرضها أكثر الخطوط (تظهر مربعًا): تُكتب حروفًا
  const HON = { "\uFD40": "رَحِمَهُ اللهُ", "\uFD41": "رَضِيَ اللهُ عَنْهُ", "\uFD42": "رَضِيَ اللهُ عَنْهَا", "\uFD43": "رَضِيَ اللهُ عَنْهُمْ", "\uFD44": "رَضِيَ اللهُ عَنْهُمَا", "\uFD45": "رَضِيَ اللهُ عَنْهُنَّ", "\uFD46": "صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ", "\uFD47": "عَلَيْهِ السَّلَامُ", "\uFD48": "عَلَيْهَا السَّلَامُ", "\uFD49": "عَلَيْهِمُ السَّلَامُ", "\uFD4A": "عَلَيْهِمَا السَّلَامُ" };
  const honor = t => String(t || "").replace(/[\uFD40-\uFD4A]/g, c => HON[c] || c);
  const clean = t => { t = honor(t).replace(/⦗[^⦘]*⦘/g, "").replace(/\s+/g, " ").trim(); return (LSG("hd_txt", {}) || {}).d === 0 ? t.replace(/[\u064B-\u0652\u0670]/g, "") : t; };
  // المتن بمطلعه: إن انتهى المطلع بفعل قول جاء المتن بين علامتي تنصيص، وإلا اتصل به
  /* ===== رموز الترضي والسلام المرسومة (طلب المدير، ٢١ نوفمبر): كما تُرسم «ﷺ» يُرسم الترضي عن الصحابي والصحابية بصيغته الثابتة
     (رضي الله عنه/عنها/عنهما/عنهم/عنهن)، و«عليه السلام» للأنبياء والملائكة، و«رحمه الله»؛ رمزًا مرسومًا (.hon) يُقرأ نصه كاملًا.
     التزامًا بنص المؤلف: لا يُضاف دعاء لم يكتبه صاحب الكتاب أو الشرح، وإنما تُرسم الصيغة التي اختارها كما وردت (طلب المدير). ===== */
  const DI = "[\\u064B-\\u0652\\u0670]*", rxw = w => [...w].map(c => c === " " ? "\\s+" : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + DI).join("");
  const PH = [["رضي الله عنهما", "رَضِيَ اللهُ", "عَنْهُمَا"], ["رضي الله عنهن", "رَضِيَ اللهُ", "عَنْهُنَّ"], ["رضي الله عنهم", "رَضِيَ اللهُ", "عَنْهُمْ"], ["رضي الله عنها", "رَضِيَ اللهُ", "عَنْهَا"], ["رضي الله عنه", "رَضِيَ اللهُ", "عَنْهُ"],
    ["رحمهما الله", "رَحِمَهُمَا", "اللهُ"], ["رحمه الله", "رَحِمَهُ", "اللهُ"], ["عليه الصلاة والسلام", "عَلَيْهِ الصَّلَاةُ", "وَالسَّلَامُ"], ["عليهما السلام", "عَلَيْهِمَا", "السَّلَامُ"], ["عليهم السلام", "عَلَيْهِمُ", "السَّلَامُ"], ["عليها السلام", "عَلَيْهَا", "السَّلَامُ"], ["عليه السلام", "عَلَيْهِ", "السَّلَامُ"]];
  const PHRX = PH.map(([w, a, b]) => [new RegExp("[-–(]?\\s*" + rxw(w) + "(?![\\u0621-\\u064A\\u064B-\\u0652\\u0670])\\s*[-–)]?", "g"), a, b, w]);
  const honSpan = (a, b, w, add) => `<span class="hon${add ? " add" : ""}" title="${w}" aria-label="${w}"><i>${a}</i><i>${b}</i></span>`;
  const onText = (html, f) => html.split(/(<[^>]+>)/).map((t, i) => i % 2 ? t : f(t)).join("");
  function sym(html, sah) { const T = txtSet(); if (T.h === 0) return html;
    html = onText(html, t => { PHRX.forEach(([rx, a, b, w]) => { t = t.replace(rx, () => " " + honSpan(a, b, w)); }); return t.replace(new RegExp(rxw("صلى الله عليه وسلم"), "g"), "ﷺ"); });
    return html; }
  const withLead = (lead, m, sah) => sym(withLead0(lead, m), sah);
  const withLead0 = (lead, m) => { m = clean(m); const paren = /\(/.test(m) && /\)/.test(m);
    if (paren) m = m.replace(/\(/g, "«").replace(/\)/g, "»").replace(/»\s*\.$/, "»");  // نسخ البغا: المتن بين قوسين ← علامتا التنصيص
    const quoted = /^«/.test(m) && /»\s*\.?$/.test(m);
    if (!quoted) m = m.replace(/^[«"]\s*/, "").replace(/\s*[»"]\s*$/, "");
    if (!lead) return quoted || paren ? esc(m) : `«${esc(m)}»`; const L = clean(lead).replace(/[\s،:]+$/, "");
    if (quoted) return `<span class="hlead">${esc(L)}</span>: ${esc(m)}`;
    if (paren) return `<span class="hlead">${esc(L)}</span> ${esc(m)}`;
    const Lb = L.replace(/[\u064B-\u0652\u0670]/g, "");
    return `<span class="hlead">${esc(L)}</span>${SAYV.test(Lb + " ") || /(?:قال|قالت|يقول|تقول|فقال)$/.test(Lb) ? ": «" + esc(m) + "»" : " " + esc(m)}`; };
  const MC = {}, kmatn = (b, i) => MC[b + i] || (MC[b + i] = fetch(RAWK(b + "/m" + i + ".json")).then(r => r.json()).catch(() => ({})));
  // روابط الحديث من نصوص المكتبة (tools/hadith-links.py): موضع شرحه، وتخريجه في كتب السنة، وفهرس البدايات لفتح نتائج البحث في موضعها
  const RAWL = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/hadith/links/" + p;
  const LC = {}, lget = p => LC[p] || (LC[p] = fetch(RAWL(p)).then(r => r.ok ? r.json() : {}).catch(() => ({})));
  /* ===== رحلة شرح السنة (tools/sharh-ai.py ← data/sharh): شرح واحد جامع للحديث برواياته في الكتب التسعة، يظهر في كل رواية منه ===== */
  const RAWS = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/sharh/" + p;
  const SC = {}, sget = p => SC[p] || (SC[p] = (async () => { for (const u of [RAWS(p), "data/sharh/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return {}; })());
  const NINE = ["bukhari", "muslim", "abudawud", "nasai", "tirmidhi", "ibnmajah", "musnadahmad", "muwatta", "darimi"];
  async function sharhOf(b, n) {
    const tries = [[b, String(n)]];
    if (!NINE.includes(b)) ((await lget(b + ".json"))[String(n)] || {}).t?.forEach(([b2, n2]) => { if (NINE.includes(b2)) tries.push([b2, String(n2)]); });  // المختارات: من رواياتها في الكتب التسعة
    for (const [b2, n2] of tries) { const e = (await sget("map/" + b2 + ".json"))[n2] || (await sget("map/" + b2 + ".json"))[n2.split(".")[0]];
      if (e) { const c = (await sget("c/" + e[1] + ".json"))[e[0]]; if (c) return Object.assign({ _f: e[1] }, c); } }
    return null;
  }
  const refLink = r => { const [v, p] = r.split(":"), bk = B(v); return `<a class="cite" href="#/book/${esc(v)}/${p}">(${esc(bk ? (bk.setTitle || bk.title).replace(/ — .*$/, "") : v)}${bk && bk.vol ? "، ج" + toAr(bk.vol) : ""}، ص ${toAr(p)})</a>`; };
  const refBox = r => typeof citeBox === "function" ? citeBox(refLink(r)) : refLink(r);  // صندوق صغير ينبثق بجوار النص (أو العزو داخل النص بحسب إعداد القارئ)
  const sx = t => esc(t || "").replace(/\[\[([^\]\s]+?:\d+)\]\]/g, (m, r) => refBox(r)).replace(/\n+/g, "</p><p>");
  const FW = [["aqida", "فوائد عقدية"], ["fiqh", "فوائد فقهية"], ["adab", "فوائد تربوية وأدبية"], ["ilm", "فوائد علمية"], ["lugha", "فوائد لغوية"], ["balagha", "فوائد بلاغية"]];
  function sharhHtml(c, full) {
    const S_ = c.s || {}, li = a => (a || []).filter(Boolean).map(x => `<li>${sx(x)}</li>`).join("");
    const riw = (c.riw || []).map(([b2, n2]) => `<a class="chip" href="#/hadith/k/${b2}/${encodeURIComponent(n2)}">${esc(bname(b2))} (${toAr(n2)})</a>`).join("");
    const parts = [
      (S_.gharib || []).length ? `<h4>غريب الحديث</h4><dl class="shg">${S_.gharib.map(g => `<dt>${esc(g.w || "")}</dt><dd>${sx(g.m)}</dd>`).join("")}</dl>` : "",
      S_.ijmali || S_.murad ? `<h4>الشرح الإجمالي</h4><p>${sx([S_.murad, S_.ijmali, S_.usul].filter(Boolean).join("\n"))}</p>${(S_.mubhamat || []).length ? `<ul>${li(S_.mubhamat)}</ul>` : ""}` : "",
      S_.riwayat ? `<h4>ما تزيده الروايات الأخرى</h4><p>${sx(S_.riwayat)}</p>` : "",
      FW.some(([k]) => (S_.fawaid || {})[k] && S_.fawaid[k].length) ? `<h4>الفوائد المستنبطة</h4>${FW.map(([k, n]) => ((S_.fawaid || {})[k] || []).length ? `<h5>${n}</h5><ul>${li(S_.fawaid[k])}</ul>` : "").join("")}` : ""];
    return `<div class="shbox">${full ? parts.join("") : [parts[0], parts[1], parts[3]].join("")}
      ${riw ? `<p class="mut shr"><b>الروايات المشروحة معه:</b> ${riw}</p>` : ""}
      <p class="mut shn">شرح مجموع من الشروح المعتمدة في المكتبة بعزو كل نقطة إلى موضعها، أُعدّ آليًّا (${esc(c.at || "")}) وهو قيد المراجعة العلمية.</p></div>`;
  }
  const NOSH = '<p class="mut">لم يُشرح هذا الحديث بعد. تجري رحلة شرح السنة يوميًّا من الشروح المعتمدة في المكتبة بالترتيب: صحيح البخاري، ثم زوائد مسلم، فأبي داود، فالنسائي، فالترمذي، فابن ماجه، فمسند أحمد، فالموطأ؛ ويُشرح الحديث مع رواياته كلها مرة واحدة.</p>';
  const canEdit = () => typeof isAdmin === "function" && isAdmin() && typeof GH !== "undefined" && GH.on;
  async function sharhInto(el, b, n, full) { if (!el) return; el.hidden = false; el.innerHTML = '<p class="mut">جارٍ تحميل الشرح…</p>';
    const c = await sharhOf(b, n);
    const bar = full ? `<div class="row shbar">${NINE.includes(b) ? `<button class="btn s" data-act="shexp" data-b="${b}" data-n="${esc(String(n))}">⬇ تنزيل الشرح</button>` : ""}${canEdit() && NINE.includes(b) ? `<button class="btn s" data-act="shedit" data-b="${b}" data-n="${esc(String(n))}">${c ? "✎ تعديل الشرح" : "＋ إضافة شرح"}</button>` : ""}</div>` : "";
    el.innerHTML = (c ? sharhHtml(c, full) : NOSH) + (await dawahHtml(b, n)) + bar; }

  window.HSH = { into: (el, b, n, f) => sharhInto(el, b, n, f) };
  /* ===== من شروح مشايخ الدعوة (tools/sharh-dawah.py ← data/sharh/dawah): موضع شرح الشيخ للحديث، وفوائده وترجيحاته بنص كلامه — تظهر للقراء بعد اعتماد الإدارة ===== */
  async function dawahOf(b, n) { const D_ = await sget("dawah/" + b + ".json"); return D_[String(n)] || D_[String(n).split(".")[0]] || []; }
  async function dawahHtml(b, n) {
    if (!NINE.includes(b)) return ""; const L = await dawahOf(b, n); if (!L.length) return "";
    return `<div class="shdawah"><h4>من شروح مشايخ الدعوة</h4>${L.map((e, i) => { const show = (e.f || []).length && (e.fst === "ok" || canEdit());
      return `<div class="shdw"><p><b>${esc(e.an)}</b>${e.t ? " — " + esc(e.t.replace(" — " + e.an, "")) : ""} • <a href="#/book/${esc(e.sb)}/${e.p}">اقرأ شرحه لهذا الحديث (ص ${toAr(e.p)}${e.pz > e.p ? "–" + toAr(e.pz) : ""})</a></p>
        ${show ? `<ul class="shdwf">${e.f.map((x, k) => `<li>${x.k === "tarjih" ? '<em class="tag">ترجيح</em> ' : ""}${x.m ? "<b>" + esc(x.m) + ":</b> " : ""}«${esc(x.q)}»${canEdit() ? ` <button class="btn s" data-act="dwdel" data-b="${b}" data-n="${esc(String(n))}" data-i="${i}" data-k="${k}" title="حذف هذه الفائدة">✕</button>` : ""}</li>`).join("")}</ul>
          ${e.fst !== "ok" ? `<p class="mut"><em class="tag">مسودة للمشرفين</em> فوائد مستخرجة آليًّا بنص كلام الشيخ — <button class="btn s p" data-act="dwok" data-b="${b}" data-n="${esc(String(n))}" data-i="${i}">اعتماد ونشر</button></p>` : `<p class="mut">بنص كلام الشيخ من شرحه، ومراجعة الإدارة.</p>`}` : ""}</div>`; }).join("")}</div>`;
  }
  async function dawahSet(b, n, i, fn, msg) {
    const key = String(n); await GH.editJSON("data/sharh/dawah/" + b + ".json", o => { o = o || {}; const k = o[key] ? key : key.split(".")[0], e = (o[k] || [])[i]; if (e) fn(e); return o; }, msg);
    Object.keys(SC).filter(k => k.startsWith("dawah/")).forEach(k => delete SC[k]); toast("حُفظ، ويظهر للجميع خلال دقائق."); sharhInto($("#hdds"), b, n, true); }

  /* ===== تنزيل الشرح: النطاق (حديث، باب، أرقام، الكتاب كاملًا)، والمحتوى، والصيغة والقالب.
     كل حديث «صفحة» بتنسيق نصوص المكتبة، والعزو [[المرجع]] حاشية مرقمة تحته («(١) فتح الباري، ج١، ص ٤٩٩»)، وفي آخر الملف «المراجع».
     فتُبنى الصيغ كلها بأدوات التصدير القائمة: Word بحواشٍ حقيقية (DOCX)، وPDF وHTML وEPUB (EXT)، ونص. ===== */
  const SHPART = [["matn", "نص الحديث", 1], ["ijmali", "الشرح الإجمالي", 1], ["gharib", "غريب الكلمات", 1], ["riwayat", "ما تزيده الروايات", 0], ["fawaid", "الفوائد المستنبطة", 1], ["riw", "مواضع الروايات", 0]];
  async function sharhExport(b, n) {
    const D = await kidx(b), it = D.items || [], k = it.findIndex(x => String(x[0]) === String(n)), x = it[k] || [];
    const P = typeof EXF !== "undefined" ? EXF.presets : {};
    openSheet("تنزيل الشرح", `<form id="shx" data-form="noop"><fieldset><legend>النطاق</legend>
      <label class="inl"><input type="radio" name="sc" value="one" checked> هذا الحديث (${toAr(n)})</label>
      ${x[4] ? `<label class="inl"><input type="radio" name="sc" value="bab"> باب: ${esc(String(x[4]).slice(0, 70))}</label>` : ""}
      ${x[3] ? `<label class="inl"><input type="radio" name="sc" value="kit"> كتاب: ${esc(String(x[3]).slice(0, 70))}</label>` : ""}
      <label class="inl"><input type="radio" name="sc" value="rng"> من رقم <input name="a" type="number" value="${esc(String(n).split(".")[0])}" style="width:6em"> إلى <input name="z" type="number" value="${(+String(n).split(".")[0] || 1) + 49}" style="width:6em"></label>
      <label class="inl"><input type="radio" name="sc" value="all"> ${esc(D.t)} كاملًا (ما شُرح منه)</label></fieldset>
      <fieldset><legend>المحتوى</legend>${SHPART.map(([k, l, on]) => `<label class="inl"><input type="checkbox" name="p" value="${k}"${on ? " checked" : ""}${k === "ijmali" ? " disabled" : ""}> ${l}</label>`).join("")}
      <label class="inl"><input type="checkbox" name="fn" value="1" checked> عزو المصادر في الحاشية</label></fieldset>
      <div class="row"><div><label>الصيغة</label><select name="f"><option value="docx">Word (بحواشٍ)</option><option value="pdf">PDF (طباعة)</option><option value="epub">EPUB (كتاب إلكتروني)</option><option value="html">صفحة HTML</option><option value="doc">Word (بسيط)</option><option value="txt">نص</option></select></div>
      <div><label>القالب</label><select name="tpl">${Object.entries(P).map(([k, v]) => `<option value="${k}"${k === "lib" ? " selected" : ""}>${esc(v.n)}</option>`).join("")}</select></div></div>
      <div class="savebar"><button class="btn p">تنزيل</button> <span id="shxst" class="mut" role="status"></span></div></form>`);
    $("#shx").onsubmit = async e => { e.preventDefault(); const f = e.target, st = $("#shxst"), sc = f.sc.value, parts = new Set([...f.querySelectorAll("[name=p]:checked")].map(i => i.value).concat(["ijmali"]));
      let L = sc === "one" ? [x] : sc === "bab" ? it.filter(y => y[4] === x[4] && y[3] === x[3]) : sc === "kit" ? it.filter(y => y[3] === x[3]) : sc === "all" ? it : it.filter(y => { const v = +String(y[0]).split(".")[0]; return v >= +f.a.value && v <= +f.z.value; });
      L = L.filter(y => !String(y[0]).includes("."));
      st.textContent = "جارٍ جمع الشروح (" + toAr(L.length) + " حديثًا)…";
      try { await sharhBuild(b, D, L, parts, !!f.fn.checked, f.f.value, f.tpl.value, sc, st); } catch (x2) { st.textContent = "تعذّر: " + (x2.message || x2); } };
  }
  async function sharhBuild(b, D, L, parts, withFn, fm, tpl, sc, st) {
    const map = await sget("map/" + b + ".json"), seen = new Map(), pages = [], toc = [], books = new Map();
    let MM = {}; for (const c of [...new Set(L.map(y => Math.floor(D.items.indexOf(y) / 500)))]) Object.assign(MM, await kmatn(b, c));
    let lastKit = "", lastBab = "", done = 0, none = 0;
    for (const y of L) {
      const e = map[String(y[0])]; if (!e) { none++; continue; }
      const c = (await sget("c/" + e[1] + ".json"))[e[0]]; if (!c) { none++; continue; }
      const S_ = c.s || {}, fn = [], ref = new Map(), mark = t => String(t || "").replace(/\[\[([^\]\s]+?:\d+)\]\]/g, (m, r) => { if (!withFn) return ""; if (!ref.has(r)) { ref.set(r, ref.size + 1); const [v, pg] = r.split(":"), bk = B(v), au = bk ? (A(bk.authorId) || {}).name : ""; const t2 = bk ? (bk.setTitle || bk.title).replace(/ — .*$/, "") : v; books.set(t2, au || ""); fn.push("(" + toAr(ref.get(r)) + ") " + t2 + (au ? "، " + au : "") + (bk && bk.vol ? "، ج" + toAr(bk.vol) : "") + "، ص " + toAr(pg) + "."); } return " (" + toAr(ref.get(r)) + ")"; }).replace(/\s+\(/g, " (");
      const out = [];
      if (y[3] && y[3] !== lastKit) { toc.push({ t: y[3], p: pages.length + 1, l: 1 }); lastKit = y[3]; lastBab = ""; }
      if (y[4] && y[4] !== lastBab) { toc.push({ t: y[4], p: pages.length + 1, l: 2 }); lastBab = y[4]; }
      out.push("# الحديث " + toAr(y[0]) + (y[4] ? " — " + y[4] : ""));
      if (seen.has(e[0])) { out.push("شرحه مع الحديث رقم " + toAr(seen.get(e[0])) + " (الروايات تُشرح معًا)."); pages.push({ i: pages.length + 1, t: out.join("\n"), l: "" }); continue; }
      seen.set(e[0], y[0]);
      if (parts.has("matn")) { let mt = String(MM[String(y[0])] || y[6] || ""); const cut = mt.search(/\s\[[\d٠-٩،,\s]+\]/); if (cut > 20) mt = mt.slice(0, cut);  // بيان المحقق ومواضع التكرار بعد المتن
        mt = mt.trim().replace(/^\((.+)\)\.?$/s, "$1"); out.push((y[5] ? "عن " + y[5] + ": " : "") + "«" + mt + "»"); }
      if (parts.has("gharib") && (S_.gharib || []).length) out.push("## غريب الكلمات", ...S_.gharib.map(g => (g.w || "") + ": " + mark(g.m)));
      { const ij = [S_.murad, S_.ijmali, S_.usul].filter(Boolean).concat(S_.mubhamat || []).join("\n"); if (ij) out.push("## الشرح الإجمالي", ...mark(ij).split("\n").filter(Boolean)); }
      if (parts.has("riwayat") && S_.riwayat) out.push("## ما تزيده الروايات الأخرى", mark(S_.riwayat));
      if (parts.has("fawaid")) FW.forEach(([k2, l2]) => { const a = (S_.fawaid || {})[k2] || []; if (a.length) out.push("## " + l2, ...a.map((v, i) => toAr(i + 1) + ". " + mark(v))); });
      if (parts.has("riw") && (c.riw || []).length > 1) out.push("## مواضع الروايات", c.riw.map(([b2, n2]) => bname(b2) + " (" + toAr(n2) + ")").join("، "));
      if (fn.length) out.push("______", ...fn);
      pages.push({ i: pages.length + 1, t: out.join("\n"), l: "" }); done++;
    }
    if (!done) { st.textContent = "لا شروح بعد في هذا النطاق" + (none ? " (" + toAr(none) + " حديثًا لم تُشرح)" : "") + "."; return; }
    const refs = [...books].sort((p1, p2) => p1[0].localeCompare(p2[0], "ar"));
    pages.push({ i: pages.length + 1, t: ["# المراجع", ...refs.map(([t2, au]) => "- " + t2 + (au ? "، " + au : "") + "."), "", "شرح مجموع من الشروح المعتمدة في «" + SITENAME + "» بعزو كل نقطة إلى موضعها، أُعدّ آليًّا وهو قيد المراجعة العلمية." + (none ? " ولم يُشرح بعدُ " + toAr(none) + " حديثًا من هذا النطاق." : "")].join("\n"), l: "" });
    toc.push({ t: "المراجع", p: pages.length, l: 1 });
    const scN = { one: "الحديث " + toAr(L[0][0]), bab: L[0][4] || "", kit: L[0][3] || "", all: "", rng: "الأحاديث " + toAr(L[0][0]) + "–" + toAr(L[L.length - 1][0]) }[sc] || "";
    const title = "شرح " + D.t + (scN ? " — " + scN : ""), safe = title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 90), au = SITENAME;
    const fmt = Object.assign({}, (typeof EXF !== "undefined" && EXF.presets[tpl]) || {}), opt = { fn: withFn, toc: pages.length > 3, pl: false };
    st.textContent = "جارٍ إعداد الملف…";
    if (fm === "txt") { st.textContent = ""; return dl(safe + ".txt", pages.map(p => p.t.replace(/^#+\s*/gm, "").replace(/^_{4,}$/m, "—————")).join("\n\n") + "\n\n" + SITENAME + " — " + (CFG.siteUrl || ""), "text/plain"); }
    if (fm === "docx" && typeof DOCX !== "undefined") { const who = (Auth.user && Auth.user.name) || "";
      const blob = await DOCX.build({ fmt, title, author: au, pages, toc: toc.map(t => Object.assign({ pl: "" }, t)), opt, url: siteLink("#/hadith?t=kutub&kb=" + b), src: "", who, site: SITENAME, siteUrl: (CFG.siteUrl || "https://dawahlibrary.org").replace(/^https?:\/\//, "").replace(/\/+$/, "") });
      st.textContent = ""; return dl(safe + ".docx", blob, blob.type); }
    const X = EXT.x.bind(EXT), body = pages.map(p => `<div class="pg">${EXT.pageHtml(p.t, opt)}</div>`).join("");
    const css = `@page{size:A4;margin:18mm 16mm}body{font-size:16pt;line-height:2;max-width:760px;margin:auto;padding:16px;text-align:justify}h1{text-align:center}h3{color:${fmt.c1 || "#0f5c4d"};margin:14px 0 4px}.pg{break-after:page;margin-bottom:28px}.fn{border-top:1px solid #999;font-size:12pt;margin-top:10px}.foot{text-align:center;color:#888;font-size:11pt}`;
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${X(title)}</title><style>${css}${typeof EXF !== "undefined" ? EXF.css(fmt) : ""}</style></head><body><h1>${X(title)}</h1><p class="foot">${X(au)}</p>${body}<p class="foot">${X(SITENAME + " — " + (CFG.siteUrl || ""))}</p></body></html>`;
    st.textContent = "";
    if (fm === "html") return dl(safe + ".html", html, "text/html");
    if (fm === "doc") return dl(safe + ".doc", html, "application/msword");
    if (fm === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html + "<script>onload=()=>setTimeout(()=>print(),400)<\/script>"); w.document.close(); return; }
    if (fm === "epub") { const xh = (t, inner) => `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ar" lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${X(t)}</title><link rel="stylesheet" href="style.css"/></head><body>${inner}</body></html>`;
      const files = [["mimetype", "application/epub+zip"], ["META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
        ["OEBPS/style.css", "body{direction:rtl;text-align:justify;line-height:1.9;font-family:Amiri,serif}h1,h3{color:#0f5c4d}.fn{border-top:1px solid #999;font-size:.85em}"]];
      pages.forEach((p, k2) => files.push(["OEBPS/c" + (k2 + 1) + ".xhtml", xh(title, EXT.pageHtml(p.t, opt).replace(/<br>/g, "<br/>"))]));
      const id = "urn:sdsl:sharh:" + b + ":" + Date.now();
      files.push(["OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" dir="rtl"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${id}</dc:identifier><dc:title>${X(title)}</dc:title><dc:creator>${X(au)}</dc:creator><dc:language>ar</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${pages.map((p, k2) => `<item id="c${k2 + 1}" href="c${k2 + 1}.xhtml" media-type="application/xhtml+xml"/>`).join("")}</manifest><spine page-progression-direction="rtl">${pages.map((p, k2) => `<itemref idref="c${k2 + 1}"/>`).join("")}</spine></package>`]);
      files.push(["OEBPS/nav.xhtml", xh("الفهرس", `<nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol>${toc.map(t => `<li><a href="c${t.p}.xhtml">${X(t.t)}</a></li>`).join("")}</ol></nav>`)]);
      return dl(safe + ".epub", new Blob([EXT.zip(files)], { type: "application/epub+zip" }), "application/epub+zip"); }
  }
  /* ===== تعديل الشرح وإضافته من الإدارة: يُحفظ في data/sharh (rev=1 فلا تعيد المهمة الآلية كتابته) ===== */
  const lines = a => (a || []).filter(Boolean).join("\n"), unlines = t => String(t || "").split("\n").map(x => x.trim()).filter(Boolean);
  async function sharhEdit(b, n) {
    const c = await sharhOf(b, n), S_ = (c && c.s) || {}, F_ = S_.fawaid || {};
    const ta = (k, l, v, r) => `<label>${l}</label><textarea name="${k}" rows="${r || 3}">${esc(v || "")}</textarea>`;
    openSheet(c ? "تعديل شرح الحديث" : "إضافة شرح للحديث", `<form id="shf" data-form="noop" data-b="${b}" data-n="${esc(String(n))}">
      <p class="mut">العزو إلى موضع في المكتبة بالصيغة [[المعرف:الصفحة]] مثل [[fathbari-v01:499]]، فيظهر رابطًا وحاشية في الملفات المنزّلة. ${c ? "التعديل يشمل الروايات المشروحة معه كلها." : "يُضاف الشرح لهذه الرواية؛ وتربطه المهمة اليومية برواياته الأخرى."}</p>
      ${ta("gharib", "غريب الحديث (سطر لكل كلمة: الكلمة: معناها)", (S_.gharib || []).map(g => (g.w || "") + ": " + (g.m || "")).join("\n"), 4)}
      ${ta("ijmali", "الشرح الإجمالي (جمع الشروح بترتيب جمل الحديث، ويدخل فيه المبهم والنسخ والتخصيص إن وردت في الشروح)", [S_.murad, S_.ijmali, S_.usul].filter(Boolean).concat(S_.mubhamat || []).join("\n"), 8)}
      ${ta("riwayat", "ما تزيده الروايات الأخرى", S_.riwayat)}
      ${FW.map(([k, l]) => ta("f_" + k, l + " (سطر لكل فائدة)", lines(F_[k]))).join("")}
      <div class="savebar"><button class="btn p">حفظ الشرح</button> <span id="shst" class="mut" role="status"></span></div></form>`);
    $("#shf").onsubmit = async e => { e.preventDefault(); const f = e.target, st = $("#shst"), fd = new FormData(f);
      const sv = { gharib: unlines(fd.get("gharib")).map(l => { const i = l.indexOf(":"); return i > 0 ? { w: l.slice(0, i).trim(), m: l.slice(i + 1).trim() } : { w: l, m: "" }; }),
        riwayat: String(fd.get("riwayat") || "").trim(),
        ijmali: String(fd.get("ijmali") || "").trim(), fawaid: Object.fromEntries(FW.map(([k]) => [k, unlines(fd.get("f_" + k))])) };
      if (!sv.ijmali) { st.textContent = "الشرح الإجمالي مطلوب."; return; }
      st.textContent = "جارٍ الحفظ…"; const who = (Auth.user && Auth.user.name) || "الإدارة";
      try {
        let cid = c && c.id, fn = c && c._f;
        if (!c) { const D = await kidx(b), k = (D.items || []).findIndex(x => String(x[0]) === String(n)); cid = b + ":" + n; fn = b + "-" + Math.floor(Math.max(0, k) / 100); }
        await GH.editJSON("data/sharh/c/" + fn + ".json", o => { o = o || {}; const r = o[cid] || { id: cid, mem: [[b, String(n)]], riw: [[b, String(n)]], refs: [], at: today() };
          r.s = sv; r.rev = 1; r.ed = today(); r.by = who; o[cid] = r; return o; }, (c ? "تعديل شرح الحديث " : "إضافة شرح الحديث ") + cid);
        if (!c) await GH.editJSON("data/sharh/map/" + b + ".json", o => { o = o || {}; o[String(n)] = [cid, fn]; return o; }, "شرح الحديث " + cid + ": الربط");
        Object.keys(SC).forEach(k => delete SC[k]); closeSheet(); toast("حُفظ الشرح، ويظهر للجميع خلال دقائق."); sharhInto($("#hdds"), b, n, true);
      } catch (x) { st.textContent = "تعذّر الحفظ: " + (x.message || x); } };
  }
  const CUR = /^(arbain|riyad|bulugh)$/;
  const hurl = (b, n) => CUR.test(b) ? "#/hadith/x/" + n : "#/hadith/k/" + b + "/" + n;
  const hwords = t => String(t || "").replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^ء-ي ]/g, " ").split(/\s+/).filter(w => w.length > 1);
  async function locate(matn) { const w = hwords(matn), out = [], seen = new Set();
    for (const off of [0, 1, 2]) { if (w.length < off + 3) break; const k = w.slice(off, off + 3).join(" "), d = await lget("_tx/" + k.charCodeAt(0).toString(16).padStart(4, "0") + ".json");
      (d[k] || []).forEach(([b, n]) => { const id = b + ":" + n; if (!seen.has(id)) { seen.add(id); out.push([b, n]); } }); if (out.length) break; }
    return out.slice(0, 4); }
  const bname = b => (KL && KL[b] && KL[b].t) || BK[b] || b;
  async function linksBox(b, n) { const el = $("#hdlk"); if (!el) return; await klist(); const e = (await lget(b + ".json"))[String(n)] || {};
    const sh = (e.sh || []).map(([v, p]) => { const bk = B(v); return `<a class="chip" href="#/book/${esc(v)}/${p}">📖 ${esc(bk ? (bk.setTitle || bk.title).replace(/ — .*$/, "") : v)}${bk && bk.vol ? " • ج" + toAr(bk.vol) : ""} • ص ${toAr(p)}</a>`; }).join("");
    const tk = (e.t || []).map(([b2, n2]) => `<a class="chip" href="${hurl(b2, n2)}">${esc(bname(b2))}${CUR.test(b2) ? "" : " (" + toAr(n2) + ")"}</a>`).join("");
    const sh2 = !sh ? (e.sh2 || []).map(([v, p, b2, n2]) => { const bk = B(v); return `<a class="chip" href="#/book/${esc(v)}/${p}">📖 ${esc(bk ? (bk.setTitle || bk.title).replace(/ — .*$/, "") : v)}${bk && bk.vol ? " • ج" + toAr(bk.vol) : ""} • ص ${toAr(p)} <small>(روايته في ${esc(bname(b2))})</small></a>`; }).join("") : "";
    el.innerHTML = `<h3>شرح الحديث</h3>${!sh && sh2 ? `<p class="mut">شرح الحديث نفسه في رواية أخرى منه:</p><div class="chips">${sh2}</div>` : ""}${sh ? `<div class="row"><button class="btn p" data-act="hdbrief" data-b="${b}" data-n="${esc(String(n))}">📝 شرح موجز من الشروح المشهورة</button></div><p class="mut">موضع شرحه في المكتبة:</p><div class="chips">${sh}</div>` : (sh2 ? "" : '<p class="mut">لم يُحدَّد موضع شرحه في شروح المكتبة بعد.</p>')}
      <h3>تخريجه في كتب السنة بالمكتبة</h3>${tk ? `<div class="chips">${tk}</div>` : '<p class="mut">لم يُعثر على رواية أخرى له في كتب السنة بالمكتبة؛ انظر أحكام المحدثين وتخريجهم أدناه.</p>'}`; }
  async function brief(b, n) { openSheet("شرح موجز", '<p class="mut">جارٍ إعداد الشرح الموجز من الشرح المعتمد…</p>');
    try { const r = await fetch("api/translate?sharh=" + encodeURIComponent(b) + "&n=" + encodeURIComponent(n)), j = await r.json(); if (!r.ok) throw new Error(j.message || "");
      const bk = B(j.at[0]); $("#sheetB").innerHTML = `<div class="hdbrief">${esc(j.text).replace(/\n+/g, "</p><p>").replace(/^/, "<p>")}</p></div><p class="mut">مختصر من «${esc(j.src)}» بالذكاء الاصطناعي، مقيّدًا بنصه. <a href="#/book/${esc(j.at[0])}/${j.at[1]}" data-act="closeSheet">اقرأ الشرح كاملًا في موضعه${bk && bk.vol ? " (ج" + toAr(bk.vol) + ")" : ""} ←</a></p>`;
    } catch (e) { $("#sheetB").innerHTML = `<p class="note">${esc(e.message || "تعذّر إعداد الشرح الآن")}</p>`; } }
  let KL = null; const klist = async () => KL || (KL = await fetch(RAWK("_list.json")).then(r => r.json()).catch(() => ({})));
  // التقسيم الموضوعي على أبواب كتب الحديث (tools/hadith-topics.py ← data/hadith/topics)
  const RAWT = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/hadith/topics/" + p;
  const TC = {}, tget = p => TC[p] || (TC[p] = fetch(RAWT(p)).then(r => r.json()).catch(() => null));
  const TI = ["shield-check", "book-open", "droplet", "landmark", "flower", "hand-coins", "moon", "map", "scale", "heart", "split", "utensils", "shirt", "smile", "leaf", "message-circle", "pill", "eye", "flame", "sun", "flag", "gavel", "ban", "hand", "book-marked", "star", "folder"];
  async function topics(q) {
    const idx = await tget("_index.json"); if (!idx) return '<p class="mut">تعذّر تحميل التقسيم الموضوعي.</p>';
    if (q.g == null || q.g === "") return `<p class="mut">أحاديث كتب السنة ورياض الصالحين وبلوغ المرام مجموعة على الكتب العلمية الكبرى كما رتّبها المصنفون، وتحت كل كتاب أبوابه من كل مصدر.</p><div class="grid hdtop">${idx.map(([t, n, a], i) => n ? `<a class="card" href="#/hadith?t=topic&g=${i}"><b>${esc(t)}</b><span>${toAr(n)} حديثًا • ${toAr(a)} بابًا</span></a>` : "").join("")}</div>`;
    const D = await tget(q.g + ".json"); if (!D) return "";
    const srcs = [...new Set(D.a.map(x => x[1]))], src = q.src || "", A_ = D.a.map((x, i) => [x, i]).filter(([x]) => !src || x[1] === src);
    if (q.ab != null && q.ab !== "") { const xs = String(q.ab).split(",").map(i => D.a[+i]).filter(Boolean); if (!xs.length) return ""; const b = xs[0][0] || xs[0][2], PG = 60, pg = Math.max(1, +q.pg || 1);
      // أحاديث الباب مجمّعة من كل المصادر في قائمة واحدة، مرتبة بترتيب المصادر ثم ترتيب المصنف، ويُنسب كل حديث لمصدره
      const all = []; xs.forEach(x => x[3].forEach(id => all.push([x[1], id]))); const PR = ["bukhari", "muslim", "muwatta", "abudawud", "tirmidhi", "nasai", "ibnmajah", "darimi", "musnadahmad"], pr = z => { const i = PR.indexOf(z); return i < 0 ? 99 : i }; all.sort((p, q) => pr(p[0]) - pr(q[0])); const tot = all.length, part = all.slice((pg - 1) * PG, pg * PG);
      const bySrc = {}; part.forEach(([sb, id]) => (bySrc[sb] = bySrc[sb] || []).push(id));
      let rows = "";
      for (const sb of Object.keys(bySrc)) { const ids = bySrc[sb], nm = D.books[sb] || sb; let h = "";
        if (BK[sb]) { await load(); h = ids.map(id => IX.find(r => r[0] === id)).filter(Boolean).map(r => card(F(r))).join(""); }
        else { const K = await kidx(sb), set = new Set(ids.map(String)); h = (K.items || []).filter(y => set.has(String(y[0]))).map(y => `<a class="hdc" href="#/hadith/k/${sb}/${y[0]}"><span class="hds">${y[5] ? "عن " + esc(y[5]) : ""}</span><b>${esc(y[6])}…</b><span class="mut">${esc(K.t || sb)} • ${toAr(y[0])}</span></a>`).join(""); }
        rows += `<div class="hsrcg"><span class="hsrc">${esc(nm)}</span>${h}</div>`; }
      const nav = (tot > PG ? `<p class="hpg">${pg > 1 ? `<a class="btn s" href="#/hadith?t=topic&g=${q.g}&ab=${q.ab}&pg=${pg - 1}">السابق</a> ` : ""}صفحة ${toAr(pg)} من ${toAr(Math.ceil(tot / PG))}${pg * PG < tot ? ` <a class="btn s p" href="#/hadith?t=topic&g=${q.g}&ab=${q.ab}&pg=${pg + 1}">التالي</a>` : ""}</p>` : "");
      return `<p><a href="#/hadith?t=topic">← الكتب الموضوعية</a> › <a href="#/hadith?t=topic&g=${q.g}">${esc(D.t)}</a></p><h3>${esc(b)}</h3><p class="mut">${toAr(tot)} حديثًا من ${toAr(new Set(xs.map(x => x[1])).size)} مصدرًا، مجموعة بترتيب أبواب العلماء</p>${nav}${rows}${nav}`; }
    if (q.v !== "abwab") { // الافتراضي: قائمة واحدة لكل أحاديث الموضوع، مرتبة بترتيب المسائل ثم درجة المصدر (طلب المستخدم ٢٨ نوفمبر)
      const T = { bukhari: 1, muslim: 1, muwatta: 2, ibnkhuzayma: 2, ibnhibban: 2, ibnjarud: 2, abudawud: 3, tirmidhi: 3, nasai: 3, ibnmajah: 3, adabmufrad: 3, shamail: 3 }, tier = b => T[b] || 4, TN = { 1: "الصحيحان", 2: "+ الموطأ وصحاح الأئمة", 3: "+ السنن الأربعة", 4: "كل المصادر" };
      const PR2 = ["bukhari", "muslim", "muwatta", "abudawud", "tirmidhi", "nasai", "ibnmajah", "darimi", "musnadahmad"], pr2 = z => { const i = PR2.indexOf(z); return i < 0 ? 99 : i };
      const nk = t => String(t || "").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/^\s*\(?\s*(باب|بابُ)\s+/, "").replace(/[\s:،.؟?!)-]+$/g, "").replace(/\s+/g, " ").trim(), KO = new Map(), KT = {};
      D.a.map((x, i) => [x, i]).sort((a, b) => pr2(a[0][1]) - pr2(b[0][1]) || a[1] - b[1]).forEach(([x]) => { const k = nk(x[0] || x[2] || "أحاديث"); if (!KO.has(k)) { KO.set(k, KO.size); KT[k] = String(x[0] || x[2] || "أحاديث").replace(/^\s*\(\s*/, "").trim(); } });
      const tr = Math.min(4, Math.max(1, +q.tr || 4)); let E = [];
      D.a.forEach((x, i) => { if (src && x[1] !== src) return; if (tier(x[1]) > tr) return; const k = nk(x[0] || x[2] || "أحاديث"); x[3].forEach(id => E.push([KO.get(k), tier(x[1]), pr2(x[1]), x[1], id, k, i])); });
      E.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[6] - b[6]);
      const seen = new Set(); E = E.filter(e => { const z = e[3] + ":" + e[4]; if (seen.has(z)) return false; seen.add(z); return true; });
      const PG = 50, pg = Math.max(1, +q.pg || 1), tot = E.length, part = E.slice((pg - 1) * PG, pg * PG), bySrc = {}; part.forEach(e => (bySrc[e[3]] = bySrc[e[3]] || []).push(e[4]));
      const H = {}; await load();
      for (const sb of Object.keys(bySrc)) { const set = new Set(bySrc[sb].map(String));
        if (BK[sb]) IX.filter(r => set.has(String(r[0]))).forEach(r => H[sb + ":" + r[0]] = card(F(r)));
        else { const K = await kidx(sb); (K.items || []).filter(y => set.has(String(y[0]))).forEach(y => H[sb + ":" + y[0]] = `<a class="hdc" href="#/hadith/k/${sb}/${y[0]}"><span class="hds">${y[5] ? "عن " + esc(y[5]) : ""}</span><b>${esc(y[6])}…</b><span class="mut">${esc(D.books[sb] || K.t || sb)} • ${toAr(y[0])}</span></a>`); } }
      let last = null, rows = "";
      part.forEach(e => { rows += H[e[3] + ":" + e[4]] || ""; });
      const L2 = o => "#/hadith?" + new URLSearchParams(Object.assign({ t: "topic", g: q.g }, src ? { src } : {}, q.tr ? { tr: q.tr } : {}, o)).toString();
      const nav = tot > PG ? `<p class="hpg">${pg > 1 ? `<a class="btn s" href="${L2({ pg: pg - 1 })}">السابق</a> ` : ""}صفحة ${toAr(pg)} من ${toAr(Math.ceil(tot / PG))}${pg * PG < tot ? ` <a class="btn s p" href="${L2({ pg: pg + 1 })}">التالي</a>` : ""}</p>` : "";
      return `<p><a href="#/hadith?t=topic">← المواضيع</a></p><h3>${esc(D.t)}</h3><p class="mut">${toAr(tot)} حديثًا في قائمة واحدة، مرتبة بترتيب المسائل (كما في الصحيحين ثم غيرهما)، وفي كل مسألة الأعلى درجة أولًا: الصحيحان ثم الموطأ وصحاح الأئمة ثم السنن الأربعة ثم بقية المصادر.</p>
      <nav class="chips">${[1, 2, 3, 4].map(n => `<a class="chip${n === tr ? " on" : ""}" href="${L2({ tr: n === 4 ? "" : n, pg: "" })}">${TN[n]}</a>`).join("")}</nav>
      <details class="hfold"${src ? " open" : ""}><summary>تصفية بمصدر واحد${src ? ": " + esc(D.books[src] || src) : ""}</summary><nav class="chips"><a class="chip${!src ? " on" : ""}" href="${L2({ src: "", pg: "" })}">كل المصادر</a>${srcs.map(b => `<a class="chip${b === src ? " on" : ""}" href="${L2({ src: b, pg: "" })}">${esc(D.books[b] || b)}</a>`).join("")}</nav></details>${nav}${rows}${nav}<p class="mut"><a href="#/hadith?t=topic&g=${q.g}&v=abwab">تصفح أبواب الموضوع في الكتب</a></p>`; }
    if (!src) { // الافتراضي: أبواب الموضوع موحَّدة عبر كل المصادر (يُدمج الباب المتشابه العنوان) فتعرض أحاديثه مباشرة
      const nk = t => String(t || "").replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/^\s*(باب|بابُ)\s+/, "").replace(/[\s:،.؟?!-]+$/g, "").replace(/\s+/g, " ").trim(), U = new Map();
      D.a.forEach((x, i) => { const t = x[0] || x[2] || "أحاديث", k = nk(t); if (!U.has(k)) U.set(k, { t, ix: [], n: 0, s: new Set() }); const u = U.get(k); u.ix.push(i); u.n += x[3].length; u.s.add(x[1]) });
      return `<p><a href="#/hadith?t=topic">← الكتب الموضوعية</a></p><h3>${esc(D.t)}</h3><p class="mut">كل أبواب الموضوع مجموعة من كتب السنة في قائمة واحدة؛ اضغط الباب لترى أحاديثه من كل المصادر. وللتضييق اختر مصدرًا:</p>
      <nav class="chips"><a class="chip on" href="#/hadith?t=topic&g=${q.g}">كل المصادر</a>${srcs.map(b => `<a class="chip" href="#/hadith?t=topic&g=${q.g}&src=${b}">${esc(D.books[b] || b)}</a>`).join("")}</nav>
      <div class="hdgl hdun">${[...U.values()].map(u => `<a href="#/hadith?t=topic&g=${q.g}&ab=${u.ix.join(",")}">${esc(u.t)} <span class="mut">${toAr(u.n)} • ${toAr(u.s.size)} مصدرًا</span></a>`).join("")}</div>`; }
    // أبواب الكتاب مجمّعة بكتاب المصنف في كل مصدر
    const by = {}; A_.forEach(([x, i]) => { const k = (D.books[x[1]] || x[1]) + (x[2] ? " — " + x[2] : ""); (by[k] = by[k] || []).push([x, i]); });
    return `<p><a href="#/hadith?t=topic">← الكتب الموضوعية</a></p><h3>${esc(D.t)}</h3>
      <nav class="chips"><a class="chip${!src ? " on" : ""}" href="#/hadith?t=topic&g=${q.g}">كل المصادر</a>${srcs.map(b => `<a class="chip${b === src ? " on" : ""}" href="#/hadith?t=topic&g=${q.g}&src=${b}">${esc(D.books[b] || b)}</a>`).join("")}</nav>
      ${Object.entries(by).map(([k, l]) => `<details class="hfold"${Object.keys(by).length <= 3 ? " open" : ""}><summary>${esc(k)} <span class="mut">(${toAr(l.reduce((n, [x]) => n + x[3].length, 0))})</span></summary><div class="hdgl">${l.map(([x, i]) => `<a href="#/hadith?t=topic&g=${q.g}&ab=${i}">${esc(x[0] || x[2] || "أحاديث")} <span class="mut">${toAr(x[3].length)}</span></a>`).join("")}</div></details>`).join("")}`;
  }
  // مسند الصحابي: العدد الحقيقي لما نُسب إليه في كتب السنة المعروضة (data/hadith/sahabi ← tools/hadith-sahabi.py)
  const RAWSAH = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/hadith/sahabi/" + p, SAHC = {}, saget = p => SAHC[p] || (SAHC[p] = fetch(RAWSAH(p)).then(r => r.json()).catch(() => null));
  async function sahabiView(q) {
    const idx = await saget("_index.json"); if (!idx) return '<p class="mut">تعذّر تحميل المسانيد.</p>';
    if (q.sh == null || q.sh === "") return `<p class="mut">العدد الحقيقي لما نُسب إلى كل صحابي في كتب السنة المعروضة هنا (${toAr(idx.reduce((n, x) => n + x[1], 0))} حديثًا لـ${toAr(idx.length)} صحابيًّا معروفًا)، يُحسب من بيانات الكتب نفسها ويتحدث بتحديثها. اضغط الصحابي لتفتح مسنده.</p><div class="hdgl hdun">${idx.map(([n, c, k], i) => `<a href="#/hadith?t=sahabi&sh=${i}">${esc(n)} <span class="mut">${toAr(c)} حديثًا • ${toAr(k)} كتابًا</span></a>`).join("")}</div>`;
    const me = idx[+q.sh], L = await saget(q.sh + ".json"); if (!me || !L) return "";
    const PG = 60, pg = Math.max(1, +q.pg || 1), part = L.slice((pg - 1) * PG, pg * PG), bySrc = {}; part.forEach(([b, id]) => (bySrc[b] = bySrc[b] || []).push(id));
    const KL_ = await klist(); let rows = "";
    for (const b of Object.keys(bySrc)) { const K = await kidx(b), set = new Set(bySrc[b].map(String));
      rows += `<div class="hsrcg"><span class="hsrc">${esc((KL_[b] && KL_[b].t) || K.t || b)}</span>${(K.items || []).filter(y => set.has(String(y[0]))).map(y => `<a class="hdc" href="#/hadith/k/${b}/${y[0]}"><span class="hds">${y[5] ? "عن " + esc(y[5]) : ""}</span><b>${esc(y[6])}…</b><span class="mut">${esc(K.t || b)} • ${toAr(y[0])}</span></a>`).join("")}</div>`; }
    const nav = L.length > PG ? `<p class="hpg">${pg > 1 ? `<a class="btn s" href="#/hadith?t=sahabi&sh=${q.sh}&pg=${pg - 1}">السابق</a> ` : ""}صفحة ${toAr(pg)} من ${toAr(Math.ceil(L.length / PG))}${pg * PG < L.length ? ` <a class="btn s p" href="#/hadith?t=sahabi&sh=${q.sh}&pg=${pg + 1}">التالي</a>` : ""}</p>` : "";
    return `<p><a href="#/hadith?t=sahabi">← الصحابة</a></p><h3>مسند ${esc(me[0])}</h3><p class="mut">${toAr(me[1])} حديثًا في ${toAr(me[2])} كتابًا، بترتيب الكتب (الصحيحان فالسنن فالمسانيد)</p>${nav}${rows}${nav}`;
  }
  async function kutub(q) {
    const L = await klist(), b = q.kb, qq = (q.q || "").trim(), pg = Math.max(1, +q.pg || 1), u = o => "#/hadith?" + new URLSearchParams(Object.assign({ t: "kutub" }, b ? { kb: b } : {}, o)).toString();
    let body = "";
    if (!b) body = `<div class="hshelf">${Object.entries(L).map(([k, v], i) => `<a class="hbook hb${i % 9}" href="#/hadith?t=kutub&kb=${k}"><b>${esc(v.t.replace(/^(صحيح|سنن|جامع|موطأ|مسند)\s+/, m => m.trim() + "\n"))}</b><span>${esc(v.t)} • ${toAr(v.n)} حديثًا</span></a>`).join("") || '<p class="mut">جارٍ التحميل…</p>'}</div><h3>مراجع علمية مهمة</h3><div class="grid">${Object.entries(BK).map(([bk, nm]) => `<a class="card" href="#/hadith?t=book&b=${encodeURIComponent(bk)}"><b>${esc(nm)}</b><span>${toAr((IX || []).filter(r => r[1] === bk).length)} حديثًا</span></a>`).join("")}</div>`;
    else if (!qq) body = await kread(b, q);
    else { const D = await kidx(b); let it = D.items || [];
      { const w = norm(qq).split(/\s+/).filter(Boolean); it = it.filter(x => { const t = norm(x[6] + " " + x[5] + " " + x[4] + " " + x[3]); return w.every(k => t.includes(k)); }); }
      const np = Math.max(1, Math.ceil(it.length / PER));
      body = `<p><a href="#/hadith?t=kutub">← كتب السنة</a> › <a href="#/hadith?t=kutub&kb=${b}">${esc(D.t || b)}</a></p><form class="sbox" data-form="noop" id="hkq"><input name="q" value="${esc(qq)}" placeholder="ابحث في ${esc(D.t || "")}: طرف الحديث أو الصحابي أو الباب"><button class="btn p">بحث</button></form><p class="mut">${toAr(it.length)} حديثًا</p>
        ${it.slice((pg - 1) * PER, pg * PER).map(x => `<a class="hdc" href="#/hadith/k/${b}/${x[0]}"><span class="hds">${x[5] ? "عن " + esc(x[5]) : ""}</span><b>${esc(x[6])}…</b><span class="mut">${esc(D.t)} • رقم ${toAr(x[0])}${x[4] ? " • " + esc(x[4].slice(0, 70)) : ""}</span></a>`).join("")}
        ${np > 1 ? `<div class="pgn">${pg > 1 ? `<a class="btn s" href="${u({ q: qq, pg: pg - 1 })}">السابقة</a>` : ""}<span class="mut">${toAr(pg)} من ${toAr(np)}</span>${pg < np ? `<a class="btn s" href="${u({ q: qq, pg: pg + 1 })}">التالية</a>` : ""}</div>` : ""}`; }
    return body;
  }
  /* ===== فصل المتن عن الإسناد (طلب المدير، ٢١ نوفمبر ٢٠٢٦) =====
     المتن وحده في العرض الأساسي؛ والإسناد تحته (مطويًّا أو ظاهرًا) أو في أدوات الحديث وحدها بحسب اختيار القارئ (hd_isn).
     الإسناد يُستخرج من نص الكتاب في موضع الحديث: من أول سطر يبدأ بصيغة تحديث قبل المتن إلى بدايته؛
     وإن جاء المتن نفسه بإسناده (بعض النسخ) فُصل عنه بالترضي عن الصحابي أو بذكر النبي ﷺ. */
  const LSG = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
  const LSS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const isnMode = () => LSG("hd_isn", "fold");  // fold: مطوي تحت المتن • show: ظاهر تحت المتن • tools: في أدوات الحديث فقط
  const DIAR = /[ً-ْٰـ]/;
  function nmapJ(s) { const out = [], idx = []; for (let i = 0; i < s.length; i++) { let c = s[i]; if (DIAR.test(c)) continue; c = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ة": "ه" }[c] || c;
      if (!/[ء-ي0-9٠-٩]/.test(c)) c = " "; if (c === " " && out[out.length - 1] === " ") continue; out.push(c); idx.push(i); } return { n: out.join(""), idx }; }
  const CHAIN0 = /^\s*(?:[\(\[]?[\d٠-٩]+[\)\]]?\s*[-–.ـ/]*\s*)*(?:و)?(?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|أنبأني|ثنا|سمعت|قال\s+(?:أبو|حدثنا|أخبرنا))/;
  const SAHR = /رضي\s+الله\s+(?:تعالى\s+)?عن(?:ه|ها|هما|هم|هن)/g;
  const PROPHR = /(?:^|\s)(?:أن|عن|سمعت|سمع|قال|قالت)\s+(?:رسول\s+الله|النبي|نبي\s+الله)/;
  function splitMatn(t) { const s = String(t || ""); let n = "", map = []; for (let i = 0; i < s.length; i++) if (!DIAR.test(s[i])) { n += s[i]; map.push(i); }
    if (!CHAIN0.test(n.slice(0, 60))) return { isnad: "", matn: s };
    const q = n.indexOf("«"), lim = q > 0 ? q : n.length; let cut = -1, m, last = -1; SAHR.lastIndex = 0;
    while ((m = SAHR.exec(n)) && m.index < lim) last = m.index + m[0].length;
    const pp = n.slice(0, lim + 1).search(PROPHR);
    if (pp >= 0 && (last < 0 || pp < last)) cut = pp + (n[pp] === " " ? 1 : 0); else if (last >= 0) cut = last; else if (q > 0) cut = q;
    if (cut < 0) return { isnad: "", matn: s }; while (cut < n.length && /[\s،,:؛.]/.test(n[cut])) cut++;
    if (n.length - cut < 15 || cut < 12) return { isnad: "", matn: s };
    const i = map[cut] ?? s.length; return { isnad: s.slice(0, i).replace(/[\s،,:؛]+$/, ""), matn: s.slice(i) }; }
  const ISC = {};
  async function isnadOf(bid, p, m) { const key = bid + ":" + p + ":" + String(m).slice(0, 30); if (key in ISC) return ISC[key];
    let r = ""; try { const bk = await loadBook(bid), P = bk.pages || [], body = t => String(t || "").split(/^\s*_{4,}\s*$/m)[0].replace(/<[^>]+>/g, "");
      const prev = body(P[p - 2]), txt = prev + "\n" + body(P[p - 1]), N = nmapJ(txt), w = nmapJ(String(m)).n.trim().split(" ").filter(x => x.length > 1);
      let k = -1; for (const L of [6, 4, 3]) { if (w.length < Math.min(L, 2)) continue; const key2 = w.slice(0, L).join(" "); k = N.n.indexOf(key2, Math.max(0, nmapJ(prev).n.length - 400)); if (k < 0) k = N.n.indexOf(key2); if (k >= 0) break; }
      if (k >= 0) { const pos = N.idx[k], lines = txt.slice(0, pos).split("\n"); let j = lines.length - 1;
        while (j >= 0 && !CHAIN0.test(lines[j].replace(/[ً-ْٰـ]/g, ""))) j--;
        if (j >= 0 && lines.length - 1 - j <= 6) r = lines.slice(j).join(" ").replace(/^\s*(?:[\(\[]?[\d٠-٩]+[\)\]]?\s*[-–.ـ/]*\s*)+/, "").replace(/#?\s*\[ص:\s*[\d٠-٩]+\]\s*/g, " ").replace(/^#+\s*/gm, "").replace(/[\s«"(،:]+$/, "").replace(/\s+/g, " ").trim();
        if (r.length > 1200) r = "…" + r.slice(-1200); } } catch (e) { }
    return (ISC[key] = honor(r)); }
  const isnBox = (bid, p, m, mode, inl) => inl ? `<details class="hisn"${mode === "show" ? " open" : ""}><summary>الإسناد</summary><p class="hisnad">${esc(inl)}</p></details>`
    : `<details class="hisn" data-bk="${esc(bid)}" data-p="${p}" data-m="${esc(String(m).slice(0, 120))}"${mode === "show" ? " open" : ""}><summary>الإسناد</summary><p class="hisnad mut">جارٍ استخراج الإسناد من الكتاب…</p></details>`;
  async function fillIsn(d) { if (!d || d.dataset.f || !d.dataset.bk) return; d.dataset.f = 1; const el = d.querySelector(".hisnad"), r = await isnadOf(d.dataset.bk, +d.dataset.p, d.dataset.m);
    el.classList.remove("mut"); el.innerHTML = r ? esc(r) : `لم يُستخرج الإسناد آليًّا من هذا الموضع. <a href="#/book/${esc(d.dataset.bk)}/${d.dataset.p}?h=${encodeURIComponent(d.dataset.m.split(" ").slice(0, 4).join(" "))}">اقرأه بإسناده في الكتاب ←</a>`;
    if (r && typeof HDX !== "undefined" && HDX.colorIsn) HDX.colorIsn(el); }
  document.addEventListener("toggle", e => { const d = e.target; if (d.classList && d.classList.contains("hisn") && d.open) fillIsn(d); }, true);
  const isnOpenAll = () => setTimeout(() => document.querySelectorAll("details.hisn[open]").forEach(fillIsn), 50);
  // ===== خدمات النص في قسم الحديث (طلب المدير، ٢١ نوفمبر): الخط والحجم واللون وتباعد الأسطر وإظهار التشكيل، محفوظة على الجهاز (hd_txt) =====
  const HFONTS = ["Amiri", "Scheherazade New", "Noto Naskh Arabic", "Lateef", "Markazi Text", "Reem Kufi", "Cairo", "Tajawal", "Readex Pro"];
  const HCOL = [["", "الافتراضي"], ["#1b1b1b", "أسود"], ["#0b4a3b", "أخضر داكن"], ["#123a6b", "أزرق داكن"], ["#5a2d0c", "بني"], ["#6b1d4a", "خمري"]];
  const txtSet = () => Object.assign({ f: "", z: 100, c: "", lh: 0, d: 1, h: 1, ha: 1 }, LSG("hd_txt", {}));
  function txtApply() { const t = txtSet(), r = document.documentElement.style;
    if (t.f && typeof loadFont === "function") loadFont(t.f);
    r.setProperty("--hdf", t.f ? `"${t.f}", Amiri, serif` : ""); r.setProperty("--hdz", (t.z / 100) + ""); r.setProperty("--hdc", t.c || ""); r.setProperty("--hdlh", t.lh ? String(t.lh) : "");
    document.documentElement.classList.toggle("hd-nodia", !t.d); }
  // تغيير الإعداد يُعيد رسم الصفحة المفتوحة (لإظهار التشكيل أو إخفائه)
  addEventListener("change", e => { if (e.target.closest("input[type=checkbox][data-hdt]") && typeof route === "function") setTimeout(route, 50); });
  const txtBtn = () => `<button class="btn s" data-act="hdtxt" title="الخط والحجم واللون">Aa خدمات النص</button>`;
  function txtPanel() { const t = txtSet();
    openSheet("خدمات النص في قسم الحديث", `<div class="hdtxtp" data-noswipe><label>الخط<select data-hdt="f"><option value="">الافتراضي (Amiri)</option>${HFONTS.map(f => `<option value="${f}"${t.f === f ? " selected" : ""} style="font-family:'${f}'">${f}</option>`).join("")}</select></label>
      <label>الحجم <b id="hdzv">${toAr(t.z)}٪</b><input type="range" min="80" max="200" step="10" value="${t.z}" data-hdt="z"></label>
      <label>تباعد الأسطر<select data-hdt="lh">${[[0, "الافتراضي"], [1.8, "متقارب"], [2.2, "متوسط"], [2.6, "واسع"]].map(([v, n]) => `<option value="${v}"${+t.lh === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <fieldset><legend>لون النص</legend><div class="hdcols">${HCOL.map(([v, n]) => `<button type="button" class="hdcol${t.c === v ? " on" : ""}" data-hdc="${v}" title="${n}" aria-label="${n}" style="${v ? "background:" + v : ""}">${v ? "" : "A"}</button>`).join("")}<input type="color" data-hdt="c" value="${t.c || "#1b1b1b"}" aria-label="لون مخصص"></div></fieldset>
      <label class="inl"><input type="checkbox" data-hdt="d"${t.d ? " checked" : ""}> إظهار التشكيل</label>
      <label class="inl"><input type="checkbox" data-hdt="h"${t.h !== 0 ? " checked" : ""}> رموز الترضي والسلام مرسومة (كـ«ﷺ»)</label>
      <p class="hdtxtprev">${sym("عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللهِ ﷺ: «الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ»")}</p>
      <button class="btn s" data-act="hdtxtreset">إعادة الافتراضي</button></div>`); }
  const txtSave = (k, v) => { const t = txtSet(); t[k] = v; LSS("hd_txt", t); txtApply(); const z = document.getElementById("hdzv"); if (z) z.textContent = toAr(t.z) + "٪"; };
  document.addEventListener("input", e => { const el = e.target.closest("[data-hdt]"); if (!el) return; const k = el.dataset.hdt; txtSave(k, /^(d|h|ha)$/.test(k) ? (el.checked ? 1 : 0) : k === "z" || k === "lh" ? +el.value : el.value); if (k === "c") document.querySelectorAll(".hdcol").forEach(b => b.classList.remove("on")); });
  document.addEventListener("change", e => { const el = e.target.closest("select[data-hdt],input[type=checkbox][data-hdt]"); if (!el) return; const k = el.dataset.hdt; txtSave(k, /^(d|h|ha)$/.test(k) ? (el.checked ? 1 : 0) : k === "lh" ? +el.value : el.value); });
  document.addEventListener("click", e => { const b = e.target.closest("[data-hdc],[data-act=hdtxt],[data-act=hdtxtreset]"); if (!b) return;
    if (b.dataset.act === "hdtxt") return txtPanel(); if (b.dataset.act === "hdtxtreset") { LSS("hd_txt", {}); txtApply(); return txtPanel(); }
    txtSave("c", b.dataset.hdc); document.querySelectorAll(".hdcol").forEach(x => x.classList.toggle("on", x === b)); });
  txtApply();
  // خيارات التصفح في كتب السنة: حديث واحد في الصفحة (بالسحب أو التالي/السابق) أو عدد يختاره القارئ (hd_per)
  const PERS = [1, 5, 10, 20, 30, 50];
  const perOf = () => Math.max(1, Math.min(100, +LSG("hd_per", 0) || 20));
  const browseOpts = (b, first) => `<div class="row hdbrowse" data-noswipe><label>طريقة التصفح: <select id="hdper" data-kb="${b}" data-at="${esc(String(first))}">${PERS.map(n => `<option value="${n}"${perOf() === n ? " selected" : ""}>${n === 1 ? "حديث واحد في الصفحة (سحب أو التالي/السابق)" : toAr(n) + " أحاديث في الصفحة"}</option>`).join("")}${PERS.includes(perOf()) ? "" : `<option value="${perOf()}" selected>${toAr(perOf())} حديثًا في الصفحة</option>`}<option value="x">عدد آخر…</option></select></label>
    <label>الإسناد: <select id="hdisn">${[["fold", "مطوي تحت المتن"], ["show", "ظاهر تحت المتن"], ["tools", "في أدوات الحديث فقط"]].map(([v, l]) => `<option value="${v}"${isnMode() === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>${txtBtn()}</div>`;
  function firstChoice(b, first) { if (LSG("hd_per", 0)) return "";
    return `<section class="hdchoose card" data-noswipe><b>كيف تحب أن تتصفح الكتاب؟</b><p class="mut">يمكنك تغيير ذلك في أي وقت من «طريقة التصفح».</p><div class="row"><button class="btn p" data-act="hdper" data-v="1" data-kb="${b}" data-at="${esc(String(first))}">📄 حديث واحد في الصفحة</button><button class="btn" data-act="hdper" data-v="10" data-kb="${b}" data-at="${esc(String(first))}">📚 عشرة أحاديث</button><button class="btn" data-act="hdper" data-v="20" data-kb="${b}" data-at="${esc(String(first))}">📚 عشرون حديثًا</button><button class="btn s" data-act="hdper" data-v="x" data-kb="${b}" data-at="${esc(String(first))}">عدد آخر…</button></div></section>`; }
  function setPer(v, b, at) { if (v === "x") { const n = parseInt(String(prompt("عدد الأحاديث في الصفحة (١–١٠٠):", "15") || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10); if (!n) return; v = n; }
    LSS("hd_per", Math.max(1, Math.min(100, +v))); location.hash = "#/hadith?" + new URLSearchParams({ t: "kutub", kb: b, at }).toString(); }
  document.addEventListener("change", e => { const t = e.target; if (t.id === "hdper") setPer(t.value, t.dataset.kb, t.dataset.at); else if (t.id === "hdisn") { LSS("hd_isn", t.value); if (typeof route === "function") route(); } });
  // السحب بين الأحاديث في وضع «حديث واحد» ولوحة المفاتيح (السهم الأيسر: التالي، الأيمن: السابق)
  function swipeNav(el, prevH, nextH) { if (!el) return; let t0 = null;
    el.addEventListener("touchstart", e => { t0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null; }, { passive: true });
    el.addEventListener("touchend", e => { if (!t0) return; const c = e.changedTouches[0], dx = c.clientX - t0.x, dy = c.clientY - t0.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0.t < 800 && !String(getSelection())) { const h = dx > 0 ? nextH : prevH; if (h) { el.classList.add(dx > 0 ? "sw-n" : "sw-p"); location.hash = h; } } t0 = null; }, { passive: true }); }
  let KEYH = null; addEventListener("keydown", e => { if (!KEYH || !document.querySelector(".hread.one") || e.target.closest("input,textarea,select")) return; if (e.key === "ArrowLeft" && KEYH[1]) location.hash = KEYH[1]; else if (e.key === "ArrowRight" && KEYH[0]) location.hash = KEYH[0]; });
  // قراءة كتاب السنة كاملًا كما في المكتبة: الأحاديث متتابعة بمتونها تحت كتبها وأبوابها، صفحةً صفحة،
  // مع فهرس الكتب والانتقال إلى صفحة أو رقم حديث، وتحت كل حديث خدماته (الشرح من الدرر السنية، التخريج والأحكام، النسخ).
  async function kread(b, q) {
    const RPER = perOf(), one1 = RPER === 1, mode = isnMode();
    const D = await kidx(b), it = D.items || [], np = Math.max(1, Math.ceil(it.length / RPER));
    if (!it.length) return `<p><a href="#/hadith?t=kutub">← كتب السنة</a></p><p class="note">تعذّر تحميل الكتاب.</p>`;
    let pg = Math.min(np, Math.max(1, +q.pg || 1)); if (q.at) { const k = it.findIndex(x => String(x[0]) === String(q.at)); if (k >= 0) pg = Math.floor(k / RPER) + 1; }
    const k0 = (pg - 1) * RPER, sl = it.slice(k0, k0 + RPER), MM = {};
    const LL = {}; for (const c of [...new Set(sl.map((x, j) => Math.floor((k0 + j) / 500)))]) { const [a1, a2] = await Promise.all([kmatn(b, c), klead(b, c)]); Object.assign(MM, a1); Object.assign(LL, a2); }
    const u = p => "#/hadith?" + new URLSearchParams({ t: "kutub", kb: b, pg: p }).toString();
    const toc = []; it.forEach((x, i) => { if (x[3] && (!toc.length || toc[toc.length - 1][0] !== x[3])) toc.push([x[3], Math.floor(i / RPER) + 1, x[0]]); });
    let lk = null, lb = null;  // أول كل صفحة: كتابها وبابها
    const rows = sl.map(x => { let h = ""; if (x[3] && x[3] !== lk) { h += `<h3 class="hrk">${esc(x[3])}</h3>`; lb = null; } if (x[4] && x[4] !== lb) h += `<h4 class="hrb">${esc(x[4])}</h4>`; lk = x[3]; lb = x[4];
      const m = MM[String(x[0])] || x[6], cite = (x[5] ? "عن " + x[5] + ": " : "") + "«" + m + "» — " + D.t + " (" + x[0] + ")";
      const sp = splitMatn(m), isn = mode === "tools" ? "" : isnBox(x[1], x[2], sp.matn, mode, sp.isnad);
      return h + `<article class="hrh${one1 ? " hrone" : ""}" id="hr${esc(String(x[0]))}"><a class="hrn" href="#/hadith/k/${b}/${x[0]}" title="خدمات الحديث">${toAr(x[0])}</a>${LL[String(x[0])] ? "" : x[5] ? `<p class="hds">${sym("عن " + esc(x[5]), x[5])}</p>` : ""}<p class="hdm">${LL[String(x[0])] ? withLead(LL[String(x[0])], sp.matn, x[5]) : sym(esc(clean(sp.matn)))}</p>${isn}
        <div class="hra"><a class="btn s" href="#/hadith/k/${b}/${x[0]}">خدمات الحديث</a><button class="btn s" data-act="hdrsh" data-b="${b}" data-n="${esc(String(x[0]))}">📖 شرحه</button><a class="btn s" href="#/book/${esc(x[1])}/${x[2]}?h=${encodeURIComponent(String(x[6]).split(" ").slice(0, 4).join(" "))}" title="بإسناده في الكتاب">📚 بإسناده</a><button class="btn s" data-act="hkcopy" data-t="${esc(cite)}">نسخ</button></div><div class="hrsh" hidden></div></article>`; }).join("");
    const nav = top => one1 ? `<div class="pgn hrpg hrone-nav" data-noswipe>${pg > 1 ? `<a class="btn" href="${u(pg - 1)}" rel="prev">› السابق</a>` : "<span></span>"}<span class="mut">الحديث ${toAr(pg)} من ${toAr(np)}${sl[0] ? " • رقم " + toAr(sl[0][0]) : ""}</span>${pg < np ? `<a class="btn p" href="${u(pg + 1)}" rel="next">التالي ‹</a>` : "<span></span>"}</div>`
      : `<div class="pgn hrpg">${pg > 1 ? `<a class="btn s" href="${u(1)}" title="أول الكتاب">«</a><a class="btn s" href="${u(pg - 1)}">› السابقة</a>` : ""}<span class="mut">صفحة ${toAr(pg)} من ${toAr(np)} • الأحاديث ${toAr(sl[0][0])}–${toAr(sl[sl.length - 1][0])}</span>${pg < np ? `<a class="btn s" href="${u(pg + 1)}">التالية ‹</a><a class="btn s" href="${u(np)}" title="آخر الكتاب">»</a>` : ""}</div>`;
    KEYH = one1 ? [pg > 1 ? u(pg - 1) : null, pg < np ? u(pg + 1) : null] : null;
    setTimeout(() => { const el = document.querySelector(".hread.one"); if (el && !el.dataset.sw) { el.dataset.sw = 1; swipeNav(el, KEYH && KEYH[0], KEYH && KEYH[1]); } isnOpenAll(); }, 60);
    return `<p><a href="#/hadith?t=kutub">← كتب السنة</a> <b>${esc(D.t || b)}</b> <span class="mut">${toAr(it.length)} حديثًا</span>${NINE.includes(b) && sl[0] ? ` <button class="btn s" data-act="shexp" data-b="${b}" data-n="${esc(String(sl[0][0]))}">⬇ تنزيل الشرح</button>` : ""}</p>
      ${firstChoice(b, sl[0] ? sl[0][0] : "")}
      ${one1 ? "" : nav(1)}<div class="hread${one1 ? " one" : ""}" data-kb="${b}"${one1 ? ' data-noswipe' : ""}>${rows}</div>${nav(0)}
      <div class="hrbelow"><form class="sbox" data-form="noop" id="hkq"><input name="q" placeholder="ابحث في ${esc(D.t || "")}: طرف الحديث أو الصحابي أو الباب"><button class="btn p">بحث</button></form>
      <div class="row hrtools">${toc.length > 1 ? `<select id="hrtoc" aria-label="فهرس الكتاب"><option value="">📑 فهرس الكتاب…</option>${toc.map(([t, p, n]) => `<option value="${p}"${p === pg ? " selected" : ""}>${esc(t.slice(0, 70))} (${toAr(n)})</option>`).join("")}</select>` : ""}
        <form id="hrgo" data-form="noop" class="row"><input name="n" inputmode="numeric" placeholder="رقم الحديث" aria-label="انتقل إلى رقم حديث" data-novoice style="width:7.5em"><button class="btn s">انتقل</button></form>
        <form id="hrpgf" data-form="noop" class="row"><input name="p" inputmode="numeric" placeholder="الصفحة" aria-label="انتقل إلى صفحة" data-novoice style="width:5.5em"><button class="btn s">صفحة</button></form></div>${browseOpts(b, sl[0] ? sl[0][0] : "")}</div>`;
  }
  // شرح الحديث من «الموسوعة الحديثية» في الدرر السنية (عبر api/translate?dsharh=)
  const DSC = {};
  async function dsharh(q) { const k = String(q).slice(0, 160); if (!DSC[k]) DSC[k] = fetch("api/translate?dsharh=" + encodeURIComponent(k)).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || "تعذّر جلب الشرح"); return j; }); return DSC[k].catch(e => { delete DSC[k]; throw e; }); }
  const dsharhHtml = (j, q) => j && j.text ? `<div class="hdbrief">${esc(j.text).replace(/\n+/g, "</p><p>").replace(/^/, "<p>")}</p></div><p class="mut">المصدر: شروح الأحاديث — الموسوعة الحديثية، الدرر السنية${j.url ? ` • <a href="${esc(j.url)}" target="_blank" rel="noopener">الشرح في موضعه ↗</a>` : ""}</p>`
    : `<p class="mut">لم يُعثر على شرح لهذا الحديث في الدرر السنية. <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(String(q).split(/\s+/).slice(0, 8).join(" "))}" target="_blank" rel="noopener">ابحث فيها ↗</a></p>`;
  async function dsharhInto(el, q) { if (!el) return; el.hidden = false; el.innerHTML = '<p class="mut">جارٍ جلب الشرح من الدرر السنية…</p>';
    try { el.innerHTML = dsharhHtml(await dsharh(q), q); } catch (e) { el.innerHTML = `<p class="mut">${esc(e.message)} — <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(String(q).split(/\s+/).slice(0, 8).join(" "))}" target="_blank" rel="noopener">ابحث في الدرر السنية ↗</a></p>`; } }
  // البحث في كتب السنة كلها مع المختارات، وكل نتيجة تفتح في موضعها من القسم
  async function kutubSearch(qq) {
    const box = document.createElement("section"); box.id = "hdks"; box.className = "stsec"; box.innerHTML = '<h3>في كتب السنة</h3><p class="mut">جارٍ البحث في الصحيحين والسنن والموطأ…</p>';
    const anchor = $(".pgn") || [...document.querySelectorAll(".hdc")].pop() || $("#hdq"); if (!anchor) return; anchor.after(box);
    const L = await klist(), w = norm(qq).split(/\s+/).filter(Boolean); let html = "", tot = 0;
    const SC = typeof HDX !== "undefined" ? HDX.scope() : null; if (typeof HDX !== "undefined") HDX.remember(qq);
    await Promise.all(Object.keys(L).filter(b => !SC || SC.includes(b)).map(async b => { const D = await kidx(b), it = (D.items || []).filter(x => { const t = norm(x[6] + " " + x[5] + " " + x[4] + " " + x[3]); return w.every(k => t.includes(k)); }); L[b]._hits = it; }));
    Object.entries(L).forEach(([b, v]) => { const it = (!SC || SC.includes(b)) ? v._hits || [] : []; if (!it.length) return; tot += it.length;
      html += `<details class="hfold"${tot <= 30 ? " open" : ""}><summary>${esc(v.t)} <span class="mut">(${toAr(it.length)})</span></summary>${it.slice(0, 8).map(x => `<a class="hdc" href="#/hadith/k/${b}/${x[0]}"><span class="hds">${x[5] ? "عن " + esc(x[5]) : ""}</span><b>${esc(x[6])}…</b><span class="mut">${esc(v.t)} • ${toAr(x[0])}${x[4] ? " • " + esc(x[4].slice(0, 60)) : ""}</span></a>`).join("")}${it.length > 8 ? `<a class="all" href="#/hadith?t=kutub&kb=${b}&q=${encodeURIComponent(qq)}">كل النتائج في ${esc(v.t)} (${toAr(it.length)}) ←</a>` : ""}</details>`; });
    box.innerHTML = `<h3>في كتب السنة <span class="mut">(${toAr(tot)})</span></h3>` + (html || '<p class="mut">لا نتائج في كتب السنة.</p>');
  }
  async function kone(b, n) {
    const D = await kidx(b), k = (D.items || []).findIndex(x => String(x[0]) === String(n)); if (k < 0) return view('<p class="note">الحديث غير موجود.</p>');
    await klist(); const x = D.items[k], M = await kmatn(b, Math.floor(k / 500)), LD = (await klead(b, Math.floor(k / 500)))[String(x[0])] || "", m = M[String(x[0])] || x[6], prev = D.items[k - 1], next = D.items[k + 1], SPX = splitMatn(m);
    window.__hdIsn = { bk: x[1], p: x[2], m: SPX.matn, inl: SPX.isnad };
    view(`<p><a href="#/hadith?t=kutub&kb=${b}&at=${encodeURIComponent(x[0])}">← ${esc(D.t)} (موضعه في الكتاب)</a>${x[3] ? " › " + esc(x[3]) : ""}</p>
    <article class="hdone"><p class="hds"${LD ? " hidden" : ""}>${x[5] ? "عن " + esc(x[5]) : ""}</p><p class="hdm">${withLead(LD, SPX.matn, x[5])}</p>${isnMode() === "tools" ? "" : isnBox(x[1], x[2], SPX.matn, isnMode(), SPX.isnad)}<p class="hdt"><b>${esc(D.t)}</b> • ${(KL && KL[b] && KL[b].seq) ? "تسلسله في نسخة المكتبة" : "رقمه"} ${toAr(x[0])}${x[4] ? " • " + esc(x[4]) : ""}</p>
    <p class="mut"><a href="#/book/${esc(x[1])}/${x[2]}?h=${encodeURIComponent(x[6].split(" ").slice(0, 4).join(" "))}">اقرأ الحديث بإسناده في موضعه من الكتاب ←</a></p></article>
    ${["abudawud", "tirmidhi", "nasai", "ibnmajah"].includes(b) ? '<section class="stsec" id="hdgr"><p class="mut">…</p></section>' : ""}
    <section class="stsec" id="hdlk"><p class="mut">…</p></section>
    <section class="stsec"><h3>شرح الحديث</h3><div id="hdds"><p class="mut">…</p></div></section>
    <section class="stsec"><h3>أحكام المحدثين وتخريجه</h3><div id="hddr"><button class="btn p s" data-act="hddorar" data-q="${esc(m.split(/\s+/).slice(0, 7).join(" "))}">اعرض أحكام المحدثين من الموسوعة الحديثية</button></div></section>
    <div class="row">${txtBtn()}${typeof hadithSheet === "function" ? `<button class="btn" data-act="hksharh" data-m="${esc(m.slice(0, 400))}">شروح الحديث في المكتبة</button>` : ""}<button class="btn" data-act="hkcopy" data-t="${esc((x[5] ? "عن " + x[5] + ": " : "") + "«" + m + "» — " + D.t + " (" + x[0] + ")")}">نسخ</button><a class="btn" href="#/ask?m=hadith&q=${encodeURIComponent("خرّج حديث: «" + m.slice(0, 250) + "»")}">التخريج والفوائد (المساعد)</a><a class="btn" href="#/ask?m=balagha&q=${encodeURIComponent("اذكر الفوائد البلاغية في حديث: «" + m.slice(0, 250) + "»")}">فوائد بلاغية</a></div>
    <div class="mnav mnb">${next ? `<a class="btn s" href="#/hadith/k/${b}/${next[0]}">‹ التالي</a>` : "<span></span>"}${prev ? `<a class="btn s" href="#/hadith/k/${b}/${prev[0]}">السابق ›</a>` : ""}</div>`);
    linksBox(b, x[0]); gradesBox(b, x[0]); sharhInto($("#hdds"), b, x[0], true); isnOpenAll();
    swipeNav(document.querySelector("article.hdone"), prev ? "#/hadith/k/" + b + "/" + prev[0] : null, next ? "#/hadith/k/" + b + "/" + next[0] : null);
  }
  async function page(q, id) {
    if (id && String(id).startsWith("k:")) { const [, b, n] = id.split(":"); return kone(b, n); }
    await load(); if (id) return one(id);
    const t = q.t || "topic", qq = (q.q || "").trim(), u = o => "#/hadith?" + new URLSearchParams(Object.assign({ t }, o)).toString();
    let L = IX.map(F), body = "", side = "";
    if (qq) { const w = norm(qq).split(/\s+/).filter(Boolean); L = L.filter(x => { const s = norm(x.tarf + " " + x.sah + " " + x.bab); return w.every(k => s.includes(k)); }); }
    if (t === "topic" && !qq) { side = await topics(q); L = []; }
    else if (t === "book") { if (q.b) L = L.filter(x => x.b === q.b); else side = `<div class="grid">${Object.entries(BK).map(([b, n]) => `<a class="card" href="${u({ b })}"><b>${esc(n)}</b><span>${toAr(IX.filter(r => r[1] === b).length)} حديثًا</span></a>`).join("")}</div>`; }
    else if (t === "atraf") { const l = q.l || "ا"; side = `<nav class="chips hdlet">${LET.map(c => `<a class="chip${c === l ? " on" : ""}" href="${u({ l })}">${c}</a>`.replace(`l=${encodeURIComponent(l)}`, "l=" + encodeURIComponent(c))).join("")}</nav>`; L = L.filter(x => first(x.tarf) === l).sort((a, b) => a.tarf.localeCompare(b.tarf, "ar")); }
    else if (t === "sahabi" && !q.s) { side = await sahabiView(q); L = []; }
    else if (t === "sahabi") { const c = {}; L.forEach(x => { const k = x.sah.replace(/^(أمير المؤمنين|أبي|أبى)\s+/, m => m).trim(); if (k) (c[k] = c[k] || []).push(x); });
      if (q.s) L = c[q.s] || []; else side = `<div class="hdgl">${Object.entries(c).sort((a, b) => b[1].length - a[1].length).slice(0, 300).map(([k, l]) => `<a href="${u({ s: k })}">${esc(k)} <span class="mut">${toAr(l.length)}</span></a>`).join("")}</div>`; }
    if (t === "kutub") { side = await kutub(q); L = []; }
    if (t === "fav") { side = HDX.favHtml(q.f); L = []; }
    const showList = qq || (t === "book" && q.b) || t === "atraf" || (t === "sahabi" && q.s), pg = Math.max(1, +q.pg || 1), np = Math.max(1, Math.ceil(L.length / PER));
    // التعريف بالقسم في واجهته وحدها؛ وعند قراءة كتاب يأتي نص الأحاديث أولًا والأدوات تحته (طلب المدير، ٢١ نوفمبر)
    const home = !qq && !q.kb && !q.g && !q.b && !q.s && !q.l && !q.f && !q.pg && !q.at, reading = t === "kutub" && !!q.kb;
    const HERO = home ? `<div class="cmhero"><div><h2>الحديث النبوي</h2><p>كتب السنة المشهورة (الصحيحان والسنن الأربع والموطأ والدارمي ومسند أحمد وسنن البيهقي الكبرى وشعب الإيمان والأدب المفرد والشمائل وعمل اليوم والليلة وشرح السنة للبغوي، نحو مئة ألف حديث، وتُضاف إليها الكتب الأخرى تباعًا) مع رياض الصالحين والأربعين النووية وبلوغ المرام، مرتبةً على الكتب العلمية وأبوابها، مع موضع شرح كل حديث في شروحه المشهورة والشرح الموجز منها، وتخريجه في كتب السنة، وأحكام المحدثين من الموسوعة الحديثية. والمختارات بنصها: مرتبة بالموضوع، وبالمصدر، وبأطرافها، وبالصحابي؛ مع التخريج وحكم المصنف وشرحه، والانتقال إلى موضعها، وتصديرها بقوالب.</p></div></div>` : "", TOOLS = `
    <details class="hfold"><summary>🔎 ابحث عن أي حديث وحكمه في كتب السنة (الموسوعة الحديثية)</summary><div><form class="sbox" data-form="noop" id="hddq"><input name="q" type="search" placeholder="اكتب جزءًا من متن الحديث" aria-label="بحث في الموسوعة الحديثية"><button class="btn p">ابحث</button></form><div id="hddr"></div></div></details>
    <div class="row"><button class="btn s" data-act="hdoff">${offState("hadith", "قسم الحديث")}</button></div>
    <form class="sbox" data-form="noop" id="hdq"><input name="q" type="search" value="${esc(qq)}" placeholder="ابحث بطرف الحديث أو الصحابي أو الباب" aria-label="بحث في الأحاديث"><button class="btn p">بحث</button></form>
    <div class="tabs" role="tablist">${[["kutub", "كتب السنة"], ["topic", "موضوعي"], ["atraf", "الأطراف (معجمي)"], ["sahabi", "بحسب الصحابي"], ["fav", "⭐ مجلداتي"]].map(([k, n]) => `<a role="tab" aria-selected="${k === t}" href="#/hadith?t=${k}">${n}</a>`).join("")}</div>`;
    view(HERO + (reading ? "" : TOOLS) + `
    ${((q.g && t !== "topic") || q.b || q.s) ? `<p><a href="#/hadith?t=${t === "book" ? "kutub" : t}">← ${t === "topic" ? "الأبواب" : t === "book" ? "كتب السنة" : "الصحابة"}</a> <b>${esc(q.g ? q.g.split(" › ").slice(-1)[0] : q.b ? BK[q.b] : q.s)}</b></p>` : ""}
    ${side}${reading ? `<section class="hdtoolsb"><h3 class="mut">أدوات قسم الحديث</h3>${TOOLS}</section>` : ""}${showList ? `<p class="mut">${toAr(L.length)} حديثًا</p>${L.slice((pg - 1) * PER, pg * PER).map(card).join("")}${np > 1 ? `<div class="pgn">${pg > 1 ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg - 1 }))}">السابقة</a>` : ""}<span class="mut">${toAr(pg)} من ${toAr(np)}</span>${pg < np ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg + 1 }))}">التالية</a>` : ""}</div>` : ""}` : ""}`);
    $("#hdq").addEventListener("submit", e => { e.preventDefault(); location.hash = u({ q: e.target.q.value.trim() }); });
    if (qq && t !== "kutub") kutubSearch(qq);
    $("#hddq").addEventListener("submit", e => { e.preventDefault(); dorar(e.target.q.value.trim()); });
    const hk = $("#hkq"); if (hk) hk.addEventListener("submit", e => { e.preventDefault(); location.hash = "#/hadith?" + new URLSearchParams({ t: "kutub", kb: q.kb, q: e.target.q.value.trim() }).toString(); });
    const AN = v => String(v || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim(), kr = n => "#/hadith?" + new URLSearchParams(Object.assign({ t: "kutub", kb: q.kb }, n)).toString();
    const toc = $("#hrtoc"); if (toc) toc.onchange = () => toc.value && (location.hash = kr({ pg: toc.value }));
    const hg = $("#hrgo"); if (hg) hg.addEventListener("submit", e => { e.preventDefault(); const n = AN(e.target.n.value); if (n) location.hash = kr({ at: n }); });
    const hp = $("#hrpgf"); if (hp) hp.addEventListener("submit", e => { e.preventDefault(); const n = parseInt(AN(e.target.p.value)); if (n > 0) location.hash = kr({ pg: n }); });
    if (q.at) setTimeout(() => { const el = document.getElementById("hr" + q.at); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("hrhit"); } }, 60);
  }
  const card = x => `<a class="hdc" href="#/hadith/x/${x.id}"><span class="hds">${esc(x.sah ? "عن " + x.sah : "")}</span><b>${esc(x.tarf)}…</b><span class="mut">${esc(x.t)}${x.h ? " • " + esc(x.h) : ""} • ${esc(BK[x.b] || x.b)}</span></a>`;
  async function one(id) {
    const r = IX.find(x => x[0] === id); if (!r) return view('<p class="note">الحديث غير موجود.</p>');
    const x = F(r), d = (await det(x.b))[id] || {}, b = B(x.b);
    view(`<p><a href="#/hadith?t=topic">← الحديث</a> › <a href="#/hadith?t=topic&g=${encodeURIComponent((BK[x.b] || x.b) + " › " + (x.k && x.k !== x.bab ? x.k + " › " : "") + x.bab)}">${esc(x.bab)}</a></p>
    <article class="hdone"><p class="hds">${esc(x.sah ? "عن " + x.sah + " رضي الله عنه" : "")}</p><p class="hdm">«${esc(d.m || x.tarf)}»</p>
    ${x.t ? `<p class="hdt"><b>التخريج:</b> ${esc(x.t)}</p>` : ""}${x.h ? `<p class="hdt"><b>الحكم (من كلام المصنف):</b> ${esc(x.h)}</p>` : ""}
    <p class="mut">المصدر: <a href="#/book/${x.b}/${x.p}?h=${encodeURIComponent(x.tarf.split(" ").slice(0, 4).join(" "))}">${esc(BK[x.b] || (b && b.title) || x.b)}، ${esc(b ? PL(b, x.p - 1) || "ص " + toAr(x.p) : "ص " + toAr(x.p))}</a></p>
    ${d.sh ? `<details open><summary><b>شرح موجز من الكتاب</b></summary><p class="hdsh">${esc(d.sh)}</p></details>` : ""}
    <details><summary><b>النص كما في الكتاب</b></summary><p class="hdsh">${esc(d.full || "")}</p></details></article>
    <section class="stsec" id="hdlk"><p class="mut">…</p></section>
    <section class="stsec"><h3>شرح الحديث</h3><div id="hdds"><p class="mut">…</p></div></section>
    <section class="stsec"><h3>أحكام المحدثين وتخريجه في كتب السنة</h3><p class="mut">من «الموسوعة الحديثية» في الدرر السنية: روايات الحديث في المصادر، وحكم كل محدث عليه من المتقدمين والمعاصرين.</p><div id="hddr"><button class="btn p s" data-act="hddorar" data-q="${esc((d.m || x.tarf).split(/\s+/).slice(0, 7).join(" "))}">اعرض أحكام المحدثين</button></div></section>
    <div class="row"><button class="btn p" data-act="hdexp" data-id="${id}">تصدير بقالب</button><button class="btn" data-act="hdcopy" data-id="${id}">نسخ</button>${typeof hadithSheet === "function" ? `<button class="btn" data-act="hdsharh" data-id="${id}">شروح الحديث في المكتبة</button>` : ""}<a class="btn" href="#/ask?q=${encodeURIComponent("أعرب الحديث: «" + (d.m || x.tarf).slice(0, 300) + "» إعرابًا مفصلًا، واذكر أهم ما يستفاد منه من شروح الحديث في المكتبة مع الإحالة")}">الإعراب وما يستفاد منه (المساعد)</a></div>`);
    linksBox(x.b, id); sharhInto($("#hdds"), x.b, id, true);
  }
  async function exp(id) {
    const r = IX.find(x => x[0] === id), x = F(r), d = (await det(x.b))[id] || {};
    openSheet("تصدير الحديث", `<form id="hdx" data-form="noop"><fieldset><legend>ما يظهر</legend>${[["sah", "الراوي (الصحابي)", 1], ["m", "المتن", 1], ["t", "التخريج والعزو", 1], ["h", "الحكم", 1], ["sh", "الشرح الموجز", 0], ["src", "المصدر والصفحة", 1]].map(([k, n, c]) => `<label class="inl"><input type="checkbox" name="${k}"${c ? " checked" : ""}> ${n}</label>`).join(" ")}</fieldset>
     <label class="inl"><input type="checkbox" name="tash"> إزالة التشكيل</label>
     <div class="row"><div><label>القالب</label><select name="tpl"><option value="id">هوية المكتبة</option><option value="cl">كلاسيكي</option><option value="mn">بسيط</option></select></div><div><label>الخط</label><select name="ff"><option>Amiri</option><option>Aref Ruqaa</option><option value="IBM Plex Sans Arabic">بلكس</option><option>Traditional Arabic</option></select></div><div><label>الحجم</label><input type="number" name="fs" value="30" min="16" max="60"></div><div><label>الصيغة</label><select name="f"><option value="png">صورة</option><option value="doc">Word</option><option value="txt">نص</option></select></div></div>
     <button class="btn p">تصدير</button></form>`, () => { $("#hdx").addEventListener("submit", e => { e.preventDefault(); run(e.target, x, d); }); });
  }
  async function run(f, x, d) {
    const on = k => f[k].checked, T = s => f.tash.checked ? strip(s) : s, src = (BK[x.b] || x.b) + "، " + (PL(B(x.b) || {}, x.p - 1) || "ص " + x.p);
    const parts = [on("sah") && x.sah ? ["s", "عن " + x.sah + " رضي الله عنه"] : null, on("m") ? ["m", "«" + T(d.m || x.tarf) + "»"] : null, on("t") && x.t ? ["t", T(x.t)] : null, on("h") && x.h ? ["t", T(x.h)] : null, on("sh") && d.sh ? ["c", T(d.sh)] : null, on("src") ? ["r", src] : null].filter(Boolean);
    const F_ = f.f.value, ff = f.ff.value, fs = +f.fs.value || 30;
    if (F_ === "txt") return dl("حديث.txt", parts.map(p => p[1]).join("\n") + "\n\n" + SITENAME, "text/plain");
    if (F_ === "doc") return dl("حديث.doc", `<html><head><meta charset="utf-8"><style>body{direction:rtl;font-family:'${ff}',serif;font-size:${Math.round(fs * .6)}pt}.m{font-size:${Math.round(fs * .8)}pt;line-height:1.9;text-align:center}.s,.t,.r{color:#555}.c{border-right:3pt solid #b88a2e;padding-right:8pt}</style></head><body dir="rtl">${parts.map(p => `<p class="${p[0]}">${esc(p[1])}</p>`).join("")}<p class="r">${esc(SITENAME)}</p></body></html>`, "application/msword");
    try { await document.fonts.load(`${fs}px "${ff}"`); } catch (e) { }
    const W = 1080, P = 80, cv = document.createElement("canvas"), c = cv.getContext("2d"), tpl = f.tpl.value;
    const font = k => k === "m" ? `${fs}px "${ff}"` : k === "c" ? `${Math.round(fs * .62)}px "Amiri"` : `${Math.round(fs * .58)}px "Amiri"`;
    const wrap = (t, k) => { c.font = font(k); const ws = t.split(/\s+/), out = []; let ln = ""; ws.forEach(w => { const tt = ln ? ln + " " + w : w; if (c.measureText(tt).width > W - 2 * P && ln) { out.push(ln); ln = w; } else ln = tt; }); if (ln) out.push(ln); return out; };
    const lines = []; parts.forEach(([k, t]) => { wrap(t, k).forEach(l => lines.push([k, l])); lines.push(["gap", ""]); });
    const lh = k => k === "m" ? fs * 1.9 : k === "gap" ? fs * .5 : fs * 1.15; cv.width = W; cv.height = Math.min(12000, P * 2 + 80 + lines.reduce((h, l) => h + lh(l[0]), 0));
    const BG = { id: ["#fbf7ee", "#0f5c4d", "#b88a2e"], cl: ["#f3ead8", "#5a3a17", "#a8741a"], mn: ["#ffffff", "#1d2326", "#999"] }[tpl];
    c.fillStyle = BG[0]; c.fillRect(0, 0, W, cv.height); c.strokeStyle = BG[2]; c.lineWidth = tpl === "mn" ? 1 : 5; c.strokeRect(28, 28, W - 56, cv.height - 56); if (tpl === "id") { c.lineWidth = 1.5; c.strokeRect(40, 40, W - 80, cv.height - 80); }
    c.direction = "rtl"; c.textAlign = "center"; let y = P + 30;
    lines.forEach(([k, t]) => { y += lh(k); if (k === "gap") return; c.font = font(k); c.fillStyle = k === "m" ? BG[1] : "#444"; c.fillText(t, W / 2, y); });
    c.font = `18px "Amiri"`; c.fillStyle = "#8a7a5a"; c.fillText(SITENAME, W / 2, cv.height - 44);
    cv.toBlob(bl => dl("حديث.png", bl, "image/png"), "image/png");
  }
  // أحكام المحدثين من الدرر السنية (عبر api/translate?dorar=) مع العزو والرابط
  async function dorar(q) { const el = $("#hddr"); if (!el || q.length < 6) return; el.innerHTML = '<p class="mut">جارٍ البحث في الموسوعة الحديثية…</p>';
    try { const r = await fetch("api/translate?dorar=" + encodeURIComponent(q)), j = await r.json(); if (!r.ok) throw new Error(j.message);
      el.innerHTML = (j.items || []).length ? `<div class="sttab"><table><thead><tr><th>الحديث</th><th>الراوي</th><th>المحدث</th><th>المصدر</th><th>الحكم</th><th>في المكتبة</th></tr></thead><tbody>${j.items.map((x, i) => `<tr><td class="hdsh">${esc(x.matn.slice(0, 220))}${x.matn.length > 220 ? "…" : ""}</td><td>${esc(x.rawi)}</td><td><b>${esc(x.muhaddith)}</b></td><td>${esc(x.src)}${x.page ? " (" + esc(x.page) + ")" : ""}</td><td><b class="hdh">${esc(x.hukm)}</b></td><td id="hdloc${i}" class="mut">…</td></tr>`).join("")}</tbody></table></div><p class="mut">المصدر: ${esc(j.src)} • <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">البحث في الدرر السنية ↗</a></p>` : '<p class="mut">لا نتائج. جرّب جزءًا آخر من المتن.</p>';
      await klist(); (j.items || []).forEach(async (x, i) => { const L = await locate(x.matn), c = $("#hdloc" + i); if (c) c.innerHTML = L.length ? L.map(([b, n]) => `<a class="chip" href="${hurl(b, n)}">${esc(bname(b))}${CUR.test(b) ? "" : " " + toAr(n)}</a>`).join("") : "—"; });
    } catch (e) { el.innerHTML = `<p class="mut">تعذّر الوصول إلى الموسوعة الحديثية الآن. <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">ابحث في الدرر السنية ↗</a></p>`; } }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "hddorar") dorar(el.dataset.q);
    else if (a === "hdper") setPer(el.dataset.v, el.dataset.kb, el.dataset.at);
    else if (a === "shexp") sharhExport(el.dataset.b, el.dataset.n);
    else if (a === "shedit") sharhEdit(el.dataset.b, el.dataset.n);
    else if (a === "dwok") dawahSet(el.dataset.b, el.dataset.n, +el.dataset.i, e => { e.fst = "ok"; e.fby = "admin"; }, "شروح مشايخ الدعوة: اعتماد فوائد الحديث " + el.dataset.n).catch(x => toast(x.message));
    else if (a === "dwdel") dawahSet(el.dataset.b, el.dataset.n, +el.dataset.i, e => { e.f.splice(+el.dataset.k, 1); }, "شروح مشايخ الدعوة: حذف فائدة من الحديث " + el.dataset.n).catch(x => toast(x.message));
    else if (a === "hdrsh") { const box = el.closest(".hrh").querySelector(".hrsh"); if (!box.hidden && box.dataset.f) { box.hidden = true; return; } box.dataset.f = 1; sharhInto(box, el.dataset.b, el.dataset.n, false); }
    if (a === "hdoff") offSave("hadith", async say => { say("جارٍ تجهيز القائمة…"); const L = await klist(), out = ["data/hadith/index.json", "data/hadith/arbain.json", "data/hadith/riyad.json", "data/hadith/bulugh.json", RAWK("_list.json"), RAWT("_index.json")];
      Object.entries(L).forEach(([b, v]) => { out.push(RAWK(b + ".json"), RAWL(b + ".json")); for (let i = 0; i < Math.ceil((v.n || 0) / 500); i++) out.push(RAWK(b + "/m" + i + ".json")); if (["abudawud", "tirmidhi", "nasai", "ibnmajah"].includes(b)) out.push(RAWK("").replace("/k/", "/grades/") + b + ".json"); });
      ["arbain", "riyad", "bulugh"].forEach(b => out.push(RAWL(b + ".json"))); for (let i = 0; i < 27; i++) out.push(RAWT(i + ".json")); return out; }, el, "قسم الحديث");
    else if (a === "hdbrief") brief(el.dataset.b, el.dataset.n);
    else if (a === "hkcopy") navigator.clipboard.writeText(el.dataset.t + "\n" + SITENAME).then(() => toast("نُسخ"));
    else if (a === "hksharh") hadithSheet(el.dataset.m);
    else if (a === "hdexp") exp(el.dataset.id);
    else if (a === "hdcopy") { const r = IX.find(x => x[0] === el.dataset.id), x = F(r); det(x.b).then(D => navigator.clipboard.writeText(`عن ${x.sah} رضي الله عنه: «${(D[x.id] || {}).m || x.tarf}» ${x.t}${x.h ? " — " + x.h : ""}\n${BK[x.b] || x.b}`).then(() => toast("نُسخ"))); }
    else if (a === "hdsharh") { const r = IX.find(x => x[0] === el.dataset.id), x = F(r); det(x.b).then(D => hadithSheet((D[x.id] || {}).m || x.tarf)); } });
  return { view: page, isnadOf, splitMatn };
})();

/* من الشرح إلى الحديث: في صفحة من كتب الشروح (فتح الباري، المنهاج، عون المعبود…) يظهر أعلاها «هذا الموضع شرح حديث …» برابطه في قسم الحديث
   (data/hadith/links/_rev/<ملف الشرح>.json من tools/hadith-rev.py). */
const HDREV = (() => { const C = new Map(); let last = "";
  const get = f => C.get(f) || (C.set(f, fetch("https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/hadith/links/_rev/" + f + ".json").then(r => r.ok ? r.json() : null).catch(() => null)), C.get(f));
  const NAMES = { bukhari: "صحيح البخاري", muslim: "صحيح مسلم", abudawud: "سنن أبي داود", tirmidhi: "سنن الترمذي", nasai: "سنن النسائي", ibnmajah: "سنن ابن ماجه", muwatta: "الموطأ", darimi: "سنن الدارمي", musnadahmad: "مسند أحمد", sunankubra: "السنن الكبرى للبيهقي", shuabiman: "شعب الإيمان", adabmufrad: "الأدب المفرد", shamail: "الشمائل المحمدية", amalyawm: "عمل اليوم والليلة", baghawisunna: "شرح السنة للبغوي", ibnkhuzayma: "صحيح ابن خزيمة", ibnhibban: "صحيح ابن حبان", mustadrak: "المستدرك", daraqutni: "سنن الدارقطني", nasaikubra: "السنن الكبرى للنسائي", ibnabishayba: "مصنف ابن أبي شيبة", abdrazzaq: "مصنف عبد الرزاق", arbain: "الأربعين النووية", riyad: "رياض الصالحين", bulugh: "بلوغ المرام" };
  async function paint() { const m = location.pathname.match(/^\/book\/([^/]+)\/(\d+)/); if (!m) return; const key = m[1] + ":" + m[2]; if (key === last) return; last = key;
    const d = await get(m[1]); const old = document.getElementById("hdrev"); if (old) old.remove(); if (!d || !d[m[2]]) return;
    const host = document.querySelector("#rb") || document.querySelector(".rd"); if (!host) return;
    host.insertAdjacentHTML("beforebegin", `<div id="hdrev" class="hdrev">📜 هذا الموضع شرحُ ${d[m[2]].map(([b, n]) => `<a href="${/^(arbain|riyad|bulugh)/.test(b) ? "#/hadith/x/" + n : "#/hadith/k/" + b + "/" + n}">الحديث ${/^(arbain|riyad|bulugh)/.test(b) ? toAr(String(n).split("-").pop()) : toAr(n)} من ${NAMES[b] || b}</a>`).join("، ")} — اعرض نصه وتخريجه وشروحه الأخرى.</div>`); }
  addEventListener("popstate", () => setTimeout(paint, 300)); addEventListener("hashchange", () => setTimeout(paint, 300));
  new MutationObserver(() => { if (document.querySelector("#rb") && !document.getElementById("hdrev")) { last = ""; paint(); } }).observe(document.documentElement, { childList: true, subtree: true });
  return { paint };
})();

/* قسم الحديث — تحسينات مستفادة من تطبيقات الحديث المتخصصة (طلب المدير):
   نطاق البحث (الصحيحان، السنن الأربع، الكتب الستة، المسانيد والمصنفات، الكل) وسجل البحث بتاريخه؛ وفي صفحة الحديث: سطر البيانات (الرقم والكتاب والباب)،
   وتلوين الإسناد (الرواة بالأزرق والصحابي بالأحمر)، وتبويب ما تحته (تخريج • حكم • رواة • شرح • ملاحظات)، وزر عائم لأدوات الحديث
   (البحث في الكتاب، الفهرس، الانتقال إلى رقم، نسخ التخريج العلمي، المشاركة، الحفظ في مجلد)، ومجلدات المفضلة على الجهاز. */
const HDX = (() => {
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  const SCOPES = [["sahihain", "الصحيحان", ["bukhari", "muslim"]], ["sunan", "السنن الأربع", ["abudawud", "tirmidhi", "nasai", "ibnmajah"]], ["sitta", "الكتب الستة", ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah"]], ["masanid", "المسانيد والمصنفات والسنن الأخرى", ["musnadahmad", "darimi", "sunankubra", "shuabiman", "baghawisunna", "ibnkhuzayma", "ibnhibban", "mustadrak", "daraqutni", "nasaikubra", "ibnabishayba", "abdrazzaq", "tayalisi", "humaydi", "abuyala", "tabaranikabir", "tabaraniawsat", "tabaranisaghir", "ibnjarud", "saidmansur", "tahawimaani", "abuawana", "bazzar", "musnadshafii"]], ["all", "كل كتب السنة", null]];
  const scope = () => { const k = LS("hd_scope") || "all", x = SCOPES.find(s => s[0] === k); return x ? x[2] : null; };
  const remember = q => { if (!q) return; const L = (LS("hd_recent") || []).filter(x => x.q !== q); L.unshift({ q, at: Date.now() }); LS("hd_recent", L.slice(0, 20)); };
  function searchExtras() { const f = document.getElementById("hdq"); if (!f || f.dataset.hdx) return; f.dataset.hdx = 1; const k = LS("hd_scope") || "all", R = LS("hd_recent") || [];
    f.insertAdjacentHTML("afterend", `<div class="hdscope"><span class="mut">نطاق البحث في كتب السنة:</span>${SCOPES.map(([v, n]) => `<label class="chip${v === k ? " on" : ""}"><input type="radio" name="hdsc" value="${v}"${v === k ? " checked" : ""} hidden> ${n}</label>`).join("")}</div>
      ${R.length ? `<details class="hdrecent"><summary>🕘 آخر ما بحثت عنه</summary><div>${R.slice(0, 8).map(x => `<a href="#/hadith?q=${encodeURIComponent(x.q)}"><b>${esc(x.q)}</b><small>${new Date(x.at).toLocaleString("ar-EG", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</small></a>`).join("")}<button class="btn s" data-act="hdxclr">مسح السجل</button></div></details>` : ""}`);
    document.querySelectorAll("[name=hdsc]").forEach(r => r.onchange = () => { LS("hd_scope", r.value); document.querySelectorAll(".hdscope .chip").forEach(c => c.classList.toggle("on", c.contains(r))); }); }
  // تلوين الإسناد: ما بعد صيغ التحديث إلى الفاصلة اسم راوٍ، والصحابي باسمه
  const RAWI = /((?:حدثنا|حدثني|أخبرنا|أخبرني|أنبأنا|سمعت|عن)\s+)((?:(?!حدثنا|أخبرنا|حدثني|عن\s|قال)[^\s،,:«»"؛.]+\s?){1,5}?)(?=\s*[،,:]|\s+(?:قال|عن|أن|أنه|حدثنا|حدثني|أخبرنا|يقول|يحدث|رضي))/g, BADN = /(^|\s)(فإنه|كان|يحب|ثم|إذا|لا|ما|من|في|على|إلى|الذي|قد|لم|هو|هي|إن|أن)(\s|$)/;
  function colorize(art) { const hds = art.querySelector(".hds"), m = art.querySelector(".hdm"); if (hds && !hds.dataset.c) { hds.dataset.c = 1; hds.innerHTML = hds.innerHTML.replace(/^(عن\s+)(.+?)(\s+رضي الله عنه.*)?$/, (x, a, b, c) => a + `<span class="hsah">${b}</span>` + (c || "")); }
    art.querySelectorAll(".hisnad").forEach(colorIsn); }
  // تلوين الرواة في الإسناد (لا في المتن)؛ ويُستدعى أيضًا بعد استخراج الإسناد من الكتاب
  function colorIsn(m) { if (!m || m.dataset.c) return; m.dataset.c = 1; m.innerHTML = m.innerHTML.replace(RAWI, (x, a, b) => /رسول الله|النبي|صلى الله|^الله/.test(b) || BADN.test(b.trim()) ? x : a + `<span class="hrawi">${b.trim()}</span> `); }
  // تبويب ما تحت الحديث
  function tabify() { const art = document.querySelector("article.hdone"); if (!art || art.dataset.tabs) return; art.dataset.tabs = 1; colorize(art);
    const secs = { tkh: document.getElementById("hdlk"), hukm: [document.getElementById("hdgr"), document.getElementById("hddr") && document.getElementById("hddr").closest("section")].filter(Boolean) };
    const I = window.__hdIsn || {}; if (I.inl) { const d = document.createElement("p"); d.className = "hisnad"; d.textContent = I.inl; colorIsn(d); I.html = d.innerHTML; }
    const names = [...new Set([...(art.querySelectorAll(".hsah,.hrawi"))].map(e => e.textContent.trim()))];
    const key = "hd_note:" + location.pathname, note = LS(key) || "";
    const bar = document.createElement("div"); bar.className = "hdtabs"; bar.innerHTML = `<div class="tabs" role="tablist">${[["tkh", "تخريج"], ["hukm", "حكم"], ["isnad", "الإسناد"], ["ruwat", "رواة"], ["sharh", "شرح"], ["notes", "ملاحظات"]].map(([k, n], i) => `<a role="tab" href="#" data-hdt="${k}" aria-selected="${!i}">${n}</a>`).join("")}</div>
      <div class="hdpane" data-p="isnad" hidden><p class="hisnad" id="hdisnt">${I.html || '<span class="mut">جارٍ استخراج الإسناد من الكتاب…</span>'}</p><p class="mut"><a href="#/book/${esc(I.bk || "")}/${I.p || 1}">اقرأ الحديث بإسناده في موضعه من الكتاب ←</a></p></div>
      <div class="hdpane" data-p="ruwat" hidden>${names.length ? names.map(n => `<a class="chip" href="#/alam?q=${encodeURIComponent(n)}">👤 ${esc(n)}</a>`).join("") + '<p class="mut">اضغط الاسم لترجمته وأقوال أئمة الجرح والتعديل فيه من كتب التراجم بالمكتبة.</p>' : '<p class="mut">لم يُذكر إسناد في هذا النص؛ اقرأه بإسناده في موضعه من الكتاب.</p>'}</div>
      <div class="hdpane" data-p="sharh" hidden><p class="mut">مواضع شرحه في شروح المكتبة وتلخيصها:</p><div id="hdsh2"></div></div>
      <div class="hdpane" data-p="notes" hidden><textarea id="hdnote" rows="4" placeholder="ملاحظاتك على هذا الحديث (تُحفظ على جهازك)">${esc(note)}</textarea></div>`;
    const first = secs.tkh || secs.hukm[0]; if (!first) return; first.before(bar);
    const pane = (k, els) => els.forEach(e => { if (e) { e.classList.add("hdpane"); e.dataset.p = k; } }); pane("tkh", [secs.tkh]); pane("hukm", secs.hukm);
    const sh = () => { const lk = document.getElementById("hdlk"); const dst = document.getElementById("hdsh2"); if (lk && dst && !dst.dataset.f) { const h3 = [...lk.querySelectorAll("h3")].find(h => /شرح/.test(h.textContent)); if (h3) { dst.dataset.f = 1; let n = h3.nextElementSibling; const mv = []; while (n && n.tagName !== "H3") { mv.push(n); n = n.nextElementSibling; } mv.forEach(x => dst.appendChild(x)); h3.remove(); } } };
    const ruwat = () => { const n2 = [...new Set([...document.querySelectorAll(".hsah,.hrawi")].map(e => e.textContent.trim()))], pn = bar.querySelector('[data-p="ruwat"]'); if (pn && n2.length) pn.innerHTML = n2.map(n => `<a class="chip" href="#/alam?q=${encodeURIComponent(n)}">👤 ${esc(n)}</a>`).join("") + '<p class="mut">اضغط الاسم لترجمته وأقوال أئمة الجرح والتعديل فيه من كتب التراجم بالمكتبة.</p>'; };
    if (!I.inl && I.bk && typeof HDS !== "undefined") HDS.isnadOf(I.bk, I.p, I.m).then(r => { const el = document.getElementById("hdisnt"); if (!el) return; el.innerHTML = r ? esc(r) : '<span class="mut">لم يُستخرج الإسناد آليًّا؛ اقرأه في موضعه من الكتاب.</span>'; if (r) { colorIsn(el); ruwat(); } });
    const show = k => { sh(); if (k === "ruwat") ruwat(); document.querySelectorAll(".hdpane").forEach(e => e.hidden = e.dataset.p !== k); bar.querySelectorAll("[data-hdt]").forEach(a => a.setAttribute("aria-selected", a.dataset.hdt === k)); };
    bar.addEventListener("click", e => { const a = e.target.closest("[data-hdt]"); if (!a) return; e.preventDefault(); show(a.dataset.hdt); });
    bar.addEventListener("input", e => { if (e.target.id === "hdnote") LS(key, e.target.value); });
    setTimeout(() => show("tkh"), 400); fab(art); }
  // الزر العائم لأدوات الحديث
  function fab(art) { if (document.getElementById("hdfab")) return; document.body.insertAdjacentHTML("beforeend", '<button id="hdfab" class="hdfab" data-act="hdxmenu" aria-label="أدوات الحديث">▦</button>'); }
  const curInfo = () => { const art = document.querySelector("article.hdone"); if (!art) return null; const t = (art.querySelector(".hdt") || {}).textContent || "", m = (art.querySelector(".hdm") || {}).textContent || "", sah = (art.querySelector(".hds") || {}).textContent || "", bab = [...document.querySelectorAll("#app > p a, #app > p")].map(x => x.textContent).join(" ").replace(/←/g, "").trim();
    return { url: location.pathname, t, m, sah, bab, title: m.slice(0, 80) }; };
  function menu() { const c = curInfo(); if (!c) return; const F = LS("hd_folders") || { "غير مصنف": [] };
    openSheet("أدوات الحديث", `<div class="hdmenu"><button data-act="hdxdo" data-k="find">🔎 البحث في الكتاب</button><button data-act="hdxdo" data-k="index">📑 فهرس الكتاب</button><button data-act="hdxdo" data-k="jump">#️⃣ التنقل بين أرقام الأحاديث</button><button data-act="hdxdo" data-k="cite">🔗 نسخ التخريج العلمي</button><button data-act="hdxdo" data-k="share">⤴ مشاركة الحديث</button>
      <h4>احفظ في مجلد</h4>${Object.keys(F).map(n => `<button class="hdfold" data-act="hdxsave" data-f="${esc(n)}">📁 ${esc(n)} <small>${toAr(F[n].length)}</small> ${F[n].some(x => x.url === c.url) ? "✓" : "＋"}</button>`).join("")}<button data-act="hdxnewf">📂 إنشاء مجلد جديد</button></div>`); }
  async function act(k) { const c = curInfo(); if (!c) return; const m = location.pathname.match(/hadith\/k\/([^/]+)\/([^/]+)/);
    if (k === "find" || k === "index") { closeSheet(); location.hash = m ? "#/hadith?t=kutub&kb=" + m[1] : "#/hadith"; if (k === "find") setTimeout(() => { const i = document.querySelector("#hkq input,#hdq input"); if (i) i.focus(); }, 900); }
    else if (k === "jump") { const n = prompt("رقم الحديث:"); if (n && m) { closeSheet(); location.hash = "#/hadith/k/" + m[1] + "/" + String(n).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim(); } }
    else if (k === "cite") { const txt = `${c.sah ? c.sah + ": " : ""}${c.m.trim()}\n${c.t.trim()}${c.bab ? "\n" + c.bab : ""}\n${location.origin + c.url}`; try { await navigator.clipboard.writeText(txt); toast("نُسخ التخريج العلمي"); } catch (e) { } }
    else if (k === "share") { const d = { title: "حديث نبوي", text: c.m.trim().slice(0, 600) + "\n" + c.t.trim(), url: location.origin + c.url }; if (navigator.share) navigator.share(d).catch(() => { }); else { navigator.clipboard.writeText(d.text + "\n" + d.url); toast("نُسخ الرابط"); } } }
  function save(f) { const c = curInfo(); if (!c) return; const F = LS("hd_folders") || { "غير مصنف": [] }; F[f] = F[f] || []; const i = F[f].findIndex(x => x.url === c.url); if (i >= 0) F[f].splice(i, 1); else F[f].unshift({ url: c.url, title: c.title, t: c.t.trim(), at: Date.now() }); LS("hd_folders", F); toast(i >= 0 ? "أُزيل من «" + f + "»" : "حُفظ في «" + f + "»"); menu(); }
  function favHtml(f) { const F = LS("hd_folders") || {}; const ks = Object.keys(F).filter(k => F[k].length || k !== "غير مصنف");
    if (!ks.length) return '<p class="note">لا أحاديث محفوظة بعد. افتح أي حديث ثم اضغط زر الأدوات ▦ ← «احفظ في مجلد».</p>';
    if (f && F[f]) return `<p><a href="#/hadith?t=fav">← المجلدات</a> <b>📁 ${esc(f)}</b> <button class="btn s" data-act="hdxdelf" data-f="${esc(f)}">حذف المجلد</button></p>${F[f].map(x => `<a class="hdc" href="${esc(x.url)}"><b>${esc(x.title)}…</b><span class="mut">${esc(x.t)}</span></a>`).join("") || '<p class="mut">المجلد فارغ.</p>'}`;
    return `<div class="grid">${ks.map(k => `<a class="card" href="#/hadith?t=fav&f=${encodeURIComponent(k)}"><b>📁 ${esc(k)}</b><span>${toAr(F[k].length)} حديثًا</span></a>`).join("")}</div>`; }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act^=hdx]"); if (!el) return; e.preventDefault(); const a = el.dataset.act;
    if (a === "hdxmenu") menu(); else if (a === "hdxdo") act(el.dataset.k); else if (a === "hdxsave") save(el.dataset.f);
    else if (a === "hdxnewf") { const n = (prompt("اسم المجلد الجديد:") || "").trim().slice(0, 40); if (!n) return; const F = LS("hd_folders") || { "غير مصنف": [] }; F[n] = F[n] || []; LS("hd_folders", F); save(n); }
    else if (a === "hdxdelf") { if (!confirm("حذف المجلد وما فيه؟")) return; const F = LS("hd_folders") || {}; delete F[el.dataset.f]; LS("hd_folders", F); location.hash = "#/hadith?t=fav"; }
    else if (a === "hdxclr") { LS("hd_recent", []); el.closest("details").remove(); } });
  new MutationObserver(() => { searchExtras(); if (document.querySelector("article.hdone")) tabify(); else { const f = document.getElementById("hdfab"); if (f) f.remove(); }
    if (document.querySelector(".hshelf") && !document.getElementById("rqfont")) document.head.insertAdjacentHTML("beforeend", '<link id="rqfont" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=swap">'); }).observe(document.documentElement, { childList: true, subtree: true });
  return { scope, remember, favHtml, colorIsn };
})();
