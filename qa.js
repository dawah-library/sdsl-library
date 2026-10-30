/* قسم «سؤال وجواب من الكتب»: أسئلة وأجوبة بنصها كما وردت في الكتب (لا صياغة من الذكاء الاصطناعي)، مع البحث والمشاركة والتصدير،
   ومراجعة آلية دورية وتصحيح يدوي من الإدارة (data/qa/_review.json). */
const QA = {
  idx: null, files: new Map(), rev: null,
  raw: p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/qa/" + p,
  async index() { if (!this.idx) { try { this.idx = (await (await fetch("data/qa/_index.json")).json()).items || []; } catch (e) { this.idx = []; } } await this.review(); return this.idx.filter(r => !(this.rev[r[0]] && this.rev[r[0]].s === "hide")); },
  async review() { if (this.rev) return this.rev; try { const r = await fetch(this.raw("_review.json") + "?t=" + Math.floor(Date.now() / 300e3)); this.rev = r.ok ? await r.json() : {}; } catch (e) { this.rev = {}; } return this.rev; },
  async item(bid, id) {
    if (!this.files.has(bid)) this.files.set(bid, fetch("data/qa/" + encodeURIComponent(bid) + ".json").then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })));
    const it = ((await this.files.get(bid)).items || []).find(x => x.id === id); if (!it) return null;
    const r = (await this.review())[id] || {}; return Object.assign({}, it, r.q ? { q: r.q } : {}, r.a ? { a: r.a } : {}, r.s === "ok" ? { ok: 1 } : {});
  },
  sel: new Set(ls.get("qa_sel", []))
};
const QAK = { sj: "سؤال وجواب", qil: "فإن قيل… قيل", suil: "سُئل فأجاب", head: "عنوان الباب", fatwa: "فتوى", gen: "سؤال مصوغ من النص" };
const qcol = bid => { const b = B(bid); return !b ? "" : b.type === "fatwa" ? "fatwa" : bc(b) === "dawah" ? "dawah" : "turath"; };

async function vQA(q, bid) {
  const f = q.c || "", s = q.q || "";
  view(`<div class="cmhero qa"><div><h2>سؤال وجواب من الكتب</h2><p>أسئلة وأجوبتها بنصها كما وردت في كتب المكتبة وفتاواها: «س… ج…»، و«فإن قيل… قيل»، و«سُئل… فأجاب»، والأبواب المعنونة بسؤال. كل جواب منقول بلفظه مع موضعه في الكتاب، وليس من صياغة الذكاء الاصطناعي.</p></div>
  <div class="row"><button class="btn" data-act="qaexp">⇩ تصدير المختار (<span id="qasel">${toAr(QA.sel.size)}</span>)</button></div></div>
  <form class="stepper" data-form="qasearch"><input name="q" type="search" value="${esc(s)}" placeholder="ابحث في الأسئلة: الصلاة، التوبة، البدعة…" aria-label="ابحث في الأسئلة"><button class="btn p">بحث</button></form>
  <div class="tabs" role="tablist">${[["", "الكل"], ["dawah", "كتب الدعوة"], ["fatwa", "الفتاوى"], ["turath", "المكتبة العامة"]].concat(isAdmin() ? [["flag", "🚩 علّمها التدقيق"]] : []).map(([v, l]) => `<a role="tab" aria-selected="${f === v}" href="#/qa${v || s ? "?" + new URLSearchParams(Object.assign(v ? { c: v } : {}, s ? { q: s } : {})) : ""}">${l}</a>`).join("")}</div>
  <div id="qalist" class="qalist"><p class="mut">جارٍ التحميل…</p></div><div id="qamore"></div>`);
  let L = await QA.index();
  if (bid) L = L.filter(r => r[2] === bid || r[2].startsWith(bid + "-v"));
  if (f === "flag") L = L.filter(r => (QA.rev[r[0]] || {}).s === "flag"); else if (f) L = L.filter(r => qcol(r[2]) === f);
  if (s) { const ws = norm(s).split(/\s+/).filter(Boolean); L = L.filter(r => { const n = norm(r[1]); return ws.every(w => n.includes(w)); }); }
  L.sort((a, b) => (b[5] || 0) - (a[5] || 0) || (qcol(a[2]) === "dawah" ? -1 : 0) - (qcol(b[2]) === "dawah" ? -1 : 0));
  window.__qaL = L; qaPage(0);
}
function qaRow(r) {
  const b = B(r[2]), on = QA.sel.has(r[2] + "|" + r[0]);
  return `<div class="qacard" data-id="${r[0]}" data-b="${esc(r[2])}"><button class="qaq" data-act="qaopen"><span class="qs">س</span><b>${esc(r[1])}</b></button>
  <div class="qameta mut">${b ? `<a href="#/book/${esc(r[2])}/${r[3]}">${esc(b.setTitle || b.title)}</a> • ${esc(PL(b, r[3] - 1) || "ص " + toAr(r[3]))}` : esc(r[2])} • ${QAK[r[4]] || ""}${r[5] || (QA.rev[r[0]] || {}).s === "ok" ? ' • <span class="ok">✓ مُراجَع</span>' : ""}${isAdmin() && (QA.rev[r[0]] || {}).s === "flag" ? ` • <span class="warn">🚩 ${esc(QA.rev[r[0]].why || "للمراجعة")}</span>` : ""}<label class="qachk"><input type="checkbox" data-act="qasel" ${on ? "checked" : ""}> للتصدير</label></div><div class="qaa" hidden></div></div>`;
}
function qaPage(k) {
  const L = window.__qaL || [], box = $("#qalist"); if (!box) return; const page = L.slice(k, k + 30);
  if (!k) box.innerHTML = page.length ? "" : '<p class="mut">لا توجد أسئلة مطابقة.</p>';
  box.insertAdjacentHTML("beforeend", page.map(qaRow).join(""));
  $("#qamore").innerHTML = k + 30 < L.length ? `<button class="btn" data-act="qanext" data-k="${k + 30}">المزيد (${toAr(L.length - k - 30)})</button>` : L.length ? `<p class="mut">${toAr(L.length)} سؤالًا</p>` : "";
}
async function qaOpen(card) {
  const box = card.querySelector(".qaa"); if (!box.hidden) { box.hidden = true; return; } box.hidden = false; box.innerHTML = '<p class="mut">…</p>';
  const it = await QA.item(card.dataset.b, card.dataset.id); if (!it) { box.textContent = "تعذر التحميل."; return; }
  const b = B(card.dataset.b), staff = isAdmin();
  box.innerHTML = `<div class="qaans"><span class="qs a">ج</span><div>${esc(it.a).replace(/\n/g, "<br>")}${it.more ? ` <a class="more-t" href="#/book/${esc(card.dataset.b)}/${it.p}">… تتمة الجواب في الكتاب ←</a>` : ""}</div></div>
  <div class="row qaact"><a class="btn s nf" href="#/book/${esc(card.dataset.b)}/${it.p}">📖 افتح الموضع</a><button class="btn s" data-act="qacopy">نسخ</button><button class="btn s" data-act="qashare">مشاركة</button><button class="btn s" data-act="qaimg">صمّم الاقتباس</button>${staff ? `<button class="btn s" data-act="qarev" data-s="ok">✓ اعتماد</button><button class="btn s" data-act="qaedit">تعديل</button><button class="btn s danger" data-act="qarev" data-s="hide">إخفاء</button>` : ""}</div>`;
  card._it = it;
}
const qaText = (it, bid) => { const b = B(bid); return `س: ${it.q}\nج: ${it.a}${it.more ? " …" : ""}\n— ${b ? (b.setTitle || b.title) + "، " + A(b.authorId).name + (PL(b, it.p - 1) ? "، " + PL(b, it.p - 1) : "، ص " + it.p) : bid}\n${SITENAME}${siteLink() ? "\n" + siteLink("#/book/" + bid + "/" + it.p) : ""}`; };
async function qaExport(f) {
  const keys = [...QA.sel]; if (!keys.length) return toast("اختر أسئلة أولًا بعلامة «للتصدير»");
  const items = []; for (const k of keys) { const [bid, id] = k.split("|"); const it = await QA.item(bid, id); if (it) items.push([bid, it]); }
  const T = t => expTash(t || ""), name = "سؤال وجواب من الكتب";
  const ref = (bid, it) => { const b = B(bid); return b ? `${b.setTitle || b.title}، ${A(b.authorId).name}، ${PL(b, it.p - 1) || "ص " + it.p}` : bid; };
  if (f === "txt") return dl(name + ".txt", items.map(([bid, it]) => qaText({ q: T(it.q), a: T(it.a), p: it.p, more: it.more }, bid)).join("\n\n———\n\n"), "text/plain");
  if (f === "md") return dl(name + ".md", "# " + name + "\n\n" + items.map(([bid, it]) => `**س: ${T(it.q)}**\n\nج: ${T(it.a)}\n\n— ${ref(bid, it)}`).join("\n\n---\n\n"), "text/markdown");
  if (f === "json") return dl(name + ".json", JSON.stringify(items.map(([bid, it]) => ({ q: T(it.q), a: T(it.a), book: (B(bid) || {}).title, page: it.p, ref: ref(bid, it) })), null, 2), "application/json");
  if (f === "csv") { const c = v => `"${String(v).replace(/"/g, '""')}"`; return dl(name + ".csv", ["السؤال,الجواب,المرجع"].concat(items.map(([bid, it]) => [T(it.q), T(it.a), ref(bid, it)].map(c).join(","))).join("\n"), "text/csv"); }
  const H = s => esc(s || ""), html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${name}</title><style>body{font-family:Amiri,"Traditional Arabic",serif;font-size:16pt;line-height:1.9;margin:2cm}h1{text-align:center}.q{font-weight:700;color:#0b5c4d}.it{margin-bottom:18pt;page-break-inside:avoid}.r{color:#777;font-size:12pt}</style></head><body><h1>${name}</h1>${items.map(([bid, it]) => `<div class="it"><p class="q">س: ${H(T(it.q))}</p><p>ج: ${H(T(it.a)).replace(/\n/g, "<br>")}</p><p class="r">${H(ref(bid, it))}</p></div>`).join("")}<p class="r" style="text-align:center">${H(SITENAME)}</p></body></html>`;
  if (f === "doc") return dl(name + ".doc", html, "application/msword");
  const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); w.document.write(html + "<script>onload=()=>setTimeout(()=>print(),300)<\/script>"); w.document.close();
}
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el || !/^qa/.test(el.dataset.act)) return; const a = el.dataset.act, card = el.closest(".qacard");
  if (a !== "qasel") e.preventDefault();
  try {
    if (a === "qaopen") qaOpen(card);
    else if (a === "qanext") { el.remove(); qaPage(+el.dataset.k); }
    else if (a === "qasel") { const k = card.dataset.b + "|" + card.dataset.id; el.checked ? QA.sel.add(k) : QA.sel.delete(k); ls.set("qa_sel", [...QA.sel]); const n = $("#qasel"); if (n) n.textContent = toAr(QA.sel.size); }
    else if (a === "qacopy") { await navigator.clipboard.writeText(qaText(card._it, card.dataset.b)); toast("نُسخ السؤال والجواب مع المرجع"); }
    else if (a === "qashare") { const t = qaText(card._it, card.dataset.b); if (navigator.share) await navigator.share({ text: t }).catch(() => { }); else { await navigator.clipboard.writeText(t); toast("نُسخ للمشاركة"); } }
    else if (a === "qaimg") { const it = card._it, b = B(card.dataset.b); pendingQ = { t: ("س: " + it.q + "\nج: " + it.a).slice(0, 700), src: b ? (b.setTitle || b.title) + " — " + A(b.authorId).name : "", ref: { b: card.dataset.b, p: it.p } }; location.hash = "#/qabasat"; }
    else if (a === "qaexp") openDlg(`<h3>تصدير الأسئلة المختارة (${toAr(QA.sel.size)})</h3><div class="tools-grid"><button data-act="qaexpf" data-f="doc">ملف Word</button><button data-act="qaexpf" data-f="pdf">PDF (طباعة)</button><button data-act="qaexpf" data-f="txt">نص عادي</button><button data-act="qaexpf" data-f="md">Markdown</button><button data-act="qaexpf" data-f="json">JSON</button><button data-act="qaexpf" data-f="csv">جدول CSV</button></div><p class="mut">التشكيل في الملف يتبع اختيار «إظهار التشكيل».</p><button class="btn s" data-act="qaclr">إفراغ الاختيار</button>`);
    else if (a === "qaexpf") { await qaExport(el.dataset.f); dlg().close(); }
    else if (a === "qaclr") { QA.sel.clear(); ls.set("qa_sel", []); dlg().close(); route(); }
    else if (a === "qarev" || a === "qaedit") {
      if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا.");
      let patch = { s: el.dataset.s };
      if (a === "qaedit") { const it = card._it; const nq = prompt("نص السؤال:", it.q); if (nq === null) return; const na = prompt("حدود الجواب (يُنسخ من نص الكتاب نفسه، ويمكن حذف ما زاد منه):", it.a); if (na === null) return; patch = { q: nq.trim(), a: na.trim(), s: "ok" }; }
      await GH.editJSON("data/qa/_review.json", o => { o = o || {}; o[card.dataset.id] = Object.assign(o[card.dataset.id] || {}, patch, { by: "admin", at: today() }); return o; }, "سؤال وجواب: مراجعة يدوية", true);
      QA.rev = null; toast(patch.s === "hide" ? "أُخفي السؤال" : "حُفظت المراجعة"); if (patch.s === "hide") card.remove(); else { card.querySelector(".qaa").hidden = true; qaOpen(card); }
    }
  } catch (x) { toast(x.message || "تعذر"); }
});
document.addEventListener("submit", e => { const f = e.target.closest('[data-form="qasearch"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const p = new URLSearchParams(parse().q); f.q.value.trim() ? p.set("q", f.q.value.trim()) : p.delete("q"); go("#/qa" + (p.toString() ? "?" + p : "")); }, true);
