/* الوصايا قالبًا للمشاركة، و«مجموعاتي» (طلب المدير، ٢٧ نوفمبر — البند ١٧ من وثيقة الطلبات غير المنفذة).
   - «🖼 مشاركة كقالب» من بطاقة الوصية: صورة PNG بأنماط ومقاسات (مربع، قصة، عريض)، بتوقيع العضو، وصورة من مكتبته (غلاف كتاب من رفوفه أو غلاف مصدر الوصية)،
     وهوية الموقع ظاهرة؛ وإخفاؤها لا يُتاح إلا إن أوقف صاحب المشروع مفتاح «ws_brand» في الخدمات والمفاتيح.
   - «＋ إلى مجموعاتي»: يحفظ العضو مجموعات من الوصايا بأسماء يختارها (S.wsets، تُزامَن مع حسابه عبر Prefs)، ويعيد نشرها ونسخها وتحميلها
     (نص، Word، PDF، وصور القوالب)، ويضبط لها موعد نشر يذكّره به جرس الإشعارات.
   النص ينقل كما هو من data/quotes.json بمصدره (الكتاب والصفحة)، ولا يُعدَّل. */
const WSX = (() => {
  const SETS = () => (Array.isArray(S.wsets) ? S.wsets : (S.wsets = []));
  const save = () => { saveS(); try { Prefs.push(); } catch (e) { } };
  const head = q => q.k === "آية" ? "قال الله تعالى:" : q.k === "حديث" ? "قال رسول الله ﷺ:" : q.who ? (/^(سُ?ئِ?ل|سئل|رُ?وي|روي|عن )/.test(q.who) ? q.who + ":" : "قال " + q.who + ":") : q.author ? "ذكر " + q.author + ":" : "";
  const txt = q => q.k === "آية" ? `﴿${q.t}﴾` : q.k === "حديث" || q.k === "أثر" ? `«${q.t}»` : q.t;
  const src = q => `${q.title}${q.author ? "، " + q.author : ""}، ص ${toAr(q.p)}`;
  const key = q => [q.b, q.p, String(q.t || "").slice(0, 30)].join("|");
  const slim = q => ({ t: q.t, k: q.k, who: q.who, ref: q.ref, b: q.b, p: q.p, title: q.title, author: q.author });
  const line = q => `${head(q) ? head(q) + "\n" : ""}${txt(q)}${q.ref ? "\n" + q.ref : ""}\n[${q.title}${q.author ? "، " + q.author : ""}، ص ${q.p}]`;
  const myName = () => { try { return (S.wsSig != null ? S.wsSig : (Auth.user && Auth.user.name)) || ""; } catch (e) { return ""; } };

  /* ===== القالب ===== */
  const STY = {
    navy: { n: "أزرق ليلي", bg: ["#0f2747", "#1f4f8a"], ink: "#ffffff", sub: "#c9d8ee", acc: "#d9ae55", panel: "rgba(255,255,255,.06)" },
    green: { n: "أخضر المكتبة", bg: ["#0e3b30", "#1d6b55"], ink: "#ffffff", sub: "#cfe6dd", acc: "#e3c27a", panel: "rgba(255,255,255,.06)" },
    paper: { n: "ورقي", bg: ["#f8f1e0", "#efe2c4"], ink: "#2b1d10", sub: "#6d5a45", acc: "#a8741a", panel: "rgba(120,80,20,.06)" },
    plain: { n: "أبيض بسيط", bg: ["#ffffff", "#f4f6f8"], ink: "#1b2430", sub: "#5b6672", acc: "#1f5fa8", panel: "rgba(31,95,168,.05)" },
  };
  const SIZ = { sq: ["مربع (منشور)", 1080, 1080], story: ["قصة / حالة", 1080, 1920], wide: ["عريض (رابط)", 1200, 630] };
  const img = u => new Promise(r => { if (!u) return r(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => r(i); i.onerror = () => r(null); i.src = u; });
  const coverUrl = id => (typeof COVERS !== "undefined" && COVERS.has(id)) ? `assets/covers/${id}.jpg${COVERS.get(id) ? "?v=" + COVERS.get(id) : ""}` : "";
  // صور من مكتبة العضو: أغلفة كتب رفوفه (أقرأ الآن، أريد قراءته، أتممته) ومصدر الوصية، مما له غلاف
  function libImages(q) {
    const sh = S.shelves || {}, ids = [q.b].concat(sh.now || [], sh.done || [], sh.want || []);
    return [...new Set(ids)].filter(id => coverUrl(id)).slice(0, 12).map(id => ({ id, u: coverUrl(id), t: ((typeof B === "function" && B(id)) || {}).title || id }));
  }
  function wrap(ctx, t, maxW) {
    const out = []; String(t).split("\n").forEach(par => { let ln = ""; par.split(/\s+/).forEach(w => { const x = ln ? ln + " " + w : w; if (ctx.measureText(x).width > maxW && ln) { out.push(ln); ln = w; } else ln = x; }); if (ln) out.push(ln); }); return out;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function render(q, o) {
    const st = STY[o.sty] || STY.navy, [, W, H] = SIZ[o.siz] || SIZ.sq, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"); c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "alphabetic";
    try { await Promise.all(["700 40px Amiri", "400 40px Amiri", "400 20px Tajawal"].map(f => document.fonts.load(f))); } catch (e) { }
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, st.bg[0]); g.addColorStop(1, st.bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // زخرفة خفيفة وإطار
    c.strokeStyle = st.acc; c.globalAlpha = .55; c.lineWidth = 3; rr(c, 34, 34, W - 68, H - 68, 28); c.stroke(); c.globalAlpha = 1;
    c.fillStyle = st.panel; rr(c, 60, 60, W - 120, H - 120, 22); c.fill();
    const pad = 110, maxW = W - pad * 2, wide = o.siz === "wide";
    // الصورة من مكتبته
    let top = wide ? 90 : 150; const im = await img(o.img);
    if (im) { const ih = wide ? 150 : 240, iw = Math.round(im.width * ih / im.height), ix = (W - iw) / 2; c.save(); rr(c, ix, top, iw, ih, 14); c.clip(); c.drawImage(im, ix, top, iw, ih); c.restore(); c.strokeStyle = st.acc; c.lineWidth = 3; rr(c, ix, top, iw, ih, 14); c.stroke(); top += ih + (wide ? 30 : 60); }
    const hd = head(q); if (hd) { c.fillStyle = st.acc; c.font = `700 ${wide ? 34 : 46}px Amiri`; c.fillText(hd, W / 2, top + 30); top += wide ? 60 : 90; }
    // النص: أكبر خط يسع المساحة
    const bottomRes = (o.sig ? 70 : 0) + (o.brand ? 110 : 30) + 120, avail = H - top - bottomRes; let fs = wide ? 48 : 64, lines;
    for (; fs >= 26; fs -= 2) { c.font = `400 ${fs}px Amiri`; lines = wrap(c, txt(q), maxW); if (lines.length * fs * 1.75 <= avail) break; }
    c.fillStyle = st.ink; c.font = `400 ${fs}px Amiri`; const lh = fs * 1.75, y0 = top + Math.max(0, (avail - lines.length * lh) / 2) + fs;
    lines.forEach((l, i) => c.fillText(l, W / 2, y0 + i * lh)); let y = y0 + lines.length * lh;
    c.fillStyle = st.sub; c.font = `400 ${wide ? 24 : 30}px Amiri`;
    if (q.ref) { c.fillText(q.ref, W / 2, y); y += wide ? 34 : 46; }
    c.fillText("📚 " + src(q), W / 2, y + 6);
    // التوقيع والهوية
    let fy = H - 90;
    if (o.brand) { c.fillStyle = st.acc; c.font = `700 ${wide ? 26 : 32}px Amiri`; c.fillText(SITENAME, W / 2, fy); c.fillStyle = st.sub; c.font = `400 ${wide ? 20 : 24}px Tajawal, sans-serif`; c.direction = "ltr"; c.fillText("dawahlibrary.org", W / 2, fy + 34); c.direction = "rtl"; fy -= wide ? 60 : 80; }
    if (o.sig) { c.fillStyle = st.ink; c.font = `700 ${wide ? 26 : 32}px Amiri`; c.fillText("— " + o.sig, W / 2, fy); }
    return cv;
  }
  async function template(q) {
    const sw = typeof swx === "function" ? await swx().catch(() => ({})) : {}, canHide = sw.ws_brand === false, ims = libImages(q);
    const O = Object.assign({ sty: "navy", siz: "sq", sig: myName(), brand: true, img: ims[0] ? ims[0].u : "" }, S.wsTpl || {}); if (!canHide) O.brand = true;
    if (O.img && !ims.some(x => x.u === O.img)) O.img = ims[0] ? ims[0].u : "";
    openSheet("مشاركة الوصية قالبًا", `<form id="wstf" data-form="noop" class="wstf">
      <div class="wsprev"><img id="wsimg" alt="معاينة القالب"></div>
      <label>النمط</label><div class="chips">${Object.entries(STY).map(([k, v]) => `<label class="chip"><input type="radio" name="sty" value="${k}"${O.sty === k ? " checked" : ""}> ${v.n}</label>`).join("")}</div>
      <label>المقاس</label><div class="chips">${Object.entries(SIZ).map(([k, v]) => `<label class="chip"><input type="radio" name="siz" value="${k}"${O.siz === k ? " checked" : ""}> ${v[0]}</label>`).join("")}</div>
      <label>توقيعك (يظهر أسفل الوصية؛ اتركه فارغًا لإخفائه)</label><input name="sig" maxlength="60" value="${esc(O.sig || "")}" placeholder="اسمك أو اسم صفحتك">
      <label>صورة من مكتبتك</label><div class="chips wsims"><label class="chip"><input type="radio" name="img" value=""${!O.img ? " checked" : ""}> بلا صورة</label>${ims.map(x => `<label class="chip wsim"><input type="radio" name="img" value="${esc(x.u)}"${O.img === x.u ? " checked" : ""}><img src="${esc(x.u)}" alt="${esc(x.t)}" title="${esc(x.t)}"></label>`).join("")}</div>
      ${ims.length ? "" : '<p class="mut">ضع كتبًا لها أغلفة في <a href="#/mine?t=shelves" data-act="closeSheet">رفوفك</a> لتظهر صورها هنا.</p>'}
      ${canHide ? `<label class="inl"><input type="checkbox" name="brand"${O.brand ? " checked" : ""}> إظهار هوية الموقع</label>` : '<p class="mut">تظهر هوية الموقع في القالب.</p>'}
      <div class="savebar"><button class="btn p" data-w="dl">⬇ تنزيل الصورة</button>${navigator.canShare ? '<button class="btn" type="button" data-w="share">⤴ مشاركة</button>' : ""}<button class="btn" type="button" data-w="copy">نسخ النص</button> <span id="wstst" class="mut" role="status"></span></div></form>`);
    const f = $("#wstf"), read = () => ({ sty: f.sty.value, siz: f.siz.value, sig: f.sig.value.trim(), img: f.img.value, brand: canHide ? !!(f.brand && f.brand.checked) : true });
    let cur = null, t = 0;
    const draw = async () => { const o = read(); S.wsTpl = { sty: o.sty, siz: o.siz, img: o.img, brand: o.brand }; S.wsSig = o.sig; saveS(); cur = await render(q, o); const im = $("#wsimg"); if (im) im.src = cur.toDataURL("image/png"); };
    f.oninput = () => { clearTimeout(t); t = setTimeout(draw, 180); }; f.onchange = f.oninput; draw();
    const blob = () => new Promise(r => cur.toBlob(r, "image/png"));
    f.onsubmit = async e => { e.preventDefault(); if (!cur) await draw(); dl("وصية.png", await blob(), "image/png"); $("#wstst").textContent = "✓ نُزّلت"; };
    f.onclick = async e => { const b = e.target.closest("[data-w]"); if (!b || b.dataset.w === "dl") return; e.preventDefault(); if (!cur) await draw();
      if (b.dataset.w === "copy") navigator.clipboard && navigator.clipboard.writeText(line(q)).then(() => $("#wstst").textContent = "✓ نُسخ النص");
      else { const fl = new File([await blob()], "وصية.png", { type: "image/png" }); if (navigator.canShare({ files: [fl] })) navigator.share({ files: [fl], text: line(q) }).catch(() => { }); else dl("وصية.png", fl, "image/png"); } };
  }

  /* ===== مجموعاتي ===== */
  function addTo(q) {
    if (!Auth.user) { if (typeof needLogin === "function") return needLogin("حفظ الوصايا في «مجموعاتي» متاح للأعضاء المسجلين."); }
    const L = SETS(), k = key(q);
    openSheet("إضافة إلى مجموعاتي", `<form id="wsaf" data-form="noop"><p class="mut">${esc(String(q.t).slice(0, 120))}${q.t.length > 120 ? "…" : ""}</p>
      ${L.length ? L.map((s, i) => `<label class="inl"><input type="radio" name="s" value="${i}"${i === (S.wsLast || 0) ? " checked" : ""}> ${esc(s.n)} <span class="mut">(${toAr(s.items.length)})</span>${s.items.some(x => key(x) === k) ? ' <em class="tag">فيها</em>' : ""}</label>`).join("") : ""}
      <label class="inl"><input type="radio" name="s" value="new"${L.length ? "" : " checked"}> مجموعة جديدة:</label><input name="n" maxlength="60" placeholder="مثال: وصايا طالب العلم">
      <div class="savebar"><button class="btn p">حفظ</button> <a href="#/mine?t=wsets" data-act="closeSheet">مجموعاتي ←</a></div></form>`);
    $("#wsaf").onsubmit = e => { e.preventDefault(); const f = e.target; let i = f.s.value;
      if (i === "new" || !L.length) { const n = f.n.value.trim() || "مجموعة " + toAr(L.length + 1); L.push({ id: "w" + Date.now().toString(36), n, items: [], at: "", sent: "" }); i = L.length - 1; }
      const s = L[+i]; if (!s.items.some(x => key(x) === k)) s.items.push(slim(q)); S.wsLast = +i; save(); closeSheet(); toast("حُفظت في «" + s.n + "»"); };
  }
  const setTxt = s => `${s.n}\n\n` + s.items.map((q, i) => toAr(i + 1) + ". " + line(q)).join("\n\n") + `\n\n${SITENAME}`;
  const setHtml = s => `<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(s.n)}</title><style>body{font-family:'Amiri','Traditional Arabic',serif;line-height:2;font-size:16pt;margin:2cm}h1{font-size:22pt}p{margin:0 0 12pt}.s{font-size:11pt;color:#555}</style></head><body><h1>${esc(s.n)}</h1>`
    + s.items.map((q, i) => `<p><b>${toAr(i + 1)}.</b> ${head(q) ? esc(head(q)) + " " : ""}${esc(txt(q))}${q.ref ? " " + esc(q.ref) : ""}<br><span class="s">[${esc(src(q))}]</span></p>`).join("") + `<p class="s">${esc(SITENAME)}</p></body></html>`;
  function mine(box) {
    const L = SETS(), now = Date.now();
    box.innerHTML = `<p class="mut">مجموعات الوصايا التي حفظتها من بطاقة «من وصايا العلم والقراءة» في الرئيسية (زر «＋»). أعد نشرها، أو نزّلها، أو اضبط لها موعد نشر يذكّرك به جرس الإشعارات. تُحفظ مع حسابك على كل أجهزتك.</p>`
      + (L.length ? L.map((s, i) => `<section class="card wsset" data-i="${i}"><div class="row"><b>${esc(s.n)}</b> <span class="mut">${toAr(s.items.length)} وصية</span>${s.at ? ` <em class="tag${new Date(s.at) <= now && !s.sent ? " warn" : ""}">⏰ ${esc(new Date(s.at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }))}${s.sent ? " ✓ نُشرت" : ""}</em>` : ""}</div>
        <ol>${s.items.map((q, j) => `<li>${esc(txt(q).slice(0, 160))}${txt(q).length > 160 ? "…" : ""} <span class="mut">[${esc(src(q))}]</span> <button class="lnk" data-wm="tpl" data-j="${j}" title="قالب">🖼</button> <button class="lnk" data-wm="up" data-j="${j}" aria-label="أعلى">↑</button> <button class="lnk" data-wm="rm" data-j="${j}" aria-label="إزالة">✕</button></li>`).join("")}</ol>
        <div class="row"><button class="btn s p" data-wm="share">⤴ نشر</button><button class="btn s" data-wm="copy">نسخ</button><button class="btn s" data-wm="txt">نص</button><button class="btn s" data-wm="doc">Word</button><button class="btn s" data-wm="pdf">PDF</button>
        <label class="inl">موعد النشر <input type="datetime-local" data-wm="at" value="${esc(s.at ? s.at.slice(0, 16) : "")}"></label>${s.at && !s.sent ? '<button class="btn s" data-wm="sent">✓ نشرتُها</button>' : ""}<button class="btn s" data-wm="ren">إعادة التسمية</button><button class="btn s" data-wm="del">حذف المجموعة</button></div></section>`).join("")
        : '<p class="note">لا مجموعات بعد. اضغط «＋» على أي وصية في بطاقة الرئيسية لتبدأ مجموعتك.</p>');
    box.onclick = async e => { const b = e.target.closest("[data-wm]"); if (!b || b.dataset.wm === "at") return; const sec = b.closest(".wsset"), s = L[+sec.dataset.i], a = b.dataset.wm, j = +b.dataset.j;
      if (a === "tpl") return template(s.items[j]);
      if (a === "rm") s.items.splice(j, 1); else if (a === "up" && j > 0) s.items.splice(j - 1, 0, s.items.splice(j, 1)[0]);
      else if (a === "share") { if (navigator.share) navigator.share({ title: s.n, text: setTxt(s) }).catch(() => { }); else navigator.clipboard && navigator.clipboard.writeText(setTxt(s)).then(() => toast("نُسخت المجموعة؛ الصقها حيث تنشر")); s.sent = s.at ? new Date().toISOString() : s.sent; }
      else if (a === "copy") { navigator.clipboard && navigator.clipboard.writeText(setTxt(s)).then(() => toast("نُسخت")); return; }
      else if (a === "txt") { dl(s.n + ".txt", setTxt(s), "text/plain"); return; }
      else if (a === "doc") { dl(s.n + ".doc", "﻿" + setHtml(s), "application/msword"); return; }
      else if (a === "pdf") { const w = open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة لطباعة PDF"); w.document.write(setHtml(s)); w.document.close(); setTimeout(() => w.print(), 400); return; }
      else if (a === "sent") s.sent = new Date().toISOString();
      else if (a === "ren") { const n = prompt("اسم المجموعة", s.n); if (!n || !n.trim()) return; s.n = n.trim(); }
      else if (a === "del") { if (!confirm("حذف المجموعة «" + s.n + "»؟ (لا يمس الوصايا في المكتبة)")) return; L.splice(+sec.dataset.i, 1); }
      save(); mine(box); if (typeof Bell !== "undefined" && Bell.paint) Bell.paint(); };
    box.onchange = e => { const i = e.target.closest("[data-wm=at]"); if (!i) return; const s = L[+i.closest(".wsset").dataset.i]; s.at = i.value ? new Date(i.value).toISOString() : ""; s.sent = ""; save(); mine(box); toast(i.value ? "سيذكّرك الجرس في الموعد" : "أُلغي الموعد"); };
  }
  // للجرس: المجموعات التي حان موعد نشرها ولم تُعلَّم منشورة
  const due = () => SETS().filter(s => s.at && !s.sent && new Date(s.at) <= Date.now() && s.items.length).map(s => ({ id: "wset:" + s.id + ":" + s.at, title: "حان موعد نشر مجموعتك «" + s.n + "»", body: toAr(s.items.length) + " وصية — انشرها من «مجموعاتي»", url: "#/mine?t=wsets", at: s.at, local: 1 }));
  return { template, addTo, mine, due };
})();
