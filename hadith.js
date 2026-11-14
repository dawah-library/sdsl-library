/* قسم الحديث (البند ١٩): #/hadith — الأحاديث بنصها من كتب المكتبة المرتبة (tools/hadith.py ← data/hadith):
   ترتيب موضوعي (الكتاب والباب)، وبحسب المصدر، ومعجمي بأطراف الأحاديث، وبحسب الصحابي؛ مع التخريج وحكم المصنف وشرحه الموجز
   من الكتاب نفسه ورقم الصفحة، وشروح كتب الحديث في المكتبة، والإعراب بالمساعد للأعضاء.
   التصدير: يختار القارئ ما يظهر (الراوي، المتن، التخريج، الحكم، الشرح، المصدر) والخط والحجم والقالب، نصًا أو Word أو صورة. */
const HDS = (() => {
  let IX = null, BK = {}; const DET = {};
  const load = async () => { if (!IX) { try { const j = await (await fetch("data/hadith/index.json")).json(); IX = j.items || []; BK = j.books || {}; } catch (e) { IX = []; } } return IX; };
  const det = async b => DET[b] || (DET[b] = fetch("data/hadith/" + b + ".json").then(r => r.json()).catch(() => ({})));
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
      if (e) { const c = (await sget("c/" + e[1] + ".json"))[e[0]]; if (c) return c; } }
    return null;
  }
  const refLink = r => { const [v, p] = r.split(":"), bk = B(v); return `<a class="cite" href="#/book/${esc(v)}/${p}">(${esc(bk ? (bk.setTitle || bk.title).replace(/ — .*$/, "") : v)}${bk && bk.vol ? "، ج" + toAr(bk.vol) : ""}، ص ${toAr(p)})</a>`; };
  const sx = t => esc(t || "").replace(/\[\[([^\]\s]+?:\d+)\]\]/g, (m, r) => refLink(r)).replace(/\n+/g, "</p><p>");
  const FW = [["fiqh", "فوائد فقهية"], ["aqida", "فوائد عقدية"], ["adab", "فوائد تربوية وأدبية"], ["ilm", "فوائد علمية"]];
  function sharhHtml(c, full) {
    const S_ = c.s || {}, li = a => (a || []).filter(Boolean).map(x => `<li>${sx(x)}</li>`).join("");
    const riw = (c.riw || []).map(([b2, n2]) => `<a class="chip" href="#/hadith/k/${b2}/${encodeURIComponent(n2)}">${esc(bname(b2))} (${toAr(n2)})</a>`).join("");
    const parts = [
      (S_.gharib || []).length ? `<h4>غريب الحديث</h4><dl class="shg">${S_.gharib.map(g => `<dt>${esc(g.w || "")}</dt><dd>${sx(g.m)}</dd>`).join("")}</dl>` : "",
      S_.murad ? `<h4>معنى ألفاظه وجمله</h4><p>${sx(S_.murad)}</p>` : "",
      (S_.mubhamat || []).length ? `<h4>المبهمات</h4><ul>${li(S_.mubhamat)}</ul>` : "",
      S_.usul ? `<h4>المنسوخ والمجمل والعام والخاص</h4><p>${sx(S_.usul)}</p>` : "",
      S_.riwayat ? `<h4>ما تزيده الروايات الأخرى</h4><p>${sx(S_.riwayat)}</p>` : "",
      S_.ijmali ? `<h4>المعنى الإجمالي</h4><p>${sx(S_.ijmali)}</p>` : "",
      FW.some(([k]) => (S_.fawaid || {})[k] && S_.fawaid[k].length) ? `<h4>فوائد الحديث</h4>${FW.map(([k, n]) => ((S_.fawaid || {})[k] || []).length ? `<h5>${n}</h5><ul>${li(S_.fawaid[k])}</ul>` : "").join("")}` : ""];
    return `<div class="shbox">${full ? parts.join("") : parts.slice(0, 2).concat(parts.slice(5)).join("")}
      ${riw ? `<p class="mut shr"><b>الروايات المشروحة معه:</b> ${riw}</p>` : ""}
      <p class="mut shn">شرح مجموع من الشروح المعتمدة في المكتبة بعزو كل نقطة إلى موضعها، أُعدّ آليًّا (${esc(c.at || "")}) وهو قيد المراجعة العلمية.</p></div>`;
  }
  const NOSH = '<p class="mut">لم يُشرح هذا الحديث بعد. يجري الشرح يوميًّا: صحيح البخاري، ثم زوائد مسلم، فأبي داود، فالنسائي، فالترمذي، فابن ماجه، فمسند أحمد، فالموطأ؛ ويُشرح الحديث مع رواياته كلها مرة واحدة.</p>';
  async function sharhInto(el, b, n, full) { if (!el) return; el.hidden = false; el.innerHTML = '<p class="mut">جارٍ تحميل الشرح…</p>';
    const c = await sharhOf(b, n); el.innerHTML = c ? sharhHtml(c, full) : NOSH; }
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
    if (q.ab != null && q.ab !== "") { const x = D.a[+q.ab]; if (!x) return ""; const [b, sb, kt, ids] = x;
      let rows = "";
      if (BK[sb]) { await load(); rows = ids.map(id => IX.find(r => r[0] === id)).filter(Boolean).map(r => card(F(r))).join(""); }
      else { const K = await kidx(sb), set = new Set(ids.map(String)); rows = (K.items || []).filter(y => set.has(String(y[0]))).map(y => `<a class="hdc" href="#/hadith/k/${sb}/${y[0]}"><span class="hds">${y[5] ? "عن " + esc(y[5]) : ""}</span><b>${esc(y[6])}…</b><span class="mut">${esc(K.t || sb)} • ${toAr(y[0])}</span></a>`).join(""); }
      return `<p><a href="#/hadith?t=topic">← الكتب الموضوعية</a> › <a href="#/hadith?t=topic&g=${q.g}">${esc(D.t)}</a></p><h3>${esc(b || kt)}</h3><p class="mut">${esc(D.books[sb] || sb)}${kt ? " • " + esc(kt) : ""} • ${toAr(ids.length)} حديثًا</p>${rows}`; }
    // أبواب الكتاب مجمّعة بكتاب المصنف في كل مصدر
    const by = {}; A_.forEach(([x, i]) => { const k = (D.books[x[1]] || x[1]) + (x[2] ? " — " + x[2] : ""); (by[k] = by[k] || []).push([x, i]); });
    return `<p><a href="#/hadith?t=topic">← الكتب الموضوعية</a></p><h3>${esc(D.t)}</h3>
      <nav class="chips"><a class="chip${!src ? " on" : ""}" href="#/hadith?t=topic&g=${q.g}">كل المصادر</a>${srcs.map(b => `<a class="chip${b === src ? " on" : ""}" href="#/hadith?t=topic&g=${q.g}&src=${b}">${esc(D.books[b] || b)}</a>`).join("")}</nav>
      ${Object.entries(by).map(([k, l]) => `<details class="hfold"${Object.keys(by).length <= 3 ? " open" : ""}><summary>${esc(k)} <span class="mut">(${toAr(l.reduce((n, [x]) => n + x[3].length, 0))})</span></summary><div class="hdgl">${l.map(([x, i]) => `<a href="#/hadith?t=topic&g=${q.g}&ab=${i}">${esc(x[0] || x[2] || "أحاديث")} <span class="mut">${toAr(x[3].length)}</span></a>`).join("")}</div></details>`).join("")}`;
  }
  async function kutub(q) {
    const L = await klist(), b = q.kb, qq = (q.q || "").trim(), pg = Math.max(1, +q.pg || 1), u = o => "#/hadith?" + new URLSearchParams(Object.assign({ t: "kutub" }, b ? { kb: b } : {}, o)).toString();
    let body = "";
    if (!b) body = `<div class="hshelf">${Object.entries(L).map(([k, v], i) => `<a class="hbook hb${i % 9}" href="#/hadith?t=kutub&kb=${k}"><b>${esc(v.t.replace(/^(صحيح|سنن|جامع|موطأ|مسند)\s+/, m => m.trim() + "\n"))}</b><span>${esc(v.t)} • ${toAr(v.n)} حديثًا</span></a>`).join("") || '<p class="mut">جارٍ التحميل…</p>'}</div>`;
    else if (!qq) body = await kread(b, q);
    else { const D = await kidx(b); let it = D.items || [];
      { const w = norm(qq).split(/\s+/).filter(Boolean); it = it.filter(x => { const t = norm(x[6] + " " + x[5] + " " + x[4] + " " + x[3]); return w.every(k => t.includes(k)); }); }
      const np = Math.max(1, Math.ceil(it.length / PER));
      body = `<p><a href="#/hadith?t=kutub">← كتب السنة</a> › <a href="#/hadith?t=kutub&kb=${b}">${esc(D.t || b)}</a></p><form class="sbox" data-form="noop" id="hkq"><input name="q" value="${esc(qq)}" placeholder="ابحث في ${esc(D.t || "")}: طرف الحديث أو الصحابي أو الباب"><button class="btn p">بحث</button></form><p class="mut">${toAr(it.length)} حديثًا</p>
        ${it.slice((pg - 1) * PER, pg * PER).map(x => `<a class="hdc" href="#/hadith/k/${b}/${x[0]}"><span class="hds">${x[5] ? "عن " + esc(x[5]) : ""}</span><b>${esc(x[6])}…</b><span class="mut">${esc(D.t)} • رقم ${toAr(x[0])}${x[4] ? " • " + esc(x[4].slice(0, 70)) : ""}</span></a>`).join("")}
        ${np > 1 ? `<div class="pgn">${pg > 1 ? `<a class="btn s" href="${u({ q: qq, pg: pg - 1 })}">السابقة</a>` : ""}<span class="mut">${toAr(pg)} من ${toAr(np)}</span>${pg < np ? `<a class="btn s" href="${u({ q: qq, pg: pg + 1 })}">التالية</a>` : ""}</div>` : ""}`; }
    return body;
  }
  // قراءة كتاب السنة كاملًا كما في المكتبة: الأحاديث متتابعة بمتونها تحت كتبها وأبوابها، صفحةً صفحة،
  // مع فهرس الكتب والانتقال إلى صفحة أو رقم حديث، وتحت كل حديث خدماته (الشرح من الدرر السنية، التخريج والأحكام، النسخ).
  const RPER = 20;
  async function kread(b, q) {
    const D = await kidx(b), it = D.items || [], np = Math.max(1, Math.ceil(it.length / RPER));
    if (!it.length) return `<p><a href="#/hadith?t=kutub">← كتب السنة</a></p><p class="note">تعذّر تحميل الكتاب.</p>`;
    let pg = Math.min(np, Math.max(1, +q.pg || 1)); if (q.at) { const k = it.findIndex(x => String(x[0]) === String(q.at)); if (k >= 0) pg = Math.floor(k / RPER) + 1; }
    const k0 = (pg - 1) * RPER, sl = it.slice(k0, k0 + RPER), MM = {};
    for (const c of [...new Set(sl.map((x, j) => Math.floor((k0 + j) / 500)))]) Object.assign(MM, await kmatn(b, c));
    const u = p => "#/hadith?" + new URLSearchParams({ t: "kutub", kb: b, pg: p }).toString();
    const toc = []; it.forEach((x, i) => { if (x[3] && (!toc.length || toc[toc.length - 1][0] !== x[3])) toc.push([x[3], Math.floor(i / RPER) + 1, x[0]]); });
    let lk = null, lb = null;  // أول كل صفحة: كتابها وبابها
    const rows = sl.map(x => { let h = ""; if (x[3] && x[3] !== lk) { h += `<h3 class="hrk">${esc(x[3])}</h3>`; lb = null; } if (x[4] && x[4] !== lb) h += `<h4 class="hrb">${esc(x[4])}</h4>`; lk = x[3]; lb = x[4];
      const m = MM[String(x[0])] || x[6], cite = (x[5] ? "عن " + x[5] + ": " : "") + "«" + m + "» — " + D.t + " (" + x[0] + ")";
      return h + `<article class="hrh" id="hr${esc(String(x[0]))}"><a class="hrn" href="#/hadith/k/${b}/${x[0]}" title="خدمات الحديث">${toAr(x[0])}</a>${x[5] ? `<p class="hds">عن ${esc(x[5])}</p>` : ""}<p class="hdm">${esc(m)}</p>
        <div class="hra"><a class="btn s" href="#/hadith/k/${b}/${x[0]}">خدمات الحديث</a><button class="btn s" data-act="hdrsh" data-b="${b}" data-n="${esc(String(x[0]))}">📖 شرحه</button><a class="btn s" href="#/book/${esc(x[1])}/${x[2]}?h=${encodeURIComponent(String(x[6]).split(" ").slice(0, 4).join(" "))}" title="بإسناده في الكتاب">📚 بإسناده</a><button class="btn s" data-act="hkcopy" data-t="${esc(cite)}">نسخ</button></div><div class="hrsh" hidden></div></article>`; }).join("");
    const nav = top => `<div class="pgn hrpg">${pg > 1 ? `<a class="btn s" href="${u(1)}" title="أول الكتاب">«</a><a class="btn s" href="${u(pg - 1)}">› السابقة</a>` : ""}<span class="mut">صفحة ${toAr(pg)} من ${toAr(np)} • الأحاديث ${toAr(sl[0][0])}–${toAr(sl[sl.length - 1][0])}</span>${pg < np ? `<a class="btn s" href="${u(pg + 1)}">التالية ‹</a><a class="btn s" href="${u(np)}" title="آخر الكتاب">»</a>` : ""}</div>`;
    return `<p><a href="#/hadith?t=kutub">← كتب السنة</a> <b>${esc(D.t || b)}</b> <span class="mut">${toAr(it.length)} حديثًا</span></p>
      <form class="sbox" data-form="noop" id="hkq"><input name="q" placeholder="ابحث في ${esc(D.t || "")}: طرف الحديث أو الصحابي أو الباب"><button class="btn p">بحث</button></form>
      <div class="row hrtools">${toc.length > 1 ? `<select id="hrtoc" aria-label="فهرس الكتاب"><option value="">📑 فهرس الكتاب…</option>${toc.map(([t, p, n]) => `<option value="${p}"${p === pg ? " selected" : ""}>${esc(t.slice(0, 70))} (${toAr(n)})</option>`).join("")}</select>` : ""}
        <form id="hrgo" data-form="noop" class="row"><input name="n" inputmode="numeric" placeholder="رقم الحديث" aria-label="انتقل إلى رقم حديث" data-novoice style="width:7.5em"><button class="btn s">انتقل</button></form>
        <form id="hrpgf" data-form="noop" class="row"><input name="p" inputmode="numeric" placeholder="الصفحة" aria-label="انتقل إلى صفحة" data-novoice style="width:5.5em"><button class="btn s">صفحة</button></form></div>
      ${nav(1)}<div class="hread" data-kb="${b}">${rows}</div>${nav(0)}`;
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
    await klist(); const x = D.items[k], M = await kmatn(b, Math.floor(k / 500)), m = M[String(x[0])] || x[6], prev = D.items[k - 1], next = D.items[k + 1];
    view(`<p><a href="#/hadith?t=kutub&kb=${b}&at=${encodeURIComponent(x[0])}">← ${esc(D.t)} (موضعه في الكتاب)</a>${x[3] ? " › " + esc(x[3]) : ""}</p>
    <article class="hdone"><p class="hds">${x[5] ? "عن " + esc(x[5]) : ""}</p><p class="hdm">«${esc(m)}»</p><p class="hdt"><b>${esc(D.t)}</b> • ${(KL && KL[b] && KL[b].seq) ? "تسلسله في نسخة المكتبة" : "رقمه"} ${toAr(x[0])}${x[4] ? " • " + esc(x[4]) : ""}</p>
    <p class="mut"><a href="#/book/${esc(x[1])}/${x[2]}?h=${encodeURIComponent(x[6].split(" ").slice(0, 4).join(" "))}">اقرأ الحديث بإسناده في موضعه من الكتاب ←</a></p></article>
    ${["abudawud", "tirmidhi", "nasai", "ibnmajah"].includes(b) ? '<section class="stsec" id="hdgr"><p class="mut">…</p></section>' : ""}
    <section class="stsec" id="hdlk"><p class="mut">…</p></section>
    <section class="stsec"><h3>شرح الحديث</h3><div id="hdds"><p class="mut">…</p></div></section>
    <section class="stsec"><h3>أحكام المحدثين وتخريجه</h3><div id="hddr"><button class="btn p s" data-act="hddorar" data-q="${esc(m.split(/\s+/).slice(0, 7).join(" "))}">اعرض أحكام المحدثين من الموسوعة الحديثية</button></div></section>
    <div class="row">${typeof hadithSheet === "function" ? `<button class="btn" data-act="hksharh" data-m="${esc(m.slice(0, 400))}">شروح الحديث في المكتبة</button>` : ""}<button class="btn" data-act="hkcopy" data-t="${esc((x[5] ? "عن " + x[5] + ": " : "") + "«" + m + "» — " + D.t + " (" + x[0] + ")")}">نسخ</button><a class="btn" href="#/ask?m=hadith&q=${encodeURIComponent("خرّج حديث: «" + m.slice(0, 250) + "»")}">التخريج والفوائد (المساعد)</a></div>
    <div class="mnav mnb">${next ? `<a class="btn s" href="#/hadith/k/${b}/${next[0]}">‹ التالي</a>` : "<span></span>"}${prev ? `<a class="btn s" href="#/hadith/k/${b}/${prev[0]}">السابق ›</a>` : ""}</div>`);
    linksBox(b, x[0]); gradesBox(b, x[0]); sharhInto($("#hdds"), b, x[0], true);
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
    else if (t === "sahabi") { const c = {}; L.forEach(x => { const k = x.sah.replace(/^(أمير المؤمنين|أبي|أبى)\s+/, m => m).trim(); if (k) (c[k] = c[k] || []).push(x); });
      if (q.s) L = c[q.s] || []; else side = `<div class="hdgl">${Object.entries(c).sort((a, b) => b[1].length - a[1].length).slice(0, 300).map(([k, l]) => `<a href="${u({ s: k })}">${esc(k)} <span class="mut">${toAr(l.length)}</span></a>`).join("")}</div>`; }
    if (t === "kutub") { side = await kutub(q); L = []; }
    if (t === "fav") { side = HDX.favHtml(q.f); L = []; }
    const showList = qq || (t === "book" && q.b) || t === "atraf" || (t === "sahabi" && q.s), pg = Math.max(1, +q.pg || 1), np = Math.max(1, Math.ceil(L.length / PER));
    view(`<div class="cmhero"><div><h2>الحديث النبوي</h2><p>كتب السنة المشهورة (الصحيحان والسنن الأربع والموطأ والدارمي ومسند أحمد وسنن البيهقي الكبرى وشعب الإيمان والأدب المفرد والشمائل وعمل اليوم والليلة وشرح السنة للبغوي، نحو مئة ألف حديث، وتُضاف إليها الكتب الأخرى تباعًا) مع رياض الصالحين والأربعين النووية وبلوغ المرام، مرتبةً على الكتب العلمية وأبوابها، مع موضع شرح كل حديث في شروحه المشهورة والشرح الموجز منها، وتخريجه في كتب السنة، وأحكام المحدثين من الموسوعة الحديثية. والمختارات بنصها: مرتبة بالموضوع، وبالمصدر، وبأطرافها، وبالصحابي؛ مع التخريج وحكم المصنف وشرحه، والانتقال إلى موضعها، وتصديرها بقوالب.</p></div></div>
    <details class="hfold"><summary>🔎 ابحث عن أي حديث وحكمه في كتب السنة (الموسوعة الحديثية)</summary><div><form class="sbox" data-form="noop" id="hddq"><input name="q" type="search" placeholder="اكتب جزءًا من متن الحديث" aria-label="بحث في الموسوعة الحديثية"><button class="btn p">ابحث</button></form><div id="hddr"></div></div></details>
    <div class="row"><button class="btn s" data-act="hdoff">${offState("hadith", "قسم الحديث")}</button></div>
    <form class="sbox" data-form="noop" id="hdq"><input name="q" type="search" value="${esc(qq)}" placeholder="ابحث بطرف الحديث أو الصحابي أو الباب" aria-label="بحث في الأحاديث"><button class="btn p">بحث</button></form>
    <div class="tabs" role="tablist">${[["kutub", "كتب السنة"], ["topic", "موضوعي"], ["book", "بحسب المصدر"], ["atraf", "الأطراف (معجمي)"], ["sahabi", "بحسب الصحابي"], ["fav", "⭐ مجلداتي"]].map(([k, n]) => `<a role="tab" aria-selected="${k === t}" href="#/hadith?t=${k}">${n}</a>`).join("")}</div>
    ${((q.g && t !== "topic") || q.b || q.s) ? `<p><a href="#/hadith?t=${t}">← ${t === "topic" ? "الأبواب" : t === "book" ? "المصادر" : "الصحابة"}</a> <b>${esc(q.g ? q.g.split(" › ").slice(-1)[0] : q.b ? BK[q.b] : q.s)}</b></p>` : ""}
    ${side}${showList ? `<p class="mut">${toAr(L.length)} حديثًا</p>${L.slice((pg - 1) * PER, pg * PER).map(card).join("")}${np > 1 ? `<div class="pgn">${pg > 1 ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg - 1 }))}">السابقة</a>` : ""}<span class="mut">${toAr(pg)} من ${toAr(np)}</span>${pg < np ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg + 1 }))}">التالية</a>` : ""}</div>` : ""}` : ""}`);
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
  return { view: page };
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
    if (m && !m.dataset.c) { m.dataset.c = 1; m.innerHTML = m.innerHTML.replace(RAWI, (x, a, b) => /رسول الله|النبي|صلى الله|^الله/.test(b) || BADN.test(b.trim()) ? x : a + `<span class="hrawi">${b.trim()}</span> `); } }
  // تبويب ما تحت الحديث
  function tabify() { const art = document.querySelector("article.hdone"); if (!art || art.dataset.tabs) return; art.dataset.tabs = 1; colorize(art);
    const secs = { tkh: document.getElementById("hdlk"), hukm: [document.getElementById("hdgr"), document.getElementById("hddr") && document.getElementById("hddr").closest("section")].filter(Boolean) };
    const names = [...new Set([...(art.querySelectorAll(".hsah,.hrawi"))].map(e => e.textContent.trim()))];
    const key = "hd_note:" + location.pathname, note = LS(key) || "";
    const bar = document.createElement("div"); bar.className = "hdtabs"; bar.innerHTML = `<div class="tabs" role="tablist">${[["tkh", "تخريج"], ["hukm", "حكم"], ["ruwat", "رواة"], ["sharh", "شرح"], ["notes", "ملاحظات"]].map(([k, n], i) => `<a role="tab" href="#" data-hdt="${k}" aria-selected="${!i}">${n}</a>`).join("")}</div>
      <div class="hdpane" data-p="ruwat" hidden>${names.length ? names.map(n => `<a class="chip" href="#/alam?q=${encodeURIComponent(n)}">👤 ${esc(n)}</a>`).join("") + '<p class="mut">اضغط الاسم لترجمته وأقوال أئمة الجرح والتعديل فيه من كتب التراجم بالمكتبة.</p>' : '<p class="mut">لم يُذكر إسناد في هذا النص؛ اقرأه بإسناده في موضعه من الكتاب.</p>'}</div>
      <div class="hdpane" data-p="sharh" hidden><p class="mut">مواضع شرحه في شروح المكتبة وتلخيصها:</p><div id="hdsh2"></div></div>
      <div class="hdpane" data-p="notes" hidden><textarea id="hdnote" rows="4" placeholder="ملاحظاتك على هذا الحديث (تُحفظ على جهازك)">${esc(note)}</textarea></div>`;
    const first = secs.tkh || secs.hukm[0]; if (!first) return; first.before(bar);
    const pane = (k, els) => els.forEach(e => { if (e) { e.classList.add("hdpane"); e.dataset.p = k; } }); pane("tkh", [secs.tkh]); pane("hukm", secs.hukm);
    const sh = () => { const lk = document.getElementById("hdlk"); const dst = document.getElementById("hdsh2"); if (lk && dst && !dst.dataset.f) { const h3 = [...lk.querySelectorAll("h3")].find(h => /شرح/.test(h.textContent)); if (h3) { dst.dataset.f = 1; let n = h3.nextElementSibling; const mv = []; while (n && n.tagName !== "H3") { mv.push(n); n = n.nextElementSibling; } mv.forEach(x => dst.appendChild(x)); h3.remove(); } } };
    const show = k => { sh(); document.querySelectorAll(".hdpane").forEach(e => e.hidden = e.dataset.p !== k); bar.querySelectorAll("[data-hdt]").forEach(a => a.setAttribute("aria-selected", a.dataset.hdt === k)); };
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
  return { scope, remember, favHtml };
})();
