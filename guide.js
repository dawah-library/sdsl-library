/* زرّا الإرشاد (البند ٢١): زر سحابي عائم يجيب «أين أجد…؟» و«كيف أفعل…؟».
   - للأعضاء والزوار: دليل خدمات المكتبة كلها (من ABOUT_SECS) مع رابط الصفحة.
   - للمدير: يضاف إليه دليل مهام الإدارة (ADMIN_HOWTO) بخطوات مختصرة ورابط مباشر.
   البحث محلي في المتصفح (فوري ومجاني)، مع ترتيب بالكلمات والمرادفات. ويُخفى الزر أو يُظهر من القائمة (ls guide_off)،
   وتوقفه الإدارة للجميع من «الخدمات والمفاتيح» (guide_btn). */
const GUIDE = (() => {
  const ADMIN_HOWTO = [
    ["إضافة كتاب نصي", "الإدارة ← إضافة كتاب: الصق النص أو ارفع الملف، واختر المؤلف والقسم.", "#/admin?t=book", "رفع كتاب جديد نص"],
    ["إضافة كتاب مصور (PDF) وتحويله إلى نص", "الإدارة ← كتاب مصور: ارفع الملف فيُحوَّل آليًا ويظهر بعد المراجعة.", "#/admin?t=pdf", "تحويل ocr مصور pdf"],
    ["كتاب متعدد المجلدات: إضافة مجلد أو حذفه", "الإدارة ← إدارة المحتوى ← كتاب متعدد المجلدات.", "#/admin?t=vols", "مجلد مجلدات حذف مجلد"],
    ["إخفاء مادة أو نقلها أو حذفها أو ترتيبها", "الإدارة ← إدارة المحتوى ← إدارة المواد: صفِّ ثم اختر الإجراء؛ كل تعديل في السجل ويمكن التراجع.", "#/admin?t=items", "حذف اخفاء نقل ترتيب كتاب مقال"],
    ["دمج المكرر وتوحيد المؤلفين", "الإدارة ← التكرار والتوحيد.", "#/admin?t=dups", "تكرار مكرر دمج مؤلف"],
    ["مراجعة ما استُجلب من المصادر", "الإدارة ← مراجعة المستجلب.", "#/admin?t=imports", "استيراد استجلاب فيسبوك مصادر"],
    ["إيقاف خدمة أو مهمة آلية، وإظهار الإحصاءات أو إخفاؤها", "الإدارة ← الخدمات والمفاتيح.", "#/admin?t=switches", "ايقاف تشغيل مفاتيح خدمات احصاءات اخفاء"],
    ["سجل التعديلات والتراجع", "الإدارة ← سجل التعديلات.", "#/admin?t=log", "تراجع سجل"],
    ["تعديل أسماء الأقسام وترتيبها", "الإدارة ← الأقسام والأسماء.", "#/admin?t=struct", "اقسام ترتيب اسماء تصنيف"],
    ["مراجعة التحويل ومواضع الشك", "الإدارة ← مراجعة التحويل.", "#/admin?t=review", "مراجعة تدقيق شك"],
    ["متابعة إنجاز الكتب وحالة النشر", "الإدارة ← متابعة إنجاز الكتب، وحالة النشر والتحويل.", "#/admin?t=prog", "انجاز حالة نشر"],
    ["تصحيحات القراء", "الإدارة ← تصحيحات القراء: اقبل أو رُدّ بعد المطابقة على المصورة.", "#/admin?t=corr", "تصحيح اخطاء"],
    ["اعتماد التشكيل", "الإدارة ← التشكيل: راجع ثم «اعتماد العرض».", "#/admin?t=tashkeel", "تشكيل"],
    ["الصوتيات: الطابور والمراجعة والاعتماد", "الإدارة ← الصوتيات والراديو.", "#/admin?t=audio", "صوت صوتيات راديو تسجيل"],
    ["إشعار عام لكل الأعضاء", "الإدارة ← إشعار للأعضاء.", "#/admin?t=notify", "اشعار تنبيه رسالة عامة"],
    ["رسائل الأعضاء ومراقبة المجتمع", "الإدارة ← رسائل الأعضاء، ومراقبة المجتمع.", "#/admin?t=msgs", "رسائل مجتمع مراقبة"],
    ["حسابات المشايخ والمراسلة الخاصة", "الإدارة ← حسابات المشايخ والمراسلة.", "#/admin?t=sheikhs", "شيخ مشايخ مراسلة"],
    ["منح عضو صلاحية (تنزيل النص، الكراسات، التحويل، التشجير)", "صفحة صلاحيات التفويض: ابحث عن العضو وعلّم الصلاحية.", "#/perms", "صلاحية تفويض اذن"],
    ["إنشاء تحدي قراءة", "تحدي القراءة ← «تحدٍّ جديد»: الكتب والمدة وأقل مدة على الصفحة.", "#/challenges", "تحدي مسابقة"],
    ["إعلان قراءة جماعية أو اعتماد طلب", "القراءة الجماعية ← «ابدأ»، أو افتح الطلب ← «اعتماد وإعلان».", "#/groups", "قراءة جماعية"],
    ["إحصاءات المكتبة وسجل قراءة الأعضاء", "صفحة الإحصاءات (وفيها سجل الأعضاء للإدارة).", "#/stats", "احصاءات مشاهدة قراءة"],
    ["رفع غلاف كتاب", "افتح الكتاب ← بطاقة الكتاب ← «رفع صورة الغلاف».", "", "غلاف صورة"],
    ["صورة المؤلف", "صفحة المؤلف ← تعديل الصورة (للإدارة).", "#/authors", "صورة مؤلف"],
    ["الكراسات: اختيار الكتب وطلبات الأعضاء", "الكراسات ← تبويب الإدارة.", "#/kurrasat", "كراسة كراسات"],
    ["التشجير: إضافة كتاب إلى الطابور واعتماده", "تشجير الكتب ← إدارة.", "#/tashjir", "تشجير خريطة ذهنية"],
    ["حفظ المتون: إضافة متن وتحديد نطاقه", "حفظ المتون ← تبويب الإدارة.", "#/hifz?t=admin", "متن متون حفظ"],
    ["الاختبارات والمجلة والإصدارات والطلائع", "الإدارة ← اختبارات الكتب / مجلة المكتبة / جديد الإصدارات / الطلائع.", "#/admin?t=quizzes", "اختبار مجلة اصدارات طلائع اطفال"],
  ];
  const SYN = [["كتاب", "كتب مكتبة"], ["بحث", "ابحث ابحث عن"], ["حذف", "ازالة امسح احذف"], ["صوت", "صوتيات استماع اسمع"], ["حفظ", "احفظ حفظ"], ["تنزيل", "تحميل تصدير نزل حمل"], ["مؤلف", "شيخ كاتب"], ["سؤال", "اسئلة جواب"]];
  const nz = s => norm(String(s || "")).replace(/[^ء-يa-z0-9\s]/gi, " ");
  const items = () => {
    const l = [];
    (typeof ABOUT_SECS !== "undefined" ? ABOUT_SECS : []).forEach(([sec, its]) => its.forEach(([n, d, r]) => { const rt = String(r || "").split(/\s+/)[0]; l.push({ t: n, d, u: rt ? "#/" + rt : "", s: sec }); }));
    if (isAdmin()) ADMIN_HOWTO.forEach(([t, d, u, k]) => l.push({ t, d, u, s: "للإدارة", k, adm: 1 }));
    return l;
  };
  const STOP = new Set("اين اجد كيف افعل ما هو هي في من الى على عن او ثم هل اريد ابحث اعرف".split(" "));
  const st = x => { x = x.replace(/^(وال|بال|فال|كال|لل|ال)(?=..)/, ""); if (x.length > 4) x = x.replace(/^و(?=...)/, ""); if (x.length > 4) x = x.replace(/(ات|ون|ين|ها|ه)$/, ""); return x; };
  const toks = s => nz(s).split(/\s+/).filter(x => x.length > 1 && !STOP.has(x)).map(st);
  function find(q) {
    const w = [...new Set(toks(q))]; if (!w.length) return [];
    // كل كلمة من السؤال ومرادفاتها بدائل متكافئة، فـ«تنزيل» تطابق «التصدير» كما تطابق نفسها
    const alts = w.map(x => { const g = SYN.find(([a, b]) => [a, ...b.split(" ")].map(st).includes(x)); return g ? [...new Set([x, ...[g[0], ...g[1].split(" ")].map(st)])] : [x]; });
    const hit = (arr, x) => arr.some(t => t === x || (x.length >= 3 && t.startsWith(x)) || (t.length >= 3 && x.startsWith(t)));
    const L = items().map(it => ({ it, T: toks(it.t), D: toks(it.d + " " + (it.k || "")) })), N = L.length;
    const idf = alts.map(g => Math.log(1 + N / (1 + L.filter(r => g.some(x => hit(r.T, x) || hit(r.D, x))).length))); // الكلمة النادرة أثقل وزنًا
    return L.map(({ it, T, D }) => { let sc = 0;
      alts.forEach((g, i) => { sc += (g.some(x => hit(T, x)) ? 3 : g.some(x => hit(D, x)) ? 1 : 0) * idf[i]; });
      if (it.adm && sc) sc += 1; return [sc, it]; })
      .filter(x => x[0] >= 1.5).sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
  }
  const off = () => { try { return localStorage.getItem("guide_off") === "1"; } catch (e) { return false; } };
  async function mount() {
    if (document.getElementById("gdbtn")) return; const sw = await swx(); if (sw.guide_btn === false && !isAdmin()) return;
    const b = document.createElement("button"); b.id = "gdbtn"; b.type = "button"; b.setAttribute("aria-label", "دليل الموقع: أين أجد…؟"); b.title = "دليل الموقع";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9"/><path d="M9.5 13.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.1"/><path d="M12 21h.01"/></svg>';
    b.hidden = off(); b.onclick = open; document.body.appendChild(b);
  }
  function open() {
    const adm = isAdmin(), sugg = adm ? ["كيف أحذف مجلدًا؟", "أين إيقاف الخدمات؟", "كيف أمنح صلاحية؟", "رفع كتاب مصور"] : ["أين أجد الكراسات؟", "كيف أحفظ متنًا؟", "تنزيل كتاب", "القراءة الجماعية"];
    openSheet(adm ? "دليل الإدارة والموقع" : "دليل الموقع", `<p class="mut">${adm ? "اسأل عن أي مهمة إدارية أو خدمة: أين أجدها وكيف أفعلها." : "اسأل عن أي خدمة في المكتبة وأين تجدها."}</p>
      <input id="gdq" type="search" placeholder="مثل: ${esc(sugg[0])}" autocomplete="off" aria-label="سؤالك"><div class="chips" style="margin:8px 0">${sugg.map(x => `<button class="chip" data-gq="${esc(x)}">${esc(x)}</button>`).join("")}</div><div id="gdr"></div>
      <p class="mut" style="font-size:.8rem;margin-top:10px">لا تجد ما تريد؟ <a href="#/about" data-act="closeSheet">كل خدمات المكتبة</a>${Auth.user ? ' • <a href="#/ask" data-act="closeSheet">اسأل المكتبة عن مسألة علمية</a>' : ""} • <button class="lnk" data-act="gdhide">إخفاء هذا الزر</button></p>`, () => {
      const inp = $("#gdq"), run = () => { const r = find(inp.value); $("#gdr").innerHTML = inp.value.trim() ? (r.length ? r.map(it => `<a class="bk gdi" href="${it.u || "javascript:void 0"}" data-act="closeSheet"><b>${esc(it.t)} ${it.adm ? '<em class="tag">للإدارة</em>' : ""}</b><p>${esc(it.d)}</p><span class="mut">${esc(it.s)}${it.u ? " • انتقل ←" : ""}</span></a>`).join("") : '<p class="mut">لم أجد خدمة بهذا الوصف. جرّب كلمة أخرى.</p>') : ""; };
      inp.oninput = run; $("#sheetB").addEventListener("click", e => { const c = e.target.closest("[data-gq]"); if (c) { inp.value = c.dataset.gq; run(); } }); inp.focus();
    });
  }
  function toggle(show) { try { localStorage.setItem("guide_off", show ? "0" : "1"); } catch (e) { } const b = document.getElementById("gdbtn"); if (b) b.hidden = !show; if (!show) toast("أُخفي زر الدليل. أظهره من القائمة: الأقسام ← دليل الموقع."); }
  document.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (!a) return; if (a.dataset.act === "gdhide") { closeSheet(); toggle(false); } else if (a.dataset.act === "gdshow") { toggle(true); open(); } });
  setTimeout(mount, 2500);
  return { open, find, toggle };
})();
