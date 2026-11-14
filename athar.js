/* موسوعة آثار السلف (#/athar): وصايا الصحابة والتابعين ومن بعدهم إلى نهاية القرن الثالث وحكمهم ومواعظهم وتقريراتهم،
   مجموعة من كتب المكتبة بألفاظها (tools/athar.py ثم tools/athar-ai.py)، مرتبة بالأبواب وبالأعلام، مع العزو إلى الكتاب والصفحة
   ورقم الأثر، والتخريج من بقية الكتب، والدخول إلى موضعه؛ ونسخ الأثر بعزوه، و«مختاراتي» لجمع آثار خطبة أو درس وتنزيلها. */
const ATH = (() => {
  const D = "data/athar/", TIER = { s: "الصحابة", t: "التابعون", a: "أتباع التابعين", b: "من بعدهم إلى نهاية القرن الثالث" }, TIER1 = { s: "صحابي", t: "تابعي", a: "من أتباع التابعين", b: "" };
  let IX = null; const TC = {};
  const RAWD = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + D + p + "?t=" + Math.floor(Date.now() / 300e3);
  const getJ = async p => { for (const u of [RAWD(p), D + p + "?v=" + Math.floor(Date.now() / 300e3)]) { try { const r = await fetch(u, { cache: "no-cache" }); if (r.ok) return await r.json(); } catch (e) { } } throw new Error("تعذر التحميل"); };
  const index = async () => IX || (IX = await getJ("_index.json"));
  const topic = async k => TC[k] || (TC[k] = (await getJ(k + ".json")).items);
  const all = async () => { await index(); const seen = new Set(), out = []; for (const t of IX.topics) if (t.c) for (const it of await topic(t.k)) if (!seen.has(it.id)) { seen.add(it.id); out.push(it); } return out; };
  const per = n => (IX.people || []).find(p => p.n === n) || {};
  const BK = id => (typeof B === "function" ? B(id) : null) || {};
  const bTitle = id => { const b = BK(id); return b.setTitle ? b.setTitle + (b.vol ? " (ج" + toAr(b.vol) + ")" : "") : b.title || id; };
  const where = r => `${r.n ? "رقم " + toAr(r.n) + "، " : ""}${r.l || "ص " + toAr(r.p)}`;
  const cite = it => `${it.w}${per(it.w).d ? " (ت " + toAr(per(it.w).d) + "هـ)" : ""} — ${bTitle(it.r.b)} (${where(it.r)})${(it.x || []).length ? "، وأخرجه: " + it.x.map(x => bTitle(x.b) + " (" + where(x) + ")").join("، ") : ""}`;
  const plainCopy = it => `قال ${it.w}: «${it.q}»\n[${cite(it)}]`;
  // مختاراتي: آثار يجمعها العضو لخطبة أو درس (على الجهاز)
  const MY = { get() { try { return JSON.parse(localStorage.getItem("athar_my") || "[]"); } catch (e) { return []; } }, set(l) { try { localStorage.setItem("athar_my", JSON.stringify(l)); } catch (e) { } } };

  const card = it => { const p = per(it.w), inMy = MY.get().some(x => x.id === it.id);
    return `<article class="athar" data-id="${esc(it.id)}">${it.t ? `<h4>${esc(it.t)}</h4>` : ""}
      <blockquote>«${esc(it.q)}»</blockquote>
      <p class="athw"><a href="#/athar/w/${encodeURIComponent(it.w)}">${esc(it.w)}</a>${p.t ? ` <span class="tag">${esc(TIER1[p.t] || "")}${p.d ? " • ت " + toAr(p.d) + "هـ" : ""}</span>` : ""}</p>
      <p class="athsrc">العزو: <a href="#/book/${esc(it.r.b)}/${it.r.p}">${esc(bTitle(it.r.b))} (${esc(where(it.r))})</a>${(it.x || []).length ? `<br><span class="mut">وأخرجه أيضًا: ${it.x.map(x => `<a href="#/book/${esc(x.b)}/${x.p}">${esc(bTitle(x.b))} (${esc(where(x))})</a>`).join("، ")}</span>` : ""}</p>
      <div class="row athbtns"><button class="btn s" data-ath="copy" data-id="${esc(it.id)}">نسخ بالعزو</button><button class="btn s${inMy ? "" : " p"}" data-ath="my" data-id="${esc(it.id)}">${inMy ? "✓ في مختاراتي" : "＋ إلى مختاراتي"}</button><a class="btn s" href="#/book/${esc(it.r.b)}/${it.r.p}">موضعه في الكتاب</a></div></article>`; };
  let LIST = [], SHOWN = 0;
  const more = () => { const el = $("#athl"); if (!el) return; el.insertAdjacentHTML("beforeend", LIST.slice(SHOWN, SHOWN + 40).map(card).join("")); SHOWN += 40; const m = $("#athmore"); if (m) m.hidden = SHOWN >= LIST.length; };
  const listView = (head, L, note) => { LIST = L; SHOWN = 0; view(head + `<p class="mut">${toAr(L.length)} أثرًا${note ? " • " + note : ""}</p><div id="athl"></div><p><button class="btn" id="athmore" data-ath="more">المزيد</button></p>`); more(); };
  const crumbs = t => `<p><a href="#/athar">موسوعة آثار السلف</a>${t ? " › " + esc(t) : ""}</p>`;
  const searchBox = q => `<form class="sbox" data-form="athq" style="max-width:none"><input name="q" type="search" value="${esc(q || "")}" placeholder="ابحث في آثار السلف: كلمة أو موضوع أو اسم" aria-label="بحث في الآثار"><button class="btn">بحث</button></form>`;

  async function show(q, a, b) {
    view('<p class="mut">جارٍ تحميل الموسوعة…</p>');
    try { await index(); } catch (e) { return view('<div class="note">تعذر تحميل الموسوعة.</div>'); }
    q = q || {};
    if (a === "t" && b) { const t = IX.topics.find(x => x.k === b); return listView(crumbs(t ? t.n : "") + `<h2>${esc(t ? t.n : b)}</h2>` + searchBox(), await topic(b).catch(() => [])); }
    if (a === "w" && b) { const w = decodeURIComponent(b), p = per(w), L = (await all()).filter(x => x.w === w); return listView(crumbs(w) + `<h2>${esc(w)}</h2><p class="mut">${esc(TIER1[p.t] || "")}${p.d ? " • توفي سنة " + toAr(p.d) + "هـ" : ""}</p>`, L); }
    if (a === "my") return mine();
    if (q.q) { const w = norm(q.q).split(/\s+/).filter(Boolean), L = (await all()).filter(x => { const h = norm(x.q + " " + x.w + " " + (x.t || "")); return w.every(k => h.includes(k)); }); return listView(crumbs("بحث") + searchBox(q.q), L, "نتائج «" + esc(q.q) + "»"); }
    const tiers = ["s", "t", "a", "b"].map(t => [t, IX.people.filter(p => p.t === t)]).filter(x => x[1].length);
    view(`<div class="cmhero athhero"><div><h2>موسوعة آثار السلف</h2><p>وصايا الصحابة والتابعين ومن بعدهم إلى نهاية القرن الثالث، وحكمهم ومواعظهم وتقريراتهم في العقيدة والاتباع والعلم والعبادة والتزكية والأخلاق والهمة والترغيب والترهيب؛ بألفاظها من كتب السنة والتراجم والرقائق في المكتبة، معزوّة إلى مواضعها مع تخريجها، يُنسخ منها لخطبة أو درس.</p>
      <p class="mut">${toAr(IX.count)} أثرًا من ${toAr(IX.people.length)} علمًا • تُجمع تباعًا وتُراجَع قبل نشرها (رُوجع ${toAr(IX.checked || 0)} من ${toAr(IX.candidates || 0)} موضعًا مرشحًا)</p></div></div>
      ${searchBox()}
      <p><a class="btn s" href="#/athar/my">📌 مختاراتي (${toAr(MY.get().length)})</a></p>
      <h3>الأبواب</h3><div class="athtopics">${IX.topics.filter(t => t.c).map(t => `<a class="card" href="#/athar/t/${t.k}"><b>${esc(t.n)}</b><span>${toAr(t.c)} أثرًا</span></a>`).join("") || '<p class="note">تُراجَع الآثار الآن، وتظهر هنا تباعًا.</p>'}</div>
      <h3>الأعلام</h3>${tiers.map(([t, L]) => `<h4>${TIER[t]}</h4><div class="chips">${L.map(p => `<a class="chip" href="#/athar/w/${encodeURIComponent(p.n)}">${esc(p.n)} <small>${toAr(p.c)}</small></a>`).join("")}</div>`).join("")}
      ${(IX.sources || []).length ? `<details><summary>المصادر</summary><ul>${IX.sources.map(s => `<li><a href="#/book/${esc(s.b)}">${esc(s.t)}</a> — ${toAr(s.c)} أثرًا</li>`).join("")}</ul></details>` : ""}
      <p class="mut">منهج الجمع: يُستخرج القول من نص الكتاب نفسه بلفظه، ويُراجَع: أنه قول العلم نفسه لا راويه، وليس حديثًا مرفوعًا ولا قصة ولا مسألة فقهية جزئية؛ ثم يُطابَق لفظه بالمصدر قبل نشره. والمكرر يُعرض مرة واحدة ويُذكر بقية مصادره تخريجًا. ورُتبت المصادر: كتب السنة والاعتقاد المسندة، ثم التراجم، ثم الرقائق والتزكية.</p>`);
  }
  async function mine() {
    const L = MY.get();
    view(crumbs("مختاراتي") + `<h2>مختاراتي</h2><p class="mut">آثار جمعتَها لخطبة أو درس، محفوظة على جهازك. انسخها كلها بعزوها، أو نزّلها ملف Word.</p>
      <div class="row"><button class="btn p s" data-ath="mycopy"${L.length ? "" : " disabled"}>نسخ الكل بالعزو</button><button class="btn s" data-ath="mydoc"${L.length ? "" : " disabled"}>تنزيل Word</button><button class="btn s" data-ath="myclear"${L.length ? "" : " disabled"}>إفراغ</button></div>
      <div id="athl">${L.map(card).join("") || '<p class="mut">لم تختر آثارًا بعد. اضغط «＋ إلى مختاراتي» تحت أي أثر.</p>'}</div>`);
  }
  document.addEventListener("submit", e => { const f = e.target.closest("[data-form=athq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const v = f.q.value.trim(); location.hash = "#/athar" + (v ? "?q=" + encodeURIComponent(v) : ""); }, true);
  document.addEventListener("click", async e => { const el = e.target.closest("[data-ath]"); if (!el) return; const a = el.dataset.ath;
    if (a === "more") return more();
    const find = async id => LIST.find(x => x.id === id) || MY.get().find(x => x.id === id) || (await all()).find(x => x.id === id);
    if (a === "copy") { const it = await find(el.dataset.id); if (it && navigator.clipboard) navigator.clipboard.writeText(plainCopy(it)).then(() => toast("نُسخ الأثر بعزوه")); }
    else if (a === "my") { const it = await find(el.dataset.id); if (!it) return; let L = MY.get(); const i = L.findIndex(x => x.id === it.id); if (i >= 0) L.splice(i, 1); else L.push(Object.assign({}, it, { c: cite(it) })); MY.set(L); el.textContent = i >= 0 ? "＋ إلى مختاراتي" : "✓ في مختاراتي"; el.classList.toggle("p", i >= 0); toast(i >= 0 ? "أُزيل من مختاراتي" : "أُضيف إلى مختاراتي"); }
    else if (a === "mycopy") { const t = MY.get().map(plainCopy).join("\n\n"); navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast("نُسخت المختارات")); }
    else if (a === "myclear") { if (confirm("إفراغ مختاراتك؟")) { MY.set([]); mine(); } }
    else if (a === "mydoc") { const L = MY.get(), X = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      const body = L.map(it => `<h3>${X(it.t || it.w)}</h3><p style="font-size:17pt">قال ${X(it.w)}: «${X(it.q)}»</p><p style="font-size:11pt;color:#555">[${X(cite(it))}]</p>`).join("");
      const doc = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{direction:rtl;font-family:'Traditional Arabic',Amiri,serif;font-size:16pt}h1,h3{color:#0f5c4d}</style></head><body dir="rtl"><h1>من آثار السلف</h1>${body}<p style="font-size:10pt;color:#888">من «موسوعة آثار السلف» — ${X(SITENAME)} ${X(siteLink("#/athar"))}</p></body></html>`;
      dl("آثار السلف — مختاراتي.doc", doc, "application/msword"); } });
  return { view: show };
})();
