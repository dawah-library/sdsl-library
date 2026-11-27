/* عرض المقالات والفتاوى المستجلبة: بطاقة للآية بمرجعها ورابطها في المصحف، وبطاقة للحديث برابط الحديث إن عُرف،
   وبطاقتا السؤال والجواب، وهوية مكتبة الدعوة (شريط ذهبي أخضر). لا يغيّر النص الأصلي: يلفّ المواضع المميزة فقط. */
(function () {
  const ART = /^[a-z0-9_.-]+$/i;
  const qn = s => String(s || "").replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200b-\u200f\ufeff]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0621-\u064a ]/g, " ").replace(/\s+/g, " ").trim();
  let QI = null, HI = null, SNM = [], SNR = [];
  const getJ = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  async function quranIdx() { if (QI) return QI; const j = await getJ("data/quran/quran.json"); if (!j) return (QI = []); QI = []; SNR = j.suras.map(s => s.name); SNM = j.suras.map(s => qn(s.name).replace(/^سوره\s+/, "")); j.suras.forEach(s => s.ayat.forEach((t, i) => QI.push([s.n, i + 1, " " + qn(t) + " "]))); return QI; }
  async function hadithIdx() { if (HI) return HI; const j = await getJ("data/hadith/index.json"); HI = j ? j.items.map(x => [x[0], " " + qn(x[6]) + " "]) : []; return HI; }
  const NAMES = () => { try { return SURAS || []; } catch (e) { return []; } };
  function findVerse(q, I) {
    const t = " " + qn(q) + " "; if (t.trim().split(" ").length < 3) return null;
    const hit = I.find(x => x[2].includes(t)); return hit ? { s: hit[0], a: hit[1] } : null;
  }
  async function enhance(rd) {
    try { await enhance0(rd); } catch (e) { console.error("FMTERR " + e.message); }
  }
  async function enhance0(rd) {
    if (!rd || !ART.test(rd.dataset.id || "")) return; rd.classList.add("fmtd");
    if (!rd._fmo) { rd._fmo = new MutationObserver(() => { clearTimeout(rd._fmt); rd._fmt = setTimeout(() => { if (rd.isConnected && !rd.querySelector(".vcard,.hcard,p.fq,p.fa")) enhance0(rd).catch(() => {}); }, 300); }); rd._fmo.observe(rd, { childList: true }); }
    // السؤال والجواب
    rd.querySelectorAll(":scope > p").forEach(p => { const t = (p.textContent || "").trim(); if (/^(السؤال|الجواب|س|ج)\s*[:：]/.test(t) || /^(السؤال|الجواب)\s*:?$/.test(t)) p.classList.add(/^(السؤال|س)/.test(t) ? "fq" : "fa"); });
    const ps = [...rd.querySelectorAll(":scope > p")];
    const need = ps.some(p => /[﴿(]/.test(p.textContent || "")), needH = ps.some(p => /ﷺ|صلى الله عليه وسلم/.test(p.textContent || ""));
    if (!need && !needH) return;
    const I = need ? await quranIdx() : (QI || []); const H = needH ? await hadithIdx() : (HI || []), SN = SNM.map(x => x.replace(/^ال(?!\s)/, ""));
    const sid = n => { n = qn(n).replace(/^سوره\s+/, "").replace(/^ال(?!\s)/, ""); return SN.findIndex(x => x === n) + 1; };
    const dg = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const VR = /\(\s*([^()]{8,}?)\s*\)\s*\(\s*(?:سورة\s+)?([^():：\d٠-٩]{2,25}?)\s*[:：]\s*([\d٠-٩]+)(?:\s*[-–]\s*[\d٠-٩]+)?\s*\)/g;
    const HQ = /(?:ﷺ|صلى الله عليه وسلم)[^"“«]{0,40}[:：]?\s*[“"«]([^"”»]{18,}?)["”»]/g;
    ps.forEach(p => {
      if (p.dataset.fm) return; p.dataset.fm = "1";
      const ws = [...p.querySelectorAll(".w")]; if (!ws.length) return;
      let txt = "", off = ws.map(w => { const a = txt.length; txt += w.textContent + " "; return a; });
      const rng = (a, b) => ws.filter((w, k) => off[k] < b && off[k] + w.textContent.length > a);
      const mark = (g, cls, d) => { g.forEach(w => { w.classList.add(cls); Object.assign(w.dataset, d); }); g[g.length - 1].classList.add(cls + "end"); };
      const chip = (g, href, label, cls) => { const a = document.createElement("a"); a.className = cls; a.href = href; a.textContent = label; g[g.length - 1].after(a); };
      let m; VR.lastIndex = 0;
      while ((m = VR.exec(txt))) {
        const s = sid(m[2]), a = +dg(m[3]); if (!s) continue;
        const g = rng(m.index, m.index + m[0].length); if (g.length < 3) continue;
        mark(g, "vcard", { vs: s, va: a });
      }
      const V2 = /[﴿«]\s*([^﴾»]{8,}?)\s*[﴾»]\s*[\(\[]\s*(?:سورة\s+)?([^()\[\]:：\d٠-٩]{2,25}?)\s*[:：،,/]\s*(?:آية\s*)?([\d٠-٩]+)(?:\s*[-–]\s*[\d٠-٩]+)?\s*[\)\]]/g, V3 = /﴿\s*([^﴾]{12,}?)\s*﴾/g;
      V2.lastIndex = 0;
      while ((m = V2.exec(txt))) {
        const s = sid(m[2]), a = +dg(m[3]); if (!s) continue;
        const g = rng(m.index, m.index + m[0].length); if (g.length < 3 || g[0].classList.contains("vcard")) continue;
        mark(g, "vcard", { vs: s, va: a });
      }
      V3.lastIndex = 0;
      while ((m = V3.exec(txt))) {
        const g = rng(m.index, m.index + m[0].length); if (g.length < 3 || g[0].classList.contains("vcard")) continue;
        const f = findVerse(m[1], I); if (f) mark(g, "vcard", { vs: f.s, va: f.a });
      }
      HQ.lastIndex = 0;
      while ((m = HQ.exec(txt))) {
        const q0 = m.index + m[0].indexOf(m[1]), g = rng(q0, q0 + m[1].length); if (g.length < 4) continue;
        
        const t = " " + qn(m[1]).split(" ").slice(0, 6).join(" ") + " ", h = H.find(x => x[1].includes(t));
        if (h) mark(g, "hcard", { hid: h[0], hb: h[1] });
      }
    });
  }

  // لوحة جانبية بجوار الآية أو الحديث: التفسير الموجز وغريب الكلمات (الآية)، والشرح الموجز (الحديث)، مع خيار الانتقال إلى الموضع
  const ESC = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clean = t => String(t || "").replace(/^[\s\S]*\[التفسير\]\s*/, "").replace(/\[\[[\s\S]*?\]\]/g, "").trim();
  const TJ = {}, tj = (k, s) => TJ[k + s] || (TJ[k + s] = getJ("data/quran/tafsir/" + k + "/" + s + ".json").then(x => x || {}));
  function pnl() { let p = document.getElementById("fmtp"); if (!p) { p = document.createElement("aside"); p.id = "fmtp"; p.setAttribute("dir", "rtl"); document.body.appendChild(p); p.addEventListener("click", e => { const b = e.target.closest("[data-fk]"); if (b) { e.preventDefault(); verseTab(p, b.dataset.fk); } if (e.target.closest(".fmtx")) p.classList.remove("on"); if (e.target.closest("a[href]")) p.classList.remove("on"); }); document.addEventListener("keydown", e => { if (e.key === "Escape") p.classList.remove("on"); }); window.addEventListener("hashchange", () => p.classList.remove("on")); } return p; }
  async function verseTab(p, k) {
    const s = +p.dataset.s, a = +p.dataset.a, box = p.querySelector(".fmtb"); p.querySelectorAll("[data-fk]").forEach(b => b.classList.toggle("on", b.dataset.fk === k)); box.textContent = "…";
    const T = await tj(k, s); let html = "";
    if (k === "siraj") { const v = T[a]; html = Array.isArray(v) && v.length ? "<dl>" + v.map(([w, m]) => "<dt>﴿" + ESC(w) + "﴾</dt><dd>" + ESC(m) + "</dd>").join("") + "</dl>" : "<p class=mut>لا غريب لهذه الآية في «السراج في بيان غريب القرآن».</p>"; }
    else { let t = T[a]; if (!t) { for (let x = a - 1; x >= 1 && !t; x--) if (T[x] && typeof T[x] === "string" && x >= a - 12) t = T[x]; } html = t ? "<p>" + ESC(clean(t)).replace(/\n+/g, "</p><p>") + "</p>" : "<p class=mut>لا نص لهذه الآية في هذا التفسير.</p>"; }
    if (p.dataset.s == s && p.dataset.a == a) box.innerHTML = html;
  }
  async function openVerse(w) {
    const s = +w.dataset.vs, a = +w.dataset.va; await quranIdx(); const p = pnl();
    p.dataset.s = s; p.dataset.a = a; p.dataset.t = "v";
    p.innerHTML = '<header><b>' + ESC(String(SNR[s - 1] || "").replace(/^سُورَةُ\s*/, "سورة ")) + " : " + a + '</b><button class="fmtx" aria-label="إغلاق">✕</button></header><nav><button data-fk="mokhtasar">المختصر في التفسير</button><button data-fk="muyassar">التفسير الميسر</button><button data-fk="siraj">غريب الكلمات</button></nav><div class="fmtb"></div><div class="fmtf"><a class="btn s p" href="#/mushaf/' + s + "?a=" + a + '">الانتقال إلى المصحف عند الآية</a></div>';
    p.classList.add("on"); verseTab(p, "mokhtasar");
  }
  async function openHadith(w) {
    const id = w.dataset.hid, b = w.dataset.hb, p = pnl(); p.dataset.t = "h"; p.dataset.s = ""; p.dataset.a = "";
    p.innerHTML = '<header><b>شرح موجز للحديث</b><button class="fmtx" aria-label="إغلاق">✕</button></header><div class="fmtb">…</div><div class="fmtf"><a class="btn s p" href="#/hadith/x/' + ESC(id) + '">الحديث وشرحه الكامل</a></div>';
    p.classList.add("on"); const box = p.querySelector(".fmtb");
    try { if (window.HSH) await window.HSH.into(box, b, id, false); else box.textContent = ""; } catch (e) { box.innerHTML = "<p class=mut>تعذّر تحميل الشرح.</p>"; }
  }
  document.addEventListener("click", e => { const w = e.target.closest && e.target.closest(".rd .w.vcard,.rd .w.hcard"); if (!w) return; if (w.closest("a")) return; e.preventDefault(); e.stopPropagation(); (w.classList.contains("vcard") ? openVerse : openHadith)(w); }, true);
  window.FMT = { enhance };
  const old = window.paintNotes;
})();
