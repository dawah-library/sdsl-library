const V="sdsl-v70",CORE=["./","index.html","style.css","config.js","i18n.js","data/i18n-en.json","search.js","app.js","social.js","community.js","audio.js","words.js","qa.js","tashjir.js","export.js","hifz.js","dm.js","paths.js","dawah.js","about.js","vendor/supabase.js","manifest.webmanifest","assets/logo.jpg","assets/cal.jpg","assets/logo-sdsl.png","assets/logo-sdsl-128.png","assets/favicon-64.png"];
// خفض طلبات Vercel (حصة المليون طلب في الباقة المجانية):
// - ملفات الواجهة (CORE وassets وvendor) تُقدَّم من الجهاز، وتتجدد فقط حين يتغير رقم الإصدار V.
//   (يرفعه آليًا سير العمل sw-version.yml عند تغير أي ملف واجهة، فلا تبقى نسخة قديمة.)
//   التثبيت يأخذ الملفات من ذاكرة المتصفح إن حُمِّلت قبل أقل من دقيقة (max-age=60 في vercel.json)، فلا تتكرر طلبات الزيارة الأولى.
// - البيانات ذات ?v= (نصوص الكتب والمجلدات) ثابتة لكل قيمة v، فتُقدَّم من الجهاز بلا طلب.
// - بقية البيانات (data/*.json) من الجهاز إن لم يمضِ عليها TTL، وإلا من الشبكة.
// - إضافة ?fresh=1 إلى رابط البيانات تتجاوز التخزين (للإدارة بعد الحفظ).
const DATA="sdsl-data",TTL_DEF=15*60e3,TTL={"/data/posts.json":5*60e3,"/data/fawaid.json":10*60e3};
const isCore=p=>p==="/"||p==="/index.html"||/^\/(assets|vendor)\//.test(p)||/^\/[a-z0-9-]+\.(js|css|webmanifest)$/.test(p)&&p!=="/sw.js";
const stamp=async(x)=>{const h=new Headers(x.headers);h.set("x-sw-at",String(Date.now()));return new Response(await x.blob(),{status:x.status,statusText:x.statusText,headers:h})};
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>fetch(u).then(x=>x.ok&&c.put(u,x)).catch(()=>{})))));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==DATA).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);
 if(u.origin===location.origin){const p=u.pathname;
  if(p.startsWith("/api/")||p==="/sw.js")return;
  // التنقل: الشبكة أولًا (لتصل نسخة index.html الجديدة) مع الرجوع إلى المحفوظ دون اتصال
  if(r.mode==="navigate"){e.respondWith(fetch(r).then(x=>{if(x.ok&&(p==="/"||p==="/index.html")){const y=x.clone();caches.open(V).then(c=>c.put("index.html",y))}return x}).catch(()=>caches.match("index.html",{ignoreSearch:true})));return}
  if(isCore(p)){e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}))));return}
  const isData=p.startsWith("/data/")||p.startsWith("/vols/");
  if(!isData)return;
  const pinned=u.searchParams.has("v")&&!u.searchParams.has("fresh");
  e.respondWith(caches.open(DATA).then(async c=>{
   const fresh=u.searchParams.has("fresh"),m=fresh?null:await c.match(r);
   if(m){const at=+m.headers.get("x-sw-at")||0;if(pinned||Date.now()-at<(TTL[p]||TTL_DEF))return m}
   try{const x=await fetch(r,r.cache==="no-cache"&&!m?{cache:"default"}:undefined);if(x.ok){const s=await stamp(x);c.put(r,s.clone());return s}return m||x}
   catch(err){if(m)return m;throw err}}));return}
 if(u.hostname==="raw.githubusercontent.com"&&u.pathname.includes("/vols/")){e.respondWith(caches.open(DATA).then(c=>c.match(r).then(m=>m||fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}))));return}
 if(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.hostname))e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const y=x.clone();caches.open(V).then(c=>c.put(r,y));return x})))});
// إشعارات الجهاز: تذكير الورد وإشعارات المكتبة
self.addEventListener("push",e=>{let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:"مكتبة الدعوة السلفية الرقمية",body:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.title||"مكتبة الدعوة السلفية الرقمية",{body:d.body||"",icon:"assets/logo-sdsl-128.png",badge:"assets/logo-sdsl-128.png",dir:"rtl",lang:"ar",tag:d.tag||undefined,data:{url:d.url||"/"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=new URL(String((e.notification.data||{}).url||"/").replace(/^#/,""),self.location.origin).href;
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{const w=l.find(c=>c.url.startsWith(self.location.origin));if(w){w.navigate(u).catch(()=>{});return w.focus()}return clients.openWindow(u)}))});
