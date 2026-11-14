/* فيديوهات الكتب (#/video): ملخص الكتاب ومراجعته في فيديو بمشاهد وراوٍ (tools/book-video.py ← video.yml).
   إعداد المدير ومن فوّضه (صلاحية video): نمط الفيديو (ملخص، مراجعة، فوائد، سرد، أسئلة شائعة، مختارات، تعريف ترويجي، درس)، والمدة بالدقائق
   أو بعدد المشاهد، والجمهور، وأسلوب الإلقاء، والموضوعات المختارة من فهرس الكتاب، والأفكار المطلوبة، والافتتاح والختام، والأبعاد والصوت والسمة
   والخط والزخرفة والترجمة النصية؛ ثم «توليد مباشر» أو «إعداد النص أولًا» (مونتاج: تعديل المشاهد وترتيبها وحذفها وإضافتها ومدة كل مشهد
   قبل الإخراج)، أو «✨ إبداع من الموقع». ولا يُنشر الفيديو إلا بعد الاعتماد، ويُشارك برابطه أو يُنزَّل. */
const VIDX = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + p;
  const getj = async (p, d) => { try { const r = await fetch(RAW(p) + "?t=" + Math.floor(Date.now() / 60e3)); return r.ok ? await r.json() : d; } catch (e) { return d; } };
  let LIST = null; const list = async f => (LIST && !f) ? LIST : (LIST = await getj("data/video/_list.json", {}));
  const url = (bid, f) => "https://github.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/releases/download/video-" + bid + "/" + f;
  const fmt = s => toAr(Math.floor(s / 60)) + ":" + toAr(String(s % 60).padStart(2, "0"));
  const may = () => isAdmin() || can("video");
  const OPT = {
    subj: [["book", "📘 كتاب"], ["author", "👤 مؤلف وكتبه"], ["books", "📚 عدة كتب لمؤلف"], ["topic", "🗂 كتب في موضوع"], ["article", "📰 مقال"], ["articles", "🗞 عدة مقالات"]],
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
  const radios = (n, d) => `<div class="vchips">${OPT[n].map(([v, t]) => `<label class="chip"><input type="radio" name="${n}" value="${v}"${v === d ? " checked" : ""}> ${t}</label>`).join("")}</div>`;
  // التفريغ النصي للفيديو (كلام الراوي مشهدًا مشهدًا): للإدارة ومن مُنح صلاحية video أو video_script
  const canScript = () => may() || can("video_script");
  const SKN = { author: "مؤلف", books: "كتب لمؤلف", topic: "موضوع", article: "مقال", articles: "مقالات" };
  const subjName = v => { const sj = v.subj || {}; return sj.k && sj.k !== "book" ? (SKN[sj.k] || "") + ": " + (sj.t || "") : ((B(v.id) || {}).title || ""); };
  const subjLink = v => { const sj = v.subj || {}, ids = v.ids || [v.id];
    if (sj.k === "author" || sj.k === "books") return `<a class="btn s" href="#/author/${esc(sj.aid || "")}">👤 المؤلف</a>` + ids.slice(0, 4).map(id => B(id) ? `<a class="btn s" href="#/book/${esc(id)}/1">📖 ${esc((B(id).setTitle || B(id).title).slice(0, 28))}</a>` : "").join("");
    if (sj.k && sj.k !== "book") return ids.slice(0, 5).map(id => B(id) ? `<a class="btn s" href="#/book/${esc(id)}/1">${isArt(B(id)) ? "📰" : "📖"} ${esc(B(id).title.slice(0, 28))}</a>` : "").join("");
    return `<a class="btn s" href="#/book/${esc(v.id)}/1">📖 الكتاب</a>`; };
  const scriptBox = v => `<details class="vfix vscript" data-vs="${esc(v.draft || "")}" data-i="${esc(v.id)}" data-k="${v.k}"><summary>📝 التفريغ النصي للفيديو</summary><div class="vsb mut">يُحمَّل عند الفتح…</div></details>`;
  document.addEventListener("toggle", async e => { const d = e.target; if (!d.matches || !d.matches(".vscript") || !d.open || d.dataset.ld) return; d.dataset.ld = 1;
    const box = d.querySelector(".vsb"), v = ((LIST || {})[d.dataset.i] || [])[+d.dataset.k] || {}, D = d.dataset.vs ? await getj("data/video/drafts/" + d.dataset.vs + ".json", null) : null;
    const sc = D && D.scenes ? D.scenes : (v.scenes || []).map(h => ({ h }));
    if (!sc.length) { box.textContent = "لا تفريغ محفوظ لهذا الفيديو."; return; }
    const txt = (D ? D.title : v.t || "") + "\n\n" + sc.map((s, i) => `${i + 1}. ${s.h || ""}\n${s.say || ""}`).join("\n\n");
    box.classList.remove("mut");
    box.innerHTML = `${D ? "" : '<p class="mut">لهذا الفيديو القديم عناوين المشاهد وحدها.</p>'}<ol class="vstx">${sc.map(s => `<li><b>${esc(s.h || "")}</b>${s.say ? `<p>${esc(s.say)}</p>` : ""}</li>`).join("")}</ol>
      <div class="row"><button type="button" class="btn s" data-vtx="copy">نسخ التفريغ</button><button type="button" class="btn s" data-vtx="dl">⬇ تنزيل نصًّا</button></div>`;
    box.querySelector('[data-vtx="copy"]').onclick = () => { navigator.clipboard.writeText(txt); toast("نُسخ التفريغ"); };
    box.querySelector('[data-vtx="dl"]').onclick = () => dl(((D && D.title) || v.t || "video").replace(/[\\/:*?"<>|]/g, "_").slice(0, 70) + " - تفريغ.txt", txt, "text/plain"); }, true);
  async function page(q) {
    const adm = may(), [L, DX] = await Promise.all([list(true), adm ? getj("data/video/drafts/_index.json", {}) : {}]), bid = q.b;
    if (q.d && adm) return montage(q.d, q.r);
    const vids = Object.entries(L).flatMap(([id, l]) => l.map((v, k) => Object.assign({ id, k }, v))).filter(v => (v.ok || adm) && (!bid || v.id === bid || (v.ids || []).includes(bid))).reverse();
    view(`<div class="cmhero"><div><h2>🎬 مراجعات الكتب بالفيديو</h2><p>استعراض الكتب في فيديوهات تعليمية: ملخصها، ومراجعتها، ومميزاتها ومنهجها، وقراءة نقدية منصفة لها، والحديث عن بعض أبوابها؛ تعدّها إدارة المكتبة ومن تفوّضه، للمشاهدة والتنزيل والمشاركة.</p></div></div>
      ${adm ? `<details class="card"${bid ? " open" : ""}><summary><b>＋ إعداد فيديو جديد</b></summary><form id="vidf" data-form="noop" class="vidform">
        <label>موضوع الفيديو</label>${radios("subj", "book")}
        <div data-sk="author books"><label>المؤلف</label><input name="au" list="vidauthors" placeholder="اكتب اسم المؤلف ثم اختره"><datalist id="vidauthors">${lib.authors.map(a => `<option value="${esc(a.name)}">`).join("")}</datalist></div>
        <div data-sk="topic"><label>الموضوع</label><input name="tp" list="vidtopics" placeholder="اكتب الموضوع ثم اختره"><datalist id="vidtopics">${lib.topics.map(t => `<option value="${esc(t.name)}">`).join("")}</datalist></div>
        <div data-sk="author books topic"><label>الكتب <span class="mut" id="vidpkn"></span></label><div id="vidpick" class="vchips"><span class="mut">اختر المؤلف أو الموضوع أولًا</span></div></div>
        <div data-sk="article articles"><label>المقال <span class="mut">(اكتب كلمة من العنوان ثم اختر${""})</span></label><input name="ar" list="vidarts" placeholder="ابحث في عناوين المقالات والفتاوى" autocomplete="off"><datalist id="vidarts"></datalist><div id="vidartl" class="vchips"></div></div>
        <div data-sk="book"><label>الكتاب</label><input name="t" list="vidbooks" value="${esc(bid && B(bid) ? (B(bid).setTitle || B(bid).title) : "")}" placeholder="اكتب اسم الكتاب ثم اختره" required><datalist id="vidbooks">${lib.books.filter(b => !b.demo && !isArt(b) && !VOL2(b)).slice(0, 3000).map(b => `<option value="${esc(b.setTitle || b.title)}">`).join("")}</datalist></div>
        <label>نمط الفيديو</label>${radios("style", "summary")}
        <label>المدة</label>${radios("min", "6")}<input name="scenes" type="number" min="3" max="30" placeholder="أو عدد المشاهد (اختياري)" style="max-width:220px">
        <label>الجمهور</label>${radios("aud", "general")}<label>أسلوب الإلقاء</label>${radios("tone", "calm")}
        <div data-sk="book"><label>الموضوعات والأبواب (اختر من فهرس الكتاب، أو اتركها للكتاب كله)</label><div id="vidtoc" class="vchips"><span class="mut">اختر الكتاب أولًا</span></div><input name="topics2" placeholder="أو اكتب موضوعات أخرى مفصولة بفواصل"></div>
        <label>الأفكار التي تريدها في الفيديو</label><textarea name="ideas" rows="3" placeholder="مثال: بيان حجية السنة، والرد على شبهة الاكتفاء بالقرآن، ونماذج من الواقع"></textarea>
        <div class="row"><div style="flex:1"><label>الافتتاح (اختياري)</label><input name="intro" placeholder="معنى يبدأ به الراوي"></div><div style="flex:1"><label>الختام (اختياري)</label><input name="outro" placeholder="معنى يختم به"></div></div>
        <label>مقاس الفيديو (اختر مقاسًا أو أكثر)</label>${checks("aspect", ["16:9"])}
        <label class="chk"><input type="checkbox" name="pages" checked> 📖 إظهار صفحات الكتاب أثناء العرض: تنقلب الصفحة التي أُخذ منها المشهد (المصورة إن وُجدت) ويمر قلم التحديد على العبارة المقصودة</label>
        <label class="chk"><input type="checkbox" name="sfx" checked> 🔊 صوت قلم التحديد وتقليب الصفحات</label>
        <details><summary>المظهر والصوت</summary><label>الصوت</label>${radios("voice", "gemini:Charon")}<label>السمة</label>${radios("theme", "green")}<label>خط العناوين</label>${radios("font", "amiri")}<label>الزخرفة</label>${radios("pat", "stars")}
          <label class="chk"><input type="checkbox" name="cap" checked> إظهار نص الراوي على الشاشة (ترجمة نصية)</label></details>
        <label>متطلبات أخرى (اختياري)</label><textarea name="note" rows="2"></textarea>
        <div class="row"><button class="btn p" data-mode="draft">📝 إعداد النص أولًا للمراجعة والمونتاج</button><button class="btn" data-mode="direct">🎬 توليد مباشر</button><button class="btn" data-mode="creative">✨ إبداع من الموقع</button><span id="vidst" class="mut"></span></div></form></details>` : ""}
      ${adm ? await lexBox() : ""}
      ${adm && Object.keys(DX).filter(k => !DX[k].made).length ? `<div class="card"><h3>📝 مسودات بانتظار المونتاج</h3>${Object.entries(DX).filter(([, x]) => !x.made).reverse().slice(0, 20).map(([id, x]) => `<a class="bk" href="#/video?d=${encodeURIComponent(id)}"><b>${esc(x.t)}</b><span>${toAr(x.n)} مشهدًا • ${esc(x.at)}</span></a>`).join("")}</div>` : ""}
      ${bid ? `<p><a href="#/video">← كل الفيديوهات</a> <b>${esc((B(bid) || {}).title || bid)}</b></p>` : ""}
      <div class="vidgrid">${vids.map(v => `<div class="card vidc"><video controls preload="metadata" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : v.aspect === "1:1" ? ' class="sq"' : ""}></video><b>${esc(v.t)}</b><span class="mut">${esc((OPT.style.find(x => x[0] === v.style) || ["", "ملخص"])[1])} • ${esc(ASPL(v.aspect || "16:9"))} • ${fmt(v.d || 0)} • ${esc(subjName(v))}${v.rev ? ` • <em class="tag">مصحَّح ${toAr(v.rev)}</em>` : ""}</span>
        <div class="row">${subjLink(v)}<a class="btn s" href="${esc(url(v.id, v.f))}" download>⬇ تنزيل</a><button class="btn s" data-act="vidshare" data-u="${esc(url(v.id, v.f))}" data-t="${esc(v.t)}">⤴ مشاركة</button>${adm ? `<button class="btn s ${v.ok ? "" : "p"}" data-act="vidok" data-b="${esc(v.id)}" data-k="${v.k}">${v.ok ? "إلغاء النشر" : "اعتماد ونشر"}</button>${v.draft ? `<a class="btn s" href="#/video?d=${encodeURIComponent(v.draft)}">✂ تعديل وإعادة الإخراج</a>` : ""}` : ""}${v.ok ? "" : ' <em class="tag">بانتظار الاعتماد</em>'}</div>${canScript() ? scriptBox(v) : ""}${adm && !v.ok && v.draft ? fixBox(v) : ""}</div>`).join("") || '<p class="note">لا فيديوهات منشورة بعد.</p>'}</div>`);
    const lb = document.getElementById("vlexgo"); if (lb) lb.onclick = async () => { const st = document.getElementById("vlexst"); st.textContent = "جارٍ الحفظ…";
      try { const words = lexParse(document.getElementById("vlex").value); await GH.editJSON("data/video/_lexicon.json", o => Object.assign(o || {}, { words }), "فيديو: قاموس النطق"); st.textContent = "✓ حُفظ (" + toAr(words.length) + ")"; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
    const f = document.getElementById("vidf"); if (!f) return;
    const bookOf = () => lib.books.find(x => (x.setTitle || x.title) === f.t.value.trim());
    const toc = async () => { const b = bookOf(), el = document.getElementById("vidtoc"); if (!b) return; el.innerHTML = '<span class="mut">جارٍ تحميل الفهرس…</span>';
      let T = []; try { const bb = await loadBook(b.id); T = (bb.toc || []).filter(x => x.t).slice(0, 80); } catch (e) { }
      el.innerHTML = T.length ? T.map(x => { const t = String(x.t).replace(/^#+\s*/, ""); return `<label class="chip"><input type="checkbox" name="topics" value="${esc(t)}"> ${esc(t.slice(0, 60))}</label>`; }).join("") : '<span class="mut">لا فهرس لهذا الكتاب؛ اكتب الموضوعات في الخانة.</span>'; };
    f.t.addEventListener("change", toc); if (bid) toc();
    const sk = () => (f.querySelector("[name=subj]:checked") || {}).value || "book", show = () => { const k = sk(); f.querySelectorAll("[data-sk]").forEach(x => { x.hidden = !x.dataset.sk.split(" ").includes(k); }); f.t.required = k === "book"; pick(); };
    const authOf = () => lib.authors.find(a => a.name === f.au.value.trim()), topOf = () => lib.topics.find(t => t.name === f.tp.value.trim());
    const pick = () => { const k = sk(), el = document.getElementById("vidpick"); let L = [];
      if (k === "author" || k === "books") { const a = authOf(); if (a) L = lib.books.filter(b => b.authorId === a.id && !isArt(b) && !b.demo && !VOL2(b)); }
      if (k === "topic") { const t = topOf(); if (t) L = lib.books.filter(b => b.topicId === t.id && !isArt(b) && !b.demo && !VOL2(b)); }
      L.sort((x, y) => (y.size || 0) - (x.size || 0));
      document.getElementById("vidpkn").textContent = L.length ? `(${toAr(L.length)} — اختر حتى ١٠${k === "author" ? "، أو اتركها لأبرزها" : ""})` : "";
      el.innerHTML = L.length ? L.slice(0, 120).map((b, i) => `<label class="chip"><input type="checkbox" name="pk" value="${esc(b.id)}"${k === "topic" && i < 5 ? " checked" : ""}> ${esc((b.setTitle || b.title).slice(0, 50))}</label>`).join("") : '<span class="mut">اختر المؤلف أو الموضوع أولًا</span>'; };
    f.querySelectorAll("[name=subj]").forEach(x => x.addEventListener("change", show)); f.au.addEventListener("change", pick); f.tp.addEventListener("change", pick); show();
    const arts = new Map(), artl = document.getElementById("vidartl");
    f.ar.addEventListener("input", () => { const s = f.ar.value.trim(); if (s.length < 2) return; document.getElementById("vidarts").innerHTML = lib.books.filter(b => isArt(b) && b.title.includes(s)).slice(0, 30).map(b => `<option value="${esc(b.title)}">`).join(""); });
    f.ar.addEventListener("change", () => { const b = lib.books.find(x => isArt(x) && x.title === f.ar.value.trim()); if (!b) return; if (sk() === "article") arts.clear(); if (arts.size < 10) arts.set(b.id, b.title); f.ar.value = "";
      artl.innerHTML = [...arts].map(([id, t]) => `<span class="chip">${esc(t.slice(0, 50))} <button type="button" data-rm="${esc(id)}" aria-label="إزالة">✕</button></span>`).join(""); });
    artl.addEventListener("click", e => { const r = e.target.closest("[data-rm]"); if (r) { arts.delete(r.dataset.rm); r.parentNode.remove(); } });
    // معرّف الفيديو (وإصداره) وموضوعه بحسب النوع
    const subjOf = () => { const k = sk(), ids = [...f.querySelectorAll("[name=pk]:checked")].map(x => x.value).slice(0, 10);
      if (k === "book") { const b = bookOf(); return b ? { id: b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : b.id, t: b.setTitle || b.title } : { err: "اختر الكتاب من القائمة" }; }
      if (k === "author" || k === "books") { const a = authOf(); if (!a) return { err: "اختر المؤلف من القائمة" }; if (k === "books" && ids.length < 2) return { err: "اختر كتابين على الأقل" };
        return { id: "a-" + a.id, t: a.name, subj: { k, aid: a.id, t: a.name, ids } }; }
      if (k === "topic") { const t = topOf(); if (!t) return { err: "اختر الموضوع من القائمة" }; if (!ids.length) return { err: "اختر كتابًا واحدًا على الأقل" }; return { id: "t-" + t.id, t: t.name, subj: { k, tid: t.id, t: t.name, ids } }; }
      const A2 = [...arts.keys()]; if (!A2.length) return { err: "اختر مقالًا" + (k === "articles" ? " أو أكثر" : "") };
      if (k === "article") return { id: A2[0], t: arts.get(A2[0]), subj: { k, t: arts.get(A2[0]), ids: A2.slice(0, 1) } };
      return { id: "m-" + Date.now().toString(36), t: arts.get(A2[0]) + (A2.length > 1 ? " وغيره" : ""), subj: { k, t: "مقالات مختارة: " + arts.get(A2[0]) + (A2.length > 1 ? " و" + toAr(A2.length - 1) + " غيره" : ""), ids: A2 } }; };
    f.addEventListener("submit", async e => { e.preventDefault(); const mode = (e.submitter && e.submitter.dataset.mode) || "draft", sj = subjOf(), st = document.getElementById("vidst"); if (sj.err) return st.textContent = sj.err;
      const v = n => (f.querySelector(`[name=${n}]:checked`) || {}).value, topics = [...f.querySelectorAll("[name=topics]:checked")].map(x => x.value).concat(f.topics2.value.split(/[,،]/).map(x => x.trim()).filter(Boolean)).filter(() => sk() === "book");
      const it = { id: sj.id, subj: sj.subj, style: v("style"), min: v("min"), scenes: f.scenes.value || "", aud: v("aud"), tone: v("tone"), topics, ideas: f.ideas.value.trim(), intro: f.intro.value.trim(), outro: f.outro.value.trim(),
        aspects: [...f.querySelectorAll("[name=aspect]:checked")].map(x => x.value), pages: f.pages.checked ? 1 : 0, sfx: f.sfx.checked ? 1 : 0, voice: v("voice"), theme: mode === "creative" ? "auto" : v("theme"), font: v("font"), pat: mode === "creative" ? "" : v("pat"), cap: f.cap.checked ? 1 : 0, note: f.note.value.trim(), creative: mode === "creative" ? 1 : 0, phase: mode === "draft" ? "script" : "", at: new Date().toISOString() };
      if (!it.aspects.length) return st.textContent = "اختر مقاسًا واحدًا على الأقل";
      st.textContent = "جارٍ الإرسال…"; try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "فيديو: «" + sj.t + "»");
        st.textContent = mode === "draft" ? "✓ يُعَدّ النص خلال دقائق ويظهر في «مسودات بانتظار المونتاج» لتعدّله ثم تخرجه." : "✓ أُضيف؛ يجهز الفيديو خلال دقائق ويظهر هنا بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
  }
  // تصحيح الفيديو قبل اعتماده: ملاحظات وتصحيحات نطق تُطبَّق على نص الفيديو نفسه ثم يُعاد إخراجه مكانه (لا فيديو جديد من الكتاب)
  const fixBox = v => `<details class="vfix"><summary>✎ تصحيحات وملاحظات قبل الاعتماد</summary><form data-form="noop" data-vfix="${esc(v.id)}" data-f="${esc(v.f)}" data-d="${esc(v.draft)}">
      <label>الملاحظات والتعديلات (ما يُغيَّر في الكلام أو العناوين أو النقاط أو ترتيب المشاهد)</label><textarea name="notes" rows="3" placeholder="مثال: في المشهد الثالث اذكر أن الكتاب للمبتدئين، واحذف المشهد الخامس، واجعل الخاتمة أقصر"></textarea>
      <label>تصحيح النطق (سطر لكل كلمة: الكلمة = نطقها مشكولًا) — يُحفظ في قاموس النطق لكل الفيديوهات</label><textarea name="lex" rows="2" placeholder="برهامي = بُرْهَامِي"></textarea>
      <div class="row"><button class="btn p s">تطبيق التصحيحات وإعادة الإخراج</button><a class="btn s" href="#/video?d=${encodeURIComponent(v.draft)}&r=${encodeURIComponent(v.f)}">✂ تعديل المشاهد يدويًّا</a><span class="mut" data-st></span></div>
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
    const row = (s, i) => `<div class="card vscene" data-i="${i}"><div class="row"><b>المشهد ${toAr(i + 1)}</b><span style="flex:1"></span><button type="button" class="btn s" data-mv="-1">▲</button><button type="button" class="btn s" data-mv="1">▼</button><button type="button" class="btn s" data-del>حذف</button></div>
      <label>العنوان على الشاشة</label><input data-k="h" value="${esc(s.h || "")}"><label>النقاط على الشاشة (سطر لكل نقطة)</label><textarea data-k="pts" rows="3">${esc((s.pts || []).join("\n"))}</textarea>
      <label>نص الراوي</label><textarea data-k="say" rows="4">${esc(s.say || "")}</textarea>
      <div class="row"><div><label>صفحة الكتاب</label><input data-k="pg" type="number" min="0" value="${esc(s.pg || "")}" style="max-width:110px"></div><div style="flex:1"><label>العبارة التي يحددها القلم في الصفحة</label><input data-k="q" value="${esc(s.q || "")}"></div></div>
      <label class="chk"><input type="checkbox" data-k="pgoff"${s.pgoff ? " checked" : ""}> بلا صفحة في هذا المشهد</label>
      <label>أقل مدة للمشهد بالثواني (اختياري)</label><input data-k="min" type="number" min="0" max="120" value="${esc(s.min || "")}" style="max-width:140px"></div>`;
    view(`<p><a href="#/video">← الفيديوهات</a></p><h2>✂ مونتاج: ${esc(D.title)}</h2><p class="mut">عدّل العناوين والنقاط ونص الراوي، ورتّب المشاهد أو احذفها أو أضف غيرها، ثم أخرج الفيديو. الخيارات: ${esc((OPT.style.find(x => x[0] === O.style) || ["", ""])[1])} • ${esc(O.voice || "")}${repl ? " • يحل الفيديو الناتج محل الفيديو غير المعتمد" : ""}</p>
      <div class="card"><label>المقاسات</label>${checks("aspect", repl ? [] : (O.aspects || [O.aspect || "16:9"]))}${repl ? '<p class="mut">اتركها فارغة لإخراج مقاس الفيديو المصحَّح وحده.</p>' : ""}
        <label>الصوت</label>${radios("voice", OPT.voice.some(x => x[0] === O.voice) ? O.voice : "gemini:Charon")}
        <label class="chk"><input type="checkbox" id="vpg"${O.pages ? " checked" : ""}> 📖 صفحات الكتاب مع قلم التحديد</label><label class="chk"><input type="checkbox" id="vsfx"${O.sfx || O.sfx === undefined ? " checked" : ""}> 🔊 صوت القلم وتقليب الصفحات</label></div>
      <label>عنوان الفيديو</label><input id="vdt" value="${esc(D.title)}"><div id="vscs">${(D.scenes || []).map(row).join("")}</div>
      <div class="row"><button class="btn" id="vadd">＋ مشهد جديد</button><button class="btn p" id="vgo">🎬 حفظ وإخراج الفيديو</button><span id="vgost" class="mut"></span></div>`);
    const box = document.getElementById("vscs"), collect = keep => [...box.querySelectorAll(".vscene")].map(c => { const g = k => c.querySelector(`[data-k=${k}]`).value; return { h: g("h").trim(), pts: g("pts").split("\n").map(x => x.trim()).filter(Boolean), say: g("say").trim(), pg: +g("pg") || 0, q: g("q").trim(), pgoff: c.querySelector("[data-k=pgoff]").checked ? 1 : 0, min: +g("min") || 0 }; }).filter(s => keep || s.say);
    const redraw = l => { box.innerHTML = l.map(row).join(""); };
    box.addEventListener("click", e => { const c = e.target.closest(".vscene"); if (!c) return; const l = collect(true), i = +c.dataset.i;
      if (e.target.closest("[data-del]")) { l.splice(i, 1); redraw(l); } else if (e.target.closest("[data-mv]")) { const j = i + +e.target.closest("[data-mv]").dataset.mv; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; redraw(l); } });
    document.getElementById("vadd").onclick = () => { const l = collect(true); l.push({ h: "", pts: [], say: "" }); redraw(l); };
    document.getElementById("vgo").onclick = async () => { const st = document.getElementById("vgost"), l = collect(false); if (!l.length) return st.textContent = "لا مشاهد فيها نص للراوي";
      st.textContent = "جارٍ الحفظ…"; try { await GH.editJSON("data/video/drafts/" + id + ".json", o => Object.assign(o || D, { title: document.getElementById("vdt").value.trim() || D.title, scenes: l, edited: new Date().toISOString() }), "فيديو: مونتاج «" + D.title + "»");
        await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; const asp = [...document.querySelectorAll("[name=aspect]:checked")].map(x => x.value), x = { id: D.book, draft: id, voice: (document.querySelector("[name=voice]:checked") || {}).value, pages: document.getElementById("vpg").checked ? 1 : 0, sfx: document.getElementById("vsfx").checked ? 1 : 0, at: new Date().toISOString() };
          if (asp.length) x.aspects = asp; if (repl) x.replace = repl; (o.items = o.items || []).push(x); return o; }, "فيديو: إخراج «" + D.title + "»");
        st.textContent = "✓ أُرسل للإخراج؛ يظهر في الفيديوهات خلال دقائق بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act^=vid]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "vidshare") { const d = { title: el.dataset.t, text: el.dataset.t + " — فيديو من المكتبة الرقمية للدعوة السلفية", url: el.dataset.u }; if (navigator.share) navigator.share(d).catch(() => { }); else { navigator.clipboard.writeText(d.url); toast("نُسخ رابط الفيديو"); } }
    else if (el.dataset.act === "vidok") { const b = el.dataset.b, k = +el.dataset.k; await GH.editJSON("data/video/_list.json", o => { if (o[b] && o[b][k]) o[b][k].ok = o[b][k].ok ? 0 : 1; return o; }, "فيديو: اعتماد"); LIST = null; route(); } });
  // رابط في «خدمات الكتاب»
  new MutationObserver(async () => { const nav = document.querySelector(".bkhub nav:not([data-vid])"); if (!nav) return; nav.dataset.vid = 1; const m = location.pathname.match(/book\/([^/]+)/); if (!m) return; const L = await list(), b = B(m[1]), id = b && b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : m[1];
    const l = Object.entries(L).flatMap(([k, x]) => x.filter(v => k === id || (v.ids || []).includes(id))).filter(v => v.ok || may()); if (l.length || may()) nav.insertAdjacentHTML("beforeend", `<a href="#/video?b=${encodeURIComponent(id)}">🎬 ${l.length ? "فيديو الملخص" : "إعداد فيديو"}</a>`); }).observe(document.documentElement, { childList: true, subtree: true });
  return { view: page };
})();
