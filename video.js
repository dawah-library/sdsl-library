/* فيديوهات الكتب (#/video): ملخص الكتاب ومراجعته في فيديو بمشاهد وراوٍ (tools/book-video.py ← video.yml).
   إعداد المدير ومن فوّضه (صلاحية video): نمط الفيديو — نمط أو أكثر يُجمع بينها (ملخص، مراجعة، فوائد، سرد، أسئلة شائعة، مختارات، تعريف ترويجي، درس)، والمدة بالدقائق
   أو بعدد المشاهد، والجمهور، وأسلوب الإلقاء، والموضوعات المختارة من فهرس الكتاب، والأفكار المطلوبة، والافتتاح والختام، والأبعاد والصوت والسمة
   والخط والزخرفة والترجمة النصية؛ ثم «توليد مباشر» أو «إعداد النص أولًا» (مونتاج: تعديل المشاهد وترتيبها وحذفها وإضافتها ومدة كل مشهد
   قبل الإخراج)، أو «✨ إبداع من الموقع». ولا يُنشر الفيديو إلا بعد الاعتماد، ويُشارك برابطه أو يُنزَّل. */
const VIDX = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + p;
  const getj = async (p, d) => { try { const r = await fetch(RAW(p) + "?t=" + Math.floor(Date.now() / 60e3)); return r.ok ? await r.json() : d; } catch (e) { return d; } };
  const GONE = new Set();  // ما حُذف في هذه الجلسة لا يعود بسبب تأخر نسخة raw المخزنة
  let LIST = null; const list = async f => (LIST && !f) ? LIST : (LIST = await getj("data/video/_list.json", {}));
  // على نطاق الموقع يُقدَّم الفيديو عبر الممر /au/v/ (functions/au) بنوع video/mp4؛ لأن رابط GitHub المباشر يُرسَل كمرفق فلا يعمل على iPhone
  const PROXY = () => /dawahlibrary\.org$|\.pages\.dev$/.test(location.hostname);
  const url = (bid, f) => PROXY() ? location.origin + "/au/v/" + bid + "/" + f : "https://github.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/releases/download/video-" + bid + "/" + f;
  const dl = (bid, f) => PROXY() ? url(bid, f) + "?dl=1" : url(bid, f);
  const fmt = s => toAr(Math.floor(s / 60)) + ":" + toAr(String(s % 60).padStart(2, "0"));
  const may = () => isAdmin() || can("video");
  const OPT = {
    style: [["summary", "ملخص الكتاب"], ["review", "مراجعة وأسئلة"], ["benefits", "أبرز الفوائد والدروس"], ["story", "سرد قصصي متسلسل"], ["faq", "أسئلة شائعة وأجوبتها"], ["quotes", "مختارات من أقوال المؤلف"], ["intro", "تعريف ترويجي قصير"], ["lesson", "درس تعليمي مبسط"], ["features", "مميزات الكتاب ومنهجه"], ["critique", "قراءة نقدية منصفة"], ["part", "الحديث عن جزء أو باب منه"]],
    min: [["2", "دقيقتان"], ["4", "٤ دقائق"], ["6", "٦ دقائق"], ["10", "١٠ دقائق"], ["15", "١٥ دقيقة"]],
    aud: [["general", "عموم المسلمين"], ["students", "طلاب العلم"], ["youth", "الشباب"], ["kids", "الأطفال"], ["women", "النساء والفتيات"]],
    tone: [["calm", "هادئ وقور"], ["warm", "دافئ مؤثر"], ["lively", "حيوي معتدل"], ["teach", "تعليمي مبسط"]],
    // المقاسات العالمية للمنصات: يُخرج الفيديو بكل مقاس مختار من النص نفسه (والتسجيل الصوتي يُعاد استعماله)
    aspect: [["16:9", "أفقي ١٦:٩ — يوتيوب وفيسبوك والشاشات (1920×1080)"], ["9:16", "ستوري ٩:١٦ — ستوري وريلز وشورتس وتيك توك (1080×1920)"], ["4:5", "طولي ٤:٥ — منشورات إنستغرام وفيسبوك (1080×1350)"], ["1:1", "مربع ١:١ — المنشورات وواتساب وX (1080×1080)"]],
    // نموذجان صوتيان فقط: أدق أصوات Gemini وأقربها إلى الإلقاء البشري
    voice: [["gemini:Charon", "Charon — رخيم واضح، إلقاء علمي هادئ"], ["gemini:Orus", "Orus — عميق متزن، إلقاء وعظي مؤثر"]],
    theme: [["green", "أخضر وذهبي"], ["gold", "ورقي دافئ"], ["night", "ليلي"], ["auto", "يختارها النموذج"]],
    font: [["amiri", "أميري (نسخ)"], ["ruqaa", "رقعة"], ["kufi", "كوفي"], ["readex", "حديث"]],
    pat: [["stars", "نجوم"], ["lines", "خطوط"], ["arch", "قوس"], ["none", "بلا زخرفة"]] };
  const checks = (n, d) => `<div class="vchips">${OPT[n].map(([v, t]) => `<label class="chip"><input type="checkbox" name="${n}" value="${v}"${d.includes(v) ? " checked" : ""}> ${t}</label>`).join("")}</div>`;
  const ASPL = a => ({ "16:9": "أفقي", "9:16": "ستوري", "4:5": "طولي", "1:1": "مربع" })[a] || a;
  // النمط قد يجمع عدة أنماط مفصولة بـ «+» (مثل summary+benefits)
  const styleName = s => String(s || "summary").split("+").map(k => (OPT.style.find(x => x[0] === k) || ["", ""])[1]).filter(Boolean).join(" + ") || "ملخص";
  // نماذج توليد الفيديو (tools/video-gen.py): [المعرّف، الوصف، التكلفة التقديرية $/ث]
  const GEN = [["local:auto", "خلفيات متحركة مجانية — تتناوب تلقائيًّا (زخرفة إسلامية، تدرج لوني، هالة ضوء، ورق عتيق)", 0], ["local:pattern", "زخرفة إسلامية منسابة (مجاني)", 0], ["local:aurora", "تدرج لوني متحرك (مجاني)", 0], ["local:light", "هالة ضوء هادئة (مجاني)", 0], ["local:paper", "ورق عتيق (مجاني، للسمة الورقية)", 0], ["none", "شرائح ثابتة بلا خلفية متحركة", 0], ["veo:veo-3.0-fast-generate-001", "Google Veo 3 Fast — جودة عالية وسرعة", 0.10], ["veo:veo-3.0-generate-001", "Google Veo 3 — أعلى جودة", 0.40],
    ["fal:fal-ai/kling-video/v2.1/standard/text-to-video", "Kling 2.1 (عبر fal.ai) — حركة سينمائية بتكلفة منخفضة", 0.05], ["fal:fal-ai/minimax/hailuo-02/standard/text-to-video", "Hailuo 02 (عبر fal.ai) — الأرخص", 0.045],
    ["fal:fal-ai/wan/v2.2-a14b/text-to-video", "Wan 2.2 (عبر fal.ai) — مفتوح المصدر", 0.08], ["fal:fal-ai/luma-dream-machine/ray-2-flash", "Luma Ray 2 Flash (عبر fal.ai)", 0.08]];
  const radios = (n, d) => `<div class="vchips">${OPT[n].map(([v, t]) => `<label class="chip"><input type="radio" name="${n}" value="${v}"${v === d ? " checked" : ""}> ${t}</label>`).join("")}</div>`;
  async function page(q) {
    const adm = may(), [L, DX] = await Promise.all([list(true), adm ? getj("data/video/drafts/_index.json", {}) : {}]), bid = q.b;
    if (q.d && adm) return montage(q.d, q.r);
    const vids = Object.entries(L).flatMap(([id, l]) => l.map((v, k) => Object.assign({ id, k }, v))).filter(v => (v.ok || adm) && (!bid || v.id === bid) && !GONE.has(v.f)).reverse();
    view(`<div class="cmhero"><div><h2>🎬 مراجعات الكتب بالفيديو</h2><p>استعراض الكتب في فيديوهات تعليمية: ملخصها، ومراجعتها، ومميزاتها ومنهجها، وقراءة نقدية منصفة لها، والحديث عن بعض أبوابها؛ تعدّها إدارة المكتبة ومن تفوّضه، للمشاهدة والتنزيل والمشاركة.</p></div></div>
      ${adm ? `<details class="card"${bid ? " open" : ""}><summary><b>＋ إعداد فيديو جديد</b></summary><form id="vidf" data-form="noop" class="vidform">
        <label>الكتاب أو المقال</label><input name="t" autocomplete="off" value="${esc(bid && B(bid) ? (B(bid).setTitle || B(bid).title) : "")}" placeholder="اكتب جزءًا من اسم الكتاب أو المقال ثم اختره" required><div id="vidsug" class="vidsug" hidden></div>
        <label>نمط الفيديو <span class="mut">(يمكن الجمع بين أكثر من نمط)</span></label>${checks("style", ["summary"])}
        <label>المدة بالدقائق (حرة، من دقيقة واحدة)</label><div class="row"><input name="min" type="number" min="1" max="60" step="0.5" value="4" style="max-width:140px" required><span id="vidrec" class="mut"></span></div><input name="scenes" type="number" min="1" max="40" placeholder="أو عدد المشاهد (اختياري)" style="max-width:220px">
        <label>الجمهور</label>${radios("aud", "general")}<label>أسلوب الإلقاء</label>${radios("tone", "calm")}
        <label>الموضوعات والأبواب (اختر من فهرس الكتاب، أو اتركها للكتاب كله)</label><div id="vidtoc" class="vchips"><span class="mut">اختر الكتاب أولًا</span></div><input name="topics2" placeholder="أو اكتب موضوعات أخرى مفصولة بفواصل">
        <label>الأفكار التي تريدها في الفيديو</label><textarea name="ideas" rows="3" placeholder="مثال: بيان حجية السنة، والرد على شبهة الاكتفاء بالقرآن، ونماذج من الواقع"></textarea>
        <div class="row"><div style="flex:1"><label>الافتتاح (اختياري)</label><input name="intro" placeholder="معنى يبدأ به الراوي"></div><div style="flex:1"><label>الختام (اختياري)</label><input name="outro" placeholder="معنى يختم به"></div></div>
        <label>مقاس الفيديو (اختر مقاسًا أو أكثر)</label>${checks("aspect", ["16:9"])}
        <label class="chk"><input type="checkbox" name="pages" checked> 📖 إظهار صفحات الكتاب أثناء العرض داخل الشريحة نفسها (بجوار النقاط، أو تحتها في الطولي): تنقلب الصفحة التي أُخذ منها المشهد (المصورة إن وُجدت) ويمر قلم التحديد على العبارة المقصودة</label>
        <label class="chk"><input type="checkbox" name="sfx" checked> 🔊 مؤثرات صوتية ناعمة: قلم التحديد وتقليب الصفحات وفواصل هادئة بين المشاهد (بلا موسيقى)</label>
        <details><summary>🎞️ اللقطات المولَّدة والانتقالات</summary><label>الخلفية المتحركة (المجانية أولًا؛ ونماذج التوليد المدفوعة اختيارية لاحقًا، بلا بشر ولا حيوانات)</label><select name="gen">${GEN.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select><p class="mut" id="vidgenc">مجاني بالكامل: يُولَّد على خوادم GitHub بلا مفاتيح ولا تكلفة، مع ظهور النقاط تباعًا مع كلام الراوي.</p>
          <label>الانتقال بين المشاهد</label><select name="trans">${[["auto", "متنوع تلقائيًّا (سلس)"], ["fade", "تلاشٍ"], ["dissolve", "ذوبان"], ["smoothleft", "انزلاق ناعم"], ["circleopen", "دائرة تنفتح"], ["fadegrays", "تلاشٍ رمادي"]].map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></details>
        <details><summary>المظهر والصوت</summary><label>الصوت</label>${radios("voice", "gemini:Charon")}<label>السمة</label>${radios("theme", "green")}<label>خط العناوين</label>${radios("font", "amiri")}<label>الزخرفة</label>${radios("pat", "stars")}
          <label class="chk"><input type="checkbox" name="cap" checked> إظهار نص الراوي على الشاشة (ترجمة نصية)</label></details>
        <label>متطلبات أخرى (اختياري)</label><textarea name="note" rows="2"></textarea>
        <div class="row"><button class="btn p" data-mode="draft">📝 إعداد النص أولًا للمراجعة والمونتاج</button><button class="btn" data-mode="direct">🎬 توليد مباشر</button><button class="btn" data-mode="creative">✨ إبداع من الموقع</button><span id="vidst" class="mut"></span></div></form></details>` : ""}
      ${adm ? await lexBox() : ""}
      ${adm && Object.keys(DX).filter(k => !DX[k].made).length ? `<div class="card"><h3>📝 مسودات بانتظار المونتاج</h3>${Object.entries(DX).filter(([, x]) => !x.made).reverse().slice(0, 20).map(([id, x]) => `<a class="bk" href="#/video?d=${encodeURIComponent(id)}"><b>${esc(x.t)}</b><span>${toAr(x.n)} مشهدًا • ${esc(x.at)}</span></a>`).join("")}</div>` : ""}
      ${bid ? `<p><a href="#/video">← كل الفيديوهات</a> <b>${esc((B(bid) || {}).title || bid)}</b></p>` : ""}
      <div class="vidgrid">${vids.map(v => `<div class="card vidc"><video controls preload="metadata" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : v.aspect === "1:1" ? ' class="sq"' : ""}></video><b>${esc(v.t)}</b><span class="mut">${esc(styleName(v.style))} • ${esc(ASPL(v.aspect || "16:9"))} • ${fmt(v.d || 0)} • ${esc((B(v.id) || {}).title || "")}${v.rev ? ` • <em class="tag">مصحَّح ${toAr(v.rev)}</em>` : ""}</span>
        <div class="row"><a class="btn s" href="#/book/${esc(v.id)}/1">📖 الكتاب</a><a class="btn s" href="${esc(dl(v.id, v.f))}" download="${esc(v.f)}">⬇ تنزيل</a><button class="btn s" data-act="vidshare" data-u="${esc(url(v.id, v.f))}" data-t="${esc(v.t)}">⤴ مشاركة</button>${adm ? `<button class="btn s ${v.ok ? "" : "p"}" data-act="vidok" data-b="${esc(v.id)}" data-k="${v.k}">${v.ok ? "إلغاء النشر" : "اعتماد ونشر"}</button>${v.ok ? "" : `<button class="btn s danger" data-act="viddel" data-b="${esc(v.id)}" data-f="${esc(v.f)}">🗑 حذف</button>`}${v.draft ? `<a class="btn s" href="#/video?d=${encodeURIComponent(v.draft)}">✂ تعديل وإعادة الإخراج</a>` : ""}` : ""}${v.ok ? "" : ' <em class="tag">بانتظار الاعتماد</em>'}</div>${adm && !v.ok && v.draft ? fixBox(v) : ""}</div>`).join("") || '<p class="note">لا فيديوهات منشورة بعد.</p>'}</div>`);
    const lb = document.getElementById("vlexgo"); if (lb) lb.onclick = async () => { const st = document.getElementById("vlexst"); st.textContent = "جارٍ الحفظ…";
      try { const words = lexParse(document.getElementById("vlex").value); await GH.editJSON("data/video/_lexicon.json", o => Object.assign(o || {}, { words }), "فيديو: قاموس النطق"); st.textContent = "✓ حُفظ (" + toAr(words.length) + ")"; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
    const f = document.getElementById("vidf"); if (!f) return;
    // البحث في كل كتب المكتبة ومقالاتها (لا قائمة مقطوعة): يطابق جزء الاسم مع توحيد الهمزات والتشكيل
    const TT = b => b.setTitle || b.title || "", KIND = b => ({ book: "كتاب", article: "مقال", fatwa: "فتوى", statement: "بيان" })[kindOf(b)] || "";
    let POOL = null, picked = bid && B(bid) ? B(bid) : null;
    const pool = () => POOL || (POOL = lib.books.filter(b => !b.demo && !VOL2(b) && TT(b)).map(b => [norm(TT(b)), b]));
    const bookOf = () => picked && TT(picked) === f.t.value.trim() ? picked : (pool().find(([, b]) => TT(b) === f.t.value.trim()) || [])[1];
    const sug = document.getElementById("vidsug");
    f.t.addEventListener("input", () => { const q = norm(f.t.value.trim()).replace(/\s+/g, " "); picked = null;
      if (q.length < 2) { sug.hidden = true; return; }
      const r = pool().filter(([n]) => n.includes(q)).sort((a, b) => (b[0].startsWith(q) - a[0].startsWith(q)) || (kindOf(a[1]) === "book" ? -1 : 0) - (kindOf(b[1]) === "book" ? -1 : 0) || a[0].length - b[0].length);
      sug.innerHTML = r.length ? r.slice(0, 40).map(([, b]) => `<button type="button" data-id="${esc(b.id)}"><b>${esc(TT(b))}</b><span class="mut">${esc(KIND(b))} • ${esc(A(b.authorId).name)}</span></button>`).join("") + (r.length > 40 ? `<p class="mut">و${toAr(r.length - 40)} نتيجة أخرى؛ زد في الاسم لتضييقها</p>` : "") : '<p class="mut">لا كتاب ولا مقال بهذا الاسم في المكتبة</p>';
      sug.hidden = false; });
    sug.addEventListener("click", e => { const x = e.target.closest("[data-id]"); if (!x) return; picked = B(x.dataset.id) || pool().find(([, b]) => b.id === x.dataset.id)[1]; f.t.value = TT(picked); sug.hidden = true; toc(); });
    const toc = async () => { const b = bookOf(), el = document.getElementById("vidtoc"); if (!b) return; el.innerHTML = '<span class="mut">جارٍ تحميل الفهرس…</span>';
      let T = []; try { const bb = await loadBook(b.id); T = (bb.toc || []).filter(x => x.t).slice(0, 80); } catch (e) { }
      el.innerHTML = T.length ? T.map(x => { const t = String(x.t).replace(/^#+\s*/, ""); return `<label class="chip"><input type="checkbox" name="topics" value="${esc(t)}"> ${esc(t.slice(0, 60))}</label>`; }).join("") : '<span class="mut">لا فهرس لهذا الكتاب؛ اكتب الموضوعات في الخانة.</span>'; };
    f.t.addEventListener("change", toc); if (bid) toc();
    // تناسب المدة مع حجم الكتاب: مدى مقترح (لا اختزال مخل ولا حشو)، والتكلفة التقديرية للقطات المولَّدة قبل الطلب
    const rec = () => { const b = bookOf(), el = document.getElementById("vidrec"); if (!b || !el) return; const n = b.set ? lib.books.filter(x => x.set === b.set).reduce((s, x) => s + (x.n || 0), 0) : (b.n || 1), lo = Math.max(1, Math.min(3, Math.round(n / 120))), hi = Math.max(lo + 1, Math.min(30, Math.round(n / 12))), m = +f.min.value || 0;
      el.innerHTML = `المقترح لحجم ${toAr(n)} صفحة: ${toAr(lo)}–${toAr(hi)} دقيقة${m && m < lo ? ' — <b class="warn">قصيرة: سيُقتصر على أهم الأفكار</b>' : m > hi ? ' — <b class="warn">طويلة على حجم الكتاب: قد لا تكفي مادته (لا حشو)</b>' : ""} • نحو ${toAr(Math.round(m * 130))} كلمة للراوي`; };
    const genc = () => { const g = f.gen.value, el = document.getElementById("vidgenc"); if (!el) return; const c = GEN.find(x => x[0] === g) || [], cl = Math.min(Math.ceil((+f.min.value || 4) * 1.6), 6);
      el.textContent = g === "none" || g.startsWith("local:") ? "مجاني بالكامل: يُولَّد على خوادم GitHub بلا مفاتيح ولا تكلفة، مع ظهور النقاط تباعًا مع كلام الراوي." : `تقديريًّا: حتى ${toAr(cl)} لقطات × ٨ ثوانٍ ≈ ${toAr((cl * 8 * c[2]).toFixed(1))}$ لكل مقاس (سقف ٤٨ ثانية مولَّدة للفيديو). يحتاج مفتاح المزوّد في أسرار GitHub.`; };
    f.min.addEventListener("input", () => { rec(); genc(); }); f.t.addEventListener("change", rec); f.gen.addEventListener("change", genc); if (bid) rec();
    f.addEventListener("submit", async e => { e.preventDefault(); const mode = (e.submitter && e.submitter.dataset.mode) || "draft", b = bookOf(), st = document.getElementById("vidst"); if (!b) return st.textContent = "اختر الكتاب أو المقال من نتائج البحث";
      const v = n => (f.querySelector(`[name=${n}]:checked`) || {}).value, topics = [...f.querySelectorAll("[name=topics]:checked")].map(x => x.value).concat(f.topics2.value.split(/[,،]/).map(x => x.trim()).filter(Boolean));
      const it = { id: b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : b.id, style: [...f.querySelectorAll("[name=style]:checked")].map(x => x.value).join("+"), min: f.min.value || "4", scenes: f.scenes.value || "", gen: f.gen.value, trans: f.trans.value, aud: v("aud"), tone: v("tone"), topics, ideas: f.ideas.value.trim(), intro: f.intro.value.trim(), outro: f.outro.value.trim(),
        aspects: [...f.querySelectorAll("[name=aspect]:checked")].map(x => x.value), pages: f.pages.checked ? 1 : 0, sfx: f.sfx.checked ? 1 : 0, voice: v("voice"), theme: mode === "creative" ? "auto" : v("theme"), font: v("font"), pat: mode === "creative" ? "" : v("pat"), cap: f.cap.checked ? 1 : 0, note: f.note.value.trim(), creative: mode === "creative" ? 1 : 0, phase: mode === "draft" ? "script" : "", at: new Date().toISOString() };
      if (!it.style) return st.textContent = "اختر نمطًا واحدًا على الأقل";
      if (!it.aspects.length) return st.textContent = "اختر مقاسًا واحدًا على الأقل";
      st.textContent = "جارٍ الإرسال…"; try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "فيديو: «" + f.t.value.trim() + "»");
        st.textContent = mode === "draft" ? "✓ يُعَدّ النص خلال دقائق ويظهر في «مسودات بانتظار المونتاج» لتعدّله ثم تخرجه." : "✓ أُضيف؛ يجهز الفيديو خلال دقائق ويظهر هنا بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
  }
  // تصحيح الفيديو قبل اعتماده: ملاحظات وتصحيحات نطق تُطبَّق على نص الفيديو نفسه ثم يُعاد إخراجه مكانه (لا فيديو جديد من الكتاب)
  const fixBox = v => `<details class="vfix"><summary>✎ تصحيحات وملاحظات قبل الاعتماد</summary><form data-form="noop" data-vfix="${esc(v.id)}" data-f="${esc(v.f)}" data-d="${esc(v.draft)}">
      <label>الملاحظات والتعديلات (ما يُغيَّر في الكلام أو العناوين أو النقاط أو ترتيب المشاهد)</label><textarea name="notes" rows="3" placeholder="مثال: في المشهد الثالث اذكر أن الكتاب للمبتدئين، واحذف المشهد الخامس، واجعل الخاتمة أقصر"></textarea>
      <label>تصحيح النطق (سطر لكل كلمة: الكلمة = نطقها مشكولًا) — يُحفظ في قاموس النطق لكل الفيديوهات</label><textarea name="lex" rows="2" placeholder="برهامي = بُرْهَامِي"></textarea>
      <div class="row"><button class="btn p s">تطبيق التصحيحات وإعادة الإخراج</button><a class="btn s" href="#/video?d=${encodeURIComponent(v.draft)}&r=${encodeURIComponent(v.f)}">✂ تعديل النص الكامل وإعادة الإخراج</a><span class="mut" data-st></span></div>
      <p class="mut">يُستعمل نص هذا الفيديو نفسه وتسجيلاته: لا يُعاد إلا صوت المشاهد التي تغيّرت، ويحل الفيديو المصحَّح محل هذا.</p></form></details>`;
  const lexParse = t => String(t || "").split("\n").map(x => x.split(/\s*[=←:]\s*/)).filter(x => x.length === 2 && x[0].trim() && x[1].trim()).map(x => [x[0].trim(), x[1].trim()]);
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-vfix]"); if (!f) return; e.preventDefault();
    const st = f.querySelector("[data-st]"), notes = f.notes.value.trim(), lex = lexParse(f.lex.value); if (!notes && !lex.length) return st.textContent = "اكتب ملاحظة أو تصحيح نطق";
    st.textContent = "جارٍ الإرسال…";
    try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push({ id: f.dataset.vfix, draft: f.dataset.d, replace: f.dataset.f, fix: { notes, lex }, at: new Date().toISOString() }); return o; }, "فيديو: تصحيحات قبل الاعتماد");
      st.textContent = "✓ أُرسلت؛ يظهر الفيديو المصحَّح مكان هذا خلال دقائق."; f.querySelector("button").disabled = true; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
  // قاموس النطق: كلمات وأسماء تُنطق بشكلها الصحيح في كل الفيديوهات (data/video/_lexicon.json)
  async function lexBox() {
    const L = await getj("data/video/_lexicon.json", { words: [] });
    return `<details class="card"><summary><b>🗣 قاموس النطق</b> <span class="mut">(${toAr((L.words || []).length)} كلمة)</span></summary><p class="mut">سطر لكل كلمة: الكلمة كما تُكتب = نطقها مشكولًا. يُطبَّق على كلام الراوي في كل الفيديوهات (لا على النص المعروض).</p>
      <textarea id="vlex" rows="6">${esc((L.words || []).map(([a, b]) => a + " = " + b).join("\n"))}</textarea><button class="btn s p" id="vlexgo">حفظ القاموس</button> <span id="vlexst" class="mut"></span></details>`;
  }
  // المونتاج: تعديل نص المسودة ومشاهدها ثم الإخراج
  async function montage(id, repl) {
    const D = await getj("data/video/drafts/" + id + ".json", null); if (!D) return view('<p class="note">المسودة غير موجودة بعد؛ أعد المحاولة بعد دقائق.</p><p><a href="#/video">← الفيديوهات</a></p>');
    const O = D.opts || {};
    view(`<p><a href="#/video">← الفيديوهات</a></p><h2>✂ مونتاج: ${esc(D.title)}</h2><p class="mut">النص كله في خانة واحدة: راجعه وحرّره ثم اعتمده؛ ويُوزَّع آليًّا على المشاهد. الخيارات: ${esc(styleName(O.style))} • ${esc(O.voice || "")}${repl ? " • يحل الفيديو الناتج محل الفيديو غير المعتمد" : ""}</p>
      <div class="card"><label>المقاسات</label>${checks("aspect", repl ? [] : (O.aspects || [O.aspect || "16:9"]))}${repl ? '<p class="mut">اتركها فارغة لإخراج مقاس الفيديو المصحَّح وحده.</p>' : ""}
        <label>الصوت</label>${radios("voice", OPT.voice.some(x => x[0] === O.voice) ? O.voice : "gemini:Charon")}
        <label class="chk"><input type="checkbox" id="vpg"${O.pages ? " checked" : ""}> 📖 صفحات الكتاب مع قلم التحديد</label><label class="chk"><input type="checkbox" id="vsfx"${O.sfx || O.sfx === undefined ? " checked" : ""}> 🔊 صوت القلم وتقليب الصفحات</label></div>
      <label>عنوان الفيديو</label><input id="vdt" value="${esc(D.title)}">
      <label>النص الكامل للفيديو (خانة واحدة) <span class="mut">— حرّر وأضف واحذف بحرية؛ السطر الذي يبدأ بـ «## » عنوان مشهد (اختياري). بعد الاعتماد يُعاد توزيع النص على المشاهد آليًّا مع عناوينها ونقاطها، ونص الراوي يبقى كما كتبته حرفًا بحرف.</span></label>
      <textarea id="vscript" class="vscript" rows="22" dir="rtl">${esc(D.script || (D.scenes || []).map(s => (s.h ? "## " + s.h + "\n" : "") + (s.say || "")).join("\n\n"))}</textarea>
      <p class="mut" id="vwc"></p>
      <div class="row"><button class="btn p" id="vgo">✓ اعتماد النص وإخراج الفيديو</button><span id="vgost" class="mut"></span></div>
      <p class="mut">🧪 إخراج تجريبي بمحرك <b>OpenMontage</b> المفتوح المصدر من النص نفسه بعد اعتماده: <a href="https://github.com/${esc(CFG.repo || "dawah-library/sdsl-library")}/actions/workflows/openmontage.yml" target="_blank" rel="noopener">تشغيل المهمة</a> بمعرّف المسودة <code>${esc(id)}</code> (يظهر الناتج هنا بانتظار الاعتماد).</p>`);
    const ta = document.getElementById("vscript"), wc = () => { const w = ta.value.replace(/^#+.*$/gm, "").split(/\s+/).filter(Boolean).length; document.getElementById("vwc").textContent = toAr(w) + " كلمة للراوي ≈ " + toAr(Math.max(1, Math.round(w / 130 * 10) / 10)) + " دقيقة • " + toAr((ta.value.match(/^##\s/gm) || []).length) + " عنوان مشهد"; };
    ta.addEventListener("input", wc); wc();
    document.getElementById("vgo").onclick = async () => { const st = document.getElementById("vgost"), script = ta.value.trim(); if (script.replace(/^#+.*$/gm, "").trim().length < 20) return st.textContent = "النص فارغ أو قصير جدًّا";
      st.textContent = "جارٍ الحفظ…"; try { await GH.editJSON("data/video/drafts/" + id + ".json", o => Object.assign(o || D, { title: document.getElementById("vdt").value.trim() || D.title, script, edited: new Date().toISOString() }), "فيديو: اعتماد نص «" + D.title + "»");
        await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; const asp = [...document.querySelectorAll("[name=aspect]:checked")].map(x => x.value), x = { id: D.book, draft: id, script, voice: (document.querySelector("[name=voice]:checked") || {}).value, pages: document.getElementById("vpg").checked ? 1 : 0, sfx: document.getElementById("vsfx").checked ? 1 : 0, at: new Date().toISOString() };
          if (asp.length) x.aspects = asp; if (repl) x.replace = repl; (o.items = o.items || []).push(x); return o; }, "فيديو: إخراج «" + D.title + "»");
        st.textContent = "✓ أُرسل: يُوزَّع النص على المشاهد ثم يُخرج الفيديو، ويظهر خلال دقائق بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act^=vid]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "vidshare") { const d = { title: el.dataset.t, text: el.dataset.t + " — فيديو من المكتبة الرقمية للدعوة السلفية", url: el.dataset.u }; if (navigator.share) navigator.share(d).catch(() => { }); else { navigator.clipboard.writeText(d.url); toast("نُسخ رابط الفيديو"); } }
    else if (el.dataset.act === "vidok") { const b = el.dataset.b, k = +el.dataset.k; await GH.editJSON("data/video/_list.json", o => { if (o[b] && o[b][k]) o[b][k].ok = o[b][k].ok ? 0 : 1; return o; }, "فيديو: اعتماد"); LIST = null; route(); }
    // حذف فيديو غير معتمد: يُزال من القائمة فورًا، ويُحذف ملفه من إصدار GitHub في المهمة (طلب del في الطابور)
    else if (el.dataset.act === "viddel") { const b = el.dataset.b, f = el.dataset.f; if (!confirm("حذف هذا الفيديو نهائيًّا؟ لا يمكن استرجاعه، ويبقى نص مسودته للمونتاج إن أردت إخراجه من جديد.")) return;
      el.disabled = true; el.textContent = "جارٍ الحذف…";
      try { await GH.editJSON("data/video/_list.json", o => { if (o[b]) { o[b] = o[b].filter(v => v.f !== f || v.ok); if (!o[b].length) delete o[b]; } return o; }, "فيديو: حذف " + f);
        await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push({ del: 1, id: b, f, at: new Date().toISOString() }); return o; }, "فيديو: حذف الملف " + f);
        GONE.add(f); toast("✓ حُذف الفيديو"); LIST = null; route(); } catch (x) { el.disabled = false; el.textContent = "🗑 حذف"; toast("تعذّر الحذف: " + (x.message || x)); } } });
  // رابط في «خدمات الكتاب»
  new MutationObserver(async () => { const nav = document.querySelector(".bkhub nav:not([data-vid])"); if (!nav) return; nav.dataset.vid = 1; const m = location.pathname.match(/book\/([^/]+)/); if (!m) return; const L = await list(), b = B(m[1]), id = b && b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : m[1];
    const l = (L[id] || []).filter(v => v.ok || may()); if (l.length || may()) nav.insertAdjacentHTML("beforeend", `<a href="#/video?b=${encodeURIComponent(id)}">🎬 ${l.length ? "فيديو الملخص" : "إعداد فيديو"}</a>`); }).observe(document.documentElement, { childList: true, subtree: true });
  return { view: page };
})();
