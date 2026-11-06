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
