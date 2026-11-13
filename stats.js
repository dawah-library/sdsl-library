/* سجل القراءة وإحصاءات المكتبة (بندا ٦ و٧):
   - READLOG.track: تُسجَّل الصفحة إذا بقي عليها القارئ ٤ ثوانٍ (لا التقليب السريع) عبر الدالة track_read في Supabase:
     تجميع يومي عام لكل مادة (content_daily: فتح وصفحات، بلا هوية)، وللعضو سجله (book_reads: الصفحات المقروءة فعلًا ونسبة الإتمام).
   - #/mine?t=log «سجل قراءتي» للعضو، و#/stats «إحصاءات المكتبة»: الأكثر مشاهدة وتصفحًا وقراءةً وإتمامًا بنسب،
     وللإدارة نشاط الأعضاء؛ وكل إحصاءة تُظهرها الإدارة أو تخفيها من «الخدمات والمفاتيح» (statp_*). */
const READLOG = (() => {
  const opened = new Set(), sent = new Set(); let t = null;
  const rpc = async (fn, args) => {
    try {
      if (Auth.sb && Auth.user) { const { data, error } = await Auth.sb.rpc(fn, args); if (error) throw error; return data; }
      const r = await fetch(CFG.supabaseUrl + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: CFG.supabaseAnonKey, Authorization: "Bearer " + CFG.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  };
  function track(b, k) {
    if (!b || !CFG.supabaseUrl || b.demo) return; clearTimeout(t);
    t = setTimeout(async () => {
      const key = b.id + ":" + k; if (sent.has(key)) return;
      const sw = await swx(); if (sw.track === false) return;
      sent.add(key); const open = !opened.has(b.id); opened.add(b.id);
      rpc("track_read", { bid: b.id, pg: k, total: b.n || (b.pages || []).length || 0, is_open: open });
    }, 4000);
  }
  return { track, rpc };
})();

const STATS = (() => {
  const T = b => b ? (b.setTitle || b.title) : "";
  const pct = (a, n) => n ? Math.min(100, Math.round(a * 100 / n)) : 0;
  const dt = s => s ? new Date(s).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "";
  const csv = rows => rows.map(r => r.map(x => `"${String(x == null ? "" : x).replace(/"/g, '""')}"`).join(",")).join("\n");

  // «سجل قراءتي» في مكتبتي
  async function mine(box) {
    if (!Auth.user) { box.innerHTML = `<p>سجّل الدخول ليُحفظ ما تقرؤه في حسابك. <a href="#/account">الدخول</a></p>`; return; }
    if (!Auth.sb) { box.innerHTML = "<p class='mut'>سجل القراءة يعمل مع حساب المكتبة السحابي.</p>"; return; }
    const { data, error } = await Auth.sb.from("book_reads").select("book_id,total,pages,first_at,last_at,last_page,done_at").eq("user_id", Auth.user.id).order("last_at", { ascending: false }).limit(500);
    if (error) { box.innerHTML = `<p class="note">تعذّر التحميل: ${esc(error.message)}</p>`; return; }
    const l = (data || []).map(r => ({ r, b: B(r.book_id), n: (r.pages || []).length, p: pct((r.pages || []).length, r.total) })).filter(x => x.b);
    const done = l.filter(x => x.r.done_at).length, pages = l.reduce((s, x) => s + x.n, 0);
    box.innerHTML = `<p class="mut">تُسجَّل الصفحة إذا بقيتَ عليها بضع ثوانٍ؛ والكتاب «مكتمل» إذا قرأت ٩٠٪ من صفحاته فأكثر.</p>
    <div class="hsg"><div class="hs"><b>${fmtN(l.length)}</b><span>كتابًا ومقالًا قرأت منه</span></div><div class="hs"><b>${fmtN(pages)}</b><span>صفحة مقروءة</span></div><div class="hs"><b>${fmtN(done)}</b><span>أتممت قراءته</span></div></div>
    ${l.length ? `<div class="row" style="margin:6px 0 10px"><button class="btn s" id="rlcsv">تنزيل السجل (CSV)</button></div>` + l.map(x => `<a class="bk hasc" href="#/book/${x.b.id}/${x.r.last_page || 1}">${coverOf(x.b)}<b>${esc(T(x.b))}${x.r.done_at ? ' <em class="tag">✓ مكتمل</em>' : ""}</b><span>${esc(A(x.b.authorId).name)} • قرأت ${fmtN(x.n)} من ${fmtN(x.r.total)} صفحة (${toAr(x.p)}٪) • آخر قراءة ${esc(dt(x.r.last_at))}${x.r.done_at ? " • أُتم في " + esc(dt(x.r.done_at)) : ""}</span><span><i class="prog" style="--w:${x.p}%"></i></span></a>`).join("") : "<p>لم يُسجَّل شيء بعد. افتح كتابًا واقرأ، ويظهر هنا ما قرأته ونسبته.</p>"}`;
    const c = $("#rlcsv"); if (c) c.onclick = () => dl("سجل-قراءتي.csv", csv([["الكتاب", "المؤلف", "الصفحات المقروءة", "عدد الصفحات", "النسبة", "أول قراءة", "آخر قراءة", "تاريخ الإتمام"]].concat(l.map(x => [T(x.b), A(x.b.authorId).name, x.n, x.r.total, x.p + "%", dt(x.r.first_at), dt(x.r.last_at), dt(x.r.done_at)]))), "text/csv");
  }

  const MET = [["opens", "الأكثر مشاهدة", "مرة فتح", r => r.opens], ["pages", "الأكثر تصفحًا", "صفحة مقروءة", r => r.pages], ["readers", "الأكثر قراءة", "قارئ", r => r.readers], ["pct", "الأكثر إتمامًا للقراءة", "", r => r.avg_pct]];
  async function page(q) {
    const days = /^(7|30|365|0)$/.test(q.d || "") ? +q.d : 30, adm = isAdmin(), sw = await swx(), on = k => adm || sw["statp_" + k] !== false;
    view(`<h2>إحصاءات المكتبة</h2><div class="tabs" role="tablist">${[[7, "أسبوع"], [30, "شهر"], [365, "سنة"], [0, "الكل"]].map(([d, n]) => `<a role="tab" href="#/stats?d=${d}" aria-selected="${d === days}">${n}</a>`).join("")}</div>
    ${adm ? `<p class="note">للإدارة: تظهر لك كل الإحصاءات؛ وما أخفيته من «الإدارة ← الخدمات والمفاتيح» لا يراه الأعضاء (معلَّم «مخفي»).</p>` : ""}
    <div id="sttot"></div><div id="stmain"><p class="mut">جارٍ التحميل…</p></div>${adm ? '<div id="stadm"></div>' : ""}`);
    const [tot, ...tops] = await Promise.all([READLOG.rpc("content_totals", { days })].concat(MET.map(m => READLOG.rpc("top_content", { metric: m[0], days, lim: 15 }))));
    const tt = $("#sttot");
    if (tot && tt && on("totals")) {
      const s = tot.series || [], mx = Math.max(1, ...s.map(x => x[2]));
      tt.innerHTML = `<div class="hsg">${[["visits", "زيارة"], ["opens", "مرة فتح لكتاب أو مقال"], ["pages", "صفحة مقروءة"], ["readers", "عضوًا قرأ"], ["completes", "إتمام قراءة"]].map(([k, l]) => `<div class="hs"><b>${fmtN(tot[k] || 0)}</b><span>${l}</span></div>`).join("")}</div>
      ${s.length > 1 ? `<div class="stbars" role="img" aria-label="الصفحات المقروءة يوميًا">${s.map(x => `<i style="--h:${Math.max(2, Math.round(x[2] * 100 / mx))}%" title="${esc(x[0])}: ${x[2]} صفحة، ${x[1]} فتح"></i>`).join("")}</div><p class="mut" style="text-align:center;font-size:.8rem">الصفحات المقروءة يوميًا</p>` : ""}`;
    }
    const box = $("#stmain"); if (!box) return;
    const blocks = MET.map((m, i) => {
      if (!on(m[0])) return "";
      let rows = (tops[i] || []).map(r => Object.assign(r, { b: B(r.book_id) })).filter(r => r.b && !r.b.hidden);
      if (m[0] === "pct") rows = rows.filter(r => r.readers >= (adm ? 1 : 3) && r.avg_pct != null);
      const val = m[3];
      return `<section class="stsec"><h3>${m[1]}${adm && sw["statp_" + m[0]] === false ? ' <em class="tag">مخفي عن الأعضاء</em>' : ""}</h3>${rows.length ? `<ol class="stl">${rows.slice(0, 10).map(r => `<li><a href="#/book/${r.b.id}/1">${esc(T(r.b))}</a><span class="mut">${esc(A(r.b.authorId).name)}</span><b>${m[0] === "pct" ? toAr(Math.round(r.avg_pct)) + "٪ <small>(" + toAr(r.readers) + " قارئ، " + toAr(r.completes) + " أتم)</small>" : fmtN(val(r)) + " " + m[2]}</b></li>`).join("")}</ol>` : '<p class="mut">لا بيانات كافية بعد في هذه المدة.</p>'}</section>`;
    }).join("");
    box.innerHTML = blocks ? `<div class="stgrid">${blocks}</div><p class="mut" style="font-size:.85rem">«الأكثر مشاهدة»: مرات فتح المادة؛ «الأكثر تصفحًا»: الصفحات التي بقي عليها القراء ثوانيَ؛ «الأكثر قراءة»: عدد الأعضاء القارئين؛ «الأكثر إتمامًا»: متوسط نسبة ما قرأه الأعضاء من صفحات الكتاب.</p>` : '<p class="mut">لا إحصاءات معروضة حاليًا.</p>';
    if (adm) admin($("#stadm"));
  }
  async function admin(el) {
    if (!el || !Auth.sb) return;
    const { data, error } = await Auth.sb.rpc("admin_reads", { lim: 200 });
    if (error) { el.innerHTML = `<p class="mut">سجل الأعضاء: ${esc(error.message)}</p>`; return; }
    const l = (data || []).filter(r => B(r.book_id));
    el.innerHTML = `<h3>سجل قراءة الأعضاء (للإدارة)</h3>${l.length ? `<div class="row" style="margin-bottom:8px"><button class="btn s" id="stcsv">تنزيل (CSV)</button></div><div class="sttab"><table><thead><tr><th>العضو</th><th>الكتاب</th><th>المقروء</th><th>آخر قراءة</th><th>الإتمام</th></tr></thead><tbody>${l.map(r => `<tr><td>${esc(r.name || "—")}</td><td><a href="#/book/${r.book_id}/1">${esc(T(B(r.book_id)))}</a></td><td>${toAr(r.pages)} / ${toAr(r.total)} (${toAr(pct(r.pages, r.total))}٪)</td><td>${esc(dt(r.last_at))}</td><td>${r.done_at ? "✓ " + esc(dt(r.done_at)) : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="mut">لا قراءات مسجلة بعد.</p>'}`;
    const c = $("#stcsv"); if (c) c.onclick = () => dl("سجل-قراءة-الأعضاء.csv", csv([["العضو", "الكتاب", "المقروء", "عدد الصفحات", "آخر قراءة", "تاريخ الإتمام"]].concat(l.map(r => [r.name, T(B(r.book_id)), r.pages, r.total, dt(r.last_at), dt(r.done_at)]))), "text/csv");
  }
  return { view: page, mine };
})();

/* لوحة متابعة القراءة الشخصية (الصفحة الرئيسية) ومؤشر الإنجاز في القارئ:
   - وقت القراءة الفعلي: يُحسب كل ١٥ ثانية ما دامت صفحة الكتاب ظاهرة والقارئ نشطًا (حركة أو تمرير أو لمس خلال دقيقتين).
   - الصفحات المقروءة وآخر موضع لكل كتاب على الجهاز (rd_v1)، وتُدمج مع سجل الحساب السحابي (book_reads) عند الدخول.
   - الإتمام عند قراءة ٩٠٪ من الصفحات أو بلوغ آخر صفحة. الأيام بتوقيت مكة (MKT.day). */
const RDASH = (() => {
  const K = "rd_v1"; let D = null, act = Date.now(), cur = null, msg = {};
  const ld = () => { if (D) return D; try { D = JSON.parse(localStorage.getItem(K) || "null"); } catch (e) { } D = D && D.v === 1 ? D : { v: 1, b: {}, day: {} }; return D; };
  const sv = () => { try { localStorage.setItem(K, JSON.stringify(D)); } catch (e) { } };
  const rec = id => { const d = ld(); return d.b[id] = d.b[id] || { t: 0, pg: 1, s: [], n: 0, at: 0 }; };
  ["mousemove", "keydown", "scroll", "touchstart", "click"].forEach(ev => addEventListener(ev, () => act = Date.now(), { passive: true }));
  setInterval(() => {
    const m = location.hash.match(/^#\/book\/([^/?]+)/); if (!m || document.hidden || Date.now() - act > 120e3) return;
    const r = rec(m[1]), d = ld(), day = MKT.day(); r.t += 15; r.at = Date.now(); d.day[day] = (d.day[day] || 0) + 15;
    const ks = Object.keys(d.day).sort(); while (ks.length > 120) delete d.day[ks.shift()]; sv();
  }, 15e3);
  const nPages = b => b ? (b.n || (b.pages || []).length || 0) : 0;
  function page(b, k) {
    if (!b) return; const r = rec(b.id); cur = b.id; r.pg = k; r.n = nPages(b) || r.n; r.at = Date.now();
    if (!r.s.includes(k)) { r.s.push(k); if (r.s.length > 6000) r.s = r.s.slice(-6000); }
    if (!r.done && r.n > 2 && (r.s.length >= r.n * .9 || k >= r.n)) { r.done = MKT.day(); setTimeout(() => toast("🎉 مبارك! أتممت قراءة «" + (b.setTitle || b.title) + "» — زادك الله علمًا"), 600); }
    sv(); badge(b, k); if (typeof BTABS !== "undefined") BTABS.touch(b, k);
  }
  const pct = r => r.done ? 100 : r.n ? Math.min(99, Math.round(Math.max(r.s.length, 0) * 100 / r.n)) : 0;
  const posPct = (k, n) => n > 1 ? Math.round(k * 100 / n) : 0;
  const CHEER = [[25, "بداية موفقة! قطعت ربع الكتاب 🌱"], [50, "ما شاء الله! تجاوزت نصف الكتاب 💪"], [75, "رائع! بقي الربع الأخير ⭐"], [90, "اقتربت من الختام، واصل! 🏁"]];
  function badge(b, k) {
    const n = nPages(b); let el = document.getElementById("rpct"); if (n < 3) { if (el) el.hidden = true; return; }
    if (!el) { document.body.insertAdjacentHTML("beforeend", '<div id="rpct" role="status" aria-live="polite"></div>'); el = document.getElementById("rpct"); }
    const p = posPct(k, n), r = rec(b.id), left = Math.max(0, n - k);
    el.hidden = false; el.innerHTML = `<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="bg"/><circle cx="18" cy="18" r="15.5" class="fg" style="stroke-dasharray:${p * .974} 100"/></svg><b>${toAr(p)}٪</b><span>${left ? "بقي " + toAr(left) + " صفحة" : "الصفحة الأخيرة 🎉"}${r.t >= 60 ? " • " + dur(r.t) : ""}</span>`;
    const c = CHEER.filter(x => p >= x[0]).pop(); if (c && msg[b.id] !== c[0]) { const first = msg[b.id] === undefined; msg[b.id] = c[0]; if (!first) toast(c[1]); }
  }
  const dur = s => !s ? "٠ دقيقة" : s >= 3600 ? toAr((s / 3600).toFixed(s >= 36000 ? 0 : 1)) + " ساعة" : toAr(Math.max(1, Math.round(s / 60))) + " دقيقة";
  async function home(box) {
    if (!box) return; const d = ld(); let rows = Object.entries(d.b).map(([id, r]) => ({ id, r, b: B(id) })).filter(x => x.b);
    if (typeof Auth !== "undefined" && Auth.user && Auth.sb) { try { const { data } = await Auth.sb.from("book_reads").select("book_id,total,pages,last_page,last_at,done_at").eq("user_id", Auth.user.id).order("last_at", { ascending: false }).limit(300);
      (data || []).forEach(x => { const b = B(x.book_id); if (!b) return; let o = rows.find(y => y.id === x.book_id); if (!o) { o = { id: x.book_id, b, r: { t: 0, pg: x.last_page || 1, s: [], n: x.total || 0, at: +new Date(x.last_at) } }; rows.push(o); }
        const s = new Set(o.r.s.concat(x.pages || [])); o.r.s = [...s]; o.r.n = o.r.n || x.total; if (x.done_at && !o.r.done) o.r.done = MKT.day(x.done_at); if (+new Date(x.last_at) > o.r.at) { o.r.at = +new Date(x.last_at); o.r.pg = x.last_page || o.r.pg; } }); } catch (e) { } }
    if (!rows.length) { box.innerHTML = ""; return; }
    const tot = rows.reduce((s, x) => s + (x.r.t || 0), 0), done = rows.filter(x => x.r.done).length, wk = Object.entries(d.day).filter(([k]) => k >= MKT.day(Date.now() - 6 * 864e5)).reduce((s, [, v]) => s + v, 0);
    const prog = rows.filter(x => !x.r.done).sort((a, b) => b.r.at - a.r.at).slice(0, 6), days = [...Array(7)].map((_, i) => MKT.day(Date.now() - (6 - i) * 864e5)), mx = Math.max(60, ...days.map(k => d.day[k] || 0));
    box.innerHTML = `<section class="rdash" aria-label="لوحة قراءتي"><div class="rdh"><h2>📊 لوحة قراءتي</h2><a class="mut" href="#/mine?t=log">السجل كاملًا</a></div>
      <div class="hsg"><div class="hs"><b>${tot >= 3600 ? toAr((tot / 3600).toFixed(1)) : toAr(Math.round(tot / 60))}</b><span>${tot >= 3600 ? "ساعة" : "دقيقة"} قراءة فعلية</span></div><div class="hs"><b>${toAr(done)}</b><span>كتابًا أتممت قراءته</span></div><div class="hs"><b>${toAr(rows.length - done)}</b><span>كتابًا قيد القراءة</span></div><div class="hs"><b>${dur(wk)}</b><span>هذا الأسبوع</span></div></div>
      <div class="rdwk" aria-label="دقائق القراءة في الأيام السبعة الأخيرة">${days.map(k => `<i style="--h:${Math.round((d.day[k] || 0) / mx * 100)}%" title="${new Date(k + "T12:00:00+03:00").toLocaleDateString("ar-EG", { weekday: "long" })}: ${dur(d.day[k] || 0)}"><em>${new Date(k + "T12:00:00+03:00").toLocaleDateString("ar-EG", { weekday: "narrow" })}</em></i>`).join("")}</div>
      ${prog.length ? `<div class="rdl">${prog.map(x => { const p = pct(x.r); return `<a class="rdb" href="#/book/${x.id}/${x.r.pg || 1}"><span class="rdring" style="--p:${p}"><b>${toAr(p)}٪</b></span><span><b>${esc(x.b.setTitle || x.b.title)}</b><small>${esc(A(x.b.authorId).name)} • توقفت عند ص ${toAr(x.r.pg || 1)}${x.r.n ? " من " + toAr(x.r.n) : ""}${x.r.t >= 60 ? " • " + dur(x.r.t) : ""}</small><em class="rdbar"><i style="width:${p}%"></i></em></span><span class="btn s p">أكمل ←</span></a>`; }).join("")}</div>` : `<p class="mut">أتممت كل ما بدأته — اختر كتابك التالي من <a href="#/library">المكتبة</a>.</p>`}</section>`;
  }
  return { page, home, pct };
})();

/* الكتب المفتوحة (تبويبات داخل القارئ): كل كتاب تفتحه يُضاف إلى شريط أعلى القارئ، فتنتقل بينها دون إغلاق كتاب أو فتح تبويب جديد في المتصفح،
   ولكل كتاب موضع قراءته مستقلًّا (S.lastBy)؛ ويُغلق التبويب بزر ×. تُحفظ القائمة على الجهاز (حتى ١٠ كتب). */
const BTABS = (() => {
  const K = "btabs_v1"; let L = null;
  const ld = () => { if (L) return L; try { L = JSON.parse(localStorage.getItem(K) || "[]"); } catch (e) { L = []; } return L; };
  const sv = () => { try { localStorage.setItem(K, JSON.stringify(L)); } catch (e) { } };
  function touch(b, p) { if (!b || b.demo) return; ld(); const i = L.findIndex(x => x.id === b.id); if (i >= 0) L[i].p = p; else { L.push({ id: b.id, p }); if (L.length > 10) L.shift(); } sv(); paint(b.id); }
  function paint(cur) { let el = document.getElementById("btabs"); const l = ld().filter(x => B(x.id));
    if (l.length < 2 || !document.body.classList.contains("reading")) { if (el) el.hidden = true; return; }
    if (!el) { document.body.insertAdjacentHTML("beforeend", '<div id="btabs" class="btabs" role="navigation" aria-label="الكتب المفتوحة"></div>'); el = document.getElementById("btabs"); }
    el.hidden = false; el.innerHTML = `<button class="btabt" data-act="btabsx" aria-expanded="false" title="الكتب المفتوحة">📚 <b>${toAr(l.length)}</b></button><div class="btabl">${l.map(x => { const b = B(x.id); return `<span class="obtab${x.id === cur ? " on" : ""}"><a href="#/book/${x.id}/${(S.lastBy && S.lastBy[x.id]) || x.p || 1}" title="${esc(b.setTitle || b.title)}">${esc((b.setTitle || b.title).slice(0, 28))}</a><button data-act="btabc" data-id="${x.id}" aria-label="إغلاق">×</button></span>`; }).join("")}</div>`; }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act^=btab]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "btabc") { L = ld().filter(x => x.id !== el.dataset.id); sv(); const m = location.pathname.match(/book\/([^/]+)/); if (m && m[1] === el.dataset.id && L.length) { const n = L[L.length - 1]; location.hash = "#/book/" + n.id + "/" + ((S.lastBy && S.lastBy[n.id]) || n.p || 1); } else paint(m && m[1]); }
    else { const n = document.getElementById("btabs"); n.classList.toggle("open"); el.setAttribute("aria-expanded", n.classList.contains("open")); } });
  addEventListener("popstate", () => setTimeout(() => { const m = location.pathname.match(/book\/([^/]+)/); paint(m && m[1]); }, 50));
  addEventListener("hashchange", () => setTimeout(() => { const m = location.pathname.match(/book\/([^/]+)/); paint(m && m[1]); }, 50));
  return { touch, paint };
})();

/* «جديد المكتبة»: شاشة تعريف بالخدمات الجديدة تظهر مرة واحدة لكل إصدار (data/whatsnew.json). */
(() => { setTimeout(async () => { let W = null; try { W = await (await fetch("data/whatsnew.json")).json(); } catch (e) { return; } if (!W || !W.v) return;
  let seen = ""; try { seen = localStorage.getItem("wn_seen") || ""; } catch (e) { } if (seen === W.v) return;
  if (!seen) { try { localStorage.setItem("wn_seen", W.v); } catch (e) { } return; }  // الزائر الأول لا تُعرض له
  document.body.insertAdjacentHTML("beforeend", `<div id="wnew" class="wnew" role="dialog" aria-label="${esc(W.title)}"><div class="wnbox"><img src="assets/logo-sdsl-128.png" alt="" width="84" height="84"><h2>${esc(W.title)}</h2>${W.items.map(([i, t, d]) => `<div class="wni"><span>${i}</span><p><b>${esc(t)}؛</b> ${esc(d)}</p></div>`).join("")}<button class="btn p" id="wnok">ابدأ</button></div></div>`);
  document.getElementById("wnok").onclick = () => { try { localStorage.setItem("wn_seen", W.v); } catch (e) { } document.getElementById("wnew").remove(); }; }, 2500); })();
