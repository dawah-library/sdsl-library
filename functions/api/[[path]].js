// كل طلبات /api/* على Cloudflare Pages: تُوجَّه إلى ملفات api/*.js نفسها عبر المهايئ.
import { run } from "../_lib/adapter.js";
import gh from "../../api/gh.js";
import imp from "../../api/import.js";
import mpost from "../../api/mpost.js";
import notify from "../../api/notify.js";
import page from "../../api/page.js";
import pages from "../../api/pages.js";
import r2put from "../../api/r2put.js";
import remind from "../../api/remind.js";
import sitemap from "../../api/sitemap.js";
import tglink from "../../api/tglink.js";
import translate from "../../api/translate.js";

// المساعد العلمي يبحث في نصوص المكتبة كلها (~٢٠٠ م.ب) داخل الدالة، وهذا يتجاوز حدود Cloudflare المجانية.
const ask = (req, res) => res.status(503).json({ message: "المساعد العلمي متوقف مؤقتًا بعد نقل الاستضافة، ويعود قريبًا بإذن الله." });
const H = { gh, import: imp, mpost, notify, page, pages, r2put, remind, sitemap, tglink, translate, ask };
const DATA = { page: ["index.html", "data/catalog.json"], sitemap: ["data/catalog.json"], translate: ["data/catalog.json"], mpost: ["data/catalog.json"] };

export async function onRequest(ctx) {
  const name = String((ctx.params.path || [])[0] || "").replace(/\.js$/, "");
  const h = H[name];
  if (!h) return new Response(JSON.stringify({ message: "غير موجود" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
  const res = await run(h, ctx, { preload: DATA[name] || [], retry: name === "page" || name === "sitemap" });
  res.headers.set("x-robots-tag", "noindex");
  return res;
}
