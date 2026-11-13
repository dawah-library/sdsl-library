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
        if (o.onResult) o.onResult(o.raw ? alts : best(alts), res.isFinal, alts); } };
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
  const SEL = 'input[type=search],input[name=q],input[data-voice],textarea[data-voice]';
  function arm(inp) {
    if (inp.dataset.vmic || inp.dataset.novoice !== undefined || (!canSR && !canRec)) return; inp.dataset.vmic = 1;
    const b = document.createElement("button"); b.type = "button"; b.className = "vmic"; b.title = "البحث بالصوت"; b.setAttribute("aria-label", "البحث بالصوت"); b.textContent = "🎤";
    inp.insertAdjacentElement("afterend", b);
    let h = null; b.onclick = () => {
      if (h) { h.stop(); return; } const ph = inp.placeholder; b.classList.add("on"); inp.placeholder = "تكلَّم الآن…";
      h = listen({ interim: true, onResult: (t, fin) => { inp.value = t; inp.dispatchEvent(new Event("input", { bubbles: true }));
          if (fin) { const f = inp.form; if (f && !inp.dataset.nosubmit) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); } else inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); } },
        onError: m => typeof toast === "function" && toast("🎤 " + m), onEnd: () => { h = null; b.classList.remove("on"); inp.placeholder = ph; } });
    };
  }
  const scan = root => (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach(arm);
  if (document.readyState !== "loading") scan(document); else document.addEventListener("DOMContentLoaded", () => scan(document));
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches && n.matches(SEL)) arm(n); else if (n.querySelector && n.querySelector(SEL)) scan(n); } }).observe(document.documentElement, { childList: true, subtree: true });
  return { listen, stt, AR, canSR, canRec, ok: canSR || canRec, arm };
})();
