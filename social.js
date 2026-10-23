/* الحلقة الاجتماعية: صفحات الأعضاء، والمتابعة، ومنشورات الأعضاء والاقتباس من الكتب، والردود على التعليقات.
   يعمل فوق app.js (يستعمل دواله العامة) ويحتاج قاعدة الحسابات (Supabase). */
const MP = new Map(); // منشورات الأعضاء المحمَّلة: "m<id>" → منشور
const Members = {
  pages: new Map(), follows: null,
  on() { return typeof Cloud !== "undefined" && Cloud.on(); },
  toPost(r) { const x = { id: "m" + r.id, mid: r.id, uid: r.user_id, member: 1, name: r.user_name || (this.pages.get(r.user_id) || {}).name || "عضو", text: r.body || "", quote: r.quote || null, date: r.created_at }; MP.set(x.id, x); return x; },
  async posts(opt) {
    opt = opt || {}; if (!this.on()) return [];
    let q = Auth.sb.from("member_posts").select("id,user_id,user_name,body,quote,created_at").order("created_at", { ascending: false }).limit(opt.limit || 60);
    if (opt.uid) q = q.eq("user_id", opt.uid);
    if (opt.uids) { if (!opt.uids.length) return []; q = q.in("user_id", opt.uids); }
    if (opt.book) q = q.eq("quote->>b", opt.book);
    const { data, error } = await q; if (error) { console.warn(error); return []; }
    return (data || []).map(r => this.toPost(r));
  },
  async post(id) {
    if (MP.has(id)) return MP.get(id); if (!this.on() || !/^m\d+$/.test(id)) return null;
    const { data } = await Auth.sb.from("member_posts").select("id,user_id,user_name,body,quote,created_at").eq("id", +id.slice(1)).maybeSingle();
    return data ? this.toPost(data) : null;
  },
  async publish(quote) {
    if (!Auth.user) throw new Error("سجّل الدخول أولًا.");
    if (!this.on()) throw new Error("النشر يحتاج تفعيل قاعدة الحسابات.");
    const { data: ses } = await Auth.sb.auth.getSession(), tok = ses && ses.session && ses.session.access_token;
    const r = await fetch("/api/mpost", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (tok || "") }, body: JSON.stringify({ b: quote.b, p: quote.p, t: quote.t }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || "تعذر النشر الآن.");
    return this.toPost(j.post);
  },
  async del(x) { const { error } = await Auth.sb.from("member_posts").delete().eq("id", x.mid); if (error) throw new Error(error.message); MP.delete(x.id); },
  async page(uid) {
    if (this.pages.has(uid)) return this.pages.get(uid); if (!this.on()) return null;
    const { data } = await Auth.sb.from("member_pages").select("*").eq("user_id", uid).maybeSingle();
    const p = data || (Auth.user && uid === Auth.user.id ? { user_id: uid, name: Auth.user.name || "عضو", bio: "", fresh: 1 } : null);
    if (p) this.pages.set(uid, p); return p;
  },
  async savePage(p) { const { error } = await Auth.sb.from("member_pages").upsert({ user_id: Auth.user.id, name: p.name, bio: p.bio || null, updated_at: new Date().toISOString() }); if (error) throw new Error(error.message); this.pages.set(Auth.user.id, Object.assign({ user_id: Auth.user.id }, p)); },
  async myFollows() {
    if (!Auth.user || !this.on()) return new Set(); if (this.follows) return this.follows;
    const { data } = await Auth.sb.from("follows").select("followee").eq("follower", Auth.user.id);
    return (this.follows = new Set((data || []).map(r => r.followee)));
  },
  async follow(key, on) {
    if (!Auth.user) { needLogin("المتابعة متاحة للأعضاء المسجلين."); return false; }
    const t = Auth.sb.from("follows"), { error } = on ? await t.insert({ follower: Auth.user.id, followee: key }) : await t.delete().eq("follower", Auth.user.id).eq("followee", key);
    if (error && !/duplicate/.test(error.message)) throw new Error(error.message);
    const s = await this.myFollows(); on ? s.add(key) : s.delete(key); return true;
  },
  async counts(key, uid) {
    const [a, b] = await Promise.all([Auth.sb.from("follows").select("follower", { count: "exact", head: true }).eq("followee", key),
      uid ? Auth.sb.from("follows").select("followee", { count: "exact", head: true }).eq("follower", uid) : Promise.resolve({ count: 0 })]);
    return { followers: a.count || 0, following: b.count || 0 };
  }
};

/* زر المتابعة: key = "a:<مؤلف>" أو "u:<عضو>" */
function followBtn(key, on) { return `<button class="btn s${on ? "" : " p"} fbtn" data-act="follow" data-key="${esc(key)}" aria-pressed="${!!on}">${on ? "✓ متابَع" : "+ متابعة"}</button>`; }
async function paintFollowBtns(root) {
  const bs = [...(root || document).querySelectorAll(".fbtn")]; if (!bs.length || !Auth.user || !Members.on()) return;
  const s = await Members.myFollows(); bs.forEach(b => { const on = s.has(b.dataset.key); b.outerHTML = followBtn(b.dataset.key, on); });
}

/* بطاقة الاقتباس من كتاب داخل المنشور */
function quoteHtml(q) {
  if (!q || !q.t) return "";
  const b = q.b && typeof B === "function" ? B(q.b) : null, title = q.title || (b && (b.setTitle || b.title)) || "", au = q.au || (b && A(b.authorId).name) || "";
  return `<a class="pquote" href="#/book/${esc(q.b || "")}/${+q.p || 1}"><blockquote>${esc(q.t)}</blockquote><span>📖 ${esc(title)}${au ? " — " + esc(au) : ""}${q.pl ? " • " + esc(q.pl) : q.p ? " • ص " + toAr(q.p) : ""}</span></a>`;
}

/* نشر «مختارة» من كتاب: النشر مقصور على نصوص الكتب، بلا كلام شخصي */
function composeDlg(quote) {
  if (!Auth.user) return needLogin("نشر المختارات متاح للأعضاء المسجلين.");
  if (!Members.on()) return toast("النشر يحتاج تفعيل قاعدة الحسابات.");
  if (!quote) return openDlg(`<h3>انشر مختارة</h3><p>النشر في المكتبة مقصور على المختارات من الكتب.</p><ol class="mut"><li>افتح أي كتاب.</li><li>حدّد الفقرة التي تريدها.</li><li>اضغط «انشر مختارة» في الشريط الذي يظهر.</li></ol><p class="mut">تظهر المختارة بطاقةً موثقة باسم الكتاب ومؤلفه وصفحته، ومن يضغطها يصل إلى موضعها في الكتاب.</p><a class="btn p nf" href="#/library">إلى المكتبة</a>`);
  window.__pendingQuote = quote;
  openDlg(`<h3>انشر مختارة من الكتاب</h3>${quoteHtml(quote).replace(/^<a /, "<div ").replace(/<\/a>$/, "</div>")}
  <form data-form="mpost"><p class="mut" style="font-size:.85rem">تُنشر المختارة كما هي من الكتاب بتوثيقها، وتظهر لمن يتابعك وفي «الكل».</p><button class="btn p">نشر المختارة</button></form>`);
}

/* صفحة العضو */
async function vMember(uid) {
  if (!Members.on()) return view('<p class="note">صفحات الأعضاء تحتاج تفعيل قاعدة الحسابات.</p>');
  view('<p class="mut">جارٍ التحميل…</p>');
  const [pg, posts] = await Promise.all([Members.page(uid), Members.posts({ uid })]);
  if (!pg && !posts.length) return view('<p class="note">لم يُعثر على هذا العضو.</p><p><a href="#/posts">← المنشورات</a></p>');
  const me = Auth.user && Auth.user.id === uid, name = (pg && pg.name) || (posts[0] && posts[0].name) || "عضو", c = await Members.counts("u:" + uid, uid);
  view(`<div class="ahero"><span class="av big" style="${avHue(uid)}">${esc(name[0] || "؟")}</span><h2>${esc(name)}</h2></div>
  ${pg && pg.bio ? `<div class="abrief"><p>${esc(pg.bio)}</p></div>` : ""}
  <div class="row mstats"><span><b>${toAr(posts.length)}</b> منشور</span><span><b>${toAr(c.followers)}</b> متابِع</span><span><b>${toAr(c.following)}</b> يتابع</span>
  ${me ? `<button class="btn s" data-act="meedit">تعديل صفحتي</button><button class="btn s p" data-act="compose">انشر مختارة</button><a class="btn s" href="#/messages">مراسلة الإدارة</a>` : followBtn("u:" + uid, false)}</div>
  ${me && pg && pg.fresh ? '<p class="note">اكتب اسمك الظاهر ونبذة قصيرة ليعرفك الأعضاء: «تعديل صفحتي».</p>' : ""}
  <div class="feed" id="feed"></div>${posts.length ? "" : '<p class="mut">لا منشورات بعد.</p>'}`);
  const st = await Social.state(posts.map(x => x.id)); $("#feed").innerHTML = posts.map(x => postHtml(x, st)).join(""); paintFollowBtns();
}
function meEditDlg() {
  const p = Members.pages.get(Auth.user.id) || {};
  openDlg(`<h3>صفحتي</h3><form data-form="mepage"><label>الاسم الظاهر</label><input name="name" maxlength="60" minlength="2" required value="${esc(p.name || Auth.user.name || "")}"><label>نبذة (اختياري)</label><textarea name="bio" maxlength="300" style="min-height:90px">${esc(p.bio || "")}</textarea><button class="btn p" style="margin-top:8px">حفظ</button></form>`);
}

/* قائمة من يتابعهم العضو من المشايخ والأعضاء (لصفحة «متابَعاتي») */
async function followingStrip() {
  const s = await Members.myFollows(); if (!s.size) return "";
  const items = [...s].map(k => { const [t, id] = [k[0], k.slice(2)]; if (t === "a") { const a = A(id); return `<a href="#/author/${id}"><span class="ring">${typeof avatar === "function" ? avatar(a) : ""}</span><small>${esc(a.name.replace(/^(الشيخ|الدكتور|د\.)\s*/, "").split(/\s+/).slice(0, 2).join(" "))}</small></a>`; }
    const p = Members.pages.get(id); return `<a href="#/member/${id}"><span class="ring"><span class="av" style="${avHue(id)}">${esc(((p && p.name) || "ع")[0])}</span></span><small>${esc(((p && p.name) || "عضو").split(/\s+/).slice(0, 2).join(" "))}</small></a>`; });
  return `<div class="pstrip" data-noswipe>${items.join("")}</div>`;
}

/* التعليقات المتسلسلة: ردود بمستوى واحد، وإعجاب بالتعليق */
async function commentLikes(ids) {
  const out = { n: {}, mine: new Set() }; if (!ids.length || !Members.on()) return out;
  const { data } = await Auth.sb.from("comment_reactions").select("comment_id,user_id").in("comment_id", ids);
  (data || []).forEach(r => { out.n[r.comment_id] = (out.n[r.comment_id] || 0) + 1; if (Auth.user && r.user_id === Auth.user.id) out.mine.add(r.comment_id); });
  return out;
}
function cmtHtml(c, L, reply) {
  const n = L.n[c.id] || 0, mine = L.mine.has(c.id), canDel = Auth.user && (c.uid === Auth.user.id || Cloud.staff());
  return `<div class="cmt${reply ? " rep" : ""}" data-cid="${esc(c.id)}"><span class="av sm" style="${avHue(c.uid || c.name)}">${esc((c.name || "؟")[0])}</span><div><b>${c.uid && Members.on() ? `<a href="#/member/${c.uid}">${esc(c.name || "عضو")}</a>` : esc(c.name || "عضو")}</b><p>${linkify(esc(c.text))}</p>
  <span class="mut">${esc(ago(c.at))}${Members.on() ? ` • <button class="lnk" data-act="clike" data-cid="${esc(c.id)}" aria-pressed="${mine}">${mine ? "♥" : "♡"}${n ? " " + toAr(n) : ""}</button>` : ""}${Auth.user && Members.on() ? ` • <button class="lnk" data-act="creply" data-cid="${esc(reply ? c.parent : c.id)}" data-name="${esc(c.name || "")}">ردّ</button>` : ""}${canDel ? ` • <button class="lnk" data-act="pdelc" data-cid="${esc(c.id)}">حذف</button>` : ""}</span></div></div>`;
}
async function openComments(card) {
  const box = card.querySelector(".pcomms"), id = card.dataset.id; box.hidden = false; box.innerHTML = '<p class="mut">جارٍ تحميل التعليقات…</p>';
  let list = []; try { list = await Social.comments(id); } catch (e) { }
  const cl = card.querySelector(".pstats .lnk"); if (cl) cl.textContent = list.length ? `${toAr(list.length)} تعليق` : "";
  const L = await commentLikes(list.map(c => c.id).filter(x => typeof x === "number"));
  const top = list.filter(c => !c.parent), kids = {}; list.filter(c => c.parent).forEach(c => (kids[c.parent] = kids[c.parent] || []).push(c));
  box.innerHTML = `${top.map(c => cmtHtml(c, L) + (kids[c.id] || []).map(r => cmtHtml(r, L, true)).join("")).join("") || '<p class="mut">لا توجد تعليقات بعد.</p>'}
  ${Auth.user ? `<form class="stepper" data-form="pcomment" data-id="${esc(id)}"><input type="hidden" name="parent" value=""><input name="t" placeholder="اكتب تعليقًا…" aria-label="اكتب تعليقًا" maxlength="2000" required><button class="btn s p">نشر</button></form><p class="mut creplyto" hidden></p>${Cloud.on() ? "" : '<p class="mut" style="font-size:.75rem">التعليقات محفوظة على جهازك حتى تفعيل قاعدة الحسابات.</p>'}` : `<p class="mut"><a href="#/account?next=${encodeURIComponent(HERE())}">سجّل الدخول</a> للتعليق.</p>`}`;
}

/* تصدير مجموعة فوائد (منشوراتي أو محفوظاتي) نصًا موثقًا */
function postsToText(list) {
  return list.map(x => { const q = x.quote, src = q ? `\n«${q.t}»\n— ${q.title || ""}${q.au ? "، " + q.au : ""}${q.pl ? "، " + q.pl : q.p ? "، ص " + q.p : ""}` : ""; return `${x.text || ""}${src}\n(${pName(x)} — ${fmtDate ? fmtDate(x.date) : x.date})`.trim(); }).join("\n\n———\n\n") + `\n\n${SITENAME}`;
}

/* الأحداث الخاصة بالحلقة الاجتماعية */
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
  try {
    if (a === "follow") { e.preventDefault(); const on = el.getAttribute("aria-pressed") !== "true"; if (await Members.follow(el.dataset.key, on)) { el.outerHTML = followBtn(el.dataset.key, on); toast(on ? "تابعتَه؛ تظهر منشوراته في «متابَعاتي»" : "ألغيت المتابعة"); } }
    else if (a === "compose") { e.preventDefault(); composeDlg(null); }
    else if (a === "selpost") {
      e.preventDefault(); const s = String(getSelection()).trim().replace(/\s+/g, " "), rb = selRd() || $("#rb"); if (!s || !rb) return;
      const b = B(rb.dataset.id), p = +rb.dataset.p; getSelection().removeAllRanges();
      composeDlg({ b: b.id, p, pl: PL(b, p - 1) || "", t: s.slice(0, 1500), title: b.setTitle || b.title, au: A(b.authorId).name });
    }
    else if (a === "meedit") { e.preventDefault(); meEditDlg(); }
    else if (a === "clike") {
      e.preventDefault(); if (!Auth.user) return needLogin(); const cid = +el.dataset.cid, on = el.getAttribute("aria-pressed") !== "true";
      const t = Auth.sb.from("comment_reactions"), { error } = on ? await t.insert({ comment_id: cid, user_id: Auth.user.id }) : await t.delete().eq("comment_id", cid).eq("user_id", Auth.user.id);
      if (error) throw new Error(error.message); const n = Math.max(0, (+(el.textContent.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) || 0) + (on ? 1 : -1));
      el.setAttribute("aria-pressed", on); el.textContent = (on ? "♥" : "♡") + (n ? " " + toAr(n) : "");
    }
    else if (a === "creply") {
      e.preventDefault(); const f = el.closest(".pcomms").querySelector('form[data-form="pcomment"]'); if (!f) return;
      f.parent.value = el.dataset.cid; const hint = el.closest(".pcomms").querySelector(".creplyto"); hint.hidden = false; hint.innerHTML = `ردًّا على ${esc(el.dataset.name || "التعليق")} • <button class="lnk" data-act="creplyx">إلغاء</button>`; f.t.focus();
    }
    else if (a === "creplyx") { e.preventDefault(); const bx = el.closest(".pcomms"); bx.querySelector('form[data-form="pcomment"]').parent.value = ""; bx.querySelector(".creplyto").hidden = true; }
    else if (a === "pexport") {
      e.preventDefault(); const k = el.dataset.k; let list = k === "mine" && Auth.user ? await Members.posts({ uid: Auth.user.id, limit: 500 }) : (await Social.savedIds()).map(findPost).filter(Boolean);
      if (!list.length) return toast("لا يوجد ما يُصدَّر."); closeSheet(); await dl((k === "mine" ? "فوائدي" : "محفوظاتي") + ".txt", postsToText(list), "text/plain"); toast("نُزّل الملف.");
    }
  } catch (x) { console.warn(x); toast(x.message || "تعذر تنفيذ الطلب"); }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-form]"); if (!f) return; const k = f.dataset.form; if (k !== "mpost" && k !== "mepage") return;
  e.preventDefault(); e.stopImmediatePropagation(); const btn = f.querySelector("button"); btn.disabled = true;
  try {
    if (k === "mpost") { const x = await Members.publish(window.__pendingQuote); window.__pendingQuote = null; dlg().close(); toast("نُشر منشورك"); location.hash = "#/post/" + x.id; }
    else { const name = f.name.value.trim(), bio = f.bio.value.trim(); await Members.savePage({ name, bio }); dlg().close(); toast("حُفظت صفحتك"); route(); }
  } catch (x) { alert(x.message); btn.disabled = false; }
}, true);

/* مراسلة إدارة المكتبة: الرسائل بين العضو والإدارة فقط (لا مراسلة خاصة بين الأعضاء) */
async function vMessages() {
  if (!Auth.user) return view(`<h2>مراسلة الإدارة</h2><p><a href="#/account?next=%23%2Fmessages">سجّل الدخول</a> لمراسلة إدارة المكتبة، أو استعمل <a href="#/contact">صفحة التواصل</a>.</p>`);
  if (!Members.on()) return view('<p class="note">المراسلة تحتاج تفعيل قاعدة الحسابات. استعمل <a href="#/contact">صفحة التواصل</a>.</p>');
  const staff = Cloud.staff();
  let q = Auth.sb.from("admin_messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (!staff) q = q.eq("user_id", Auth.user.id);
  const { data, error } = await q; const list = data || [];
  view(`<h2>${staff ? "رسائل الأعضاء إلى الإدارة" : "مراسلة إدارة المكتبة"}</h2>
  ${staff ? "" : `<p class="mut">لاقتراح كتاب، أو الإبلاغ عن خطأ، أو أي طلب. المراسلة الخاصة بين الأعضاء غير متاحة إلا بإذن الإدارة.</p>
  <form data-form="amsg" class="card"><label>الموضوع</label><input name="s" maxlength="120" required><label>الرسالة</label><textarea name="t" maxlength="4000" required style="min-height:130px"></textarea><button class="btn p" style="margin-top:8px">إرسال</button></form>`}
  ${error ? `<p class="note">${esc(error.message)}</p>` : ""}
  <div class="msgs">${list.map(m => `<div class="card msg" data-mid="${m.id}"><b>${esc(m.subject)}</b><span class="mut">${staff ? esc(m.user_name || "عضو") + " • " : ""}${esc(ago(m.created_at))} • ${m.reply ? "تم الرد" : "بانتظار الرد"}</span><p>${esc(m.body).replace(/\n/g, "<br>")}</p>
   ${m.reply ? `<div class="mreply"><b>رد الإدارة</b><p>${esc(m.reply).replace(/\n/g, "<br>")}</p></div>` : staff ? `<form data-form="areply" data-id="${m.id}"><textarea name="r" maxlength="4000" required placeholder="اكتب الرد…"></textarea><button class="btn s p">إرسال الرد</button></form>` : ""}</div>`).join("") || '<p class="mut">لا رسائل بعد.</p>'}</div>`);
}
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-form]"); if (!f) return; const k = f.dataset.form; if (k !== "amsg" && k !== "areply") return;
  e.preventDefault(); e.stopImmediatePropagation(); const btn = f.querySelector("button"); btn.disabled = true;
  try {
    if (k === "amsg") { const pg = await Members.page(Auth.user.id); const { error } = await Auth.sb.from("admin_messages").insert({ user_id: Auth.user.id, user_name: (pg && pg.name) || Auth.user.name || "عضو", subject: f.s.value.trim(), body: f.t.value.trim() }); if (error) throw new Error(error.message); toast("أُرسلت رسالتك إلى الإدارة"); }
    else { const { error } = await Auth.sb.from("admin_messages").update({ reply: f.r.value.trim(), replied_at: new Date().toISOString(), status: "replied" }).eq("id", +f.dataset.id); if (error) throw new Error(error.message); toast("أُرسل الرد وأُشعر العضو"); }
    vMessages();
  } catch (x) { alert(x.message); btn.disabled = false; }
}, true);

// تلوين أزرار المتابعة كلما ظهرت في الصفحة
let _fbT = null; new MutationObserver(() => { if (_fbT) return; _fbT = setTimeout(() => { _fbT = null; const raw = document.querySelector(".fbtn:not([data-p])"); if (raw) { document.querySelectorAll(".fbtn").forEach(b => b.dataset.p = 1); paintFollowBtns().then(() => document.querySelectorAll(".fbtn").forEach(b => b.dataset.p = 1)); } }, 120); }).observe(document.body, { childList: true, subtree: true });
