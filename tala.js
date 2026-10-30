/* «الطلائع» — قسم الأطفال (الباب ٣٤ من الوثيقة، باسم الطلائع بطلب صاحب المكتبة).
   مسارات عمرية تديرها الإدارة، ومكتبة فرعية من كتب المكتبة الموسومة للأطفال، وألعاب تعليمية تعمل داخل الموقع
   بلا روابط خارجية ولا إعلانات ولا تواصل مع الغرباء. نص القرآن من مصحف المكتبة (data/quran/quran.json) دون تعديل.
   البيانات القابلة للتعديل: data/tala.json (المسارات، وأسئلة «صح أم خطأ» مع شرحها، وكتب كل مسار). نجوم الطفل على جهازه فقط. */
const TALA = (() => {
  const P = "data/tala.json";
  const DEF = { tracks: [["t1", "المستكشفون الصغار", "٥–٧ سنوات"], ["t2", "براعم المعرفة", "٨–١٠ سنوات"], ["t3", "رواد العلم", "١١–١٣ سنة"], ["t4", "الناشئة", "١٤ سنة فما فوق"]], facts: [], books: {} };
  let D = null, Q = null;
  const load = async f => { if (D && !f) return D; try { const r = await fetch(P + (f ? "?fresh=1" : "")); D = Object.assign({}, DEF, r.ok ? await r.json() : {}); } catch (e) { D = Object.assign({}, DEF); } return D; };
  const quran = async () => Q || (Q = fetch("data/quran/quran.json").then(r => r.json()).then(j => j.suras.map(s => ({ n: s.n, name: s.name, ayat: s.ayat.map((a, i) => (i === 0 && s.n !== 1 && s.n !== 9 ? a.replace(/^﻿?بسم الله الرحمن الرحيم\s*/, "") : a.replace(/^﻿/, "")).trim()).filter(Boolean) }))));
  const st = () => (S.tala = S.tala || { stars: 0, done: {} });
  const star = n => { st().stars += n; saveS(); const el = $("#tstars"); if (el) el.textContent = toAr(st().stars); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kidBooks = k => { const ids = new Set(((D.books || {})[k] || [])); return lib.books.filter(b => !b.hidden && !b.demo && (ids.has(b.id) || (b.tags || []).includes("tala:" + k) || (!k && (b.tags || []).some(t => /^tala(:|$)/.test(t))))); };
  const GAMES = [["ayah", "أكمل الآية", "اختر الكلمة التي تُكمل الآية من سور جزء عمّ", "📖"], ["order", "رتّب الآيات", "رتّب آيات السورة كما في المصحف", "🔢"], ["tf", "صح أم خطأ؟", "ميّز المعلومة الصحيحة من الخاطئة مع الشرح", "✅"], ["memory", "ذاكرة الحروف", "اقلب البطاقات وطابق الحروف المتشابهة", "🧠"]];
  const head = (t, back) => `<div class="tala"><div class="talah"><a href="#/talaea" class="talab">🌟 الطلائع</a><span class="mut">${t || ""}</span><span class="tstar">⭐ <b id="tstars">${toAr(st().stars)}</b></span></div>${back ? `<p><a href="#/talaea">← العودة إلى الطلائع</a></p>` : ""}`;
  async function show(q, sub) {
    await load();
    if (sub === "games" && q.g) return game(q.g, q);
    if (sub === "track") return track(q.k);
    if (sub === "ladder") return ladder(q.k || (kid() || {}).track || "t1", q);
    if (sub === "parents") return parents();
    view_(head("عالم المعرفة والمرح للأطفال") + `<h2 class="talat">مرحبًا بك في الطلائع</h2><p>تعلّم القرآن والآداب والمعرفة، والعب ألعابًا مفيدة، واجمع النجوم!</p>
      <h3>اختر مسارك</h3><div class="talag">${D.tracks.map(([k, n, a]) => `<a class="talac tk-${k}" href="#/talaea/track?k=${k}"><b>${esc(n)}</b><span>${esc(a)}</span></a>`).join("")}</div>
      ${await todayCard()}
      <h3>سُلّم القراءة</h3><p class="mut">كتب ومقالات مختارة من المكتبة لكل مرحلة، مرتبة مستويات من الأسهل إلى الأصعب، ولكل قراءة سؤال تأمل ونجوم.</p><div class="talag">${D.tracks.map(([k, n, a]) => `<a class="talac tk-${k}" href="#/talaea/ladder?k=${k}"><i aria-hidden="true">📚</i><b>${esc(n)}</b><span>${esc(a)}</span></a>`).join("")}</div>
      <p><a class="btn" href="#/talaea/parents">👪 ركن الوالدين: المنهجية ومتابعة القراءة</a></p>
      <h3>الألعاب التعليمية</h3><div class="talag">${GAMES.map(([g, n, d, ic]) => `<a class="talac game" href="#/talaea/games?g=${g}"><i aria-hidden="true">${ic}</i><b>${n}</b><span>${d}</span></a>`).join("")}</div>
      <h3>مكتبة الطلائع</h3>${kidBooks("").map(bookCard).join("") || '<div class="note">تُضاف كتب الأطفال وقصصهم هنا قريبًا بإذن الله بعد اختيارها ومراجعتها.</div>'}
      <p class="note">إلى الوالدين: هذا القسم بلا إعلانات ولا روابط خارجية ولا تعليقات أو مراسلة، ونجوم الطفل تُحفظ على هذا الجهاز وحده. نص القرآن الكريم في الألعاب من مصحف المكتبة دون تغيير.</p></div>`);
  }
  const view_ = h => view(h);
  function track(k) {
    const t = D.tracks.find(x => x[0] === k) || D.tracks[0], bs = kidBooks(t[0]);
    view_(head(t[1] + " — " + t[2], true) + `<h2 class="talat">${esc(t[1])}</h2><p class="mut">${esc(t[2])}. ويمكن اختيار المستوى الأنسب لمهارة الطفل لا لعمره وحده.</p>
     <p><a class="btn p" href="#/talaea/ladder?k=${t[0]}">📚 سُلّم القراءة لهذه المرحلة</a></p>
     <h3>الألعاب</h3><div class="talag">${GAMES.map(([g, n, d, ic]) => `<a class="talac game" href="#/talaea/games?g=${g}&k=${t[0]}"><i aria-hidden="true">${ic}</i><b>${n}</b><span>${d}</span></a>`).join("")}</div>
     <h3>كتب وقصص المسار</h3>${bs.map(bookCard).join("") || '<div class="note">لم تُضف كتب لهذا المسار بعد.</div>'}</div>`);
  }
  // ---------- الألعاب ----------
  let G = null;
  async function game(g, q) {
    if (g === "ayah" || g === "order") {
      const Qs = await quran(), am = Qs.filter(s => s.n >= 78), sn = +q.s || 0, s = am.find(x => x.n === sn);
      if (!s) return view_(head(g === "ayah" ? "أكمل الآية" : "رتّب الآيات", true) + `<h2 class="talat">${g === "ayah" ? "أكمل الآية" : "رتّب الآيات"}</h2><p>اختر سورة من جزء عمّ:</p><div class="chips">${am.slice().reverse().map(x => `<a class="chip" href="#/talaea/games?g=${g}&s=${x.n}">${esc(x.name.replace(/^سُورَةُ\s*/, ""))}</a>`).join("")}</div></div>`);
      return g === "ayah" ? ayahRound(s, 0, 0) : orderRound(s);
    }
    if (g === "tf") { const fs = shuffle(D.facts || []).slice(0, 10); if (!fs.length) return view_(head("صح أم خطأ؟", true) + '<div class="note">تُضاف الأسئلة قريبًا.</div></div>'); G = { fs, i: 0, s: 0 }; return tfRound(); }
    if (g === "memory") return memory();
    location.hash = "#/talaea";
  }
  const sname = s => esc(s.name.replace(/^سُورَةُ\s*/, ""));
  function ayahRound(s, i, sc) {
    const cand = s.ayat.map((a, j) => [j, a]).filter(([, a]) => a.split(" ").length >= 3);
    if (!G || G.s !== s.n || i === 0) G = { s: s.n, list: shuffle(cand).slice(0, Math.min(6, cand.length)), sc: 0 };
    if (i >= G.list.length) { star(G.sc); return view_(head("أكمل الآية", true) + `<div class="talawin"><h2>أحسنت! 🎉</h2><p>أجبت ${toAr(G.sc)} من ${toAr(G.list.length)} في سورة ${sname(s)}، وحصلت على ${toAr(G.sc)} نجوم.</p><a class="btn p" href="#/talaea/games?g=ayah&s=${s.n}&r=${Date.now()}">العب مرة أخرى</a> <a class="btn" href="#/talaea/games?g=ayah">سورة أخرى</a></div></div>`); }
    const [j, a] = G.list[i], ws = a.split(" "), last = ws.pop(), ends = [...new Set(s.ayat.map(x => x.split(" ").pop()).filter(w => w !== last))];
    const opts = shuffle([last, ...shuffle(ends).slice(0, 2)]);
    view_(head("أكمل الآية — سورة " + sname(s), true) + `<p class="mut">السؤال ${toAr(i + 1)} من ${toAr(G.list.length)}</p><p class="talaq quran">${esc(ws.join(" "))} <span class="blank">……</span></p>
      <div class="talao">${opts.map(o => `<button class="btn talaopt" data-act="tala-ay" data-v="${esc(o)}" data-ok="${o === last ? 1 : 0}" data-i="${i}" data-s="${s.n}">${esc(o)}</button>`).join("")}</div><div id="tfb" class="talafb" hidden></div></div>`);
    G.full = a;
  }
  function orderRound(s) {
    const n = Math.min(4, s.ayat.length), st0 = Math.floor(Math.random() * (s.ayat.length - n + 1)), seg = s.ayat.slice(st0, st0 + n).map((t, k) => ({ t, k }));
    G = { s, seg, pick: [] };
    view_(head("رتّب الآيات — سورة " + sname(s), true) + `<p>اضغط على الآيات بترتيبها في المصحف (من الآية ${toAr(st0 + 1)}):</p><div class="talao col">${shuffle(seg).map(x => `<button class="btn talaopt quran" data-act="tala-or" data-k="${x.k}">${esc(x.t)}</button>`).join("")}</div><ol id="tord" class="quran"></ol><div id="tfb" class="talafb" hidden></div></div>`);
  }
  function tfRound() {
    if (G.i >= G.fs.length) { star(G.s); return view_(head("صح أم خطأ؟", true) + `<div class="talawin"><h2>انتهت الجولة 🎉</h2><p>أجبت ${toAr(G.s)} من ${toAr(G.fs.length)} إجابة صحيحة.</p><a class="btn p" href="#/talaea/games?g=tf&r=${Date.now()}">جولة جديدة</a></div></div>`); }
    const f = G.fs[G.i];
    view_(head("صح أم خطأ؟", true) + `<p class="mut">السؤال ${toAr(G.i + 1)} من ${toAr(G.fs.length)}</p><p class="talaq">${esc(f.q)}</p><div class="talao"><button class="btn talaopt" data-act="tala-tf" data-v="1">✅ صح</button><button class="btn talaopt" data-act="tala-tf" data-v="0">❌ خطأ</button></div><div id="tfb" class="talafb" hidden></div></div>`);
  }
  function memory() {
    const L = shuffle("ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("")).slice(0, 6), cards = shuffle([...L, ...L]);
    G = { cards, open: [], done: 0, moves: 0 };
    view_(head("ذاكرة الحروف", true) + `<p>اقلب بطاقتين في كل مرة، وطابق الحرفين المتشابهين.</p><div class="talamem">${cards.map((c, i) => `<button class="mcard" data-act="tala-mem" data-i="${i}" aria-label="بطاقة ${toAr(i + 1)}"><span>${c}</span></button>`).join("")}</div><p class="mut" id="tmv">المحاولات: ٠</p></div>`);
  }
  const fb = (ok, html) => { const el = $("#tfb"); el.hidden = false; el.className = "talafb " + (ok ? "ok" : "no"); el.innerHTML = html; };
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=tala-]"); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); const a = el.dataset.act;
    if (a === "tala-ay") {
      document.querySelectorAll(".talaopt").forEach(b => b.disabled = true); const ok = el.dataset.ok === "1"; if (ok) G.sc++;
      el.classList.add(ok ? "right" : "wrong");
      fb(ok, `${ok ? "إجابة صحيحة! ⭐" : "حاول مرة أخرى في الجولة القادمة."}<p class="quran">﴿${esc(G.full)}﴾</p><button class="btn p" data-act="tala-next" data-i="${+el.dataset.i + 1}" data-s="${el.dataset.s}">التالي</button>`);
    } else if (a === "tala-next") { quran().then(Qs => ayahRound(Qs.find(x => x.n === +el.dataset.s), +el.dataset.i, 0)); }
    else if (a === "tala-or") {
      const k = +el.dataset.k, want = G.pick.length;
      if (k === want) { G.pick.push(k); el.disabled = true; el.classList.add("right"); $("#tord").insertAdjacentHTML("beforeend", `<li>${esc(G.seg[k].t)}</li>`);
        if (G.pick.length === G.seg.length) { star(2); fb(true, `ممتاز! رتّبت الآيات ترتيبًا صحيحًا ⭐⭐<br><a class="btn p" href="#/talaea/games?g=order&s=${G.s.n}&r=${Date.now()}">آيات أخرى</a> <a class="btn" href="#/talaea/games?g=order">سورة أخرى</a>`); } }
      else { el.classList.add("wrong"); setTimeout(() => el.classList.remove("wrong"), 600); }
    } else if (a === "tala-tf") {
      const f = G.fs[G.i], ok = (el.dataset.v === "1") === !!f.a; if (ok) G.s++;
      document.querySelectorAll(".talaopt").forEach(b => b.disabled = true);
      fb(ok, `${ok ? "أحسنت! ⭐" : "ليست صحيحة."} ${f.a ? "المعلومة صحيحة." : "المعلومة خاطئة."}${f.why ? `<p>${esc(f.why)}</p>` : ""}<button class="btn p" data-act="tala-tfn">التالي</button>`);
    } else if (a === "tala-tfn") { G.i++; tfRound(); }
    else if (a === "tala-mem") {
      const i = +el.dataset.i; if (el.classList.contains("on") || G.open.length === 2) return;
      el.classList.add("on"); G.open.push(i);
      if (G.open.length === 2) { G.moves++; $("#tmv").textContent = "المحاولات: " + toAr(G.moves); const [x, y] = G.open, bs = document.querySelectorAll(".mcard");
        if (G.cards[x] === G.cards[y]) { bs[x].classList.add("ok"); bs[y].classList.add("ok"); G.open = []; G.done++; if (G.done === G.cards.length / 2) { const s = G.moves <= 9 ? 3 : G.moves <= 14 ? 2 : 1; star(s); $("#tmv").innerHTML = `أحسنت! أنهيتها في ${toAr(G.moves)} محاولة، ولك ${toAr(s)} نجوم ⭐ <a class="btn s" href="#/talaea/games?g=memory&r=${Date.now()}">العب مرة أخرى</a>`; } }
        else setTimeout(() => { bs[x].classList.remove("on"); bs[y].classList.remove("on"); G.open = []; }, 800); }
    }
  }, true);
  // ---------- الإدارة ----------
  async function admin() {
    await load(true);
    return `<p class="mut">أسماء المسارات، وأسئلة «صح أم خطأ» مع شرحها، وكتب كل مسار (بمعرّفات الكتب في المكتبة). تأكد من صحة كل معلومة ومناسبتها للأطفال قبل الحفظ.</p>
     <form data-form="talasave"><h3>المسارات العمرية</h3>${D.tracks.map(([k, n, a], i) => `<div class="row"><input name="tn${i}" value="${esc(n)}" aria-label="اسم المسار"><input name="ta${i}" value="${esc(a)}" aria-label="العمر"><input name="tb${i}" value="${esc(((D.books || {})[k] || []).join(" "))}" placeholder="معرّفات الكتب مفصولة بمسافة" aria-label="كتب المسار"></div>`).join("")}
     <h3>أسئلة «صح أم خطأ» (${toAr((D.facts || []).length)})</h3><p class="mut">سطر لكل سؤال بالصيغة: المعلومة | صح أو خطأ | الشرح</p>
     <textarea name="facts" rows="12" style="width:100%">${esc((D.facts || []).map(f => [f.q, f.a ? "صح" : "خطأ", f.why || ""].join(" | ")).join("\n"))}</textarea>
     <h3>استبعاد من سُلّم القراءة</h3><p class="mut">معرّفات مقالات أو كتب لا تناسب الأطفال (مفصولة بمسافة)؛ يُعاد بناء السلم آليًا (tools/tala-curate.py) بعد الحفظ.</p><textarea name="hide" rows="2" style="width:100%">${esc((D.planHide || []).join(" "))}</textarea>
     <div class="savebar"><button class="btn p">حفظ</button> <span id="talast" class="mut"></span></div></form>`;
  }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=talasave]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), stt = $("#talast"); stt.textContent = "جارٍ الحفظ…";
    const tracks = D.tracks.map(([k], i) => [k, String(fd.get("tn" + i) || "").trim() || D.tracks[i][1], String(fd.get("ta" + i) || "").trim()]);
    const books = {}; D.tracks.forEach(([k], i) => { const v = String(fd.get("tb" + i) || "").split(/\s+/).filter(x => x && B(x)); if (v.length) books[k] = v; });
    const facts = String(fd.get("facts") || "").split("\n").map(l => l.split("|").map(s => s.trim())).filter(p => p[0] && /^(صح|خطأ)$/.test(p[1] || "")).map(p => ({ q: p[0], a: p[1] === "صح", why: p[2] || "" }));
    try { await GH.editJSON(P, o => ({ v: 1, tracks, facts, books, planHide: String(fd.get("hide") || "").split(/\s+/).filter(Boolean) }), "الطلائع: المسارات والأسئلة (" + facts.length + ")"); stt.textContent = "حُفظ ✓"; D = null; } catch (err) { stt.textContent = "تعذر الحفظ: " + err.message; }
  }, true);
  // ---------- سُلّم القراءة وملفات الأطفال وركن الوالدين ----------
  let PL = null;
  const plan = async () => PL || (PL = await fetch("data/tala-plan.json").then(r => r.ok ? r.json() : { tracks: {} }).catch(() => ({ tracks: {} })));
  const kids = () => (st().kids = st().kids || []);
  const kid = () => kids().find(x => x.id === st().cur) || kids()[0] || null;
  const prog = () => { const k = kid(), id = k ? k.id : "_"; st().p = st().p || {}; return st().p[id] = st().p[id] || { done: {}, notes: {}, mins: 0 }; };
  const keyOf = it => it.a ? "a:" + it.a : "b:" + it.b + ":" + it.p;
  const itTitle = it => { if (it.a) { const b = B(it.a); return b ? b.title : null; } const b = B(it.b); return b ? (b.setTitle || b.title) + " — ص " + toAr(it.p) + (it.q > it.p ? "–" + toAr(it.q) : "") : null; };
  const itHref = it => it.a ? "#/book/" + encodeURIComponent(it.a) + "/1" : "#/book/" + encodeURIComponent(it.b) + "/" + it.p;
  const levelsOf = async k => ((await plan()).tracks[k] || []).map(l => l.filter(it => itTitle(it))).filter(l => l.length);
  const ratio = l => l.filter(it => prog().done[keyOf(it)]).length / l.length;
  async function todayCard() {
    const k = kid(); const tk = k ? k.track : null;
    const prof = `<div class="talakids">${kids().map(x => `<button class="talakid${k && x.id === k.id ? " on" : ""}" data-act="talakid" data-id="${x.id}">${esc(x.av || "🙂")} ${esc(x.name)}</button>`).join("")}<button class="talakid add" data-act="talakidnew">+ طفل</button></div>`;
    if (!k) return `<h3>من يقرأ اليوم؟</h3>${prof}<p class="mut">أنشئ ملفًا لكل طفل (على هذا الجهاز فقط) ليحفظ تقدمه ونجومه في سُلّم القراءة.</p>`;
    const L = await levelsOf(tk); let next = null;
    for (const l of L) { next = l.find(it => !prog().done[keyOf(it)]); if (next) break; }
    return `<h3>قراءة اليوم</h3>${prof}${next ? `<div class="talac today"><b>📖 ${esc(itTitle(next))}</b><span>نحو ${toAr(next.m || 5)} ${(next.m || 5) <= 10 ? "دقائق" : "دقيقة"} • مرحلة ${esc((D.tracks.find(t => t[0] === tk) || [])[1] || "")}</span><div class="row"><a class="btn p" href="${itHref(next)}">اقرأ الآن</a><button class="btn" data-act="taladone" data-k="${esc(keyOf(next))}" data-m="${next.m || 5}">أنهيتها ✓</button></div></div>` : '<p class="note">أتممت سُلّم مرحلتك كله! اختر المرحلة التالية من ركن الوالدين. 🎉</p>'}`;
  }
  async function ladder(k, q) {
    const t = D.tracks.find(x => x[0] === k) || D.tracks[0], L = await levelsOf(t[0]), unlock = !!st().unlock;
    let open = true;
    const lv = L.map((l, i) => { const r = ratio(l), isOpen = open || unlock; if (r < 0.75) open = false;
      return `<details class="talalv${r >= 1 ? " done" : ""}"${isOpen && r < 1 && (i === 0 || ratio(L[i - 1]) >= 0.75) ? " open" : ""}><summary><b>المستوى ${toAr(i + 1)}</b> ${r >= 1 ? "🏅" : isOpen ? "" : "🔒"} <span class="mut">${toAr(Math.round(r * 100))}٪ • نحو ${toAr(l.reduce((s, x) => s + (x.m || 5), 0))} دقيقة</span></summary>
        ${isOpen ? l.map(it => { const d = prog().done[keyOf(it)]; return `<div class="talait${d ? " ok" : ""}"><a href="${itHref(it)}">${it.a ? "📰" : "📖"} ${esc(itTitle(it))}</a><span class="mut">${toAr(it.m || 5)} د</span>${d ? `<span>✓${prog().notes[keyOf(it)] ? " 💭" : ""}</span>` : `<button class="btn s" data-act="taladone" data-k="${esc(keyOf(it))}" data-m="${it.m || 5}">أنهيتها</button>`}</div>`; }).join("") : '<p class="mut">يُفتح بعد إتمام ثلاثة أرباع المستوى السابق.</p>'}</details>`; }).join("");
    view_(head(t[1] + " — سُلّم القراءة", true) + `<h2 class="talat">📚 سُلّم القراءة: ${esc(t[1])}</h2><p class="mut">${esc(t[2])}. ${t[0] === "t1" ? "في هذه المرحلة يقرأ الوالد للطفل ويحاوره فيما قرأ." : "اقرأ ثم اضغط «أنهيتها» واكتب ما تعلمته لتربح النجوم."}</p>
      ${kid() ? `<p>القارئ: <b>${esc(kid().av || "🙂")} ${esc(kid().name)}</b></p>` : `<p class="note">أنشئ ملفًا للطفل من صفحة الطلائع الرئيسية ليُحفظ تقدمه.</p>`}
      <nav class="chips">${D.tracks.map(([x, n]) => `<a class="chip${x === t[0] ? " x" : ""}" href="#/talaea/ladder?k=${x}">${esc(n)}</a>`).join("")}</nav>
      ${lv || '<div class="note">يُبنى سُلّم هذه المرحلة قريبًا.</div>'}</div>`);
  }
  async function parents() {
    const P_ = await plan(), k = kid();
    const rows = kids().map(x => { const p = (st().p || {})[x.id] || { done: {}, notes: {}, mins: 0 }, n = Object.keys(p.done).length;
      return `<div class="talait"><b>${esc(x.av || "🙂")} ${esc(x.name)}</b><span class="mut">${esc((D.tracks.find(t => t[0] === x.track) || [])[1] || "")} • ${toAr(n)} قراءة • ${toAr(p.mins || 0)} دقيقة</span>
        <select data-act="talatrack" data-id="${x.id}">${D.tracks.map(([t, nm]) => `<option value="${t}"${t === x.track ? " selected" : ""}>${esc(nm)}</option>`).join("")}</select><button class="btn s" data-act="talakiddel" data-id="${x.id}">حذف الملف</button></div>
        ${Object.entries(p.notes).slice(-8).map(([kk, v]) => `<p class="mut talanote">💭 «${esc(v)}» — ${esc(itTitle(kk.startsWith("a:") ? { a: kk.slice(2) } : { b: kk.split(":")[1], p: +kk.split(":")[2] }) || "")}</p>`).join("")}`; }).join("");
    view_(head("ركن الوالدين", true) + `<h2 class="talat">👪 ركن الوالدين</h2>
      <h3>منهجية القراءة</h3><div class="card talameth">${esc(P_.method || "").split("\n").map(l => `<p>${l.trim()}</p>`).join("")}<p>يُفتح كل مستوى بعد إتمام ثلاثة أرباع ما قبله، والقراءة اليومية القصيرة المنتظمة خير من الطويلة المتقطعة؛ ويحسن أن يحاور الوالد الطفل فيما قرأ وأن يطّلع على تأملاته أدناه.</p></div>
      <label class="inl"><input type="checkbox" data-act="talaunlock"${st().unlock ? " checked" : ""}> فتح كل المستويات (يقرر الوالد)</label>
      <h3>متابعة الأطفال</h3>${rows || '<p class="mut">لا ملفات أطفال بعد.</p>'}
      <h3>مقالات في تربية الأبناء</h3><div class="list">${(P_.parents || []).map(id => B(id)).filter(Boolean).reverse().slice(0, 20).map(bookCard).join("")}</div>
      <p class="note">كل بيانات الأطفال (الأسماء والتقدم والتأملات) محفوظة على هذا الجهاز وحده، ولا تُرسل إلى أي جهة.</p></div>`);
  }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=tala]"); if (!el) return; const a = el.dataset.act;
    if (a === "talakidnew") { const name = (prompt("اسم الطفل:") || "").trim().slice(0, 20); if (!name) return; const age = +prompt("عمره بالسنوات:", "8") || 8;
      const track = age <= 7 ? "t1" : age <= 10 ? "t2" : age <= 13 ? "t3" : "t4", AV = ["🦁", "🐢", "🦉", "🐬", "🌟", "🚀", "🌷", "🦋"];
      const x = { id: Date.now().toString(36), name, track, av: AV[kids().length % AV.length] }; kids().push(x); st().cur = x.id; saveS(); show({}, ""); }
    else if (a === "talakid") { st().cur = el.dataset.id; saveS(); show({}, ""); }
    else if (a === "talakiddel") { if (confirm("حذف ملف الطفل وتقدمه من هذا الجهاز؟")) { st().kids = kids().filter(x => x.id !== el.dataset.id); if (st().p) delete st().p[el.dataset.id]; saveS(); parents(); } }
    else if (a === "talaunlock") { st().unlock = el.checked; saveS(); }
    else if (a === "taladone") { const k = el.dataset.k; if (prog().done[k]) return;
      const note = (prompt("أحسنت! ما أهم شيء تعلمته مما قرأت؟ (اختياري)") || "").trim().slice(0, 200);
      prog().done[k] = Date.now(); prog().mins = (prog().mins || 0) + (+el.dataset.m || 5); if (note) prog().notes[k] = note; star(note ? 3 : 2); saveS();
      toast(note ? "⭐⭐⭐ ثلاث نجوم! تأمل جميل." : "⭐⭐ نجمتان!"); route(); }
  });
  document.addEventListener("change", e => { const el = e.target.closest("[data-act=talatrack]"); if (!el) return; const x = kids().find(y => y.id === el.dataset.id); if (x) { x.track = el.value; saveS(); toast("تغيّرت المرحلة."); } });

  return { view: show, admin };
})();
