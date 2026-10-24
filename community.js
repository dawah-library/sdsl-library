/* مجتمع المكتبة: متصفح تواصل داخل الموقع لمختارات الأعضاء من الكتب.
   التفاعلات (أعجبني، أحببته، جزاه الله خيرًا، فائدة، مدهش، محزن)، والتعليقات والردود، والمشاركة والحفظ والتصدير بصيغ متعددة،
   مع صلاحيات واسعة للإدارة: معايير المجتمع، والمراجعة قبل النشر، والإخفاء والتثبيت والحذف، وإيقاف العضو عن النشر أو المشاركة، والبلاغات.
   يعمل فوق app.js وsocial.js ويحتاج قاعدة الحسابات (Supabase). */
const CM_RULES_DEFAULT = `مجتمع المكتبة مساحة لتبادل الفوائد من كتب المكتبة، وشرط النشر فيه:
١. النشر مقصور على المختارات من كتب المكتبة بنصها وتوثيقها، ولا يُقبل الكلام الشخصي في المنشورات.
٢. التعليق بأدب العلم: لا سبّ ولا طعن ولا تجريح للأشخاص والهيئات، ولا جدال بغير علم.
٣. لا روابط دعائية، ولا تكرار للمنشور نفسه، ولا إغراق.
٤. الأمانة في النقل: لا يُقتطع النص بما يغيّر مراد المؤلف.
٥. للإدارة إخفاء ما يخالف هذه المعايير، وإيقاف المخالف عن النشر أو المشاركة مؤقتًا أو دائمًا.
٦. إن رأيت مخالفة فاستعمل «إبلاغ الإدارة» من قائمة المنشور (⋯).`;
const CM = {
  set: null,
  async settings(force) {
    if (this.set && !force) return this.set;
    const o = { rules: CM_RULES_DEFAULT, premod: false, closed: false };
    if (Members.on()) { try { const { data } = await Auth.sb.from("app_settings").select("key,value").in("key", ["community_rules", "community_open"]); (data || []).forEach(r => { if (r.key === "community_rules" && r.value && r.value.text) o.rules = r.value.text; if (r.key === "community_open" && r.value) { o.premod = !!r.value.premod; o.closed = !!r.value.closed; } }); } catch (e) { } }
    return (this.set = o);
  },
  async saveSetting(key, value) { const { error } = await Auth.sb.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }); if (error) throw new Error(error.message); this.set = null; },
  async myBan() { if (!Auth.user || !Members.on()) return null; const { data } = await Auth.sb.from("community_bans").select("*").eq("user_id", Auth.user.id).maybeSingle(); return data && (!data.until || Date.parse(data.until) > Date.now()) ? data : null; },
  async byIds(ids) { ids = ids.filter(x => /^m\d+$/.test(x)); if (!ids.length) return []; const { data } = await Auth.sb.from("member_posts").select("id,user_id,user_name,body,quote,created_at,hidden,pinned,hidden_reason").in("id", ids.map(x => +x.slice(1))); const m = new Map((data || []).map(r => ["m" + r.id, Members.toPost(r)])); return ids.map(i => m.get(i)).filter(Boolean); },
  async update(x, patch) { const { error } = await Auth.sb.from("member_posts").update(patch).eq("id", x.mid); if (error) throw new Error(error.message); Object.assign(x, { hidden: patch.hidden != null ? patch.hidden : x.hidden, pinned: patch.pinned != null ? patch.pinned : x.pinned }); },
  async notifyUser(uid, title, body, url) { try { await Auth.sb.from("notifications").insert({ user_id: uid, title, body: body || null, url: url || "#/community" }); } catch (e) { } }
};
const fmtDT = d => { try { return new Date(d).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(d || ""); } };

async function vCommunity(q) {
  const k = q.k || "", staff = Cloud.staff();
  document.body.classList.toggle("cm-admin", staff && k === "admin");
  if (!Members.on()) return view(`<h2>مجتمع المكتبة</h2><p class="note">مجتمع المكتبة يحتاج تفعيل قاعدة الحسابات.</p>`);
  const tabs = [["", "الأحدث"], ["top", "الأكثر تفاعلًا"], ["follow", "متابَعاتي"], ["saved", "محفوظاتي"], ["mine", "منشوراتي"], ["rules", "معايير المجتمع"]].concat(staff ? [["admin", "🛡 المراقبة"], ["reports", "🚩 البلاغات"], ["bans", "⛔ الموقوفون"]] : []);
  const set = await CM.settings(), ban = await CM.myBan();
  view(`<div class="cmhero"><div><h2>مجتمع المكتبة</h2><p>مختارات الأعضاء من كتب المكتبة: تفاعل وعلّق وشارك واحفظ وصدّر فوائدك. النشر مقصور على نصوص الكتب بتوثيقها.</p></div>
  <div class="row">${Auth.user ? `${set.closed && !staff ? "" : `<button class="btn p" data-act="compose">✍️ انشر مختارة</button>`}<a class="btn" href="#/member/${Auth.user.id}">صفحتي</a><button class="btn" data-act="cmexport">⇩ تصدير</button><a class="btn" href="#/messages">مراسلة الإدارة</a>` : `<a class="btn p" href="#/account?m=signup&next=%23%2Fcommunity">انضم إلى المجتمع</a><a class="btn" href="#/account?next=%23%2Fcommunity">لدي حساب</a>`}</div></div>
  ${ban ? `<p class="note warnbox">⛔ أوقفت إدارة المكتبة ${ban.scope === "all" ? "مشاركتك (النشر والتعليق)" : "النشر من حسابك"}${ban.until ? " حتى " + esc(fmtDT(ban.until)) : ""}${ban.reason ? ": " + esc(ban.reason) : "."} يمكنك <a href="#/messages">مراسلة الإدارة</a>.</p>` : ""}
  ${set.closed ? `<p class="note">النشر في المجتمع متوقف مؤقتًا بقرار الإدارة، والتصفح والتفاعل متاحان.</p>` : set.premod && !staff ? `<p class="mut">تُراجع الإدارة المنشورات الجديدة قبل ظهورها للجميع.</p>` : ""}
  <div class="tabs" role="tablist">${tabs.map(([v, l]) => `<a role="tab" aria-selected="${k === v}" href="#/community${v ? "?k=" + v : ""}">${l}</a>`).join("")}</div>
  <div id="cmtop"></div><div id="feed" class="feed"></div><div id="feedEnd" class="mut feedend">جارٍ التحميل…</div>`);
  const end = $("#feedEnd"), top = $("#cmtop");
  try {
    let list = [];
    if (k === "rules") { end.textContent = ""; return cmRules(top, set, staff); }
    if (k === "reports") { if (!staff) return; end.textContent = ""; return cmReports(top); }
    if (k === "bans") { if (!staff) return; end.textContent = ""; return cmBans(top); }
    if (k === "saved" || k === "mine" || k === "follow") { if (!Auth.user) { end.innerHTML = `<a href="#/account?next=${encodeURIComponent("#/community?k=" + k)}">سجّل الدخول</a> لترى ${k === "saved" ? "محفوظاتك" : k === "mine" ? "منشوراتك" : "منشورات من تتابعهم"}.`; return; } }
    if (k === "saved") list = await CM.byIds(await Social.savedIds());
    else if (k === "mine") list = await Members.posts({ uid: Auth.user.id, limit: 500 });
    else if (k === "follow") { const fs = await Members.myFollows(), uids = [...fs].filter(x => x[0] === "u").map(x => x.slice(2)); top.innerHTML = await followingStrip(); if (!uids.length) { end.innerHTML = "لا تتابع أحدًا من الأعضاء بعد. افتح صفحة عضو واضغط «متابعة»."; return; } list = await Members.posts({ uids, limit: 200 }); }
    else if (k === "top") { const since = new Date(Date.now() - 30 * 864e5).toISOString(); list = await Members.posts({ since, limit: 300, visible: true }); const st = await Social.state(list.map(x => x.id)); const sc = x => { const s = st.stats[x.id] || {}; return (s.likes || 0) + 2 * (s.comments || 0); }; list.sort((a, b) => sc(b) - sc(a)); top.innerHTML = '<p class="mut">أكثر مختارات الأعضاء تفاعلًا في آخر ثلاثين يومًا.</p>'; }
    else if (k === "admin") { list = await Members.posts({ limit: 300 }); await cmAdminHead(top, list); }
    else { list = await Members.posts({ limit: 200 }); list.sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date))); }
    window.__cmList = list;
    Object.assign(FEED, { list, pos: 0, busy: false }); if (FEED.obs) FEED.obs.disconnect();
    if (!list.length) { end.innerHTML = k === "" ? `لا توجد منشورات بعد. كن أول من ينشر: افتح كتابًا، وحدّد فقرة، ثم «انشر مختارة».` : "لا يوجد ما يُعرض هنا بعد."; return; }
    if ("IntersectionObserver" in window) { FEED.obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) feedMore(); }, { rootMargin: "700px" }); FEED.obs.observe(end); }
    feedMore();
  } catch (e) { end.innerHTML = `<p class="note">${esc(e.message)}</p>`; }
}

/* شريط الإشراف داخل بطاقة المنشور (يظهر للمشرفين في تبويب المراقبة) */
function cmModBar(x) {
  return `<div class="cmmod" data-id="${esc(x.id)}">${x.hidden ? `<button class="btn s p" data-act="cmhide" data-on="0">${/مراجعة/.test(x.hreason || "") ? "✓ قبول ونشر" : "إظهار"}</button>` : `<button class="btn s" data-act="cmhide" data-on="1">إخفاء</button>`}<button class="btn s" data-act="cmpin">${x.pinned ? "إلغاء التثبيت" : "📌 تثبيت"}</button><button class="btn s" data-act="cmban" data-uid="${esc(x.uid)}" data-name="${esc(x.name)}">⛔ إيقاف العضو</button><button class="btn s danger" data-act="pdel" data-id="${esc(x.id)}">حذف</button>${x.hreason ? `<span class="mut">${esc(x.hreason)}</span>` : ""}</div>`;
}
/* خيارات إضافية في قائمة المنشور (⋯) */
function cmMenu(x) {
  const me = Auth.user && x.uid === Auth.user.id;
  if (Cloud.staff()) return `<button data-act="cmhide" data-id="${esc(x.id)}" data-on="${x.hidden ? 0 : 1}">${x.hidden ? "إظهار المنشور" : "إخفاء المنشور"}</button><button data-act="cmpin" data-id="${esc(x.id)}">${x.pinned ? "إلغاء التثبيت" : "📌 تثبيت في أعلى المجتمع"}</button>${me ? "" : `<button data-act="cmban" data-uid="${esc(x.uid)}" data-name="${esc(x.name)}">⛔ إيقاف العضو عن النشر</button>`}<button data-act="cmexp1" data-id="${esc(x.id)}">تصدير المنشور</button>`;
  return `${me ? "" : `<button data-act="cmreport" data-id="${esc(x.id)}">🚩 إبلاغ الإدارة</button>`}<button data-act="cmexp1" data-id="${esc(x.id)}">تصدير المنشور</button>`;
}

async function cmAdminHead(top, list) {
  const seen = ls.get("cm_seen", ""), day = new Date(Date.now() - 864e5).toISOString();
  const [rep, bans] = await Promise.all([Auth.sb.from("post_reports").select("id", { count: "exact", head: true }).eq("status", "open"), Auth.sb.from("community_bans").select("user_id", { count: "exact", head: true })]);
  const fresh = list.filter(x => seen && x.date > seen).length, pend = list.filter(x => x.hidden && /مراجعة/.test(x.hreason || "")).length, set = await CM.settings();
  top.innerHTML = `<div class="cmstats"><a><b>${toAr(list.filter(x => x.date > day).length)}</b><span>منشور في ٢٤ ساعة</span></a><a><b>${toAr(fresh)}</b><span>جديد منذ آخر زيارة</span></a><a${pend ? ' class="hot"' : ""}><b>${toAr(pend)}</b><span>بانتظار المراجعة</span></a><a href="#/community?k=reports"${rep.count ? ' class="hot"' : ""}><b>${toAr(rep.count || 0)}</b><span>بلاغ مفتوح</span></a><a href="#/community?k=bans"><b>${toAr(bans.count || 0)}</b><span>عضو موقوف</span></a></div>
  <div class="card cmset"><b>إعدادات المجتمع</b><label class="chk"><input type="checkbox" data-act="cmopt" data-k="premod" ${set.premod ? "checked" : ""}> مراجعة المنشورات الجديدة قبل ظهورها للأعضاء</label><label class="chk"><input type="checkbox" data-act="cmopt" data-k="closed" ${set.closed ? "checked" : ""}> إيقاف النشر في المجتمع مؤقتًا</label><a class="btn s" href="#/community?k=rules">تعديل معايير المجتمع</a></div>
  <p class="mut">كل منشورات الأعضاء، ومنها المخفية. ${seen ? "المنشورات الجديدة منذ آخر زيارة معلّمة بإطار." : ""}</p>`;
  window.__cmSeen = seen; ls.set("cm_seen", new Date().toISOString());
}

async function cmRules(top, set, staff) {
  top.innerHTML = `<div class="card cmrules"><h3>معايير مجتمع المكتبة</h3>${staff && isAdmin() ? `<form data-form="cmrules"><textarea name="t" style="min-height:260px">${esc(set.rules)}</textarea><button class="btn p" style="margin-top:8px">حفظ المعايير</button> <span class="mut">تظهر للأعضاء هنا وعند النشر.</span></form>` : `<div class="rulestx">${esc(set.rules).replace(/\n/g, "<br>")}</div>`}</div>`;
}

async function cmReports(top) {
  const { data, error } = await Auth.sb.from("post_reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100);
  if (error) { top.innerHTML = `<p class="note">${esc(error.message)}</p>`; return; }
  const posts = await CM.byIds([...new Set((data || []).map(r => r.post_id))]), pm = new Map(posts.map(p => [p.id, p]));
  const g = {}; (data || []).forEach(r => (g[r.post_id] = g[r.post_id] || []).push(r));
  top.innerHTML = Object.entries(g).map(([pid, rs]) => { const x = pm.get(pid); return `<div class="card cmrep" data-pid="${esc(pid)}"><b>🚩 ${toAr(rs.length)} ${rs.length > 1 ? "بلاغات" : "بلاغ"}</b><ul>${rs.map(r => `<li>${esc(r.reason)} <span class="mut">• ${esc(ago(r.created_at))}</span></li>`).join("")}</ul>
   ${x ? `<p class="mut">المنشور من <a href="#/member/${x.uid}">${esc(x.name)}</a>${x.hidden ? " • مخفي" : ""}</p>${quoteHtml(x.quote)}<div class="row" style="margin-top:8px">${x.hidden ? "" : `<button class="btn s p" data-act="cmrephide">إخفاء المنشور</button>`}<button class="btn s" data-act="cmban" data-uid="${esc(x.uid)}" data-name="${esc(x.name)}">⛔ إيقاف العضو</button><a class="btn s" href="#/post/${esc(pid)}">فتح المنشور</a><button class="btn s" data-act="cmrepdone">تم (إغلاق البلاغ)</button></div>` : `<p class="mut">المنشور محذوف.</p><button class="btn s" data-act="cmrepdone">إغلاق البلاغ</button>`}</div>`; }).join("") || '<p class="mut">لا بلاغات مفتوحة. الحمد لله.</p>';
}

async function cmBans(top) {
  const { data, error } = await Auth.sb.from("community_bans").select("*").order("created_at", { ascending: false });
  if (error) { top.innerHTML = `<p class="note">${esc(error.message)}</p>`; return; }
  top.innerHTML = `<p class="mut">لإيقاف عضو: افتح قائمة أي منشور له (⋯) أو تبويب «المراقبة»، واضغط «إيقاف العضو».</p>` + ((data || []).map(b => { const live = !b.until || Date.parse(b.until) > Date.now(); return `<div class="card cmban"><b><a href="#/member/${b.user_id}">${esc(b.user_name || "عضو")}</a></b> <span class="mut">${b.scope === "all" ? "موقوف عن النشر والتعليق" : "موقوف عن النشر"} • ${b.until ? (live ? "حتى " : "انتهى في ") + esc(fmtDT(b.until)) : "دائم"}</span>${b.reason ? `<p>${esc(b.reason)}</p>` : ""}<div class="row"><button class="btn s p" data-act="cmunban" data-uid="${b.user_id}">رفع الإيقاف</button><button class="btn s" data-act="cmban" data-uid="${b.user_id}" data-name="${esc(b.user_name || "")}">تعديل</button></div></div>`; }).join("") || '<p class="mut">لا يوجد أعضاء موقوفون.</p>');
}

function cmBanDlg(uid, name) {
  openDlg(`<h3>إيقاف العضو: ${esc(name || "عضو")}</h3><form data-form="cmban" data-uid="${esc(uid)}" data-name="${esc(name || "")}">
  <label>نوع الإيقاف</label><select name="scope"><option value="post">عن النشر فقط (يبقى له التعليق والتفاعل)</option><option value="all">عن النشر والتعليق</option></select>
  <label>المدة</label><select name="d"><option value="1">يوم واحد</option><option value="3">ثلاثة أيام</option><option value="7" selected>أسبوع</option><option value="30">شهر</option><option value="0">دائم حتى ترفعه الإدارة</option></select>
  <label>السبب (يظهر للعضو)</label><input name="r" maxlength="200" placeholder="مثال: نشر كلام شخصي خلاف معايير المجتمع">
  <label class="chk"><input type="checkbox" name="hideall"> إخفاء كل منشوراته الحالية أيضًا</label>
  <button class="btn p danger" style="margin-top:8px">تنفيذ الإيقاف</button></form>`);
}
function cmReportDlg(id) {
  if (!Auth.user) return needLogin("الإبلاغ متاح للأعضاء المسجلين.");
  const rs = ["كلام شخصي لا يوافق شرط النشر", "نص محرّف أو منسوب إلى غير قائله", "إساءة أو خروج عن أدب العلم", "تكرار أو إغراق", "مخالفة أخرى"];
  closeSheet(); openDlg(`<h3>إبلاغ الإدارة عن منشور</h3><p class="mut">يصل البلاغ إلى المشرفين وحدهم، ولا يُذكر اسمك لصاحب المنشور.</p><form data-form="cmreport" data-id="${esc(id)}">${rs.map((r, i) => `<label class="chk"><input type="radio" name="r" value="${esc(r)}" ${i ? "" : "checked"}> ${esc(r)}</label>`).join("")}<label>تفصيل (اختياري)</label><input name="d" maxlength="300"><button class="btn p" style="margin-top:8px">إرسال البلاغ</button></form>`);
}

/* التصدير بصيغ متعددة */
function cmExportDlg(list, label) {
  window.__cmExp = { list, label };
  openDlg(`<h3>تصدير ${esc(label)}</h3><p class="mut">${toAr(list.length)} منشور، بنصوصها وتوثيقها (الكتاب والمؤلف والصفحة) واسم ناشرها وتاريخه.</p><div class="tools-grid">
  <button data-act="cmexpf" data-f="doc">ملف Word</button><button data-act="cmexpf" data-f="pdf">PDF (طباعة)</button><button data-act="cmexpf" data-f="txt">نص عادي</button><button data-act="cmexpf" data-f="md">Markdown</button><button data-act="cmexpf" data-f="json">JSON (بيانات)</button><button data-act="cmexpf" data-f="csv">جدول CSV</button></div><label class="chk" style="margin-top:10px"><input type="checkbox" id="cmtash" ${S.tash ? "checked" : ""}> بالتشكيل (إن وُجد في النص)</label>`);
}
function cmRef(q) { return q ? `${q.title || ""}${q.au ? "، " + q.au : ""}${q.pl ? "، " + q.pl : q.p ? "، ص " + q.p : ""}` : ""; }
function cmLink(x) { return (typeof siteLink === "function" && siteLink("#/post/" + x.id)) || location.origin + "/post/" + x.id; }
async function cmExportAs(f) {
  const ex = window.__cmExp || {}, label = ex.label, keep = !$("#cmtash") || $("#cmtash").checked; if (!ex.list || !ex.list.length) return;
  const T = t => keep ? t : strip(t || ""), list = ex.list.map(x => Object.assign({}, x, { text: T(x.text), quote: x.quote ? Object.assign({}, x.quote, { t: T(x.quote.t) }) : x.quote }));
  const name = (label || "مجتمع المكتبة").replace(/[\\/:*?"<>|]/g, "");
  const H = s => esc(s || "");
  if (f === "txt") return dl(name + ".txt", postsToText(list).replace(/«([^»]*)»/g, (m, t) => "«" + T(t) + "»"), "text/plain");
  if (f === "md") return dl(name + ".md", `# ${label}\n\n` + list.map(x => `> ${(x.quote && x.quote.t || x.text || "").replace(/\n/g, "\n> ")}\n\n— ${cmRef(x.quote)}\n\n*${pName(x)} • ${fmtDate(x.date)}* — [الرابط](${cmLink(x)})`).join("\n\n---\n\n") + `\n\n${SITENAME}\n`, "text/markdown");
  if (f === "json") return dl(name + ".json", JSON.stringify({ source: SITENAME, exported: new Date().toISOString(), items: list.map(x => ({ id: x.id, by: pName(x), date: x.date, text: x.quote ? x.quote.t : x.text, book: x.quote && x.quote.title, author: x.quote && x.quote.au, page: x.quote && (x.quote.pl || x.quote.p), link: cmLink(x) })) }, null, 2), "application/json");
  if (f === "csv") { const c = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`; return dl(name + ".csv", ["النص,الكتاب,المؤلف,الصفحة,الناشر,التاريخ,الرابط"].concat(list.map(x => [x.quote ? x.quote.t : x.text, x.quote && x.quote.title, x.quote && x.quote.au, x.quote && (x.quote.pl || x.quote.p), pName(x), fmtDate(x.date), cmLink(x)].map(c).join(","))).join("\n"), "text/csv"); }
  const body = list.map(x => `<div class="it"><blockquote>${H(x.quote ? x.quote.t : x.text).replace(/\n/g, "<br>")}</blockquote><p class="ref">${H(cmRef(x.quote))}</p><p class="by">${H(pName(x))} • ${H(fmtDate(x.date))}</p></div>`).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${H(label)}</title><style>body{font-family:"Amiri","Traditional Arabic","Times New Roman",serif;font-size:16pt;line-height:1.9;margin:2cm}h1{font-size:22pt;text-align:center}.it{margin:0 0 18pt;page-break-inside:avoid}blockquote{margin:0;border-right:4px solid #0b6b4f;padding-right:12pt}.ref{color:#0b6b4f;margin:4pt 0 0}.by{color:#777;font-size:12pt;margin:0}.foot{text-align:center;color:#777;font-size:11pt;margin-top:24pt}</style></head><body><h1>${H(label)}</h1>${body}<p class="foot">${H(SITENAME)}</p></body></html>`;
  if (f === "doc") return dl(name + ".doc", html, "application/msword");
  const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة لإنشاء PDF"); w.document.write(html + "<script>onload=()=>setTimeout(()=>print(),300)<\/script>"); w.document.close();
}

/* إطار «جديد» على منشورات المراقبة */
new MutationObserver(() => { const s = window.__cmSeen; if (!s || !document.body.classList.contains("cm-admin")) return; document.querySelectorAll(".post:not([data-cmk])").forEach(el => { el.dataset.cmk = 1; const x = typeof MP !== "undefined" && MP.get(el.dataset.id); if (x && x.date > s) el.classList.add("cmnew"); if (x && !el.querySelector(".cmmod")) el.querySelector(".pact").insertAdjacentHTML("afterend", cmModBar(x)); }); }).observe(document.getElementById("app"), { childList: true, subtree: true });

document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act; if (!/^cm/.test(a)) return;
  e.preventDefault();
  const pid = el.dataset.id || (el.closest("[data-id]") || {}).dataset && el.closest("[data-id]").dataset.id, x = pid && MP.get(pid);
  try {
    if (a === "cmhide") { if (!x) return; const on = el.dataset.on === "1"; let reason = null; if (on) { reason = prompt("سبب الإخفاء (يظهر للعضو صاحب المنشور):", "مخالف لمعايير المجتمع"); if (reason === null) return; } await CM.update(x, { hidden: on, hidden_reason: on ? reason : null }); if (on) CM.notifyUser(x.uid, "أخفت الإدارة أحد منشوراتك", reason || "", "#/post/" + x.id); else if (/مراجعة/.test(x.hreason || "")) CM.notifyUser(x.uid, "نُشرت مختارتك في مجتمع المكتبة", "", "#/post/" + x.id); closeSheet(); toast(on ? "أُخفي المنشور" : "أصبح المنشور ظاهرًا"); route(); }
    else if (a === "cmpin") { if (!x) return; await CM.update(x, { pinned: !x.pinned }); closeSheet(); toast(x.pinned ? "ثُبّت المنشور في أعلى المجتمع" : "أُلغي التثبيت"); route(); }
    else if (a === "cmban") { closeSheet(); cmBanDlg(el.dataset.uid, el.dataset.name); }
    else if (a === "cmunban") { if (!confirm("رفع الإيقاف عن هذا العضو؟")) return; const { error } = await Auth.sb.from("community_bans").delete().eq("user_id", el.dataset.uid); if (error) throw new Error(error.message); CM.notifyUser(el.dataset.uid, "رُفع الإيقاف عن حسابك في مجتمع المكتبة"); toast("رُفع الإيقاف"); route(); }
    else if (a === "cmreport") cmReportDlg(pid);
    else if (a === "cmexport") { const l = window.__cmList || []; if (!l.length) return toast("لا يوجد ما يُصدَّر هنا."); cmExportDlg(l, "مختارات مجتمع المكتبة"); }
    else if (a === "cmexp1") { closeSheet(); if (x) cmExportDlg([x], "مختارة من مجتمع المكتبة"); }
    else if (a === "cmexpf") { await cmExportAs(el.dataset.f); dlg().close(); toast("جُهّز الملف"); }
    else if (a === "cmrephide" || a === "cmrepdone") {
      const box = el.closest(".cmrep"), id = box.dataset.pid;
      if (a === "cmrephide") { const p = MP.get(id); if (p) { await CM.update(p, { hidden: true, hidden_reason: "أُخفي بعد بلاغ: مخالف لمعايير المجتمع" }); CM.notifyUser(p.uid, "أخفت الإدارة أحد منشوراتك بعد مراجعة بلاغ", "", "#/post/" + id); } }
      const { error } = await Auth.sb.from("post_reports").update({ status: "done" }).eq("post_id", id).eq("status", "open"); if (error) throw new Error(error.message); toast("تم"); route();
    }
  } catch (x2) { console.warn(x2); toast(x2.message || "تعذر تنفيذ الطلب"); }
});
document.addEventListener("change", async e => {
  const el = e.target.closest('[data-act="cmopt"]'); if (!el) return;
  try { const s = await CM.settings(true), v = { premod: s.premod, closed: s.closed }; v[el.dataset.k] = el.checked; await CM.saveSetting("community_open", v); toast("حُفظ الإعداد"); } catch (x) { el.checked = !el.checked; toast(x.message); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-form]"); if (!f || !/^cm/.test(f.dataset.form)) return;
  e.preventDefault(); e.stopImmediatePropagation(); const btn = f.querySelector("button"); btn.disabled = true;
  try {
    if (f.dataset.form === "cmrules") { await CM.saveSetting("community_rules", { text: f.t.value.trim() }); toast("حُفظت معايير المجتمع"); btn.disabled = false; }
    else if (f.dataset.form === "cmban") {
      const d = +f.d.value, row = { user_id: f.dataset.uid, scope: f.scope.value, reason: f.r.value.trim() || null, until: d ? new Date(Date.now() + d * 864e5).toISOString() : null, by_user: Auth.user.id, user_name: f.dataset.name || null, created_at: new Date().toISOString() };
      const { error } = await Auth.sb.from("community_bans").upsert(row); if (error) throw new Error(error.message);
      if (f.hideall.checked) await Auth.sb.from("member_posts").update({ hidden: true, hidden_reason: "إيقاف العضو" }).eq("user_id", f.dataset.uid);
      CM.notifyUser(f.dataset.uid, "أوقفت إدارة المكتبة " + (row.scope === "all" ? "مشاركتك" : "النشر من حسابك") + (d ? " مدة " + toAr(d) + " يوم" : ""), row.reason || "", "#/community");
      dlg().close(); toast("نُفّذ الإيقاف"); route();
    }
    else if (f.dataset.form === "cmreport") {
      const r = (f.querySelector('input[name="r"]:checked') || {}).value || "مخالفة", d = f.d.value.trim(), reason = r + (d ? ": " + d : "");
      const { error } = await Auth.sb.from("post_reports").insert({ post_id: f.dataset.id, user_id: Auth.user.id, reason });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message.replace(/^.*rate_limited:\s*/, ""));
      const x = MP.get(f.dataset.id); if (typeof tgNote === "function") tgNote("report", { subject: reason, detail: x && x.quote ? "«" + x.quote.t.slice(0, 200) + "» — " + (x.name || "") : f.dataset.id });
      dlg().close(); toast(error ? "سبق أن أبلغت عن هذا المنشور" : "شكرًا لك، وصل البلاغ إلى الإدارة");
    }
  } catch (x) { alert(x.message); btn.disabled = false; }
}, true);
