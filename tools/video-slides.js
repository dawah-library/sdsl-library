// مشاهد فيديو الكتاب: كل مشهد صفحة HTML عربية تُصوَّر بالمتصفح إلى PNG (يستدعيه tools/book-video.py).
// الاستعمال: node tools/video-slides.js spec.json  ← f00.png, f01.png … في مجلد spec.out
const fs = require("fs"), path = require("path");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require(path.join(process.cwd(), "node_modules", "playwright"))); }
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), T = S.theme || {}, [W, H] = { "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] }[S.aspect] || [1920, 1080];
const FPS = S.fps || 20;
const FONT = { amiri: "Amiri,serif", ruqaa: "'Aref Ruqaa',Amiri,serif", kufi: "'Reem Kufi',sans-serif", readex: "'Readex Pro',sans-serif" }[T.font] || "Amiri,serif";
// أيقونات المشاهد من أيقونات الموقع نفسها (icons.js، Lucide)؛ واللقطة المولَّدة خلف الشريحة تجعل خلفيتها شفافة جزئيًّا (S.bg[i])
let ICONS = {}; try { const vm = require("vm"), ctx = {}; vm.runInNewContext(fs.readFileSync(S.icons || path.join(__dirname, "..", "icons.js"), "utf8").replace(/^const ICONS=/m, "this.ICONS=").replace(/^const /gm, "var "), ctx); ICONS = ctx.ICONS || {}; } catch (e) { }
const hexA = (h, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return "rgba(15,61,51," + a + ")"; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAT = { stars: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.08) 0 2px, transparent 3px) 0 0/90px 90px", lines: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px)", arch: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,.10) 0 40%, transparent 41%)", none: "none" };
// المشهد: العنوان والنقاط، ومعها صفحة الكتاب (إن عُرفت) في الشريحة نفسها: بجوار النقاط في الأفقي والمربع، وتحتها في الطولي.
// تنقلب الصفحة (٠–٠٫٧ث) ثم يمر قلم التحديد على العبارة سطرًا سطرًا ثم يختفي؛ تُلتقط الإطارات p<NN>/0000.png …
// وآخر حالة (الصفحة ثابتة والتحديد ظاهر) هي صورة المشهد f<NN>.png التي تبقى حتى نهاية كلام الراوي.
// المصورة: صورة الصفحة وصناديق السطور من tesseract (نسب)، وإلا صفحة النص بخط الكتاب مع تعليم الجملة ⟦ ⟧.
function page(s, i, n) {
  const P = S.pages && s.page ? s.page : null, portrait = H > W, sq = !portrait && W / H < 1.5, small = portrait ? H / W < 1.5 : sq;
  const k = P ? (small ? 0.72 : portrait ? 0.86 : 0.9) : 1, fz = x => Math.round(x * k);
  const pad = portrait ? (small ? [70, 70] : [120, 80]) : (sq ? [60, 60] : [80, 120]);
  const acc = "rgba(255,214,10,.55)";
  let side = "", hl = 0, nb = 1;
  if (P) {  // الصفحة تملأ ما بقي من المساحة (بنسبة ٠٫٧٢) فلا تتجاوز الشريط والتذييل؛ وخطها بوحدات حاوية الصفحة (cqw)
    nb = P.img ? Math.max(1, (P.boxes || []).length) : 1; hl = Math.max(1.0, 0.8 * nb);
    const img = P.img ? "data:image/png;base64," + fs.readFileSync(P.img).toString("base64") : "";
    const boxes = (P.boxes || []).map((b, k) => `<i class="hl" style="right:${(1 - b[0] - b[2]) * 100}%;top:${(b[1] - 0.004) * 100}%;width:${b[2] * 100}%;height:${(b[3] + 0.008) * 100}%"></i>`).join("");
    const txt = P.img ? "" : esc(P.text || "").replace(/⟦([\s\S]*?)⟧/, '<mark class="hlt">$1</mark>').replace(/\n+/g, "<br>");
    const lab = esc(String(P.label || P.n)), pre = /^\d+$/.test(String(P.label || P.n)) ? "ص " : "";
    side = `<div class="side"><div class="desk"><div class="under"></div><div class="pg" id="pg">${P.img ? `<div class="wrap"><img src="${img}">${boxes}</div>` : `<div class="txt"><div class="hd"><span>${esc(S.title)}</span><span>${lab}</span></div>${txt}</div><div class="ft">— ${lab} —</div>`}<div class="shade" id="sh"></div></div>
<svg class="pen" id="pen" viewBox="0 0 120 40"><rect x="20" y="8" width="86" height="24" rx="6" fill="#2d6a4f"/><rect x="96" y="10" width="20" height="20" rx="4" fill="#1b4332"/><path d="M20 10 L4 16 L4 24 L20 30 Z" fill="#ffd60a"/><path d="M4 16 L0 18 L0 22 L4 24 Z" fill="#e0b400"/><rect x="34" y="14" width="40" height="4" rx="2" fill="rgba(255,255,255,.35)"/></svg></div><div class="plab">📖 ${pre}${lab}</div></div>`;
  }
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Readex+Pro:wght@400;600&family=Aref+Ruqaa:wght@700&family=Reem+Kufi:wght@600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;margin:0}html{background:transparent}body{width:${W}px;height:${H}px;background:${(S.bg || [])[i] ? hexA(T.bg, .58) : T.bg || "#0f3d33"};background-image:${PAT[T.pat] || PAT.stars};color:${T.c1 || "#fff"};font-family:"Readex Pro",sans-serif;display:flex;flex-direction:column;padding:${pad[0]}px ${pad[1]}px;overflow:hidden}
.top{display:flex;justify-content:space-between;align-items:center;font-size:${portrait ? 34 : 28}px;color:${T.c2 || "#cfe6dc"}}.top b{font-family:"Aref Ruqaa",Amiri,serif;color:${T.acc || "#d4af37"};font-size:1.3em}
.main{flex:1;min-height:0;display:flex;flex-direction:${portrait ? "column" : "row"};gap:${portrait ? 40 : 60}px;min-height:0;align-items:${portrait ? "stretch" : "center"}}.txtc{flex:1;min-width:0;display:flex;flex-direction:column;${P && !portrait ? "justify-content:center" : ""}}
h1{font-family:${FONT};font-size:${fz(portrait ? 88 : sq ? 64 : 82)}px;line-height:1.35;margin:${P ? (portrait ? "50px 0 34px" : "0 0 32px") : portrait ? "120px 0 60px" : "60px 0 44px"};color:${T.acc || "#d4af37"};border-inline-start:12px solid ${T.acc || "#d4af37"};padding-inline-start:28px}
ul{list-style:none;display:grid;gap:${fz(portrait ? 40 : 28)}px}li{font-size:${fz(portrait ? 54 : sq ? 40 : 48)}px;line-height:1.5;padding-inline-start:${fz(56)}px;position:relative}li:before{content:"";position:absolute;inset-inline-start:0;top:.55em;width:${fz(24)}px;height:${fz(24)}px;border-radius:50%;background:${T.acc || "#d4af37"}}
.bar{margin-top:${P ? "18px" : "auto"};height:10px;border-radius:10px;background:rgba(255,255,255,.15);overflow:hidden}.bar i{display:block;height:100%;width:${Math.round((i + 1) * 100 / n)}%;background:${T.acc || "#d4af37"}}
.cap{margin-top:${P ? "28px" : "auto"};margin-bottom:${P ? 0 : 24}px;font-size:${fz(portrait ? 34 : 30)}px;line-height:1.6;color:${T.c2 || "#cfe6dc"};background:rgba(0,0,0,.18);padding:14px 20px;border-radius:14px}.cap+.bar{margin-top:0}.foot{margin-top:18px;font-size:26px;color:${T.c2 || "#cfe6dc"};display:flex;justify-content:space-between}
.side{display:flex;flex-direction:column;align-items:center;gap:12px;min-height:0;${portrait ? "flex:1 1 0;min-height:" + Math.round(H * 0.3) + "px" : "align-self:stretch;flex:0 1 " + (sq ? 46 : 36) + "%"}}.plab{font-family:Amiri,serif;font-size:${portrait ? 32 : 26}px;color:${T.acc || "#d4af37"}}
.desk{position:relative;flex:1 1 0;min-height:0;aspect-ratio:.72;max-width:100%;perspective:2400px;container-type:size}.under{position:absolute;inset:0;background:#f4ecd8;border-radius:4px;box-shadow:0 24px 50px rgba(0,0,0,.5);transform:translate(-10px,8px) rotate(-1.2deg)}
.pg{position:absolute;inset:0;container-type:size;background:#fbf6ea;border-radius:4px;transform-origin:100% 50%;box-shadow:0 14px 34px rgba(0,0,0,.42);overflow:hidden;backface-visibility:hidden}
.pg img{width:100%;height:100%;object-fit:contain;background:#fff;display:block}.pg .wrap{position:absolute;inset:0}
.txt{padding:7cqw 8cqw;font-family:Amiri,serif;font-size:4.9cqw;line-height:1.85;color:#2b2416;text-align:justify;height:100%;overflow:hidden}
.hd{font-size:.6em;color:#8a7a5a;border-bottom:1px solid #d9cba8;margin-bottom:.6em;display:flex;justify-content:space-between}.ft{position:absolute;bottom:3cqw;left:0;right:0;text-align:center;font-size:3cqw;color:#8a7a5a;font-family:Amiri}
.hl{position:absolute;background:linear-gradient(${acc},${acc}) no-repeat right/0% 100%;mix-blend-mode:multiply;border-radius:6px}
.hlt{background:linear-gradient(${acc},${acc}) no-repeat right/0% 100%;color:inherit;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .1em;border-radius:4px}
.pen{position:absolute;width:17cqw;height:auto;transform:translate(-30%,-78%) rotate(-28deg);filter:drop-shadow(0 6px 6px rgba(0,0,0,.35));opacity:0}
.sic{width:1em;height:1em;vertical-align:-0.12em;margin-inline-end:.35em;color:${T.acc || "#d4af37"};opacity:.95}.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.35),transparent 30%);opacity:0;pointer-events:none}</style></head>
<body><div class="top"><b>${esc(S.title)}</b><span>${i + 1} / ${n}</span></div>
<div class="main"><div class="txtc"><h1>${ICONS[s.icon] ? `<svg class="sic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[s.icon]}</svg>` : ""}${esc(s.h)}</h1><ul>${(s.pts || []).slice(0, P ? 4 : 5).map(p => `<li>${esc(p)}</li>`).join("")}</ul>
${T.cap && s.say ? `<p class="cap">${esc(String(s.say).slice(0, P ? 180 : 260))}${String(s.say).length > (P ? 180 : 260) ? "…" : ""}</p>` : ""}</div>${side}</div>
<div class="bar"><i></i></div><div class="foot"><span>المكتبة الرقمية للدعوة السلفية</span><span>dawahlibrary.org</span></div>
${P ? `<script>
window.setup=(hl)=>{const pg=document.getElementById("pg"),sh=document.getElementById("sh"),pen=document.getElementById("pen"),ms=1000;
 pg.animate([{transform:"rotateY(-95deg)"},{transform:"rotateY(0deg)"}],{duration:.7*ms,easing:"cubic-bezier(.2,.7,.3,1)",fill:"both"});
 sh.animate([{opacity:.9},{opacity:0}],{duration:.7*ms,fill:"both"});
 const els=[...document.querySelectorAll(".hl,.hlt")],per=hl/Math.max(1,els.length);
 els.forEach((e,k)=>e.animate([{backgroundSize:"0% 100%"},{backgroundSize:"100% 100%"}],{duration:per*ms,delay:(.7+k*per)*ms,easing:"ease-in-out",fill:"both"}));
 const desk=document.querySelector(".desk").getBoundingClientRect(),kf=[];els.forEach((e,k)=>{const r=e.getBoundingClientRect(),y=r.top-desk.top+r.height*.5;kf.push({left:(r.right-desk.left)+"px",top:y+"px",offset:(k*per)/hl},{left:(r.left-desk.left)+"px",top:y+"px",offset:Math.min(1,((k+1)*per)/hl)})});
 if(kf.length){kf[0].opacity=1;kf[kf.length-1].opacity=1;pen.animate([{opacity:0},{opacity:1}],{duration:150,delay:.6*ms,fill:"both"});pen.animate(kf,{duration:hl*ms,delay:.7*ms,fill:"both"});pen.animate([{opacity:1},{opacity:0}],{duration:250,delay:(.7+hl)*ms,fill:"forwards"})}
 document.getAnimations().forEach(a=>a.pause())};
window.at=t=>document.getAnimations().forEach(a=>{a.currentTime=t*1000});
</script>` : ""}</body></html>`;
  return { html, P, hl, dur: P ? 0.7 + hl + 0.6 : 0 };
}
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: W, height: H } });
  for (let i = 0; i < S.scenes.length; i++) {
    const g = page(S.scenes[i], i, S.scenes.length), still = path.join(S.out, "f" + String(i).padStart(2, "0") + ".png");
    await p.setContent(g.html, { waitUntil: "networkidle" }).catch(() => { }); await p.evaluate(() => document.fonts && document.fonts.ready); await p.waitForTimeout(300);
    if (!g.P) { await p.screenshot({ path: still, omitBackground: !!(S.bg || [])[i] });
      // ظهور النقاط تباعًا مع كلام الراوي (S.reveal): لقطة لكل عدد ظاهر من النقاط f<NN>_<k>.png (k=0..n)
      if (S.reveal) { const n = await p.evaluate(() => document.querySelectorAll("ul li").length);
        for (let k = 0; k < n; k++) { await p.evaluate(k => document.querySelectorAll("ul li").forEach((li, j) => { li.style.visibility = j < k ? "visible" : "hidden"; }), k);
          await p.screenshot({ path: path.join(S.out, "f" + String(i).padStart(2, "0") + "_" + k + ".png"), omitBackground: !!(S.bg || [])[i] }); } }
      continue; }
    const dir = path.join(S.out, "p" + String(i).padStart(2, "0")); fs.mkdirSync(dir, { recursive: true });
    await p.evaluate(hl => window.setup(hl), g.hl);
    const nf = Math.round(g.dur * FPS);
    for (let f = 0; f < nf; f++) { await p.evaluate(t => window.at(t), f / FPS); await p.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".png") }); }
    await p.evaluate(t => window.at(t), g.dur + 1); await p.screenshot({ path: still });  // الحالة الأخيرة: الصفحة ثابتة والتحديد ظاهر
  }
  await b.close();
})();
