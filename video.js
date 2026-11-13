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
    style: [["summary", "ملخص الكتاب"], ["review", "مراجعة وأسئلة"], ["benefits", "أبرز الفوائد والدروس"], ["story", "سرد قصصي متسلسل"], ["faq", "أسئلة شائعة وأجوبتها"], ["quotes", "مختارات من أقوال المؤلف"], ["intro", "تعريف ترويجي قصير"], ["lesson", "درس تعليمي مبسط"], ["features", "مميزات الكتاب ومنهجه"], ["critique", "قراءة نقدية منصفة"], ["part", "الحديث عن جزء أو باب منه"]],
    min: [["2", "دقيقتان"], ["4", "٤ دقائق"], ["6", "٦ دقائق"], ["10", "١٠ دقائق"], ["15", "١٥ دقيقة"]],
    aud: [["general", "عموم المسلمين"], ["students", "طلاب العلم"], ["youth", "الشباب"], ["kids", "الأطفال"], ["women", "النساء والفتيات"]],
    tone: [["calm", "هادئ وقور"], ["warm", "دافئ مؤثر"], ["lively", "حيوي معتدل"], ["teach", "تعليمي مبسط"]],
    aspect: [["16:9", "أفقي ١٦:٩ (يوتيوب)"], ["9:16", "عمودي ٩:١٦ (المقاطع القصيرة)"], ["1:1", "مربع ١:١ (المنشورات)"]],
    voice: [["gemini:Orus", "Orus — رخيم هادئ"], ["gemini:Charon", "Charon — إخباري واضح"], ["gemini:Kore", "Kore — أنثوي هادئ"], ["gemini:Puck", "Puck — حيوي للناشئة"]],
    theme: [["green", "أخضر وذهبي"], ["gold", "ورقي دافئ"], ["night", "ليلي"], ["auto", "يختارها النموذج"]],
    font: [["amiri", "أميري (نسخ)"], ["ruqaa", "رقعة"], ["kufi", "كوفي"], ["readex", "حديث"]],
    pat: [["stars", "نجوم"], ["lines", "خطوط"], ["arch", "قوس"], ["none", "بلا زخرفة"]] };
  const radios = (n, d) => `<div class="vchips">${OPT[n].map(([v, t]) => `<label class="chip"><input type="radio" name="${n}" value="${v}"${v === d ? " checked" : ""}> ${t}</label>`).join("")}</div>`;
  async function page(q) {
    const adm = may(), [L, DX] = await Promise.all([list(true), adm ? getj("data/video/drafts/_index.json", {}) : {}]), bid = q.b;
    if (q.d && adm) return montage(q.d);
    const vids = Object.entries(L).flatMap(([id, l]) => l.map((v, k) => Object.assign({ id, k }, v))).filter(v => (v.ok || adm) && (!bid || v.id === bid)).reverse();
    view(`<div class="cmhero"><div><h2>🎬 مراجعات الكتب بالفيديو</h2><p>استعراض الكتب في فيديوهات تعليمية: ملخصها، ومراجعتها، ومميزاتها ومنهجها، وقراءة نقدية منصفة لها، والحديث عن بعض أبوابها؛ تعدّها إدارة المكتبة ومن تفوّضه، للمشاهدة والتنزيل والمشاركة.</p></div></div>
      ${adm ? `<details class="card"${bid ? " open" : ""}><summary><b>＋ إعداد فيديو جديد</b></summary><form id="vidf" data-form="noop" class="vidform">
        <label>الكتاب</label><input name="t" list="vidbooks" value="${esc(bid && B(bid) ? (B(bid).setTitle || B(bid).title) : "")}" placeholder="اكتب اسم الكتاب ثم اختره" required><datalist id="vidbooks">${lib.books.filter(b => !b.demo && !isArt(b) && !VOL2(b)).slice(0, 3000).map(b => `<option value="${esc(b.setTitle || b.title)}">`).join("")}</datalist>
        <label>نمط الفيديو</label>${radios("style", "summary")}
        <label>المدة</label>${radios("min", "6")}<input name="scenes" type="number" min="3" max="30" placeholder="أو عدد المشاهد (اختياري)" style="max-width:220px">
        <label>الجمهور</label>${radios("aud", "general")}<label>أسلوب الإلقاء</label>${radios("tone", "calm")}
        <label>الموضوعات والأبواب (اختر من فهرس الكتاب، أو اتركها للكتاب كله)</label><div id="vidtoc" class="vchips"><span class="mut">اختر الكتاب أولًا</span></div><input name="topics2" placeholder="أو اكتب موضوعات أخرى مفصولة بفواصل">
        <label>الأفكار التي تريدها في الفيديو</label><textarea name="ideas" rows="3" placeholder="مثال: بيان حجية السنة، والرد على شبهة الاكتفاء بالقرآن، ونماذج من الواقع"></textarea>
        <div class="row"><div style="flex:1"><label>الافتتاح (اختياري)</label><input name="intro" placeholder="معنى يبدأ به الراوي"></div><div style="flex:1"><label>الختام (اختياري)</label><input name="outro" placeholder="معنى يختم به"></div></div>
        <details><summary>المظهر والصوت</summary><label>الأبعاد</label>${radios("aspect", "16:9")}<label>الصوت</label>${radios("voice", "gemini:Orus")}<label>السمة</label>${radios("theme", "green")}<label>خط العناوين</label>${radios("font", "amiri")}<label>الزخرفة</label>${radios("pat", "stars")}
          <label class="chk"><input type="checkbox" name="cap" checked> إظهار نص الراوي على الشاشة (ترجمة نصية)</label></details>
        <label>متطلبات أخرى (اختياري)</label><textarea name="note" rows="2"></textarea>
        <div class="row"><button class="btn p" data-mode="draft">📝 إعداد النص أولًا للمراجعة والمونتاج</button><button class="btn" data-mode="direct">🎬 توليد مباشر</button><button class="btn" data-mode="creative">✨ إبداع من الموقع</button><span id="vidst" class="mut"></span></div></form></details>` : ""}
      ${adm && Object.keys(DX).length ? `<div class="card"><h3>📝 مسودات بانتظار المونتاج</h3>${Object.entries(DX).reverse().slice(0, 20).map(([id, x]) => `<a class="bk" href="#/video?d=${encodeURIComponent(id)}"><b>${esc(x.t)}</b><span>${toAr(x.n)} مشهدًا • ${esc(x.at)}</span></a>`).join("")}</div>` : ""}
      ${bid ? `<p><a href="#/video">← كل الفيديوهات</a> <b>${esc((B(bid) || {}).title || bid)}</b></p>` : ""}
      <div class="vidgrid">${vids.map(v => `<div class="card vidc"><video controls preload="metadata" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : v.aspect === "1:1" ? ' class="sq"' : ""}></video><b>${esc(v.t)}</b><span class="mut">${esc((OPT.style.find(x => x[0] === v.style) || ["", "ملخص"])[1])} • ${fmt(v.d || 0)} • ${esc((B(v.id) || {}).title || "")}</span>
        <div class="row"><a class="btn s" href="#/book/${esc(v.id)}/1">📖 الكتاب</a><a class="btn s" href="${esc(url(v.id, v.f))}" download>⬇ تنزيل</a><button class="btn s" data-act="vidshare" data-u="${esc(url(v.id, v.f))}" data-t="${esc(v.t)}">⤴ مشاركة</button>${adm ? `<button class="btn s ${v.ok ? "" : "p"}" data-act="vidok" data-b="${esc(v.id)}" data-k="${v.k}">${v.ok ? "إلغاء النشر" : "اعتماد ونشر"}</button>${v.draft ? `<a class="btn s" href="#/video?d=${encodeURIComponent(v.draft)}">✂ تعديل وإعادة الإخراج</a>` : ""}` : ""}${v.ok ? "" : ' <em class="tag">بانتظار الاعتماد</em>'}</div></div>`).join("") || '<p class="note">لا فيديوهات منشورة بعد.</p>'}</div>`);
    const f = document.getElementById("vidf"); if (!f) return;
    const bookOf = () => lib.books.find(x => (x.setTitle || x.title) === f.t.value.trim());
    const toc = async () => { const b = bookOf(), el = document.getElementById("vidtoc"); if (!b) return; el.innerHTML = '<span class="mut">جارٍ تحميل الفهرس…</span>';
      let T = []; try { const bb = await loadBook(b.id); T = (bb.toc || []).filter(x => x.t).slice(0, 80); } catch (e) { }
      el.innerHTML = T.length ? T.map(x => { const t = String(x.t).replace(/^#+\s*/, ""); return `<label class="chip"><input type="checkbox" name="topics" value="${esc(t)}"> ${esc(t.slice(0, 60))}</label>`; }).join("") : '<span class="mut">لا فهرس لهذا الكتاب؛ اكتب الموضوعات في الخانة.</span>'; };
    f.t.addEventListener("change", toc); if (bid) toc();
    f.addEventListener("submit", async e => { e.preventDefault(); const mode = (e.submitter && e.submitter.dataset.mode) || "draft", b = bookOf(), st = document.getElementById("vidst"); if (!b) return st.textContent = "اختر الكتاب من القائمة";
      const v = n => (f.querySelector(`[name=${n}]:checked`) || {}).value, topics = [...f.querySelectorAll("[name=topics]:checked")].map(x => x.value).concat(f.topics2.value.split(/[,،]/).map(x => x.trim()).filter(Boolean));
      const it = { id: b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : b.id, style: v("style"), min: v("min"), scenes: f.scenes.value || "", aud: v("aud"), tone: v("tone"), topics, ideas: f.ideas.value.trim(), intro: f.intro.value.trim(), outro: f.outro.value.trim(),
        aspect: v("aspect"), voice: v("voice"), theme: mode === "creative" ? "auto" : v("theme"), font: v("font"), pat: mode === "creative" ? "" : v("pat"), cap: f.cap.checked ? 1 : 0, note: f.note.value.trim(), creative: mode === "creative" ? 1 : 0, phase: mode === "draft" ? "script" : "", at: new Date().toISOString() };
      st.textContent = "جارٍ الإرسال…"; try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "فيديو: «" + f.t.value.trim() + "»");
        st.textContent = mode === "draft" ? "✓ يُعَدّ النص خلال دقائق ويظهر في «مسودات بانتظار المونتاج» لتعدّله ثم تخرجه." : "✓ أُضيف؛ يجهز الفيديو خلال دقائق ويظهر هنا بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
  }
  // المونتاج: تعديل نص المسودة ومشاهدها ثم الإخراج
  async function montage(id) {
    const D = await getj("data/video/drafts/" + id + ".json", null); if (!D) return view('<p class="note">المسودة غير موجودة بعد؛ أعد المحاولة بعد دقائق.</p><p><a href="#/video">← الفيديوهات</a></p>');
    const O = D.opts || {};
    const row = (s, i) => `<div class="card vscene" data-i="${i}"><div class="row"><b>المشهد ${toAr(i + 1)}</b><span style="flex:1"></span><button type="button" class="btn s" data-mv="-1">▲</button><button type="button" class="btn s" data-mv="1">▼</button><button type="button" class="btn s" data-del>حذف</button></div>
      <label>العنوان على الشاشة</label><input data-k="h" value="${esc(s.h || "")}"><label>النقاط على الشاشة (سطر لكل نقطة)</label><textarea data-k="pts" rows="3">${esc((s.pts || []).join("\n"))}</textarea>
      <label>نص الراوي</label><textarea data-k="say" rows="4">${esc(s.say || "")}</textarea><label>أقل مدة للمشهد بالثواني (اختياري)</label><input data-k="min" type="number" min="0" max="120" value="${esc(s.min || "")}" style="max-width:140px"></div>`;
    view(`<p><a href="#/video">← الفيديوهات</a></p><h2>✂ مونتاج: ${esc(D.title)}</h2><p class="mut">عدّل العناوين والنقاط ونص الراوي، ورتّب المشاهد أو احذفها أو أضف غيرها، ثم أخرج الفيديو. الخيارات: ${esc((OPT.style.find(x => x[0] === O.style) || ["", ""])[1])} • ${esc(O.aspect || "16:9")} • ${esc(O.voice || "")}</p>
      <label>عنوان الفيديو</label><input id="vdt" value="${esc(D.title)}"><div id="vscs">${(D.scenes || []).map(row).join("")}</div>
      <div class="row"><button class="btn" id="vadd">＋ مشهد جديد</button><button class="btn p" id="vgo">🎬 حفظ وإخراج الفيديو</button><span id="vgost" class="mut"></span></div>`);
    const box = document.getElementById("vscs"), collect = keep => [...box.querySelectorAll(".vscene")].map(c => { const g = k => c.querySelector(`[data-k=${k}]`).value; return { h: g("h").trim(), pts: g("pts").split("\n").map(x => x.trim()).filter(Boolean), say: g("say").trim(), min: +g("min") || 0 }; }).filter(s => keep || s.say);
    const redraw = l => { box.innerHTML = l.map(row).join(""); };
    box.addEventListener("click", e => { const c = e.target.closest(".vscene"); if (!c) return; const l = collect(true), i = +c.dataset.i;
      if (e.target.closest("[data-del]")) { l.splice(i, 1); redraw(l); } else if (e.target.closest("[data-mv]")) { const j = i + +e.target.closest("[data-mv]").dataset.mv; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; redraw(l); } });
    document.getElementById("vadd").onclick = () => { const l = collect(true); l.push({ h: "", pts: [], say: "" }); redraw(l); };
    document.getElementById("vgo").onclick = async () => { const st = document.getElementById("vgost"), l = collect(false); if (!l.length) return st.textContent = "لا مشاهد فيها نص للراوي";
      st.textContent = "جارٍ الحفظ…"; try { await GH.editJSON("data/video/drafts/" + id + ".json", o => Object.assign(o || D, { title: document.getElementById("vdt").value.trim() || D.title, scenes: l, edited: new Date().toISOString() }), "فيديو: مونتاج «" + D.title + "»");
        await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push({ id: D.book, draft: id, at: new Date().toISOString() }); return o; }, "فيديو: إخراج «" + D.title + "»");
        st.textContent = "✓ أُرسل للإخراج؛ يظهر في الفيديوهات خلال دقائق بانتظار اعتمادك."; } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } };
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act^=vid]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "vidshare") { const d = { title: el.dataset.t, text: el.dataset.t + " — فيديو من المكتبة الرقمية للدعوة السلفية", url: el.dataset.u }; if (navigator.share) navigator.share(d).catch(() => { }); else { navigator.clipboard.writeText(d.url); toast("نُسخ رابط الفيديو"); } }
    else if (el.dataset.act === "vidok") { const b = el.dataset.b, k = +el.dataset.k; await GH.editJSON("data/video/_list.json", o => { if (o[b] && o[b][k]) o[b][k].ok = o[b][k].ok ? 0 : 1; return o; }, "فيديو: اعتماد"); LIST = null; route(); } });
  // رابط في «خدمات الكتاب»
  new MutationObserver(async () => { const nav = document.querySelector(".bkhub nav:not([data-vid])"); if (!nav) return; nav.dataset.vid = 1; const m = location.pathname.match(/book\/([^/]+)/); if (!m) return; const L = await list(), b = B(m[1]), id = b && b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : m[1];
    const l = (L[id] || []).filter(v => v.ok || may()); if (l.length || may()) nav.insertAdjacentHTML("beforeend", `<a href="#/video?b=${encodeURIComponent(id)}">🎬 ${l.length ? "فيديو الملخص" : "إعداد فيديو"}</a>`); }).observe(document.documentElement, { childList: true, subtree: true });
  return { view: page };
})();
