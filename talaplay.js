/* ألعاب الطلائع ومسابقاتها من محتوى المكتبة (لما قبل ١٥ سنة بتصميم مرح):
   أكمل الحديث وراوي الحديث (الأربعون النووية ورياض الصالحين من قسم الحديث)، ومن أي سورة؟ (جزء عمّ من مصحف المكتبة)،
   أكمل البيت (تحفة الأطفال من قسم المتون)، وتمارين الأساس والبنيان المعتمدة إجاباتها (data/tala-ex.json + tala-ex-ok.json)،
   ومسابقة اليوم (أسئلة واحدة للجميع كل يوم) وسباق الدقيقة. محرّك أسئلة واحد بخيارات ملونة ونجوم واحتفال. */
const TPLAY = (() => {
  const GAMES = [["daily", "مسابقة اليوم", "عشرة أسئلة جديدة كل يوم من كتب المكتبة — الجميع يجيب الأسئلة نفسها", "🎯"],
    ["race", "سباق الدقيقة", "أجب أكبر عدد من الأسئلة في ٦٠ ثانية!", "⏱️"],
    ["hadith", "أكمل الحديث", "من الأربعين النووية ورياض الصالحين: اختر تكملة الحديث", "📜"],
    ["rawi", "راوي الحديث", "من الصحابي الذي روى هذا الحديث؟", "👤"],
    ["sura", "من أي سورة؟", "اقرأ الآية من جزء عمّ واعرف سورتها", "🕌"],
    ["nazm", "أكمل البيت", "من «تحفة الأطفال» في التجويد: اختر تكملة البيت", "🎵"],
    ["exer", "تمارين الأساس والبنيان", "أسئلة دروس كتابي الأساس والبنيان مع إجاباتها المعتمدة", "📚"]];
  const has = g => GAMES.some(x => x[0] === g);
  const J = {}, getj = u => J[u] || (J[u] = fetch(u).then(r => r.ok ? r.json() : null).catch(() => null));
  const AR = n => (typeof toAr === "function" ? toAr(n) : String(n));
  let rnd = Math.random;
  const seeded = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const mix = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n, not) => mix(a.filter(x => x !== not)).slice(0, n);
  const W = s => String(s || "").replace(/[«»"()\[\]]/g, "").replace(/\s+/g, " ").trim().split(" ");
  // صيغة سؤال موحدة: {q, sub, o: [..], a: رقم الصحيح, why, link, tag}
  const mk = (q, right, wrong, x) => { const o = mix([right].concat(wrong)); return Object.assign({ q, o, a: o.indexOf(right) }, x || {}); };

  // ---------- المولدات ----------
  async function hadithPool(k) {
    const A = (await getj("data/hadith/arbain.json")) || {}, R = k === "t1" ? {} : ((await getj("data/hadith/riyad.json")) || {});
    const IX = ((await getj("data/hadith/index.json")) || {}).items || [], sah = {}; IX.forEach(r => sah[r[0]] = r[5]);
    return Object.entries(Object.assign({}, A, R)).map(([id, x]) => { let m = String(x.m || ""); const c = m.slice(0, 110).match(/.*(?:يقول|قال)\s*[:：]\s*/); if (c) m = m.slice(c[0].length);
      return { id, w: W(m), sah: String(sah[id] || "").replace(/^(?:أمير المؤمنين|أم المؤمنين)\s+/, "") }; }).filter(x => x.w.length >= 10 && x.w.length <= (k === "t1" ? 40 : 70));
  }
  async function genHadith(k, n) {
    const P = await hadithPool(k); if (P.length < 4) return [];
    return mix(P).slice(0, n).map(h => { const s = k === "t1" ? 4 : 5, L = k === "t1" ? 4 : 6, right = h.w.slice(s, s + L).join(" ");
      const wrong = pick(P, 2, h).map(o => o.w.slice(s, s + L).join(" ")).filter(x => x && x !== right);
      return mk(h.w.slice(0, s).join(" ") + " …", right, wrong, { sub: "أكمل الحديث النبوي:", why: "«" + h.w.slice(0, 22).join(" ") + (h.w.length > 22 ? " …" : "") + "»", link: "#/hadith/x/" + h.id, tag: "📜" }); });
  }
  async function genRawi(k, n) {
    const P = (await hadithPool(k)).filter(x => x.sah && x.sah.length < 45); const names = [...new Set(P.map(x => x.sah))]; if (names.length < 3) return [];
    return mix(P).slice(0, n).map(h => mk("«" + h.w.slice(0, 9).join(" ") + " …»", h.sah, pick(names, 2, h.sah), { sub: "من راوي هذا الحديث من الصحابة؟", why: "رواه " + h.sah + " رضي الله عنه.", link: "#/hadith/x/" + h.id, tag: "👤" }));
  }
  async function genSura(k, n) {
    const Q = (await getj("data/quran/quran.json")) || { suras: [] }, am = Q.suras.filter(s => s.n >= (k === "t1" ? 93 : 78)); if (am.length < 3) return [];
    const out = [];
    for (const s of mix(am)) { const ay = s.ayat.map((a, i) => [String(a).replace(/^﻿?بسم الله الرحمن الرحيم\s*/, ""), i + 1]).filter(([a]) => W(a).length >= 3 && W(a).length <= 14);
      if (!ay.length) continue; const [t, i] = ay[Math.floor(rnd() * ay.length)], nm = x => { const w = String(x.name).trim().split(/\s+/); return /^سو?رة$/.test(w[0].replace(/[\u064B-\u0652]/g, "")) ? w.slice(1).join(" ") : x.name; };
      out.push(mk("﴿" + t + "﴾", nm(s), pick(am, 2, s).map(nm), { sub: "من أي سورة هذه الآية؟", why: "سورة " + nm(s) + "، الآية " + AR(i) + ".", link: "#/mushaf/" + s.n + "?a=" + i, tag: "🕌", qcls: "ayq" })); if (out.length >= n) break; }
    return out;
  }
  async function genNazm(k, n) {
    const B = await getj("data/books/tuhfatatfal.json"); if (!B) return [];
    const L = []; (B.pages || []).forEach(p => String(p || "").split("\n").forEach(l => { const m = l.replace(/\(\d+\)/g, "").split(/\s*\.\.\.\s*/); if (m.length === 2 && m[0].length > 8 && m[1].length > 8) L.push(m.map(x => x.trim())); }));
    if (L.length < 4) return [];
    return mix(L).slice(0, n).map(v => mk(v[0] + " …", v[1], pick(L, 2, v).map(x => x[1]), { sub: "أكمل البيت من «تحفة الأطفال»:", why: v[0] + " ... " + v[1], link: "#/book/tuhfatatfal", tag: "🎵" }));
  }
  async function genExer(k, n) {
    const E = ((await getj("data/tala-ex.json")) || {}).items || [], OK = ((await getj("https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/tala-ex-ok.json?t=" + Math.floor(Date.now() / 300e3))) || {}).ok || {};
    const key = x => x.b + ":" + x.p + ":" + norm(x.q).slice(0, 40), ser = k === "t3" ? "bunyan" : "asas";
    const L = E.filter(x => (x.k === "tf" || x.k === "mcq") && key(x) in OK && (x.s === ser || k === "t4"));
    return mix(L).slice(0, n).map(x => { const v = OK[key(x)], lk = "#/book/" + x.b + "/" + (x.lp || x.p), sub = "من درس «" + (x.l || "") + "»";
      if (x.k === "tf") return { q: x.q, o: ["✅ صح", "❌ خطأ"], a: v === true || v === 1 || v === "1" ? 0 : 1, sub, why: x.why || "", link: lk, tag: "📚" };
      const o = (x.o || []).slice(); return { q: x.q, o, a: +v, sub, why: x.why || "", link: lk, tag: "📚" }; }).filter(x => x.o.length >= 2 && x.a >= 0 && x.a < x.o.length);
  }
  const fromQZ = (qz, n) => mix(qz || []).slice(0, n).map(([q, a, ...w]) => mk(q, a, w, { sub: "سؤال معرفة:", tag: "🏆" }));
  const GEN = { hadith: genHadith, rawi: genRawi, sura: genSura, nazm: genNazm, exer: genExer };
  async function mixed(k, n, ctx) {
    const parts = await Promise.all([genHadith(k, 3), genSura(k, 3), genRawi(k, 2), genNazm(k, k === "t1" ? 0 : 2), genExer(k, 2)]);
    return mix(parts.flat().concat(fromQZ(ctx.qz, 3))).slice(0, n);
  }

  // ---------- المحرّك ----------
  let G = null, CTX = null, TM = null;
  const name = g => (GAMES.find(x => x[0] === g) || [])[1] || "";
  function font() { if (document.getElementById("kidfont")) return; const l = document.createElement("link"); l.id = "kidfont"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;700;800&display=swap"; document.head.appendChild(l); }
  async function run(g, q, ctx) {
    font(); CTX = ctx; clearInterval(TM); const k = q.k || ctx.k || "t2", day = new Date().toISOString().slice(0, 10);
    rnd = g === "daily" ? seeded(day + k) : Math.random;
    view(ctx.head(name(g), true) + '<div class="tpload">🎈 جارٍ تجهيز الأسئلة…</div></div>');
    let L = g === "daily" ? await mixed(k, 10, ctx) : g === "race" ? await mixed(k, 40, ctx).then(async a => a.length < 30 ? a.concat(await genSura(k, 15), await genHadith(k, 10)) : a) : await GEN[g](k, 10);
    rnd = Math.random;
    if (!L.length) return view(ctx.head(name(g), true) + `<div class="note">${g === "exer" ? "لم تُعتمد إجابات تمارين هذه المرحلة بعد؛ تُعتمد من الإدارة في «تمارين الأساس والبنيان»." : "تعذّر تجهيز الأسئلة الآن."}</div></div>`);
    const done = (S.tala && S.tala.daily || {})[day + k];
    if (g === "daily" && done != null) return view(ctx.head(name(g), true) + `<div class="tpwin"><div class="tpbig">🎯</div><h2>أنهيت مسابقة اليوم</h2><p>نتيجتك: ${AR(done)} من ${AR(L.length)}</p><p class="mut">تعود غدًا بأسئلة جديدة. جرّب «سباق الدقيقة» الآن!</p><a class="btn p" href="#/talaea/games?g=race&k=${k}">⏱️ سباق الدقيقة</a></div></div>`);
    G = { g, k, L, i: 0, s: 0, streak: 0, day, t0: Date.now(), end: g === "race" ? Date.now() + 60e3 : 0 };
    if (G.end) TM = setInterval(() => { const el = document.getElementById("tptime"); if (!el) return clearInterval(TM); const r = Math.max(0, Math.ceil((G.end - Date.now()) / 1000)); el.textContent = AR(r); el.parentElement.style.setProperty("--p", (r / 60 * 100) + "%"); if (r <= 0) { clearInterval(TM); finish(); } }, 250);
    draw();
  }
  function draw() {
    const x = G.L[G.i]; if (!x) return finish();
    const top = G.end ? `<div class="tptimer" style="--p:100%">⏱️ <b id="tptime">٦٠</b> ثانية • ✔ ${AR(G.s)}</div>` : `<div class="tpbar"><i style="width:${G.i / G.L.length * 100}%"></i></div><p class="tpn">السؤال ${AR(G.i + 1)} من ${AR(G.L.length)} ${G.streak >= 3 ? `<span class="tpfire">🔥 ${AR(G.streak)} متتالية!</span>` : ""}</p>`;
    view(CTX.head(name(G.g), true) + `<div class="tplay">${top}<div class="tpq"><span class="tptag">${x.tag || "⭐"}</span>${x.sub ? `<p class="tpsub">${esc(x.sub)}</p>` : ""}<p class="tpqt ${x.qcls || ""}">${esc(x.q)}</p></div>
      <div class="tpo">${x.o.map((o, i) => `<button class="tpbtn c${i % 4}" data-act="tp-ans" data-i="${i}">${esc(o)}</button>`).join("")}</div><div id="tpfb" class="tpfb" hidden></div></div></div>`);
  }
  function burst(el) { const r = el.getBoundingClientRect(), box = document.createElement("div"); box.className = "tpburst"; box.style.left = (r.left + r.width / 2) + "px"; box.style.top = (r.top + r.height / 2) + "px";
    box.innerHTML = ["⭐", "🎉", "✨", "🌟", "🎈", "💚"].map((e, i) => `<i style="--a:${i * 60}deg">${e}</i>`).join(""); document.body.appendChild(box); setTimeout(() => box.remove(), 900); }
  function answer(el) {
    const x = G.L[G.i], i = +el.dataset.i, ok = i === x.a;
    document.querySelectorAll(".tpbtn").forEach(b => { b.disabled = true; if (+b.dataset.i === x.a) b.classList.add("right"); });
    if (ok) { G.s++; G.streak++; burst(el); } else { el.classList.add("wrong"); G.streak = 0; }
    if (G.end) { setTimeout(() => { G.i++; if (G.i >= G.L.length) finish(); else draw(); }, ok ? 350 : 900); return; }
    const fb = document.getElementById("tpfb"); fb.hidden = false; fb.className = "tpfb " + (ok ? "ok" : "no");
    fb.innerHTML = `<b>${ok ? ["أحسنت! ⭐", "رائع! 🌟", "ممتاز! 🎉", "بارك الله فيك! 💚"][Math.floor(Math.random() * 4)] : "لا بأس، الصحيح مظلل بالأخضر 💪"}</b>${x.why ? `<p>${esc(x.why)}</p>` : ""}<div class="row">${x.link ? `<a class="btn s" href="${x.link}">📖 من المكتبة</a>` : ""}<button class="btn p" data-act="tp-next">التالي ←</button></div>`;
  }
  function finish() {
    clearInterval(TM); const n = G.end ? G.i : G.L.length, sc = G.s, r = n ? sc / n : 0, stars = G.end ? Math.min(5, Math.floor(sc / 3)) : r >= .9 ? 3 : r >= .6 ? 2 : sc ? 1 : 0;
    if (stars) CTX.star(stars);
    const T = S.tala = S.tala || { stars: 0, done: {} }; if (G.g === "daily") { T.daily = T.daily || {}; T.daily[G.day + G.k] = sc; }
    T.best = T.best || {}; const bk = G.g + G.k, best = T.best[bk] || 0, nb = sc > best; if (nb) T.best[bk] = sc; saveS();
    view(CTX.head(name(G.g), true) + `<div class="tpwin"><div class="tpbig">${r >= .9 || (G.end && sc >= 12) ? "🏆" : r >= .6 || (G.end && sc >= 6) ? "🥈" : "🌱"}</div><h2>${G.end ? "انتهى السباق!" : "انتهت الجولة!"}</h2>
      <p class="tpscore">${AR(sc)} ${G.end ? "إجابة صحيحة في دقيقة" : "من " + AR(n)}</p><p>${"⭐".repeat(stars) || "حاول مرة أخرى، ستنجح بإذن الله!"}</p>${nb && best ? `<p class="tpfire">🎊 رقم قياسي جديد! (السابق ${AR(best)})</p>` : best && !nb ? `<p class="mut">أفضل نتيجة لك: ${AR(best)}</p>` : ""}
      <div class="row" style="justify-content:center">${G.g !== "daily" ? `<a class="btn p" href="#/talaea/games?g=${G.g}&k=${G.k}&r=${Date.now()}">🔁 مرة أخرى</a>` : ""}<a class="btn" href="#/talaea">🌟 كل الألعاب</a></div></div></div>`);
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act^=tp-]"); if (!el || !G) return; if (el.dataset.act === "tp-ans") answer(el); else if (el.dataset.act === "tp-next") { G.i++; draw(); } });
  return { GAMES, has, run, font };
})();
