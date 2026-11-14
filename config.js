/* إعدادات الموقع (التفاصيل في README) */
window.SDSL_CONFIG = {
  siteUrl: "https://dawahlibrary.org/",   // رابط الموقع؛ يُضاف إلى القبسات والنصوص المنسوخة
  supabaseUrl: "https://nqxkkdexpodjjwfdkxoq.supabase.co",                        // مثال: https://xxxx.supabase.co
  supabaseAnonKey: "sb_publishable_ymAoBjctO_eEeVPJPSuS_Q_jjHOLaHy",                    // المفتاح العام anon (آمن للمتصفح)
  askEndpoint: "api/ask",
  importEndpoint: "api/import"
};

/* توقيت مكة المكرمة (UTC+3) في كل ساعات الموقع وتواريخه وسجلاته (طلب المدير): كل تنسيق تاريخ أو وقت بلا منطقة صريحة
   يُعرض بتوقيت مكة أيًّا كانت منطقة جهاز القارئ، وMKT.day() تاريخ اليوم بتوقيت مكة (YYYY-MM-DD). */
(function () {
  const TZ = "Asia/Riyadh", P = Date.prototype;
  ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].forEach(f => { const o = P[f];
    P[f] = function (l, opt) { try { return o.call(this, l, Object.assign({ timeZone: TZ }, opt || {})); } catch (e) { return o.call(this, l, opt); } }; });
  window.MKT = { tz: TZ, day: d => new Date((d ? +new Date(d) : Date.now()) + 3 * 36e5).toISOString().slice(0, 10),
    hm: d => new Date(d || Date.now()).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) };
})();
