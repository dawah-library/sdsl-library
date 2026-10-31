/* كراسات المكتبة (#/kurrasat): الكتاب في كراسة مذاكرة ومراجعة ملونة (نحو صفحة لكل عشر صفحات): أقسام وتمهيد، وأهم المسائل،
   وتعريفات، وجداول ومقارنات، وخرائط ذهنية، وخطوات، ونصوص بلفظها، وتنبيهات، وأسئلة مراجعة؛ تُرسم صفحاتها على لوحة (canvas)
   فتُعرض في الموقع وتُحمَّل صورًا أو PDF بالشكل نفسه. المادة من tools/kurrasa.py (data/kurrasa)، وتختار الإدارة الكتب.
   ومعها: «التنسيق وإعادة الصياغة» (#/tahrir، عبر api/edit) ونسخ التفريغات المنسَّقة وبأسلوب كتابي في القارئ (data/tfedit). */
const KUR = (() => {
  const RAWD = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Math.floor(Date.now() / 300e3);
  const getJ = async p => { for (const u of [RAWD(p), "data/" + p]) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const PW = 1240, PH = 1754, M = 84, CW = PW - M * 2;
  const COLS = ["#0f5c4d", "#1f6f8b", "#6b4fa3", "#a3462f", "#3c7a3b", "#b07a1e", "#2f5e9e", "#8a3b62"];
  const F = { s: '"IBM Plex Sans Arabic",Tahoma,sans-serif', r: 'Amiri,"Traditional Arabic",serif' };
  const ICON = { points: "📌", def: "📖", table: "📊", compare: "⚖️", map: "🧠", steps: "🪜", quote: "❝", note: "⚠️", qs: "✍️" };
  const TTL = { points: "أهم المسائل", def: "تعريفات", table: "جدول", compare: "مقارنة", map: "خريطة ذهنية", steps: "خطوات ومراحل", quote: "من نص الكتاب", note: "تنبيه", qs: "اختبر نفسك" };
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
      s.blocks.forEach(b => { const h = block(ctx(), b, 0, col, false); if (h > room()) newPage(s, si, 1); cur.items.push({ b, si, y, h }); y += h + 22; });
    });
    if ((K.qs || []).length) { const b = { k: "qs", items: K.qs }, h = block(ctx(), b, 0, COLS[0], false); if (!cur || h + 120 > room()) newPage(null, 0); cur.items.push({ final: 1, y, h: 70 }); y += 80; cur.items.push({ b, si: 0, y, h }); }
    return pages;
  }
  function draw(cv, K, pages, n) {
    const c = cv.getContext("2d"); cv.width = PW; cv.height = PH; c.direction = "rtl"; const P = pages[n];
    c.fillStyle = "#fffdf8"; c.fillRect(0, 0, PW, PH);
    if (P.cover) {
      const g = c.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, "#0f5c4d"); g.addColorStop(1, "#08332b"); c.fillStyle = g; c.fillRect(0, 0, PW, 760);
      c.globalAlpha = .08; c.fillStyle = "#fff"; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(100 + i * 90, 120 + (i % 3) * 210, 60 + (i % 4) * 25, 0, 7); c.fill(); } c.globalAlpha = 1;
      c.textAlign = "center"; c.fillStyle = "#e9d9a8"; c.font = `600 30px ${F.s}`; c.fillText(SITENAME + " — كراسات المكتبة", PW / 2, 110);
      c.fillStyle = "#fff"; c.font = `600 34px ${F.s}`; c.fillText("كراسة مذاكرة ومراجعة", PW / 2, 230);
      let yy = 270; yy += text(c, wrap(K.t, CW - 60, `700 64px ${F.r}`), PW / 2, yy, 92, `700 64px ${F.r}`, "#fff", "center");
      c.font = `500 34px ${F.s}`; c.fillStyle = "#e9d9a8"; c.fillText(K.a || "", PW / 2, yy + 60);
      c.font = `24px ${F.s}`; c.fillStyle = "#cfe5dd"; c.fillText(`الأصل ${toAr(K.n || 0)} صفحة • الكراسة ${toAr(pages.length)} صفحات • ${toAr(K.secs.length)} قسمًا`, PW / 2, 700);
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
    if (!K || (!inf.ok && !isAdmin())) return view(`<p class="note">هذه الكراسة غير متاحة بعد.</p><p><a href="#/kurrasat">← كراسات المكتبة</a></p>`);
    await fonts(); const pages = layout(K), b = B(id);
    view(`<p><a href="#/kurrasat">← كراسات المكتبة</a></p><div class="kurhead"><h2>كراسة: ${esc(K.t)}</h2><p class="mut">${esc(K.a || "")} • ${toAr(pages.length)} صفحات من أصل ${toAr(K.n || 0)} • ${toAr(K.secs.length)} قسمًا${inf.ok ? "" : " • معاينة للإدارة — غير منشورة"}</p></div>
      <div class="row kurtools"><button class="btn p s" data-kur="pdf">⇩ PDF</button><button class="btn s" data-kur="zip">⇩ صور الصفحات (ZIP)</button><button class="btn s" data-kur="txt">عرض نصي</button>${b ? `<a class="btn s" href="#/book/${esc(id)}/1">قراءة الأصل</a>` : ""}${isAdmin() ? `<button class="btn s" data-kur="ok" data-on="${inf.ok ? 0 : 1}">${inf.ok ? "إيقاف العرض" : "اعتماد ونشر"}</button><button class="btn s" data-kur="redo">إعادة الإعداد</button>` : ""}</div>
      <p class="mut kurnote">أُعدّت الكراسة من نص الكتاب نفسه بإيجاز وتنظيم، دون إضافة رأي أو معلومة من خارجه؛ والنصوص المنقولة بلفظها مع رقم صفحتها. فارجع إلى الأصل عند النقل والاستشهاد.</p>
      <div class="kurpages" id="kurpages">${pages.map((_, i) => `<figure class="kurpg" data-n="${i}"><div class="kurph">صفحة ${toAr(i + 1)}</div><figcaption><button class="btn s" data-kur="png" data-n="${i}">⇩ صورة</button></figcaption></figure>`).join("")}</div><div id="kurtxt" hidden></div>`);
    window.__kur = { K, pages, id };
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const f = e.target; io.unobserve(f); const cv = document.createElement("canvas"); draw(cv, K, pages, +f.dataset.n); const im = new Image(); im.alt = "صفحة " + toAr(+f.dataset.n + 1) + " من كراسة " + K.t; im.src = cv.toDataURL("image/jpeg", .88); im.loading = "lazy"; const ph = f.querySelector(".kurph"); if (ph) ph.replaceWith(im); }), { rootMargin: "800px" });
    document.querySelectorAll(".kurpg").forEach(f => io.observe(f));
  }
  function textView(K) {
    const bl = b => b.k === "points" || b.k === "steps" ? `<h4>${ICON[b.k]} ${esc(b.t || TTL[b.k])}</h4><${b.k === "steps" ? "ol" : "ul"}>${b.items.map(x => `<li>${esc(x)}</li>`).join("")}</${b.k === "steps" ? "ol" : "ul"}>`
      : b.k === "def" ? `<h4>📖 تعريفات</h4><dl>${b.items.map(d => `<dt>${esc(d.t)}</dt><dd>${esc(d.d)}</dd>`).join("")}</dl>`
      : b.k === "table" || b.k === "compare" ? `<h4>${ICON[b.k]} ${esc(b.t || TTL[b.k])}</h4><table class="kurtb"><tr>${(b.k === "compare" ? ["", b.a, b.b] : b.head).map(h => `<th>${esc(h)}</th>`).join("")}</tr>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`
      : b.k === "map" ? `<h4>🧠 ${esc(b.t || TTL.map)}</h4><ul><li><b>${esc(b.root)}</b><ul>${b.c.map(x => `<li>${esc(x.t)}${x.c.length ? `<ul>${x.c.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul></li></ul>`
      : b.k === "quote" ? `<blockquote>«${esc(b.t)}» <small>${b.by ? esc(b.by) + " — " : ""}ص ${toAr(b.p || 1)}</small></blockquote>`
      : b.k === "note" ? `<p class="note">⚠️ ${esc(b.t)}</p>` : b.k === "qs" ? `<h4>✍️ اختبر نفسك</h4>${b.items.map(x => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join("")}` : "";
    return `<article class="kurtext">${K.s ? `<p class="brief">${esc(K.s)}</p>` : ""}${K.secs.map((s, i) => `<section><h3>${toAr(i + 1)}. ${esc(s.t)} <small class="mut">ص ${toAr(s.p[0])}–${toAr(s.p[1])}</small></h3>${s.lead ? `<p><i>${esc(s.lead)}</i></p>` : ""}${s.blocks.map(bl).join("")}</section>`).join("")}${(K.qs || []).length ? `<section><h3>أسئلة شاملة</h3>${bl({ k: "qs", items: K.qs })}</section>` : ""}</article>`;
  }
  async function list() {
    const L = (await getJ("kurrasa/_list.json")) || {}, staff = isAdmin(), ids = Object.keys(L).filter(k => L[k].ok || staff), Q = staff ? (await getJ("kurrasa/_queue.json")) || { items: [] } : null;
    view(`<div class="cmhero kur"><div><h2>كراسات المكتبة</h2><p>الكتاب في كراسة مذاكرة ومراجعة: نحو صفحة لكل عشر صفحات، بأقسام وتمهيد، وأهم المسائل، وتعريفات، وجداول ومقارنات، وخرائط ذهنية، ونصوص بلفظها، وتنبيهات، وأسئلة مراجعة؛ بألوان جذابة، تُقرأ في الموقع وتُحمَّل PDF أو صورًا. والمادة من الكتاب نفسه بلا إضافة ولا تغيير لآراء المؤلف.</p></div></div>
      ${ids.length ? `<div class="agrid">${ids.map(k => `<a class="acard2" href="#/kurrasat/${esc(k)}"><span class="acov" style="${typeof avHue === "function" ? avHue(k) : ""}"><i>📘</i><em>${esc((L[k].t || "").split(/\s+/).slice(0, 3).join(" "))}</em></span><b>${esc(L[k].t || k)}</b><small class="mut">${esc(L[k].a || "")} • ${toAr(L[k].secs || 0)} قسمًا${L[k].ok ? "" : " • غير منشورة"}</small></a>`).join("")}</div>` : '<p class="note">لم تُصدر كراسات بعد. تختار الإدارة الكتب فتُعدّ كراساتها آليًا وتظهر هنا.</p>'}
      ${staff ? `<div class="card" style="margin-top:14px"><h3>اختيار كتاب لتحويله إلى كراسة (للإدارة)</h3><p class="mut">يُفضَّل كتاب اكتمل تدقيق نصه. يُعدّ القسم بقسمه من نص الكتاب، ويُتحقق من النصوص المنقولة بلفظها، وتُنشر الكراسة مباشرة ولك إيقاف عرضها.</p>
        <form data-form="kurq" class="sbox" style="max-width:none"><input name="t" list="kurbooks" placeholder="اكتب اسم الكتاب ثم اختره" required><datalist id="kurbooks">${BOOKS().filter(x => !x.hidden && !isArt(x) && !VOL2(x)).slice(0, 5000).map(x => `<option value="${esc(x.setTitle && x.vol ? x.title : x.title)}">`).join("")}</datalist><button class="btn p">أعِدّ الكراسة</button></form><p id="kurqs" class="mut"></p>
        ${(Q.items || []).length ? `<p class="mut">في الطابور: ${(Q.items || []).map(x => esc((B(x.id || x) || {}).title || x.id || x)).join("، ")}</p>` : ""}</div>` : ""}`);
  }
  async function queue(id) { await GH.editJSON("data/kurrasa/_queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [{ id }].concat(o.items.filter(x => (x.id || x) !== id)); return o; }, "كراسة: «" + ((B(id) || {}).title || id) + "»"); }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=kurq]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const t = String(f.t.value || "").trim(), b = BOOKS().find(x => x.title === t); if (!b) return toast("اختر اسم الكتاب من القائمة");
    try { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await queue(b.id); $("#kurqs").textContent = "أُضيف «" + b.title + "» إلى الطابور؛ يبدأ الإعداد خلال دقائق ويصلك إشعار عند انتهائه."; f.reset(); } catch (x) { toast(x.message); }
  }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-kur]"); if (!el) return; e.preventDefault(); const a = el.dataset.kur, X = window.__kur; if (!X) return;
    try {
      if (a === "png") { const cv = document.createElement("canvas"); draw(cv, X.K, X.pages, +el.dataset.n); cv.toBlob(bl => dl(`kurrasa-${X.id}-${+el.dataset.n + 1}.png`, bl), "image/png"); }
      else if (a === "zip") { const cv = document.createElement("canvas"), files = []; for (let i = 0; i < X.pages.length; i++) { toast("جارٍ رسم الصفحات " + toAr(i + 1) + " من " + toAr(X.pages.length)); draw(cv, X.K, X.pages, i); const bl = await new Promise(r => cv.toBlob(r, "image/jpeg", .9)); files.push([`kurrasa-${X.id}-${String(i + 1).padStart(2, "0")}.jpg`, new Uint8Array(await bl.arrayBuffer())]); } dl(`kurrasa-${X.id}.zip`, new Blob([EXT.zip(files)], { type: "application/zip" })); toast("حُفظت الكراسة صورًا"); }
      else if (a === "pdf") { const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة"); const cv = document.createElement("canvas"), im = []; for (let i = 0; i < X.pages.length; i++) { draw(cv, X.K, X.pages, i); im.push(cv.toDataURL("image/jpeg", .9)); }
        w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كراسة ${esc(X.K.t)} — ${esc(SITENAME)}</title><style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block;page-break-after:always}</style></head><body>${im.map(u => `<img src="${u}">`).join("")}<script>onload=()=>setTimeout(()=>print(),500)<\/script></body></html>`); w.document.close(); }
      else if (a === "txt") { const t = $("#kurtxt"), p = $("#kurpages"); if (t.hidden) { t.innerHTML = textView(X.K); } t.hidden = !t.hidden; p.hidden = !t.hidden; el.textContent = t.hidden ? "عرض نصي" : "عرض الصفحات"; }
      else if (a === "ok") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); await GH.editJSON("data/kurrasa/_list.json", o => { if (o && o[X.id]) o[X.id].ok = +el.dataset.on; return o; }, (el.dataset.on === "1" ? "اعتماد" : "إيقاف") + " كراسة: " + X.K.t); toast("حُفظ؛ يسري خلال دقائق"); }
      else if (a === "redo") { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); if (!confirm("إعادة إعداد الكراسة من جديد؟")) return; await queue(X.id); toast("أُضيفت إلى الطابور"); }
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
    if (!(b.tags || []).includes("tafrigh")) return; const rb = $("#rb"), paper = $("#paper"); if (!rb || !paper || $(".tfseg")) return;
    if (!TFE.has(b.id)) TFE.set(b.id, getJ("tfedit/" + b.id + ".json")); const d = await TFE.get(b.id), pg = d && d.pages && d.pages[String(p)];
    if (!pg || $(".tfseg")) return; const v = S.tfv || "o";
    paper.insertAdjacentHTML("afterbegin", `<div class="seg tfseg" role="radiogroup" aria-label="نص التفريغ">${[["o", "كما أُلقي"], ["f", "منسَّق ومدقَّق"], ["r", "بأسلوب كتابي"]].map(([k, t]) => `<button type="button" role="radio" data-tfv="${k}" aria-checked="${v === k}">${t}</button>`).join("")}</div><p class="mut tfnote" ${v === "r" ? "" : "hidden"}>صياغة المكتبة بتصرف لكلام الشيخ، بلا زيادة ولا نقص في المعنى؛ والأصل ما أُلقي.</p>`);
    const orig = rb.innerHTML, set = k => { rb.innerHTML = k === "o" ? orig : pageHtml(pg[k] || "", "", [], null); $$(".tfseg [data-tfv]").forEach(x => x.setAttribute("aria-checked", x.dataset.tfv === k)); const n = $(".tfnote"); if (n) n.hidden = k !== "r"; };
    if (v !== "o") set(v);
    $$(".tfseg [data-tfv]").forEach(x => x.onclick = () => { S.tfv = x.dataset.tfv; saveS(); set(x.dataset.tfv); });
  }
  return { view: open, tahrir, tfReader, layout, draw };
})();
