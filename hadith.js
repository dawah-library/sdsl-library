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
  async function page(q, id) {
    await load(); if (id) return one(id);
    const t = q.t || "topic", qq = (q.q || "").trim(), u = o => "#/hadith?" + new URLSearchParams(Object.assign({ t }, o)).toString();
    let L = IX.map(F), body = "", side = "";
    if (qq) { const w = norm(qq).split(/\s+/).filter(Boolean); L = L.filter(x => { const s = norm(x.tarf + " " + x.sah + " " + x.bab); return w.every(k => s.includes(k)); }); }
    if (t === "topic") { const groups = {}; L.forEach(x => { const g = (BK[x.b] || x.b) + " › " + (x.k && x.k !== x.bab ? x.k + " › " : "") + x.bab; (groups[g] = groups[g] || []).push(x); });
      const keys = Object.keys(groups); if (q.g) L = groups[q.g] || []; else side = `<div class="hdgl">${keys.slice(0, 400).map(g => `<a href="${u({ g, q: qq })}">${esc(g.split(" › ").slice(-1)[0])} <span class="mut">${toAr(groups[g].length)} • ${esc(g.split(" › ")[0])}</span></a>`).join("")}</div>`; }
    else if (t === "book") { if (q.b) L = L.filter(x => x.b === q.b); else side = `<div class="grid">${Object.entries(BK).map(([b, n]) => `<a class="card" href="${u({ b })}"><b>${esc(n)}</b><span>${toAr(IX.filter(r => r[1] === b).length)} حديثًا</span></a>`).join("")}</div>`; }
    else if (t === "atraf") { const l = q.l || "ا"; side = `<nav class="chips hdlet">${LET.map(c => `<a class="chip${c === l ? " on" : ""}" href="${u({ l })}">${c}</a>`.replace(`l=${encodeURIComponent(l)}`, "l=" + encodeURIComponent(c))).join("")}</nav>`; L = L.filter(x => first(x.tarf) === l).sort((a, b) => a.tarf.localeCompare(b.tarf, "ar")); }
    else if (t === "sahabi") { const c = {}; L.forEach(x => { const k = x.sah.replace(/^(أمير المؤمنين|أبي|أبى)\s+/, m => m).trim(); if (k) (c[k] = c[k] || []).push(x); });
      if (q.s) L = c[q.s] || []; else side = `<div class="hdgl">${Object.entries(c).sort((a, b) => b[1].length - a[1].length).slice(0, 300).map(([k, l]) => `<a href="${u({ s: k })}">${esc(k)} <span class="mut">${toAr(l.length)}</span></a>`).join("")}</div>`; }
    const showList = qq || (t === "topic" && q.g) || (t === "book" && q.b) || t === "atraf" || (t === "sahabi" && q.s), pg = Math.max(1, +q.pg || 1), np = Math.max(1, Math.ceil(L.length / PER));
    view(`<div class="cmhero"><div><h2>الحديث النبوي</h2><p>أحاديث رياض الصالحين والأربعين النووية وبلوغ المرام بنصها: مرتبة بالموضوع، وبالمصدر، وبأطرافها، وبالصحابي؛ مع التخريج وحكم المصنف وشرحه، والانتقال إلى موضعها، وتصديرها بقوالب.</p></div></div>
    <details class="hfold"><summary>🔎 ابحث عن أي حديث وحكمه في كتب السنة (الموسوعة الحديثية)</summary><div><form class="sbox" data-form="noop" id="hddq"><input name="q" type="search" placeholder="اكتب جزءًا من متن الحديث" aria-label="بحث في الموسوعة الحديثية"><button class="btn p">ابحث</button></form><div id="hddr"></div></div></details>
    <form class="sbox" data-form="noop" id="hdq"><input name="q" type="search" value="${esc(qq)}" placeholder="ابحث بطرف الحديث أو الصحابي أو الباب" aria-label="بحث في الأحاديث"><button class="btn p">بحث</button></form>
    <div class="tabs" role="tablist">${[["topic", "موضوعي"], ["book", "بحسب المصدر"], ["atraf", "الأطراف (معجمي)"], ["sahabi", "بحسب الصحابي"]].map(([k, n]) => `<a role="tab" aria-selected="${k === t}" href="#/hadith?t=${k}">${n}</a>`).join("")}</div>
    ${(q.g || q.b || q.s) ? `<p><a href="#/hadith?t=${t}">← ${t === "topic" ? "الأبواب" : t === "book" ? "المصادر" : "الصحابة"}</a> <b>${esc(q.g ? q.g.split(" › ").slice(-1)[0] : q.b ? BK[q.b] : q.s)}</b></p>` : ""}
    ${side}${showList ? `<p class="mut">${toAr(L.length)} حديثًا</p>${L.slice((pg - 1) * PER, pg * PER).map(card).join("")}${np > 1 ? `<div class="pgn">${pg > 1 ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg - 1 }))}">السابقة</a>` : ""}<span class="mut">${toAr(pg)} من ${toAr(np)}</span>${pg < np ? `<a class="btn s" href="${u(Object.assign({}, q, { pg: pg + 1 }))}">التالية</a>` : ""}</div>` : ""}` : ""}`);
    $("#hdq").addEventListener("submit", e => { e.preventDefault(); location.hash = u({ q: e.target.q.value.trim() }); });
    $("#hddq").addEventListener("submit", e => { e.preventDefault(); dorar(e.target.q.value.trim()); });
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
    <section class="stsec"><h3>أحكام المحدثين وتخريجه في كتب السنة</h3><p class="mut">من «الموسوعة الحديثية» في الدرر السنية: روايات الحديث في المصادر، وحكم كل محدث عليه من المتقدمين والمعاصرين.</p><div id="hddr"><button class="btn p s" data-act="hddorar" data-q="${esc((d.m || x.tarf).split(/\s+/).slice(0, 7).join(" "))}">اعرض أحكام المحدثين</button></div></section>
    <div class="row"><button class="btn p" data-act="hdexp" data-id="${id}">تصدير بقالب</button><button class="btn" data-act="hdcopy" data-id="${id}">نسخ</button>${typeof hadithSheet === "function" ? `<button class="btn" data-act="hdsharh" data-id="${id}">شروح الحديث في المكتبة</button>` : ""}<a class="btn" href="#/ask?q=${encodeURIComponent("أعرب الحديث: «" + (d.m || x.tarf).slice(0, 300) + "» إعرابًا مفصلًا، واذكر أهم ما يستفاد منه من شروح الحديث في المكتبة مع الإحالة")}">الإعراب وما يستفاد منه (المساعد)</a></div>`);
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
      el.innerHTML = (j.items || []).length ? `<div class="sttab"><table><thead><tr><th>الحديث</th><th>الراوي</th><th>المحدث</th><th>المصدر</th><th>الحكم</th></tr></thead><tbody>${j.items.map(x => `<tr><td class="hdsh">${esc(x.matn.slice(0, 220))}${x.matn.length > 220 ? "…" : ""}</td><td>${esc(x.rawi)}</td><td><b>${esc(x.muhaddith)}</b></td><td>${esc(x.src)}${x.page ? " (" + esc(x.page) + ")" : ""}</td><td><b class="hdh">${esc(x.hukm)}</b></td></tr>`).join("")}</tbody></table></div><p class="mut">المصدر: ${esc(j.src)} • <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">البحث في الدرر السنية ↗</a></p>` : '<p class="mut">لا نتائج. جرّب جزءًا آخر من المتن.</p>';
    } catch (e) { el.innerHTML = `<p class="mut">تعذّر الوصول إلى الموسوعة الحديثية الآن. <a href="https://dorar.net/hadith/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">ابحث في الدرر السنية ↗</a></p>`; } }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "hddorar") dorar(el.dataset.q);
    else if (a === "hdexp") exp(el.dataset.id);
    else if (a === "hdcopy") { const r = IX.find(x => x[0] === el.dataset.id), x = F(r); det(x.b).then(D => navigator.clipboard.writeText(`عن ${x.sah} رضي الله عنه: «${(D[x.id] || {}).m || x.tarf}» ${x.t}${x.h ? " — " + x.h : ""}\n${BK[x.b] || x.b}`).then(() => toast("نُسخ"))); }
    else if (a === "hdsharh") { const r = IX.find(x => x[0] === el.dataset.id), x = F(r); det(x.b).then(D => hadithSheet((D[x.id] || {}).m || x.tarf)); } });
  return { view: page };
})();
