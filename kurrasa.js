/* كراسات المكتبة (#/kurrasat): الكتاب في كراسة مذاكرة ومراجعة ملونة (نحو صفحة لكل عشر صفحات): أقسام وتمهيد، وأهم المسائل،
   وتعريفات، وجداول ومقارنات، وخرائط ذهنية، وخطوات، ونصوص بلفظها، وتنبيهات، وأسئلة مراجعة؛ تُرسم صفحاتها على لوحة (canvas)
   فتُعرض في الموقع وتُحمَّل صورًا أو PDF بالشكل نفسه. المادة من tools/kurrasa.py (data/kurrasa)، وتختار الإدارة الكتب.
   ومعها: «التنسيق وإعادة الصياغة» (#/tahrir، عبر api/edit) ونسخ التفريغات المنسَّقة وبأسلوب كتابي في القارئ (data/tfedit). */
const KUR = (() => {
  const RAWD = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Math.floor(Date.now() / 300e3);
  const getJ = async p => { for (const u of [RAWD(p), "data/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const PW = 1240, PH = 1754, M = 84, CW = PW - M * 2;
  const COLS0 = ["#0f5c4d", "#1f6f8b", "#6b4fa3", "#a3462f", "#3c7a3b", "#b07a1e", "#2f5e9e", "#8a3b62"], COLS = COLS0.slice();
  // «حرية التصميم»: سمة يختارها الذكاء الاصطناعي لكل كراسة (K.theme): الألوان، ولون الورق، والغلاف، والزخرفة، وخطا النص والعناوين
  const TH = { bg: "#fffdf8", c1: "#0f5c4d", c2: "#08332b", acc: "#e9d9a8", pat: "dots" };
  const KFONTS = ["Amiri", "Noto Naskh Arabic", "Scheherazade New", "Lateef", "Markazi Text", "Aref Ruqaa", "Reem Kufi", "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Changa", "Lemonada", "El Messiri", "Readex Pro", "Noto Kufi Arabic"];
  const HEX = /^#[0-9a-f]{6}$/i, lum = h => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };
  async function theme(T) { COLS.splice(0, COLS.length, ...COLS0); Object.assign(TH, { bg: "#fffdf8", c1: "#0f5c4d", c2: "#08332b", acc: "#e9d9a8", pat: "dots" }); F.s = F0.s; F.r = F0.r; if (!T) return;
    const cs = (T.cols || []).filter(x => HEX.test(x) && lum(x) < 0.62); if (cs.length >= 3) COLS.splice(0, COLS.length, ...cs.slice(0, 8));
    if (HEX.test(T.bg || "") && lum(T.bg) > 0.86) TH.bg = T.bg; ["c1", "c2"].forEach(k => { if (HEX.test(T[k] || "") && lum(T[k]) < 0.55) TH[k] = T[k]; }); if (HEX.test(T.acc || "") && lum(T.acc) > 0.6) TH.acc = T.acc;
    if (["dots", "stars", "lines", "waves", "none"].includes(T.pat)) TH.pat = T.pat;
    const fr = KFONTS.includes(T.font) ? T.font : null, fs = KFONTS.includes(T.hfont) ? T.hfont : null;
    await Promise.all([fr, fs].filter(Boolean).map(f => typeof loadFont === "function" ? loadFont(f) : 0));
    try { await Promise.all([fr, fs].filter(Boolean).map(f => document.fonts.load(`30px "${f}"`, "عربي"))); } catch (e) { }
    if (fr) F.r = `"${fr}",${F0.r}`; if (fs) F.s = `"${fs}",${F0.s}`; }
  const F0 = { s: '"IBM Plex Sans Arabic",Tahoma,sans-serif', r: 'Amiri,"Traditional Arabic",serif' }, F = Object.assign({}, F0);
  const ICON = { para: "📄", sum: "📝", points: "📌", def: "📖", table: "📊", compare: "⚖️", map: "🧠", steps: "🪜", quote: "❝", note: "⚠️", qs: "✍️" };
  const TTL = { para: "نص الكتاب", sum: "خلاصة القسم", points: "أهم المسائل", def: "تعريفات", table: "جدول", compare: "مقارنة", map: "خريطة ذهنية", steps: "خطوات ومراحل", quote: "من نص الكتاب", note: "تنبيه", qs: "اختبر نفسك" };
  const RL = { 1: "دون اختصار", 2: "نصف الأصل", 5: "مفصّلة", 10: "متوسطة", 20: "موجزة" };
  const RATIOS = [[1, "دون اختصار — نص الكتاب كاملًا بلفظه مع وسائل المذاكرة"], [2, "نصف الأصل — النص مختصرًا إلى نحو نصفه مع وسائل المذاكرة"], [5, "مفصّلة — صفحة لكل ٥ صفحات"], [10, "متوسطة — صفحة لكل ١٠ صفحات"], [20, "موجزة — صفحة لكل ٢٠ صفحة"]];
  const STY = [["sum", "تلخيص بعد كل قسم"], ["qs", "أسئلة وأجوبة بعد كل قسم"], ["table", "جداول"], ["map", "تشجيرات وخرائط ذهنية"], ["compare", "مقارنات"], ["points", "أهم المسائل"], ["def", "تعريفات"], ["steps", "خطوات ومراحل"], ["quote", "نصوص بلفظها"], ["note", "تنبيهات"]];
  const optsForm = (r, st) => `<label>نسبة الاختصار <select name="r">${RATIOS.map(([k, t]) => `<option value="${k}"${k === (r || 10) ? " selected" : ""}>${t}</option>`).join("")}</select></label>
    <label class="inl kurfree"><input type="checkbox" name="free"> 🎨 حرية التصميم: يختار الذكاء الاصطناعي الألوان والخلفيات والزخرفة والخطوط بما يناسب موضوع الكتاب (دون التقيد بالنمط المعتاد)</label>
    <fieldset class="kurst"><legend>طرق العرض في الصفحات</legend>${STY.map(([k, t]) => `<label class="chip"><input type="checkbox" name="st" value="${k}"${!st || st.includes(k) ? " checked" : ""}> ${t}</label>`).join("")}</fieldset>`;
  const tint = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  let C = null; const ctx = () => C || (C = document.createElement("canvas").getContext("2d"));
  function wrap(t, w, font) { const c = ctx(); c.font = font; const L = []; String(t || "").split(/\n/).forEach(par => { let l = ""; par.split(/\s+/).filter(Boolean).forEach(s => { const tt = l ? l + " " + s : s; if (c.measureText(tt).width > w && l) { L.push(l); l = s; } else l = tt; }); if (l) L.push(l); }); return L; }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function text(c, lines, xr, y, lh, font, color, align) { c.font = font; c.fillStyle = color; c.textAlign = align || "right"; c.direction = "rtl"; lines.forEach((l, i) => c.fillText(l, xr, y + lh * (i + 1) - lh * .28)); return lines.length * lh; }

  /* ---------- الكتل: كل دالة تحسب الارتفاع (draw=false) أو ترسم ---------- */
  function block(c, b, y, col, draw) {
    const x0 = M, xr = PW - M, pad = 22, bw = CW, f1 = `600 27px ${F.s}`, f2 = `25px ${F.s}`, lh = 40;
    let h = 0; const head = (t) => { if (draw) { c.font = `700 26px ${F.s}`; c.fillStyle = col; c.textAlign = "right"; c.fillText((ICON[b.k] || "") + "  " + t, xr - pad, y + 40); } return 58; };
    const frame = (hh, bg, border) => { if (!draw) return; rr(c, x0, y, bw, hh, 18); c.fillStyle = bg; c.fill(); if (border) { c.strokeStyle = border; c.lineWidth = 2; c.stroke(); } };
    const k = b.k;
    if (k === "points" || k === "steps") {
      const items = b.items.map(t => wrap(t, bw - pad * 2 - 60, f2)); h = 58 + items.reduce((s, l) => s + l.length * lh + 10, 0) + 16;
      frame(h, tint(col, .07), tint(col, .35)); head(b.t || TTL[k]); let yy = y + 58;
      items.forEach((l, i) => { if (draw) { if (k === "steps") { c.fillStyle = col; c.beginPath(); c.arc(xr - pad - 18, yy + 22, 17, 0, 7); c.fill(); c.fillStyle = "#fff"; c.font = `700 20px ${F.s}`; c.textAlign = "center"; c.fillText(toAr(i + 1), xr - pad - 18, yy + 29); } else { c.fillStyle = col; c.beginPath(); c.arc(xr - pad - 14, yy + 21, 7, 0, 7); c.fill(); } text(c, l, xr - pad - 50, yy, lh, f2, "#1d2b27"); } yy += l.length * lh + 10; });
      return h;
    }
    if (k === "def") {
      const rows = b.items.map(d => ({ t: wrap(d.t, 260, `700 26px ${F.r}`), d: wrap(d.d, bw - pad * 2 - 300, f2), p: d.p }));
      h = 58 + rows.reduce((s, r) => s + Math.max(r.t.length, r.d.length) * lh + 18, 0) + 10;
      frame(h, "#fffaf0", "#e8d9b0"); head(TTL.def); let yy = y + 58;
      rows.forEach(r => { const hh = Math.max(r.t.length, r.d.length) * lh; if (draw) { text(c, r.t, xr - pad, yy, lh, `700 27px ${F.r}`, col); text(c, r.d, xr - pad - 290, yy, lh, f2, "#1d2b27"); if (r.p) { c.font = `18px ${F.s}`; c.fillStyle = "#8a7a55"; c.textAlign = "left"; c.fillText("ص " + toAr(r.p), x0 + pad, yy + 26); } c.strokeStyle = "#efe3c4"; c.beginPath(); c.moveTo(x0 + pad, yy + hh + 9); c.lineTo(xr - pad, yy + hh + 9); c.stroke(); } yy += hh + 18; });
      return h;
    }
    if (k === "table" || k === "compare") {
      const head_ = k === "compare" ? ["", b.a, b.b] : b.head, rows = b.rows, n = head_.length, cw = (bw - pad * 2) / n, fh = `700 23px ${F.s}`, fc = `22px ${F.s}`, l2 = 34;
      const H = head_.map(t => wrap(t, cw - 20, fh)), R = rows.map(r => r.map((t, j) => wrap(t, cw - 20, j === 0 && k === "compare" ? fh : fc)));
      const hh = Math.max(...H.map(l => l.length)) * l2 + 18, rh = R.map(r => Math.max(1, ...r.map(l => l.length)) * l2 + 16);
      h = 58 + hh + rh.reduce((s, v) => s + v, 0) + 20; frame(h, "#fff", tint(col, .35)); head(b.t || TTL[k]);
      if (draw) { let yy = y + 58; c.fillStyle = col; rr(c, x0 + pad, yy, bw - pad * 2, hh, 10); c.fill(); H.forEach((l, j) => text(c, l, xr - pad - j * cw - cw / 2, yy + 6, l2, fh, "#fff", "center")); yy += hh;
        R.forEach((r, i) => { if (i % 2 === 0) { c.fillStyle = tint(col, .07); c.fillRect(x0 + pad, yy, bw - pad * 2, rh[i]); } r.forEach((l, j) => text(c, l, xr - pad - j * cw - cw / 2, yy + 6, l2, j === 0 && k === "compare" ? fh : fc, j === 0 && k === "compare" ? col : "#1d2b27", "center")); yy += rh[i]; });
        c.strokeStyle = tint(col, .25); c.lineWidth = 1; for (let j = 1; j < n; j++) { c.beginPath(); c.moveTo(xr - pad - j * cw, y + 58); c.lineTo(xr - pad - j * cw, yy); c.stroke(); } }
      return h;
    }
    if (k === "map") {
      const per = b.c.length <= 4 ? 2 : 3, gw = (bw - pad * 2 - (per - 1) * 18) / per, rootL = wrap(b.root, bw * .6, `700 27px ${F.s}`);
      const boxes = b.c.map(x => ({ t: wrap(x.t, gw - 30, `700 24px ${F.s}`), c: x.c.map(s => wrap("• " + s, gw - 34, `21px ${F.s}`)) }));
      const bh = boxes.map(x => x.t.length * 34 + x.c.reduce((s, l) => s + l.length * 31, 0) + 28), rows = [];
      for (let i = 0; i < boxes.length; i += per) rows.push(Math.max(...bh.slice(i, i + per)));
      const rootH = rootL.length * 40 + 24; h = 58 + rootH + 50 + rows.reduce((s, v) => s + v + 18, 0) + 6;
      frame(h, tint(col, .04), tint(col, .3)); head(b.t || TTL.map);
      if (draw) { const ry = y + 58, rwid = Math.min(bw * .7, Math.max(...rootL.map(l => (ctx().font = `700 27px ${F.s}`, ctx().measureText(l).width))) + 60);
        c.fillStyle = col; rr(c, PW / 2 - rwid / 2, ry, rwid, rootH, rootH / 2); c.fill(); text(c, rootL, PW / 2, ry + 10, 40, `700 27px ${F.s}`, "#fff", "center");
        const pos = []; let yy = ry + rootH + 50; rows.forEach((rh_, ri) => { for (let j = 0; j < per; j++) { const i = ri * per + j; if (i < boxes.length) pos.push({ i, bx: xr - pad - (j + 1) * gw - j * 18, yy, rh_ }); } yy += rh_ + 18; });
        // الوصلات أولًا ثم الصناديق فوقها، فلا يقطع خطٌّ صندوقًا؛ والصف الثاني يتصل بجذع جانبي
        pos.forEach(({ i, bx, yy }) => { const bc = COLS[(i + 2) % COLS.length], cx = bx + gw / 2; c.strokeStyle = bc; c.lineWidth = 3; c.beginPath(); c.moveTo(PW / 2, ry + rootH);
          if (yy === pos[0].yy) c.bezierCurveTo(PW / 2, yy - 25, cx, ry + rootH + 10, cx, yy); else { const sx = cx > PW / 2 ? xr - pad / 2 : x0 + pad / 2; c.bezierCurveTo(PW / 2, ry + rootH + 25, sx, ry + rootH + 10, sx, ry + rootH + 40); c.lineTo(sx, yy + 30); c.lineTo(cx > PW / 2 ? bx + gw : bx, yy + 30); } c.stroke(); });
        pos.forEach(({ i, bx, yy, rh_ }) => { { const bc = COLS[(i + 2) % COLS.length];
            c.fillStyle = "#fff"; rr(c, bx, yy, gw, rh_, 14); c.fill(); c.strokeStyle = bc; c.lineWidth = 2.5; c.stroke(); c.fillStyle = bc; c.fillRect(bx, yy, gw, 6);
            let y2 = yy + 12; y2 += text(c, boxes[i].t, bx + gw - 15, y2, 34, `700 24px ${F.s}`, bc); boxes[i].c.forEach(l => { y2 += text(c, l, bx + gw - 17, y2, 31, `21px ${F.s}`, "#25332f"); }); } }); }
      return h;
    }
    if (k === "quote") {
      const l = wrap("«" + b.t + "»", bw - pad * 2 - 40, `30px ${F.r}`); h = 30 + l.length * 50 + 52;
      frame(h, "#f7f3ea", null); if (draw) { c.fillStyle = col; c.fillRect(xr - 8, y, 8, h); text(c, l, xr - pad - 20, y + 20, 50, `30px ${F.r}`, "#2a2015"); c.font = `20px ${F.s}`; c.fillStyle = "#7a6a4a"; c.textAlign = "left"; c.fillText((b.by ? b.by + " — " : "") + "ص " + toAr(b.p || 1), x0 + pad, y + h - 18); }
      return h;
    }
    if (k === "para") {  // نص الكتاب مختصرًا (نصف الأصل) أو كاملًا بلفظه
      const ls = b.items.map(x => wrap(x, bw - pad * 2 - 10, `26px ${F.r}`)), hh = b.t ? 58 : 22; h = hh + ls.reduce((a, l) => a + l.length * 44 + 14, 0) + 12;
      frame(h, "#ffffff", tint(col, .25)); if (b.t) head(b.t); if (draw) { let yy = y + hh; ls.forEach(l => { text(c, l, xr - pad, yy, 44, `26px ${F.r}`, "#1d2b27"); yy += l.length * 44 + 14; }); }
      return h;
    }
    if (k === "sum") {
      const l = wrap(b.t, bw - pad * 2 - 10, `26px ${F.r}`); h = 58 + l.length * 44 + 24;
      frame(h, "#eef6f3", tint(col, .45)); head(TTL.sum); if (draw) text(c, l, xr - pad, y + 58, 44, `26px ${F.r}`, "#1d2b27");
      return h;
    }
    if (k === "note") {
      const l = wrap(b.t, bw - pad * 2 - 60, f1); h = 30 + l.length * lh + 26;
      frame(h, "#fff4d6", "#e6b400"); if (draw) { c.font = "34px sans-serif"; c.textAlign = "right"; c.fillText("⚠️", xr - pad, y + 52); text(c, l, xr - pad - 55, y + 18, lh, f1, "#5c4300"); }
      return h;
    }
    if (k === "qs") {
      const it = b.items.map(x => ({ q: wrap("س: " + x.q, bw - pad * 2, `600 24px ${F.s}`), a: wrap("ج: " + x.a, bw - pad * 2 - 20, `22px ${F.s}`) }));
      h = 58 + it.reduce((s, x) => s + x.q.length * 36 + x.a.length * 33 + 16, 0) + 10;
      frame(h, tint(col, .05), null); if (draw) { c.setLineDash([10, 8]); c.strokeStyle = col; c.lineWidth = 2; rr(c, x0, y, bw, h, 18); c.stroke(); c.setLineDash([]); }
      head(TTL.qs); let yy = y + 58; it.forEach(x => { if (draw) { text(c, x.q, xr - pad, yy, 36, `600 24px ${F.s}`, col); text(c, x.a, xr - pad - 20, yy + x.q.length * 36, 33, `22px ${F.s}`, "#4a5753"); } yy += x.q.length * 36 + x.a.length * 33 + 16; });
      return h;
    }
    return 0;
  }

  /* ---------- الصفحات: غلاف، ثم الأقسام بكتلها مع الانتقال إلى صفحة جديدة عند الامتلاء، ثم الأسئلة الشاملة ---------- */
  function layout(K) {
    const pages = [{ cover: 1 }]; let cur = null, y = 0;
    const newPage = (sec, si, cont) => { cur = { items: [], sec, si, cont }; pages.push(cur); y = 150; };
    const room = () => PH - 120 - y;
    K.secs.forEach((s, si) => {
      const col = COLS[si % COLS.length], lead = wrap(s.lead, CW - 40, `italic 25px ${F.r}`), hh = 120 + lead.length * 40 + 20;
      if (!cur || room() < hh + 260) newPage(s, si); else y += 20;
      cur.items.push({ head: s, si, y, h: hh, lead }); y += hh + 14;
      s.blocks.flatMap(b => b.k === "para" && b.items.length > 1 ? b.items.map((x, i) => Object.assign({}, b, { t: i ? "" : b.t, items: [x] })) : [b]).forEach(b => { const h = block(ctx(), b, 0, col, false); if (h > room()) newPage(s, si, 1); cur.items.push({ b, si, y, h }); y += h + 22; });
    });
    if ((K.qs || []).length) { const b = { k: "qs", items: K.qs }, h = block(ctx(), b, 0, COLS[0], false); if (!cur || h + 120 > room()) newPage(null, 0); cur.items.push({ final: 1, y, h: 70 }); y += 80; cur.items.push({ b, si: 0, y, h }); }
    return pages;
  }
  function draw(cv, K, pages, n) {
    const c = cv.getContext("2d"); cv.width = PW; cv.height = PH; c.direction = "rtl"; const P = pages[n];
    c.fillStyle = TH.bg; c.fillRect(0, 0, PW, PH);
    if (P.cover) {
      const g = c.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, TH.c1); g.addColorStop(1, TH.c2); c.fillStyle = g; c.fillRect(0, 0, PW, 760);
      c.globalAlpha = .08; c.fillStyle = "#fff"; c.strokeStyle = "#fff"; c.lineWidth = 3;
      if (TH.pat === "dots") for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(100 + i * 90, 120 + (i % 3) * 210, 60 + (i % 4) * 25, 0, 7); c.fill(); }
      else if (TH.pat === "stars") for (let y = 60; y < 760; y += 150) for (let x = (y / 150 % 2) * 75; x < PW + 75; x += 150) { for (let k = 0; k < 2; k++) { c.save(); c.translate(x, y); c.rotate(k * Math.PI / 4); c.strokeRect(-28, -28, 56, 56); c.restore(); } }
      else if (TH.pat === "lines") for (let x = -PW; x < PW * 2; x += 46) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 760, 760); c.stroke(); }
      else if (TH.pat === "waves") for (let y = 40; y < 760; y += 70) { c.beginPath(); for (let x = 0; x <= PW; x += 20) c.lineTo(x, y + Math.sin(x / 60) * 18); c.stroke(); }
      c.globalAlpha = 1;
      c.textAlign = "center"; c.fillStyle = TH.acc; c.font = `600 30px ${F.s}`; c.fillText(SITENAME + " — كراسات المكتبة", PW / 2, 110);
      c.fillStyle = "#fff"; c.font = `600 34px ${F.s}`; c.fillText("كراسة مذاكرة ومراجعة", PW / 2, 230);
      let yy = 270; yy += text(c, wrap(K.t, CW - 60, `700 64px ${F.r}`), PW / 2, yy, 92, `700 64px ${F.r}`, "#fff", "center");
      c.font = `500 34px ${F.s}`; c.fillStyle = TH.acc; c.fillText(K.a || "", PW / 2, yy + 60);
      c.font = `24px ${F.s}`; c.fillStyle = "#cfe5dd"; c.fillText(`الأصل ${toAr(K.n || 0)} صفحة • الكراسة ${toAr(pages.length)} صفحات • ${toAr(K.secs.length)} قسمًا${K.r ? " • " + (RL[K.r] || "") : ""}`, PW / 2, 700);
      yy = 810; if (K.s) { c.fillStyle = "#0f5c4d"; c.font = `700 30px ${F.s}`; c.textAlign = "right"; c.fillText("💡 الكتاب في سطور", PW - M, yy + 30); yy += 50; yy += text(c, wrap(K.s, CW, `27px ${F.r}`), PW - M, yy, 46, `27px ${F.r}`, "#1d2b27") + 20; }
      if ((K.goals || []).length) { c.fillStyle = "#0f5c4d"; c.font = `700 30px ${F.s}`; c.textAlign = "right"; c.fillText("🎯 ما تستفيده من هذه الكراسة", PW - M, yy + 30); yy += 50; K.goals.forEach(gl => { yy += text(c, wrap("✓ " + gl, CW - 20, `25px ${F.s}`), PW - M - 10, yy, 40, `25px ${F.s}`, "#25332f") + 4; }); yy += 16; }
      c.fillStyle = "#0f5c4d"; c.font = `700 30px ${F.s}`; c.textAlign = "right"; c.fillText("🗺️ خريطة الكراسة", PW - M, yy + 30); yy += 54;
      const per = 2, w = (CW - 20) / per; K.secs.forEach((s, i) => { const col = COLS[i % COLS.length], x = PW - M - (i % per) * (w + 20) - w, y2 = yy + Math.floor(i / per) * 62; if (y2 > PH - 150) return; c.fillStyle = tint(col, .1); rr(c, x, y2, w, 52, 12); c.fill(); c.fillStyle = col; c.font = `700 22px ${F.s}`; c.textAlign = "right"; const t = wrap(toAr(i + 1) + ". " + s.t, w - 30, `700 22px ${F.s}`)[0]; c.fillText(t, x + w - 14, y2 + 34); });
    } else {
      const col = COLS[(P.si || 0) % COLS.length]; c.fillStyle = col; c.fillRect(0, 0, PW, 14); c.fillStyle = tint(col, .08); c.fillRect(0, 14, PW, 82);
      c.font = `600 22px ${F.s}`; c.fillStyle = col; c.textAlign = "right"; c.fillText(K.t, PW - M, 66); c.textAlign = "left"; c.fillStyle = "#6b7975"; c.fillText("كراسة مذاكرة ومراجعة", M, 66);
      P.items.forEach(it => {
        if (it.head) { const s = it.head, y = it.y; c.fillStyle = col; rr(c, M, y, CW, 96, 20); c.fill(); c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.arc(PW - M - 52, y + 48, 32, 0, 7); c.fill(); c.fillStyle = "#fff"; c.font = `700 32px ${F.s}`; c.textAlign = "center"; c.fillText(toAr(it.si + 1), PW - M - 52, y + 60);
          c.textAlign = "right"; c.font = `700 32px ${F.s}`; c.fillText(wrap(s.t, CW - 300, `700 32px ${F.s}`)[0] || "", PW - M - 100, y + 60); c.textAlign = "left"; c.font = `20px ${F.s}`; c.fillText("ص " + toAr(s.p[0]) + "–" + toAr(s.p[1]) + " من الأصل", M + 22, y + 58);
          text(c, it.lead, PW - M - 10, y + 108, 40, `italic 25px ${F.r}`, "#3d4a46"); }
        else if (it.final) { c.fillStyle = "#0f5c4d"; c.font = `700 34px ${F.s}`; c.textAlign = "center"; c.fillText("أسئلة شاملة للمراجعة", PW / 2, it.y + 45); }
        else block(c, it.b, it.y, COLS[it.si % COLS.length], true);
      });
      if (P.cont && P.items[0] && !P.items[0].head) { c.font = `20px ${F.s}`; c.fillStyle = "#6b7975"; c.textAlign = "right"; c.fillText("تابع: " + (P.sec ? P.sec.t : ""), PW - M, 130); }
    }
    c.strokeStyle = "#d9cfb6"; c.lineWidth = 1; c.beginPath(); c.moveTo(M, PH - 78); c.lineTo(PW - M, PH - 78); c.stroke();
    c.font = `20px ${F.s}`; c.fillStyle = "#6b7975"; c.textAlign = "right"; c.fillText(SITENAME + " • dawahlibrary.org", PW - M, PH - 46); c.textAlign = "left"; c.fillText(toAr(n + 1) + " / " + toAr(pages.length), M, PH - 46);
    c.textAlign = "center"; c.font = `16px ${F.s}`; c.fillStyle = "#8a958f"; c.fillText("مادة الكراسة من الكتاب نفسه بإيجاز وتنظيم، فارجع إلى الأصل عند النقل والاستشهاد", PW / 2, PH - 18);
  }
  async function fonts() { try { await Promise.all(["700 30px Amiri", "30px Amiri", "italic 25px Amiri", "600 30px \"IBM Plex Sans Arabic\"", "500 30px \"IBM Plex Sans Arabic\"", "30px \"IBM Plex Sans Arabic\""].map(f => document.fonts.load(f, "عربي"))); await document.fonts.ready; } catch (e) { } }

  /* ---------- الواجهة ---------- */
  async function open(q, id) {
    if (!id) return list();
    window.scrollTo(0, 0); $("#app").innerHTML = '<p class="mut" style="padding:30px;text-align:center">جارٍ إعداد الكراسة…</p>';
    const [L, K] = await Promise.all([getJ("kurrasa/_list.json"), getJ("kurrasa/" + id + ".json")]), inf = (L || {})[id] || {};
    if (!K || (!inf.ok && !can("kurrasa"))) return view(`<p class="note">هذه الكراسة غير متاحة بعد.</p><p><a href="#/kurrasat">← كراسات المكتبة</a></p>`);
    await fonts(); await theme(K.theme); const pages = layout(K), b = B(id);
    view(`<p><a href="#/kurrasat">← كراسات المكتبة</a></p><div class="kurhead"><h2>كراسة: ${esc(K.t)}</h2><p class="mut">${esc(K.a || "")} • ${toAr(pages.length)} صفحات من أصل ${toAr(K.n || 0)} • ${toAr(K.secs.length)} قسمًا${inf.ok ? "" : " • معاينة للإدارة — غير منشورة"}</p></div>
      ${K.sample && can("kurrasa") ? `<div class="note">هذه صفحة تجريبية (القسم الأول) للمعاينة. إن رضيت بنمطها: <button class="btn p s" data-kur="smpok" data-id="${esc(id)}">اعتماد العينة وإكمال الكراسة</button> أو غيّر الخيارات من «إعادة الإعداد».</div>` : ""}
      <div class="row kurtools"><button class="btn p s" data-kur="pdf">⇩ PDF</button><button class="btn s" data-kur="zip">⇩ صور الصفحات (ZIP)</button><button class="btn s" data-kur="txt">عرض نصي</button>${b ? `<a class="btn s" href="#/book/${esc(id)}/1">قراءة الأصل</a>` : ""}${can("kurrasa") ? `<button class="btn s" data-kur="ok" data-on="${inf.ok ? 0 : 1}">${inf.ok ? "إيقاف العرض" : "اعتماد ونشر"}</button><button class="btn s" data-kur="redo">إعادة الإعداد بخيارات…</button>` : ""}</div>
      ${can("kurrasa") ? `<div class="card kurform" id="kurredo" hidden>${optsForm(K.r, K.st)}<button class="btn p s" data-kur="redogo">أعِد الإعداد</button></div>` : ""}
      <p class="mut kurnote">أُعدّت الكراسة من نص الكتاب نفسه بإيجاز وتنظيم، دون إضافة رأي أو معلومة من خارجه؛ والنصوص المنقولة بلفظها مع رقم صفحتها. فارجع إلى الأصل عند النقل والاستشهاد.</p>
      <div class="kurpages" id="kurpages">${pages.map((_, i) => `<figure class="kurpg" data-n="${i}"><div class="kurph">صفحة ${toAr(i + 1)}</div><figcaption><button class="btn s" data-kur="png" data-n="${i}">⇩ صورة</button></figcaption></figure>`).join("")}</div><div id="kurtxt" hidden></div>`);
    window.__kur = { K, pages, id };
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const f = e.target; io.unobserve(f); const cv = document.createElement("canvas"); draw(cv, K, pages, +f.dataset.n); const im = new Image(); im.alt = "صفحة " + toAr(+f.dataset.n + 1) + " من كراسة " + K.t; im.src = cv.toDataURL("image/jpeg", .88); im.loading = "lazy"; const ph = f.querySelector(".kurph"); if (ph) ph.replaceWith(im); }), { rootMargin: "800px" });
    document.querySelectorAll(".kurpg").forEach(f => io.observe(f));
  }
  function textView(K) {
    const bl = b => b.k === "para" ? `${b.t ? `<h4>📄 ${esc(b.t)}</h4>` : ""}<div class="kurpara${b.full ? " full" : ""}">${b.items.map(x => `<p>${esc(x)}</p>`).join("")}</div>`
      : b.k === "points" || b.k === "steps" ? `<h4>${ICON[b.k]} ${esc(b.t || TTL[b.k])}</h4><${b.k === "steps" ? "ol" : "ul"}>${b.items.map(x => `<li>${esc(x)}</li>`).join("")}</${b.k === "steps" ? "ol" : "ul"}>`
      : b.k === "def" ? `<h4>📖 تعريفات</h4><dl>${b.items.map(d => `<dt>${esc(d.t)}</dt><dd>${esc(d.d)}</dd>`).join("")}</dl>`
      : b.k === "table" || b.k === "compare" ? `<h4>${ICON[b.k]} ${esc(b.t || TTL[b.k])}</h4><table class="kurtb"><tr>${(b.k === "compare" ? ["", b.a, b.b] : b.head).map(h => `<th>${esc(h)}</th>`).join("")}</tr>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`
      : b.k === "map" ? `<h4>🧠 ${esc(b.t || TTL.map)}</h4><ul><li><b>${esc(b.root)}</b><ul>${b.c.map(x => `<li>${esc(x.t)}${x.c.length ? `<ul>${x.c.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></li></ul>`
      : b.k === "quote" ? `<blockquote>«${esc(b.t)}» <small>${b.by ? esc(b.by) + " — " : ""}ص ${toAr(b.p || 1)}</small></blockquote>`
      : b.k === "sum" ? `<div class="kursum"><h4>📝 خلاصة القسم</h4><p>${esc(b.t)}</p></div>` : b.k === "note" ? `<p class="note">⚠️ ${esc(b.t)}</p>` : b.k === "qs" ? `<h4>✍️ اختبر نفسك</h4>${b.items.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join("")}` : "";
    return `<article class="kurtext">${K.s ? `<p class="brief">${esc(K.s)}</p>` : ""}${K.secs.map((s, i) => `<section><h3>${toAr(i + 1)}. ${esc(s.t)} <small class="mut">ص ${toAr(s.p[0])}–${toAr(s.p[1])}</small></h3>${s.lead ? `<p><i>${esc(s.lead)}</i></p>` : ""}${s.blocks.map(bl).join("")}</section>`).join("")}${(K.qs || []).length ? `<section><h3>أسئلة شاملة</h3>${bl({ k: "qs", items: K.qs })}</section>` : ""}</article>`;
  }
  const DL = () => document.getElementById("kurbooks") ? "" : `<datalist id="kurbooks">${BOOKS().filter(x => !x.hidden && !isArt(x) && !VOL2(x)).slice(0, 5000).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist>`;
  const REQ = "طلب كراسة: ";
  async function loadReqs() {
    const box = $("#kurreqs"); if (!box || !Auth.sb) return;
    const { data } = await Auth.sb.from("admin_messages").select("id,user_name,subject,body,status,created_at").like("subject", REQ + "%").eq("status", "open").order("created_at", { ascending: false }).limit(50);
    if (!data || !data.length) { box.innerHTML = '<p class="mut">لا طلبات كراسات من الأعضاء الآن.</p>'; return; }
    box.innerHTML = `<h4>طلبات الأعضاء (${toAr(data.length)})</h4>${data.map(m => { const id = (m.body.match(/\[(p?[\w-]+)\]/) || [])[1] || "", b = B(id); return `<div class="bk"><b>${esc(m.subject.slice(REQ.length))}</b><span class="mut">${esc(m.user_name || "عضو")} • ${esc(typeof ago === "function" ? ago(m.created_at) : m.created_at)}</span><p>${esc(m.body.replace(/\s*\[[^\]]+\]\s*$/, ""))}</p><div class="row">${b ? `<button class="btn s p" data-kurreq="go" data-mid="${m.id}" data-id="${esc(id)}">أعِدّها (متوسطة)</button><button class="btn s" data-kurreq="pick" data-id="${esc(id)}">اختر الخيارات</button>` : ""}<button class="btn s" data-kurreq="no" data-mid="${m.id}">اعتذار</button></div></div>`; }).join("")}`;
  }
  async function list() {
    const q = (typeof parse === "function" ? parse().q : {}) || {};
    const L = (await getJ("kurrasa/_list.json")) || {}, staff = can("kurrasa"), ids = Object.keys(L).filter(k => L[k].ok || staff), Q = staff ? (await getJ("kurrasa/_queue.json")) || { items: [] } : null;
    view(`<div class="cmhero kur"><div><h2>كراسات المكتبة</h2><p>الكتاب في كراسة مذاكرة ومراجعة: مفصّلة أو متوسطة أو موجزة، بأقسام الكتاب وتمهيد لكل قسم، وتلخيص وأسئلة وأجوبة في آخره، وأهم المسائل، وتعريفات، وجداول ومقارنات، وخرائط ذهنية، ونصوص بلفظها، وتنبيهات، وأسئلة مراجعة؛ بألوان جذابة، تُقرأ في الموقع وتُحمَّل PDF أو صورًا. والمادة من الكتاب نفسه بلا إضافة ولا تغيير لآراء المؤلف.</p></div></div>
      ${ids.length ? `<div class="agrid">${ids.map(k => `<a class="acard2" href="#/kurrasat/${esc(k)}"><span class="acov" style="${typeof avHue === "function" ? avHue(k) : ""}"><i>📘</i><em>${esc((L[k].t || "").split(/\s+/).slice(0, 3).join(" "))}</em></span><b>${esc(L[k].t || k)}</b><small class="mut">${L[k].sample ? '<em class="tag">صفحة تجريبية</em> ' : ""}${esc(L[k].a || "")} • ${toAr(L[k].secs || 0)} قسمًا${L[k].r ? " • " + RL[L[k].r] : ""}${L[k].ok ? "" : " • غير منشورة"}</small></a>`).join("")}</div>` : '<p class="note">لم تُصدر كراسات بعد. تختار الإدارة الكتب فتُعدّ كراساتها آليًا وتظهر هنا.</p>'}
      ${staff ? `<div class="card" style="margin-top:14px"><h3>اختيار كتاب لتحويله إلى كراسة (للإدارة)</h3><p class="mut">يُفضَّل كتاب اكتمل تدقيق نصه. يُعدّ القسم بقسمه من نص الكتاب، ويُتحقق من النصوص المنقولة بلفظها، وتُنشر الكراسة مباشرة ولك إيقاف عرضها.</p>
        <form data-form="kurq" class="kurform"><input name="t" list="kurbooks" placeholder="اكتب اسم الكتاب أو المقال ثم اختره" required value="${esc(q && q.req ? ((B(q.req) || {}).title || "") : "")}">${DL()}<input name="a" type="number" min="1" placeholder="من صفحة" style="width:7em"><input name="z" type="number" min="1" placeholder="إلى صفحة" style="width:7em"><button type="button" class="btn s" data-kur="addsrc">＋ أضف مصدرًا آخر</button><div id="kursrcs" class="chips"></div><input name="kt" placeholder="عنوان الكراسة (عند تعدد المصادر)">${optsForm()}<label>متطلبات المدير لهذه الكراسة (اختياري: ما يُراعى في الإعداد، مثل التركيز على الأدلة، أو مستوى الطلاب، أو أسئلة أكثر، أو جداول مقارنة)</label><textarea name="req" rows="3" maxlength="1500" placeholder="مثال: الكراسة لطلاب المرحلة الثانوية، أكثر من جداول المقارنة وخرائط المفاهيم، واذكر الدليل مع كل مسألة"></textarea><label class="inl"><input type="checkbox" name="smp" checked> صفحة تجريبية أولًا (القسم الأول) للمعاينة قبل الإعداد الكامل</label><button class="btn p">أعِدّ الكراسة</button></form><p id="kurqs" class="mut"></p>
        ${(Q.items || []).length ? `<p class="mut">في الطابور: ${(Q.items || []).map(x => esc((B(x.id || x) || {}).title || x.id || x) + (x.r ? " (" + RL[x.r] + ")" : "")).join("، ")}</p>` : ""}
        <div id="kurreqs"></div></div>` : `<div class="card" style="margin-top:14px"><h3>اطلب كراسة لكتاب</h3><p class="mut">اختر كتابًا من المكتبة تريد له كراسة مذاكرة موجزة متنوعة العرض، فتصل رسالتك وإشعار إلى الإدارة، ويصلك إشعار حين تُنشر.</p>
        ${Auth.user ? `<form data-form="kurreq" class="kurform"><input name="t" list="kurbooks" placeholder="اكتب اسم الكتاب ثم اختره" required>${DL()}<input name="n" maxlength="300" placeholder="ملاحظة اختيارية (مثل: أريدها مفصّلة، أو بأسئلة أكثر)"><button class="btn p">أرسل الطلب</button></form><p id="kurrs" class="mut"></p>` : `<p><a class="btn" href="#/account">سجّل الدخول لطلب كراسة</a></p>`}</div>`}`);
    if (staff) loadReqs();
  }
  const SRC = []; // مصادر الكراسة المجمّعة (كتب أو نطاق صفحات أو مقالات)
  document.addEventListener("click", async e => { const x = e.target.closest("[data-kur=addsrc],[data-kur=smpok]"); if (!x) return; e.preventDefault();
    if (x.dataset.kur === "addsrc") { const f = x.closest("form"), t = String(f.t.value || "").trim(), b = lib.books.find(y => y.title === t || y.setTitle === t); if (!b) return toast("اختر الاسم من القائمة");
      SRC.push({ b: b.id, a: +f.a.value || undefined, z: +f.z.value || undefined }); f.t.value = f.a.value = f.z.value = ""; $("#kursrcs").innerHTML = SRC.map(s => `<span class="chip">${esc((B(s.b) || {}).title || s.b)}${s.a || s.z ? " (ص " + (s.a || 1) + "–" + (s.z || "…") + ")" : ""}</span>`).join(""); return; }
    // اعتماد الصفحة التجريبية: يُعاد إلى الطابور بالخيارات نفسها دون «تجريبية» فيُعدّ كاملًا
    try { const L = (await getJ("kurrasa/_list.json")) || {}, it = (L[x.dataset.id] || {}).item || { id: x.dataset.id }; await GH.editJSON("data/kurrasa/_queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [Object.assign({}, it, { id: x.dataset.id })].concat(o.items.filter(y => (y.id || y) !== x.dataset.id)); return o; }, "كراسة: اعتماد العينة وإكمال الإعداد"); toast("اعتُمدت العينة، ويُعدّ الباقي الآن"); } catch (er) { toast(er.message); } });
  async function queue(id, r, st, free) { await GH.editJSON("data/kurrasa/_queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [Object.assign({ id, r: +r || 10 }, st && st.length ? { st } : {}, free ? { design: "free" } : {})].concat(o.items.filter(x => (x.id || x) !== id)); return o; }, "كراسة: «" + ((B(id) || {}).title || id) + "»"); }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=kurq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const st = [...f.querySelectorAll("[name=st]:checked")].map(x => x.value); if (!st.length) return toast("اختر طريقة عرض واحدة على الأقل");
    const t = String(f.t.value || "").trim(), b = t ? lib.books.find(x => x.title === t || x.setTitle === t) : null; if (t && !b) return toast("اختر الاسم من القائمة");
    if (b) SRC.push({ b: b.id, a: +f.a.value || undefined, z: +f.z.value || undefined });
    if (!SRC.length) return toast("اختر مصدرًا");
    const multi = SRC.length > 1 || SRC[0].a || SRC[0].z, id = multi ? "k" + Date.now().toString(36) : SRC[0].b, smp = f.smp.checked;
    const item = Object.assign({ id, r: +f.r.value || 10 }, f.free && f.free.checked ? { design: "free" } : {}, st.length === STY.length ? {} : { st }, String(f.req && f.req.value || "").trim() ? { req: String(f.req.value).trim().slice(0, 1500) } : {}, multi ? { src: SRC.slice(), t: String(f.kt.value || "").trim() || "كراسة: " + SRC.map(s => (B(s.b) || {}).title || s.b).join(" + ") } : {}, smp ? { sample: 1 } : {});
    try { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await GH.editJSON("data/kurrasa/_queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [item].concat(o.items.filter(x => (x.id || x) !== id)); return o; }, "كراسة: «" + (item.t || (B(id) || {}).title || id) + "»" + (smp ? " (صفحة تجريبية)" : ""));
      $("#kurqs").textContent = (smp ? "تُعدّ صفحة تجريبية أولًا؛ تظهر لك هنا للمعاينة ثم «اعتماد وإكمال»." : "أُضيفت إلى الطابور؛ يبدأ الإعداد خلال دقائق.") ; SRC.length = 0; $("#kursrcs").innerHTML = ""; f.reset(); } catch (x) { toast(x.message); }
  }, true);
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=kurreq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const t = String(f.t.value || "").trim(), b = BOOKS().find(x => x.title === t); if (!b) return toast("اختر اسم الكتاب من القائمة");
    try { const pg = typeof Members !== "undefined" ? await Members.page(Auth.user.id).catch(() => null) : null, nm = (pg && pg.name) || Auth.user.name || "عضو", note = String(f.n.value || "").trim();
      const { error } = await Auth.sb.from("admin_messages").insert({ user_id: Auth.user.id, user_name: nm, subject: (REQ + (b.setTitle || b.title)).slice(0, 120), body: "مطلوب لهذا الكتاب كراسة مذاكرة موجزة وعصرية ومتنوعة العرض ومساعدة على الفهم." + (note ? "\nملاحظة العضو: " + note : "") + " [" + b.id + "]" });
      if (error) throw new Error(error.message.replace(/^.*rate_limited:\s*/, ""));
      if (typeof tgNote === "function") tgNote("msg", { name: nm, subject: REQ + (b.setTitle || b.title), detail: note || "طلب كراسة مذاكرة" });
      $("#kurrs").textContent = "أُرسل طلبك إلى الإدارة، وسيصلك ردّها في رسائلك، جزاك الله خيرًا."; f.reset(); } catch (x) { toast(x.message || "تعذر الإرسال"); }
  }, true);
  document.addEventListener("click", async e => {
    const r = e.target.closest("[data-kurreq]"); if (!r) return; e.preventDefault(); const k = r.dataset.kurreq;
    try {
      if (k === "pick") { const f = $("[data-form=kurq]"); if (f) { f.t.value = (B(r.dataset.id) || {}).title || ""; f.scrollIntoView({ behavior: "smooth", block: "center" }); } return; }
      const reply = k === "go" ? "جزاك الله خيرًا، بدأ إعداد الكراسة المطلوبة، وتظهر في قسم الكراسات بعد انتهائها إن شاء الله." : "جزاك الله خيرًا على طلبك، نعتذر عن إعداد هذه الكراسة الآن.";
      if (k === "go") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await queue(r.dataset.id, 10); }
      const { error } = await Auth.sb.from("admin_messages").update({ reply, replied_at: new Date().toISOString(), status: "replied" }).eq("id", +r.dataset.mid); if (error) throw new Error(error.message);
      toast(k === "go" ? "أُضيفت إلى الطابور وأُشعر العضو" : "أُرسل الاعتذار إلى العضو"); loadReqs();
    } catch (x) { toast(x.message || "تعذر"); }
  });
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-kur]"); if (!el) return; e.preventDefault(); const a = el.dataset.kur, X = window.__kur; if (!X) return;
    try {
      if (a === "png") { const cv = document.createElement("canvas"); draw(cv, X.K, X.pages, +el.dataset.n); cv.toBlob(bl => dl(`kurrasa-${X.id}-${+el.dataset.n + 1}.png`, bl), "image/png"); }
      else if (a === "zip") { const cv = document.createElement("canvas"), files = []; for (let i = 0; i < X.pages.length; i++) { toast("جارٍ رسم الصفحات " + toAr(i + 1) + " من " + toAr(X.pages.length)); draw(cv, X.K, X.pages, i); const bl = await new Promise(r => cv.toBlob(r, "image/jpeg", .9)); files.push([`kurrasa-${X.id}-${String(i + 1).padStart(2, "0")}.jpg`, new Uint8Array(await bl.arrayBuffer())]); } dl(`kurrasa-${X.id}.zip`, new Blob([EXT.zip(files)], { type: "application/zip" })); toast("حُفظت الكراسة صورًا"); }
      else if (a === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); const cv = document.createElement("canvas"), im = []; for (let i = 0; i < X.pages.length; i++) { draw(cv, X.K, X.pages, i); im.push(cv.toDataURL("image/jpeg", .9)); }
        w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كراسة ${esc(X.K.t)} — ${esc(SITENAME)}</title><style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block;page-break-after:always}</style></head><body>${im.map(u => `<img src="${u}">`).join("")}<script>onload=()=>setTimeout(()=>print(),500)<\/script></body></html>`); w.document.close(); }
      else if (a === "txt") { const t = $("#kurtxt"), p = $("#kurpages"); if (t.hidden) { t.innerHTML = textView(X.K); } t.hidden = !t.hidden; p.hidden = !t.hidden; el.textContent = t.hidden ? "عرض نصي" : "عرض الصفحات"; }
      else if (a === "ok") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await GH.editJSON("data/kurrasa/_list.json", o => { if (o && o[X.id]) o[X.id].ok = +el.dataset.on; return o; }, (el.dataset.on === "1" ? "اعتماد" : "إيقاف") + " كراسة: " + X.K.t); toast("حُفظ؛ يسري خلال دقائق"); }
      else if (a === "redo") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const box = $("#kurredo"); box.hidden = !box.hidden; }
      else if (a === "redogo") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const f = $("#kurredo"), st = [...f.querySelectorAll("[name=st]:checked")].map(x => x.value); if (!st.length) return toast("اختر طريقة عرض واحدة على الأقل"); await queue(X.id, f.r.value, st.length === STY.length ? null : st, f.querySelector("[name=free]") && f.querySelector("[name=free]").checked); f.hidden = true; toast("أُضيفت إلى الطابور؛ تُعاد بالخيارات الجديدة ويصلك إشعار عند انتهائها"); }
    } catch (x) { toast(x.message || "تعذر"); }
  });

  /* ---------- التنسيق وإعادة الصياغة (#/tahrir) ---------- */
  const EM = [["fmt", "تنسيق وتدقيق", "ألفاظ المتكلم نفسها بعد تصحيح الأخطاء ووضع الترقيم والفقرات والعناوين وحذف الحشو الكلامي"], ["rw", "إعادة صياغة بأسلوب كتابي", "المضمون نفسه بعربية فصيحة متصلة، بلا زيادة ولا نقص في المعنى"], ["proof", "تدقيق لغوي فقط", "تصحيح الإملاء والنحو والترقيم مع إبقاء الألفاظ والترتيب"], ["short", "اختصار قريب من الألفاظ", "نحو الثلث بسياقة متصلة"]];
  async function tahrir(q) {
    let pre = ""; if (q.b && B(q.b)) { try { const b = await loadBook(q.b); pre = String(b.pages[(+q.p || 1) - 1] || "").split(/^\s*_{4,}\s*$/m)[0].replace(/^#+\s*/gm, ""); } catch (e) { } }
    view(`<h2>التنسيق وإعادة الصياغة</h2><p class="mut">خدمة للأعضاء: الصق نصًّا (تفريغ درس، أو مقالًا، أو فقرة من كتاب) واختر الخدمة. الأمانة شرط: لا تُضاف معلومة ولا رأي، ولا يُحذف شيء من المضمون، والآيات والأحاديث بلفظها. الحد ١٢٠٠٠ حرف في المرة.</p>
      <form data-form="tahrir"><div class="tabs" role="radiogroup">${EM.map(([k, t], i) => `<label class="chip"><input type="radio" name="m" value="${k}"${i === 0 ? " checked" : ""}> ${t}</label>`).join("")}</div>
      <p class="mut" id="tahd">${EM[0][2]}</p><textarea name="t" style="min-height:220px" maxlength="12000" required placeholder="الصق النص هنا">${esc(pre)}</textarea><div class="savebar"><button class="btn p">نفّذ</button> <span id="tahs" class="mut"></span></div></form>
      <div id="tahr" hidden><h3>النتيجة</h3><div class="note">النتيجة من إعداد آلي بالذكاء الاصطناعي؛ راجعها قبل النشر، وانسب الكلام إلى قائله، ونبّه على أن الصياغة بتصرف إن أعدت صياغته.</div><article class="tahout" id="tahout"></article><div class="row"><button class="btn s" data-tah="copy">نسخ</button><button class="btn s" data-tah="doc">Word</button></div></div>`);
    document.querySelectorAll("[name=m]").forEach(r => r.onchange = () => { $("#tahd").textContent = (EM.find(x => x[0] === r.value) || [])[2] || ""; });
  }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=tahrir]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const st = $("#tahs"), bt = f.querySelector("button");
    if (typeof Auth === "undefined" || !Auth.user) return toast("سجّل الدخول لاستخدام الخدمة");
    bt.disabled = true; st.textContent = "جارٍ التنفيذ… قد يستغرق دقيقة";
    try { const r = await fetch("/api/edit", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + (Auth.token || "") }, body: JSON.stringify({ mode: f.m.value, text: f.t.value }) }), j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || j.message || "تعذر التنفيذ"); $("#tahr").hidden = false; $("#tahout").innerHTML = String(j.text).split(/\n+/).filter(Boolean).map(l => /^#\s/.test(l) ? `<h4>${esc(l.replace(/^#\s*/, ""))}</h4>` : `<p>${esc(l)}</p>`).join(""); window.__tah = j.text; st.textContent = ""; $("#tahr").scrollIntoView({ behavior: "smooth" }); }
    catch (x) { st.textContent = x.message; } finally { bt.disabled = false; }
  }, true);
  document.addEventListener("click", async e => { const el = e.target.closest("[data-tah]"); if (!el || !window.__tah) return; e.preventDefault();
    if (el.dataset.tah === "copy") { try { await navigator.clipboard.writeText(window.__tah); toast("نُسخ"); } catch (x) { } }
    else dl("tahrir.doc", `<html><head><meta charset="utf-8"></head><body dir="rtl" style="font-family:'Traditional Arabic';font-size:16pt">${$("#tahout").innerHTML}</body></html>`, "application/msword"); });

  /* ---------- التفريغات في القارئ: كما أُلقي / منسَّق ومدقَّق / بأسلوب كتابي ---------- */
  const TFE = new Map();
  async function tfReader(b, p) {
    if (!(typeof isTranscript === "function" ? isTranscript(b) : (b.tags || []).includes("tafrigh"))) return; const rb = $("#rb"), paper = $("#paper"); if (!rb || !paper || $(".tfseg")) return;
    if (!TFE.has(b.id)) TFE.set(b.id, getJ("tfedit/" + b.id + ".json")); const d = await TFE.get(b.id), pg = d && d.pages && d.pages[String(p)];
    if (!pg || $(".tfseg")) return; const v = S.tfv || "o";
    paper.insertAdjacentHTML("afterbegin", `<div class="seg tfseg" role="radiogroup" aria-label="نص التفريغ">${[["o", "كما أُلقي"], ["f", "منسَّق ومدقَّق"], ["r", "بأسلوب كتابي"]].map(([k, t]) => `<button type="button" role="radio" data-tfv="${k}" aria-checked="${v === k}">${t}</button>`).join("")}</div><p class="mut tfnote" ${v === "r" ? "" : "hidden"}>صياغة المكتبة بتصرف لكلام الشيخ، بلا زيادة ولا نقص في المعنى؛ والأصل ما أُلقي.</p><p class="tflink"><a href="#/tfbook/${esc(b.id)}?v=${v === "r" ? "r" : "f"}">📘 اقرأ النسخة المحررة كاملة ككتاب معد للنشر والطباعة</a></p>`);
    const orig = rb.innerHTML, set = k => { rb.innerHTML = k === "o" ? orig : pageHtml(pg[k] || "", "", [], null); $$(".tfseg [data-tfv]").forEach(x => x.setAttribute("aria-checked", x.dataset.tfv === k)); const n = $(".tfnote"); if (n) n.hidden = k !== "r"; };
    if (v !== "o") set(v);
    $$(".tfseg [data-tfv]").forEach(x => x.onclick = () => { S.tfv = x.dataset.tfv; saveS(); set(x.dataset.tfv); });
  }
  /* ---------- النسخة المحررة للتفريغ (#/tfbook/<id>): كتاب معد للنشر والطباعة ----------
     صفحة عنوان، وتنبيه التحرير، وفهرس من العناوين، وفصول متصلة بنص «منسَّق ومدقَّق» أو «بأسلوب كتابي»، مع إحالة صفحات الأصل اختيارًا. */
  async function tfBook(q, id) {
    const b0 = B(id); if (!b0) return view('<p class="note">التفريغ غير موجود.</p>');
    view('<p class="mut" style="padding:30px;text-align:center">جارٍ إعداد النسخة المحررة…</p>');
    let b; try { b = await loadBook(id); } catch (e) { return view(`<p class="note">${esc(e.message)}</p>`); }
    if (!TFE.has(id)) TFE.set(id, getJ("tfedit/" + id + ".json")); const d = await TFE.get(id);
    const v = q.v === "r" ? "r" : "f", refs = q.ref === "1", a = A(b.authorId), title = b.setTitle || b.title;
    if (!d || !d.pages || !Object.keys(d.pages).length) return view(`<p><a href="#/tafrighat">← التفريغات</a></p><h2>${esc(title)}</h2><div class="note">النسخة المحررة لهذا التفريغ قيد الإعداد؛ تُجهَّز آليًا بعد اكتمال تحويله ومراجعته، ثم تظهر هنا.${can("kurrasa") ? ` <button class="btn s" data-tfq="${esc(id)}">قدّمه في طابور التجهيز</button>` : ""}</div><p><a class="btn" href="#/book/${esc(id)}/1">اقرأ التفريغ كما رُفع</a></p>`);
    const n = b.pages.length, edited = Object.keys(d.pages).length, chs = []; let cur = { t: "", ps: [] }, last = "";
    for (let i = 1; i <= n; i++) {
      const e = d.pages[String(i)], raw = e ? (e[v] || e.f || "") : String(b.pages[i - 1] || "").split(/^\s*_{4,}\s*$/m)[0];
      String(raw).split(/\n+/).map(l => l.trim()).filter(Boolean).forEach((l, k) => {
        if (/^#{1,3}\s/.test(l)) { const h = l.replace(/^#+\s*/, "").trim(); if (norm(h) === norm(cur.t || "") || chs.some(c => norm(c.t) === norm(h) && c.p >= i - 1)) return; /* عنوان مكرر في رأس الصفحة */ if (cur.ps.length || cur.t) chs.push(cur); cur = { t: h, p: i, ps: [] }; return; }
        // وصل الجملة المقطوعة بين صفحتين
        if (k === 0 && cur.ps.length && !/[.؟!:»)\]]$/.test(cur.ps[cur.ps.length - 1].t)) { cur.ps[cur.ps.length - 1].t += " " + l; return; }
        cur.ps.push({ t: l, p: i, raw: !e });
      });
    }
    if (cur.ps.length || cur.t) chs.push(cur);
    for (let i = chs.length - 1; i > 0; i--) if (!chs[i - 1].ps.length && chs[i - 1].t && chs[i].t) { chs[i].t = chs[i - 1].t + " — " + chs[i].t; chs[i].p = chs[i - 1].p; chs.splice(i - 1, 1); } // عنوان بلا نص يُضم إلى ما بعده
    const ch2 = chs.map((c, i) => Object.assign(c, { t: c.t || (i === 0 ? "تمهيد" : "تابع"), id: "tfc" + i }));
    const html = `<header class="tfb-title"><p class="tfb-site">${esc(SITENAME)}</p><h1>${esc(title)}</h1><p class="tfb-au">${esc(a.name || "")}${died(a)}</p><p class="tfb-sub">${v === "r" ? "تفريغ محرَّر بأسلوب كتابي" : "تفريغ منسَّق ومدقَّق"}</p>${b.source ? `<p class="tfb-src">${esc(b.source)}</p>` : ""}</header>
      <section class="tfb-note"><h2>تنبيه التحرير</h2><p>${v === "r" ? "هذه النسخة صياغة كتابية أعدّتها المكتبة لكلام الشيخ في دروسه المفرّغة، بلا زيادة في المعنى ولا نقص ولا تغيير لرأي أو ترجيح، مع حذف ما لا يناسب الكتابة من التكرار والاستطراد الشفهي. فالعبارات عبارات المكتبة والمضمون مضمون الشيخ؛ ويُرجع إلى النص كما أُلقي عند النقل الحرفي." : "هذه النسخة ألفاظ الشيخ نفسها بعد تصحيح أخطاء التفريغ الإملائية والنحوية الظاهرة، ووضع علامات الترقيم والفقرات والعناوين، وحذف الحشو الكلامي والتكرار اللفظي الذي لا يضيف معنى."} والآيات والأحاديث بلفظها. ${edited < n ? `<b>حُرِّر ${toAr(edited)} من ${toAr(n)} صفحة حتى الآن، وما لم يُحرَّر بعد يظهر كما رُفع.</b>` : ""}</p></section>
      <nav class="tfb-toc"><h2>الفهرس</h2><ol>${ch2.map(c => `<li><a href="#${c.id}" data-tfgo="${c.id}">${esc(c.t)}</a>${refs ? ` <small>(ص ${toAr(c.p || 1)} من الأصل)</small>` : ""}</li>`).join("")}</ol></nav>
      ${ch2.map(c => `<section class="tfb-ch" id="${c.id}"><h2>${esc(c.t)}</h2>${c.ps.map(x => `<p${x.raw ? ' class="tfb-raw"' : ""}>${esc(x.t)}${refs ? ` <small class="tfb-ref">[ص ${toAr(x.p)}]</small>` : ""}</p>`).join("")}</section>`).join("")}
      <footer class="tfb-end"><p>— تم بحمد الله —</p><p class="mut">${esc(SITENAME)} • dawahlibrary.org • أُعدّت هذه النسخة في ${esc(d.built || "")}</p></footer>`;
    const u = o => "#/tfbook/" + encodeURIComponent(id) + "?" + new URLSearchParams(Object.assign({ v, ref: refs ? "1" : "" }, o)).toString().replace(/&?ref=(&|$)/, "$1");
    view(`<p><a href="#/tafrighat">← التفريغات</a></p>
      <div class="row tfbtools"><div class="seg" role="radiogroup"><a role="radio" aria-checked="false" href="#/book/${esc(id)}/1">كما رُفع</a><a role="radio" aria-checked="${v === "f"}" href="${u({ v: "f" })}">منسَّق ومدقَّق</a><a role="radio" aria-checked="${v === "r"}" href="${u({ v: "r" })}">بأسلوب كتابي</a></div>
       <a class="btn s" href="${u({ ref: refs ? "" : "1" })}">${refs ? "إخفاء" : "إظهار"} صفحات الأصل</a><button class="btn p s" data-tfb="pdf">طباعة / PDF</button><button class="btn s" data-tfb="doc">Word</button>${b.pdf ? `<a class="btn s" href="#/book/${esc(id)}/1">المصورة كما رُفعت</a>` : ""}</div>
      <article class="tfbook" id="tfbook">${html}</article>`);
    window.__tfb = { html, title, v };
  }
  const TFB_CSS = `@page{size:A5;margin:18mm 15mm 18mm}body{font-family:Amiri,'Traditional Arabic',serif;font-size:13.5pt;line-height:1.95;color:#111;direction:rtl}
    .tfb-title{text-align:center;page-break-after:always;padding-top:45mm}.tfb-title h1{font-size:26pt;color:#0f5c4d;margin:10mm 0 4mm}.tfb-site{color:#7a6a4a}.tfb-au{font-size:16pt}.tfb-sub{color:#0f5c4d}.tfb-src{font-size:10pt;color:#555}
    .tfb-note{page-break-after:always;font-size:11.5pt}.tfb-toc{page-break-after:always}.tfb-toc ol{line-height:2.1}.tfb-toc a{color:#111;text-decoration:none}
    .tfb-ch{page-break-before:always}.tfb-ch h2{color:#0f5c4d;text-align:center;border-bottom:1px solid #b88a2e;padding-bottom:3mm}.tfb-ch p{text-align:justify;text-indent:1.5em;margin:0 0 2mm}.tfb-ref{color:#998;font-size:8pt}.tfb-end{text-align:center;margin-top:12mm}`;
  document.addEventListener("click", async e => {
    const g = e.target.closest("[data-tfgo]"); if (g) { e.preventDefault(); const t = document.getElementById(g.dataset.tfgo); if (t) t.scrollIntoView({ behavior: "smooth" }); return; }
    const q0 = e.target.closest("[data-tfq]"); if (q0) { e.preventDefault(); try { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await GH.editJSON("data/tfedit/_queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [{ id: q0.dataset.tfq }].concat(o.items.filter(x => (x.id || x) !== q0.dataset.tfq)); return o; }, "تجهيز تفريغ: " + q0.dataset.tfq); toast("أُضيف في أول الطابور"); } catch (x) { toast(x.message); } return; }
    const el = e.target.closest("[data-tfb]"); if (!el || !window.__tfb) return; e.preventDefault(); const T_ = window.__tfb;
    const doc = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(T_.title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"><style>${TFB_CSS}</style></head><body>${T_.html}`;
    if (el.dataset.tfb === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); w.document.write(doc + `<script>onload=()=>setTimeout(()=>print(),700)<\/script></body></html>`); w.document.close(); }
    else dl((T_.title || "tafrigh").replace(/[\\/:*?"<>|]+/g, " ").slice(0, 80) + ".doc", doc.replace("<html", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"') + "</body></html>", "application/msword");
  });
  return { view: open, tahrir, tfReader, tfBook, layout, draw };
})();
