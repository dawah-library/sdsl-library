/* قسم «تشجير الكتب»: خرائط ذهنية لكتب الدعوة بثلاثة مستويات (عام، متوسط للفصول، تفصيلي للموضوعات)،
   مع اختيار نطاق الصفحات، والتصدير صورةً أو PDF، والمشاركة. لا يُشجَّر كتاب إلا باختيار الإدارة، ولا يظهر للأعضاء إلا بعد اعتمادها. */
const TSJ = {
  raw: p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/tashjir/" + p + "?t=" + Math.floor(Date.now() / 300e3),
  list: null, maps: new Map(),
  async index() { if (!this.list) { try { const r = await fetch(this.raw("_list.json")); this.list = r.ok ? await r.json() : {}; } catch (e) { this.list = {}; } } return this.list; },
  async map(id) { if (!this.maps.has(id)) this.maps.set(id, fetch(this.raw(id + ".json")).then(r => r.ok ? r.json() : null).catch(() => null)); return this.maps.get(id); }
};
const TJC = ["#0f5c4d", "#b88a2e", "#6b4fa3", "#1f6f8b", "#a3462f", "#3c7a3b", "#8a5a2b", "#2f5e9e"];
const ov = (p, a, z) => !p || !(a || z) || (p[1] >= (a || 1) && p[0] <= (z || 1e9));
function tjFilter(n, lvl, a, z, d = 0) {
  if (!ov(n.p, a, z) && d > 0) return null;
  const kids = d + 1 < lvl + 1 ? (n.c || []).map(c => tjFilter(c, lvl, a, z, d + 1)).filter(Boolean) : [];
  return Object.assign({}, n, { c: kids });
}
// المستويات: 1 عام (الأقسام والفصول) • 2 متوسط (+ الموضوعات) • 3 تفصيلي (+ النقاط)
function tjNode(n, d, ci, bid) {
  const col = TJC[ci % TJC.length], pg = Array.isArray(n.p) ? `ص ${toAr(n.p[0])}${n.p[1] && n.p[1] !== n.p[0] ? "–" + toAr(n.p[1]) : ""}` : n.p ? "ص " + toAr(n.p) : "";
  const pp = Array.isArray(n.p) ? n.p[0] : n.p, flag = n.v === 0 ? ' <span class="tjflag" title="العبارة لم تُطابق نص الصفحة">؟</span>' : n.r === "bad" ? ' <span class="tjflag">!</span>' : "";
  return `<li class="tjn d${d}" style="--c:${col}"><div class="tjcard"><b>${esc(n.t || "")}${flag}</b>${n.s ? `<p>${esc(n.s)}</p>` : ""}${n.q ? `<q>${esc(n.q)}</q>` : ""}${pp ? `<a class="tjp" href="#/book/${esc(bid)}/${pp}">${pg}</a>` : ""}</div>${n.c && n.c.length ? `<ul>${n.c.map((c, i) => tjNode(c, d + 1, d === 0 ? i : ci, bid)).join("")}</ul>` : ""}</li>`;
}
async function vTashjir(q, id) {
  if (!id) {
    view(`<div class="cmhero tj"><div><h2>تشجير الكتب</h2><p>خرائط ذهنية لكتب مشايخ الدعوة توضّح بناء الكتاب وأفكاره: تشجير عام للكتاب، ومتوسط للفصول والأبواب، وتفصيلي للموضوعات ونقاطها، وكل غصن مربوط بصفحته.</p></div></div><div id="tjbox" class="mut">جارٍ التحميل…</div>`);
    const L = await TSJ.index(), staff = isAdmin(), ids = Object.keys(L).filter(k => L[k].ok || staff);
    const box = $("#tjbox"); if (!box) return; box.className = "";
    box.innerHTML = (ids.length ? `<div class="agrid">${ids.map(k => { const b = B(k); return `<a class="acard2" href="#/tashjir/${k}"><span class="acov" style="${avHue(k)}"><i>🌳</i><em>${esc((b ? b.setTitle || b.title : L[k].t).split(/\s+/).slice(0, 3).join(" "))}</em></span><b>${esc(b ? b.setTitle || b.title : L[k].t)}</b><small class="mut">${toAr(L[k].n || 0)} نقطة${L[k].ok ? "" : " • معاينة للإدارة"}</small></a>`; }).join("")}</div>` : `<div class="card soon"><h3>قريبًا بإذن الله</h3><p>تُشجَّر كتب الدعوة تباعًا بعد تدقيق نصوصها ومطابقتها بالنسخ المصورة، وتختار الإدارة الكتب المعروضة.</p></div>`)
      + (staff ? tjAdminForm(L) : "");
    return;
  }
  const L = await TSJ.index(), inf = L[id] || {};
  if (!inf.ok && !isAdmin()) return view('<p class="note">هذا التشجير غير منشور بعد.</p><p><a href="#/tashjir">← تشجير الكتب</a></p>');
  view('<p class="mut">جارٍ تحميل التشجير…</p>');
  const m = await TSJ.map(id); if (!m) return view('<p class="note">التشجير غير متاح.</p>');
  const lvl = Math.min(3, Math.max(1, +q.lvl || 2)), a = +q.from || 0, z = +q.to || 0, b = B(id);
  const tree = tjFilter({ t: m.t, s: m.s, p: m.p, c: m.c }, lvl + 1, a, z);
  const url = o => "#/tashjir/" + id + "?" + new URLSearchParams(Object.assign({ lvl, ...(a ? { from: a } : {}), ...(z ? { to: z } : {}) }, o));
  view(`<p><a href="#/tashjir">← تشجير الكتب</a></p><div class="tjhead"><h2>${esc(m.t)}</h2><p class="mut">${esc(m.a || "")}${inf.ok ? "" : " • معاينة للإدارة — غير منشور"}</p></div>
  <div class="seg tjlvl">${[[1, "عام"], [2, "متوسط"], [3, "تفصيلي"]].map(([v, l]) => `<a href="${url({ lvl: v })}" class="${v === lvl ? "on" : ""}">${l}</a>`).join("")}</div>
  <form class="row tjrange" data-form="tjrange" data-id="${id}" data-lvl="${lvl}"><label>من صفحة <input name="a" type="number" min="1" value="${a || ""}"></label><label>إلى صفحة <input name="z" type="number" min="1" value="${z || ""}"></label><button class="btn s">عرض النطاق</button>${a || z ? `<a class="btn s" href="${url({ from: "", to: "" }).replace(/&?(from|to)=(&|$)/g, "")}">الكتاب كله</a>` : ""}</form>
  <div class="row tjtools"><button class="btn s" data-act="tjpng">⇩ صورة PNG</button><button class="btn s" data-act="tjpdf">PDF (طباعة)</button><button class="btn s" data-act="tjshare">مشاركة</button><button class="btn s" data-act="tjall">طيّ/فتح الكل</button>${isAdmin() ? `<button class="btn s" data-act="tjok" data-id="${id}" data-on="${inf.ok ? 0 : 1}">${inf.ok ? "إيقاف العرض" : "اعتماد العرض للأعضاء"}</button><button class="btn s" data-act="tjre" data-id="${id}">إعادة التشجير</button>` : ""}</div>
  <p class="mut tjnote">التشجير مساعد على الفهم والمراجعة، وهو من إعداد آلي راجعته جولة تدقيق ثانية؛ والمرجع نص الكتاب بالضغط على رقم الصفحة. علامة «؟» تعني عبارة لم تطابق نص الصفحة بعد.</p>
  <div class="tjwrap" id="tjwrap"><ul class="tj">${tjNode(tree, 0, 0, id)}</ul></div>`);
  window.__tj = { m, tree, id, lvl, a, z };
}
function tjAdminForm(L) {
  const bs = lib.books.filter(b => kindOf(b) === "book" && bc(b) === "dawah" && !b.demo && !VOL2(b));
  return `<div class="card" style="margin-top:14px"><h3>اختيار كتاب للتشجير (للإدارة)</h3><p class="mut">لا يُشجَّر إلا ما تختاره هنا. يُفضَّل اختيار الكتب التي اكتمل تدقيق نصها ومطابقتها بالمصورة.</p><form data-form="tjq" class="stepper"><select name="b">${bs.map(b => `<option value="${b.id}">${esc(b.setTitle || b.title)}${L[b.id] ? " ✓" : ""}${b.unrev || b.lite ? " (لم يكتمل تدقيقه)" : ""}</option>`).join("")}</select><button class="btn p">شجّر هذا الكتاب</button></form></div>`;
}
/* التصدير صورة: رسم الشجرة الظاهرة على لوحة */
function tjCanvas() {
  const T = window.__tj; if (!T) return null;
  const rows = []; const walk = (n, d, ci) => { rows.push({ n, d, ci }); (n.c || []).forEach((c, i) => walk(c, d + 1, d === 0 ? i : ci)); }; walk(T.tree, 0, 0);
  const W = 1400, PAD = 40, IND = 46, cv = document.createElement("canvas"), x = cv.getContext("2d"), font = `"IBM Plex Sans Arabic","Amiri",sans-serif`;
  const wrap = (t, w, f) => { x.font = f; const ws = String(t || "").split(/\s+/), L = []; let l = ""; ws.forEach(s => { const tt = l ? l + " " + s : s; if (x.measureText(tt).width > w && l) { L.push(l); l = s; } else l = tt; }); if (l) L.push(l); return L; };
  let y = PAD + 70; const lay = rows.map(r => { const w = W - PAD * 2 - r.d * IND - 20, f1 = `bold ${r.d ? 22 - Math.min(r.d, 3) * 2 : 30}px ${font}`, f2 = `17px ${font}`; const t = wrap(r.n.t, w - 24, f1), s = r.n.s && r.d < 3 ? wrap(r.n.s, w - 24, f2) : []; const h = 18 + t.length * (r.d ? 28 : 38) + s.length * 25 + 14; const o = { r, y, h, w, t, s, f1, f2 }; y += h + 12; return o; });
  cv.width = W; cv.height = y + PAD + 40; x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, cv.height); x.direction = "rtl"; x.textAlign = "right";
  x.fillStyle = "#0f5c4d"; x.font = `bold 26px ${font}`; x.fillText(SITENAME + " — تشجير الكتب", W - PAD, PAD + 20);
  lay.forEach((o, i) => {
    const col = TJC[o.r.ci % TJC.length], right = W - PAD - o.r.d * IND, left = right - o.w;
    if (o.r.d) { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.moveTo(right + IND / 2, o.y - 12); x.lineTo(right + IND / 2, o.y + 22); x.lineTo(right, o.y + 22); x.stroke(); }
    x.fillStyle = o.r.d ? "#ffffff" : col; x.strokeStyle = col; x.lineWidth = o.r.d ? 2 : 0;
    const R = 14; x.beginPath(); x.moveTo(left + R, o.y); x.arcTo(right, o.y, right, o.y + o.h, R); x.arcTo(right, o.y + o.h, left, o.y + o.h, R); x.arcTo(left, o.y + o.h, left, o.y, R); x.arcTo(left, o.y, right, o.y, R); x.closePath(); x.fill(); if (o.r.d) x.stroke();
    if (o.r.d) { x.fillStyle = col; x.fillRect(right - 6, o.y, 6, o.h); }
    let yy = o.y + 14; x.fillStyle = o.r.d ? "#14231f" : "#ffffff"; x.font = o.f1; o.t.forEach(l => { yy += o.r.d ? 28 : 38; x.fillText(l, right - 16, yy - 8); });
    x.font = o.f2; x.fillStyle = o.r.d ? "#5b6b66" : "#e8f3ef"; o.s.forEach(l => { yy += 25; x.fillText(l, right - 16, yy - 6); });
    const p = Array.isArray(o.r.n.p) ? o.r.n.p[0] : o.r.n.p; if (p) { x.textAlign = "left"; x.font = `15px ${font}`; x.fillStyle = o.r.d ? col : "#ffffff"; x.fillText("ص " + p, left + 12, o.y + 26); x.textAlign = "right"; }
  });
  x.fillStyle = "#5b6b66"; x.font = `16px ${font}`; x.textAlign = "center"; x.fillText((T.m.t || "") + (T.a || T.z ? `  •  من ص ${T.a || 1} إلى ص ${T.z || T.m.p[1]}` : ""), W / 2, cv.height - 24);
  return cv;
}
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act]"); if (!el || !/^tj/.test(el.dataset.act)) return; e.preventDefault(); const a = el.dataset.act, T = window.__tj;
  try {
    if (a === "tjpng" || a === "tjshare") {
      await document.fonts.ready; const cv = tjCanvas(); if (!cv) return; const blob = await new Promise(r => cv.toBlob(r, "image/png")), name = "تشجير-" + (T.m.t || "") + ".png";
      if (a === "tjshare" && navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: "image/png" })] })) await navigator.share({ files: [new File([blob], name, { type: "image/png" })], text: T.m.t + " — " + SITENAME + (siteLink() ? "\n" + siteLink(location.hash || location.pathname + location.search) : "") }).catch(() => { });
      else if (a === "tjshare") { await navigator.clipboard.writeText((siteLink() || location.origin + "/") + location.hash.replace(/^#\//, "")); toast("نُسخ رابط التشجير بنطاقه ومستواه"); }
      else await dl(name, blob);
    }
    else if (a === "tjpdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); await document.fonts.ready; const u = tjCanvas().toDataURL("image/png"); w.document.write(`<!doctype html><title>${esc(T.m.t)}</title><style>body{margin:0}img{width:100%}</style><img src="${u}"><script>onload=()=>setTimeout(()=>print(),300)<\/script>`); w.document.close(); }
    else if (a === "tjall") { const cards = document.querySelectorAll(".tj ul"); const hide = [...cards].some(u => !u.hidden); document.querySelectorAll(".tj .tjn.d1>ul,.tj .tjn.d2>ul,.tj .tjn.d3>ul").forEach(u => u.hidden = hide); }
    else if (a === "tjok") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const on = el.dataset.on === "1"; if (on && !confirm("هل راجعت التشجير وتريد عرضه للأعضاء؟")) return; await GH.editJSON("data/tashjir/_list.json", o => { if (o[el.dataset.id]) o[el.dataset.id].ok = on ? 1 : 0; return o; }, (on ? "اعتماد تشجير: " : "إيقاف تشجير: ") + el.dataset.id, true); TSJ.list = null; toast(on ? "اعتُمد التشجير" : "أوقف العرض"); route(); }
    else if (a === "tjre") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); if (!confirm("إعادة تشجير الكتاب من جديد؟")) return; await GH.editJSON("data/tashjir/_queue.json", o => { o = o || { items: [] }; o.items = [{ id: el.dataset.id }].concat((o.items || []).filter(x => (x.id || x) !== el.dataset.id)); return o; }, "تشجير: إعادة " + el.dataset.id); toast("يُعاد التشجير خلال دقائق، ويصلك إشعار"); }
  } catch (x) { toast(x.message || "تعذر"); }
});
document.addEventListener("click", e => { const c = e.target.closest(".tj .tjcard"); if (!c || e.target.closest("a")) return; const u = c.parentElement.querySelector(":scope>ul"); if (u) u.hidden = !u.hidden; });
document.addEventListener("submit", async e => {
  const f = e.target.closest('[data-form="tjrange"],[data-form="tjq"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
  if (f.dataset.form === "tjrange") { const p = new URLSearchParams({ lvl: f.dataset.lvl }); if (+f.a.value) p.set("from", f.a.value); if (+f.z.value) p.set("to", f.z.value); go("#/tashjir/" + f.dataset.id + "?" + p); return; }
  try { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const id = f.b.value; await GH.editJSON("data/tashjir/_queue.json", o => { o = o || { items: [] }; o.items = [{ id }].concat((o.items || []).filter(x => (x.id || x) !== id)); return o; }, "تشجير: «" + ((B(id) || {}).title || id) + "»"); toast("بدأ تشجير الكتاب؛ يصلك إشعار عند الانتهاء، ثم تراجعه وتعتمده"); } catch (x) { toast(x.message); }
}, true);
