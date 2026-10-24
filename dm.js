/* المراسلة الخاصة بين الأعضاء: بإذن الإدارة فقط (profiles.dm_ok)، ولا يراسل العضو إلا من أُذن له أيضًا. */
async function vDM(uid) {
  if (!Auth.user) return view(`<h2>الرسائل الخاصة</h2><p><a href="#/account?next=%23%2Fdm">سجّل الدخول</a> أولًا.</p>`);
  if (!Cloud.on()) return view('<p class="note">تحتاج قاعدة الحسابات.</p>');
  const { data: me } = await Auth.sb.from("profiles").select("dm_ok,role").eq("id", Auth.user.id).maybeSingle();
  const ok = me && (me.dm_ok || /^(admin|editor)$/.test(me.role));
  if (!ok) return view(`<h2>الرسائل الخاصة</h2><div class="card"><p>المراسلة الخاصة بين الأعضاء متاحة بإذن من إدارة المكتبة، حفاظًا على آداب المجتمع.</p><button class="btn p" data-act="dmask">اطلب الإذن من الإدارة</button></div>`);
  if (uid) return dmThread(uid);
  const [{ data: msgs }, { data: people }] = await Promise.all([Auth.sb.from("direct_messages").select("*").or(`sender.eq.${Auth.user.id},recipient.eq.${Auth.user.id}`).order("created_at", { ascending: false }).limit(300), Auth.sb.rpc("dm_people")]);
  const names = new Map((people || []).map(p => [p.id, p.name])), conv = new Map();
  (msgs || []).forEach(m => { const o = m.sender === Auth.user.id ? m.recipient : m.sender; if (!conv.has(o)) conv.set(o, { last: m, unread: 0 }); if (m.recipient === Auth.user.id && !m.read_at) conv.get(o).unread++; });
  view(`<h2>الرسائل الخاصة</h2><p class="mut">مراسلة خاصة بين الأعضاء المأذون لهم من الإدارة. التزم معايير المجتمع؛ وللإدارة الاطلاع عند البلاغ.</p>
  <form class="stepper" data-form="dmnew"><select name="u" required><option value="">— راسل عضوًا مأذونًا له —</option>${(people || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select><button class="btn p">فتح المحادثة</button></form>
  <div class="msgs">${[...conv].map(([o, c]) => `<a class="bk" href="#/dm/${o}"><b>${esc(names.get(o) || "عضو")}${c.unread ? ` <em class="tag">${toAr(c.unread)} جديدة</em>` : ""}</b><span>${esc(c.last.body.slice(0, 90))} • ${esc(ago(c.last.created_at))}</span></a>`).join("") || '<p class="mut">لا محادثات بعد.</p>'}</div>`);
}
async function dmThread(uid) {
  const [{ data: msgs }, { data: people }] = await Promise.all([Auth.sb.from("direct_messages").select("*").or(`and(sender.eq.${Auth.user.id},recipient.eq.${uid}),and(sender.eq.${uid},recipient.eq.${Auth.user.id})`).order("created_at", { ascending: true }).limit(500), Auth.sb.rpc("dm_people")]);
  const name = ((people || []).find(p => p.id === uid) || {}).name || "عضو";
  view(`<p><a href="#/dm">← الرسائل الخاصة</a></p><h2>${esc(name)}</h2><div class="dmthread">${(msgs || []).map(m => `<div class="dmm${m.sender === Auth.user.id ? " me" : ""}"><p>${linkify(esc(m.body)).replace(/\n/g, "<br>")}</p><small>${esc(ago(m.created_at))}</small></div>`).join("") || '<p class="mut">ابدأ المحادثة.</p>'}</div>
  <form data-form="dmsend" data-u="${uid}" class="dmform"><textarea name="t" maxlength="4000" required placeholder="اكتب رسالتك…"></textarea><button class="btn p">إرسال</button></form>`);
  const t = document.querySelector(".dmthread"); if (t) t.scrollTop = t.scrollHeight;
  const unread = (msgs || []).filter(m => m.recipient === Auth.user.id && !m.read_at).map(m => m.id);
  if (unread.length) Auth.sb.from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => { });
}
document.addEventListener("submit", async e => {
  const f = e.target.closest('[data-form="dmnew"],[data-form="dmsend"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
  if (f.dataset.form === "dmnew") { if (f.u.value) go("#/dm/" + f.u.value); return; }
  const b = f.querySelector("button"); b.disabled = true;
  try { const { error } = await Auth.sb.from("direct_messages").insert({ sender: Auth.user.id, recipient: f.dataset.u, body: f.t.value.trim() }); if (error) throw new Error(/row-level/.test(error.message) ? "المراسلة غير مأذونة بينكما، أو أوقفت الإدارة مشاركتك." : error.message); dmThread(f.dataset.u); } catch (x) { alert(x.message); b.disabled = false; }
}, true);
document.addEventListener("click", async e => {
  const el = e.target.closest('[data-act="dmask"],[data-act="dmgrant"]'); if (!el) return; e.preventDefault();
  try {
    if (el.dataset.act === "dmask") { const pg = await Members.page(Auth.user.id); const { error } = await Auth.sb.from("admin_messages").insert({ user_id: Auth.user.id, user_name: (pg && pg.name) || Auth.user.name || "عضو", subject: "طلب إذن المراسلة الخاصة", body: "أرجو الإذن لي بالمراسلة الخاصة مع الأعضاء." }); if (error) throw new Error(error.message.replace(/^.*rate_limited:\s*/, "")); toast("أُرسل طلبك إلى الإدارة"); el.disabled = true; }
    else { const on = el.dataset.on === "1"; const { error } = await Auth.sb.from("profiles").update({ dm_ok: on }).eq("id", el.dataset.id); if (error) throw new Error(error.message); try { await Auth.sb.from("notifications").insert({ user_id: el.dataset.id, title: on ? "أذنت لك الإدارة بالمراسلة الخاصة مع الأعضاء المأذون لهم" : "أُوقف إذن المراسلة الخاصة", url: "#/dm" }); } catch (x) { } toast(on ? "أُذن له بالمراسلة الخاصة" : "أُوقف الإذن"); el.dataset.on = on ? "0" : "1"; el.textContent = on ? "منع المراسلة الخاصة" : "السماح بالمراسلة الخاصة"; }
  } catch (x) { toast(x.message); }
});
