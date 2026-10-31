/* «الطلائع» — قسم الأطفال (الباب ٣٤ من الوثيقة، باسم الطلائع بطلب صاحب المكتبة).
   مسارات عمرية تديرها الإدارة، ومكتبة فرعية من كتب المكتبة الموسومة للأطفال، وألعاب تعليمية تعمل داخل الموقع
   بلا روابط خارجية ولا إعلانات ولا تواصل مع الغرباء. نص القرآن من مصحف المكتبة (data/quran/quran.json) دون تعديل.
   البيانات القابلة للتعديل: data/tala.json (المسارات، وأسئلة «صح أم خطأ» مع شرحها، وكتب كل مسار). نجوم الطفل على جهازه فقط. */
const TALA = (() => {
  const P = "data/tala.json";
  const DEF = { tracks: [["t1", "المستكشفون الصغار", "٥–٧ سنوات"], ["t2", "براعم المعرفة", "٨–١٠ سنوات"], ["t3", "رواد العلم", "١١–١٣ سنة"], ["t4", "الناشئة", "١٤ سنة فما فوق"]], facts: [], books: {} };
  let D = null, Q = null;
  const load = async f => { if (D && !f) return D; try { const r = await fetch(P + (f ? "?fresh=1" : "")); D = Object.assign({}, DEF, r.ok ? await r.json() : {}); } catch (e) { D = Object.assign({}, DEF); } return D; };
  const quran = async () => Q || (Q = fetch("data/quran/quran.json").then(r => r.json()).then(j => j.suras.map(s => ({ n: s.n, name: s.name, ayat: s.ayat.map((a, i) => (i === 0 && s.n !== 1 && s.n !== 9 ? a.replace(/^﻿?بسم الله الرحمن الرحيم\s*/, "") : a.replace(/^﻿/, "")).trim()).filter(Boolean) }))));
  const st = () => (S.tala = S.tala || { stars: 0, done: {} });
  const star = n => { st().stars += n; saveS(); const el = $("#tstars"); if (el) el.textContent = toAr(st().stars); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kidBooks = k => { const ids = new Set(((D.books || {})[k] || [])); return lib.books.filter(b => !b.hidden && !b.demo && (ids.has(b.id) || (b.tags || []).includes("tala:" + k) || (!k && (b.tags || []).some(t => /^tala(:|$)/.test(t))))); };
  const GAMES = [["ayah", "أكمل الآية", "اختر الكلمة التي تُكمل الآية من سور جزء عمّ", "📖"], ["order", "رتّب الآيات", "رتّب آيات السورة كما في المصحف", "🔢"], ["tf", "صح أم خطأ؟", "ميّز المعلومة الصحيحة من الخاطئة مع الشرح", "✅"], ["memory", "ذاكرة الحروف", "اقلب البطاقات وطابق الحروف المتشابهة", "🧠"], ["adhkar", "أذكار المسلم", "اختر الذكر المناسب لكل موقف من يومك", "🤲"], ["quiz", "مسابقة المعرفة", "أسئلة في العقيدة والسيرة والقرآن تناسب مرحلتك", "🏆"], ["ws", "البحث عن الكلمات", "ابحث عن كلمات مخبأة في شبكة الحروف", "🔍"], ["harakat", "حروف وحركات", "التأسيس اللغوي: اقرأ الحرف بحركته واختر الصحيح", "🔤"], ["word", "ركّب الكلمة", "رتّب حروف كلمة من القرآن الكريم", "🧩"]];
  const head = (t, back) => `<div class="tala"><div class="talah"><a href="#/talaea" class="talab">🌟 الطلائع</a><span class="mut">${t || ""}</span><span class="tstar">⭐ <b id="tstars">${toAr(st().stars)}</b></span></div>${back ? `<p><a href="#/talaea">← العودة إلى الطلائع</a></p>` : ""}`;
  async function show(q, sub) {
    await load();
    if (sub === "games" && q.g) return game(q.g, q);
    if (sub === "track") { PLc = await plan(); return track(q.k); }
    if (sub === "ladder") return ladder(q.k || (kid() || {}).track || "t1", q);
    if (sub === "parents") return parents();
    view_(head("عالم المعرفة والمرح للأطفال") + `<h2 class="talat">مرحبًا بك في الطلائع</h2><p>تعلّم القرآن والآداب والمعرفة، والعب ألعابًا مفيدة، واجمع النجوم!</p>
      <h3>اختر مسارك</h3><div class="talag">${D.tracks.map(([k, n, a]) => `<a class="talac tk-${k}" href="#/talaea/track?k=${k}"><b>${esc(n)}</b><span>${esc(a)}</span></a>`).join("")}</div>
      ${await todayCard()}
      <h3>سُلّم القراءة</h3><p class="mut">كتب ومقالات مختارة من المكتبة لكل مرحلة، مرتبة مستويات من الأسهل إلى الأصعب، ولكل قراءة سؤال تأمل ونجوم.</p><div class="talag">${D.tracks.map(([k, n, a]) => `<a class="talac tk-${k}" href="#/talaea/ladder?k=${k}"><i aria-hidden="true">📚</i><b>${esc(n)}</b><span>${esc(a)}</span></a>`).join("")}</div>
      <p><a class="btn" href="#/talaea/parents">👪 ركن الوالدين: المنهجية ومتابعة القراءة</a></p>
      <h3>الألعاب التعليمية</h3><div class="talag">${GAMES.map(([g, n, d, ic]) => `<a class="talac game" href="#/talaea/games?g=${g}"><i aria-hidden="true">${ic}</i><b>${n}</b><span>${d}</span></a>`).join("")}</div>
      <h3>مكتبة الطلائع</h3>${kidBooks("").map(bookCard).join("") || '<div class="note">تُضاف كتب الأطفال وقصصهم هنا قريبًا بإذن الله بعد اختيارها ومراجعتها.</div>'}
      <p class="note">إلى الوالدين: هذا القسم بلا إعلانات ولا روابط خارجية ولا تعليقات أو مراسلة، ونجوم الطفل تُحفظ على هذا الجهاز وحده. نص القرآن الكريم في الألعاب من مصحف المكتبة دون تغيير.</p></div>`);
  }
  const view_ = h => view(h);
  function track(k) {
    const t = D.tracks.find(x => x[0] === k) || D.tracks[0], bs = kidBooks(t[0]);
    view_(head(t[1] + " — " + t[2], true) + `<h2 class="talat">${esc(t[1])}</h2><p class="mut">${esc(t[2])}. ويمكن اختيار المستوى الأنسب لمهارة الطفل لا لعمره وحده.</p>
     <p><a class="btn p" href="#/talaea/ladder?k=${t[0]}">📚 سُلّم القراءة لهذه المرحلة</a></p>
     ${stageCard(t[0])}
     <h3>🎮 ألعاب تناسب هذه المرحلة</h3><div class="talag">${gamesFor(t[0]).map(([g, n, d, ic]) => `<a class="talac game" href="#/talaea/games?g=${g}&k=${t[0]}"><i aria-hidden="true">${ic}</i><b>${n}</b><span>${d}</span></a>`).join("")}</div>
     ${(() => { const r = ((PLc && PLc.reads) || {})[t[0]] || []; return r.length ? `<h3>📰 مقالات للطلائع</h3><p class="mut">مقالات كُتبت للفتيان أنفسهم: «فتية الإسلام» وكتّاب الناشئة.</p><div class="list">${r.map(id => B(id)).filter(Boolean).slice(0, 30).map(bookCard).join("")}</div>` : ""; })()}
     <h3>كتب وقصص المسار</h3>${bs.map(bookCard).join("") || '<div class="note">لم تُضف كتب لهذا المسار بعد.</div>'}</div>`);
  }
  // ---------- الألعاب ----------
  let G = null;
  async function game(g, q) {
    if (g === "ayah" || g === "order") {
      const Qs = await quran(), am = Qs.filter(s => s.n >= 78), sn = +q.s || 0, s = am.find(x => x.n === sn);
      if (!s) return view_(head(g === "ayah" ? "أكمل الآية" : "رتّب الآيات", true) + `<h2 class="talat">${g === "ayah" ? "أكمل الآية" : "رتّب الآيات"}</h2><p>اختر سورة من جزء عمّ:</p><div class="chips">${am.slice().reverse().map(x => `<a class="chip" href="#/talaea/games?g=${g}&s=${x.n}">${esc(x.name.replace(/^سُورَةُ\s*/, ""))}</a>`).join("")}</div></div>`);
      return g === "ayah" ? ayahRound(s, 0, 0) : orderRound(s);
    }
    if (g === "tf") { const fs = shuffle(D.facts || []).slice(0, 10); if (!fs.length) return view_(head("صح أم خطأ؟", true) + '<div class="note">تُضاف الأسئلة قريبًا.</div></div>'); G = { fs, i: 0, s: 0 }; return tfRound(); }
    const k = q.k || (kid() || {}).track || "t2";
    if (g === "adhkar") { const n = k === "t1" ? 6 : 10; G = { list: shuffle(ADH).slice(0, n), i: 0, s: 0, n: k === "t1" ? 2 : 3 }; return adhkar(k); }
    if (g === "quiz") { G = { list: shuffle(QZ[k] || QZ.t2), i: 0, s: 0 }; return quiz(k); }
    if (g === "ws") return wsNew(k === "t1" ? "t2" : k);
    if (g === "memory") return memory(k);
    if (g === "harakat") { G = { i: 0, s: 0 }; return harakat(); }
    if (g === "word") { const Qs = await quran(); const ws = []; Qs.filter(x => x.n >= 93).forEach(x => x.ayat.forEach(a => String(a).split(/\s+/).forEach(w => { const b = w.replace(/[^\u0621-\u064A]/g, ""); if (b.length >= 3 && b.length <= 6 && !/[ٱۜ-ۭ]/.test(w)) ws.push([w, b]); })));
      G = { ws: shuffle(ws).slice(0, 10), i: 0, s: 0 }; return wordRound(); }
    location.hash = "#/talaea";
  }

  // ---------- ملف كل مرحلة عمرية: المهارات المستهدفة، والأنشطة الأسبوعية، والألعاب المناسبة بصعوبتها، والكتب ----------
  // الألعاب على أنماط مواقع الألعاب التعليمية الكبرى (المطابقة، البحث عن الكلمات، المسابقات، الترتيب، الذاكرة) بمحتوى شرعي موثق.
  const STG = {
    t1: { g: ["harakat", "memory", "adhkar", "ayah", "quiz"], lv: 1,
      sk: [["إيماني", "معرفة الله الخالق وحبه، وأركان الإسلام بأسمائها"], ["قرآني", "حفظ قصار السور (الفاتحة والإخلاص والمعوذتين) بالتلقين"], ["لغوي", "تمييز الحروف والحركات الثلاث"], ["أخلاقي", "السلام والصدق وشكر النعمة وطاعة الوالدين"], ["حياتي", "أذكار الطعام والنوم والخلاء، والنظافة"]],
      act: [["📖", "سورة الأسبوع", "يحفظ مع والده سورة قصيرة، ويسمّعها يوم الجمعة"], ["🍽️", "ذكر الطعام", "يقول «بسم الله» قبل الأكل و«الحمد لله» بعده كل يوم"], ["🌙", "قصة نبي قبل النوم", "يقرأ الوالد قصة من «قصص الأنبياء» ويسأل: ماذا تعلمنا؟"], ["🎨", "ارسم ما تعلمت", "يرسم مشهدًا من القصة (بلا ذوات أرواح)"], ["🤝", "أفشِ السلام", "يلقي السلام على أهل البيت عند الدخول"], ["🧹", "يد المساعدة", "يرتب ألعابه وغرفته مرة يوميًا"]] },
    t2: { g: ["word", "ws", "ayah", "order", "adhkar", "tf", "quiz", "memory"], lv: 2,
      sk: [["إيماني", "أركان الإيمان الستة، ومحبة النبي ﷺ"], ["قرآني", "حفظ جزء عمّ متدرجًا، وفهم معاني الكلمات"], ["لغوي", "القراءة الجهرية الصحيحة والإملاء"], ["أخلاقي", "الأمانة والرحمة وبر الوالدين"], ["معرفي", "قصص الأنبياء والسيرة النبوية الميسرة"], ["حياتي", "الصلاة في وقتها، والوضوء الصحيح"]],
      act: [["📖", "خمس آيات", "يحفظ خمس آيات من جزء عمّ ويكتب كلمة جديدة تعلّمها"], ["⏰", "صلاتي في وقتها", "يحافظ على الصلوات الخمس في أوقاتها أسبوعًا كاملًا"], ["📚", "عشر دقائق قراءة", "يقرأ يوميًا من سُلّم القراءة"], ["✍️", "جملة جميلة", "يكتب جملة يصف بها نعمة من نعم الله"], ["💝", "صدقة صغيرة", "يتصدق من مصروفه ولو بالقليل"], ["🏠", "برّ اليوم", "يخدم والديه بعمل يختاره كل يوم"]] },
    t3: { g: ["ws", "order", "ayah", "tf", "quiz", "word"], lv: 3,
      sk: [["إيماني", "التوحيد وأقسامه بعبارة ميسرة (الأصول الثلاثة)"], ["قرآني", "التجويد العملي (تحفة الأطفال) وتدبر القصار"], ["لغوي", "مبادئ النحو (الآجرومية) والإعراب"], ["أخلاقي", "الحياء والصبر وحفظ اللسان"], ["معرفي", "تراجم الصحابة والسلف، والسيرة"], ["حياتي", "تنظيم الوقت والرياضة والقراءة الحرة"]],
      act: [["📜", "حديث الأسبوع", "يحفظ حديثًا من الأربعين النووية ويشرحه بأسلوبه"], ["🧑‍🎓", "صحابي الأسبوع", "يقرأ ترجمة صحابي ويلخصها في خمسة أسطر"], ["📚", "عشرون دقيقة", "يقرأ يوميًا من كتب مرحلته"], ["🔤", "أعرب جملة", "يعرب جملة قصيرة من القرآن أو الحديث بعد درس الآجرومية"], ["🤲", "مشروع خير", "يشارك في عمل خيري مع الأسرة أو المسجد"], ["⚽", "قوة المؤمن", "يمارس رياضة ثلاث مرات في الأسبوع"]] },
    t4: { g: ["quiz", "tf", "order", "ws", "ayah"], lv: 4,
      sk: [["إيماني", "العقيدة الصحيحة بأدلتها (الواسطية وكتاب التوحيد)"], ["قرآني", "ورد يومي وتفسير ميسر ومراجعة المحفوظ"], ["لغوي", "الكتابة والخطابة والنحو المتوسط"], ["منهجي", "مبادئ أصول الفقه، والرد على الشبهات المعاصرة"], ["أخلاقي", "علو الهمة وتحمّل المسؤولية والعمل التطوعي"], ["حياتي", "مهارات الحاسوب والبحث العلمي وإدارة الوقت"]],
      act: [["📖", "وردي اليومي", "جزء أو نصف جزء يوميًا مع مراجعة المحفوظ"], ["🎯", "مساري العلمي", "يسير في مستوى مبتدئ من «المسارات العلمية» بخطة وتذكير"], ["📝", "مقالة قصيرة", "يكتب مقالة في موضوع قرأه ويعرضها على والده"], ["🧭", "نقاش أسري", "يناقش والده في شبهة معاصرة وجوابها من كتاب «الإلحاد للمبتدئين»"], ["🤝", "تطوع", "ساعتان أسبوعيًا في خدمة نافعة"], ["💻", "مهارة جديدة", "يتعلم مهارة (خط، حاسوب، لغة) ويعرض ما أنجز"]] }
  };
  const actKey = (k, i) => "w" + Math.floor(Date.now() / 6048e5) + ":" + k + ":" + i;
  const stageCard = k => { const x = STG[k]; if (!x) return ""; const A = st().act || {};
    return `<h3>🎯 المهارات المستهدفة</h3><div class="talask">${x.sk.map(([c, d]) => `<div><b>${esc(c)}</b><span>${esc(d)}</span></div>`).join("")}</div>
      <h3>✅ أنشطة الأسبوع</h3><p class="mut">علّم ما أنجزه الطفل هذا الأسبوع، ولكل نشاط نجمتان. تتجدد الأنشطة كل أسبوع.</p><div class="talaact">${x.act.map(([ic, t, d], i) => { const on = !!A[actKey(k, i)]; return `<label class="talaa${on ? " on" : ""}"><input type="checkbox" data-act="talaact" data-k="${k}" data-i="${i}"${on ? " checked" : ""}><i>${ic}</i><b>${esc(t)}</b><span>${esc(d)}</span></label>`; }).join("")}</div>`; };
  const gamesFor = k => STG[k] ? STG[k].g.map(g => GAMES.find(x => x[0] === g)).filter(Boolean) : GAMES;
  // أذكار المسلم اليومية (بنصوصها الثابتة ومصادرها) — لعبة مطابقة المناسبة بالذكر
  const ADH = [["قبل الطعام", "بسم الله", "متفق عليه"], ["بعد الطعام", "الحمد لله الذي أطعمني هذا ورزقنيه من غير حول مني ولا قوة", "أبو داود والترمذي"], ["عند النوم", "باسمك اللهم أموت وأحيا", "البخاري"], ["عند الاستيقاظ", "الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور", "البخاري"],
    ["دخول الخلاء", "اللهم إني أعوذ بك من الخبث والخبائث", "متفق عليه"], ["الخروج من الخلاء", "غفرانك", "أبو داود والترمذي"], ["الخروج من المنزل", "بسم الله توكلت على الله، ولا حول ولا قوة إلا بالله", "أبو داود والترمذي"], ["دخول المسجد", "اللهم افتح لي أبواب رحمتك", "مسلم"],
    ["الخروج من المسجد", "اللهم إني أسألك من فضلك", "مسلم"], ["عند العطاس", "الحمد لله", "البخاري"], ["بعد الوضوء", "أشهد أن لا إله إلا الله وحده لا شريك له، وأشهد أن محمدًا عبده ورسوله", "مسلم"], ["عند الغضب", "أعوذ بالله من الشيطان الرجيم", "متفق عليه"]];
  function adhkar(k) {
    if (G.i >= G.list.length) { star(G.s >= G.list.length - 1 ? 3 : 1); return view_(head("أذكار المسلم", true) + `<div class="talawin"><h2>أحسنت! 🎉</h2><p>عرفت ${toAr(G.s)} من ${toAr(G.list.length)} أذكار.</p><a class="btn p" href="#/talaea/games?g=adhkar&k=${k || ""}&r=${Date.now()}">جولة جديدة</a></div></div>`); }
    const q = G.list[G.i], opts = shuffle([q, ...shuffle(ADH.filter(x => x !== q)).slice(0, G.n - 1)]);
    view_(head("أذكار المسلم", true) + `<p class="mut">السؤال ${toAr(G.i + 1)} من ${toAr(G.list.length)}</p><p class="talaq">ماذا نقول <b>${esc(q[0])}</b>؟</p><div class="talao col">${opts.map(o => `<button class="btn talaopt" data-act="tala-ad" data-ok="${o === q ? 1 : 0}">${esc(o[1])}</button>`).join("")}</div><div id="tfb" class="talafb" hidden></div></div>`);
  }
  // مسابقة المعرفة لكل مرحلة (اختيار من متعدد)
  const QZ = {
    t1: [["كم عدد الصلوات المفروضة في اليوم والليلة؟", "خمس", "ثلاث", "سبع"], ["ما أول سورة في المصحف؟", "الفاتحة", "البقرة", "الناس"], ["من خاتم الأنبياء والرسل؟", "محمد ﷺ", "عيسى عليه السلام", "موسى عليه السلام"], ["ماذا نقول قبل الطعام؟", "بسم الله", "سبحان الله", "الله أكبر"], ["في أي شهر نصوم؟", "رمضان", "شعبان", "رجب"], ["ماذا يقول من عطس؟", "الحمد لله", "بسم الله", "أستغفر الله"], ["إلى أين نتوجه في الصلاة؟", "الكعبة", "الجبل", "الشمس"], ["كم عدد أركان الإسلام؟", "خمسة", "ثلاثة", "عشرة"], ["ما اسم أم النبي ﷺ؟", "آمنة بنت وهب", "خديجة", "فاطمة"], ["من الذي خلقنا؟", "الله", "الشمس", "القمر"]],
    t2: [["كم عدد سور القرآن الكريم؟", "١١٤", "١٠٠", "١٢٠"], ["ما أطول سورة في القرآن؟", "البقرة", "آل عمران", "النساء"], ["ما أقصر سورة في القرآن؟", "الكوثر", "الإخلاص", "العصر"], ["في أي مدينة وُلد النبي ﷺ؟", "مكة", "المدينة", "الطائف"], ["إلى أي مدينة هاجر النبي ﷺ؟", "المدينة", "مكة", "دمشق"], ["من النبي الذي التقمه الحوت؟", "يونس عليه السلام", "نوح عليه السلام", "صالح عليه السلام"], ["من النبي الذي صنع السفينة بأمر الله؟", "نوح عليه السلام", "هود عليه السلام", "شعيب عليه السلام"], ["كم ركعة في صلاة الفجر؟", "ركعتان", "ثلاث", "أربع"], ["ما الركن الخامس من أركان الإسلام؟", "الحج", "الصوم", "الزكاة"], ["كم عدد أركان الإيمان؟", "ستة", "خمسة", "أربعة"]],
    t3: [["من أول خليفة للمسلمين بعد النبي ﷺ؟", "أبو بكر الصديق", "عمر بن الخطاب", "عثمان بن عفان"], ["في أي سنة من الهجرة كانت غزوة بدر؟", "الثانية", "الخامسة", "الثامنة"], ["من مؤذن رسول الله ﷺ المشهور؟", "بلال بن رباح", "سلمان الفارسي", "أنس بن مالك"], ["أي سورة تعدل ثلث القرآن؟", "الإخلاص", "الفاتحة", "يس"], ["ما أول ما نزل من القرآن؟", "اقرأ باسم ربك الذي خلق", "الفاتحة", "المدثر"], ["من الصحابي الملقّب بأمين هذه الأمة؟", "أبو عبيدة بن الجراح", "خالد بن الوليد", "الزبير بن العوام"], ["من النبي الذي كلّمه الله تكليمًا؟", "موسى عليه السلام", "إبراهيم عليه السلام", "داود عليه السلام"], ["كم عدد الأنبياء المذكورين بأسمائهم في القرآن؟", "خمسة وعشرون", "عشرة", "مئة"], ["من صاحب «صحيح البخاري»؟", "محمد بن إسماعيل البخاري", "مسلم بن الحجاج", "مالك بن أنس"], ["من كلّفه أبو بكر بجمع القرآن في الصحف؟", "زيد بن ثابت", "معاذ بن جبل", "أبي بن كعب"]],
    t4: [["ما أقسام التوحيد الثلاثة؟", "الربوبية والألوهية والأسماء والصفات", "الصلاة والزكاة والصيام", "الإيمان والإسلام والإحسان"], ["ما شرطا قبول العمل الصالح؟", "الإخلاص لله ومتابعة النبي ﷺ", "كثرة العمل وطوله", "شهرة العامل"], ["من مؤلف «العقيدة الواسطية»؟", "ابن تيمية", "النووي", "ابن كثير"], ["من مؤلف «الأربعين النووية»؟", "يحيى بن شرف النووي", "ابن حجر", "الذهبي"], ["ما معنى «لا إله إلا الله»؟", "لا معبود بحق إلا الله", "لا خالق إلا الله فقط", "لا رازق إلا الله فقط"], ["أي حديث يُعدّ أصل النيات؟", "«إنما الأعمال بالنيات»", "«الدين النصيحة»", "«لا ضرر ولا ضرار»"], ["ما كتاب الإمام الشافعي في أصول الفقه؟", "الرسالة", "الموطأ", "المسند"], ["من الأئمة الأربعة المتبوعون؟", "أبو حنيفة ومالك والشافعي وأحمد", "البخاري ومسلم وأبو داود والترمذي", "أبو بكر وعمر وعثمان وعلي"], ["في أي حادثة كانت بيعة الرضوان؟", "صلح الحديبية", "فتح مكة", "غزوة أحد"], ["من مؤلف «كتاب التوحيد الذي هو حق الله على العبيد»؟", "محمد بن عبد الوهاب", "ابن القيم", "الآجري"]]
  };
  function quiz(k) {
    if (G.i >= G.list.length) { star(G.s >= 8 ? 3 : G.s >= 5 ? 2 : 1); return view_(head("مسابقة المعرفة", true) + `<div class="talawin"><h2>انتهت المسابقة 🎉</h2><p>أجبت ${toAr(G.s)} من ${toAr(G.list.length)} إجابة صحيحة.</p><a class="btn p" href="#/talaea/games?g=quiz&k=${k}&r=${Date.now()}">مسابقة جديدة</a></div></div>`); }
    const [q, a, ...w] = G.list[G.i];
    view_(head("مسابقة المعرفة — " + ((D.tracks.find(t => t[0] === k) || [])[1] || ""), true) + `<p class="mut">السؤال ${toAr(G.i + 1)} من ${toAr(G.list.length)}</p><p class="talaq">${esc(q)}</p><div class="talao col">${shuffle([a, ...w]).map(o => `<button class="btn talaopt" data-act="tala-qz" data-ok="${o === a ? 1 : 0}">${esc(o)}</button>`).join("")}</div><div id="tfb" class="talafb" hidden></div></div>`);
  }
  // البحث عن الكلمات: شبكة حروف، تختار الحرف الأول ثم الأخير للكلمة (أفقيًّا من اليمين أو عموديًّا من الأعلى)
  const WSW = { t2: [["أركان الإسلام", ["شهادة", "صلاة", "زكاة", "صيام", "حج"]], ["الصلوات", ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"]], ["الأنبياء", ["نوح", "هود", "صالح", "يونس", "موسى", "عيسى"]]],
    t3: [["الخلفاء والصحابة", ["بكر", "عمر", "عثمان", "علي", "بلال", "خالد", "حمزة"]], ["مكارم الأخلاق", ["الصدق", "الأمانة", "الحلم", "الكرم", "الصبر", "العدل"]], ["الأنبياء", ["ابراهيم", "اسماعيل", "يوسف", "داود", "سليمان", "يحيى"]]],
    t4: [["كتب السنة", ["البخاري", "مسلم", "الترمذي", "النسائي", "الموطأ"]], ["أعلام", ["الشافعي", "مالك", "احمد", "النووي", "الذهبي", "ابن", "تيمية"]], ["العلوم", ["التفسير", "الحديث", "الفقه", "النحو", "العقيدة"]]] };
  function wsNew(k) {
    const sets = WSW[k] || WSW.t2, [title, words] = sets[Math.floor(Math.random() * sets.length)], N = k === "t2" ? 8 : 10, g = Array.from({ length: N }, () => Array(N).fill("")), placed = [];
    for (const w of shuffle(words)) { const L = [...w]; for (let t = 0; t < 200; t++) { const v = Math.random() < .5, r = Math.floor(Math.random() * (v ? N - L.length + 1 : N)), c = Math.floor(Math.random() * (v ? N : N - L.length + 1));
      if (L.every((ch, i) => { const x = g[v ? r + i : r][v ? c : c + i]; return !x || x === ch; })) { L.forEach((ch, i) => g[v ? r + i : r][v ? c : c + i] = ch); placed.push({ w, r, c, v, n: L.length }); break; } } }
    const AL = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي"; g.forEach(row => row.forEach((x, i) => { if (!x) row[i] = AL[Math.floor(Math.random() * AL.length)]; }));
    G = { g, placed, found: [], sel: null, k, title, N };
    wsDraw();
  }
  function wsDraw() {
    const { g, placed, found, N, title, k } = G, on = new Set(); placed.filter(p => found.includes(p.w)).forEach(p => { for (let i = 0; i < p.n; i++) on.add((p.v ? p.r + i : p.r) * N + (p.v ? p.c : p.c + i)); });
    view_(head("البحث عن الكلمات", true) + `<p class="talaq">${esc(title)}: ابحث عن الكلمات (أفقيًّا من اليمين أو عموديًّا من الأعلى). اضغط الحرف الأول ثم الأخير.</p>
      <div class="talaws" style="--n:${N}">${g.map((row, r) => row.map((ch, c) => `<button class="wsc${on.has(r * N + c) ? " ok" : ""}${G.sel && G.sel[0] === r && G.sel[1] === c ? " sel" : ""}" data-act="tala-ws" data-r="${r}" data-c="${c}">${ch}</button>`).join("")).join("")}</div>
      <div class="chips">${placed.map(p => `<span class="chip${found.includes(p.w) ? " x" : ""}">${esc(p.w)}${found.includes(p.w) ? " ✓" : ""}</span>`).join("")}</div>
      ${found.length === placed.length ? `<div class="talawin"><h2>وجدت كل الكلمات! 🎉</h2><a class="btn p" href="#/talaea/games?g=ws&k=${k}&r=${Date.now()}">شبكة جديدة</a></div>` : ""}</div>`);
  }
  const sname = s => esc(s.name.replace(/^سُورَةُ\s*/, ""));
  function ayahRound(s, i, sc) {
    const cand = s.ayat.map((a, j) => [j, a]).filter(([, a]) => a.split(" ").length >= 3);
    if (!G || G.s !== s.n || i === 0) G = { s: s.n, list: shuffle(cand).slice(0, Math.min(6, cand.length)), sc: 0 };
    if (i >= G.list.length) { star(G.sc); return view_(head("أكمل الآية", true) + `<div class="talawin"><h2>أحسنت! 🎉</h2><p>أجبت ${toAr(G.sc)} من ${toAr(G.list.length)} في سورة ${sname(s)}، وحصلت على ${toAr(G.sc)} نجوم.</p><a class="btn p" href="#/talaea/games?g=ayah&s=${s.n}&r=${Date.now()}">العب مرة أخرى</a> <a class="btn" href="#/talaea/games?g=ayah">سورة أخرى</a></div></div>`); }
    const [j, a] = G.list[i], ws = a.split(" "), last = ws.pop(), ends = [...new Set(s.ayat.map(x => x.split(" ").pop()).filter(w => w !== last))];
    const opts = shuffle([last, ...shuffle(ends).slice(0, 2)]);
    view_(head("أكمل الآية — سورة " + sname(s), true) + `<p class="mut">السؤال ${toAr(i + 1)} من ${toAr(G.list.length)}</p><p class="talaq quran">${esc(ws.join(" "))} <span class="blank">……</span></p>
      <div class="talao">${opts.map(o => `<button class="btn talaopt" data-act="tala-ay" data-v="${esc(o)}" data-ok="${o === last ? 1 : 0}" data-i="${i}" data-s="${s.n}">${esc(o)}</button>`).join("")}</div><div id="tfb" class="talafb" hidden></div></div>`);
    G.full = a;
  }
  function orderRound(s) {
    const n = Math.min(4, s.ayat.length), st0 = Math.floor(Math.random() * (s.ayat.length - n + 1)), seg = s.ayat.slice(st0, st0 + n).map((t, k) => ({ t, k }));
    G = { s, seg, pick: [] };
    view_(head("رتّب الآيات — سورة " + sname(s), true) + `<p>اضغط على الآيات بترتيبها في المصحف (من الآية ${toAr(st0 + 1)}):</p><div class="talao col">${shuffle(seg).map(x => `<button class="btn talaopt quran" data-act="tala-or" data-k="${x.k}">${esc(x.t)}</button>`).join("")}</div><ol id="tord" class="quran"></ol><div id="tfb" class="talafb" hidden></div></div>`);
  }
  function tfRound() {
    if (G.i >= G.fs.length) { star(G.s); return view_(head("صح أم خطأ؟", true) + `<div class="talawin"><h2>انتهت الجولة 🎉</h2><p>أجبت ${toAr(G.s)} من ${toAr(G.fs.length)} إجابة صحيحة.</p><a class="btn p" href="#/talaea/games?g=tf&r=${Date.now()}">جولة جديدة</a></div></div>`); }
    const f = G.fs[G.i];
    view_(head("صح أم خطأ؟", true) + `<p class="mut">السؤال ${toAr(G.i + 1)} من ${toAr(G.fs.length)}</p><p class="talaq">${esc(f.q)}</p><div class="talao"><button class="btn talaopt" data-act="tala-tf" data-v="1">✅ صح</button><button class="btn talaopt" data-act="tala-tf" data-v="0">❌ خطأ</button></div><div id="tfb" class="talafb" hidden></div></div>`);
  }
  function memory(k) {
    const L = shuffle("ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("")).slice(0, k === "t1" ? 4 : k === "t3" ? 8 : 6), cards = shuffle([...L, ...L]);
    G = { cards, open: [], done: 0, moves: 0 };
    view_(head("ذاكرة الحروف", true) + `<p>اقلب بطاقتين في كل مرة، وطابق الحرفين المتشابهين.</p><div class="talamem">${cards.map((c, i) => `<button class="mcard" data-act="tala-mem" data-i="${i}" aria-label="بطاقة ${toAr(i + 1)}"><span>${c}</span></button>`).join("")}</div><p class="mut" id="tmv">المحاولات: ٠</p></div>`);
  }
  // التأسيس اللغوي للمراحل الأولى: الحرف بالحركات الثلاث والسكون والتنوين
  const HN = [["َ", "الفتحة"], ["ُ", "الضمة"], ["ِ", "الكسرة"], ["ْ", "السكون"], ["ً", "تنوين الفتح"], ["ٌ", "تنوين الضم"], ["ٍ", "تنوين الكسر"]];
  const LN = { ب: "الباء", ت: "التاء", ث: "الثاء", ج: "الجيم", ح: "الحاء", خ: "الخاء", د: "الدال", ذ: "الذال", ر: "الراء", ز: "الزاي", س: "السين", ش: "الشين", ص: "الصاد", ض: "الضاد", ط: "الطاء", ظ: "الظاء", ع: "العين", غ: "الغين", ف: "الفاء", ق: "القاف", ك: "الكاف", ل: "اللام", م: "الميم", ن: "النون", ه: "الهاء", و: "الواو", ي: "الياء" };
  function harakat() {
    if (G.i >= 10) { star(G.s >= 8 ? 3 : 1); return view_(head("حروف وحركات", true) + `<h2 class="talat">انتهت الجولة!</h2><p>أصبت ${toAr(G.s)} من ${toAr(10)} ⭐</p><a class="btn p" href="#/talaea/games?g=harakat&r=${Date.now()}">جولة جديدة</a></div>`); }
    const L = shuffle(Object.keys(LN))[0], hs = shuffle(HN.slice(0, G.i < 5 ? 3 : 7)).slice(0, 3), want = hs[0];
    G.want = want[0];
    view_(head("حروف وحركات", true) + `<p class="mut">السؤال ${toAr(G.i + 1)} من ${toAr(10)}</p><p class="talaq">اختر <b>${LN[L]}</b> مع <b>${want[1]}</b></p>
      <div class="talao harak">${shuffle(hs).map(h => `<button class="btn talaopt big" data-act="tala-hk" data-v="${h[0]}">${L}${h[0]}</button>`).join("")}</div><div id="tfb" hidden></div></div>`);
  }
  function wordRound() {
    if (G.i >= G.ws.length) { star(G.s >= 7 ? 3 : 1); return view_(head("ركّب الكلمة", true) + `<h2 class="talat">أحسنت!</h2><p>ركّبت ${toAr(G.s)} من ${toAr(G.ws.length)} كلمات ⭐</p><a class="btn p" href="#/talaea/games?g=word&r=${Date.now()}">كلمات أخرى</a></div>`); }
    const [full, bare] = G.ws[G.i]; G.pick = ""; G.bare = bare;
    view_(head("ركّب الكلمة", true) + `<p class="mut">الكلمة ${toAr(G.i + 1)} من ${toAr(G.ws.length)} — من سور جزء عمّ</p><p class="talaq quran">${esc(full)}</p><p>اضغط الحروف بالترتيب لتكتب الكلمة:</p>
      <p class="talaq" id="wpick">…</p><div class="talao">${shuffle([...bare].map((c, k) => [c, k])).map(([c, k]) => `<button class="btn talaopt big" data-act="tala-wd" data-c="${c}">${c}</button>`).join("")}</div><div id="tfb" hidden></div></div>`);
  }
  const fb = (ok, html) => { const el = $("#tfb"); el.hidden = false; el.className = "talafb " + (ok ? "ok" : "no"); el.innerHTML = html; };
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=tala-]"); if (!el) return; e.preventDefault(); e.stopImmediatePropagation(); const a = el.dataset.act;
    if (a === "tala-ay") {
      document.querySelectorAll(".talaopt").forEach(b => b.disabled = true); const ok = el.dataset.ok === "1"; if (ok) G.sc++;
      el.classList.add(ok ? "right" : "wrong");
      fb(ok, `${ok ? "إجابة صحيحة! ⭐" : "حاول مرة أخرى في الجولة القادمة."}<p class="quran">﴿${esc(G.full)}﴾</p><button class="btn p" data-act="tala-next" data-i="${+el.dataset.i + 1}" data-s="${el.dataset.s}">التالي</button>`);
    } else if (a === "tala-next") { quran().then(Qs => ayahRound(Qs.find(x => x.n === +el.dataset.s), +el.dataset.i, 0)); }
    else if (a === "tala-or") {
      const k = +el.dataset.k, want = G.pick.length;
      if (k === want) { G.pick.push(k); el.disabled = true; el.classList.add("right"); $("#tord").insertAdjacentHTML("beforeend", `<li>${esc(G.seg[k].t)}</li>`);
        if (G.pick.length === G.seg.length) { star(2); fb(true, `ممتاز! رتّبت الآيات ترتيبًا صحيحًا ⭐⭐<br><a class="btn p" href="#/talaea/games?g=order&s=${G.s.n}&r=${Date.now()}">آيات أخرى</a> <a class="btn" href="#/talaea/games?g=order">سورة أخرى</a>`); } }
      else { el.classList.add("wrong"); setTimeout(() => el.classList.remove("wrong"), 600); }
    } else if (a === "tala-tf") {
      const f = G.fs[G.i], ok = (el.dataset.v === "1") === !!f.a; if (ok) G.s++;
      document.querySelectorAll(".talaopt").forEach(b => b.disabled = true);
      fb(ok, `${ok ? "أحسنت! ⭐" : "ليست صحيحة."} ${f.a ? "المعلومة صحيحة." : "المعلومة خاطئة."}${f.why ? `<p>${esc(f.why)}</p>` : ""}<button class="btn p" data-act="tala-tfn">التالي</button>`);
    } else if (a === "tala-tfn") { G.i++; tfRound(); }
    else if (a === "tala-hk") { const ok = el.dataset.v === G.want; if (ok) { G.s++; star(1); } document.querySelectorAll(".talaopt").forEach(b => b.disabled = true); el.classList.add(ok ? "right" : "wrong");
      fb(ok, `${ok ? "أحسنت! ⭐" : "ليست هذه؛ انظر إلى الحركة فوق الحرف أو تحته."}<button class="btn p" data-act="tala-hkn">التالي</button>`); }
    else if (a === "tala-hkn") { G.i++; harakat(); }
    else if (a === "tala-wd") { const c = el.dataset.c, need = G.bare[G.pick.length];
      if (c === need) { G.pick += c; el.disabled = true; el.classList.add("right"); $("#wpick").textContent = G.pick;
        if (G.pick === G.bare) { G.s++; star(1); fb(true, `أحسنت! ⭐ <button class="btn p" data-act="tala-wdn">التالي</button>`); } }
      else { el.classList.add("wrong"); setTimeout(() => el.classList.remove("wrong"), 500); } }
    else if (a === "tala-wdn") { G.i++; wordRound(); }
    else if (a === "tala-ad" || a === "tala-qz") { const ok = el.dataset.ok === "1"; if (ok) { G.s++; } document.querySelectorAll(".talaopt").forEach(b => { b.disabled = true; if (b.dataset.ok === "1") b.classList.add("right"); }); if (!ok) el.classList.add("wrong");
      const q = G.list[G.i]; fb(ok, `${ok ? "أحسنت! ⭐" : "الإجابة الصحيحة مظللة."}${a === "tala-ad" ? `<p><b>${esc(q[0])}:</b> «${esc(q[1])}» <small class="mut">(${esc(q[2])})</small></p>` : ""}<button class="btn p" data-act="${a}n">التالي</button>`); }
    else if (a === "tala-adn") { G.i++; adhkar(new URLSearchParams(location.hash.split("?")[1] || "").get("k")); }
    else if (a === "tala-qzn") { G.i++; quiz(new URLSearchParams(location.hash.split("?")[1] || "").get("k") || "t2"); }
    else if (a === "tala-ws") { const r = +el.dataset.r, c = +el.dataset.c;
      if (!G.sel) { G.sel = [r, c]; return wsDraw(); }
      const [r0, c0] = G.sel; G.sel = null;
      const hit = G.placed.find(p => !G.found.includes(p.w) && ((p.r === r0 && p.c === c0 && (p.v ? (r === p.r + p.n - 1 && c === p.c) : (r === p.r && c === p.c + p.n - 1)))));
      if (hit) { G.found.push(hit.w); star(1); } wsDraw(); }
    else if (a === "tala-mem") {
      const i = +el.dataset.i; if (el.classList.contains("on") || G.open.length === 2) return;
      el.classList.add("on"); G.open.push(i);
      if (G.open.length === 2) { G.moves++; $("#tmv").textContent = "المحاولات: " + toAr(G.moves); const [x, y] = G.open, bs = document.querySelectorAll(".mcard");
        if (G.cards[x] === G.cards[y]) { bs[x].classList.add("ok"); bs[y].classList.add("ok"); G.open = []; G.done++; if (G.done === G.cards.length / 2) { const s = G.moves <= 9 ? 3 : G.moves <= 14 ? 2 : 1; star(s); $("#tmv").innerHTML = `أحسنت! أنهيتها في ${toAr(G.moves)} محاولة، ولك ${toAr(s)} نجوم ⭐ <a class="btn s" href="#/talaea/games?g=memory&r=${Date.now()}">العب مرة أخرى</a>`; } }
        else setTimeout(() => { bs[x].classList.remove("on"); bs[y].classList.remove("on"); G.open = []; }, 800); }
    }
  }, true);
  // ---------- الإدارة ----------
  async function admin() {
    await load(true);
    return `<p class="mut">أسماء المسارات، وأسئلة «صح أم خطأ» مع شرحها، وكتب كل مسار (بمعرّفات الكتب في المكتبة). تأكد من صحة كل معلومة ومناسبتها للأطفال قبل الحفظ.</p>
     <form data-form="talasave"><h3>المسارات العمرية</h3>${D.tracks.map(([k, n, a], i) => `<div class="row"><input name="tn${i}" value="${esc(n)}" aria-label="اسم المسار"><input name="ta${i}" value="${esc(a)}" aria-label="العمر"><input name="tb${i}" value="${esc(((D.books || {})[k] || []).join(" "))}" placeholder="معرّفات الكتب مفصولة بمسافة" aria-label="كتب المسار"></div>`).join("")}
     <h3>أسئلة «صح أم خطأ» (${toAr((D.facts || []).length)})</h3><p class="mut">سطر لكل سؤال بالصيغة: المعلومة | صح أو خطأ | الشرح</p>
     <textarea name="facts" rows="12" style="width:100%">${esc((D.facts || []).map(f => [f.q, f.a ? "صح" : "خطأ", f.why || ""].join(" | ")).join("\n"))}</textarea>
     <h3>استبعاد من سُلّم القراءة</h3><p class="mut">معرّفات مقالات أو كتب لا تناسب الأطفال (مفصولة بمسافة)؛ يُعاد بناء السلم آليًا (tools/tala-curate.py) بعد الحفظ.</p><textarea name="hide" rows="2" style="width:100%">${esc((D.planHide || []).join(" "))}</textarea>
     <div class="savebar"><button class="btn p">حفظ</button> <span id="talast" class="mut"></span></div></form>`;
  }
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=talasave]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f), stt = $("#talast"); stt.textContent = "جارٍ الحفظ…";
    const tracks = D.tracks.map(([k], i) => [k, String(fd.get("tn" + i) || "").trim() || D.tracks[i][1], String(fd.get("ta" + i) || "").trim()]);
    const books = {}; D.tracks.forEach(([k], i) => { const v = String(fd.get("tb" + i) || "").split(/\s+/).filter(x => x && B(x)); if (v.length) books[k] = v; });
    const facts = String(fd.get("facts") || "").split("\n").map(l => l.split("|").map(s => s.trim())).filter(p => p[0] && /^(صح|خطأ)$/.test(p[1] || "")).map(p => ({ q: p[0], a: p[1] === "صح", why: p[2] || "" }));
    try { await GH.editJSON(P, o => ({ v: 1, tracks, facts, books, planHide: String(fd.get("hide") || "").split(/\s+/).filter(Boolean) }), "الطلائع: المسارات والأسئلة (" + facts.length + ")"); stt.textContent = "حُفظ ✓"; D = null; } catch (err) { stt.textContent = "تعذر الحفظ: " + err.message; }
  }, true);
  // ---------- سُلّم القراءة وملفات الأطفال وركن الوالدين ----------
  let PL = null, PLc = null;
  const plan = async () => PL || (PL = await fetch("data/tala-plan.json").then(r => r.ok ? r.json() : { tracks: {} }).catch(() => ({ tracks: {} })));
  const kids = () => (st().kids = st().kids || []);
  const kid = () => kids().find(x => x.id === st().cur) || kids()[0] || null;
  const prog = () => { const k = kid(), id = k ? k.id : "_"; st().p = st().p || {}; return st().p[id] = st().p[id] || { done: {}, notes: {}, mins: 0 }; };
  const keyOf = it => it.a ? "a:" + it.a : "b:" + it.b + ":" + it.p;
  const itTitle = it => { if (it.a) { const b = B(it.a); return b ? b.title : null; } const b = B(it.b); return b ? (b.setTitle || b.title) + " — ص " + toAr(it.p) + (it.q > it.p ? "–" + toAr(it.q) : "") : null; };
  const itHref = it => it.a ? "#/book/" + encodeURIComponent(it.a) + "/1" : "#/book/" + encodeURIComponent(it.b) + "/" + it.p;
  const levelsOf = async k => ((await plan()).tracks[k] || []).map(l => l.filter(it => itTitle(it))).filter(l => l.length);
  const ratio = l => l.filter(it => prog().done[keyOf(it)]).length / l.length;
  async function todayCard() {
    const k = kid(); const tk = k ? k.track : null;
    const prof = `<div class="talakids">${kids().map(x => `<button class="talakid${k && x.id === k.id ? " on" : ""}" data-act="talakid" data-id="${x.id}">${esc(x.av || "🙂")} ${esc(x.name)}</button>`).join("")}<button class="talakid add" data-act="talakidnew">+ طفل</button></div>`;
    if (!k) return `<h3>من يقرأ اليوم؟</h3>${prof}<p class="mut">أنشئ ملفًا لكل طفل (على هذا الجهاز فقط) ليحفظ تقدمه ونجومه في سُلّم القراءة.</p>`;
    const L = await levelsOf(tk); let next = null;
    for (const l of L) { next = l.find(it => !prog().done[keyOf(it)]); if (next) break; }
    return `<h3>قراءة اليوم</h3>${prof}${next ? `<div class="talac today"><b>📖 ${esc(itTitle(next))}</b><span>نحو ${toAr(next.m || 5)} ${(next.m || 5) <= 10 ? "دقائق" : "دقيقة"} • مرحلة ${esc((D.tracks.find(t => t[0] === tk) || [])[1] || "")}</span><div class="row"><a class="btn p" href="${itHref(next)}">اقرأ الآن</a><button class="btn" data-act="taladone" data-k="${esc(keyOf(next))}" data-m="${next.m || 5}">أنهيتها ✓</button></div></div>` : '<p class="note">أتممت سُلّم مرحلتك كله! اختر المرحلة التالية من ركن الوالدين. 🎉</p>'}`;
  }
  async function ladder(k, q) {
    const t = D.tracks.find(x => x[0] === k) || D.tracks[0], L = await levelsOf(t[0]), unlock = !!st().unlock;
    let open = true;
    const lv = L.map((l, i) => { const r = ratio(l), isOpen = open || unlock; if (r < 0.75) open = false;
      return `<details class="talalv${r >= 1 ? " done" : ""}"${isOpen && r < 1 && (i === 0 || ratio(L[i - 1]) >= 0.75) ? " open" : ""}><summary><b>المستوى ${toAr(i + 1)}</b> ${r >= 1 ? "🏅" : isOpen ? "" : "🔒"} <span class="mut">${toAr(Math.round(r * 100))}٪ • نحو ${toAr(l.reduce((s, x) => s + (x.m || 5), 0))} دقيقة</span></summary>
        ${isOpen ? l.map(it => { const d = prog().done[keyOf(it)]; return `<div class="talait${d ? " ok" : ""}"><a href="${itHref(it)}">${it.a ? "📰" : "📖"} ${esc(itTitle(it))}</a><span class="mut">${toAr(it.m || 5)} د</span>${d ? `<span>✓${prog().notes[keyOf(it)] ? " 💭" : ""}</span>` : `<button class="btn s" data-act="taladone" data-k="${esc(keyOf(it))}" data-m="${it.m || 5}">أنهيتها</button>`}</div>`; }).join("") : '<p class="mut">يُفتح بعد إتمام ثلاثة أرباع المستوى السابق.</p>'}</details>`; }).join("");
    view_(head(t[1] + " — سُلّم القراءة", true) + `<h2 class="talat">📚 سُلّم القراءة: ${esc(t[1])}</h2><p class="mut">${esc(t[2])}. ${t[0] === "t1" ? "في هذه المرحلة يقرأ الوالد للطفل ويحاوره فيما قرأ." : "اقرأ ثم اضغط «أنهيتها» واكتب ما تعلمته لتربح النجوم."}</p>
      ${kid() ? `<p>القارئ: <b>${esc(kid().av || "🙂")} ${esc(kid().name)}</b></p>` : `<p class="note">أنشئ ملفًا للطفل من صفحة الطلائع الرئيسية ليُحفظ تقدمه.</p>`}
      <nav class="chips">${D.tracks.map(([x, n]) => `<a class="chip${x === t[0] ? " x" : ""}" href="#/talaea/ladder?k=${x}">${esc(n)}</a>`).join("")}</nav>
      ${lv || '<div class="note">يُبنى سُلّم هذه المرحلة قريبًا.</div>'}</div>`);
  }
  async function parents() {
    const P_ = await plan(), k = kid();
    const rows = kids().map(x => { const p = (st().p || {})[x.id] || { done: {}, notes: {}, mins: 0 }, n = Object.keys(p.done).length;
      return `<div class="talait"><b>${esc(x.av || "🙂")} ${esc(x.name)}</b><span class="mut">${esc((D.tracks.find(t => t[0] === x.track) || [])[1] || "")} • ${toAr(n)} قراءة • ${toAr(p.mins || 0)} دقيقة</span>
        <select data-act="talatrack" data-id="${x.id}">${D.tracks.map(([t, nm]) => `<option value="${t}"${t === x.track ? " selected" : ""}>${esc(nm)}</option>`).join("")}</select><button class="btn s" data-act="talakiddel" data-id="${x.id}">حذف الملف</button></div>
        ${Object.entries(p.notes).slice(-8).map(([kk, v]) => `<p class="mut talanote">💭 «${esc(v)}» — ${esc(itTitle(kk.startsWith("a:") ? { a: kk.slice(2) } : { b: kk.split(":")[1], p: +kk.split(":")[2] }) || "")}</p>`).join("")}`; }).join("");
    view_(head("ركن الوالدين", true) + `<h2 class="talat">👪 ركن الوالدين</h2>
      <h3>منهجية القراءة</h3><div class="card talameth">${esc(P_.method || "").split("\n").map(l => `<p>${l.trim()}</p>`).join("")}<p>يُفتح كل مستوى بعد إتمام ثلاثة أرباع ما قبله، والقراءة اليومية القصيرة المنتظمة خير من الطويلة المتقطعة؛ ويحسن أن يحاور الوالد الطفل فيما قرأ وأن يطّلع على تأملاته أدناه.</p></div>
      <label class="inl"><input type="checkbox" data-act="talaunlock"${st().unlock ? " checked" : ""}> فتح كل المستويات (يقرر الوالد)</label>
      <h3>متابعة الأطفال</h3>${rows || '<p class="mut">لا ملفات أطفال بعد.</p>'}
      <h3>مقالات في تربية الأبناء</h3><div class="list">${(P_.parents || []).map(id => B(id)).filter(Boolean).reverse().slice(0, 20).map(bookCard).join("")}</div>
      <p class="note">كل بيانات الأطفال (الأسماء والتقدم والتأملات) محفوظة على هذا الجهاز وحده، ولا تُرسل إلى أي جهة.</p></div>`);
  }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act^=tala]"); if (!el) return; const a = el.dataset.act;
    if (a === "talakidnew") { const name = (prompt("اسم الطفل:") || "").trim().slice(0, 20); if (!name) return; const age = +prompt("عمره بالسنوات:", "8") || 8;
      const track = age <= 7 ? "t1" : age <= 10 ? "t2" : age <= 13 ? "t3" : "t4", AV = ["🦁", "🐢", "🦉", "🐬", "🌟", "🚀", "🌷", "🦋"];
      const x = { id: Date.now().toString(36), name, track, av: AV[kids().length % AV.length] }; kids().push(x); st().cur = x.id; saveS(); show({}, ""); }
    else if (a === "talakid") { st().cur = el.dataset.id; saveS(); show({}, ""); }
    else if (a === "talakiddel") { if (confirm("حذف ملف الطفل وتقدمه من هذا الجهاز؟")) { st().kids = kids().filter(x => x.id !== el.dataset.id); if (st().p) delete st().p[el.dataset.id]; saveS(); parents(); } }
    else if (a === "talaunlock") { st().unlock = el.checked; saveS(); }
    else if (a === "talaact") { const A = st().act = st().act || {}, key = actKey(el.dataset.k, el.dataset.i); if (el.checked) { A[key] = 1; star(2); } else delete A[key]; saveS(); el.closest(".talaa").classList.toggle("on", el.checked); }
    else if (a === "taladone") { const k = el.dataset.k; if (prog().done[k]) return;
      const note = (prompt("أحسنت! ما أهم شيء تعلمته مما قرأت؟ (اختياري)") || "").trim().slice(0, 200);
      prog().done[k] = Date.now(); prog().mins = (prog().mins || 0) + (+el.dataset.m || 5); if (note) prog().notes[k] = note; star(note ? 3 : 2); saveS();
      toast(note ? "⭐⭐⭐ ثلاث نجوم! تأمل جميل." : "⭐⭐ نجمتان!"); route(); }
  });
  document.addEventListener("change", e => { const el = e.target.closest("[data-act=talatrack]"); if (!el) return; const x = kids().find(y => y.id === el.dataset.id); if (x) { x.track = el.value; saveS(); toast("تغيّرت المرحلة."); } });

  return { view: show, admin };
})();
