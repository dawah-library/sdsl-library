/* طلب تصحيح الأسئلة في الموقع كله (طلب المدير، ٢١ نوفمبر ٢٠٢٦): تحت كل سؤال من أسئلة الاختبارات والمسابقات والألعاب
   (الطلائع، المِسبار، اختبارات الكتب، سؤال وجواب، تمارين الأساس والبنيان، قصص الطلائع) زر «⚑ طلب تصحيح»:
   - العضو يكتب الخطأ والصواب المقترح، ويستطيع طلب «مراجعة آلية» (api/edit.js mode=qcheck) وإرفاقها؛ فيُحفظ الطلب في جدول
     corrections (book_id = "q:<المسار>"، page = 0، proposed = JSON) ويصل إلى الإدارة في «تصحيحات القراء» وإلى تليجرام.
   - المدير يرى «✎ تعديل» للأسئلة المحفوظة في بنك أسئلة الطلائع (data/tala-bank.json) فيعدّلها مباشرة، أو يستبعدها.
   الزر يُضاف آليًّا لكل عنصر سؤال معروف (QSEL) دون تعديل كل قسم. */
const QFIX = (() => {
  const QSEL = ".talaq, .tpq, .msbq, .qq, .qaq, .tmq, section.q > .qt";
  const SKIP = /ابحث عن الكلمات|اضغط الحروف|ركّب|اختر سورة/;
  const adm = () => typeof isAdmin === "function" && isAdmin();
  const optsOf = el => { const box = el.closest(".tala, .msb, .card, section, article, #app") || document; return [...box.querySelectorAll(".talaopt, .msbo, .tpo, .tpopt, .qo, .tmo, button[data-ok]")].map(b => b.textContent.trim()).filter(Boolean).slice(0, 6); };
  let BANK = null; const bank = async () => BANK || (BANK = await fetch("data/tala-bank.json?t=" + Math.floor(Date.now() / 60e3)).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })));
  const norm = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();
  function inject() { document.querySelectorAll(QSEL).forEach(q => { if (q.dataset.qf || SKIP.test(q.textContent) || q.textContent.trim().length < 6) return; q.dataset.qf = 1;
    q.insertAdjacentHTML("afterend", `<div class="qfixbar"><button type="button" class="qfixb" data-act="qfix">⚑ طلب تصحيح</button>${adm() ? '<button type="button" class="qfixb" data-act="qfixed">✎ تعديل (للإدارة)</button>' : ""}</div>`); }); }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
  const ctxOf = btn => { const q = btn.closest(".qfixbar").previousElementSibling; return { q: (q ? q.textContent : "").trim().slice(0, 900), o: q ? optsOf(q) : [], r: location.hash.slice(0, 200), t: document.title.slice(0, 120) }; };
  async function ask(btn) { const c = ctxOf(btn);
    openSheet("طلب تصحيح سؤال", `<div class="qfixf" data-noswipe><p class="qfixq">${esc(c.q)}</p>${c.o.length ? `<p class="mut">الخيارات: ${c.o.map(esc).join(" • ")}</p>` : ""}
      <label>ما الخطأ؟ وما الصواب المقترح (ومصدره إن وُجد)؟<textarea id="qfixn" rows="4" maxlength="1500" placeholder="مثال: الجواب الصحيح هو … لأن …"></textarea></label>
      <div class="row"><button class="btn s" data-act="qfixai">🤖 مراجعة آلية</button><button class="btn p" data-act="qfixsend">إرسال إلى الإدارة</button></div><div id="qfixai" class="mut"></div><p id="qfixst" class="mut" role="status"></p></div>`);
    window.__qfix = c; }
  async function ai() { const c = window.__qfix, el = document.getElementById("qfixai"); if (!c || !el) return;
    if (typeof Auth === "undefined" || !Auth.user) return typeof needLogin === "function" ? needLogin("المراجعة الآلية للأعضاء المسجلين.") : null;
    el.textContent = "جارٍ المراجعة…";
    try { const r = await fetch("api/edit", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + (Auth.token || "") }, body: JSON.stringify({ mode: "qcheck", text: "السؤال: " + c.q + (c.o.length ? "\nالخيارات: " + c.o.join(" | ") : "") + "\nالصفحة: " + c.t }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "تعذرت المراجعة");
      c.ai = String(j.text || "").slice(0, 2000); el.innerHTML = `<div class="qfixres">${esc(c.ai).replace(/\n/g, "<br>")}</div><p class="mut">تُرفق هذه المراجعة بطلبك إن أرسلته.</p>`; }
    catch (e) { el.textContent = e.message; } }
  async function send() { const c = window.__qfix, st = document.getElementById("qfixst"), n = (document.getElementById("qfixn") || {}).value || ""; if (!c) return;
    if (!n.trim() && !c.ai) { st.textContent = "اكتب ملاحظتك أو اطلب المراجعة الآلية أولًا."; return; }
    if (typeof Auth === "undefined" || !Auth.user || !Auth.sb) return typeof needLogin === "function" ? needLogin("طلب التصحيح للأعضاء المسجلين.") : null;
    st.textContent = "جارٍ الإرسال…";
    try { const { error } = await Auth.sb.from("corrections").insert({ book_id: "q:" + c.r, page: 0, proposed: JSON.stringify({ q: c.q, o: c.o, t: c.t, ai: c.ai || "" }), note: n.trim().slice(0, 1500), user_id: Auth.user.id, user_name: Auth.user.name || "" });
      if (error) throw new Error(error.message);
      if (typeof tgNote === "function") try { tgNote("corr", { name: Auth.user.name || Auth.user.email, subject: "طلب تصحيح سؤال", detail: c.q.slice(0, 300) + "\n— " + n.slice(0, 300) }); } catch (e) { }
      st.textContent = "✓ وصل طلبك إلى الإدارة، جزاك الله خيرًا."; }
    catch (e) { st.textContent = "تعذر الإرسال: " + e.message; } }
  // تعديل المدير لسؤال من بنك أسئلة الطلائع مباشرة
  async function edit(btn) { const c = ctxOf(btn), B = await bank(), x = (B.items || []).find(i => norm(i.q) && (norm(c.q).includes(norm(i.q)) || norm(i.q).includes(norm(c.q))));
    if (!x) return openSheet("تعديل السؤال", `<p>${esc(c.q)}</p><p class="mut">هذا السؤال ليس من بنك الأسئلة المتجدد (أسئلة ثابتة في الشيفرة أو مولَّدة من نصوص المكتبة)، فيُصحَّح من مصدره. أرسل «طلب تصحيح» ليُحفظ في «تصحيحات القراء» ويُعالج.</p>`);
    openSheet("تعديل سؤال من بنك الأسئلة", `<form class="qfixf" data-form="qfixsave" data-id="${esc(x.id)}"><label>السؤال<textarea name="q" rows="2">${esc(x.q)}</textarea></label>
      ${x.t === "mc" ? `<label>الجواب الصحيح<input name="a" value="${esc(x.a || "")}"></label><label>الخيارات الخاطئة (سطر لكل خيار)<textarea name="o" rows="3">${esc((x.o || []).join("\n"))}</textarea></label>` : `<label>الحكم<select name="v"><option value="1"${x.v ? " selected" : ""}>صح</option><option value="0"${x.v ? "" : " selected"}>خطأ</option></select></label>`}
      <label>التعليل<input name="why" value="${esc(x.why || "")}"></label><p class="mut">الدليل من المصدر: «${esc(x.ev || "")}» — <a href="${esc((x.src || {}).u || "#")}">${esc((x.src || {}).t || "")}</a></p>
      <div class="row"><button class="btn p">حفظ التعديل</button><button type="button" class="btn s" data-act="qfixdrop" data-id="${esc(x.id)}">استبعاد السؤال</button></div><p id="qfixst" class="mut"></p></form>`); }
  async function saveBank(id, f, msg) { if (typeof GH === "undefined" || !GH.on) throw new Error("فعّل الإدارة المباشرة أولًا.");
    await GH.editJSON("data/tala-bank.json", o => { (o.items || []).forEach(x => { if (x.id === id) f(x); }); return o; }, msg); BANK = null; }
  document.addEventListener("submit", async e => { const f = e.target.closest("[data-form=qfixsave]"); if (!f) return; e.preventDefault(); e.stopImmediatePropagation(); const fd = new FormData(f), st = f.querySelector("#qfixst");
    try { await saveBank(f.dataset.id, x => { x.q = String(fd.get("q")).trim(); x.why = String(fd.get("why") || "").trim(); if (x.t === "mc") { x.a = String(fd.get("a")).trim(); x.o = String(fd.get("o")).split("\n").map(s => s.trim()).filter(Boolean).slice(0, 3); } else x.v = fd.get("v") === "1"; x.ok = 1; x.ed = new Date().toISOString().slice(0, 10); }, "الطلائع: تعديل سؤال من بنك الأسئلة");
      st.textContent = "✓ حُفظ، ويظهر للجميع خلال دقائق."; } catch (x) { st.textContent = x.message; } }, true);
  document.addEventListener("click", async e => { const b = e.target.closest("[data-act^=qfix]"); if (!b) return; e.preventDefault(); e.stopPropagation(); const a = b.dataset.act;
    if (a === "qfix") ask(b); else if (a === "qfixai") ai(); else if (a === "qfixsend") send(); else if (a === "qfixed") edit(b);
    else if (a === "qfixdrop") { try { await saveBank(b.dataset.id, x => { x.x = 1; }, "الطلائع: استبعاد سؤال من بنك الأسئلة"); const st = document.getElementById("qfixst"); if (st) st.textContent = "✓ استُبعد."; } catch (x) { toast(x.message); } } }, true);
  // عرض طلبات تصحيح الأسئلة في «تصحيحات القراء» (corrList في app.js)
  function corrHtml(r) { let d = {}; try { d = JSON.parse(r.proposed || "{}"); } catch (e) { }
    return `<div class="studio corr" data-cid="${r.id}" data-q="1" style="margin-top:10px"><b>⚑ طلب تصحيح سؤال</b> <span class="mut">من ${esc(r.user_name || "عضو")} • ${esc(typeof ago === "function" ? ago(r.created_at) : r.created_at)} • <a href="${esc(String(r.book_id).slice(2))}">موضعه</a></span>
      <p class="qfixq">${esc(d.q || "")}</p>${(d.o || []).length ? `<p class="mut">الخيارات: ${d.o.map(esc).join(" • ")}</p>` : ""}${r.note ? `<p><b>ملاحظة العضو:</b> ${esc(r.note)}</p>` : ""}${d.ai ? `<div class="qfixres"><b>🤖 المراجعة الآلية:</b><br>${esc(d.ai).replace(/\n/g, "<br>")}</div>` : ""}
      <div class="row"><button class="btn p nf" data-act="corrok">صُحّح (إغلاق الطلب)</button><button class="btn nf" data-act="corrno">رفض</button></div></div>`; }
  return { inject, corrHtml };
})();
