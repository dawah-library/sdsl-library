// يفتح روابط المشاركة المختصرة لفيسبوك (facebook.com/share/…) ويستخرج الرابط الحقيقي للصفحة واسمها ومعرّفها،
// ليضيفها المشرف إلى «حسابات فيسبوك». يعمل على خوادم GitHub (fb-resolve.yml). المدخل data/fb-links.json، والناتج فيه نفسه.
const fs = require("fs"), path = require("path");
const P = path.join(__dirname, "..", "data", "fb-links.json");
const UA = { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "accept-language": "ar,en" };
const dec = s => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)));
(async () => {
  const d = JSON.parse(fs.readFileSync(P, "utf8"));
  for (const it of d.items) {
    if (it.url && it.title) continue;
    try {
      let u = it.share, hops = 0, r, html = "";
      while (hops++ < 6) {
        r = await fetch(u, { headers: UA, redirect: "manual" });
        const loc = r.headers.get("location");
        if (r.status >= 300 && r.status < 400 && loc) { u = new URL(loc, u).href; continue; }
        html = await r.text(); break;
      }
      const og = k => dec((html.match(new RegExp('<meta[^>]+property="og:' + k + '"[^>]+content="([^"]*)"', "i")) || [])[1]);
      const real = og("url") || u;
      it.url = real.replace(/[?&](mibextid|rdid|share_url)=[^&]*/g, "").replace(/\?$/, "");
      it.title = og("title") || dec((html.match(/<title>([^<]*)/i) || [])[1]);
      it.desc = (og("description") || "").slice(0, 200);
      const m = it.url.match(/facebook\.com\/(?:profile\.php\?id=(\d+)|people\/[^/]+\/(\d+)|([A-Za-z0-9.\-_]+))/);
      it.fb = m ? (m[1] || m[2] || m[3]) : "";
      it.kind = /profile\.php|\/people\//.test(it.url) ? "person?" : /\/groups\//.test(it.url) ? "group" : "page?";
      it.status = r ? r.status : 0;
      console.log(it.share, "→", it.url, "|", it.title);
    } catch (e) { it.err = e.message; console.log(it.share, "خطأ", e.message); }
    await new Promise(s => setTimeout(s, 1500));
  }
  fs.writeFileSync(P, JSON.stringify(d, null, 1));
})();
