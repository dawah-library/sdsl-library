/* الواجهة الأولى: ثلاثة أقسام رئيسية كبيرة زجاجية تُتصفح بالسحب أفقيًا كأيقونات التطبيقات (تقليل الزحام والتشعب)،
   ولكل قسم صفحة (#/hub/<k>) بأيقونات أقسامه الفرعية:
   wahy  الوحي: الكتاب والسنة — المصحف والحديث النبوي.
   dawah مكتبة الدعوة السلفية — كتب مشايخ الدعوة بمصر ومقالاتهم وفتاواهم وتفريغاتهم وبياناتهم وخدماتها.
   aam   المكتبة العامة والخدمات العلمية — باقي محتوى الموقع.
   «الرئيسية الموسعة» (بقية أقسام الرئيسية القديمة) تُطوى تحت زر، ويُحفظ اختيار الزائر على جهازه. */
const PORTAL = (() => {
  const HUBS = [
    { k: "wahy", t: "الوحي", s: "الكتاب والسنة", ic: "book-marked", d: "القرآن الكريم بالرسم العثماني والتلاوة والتفسير، ودواوين السنة النبوية وأحاديثها.",
      l: [["#/mushaf", "المصحف", "book-marked", "المصحف الشريف بالتلاوة والتفسير والتكرار"], ["#/hadith", "الحديث النبوي", "scroll", "دواوين السنة وأحاديثها بالتخريج"]] },
    { k: "dawah", t: "مكتبة الدعوة السلفية", s: "أعمال مشايخ الدعوة السلفية بمصر", ic: "library", d: "كتب مشايخ الدعوة السلفية بمصر ومقالاتهم وفتاواهم وتفريغات دروسهم وبيانات الدعوة، وخدمات المكتبة عليها.",
      l: [["#/library?c=dawah", "كتب مشايخ الدعوة", "book-open", "الكتب بالنص والمصورة"], ["#/articles", "المقالات", "file-text", "مقالات صوت السلف"], ["#/fatawa", "الفتاوى", "message-circle-question", "بتقسيمها الفني وبحسب الشيخ"],
        ["#/tafrighat", "التفريغات والشروح", "mic", "الدروس مفرّغة نصيًا"], ["#/bayanat", "بيانات الدعوة", "megaphone", "البيانات الرسمية"], ["#/posts", "منشورات المشايخ", "rss", "من صفحات المشايخ والكتّاب"],
        ["#/furqan", "قضايا الفرقان", "scale", "المؤلفات المنهجية"], ["#/authors", "المشايخ والمؤلفون", "users", "تراجمهم وأعمالهم"], ["#/majalla", "مجلة المكتبة", "newspaper", "أعداد دورية"],
        ["#/tahrir", "تنسيق التفريغ للقراءة", "pen-line", "منسَّق ومدقَّق وبأسلوب كتابي"], ["#/saff", "صف التفريغ للطباعة", "printer", "كتاب مصفوف كإصدارات دور النشر"],
        ["#/dawah", "التعريف بالدعوة", "flag", "منهج الدعوة وأصولها"], ["#/history", "تاريخ الدعوة", "history", "نشأتها ومراحلها"], ["#/standards", "معايير التحرير", "ruler", "معايير المكتبة في النشر"]] },
    { k: "aam", t: "المكتبة العامة", s: "والخدمات العلمية", ic: "landmark", d: "كتب التراث والمراجع المعتمدة وموسوعة آثار السلف، وأدوات البحث والدراسة والحفظ، والصوتيات والقراءة الجماعية.",
      l: [["#/library?c=turath", "المكتبة العامة", "landmark", "التراث والمراجع المعتمدة"], ["#/mawsua", "موسوعات الموقع", "book-marked", "آثار السلف، والعقيدة والفقه والتفسير والفكر…"], ["#/ithra", "المصادر الإثرائية", "sparkles", "بحوث ودراسات"],
        ["#/search", "البحث المتقدم", "search", "في نصوص الكتب كلها"], ["#/ask", "اسأل المكتبة", "bot", "مساعد بحثي بالإحالة"], ["#/brain", "العقل المتعلّم", "brain", "تطور المساعد وتعلّمه"], ["#/paths", "المسارات العلمية", "route", "برامج متدرجة"],
        ["#/hifz", "حفظ المتون", "brain", "مراجعة متباعدة"], ["#/quizzes", "اختبارات الكتب", "clipboard-check", "ثلاثة مستويات"], ["#/summary", "اختصار الكتب", "list-collapse", "بألفاظ المؤلف"],
        ["#/kurrasat", "كراسات المكتبة", "notebook-pen", "كراسات للمذاكرة"], ["#/tashjir", "تشجير الكتب", "network", "خرائط ذهنية"], ["#/qa", "سؤال وجواب", "messages-square", "أسئلة علمية مجابة"],
        ["#/lexicon", "معجم المصطلحات", "book-a", "المصطلحات الشرعية"], ["#/tarajim", "التراجم والأعلام", "users-round", "أعلام الأمة"], ["#/timeline", "الخط الزمني", "history", "أحداث وأعلام"],
        ["#/compare", "قارن بين كتابين", "scale", "مقارنة الموضوعات"], ["#/qabasat", "قبسات", "quote", "مقتطفات مختارة"], ["#/arabic", "العربية لغير الناطقين", "languages", "تعليم العربية"],
        ["#/audio", "صوتيات المكتبة", "headphones", "الكتب مسموعة"], ["#/radio", "راديو المكتبة", "radio", "بث متواصل"], ["#/video", "مراجعات بالفيديو", "clapperboard", "مراجعات الكتب"],
        ["#/groups", "القراءة الجماعية", "users-round", "اقرأ مع غيرك"], ["#/challenges", "تحدي القراءة", "trophy", "أهداف ومنافسة"], ["#/community", "مجتمع المكتبة", "users", "مختارات الأعضاء"],
        ["#/releases", "جديد الإصدارات", "badge-plus", "جديد الكتب ودور النشر"], ["#/stats", "إحصاءات المكتبة", "chart-bar", "المكتبة بالأرقام"], ["#/talaea", "الطلائع", "baby", "عالم الأطفال"]] }
  ];
  const H = k => HUBS.find(h => h.k === k);
  // المرحلة ٧: مؤثر صوتي هادئ عند التقليب (يُولَّد بـWeb Audio فلا ملفات تُحمَّل، ويُكتم من الزر)، وتأثير عمق كروي اختياري؛ وكلاهما يحترم تقليل الحركة
  const pref = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch (e) { return d; } }, setp = (k, v) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch (e) { } };
  const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches, snd = () => pref("portal_snd", true), d3 = () => pref("portal_3d", !RM());
  let AC = null;
  function tick() { if (!snd()) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter(); o.type = "sine"; o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.18);
    f.type = "lowpass"; f.frequency.value = 1200; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(f); f.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.3); } catch (e) { } }
  const full = () => { try { return localStorage.getItem("home_full") === "1"; } catch (e) { return false; } };
  const tile = (h, i) => `<a class="ptile pt-${h.k}" href="#/hub/${h.k}" data-i="${i}" aria-label="${esc(h.t + " — " + h.s)}"><span class="pglass"></span><span class="pic">${ic(h.ic, 44)}</span><b>${esc(h.t)}</b><em>${esc(h.s)}</em><small>${h.l.slice(0, 4).map(x => esc(x[1])).join(" • ")}${h.l.length > 4 ? " …" : ""}</small></a>`;
  // بطاقات الواجهة الأولى (تُدرج بعد الترويسة في الرئيسية)
  function home() {
    return `<section class="portal" aria-label="الأقسام الرئيسية"><div class="ptrack" id="ptrack" role="list" tabindex="0" data-noswipe>${HUBS.map(tile).join("")}</div>
      <div class="pdots" role="tablist" aria-label="الأقسام">${HUBS.map((h, i) => `<button role="tab" data-act="pdot" data-i="${i}" aria-label="${esc(h.t)}"${i ? "" : ' class="on"'}></button>`).join("")}</div>
      <div class="popts"><button class="btn s" data-act="psnd" aria-pressed="${snd()}" title="مؤثرات التقليب الصوتية">${snd() ? "🔊" : "🔇"}</button><button class="btn s" data-act="p3d" aria-pressed="${d3()}" title="تأثير العمق">${d3() ? "◉ عمق" : "○ عمق"}</button></div>
      <div id="wkhome"></div>
      <button class="btn s pmore" data-act="hfull" aria-expanded="${full()}">${full() ? "طيّ بقية الرئيسية ▲" : "عرض بقية الرئيسية ▼"}</button></section>`;
  }
  // بعد العرض: النقطة الحالية تتبع السحب، والرئيسية مختصرة أو موسعة
  function wire() {
    const app = $("#app"), tr = $("#ptrack"); if (!app || !tr) return; app.classList.toggle("hmin", !full()); document.body.classList.toggle("phome", !full()); tr.classList.toggle("p3d", d3() && !RM());
    // البطاقة الأبرز (مكتبة الدعوة) في الوسط عند الفتح على الجوال
    if (innerWidth < 1100) { const dw = tr.querySelector(".pt-dawah"); if (dw) requestAnimationFrame(() => { tr.scrollLeft = dw.offsetLeft - (tr.clientWidth - dw.clientWidth) / 2; }); }
    const dots = [...document.querySelectorAll(".pdots button")];
    const upd = () => { const r = tr.getBoundingClientRect(), c = r.left + r.width / 2; let best = 0, bd = 1e9; [...tr.children].forEach((el, i) => { const b = el.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - c); if (d < bd) { bd = d; best = i; } el.classList.toggle("cur", false); el.style.setProperty("--off", Math.max(-1.5, Math.min(1.5, (b.left + b.width / 2 - c) / (b.width || 1))).toFixed(3)); }); tr.children[best].classList.add("cur"); dots.forEach((d, i) => d.classList.toggle("on", i === best)); if (tr.__cur !== undefined && tr.__cur !== best) tick(); tr.__cur = best; };
    tr.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true }); upd();
    // السهام على لوحة المفاتيح
    tr.addEventListener("keydown", e => { if (!/Arrow(Left|Right)/.test(e.key)) return; const i = dots.findIndex(d => d.classList.contains("on")) + (e.key === "ArrowLeft" ? 1 : -1); go(Math.max(0, Math.min(HUBS.length - 1, i))); });
  }
  function go(i) { const tr = $("#ptrack"), el = tr && tr.children[i]; if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
  // صفحة القسم الرئيسي: أيقونات أقسامه الفرعية
  function hub(k) {
    const h = H(k); if (!h) return location.hash = "#/";
    document.title = h.t + " — " + SITENAME;
    view(`<section class="hub hub-${h.k}"><header class="hubh"><span class="pic">${ic(h.ic, 40)}</span><div><h1>${esc(h.t)} <small>${esc(h.s)}</small></h1><p>${esc(h.d)}</p></div></header>
      <div class="hubg${h.l.length<=3?" few":""}">${h.l.map(([u, t, i, s]) => `<a class="happ" href="${u}"><span class="hai">${ic(i, 30)}</span><b>${esc(t)}</b><small>${esc(s)}</small></a>`).join("")}</div>
      <nav class="hubo" aria-label="الأقسام الرئيسية الأخرى">${HUBS.filter(x => x.k !== k).map(x => `<a href="#/hub/${x.k}">${ic(x.ic, 18)} ${esc(x.t)} <small>${esc(x.s)}</small></a>`).join("")}<a href="#/">${ic("house", 18)} الرئيسية</a></nav></section>`);
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "psnd") { setp("portal_snd", !snd()); b.textContent = snd() ? "🔊" : "🔇"; b.setAttribute("aria-pressed", snd()); if (snd()) tick(); return; }
    if (b.dataset.act === "p3d") { setp("portal_3d", !d3()); const tr = $("#ptrack"); if (tr) tr.classList.toggle("p3d", d3() && !RM()); b.textContent = d3() ? "◉ عمق" : "○ عمق"; b.setAttribute("aria-pressed", d3()); return; }
    if (b.dataset.act === "pdot") go(+b.dataset.i);
    else if (b.dataset.act === "hfull") { const f = !full(); try { localStorage.setItem("home_full", f ? "1" : "0"); } catch (x) { } const app = $("#app"); if (app) app.classList.toggle("hmin", !f); document.body.classList.toggle("phome", !f); b.setAttribute("aria-expanded", f); b.textContent = f ? "طيّ بقية الرئيسية ▲" : "عرض بقية الرئيسية ▼"; } });
  return { HUBS, home, wire, view: hub };
})();
