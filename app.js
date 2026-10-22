"use strict";
/* =========================================================
   مكتبة الدعوة السلفية الرقمية — الواجهة
   ========================================================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const SS=window.SDSLSearch,strip=SS.strip,norm=SS.norm,plain=SS.plain;
const ls={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const DB={open(){return new Promise((res,rej)=>{const r=indexedDB.open("sdsl",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async get(k){try{const d=await this.open();return await new Promise(r=>{const q=d.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(undefined)})}catch(e){return ls.get("db_"+k)}},
 async set(k,v){try{const d=await this.open();await new Promise((r,j)=>{const t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=r;t.onerror=j})}catch(e){ls.set("db_"+k,v)}}};
const CFG=Object.assign({supabaseUrl:"",supabaseAnonKey:"",askEndpoint:"api/ask",importEndpoint:"api/import",siteUrl:""},window.SDSL_CONFIG||{});
const SITENAME="المكتبة الرقمية للدعوة السلفية بمصر";
const siteLink=(h)=>CFG.siteUrl?CFG.siteUrl.replace(/\/?$/,"/")+(h||""):"";
const S=Object.assign({theme:"auto",font:"Amiri",size:1.3,lh:2.1,tash:true,pg:"paper",admin:false,favs:[],seen:0,look:false},ls.get("set",{}));
const saveS=()=>ls.set("set",S);
const toAr=n=>String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[d]);
const fmtDate=d=>{if(!d)return"";const x=new Date(d);return isNaN(x)?esc(d):x.toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"})};
const today=()=>new Date().toISOString().slice(0,10);

/* ---------- الخطوط وألوان الصفحة ---------- */
const FONTS=[["خطوط تراثية",["Amiri","Noto Naskh Arabic","Scheherazade New","Markazi Text","Lateef"]],["خطوط حديثة",["Cairo","Tajawal","Almarai","IBM Plex Sans Arabic","Noto Kufi Arabic","Readex Pro","El Messiri","Changa","Reem Kufi","Harmattan"]]];
const FONT_AR={"Amiri":"أميري","Noto Naskh Arabic":"نوتو نسخ","Scheherazade New":"شهرزاد","Markazi Text":"المركزي","Lateef":"لطيف","Cairo":"القاهرة","Tajawal":"تجوال","Almarai":"المراعي","IBM Plex Sans Arabic":"بلكس","Noto Kufi Arabic":"نوتو كوفي","Readex Pro":"ريدكس","El Messiri":"المسيري","Changa":"تشانغا","Reem Kufi":"ريم كوفي","Harmattan":"هرمتان"};
const fontOpts=cur=>FONTS.map(([g,fs])=>`<optgroup label="${g}">${fs.map(f=>`<option value="${f}"${f===cur?" selected":""} style="font-family:'${f}'">${FONT_AR[f]||f}</option>`).join("")}</optgroup>`).join("");
const loadedFonts=new Set(["Amiri","Amiri Quran","IBM Plex Sans Arabic"]);
function loadFont(f){if(loadedFonts.has(f))return Promise.resolve();loadedFonts.add(f);
 return new Promise(ok=>{const l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+f.replace(/ /g,"+")+":wght@400;700&display=swap";
  l.onload=ok;l.onerror=()=>{l.href="https://fonts.googleapis.com/css2?family="+f.replace(/ /g,"+")+"&display=swap";l.onerror=ok};document.head.appendChild(l)})}
const PAGES=[["paper","ورقي","#fbf7ee","#2a241a"],["white","أبيض","#ffffff","#1a1a1a"],["ivory","عاجي","#f7f0dc","#2b2416"],["sand","رملي","#efe2c4","#3a2e18"],["sepia","سيبيا","#f1e4cc","#5b4636"],["mint","نعناعي","#e8f2ec","#1c2a22"],["sky","سماوي","#e8f0f6","#1b2633"],["gray","رمادي","#ececec","#222222"],["night","ليلي","#18231f","#d8e3dd"],["black","أسود","#000000","#cfcfcf"]];
function applyLook(){const r=document.documentElement;if(S.theme==="auto")r.removeAttribute("data-theme");else r.dataset.theme=S.theme;
 const pg=PAGES.find(p=>p[0]===S.pg)||PAGES[0];loadFont(S.font);
 r.style.setProperty("--rf",`"${S.font}",serif`);r.style.setProperty("--rs",S.size+"rem");r.style.setProperty("--rl",S.lh);
 r.style.setProperty("--pg",pg[2]);r.style.setProperty("--pgink",pg[3]);r.style.setProperty("--pgline",["night","black"].includes(pg[0])?"rgba(255,255,255,.14)":"rgba(0,0,0,.12)")}

/* ---------- البيانات ---------- */
let CAT={version:0,authors:[],topics:[],books:[]},LOCAL={catalog:{authors:[],topics:[],books:[]},shards:{},deleted:[]};
let lib={authors:[],topics:[],books:[]};
const SH=new Map(),GROUPS=new Map();let ARTS_IDX=[];
const artFromIdx=x=>({id:x.id,title:x.t,authorId:x.a,topicId:x.tp,date:x.d,url:x.u,f:x.f,n:x.n,added:x.ad,c:x.c,fa:x.fa,type:"article",col:"dawah"});
const isFatwa=b=>!!(b.fa||/^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c||""));
const byId=(a,b)=>{const m=new Map();a.forEach(x=>m.set(x.id,x));b.forEach(x=>m.set(x.id,Object.assign({},m.get(x.id)||{},x)));return[...m.values()]};
function attach(b,sh){b.pages=sh.pages;b.toc=sh.toc||[];if(sh.pl)b.pl=sh.pl;else delete b.pl;b.n=sh.pages.length}
function merge(){const del=new Set(LOCAL.deleted||[]);
 lib={authors:byId(CAT.authors,LOCAL.catalog.authors),topics:byId(CAT.topics,LOCAL.catalog.topics),
  books:byId(CAT.books.concat(ARTS_IDX),LOCAL.catalog.books).filter(b=>!del.has(b.id)).map(m=>{const b=Object.assign({},m);const sh=LOCAL.shards[b.id]||SH.get(b.id);if(sh)attach(b,sh);return b})}}
const A=id=>lib.authors.find(a=>a.id===id)||{name:"—"},T=id=>lib.topics.find(t=>t.id===id)||{name:"—"},B=id=>lib.books.find(b=>b.id===id);
const bc=b=>b.col||"dawah",isArt=b=>b.type==="article",BOOKS=()=>lib.books.filter(b=>!isArt(b)),ARTS=()=>lib.books.filter(isArt);
const COL={dawah:"مكتبة الدعوة السلفية",turath:"تراث"};
const died=a=>a&&a.died?` (ت ${a.died}هـ)`:"";
const PL=(b,i)=>SS.label(b,i);
async function loadBook(id){const b=B(id);if(!b)throw new Error("غير موجود");if(b.pages)return b;
 let sh=LOCAL.shards[id]||SH.get(id)||(window.__SHARDS__&&window.__SHARDS__[id]);
 if(!sh&&b.f){let g=GROUPS.get(b.f);if(!g){g=(window.__GROUPS__&&window.__GROUPS__[b.f])||fetch("data/articles/"+encodeURIComponent(b.f)+".json").then(r=>{if(!r.ok)throw new Error("تعذر تحميل المقال");return r.json()});GROUPS.set(b.f,g)}
  const gg=await g;if(!gg[id])throw new Error("المقال غير موجود في ملفه");sh={id,pages:gg[id].pages,toc:[]}}
 if(!sh){const r=await fetch("data/books/"+encodeURIComponent(id)+".json");if(!r.ok)throw new Error("تعذر تحميل النص");sh=await r.json()}
 SH.set(id,sh);attach(b,sh);return b}
async function loadMany(list,onP){const q=list.filter(b=>!b.pages),n=q.length;let i=0;if(!n)return;
 const w=async()=>{while(q.length){const b=q.shift();try{await loadBook(b.id)}catch(e){}onP&&onP(++i,n)}};await Promise.all([w(),w(),w()])}

/* ---------- عرض عام ---------- */
const view=(h,keep)=>{$("#app").innerHTML=h;if(!keep)window.scrollTo(0,0)};
const bookCard=b=>`<a class="bk${bc(b)==="turath"?" tr":""}" href="#/book/${b.id}/1"><b>${esc(b.title)}</b><span><span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${died(A(b.authorId))} • ${esc(T(b.topicId).name)}${b.n?` • ${b.n} صفحة`:""}${bc(b)==="turath"?' • <em class="tag">تراث</em>':""}${b.demo?' • <em class="tag">نص تجريبي</em>':""}</span></a>`;
const artCard=b=>`<a class="bk ar" href="#/book/${b.id}/1"><b>${esc(b.title)}</b><span><span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${isFatwa(b)?' • <em class="tag">من فتاوى صوت السلف</em>':""} • ${fmtDate(b.date)} • ${esc(T(b.topicId).name)}${b.demo?' • <em class="tag">نص تجريبي</em>':""}</span></a>`;
const anyCard=b=>isArt(b)?artCard(b):bookCard(b);
const progress=(el,i,n,label)=>{el.innerHTML=`<p class="mut">${label} (${toAr(i)} من ${toAr(n)})</p><div class="prog"><i style="width:${Math.round(i/n*100)}%"></i></div>`};

/* ---------- المقتطفات المقترحة ---------- */
function sentences(b,i){return plain(b.pages[i]).split("\n").flatMap(par=>par.split(/(?<=[.؟!])\s+/)).map(s=>s.trim()).filter(s=>{const n=strip(s).length;return n>=50&&n<=230&&!/^\d|^[(«"]?\s*\d|حدثنا|أخبرنا/.test(s)})}
async function suggest(n,seed,filter){
 let pool=lib.books.filter(b=>!b.demo&&(!filter||filter(b))&&(b.pages||(b.size||0)<1500000));
 if(!pool.length)pool=lib.books.filter(b=>!filter||filter(b));
 let x=(seed||Date.now())%233280;const rnd=()=>{x=(x*9301+49297)%233280;return x/233280};
 const picks=[...pool].sort(()=>rnd()-.5).slice(0,Math.min(pool.length,n+2));
 await loadMany(picks);const out=[];
 for(let k=0;k<n*12&&out.length<n;k++){const b=picks[Math.floor(rnd()*picks.length)];if(!b||!b.pages)continue;const i=Math.floor(rnd()*b.pages.length),ss=sentences(b,i);if(!ss.length)continue;
  const t=ss[Math.floor(rnd()*ss.length)];if(!out.some(o=>o.t===t))out.push({t,b,i})}
 return out}
let SUG=[];
const qCard=(q,i)=>`<div class="q"><p>${esc(q.t)}</p><span class="mut">${esc(A(q.b.authorId).name)} — ${esc(q.b.title)}${PL(q.b,q.i)?"، "+esc(PL(q.b,q.i)):""}</span><div class="row" style="margin-top:6px"><button class="btn s nf" data-act="mkq" data-i="${i}">صمّم قبسة</button><a class="btn s nf" href="#/book/${q.b.id}/${q.i+1}">افتح الصفحة</a></div></div>`;

/* ---------- الرئيسية ---------- */
function vHome(){const arts=ARTS().sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 view(`<section class="hero"><img class="emb" src="assets/emblem.svg" alt=""><h1>مكتبة الدعوة السلفية الرقمية</h1>
 <p class="ayah" lang="ar">قُلْ هَٰذِهِۦ سَبِيلِىٓ أَدْعُوٓا۟ إِلَى ٱللَّهِ ۚ عَلَىٰ بَصِيرَةٍ أَنَا۠ وَمَنِ ٱتَّبَعَنِى ۖ وَسُبْحَـٰنَ ٱللَّهِ وَمَآ أَنَا۠ مِنَ ٱلْمُشْرِكِينَ ﴿١٠٨﴾</p>
 <form class="sbox" data-form="quick"><input name="q" type="search" placeholder="ابحث في الكتب والمقالات والمؤلفين" aria-label="بحث"><button class="btn p">بحث</button></form></section>
 <div class="cols"><a class="col" href="#/library?c=dawah"><b>مكتبة الدعوة السلفية</b><span>كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور</span><em>${BOOKS().filter(b=>bc(b)==="dawah").length} كتاب</em></a>
 <a class="col ar" href="#/articles"><b>المقالات</b><span>مقالات صوت السلف وبيانات الدعوة، مقسمة بالموضوع والكاتب</span><em>${ARTS().length} مقال</em></a>
 <a class="col tr" href="#/library?c=turath"><b>تراث</b><span>المكتبة الإسلامية العامة: كتب الإسلام الكبرى والمراجع المعتمدة</span><em>${BOOKS().filter(b=>bc(b)==="turath").length} كتاب</em></a></div>
 <a class="askcta" href="#/ask"><b>اسأل المكتبة</b><span>مساعد بحثي بالذكاء الاصطناعي يجيب من نصوص المكتبة مع الإحالة إلى الكتاب والصفحة. للأعضاء المسجلين.</span></a>
 <div class="grid"><a class="card" href="#/tarajim"><b>تراجم مشايخ الدعوة</b><span>${Object.keys(TJ.items).length} ترجمة</span></a><a class="card" href="#/authors"><b>المؤلفون</b><span>${lib.authors.length} مؤلفًا ومصدرًا</span></a><a class="card" href="#/qabasat"><b>قبسات</b><span>صمّم اقتباسًا وانشره</span></a><a class="card" href="#/search"><b>بحث متقدم</b><span>في العناوين والنصوص</span></a><a class="card" href="#/favs"><b>المفضلة</b><span>${S.favs.length} عنصر</span></a></div>
 <h2>مختارات اليوم</h2><div id="sugg"><p class="mut">جارٍ اختيار مقتطفات…</p></div>
 ${arts.length?`<h2>أحدث المقالات</h2>${arts.slice(0,5).map(artCard).join("")}<p><a href="#/articles">كل المقالات</a></p>`:""}
 <h2>أقسام المكتبة</h2><div class="chips">${lib.topics.filter(t=>t.for!=="articles"&&BOOKS().some(b=>b.topicId===t.id)).map(t=>`<a class="chip" href="#/library?t=${t.id}">${esc(t.name)}</a>`).join("")}</div>
 <p class="note">نصوص «مكتبة الدعوة» المعلّمة «نص تجريبي» تُستبدل بالمواد المعتمدة من الجمعية. كتب «تراث» وكتابا الشيخين المقدم وأحمد فريد نصوص حقيقية من المكتبة الشاملة عبر مشروع OpenITI.</p>`);
 const seed=+today().replace(/-/g,"");suggest(3,seed,b=>(b.size||0)<1200000).then(s=>{SUG=s;const el=$("#sugg");if(el)el.innerHTML=s.map(qCard).join("")||'<p class="mut">لا توجد مقتطفات.</p>'})}

/* ---------- المكتبة (الكتب) ---------- */
function sideList(title,arr,key,cur,url,count,wide){return`<details${wide?" open":""}><summary>${title}</summary><div class="sidebox"><a class="fl${!cur?" on":""}" href="${url({[key]:"",pg:1})}">الكل <span>${count("")}</span></a>${arr.filter(x=>count(x.id)||x.id===cur).map(x=>`<a class="fl${x.id===cur?" on":""}" href="${url({[key]:x.id,pg:1})}">${esc(x.name)}${key==="a"?died(x):""} <span>${count(x.id)}</span></a>`).join("")}</div></details>`}
function vLibrary(q){
 const f={c:q.c||"",t:q.t||"",a:q.a||"",q:q.q||"",s:q.s||"new",pg:+q.pg||1},PER=20,wide=matchMedia("(min-width:760px)").matches;
 const inC=BOOKS().filter(b=>!f.c||bc(b)===f.c);
 let r=inC.filter(b=>(!f.t||b.topicId===f.t)&&(!f.a||b.authorId===f.a));
 if(f.q.trim()){const w=norm(f.q).split(/\s+/).filter(Boolean);r=r.filter(b=>w.every(k=>norm(b.title+" "+A(b.authorId).name).includes(k)))}
 r=f.s==="title"?[...r].sort((x,y)=>x.title.localeCompare(y.title,"ar")):f.s==="died"?[...r].sort((x,y)=>(A(x.authorId).died||9999)-(A(y.authorId).died||9999)):[...r].sort((x,y)=>(y.added||"").localeCompare(x.added||""));
 const np=Math.max(1,Math.ceil(r.length/PER));f.pg=Math.max(1,Math.min(f.pg,np));
 const url=o=>{const n=Object.assign({},f,o),p=new URLSearchParams();["c","t","a","q","s"].forEach(k=>{if(n[k]&&!(k==="s"&&n[k]==="new"))p.set(k,n[k])});if(n.pg>1)p.set("pg",n.pg);return"#/library"+(p.toString()?"?"+p:"")};
 const cnt=key=>id=>inC.filter(b=>!id||b[key==="t"?"topicId":"authorId"]===id).length;
 const title=f.t?T(f.t).name:f.c?COL[f.c]:"المكتبة",bio=f.c==="turath"?"المكتبة الإسلامية العامة: كتب الإسلام الكبرى والمراجع العلمية المعتمدة بين أهل العلم، ليستفيد منها الباحث مع تراث مشايخ الدعوة السلفية.":f.c==="dawah"?"كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور.":"";
 const tabs=`<div class="tabs" role="tablist">${[["","كل الكتب"],["dawah",COL.dawah],["turath",COL.turath]].map(([v,l])=>`<a role="tab" aria-selected="${f.c===v}" href="${url({c:v,a:"",t:"",pg:1})}">${l}</a>`).join("")}<a role="tab" aria-selected="false" href="#/articles">المقالات</a></div>`;
 const chips=[f.t&&`<a class="chip x" href="${url({t:"",pg:1})}">${esc(T(f.t).name)} ✕</a>`,f.a&&`<a class="chip x" href="${url({a:"",pg:1})}">${esc(A(f.a).name)} ✕</a>`,f.q&&`<a class="chip x" href="${url({q:"",pg:1})}">«${esc(f.q)}» ✕</a>`].filter(Boolean).join(" ");
 const sorts=[["new","الأحدث"],["title","العنوان"],["died","وفاة المؤلف"]].map(([v,l])=>`<a href="${url({s:v,pg:1})}"${f.s===v?' style="font-weight:700"':""}>${l}</a>`).join(" • ");
 view(`${tabs}<h2>${esc(title)} <span class="mut">(${r.length})</span></h2>${bio?`<p class="mut">${esc(bio)}</p>`:""}<div class="lib"><aside class="side">${sideList("الأقسام",lib.topics.filter(t=>t.for!=="articles"),"t",f.t,url,cnt("t"),wide)}${sideList("المؤلفون",lib.authors,"a",f.a,url,cnt("a"),wide)}</aside><section>
 <form class="sbox" style="margin:0 0 8px;max-width:none" data-form="libq">${["c","t","a","s"].map(k=>`<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="ابحث في عناوين هذا القسم" aria-label="بحث في العناوين"><button class="btn">بحث</button></form>
 <div class="row" style="margin-bottom:6px"><span class="chips">${chips}</span><span class="mut nf">الترتيب: ${sorts}</span></div>
 ${r.slice((f.pg-1)*PER,f.pg*PER).map(bookCard).join("")||'<div class="note">لا توجد كتب مطابقة.</div>'}
 ${np>1?`<div class="pgn"><a class="btn s" ${f.pg>1?`href="${url({pg:f.pg-1})}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${f.pg} من ${np}</span><a class="btn s" ${f.pg<np?`href="${url({pg:f.pg+1})}"`:'aria-disabled="true"'}>التالية</a></div>`:""}</section></div>`)}

/* ---------- المقالات ---------- */
function vArticles(q){
 const f={t:q.t||"",a:q.a||"",q:q.q||"",s:q.s||"new",pg:+q.pg||1},PER=20,wide=matchMedia("(min-width:760px)").matches,all=ARTS();
 let r=all.filter(b=>(!f.t||b.topicId===f.t)&&(!f.a||b.authorId===f.a));
 if(f.q.trim()){const w=norm(f.q).split(/\s+/).filter(Boolean);r=r.filter(b=>w.every(k=>norm(b.title).includes(k)))}
 const an=b=>A(b.authorId).name;
 r=f.s==="title"?[...r].sort((x,y)=>x.title.localeCompare(y.title,"ar")):f.s==="author"?[...r].sort((x,y)=>an(x).localeCompare(an(y),"ar")||(y.date||"").localeCompare(x.date||"")):[...r].sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const np=Math.max(1,Math.ceil(r.length/PER));f.pg=Math.max(1,Math.min(f.pg,np));
 const url=o=>{const n=Object.assign({},f,o),p=new URLSearchParams();["t","a","q","s"].forEach(k=>{if(n[k]&&!(k==="s"&&n[k]==="new"))p.set(k,n[k])});if(n.pg>1)p.set("pg",n.pg);return"#/articles"+(p.toString()?"?"+p:"")};
 const cnt=key=>id=>all.filter(b=>!id||b[key==="t"?"topicId":"authorId"]===id).length;
 const tabs=`<div class="tabs" role="tablist">${[["new","الأحدث"],["title","حسب العنوان"],["author","حسب الكاتب"]].map(([v,l])=>`<a role="tab" aria-selected="${f.s===v}" href="${url({s:v,pg:1})}">${l}</a>`).join("")}</div>`;
 const page=r.slice((f.pg-1)*PER,f.pg*PER);let list="";
 if(f.s==="author"){let last=null;page.forEach(b=>{if(b.authorId!==last){last=b.authorId;list+=`<h3 class="grp"><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(an(b))}</a></h3>`}list+=artCard(b)})}else list=page.map(artCard).join("");
 const chips=[f.t&&`<a class="chip x" href="${url({t:"",pg:1})}">${esc(T(f.t).name)} ✕</a>`,f.a&&`<a class="chip x" href="${url({a:"",pg:1})}">${esc(A(f.a).name)} ✕</a>`,f.q&&`<a class="chip x" href="${url({q:"",pg:1})}">«${esc(f.q)}» ✕</a>`].filter(Boolean).join(" ");
 view(`<h2>المقالات <span class="mut">(${r.length})</span></h2><p class="mut">مقالات صوت السلف وبيانات الدعوة السلفية، مقسمة بالموضوع والكاتب. تُضاف مقالات جديدة يوميًا بدءًا من الأقدم.</p>${tabs}
 <div class="lib"><aside class="side">${sideList("الأقسام",lib.topics.filter(t=>t.for==="articles").map(t=>Object.assign({},t,{name:t.parent?t.parent+" › "+t.name:t.name})).sort((x,y)=>x.name.localeCompare(y.name,"ar")),"t",f.t,url,cnt("t"),wide)}${sideList("الكُتّاب",lib.authors.filter(a=>bc(a)!=="turath"),"a",f.a,url,cnt("a"),wide)}</aside><section>
 <form class="sbox" style="margin:8px 0;max-width:none" data-form="artq">${["t","a","s"].map(k=>`<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="ابحث في عناوين المقالات" aria-label="بحث في عناوين المقالات"><button class="btn">بحث</button></form>
 <div class="chips">${chips}</div>
 ${list||`<div class="note">${all.length?"لا توجد مقالات مطابقة.":"لم تُضف مقالات بعد. يبدأ الاستيراد اليومي من صوت السلف تلقائيًا، ويمكن إضافة مقال يدويًا من صفحة «الإدارة»."}</div>`}
 ${np>1?`<div class="pgn"><a class="btn s" ${f.pg>1?`href="${url({pg:f.pg-1})}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${f.pg} من ${np}</span><a class="btn s" ${f.pg<np?`href="${url({pg:f.pg+1})}"`:'aria-disabled="true"'}>التالية</a></div>`:""}</section></div>`)}

/* ---------- المؤلفون ---------- */
function vAuthors(){const g=(title,col)=>{const as=lib.authors.filter(a=>(a.col||"dawah")===col).map(a=>({a,nb:BOOKS().filter(b=>b.authorId===a.id).length,na:ARTS().filter(b=>b.authorId===a.id).length})).filter(x=>x.nb||x.na||col==="dawah");
  return`<h2>${title}</h2><div class="grid">${as.map(({a,nb,na})=>`<a class="card" href="#/author/${a.id}" data-author="${a.id}"><b>${esc(a.name)}</b><span>${a.died?`ت ${a.died}هـ • `:""}${nb} كتاب${na?` • ${na} مقال`:""}</span></a>`).join("")}</div>`};
 view(g("مشايخ الدعوة السلفية والمصادر","dawah")+g("علماء التراث","turath"))}
function vAuthor(id,q){const a=A(id),bs=BOOKS().filter(b=>b.authorId===id),as=ARTS().filter(b=>b.authorId===id).sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const k=q.k||(bs.length||!as.length?"books":"articles");
 const tt=tj(id);view(`<h2>${esc(a.name)}${died(a)}</h2>${tt||a.bio?`<div class="abrief"><p>${esc((tt&&tt.brief)||a.bio)}</p>${tt?`<a class="btn s p" href="#/tarjama/${id}">الترجمة المفصلة</a>`:""}</div>`:""}
 <div class="tabs" role="tablist"><a role="tab" aria-selected="${k==="books"}" href="#/author/${id}?k=books">الكتب (${bs.length})</a><a role="tab" aria-selected="${k==="articles"}" href="#/author/${id}?k=articles">المقالات (${as.length})</a></div>
 ${k==="books"?(bs.map(bookCard).join("")||'<p class="mut">لا توجد كتب بعد.</p>'):(as.slice(0,30).map(artCard).join("")+(as.length>30?`<p><a href="#/articles?a=${id}">كل مقالات ${esc(a.name)}</a></p>`:"")||'<p class="mut">لا توجد مقالات بعد.</p>')}
 <p style="margin-top:14px"><a class="btn s" href="#/ask?a=${id}">اسأل المكتبة عن كتب ${esc(a.name)}</a></p>`)}
function vFavs(){const l=lib.books.filter(b=>S.favs.includes(b.id));view(`<h2>المفضلة</h2>${l.map(anyCard).join("")||'<p class="mut">لم تضف شيئًا بعد. افتح أي كتاب أو مقال واضغط «مفضلة».</p>'}`)}

/* ---------- البحث ---------- */
async function vSearch(q){
 const f={q:q.q||"",mode:q.mode||"all",scope:q.scope||"all",a:q.a||"",t:q.t||"",ex:q.ex||"",c:q.c||"",k:q.k||""};
 const opt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const so=(v,l,c)=>`<option value="${v}"${c===v?" selected":""}>${l}</option>`;
 view(`<h2>البحث</h2><form data-form="search"><input name="q" type="search" value="${esc(f.q)}" placeholder="اكتب كلمة أو عبارة" aria-label="كلمات البحث">
 <div class="row"><div><label>نوع البحث</label><select name="mode">${so("all","كل الكلمات",f.mode)}${so("any","أي كلمة",f.mode)}${so("phrase","عبارة كاملة",f.mode)}</select></div>
 <div><label>النطاق</label><select name="scope">${so("all","العناوين والنصوص",f.scope)}${so("meta","العناوين والمؤلفون فقط",f.scope)}${so("text","النصوص فقط",f.scope)}</select></div>
 <div><label>النوع</label><select name="k">${so("","كتب ومقالات",f.k)}${so("book","كتب فقط",f.k)}${so("article","مقالات فقط",f.k)}</select></div></div>
 <div class="row"><div><label>القسم</label><select name="c">${so("","الكل",f.c)}${so("dawah",COL.dawah,f.c)}${so("turath",COL.turath,f.c)}</select></div><div><label>المؤلف</label><select name="a">${opt(lib.authors,f.a,"كل المؤلفين")}</select></div><div><label>الموضوع</label><select name="t">${opt(lib.topics,f.t,"كل الموضوعات")}</select></div></div>
 <label class="inl"><input type="checkbox" name="ex" value="1"${f.ex==="1"?" checked":""}> مطابقة التشكيل والهمزات حرفيًا</label><br>
 <button class="btn p" style="margin-top:10px">ابحث</button></form><div id="sres"></div>`,true);
 if(!f.q.trim())return;
 const out=$("#sres"),n=f.ex==="1"?f.q.trim():norm(f.q).trim(),w=n.split(/\s+/).filter(Boolean),P=f.ex==="1"?(s=>s):(s=>norm(s));
 const m=t=>{const x=P(t);return f.mode==="phrase"?x.includes(n):f.mode==="any"?w.some(k=>x.includes(k)):w.every(k=>x.includes(k))};
 const books=lib.books.filter(b=>(!f.c||bc(b)===f.c)&&(!f.a||b.authorId===f.a)&&(!f.t||b.topicId===f.t)&&(!f.k||(b.type||"book")===f.k));
 const meta=f.scope==="text"?[]:books.filter(b=>m(b.title+" "+A(b.authorId).name+" "+T(b.topicId).name));
 const hits=[];
 if(f.scope!=="meta"){await loadMany(books,(i,k)=>progress(out,i,k,"جارٍ تحميل نصوص الكتب للبحث"));
  books.forEach(b=>b.pages&&b.pages.forEach((p,i)=>{if(hits.length<5000&&m(plain(p)))hits.push({b,i,p})}))}
 const mark=t=>{const ws=norm(f.q).split(/\s+/).filter(Boolean);return esc(t).split(/(\s+)/).map(x=>ws.some(k=>k&&norm(x).includes(k))?`<mark>${x}</mark>`:x).join("")};
 const snip=(p)=>{const t=strip(plain(p)),i=Math.max(0,norm(t).indexOf(w[0]||""));const a=Math.max(0,i-60);return(a?"…":"")+t.slice(a,a+180)+"…"};
 out.innerHTML=`<p class="mut">${meta.length} عنوانًا • ${hits.length>=5000?"أكثر من 5000":hits.length} موضعًا</p>${meta.slice(0,40).map(anyCard).join("")}
 ${hits.length?`<p class="note">تريد خلاصة موثقة بدل قائمة نتائج؟ <a href="#/ask?q=${encodeURIComponent(f.q)}">اسأل المكتبة عن «${esc(f.q)}»</a></p>`:""}
 ${hits.slice(0,150).map(h=>`<a class="bk${isArt(h.b)?" ar":bc(h.b)==="turath"?" tr":""}" href="#/book/${h.b.id}/${h.i+1}?h=${encodeURIComponent(f.q)}"><b>${esc(h.b.title)}</b><span>${esc(A(h.b.authorId).name)}${PL(h.b,h.i)?" — "+esc(PL(h.b,h.i)):""}</span><p>${mark(snip(h.p))}</p></a>`).join("")}
 ${hits.length>150?'<p class="mut">عُرضت أول 150 نتيجة، ضيّق البحث بالقسم أو المؤلف.</p>':""}${!meta.length&&!hits.length?'<div class="note">لا توجد نتائج. جرّب «أي كلمة» أو أزل التصفية.</div>':""}`}

/* ---------- القارئ الورقي ---------- */
let LASTREAD=null;
function pageHtml(text,h){const hs=norm(h||"").split(/\s+/).filter(Boolean);const tx=S.tash?text:strip(text);
 return tx.split("\n").map(line=>{const head=line.startsWith("# "),l=head?line.slice(2):line;
  const inner=l.split(/(\s+)/).map(w=>w.trim()?`<span class="w${hs.length&&hs.some(k=>norm(w).includes(k))?" hit":""}">${esc(w)}</span>`:w).join("");
  return head?`<p class="ph">${inner}</p>`:`<p>${inner}</p>`}).join("")}
function chapterOf(b,p){let c="";(b.toc||[]).forEach(x=>{if(x.p<=p)c=x.t});return c}
/* ---------- أدوات القراءة: الشريط الثابت واللوحات المنزلقة ---------- */
const IC={toc:'<path d="M4 6h16M4 12h16M4 18h10"/>',prev:'<path d="M9 6l6 6-6 6"/>',next:'<path d="M15 6l-6 6 6 6"/>',look:'<path d="M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M16 16h4"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',exit:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function lookHtml(){return`<div class="row"><div><label for="lf">نوع الخط</label><select id="lf">${fontOpts(S.font)}</select></div>
 <div><label for="lth">المظهر</label><select id="lth"><option value="auto"${S.theme==="auto"?" selected":""}>تلقائي</option><option value="light"${S.theme==="light"?" selected":""}>نهاري</option><option value="dark"${S.theme==="dark"?" selected":""}>ليلي</option></select></div></div>
 <label>حجم الخط</label><div class="stepper"><button class="btn" data-sz="-1" aria-label="تصغير الخط">أ−</button><input id="ls" type="range" min="1" max="2.4" step=".05" value="${S.size}" aria-label="حجم الخط"><button class="btn" data-sz="1" aria-label="تكبير الخط">أ+</button></div>
 <label for="ll">تباعد الأسطر</label><input id="ll" type="range" min="1.5" max="3" step=".1" value="${S.lh}">
 <label>لون الصفحة</label><div class="swatches">${PAGES.map(p=>`<button class="swc" data-pg="${p[0]}" title="${p[1]}" aria-label="لون الصفحة: ${p[1]}" aria-pressed="${S.pg===p[0]}" style="background:${p[2]}"></button>`).join("")}</div>
 <label class="inl"><input type="checkbox" id="lt"${S.tash?" checked":""}> إظهار التشكيل</label>`}
function wireLook(){const up=()=>{S.font=$("#lf").value;S.size=+$("#ls").value;S.lh=+$("#ll").value;S.tash=$("#lt").checked;S.theme=$("#lth").value;saveS();applyLook();refreshPage()};
 ["#lf","#ls","#ll","#lt","#lth"].forEach(i=>{const e=$(i);if(e)e.oninput=e.onchange=up});
 $$("[data-sz]").forEach(b=>b.onclick=()=>{const r=$("#ls");r.value=Math.max(1,Math.min(2.4,+r.value+(+b.dataset.sz)*.1));up()});
 $$(".swc").forEach(s=>s.onclick=()=>{S.pg=s.dataset.pg;saveS();applyLook();$$(".swc").forEach(x=>x.setAttribute("aria-pressed",x===s))})}
function refreshPage(){const rb=$("#rb");if(!rb)return;const b=B(rb.dataset.id);if(b&&b.pages)rb.innerHTML=pageHtml(b.pages[+rb.dataset.p-1],parse().q.h)}
function ensureSheet(){if($("#sheet"))return;document.body.insertAdjacentHTML("beforeend",`<div class="sheet-bg" id="sheetbg" hidden data-act="closeSheet"></div><section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT" hidden><div class="sheet-h"><b id="sheetT"></b><button class="btn s" data-act="closeSheet" aria-label="إغلاق">✕</button></div><div class="sheet-b" id="sheetB"></div></section>`)}
function openSheet(title,html,wire){ensureSheet();$("#sheetT").textContent=title;$("#sheetB").innerHTML=html;$("#sheet").hidden=false;$("#sheetbg").hidden=false;document.body.classList.add("sheet-open");if(wire)wire();const f=$("#sheet").querySelector("input,select,button:not([data-act=closeSheet])");if(f&&f.tagName!=="BUTTON")f.focus()}
function closeSheet(){if(!$("#sheet"))return;$("#sheet").hidden=true;$("#sheetbg").hidden=true;document.body.classList.remove("sheet-open")}
function cur(){const rb=$("#rb");return rb?{b:B(rb.dataset.id),p:+rb.dataset.p}:null}
function tocSheet(){const c=cur();if(!c)return;const b=c.b,ch=chapterOf(b,c.p);
 openSheet("فهرس الكتاب",`<input type="search" id="tocq" placeholder="ابحث في الفهرس" aria-label="ابحث في الفهرس"><div class="toclist" id="toclist">${(b.toc||[]).map(x=>`<a href="#/book/${b.id}/${x.p}" class="${x.t===ch?"on":""}" data-act="closeSheet">${esc(x.t)} <span class="mut">${esc(PL(b,x.p-1)||"ص "+x.p)}</span></a>`).join("")||'<p class="mut">لا يوجد فهرس لهذا الكتاب.</p>'}</div>`,
 ()=>{$("#tocq").oninput=e=>{const q=norm(e.target.value);$$("#toclist a").forEach(a=>a.hidden=q&&!norm(a.textContent).includes(q))};const on=$("#toclist a.on");if(on)on.scrollIntoView({block:"center"})})}
function gotoSheet(){const c=cur();if(!c)return;const n=c.b.pages.length;
 openSheet("الانتقال إلى صفحة",`<form data-form="goto" data-id="${c.b.id}"><div class="stepper"><input id="gp" name="p" type="number" min="1" max="${n}" value="${c.p}" aria-label="رقم الصفحة"><span class="mut">من ${n}</span><button class="btn p">انتقال</button></div><input id="gr" type="range" min="1" max="${n}" value="${c.p}" aria-label="شريط الصفحات"><p class="mut" id="gl">${esc(PL(c.b,c.p-1)||"")} ${esc(chapterOf(c.b,c.p))}</p></form>`,
 ()=>{const sync=v=>{$("#gp").value=v;$("#gr").value=v;$("#gl").textContent=(PL(c.b,v-1)||"")+" "+chapterOf(c.b,v)};$("#gr").oninput=e=>sync(+e.target.value);$("#gp").oninput=e=>sync(Math.max(1,Math.min(n,+e.target.value||1)))})}
function moreSheet(){const c=cur();if(!c)return;const b=c.b,art=isArt(b),fav=S.favs.includes(b.id);
 openSheet("أدوات القراءة",`${b.pages.length>1?`<form class="stepper" data-form="inbook" data-id="${b.id}"><input name="h" type="search" value="${esc(parse().q.h||"")}" placeholder="بحث داخل ${art?"المقال":"الكتاب"}" aria-label="بحث داخل الكتاب"><button class="btn p">بحث</button></form>`:""}
 <div class="tools-grid">
  <button data-act="fav">${fav?"★ إزالة من المفضلة":"☆ إضافة للمفضلة"}</button>
  <button data-act="copyp">نسخ ${art?"المقال":"الصفحة"}</button>
  <button data-act="tr">ترجمة</button>
  <button data-act="exp">تصدير وطباعة</button>
  <a href="#/ask?b=${b.id}&p=${c.p}" data-act="closeSheet">اسأل المكتبة عنها</a>
  <button data-act="qhint">صمّم قبسة</button>
  ${b.pages.length>1?'<button data-act="goto">الانتقال لصفحة</button>':""}
  <button data-act="share">مشاركة الرابط</button>
  ${S.admin?'<button data-act="editp">تعديل النص</button>':""}
 </div>
 <p class="mut" style="margin-top:12px">${esc(b.title)} — ${esc(A(b.authorId).name)}${b.source?"<br>"+esc(b.source):""}${b.license?"<br>"+esc(b.license):""}</p>`)}
function setFull(on){S.full=on;saveS();document.body.classList.toggle("reading-full",on&&document.body.classList.contains("reading"));
 const fb=$("[data-act=full]");if(fb){fb.innerHTML=svg(on?"exit":"full")+`<span>${on?"خروج":"ملء الشاشة"}</span>`;fb.setAttribute("aria-pressed",on)}
 try{const d=document,el=d.documentElement;if(on&&!d.fullscreenElement&&el.requestFullscreen)el.requestFullscreen().catch(()=>{});if(!on&&d.fullscreenElement&&d.exitFullscreen)d.exitFullscreen().catch(()=>{})}catch(e){}}
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&S.full&&document.body.classList.contains("reading")){S.full=false;saveS();document.body.classList.remove("reading-full");const fb=$("[data-act=full]");if(fb)fb.innerHTML=svg("full")+"<span>ملء الشاشة</span>"}});
async function vBook(id,p,h){
 const b0=B(id);if(!b0)return view('<p class="note">الكتاب غير موجود.</p>');
 if(!b0.pages)view('<p class="mut" style="padding:30px 0;text-align:center">جارٍ تحميل النص…</p>');
 let b;try{b=await loadBook(id)}catch(e){return view(`<p class="note">${esc(e.message)}. تحقق من الاتصال وأعد المحاولة.</p>`)}
 if(parse().p[1]!==id)return;
 const n=b.pages.length;p=Math.max(1,Math.min(n,p||1));const art=isArt(b);
 const same=LASTREAD&&LASTREAD.id===id,dir=same?(p>LASTREAD.p?"slide-l":p<LASTREAD.p?"slide-r":""):"";LASTREAD={id,p};S.last={id,p};saveS();
 const a=A(b.authorId),label=PL(b,p-1),chap=chapterOf(b,p),fatwa=b.fa||/^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c||"");
 const head=art?"":`<div class="rhead"><h2>${esc(b.title)}</h2><div class="mut"><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}${died(a)}</a> • <a href="#/library?c=${bc(b)}&t=${b.topicId}">${esc(T(b.topicId).name)}</a> • ${COL[bc(b)]}</div>${b.demo?'<p class="note">هذا نص تجريبي يُستبدل بالنص المعتمد.</p>':""}</div>`;
 const ahead=art?`<div class="ahead"><h1>${esc(b.title)}</h1><div><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}</a>${b.date?" • "+fmtDate(b.date):""} • <a href="#/articles?t=${b.topicId}">${esc(T(b.topicId).name)}</a>${b.url?` • <a href="${esc(b.url)}" target="_blank" rel="noopener">المصدر</a>`:""}</div>${fatwa?'<div class="src-note">من فتاوى موقع صوت السلف</div>':""}</div>`:"";
 const B_=(act,ic,txt,dis)=>`<button data-act="${act}"${dis?" disabled":""}>${svg(ic)}<span>${txt}</span></button>`;
 view(`${head}
 <div class="desk"><article class="paper${art?" art":""} ${dir}" id="paper" aria-label="صفحة ${p}">
  ${art?ahead:`<div class="run"><span>${esc(b.title)}</span><span>${esc(chap)}</span></div>`}
  <div class="rd" id="rb" data-id="${id}" data-p="${p}">${pageHtml(b.pages[p-1],h)}</div>
  ${n>1||!art?`<div class="foot">— ${toAr(p)} —${label?`<small>${esc(label)}${b.pl?" في المطبوع":""}</small>`:""}</div>`:""}
 </article></div>
 <p class="mut hint">${n>1?"اسحب الصفحة للتقليب • ":""}اضغط أي كلمة لمعناها • حدّد نصًا لتجعله قبسة</p>
 <nav class="rbar2" id="rbar" aria-label="أدوات القراءة">
  ${B_("toc","toc","الفهرس",!(b.toc&&b.toc.length))}
  ${B_("prev","prev","السابقة",p<=1)}
  <button data-act="goto" class="pgb"${n>1?"":" disabled"}><b>${toAr(p)}</b><span>من ${toAr(n)}</span></button>
  ${B_("next","next","التالية",p>=n)}
  ${B_("look","look","المظهر")}
  ${B_("more","more","المزيد")}
  ${B_("full",S.full?"exit":"full",S.full?"خروج":"ملء الشاشة")}
 </nav>`,same);
 document.body.classList.toggle("reading-full",!!S.full);
 if(same){const pp=$("#paper");if(pp){const y=pp.getBoundingClientRect().top+window.scrollY-(S.full?8:110);if(window.scrollY>y)window.scrollTo(0,y)}}
 const pp=$("#paper");let sx=0,sy=0;pp.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
 pp.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&!String(getSelection()))turn(dx>0?1:-1)},{passive:true})}
function turn(d){const rb=$("#rb");if(!rb)return;const b=B(rb.dataset.id),p=+rb.dataset.p+d;if(p<1||p>b.pages.length)return;const h=parse().q.h;location.hash=`#/book/${b.id}/${p}${h?"?h="+encodeURIComponent(h):""}`}

/* ---------- الحوارات ---------- */
const dlg=()=>$("#dlg");
function openDlg(h){$("#dlgb").innerHTML=h;const d=dlg();if(!d.open)d.showModal()}
let DICT=null;
const nk=s=>strip(s).replace(/[\sـ]/g,"").replace(/[أإآٱء]/g,"ا").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي");
function roots(word){let w=nk(word).replace(/[^ء-ي]/g,"").replace(/ة$/,"");const out=[],add=r=>{if(r.length>=2&&r.length<=4&&!out.includes(r))out.push(r)};
 const pre=["وبال","وال","فال","بال","كال","ولل","فلل","ال","لل","و","ف","ب","ك","ل","س"],suf=["تموها","كموها","هما","كما","تما","تين","تان","ات","ون","ين","ان","وا","ها","هم","هن","كم","كن","نا","تم","ية","ه","ي","ك","ت","ا","ن"];
 const stems=new Set([w]);[...stems].forEach(s=>pre.forEach(p=>{if(s.startsWith(p)&&s.length-p.length>=2)stems.add(s.slice(p.length))}));
 [...stems].forEach(s=>suf.forEach(x=>{if(s.endsWith(x)&&s.length-x.length>=2){const t=s.slice(0,-x.length);stems.add(t);suf.forEach(y=>{if(t.endsWith(y)&&t.length-y.length>=2)stems.add(t.slice(0,-y.length))})}}));
 const reduce=s=>{if(s.length<=3)return[s];const r=[];
  [/^[مأيتنا]/,/^ست/,/^ا/,/^ت/].forEach(rx=>{const t=s.replace(rx,"");if(t!==s)r.push(t)});
  for(let i=1;i<s.length;i++)if("اوي".includes(s[i]))r.push(s.slice(0,i)+s.slice(i+1));
  if(s[1]==="ت"&&s.length>=4)r.push(s[0]+s.slice(2));if(s[2]==="ت"&&s.length>=5)r.push(s.slice(0,2)+s.slice(3));return r};
 let lvl=[...stems];for(let k=0;k<3;k++){const nx=[];lvl.forEach(s=>{if(s.length===3||s.length===4)add(s);if(s.length>3)nx.push(...reduce(s));if(s.length===2){add(s+s[1]);["و","ي"].forEach(m=>add(s[0]+m+s[1]));add(s+"ي");add(s+"و")}});lvl=nx}
 [...out].forEach(r=>{if(r.length===3&&r[1]==="ا"){add(r[0]+"و"+r[2]);add(r[0]+"ي"+r[2])}if(r.length===3&&r[2]==="ا"){add(r.slice(0,2)+"و");add(r.slice(0,2)+"ي")}});
 return out}
async function dictDlg(word){const w=strip(word).replace(/[^ء-ي]/g,"");if(!w)return;const e=encodeURIComponent(w);
 openDlg(`<h3>${esc(w)}</h3><div id="dres" class="mut">يبحث في مختار الصحاح…</div><h3 style="font-size:1rem">معاجم أخرى</h3><div class="row"><a class="btn s nf" target="_blank" rel="noopener" href="https://www.baheth.info/all.jsp?term=${e}">الباحث العربي</a><a class="btn s nf" target="_blank" rel="noopener" href="https://www.almaany.com/ar/dict/ar-ar/${e}/">المعاني</a><a class="btn s nf" target="_blank" rel="noopener" href="https://ar.wiktionary.org/wiki/${e}">ويكاموس</a><a class="btn s nf" target="_blank" rel="noopener" href="https://arabiclexicon.hawramani.com/?s=${e}">معجم لين</a></div>`);
 try{if(!DICT)DICT=window.__DICT__||await (await fetch("data/dict/mukhtar.json")).json();
  const found=roots(w).map(r=>DICT[r]).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
  $("#dres").innerHTML=found.length?found.map(x=>`<p class="mut" style="margin:6px 0 2px">مادة (${esc(x.r)}) — مختار الصحاح للرازي</p><div class="dict">${esc(x.t.length>1500?x.t.slice(0,1500)+"…":x.t)}</div>`).join(""):"لم أجد جذر الكلمة في مختار الصحاح. جرّب المعاجم أدناه."}
 catch(x){$("#dres").textContent="تعذر تحميل المعجم. جرّب المعاجم أدناه."}}
function trDlg(){const rb=$("#rb");if(!rb)return;const L=[["en","الإنجليزية"],["fr","الفرنسية"],["es","الإسبانية"],["tr","التركية"],["de","الألمانية"],["zh-CN","الصينية"],["ru","الروسية"]];
 openDlg(`<h3>ترجمة الصفحة</h3><select id="tl">${L.map(l=>`<option value="${l[0]}">${l[1]}</option>`).join("")}</select><button class="btn p" id="tgo" style="margin-top:8px">ترجم</button><div id="tres" dir="auto" style="line-height:1.8;margin-top:10px;white-space:pre-wrap"></div><p class="note">ترجمة آلية غير معتمدة وقد تخطئ في المصطلحات الشرعية، فلا يُعتمد عليها في الفتوى أو النقل.</p>`);
 $("#tgo").onclick=async()=>{const lang=$("#tl").value,txt=strip(plain(B(rb.dataset.id).pages[+rb.dataset.p-1]));const ch=txt.match(/[^.؟!\n]+[.؟!]?/g)||[txt];const parts=[];let cur="";ch.forEach(c=>{if((cur+c).length>450){parts.push(cur);cur=""}cur+=c+" "});if(cur.trim())parts.push(cur);
  const out=$("#tres");out.textContent="جارٍ الترجمة…";let res="";
  try{for(const p of parts.slice(0,12)){const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p.trim())}&langpair=ar|${lang}`);const j=await r.json();res+=(j.responseData.translatedText||"")+" ";out.textContent=res}}
  catch(x){out.innerHTML=`تعذرت الترجمة. <a target="_blank" rel="noopener" href="https://translate.google.com/?sl=ar&tl=${lang}&text=${encodeURIComponent(txt.slice(0,1500))}">افتحها في مترجم جوجل</a>`}}}
async function dl(name,content,type){const blob=content instanceof Blob?content:new Blob(["﻿"+content],{type:type+";charset=utf-8"});
 try{const d=window.claude&&window.claude.use?await window.claude.use("downloads"):null;if(d){await d.save({filename:name,data:blob});return}}catch(e){return}
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()}
function expDlg(){const rb=$("#rb");if(!rb)return;const b=B(rb.dataset.id),p=+rb.dataset.p;
 openDlg(`<h3>تصدير</h3><div class="row"><div><label>من صفحة</label><input id="ef" type="number" min="1" max="${b.pages.length}" value="${p}"></div><div><label>إلى صفحة</label><input id="et" type="number" min="1" max="${b.pages.length}" value="${Math.min(b.pages.length,p)}"></div></div>
 <label>الصيغة</label><select id="efm"><option value="txt">نص TXT</option><option value="html">صفحة HTML</option><option value="doc">وورد DOC</option><option value="pdf">PDF (طباعة)</option></select><button class="btn p" id="ego" style="margin-top:10px">تصدير</button><p class="mut">الحد الأقصى 300 صفحة في المرة.</p>`);
 $("#ego").onclick=()=>{const f=Math.max(1,+$("#ef").value||1),t=Math.min(b.pages.length,+$("#et").value||f,f+299),fm=$("#efm").value,ps=b.pages.slice(f-1,t),au=A(b.authorId).name,foot=SITENAME+(CFG.siteUrl?" — "+CFG.siteUrl:"");
  const safe=b.title.replace(/[\\/:*?"<>|]/g,"_").slice(0,80);
  if(fm==="txt")return dl(safe+".txt",`${b.title}\n${au}\n\n`+ps.map((x,i)=>`${plain(x)}\n— ${PL(b,f+i-1)||f+i} —`).join("\n\n")+`\n\n${foot}`,"text/plain");
  const html=`<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(b.title)}</title><style>body{font-family:'Amiri','Traditional Arabic',serif;font-size:17pt;line-height:2;max-width:700px;margin:auto;padding:20px;text-align:justify}.pg{margin-bottom:24px;page-break-after:always}h4{text-align:center}small{color:#666;display:block;text-align:center}p{margin:0 0 .3em;text-indent:1.3em}</style></head><body><h1 style="text-align:center">${esc(b.title)}</h1><h3 style="text-align:center">${esc(au)}</h3>${ps.map((x,i)=>`<div class="pg">${x.split("\n").map(l=>l.startsWith("# ")?"<h4>"+esc(l.slice(2))+"</h4>":"<p>"+esc(l)+"</p>").join("")}<small>${esc(PL(b,f+i-1)||f+i)}</small></div>`).join("")}<hr><small>${esc(foot)}</small></body></html>`;
  if(fm==="html")return dl(safe+".html",html,"text/html");if(fm==="doc")return dl(safe+".doc",html,"application/msword");
  const w=window.open("","_blank");if(!w)return alert("اسمح بالنوافذ المنبثقة ثم أعد المحاولة");w.document.write(html);w.document.close();setTimeout(()=>w.print(),500)}}
function editDlg(){const rb=$("#rb"),b=B(rb.dataset.id),p=+rb.dataset.p;openDlg(`<h3>تعديل ${isArt(b)?"المقال":"الصفحة "+p}</h3><textarea id="et2" style="min-height:300px">${esc(b.pages[p-1])}</textarea><p class="mut">السطر الذي يبدأ بـ «# » يظهر عنوانًا. يُحفظ التعديل على هذا الجهاز، ويدخل في «ملف التحديث» من صفحة الإدارة.</p><button class="btn p" id="esv">حفظ التعديل</button>`);
 $("#esv").onclick=async()=>{const pages=b.pages.slice();pages[p-1]=$("#et2").value;LOCAL.shards[b.id]={id:b.id,pages,toc:b.toc||[],pl:b.pl};
  const meta=Object.assign({},CAT.books.find(x=>x.id===b.id)||LOCAL.catalog.books.find(x=>x.id===b.id)||{},{id:b.id,edited:today()});LOCAL.catalog.books=byId(LOCAL.catalog.books,[meta]);
  await DB.set("local",LOCAL);SH.delete(b.id);merge();dlg().close();route()}}

/* ---------- القبسات ---------- */
let pendingQ=null;
const Q=Object.assign({bg:"id",plain:"#0f5c4d",idx:0,dim:.45,font:"Amiri",ink:"auto",logo:true,size:"1080x1080"},ls.get("qset",{}));let QIMG=null;
const saveQ=()=>{const c=Object.assign({},Q);ls.set("qset",c)};
const PLAINS=["#0f5c4d","#08332b","#5a3f12","#7a1f2b","#1d3557","#2b2d42","#000000","#ffffff","#f7f0dc","#e8f2ec"];
const IDS=["زمردي مزخرف","رقّ عتيق","محراب","ليل وقبس","عاجي ونقش"];
const IMGS={};const img=src=>IMGS[src]||(IMGS[src]=new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=src}));
function star(c,x,y,r){c.beginPath();for(let k=0;k<2;k++){c.save();c.translate(x,y);c.rotate(k*Math.PI/4);c.rect(-r,-r,2*r,2*r);c.restore()}}
function lum(hex){const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255;return .2126*r+.7152*g+.0722*b}
function drawId(c,W,H,k,emb){
 let ink="#ffffff",acc="#e3be6a",area={x:110,y:130,w:W-220,h:H-380};
 if(k===0){const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,"#0f5c4d");g.addColorStop(1,"#08332b");c.fillStyle=g;c.fillRect(0,0,W,H);
  c.strokeStyle="rgba(227,190,106,.16)";c.lineWidth=2;for(let y=0;y<H+120;y+=120)for(let x=(y/120%2)*60;x<W+120;x+=120){c.save();star(c,x,y,26);c.stroke();c.restore()}
  c.strokeStyle="#e3be6a";c.lineWidth=3;c.strokeRect(44,44,W-88,H-88);c.lineWidth=1;c.strokeRect(56,56,W-112,H-112)}
 else if(k===1){c.fillStyle="#efe2c4";c.fillRect(0,0,W,H);let s=7;const r=()=>{s=(s*9301+49297)%233280;return s/233280};c.fillStyle="rgba(90,63,18,.05)";for(let i=0;i<2600;i++)c.fillRect(r()*W,r()*H,2,2);
  c.strokeStyle="#7a5a16";c.lineWidth=4;c.strokeRect(46,46,W-92,H-92);c.lineWidth=1.5;c.strokeRect(60,60,W-120,H-120);c.fillStyle="#7a5a16";[[60,60],[W-60,60],[60,H-60],[W-60,H-60]].forEach(([x,y])=>{star(c,x,y,13);c.fill()});ink="#2a2113";acc="#7a5a16"}
 else if(k===2){c.fillStyle="#10372f";c.fillRect(0,0,W,H);c.strokeStyle="rgba(227,190,106,.12)";c.lineWidth=2;for(let y=0;y<H+100;y+=100)for(let x=0;x<W+100;x+=100){star(c,x,y,20);c.stroke()}
  const ax=90,aw=W-180,top=110,bot=H-150,rr=aw/2;c.beginPath();c.moveTo(ax,bot);c.lineTo(ax,top+rr*.9);c.quadraticCurveTo(ax,top,W/2,top-10);c.quadraticCurveTo(ax+aw,top,ax+aw,top+rr*.9);c.lineTo(ax+aw,bot);c.closePath();
  c.fillStyle="#f7f0dc";c.fill();c.strokeStyle="#e3be6a";c.lineWidth=5;c.stroke();ink="#1d2a24";acc="#0f5c4d";area={x:150,y:top+rr*.55,w:W-300,h:bot-(top+rr*.55)-120}}
 else if(k===3){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,"#0b1a2a");g.addColorStop(1,"#13283d");c.fillStyle=g;c.fillRect(0,0,W,H);let s=3;const r=()=>{s=(s*9301+49297)%233280;return s/233280};
  for(let i=0;i<160;i++){c.fillStyle=`rgba(255,246,220,${.15+r()*.5})`;c.beginPath();c.arc(r()*W,r()*H*.9,r()*2.2+.4,0,7);c.fill()}
  if(emb){c.globalAlpha=.07;const z=Math.min(W,H)*.8;c.drawImage(emb,(W-z)/2,(H-z)/2,z,z);c.globalAlpha=1}acc="#d9ae55"}
 else{c.fillStyle="#fbf7ee";c.fillRect(0,0,W,H);if(emb){c.globalAlpha=.06;const z=Math.min(W,H)*.75;c.drawImage(emb,(W-z)/2,(H-z)/2,z,z);c.globalAlpha=1}
  c.strokeStyle="#0f5c4d";c.lineWidth=10;c.strokeRect(30,30,W-60,H-60);c.strokeStyle="#b88a2e";c.lineWidth=2;c.strokeRect(50,50,W-100,H-100);ink="#14231f";acc="#0f5c4d"}
 return{ink,acc,area}}
function wrap(c,text,max){const o=[];text.split("\n").forEach(par=>{let l="";par.split(/\s+/).forEach(w=>{const t=l?l+" "+w:w;if(c.measureText(t).width>max&&l){o.push(l);l=w}else l=t});o.push(l)});return o}
let drawing=0;
async function draw(){const cv=$("#cv");if(!cv)return;const my=++drawing;
 const[W,H]=Q.size.split("x").map(Number);await loadFont(Q.font);try{await document.fonts.load(`60px "${Q.font}"`);await document.fonts.load(`600 26px "IBM Plex Sans Arabic"`)}catch(e){}
 const[emb,logo]=await Promise.all([img("assets/emblem.svg"),img("assets/logo.jpg")]);if(my!==drawing)return;
 cv.width=W;cv.height=H;const c=cv.getContext("2d");c.direction="rtl";
 let st;
 if(Q.bg==="photo"&&QIMG){const s=Math.max(W/QIMG.width,H/QIMG.height);c.drawImage(QIMG,(W-QIMG.width*s)/2,(H-QIMG.height*s)/2,QIMG.width*s,QIMG.height*s);c.fillStyle=`rgba(0,0,0,${Q.dim})`;c.fillRect(0,0,W,H);st={ink:"#ffffff",acc:"#f0cf7f",area:{x:110,y:130,w:W-220,h:H-380}}}
 else if(Q.bg==="plain"){c.fillStyle=Q.plain;c.fillRect(0,0,W,H);const dark=lum(Q.plain)<.5;st={ink:dark?"#ffffff":"#14231f",acc:dark?"#e3be6a":"#0f5c4d",area:{x:110,y:130,w:W-220,h:H-380}}}
 else st=drawId(c,W,H,Q.idx,emb);
 if(Q.ink==="light")st.ink="#ffffff";if(Q.ink==="dark")st.ink="#14231f";
 const text=($("#qt").value.trim()||"…"),src=$("#qs").value.trim(),cm=$("#qc").value.trim(),A_=st.area;
 const reserve=(src?70:0)+(cm?60:0);let fs=Math.round(W*.064),L;
 for(;fs>24;fs-=2){c.font=`${fs}px "${Q.font}", serif`;L=wrap(c,text,A_.w);if(L.length*fs*1.8<=A_.h-reserve)break}
 const lh=fs*1.8,blockH=L.length*lh+reserve;let y=A_.y+(A_.h-blockH)/2+fs;c.textAlign="center";c.fillStyle=st.ink;
 L.forEach(l=>{c.fillText(l,W/2,y);y+=lh});
 if(src){y+=14;c.fillStyle=st.acc;c.font=`600 ${Math.round(fs*.55)}px "IBM Plex Sans Arabic", sans-serif`;c.fillText("— "+src,W/2,y);y+=50}
 if(cm){c.fillStyle=st.ink;c.globalAlpha=.85;c.font=`${Math.round(fs*.5)}px "IBM Plex Sans Arabic", sans-serif`;c.fillText(cm,W/2,y);c.globalAlpha=1}
 // العلامة المائية الثابتة: شعار المكتبة المرسوم + اسمها في الزاوية
 c.font=`600 25px "IBM Plex Sans Arabic", sans-serif`;const tw=c.measureText(SITENAME).width,ph=78,pw=tw+ph+36,px=34,py=H-ph-34;
 c.fillStyle="rgba(255,255,255,.9)";c.beginPath();c.roundRect?c.roundRect(px,py,pw,ph,16):c.rect(px,py,pw,ph);c.fill();
 if(emb)c.drawImage(emb,px+pw-ph+8,py+8,ph-16,ph-16);c.fillStyle="#0f5c4d";c.textAlign="right";c.fillText(SITENAME,px+pw-ph,py+48);
 if(Q.logo&&logo){const lw=92,lh2=lw*logo.height/logo.width;c.fillStyle="rgba(255,255,255,.92)";c.beginPath();c.roundRect?c.roundRect(W-lw-50,36,lw+16,lh2+16,12):c.rect(W-lw-50,36,lw+16,lh2+16);c.fill();c.drawImage(logo,W-lw-42,44,lw,lh2)}}
function quoteText(){const t=$("#qt").value.trim(),s=$("#qs").value.trim();const link=siteLink(pendingQ&&pendingQ.ref?`#/book/${pendingQ.ref.b}/${pendingQ.ref.p}`:"");
 return`«${t}»`+(s?`\n— ${s}`:"")+`\n${SITENAME}`+(link?`\n${link}`:"")}
async function vQabasat(q){const pq=pendingQ;
 view(`<h2>قبسات</h2><p class="mut">اختر مقتطفًا يرشحه الموقع، أو اكتب قبستك، أو حدّد نصًا في أي كتاب واضغط «اجعل المحدد قبسة».</p>
 <div class="row"><select id="qf" aria-label="مصدر المقتطفات" style="max-width:260px"><option value="">كل المكتبة</option><option value="dawah">مكتبة الدعوة</option><option value="articles">المقالات</option><option value="turath">تراث</option></select><button class="btn" data-act="moreSug">مقتطفات أخرى</button></div>
 <div id="sugl"><p class="mut">جارٍ اختيار مقتطفات…</p></div>
 <h2>صمّم قبستك</h2><div class="studio">
 <label for="qt">النص</label><textarea id="qt"></textarea>
 <div class="row"><div><label for="qs">المصدر (الكاتب والكتاب)</label><input id="qs"></div><div><label for="qc">تعليق (اختياري)</label><input id="qc" placeholder="تعليق قصير يظهر أسفل القبسة"></div></div>
 <div class="row"><div><label for="qfont">خط القبسة</label><select id="qfont">${fontOpts(Q.font)}</select></div><div><label for="qz">المقاس</label><select id="qz"><option value="1080x1080">مربع للمنشورات</option><option value="1080x1350">طولي للمنشورات</option><option value="1080x1920">قصص وحالات</option><option value="1600x900">عرضي</option></select></div><div><label for="qi">لون الكتابة</label><select id="qi"><option value="auto">تلقائي</option><option value="light">فاتح</option><option value="dark">داكن</option></select></div></div>
 <label>الخلفية</label><div class="tabs" role="tablist" id="qbt"><button role="tab" data-bg="id">هوية المكتبة</button><button role="tab" data-bg="plain">لون سادة</button><button role="tab" data-bg="photo">صورة من جهازك</button></div>
 <div id="qp-id" class="ids" style="margin-top:8px"></div>
 <div id="qp-plain" class="row" style="margin-top:8px"><div class="swatches nf">${PLAINS.map(p=>`<button class="sw" data-plain="${p}" aria-label="لون ${p}" style="background:${p}"></button>`).join("")}</div><input type="color" id="qcol" value="${Q.plain}" aria-label="لون مخصص" class="nf"></div>
 <div id="qp-photo" style="margin-top:8px"><input type="file" id="qimg" accept="image/*" aria-label="اختر صورة"><label for="qdim">تعتيم الصورة لوضوح النص</label><input type="range" id="qdim" min="0" max=".8" step=".05" value="${Q.dim}"></div>
 <label class="inl"><input type="checkbox" id="qlogo"${Q.logo?" checked":""}> إظهار شعار الدعوة السلفية</label>
 <canvas id="cv" width="1080" height="1080" aria-label="معاينة القبسة"></canvas>
 <p class="mut" style="text-align:center">العلامة المائية لشعار المكتبة واسمها ثابتة في زاوية كل قبسة.</p>
 <div class="row"><button class="btn p" id="shr">مشاركة أو حفظ الصورة</button><button class="btn" id="cpi">نسخ الصورة</button><button class="btn" id="cpq">نسخ القبسة نصًا</button></div><span id="qmsg" class="mut" role="status"></span>
 <img id="out" alt="" style="width:100%;display:none;margin-top:10px"></div>`);
 if(q&&q.f)$("#qf").value=q.f;
 $("#qt").value=pq?pq.t:"";$("#qs").value=pq?pq.src:"";$("#qz").value=Q.size;$("#qi").value=Q.ink;
 const ids=$("#qp-id");IDS.forEach((n,i)=>{const b=document.createElement("button");b.setAttribute("aria-pressed",Q.bg==="id"&&Q.idx===i);b.innerHTML=`<canvas width="216" height="216"></canvas><span>${n}</span>`;b.onclick=()=>{Q.bg="id";Q.idx=i;saveQ();sync();draw()};ids.appendChild(b);
  img("assets/emblem.svg").then(emb=>{const c=b.querySelector("canvas").getContext("2d");c.scale(.2,.2);drawId(c,1080,1080,i,emb)})});
 const sync=()=>{$$("#qbt [data-bg]").forEach(t=>t.setAttribute("aria-selected",t.dataset.bg===Q.bg));["id","plain","photo"].forEach(k=>$("#qp-"+k).hidden=Q.bg!==k);
  $$("#qp-id button").forEach((b,i)=>b.setAttribute("aria-pressed",Q.bg==="id"&&Q.idx===i));$$("[data-plain]").forEach(b=>b.setAttribute("aria-pressed",Q.bg==="plain"&&b.dataset.plain===Q.plain))};
 $$("#qbt [data-bg]").forEach(t=>t.onclick=()=>{Q.bg=t.dataset.bg;saveQ();sync();draw()});
 $$("[data-plain]").forEach(b=>b.onclick=()=>{Q.plain=b.dataset.plain;$("#qcol").value=Q.plain;saveQ();sync();draw()});
 $("#qcol").oninput=e=>{Q.plain=e.target.value;Q.bg="plain";saveQ();sync();draw()};
 $("#qimg").onchange=e=>{const f=e.target.files[0];if(!f)return;const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{QIMG=i;Q.bg="photo";sync();draw()};i.src=u};
 $("#qdim").oninput=e=>{Q.dim=+e.target.value;saveQ();draw()};
 $("#qlogo").onchange=e=>{Q.logo=e.target.checked;saveQ();draw()};
 $("#qfont").onchange=e=>{Q.font=e.target.value;saveQ();draw()};$("#qz").onchange=e=>{Q.size=e.target.value;saveQ();draw()};$("#qi").onchange=e=>{Q.ink=e.target.value;saveQ();draw()};
 ["#qt","#qs","#qc"].forEach(i=>$(i).oninput=()=>{draw()});
 const msg=t=>{$("#qmsg").textContent=t;setTimeout(()=>{if($("#qmsg"))$("#qmsg").textContent=""},2500)};
 $("#cpq").onclick=async()=>{try{await navigator.clipboard.writeText(quoteText());msg("نُسخت القبسة مع المصدر واسم الموقع.")}catch(e){msg("تعذر النسخ.")}};
 $("#cpi").onclick=()=>$("#cv").toBlob(async b=>{try{await navigator.clipboard.write([new ClipboardItem({"image/png":b})]);msg("نُسخت الصورة.")}catch(e){msg("نسخ الصور غير مدعوم في هذا المتصفح، استخدم «مشاركة أو حفظ».")}});
 $("#shr").onclick=()=>$("#cv").toBlob(async b=>{const f=new File([b],"qabsa.png",{type:"image/png"});
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],text:quoteText()});return}}catch(e){if(e.name==="AbortError")return}
  try{await dl("qabsa.png",b);msg("حُفظت الصورة.")}catch(e){}$("#out").src=$("#cv").toDataURL("image/png");$("#out").style.display="block"});
 $("#qf").onchange=()=>fillSug();
 sync();fillSug(!pq);draw()}
async function fillSug(useFirst){const v=$("#qf")?$("#qf").value:"";const f=v==="articles"?(b=>isArt(b)):v?(b=>bc(b)===v&&!isArt(b)):null;
 const el=$("#sugl");if(!el)return;el.innerHTML='<p class="mut">جارٍ اختيار مقتطفات…</p>';
 SUG=await suggest(4,Math.floor(Math.random()*1e5),f);if(!$("#sugl"))return;
 el.innerHTML=SUG.map(qCard).join("")||'<p class="mut">لا توجد مقتطفات في هذا القسم بعد.</p>';
 if(useFirst&&SUG[0]&&!$("#qt").value){setQuote(SUG[0]);draw()}}
function setQuote(q){pendingQ={t:q.t,src:A(q.b.authorId).name+" — "+q.b.title+(PL(q.b,q.i)?"، "+PL(q.b,q.i):""),ref:{b:q.b.id,p:q.i+1}};if($("#qt")){$("#qt").value=pendingQ.t;$("#qs").value=pendingQ.src}}

/* ---------- الحسابات ---------- */
const loadScript=src=>new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
const Auth={mode:"local",sb:null,user:null,token:null,
 async init(){
  if(CFG.supabaseUrl&&CFG.supabaseAnonKey){
   try{await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js");
    this.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true}});this.mode="cloud";
    const {data}=await this.sb.auth.getSession();this.set(data.session);
    this.sb.auth.onAuthStateChange((_e,s)=>{this.set(s);paintAuth()});
    if(/[?&]code=/.test(location.search))history.replaceState(null,"",location.pathname+location.hash);
    const next=ls.get("authNext",null);if(this.user&&next){ls.set("authNext",null);location.hash=next}
   }catch(e){console.warn("supabase",e)}
  }else this.user=ls.get("acct",null);
  paintAuth()},
 set(s){this.user=s&&s.user?{id:s.user.id,email:s.user.email,name:(s.user.user_metadata||{}).full_name||(s.user.user_metadata||{}).name||s.user.email}:null;this.token=s?s.access_token:null},
 async oauth(provider,next){if(this.mode!=="cloud")throw new Error("الدخول بحساب "+(provider==="google"?"Google":"Apple")+" يعمل بعد ربط الموقع بقاعدة بيانات الحسابات.");
  ls.set("authNext",next||"#/ask");const {error}=await this.sb.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+location.pathname}});if(error)throw error},
 async signUp(name,email,pw){
  if(this.mode==="cloud"){const {data,error}=await this.sb.auth.signUp({email,password:pw,options:{data:{name}}});if(error)throw error;return data.session?"ok":"confirm"}
  this.user={id:"local:"+email.toLowerCase(),name,email};ls.set("acct",this.user);return "ok"},
 async signIn(email,pw){
  if(this.mode==="cloud"){const {error}=await this.sb.auth.signInWithPassword({email,password:pw});if(error)throw error;return}
  const known=ls.get("acct_known",{})[email.toLowerCase()];if(!known)throw new Error("لا يوجد حساب بهذا البريد على هذا الجهاز. أنشئ حسابًا.");
  this.user=known;ls.set("acct",known)},
 async signOut(){if(this.mode==="cloud")await this.sb.auth.signOut();this.user=null;this.token=null;ls.set("acct",null);paintAuth()}};
function paintAuth(){const b=$("#acctbtn");if(b)b.textContent=Auth.user?(Auth.user.name||"حسابي").split(" ")[0]:"دخول";
 if(Auth.mode==="local"&&Auth.user){const k=ls.get("acct_known",{});k[Auth.user.email.toLowerCase()]=Auth.user;ls.set("acct_known",k)}}
const Chats={key:()=>"chats:"+(Auth.user?Auth.user.id:"-"),
 async list(){if(Auth.mode==="cloud"){const {data,error}=await Auth.sb.from("conversations").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(50);if(error)throw error;return data}return ls.get(this.key(),[]).map(c=>({id:c.id,title:c.title,updated_at:c.updated_at}))},
 async get(id){if(Auth.mode==="cloud"){const {data,error}=await Auth.sb.from("conversations").select("*").eq("id",id).single();if(error)throw error;return data}return ls.get(this.key(),[]).find(c=>c.id===id)||null},
 async save(c){c.updated_at=new Date().toISOString();if(Auth.mode==="cloud"){const {error}=await Auth.sb.from("conversations").upsert({id:c.id,user_id:Auth.user.id,title:c.title,messages:c.messages,mode:c.mode,col:c.col,updated_at:c.updated_at});if(error)console.warn(error);return}
  const all=ls.get(this.key(),[]).filter(x=>x.id!==c.id);all.unshift(c);ls.set(this.key(),all.slice(0,40))}};
const GICON=`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#fff" stroke="#dadce0"/><text x="10" y="14.5" text-anchor="middle" font-size="12" font-weight="700" font-family="Arial,sans-serif" fill="#4285f4">G</text></svg>`;
function vAccount(q){
 if(Auth.user){view(`<h2>حسابي</h2><div class="card"><b>${esc(Auth.user.name||"")}</b><span>${esc(Auth.user.email||"")}</span></div>
  ${Auth.mode==="local"?'<p class="note">وضع تجريبي: الحساب ومحادثاته محفوظة على هذا الجهاز فقط. بعد ربط الموقع بقاعدة البيانات تصبح الحسابات حقيقية ومتزامنة بين الأجهزة.</p>':""}
  <div class="row" style="margin:10px 0"><a class="btn p nf" href="#/ask">اسأل المكتبة</a><a class="btn nf" href="#/favs">المفضلة</a><button class="btn nf" data-act="logout">تسجيل الخروج</button></div>
  <h2>محادثاتي</h2><div id="convs" class="mut">جارٍ التحميل…</div>`);
  Chats.list().then(l=>{$("#convs").innerHTML=l.length?l.map(c=>`<a class="bk" href="#/ask?id=${encodeURIComponent(c.id)}"><b>${esc(c.title||"محادثة")}</b><span>${esc((c.updated_at||"").slice(0,10))}</span></a>`).join(""):"لا توجد محادثات بعد."}).catch(()=>{$("#convs").textContent="تعذر تحميل المحادثات."});return}
 const signup=q.m==="signup",back=q.next||"#/ask",cloud=Auth.mode==="cloud";
 view(`<h2>${signup?"إنشاء حساب":"تسجيل الدخول"}</h2>
 <div class="perks"><b>مزايا الأعضاء</b><ul><li>«اسأل المكتبة»: مساعد بحثي يجيب من نصوص المكتبة ويحيل إلى الكتاب والصفحة.</li><li>إعداد بحث علمي موثق في أي مسألة.</li><li>شرح أي صفحة أو مقال بضغطة من القارئ.</li><li>حفظ محادثاتك والرجوع إليها من أي جهاز.</li></ul></div>
 <div class="oauth"><button data-oauth="google">${GICON} المتابعة بحساب Google</button><button class="apple" data-oauth="apple">المتابعة بحساب Apple</button></div>
 ${cloud?"":'<p class="mut" style="font-size:.8rem">الدخول بحساب Google وApple يعمل بعد ربط الموقع بقاعدة الحسابات (الخطوات في دليل التفعيل).</p>'}
 <div class="or">أو بالبريد الإلكتروني</div>
 <form data-form="${signup?"signup":"signin"}" data-next="${esc(back)}">${signup?'<label>الاسم</label><input name="name" required autocomplete="name">':""}
 <label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email">
 ${cloud?`<label>كلمة المرور</label><input name="pw" type="password" minlength="8" required autocomplete="${signup?"new-password":"current-password"}">`:""}
 <button class="btn p" style="margin-top:12px">${signup?"إنشاء الحساب":"دخول"}</button></form><p id="aerr" class="mut" role="alert"></p>
 <p>${signup?`لديك حساب؟ <a href="#/account?next=${encodeURIComponent(back)}">سجّل الدخول</a>`:`ليس لديك حساب؟ <a href="#/account?m=signup&next=${encodeURIComponent(back)}">أنشئ حسابًا مجانيًا</a>`}</p>
 ${cloud?"":'<p class="note">وضع تجريبي: لم تُربط قاعدة الحسابات بعد، فيُحفظ الحساب على هذا الجهاز فقط ودون كلمة مرور.</p>'}`);
 $$("[data-oauth]").forEach(b=>b.onclick=async()=>{try{await Auth.oauth(b.dataset.oauth,back)}catch(e){$("#aerr").textContent=e.message}})}
async function authSubmit(f,kind){const fd=new FormData(f),err=$("#aerr");err.textContent="";
 try{if(kind==="signup"){const r=await Auth.signUp(String(fd.get("name")).trim(),String(fd.get("email")).trim(),fd.get("pw")||"");if(r==="confirm"){err.textContent="أرسلنا رابط تأكيد إلى بريدك، افتحه ثم سجّل الدخول.";return}}
  else await Auth.signIn(String(fd.get("email")).trim(),fd.get("pw")||"");paintAuth();location.hash=f.dataset.next||"#/ask"}
 catch(e){err.textContent=e.message||"تعذر الدخول"}}

/* ---------- اسأل المكتبة ---------- */
const AI={s:undefined,
 async sample(){if(this.s!==undefined)return this.s;try{this.s=window.claude&&window.claude.use?await window.claude.use("sample"):null}catch(e){this.s=null}return this.s},
 scopeLine(o){return o.bookId?"\nنطاق البحث: كتاب واحد معرفه "+o.bookId+" ("+((B(o.bookId)||{}).title||"")+").":o.col?"\nنطاق البحث: "+(o.col==="turath"?"كتب التراث فقط.":"كتب مشايخ الدعوة السلفية ومقالاتهم فقط."):""},
 async ask(o){const s=await this.sample();return s?this.viaSample(s,o):this.viaServer(o)},
 async ensure(o){const need=lib.books.filter(b=>!b.demo&&(!o.col||bc(b)===o.col)&&(!o.bookId||b.id===o.bookId));await loadMany(need,(i,n)=>o.onStatus(`يحمّل نصوص المكتبة للبحث (${toAr(i)} من ${toAr(n)})`))},
 async viaSample(sample,o){const scope={col:o.col,bookId:o.bookId};
  const head=SS.SYSTEM+"\n\nالمهمة: "+SS.MODES[o.mode]+this.scopeLine(o)+"\n\nفيما يلي أسئلة الباحث.";
  let tools=null;try{const lim=await sample.limits();if(lim&&lim.tools)tools=SS.TOOLS.map(t=>({name:t.name,description:t.description,inputSchema:t.input_schema,execute:async inp=>{
   await this.ensure(o);if(t.name==="search_library")o.onStatus("يبحث عن: «"+String(inp.query||"")+"»");else if(t.name==="get_page")o.onStatus("يقرأ "+String(inp.ref||""));return SS.runTool(lib,t.name,inp,scope)}}))}catch(e){}
  const turns=o.turns.map(m=>({role:m.role,content:m.content}));
  if(!tools){await this.ensure(o);const last=turns[turns.length-1],hits=SS.search(lib,last.content,{col:o.col,bookId:o.bookId,k:10});
   last.content+="\n\nمقاطع من المكتبة (لا تُحِل إلا إليها):\n"+hits.map(h=>`[[${h.ref}]] ${h.book} — ${h.author} — ${h.page}:\n${h.text}`).join("\n\n")}
  const r=await sample([{role:"user",content:head},...turns],tools?{tools,signal:o.signal,onText:({text})=>o.onText(text)}:{cache:false,signal:o.signal,onText:({text})=>o.onText(text)});return r.text},
 async viaServer(o){let r;
  try{r=await fetch(CFG.askEndpoint,{method:"POST",signal:o.signal,headers:Object.assign({"content-type":"application/json"},Auth.token?{Authorization:"Bearer "+Auth.token}:{}),body:JSON.stringify({messages:o.turns,mode:o.mode,col:o.col,bookId:o.bookId})})}
  catch(e){if(e.name==="AbortError")throw{code:"cancelled"};throw{code:"offline",message:"تعذر الوصول إلى خادم المحادثة. تأكد من الاتصال بالإنترنت."}}
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok)throw{code:"server",message:j.error||(r.status===404?"خدمة المحادثة لم تُفعَّل على هذا الخادم بعد.":"تعذرت الإجابة، حاول لاحقًا.")};
  o.onText(j.text||"");return j.text||""}};
const AIERR={not_granted:"لم يُسمح لهذه الصفحة باستخدام الذكاء الاصطناعي.",sampling_disabled:"الذكاء الاصطناعي غير متاح لهذا الحساب.",rate_limited:"كثرت الأسئلة، انتظر قليلًا ثم أعد المحاولة.",refused:"تعذرت الإجابة عن هذا السؤال، أعد صياغته.",prompt_too_large:"المحادثة طويلة، ابدأ محادثة جديدة.",session_expired:"انتهت الجلسة، سجّل الدخول من جديد."};
function md(t){const lines=esc(t).split("\n");let h="",inList=false;
 const inline=x=>x.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\[\[([^\]\s]+?):(\d+)\]\]/g,(m,id,p)=>{const b=B(id);if(!b||+p<1||(b.n&&+p>b.n))return'<span class="mut">[مرجع غير موجود]</span>';return`<a class="cite" href="#/book/${id}/${p}">(${esc(b.title)}${PL(b,+p-1)?"، "+esc(PL(b,+p-1)):""})</a>`});
 for(const l of lines){const li=/^\s*[-*•]\s+(.*)/.exec(l)||/^\s*\d+[.)-]\s+(.*)/.exec(l);
  if(li){if(!inList){h+="<ul>";inList=true}h+="<li>"+inline(li[1])+"</li>";continue}
  if(inList){h+="</ul>";inList=false}const hd=/^#{1,4}\s+(.*)/.exec(l);if(hd){h+="<h3>"+inline(hd[1])+"</h3>";continue}
  if(l.trim())h+="<p>"+inline(l)+"</p>"}
 return h+(inList?"</ul>":"")}
let CONV=null,ASKCTL=null;
const newConv=()=>({id:"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:"",mode:"ask",col:"",bookId:"",messages:[]});
async function vAsk(q){
 if(!Auth.user){view(`<h2>اسأل المكتبة</h2><div class="askcta" style="cursor:default"><b>مساعد بحثي للأعضاء</b><span>اسأل عن أي مسألة أو نص، أو اطلب بحثًا علميًا، فيبحث المساعد في كتب المكتبة ومقالاتها ويجيبك مع الإحالة إلى الكتاب والصفحة.</span></div>
  <div class="row" style="margin-top:12px"><a class="btn p nf" href="#/account?m=signup&next=${encodeURIComponent(location.hash)}">أنشئ حسابًا مجانيًا</a><a class="btn nf" href="#/account?next=${encodeURIComponent(location.hash)}">لدي حساب</a></div>`);return}
 if(q.id){try{CONV=(await Chats.get(q.id))||newConv()}catch(e){CONV=newConv()}}else if(!CONV||q.new||q.b||q.q||q.a)CONV=newConv();
 let pre="";if(q.b&&B(q.b)){CONV.mode="explain";CONV.bookId=q.b;CONV.ctx={b:q.b,p:+q.p||1};pre=isArt(B(q.b))?"اشرح هذا المقال ولخّص أهم مسائله":"اشرح هذه الصفحة"}else if(q.q)pre=q.q;else if(q.a)pre=`ما أهم الموضوعات في كتب ${A(q.a).name}؟`;
 const so=(v,l,c)=>`<option value="${v}"${c===v?" selected":""}>${l}</option>`,cb=CONV.bookId&&B(CONV.bookId);
 view(`<div class="askhead"><h2>اسأل المكتبة</h2><div class="row" style="flex:none"><a class="btn s nf" href="#/ask?new=1">محادثة جديدة</a><a class="btn s nf" href="#/account">محادثاتي</a></div></div>
 <div class="row"><div><label for="am">نوع الطلب</label><select id="am">${so("ask","سؤال",CONV.mode)}${so("research","بحث علمي موسّع",CONV.mode)}${so("explain","شرح نص",CONV.mode)}</select></div>
 <div><label for="ac">نطاق البحث</label><select id="ac">${so("","كل المكتبة",CONV.bookId?"x":CONV.col)}${so("dawah",COL.dawah+" والمقالات",CONV.bookId?"x":CONV.col)}${so("turath",COL.turath,CONV.bookId?"x":CONV.col)}${cb?`<option value="book:${cb.id}" selected>${isArt(cb)?"هذا المقال":"هذا الكتاب"}: ${esc(cb.title)}</option>`:""}</select></div></div>
 ${CONV.ctx&&B(CONV.ctx.b)?`<p class="note">النص المرفق: ${esc(B(CONV.ctx.b).title)}${B(CONV.ctx.b).n>1?"، صفحة "+CONV.ctx.p:""}</p>`:""}
 <div id="msgs" aria-live="polite">${CONV.messages.length?"":`<div class="mut ex-wrap" style="padding:8px 0">أمثلة: <button class="btn s ex">ما شروط التوبة؟</button> <button class="btn s ex">ما فضل التوحيد؟</button> <button class="btn s ex">اكتب بحثًا عن علو الهمة في طلب العلم</button></div>`}</div>
 <form data-form="ask" class="askbox"><textarea name="m" rows="3" placeholder="اكتب سؤالك أو المسألة التي تبحث فيها" aria-label="سؤالك">${esc(pre)}</textarea>
 <div class="row"><button class="btn p nf" id="asend">إرسال</button><button type="button" class="btn nf" id="astop" hidden>إيقاف</button><span id="ast" class="mut" style="flex:1"></span></div></form>
 <p class="mut" style="font-size:.8rem">إجابات المساعد آلية وقد تخطئ؛ راجع المراجع المحال إليها بنفسك، وليست فتوى. النصوص التجريبية مستبعدة من البحث.</p>`);
 CONV.messages.forEach(m=>addMsg(m));
 $("#am").onchange=e=>{CONV.mode=e.target.value};$("#ac").onchange=e=>{const v=e.target.value;if(v.startsWith("book:")){CONV.bookId=v.slice(5);CONV.col=""}else{CONV.bookId="";CONV.col=v}};
 $$(".ex").forEach(b=>b.onclick=()=>{const t=document.querySelector('[name=m]');t.value=b.textContent;if(/بحث/.test(b.textContent)){CONV.mode="research";$("#am").value="research"}t.focus()});
 $("#astop").onclick=()=>ASKCTL&&ASKCTL.abort()}
function addMsg(m){const d=document.createElement("div");d.className="msg "+(m.role==="user"?"u":"a");
 if(m.role==="user")d.textContent=m.display||m.content;else{d.innerHTML=md(m.content);const c=document.createElement("button");c.className="btn s";c.textContent="نسخ";c.onclick=async()=>{try{await navigator.clipboard.writeText(m.content.replace(/\[\[([^\]\s]+?):(\d+)\]\]/g,(x,id,p)=>{const b=B(id);return b?`(${b.title}${PL(b,+p-1)?"، "+PL(b,+p-1):""})`:""}));c.textContent="تم النسخ"}catch(e){}};d.appendChild(c)}
 const box=$("#msgs");$$(".ex-wrap").forEach(x=>x.remove());box.appendChild(d);return d}
async function askSubmit(f){const ta=f.querySelector("[name=m]"),text=ta.value.trim();if(!text||ASKCTL)return;
 let content=text;if(CONV.ctx&&!CONV.messages.length){try{const b=await loadBook(CONV.ctx.b),i=CONV.ctx.p-1;content+=`\n\nالنص المطلوب (المرجع [[${b.id}:${i+1}]] — ${b.title}${PL(b,i)?"، "+PL(b,i):""}):\n«${plain(b.pages[i]).slice(0,6000)}»`}catch(e){}}
 const um={role:"user",content,display:text};CONV.messages.push(um);addMsg(um);ta.value="";if(!CONV.title)CONV.title=text.slice(0,70);
 const out=addMsg({role:"assistant",content:""});out.innerHTML='<span class="mut">يفكر…</span>';
 const st=$("#ast"),stop=$("#astop"),send=$("#asend");ASKCTL=new AbortController();stop.hidden=false;send.disabled=true;st.textContent="";
 const turns=CONV.messages.slice(-10).map(m=>({role:m.role,content:m.content}));while(turns.length&&turns[0].role!=="user")turns.shift();
 try{const ans=await AI.ask({turns,mode:CONV.mode,col:CONV.col,bookId:CONV.bookId,signal:ASKCTL.signal,onText:t=>{out.innerHTML=md(t)},onStatus:t=>{st.textContent=t}});
  const am={role:"assistant",content:ans};CONV.messages.push(am);out.replaceWith(addMsg(am));await Chats.save(CONV)}
 catch(e){const part=e&&e.text;if(part){const am={role:"assistant",content:part+"\n\n(انقطعت الإجابة)"};CONV.messages.push(am);out.innerHTML=md(am.content)}
  else if(e&&e.code==="cancelled")out.innerHTML='<span class="mut">أُوقفت الإجابة.</span>';
  else out.innerHTML=`<span class="mut">${esc((e&&(AIERR[e.code]||e.message))||"تعذرت الإجابة، حاول مرة أخرى.")}</span>`}
 finally{ASKCTL=null;stop.hidden=true;send.disabled=false;st.textContent=""}}

/* ---------- الإدارة ---------- */
const IMPORT_LIST=["https://salafvoice.com/article.aspx?a=25750","https://salafvoice.com/article.aspx?a=25749","https://salafvoice.com/article.aspx?a=25748","https://salafvoice.com/article.aspx?a=25747","https://salafvoice.com/article.aspx?a=25746","https://salafvoice.com/article.aspx?a=25745","https://salafvoice.com/article.aspx?a=25744","https://salafvoice.com/article.aspx?a=25743","https://salafvoice.com/article.aspx?a=25742","https://salafvoice.com/article.aspx?a=25741","https://salafvoice.com/article.aspx?a=22854","https://salafvoice.com/article.aspx?a=22910","https://salafvoice.com/article.aspx?a=22875","https://salafvoice.com/article.aspx?a=22902"];
function vAdmin(q){const tab=q.t||"book",opt=(a,v)=>a.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const T_=[["book","إضافة كتاب"],["article","إضافة مقال"],["import","استيراد من صوت السلف"],["update","ملف التحديث"],["offline","دون إنترنت"]];
 const authSel=(name,col)=>`<select name="${name}">${opt(lib.authors.filter(a=>!col||bc(a)===col))}<option value="__new">+ مؤلف جديد</option></select><input name="${name}new" placeholder="اسم المؤلف الجديد (عند اختيار «مؤلف جديد»)" style="margin-top:4px">`;
 let body="";
 if(tab==="book")body=`<form data-form="addbook"><label>العنوان</label><input name="title" required>
  <div class="row"><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option></select></div><div><label>المؤلف</label>${authSel("aid")}</div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for!=="articles"))}</select></div></div>
  <label>المصدر أو الناشر والسنة (اختياري)</label><input name="source">
  <label>ملف نصي (.txt) أو الصق النص أدناه</label><input type="file" name="file" accept=".txt,text/plain"><textarea name="text" placeholder="نص الكتاب"></textarea>
  <div class="row"><div><label>تقسيم الصفحات</label><select name="split"><option value="mark">عند السطر ----- أو فاصل الصفحة</option><option value="auto">تلقائيًا بالحجم</option></select></div><div><label>حجم الصفحة التلقائي (حرف)</label><input name="size" type="number" value="1800"></div></div>
  <label>الفهرس (سطر لكل عنوان: العنوان|رقم الصفحة)</label><textarea name="toc" style="min-height:60px"></textarea><button class="btn p" style="margin-top:10px">حفظ الكتاب</button></form>`;
 else if(tab==="article")body=`<form data-form="addart"><label>عنوان المقال</label><input name="title" required>
  <div class="row"><div><label>الكاتب</label>${authSel("aid","dawah")}</div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for==="articles"))}</select></div><div><label>تاريخ النشر</label><input name="date" type="date" value="${today()}"></div></div>
  <label>رابط المصدر (اختياري)</label><input name="url" type="url" placeholder="https://salafvoice.com/article.aspx?a=…">
  <label>نص المقال</label><textarea name="text" required style="min-height:220px"></textarea><p class="mut">السطر الذي يبدأ بـ «# » يظهر عنوانًا فرعيًا.</p><button class="btn p">حفظ المقال</button></form>`;
 else if(tab==="import")body=`<p class="mut">ضع روابط مقالات صوت السلف، رابطًا في كل سطر. يجلب الخادم نص كل مقال، فتراجعه وتعدّله ثم تحفظه. يعمل هذا من الموقع المنشور على Vercel.</p>
  <textarea id="impurls" style="min-height:160px" dir="ltr">${IMPORT_LIST.join("\n")}</textarea><button class="btn p" id="impgo" style="margin-top:8px">جلب المقالات</button> <span id="impst" class="mut"></span><div id="impres"></div>`;
 else if(tab==="update")body=`<p class="mut">كل ما تضيفه أو تعدّله هنا يُحفظ على هذا الجهاز. لنشره للجميع: نزّل «ملف التحديث» وارفعه إلى مجلد <code>updates</code> في مستودع GitHub، فيدمجه الموقع تلقائيًا ويُعاد نشره (التفاصيل في دليل التفعيل).</p>
  <div class="row"><button class="btn p nf" data-act="expUpd">تنزيل ملف التحديث</button><label class="btn nf" style="margin:0">استيراد ملف تحديث<input type="file" id="impf" accept=".json" hidden></label></div>
  <h3>المضاف والمعدَّل على هذا الجهاز</h3>${LOCAL.catalog.books.map(b=>`<div class="bk"><b>${esc(b.title||b.id)}</b><span>${isArt(b)?"مقال":"كتاب"}${b.edited?" • معدَّل "+b.edited:""}</span> <button class="btn s" data-act="delb" data-id="${b.id}">حذف من الجهاز</button></div>`).join("")||'<p class="mut">لا يوجد.</p>'}`;
 else body=`<p class="mut">نزّل نصوص المكتبة كلها على هذا الجهاز لتعمل دون إنترنت، وتتحدث تلقائيًا عند الاتصال. الحجم الكلي نحو ${Math.round(lib.books.reduce((s,b)=>s+(b.size||0),0)/1048576)} ميجابايت.</p><button class="btn p" data-act="offline">تنزيل المكتبة للعمل دون إنترنت</button><div id="offst"></div>`;
 view(`<h2>الإدارة</h2><label class="inl"><input type="checkbox" id="adm"${S.admin?" checked":""}> وضع الإدارة (يظهر زر «تعديل النص» في القارئ)</label>
 <div class="tabs" role="tablist">${T_.map(([k,l])=>`<a role="tab" aria-selected="${tab===k}" href="#/admin?t=${k}">${l}</a>`).join("")}</div><div style="margin-top:10px">${body}</div>
 <p class="note">صفحة الإدارة غير محمية بكلمة مرور في هذه النسخة، وما يُحفظ هنا يبقى على جهازك حتى ترفع ملف التحديث. تُقصر على المشرفين بعد تفعيل الحسابات.</p>`);
 $("#adm").onchange=e=>{S.admin=e.target.checked;saveS()};
 const impf=$("#impf");if(impf)impf.onchange=async e=>{try{await applyUpdate(JSON.parse(await e.target.files[0].text()));alert("تم الاستيراد");route()}catch(x){alert("ملف غير صالح")}};
 const ig=$("#impgo");if(ig)ig.onclick=importArticles}
async function newAuthor(fd,key,col){let aid=fd.get(key);if(aid!=="__new")return aid;const n=String(fd.get(key+"new")||"").trim();if(!n)throw new Error("اكتب اسم المؤلف الجديد");
 const ex=lib.authors.find(a=>norm(a.name)===norm(n));if(ex)return ex.id;aid="u_a"+Date.now().toString(36);LOCAL.catalog.authors.push({id:aid,name:n,col:col||"dawah",bio:""});return aid}
function splitPages(t,mode,size){t=t.replace(/\r/g,"").trim();if(mode==="mark")return t.split(/\n-{3,}\n|\f/).map(x=>x.trim()).filter(Boolean);
 const ps=[];let cur="";t.split(/\n+/).forEach(par=>{if(cur&&(cur+par).length>size){ps.push(cur.trim());cur=""}cur+=par+"\n"});if(cur.trim())ps.push(cur.trim());return ps}
async function saveItem(meta,pages,toc){LOCAL.catalog.books=byId(LOCAL.catalog.books,[Object.assign(meta,{n:pages.length,size:JSON.stringify(pages).length,added:meta.added||new Date().toISOString()})]);
 LOCAL.shards[meta.id]={id:meta.id,pages,toc:toc||[]};await DB.set("local",LOCAL);SH.delete(meta.id);merge();renderTicker()}
async function addBook(f){const fd=new FormData(f);try{let text=String(fd.get("text")||"");const file=fd.get("file");if(file&&file.size)text=await file.text();if(!text.trim())throw new Error("أدخل نص الكتاب");
 const col=fd.get("col"),aid=await newAuthor(fd,"aid",col),pages=splitPages(text,fd.get("split"),+fd.get("size")||1800);
 const toc=String(fd.get("toc")||"").split("\n").map(l=>l.split("|")).filter(x=>x[0]&&+x[1]).map(x=>({t:x[0].trim(),p:+x[1]}));
 await saveItem({id:"u"+Date.now().toString(36),title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col,type:"book",source:String(fd.get("source")||"")},pages,toc);
 alert("تم حفظ الكتاب ("+pages.length+" صفحة)");f.reset()}catch(e){alert(e.message)}}
async function addArticle(f){const fd=new FormData(f);try{const text=String(fd.get("text")||"").trim();if(!text)throw new Error("أدخل نص المقال");const aid=await newAuthor(fd,"aid","dawah");
 const pages=text.length>7000?splitPages(text,"auto",5000):[text];
 await saveItem({id:"u"+Date.now().toString(36),title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col:"dawah",type:"article",date:fd.get("date")||today(),url:String(fd.get("url")||"")},pages,[]);
 alert("تم حفظ المقال");f.reset()}catch(e){alert(e.message)}}
function matchAuthor(name){if(!name)return"";const n=norm(name).replace(/^(الشيخ|د\.?|الدكتور|م\.?|أ\.?)\s*/,"");return(lib.authors.find(a=>norm(a.name).includes(n)||n.includes(norm(a.name).replace(/^الشيخ\s*/,"")))||{}).id||""}
function matchTopic(cat){if(!cat)return"at1";const parts=String(cat).split(/[›>\/|]/).map(s=>norm(s.trim())).reverse();for(const p of parts){const t=lib.topics.find(t=>t.for==="articles"&&norm(t.name)===p);if(t)return t.id}return"at1"}
async function importArticles(){const urls=$("#impurls").value.split(/\s+/).filter(u=>/^https?:\/\//.test(u)),st=$("#impst"),res=$("#impres");res.innerHTML="";let ok=0;
 for(let i=0;i<urls.length;i++){st.textContent=`يجلب ${toAr(i+1)} من ${toAr(urls.length)}…`;const u=urls[i];
  if(lib.books.some(b=>b.url===u)){res.insertAdjacentHTML("beforeend",`<p class="mut">موجود مسبقًا: ${esc(u)}</p>`);continue}
  try{const r=await fetch(CFG.importEndpoint+"?url="+encodeURIComponent(u));if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||(r.status===404?"خدمة الاستيراد غير متاحة هنا؛ تعمل من الموقع المنشور على Vercel.":"تعذر الجلب"))}
   const a=await r.json();ok++;const id="imp"+i;const aid=matchAuthor(a.author);
   res.insertAdjacentHTML("beforeend",`<form class="studio" style="margin-top:10px" data-form="impsave" data-url="${esc(u)}"><label>العنوان</label><input name="title" value="${esc(a.title)}">
    <div class="row"><div><label>الكاتب${a.author?` (في المصدر: ${esc(a.author)})`:""}</label><select name="aid">${lib.authors.filter(x=>bc(x)==="dawah").map(x=>`<option value="${x.id}"${x.id===aid?" selected":""}>${esc(x.name)}</option>`).join("")}<option value="__new"${aid?"":" selected"}>+ كاتب جديد</option></select><input name="aidnew" value="${aid?"":esc(a.author||"")}"></div>
    <div><label>الموضوع${a.category?` (في المصدر: ${esc(a.category)})`:""}</label><select name="tid">${lib.topics.filter(t=>t.for==="articles").map(t=>`<option value="${t.id}"${t.id===matchTopic(a.category)?" selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
    <div><label>التاريخ</label><input name="date" type="date" value="${esc(a.date||"")}"></div></div>
    <label>النص (راجعه قبل الحفظ)</label><textarea name="text" style="min-height:200px">${esc(a.text)}</textarea><div class="row"><button class="btn p nf">حفظ المقال</button><a class="btn nf" href="${esc(u)}" target="_blank" rel="noopener">فتح المصدر</a></div></form>`)}
  catch(e){res.insertAdjacentHTML("beforeend",`<p class="note">${esc(u)}: ${esc(e.message)}</p>`);if(/غير متاحة/.test(e.message))break}}
 st.textContent=ok?`جُلب ${toAr(ok)} مقالًا. راجعها واحفظها.`:""}
async function impSave(f){const fd=new FormData(f);try{const aid=await newAuthor(fd,"aid","dawah"),text=String(fd.get("text")).trim();
 await saveItem({id:"sv"+(f.dataset.url.match(/a=(\d+)/)||[,Date.now().toString(36)])[1],title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col:"dawah",type:"article",date:fd.get("date")||today(),url:f.dataset.url},text.length>7000?splitPages(text,"auto",5000):[text],[]);
 f.outerHTML=`<p class="mut">✓ حُفظ: ${esc(fd.get("title"))}</p>`}catch(e){alert(e.message)}}
function updatePayload(){return{format:"sdsl-update-1",created:new Date().toISOString(),authors:LOCAL.catalog.authors,topics:LOCAL.catalog.topics,books:LOCAL.catalog.books,shards:LOCAL.shards,deleted:LOCAL.deleted}}
async function applyUpdate(u){if(!u||u.format!=="sdsl-update-1")throw new Error("bad");LOCAL.catalog.authors=byId(LOCAL.catalog.authors,u.authors||[]);LOCAL.catalog.topics=byId(LOCAL.catalog.topics,u.topics||[]);
 LOCAL.catalog.books=byId(LOCAL.catalog.books,u.books||[]);Object.assign(LOCAL.shards,u.shards||{});await DB.set("local",LOCAL);SH.clear();merge();renderTicker()}
async function offline(){const st=$("#offst");const all=lib.books;let i=0;
 try{const c=await caches.open("sdsl-data");const urls=[...new Set(all.map(b=>b.f?"data/articles/"+b.f+".json":"data/books/"+b.id+".json"))];for(const u of urls){progress(st,++i,urls.length,"جارٍ تنزيل النصوص");await c.add(u).catch(()=>{})}
  await c.addAll(["./","index.html","style.css","config.js","search.js","app.js","manifest.webmanifest","data/catalog.json","data/articles/index.json","data/dict/mukhtar.json","assets/logo.jpg","assets/cal.jpg","assets/emblem.svg"]).catch(()=>{});
  st.innerHTML='<p class="mut">تم التنزيل. المكتبة تعمل الآن دون إنترنت.</p>'}catch(e){st.innerHTML='<p class="note">تعذر التنزيل هنا. يعمل من الموقع المنشور.</p>'}}

/* ---------- التعريف بالمؤلفين والتراجم ---------- */
let TJ={items:{}};
const tj=id=>TJ.items[id];
const counts=id=>{const all=lib.books.filter(b=>b.authorId===id&&!b.demo);const f=all.filter(b=>isArt(b)&&isFatwa(b)).length;return{books:all.filter(b=>!isArt(b)).length,arts:all.filter(b=>isArt(b)).length-f,fatwas:f}};
const countLine=id=>{const c=counts(id),p=[];if(c.books)p.push(c.books+" كتاب");if(c.arts)p.push(c.arts+" مقال");if(c.fatwas)p.push(c.fatwas+" فتوى");return p.join(" • ")||"لا توجد مواد بعد"};
function authorBrief(id){const a=A(id),t=tj(id);if(!a||!a.name||a.name==="—")return;
 openSheet(a.name+died(a),`${t&&t.born?`<p class="mut" style="margin:0">المولد: ${esc(t.born)}</p>`:""}
 <p class="brief">${esc((t&&t.brief)||a.bio||"لم يُضف تعريف بهذا المؤلف بعد.")}</p>
 <p class="mut">في المكتبة: ${countLine(id)}</p>
 <div class="row">${t?`<a class="btn p nf" href="#/tarjama/${id}" data-act="closeSheet">الترجمة المفصلة</a>`:""}<a class="btn nf" href="#/author/${id}" data-act="closeSheet">كتبه ومقالاته</a></div>`)}
// الضغط المطول (أو الزر الأيمن) على أي اسم مؤلف يعرض التعريف الموجز
let lpTimer=null,lpFired=false;
document.addEventListener("pointerdown",e=>{const el=e.target.closest("[data-author]");if(!el)return;lpFired=false;clearTimeout(lpTimer);
 lpTimer=setTimeout(()=>{lpFired=true;if(navigator.vibrate)try{navigator.vibrate(15)}catch(x){}authorBrief(el.dataset.author)},520)});
["pointerup","pointercancel","pointerleave"].forEach(t=>document.addEventListener(t,()=>clearTimeout(lpTimer),true));
document.addEventListener("pointermove",e=>{if(Math.abs(e.movementX)+Math.abs(e.movementY)>6)clearTimeout(lpTimer)},true);
document.addEventListener("click",e=>{if(lpFired&&e.target.closest("[data-author]")){e.preventDefault();e.stopPropagation();lpFired=false}},true);
document.addEventListener("contextmenu",e=>{const el=e.target.closest("[data-author]");if(el){e.preventDefault();clearTimeout(lpTimer);authorBrief(el.dataset.author)}});
const sheikhs=()=>Object.keys(TJ.items).filter(id=>A(id).name!=="—");
function vTarajim(){view(`<h2>تراجم مشايخ الدعوة السلفية</h2><p class="mut">تعريف بمشايخ الدعوة السلفية بمصر وجهودهم العلمية والدعوية. اضغط مطولًا على اسم أي مؤلف في الموقع لترى تعريفه الموجز.</p>
 <div class="tgrid">${sheikhs().map(id=>{const a=A(id),t=tj(id);return`<a class="tcard" href="#/tarjama/${id}"><span class="av">${esc(a.name.replace(/^الشيخ\s*/,"").trim()[0]||"")}</span><b>${esc(a.name)}</b><p>${esc(t.brief)}</p><em>${countLine(id)}</em></a>`}).join("")}</div>
 <p class="note">${esc(TJ.note||"")}</p>`)}
function vTarjama(id){const a=A(id),t=tj(id);if(!t)return vAuthor(id,{});
 const c=counts(id),art=t.article&&B(t.article);
 view(`<div class="tj"><div class="tj-h"><span class="av big">${esc(a.name.replace(/^الشيخ\s*/,"").trim()[0]||"")}</span><div><h1>${esc(a.name)}</h1>${t.born?`<p class="mut">المولد: ${esc(t.born)}</p>`:""}</div></div>
 <p class="brief">${esc(t.brief)}</p>
 <div class="row" style="margin:6px 0 14px">${c.books?`<a class="btn nf" href="#/author/${id}?k=books">كتبه (${c.books})</a>`:""}${c.arts?`<a class="btn nf" href="#/articles?a=${id}">مقالاته (${c.arts})</a>`:""}${c.fatwas?`<a class="btn nf" href="#/author/${id}?k=articles">فتاواه (${c.fatwas})</a>`:""}${art?`<a class="btn nf" href="#/book/${art.id}/1">الترجمة كاملة كما في صوت السلف</a>`:""}<a class="btn s nf" href="#/ask?a=${id}">اسأل المكتبة عن كتبه</a></div>
 ${t.sections.map(([h,body])=>`<section class="tj-s"><h3>${esc(h)}</h3><ul>${body.split("\n").map(l=>`<li>${esc(l)}</li>`).join("")}</ul></section>`).join("")}
 <section class="tj-s"><h3>المصادر</h3><ul>${t.sources.map(([n,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul></section>
 <p class="note">${esc(TJ.note||"")}</p><p><a href="#/tarajim">← كل التراجم</a></p></div>`)}

/* ---------- الشريط والتوجيه والأحداث ---------- */
function renderTicker(){const t=$("#ticker"),key=b=>(b.added||"")+"|"+(b.date||""),top=l=>l.filter(b=>!b.demo).sort((x,y)=>key(y).localeCompare(key(x))),ta=top(ARTS()).slice(0,8),tb=top(BOOKS()).slice(0,8),n=[];
 for(let i=0;i<8;i++){if(ta[i])n.push(ta[i]);if(tb[i])n.push(tb[i])}if(!n.length){t.hidden=true;return}
 const one=n.map(b=>`<a href="#/book/${b.id}/1"><b>${esc(b.title)}</b> <span>— ${isArt(b)?"مقال: ":""}${esc(A(b.authorId).name)}</span></a>`).join("");$("#tt").innerHTML=one+one;$("#tt").style.setProperty("--dur",(n.length*7)+"s");t.hidden=false}
function parse(){const h=location.hash.slice(1)||"/";const[p,qs]=h.split("?");return{p:p.split("/").filter(Boolean).map(decodeURIComponent),q:Object.fromEntries(new URLSearchParams(qs||""))}}
function route(){const{p,q}=parse(),v=p[0];$("#selq").hidden=true;closeSheet();document.body.classList.toggle("reading",v==="book");if(v!=="book")document.body.classList.remove("reading-full");
 if(!v)return vHome();if(v==="library")return vLibrary(q);if(v==="articles")return vArticles(q);if(v==="authors")return vAuthors();if(v==="author")return vAuthor(p[1],q);
 if(v==="topics")return vLibrary({});if(v==="topic")return vLibrary({t:p[1]});if(v==="book")return vBook(p[1],+p[2],q.h);if(v==="search")return vSearch(q);
 if(v==="qabasat")return vQabasat(q);if(v==="favs")return vFavs();if(v==="admin")return vAdmin(q);if(v==="ask")return vAsk(q);if(v==="tarajim")return vTarajim();if(v==="tarjama")return vTarjama(p[1]);if(v==="account")return vAccount(q);vHome()}
window.addEventListener("hashchange",route);
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]"),w=e.target.closest(".rd .w");
 if(w&&!el){if(String(getSelection()).trim())return;return dictDlg(w.textContent)}if(!el)return;const a=el.dataset.act;
 if(a==="closeDlg")dlg().close();
 else if(a==="closeSheet"){if(el.tagName!=="A")e.preventDefault();closeSheet()}
 else if(a==="toc")tocSheet();else if(a==="goto")gotoSheet();else if(a==="more")moreSheet();else if(a==="prev")turn(-1);else if(a==="next")turn(1);
 else if(a==="full")setFull(!S.full);
 else if(a==="qhint"){closeSheet();alert("حدّد بإصبعك أو بالماوس العبارة التي تريدها من الصفحة، ثم اضغط زر «اجعل المحدد قبسة».")}
 else if(a==="share"){const c=cur(),u=siteLink(`#/book/${c.b.id}/${c.p}`)||location.href;try{if(navigator.share)await navigator.share({title:c.b.title,url:u});else{await navigator.clipboard.writeText(u);el.textContent="نُسخ الرابط"}}catch(x){}}
 else if(a==="theme"){S.theme=S.theme==="dark"?"light":S.theme==="light"?"dark":(matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark");saveS();applyLook()}
 else if(a==="look")openSheet("مظهر الصفحة",lookHtml(),wireLook);
 else if(a==="moreSug")fillSug();
 else if(a==="mkq"){const q=SUG[+el.dataset.i];if(!q)return;setQuote(q);if(parse().p[0]==="qabasat"){draw();$("#qt").scrollIntoView({behavior:"smooth",block:"center"})}else location.hash="#/qabasat"}
 else if(a==="selq"){const s=String(getSelection()).trim(),rb=$("#rb");if(s&&rb){const b=B(rb.dataset.id),i=+rb.dataset.p-1;pendingQ={t:s,src:A(b.authorId).name+" — "+b.title+(PL(b,i)?"، "+PL(b,i):""),ref:{b:b.id,p:i+1}};location.hash="#/qabasat"}}
 else if(a==="fav"){const id=parse().p[1];S.favs=S.favs.includes(id)?S.favs.filter(x=>x!==id):[...S.favs,id];saveS();el.textContent=S.favs.includes(id)?"إزالة من المفضلة":"مفضلة"}
 else if(a==="copyp"){const rb=$("#rb"),b=B(rb.dataset.id),i=+rb.dataset.p-1;try{await navigator.clipboard.writeText(plain(b.pages[i])+"\n— "+b.title+"، "+A(b.authorId).name+(PL(b,i)?"، "+PL(b,i):"")+"\n"+SITENAME+(siteLink()?"\n"+siteLink(`#/book/${b.id}/${i+1}`):""));el.textContent="تم النسخ"}catch(x){}}
 else if(a==="logout"){await Auth.signOut();location.hash="#/"}
 else if(a==="tr"){closeSheet();trDlg()}else if(a==="exp"){closeSheet();expDlg()}else if(a==="editp"){closeSheet();editDlg()}else if(a==="offline")offline();
 else if(a==="expUpd")dl("sdsl-update-"+today()+".json",JSON.stringify(updatePayload()),"application/json");
 else if(a==="delb"){if(confirm("حذف هذا العنصر من هذا الجهاز؟")){const id=el.dataset.id;LOCAL.catalog.books=LOCAL.catalog.books.filter(b=>b.id!==id);delete LOCAL.shards[id];await DB.set("local",LOCAL);SH.delete(id);merge();renderTicker();route()}}});
document.addEventListener("submit",e=>{const f=e.target.closest("[data-form]");if(!f)return;e.preventDefault();const k=f.dataset.form,fd=new FormData(f);
 const qs=(skipNew)=>{const p=new URLSearchParams();fd.forEach((v,n)=>{if(v&&!(skipNew&&n==="s"&&v==="new"))p.set(n,v)});return p.toString()};
 if(k==="quick"||k==="search")location.hash="#/search?"+qs();
 else if(k==="libq"){const s=qs(true);location.hash="#/library"+(s?"?"+s:"")}
 else if(k==="artq"){const s=qs(true);location.hash="#/articles"+(s?"?"+s:"")}
 else if(k==="goto"){closeSheet();location.hash=`#/book/${f.dataset.id}/${fd.get("p")}`}
 else if(k==="inbook"){const b=B(f.dataset.id),h=String(fd.get("h")||"").trim();if(!h)return location.hash=`#/book/${b.id}/${parse().p[2]}`;const w=norm(h).split(/\s+/).filter(Boolean),cur=+parse().p[2]||1;
  closeSheet();for(let j=1;j<=b.pages.length;j++){const x=(cur-1+j)%b.pages.length;const t=norm(plain(b.pages[x]));if(w.every(k2=>t.includes(k2)))return location.hash=`#/book/${b.id}/${x+1}?h=${encodeURIComponent(h)}`}alert("لا توجد نتائج في هذا الكتاب")}
 else if(k==="addbook")addBook(f);else if(k==="addart")addArticle(f);else if(k==="impsave")impSave(f);
 else if(k==="signin"||k==="signup")authSubmit(f,k);else if(k==="ask")askSubmit(f)});
document.addEventListener("selectionchange",()=>{const s=String(getSelection()).trim(),rb=$("#rb");$("#selq").hidden=!(s.length>12&&rb&&getSelection().anchorNode&&rb.contains(getSelection().anchorNode))});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#sheet")&&!$("#sheet").hidden){closeSheet();return}if($("#rb")&&e.key==="f"&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName)){setFull(!S.full);return}if(!$("#rb")||/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName)||dlg().open)return;if(e.key==="ArrowLeft")turn(1);else if(e.key==="ArrowRight")turn(-1)});

/* ---------- الإقلاع ---------- */
async function boot(){applyLook();const loc=await DB.get("local");if(loc&&loc.catalog)LOCAL=Object.assign(LOCAL,loc);
 const ai=fetch("data/articles/index.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{items:[]}).catch(()=>window.__ARTIDX__||{items:[]});
 try{const r=await fetch("data/catalog.json",{cache:"no-cache"});if(!r.ok)throw 0;CAT=await r.json()}catch(e){CAT=window.__CAT__||CAT}
 ARTS_IDX=((await ai).items||[]).map(artFromIdx);
 try{const r=await fetch("data/tarajim.json",{cache:"no-cache"});if(r.ok)TJ=await r.json()}catch(e){}
 merge();
 if(S.seen&&CAT.version&&S.seen!==CAT.version){const b=$("#banner");b.hidden=false;b.textContent="تم تحديث المكتبة بمحتوى جديد."}
 S.seen=CAT.version;saveS();
 if("serviceWorker"in navigator&&/^https?:/.test(location.protocol)&&!/claude|anthropic/.test(location.host))navigator.serviceWorker.register("sw.js").catch(()=>{});
 renderTicker();await Auth.init();route()}
boot();
