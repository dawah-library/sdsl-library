"use strict";
/* =========================================================
   مكتبة الدعوة السلفية الرقمية — الواجهة
   ========================================================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const SS=window.SDSLSearch,strip=SS.strip,norm=SS.norm,plain=SS.plain;
try{if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone&&!matchMedia("(display-mode: standalone)").matches)document.documentElement.classList.add("ios-browser")}catch(e){}
const ls={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const DB={open(){return new Promise((res,rej)=>{const r=indexedDB.open("sdsl",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async get(k){try{const d=await this.open();return await new Promise(r=>{const q=d.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(undefined)})}catch(e){return ls.get("db_"+k)}},
 async set(k,v){try{const d=await this.open();await new Promise((r,j)=>{const t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=r;t.onerror=j})}catch(e){ls.set("db_"+k,v)}}};
const CFG=Object.assign({supabaseUrl:"",supabaseAnonKey:"",askEndpoint:"api/ask",importEndpoint:"api/import",siteUrl:""},window.SDSL_CONFIG||{});
const SITENAME="المكتبة الرقمية للدعوة السلفية بمصر";
const siteLink=(h)=>{const base=(CFG.siteUrl||location.origin+"/").replace(/\/?$/,"/");return base+String(h||"").replace(/^#?\/?/,"")};
const HERE=()=>"#"+(location.pathname.replace(/^\/index\.html$/,"/")||"/")+location.search;
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
function applyLook(){document.body.classList.toggle("fmtp",S.fmt!=="plain");const r=document.documentElement;if(S.theme==="auto")r.removeAttribute("data-theme");else r.dataset.theme=S.theme;
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
function attach(b,sh){b.pages=sh.pages;b.toc=sh.toc||[];b.unc=sh.unc||null;b.unrev=sh.unrev||null;if(sh.pl)b.pl=sh.pl;else delete b.pl;b.n=sh.pages.length}
function merge(){const del=new Set(LOCAL.deleted||[]);
 lib={authors:byId(CAT.authors,LOCAL.catalog.authors),topics:byId(CAT.topics,LOCAL.catalog.topics),
  books:byId(CAT.books.concat(ARTS_IDX),LOCAL.catalog.books).filter(b=>!del.has(b.id)).map(m=>{const b=Object.assign({},m);const sh=LOCAL.shards[b.id]||SH.get(b.id);if(sh)attach(b,sh);return b})}}
const A=id=>lib.authors.find(a=>a.id===id)||{name:"—"},T=id=>lib.topics.find(t=>t.id===id)||{name:"—"},B=id=>lib.books.find(b=>b.id===id);
const bc=b=>b.col||"dawah",isArt=b=>b.type==="article";
const isStatement=b=>b.topicId==="at17"||/بيانات|(^|›\s*)بيان/.test(b.c||"")||/^بيان(\s|ات)/.test(b.title||"");
const isReadBook=b=>/^المكتبة المقروءة/.test(b.c||"");
const isTranscript=b=>(b.tags||[]).includes("tafrigh")||/تفريغ|دروس صوتية/.test(b.source||"");
const kindOf=b=>!isArt(b)||isReadBook(b)?"book":isFatwa(b)?"fatwa":isStatement(b)?"statement":"article";
let _SM=null,_SMn=-1;const setMin=k=>{if(_SMn!==lib.books.length){_SM={};lib.books.forEach(x=>{if(x.set&&(_SM[x.set]==null||x.vol<_SM[x.set]))_SM[x.set]=x.vol});_SMn=lib.books.length}return _SM[k]};
const VOL2=b=>!!(b.set&&b.vol>setMin(b.set)),BOOKS=()=>lib.books.filter(b=>kindOf(b)==="book"&&!VOL2(b)),ARTS=()=>lib.books.filter(b=>kindOf(b)==="article"),FATWAS=()=>lib.books.filter(b=>kindOf(b)==="fatwa"),BAYANAT=()=>lib.books.filter(b=>kindOf(b)==="statement");
const COL={dawah:"مكتبة الدعوة السلفية",turath:"تراث"};
const died=a=>a&&a.died?` (ت ${a.died}هـ)`:"";
const PL=(b,i)=>SS.label(b,i);
async function loadBook(id){const b=B(id);if(!b)throw new Error("غير موجود");if(b.pages)return b;
 let sh=LOCAL.shards[id]||SH.get(id)||(window.__SHARDS__&&window.__SHARDS__[id]);
 if(!sh&&b.f){let g=GROUPS.get(b.f);if(!g){g=(window.__GROUPS__&&window.__GROUPS__[b.f])||fetch("data/articles/"+encodeURIComponent(b.f)+".json").then(r=>{if(!r.ok)throw new Error("تعذر تحميل المقال");return r.json()});GROUPS.set(b.f,g)}
  const gg=await g;if(!gg[id])throw new Error("المقال غير موجود في ملفه");sh={id,pages:gg[id].pages,toc:[]}}
 if(!sh){const q=encodeURIComponent(id)+".json"+(b.size?"?v="+b.size:"");let r=null;
  // مجلدات التراث الكبيرة تُحفظ في المستودع وتُقرأ من GitHub مباشرة (مخزن النصوص)، والاحتياط نسخة الموقع
  if(b.vf){try{r=await fetch("https://raw.githubusercontent.com/"+(CFG.repo||"dawah-library/sdsl-library")+"/main/vols/"+q)}catch(e){r=null}if(!r||!r.ok)r=await fetch("vols/"+q).catch(()=>null)}
  else r=await fetch("data/books/"+q);if(!r||!r.ok)throw new Error("تعذر تحميل النص");sh=await r.json()}
 SH.set(id,sh);attach(b,sh);return b}
async function loadMany(list,onP){const q=list.filter(b=>!b.pages),n=q.length;let i=0;if(!n)return;
 const w=async()=>{while(q.length){const b=q.shift();try{await loadBook(b.id)}catch(e){}onP&&onP(++i,n)}};await Promise.all([w(),w(),w()])}

/* ---------- عرض عام ---------- */
const view=(h,keep)=>{$("#app").innerHTML=h;if(!keep)window.scrollTo(0,0);Pager.entered()};
/* صورة المؤلف المصغرة: صورته إن أُضيفت، وإلا الحرف الأول بلون مميز */
// صورة مؤلف حُفظت للتو ولم يُنشر الموقع بعد: تُجلب مباشرة من المستودع
const RAWGH="https://raw.githubusercontent.com/"+(CFG.repo||"dawah-library/sdsl-library")+"/main/";
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&!t.dataset.fb&&/(^|\/)assets\/authors\//.test(t.getAttribute("src")||"")){t.dataset.fb=1;t.src=RAWGH+t.getAttribute("src").replace(/^\.?\//,"")}},true);
const avatar=(a,cls="")=>{a=a||{};const sh=(a.name||"").replace(/^(الإمام|الشيخ|شيخ الإسلام|الحافظ|الدكتور|د\.)\s*/,"");return a.photo?`<img class="aav ${cls}" src="${esc(a.photo)}" alt="${esc(a.name||"")}" loading="lazy">`:`<span class="aav ${cls}" style="${avHue(a.id||a.name||"")}" aria-hidden="true">${esc(sh[0]||"؟")}</span>`};
const bookCard=b=>`<a class="bk${bc(b)==="turath"?" tr":""}" href="#/book/${b.id}${S.lastBy&&S.lastBy[b.id]>1?"":"/1"}"><b>${esc(b.set?b.setTitle||b.title:b.title)}</b><span>${b.set?`<em class="tag">${b.vols===2?"مجلدان":toAr(b.vols)+" "+(b.vols>2&&b.vols<11?"مجلدات":"مجلدًا")}</em> • `:""}<span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${died(A(b.authorId))} • ${esc(T(b.topicId).name)}${b.n&&!b.set?` • ${b.n} صفحة`:""}${bc(b)==="turath"?' • <em class="tag">تراث</em>':""}${b.demo?' • <em class="tag">نص تجريبي</em>':""}${b.pdf?' • <em class="tag">مصور</em>':""}${b.ocr?' • <em class="tag">نص آلي</em>':""}</span></a>`;
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
 ${(()=>{const r=Object.entries(S.lastBy||{}).reverse().map(([id,p])=>[B(id),p]).filter(([b,p])=>b&&p>1).slice(0,4);return r.length?`<section class="resume"><h2>أكمل القراءة</h2><div class="resl">${r.map(([b,p])=>`<a class="bk" href="#/book/${b.id}/${p}"><b>${esc(b.setTitle?b.title:b.title)}</b><span>${esc(A(b.authorId).name)} • ${isArt(b)?"":"صفحة "+toAr(p)+(b.n?" من "+toAr(b.n):"")}</span>${b.n>1?`<i class="prog" style="--w:${Math.round(p/b.n*100)}%"></i>`:""}</a>`).join("")}</div></section>`:""})()}
 <div class="cols"><a class="col" href="#/library?c=dawah"><b>مكتبة الدعوة السلفية</b><span>كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور</span><em>${BOOKS().filter(b=>bc(b)==="dawah").length} كتاب</em></a>
 <a class="col ar" href="#/articles"><b>المقالات</b><span>مقالات صوت السلف، مقسمة بالموضوع والكاتب</span><em>${ARTS().length} مقال</em></a>
 <a class="col fw" href="#/fatawa"><b>الفتاوى</b><span>فتاوى مشايخ الدعوة بتقسيمها الفني وبحسب الشيخ</span><em>${FATWAS().length} فتوى</em></a>
 <a class="col tr" href="#/library?c=turath"><b>تراث</b><span>المكتبة الإسلامية العامة: كتب الإسلام الكبرى والمراجع المعتمدة</span><em>${BOOKS().filter(b=>bc(b)==="turath").length} كتاب</em></a></div>
 <a class="askcta" href="#/ask"><b>اسأل المكتبة</b><span>مساعد بحثي بالذكاء الاصطناعي يجيب من نصوص المكتبة مع الإحالة إلى الكتاب والصفحة. للأعضاء المسجلين.</span></a>
 <div class="grid"><a class="card" href="#/bayanat"><b>بيانات الدعوة</b><span>${BAYANAT().length} بيان</span></a><a class="card" href="#/furqan"><b>قضايا الفرقان</b><span>المؤلفات المنهجية</span></a><a class="card" href="#/tafrighat"><b>تفريغات</b><span>الدروس مفرّغة نصيًا</span></a><a class="card" href="#/posts"><b>منشورات</b><span>من صفحات المشايخ والكتّاب</span></a><a class="card" href="#/community"><b>مجتمع المكتبة</b><span>مختارات الأعضاء وتفاعلهم</span></a><a class="card" href="#/audio"><b>صوتيات المكتبة</b><span>استمع إلى الكتب</span></a><a class="card" href="#/radio"><b>راديو المكتبة</b><span>بث متواصل من الكتب</span></a><a class="card" href="#/tarajim"><b>تراجم مشايخ الدعوة</b><span>${Object.keys(TJ.items).length} ترجمة</span></a><a class="card" href="#/authors"><b>المؤلفون</b><span>${lib.authors.length} مؤلفًا ومصدرًا</span></a><a class="card" href="#/qabasat"><b>قبسات</b><span>صمّم اقتباسًا وانشره</span></a><a class="card" href="#/search"><b>بحث متقدم</b><span>في العناوين والنصوص</span></a><a class="card" href="#/favs"><b>المفضلة</b><span>${S.favs.length} عنصر</span></a></div>
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
  return`<h2>${title}</h2><div class="grid">${as.map(({a})=>`<a class="card acard" href="#/author/${a.id}" data-author="${a.id}">${avatar(a)}<div><b>${esc(a.name)}</b><span>${a.died?`ت ${a.died}هـ • `:""}${countLine(a.id)}</span></div></a>`).join("")}</div>`};
 view(`<p class="mut" style="margin-top:14px">اضغط مطولًا على اسم أي مؤلف لترى تعريفه الموجز. <a href="#/tarajim">تراجم مشايخ الدعوة</a></p>`+g("مشايخ الدعوة السلفية والكتّاب","dawah")+g("علماء التراث","turath"))}
function vAuthor(id,q){const a=A(id),mine=lib.books.filter(b=>b.authorId===id&&!VOL2(b)),byDate=l=>l.sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const T_={books:mine.filter(b=>kindOf(b)==="book"),articles:byDate(mine.filter(b=>kindOf(b)==="article")),fatawa:byDate(mine.filter(b=>kindOf(b)==="fatwa")),bayanat:byDate(mine.filter(b=>kindOf(b)==="statement")),tafrighat:mine.filter(isTranscript)};
 const NAMES={books:"الكتب",articles:"المقالات",fatawa:"الفتاوى",bayanat:"البيانات",tafrighat:"التفريغات"},ROUTE={articles:"articles",fatawa:"fatawa",bayanat:"bayanat"};
 const shown=Object.keys(T_).filter(k=>k==="books"||k==="articles"||T_[k].length);
 const k=shown.includes(q.k)?q.k:(shown.find(x=>T_[x].length)||"books"),items=T_[k];
 const tt=tj(id);view(`<div class="ahero">${avatar(a,"big")}<h2>${esc(a.name)}${died(a)}</h2>${typeof followBtn==="function"&&Cloud.on()?followBtn("a:"+id,false):""}${isAdmin()&&GH.on?`<button class="btn s nf" data-act="aphoto" data-id="${id}">📷 ${a.photo?"تغيير الصورة":"إضافة صورة"}</button>`:""}</div>${tt||a.bio?`<div class="abrief"><p>${esc((tt&&tt.brief)||a.bio)}</p>${tt?`<a class="btn s p" href="#/tarjama/${id}">الترجمة المفصلة</a>`:""}</div>`:""}
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
const uncOf=(b,i)=>(S.admin||isAdmin())&&b&&b.unc&&b.unc[String(i)]||null;
// صفحات فهرس الطبعة: سطر «العنوان ..... 12» يصير رابطًا إلى الصفحة المقابلة بترقيم الطبعة
const TOCL=/^#*\s*(.{3,150}?)\s*[.…·_\-ـ]{3,}\s*\(?([\d٠-٩]{1,4})\)?\s*$/,LBLMAP=new Map();
const arD=s=>+String(s).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
function pageByLabel(b,n){if(!b||!b.pages)return 0;let m=LBLMAP.get(b);if(!m){m=new Map();for(let i=0;i<b.pages.length;i++){const x=/([\d٠-٩]+)\s*$/.exec(PL(b,i)||"");if(x&&!m.has(arD(x[1])))m.set(arD(x[1]),i+1)}LBLMAP.set(b,m)}return m.get(n)||0}
// دمج الأسطر المكسورة: السطر الذي لا ينتهي بعلامة وقف يتصل بما بعده في فقرة واحدة
function joinLines(tx){if(S.merge===false)return tx;const L=tx.split("\n"),o=[];for(const l of L){const t=l.trim(),prev=o.length?o[o.length-1]:null;
 if(prev!==null&&t&&prev.trim()&&!/^#/.test(prev)&&!/^#|^[-•*]\s|^[(\[]?[\d٠-٩]{1,3}[)\].-]\s|^\*\*\*/.test(t)&&!/[.؟!:؛»)\]"*]\s*$/.test(prev)&&!/\s{3,}/.test(prev.trim())&&!TOCL.test(prev))o[o.length-1]=prev.trimEnd()+" "+t;else o.push(l)}return o.join("\n")}
/* التشكيل المدقق: نسخة مشكولة منفصلة عن نص الكتاب (data/tashkeel)، تُعرض مع «إظهار التشكيل» إذا طابقت بصمتُها نصَّ الصفحة الحالي */
const fnv=s=>{let h=0x811c9dc5;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}return h.toString(36)};
const TK={list:null,busy:false,ch:new Map(),
 raw:p=>"https://raw.githubusercontent.com/"+(CFG.repo||"dawah-library/sdsl-library")+"/main/data/tashkeel/"+p+"?t="+Math.floor(Date.now()/600e3),
 async init(){if(this.list||this.busy)return;this.busy=true;try{const r=await fetch(this.raw("_list.json"));this.list=r.ok?await r.json():{}}catch(e){this.list={}}if(Object.keys(this.list).length)refreshPage()},
 info(b){return this.list&&b&&this.list[b.id]},
 get(b,text){if(!this.list){this.init();return null}const inf=this.list[b.id];if(!inf||!b.pages||!(inf.ok||Cloud.staff()))return null;const i=b.pages.indexOf(text);if(i<0)return null;const k=Math.floor(i/50),key=b.id+"/"+k;
  if(!this.ch.has(key)){this.ch.set(key,null);fetch(this.raw(b.id+"/"+k+".json")).then(r=>r.ok?r.json():{}).catch(()=>({})).then(j=>{this.ch.set(key,j||{});refreshPage()});return null}
  const c=this.ch.get(key),e=c&&c[String(i+1)];return e&&e.h===fnv(text)?e.t:null}};
// النص كما يراه القارئ (بالتشكيل المدقق أو بدون تشكيل) — للنسخ والتصدير
const shownText=(b,i)=>{const t=b.pages[i]||"";return S.tash?(TK.get(b,t)||t):strip(t)};
const expTash=t=>S.tash?t:strip(t);
function pageHtml(text,h,uw,bk){if(!String(text||"").trim())return`<p class="mut emptyp">هذه الصفحة بلا نص في الكتاب (غلاف أو صفحة فارغة)، ويمكنك رؤيتها في النسخة المصورة.</p>`;const hs=norm(h||"").split(/\s+/).filter(Boolean),us=(uw||[]).map(x=>norm(x)).filter(Boolean);const tk=S.tash&&bk?TK.get(bk,text):null;const tx0=S.tash?(tk||text):strip(text);
 // الحواشي: ما بعد سطر الشرطات ____ يُعرض حواشي أسفل الصفحة (ظاهرة أو مطوية بحسب اختيار القارئ)
 const cut=tx0.search(/^\s*_{4,}\s*$/m),tx=cut>=0?tx0.slice(0,cut).trimEnd():tx0,fnt=cut>=0?tx0.slice(cut).replace(/^\s*_{4,}\s*\n?/,"").trim():"";
 const fnHtml=fnt?`<div class="fns${S.fn==="fold"?" fold":""}"><button class="fnt" data-act="fntoggle">الحواشي (${toAr(fnt.split("\n").filter(Boolean).length)})</button><div class="fnb">${fnt.split("\n").filter(Boolean).map(l=>`<p>${esc(l).replace(/^(\(?[\d٠-٩]{1,3}\)?)/,'<b>$1</b>')}</p>`).join("")}</div></div>`:"";
 const tocPg=bk&&tx.split("\n").filter(l=>TOCL.test(l.trim())).length>=4;
 return (tocPg?tx:joinLines(tx)).split("\n").map(line=>{const tm=tocPg&&TOCL.exec(line.trim()),tp=tm&&pageByLabel(bk,arD(tm[2]));if(tp)return`<p class="tocl"><a href="#/book/${bk.id}/${tp}"><span>${esc(tm[1].replace(/^#+\s*/,""))}</span><em>${toAr(arD(tm[2]))}</em></a></p>`;const h2=line.startsWith("## "),head=h2||line.startsWith("# "),l=h2?line.slice(3):head?line.slice(2):line;
  const inner=l.split(/(\s+)/).map(w=>w.trim()?`<span class="w${hs.length&&hs.some(k=>norm(w).includes(k))?" hit":""}${us.length&&us.some(k=>norm(w).includes(k))?" unc":""}">${fnt?esc(w).replace(/\(([\d٠-٩]{1,3})\)/g,'<sup class="fnr" data-fn="$1">($1)</sup>'):esc(w)}</span>`:w).join("");
  return head?`<p class="ph${h2?" ph2":""}">${inner}</p>`:`<p>${inner}</p>`}).join("")+fnHtml}
function chapterOf(b,p){let c="";(b.toc||[]).forEach(x=>{if(x.p<=p)c=x.t});return c}
/* ---------- النسخة المصورة (PDF) ---------- */
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFDOCS=new Map();
async function pdfDoc(url){url=new URL(url,document.baseURI).href;// pdf.js يحلّ الرابط من عنوان الصفحة لا من <base>، فنعطيه رابطًا كاملًا
if(!window.pdfjsLib){await loadScript(PDFJS);window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS.replace("pdf.min.js","pdf.worker.min.js")}
 let d=PDFDOCS.get(url);if(!d){d=window.pdfjsLib.getDocument(url).promise;PDFDOCS.set(url,d)}return d}
function pdfPageFor(b,p){const off=+b.pdfOffset||0,m=b.pdfByLabel&&b.pl&&/(\d+)\s*$/.exec(b.pl[p-1]||"");return(m?+m[1]:p)+off}
function pdfCap(b,n,N){return`<p class="mut pdfcap">صفحة ${toAr(n)} من ${toAr(N)} في النسخة المصورة • ${b.img?`<button class="lnk" data-act="pdfdl">تنزيل الكتاب المصور</button>`:`<a href="${esc(b.pdf)}#page=${n}" target="_blank" rel="noopener">فتح الملف كاملًا</a>`}</p>${isAdmin()?`<div class="pdfcal"><span>هل الصورة تطابق النص؟ اضبطها:</span><button class="btn s" data-act="pdfoff" data-d="-1">الصورة السابقة</button><button class="btn s" data-act="pdfoff" data-d="1">الصورة التالية</button><button class="btn s p" data-act="pdfoffsave">حفظ المطابقة (${(+b.pdfOffset||0)>=0?"+":""}${toAr(+b.pdfOffset||0)})</button></div>`:""}`}
// صور الصفحات في المخزن الخاص: روابط مؤقتة موقَّعة يطلبها العضو المسجل من /api/pages (عشر صفحات في الطلب)
const PSIGN=new Map();
async function pimgUrl(b,n){const k=b.id+"|"+n,c=PSIGN.get(k);if(c&&c.exp>Date.now())return c.u;
 const from=Math.max(1,n-2),r=await fetch(`/api/pages?b=${encodeURIComponent(b.id)}&from=${from}&n=12`,{headers:{Authorization:"Bearer "+(Auth.token||"")}});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||"تعذر تحميل الصفحة المصورة");const exp=Date.now()+(j.ttl-120)*1000;
 Object.entries(j.urls||{}).forEach(([p,u])=>PSIGN.set(b.id+"|"+p,{u,exp}));return(PSIGN.get(k)||{}).u}
async function pdfDl(b){const r=await fetch(`/api/pages?b=${encodeURIComponent(b.id)}&n=1&pdf=1`,{headers:{Authorization:"Bearer "+(Auth.token||"")}});const j=await r.json();if(!r.ok)throw new Error(j.message);window.open(j.pdf,"_blank","noopener")}
async function renderPdf(b,p){const box=$("#pdfv");if(!box)return;box.innerHTML='<p class="mut" style="text-align:center;padding:30px 0">جارٍ تحميل الصفحة المصورة…</p>';
 if(b.img){// صور الصفحات من مخزن المكتبة: صفحة واحدة خفيفة بدل الملف كله
  const n=pdfPageFor(b,p),N=+b.imgN||0;if(n<1||(N&&n>N)){box.innerHTML='<p class="note">لا توجد صفحة مصورة مقابلة لهذه الصفحة.</p>';return}
  const im=new Image();im.alt="الصفحة المصورة "+n;im.decoding="async";im.className="pimg";
  im.onload=()=>{if(!$("#pdfv"))return;box.innerHTML="";const a=document.createElement("a");a.href=im.src;a.target="_blank";a.rel="noopener";a.appendChild(im);box.appendChild(a);box.insertAdjacentHTML("beforeend",pdfCap(b,n,N||n))};
  im.onerror=()=>{const el=$("#pdfv");if(el)el.innerHTML='<p class="note">تعذر تحميل الصفحة المصورة. تحقق من الاتصال.</p>'};
  if(!Auth.user){box.innerHTML='<p class="note">النسخة المصورة لأعضاء المكتبة. <a href="#/account">سجّل الدخول</a>.</p>';return}
  try{im.src=await pimgUrl(b,n);[n+1,n+2].forEach(k=>{if(!N||k<=N)pimgUrl(b,k).then(u=>{new Image().src=u}).catch(()=>{})})}catch(e){box.innerHTML='<p class="note">'+esc(e.message)+'</p>'}return}
 try{const doc=await pdfDoc(b.pdf),n=pdfPageFor(b,p);if(!$("#pdfv"))return;if(n<1||n>doc.numPages){box.innerHTML='<p class="note">لا توجد صفحة مصورة مقابلة لهذه الصفحة.</p>';return}
  const pg=await doc.getPage(n),w=Math.max(280,box.clientWidth||600),vp0=pg.getViewport({scale:1}),sc=w/vp0.width*Math.min(2,window.devicePixelRatio||1),vp=pg.getViewport({scale:sc});
  const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;if(!$("#pdfv"))return;
  box.innerHTML="";box.appendChild(c);box.insertAdjacentHTML("beforeend",pdfCap(b,n,doc.numPages))}
 catch(e){console.warn('pdf',e&&e.message||e);const el=$("#pdfv");if(el)el.innerHTML='<p class="note">تعذر تحميل النسخة المصورة. تحقق من الاتصال.</p>'}}
async function savePdfOffset(b,el){if(!GH.on)return alert("فعّل الإدارة المباشرة أولًا.");const off=+b.pdfOffset||0,ids=b.set&&!b.vf?lib.books.filter(x=>x.set===b.set&&x.pdf===b.pdf).map(x=>x.id):[b.id];el.disabled=true;
 try{await GH.editJSON("data/catalog.json",c=>{let n=0;c.books.forEach(x=>{if(ids.includes(x.id)){x.pdfOffset=off;n++}});if(!n)throw new Error("الكتاب غير موجود في الفهرس المنشور.");c.version=Date.now();return c},"مطابقة الصفحات المصورة: "+(b.setTitle||b.title),true);toast("حُفظت المطابقة: كل صفحات الكتاب تنتقل الآن إلى صورتها الصحيحة")}catch(e){alert(e.message)}finally{el.disabled=false}}
/* بطاقة التعريف بالكتاب */
function cardSheet(){const c=cur();if(!c)return;closeSheet();const b=c.b,k=b.card||{},a=A(b.authorId),R=(t,v)=>v?`<tr><th>${t}</th><td>${esc(Array.isArray(v)?v.join("، "):v)}</td></tr>`:"";
 const mains=(b.toc||[]).filter(x=>x.l!==2);
 openSheet("بطاقة الكتاب",`<div class="bcard"><h3>${esc(k.title||b.setTitle||b.title)}</h3>${k.subtitle?`<p class="mut">${esc(k.subtitle)}</p>`:""}
 <a class="alink" href="#/author/${b.authorId}" data-act="closeSheet">${avatar(a,"sm")}${esc(a.name)}</a>
 ${k.summary?`<p class="bsum">${esc(k.summary)}</p>`:'<p class="mut">لم تُنشأ بطاقة تعريف مفصلة لهذا الكتاب بعد.</p>'}
 <table class="btab">${R("تقديم",k.intro_by)}${R("تحقيق ومراجعة",k.editor)}${R("الناشر",k.publisher)}${R("الطبعة",k.edition)}${R("سنة الطبع",k.year)}${R("الموضوع",T(b.topicId).name)}${R("عدد الصفحات",toAr(b.pages.length)+(k.printed_pages?" (المطبوع: "+k.printed_pages+")":""))}${R("لمن يُنصح به",k.audience)}${R("المصدر",b.source)}</table>
 ${k.parts&&k.parts.length?`<h4>أهم المحاور</h4><ul>${k.parts.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:mains.length?`<h4>أبواب الكتاب</h4><ul>${mains.slice(0,12).map(x=>`<li><a href="#/book/${b.id}/${x.p}" data-act="closeSheet">${esc(x.t)}</a></li>`).join("")}</ul>`:""}
 ${k.keywords&&k.keywords.length?`<div class="chips">${k.keywords.map(x=>`<a class="chip" href="#/search?q=${encodeURIComponent(x)}" data-act="closeSheet">${esc(x)}</a>`).join("")}</div>`:""}
 <div class="row" style="margin-top:12px">${b.toc&&b.toc.length?'<button class="btn nf" data-act="toc">الفهرس</button>':""}${b.pdf?'<button class="btn nf" data-act="pv" data-pv="both">النص والمصورة معًا</button>':""}<button class="btn nf" data-act="plan">مشروع قراءة</button></div></div>`)}
const PV_NAMES={text:"النص",pdf:"المصورة",both:"الاثنان"};
function nextPv(cur){const wide=matchMedia("(min-width:1000px)").matches;return cur==="text"?"pdf":cur==="pdf"&&wide?"both":"text"}

/* ---------- الإدارة المباشرة عبر GitHub ---------- */
const GH={repo:CFG.repo||"dawah-library/sdsl-library",branch:CFG.branch||"main",
 get token(){return ls.get("ghtoken","")},set token(v){ls.set("ghtoken",v||"")},
 get proxied(){return!this.token&&typeof Cloud!=="undefined"&&Cloud.staff()&&CFG.ghProxy!==""},
 get on(){return!!this.token||this.proxied},
 async api(path,opt={}){const r=this.proxied?await fetch((CFG.ghProxy||"api/gh")+"?p="+encodeURIComponent(path),{method:opt.method||"GET",body:opt.body,headers:{"Content-Type":"application/json",Authorization:"Bearer "+(Auth.token||""),Accept:(opt.headers&&opt.headers.Accept)||"application/json"}}):await fetch("https://api.github.com/repos/"+this.repo+path,Object.assign({},opt,{headers:Object.assign({Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},opt.headers||{})}));
  if(!r.ok){let m="";try{m=(await r.json()).message}catch(e){}throw new Error(r.status===401?"المفتاح غير صالح أو منتهي.":r.status===403||r.status===404?"لا يملك المفتاح صلاحية الكتابة على المستودع.":r.status===409?"تعارض مع تعديل آخر، أعد المحاولة.":("خطأ "+r.status+" "+m))}return r},
 async verify(){if(this.proxied)return{};const r=await this.api("");const j=await r.json();if(!j.permissions||!j.permissions.push)throw new Error("المفتاح لا يملك صلاحية الكتابة.");return j},
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
 else{const path=(b.vf?"vols/":"data/books/")+b.id+".json";await GH.editJSON(path,sh=>{sh.pages[i]=text;if(sh.unc){delete sh.unc[String(i)];if(!Object.keys(sh.unc).length)delete sh.unc}if(sh.unrev)sh.unrev=sh.unrev.filter(x=>x!==i);return sh},"تصحيح ص "+(i+1)+": "+b.title,true)}
 b.pages[i]=text;if(b.unc)delete b.unc[String(i)]}

/* ---------- أدوات القراءة: الشريط الثابت واللوحات المنزلقة ---------- */
const IC={toc:'<path d="M4 6h16M4 12h16M4 18h10"/>',prev:'<path d="M9 6l6 6-6 6"/>',next:'<path d="M15 6l-6 6 6 6"/>',look:'<path d="M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M16 16h4"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',exit:'<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',pdf:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 15l3-3 2 2 3-4"/><circle cx="9.5" cy="8" r="1.3"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
function lookHtml(){return`<div class="row"><div><label for="lf">نوع الخط</label><select id="lf">${fontOpts(S.font)}</select></div>
 <div><label for="lth">المظهر</label><select id="lth"><option value="auto"${S.theme==="auto"?" selected":""}>تلقائي</option><option value="light"${S.theme==="light"?" selected":""}>نهاري</option><option value="dark"${S.theme==="dark"?" selected":""}>ليلي</option></select></div></div>
 <label>حجم الخط</label><div class="stepper"><button class="btn" data-sz="-1" aria-label="تصغير الخط">أ−</button><input id="ls" type="range" min="1" max="2.4" step=".05" value="${S.size}" aria-label="حجم الخط"><button class="btn" data-sz="1" aria-label="تكبير الخط">أ+</button></div>
 <label for="ll">تباعد الأسطر</label><input id="ll" type="range" min="1.5" max="3" step=".1" value="${S.lh}">
 <label>لون الصفحة</label><div class="swatches">${PAGES.map(p=>`<button class="swc" data-pg="${p[0]}" title="${p[1]}" aria-label="لون الصفحة: ${p[1]}" aria-pressed="${S.pg===p[0]}" style="background:${p[2]}"></button>`).join("")}</div>
 <label for="lmode">طريقة التنقل بين الصفحات</label><div class="seg" id="lmode" role="radiogroup">${[["page","أفقي: صفحة صفحة"],["scroll","عمودي: تمرير متصل"]].map(([v,t])=>`<button type="button" role="radio" data-mode="${v}" aria-checked="${(S.mode||"page")===v}">${t}</button>`).join("")}</div>
 <label class="inl"><input type="checkbox" id="lfmt"${S.fmt!=="plain"?" checked":""}> تنسيق الكتاب المطبوع (محاذاة الأسطر، وبداية الفقرة، وتوسيط العناوين)</label>
 <label class="inl"><input type="checkbox" id="lt"${S.tash?" checked":""}> إظهار التشكيل</label>
 <label class="inl"><input type="checkbox" id="lfn"${S.fn==="fold"?" checked":""}> طيّ الحواشي (تُفتح بالضغط)</label>`}
function wireLook(){const up=()=>{S.font=$("#lf").value;S.size=+$("#ls").value;S.lh=+$("#ll").value;S.tash=$("#lt").checked;S.fn=$("#lfn")&&$("#lfn").checked?"fold":"show";S.fmt=$("#lfmt")&&!$("#lfmt").checked?"plain":"print";S.theme=$("#lth").value;saveS();applyLook();refreshPage()};
 ["#lf","#ls","#ll","#lt","#lth","#lfn","#lfmt"].forEach(i=>{const e=$(i);if(e)e.oninput=e.onchange=up});
 $$("[data-sz]").forEach(b=>b.onclick=()=>{const r=$("#ls");r.value=Math.max(1,Math.min(2.4,+r.value+(+b.dataset.sz)*.1));up()});
 $$(".swc").forEach(s=>s.onclick=()=>{S.pg=s.dataset.pg;saveS();applyLook();$$(".swc").forEach(x=>x.setAttribute("aria-pressed",x===s))});
 $$("[data-mode]").forEach(m=>m.onclick=()=>{if(S.mode===m.dataset.mode)return;S.mode=m.dataset.mode;saveS();$$("[data-mode]").forEach(x=>x.setAttribute("aria-checked",x===m));const c=cur();closeSheet();if(c){LASTREAD=null;history.replaceState(null,"","/book/"+c.b.id+"/"+c.p);route()}})}
function refreshPage(){$$(".rd[data-id]").forEach(rb=>{const b=B(rb.dataset.id);if(b&&b.pages){rb.innerHTML=pageHtml(b.pages[+rb.dataset.p-1],parse().q.h,uncOf(b,+rb.dataset.p-1),b);paintNotes(rb)}})}
/* شريط تقدم القراءة أعلى الشاشة */
function setProg(b,p){let el=$("#rprog");if(!el){document.body.insertAdjacentHTML("beforeend",'<div id="rprog" aria-hidden="true"><i></i></div>');el=$("#rprog")}const n=b.pages.length;el.hidden=n<2;el.firstChild.style.width=(n>1?Math.round(p/n*1000)/10:0)+"%"}
/* وضع التمرير العمودي المتصل: الصفحات تتتابع، والصفحة الظاهرة هي الحالية */
const SCR={io:null,more:null};
function spgHtml(b,k,h){const lb=PL(b,k-1),ch=chapterOf(b,k);return`<section class="spg" data-p="${k}"${ch?` data-ch="${esc(ch)}"`:""}><div class="spn">صفحة ${toAr(k)}${lb?` <small>${esc(lb)}</small>`:""}</div><div class="rd" data-id="${b.id}" data-p="${k}">${pageHtml(b.pages[k-1],h,uncOf(b,k-1),b)}</div></section>`}
function scrSet(b,k){const sec=$(`.spg[data-p="${k}"]`);if(!sec)return;const old=$("#rb");if(old&&old!==sec.querySelector(".rd"))old.removeAttribute("id");sec.querySelector(".rd").id="rb";
 if(LASTREAD&&LASTREAD.p===k)return;LASTREAD={id:b.id,p:k};S.last={id:b.id,p:k};S.lastBy=Object.assign({},S.lastBy||{});delete S.lastBy[b.id];S.lastBy[b.id]=k;saveS();
 const n=b.pages.length,pg=$(".pgb b");if(pg)pg.textContent=toAr(k);const pr=$("[data-act=prev]"),nx=$("[data-act=next]");if(pr)pr.disabled=k<=1;if(nx)nx.disabled=k>=n;
 const rc=$(".run span:last-child");if(rc)rc.textContent=chapterOf(b,k);setProg(b,k);paintMark();Mine.touch(b.id,k);
 const h=parse().q.h;history.replaceState(null,"","/book/"+b.id+"/"+k+(h?"?h="+encodeURIComponent(h):""))}
function scrAdd(b,dir){const box=$("#scr");if(!box)return null;const h=parse().q.h,ps=[...box.children].map(x=>+x.dataset.p);
 if(dir>0){const last=Math.max(...ps);if(last>=b.pages.length)return null;let html="";for(let k=last+1;k<=Math.min(b.pages.length,last+3);k++)html+=spgHtml(b,k,h);box.insertAdjacentHTML("beforeend",html);[...box.children].slice(-3).forEach(x=>{SCR.io&&SCR.io.observe(x);paintNotes(x.querySelector(".rd"))});if(Math.max(...[...box.children].map(x=>+x.dataset.p))>=b.pages.length&&$("#scrs")){$("#scrs").hidden=true;const e=$("#scend");if(e)e.hidden=false}return true}
 const first=Math.min(...ps);if(first<=1)return null;const y0=document.documentElement.scrollHeight;box.insertAdjacentHTML("afterbegin",spgHtml(b,first-1,h));window.scrollBy(0,document.documentElement.scrollHeight-y0);SCR.io&&SCR.io.observe(box.firstElementChild);paintNotes(box.firstElementChild.querySelector(".rd"));const up=$("#scrup");if(up)up.hidden=first-1<=1;return true}
function scrWire(b){if(SCR.io)SCR.io.disconnect();if(SCR.more)SCR.more.disconnect();
 SCR.io=new IntersectionObserver(es=>{if(!$("#scr"))return SCR.io.disconnect();const top=[...$$("#scr .spg")].filter(x=>x.getBoundingClientRect().top<innerHeight*.45).pop();if(top)scrSet(b,+top.dataset.p)},{rootMargin:"0px 0px -50% 0px",threshold:[0,.01,.5,1]});
 $$("#scr .spg").forEach(x=>SCR.io.observe(x));
 const sen=$("#scrs");if(sen){SCR.more=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))scrAdd(b,1)},{rootMargin:"900px 0px"});SCR.more.observe(sen)}}
function ensureSheet(){if($("#sheet"))return;document.body.insertAdjacentHTML("beforeend",`<div class="sheet-bg" id="sheetbg" hidden data-act="closeSheet"></div><section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT" hidden><div class="sheet-h"><b id="sheetT"></b><button class="btn s" data-act="closeSheet" aria-label="إغلاق">✕</button></div><div class="sheet-b" id="sheetB"></div></section>`)}
function openSheet(title,html,wire){ensureSheet();$("#sheetT").textContent=title;$("#sheetB").innerHTML=html;$("#sheet").hidden=false;$("#sheetbg").hidden=false;document.body.classList.add("sheet-open");if(wire)wire();const f=$("#sheet").querySelector("input,select,button:not([data-act=closeSheet])");if(f&&f.tagName!=="BUTTON")f.focus()}
function closeSheet(){if(!$("#sheet"))return;$("#sheet").hidden=true;$("#sheetbg").hidden=true;document.body.classList.remove("sheet-open")}
function cur(){const rb=$("#rb");return rb?{b:B(rb.dataset.id),p:+rb.dataset.p}:null}
function tocSheet(){const c=cur();if(!c)return;const b=c.b,ch=chapterOf(b,c.p);
 const vols=b.set?lib.books.filter(x=>x.set===b.set).sort((x,y)=>x.vol-y.vol):[];
 const mains=(b.toc||[]).filter(x=>x.l!==2),curM=[...mains].reverse().find(x=>x.p<=c.p),prevC=curM?[...mains].reverse().find(x=>x.p<curM.p):null,nextC=mains.find(x=>x.p>c.p);
 openSheet("فهرس الكتاب",`${mains.length>1?`<div class="row chnav">${prevC?`<a class="btn nf" href="#/book/${b.id}/${prevC.p}" data-act="closeSheet">→ الفصل السابق</a>`:""}${nextC?`<a class="btn nf" href="#/book/${b.id}/${nextC.p}" data-act="closeSheet">الفصل التالي ←</a>`:""}</div>`:""}${vols.length?`<div class="volbar"><b>المجلدات</b><div class="chips">${vols.map(x=>`<a class="chip${x.id===b.id?" x":""}" href="#/book/${x.id}/1" data-act="closeSheet">${x.vol?"ج "+toAr(x.vol):"المقدمة"}</a>`).join("")}</div></div>`:""}<div class="seg ixseg" id="ixseg" hidden></div><input type="search" id="tocq" placeholder="ابحث في الفهرس" aria-label="ابحث في الفهرس"><div class="toclist" id="ixlist" hidden></div><div class="toclist" id="toclist">${(b.toc||[]).map(x=>`<a href="#/book/${b.id}/${x.p}" class="${x.t===ch?"on":""}${x.l===2?" l2":""}" data-act="closeSheet">${esc(x.t)} <span class="mut">${esc(PL(b,x.p-1)||"ص "+x.p)}</span></a>`).join("")||'<p class="mut">لا يوجد فهرس لهذا الكتاب.</p>'}</div>`,
 ()=>{$("#tocq").oninput=e=>{const q=norm(e.target.value);$$("#toclist a,#ixlist a").forEach(a=>a.hidden=q&&!norm(a.textContent).includes(q))};const on=$("#toclist a.on");if(on)on.scrollIntoView({block:"center"});ixTabs(b)})}
// الفهارس الفنية الآلية: الآيات والأحاديث والأعلام (data/idx)
let IXL=null;const IXC=new Map();
async function ixTabs(b){try{if(!IXL)IXL=await (await fetch("data/idx/_list.json")).json()}catch(e){IXL={}}const n=IXL[b.id],seg=$("#ixseg");if(!n||!seg)return;
 const T=[["toc","الأبواب",(b.toc||[]).length],["q","الآيات",n[0]],["h","الأحاديث",n[1]],["a","الأعلام",n[2]]].filter(x=>x[2]);if(T.length<2)return;
 seg.innerHTML=T.map(([k,t,c],i)=>`<button type="button" data-ix="${k}" aria-checked="${i===0}">${t} <small>${toAr(c)}</small></button>`).join("");seg.hidden=false;
 seg.onclick=async e=>{const t=e.target.closest("[data-ix]");if(!t)return;$$("#ixseg button").forEach(x=>x.setAttribute("aria-checked",x===t));const k=t.dataset.ix,L=$("#ixlist"),TL=$("#toclist");$("#tocq").value="";
  if(k==="toc"){L.hidden=true;TL.hidden=false;return}TL.hidden=true;L.hidden=false;L.innerHTML='<p class="mut">جارٍ التحميل…</p>';
  let ix=IXC.get(b.id);if(!ix){try{ix=await (await fetch("data/idx/"+b.id+".json?v="+(b.size||0))).json();IXC.set(b.id,ix)}catch(x){L.innerHTML='<p class="note">تعذر تحميل الفهرس.</p>';return}}
  const pg=p=>`<span class="mut">${esc(PL(b,p-1)||"ص "+toAr(p))}</span>`,go=p=>`href="#/book/${b.id}/${p}" data-act="closeSheet"`;
  L.innerHTML=(k==="q"?ix.q.map(([t,r,p])=>`<a ${go(p)}><span class="ixq">﴿${esc(t)}﴾</span>${r?` <em class="ixr">[${esc(r)}]</em>`:""} ${pg(p)}</a>`):k==="h"?ix.h.map(([t,p])=>`<a ${go(p)}>«${esc(t)}» ${pg(p)}</a>`):ix.a.map(([t,ps])=>`<a ${go(ps[0])}>${esc(t)} <span class="mut">${ps.slice(0,8).map(p=>esc(PL(b,p-1)||toAr(p))).join("، ")}${ps.length>8?"…":""}</span></a>`)).join("")+'<p class="mut ixn">فهرس مستخرج آليًا، وقد يفوته شيء أو يدخله ما ليس منه.</p>'}}
function gotoSheet(){const c=cur();if(!c)return;const n=c.b.pages.length;
 openSheet("الانتقال إلى صفحة",`<form data-form="goto" data-id="${c.b.id}"><div class="stepper"><input id="gp" name="p" type="number" min="1" max="${n}" value="${c.p}" aria-label="رقم الصفحة"><span class="mut">من ${n}</span><button class="btn p">انتقال</button></div><input id="gr" type="range" min="1" max="${n}" value="${c.p}" aria-label="شريط الصفحات"><p class="mut" id="gl">${esc(PL(c.b,c.p-1)||"")} ${esc(chapterOf(c.b,c.p))}</p></form>`,
 ()=>{const sync=v=>{$("#gp").value=v;$("#gr").value=v;$("#gl").textContent=(PL(c.b,v-1)||"")+" "+chapterOf(c.b,v)};$("#gr").oninput=e=>sync(+e.target.value);$("#gp").oninput=e=>sync(Math.max(1,Math.min(n,+e.target.value||1)))})}
function moreSheet(){const c=cur();if(!c)return;const b=c.b,art=isArt(b),fav=S.favs.includes(b.id);
 openSheet("أدوات القراءة",`${b.pages.length>1?`<form class="stepper" data-form="inbook" data-id="${b.id}"><input name="h" type="search" value="${esc(parse().q.h||"")}" placeholder="بحث داخل ${art?"المقال":"الكتاب"}" aria-label="بحث داخل الكتاب"><button class="btn p">بحث</button></form>`:""}
 <div class="tools-grid">
  <button data-act="tashtog">${S.tash?"إخفاء التشكيل":"إظهار التشكيل"}${TK.info(b)?` <small class="mut">(مشكول ${toAr(Math.round(100*TK.info(b).n/Math.max(1,TK.info(b).of)))}٪)</small>`:""}</button>
  ${bc(b)!=="dawah"&&!art&&!TK.info(b)?`<button data-act="tkreq" data-id="${b.id}">✍️ اطلب تشكيل هذا الكتاب</button>`:""}
  <button data-act="fav">${fav?"★ إزالة من المفضلة":"☆ إضافة للمفضلة"}</button>
  <button data-act="copyp">نسخ ${art?"المقال":"الصفحة"}</button>
  ${art?"":'<button data-act="card">بطاقة الكتاب</button>'}
  <button data-act="mark">علامة على هذه الصفحة</button>
  <button data-act="plan">مشروع قراءة وتذكير</button>
  <button data-act="tts">استمع (قراءة صوتية)</button>
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
 const n=b.pages.length;p=Math.max(1,Math.min(n,p||(S.lastBy&&S.lastBy[id])||1));const art=isArt(b);
 let pv=b.pdf&&Auth.user?(S.pv||"text"):"text";
 const scroll=S.mode==="scroll"&&pv==="text"&&!art&&n>1;
 const same=LASTREAD&&LASTREAD.id===id,dir=same?(p>LASTREAD.p?"slide-l":p<LASTREAD.p?"slide-r":""):"";LASTREAD={id,p};S.last={id,p};S.lastBy=Object.assign({},S.lastBy||{});delete S.lastBy[id];S.lastBy[id]=p;{const ks=Object.keys(S.lastBy);if(ks.length>40)delete S.lastBy[ks[0]]}saveS();
 const a=A(b.authorId),label=PL(b,p-1),chap=chapterOf(b,p),fatwa=b.fa||/^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c||"");
 const head=art?"":`<div class="rhead"><h2>${esc(b.title)}</h2><div class="mut"><a class="alink" href="#/author/${b.authorId}" data-author="${b.authorId}">${avatar(a,"sm")}${esc(a.name)}${died(a)}</a> • <a href="#/library?c=${bc(b)}&t=${b.topicId}">${esc(T(b.topicId).name)}</a> • ${COL[bc(b)]} • <button class="linkbtn" data-act="card">بطاقة الكتاب</button></div>${b.card&&b.card.summary&&p===1?`<p class="rsum">${esc(b.card.summary)}</p>`:""}${b.demo?'<p class="note">هذا نص تجريبي يُستبدل بالنص المعتمد.</p>':""}</div>`;
 const ahead=art?`<div class="ahead"><h1>${esc(b.title)}</h1><div><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}</a>${b.date?" • "+fmtDate(b.date):""} • <a href="#/articles?t=${b.topicId}">${esc(T(b.topicId).name)}</a>${b.url?` • <a href="${esc(b.url)}" target="_blank" rel="noopener">المصدر</a>`:""}</div>${fatwa?'<div class="src-note">من فتاوى موقع صوت السلف</div>':""}</div>`:"";
 const B_=(act,ic,txt,dis)=>`<button data-act="${act}"${dis?" disabled":""}>${svg(ic)}<span>${txt}</span></button>`;
 view(`${head}
 <div class="desk"><article class="paper${art?" art":""}${scroll?" scroll":""} ${scroll?"":dir}" id="paper" aria-label="صفحة ${p}">
  ${b.pdf?`<div class="seg pvseg" role="radiogroup" aria-label="طريقة العرض">${[["text","النص"],["pdf",Auth.user?"المصورة":"المصورة 🔒"],["both",Auth.user?"معًا":"معًا 🔒"]].map(([k,t])=>`<button type="button" role="radio" data-act="pv" data-pv="${k}" aria-checked="${pv===k}">${t}</button>`).join("")}</div>`:""}
  <button class="ribbon" id="ribbon" data-act="mark" aria-label="علامة الصفحة" title="ضع علامة على هذه الصفحة"></button>
  ${art?ahead:`<div class="run"><span>${esc(b.title)}</span><span>${esc(chap)}</span></div>`}<a class="markgo" id="markgo" hidden></a>
  ${scroll?`${p>1?`<button class="btn s scrup" id="scrup" data-act="scrup">↑ الصفحة السابقة</button>`:""}<div id="scr">${(()=>{let x="";for(let k=p;k<=Math.min(n,p+2);k++)x+=spgHtml(b,k,h);return x})().replace('class="rd"','class="rd" id="rb"')}</div><div id="scrs" class="mut scrs"${p+2>=n?" hidden":""}>جارٍ تحميل الصفحات التالية…</div>`:pv==="text"?`<div class="rd" id="rb" data-id="${id}" data-p="${p}">${pageHtml(b.pages[p-1],h,uncOf(b,p-1),b)}</div><div class="trv" id="trv" hidden></div>`:`<div class="pbody ${pv}"><div class="rd" id="rb" data-id="${id}" data-p="${p}"${pv==="pdf"?" hidden":""}>${pageHtml(b.pages[p-1],h,uncOf(b,p-1),b)}</div><div class="pdfv" id="pdfv"></div></div><div class="trv" id="trv" hidden></div>`}
  ${b.ocr?'<p class="mut ocrn">هذا النص محوَّل آليًا من النسخة المصورة وقد يحتوي أخطاء؛ قارنه بالمصورة عند النقل.</p>':""}
  ${scroll?`<div class="foot" id="scend"${p+2>=n?"":" hidden"}>— تمّ الكتاب —</div>`:n>1||!art?`<div class="foot">— ${toAr(p)} —${label?`<small>${esc(label)}${b.pl?" في المطبوع":""}</small>`:""}</div>`:""}
 </article></div>
 <p class="mut hint">${scroll?"مرّر لأسفل لتتابع الصفحات • ":n>1?"اسحب الصفحة للتقليب • ":""}اضغط أي كلمة لمعناها • حدّد نصًا لتجعله قبسة</p>
 <nav class="rbar2" id="rbar" aria-label="أدوات القراءة">
  ${B_("toc","toc","الفهرس",!(b.toc&&b.toc.length))}
  ${B_("prev","prev","السابقة",p<=1)}
  <button data-act="goto" class="pgb"${n>1?"":" disabled"}><b>${toAr(p)}</b><span>من ${toAr(n)}</span></button>
  ${B_("next","next","التالية",p>=n)}
  ${B_("look","look","المظهر")}
  ${b.pdf?B_("pview","pdf",pv==="text"?"المصورة":"النص"):""}
  ${B_("more","more","المزيد")}
  ${B_("full",S.full?"exit":"full",S.full?"خروج":"ملء الشاشة")}
 </nav>`,same);
 document.body.classList.toggle("reading-full",!!S.full);setProg(b,p);
 if(scroll){scrWire(b);if(p>1&&!same){const s0=$(`.spg[data-p="${p}"]`);if(s0){const y=s0.getBoundingClientRect().top+scrollY-(S.full?8:96);scrollTo(0,y)}}}
 if(pv!=="text")renderPdf(b,p);if(S.tr)renderTr(b,p);
 paintMark();$$(".rd[data-id]").forEach(r=>paintNotes(r));Mine.touch(id,p);
 if(TTS.cont){TTS.cont=false;setTimeout(()=>TTS.next(),400)}else if(TTS.on&&!same)TTS.stop();
 if(same){const pp=$("#paper");if(pp){const y=pp.getBoundingClientRect().top+window.scrollY-(S.full?8:110);if(window.scrollY>y)window.scrollTo(0,y)}}
 const pp=$("#paper");let sx=0,sy=0;pp.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
 pp.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&!String(getSelection()))turn(dx>0?1:-1)},{passive:true})}
/* ---------- القارئ الصوتي (صوت الجهاز، مجاني) ---------- */
const TTS={on:false,paused:false,i:0,cont:false,rate:+(ls.get("ttsRate",1))||1,
 voice(){const vs=speechSynthesis.getVoices();return vs.find(v=>/^ar(-|_|$)/i.test(v.lang)&&/natural|premium|enhanced|maged|tarik|laila|hamed|zariyah/i.test(v.name))||vs.find(v=>/^ar/i.test(v.lang))},
 start(){if(!("speechSynthesis"in window))return toast("المتصفح لا يدعم القراءة الصوتية");if(!$("#rb"))return;speechSynthesis.cancel();this.on=true;this.paused=false;this.i=0;this.bar();this.next()},
 bar(){let b=$("#ttsbar");if(!b){document.body.insertAdjacentHTML("beforeend",`<div id="ttsbar" role="region" aria-label="القارئ الصوتي"><button data-act="ttsp" id="ttsp" aria-label="إيقاف مؤقت">⏸</button><span>القراءة الصوتية</span><select id="ttsr" aria-label="السرعة">${[.75,.9,1,1.15,1.3,1.5].map(r=>`<option value="${r}"${r===this.rate?" selected":""}>${toAr(r)}×</option>`).join("")}</select><button data-act="ttss" aria-label="إنهاء">✕</button></div>`);b=$("#ttsbar");$("#ttsr").onchange=e=>{this.rate=+e.target.value;ls.set("ttsRate",this.rate);if(this.on&&!this.paused){speechSynthesis.cancel();this.next()}}}b.hidden=false},
 next(){if(!this.on)return;const rb=$("#rb");if(!rb)return this.stop();const ps=[...rb.querySelectorAll(":scope > p")];
  if(this.i>=ps.length){const b=B(rb.dataset.id),p=+rb.dataset.p;if(b&&p<b.pages.length){this.i=0;if($("#scr")){turn(1);setTimeout(()=>this.next(),350)}else{this.cont=true;turn(1)}}else this.stop();return}
  ps.forEach(x=>x.classList.remove("tts"));const el=ps[this.i];el.classList.add("tts");el.scrollIntoView({block:"center",behavior:"smooth"});
  const u=new SpeechSynthesisUtterance(el.textContent.replace(/\s+/g," ").trim()||" ");u.lang="ar-SA";const v=this.voice();if(v)u.voice=v;u.rate=this.rate;
  const me=this.i;u.onend=()=>{if(this.on&&!this.paused&&this.i===me){this.i++;this.next()}};u.onerror=e=>{if(e.error!=="interrupted"&&e.error!=="canceled"){this.i++;this.next()}};speechSynthesis.speak(u)},
 toggle(){if(!this.on)return;this.paused=!this.paused;$("#ttsp").textContent=this.paused?"▶":"⏸";if(this.paused)speechSynthesis.cancel();else this.next()},
 stop(){this.on=false;this.cont=false;try{speechSynthesis.cancel()}catch(e){}$$(".rd p.tts").forEach(x=>x.classList.remove("tts"));const b=$("#ttsbar");if(b)b.hidden=true}};
if("speechSynthesis"in window)speechSynthesis.onvoiceschanged=()=>{};
function turn(d,p0){const rb=$("#rb");if(!rb)return;const b=B(rb.dataset.id),p=p0||+rb.dataset.p+d;if(p<1||p>b.pages.length)return;
 if($("#scr")){let sec=$(`.spg[data-p="${p}"]`);if(!sec){const ps=[...$$("#scr .spg")].map(x=>+x.dataset.p);if(p===Math.min(...ps)-1)scrAdd(b,-1);else if(p===Math.max(...ps)+1)scrAdd(b,1);else{LASTREAD=null;location.hash=`#/book/${b.id}/${p}`;return}sec=$(`.spg[data-p="${p}"]`)}
  if(sec){scrSet(b,p);scrollTo({top:sec.getBoundingClientRect().top+scrollY-(S.full?8:96),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}return}const h=parse().q.h;location.hash=`#/book/${b.id}/${p}${h?"?h="+encodeURIComponent(h):""}`}

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
 openDlg(`<h3>${esc(w)}</h3><div id="dres" class="mut">يبحث في مختار الصحاح…</div><h3 style="font-size:1rem">معاجم أخرى</h3><div class="row"><a class="btn s nf" target="_blank" rel="noopener" href="https://www.baheth.info/all.jsp?term=${e}">الباحث العربي</a><a class="btn s nf" target="_blank" rel="noopener" href="https://ar.wiktionary.org/wiki/${e}">ويكاموس</a><a class="btn s nf" target="_blank" rel="noopener" href="https://arabiclexicon.hawramani.com/?s=${e}">معجم لين</a></div>`);
 try{if(!DICT)DICT=window.__DICT__||await (await fetch("data/dict/mukhtar.json")).json();
  const found=roots(w).map(r=>DICT[r]).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3);
  $("#dres").innerHTML=found.length?found.map(x=>`<p class="mut" style="margin:6px 0 2px">مادة (${esc(x.r)}) — مختار الصحاح للرازي</p><div class="dict">${esc(x.t.length>1500?x.t.slice(0,1500)+"…":x.t)}</div>`).join(""):"لم أجد جذر الكلمة في مختار الصحاح. جرّب المعاجم أدناه."}
 catch(x){$("#dres").textContent="تعذر تحميل المعجم. جرّب المعاجم أدناه."}}
// الترجمة داخل صفحة القراءة: يختار القارئ لغة مرة، فتظهر ترجمة كل صفحة تحت نصها أثناء التنقل
const TRL=[["en","English"],["fr","Français"],["es","Español"],["tr","Türkçe"],["de","Deutsch"],["ru","Русский"],["zh-CN","中文"],["ur","اردو"],["id","Indonesia"],["ms","Melayu"],["bn","বাংলা"],["fa","فارسی"],["sw","Kiswahili"],["ha","Hausa"]],TRC=new Map();
function trDlg(){openDlg(`<h3>الترجمة داخل الصفحة</h3><p class="mut">اختر لغة فتظهر ترجمة كل صفحة تحت نصها وأنت تتنقل في الكتاب.</p><div class="row trls">${TRL.map(([k,t])=>`<button class="btn s${S.tr===k?" p":""}" data-act="trset" data-l="${k}">${t}</button>`).join("")}</div>${S.tr?'<button class="btn s nf danger" data-act="trset" data-l="" style="margin-top:8px">إيقاف الترجمة</button>':""}<p class="note">ترجمة آلية غير معتمدة وقد تخطئ في المصطلحات الشرعية، فلا يُعتمد عليها في الفتوى أو النقل.</p>`)}
async function mymemory(txt,lang){const ch=txt.match(/[^.؟!\n]+[.؟!]?/g)||[txt];const parts=[];let cur="";ch.forEach(c=>{if((cur+c).length>450){parts.push(cur);cur=""}cur+=c+" "});if(cur.trim())parts.push(cur);let res="";
 for(const q of parts.slice(0,12)){const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.trim())}&langpair=ar|${lang}`);const j=await r.json();res+=(j.responseData.translatedText||"")+" "}return res.trim()}
async function renderTr(b,p){const box=$("#trv");if(!box)return;const lang=S.tr;if(!lang){box.hidden=true;return}box.hidden=false;
 const lname=(TRL.find(x=>x[0]===lang)||[])[1]||lang,head=`<div class="trh"><span>الترجمة: ${esc(lname)}</span><button class="btn s nf" data-act="tr">تغيير</button><button class="btn s nf" data-act="trset" data-l="">إيقاف</button></div>`,key=b.id+"|"+p+"|"+lang;
 const show=t=>{const el=$("#trv");if(el&&+el.dataset.p===p)el.innerHTML=head+`<div class="trt" dir="auto" lang="${lang}">${esc(t).replace(/\n+/g,"</p><p>").replace(/^/,"<p>")}</p></div>`};
 box.dataset.p=p;if(TRC.has(key))return show(TRC.get(key));box.innerHTML=head+'<p class="mut">جارٍ ترجمة الصفحة…</p>';
 let t="";try{if(!b.f){const r=await fetch(`/api/translate?id=${encodeURIComponent(b.id)}&p=${p}&l=${lang}&v=${b.size||0}`);if(r.ok)t=(await r.json()).text||""}}catch(e){}
 if(!t){try{t=await mymemory(strip(plain(b.pages[p-1]||"")),lang)}catch(e){}}
 if(!t&&String(b.pages[p-1]||"").trim()){const el=$("#trv");if(el&&+el.dataset.p===p)el.innerHTML=head+`<p class="note">تعذرت الترجمة الآن. <a target="_blank" rel="noopener" href="https://translate.google.com/?sl=ar&tl=${lang}&text=${encodeURIComponent(strip(plain(b.pages[p-1])).slice(0,1500))}">افتحها في مترجم جوجل</a></p>`;return}
 TRC.set(key,t);show(t)}
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
  await pwCheck(pw);
  if(this.mode==="cloud"){const {data,error}=await this.sb.auth.signUp({email,password:pw,options:{data:{name,full_name:name}}});if(error)throw error;if(data.session)this.set(data.session);return data.session?"ok":"confirm"}
  this.user={id:"local:"+email.toLowerCase(),name,email};ls.set("acct",this.user);return "ok"},
 async signIn(email,pw){
  if(this.mode==="cloud"){const {data,error}=await this.sb.auth.signInWithPassword({email,password:pw});if(error)throw error;this.set(data.session);Cloud.loadRole();return}
  const known=ls.get("acct_known",{})[email.toLowerCase()]||{id:"local:"+email.toLowerCase(),name:email.split("@")[0],email};
  this.user=known;ls.set("acct",known)},
 async signOut(){if(this.mode==="cloud")await this.sb.auth.signOut();this.user=null;this.token=null;ls.set("acct",null);paintAuth()}};
function paintAuth(){Mine.reset();setTimeout(()=>Bell.paint(),0);const b=$("#acctbtn");if(b)b.textContent=Auth.user?(Auth.user.name||"حسابي").split(" ")[0]:"دخول";
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
  <div class="row" style="margin:10px 0"><a class="btn p nf" href="#/ask">اسأل المكتبة</a><a class="btn nf" href="#/favs">المفضلة</a><a class="btn nf" href="#/mine">مكتبتي: العلامات والتعليقات</a><button class="btn nf" data-act="logout">تسجيل الخروج</button></div>
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
// حماية كلمات المرور: طول كافٍ، ورفض كلمات المرور المسرّبة (فحص Have I Been Pwned بطريقة إخفاء الهوية: يُرسل أول 5 أحرف من بصمة SHA-1 فقط)
async function pwCheck(pw){pw=String(pw||"");if(pw.length<8)throw new Error("كلمة المرور قصيرة: ثمانية أحرف على الأقل.");
 if(/^(.)\1+$/.test(pw)||/^(12345678|123456789|password|qwertyui)/i.test(pw))throw new Error("كلمة المرور سهلة التخمين؛ اختر غيرها.");
 try{const h=[...new Uint8Array(await crypto.subtle.digest("SHA-1",new TextEncoder().encode(pw)))].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  const r=await fetch("https://api.pwnedpasswords.com/range/"+h.slice(0,5),{headers:{"Add-Padding":"true"}});if(!r.ok)return;
  const t=await r.text();if(t.split("\n").some(l=>{const [suf,c]=l.trim().split(":");return suf===h.slice(5)&&+c>0}))throw new Error("كلمة المرور هذه ظهرت في تسريبات بيانات سابقة على الإنترنت، فاختر كلمة مرور أخرى لحماية حسابك.")}
 catch(e){if(/تسريبات/.test(e.message))throw e}}
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
 <div class="row" style="align-items:center"><div id="aeprev"></div><div><label>الصورة المصغرة (اختياري)</label><input type="file" name="photo" accept="image/*"><label class="inl"><input type="checkbox" name="nophoto" value="1"> إزالة الصورة واستعمال الحرف الأول</label></div></div>
 <label>نبذة مختصرة</label><textarea name="bio" style="min-height:90px"></textarea><button class="btn p" style="margin-top:8px">حفظ بيانات المؤلف</button> <span id="aest" class="mut"></span></div></form>`}
function wireStruct(){const sel=$("#aesel");if(!sel)return;sel.onchange=()=>{const a=lib.authors.find(x=>x.id===sel.value),f=sel.form,box=$("#aefields");box.hidden=!a;if(!a)return;f.name.value=a.name;f.died.value=a.died||"";f.col.value=a.col||"dawah";f.bio.value=a.bio||"";$("#aeprev").innerHTML=avatar(a,"big")}}
async function squareJpeg(file,size){const img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(file)});
 const c=document.createElement("canvas");c.width=c.height=size;const k=Math.min(img.width,img.height);c.getContext("2d").drawImage(img,(img.width-k)/2,(img.height-k)/2,k,k,0,0,size,size);
 const blob=await new Promise(ok=>c.toBlob(ok,"image/jpeg",.85));return new Uint8Array(await blob.arrayBuffer())}
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
 const ph=fd.get("photo");if(ph&&ph.size){try{const bytes=await squareJpeg(ph,320),path="assets/authors/"+id+".jpg";await GH.put(path,bytes,"صورة المؤلف: "+up.name);up.photo=path+"?v="+Date.now().toString(36)}catch(e){st.textContent="تعذر رفع الصورة: "+e.message;return}}
 if(fd.get("nophoto"))up.photo="";
 const apply=c=>{const a=c.authors.find(x=>x.id===id);if(!a)throw new Error("المؤلف غير موجود في الفهرس المنشور (ربما أُضيف على هذا الجهاز فقط).");Object.assign(a,up);if(a.photo==="")delete a.photo;if(d)a.died=d;else delete a.died;c.version=Date.now();return c};
 try{await GH.editJSON("data/catalog.json",apply,"تعديل بيانات مؤلف: "+up.name,true);try{apply(CAT)}catch(e){}merge();st.textContent="✓ حُفظ.";toast("حُفظت بيانات المؤلف")}catch(e){st.textContent=e.message}}
/* صورة المؤلف من معرض صور الهاتف: اختيار، ثم تحريك وتكبير داخل الإطار الدائري، ثم حفظ */
function photoDlg(id){const a=A(id);if(!GH.on)return alert("سجّل الدخول بحساب الإدارة أولًا.");
 openDlg(`<h3>صورة ${esc(a.name)}</h3><p class="mut">اختر صورة من معرض الصور أو التقط صورة، ثم حرّكها بإصبعك وكبّرها حتى يكون الوجه في وسط الدائرة.</p>
 <label class="btn p nf" style="display:inline-block;cursor:pointer">اختيار صورة<input type="file" id="phf" accept="image/*" hidden></label>
 <div class="phbox" id="phbox" hidden><canvas id="phc" width="320" height="320"></canvas><label for="phz">التكبير</label><input type="range" id="phz" min="1" max="4" step="0.01" value="1"></div>
 <div class="row" style="margin-top:10px"><button class="btn p" id="phsave" disabled>حفظ الصورة</button>${a.photo?'<button class="btn danger" id="phdel">إزالة الصورة</button>':""}</div><p id="phst" class="mut"></p>`);
 let img=null,z=1,ox=0,oy=0;const c=$("#phc"),g=c.getContext("2d"),S=320;
 const draw=()=>{if(!img)return;const base=Math.max(S/img.width,S/img.height)*z,w=img.width*base,h=img.height*base;ox=Math.min(0,Math.max(S-w,ox));oy=Math.min(0,Math.max(S-h,oy));g.clearRect(0,0,S,S);g.drawImage(img,ox,oy,w,h)};
 $("#phf").onchange=e=>{const f=e.target.files[0];if(!f)return;const i=new Image();i.onload=()=>{img=i;z=1;const base=Math.max(S/i.width,S/i.height);ox=(S-i.width*base)/2;oy=(S-i.height*base)/2;$("#phbox").hidden=false;$("#phz").value=1;$("#phsave").disabled=false;draw()};i.src=URL.createObjectURL(f)};
 $("#phz").oninput=e=>{const nz=+e.target.value,cx=S/2,cy=S/2;ox=cx-(cx-ox)*nz/z;oy=cy-(cy-oy)*nz/z;z=nz;draw()};
 let drag=null;c.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,ox,oy};c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!drag)return;const k=S/c.getBoundingClientRect().width;ox=drag.ox+(e.clientX-drag.x)*k;oy=drag.oy+(e.clientY-drag.y)*k;draw()};c.onpointerup=()=>{drag=null};
 const save=async photo=>{const st=$("#phst");st.textContent="جارٍ الحفظ…";
  const apply=x=>{const y=x.authors.find(q=>q.id===id);if(!y)throw new Error("المؤلف غير موجود في الفهرس المنشور.");if(photo)y.photo=photo;else delete y.photo;x.version=Date.now();return x};
  await GH.editJSON("data/catalog.json",apply,(photo?"صورة المؤلف: ":"إزالة صورة المؤلف: ")+a.name,true);try{apply(CAT)}catch(e){}merge();dlg().close();toast("حُفظت الصورة، وتظهر للجميع خلال دقيقة.");route()};
 $("#phsave").onclick=async()=>{const b=$("#phsave");b.disabled=true;try{const blob=await new Promise(ok=>c.toBlob(ok,"image/jpeg",.86));const bytes=new Uint8Array(await blob.arrayBuffer()),path="assets/authors/"+id+".jpg";$("#phst").textContent="جارٍ رفع الصورة…";await GH.put(path,bytes,"صورة المؤلف: "+a.name);$("#phst").textContent="جارٍ تحديث بيانات المؤلف…";await save(path+"?v="+Date.now().toString(36));try{const u=URL.createObjectURL(blob);[CAT.authors,lib.authors].forEach(L=>{const y=(L||[]).find(q=>q.id===id);if(y)y.photo=u});route()}catch(e){}}catch(e){$("#phst").textContent=e.message;b.disabled=false}};
 if($("#phdel"))$("#phdel").onclick=async()=>{if(confirm("إزالة صورة "+a.name+" من الموقع؟"))try{await save("")}catch(e){$("#phst").textContent=e.message}}}
/* دفتر البحث: تصدير المختارات والتعليقات الخاصة بحثًا موثقًا (حواشٍ بالمصادر وثبت مراجع) */
async function nbExport(f){const l=await Mine.allNotes();if(!l.length)return toast("لا توجد تعليقات بعد.");const g={};l.forEach(n=>(g[n.book_id]=g[n.book_id]||[]).push(n));
 const books=Object.keys(g).map(id=>{const b=B(id)||{},au=A(b.authorId).name||"";return{id,b,au,title:g[id][0].title||b.setTitle||b.title||id,ns:g[id].sort((x,y)=>x.page-y.page)}});
 const ref=(k,n)=>{const lb=k.b.pages?PL(k.b,n.page-1):"";return`${k.au?k.au+"، ":""}${k.title}، ${lb||"ص "+n.page}`};
 const today=new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"}),who=(Auth.user&&Auth.user.name)||"";let fn=0;
 if(f==="txt"){const t=`دفتر البحث${who?" — "+who:""}\n${today}\n\n`+books.map(k=>`■ ${k.title}${k.au?" — "+k.au:""}\n\n`+k.ns.map(n=>`«${expTash(n.quote)}»\n[${ref(k,n)}]${n.note?"\nتعليق: "+n.note:""}`).join("\n\n")).join("\n\n————\n\n")+`\n\nالمراجع:\n`+books.map((k,i)=>`${i+1}. ${k.au?k.au+"، ":""}${k.title}.`).join("\n")+`\n\n${SITENAME}`;return dl("دفتر-البحث.txt",t,"text/plain")}
 const body=books.map(k=>`<h2>${esc(k.title)}${k.au?` — <span style="font-weight:normal">${esc(k.au)}</span>`:""}</h2>`+k.ns.map(n=>{fn++;return`<p class="q">«${esc(expTash(n.quote))}»<sup>(${fn})</sup></p>${n.note?`<p class="n"><b>تعليق:</b> ${esc(n.note)}</p>`:""}`}).join("")).join("");
 let k2=0;const notes=books.map(k=>k.ns.map(n=>`<p class="fn">(${++k2}) ${esc(ref(k,n))}.</p>`).join("")).join("");
 const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>دفتر البحث</title><style>body{font-family:"Traditional Arabic","Amiri",serif;direction:rtl;font-size:16pt;line-height:1.8}h1{text-align:center}h2{font-size:17pt;color:#0f5c4d;border-bottom:1px solid #ccc}.q{text-align:justify}.n{color:#444;font-size:14pt}.fn{font-size:12pt;margin:2px 0}.meta{text-align:center;color:#666}</style></head><body dir="rtl"><h1>دفتر البحث</h1><p class="meta">${esc(who)}${who?" — ":""}${esc(today)}</p>${body}<hr><h2>الحواشي</h2>${notes}<h2>المراجع</h2>${books.map((k,i)=>`<p>${i+1}. ${esc(k.au?k.au+"، ":"")}${esc(k.title)}.</p>`).join("")}<p class="meta">${esc(SITENAME)}</p></body></html>`;
 dl("دفتر-البحث.doc",html,"application/msword")}
/* بيانات الكتاب من القارئ */
function metaDlg(){const c=cur();if(!c)return;closeSheet();const b=c.b;if(isArt(b)&&b.f)return alert("تعديل بيانات المقالات المستوردة يأتي لاحقًا؛ يمكنك تعديل نصها من «تعديل النص».");
 const tags=b.tags||[],o=(arr,v)=>arr.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 openDlg(`<h3>بيانات الكتاب</h3>${needGH()}<form data-form="bookmeta" data-id="${b.id}"><label>العنوان</label><input name="title" value="${esc(b.set?b.setTitle||b.title:b.title)}">
 <div class="row"><div><label>المؤلف</label><select name="aid">${o([...lib.authors].sort((x,y)=>x.name.localeCompare(y.name,"ar")),b.authorId)}</select></div><div><label>القسم</label><select name="col"><option value="dawah"${bc(b)==="dawah"?" selected":""}>${esc(COL.dawah)}</option><option value="turath"${bc(b)==="turath"?" selected":""}>${esc(COL.turath)}</option></select></div><div><label>الموضوع</label><select name="tid">${o(lib.topics.filter(t=>t.for!=="articles"),b.topicId)}</select></div></div>
 <label>بيانات الطبعة أو المصدر</label><input name="source" value="${esc(b.source||"")}">
 <fieldset class="secs"><legend>يظهر أيضًا في</legend><label class="inl"><input type="checkbox" name="tafrigh" value="1"${tags.includes("tafrigh")?" checked":""}> التفريغات</label>${FURQAN.map(([n])=>`<label class="inl"><input type="checkbox" name="furqan" value="${esc(n)}"${tags.includes("furqan:"+n)?" checked":""}> قضايا الفرقان: ${esc(n)}</label>`).join("")}</fieldset>
 ${b.set?`<p class="mut">يُطبَّق التعديل على مجلدات الكتاب كلها (${toAr(b.vols)}).</p>`:""}
 <div class="row" style="margin-top:8px"><button class="btn p nf">حفظ</button>${(b.pdfLocal||b.pdf)&&/^pdf\//.test(b.pdfLocal||b.pdf)?`<button type="button" class="btn nf" data-act="reocr" data-id="${b.id}">إعادة تحويل النص بالذكاء الاصطناعي</button>`:""}<button type="button" class="btn nf danger" data-act="bookdel" data-id="${b.id}">حذف الكتاب من المكتبة</button></div><p id="bmst" class="mut"></p></form>`)}
async function reocr(id){const b=B(id),st=$("#bmst");if(!GH.on){st.textContent="فعّل الإدارة المباشرة أولًا.";return}
 if(!confirm("إعادة تحويل «"+b.title+"» من نسخته المصورة بالذكاء الاصطناعي؟ يُستبدل النص الحالي (وتضيع التصحيحات اليدوية عليه)."))return;
 try{st.textContent="جارٍ الطلب…";await GH.put("ocr-inbox/"+id+".redo","","طلب إعادة تحويل: "+b.title);st.textContent="✓ بدأ التحويل على خوادم GitHub، ويظهر النص الجديد بعد انتهائه (نحو 3 دقائق لكل 10 صفحات)."}catch(e){st.textContent=e.message}}
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
function ghBox(){return GH.proxied?`<div class="ghbox on"><b>✓ الإدارة المباشرة مفعّلة بحسابك</b><p>أنت مسجّل بحساب الإدارة، فكل ما تضيفه أو تعدّله يُحفظ في المكتبة مباشرة ويظهر للجميع خلال دقيقة، دون مفتاح على هذا الجهاز.</p></div>`:GH.on?`<div class="ghbox on"><b>✓ وضع الإدارة المباشرة مفعّل</b><p>كل ما تضيفه أو تصححه يُحفظ في المكتبة مباشرة، ويظهر للجميع خلال دقيقة تقريبًا.</p><button class="btn s" data-act="ghout">خروج من هذا الجهاز</button></div>`
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
   // الأسرع: رفع الملف كاملًا إلى مخزن الموقع (Supabase Storage) دفعة واحدة، ثم رابط تنزيل مؤقت يأخذه التحويل
   let viaStore=false;if(GH.proxied&&Cloud.on()&&file.size<=50*1048576){try{st.textContent=`جارٍ رفع ${cfg.title} (${toAr(Math.round(file.size/1048576))} ميجابايت)…`;
    const S_=Auth.sb.storage.from("inbox"),{error:ue}=await S_.upload(base+".pdf",file,{contentType:"application/pdf",upsert:true});if(ue)throw ue;
    // لا يُحفظ رابط موقَّع في المستودع العام: يُحفظ اسم الملف فقط، ويطلب التحويل رابطًا مؤقتًا من الخادم
    await GH.put("ocr-inbox/"+base+".store",base+".pdf","ملف كتاب مصور: "+cfg.title,null);await GH.put("ocr-inbox/"+base+".ready","0","اكتمل رفع: "+cfg.title,null);viaStore=true}catch(e){console.warn("storage upload",e)}}
   if(viaStore){done.push(cfg.title);continue}
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(GH.proxied){const CH=2500000,n=Math.ceil(bytes.length/CH);for(let k=0;k<n;k++){st.textContent=`جارٍ رفع ${cfg.title}: الجزء ${toAr(k+1)} من ${toAr(n)}…`;await GH.put("ocr-inbox/"+base+".pdf.part"+String(k+1).padStart(3,"0"),bytes.subarray(k*CH,(k+1)*CH),"رفع كتاب مصور (جزء "+(k+1)+"): "+cfg.title,null)}
    await GH.put("ocr-inbox/"+base+".ready",String(n),"اكتمل رفع: "+cfg.title,null)}
   else await GH.put("ocr-inbox/"+base+".pdf",bytes,"رفع كتاب مصور: "+cfg.title);done.push(cfg.title)}
  st.innerHTML=`✓ رُفع ${toAr(done.length)} ${done.length>1?"كتب":"كتاب"}: ${done.map(esc).join("، ")}.<br>${link&&!fd.get("ocr")?"سيُربط بالكتاب خلال دقيقة.":"بدأ التحويل إلى نص على خوادم GitHub (نحو دقيقة لكل 10–15 صفحة)، ثم تظهر الكتب في أقسامها تلقائيًا. تابع التقدم من تبويب Actions في المستودع."}`;f.reset()}
 catch(e){st.textContent=(done.length?"رُفع: "+done.join("، ")+". ثم توقف: ":"")+e.message}finally{btn.disabled=false}}
async function addPost(f){const fd=new FormData(f),st=$("#postst");const text=String(fd.get("text")||"").trim();if(!text)return;
 const dd=fd.get("date"),x={id:"po"+Date.now().toString(36),date:!dd||dd===today()?new Date().toISOString():dd,text};const aid=fd.get("aid");if(aid)x.authorId=aid;
 if(fd.get("url"))x.url=String(fd.get("url")).trim();if(fd.get("src"))x.src=String(fd.get("src"));
 try{const img=fd.get("img");
  if(GH.on){st.textContent="جارٍ النشر…";if(img&&img.size){if(img.size>(GH.proxied?2.5:4)*1048576)throw new Error("الصورة كبيرة؛ الحد "+(GH.proxied?"2.5":"4")+" ميجابايت");const ext=(img.name.match(/\.(jpe?g|png|webp|gif)$/i)||[".jpg"])[0].toLowerCase();const path="assets/posts/"+x.id+ext;await GH.put(path,new Uint8Array(await img.arrayBuffer()),"صورة منشور");x.image=path}else if(fd.get("imgurl"))x.image=String(fd.get("imgurl"));
   await GH.editJSON("data/posts.json",o=>{o=o||{items:[]};o.items.unshift(x);return o},"منشور: "+text.slice(0,40));(POSTS||[]).unshift(x);st.textContent="✓ نُشر المنشور، ويظهر للجميع خلال دقيقة."}
  else{if(fd.get("imgurl"))x.image=String(fd.get("imgurl"));const l=ls.get("posts_local",[]);l.unshift(x);ls.set("posts_local",l);POSTS=null;st.textContent="✓ حُفظ على هذا الجهاز. فعّل الإدارة المباشرة لنشره للجميع."}
  f.reset()}catch(e){st.textContent=e.message}}

// حالة المنظومة: آخر الحفظ والنشر، ومهام التحويل الجارية (من واجهة GitHub العامة للمستودع)
async function sysStatus(){const el=$("#sysst");if(!el)return;const R_=GH.repo,api=u=>fetch("https://api.github.com/repos/"+R_+u).then(r=>r.ok?r.json():Promise.reject(new Error(r.status)));
 try{const [cm,runs]=await Promise.all([api("/commits?per_page=8"),api("/actions/runs?per_page=12")]);
  const st=await Promise.all(cm.slice(0,8).map(c=>api("/commits/"+c.sha+"/status").then(x=>x.state).catch(()=>"")));
  const ic={success:"✓ منشور",pending:"… يُنشر الآن",failure:"✗ تعذر النشر",error:"✗ تعذر النشر"},rs={completed:"",in_progress:"… جارٍ",queued:"في الانتظار"},cs={success:"✓",failure:"✗",cancelled:"أُلغي",skipped:"تُخطي"};
  el.innerHTML=`<h3 style="font-size:1rem">آخر الحفظ والنشر على الموقع</h3>${cm.map((c,i)=>`<div class="card"><b>${esc(c.commit.message.split("\n")[0].slice(0,140))}</b><span class="mut">${esc(ago(c.commit.author.date))} • ${esc(c.commit.author.name)} • ${ic[st[i]]||"—"}</span></div>`).join("")}
  <h3 style="font-size:1rem">المهام الآلية (التحويل والاستيراد والفهارس)</h3>${(runs.workflow_runs||[]).map(r=>`<div class="card"><b>${esc(r.name)}</b><span class="mut">${esc(ago(r.created_at))} • ${r.status==="completed"?(cs[r.conclusion]||r.conclusion):rs[r.status]||r.status} • <a href="${esc(r.html_url)}" target="_blank" rel="noopener">التفاصيل</a></span></div>`).join("")}`}
 catch(e){el.innerHTML='<p class="note">تعذر جلب الحالة الآن ('+esc(e.message)+').</p>'}}
function vAdmin(q){const tab=q.t||"book",opt=(a,v)=>a.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const T_=[["book","إضافة كتاب"],["pdf","كتاب مصور"],["article","إضافة مقال"],["post","إضافة منشور"],["import","استيراد من صوت السلف"],["update","ملف التحديث"],["offline","دون إنترنت"]].concat(isAdmin()?[["struct","الأقسام والأسماء"],["review","مراجعة التحويل"],["tashkeel","التشكيل"]]:[]).concat(Cloud.staff()?[["corr","تصحيحات القراء"],["notify","إشعار للأعضاء"],["msgs","رسائل الأعضاء"],["community","مراقبة المجتمع"],["audio","الصوتيات والراديو"],["status","حالة النشر والتحويل"]]:[]);
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
 else if(tab==="msgs"){location.hash="#/messages";return}
 else if(tab==="community"){location.hash="#/community?k=admin";return}
 else if(tab==="tashkeel"){body='<div id="tkadm" class="mut">جارٍ التحميل…</div>';setTimeout(tkAdmin,0)}
 else if(tab==="audio"){location.hash="#/audio?k=admin";return}
 else if(tab==="status"){body='<p class="mut">كل ما تحفظه من الإدارة يُكتب في المستودع ثم يُنشر تلقائيًا على الموقع خلال دقيقة أو اثنتين. هنا آخر عمليات النشر والتحويل.</p><h3 style="font-size:1rem">إشعارات تليجرام</h3><div id="tgst" class="card"><p class="mut">جارٍ التحميل…</p></div><div id="sysst"><p class="mut">جارٍ التحميل…</p></div>';setTimeout(()=>{sysStatus();if(typeof tgPanel==="function")tgPanel()},0)}
 else if(tab==="review"){const ob=lib.books.filter(b=>b.ocr).sort((x,y)=>(y.added||"").localeCompare(x.added||""));body=`<p class="mut">الكتب المحوّلة آليًا من نسخها المصورة. يقرأ Gemini صورة كل صفحة ويراجع مسودة Tesseract ويصححها، ويعلّم الكلمات التي شكّ فيها لتراجعها أنت: تظهر مظللة بالبرتقالي في القارئ (لك وحدك)، وتختفي العلامة بعد «تعديل النص» وحفظه.</p>${ob.map(b=>`<div class="bk"><b>${esc(b.title)}</b><span>${esc(A(b.authorId).name)} • ${b.ocrEngine==="gemini+tesseract"||b.ocrEngine==="gemini"?"Gemini + Tesseract":"Tesseract وحده"} • ${toAr(b.unc||0)} موضع للمراجعة${b.unrev?` • ${toAr(b.unrev)} صفحة لم يراجعها Gemini`:""}</span><div class="row" style="margin-top:6px"><button class="btn s nf" data-act="revlist" data-id="${b.id}">مواضع المراجعة</button><a class="btn s nf" href="#/book/${b.id}/1">فتح الكتاب</a>${(b.pdfLocal||b.pdf)&&/^pdf\//.test(b.pdfLocal||b.pdf)?`<button class="btn s nf" data-act="reocr" data-id="${b.id}">إعادة التحويل بالذكاء الاصطناعي</button>`:""}</div><div class="revl" id="rv-${b.id}"></div></div>`).join("")||'<p class="note">لا توجد كتب محوّلة بعد.</p>'}<p id="bmst" class="mut"></p>`}
 else if(tab==="notify")body=`<p class="mut">يظهر الإشعار في جرس الإشعارات لكل الأعضاء، ويصل إلى أجهزة من فعّل إشعارات الجهاز خلال ساعة.</p><form data-form="bcast"><label>العنوان</label><input name="title" required maxlength="200" placeholder="مثال: صدر كتاب جديد للشيخ…"><label>نص مختصر (اختياري)</label><textarea name="body" style="min-height:80px"></textarea><label>رابط داخل المكتبة (اختياري)</label><input name="url" placeholder="#/book/… أو #/posts" dir="ltr"><button class="btn p" style="margin-top:8px">إرسال الإشعار</button> <span id="bcst" class="mut"></span></form><h3>آخر الإشعارات</h3><div id="bclist" class="mut">جارٍ التحميل…</div>`;
 else if(tab==="corr")body=`<p class="mut">تصحيحات أرسلها القراء. راجع النص المقترح وعدّله إن لزم، ثم اعتمده فيُنشر مباشرة (يحتاج مفتاح الإدارة المباشرة).</p><div id="corrs"><p class="mut">جارٍ التحميل…</p></div>`;
 else body=`<p class="mut">نزّل نصوص المكتبة كلها على هذا الجهاز لتعمل دون إنترنت، وتتحدث تلقائيًا عند الاتصال. الحجم الكلي نحو ${Math.round(lib.books.reduce((s,b)=>s+(b.size||0),0)/1048576)} ميجابايت.</p><button class="btn p" data-act="offline">تنزيل المكتبة للعمل دون إنترنت</button><div id="offst"></div>`;
 view(`<h2>الإدارة</h2>${ghBox()}<label class="inl"><input type="checkbox" id="adm"${S.admin?" checked":""}> وضع الإدارة (يظهر زر «تعديل النص» في القارئ)</label>
 <div class="tabs" role="tablist">${T_.map(([k,l])=>`<a role="tab" aria-selected="${tab===k}" href="#/admin?t=${k}">${l}</a>`).join("")}</div><div style="margin-top:10px">${body}</div>
 <p class="note">${GH.on?"أنت في وضع الإدارة المباشرة: احذر، فالتعديلات تُنشر للجميع.":"بدون مفتاح المشرف لا يستطيع أحد تغيير المكتبة المنشورة من هذه الصفحة؛ ما يُضاف يبقى على هذا الجهاز حتى يُرفع ملف التحديث."}</p>`);
 $("#adm").onchange=e=>{S.admin=e.target.checked;saveS()};
 const impf=$("#impf");if(impf)impf.onchange=async e=>{try{await applyUpdate(JSON.parse(await e.target.files[0].text()));alert("تم الاستيراد");route()}catch(x){alert("ملف غير صالح")}};
 const ig=$("#impgo");if(ig)ig.onclick=importArticles;if(tab==="corr"&&Cloud.staff())corrList();if(tab==="notify"&&Cloud.staff())bcList();if(tab==="struct")wireStruct()}
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
  try{const r=await fetch(CFG.importEndpoint+"?url="+encodeURIComponent(u),{headers:{Authorization:"Bearer "+(Auth.token||"")}});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||(r.status===404?"خدمة الاستيراد غير متاحة هنا؛ تعمل من الموقع المنشور على Vercel.":"تعذر الجلب"))}
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
function authorBrief(id){const a=A(id),t=tj(id);if(!a||!a.name||a.name==="—")return;try{getSelection().removeAllRanges()}catch(e){}
 // نافذة في وسط الشاشة (لا تختفي خلف شريط المتصفح السفلي في الآيفون)
 openDlg(`<div class="abr"><div class="ahero">${avatar(a,"big")}<h3>${esc(a.name)}${died(a)}</h3></div>`+`${t&&t.born?`<p class="mut" style="margin:0">المولد: ${esc(t.born)}</p>`:""}
 <p class="brief">${esc((t&&t.brief)||a.bio||"لم يُضف تعريف بهذا المؤلف بعد.")}</p>
 <p class="mut">في المكتبة: ${countLine(id)}</p>
 <div class="row">${t?`<a class="btn p nf" href="#/tarjama/${id}" data-act="closeDlg">الترجمة المفصلة</a>`:""}<a class="btn nf" href="#/author/${id}" data-act="closeDlg">كتبه ومقالاته</a>${isAdmin()&&GH.on?`<button class="btn nf" data-act="aphoto" data-id="${id}">📷 ${a.photo?"تغيير الصورة":"إضافة صورة"}</button>`:""}</div></div>`)}
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
const findPost=id=>(typeof MP!=="undefined"&&MP.get(id))||(POSTS||[]).find(x=>x.id===id)||(/^act-/.test(id)?actPosts().find(x=>x.id===id):null);
const pName=x=>x.authorId?A(x.authorId).name:x.member?(x.name||"عضو"):(x.name||"مكتبة الدعوة السلفية الرقمية");
const Cloud={role:"member",on(){return Auth.mode==="cloud"&&!!Auth.sb},staff(){return this.on()&&!!Auth.user&&/^(admin|editor)$/.test(this.role)},
 async loadRole(){this.role="member";if(!this.on()||!Auth.user)return;try{const {data}=await Auth.sb.from("profiles").select("role").eq("id",Auth.user.id).maybeSingle();if(data&&data.role)this.role=data.role}catch(e){}
  if(this.staff()){if(!S.admin){S.admin=true;saveS()}applyLabels();let first=false;try{first=!sessionStorage.getItem("admOpen");sessionStorage.setItem("admOpen","1")}catch(e){}if(first&&!parse().p[0])location.hash="#/admin"}}};
const Social={
 k(n){return"soc:"+n+":"+(Auth.user?Auth.user.id:"-")},
 async state(ids){const out={stats:{},likes:new Set(),saves:new Set()};if(!ids.length)return out;
  out.likes=new Map();
  if(Cloud.on()){const sb=Auth.sb;try{const r=await sb.from("post_stats").select("post_id,likes,comments,kinds").in("post_id",ids);(r.data||[]).forEach(x=>out.stats[x.post_id]={likes:+x.likes||0,comments:+x.comments||0,kinds:x.kinds||{}});
   if(Auth.user){const [l,s]=await Promise.all([sb.from("post_reactions").select("post_id,kind").eq("user_id",Auth.user.id).in("post_id",ids),sb.from("post_saves").select("post_id").eq("user_id",Auth.user.id).in("post_id",ids)]);
    (l.data||[]).forEach(x=>out.likes.set(x.post_id,x.kind||"like"));(s.data||[]).forEach(x=>out.saves.add(x.post_id))}}catch(e){console.warn("social",e)}return out}
  const L=new Set(ls.get(this.k("likes"),[])),V=new Set(ls.get(this.k("saves"),[])),C=ls.get("soc:comments",{});
  ids.forEach(id=>{out.stats[id]={likes:L.has(id)?1:0,comments:(C[id]||[]).length,kinds:L.has(id)?{like:1}:{}};if(L.has(id))out.likes.set(id,"like");if(V.has(id))out.saves.add(id)});return out},
 async toggle(table,key,id,on){if(Cloud.on()){const t=Auth.sb.from(table),{error}=on?await t.insert({post_id:id,user_id:Auth.user.id}):await t.delete().eq("post_id",id).eq("user_id",Auth.user.id);if(error&&!/duplicate/i.test(error.message))throw new Error(error.message);return}
  const s=new Set(ls.get(this.k(key),[]));on?s.add(id):s.delete(id);ls.set(this.k(key),[...s])},
 like(id,on){return this.react(id,on?"like":null)},
 async react(id,k){if(Cloud.on()){const t=Auth.sb.from("post_reactions");const {error}=k?await t.upsert({post_id:id,user_id:Auth.user.id,kind:k},{onConflict:"post_id,user_id"}):await t.delete().eq("post_id",id).eq("user_id",Auth.user.id);if(error)throw new Error(error.message);return}
  return this.toggle("post_reactions","likes",id,!!k)},
 async reactors(id){if(!Cloud.on())return[];const {data}=await Auth.sb.from("post_reactions").select("user_id,kind,created_at").eq("post_id",id).order("created_at",{ascending:false}).limit(200);const l=data||[];
  const ids=[...new Set(l.map(r=>r.user_id))];let names={};if(ids.length){const {data:pg}=await Auth.sb.from("member_pages").select("user_id,name").in("user_id",ids);(pg||[]).forEach(p=>names[p.user_id]=p.name)}return l.map(r=>({uid:r.user_id,kind:r.kind||"like",name:names[r.user_id]||"عضو"}))},save(id,on){return this.toggle("post_saves","saves",id,on)},
 async comments(id){if(Cloud.on()){const {data}=await Auth.sb.from("post_comments").select("id,user_id,user_name,body,created_at,parent_id").eq("post_id",id).order("created_at",{ascending:true}).limit(300);
  return(data||[]).map(c=>({id:c.id,uid:c.user_id,name:c.user_name,text:c.body,at:c.created_at,parent:c.parent_id||null}))}return ls.get("soc:comments",{})[id]||[]},
 async comment(id,text,parent){let name=(Auth.user&&Auth.user.name)||"عضو";if(Cloud.on()){try{const pg=await Members.page(Auth.user.id);if(pg&&pg.name)name=pg.name}catch(e){}const row={post_id:id,user_id:Auth.user.id,user_name:name,body:text};if(parent)row.parent_id=+parent;const {error}=await Auth.sb.from("post_comments").insert(row);if(error)throw new Error(error.message.replace(/^.*?(banned|rate_limited):\s*/,""));return}
  const C=ls.get("soc:comments",{});(C[id]=C[id]||[]).push({id:Date.now(),uid:Auth.user.id,name,text,at:new Date().toISOString()});ls.set("soc:comments",C)},
 async delComment(id,cid){if(Cloud.on()){const {error}=await Auth.sb.from("post_comments").delete().eq("id",cid);if(error)throw new Error(error.message);return}
  const C=ls.get("soc:comments",{});C[id]=(C[id]||[]).filter(c=>String(c.id)!==String(cid));ls.set("soc:comments",C)},
 async savedIds(){if(!Auth.user)return[];if(Cloud.on()){const {data}=await Auth.sb.from("post_saves").select("post_id").eq("user_id",Auth.user.id).order("created_at",{ascending:false});return(data||[]).map(x=>x.post_id)}return ls.get(this.k("saves"),[]).slice().reverse()}};
/* ---------- مكتبتي الشخصية: علامة الصفحة، والتعليقات الخاصة، ومشاريع القراءة، والإشعارات ---------- */
const pgs=n=>n===1?"صفحة واحدة":n===2?"صفحتان":n<=10?toAr(n)+" صفحات":toAr(n)+" صفحة";
const NCOL={y:["أصفر","#f6d860"],g:["أخضر","#9fdc9b"],b:["أزرق","#9cc8f2"],p:["وردي","#f3a7c4"]};
const Mine={uid:null,marks:null,notes:{},plans:null,
 cloud(){return Cloud.on()&&!!Auth.user},
 reset(){const u=Auth.user&&Auth.user.id;if(u!==this.uid){this.uid=u;this.marks=null;this.notes={};this.plans=null}},
 k(n){return"mine:"+n+":"+(Auth.user?Auth.user.id:"-")},
 err(e){if(e&&/relation|does not exist|schema cache/i.test(e.message||""))return new Error("ميزات «مكتبتي» تحتاج تحديث قاعدة البيانات: نفّذ ملف schema.sql من صفحة setup-db.html مرة أخرى.");return new Error(e&&e.message||String(e))},
 async loadMarks(){this.reset();if(this.marks)return this.marks;const m={};
  if(this.cloud()){const {data,error}=await Auth.sb.from("bookmarks").select("book_id,page,title,updated_at").eq("user_id",Auth.user.id);if(error)throw this.err(error);(data||[]).forEach(x=>m[x.book_id]=x)}
  else Object.assign(m,ls.get(this.k("marks"),{}));return this.marks=m},
 async setMark(b,p){await this.loadMarks();const row={book_id:b.id,page:p,title:b.setTitle||b.title,updated_at:new Date().toISOString()};
  if(this.cloud()){const {error}=await Auth.sb.from("bookmarks").upsert(Object.assign({user_id:Auth.user.id},row));if(error)throw this.err(error)}
  this.marks[b.id]=row;if(!this.cloud())ls.set(this.k("marks"),this.marks)},
 async delMark(bid){await this.loadMarks();if(this.cloud()){const {error}=await Auth.sb.from("bookmarks").delete().eq("user_id",Auth.user.id).eq("book_id",bid);if(error)throw this.err(error)}
  delete this.marks[bid];if(!this.cloud())ls.set(this.k("marks"),this.marks)},
 async notesOf(bid){this.reset();if(!Auth.user)return[];if(this.notes[bid])return this.notes[bid];let l=[];
  if(this.cloud()){const {data,error}=await Auth.sb.from("notes").select("*").eq("user_id",Auth.user.id).eq("book_id",bid).order("created_at");if(error)throw this.err(error);l=data||[]}
  else l=(ls.get(this.k("notes"),[])).filter(x=>x.book_id===bid);return this.notes[bid]=l},
 async allNotes(){if(!Auth.user)return[];if(this.cloud()){const {data,error}=await Auth.sb.from("notes").select("*").eq("user_id",Auth.user.id).order("updated_at",{ascending:false}).limit(1000);if(error)throw this.err(error);return data||[]}return ls.get(this.k("notes"),[]).slice().reverse()},
 async saveNote(n){const now=new Date().toISOString();n.updated_at=now;
  if(this.cloud()){if(n.id){const {error}=await Auth.sb.from("notes").update({note:n.note,color:n.color,updated_at:now}).eq("id",n.id);if(error)throw this.err(error)}
   else{const {data,error}=await Auth.sb.from("notes").insert(Object.assign({user_id:Auth.user.id},n)).select().single();if(error)throw this.err(error);n=data}}
  else{const all=ls.get(this.k("notes"),[]);if(n.id){const i=all.findIndex(x=>x.id===n.id);if(i>=0)all[i]=Object.assign(all[i],n)}else{n.id=Date.now();n.created_at=now;all.push(n)}ls.set(this.k("notes"),all)}
  delete this.notes[n.book_id];return n},
 async delNote(n){if(this.cloud()){const {error}=await Auth.sb.from("notes").delete().eq("id",n.id);if(error)throw this.err(error)}else ls.set(this.k("notes"),ls.get(this.k("notes"),[]).filter(x=>x.id!==n.id));delete this.notes[n.book_id]},
 async loadPlans(){this.reset();if(!Auth.user)return[];if(this.plans)return this.plans;let l=[];
  if(this.cloud()){const {data,error}=await Auth.sb.from("reading_plans").select("*").eq("user_id",Auth.user.id).order("created_at");if(error)throw this.err(error);l=data||[]}else l=ls.get(this.k("plans"),[]);return this.plans=l},
 async savePlan(p){await this.loadPlans();const [h,m]=String(p.remind_at||"20:00").split(":").map(Number),off=-new Date().getTimezoneOffset();p.tz_offset=off;p.hour_utc=((h*60+(m||0)-off)/60%24+24|0)%24;
  if(this.cloud()){const {error}=await Auth.sb.from("reading_plans").upsert(Object.assign({user_id:Auth.user.id},p));if(error)throw this.err(error)}
  const i=this.plans.findIndex(x=>x.book_id===p.book_id);if(i>=0)this.plans[i]=Object.assign(this.plans[i],p);else this.plans.push(Object.assign({start_date:today(),created_at:new Date().toISOString()},p));if(!this.cloud())ls.set(this.k("plans"),this.plans)},
 async delPlan(bid){await this.loadPlans();if(this.cloud()){const {error}=await Auth.sb.from("reading_plans").delete().eq("user_id",Auth.user.id).eq("book_id",bid);if(error)throw this.err(error)}this.plans=this.plans.filter(x=>x.book_id!==bid);if(!this.cloud())ls.set(this.k("plans"),this.plans)},
 // يسجّل تقدم القارئ في مشروع قراءة الكتاب (إن وُجد)
 touch:(()=>{let t=null;return(bid,p)=>{if(!Auth.user)return;clearTimeout(t);t=setTimeout(async()=>{try{const pl=(await Mine.loadPlans()).find(x=>x.book_id===bid&&x.active!==false);if(!pl||pl.last_page===p)return;pl.last_page=p;pl.last_read=new Date().toISOString();
  if(Mine.cloud())await Auth.sb.from("reading_plans").update({last_page:p,last_read:pl.last_read}).eq("user_id",Auth.user.id).eq("book_id",bid);else ls.set(Mine.k("plans"),Mine.plans);Bell.paint()}catch(e){}},2500)}})()};
/* حالة الورد اليومي */
function planStat(pl,b){const n=b&&b.pages?b.pages.length:(b&&b.n)||0,days=Math.max(1,Math.floor((new Date(today())-new Date(pl.start_date||today()))/864e5)+1),
 target=Math.min(n||1e9,(pl.start_page||1)-1+days*pl.daily),at=pl.last_page||pl.start_page||1,readToday=pl.last_read&&new Date(pl.last_read).toDateString()===new Date().toDateString(),
 [h,m]=String(pl.remind_at||"20:00").split(":").map(Number),due=!readToday&&new Date().getHours()*60+new Date().getMinutes()>=h*60+(m||0)&&(!n||at<n);
 return{n,target,at,behind:Math.max(0,target-at),done:n&&at>=n,readToday,due,pct:n?Math.round(at/n*100):0}}
/* جرس الإشعارات */
const Bell={items:[],async load(){const out=[];if(!Auth.user)return this.items=out;
  try{(await Mine.loadPlans()).filter(p=>p.active!==false).forEach(p=>{const b=B(p.book_id),s=planStat(p,b);if(s.due)out.push({id:"plan:"+p.book_id+":"+today(),title:"وردك اليوم من «"+(p.title||(b&&b.title)||"")+"»",body:`${pgs(p.daily)}${s.behind>p.daily?` (متأخر ${pgs(s.behind)})`:""} — أنت في صفحة ${toAr(s.at)}`,url:"#/book/"+p.book_id+"/"+s.at,at:new Date().toISOString(),local:1})})}catch(e){}
  if(Cloud.on()){try{const [n,bc]=await Promise.all([Auth.sb.from("notifications").select("*").eq("user_id",Auth.user.id).order("created_at",{ascending:false}).limit(30),Auth.sb.from("broadcasts").select("*").order("created_at",{ascending:false}).limit(15)]);
   (n.data||[]).forEach(x=>{if(!out.some(o=>o.local&&o.url===x.url))out.push({id:"n"+x.id,nid:x.id,title:x.title,body:x.body,url:x.url,at:x.created_at,read:x.read})});
   (bc.data||[]).forEach(x=>out.push({id:"b"+x.id,title:x.title,body:x.body,url:x.url,at:x.created_at,bc:1}))}catch(e){}}
  const seen=new Set(ls.get(Mine.k("seen"),[]));out.forEach(x=>{if(seen.has(x.id))x.read=true});out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));return this.items=out},
 unread(){return this.items.filter(x=>!x.read).length},
 async paint(){const btn=$("#bellbtn");if(!btn)return;btn.hidden=!Auth.user;if(!Auth.user)return;await this.load();const c=this.unread(),b=$("#bellc");b.hidden=!c;b.textContent=c>9?"+٩":toAr(c);
  if(c&&"Notification"in window&&Notification.permission==="granted"){const it=this.items.find(x=>!x.read&&x.local);const key="nshown:"+(it&&it.id);if(it&&!sessionStorage.getItem(key)){try{sessionStorage.setItem(key,1);const r=await navigator.serviceWorker.getRegistration();if(r)r.showNotification(it.title,{body:it.body,icon:"assets/logo-sdsl-128.png",dir:"rtl",lang:"ar",tag:it.id,data:{url:it.url}})}catch(e){}}}},
 open(){const l=this.items;openSheet("الإشعارات",`${l.length?l.map(x=>`<a class="nitem${x.read?"":" new"}" href="${esc(/^#\/[\w\-\/?=&%.]*$/.test(x.url||"")?x.url:"#/mine")}" data-act="closeSheet"><b>${esc(x.title)}</b>${x.body?`<span>${esc(x.body)}</span>`:""}<small class="mut">${esc(ago(x.at))}</small></a>`).join(""):'<p class="mut">لا إشعارات بعد. أنشئ «مشروع قراءة» لكتاب من أدوات القراءة ليصلك تذكير بوردك اليومي.</p>'}
  <div class="row" style="margin-top:12px"><a class="btn nf" href="#/mine?t=plans" data-act="closeSheet">مشاريع القراءة</a>${pushBtn()}</div>`);
  const ids=l.map(x=>x.id),seen=new Set(ls.get(Mine.k("seen"),[]));ids.forEach(i=>seen.add(i));ls.set(Mine.k("seen"),[...seen].slice(-300));
  const nids=l.filter(x=>x.nid&&!x.read).map(x=>x.nid);if(nids.length&&Cloud.on())Auth.sb.from("notifications").update({read:true}).in("id",nids).then(()=>{});l.forEach(x=>x.read=true);const b=$("#bellc");if(b)b.hidden=true}};
/* إشعارات الجهاز (تصل ولو كان الموقع مغلقًا) */
const pushOK=()=>"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window;
const pushBtn=()=>pushOK()&&Cloud.on()?`<button class="btn nf" data-act="pushon">${Notification.permission==="granted"?"✓ إشعارات الجهاز مفعّلة":"تفعيل إشعارات الجهاز"}</button>`:"";
async function pushOn(){if(!pushOK())throw new Error(/iPhone|iPad/.test(navigator.userAgent)?"على iPhone: أضف الموقع إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحه منها وفعّل الإشعارات.":"هذا المتصفح لا يدعم الإشعارات.");
 const perm=await Notification.requestPermission();if(perm!=="granted")throw new Error("لم يُسمح بالإشعارات. يمكنك السماح بها من إعدادات المتصفح للموقع.");
 const r=await navigator.serviceWorker.ready,j=await fetch("/api/remind?key=1").then(x=>x.json());if(!j.publicKey)throw new Error(j.message||"خدمة الإشعارات غير مهيأة على الخادم بعد.");
 const key=Uint8Array.from(atob(j.publicKey.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));let s=await r.pushManager.getSubscription();
 if(s&&s.options&&s.options.applicationServerKey&&btoa(String.fromCharCode(...new Uint8Array(s.options.applicationServerKey)))!==btoa(String.fromCharCode(...key))){await s.unsubscribe();s=null}
 if(!s)s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});const x=s.toJSON();
 const {error}=await Auth.sb.from("push_subs").upsert({endpoint:x.endpoint,user_id:Auth.user.id,p256dh:x.keys.p256dh,auth:x.keys.auth,ua:navigator.userAgent.slice(0,200)});if(error)throw Mine.err(error)}
/* شريط العلامة في القارئ */
async function paintMark(){const rb=$("#rb"),rib=$("#ribbon");if(!rb||!rib)return;const b=B(rb.dataset.id),p=+rb.dataset.p,go=$("#markgo");
 if(!Auth.user){rib.classList.remove("on");rib.title="ضع علامة على هذه الصفحة (للأعضاء)";if(go)go.hidden=true;return}
 let m;try{m=(await Mine.loadMarks())[b.id]}catch(e){m=null}if(!$("#rb")||+$("#rb").dataset.p!==p)return;
 const on=m&&m.page===p;rib.classList.toggle("on",!!on);rib.setAttribute("aria-pressed",!!on);rib.title=on?"العلامة هنا؛ اضغط لإزالتها":"ضع العلامة على هذه الصفحة";
 if(go){go.hidden=!(m&&!on);if(m&&!on){go.href="#/book/"+b.id+"/"+m.page;go.innerHTML=`<i class="rib-mini"></i> علامتك في صفحة ${toAr(m.page)}`}}}
async function toggleMark(){const c=cur();if(!c)return;if(!Auth.user){toast("علامة الصفحة للأعضاء: سجّل الدخول لتُحفظ علامتك وتعود إليها من أي جهاز");location.hash="#/account?next="+encodeURIComponent("#/book/"+c.b.id+"/"+c.p);return}
 try{const m=(await Mine.loadMarks())[c.b.id];if(m&&m.page===c.p){await Mine.delMark(c.b.id);toast("أُزيلت العلامة")}else{await Mine.setMark(c.b,c.p);toast("وُضعت العلامة على صفحة "+toAr(c.p)+(m?" (نُقلت من صفحة "+toAr(m.page)+")":""))}paintMark()}catch(e){alert(e.message)}}
/* تعليقات القارئ وتظليله */
function hlWords(rd,notes){const ws=[...rd.querySelectorAll(".w")],tk=ws.map(w=>norm(w.textContent));
 rd.querySelectorAll(".nmk").forEach(x=>x.remove());ws.forEach(w=>{w.classList.remove("hl");delete w.dataset.note;w.style.removeProperty("--hl")});
 notes.forEach(n=>{const q=norm(n.quote).split(/\s+/).filter(Boolean);if(!q.length)return;
  for(let i=0;i<=tk.length-q.length;i++){let ok=true;for(let j=0;j<q.length&&ok;j++){const a=tk[i+j],x=q[j];ok=q.length===1?a.includes(x):j===0?a.endsWith(x):j===q.length-1?a.startsWith(x):a===x}
   if(ok){for(let j=0;j<q.length;j++){const w=ws[i+j];w.classList.add("hl");w.dataset.note=n.id;w.style.setProperty("--hl",(NCOL[n.color]||NCOL.y)[1])}
    if(n.note)ws[i+q.length-1].insertAdjacentHTML("afterend",`<button class="nmk" data-act="noteopen" data-id="${n.id}" aria-label="تعليقك">✎</button>`);break}}})}
async function paintNotes(rd){rd=rd||$("#rb");if(!rd||!Auth.user)return;const bid=rd.dataset.id,p=+rd.dataset.p;try{const l=(await Mine.notesOf(bid)).filter(n=>n.page===p);if(l.length)hlWords(rd,l)}catch(e){}}
function noteDlg(n){const isNew=!n.id;openDlg(`<h3>${isNew?"تعليق خاص على النص":"تعليقك"}</h3><blockquote class="nq" style="--hl:${(NCOL[n.color]||NCOL.y)[1]}">${esc(n.quote)}</blockquote>
 <form data-form="note"><label>تعليقك (لا يراه غيرك)</label><textarea name="note" style="min-height:110px" placeholder="فائدة، أو سؤال، أو ربط بموضع آخر…">${esc(n.note||"")}</textarea>
 <label>لون التظليل</label><div class="swatches">${Object.entries(NCOL).map(([k,[t,c]])=>`<label class="swl"><input type="radio" name="color" value="${k}"${(n.color||"y")===k?" checked":""}><span style="background:${c}" title="${t}"></span></label>`).join("")}</div>
 <div class="row" style="margin-top:10px"><button class="btn p nf">حفظ</button>${isNew?"":`<button type="button" class="btn nf danger" data-act="notedel">حذف</button>`}<a class="btn nf" href="#/mine?t=notes" data-act="closeDlg">كل تعليقاتي</a></div><p id="nst" class="mut"></p></form>`);
 NOTE_EDIT=n}
let NOTE_EDIT=null;
async function bcList(){const box=$("#bclist");if(!box)return;const {data,error}=await Auth.sb.from("broadcasts").select("*").order("created_at",{ascending:false}).limit(20);if(error){box.textContent=Mine.err(error).message;return}
 box.innerHTML=(data||[]).length?data.map(x=>`<div class="nitem"><b>${esc(x.title)}</b>${x.body?`<span>${esc(x.body)}</span>`:""}<small class="mut">${esc(ago(x.created_at))} • ${x.pushed?"أُرسل للأجهزة":"ينتظر الإرسال للأجهزة"}</small> <button class="btn s" data-act="bcdel" data-id="${x.id}">حذف</button></div>`).join(""):"لا إشعارات بعد."}
async function bcSend(f){const fd=new FormData(f),st=$("#bcst");st.textContent="جارٍ الإرسال…";const {error}=await Auth.sb.from("broadcasts").insert({title:String(fd.get("title")).trim(),body:String(fd.get("body")||"").trim()||null,url:String(fd.get("url")||"").trim()||null});
 if(error){st.textContent=Mine.err(error).message;return}f.reset();st.textContent="✓ أُرسل";bcList();fetch("/api/remind").catch(()=>{})}
async function noteSave(f){const fd=new FormData(f),n=Object.assign({},NOTE_EDIT,{note:String(fd.get("note")||"").trim(),color:fd.get("color")||"y"});$("#nst").textContent="جارٍ الحفظ…";
 try{await Mine.saveNote(n);dlg().close();$$(`.rd[data-id="${n.book_id}"]`).forEach(r=>paintNotes(r));toast("حُفظ تعليقك")}catch(e){$("#nst").textContent=e.message}}
function selNote(){const s=String(getSelection()).trim().replace(/\s+/g," "),rd=selRd();if(!s||!rd)return;if(!Auth.user){toast("التعليقات الخاصة للأعضاء: سجّل الدخول أولًا");location.hash="#/account?next="+encodeURIComponent("#/book/"+rd.dataset.id+"/"+rd.dataset.p);return}
 const b=B(rd.dataset.id);noteDlg({book_id:b.id,page:+rd.dataset.p,title:b.setTitle||b.title,quote:s.slice(0,2900),color:"y"});getSelection().removeAllRanges()}
async function noteOpen(id){const rd=$(`.rd .w[data-note="${id}"]`);const bid=rd?rd.closest(".rd").dataset.id:null;const l=bid?await Mine.notesOf(bid):[];const n=l.find(x=>String(x.id)===String(id));if(n)noteDlg(n)}
/* مشروع القراءة */
async function planDlg(){const c=cur();if(!c)return;closeSheet();if(!Auth.user){toast("مشاريع القراءة للأعضاء: سجّل الدخول أولًا");location.hash="#/account?next="+encodeURIComponent("#/book/"+c.b.id+"/"+c.p);return}
 let pl=null;try{pl=(await Mine.loadPlans()).find(x=>x.book_id===c.b.id)}catch(e){return alert(e.message)}const n=c.b.pages.length,d=pl?pl.daily:Math.max(1,Math.min(20,Math.ceil(n/30)));
 openDlg(`<h3>مشروع قراءة: ${esc(c.b.setTitle||c.b.title)}</h3><p class="mut">حدّد وردك اليومي ووقت التذكير، فيصلك إشعار إن لم تقرأ وردك حتى ذلك الوقت.</p>
 <form data-form="plan" data-id="${c.b.id}"><div class="row"><div><label>عدد الصفحات يوميًا</label><input name="daily" type="number" min="1" max="500" value="${d}" required></div><div><label>وقت التذكير</label><input name="at" type="time" value="${esc(pl?pl.remind_at:"20:00")}"></div><div><label>البداية من صفحة</label><input name="sp" type="number" min="1" max="${n}" value="${pl?pl.start_page:c.p}"></div></div>
 <p class="mut" id="pest"></p>
 <div class="row" style="margin-top:8px"><button class="btn p nf">${pl?"حفظ التعديل":"ابدأ المشروع"}</button>${pl?'<button type="button" class="btn nf danger" data-act="plandel">إنهاء المشروع</button>':""}</div><p id="plst" class="mut"></p></form>
 ${pushOK()&&Cloud.on()?`<p class="note">ليصلك التذكير ولو كان الموقع مغلقًا فعّل إشعارات الجهاز: ${pushBtn()}</p>`:""}`);
 const est=()=>{const f=$('form[data-form="plan"]');if(!f)return;const k=Math.ceil((n-(+f.sp.value||1)+1)/Math.max(1,+f.daily.value||1));$("#pest").textContent=`تختم الكتاب (${toAr(n)} صفحة) في نحو ${toAr(k)} يومًا.`};est();$('form[data-form="plan"]').oninput=est}
async function planSave(f){const fd=new FormData(f),b=B(f.dataset.id),old=(Mine.plans||[]).find(x=>x.book_id===b.id);
 const p={book_id:b.id,title:b.setTitle||b.title,daily:+fd.get("daily"),remind_at:fd.get("at")||"20:00",start_page:+fd.get("sp")||1,active:true};if(!old||old.start_page!==p.start_page){p.start_date=today();p.last_page=p.start_page}
 $("#plst").textContent="جارٍ الحفظ…";try{await Mine.savePlan(p);dlg().close();toast("بدأ مشروع القراءة. يصلك التذكير في "+p.remind_at);Bell.paint()}catch(e){$("#plst").textContent=e.message}}
/* صفحة «مكتبتي» */
async function vMine(q){if(!Auth.user)return view(`<h2>مكتبتي</h2><p class="note">العلامات والتعليقات الخاصة ومشاريع القراءة للأعضاء. <a href="#/account?next=%23%2Fmine">سجّل الدخول أو أنشئ حسابًا</a> (مجانًا).</p>`);
 const t=q.t||"marks",tabs=[["marks","العلامات"],["notes","تعليقاتي"],["plans","مشاريع القراءة"]];
 view(`<h2>مكتبتي</h2><div class="tabs" role="tablist">${tabs.map(([k,n])=>`<a role="tab" href="#/mine?t=${k}" aria-selected="${k===t}">${n}</a>`).join("")}</div><div id="minebox" class="mut">جارٍ التحميل…</div>`);
 const box=$("#minebox");box.className="";const bk=(id,p)=>`#/book/${id}/${p}`;
 try{if(t==="marks"){const m=Object.values(await Mine.loadMarks()).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
   box.innerHTML=m.length?m.map(x=>`<a class="bk" href="${bk(x.book_id,x.page)}"><b><i class="rib-mini"></i> ${esc(x.title||(B(x.book_id)||{}).title||x.book_id)}</b><span>صفحة ${toAr(x.page)} • ${esc(ago(x.updated_at))}</span></a>`).join(""):"لا علامات بعد. اضغط الشريط أعلى الصفحة في القارئ لتضع علامتك."}
  else if(t==="notes"){const l=await Mine.allNotes();const g={};l.forEach(n=>(g[n.book_id]=g[n.book_id]||[]).push(n));
   box.innerHTML=(l.length?`<div class="row" style="margin-bottom:10px"><button class="btn s p" data-act="nbexp" data-f="doc">تصدير دفتري بحثًا (Word)</button><button class="btn s" data-act="nbexp" data-f="txt">نصًا</button><button class="btn s" data-act="tashtog2">${S.tash?"التصدير بالتشكيل ✓":"التصدير بلا تشكيل ✓"}</button></div>`:"")+(l.length?Object.entries(g).map(([id,ns])=>`<h3>${esc(ns[0].title||(B(id)||{}).title||id)}</h3>${ns.sort((a,b)=>a.page-b.page).map(n=>`<a class="nrow" href="${bk(id,n.page)}"><blockquote class="nq" style="--hl:${(NCOL[n.color]||NCOL.y)[1]}">${esc(n.quote.length>260?n.quote.slice(0,260)+"…":n.quote)}</blockquote>${n.note?`<p>${esc(n.note)}</p>`:""}<small class="mut">صفحة ${toAr(n.page)} • ${esc(ago(n.updated_at||n.created_at))}</small></a>`).join("")}`).join(""):"لا تعليقات بعد. حدّد عبارة في أي كتاب ثم اضغط «تعليق» لتظللها وتكتب فائدتك.")}
  else{const l=await Mine.loadPlans();box.innerHTML=(l.length?l.map(p=>{const b=B(p.book_id),s=planStat(p,b);return`<div class="plan"><a href="${bk(p.book_id,s.at)}"><b>${esc(p.title||(b||{}).title||"")}</b></a><div class="prog"><i style="width:${s.pct}%"></i></div><span class="mut">${s.done?"✓ أتممت الكتاب":`صفحة ${toAr(s.at)} من ${toAr(s.n)} • الورد ${pgs(p.daily)} يوميًا • التذكير ${esc(p.remind_at||"")}`}${s.behind?` • <b class="warn">متأخر ${pgs(s.behind)}</b>`:s.readToday?" • ✓ قرأت اليوم":""}</span></div>`}).join(""):"<p>لا مشاريع قراءة بعد. افتح كتابًا ثم «المزيد ← مشروع قراءة».</p>")+`<p style="margin-top:10px">${pushBtn()}</p>`}}
 catch(e){box.innerHTML=`<p class="note">${esc(e.message)}</p>`}}
function ago(d){const t=new Date(d);if(!d||isNaN(t))return"";if(/^\d{4}-\d\d-\d\d$/.test(d)){const k=Math.round((new Date(today())-t)/864e5);return k<=0?"اليوم":k===1?"أمس":fmtDate(d)}const s=(Date.now()-t)/1000;if(s<60)return"الآن";
 const f=(n,one,two,few,many)=>n===1?one:n===2?two:n<=10?`${toAr(n)} ${few}`:`${toAr(n)} ${many}`;
 if(s<3600)return"منذ "+f(Math.floor(s/60),"دقيقة","دقيقتين","دقائق","دقيقة");if(s<86400)return"منذ "+f(Math.floor(s/3600),"ساعة","ساعتين","ساعات","ساعة");
 if(s<7*86400)return"منذ "+f(Math.floor(s/86400),"يوم","يومين","أيام","يومًا");return fmtDate(d)}
const linkify=h=>h.replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u.length>48?u.slice(0,45)+"…":u}</a>`);
const KINDN={book:"كتاب جديد في المكتبة",article:"مقال",fatwa:"فتوى",statement:"بيان"};
function postText(x){if(!x.act)return x.text||"";const b=x.b;if(!b.pages)return"";
 const clean=t=>plain(t||"").replace(/-*\s*NO PAGE\s*NO\s*-*/gi," ").replace(/[ \t]+/g," ").trim();if(isArt(b))return clean(b.pages[0]);
 return b.pages.slice(0,25).map(clean).find(t=>t.length>350&&!/(ت|هاتف|فاكس)\s*:\s*\d{5}|رقم الإيداع|الطبعة|حقوق الطبع/.test(t.slice(0,300)))||clean(b.pages[0])}
function postHtml(x,st){st=st||{stats:{},likes:new Map(),saves:new Set()};const s=st.stats[x.id]||{likes:0,comments:0,kinds:{}},my=st.likes.get?st.likes.get(x.id):(st.likes.has(x.id)?"like":null),saved=st.saves.has(x.id),name=pName(x);
 const av=x.authorId&&A(x.authorId).photo?`<img class="av" data-author="${x.authorId}" src="${esc(A(x.authorId).photo)}" alt="">`:x.authorId?`<span class="av" data-author="${x.authorId}" style="${avHue(x.authorId)}">${esc(name.replace(/^(الشيخ|الدكتور|د\.)\s*/,"")[0]||"")}</span>`:x.member?`<a href="#/member/${x.uid}" class="av" style="${avHue(x.uid)}">${esc((x.name||"ع")[0])}</a>`:`<img class="av" src="assets/logo-sdsl-128.png" alt="">`;
 let body;if(x.member){body=quoteHtml(x.quote)}else if(x.act){const ex=postText(x);body=`<a class="pcard" href="#/book/${x.b.id}/1"><b>${esc(x.b.title)}</b>${ex?`<p>${esc(ex.slice(0,360))}${ex.length>360?"…":""}</p>`:""}<span>${kindOf(x.b)==="book"?"افتح الكتاب":"اقرأ كاملًا"} ←</span></a>`}
 else{const long=(x.text||"").length>420;body=`<div class="ptext${long?" clip":""}">${linkify(esc(x.text||"")).replace(/\n/g,"<br>")}</div>${long?'<button class="more-t" data-act="pmore">عرض المزيد</button>':""}${x.image?`<img class="pimg" src="${esc(x.image)}" alt="" loading="lazy">`:""}${x.url?`<a class="plink" href="${esc(x.url)}" target="_blank" rel="noopener">المنشور الأصلي ↗</a>`:""}`}
 return`<article class="post" data-id="${esc(x.id)}"><header>${av}<div><b${x.authorId?` data-author="${x.authorId}"`:""}>${x.member?`<a href="#/member/${x.uid}">${esc(name)}</a>`:esc(name)}</b><span class="mut">${x.pinned?"📌 مثبّت • ":""}${x.hidden?'<b class="warn">مخفي عن الأعضاء</b> • ':""}${x.act?KINDN[kindOf(x.b)]+" • ":x.member?"مختارة من كتاب • ":""}<a href="#/post/${encodeURIComponent(x.id)}">${esc(ago(x.date))}</a>${x.src?` • ${esc(x.src)}`:""}${x.demo?" • منشور تجريبي":""}</span></div><button class="pmenu" data-act="pmenu" aria-label="خيارات المنشور">⋯</button></header>
 ${body}
 <div class="pstats"><button class="lnk rxsum" data-act="rxwho" data-likes="${s.likes}" data-kinds="${esc(JSON.stringify(s.kinds||{}))}">${rxSum(s)}</button><button class="lnk" data-act="pcomm">${s.comments?`${toAr(s.comments)} تعليق`:""}</button></div>
 <div class="pact"><button data-act="plike" class="rxbtn" data-my="${my||""}" aria-pressed="${!!my}">${rxLabel(my)}</button><button data-act="pcomm">💬 تعليق</button><button data-act="psave" aria-pressed="${saved}">${saved?"★ محفوظ":"☆ حفظ"}</button><button data-act="pshare">↗ مشاركة</button></div>
 <div class="pcomms" hidden></div></article>`}
/* التفاعلات على المنشورات (على طريقة مواقع التواصل): ضغطة للإعجاب، وضغطة مطولة لاختيار تفاعل آخر */
const REACT={like:["👍","أعجبني"],love:["❤️","أحببته"],dua:["🤲","جزاه الله خيرًا"],benefit:["💡","فائدة"],wow:["😮","مدهش"],sad:["😢","محزن"]};
const rxLabel=k=>k&&REACT[k]?`<span class="rxe">${REACT[k][0]}</span> ${REACT[k][1]}`:'<span class="rxe">👍</span> أعجبني';
function rxSum(s){const n=+s.likes||0;if(!n)return"";const ks=Object.entries(s.kinds||{}).filter(([k,v])=>REACT[k]&&v>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>REACT[k][0]).join("");return`<span class="rxs">${ks||"👍"}</span> ${toAr(n)}`}
function rxPicker(btn){document.querySelectorAll(".rxpick").forEach(x=>x.remove());const r=btn.getBoundingClientRect(),d=document.createElement("div");d.className="rxpick";d.setAttribute("role","menu");
 d.innerHTML=Object.entries(REACT).map(([k,[e,t]])=>`<button role="menuitem" data-act="preact" data-k="${k}" title="${t}" aria-label="${t}"><span>${e}</span><small>${t}</small></button>`).join("");document.body.appendChild(d);
 const w=d.offsetWidth;d.style.top=(scrollY+r.top-d.offsetHeight-8)+"px";d.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+"px";d._btn=btn;
 setTimeout(()=>{const off=e=>{if(!d.contains(e.target)){d.remove();document.removeEventListener("pointerdown",off,true)}};document.addEventListener("pointerdown",off,true)},0)}
(function rxPress(){let t=null,fired=false;document.addEventListener("pointerdown",e=>{const b=e.target.closest(".rxbtn");if(!b)return;fired=false;clearTimeout(t);t=setTimeout(()=>{fired=true;rxPicker(b);if(navigator.vibrate)navigator.vibrate(12)},430)});
 ["pointerup","pointercancel"].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(t),true));
 document.addEventListener("click",e=>{const b=e.target.closest(".rxbtn");if(b&&fired){e.stopImmediatePropagation();e.preventDefault();fired=false}},true);
 document.addEventListener("contextmenu",e=>{if(e.target.closest(".rxbtn"))e.preventDefault()});
 document.addEventListener("mouseover",e=>{const b=e.target.closest(".rxbtn");if(!b||matchMedia("(pointer:coarse)").matches||document.querySelector(".rxpick"))return;setTimeout(()=>{if(b.matches(":hover")&&!document.querySelector(".rxpick"))rxPicker(b)},650)})})();
async function setReact(card,k){const btn=card.querySelector(".rxbtn"),sp=card.querySelector(".rxsum"),id=card.dataset.id,old=btn.dataset.my||null;if(old===k)k=null;
 const kinds=JSON.parse(sp.dataset.kinds||"{}");let n=+sp.dataset.likes||0;if(old){kinds[old]=Math.max(0,(kinds[old]||1)-1);n--}if(k){kinds[k]=(kinds[k]||0)+1;n++}
 const paint=(kk,ks,nn)=>{btn.dataset.my=kk||"";btn.setAttribute("aria-pressed",!!kk);btn.innerHTML=rxLabel(kk);sp.dataset.kinds=JSON.stringify(ks);sp.dataset.likes=Math.max(0,nn);sp.innerHTML=rxSum({likes:Math.max(0,nn),kinds:ks})};
 const prev=[old,JSON.parse(sp.dataset.kinds||"{}"),+sp.dataset.likes||0];paint(k,kinds,n);
 try{await Social.react(id,k)}catch(e){paint(...prev);throw e}}
const avHue=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))%360;return`background:linear-gradient(135deg,hsl(${h} 45% 38%),hsl(${(h+40)%360} 50% 28%));color:#fff`};
const FEED={list:[],pos:0,busy:false,obs:null};
async function vPosts(q){if(q.k==="picks")return go("#/community",true);const k=q.k||"",tabs=[["","الكل"],["follow","متابَعاتي"],["posts","منشورات المشايخ"],["lib","جديد المكتبة"],["saved","محفوظاتي"]];
 const url=o=>{const n=Object.assign({k,a:q.a||""},o),p=new URLSearchParams();if(n.k)p.set("k",n.k);if(n.a)p.set("a",n.a);return"#/posts"+(p.toString()?"?"+p:"")};
 await loadPosts();const cnt={};POSTS.concat(actPosts()).forEach(x=>{if(x.authorId)cnt[x.authorId]=(cnt[x.authorId]||0)+(x.act?1:5)});const authors=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,24);if(q.a&&!authors.includes(q.a))authors.unshift(q.a);
 view(`<h2>منشورات</h2><p class="mut">منشورات مختارة لمشايخ الدعوة السلفية وكتّابها، وجديد المكتبة من كتب ومقالات وفتاوى وبيانات. ${Auth.user?"":'<a href="#/account?next=%23%2Fposts">سجّل الدخول</a> للإعجاب والتعليق والحفظ والمشاركة.'}</p>
 <div class="tabs" role="tablist">${tabs.map(([v,l])=>`<a role="tab" aria-selected="${k===v}" href="${url({k:v})}">${l}</a>`).join("")}</div>
 <div class="pstrip" data-noswipe><a href="${url({a:""})}"${!q.a?' aria-current="true"':""}><span class="ring"><img src="assets/logo-sdsl-128.png" alt=""></span><small>الكل</small></a>${authors.map(id=>{const nm=A(id).name,sh=nm.replace(/^(الشيخ|الدكتور|د\.)\s*/,"");return`<a href="${url({a:id})}"${q.a===id?' aria-current="true"':""}><span class="ring"><span class="av" style="${avHue(id)}">${esc(sh[0]||"")}</span></span><small>${esc(sh.split(/\s+/).slice(0,2).join(" "))}</small></a>`}).join("")}</div>
 <a class="cmcta" href="#/community"><b>مجتمع المكتبة</b><span>مختارات الأعضاء من الكتب: تفاعل وعلّق وشارك واحفظ ←</span></a>${Auth.user&&Cloud.on()&&k==="saved"?'<div class="row ptools"><button class="btn s" data-act="pexport" data-k="saved">تصدير المحفوظات</button></div>':""}
 <div id="feed" class="feed"></div><div id="feedEnd" class="mut feedend">جارٍ التحميل…</div>`);
 let list;if(k==="saved"){if(!Auth.user){$("#feedEnd").innerHTML='<a href="#/account?next=%23%2Fposts%3Fk%3Dsaved">سجّل الدخول</a> لترى منشوراتك المحفوظة.';return}list=(await Social.savedIds()).map(findPost).filter(Boolean)}
 else if(k==="follow"){if(!Auth.user){$("#feedEnd").innerHTML='<a href="#/account?next=%23%2Fposts%3Fk%3Dfollow">سجّل الدخول</a> لترى منشورات من تتابعهم.';return}
  const fs=await Members.myFollows(),aids=new Set([...fs].filter(x=>x[0]==="a").map(x=>x.slice(2))),uids=[...fs].filter(x=>x[0]==="u").map(x=>x.slice(2));
  if(!aids.size){$("#feedEnd").innerHTML='لا تتابع أحدًا من المشايخ بعد. افتح صفحة شيخ واضغط «متابعة»؛ تظهر منشوراته هنا. ومتابعة الأعضاء في <a href="#/community?k=follow">مجتمع المكتبة</a>.';return}
  list=POSTS.concat(actPosts()).filter(x=>aids.has(x.authorId));list.sort((x,y)=>String(y.date||"").localeCompare(String(x.date||"")))}
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
async function vPost(id){await loadPosts();const x=findPost(id)||(/^m\d+$/.test(id)&&typeof Members!=="undefined"?await Members.post(id):null);if(!x)return view('<p class="note">المنشور غير موجود.</p><p><a href="#/posts">← كل المنشورات</a></p>');
 if(x.act)x.b=await loadBook(x.b.id).catch(()=>x.b);const st=await Social.state([x.id]);
 view(`<p><a href="${x.member?"#/community":"#/posts"}">← ${x.member?"مجتمع المكتبة":"كل المنشورات"}</a></p><div class="feed">${postHtml(x,st)}</div>`);openComments($(".post"))}
function needLogin(msg){openSheet("للأعضاء المسجلين",`<p>${esc(msg||"الإعجاب والتعليق والحفظ والمشاركة متاحة لأعضاء المكتبة المسجلين، والقراءة متاحة للجميع.")}</p><div class="row"><a class="btn p nf" href="#/account?m=signup&next=${encodeURIComponent(HERE())}" data-act="closeSheet">أنشئ حسابًا مجانيًا</a><a class="btn nf" href="#/account?next=${encodeURIComponent(HERE())}" data-act="closeSheet">لدي حساب</a></div>`)}
const postShareText=x=>`${x.member&&x.quote?"«"+x.quote.t+"»\n— "+x.quote.title+(x.quote.au?"، "+x.quote.au:"")+(x.quote.pl?"، "+x.quote.pl:"")+"\nاختارها":x.act?x.b.title+"\n"+postText(x).slice(0,600):x.text}\n— ${pName(x)}\n${SITENAME}${siteLink()?"\n"+siteLink("#/post/"+encodeURIComponent(x.id)):""}`;
async function postAct(a,el){if(a==="preact"){const pk=el.closest(".rxpick"),b=pk&&pk._btn;if(pk)pk.remove();if(!b)return;if(!Auth.user)return needLogin();try{await setReact(b.closest(".post"),el.dataset.k)}catch(e){toast(e.message)}return}
 const card=el.closest(".post"),id=(card&&card.dataset.id)||el.dataset.id,x=findPost(id);if(!x&&a!=="pdelc")return;
 const must=()=>{if(!Auth.user){needLogin();return false}return true};
 try{
 if(a==="pmore"){card.querySelector(".ptext").classList.remove("clip");el.remove()}
 else if(a==="plike"){if(!must())return;await setReact(card,el.dataset.my?el.dataset.my:"like")}
 else if(a==="psave"){if(!must())return;const on=el.getAttribute("aria-pressed")!=="true";el.setAttribute("aria-pressed",on);el.textContent=on?"★ محفوظ":"☆ حفظ";await Social.save(id,on);toast(on?"حُفظ في «محفوظاتي»":"أُزيل من المحفوظات")}
 else if(a==="pcomm"){const box=card.querySelector(".pcomms");if(!box.hidden&&box.innerHTML){box.hidden=true;return}openComments(card)}
 else if(a==="pdelc"){if(confirm("حذف التعليق؟")){await Social.delComment(id,el.dataset.cid);openComments(card)}}
 else if(a==="pshare"){if(!must())return;openSheet("مشاركة المنشور",`<div class="tools-grid"><button data-act="pcopy" data-id="${esc(id)}">نسخ النص مع المصدر</button><button data-act="pimgq" data-id="${esc(id)}">تصميمه صورة (قبسة)</button><button data-act="pnative" data-id="${esc(id)}">مشاركة عبر التطبيقات</button><button data-act="plink" data-id="${esc(id)}">نسخ رابط المنشور</button></div><p class="mut" style="margin-top:10px">التصميم صورة يفتح استوديو القبسات بنص المنشور، فتختار الخلفية والمقاس.</p>`)}
 else if(a==="rxwho"){if(!(+el.dataset.likes))return;openSheet("التفاعلات",'<p class="mut">جارٍ التحميل…</p>');const l=await Social.reactors(id);const g={};l.forEach(r=>(g[r.kind]=g[r.kind]||[]).push(r));
  openSheet("التفاعلات",l.length?Object.entries(g).map(([k,rs])=>`<h4>${REACT[k]?REACT[k][0]+" "+REACT[k][1]:k} (${toAr(rs.length)})</h4><div class="chips">${rs.map(r=>`<a class="chip" href="#/member/${r.uid}" data-act="closeSheet">${esc(r.name)}</a>`).join("")}</div>`).join(""):'<p class="mut">لا تفاعلات بعد.</p>')}
 else if(a==="pmenu"){const canDel=!x.act&&(x.mine||GH.on||(x.member&&Auth.user&&(x.uid===Auth.user.id||Cloud.staff())));openSheet("خيارات المنشور",`<div class="tools-grid"><button data-act="plink" data-id="${esc(id)}">نسخ رابط المنشور</button>${x.member&&typeof cmMenu==="function"?cmMenu(x):""}${x.authorId?`<a href="#/posts?a=${x.authorId}" data-act="closeSheet">منشورات ${esc(A(x.authorId).name)}</a>`:""}${x.act?`<a href="#/book/${x.b.id}/1" data-act="closeSheet">فتح في المكتبة</a>`:""}${canDel?`<button data-act="pdel" data-id="${esc(id)}">حذف المنشور</button>`:""}</div>`)}
 else if(a==="pcopy"){if(!must())return;await navigator.clipboard.writeText(postShareText(x));closeSheet();toast("نُسخ المنشور مع اسم الكاتب والموقع.")}
 else if(a==="plink"){const u=siteLink("#/post/"+encodeURIComponent(id))||location.origin+"/post/"+encodeURIComponent(id);await navigator.clipboard.writeText(u);closeSheet();toast("نُسخ رابط المنشور")}
 else if(a==="pnative"){closeSheet();const t=postShareText(x);if(navigator.share)await navigator.share({text:t}).catch(()=>{});else{await navigator.clipboard.writeText(t);toast("نُسخ للمشاركة.")}}
 else if(a==="pimgq"){if(!must())return;closeSheet();const t=postText(x);pendingQ={t:t.length>600?t.slice(0,600)+"…":t,src:pName(x)+(x.act?" — "+x.b.title:""),ref:x.act?{b:x.b.id,p:1}:null};location.hash="#/qabasat"}
 else if(a==="pdel"){if(!confirm("حذف هذا المنشور؟"))return;closeSheet();if(x.member){await Members.del(x);toast("حُذف المنشور.");return route()}
  if(x.mine){ls.set("posts_local",ls.get("posts_local",[]).filter(y=>y.id!==id))}
  else if(GH.on){await GH.editJSON("data/posts.json",o=>{o.items=(o.items||[]).filter(y=>y.id!==id);return o},"حذف منشور");toast("حُذف المنشور، ويختفي عند الجميع خلال دقيقة.")}
  POSTS=null;route()}
 }catch(e){console.warn(e);toast(e.message||"تعذر تنفيذ الطلب")}}

/* ---------- إدارة التشكيل ---------- */
async function tkAdmin(){const el=$("#tkadm");if(!el)return;TK.list=null;TK.busy=false;await TK.init();const L=TK.list||{};let Q={items:[]};try{const r=await fetch(TK.raw("_queue.json"));if(r.ok)Q=await r.json()}catch(e){}
 const bs=lib.books.filter(b=>kindOf(b)==="book"&&!b.demo).sort((x,y)=>(x.col===y.col?0:x.col==="dawah"?-1:1)||(x.n||0)-(y.n||0));
 el.className="";el.innerHTML=`<p class="note">كتب مكتبة الدعوة تُشكَّل وتُراجَع تلقائيًا، وكتب التراث وغيرها حسب الطلب: قدّم الكتاب في الطابور هنا، أو من «أدوات القراءة ← اطلب تشكيل هذا الكتاب» (ويصلك طلب الأعضاء إشعارًا).</p><p class="mut">يُشكَّل الكتاب ليلًا بالحصة المجانية: يشكّله Gemini بحسب الإعراب والصرف، ثم تراجعه جولة تدقيق مستقلة (Gemini Pro إن أتاحت الحصة) كلمة كلمة. ولا يتغير حرف من نص الكتاب: تُنقل الحركات وحدها إلى حروفه، وما اختلفت حروفه يبقى كما هو. ولا تُشكَّل كتب التحويل الآلي إلا بعد اكتمال تدقيقها، ويُعاد تشكيل أي صفحة يُصحَّح نصها.</p>
 <p class="note">يظهر التشكيل لك أنت للمعاينة، ولا يظهر للأعضاء إلا بعد «اعتماد العرض» لكل كتاب.</p>
 <form data-form="tkq" class="stepper"><select name="b">${bs.map(b=>`<option value="${b.id}">${esc(b.setTitle||b.title)}</option>`).join("")}</select><button class="btn p">قدّمه في الطابور</button></form>
 ${(Q.items||[]).length?`<p class="mut">في المقدمة: ${Q.items.map(x=>esc((B(x.id||x)||{}).title||x.id||x)).join("، ")}</p>`:""}
 ${Object.entries(L).map(([id,x])=>{const b=B(id);return`<div class="bk"><b>${esc(b?b.setTitle||b.title:id)}</b> ${x.ok?'<em class="tag">معروض للأعضاء</em>':'<em class="tag">معاينة</em>'}<span>شُكّلت ${toAr(x.n)} من ${toAr(x.of)} صفحة • دُقق بمحرك ثانٍ ${toAr(x.rev||0)} • ${esc(x.upd||"")}</span><div class="row" style="margin-top:6px"><a class="btn s nf" href="#/book/${id}/1">معاينة</a><button class="btn s nf" data-act="tkok" data-id="${id}" data-on="${x.ok?0:1}">${x.ok?"إيقاف العرض":"اعتماد العرض للأعضاء"}</button></div></div>`}).join("")||'<p class="mut">لم يُشكَّل كتاب بعد؛ أول جولة الليلة بإذن الله.</p>'}`}
document.addEventListener("click",async e=>{const el=e.target.closest('[data-act="tkok"]');if(!el)return;try{const on=el.dataset.on==="1";if(on&&!confirm("اعتماد تشكيل هذا الكتاب وعرضه للأعضاء؟"))return;await GH.editJSON("data/tashkeel/_list.json",o=>{if(o[el.dataset.id]){if(on)o[el.dataset.id].ok=1;else o[el.dataset.id].ok=0}return o},(on?"اعتماد تشكيل: ":"إيقاف عرض تشكيل: ")+el.dataset.id,true);toast(on?"اعتُمد التشكيل؛ يظهر للأعضاء خلال دقائق":"أوقف العرض");tkAdmin()}catch(x){toast(x.message)}});
document.addEventListener("submit",async e=>{const f=e.target.closest('[data-form="tkq"]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();try{const id=f.b.value;await GH.editJSON("data/tashkeel/_queue.json",o=>{o=o||{items:[]};o.items=[{id}].concat((o.items||[]).filter(x=>(x.id||x)!==id));return o},"تشكيل: تقديم «"+((B(id)||{}).title||id)+"»");toast("قُدّم الكتاب؛ يبدأ تشكيله خلال دقائق");tkAdmin()}catch(x){toast(x.message)}},true);

/* ---------- تصحيحات القراء ---------- */
function corrDlg(){const c=cur();if(!c)return;closeSheet();const b=c.b,i=c.p-1;
 if(Cloud.on()&&!Auth.user)return needLogin("اقتراح التصحيحات متاح للأعضاء المسجلين.");
 openDlg(`<h3>اقتراح تصحيح</h3><p class="mut">${esc(b.title)}${PL(b,i)?" — "+esc(PL(b,i)):isArt(b)?"":" — صفحة "+toAr(c.p)}. عدّل النص كما ينبغي أن يكون، واكتب ملاحظة إن شئت، فيراجعه المشرفون قبل اعتماده.</p>
 <form data-form="corrsend" data-id="${b.id}" data-p="${c.p}"><textarea name="t" style="min-height:240px">${esc(b.pages[i])}</textarea><label>ملاحظة (اختياري)</label><input name="n" placeholder="مثال: خطأ مطبعي في السطر الثالث"><button class="btn p" style="margin-top:8px">${Cloud.on()?"إرسال التصحيح للمراجعة":"إرسال عبر واتساب"}</button></form>`)}
async function corrSend(f){const fd=new FormData(f),b=B(f.dataset.id),p=+f.dataset.p,t=String(fd.get("t")||""),n=String(fd.get("n")||"");
 try{if(Cloud.on()){const {error}=await Auth.sb.from("corrections").insert({book_id:b.id,page:p,proposed:t,note:n,user_id:Auth.user.id,user_name:Auth.user.name||""});if(error)throw new Error(error.message);if(typeof tgNote==="function")tgNote("corr",{subject:(b.setTitle||b.title)+" — ص "+p,detail:n||t.slice(0,200)});dlg().close();toast("شكرًا لك، أُرسل التصحيح للمراجعة.")}
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
 {h:"#/library?c=dawah",n:"الدعوة",i:'<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>',is:(p,q)=>p[0]==="library"&&q.c==="dawah"},
 {h:"#/library?c=turath",n:"التراث",i:'<path d="M6 3h10l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',is:(p,q)=>p[0]==="library"&&q.c==="turath"},
 {h:"#/posts",n:"منشورات",i:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',is:(p)=>p[0]==="posts"},
 {h:"#/community",n:"المجتمع",i:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 14.3c3.2-.5 6.5 1.6 6.5 5.7"/>',is:(p)=>p[0]==="community"},
 {h:"#/audio",n:"صوتيات",i:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>',is:(p)=>p[0]==="audio"},
 {h:"#/radio",n:"الراديو",i:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14.5" r="3"/><path d="M6.5 12.5h4M6.5 16.5h4"/>',is:(p)=>p[0]==="radio"},
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
 dock(){let d=$("#dock");if(d)return d;document.body.insertAdjacentHTML("beforeend",`<nav id="dock" aria-label="الأقسام الرئيسية" style="--n:${SECS.length}" hidden><span class="dk-ind"></span>${SECS.map((x,i)=>`<a href="${x.h}" data-pg="${i}">${PG_ICON(x.i)}<span>${x.n}</span></a>`).join("")}</nav><div id="peek" aria-hidden="true"></div>`);
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
function parse(){const h=(location.hash.startsWith("#/")?location.hash.slice(1):"")||(location.pathname.replace(/^\/index\.html$/,"/")||"/")+location.search;const[p,qs]=h.split("?");return{p:p.split("/").filter(Boolean).map(decodeURIComponent).map((x,i)=>i?x:x.toLowerCase().replace(/\.html$/,"")),q:Object.fromEntries(new URLSearchParams(qs||""))}}
(function(){const b=document.querySelector('[data-act="uilang"]');if(b)b.textContent=S.ui==="en"?"ع":"EN"})();
function route(){const{p,q}=parse(),v=p[0];if(v!=="book"&&TTS.on)TTS.stop();Pager.onRoute();applyLabels();$("#selq").hidden=true;closeSheet();document.body.classList.toggle("reading",v==="book");if(v!=="book")document.body.classList.remove("reading-full");
 if(!v)return vHome();if(v==="library")return vLibrary(q);if(v==="articles")return vList("article",q);if(v==="fatawa")return vList("fatwa",q);if(v==="bayanat")return vList("statement",q);
 if(v==="posts")return vPosts(q);if(v==="community")return vCommunity(q);if(v==="audio")return vAudio(q,p[1]);if(v==="radio")return vRadio(q,p[1]);if(v==="post")return vPost(p[1]);if(v==="member")return vMember(p[1]);if(v==="messages")return vMessages();if(v==="furqan")return vFurqan();if(v==="tafrighat")return vTafrighat();if(v==="about")return vAbout();if(v==="dawah")return vDawah();if(v==="history")return vHistory();if(v==="contact")return vContact();if(v==="authors")return vAuthors();if(v==="author")return vAuthor(p[1],q);
 if(v==="topics")return vLibrary({});if(v==="topic")return vLibrary({t:p[1]});if(v==="book"){const r=vBook(p[1],+p[2],q.h);if(q.tts)Promise.resolve(r).then(()=>setTimeout(()=>{if(typeof AP!=="undefined"&&AP.el&&!AP.el.paused)AP.toggle(false);TTS.start()},700));return r}if(v==="search")return vSearch(q);
 if(v==="qabasat")return vQabasat(q);if(v==="favs")return vFavs();if(v==="admin")return vAdmin(q);if(v==="ask"||v==="ai")return vAsk(q);if(v==="tarajim")return vTarajim();if(v==="tarjama")return vTarjama(p[1]);if(v==="account")return vAccount(q);if(v==="mine")return vMine(q);vHome()}
/* الروابط: يكتبها الموقع بصيغة #/… ويحوّلها إلى روابط عادية (/book/…) تفهمها محركات البحث وتُشارك كما هي */
const toPath=h=>{const p=String(h).replace(/^#/,"");return p.startsWith("/")?p:"/"+p};
function go(h,replace){history[replace?"replaceState":"pushState"](null,"",toPath(h));route()}
window.addEventListener("hashchange",()=>{if(location.hash.startsWith("#/"))history.replaceState(null,"",toPath(location.hash));route()});
window.addEventListener("popstate",route);
document.addEventListener("click",e=>{const a=e.target.closest('a[href^="#/"]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==="_blank")return;e.preventDefault();const h=a.getAttribute("href");if(toPath(h)!==location.pathname+location.search)go(h);else route()});
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]"),w=e.target.closest(".rd .w");
 const fr=e.target.closest(".rd .fnr"),dg=x=>String(x).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
 if(fr&&!el){const k=dg(fr.dataset.fn||fr.textContent.replace(/[^\d٠-٩]/g,"")),fb=fr.closest(".rd").querySelector(".fnb");const hit=fb&&[...fb.querySelectorAll("p")].find(x=>dg(x.textContent).replace(/[^\d]/g," ").trim().split(/\s+/)[0]===k);if(hit){openSheet("الحاشية "+k,`<p class="rdfn">${esc(hit.textContent)}</p>`);return}}
 if(w&&!el){if(String(getSelection()).trim())return;if(w.dataset.note)return noteOpen(w.dataset.note);return}if(!el)return;const a=el.dataset.act;
 if(a==="closeDlg")dlg().close();
 else if(a==="bcdel"){if(confirm("حذف هذا الإشعار؟")){await Auth.sb.from("broadcasts").delete().eq("id",el.dataset.id);bcList()}}
 else if(a==="mark")toggleMark();else if(a==="selnote")selNote();else if(a==="noteopen")noteOpen(el.dataset.id);else if(a==="plan")planDlg();else if(a==="bell")Bell.open();
 else if(a==="notedel"){if(NOTE_EDIT&&confirm("حذف هذا التعليق والتظليل؟")){try{await Mine.delNote(NOTE_EDIT);dlg().close();$$(`.rd[data-id="${NOTE_EDIT.book_id}"]`).forEach(r=>{hlWords(r,[]);paintNotes(r)});toast("حُذف التعليق")}catch(x){alert(x.message)}}}
 else if(a==="plandel"){const f=el.closest("form");if(confirm("إنهاء مشروع القراءة لهذا الكتاب؟")){try{await Mine.delPlan(f.dataset.id);dlg().close();toast("انتهى المشروع");Bell.paint()}catch(x){alert(x.message)}}}
 else if(a==="pushon"){el.disabled=true;try{await pushOn();el.textContent="✓ إشعارات الجهاز مفعّلة";toast("فُعّلت إشعارات الجهاز")}catch(x){el.disabled=false;alert(x.message)}}
 else if(a==="closeSheet"){if(el.tagName!=="A")e.preventDefault();closeSheet()}
 else if(a==="toc")tocSheet();else if(a==="goto")gotoSheet();else if(a==="more")moreSheet();else if(a==="prev")turn(-1);else if(a==="next")turn(1);
 else if(a==="full")setFull(!S.full);
 else if(/^p(like|save|comm|copy|share|imgq|more|menu|delc|link|native|del|react)$/.test(a)||a==="rxwho")postAct(a,el);
 else if(a==="feedMore")feedMore();
 else if(a==="fntoggle"){el.closest(".fns").classList.toggle("fold")}
 else if(a==="tts"){closeSheet();TTS.start()}else if(a==="ttsp")TTS.toggle();else if(a==="ttss")TTS.stop();
 else if(a==="selprint"||a==="selcopy"){const s0=String(getSelection()).trim(),rb=selRd()||$("#rb");if(!s0||!rb)return;const b=B(rb.dataset.id),i=+rb.dataset.p-1,src=`${b.setTitle||b.title} — ${A(b.authorId).name}${PL(b,i)?"، "+PL(b,i):""}`,link=siteLink(`#/book/${b.id}/${i+1}`);
  if(a==="selcopy"){try{await navigator.clipboard.writeText(s0+"\n— "+src+"\n"+link);toast("نُسخ النص مع مصدره")}catch(x){}return}
  const w2=window.open("","_blank");if(!w2)return toast("اسمح بالنوافذ المنبثقة للطباعة");w2.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(src)}</title><style>body{font-family:Amiri,"Traditional Arabic",serif;font-size:20px;line-height:2.1;margin:2cm;text-align:justify}footer{margin-top:1.5em;border-top:1px solid #999;padding-top:.5em;font-size:14px;color:#444}</style></head><body>${s0.split("\n").filter(Boolean).map(l=>"<p>"+esc(l)+"</p>").join("")}<footer>${esc(src)}<br>${esc(SITENAME)} — ${esc(link)}</footer><script>onload=()=>{print()}<\/script></body></html>`);w2.document.close()}
 else if(a==="revlist"){const id=el.dataset.id,box=$("#rv-"+id);box.innerHTML='<p class="mut">جارٍ التحميل…</p>';const b=await loadBook(id).catch(()=>null);const u=(b&&b.unc)||{},ks=Object.keys(u).map(Number).sort((x,y)=>x-y),ur=(b&&b.unrev)||[];
  box.innerHTML=(ks.map(i=>`<a class="chip" href="#/book/${id}/${i+1}">${esc(PL(b,i)||"ص "+(i+1))}: ${u[i].slice(0,4).map(esc).join("، ")}${u[i].length>4?"…":""}</a>`).join(" ")||'<p class="mut">لا توجد كلمات معلَّمة.</p>')+(ur.length?`<p class="mut">صفحات لم يراجعها Gemini: ${ur.slice(0,60).map(i=>`<a href="#/book/${id}/${i+1}">${toAr(i+1)}</a>`).join("، ")}</p>`:"")}
 else if(a==="bookmeta")metaDlg();else if(a==="reocr")reocr(el.dataset.id);else if(a==="bookdel")deleteBook(el.dataset.id);
 else if(a==="tup"||a==="tdown"){const r=el.closest(".trow"),o=a==="tup"?r.previousElementSibling:r.nextElementSibling;if(o)a==="tup"?o.before(r):o.after(r)}
 else if(a==="tdel"){const r=el.closest(".trow");if(confirm("حذف القسم «"+r.querySelector(".tn").value+"»؟ (يُحذف عند الحفظ)"))r.remove()}
 else if(a==="tadd"){const k=el.dataset.kind,box=$("#tl-"+k);box.insertAdjacentHTML("beforeend",topicRows([{id:(k==="articles"?"at":"t")+Date.now().toString(36),name:""}],k));const n=box.lastElementChild.querySelector(".tn");n.placeholder="اسم القسم الجديد";n.focus()}
 else if(a==="aisvc"){const sv=AISVC.find(x=>x[0]===el.dataset.m);CONV.mode=sv[0];$("#am").value=sv[0];$$("[data-act=aisvc]").forEach(b=>b.setAttribute("aria-pressed",b===el));const ta=$("[name=m]");if(sv[3]&&!ta.value.trim())ta.value=sv[3];if(sv[0]==="summarize"||sv[0]==="quiz")pickBook();else{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);ta.scrollIntoView({behavior:"smooth",block:"center"})}}
 else if(a==="aiex"||a==="aifollow"){const ta=$("[name=m]");if(!ta)return;ta.value=el.textContent;if(a==="aiex"){const m=/^اجمع/.test(ta.value)?"gather":/^قارن/.test(ta.value)?"compare":/منهج/.test(ta.value)?"plan":/^لخ/.test(ta.value)?"summarize":/كيف أنظ/.test(ta.value)?"solve":"ask";CONV.mode=m;$("#am").value=m}ta.form.requestSubmit()}
 else if(a==="aipick"){closeSheet();setBookScope(el.dataset.id);const ta=$("[name=m]");if(ta){const b=B(el.dataset.id);if(/^(لخّص كتاب|اختبرني في)\s*:?\s*$/.test(ta.value.trim())||!ta.value.trim())ta.value=(CONV.mode==="quiz"?"اختبرني في كتاب «":CONV.mode==="summarize"?"لخّص كتاب «":"«")+b.title+"»";ta.focus()}}else if(a==="corr")corrDlg();else if(a==="corrok"||a==="corrno")corrDecide(el);
 else if(a==="ghout"){GH.token="";toast("خرجت من وضع الإدارة المباشرة.");route()}
 else if((a==="pview"||a==="pv")&&!Auth.user&&(a==="pview"||el.dataset.pv!=="text")){needLogin("عرض النسخة المصورة بجوار النص متاح لأعضاء المكتبة المسجلين، والتسجيل مجاني.")}
 else if(a==="pview"){S.pv=(S.pv&&S.pv!=="text")?"text":"pdf";saveS();LASTREAD=null;route()}
 else if(a==="aphoto"){photoDlg(el.dataset.id)}
 else if(a==="nbexp"){nbExport(el.dataset.f)}
 else if(a==="pdfdl"){const c=cur();if(c)pdfDl(c.b).catch(e=>toast(e.message))}
 else if(a==="pv"){S.pv=el.dataset.pv;saveS();LASTREAD=null;route()}
 else if(a==="pdfoff"){const c=cur();if(c){c.b.pdfOffset=(+c.b.pdfOffset||0)+(+el.dataset.d);renderPdf(c.b,c.p)}}
 else if(a==="pdfoffsave"){const c=cur();if(c)savePdfOffset(c.b,el)}
 else if(a==="card")cardSheet();
 else if(a==="qhint"){closeSheet();alert("حدّد بإصبعك أو بالماوس العبارة التي تريدها من الصفحة، ثم اضغط زر «اجعل المحدد قبسة».")}
 else if(a==="share"){const c=cur(),u=siteLink(`#/book/${c.b.id}/${c.p}`)||location.href;try{if(navigator.share)await navigator.share({title:c.b.title,url:u});else{await navigator.clipboard.writeText(u);el.textContent="نُسخ الرابط"}}catch(x){}}
 else if(a==="uilang"){S.ui=S.ui==="en"?"ar":"en";saveS();location.reload()}
 else if(a==="tkreq"){const b=B(el.dataset.id);if(!b)return;closeSheet();
  if(GH.on){try{await GH.editJSON("data/tashkeel/_queue.json",o=>{o=o||{items:[]};o.items=[{id:b.id}].concat((o.items||[]).filter(x=>(x.id||x)!==b.id));return o},"تشكيل حسب الطلب: «"+(b.setTitle||b.title)+"»");toast("أضيف الكتاب إلى طابور التشكيل؛ يبدأ خلال دقائق")}catch(x){toast(x.message)}return}
  if(!Auth.user)return needLogin("طلب التشكيل متاح للأعضاء المسجلين.");if(typeof tgNote==="function")tgNote("tkreq",{subject:"تشكيل: "+(b.setTitle||b.title),detail:b.id});toast("أُرسل طلبك إلى الإدارة، جزاك الله خيرًا")}
 else if(a==="tashtog2"){S.tash=!S.tash;saveS();el.textContent=S.tash?"التصدير بالتشكيل ✓":"التصدير بلا تشكيل ✓";toast(S.tash?"يُصدَّر النص بتشكيله ويظهر التشكيل في القراءة":"يُصدَّر النص بلا تشكيل ويُخفى في القراءة")}
 else if(a==="tashtog"){S.tash=!S.tash;saveS();refreshPage();closeSheet();const lt=$("#lt");if(lt)lt.checked=S.tash;toast(S.tash?"يظهر التشكيل"+(TK.info(cur()&&cur().b)?" (التشكيل المدقق لهذا الكتاب)":""):"أُخفي التشكيل، ويُنسخ النص ويُصدَّر بلا تشكيل")}
 else if(a==="theme"){S.theme=S.theme==="dark"?"light":S.theme==="light"?"dark":(matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark");saveS();applyLook()}
 else if(a==="look")openSheet("مظهر الصفحة",lookHtml(),wireLook);
 else if(a==="moreSug")fillSug();
 else if(a==="mkq"){const q=SUG[+el.dataset.i];if(!q)return;setQuote(q);if(parse().p[0]==="qabasat"){draw();$("#qt").scrollIntoView({behavior:"smooth",block:"center"})}else location.hash="#/qabasat"}
 else if(a==="scrup"){const c=cur();if(c)scrAdd(c.b,-1)}
 else if(a==="selq"){const s=String(getSelection()).trim(),rb=selRd()||$("#rb");if(s&&rb){const b=B(rb.dataset.id),i=+rb.dataset.p-1;pendingQ={t:s,src:A(b.authorId).name+" — "+b.title+(PL(b,i)?"، "+PL(b,i):""),ref:{b:b.id,p:i+1}};location.hash="#/qabasat"}}
 else if(a==="fav"){const id=parse().p[1];S.favs=S.favs.includes(id)?S.favs.filter(x=>x!==id):[...S.favs,id];saveS();el.textContent=S.favs.includes(id)?"إزالة من المفضلة":"مفضلة"}
 else if(a==="copyp"){const rb=$("#rb"),b=B(rb.dataset.id),i=+rb.dataset.p-1;try{await navigator.clipboard.writeText(plain(shownText(b,i))+"\n— "+b.title+"، "+A(b.authorId).name+(PL(b,i)?"، "+PL(b,i):"")+"\n"+SITENAME+(siteLink()?"\n"+siteLink(`#/book/${b.id}/${i+1}`):""));el.textContent="تم النسخ"}catch(x){}}
 else if(a==="logout"){await Auth.signOut();location.hash="#/"}
 else if(a==="tr"){closeSheet();trDlg()}else if(a==="trset"){S.tr=el.dataset.l||"";saveS();const d=dlg();if(d&&d.open)d.close();const c=cur();if(c){if(!$("#trv")&&S.tr)route();else renderTr(c.b,c.p)}}else if(a==="exp"){closeSheet();expDlg()}else if(a==="editp"){closeSheet();editDlg()}else if(a==="offline")offline();
 else if(a==="expUpd")dl("sdsl-update-"+today()+".json",JSON.stringify(updatePayload()),"application/json");
 else if(a==="delb"){if(confirm("حذف هذا العنصر من هذا الجهاز؟")){const id=el.dataset.id;LOCAL.catalog.books=LOCAL.catalog.books.filter(b=>b.id!==id);delete LOCAL.shards[id];await DB.set("local",LOCAL);SH.delete(id);merge();renderTicker();route()}}});
document.addEventListener("submit",e=>{const f=e.target.closest("[data-form]");if(!f)return;e.preventDefault();const k=f.dataset.form,fd=new FormData(f);
 const qs=(skipNew)=>{const p=new URLSearchParams();fd.forEach((v,n)=>{if(v&&!(skipNew&&n==="s"&&v==="new"))p.set(n,v)});return p.toString()};
 if(k==="note")return noteSave(f);if(k==="bcast")return bcSend(f);if(k==="plan")return planSave(f);
 if(k==="quick"||k==="search")location.hash="#/search?"+qs();
 else if(k==="libq"){const s=qs(true);location.hash="#/library"+(s?"?"+s:"")}
 else if(k==="artq"||k==="listq"){const s=qs(true);location.hash="#/"+(f.dataset.route||"articles")+(s?"?"+s:"")}
 else if(k==="pcomment"){const t=String(fd.get("t")||"").trim();if(!t)return;const btn=f.querySelector("button");btn.disabled=true;Social.comment(f.dataset.id,t,fd.get("parent")).then(()=>openComments(f.closest(".post"))).catch(x=>{alert(x.message);btn.disabled=false})}
 else if(k==="corrsend")corrSend(f);
 else if(k==="struct")saveStruct(f);else if(k==="authedit")saveAuthor(f);else if(k==="bookmeta")saveBookMeta(f);
 else if(k==="ghlogin")ghLogin(f);else if(k==="ghpdf")ghPdf(f);else if(k==="addpost")addPost(f);
 else if(k==="contact"){window.open(waLink(`${fd.get("k")} — من: ${fd.get("n")}\n\n${fd.get("m")}\n\n(مرسلة من مكتبة الدعوة السلفية الرقمية)`),"_blank","noopener")}
 else if(k==="goto"){closeSheet();location.hash=`#/book/${f.dataset.id}/${fd.get("p")}`}
 else if(k==="inbook"){const b=B(f.dataset.id),h=String(fd.get("h")||"").trim();if(!h)return location.hash=`#/book/${b.id}/${parse().p[2]}`;const w=norm(h).split(/\s+/).filter(Boolean),cur=+parse().p[2]||1;
  closeSheet();for(let j=1;j<=b.pages.length;j++){const x=(cur-1+j)%b.pages.length;const t=norm(plain(b.pages[x]));if(w.every(k2=>t.includes(k2)))return location.hash=`#/book/${b.id}/${x+1}?h=${encodeURIComponent(h)}`}alert("لا توجد نتائج في هذا الكتاب")}
 else if(k==="addbook")addBook(f);else if(k==="addart")addArticle(f);else if(k==="impsave")impSave(f);
 else if(k==="signin"||k==="signup")authSubmit(f,k);else if(k==="ask")askSubmit(f)});
const selRd=()=>{const n=getSelection().anchorNode;return n&&(n.nodeType===1?n:n.parentElement).closest(".rd[data-id]")};
document.addEventListener("selectionchange",()=>{const s=String(getSelection()).trim();$("#selq").hidden=!(s.length>12&&selRd())});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#sheet")&&!$("#sheet").hidden){closeSheet();return}if($("#rb")&&e.key==="f"&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName)){setFull(!S.full);return}if(!$("#rb")||/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName)||dlg().open)return;if(e.key==="ArrowLeft")turn(1);else if(e.key==="ArrowRight")turn(-1)});

/* ---------- الإقلاع ---------- */
async function boot(){if(location.hash.startsWith("#/"))history.replaceState(null,"",toPath(location.hash));applyLook();const loc=await DB.get("local");if(loc&&loc.catalog)LOCAL=Object.assign(LOCAL,loc);
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
