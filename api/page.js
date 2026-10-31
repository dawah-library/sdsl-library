// دالة خادم Vercel: صفحات قابلة للفهرسة في محركات البحث ولمعاينة الروابط عند مشاركتها.
// تعيد صفحة الموقع نفسها (index.html) مع عنوان ووصف وصورة مناسبة لكل كتاب أو مقال أو مؤلف،
// ونص الصفحة مكتوبًا داخلها ليقرأه محرك البحث، ثم يكمل الموقع عمله عاديًا في المتصفح.
const fs = require("../lib/fs"), path = require("path");
const ROOT = process.cwd(), SITE = "مكتبة الدعوة السلفية الرقمية";
let TPL = null, CAT = null, AIDX = null;
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plain = s => String(s || "").replace(/^# /gm, "").replace(/\s+\n/g, "\n").trim();
const cut = (s, n) => { s = plain(s).replace(/\s+/g, " "); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
function cat() { if (!CAT) { CAT = read("data/catalog.json"); CAT.books = CAT.books.filter(b => !b.hidden); } return CAT; } // المخفي لا يُعرض لمحركات البحث
function aidx() { if (!AIDX) { try { AIDX = (read("data/articles/index.json").items || []).filter(x => !x.h); } catch (e) { return []; } } return AIDX; }
const author = id => (cat().authors.find(a => a.id === id) || {});
const topic = id => (cat().topics.find(t => t.id === id) || {});
const COL = () => { const L = cat().labels || {}; return { dawah: L.col_dawah || "مكتبة الدعوة السلفية", turath: L.col_turath || "المكتبة العامة", ithra: L.col_ithra || "المصادر الإثرائية" }; };
async function template(origin) {
  if (TPL) return TPL;
  try { TPL = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"); }
  catch (e) { const r = await fetch(origin + "/index.html"); TPL = await r.text(); }
  return TPL;
}
async function findItem(id, origin) {
  const b = cat().books.find(x => x.id === id);
  if (b) {
    let sh = null;
    if (!b.vf) { try { sh = read("data/books/" + id + ".json"); } catch (e) { } }
    else { try { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 4000); const r = await fetch("https://raw.githubusercontent.com/" + (process.env.GITHUB_REPO || "dawah-library/sdsl-library") + "/main/vols/" + encodeURIComponent(id) + ".json", { signal: ac.signal }); clearTimeout(t); if (r.ok) sh = await r.json(); } catch (e) { } }
    return { b, pages: sh && sh.pages, pl: sh && sh.pl, toc: sh && sh.toc };
  }
  const x = aidx().find(y => y.id === id);
  if (!x) return null;
  let pages = null;
  try { const g = read("data/articles/" + x.f + ".json"); pages = g[id] && g[id].pages; } catch (e) { }
  return { b: { id, title: x.t, authorId: x.a, topicId: x.tp, date: x.d, type: "article", col: x.col || "dawah", url: x.u }, pages };
}
const SECTIONS = {
  library: ["المكتبة", "كتب مشايخ الدعوة السلفية بمصر، والمكتبة العامة: كتب التراث الإسلامي والمراجع وكتب العلماء والباحثين من خارج الدعوة، للقراءة والبحث."],
  quizzes: ["اختبارات الكتب", "اختبر فهمك لكتب المكتبة بثلاثة مستويات مع التصحيح الفوري."],
  summary: ["اختصار الكتب", "اختصر أي كتاب من كتب المكتبة بالنسبة التي تختارها، بألفاظ المؤلف، وحمّله PDF."],
  talaea: ["الطلائع", "عالم الأطفال في مكتبة الدعوة السلفية الرقمية: ألعاب تعليمية وقرآن وآداب ومعرفة."],
  releases: ["جديد الإصدارات", "جديد كتب مشايخ الدعوة السلفية بمصر وإصدارات دور النشر والمكتبات."],
  majalla: ["مجلة مكتبة الدعوة السلفية", "مجلة دورية تجمع في كل عدد موضوعًا علميًا أو دعويًا من كتب المكتبة ومقالاتها وفتاواها، مرتبةً في أبواب."],
  articles: ["المقالات", "مقالات موقع صوت السلف مصنفة بالموضوع والكاتب."],
  fatawa: ["الفتاوى", "فتاوى مشايخ الدعوة السلفية مصنفة بالأبواب الفقهية."],
  bayanat: ["بيانات الدعوة السلفية", "بيانات الدعوة السلفية بمصر مرتبة بالتاريخ."],
  posts: ["منشورات", "منشورات مشايخ الدعوة السلفية وكتّابها، وجديد المكتبة."],
  furqan: ["قضايا الفرقان", "المؤلفات المنهجية للدعوة السلفية في قضايا الفرقان."],
  tafrighat: ["تفريغات", "الدروس والشروح المفرغة نصيًا."],
  authors: ["المؤلفون", "مشايخ الدعوة السلفية وعلماء التراث في المكتبة."],
  ithra: ["المصادر الإثرائية", "بحوث ودراسات ومقالات علمية وشرعية من مراكز ومجلات خارج المصادر الأساسية، بمصادرها وروابطها الأصلية."],
  tarajim: ["التراجم", "تراجم مشايخ الدعوة السلفية بمصر."],
  about: ["من نحن", "التعريف بمكتبة الدعوة السلفية الرقمية."],
  dawah: ["التعريف بالدعوة السلفية", "التعريف بالدعوة السلفية بمصر ومنهجها."],
  history: ["تاريخ الدعوة السلفية", "تاريخ الدعوة السلفية بمصر."],
  contact: ["تواصل معنا", "تواصل مع إدارة مكتبة الدعوة السلفية الرقمية."],
  search: ["البحث", "البحث في نصوص كتب المكتبة ومقالاتها."],
  qabasat: ["قبسات", "صمّم صورة من نص مختار من كتب المكتبة لمشاركتها."],
  ask: ["المساعد العلمي", "مساعد بالذكاء الاصطناعي يبحث في كتب المكتبة ويجيب مع الإحالة إلى الكتاب والصفحة."],
  ai: ["المساعد العلمي", "مساعد بالذكاء الاصطناعي يبحث في كتب المكتبة ويجيب مع الإحالة إلى الكتاب والصفحة."]
};
async function build(p, q, base) {
  const seg = p.split("/").filter(Boolean).map(decodeURIComponent), v = (seg[0] || "").toLowerCase();
  const r = { title: SITE, desc: "", body: "", ld: null, type: "website", noindex: false };
  if (v === "book" && seg[1]) {
    const it = await findItem(seg[1], base.replace(/\/$/, "")); if (!it) { r.noindex = true; r.title = "غير موجود — " + SITE; return r; }
    const b = it.b, a = author(b.authorId), art = b.type === "article", n = it.pages ? it.pages.length : (b.n || 1);
    const pg = Math.min(Math.max(1, parseInt(seg[2]) || 1), n), lbl = it.pl && it.pl[pg - 1] ? it.pl[pg - 1] : (art ? "" : "ص " + pg);
    const name = b.setTitle ? b.title : b.title, txt = it.pages ? it.pages[pg - 1] : "";
    r.title = name + (lbl && n > 1 ? " — " + lbl : "") + (a.name ? " | " + a.name : "");
    r.desc = (pg === 1 && b.card && b.card.summary ? cut(b.card.summary, 180) : cut(txt, 180)) || [name, a.name, b.source].filter(Boolean).join(" — ");
    r.type = art ? "article" : "book";
    r.ld = art ? { "@context": "https://schema.org", "@type": "Article", headline: b.title, author: { "@type": "Person", name: a.name }, datePublished: b.date || undefined, inLanguage: "ar", isPartOf: { "@type": "WebSite", name: SITE } }
      : { "@context": "https://schema.org", "@type": "Book", name: b.setTitle || b.title, author: { "@type": "Person", name: a.name }, inLanguage: "ar", genre: topic(b.topicId).name, publisher: b.source || undefined };
    const nav = `<p>${pg > 1 ? `<a href="/book/${b.id}/${pg - 1}">الصفحة السابقة</a> ` : ""}${pg < n ? `<a href="/book/${b.id}/${pg + 1}">الصفحة التالية</a>` : ""}</p>`;
    const toc = (it.toc || []).slice(0, 80).map(t => `<li><a href="/book/${b.id}/${t.p}">${esc(t.t)}</a></li>`).join("");
    r.body = `<article><h1>${esc(b.setTitle ? b.title : b.title)}</h1><p><a href="/author/${esc(b.authorId)}">${esc(a.name || "")}</a>${topic(b.topicId).name ? " • " + esc(topic(b.topicId).name) : ""}${lbl ? " • " + esc(lbl) : ""}</p>
${b.source ? `<p>${esc(b.source)}</p>` : ""}${plain(txt).split("\n").filter(Boolean).map(l => `<p>${esc(l)}</p>`).join("\n")}${nav}${toc && pg === 1 ? `<h2>الفهرس</h2><ul>${toc}</ul>` : ""}</article>`;
    return r;
  }
  if (v === "author" && seg[1]) {
    let a = author(seg[1]); if (a.mergedInto) { a = author(a.mergedInto); r.canon = "author/" + a.id; } if (!a.name) { r.noindex = true; return r; } // المدموج يعرض المؤلف الموحَّد برابطه المعتمد
    const books = cat().books.filter(b => b.authorId === a.id && !(b.set && b.vol > Math.min(...cat().books.filter(y => y.set === b.set).map(y => y.vol)))), arts = aidx().filter(x => x.a === a.id);
    r.title = a.name + " — " + SITE; r.desc = cut(a.bio || `كتب ${a.name} ومقالاته في ${SITE}: ${books.length} كتابًا و${arts.length} مقالًا وفتوى.`, 180); r.type = "profile";
    const ph = a.photo ? base + String(a.photo).replace(/^\//, "") : undefined; if (ph) r.image = ph;
    r.ld = { "@context": "https://schema.org", "@type": "Person", name: a.name, description: a.bio || undefined, image: ph };
    r.body = `<h1>${esc(a.name)}</h1>${a.bio ? `<p>${esc(a.bio)}</p>` : ""}<h2>الكتب</h2><ul>${books.map(b => `<li><a href="/book/${b.id}/1">${esc(b.setTitle || b.title)}</a></li>`).join("")}</ul><h2>المقالات والفتاوى</h2><ul>${arts.slice(0, 200).map(x => `<li><a href="/book/${x.id}/1">${esc(x.t)}</a></li>`).join("")}</ul>`;
    return r;
  }
  if (v === "post" && seg[1]) {
    let posts = []; try { posts = read("data/posts.json").items || []; } catch (e) { }
    const x = posts.find(y => y.id === seg[1]);
    if (x) { const a = author(x.authorId); r.title = (a.name || SITE) + ": " + cut(x.text, 60); r.desc = cut(x.text, 180); r.type = "article"; if (x.image) r.image = /^https?:/.test(x.image) ? x.image : base + x.image.replace(/^\//, ""); r.body = `<article><h1>${esc(a.name || SITE)}</h1>${plain(x.text).split("\n").map(l => `<p>${esc(l)}</p>`).join("")}</article>`; }
    return r;
  }
  if (v === "library" && q.c) { const c = COL()[q.c] || "المكتبة"; r.title = c + " — " + SITE; const list = cat().books.filter(b => (b.col || "dawah") === q.c && !(b.set && b.vol > Math.min(...cat().books.filter(y => y.set === b.set).map(y => y.vol)))); r.desc = q.c === "turath" ? "المكتبة العامة: كتب التراث الإسلامي في الحديث والتفسير والعقيدة والفقه بترقيم الطبعات المطبوعة، وكتب العلماء والباحثين من خارج الدعوة السلفية." : "كتب مشايخ الدعوة السلفية بمصر."; r.body = `<h1>${esc(c)}</h1><ul>${list.map(b => `<li><a href="/book/${b.id}/1">${esc(b.setTitle || b.title)}</a> — ${esc(author(b.authorId).name || "")}</li>`).join("")}</ul>`; return r; }
  if (SECTIONS[v]) { r.title = SECTIONS[v][0] + " — " + SITE; r.desc = SECTIONS[v][1]; r.body = `<h1>${esc(SECTIONS[v][0])}</h1><p>${esc(SECTIONS[v][1])}</p>`; if (["account", "admin", "favs"].includes(v)) r.noindex = true; return r; }
  if (["account", "admin", "favs"].includes(v)) { r.noindex = true; r.title = SITE; return r; }
  return r;
}
module.exports = async (req, res) => {
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host, origin = "https://" + host, base = (process.env.SITE_URL || "https://dawahlibrary.org").replace(/\/$/, "") + "/";
    const u = new URL(req.url, origin), p = u.searchParams.get("__p") || "/"; ["__p", "first", "rest"].forEach(k => u.searchParams.delete(k));
    const q = Object.fromEntries(u.searchParams), qs = u.searchParams.toString();
    const r = await build(p, q, base), canon = base + (r.canon || p.replace(/^\//, "")) + (qs && !/^\/book\//.test(p) ? "?" + qs : "");
    r.desc = r.desc || "المكتبة الرقمية للدعوة السلفية بمصر: كتب المشايخ ومقالاتهم وفتاواهم، والمكتبة العامة لكتب التراث، والمصادر الإثرائية، مع البحث والقراءة والتشجير والأعلام والمساعد العلمي وقسم الطلائع.";
    const img = r.image || base + "assets/og.jpg";
    const head = `<link rel="canonical" href="${esc(canon)}">
<meta property="og:site_name" content="${esc(SITE)}"><meta property="og:locale" content="ar_AR"><meta property="og:type" content="${r.type}">
<meta property="og:title" content="${esc(r.title)}"><meta property="og:description" content="${esc(r.desc)}"><meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(r.title)}"><meta name="twitter:description" content="${esc(r.desc)}"><meta name="twitter:image" content="${esc(img)}">
${r.noindex ? '<meta name="robots" content="noindex">' : ""}${r.ld ? `<script type="application/ld+json">${JSON.stringify(r.ld).replace(/</g, "\\u003c")}</script>` : ""}`;
    let html = await template(origin);
    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(r.title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, () => `<meta name="description" content="${esc(r.desc)}">`)
      .replace(/<!--og-->[\s\S]*?<!--\/og-->/, "")
      .replace("</head>", () => head + "\n</head>");
    if (r.body) html = html.replace(/(<main id="app"[^>]*>)[\s\S]*?(<\/main>)/, (m, a, b) => a + '<div class="ssr">' + r.body + "</div>" + b);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.status(r.noindex && r.title.startsWith("غير موجود") ? 404 : 200).end(html);
  } catch (e) {
    console.error(e);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).end(TPL || '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/">');
  }
};
