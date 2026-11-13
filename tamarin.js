/* تمارين «الأساس» و«البنيان» التفاعلية للطلائع (#/tamarin): أسئلة الكتابين بنصها (tools/tala-ex.py ← data/tala-ex.json)
   مرتبة بالسلسلة والمستوى والدرس، ولكل سؤال رابط درسه. الإجابة لا تُعرض إلا إذا اعتمدها المدير (data/tala-ex-ok.json)؛
   وإلا يرجع الطفل إلى الدرس مع والده. للمدير: الإجابة المقترحة من نص الدرس مع زر «اعتماد» أو تصحيحها. نجوم الطفل على جهازه. */
const TMR = (() => {
  let EX = null, OK = null;
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Math.floor(Date.now() / 300e3);
  const load = async () => { if (!EX) { try { EX = (await (await fetch("data/tala-ex.json")).json()).items || []; } catch (e) { EX = []; } }
    if (!OK) { try { const r = await fetch(RAW("tala-ex-ok.json")); OK = r.ok ? (await r.json()).ok || {} : {}; } catch (e) { OK = {}; } } };
  const QT = q => String(q || "").replace(/\(\s*(?:[✓✗×]|&nbsp[؛;]?\s*)+\s*\)/g, "").trim(); // علامات الإجابة المطبوعة في الكتاب لا تُظهر للطفل
  const key = x => x.b + ":" + x.p + ":" + norm(x.q).slice(0, 40);
  const ans = x => { const k = key(x); return k in OK ? OK[k] : undefined; };
  const SER = { asas: "الأساس (الابتدائية)", bunyan: "البنيان (الإعدادية)" };
  const stars = () => { try { return JSON.parse(localStorage.getItem("tmr_st") || "{}"); } catch (e) { return {}; } };
  // داخل قسم الطلائع، ويُوجَّه الطفل إلى مستواه بعمره (ملف الطفل في «ركن الوالدين»، ما لم يُظهر الوالد المراحل الأخرى)
  const KIDV = { t1: ["asas", [1, 2]], t2: ["asas", [3, 4, 5, 6]], t3: ["bunyan", null], t4: ["bunyan", null] };
  const lockOf = () => { const T = S.tala || {}, k = (T.kids || []).find(x => x.id === T.cur) || (T.kids || [])[0]; return k && !T.allst ? KIDV[k.track] || null : null; };
  async function page(q) {
    await load(); const lk = lockOf(); let s = lk ? lk[0] : (q.s || "asas"), v = +q.v || (lk && lk[1] ? lk[1][0] : 1); const adm = isAdmin();
    if (lk && lk[1] && !lk[1].includes(v)) v = lk[1][0];
    const L = EX.filter(x => x.s === s && x.v === v), lessons = [...new Map(L.map(x => [x.l + "|" + x.lp, [x.l, x.lp]])).values()], ls_ = q.l ? decodeURIComponent(q.l) : null;
    const vols = [...new Set(EX.filter(x => x.s === s).map(x => x.v))].filter(x => !lk || !lk[1] || lk[1].includes(x)).sort((a, b) => a - b), st = stars();
    let body;
    if (!ls_) body = `<div class="grid">${lessons.map(([l, lp]) => { const n = L.filter(x => x.l === l && x.lp === lp).length, k = s + v + l; return `<a class="card" href="#/tamarin?s=${s}&v=${v}&l=${encodeURIComponent(l + "|" + lp)}"><b>${esc(l || "تمارين")}</b><span>${toAr(n)} سؤالًا${st[k] ? " • " + "⭐".repeat(Math.min(3, st[k])) : ""}</span></a>`; }).join("")}</div>`;
    else { const [l, lp] = ls_.split("|"), Q = L.filter(x => x.l === l && String(x.lp) === lp);
      body = `<p><a href="#/tamarin?s=${s}&v=${v}">← دروس المستوى</a> • <a href="#/book/${Q[0] ? Q[0].b : ""}/${lp}">📖 اقرأ الدرس</a></p><h3>${esc(l)}</h3><div class="tmprog" id="tmprog" data-n="${Q.filter(x => x.k === "tf" || x.k === "mcq").length}"><i style="width:0"></i></div>` + Q.map((x, i) => item(x, i, adm)).join("") + `<p class="mut">الإجابة المعتمدة تظهر بعد الاختيار؛ وما لم تُعتمد إجابته بعد فراجع الدرس مع والدك.</p>`; }
    if (typeof TPLAY !== "undefined") TPLAY.font();
    view(`<div class="tala kids"><div class="talah"><a href="#/talaea" class="talab">🌟 الطلائع</a><span class="mut">تمارين الأساس والبنيان</span>${typeof TSFX !== "undefined" ? TSFX.btn() : ""}</div><p><a href="#/talaea">← العودة إلى الطلائع</a></p>
    <h2 class="talat">✏️ تمارين الأساس والبنيان</h2><p>أسئلة كتابي الشيخ مصطفى دياب بحسب المستوى والدرس: اختر، وصحّح العبارة، وأكمل، وأجب؛ مع الرجوع إلى الدرس.</p>
    ${lk ? "" : `<div class="tabs" role="tablist">${Object.entries(SER).map(([k, n]) => `<a role="tab" aria-selected="${k === s}" href="#/tamarin?s=${k}">${n}</a>`).join("")}</div>`}
    <nav class="chips">${vols.map(x => `<a class="chip${x === v ? " on" : ""}" href="#/tamarin?s=${s}&v=${x}">المستوى ${toAr(x)}</a>`).join("")}</nav>${body}</div>`);
  }
  function item(x, i, adm) {
    const a = ans(x), id = "tq" + i, A_ = a === undefined ? "" : String(a);
    const sugg = adm && x.a !== undefined ? `<div class="tmadm mut">مقترح من الدرس: <b>${x.k === "mcq" ? esc(x.o[x.a] || "") : x.a ? "صح" : "خطأ"}</b>${x.why ? " — «" + esc(x.why) + "»" : ""} ${a === undefined ? `<button class="btn s" data-act="tmok" data-k="${esc(key(x))}" data-a="${esc(JSON.stringify(x.a))}">اعتماد</button>` : '<em class="tag">معتمد</em>'}</div>` : "";
    const adminSet = adm && a === undefined && x.a === undefined && (x.k === "mcq" || x.k === "tf") ? `<div class="tmadm mut">حدّد الإجابة الصحيحة ثم اضغط «اعتماد الإجابة المختارة». <button class="btn s" data-act="tmokpick" data-k="${esc(key(x))}" data-i="${i}">اعتماد الإجابة المختارة</button></div>` : "";
    if (x.k === "mcq") return `<div class="tmq" id="${id}" data-a="${A_}"><p>${toAr(i + 1)}. ${esc(QT(x.q))}</p><div class="row">${x.o.map((o, j) => `<button class="btn s tmo" data-act="tmans" data-v="${j}">${esc(o)}</button>`).join("")}</div>${sugg}${adminSet}</div>`;
    if (x.k === "tf") return `<div class="tmq" id="${id}" data-a="${A_}"><p>${toAr(i + 1)}. ${esc(QT(x.q))}</p><div class="row"><button class="btn s tmo" data-act="tmans" data-v="true">✓ صح</button><button class="btn s tmo" data-act="tmans" data-v="false">✗ خطأ</button></div>${sugg}${adminSet}</div>`;
    const show = a !== undefined ? `<details class="tmans"><summary>👀 أظهر الإجابة بعد أن تجيب</summary>${esc(String(a))}</details>` : "";
    return `<div class="tmq open" id="${id}"><p>${toAr(i + 1)}. ${esc(QT(x.q))}</p><textarea rows="2" placeholder="اكتب إجابتك، ثم قارنها بالإجابة"></textarea>${show}</div>`;
  }
  async function saveOk(k, v) {
    try { await GH.editJSON("data/tala-ex-ok.json", o => { o = o || { ok: {} }; o.ok = o.ok || {}; o.ok[k] = v; return o; }, "تمارين الطلائع: اعتماد إجابة"); OK[k] = v; toast("اعتُمدت الإجابة"); } catch (e) { toast("تعذّر: " + (e.message || e)); }
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "tmans") { const box = el.closest(".tmq"), A_ = box.dataset.a; box.querySelectorAll(".tmo").forEach(b => b.classList.remove("pick", "right", "wrong")); el.classList.add("pick");
      if (A_ === "") { let m = box.querySelector(".tmfb"); if (!m) { box.insertAdjacentHTML("beforeend", '<p class="tmfb mut">لم تُعتمد إجابة هذا السؤال بعد؛ راجع الدرس مع والدك.</p>'); } return; }
      const ok = el.dataset.v === A_; el.classList.add(ok ? "right" : "wrong"); if (typeof TSFX !== "undefined") { if (ok) TSFX.right(); else TSFX.wrong(); } if (!ok) box.querySelectorAll(".tmo").forEach(b => { if (b.dataset.v === A_) b.classList.add("right"); });
      const pb = document.getElementById("tmprog"); if (pb) { const n = +pb.dataset.n || 1, d = document.querySelectorAll(".tmq .tmo.pick").length; pb.firstElementChild.style.width = Math.min(100, d / n * 100) + "%"; if (d === n && !pb.dataset.done && typeof TSFX !== "undefined") { pb.dataset.done = 1; setTimeout(() => { TSFX.done(); toast("🎉 " + TSFX.text("done")); }, 700); } }
      if (ok) { const q = parse().q, k = (q.s || "asas") + (q.v || 1) + decodeURIComponent(q.l || "").split("|")[0], st = stars(); st[k] = (st[k] || 0) + 1; try { localStorage.setItem("tmr_st", JSON.stringify(st)); } catch (e2) { } } }
    else if (a === "tmok") saveOk(el.dataset.k, JSON.parse(el.dataset.a));
    else if (a === "tmokpick") { const box = document.getElementById("tq" + el.dataset.i), p = box && box.querySelector(".tmo.pick"); if (!p) return toast("اختر الإجابة أولًا"); const v = p.dataset.v; saveOk(el.dataset.k, v === "true" ? true : v === "false" ? false : +v); } });
  return { view: page };
})();
