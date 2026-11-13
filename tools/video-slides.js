// مشاهد فيديو الكتاب: كل مشهد صفحة HTML عربية تُصوَّر بالمتصفح إلى PNG (يستدعيه tools/book-video.py).
// الاستعمال: node tools/video-slides.js spec.json  ← f00.png, f01.png … في مجلد spec.out
const fs = require("fs"), path = require("path");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(path.join(process.cwd(), "node_modules", "playwright"))); }
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = S.theme || {}, [W, H] = S.aspect === "9:16" ? [1080, 1920] : [1920, 1080];
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAT = { stars: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.08) 0 2px, transparent 3px) 0 0/90px 90px", lines: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px)", arch: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,.10) 0 40%, transparent 41%)", none: "none" };
const page = (s, i, n) => `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Readex+Pro:wght@400;600&family=Aref+Ruqaa:wght@700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;background:${T.bg || "#0f3d33"};background-image:${PAT[T.pat] || PAT.stars};color:${T.c1 || "#fff"};font-family:"Readex Pro",sans-serif;display:flex;flex-direction:column;padding:${H > W ? "140px 80px" : "90px 140px"};overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;font-size:${H > W ? 34 : 28}px;color:${T.c2 || "#cfe6dc"}}.top b{font-family:"Aref Ruqaa",Amiri,serif;color:${T.acc || "#d4af37"};font-size:1.3em}
h1{font-family:Amiri,serif;font-size:${H > W ? 88 : 82}px;line-height:1.35;margin:${H > W ? "120px 0 60px" : "60px 0 44px"};color:${T.acc || "#d4af37"};border-inline-start:12px solid ${T.acc || "#d4af37"};padding-inline-start:28px}
ul{list-style:none;display:grid;gap:${H > W ? 40 : 28}px}li{font-size:${H > W ? 54 : 48}px;line-height:1.55;padding-inline-start:56px;position:relative}li:before{content:"";position:absolute;inset-inline-start:0;top:.55em;width:24px;height:24px;border-radius:50%;background:${T.acc || "#d4af37"}}
.bar{margin-top:auto;height:10px;border-radius:10px;background:rgba(255,255,255,.15);overflow:hidden}.bar i{display:block;height:100%;width:${Math.round((i + 1) * 100 / n)}%;background:${T.acc || "#d4af37"}}
.foot{margin-top:18px;font-size:26px;color:${T.c2 || "#cfe6dc"};display:flex;justify-content:space-between}</style></head>
<body><div class="top"><b>${esc(S.title)}</b><span>${i + 1} / ${n}</span></div><h1>${esc(s.h)}</h1><ul>${(s.pts || []).slice(0, 5).map(p => `<li>${esc(p)}</li>`).join("")}</ul>
<div class="bar"><i></i></div><div class="foot"><span>المكتبة الرقمية للدعوة السلفية</span><span>dawahlibrary.org</span></div></body></html>`;
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: W, height: H } });
  for (let i = 0; i < S.scenes.length; i++) { await p.setContent(page(S.scenes[i], i, S.scenes.length), { waitUntil: "networkidle" }).catch(() => { }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(S.out, "f" + String(i).padStart(2, "0") + ".png") }); }
  await b.close();
})();
