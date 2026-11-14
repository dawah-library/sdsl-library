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

/* النسخ الآمن: إن رفض المتصفح الحافظة (متصفحات التطبيقات، iOS، أذونات الموقع) يُنسخ بالطريقة التقليدية،
   فلا تفشل أزرار «نسخ» في أي قسم بصمت. يغلّف navigator.clipboard.writeText مرة واحدة لكل الملفات. */
(function () {
  function legacy(t) {
    return new Promise(function (ok, no) {
      try {
        var a = document.createElement("textarea"); a.value = String(t); a.setAttribute("readonly", "");
        a.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(a); a.select(); a.setSelectionRange(0, a.value.length);
        var r = document.execCommand("copy"); a.remove(); r ? ok() : no(new Error("copy"));
      } catch (e) { no(e); }
    });
  }
  try {
    var c = navigator.clipboard;
    if (!c) { Object.defineProperty(navigator, "clipboard", { value: { writeText: legacy }, configurable: true }); return; }
    var orig = c.writeText && c.writeText.bind(c);
    c.writeText = function (t) { return orig ? orig(t).catch(function () { return legacy(t); }) : legacy(t); };
  } catch (e) { }
})();
