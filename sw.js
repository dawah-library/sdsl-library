const V="sdsl-v24",CORE=["./","index.html","style.css","config.js","search.js","app.js","manifest.webmanifest","assets/logo.jpg","assets/cal.jpg","assets/logo-sdsl.png","assets/logo-sdsl-128.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=="sdsl-data").map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);
 if(u.origin===location.origin){
  if(u.pathname.includes("/api/"))return;
  const isData=u.pathname.includes("/data/books/")||u.pathname.includes("/vols/")||u.pathname.includes("/data/dict/");
  const store=isData?"sdsl-data":V;
  // نصوص الكتب: من التخزين أولًا مع تحديث في الخلفية؛ الباقي: من الشبكة أولًا
  if(isData){e.respondWith(caches.open(store).then(c=>c.match(r).then(m=>{const net=fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}).catch(()=>m);return m||net})));return}
  e.respondWith(fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(store).then(c=>c.put(r,y))}return x}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))));return}
 if(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(u.hostname))e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const y=x.clone();caches.open(V).then(c=>c.put(r,y));return x})))});
