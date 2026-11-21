/* فرق الأقسام: يمنح المدير عضوًا فريقَ قسمٍ أو أكثر (المجلة، الصوتيات، التفريغات، الكتب…)، فيملك صلاحيات ذلك القسم وحده:
   أدواته وملفاته (يقصرها الخادم api/gh على مسارات القسم)، وتشغيل مهامه الآلية وإيقافها (مفاتيحه في data/switches.json فقط)،
   ورفع طلبات تطوير القسم ومتابعتها (data/dev-requests.json بحالة «await» حتى يأذن المدير فينفذها المساعد التقني).
   المنح في profiles.perms: علامة الفريق t_<القسم> مع صلاحياته الموسعة (لتعمل سياسات قاعدة البيانات has_perm كما هي).
   هذا الملف يُحمَّل في المتصفح وفي الخادم (require) فتبقى التعريفات واحدة. صفحة العضو: #/myteams. */
(function (G) {
  const TEAMS = [
    { k: "majalla", n: "فريق المجلة", d: "تحرير أعداد مجلة المكتبة وركنها الإخباري وإخراجها.", perms: ["majalla"], sw: ["majalla_news"], pages: [["#/majalla", "مجلة المكتبة"]] },
    { k: "audio", n: "فريق الصوتيات والإذاعة", d: "رفع الكتب الصوتية والتسجيلات، وطابور التحويل إلى صوت، وجدول البث الإذاعي.", perms: ["audio_upload", "radio"], sw: ["tts"], pages: [["#/audio", "صوتيات المكتبة"], ["#/radio", "راديو المكتبة"]] },
    { k: "tafrigh", n: "فريق التفريغات", d: "رفع التفريغات: الملفات المصورة (PDF) والنصية، والتسجيلات الصوتية والمرئية لتفريغها، ومتابعة تنسيقها وصفّها.", perms: ["tafrigh_upload"], sw: ["edit"], pages: [["#/admin", "رفع التفريغات والتسجيلات"], ["#/tafrighat", "التفريغات"], ["#/tahrir", "تنسيق التفريغ"], ["#/saff", "صف التفريغ"]] },
    { k: "books", n: "فريق الكتب والتدقيق", d: "رفع الكتب والمصورات، وتعديل النصوص وتصحيحها، ومراجعة التحويل واعتماد اقتراحات التدقيق.", perms: ["upload", "edit", "convert", "kutub_review", "export_text"], sw: ["ocr", "tashkeel", "review", "proof_auto", "edition", "cards"], pages: [["#/admin", "رفع الكتب ومراجعة التحويل"], ["#/proof", "تدقيق الكتب"]] },
    { k: "study", n: "فريق الدراسة والكراسات", d: "الكراسات والتشجير والاختبارات والاختصارات.", perms: ["kurrasa", "tashjir"], sw: ["tashjir", "study_ai", "edu_ai"], pages: [["#/kurrasat", "الكراسات"], ["#/tashjir", "التشجير"], ["#/quizzes", "الاختبارات"], ["#/summary", "الاختصارات"]] },
    { k: "translate", n: "فريق الترجمة", d: "مراجعة الترجمات واعتمادها، واللغات والمسرد وطابور الترجمة.", perms: ["translate", "translate_admin"], sw: ["translate", "i18n"], pages: [["#/tr", "الترجمة"]] },
    { k: "video", n: "فريق الفيديو", d: "توليد فيديوهات مراجعات الكتب واعتمادها.", perms: ["video"], sw: [], pages: [["#/video", "مراجعات الكتب بالفيديو"]] },
    { k: "tala", n: "فريق الطلائع", d: "قسم الأطفال: المحتوى والقصص واعتماد إجابات التمارين.", perms: ["tala"], sw: ["tala_qasas"], pages: [["#/talaea", "الطلائع"]] },
    { k: "ai", n: "فريق المساعد العلمي", d: "إعدادات المساعد العلمي ومصادره ونماذجه، ومتابعة «العقل المتعلّم».", perms: ["ask_cfg", "ask_vision", "ask_web", "ask_models"], sw: ["ask_review", "ask_expand", "ask_groq", "brain", "brain_learn"], pages: [["#/ask", "المساعد العلمي"], ["#/brain", "العقل المتعلّم"]] }
  ];
  const by = k => TEAMS.find(t => t.k === k);
  const teamsOf = perms => (perms || []).filter(p => /^t_/.test(p)).map(p => by(p.slice(2))).filter(Boolean);
  // الصلاحيات الفعلية: الممنوحة مفردة مع صلاحيات الفرق
  const expand = perms => [...new Set((perms || []).concat(...teamsOf(perms).map(t => t.perms)))];
  const switchesOf = perms => [...new Set([].concat(...teamsOf(perms).map(t => t.sw)))];
  // إضافة فريق أو إزالته من مصفوفة الصلاحيات: الإزالة لا تمس صلاحية يشملها فريق آخر باقٍ
  function toggle(perms, k, on) {
    const t = by(k); if (!t) return perms || [];
    let p = (perms || []).filter(x => x !== "t_" + k);
    if (on) return [...new Set(p.concat("t_" + k, t.perms))];
    const keep = new Set([].concat(...teamsOf(p).map(x => x.perms)));
    return p.filter(x => !t.perms.includes(x) || keep.has(x));
  }
  const API = { TEAMS, by, teamsOf, expand, switchesOf, toggle };
  G.SECTEAMS = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof document === "undefined") return;

  /* ———— صفحة «أقسامي» (#/myteams): ما يملكه العضو من فرق الأقسام ———— */
  const RAWD = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/data/" + p + "?t=" + Date.now();
  const rj = async p => { for (const u of [RAWD(p), "data/" + p + "?t=" + Date.now()]) { try { const r = await fetch(u, { cache: "no-store" }); if (r.ok) return await r.json(); } catch (e) { } } return null; };
  const mine = () => isAdmin() ? TEAMS : teamsOf(Cloud.perms || []);
  const SWN = { majalla_news: "الركن الإخباري للمجلة (كل ثلاث ساعات)", tts: "تحويل النص إلى صوت", edit: "خدمة التنسيق وإعادة الصياغة", ocr: "تحويل الكتب المصورة إلى نص", tashkeel: "التشكيل", review: "مراجعة الصفحات", proof_auto: "تطبيق تصحيحات التدقيق الصغيرة", edition: "ربط كتب التراث بمصورات طبعاتها", cards: "بطاقات تعريف الكتب",
    tashjir: "تشجير الكتب", study_ai: "الاختبارات والاختصارات", edu_ai: "الكراسات وتجهيز التفريغات", translate: "الترجمة السياقية وترجمة الصفحات", i18n: "ترجمة الأسماء والعناوين للواجهة", tala_qasas: "قصص القدوات للطلائع",
    ask_review: "المراجعة اللغوية لأجوبة المساعد", ask_expand: "توسيع صيغ البحث", ask_groq: "محرك Groq البديل", brain: "العقل المتعلّم: القراءة والتعلّم", brain_learn: "حفظ الأسئلة والتقييم للتعلّم" };
  const ST = { await: "بانتظار إذن المدير", pending: "بانتظار التنفيذ", doing: "قيد التنفيذ", review: "نُفّذ وينتظر اعتماد المدير", approved: "معتمد", done: "نُفِّذ", need: "يحتاج توضيحًا", rejected: "لم يُنفَّذ" };
  async function view0(q) {
    if (!Auth.user) return view('<div class="note">سجّل الدخول. <a href="#/account">الدخول</a></div>');
    const T = mine(); if (!T.length) return view('<div class="note">لست عضوًا في فريق قسم بعد. يمنح المدير فرق الأقسام من صفحة <b>صلاحيات التفويض</b>.</div>');
    view('<p class="mut" style="padding:24px;text-align:center">جارٍ التحميل…</p>');
    const [sw, dr] = await Promise.all([rj("switches.json"), rj("dev-requests.json")]), S = (sw && sw.s) || {}, R = (dr && dr.items) || [];
    const cur = q.t && by(q.t) && T.includes(by(q.t)) ? by(q.t) : T[0];
    view(`<section class="myteams"><h1>${ic("users-round", 24)} أقسامي</h1><p class="mut">أنت ${isAdmin() ? "المدير: ترى فرق الأقسام كلها" : "عضو في " + T.map(t => "«" + esc(t.n) + "»").join(" و")}. لكل فريق أدوات قسمه، وتشغيل مهامه الآلية وإيقافها، وطلبات تطويره ومتابعتها.</p>
      <div class="chips">${T.map(t => `<a class="chip${t === cur ? " on" : ""}" href="#/myteams?t=${t.k}">${esc(t.n)}</a>`).join("")}</div>
      <article class="mtcard"><h2>${esc(cur.n)}</h2><p>${esc(cur.d)}</p>
       <h3>أدوات القسم</h3><div class="hubg">${cur.pages.map(([u, n]) => `<a class="happ" href="${u}${u === "#/admin" && cur.k === "tafrigh" ? "?t=tafrigh" : ""}"><span class="hai">${ic("compass", 26)}</span><b>${esc(n)}</b></a>`).join("")}</div>
       <h3>المهام الآلية للقسم</h3>${cur.sw.length ? `<div class="mtsw">${cur.sw.map(k => `<label class="inl"><input type="checkbox" data-mtsw="${k}"${S[k] === false ? "" : " checked"}> ${esc(SWN[k] || k)}</label>`).join("")}</div><p class="mut">الإيقاف يسري خلال دقائق؛ ولا تتأثر مهام الأقسام الأخرى.</p>` : '<p class="mut">لا مهام آلية مستقلة لهذا القسم.</p>'}
       <h3>طلبات تطوير القسم ومتابعته</h3>
       <form data-form="mtreq" data-k="${cur.k}" class="card"><textarea name="t" rows="3" required maxlength="3000" placeholder="اكتب ما يحتاجه القسم: تطوير، إصلاح خلل، محتوى، مهمة تشغيلية…"></textarea>
        <div class="row"><select name="kd"><option value="feature">تطوير أو إضافة</option><option value="fix">إصلاح خلل</option><option value="content">محتوى وبيانات</option><option value="ops">مهمة تشغيلية</option></select><select name="p"><option value="2">عادي</option><option value="1">عاجل</option><option value="3">لاحقًا</option></select><button class="btn p s">أرسل الطلب</button></div>
        <p class="mut">يصل الطلب إلى المدير، فإذا أذن نفّذه المساعد التقني ثم عرض النتيجة على المدير قبل النشر.</p><span class="mut" id="mtst"></span></form>
       <div id="mtl">${R.filter(x => x.sec === cur.k).reverse().map(x => `<div class="stsec"><b>${esc(ST[x.st] || x.st)}</b> <span class="mut">${esc(new Date(x.at).toLocaleString("ar-EG"))}</span><p style="white-space:pre-line">${esc(String(x.t).slice(0, 900))}</p>${x.r ? `<div class="note" style="white-space:pre-line">${esc(x.r)}</div>` : ""}${(x.h || []).length > 1 ? `<details><summary>المتابعات (${toAr(x.h.length)})</summary>${x.h.map(h => `<p><b>${h.by === "agent" ? "الوكيل" : h.by === "admin" ? "المدير" : "الفريق"}</b>: ${esc(h.m)}</p>`).join("")}</details>` : ""}<form data-form="mtfu" data-id="${esc(x.id)}" data-k="${cur.k}" class="row"><input name="a" placeholder="متابعة أو توضيح…" required><button class="btn s">أضف</button></form></div>`).join("") || '<p class="mut">لا طلبات لهذا القسم بعد.</p>'}</div></article></section>`);
  }
  const save = (path, fn, msg) => { if (typeof GH === "undefined" || !(GH.on || GH.proxied)) throw new Error("الحفظ غير متاح لحسابك الآن"); return GH.editJSON(path, fn, msg); };
  document.addEventListener("change", async e => { const c = e.target.closest("[data-mtsw]"); if (!c) return; const k = c.dataset.mtsw, on = c.checked;
    try { await save("data/switches.json", o => { o = o || {}; o.s = o.s || {}; if (on) delete o.s[k]; else o.s[k] = false; return o; }, (on ? "تشغيل" : "إيقاف") + " مهمة قسم: " + k); toast(on ? "شُغّلت" : "أُوقفت"); } catch (x) { c.checked = !on; toast(x.message || String(x)); } });
  document.addEventListener("submit", async e => {
    const f = e.target.closest('[data-form="mtreq"],[data-form="mtfu"]'); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    const k = f.dataset.k, now = new Date().toISOString(), who = isAdmin() ? "admin" : "team";
    try {
      if (f.dataset.form === "mtreq") { const t = f.t.value.trim(); if (!t) return; const st = $("#mtst"); if (st) st.textContent = "جارٍ الإرسال…";
        await save("data/dev-requests.json", o => { o = o && o.items ? o : { items: [] }; o.items.push({ id: "d" + Date.now().toString(36), sec: k, t: "[" + by(k).n + "] " + t, k: f.kd.value, p: +f.p.value, del: 0, st: isAdmin() ? "pending" : "await", at: now, eng: "auto", auto: 0, by: who, h: [{ at: now, by: who, m: t }] }); return o; }, "طلب من " + by(k).n + ": " + t.slice(0, 50));
        toast(isAdmin() ? "أُرسل للتنفيذ" : "أُرسل إلى المدير");
      } else { const a = f.a.value.trim(); if (!a) return;
        await save("data/dev-requests.json", o => { const x = (o.items || []).find(y => y.id === f.dataset.id && y.sec === k); if (x) { (x.h = x.h || []).push({ at: now, by: who, m: a }); } return o; }, "متابعة طلب قسم: " + by(k).n); toast("أُضيفت المتابعة"); }
      view0({ t: k });
    } catch (x) { toast(x.message || String(x)); }
  }, true);
  G.SECTEAMS.view = q => view0(q || {});
})(typeof globalThis !== "undefined" ? globalThis : this);
