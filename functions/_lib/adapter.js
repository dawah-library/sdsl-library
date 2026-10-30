// مهايئ يشغّل دوال api/*.js (المكتوبة بصيغة Vercel/Node: req, res) داخل Cloudflare Pages Functions
// دون تكرار منطقها. يوفّر: req.query/body/headers/url وقابلية القراءة المتدفقة، وres.status/json/send/end/write،
// ومتغيرات البيئة في process.env، وقراءة ملفات البيانات من الملفات الثابتة نفسها عبر ذاكرة (lib/fs.js).
import { Buffer } from "node:buffer";
globalThis.Buffer = globalThis.Buffer || Buffer;

function envInto(env) {
  globalThis.process = globalThis.process || { env: {} };
  process.env = process.env || {};
  for (const k in env) if (typeof env[k] === "string") process.env[k] = env[k];
}

async function parseBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return { raw: Buffer.alloc(0), body: undefined };
  const raw = Buffer.from(await request.arrayBuffer());
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  let body;
  if (!raw.length) body = undefined;
  else if (ct.includes("application/json")) { const t = raw.toString("utf8"); try { body = JSON.parse(t); } catch (e) { body = t; } }
  else if (ct.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
  else if (ct.startsWith("text/")) body = raw.toString("utf8");
  else body = raw;
  return { raw, body };
}

function makeReq(request, urlStr, parsed, ip) {
  const u = new URL(urlStr, request.url), headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  headers["x-forwarded-for"] = headers["x-forwarded-for"] || ip || "";
  headers["x-real-ip"] = headers["x-real-ip"] || ip || "";
  headers["x-forwarded-host"] = headers["x-forwarded-host"] || new URL(request.url).host;
  headers["x-forwarded-proto"] = "https";
  const query = {};
  for (const [k, v] of u.searchParams) query[k] = k in query ? [].concat(query[k], v) : v;
  return {
    method: request.method, url: u.pathname + u.search, headers, query, body: parsed.body,
    socket: { remoteAddress: ip }, connection: { remoteAddress: ip },
    async *[Symbol.asyncIterator]() { if (parsed.raw.length) yield parsed.raw; },
    on() { return this; }
  };
}

function makeRes() {
  const enc = new TextEncoder();
  let resolve; const ready = new Promise(r => { resolve = r; });
  const st = { code: 200, headers: new Headers(), chunks: [], stream: null, writer: null, done: false };
  const toBytes = x => x == null ? new Uint8Array(0) : typeof x === "string" ? enc.encode(x) : x instanceof Uint8Array ? x : enc.encode(String(x));
  const res = {
    get statusCode() { return st.code; }, set statusCode(c) { st.code = c; },
    get headersSent() { return !!st.stream || st.done; },
    setHeader(k, v) { st.headers.set(k, Array.isArray(v) ? v.join(", ") : String(v)); return res; },
    getHeader(k) { return st.headers.get(k); }, removeHeader(k) { st.headers.delete(k); },
    status(c) { st.code = c; return res; },
    writeHead(c, h) { st.code = c; if (h) for (const k in h) res.setHeader(k, h[k]); return res; },
    json(o) { if (!st.headers.has("content-type")) res.setHeader("content-type", "application/json; charset=utf-8"); return res.end(JSON.stringify(o)); },
    send(x) {
      if (x && typeof x === "object" && !(x instanceof Uint8Array)) return res.json(x);
      if (typeof x === "string" && !st.headers.has("content-type")) res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(x);
    },
    redirect(a, b) { const [c, l] = typeof a === "number" ? [a, b] : [307, a]; st.code = c; res.setHeader("location", l); return res.end(); },
    write(x) {
      if (!st.stream) { const ts = new TransformStream(); st.stream = ts; st.writer = ts.writable.getWriter(); resolve(new Response(ts.readable, { status: st.code, headers: st.headers })); }
      st.writer.write(toBytes(x)); return true;
    },
    end(x) {
      if (st.done) return res; st.done = true;
      if (st.stream) { if (x != null) st.writer.write(toBytes(x)); st.writer.close(); return res; }
      if (x != null) st.chunks.push(toBytes(x));
      const n = st.chunks.reduce((a, c) => a + c.length, 0), all = new Uint8Array(n); let o = 0;
      for (const c of st.chunks) { all.set(c, o); o += c.length; }
      const nobody = st.code === 204 || st.code === 304;
      resolve(new Response(nobody ? null : all, { status: st.code, headers: st.headers }));
      return res;
    },
    _st: st, _ready: ready
  };
  return res;
}

// ملفات البيانات تُقرأ من الأصول الثابتة (env.ASSETS) وتُحفظ في ذاكرة النسخة الدافئة
const VFS = globalThis.__VFS = globalThis.__VFS || new Map();
async function load(ctx, keys) {
  await Promise.all([...keys].filter(k => !VFS.has(k)).map(async k => {
    const r = await ctx.env.ASSETS.fetch(new URL(k === "index.html" ? "/" : "/" + k, ctx.request.url));
    if (r.ok) VFS.set(k, await r.text());
  }));
}

// يشغّل المعالج؛ إن طلب ملف بيانات غير محمَّل يُجلب الملف ويُعاد التشغيل (حتى ٣ مرات، للمعالجات غير المتدفقة)
export async function run(handler, ctx, { url, preload = [], retry = false } = {}) {
  envInto(ctx.env);
  const ip = ctx.request.headers.get("cf-connecting-ip") || "";
  const parsed = await parseBody(ctx.request);
  if (preload.length) await load(ctx, preload);
  for (let pass = 0; ; pass++) {
    const miss = globalThis.__VFS_MISS = new Set();
    const req = makeReq(ctx.request, url || ctx.request.url, parsed, ip), res = makeRes();
    const p = Promise.resolve().then(() => handler(req, res)).catch(e => {
      console.error(e && e.stack || e);
      if (!res._st.done) { if (res.headersSent) res.end(); else res.status(500).json({ message: "خطأ في الخادم." }); }
    }).then(() => { if (!res._st.done) res.end(); });
    if (!retry) { ctx.waitUntil(p); return res._ready; }
    await p;
    const fresh = [...miss].filter(k => !VFS.has(k));
    if (!fresh.length || pass >= 2 || res._st.stream) return res._ready;
    await load(ctx, fresh);
    if (![...fresh].some(k => VFS.has(k))) return res._ready; // ملفات غير موجودة فعلًا: النتيجة الحالية صحيحة
  }
}
