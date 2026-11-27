/* لسان «صحة النظام» في الإدارة (#/admin?t=health): ما طُبّق وما لم يُطبَّق من قاعدة البيانات، وحال المهام الآلية، وطابور الاستيراد، وما يحتاج انتباه المالك الآن.
   كله قراءة فقط: فحص وجود الجداول والأعمدة بالمفتاح العام، وقراءة عامة من واجهة GitHub وملفات data. لا أسرار ولا كتابة. */
const ADMH = (() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const REPO = (typeof CFG !== "undefined" && CFG.repo) || "dawah-library/sdsl-library";
  // [الجدول، العمود المطلوب أو "*"، الترحيل الذي ينشئه، ما يعطّله غيابه]
  const NEED = [
    ["profiles", "role", "schema.sql", "الأدوار والصلاحيات"], ["push_subs", "*", "schema.sql", "إشعارات الجهاز"], ["notifications", "*", "schema.sql", "جرس الإشعارات"],
    ["reading_plans", "remind_at", "schema.sql", "خطط القراءة وتذكيرها"], ["broadcasts", "kind", "2026-11-20-member-notify.sql", "الرسائل العامة بأنواعها"],
    ["group_reads", "remind_on", "2026-11-20-member-notify.sql", "تذكير القراءة الجماعية"], ["group_reads", "week_days", "2026-11-13-roles-audio-groups.sql", "أيام القراءة الجماعية"],
    ["member_prefs", "*", "2026-11-20-member-notify.sql", "تفضيلات إشعارات العضو والاشتراك التلقائي"], ["notify_state", "*", "2026-11-20-member-notify.sql", "حالة خدمة الإشعارات"],
    ["subscribers", "*", "2026-11-20-subscribers.sql", "النشرة البريدية"], ["comparisons", "*", "2026-11-20-comparisons.sql", "مقارنات الكتب"],
    ["hifz_plans", "*", "2026-11-27-hifz.sql", "تذكير ورد الحفظ"], ["hifz_log", "*", "2026-11-27-hifz.sql", "سجل الحفظ"]
  ];
  const ago = t => { const m = Math.round((Date.now() - new Date(t).getTime()) / 6e4); return m < 60 ? m + " د" : m < 2880 ? Math.round(m / 60) + " س" : Math.round(m / 1440) + " يوم" };
  const row = (ok, name, note, link) => `<div class="row" style="gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line,#ddd3)"><span aria-hidden="true">${ok === true ? "✅" : ok === false ? "❌" : "⚠️"}</span><b style="flex:1">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name)}</b><span class="mut">${esc(note)}</span></div>`;
  async function db() {
    const out = []; const sb = typeof Auth !== "undefined" && Auth.sb;
    if (!sb) return { rows: [], bad: 0, note: "قاعدة البيانات غير متصلة في هذه الجلسة" };
    for (const [t, c, f, what] of NEED) {
      let ok = true, why = "";
      try { const { error } = await sb.from(t).select(c).limit(1); if (error) { ok = false; why = /42703|column/i.test(error.code + error.message) ? "عمود ناقص" : /PGRST205|42P01|schema cache|does not exist/i.test(error.code + error.message) ? "جدول ناقص" : (error.code || error.message || "").slice(0, 40); if (!/عمود|جدول/.test(why)) ok = null; } } catch (e) { ok = null; why = "تعذر الفحص" }
      out.push({ t, c, f, what, ok, why });
    }
    return { rows: out, bad: out.filter(x => x.ok === false).length };
  }
  async function runs() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=100`); if (!r.ok) throw 0;
      const L = (await r.json()).workflow_runs || [], by = new Map();
      for (const x of L) if (!by.has(x.name)) by.set(x.name, x);
      return [...by.values()].map(x => {
        const age = (Date.now() - new Date(x.created_at).getTime()) / 6e4;
        let st = x.status === "completed" ? (x.conclusion === "success" ? "ok" : x.conclusion === "cancelled" || x.conclusion === "skipped" ? "warn" : "bad") : (x.status === "queued" && age > 60 ? "bad" : "run");
        return { name: x.name, st, concl: x.conclusion || x.status, at: x.created_at, url: x.html_url, ev: x.event };
      });
    } catch (e) { return null }
  }
  async function queue() {
    try { const r = await fetch("data/turathio-queue.json?t=" + Date.now()); const d = await r.json(); const done = Array.isArray(d.done) ? d.done : Object.keys(d.done || {}); const items = d.items || []; const dn = new Set(done); return { total: items.length, done: items.filter(i => dn.has(i.id)).length, wait: items.filter(i => !dn.has(i.id)).map(i => i.id) } } catch (e) { return null }
  }
  async function render(el) {
    el.innerHTML = '<p class="mut">جارٍ الفحص الحي…</p>';
    const [D, R, Q] = await Promise.all([db(), runs(), queue()]);
    const badRuns = (R || []).filter(x => x.st === "bad"), attn = [];
    if (D.bad) attn.push(`${D.bad} عنصرا ناقصا في قاعدة البيانات (ترحيل لم يُطبَّق)`);
    badRuns.forEach(x => attn.push(`مهمة «${x.name}»: ${x.concl === "queued" ? "عالقة في الطابور" : "فشلت"} منذ ${ago(x.at)}`));
    if (Q && Q.wait.length) attn.push(`${Q.wait.length} كتبا في طابور الاستيراد لم تدخل بعد`);
    const head = attn.length ? `<div class="note warn" role="status"><b>يحتاج انتباهك الآن (${attn.length}):</b><ul style="margin:4px 0 0">${attn.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : '<div class="note" role="status">✅ لا شيء يحتاج انتباهك الآن.</div>';
    const miss = D.rows.filter(x => x.ok === false), files = [...new Set(miss.map(x => x.f))];
    const dbh = `<h3 style="font-size:1rem">قاعدة البيانات (الترحيلات)</h3>${D.note ? `<p class="mut">${esc(D.note)}</p>` : ""}<div class="card">${D.rows.map(x => row(x.ok, x.t + (x.c !== "*" ? "." + x.c : ""), x.ok === true ? x.what : x.what + (x.why ? " (" + x.why + ")" : ""))).join("")}</div>${files.length ? `<p class="mut">الملفات الناقصة في <code>supabase/migrations</code> (أو schema.sql): ${files.map(f => `<code>${esc(f)}</code>`).join("، ")}. افتح <a href="https://github.com/${REPO}/tree/main/supabase/migrations" target="_blank" rel="noopener">المجلد</a> والصق الملف في محرر SQL بلوحة Supabase.</p>` : ""}`;
    const order = { bad: 0, run: 1, warn: 2, ok: 3 }, ico = { ok: "✅", bad: "❌", warn: "⚠️", run: "⏳" };
    const rh = `<h3 style="font-size:1rem">المهام الآلية (آخر تشغيل لكل مهمة)</h3>${R ? `<div class="card">${[...R].sort((a, b) => order[a.st] - order[b.st]).map(x => `<div class="row" style="gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line,#ddd3)"><span aria-hidden="true">${ico[x.st]}</span><a style="flex:1" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a><span class="mut">${esc(x.concl)} · منذ ${ago(x.at)}</span></div>`).join("")}</div><p class="mut"><a href="https://github.com/${REPO}/actions" target="_blank" rel="noopener">كل المهام وتشغيلها يدويا ↗</a> (إعادة تشغيل المهمة العالقة: افتحها ثم Re-run أو ألغها ليبدأ التالي).</p>` : '<p class="mut">تعذر قراءة واجهة GitHub العامة الآن (حد الطلبات). أعد المحاولة بعد قليل.</p>'}`;
    const qh = `<h3 style="font-size:1rem">طابور استيراد الكتب</h3>${Q ? `<div class="card">${row(Q.wait.length ? null : true, `${Q.done} من ${Q.total} دخلت`, Q.wait.length ? "ينتظر: " + Q.wait.slice(0, 8).join("، ") + (Q.wait.length > 8 ? " …" : "") : "لا انتظار")}</div>` : '<p class="mut">تعذر قراءة الطابور.</p>'}`;
    el.innerHTML = head + dbh + rh + qh + '<div class="row"><button class="btn" id="admh-r">↻ إعادة الفحص</button></div>';
    const b = el.querySelector("#admh-r"); if (b) b.onclick = () => render(el);
  }
  return { render };
})();
