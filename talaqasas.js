/* قصص الطلائع (TQS): قصص الأنبياء والصحابة والصحابيات والتابعين والتابعيات بأسلوب مرح بحسب المرحلة العمرية
   (data/tala-qasas.json): قصة لكل مرحلة (t1 المستكشفون، t2 البراعم، t3 للرواد والناشئة، وللناشئة t4 سؤال نقاش)،
   واستماع للقصة بصوت الجهاز، وأسئلة بأصوات ونجوم، ولعبة «رتّب الأحداث»، ولعبة «من أنا؟»، ونشاط عملي، وبطاقات الأبطال المكتملة.
   يُستدعى من tala.js (#/talaea/qasas) ويتسلم منه أدوات القسم (العنوان والنجوم والمرحلة). التقدم محفوظ على هذا الجهاز. */
const TQS = (() => {
  let DATA = null, C = null, WHO = null;
  const RAW = p => "https://raw.githubusercontent.com/" + ((typeof CFG !== "undefined" && CFG.repo) || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Math.floor(Date.now() / 300e3);
  const get = async p => { for (const u of [RAW(p), "data/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  let GEN = [], OKS = {};
  const adm = () => (typeof isAdmin === "function" && isAdmin()) || (typeof can === "function" && can("tala"));
  // القصص المصوغة من كتب الباشا وسلاسل الشيخ مصطفى دياب (tools/tala-qasas-gen.py) لا تظهر حتى يعتمدها المدير
  const load = async f => { if (DATA && !f) return DATA; const base = await fetch("data/tala-qasas.json").then(r => r.ok ? r.json() : null).catch(() => null); if (!base) return null;
    const [g, ok] = await Promise.all([get("tala-qasas-gen.json"), get("tala-qasas-ok.json")]); GEN = (g && g.items) || []; OKS = (ok && ok.ok) || {};
    const appr = GEN.filter(x => OKS[x.id] === 1 && !x.dup); return (DATA = Object.assign({}, base, { items: base.items.concat(appr) })); };
  const pending = () => GEN.filter(x => !OKS[x.id] && !x.dup);
  const mix = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const sfx = (f, ...a) => { try { if (typeof TSFX !== "undefined") TSFX[f](...a); } catch (e) { } };
  const lv = k => k === "t4" ? "t3" : (k || "t1"); // الناشئة يقرؤون نص المرحلة الثالثة مع النقاش والفوائد
  const prog = () => { const s = C.st(); return (s.qs = s.qs || {}); };
  const isDone = (id, k) => !!(prog()[id] || {})[k];
  const nDone = id => Object.keys(prog()[id] || {}).length;
  const para = t => String(t || "").split("\n").filter(Boolean).map(p => `<p>${esc(p)}</p>`).join("");

  async function view(q, ctx) {
    C = ctx; const D = await load();
    if (!D) return C.view_(C.head("", true) + '<p class="note">القصص غير متاحة الآن، حاول لاحقًا.</p></div>');
    if (q.g === "who") return who(D, q);
    if (q.g === "rev" && adm()) return review(D);
    const f = D.items.find(x => x.id === q.id) || (adm() && GEN.find(x => x.id === q.id));
    if (f) return story(D, f, q.k && /^t[1-4]$/.test(q.k) ? C.own(q.k) : ((C.kid() || {}).track || "t1"));
    return hub(D, q.c);
  }

  function hub(D, cat) {
    const g = C.sx(), cats = g === "g" ? D.cats.slice().sort((a, b) => /b$|t$/.test(b[0]) - /b$|t$/.test(a[0])) : D.cats;
    const cur = cats.find(c => c[0] === cat), list = D.items.filter(f => !cur || f.c === cur[0]);
    const done = D.items.filter(f => nDone(f.id)).length;
    C.view_(C.head("قصص الأبطال", true) + `<div class="tqs"><h2 class="talat">📚 قصص الأنبياء والصحابة والتابعين</h2>
      <p>قصص حقيقية من القرآن والسنة الصحيحة وكتب السيرة، بأسلوب يناسب كل مرحلة، مع أسئلة وألعاب ونشاط عملي ونجوم ⭐</p>
      <p class="mut">أتممت ${toAr(done)} من ${toAr(D.items.length)} قصة <span class="mbar"><i style="width:${Math.round(100 * done / D.items.length)}%"></i></span></p>
      <div class="talag tgames"><a class="talac game" href="#/talaea/qasas?g=who"><i aria-hidden="true">🕵️</i><b>من أنا؟</b><span>اقرأ الأدلة واعرف البطل، وكلما عرفته بأدلة أقل نلت نجومًا أكثر</span></a></div>
      <nav class="chips"><a class="chip${cur ? "" : " x"}" href="#/talaea/qasas">الكل</a>${cats.map(c => `<a class="chip${cur && cur[0] === c[0] ? " x" : ""}" href="#/talaea/qasas?c=${c[0]}">${c[2]} ${esc(c[1])}</a>`).join("")}</nav>
      ${cats.filter(c => !cur || c === cur).map(c => { const fs = list.filter(f => f.c === c[0]); return fs.length ? `<h3>${c[2]} ${esc(c[1])}</h3><p class="mut">${esc(c[3])}</p>
        <div class="talag tgames">${fs.map(f => `<a class="talac tqsc${nDone(f.id) ? " on" : ""}" href="#/talaea/qasas?id=${f.id}"><i aria-hidden="true">${f.ic}</i><b>${esc(f.n)}${nDone(f.id) ? " ✅" : ""}</b><span>${esc(f.lq)}</span></a>`).join("")}</div>` : ""; }).join("")}
      ${adm() && pending().length ? `<p><a class="btn s p" href="#/talaea/qasas?g=rev">🛡️ قصص مقترحة من كتب الباشا ومصطفى دياب بانتظار المراجعة (${toAr(pending().length)})</a></p>` : ""}
      <p class="mut">ومن مصادر هذه القصص: «صور من حياة الصحابة» و«صور من حياة الصحابيات» لعبد الرحمن رأفت الباشا، وسلاسل الشيخ مصطفى دياب القصصية.</p>
      <p class="note">إلى الوالدين: القصص مقتصرة على الثابت في القرآن والسنة وكتب السير المعتمدة، بلا إسرائيليات ولا صور للأنبياء والصحابة. والمصدر مذكور تحت كل قصة.</p></div></div>`);
  }

  function story(D, f, k) {
    const L = lv(k), cat = D.cats.find(c => c[0] === f.c) || [];
    const qs = f.q[L].map((x, i) => { const o = mix(x.slice(1)); return `<div class="tmq" data-tq="${i}"><p><b>${toAr(i + 1)}. ${esc(x[0])}</b></p><div class="row">${o.map(a => `<button class="btn tmo" data-tqa="${a === x[1] ? 1 : 0}">${esc(a)}</button>`).join("")}</div></div>`; }).join("");
    const ev = mix(f.ev.map((e, i) => [e, i]));
    const tabs = C.vis().map(([kk, n]) => `<a class="chip${kk === k ? " x" : ""}" href="#/talaea/qasas?id=${f.id}&k=${kk}">${esc(n)}</a>`).join("");
    const i = D.items.indexOf(f), nx = D.items[(i + 1) % D.items.length];
    C.view_(C.head(cat[1] || "", true) + `<div class="tqs" data-id="${f.id}" data-k="${k}" data-n="${f.q[L].length}">
      <nav class="chips">${tabs}</nav>
      <h2 class="talat"><span class="tqbig" aria-hidden="true">${f.ic}</span> ${esc(f.n)}</h2><p class="mut">${esc(f.lq)}</p>
      <div class="card tqstory${L === "t1" ? " big" : ""}">${para(f.s[L])}<p><button class="btn s" data-act="tqsay">🔊 استمع إلى القصة</button></p></div>
      ${L === "t3" ? `<div class="card"><h3>💡 فوائد من القصة</h3><ul>${f.fa.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <h3>❓ أسئلة القصة</h3>${qs}
      <h3>🧩 رتّب الأحداث</h3><p class="mut">اضغط الأحداث بترتيب وقوعها من الأول إلى الأخير.</p>
      <div class="tqord">${ev.map(([e, n]) => `<button class="btn tqev" data-tqo="${n}">${esc(e)}</button>`).join("")}</div>
      <h3>🎯 نشاط عملي</h3><div class="mjacts"><span>${esc(f.act[L])}</span></div>
      ${k === "t4" ? `<div class="card"><h3>🗣️ للنقاش مع المربي أو الأصدقاء</h3><p>${esc(f.nq)}</p></div>` : ""}
      <p><button class="btn p tqfin${isDone(f.id, k) ? " on" : ""}" data-act="tqfin">${isDone(f.id, k) ? "✅ أتممت هذه القصة" : "أتممت القصة والنشاط ⭐"}</button></p>
      <p class="mut">المصدر: ${esc(f.src)}${f.b ? ` — <a href="#/book/${esc(f.b)}/${f.p || 1}">📖 اقرأ الأصل في المكتبة</a>` : ""}${MORE[f.id] ? ` — <a href="#/book/${MORE[f.id][0]}/${MORE[f.id][1]}">📖 قصته في «صور من حياة ${MORE[f.id][0].startsWith("tio14542") ? "الصحابيات" : "الصحابة"}» للباشا</a>` : ""}</p>
      ${adm() && f.rev === 0 ? `<div class="card tqrev"><b>🛡️ مراجعة المدير:</b> ${OKS[f.id] === 1 ? "معتمدة ✓" : OKS[f.id] === -1 ? "مرفوضة" : "لم تُعتمد بعد"} <button class="btn s p" data-tqok="${f.id}" data-v="1">اعتماد</button> <button class="btn s" data-tqok="${f.id}" data-v="-1">رفض</button></div>` : ""}
      <p><a class="btn" href="#/talaea/qasas?c=${f.c}">← ${esc(cat[1] || "القصص")}</a> <a class="btn" href="#/talaea/qasas?id=${nx.id}&k=${k}">القصة التالية: ${esc(nx.n)} ←</a></p></div></div>`);
  }

  // ---------- من أنا؟ ----------
  function who(D, q) {
    if (!WHO || q.r) WHO = { list: mix(D.items).slice(0, 6), i: 0, s: 0 };
    const G = WHO;
    if (G.i >= G.list.length) return C.view_(C.head("من أنا؟", true) + `<div class="tqs"><div class="talawin"><h2>${(typeof TSFX !== "undefined") ? esc(TSFX.text("done")) : "أحسنت!"} 🎉</h2><p>جمعت ${toAr(G.s)} نجمة من لعبة «من أنا؟».</p><a class="btn p" href="#/talaea/qasas?g=who&r=${Date.now()}">العب مرة أخرى</a> <a class="btn" href="#/talaea/qasas">القصص</a></div></div></div>`);
    const f = G.list[G.i], opts = mix([f].concat(mix(D.items.filter(x => x !== f && x.c === f.c)).slice(0, 2), mix(D.items.filter(x => x.c !== f.c)).slice(0, 1)));
    C.view_(C.head("من أنا؟", true) + `<div class="tqs tqwho" data-c="0"><h2 class="talat">🕵️ من أنا؟</h2><p class="mut">البطل ${toAr(G.i + 1)} من ${toAr(G.list.length)} • نجومك ${toAr(G.s)}</p>
      <ol class="tqcl">${f.cl.map((c, i) => `<li${i ? " hidden" : ""}>${esc(c)}</li>`).join("")}</ol>
      <p><button class="btn s" data-act="tqmore">💡 دليل آخر</button></p>
      <div class="row">${opts.map(o => `<button class="btn tmo" data-tqw="${o === f ? 1 : 0}">${o.ic} ${esc(o.n)}</button>`).join("")}</div>
      <p class="tqnext" hidden><a class="btn s" href="#/talaea/qasas?id=${f.id}">📖 اقرأ قصته</a> <button class="btn p" data-act="tqwnext">التالي ←</button></p></div></div>`);
  }

  const say = () => { try { const box = document.querySelector(".tqstory"); if (!box || !window.speechSynthesis) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance([...box.querySelectorAll("p")].slice(0, -1).map(p => p.textContent.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "")).join(" ")); u.lang = "ar-SA"; u.rate = .9;
    const v = speechSynthesis.getVoices().filter(x => /^ar/i.test(x.lang)); if (v.length) u.voice = v[0]; speechSynthesis.speak(u); } catch (e) { } };

  const checkAll = box => { const okQ = box.querySelectorAll(".tmq.ok").length, n = +box.dataset.n, ord = !box.querySelector(".tqev:not(.right)");
    if (okQ >= n && ord && !box.dataset.won) { box.dataset.won = 1; sfx("done"); } };

  document.addEventListener("click", e => {
    const box = e.target.closest(".tqs"); if (!box || !C) return;
    const a = e.target.closest("[data-tqa]");
    if (a && !a.disabled) { const m = a.closest(".tmq"), ok = a.dataset.tqa === "1"; a.classList.add(ok ? "right" : "wrong"); sfx(ok ? "right" : "wrong");
      if (ok) { m.classList.add("ok"); m.querySelectorAll("[data-tqa]").forEach(x => x.disabled = true); if (!m.dataset.miss) C.star(1); checkAll(box); } else { m.dataset.miss = 1; a.disabled = true; } return; }
    const o = e.target.closest("[data-tqo]");
    if (o && !o.classList.contains("right")) { const want = box.querySelectorAll(".tqev.right").length;
      if (+o.dataset.tqo === want) { o.classList.add("right"); o.textContent = toAr(want + 1) + ". " + o.textContent; sfx("bubble"); o.parentNode.querySelector(".tqev:not(.right)") ? 0 : (C.star(2), checkAll(box)); }
      else { o.classList.add("shake"); sfx("wrong"); setTimeout(() => o.classList.remove("shake"), 500); } return; }
    const w = e.target.closest("[data-tqw]");
    if (w && !w.disabled) { const ok = w.dataset.tqw === "1"; w.classList.add(ok ? "right" : "wrong"); sfx(ok ? "right" : "wrong");
      box.querySelectorAll("[data-tqw]").forEach(x => { if (x.dataset.tqw === "1") x.classList.add("right"); x.disabled = true; });
      box.querySelectorAll(".tqcl li").forEach(l => l.hidden = false);
      if (ok) { const n = 3 - (+box.dataset.c || 0); WHO.s += n; C.star(n); } box.querySelector(".tqnext").hidden = false; return; }
    const act = (e.target.closest("[data-act]") || {}).dataset; if (!act) return;
    if (act.act === "tqsay") return say();
    if (act.act === "tqfin") { const id = box.dataset.id, k = box.dataset.k, p = prog(); p[id] = p[id] || {};
      if (!p[id][k]) { p[id][k] = 1; C.star(3); saveS(); sfx("done"); } const b = e.target.closest("button"); b.classList.add("on"); b.textContent = "✅ أتممت هذه القصة"; return; }
    if (act.act === "tqmore") { const h = box.querySelector(".tqcl li[hidden]"); if (h) { h.hidden = false; box.dataset.c = +box.dataset.c + 1; sfx("bubble"); } if (!box.querySelector(".tqcl li[hidden]")) e.target.closest("button").disabled = true; return; }
    if (act.act === "tqwnext") { WHO.i++; return view({ g: "who" }, C); }
  });
  // روابط شخصيات القصص الأساسية إلى فصولها في كتب الباشا
  const MORE = { anas: ["tio30089-v01", 8], ibnabbas: ["tio30089-v01", 168], bilal: ["tio30089-v01", 298], uthman: ["tio30089-v01", 530], fatima: ["tio14542-v01", 30], asma: ["tio14542-v01", 42], umsulaym: ["tio14542-v01", 87], umsalama: ["tio14542-v01", 100] };
  function review(D) {
    const P = pending(), cats = Object.fromEntries(D.cats.map(c => [c[0], c[1]]));
    C.view_(C.head("مراجعة القصص", true) + `<div class="tqs"><h2 class="talat">🛡️ قصص مقترحة بانتظار المراجعة</h2>
      <p class="mut">صاغها الذكاء الاصطناعي من كتب الباشا وسلاسل الشيخ مصطفى دياب. افتح القصة، وراجع نصها ومراحلها وأسئلتها على الأصل، ثم اعتمدها لتظهر للطلائع أو ارفضها. والمعتمد يظهر للجميع فورًا.</p>
      ${P.length ? `<ol>${P.map(f => `<li><a href="#/talaea/qasas?id=${f.id}">${f.ic} ${esc(f.n)}</a> <span class="mut">— ${esc(cats[f.c] || "")} • ${esc(f.src)}</span> <button class="btn s p" data-tqok="${f.id}" data-v="1">اعتماد</button> <button class="btn s" data-tqok="${f.id}" data-v="-1">رفض</button></li>`).join("")}</ol>` : '<p class="note">لا قصص بانتظار المراجعة الآن. تُصاغ قصص جديدة تلقائيًّا كل أسبوع.</p>'}
      <p class="mut">المعتمد: ${toAr(GEN.filter(x => OKS[x.id] === 1).length)} • المرفوض: ${toAr(GEN.filter(x => OKS[x.id] === -1).length)} • المكرر مع القصص الأساسية (لا يُعرض): ${toAr(GEN.filter(x => x.dup).length)}</p></div></div>`);
  }
  document.addEventListener("click", async e => { const b = e.target.closest("[data-tqok]"); if (!b || !adm()) return; e.preventDefault(); const id = b.dataset.tqok, v = +b.dataset.v; b.disabled = true;
    try { await GH.editJSON("data/tala-qasas-ok.json", o => { o = o || { ok: {} }; o.ok = o.ok || {}; o.ok[id] = v; return o; }, "قصص الطلائع: " + (v === 1 ? "اعتماد" : "رفض") + " قصة " + id);
      OKS[id] = v; DATA = null; await load(); toast(v === 1 ? "اعتُمدت القصة وتظهر الآن للطلائع" : "رُفضت القصة"); const li = b.closest("li"); if (li) li.remove(); else b.closest(".tqrev").querySelector("b").nextSibling.textContent = v === 1 ? " معتمدة ✓ " : " مرفوضة ";
    } catch (err) { b.disabled = false; toast("تعذّر الحفظ: " + (err.message || err)); } });
  return { view };
})();
