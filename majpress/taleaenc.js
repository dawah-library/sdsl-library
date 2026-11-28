/* موسوعة الطلائع: واجهة الأبواب كأزرار برموز Lucide وألوان لكل مرحلة عمرية.
   البيانات: data/mawsua/talaea/_tree.json (يبنيها tools/talaea_enc.py). تُستدعى من MAWS.show عند k=talaea بلا id.
   الدرس نفسه يُعرض بعارض الموسوعات المعتاد. */
const TLE = (() => {
  const AGES = [["a1", "baby", 28, "من 6 إلى 9 سنوات", "رحلة المستكشف الصغير"], ["a2", "backpack", 165, "من 9 إلى 12 سنة", "رحلة الطالب المجتهد"], ["a3", "graduation-cap", 215, "من 12 إلى 15 سنة", "رحلة الفتى الواعي"], ["a4", "trophy", 265, "من 15 إلى 20 سنة", "رحلة الشاب الداعية"]];
  const FIC = { aqeeda: "shield-check", fiqh: "scale", sira: "footprints", hadith: "quote", akhlaq: "heart-handshake", tarbiya: "sprout", tarajim: "circle-user", qasas: "book-open", adab: "pen-line", dawa: "megaphone", manhaj: "compass", thaqafa: "lightbulb", tiqnia: "zap", ai: "bot" };
  const e = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = `.tle h2{margin:.2em 0}.tle .tleg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}
.tle .tlb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:14px 8px;border-radius:18px;text-decoration:none;color:#fff;background:linear-gradient(145deg,hsl(var(--h) 62% 38%),hsl(var(--h) 66% 28%));box-shadow:0 3px 10px hsl(var(--h) 50% 20% / .25);min-height:92px;border:0;font:inherit;cursor:pointer}
.tle .tlb:active{transform:scale(.97)}.tle .tlb svg{width:34px;height:34px}.tle .tlb b{font-size:1.02em}.tle .tlb small{opacity:.9;font-size:.82em}
.tle .tlb.f{background:hsl(var(--h) 70% 94%);color:hsl(var(--h) 60% 22%);box-shadow:none;border:2px solid hsl(var(--h) 55% 70%);min-height:80px}.tle .tlb.f.off{opacity:.55}
.tle .tlb.f svg{width:30px;height:30px;color:hsl(var(--h) 62% 36%)}
.tle .tlbar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;font-size:.9em}.tle .tlbar a{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:hsl(var(--h) 70% 92%);color:hsl(var(--h) 60% 22%);text-decoration:none;font-size:.9em}
.tle .tlbar a.on{background:hsl(var(--h) 62% 34%);color:#fff}.tle .tll{list-style:none;padding:0;margin:10px 0}.tle .tll li{margin:8px 0}
.tle .tll a{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:hsl(var(--h) 70% 96%);border:1px solid hsl(var(--h) 50% 80%);color:inherit;text-decoration:none}
.tle .tll a svg{color:hsl(var(--h) 62% 36%);flex:none}.tle .tlsoon{color:#777;padding:10px 14px;display:block;border:1px dashed #bbb;border-radius:14px}
@media(min-width:640px){.tle .tleg{grid-template-columns:repeat(4,1fr)}}`;
  async function show(q) {
    q = q || {}; if (!document.getElementById("tlecss")) { const s = document.createElement("style"); s.id = "tlecss"; s.textContent = css; document.head.appendChild(s); }
    let t = null; try { const r = await fetch("data/mawsua/talaea/_tree.json?t=" + Math.floor(Date.now() / 120e3)); t = r.ok ? await r.json() : null; } catch (x) { }
    const cr = `<p class="mwcr"><a href="#/mawsua">موسوعات الموقع</a> › ${q.a ? `<a href="#/mawsua/talaea">موسوعة الطلائع</a>` : "موسوعة الطلائع"}${q.f ? ` › <a href="#/mawsua/talaea?a=${e(q.a)}">${e((AGES.find(x => x[0] === q.a) || [])[3] || "")}</a>` : ""}</p>`;
    if (!t) return view(cr + '<div class="note">تعذر تحميل الموسوعة.</div>');
    const ai = AGES.findIndex(x => x[0] === q.a), cnt = b => b.f.reduce((a, f) => a + f.m.length, 0);
    if (ai < 0) return view(`<div class="tle">${cr}<h2>${ic("sprout", 26)} موسوعة الطلائع</h2><p class="mut">موسوعة تربوية للأعمار ٦–٢٠ سنة. اختر مرحلتك:</p><div class="tleg" style="grid-template-columns:repeat(2,1fr)">${t.b.map((b, i) => `<a class="tlb" style="--h:${AGES[i][2]}" href="#/mawsua/talaea?a=${AGES[i][0]}">${ic(AGES[i][1], 36)}<b>${AGES[i][3]}</b><small>${e(AGES[i][4])}</small><small>${toAr(cnt(b))} درسًا</small></a>`).join("")}</div></div>`);
    const [aid, aic, hue, an] = AGES[ai], b = t.b[ai], bar = `<div class="tlbar">${AGES.map(x => `<a class="${x[0] === aid ? "on" : ""}" style="--h:${x[2]}" href="#/mawsua/talaea?a=${x[0]}">${ic(x[1], 16)} ${x[3].replace("من ", "").replace(/ (سنوات|سنة)/, "")}</a>`).join("")}</div>`;
    const fi = b.f.findIndex(f => f.key === q.f), tp = (f, k) => FIC[f.key] || FIC[k] || "book-open";
    if (fi < 0) return view(`<div class="tle" style="--h:${hue}">${cr}<h2>${ic(aic, 26)} ${an}</h2>${bar}<p class="mut">اختر العلم الذي تريده:</p><div class="tleg">${b.f.map(f => `<a class="tlb f${f.m.length ? "" : " off"}" href="#/mawsua/talaea?a=${aid}&f=${f.key}">${ic(tp(f), 30)}<b>${e(f.t)}</b><small>${f.m.length ? toAr(f.m.length) + " درسًا" : "قريبًا"}</small></a>`).join("")}</div></div>`);
    const f = b.f[fi];
    view(`<div class="tle" style="--h:${hue}">${cr}<h2>${ic(tp(f), 26)} ${e(f.t)} <small class="mut">(${an})</small></h2>${bar}${f.m.length ? `<ul class="tll">${f.m.map(m => `<li><a href="#/mawsua/talaea/${encodeURIComponent(m.id)}">${ic(aic, 22)}<span>${e(m.t)}</span></a></li>`).join("")}</ul>` : '<span class="tlsoon">دروس هذا العلم لهذه المرحلة قيد الإعداد.</span>'}<p><a class="btn s" href="#/mawsua/talaea?a=${aid}">← أعلام المرحلة</a></p></div>`);
  }
  return { show };
})();
