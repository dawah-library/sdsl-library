/* المساعد التقني (#/dev، للمدير): يكتب المدير طلب التطوير أو التعديل أو الإصلاح بلغته (إضافة قسم، تعديل واجهة، صنع أداة أو مفتاح،
   إصلاح خلل، تشغيل مهمة)، فيُحفظ في data/dev-requests.json. وجلسة Claude Code مجدولة (مرتين يوميًا) تقرأ الطلبات المعلّقة،
   فتنفّذها في المستودع وخدمات التشغيل (GitHub وVercel وSupabase) وفق قواعد HANDOFF.md، ثم تكتب ما فعلته في الطلب نفسه.
   لا يُنفَّذ الحذف ولا ما يمس حسابات الأعضاء إلا بإذن صريح في نص الطلب. */
const DEV = (() => {
  const P = "data/dev-requests.json", ST = { pending: ["⏳", "بانتظار التنفيذ"], doing: ["⚙️", "قيد التنفيذ"], done: ["✅", "نُفِّذ"], need: ["❓", "يحتاج توضيحًا"], rejected: ["⛔", "لم يُنفَّذ"] };
  const get = async () => { try { return JSON.parse((await GH.get(P)).text) || { items: [] }; } catch (e) { return { items: [] }; } };
  async function page(q) {
    if (!(Cloud.role === "admin" || GH.token)) return view('<div class="note">المساعد التقني للمدير.</div>');
    view(`<div class="cmhero"><div><h2>المساعد التقني</h2><p>اكتب ما تريد تطويره أو تعديله أو إصلاحه في الموقع، كما تكتبه لمبرمج. ينفّذه المساعد في جولاته المجدولة (مرتين يوميًا)، ويكتب لك هنا ما فعله.</p></div></div>
    <form id="devf" data-form="noop" class="card"><label>الطلب</label><textarea name="t" rows="5" required maxlength="4000" placeholder="مثال: أضف في صفحة المؤلف زرًا لتنزيل قائمة كتبه بصيغة Excel"></textarea>
     <div class="row"><div><label>النوع</label><select name="k"><option value="feature">تطوير أو إضافة</option><option value="fix">إصلاح خلل</option><option value="content">محتوى وبيانات</option><option value="ops">مهمة تشغيلية (مفاتيح، مهام آلية، نشر)</option></select></div><div><label>الأولوية</label><select name="p"><option value="2">عادية</option><option value="1">عاجلة</option><option value="3">لاحقًا</option></select></div></div>
     <label class="inl"><input type="checkbox" name="del"> أأذن بالحذف أو ما يمس حسابات الأعضاء إن لزم لهذا الطلب</label><br><button class="btn p">أرسل الطلب</button> <span id="devst" class="mut"></span></form>
    <h3>الطلبات</h3><div id="devl" class="mut">جارٍ التحميل…</div>`);
    $("#devf").addEventListener("submit", async e => { e.preventDefault(); const f = e.target, st = $("#devst"); st.textContent = "جارٍ الحفظ…";
      const it = { id: "d" + Date.now().toString(36), t: f.t.value.trim(), k: f.k.value, p: +f.p.value, del: f.del.checked ? 1 : 0, st: "pending", at: new Date().toISOString() };
      try { await GH.editJSON(P, o => { o = o && o.items ? o : { items: [] }; o.items.push(it); return o; }, "طلب للمساعد التقني: " + it.t.slice(0, 60)); st.textContent = "✓ أُرسل، ويُنفَّذ في الجولة القادمة"; f.reset(); list(); } catch (x) { st.textContent = "تعذّر: " + (x.message || x); } });
    list();
  }
  async function list() {
    const el = $("#devl"); if (!el) return; const o = await get(), L = (o.items || []).slice().reverse();
    el.innerHTML = L.length ? L.map(x => `<div class="stsec" style="margin:8px 0"><b>${(ST[x.st] || ["", ""])[0]} ${esc((ST[x.st] || ["", x.st])[1])}</b> <span class="mut">${esc(new Date(x.at).toLocaleString("ar-EG"))}${x.p === 1 ? " • عاجل" : ""}</span><p style="white-space:pre-line">${esc(x.t)}</p>${x.r ? `<div class="note" style="white-space:pre-line">${esc(x.r)}</div>` : ""}${x.st === "need" ? `<form data-form="noop" class="devans" data-id="${esc(x.id)}"><input name="a" placeholder="توضيحك" required><button class="btn s p">أرسل التوضيح</button></form>` : ""}${x.st === "pending" ? `<button class="btn s" data-act="devcancel" data-id="${esc(x.id)}">إلغاء</button>` : ""}</div>`).join("") : "<p>لا طلبات بعد.</p>";
    el.querySelectorAll(".devans").forEach(f => f.addEventListener("submit", async e => { e.preventDefault(); const id = f.dataset.id, a = f.a.value.trim();
      await GH.editJSON(P, o => { const x = o.items.find(y => y.id === id); if (x) { x.t += "\n\nتوضيح المدير: " + a; x.st = "pending"; } return o; }, "توضيح طلب للمساعد التقني"); list(); }));
  }
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act=devcancel]"); if (!el) return;
    if (!confirm("إلغاء الطلب؟")) return; await GH.editJSON(P, o => { o.items = o.items.filter(x => x.id !== el.dataset.id); return o; }, "إلغاء طلب للمساعد التقني"); list(); });
  return { view: page };
})();
