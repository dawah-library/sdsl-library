/* حفظ المتون بالتكرار المتباعد: بطاقات من نصوص الكتب (تحديد نص، أو مجموعة كاملة من فهرس متن كالأربعين النووية والبيقونية)،
   تُعرض للمراجعة في أوقات متباعدة بحسب إتقانك (خوارزمية SM-2)، ويذكّرك جرس الإشعارات بما حان. محفوظة على جهازك، ومتزامنة بحسابك. */
const HZ = {
  k() { return "hifz:" + (Auth.user ? Auth.user.id : "-"); },
  all() { return ls.get(this.k(), []); },
  save(l) { ls.set(this.k(), l); this.sync(l); },
  due(l) { const t = Date.now(); return (l || this.all()).filter(c => !c.sus && (c.due || 0) <= t); },
  async sync(l) { if (!Auth.user || !Cloud.on()) return; try { await Auth.sb.from("srs_decks").upsert({ user_id: Auth.user.id, data: l, updated_at: new Date().toISOString() }); } catch (e) { } },
  async pull() { if (!Auth.user || !Cloud.on()) return; try { const { data } = await Auth.sb.from("srs_decks").select("data,updated_at").eq("user_id", Auth.user.id).maybeSingle(); if (data && Array.isArray(data.data)) { const m = new Map(this.all().map(c => [c.id, c])); data.data.forEach(c => { const o = m.get(c.id); if (!o || (c.u || 0) > (o.u || 0)) m.set(c.id, c); }); ls.set(this.k(), [...m.values()]); } } catch (e) { } },
  add(cards) { const l = this.all(), ids = new Set(l.map(c => c.id)); let n = 0; cards.forEach(c => { if (!ids.has(c.id)) { l.push(Object.assign({ due: Date.now(), iv: 0, ef: 2.5, reps: 0, u: Date.now() }, c)); n++; } }); this.save(l); return n; },
  // SM-2: q من 0 إلى 5
  grade(id, q) { const l = this.all(), c = l.find(x => x.id === id); if (!c) return; if (q < 3) { c.reps = 0; c.iv = 0; c.due = Date.now() + 10 * 60e3; } else { c.reps = (c.reps || 0) + 1; c.iv = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round((c.iv || 1) * (c.ef || 2.5)); c.ef = Math.max(1.3, (c.ef || 2.5) + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)); c.due = Date.now() + c.iv * 864e5; } c.u = Date.now(); c.last = q; this.save(l); }
};
const hzId = (b, p, t) => "h" + b + ":" + p + ":" + fnv(t.slice(0, 200));
const hzCue = t => { const w = strip(t).replace(/^#+\s*/, "").split(/\s+/); return w.slice(0, Math.min(6, Math.max(3, Math.ceil(w.length / 6)))).join(" ") + " …"; };
function hzFromBook(b) {
  const toc = (b.toc || []).filter(t => (t.l || 1) === 1), out = [];
  if (toc.length >= 2) toc.forEach((t, i) => { const z = (toc[i + 1] ? toc[i + 1].p : b.pages.length + 1) - 1; let tx = b.pages.slice(t.p - 1, Math.max(t.p, z)).map(x => String(x || "").split(/^\s*_{4,}\s*$/m)[0]).join("\n").replace(/^#.*$/m, "").trim(); if (tx.length > 900) tx = tx.slice(0, 900).replace(/\s+\S*$/, "") + " …"; if (tx.length > 20) out.push({ id: hzId(b.id, t.p, t.t), b: b.id, p: t.p, cue: t.t, text: tx }); });
  else b.pages.forEach((pg, i) => String(pg || "").split(/^\s*_{4,}\s*$/m)[0].split("\n").filter(l => strip(l).length > 30).forEach(l => out.push({ id: hzId(b.id, i + 1, l), b: b.id, p: i + 1, cue: hzCue(l), text: l.trim() })));
  return out.slice(0, 400);
}
async function vHifz(q) {
  await HZ.pull();
  const l = HZ.all(), due = HZ.due(l), books = [...new Set(l.map(c => c.b))];
  const mutun = ["arbain", "bayquniyya", "waraqat", "ajurrumiyya", "lumca", "wasitiyya", "tahawiyya", "alfiyya", "qatr", "tawhid"].filter(id => B(id));
  view(`<div class="cmhero hz"><div><h2>حفظ المتون</h2><p>بطاقات حفظ من نصوص الكتب تُعرض عليك في أوقات متباعدة بحسب إتقانك، فتراجع ما يوشك أن يُنسى. أنشئها بتحديد نص في أي كتاب ثم «بطاقة حفظ»، أو أضف متنًا كاملًا.</p></div>
  <div class="row">${due.length ? `<button class="btn p" data-act="hzgo">▶ راجع الآن (${toAr(due.length)})</button>` : `<span class="note" style="margin:0">لا بطاقات مستحقة الآن${l.length ? "؛ أحسنت" : ""}.</span>`}</div></div>
  <div class="cmstats"><a><b>${toAr(l.length)}</b><span>بطاقة</span></a><a><b>${toAr(due.length)}</b><span>مستحقة اليوم</span></a><a><b>${toAr(l.filter(c => (c.iv || 0) >= 21).length)}</b><span>متقنة (٣ أسابيع فأكثر)</span></a></div>
  <h3>أضف متنًا كاملًا</h3><div class="chips">${mutun.map(id => `<button class="chip" data-act="hzbook" data-id="${id}">+ ${esc(B(id).title)}</button>`).join("")}</div>
  ${books.length ? `<h3>مجموعاتك</h3>${books.map(id => { const cs = l.filter(c => c.b === id), d = HZ.due(cs).length; return `<div class="bk"><b>${esc((B(id) || {}).title || id)}</b><span>${toAr(cs.length)} بطاقة • مستحقة ${toAr(d)}</span><div class="row" style="margin-top:6px">${d ? `<button class="btn s p" data-act="hzgo" data-b="${id}">راجع</button>` : ""}<button class="btn s" data-act="hzlist" data-b="${id}">البطاقات</button><button class="btn s danger" data-act="hzdel" data-b="${id}">حذف المجموعة</button></div></div>`; }).join("")}` : ""}
  <div id="hzbox"></div>`);
}
function hzReview(bid) {
  const l = HZ.due().filter(c => !bid || c.b === bid).sort((a, b) => (a.due || 0) - (b.due || 0)); if (!l.length) { toast("لا بطاقات مستحقة"); return route(); }
  const c = l[0], b = B(c.b);
  openDlg(`<div class="hzcard"><p class="mut">${esc(b ? b.title : "")} • بقي ${toAr(l.length)}</p><div class="hzcue">${esc(c.cue)}</div><p class="mut">استحضره من حفظك، ثم اكشف النص.</p>
  <div class="hzans" hidden>${esc(S.tash ? c.text : strip(c.text)).replace(/\n/g, "<br>")}</div>
  <div class="row hzbtns"><button class="btn p" data-act="hzshow">اكشف النص</button></div>
  <div class="row hzgr" hidden><button class="btn" data-act="hzg" data-q="1" data-id="${c.id}" data-b="${bid || ""}">لم أحفظه</button><button class="btn" data-act="hzg" data-q="3" data-id="${c.id}" data-b="${bid || ""}">صعب</button><button class="btn p" data-act="hzg" data-q="4" data-id="${c.id}" data-b="${bid || ""}">جيد</button><button class="btn" data-act="hzg" data-q="5" data-id="${c.id}" data-b="${bid || ""}">سهل</button></div>
  ${b ? `<a class="mut" href="#/book/${c.b}/${c.p}" data-act="closeDlg">افتح الموضع في الكتاب</a>` : ""}</div>`);
}
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el || !/^hz|^selhz$/.test(el.dataset.act)) return; const a = el.dataset.act; e.preventDefault();
  if (a === "hzgo") { dlg().open && dlg().close(); hzReview(el.dataset.b || ""); }
  else if (a === "hzshow") { const d = el.closest(".hzcard"); d.querySelector(".hzans").hidden = false; d.querySelector(".hzbtns").hidden = true; d.querySelector(".hzgr").hidden = false; }
  else if (a === "hzg") { HZ.grade(el.dataset.id, +el.dataset.q); hzReview(el.dataset.b || ""); }
  else if (a === "hzbook") { el.disabled = true; try { const b = await loadBook(el.dataset.id); const n = HZ.add(hzFromBook(b)); toast(n ? "أضيفت " + toAr(n) + " بطاقة من «" + b.title + "»" : "المتن مضاف من قبل"); route(); } catch (x) { toast(x.message); el.disabled = false; } }
  else if (a === "hzdel") { if (!confirm("حذف بطاقات هذه المجموعة وتقدّم حفظها؟")) return; HZ.save(HZ.all().filter(c => c.b !== el.dataset.b)); route(); }
  else if (a === "hzlist") { const cs = HZ.all().filter(c => c.b === el.dataset.b); $("#hzbox").innerHTML = `<h3>${esc((B(el.dataset.b) || {}).title || "")}</h3>` + cs.map(c => `<div class="amark"><span><b>${esc(c.cue)}</b> <span class="mut">• ${c.iv ? "كل " + toAr(c.iv) + " يوم" : "جديدة"}</span></span><button class="lnk" data-act="hzrm" data-id="${c.id}">✕</button></div>`).join(""); }
  else if (a === "hzrm") { HZ.save(HZ.all().filter(c => c.id !== el.dataset.id)); el.closest(".amark").remove(); }
  else if (a === "selhz") { const s = String(getSelection()).trim(), rb = selRd() || $("#rb"); if (!s || !rb) return; const b = B(rb.dataset.id), p = +rb.dataset.p; getSelection().removeAllRanges(); const n = HZ.add([{ id: hzId(b.id, p, s), b: b.id, p, cue: hzCue(s), text: s.slice(0, 1500) }]); toast(n ? "أضيفت بطاقة حفظ؛ تجدها في «حفظ المتون»" : "البطاقة موجودة من قبل"); }
});
