/* الشريط الجانبي للأقسام (بدل صف الروابط أعلى الصفحة): ثابت على الشاشات العريضة، ودرج منزلق على الجوال من زر ☰ أو «الأقسام».
   لكل قسم أيقونة Lucide (icons.js)، مع بحث سريع في الأقسام، وتمييز القسم الحالي، وطيّ المجموعات. وتُزيَّن بطاقات الرئيسية بالأيقونات نفسها. */
const SIDE = (() => {
  const G = [
    ["المكتبة", [["#/", "الرئيسية", "house"], ["#/library?c=dawah", "مكتبة الدعوة السلفية", "book-open"], ["#/library?c=turath", "المكتبة العامة", "landmark"], ["#/mushaf", "المصحف", "book-marked"], ["#/hadith", "الحديث النبوي", "scroll"], ["#/ithra", "المصادر الإثرائية", "sparkles"], ["#/releases", "جديد الإصدارات", "badge-plus"], ["#/majalla", "مجلة المكتبة", "newspaper"], ["#/furqan", "قضايا الفرقان", "scale"], ["#/tafrighat", "التفريغات والشروح", "mic"], ["#/authors", "المؤلفون", "users"], ["#/tarajim", "التراجم والأعلام", "user-round"]]],
    ["المقالات والفتاوى", [["#/articles", "المقالات", "file-text"], ["#/fatawa", "الفتاوى", "message-circle-question"], ["#/bayanat", "بيانات الدعوة", "megaphone"], ["#/posts", "منشورات المشايخ", "rss"]]],
    ["الدراسة والأدوات", [["#/search", "البحث المتقدم", "search"], ["#/ask", "اسأل المكتبة", "bot"], ["#/paths", "المسارات العلمية", "route"], ["#/hifz", "حفظ المتون", "brain"], ["#/quizzes", "اختبارات الكتب", "clipboard-check"], ["#/summary", "اختصار الكتب", "list-collapse"], ["#/qa", "سؤال وجواب", "messages-square"], ["#/tashjir", "تشجير الكتب", "network"], ["#/kurrasat", "كراسات المكتبة", "notebook-pen"], ["#/lexicon", "معجم المصطلحات", "book-a"], ["#/compare", "قارن بين كتابين", "columns-2"], ["#/timeline", "الخط الزمني", "history"], ["#/tahrir", "التنسيق وإعادة الصياغة", "pen-line"], ["#/qabasat", "قبسات", "quote"], ["#/arabic", "العربية لغير الناطقين", "languages"]]],
    ["القراءة معًا", [["#/groups", "القراءة الجماعية", "users-round"], ["#/challenges", "تحدي القراءة", "trophy"], ["#/stats", "إحصاءات المكتبة", "chart-bar"], ["#/community", "مجتمع المكتبة", "users"]]],
    ["استمع", [["#/audio", "صوتيات المكتبة", "headphones"], ["#/radio", "راديو المكتبة", "radio"], ["#/talaea", "الطلائع (للأطفال)", "baby"], ["#/tamarin", "تمارين الأساس والبنيان", "pencil"]]],
    ["حسابي", [["#/account", "حسابي «مكتبتي»", "circle-user"], ["#/favs", "المفضلة", "heart"]]],
    ["عن المكتبة", [["#/about", "من نحن", "info"], ["#/dawah", "التعريف بالدعوة", "flag"], ["#/history", "تاريخ الدعوة", "scroll-text"], ["#/standards", "معايير التحرير", "ruler"], ["#/contact", "تواصل معنا", "mail"]]],
  ];
  const ADM = [["#/admin", "الإدارة", "settings"], ["#/perms", "صلاحيات التفويض", "key-round"], ["#/fbin", "جلب منشورات فيسبوك", "download"], ["#/dev", "المساعد التقني", "bot"], ["#/proof", "تدقيق الكتب النصية", "pen-line"]];
  const MAP = {}; G.forEach(([, l]) => l.forEach(([h, , i]) => MAP[h.split("?")[0]] = MAP[h.split("?")[0]] || i));
  const fold = () => { try { return JSON.parse(localStorage.getItem("side_fold") || "{}"); } catch (e) { return {}; } };
  function render() {
    let el = $("#side"); const adm = isAdmin() || (Cloud.perms || []).length, F = fold();
    if (!el) { el = document.createElement("aside"); el.id = "side"; el.setAttribute("aria-label", "أقسام المكتبة"); document.body.appendChild(el);
      const bg = document.createElement("div"); bg.id = "sidebg"; bg.hidden = true; bg.onclick = close; document.body.appendChild(bg); }
    const groups = G.concat(adm ? [["الإدارة", ADM.filter(x => isAdmin() || x[0] === "#/admin" || (x[0] === "#/proof" && can("edit")))]] : []);
    el.innerHTML = `<div class="sdh"><b>الأقسام</b><button class="sdx" data-act="sdclose" aria-label="إغلاق">${ic("x", 18)}</button></div><input id="sdq" type="search" placeholder="ابحث عن قسم" aria-label="ابحث عن قسم" autocomplete="off">
      ${groups.map(([g, l], k) => `<section class="sdg${F[k] ? " fold" : ""}" data-k="${k}"><button class="sdgt" data-act="sdfold">${esc(g)}</button>${l.map(([h, t, i]) => `<a href="${h}" data-t="${esc(norm(t))}">${ic(i, 18)}<span>${esc(t)}</span></a>`).join("")}</section>`).join("")}
      <div class="sdf"><button data-act="skin">${ic("palette", 16)} قالب الواجهة</button><button data-act="gdshow">${ic("compass", 16)} دليل الموقع</button><button data-act="theme">◐ ليلي / نهاري</button><button data-act="uilang" data-noi18n>EN / ع</button><button data-act="shareSite">${ic("rss", 16)} مشاركة المكتبة</button><a class="sdfa" href="#/favs">${ic("heart", 16)} المفضلة</a></div>`;
    $("#sdq").oninput = e => { const w = norm(e.target.value).trim(); el.querySelectorAll("a[data-t]").forEach(a => a.hidden = !!w && !a.dataset.t.includes(w)); el.querySelectorAll(".sdg").forEach(s => { s.classList.toggle("q", !!w); }); };
    mark();
  }
  function mark() { const el = $("#side"); if (!el) return; const h = (location.hash && location.hash !== "#") ? location.hash : (location.pathname.length > 1 ? "#" + location.pathname : "#/"), p = h.split("?")[0];
    el.querySelectorAll("a[href]").forEach(a => { const ah = a.getAttribute("href"); a.classList.toggle("on", ah === h || (ah.split("?")[0] === p && p !== "#/" && !(ah.includes("?") && !h.includes(ah.split("?")[1])))); }); }
  const wide = () => matchMedia("(min-width:1100px)").matches;
  function open() { render(); document.body.classList.add("sdopen"); $("#sidebg").hidden = wide(); setTimeout(() => { const q = $("#sdq"); if (q && !wide()) q.focus(); }, 50); }
  function close() { document.body.classList.remove("sdopen"); const b = $("#sidebg"); if (b) b.hidden = true; }
  // تزيين بطاقات الرئيسية والأقسام بأيقوناتها
  function deco(root) { (root || document).querySelectorAll("a.card[href],a.col[href],.cols a[href]").forEach(a => { if (a.querySelector(".ic-svg")) return; const i = MAP[(a.getAttribute("href") || "").split("?")[0]]; if (i) a.insertAdjacentHTML("afterbegin", `<span class="cic">${ic(i, 22)}</span>`); }); }
  function init() {
    document.body.classList.add("has-side"); render();
    const top = document.querySelector("header.top"); if (top && !$("#sdbtn")) { const b = document.createElement("button"); b.id = "sdbtn"; b.className = "ic"; b.setAttribute("aria-label", "الأقسام"); b.dataset.act = "sdtoggle"; b.innerHTML = ic("menu", 20); top.prepend(b); }
    new MutationObserver(() => deco($("#app"))).observe($("#app"), { childList: true });
    window.addEventListener("hashchange", () => { mark(); if (!wide()) close(); });
  }
  document.addEventListener("click", e => { const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act;
    if (a === "sdtoggle" || a === "mega") { e.preventDefault(); e.stopImmediatePropagation(); document.body.classList.contains("sdopen") && !wide() ? close() : open(); }
    else if (a === "sdclose") close();
    else if (a === "sdfold") { const s = el.closest(".sdg"), F = fold(); s.classList.toggle("fold"); F[s.dataset.k] = s.classList.contains("fold") ? 1 : 0; try { localStorage.setItem("side_fold", JSON.stringify(F)); } catch (x) { } } }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("sdopen") && !wide()) close(); });
  if (document.readyState !== "loading") setTimeout(init, 0); else document.addEventListener("DOMContentLoaded", init);
  return { open, close, render, deco };
})();
