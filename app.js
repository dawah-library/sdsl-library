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
const bc=b=>b.col||"dawah",isArt=b=>b.type==="article";
const isStatement=b=>b.topicId==="at17"||/بيانات|(^|›\s*)بيان/.test(b.c||"")||/^بيان(\s|ات)/.test(b.title||"");
const isReadBook=b=>/^المكتبة المقروءة/.test(b.c||"");
const isTranscript=b=>(b.tags||[]).includes("tafrigh")||/تفريغ|دروس صوتية/.test(b.source||"");
const kindOf=b=>!isArt(b)||isReadBook(b)?"book":isFatwa(b)?"fatwa":isStatement(b)?"statement":"article";
const VOL2=b=>!!(b.set&&b.vol>1),BOOKS=()=>lib.books.filter(b=>kindOf(b)==="book"&&!VOL2(b)),ARTS=()=>lib.books.filter(b=>kindOf(b)==="article"),FATWAS=()=>lib.books.filter(b=>kindOf(b)==="fatwa"),BAYANAT=()=>lib.books.filter(b=>kindOf(b)==="statement");
const COL={dawah:"مكتبة الدعوة السلفية",turath:"تراث"};
const died=a=>a&&a.died?` (ت ${a.died}هـ)`:"";
const PL=(b,i)=>SS.label(b,i);
async function loadBook(id){const b=B(id);if(!b)throw new Error("غير موجود");if(b.pages)return b;
 let sh=LOCAL.shards[id]||SH.get(id)||(window.__SHARDS__&&window.__SHARDS__[id]);
 if(!sh&&b.f){let g=GROUPS.get(b.f);if(!g){g=(window.__GROUPS__&&window.__GROUPS__[b.f])||fetch("data/articles/"+encodeURIComponent(b.f)+".json").then(r=>{if(!r.ok)throw new Error("تعذر تحميل المقال");return r.json()});GROUPS.set(b.f,g)}
  const gg=await g;if(!gg[id])throw new Error("المقال غير موجود في ملفه");sh={id,pages:gg[id].pages,toc:[]}}
 if(!sh){const r=await fetch((b.vf?"vols/":"data/books/")+encodeURIComponent(id)+".json");if(!r.ok)throw new Error("تعذر تحميل النص");sh=await r.json()}
 SH.set(id,sh);attach(b,sh);return b}
async function loadMany(list,onP){const q=list.filter(b=>!b.pages),n=q.length;let i=0;if(!n)return;
 const w=async()=>{while(q.length){const b=q.shift();try{await loadBook(b.id)}catch(e){}onP&&onP(++i,n)}};await Promise.all([w(),w(),w()])}

/* ---------- عرض عام ---------- */
const view=(h,keep)=>{$("#app").innerHTML=h;if(!keep)window.scrollTo(0,0);Pager.entered()};
const bookCard=b=>`<a class="bk${bc(b)==="turath"?" tr":""}" href="#/book/${b.id}/1"><b>${esc(b.set?b.setTitle||b.title:b.title)}</b><span>${b.set?`<em class="tag">${b.vols===2?"مجلدان":toAr(b.vols)+" "+(b.vols>2&&b.vols<11?"مجلدات":"مجلدًا")}</em> • `:""}<span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${died(A(b.authorId))} • ${esc(T(b.topicId).name)}${b.n&&!b.set?` • ${b.n} صفحة`:""}${bc(b)==="turath"?' • <em class="tag">تراث</em>':""}${b.demo?' • <em class="tag">نص تجريبي</em>':""}${b.pdf?' • <em class="tag">مصور</em>':""}${b.ocr?' • <em class="tag">نص آلي</em>':""}</span></a>`;
const artCard=b=>`<a class="bk ar" href="#/book/${b.id}/1"><b>${esc(b.title)}</b><span><span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${isFatwa(b)?' • <em class="tag">من فتاوى صوت السلف</em>':isStatement(b)?' • <em class="tag">بيان</em>':""} • ${fmtDate(b.date)} • ${esc(T(b.topicId).name)}${b.demo?' • <em class="tag">نص تجريبي</em>':""}</span></a>`;
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
 view(`<section class="hero"><img class="emb" src="assets/logo-sdsl.png" alt="شعار المكتبة الرقمية للدعوة السلفية"><h1>مكتبة الدعوة السلفية الرقمية</h1>
 <p class="ayah" lang="ar">قُلْ هَٰذِهِۦ سَبِيلِىٓ أَدْعُوٓا۟ إِلَى ٱللَّهِ ۚ عَلَىٰ بَصِيرَةٍ أَنَا۠ وَمَنِ ٱتَّبَعَنِى ۖ وَسُبْحَـٰنَ ٱللَّهِ وَمَآ أَنَا۠ مِنَ ٱلْمُشْرِكِينَ ﴿١٠٨﴾</p>
 <form class="sbox" data-form="quick"><input name="q" type="search" placeholder="ابحث في الكتب والمقالات والمؤلفين" aria-label="بحث"><button class="btn p">بحث</button></form></section>
 <div class="cols"><a class="col" href="#/library?c=dawah"><b>مكتبة الدعوة السلفية</b><span>كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور</span><em>${BOOKS().filter(b=>bc(b)==="dawah").length} كتاب</em></a>
 <a class="col ar" href="#/articles"><b>المقالات</b><span>مقالات صوت السلف، مقسمة بالموضوع والكاتب</span><em>${ARTS().length} مقال</em></a>
 <a class="col fw" href="#/fatawa"><b>الفتاوى</b><span>فتاوى مشايخ الدعوة بتقسيمها الفني وبحسب الشيخ</span><em>${FATWAS().length} فتوى</em></a>
 <a class="col tr" href="#/library?c=turath"><b>تراث</b><span>المكتبة الإسلامية العامة: كتب الإسلام الكبرى والمراجع المعتمدة</span><em>${BOOKS().filter(b=>bc(b)==="turath").length} كتاب</em></a></div>
 <a class="askcta" href="#/ask"><b>اسأل المكتبة</b><span>مساعد بحثي بالذكاء الاصطناعي يجيب من نصوص المكتبة مع الإحالة إلى الكتاب والصفحة. للأعضاء المسجلين.</span></a>
 <div class="grid"><a class="card" href="#/bayanat"><b>بيانات الدعوة</b><span>${BAYANAT().length} بيان</span></a><a class="card" href="#/furqan"><b>قضايا الفرقان</b><span>المؤلفات المنهجية</span></a><a class="card" href="#/tafrighat"><b>تفريغات</b><span>الدروس مفرّغة نصيًا</span></a><a class="card" href="#/posts"><b>منشورات</b><span>من صفحات المشايخ والكتّاب</span></a><a class="card" href="#/tarajim"><b>تراجم مشايخ الدعوة</b><span>${Object.keys(TJ.items).length} ترجمة</span></a><a class="card" href="#/authors"><b>المؤلفون</b><span>${lib.authors.length} مؤلفًا ومصدرًا</span></a><a class="card" href="#/qabasat"><b>قبسات</b><span>صمّم اقتباسًا وانشره</span></a><a class="card" href="#/search"><b>بحث متقدم</b><span>في العناوين والنصوص</span></a><a class="card" href="#/favs"><b>المفضلة</b><span>${S.favs.length} عنصر</span></a></div>
 <h2>مختارات اليوم</h2><div id="sugg"><p class="mut">جارٍ اختيار مقتطفات…</p></div>
 ${arts.length?`<h2>أحدث المقالات</h2>${arts.slice(0,5).map(artCard).join("")}<p><a href="#/articles">كل المقالات</a></p>`:""}
 <h2>أقسام المكتبة</h2><div class="chips">${lib.topics.filter(t=>t.for!=="articles"&&BOOKS().some(b=>b.topicId===t.id)).map(t=>`<a class="chip" href="#/library?t=${t.id}">${esc(t.name)}</a>`).join("")}</div>
 <div class="chips" style="margin-top:14px"><a class="chip" href="#/about">من نحن</a><a class="chip" href="#/dawah">التعريف بالدعوة السلفية</a><a class="chip" href="#/history">تاريخ الدعوة</a><a class="chip" href="#/contact">تواصل معنا</a></div>
 <p class="note">نصوص «مكتبة الدعوة» المعلّمة «نص تجريبي» تُستبدل بالمواد المعتمدة من الجمعية. كتب «تراث» وكتابا الشيخين المقدم وأحمد فريد نصوص حقيقية من المكتبة الشاملة عبر مشروع OpenITI.</p>`);
 const seed=+today().replace(/-/g,"");suggest(3,seed,b=>(b.size||0)<1200000).then(s=>{SUG=s;const el=$("#sugg");if(el)el.innerHTML=s.map(qCard).join("")||'<p class="mut">لا توجد مقتطفات.</p>'})}

/* ---------- المكتبة (الكتب) ---------- */
function sideList(title,arr,key,cur,url,count,wide){return`<details${wide?" open":""}><summary>${title}</summary><div class="sidebox"><a class="fl${!cur?" on":""}" href="${url({[key]:"",pg:1})}">الكل <span>${count("")}</span></a>${arr.filter(x=>key==="t"||count(x.id)||x.id===cur).map(x=>`<a class="fl${x.id===cur?" on":""}${count(x.id)?"":" zero"}" href="${url({[key]:x.id,pg:1})}">${esc(x.name)}${key==="a"?died(x):""} <span>${count(x.id)}</span></a>`).join("")}</div></details>`}
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

/* ---------- قوائم المقالات والفتاوى والبيانات ---------- */
const LISTS={
 article:{route:"articles",title:"المقالات",desc:"مقالات صوت السلف لمشايخ الدعوة السلفية وكتّابها، مقسمة كما في صوت السلف وبحسب الكاتب. تُضاف مقالات جديدة يوميًا بدءًا من الأقدم.",items:()=>ARTS(),empty:"لا توجد مقالات بعد."},
 fatwa:{route:"fatawa",title:"الفتاوى",desc:"فتاوى مشايخ الدعوة السلفية، مقسمة تقسيمًا فنيًا كما في موقع صوت السلف، وبحسب الشيخ. فتاوى صوت السلف منسوبة إلى الشيخ ياسر برهامي المشرف العام على الموقع.",items:()=>FATWAS(),empty:"لا توجد فتاوى بعد؛ تُضاف يوميًا مع الاستيراد."},
 statement:{route:"bayanat",title:"بيانات الدعوة السلفية",desc:"بيانات الدعوة السلفية وحزب النور مرتبة زمنيًا، وتُضاف آليًا عند نشرها على صوت السلف.",items:()=>BAYANAT(),empty:"لم تُستورد بيانات بعد؛ تظهر هنا تلقائيًا كلما وصل الاستيراد اليومي إلى بيانات الدعوة على صوت السلف."}};
const topicLabel=t=>t.parent?t.parent+" › "+t.name:t.name;
function vList(kind,q){const L=LISTS[kind],all=L.items();
 const f={t:q.t||"",a:q.a||"",q:q.q||"",s:q.s||"new",pg:+q.pg||1},PER=20,wide=matchMedia("(min-width:760px)").matches;
 let r=all.filter(b=>(!f.t||b.topicId===f.t)&&(!f.a||b.authorId===f.a));
 if(f.q.trim()){const w=norm(f.q).split(/\s+/).filter(Boolean);r=r.filter(b=>w.every(k=>norm(b.title).includes(k)))}
 const an=b=>A(b.authorId).name;
 r=f.s==="title"?[...r].sort((x,y)=>x.title.localeCompare(y.title,"ar")):f.s==="author"?[...r].sort((x,y)=>an(x).localeCompare(an(y),"ar")||(y.date||"").localeCompare(x.date||"")):f.s==="old"?[...r].sort((x,y)=>(x.date||"9").localeCompare(y.date||"9")):[...r].sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const np=Math.max(1,Math.ceil(r.length/PER));f.pg=Math.max(1,Math.min(f.pg,np));
 const url=o=>{const n=Object.assign({},f,o),p=new URLSearchParams();["t","a","q","s"].forEach(k=>{if(n[k]&&!(k==="s"&&n[k]==="new"))p.set(k,n[k])});if(n.pg>1)p.set("pg",n.pg);return"#/"+L.route+(p.toString()?"?"+p:"")};
 const cnt=key=>id=>all.filter(b=>!id||b[key==="t"?"topicId":"authorId"]===id).length;
 const topics=lib.topics.filter(t=>all.some(b=>b.topicId===t.id)).map(t=>Object.assign({},t,{name:topicLabel(t)})).sort((x,y)=>x.name.localeCompare(y.name,"ar"));
 const authors=lib.authors.filter(a=>all.some(b=>b.authorId===a.id));
 const sorts=kind==="statement"?[["new","الأحدث"],["old","الأقدم"]]:[["new","الأحدث"],["title","حسب العنوان"],["author",kind==="fatwa"?"حسب الشيخ":"حسب الكاتب"]];
 const tabs=`<div class="tabs" role="tablist">${sorts.map(([v,l])=>`<a role="tab" aria-selected="${f.s===v}" href="${url({s:v,pg:1})}">${l}</a>`).join("")}</div>`;
 const page=r.slice((f.pg-1)*PER,f.pg*PER);let list="";
 if(f.s==="author"){let last=null;page.forEach(b=>{if(b.authorId!==last){last=b.authorId;list+=`<h3 class="grp"><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(an(b))}</a></h3>`}list+=artCard(b)})}else list=page.map(artCard).join("");
 const chips=[f.t&&`<a class="chip x" href="${url({t:"",pg:1})}">${esc(topicLabel(T(f.t)))} ✕</a>`,f.a&&`<a class="chip x" href="${url({a:"",pg:1})}">${esc(A(f.a).name)} ✕</a>`,f.q&&`<a class="chip x" href="${url({q:"",pg:1})}">«${esc(f.q)}» ✕</a>`].filter(Boolean).join(" ");
 view(`<h2>${L.title} <span class="mut">(${r.length})</span></h2><p class="mut">${L.desc}</p>${tabs}
 <div class="lib"><aside class="side">${sideList(kind==="fatwa"?"الأبواب":"الأقسام",topics,"t",f.t,url,cnt("t"),wide)}${sideList(kind==="fatwa"?"المشايخ":"الكُتّاب",authors,"a",f.a,url,cnt("a"),wide)}</aside><section>
 <form class="sbox" style="margin:8px 0;max-width:none" data-form="listq" data-route="${L.route}">${["t","a","s"].map(k=>`<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="${kind==="fatwa"?"ابحث في أسئلة الفتاوى":"ابحث في العناوين"}" aria-label="بحث في العناوين"><button class="btn">بحث</button></form>
 <div class="chips">${chips}</div>
 ${list||`<div class="note">${all.length?"لا توجد نتائج مطابقة.":L.empty}</div>`}
 ${np>1?`<div class="pgn"><a class="btn s" ${f.pg>1?`href="${url({pg:f.pg-1})}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${f.pg} من ${np}</span><a class="btn s" ${f.pg<np?`href="${url({pg:f.pg+1})}"`:'aria-disabled="true"'}>التالية</a></div>`:""}</section></div>`)}

/* ---------- المؤلفون: الصفحة الجامعة ---------- */
function vAuthors(){const g=(title,col)=>{const as=lib.authors.filter(a=>(a.col||"dawah")===col).map(a=>({a,c:counts(a.id)})).filter(x=>x.c.books||x.c.arts||x.c.fatwas||x.c.st||col==="dawah");
  return`<h2>${title}</h2><div class="grid">${as.map(({a})=>`<a class="card" href="#/author/${a.id}" data-author="${a.id}"><b>${esc(a.name)}</b><span>${a.died?`ت ${a.died}هـ • `:""}${countLine(a.id)}</span></a>`).join("")}</div>`};
 view(`<p class="mut" style="margin-top:14px">اضغط مطولًا على اسم أي مؤلف لترى تعريفه الموجز. <a href="#/tarajim">تراجم مشايخ الدعوة</a></p>`+g("مشايخ الدعوة السلفية والكتّاب","dawah")+g("علماء التراث","turath"))}
function vAuthor(id,q){const a=A(id),mine=lib.books.filter(b=>b.authorId===id&&!VOL2(b)),byDate=l=>l.sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const T_={books:mine.filter(b=>kindOf(b)==="book"),articles:byDate(mine.filter(b=>kindOf(b)==="article")),fatawa:byDate(mine.filter(b=>kindOf(b)==="fatwa")),bayanat:byDate(mine.filter(b=>kindOf(b)==="statement")),tafrighat:mine.filter(isTranscript)};
 const NAMES={books:"الكتب",articles:"المقالات",fatawa:"الفتاوى",bayanat:"البيانات",tafrighat:"التفريغات"},ROUTE={articles:"articles",fatawa:"fatawa",bayanat:"bayanat"};
 const shown=Object.keys(T_).filter(k=>k==="books"||k==="articles"||T_[k].length);
 const k=shown.includes(q.k)?q.k:(shown.find(x=>T_[x].length)||"books"),items=T_[k];
 const tt=tj(id);view(`<h2>${esc(a.name)}${died(a)}</h2>${tt||a.bio?`<div class="abrief"><p>${esc((tt&&tt.brief)||a.bio)}</p>${tt?`<a class="btn s p" href="#/tarjama/${id}">الترجمة المفصلة</a>`:""}</div>`:""}
 <div class="tabs" role="tablist">${shown.map(x=>`<a role="tab" aria-selected="${k===x}" href="#/author/${id}?k=${x}">${NAMES[x]} (${T_[x].length})</a>`).join("")}<a role="tab" aria-selected="false" href="#/posts?a=${id}">المنشورات</a></div>
 ${items.slice(0,40).map(anyCard).join("")||`<p class="mut">لا توجد ${NAMES[k]} بعد.</p>`}
 ${items.length>40&&ROUTE[k]?`<p><a href="#/${ROUTE[k]}?a=${id}">عرض كل ${NAMES[k]} (${items.length})</a></p>`:""}
 <p style="margin-top:14px"><a class="btn s" href="#/ask?a=${id}">اسأل المكتبة عن كتب ${esc(a.name)}</a></p>`)}

/* ---------- قضايا الفرقان والتفريغات ---------- */
const FURQAN=[["فقه الخلاف",/الخلاف/],["الأمر بالمعروف والنهي عن المنكر",/الامر بالمعروف|النهي عن المنكر/],["العمل الجماعي",/العمل الجماعي/],["الحاكمية",/الحاكميه|تحكيم الشريعه|بغير ما انزل الله|تنحيه الشريعه/],["السياسة الشرعية",/السياسه الشرعيه/],["الإلحاد",/الالحاد|الملحد/],["قضايا الإيمان والكفر",/الايمان والكفر|التكفير|العذر بالجهل|الارجاء/],["الولاء والبراء",/الولاء والبراء|البراء/]];
function vFurqan(){const pool=lib.books.filter(b=>!b.demo&&bc(b)==="dawah"&&kindOf(b)!=="fatwa");
 const groups=FURQAN.map(([name,rx])=>[name,pool.filter(b=>(b.tags||[]).includes("furqan:"+name)||rx.test(norm(b.title)))]);
 view(`<h2>قضايا الفرقان</h2><p class="mut">المؤلفات والأبحاث العلمية المنهجية التي أصدرتها الدعوة السلفية في القضايا الكبرى، وأكثرها للشيخ ياسر برهامي. تظهر كتب السلسلة هنا وفي صفحة مؤلفها وفي أقسامها الموضوعية معًا.</p>
 <p class="note">تُرفع كتب سلسلة «قضايا الفرقان» عند توفر ملفاتها من الجمعية. ويظهر هنا الآن ما يتصل بكل قضية من المقالات المستوردة.</p>
 ${groups.map(([name,l])=>`<section class="tj-s"><h3>${esc(name)} <span class="mut">(${l.length})</span></h3>${l.slice(0,8).map(anyCard).join("")||'<p class="mut">لا توجد مواد بعد.</p>'}${l.length>8?`<p class="mut">و${l.length-8} مادة أخرى — ابحث عنها في <a href="#/search?q=${encodeURIComponent(name)}">البحث</a>.</p>`:""}</section>`).join("")}`)}
function vTafrighat(){const l=lib.books.filter(b=>!b.demo&&isTranscript(b));
 view(`<h2>تفريغات</h2><p class="mut">الدروس والشروح الصوتية لمشايخ الدعوة مفرّغة نصيًا، مرتبطة بمؤلفيها وبالكتب المشروحة.</p>${l.map(bookCard).join("")||'<p class="note">لا توجد تفريغات بعد.</p>'}<p class="note">تُضاف التفريغات من صفحة الإدارة (كتاب جديد مع وسم «تفريغ»)، أو بإرسال ملفاتها لنا.</p>`)}

/* ---------- الصفحات التعريفية ---------- */
const WA="96566700232";
const waLink=t=>`https://wa.me/${WA}${t?"?text="+encodeURIComponent(t):""}`;
function vAbout(){view(`<div class="page"><h2>من نحن</h2>
 <p><b>مكتبة الدعوة السلفية الرقمية</b> مشروع لجمعية الدعاة، يهدف إلى حفظ تراث الدعوة السلفية بمصر وتيسيره للباحثين وطلاب العلم وعموم المسلمين، بطريقة حديثة تسهّل البحث والقراءة والنقل والدراسة.</p>
 <h3>ماذا تجد في المكتبة</h3><ul>
 <li><b>مكتبة الدعوة:</b> كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور.</li>
 <li><b>المقالات والفتاوى والبيانات:</b> تُستورد يوميًا من موقع صوت السلف، مقسمة كما فيه وبحسب الكاتب.</li>
 <li><b>تراث:</b> كتب الإسلام الكبرى والمراجع المعتمدة في التفسير والحديث والفقه والعقيدة واللغة والتاريخ.</li>
 <li><b>تراجم مشايخ الدعوة</b>، وقسم <b>قضايا الفرقان</b>، و<b>التفريغات</b>.</li></ul>
 <h3>خدمات المكتبة</h3><ul><li>قارئ بمظهر الكتاب الورقي، بخطوط وألوان متعددة، وفهرس وبحث داخل الكتاب.</li><li>بحث في العناوين والنصوص بأنواع متعددة.</li><li>شرح الكلمات من مختار الصحاح بالضغط عليها، وترجمة الصفحات.</li><li>«قبسات»: تصميم الاقتباسات ومشاركتها بهوية المكتبة.</li><li>«اسأل المكتبة»: مساعد بحثي يجيب من نصوص المكتبة مع الإحالة (للأعضاء).</li><li>العمل دون إنترنت، والتصدير بصيغ متعددة.</li></ul>
 <h3>مصادر النصوص</h3><p>كتب التراث وبعض كتب المشايخ من المكتبة الشاملة عبر مشروع OpenITI المفتوح، والمقالات والفتاوى من موقع صوت السلف، مع ذكر المصدر في كل كتاب ومقال.</p>
 <p><a class="btn p" href="#/contact">تواصل معنا</a> <a class="btn" href="#/dawah">التعريف بالدعوة السلفية</a></p></div>`)}
async function vDawah(){view(`<div class="page"><h2>التعريف بالدعوة السلفية بمصر</h2>
 <p>الدعوة السلفية بمصر دعوة إلى الرجوع إلى الكتاب والسنة بفهم سلف الأمة، نشأت في الإسكندرية في سبعينيات القرن الماضي، وانتشرت في محافظات مصر. وهذا تعريفها بنفسها كما نشرته على موقع صوت السلف:</p>
 <div class="paper art" id="dawahText"><p class="mut">جارٍ التحميل…</p></div>
 <p class="mut">المصدر: مقال «دعوتنا» على موقع صوت السلف.</p>
 <div class="row" style="margin-top:10px"><a class="btn nf" href="#/history">تاريخ الدعوة السلفية</a><a class="btn nf" href="#/tarajim">تراجم مشايخ الدعوة</a>${B("sv180")?'<a class="btn nf" href="#/book/sv180/1">السلفية منهج فكري لا حقبة تاريخية</a>':""}</div></div>`);
 const id=B("sv32")?"sv32":B("sv36")?"sv36":null;if(!id){$("#dawahText").innerHTML='<p class="mut">لم يُستورد النص بعد.</p>';return}
 try{const b=await loadBook(id);const el=$("#dawahText");if(el)el.innerHTML=`<div class="rd">${pageHtml(b.pages[0])}</div>`}catch(e){}}
const HISTORY=[
 ["1965م","نشأ الشيخ محمد إسماعيل المقدم في جماعة أنصار السنة المحمدية بالإسكندرية.",0],
 ["1972م","بدأ الشيخ المقدم العمل بالدعوة السلفية، وضم إليها أغلب من صاروا قيادات الدعوة فيما بعد.",0],
 ["السبعينيات","نشأ العمل الدعوي في «الجماعة الإسلامية» بجامعة الإسكندرية، ثم في المدرسة السلفية، وكان من مؤسسيه الأوائل الشيخ سعيد عبد العظيم.",3],
 ["1977م","تأسيس «المدرسة السلفية» بالإسكندرية على يد الشيخ محمد إسماعيل المقدم.",0],
 ["1980م","أول كتاب للشيخ ياسر برهامي: «فضل الغني الحميد» تعليقات على كتاب التوحيد.",1],
 ["1981م","أول ملتقى لشباب الدعوة السلفية، ودُرّس فيه «فضل الغني الحميد» مذكرةً.",1],
 ["الثمانينيات وما بعدها","تأسيس معهد الفرقان لإعداد الدعاة، وصدور مجلتي «صوت الدعوة» و«البصيرة» عن المدرسة السلفية.",1],
 ["1994م","إيقاف معهد الفرقان ومجلتي «صوت الدعوة» و«البصيرة».",1],
 ["2011م","بعد ثورة 25 يناير أُسس مجلس أمناء الدعوة السلفية كيانًا رسميًا، وصار المهندس عبد المنعم الشحات متحدثًا رسميًا باسم الدعوة.",2],
 ["2011–2012م","مشاركة حزب النور في انتخابات مجلس الشعب.",4]];
const HSRC=[["المكتبة الشاملة: بيانات الشيخ محمد إسماعيل المقدم","https://shamela.ws/book/96278"],["صوت السلف: ترجمة الشيخ ياسر برهامي","https://salafvoice.com/article.aspx?a=8"],["المرجع: أحمد فريد / عبد المنعم الشحات","https://areq.net/m/أحمد_فريد.html"],["المرجع: سعيد عبد العظيم","https://areq.net/m/سعيد_عبد_العظيم.html"],["المرجع: عبد المنعم الشحات","https://areq.net/m/عبد_المنعم_الشحات.html"]];
function vHistory(){view(`<div class="page"><h2>تاريخ الدعوة السلفية بمصر</h2><p class="mut">خط زمني مختصر جُمع من التراجم والمصادر المنشورة، ويُستكمل بما تعتمده الجمعية.</p>
 <ol class="timeline">${HISTORY.map(([d,t,s])=>`<li><b>${esc(d)}</b><p>${esc(t)} <a class="srcn" href="${esc(HSRC[s][1])}" target="_blank" rel="noopener" title="${esc(HSRC[s][0])}">[${s+1}]</a></p></li>`).join("")}</ol>
 <h3>المصادر</h3><ol class="srcs">${HSRC.map(([n,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ol>
 <p class="note">هذه الصفحة مسودة؛ ترسل الجمعية تاريخ الدعوة المعتمد فيوضع مكانها.</p></div>`)}
function vContact(){view(`<div class="page"><h2>تواصل مع المكتبة</h2><p>يسعدنا تواصلكم لاقتراح كتاب، أو تصحيح خطأ في نص، أو إرسال ملفات كتب المشايخ، أو أي استفسار عن المكتبة.</p>
 <a class="wa" href="${waLink("السلام عليكم، أتواصل معكم من مكتبة الدعوة السلفية الرقمية.")}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg> تواصل عبر واتساب</a>
 <p class="mut" dir="ltr" style="text-align:right">+${WA}</p>
 <h3>أو اكتب رسالتك هنا</h3><form data-form="contact"><div class="row"><div><label>الاسم</label><input name="n" required></div><div><label>نوع الرسالة</label><select name="k"><option>استفسار</option><option>اقتراح كتاب</option><option>تصحيح خطأ في نص</option><option>إرسال ملفات</option><option>مشكلة في الموقع</option></select></div></div>
 <label>الرسالة</label><textarea name="m" required></textarea><button class="btn p" style="margin-top:8px">إرسال عبر واتساب</button></form>
 <p class="mut">تُرسل الرسالة إلى إدارة المكتبة عبر واتساب.</p></div>`)}

function vFavs(){const l=lib.books.filter(b=>S.favs.includes(b.id));view(`<h2>المفضلة</h2>${l.map(anyCard).join("")||'<p class="mut">لم تضف شيئًا بعد. افتح أي كتاب أو مقال واضغط «مفضلة».</p>'}`)}

/* ---------- البحث ---------- */
async function vSearch(q){
 const f={q:q.q||"",mode:q.mode||"all",scope:q.scope||"all",a:q.a||"",t:q.t||"",ex:q.ex||"",big:q.big||"",c:q.c||"",k:q.k||""};
 const opt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const so=(v,l,c)=>`<option value="${v}"${c===v?" selected":""}>${l}</option>`;
 view(`<h2>البحث</h2><form data-form="search"><input name="q" type="search" value="${esc(f.q)}" placeholder="اكتب كلمة أو عبارة" aria-label="كلمات البحث">
 <div class="row"><div><label>نوع البحث</label><select name="mode">${so("all","كل الكلمات",f.mode)}${so("any","أي كلمة",f.mode)}${so("phrase","عبارة كاملة",f.mode)}</select></div>
 <div><label>النطاق</label><select name="scope">${so("all","العناوين والنصوص",f.scope)}${so("meta","العناوين والمؤلفون فقط",f.scope)}${so("text","النصوص فقط",f.scope)}</select></div>
 <div><label>النوع</label><select name="k">${so("","كتب ومقالات",f.k)}${so("book","كتب فقط",f.k)}${so("article","مقالات فقط",f.k)}</select></div></div>
 <div class="row"><div><label>القسم</label><select name="c">${so("","الكل",f.c)}${so("dawah",COL.dawah,f.c)}${so("turath",COL.turath,f.c)}</select></div><div><label>المؤلف</label><select name="a">${opt(lib.authors,f.a,"كل المؤلفين")}</select></div><div><label>الموضوع</label><select name="t">${opt(lib.topics,f.t,"كل الموضوعات")}</select></div></div>
 <label class="inl"><input type="checkbox" name="ex" value="1"${f.ex==="1"?" checked":""}> مطابقة التشكيل والهمزات حرفيًا</label><br>${lib.books.some(b=>b.big)?`<label class="inl"><input type="checkbox" name="big" value="1"${f.big==="1"?" checked":""}> البحث في الموسوعات الكبيرة متعددة المجلدات أيضًا (أبطأ؛ أو اختر المؤلف)</label><br>`:""}
 <button class="btn p" style="margin-top:10px">ابحث</button></form><div id="sres"></div>`,true);
 if(!f.q.trim())return;
 const out=$("#sres"),n=f.ex==="1"?f.q.trim():norm(f.q).trim(),w=n.split(/\s+/).filter(Boolean),P=f.ex==="1"?(s=>s):(s=>norm(s));
 const m=t=>{const x=P(t);return f.mode==="phrase"?x.includes(n):f.mode==="any"?w.some(k=>x.includes(k)):w.every(k=>x.includes(k))};
 const books=lib.books.filter(b=>(!f.c||bc(b)===f.c)&&(!f.a||b.authorId===f.a)&&(!f.t||b.topicId===f.t)&&(!f.k||(b.type||"book")===f.k)&&(!b.big||f.a||f.big==="1"));
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
/* ---------- النسخة المصورة (PDF) ---------- */
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFDOCS=new Map();
async function pdfDoc(url){if(!window.pdfjsLib){await loadScript(PDFJS);window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS.replace("pdf.min.js","pdf.worker.min.js")}
 let d=PDFDOCS.get(url);if(!d){d=window.pdfjsLib.getDocument(url).promise;PDFDOCS.set(url,d)}return d}
function pdfPageFor(b,p){const off=+b.pdfOffset||0,m=b.pdfByLabel&&b.pl&&/(\d+)\s*$/.exec(b.pl[p-1]||"");return(m?+m[1]:p)+off}
async function renderPdf(b,p){const box=$("#pdfv");if(!box)return;box.innerHTML='<p class="mut" style="text-align:center;padding:30px 0">جارٍ تحميل الصفحة المصورة…</p>';
 try{const doc=await pdfDoc(b.pdf),n=pdfPageFor(b,p);if(!$("#pdfv"))return;if(n<1||n>doc.numPages){box.innerHTML='<p class="note">لا توجد صفحة مصورة مقابلة لهذه الصفحة.</p>';return}
  const pg=await doc.getPage(n),w=Math.max(280,box.clientWidth||600),vp0=pg.getViewport({scale:1}),sc=w/vp0.width*Math.min(2,window.devicePixelRatio||1),vp=pg.getViewport({scale:sc});
  const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;if(!$("#pdfv"))return;
  box.innerHTML="";box.appendChild(c);box.insertAdjacentHTML("beforeend",`<p class="mut pdfcap">صفحة ${toAr(n)} من ${toAr(doc.numPages)} في النسخة المصورة • <a href="${esc(b.pdf)}#page=${n}" target="_blank" rel="noopener">فتح الملف كاملًا</a></p>`)}
 catch(e){const el=$("#pdfv");if(el)el.innerHTML='<p class="note">تعذر تحميل النسخة المصورة. تحقق من الاتصال.</p>'}}
const PV_NAMES={text:"النص",pdf:"المصورة",both:"الاثنان"};
function nextPv(cur){const wide=matchMedia("(min-width:1000px)").matches;return cur==="text"?"pdf":cur==="pdf"&&wide?"both":"text"}

/* ---------- الإدارة المباشرة عبر GitHub ---------- */
const GH={repo:CFG.repo||"dawah-library/sdsl-library",branch:CFG.branch||"main",
 get token(){return ls.get("ghtoken","")},set token(v){ls.set("ghtoken",v||"")},
 get on(){return!!this.token},
 async api(path,opt={}){const r=await fetch("https://api.github.com/repos/"+this.repo+path,Object.assign({},opt,{headers:Object.assign({Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},opt.headers||{})}));
  if(!r.ok){let m="";try{m=(await r.json()).message}catch(e){}throw new Error(r.status===401?"المفتاح غير صالح أو منتهي.":r.status===403||r.status===404?"لا يملك المفتاح صلاحية الكتابة على المستودع.":r.status===409?"تعارض مع تعديل آخر، أعد المحاولة.":("خطأ "+r.status+" "+m))}return r},
 async verify(){const r=await this.api("");const j=await r.json();if(!j.permissions||!j.permissions.push)throw new Error("المفتاح لا يملك صلاحية الكتابة.");return j},
 async get(path){const r=await this.api("/contents/"+encodeURI(path)+"?ref="+this.branch);const j=await r.json();let text;
  if(j.encoding==="base64"&&j.content)text=new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g,"")),c=>c.charCodeAt(0)));
  else{const raw=await this.api("/contents/"+encodeURI(path)+"?ref="+this.branch,{headers:{Accept:"application/vnd.github.raw+json"}});text=await raw.text()}
  return{sha:j.sha,text}},
 async sha(path){try{const r=await this.api("/contents/"+encodeURI(path)+"?ref="+this.branch);return(await r.json()).sha}catch(e){return undefined}},
 b64(bytes){let s="";const CH=0x8000;for(let i=0;i<bytes.length;i+=CH)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));return btoa(s)},
 async put(path,data,msg,sha){const bytes=data instanceof Uint8Array?data:new TextEncoder().encode(data);if(sha===undefined)sha=await this.sha(path);
  const body={message:msg,content:this.b64(bytes),branch:this.branch};if(sha)body.sha=sha;
  return(await this.api("/contents/"+encodeURI(path),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})).json()},
 // يعدّل ملف JSON بأمان: يقرأ آخر نسخة ثم يطبق التعديل ثم يحفظ، ويعيد المحاولة عند التعارض
 async editJSON(path,fn,msg,compact){for(let t=0;t<3;t++){let cur;try{cur=await this.get(path)}catch(e){cur={sha:null,text:"null"}}
   const obj=fn(JSON.parse(cur.text));try{return await this.put(path,JSON.stringify(obj,null,compact?0:1),msg,cur.sha||null)}catch(e){if(!/تعارض/.test(e.message)||t===2)throw e}}}};
async function ghSaveBook(meta,pages,toc){const sh={id:meta.id,pages,toc:toc||[]};const s=JSON.stringify(sh);meta.n=pages.length;meta.size=s.length;meta.added=meta.added||today();
 await GH.put("data/books/"+meta.id+".json",s,"إضافة: "+meta.title);
 await GH.editJSON("data/catalog.json",c=>{c.books=c.books.filter(b=>b.id!==meta.id);c.books.push(meta);c.version=Date.now();return c},"فهرس: "+meta.title,true);
 SH.set(meta.id,sh);CAT.books=CAT.books.filter(b=>b.id!==meta.id).concat([meta]);merge();renderTicker()}
async function ghSaveAuthor(a){await GH.editJSON("data/catalog.json",c=>{if(!c.authors.some(x=>x.id===a.id))c.authors.push(a);return c},"مؤلف: "+a.name,true);if(!CAT.authors.some(x=>x.id===a.id))CAT.authors.push(a);merge()}
async function ghSavePage(b,i,text){
 if(b.f){const path="data/articles/"+b.f+".json";await GH.editJSON(path,g=>{g[b.id].pages[i]=text;return g},"تصحيح: "+b.title,true);const gg=await GROUPS.get(b.f);if(gg&&gg[b.id])gg[b.id].pages[i]=text}
 else{const path="data/books/"+b.id+".json";await GH.editJSON(path,sh=>{sh.pages[i]=text;return sh},"تصحيح ص "+(i+1)+": "+b.title,true)}
 b.pages[i]=text}

/* ---------- أدوات القراءة: الشريط الثابت واللوحات المنزلقة ---------- */
const IC={toc:'<path d="M4 6h16M4 12h16M4 18h10"/>',prev:'<path d="M9 6l6 6-6 6"/>',next:'<path d="M15 6l-6 6 6 6"/>',look:'<path d="M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M16 16h4"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',exit:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',pdf:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-4"/><circle cx="9.5" cy="8" r="1.3"/>'};
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
 const vols=b.set?lib.books.filter(x=>x.set===b.set).sort((x,y)=>x.vol-y.vol):[];
 openSheet("فهرس الكتاب",`${vols.length?`<div class="volbar"><b>المجلدات</b><div class="chips">${vols.map(x=>`<a class="chip${x.id===b.id?" x":""}" href="#/book/${x.id}/1" data-act="closeSheet">ج ${toAr(x.vol)}</a>`).join("")}</div></div>`:""}<input type="search" id="tocq" placeholder="ابحث في الفهرس" aria-label="ابحث في الفهرس"><div class="toclist" id="toclist">${(b.toc||[]).map(x=>`<a href="#/book/${b.id}/${x.p}" class="${x.t===ch?"on":""}" data-act="closeSheet">${esc(x.t)} <span class="mut">${esc(PL(b,x.p-1)||"ص "+x.p)}</span></a>`).join("")||'<p class="mut">لا يوجد فهرس لهذا الكتاب.</p>'}</div>`,
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
  ${S.admin||GH.on?'<button data-act="editp">تعديل النص</button>':'<button data-act="corr">اقتراح تصحيح</button>'}${isAdmin()?'<button data-act="bookmeta">بيانات الكتاب وقسمه</button>':""}
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
 let pv=b.pdf?(S.pv||"text"):"text";if(pv==="both"&&!matchMedia("(min-width:1000px)").matches)pv="pdf";
 const same=LASTREAD&&LASTREAD.id===id,dir=same?(p>LASTREAD.p?"slide-l":p<LASTREAD.p?"slide-r":""):"";LASTREAD={id,p};S.last={id,p};saveS();
 const a=A(b.authorId),label=PL(b,p-1),chap=chapterOf(b,p),fatwa=b.fa||/^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c||"");
 const head=art?"":`<div class="rhead"><h2>${esc(b.title)}</h2><div class="mut"><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}${died(a)}</a> • <a href="#/library?c=${bc(b)}&t=${b.topicId}">${esc(T(b.topicId).name)}</a> • ${COL[bc(b)]}</div>${b.demo?'<p class="note">هذا نص تجريبي يُستبدل بالنص المعتمد.</p>':""}</div>`;
 const ahead=art?`<div class="ahead"><h1>${esc(b.title)}</h1><div><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}</a>${b.date?" • "+fmtDate(b.date):""} • <a href="#/articles?t=${b.topicId}">${esc(T(b.topicId).name)}</a>${b.url?` • <a href="${esc(b.url)}" target="_blank" rel="noopener">المصدر</a>`:""}</div>${fatwa?'<div class="src-note">من فتاوى موقع صوت السلف</div>':""}</div>`:"";
 const B_=(act,ic,txt,dis)=>`<button data-act="${act}"${dis?" disabled":""}>${svg(ic)}<span>${txt}</span></button>`;
 view(`${head}
 <div class="desk"><article class="paper${art?" art":""} ${dir}" id="paper" aria-label="صفحة ${p}">
  ${art?ahead:`<div class="run"><span>${esc(b.title)}</span><span>${esc(chap)}</span></div>`}
  ${pv==="text"?`<div class="rd" id="rb" data-id="${id}" data-p="${p}">${pageHtml(b.pages[p-1],h)}</div>`:`<div class="pbody ${pv}"><div class="rd" id="rb" data-id="${id}" data-p="${p}"${pv==="pdf"?" hidden":""}>${pageHtml(b.pages[p-1],h)}</div><div class="pdfv" id="pdfv"></div></div>`}
  ${b.ocr?'<p class="mut ocrn">هذا النص محوَّل آليًا من النسخة المصورة وقد يحتوي أخطاء؛ قارنه بالمصورة عند النقل.</p>':""}
  ${n>1||!art?`<div class="foot">— ${toAr(p)} —${label?`<small>${esc(label)}${b.pl?" في المطبوع":""}</small>`:""}</div>`:""}
 </article></div>
 <p class="mut hint">${n>1?"اسحب الصفحة للتقليب • ":""}اضغط أي كلمة لمعناها • حدّد نصًا لتجعله قبسة</p>
 <nav class="rbar2" id="rbar" aria-label="أدوات القراءة">
  ${B_("toc","toc","الفهرس",!(b.toc&&b.toc.length))}
  ${B_("prev","prev","السابقة",p<=1)}
  <button data-act="goto" class="pgb"${n>1?"":" disabled"}><b>${toAr(p)}</b><span>من ${toAr(n)}</span></button>
  ${B_("next","next","التالية",p>=n)}
  ${B_("look","look","المظهر")}
  ${b.pdf?B_("pview","pdf",PV_NAMES[nextPv(pv)]):""}
  ${B_("more","more","المزيد")}
  ${B_("full",S.full?"exit":"full",S.full?"خروج":"ملء الشاشة")}
 </nav>`,same);
 document.body.classList.toggle("reading-full",!!S.full);
 if(pv!=="text")renderPdf(b,p);
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
function editDlg(){const rb=$("#rb"),b=B(rb.dataset.id),p=+rb.dataset.p;openDlg(`<h3>تعديل ${isArt(b)?"المقال":"الصفحة "+p}</h3><textarea id="et2" style="min-height:300px">${esc(b.pages[p-1])}</textarea><p class="mut">السطر الذي يبدأ بـ «# » يظهر عنوانًا. ${GH.on?"يُحفظ التعديل في المكتبة مباشرة ويظهر للجميع خلال دقيقة.":"يُحفظ التعديل على هذا الجهاز، ويدخل في «ملف التحديث» من صفحة الإدارة."}</p><button class="btn p" id="esv">حفظ التعديل</button> <span id="esst" class="mut"></span>`);
 $("#esv").onclick=async()=>{if(GH.on){const st=$("#esst");st.textContent="جارٍ الحفظ…";$("#esv").disabled=true;try{await ghSavePage(b,p-1,$("#et2").value);dlg().close();refreshPage();toast("حُفظ التصحيح، ويظهر للجميع بعد دقيقة.")}catch(e){st.textContent=e.message;$("#esv").disabled=false}return}const pages=b.pages.slice();pages[p-1]=$("#et2").value;LOCAL.shards[b.id]={id:b.id,pages,toc:b.toc||[],pl:b.pl};
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
 const[emb,logo]=await Promise.all([img("assets/logo-sdsl.png"),img("assets/logo.jpg")]);if(my!==drawing)return;
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
 c.font=`600 27px "IBM Plex Sans Arabic", sans-serif`;const tw=c.measureText(SITENAME).width,ph=100,pw=tw+ph+30,px=34,py=H-ph-34;
 c.fillStyle="rgba(255,255,255,.9)";c.beginPath();c.roundRect?c.roundRect(px,py,pw,ph,16):c.rect(px,py,pw,ph);c.fill();
 if(emb)c.drawImage(emb,px+pw-ph+6,py+6,ph-12,ph-12);c.fillStyle="#0a4a50";c.textAlign="right";c.fillText(SITENAME,px+pw-ph+2,py+ph/2+10);
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
  img("assets/logo-sdsl.png").then(emb=>{const c=b.querySelector("canvas").getContext("2d");c.scale(.2,.2);drawId(c,1080,1080,i,emb)})});
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
   try{try{await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0/dist/umd/supabase.js")}catch(e){await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js")}
    this.sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{flowType:"pkce",detectSessionInUrl:true,persistSession:true}});this.mode="cloud";
    const {data}=await this.sb.auth.getSession();this.set(data.session);
    this.sb.auth.onAuthStateChange((_e,s)=>{const was=this.user&&this.user.id;this.set(s);setTimeout(()=>{paintAuth();if((this.user&&this.user.id)!==was)Cloud.loadRole()},0)});await Cloud.loadRole();
    if(/[?&]code=/.test(location.search))history.replaceState(null,"",location.pathname+location.hash);
    const next=ls.get("authNext",null);if(this.user&&next){ls.set("authNext",null);location.hash=next}
   }catch(e){console.warn("supabase",e);this.loadErr=String(e&&e.message||e||"")}
  }else this.user=ls.get("acct",null);
  paintAuth()},
 // يعرض أزرار Google وApple فقط إذا فُعّل مزوّدها في Supabase
 providers(){return this._pv||(this._pv=fetch(CFG.supabaseUrl+"/auth/v1/settings",{headers:{apikey:CFG.supabaseAnonKey}}).then(r=>r.ok?r.json():{}).then(j=>j.external||{}).catch(()=>({}))) },
 set(s){this.user=s&&s.user?{id:s.user.id,email:s.user.email,name:(s.user.user_metadata||{}).full_name||(s.user.user_metadata||{}).name||s.user.email}:null;this.token=s?s.access_token:null},
 async oauth(provider,next){if(this.mode!=="cloud")throw new Error("الدخول بحساب "+(provider==="google"?"Google":"Apple")+" يعمل بعد ربط الموقع بقاعدة بيانات الحسابات.");
  ls.set("authNext",next||"#/ask");const {error}=await this.sb.auth.signInWithOAuth({provider,options:{redirectTo:location.origin+location.pathname}});if(error)throw error},
 async signUp(name,email,pw){
  if(this.mode==="cloud"){const {data,error}=await this.sb.auth.signUp({email,password:pw,options:{data:{name,full_name:name}}});if(error)throw error;if(data.session)this.set(data.session);return data.session?"ok":"confirm"}
  this.user={id:"local:"+email.toLowerCase(),name,email};ls.set("acct",this.user);return "ok"},
 async signIn(email,pw){
  if(this.mode==="cloud"){const {data,error}=await this.sb.auth.signInWithPassword({email,password:pw});if(error)throw error;this.set(data.session);Cloud.loadRole();return}
  const known=ls.get("acct_known",{})[email.toLowerCase()]||{id:"local:"+email.toLowerCase(),name:email.split("@")[0],email};
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
 ${cloud?`<div id="oauthw"></div>`:'<p class="note" style="margin:10px 0">أنشئ حسابك بالاسم والبريد فقط، ويعمل فورًا. (الدخول بحساب Google وApple يُفعَّل قريبًا.)</p>'}
 <form data-form="${signup?"signup":"signin"}" data-next="${esc(back)}">${signup?'<label>الاسم</label><input name="name" required autocomplete="name">':""}
 <label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email">
 ${cloud?`<label>كلمة المرور</label><input name="pw" type="password" minlength="8" required autocomplete="${signup?"new-password":"current-password"}">`:""}
 <button class="btn p" style="margin-top:12px">${signup?"إنشاء الحساب":"دخول"}</button></form><p id="aerr" role="alert"></p>${CFG.supabaseUrl&&!cloud?`<p class="note">تعذر تحميل خدمة الحسابات${Auth.loadErr?" ("+esc(Auth.loadErr)+")":""}، فيعمل الحساب على هذا الجهاز فقط. أعد تحميل الصفحة بعد قليل.</p>`:""}
 <p>${signup?`لديك حساب؟ <a href="#/account?next=${encodeURIComponent(back)}">سجّل الدخول</a>`:`ليس لديك حساب؟ <a href="#/account?m=signup&next=${encodeURIComponent(back)}">أنشئ حسابًا مجانيًا</a>`}</p>
 ${cloud?"":'<p class="note">وضع تجريبي: لم تُربط قاعدة الحسابات بعد، فيُحفظ الحساب على هذا الجهاز فقط ودون كلمة مرور.</p>'}`);
 if(cloud)Auth.providers().then(p=>{const w=$("#oauthw");if(!w||!(p.google||p.apple))return;
  w.innerHTML=`<div class="oauth">${p.google?`<button data-oauth="google">${GICON} المتابعة بحساب Google</button>`:""}${p.apple?'<button class="apple" data-oauth="apple">المتابعة بحساب Apple</button>':""}</div><div class="or">أو بالبريد الإلكتروني</div>`;
  $$("[data-oauth]").forEach(b=>b.onclick=async()=>{try{await Auth.oauth(b.dataset.oauth,back)}catch(e){$("#aerr").textContent=e.message}})})}
const AUTHERR=[[/invalid login credentials/i,"البريد أو كلمة المرور غير صحيحة. إن لم يكن لك حساب بعد فاضغط «أنشئ حسابًا مجانيًا»."],[/email not confirmed/i,"لم يُؤكَّد بريدك بعد؛ افتح رسالة التأكيد في بريدك ثم سجّل الدخول."],[/already registered|already exists/i,"هذا البريد مسجّل من قبل؛ سجّل الدخول به."],[/password should be at least|weak password/i,"كلمة المرور قصيرة؛ اجعلها 8 أحرف على الأقل."],[/rate limit|too many/i,"محاولات كثيرة؛ انتظر دقيقة ثم أعد المحاولة."],[/invalid.*email|email.*invalid/i,"صيغة البريد غير صحيحة."],[/failed to fetch|network/i,"تعذر الاتصال بخادم الحسابات؛ تأكد من الإنترنت."]];
const authMsg=e=>{const m=String((e&&(e.message||e.error_description))||e||"");const t=AUTHERR.find(([r])=>r.test(m));return t?t[1]:(m?"تعذر الدخول: "+m:"تعذر الدخول")};
async function authSubmit(f,kind){const fd=new FormData(f),err=$("#aerr"),btn=f.querySelector("button"),old=btn.textContent;err.textContent="";btn.disabled=true;btn.textContent=kind==="signup"?"جارٍ إنشاء الحساب…":"جارٍ الدخول…";
 const slow=setTimeout(()=>{err.textContent="الخادم بطيء في الرد… انتظر قليلًا."},12000);
 try{if(kind==="signup"){const r=await Auth.signUp(String(fd.get("name")).trim(),String(fd.get("email")).trim(),fd.get("pw")||"");if(r==="confirm"){err.textContent="أرسلنا رابط تأكيد إلى بريدك، افتحه ثم سجّل الدخول.";return}}
  else await Auth.signIn(String(fd.get("email")).trim(),fd.get("pw")||"");paintAuth();toast("أهلًا "+((Auth.user&&Auth.user.name)||"")+"، تم الدخول");location.hash=f.dataset.next||"#/ask"}
 catch(e){console.warn(e);err.textContent=authMsg(e);err.scrollIntoView({block:"center",behavior:"smooth"})}finally{clearTimeout(slow);btn.disabled=false;btn.textContent=old}}

/* ---------- اسأل المكتبة ---------- */
const AI={s:undefined,
 async sample(){if(this.s!==undefined)return this.s;try{this.s=window.claude&&window.claude.use?await window.claude.use("sample"):null}catch(e){this.s=null}return this.s},
 scopeLine(o){return o.bookId?"\nنطاق البحث: كتاب واحد معرفه "+o.bookId+" ("+((B(o.bookId)||{}).title||"")+").":o.col?"\nنطاق البحث: "+(o.col==="turath"?"كتب التراث فقط.":"كتب مشايخ الدعوة السلفية ومقالاتهم فقط."):""},
 async ask(o){const s=await this.sample();if(s)return this.viaSample(s,o);
  try{return await this.viaServer(o)}catch(e){if(e&&(e.code==="nokey"||e.code==="quota"||e.code==="fallback"))return this.viaLocal(o,e.code,e.reason);throw e}},
 // البحث المجاني: يعمل في المتصفح دون أي خادم أو تكلفة، ويعرض نصوص المكتبة المطابقة مرتبة بالكتب
 async viaLocal(o,why,reason){o.onStatus("يبحث في نصوص المكتبة…");await this.ensure(o);
  const q=o.turns[o.turns.length-1].content.split("\n\nالنص المطلوب")[0].replace(/^(اكتب بحثًا علميًا عن|قارن بين الأقوال في مسألة|اجمع ما ورد في المكتبة عن|لخّص كتاب|اشرح هذا النص|أريد أن أناقش|ضع لي منهجًا لدراسة|اختبرني في|عندي مشكلة)\s*:?/,"");
  const wide=/research|gather|compare|summarize/.test(o.mode),hits=SS.search(lib,q,{col:o.col,bookId:o.bookId,k:wide?24:12,max:wide?600:800});o.searches=[q.trim()];
  const head=why==="fallback"?`تعذر الوصول إلى المساعد الذكي الآن${reason?" — "+reason:""}، فهذه نتائج **البحث المباشر** في نصوص المكتبة:`:why==="quota"?"نفدت الحصة المجانية للمساعد الذكي مؤقتًا، فهذه نتائج **البحث المباشر** في نصوص المكتبة:":"هذه نتائج **البحث المجاني** في نصوص المكتبة (دون ذكاء اصطناعي)، مرتبة حسب الكتب:";
  let t;if(!hits.length)t=`لم أجد في نصوص المكتبة ما يطابق «${q.trim()}». جرّب كلمات أقل أو مرادفات أو لفظ الحديث نفسه.`;
  else{const g=new Map();hits.forEach(h=>{const k=h.book+" — "+h.author;if(!g.has(k))g.set(k,[]);g.get(k).push(h)});
   t=head+`\n\nوُجد ${toAr(hits.length)} موضعًا في ${toAr(g.size)} ${g.size>2&&g.size<11?"مصادر":"مصدرًا"}.\n`+[...g].map(([k,l])=>`\n## ${k}\n`+l.map(h=>`- «${h.text.replace(/\s+/g," ").trim()}» [[${h.ref}]]`).join("\n")).join("\n")}
  const w=q.trim().split(/\s+/).slice(0,5).join(" ");
  t+=`\n\n## للمتابعة\n- اجمع ما ورد في المكتبة عن ${w}\n- ${o.col==="turath"?"ابحث في كتب الدعوة عن "+w:"ابحث في كتب التراث عن "+w}`;
  o.onText(t);return t},
 async ensure(o){const need=lib.books.filter(b=>!b.demo&&(!o.col||bc(b)===o.col)&&(o.bookId?b.id===o.bookId:!b.big));await loadMany(need,(i,n)=>o.onStatus(`يحمّل نصوص المكتبة للبحث (${toAr(i)} من ${toAr(n)})`))},
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
  catch(e){if(e.name==="AbortError")throw{code:"cancelled"};throw{code:"offline",message:"تعذر الوصول إلى خادم المساعد. تأكد من الاتصال بالإنترنت."}}
  if(!r.ok||!/ndjson/.test(r.headers.get("content-type")||"")){let j={};try{j=await r.json()}catch(e){}
   if(j.code==="no_key"||r.status===404||r.status===405||r.status===501)throw{code:"nokey"};
   if(!r.ok)throw{code:"server",message:j.error||(r.status===404?"خدمة المساعد لم تُفعَّل على هذا الخادم بعد.":"تعذرت الإجابة، حاول لاحقًا.")};o.onText(j.text||"");o.searches=j.searches;return j.text||""}
  // بث الإجابة: يصل النص أولًا بأول مع خطوات البحث
  const rd=r.body.getReader(),dec=new TextDecoder();let buf="",acc="",err=null;
  try{for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let nl;
   while((nl=buf.indexOf("\n"))>=0){const line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);if(!line)continue;let ev;try{ev=JSON.parse(line)}catch(e){continue}
    if(ev.t==="text"){acc+=ev.v;o.onText(acc)}else if(ev.t==="reset"){if(acc.trim())o.onStatus(acc.trim().split("\n").pop().slice(0,140));acc=""}
    else if(ev.t==="status")o.onStatus(ev.v);else if(ev.t==="done")o.searches=ev.searches||[];else if(ev.t==="error"){err=ev.v;if(!acc.trim())throw{code:ev.code==="quota"?"quota":"fallback",reason:ev.v+(ev.detail?" ("+ev.detail+")":"")}}}}}
  catch(e){if(e&&(e.code==="quota"||e.code==="fallback"))throw e;if(e.name==="AbortError"){if(acc)throw{text:acc};throw{code:"cancelled"}}if(acc)throw{text:acc};throw{code:"offline",message:"انقطع الاتصال أثناء الإجابة."}}
  if(err){if(acc)throw{text:acc};throw{code:"server",message:err}}return acc}};
const AIERR={not_granted:"لم يُسمح لهذه الصفحة باستخدام الذكاء الاصطناعي.",sampling_disabled:"الذكاء الاصطناعي غير متاح لهذا الحساب.",rate_limited:"كثرت الأسئلة، انتظر قليلًا ثم أعد المحاولة.",refused:"تعذرت الإجابة عن هذا السؤال، أعد صياغته.",prompt_too_large:"المحادثة طويلة، ابدأ محادثة جديدة.",session_expired:"انتهت الجلسة، سجّل الدخول من جديد."};
function md(t){const lines=esc(t).split("\n");let h="",inList=false;
 const inline=x=>x.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\[\[([^\]\s]+?):(\d+)\]\]/g,(m,id,p)=>{const b=B(id);if(!b||+p<1||(b.n&&+p>b.n))return'<span class="mut">[مرجع غير موجود]</span>';return`<a class="cite" href="#/book/${id}/${p}">(${esc(b.title)}${PL(b,+p-1)?"، "+esc(PL(b,+p-1)):""})</a>`});
 for(const l of lines){const li=/^\s*[-*•]\s+(.*)/.exec(l)||/^\s*\d+[.)-]\s+(.*)/.exec(l);
  if(li){if(!inList){h+="<ul>";inList=true}h+="<li>"+inline(li[1])+"</li>";continue}
  if(inList){h+="</ul>";inList=false}
  if(/^\s*\|.*\|\s*$/.test(l)){if(/^\s*\|[\s:|-]+\|\s*$/.test(l))continue;const cells=l.trim().slice(1,-1).split("|").map(c=>inline(c.trim()));if(!h.endsWith("</tr>"))h+='<div class="tblw"><table>';h+="<tr>"+cells.map(c=>"<td>"+c+"</td>").join("")+"</tr>";continue}
  if(h.endsWith("</tr>"))h+="</table></div>";const hd=/^#{1,4}\s+(.*)/.exec(l);if(hd){h+="<h3>"+inline(hd[1])+"</h3>";continue}
  if(l.trim())h+="<p>"+inline(l)+"</p>"}
 return h+(inList?"</ul>":"")+(h.endsWith("</tr>")?"</table></div>":"")}
let CONV=null,ASKCTL=null;
const newConv=()=>({id:"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:"",mode:"ask",col:"",bookId:"",messages:[]});
const AISVC=[
 ["ask","سؤال موثّق","إجابة مركزة من نصوص المكتبة مع الإحالة إلى الكتاب والصفحة.","",'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'],
 ["research","بحث علمي","بحث منظم: مقدمة ومسائل وأدلة ونقول موثقة وخلاصة ومراجع.","اكتب بحثًا علميًا عن: ",'<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>'],
 ["compare","دراسة تحليلية مقارنة","يحرر المسألة ويوازن بين الأقوال وأدلتها ويبيّن الراجح.","قارن بين الأقوال في مسألة: ",'<path d="M12 3v18M5 7h4l-2 6H3zM19 7h-4l2 6h4z"/>'],
 ["gather","جامع النصوص","يجمع كل ما في المكتبة عن موضوع، مصنفًا تحت عناوين.","اجمع ما ورد في المكتبة عن: ",'<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>'],
 ["summarize","تلخيص كتاب","نبذة وتلخيص للأبواب وأهم المسائل والفوائد بالصفحات.","لخّص كتاب: ",'<path d="M4 5h16M4 10h10M4 15h16M4 20h8"/>'],
 ["explain","شرح نص","الصق نصًا أو افتح صفحة من القارئ، فيشرح ألفاظه ومعناه وفوائده.","اشرح هذا النص: ",'<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M9 7h6M9 11h4"/>'],
 ["discuss","مناقشة وحوار","يناقشك في مسألة أو إشكال بالحجة والدليل خطوة بخطوة.","أريد أن أناقش: ",'<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>'],
 ["plan","منهج تعلّم","خطة قراءة متدرجة من كتب المكتبة حسب مستواك ووقتك.","ضع لي منهجًا لدراسة ",'<path d="M4 20h16M6 16l4-5 3 3 5-7"/>'],
 ["quiz","اختبر فهمك","أسئلة متنوعة من كتاب أو موضوع مع الإجابات وتعليلها.","اختبرني في ",'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 8h3M14 14h3"/>'],
 ["solve","حلول عملية","يعرض مشكلتك على توجيهات العلماء ويقترح خطوات عملية (ليست فتوى).","عندي مشكلة: ",'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>']];
const AIEX=["ما شروط التوبة؟","اجمع ما ورد في المكتبة عن علو الهمة","قارن بين أقوال العلماء في حكم تارك الصلاة","ضع لي منهجًا لدراسة العقيدة وأنا مبتدئ","لخّص كتاب رياض الصالحين","كيف أنظّم وقتي لطلب العلم مع العمل؟"];
const AISTEPS=["يفهم السؤال ويخطط للبحث…","يبحث في الكتب والمقالات…","يقرأ سياق النصوص…","يوازن بين النصوص ويحلّلها…","يرتّب الإجابة ويوثّقها…"];
const svcIcon=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
function aiStats(){const books=lib.books.filter(b=>!b.demo),arts=books.filter(isArt).length;return`${toAr(books.length-arts)} كتابًا • ${toAr(arts)} مقالًا وفتوى وبيانًا • ${toAr(new Set(books.map(b=>b.authorId)).size)} مؤلفًا`}
async function vAsk(q){
 if(q.id&&Auth.user){try{CONV=(await Chats.get(q.id))||newConv()}catch(e){CONV=newConv()}}else if(!CONV||q.new||q.b||q.q||q.a||q.m)CONV=newConv();
 if(q.m&&SS.MODES[q.m])CONV.mode=q.m;
 let pre="";if(q.b&&B(q.b)){CONV.mode="explain";CONV.bookId=q.b;CONV.ctx={b:q.b,p:+q.p||1};pre=isArt(B(q.b))?"اشرح هذا المقال ولخّص أهم مسائله":"اشرح هذه الصفحة"}else if(q.q)pre=q.q;else if(q.a)pre=`ما أهم الموضوعات في كتب ${A(q.a).name}؟`;
 const so=(v,l,c)=>`<option value="${v}"${c===v?" selected":""}>${l}</option>`,cb=CONV.bookId&&B(CONV.bookId),fresh=!CONV.messages.length;
 let recent="";if(fresh&&Auth.user){try{const l=(await Chats.list()).slice(0,4);if(l.length)recent=`<h3 class="aih">محادثاتك الأخيرة</h3><div class="airecent">${l.map(c=>`<a href="#/ask?id=${encodeURIComponent(c.id)}"><b>${esc(c.title||"محادثة")}</b><span>${esc(ago(c.updated_at))}</span></a>`).join("")}</div>`}catch(e){}}
 if(parse().p[0]!=="ask"&&parse().p[0]!=="ai")return;
 view(`<div class="aiwrap${fresh?" fresh":""}">
 <section class="aihero" id="aihub"${fresh?"":" hidden"}><div class="orb" aria-hidden="true"><i></i><i></i><i></i></div>
  <h2>المساعد العلمي</h2><p>نموذج ذكاء اصطناعي مرجعه كتب المكتبة ومقالاتها وفتاواها: يبحث ويجمع ويحلّل ويناقش ويقترح الحلول، ويوثّق كل نقل بالكتاب والصفحة.</p><span class="aistat">${aiStats()}</span></section>
 <div id="aisvcw"${fresh?"":" hidden"}><h3 class="aih">الخدمات</h3><div class="aisvc">${AISVC.map(([m,t,d,,ic])=>`<button data-act="aisvc" data-m="${m}" aria-pressed="${CONV.mode===m}"><span class="ic">${svcIcon(ic)}</span><b>${t}</b><small>${d}</small></button>`).join("")}</div>
  <h3 class="aih">جرّب أن تسأل</h3><div class="aiex">${AIEX.map(t=>`<button data-act="aiex">${esc(t)}</button>`).join("")}</div>${recent}</div>
 ${fresh?"":`<div class="askhead"><h2>المساعد العلمي</h2><div class="row" style="flex:none"><a class="btn s nf" href="#/ask?new=1">محادثة جديدة</a>${Auth.user?'<a class="btn s nf" href="#/account">محادثاتي</a>':""}</div></div>`}
 ${CONV.ctx&&B(CONV.ctx.b)?`<p class="note">النص المرفق: ${esc(B(CONV.ctx.b).title)}${B(CONV.ctx.b).n>1?"، صفحة "+CONV.ctx.p:""}</p>`:""}
 <div id="msgs" aria-live="polite"></div>
 <form data-form="ask" class="askbox"><div class="aiopts"><select id="am" aria-label="نوع الخدمة">${AISVC.map(([m,t])=>so(m,t,CONV.mode)).join("")}</select>
  <select id="ac" aria-label="نطاق البحث">${so("","كل المكتبة",CONV.bookId?"x":CONV.col)}${so("dawah",COL.dawah+" والمقالات",CONV.bookId?"x":CONV.col)}${so("turath",COL.turath,CONV.bookId?"x":CONV.col)}${cb?`<option value="book:${cb.id}" selected>${isArt(cb)?"هذا المقال":"هذا الكتاب"}: ${esc(cb.title)}</option>`:""}<option value="pick">اختيار كتاب…</option></select></div>
  <div class="aiin"><textarea name="m" rows="2" placeholder="اسأل، أو اطلب بحثًا أو دراسة أو خطة…" aria-label="رسالتك">${esc(pre)}</textarea><button class="aisend" id="asend" aria-label="إرسال">${svcIcon('<path d="M20 12H5M11 6l-6 6 6 6"/>')}</button><button type="button" class="aisend stop" id="astop" hidden aria-label="إيقاف">${svcIcon('<rect x="7" y="7" width="10" height="10" rx="1.5"/>')}</button></div>
  <span id="ast" class="mut aist"></span></form>
 <p class="mut aidisc">إجابات المساعد آلية وقد تخطئ، فراجع المراجع المحال إليها، وليست فتوى. ${Auth.user?"":'المساعد متاح للأعضاء: <a href="#/account?m=signup&next=%23%2Fask">أنشئ حسابًا مجانيًا</a>.'}</p></div>`);
 CONV.messages.forEach(m=>addMsg(m));
 const ta=$("[name=m]");ta.addEventListener("input",()=>{ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,220)+"px"});
 ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&matchMedia("(pointer:fine)").matches){e.preventDefault();ta.form.requestSubmit()}});
 $("#am").onchange=e=>{CONV.mode=e.target.value;$$("[data-act=aisvc]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===CONV.mode))};
 $("#ac").onchange=e=>{const v=e.target.value;if(v==="pick"){e.target.value=CONV.bookId?"book:"+CONV.bookId:CONV.col;return pickBook()}if(v.startsWith("book:")){CONV.bookId=v.slice(5);CONV.col=""}else{CONV.bookId="";CONV.col=v}};
 $("#astop").onclick=()=>ASKCTL&&ASKCTL.abort();if(!fresh)$("#msgs").lastElementChild&&window.scrollTo(0,document.body.scrollHeight)}
function pickBook(){const all=lib.books.filter(b=>!b.demo&&!isArt(b)).sort((x,y)=>x.title.localeCompare(y.title,"ar"));
 openSheet("اختر كتابًا",`<input id="pbq" type="search" placeholder="ابحث بالعنوان أو المؤلف"><div id="pbl" class="pbl"></div>`,()=>{const draw=()=>{const w=norm($("#pbq").value).split(/\s+/).filter(Boolean);$("#pbl").innerHTML=all.filter(b=>w.every(k=>norm(b.title+" "+A(b.authorId).name).includes(k))).slice(0,60).map(b=>`<button data-act="aipick" data-id="${b.id}"><b>${esc(b.title)}</b><span>${esc(A(b.authorId).name)}</span></button>`).join("")||'<p class="mut">لا نتائج.</p>'};$("#pbq").oninput=draw;draw()})}
function setBookScope(id){const b=B(id);if(!b)return;CONV.bookId=id;CONV.col="";const s=$("#ac");if(!s)return;let o=s.querySelector('option[value^="book:"]');if(!o){o=document.createElement("option");s.insertBefore(o,s.lastElementChild)}o.value="book:"+id;o.textContent=(isArt(b)?"هذا المقال":"الكتاب")+": "+b.title;s.value=o.value}
function aiSplit(t){const m=/\n#{1,4}\s*للمتابعة\s*\n([\s\S]*)$/.exec(t||"");if(!m)return{body:t,follow:[]};return{body:t.slice(0,m.index),follow:m[1].split("\n").map(l=>l.replace(/^\s*[-*•\d.)]+\s*/,"").trim()).filter(l=>l.length>3).slice(0,4)}}
function addMsg(m){const d=document.createElement("div");d.className="msg "+(m.role==="user"?"u":"a");
 if(m.role==="user")d.textContent=m.display||m.content;else fillAnswer(d,m);
 const box=$("#msgs");box.appendChild(d);return d}
function fillAnswer(d,m){const {body,follow}=aiSplit(m.content);d.innerHTML=md(body)+(m.searches&&m.searches.length?`<details class="srch"><summary>بحث في المكتبة ${toAr(m.searches.length)} مرة</summary>${m.searches.map(s=>`<span>${esc(s)}</span>`).join("")}</details>`:"")+(follow.length?`<div class="aifollow">${follow.map(f=>`<button data-act="aifollow">${esc(f)}</button>`).join("")}</div>`:"");
 const bar=document.createElement("div");bar.className="mact";const c=document.createElement("button");c.className="btn s";c.textContent="نسخ";
 c.onclick=async()=>{try{await navigator.clipboard.writeText(body.replace(/\[\[([^\]\s]+?):(\d+)\]\]/g,(x,id,p)=>{const b=B(id);return b?`(${b.title}${PL(b,+p-1)?"، "+PL(b,+p-1):""})`:""})+"\n— "+SITENAME);c.textContent="تم النسخ"}catch(e){}};
 const q=document.createElement("button");q.className="btn s";q.textContent="صمّم قبسة";q.onclick=()=>{const t=plain(body.replace(/\[\[[^\]]+\]\]/g,"").replace(/^#+\s*/gm,"").replace(/\*\*/g,"")).trim();pendingQ={t:t.length>600?t.slice(0,600)+"…":t,src:"المساعد العلمي — "+SITENAME};location.hash="#/qabasat"};
 bar.append(c,q);d.appendChild(bar)}
async function askSubmit(f){const ta=f.querySelector("[name=m]"),text=ta.value.trim();if(!text||ASKCTL)return;
 if(!Auth.user)return needLogin("المساعد العلمي متاح لأعضاء المكتبة مجانًا. أنشئ حسابك أو سجّل الدخول، ثم اسأل ما شئت.");
 ["aihub","aisvcw"].forEach(id=>{const e=$("#"+id);if(e)e.hidden=true});const w=$(".aiwrap");if(w)w.classList.remove("fresh");
 let content=text;if(CONV.ctx&&!CONV.messages.length){try{const b=await loadBook(CONV.ctx.b),i=CONV.ctx.p-1;content+=`\n\nالنص المطلوب (المرجع [[${b.id}:${i+1}]] — ${b.title}${PL(b,i)?"، "+PL(b,i):""}):\n«${plain(b.pages[i]).slice(0,6000)}»`}catch(e){}}
 const um={role:"user",content,display:text};CONV.messages.push(um);addMsg(um);ta.value="";ta.style.height="";if(!CONV.title)CONV.title=text.slice(0,70);
 const out=addMsg({role:"assistant",content:""});out.innerHTML=`<div class="think"><span class="dots"><i></i><i></i><i></i></span><span class="tl">${AISTEPS[0]}</span></div>`;out.scrollIntoView({behavior:"smooth",block:"center"});
 const st=$("#ast"),stop=$("#astop"),send=$("#asend");ASKCTL=new AbortController();stop.hidden=false;send.hidden=true;st.textContent="";
 let k=0,live=false;const tick=setInterval(()=>{const tl=out.querySelector(".tl");if(tl&&k<AISTEPS.length-1)tl.textContent=AISTEPS[++k]},4000);
 const status=t=>{const tl=out.querySelector(".tl");if(tl)tl.textContent=t;else st.textContent=t};
 const turns=CONV.messages.slice(-10).map(m=>({role:m.role,content:m.content}));while(turns.length&&turns[0].role!=="user")turns.shift();
 const o={turns,mode:CONV.mode,col:CONV.col,bookId:CONV.bookId,signal:ASKCTL.signal,onStatus:status,
  onText:t=>{if(!t.trim())return;live=true;clearInterval(tick);st.textContent="";out.innerHTML=md(aiSplit(t).body)+'<span class="caret"></span>'}};
 try{const ans=await AI.ask(o);const am={role:"assistant",content:ans||"لم تصل إجابة، أعد المحاولة.",searches:o.searches||[]};CONV.messages.push(am);out.classList.add("done");fillAnswer(out,am);await Chats.save(CONV)}
 catch(e){const part=e&&e.text;if(part){const am={role:"assistant",content:part+"\n\n(انقطعت الإجابة)"};CONV.messages.push(am);fillAnswer(out,am)}
  else if(e&&e.code==="cancelled")out.innerHTML='<span class="mut">أُوقفت الإجابة.</span>';
  else out.innerHTML=`<span class="mut">${esc((e&&(AIERR[e.code]||e.message))||"تعذرت الإجابة، حاول مرة أخرى.")}</span>`}
 finally{clearInterval(tick);ASKCTL=null;stop.hidden=true;send.hidden=false;st.textContent=""}}

/* ---------- إدارة البنية: أسماء الأقسام والتقسيم الموضوعي والمؤلفون وبيانات الكتب ---------- */
const NAVDEF=[...document.querySelectorAll("header nav a")].map(a=>[a.getAttribute("href"),a.textContent]);
function applyLabels(){const L=CAT.labels||{};if(L.col_dawah)COL.dawah=L.col_dawah;if(L.col_turath)COL.turath=L.col_turath;
 $$("header nav a").forEach(a=>{const k="nav:"+a.getAttribute("href");if(L[k])a.textContent=L[k]});
 const adm=$('header nav a[href="#/admin"]');if(adm)adm.style.display=(GH.on||Cloud.staff()||S.admin)?"":"none"}
const isAdmin=()=>GH.on||Cloud.staff();
const needGH=()=>GH.on?"":`<p class="note">الحفظ للجميع يحتاج تفعيل «الإدارة المباشرة» على هذا الجهاز (مفتاح المشرف أعلى الصفحة).</p>`;
const tCount=id=>lib.books.filter(b=>b.topicId===id&&!VOL2(b)).length;
function topicRows(list,kind){return list.map(t=>{const n=tCount(t.id);return`<div class="trow" data-id="${esc(t.id)}" data-kind="${kind}"><input class="tn" value="${esc(t.name)}" aria-label="اسم القسم">${kind==="articles"?`<input class="tp" value="${esc(t.parent||"")}" placeholder="القسم الأعلى (اختياري)" aria-label="القسم الأعلى">`:""}<span class="mut tc">${toAr(n)}</span><button type="button" class="btn s" data-act="tup" aria-label="أعلى">▲</button><button type="button" class="btn s" data-act="tdown" aria-label="أسفل">▼</button><button type="button" class="btn s" data-act="tdel"${n?' disabled title="انقل ما فيه أولًا"':""}>حذف</button></div>`}).join("")}
function structBody(){const L=CAT.labels||{};
 return`${needGH()}<form data-form="struct">
 <h3>الأقسام الرئيسية</h3><div class="row"><div><label>اسم مكتبة الدعوة</label><input name="col_dawah" value="${esc(COL.dawah)}"></div><div><label>اسم مكتبة التراث</label><input name="col_turath" value="${esc(COL.turath)}"></div></div>
 <details><summary>أسماء روابط القائمة العليا</summary><div class="navl">${NAVDEF.map(([h,t])=>`<label>${esc(t)}</label><input name="nav:${esc(h)}" value="${esc(L["nav:"+h]||t)}">`).join("")}</div></details>
 <h3>التقسيم الموضوعي للكتب</h3><p class="mut">غيّر الأسماء، ورتّبها بالأسهم، واحذف الفارغ منها. الرقم عدد الكتب في القسم.</p>
 <div class="tlist" id="tl-books">${topicRows(lib.topics.filter(t=>t.for!=="articles"),"books")}</div><button type="button" class="btn s" data-act="tadd" data-kind="books">+ قسم جديد للكتب</button>
 <h3>تصنيفات المقالات والفتاوى</h3>
 <div class="tlist" id="tl-articles">${topicRows(lib.topics.filter(t=>t.for==="articles"),"articles")}</div><button type="button" class="btn s" data-act="tadd" data-kind="articles">+ تصنيف جديد للمقالات</button>
 <div class="savebar"><button class="btn p">حفظ الأقسام والأسماء</button><span id="structst" class="mut" role="status"></span></div></form>
 <h3>المؤلفون</h3><form data-form="authedit"><label>اختر المؤلف</label><select name="id" id="aesel"><option value="">— اختر —</option>${[...lib.authors].sort((x,y)=>x.name.localeCompare(y.name,"ar")).map(a=>`<option value="${a.id}">${esc(a.name)} (${a.col==="turath"?"تراث":"الدعوة"})</option>`).join("")}</select>
 <div id="aefields" hidden><div class="row"><div><label>الاسم</label><input name="name"></div><div><label>سنة الوفاة (هـ، للمتوفين)</label><input name="died" type="number"></div><div><label>القسم</label><select name="col"><option value="dawah">${esc(COL.dawah)}</option><option value="turath">${esc(COL.turath)}</option></select></div></div>
 <label>نبذة مختصرة</label><textarea name="bio" style="min-height:90px"></textarea><button class="btn p" style="margin-top:8px">حفظ بيانات المؤلف</button> <span id="aest" class="mut"></span></div></form>`}
function wireStruct(){const sel=$("#aesel");if(!sel)return;sel.onchange=()=>{const a=lib.authors.find(x=>x.id===sel.value),f=sel.form,box=$("#aefields");box.hidden=!a;if(!a)return;f.name.value=a.name;f.died.value=a.died||"";f.col.value=a.col||"dawah";f.bio.value=a.bio||""}}
async function saveStruct(f){const st=$("#structst"),btn=f.querySelector(".savebar .btn");if(!GH.on){st.textContent="فعّل الإدارة المباشرة أولًا.";return}
 const fd=new FormData(f),labels={};["col_dawah","col_turath"].forEach(k=>{const v=String(fd.get(k)||"").trim();if(v)labels[k]=v});
 NAVDEF.forEach(([h,t])=>{const v=String(fd.get("nav:"+h)||"").trim();if(v&&v!==t)labels["nav:"+h]=v});
 const rows=kind=>[...$$("#tl-"+kind+" .trow")].map(r=>({id:r.dataset.id,name:r.querySelector(".tn").value.trim(),parent:r.querySelector(".tp")?r.querySelector(".tp").value.trim():undefined})).filter(x=>x.name);
 const B=rows("books"),Ar=rows("articles");btn.disabled=true;st.textContent="جارٍ الحفظ…";
 const apply=c=>{const old=new Map((c.topics||[]).map(t=>[t.id,t]));const mk=(x,kind)=>{const t=Object.assign({},old.get(x.id)||{id:x.id,for:kind},{name:x.name});if(kind==="articles"){if(x.parent)t.parent=x.parent;else delete t.parent}return t};
  c.topics=B.map(x=>mk(x,"books")).concat(Ar.map(x=>mk(x,"articles")));c.labels=Object.assign({},c.labels||{},labels);
  Object.keys(c.labels).forEach(k=>{if(k.startsWith("nav:")&&!labels[k])delete c.labels[k]});c.version=Date.now();return c};
 try{await GH.editJSON("data/catalog.json",apply,"تعديل الأقسام والأسماء من صفحة الإدارة",true);apply(CAT);merge();applyLabels();renderTicker();toast("حُفظت الأقسام والأسماء، وتظهر للجميع خلال دقيقة.");vAdmin({t:"struct"})}
 catch(e){st.textContent=e.message;btn.disabled=false}}
async function saveAuthor(f){const st=$("#aest"),fd=new FormData(f),id=fd.get("id");if(!id)return;if(!GH.on){st.textContent="فعّل الإدارة المباشرة أولًا.";return}
 const up={name:String(fd.get("name")).trim(),col:fd.get("col"),bio:String(fd.get("bio")||"").trim()},d=+fd.get("died");st.textContent="جارٍ الحفظ…";
 const apply=c=>{const a=c.authors.find(x=>x.id===id);if(!a)throw new Error("المؤلف غير موجود في الفهرس المنشور (ربما أُضيف على هذا الجهاز فقط).");Object.assign(a,up);if(d)a.died=d;else delete a.died;c.version=Date.now();return c};
 try{await GH.editJSON("data/catalog.json",apply,"تعديل بيانات مؤلف: "+up.name,true);try{apply(CAT)}catch(e){}merge();st.textContent="✓ حُفظ.";toast("حُفظت بيانات المؤلف")}catch(e){st.textContent=e.message}}
/* بيانات الكتاب من القارئ */
function metaDlg(){const c=cur();if(!c)return;closeSheet();const b=c.b;if(isArt(b)&&b.f)return alert("تعديل بيانات المقالات المستوردة يأتي لاحقًا؛ يمكنك تعديل نصها من «تعديل النص».");
 const tags=b.tags||[],o=(arr,v)=>arr.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 openDlg(`<h3>بيانات الكتاب</h3>${needGH()}<form data-form="bookmeta" data-id="${b.id}"><label>العنوان</label><input name="title" value="${esc(b.set?b.setTitle||b.title:b.title)}">
 <div class="row"><div><label>المؤلف</label><select name="aid">${o([...lib.authors].sort((x,y)=>x.name.localeCompare(y.name,"ar")),b.authorId)}</select></div><div><label>القسم</label><select name="col"><option value="dawah"${bc(b)==="dawah"?" selected":""}>${esc(COL.dawah)}</option><option value="turath"${bc(b)==="turath"?" selected":""}>${esc(COL.turath)}</option></select></div><div><label>الموضوع</label><select name="tid">${o(lib.topics.filter(t=>t.for!=="articles"),b.topicId)}</select></div></div>
 <label>بيانات الطبعة أو المصدر</label><input name="source" value="${esc(b.source||"")}">
 <fieldset class="secs"><legend>يظهر أيضًا في</legend><label class="inl"><input type="checkbox" name="tafrigh" value="1"${tags.includes("tafrigh")?" checked":""}> التفريغات</label>${FURQAN.map(([n])=>`<label class="inl"><input type="checkbox" name="furqan" value="${esc(n)}"${tags.includes("furqan:"+n)?" checked":""}> قضايا الفرقان: ${esc(n)}</label>`).join("")}</fieldset>
 ${b.set?`<p class="mut">يُطبَّق التعديل على مجلدات الكتاب كلها (${toAr(b.vols)}).</p>`:""}
 <div class="row" style="margin-top:8px"><button class="btn p nf">حفظ</button><button type="button" class="btn nf danger" data-act="bookdel" data-id="${b.id}">حذف الكتاب من المكتبة</button></div><p id="bmst" class="mut"></p></form>`)}
async function saveBookMeta(f){const st=$("#bmst"),fd=new FormData(f),id=f.dataset.id,b=B(id);if(!GH.on){st.textContent="فعّل الإدارة المباشرة أولًا من صفحة الإدارة.";return}
 const tags=(b.tags||[]).filter(t=>t!=="tafrigh"&&!t.startsWith("furqan:"));if(fd.get("tafrigh"))tags.push("tafrigh");fd.getAll("furqan").forEach(n=>tags.push("furqan:"+n));
 const title=String(fd.get("title")).trim(),up={authorId:fd.get("aid"),col:fd.get("col"),topicId:fd.get("tid"),source:String(fd.get("source")||"").trim(),tags};
 const ids=b.set?lib.books.filter(x=>x.set===b.set).map(x=>x.id):[id];st.textContent="جارٍ الحفظ…";
 const apply=c=>{let n=0;c.books.forEach(x=>{if(!ids.includes(x.id))return;n++;Object.assign(x,up);if(!x.tags.length)delete x.tags;if(x.set){x.setTitle=title;x.title=title+" — ج "+x.vol}else x.title=title});if(!n)throw new Error("الكتاب غير موجود في الفهرس المنشور.");c.version=Date.now();return c};
 try{await GH.editJSON("data/catalog.json",apply,"تعديل بيانات كتاب: "+title,true);apply(CAT);merge();dlg().close();toast("حُفظت بيانات الكتاب، وتظهر للجميع خلال دقيقة.");route()}catch(e){st.textContent=e.message}}
async function deleteBook(id){const b=B(id);if(!b||!GH.on)return alert("فعّل الإدارة المباشرة أولًا.");
 const ids=b.set?lib.books.filter(x=>x.set===b.set).map(x=>x.id):[id];if(!confirm(`حذف «${b.setTitle||b.title}»${ids.length>1?" بمجلداته ("+toAr(ids.length)+")":""} من المكتبة؟ يُحذف من الفهرس فيختفي من الموقع.`))return;
 const apply=c=>{c.books=c.books.filter(x=>!ids.includes(x.id));c.version=Date.now();return c};
 try{await GH.editJSON("data/catalog.json",apply,"حذف كتاب: "+(b.setTitle||b.title),true);apply(CAT);merge();dlg().close();renderTicker();toast("حُذف الكتاب.");location.hash="#/library?c="+bc(b)}catch(e){alert(e.message)}}

/* ---------- الإدارة ---------- */
const IMPORT_LIST=["https://salafvoice.com/article.aspx?a=25750","https://salafvoice.com/article.aspx?a=25749","https://salafvoice.com/article.aspx?a=25748","https://salafvoice.com/article.aspx?a=25747","https://salafvoice.com/article.aspx?a=25746","https://salafvoice.com/article.aspx?a=25745","https://salafvoice.com/article.aspx?a=25744","https://salafvoice.com/article.aspx?a=25743","https://salafvoice.com/article.aspx?a=25742","https://salafvoice.com/article.aspx?a=25741","https://salafvoice.com/article.aspx?a=22854","https://salafvoice.com/article.aspx?a=22910","https://salafvoice.com/article.aspx?a=22875","https://salafvoice.com/article.aspx?a=22902"];
function ghBox(){return GH.on?`<div class="ghbox on"><b>✓ وضع الإدارة المباشرة مفعّل</b><p>كل ما تضيفه أو تصححه يُحفظ في المكتبة مباشرة، ويظهر للجميع خلال دقيقة تقريبًا.</p><button class="btn s" data-act="ghout">خروج من هذا الجهاز</button></div>`
 :`<div class="ghbox"><b>الإدارة المباشرة</b><p>أدخل مفتاح المشرف ليُحفظ ما تضيفه وتصححه في المكتبة مباشرة ويظهر للجميع. وبدونه تُحفظ الإضافات على هذا الجهاز وتُنشر بـ«ملف التحديث».</p>
 <form data-form="ghlogin" class="stepper"><input name="t" type="password" placeholder="مفتاح المشرف (github_pat_…)" dir="ltr" autocomplete="off" required><button class="btn p">دخول</button></form><p id="gherr" class="mut" role="alert"></p>
 <details><summary>كيف أحصل على مفتاح المشرف؟ (مرة واحدة)</summary><ol>
 <li>ادخل github.com بحساب <b>dawah-library</b>، ثم: صورة الحساب ← Settings ← Developer settings ← Personal access tokens ← <b>Fine-grained tokens</b> ← <b>Generate new token</b>.</li>
 <li>الاسم: «مشرف المكتبة»، والمدة: سنة.</li><li>Repository access: <b>Only select repositories</b> ← <b>sdsl-library</b>.</li>
 <li>Permissions ← Repository permissions ← <b>Contents: Read and write</b>.</li><li>Generate token، ثم انسخه والصقه هنا. يُحفظ على هذا الجهاز فقط، ولكل مشرف أن ينشئ مفتاحه.</li></ol></details></div>`}
async function ghLogin(f){const t=String(new FormData(f).get("t")).trim(),err=$("#gherr");err.textContent="جارٍ التحقق…";GH.token=t;
 try{await GH.verify();toast("تم الدخول. الإدارة المباشرة مفعّلة على هذا الجهاز.");S.admin=true;saveS();route()}catch(e){GH.token="";err.textContent=e.message}}
async function ghPdf(f){const fd=new FormData(f),files=fd.getAll("file").filter(x=>x&&x.size),st=$("#pdfst");if(!files.length)return;
 const big=files.filter(x=>x.size>45*1048576);if(big.length){st.textContent="ملفات أكبر من 45 ميجابايت: "+big.map(x=>x.name).join("، ")+". قسّمها أو ارفعها إلى مجلد ocr-inbox مباشرة.";return}
 const btn=f.querySelector("button");btn.disabled=true;const done=[],link=files.length===1?fd.get("book"):"";
 const tags=[];if(fd.get("tafrigh"))tags.push("tafrigh");fd.getAll("furqan").forEach(n=>tags.push("furqan:"+n));
 let author0=String(fd.get("author")||"");if(author0==="__new")author0=String(fd.get("authornew")||"").trim();else if(author0)author0=A(author0).name;
 try{for(let i=0;i<files.length;i++){const file=files[i],nm=file.name.replace(/\.pdf$/i,"").replace(/[_]+/g," ").trim(),parts=nm.split(/\s+-\s+/);
   st.textContent=`جارٍ رفع ${files.length>1?"الكتاب "+toAr(i+1)+" من "+toAr(files.length)+": ":""}${nm}…`;
   const base="up"+Date.now().toString(36)+i,cfg={title:(files.length===1&&String(fd.get("title")||"").trim())||parts[0],author:author0||parts[1]||undefined,topic:fd.get("tid"),col:fd.get("col"),offset:+fd.get("off")||0,ocr:link?!!fd.get("ocr"):true};
   if(tags.length)cfg.tags=tags;if(link)cfg.book=link;
   await GH.put("ocr-inbox/"+base+".json",JSON.stringify(cfg,null,1),"إعدادات كتاب مصور: "+cfg.title);
   await GH.put("ocr-inbox/"+base+".pdf",new Uint8Array(await file.arrayBuffer()),"رفع كتاب مصور: "+cfg.title);done.push(cfg.title)}
  st.innerHTML=`✓ رُفع ${toAr(done.length)} ${done.length>1?"كتب":"كتاب"}: ${done.map(esc).join("، ")}.<br>${link&&!fd.get("ocr")?"سيُربط بالكتاب خلال دقيقة.":"بدأ التحويل إلى نص على خوادم GitHub (نحو دقيقة لكل 10–15 صفحة)، ثم تظهر الكتب في أقسامها تلقائيًا. تابع التقدم من تبويب Actions في المستودع."}`;f.reset()}
 catch(e){st.textContent=(done.length?"رُفع: "+done.join("، ")+". ثم توقف: ":"")+e.message}finally{btn.disabled=false}}
async function addPost(f){const fd=new FormData(f),st=$("#postst");const text=String(fd.get("text")||"").trim();if(!text)return;
 const dd=fd.get("date"),x={id:"po"+Date.now().toString(36),date:!dd||dd===today()?new Date().toISOString():dd,text};const aid=fd.get("aid");if(aid)x.authorId=aid;
 if(fd.get("url"))x.url=String(fd.get("url")).trim();if(fd.get("src"))x.src=String(fd.get("src"));
 try{const img=fd.get("img");
  if(GH.on){st.textContent="جارٍ النشر…";if(img&&img.size){if(img.size>4*1048576)throw new Error("الصورة أكبر من 4 ميجابايت");const ext=(img.name.match(/\.(jpe?g|png|webp|gif)$/i)||[".jpg"])[0].toLowerCase();const path="assets/posts/"+x.id+ext;await GH.put(path,new Uint8Array(await img.arrayBuffer()),"صورة منشور");x.image=path}else if(fd.get("imgurl"))x.image=String(fd.get("imgurl"));
   await GH.editJSON("data/posts.json",o=>{o=o||{items:[]};o.items.unshift(x);return o},"منشور: "+text.slice(0,40));(POSTS||[]).unshift(x);st.textContent="✓ نُشر المنشور، ويظهر للجميع خلال دقيقة."}
  else{if(fd.get("imgurl"))x.image=String(fd.get("imgurl"));const l=ls.get("posts_local",[]);l.unshift(x);ls.set("posts_local",l);POSTS=null;st.textContent="✓ حُفظ على هذا الجهاز. فعّل الإدارة المباشرة لنشره للجميع."}
  f.reset()}catch(e){st.textContent=e.message}}

function vAdmin(q){const tab=q.t||"book",opt=(a,v)=>a.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const T_=[["book","إضافة كتاب"],["pdf","كتاب مصور"],["article","إضافة مقال"],["post","إضافة منشور"],["import","استيراد من صوت السلف"],["update","ملف التحديث"],["offline","دون إنترنت"]].concat(isAdmin()?[["struct","الأقسام والأسماء"]]:[]).concat(Cloud.staff()?[["corr","تصحيحات القراء"]]:[]);
 const authSel=(name,col)=>`<select name="${name}">${opt(lib.authors.filter(a=>!col||bc(a)===col))}<option value="__new">+ مؤلف جديد</option></select><input name="${name}new" placeholder="اسم المؤلف الجديد (عند اختيار «مؤلف جديد»)" style="margin-top:4px">`;
 let body="";
 if(tab==="book")body=`<form data-form="addbook"><label>العنوان</label><input name="title" required>
  <div class="row"><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option></select></div><div><label>المؤلف</label>${authSel("aid")}</div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for!=="articles"))}</select></div></div>
  <label>المصدر أو الناشر والسنة (اختياري)</label><input name="source">
  <label>ملف نصي (.txt) أو الصق النص أدناه</label><input type="file" name="file" accept=".txt,text/plain"><textarea name="text" placeholder="نص الكتاب"></textarea>
  <div class="row"><div><label>تقسيم الصفحات</label><select name="split"><option value="mark">عند السطر ----- أو فاصل الصفحة</option><option value="auto">تلقائيًا بالحجم</option></select></div><div><label>حجم الصفحة التلقائي (حرف)</label><input name="size" type="number" value="1800"></div></div>
  <label>الفهرس (سطر لكل عنوان: العنوان|رقم الصفحة)</label><textarea name="toc" style="min-height:60px"></textarea>
  <div class="row"><div><label>رابط النسخة المصورة PDF (اختياري)</label><input name="pdf" type="url" placeholder="https://archive.org/download/…/book.pdf" dir="ltr"></div><div><label>فرق ترقيم الصفحات</label><input name="off" type="number" value="0"></div></div>
  <label class="inl"><input type="checkbox" name="tafrigh" value="1"> هذا تفريغ لدروس صوتية</label><label>ضمن «قضايا الفرقان» (اختياري)</label><select name="furqan"><option value="">—</option>${FURQAN.map(([n])=>`<option>${esc(n)}</option>`).join("")}</select>
  <button class="btn p" style="margin-top:10px">حفظ الكتاب</button></form>`;
 else if(tab==="article")body=`<form data-form="addart"><label>عنوان المقال</label><input name="title" required>
  <div class="row"><div><label>الكاتب</label>${authSel("aid","dawah")}</div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for==="articles"))}</select></div><div><label>تاريخ النشر</label><input name="date" type="date" value="${today()}"></div></div>
  <label>رابط المصدر (اختياري)</label><input name="url" type="url" placeholder="https://salafvoice.com/article.aspx?a=…">
  <label>نص المقال</label><textarea name="text" required style="min-height:220px"></textarea><p class="mut">السطر الذي يبدأ بـ «# » يظهر عنوانًا فرعيًا.</p><button class="btn p">حفظ المقال</button></form>`;
 else if(tab==="pdf")body=GH.on?`<p class="mut">ارفع ملف PDF لكتاب مصور، فيُحفظ في المكتبة وتُتاح نسخته المصورة في القارئ، ويُحوَّل إلى نص آليًا على خوادم GitHub. والنص الآلي يحتاج مراجعة، ويمكن تصحيحه من القارئ بزر «تعديل النص».</p>
  <form data-form="ghpdf"><label>ملفات PDF (يمكن اختيار عدة كتب معًا، حتى 45 ميجابايت للملف)</label><input type="file" name="file" accept="application/pdf,.pdf" multiple required>
  <label>العنوان</label><input name="title" placeholder="عند رفع عدة ملفات يُؤخذ عنوان كل كتاب من اسم ملفه">
  <p class="mut" style="font-size:.8rem">تسمية الملف «العنوان - المؤلف.pdf» تجعل المؤلف يُعرف تلقائيًا إن لم تختره.</p>
  <div class="row"><div><label>المؤلف</label><select name="author"><option value="">—</option>${opt(lib.authors)}<option value="__new">+ مؤلف جديد</option></select><input name="authornew" placeholder="اسم المؤلف الجديد" style="margin-top:4px"></div><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option></select></div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for!=="articles"))}</select></div></div>
  <fieldset class="secs"><legend>يظهر الكتاب أيضًا في</legend><label class="inl"><input type="checkbox" name="tafrigh" value="1"> التفريغات (دروس صوتية مفرغة)</label>${FURQAN.map(([n])=>`<label class="inl"><input type="checkbox" name="furqan" value="${esc(n)}"> قضايا الفرقان: ${esc(n)}</label>`).join("")}</fieldset>
  <details><summary>ربطه بكتاب نصي موجود بدل إنشاء كتاب جديد</summary><div class="row"><div><label>الكتاب الموجود</label><select name="book"><option value="">— كتاب جديد —</option>${lib.books.filter(b=>kindOf(b)==="book").map(b=>`<option value="${b.id}">${esc(b.title)}</option>`).join("")}</select></div><div><label>فرق ترقيم الصفحات</label><input name="off" type="number" value="0"></div></div><label class="inl"><input type="checkbox" name="ocr" value="1"> تحويله إلى نص أيضًا (يستبدل النص الحالي)</label></details>
  <button class="btn p" style="margin-top:10px">رفع وتحويل</button></form><p id="pdfst" class="mut" role="status"></p>
  <p class="note">بديل للملفات الكبيرة: ارفع الملف مباشرة إلى مجلد <code>ocr-inbox</code> في المستودع باسم «العنوان - المؤلف.pdf».</p>`:`<p class="note">رفع الكتب المصورة يحتاج تفعيل الإدارة المباشرة (مفتاح المشرف أعلاه). أو ارفع ملف PDF إلى مجلد <code>ocr-inbox</code> في المستودع باسم «العنوان - المؤلف.pdf» فيُحوَّل تلقائيًا.</p>`;
 else if(tab==="post")body=`<form data-form="addpost"><div class="row"><div><label>الكاتب</label><select name="aid"><option value="">المكتبة نفسها</option>${opt(lib.authors.filter(a=>bc(a)==="dawah"))}</select></div><div><label>التاريخ</label><input name="date" type="date" value="${today()}"></div><div><label>المصدر</label><select name="src"><option value="فيس بوك">فيس بوك</option><option value="تويتر / X">تويتر / X</option><option value="تليجرام">تليجرام</option><option value="">أخرى</option></select></div></div>
  <label>نص المنشور</label><textarea name="text" required style="min-height:160px"></textarea>
  <div class="row"><div><label>صورة (اختياري)</label><input type="file" name="img" accept="image/*"></div><div><label>أو رابط صورة</label><input name="imgurl" type="url" dir="ltr"></div></div>
  <label>رابط المنشور الأصلي (اختياري)</label><input name="url" type="url" dir="ltr"><button class="btn p" style="margin-top:10px">نشر</button></form><p id="postst" class="mut" role="status"></p>`;
 else if(tab==="import")body=`<p class="mut">ضع روابط مقالات صوت السلف، رابطًا في كل سطر. يجلب الخادم نص كل مقال، فتراجعه وتعدّله ثم تحفظه. يعمل هذا من الموقع المنشور على Vercel.</p>
  <textarea id="impurls" style="min-height:160px" dir="ltr">${IMPORT_LIST.join("\n")}</textarea><button class="btn p" id="impgo" style="margin-top:8px">جلب المقالات</button> <span id="impst" class="mut"></span><div id="impres"></div>`;
 else if(tab==="update")body=`<p class="mut">كل ما تضيفه أو تعدّله هنا يُحفظ على هذا الجهاز. لنشره للجميع: نزّل «ملف التحديث» وارفعه إلى مجلد <code>updates</code> في مستودع GitHub، فيدمجه الموقع تلقائيًا ويُعاد نشره (التفاصيل في دليل التفعيل).</p>
  <div class="row"><button class="btn p nf" data-act="expUpd">تنزيل ملف التحديث</button><label class="btn nf" style="margin:0">استيراد ملف تحديث<input type="file" id="impf" accept=".json" hidden></label></div>
  <h3>المضاف والمعدَّل على هذا الجهاز</h3>${LOCAL.catalog.books.map(b=>`<div class="bk"><b>${esc(b.title||b.id)}</b><span>${isArt(b)?"مقال":"كتاب"}${b.edited?" • معدَّل "+b.edited:""}</span> <button class="btn s" data-act="delb" data-id="${b.id}">حذف من الجهاز</button></div>`).join("")||'<p class="mut">لا يوجد.</p>'}`;
 else if(tab==="struct")body=structBody();
 else if(tab==="corr")body=`<p class="mut">تصحيحات أرسلها القراء. راجع النص المقترح وعدّله إن لزم، ثم اعتمده فيُنشر مباشرة (يحتاج مفتاح الإدارة المباشرة).</p><div id="corrs"><p class="mut">جارٍ التحميل…</p></div>`;
 else body=`<p class="mut">نزّل نصوص المكتبة كلها على هذا الجهاز لتعمل دون إنترنت، وتتحدث تلقائيًا عند الاتصال. الحجم الكلي نحو ${Math.round(lib.books.reduce((s,b)=>s+(b.size||0),0)/1048576)} ميجابايت.</p><button class="btn p" data-act="offline">تنزيل المكتبة للعمل دون إنترنت</button><div id="offst"></div>`;
 view(`<h2>الإدارة</h2>${ghBox()}<label class="inl"><input type="checkbox" id="adm"${S.admin?" checked":""}> وضع الإدارة (يظهر زر «تعديل النص» في القارئ)</label>
 <div class="tabs" role="tablist">${T_.map(([k,l])=>`<a role="tab" aria-selected="${tab===k}" href="#/admin?t=${k}">${l}</a>`).join("")}</div><div style="margin-top:10px">${body}</div>
 <p class="note">${GH.on?"أنت في وضع الإدارة المباشرة: احذر، فالتعديلات تُنشر للجميع.":"بدون مفتاح المشرف لا يستطيع أحد تغيير المكتبة المنشورة من هذه الصفحة؛ ما يُضاف يبقى على هذا الجهاز حتى يُرفع ملف التحديث."}</p>`);
 $("#adm").onchange=e=>{S.admin=e.target.checked;saveS()};
 const impf=$("#impf");if(impf)impf.onchange=async e=>{try{await applyUpdate(JSON.parse(await e.target.files[0].text()));alert("تم الاستيراد");route()}catch(x){alert("ملف غير صالح")}};
 const ig=$("#impgo");if(ig)ig.onclick=importArticles;if(tab==="corr"&&Cloud.staff())corrList();if(tab==="struct")wireStruct()}
async function newAuthor(fd,key,col){let aid=fd.get(key);if(aid!=="__new")return aid;const n=String(fd.get(key+"new")||"").trim();if(!n)throw new Error("اكتب اسم المؤلف الجديد");
 const ex=lib.authors.find(a=>norm(a.name)===norm(n));if(ex)return ex.id;aid="u_a"+Date.now().toString(36);const au={id:aid,name:n,col:col||"dawah",bio:""};if(GH.on)await ghSaveAuthor(au);else LOCAL.catalog.authors.push(au);return aid}
function splitPages(t,mode,size){t=t.replace(/\r/g,"").trim();if(mode==="mark")return t.split(/\n-{3,}\n|\f/).map(x=>x.trim()).filter(Boolean);
 const ps=[];let cur="";t.split(/\n+/).forEach(par=>{if(cur&&(cur+par).length>size){ps.push(cur.trim());cur=""}cur+=par+"\n"});if(cur.trim())ps.push(cur.trim());return ps}
async function saveItem(meta,pages,toc){if(GH.on)return ghSaveBook(meta,pages,toc);LOCAL.catalog.books=byId(LOCAL.catalog.books,[Object.assign(meta,{n:pages.length,size:JSON.stringify(pages).length,added:meta.added||new Date().toISOString()})]);
 LOCAL.shards[meta.id]={id:meta.id,pages,toc:toc||[]};await DB.set("local",LOCAL);SH.delete(meta.id);merge();renderTicker()}
async function addBook(f){const fd=new FormData(f);try{let text=String(fd.get("text")||"");const file=fd.get("file");if(file&&file.size)text=await file.text();if(!text.trim())throw new Error("أدخل نص الكتاب");
 const col=fd.get("col"),aid=await newAuthor(fd,"aid",col),pages=splitPages(text,fd.get("split"),+fd.get("size")||1800);
 const toc=String(fd.get("toc")||"").split("\n").map(l=>l.split("|")).filter(x=>x[0]&&+x[1]).map(x=>({t:x[0].trim(),p:+x[1]}));
 const tags=[];if(fd.get("tafrigh"))tags.push("tafrigh");if(fd.get("furqan"))tags.push("furqan:"+fd.get("furqan"));const meta={id:"u"+Date.now().toString(36),title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col,type:"book",source:String(fd.get("source")||"")};
 if(tags.length)meta.tags=tags;if(fd.get("pdf")){meta.pdf=String(fd.get("pdf")).trim();meta.pdfOffset=+fd.get("off")||0}
 await saveItem(meta,pages,toc);
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
async function offline(){const st=$("#offst");const all=lib.books.filter(b=>!b.vf);let i=0;
 try{const c=await caches.open("sdsl-data");const urls=[...new Set(all.map(b=>b.f?"data/articles/"+b.f+".json":"data/books/"+b.id+".json"))];for(const u of urls){progress(st,++i,urls.length,"جارٍ تنزيل النصوص");await c.add(u).catch(()=>{})}
  await c.addAll(["./","index.html","style.css","config.js","search.js","app.js","manifest.webmanifest","data/catalog.json","data/articles/index.json","data/dict/mukhtar.json","assets/logo.jpg","assets/cal.jpg","assets/logo-sdsl.png","assets/logo-sdsl-128.png"]).catch(()=>{});
  st.innerHTML='<p class="mut">تم التنزيل. المكتبة تعمل الآن دون إنترنت.</p>'}catch(e){st.innerHTML='<p class="note">تعذر التنزيل هنا. يعمل من الموقع المنشور.</p>'}}

/* ---------- التعريف بالمؤلفين والتراجم ---------- */
let TJ={items:{}};
const tj=id=>TJ.items[id];
const counts=id=>{const all=lib.books.filter(b=>b.authorId===id&&!b.demo&&!VOL2(b)),k=x=>all.filter(b=>kindOf(b)===x).length;return{books:k("book"),arts:k("article"),fatwas:k("fatwa"),st:k("statement")}};
const countLine=id=>{const c=counts(id),p=[];if(c.books)p.push(c.books+" كتاب");if(c.arts)p.push(c.arts+" مقال");if(c.fatwas)p.push(c.fatwas+" فتوى");if(c.st)p.push(c.st+" بيان");return p.join(" • ")||"لا توجد مواد بعد"};
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
 <div class="row" style="margin:6px 0 14px">${c.books?`<a class="btn nf" href="#/author/${id}?k=books">كتبه (${c.books})</a>`:""}${c.arts?`<a class="btn nf" href="#/articles?a=${id}">مقالاته (${c.arts})</a>`:""}${c.fatwas?`<a class="btn nf" href="#/fatawa?a=${id}">فتاواه (${c.fatwas})</a>`:""}${art?`<a class="btn nf" href="#/book/${art.id}/1">الترجمة كاملة كما في صوت السلف</a>`:""}<a class="btn s nf" href="#/ask?a=${id}">اسأل المكتبة عن كتبه</a></div>
 ${t.sections.map(([h,body])=>`<section class="tj-s"><h3>${esc(h)}</h3><ul>${body.split("\n").map(l=>`<li>${esc(l)}</li>`).join("")}</ul></section>`).join("")}
 <section class="tj-s"><h3>المصادر</h3><ul>${t.sources.map(([n,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul></section>
 <p class="note">${esc(TJ.note||"")}</p><p><a href="#/tarajim">← كل التراجم</a></p></div>`)}

/* ---------- تنبيه عابر ---------- */
function toast(t){let el=$("#toast");if(!el){document.body.insertAdjacentHTML("beforeend",'<div id="toast" role="status"></div>');el=$("#toast")}el.textContent=t;el.classList.add("on");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("on"),3200)}

/* ---------- منشورات ---------- */
/* المنشورات المختارة في data/posts.json (يضيفها المشرف)، ومعها «جديد المكتبة» من كتب الدعوة ومقالاتها وفتاواها وبياناتها.
   التفاعل (إعجاب، تعليق، حفظ، مشاركة) للأعضاء فقط، ويُحفظ في قاعدة الحسابات (Supabase) إن فُعّلت، وإلا على الجهاز. */
let POSTS=null;
async function loadPosts(){if(POSTS)return POSTS;let items=[];try{const r=await fetch("data/posts.json",{cache:"no-cache"});items=r.ok?(await r.json()).items||[]:[]}catch(e){items=window.__POSTS__||[]}
 const del=new Set(ls.get("posts_hidden",[]));POSTS=items.concat(ls.get("posts_local",[]).map(x=>Object.assign({mine:1},x))).filter(x=>!del.has(x.id));POSTS.sort((x,y)=>(y.date||"").localeCompare(x.date||""));return POSTS}
const actPosts=()=>lib.books.filter(b=>!b.demo&&bc(b)==="dawah").map(b=>({id:"act-"+b.id,authorId:b.authorId,date:(isArt(b)?b.date:b.added)||b.added||"",act:1,b}));
const findPost=id=>(POSTS||[]).find(x=>x.id===id)||(/^act-/.test(id)?actPosts().find(x=>x.id===id):null);
const pName=x=>x.authorId?A(x.authorId).name:(x.name||"مكتبة الدعوة السلفية الرقمية");
const Cloud={role:"member",on(){return Auth.mode==="cloud"&&!!Auth.sb},staff(){return this.on()&&!!Auth.user&&/^(admin|editor)$/.test(this.role)},
 async loadRole(){this.role="member";if(!this.on()||!Auth.user)return;try{const {data}=await Auth.sb.from("profiles").select("role").eq("id",Auth.user.id).maybeSingle();if(data&&data.role)this.role=data.role}catch(e){}
  if(this.staff()){if(!S.admin){S.admin=true;saveS()}applyLabels();let first=false;try{first=!sessionStorage.getItem("admOpen");sessionStorage.setItem("admOpen","1")}catch(e){}if(first&&!parse().p[0])location.hash="#/admin"}}};
const Social={
 k(n){return"soc:"+n+":"+(Auth.user?Auth.user.id:"-")},
 async state(ids){const out={stats:{},likes:new Set(),saves:new Set()};if(!ids.length)return out;
  if(Cloud.on()){const sb=Auth.sb;try{const r=await sb.from("post_stats").select("post_id,likes,comments").in("post_id",ids);(r.data||[]).forEach(x=>out.stats[x.post_id]={likes:+x.likes||0,comments:+x.comments||0});
   if(Auth.user){const [l,s]=await Promise.all([sb.from("post_reactions").select("post_id").eq("user_id",Auth.user.id).in("post_id",ids),sb.from("post_saves").select("post_id").eq("user_id",Auth.user.id).in("post_id",ids)]);
    (l.data||[]).forEach(x=>out.likes.add(x.post_id));(s.data||[]).forEach(x=>out.saves.add(x.post_id))}}catch(e){console.warn("social",e)}return out}
  const L=new Set(ls.get(this.k("likes"),[])),V=new Set(ls.get(this.k("saves"),[])),C=ls.get("soc:comments",{});
  ids.forEach(id=>{out.stats[id]={likes:L.has(id)?1:0,comments:(C[id]||[]).length};if(L.has(id))out.likes.add(id);if(V.has(id))out.saves.add(id)});return out},
 async toggle(table,key,id,on){if(Cloud.on()){const t=Auth.sb.from(table),{error}=on?await t.insert({post_id:id,user_id:Auth.user.id}):await t.delete().eq("post_id",id).eq("user_id",Auth.user.id);if(error&&!/duplicate/i.test(error.message))throw new Error(error.message);return}
  const s=new Set(ls.get(this.k(key),[]));on?s.add(id):s.delete(id);ls.set(this.k(key),[...s])},
 like(id,on){return this.toggle("post_reactions","likes",id,on)},save(id,on){return this.toggle("post_saves","saves",id,on)},
 async comments(id){if(Cloud.on()){const {data}=await Auth.sb.from("post_comments").select("id,user_id,user_name,body,created_at").eq("post_id",id).order("created_at",{ascending:true}).limit(300);
  return(data||[]).map(c=>({id:c.id,uid:c.user_id,name:c.user_name,text:c.body,at:c.created_at}))}return ls.get("soc:comments",{})[id]||[]},
 async comment(id,text){const name=(Auth.user&&Auth.user.name)||"عضو";if(Cloud.on()){const {error}=await Auth.sb.from("post_comments").insert({post_id:id,user_id:Auth.user.id,user_name:name,body:text});if(error)throw new Error(error.message);return}
  const C=ls.get("soc:comments",{});(C[id]=C[id]||[]).push({id:Date.now(),uid:Auth.user.id,name,text,at:new Date().toISOString()});ls.set("soc:comments",C)},
 async delComment(id,cid){if(Cloud.on()){const {error}=await Auth.sb.from("post_comments").delete().eq("id",cid);if(error)throw new Error(error.message);return}
  const C=ls.get("soc:comments",{});C[id]=(C[id]||[]).filter(c=>String(c.id)!==String(cid));ls.set("soc:comments",C)},
 async savedIds(){if(!Auth.user)return[];if(Cloud.on()){const {data}=await Auth.sb.from("post_saves").select("post_id").eq("user_id",Auth.user.id).order("created_at",{ascending:false});return(data||[]).map(x=>x.post_id)}return ls.get(this.k("saves"),[]).slice().reverse()}};
function ago(d){const t=new Date(d);if(!d||isNaN(t))return"";if(/^\d{4}-\d\d-\d\d$/.test(d)){const k=Math.round((new Date(today())-t)/864e5);return k<=0?"اليوم":k===1?"أمس":fmtDate(d)}const s=(Date.now()-t)/1000;if(s<60)return"الآن";
 const f=(n,one,two,few,many)=>n===1?one:n===2?two:n<=10?`${toAr(n)} ${few}`:`${toAr(n)} ${many}`;
 if(s<3600)return"منذ "+f(Math.floor(s/60),"دقيقة","دقيقتين","دقائق","دقيقة");if(s<86400)return"منذ "+f(Math.floor(s/3600),"ساعة","ساعتين","ساعات","ساعة");
 if(s<7*86400)return"منذ "+f(Math.floor(s/86400),"يوم","يومين","أيام","يومًا");return fmtDate(d)}
const linkify=h=>h.replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u.length>48?u.slice(0,45)+"…":u}</a>`);
const KINDN={book:"كتاب جديد في المكتبة",article:"مقال",fatwa:"فتوى",statement:"بيان"};
function postText(x){if(!x.act)return x.text||"";const b=x.b;if(!b.pages)return"";
 const clean=t=>plain(t||"").replace(/-*\s*NO PAGE\s*NO\s*-*/gi," ").replace(/[ \t]+/g," ").trim();if(isArt(b))return clean(b.pages[0]);
 return b.pages.slice(0,25).map(clean).find(t=>t.length>350&&!/(ت|هاتف|فاكس)\s*:\s*\d{5}|رقم الإيداع|الطبعة|حقوق الطبع/.test(t.slice(0,300)))||clean(b.pages[0])}
function postHtml(x,st){st=st||{stats:{},likes:new Set(),saves:new Set()};const s=st.stats[x.id]||{likes:0,comments:0},liked=st.likes.has(x.id),saved=st.saves.has(x.id),name=pName(x);
 const av=x.authorId?`<span class="av" data-author="${x.authorId}" style="${avHue(x.authorId)}">${esc(name.replace(/^(الشيخ|الدكتور|د\.)\s*/,"")[0]||"")}</span>`:`<img class="av" src="assets/logo-sdsl-128.png" alt="">`;
 let body;if(x.act){const ex=postText(x);body=`<a class="pcard" href="#/book/${x.b.id}/1"><b>${esc(x.b.title)}</b>${ex?`<p>${esc(ex.slice(0,360))}${ex.length>360?"…":""}</p>`:""}<span>${kindOf(x.b)==="book"?"افتح الكتاب":"اقرأ كاملًا"} ←</span></a>`}
 else{const long=(x.text||"").length>420;body=`<div class="ptext${long?" clip":""}">${linkify(esc(x.text||"")).replace(/\n/g,"<br>")}</div>${long?'<button class="more-t" data-act="pmore">عرض المزيد</button>':""}${x.image?`<img class="pimg" src="${esc(x.image)}" alt="" loading="lazy">`:""}${x.url?`<a class="plink" href="${esc(x.url)}" target="_blank" rel="noopener">المنشور الأصلي ↗</a>`:""}`}
 return`<article class="post" data-id="${esc(x.id)}"><header>${av}<div><b${x.authorId?` data-author="${x.authorId}"`:""}>${esc(name)}</b><span class="mut">${x.act?KINDN[kindOf(x.b)]+" • ":""}<a href="#/post/${encodeURIComponent(x.id)}">${esc(ago(x.date))}</a>${x.src?` • ${esc(x.src)}`:""}${x.demo?" • منشور تجريبي":""}</span></div><button class="pmenu" data-act="pmenu" aria-label="خيارات المنشور">⋯</button></header>
 ${body}
 <div class="pstats"><span data-likes="${s.likes}">${s.likes?`♥ ${toAr(s.likes)}`:""}</span><button class="lnk" data-act="pcomm">${s.comments?`${toAr(s.comments)} تعليق`:""}</button></div>
 <div class="pact"><button data-act="plike" aria-pressed="${liked}">${liked?"♥":"♡"} إعجاب</button><button data-act="pcomm">💬 تعليق</button><button data-act="psave" aria-pressed="${saved}">${saved?"★ محفوظ":"☆ حفظ"}</button><button data-act="pshare">↗ مشاركة</button></div>
 <div class="pcomms" hidden></div></article>`}
const avHue=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))%360;return`background:linear-gradient(135deg,hsl(${h} 45% 38%),hsl(${(h+40)%360} 50% 28%));color:#fff`};
const FEED={list:[],pos:0,busy:false,obs:null};
async function vPosts(q){const k=q.k||"",tabs=[["","الكل"],["posts","منشورات المشايخ"],["lib","جديد المكتبة"],["saved","محفوظاتي"]];
 const url=o=>{const n=Object.assign({k,a:q.a||""},o),p=new URLSearchParams();if(n.k)p.set("k",n.k);if(n.a)p.set("a",n.a);return"#/posts"+(p.toString()?"?"+p:"")};
 await loadPosts();const cnt={};POSTS.concat(actPosts()).forEach(x=>{if(x.authorId)cnt[x.authorId]=(cnt[x.authorId]||0)+(x.act?1:5)});const authors=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,24);if(q.a&&!authors.includes(q.a))authors.unshift(q.a);
 view(`<h2>منشورات</h2><p class="mut">منشورات مختارة لمشايخ الدعوة السلفية وكتّابها، وجديد المكتبة من كتب ومقالات وفتاوى وبيانات. ${Auth.user?"":'<a href="#/account?next=%23%2Fposts">سجّل الدخول</a> للإعجاب والتعليق والحفظ والمشاركة.'}</p>
 <div class="tabs" role="tablist">${tabs.map(([v,l])=>`<a role="tab" aria-selected="${k===v}" href="${url({k:v})}">${l}</a>`).join("")}</div>
 <div class="pstrip" data-noswipe><a href="${url({a:""})}"${!q.a?' aria-current="true"':""}><span class="ring"><img src="assets/logo-sdsl-128.png" alt=""></span><small>الكل</small></a>${authors.map(id=>{const nm=A(id).name,sh=nm.replace(/^(الشيخ|الدكتور|د\.)\s*/,"");return`<a href="${url({a:id})}"${q.a===id?' aria-current="true"':""}><span class="ring"><span class="av" style="${avHue(id)}">${esc(sh[0]||"")}</span></span><small>${esc(sh.split(/\s+/).slice(0,2).join(" "))}</small></a>`}).join("")}</div>
 <div id="feed" class="feed"></div><div id="feedEnd" class="mut feedend">جارٍ التحميل…</div>`);
 let list;if(k==="saved"){if(!Auth.user){$("#feedEnd").innerHTML='<a href="#/account?next=%23%2Fposts%3Fk%3Dsaved">سجّل الدخول</a> لترى منشوراتك المحفوظة.';return}list=(await Social.savedIds()).map(findPost).filter(Boolean)}
 else{list=k==="lib"?actPosts():k==="posts"?POSTS.slice():POSTS.concat(actPosts());list.sort((x,y)=>String(y.date||"").localeCompare(String(x.date||"")))}
 if(q.a)list=list.filter(x=>x.authorId===q.a);
 Object.assign(FEED,{list,pos:0,busy:false});if(FEED.obs)FEED.obs.disconnect();
 if("IntersectionObserver"in window){FEED.obs=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))feedMore()},{rootMargin:"700px"});FEED.obs.observe($("#feedEnd"))}feedMore()}
async function feedMore(){if(FEED.busy||!$("#feed"))return;const batch=FEED.list.slice(FEED.pos,FEED.pos+8),end=$("#feedEnd");
 if(!batch.length){end.textContent=FEED.list.length?"وصلت إلى آخر المنشورات":"لا توجد منشورات بعد.";return}
 FEED.busy=true;FEED.pos+=batch.length;
 try{await Promise.all(batch.filter(x=>x.act).map(x=>loadBook(x.b.id).then(b=>{x.b=b}).catch(()=>{})));
  const st=await Social.state(batch.map(x=>x.id));if(!$("#feed"))return;$("#feed").insertAdjacentHTML("beforeend",batch.map(x=>postHtml(x,st)).join(""))}finally{FEED.busy=false}
 if(FEED.pos>=FEED.list.length)end.textContent="وصلت إلى آخر المنشورات";else{end.innerHTML='<button class="btn s" data-act="feedMore">المزيد</button>';const r=end.getBoundingClientRect();if(r.top<innerHeight+700)feedMore()}}
async function vPost(id){await loadPosts();const x=findPost(id);if(!x)return view('<p class="note">المنشور غير موجود.</p><p><a href="#/posts">← كل المنشورات</a></p>');
 if(x.act)x.b=await loadBook(x.b.id).catch(()=>x.b);const st=await Social.state([x.id]);
 view(`<p><a href="#/posts">← كل المنشورات</a></p><div class="feed">${postHtml(x,st)}</div>`);openComments($(".post"))}
function needLogin(msg){openSheet("للأعضاء المسجلين",`<p>${esc(msg||"الإعجاب والتعليق والحفظ والمشاركة متاحة لأعضاء المكتبة المسجلين، والقراءة متاحة للجميع.")}</p><div class="row"><a class="btn p nf" href="#/account?m=signup&next=${encodeURIComponent(location.hash)}" data-act="closeSheet">أنشئ حسابًا مجانيًا</a><a class="btn nf" href="#/account?next=${encodeURIComponent(location.hash)}" data-act="closeSheet">لدي حساب</a></div>`)}
async function openComments(card){const box=card.querySelector(".pcomms"),id=card.dataset.id;box.hidden=false;box.innerHTML='<p class="mut">جارٍ تحميل التعليقات…</p>';
 let list=[];try{list=await Social.comments(id)}catch(e){}
 const cl=card.querySelector(".pstats .lnk");if(cl)cl.textContent=list.length?`${toAr(list.length)} تعليق`:"";
 box.innerHTML=`${list.map(c=>`<div class="cmt"><span class="av sm">${esc((c.name||"؟")[0])}</span><div><b>${esc(c.name||"عضو")}</b><p>${linkify(esc(c.text))}</p><span class="mut">${esc(ago(c.at))}${Auth.user&&(c.uid===Auth.user.id||Cloud.staff())?` • <button class="lnk" data-act="pdelc" data-cid="${esc(c.id)}">حذف</button>`:""}</span></div></div>`).join("")||'<p class="mut">لا توجد تعليقات بعد.</p>'}
 ${Auth.user?`<form class="stepper" data-form="pcomment" data-id="${esc(id)}"><input name="t" placeholder="اكتب تعليقًا…" aria-label="اكتب تعليقًا" maxlength="2000" required><button class="btn s p">نشر</button></form>${Cloud.on()?"":'<p class="mut" style="font-size:.75rem">التعليقات محفوظة على جهازك حتى تفعيل قاعدة الحسابات.</p>'}`:`<p class="mut"><a href="#/account?next=${encodeURIComponent(location.hash)}">سجّل الدخول</a> للتعليق.</p>`}`}
const postShareText=x=>`${x.act?x.b.title+"\n"+postText(x).slice(0,600):x.text}\n— ${pName(x)}\n${SITENAME}${siteLink()?"\n"+siteLink("#/post/"+encodeURIComponent(x.id)):""}`;
async function postAct(a,el){const card=el.closest(".post"),id=(card&&card.dataset.id)||el.dataset.id,x=findPost(id);if(!x&&a!=="pdelc")return;
 const must=()=>{if(!Auth.user){needLogin();return false}return true};
 try{
 if(a==="pmore"){card.querySelector(".ptext").classList.remove("clip");el.remove()}
 else if(a==="plike"){if(!must())return;const on=el.getAttribute("aria-pressed")!=="true";el.setAttribute("aria-pressed",on);el.textContent=(on?"♥":"♡")+" إعجاب";const sp=card.querySelector("[data-likes]"),n=Math.max(0,(+sp.dataset.likes||0)+(on?1:-1));sp.dataset.likes=n;sp.textContent=n?"♥ "+toAr(n):"";
  try{await Social.like(id,on)}catch(e){el.setAttribute("aria-pressed",!on);el.textContent=(!on?"♥":"♡")+" إعجاب";throw e}}
 else if(a==="psave"){if(!must())return;const on=el.getAttribute("aria-pressed")!=="true";el.setAttribute("aria-pressed",on);el.textContent=on?"★ محفوظ":"☆ حفظ";await Social.save(id,on);toast(on?"حُفظ في «محفوظاتي»":"أُزيل من المحفوظات")}
 else if(a==="pcomm"){const box=card.querySelector(".pcomms");if(!box.hidden&&box.innerHTML){box.hidden=true;return}openComments(card)}
 else if(a==="pdelc"){if(confirm("حذف التعليق؟")){await Social.delComment(id,el.dataset.cid);openComments(card)}}
 else if(a==="pshare"){if(!must())return;openSheet("مشاركة المنشور",`<div class="tools-grid"><button data-act="pcopy" data-id="${esc(id)}">نسخ النص مع المصدر</button><button data-act="pimgq" data-id="${esc(id)}">تصميمه صورة (قبسة)</button><button data-act="pnative" data-id="${esc(id)}">مشاركة عبر التطبيقات</button><button data-act="plink" data-id="${esc(id)}">نسخ رابط المنشور</button></div><p class="mut" style="margin-top:10px">التصميم صورة يفتح استوديو القبسات بنص المنشور، فتختار الخلفية والمقاس.</p>`)}
 else if(a==="pmenu"){const canDel=!x.act&&(x.mine||GH.on);openSheet("خيارات المنشور",`<div class="tools-grid"><button data-act="plink" data-id="${esc(id)}">نسخ رابط المنشور</button>${x.authorId?`<a href="#/posts?a=${x.authorId}" data-act="closeSheet">منشورات ${esc(A(x.authorId).name)}</a>`:""}${x.act?`<a href="#/book/${x.b.id}/1" data-act="closeSheet">فتح في المكتبة</a>`:""}${canDel?`<button data-act="pdel" data-id="${esc(id)}">حذف المنشور</button>`:""}</div>`)}
 else if(a==="pcopy"){if(!must())return;await navigator.clipboard.writeText(postShareText(x));closeSheet();toast("نُسخ المنشور مع اسم الكاتب والموقع.")}
 else if(a==="plink"){const u=siteLink("#/post/"+encodeURIComponent(id))||location.href.split("#")[0]+"#/post/"+encodeURIComponent(id);await navigator.clipboard.writeText(u);closeSheet();toast("نُسخ رابط المنشور")}
 else if(a==="pnative"){closeSheet();const t=postShareText(x);if(navigator.share)await navigator.share({text:t}).catch(()=>{});else{await navigator.clipboard.writeText(t);toast("نُسخ للمشاركة.")}}
 else if(a==="pimgq"){if(!must())return;closeSheet();const t=postText(x);pendingQ={t:t.length>600?t.slice(0,600)+"…":t,src:pName(x)+(x.act?" — "+x.b.title:""),ref:x.act?{b:x.b.id,p:1}:null};location.hash="#/qabasat"}
 else if(a==="pdel"){if(!confirm("حذف هذا المنشور؟"))return;closeSheet();
  if(x.mine){ls.set("posts_local",ls.get("posts_local",[]).filter(y=>y.id!==id))}
  else if(GH.on){await GH.editJSON("data/posts.json",o=>{o.items=(o.items||[]).filter(y=>y.id!==id);return o},"حذف منشور");toast("حُذف المنشور، ويختفي عند الجميع خلال دقيقة.")}
  POSTS=null;route()}
 }catch(e){console.warn(e);toast(e.message||"تعذر تنفيذ الطلب")}}

/* ---------- تصحيحات القراء ---------- */
function corrDlg(){const c=cur();if(!c)return;closeSheet();const b=c.b,i=c.p-1;
 if(Cloud.on()&&!Auth.user)return needLogin("اقتراح التصحيحات متاح للأعضاء المسجلين.");
 openDlg(`<h3>اقتراح تصحيح</h3><p class="mut">${esc(b.title)}${PL(b,i)?" — "+esc(PL(b,i)):isArt(b)?"":" — صفحة "+toAr(c.p)}. عدّل النص كما ينبغي أن يكون، واكتب ملاحظة إن شئت، فيراجعه المشرفون قبل اعتماده.</p>
 <form data-form="corrsend" data-id="${b.id}" data-p="${c.p}"><textarea name="t" style="min-height:240px">${esc(b.pages[i])}</textarea><label>ملاحظة (اختياري)</label><input name="n" placeholder="مثال: خطأ مطبعي في السطر الثالث"><button class="btn p" style="margin-top:8px">${Cloud.on()?"إرسال التصحيح للمراجعة":"إرسال عبر واتساب"}</button></form>`)}
async function corrSend(f){const fd=new FormData(f),b=B(f.dataset.id),p=+f.dataset.p,t=String(fd.get("t")||""),n=String(fd.get("n")||"");
 try{if(Cloud.on()){const {error}=await Auth.sb.from("corrections").insert({book_id:b.id,page:p,proposed:t,note:n,user_id:Auth.user.id,user_name:Auth.user.name||""});if(error)throw new Error(error.message);dlg().close();toast("شكرًا لك، أُرسل التصحيح للمراجعة.")}
  else{const old=b.pages[p-1].split("\n"),diff=t.split("\n").filter(l=>!old.includes(l)).slice(0,8).join("\n");
   window.open(waLink(`اقتراح تصحيح — ${b.title}، صفحة ${p}${PL(b,p-1)?" ("+PL(b,p-1)+")":""}\nالرابط: ${siteLink(`#/book/${b.id}/${p}`)||""}\n${n?"ملاحظة: "+n+"\n":""}\nالنص المقترح:\n${(diff||t).slice(0,1500)}`),"_blank","noopener");dlg().close()}}catch(e){alert(e.message)}}
async function corrList(){const el=$("#corrs");if(!el)return;const {data,error}=await Auth.sb.from("corrections").select("*").eq("status","pending").order("created_at",{ascending:true}).limit(50);
 if(error){el.innerHTML=`<p class="note">${esc(error.message)}</p>`;return}
 el.innerHTML=(data||[]).map(r=>{const b=B(r.book_id);return`<div class="studio corr" data-cid="${r.id}" data-id="${esc(r.book_id)}" data-p="${r.page}" style="margin-top:10px"><b>${esc(b?b.title:r.book_id)}</b> — صفحة ${toAr(r.page)} <span class="mut">من ${esc(r.user_name||"عضو")} • ${esc(ago(r.created_at))}</span>${r.note?`<p>${esc(r.note)}</p>`:""}<textarea style="min-height:180px">${esc(r.proposed)}</textarea><div class="row"><button class="btn p nf" data-act="corrok"${GH.on?"":" disabled title=\"يحتاج مفتاح الإدارة المباشرة\""}>اعتماد ونشر</button><button class="btn nf" data-act="corrno">رفض</button>${b?`<a class="btn nf" href="#/book/${b.id}/${r.page}" target="_blank">النص الحالي</a>`:""}</div></div>`}).join("")||'<p class="mut">لا توجد تصحيحات بانتظار المراجعة.</p>'}
async function corrDecide(el){const box=el.closest(".corr"),ok=el.dataset.act==="corrok";
 try{if(ok){if(!GH.on)throw new Error("فعّل الإدارة المباشرة (مفتاح المشرف) أولًا ليُنشر التصحيح.");const b=await loadBook(box.dataset.id);await ghSavePage(b,+box.dataset.p-1,box.querySelector("textarea").value)}
  const {error}=await Auth.sb.from("corrections").update({status:ok?"accepted":"rejected"}).eq("id",+box.dataset.cid);if(error)throw new Error(error.message);
  box.outerHTML=`<p class="mut">${ok?"✓ اعتُمد التصحيح ونُشر، ويظهر للجميع خلال دقيقة.":"رُفض التصحيح."}</p>`}catch(e){alert(e.message)}}

/* ---------- التنقل بالسحب بين الأقسام الرئيسية ----------
   الرئيسية ← كتب الدعوة ← كتب التراث ← منشورات. السحب من اليسار إلى اليمين ينقل إلى القسم التالي، وعكسه إلى السابق،
   والصفحة تتبع الإصبع أثناء السحب ثم تنزلق إلى مكانها. وشريط الأقسام السفلي يدل على موضعك ويتحرك مع السحب. */
const PG_ICON=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SECS=[
 {h:"#/",n:"الرئيسية",i:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',is:(p)=>!p[0]},
 {h:"#/library?c=dawah",n:"كتب الدعوة",i:'<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',is:(p,q)=>p[0]==="library"&&q.c==="dawah"},
 {h:"#/library?c=turath",n:"كتب التراث",i:'<path d="M6 3h10l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',is:(p,q)=>p[0]==="library"&&q.c==="turath"},
 {h:"#/posts",n:"منشورات",i:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',is:(p)=>p[0]==="posts"},
 {h:"#/ask",n:"المساعد",i:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',is:(p)=>p[0]==="ask"||p[0]==="ai"}];
const Pager={idx:-1,dir:0,t:null,
 reduce:()=>matchMedia("(prefers-reduced-motion: reduce)").matches,
 at(){const{p,q}=parse();return SECS.findIndex(x=>x.is(p,q))},
 // يُستدعى في بداية كل توجيه: يحدد اتجاه الانتقال إن كان بين قسمين متجاورين في الشريط
 onRoute(){const n=this.at();if(n>=0&&!ls.get("swh",0)&&matchMedia("(pointer:coarse)").matches){ls.set("swh",1);setTimeout(()=>toast("اسحب الشاشة يمينًا أو يسارًا للتنقل بين الأقسام"),1500)}if(!this.dir&&this.idx>=0&&n>=0&&n!==this.idx)this.dir=n>this.idx?1:-1;this.idx=n;this.paint(n)},
 // يُستدعى بعد رسم الصفحة: حركة دخول القسم الجديد من جهته
 entered(){const d=this.dir;if(!d)return;this.dir=0;clearTimeout(this.t);const el=$("#app");el.getAnimations().forEach(a=>a.cancel());el.style.transform=el.style.opacity="";
  if(this.reduce())return;el.animate([{transform:`translate3d(${-d*Math.min(innerWidth,700)*.32}px,0,0)`,opacity:0},{transform:"none",opacity:1}],{duration:340,easing:"cubic-bezier(.2,.8,.2,1)"})},
 go(n,fromX){if(n<0||n>=SECS.length||n===this.idx)return;const d=n>this.idx?1:-1,el=$("#app"),W=innerWidth;this.dir=d;
  if(this.reduce()){location.hash=SECS[n].h;return}
  const a=el.animate([{transform:`translate3d(${fromX||0}px,0,0)`,opacity:el.style.opacity||1},{transform:`translate3d(${d*W}px,0,0)`,opacity:0}],{duration:fromX?200:180,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"});
  el.style.transform=el.style.opacity="";this.peek(null);
  a.onfinish=()=>{location.hash=SECS[n].h;this.t=setTimeout(()=>{el.getAnimations().forEach(x=>x.cancel())},900)}},
 dock(){let d=$("#dock");if(d)return d;document.body.insertAdjacentHTML("beforeend",`<nav id="dock" aria-label="الأقسام الرئيسية" hidden><span class="dk-ind"></span>${SECS.map((x,i)=>`<a href="${x.h}" data-pg="${i}">${PG_ICON(x.i)}<span>${x.n}</span></a>`).join("")}</nav><div id="peek" aria-hidden="true"></div>`);
  d=$("#dock");d.addEventListener("click",e=>{const a=e.target.closest("[data-pg]");if(!a)return;e.preventDefault();this.go(+a.dataset.pg)});return d},
 paint(n,pos){const d=this.dock(),on=n>=0;d.hidden=!on;document.body.classList.toggle("has-dock",on);if(!on)return;
  d.style.setProperty("--pos",pos==null?n:pos);d.classList.toggle("drag",pos!=null);d.querySelectorAll("[data-pg]").forEach(a=>a.setAttribute("aria-current",+a.dataset.pg===n?"page":"false"))},
 peek(x,k){const el=$("#peek");if(!el)return;if(!x){el.className="";el.style.cssText="";return}
  el.innerHTML=`<span>${PG_ICON(x.i)}</span><b>${x.n}</b>`;el.className="on "+(k>0?"l":"r");el.style.setProperty("--k",Math.min(1,Math.abs(k)))}};
(function swipe(){let s=null;const W=()=>innerWidth;
 const blocked=t=>{if(t.closest("input,textarea,select,dialog,.sheet,.tabs,.chips,#ticker,#dock,.pdfv,canvas,[data-noswipe]"))return true;
  for(let e=t;e&&e!==document.body;e=e.parentElement){if(e.scrollWidth>e.clientWidth+4){const o=getComputedStyle(e).overflowX;if(o==="auto"||o==="scroll")return true}}return false};
 document.addEventListener("touchstart",e=>{s=null;if(e.touches.length!==1||Pager.idx<0||document.body.classList.contains("reading"))return;const t=e.touches[0];
  if(t.clientX<18||t.clientX>W()-18||blocked(e.target)||String(getSelection()).trim())return;s={x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}},{passive:true});
 document.addEventListener("touchmove",e=>{if(!s)return;const t=e.touches[0],dx=t.clientX-s.x,dy=t.clientY-s.y;
  if(!s.lock){if(Math.abs(dx)<10&&Math.abs(dy)<10)return;s.lock=Math.abs(dx)>Math.abs(dy)*1.3?"x":"y"}
  if(s.lock!=="x")return;e.preventDefault();const n=Pager.idx+(dx>0?1:-1),ok=n>=0&&n<SECS.length,d=ok?dx:dx*.22,w=W(),k=d/w;s.dx=d;
  const el=$("#app");el.style.transform=`translate3d(${d}px,0,0) scale(${1-Math.abs(k)*.05})`;el.style.opacity=1-Math.abs(k)*.45;
  Pager.paint(Pager.idx,ok?Pager.idx+(dx>0?1:-1)*Math.min(1,Math.abs(k)*1.6):Pager.idx);Pager.peek(ok?SECS[n]:null,k*1.8)},{passive:false});
 const end=()=>{if(!s||s.lock!=="x"){s=null;return}const dx=s.dx,v=Math.abs(dx)/Math.max(1,Date.now()-s.t),n=Pager.idx+(dx>0?1:-1),el=$("#app");s=null;
  if(n>=0&&n<SECS.length&&(Math.abs(dx)>W()*.26||(v>.45&&Math.abs(dx)>40))){Pager.paint(n);Pager.go(n,dx);return}
  const from=el.style.transform,op=el.style.opacity;el.style.transform=el.style.opacity="";Pager.peek(null);Pager.paint(Pager.idx);
  if(from)el.animate([{transform:from,opacity:op},{transform:"none",opacity:1}],{duration:260,easing:"cubic-bezier(.2,.9,.3,1.2)"})};
 document.addEventListener("touchend",end);document.addEventListener("touchcancel",end)})();

/* ---------- الشريط والتوجيه والأحداث ---------- */
function renderTicker(){const t=$("#ticker"),key=b=>(b.added||"")+"|"+(b.date||""),top=l=>l.filter(b=>!b.demo).sort((x,y)=>key(y).localeCompare(key(x))),ta=top(lib.books.filter(b=>kindOf(b)!=="book")).slice(0,8),tb=top(BOOKS()).slice(0,8),n=[];
 for(let i=0;i<8;i++){if(ta[i])n.push(ta[i]);if(tb[i])n.push(tb[i])}if(!n.length){t.hidden=true;return}
 const one=n.map(b=>`<a href="#/book/${b.id}/1"><b>${esc(b.setTitle||b.title)}</b> <span>— ${isArt(b)?"مقال: ":""}${esc(A(b.authorId).name)}</span></a>`).join("");$("#tt").innerHTML=one+one;$("#tt").style.setProperty("--dur",(n.length*7)+"s");t.hidden=false}
function parse(){const h=location.hash.slice(1)||"/";const[p,qs]=h.split("?");return{p:p.split("/").filter(Boolean).map(decodeURIComponent),q:Object.fromEntries(new URLSearchParams(qs||""))}}
function route(){const{p,q}=parse(),v=p[0];Pager.onRoute();applyLabels();$("#selq").hidden=true;closeSheet();document.body.classList.toggle("reading",v==="book");if(v!=="book")document.body.classList.remove("reading-full");
 if(!v)return vHome();if(v==="library")return vLibrary(q);if(v==="articles")return vList("article",q);if(v==="fatawa")return vList("fatwa",q);if(v==="bayanat")return vList("statement",q);
 if(v==="posts")return vPosts(q);if(v==="post")return vPost(p[1]);if(v==="furqan")return vFurqan();if(v==="tafrighat")return vTafrighat();if(v==="about")return vAbout();if(v==="dawah")return vDawah();if(v==="history")return vHistory();if(v==="contact")return vContact();if(v==="authors")return vAuthors();if(v==="author")return vAuthor(p[1],q);
 if(v==="topics")return vLibrary({});if(v==="topic")return vLibrary({t:p[1]});if(v==="book")return vBook(p[1],+p[2],q.h);if(v==="search")return vSearch(q);
 if(v==="qabasat")return vQabasat(q);if(v==="favs")return vFavs();if(v==="admin")return vAdmin(q);if(v==="ask"||v==="ai")return vAsk(q);if(v==="tarajim")return vTarajim();if(v==="tarjama")return vTarjama(p[1]);if(v==="account")return vAccount(q);vHome()}
window.addEventListener("hashchange",route);
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]"),w=e.target.closest(".rd .w");
 if(w&&!el){if(String(getSelection()).trim())return;return dictDlg(w.textContent)}if(!el)return;const a=el.dataset.act;
 if(a==="closeDlg")dlg().close();
 else if(a==="closeSheet"){if(el.tagName!=="A")e.preventDefault();closeSheet()}
 else if(a==="toc")tocSheet();else if(a==="goto")gotoSheet();else if(a==="more")moreSheet();else if(a==="prev")turn(-1);else if(a==="next")turn(1);
 else if(a==="full")setFull(!S.full);
 else if(/^p(like|save|comm|copy|share|imgq|more|menu|delc|link|native|del)$/.test(a))postAct(a,el);
 else if(a==="feedMore")feedMore();
 else if(a==="bookmeta")metaDlg();else if(a==="bookdel")deleteBook(el.dataset.id);
 else if(a==="tup"||a==="tdown"){const r=el.closest(".trow"),o=a==="tup"?r.previousElementSibling:r.nextElementSibling;if(o)a==="tup"?o.before(r):o.after(r)}
 else if(a==="tdel"){const r=el.closest(".trow");if(confirm("حذف القسم «"+r.querySelector(".tn").value+"»؟ (يُحذف عند الحفظ)"))r.remove()}
 else if(a==="tadd"){const k=el.dataset.kind,box=$("#tl-"+k);box.insertAdjacentHTML("beforeend",topicRows([{id:(k==="articles"?"at":"t")+Date.now().toString(36),name:""}],k));const n=box.lastElementChild.querySelector(".tn");n.placeholder="اسم القسم الجديد";n.focus()}
 else if(a==="aisvc"){const sv=AISVC.find(x=>x[0]===el.dataset.m);CONV.mode=sv[0];$("#am").value=sv[0];$$("[data-act=aisvc]").forEach(b=>b.setAttribute("aria-pressed",b===el));const ta=$("[name=m]");if(sv[3]&&!ta.value.trim())ta.value=sv[3];if(sv[0]==="summarize"||sv[0]==="quiz")pickBook();else{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);ta.scrollIntoView({behavior:"smooth",block:"center"})}}
 else if(a==="aiex"||a==="aifollow"){const ta=$("[name=m]");if(!ta)return;ta.value=el.textContent;if(a==="aiex"){const m=/^اجمع/.test(ta.value)?"gather":/^قارن/.test(ta.value)?"compare":/منهج/.test(ta.value)?"plan":/^لخ/.test(ta.value)?"summarize":/كيف أنظ/.test(ta.value)?"solve":"ask";CONV.mode=m;$("#am").value=m}ta.form.requestSubmit()}
 else if(a==="aipick"){closeSheet();setBookScope(el.dataset.id);const ta=$("[name=m]");if(ta){const b=B(el.dataset.id);if(/^(لخّص كتاب|اختبرني في)\s*:?\s*$/.test(ta.value.trim())||!ta.value.trim())ta.value=(CONV.mode==="quiz"?"اختبرني في كتاب «":CONV.mode==="summarize"?"لخّص كتاب «":"«")+b.title+"»";ta.focus()}}else if(a==="corr")corrDlg();else if(a==="corrok"||a==="corrno")corrDecide(el);
 else if(a==="ghout"){GH.token="";toast("خرجت من وضع الإدارة المباشرة.");route()}
 else if(a==="pview"){S.pv=nextPv(S.pv&&S.pv!=="text"?(matchMedia("(min-width:1000px)").matches?S.pv:"pdf"):"text");saveS();route()}
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
 else if(k==="artq"||k==="listq"){const s=qs(true);location.hash="#/"+(f.dataset.route||"articles")+(s?"?"+s:"")}
 else if(k==="pcomment"){const t=String(fd.get("t")||"").trim();if(!t)return;const btn=f.querySelector("button");btn.disabled=true;Social.comment(f.dataset.id,t).then(()=>openComments(f.closest(".post"))).catch(x=>{alert(x.message);btn.disabled=false})}
 else if(k==="corrsend")corrSend(f);
 else if(k==="struct")saveStruct(f);else if(k==="authedit")saveAuthor(f);else if(k==="bookmeta")saveBookMeta(f);
 else if(k==="ghlogin")ghLogin(f);else if(k==="ghpdf")ghPdf(f);else if(k==="addpost")addPost(f);
 else if(k==="contact"){window.open(waLink(`${fd.get("k")} — من: ${fd.get("n")}\n\n${fd.get("m")}\n\n(مرسلة من مكتبة الدعوة السلفية الرقمية)`),"_blank","noopener")}
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
