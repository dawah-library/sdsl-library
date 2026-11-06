/* جلب منشورات فيسبوك بجلسة المدير نفسه (#/fbin، للإدارة): لا دخول آلي ولا حسابات وهمية ولا زحف من الخادم.
   ١) «زر الجلب» (إشارة مرجعية): يضغطه المدير وهو يتصفح صفحة الشيخ في فيسبوك بحسابه، فيوسّع «عرض المزيد» ويلتقط المنشورات
      الظاهرة (النص والرابط والصورة)، ويفتح هذه الصفحة حاملًا إياها (window.name) دون إرسال شيء إلى خادم آخر.
   ٢) «انسخ والصق»: يحدد المدير محتوى الصفحة في فيسبوك وينسخه ويلصقه هنا، فتُستخرج المنشورات من نسخته.
   ثم يختار المدير المنشورات ويحدد الكاتب، فتدخل «مراجعة المستجلب» (data/import-review.json) بالمسار نفسه للإضافة اليدوية،
   وتُنشر بالعزو ورابط المنشور الأصلي. */
const FBIN = (() => {
  const SITE = location.origin;
  // الإشارة المرجعية: تعمل في صفحة فيسبوك المفتوحة
  const BM = "javascript:(async()=>{const W=t=>new Promise(r=>setTimeout(r,t));for(const b of [...document.querySelectorAll('div[role=button],span[role=button]')].filter(x=>/^(See more|عرض المزيد|المزيد)$/.test((x.innerText||'').trim()))){try{b.click()}catch(e){}}await W(1500);"
    + "const arts=[...document.querySelectorAll('[role=article]')].filter(a=>!a.parentElement.closest('[role=article]'));const out=[];"
    + "for(const a of arts){const m=a.querySelector('[data-ad-preview=message],[data-ad-comet-preview=message]')||[...a.querySelectorAll('div[dir=auto]')].sort((x,y)=>(y.innerText||'').length-(x.innerText||'').length)[0];const t=(m&&m.innerText||'').trim();if(t.length<40)continue;"
    + "const l=[...a.querySelectorAll('a[href]')].map(x=>x.href).find(h=>/\\/posts\\/|story_fbid|\\/permalink\\/|\\/videos\\/|pfbid/.test(h))||'';const im=[...a.querySelectorAll('img')].find(i=>i.naturalWidth>250&&/scontent|fbcdn/.test(i.src));"
    + "const tm=[...a.querySelectorAll('a[href]')].find(x=>x.href===l);out.push({text:t,u:l.split('?')[0].replace(/\\/$/,'')+(l.includes('story_fbid')?'?'+l.split('?')[1]:''),img:im?im.src:'',when:tm?(tm.getAttribute('aria-label')||tm.innerText||''):''})}"
    + "if(!out.length){alert('لم أجد منشورات ظاهرة. مرّر الصفحة لتظهر المنشورات ثم أعد الضغط.');return}"
    + "window.open('" + SITE + "/#/fbin','SDSLFB:'+JSON.stringify({page:{name:(document.querySelector('h1')||{}).innerText||document.title,url:location.href.split('?')[0]},posts:out.slice(0,60)}))})()";
  let DATA = null, SRC = null;
  const take = () => { try { if (window.name && window.name.startsWith("SDSLFB:")) { DATA = JSON.parse(window.name.slice(7)); window.name = ""; } } catch (e) { } };
  // استخراج المنشورات من نسخة الصفحة الملصقة (HTML)
  function fromPaste(html, text) {
    const d = new DOMParser().parseFromString(html || "", "text/html"), out = [];
    let arts = [...d.querySelectorAll('[role=article]')].filter(a => !a.parentElement.closest('[role=article]'));
    if (!arts.length) arts = [d.body];
    arts.forEach(a => { const m = a.querySelector('[data-ad-preview=message],[data-ad-comet-preview=message]'), t = ((m || a).textContent || "").replace(/\s+\n/g, "\n").trim();
      const l = [...a.querySelectorAll("a[href]")].map(x => x.getAttribute("href")).find(h => /\/posts\/|story_fbid|\/permalink\/|pfbid/.test(h || "")) || "";
      if (t.length >= 40) out.push({ text: t.slice(0, 6000), u: l, img: "", when: "" }); });
    if (!out.length && text) text.split(/\n{3,}/).map(x => x.trim()).filter(x => x.length >= 60).forEach(x => out.push({ text: x, u: "", img: "", when: "" }));
    return out;
  }
  async function page() {
    if (!isAdmin()) return view('<div class="note">هذه الصفحة للإدارة.</div>');
    take(); if (!SRC) { try { SRC = (await GH.get("data/sources.json")).text; SRC = JSON.parse(SRC).sources || []; } catch (e) { SRC = []; } }
    const fbs = SRC.filter(x => x.type === "facebook").sort((x, y) => x.name.localeCompare(y.name, "ar"));
    view(`<div class="cmhero"><div><h2>جلب منشورات فيسبوك</h2><p>من صفحات المشايخ التي حددتها الإدارة، بتصفحك أنت لفيسبوك بحسابك، ثم المراجعة والنشر بالعزو ورابط المنشور.</p></div></div>
    <details class="hfold"${DATA ? "" : " open"}><summary>الطريقة الأولى: زر الجلب (على الحاسوب)</summary><div>
      <ol><li>اسحب هذا الزر إلى شريط الإشارات المرجعية في متصفحك: <a class="btn p fbbm" href="${esc(BM)}" draggable="true">⬇ جلب إلى المكتبة</a></li>
      <li>افتح صفحة الشيخ في فيسبوك وأنت داخل بحسابك، ومرّر الصفحة حتى تظهر المنشورات التي تريدها.</li><li>اضغط «جلب إلى المكتبة» من شريط الإشارات، فتُفتح هذه الصفحة بالمنشورات.</li></ol>
      <p class="mut">الزر يعمل في متصفحك وحده؛ لا يحفظ كلمة مرورك ولا يرسل شيئًا إلا إلى هذه الصفحة.</p></div></details>
    <details class="hfold"><summary>الطريقة الثانية: انسخ والصق (حاسوب أو جوال)</summary><div><p>في صفحة الشيخ بفيسبوك: حدد المنشورات (أو اضغط Ctrl+A) وانسخها، ثم الصقها هنا:</p><div id="fbpaste" class="fbpaste" contenteditable="true" aria-label="الصق هنا"></div></div></details>
    <h3>المصادر المحددة</h3><div class="chips">${fbs.map(x => `<a class="chip" href="${esc(x.url || "https://www.facebook.com/" + (x.handle || ""))}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>`).join("") || '<span class="mut">أضف الحسابات من «الإدارة ← مراجعة المستجلب».</span>'}</div>
    <div id="fbres"></div>`);
    if (DATA) show(DATA, fbs);
    const pz = $("#fbpaste"); pz.addEventListener("paste", e => { e.preventDefault(); const cd = e.clipboardData, posts = fromPaste(cd.getData("text/html"), cd.getData("text/plain"));
      if (!posts.length) return toast("لم أجد منشورات في المنسوخ"); show({ page: { name: "", url: "" }, posts }, fbs); });
  }
  function show(D, fbs) {
    const guess = fbs.find(x => D.page && D.page.url && (x.url && D.page.url.includes((x.url.split("facebook.com/")[1] || "").split(/[/?]/)[0] || "~") || (x.handle && D.page.url.includes(x.handle)))) || fbs.find(x => D.page && D.page.name && norm(D.page.name).includes(norm(x.name).slice(0, 12)));
    $("#fbres").innerHTML = `<h3>المنشورات الملتقطة (${toAr(D.posts.length)})${D.page && D.page.name ? " — " + esc(D.page.name) : ""}</h3>
      <div class="row"><label>الكاتب <select id="fbsrc"><option value="">— اختر —</option>${fbs.map(x => `<option value="${esc(x.id)}"${guess && guess.id === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><input id="fban" placeholder="أو اكتب اسم الكاتب"></div>
      ${D.posts.map((p, i) => `<label class="fbi"><input type="checkbox" data-i="${i}"${p.text.length >= 80 ? " checked" : ""}><div><p>${esc(p.text.slice(0, 600))}${p.text.length > 600 ? "…" : ""}</p><small class="mut">${p.u ? `<a href="${esc(p.u)}" target="_blank" rel="noopener">رابط المنشور ↗</a>` : "بلا رابط (أضفه من المراجعة)"}${p.when ? " • " + esc(p.when) : ""}</small></div></label>`).join("")}
      <button class="btn p" id="fbsend">أرسل المختار إلى المراجعة</button> <span id="fbst" class="mut"></span>`;
    $("#fbsend").onclick = async () => { const sid = $("#fbsrc").value, s = SRC.find(x => x.id === sid), an = $("#fban").value.trim(); if (!s && !an) return toast("اختر الكاتب أو اكتب اسمه");
      const pick = [...document.querySelectorAll(".fbi input:checked")].map(x => D.posts[+x.dataset.i]); if (!pick.length) return toast("اختر منشورًا");
      const name = s ? s.author || s.name : an, a = lib.authors.find(x => !x.mergedInto && norm(x.name.replace(/^(الشيخ|د\.?)\s*/, "")) === norm(name.replace(/^(الشيخ|د\.?)\s*/, ""))), now = new Date().toISOString(), st = $("#fbst"); st.textContent = "جارٍ الإرسال…";
      try { let added = 0; await GH.editJSON("data/import-review.json", o => { o = o || { items: [] }; o.items = o.items || []; const have = new Set(o.items.map(x => x.u).filter(Boolean));
          pick.forEach((p, k) => { if (p.u && have.has(p.u)) return; const it = { id: (s ? s.id : "fbm") + "b" + Date.now().toString(36) + k, src: s ? s.id : "fb-manual", srcName: s ? s.name : an, col: "dawah", u: p.u || "", t: p.text.split("\n")[0].slice(0, 90), author: name, d: now, text: p.text, st: "pending", at: now, lic: "", to: "posts", via: "fbin" };
            if (s && s.aid) it.aid0 = s.aid; else if (a) it.aid0 = a.id; if (/^https:\/\//.test(p.img || "")) it.img = p.img; o.items.push(it); added++; }); return o; }, "منشورات فيسبوك للمراجعة (" + pick.length + ")", true);
        st.innerHTML = `✓ أُرسل ${toAr(added)} منشورًا إلى <a href="#/admin?t=imports">مراجعة المستجلب</a>${added < pick.length ? " (والباقي موجود من قبل)" : ""}.`; } catch (e) { st.textContent = "تعذّر: " + (e.message || e); } };
  }
  document.addEventListener("click", e => { if (e.target.closest(".fbbm")) { e.preventDefault(); toast("اسحب الزر إلى شريط الإشارات المرجعية، ثم اضغطه وأنت في صفحة فيسبوك."); } });
  return { view: page };
})();
