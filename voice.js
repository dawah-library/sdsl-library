/* الصوت في الموقع (voice.js):
   ١) VOICE.listen: محرك التعرف على الكلام العربي (Web Speech API في المتصفح، وبديله تسجيل الصوت وتفريغه بالخادم api/ask op=stt).
   ٢) البحث الصوتي: زر 🎤 يُضاف آليًّا إلى كل خانة بحث في الموقع (المكتبة، المقالات، المصحف، الحديث، المساعدَين…)،
      ويختار من بدائل التعرف أقربها إلى مفردات المكتبة (عناوين الكتب وأسماء المؤلفين والمصطلحات الشرعية) لرفع الدقة.
   ٣) TASMEE: وضع التسميع والحفظ (المصحف والحديث والمتون): يُخفى النص وتظهر الكلمة بعد قراءتها صحيحة فقط. */
const VOICE = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canSR = !!SR, canRec = !!(navigator.mediaDevices && window.MediaRecorder);
  const AR = s => String(s || "").replace(/[ً-ْٰـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/[^ء-ي0-9a-z\s]/gi, " ").replace(/\s+/g, " ").trim();
  // مصطلحات يكثر خطأ التعرف فيها: تُصحَّح إلى رسمها المعروف
  const FIX = [[/صلي الله عليه وسلم|صلى الله عليه و سلم/g, "صلى الله عليه وسلم"], [/\bابن تيميه\b/g, "ابن تيمية"], [/\bياسر برهامي\b|\bياسر البرهامي\b/g, "ياسر برهامي"], [/\bالسلفيه\b/g, "السلفية"]];
  let VOC = null;
  const vocab = () => { if (VOC) return VOC; VOC = new Set(); try { (typeof lib !== "undefined" ? lib.books : []).slice(0, 20000).forEach(b => AR(b.title).split(" ").forEach(w => w.length > 2 && VOC.add(w)));
    (typeof lib !== "undefined" ? lib.authors : []).forEach(a => AR(a.name).split(" ").forEach(w => w.length > 2 && VOC.add(w))); } catch (e) { } return VOC; };
  const score = t => { const v = vocab(), w = AR(t).split(" ").filter(Boolean); return w.length ? w.filter(x => v.has(x)).length / w.length : 0; };
  const best = alts => { if (!alts.length) return ""; let b = alts[0], bs = -1; alts.forEach((a, i) => { const s = score(a.t) + (a.c || 0) * .5 - i * .05; if (s > bs) { bs = s; b = a; } }); let t = b.t; FIX.forEach(([r, x]) => t = t.replace(r, x)); return t; };
  // استماع واحد: يعيد النص (أو يتابع الكلام مع interim/continuous لخدمة التسميع)
  function listen(o) {
    o = o || {}; const lang = o.lang || "ar-EG";
    if (canSR) {
      const r = new SR(); r.lang = lang; r.interimResults = !!o.interim; r.continuous = !!o.continuous; r.maxAlternatives = o.alts || 5;
      r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i], alts = [...res].map(a => ({ t: a.transcript, c: a.confidence }));
        if (o.onResult) o.onResult(o.raw ? alts : best(alts), res.isFinal, alts, i); } };
      r.onerror = e => o.onError && o.onError(e.error === "not-allowed" ? "لم يُسمح باستخدام الميكروفون" : e.error === "no-speech" ? "لم يُسمع كلام" : e.error);
      r.onend = () => o.onEnd && o.onEnd(); try { r.start(); } catch (e) { o.onError && o.onError(e.message); }
      return { stop: () => { try { r.stop(); } catch (e) { } }, abort: () => { try { r.abort(); } catch (e) { } } };
    }
    if (!canRec) { o.onError && o.onError("المتصفح لا يدعم التعرف على الصوت؛ جرّب Chrome أو Edge أو Safari الحديث"); return { stop() { }, abort() { } }; }
    // البديل: تسجيل ثم تفريغ بالخادم (Gemini) — لمتصفحات بلا Web Speech (Firefox)
    let mr = null, chunks = [], stream = null, dead = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(s => { stream = s; mr = new MediaRecorder(s); mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = async () => { stream.getTracks().forEach(t => t.stop()); if (dead) return o.onEnd && o.onEnd();
        try { const t = await stt(new Blob(chunks, { type: mr.mimeType || "audio/webm" }), o.hint); if (o.onResult) o.onResult(t, true, [{ t }]); } catch (e) { o.onError && o.onError(e.message); } o.onEnd && o.onEnd(); };
      mr.start(); setTimeout(() => mr && mr.state === "recording" && mr.stop(), o.max || 12000); }).catch(() => { o.onError && o.onError("لم يُسمح باستخدام الميكروفون"); o.onEnd && o.onEnd(); });
    return { stop: () => mr && mr.state === "recording" && mr.stop(), abort: () => { dead = true; mr && mr.state === "recording" && mr.stop(); } };
  }
  // تفريغ ملف صوتي بالخادم (يستعمله المساعد العلمي أيضًا لرفع الملفات الصوتية)
  async function stt(blob, hint) {
    const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob); });
    const h = { "Content-Type": "application/json" }; try { const tk = typeof Auth !== "undefined" && Auth.sb && (await Auth.sb.auth.getSession()).data.session; if (tk) h.Authorization = "Bearer " + tk.access_token; } catch (e) { }
    const r = await fetch((CFG.askEndpoint || "api/ask"), { method: "POST", headers: h, body: JSON.stringify({ op: "stt", mime: blob.type || "audio/webm", audio: b64, hint: hint || "" }) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.text) throw new Error(j.error || "تعذّر التفريغ"); return j.text;
  }

  // ---------- البحث الصوتي في كل خانات البحث ----------
  // رمز الميكروفون العالمي (خطّي بلون السمة)، ومعه موجات تنبض أثناء الاستماع
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg><i class="vwave" aria-hidden="true"><b></b><b></b><b></b></i>';
  const SEL = 'input[type=search],input[name=q],input[data-voice],textarea[data-voice]';
  // الإملاء المتصل: يجمع الكلام عبر التوقفات ولا يمسح ما قيل؛ إذا أنهى المتصفح الاستماع عند السكوت أُعيد تلقائيًّا
  // وأُلحق الكلام الجديد بما سبقه. o.submit: إرسال تلقائي بعد سكوت o.silence (البحث)، وإلا يبقى حتى يضغط المستخدم (السؤال).
  const ANDROID = /Android/i.test(navigator.userAgent);
  function dictate(inp, o) {
    o = o || {}; const keep = o.append && inp.value.trim() ? inp.value.replace(/\s*$/, " ") : "";
    let acc = keep, cur = "", h = null, live = true, sub = false, heard = false, t1 = null, t0 = Date.now();
    const put = () => { inp.value = (acc + cur).replace(/[ \t]+/g, " ").replace(/^ /, ""); inp.dispatchEvent(new Event("input", { bubbles: true })); try { inp.scrollLeft = inp.scrollWidth; inp.scrollTop = inp.scrollHeight; } catch (e) { } };
    const idle = () => { clearTimeout(t1); const ms = heard ? (o.silence || 0) : (o.wait || 9000); if (ms) t1 = setTimeout(() => finish(!!o.submit && heard), ms); };
    const done = () => { clearTimeout(t1); cur = ""; put(); o.onEnd && o.onEnd(); if (sub && inp.value.trim()) { const f = inp.form; if (f && !inp.dataset.nosubmit) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); } else inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); } };
    function run() {
      const seg = []; h = listen({ continuous: !ANDROID, interim: true, lang: o.lang,
        onResult: (t, fin, alts, i) => { heard = heard || !!String(t).trim(); if (!canSR) { acc += t + " "; cur = ""; put(); return; }
          seg[i == null ? seg.length : i] = t; cur = seg.filter(Boolean).join(" "); put(); idle(); },
        onError: m => { if (/لم يُسمع|aborted/.test(m)) return; if (/لم يُسمح|not-allowed|service-not-allowed|المتصفح لا يدعم/.test(m)) live = false; o.onError && o.onError(m); },
        onEnd: () => { h = null; acc = (acc + cur).replace(/\s*$/, " "); cur = "";
          if (live && canSR && Date.now() - t0 < (o.max || 180000)) setTimeout(() => live ? run() : done(), 120); else { live = false; done(); } } });
    }
    function finish(s) { if (!live && !h) return; live = false; sub = s; clearTimeout(t1); if (h) h.stop(); else done(); }
    run(); idle(); return { stop: s => finish(s === undefined ? !!o.submit && heard : s), abort: () => { sub = false; live = false; if (h) h.abort(); else done(); } };
  }
  function arm(inp) {
    if (inp.dataset.vmic || inp.dataset.novoice !== undefined || inp.closest("#side,#sheetB .pbl") || (!canSR && !canRec)) return; inp.dataset.vmic = 1;
    const b = document.createElement("button"); b.type = "button"; b.className = "vmic"; b.title = "البحث بالصوت"; b.setAttribute("aria-label", "البحث بالصوت"); b.innerHTML = MIC;
    // الميكروفون داخل الخانة نفسها (كمحركات البحث): غلاف نسبي يحمل الخانة والزر في طرفها
    const ta = inp.tagName === "TEXTAREA", inbox = inp.parentElement && inp.parentElement.classList.contains("aiin");
    if (inbox) { inp.insertAdjacentElement("afterend", b); b.classList.add("vin"); }
    else { const w = document.createElement("span"); w.className = "vfield" + (ta ? " vta" : ""); if (inp.style.flex) w.style.flex = inp.style.flex; if (inp.style.width) { w.style.width = inp.style.width; inp.style.width = ""; }
      if (inp.style.maxWidth) w.style.maxWidth = inp.style.maxWidth; const af = document.activeElement === inp; inp.parentNode.insertBefore(w, inp); w.appendChild(inp); w.appendChild(b); if (af) inp.focus(); }
    let h = null; const ask = ta || inp.dataset.nosubmit !== undefined;
    b.onclick = () => {
      if (h) { h.stop(); return; } const ph = inp.placeholder; b.classList.add("on"); b.title = "إنهاء"; inp.placeholder = "تكلَّم الآن… يُكمل الكلام بعد التوقف";
      h = dictate(inp, { append: ask, submit: !ask, silence: ask ? 0 : 2200, onError: m => typeof toast === "function" && toast("🎤 " + m),
        onEnd: () => { h = null; b.classList.remove("on"); b.title = "البحث بالصوت"; inp.placeholder = ph; if (ask) inp.focus(); } });
    };
  }
  const scan = root => (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach(arm);
  if (document.readyState !== "loading") scan(document); else document.addEventListener("DOMContentLoaded", () => scan(document));
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches(SEL)) arm(n); else if (n.querySelector && n.querySelector(SEL)) scan(n); } }).observe(document.documentElement, { childList: true, subtree: true });
  return { listen, dictate, stt, AR, canSR, canRec, ok: canSR || canRec, arm, MIC };
})();

/* ---------- وضع التسميع والحفظ (TASMEE) ----------
   يعمل في صفحة المصحف (خط المصحف أو النص العثماني) وصفحة الحديث (السند والمتن): زر «🎙 وضع التسميع والحفظ»
   يخفي الكلمات مع بقاء الصفحة وتنسيقها، ثم يتعرف على قراءة العضو كلمةً كلمة: لا تظهر الكلمة إلا إذا قُرئت صحيحة بالترتيب،
   ويتوقف الإظهار عند الخطأ أو التجاوز مع تنبيه لطيف وموضع التعثر. المطابقة تتسامح في الحركات والهمزات والتاء المربوطة
   واختلاف رسم المصحف (الألف الخنجرية والواو والياء الصغيرتين) وأخطاء النطق اليسيرة (فرق حرف في الكلمة الطويلة)، وتميزها عن تبديل الكلمة.
   البدائل: كتابة المحفوظ بدل الصوت. ويُحفظ على الجهاز مستوى الإتقان ومواضع التعثر لكل سورة أو حديث (tsm_v1) لاقتراح المراجعة. */
const TASMEE = (() => {
  const N = s => VOICE.AR(String(s || "").replace(/[ۖ-ࣰٰۭ-ࣿ]/g, "").replace(/ٱ/g, "ا")).replace(/^(?:ال)(?=..)/, "ال").replace(/\s+/g, "");
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 9; const d = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
  // تساوي الكلمتين: بعد التطبيع، أو بفرق حرف في الكلمة الطويلة (خطأ نطق يسير)، أو بالسوابق المتصلة (و، ف، ب، ل، ك)
  const same = (r, t) => { r = N(r); t = N(t); if (!r || !t) return false; if (r === t) return true; const s = x => x.replace(/^[وفبلك](?=...)/, "").replace(/ا/g, "").replace(/[يو](?=.)/g, ""); if (s(r) === s(t)) return true; return t.length >= 5 && lev(r, t) <= 1; };
  const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  let S = null;  // الجلسة الحالية
  const wordsOf = root => {
    const q = root.querySelectorAll(".qpage .qg[data-t]"); if (q.length) return [...q].map(e => ({ e, t: e.dataset.t, k: e.dataset.k }));
    const w = root.querySelectorAll(".qtext .qw"); if (w.length) return [...w].map(e => ({ e, t: e.textContent, k: e.dataset.s + ":" + e.dataset.a }));
    const out = []; root.querySelectorAll(".hds,.hdm").forEach((p, pi) => { if (!p.dataset.tsw) { p.dataset.tsw = 1; p.innerHTML = esc(p.textContent).split(/(\s+)/).map(x => /\S/.test(x) && /[ء-ي]/.test(x) ? `<span class="tsw">${x}</span>` : x).join(""); }
      p.querySelectorAll(".tsw").forEach(e => out.push({ e, t: e.textContent, k: pi ? "متن" : "سند" })); }); return out; };
  function start(root, key, title) {
    stop(); const W = wordsOf(root); if (!W.length) return toast("لا نص للتسميع هنا");
    S = { root, key, title, W, i: 0, err: 0, errs: {}, h: null, seg: {}, t0: Date.now() }; root.classList.add("tsm-on"); W.forEach(w => w.e.classList.add("tsw-h"));
    const from = root.querySelector(".tsm-from"); if (from) { const i = W.findIndex(w => w.e === from || from.contains(w.e)); if (i > 0) { for (let j = 0; j < i; j++) show(j); S.i = i; } }
    panel(); cur(); }
  const show = j => { const w = S.W[j]; if (w) { w.e.classList.remove("tsw-h", "tsw-x"); w.e.classList.add("tsw-ok"); } };
  function cur() { S.W.forEach(w => w.e.classList.remove("tsw-cur")); const w = S.W[S.i]; if (w) { w.e.classList.add("tsw-cur"); if (!inView(w.e)) w.e.scrollIntoView({ block: "center", behavior: "smooth" }); } prog(); if (S.i >= S.W.length) done(); }
  const inView = e => { const r = e.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 120; };
  function prog() { const el = document.getElementById("tsmp"); if (!el) return; const p = Math.round(S.i * 100 / S.W.length); el.querySelector("i").style.width = p + "%"; el.querySelector("b").textContent = toAr(p) + "٪"; el.querySelector("span").textContent = toAr(S.i) + " من " + toAr(S.W.length) + " كلمة" + (S.err ? " • تعثّر " + toAr(S.err) : ""); }
  function miss(heard) { const w = S.W[S.i]; if (!w) return; S.err++; S.errs[S.i] = (S.errs[S.i] || 0) + 1; w.e.classList.add("tsw-x"); setTimeout(() => w.e && w.e.classList.remove("tsw-x"), 1600);
    const m = document.getElementById("tsmm"); if (m) m.textContent = "توقّف عند الكلمة " + toAr(S.i + 1) + (heard ? " — سُمع: «" + heard + "»" : "") + ". أعد المحاولة من موضعها، أو اطلب تلميحًا."; prog(); }
  // يطابق ما سُمع بدءًا من موضع القراءة: تظهر الكلمات الصحيحة بالترتيب، وتجاوز كلمة أو تبديلها يوقف الإظهار
  function feed(words) { let bad = null;
    for (const r of words) { const w = S.W[S.i]; if (!w) break;
      if (same(r, w.t)) { show(S.i); S.i++; bad = null; const m = document.getElementById("tsmm"); if (m) m.textContent = ""; continue; }
      // كلمة مكررة مما سبق (إعادة القارئ) تُتجاهل
      if (S.i > 0 && same(r, S.W[S.i - 1].t)) continue;
      bad = r; }
    if (bad) miss(bad); cur(); }
  function listen() { const b = document.getElementById("tsmmic"); if (S.h) { S.h.stop(); return; } S.seg = {};
    S.h = VOICE.listen({ continuous: true, interim: true, raw: true, alts: 3, onResult: (alts, fin, _a) => {
        const t = alts[0].t, ws = t.split(/\s+/).filter(Boolean), key = "r" + (S.segN || 0), done_ = S.seg[key] || 0, upto = fin ? ws.length : Math.max(0, ws.length - 1);
        if (upto > done_) { feed(ws.slice(done_, upto)); S.seg[key] = upto; } if (fin) { S.segN = (S.segN || 0) + 1; } },
      onError: m => { const x = document.getElementById("tsmm"); if (x) x.textContent = "🎤 " + m + (VOICE.canSR ? "" : " — استعمل خانة الكتابة بديلًا."); },
      onEnd: () => { S && (S.h = null); if (b) { b.classList.remove("on"); b.textContent = "🎤 ابدأ التسميع"; } if (S && S.auto && S.i < S.W.length) setTimeout(() => S && S.auto && listen(), 250); } });
    if (b) { b.classList.add("on"); b.textContent = "⏸ إيقاف الاستماع"; } S.auto = true; }
  function panel() { document.getElementById("tsmpanel") && document.getElementById("tsmpanel").remove();
    document.body.insertAdjacentHTML("beforeend", `<div id="tsmpanel" class="tsmpanel" role="region" aria-label="وضع التسميع"><div class="tsmh"><b>🎙 التسميع: ${esc(S.title || "")}</b><button data-act="tsm-x" aria-label="إنهاء">✕</button></div>
      <div id="tsmp" class="tsmp"><b>٠٪</b><em><i></i></em><span></span></div><p id="tsmm" class="tsmm" aria-live="polite">${VOICE.ok ? "اضغط «ابدأ التسميع» واقرأ من حفظك؛ تظهر الكلمة بعد قراءتها صحيحة." : "المتصفح لا يدعم التعرف على الصوت؛ اكتب ما تحفظه في الخانة."}</p>
      <div class="tsmb">${VOICE.ok ? `<button class="btn p s" id="tsmmic" data-act="tsm-mic">🎤 ابدأ التسميع</button>` : ""}<button class="btn s" data-act="tsm-hint" title="إظهار الكلمة التالية">💡 تلميح</button><button class="btn s" data-act="tsm-back" title="إعادة الكلمات الأخيرة">↶ أعد موضع الخطأ</button><button class="btn s" data-act="tsm-reset">⟲ من البداية</button><button class="btn s" data-act="tsm-peek">👁 أظهر الكل</button></div>
      <form class="tsmtype" data-form="noop"><input id="tsmt" placeholder="أو اكتب ما تحفظه هنا ثم Enter" autocomplete="off" data-novoice></form></div>`);
    document.querySelector("#tsmpanel .tsmtype").addEventListener("submit", e => { e.preventDefault(); const x = document.getElementById("tsmt"); feed(x.value.split(/\s+/).filter(Boolean)); x.value = ""; }); prog(); }
  function done() { if (S.fin) return; S.fin = true; if (S.h) { S.auto = false; S.h.stop(); }
    const sec = Math.round((Date.now() - S.t0) / 1000), acc = Math.max(0, Math.round(100 - S.err * 100 / S.W.length)), M = LS("tsm_v1") || {}, r = M[S.key] = M[S.key] || { n: 0, best: 0, errs: {} };
    r.n++; r.last = MKT.day(); r.best = Math.max(r.best, acc); r.acc = acc; Object.entries(S.errs).forEach(([i, c]) => r.errs[i] = (r.errs[i] || 0) + c); r.t = S.title; LS("tsm_v1", M);
    const m = document.getElementById("tsmm"); if (m) m.innerHTML = `🎉 أتممت التسميع! الإتقان ${toAr(acc)}٪ في ${toAr(Math.max(1, Math.round(sec / 60)))} دقيقة${S.err ? ` — مواضع التعثر مظللة للمراجعة` : " بلا خطأ، بارك الله فيك"}.`;
    Object.keys(S.errs).forEach(i => S.W[i] && S.W[i].e.classList.add("tsw-weak")); if (typeof TSFX !== "undefined") TSFX.done(true); }
  function stop() { if (!S) return; S.auto = false; if (S.h) S.h.abort(); S.root.classList.remove("tsm-on"); S.W.forEach(w => w.e.classList.remove("tsw-h", "tsw-ok", "tsw-cur", "tsw-x", "tsw-weak")); const p = document.getElementById("tsmpanel"); if (p) p.remove(); S = null; }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act^=tsm-]"); if (!el) {
      // في أثناء التسميع: النقر على كلمة يجعلها بداية التسميع (قبل البدء) ولا يظهرها
      if (S && S.root.contains(e.target) && !S.started) { const w = S.W.findIndex(x => x.e === e.target || x.e.contains(e.target)); if (w >= 0 && S.i === 0 && e.altKey) { for (let j = 0; j < w; j++) show(j); S.i = w; cur(); } } return; }
    e.preventDefault(); const a = el.dataset.act;
    if (a === "tsm-start") { const root = el.closest("[data-tsm]") || document.querySelector(el.dataset.root || "#app"); start(document.querySelector(el.dataset.root) || root, el.dataset.key, el.dataset.title); }
    else if (!S) return; else if (a === "tsm-x") stop(); else if (a === "tsm-mic") { S.started = 1; listen(); }
    else if (a === "tsm-hint") { if (S.W[S.i]) { S.W[S.i].e.classList.add("tsw-hint"); S.err += .5; show(S.i); S.i++; cur(); } }
    else if (a === "tsm-back") { const k = Math.max(0, S.i - 3); for (let j = k; j < S.i; j++) { S.W[j].e.classList.remove("tsw-ok"); S.W[j].e.classList.add("tsw-h"); } S.i = k; S.fin = false; cur(); }
    else if (a === "tsm-reset") { const t = S.title, k = S.key, r = S.root; stop(); r.querySelectorAll(".tsm-from").forEach(x => x.classList.remove("tsm-from")); start(r, k, t); }
    else if (a === "tsm-peek") { S.root.classList.toggle("tsm-peek"); el.textContent = S.root.classList.contains("tsm-peek") ? "🙈 أخفِ النص" : "👁 أظهر الكل"; } });
  addEventListener("hashchange", stop); addEventListener("popstate", stop);
  // إضافة الزر آليًّا إلى صفحات المصحف والحديث
  const btn = (root, key, title) => `<button class="btn s tsmbtn" data-act="tsm-start" data-root="${root}" data-key="${esc(key)}" data-title="${esc(title)}">🎙 وضع التسميع والحفظ</button>`;
  new MutationObserver(() => {
    const mp = document.querySelector(".mpage:not([data-tsmb])"); if (mp) { mp.dataset.tsmb = 1; const nav = document.querySelector(".mnav"), m = location.pathname.match(/mushaf\/(?:p\/)?(\d+)/) || location.hash.match(/mushaf\/(?:p\/)?(\d+)/), k = "mushaf:" + location.pathname.replace(/^\/|#/g, "");
      if (nav) nav.insertAdjacentHTML("beforeend", btn(".mpage", k, (document.querySelector(".mph span") || {}).textContent || "المصحف")); }
    const hd = document.querySelector("article.hdone:not([data-tsmb])"); if (hd) { hd.dataset.tsmb = 1; hd.insertAdjacentHTML("afterbegin", `<div class="row" style="justify-content:flex-end">${btn("article.hdone", "hadith:" + location.pathname, "الحديث")}</div>`); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  // آيات/أحاديث يكثر فيها التعثر (لبرنامج المراجعة)
  const weak = () => Object.entries(LS("tsm_v1") || {}).filter(([, r]) => r.acc < 90 || Object.keys(r.errs || {}).length).sort((a, b) => a[1].acc - b[1].acc).slice(0, 10);
  return { start, stop, same, weak };
})();
