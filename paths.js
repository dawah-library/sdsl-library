/* المسارات العلمية: برامج دراسة متدرجة من كتب المكتبة، يُحسب التقدم فيها من القراءة الفعلية (أبعد صفحة بلغها القارئ في كل كتاب)،
   مع اختبار قصير في كل كتاب بالمساعد العلمي، وشهادة إتمام قراءة من المكتبة تُنزَّل صورةً عند إتمام المسار. */
let PATHS = null;
async function loadPaths() { if (!PATHS) { try { PATHS = (await (await fetch("data/paths.json")).json()).paths || []; } catch (e) { PATHS = []; } } return PATHS.map(p => Object.assign({}, p, { books: p.books.filter(id => B(id)) })).filter(p => p.books.length); }
const pathPct = id => { const b = B(id); if (!b || !b.n) return 0; return Math.min(100, Math.round(100 * ((S.maxBy || {})[id] || (S.lastBy || {})[id] || 0) / b.n)); };
async function vPaths(q, pid) {
  const P = await loadPaths();
  if (pid) {
    const p = P.find(x => x.id === pid); if (!p) return view('<p class="note">المسار غير موجود.</p>');
    const quiz = ls.get("pquiz", {}), pcts = p.books.map(pathPct), done = p.books.every((id, i) => pcts[i] >= 90 && quiz[id]);
    view(`<p><a href="#/paths">← المسارات العلمية</a></p><div class="cmhero ph"><div><h2>${esc(p.t)}</h2><p>${esc(p.d)}</p></div></div>
    <ol class="pathl">${p.books.map((id, i) => { const b = B(id); return `<li class="${pcts[i] >= 90 ? "done" : ""}"><div><b>${esc(b.setTitle || b.title)}</b><span class="mut">${esc(A(b.authorId).name)}${b.n ? " • " + toAr(b.n) + " صفحة" : ""}</span><div class="prog"><i style="width:${pcts[i]}%"></i></div><small class="mut">قرأت ${toAr(pcts[i])}٪${quiz[id] ? " • ✓ اختبرت نفسك" : ""}</small></div>
    <div class="row"><a class="btn s p nf" href="#/book/${id}/${Math.max(1, (S.lastBy || {})[id] || 1)}">${pcts[i] ? "أكمل" : "ابدأ"}</a><a class="btn s nf" href="#/ask?q=${encodeURIComponent("اختبرني في كتاب «" + (b.setTitle || b.title) + "» بعشرة أسئلة متدرجة مع الإجابات وتعليلها")}" data-act="pquiz" data-id="${id}">اختبر نفسك</a></div></li>`; }).join("")}</ol>
    ${done ? `<div class="card cert"><h3>أتممت المسار، بارك الله فيك</h3><p>نزّل شهادة إتمام القراءة باسمك.</p><form data-form="cert" data-id="${p.id}" class="stepper"><input name="n" required maxlength="60" placeholder="اسمك كما تريده في الشهادة" value="${esc((Auth.user && Auth.user.name) || "")}"><button class="btn p">نزّل الشهادة</button></form></div>` : `<p class="mut">تُتاح شهادة إتمام القراءة عند بلوغ ٩٠٪ من كل كتاب في المسار واختبار نفسك فيه.</p>`}`);
    return;
  }
  view(`<div class="cmhero ph"><div><h2>المسارات العلمية</h2><p>برامج دراسة متدرجة من كتب المكتبة. يُحسب تقدمك من قراءتك الفعلية، وفي كل كتاب اختبار قصير، وعند إتمام المسار شهادة إتمام قراءة من المكتبة.</p></div></div>
  <div class="grid">${P.map(p => { const pc = Math.round(p.books.map(pathPct).reduce((s, x) => s + x, 0) / p.books.length); return `<a class="card" href="#/paths/${p.id}"><b>${esc(p.t)}</b><span>${toAr(p.books.length)} كتب • ${toAr(pc)}٪</span><i class="prog" style="--w:${pc}%"></i></a>`; }).join("")}</div>`);
}
async function cert(pid, name) {
  const p = (await loadPaths()).find(x => x.id === pid); if (!p) return; await document.fonts.ready;
  const W = 1600, H = 1130, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, H); x.strokeStyle = "#b88a2e"; x.lineWidth = 14; x.strokeRect(40, 40, W - 80, H - 80); x.strokeStyle = "#0f5c4d"; x.lineWidth = 4; x.strokeRect(70, 70, W - 140, H - 140);
  const logo = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = "assets/logo-sdsl.png"; }); if (logo) x.drawImage(logo, W / 2 - 80, 110, 160, 160);
  x.direction = "rtl"; x.textAlign = "center"; x.fillStyle = "#0f5c4d"; x.font = 'bold 64px Amiri, serif'; x.fillText("شهادة إتمام قراءة", W / 2, 350);
  x.fillStyle = "#2a241a"; x.font = '34px Amiri, serif'; x.fillText("تشهد " + SITENAME + " بأن", W / 2, 430);
  x.fillStyle = "#5a3f12"; x.font = 'bold 72px Amiri, serif'; x.fillText(name, W / 2, 530);
  x.fillStyle = "#2a241a"; x.font = '34px Amiri, serif'; x.fillText("أتمّ قراءة مسار «" + p.t + "» واختبر نفسه في كتبه:", W / 2, 610);
  x.font = '30px Amiri, serif'; const bt = p.books.map(id => "«" + (B(id).setTitle || B(id).title) + "»").join("، "); const words = bt.split(" "); let line = "", y = 670; words.forEach(w => { if (x.measureText(line + " " + w).width > W - 300) { x.fillText(line, W / 2, y); y += 46; line = w; } else line = line ? line + " " + w : w; }); x.fillText(line, W / 2, y);
  x.fillStyle = "#5b6b66"; x.font = '26px "IBM Plex Sans Arabic", sans-serif'; x.fillText("نسأل الله أن ينفعه بما قرأ، وأن يرزقه العلم النافع والعمل الصالح", W / 2, H - 230);
  x.fillText("التاريخ: " + new Date().toLocaleDateString("ar-EG", { dateStyle: "long" }) + "  •  " + (CFG.siteUrl || "dawahlibrary.org"), W / 2, H - 180);
  x.font = '20px "IBM Plex Sans Arabic", sans-serif'; x.fillText("شهادة تشجيعية بإتمام القراءة الذاتية، وليست إجازة علمية", W / 2, H - 120);
  c.toBlob(b => dl("شهادة-" + p.t + ".png", b), "image/png");
}
document.addEventListener("click", e => { const el = e.target.closest('[data-act="pquiz"]'); if (!el) return; const q = ls.get("pquiz", {}); q[el.dataset.id] = today(); ls.set("pquiz", q); });
document.addEventListener("submit", e => { const f = e.target.closest('[data-form="cert"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); cert(f.dataset.id, f.n.value.trim()); }, true);
