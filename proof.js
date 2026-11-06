/* مراجعة اقتراحات تدقيق الكتب النصية (#/proof، للمدير ومن فُوّض «تعديل النصوص»): tools/proof.py يقترح تصحيحات قطعية
   (طباعة، إملاء، آية، عنوان، فصل حاشية) في data/proof/<id>.json؛ والمراجع يختار ما يعتمده فيُطبَّق على نص الكتاب في إيداع واحد. */
const PROOF = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/proof/" + p + "?t=" + Date.now();
  const getJ = async p => { try { const r = await fetch(RAW(p)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const KN = { "طباعة": "✍️", "إملاء": "🔤", "آية": "📖", "عنوان": "🔖", "حاشية": "📎" };
  async function page(q, id) {
    if (!(isAdmin() || can("edit"))) return view('<div class="note">مراجعة التدقيق للمدير ومن فُوّض تعديل النصوص.</div>');
    if (id) return book(id);
    const L = (await getJ("_list.json")) || {}, Q = (await getJ("_queue.json")) || { items: [] };
    view(`<div class="cmhero"><div><h2>تدقيق الكتب النصية</h2><p>اقتراحات تصحيح قطعية (طباعة، وإملاء، وألفاظ الآيات، والعناوين، وفصل الحواشي) يعدّها المدقق الآلي؛ لا يُطبَّق منها شيء إلا ما تعتمده.</p></div></div>
    <form id="prq" data-form="noop" class="card"><b>أضف كتابًا للتدقيق</b> <span class="mut">(كتب مكتبة الدعوة الإلكترونية تُدقَّق تلقائيًا؛ وأضف من المكتبة العامة ما تريد)</span><div class="row"><input name="t" list="prbooks" placeholder="اسم الكتاب" required><datalist id="prbooks">${BOOKS().filter(b => !b.demo && !b.ocr).slice(0, 1500).map(b => `<option value="${esc(b.setTitle || b.title)}">`).join("")}</datalist><button class="btn p">أضف</button></div><span id="prst" class="mut"></span></form>
    ${Q.items.length ? `<p class="mut">في الطابور: ${Q.items.map(x => esc((B(x.id || x) || {}).title || x.id || x)).join("، ")}</p>` : ""}
    <h3>الكتب</h3>${Object.entries(L).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<a class="bk" href="#/proof/${esc(k)}"><b>${esc(v.t)}</b><span>${toAr(v.n)} اقتراحًا • دُقّق ${toAr(v.done)} من ${toAr(v.of)} صفحة • ${esc(v.upd || "")}${v.ap ? " • اعتُمد " + toAr(v.ap) : ""}</span></a>`).join("") || '<p class="mut">لم تُدقَّق كتب بعد؛ تعمل المهمة يوميًا.</p>'}`);
    $("#prq").addEventListener("submit", async e => { e.preventDefault(); const t = e.target.t.value.trim(), b = lib.books.find(x => (x.setTitle || x.title) === t); if (!b) return toast("اختر من القائمة");
      try { await GH.editJSON("data/proof/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => (x.id || x) !== b.id).concat([{ id: b.id }]); return o; }, "تدقيق: «" + t + "»"); $("#prst").textContent = "✓ أُضيف؛ تبدأ المهمة خلال دقائق"; } catch (x) { toast(x.message); } });
  }
  async function book(id) {
    const R = await getJ(id + ".json"), b = B(id); if (!R || !b) return view('<p class="note">لا اقتراحات لهذا الكتاب بعد.</p>');
    const items = []; Object.entries(R.pages).sort((x, y) => +x[0] - +y[0]).forEach(([p, v]) => (v.fx || []).forEach((f, j) => items.push(Object.assign({ p: +p, j }, f))));
    view(`<p><a href="#/proof">← تدقيق الكتب</a></p><h2>${esc(b.setTitle || b.title)}</h2><p class="mut">${toAr(items.length)} اقتراحًا. راجع كل اقتراح في سياقه، ثم «اعتماد المختار».</p>
    <div class="row"><button class="btn s" data-act="prall" data-v="1">اختيار الكل</button><button class="btn s" data-act="prall" data-v="0">إلغاء الكل</button><button class="btn p" data-act="prapply" data-id="${esc(id)}">اعتماد المختار وتطبيقه</button> <span id="prst2" class="mut"></span></div>
    <div id="prl">${items.map((f, i) => `<label class="fbi prf"><input type="checkbox" data-i="${i}"${/عنوان|حاشية/.test(f.k) ? "" : " checked"}><div><small class="mut">${KN[f.k] || ""} ${esc(f.k)} • <a href="#/book/${esc(id)}/${f.p}" target="_blank">ص ${toAr(f.p)}</a> • ${esc(f.why)}</small><p><del>${esc(f.from)}</del> ← <ins>${esc(f.to)}</ins></p></div></label>`).join("") || '<p class="mut">لا اقتراحات.</p>'}</div>`);
    window.__PRI = items;
  }
  async function apply(id) {
    const pick = [...document.querySelectorAll("#prl input:checked")].map(x => window.__PRI[+x.dataset.i]); if (!pick.length) return toast("اختر اقتراحًا");
    const b = B(id), st = $("#prst2"); if (!confirm("تطبيق " + pick.length + " تصحيحًا على نص الكتاب؟")) return; st.textContent = "جارٍ التطبيق…";
    try { let done = 0, skip = 0;
      await GH.editJSON((b.vf ? "vols/" : "data/books/") + id + ".json", sh => { pick.forEach(f => { const t = sh.pages[f.p - 1]; if (typeof t === "string" && t.split(f.from).length === 2) { sh.pages[f.p - 1] = t.replace(f.from, f.to); done++; } else skip++; }); return sh; }, "تدقيق «" + (b.setTitle || b.title) + "»: " + pick.length + " تصحيحًا", true);
      await GH.editJSON("data/proof/" + id + ".json", R => { pick.forEach(f => { const pg = R.pages[String(f.p)]; if (pg) pg.fx = (pg.fx || []).filter(x => !(x.from === f.from && x.to === f.to)); }); return R; }, "تدقيق: اعتماد", true);
      await GH.editJSON("data/proof/_list.json", L => { if (L && L[id]) { L[id].n = Math.max(0, L[id].n - pick.length); L[id].ap = (L[id].ap || 0) + done; } return L; }, "تدقيق: اعتماد", true);
      if (b.pages) pick.forEach(f => { const t = b.pages[f.p - 1]; if (typeof t === "string") b.pages[f.p - 1] = t.replace(f.from, f.to); });
      st.textContent = `✓ طُبّق ${toAr(done)}${skip ? "، وتُخطّي " + toAr(skip) + " (تغيّر نصه)" : ""}`; setTimeout(() => book(id), 1200);
    } catch (e) { st.textContent = "تعذّر: " + (e.message || e); }
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "prall") document.querySelectorAll("#prl input").forEach(x => x.checked = el.dataset.v === "1"); else if (a === "prapply") apply(el.dataset.id); });
  return { view: page };
})();
