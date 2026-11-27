/* عرض المقالات والفتاوى المستجلبة: بطاقة للآية بمرجعها ورابطها في المصحف، وبطاقة للحديث برابط الحديث إن عُرف،
   وبطاقتا السؤال والجواب، وهوية مكتبة الدعوة (شريط ذهبي أخضر). لا يغيّر النص الأصلي: يلفّ المواضع المميزة فقط. */
(function () {
  const ART = /^(sv|as|an)\d/;
  const qn = s => String(s || "").replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200b-\u200f\ufeff]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\u0621-\u064a ]/g, " ").replace(/\s+/g, " ").trim();
  let QI = null, HI = null, SNM = [];
  const getJ = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  async function quranIdx() { if (QI) return QI; const j = await getJ("data/quran/quran.json"); if (!j) return (QI = []); QI = []; SNM = j.suras.map(s => qn(s.name).replace(/^سوره\s+/, "")); j.suras.forEach(s => s.ayat.forEach((t, i) => QI.push([s.n, i + 1, " " + qn(t) + " "]))); return QI; }
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
    if (!rd._fmo) { rd._fmo = new MutationObserver(() => { clearTimeout(rd._fmt); rd._fmt = setTimeout(() => { if (rd.isConnected && !rd.querySelector(".vref,.href,.vcard,.hcard,p.fq,p.fa")) enhance0(rd).catch(() => {}); }, 300); }); rd._fmo.observe(rd, { childList: true }); }
    // السؤال والجواب
    rd.querySelectorAll(":scope > p").forEach(p => { const t = (p.textContent || "").trim(); if (/^(السؤال|الجواب|س|ج)\s*[:：]/.test(t) || /^(السؤال|الجواب)\s*:?$/.test(t)) p.classList.add(/^(السؤال|س)/.test(t) ? "fq" : "fa"); });
    const ps = [...rd.querySelectorAll(":scope > p")];
    const I = await quranIdx(); const H = await hadithIdx(), SN = SNM.map(x => x.replace(/^ال(?!\s)/, ""));
    const sid = n => { n = qn(n).replace(/^سوره\s+/, "").replace(/^ال(?!\s)/, ""); return SN.findIndex(x => x === n) + 1; };
    const dg = s => String(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const VR = /\(\s*([^()]{8,}?)\s*\)\s*\(\s*(?:سورة\s+)?([^():：\d٠-٩]{2,25}?)\s*[:：]\s*([\d٠-٩]+)(?:\s*[-–]\s*[\d٠-٩]+)?\s*\)/g;
    const HQ = /(?:ﷺ|صلى الله عليه وسلم)[^"“«]{0,40}[:：]?\s*[“"«]([^"”»]{18,}?)["”»]/g;
    ps.forEach(p => {
      if (p.dataset.fm) return; p.dataset.fm = "1";
      const ws = [...p.querySelectorAll(".w")]; if (!ws.length) return;
      let txt = "", off = ws.map(w => { const a = txt.length; txt += w.textContent + " "; return a; });
      const rng = (a, b) => ws.filter((w, k) => off[k] < b && off[k] + w.textContent.length > a);
      const chip = (g, href, label, cls) => { const a = document.createElement("a"); a.className = cls; a.href = href; a.textContent = label; g[g.length - 1].after(a); };
      let m; VR.lastIndex = 0;
      while ((m = VR.exec(txt))) {
        const s = sid(m[2]), a = +dg(m[3]); if (!s) continue;
        const g = rng(m.index, m.index + m[0].length); if (g.length < 3) continue;
        g.forEach(w => w.classList.add("vcard")); chip(g, "#/mushaf/" + s + "?a=" + a, "المصحف ↗", "vref");
      }
      HQ.lastIndex = 0;
      while ((m = HQ.exec(txt))) {
        const q0 = m.index + m[0].indexOf(m[1]), g = rng(q0, q0 + m[1].length); if (g.length < 4) continue;
        g.forEach(w => w.classList.add("hcard"));
        const t = " " + qn(m[1]).split(" ").slice(0, 6).join(" ") + " ", h = H.find(x => x[1].includes(t));
        if (h) chip(g, "#/hadith/x/" + h[0], "الحديث وشرحه ↗", "href");
      }
    });
  }
  window.FMT = { enhance };
  const old = window.paintNotes;
})();
