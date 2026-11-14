// مشاهد فيديو الكتاب: كل مشهد صفحة HTML عربية تُصوَّر بالمتصفح إلى PNG (يستدعيه tools/book-video.py).
// الاستعمال: node tools/video-slides.js spec.json  ← f00.png, f01.png … في مجلد spec.out
const fs = require("fs"), path = require("path");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(path.join(process.cwd(), "node_modules", "playwright"))); }
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = S.theme || {}, [W, H] = { "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] }[S.aspect] || [1920, 1080];
const FPS = S.fps || 20;
const FONT = { amiri: "Amiri,serif", ruqaa: "'Aref Ruqaa',Amiri,serif", kufi: "'Reem Kufi',sans-serif", readex: "'Readex Pro',sans-serif" }[T.font] || "Amiri,serif";
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAT = { stars: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.08) 0 2px, transparent 3px) 0 0/90px 90px", lines: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px)", arch: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,.10) 0 40%, transparent 41%)", none: "none" };
const page = (s, i, n) => `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Readex+Pro:wght@400;600&family=Aref+Ruqaa:wght@700&family=Reem+Kufi:wght@600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;background:${T.bg || "#0f3d33"};background-image:${PAT[T.pat] || PAT.stars};color:${T.c1 || "#fff"};font-family:"Readex Pro",sans-serif;display:flex;flex-direction:column;padding:${H > W ? "140px 80px" : "90px 140px"};overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;font-size:${H > W ? 34 : 28}px;color:${T.c2 || "#cfe6dc"}}.top b{font-family:"Aref Ruqaa",Amiri,serif;color:${T.acc || "#d4af37"};font-size:1.3em}
h1{font-family:${FONT};font-size:${H > W ? 88 : 82}px;line-height:1.35;margin:${H > W ? "120px 0 60px" : "60px 0 44px"};color:${T.acc || "#d4af37"};border-inline-start:12px solid ${T.acc || "#d4af37"};padding-inline-start:28px}
ul{list-style:none;display:grid;gap:${H > W ? 40 : 28}px}li{font-size:${H > W ? 54 : 48}px;line-height:1.55;padding-inline-start:56px;position:relative}li:before{content:"";position:absolute;inset-inline-start:0;top:.55em;width:24px;height:24px;border-radius:50%;background:${T.acc || "#d4af37"}}
.bar{margin-top:auto;height:10px;border-radius:10px;background:rgba(255,255,255,.15);overflow:hidden}.bar i{display:block;height:100%;width:${Math.round((i + 1) * 100 / n)}%;background:${T.acc || "#d4af37"}}
.cap{margin-top:auto;margin-bottom:24px;font-size:${H > W ? 34 : 30}px;line-height:1.6;color:${T.c2 || "#cfe6dc"};background:rgba(0,0,0,.18);padding:14px 20px;border-radius:14px}.cap+.bar{margin-top:0}.foot{margin-top:18px;font-size:26px;color:${T.c2 || "#cfe6dc"};display:flex;justify-content:space-between}</style></head>
<body><div class="top"><b>${esc(S.title)}</b><span>${i + 1} / ${n}</span></div><h1>${esc(s.h)}</h1><ul>${(s.pts || []).slice(0, 5).map(p => `<li>${esc(p)}</li>`).join("")}</ul>
${T.cap && s.say ? `<p class="cap">${esc(String(s.say).slice(0, 260))}${String(s.say).length > 260 ? "…" : ""}</p>` : ""}<div class="bar"><i></i></div><div class="foot"><span>المكتبة الرقمية للدعوة السلفية</span><span>dawahlibrary.org</span></div></body></html>`;
// صفحة الكتاب في أول المشهد: تنقلب الصفحة (٠–٠٫٧ث) ثم يمر قلم التحديد على العبارة سطرًا سطرًا، ثم تثبت ٠٫٦ث.
// المصورة: صورة الصفحة وصناديق السطور من tesseract (نسب)، وإلا صفحة النص بخط الكتاب مع تعليم الجملة ⟦ ⟧.
// تُلتقط إطارات بمعدل FPS بالتحكم في زمن الحركات (WAAPI) ← p<NN>/0000.png …
function pageHtml(s) {
  const P = s.page, portrait = H > W, ph = Math.round(H * (portrait ? 0.74 : 0.86)), pw = Math.round(portrait ? Math.min(W * 0.86, ph * 0.72) : ph * 0.7);
  const n = P.img ? (P.boxes || []).length : 1, hl = Math.max(1.0, 0.8 * n), dur = 0.7 + hl + 0.6, acc = "rgba(255,214,10,.55)";
  const img = P.img ? "data:image/png;base64," + fs.readFileSync(P.img).toString("base64") : "";
  const boxes = (P.boxes || []).map((b, k) => `<i class="hl" style="right:${(1 - b[0] - b[2]) * 100}%;top:${(b[1] - 0.004) * 100}%;width:${b[2] * 100}%;height:${(b[3] + 0.008) * 100}%" data-k="${k}"></i>`).join("");
  const txt = P.img ? "" : esc(P.text || "").replace(/⟦([\s\S]*?)⟧/, '<mark class="hlt">$1</mark>').replace(/\n+/g, "<br>");
  return { dur, n, hl, html: `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Readex+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(ellipse at 50% 40%, ${T.bg || "#0f3d33"} 0%, #000 140%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Readex Pro",sans-serif;color:${T.c2 || "#cfe6dc"}}
.cap{font-size:${portrait ? 34 : 28}px;margin-bottom:22px;color:${T.acc || "#d4af37"};font-family:Amiri,serif}.cap span{color:${T.c2 || "#cfe6dc"};font-family:"Readex Pro";font-size:.8em;margin-inline-start:14px}
.desk{position:relative;width:${pw}px;height:${ph}px;perspective:2400px}.under{position:absolute;inset:0;background:#f4ecd8;border-radius:4px;box-shadow:0 30px 60px rgba(0,0,0,.55);transform:translate(-10px,8px) rotate(-1.2deg)}
.pg{position:absolute;inset:0;background:#fbf6ea;border-radius:4px;transform-origin:100% 50%;box-shadow:0 18px 40px rgba(0,0,0,.45);overflow:hidden;backface-visibility:hidden}
.pg img{width:100%;height:100%;object-fit:contain;background:#fff;display:block}.pg .wrap{position:absolute;inset:0}
.txt{padding:${Math.round(pw * 0.08)}px;font-family:Amiri,serif;font-size:${Math.round(pw / 22)}px;line-height:1.9;color:#2b2416;text-align:justify;height:100%;overflow:hidden}
.hd{font-size:.6em;color:#8a7a5a;border-bottom:1px solid #d9cba8;margin-bottom:.6em;display:flex;justify-content:space-between}.ft{position:absolute;bottom:${Math.round(pw * 0.03)}px;left:0;right:0;text-align:center;font-size:${Math.round(pw / 34)}px;color:#8a7a5a;font-family:Amiri}
.hl{position:absolute;background:linear-gradient(${acc},${acc}) no-repeat right/0% 100%;mix-blend-mode:multiply;border-radius:6px}
.hlt{background:linear-gradient(${acc},${acc}) no-repeat right/0% 100%;color:inherit;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .1em;border-radius:4px}
.pen{position:absolute;width:${Math.round(pw / 7)}px;height:auto;transform:translate(-30%,-78%) rotate(-28deg);filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));opacity:0}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.35),transparent 30%);opacity:0;pointer-events:none}</style></head>
<body><div class="cap">${esc(S.title)}<span>${/^\d+$/.test(String(P.label || P.n)) ? "ص " : ""}${esc(String(P.label || P.n))}</span></div><div class="desk"><div class="under"></div><div class="pg" id="pg">${P.img ? `<div class="wrap"><img src="${img}">${boxes}</div>` : `<div class="txt"><div class="hd"><span>${esc(S.title)}</span><span>${esc(String(P.label || P.n))}</span></div>${txt}</div><div class="ft">— ${esc(String(P.label || P.n))} —</div>`}<div class="shade" id="sh"></div></div>
<svg class="pen" id="pen" viewBox="0 0 120 40"><rect x="20" y="8" width="86" height="24" rx="6" fill="#2d6a4f"/><rect x="96" y="10" width="20" height="20" rx="4" fill="#1b4332"/><path d="M20 10 L4 16 L4 24 L20 30 Z" fill="#ffd60a"/><path d="M4 16 L0 18 L0 22 L4 24 Z" fill="#e0b400"/><rect x="34" y="14" width="40" height="4" rx="2" fill="rgba(255,255,255,.35)"/></svg></div>
<script>
const D=${JSON.stringify({ dur: 0, hl: 0 })};window.setup=(hl,n)=>{const pg=document.getElementById("pg"),sh=document.getElementById("sh"),pen=document.getElementById("pen"),ms=1000;
 pg.animate([{transform:"rotateY(-95deg)"},{transform:"rotateY(0deg)"}],{duration:.7*ms,easing:"cubic-bezier(.2,.7,.3,1)",fill:"both"});
 sh.animate([{opacity:.9},{opacity:0}],{duration:.7*ms,fill:"both"});
 const els=[...document.querySelectorAll(".hl,.hlt")],per=hl/Math.max(1,els.length);
 els.forEach((e,k)=>e.animate([{backgroundSize:"0% 100%"},{backgroundSize:"100% 100%"}],{duration:per*ms,delay:(.7+k*per)*ms,easing:"ease-in-out",fill:"both"}));
 const desk=document.querySelector(".desk").getBoundingClientRect(),kf=[];els.forEach((e,k)=>{const r=e.getBoundingClientRect(),y=r.top-desk.top+r.height*.5;kf.push({left:(r.right-desk.left)+"px",top:y+"px",offset:(k*per)/hl},{left:(r.left-desk.left)+"px",top:y+"px",offset:Math.min(1,((k+1)*per)/hl)})});
 if(kf.length){kf[0].opacity=1;kf[kf.length-1].opacity=1;pen.animate([{opacity:0},{opacity:1}],{duration:150,delay:.6*ms,fill:"both"});pen.animate(kf,{duration:hl*ms,delay:.7*ms,fill:"both"});pen.animate([{opacity:1},{opacity:0}],{duration:250,delay:(.7+hl)*ms,fill:"forwards"})}
 document.getAnimations().forEach(a=>a.pause())};
window.at=t=>document.getAnimations().forEach(a=>{a.currentTime=t*1000});
</script></body></html>` };
}
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: W, height: H } });
  for (let i = 0; i < S.scenes.length; i++) { await p.setContent(page(S.scenes[i], i, S.scenes.length), { waitUntil: "networkidle" }).catch(() => { }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(S.out, "f" + String(i).padStart(2, "0") + ".png") }); }
  if (S.pages) for (let i = 0; i < S.scenes.length; i++) {
    const s = S.scenes[i]; if (!s.page) continue;
    const g = pageHtml(s), dir = path.join(S.out, "p" + String(i).padStart(2, "0")); fs.mkdirSync(dir, { recursive: true });
    await p.setContent(g.html, { waitUntil: "networkidle" }).catch(() => { }); await p.evaluate(() => document.fonts && document.fonts.ready); await p.waitForTimeout(200);
    await p.evaluate(([hl, n]) => window.setup(hl, n), [g.hl, g.n]);
    const nf = Math.round(g.dur * FPS);
    for (let f = 0; f < nf; f++) { await p.evaluate(t => window.at(t), f / FPS); await p.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png") }); }
  }
  await b.close();
})();
