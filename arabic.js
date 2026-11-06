/* تعليم العربية لغير الناطقين بها (البند ٢٤): #/arabic — منهج متدرج بالعربية والإنجليزية معًا:
   ١) الحروف وأشكالها ونطقها، ٢) الحركات والسكون والتنوين والشدة والمد، ٣) القراءة من نصوص المكتبة المشكولة (آيات قصار)،
   ٤) أساسيات النحو بأمثلة من القرآن، ثم الانتقال إلى متون المكتبة (الآجرومية، قطر الندى…).
   تمارين تفاعلية: تعرّف الحرف بصوته، والحركة، وتركيب الكلمة، وقراءة الآية مع الاستماع (نطق المتصفح العربي). التقدم على جهاز المتعلم. */
const ARB = (() => {
  const L = [["ا", "alif", "ā / a"], ["ب", "bā’", "b"], ["ت", "tā’", "t"], ["ث", "thā’", "th (as in think)"], ["ج", "jīm", "j"], ["ح", "ḥā’", "ḥ (deep h)"], ["خ", "khā’", "kh"], ["د", "dāl", "d"], ["ذ", "dhāl", "dh (as in this)"], ["ر", "rā’", "r (rolled)"], ["ز", "zāy", "z"], ["س", "sīn", "s"], ["ش", "shīn", "sh"], ["ص", "ṣād", "ṣ (heavy s)"], ["ض", "ḍād", "ḍ (heavy d)"], ["ط", "ṭā’", "ṭ (heavy t)"], ["ظ", "ẓā’", "ẓ (heavy dh)"], ["ع", "‘ayn", "‘ (throat)"], ["غ", "ghayn", "gh"], ["ف", "fā’", "f"], ["ق", "qāf", "q (deep k)"], ["ك", "kāf", "k"], ["ل", "lām", "l"], ["م", "mīm", "m"], ["ن", "nūn", "n"], ["ه", "hā’", "h"], ["و", "wāw", "w / ū"], ["ي", "yā’", "y / ī"]];
  const NOJOIN = new Set("ادذرزو".split(""));
  const forms = c => { const z = "‍"; return [c, NOJOIN.has(c) ? c : c + z, NOJOIN.has(c) ? z + c : z + c + z, z + c]; };
  const H = [["َ", "فتحة", "fatḥa", "a"], ["ِ", "كسرة", "kasra", "i"], ["ُ", "ضمة", "ḍamma", "u"], ["ْ", "سكون", "sukūn", "no vowel"], ["ً", "تنوين فتح", "tanwīn fatḥ", "an"], ["ٍ", "تنوين كسر", "tanwīn kasr", "in"], ["ٌ", "تنوين ضم", "tanwīn ḍamm", "un"], ["ّ", "شدة", "shadda", "doubled letter"]];
  const GR = [
    ["الكلمة: اسم وفعل وحرف", "A word is a noun (ism), a verb (fi‘l) or a particle (ḥarf).", [["﴿ٱلْحَمْدُ لِلَّهِ﴾", "الحمدُ: اسم • لـِ: حرف جر • الله: اسم", "al-ḥamdu: noun • li: particle • Allāh: noun"], ["﴿قَالَ مُوسَىٰ﴾", "قال: فعل ماضٍ • موسى: اسم", "qāla: past verb • Mūsā: noun"]]],
    ["الجملة الاسمية: مبتدأ وخبر", "A nominal sentence begins with a noun: subject (mubtada’) + predicate (khabar), both usually marfū‘ (-u).", [["﴿ٱللَّهُ ٱلصَّمَدُ﴾", "اللهُ: مبتدأ مرفوع • الصمدُ: خبر مرفوع", "Allāhu: subject • aṣ-ṣamadu: predicate"], ["﴿مُّحَمَّدٌ رَّسُولُ ٱللَّهِ﴾", "محمدٌ: مبتدأ • رسولُ: خبر • اللهِ: مضاف إليه مجرور", "Muḥammadun: subject • rasūlu: predicate • Allāhi: genitive"]]],
    ["الجملة الفعلية: فعل وفاعل ومفعول به", "A verbal sentence begins with a verb: verb + doer (fā‘il, -u) + object (maf‘ūl bih, -a).", [["﴿خَلَقَ ٱللَّهُ ٱلسَّمَٰوَٰتِ﴾", "خلقَ: فعل ماضٍ • اللهُ: فاعل مرفوع • السمواتِ: مفعول به منصوب بالكسرة (جمع مؤنث سالم)", "khalaqa: verb • Allāhu: doer • as-samāwāti: object"]]],
    ["حروف الجر", "Prepositions (min, ilā, ‘an, ‘alā, fī, bi, li, ka) make the next noun majrūr (-i).", [["﴿بِسْمِ ٱللَّهِ﴾", "بـِ: حرف جر • اسمِ: اسم مجرور • اللهِ: مضاف إليه", "bi: preposition • ismi: genitive"], ["﴿فِى ٱلْأَرْضِ﴾", "في: حرف جر • الأرضِ: اسم مجرور", "fī: preposition • al-arḍi: genitive"]]],
    ["الإضافة", "Possessive construction: the second noun is always majrūr (-i).", [["﴿رَبِّ ٱلْعَٰلَمِينَ﴾", "ربِّ: مضاف • العالمين: مضاف إليه مجرور بالياء", "rabbi: first term • al-‘ālamīna: second term, genitive"]]],
    ["المذكر والمؤنث، والمفرد والمثنى والجمع", "Feminine usually ends in ة; dual adds ـان/ـين; sound plurals add ـون/ـين (m.) and ـات (f.).", [["مسلم • مسلمة • مسلمان • مسلمون • مسلمات", "مفرد مذكر • مفرد مؤنث • مثنى • جمع مذكر سالم • جمع مؤنث سالم", "muslim • muslima • muslimān • muslimūn • muslimāt"]]],
  ];
  const READ = [[1, null], [112, null], [113, null], [114, null], [108, null], [103, null]];
  const P = () => { try { return JSON.parse(localStorage.getItem("arb_p") || "{}"); } catch (e) { return {}; } }, setP = o => { try { localStorage.setItem("arb_p", JSON.stringify(Object.assign(P(), o))); } catch (e) { } };
  const say = t => { try { const u = new SpeechSynthesisUtterance(t); u.lang = "ar-SA"; u.rate = .75; const v = speechSynthesis.getVoices().find(x => /^ar/.test(x.lang)); if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast("Speech not supported on this device"); } };
  let QT = null; const quran = async () => QT || (QT = await fetch("data/quran/quran-tash.json").then(r => r.json()).catch(() => null));
  const TABS = [["letters", "١. الحروف", "Letters"], ["harakat", "٢. الحركات", "Vowel marks"], ["read", "٣. القراءة", "Reading"], ["grammar", "٤. النحو", "Grammar"], ["practice", "تمارين", "Practice"], ["next", "ما بعد ذلك", "Next steps"]];
  async function page(q) {
    const t = q.t || "letters", p = P(); let body = "";
    if (t === "letters") body = `<p class="arben">The Arabic alphabet has 28 letters, written right to left. Most letters connect to the next one and change shape: alone, at the start, in the middle, at the end. Tap a letter to hear it.</p>
      <div class="arbg">${L.map(([c, n, s]) => { const f = forms(c); return `<button class="arbl${(p.l || []).includes(c) ? " done" : ""}" data-act="arbsay" data-t="${c}"><b>${c}</b><span class="arbf">${f.map(x => `<i>${x}</i>`).join("")}</span><small>${n} • ${s}</small></button>`; }).join("")}</div>`;
    else if (t === "harakat") body = `<p class="arben">Short vowels are small marks above or below letters. They are usually written in the Qur’an and in books for learners. Tap to hear.</p>
      <div class="arbg">${H.map(([m, ar, en, s]) => `<button class="arbl" data-act="arbsay" data-t="${"ب" + m}"><b>ب${m}</b><small>${ar} • ${en}<br>${s}</small></button>`).join("")}</div>
      <h3>المد • Long vowels</h3><div class="arbg">${[["بَا", "bā"], ["بِي", "bī"], ["بُو", "bū"]].map(([w, s]) => `<button class="arbl" data-act="arbsay" data-t="${w}"><b>${w}</b><small>${s}</small></button>`).join("")}</div>
      <h3>كل حرف بالحركات الثلاث • Each letter with the three vowels</h3><div class="arbtab">${L.map(([c]) => ["َ", "ِ", "ُ"].map(m => `<button data-act="arbsay" data-t="${c + m}">${c + m}</button>`).join("")).join("")}</div>`;
    else if (t === "read") { const Q = await quran(); body = `<p class="arben">Read these short sūras, fully vocalised. Tap a verse to hear it, then read it yourself. Open the Mushaf for the whole Qur’an.</p>` +
      (Q ? READ.map(([s]) => `<section class="arbr"><h3><a href="#/mushaf/${s}">${esc(nmS(s))}</a></h3>${Q.suras[s - 1].ayat.map((a, i) => { const tx = (i === 0 && s !== 1 ? a.replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, "") : a).replace(/﻿/g, ""); return `<button class="arbay" data-act="arbsay" data-t="${esc(tx)}">${esc(tx)} ﴿${toAr(i + 1)}﴾</button>`; }).join("")}</section>`).join("") : '<p class="mut">…</p>'); }
    else if (t === "grammar") body = `<p class="arben">The basics of Arabic grammar (naḥw), each with examples from the Qur’an. After these, continue with the classical primers in the library below.</p>` + GR.map(([ar, en, ex]) => `<details class="hfold" open><summary>${esc(ar)}<br><small class="arben">${esc(en)}</small></summary><div>${ex.map(([a, b, c]) => `<p class="arbex"><b>${esc(a)}</b><br>${esc(b)}<br><small class="arben">${esc(c)}</small></p>`).join("")}</div></details>`).join("");
    else if (t === "practice") body = `<div class="row"><button class="btn p" data-act="arbq" data-k="letter">Which letter? • أي حرف تسمع؟</button><button class="btn p" data-act="arbq" data-k="haraka">Which vowel? • أي حركة؟</button><button class="btn p" data-act="arbq" data-k="name">Letter name • اسم الحرف</button></div><div id="arbqz"></div><p class="mut">Score saved on this device • ${toAr(p.score || 0)} ✓</p>`;
    else body = `<p class="arben">When you can read vocalised text and know the basics, continue with these classical texts in the library, in this order:</p>
      <ol>${[["ajurrumiyya", "متن الآجرومية — the first primer of grammar"], ["qatr", "قطر الندى — intermediate grammar"], ["alfiyya", "ألفية ابن مالك — the comprehensive poem"], ["ibnaqil", "شرح ابن عقيل — its classic explanation"]].filter(([id]) => B(id)).map(([id, n]) => `<li><a href="#/book/${id}/1">${esc(n)}</a></li>`).join("")}</ol>
      <p>Also: <a href="#/hadith?t=book&b=arbain">The Forty Ḥadīth of an-Nawawī</a> for reading practice, and <a href="#/mushaf">the Mushaf</a>. Long-press any word while reading to see its meaning and translation.</p>`;
    view(`<div class="cmhero" dir="rtl"><div><h2>العربية لغير الناطقين بها <small class="arben">Arabic for non-native speakers</small></h2><p>منهج متدرج من الحروف إلى قراءة القرآن والحديث ومتون النحو في المكتبة. <span class="arben">A step-by-step path from the letters to reading the Qur’an, ḥadīth and the classical grammar texts in this library.</span></p></div></div>
    <div class="tabs" role="tablist">${TABS.map(([k, a, e]) => `<a role="tab" aria-selected="${k === t}" href="#/arabic?t=${k}">${a} <small>${e}</small></a>`).join("")}</div>${body}`);
  }
  let NM = null; const nmS = s => (NM && NM[s - 1]) || ""; fetch("data/quran/quran.json").then(r => r.json()).then(j => NM = j.suras.map(x => x.name)).catch(() => { });
  let G = null;
  function quiz(k) {
    const pick = a => a[Math.floor(Math.random() * a.length)], sh = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    let q, opts, ans;
    if (k === "letter") { const c = pick(L); ans = c[0]; opts = sh([c, ...sh(L.filter(x => x !== c)).slice(0, 3)]).map(x => x[0]); q = `<button class="btn" data-act="arbsay" data-t="${c[0]}">🔊 Listen • استمع</button>`; setTimeout(() => say(c[0]), 200); }
    else if (k === "haraka") { const c = pick(L)[0], h = pick(H.slice(0, 3)); ans = c + h[0]; opts = sh(H.slice(0, 3).map(x => c + x[0])); q = `<button class="btn" data-act="arbsay" data-t="${ans}">🔊 Listen • استمع</button>`; setTimeout(() => say(ans), 200); }
    else { const c = pick(L); ans = c[0]; opts = sh([c, ...sh(L.filter(x => x !== c)).slice(0, 3)]).map(x => x[0]); q = `<b class="arbbig">${c[1]}</b>`; }
    G = { k, ans }; $("#arbqz").innerHTML = `<div class="tmq"><p>${q}</p><div class="row">${opts.map(o => `<button class="btn tmo arbo" data-act="arbans" data-v="${o}">${o}</button>`).join("")}</div></div>`;
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "arbsay") { say(el.dataset.t); if (el.classList.contains("arbl") && L.some(x => x[0] === el.dataset.t)) { const l = new Set(P().l || []); l.add(el.dataset.t); setP({ l: [...l] }); el.classList.add("done"); } }
    else if (a === "arbq") quiz(el.dataset.k);
    else if (a === "arbans" && G) { const ok = el.dataset.v === G.ans; el.classList.add(ok ? "right" : "wrong"); document.querySelectorAll(".arbo").forEach(b => { if (b.dataset.v === G.ans) b.classList.add("right"); b.disabled = true; });
      if (ok) setP({ score: (P().score || 0) + 1 }); setTimeout(() => quiz(G.k), 1100); } });
  return { view: page };
})();
