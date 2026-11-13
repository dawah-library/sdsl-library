/* ألعاب الطلائع ومسابقاتها من محتوى المكتبة (لما قبل ١٥ سنة بتصميم مرح):
   أكمل الحديث وراوي الحديث (الأربعون النووية ورياض الصالحين من قسم الحديث)، ومن أي سورة؟ (جزء عمّ من مصحف المكتبة)،
   أكمل البيت (تحفة الأطفال من قسم المتون)، وتمارين الأساس والبنيان المعتمدة إجاباتها (data/tala-ex.json + tala-ex-ok.json)،
   ومسابقة اليوم (أسئلة واحدة للجميع كل يوم) وسباق الدقيقة. محرّك أسئلة واحد بخيارات ملونة ونجوم واحتفال. */
/* أصوات الطلائع (TSFX): فقاعات ونغمات مولَّدة بالمتصفح (WebAudio) بلا ملفات، وعبارات تشجيع إسلامية بحسب الجنس
   («أحسنتَ» للبنين و«أحسنتِ» للبنات، وتهنئة الإتمام) من assets/clips (tools/voice-clips.py)، وإلا بصوت الجهاز. كتم الصوت محفوظ على الجهاز. */
const TSFX = (() => {
  let AC = null, IDX = null; const muted = () => { try { return localStorage.getItem("tsfx_off") === "1"; } catch (e) { return false; } };
  const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; } catch (e) { return null; } };
  const tone = (f0, f1, t0, d, type, vol) => { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .18, t + .012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02); };
  const bubble = () => { if (muted()) return; for (let i = 0; i < 3; i++) tone(260 + Math.random() * 220, 900 + Math.random() * 500, i * .07, .09, "sine", .14); };
  const chime = () => { if (muted()) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, f * 1.01, i * .09, .28, "triangle", .12)); };
  const soft = () => { if (muted()) return; tone(330, 220, 0, .25, "sine", .1); };
  const fanfare = () => { if (muted()) return; [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, f, i * .13, .32, "triangle", .13)); setTimeout(() => { for (let i = 0; i < 8; i++) tone(300 + Math.random() * 600, 1200, i * .06, .1, "sine", .08); }, 800); };
  // الجنس: قسم الصفحة (s=g) ثم ملف الطفل الحالي في «ركن الوالدين»
  const sex = () => { try { const q = (location.hash.split("?")[1] || ""); const m = q.match(/(?:^|&)s=([bg])(?:&|$)/); if (m) return m[1];
    const T = (typeof S !== "undefined" && S.tala) || {}, k = (T.kids || []).find(x => x.id === T.cur) || (T.kids || [])[0]; return k && k.g === "g" ? "g" : "b"; } catch (e) { return "b"; } };
  const TXT = { b: { ok: ["أحسنتَ!", "أحسنتَ، بارك الله فيك!", "ما شاء الله، أحسنتَ!", "أحسنتَ يا بطل!", "زادك الله علمًا!", "جزاك الله خيرًا، إجابة صحيحة!"], no: ["حاولْ مرة أخرى، أنت تستطيع!", "لا بأس، راجعِ الدرس وحاولْ من جديد."], done: ["مبارك! أتممتَ التمرين بنجاح، زادك الله علمًا وتوفيقًا.", "ما شاء الله تبارك الله! أتممتَ المسابقة."] },
    g: { ok: ["أحسنتِ!", "أحسنتِ، بارك الله فيكِ!", "ما شاء الله، أحسنتِ!", "أحسنتِ يا بطلة!", "زادكِ الله علمًا!", "جزاكِ الله خيرًا، إجابة صحيحة!"], no: ["حاولي مرة أخرى، أنتِ تستطيعين!", "لا بأس، راجعي الدرس وحاولي من جديد."], done: ["مبارك! أتممتِ التمرين بنجاح، زادكِ الله علمًا وتوفيقًا.", "ما شاء الله تبارك الله! أتممتِ المسابقة."] } };
  const word = kind => { const L = TXT[sex()][kind]; return { i: Math.floor(Math.random() * L.length), L }; };
  const loadIdx = () => IDX || (IDX = fetch("assets/clips/index.json").then(r => r.ok ? r.json() : []).catch(() => []));
  let last = 0;
  async function say(kind) {
    if (muted() || Date.now() - last < 900) return; last = Date.now(); const g = sex(), { i, L } = word(kind), id = "tala-" + g + "-" + kind + (i + 1), ix = await loadIdx();
    if (ix.includes(id)) { try { const a = new Audio("assets/clips/" + id + ".mp3"); a.volume = .9; await a.play(); return; } catch (e) { } }
    try { if (!window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(L[i]); u.lang = "ar-SA"; u.rate = .95; u.pitch = g === "g" ? 1.25 : 1.05;
      const v = speechSynthesis.getVoices().filter(x => /^ar/i.test(x.lang)); if (v.length) u.voice = v.find(x => g === "g" ? /female|zariyah|salma|hoda|laila|amira/i.test(x.name) : /male|hamed|shakir|naayf|tarik/i.test(x.name)) || v[0];
      speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }
  const text = kind => { const { i, L } = word(kind); return L[i]; };
  const right = () => { bubble(); setTimeout(chime, 120); setTimeout(() => say("ok"), 450); };
  const wrong = () => { soft(); setTimeout(() => say("no"), 300); };
  const done = good => { fanfare(); setTimeout(() => say(good === false ? "no" : "done"), 1300); };
  const toggle = () => { const m = !muted(); try { localStorage.setItem("tsfx_off", m ? "1" : "0"); } catch (e) { } return !m; };
  const btn = () => `<button class="tsfxb" data-act="tsfx" title="الأصوات" aria-label="تشغيل الأصوات أو كتمها">${muted() ? "🔇" : "🔊"}</button>`;
  document.addEventListener("click", e => { const el = e.target.closest("[data-act=tsfx]"); if (!el) return; const on = toggle(); document.querySelectorAll(".tsfxb").forEach(b => b.textContent = on ? "🔊" : "🔇"); if (on) bubble(); });
  return { bubble, chime, right, wrong, done, say, text, sex, btn, muted };
})();

const TPLAY = (() => {
  const GAMES = [["daily", "مسابقة اليوم", "عشرة أسئلة جديدة كل يوم من كتب المكتبة — الجميع يجيب الأسئلة نفسها", "🎯"],
    ["race", "سباق الدقيقة", "أجب أكبر عدد من الأسئلة في ٦٠ ثانية!", "⏱️"],
    ["hadith", "أكمل الحديث", "من الأربعين النووية ورياض الصالحين: اختر تكملة الحديث", "📜"],
    ["rawi", "راوي الحديث", "من الصحابي الذي روى هذا الحديث؟", "👤"],
    ["sura", "من أي سورة؟", "اقرأ الآية من جزء عمّ واعرف سورتها", "🕌"],
    ["nazm", "أكمل البيت", "من «تحفة الأطفال» في التجويد: اختر تكملة البيت", "🎵"],
    ["exer", "تمارين الأساس والبنيان", "أسئلة دروس كتابي الأساس والبنيان مع إجاباتها المعتمدة", "📚"],
    // ألعاب لغوية (ولمتعلمي العربية من غير الناطقين بها): إجاباتها من نصوص المكتبة نفسها
    ["gharib", "معنى الكلمة", "كلمات من جزء عمّ ومعناها من «السراج في غريب القرآن»", "🔤"],
    ["haraka", "الحركة الصحيحة", "اختر ضبط آخر الكلمة كما في المصحف", "ـَ"],
    ["tartib", "رتّب الآية", "أيّ ترتيب للكلمات هو الآية كما في المصحف؟", "🧩"],
    ["jarr", "حرف الجر", "اعرف حرف الجر في جمل من مقالات مشايخ الدعوة", "🔗"]];
  const has = g => g === "mine" || GAMES.some(x => x[0] === g);
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
    return mix(L).slice(0, n).map(x => { const v = OK[key(x)], QX = String(x.q || "").replace(/\(\s*(?:[✓✗×]|&nbsp[؛;]?\s*)+\s*\)/g, "").trim(), lk = "#/book/" + x.b + "/" + (x.lp || x.p), sub = "من درس «" + (x.l || "") + "»";
      if (x.k === "tf") return { q: QX, o: ["✅ صح", "❌ خطأ"], a: v === true || v === 1 || v === "1" ? 0 : 1, sub, why: x.why || "", link: lk, tag: "📚" };
      const o = (x.o || []).slice(); return { q: QX, o, a: +v, sub, why: x.why || "", link: lk, tag: "📚" }; }).filter(x => x.o.length >= 2 && x.a >= 0 && x.a < x.o.length);
  }
  const fromQZ = (qz, n) => mix(qz || []).slice(0, n).map(([q, a, ...w]) => mk(q, a, w, { sub: "سؤال معرفة:", tag: "🏆" }));
  // ---------- الألعاب اللغوية ----------
  const amma = async k => { const Q = (await getj("data/quran/quran-tash.json")) || { suras: [] }; return Q.suras.map((x, i) => ({ n: i + 1, ayat: x.ayat })).filter(x => x.n >= (k === "t1" ? 93 : 78)); };
  const DIAC = /[\u064B-\u0652\u0670]/g, bare = w => String(w).replace(DIAC, "");
  async function genGharib(k, n) {
    const ss = mix(Array.from({ length: 114 - (k === "t1" ? 92 : 77) }, (_, i) => (k === "t1" ? 93 : 78) + i)).slice(0, 8), pool = [];
    for (const sn of ss) { const d = (await getj("data/quran/tafsir/siraj/" + sn + ".json")) || {}; for (const [a, L] of Object.entries(d)) (L || []).forEach(([w, m]) => { if (w && m && bare(w).length >= 3 && m.length <= 90) pool.push({ w, m: m.replace(/\.$/, ""), sn, a }); }); }
    const seen = new Set(), out = [];
    for (const x of mix(pool)) { if (seen.has(bare(x.w))) continue; seen.add(bare(x.w)); const wr = pick(pool.filter(y => y.m !== x.m && bare(y.w) !== bare(x.w)), 2).map(y => y.m); if (wr.length < 2) continue;
      out.push(mk("﴿" + x.w + "﴾", x.m, wr, { sub: "ما معنى هذه الكلمة؟", why: "من «السراج في غريب القرآن».", link: "#/mushaf/" + x.sn + "?a=" + x.a, tag: "🔤" })); if (out.length >= n) break; }
    return out;
  }
  async function genHaraka(k, n) {
    const out = [], H = ["\u064E", "\u0650", "\u064F"], NM = { "\u064E": "فتحة", "\u0650": "كسرة", "\u064F": "ضمة" };
    for (const s of mix(await amma(k))) { const ay = s.ayat[Math.floor(rnd() * s.ayat.length)] || "", ws = String(ay).replace(/^﻿?بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, "").split(/\s+/);
      const c = mix(ws.map((w, i) => [w, i]).filter(([w]) => bare(w).length >= 3 && /[\u064E\u0650\u064F]$/.test(w) && !/[\u0651\u064B-\u064D]$/.test(w.slice(0, -1))))[0]; if (!c) continue;
      const [w, i] = c, last = w.slice(-1), base = w.slice(0, -1), ctx = ws.map((x, j) => j === i ? "⟨" + base + "؟⟩" : x).join(" ");
      out.push(mk(ctx, base + last, H.filter(h => h !== last).map(h => base + h), { sub: "اختر ضبط آخر الكلمة بين القوسين كما في المصحف", why: "آخرها " + NM[last] + " في المصحف.", link: "#/mushaf/" + s.n, tag: "ـَ", qcls: "ayq" })); if (out.length >= n) break; }
    return out;
  }
  async function genTartib(k, n) {
    const out = [];
    for (const s of mix(await amma(k))) { const L = s.ayat.map((a, i) => [String(a).replace(/^﻿?بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, ""), i + 1]).filter(([a]) => { const n_ = a.split(/\s+/).length; return n_ >= 3 && n_ <= 6; }); if (!L.length) continue;
      const [a, i] = L[Math.floor(rnd() * L.length)], w = a.split(/\s+/), wr = new Set(); for (let t = 0; t < 20 && wr.size < 2; t++) { const x = mix(w).join(" "); if (x !== a) wr.add(x); } if (wr.size < 2) continue;
      out.push(mk("", a, [...wr], { sub: "أيّ هذه هي الآية بترتيبها الصحيح؟", why: "سورة " + s.n + "، الآية " + AR(i) + ".", link: "#/mushaf/" + s.n + "?a=" + i, tag: "🧩", ocls: "ayq" })); if (out.length >= n) break; }
    return out;
  }
  async function genJarr(k, n) {
    const S = ((await getj("data/arabic-mid.json")) || {}).s || [], J_ = new Set(["في", "إلى", "على", "عن"]), P = new Set(["من", "ما", "لا", "إن", "أن", "ثم", "أو", "قد", "لم", "لن", "هل", "بل", "إذا", "حتى", "كما", "مع", "منذ"]), out = [];
    for (const x of mix(S.filter(y => y.j && y.w <= 10))) { const t = x.t.replace(/،/g, " ").split(/\s+/).filter(Boolean), r = t[x.j[0]], wr = pick(t.filter(w => !J_.has(w) && !P.has(w) && !/^[وفبكل]?(في|إلى|على|عن)$/.test(w) && w.length >= 3), 2); if (wr.length < 2) continue;
      out.push(mk(x.t, r, wr, { sub: "أيّ هذه الكلمات حرف جر؟", why: "حروف الجر: من، إلى، عن، على، في، الباء، الكاف، اللام…", link: "#/book/" + x.a + "/1", tag: "🔗" })); if (out.length >= n) break; }
    return out;
  }
  const GEN = { hadith: genHadith, rawi: genRawi, sura: genSura, nazm: genNazm, exer: genExer, gharib: genGharib, haraka: genHaraka, tartib: genTartib, jarr: genJarr };
  async function mixed(k, n, ctx) {
    const parts = await Promise.all([genHadith(k, 3), genSura(k, 3), genRawi(k, 2), genNazm(k, k === "t1" ? 0 : 2), genExer(k, 2), genGharib(k, 2), genHaraka(k, k === "t1" ? 0 : 1), genJarr(k, k === "t1" ? 0 : 1)]);
    return mix(parts.flat().concat(fromQZ(ctx.qz, 3))).slice(0, n);
  }

  // ---------- المحرّك ----------
  let G = null, CTX = null, TM = null;
  const name = g => g === "mine" ? "أسئلة اليوم" : (GAMES.find(x => x[0] === g) || [])[1] || "";
  function font() { if (document.getElementById("kidfont")) return; const l = document.createElement("link"); l.id = "kidfont"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@500;700;800&display=swap"; document.head.appendChild(l); }
  async function run(g, q, ctx) {
    font(); CTX = ctx; clearInterval(TM); const k = q.k || ctx.k || "t2", day = new Date().toISOString().slice(0, 10);
    rnd = g === "daily" ? seeded(day + k) : Math.random;
    view(ctx.head(name(g), true) + '<div class="tpload">🎈 جارٍ تجهيز الأسئلة…</div></div>');
    // الأسئلة التي سبق أن أجابها الطفل (لكل ملف طفل) تؤخَّر، فيجد جديدًا في كل لعبة وكل زيارة
    const kidId = (ctx.kid && ctx.kid.id) || "x", T0 = S.tala = S.tala || { stars: 0, done: {} }, QS = (T0.qseen = T0.qseen || {})[kidId] = T0.qseen[kidId] || [];
    const hq = x => { let h = 0; const t = String(x.q || "") + "|" + String(x.o[x.a] || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h.toString(36); };
    const unseen = a => { const n = a.filter(x => !QS.includes(hq(x))); return n.length >= Math.min(5, a.length) ? n.concat(a.filter(x => QS.includes(hq(x)))) : a; };
    if (g === "mine") { rnd = seeded(day + k + kidId + ":" + (((T0.dn || {})[kidId + new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate()]) || 0)); const big = await mixed(k, 40, ctx); rnd = Math.random; G0 = { hq, QS }; return start(g, k, day, unseen(big).slice(0, 5), ctx); }
    let L = g === "daily" ? await mixed(k, 10, ctx) : g === "race" ? await mixed(k, 40, ctx).then(async a => a.length < 30 ? a.concat(await genSura(k, 15), await genHadith(k, 10)) : a) : await GEN[g](k, 10);
    rnd = Math.random; G0 = { hq, QS };
    if (g !== "daily") L = unseen(L);
    return start(g, k, day, L, ctx);
  }
  let G0 = null;
  function start(g, k, day, L, ctx) {
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
    if (G0) { const h = G0.hq(x); if (!G0.QS.includes(h)) { G0.QS.push(h); if (G0.QS.length > 3000) G0.QS.splice(0, 500); } }
    document.querySelectorAll(".tpbtn").forEach(b => { b.disabled = true; if (+b.dataset.i === x.a) b.classList.add("right"); });
    if (ok) { G.s++; G.streak++; burst(el); TSFX.right(); } else { el.classList.add("wrong"); G.streak = 0; TSFX.wrong(); }
    if (G.end) { setTimeout(() => { G.i++; if (G.i >= G.L.length) finish(); else draw(); }, ok ? 350 : 900); return; }
    const fb = document.getElementById("tpfb"); fb.hidden = false; fb.className = "tpfb " + (ok ? "ok" : "no");
    fb.innerHTML = `<b>${ok ? TSFX.text("ok") + " " + ["⭐", "🌟", "🎉", "💚"][Math.floor(Math.random() * 4)] : "لا بأس، الصحيح مظلل بالأخضر 💪"}</b>${x.why ? `<p>${esc(x.why)}</p>` : ""}<div class="row">${x.link ? `<a class="btn s" href="${x.link}">📖 من المكتبة</a>` : ""}<button class="btn p" data-act="tp-next">التالي ←</button></div>`;
  }
  function finish() {
    clearInterval(TM); const n = G.end ? G.i : G.L.length, sc = G.s, r = n ? sc / n : 0, stars = G.end ? Math.min(5, Math.floor(sc / 3)) : r >= .9 ? 3 : r >= .6 ? 2 : sc ? 1 : 0;
    if (stars) CTX.star(stars); TSFX.done(stars > 0);
    const T = S.tala = S.tala || { stars: 0, done: {} }; if (G.g === "daily") { T.daily = T.daily || {}; T.daily[G.day + G.k] = sc; }
    T.best = T.best || {}; const bk = G.g + G.k, best = T.best[bk] || 0, nb = sc > best; if (nb) T.best[bk] = sc; saveS();
    view(CTX.head(name(G.g), true) + `<div class="tpwin"><div class="tpbig">${r >= .9 || (G.end && sc >= 12) ? "🏆" : r >= .6 || (G.end && sc >= 6) ? "🥈" : "🌱"}</div><h2>${G.end ? "انتهى السباق!" : "انتهت الجولة!"}</h2>${stars ? `<p class="tpcongrats">${esc(TSFX.text("done"))}</p>` : ""}
      <p class="tpscore">${AR(sc)} ${G.end ? "إجابة صحيحة في دقيقة" : "من " + AR(n)}</p><p>${"⭐".repeat(stars) || "حاول مرة أخرى، ستنجح بإذن الله!"}</p>${nb && best ? `<p class="tpfire">🎊 رقم قياسي جديد! (السابق ${AR(best)})</p>` : best && !nb ? `<p class="mut">أفضل نتيجة لك: ${AR(best)}</p>` : ""}
      <div class="row" style="justify-content:center">${G.g !== "daily" ? `<a class="btn p" href="#/talaea/games?g=${G.g}&k=${G.k}&r=${Date.now()}">🔁 مرة أخرى</a>` : ""}<a class="btn" href="#/talaea">🌟 كل الألعاب</a></div></div></div>`);
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act^=tp-]"); if (!el || !G) return; if (el.dataset.act === "tp-ans") answer(el); else if (el.dataset.act === "tp-next") { G.i++; draw(); } });
  return { GAMES, has, run, font };
})();
