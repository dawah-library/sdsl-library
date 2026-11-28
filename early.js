/* يبدأ تنزيل الكتالوج مع تحميل الصفحة نفسها لا بعد تنفيذ app.js (الأداء، ٢٨ نوفمبر ٢٠٢٦): يستعمله boot() في app.js */
window.__P={cat:fetch("data/catalog.json",{cache:"no-cache"}).catch(function(){return null})};
