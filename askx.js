/* المساعد العلمي (الإصدار الجديد): البحث يجري في متصفح القارئ على فهرس المكتبة المقلوب (data/sx، يُبنى عند النشر)،
   والخادم (api/ask) وسيط خفيف يمرّر المحادثة إلى Gemini ويعيد نصه أو طلبات أدواته جولةً جولة.
   فلا يُحمَّل في الخادم شيء من نصوص المكتبة، ويعمل المساعد مجانًا على الاستضافة المجانية،
   ويشمل البحث كتب المكتبة كلها بمجلداتها والمقالات والفتاوى، مع الإحالة إلى الكتاب والصفحة. */
const SX = (() => {
  let DOCS = null; const SH = new Map();
  const crc = s => { let c, t = SX._t || (SX._t = (() => { const a = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; a[n] = c >>> 0; } return a; })()); c = 0xFFFFFFFF; for (const b of new TextEncoder().encode(s)) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function docs() { if (DOCS !== null) return DOCS; try { const r = await fetch("data/sx/_docs.json"); DOCS = r.ok ? await r.json() : false; } catch (e) { DOCS = false; } return DOCS; }
  async function shard(t) { const n = crc(t) % (DOCS.shards || 2048); if (!SH.has(n)) SH.set(n, fetch("data/sx/" + n + ".json").then(r => r.ok ? r.json() : {}).catch(() => ({}))); return (await SH.get(n))[t]; }
  const P3 = /^[وفبلك](?=...)/;
  // مرشحات الصفحات من الفهرس ثم الترتيب الدقيق ومقتطفات النص بمحرك search.js على الكتب المرشحة وحدها
  async function search(q, o = {}) {
    const D = await docs(); if (!D) return null;
    const ts = SS.terms(q); if (!ts.length) return [];
    const ok = id => { const b = B(id); return b && !b.hidden && !b.demo && (!o.col || bc(b) === o.col) && (!o.bookId || b.id === o.bookId) && (!o.authorId || b.authorId === o.authorId) && (!o.type || (o.type === "article") === isArt(b)); };
    const N = D.n || 1, score = new Map();
    await Promise.all(ts.map(async (t, j) => {
      const e = (await shard(t)) || (P3.test(t) ? await shard(t.replace(P3, "")) : null); if (!e) return;
      const idf = Math.log(1 + (N + 1) / (e[0] + .5));
      e[1].split(" ").forEach(x => { const [k, p, f] = x.split("."), id = D.k[k]; if (!id) return; const key = id + ":" + p, v = score.get(key) || { s: 0, m: new Set() }; v.s += idf * (1 + Math.log(+f || 1)); v.m.add(j); score.set(key, v); });
    }));
    // الصفحات التي تجمع كلمات السؤال كلها مقدَّمة بقوة؛ ثم تُرتَّب الكتب بمجموع أعلى ثلاث صفحات فيها
    let cand = [...score].map(([k, v]) => [k, v.s * Math.pow(v.m.size / ts.length, 2), v.m.size]).filter(([k]) => ok(k.split(":")[0]));
    const full = cand.filter(c => c[2] === ts.length); if (ts.length > 1 && full.length >= 4) cand = full;
    const byBook = new Map(); cand.sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { const id = k.split(":")[0], l = byBook.get(id) || []; if (l.length < 3) l.push(v); byBook.set(id, l); });
    const books = [...byBook].map(([id, l]) => [id, l.reduce((a, b) => a + b, 0) + l[0]]).sort((a, b) => b[1] - a[1]).slice(0, o.bookId ? 1 : 8).map(x => x[0]);
    const loaded = (await Promise.all(books.map(id => loadBook(id).catch(() => null)))).filter(Boolean);
    return SS.search({ books: loaded, authors: lib.authors, topics: lib.topics }, q, { col: o.col, bookId: o.bookId, k: o.k || 8, includeDemo: false });
  }
  // ===== أدوات المصادر المتخصصة (تعمل في المتصفح على بيانات الموقع): القرآن، والحديث، واللغة، والأعلام =====
  const J = {}, getJ = u => J[u] || (J[u] = fetch(u).then(r => r.ok ? r.json() : null).catch(() => null));
  const qn = t => SS.norm(String(t || "")).replace(/[^\u0621-\u064A ]/g, " ").replace(/\s+/g, " ").trim();
  const NM = s => (typeof QREF !== "undefined" && QREF.N && QREF.N[s - 1]) || ("سورة " + s);
  const suraNo = x => { const n = +String(x || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)); if (n >= 1 && n <= 114) return n; return typeof QREF !== "undefined" ? QREF.sura(String(x || "").replace(/^سورة\s+/, "")) : 0; };
  const unB = (t, s, a) => a === 1 && s !== 1 && s !== 9 ? t.replace(/^\uFEFF?بِسْمِ\s+\S+\s+\S+\s+\S+\s*/, "") : t;
  const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  let QI = null;
  async function quranIdx() { if (QI) return QI; const q = await getJ("data/quran/quran.json"); if (!q) return null; QI = []; q.suras.forEach(S_ => S_.ayat.forEach((t, i) => QI.push([S_.n, i + 1, " " + qn(unB(t, S_.n, i + 1)) + " "]))); return QI; }
  async function quranAyah(input) {
    const s = suraNo(input.sura), a = +input.ayah || 0; if (!s) return { error: "لم أعرف السورة: " + (input.sura || "") };
    const U = (await getJ("data/quran/uthmani.json")) || (await getJ("data/quran/quran.json")); if (!U) return { error: "تعذر تحميل المصحف" };
    const ay = U.suras[s - 1].ayat; if (a < 1 || a > ay.length) return { error: "سورة " + NM(s) + " " + ay.length + " آية" };
    const z = Math.min(ay.length, Math.max(a, +input.to || a), a + 9), out = { sura: NM(s), ayat: [] };
    for (let k = a; k <= z; k++) out.ayat.push({ n: k, text: unB(ay[k - 1].replace(/\uFEFF/g, ""), s, k) });
    out.cite = "[" + NM(s) + ": " + AR(a) + (z > a ? "-" + AR(z) : "") + "]";
    const tk = ["mokhtasar", "muyassar", "saddi"].includes(input.tafsir) ? input.tafsir : "";
    if (tk) { const T = await getJ("data/quran/tafsir/" + tk + "/" + s + ".json"); out.tafsir = { source: { mokhtasar: "المختصر في التفسير", muyassar: "التفسير الميسر", saddi: "تفسير السعدي" }[tk], text: out.ayat.map(x => (T && T[x.n]) || "").filter(Boolean).join("\n").slice(0, 6000) }; }
    const G = await getJ("data/quran/tafsir/siraj/" + s + ".json");
    const g = out.ayat.flatMap(x => (G && Array.isArray(G[x.n]) ? G[x.n] : []).map(([w, m]) => w + ": " + m)); if (g.length) out.gharib = { source: "السراج في بيان غريب القرآن", items: g.slice(0, 20) };
    return out;
  }
  async function findAyah(input) {
    const I = await quranIdx(); if (!I) return { error: "تعذر تحميل المصحف" };
    const q = qn(input.text), ws = q.split(" ").filter(w => w.length > 1); if (ws.length < 2) return { error: "اكتب كلمتين فأكثر من الآية" };
    const res = [];
    for (const [s, a, t] of I) { if (t.includes(" " + q + " ")) res.push([3, s, a]); else { const n = ws.filter(w => t.includes(" " + w + " ") || t.includes(" " + w)).length; if (n >= Math.max(2, Math.ceil(ws.length * .8))) res.push([n / ws.length, s, a]); } }
    res.sort((x, y) => y[0] - x[0]);
    const U = await getJ("data/quran/uthmani.json");
    return { matches: res.slice(0, 6).map(([sc, s, a]) => ({ sura: NM(s), ayah: a, cite: "[" + NM(s) + ": " + AR(a) + "]", exact: sc === 3, text: U ? unB(U.suras[s - 1].ayat[a - 1].replace(/\uFEFF/g, ""), s, a) : "" })), total: res.length };
  }
  async function hadithLookup(input) {
    const H = await getJ("data/hadith/index.json"); if (!H) return { error: "تعذر تحميل فهرس الحديث" };
    const ws = qn(input.text).split(" ").filter(w => w.length > 1); if (!ws.length) return { error: "اكتب بعض لفظ الحديث" };
    const r = H.items.map(x => { const t = " " + qn(x[6] + " " + (x[4] || "")) + " "; return [ws.filter(w => t.includes(" " + w)).length, x]; }).filter(([n]) => n >= Math.max(1, Math.ceil(ws.length * .7))).sort((a, b) => b[0] - a[0]).slice(0, 6);
    return { matches: r.map(([, x]) => ({ book: (H.books || {})[x[1]] || x[1], bab: x[4] || "", sahabi: x[5] || "", tarf: x[6] || "", takhrij: x[7] || "", hukm: x[8] || "", ref: x[1] + ":" + x[2] })), note: "اقرأ الصفحة بـ get_page للمتن كاملًا وشرحه، وابحث بـ search_library في كتب السنة والشروح الأخرى." };
  }
  async function wordMeaning(input) {
    const w = String(input.word || "").trim(); if (!w) return { error: "الكلمة مطلوبة" };
    const out = { word: w, entries: [] };
    try { const M = await getJ("data/dict/mukhtar.json"), rs = typeof roots === "function" ? roots(w) : [];
      for (const r of rs) { const k = qn(r).replace(/\s/g, ""), e = M && M[k]; if (e) { out.entries.push({ source: "مختار الصحاح", root: e.r, text: String(e.t).replace(/^\s*:\s*/, "").slice(0, 1200) }); break; } } } catch (e) { }
    if (typeof GL !== "undefined") { const es = await GL.lookup(w).catch(() => []), bm = await GL.meta().catch(() => ({}));
      es.slice(0, 8).forEach(e => { const b = B(e[0]); out.entries.push({ source: (b && (b.setTitle || b.title)) || (bm[e[0]] && bm[e[0]].t) || e[0], ref: e[0] + ":" + e[1], kind: { l: "معجم", h: "موسوعة", d: "تعريف", q: "شرح الموضع", m: "بيان المعنى", a: "تفسير" }[e[2]] || "", text: String(e[3] || "").slice(0, 700) }); }); }
    if (!out.entries.length) out.note = "لم توجد الكلمة في معاجم المكتبة؛ جرّب جذرها أو search_library.";
    return out;
  }
  async function personBio(input) {
    if (typeof ALAM === "undefined") return { error: "خدمة الأعلام غير محمّلة" };
    const r = await ALAM.lookup(String(input.name || "")).catch(() => null); if (!r) return { error: "تعذر البحث" };
    const K = { t: "ترجمة", s: "صحابي", j: "جرح وتعديل", a: "مؤلف في المكتبة" };
    return { key: r.key, entries: (r.es || []).slice(0, 8).map(e => ({ name: e.n, kind: K[e.t] || "", source: e.s === "lib" ? "تراجم المكتبة" : (ALAM.SRC && ALAM.SRC[e.s]) || e.s, place: e.pl || "", grade: e.g || "", text: String(e.d || "").slice(0, 900), ref: e.b ? e.b + ":" + e.p : "" })), mentions: (r.m || []).slice(0, 6).map(x => Array.isArray(x) ? x[0] + ":" + x[1] : x), note: "اقرأ نص الترجمة بـ get_page على المرجع (ref) وانقل منه بحروفه." + ((r.es || []).length > 1 ? " وقد يكون أكثر من علم بهذا الاسم؛ لا تجزم إلا بقرينة." : "") };
  }
  const XT = { quran_ayah: quranAyah, find_ayah: findAyah, hadith_lookup: hadithLookup, word_meaning: wordMeaning, person_bio: personBio };
  async function runTool(name, input, scope) {
    input = input || {};
    if (XT[name]) { try { return await XT[name](input); } catch (e) { return { error: String(e && e.message || e) }; } }
    if (name === "search_library") { const r = await search(String(input.query || ""), { col: scope.col || input.collection || "", bookId: scope.bookId || input.book_id || "", authorId: input.author_id || "", type: input.type || "", k: Math.min(+input.k || 8, 12) }); return r === null ? { error: "فهرس البحث غير متاح" } : r.length ? r : { note: "لا نتائج؛ جرّب صيغة أخرى أو مرادفًا" }; }
    if (name === "get_page" || name === "book_outline") { const id = name === "get_page" ? String(input.ref || "").split(":")[0] : String(input.book_id || ""); if (B(id)) await loadBook(id).catch(() => {}); }
    return SS.runTool(lib, name, input, scope);
  }
  return { search, runTool, docs };
})();

/* الحلقة: سؤال ← Gemini (عبر الخادم) ← أدوات في المتصفح ← Gemini … حتى الإجابة */
AI.viaServer = async function (o) {
  const scope = { col: o.col, bookId: o.bookId }, used = [], deep = ["research", "compare", "gather", "summarize", "plan", "quiz"].includes(o.mode), maxR = deep ? 9 : 7;  // أدوات المصادر (الآيات والحديث واللغة والأعلام) تزيد جولات البحث
  const contents = o.turns.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const XO = typeof ASKX !== "undefined" ? ASKX.take() : { att: [], body: {} };  // مرفقات السؤال الأخير وخيارات النموذج والمصادر والأسلوب
  if (XO.att.length) contents[contents.length - 1].parts = XO.att.map(a => ({ inlineData: { mimeType: a.mime, data: a.data } })).concat(contents[contents.length - 1].parts);
  const label = (n, a) => n === "quran_ayah" ? "يراجع نص الآية في المصحف" : n === "find_ayah" ? "يحدد موضع الآية في المصحف" : n === "hadith_lookup" ? "يبحث عن الحديث في كتب السنة" : n === "word_meaning" ? "يراجع معنى «" + (a.word || "") + "» في المعاجم" : n === "person_bio" ? "يراجع ترجمة «" + (a.name || "") + "»" : n === "search_library" ? "يبحث في المكتبة عن: «" + (a.query || "") + "»" : n === "get_page" ? "يقرأ " + (a.ref || "") : n === "book_outline" ? "يطالع فهرس الكتاب" : "يراجع قائمة " + (n === "list_authors" ? "المؤلفين" : "الكتب");
  let acc = "";
  for (let round = 0; round < maxR; round++) {
    let r;
    try { r = await fetch(CFG.askEndpoint, { method: "POST", signal: o.signal, headers: Object.assign({ "content-type": "application/json" }, Auth.token ? { Authorization: "Bearer " + Auth.token } : {}), body: JSON.stringify(Object.assign({ v: 2, contents, mode: o.mode, col: o.col, bookId: o.bookId, round, last: round === maxR - 1 }, XO.body)) }); }
    catch (e) { if (e.name === "AbortError") { if (acc) throw { text: acc }; throw { code: "cancelled" }; } throw { code: "offline", message: "تعذر الوصول إلى خادم المساعد. تأكد من الاتصال بالإنترنت." }; }
    if (!r.ok || !/ndjson/.test(r.headers.get("content-type") || "")) { let j = {}; try { j = await r.json(); } catch (e) { }
      if (j.code === "no_key") throw { code: "nokey" };
      throw { code: "server", message: (j.error === "paused" && j.message) || j.error || j.message || "تعذرت الإجابة، حاول لاحقًا." }; }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "", calls = null, parts = null, err = null; acc = "";
    try { for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let nl;
      while ((nl = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue; let ev; try { ev = JSON.parse(line); } catch (e) { continue; }
        if (ev.t === "text") { acc += ev.v; o.onText(acc); } else if (ev.t === "replace") { acc = ev.v; o.onText(acc); } else if (ev.t === "calls") { calls = ev.calls; parts = ev.parts; } else if (ev.t === "status") o.onStatus(ev.v);
        else if (ev.t === "error") { err = ev; } } } }
    catch (e) { if (e.name === "AbortError") { if (acc) throw { text: acc }; throw { code: "cancelled" }; } if (acc) throw { text: acc }; throw { code: "offline", message: "انقطع الاتصال أثناء الإجابة." }; }
    if (err) { if (acc) throw { text: acc }; throw { code: err.code === "quota" ? "quota" : "fallback", reason: err.v + (err.detail ? " (" + err.detail + ")" : "") }; }
    if (!calls || !calls.length) { o.searches = used; return acc; }
    if (acc.trim()) o.onStatus(acc.trim().split("\n").pop().slice(0, 140));
    o.onText("");
    contents.push({ role: "model", parts });
    const resp = [];
    for (const c of calls) {
      o.onStatus(label(c.name, c.args || {}));
      let result; try { result = await SX.runTool(c.name, c.args || {}, scope); } catch (e) { result = { error: e.message }; }
      if (c.name === "search_library") used.push(String((c.args || {}).query || ""));
      let txt = JSON.stringify(result); if (txt.length > 24000) result = { truncated: txt.slice(0, 24000) };
      resp.push({ functionResponse: Object.assign({ name: c.name, response: { result } }, c.id ? { id: c.id } : {}) });
    }
    contents.push({ role: "user", parts: resp });
    o.onStatus("يحلل ما وجده (" + toAr(used.length) + " بحثًا حتى الآن)…");
  }
  o.searches = used; return acc || "تعذر إكمال الإجابة، جرّب سؤالًا أضيق.";
};
/* البحث المحلي الاحتياطي (عند نفاد حصة الذكاء الاصطناعي): من الفهرس بدل تحميل المكتبة كلها */
AI.ensure = async function (o) { const ids = new Set(); if (o.bookId) ids.add(o.bookId); const last = (o.turns || []).slice(-1)[0]; if (last) { const r = await SX.search(last.content, { col: o.col, bookId: o.bookId, k: 10 }).catch(() => null); if (r) r.forEach(h => ids.add(h.ref.split(":")[0])); else { const need = lib.books.filter(b => !b.demo && (!o.col || bc(b) === o.col) && (o.bookId ? b.id === o.bookId : !b.big)); return loadMany(need, (i, n) => o.onStatus(`يحمّل نصوص المكتبة للبحث (${toAr(i)} من ${toAr(n)})`)); } } await Promise.all([...ids].map(id => loadBook(id).catch(() => {}))); };

/* أدوات المساعد العلمي (ASKX): إرفاق الصور والملفات (PDF ونص وصوت)، والسؤال بالصوت، واختيار النموذج والأسلوب
   (نقل/تحليل/استنتاج، صياغة مولدة أو مركبة من النقول)، والمصادر الخارجية (مواقع أو روابط)، وقراءة الإجابة صوتيًّا وتصديرها،
   ولوحة «إعدادات المساعد» للمدير (data/ask-config.json): الخدمات المتاحة لكل فئة، والنماذج، والمواقع المأذونة، وحدود الاستخدام. */
const ASKX = (() => {
  let ATT = [], CFG_ = null; const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem("askx_" + k) || "null"); localStorage.setItem("askx_" + k, JSON.stringify(v)); } catch (e) { return null; } };
  const O = () => Object.assign({ engine: "auto", basis: "mix", form: "generated", sites: "", urls: "" }, ls("o") || {});
  const cfg = async () => { if (CFG_) return CFG_; for (const u of [RAWGH + "data/ask-config.json?t=" + Math.floor(Date.now() / 120e3), "data/ask-config.json"]) { try { const r = await fetch(u); if (r.ok) return (CFG_ = await r.json()); } catch (e) { } } return (CFG_ = { features: {} }); };
  const perms = () => (typeof Cloud !== "undefined" && Cloud.perms) || [];
  const may = (c, f, p) => { const v = (c.features || {})[f] || "perm"; if (v === "off") return false; if (isAdmin()) return true; if (v === "all") return !!Auth.user; if (v === "staff") return false; return perms().includes(p); };
  function take() { const o = O(), body = { engine: o.engine, style: { basis: o.basis, form: o.form } }; const sites = o.sites.split(/[\s,،]+/).filter(Boolean), urls = o.urls.split(/\s+/).filter(x => /^https?:/.test(x));
    if (sites.length || urls.length) body.web = { sites, urls }; const att = ATT; ATT = []; paint(); return { att, body }; }
  const paint = () => { const b = document.getElementById("axatt"); if (b) b.innerHTML = ATT.map((a, i) => `<span class="axchip">${/^image/.test(a.mime) ? `<img src="data:${a.mime};base64,${a.data}" alt="">` : "📄"} ${esc(a.name)} <button type="button" data-act="axrm" data-i="${i}" aria-label="إزالة">×</button></span>`).join(""); };
  const b64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(f); });
  async function shrink(f) { if (!/^image\/(png|jpeg|webp)/.test(f.type) || f.size < 1.2e6) return { mime: f.type, data: await b64(f) };
    const im = await createImageBitmap(f), k = Math.min(1, 1800 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return { mime: "image/jpeg", data: c.toDataURL("image/jpeg", .85).split(",")[1] }; }
  async function addFiles(files) {
    const ta = document.querySelector(".askbox [name=m]");
    for (const f of files) {
      if (/^audio\/|^video\/webm/.test(f.type)) { toast("🎙 يفرّغ «" + f.name + "»…"); try { const t = await VOICE.stt(f); if (ta) ta.value = (ta.value ? ta.value + "\n" : "") + t; toast("✓ فُرِّغ الملف الصوتي إلى نص السؤال"); } catch (e) { toast("تعذّر التفريغ: " + e.message); } continue; }
      if (/^text\/|\.(txt|md)$/i.test(f.type || f.name)) { const t = await f.text(); if (ta) ta.value += "\n\n«" + t.slice(0, 12000) + "»"; continue; }
      if (!/^image\/|application\/pdf/.test(f.type)) { toast("صيغة غير مدعومة: " + f.name); continue; }
      if (f.size > 6e6) { toast("الملف أكبر من ٦ ميجابايت: " + f.name); continue; }
      const x = await shrink(f); ATT.push({ name: f.name, mime: x.mime, data: x.data });
    } paint();
  }
  // شريط الأدوات تحت خانة السؤال
  async function arm(form) {
    if (form.dataset.ax) return; form.dataset.ax = 1; const c = await cfg(), o = O(), so = (v, l, s) => `<option value="${v}"${s === v ? " selected" : ""}>${l}</option>`;
    const vis = may(c, "vision", "ask_vision"), web = may(c, "web", "ask_web"), mdl = may(c, "models", "ask_models"), E = c.engines || {};
    form.insertAdjacentHTML("beforeend", `<div id="axatt" class="axatt"></div><div class="axbar">
      ${vis ? `<label class="btn s" title="إرفاق صورة أو ملف PDF أو نص أو صوت">📎 إرفاق<input type="file" id="axf" multiple accept="image/*,application/pdf,text/plain,.md,audio/*" hidden></label>` : `<label class="btn s" title="إرفاق ملف صوتي يُفرَّغ إلى نص">🎙 ملف صوتي<input type="file" id="axf" accept="audio/*" hidden></label>`}
      <details class="axopt"><summary class="btn s">⚙️ خيارات الإجابة</summary><div class="axpanel">
        ${mdl ? `<label>النموذج</label><select data-o="engine">${so("auto", "تلقائي (الأنسب للمهمة)", o.engine)}${E.claude !== false ? so("claude", "Claude — تحليل وتحرير عميق", o.engine) : ""}${E.gemini !== false ? so("gemini", "Gemini — سريع وطويل السياق", o.engine) : ""}${E.groq !== false ? so("groq", "نموذج مفتوح (Groq) — سريع", o.engine) : ""}</select>` : ""}
        <label>أساس الجواب</label><select data-o="basis">${so("mix", "متوازن", o.basis)}${so("naql", "النقل من الكتب", o.basis)}${so("tahlil", "التحليل", o.basis)}${so("istintaj", "الاستنتاج", o.basis)}</select>
        <label>الصياغة</label><select data-o="form">${so("generated", "مولّدة بأسلوب علمي", o.form)}${so("composed", "مركّبة من النقول منسّقة", o.form)}</select>
        ${web ? `<label>مصادر خارجية (أسماء مواقع)</label><input data-o="sites" dir="ltr" placeholder="dorar.net islamweb.net" value="${esc(o.sites)}"><label>أو روابط صفحات</label><textarea data-o="urls" rows="2" dir="ltr" placeholder="https://…">${esc(o.urls)}</textarea><small class="mut">المسموح: ${esc((c.webDomains || []).join("، "))}${c.webAnyDomain ? " وغيرها" : ""}</small>` : ""}
      </div></details>${isAdmin() || can("ask_cfg") ? `<button type="button" class="btn s" data-act="axcfg">🛠 إعدادات المساعد</button>` : ""}</div>`);
    form.addEventListener("change", e => { const x = e.target.closest("[data-o]"); if (x) { const n = O(); n[x.dataset.o] = x.value; ls("o", n); } if (e.target.id === "axf") { addFiles([...e.target.files]); e.target.value = ""; } });
    form.addEventListener("input", e => { const x = e.target.closest("[data-o]"); if (x) { const n = O(); n[x.dataset.o] = x.value; ls("o", n); } });
    const ta = form.querySelector("[name=m]"); if (ta && vis) { ta.addEventListener("paste", e => { const f = [...(e.clipboardData || {}).files || []]; if (f.length) { e.preventDefault(); addFiles(f); } });
      form.addEventListener("dragover", e => e.preventDefault()); form.addEventListener("drop", e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); }); }
  }
  // قراءة الإجابة وتصديرها
  function speak(t, btn) { if (!window.speechSynthesis) return toast("القراءة الصوتية غير مدعومة في هذا المتصفح");
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); btn.textContent = "🔊 استمع"; return; }
    const parts = plainT(t).match(/[^.!؟\n]{1,220}[.!؟\n]?/g) || []; const v = speechSynthesis.getVoices().find(x => /^ar/i.test(x.lang));
    parts.forEach((p, i) => { const u = new SpeechSynthesisUtterance(p); u.lang = "ar-SA"; if (v) u.voice = v; u.rate = .95; if (i === parts.length - 1) u.onend = () => btn.textContent = "🔊 استمع"; speechSynthesis.speak(u); }); btn.textContent = "⏹ إيقاف"; }
  const plainT = t => String(t).replace(/\[\[([^\]\s]+?):(\d+)\]\]/g, (x, id, p) => { const b = B(id); return b ? "(" + b.title + "، ص " + p + ")" : ""; }).replace(/[#*|`]/g, "").replace(/\n{3,}/g, "\n\n");
  function exportAns(t, kind) { const txt = plainT(t), name = "إجابة-المساعد-" + (MKT ? MKT.day() : "") ;
    if (kind === "md") return dl(name + ".md", t.replace(/\[\[([^\]\s]+?):(\d+)\]\]/g, (x, id, p) => { const b = B(id); return b ? `([${b.title}، ص ${p}](${location.origin}/#/book/${id}/${p}))` : ""; }), "text/markdown");
    const html = `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:'Traditional Arabic',Amiri,serif;font-size:16pt;line-height:1.8}</style></head><body>${md(t)}<p style="color:#888">— المساعد العلمي، ${esc(SITENAME)}</p></body></html>`;
    if (kind === "doc") return dl(name + ".doc", html, "application/msword");
    navigator.clipboard.writeText(txt).then(() => toast("نُسخ النص"));
  }
  // يُضاف إلى شريط كل إجابة: استمع، وتصدير Word وMarkdown
  new MutationObserver(() => { document.querySelectorAll(".msg.a .mact:not([data-ax])").forEach(bar => { bar.dataset.ax = 1; const m = bar.closest(".msg"), idx = [...document.querySelectorAll("#msgs .msg")].indexOf(m), msg = (typeof CONV !== "undefined" && CONV && CONV.messages[idx]) || null, t = msg ? msg.content : m.innerText;
      bar.insertAdjacentHTML("beforeend", `<button class="btn s" data-act="axsay">🔊 استمع</button><button class="btn s" data-act="axdoc">⬇ Word</button><button class="btn s" data-act="axmd">⬇ Markdown</button>`); bar._t = t; });
    document.querySelectorAll("form.askbox:not([data-ax])").forEach(arm); }).observe(document.documentElement, { childList: true, subtree: true });
  let MIC = null;
  document.addEventListener("click", async e => { const el = e.target.closest("[data-act^=ax]"); if (!el) return; const a = el.dataset.act;
    if (a === "axrm") { ATT.splice(+el.dataset.i, 1); paint(); }
    else if (a === "axsay") speak(el.parentElement._t, el); else if (a === "axdoc") exportAns(el.parentElement._t, "doc"); else if (a === "axmd") exportAns(el.parentElement._t, "md");
    else if (a === "axmic") { const ta = document.querySelector(".askbox [name=m]"); if (MIC) { MIC.stop(); return; } el.classList.add("on"); el.innerHTML = `<span class="vmic on">${VOICE.MIC}</span> أنهِ التسجيل`;
      MIC = VOICE.dictate(ta, { append: true, onError: m => toast("🎤 " + m), onEnd: () => { MIC = null; el.classList.remove("on"); el.innerHTML = `<span class="vmic">${VOICE.MIC}</span> اسأل بصوتك`; } }); }
    else if (a === "axcfg") panel(); });
  // لوحة إعدادات المساعد (للمدير)
  async function panel() { const c = JSON.parse(JSON.stringify(await cfg())), F = c.features || {}, L = c.limits || {}, E = c.engines || {};
    const FN = [["vision", "رفع الصور والملفات وتحليلها"], ["stt", "البحث والسؤال بالصوت (تفريغ الصوت)"], ["tts", "قراءة الإجابات صوتيًّا"], ["web", "المصادر الخارجية (مواقع وروابط)"], ["models", "اختيار النموذج"], ["export", "التصدير (Word وMarkdown)"]];
    const sel = (k, v) => `<select data-f="${k}">${[["all", "لكل الأعضاء"], ["perm", "لمن أفوّضه"], ["staff", "للإدارة فقط"], ["off", "موقوفة"]].map(([x, l]) => `<option value="${x}"${v === x ? " selected" : ""}>${l}</option>`).join("")}</select>`;
    openSheet("إعدادات المساعد العلمي والتقني", `<p class="mut">تُحفظ في data/ask-config.json وتسري خلال دقيقتين. التفويض للأعضاء من <a href="#/perms">صلاحيات التفويض</a> (ask_vision وask_web وask_models).</p>
      <h4>الخدمات والخصائص</h4>${FN.map(([k, n]) => `<div class="row"><span style="flex:1">${n}</span>${sel(k, F[k] || "perm")}</div>`).join("")}
      <h4>النماذج المتاحة</h4>${["claude", "gemini", "groq"].map(k => `<label class="chk"><input type="checkbox" data-e="${k}"${E[k] !== false ? " checked" : ""}> ${k}</label>`).join(" ")}
      <label>النموذج الافتراضي</label><select id="axde">${["auto", "claude", "gemini", "groq"].map(k => `<option${c.defaultEngine === k ? " selected" : ""}>${k}</option>`).join("")}</select>
      <h4>المصادر الخارجية المأذونة</h4><textarea id="axwd" rows="3" dir="ltr">${esc((c.webDomains || []).join("\n"))}</textarea><label class="chk"><input type="checkbox" id="axany"${c.webAnyDomain ? " checked" : ""}> السماح بأي موقع يختاره العضو</label>
      <h4>حدود الأسئلة في الساعة</h4><div class="row">${[["member", "العضو"], ["perm", "المفوَّض"], ["staff", "الإدارة"]].map(([k, n]) => `<label>${n} <input type="number" min="1" data-l="${k}" value="${L[k] || 20}" style="width:80px"></label>`).join("")}</div>
      <h4>توجيهات الإدارة للمساعد (تُضاف إلى تعليماته)</h4><textarea id="axex" rows="4">${esc(c.extra || "")}</textarea>
      <p><button class="btn p" id="axsave">حفظ الإعدادات</button> <span id="axst" class="mut"></span></p>`, () => {
      document.getElementById("axsave").onclick = async () => { const P = document.getElementById("sheetB") || document;
        P.querySelectorAll("[data-f]").forEach(x => F[x.dataset.f] = x.value); P.querySelectorAll("[data-e]").forEach(x => E[x.dataset.e] = x.checked); P.querySelectorAll("[data-l]").forEach(x => L[x.dataset.l] = +x.value || 20);
        Object.assign(c, { features: F, engines: E, limits: L, defaultEngine: document.getElementById("axde").value, webDomains: document.getElementById("axwd").value.split(/\s+/).filter(Boolean), webAnyDomain: document.getElementById("axany").checked, extra: document.getElementById("axex").value.trim() });
        const st = document.getElementById("axst"); st.textContent = "جارٍ الحفظ…"; try { await GH.editJSON("data/ask-config.json", () => c, "المساعد العلمي: تحديث الإعدادات"); CFG_ = c; st.textContent = "✓ حُفظ"; } catch (e) { st.textContent = "تعذّر: " + (e.message || e); } }; }); }
  return { take, addFiles, cfg };
})();
