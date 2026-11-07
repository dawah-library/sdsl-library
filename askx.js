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
  const label = (n, a) => n === "quran_ayah" ? "يراجع نص الآية في المصحف" : n === "find_ayah" ? "يحدد موضع الآية في المصحف" : n === "hadith_lookup" ? "يبحث عن الحديث في كتب السنة" : n === "word_meaning" ? "يراجع معنى «" + (a.word || "") + "» في المعاجم" : n === "person_bio" ? "يراجع ترجمة «" + (a.name || "") + "»" : n === "search_library" ? "يبحث في المكتبة عن: «" + (a.query || "") + "»" : n === "get_page" ? "يقرأ " + (a.ref || "") : n === "book_outline" ? "يطالع فهرس الكتاب" : "يراجع قائمة " + (n === "list_authors" ? "المؤلفين" : "الكتب");
  let acc = "";
  for (let round = 0; round < maxR; round++) {
    let r;
    try { r = await fetch(CFG.askEndpoint, { method: "POST", signal: o.signal, headers: Object.assign({ "content-type": "application/json" }, Auth.token ? { Authorization: "Bearer " + Auth.token } : {}), body: JSON.stringify({ v: 2, contents, mode: o.mode, col: o.col, bookId: o.bookId, round, last: round === maxR - 1 }) }); }
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
