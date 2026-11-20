/* ElevenLabs في إدارة الصوتيات (المرحلة ٥): اختيار النموذج والصوت من الواجهة، والتحكم في السرعة والثبات والنبرة والأداء،
   ومعاينة بعينة من نص الكتاب نفسه (مشكولًا إن وُجد تشكيله)، وحالة الباقة، والتكلفة التقديرية للكتاب قبل التحويل.
   الإعدادات تُحفظ في data/audio/_settings.json → eleven، ويقرؤها tools/tts.py؛ والصوت «eleven:<id>» يظهر في قوائم أصوات التحويل.
   المفتاح في الخادم وحده (api/edit.js، mode=eleven). استنساخ الأصوات غير مفعّل (docs/elevenlabs.md). */
const ELV = (() => {
  const call = async (op, extra) => { const r = await fetch("/api/edit", { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + ((typeof Auth !== "undefined" && Auth.token) || "") }, body: JSON.stringify(Object.assign({ mode: "eleven", op }, extra || {})) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "تعذر"); return j; };
  const RATE = { eleven_multilingual_v2: 1, eleven_v3: 1, eleven_turbo_v2_5: 0.5, eleven_flash_v2_5: 0.5 };
  const USD_PER_1K = 0.22;  // تقريبي: باقة Creator (‏٢٢$ لكل ١٠٠ ألف رصيد)؛ وتنخفض في Pro/Scale
  const D = { model: "eleven_multilingual_v2", stability: 0.55, similarity: 0.8, style: 0.1, speed: 0.95, boost: true, voices: [] };
  let AS = {};
  const sl = (k, l, min, max, step, v) => `<label class="elsl">${l} <output>${v}</output><input type="range" name="${k}" min="${min}" max="${max}" step="${step}" value="${v}" oninput="this.previousElementSibling.value=this.value"></label>`;
  function card(box, settings, books) {
    AS = settings || {}; const E = Object.assign({}, D, AS.eleven || {});
    box.insertAdjacentHTML("afterbegin", `<div class="card elcard"><h3>🎙️ ElevenLabs — أصوات عربية احترافية</h3>
      <p class="mut">ربط مباشر بواجهة ElevenLabs: النموذج والصوت والسرعة والثبات والنبرة من هنا، ويُسجَّل الكتاب بها عند اختيار صوت «ElevenLabs» في التحويل. النص المشكول المدقق يُرسل متى وُجد (أدق نطقًا)، والوقفات تُراعى عند العناوين والفقرات وعلامات الترقيم. سقف شهري للأحرف يمنع تجاوز الباقة.</p>
      <div id="elst" class="mut">جارٍ الاتصال…</div>
      <form data-form="elset"><div class="row"><div><label>النموذج</label><select name="model" id="elmodel"></select></div><div><label>الصوت</label><select name="voice" id="elvoice"><option value="">— حمّل الأصوات —</option></select></div></div>
      <div class="elsls">${sl("speed", "السرعة", 0.7, 1.2, 0.05, E.speed)}${sl("stability", "الثبات (أعلى = أهدأ وأثبت)", 0, 1, 0.05, E.stability)}${sl("similarity", "المطابقة للصوت", 0, 1, 0.05, E.similarity)}${sl("style", "الأداء والنبرة (أعلى = أكثر تعبيرًا)", 0, 1, 0.05, E.style)}</div>
      <label class="inl"><input type="checkbox" name="boost"${E.boost ? " checked" : ""}> تعزيز وضوح المتحدث</label>
      <label>نص المعاينة</label><textarea name="t" rows="2">قال الله تعالى: ﴿إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ﴾، وطلبُ العلمِ فريضةٌ على كل مسلم.</textarea>
      <div class="row"><button type="button" class="btn" data-act="elprev">▶ معاينة</button><button class="btn p">حفظ الإعدادات والصوت</button> <span id="elss" class="mut"></span></div><audio id="elaud" controls hidden></audio>
      <h4>التكلفة التقديرية قبل التحويل</h4><div class="row"><select id="elbook">${books.slice(0, 3000).map(b => `<option value="${b.id}">${esc(b.setTitle || b.title)}</option>`).join("")}</select><button type="button" class="btn s" data-act="elcost">احسب</button></div><p id="elcostr" class="mut"></p></form></div>`);
    call("status").then(j => {
      $("#elst").innerHTML = `الباقة: <b>${esc(j.tier || "")}</b> • المستهلك ${toAr(j.used || 0)} من ${toAr(j.limit || 0)} حرف${j.reset ? " • يتجدد " + new Date(j.reset * 1000).toLocaleDateString("ar-EG") : ""}`;
      $("#elmodel").innerHTML = j.models.map(([k, t]) => `<option value="${k}"${E.model === k ? " selected" : ""}>${esc(t)}</option>`).join("");
      return call("voices");
    }).then(j => { window.__elv = j.voices; const ar = v => /ar|arab/i.test(v.lang + v.accent + v.desc);
      $("#elvoice").innerHTML = j.voices.sort((a, b) => (ar(b) - ar(a))).map(v => `<option value="${v.id}"${(AS.voice || "") === "eleven:" + v.id ? " selected" : ""}>${esc(v.name)}${ar(v) ? " (عربي)" : ""} — ${esc([v.gender, v.accent, v.cat].filter(Boolean).join("، "))}</option>`).join(""); })
      .catch(x => { $("#elst").textContent = x.message; $("#elmodel").innerHTML = Object.keys(RATE).map(k => `<option${E.model === k ? " selected" : ""}>${k}</option>`).join(""); });
  }
  const form = () => document.querySelector("[data-form=elset]");
  const vals = f => ({ model: f.model.value, speed: +f.speed.value, stability: +f.stability.value, similarity: +f.similarity.value, style: +f.style.value, boost: f.boost.checked });
  async function textFor(id) { const b = await loadBook(id); let n = 0; b.pages.forEach(p => n += String(p || "").split(/^\s*_{4,}\s*$/m)[0].length); return n; }
  document.addEventListener("click", async e => {
    const el = e.target.closest('[data-act="elprev"],[data-act="elcost"]'); if (!el) return; e.preventDefault(); const f = form();
    try {
      if (el.dataset.act === "elprev") { el.disabled = true; $("#elss").textContent = "جارٍ التوليد…"; const j = await call("preview", { text: f.t.value, voice: f.voice.value, settings: vals(f) }); const a = $("#elaud"); a.hidden = false; a.src = j.audio; a.play(); $("#elss").textContent = "عينة بـ" + j.model + " (" + toAr(j.chars) + " حرف)"; }
      else { const n = await textFor($("#elbook").value), r = RATE[f.model.value] || 1, cr = Math.round(n * r); $("#elcostr").textContent = `نحو ${toAr(n)} حرف ← ${toAr(cr)} رصيد ElevenLabs، أي نحو ${toAr((cr / 1000 * USD_PER_1K).toFixed(1))}$ بسعر باقة Creator (أقل في الباقات الأعلى). السقف الشهري الحالي يُضبط بمتغير ELEVEN_MONTHLY_CHARS.`; }
    } catch (x) { $("#elss").textContent = x.message; } finally { el.disabled = false; }
  });
  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=elset]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation();
    if (!GH.on) return $("#elss").textContent = "فعّل الإدارة المباشرة أولًا.";
    const v = (window.__elv || []).find(x => x.id === f.voice.value), E = Object.assign(vals(f), { voices: [] });
    try { await GH.editJSON("data/audio/_settings.json", o => { o = o || {}; const old = (o.eleven || {}).voices || []; E.voices = v ? [[v.id, v.name]].concat(old.filter(x => x[0] !== v.id)).slice(0, 12) : old; o.eleven = E; return o; }, "صوتيات: إعدادات ElevenLabs");
      $("#elss").textContent = "✓ حُفظت؛ اختر «ElevenLabs: " + (v ? v.name : "") + "» في تحويل الكتاب أو صوتًا افتراضيًّا"; } catch (x) { $("#elss").textContent = x.message; }
  }, true);
  // أصوات ElevenLabs المحفوظة تظهر في قوائم اختيار الصوت
  const optgroup = (AS_, sel) => { const L = ((AS_ || {}).eleven || {}).voices || []; return L.length ? `<optgroup label="ElevenLabs (احترافي، مدفوع)">${L.map(([id, n]) => `<option value="eleven:${esc(id)}"${sel === "eleven:" + id ? " selected" : ""}>ElevenLabs: ${esc(n)}</option>`).join("")}</optgroup>` : ""; };
  return { card, optgroup };
})();
