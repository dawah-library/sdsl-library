/* تعليم العربية لغير الناطقين بها (البند ٢٤): #/arabic — منهج متدرج بالعربية والإنجليزية معًا (والمستوى المتوسط MID وجمل data/arabic-mid.json من tools/arabic-mid.py):
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
  // المستوى المتوسط: كل مثال جزء حرفي من نص المصحف المشكول (data/quran/quran-tash.json) بسورته وآيته، والسؤال بإجابته المعروفة
  const MID = [
    ["الفعل: ماضٍ ومضارع وأمر", "Verbs: past (māḍī) for what happened, present (muḍāri‘) begins with أ ن ي ت, imperative (amr) for a command.", [[96, 1, "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", "اقرأْ: فعل أمر • خلقَ: فعل ماضٍ", "iqra’: imperative • khalaqa: past"], [1, 5, "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", "نعبدُ، نستعينُ: فعلان مضارعان مرفوعان بالضمة", "na‘budu, nasta‘īnu: present verbs, marfū‘ (-u)"]], ["في ﴿اقْرَأْ﴾ نوع الفعل:", "فعل أمر", "فعل ماضٍ", "فعل مضارع"]],
    ["الضمائر: منفصلة ومتصلة", "Pronouns are separate (huwa, anta, naḥnu, iyyāka…) or attached to a word (-nā, -ka, -hu…).", [[112, 1, "قُلْ هُوَ اللَّهُ أَحَدٌ", "هو: ضمير منفصل مبني في محل رفع مبتدأ", "huwa: separate pronoun"], [108, 1, "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", "أعطيناك: «نا» ضمير متصل فاعل، والكاف ضمير متصل مفعول به أول", "a‘ṭaynāka: -nā (we) is the doer, -ka (you) the object"]], ["في ﴿أَعْطَيْنَاكَ﴾ الضمير «نا» يدل على:", "الفاعل (نحن)", "المفعول به", "المخاطَب"]],
    ["أسماء الإشارة", "Demonstratives: هذا (this, m.), هذه (this, f.), ذلك (that, m.), تلك (that, f.), هؤلاء (these).", [[2, 2, "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ", "ذلك: اسم إشارة للبعيد مبني في محل رفع مبتدأ • الكتابُ: بدل مرفوع", "dhālika: “that”, a demonstrative"], [6, 155, "وَهَٰذَا كِتَابٌ أَنْزَلْنَاهُ مُبَارَكٌ", "هذا: اسم إشارة للقريب في محل رفع مبتدأ • كتابٌ: خبر مرفوع", "hādhā: “this” • kitābun: predicate"]], ["﴿ذَٰلِكَ﴾ اسم إشارة:", "للبعيد", "للقريب", "للجمع"]],
    ["الاسم الموصول", "Relative nouns: الذي (who/which, m.), التي (f.), الذين (pl. m.); a clause (ṣila) follows them.", [[96, 1, "بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", "الذي: اسم موصول مبني في محل جر نعت لـ«ربك» • خلق: صلة الموصول", "alladhī: “who”, followed by its clause khalaqa"], [2, 3, "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ", "الذين: اسم موصول لجمع المذكر • يؤمنون بالغيب: صلته", "alladhīna: “those who” (plural)"]], ["﴿الَّذِينَ﴾ اسم موصول:", "لجمع المذكر", "للمفرد المؤنث", "للمثنى"]],
    ["كان وأخواتها", "kāna and its sisters enter a nominal sentence: the subject stays marfū‘ (ism kāna), the predicate becomes manṣūb (khabar kāna, -a/-an).", [[4, 96, "وَكَانَ اللَّهُ غَفُورًا رَحِيمًا", "كان: فعل ماضٍ ناقص • اللهُ: اسم كان مرفوع • غفورًا: خبر كان منصوب • رحيمًا: خبر ثانٍ منصوب", "Allāhu: ism kāna (-u) • ghafūran: khabar kāna (-an)"], [112, 4, "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ", "يكن: مضارع ناقص مجزوم بلم • كفوًا: خبرها مقدَّم منصوب • أحدٌ: اسمها مؤخَّر مرفوع", "kufuwan: khabar (-an), put first • aḥadun: ism (-un)"]], ["في ﴿وَكَانَ اللَّهُ غَفُورًا﴾ كلمة «غفورًا»:", "خبر كان منصوب", "اسم كان مرفوع", "مفعول به منصوب"]],
    ["إنّ وأخواتها", "inna and its sisters do the opposite: the subject becomes manṣūb (ism inna, -a), the predicate stays marfū‘ (khabar inna, -u).", [[2, 173, "إِنَّ اللَّهَ غَفُورٌ رَحِيمٌ", "إنّ: حرف توكيد ونصب • اللهَ: اسم إنّ منصوب • غفورٌ: خبر إنّ مرفوع", "Allāha: ism inna (-a) • ghafūrun: khabar inna (-un)"], [2, 153, "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", "اللهَ: اسم إنّ منصوب • معَ: ظرف منصوب والصابرين مضاف إليه، وشبه الجملة في موضع خبر إنّ", "Allāha: ism inna • ma‘a aṣ-ṣābirīn: its predicate"]], ["في ﴿إِنَّ اللَّهَ غَفُورٌ﴾ لفظ الجلالة «اللهَ»:", "اسم إنّ منصوب", "خبر إنّ مرفوع", "فاعل مرفوع"]],
    ["النعت (الصفة)", "An adjective (na‘t) follows its noun and agrees with it in case, definiteness, gender and number.", [[1, 6, "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", "الصراطَ: مفعول به منصوب • المستقيمَ: نعت منصوب مثله", "aṣ-ṣirāṭa (object, -a) → al-mustaqīma (adjective, -a)"], [2, 7, "وَلَهُمْ عَذَابٌ عَظِيمٌ", "عذابٌ: مبتدأ مؤخر مرفوع نكرة • عظيمٌ: نعت مرفوع نكرة مثله", "‘adhābun → ‘aẓīmun: both marfū‘ and indefinite"]], ["﴿الْمُسْتَقِيمَ﴾ منصوب لأنه:", "نعت لمنصوب", "مفعول به ثانٍ", "حال"]],
    ["المضارع المنصوب والمجزوم", "The present verb is marfū‘ (-u) by default; after أن / لن it becomes manṣūb, after لم / لا الناهية it becomes majzūm (sukūn, or the final ن drops).", [[112, 3, "لَمْ يَلِدْ وَلَمْ يُولَدْ", "يلدْ، يولدْ: مضارعان مجزومان بـ«لم» وعلامة الجزم السكون", "lam yalid: majzūm after lam (sukūn)"], [2, 184, "وَأَنْ تَصُومُوا خَيْرٌ لَكُمْ", "تصوموا: مضارع منصوب بـ«أن» وعلامة نصبه حذف النون (أصله تصومون)", "an taṣūmū: manṣūb after an — the final -na drops"]], ["﴿لَمْ يَلِدْ﴾ الفعل «يلدْ»:", "مجزوم بلم", "منصوب بلم", "مرفوع"]],
    ["الأسماء الخمسة", "Five nouns (أب، أخ، حم، فو، ذو) show case by a long vowel when followed by a possessor: -ū (raf‘), -ā (naṣb), -ī (jarr).", [[12, 8, "لَيُوسُفُ وَأَخُوهُ أَحَبُّ إِلَىٰ أَبِينَا مِنَّا", "أخوه: معطوف مرفوع وعلامة رفعه الواو • أبينا: اسم مجرور بـ«إلى» وعلامة جره الياء", "akhūhu: marfū‘ by -ū • abīnā: majrūr by -ī"], [12, 16, "وَجَاءُوا أَبَاهُمْ عِشَاءً يَبْكُونَ", "أباهم: مفعول به منصوب وعلامة نصبه الألف", "abāhum: manṣūb by -ā"]], ["في ﴿وَجَاءُوا أَبَاهُمْ﴾ علامة نصب «أباهم»:", "الألف", "الفتحة", "الياء"]],
    ["النفي والاستفهام", "Negation: لا، ما، لم، لن. Questions: هل، أ، ما، من، متى، أين، كيف، عمَّ (= عن + ما).", [[109, 2, "لَا أَعْبُدُ مَا تَعْبُدُونَ", "لا: حرف نفي • أعبدُ: مضارع مرفوع • ما: اسم موصول بمعنى الذي", "lā: negation • a‘budu: present, marfū‘"], [88, 1, "هَلْ أَتَاكَ حَدِيثُ الْغَاشِيَةِ", "هل: حرف استفهام • أتاك: فعل ماضٍ والكاف مفعول به • حديثُ: فاعل مرفوع", "hal: question particle • ḥadīthu: doer"], [78, 1, "عَمَّ يَتَسَاءَلُونَ", "عمَّ: «عن» حرف جر و«ما» استفهامية حُذفت ألفها", "‘amma = ‘an + mā (about what?)"]], ["﴿عَمَّ﴾ أصلها:", "عن + ما", "على + ما", "من + ما"]],
  ];
  let MS = null; const mids = async () => MS || (MS = await fetch("data/arabic-mid.json").then(r => r.json()).then(j => j.s).catch(() => []));
  const READ = [[1, null], [112, null], [113, null], [114, null], [108, null], [103, null]];
  const P = () => { try { return JSON.parse(localStorage.getItem("arb_p") || "{}"); } catch (e) { return {}; } }, setP = o => { try { localStorage.setItem("arb_p", JSON.stringify(Object.assign(P(), o))); } catch (e) { } };
  const say = t => { try { const u = new SpeechSynthesisUtterance(t); u.lang = "ar-SA"; u.rate = +(((P().ro || {}).rate) || .75); const v = speechSynthesis.getVoices().find(x => /^ar/.test(x.lang)); if (v) u.voice = v; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { toast("Speech not supported on this device"); } };
  let QT = null; const quran = async () => QT || (QT = await fetch("data/quran/quran-tash.json").then(r => r.json()).catch(() => null));
  const TABS = [["letters", "١. الحروف", "Letters"], ["harakat", "٢. الحركات", "Vowel marks"], ["read", "٣. القراءة", "Reading"], ["grammar", "٤. النحو", "Grammar"], ["mid", "٥. المستوى المتوسط", "Intermediate"], ["midread", "٦. القراءة", "Reading"], ["practice", "تمارين", "Practice"], ["tests", "اختبارات الإتقان", "Mastery tests"], ["next", "ما بعد ذلك", "Next steps"]];
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
    else if (t === "mid") body = `<p class="arben">The intermediate level: ten grammar lessons, each illustrated by exact words of the Qur’an with the analysis (i‘rāb). Answer the question under each lesson; your progress is saved on this device.</p>` + MID.map(([ar, en, ex, qq], i) => `<details class="hfold"${i === (p.mi || 0) ? " open" : ""}><summary>${toAr(i + 1)}. ${esc(ar)}${(p.md || []).includes(i) ? " ✓" : ""}<br><small class="arben">${esc(en)}</small></summary><div>${ex.map(([su, ay, f, b, c]) => `<p class="arbex"><button class="lnk arbq2" data-act="arbsay" data-t="${esc(f)}">﴿${esc(f)}﴾</button> <a class="mut" href="#/mushaf/${su}">[${esc(nmS(su))}: ${toAr(ay)}]</a><br>${esc(b)}<br><small class="arben">${esc(c)}</small></p>`).join("")}
      <div class="tmq"><p><b>${esc(qq[0])}</b></p><div class="row">${[qq[1], qq[2], qq[3]].map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => `<button class="btn tmo" data-act="arbmid" data-i="${i}" data-v="${esc(x[1])}">${esc(x[1])}</button>`).join("")}</div></div></div></details>`).join("") + `<p class="mut">${toAr((p.md || []).length)} / ${toAr(MID.length)} ✓ — ثم انتقل إلى <a href="#/arabic?t=midread">القراءة من كتب الدعوة</a>.</p>`;
    else if (t === "midread" && q.c !== "art") body = await reader(q, p);
    else if (t === "midread") { const S = await mids(), n = S.length, k = Math.max(0, Math.min(n - 1, +q.i || p.ri || 0)); const x = S[k];
      body = readTabs("art") + `<p class="arben">Read real sentences from articles by the scholars of the Salafi Da‘wa — without vowel marks, as Arabic is normally written. Listen, read it yourself, then open the source. Short sentences come first.</p>` +
      (x ? `<div class="arbsent"><p class="arbst">${esc(x.t)}</p><div class="row"><button class="btn" data-act="arbsay" data-t="${esc(x.t)}">🔊 Listen • استمع</button><a class="btn" href="#/book/${esc(x.a)}/1">المصدر • Source</a></div>
      <div class="row" style="justify-content:space-between"><a class="btn s" href="#/arabic?t=midread&c=art&i=${Math.max(0, k - 1)}">→ السابقة</a><span class="mut">${toAr(k + 1)} / ${toAr(n)} • ${toAr(x.w)} كلمات</span><a class="btn s p" href="#/arabic?t=midread&c=art&i=${Math.min(n - 1, k + 1)}" data-act="arbnext" data-i="${k + 1}">التالية ←</a></div></div>
      <p class="mut">Practice these sentences in <a href="#/arabic?t=practice">التمارين • Practice</a>: word order and prepositions.</p>` : '<p class="mut">…</p>'); }
    else if (t === "practice") body = `<div class="row"><button class="btn p" data-act="arbq" data-k="letter">Which letter? • أي حرف تسمع؟</button><button class="btn p" data-act="arbq" data-k="haraka">Which vowel? • أي حركة؟</button><button class="btn p" data-act="arbq" data-k="name">Letter name • اسم الحرف</button></div><h3>المستوى المتوسط • Intermediate</h3><div class="row"><button class="btn p" data-act="arbq" data-k="order">Word order • رتّب الكلمات</button><button class="btn p" data-act="arbq" data-k="jarr">Preposition • حرف الجر</button></div><h3>ألعاب لغوية • Language games</h3><div class="row">${[["gharib", "معنى الكلمة • Word meaning"], ["haraka", "الحركة الصحيحة • Right vowel"], ["tartib", "رتّب الآية • Verse order"], ["jarr", "حرف الجر • Prepositions"]].map(([g, n]) => `<a class="btn" href="#/talaea/games?g=${g}&k=t4">${n}</a>`).join("")}</div><div id="arbqz"></div><p class="mut">Score saved on this device • ${toAr(p.score || 0)} ✓</p>`;
    else if (t === "tests") body = testsPage(q, p);
    else body = nextPage(p);
    if (BR[t]) body += `<p class="arbgo"><a class="btn p" href="#/arabic?t=tests&b=${t}">✓ اختبر إتقانك لهذا الفرع • Test this branch</a> <span class="mut">${lvlTxt(p, t)}</span></p>`;
    view(`<div class="cmhero" dir="rtl"><div><h2>العربية لغير الناطقين بها <small class="arben">Arabic for non-native speakers</small></h2><p>منهج متدرج من الحروف إلى قراءة القرآن والحديث ومتون النحو في المكتبة. <span class="arben">A step-by-step path from the letters to reading the Qur’an, ḥadīth and the classical grammar texts in this library.</span></p></div></div>
    <div class="tabs" role="tablist">${TABS.map(([k, a, e]) => `<a role="tab" aria-selected="${k === t}" href="#/arabic?t=${k}">${a} <small>${e}</small></a>`).join("")}</div>${body}`);
  }
  let NM = null; const nmS = s => (NM && NM[s - 1]) || ""; fetch("data/quran/quran.json").then(r => r.json()).then(j => NM = j.suras.map(x => x.name)).catch(() => { });
  // ======================= القراءة: آيات وأحاديث وحكم وأشعار فصيحة، مشكولة أو بلا تشكيل =======================
  const DI = /[ً-ٰٟۖ-ۭ]/g, bare = t => String(t || "").replace(DI, "").replace(/ٱ/g, "ا");
  const CATS = [["q", "آيات قرآنية", "Qur’an"], ["h", "أحاديث نبوية", "Ḥadīth"], ["k", "حكم وآثار", "Wise sayings"], ["p", "شعر عربي فصيح", "Classical poetry"], ["art", "من مقالات الدعوة", "Da‘wa articles"]];
  let RD = null;
  async function readSet() {
    if (RD) return RD; const [j, Q] = await Promise.all([fetch("data/arabic-read.json").then(r => r.json()).catch(() => ({})), quran()]);
    const it = [];
    (j.q || []).forEach(([su, ay]) => { const t = Q && Q.suras[su - 1] && Q.suras[su - 1].ayat[ay - 1]; if (t) it.push({ c: "q", t: t.replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, "").replace(/﻿/g, ""), su, ay }); });
    (j.h || []).forEach(x => it.push({ c: "h", t: x.t, s: x.s, en: x.en }));
    (j.k || []).forEach(x => it.push({ c: "k", t: x.t, s: x.s, en: x.en }));
    (j.p || []).forEach(x => it.push({ c: "p", v: x.v, t: x.v.join(" "), s: x.s, en: x.en }));
    it.forEach(x => { x.w = bare(x.t).split(/\s+/).filter(Boolean).length; x.l = x.w <= 6 ? 1 : x.w <= 13 ? 2 : 3; });
    const ord = { q: 0, h: 1, k: 2, p: 3 }; it.sort((a, b) => ord[a.c] - ord[b.c] || a.w - b.w); return (RD = it);
  }
  const RO = () => Object.assign({ tk: 1, fs: 1.6, rate: .75 }, P().ro || {}), setRO = o => setP({ ro: Object.assign(RO(), o) });
  const readTabs = c => `<div class="chips arbcats" role="toolbar" aria-label="نوع النص">${CATS.map(([k, a, e]) => `<a class="chip${k === c ? " on" : ""}" href="#/arabic?t=midread&c=${k}">${a} <small class="arben">${e}</small></a>`).join("")}</div>`;
  // كل كلمة عنصر يحمل ضبطها: في وضع «بلا تشكيل» يكشف الضغط ضبط الكلمة وحدها
  const wordsHtml = (t, tk) => esc(t).split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : `<span class="arbwd" data-v="${w}">${tk ? w : bare(w)}</span>`).join("");
  async function reader(q, p) {
    const all = await readSet(), c = CATS.some(x => x[0] === q.c) ? q.c : "q", lv = +q.l || 0, L = all.filter(x => x.c === c && (!lv || x.l === lv)), o = RO();
    if (!L.length) return readTabs(c) + '<p class="mut">…</p>';
    const k = Math.max(0, Math.min(L.length - 1, +q.i || 0)), x = L[k], seen = new Set(p.rs || []), id = x.c + ":" + (x.su ? x.su + ":" + x.ay : bare(x.t).slice(0, 24));
    const href = i => `#/arabic?t=midread&c=${c}${lv ? "&l=" + lv : ""}&i=${i}`;
    const src = x.c === "q" ? `<a href="#/mushaf/${x.su}?a=${x.ay}">[${esc(nmS(x.su))}: ${toAr(x.ay)}]</a>` : esc(x.s || "");
    const text = x.c === "p" ? `<div class="arbpoem">${x.v.map((h, i) => (i % 2 ? "" : '<div class="bt">') + `<span>${wordsHtml(h, o.tk)}</span>` + (i % 2 || i === x.v.length - 1 ? "</div>" : "")).join("")}</div>`
      : `<p class="arbst arbrd">${x.c === "q" ? "﴿" : x.c === "h" ? "«" : ""}${wordsHtml(x.t, o.tk)}${x.c === "q" ? "﴾" : x.c === "h" ? "»" : ""}</p>`;
    return readTabs(c) + `<p class="arben">Read texts of pure classical Arabic — verses of the Qur’an, ḥadīth, wise sayings and poetry — first fully vocalised, then without vowel marks as Arabic is normally written. In “no vowels” mode, tap any word to reveal its vowels. Listen, read it yourself, then test yourself.</p>
      <div class="row arbtools" role="toolbar" aria-label="أدوات القراءة"><button class="btn s${o.tk ? " p" : ""}" data-act="arbtk" aria-pressed="${!!o.tk}">${o.tk ? "مشكول • Vowelled" : "بلا تشكيل • No vowels"}</button>
       <button class="btn s" data-act="arbfs" data-d="-0.15" aria-label="تصغير الخط">ا−</button><button class="btn s" data-act="arbfs" data-d="0.15" aria-label="تكبير الخط">ا+</button>
       <select data-act="arbrate" aria-label="سرعة النطق"><option value=".6"${o.rate == .6 ? " selected" : ""}>بطيء • slow</option><option value=".75"${o.rate == .75 ? " selected" : ""}>متوسط • normal</option><option value="1"${o.rate == 1 ? " selected" : ""}>عادي • fast</option></select>
       <span class="chips">${[[0, "الكل"], [1, "سهل"], [2, "متوسط"], [3, "متقدم"]].map(([v, n]) => `<a class="chip${v === lv ? " on" : ""}" href="#/arabic?t=midread&c=${c}${v ? "&l=" + v : ""}">${n}</a>`).join("")}</span></div>
      <div class="arbsent" style="--arbfs:${o.fs}rem">${text}<p class="mut arbsrc">${src}</p>${x.en ? `<p class="arben">${esc(x.en)}</p>` : ""}
       ${x.c === "q" ? `<details class="arbgr" data-su="${x.su}" data-ay="${x.ay}"><summary>غريب الآية (السراج) • Difficult words</summary><div class="mut">…</div></details>` : ""}
       <div class="row"><button class="btn" data-act="arbsay" data-t="${esc(x.t)}">🔊 استمع • Listen</button><button class="btn" data-act="arbseen" data-k="${esc(id)}">${seen.has(id) ? "✓ قرأتُه" : "قرأتُه • I read it"}</button></div>
       <div class="row" style="justify-content:space-between"><a class="btn s" href="${href(Math.max(0, k - 1))}">→ السابق</a><span class="mut">${toAr(k + 1)} / ${toAr(L.length)} • ${toAr(x.w)} كلمات</span><a class="btn s p" href="${href(Math.min(L.length - 1, k + 1))}">التالي ←</a></div></div>
      <p class="mut">${toAr(seen.size)} نصًّا قرأتها • Then: <a href="#/arabic?t=tests&b=midread">اختبار القراءة • Reading test</a></p>`;
  }

  // ======================= اختبارات الإتقان: لكل فرع ثلاثة مستويات متدرجة (٥ ثم ١٠ ثم ١٥ سؤالًا)، والنجاح بـ٨٠٪ يفتح التالي =======================
  const BR = { letters: "الحروف • Letters", harakat: "الحركات • Vowel marks", read: "القراءة • Reading the Qur’an", grammar: "النحو • Grammar", mid: "المستوى المتوسط • Intermediate", midread: "قراءة النصوص الفصيحة • Reading texts" };
  const NQ = [0, 5, 10, 15], PASS = .8, BRK = Object.keys(BR);
  const lvlOf = (p, b) => +((p.mt || {})[b] || 0), lvlTxt = (p, b) => { const n = lvlOf(p, b); return n >= 3 ? "✓ أتقنتَ هذا الفرع • mastered" : n ? `اجتزت ${toAr(n)} من ٣ مستويات` : "لم تختبر بعد"; };
  const GQ = [  // أسئلة النحو الأساسي: [السؤال، الصواب، خطأ، خطأ]
    ["﴿الْحَمْدُ﴾ نوعها:", "اسم", "فعل", "حرف"], ["﴿قَالَ﴾ نوعها:", "فعل", "اسم", "حرف"], ["«فِي» نوعها:", "حرف", "اسم", "فعل"],
    ["الجملة ﴿اللَّهُ الصَّمَدُ﴾:", "جملة اسمية", "جملة فعلية", "شبه جملة"], ["في ﴿اللَّهُ الصَّمَدُ﴾ كلمة «الصَّمَدُ»:", "خبر مرفوع", "مبتدأ", "فاعل"],
    ["الجملة ﴿خَلَقَ اللَّهُ السَّمَاوَاتِ﴾:", "جملة فعلية", "جملة اسمية", "شبه جملة"], ["في ﴿خَلَقَ اللَّهُ﴾ لفظ الجلالة:", "فاعل مرفوع", "مفعول به منصوب", "مبتدأ"],
    ["الاسم بعد حرف الجر يكون:", "مجرورًا", "مرفوعًا", "منصوبًا"], ["في ﴿بِسْمِ اللَّهِ﴾ كلمة «اسْمِ»:", "اسم مجرور", "فعل", "حرف جر"],
    ["في ﴿رَبِّ الْعَالَمِينَ﴾ كلمة «الْعَالَمِينَ»:", "مضاف إليه مجرور", "فاعل", "خبر"], ["مؤنث «مُسْلِم»:", "مُسْلِمَة", "مُسْلِمُون", "مُسْلِمَان"],
    ["جمع المذكر السالم من «مُسْلِم»:", "مُسْلِمُون", "مُسْلِمَات", "مُسْلِمَان"], ["مثنى «مُسْلِم» في حالة الرفع:", "مُسْلِمَان", "مُسْلِمِين", "مُسْلِمُون"],
    ["العلامة الأصلية للفاعل:", "الضمة", "الفتحة", "الكسرة"], ["العلامة الأصلية للمفعول به:", "الفتحة", "الضمة", "الكسرة"]];
  const MQ = [["في ﴿لَمْ يَلِدْ﴾ الفعل «يَلِدْ»:", "مضارع مجزوم", "مضارع منصوب", "فعل ماضٍ"], ["في ﴿إِنَّ اللَّهَ غَفُورٌ﴾ كلمة «غَفُورٌ»:", "خبر إنّ مرفوع", "اسم إنّ منصوب", "مفعول به"],
    ["في ﴿وَكَانَ اللَّهُ غَفُورًا﴾ كلمة «غَفُورًا»:", "خبر كان منصوب", "اسم كان مرفوع", "مفعول به"], ["«الَّذِي» اسم موصول:", "للمفرد المذكر", "لجمع المؤنث", "للمثنى"],
    ["«هَٰذِهِ» اسم إشارة:", "للمفردة المؤنثة القريبة", "للمذكر البعيد", "للجمع"]];
  const SIM = ["بتثني", "جحخ", "دذ", "رز", "سش", "صض", "طظ", "عغ", "فق", "هة"];
  const pick = a => a[Math.floor(Math.random() * a.length)], shuf = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const mc = (q, ans, wrong, opt) => Object.assign({ q, ans, o: shuf([ans, ...[...new Set(wrong)].filter(w => w !== ans).slice(0, 3)]) }, opt || {});
  async function gen(b, lv) {
    const Q = [], n = NQ[lv];
    if (b === "letters") for (let i = 0; i < n; i++) { const c = pick(L), sim = (SIM.find(g => g.includes(c[0])) || "").split("").filter(x => x !== c[0] && L.some(y => y[0] === x));
      const wr = shuf(L.filter(x => x !== c)).map(x => x[0]), ds = lv >= 2 && sim.length ? sim.concat(wr) : wr;
      if (lv === 1 || i % 3 === 0) Q.push(mc(`Which letter is <b>${c[1]}</b>? • ما الحرف المسمى «${c[1]}»؟`, c[0], ds, { big: 1 }));
      else { const fm = forms(c[0]), w = pick(NOJOIN.has(c[0]) ? [0, 3] : [1, 2, 3]); Q.push(mc(`Which letter is this form? • ما هذا الحرف في هذا الشكل؟ <b class="arbbig2">${fm[w]}</b>`, c[0], ds, { big: 1 })); } }
    else if (b === "harakat") for (let i = 0; i < n; i++) { const c = pick(L)[0];
      if (lv === 1) { const h = pick(H); Q.push(mc(`ما اسم العلامة على <b class="arbbig2">${c + h[0]}</b>؟ • Name of this mark?`, h[1] + " • " + h[2], H.filter(x => x !== h).map(x => x[1] + " • " + x[2]))); }
      else if (lv === 2 || i % 2) { const V = H.filter((x, j) => j < 7 && j !== 3), h = pick(V); Q.push(mc(`Which one reads “${c === "ا" ? "" : (L.find(x => x[0] === c)[2].split(" ")[0])}${h[3]}”? • أيها يُقرأ هكذا؟`, c + h[0], V.filter(x => x !== h).map(x => c + x[0]), { big: 1 })); }
      else { const lg = pick([["َا", "ā"], ["ِي", "ī"], ["ُو", "ū"]]); Q.push(mc(`Long vowel “${lg[1]}” • أيها فيه المد «${lg[1]}»؟`, c + lg[0], [c + "َ", c + "ِ", c + "ُ", c + "ْ"].concat([["َا"], ["ِي"], ["ُو"]].filter(x => x[0] !== lg[0]).map(x => c + x[0])), { big: 1 })); } }
    else if (b === "read") { const T = await quran(); if (!T) return Q; const pool = READ.flatMap(([su]) => T.suras[su - 1].ayat.map((a, i) => [su, i + 1, a.replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, "").replace(/﻿/g, "")])).filter(x => x[2].split(" ").length >= 3), allW = pool.flatMap(x => x[2].split(" "));
      for (let i = 0; i < n; i++) { const [su, ay, t] = pick(pool), w = t.split(" "), at = lv === 1 ? w.length - 1 : lv === 2 ? Math.floor(Math.random() * w.length) : Math.floor(Math.random() * w.length);
        const shown = w.map((x, j) => j === at ? "<u>⋯</u>" : esc(lv === 3 ? bare(x) : x)).join(" ");
        Q.push(mc(`أكمل الآية • Complete the verse${lv === 3 ? " (بلا تشكيل)" : ""}: <span class="arbqa">﴿${shown}﴾</span> <small class="mut">[${esc(nmS(su))}: ${toAr(ay)}]</small>`, w[at], shuf(allW).filter(x => bare(x) !== bare(w[at])), { big: 1 })); } }
    else if (b === "grammar") shuf(lv === 1 ? GQ.slice(0, 8) : GQ).slice(0, n).forEach(x => Q.push(mc(x[0], x[1], x.slice(2))));
    else if (b === "mid") { const base = MID.map(m => m[3]).concat(MQ); shuf(lv === 1 ? MID.map(m => m[3]) : base).slice(0, n).forEach(x => Q.push(mc(x[0], x[1], x.slice(2)))); }
    else if (b === "midread") { const all = (await readSet()).filter(x => lv === 1 ? x.l <= 2 : true), nm = { q: "آية قرآنية", h: "حديث نبوي", k: "حكمة أو أثر", p: "شعر" };
      for (let i = 0; i < n; i++) { const x = pick(all), w = x.t.split(" "), kind = lv === 1 ? 0 : lv === 2 ? i % 2 : i % 3;
        if (kind === 0) Q.push(mc(`ما نوع هذا النص؟ • What kind of text is this? <span class="arbqa">${esc(bare(x.t))}</span>`, nm[x.c], Object.values(nm)));
        else if (kind === 1) { const cand = w.map((v, j) => [v, j]).filter(([v]) => bare(v).length >= 3 && /[َُِ]$/.test(v)); if (!cand.length) { i--; continue; } const [v, j] = pick(cand), stem = v.slice(0, -1), fin = v.slice(-1);
          Q.push(mc(`اختر الضبط الصحيح للكلمة المعلَّمة • Choose the correct vowelling: <span class="arbqa">${w.map((z, m) => m === j ? `<mark>${esc(bare(z))}</mark>` : esc(bare(z))).join(" ")}</span>`, v, ["َ", "ُ", "ِ"].filter(h => h !== fin).map(h => stem + h), { big: 1 })); }
        else { const j = Math.floor(Math.random() * w.length); Q.push(mc(`أكمل • Complete: <span class="arbqa">${w.map((z, m) => m === j ? "<u>⋯</u>" : esc(z)).join(" ")}</span>`, w[j], shuf(all.flatMap(y => y.t.split(" "))).filter(z => bare(z) !== bare(w[j])), { big: 1 })); } } }
    return Q;
  }
  let TS = null;  // الاختبار الجاري
  function testsPage(q, p) {
    const done = BRK.filter(b => lvlOf(p, b) >= 3).length;
    return `<p class="arben">Each branch has three graded levels (5, 10, then 15 questions). Score 80% to unlock the next level; pass all three to master the branch. When every branch is mastered, take the comprehensive test. Progress is saved on this device.</p>
      <p>أتقنتَ ${toAr(done)} من ${toAr(BRK.length)} فروع.${done === BRK.length ? ` <button class="btn p" data-act="arbtest" data-b="all" data-l="3">الاختبار الشامل • Final test (٢٠)</button>${p.mall ? " ✓ اجتزته" : ""}` : ""}</p>
      <div id="arbtest"></div><div class="arbtcs">${cardsHtml(p)}</div>`;
  }
  function cardsHtml(p) {
    return BRK.map(b => { const n = lvlOf(p, b); return `<div class="arbtc${n >= 3 ? " done" : ""}"><b>${esc(BR[b])}</b><span class="arblv">${[1, 2, 3].map(k => `<i class="${k <= n ? "on" : ""}">${toAr(k)}</i>`).join("")}</span><small class="mut">${lvlTxt(p, b)}${(p.mb || {})[b] ? " • أفضل نتيجة " + toAr((p.mb || {})[b]) + "٪" : ""}</small>
      <div class="row">${n < 3 ? `<button class="btn s p" data-act="arbtest" data-b="${b}" data-l="${n + 1}">ابدأ المستوى ${toAr(n + 1)} (${toAr(NQ[n + 1])} أسئلة)</button>` : ""}${n ? `<button class="btn s" data-act="arbtest" data-b="${b}" data-l="${Math.min(3, n)}">أعد المستوى ${toAr(Math.min(3, n))}</button>` : ""}<a class="btn s" href="#/arabic?t=${b}">راجع الدرس</a></div></div>`; }).join("");
  }
  async function startTest(b, lv) {
    let Q; if (b === "all") { const parts = await Promise.all(BRK.map(k => gen(k, 3))); Q = shuf(parts.flatMap(x => shuf(x).slice(0, 4))).slice(0, 20); } else Q = await gen(b, lv);
    if (!Q.length) return toast("تعذّر إعداد الاختبار"); TS = { b, lv, Q, i: 0, ok: 0 }; showQ(); const el = $("#arbtest"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showQ() { const el = $("#arbtest"); if (!el || !TS) return; const x = TS.Q[TS.i];
    el.innerHTML = `<div class="tmq arbtq"><p class="mut">${esc(TS.b === "all" ? "الاختبار الشامل" : BR[TS.b])} • المستوى ${toAr(TS.lv)} • السؤال ${toAr(TS.i + 1)} / ${toAr(TS.Q.length)} • ✓ ${toAr(TS.ok)}</p><p>${x.q}</p><div class="row">${x.o.map((o, j) => `<button class="btn tmo${x.big ? " arbo" : ""}" data-act="arbta" data-j="${j}">${esc(o)}</button>`).join("")}</div></div>`; }
  function answer(j) { const x = TS.Q[TS.i], ok = x.o[j] === x.ans; if (ok) TS.ok++;
    document.querySelectorAll("#arbtest [data-act=arbta]").forEach(b => { if (x.o[+b.dataset.j] === x.ans) b.classList.add("right"); else if (+b.dataset.j === j) b.classList.add("wrong"); b.disabled = true; });
    setTimeout(() => { TS.i++; if (TS.i < TS.Q.length) return showQ(); finish(); }, ok ? 700 : 1600); }
  function finish() { const pc = Math.round(100 * TS.ok / TS.Q.length), pass = TS.ok / TS.Q.length >= PASS, p = P(), mt = Object.assign({}, p.mt), mb = Object.assign({}, p.mb);
    if (TS.b === "all") { if (pass) setP({ mall: Math.max(pc, p.mall || 0) }); }
    else { if (pass && TS.lv > (mt[TS.b] || 0)) mt[TS.b] = TS.lv; mb[TS.b] = Math.max(pc, mb[TS.b] || 0); setP({ mt, mb, score: (p.score || 0) + TS.ok }); }
    const next = TS.b !== "all" && pass && TS.lv < 3, b = TS.b, lv = TS.lv; TS = null;
    $("#arbtest").innerHTML = `<div class="note arbres ${pass ? "ok" : "no"}"><b>${pass ? "أحسنت! نجحت" : "لم تبلغ ٨٠٪ بعد"} — ${toAr(pc)}٪</b><br>${pass ? (b === "all" ? "أتممت الاختبار الشامل، بارك الله فيك. انتقل إلى «ما بعد ذلك»." : lv >= 3 ? "أتقنت هذا الفرع." : "انفتح المستوى التالي.") : "راجع الدرس ثم أعد المحاولة."}
      <div class="row" style="margin-top:8px">${next ? `<button class="btn p s" data-act="arbtest" data-b="${b}" data-l="${lv + 1}">المستوى ${toAr(lv + 1)} ←</button>` : ""}<button class="btn s" data-act="arbtest" data-b="${b}" data-l="${lv}">أعد الاختبار</button><a class="btn s" href="#/arabic?t=tests">كل الفروع</a></div></div>`;
    const c = document.querySelector(".arbtcs"); if (c) c.innerHTML = cardsHtml(P()); }

  // ======================= ما بعد ذلك: منهج يجمع إتقان علوم العربية بكتب الشريعة الأساسية، متدرجًا، من كتب المكتبة =======================
  const NEXT = [
    ["المرحلة الأولى: التأسيس", "Stage 1 — Foundations", "قراءة النص المشكول بلا لحن، وإعراب الجملة البسيطة، وحفظ قصار السور والأحاديث.", "Read vowelled texts without mistakes, parse simple sentences, memorise short sūras and ḥadīth.", [
      ["اللغة", "النحو", "ajurrumiyya", "متن الآجرومية — أول متون النحو"], ["اللغة", "التجويد", "tuhfatatfal", "تحفة الأطفال — أحكام التجويد"], ["اللغة", "قيمة الفصحى", "p032b9da4", "خطر الكتابة بالعامية — الشيخ محمد إسماعيل المقدم"],
      ["العقيدة", "", "usulthalatha", "الأصول الثلاثة"], ["العقيدة", "", "p32658dc3", "لا إله إلا الله كلمة النجاة — الشيخ ياسر برهامي"], ["الحديث", "", "arbain", "الأربعون النووية"],
      ["الفقه والآداب", "", "adabmashy", "آداب المشي إلى الصلاة — صفة الصلاة وأحكامها"], ["علوم القرآن", "", "p26b6ca3f", "علم التلاوة — أبو إدريس محمد عبد الفتاح"],
      ["السيرة", "", "fusul", "الفصول في سيرة الرسول ﷺ — ابن كثير"], ["التزكية", "", "p60fd2fc2", "تزكية النفوس — الشيخ أحمد فريد"], ["أدب الطلب", "", "tadhkirasami", "تذكرة السامع والمتكلم — ابن جماعة"]]],
    ["المرحلة الثانية: البناء", "Stage 2 — Building", "قراءة النص غير المشكول، والإعراب التفصيلي، وتوسيع المفردات، والاستدلال بالنصوص.", "Read unvowelled texts, parse in detail, widen vocabulary, and learn to cite evidence.", [
      ["اللغة", "النحو", "qatr", "قطر الندى وبل الصدى — ابن هشام"], ["اللغة", "النحو", "shudhur", "شرح شذور الذهب — ابن هشام"], ["اللغة", "المفردات", "fiqhlugha", "فقه اللغة وسر العربية — الثعالبي"],
      ["العقيدة", "", "tawhid", "كتاب التوحيد"], ["العقيدة", "", "wasitiyya", "العقيدة الواسطية — ابن تيمية"], ["العقيدة", "", "pb73bc08d", "كشف الشبهات بتعليقات د. طلعت مرزوق"], ["العقيدة", "", "pc7ca2eea", "كيف نؤمن بالقدر — الشيخ ياسر برهامي"],
      ["الحديث", "", "umdaahkam", "عمدة الأحكام — عبد الغني المقدسي"], ["مصطلح الحديث", "", "bayquniyya", "المنظومة البيقونية"], ["مصطلح الحديث", "", "p7719f53a", "نظم الدرر في مصطلح علم الأثر — الشيخ أحمد فريد"],
      ["الفقه", "", "umdafiqh", "عمدة الفقه — ابن قدامة"], ["أصول الفقه", "", "waraqat", "الورقات — الجويني"], ["التفسير", "", "muqusul", "مقدمة في أصول التفسير — ابن تيمية"], ["التفسير", "", "saddi", "تفسير السعدي"],
      ["التزكية", "", "uluwhimma", "علو الهمة — الشيخ محمد إسماعيل المقدم"], ["السيرة", "", "p4289f23d", "وقفات تربوية مع السيرة النبوية — الشيخ أحمد فريد"]]],
    ["المرحلة الثالثة: التمكّن", "Stage 3 — Mastery", "الإعراب الكامل وفهم الأساليب، والتذوق الأدبي، وقراءة المطولات والشروح.", "Full grammatical analysis, literary taste, and reading the major works and commentaries.", [
      ["اللغة", "النحو", "alfiyya", "ألفية ابن مالك"], ["اللغة", "النحو", "ibnaqil", "شرح ابن عقيل على الألفية"], ["اللغة", "النحو", "awdahmasalik", "أوضح المسالك — ابن هشام"],
      ["اللغة", "الأدب", "adabkatib", "أدب الكاتب — ابن قتيبة"], ["اللغة", "الأدب", "kamilmubarrad", "الكامل في اللغة والأدب — المبرد"], ["اللغة", "البيان", "bayantabyin", "البيان والتبيين — الجاحظ"],
      ["العقيدة", "", "tahawiyya", "متن العقيدة الطحاوية"], ["العقيدة", "", "sharhtahawiyya", "شرح الطحاوية — ابن أبي العز"], ["العقيدة", "", "p25133794", "المنة شرح اعتقاد أهل السنة — الشيخ ياسر برهامي"], ["العقيدة", "", "p3f8e091b", "عقيدة أهل السنة في مسائل الإيمان والكفر — الشيخ ياسر برهامي"],
      ["الحديث", "", "bulugh", "بلوغ المرام — ابن حجر"], ["الحديث", "", "p1f08a935", "شرح صحيح مسلم — الشيخ ياسر برهامي"], ["مصطلح الحديث", "", "nuzhanazar", "نزهة النظر — ابن حجر"],
      ["الفقه", "", "rawdmurbi", "الروض المربع"], ["الفقه", "", "pf2a3a079", "فقه الأمر بالمعروف والنهي عن المنكر — الشيخ ياسر برهامي"], ["التفسير", "", "ibnkathir-v01", "تفسير ابن كثير"],
      ["السيرة", "", "zadmaad-v01", "زاد المعاد — ابن القيم"], ["الفكر والمنهج", "", "pa481e050", "أصول بلا أصول — الشيخ محمد إسماعيل المقدم"], ["الفكر والمنهج", "", "p6c9b38fc", "لماذا انتميت إلى الدعوة السلفية — الشيخ عادل نصر"]]]];
  function nextPage(p) {
    const done = BRK.filter(b => lvlOf(p, b) >= 3).length;
    return `<p class="arben">After the basics, this path joins mastery of the Arabic sciences (grammar, vocabulary, literature) with the core books of the Sharī‘a, in three graded stages — all available in this library, including books by scholars of the Salafi Da‘wa in Egypt. In every book, long-press a word for its meaning, and use the book’s summary, mind map and quiz.</p>
      <div class="note">المنهج: في كل مرحلة يسير الطالب في علوم العربية وعلوم الشريعة معًا؛ فيقرأ متن اللغة ويحفظه، ويقرأ معه كتب العقيدة والحديث والفقه والتفسير والسيرة بعربية سليمة، ويطبّق ما تعلّمه من النحو على نصوصها. ${done < BRK.length ? `ابدأ بعد إتقان فروع هذا القسم (${toAr(done)} / ${toAr(BRK.length)} — <a href="#/arabic?t=tests">اختبارات الإتقان</a>).` : "أتقنت فروع القسم؛ فابدأ المرحلة الأولى."}</div>` +
      NEXT.map(([ar, en, goal, goalEn, L], si) => `<details class="hfold arbstage"${si === 0 ? " open" : ""}><summary>${esc(ar)} <small class="arben">${esc(en)}</small></summary><div><p><b>الغاية اللغوية:</b> ${esc(goal)} <small class="arben">${esc(goalEn)}</small></p>
        <ul class="arbnext">${L.filter(x => B(x[2])).map(([sci, sub, id, n]) => { const b = B(id), dawah = b.col === "dawah"; return `<li><span class="arbsci">${esc(sci)}${sub ? " • " + esc(sub) : ""}</span> <a href="#/book/${esc(id)}/1">${esc(n)}</a>${dawah ? ' <span class="rb">من كتب مشايخ الدعوة</span>' : ""}</li>`; }).join("")}</ul></div></details>`).join("") +
      `<p class="mut">ولممارسة القراءة: <a href="#/hadith">قسم الحديث</a>، و<a href="#/mushaf">المصحف</a> (اضغط أي كلمة لغريبها في «السراج»)، و<a href="#/paths">المسارات العلمية</a>.</p>`;
  }

  let G = null;
  async function quiz(k) {
    if (k === "order" || k === "jarr") return quizMid(k);
    const pick = a => a[Math.floor(Math.random() * a.length)], sh = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    let q, opts, ans;
    if (k === "letter") { const c = pick(L); ans = c[0]; opts = sh([c, ...sh(L.filter(x => x !== c)).slice(0, 3)]).map(x => x[0]); q = `<button class="btn" data-act="arbsay" data-t="${c[0]}">🔊 Listen • استمع</button>`; setTimeout(() => say(c[0]), 200); }
    else if (k === "haraka") { const c = pick(L)[0], h = pick(H.slice(0, 3)); ans = c + h[0]; opts = sh(H.slice(0, 3).map(x => c + x[0])); q = `<button class="btn" data-act="arbsay" data-t="${ans}">🔊 Listen • استمع</button>`; setTimeout(() => say(ans), 200); }
    else { const c = pick(L); ans = c[0]; opts = sh([c, ...sh(L.filter(x => x !== c)).slice(0, 3)]).map(x => x[0]); q = `<b class="arbbig">${c[1]}</b>`; }
    G = { k, ans }; $("#arbqz").innerHTML = `<div class="tmq"><p>${q}</p><div class="row">${opts.map(o => `<button class="btn tmo arbo" data-act="arbans" data-v="${o}">${o}</button>`).join("")}</div></div>`;
  }
  // رتّب الكلمات: الجملة الأصلية من مقال الدعوة هي الإجابة؛ وحرف الجر: يُقبل أي حرف جر ظاهر في الجملة (في، إلى، على، عن)
  let OR = null;
  async function quizMid(k) {
    const S = await mids(), pool = k === "jarr" ? S.filter(x => x.j) : S.filter(x => x.w <= 9); if (!pool.length) return;
    const x = pool[Math.floor(Math.random() * pool.length)], toks = x.t.replace(/،/g, " ").split(/\s+/).filter(Boolean), src = `<a class="mut" href="#/book/${esc(x.a)}/1">المصدر • Source</a>`;
    if (k === "jarr") { G = { k, ans: null, ok: new Set(x.j.map(String)) };
      $("#arbqz").innerHTML = `<div class="tmq"><p>Tap the preposition (حرف الجر) in this sentence • اضغط حرف الجر:</p><p class="arbst">${toks.map((w, i) => `<button class="arbw" data-act="arbjr" data-i="${i}">${esc(w)}</button>`).join(" ")}</p>${src}</div>`; return; }
    let sh = toks.map((w, i) => [Math.random(), w, i]).sort((a, b) => a[0] - b[0]); if (sh.every((z, i) => z[2] === i)) sh.reverse();
    OR = { toks, got: [] }; G = { k };
    $("#arbqz").innerHTML = `<div class="tmq"><p>Put the words in order (read right to left) • رتّب الكلمات لتكوّن الجملة:</p><p class="arbst arbans" id="arbord">…</p><p class="arbst">${sh.map(z => `<button class="arbw" data-act="arbor" data-w="${esc(z[1])}">${esc(z[1])}</button>`).join(" ")}</p><div class="row"><button class="btn s" data-act="arbq" data-k="order">جملة أخرى • Another</button>${src}</div></div>`;
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "arbsay") { say(el.dataset.t); if (el.classList.contains("arbl") && L.some(x => x[0] === el.dataset.t)) { const l = new Set(P().l || []); l.add(el.dataset.t); setP({ l: [...l] }); el.classList.add("done"); } }
    else if (a === "arbq") quiz(el.dataset.k);
    else if (a === "arbmid") { const i = +el.dataset.i, ok = el.dataset.v === MID[i][3][1]; el.classList.add(ok ? "right" : "wrong"); el.parentNode.querySelectorAll("button").forEach(b => { if (b.dataset.v === MID[i][3][1]) b.classList.add("right"); b.disabled = true; });
      if (ok) { const md = new Set(P().md || []); md.add(i); setP({ md: [...md], mi: Math.min(MID.length - 1, i + 1), score: (P().score || 0) + 1 }); } }
    else if (a === "arbnext") setP({ ri: +el.dataset.i });
    else if (a === "arbtk") { setRO({ tk: RO().tk ? 0 : 1 }); route(); }
    else if (a === "arbfs") { const v = Math.max(1.1, Math.min(2.6, RO().fs + +el.dataset.d)); setRO({ fs: v }); const s = document.querySelector(".arbsent"); if (s) s.style.setProperty("--arbfs", v + "rem"); }
    else if (a === "arbseen") { const r = new Set(P().rs || []); r.add(el.dataset.k); setP({ rs: [...r] }); el.textContent = "✓ قرأتُه"; }
    else if (a === "arbtest") startTest(el.dataset.b, +el.dataset.l || 1);
    else if (a === "arbta" && TS) answer(+el.dataset.j);
    else if (a === "arbjr" && G && G.k === "jarr") { const ok = G.ok.has(el.dataset.i); el.classList.add(ok ? "right" : "wrong"); if (ok) { document.querySelectorAll(".arbw").forEach(b => { if (G.ok.has(b.dataset.i)) b.classList.add("right"); b.disabled = true; }); setP({ score: (P().score || 0) + 1 }); setTimeout(() => quiz("jarr"), 1300); } }
    else if (a === "arbor" && OR) { const want = OR.toks[OR.got.length]; if (el.dataset.w === want) { OR.got.push(want); el.disabled = true; el.classList.add("right"); $("#arbord").textContent = OR.got.join(" ");
        if (OR.got.length === OR.toks.length) { $("#arbord").classList.add("done"); say(OR.toks.join(" ")); setP({ score: (P().score || 0) + 1 }); } } else { el.classList.add("wrong"); setTimeout(() => el.classList.remove("wrong"), 600); } }
    else if (a === "arbans" && G) { const ok = el.dataset.v === G.ans; el.classList.add(ok ? "right" : "wrong"); document.querySelectorAll(".arbo").forEach(b => { if (b.dataset.v === G.ans) b.classList.add("right"); b.disabled = true; });
      if (ok) setP({ score: (P().score || 0) + 1 }); setTimeout(() => quiz(G.k), 1100); } });
  // ضبط الكلمة في وضع «بلا تشكيل»، وغريب الآية من «السراج»، وسرعة النطق
  document.addEventListener("click", e => { const w = e.target.closest(".arbsent .arbwd"); if (!w || RO().tk) return; w.classList.toggle("shown"); w.textContent = w.classList.contains("shown") ? w.dataset.v : bare(w.dataset.v); });
  document.addEventListener("toggle", e => { const d = e.target; if (!d.classList || !d.classList.contains("arbgr") || !d.open || d.dataset.ok) return; d.dataset.ok = 1;
    const box = d.querySelector("div"); if (typeof MUS !== "undefined" && MUS.gharibHtml) MUS.gharibHtml(+d.dataset.su, +d.dataset.ay).then(h => { box.innerHTML = h; }); else box.textContent = "—"; }, true);
  document.addEventListener("change", e => { if (e.target.matches && e.target.matches("[data-act=arbrate]")) setRO({ rate: +e.target.value }); });
  return { view: page };
})();
