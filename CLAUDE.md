# تعليمات Claude Code

اقرأ AGENTS.md أولًا والتزمه (دليل التسليم الموحد لكل الوكلاء)، ثم HANDOFF.md وtools/agents/BOARD.md.

## ملخص المشروع (مرجع ثابت — لا تُعد فحص الملفات)
- **التقنيات:** واجهة PWA بلا إطار (JS لكل قسم في الجذر، `app.js` الموجّه والقارئ)، دوال `api/*.js` على Cloudflare Pages (`functions/`)، Supabase (حسابات/أدوار/سجلات قراءة)، R2 (مصورات/صوت)، GitHub Actions + `tools/*.py` للمعالجة الثقيلة (Gemini بمفاتيح متعددة).
- **البيانات:** `data/catalog.json` (كتب/مؤلفون/موضوعات)، `data/books/<id>.json` و`vols/` (نصوص: pages, toc, pl ترقيم المطبوع, pmap)، `data/*` لكل خدمة.
- **ملف جديد للواجهة:** يُضاف إلى `index.html` و`CORE` في `sw.js` و`ABOUT_MODULES` في `about.js`؛ الفحص: `node --check` و`python3 tools/check-about.py`.
- **الاختبار المحلي:** سكربت Playwright يشغّل `python3 -m http.server 8765` بنفسه ثم يغلقه (التشغيل الخلفي المنفصل مرفوض في الجلسة).
- **القرارات:** `DECISIONS.md`. **التوثيق:** `docs/`.

## حالة مراحل خطة المدير (٢٠ نوفمبر ٢٠٢٦)
- المرحلة ١ (منجزة): «أكمل القراءة» بلا تكرار؛ الطبعة المرجعية (`tools/refmap.py`، `data/refmap/`)؛ البحث الصرفي (`armorph.js`) بالقرن والسياق. التالي فيها: الفهرس المسبق في R2 (DECISIONS ق-٣).
- المرحلة ٢ (منجزة): التدقيق العلمي لـ«تمام المنة» p24c16cf5 و«الجامع لأحكام الصيام» pc64ccc07 (حطيبة) و«إشكالية علم الكلام» p842b98c1 (رضا ثابت): `tools/sci-audit.py` + `tools/derived-sync.py` (المصدر الواحد) + توسيع `ocr-quality.py`؛ التفاصيل `docs/scientific-audit.md`. متابعة: بعد إعادة قراءة صفحات الصيام من المصورة أعد `python3 tools/sci-audit.py pc64ccc07 --propose`.
- المرحلة ٣ (التالية): الخدمات النصية بالذكاء الاصطناعي.
