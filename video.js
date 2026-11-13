/* فيديوهات الكتب (#/video): ملخص الكتاب ومراجعته في فيديو بمشاهد وراوٍ (tools/book-video.py ← video.yml).
   للمدير: اختيار الكتاب ونوع الفيديو (ملخص أو مراجعة) ومدته وأبعاده (أفقي أو عمودي للهاتف) والصوت (Orus أو Charon) والسمة
   والمتطلبات، أو «✨ إبداع من الموقع» فيختار النموذج التصميم وتقسيم المشاهد؛ ثم الاعتماد للنشر. وفي «خدمات الكتاب» رابط فيديوهاته. */
const VIDX = (() => {
  const RAW = p => "https://raw.githubusercontent.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/main/" + p;
  let LIST = null; const list = async f => { if (LIST && !f) return LIST; try { const r = await fetch(RAW("data/video/_list.json") + "?t=" + Math.floor(Date.now() / 120e3)); LIST = r.ok ? await r.json() : {}; } catch (e) { LIST = {}; } return LIST; };
  const url = (bid, f) => "https://github.com/" + (CFG.repo || "dawah-library/sdsl-library") + "/releases/download/video-" + bid + "/" + f;
  const fmt = s => toAr(Math.floor(s / 60)) + ":" + toAr(String(s % 60).padStart(2, "0"));
  const VO = [["gemini:Orus", "Orus — رخيم هادئ (مقترح)"], ["gemini:Charon", "Charon — إخباري واضح"], ["gemini:Kore", "Kore — صوت أنثوي هادئ"], ["gemini:Puck", "Puck — حيوي للناشئة"]];
  async function page(q) {
    const L = await list(true), adm = isAdmin() || can("video"), bid = q.b;
    const vids = Object.entries(L).flatMap(([id, l]) => l.map((v, k) => Object.assign({ id, k }, v))).filter(v => (v.ok || adm) && (!bid || v.id === bid)).reverse();
    const sel = (n, o, d) => `<select name="${n}">${o.map(([v, t]) => `<option value="${v}"${v === d ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    view(`<div class="cmhero"><div><h2>🎬 فيديوهات الكتب</h2><p>ملخص الكتاب أو مراجعته في دقائق: مشاهد بعناوين الأبواب ونقاطها، وراوٍ يقرأ بألفاظ المؤلف، للمشاهدة والمشاركة.</p></div></div>
      ${adm ? `<details class="card"${bid ? " open" : ""}><summary><b>＋ توليد فيديو</b></summary><form id="vidf" data-form="noop">
        <label>الكتاب</label><input name="t" list="vidbooks" value="${esc(bid && B(bid) ? (B(bid).setTitle || B(bid).title) : "")}" placeholder="اكتب اسم الكتاب ثم اختره" required><datalist id="vidbooks">${lib.books.filter(b => !b.demo && !isArt(b) && !VOL2(b)).slice(0, 3000).map(b => `<option value="${esc(b.setTitle || b.title)}">`).join("")}</datalist>
        <div class="row"><div><label>النوع</label>${sel("style", [["summary", "ملخص الكتاب"], ["review", "مراجعة وأسئلة"]], "summary")}</div><div><label>المدة</label>${sel("len", [["short", "قصير (نحو ٣ دقائق)"], ["medium", "متوسط (نحو ٦ دقائق)"], ["long", "مفصّل (نحو ١٠ دقائق)"]], "medium")}</div>
        <div><label>الأبعاد</label>${sel("aspect", [["16:9", "أفقي ١٦:٩ (يوتيوب)"], ["9:16", "عمودي ٩:١٦ (الهاتف والمقاطع القصيرة)"]], "16:9")}</div><div><label>الصوت</label>${sel("voice", VO, "gemini:Orus")}</div>
        <div><label>السمة</label>${sel("theme", [["green", "أخضر وذهبي (هوية المكتبة)"], ["gold", "ورقي دافئ"], ["night", "ليلي"], ["auto", "يختارها النموذج"]], "green")}</div></div>
        <label>متطلبات المدير (اختياري)</label><textarea name="note" rows="2" placeholder="مثال: ركّز على الباب الثاني، وخاطب الشباب، واختم بسؤال للتفكير"></textarea>
        <div class="row"><button class="btn p">توليد بالخيارات</button><button type="button" class="btn" data-act="vidcre">✨ إبداع من الموقع</button><span id="vidst" class="mut"></span></div></form></details>` : ""}
      ${bid ? `<p><a href="#/video">← كل الفيديوهات</a> <b>${esc((B(bid) || {}).title || bid)}</b></p>` : ""}
      <div class="vidgrid">${vids.map(v => `<div class="card vidc"><video controls preload="metadata" playsinline src="${esc(url(v.id, v.f))}"${v.aspect === "9:16" ? ' class="tall"' : ""}></video><b>${esc(v.t)}</b><span class="mut">${v.style === "review" ? "مراجعة" : "ملخص"} • ${fmt(v.d || 0)} • ${esc((B(v.id) || {}).title || "")}</span>
        <div class="row"><a class="btn s" href="#/book/${esc(v.id)}/1">📖 الكتاب</a><a class="btn s" href="${esc(url(v.id, v.f))}" download>⬇ تنزيل</a>${adm ? `<button class="btn s ${v.ok ? "" : "p"}" data-act="vidok" data-b="${esc(v.id)}" data-k="${v.k}">${v.ok ? "إلغاء النشر" : "اعتماد ونشر"}</button>` : ""}${v.ok ? "" : ' <em class="tag">بانتظار الاعتماد</em>'}</div></div>`).join("") || '<p class="note">لا فيديوهات منشورة بعد.</p>'}</div>`);
    const f = document.getElementById("vidf"); if (!f) return;
    const send = async creative => { const t = f.t.value.trim(), b = lib.books.find(x => (x.setTitle || x.title) === t); const st = document.getElementById("vidst"); if (!b) return st.textContent = "اختر الكتاب من القائمة";
      const it = { id: b.set ? lib.books.find(x => x.set === b.set && !VOL2(x)).id : b.id, style: f.style.value, len: f.len.value, aspect: f.aspect.value, voice: f.voice.value, theme: creative ? "auto" : f.theme.value, note: f.note.value.trim(), creative: creative ? 1 : 0, at: new Date().toISOString() };
      st.textContent = "جارٍ الإضافة…"; try { await GH.editJSON("data/video/_queue.json", o => { o = o || { items: [] }; (o.items = o.items || []).push(it); return o; }, "فيديو: «" + t + "»"); st.textContent = "✓ أُضيف إلى الطابور؛ يجهز الفيديو خلال دقائق ويظهر هنا بانتظار اعتمادك."; } catch (e) { st.textContent = "تعذّر: " + (e.message || e); } };
    f._send = send; f.addEventListener("submit", e => { e.preventDefault(); send(false); });
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act^=vid]"); if (!el) return; e.preventDefault();
    if (el.dataset.act === "vidcre") { const f = document.getElementById("vidf"); if (f && f._send) f._send(true); }
    else if (el.dataset.act === "vidok") { const b = el.dataset.b, k = +el.dataset.k; await GH.editJSON("data/video/_list.json", o => { if (o[b] && o[b][k]) o[b][k].ok = o[b][k].ok ? 0 : 1; return o; }, "فيديو: اعتماد"); LIST = null; route(); } });
  // رابط في «خدمات الكتاب»
  new MutationObserver(async () => { const nav = document.querySelector(".bkhub nav:not([data-vid])"); if (!nav) return; nav.dataset.vid = 1; const m = location.pathname.match(/book\/([^/]+)/); if (!m) return; const L = await list(), b = B(m[1]), id = b && b.set ? (lib.books.find(x => x.set === b.set && !VOL2(x)) || b).id : m[1];
    const l = (L[id] || []).filter(v => v.ok || isAdmin() || can("video")); if (l.length || isAdmin() || can("video")) nav.insertAdjacentHTML("beforeend", `<a href="#/video?b=${encodeURIComponent(id)}">🎬 ${l.length ? "فيديو الملخص" : "توليد فيديو"}</a>`); }).observe(document.documentElement, { childList: true, subtree: true });
  return { view: page };
})();
