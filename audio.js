/* صوتيات المكتبة وراديو المكتبة، ومشغّل صوتي واحد يعمل في كل صفحات الموقع وفي خلفية الجهاز.
   الملفات الصوتية في «إصدارات» GitHub للمستودع (مجانًا، خارج مساحة الموقع وR2)، وبيانات كل كتاب في data/audio/<المعرف>.json
   (مدة كل صفحة وتوقيت جملها للنص المتزامن). يولّدها خط tools/tts.py في GitHub Actions، أو يرفعها المشرف تسجيلات بشرية. */
const AREPO = () => (typeof CFG !== "undefined" && CFG.repo) || "dawah-library/sdsl-library";
const RAW = p => "https://raw.githubusercontent.com/" + AREPO() + "/main/" + p;
const fmtT = s => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; const d = n => String(n).padStart(2, "0"); return toAr(h ? `${h}:${d(m)}:${d(x)}` : `${m}:${d(x)}`); };
const fmtDur = s => { s = Math.round(s || 0); if (s < 60) return toAr(s) + " ثانية"; const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return (h ? toAr(h) + " س " : "") + (m ? toAr(m) + " د" : ""); };
const AUDIO = {
  list: null, at: 0, man: new Map(),
  async load(force) {
    if (this.list && !force && Date.now() - this.at < 300e3) return this.list;
    let j = null; try { const r = await fetch(RAW("data/audio/_list.json") + "?t=" + Math.floor(Date.now() / 300e3)); if (r.ok) j = await r.json(); } catch (e) { }
    if (!j) { try { const r = await fetch("data/audio/_list.json"); if (r.ok) j = await r.json(); } catch (e) { } }
    j = j || {};
    // بيانات قديمة بلا مدد الصفحات: تُستكمل من بيان الكتاب
    await Promise.all(Object.entries(j).filter(([, x]) => x.n && !x.ds).map(async ([id, x]) => { const m = await this.manifest(id); if (m && m.pages) { x.ds = []; for (let i = 1; i <= (x.of || 0); i++) x.ds.push(Math.round((m.pages[String(i)] || {}).d || 0)); x.rd = (m.rec || []).map(r => [r.f, Math.round(r.d || 0), r.t]); } }));
    // لا يظهر للأعضاء إلا ما اعتمدته الإدارة بعد تصحيح نصه وتشكيله؛ والمشرف يرى الباقي للمعاينة
    const staff = typeof Cloud !== "undefined" && Cloud.staff();
    Object.keys(j).forEach(id => { if (!j[id].ok) { if (staff) j[id].preview = 1; else delete j[id]; } });
    this.at = Date.now(); return (this.list = j);
  },
  async manifest(bid) {
    if (this.man.has(bid)) return this.man.get(bid);
    const p = (async () => { for (const u of [RAW("data/audio/" + bid + ".json") + "?t=" + Math.floor(Date.now() / 300e3), "data/audio/" + bid + ".json"]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; })();
    this.man.set(bid, p); return p;
  },
  // عبر ممرّ الموقع (functions/au) ليُرسل بنوع audio/mpeg فيعمل على iPhone؛ وفي غير نطاق الموقع مباشرة من GitHub
  url: (bid, f) => (/dawahlibrary\.org$|\.pages\.dev$/.test(location.hostname) ? "/au/" + bid + "/" : "https://github.com/" + AREPO() + "/releases/download/audio-" + bid + "/") + f,
  page: p => "p" + String(p).padStart(4, "0") + ".mp3",
  ready: x => x && x.n > 0
};
const AMarks = {
  all() { return ls.get("ap_marks", []); },
  add(m) { const l = this.all().filter(x => !(x.bid === m.bid && x.p === m.p && Math.abs(x.t - m.t) < 3)); l.unshift(m); ls.set("ap_marks", l.slice(0, 200)); },
  del(i) { const l = this.all(); l.splice(i, 1); ls.set("ap_marks", l); },
  of(bid) { return this.all().map((m, i) => Object.assign({ i }, m)).filter(m => m.bid === bid); }
};

/* ---------- المشغّل ---------- */
const AP = {
  el: null, q: [], i: -1, mode: "", ch: null, lineup: ls.get("ap_lineup", []), rate: +ls.get("apRate", 1) || 1, sleepAt: 0, sleepEnd: false, sents: [], si: -1, saveT: 0,
  audio() {
    if (this.el) return this.el;
    const a = this.el = new Audio(); a.preload = "auto"; a.setAttribute("playsinline", "");
    a.addEventListener("ended", () => this.next(true));
    a.addEventListener("timeupdate", () => this.tick());
    a.addEventListener("play", () => this.paint()); a.addEventListener("pause", () => this.paint());
    a.addEventListener("waiting", () => this.paint("loading")); a.addEventListener("playing", () => this.paint());
    a.addEventListener("error", () => { if (this.i < 0 || !a.getAttribute("src")) return; this.errs = (this.errs || 0) + 1; if (this.errs >= 3) { this.errs = 0; a.pause(); this.paint(); toast("تعذر الاتصال بملفات الصوت؛ تحقق من الإنترنت ثم اضغط تشغيل"); return; } toast("تعذر تشغيل هذا المقطع؛ ننتقل إلى التالي"); setTimeout(() => this.next(true), 800); });
    a.addEventListener("playing", () => { this.errs = 0; });
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession, h = (k, f) => { try { ms.setActionHandler(k, f); } catch (e) { } };
      h("play", () => this.toggle(true)); h("pause", () => this.toggle(false)); h("nexttrack", () => this.next()); h("previoustrack", () => this.prev());
      h("seekbackward", () => this.seek(-15)); h("seekforward", () => this.seek(15));
    }
    return a;
  },
  cur() { return this.q[this.i]; },
  // تشغيل كتاب من صفحة (وما بعده من قائمة التشغيل)
  async playBook(bid, p, t) {
    const L = await AUDIO.load(); const x = L[bid]; if (!AUDIO.ready(x)) return toast("صوتيات هذا الكتاب قيد التجهيز");
    const q = []; const add = (id, from) => { const y = L[id]; if (!AUDIO.ready(y)) return; (y.ds || []).forEach((d, k) => { if (d > 0 && k + 1 >= (from || 1)) q.push({ bid: id, p: k + 1, d, f: AUDIO.page(k + 1) }); }); };
    add(bid, p || 1); this.lineup.filter(id => id !== bid).forEach(id => add(id, 1));
    if (!q.length) { (x.rd || []).forEach(r => q.push({ bid, p: 1, d: r[1], f: r[0], rec: r[2] })); }
    if (!q.length) return toast("لا مقاطع جاهزة بعد");
    this.mode = "book"; this.ch = null; this.q = q; this.load(0, t || 0, true);
  },
  async playRec(bid, k) { const L = await AUDIO.load(), x = L[bid]; if (!x || !x.rd || !x.rd[k]) return; this.mode = "book"; this.ch = null; this.q = x.rd.map(r => ({ bid, p: 1, d: r[1], f: r[0], rec: r[2] })); this.load(k, 0, true); },
  async playRadio(ch) {
    const q = ch.items; if (!q.length) return toast("لا مقاطع في هذه القناة بعد");
    const { i, off } = radioPos(ch); this.mode = "radio"; this.ch = ch; this.q = q; this.load(i, off, true);
  },
  load(i, t, play) {
    const a = this.audio(), it = this.q[i]; if (!it) return this.stop();
    this.i = i; a.src = AUDIO.url(it.bid, it.f); a.playbackRate = this.mode === "radio" ? 1 : this.rate;
    const seekTo = () => { if (t) { try { a.currentTime = t; } catch (e) { } } a.removeEventListener("loadedmetadata", seekTo); };
    a.addEventListener("loadedmetadata", seekTo);
    if (play) a.play().catch(() => this.paint());
    this.sents = []; this.si = -1; this.meta(); this.paint(); this.loadText(it);
  },
  async loadText(it) { const m = await AUDIO.manifest(it.bid); if (this.cur() !== it) return; const pg = m && m.pages && m.pages[String(it.p)]; this.sents = (!it.rec && pg && pg.s) || []; this.si = -1; this.paintText(); },
  meta() {
    const it = this.cur(); if (!it || !("mediaSession" in navigator)) return; const b = B(it.bid);
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: it.rec || ((b ? b.setTitle || b.title : it.bid) + (it.rec ? "" : " — " + (b && PL(b, it.p - 1) || "صفحة " + it.p))), artist: this.mode === "radio" ? "راديو المكتبة: " + this.ch.n : b ? A(b.authorId).name : "", album: SITENAME, artwork: [{ src: "assets/logo-sdsl-128.png", sizes: "128x128", type: "image/png" }, { src: "assets/logo-sdsl.png", sizes: "512x512", type: "image/png" }] }); } catch (e) { }
  },
  toggle(on) { const a = this.audio(); if (this.i < 0) return; if (on === undefined) on = a.paused; if (on) { if (this.mode === "radio") { const { i, off } = radioPos(this.ch); if (i !== this.i) return this.load(i, off, true); try { a.currentTime = off; } catch (e) { } } a.play().catch(() => { }); } else a.pause(); },
  next(auto) {
    if (auto && this.mode === "book") ARev.onEnd(this.cur());
    if (auto && this.sleepEnd) { this.sleepEnd = false; this.audio().pause(); toast("انتهى مؤقت النوم"); return; }
    if (this.i + 1 < this.q.length) this.load(this.i + 1, 0, true);
    else if (this.mode === "radio") this.load(0, 0, true);
    else { this.audio().pause(); this.paint(); toast("انتهت قائمة الاستماع"); }
  },
  prev() { const a = this.audio(); if (this.mode !== "radio" && a.currentTime > 4) { a.currentTime = 0; return; } if (this.mode !== "radio" && this.i > 0) this.load(this.i - 1, 0, true); },
  seek(d) { if (this.mode === "radio") return; const a = this.audio(); a.currentTime = Math.max(0, Math.min((a.duration || 1e9) - 1, a.currentTime + d)); },
  setRate(r) { this.rate = r; ls.set("apRate", r); if (this.el && this.mode !== "radio") this.el.playbackRate = r; },
  sleep(min) { this.sleepEnd = min === "end"; this.sleepAt = typeof min === "number" && min > 0 ? Date.now() + min * 60e3 : 0; toast(min === "end" ? "يتوقف الاستماع في نهاية المقطع الحالي" : min ? "يتوقف الاستماع بعد " + toAr(min) + " دقيقة" : "أُلغي مؤقت النوم"); this.paintFull(); },
  stop() { if (this.el) { this.el.pause(); this.el.removeAttribute("src"); this.el.load(); } this.i = -1; this.q = []; this.mode = ""; this.paint(); const f = $("#apfull"); if (f) f.hidden = true; },
  tick() {
    const a = this.el, it = this.cur(); if (!a || !it) return;
    if (this.sleepAt && Date.now() > this.sleepAt) { this.sleepAt = 0; a.pause(); toast("انتهى مؤقت النوم"); }
    const ms = a.currentTime * 1000; let k = -1; for (let j = 0; j < this.sents.length; j++) { if (this.sents[j][0] <= ms + 120) k = j; else break; }
    if (k !== this.si) { this.si = k; const box = $("#aptext"); if (box) { box.querySelectorAll(".on").forEach(x => x.classList.remove("on")); const el = box.querySelector(`[data-si="${k}"]`); if (el) { el.classList.add("on"); if (!box.matches(":hover")) el.scrollIntoView({ block: "center", behavior: "smooth" }); } } }
    const pr = $("#approg"); if (pr && !pr.matches(":active")) { pr.max = Math.round(a.duration || it.d || 1); pr.value = Math.round(a.currentTime); }
    const tt = $("#aptime"); if (tt) tt.textContent = fmtT(a.currentTime) + " / " + fmtT(a.duration || it.d);
    const mb = $("#apbar .apfill"); if (mb) mb.style.width = (100 * a.currentTime / (a.duration || it.d || 1)) + "%";
    if (this.mode === "book" && Date.now() - this.saveT > 5000) { this.saveT = Date.now(); ls.set("ap_last", { bid: it.bid, p: it.p, t: Math.floor(a.currentTime), at: Date.now() }); }
  },
  bar() {
    let b = $("#apbar"); if (b) return b;
    document.body.insertAdjacentHTML("beforeend", `<div id="apbar" hidden role="region" aria-label="المشغّل الصوتي"><i class="apfill"></i><button class="apopen" data-act="apfull" aria-label="فتح المشغّل"><span class="apcov"></span><span class="aptx"><b></b><small></small></span></button><button data-act="apprev" aria-label="السابق">⏮</button><button data-act="aptoggle" class="appp" aria-label="تشغيل أو إيقاف">▶</button><button data-act="apnext" aria-label="التالي">⏭</button><button data-act="apclose" aria-label="إغلاق المشغّل">✕</button></div>
    <div id="apfull" hidden role="dialog" aria-label="المشغّل الصوتي"><div class="apfin"></div></div>`);
    return $("#apbar");
  },
  label() {
    const it = this.cur(); if (!it) return ["", ""]; const b = B(it.bid);
    return [it.rec || (b ? b.setTitle || b.title : it.bid), this.mode === "radio" ? "📻 " + this.ch.n + " • مباشر" : (b ? A(b.authorId).name + " • " : "") + (it.rec ? "تسجيل" : (b && PL(b, it.p - 1)) || "صفحة " + toAr(it.p))];
  },
  paint(st) {
    const b = this.bar(), on = this.i >= 0; b.hidden = !on; document.body.classList.toggle("has-ap", on); if (!on) return;
    const [t, s] = this.label(), a = this.audio(), it = this.cur();
    b.querySelector(".aptx b").textContent = t; b.querySelector(".aptx small").textContent = s; b.querySelector(".apcov").setAttribute("style", avHue(it.bid));
    b.querySelector(".apcov").textContent = this.mode === "radio" ? "📻" : "🎧";
    b.querySelector(".appp").textContent = st === "loading" && !a.paused ? "…" : a.paused ? "▶" : "⏸";
    b.classList.toggle("playing", !a.paused); this.paintFull();
  },
  paintText() {
    const box = $("#aptext"); if (!box) return; const it = this.cur(); if (!it) return;
    box.innerHTML = this.sents.length ? this.sents.map((s, k) => `<span data-si="${k}" data-ms="${s[0]}">${esc(s[1])} </span>`).join("") : `<p class="mut">${it.rec ? "تسجيل صوتي بلا نص متزامن." : "النص المتزامن غير متاح لهذا المقطع."}</p>`;
    this.si = -1; this.tick();
  },
  paintFull() {
    const f = $("#apfull"); if (!f || f.hidden) return; const it = this.cur(); if (!it) return; const a = this.audio(), [t, s] = this.label(), radio = this.mode === "radio";
    const b = B(it.bid), rates = [0.75, 1, 1.25, 1.5, 1.75, 2];
    f.querySelector(".apfin").innerHTML = `<div class="aphead"><button class="btn s" data-act="apfullx" aria-label="تصغير">⌄ تصغير</button>${radio ? '<span class="live">● مباشر</span>' : ""}</div>
    <div class="apart" style="${avHue(it.bid)}"><span>${radio ? "📻" : "🎧"}</span>${radio ? '<i class="eq"><b></b><b></b><b></b><b></b><b></b></i>' : ""}</div>
    <h3>${esc(t)}</h3><p class="mut">${esc(s)}</p>
    ${radio ? "" : `<input type="range" id="approg" min="0" max="${Math.round(it.d || 1)}" value="0" aria-label="موضع الاستماع"><div class="mut" id="aptime"></div>`}
    <div class="apctl">${radio ? "" : '<button data-act="apseek" data-d="-15" aria-label="رجوع ١٥ ثانية">⟲١٥</button><button data-act="apprev" aria-label="السابق">⏮</button>'}<button data-act="aptoggle" class="big" aria-label="تشغيل أو إيقاف">${a.paused ? "▶" : "⏸"}</button>${radio ? "" : '<button data-act="apnext" aria-label="التالي">⏭</button><button data-act="apseek" data-d="15" aria-label="تقديم ١٥ ثانية">١٥⟳</button>'}</div>
    <div class="row apopts">${radio ? "" : `<select data-act="aprate" aria-label="سرعة الاستماع">${rates.map(r => `<option value="${r}" ${r === this.rate ? "selected" : ""}>السرعة ×${toAr(r)}</option>`).join("")}</select>`}
    <select data-act="apsleep" aria-label="مؤقت النوم"><option value="">${this.sleepAt ? "⏾ " + toAr(Math.max(1, Math.round((this.sleepAt - Date.now()) / 60e3))) + " دقيقة" : this.sleepEnd ? "⏾ نهاية المقطع" : "⏾ مؤقت النوم"}</option><option value="15">١٥ دقيقة</option><option value="30">٣٠ دقيقة</option><option value="60">ساعة</option><option value="end">نهاية المقطع</option><option value="0">إلغاء المؤقت</option></select>
    ${radio ? "" : '<button class="btn s" data-act="apmark">🔖 علامة توقف</button>'}${b && !it.rec ? `<a class="btn s" href="#/book/${it.bid}/${it.p}" data-act="apfullx">📖 افتح الصفحة</a>` : ""}<a class="btn s" href="#/audio/${it.bid}" data-act="apfullx">صفحة الكتاب المسموع</a></div>
    <h4>النص أثناء الاستماع <small class="mut">(اضغط جملة للانتقال إليها)</small></h4>${radio ? "" : '<input type="search" id="apfind" class="apfind" placeholder="ابحث في نص المقطع…" aria-label="بحث في النص المصاحب">'}<div id="aptext" class="aptext"></div>
    ${radio ? radioNextHtml(this.ch) : ""}`;
    this.paintText();
    const fi = $("#apfind"); if (fi) fi.oninput = () => { // البحث في النص المصاحب للصوت (ب12-25): تظليل المطابق والانتقال إلى أول موضع
      const w = norm(fi.value.trim()), box = $("#aptext"); if (!box) return; let first = null;
      box.querySelectorAll("[data-si]").forEach(el => { const hit = w.length > 1 && norm(el.textContent).includes(w); el.classList.toggle("hit", hit); if (hit && !first) first = el; });
      if (first) first.scrollIntoView({ block: "center", behavior: "smooth" }); };
  },
  openFull() { this.bar(); const f = $("#apfull"); f.hidden = false; document.body.classList.add("apfull-on"); this.paintFull(); },
  closeFull() { const f = $("#apfull"); if (f) f.hidden = true; document.body.classList.remove("apfull-on"); }
};

/* ---------- الراديو: قنوات متزامنة بالساعة (كل المستمعين يسمعون الموضع نفسه) ---------- */
const R_EPOCH = Date.UTC(2026, 0, 1);
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
async function radioChannels() {
  const L = await AUDIO.load(), ready = Object.entries(L).filter(([, x]) => AUDIO.ready(x) && !x.preview); // الراديو للكتب المعتمدة فقط، حتى للمشرف
  const pages = ids => { const q = []; ids.forEach(id => (L[id].ds || []).forEach((d, k) => { if (d > 0) q.push({ bid: id, p: k + 1, d, f: AUDIO.page(k + 1) }); })); return q; };
  const mk = (id, n, d, ids, mix) => { let items; if (mix) { const day = Math.floor((Date.now() - R_EPOCH) / 864e5), rnd = seeded(day * 7919 + 17), chunks = []; ids.forEach(bid => { const ps = pages([bid]); for (let i = 0; i < ps.length; i += 3) chunks.push(ps.slice(i, i + 3)); }); for (let i = chunks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[chunks[i], chunks[j]] = [chunks[j], chunks[i]]; } items = [].concat(...chunks); } else items = pages(ids);
    return { id, n, d, ids, mix: !!mix, items, T: items.reduce((s, x) => s + x.d, 0) }; };
  const all = ready.map(([id]) => id), byC = c => ready.filter(([id, x]) => (x.c || (B(id) || {}).col) === c).map(([id]) => id);
  const ch = [mk("mix", "مختارات المكتبة", "مقاطع متنوعة من كل الكتب المسموعة، تتجدد كل يوم", all, true), mk("dawah", "إذاعة الدعوة السلفية", "كتب مشايخ الدعوة السلفية كاملة متتابعة", byC("dawah")), mk("turath", "إذاعة التراث", "متون التراث وكتبه كاملة متتابعة", byC("turath"))];
  try { if (typeof Members !== "undefined" && Members.on()) { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_channels").maybeSingle(); ((data && data.value && data.value.list) || []).forEach(c => { const ids = (c.books || []).filter(id => L[id] && AUDIO.ready(L[id])); if (ids.length) ch.push(mk("c-" + c.id, c.n, c.d || "قناة من إعداد الإدارة", ids, !!c.mix)); }); } } catch (e) { }
  // البث المتواصل ٢٤ ساعة (ب12-33 … ب12-44): شبكة يومية متجددة بالساعات، ثلاثة أرباعها من مكتبة الدعوة وربعها من كتب المكتبة العامة
  // التي تختارها الإدارة (radio_auto.turath)، وكل ساعة لها موضوع، ويتقدم كل كتاب يومًا بعد يوم فلا يتكرر المسموع.
  try { const g = await radioGrid(L, ready); if (g) ch.unshift(g); } catch (e) { }
  // البرامج الإذاعية بمواعيد ثابتة (ب12-35 … ب12-38): البرنامج الجاري الآن قناة في المقدمة تبدأ من أول مواده عند موعده
  for (const pr of await radioPrograms()) { const live = progLive(pr); if (!live) continue; const ids = (pr.books || []).filter(id => L[id] && AUDIO.ready(L[id]) && !L[id].preview); if (!ids.length) continue;
    const c = mk("p-" + pr.id, "📡 " + pr.n, (pr.d || "برنامج إذاعي") + " • حتى " + live.end, ids, false); c.start = live.t0; c.prog = 1; ch.unshift(c); }
  return ch.filter(c => c.items.length);
}
const RTHEME = [[/أذكار|آداب|تزكية|رقائق/, "الأذكار والتزكية"], [/عقيد|توحيد|إيمان/, "العقيدة"], [/فقه|أصول/, "الفقه وأصوله"], [/سيرة|تاريخ|تراجم/, "السيرة والتراجم"], [/تفسير|قرآن/, "القرآن وعلومه"], [/حديث|سنة/, "الحديث"], [/فكر|منهج|دعوة|تربية|أسرة/, "الفكر والدعوة والتربية"]];
// موضوع كل ساعة بتوقيت القاهرة: الفجر والصباح أذكار وتزكية، ثم العقيدة، والفقه ظهرًا، والسيرة عصرًا، والقرآن والحديث مساءً، والفكر والتربية ليلًا
const RHOURS = [0, 0, 0, 0, 0, 0, 1, 1, 1, 4, 4, 2, 2, 2, 3, 3, 3, 5, 5, 6, 6, 1, 4, 0];
let RAUTO = null;
async function radioGrid(L, ready) {
  if (RAUTO === null) { try { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_auto").maybeSingle(); RAUTO = (data && data.value) || {}; } catch (e) { RAUTO = {}; } }
  const ok = ready.map(([id]) => id).filter(id => B(id)), dawah = ok.filter(id => (B(id).col || "dawah") === "dawah"), tur = ok.filter(id => (RAUTO.turath || []).includes(id));
  if (!dawah.length && !tur.length) return null;
  const cai = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" })), day = Math.floor((Date.UTC(cai.getFullYear(), cai.getMonth(), cai.getDate()) - R_EPOCH) / 864e5);
  const mid = Date.now() - ((cai.getHours() * 60 + cai.getMinutes()) * 60 + cai.getSeconds()) * 1000 - cai.getMilliseconds();
  const share = RAUTO.dawahShare != null ? +RAUTO.dawahShare : 0.75, rnd = seeded(day * 104729 + 7), items = [], grid = [];
  const tname = id => (T(B(id).topicId).name || "");
  for (let h = 0; h < 24; h++) {
    const th = RTHEME[RHOURS[h]], useT = tur.length && (rnd() > share || !dawah.length), pool = useT ? tur : dawah;
    const fit = pool.filter(id => th[0].test(tname(id))), cand = fit.length ? fit : pool, bid = cand[Math.floor(rnd() * cand.length)];
    const ds = (L[bid].ds || []).map((d, k) => ({ bid, p: k + 1, d, f: AUDIO.page(k + 1) })).filter(x => x.d > 0); if (!ds.length) continue;
    const tot = ds.reduce((a, x) => a + x.d, 0); let off = (day * 3600 + h * 600) % Math.max(1, tot), i = 0; // يتقدم الكتاب كل يوم ساعة
    while (off > ds[i].d) { off -= ds[i].d; i = (i + 1) % ds.length; }
    let acc = 0; const blk = []; while (acc < 3600 && blk.length < ds.length) { const x = ds[i]; blk.push(x); acc += x.d; i = (i + 1) % ds.length; }
    const scale = 3600 / acc; blk.forEach(x => items.push(Object.assign({}, x, { d: x.d, hour: h }))); // الساعة الأخيرة قد تزيد قليلًا فتتداخل
    grid.push({ h, theme: th[1], bid, col: useT ? "turath" : "dawah" });
  }
  window.__rgrid = grid;
  return { id: "24h", n: "📻 البث المتواصل", d: "برامج على مدار الساعة تتجدد يوميًا، أغلبها من كتب مكتبة الدعوة السلفية", ids: [...new Set(items.map(x => x.bid))], items, T: items.reduce((a, x) => a + x.d, 0), start: mid };
}
function radioGridHtml() {
  const g = window.__rgrid; if (!g || !g.length) return "";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" })).getHours();
  return `<details class="card rsched"><summary><b>🕘 شبكة البث المتواصل اليوم</b> <small class="mut">بتوقيت القاهرة</small></summary>${g.map(x => { const b = B(x.bid); return `<div class="rprog${x.h === now ? " live" : ""}"><b>${String(x.h).padStart(2, "0")}:٠٠</b> <span>${esc(x.theme)}: ${esc(b ? b.setTitle || b.title : x.bid)}</span> <span class="mut">${x.col === "dawah" ? "مكتبة الدعوة" : "المكتبة العامة"}</span>${x.h === now ? ' <em class="tag on">الآن</em>' : ""}</div>`; }).join("")}</details>`;
}
let RPROG = null;
async function radioPrograms() {
  if (RPROG) return RPROG;
  try { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_programs").maybeSingle(); RPROG = (data && data.value && data.value.list) || []; } catch (e) { RPROG = []; }
  setTimeout(() => RPROG = null, 300e3); return RPROG;
}
// هل البرنامج على الهواء الآن؟ (بتوقيت مصر: المواعيد تُكتب بتوقيت القاهرة)
function progLive(pr, at) {
  const now = at || new Date(), cai = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" })), day = cai.getDay();
  if (pr.days && pr.days.length && !pr.days.includes(day)) return null;
  const [h, m] = String(pr.at || "00:00").split(":").map(Number), st = new Date(cai); st.setHours(h, m || 0, 0, 0);
  const dur = (+pr.dur || 60) * 60e3, diff = cai - st; if (diff < 0 || diff >= dur) return null;
  const end = new Date(st.getTime() + dur); return { t0: now.getTime() - diff, end: String(end.getHours()).padStart(2, "0") + ":" + String(end.getMinutes()).padStart(2, "0") };
}
const RDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
async function radioScheduleHtml() {
  const ps = await radioPrograms(); if (!ps.length) return "";
  const day = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" })).getDay();
  const today = ps.filter(p => !p.days || !p.days.length || p.days.includes(day)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return `<div class="card rsched"><h3>📅 جدول البرامج اليوم (${RDAYS[day]}) <small class="mut">بتوقيت القاهرة</small></h3>${today.map(p => `<div class="rprog${progLive(p) ? " live" : ""}"><b>${esc(p.at)}</b> <span>${esc(p.n)}</span> <span class="mut">${toAr(+p.dur || 60)} دقيقة${p.d ? " • " + esc(p.d) : ""}</span>${progLive(p) ? ' <em class="tag on">على الهواء</em>' : ""}</div>`).join("") || '<p class="mut">لا برامج اليوم.</p>'}</div>`;
}
function radioPos(ch) {
  const start = ch.start || (ch.mix ? R_EPOCH + Math.floor((Date.now() - R_EPOCH) / 864e5) * 864e5 : R_EPOCH);
  let pos = ((Date.now() - start) / 1000) % (ch.T || 1), i = 0;
  while (i < ch.items.length && pos >= ch.items[i].d) { pos -= ch.items[i].d; i++; }
  return { i: Math.min(i, ch.items.length - 1), off: Math.max(0, pos) };
}
function radioNextHtml(ch) {
  const { i, off } = radioPos(ch); let t = Date.now() + (ch.items[i].d - off) * 1000; const out = [];
  let lastB = ch.items[i].bid, lastT = Date.now();
  for (let k = i + 1; k < ch.items.length + i && out.length < 6; k++) { const it = ch.items[k % ch.items.length]; if (it.bid !== lastB || t - lastT >= 600e3) { lastB = it.bid; lastT = t; const b = B(it.bid); out.push(`<li><b>${new Date(t).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}</b> ${esc(b ? b.setTitle || b.title : it.bid)} <span class="mut">${esc((b && PL(b, it.p - 1)) || "ص " + toAr(it.p))}</span></li>`); } t += it.d * 1000; }
  return out.length ? `<h4>التالي في ${esc(ch.n)}</h4><ul class="rnext">${out.join("")}</ul>` : "";
}

/* ---------- صفحة «صوتيات المكتبة» ---------- */
const AUDIO_SOON = `<div class="card soon"><h3>يجري تجهيز الكتب المسموعة</h3><p>تُحوَّل كتب مكتبة الدعوة إلى صوت يوميًا، وتظهر هنا وفي الراديو تباعًا.</p><p class="mut">وإلى ذلك الحين تستطيع الاستماع إلى أي كتاب بصوت جهازك: افتح الكتاب ثم «أدوات القراءة ← القراءة الصوتية».</p><a class="btn" href="#/library?c=dawah">تصفح كتب الدعوة</a></div>`;
const audioCard = (id, x) => { const b = B(id), a = b ? A(b.authorId) : { name: "" }, ready = AUDIO.ready(x) || (x.rd && x.rd.length), pct = x.of ? Math.round(100 * x.n / x.of) : 0;
  return `<a class="acard2" href="#/audio/${id}"><span class="acov" style="${avHue(id)}"><i>🎧</i><em>${esc((b ? b.setTitle || b.title : x.t || id).split(/\s+/).slice(0, 3).join(" "))}</em></span><b>${esc(b ? b.setTitle || b.title : x.t || id)}</b><small>${esc(a.name)}</small>${x.preview ? '<small class="warn">معاينة للإدارة — غير منشور</small>' : ""}<small class="mut">${ready ? "⏱ " + fmtDur(x.d) : "قيد التجهيز"}${x.rec ? " • 🎙 تسجيل" : x.vn ? " • 🔊 " + esc(x.vn) : ""}</small>${x.of && x.n < x.of ? `<i class="prog" style="--w:${pct}%"></i>` : ""}</a>`; };
async function vAudio(q, bid) {
  if (bid) return q.rev && Cloud.staff() ? vAudioRev(bid, q) : vAudioBook(bid);
  if (q.k === "admin") return vAudioAdmin();
  view(`<div class="cmhero aud"><div><h2>صوتيات المكتبة</h2><p>كتب المكتبة مسموعة: استمع في الطريق والبيت، ولو أغلقت الشاشة، مع النص متزامنًا، وعلامات التوقف، وقائمة تشغيل لأكثر من كتاب.</p></div><div class="row"><a class="btn p" href="#/radio">📻 راديو المكتبة</a>${Cloud.staff() ? '<a class="btn" href="#/audio?k=admin">إدارة الصوتيات</a>' : ""}</div></div><div id="audbox"><p class="mut">جارٍ التحميل…</p></div>`);
  const L = await AUDIO.load(), ids = Object.keys(L).filter(id => B(id)), last = ls.get("ap_last", null), marks = AMarks.all();
  const ready = ids.filter(id => AUDIO.ready(L[id]) || (L[id].rd && L[id].rd.length)), prep = ids.filter(id => !ready.includes(id) || (L[id].of && L[id].n < L[id].of));
  const f = q.c || "", show = ready.filter(id => !f || (f === "rec" ? L[id].rec : (L[id].c || B(id).col) === f));
  const box = $("#audbox"); if (!box) return;
  if (!ready.length && !Cloud.staff()) { box.innerHTML = AUDIO_SOON; return; }
  box.innerHTML = `${last && B(last.bid) && L[last.bid] ? `<div class="card aresume"><div><b>أكمل الاستماع</b><span>${esc(B(last.bid).setTitle || B(last.bid).title)} • ${esc(PL(B(last.bid), last.p - 1) || "صفحة " + toAr(last.p))}</span></div><button class="btn p" data-act="applay" data-id="${last.bid}" data-p="${last.p}" data-t="${last.t}">▶ أكمل</button></div>` : ""}
  ${AP.lineup.length ? `<h3>قائمة التشغيل <small class="mut">(تُسمع متتابعة)</small></h3><div class="lineup">${AP.lineup.map((id, k) => B(id) ? `<span class="chip">${esc(B(id).setTitle || B(id).title)} <button class="lnk" data-act="aplineupx" data-k="${k}" aria-label="إزالة">✕</button></span>` : "").join("")}<button class="btn s p" data-act="aplineupplay">▶ شغّل القائمة</button></div>` : ""}
  <div class="tabs" role="tablist">${[["", "الكل"], ["dawah", "كتب الدعوة"], ["turath", "المكتبة العامة"], ["rec", "تسجيلات"]].map(([v, l]) => `<a role="tab" aria-selected="${f === v}" href="#/audio${v ? "?c=" + v : ""}">${l}</a>`).join("")}</div>
  <div class="agrid">${show.map(id => audioCard(id, L[id])).join("") || '<p class="mut">لا توجد كتب مسموعة في هذا القسم بعد.</p>'}</div>
  ${marks.length ? `<h3>علامات التوقف</h3>${marks.slice(0, 12).map((m, i) => B(m.bid) ? `<div class="amark"><button class="lnk" data-act="applay" data-id="${m.bid}" data-p="${m.p}" data-t="${m.t}">🔖 ${esc(B(m.bid).setTitle || B(m.bid).title)} — ${esc(PL(B(m.bid), m.p - 1) || "صفحة " + toAr(m.p))} • ${fmtT(m.t)}</button>${m.note ? `<span class="mut">${esc(m.note)}</span>` : ""}<button class="lnk" data-act="apmarkx" data-i="${i}" aria-label="حذف">✕</button></div>` : "").join("")}` : ""}
  ${prep.length ? `<h3>قيد التجهيز</h3><div class="agrid sm">${prep.map(id => audioCard(id, L[id])).join("")}</div>` : ""}
  <div class="note"><b>استمع إلى أي كتاب الآن بصوت جهازك:</b> افتح الكتاب ثم «أدوات القراءة ← القراءة الصوتية»، أو اضغط «🔊 استمع» في صفحة أي كتاب مسموع قيد التجهيز. والكتب المسموعة بالأصوات العصبية تُضاف تباعًا.</div>`;
}
async function vAudioBook(bid) {
  const b = B(bid); if (!b) return view('<p class="note">الكتاب غير موجود.</p>');
  view('<p class="mut">جارٍ التحميل…</p>');
  const L = await AUDIO.load(), x = L[bid] || { n: 0, ds: [], of: b.n || 0 }, a = A(b.authorId), ready = AUDIO.ready(x);
  let toc = []; try { const bb = await loadBook(bid); toc = (bb.toc || []).filter(t => t.l !== 2).slice(0, 80); } catch (e) { }
  const inLine = AP.lineup.includes(bid), marks = AMarks.of(bid);
  view(`<p><a href="#/audio">← صوتيات المكتبة</a></p>${x.preview ? `<div class="note"><b>معاينة للإدارة — غير منشور.</b> لا يظهر للأعضاء ولا يدخل الراديو حتى يُعتمد. <a class="btn s p" href="#/audio/${bid}?rev=1">🎧 استمع وراجع قبل الاعتماد</a></div>` : ""}<div class="abook"><span class="acov big" style="${avHue(bid)}"><i>🎧</i><em>${esc((b.setTitle || b.title).split(/\s+/).slice(0, 4).join(" "))}</em></span>
  <div><h2>${esc(b.setTitle || b.title)}</h2><p><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}</a></p>
  <p class="mut">${ready ? `⏱ ${fmtDur(x.d)} • ${toAr(x.n)} مقطعًا${x.of && x.n < x.of ? ` من ${toAr(x.of)} (يُستكمل تباعًا)` : ""}${x.vn ? " • بصوت " + esc(x.vn) + " (صوت آلي)" : ""}` : "صوتيات هذا الكتاب قيد التجهيز."}</p>
  <div class="row">${ready ? `<button class="btn p" data-act="applay" data-id="${bid}" data-p="1">▶ استمع من البداية</button><button class="btn" data-act="aplineup" data-id="${bid}">${inLine ? "✓ في قائمة التشغيل" : "+ إلى قائمة التشغيل"}</button>` : ""}<a class="btn" href="#/book/${bid}/1?tts=1">🔊 استمع بصوت جهازك</a><a class="btn" href="#/book/${bid}/1">📖 اقرأ الكتاب</a></div></div></div>
  ${x.rd && x.rd.length ? `<h3>التسجيلات</h3>${x.rd.map((r, k) => `<button class="arow" data-act="aprec" data-id="${bid}" data-k="${k}">🎙 ${esc(r[2] || "تسجيل " + toAr(k + 1))} <span class="mut">${fmtDur(r[1])}</span></button>`).join("")}` : ""}
  ${marks.length ? `<h3>علاماتك في هذا الكتاب</h3>${marks.map(m => `<div class="amark"><button class="lnk" data-act="applay" data-id="${bid}" data-p="${m.p}" data-t="${m.t}">🔖 ${esc(PL(b, m.p - 1) || "صفحة " + toAr(m.p))} • ${fmtT(m.t)}</button>${m.note ? `<span class="mut">${esc(m.note)}</span>` : ""}<button class="lnk" data-act="apmarkx" data-i="${m.i}">✕</button></div>`).join("")}` : ""}
  ${ready && toc.length ? `<h3>الأبواب</h3><div class="atoc">${toc.map(t => { const d = (x.ds || [])[t.p - 1]; return `<button class="arow" data-act="applay" data-id="${bid}" data-p="${t.p}"${d ? "" : " disabled"}>▶ ${esc(t.t)} <span class="mut">${esc(PL(b, t.p - 1) || "ص " + toAr(t.p))}</span></button>`; }).join("")}</div>` : ""}
  ${ready ? `<details><summary>كل المقاطع (${toAr(x.n)})</summary><div class="atoc">${(x.ds || []).map((d, k) => d ? `<button class="arow" data-act="applay" data-id="${bid}" data-p="${k + 1}">▶ ${esc(PL(b, k) || "صفحة " + toAr(k + 1))} <span class="mut">${fmtT(d)}</span></button>` : "").join("")}</div></details>` : ""}`);
}

/* ---------- صفحة «راديو المكتبة» ---------- */
async function vRadio(q, cid) {
  view(`<div class="radio"><div class="rdhead"><h2>📻 راديو المكتبة</h2><p>بث متواصل من كتب المكتبة المسموعة، يسمعه كل المستمعين في اللحظة نفسها كالإذاعة. يعمل في خلفية جهازك ولو أغلقت الشاشة.</p></div><div id="rdbox"><p class="mut">جارٍ ضبط الموجات…</p></div></div>`);
  const ch = await radioChannels(), box = $("#rdbox"); if (!box) return;
  const sched = await radioScheduleHtml() + radioGridHtml();
  if (!ch.length) { box.innerHTML = AUDIO_SOON + sched; return; }
  const sel = ch.find(c => c.id === (cid || q.c)) || ch[0], live = AP.mode === "radio" && AP.ch && AP.ch.id === sel.id;
  const { i } = radioPos(sel), now = sel.items[i], nb = B(now.bid);
  box.innerHTML = `<div class="chips rch">${ch.map(c => `<a class="chip${c.id === sel.id ? " x" : ""}" href="#/radio/${c.id}">${esc(c.n)}</a>`).join("")}</div>
  <div class="rdial${live && !AP.audio().paused ? " on" : ""}"><div class="rfreq">${esc(sel.n)}</div><p class="mut">${esc(sel.d)}</p>
  <div class="rnow"><span class="live">● الآن</span> <b>${esc(nb ? nb.setTitle || nb.title : now.bid)}</b> <span class="mut">${esc(nb ? A(nb.authorId).name : "")} • ${esc((nb && PL(nb, now.p - 1)) || "صفحة " + toAr(now.p))}</span></div>
  <i class="eq"><b></b><b></b><b></b><b></b><b></b><b></b><b></b></i>
  <button class="btn p big" data-act="rdplay" data-c="${sel.id}">${live && !AP.audio().paused ? "⏸ إيقاف" : "▶ استمع الآن"}</button>
  <p class="mut">مدة دورة القناة ${fmtDur(sel.T)} • ${toAr(sel.ids.length)} ${sel.ids.length > 2 && sel.ids.length < 11 ? "كتب" : "كتاب"}</p></div>
  ${radioNextHtml(sel)}
  ${sched}
  <p class="mut">تريد كتابًا من أوله بالترتيب الذي تختاره؟ <a href="#/audio">صوتيات المكتبة</a>.</p>`;
  window.__rch = ch;
}


/* ---------- مراجعة السماع قبل الاعتماد (للمشرفين) ----------
   حالة كل مقطع تُحفظ في الجهاز أولًا (arev_<المعرف>)، ثم في data/audio/_review.json بزر «حفظ المراجعة» ليراها المشرفون.
   h: {الصفحة: بصمة نصها وقت السماع} — إن أعيد تسجيل الصفحة تغيّرت بصمتها فتحتاج سماعًا جديدًا؛ nt: {الصفحة: ملاحظة}. */
const ARev = {
  remote: null,
  async loadRemote(force) {
    if (this.remote && !force) return this.remote;
    let j = null; try { const r = await fetch(RAW("data/audio/_review.json") + "?t=" + Date.now()); if (r.ok) j = await r.json(); } catch (e) { }
    return (this.remote = j || {});
  },
  get(bid) { const l = ls.get("arev_" + bid, null), r = (this.remote || {})[bid]; if (l && (!r || (l.at || 0) >= (r.at || 0))) return l; return r ? JSON.parse(JSON.stringify(r)) : { h: {}, nt: {} }; },
  put(bid, o) { o.h = o.h || {}; o.nt = o.nt || {}; o.at = Date.now(); ls.set("arev_" + bid, o); },
  pages: x => (x.ds || []).map((d, k) => d > 0 ? k + 1 : 0).filter(Boolean),
  st(r, man, p) {
    if (r.nt && r.nt[p]) return "note";
    const h = r.h && r.h[p]; if (!h) return "";
    const cur = man && man.pages && man.pages[String(p)] && man.pages[String(p)].h;
    return cur && h !== 1 && h !== cur ? "chg" : "ok";
  },
  stat(bid, x, man) { const r = this.get(bid), ps = this.pages(x || {}); return { N: ps.length, heard: ps.filter(p => this.st(r, man, p) === "ok" || (r.nt && r.nt[p] && r.h && r.h[p])).length, notes: Object.keys(r.nt || {}).filter(p => r.nt[p]).length, by: r.by || "" }; },
  async hashOf(bid, p) { const m = await AUDIO.manifest(bid); return (m && m.pages && m.pages[String(p)] && m.pages[String(p)].h) || 1; },
  async onEnd(it) {
    if (!it || it.rec || typeof Cloud === "undefined" || !Cloud.staff()) return;
    const r = this.get(it.bid); r.h = r.h || {}; r.h[it.p] = await this.hashOf(it.bid, it.p); this.put(it.bid, r); this.paint(it.bid);
  },
  async mark(bid, p) {
    const r = this.get(bid), cur = this.st(r, (window.__arev || {}).man, p);
    if (cur === "ok") delete r.h[p]; else { r.h = r.h || {}; r.h[p] = await this.hashOf(bid, p); if (r.nt) delete r.nt[p]; }
    this.put(bid, r); this.paint(bid);
  },
  note(bid, p) {
    const r = this.get(bid), t = prompt("ملاحظة على هذا المقطع (خطأ نطق أو تشكيل أو كلمة ناقصة…)، واتركها فارغة لإزالتها:", (r.nt || {})[p] || "");
    if (t === null) return; r.nt = r.nt || {}; if (t.trim()) r.nt[p] = t.trim().slice(0, 300); else delete r.nt[p];
    this.put(bid, r); this.paint(bid);
  },
  async save(bid) {
    if (!GH.on) throw new Error("فعّل الإدارة المباشرة (سجّل الدخول بحساب المدير) لحفظ المراجعة.");
    const r = this.get(bid); r.by = (Auth.user && Auth.user.name) || r.by || ""; this.put(bid, r);
    await GH.editJSON("data/audio/_review.json", o => { o = o || {}; o[bid] = { h: r.h, nt: r.nt, by: r.by, at: r.at }; return o; }, "مراجعة سماع: " + ((B(bid) || {}).title || bid), true);
    (this.remote = this.remote || {})[bid] = JSON.parse(JSON.stringify(r));
  },
  async redo(bid) {
    const r = this.get(bid), ps = Object.keys(r.nt || {}).filter(p => r.nt[p]).map(Number).sort((a, b) => a - b), x = (AUDIO.list || {})[bid] || {};
    if (!ps.length) return toast("لا ملاحظات لإعادة تسجيلها");
    if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا.");
    if (!confirm(`إعادة تسجيل ${toAr(ps.length)} صفحة: ${ps.map(toAr).join("، ")}.\nصحّح نص هذه الصفحات أو تشكيلها أولًا من «📖»، وإلا أعيد تسجيلها بالخطأ نفسه. متابعة؟`)) return;
    await GH.editJSON("data/audio/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(i => i.id !== bid || i.rec); o.items.push({ id: bid, voice: x.v || "ar-SA-HamedNeural", pages: ps }); return o; }, "صوتيات: إعادة تسجيل صفحات من «" + ((B(bid) || {}).title || bid) + "»");
    await this.save(bid).catch(() => { });
    toast("أضيفت الصفحات إلى طابور التحويل؛ تُسجَّل عند تشغيل التحويل الصوتي، ثم تظهر هنا «أعيد تسجيلها» لتسمعها من جديد");
  },
  row(c, p) {
    const r = this.get(c.bid), s = this.st(r, c.man, p), d = (c.x.ds || [])[p - 1], ic = { ok: "✅", note: "⚠️", chg: "🔄", "": "○" }[s];
    return `<div class="bk" data-rp="${p}" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center${s === "note" ? ";border-color:#d8433b" : ""}"><span title="${{ ok: "سُمع وسليم", note: "عليه ملاحظة", chg: "أعيد تسجيله — يحتاج سماعًا", "": "لم يُسمع" }[s]}">${ic}</span>
    <button class="lnk" data-act="applay" data-id="${c.bid}" data-p="${p}" style="flex:1;text-align:start">▶ ${esc(PL(c.b, p - 1) || "صفحة " + toAr(p))} <span class="mut">${fmtT(d)}</span></button>
    <button class="btn s" data-act="aprvok" data-id="${c.bid}" data-p="${p}" aria-label="سليم">${s === "ok" ? "↺" : "✓ سليم"}</button><button class="btn s" data-act="aprvnote" data-id="${c.bid}" data-p="${p}">✎ ملاحظة</button><a class="btn s" href="#/book/${c.bid}/${p}" title="افتح الصفحة لتصحيح النص أو التشكيل">📖</a>
    ${s === "note" ? `<div class="warn" style="flex-basis:100%">${esc(r.nt[p])}</div>` : s === "chg" ? '<div class="mut" style="flex-basis:100%">أعيد تسجيل هذه الصفحة بعد سماعها؛ استمع إليها من جديد.</div>' : ""}</div>`;
  },
  paint(bid) {
    const c = window.__arev, box = $("#arev"); if (!c || !box || (bid && bid !== c.bid)) return;
    const st = this.stat(c.bid, c.x, c.man), r = this.get(c.bid), ps = this.pages(c.x), chg = ps.filter(p => this.st(r, c.man, p) === "chg").length;
    const show = ps.filter(p => { const s = this.st(r, c.man, p); return c.f === "todo" ? s !== "ok" : c.f === "note" ? s === "note" : true; });
    const pct = st.N ? Math.round(100 * st.heard / st.N) : 0;
    $("#arevst").innerHTML = `<b>${toAr(st.heard)} من ${toAr(st.N)} مقطعًا سُمع (${toAr(pct)}٪)</b>${st.notes ? ` • <span class="warn">${toAr(st.notes)} ملاحظة</span>` : ""}${chg ? ` • ${toAr(chg)} أعيد تسجيلها` : ""}<i class="prog" style="--w:${pct}%;display:block;margin-top:6px"></i>`;
    $("#arevtabs").innerHTML = [["", "الكل"], ["todo", "لم يُسمع"], ["note", "الملاحظات"]].map(([v, l]) => `<a role="tab" href="#/audio/${c.bid}?rev=1${v ? "&f=" + v : ""}" aria-selected="${(c.f || "") === v}">${l}</a>`).join("");
    const rb = $("#arevredo"); if (rb) { rb.hidden = !st.notes; rb.textContent = "↻ إعادة تسجيل صفحات الملاحظات (" + toAr(st.notes) + ")"; }
    box.innerHTML = show.map(p => this.row(c, p)).join("") || '<p class="mut">لا مقاطع هنا.</p>';
  }
};
async function vAudioRev(bid, q) {
  const b = B(bid); if (!b) return view('<p class="note">الكتاب غير موجود.</p>');
  view('<p class="mut">جارٍ التحميل…</p>');
  const L = await AUDIO.load(true); await ARev.loadRemote(true); const x = L[bid];
  if (!x || !AUDIO.ready(x)) return view(`<p><a href="#/audio?k=admin">← إدارة الصوتيات</a></p><p class="note">لا مقاطع مسموعة لهذا الكتاب بعد.</p>`);
  const man = await AUDIO.manifest(bid);
  window.__arev = { bid, b, x, man, f: q.f || "" };
  view(`<p><a href="#/audio?k=admin">← إدارة الصوتيات</a></p>
  <h2>مراجعة السماع: ${esc(b.setTitle || b.title)}</h2>
  <p class="mut">${esc(A(b.authorId).name)} • بصوت ${esc(x.vn || x.v || "")} • ⏱ ${fmtDur(x.d)} • ${x.ok ? '<em class="tag">منشور للأعضاء</em>' : '<em class="tag">غير منشور</em>'}</p>
  <div class="note">استمع إلى المقاطع بالترتيب؛ يُعلَّم المقطع «✅ سُمع» تلقائيًا إذا سمعته إلى آخره، أو اضغط «✓ سليم». عند أي خطأ في النطق أو التشكيل اضغط «✎ ملاحظة»، ثم صحّح نص الصفحة من «📖»، ثم «إعادة تسجيل صفحات الملاحظات». يمكنك رفع السرعة من المشغّل لتسريع المراجعة. لا يظهر الكتاب للأعضاء ولا يدخل الراديو إلا بعد اعتماده.</div>
  <div class="card"><div id="arevst"></div>
  <div class="row" style="margin-top:10px"><button class="btn p" data-act="aprvplay">▶ استمع من أول مقطع لم يُسمع</button><button class="btn" data-act="aprvsave" data-id="${bid}">💾 حفظ المراجعة</button><button class="btn" id="arevredo" data-act="aprvredo" data-id="${bid}" hidden></button><button class="btn${x.ok ? "" : " p"}" data-act="apok" data-id="${bid}" data-on="${x.ok ? 0 : 1}">${x.ok ? "إلغاء النشر" : "✔ اعتماد ونشر للأعضاء والراديو"}</button></div></div>
  <div class="tabs" role="tablist" id="arevtabs"></div><div id="arev"></div>`);
  ARev.paint();
}

/* ---------- إدارة الصوتيات (للمشرفين) ---------- */
async function vAudioAdmin() {
  if (!Cloud.staff() && !GH.on) return view('<p class="note">للمشرفين.</p>');
  view('<h2>إدارة الصوتيات والراديو</h2><div id="aadm" class="mut">جارٍ التحميل…</div>');
  const L = await AUDIO.load(true); await ARev.loadRemote(true); let Q = { items: [] }; try { const r = await fetch(RAW("data/audio/_queue.json") + "?t=" + Date.now()); if (r.ok) Q = await r.json(); } catch (e) { }
  let RC = { list: [] }; try { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_channels").maybeSingle(); if (data && data.value) RC = data.value; } catch (e) { }
  const books = lib.books.filter(b => kindOf(b) === "book" && !b.demo).sort((x, y) => (x.col === y.col ? 0 : x.col === "dawah" ? -1 : 1) || (x.n || 0) - (y.n || 0));
  const opt = books.map(b => `<option value="${b.id}">${esc(b.setTitle || b.title)}${b.n ? " (" + toAr(b.n) + " ص)" : ""}${L[b.id] ? " ✓" : ""}</option>`).join("");
  let VV = { gemini: [], edge: [] }; try { const r = await fetch(RAW("data/audio/_voices.json") + "?t=" + Math.floor(Date.now() / 600e3)); if (r.ok) VV = await r.json(); } catch (e) { }
  let AS = {}; try { const r = await fetch(RAW("data/audio/_settings.json") + "?t=" + Date.now()); if (r.ok) AS = await r.json(); } catch (e) { }
  let LEX = []; try { const r = await fetch(RAW("data/audio/_lexicon.json") + "?t=" + Date.now()); if (r.ok) LEX = (await r.json()).words || []; } catch (e) { }
  const defV = AS.voice || "gemini:Charon";
  const vOpts = sel => `<optgroup label="أصوات Gemini الأحدث (طبيعية)">${VV.gemini.map(([n, d]) => `<option value="gemini:${n}"${sel === "gemini:" + n ? " selected" : ""}>${n} — ${esc(d)}</option>`).join("")}</optgroup><optgroup label="أصوات Microsoft (مجانية دائمًا)">${VV.edge.map(([n, d]) => `<option value="${n}"${sel === n ? " selected" : ""}>${esc(d)}</option>`).join("")}</optgroup>`;
  const voices = VV.gemini.map(v => ["gemini:" + v[0], v[0] + " — " + v[1]]).concat(VV.edge.map(v => [v[0], v[1]]));
  $("#aadm").className = ""; $("#aadm").innerHTML = `<div class="card"><h3>الصوت الافتراضي للتحويل التلقائي</h3><p class="mut">يُسجَّل به كل كتاب جديد يدخل التحويل التلقائي، والكتاب الذي بدأ بصوت يكمل به. استمع إلى العينة قبل الاختيار. إذا نفدت حصة مفاتيح Gemini في يوم أكمل التحويل بصوت «حامد» المجاني.</p>
  <form data-form="audset" class="row"><select name="v" id="audd">${vOpts(defV)}</select><button type="button" class="btn s" data-act="vsample" data-for="audd">▶ عينة</button><button class="btn p">حفظ</button> <span id="audss" class="mut"></span></form></div>
  <div class="card"><h3>تحويل كتاب إلى صوت (مجانًا)</h3><p class="note">▶ التحويل إلى صوت يعمل تلقائيًا مرتين يوميًا: كتب مكتبة الدعوة أولًا (الأقصر فالأطول)، ثم كتب المكتبة العامة المختارة للبث، بالنص المشكول المدقق متى توفر، وتُعاد الصفحة إذا تغيّر نصها أو تشكيلها. الطلبات هنا تُقدَّم على التلقائي.</p><p class="mut">يُحوَّل الكتاب صفحةً صفحة بأصوات عصبية عربية، وتُحفظ الملفات في إصدارات المستودع على GitHub دون تكلفة، ويظهر الكتاب في «صوتيات المكتبة» و«الراديو» تباعًا. الصفحات التي يتغير نصها بعد التدقيق يُعاد تسجيلها تلقائيًا كل ليلة.</p>
  <form data-form="audq"><label>الكتاب</label><select name="b" required>${opt}</select><label>الصوت</label><div class="row"><select name="v" id="audv">${vOpts(defV)}</select><button type="button" class="btn s" data-act="vsample" data-for="audv">▶ عينة</button></div><label class="chk"><input type="checkbox" name="fz" value="1"> إعادة تسجيل الكتاب كاملًا بهذا الصوت (إن كان مسجلًا من قبل)</label><label>السرعة</label><select name="r"><option value="-10%">أبطأ قليلًا</option><option value="-5%" selected>معتدلة</option><option value="+0%">عادية</option><option value="+10%">أسرع</option></select><button class="btn p" style="margin-top:8px">أضف إلى طابور التحويل</button> <span id="audqs" class="mut"></span></form></div>
  <div class="card"><h3>تحسين جودة القراءة الصوتية</h3><ol class="mut"><li><b>النص المشكول المدقق أولًا:</b> يقرأ التحويل نص «التشكيل» متى طابق الصفحة؛ فاطلب تشكيل الكتاب من «الإدارة ← التشكيل» قبل تسجيله، أو أعد تسجيله بعده.</li><li><b>صحّح نص الصفحة</b> من القارئ («تعديل النص») ثم أعد تسجيل صفحاتها من «استمع وراجع» (تُعاد الصفحة التي تغيّر نصها آليًا).</li><li><b>قاموس النطق</b> أدناه: لكل كلمة يخطئ الصوت في نطقها اكتب صورتها المشكولة أو المنطوقة (مثل: «ابن تيمية = ابنُ تَيْمِيَّة»، «ت = توفي»، «ه = هجرية»). يطبَّق على كل التسجيلات القادمة.</li><li><b>الصوت والسرعة:</b> أصوات Gemini أوضح في الفصحى من أصوات Microsoft، والسرعة «معتدلة» أنسب للكتب العلمية. جرّب العينة قبل الاختيار.</li><li><b>الحذف وإعادة التسجيل</b> من قائمة الكتب المسموعة: «♻ حذف وإعادة التسجيل» لكتاب سُجّل قبل تصحيح نصه أو تشكيله، و«🗑 حذف» لإزالته واستبعاده من التحويل التلقائي.</li></ol>
  <form data-form="aulex"><label>قاموس النطق (سطر لكل كلمة: الكلمة = النطق)</label><textarea name="lex" rows="6" dir="rtl" placeholder="ابن تيمية = ابنُ تَيْمِيَّة">${esc(LEX.map(([w, r]) => w + " = " + r).join("\n"))}</textarea><button class="btn p">حفظ القاموس</button> <span id="aulexs" class="mut"></span></form></div>
  <div class="card"><h3>ما لا يُقرأ صوتيًا</h3><p class="mut">يتخطى التحويل آليًا: صفحة العنوان، وبيانات الطبعة والنشر والحقوق والإيداع والتواصل، والفهارس وثبت المراجع، والحواشي؛ ويحذف من النص أرقام الحواشي والتعداد والإحالات (ص، ج، رقم الحديث، مواضع الآيات) والزخارف والعلامات. وإن بقي في كتاب ما لا يُقرأ فحدّده هنا، فتصير صفحاته صامتة في الإعادة القادمة.</p>
  <form data-form="auomit"><label>الكتاب</label><select name="b" required>${opt}</select><div class="row"><div><label>تخطَّ أول (صفحات)</label><input name="fr" type="number" min="0" value="0"></div><div><label>تخطَّ آخر (صفحات)</label><input name="bk" type="number" min="0" value="0"></div><div><label>صفحات أخرى (مثل: 9، 14)</label><input name="pg" dir="ltr"></div></div><button class="btn p">حفظ</button> <span id="auoms" class="mut"></span></form>
  ${Object.entries(AS.omit || {}).map(([id, o]) => `<div class="bk"><b>${esc((B(id) || {}).title || id)}</b><span>${o.front ? "أول " + toAr(o.front) + " " : ""}${o.back ? "آخر " + toAr(o.back) + " " : ""}${(o.pages || []).length ? "صفحات: " + (o.pages || []).map(toAr).join("، ") : ""}</span></div>`).join("")}</div>
  <div class="card"><h3>رفع تسجيل صوتي بشري</h3><p class="mut">درس أو قراءة مسجلة لكتاب (mp3 أو m4a، حتى ٥٠ ميجابايت للملف). يُنقل إلى إصدارات المستودع ويظهر في صفحة الكتاب المسموع.</p>
  <form data-form="audrec"><label>الكتاب</label><select name="b" required>${opt}</select><label>عنوان التسجيل</label><input name="t" maxlength="120" placeholder="مثال: شرح الباب الأول" required><label>يبدأ من صفحة</label><input name="p" type="number" min="1" value="1"><label>الملف</label><input name="f" type="file" accept="audio/*" required><button class="btn p" style="margin-top:8px">رفع التسجيل</button> <span id="audrs" class="mut"></span></form></div>
  <div class="card"><h3>طابور التحويل</h3>${(Q.items || []).length ? `<ol>${Q.items.map(it => `<li>${esc((B(it.id) || {}).title || it.id)} ${it.rec ? "— 🎙 " + esc(it.rec.t || "") : "— " + esc(it.voice || "")}${it.err ? ` <span class="warn">(تعثّر ${toAr(it.err)})</span>` : ""}</li>`).join("")}</ol>` : '<p class="mut">الطابور فارغ.</p>'}
  <h4>الكتب المسموعة</h4><p class="mut">استمع إلى الكتاب كاملًا من «🎧 استمع وراجع» قبل اعتماده: يُعلَّم كل مقطع مسموعًا عند سماعه إلى آخره، وتُسجَّل ملاحظات أخطاء النطق والتشكيل لتصحيحها وإعادة تسجيلها. لا يظهر الكتاب للأعضاء ولا يدخل الراديو إلا بعد الاعتماد.</p>${Object.entries(L).map(([id, x]) => `<div class="bk"><b>${esc((B(id) || {}).title || x.t || id)}</b> ${x.ok ? '<em class="tag">منشور للأعضاء</em>' : '<em class="tag">غير منشور</em>'} <a class="btn s${x.ok ? "" : " p"}" href="#/audio/${id}?rev=1">🎧 استمع وراجع</a> <button class="btn s" data-act="apok" data-id="${id}" data-on="${x.ok ? 0 : 1}">${x.ok ? "إلغاء النشر" : "اعتماد ونشر للأعضاء"}</button> <button class="btn s" data-act="apredo" data-id="${id}" title="يحذف التسجيل كله ثم يعيد تسجيله بالصوت الافتراضي وقاموس النطق">♻ حذف وإعادة التسجيل</button> <button class="btn s" data-act="apdel" data-id="${id}" title="يحذف التسجيل ويستبعد الكتاب من التحويل التلقائي">🗑 حذف</button><span>${(() => { const st = ARev.stat(id, x); return st.N ? `<b class="${st.heard >= st.N && !st.notes ? "" : "warn"}">مراجعة السماع: ${toAr(st.heard)} من ${toAr(st.N)}${st.notes ? " • " + toAr(st.notes) + " ملاحظة" : ""}${st.by ? " (" + esc(st.by) + ")" : ""}</b> • ` : ""; })()}${toAr(x.n)} من ${toAr(x.of || 0)} صفحة • ${fmtDur(x.d)}${x.vn ? " • " + esc(x.vn) : ""}${x.rec ? " • " + toAr(x.rec) + " تسجيل" : ""} • آخر تحديث ${esc(x.upd || "")}</span></div>`).join("") || '<p class="mut">لا كتب مسموعة بعد.</p>'}</div>
  <div class="card"><h3>قنوات الراديو</h3><p class="mut">القنوات التلقائية: «مختارات المكتبة» و«إذاعة الدعوة السلفية» و«إذاعة التراث». وأنشئ قنوات خاصة من الكتب المسموعة:</p>
  ${(RC.list || []).map((c, k) => `<div class="bk"><b>${esc(c.n)}</b><span>${toAr((c.books || []).length)} كتاب${c.mix ? " • مختارات متنوعة" : " • كتب كاملة"}</span><button class="btn s" data-act="rcdel" data-k="${k}">حذف القناة</button></div>`).join("")}
  <form data-form="rcadd"><label>اسم القناة</label><input name="n" maxlength="60" required placeholder="مثال: إذاعة العقيدة"><label>وصف قصير</label><input name="d" maxlength="120"><label>الكتب</label><div class="ckl">${Object.keys(L).filter(id => AUDIO.ready(L[id]) && L[id].ok && B(id)).map(id => `<label class="chk"><input type="checkbox" name="bk" value="${id}"> ${esc(B(id).setTitle || B(id).title)}</label>`).join("") || '<p class="mut">تظهر الكتب هنا بعد اكتمال صوتياتها واعتمادها.</p>'}</div><label class="chk"><input type="checkbox" name="mix"> مختارات متنوعة (مقاطع قصيرة) بدل الكتب كاملة</label><button class="btn p" style="margin-top:8px">إنشاء القناة</button></form></div>`;
  window.__RC = RC;
  let RP = { list: [] }; try { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_programs").maybeSingle(); if (data && data.value) RP = data.value; } catch (e) { }
  window.__RP = RP;
  let RA = {}; try { const { data } = await Auth.sb.from("app_settings").select("value").eq("key", "radio_auto").maybeSingle(); RA = (data && data.value) || {}; } catch (e) { }
  window.__RA = RA;
  $("#aadm").insertAdjacentHTML("beforeend", `<div class="card"><h3>📻 البث المتواصل ٢٤ ساعة</h3><p class="mut">شبكة يومية تتجدد آليًا: لكل ساعة موضوع (الأذكار فجرًا، العقيدة صباحًا، الفقه ظهرًا، السيرة عصرًا، القرآن والحديث مساءً)، ويتقدم كل كتاب يومًا بعد يوم. مكتبة الدعوة أولًا، وتُكمَّل من كتب المكتبة العامة التي تختارها هنا.</p>
   <form data-form="raauto"><label>نصيب مكتبة الدعوة من الساعات</label><select name="share">${[[1, "كل الساعات"], [0.85, "٨٥٪"], [0.75, "٧٥٪ (مقترح)"], [0.6, "٦٠٪"]].map(([v, l]) => `<option value="${v}"${(RA.dawahShare ?? 0.75) == v ? " selected" : ""}>${l}</option>`).join("")}</select>
   <label>كتب المكتبة العامة المسموعة في البث</label><div class="ckl">${lib.books.filter(b => b.col === "turath" && b.type !== "article" && !b.vf && !b.hidden && (b.n || 0) <= 600).sort((x, y) => (x.n || 0) - (y.n || 0)).map(b => `<label class="inl"><input type="checkbox" name="rt" value="${b.id}"${(RA.turath || []).includes(b.id) ? " checked" : ""}> ${esc(b.title)}${L[b.id] && AUDIO.ready(L[b.id]) ? " 🔊" : ""}</label>`).join("")}</div><p class="mut">المختار يُحوَّل إلى صوت تلقائيًا بعد كتب الدعوة، ويدخل البث متى اكتمل (🔊 = مسموع).</p><div></div>
   <button class="btn p">حفظ</button></form></div>`);
  $("#aadm").insertAdjacentHTML("beforeend", `<div class="card"><h3>📅 البرامج الإذاعية بمواعيد ثابتة</h3><p class="mut">برنامج يُبث في موعده (بتوقيت القاهرة) في الأيام المحددة، ويظهر قناةً «على الهواء» في مقدمة الراديو، وفي جدول البرامج اليومي. مواده من الكتب المسموعة المعتمدة.</p>
   ${(RP.list || []).map((p, k) => `<div class="bk"><b>${esc(p.at)} — ${esc(p.n)}</b><span>${(p.days || []).length ? p.days.map(d => RDAYS[d]).join("، ") : "يوميًا"} • ${toAr(+p.dur || 60)} دقيقة • ${toAr((p.books || []).length)} كتاب</span><button class="btn s" data-act="rpdel" data-k="${k}">حذف</button></div>`).join("") || '<p class="mut">لا برامج بعد.</p>'}
   <form data-form="rpadd"><div class="row"><div><label>اسم البرنامج</label><input name="n" maxlength="60" required placeholder="مثال: مجلس العقيدة"></div><div><label>الموعد</label><input name="at" type="time" required value="20:00"></div><div><label>المدة (دقيقة)</label><input name="dur" type="number" min="10" max="600" value="60"></div></div>
   <label>وصف</label><input name="d" maxlength="120"><label>الأيام (اتركها كلها فارغة ليوميًا)</label><div>${RDAYS.map((d, i) => `<label class="inl"><input type="checkbox" name="day" value="${i}"> ${d}</label>`).join("")}</div>
   <label>الكتب</label><div class="ckl">${Object.keys(L).filter(id => AUDIO.ready(L[id]) && L[id].ok && B(id)).map(id => `<label class="inl"><input type="checkbox" name="pb" value="${id}"> ${esc(B(id).setTitle || B(id).title)}</label>`).join("") || '<span class="mut">لا كتب مسموعة معتمدة بعد.</span>'}</div>
   <button class="btn p">إضافة البرنامج</button></form></div>`);
}

/* ---------- الأحداث ---------- */
// عينة الصوت المختار (إصدار audio-voices تولّده مهمة «عينات أصوات الصوتيات»)
let VSAMPLE = null;
document.addEventListener("click", e => {
  const el = e.target.closest('[data-act="vsample"]'); if (!el) return; e.preventDefault();
  const v = ($("#" + el.dataset.for) || {}).value; if (!v) return;
  if (VSAMPLE) { VSAMPLE.pause(); if (VSAMPLE.dataset.v === v) { VSAMPLE = null; el.textContent = "▶ عينة"; return; } }
  VSAMPLE = new Audio(AUDIO.url("voices", v.replace(":", "-") + ".mp3")); VSAMPLE.dataset.v = v; el.textContent = "■ إيقاف";
  VSAMPLE.onended = () => { el.textContent = "▶ عينة"; VSAMPLE = null; };
  VSAMPLE.play().catch(() => { el.textContent = "▶ عينة"; VSAMPLE = null; toast("عينة هذا الصوت لم تُجهَّز بعد؛ تُولَّد خلال دقائق."); });
});
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act; if (!/^(ap|rd|rc|rp)/.test(a)) return;
  if (el.tagName !== "A") e.preventDefault();
  try {
    if (a === "apredo" || a === "apdel") { // حذف الكتاب المسموع (وإعادة تسجيله): يُنفّذه tools/tts.py بحذف إصداره وبيانه
      const id = el.dataset.id, t = (B(id) || {}).title || id, redo = a === "apredo";
      if (!confirm(redo ? `حذف تسجيل «${t}» كله وإعادة تسجيله من جديد؟` : `حذف تسجيل «${t}» نهائيًّا واستبعاده من التحويل التلقائي؟`)) return;
      el.disabled = true;
      await GH.editJSON("data/audio/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(i => i.id !== id || i.rec); o.items.unshift({ id, del: 1, redo: redo ? 1 : 0 }); return o; }, (redo ? "صوتيات: حذف وإعادة تسجيل «" : "صوتيات: حذف «") + t + "»");
      toast(redo ? "طُلب الحذف وإعادة التسجيل؛ يُنفَّذ في الجولة القادمة." : "طُلب الحذف؛ يُنفَّذ في الجولة القادمة."); return;
    }
    if (a === "applay") { await AP.playBook(el.dataset.id, +el.dataset.p || 1, +el.dataset.t || 0); }
    else if (a === "aprec") AP.playRec(el.dataset.id, +el.dataset.k);
    else if (a === "aptoggle") AP.toggle();
    else if (a === "apnext") AP.next(); else if (a === "apprev") AP.prev();
    else if (a === "apseek") AP.seek(+el.dataset.d);
    else if (a === "apclose") AP.stop();
    else if (a === "apfull") AP.openFull(); else if (a === "apfullx") AP.closeFull();
    else if (a === "apmark") { const it = AP.cur(); if (!it) return; const note = prompt("ملاحظة على العلامة (اختياري):", "") || ""; AMarks.add({ bid: it.bid, p: it.p, t: Math.floor(AP.audio().currentTime), note, at: Date.now() }); toast("حُفظت علامة التوقف في «صوتيات المكتبة»"); }
    else if (a === "apmarkx") { AMarks.del(+el.dataset.i); route(); }
    else if (a === "aplineup") { const id = el.dataset.id, l = AP.lineup; const k = l.indexOf(id); if (k >= 0) l.splice(k, 1); else l.push(id); ls.set("ap_lineup", l); el.textContent = k >= 0 ? "+ إلى قائمة التشغيل" : "✓ في قائمة التشغيل"; toast(k >= 0 ? "أُزيل من قائمة التشغيل" : "أضيف إلى قائمة التشغيل؛ يُسمع بعد ما قبله"); }
    else if (a === "aplineupx") { AP.lineup.splice(+el.dataset.k, 1); ls.set("ap_lineup", AP.lineup); route(); }
    else if (a === "aplineupplay") { if (AP.lineup[0]) await AP.playBook(AP.lineup[0], 1); }
    else if (a === "rdplay") { const ch = (window.__rch || []).find(c => c.id === el.dataset.c); if (!ch) return; if (AP.mode === "radio" && AP.ch && AP.ch.id === ch.id && !AP.audio().paused) { AP.toggle(false); } else await AP.playRadio(ch); setTimeout(() => { if (parse().p[0] === "radio") route(); }, 400); }
    else if (a === "apok") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const on = el.dataset.on === "1"; if (on) { const st = ARev.stat(el.dataset.id, (AUDIO.list || {})[el.dataset.id] || {}); const w = (st.N && st.heard < st.N ? `⚠ لم يُسمع ${toAr(st.N - st.heard)} من ${toAr(st.N)} مقطعًا بعد.\n` : "") + (st.notes ? `⚠ عليه ${toAr(st.notes)} ملاحظة لم تُعالج.\n` : ""); if (!confirm(w + "اعتماد هذا الكتاب ينشر صوتياته للأعضاء ويدخله الراديو. هل راجعت نصه وتشكيله واستمعت إليه؟")) return; ARev.save(el.dataset.id).catch(() => { }); } await GH.editJSON("data/audio/_list.json", o => { if (o[el.dataset.id]) { if (on) o[el.dataset.id].ok = 1; else delete o[el.dataset.id].ok; } return o; }, (on ? "اعتماد صوتيات: " : "إلغاء نشر صوتيات: ") + el.dataset.id, true); AUDIO.list = null; toast(on ? "نُشرت صوتيات الكتاب" : "أُلغي النشر"); route(); }
    else if (a === "aprvok") ARev.mark(el.dataset.id, +el.dataset.p);
    else if (a === "aprvnote") ARev.note(el.dataset.id, +el.dataset.p);
    else if (a === "aprvplay") { const c = window.__arev; if (!c) return; const r = ARev.get(c.bid), p = ARev.pages(c.x).find(p => ARev.st(r, c.man, p) !== "ok") || 1; await AP.playBook(c.bid, p); }
    else if (a === "aprvsave") { await ARev.save(el.dataset.id); toast("حُفظت المراجعة؛ يراها المشرفون الآخرون"); }
    else if (a === "aprvredo") await ARev.redo(el.dataset.id);
    else if (a === "rpdel") { if (!confirm("حذف البرنامج؟")) return; const RP = window.__RP || { list: [] }; RP.list.splice(+el.dataset.k, 1); await CM.saveSetting("radio_programs", RP); RPROG = null; route(); }
    else if (a === "rcdel") { if (!confirm("حذف القناة؟")) return; const RC = window.__RC || { list: [] }; RC.list.splice(+el.dataset.k, 1); await CM.saveSetting("radio_channels", RC); toast("حُذفت القناة"); route(); }
  } catch (x) { console.warn(x); toast(x.message || "تعذر تنفيذ الطلب"); }
});
document.addEventListener("click", e => { const s = e.target.closest("#aptext [data-ms]"); if (!s || AP.mode === "radio") return; AP.audio().currentTime = (+s.dataset.ms) / 1000 + 0.05; });
document.addEventListener("input", e => { if (e.target.id === "approg") { AP.audio().currentTime = +e.target.value; } });
document.addEventListener("change", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.dataset.act === "aprate") AP.setRate(+el.value);
  else if (el.dataset.act === "apsleep" && el.value !== "") AP.sleep(el.value === "end" ? "end" : +el.value);
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-form]"); if (!f || !/^(audq|audset|audrec|rcadd|rpadd|raauto|aulex|auomit)$/.test(f.dataset.form)) return;
  e.preventDefault(); e.stopImmediatePropagation(); const btn = f.querySelector("button"); btn.disabled = true;
  try {
    if (f.dataset.form === "audq") {
      if (!GH.on) throw new Error("فعّل الإدارة المباشرة (سجّل الدخول بحساب المدير) أولًا.");
      const it = Object.assign({ id: f.b.value, voice: f.v.value, rate: f.r.value }, f.fz && f.fz.checked ? { force: 1 } : {});
      await GH.editJSON("data/audio/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => x.id !== it.id || x.rec); o.items.push(it); return o; }, "صوتيات: طلب تحويل «" + ((B(it.id) || {}).title || it.id) + "»");
      $("#audqs").textContent = "أضيف إلى الطابور؛ يبدأ التحويل خلال دقائق، ويصلك إشعار عند الانتهاء."; btn.disabled = false;
    } else if (f.dataset.form === "aulex") { // قاموس النطق: يطبقه tools/tts.py على نص كل صفحة قبل تسجيلها
      if (!GH.on) throw new Error("فعّل الإدارة المباشرة (سجّل الدخول بحساب المدير) أولًا.");
      const words = String(f.lex.value || "").split("\n").map(l => l.split("=").map(x => x.trim())).filter(x => x.length === 2 && x[0] && x[1]);
      await GH.editJSON("data/audio/_lexicon.json", o => Object.assign(o || {}, { words, at: new Date().toISOString() }), "صوتيات: قاموس النطق (" + words.length + ")");
      $("#aulexs").textContent = "حُفظ (" + toAr(words.length) + " كلمة)؛ يطبَّق على التسجيلات القادمة."; btn.disabled = false;
    } else if (f.dataset.form === "auomit") { // صفحات لا تُقرأ في كتاب: يقرؤها tools/tts.py من _settings.omit، وتُعاد الكتب المعنية في الدورة القادمة
      if (!GH.on) throw new Error("فعّل الإدارة المباشرة (سجّل الدخول بحساب المدير) أولًا.");
      const id = f.b.value, o = { front: +f.fr.value || 0, back: +f.bk.value || 0, pages: String(f.pg.value || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).split(/[^\d]+/).map(Number).filter(Boolean) };
      await GH.editJSON("data/audio/_settings.json", s => { s = s || {}; s.omit = s.omit || {}; if (o.front || o.back || o.pages.length) s.omit[id] = o; else delete s.omit[id]; return s; }, "صوتيات: صفحات لا تُقرأ في «" + ((B(id) || {}).title || id) + "»");
      await GH.editJSON("data/audio/_queue.json", q => { q = q || { items: [] }; q.items = q.items || []; if (!q.items.some(x => x.id === id && !x.rec)) q.items.push({ id }); return q; }, "صوتيات: تحديث «" + ((B(id) || {}).title || id) + "»");
      $("#auoms").textContent = "حُفظ، وأضيف الكتاب إلى الطابور لتحديث صفحاته."; btn.disabled = false;
    } else if (f.dataset.form === "audset") {
      if (!GH.on) throw new Error("فعّل الإدارة المباشرة (سجّل الدخول بحساب المدير) أولًا.");
      const v = f.v.value; await GH.editJSON("data/audio/_settings.json", o => Object.assign(o || {}, { voice: v, at: new Date().toISOString() }), "صوتيات: الصوت الافتراضي " + v);
      $("#audss").textContent = "حُفظ؛ يُستعمل في التحويل القادم."; btn.disabled = false;
    } else if (f.dataset.form === "audrec") {
      if (!GH.on || !Cloud.on()) throw new Error("رفع التسجيلات يحتاج تسجيل الدخول بحساب المشرف.");
      const file = f.f.files[0]; if (!file) throw new Error("اختر الملف"); if (file.size > 50 * 1048576) throw new Error("الحد ٥٠ ميجابايت للملف الواحد.");
      const ext = (file.name.match(/\.(mp3|m4a|aac|ogg|wav|webm)$/i) || [, "mp3"])[1].toLowerCase(), name = "au" + Date.now().toString(36) + "." + ext;
      $("#audrs").textContent = "جارٍ الرفع…";
      const { error } = await Auth.sb.storage.from("inbox").upload(name, file, { contentType: file.type || "audio/mpeg", upsert: true }); if (error) throw new Error(error.message);
      const it = { id: f.b.value, rec: { f: name, t: f.t.value.trim(), p: +f.p.value || 1, by: (Auth.user && Auth.user.name) || "" } };
      await GH.editJSON("data/audio/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).unshift(it); return o; }, "صوتيات: تسجيل «" + it.rec.t + "»");
      $("#audrs").textContent = "رُفع التسجيل؛ يظهر في صفحة الكتاب خلال دقائق."; f.reset(); btn.disabled = false;
    } else if (f.dataset.form === "raauto") {
      const RA = { dawahShare: +f.share.value, turath: [...f.querySelectorAll('input[name="rt"]:checked')].map(x => x.value) };
      await CM.saveSetting("radio_auto", RA); RAUTO = null;
      try { await GH.editJSON("data/audio/_auto.json", () => ({ v: 1, turath: RA.turath }), "صوتيات: كتب المكتبة العامة للبث", false); } catch (e) { }
      toast("حُفظت إعدادات البث المتواصل"); route();
    } else if (f.dataset.form === "rpadd") {
      const books = [...f.querySelectorAll('input[name="pb"]:checked')].map(x => x.value), days = [...f.querySelectorAll('input[name="day"]:checked')].map(x => +x.value);
      const RP = window.__RP || { list: [] }; (RP.list = RP.list || []).push({ id: Date.now().toString(36), n: f.n.value.trim(), d: f.d.value.trim(), at: f.at.value, dur: +f.dur.value || 60, days, books });
      await CM.saveSetting("radio_programs", RP); RPROG = null; toast("أُضيف البرنامج"); route();
    } else if (f.dataset.form === "rcadd") {
      const ids = [...f.querySelectorAll('input[name="bk"]:checked')].map(x => x.value); if (!ids.length) throw new Error("اختر كتابًا واحدًا على الأقل");
      const RC = window.__RC || { list: [] }; (RC.list = RC.list || []).push({ id: Date.now().toString(36), n: f.n.value.trim(), d: f.d.value.trim(), books: ids, mix: f.mix.checked });
      await CM.saveSetting("radio_channels", RC); toast("أُنشئت القناة"); route();
    }
  } catch (x) { alert(x.message); btn.disabled = false; }
}, true);
// استئناف الراديو عند العودة إلى الصفحة بعد انقطاع طويل (يبقى متزامنًا مع البث)
document.addEventListener("visibilitychange", () => { if (!document.hidden && AP.mode === "radio" && AP.el && !AP.el.paused) { const { i, off } = radioPos(AP.ch); if (i !== AP.i || Math.abs(AP.el.currentTime - off) > 20) AP.load(i, off, true); } });
