# تعليمات Claude Code

اقرأ AGENTS.md أولًا والتزمه (دليل التسليم الموحد لكل الوكلاء)، ثم HANDOFF.md وtools/agents/BOARD.md.

## ملخص المشروع (مرجع ثابت — لا تُعد فحص الملفات)
- **التقنيات:** واجهة PWA بلا إطار (JS لكل قسم في الجذر، `app.js` الموجّه والقارئ)، دوال `api/*.js` على Cloudflare Pages (`functions/`)، Supabase (حسابات/أدوار/سجلات قراءة)، R2 (مصورات/صوت)، GitHub Actions + `tools/*.py` للمعالجة الثقيلة (Gemini بمفاتيح متعددة).
- **البيانات:** `data/catalog.json` (كتب/مؤلفون/موضوعات)، `data/books/<id>.json` و`vols/` (نصوص: pages, toc, pl ترقيم المطبوع, pmap)، `data/*` لكل خدمة.
- **ملف جديد للواجهة:** يُضاف إلى `index.html` و`CORE` في `sw.js` و`ABOUT_MODULES` في `about.js`؛ الفحص: `node --check` و`python3 tools/check-about.py`.
- **الاختبار المحلي:** سكربت Playwright يشغّل `python3 -m http.server 8765` بنفسه ثم يغلقه (التشغيل الخلفي المنفصل مرفوض في الجلسة).
- **المتطلبات المرجعية:** `docs/requirements-2026-11.md` (التوضيح الموسع للمدير، بندًا بندًا مع مرحلته وحالته).
- **القرارات:** `DECISIONS.md`. **التوثيق:** `docs/`.

## حالة مراحل خطة المدير (٢٠ نوفمبر ٢٠٢٦)
- المرحلة ١ (منجزة): «أكمل القراءة» بلا تكرار؛ الطبعة المرجعية (`tools/refmap.py`، `data/refmap/`)؛ البحث الصرفي (`armorph.js`) بالقرن والسياق. التالي فيها: الفهرس المسبق في R2 (DECISIONS ق-٣).
- المرحلة ٢ (منجزة): التدقيق العلمي لـ«تمام المنة» p24c16cf5 و«الجامع لأحكام الصيام» pc64ccc07 (حطيبة) و«إشكالية علم الكلام» p842b98c1 (رضا ثابت): `tools/sci-audit.py` + `tools/derived-sync.py` (المصدر الواحد) + توسيع `ocr-quality.py`؛ التفاصيل `docs/scientific-audit.md`. متابعة: بعد إعادة قراءة صفحات الصيام من المصورة أعد `python3 tools/sci-audit.py pc64ccc07 --propose`.
- المرحلة ٣ (منجزة): التشكيل الدقيق (#/tahrir)، المختصر مع تشجير كل فصل وتصديره، المقارنة العلمية (cmpai.js، جدول comparisons) — docs/ai-text-services.md. والبحث الشامل (الفهرس المسبق) مؤجل بقرار المدير.
- السلسلة التلقائية: تصحيح النص ← التشكيل ← الصوت (refresh للصفحات المصححة) ← الإذاعة (derived.yml)، استثناء صريح من قرار إيقاف التوليد التلقائي.
- المرحلة ٤ (منجزة): شرح الكتب والمتون — sharh.js، tools/sharh-align.py، data/shp، shp.yml؛ docs/sharh-service.md.
- رحلة شرح السنة مفعّلة (ق-١٠): جولتان يوميًّا؛ «من شروح مشايخ الدعوة» في صفحة الحديث (tools/sharh-dawah.py ← data/sharh/dawah، فوائد بنص الشيخ تعتمدها الإدارة)؛ مشروع «صحيح مسلم وشروحه» منشور وجامع لكل شروحه.
- المرحلة ٥ (منجزة، تنتظر المفتاح): ElevenLabs — tools/tts.py (speak_eleven)، eleven.js، api/edit.js mode=eleven؛ docs/elevenlabs.md.
- المرحلة ٦ (منجزة): صانع الفيديو — النص في خانة واحدة وredistribute، مدة حرة، انتقالات xfade، أيقونات، فواصل ناعمة بلا موسيقى، tools/video-gen.py (Veo/fal)، openmontage.yml؛ docs/video-maker.md.
- المرحلة ٧: الواجهة الثلاثية (portal.js) نفّذها وكيل آخر في main — تُراجَع فقط. 
- المرحلة ٨ (منجزة): الآثار — باب المصدر، fit، مسودات، refit، مصادر مبوبة وخارجية؛ docs/athar.md.
- المرحلة ٩ (منجزة): outreach.js (#/awael، #/weekly، #/masala، #/newsletter)، tools/weekly.py، tools/newsletter.py، جدول subscribers؛ docs/community.md.
- الختام (منجز ٢٧ نوفمبر): تحديث «دراسة الموقع» بالمستجدات والمقارنات (القسم ٥ج وصفوف جديدة في جدول المقارنة) وصفحة التعريف.
- قسم «خطب الجمعة» (منجز، طلب المدير ٢١ نوفمبر): khutab.js، tools/khutab.py، khutab.yml، data/khutab — docs/khutab.md، ق-١٣.
- تفاسير المصحف المطولة (منجز ٢٧ نوفمبر، طلب المدير): ابن كثير والطبري والقرطبي في vols/tafsir لكل صفحة، والمختصر مقدَّم؛ التدقيق tools/tafsir-build.py — docs/mushaf-tafsir.md، ق-١٥.
- الموسوعة الفقهية المقارنة وسائر الموسوعات بالمنهج الموسع (منجز، طلب المدير ٢٧ نوفمبر): tools/mawsua_fiqh.py، tools/mawsua_disc.py، data/mawsua/_fiqh.json، _disc.json، ق-١٤، docs/mawsua.md؛ التحديث المحافظ (.new.json بسجل chg) لكل الموسوعات.
