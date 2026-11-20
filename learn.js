/* أدوات الدراسة: «اختبارات الكتب» (الباب ١٧ من الوثيقة) و«اختصار الكتب» (خدمة جديدة).
   - النصوص كلها من كتب المكتبة نفسها، ولا يُولَّد نص من خارجها: الاختصار استخلاصي بألفاظ المؤلف،
     ومسودات الأسئلة الآلية تُستخرج من جمل الكتاب ولا تُعرض للأعضاء قبل مراجعة الإدارة واعتمادها.
   - البيانات: data/quizzes/index.json وdata/quizzes/<الكتاب>.json. نتائج العضو تُحفظ على جهازه فقط (خصوصية). */
const LRN = (() => {
  const STOP = new Set("في من على إلى الى عن مع هذا هذه ذلك تلك الذي التي الذين اللذين ما ماذا لم لن لا إن ان أن كان كانت يكون قد قال قالوا ثم أو او بل كل بعض غير عند إذا اذا إذ حتى وهو وهي هو هي هم هن أنه انه أنها انها به بها له لها فيه فيها منه منها عليه عليها ولا وما ومن وفي وقد وأن وإن وكان والله الله تعالى رضي عنه عنهم صلى وسلم عليه السلام رحمه بن ابن أبو ابو أبي ابي أي اي ليس كما فإن فان لأن لان وهذا وذلك لكن ولكن إلا الا يا".split(" "));
  const words = s => norm(s).replace(/[^ء-ي\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const clean = t => String(t || "").split(/^\s*_{4,}\s*$/m)[0];            // بلا الحواشي
  // الكتاب إلى أقسام (بحسب العناوين) وجمل مع رقم الصفحة
  function sections(b) {
    const out = []; let cur = { h: "", p: 1, s: [] };
    (b.pages || []).forEach((pg, i) => {
      const body = typeof joinLines === "function" ? joinLines(clean(pg)) : clean(pg);
      body.split("\n").forEach(line => {
        const l = line.trim(); if (!l) return;
        if (/^#{1,3}\s/.test(l)) { if (cur.s.length || cur.h) out.push(cur); cur = { h: l.replace(/^#+\s*/, "").replace(/\*\*/g, ""), p: i + 1, s: [] }; return; }
        l.replace(/\*\*/g, "").split(/(?<=[.!؟?:؛])\s+/).forEach(t => { t = t.trim(); if (t.length >= 20) cur.s.push({ t, p: i + 1 }); });
      });
    });
    if (cur.s.length || cur.h) out.push(cur);
    return out;
  }
  // وزن الكلمات: تكرارها في الكتاب مقابل انتشارها في الأقسام (tf-idf مبسط)
  function weights(secs) {
    const tf = new Map(), df = new Map(), N = Math.max(1, secs.length);
    secs.forEach(sc => { const seen = new Set(); sc.s.forEach(x => words(x.t).forEach(w => { tf.set(w, (tf.get(w) || 0) + 1); seen.add(w); })); seen.forEach(w => df.set(w, (df.get(w) || 0) + 1)); });
    const W = new Map(); tf.forEach((n, w) => W.set(w, Math.log(1 + n) * Math.log(1 + N / (df.get(w) || 1))));
    return W;
  }
  // وزن الجملة: كلماتها المميزة، مع ترجيح الخلاصات والتعريفات والقواعد والأدلة، وتخفيف الجمل المعلّقة على ما قبلها وسلاسل الإسناد
  const CUE = /^(و?(الخلاصة|خلاصة|فالحاصل|والحاصل|المقصود|فالمقصود|المراد|فالمراد|الصحيح|والصحيح|الراجح|فالراجح|القاعدة|الضابط|اعلم|فاعلم|اعلموا|يجب|فيجب|الواجب|ينبغي|فينبغي|لا بد|ومن أهم|أهم|أول|الأول|الثاني|الثالث))/;
  const DEF = /(هو|هي|هما)\s*[:：]|يُعرَّف|تعريف|معناه|المقصود ب|حقيقة/, EVID = /قال رسول الله|قال النبي|ﷺ|صلى الله عليه وسلم|﴿|قال تعالى|قوله تعالى/;
  const DEP = /^(و?(هذا|هذه|ذلك|تلك|لهذا|ولهذا|فهذا|فلهذا|لذلك|ولذلك|وعليه|فعلى هذا|كما سبق|كما تقدم|وأيضًا|أيضًا|ثم|بل|لكن|ولكن)\b)/, ISNAD = /(حدثنا|أخبرنا|أنبأنا|ثنا|نا)\s/g;
  const scoreOf = (t, W) => { const ws = words(t); if (!ws.length) return 0; let s = 0; new Set(ws).forEach(w => s += W.get(w) || 0); s /= Math.sqrt(ws.length + 4);
    if (CUE.test(t)) s *= 1.35; if (DEF.test(t)) s *= 1.25; if (EVID.test(t)) s *= 1.15; if (DEP.test(t)) s *= 0.7;
    const isn = (t.match(ISNAD) || []).length; if (isn >= 2) s *= 0.25; if (t.length > 600) s *= 0.8; return s; };
  const jac = (a, b) => { let c = 0; a.forEach(x => b.has(x) && c++); return c / Math.max(1, a.size + b.size - c); };

  /* ================= اختصار الكتب ================= */
  const RATIOS = [[50, "نصف الكتاب"], [30, "ثلث تقريبًا"], [20, "الخُمس"], [10, "العُشر"], [5, "خلاصة مركزة"], [0, "موجز دقيق (أهم جملة في كل باب)"]];
  function abridge(b, r, only) {
    const S0 = sections(b), W = weights(S0), nw = t => t.split(/\s+/).length, secs = only >= 0 && S0[only] ? S0.map((x, i) => i === only ? x : { h: x.h, p: x.p, s: [] }) : S0;
    const ow = secs.reduce((n, sc) => n + sc.s.reduce((m, x) => m + nw(x.t), 0), 0), budget = Math.max(40, Math.round(ow * (r || 3) / 100));
    // ترتيب عام للجمل بوزنها، مع تقديم أول جملة في كل باب، ثم الانتقاء حتى تبلغ نسبة الاختصار المطلوبة من عدد الكلمات
    const all = []; secs.forEach((sc, si) => sc.s.forEach((x, i) => all.push({ ...x, si, i, v: scoreOf(x.t, W) * (i === 0 ? 1.3 : 1), w: nw(x.t) })));
    let used = 0; const pick = new Set();
    // أولًا: أهم جملة من كل باب (ليشمل المختصر أبواب الكتاب)، حتى نصف المقدار؛ ثم الأعلى وزنًا من الكتاب كله
    const best = secs.map((_, si) => all.filter(x => x.si === si).sort((a, c) => c.v - a.v)[0]).filter(Boolean).sort((a, c) => c.v - a.v);
    // منع التكرار: لا تُنتقى جملة تتقارب ألفاظها مع جملة منتقاة (تشابه > ٥٥٪)
    const sets = new Map(all.map(x => [x, new Set(words(x.t))])), dup = x => { for (const y of pick) if (jac(sets.get(x), sets.get(y)) > .55) return true; return false; };
    const add = x => { pick.add(x); used += x.w; x.key = x.key || false; // الجملة المعلّقة على ما قبلها: تُدخل سابقتها إن اتسع المقدار
      if (DEP.test(x.t) && x.i > 0) { const prev = all.find(y => y.si === x.si && y.i === x.i - 1); if (prev && !pick.has(prev) && used + prev.w <= budget * 1.1) { pick.add(prev); used += prev.w; } } };
    for (const x of best) { if (used + x.w > budget * .55) continue; x.key = true; add(x); }
    for (const x of all.slice().sort((a, c) => c.v - a.v)) { if (used >= budget) break; if (pick.has(x) || dup(x)) continue; if (used + x.w > budget * 1.08 && used > budget * .6) continue; add(x); }
    const res = secs.map((sc, si) => ({ h: sc.h, p: sc.p, si, s: all.filter(x => x.si === si && pick.has(x)) })).filter(x => x.s.length || (r === 0 && x.h));
    return { res, all: all.length, total: pick.size, ow, sw: used, secs: S0 };
  }
  // عناصر المختصر: فقرة، أو عنوان فرعي (k=h من «## »)، أو بند تعداد (k=li من «- »)؛ وكل فصل في قسم يحمل نطاق صفحاته لربط تشجيره
  const itemHtml = (x, pg) => x.k === "h" ? `<h4 class="sumh">${esc(x.t)}</h4>` : `<${x.k === "li" ? "li" : "p"}${x.key ? ' class="sumkey"' : ""}>${esc(x.t)}${pg && x.k !== "li" ? ` <small class="pref">(ص ${toAr(x.p)})</small>` : ""}</${x.k === "li" ? "li" : "p"}>`;
  const itemsHtml = (s, pg) => s.map((x, i) => (x.k === "li" && (i === 0 || s[i - 1].k !== "li") ? "<ul class=\"suml\">" : "") + itemHtml(x, pg) + (x.k === "li" && (i === s.length - 1 || s[i + 1].k !== "li") ? "</ul>" : "")).join("");
  const absHtml = (A, pg) => A.res.map((sc, i) => `<section class="sumch"${sc.pr ? ` data-i="${i}" data-a="${sc.pr[0]}" data-z="${sc.pr[1]}"` : ""}>${sc.h ? `<h3>${esc(sc.h)}${pg ? ` <small>(ص ${toAr(sc.p)})</small>` : ""}</h3>` : ""}${itemsHtml(sc.s, pg)}</section>`).join("");
  const sumLines = (txt, p0) => String(txt || "").split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/\[ص\s*(\d+)\]\s*$/), k = /^#{2,4}\s/.test(x) ? "h" : /^[-•]\s/.test(x) ? "li" : ""; return { t: x.replace(/^#{2,4}\s*|^[-•]\s*/, "").replace(/\s*\[ص\s*\d+\]\s*/g, " ").trim(), p: m ? +m[1] : p0, k }; });
  const absText = A => A.res.map(sc => (sc.h ? "■ " + sc.h + "\n" : "") + sc.s.map(x => x.t + " (ص " + x.p + ")").join("\n")).join("\n\n");
  async function vSummary(q) {
    const b = q.b && B(q.b), r = RATIOS.some(x => String(x[0]) === q.r) ? +q.r : 20;
    const pick = `<form class="sbox" data-form="sumpick" style="max-width:none"><input name="t" list="sumbooks" placeholder="اكتب اسم الكتاب ثم اختره" aria-label="اختر الكتاب" value="${b ? esc(b.setTitle && b.vol ? b.title : b.title) : ""}"><datalist id="sumbooks">${BOOKS().filter(x => !x.hidden && !isArt(x)).slice(0, 4000).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist><button class="btn p">اختيار</button></form>`;
    const intro = `<h2>اختصار الكتب</h2><p class="mut">اختر كتابًا ونسبة الاختصار، فتحصل على مختصر بأحد طريقين: <b>مختصر محرَّر</b> بسياقة متصلة وعبارات قريبة جدًا من ألفاظ المؤلف (بتصرف يسير يُنبَّه عليه، ومتاح للكتب التي أُعدّ لها)، أو <b>مختصر بنص المؤلف</b> تُنتقى فيه أهم جمل كل باب بلفظها. وفي الطريقين عناوين الأبواب بترتيبها ورقم صفحة الأصل، ولا يُضاف إلى الكتاب كلام أو رأي من خارجه.</p>${pick}`;
    if (!b) { const sug = BOOKS().filter(x => !x.hidden && !isArt(x) && !x.vol && (x.n || 0) >= 20).sort((a, c) => (bc(a) === "dawah" ? 0 : 1) - (bc(c) === "dawah" ? 0 : 1) || (c.added || "").localeCompare(a.added || "")).slice(0, 12);
      return view(intro + `<div class="lvls"><div class="lvl"><b>١. اختر الكتاب</b><span>من القائمة أو من «أدوات القراءة» داخل أي كتاب</span></div><div class="lvl"><b>٢. اختر النسبة</b><span>من النصف إلى موجز دقيق بأهم جملة في كل باب</span></div><div class="lvl"><b>٣. اقرأ أو حمّل PDF</b><span>بهوية المكتبة ورقم صفحة كل جملة في الأصل</span></div></div>
       <h3>كتب مقترحة للاختصار</h3><div class="newg">${sug.map(x => `<a class="newc" style="text-decoration:none;color:inherit" href="#/summary?b=${encodeURIComponent(x.id)}&r=20"><b>${esc(x.title)}</b><br><span class="mut">${esc(A_(x))}</span></a>`).join("")}</div>`); }
    view(intro + `<p class="mut">جارٍ تحميل الكتاب…</p>`);
    try { await loadBook(b.id); } catch (e) { return view(intro + `<div class="note">تعذر تحميل نص الكتاب: ${esc(e.message)}</div>`); }
    const SL = (await getJ("data/summ/_list.json")) || {}, AI = SL[b.id] ? await getJ("data/summ/" + b.id + ".json") : null, mode = AI && AI.chs && AI.chs.length && q.m !== "x" ? "ai" : "x";
    const tabs = AI && AI.chs && AI.chs.length ? `<div class="tabs" role="tablist" style="margin-top:10px"><a role="tab" aria-selected="${mode === "ai"}" href="#/summary?b=${encodeURIComponent(b.id)}&r=25">مختصر محرَّر (بتصرف يسير)</a><a role="tab" aria-selected="${mode === "x"}" href="#/summary?b=${encodeURIComponent(b.id)}&r=20&m=x">مختصر بنص المؤلف (جمل منتقاة)</a></div>` : "";
    if (mode === "ai") return aiSummary(b, AI, q, intro, tabs);
    const sec = q.s != null && q.s !== "" ? +q.s : -1, full = sec >= 0 ? abridge(b, r, -1) : null, A = abridge(b, r, sec), _f = full || A;
    const u = v => `#/summary?b=${encodeURIComponent(b.id)}&r=${v}${sec >= 0 ? "&s=" + sec : ""}`, heads = (_f.secs || []).map((x, i) => [i, x.h]).filter(x => x[1]);
    window.__sum = { b, A };
    window.__sum.ai = false;
    view(intro + `<h3 style="margin-top:14px">${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title)} <span class="mut">— ${esc(A_(b))}</span></h3>${tabs}
     <div class="chips" role="radiogroup" aria-label="نسبة الاختصار">${RATIOS.map(([v, l]) => `<a class="chip${v === r ? " x" : ""}" role="radio" aria-checked="${v === r}" href="${u(v)}${AI ? "&m=x" : ""}">${v ? toAr(v) + "٪ — " : ""}${l}</a>`).join("")}</div>
     ${heads.length > 1 ? `<form class="row" style="gap:6px;margin:6px 0" onsubmit="return false"><label for="sumsec">النطاق</label><select id="sumsec" onchange="location.hash='#/summary?b=${encodeURIComponent(b.id)}&r=${r}'+(this.value?'&s='+this.value:'')"><option value="">الكتاب كاملًا</option>${heads.map(([i, h]) => `<option value="${i}"${i === sec ? " selected" : ""}>${esc(h.slice(0, 80))}</option>`).join("")}</select></form>` : ""}
     <p class="mut">المختصر: ${toAr(A.sw)} كلمة من ${toAr(A.ow)} (${toAr(Math.round(A.sw * 100 / Math.max(1, A.ow)))}٪)، في ${toAr(A.res.length)} بابًا • مدة القراءة نحو ${toAr(Math.max(1, Math.round(A.sw / 180)))} دقيقة. <span class="sumkey" style="padding:0 6px">المظلَّل</span> أهم جملة في الباب.</p>
     <div class="row" style="margin:6px 0 12px;gap:6px;flex-wrap:wrap"><button class="btn p" data-act="sumpdf" data-b="${esc(b.id)}" data-r="${r}">تحميل المختصر PDF</button><button class="btn" data-act="sumword">Word</button><button class="btn" data-act="sumcopy">نسخ المختصر</button> <a class="btn" href="#/book/${esc(b.id)}/1">قراءة الأصل</a></div>
     <div id="sumorg"></div>
     <article class="sumtx">${absHtml(A, true) || '<div class="note">لا يتسع نص هذا الكتاب للاختصار.</div>'}</article>`);
    sumOrg(b);
  }
  // المختصر المحرَّر (tools/study-ai.py): لكل مقطع ثلاث درجات بعبارات قريبة جدًا من ألفاظ المؤلف، مع التنبيه على التصرف
  const AIR = [[50, "نحو النصف"], [25, "نحو الربع"], [10, "نحو العُشر"], [1, "الأفكار المحورية"]];
  function aiSummary(b, AI, q, intro, tabs) {
    const r = AIR.some(x => String(x[0]) === q.r) ? +q.r : (+q.r >= 40 ? 50 : +q.r >= 15 ? 25 : +q.r > 1 ? 10 : +q.r === 1 ? 1 : 25);
    const res = AI.chs.map(c => ({ h: c.t, p: c.p[0], pr: c.p, s: r === 1 ? (c.k ? [{ t: c.k, p: c.p[0], key: true }] : []) : sumLines(c["r" + r], c.p[0]) })).filter(x => x.s.length);
    const nw = t => t.split(/\s+/).length, sw = res.reduce((n, sc) => n + sc.s.reduce((m, x) => m + nw(x.t), 0), 0), ow = AI.chs.reduce((n, c) => n + (c.ow || 0), 0);
    const lits = AI.chs.map(c => [(c.lit || {})[String(r)], nw(String(c["r" + r] || ""))]).filter(x => x[0] != null), lit = lits.length ? lits.reduce((s, x) => s + x[0] * x[1], 0) / Math.max(1, lits.reduce((s, x) => s + x[1], 0)) : null;
    const A = { res, sw, ow, all: 0, total: 0, secs: [] }; window.__sum = { b, A, ai: true, r, lit };
    const deg = lit == null ? "" : lit >= .8 ? "وأغلب عباراته بألفاظ المؤلف نفسها" : lit >= .55 ? "وكثير من عباراته بألفاظ المؤلف، وبعضها بتصرف" : "وعباراته بتصرف من المكتبة في أكثرها مع المحافظة على المضمون";
    view(intro + `<h3 style="margin-top:14px">${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title)} <span class="mut">— ${esc(A_(b))}</span></h3>${tabs}
     <div class="chips" role="radiogroup" aria-label="درجة الاختصار">${AIR.map(([v, l]) => `<a class="chip${v === r ? " x" : ""}" role="radio" aria-checked="${v === r}" href="#/summary?b=${encodeURIComponent(b.id)}&r=${v}">${v > 1 ? toAr(v) + "٪ — " : ""}${l}</a>`).join("")}</div>
     <div class="note sumwarn">⚠️ <b>تنبيه:</b> هذا مختصر أعدّته المكتبة بتصرف يسير، قريب جدًا من ألفاظ المؤلف وليس بنصها كاملًا${deg ? "، " + deg : ""}${lit != null ? ` (نحو ${toAr(Math.round(lit * 100))}٪ من ألفاظه منقولة من الأصل بترتيبها)` : ""}. فارجع إلى الأصل عند النقل والاستشهاد، ولكل فقرة رقم صفحتها.</div>
     <p class="mut">المختصر: ${toAr(sw)} كلمة من ${toAr(ow)} (${toAr(Math.round(sw * 100 / Math.max(1, ow)))}٪)، في ${toAr(res.length)} مقطعًا • مدة القراءة نحو ${toAr(Math.max(1, Math.round(sw / 180)))} دقيقة.</p>
     <div class="row" style="margin:6px 0 12px;gap:6px;flex-wrap:wrap"><button class="btn p" data-act="sumpdf" data-b="${esc(b.id)}" data-r="${r}">تحميل المختصر PDF</button><button class="btn" data-act="sumword">Word</button><button class="btn" data-act="sumcopy">نسخ المختصر</button> <a class="btn" href="#/book/${esc(b.id)}/1">قراءة الأصل</a></div>
     <div class="row sumtjbar" style="margin:-4px 0 12px;gap:6px;flex-wrap:wrap"><a class="btn${q.tj ? " p" : ""}" href="#/summary?b=${encodeURIComponent(b.id)}&r=${r}${q.tj ? "" : "&tj=1"}">🌳 ${q.tj ? "إخفاء" : "مع"} تشجير كل فصل</a><button class="btn" data-act="sumfull" data-k="docx">📦 الكتاب كاملًا (مختصر + تشجير + خريطة) Word</button><button class="btn" data-act="sumfull" data-k="pdf">PDF</button> <span id="sumfst" class="mut"></span></div>
     <article class="sumtx">${absHtml(A, true)}</article><p class="mut">أُعدّ في ${esc(AI.built || "")}. والمختصر بنص المؤلف (جمل منتقاة بلا تصرف) متاح من التبويب الثاني أعلاه.</p>`);
    if (q.tj) sumTj(b);
  }
  /* المختصر مع التشجير (المرحلة ٣-أ): لكل فصل من المختصر تشجيره المستقل من تشجير الكتاب (data/tashjir) بحسب نطاق صفحاته
     (tjFilter)، مخططًا متدرجًا وخريطة ذهنية (tjRadial)؛ والتصدير يجمعها كلها في ملف واحد Word أو PDF بتنسيق موحد. */
  const tjSub = (m, pr) => { if (!m || !m.c || typeof tjFilter !== "function") return null; const t = tjFilter(m, 3, pr[0], pr[1]); return t && t.c && t.c.length ? t : null; };
  const tjOutline = (n, d = 0) => (n.c || []).map(c => "  ".repeat(d) + "- " + (c.t || "") + (c.s ? ": " + c.s : "") + "\n" + tjOutline(c, d + 1)).join("");
  const tjOutHtml = n => (n.c || []).length ? `<ul>${n.c.map(c => `<li><b>${esc(c.t || "")}</b>${c.s ? ` — ${esc(c.s)}` : ""}${tjOutHtml(c)}</li>`).join("")}</ul>` : "";
  const tjSvgOf = (t, title) => { try { TJS.q = ""; TJS.k = ""; return tjRadial(Object.assign({}, t, { t: title })); } catch (e) { return ""; } };
  async function sumTj(b) {
    const m = await TSJ.map(b.id), secs = document.querySelectorAll(".sumtx .sumch[data-a]");
    if (!m) { const st = $("#sumfst"); if (st) st.textContent = "لا تشجير لهذا الكتاب بعد."; return; }
    secs.forEach(sc => { const t = tjSub(m, [+sc.dataset.a, +sc.dataset.z]); if (!t) return; const h = (sc.querySelector("h3") || {}).textContent || "";
      sc.insertAdjacentHTML("beforeend", `<details class="sumtj" open><summary>🌳 تشجير الفصل</summary><div class="tjout">${tjOutHtml(t)}</div><div class="tjmini">${tjSvgOf(t, h.replace(/\(ص.*$/, "").trim())}</div><p><a href="#/tashjir/${esc(b.id)}?from=${sc.dataset.a}&to=${sc.dataset.z}">فتح التشجير التفاعلي لهذا الفصل</a></p></details>`); });
  }
  async function svgPng(svg) {  // الخريطة الذهنية صورةً (للـWord): {data, w, h}
    const tmp = document.createElement("div"); tmp.innerHTML = svg; const el = tmp.querySelector("svg"); if (!el) return null;
    const w0 = +el.getAttribute("width") || 800, h0 = +el.getAttribute("height") || 600, sc = Math.min(2, 3000 / Math.max(w0, h0));
    const x = new XMLSerializer().serializeToString(el).replace(/var\(--sf,#fff\)/g, "#ffffff").replace(/var\(--ink,#14231f\)/g, "#14231f"), img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(x); });
    const cv = document.createElement("canvas"); cv.width = Math.round(w0 * sc); cv.height = Math.round(h0 * sc); const g = cv.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, cv.width, cv.height); g.scale(sc, sc); g.drawImage(img, 0, 0);
    const bl = await new Promise(r => cv.toBlob(r, "image/png")); return { data: new Uint8Array(await bl.arrayBuffer()), w: Math.min(640, w0), h: Math.min(640, w0) * h0 / w0 };
  }
  async function sumFull(kind) {
    const S0 = window.__sum; if (!S0 || !S0.ai) return; const { b, A } = S0, st = $("#sumfst"), title = "مختصر " + (b.setTitle || b.title) + " مع التشجير";
    st.textContent = "جارٍ إعداد الملف…"; const m = await TSJ.map(b.id), chs = A.res.map(sc => ({ sc, t: sc.pr ? tjSub(m, sc.pr) : null }));
    if (kind === "pdf") {
      const body = chs.map(({ sc, t }) => `<section class="ch"><h2>${esc(sc.h || "")}</h2>${itemsHtml(sc.s, true)}${t ? `<h3>تشجير الفصل</h3><div class="out">${tjOutHtml(t)}</div><h3>الخريطة الذهنية</h3><div class="map">${tjSvgOf(t, sc.h || "")}</div>` : ""}</section>`).join("");
      const w = window.open("", "_blank"); if (!w) { st.textContent = ""; return toast("اسمح بالنوافذ المنبثقة"); }
      w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap"><style>@page{size:A4;margin:16mm}body{font-family:Amiri,serif;font-size:13pt;line-height:1.9;color:#14231f}h1{text-align:center;color:#0f5c4d}h2{color:#0f5c4d;border-bottom:1px solid #b88a2e;padding-bottom:2mm}h3{color:#b88a2e;font-size:12pt}.ch{page-break-before:always}.ch:first-of-type{page-break-before:auto}.pref{color:#998;font-size:8pt}.out ul{margin:0 1.2em 0 0;padding:0}.out li{font-size:11pt}.map svg{max-width:100%;height:auto}.map{page-break-inside:avoid;text-align:center}.note{font-size:10pt;color:#555;border:1px solid #ddd;padding:3mm}</style></head><body><h1>${esc(title)}</h1><p style="text-align:center">${esc(A_(b))}</p><p class="note">مختصر أعدّته ${esc(SITENAME)} بتصرف يسير قريب من ألفاظ المؤلف، وتشجير آلي مدقق بنص الصفحات؛ فارجع إلى الأصل عند الاستشهاد.</p>${body}<script>onload=()=>setTimeout(()=>print(),900)<\/script></body></html>`); w.document.close(); st.textContent = ""; return;
    }
    if (typeof DOCX === "undefined") return st.textContent = "أداة Word غير محمّلة"; const images = [], pages = [];
    for (const { sc, t } of chs) {
      let txt = "# " + (sc.h || "") + "\n" + sc.s.map(x => x.k === "h" ? "## " + x.t : x.k === "li" ? "- " + x.t : x.t + " (ص " + toAr(x.p) + ")").join("\n");
      if (t) { txt += "\n## تشجير الفصل\n" + tjOutline(t); const im = await svgPng(tjSvgOf(t, sc.h || "")).catch(() => null); if (im) { images.push(im); txt += "\n## الخريطة الذهنية\n![img:" + (images.length - 1) + "]"; } }
      pages.push({ i: pages.length + 1, t: txt, l: "" });
    }
    const blob = await DOCX.build({ fmt: { cover: 1 }, title, author: A_(b), pages, images, toc: chs.map((c, i) => ({ t: c.sc.h || "", p: i + 1, l: 1, pl: "" })), opt: { fn: false, toc: true, pl: false }, url: siteLink("#/summary?b=" + b.id), src: "مختصر بتصرف يسير وتشجير آلي مدقق — يُرجع إلى الأصل عند الاستشهاد", who: "", site: SITENAME, siteUrl: (CFG.siteUrl || "https://dawahlibrary.org").replace(/^https?:\/\//, "").replace(/\/+$/, "") });
    dl(title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) + ".docx", blob, blob.type); st.textContent = "";
  }
  document.addEventListener("click", e => { const el = e.target.closest('[data-act="sumfull"]'); if (!el) return; e.preventDefault(); sumFull(el.dataset.k).catch(x => { const st = $("#sumfst"); if (st) st.textContent = "تعذّر: " + x.message; }); });
  // «الخلاصة المنظمة»: خلاصة الكتاب وأقسامه وأبوابه من تشجيره (data/tashjir) — صياغة آلية دققت كل نقطة بنص صفحتها،
  // مع رابط كل باب إلى موضعه؛ وإن لم يُشجَّر الكتاب بعد يطلبه المشرف بضغطة فيُعدّ آليًا.
  async function sumOrg(b) {
    const box = $("#sumorg"); if (!box || typeof TSJ === "undefined") return;
    const L = await TSJ.index(), inf = L[b.id];
    if (!inf || !(inf.ok || isAdmin())) {
      box.innerHTML = isAdmin() && typeof GH !== "undefined" && GH.on ? `<div class="note">لا توجد خلاصة منظمة لهذا الكتاب بعد. <button class="btn s" data-act="sumreq" data-b="${esc(b.id)}">اطلب إعداد الخلاصة والتشجير</button> <span id="sumreqs" class="mut"></span></div>` : ""; return; }
    const m = await TSJ.map(b.id); if (!m || !m.c) return;
    const pg = p => `<a href="#/book/${esc(b.id)}/${(p && p[0]) || 1}">${p && p[0] ? "ص " + toAr(p[0]) + (p[1] && p[1] !== p[0] ? "–" + toAr(p[1]) : "") : ""}</a>`;
    box.innerHTML = `<details class="sumorg" open><summary><b>الخلاصة المنظمة للكتاب</b> <span class="mut">— صياغة آلية مدققة بنص الصفحات، فراجع الأصل عند الاستشهاد</span></summary>
      ${m.s ? `<p class="brief">${esc(m.s)}</p>` : ""}
      ${m.c.map(g => `<section><h4>${esc(g.t)} <small class="mut">${pg(g.p)}</small></h4>${g.s ? `<p>${esc(g.s)}</p>` : ""}<ul>${(g.c || []).map(ch => `<li><b>${esc(ch.t)}</b> <small class="mut">${pg(ch.p)}</small>${ch.s ? `<br>${esc(ch.s)}` : ""}</li>`).join("")}</ul></section>`).join("")}
      <p><a class="btn s" href="#/tashjir/${esc(b.id)}">عرض التشجير التفصيلي</a></p></details>`;
  }
  document.addEventListener("click", async e => {
    const el = e.target.closest('[data-act="sumword"],[data-act="sumcopy"]'); if (!el || !window.__sum) return; e.preventDefault();
    const { b, A } = window.__sum, title = "مختصر " + (b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title), src = (window.__sum.ai ? "\n\n(تنبيه: مختصر أعدّته المكتبة بتصرف يسير، قريب من ألفاظ المؤلف وليس بنصها كاملًا)" : "") + "\n\n— " + SITENAME + "، " + siteLink("#/book/" + b.id + "/1");
    if (el.dataset.act === "sumcopy") { try { await navigator.clipboard.writeText(title + " — " + A_(b) + "\n\n" + absText(A) + src); toast("نُسخ المختصر"); } catch (x) { toast("تعذر النسخ"); } return; }
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{direction:rtl;font-family:'Traditional Arabic',Amiri,serif;font-size:15pt}h1,h3{color:#0f5c4d}.sumkey{background:#fff3cd}small{color:#7a6a4a}</style></head><body dir="rtl"><h1>${esc(title)}</h1><p>${esc(A_(b))}</p>${absHtml(A, true)}<p><small>${esc(src.trim())}</small></p></body></html>`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff", doc], { type: "application/msword" })); a.download = "summary-" + b.id + ".doc"; document.body.appendChild(a); a.click(); a.remove();
  }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest('[data-act="sumreq"]'); if (!el) return; e.preventDefault(); el.disabled = true;
    try { await GH.editJSON("data/tashjir/_queue.json", o => { o = o || { items: [] }; o.items = (o.items || []).filter(x => (x.id || x) !== el.dataset.b); o.items.unshift({ id: el.dataset.b }); return o; }, "طلب خلاصة وتشجير: " + el.dataset.b); const s = $("#sumreqs"); if (s) s.textContent = "أُضيف في أول الطابور؛ يُعدّ خلال ساعات."; }
    catch (x) { toast(x.message); el.disabled = false; }
  });
  const A_ = b => (typeof A === "function" ? A(b.authorId).name : "") || "";
  function pdf(id, r) {
    const b = B(id); if (!b || !b.pages) return;
    const AIs = window.__sum && window.__sum.ai && window.__sum.b.id === id ? window.__sum : null;
    const A2 = AIs ? AIs.A : abridge(b, r), o = location.origin, lbl = ((AIs ? AIR : RATIOS).find(x => x[0] === r) || [r, ""])[1], day = today(), title = b.setTitle && b.vol ? b.setTitle + " — " + b.title : b.title;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مختصر ${esc(title)} — مكتبة الدعوة السلفية الرقمية</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap">
<style>@page{size:A4;margin:22mm 16mm 20mm}body{font-family:Amiri,'Traditional Arabic',serif;font-size:14pt;line-height:1.95;color:#14231f}
.cover{text-align:center;border:3px double #0f5c4d;border-radius:14px;padding:26px 18px;margin-bottom:18px;page-break-after:always;min-height:230mm;display:flex;flex-direction:column;justify-content:center;gap:10px}
.cover img{width:120px;margin:0 auto}.cover h1{color:#0f5c4d;font-size:26pt;margin:6px 0}.cover .au{font-size:16pt}.cover .m{color:#5b6b66;font-size:12pt}
h3{color:#0f5c4d;border-bottom:2px solid #b88a2e;padding-bottom:3px;margin:18px 0 6px;page-break-after:avoid}p{margin:6px 0;text-align:justify}small{color:#7a6a4a;font-size:9pt}
.hd{position:fixed;top:-14mm;left:0;right:0;display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:#0f5c4d;border-bottom:1px solid #b88a2e;padding-bottom:2mm}.hd img{height:9mm}
.ft{position:fixed;bottom:-13mm;left:0;right:0;text-align:center;font-size:8.5pt;color:#5b6b66;border-top:1px solid #d6dfda;padding-top:2mm}
.wm{position:fixed;top:45%;left:0;right:0;text-align:center;font-size:54pt;color:rgba(15,92,77,.05);transform:rotate(-25deg);z-index:-1}</style></head><body>
<div class="hd"><span>مكتبة الدعوة السلفية الرقمية</span><img src="${o}/assets/logo-sdsl-128.png" alt=""><span>dawahlibrary.org</span></div>
<div class="ft">${AIs ? "مختصر بتصرف يسير قريب من ألفاظ المؤلف" : "مختصر استخلاصي بألفاظ المؤلف"} من «${esc(title)}» — أُعدّ آليًا في مكتبة الدعوة السلفية الرقمية (dawahlibrary.org) بتاريخ ${day}. يُنشر للانتفاع العلمي مع العزو، ولا يُغني عن الأصل.</div>
<div class="wm">مكتبة الدعوة السلفية الرقمية</div>
<section class="cover"><img src="${o}/assets/logo-sdsl-128.png" alt="شعار المكتبة"><div class="m">مكتبة الدعوة السلفية الرقمية</div><h1>مختصر ${esc(title)}</h1><div class="au">${esc(A_(b))}</div>
<div class="m">نسبة الاختصار: ${r ? toAr(r) + "٪ — " : ""}${esc(lbl)} • ${toAr(A2.sw)} كلمة من ${toAr(A2.ow)}</div><div class="m">${AIs ? "اختصار أعدّته المكتبة بتصرف يسير قريب من ألفاظ المؤلف، وليس بنصها كاملًا؛ ولكل فقرة رقم صفحتها في الأصل." : "الجمل منقولة بنصها من الكتاب، مع رقم صفحتها في الأصل."}<br>رابط الأصل: ${o}/book/${esc(b.id)}/1</div></section>
${absHtml(A2, true)}<script>onload=()=>setTimeout(()=>print(),600)<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html); w.document.close();
  }

  /* ================= اختبارات الكتب ================= */
  const LV = { easy: "سهل", mid: "متوسط", hard: "متقدم" }, QN = { easy: 15, mid: 30, hard: 50 }, TY = { mcq: "اختيار من متعدد", tf: "صح أم خطأ", cloze: "أكمل النص" };
  const IDX = "data/quizzes/index.json", QF = id => "data/quizzes/" + id + ".json";
  const getJ = async (p, fresh) => { try { const r = await fetch(p + (fresh ? "?fresh=1" : "")); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // مسودة آلية: جمل من الكتاب، والكلمة المحذوفة من أعلى كلماته وزنًا؛ والبدائل من كلمات الكتاب نفسه
  function draft(b, n = 30) {
    const secs = sections(b), W = weights(secs), pool = [];
    secs.forEach(sc => sc.s.forEach(x => { if (x.t.length >= 40 && x.t.length <= 200 && !/[«»"]/.test(x.t.slice(0, 2))) pool.push({ ...x, v: scoreOf(x.t, W) }); }));
    pool.sort((a, c) => c.v - a.v);
    // الصيغة الأصلية للكلمة (بهمزاتها) لتظهر البدائل بإملاء الكتاب نفسه فلا تدل على الجواب
    const surf = new Map(); secs.forEach(sc => sc.s.forEach(x => x.t.split(/\s+/).forEach(w => { const o = w.replace(/[^\u0621-\u064A]/g, ""), k = norm(o).replace(/[^\u0621-\u064A]/g, ""); if (o && !surf.has(k)) surf.set(k, o); })));
    const top = [...W.entries()].sort((a, c) => c[1] - a[1]).slice(0, 300).map(e => surf.get(e[0]) || e[0]);
    const out = [], used = new Set();
    for (const x of pool) {
      if (out.length >= n) break;
      const toks = x.t.split(/\s+/), cand = toks.map((w, i) => [i, w, W.get(norm(w).replace(/[^ء-ي]/g, "")) || 0]).filter(c => c[1].replace(/[^ء-ي]/g, "").length > 3 && c[2] > 0).sort((a, c) => c[2] - a[2])[0];
      if (!cand) continue; const key = cand[1].replace(/[^ء-يً-ْ]/g, ""), nk = norm(key); if (used.has(nk)) continue; used.add(nk);
      const dis = shuffle(top.filter(w => norm(w) !== nk && Math.abs(w.length - key.length) <= 2)).slice(0, 3);
      if (dis.length < 3) continue;
      const blank = toks.map((w, i) => i === cand[0] ? w.replace(key, "……") : w).join(" "), k = out.length % 3;
      if (k === 0) out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "mcq", lvl: "easy", q: blank, opts: shuffle([key, ...dis]), a: key, p: x.p, ctx: x.t });
      else if (k === 1) { const tr = Math.random() < .5; out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "tf", lvl: "mid", q: tr ? x.t : toks.map((w, i) => i === cand[0] ? w.replace(key, dis[0]) : w).join(" "), a: tr ? "صح" : "خطأ", p: x.p, ctx: x.t }); }
      else out.push({ id: "q" + (Date.now() % 1e7).toString(36) + out.length, type: "cloze", lvl: "hard", q: blank, a: key, p: x.p, ctx: x.t });
    }
    return out.map(q => Object.assign(q, { ok: false, auto: true }));
  }
  const R = () => (S.qres = S.qres || []);
  async function vQuizzes(q, id) {
    const ix = (await getJ(IDX)) || { items: [] }, items = (ix.items || []).filter(x => x.n > 0 && B(x.b));
    if (!id) {
      const mine = R().slice(-12).reverse();
      return view(`<h2>اختبارات الكتب</h2><p class="mut">اختبر فهمك لكتب المكتبة بثلاثة مستويات: سهل ومتوسط ومتقدم. الأسئلة مأخوذة من نص الكتاب ومراجَعة من إدارة المكتبة، ولكل سؤال رقم صفحته للرجوع إليه. نتائجك تُحفظ على جهازك فقط.</p>
       <div class="lvls">${[["easy","سهل","١٥ سؤالًا: معلومات صريحة واضحة، مع تلميح يعين على الجواب"],["mid","متوسط","٣٠ سؤالًا: فهم وربط وتعليل وتطبيق، مع تلميح عند الحاجة"],["hard","متقدم","٥٠ سؤالًا: مسائل دقيقة وترجيحات وأوجه استدلال، بلا مساعدة"]].map(([k,n,d])=>`<div class="lvl lv-${k}"><b>${n}</b><span>${d}</span></div>`).join("")}</div>
       <p class="mut">الأسئلة متنوعة: اختيار من متعدد، وصح أم خطأ، و«أكمل» للأحاديث والقواعد والتعريفات التي يحسن حفظها. كل سؤال تام السياق، ومعه بعد الإجابة تعليله وعبارة الكتاب ورقم صفحتها، ويتجدد الاختبار عند إعادته.</p>
       ${items.length ? [["dawah","كتب مشايخ الدعوة السلفية"],["turath","المكتبة العامة"]].map(([c,cn])=>{const L2=items.filter(x=>bc(B(x.b))===c);return L2.length?`<h3>${cn} <span class="mut">(${toAr(L2.length)})</span></h3><div class="newg">${L2.map(x => { const b = B(x.b); return `<section class="newc"><h3>${esc(b.setTitle && b.vol ? b.setTitle + " — " + b.title.replace(b.setTitle,"").replace(/^\s*[—-]\s*/,"") : b.title)}</h3><span class="mut">${esc(A_(b))} • ${toAr(x.n)} سؤالًا</span><div class="chips" style="margin-top:8px">${Object.keys(LV).filter(l => (x.lv || {})[l]).map(l => `<a class="chip" href="#/quizzes/${esc(x.b)}?l=${l}">${LV[l]} (${toAr(x.lv[l])})</a>`).join("")}</div></section>`; }).join("")}</div>`:""}).join("")+'<p class="mut">كل سؤال أُعدّ من نص الكتاب تامّ السياق، وراجعه مدقق ثانٍ فحذف الغامض والمبتور وما له أكثر من جواب، ومعه بعد الإجابة تعليله وعبارة الكتاب ورقم صفحتها.</p>' : '<div class="note">تُعدّ الآن اختبارات محرَّرة لكتب المكتبة (سهل ١٥ سؤالًا، ومتوسط ٣٠، ومتقدم ٥٠)، تُكتب بأسئلة تامة السياق واختيارات صحيحة المعنى، ويراجعها مدقق ثانٍ قبل نشرها؛ وتظهر هنا تباعًا كتابًا بعد كتاب. ولأسئلة الكتب بأجوبتها كما وردت فيها: <a href="#/qa">سؤال وجواب من الكتب</a>.</div>'}
       ${mine.length ? `<h3>نتائجي السابقة</h3>${mine.map(m => { const b = B(m.b); return `<div class="bk"><b>${esc(b ? b.title : m.b)} — ${LV[m.l] || ""}</b><span>${toAr(m.s)} من ${toAr(m.n)} • ${esc(m.at)}</span> <a class="btn s" href="#/quizzes/${esc(m.b)}?l=${m.l}">إعادة</a></div>`; }).join("")}<button class="btn s" data-act="qzclear">مسح نتائجي من هذا الجهاز</button>` : ""}`);
    }
    const b = B(id), d = await getJ(QF(id)), l = LV[q.l] ? q.l : "easy";
    // عدد الأسئلة بحسب المستوى، مع موازنة الأنواع (لا يطغى نوع على غيره)
    const pool = shuffle(((d && d.qs) || []).filter(x => x.ok && x.lvl === l)), want = QN[l], by = { mcq: [], tf: [], cloze: [] };
    pool.forEach(x => (by[x.type] || (by[x.type] = [])).push(x));
    const share = { mcq: .5, tf: .3, cloze: .2 }, qs = [];
    Object.keys(share).forEach(t => qs.push(...(by[t] || []).splice(0, Math.round(want * share[t]))));
    shuffle(Object.values(by).flat()).forEach(x => { if (qs.length < want) qs.push(x); });
    qs.splice(want); const qs2 = shuffle(qs); qs.length = 0; qs.push(...qs2);
    if (!b || !qs.length) return view(`<p><a href="#/quizzes">اختبارات الكتب</a> ›</p><div class="note">أسئلة هذا الكتاب قيد الإعداد: تُعدّ له اختبارات محرَّرة متدرجة تامة السياق، تُراجَع مرة ثانية قبل نشرها، وتظهر هنا قريبًا.</div>`);
    CUR = { b: id, l, qs };
    view(`<p><a href="#/quizzes">اختبارات الكتب</a> › ${esc(b.title)}</p><h2>اختبار: ${esc(b.title)} <span class="mut">— ${LV[l]} (${toAr(qs.length)} سؤالًا)</span></h2>
     <nav class="chips">${Object.keys(LV).map(k => `<a class="chip${k === l ? " x" : ""}" href="#/quizzes/${esc(id)}?l=${k}">${LV[k]} — ${toAr(QN[k])} سؤالًا</a>`).join("")}</nav>${qs.length < QN[l] ? `<p class="mut">المتاح الآن في هذا المستوى ${toAr(qs.length)} سؤالًا، ويكتمل العدد بعد إعداد الأسئلة المحرَّرة للكتاب.</p>` : ""}
     <form data-form="qzrun" class="qz">${qs.map((x, i) => `<fieldset class="qq" data-i="${i}"><legend><b>${toAr(i + 1)}.</b> <span class="mut">${TY[x.type]}</span></legend><p class="qt">${esc(x.q)}</p>
      ${x.type === "mcq" ? x.opts.map(o => `<label class="inl qo"><input type="radio" name="a${i}" value="${esc(o)}" required> ${esc(o)}</label>`).join("") : x.type === "tf" ? ["صح", "خطأ"].map(o => `<label class="inl qo"><input type="radio" name="a${i}" value="${o}" required> ${o}</label>`).join("") : `<input name="a${i}" required placeholder="اكتب الكلمة الناقصة" autocomplete="off">`}
      ${l !== "hard" ? `<details class="qh"><summary>💡 تلميح</summary>${x.h ? `<p>${esc(x.h)}</p>` : ""}<p class="mut">${x.h ? "وللاستزادة" : "راجع"} <a href="#/book/${esc(id)}/${x.p}" target="_blank">الصفحة ${toAr(x.p)} من الكتاب</a>.</p></details>` : ""}<div class="qr" hidden></div></fieldset>`).join("")}
      <div class="savebar"><button class="btn p">تصحيح الإجابات</button></div></form><div id="qzres"></div>`);
  }
  let CUR = null;
  // مقارنة جواب «أكمل» بتسامح: بلا تشكيل ولا همزات ولا «ال» ولا حروف العطف والجر الملتصقة
  const bare = s => norm(String(s || "")).replace(/[^ء-ي\s]/g, "").split(/\s+/).filter(Boolean).map(w => w.replace(/^(و|ف|ب|ك|ل)?(ال)?/, "")).join(" ");
  const same = (a, b) => !!a && bare(a) === bare(b);
  function grade(f) {
    if (!CUR) return; const fd = new FormData(f); let s = 0;
    CUR.ans = [];
    CUR.qs.forEach((x, i) => {
      const v = String(fd.get("a" + i) || "").trim(), ok = same(v, x.a) || (x.alt || []).some(y => same(v, y)), el = f.querySelector(`.qq[data-i="${i}"] .qr`);
      CUR.ans[i] = { v, ok }; if (ok) s++; el.hidden = false; el.className = "qr " + (ok ? "ok" : "no");
      el.innerHTML = (ok ? "✔ إجابة صحيحة" : `✘ الإجابة الصحيحة: <b>${esc(x.a)}</b>`) + (x.e ? `<br>${esc(x.e)}` : "") + (x.ctx && (!ok || x.e) ? `<br><span class="mut">من الكتاب: «${esc(x.ctx)}»</span>` : "") + ` — <a href="#/book/${esc(CUR.b)}/${x.p}" target="_blank">ص ${toAr(x.p)}</a>`;
    });
    const n = CUR.qs.length, pc = Math.round(s * 100 / n);
    const fb = pc >= 90 ? "ممتاز، فهمٌ متمكن للكتاب. جرّب المستوى الأعلى." : pc >= 70 ? "جيد جدًا. راجع الأسئلة التي أخطأت فيها من صفحاتها." : pc >= 50 ? "جيد. يحسن أن تعيد قراءة المواضع المشار إليها ثم تعيد الاختبار." : "تحتاج إلى مراجعة الكتاب. ابدأ بالصفحات المشار إليها ثم أعد المحاولة.";
    $("#qzres").innerHTML = `<div class="note qzsum"><b>نتيجتك: ${toAr(s)} من ${toAr(n)} (${toAr(pc)}٪)</b><br>${fb}</div><div class="qzdl"><b>تحميل</b> <input id="qzname" placeholder="اسمك في الملف (اختياري)" value="${esc(lsGet("qzname"))}" autocomplete="name">
      <div class="chips"><button class="chip" data-act="qzout" data-k="res" data-f="pdf">📄 النتيجة PDF</button><button class="chip" data-act="qzout" data-k="res" data-f="png">🖼️ النتيجة صورة</button>
      <button class="chip" data-act="qzout" data-k="all" data-f="pdf">📄 الأسئلة بإجاباتي PDF</button><button class="chip" data-act="qzout" data-k="all" data-f="png">🖼️ الأسئلة بإجاباتي صورًا</button></div></div>
      <a class="btn" href="#/quizzes/${esc(CUR.b)}?l=${CUR.l}&r=${Date.now()}">اختبار جديد</a> <a class="btn" href="#/quizzes">كل الاختبارات</a>`;
    Object.assign(CUR, { s, n, pc, fb, at: today() });
    R().push({ b: CUR.b, l: CUR.l, s, n, at: today() }); if (S.qres.length > 100) S.qres = S.qres.slice(-100); saveS();
    f.querySelector(".savebar").hidden = true; $("#qzres").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- تحميل النتيجة والأسئلة بإجابات العضو (PDF بالطباعة، أو صور PNG) ----------
  const lsGet = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const qzTitle = () => { const b = B(CUR.b) || {}; return b.setTitle && b.vol ? b.setTitle + " — " + b.title : (b.title || CUR.b); };
  const qzRows = () => CUR.qs.map((x, i) => ({ x, i, v: (CUR.ans[i] || {}).v || "", ok: (CUR.ans[i] || {}).ok }));
  function qzPdf(k, nm) {
    if (!CUR || !CUR.ans) return; const o = location.origin, t = qzTitle();
    const rows = k === "all" ? qzRows().map(r => `<section class="q ${r.ok ? "ok" : "no"}"><p class="qt"><b>${toAr(r.i + 1)}.</b> <small>${TY[r.x.type]}</small> ${esc(r.x.q)}</p>
${r.x.type === "mcq" ? `<ul>${r.x.opts.map(op => `<li class="${op === r.x.a ? "c" : ""}${op === r.v && op !== r.x.a ? " w" : ""}">${esc(op)}</li>`).join("")}</ul>` : ""}
<p>إجابتي: <b>${esc(r.v || "—")}</b> ${r.ok ? "✔" : "✘"}${r.ok ? "" : ` — الصواب: <b>${esc(r.x.a)}</b>`}</p>${r.x.e ? `<p class="e">${esc(r.x.e)}</p>` : ""}<p class="e">ص ${toAr(r.x.p)} من الكتاب</p></section>`).join("") : "";
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نتيجة اختبار ${esc(t)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap">
<style>@page{size:A4;margin:16mm 14mm}body{font-family:Amiri,'Traditional Arabic',serif;font-size:13.5pt;line-height:1.8;color:#14231f}
.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b88a2e;padding-bottom:6px;color:#0f5c4d}.hd img{height:42px}
h1{color:#0f5c4d;font-size:20pt;margin:12px 0 4px}.sum{border:2px solid #0f5c4d;border-radius:10px;padding:10px 14px;margin:10px 0 16px}.sum b.big{font-size:20pt;color:#0f5c4d}
.q{border:1px solid #d6dfda;border-radius:8px;padding:6px 12px;margin:8px 0;page-break-inside:avoid}.q.ok{border-right:5px solid #2e7d32}.q.no{border-right:5px solid #c62828}
.qt{margin:2px 0}small{color:#7a6a4a}ul{margin:2px 0;padding-right:22px}li.c{color:#2e7d32;font-weight:700}li.w{color:#c62828;text-decoration:line-through}.e{color:#5b6b66;font-size:11.5pt;margin:2px 0}
.ft{margin-top:14px;text-align:center;color:#5b6b66;font-size:10pt;border-top:1px solid #d6dfda;padding-top:6px}</style></head><body>
<div class="hd"><span>مكتبة الدعوة السلفية الرقمية</span><img src="${o}/assets/logo-sdsl-128.png" alt=""><span>dawahlibrary.org</span></div>
<h1>نتيجة اختبار: ${esc(t)}</h1><div class="sum">${nm ? `الاسم: <b>${esc(nm)}</b><br>` : ""}المستوى: <b>${LV[CUR.l]}</b> • التاريخ: ${esc(CUR.at)}<br>النتيجة: <b class="big">${toAr(CUR.s)} من ${toAr(CUR.n)} (${toAr(CUR.pc)}٪)</b><br>${esc(CUR.fb)}</div>
${rows}<div class="ft">اختبار ذاتي من مكتبة الدعوة السلفية الرقمية (dawahlibrary.org)، أسئلته من نص الكتاب مع أرقام صفحاتها.</div>
<script>onload=()=>setTimeout(()=>print(),700)<\/script></body></html>`;
    const w = window.open("", "_blank"); if (!w) return toast("اسمح بالنوافذ المنبثقة ثم أعد المحاولة"); w.document.write(html); w.document.close();
  }
  async function qzImg(k, nm) {
    if (!CUR || !CUR.ans) return; await document.fonts.ready; const t = qzTitle(), W = 1240, H = 1754, M = 70;
    const logo = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = "assets/logo-sdsl-128.png"; });
    const pages = []; let c, x, y;
    const wrap = (s, w) => { const out = []; let line = ""; String(s).split(/\s+/).forEach(wd => { const tl = line ? line + " " + wd : wd; if (line && x.measureText(tl).width > w) { out.push(line); line = wd; } else line = tl; }); if (line) out.push(line); return out; };
    const page = () => { c = document.createElement("canvas"); c.width = W; c.height = H; x = c.getContext("2d"); pages.push(c);
      x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, H); x.strokeStyle = "#b88a2e"; x.lineWidth = 6; x.strokeRect(24, 24, W - 48, H - 48);
      x.direction = "rtl"; x.textAlign = "right"; if (logo) x.drawImage(logo, M, 40, 64, 64);
      x.fillStyle = "#0f5c4d"; x.font = 'bold 28px Amiri, serif'; x.fillText("مكتبة الدعوة السلفية الرقمية", W - M, 82); x.font = '22px Amiri, serif'; x.fillStyle = "#5b6b66"; x.fillText("dawahlibrary.org", W - M, 110);
      y = 150; };
    const text = (s, font, color, gap, ind) => { x.font = font; x.fillStyle = color; for (const ln of wrap(s, W - 2 * M - (ind || 0))) { if (y > H - 90) page(), x.font = font, x.fillStyle = color; x.fillText(ln, W - M - (ind || 0), y); y += gap; } };
    page();
    text("نتيجة اختبار: " + t, 'bold 40px Amiri, serif', "#0f5c4d", 54);
    if (nm) text("الاسم: " + nm, '30px Amiri, serif', "#2a241a", 44);
    text("المستوى: " + LV[CUR.l] + "  •  التاريخ: " + CUR.at, '28px Amiri, serif', "#2a241a", 42);
    text("النتيجة: " + toAr(CUR.s) + " من " + toAr(CUR.n) + " (" + toAr(CUR.pc) + "٪)", 'bold 44px Amiri, serif', CUR.pc >= 50 ? "#2e7d32" : "#c62828", 60);
    text(CUR.fb, '28px Amiri, serif', "#2a241a", 42); y += 16;
    if (k === "all") qzRows().forEach(r => {
      if (y > H - 260) page();
      text(toAr(r.i + 1) + ". " + r.x.q, 'bold 28px Amiri, serif', "#14231f", 40);
      if (r.x.type === "mcq") r.x.opts.forEach(op => text("◦ " + op, '26px Amiri, serif', op === r.x.a ? "#2e7d32" : op === r.v ? "#c62828" : "#3a4a45", 36, 24));
      text("إجابتي: " + (r.v || "—") + (r.ok ? "  ✔" : "  ✘   الصواب: " + r.x.a), '26px Amiri, serif', r.ok ? "#2e7d32" : "#c62828", 38, 24);
      if (r.x.e) text(r.x.e, '23px Amiri, serif', "#5b6b66", 33, 24);
      text("ص " + toAr(r.x.p) + " من الكتاب", '22px Amiri, serif', "#7a6a4a", 30, 24); y += 18;
    });
    pages.forEach((pg, i) => { const g = pg.getContext("2d"); g.direction = "rtl"; g.textAlign = "center"; g.fillStyle = "#5b6b66"; g.font = '20px Amiri, serif'; g.fillText((pages.length > 1 ? "صفحة " + toAr(i + 1) + " من " + toAr(pages.length) + " • " : "") + "اختبار ذاتي من مكتبة الدعوة السلفية الرقمية", W / 2, H - 50); });
    const base = "اختبار-" + t.slice(0, 40) + "-" + LV[CUR.l];
    for (let i = 0; i < pages.length; i++) { const b = await new Promise(r => pages[i].toBlob(r, "image/png")); await dl(base + (pages.length > 1 ? "-" + (i + 1) : "") + ".png", b); await new Promise(r => setTimeout(r, 350)); }
  }
  // ---------- الإدارة ----------
  async function admin(q) {
    const id = q.b && B(q.b) ? q.b : "", ix = (await getJ(IDX, true)) || { items: [] };
    let h = `<p class="mut">اختر كتابًا، ثم أنشئ مسودة أسئلة آلية من نصه أو أضف أسئلة يدويًا. لا يظهر سؤال للأعضاء قبل تعليمه «معتمد» بعد مراجعته والتأكد من مطابقته للنص ووضوح إجابته.</p>
     <form data-form="qzpick" class="sbox" style="max-width:none"><input name="t" list="qzbooks" placeholder="اسم الكتاب" value="${id ? esc(B(id).title) : ""}"><datalist id="qzbooks">${BOOKS().filter(x => !x.hidden && !isArt(x)).map(x => `<option value="${esc(x.title)}">`).join("")}</datalist><button class="btn">فتح</button></form>
     ${(ix.items || []).length ? `<p class="mut">كتب لها اختبارات: ${ix.items.map(x => `<a href="#/admin?t=quizzes&b=${esc(x.b)}">${esc((B(x.b) || {}).title || x.b)} (${toAr(x.n)})</a>`).join(" • ")}</p>` : ""}`;
    if (!id) return h;
    const d = (await getJ(QF(id), true)) || { b: id, qs: [] };
    QD = d;
    h += `<h3>${esc(B(id).title)} — ${toAr(d.qs.length)} سؤالًا (${toAr(d.qs.filter(x => x.ok).length)} معتمد)</h3>
     <div class="row"><button class="btn p" data-act="qzai" data-b="${esc(id)}" title="سهل ١٥، متوسط ٣٠، متقدم ٥٠ — متنوعة ومراجَعة؛ مع مختصر محرَّر بثلاث درجات">${d.ai ? "إعادة إعداد" : "إعداد"} الاختبار والمختصر المحرَّرين</button> <span id="qzais" class="mut"></span> <button class="btn" data-act="qzadd">سؤال يدوي</button></div>
     <form data-form="qzsave" data-b="${esc(id)}"><div id="qzlist">${d.qs.map(rowQ).join("")}</div><div class="savebar"><button class="btn p">حفظ الأسئلة</button> <span id="qzst" class="mut"></span></div></form>`;
    return h;
  }
  let QD = null;
  const rowQ = (x, i) => `<fieldset class="qzrow" data-id="${esc(x.id)}"><div class="row"><select name="type">${Object.entries(TY).map(([k, v]) => `<option value="${k}"${k === x.type ? " selected" : ""}>${v}</option>`).join("")}</select><select name="lvl">${Object.entries(LV).map(([k, v]) => `<option value="${k}"${k === x.lvl ? " selected" : ""}>${v}</option>`).join("")}</select><input name="p" type="number" min="1" value="${x.p || 1}" title="الصفحة" style="width:90px"><label class="inl"><input type="checkbox" name="ok"${x.ok ? " checked" : ""}> معتمد</label><button type="button" class="btn s" data-act="qzdel">حذف</button></div>
    <label>السؤال (استعمل …… لموضع الكلمة الناقصة)</label><textarea name="q" rows="2">${esc(x.q)}</textarea>
    <div class="row"><div><label>البدائل (للاختيار من متعدد، يفصل بينها |)</label><input name="opts" value="${esc((x.opts || []).join(" | "))}"></div><div><label>الإجابة الصحيحة</label><input name="a" value="${esc(x.a)}"></div></div>${x.ctx ? `<p class="mut">نص الكتاب: «${esc(x.ctx)}»</p>` : ""}</fieldset>`;
  function collect(f) {
    return [...f.querySelectorAll(".qzrow")].map(r => { const g = n => r.querySelector(`[name=${n}]`); const prev = (QD.qs || []).find(x => x.id === r.dataset.id) || {};
      const o = { id: r.dataset.id, type: g("type").value, lvl: g("lvl").value, p: +g("p").value || 1, ok: g("ok").checked, q: g("q").value.trim(), a: g("a").value.trim() };
      if (o.type === "mcq") o.opts = g("opts").value.split("|").map(s => s.trim()).filter(Boolean); if (o.type === "tf" && !/^(صح|خطأ)$/.test(o.a)) o.a = "صح";
      ["ctx", "auto", "e", "src", "rev", "alt"].forEach(k => { if (prev[k] != null) o[k] = prev[k]; }); return o; }).filter(o => o.q && o.a);
  }
  async function save(f) {
    const id = f.dataset.b, qs = collect(f), st = $("#qzst");
    const bad = qs.filter(x => x.ok && x.type === "mcq" && (!x.opts || x.opts.length < 2 || !x.opts.includes(x.a)));
    if (bad.length) { st.textContent = "سؤال اختيار من متعدد معتمد لا تتضمن بدائله الإجابة الصحيحة؛ صححه أولًا."; return; }
    st.textContent = "جارٍ الحفظ…";
    try {
      await GH.editJSON(QF(id), o => Object.assign({ v: 1, b: id }, o && o.ai ? { ai: 1, v: 2 } : {}, { at: today(), qs }), "اختبارات: " + B(id).title + " (" + qs.filter(x => x.ok).length + " معتمد)");
      const lv = {}; qs.filter(x => x.ok).forEach(x => lv[x.lvl] = (lv[x.lvl] || 0) + 1);
      await GH.editJSON(IDX, d => { d = d && d.items ? d : { v: 1, items: [] }; d.items = d.items.filter(x => x.b !== id); if (qs.length) d.items.push({ b: id, n: qs.filter(x => x.ok).length, lv }); return d; }, "فهرس الاختبارات");
      st.textContent = "حُفظ ✓";
    } catch (e) { st.textContent = "تعذر الحفظ: " + e.message; }
  }
  // ---------- الربط بالواجهة ----------
  const pickId = t => { const x = BOOKS().find(b => b.title === String(t).trim()); return x && x.id; };
  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-form]"); if (!f) return; const k = f.dataset.form; if (!/^(sumpick|qzrun|qzpick|qzsave)$/.test(k)) return;
    e.preventDefault(); e.stopImmediatePropagation(); const fd = new FormData(f);
    if (k === "sumpick") { const id = pickId(fd.get("t")); if (id) location.hash = "#/summary?b=" + encodeURIComponent(id) + "&r=20"; else toast("اختر اسم الكتاب من القائمة"); }
    else if (k === "qzpick") { const id = pickId(fd.get("t")); if (id) location.hash = "#/admin?t=quizzes&b=" + encodeURIComponent(id); else toast("اختر اسم الكتاب من القائمة"); }
    else if (k === "qzrun") grade(f); else if (k === "qzsave") save(f);
  }, true);
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act^=qz],[data-act=sumpdf]"); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); const a = el.dataset.act;
    if (a === "sumpdf") pdf(el.dataset.b, +el.dataset.r);
    else if (a === "qzout") { const nm = ($("#qzname") || {}).value || ""; lsSet("qzname", nm.trim()); (el.dataset.f === "pdf" ? qzPdf : qzImg)(el.dataset.k, nm.trim()); }
    else if (a === "qzai") { el.disabled = true; try { if (!GH.on) throw new Error("فعّل الإدارة المباشرة أولًا."); const bid = el.dataset.b; await GH.editJSON("data/study-queue.json", o => { o = o && o.items ? o : { items: [] }; o.items = [{ id: bid, do: ["quiz", "summ"] }].concat(o.items.filter(x => x.id !== bid)); return o; }, "طلب اختبار ومختصر محرَّرين: " + ((B(bid) || {}).title || bid)); $("#qzais").textContent = "أُضيف في أول الطابور؛ يبدأ الإعداد خلال دقائق ويصلك إشعار عند انتهائه."; } catch (x) { toast(x.message); el.disabled = false; } }
    else if (a === "qzclear") { if (confirm("مسح نتائج الاختبارات من هذا الجهاز؟")) { S.qres = []; saveS(); route(); } }
    else if (a === "qzdraft") { el.disabled = true; el.textContent = "جارٍ التحليل…"; try { const b = await loadBook(el.dataset.b), qs = draft(b); QD.qs = QD.qs.concat(qs); $("#qzlist").insertAdjacentHTML("beforeend", qs.map(rowQ).join("")); el.textContent = "أُضيفت " + toAr(qs.length) + " مسودة — راجعها ثم احفظ"; } catch (err) { el.disabled = false; el.textContent = "تعذر: " + err.message; } }
    else if (a === "qzadd") { const x = { id: "q" + Date.now().toString(36), type: "mcq", lvl: "easy", q: "", a: "", opts: [], p: 1, ok: false }; QD.qs.push(x); $("#qzlist").insertAdjacentHTML("beforeend", rowQ(x)); }
    else if (a === "qzdel") el.closest(".qzrow").remove();
  }, true);
  return { vSummary, vQuizzes, admin, abridge, draft, sections };
})();
