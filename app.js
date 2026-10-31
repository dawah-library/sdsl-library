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
const S=Object.assign({theme:"auto",font:"Amiri",size:1.3,lh:2.1,tash:true,pg:"paper",admin:false,favs:[],seen:0,look:false,
 fw:400,ink:"",bg:"",align:"",dir:"rtl",ps:.35,w:"m",qf:"",qs:1,qw:400,qc:"",qa:"",qm:.6,hs:1,hc:"",mkq:false,mkh:false,mkt:false,lead:true},ls.get("set",{}));
const saveS=()=>ls.set("set",S);
// إعدادات العرض الافتراضية (لزر «إعادة الإعدادات») ومفاتيح التفضيلات التي تتبع العضو في حسابه
const LOOKDEF={theme:"auto",font:"Amiri",size:1.3,lh:2.1,tash:true,pg:"paper",fmt:"print",fn:"show",fw:400,ink:"",bg:"",align:"",dir:"rtl",ps:.35,w:"m",qf:"",qs:1,qw:400,qc:"",qa:"",qm:.6,hs:1,hc:"",mkq:false,mkh:false,mkt:false,lead:true};
const Prefs={keys:Object.keys(LOOKDEF).concat(["mode"]),t:0,
 // حفظ في بيانات الحساب (Supabase Auth user_metadata) بعد ثانيتين من آخر تغيير، فتتبع العضو على أجهزته
 push(){clearTimeout(this.t);this.t=setTimeout(async()=>{try{if(!Auth.sb||!Auth.user)return;const v={};this.keys.forEach(k=>{if(S[k]!==undefined)v[k]=S[k]});S.prefsAt=Date.now();saveS();
  await Auth.sb.auth.updateUser({data:{prefs:{at:S.prefsAt,v}}})}catch(e){}},2000)},
 // عند الدخول: تُطبَّق تفضيلات الحساب إن كانت أحدث مما على الجهاز
 pull(){try{const p=Auth.user&&Auth.user.user_metadata&&Auth.user.user_metadata.prefs;if(!p||!p.v||(S.prefsAt||0)>=(p.at||0))return;
  this.keys.forEach(k=>{if(p.v[k]!==undefined)S[k]=p.v[k]});S.prefsAt=p.at;saveS();applyLook();if(typeof refreshPage==="function")refreshPage()}catch(e){}}};
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
 const bg=S.bg||pg[2],ink=S.ink||pg[3],dark=lum(bg)<.4;
 r.style.setProperty("--pg",bg);r.style.setProperty("--pgink",ink);r.style.setProperty("--pgline",dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.12)");
 // الباب ٦: الكثافة والمحاذاة والمسافات وعرض القراءة والاقتباسات والعناوين والتمييز البصري
 const W={s:"32em",m:"40em",l:"48em",x:"100%"};r.style.setProperty("--rw",S.fw||400);r.style.setProperty("--rps",(S.ps??.35)+"em");r.style.setProperty("--rmax",W[S.w]||W.m);
 r.style.setProperty("--ra",S.align||(S.fmt==="plain"?"right":"justify"));
 if(S.qf)loadFont(S.qf);r.style.setProperty("--qf",S.qf?`"${S.qf}",serif`:"inherit");r.style.setProperty("--qs",S.qs||1);r.style.setProperty("--qw",S.qw||400);r.style.setProperty("--qa",S.qa||"inherit");r.style.setProperty("--qm",(S.qm??.6)+"em");
 r.style.setProperty("--qc",S.qc||"inherit");r.style.setProperty("--hs",S.hs||1);r.style.setProperty("--hc",S.hc||"inherit");
 // درجات التمييز تناسب لون الصفحة (فاتحة أو داكنة)
 r.style.setProperty("--mkq",dark?"#7fd3a0":"#1d6b3e");r.style.setProperty("--mkh",dark?"#9cc2ff":"#1d4f91");r.style.setProperty("--mkt",dark?"#ff9a8a":"#a8261b");r.style.setProperty("--mkm",dark?"#e2bf6a":"#8a5a12");
 const cl=document.body.classList;cl.toggle("mk-q",!!S.mkq);cl.toggle("mk-h",!!S.mkh);cl.toggle("mk-t",!!S.mkt);cl.toggle("rd-lead",S.lead!==false);cl.toggle("rd-auto",S.dir==="auto")}
// إضاءة لون (٠ داكن – ١ فاتح) لاختيار درجات التمييز المناسبة
function lum(c){const m=/^#?([0-9a-f]{6})$/i.exec(String(c||"").trim());if(!m)return 1;const n=parseInt(m[1],16);return(.299*(n>>16)+.587*(n>>8&255)+.114*(n&255))/255}

/* ---------- البيانات ---------- */
let CAT={version:0,authors:[],topics:[],books:[]},LOCAL={catalog:{authors:[],topics:[],books:[]},shards:{},deleted:[]};
let lib={authors:[],topics:[],books:[]};
const SH=new Map(),GROUPS=new Map();let ARTS_IDX=[];
const artFromIdx=x=>Object.assign({id:x.id,title:x.t,authorId:x.a,topicId:x.tp,tps:x.tps,src:x.src,lic:x.lic,sum:x.sum,ik:x.ik,date:x.d,url:x.u,f:x.f,n:x.n,added:x.ad,c:x.c,fa:x.fa,type:"article",col:x.col||"dawah"},x.h?{hidden:true}:{});
const isFatwa=b=>!!(b.fa||/^(أسئلة|الاستفتاء|من فقه الواقع)/.test(b.c||""));
const byId=(a,b)=>{const m=new Map();a.forEach(x=>m.set(x.id,x));b.forEach(x=>m.set(x.id,Object.assign({},m.get(x.id)||{},x)));return[...m.values()]};
function attach(b,sh){b.pages=sh.pages;b.toc=sh.toc||[];b.unc=sh.unc||null;b.unrev=sh.unrev||null;if(sh.pl)b.pl=sh.pl;else delete b.pl;b.n=sh.pages.length}
// المواد المخفية من «إدارة المواد» تُحجب عن الزوار وتبقى للمشرفين
const seeHidden=()=>{try{return(typeof Cloud!=="undefined"&&Cloud.staff())||!!(typeof GH!=="undefined"&&GH.token)}catch(e){return false}};
function merge(){const del=new Set(LOCAL.deleted||[]);
 lib={authors:byId(CAT.authors,LOCAL.catalog.authors).filter(a=>!a.mergedInto),topics:byId(CAT.topics,LOCAL.catalog.topics),
  books:byId(CAT.books.concat(ARTS_IDX),LOCAL.catalog.books).filter(b=>!del.has(b.id)&&(!b.hidden||seeHidden())).map(m=>{const b=Object.assign({},m);const sh=LOCAL.shards[b.id]||SH.get(b.id);if(sh)attach(b,sh);return b})}}
const A=id=>lib.authors.find(a=>a.id===id)||((m=>m&&lib.authors.find(a=>a.id===m))((CAT.authors.find(a=>a.id===id)||{}).mergedInto))||{name:"—"},T=id=>lib.topics.find(t=>t.id===id)||{name:"—"},B=id=>lib.books.find(b=>b.id===id);
const bc=b=>b.col||"dawah",isArt=b=>b.type==="article";
// المادة في موضوعها الأصلي وفي موضوعاتها الإضافية (tps) دون نسخ مكررة (ب3-17، ب3-18)
const inTopic=(b,t)=>b.topicId===t||!!(b.tps&&b.tps.includes(t));
const isStatement=b=>b.topicId==="at17"||/بيانات|(^|›\s*)بيان/.test(b.c||"")||/^بيان(\s|ات)/.test(b.title||"");
const isReadBook=b=>/^المكتبة المقروءة/.test(b.c||"");
const isTranscript=b=>(b.tags||[]).includes("tafrigh")||/تفريغ|دروس صوتية/.test(b.source||"");
const kindOf=b=>!isArt(b)?"book":isFatwa(b)?"fatwa":isStatement(b)?"statement":"article";
let _SM=null,_SMn=-1;const setMin=k=>{if(_SMn!==lib.books.length){_SM={};lib.books.forEach(x=>{if(x.set&&(_SM[x.set]==null||x.vol<_SM[x.set]))_SM[x.set]=x.vol});_SMn=lib.books.length}return _SM[k]};
// شريط مجلدات العمل في صفحة الكتاب (الباب ٣.٤): كل المجلدات ظاهرة مع تمييز الحالي
const volStrip=b=>{if(!b.set)return"";const vs=lib.books.filter(x=>x.set===b.set).sort((x,y)=>(x.vol||0)-(y.vol||0));if(vs.length<2)return"";
 return`<nav class="volstrip" aria-label="مجلدات الكتاب"><b>المجلدات (${toAr(vs.length)})</b><div class="chips">${vs.map(x=>`<a class="chip${x.id===b.id?" x":""}" href="#/book/${x.id}/1"${x.id===b.id?' aria-current="page"':""}>${x.vol?"ج "+toAr(x.vol):"المقدمة"}</a>`).join("")}</div></nav>`};
const VOL2=b=>!!(b.set&&b.vol>setMin(b.set))||(typeof ED!=="undefined"&&!!b.ed&&ED.secondary(b)),BOOKS=()=>lib.books.filter(b=>kindOf(b)==="book"&&!VOL2(b)&&bc(b)!=="ithra"),ARTS=()=>lib.books.filter(b=>kindOf(b)==="article"&&bc(b)!=="ithra"),FATWAS=()=>lib.books.filter(b=>kindOf(b)==="fatwa"&&bc(b)!=="ithra"),BAYANAT=()=>lib.books.filter(b=>kindOf(b)==="statement"&&bc(b)!=="ithra");
const COL={dawah:"مكتبة الدعوة السلفية",turath:"المكتبة العامة",ithra:"المصادر الإثرائية"}; // المعرّف الداخلي turath باقٍ في الروابط والبيانات
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
const view=(h,keep)=>{$("#app").innerHTML=h;if(!keep)window.scrollTo(0,0);Pager.entered();tjLinks()};
// رابط «التشجير» في رأس الكتاب متى نُشر تشجيره (أو للإدارة قبل النشر)
function tjLinks(){const els=document.querySelectorAll(".tjlink[data-tj]");if(!els.length||typeof TSJ==="undefined")return;TSJ.index().then(L=>els.forEach(el=>{const k=el.dataset.tj,x=L[k];if(x&&(x.ok||isAdmin()))el.innerHTML=` • <a href="#/tashjir/${esc(k)}">🌳 تشجير الكتاب</a>`}))}
/* صورة المؤلف المصغرة: صورته إن أُضيفت، وإلا الحرف الأول بلون مميز */
// صورة مؤلف حُفظت للتو ولم يُنشر الموقع بعد: تُجلب مباشرة من المستودع
const RAWGH="https://raw.githubusercontent.com/"+(CFG.repo||"dawah-library/sdsl-library")+"/main/";
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName==="IMG"&&!t.dataset.fb&&/(^|\/)assets\/authors\//.test(t.getAttribute("src")||"")){t.dataset.fb=1;t.src=RAWGH+t.getAttribute("src").replace(/^\.?\//,"")}},true);
const avatar=(a,cls="")=>{a=a||{};const sh=(a.name||"").replace(/^(الإمام|الشيخ|شيخ الإسلام|الحافظ|الدكتور|د\.)\s*/,"");return a.photo?`<img class="aav ${cls}" src="${esc(a.photo)}" alt="${esc(a.name||"")}" loading="lazy">`:`<span class="aav ${cls}" style="${avHue(a.id||a.name||"")}" aria-hidden="true">${esc(sh[0]||"؟")}</span>`};
const bookCard=b=>`<a class="bk${bc(b)==="turath"?" tr":""}${b.hidden?" hid":""}" href="#/book/${b.id}${S.lastBy&&S.lastBy[b.id]>1?"":"/1"}"><b>${esc(b.set?b.setTitle||b.title:b.title)}${b.hidden?' <em class="tag">مخفي</em>':""}</b><span>${b.set?`<em class="tag">${b.vols===2?"مجلدان":toAr(b.vols)+" "+(b.vols>2&&b.vols<11?"مجلدات":"مجلدًا")}</em> • `:""}<span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${died(A(b.authorId))} • ${esc(T(b.topicId).name)}${b.n&&!b.set?` • ${b.n} صفحة`:""}${bc(b)==="turath"?' • <em class="tag">تراث</em>':""}${b.demo?' • <em class="tag">نص تجريبي</em>':""}${b.pdf?' • <em class="tag">مصور</em>':""}${b.ocr?' • <em class="tag">نص آلي</em>':""}</span></a>`;
const artCard=b=>`<a class="bk ar${b.hidden?" hid":""}" href="#/book/${b.id}/1"><b>${esc(b.title)}${b.hidden?' <em class="tag">مخفي</em>':""}</b><span><span data-author="${b.authorId}">${esc(A(b.authorId).name)}</span>${isFatwa(b)?' • <em class="tag">من فتاوى صوت السلف</em>':isStatement(b)?' • <em class="tag">بيان</em>':""} • ${fmtDate(b.date)} • ${esc(T(b.topicId).name)}${b.demo?' • <em class="tag">نص تجريبي</em>':""}</span></a>`;
const anyCard=b=>isArt(b)?artCard(b):bookCard(b);
const progress=(el,i,n,label)=>{el.innerHTML=`<p class="mut">${label} (${toAr(i)} من ${toAr(n)})</p><div class="prog"><i style="width:${Math.round(i/n*100)}%"></i></div>`};

/* ---------- المقتطفات المقترحة ---------- */
function sentences(b,i){return plain(b.pages[i]).split("\n").flatMap(par=>par.split(/(?<=[.؟!])\s+/)).map(s=>s.trim()).filter(s=>{const n=strip(s).length;return n>=50&&n<=230&&!/^\d|^[(«"]?\s*\d|حدثنا|أخبرنا/.test(s)})}
async function suggest(n,seed,filter){
 // الأولوية للفوائد المنتقاة التامة المعنى (منشورات المشايخ)، ثم المقتطفات الآلية
 try{await loadPosts();const fw=(POSTS||[]).filter(x=>x.fw&&B(x.fw.b)&&(!filter||filter(B(x.fw.b))));if(fw.length>=n){let y=(seed||Date.now())%233280;const r2=()=>{y=(y*9301+49297)%233280;return y/233280};const pick=fw.slice().sort(()=>r2()-.5).slice(0,n);return pick.map(x=>({t:x.text,b:B(x.fw.b),i:x.fw.p-1}))}}catch(e){}
 let pool=lib.books.filter(b=>!b.demo&&(!filter||filter(b))&&(b.pages||(b.size||0)<1500000));
 if(!pool.length)pool=lib.books.filter(b=>!filter||filter(b));
 let x=(seed||Date.now())%233280;const rnd=()=>{x=(x*9301+49297)%233280;return x/233280};
 const picks=[...pool].sort(()=>rnd()-.5).slice(0,Math.min(pool.length,n+2));
 await loadMany(picks);const out=[];
 for(let k=0;k<n*12&&out.length<n;k++){const b=picks[Math.floor(rnd()*picks.length)];if(!b||!b.pages)continue;const i=Math.floor(rnd()*b.pages.length),ss=sentences(b,i);if(!ss.length)continue;
  const t=ss[Math.floor(rnd()*ss.length)];if(!out.some(o=>o.t===t))out.push({t,b,i})}
 return out}
let SUG=[];
const qCard=(q,i)=>`<div class="q"><p>${esc(q.t)}</p><span class="mut">${esc(A(q.b.authorId).name)} — ${esc(q.b.title)}${PL(q.b,q.i)?"، "+esc(PL(q.b,q.i)):""}</span><div class="row" style="margin-top:6px"><button class="btn s nf" data-act="mkq" data-i="${i}">صمّم الاقتباس</button><a class="btn s nf" href="#/book/${q.b.id}/${q.i+1}">افتح الصفحة</a></div></div>`;

/* ---------- الرئيسية ---------- */
function vHome(){const arts=ARTS().sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 view(`<section class="hero"><img class="emb" src="assets/logo-sdsl.png" alt="شعار المكتبة الرقمية للدعوة السلفية"><h1 class="callig" aria-label="مكتبة الدعوة السلفية الرقمية">مَكْتَبَةُ الدَّعْوَةِ السَّلَفِيَّةِ الرَّقْمِيَّةُ</h1>
 <p class="ayah" lang="ar">﴿قُلْ هَٰذِهِۦ سَبِيلِىٓ أَدْعُوٓا۟ إِلَى ٱللَّهِ ۚ عَلَىٰ بَصِيرَةٍ أَنَا۠ وَمَنِ ٱتَّبَعَنِى ۖ وَسُبْحَـٰنَ ٱللَّهِ وَمَآ أَنَا۠ مِنَ <span style="white-space:nowrap">ٱلْمُشْرِكِينَ﴾ <span class="ayref">[يوسف: ١٠٨]</span></span></p>
 <form class="sbox" data-form="quick"><input name="q" type="search" placeholder="ابحث في الكتب والمقالات والمؤلفين" aria-label="بحث"><button class="btn p">بحث</button></form></section>
 ${(()=>{const r=Object.entries(S.lastBy||{}).reverse().map(([id,p])=>[B(id),p]).filter(([b,p])=>b&&p>1).slice(0,4);return r.length?`<section class="resume"><h2>أكمل القراءة</h2><div class="resl">${r.map(([b,p])=>`<a class="bk" href="#/book/${b.id}/${p}"><b>${esc(b.setTitle?b.title:b.title)}</b><span>${esc(A(b.authorId).name)} • ${isArt(b)?"":"صفحة "+toAr(p)+(b.n?" من "+toAr(b.n):"")}</span>${b.n>1?`<i class="prog" style="--w:${Math.round(p/b.n*100)}%"></i>`:""}</a>`).join("")}</div></section>`:""})()}
 <div class="cols"><a class="col" href="#/library?c=dawah"><b>مكتبة الدعوة السلفية</b><span>كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور</span><em>${BOOKS().filter(b=>bc(b)==="dawah").length} كتاب</em></a>
 <a class="col ar" href="#/articles"><b>المقالات</b><span>مقالات صوت السلف، مقسمة بالموضوع والكاتب</span><em>${ARTS().length} مقال</em></a>
 <a class="col fw" href="#/fatawa"><b>الفتاوى</b><span>فتاوى مشايخ الدعوة بتقسيمها الفني وبحسب الشيخ</span><em>${FATWAS().length} فتوى</em></a>
 <a class="col tr" href="#/library?c=turath"><b>${esc(COL.turath)}</b><span>كتب التراث الإسلامي والمراجع المعتمدة، وكتب العلماء والباحثين من خارج الدعوة</span><em>${BOOKS().filter(b=>bc(b)==="turath").length} كتاب</em></a><a class="col ith" href="#/ithra"><b>${esc(COL.ithra)}</b><span>بحوث ودراسات ومقالات علمية من مراكز ومجلات خارج المصادر الأساسية، بمصادرها وروابطها</span><em>${typeof ITHRA!=="undefined"?ITHRA.items().length:0} مادة</em></a></div>
 <a class="askcta" id="askcta" href="#/ask"><b>اسأل المكتبة</b><span>مساعد بحثي بالذكاء الاصطناعي يجيب من نصوص المكتبة مع الإحالة إلى الكتاب والصفحة. للأعضاء المسجلين.</span></a>
 <h2>أقسام جديدة</h2><div class="grid newsec"><a class="card hl" href="#/quizzes"><b>اختبارات الكتب</b><span>اختبر فهمك بثلاثة مستويات</span></a><a class="card hl" href="#/summary"><b>اختصار الكتب</b><span>مختصر بألفاظ المؤلف وPDF</span></a><a class="card hl" href="#/talaea"><b>الطلائع</b><span>عالم الأطفال: ألعاب وقرآن ومعرفة</span></a><a class="card hl" href="#/releases"><b>جديد الإصدارات</b><span>جديد الكتب ودور النشر</span></a><a class="card hl" href="#/majalla"><b>مجلة المكتبة</b><span>أعداد دورية من كتب المكتبة ومقالاتها</span></a></div>
 <div class="grid"><a class="card" href="#/bayanat"><b>بيانات الدعوة</b><span>${BAYANAT().length} بيان</span></a><a class="card" href="#/furqan"><b>قضايا الفرقان</b><span>المؤلفات المنهجية</span></a><a class="card" href="#/tafrighat"><b>تفريغات</b><span>الدروس مفرّغة نصيًا</span></a><a class="card" href="#/posts"><b>منشورات</b><span>من صفحات المشايخ والكتّاب</span></a><a class="card" href="#/community"><b>مجتمع المكتبة</b><span>مختارات الأعضاء وتفاعلهم</span></a><a class="card" href="#/hifz"><b>حفظ المتون</b><span>بطاقات مراجعة متباعدة</span></a><a class="card" href="#/paths"><b>المسارات العلمية</b><span>برامج متدرجة بشهادة إتمام</span></a><a class="card" href="#/qa"><b>سؤال وجواب من الكتب</b><span>أسئلة وأجوبتها بنص الكتب</span></a><a class="card" href="#/tashjir"><b>تشجير الكتب</b><span>خرائط ذهنية للكتب</span></a><a class="card" href="#/audio"><b>صوتيات المكتبة</b><span>استمع إلى الكتب</span></a><a class="card" href="#/radio"><b>راديو المكتبة</b><span>بث متواصل من الكتب</span></a><a class="card" href="#/tarajim"><b>تراجم مشايخ الدعوة</b><span>${Object.keys(TJ.items).length} ترجمة</span></a><a class="card" href="#/authors"><b>المؤلفون</b><span>${lib.authors.length} مؤلفًا ومصدرًا</span></a><a class="card" href="#/qabasat"><b>قبسات</b><span>صمّم اقتباسًا وانشره</span></a><a class="card" href="#/search"><b>بحث متقدم</b><span>في العناوين والنصوص</span></a><a class="card" href="#/favs"><b>المفضلة</b><span>${S.favs.length} عنصر</span></a></div>
 <h2>مختارات اليوم</h2><div id="sugg"><p class="mut">جارٍ اختيار مقتطفات…</p></div>
 ${(()=>{const by=k=>(x,y)=>(y[k]||"").localeCompare(x[k]||""),it=b=>`<a href="#/book/${b.id}"><b>${esc(b.setTitle||b.title)}</b><span>${esc(A(b.authorId).name||"")}</span></a>`,
  G=[["أحدث الكتب","#/library?s=new",BOOKS().filter(b=>!b.hidden&&!b.vol).sort(by("added"))],["أحدث المقالات","#/articles",arts],["أحدث الفتاوى","#/fatawa",[...FATWAS()].sort(by("date"))],["أحدث التفريغات","#/tafrighat",lib.books.filter(b=>!b.demo&&!b.hidden&&isTranscript(b)).sort(by("added"))]].filter(g=>g[2].length);
  return G.length?`<h2>جديد المكتبة</h2><div class="newg">${G.map(([t,h,l])=>`<section class="newc"><h3>${t}</h3>${l.slice(0,4).map(it).join("")}<a class="all" href="${h}">عرض الكل (${toAr(l.length)}) ←</a></section>`).join("")}</div>`:""})()}
 <h2>أقسام المكتبة</h2><div class="chips">${lib.topics.filter(t=>t.for!=="articles"&&BOOKS().some(b=>inTopic(b,t.id))).map(t=>`<a class="chip" href="#/library?t=${t.id}">${esc(t.name)}</a>`).join("")}</div>
`);
 swx().then(s=>{const c=$("#askcta");if(c&&s.ask===false){c.classList.add("paused");c.querySelector("span").textContent="متوقف مؤقتًا، ويعود قريبًا بإذن الله."}});
 const seed=+today().replace(/-/g,"");suggest(3,seed,b=>(b.size||0)<1200000).then(s=>{SUG=s;const el=$("#sugg");if(el)el.innerHTML=s.map(qCard).join("")||'<p class="mut">لا توجد مقتطفات.</p>'})}

/* ---------- المكتبة (الكتب) ---------- */
function sideList(title,arr,key,cur,url,count,wide){return`<details${wide?" open":""}><summary>${title}</summary><div class="sidebox"><a class="fl${!cur?" on":""}" href="${url({[key]:"",pg:1})}">الكل <span>${count("")}</span></a>${arr.filter(x=>key==="t"||count(x.id)||x.id===cur).map(x=>`<a class="fl${x.id===cur?" on":""}${count(x.id)?"":" zero"}" href="${url({[key]:x.id,pg:1})}">${esc(x.name)}${key==="a"?died(x):""} <span>${count(x.id)}</span></a>`).join("")}</div></details>`}
function vLibrary(q){
 const f={c:q.c||"",k:q.c==="turath"&&/^(article|fatwa|tafrigh)$/.test(q.k||"")?q.k:"",t:q.t||"",a:q.a||"",m:/^(hanafi|maliki|shafii|hanbali|general)$/.test(q.m||"")?q.m:"",q:q.q||"",s:q.s||"new",pg:+q.pg||1},PER=20,wide=matchMedia("(min-width:760px)").matches;
 // المكتبة العامة: كتب، ومقالات، وفتاوى، وتفريغات (k) — تصفية للسجلات نفسها دون نسخها
 const genK=k=>lib.books.filter(b=>!b.demo&&bc(b)==="turath"&&(k==="tafrigh"?isTranscript(b):isArt(b)&&kindOf(b)===k));
 const inC=f.k?genK(f.k):BOOKS().filter(b=>!f.c||bc(b)===f.c);
 let r=inC.filter(b=>(!f.t||inTopic(b,f.t))&&(!f.a||b.authorId===f.a));
 // الفقه المذهبي: وسوم madh:* على كتب الفقه
 const MADH=[["hanafi","الحنفي"],["maliki","المالكي"],["shafii","الشافعي"],["hanbali","الحنبلي"],["general","الفقه العام والمقارن"]],hasM=b=>(b.tags||[]).some(x=>x.startsWith("madh:")),showM=!!f.t&&r.some(hasM);
 if(f.m)r=r.filter(b=>(b.tags||[]).includes("madh:"+f.m));
 if(f.q.trim()){const w=norm(f.q).split(/\s+/).filter(Boolean);r=r.filter(b=>w.every(k=>norm(b.title+" "+A(b.authorId).name).includes(k)))}
 r=f.s==="title"?[...r].sort((x,y)=>x.title.localeCompare(y.title,"ar")):f.s==="died"?[...r].sort((x,y)=>(A(x.authorId).died||9999)-(A(y.authorId).died||9999)):[...r].sort((x,y)=>(y.added||"").localeCompare(x.added||""));
 const np=Math.max(1,Math.ceil(r.length/PER));f.pg=Math.max(1,Math.min(f.pg,np));
 const url=o=>{const n=Object.assign({},f,o),p=new URLSearchParams();["c","k","t","a","m","q","s"].forEach(k=>{if(n[k]&&!(k==="s"&&n[k]==="new"))p.set(k,n[k])});if(n.pg>1)p.set("pg",n.pg);return"#/library"+(p.toString()?"?"+p:"")};
 const cnt=key=>id=>inC.filter(b=>!id||b[key==="t"?"topicId":"authorId"]===id).length;
 const title=f.t?T(f.t).name:f.c?COL[f.c]:"المكتبة",bio=f.c==="turath"?"كتب التراث الإسلامي والمراجع المعتمدة بين أهل العلم، وكتب العلماء والباحثين المعاصرين من خارج الدعوة السلفية، ليستفيد منها الباحث مع تراث مشايخ الدعوة السلفية.":f.c==="dawah"?"كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور.":"";
 const tabs=`<div class="tabs" role="tablist">${[["","كل الكتب"],["dawah",COL.dawah],["turath",COL.turath]].map(([v,l])=>`<a role="tab" aria-selected="${f.c===v}" href="${url({c:v,a:"",t:"",pg:1})}">${l}</a>`).join("")}<a role="tab" aria-selected="false" href="#/articles">المقالات</a></div>`+(f.c==="turath"?`<div class="tabs sub" role="tablist" aria-label="أقسام المكتبة العامة">${[["","الكتب"],["article","المقالات"],["fatwa","الفتاوى"],["tafrigh","التفريغات"]].map(([v,l])=>`<a role="tab" aria-selected="${f.k===v}" href="${url({k:v,t:"",a:"",pg:1})}">${l} <span class="mut">(${toAr((v?genK(v):BOOKS().filter(b=>bc(b)==="turath")).length)})</span></a>`).join("")}</div>`:"");
 const chips=[f.t&&`<a class="chip x" href="${url({t:"",pg:1})}">${esc(T(f.t).name)} ✕</a>`,f.a&&`<a class="chip x" href="${url({a:"",pg:1})}">${esc(A(f.a).name)} ✕</a>`,f.q&&`<a class="chip x" href="${url({q:"",pg:1})}">«${esc(f.q)}» ✕</a>`].filter(Boolean).join(" ");
 const sorts=[["new","الأحدث"],["title","العنوان"],["died","وفاة المؤلف"]].map(([v,l])=>`<a href="${url({s:v,pg:1})}"${f.s===v?' style="font-weight:700"':""}>${l}</a>`).join(" • ");
 view(`${tabs}<h2>${esc(title)} <span class="mut">(${r.length})</span></h2>${bio?`<p class="mut">${esc(bio)}</p>`:""}<div class="lib"><aside class="side">${sideList("الأقسام",lib.topics.filter(t=>t.for!=="articles"),"t",f.t,url,cnt("t"),wide)}${sideList("المؤلفون",lib.authors,"a",f.a,url,cnt("a"),wide)}</aside><section>
 <form class="sbox" style="margin:0 0 8px;max-width:none" data-form="libq">${["c","k","t","a","m","s"].map(k=>`<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="ابحث في عناوين هذا القسم" aria-label="بحث في العناوين"><button class="btn">بحث</button></form>
 ${showM||f.m?`<div class="tabs sub" role="tablist" aria-label="الفقه المذهبي">${[["","كل كتب الفقه"],...MADH].map(([v,l])=>`<a role="tab" aria-selected="${f.m===v}" href="${url({m:v,pg:1})}">${v?"المذهب "+l:l}</a>`).join("").replace("المذهب الفقه العام","الفقه العام")}</div>`:""}
 ${f.t&&!f.k?relBox(f.t):""}
 <div class="row" style="margin-bottom:6px"><span class="chips">${chips}</span><span class="mut nf">الترتيب: ${sorts}</span></div>
 ${r.slice((f.pg-1)*PER,f.pg*PER).map(f.k?anyCard:bookCard).join("")||(f.k&&!inC.length?`<div class="note">لا توجد ${({article:"مقالات",fatwa:"فتاوى",tafrigh:"تفريغات"})[f.k]} في المكتبة العامة بعد. تُضاف من «الإدارة» باختيار القسم «${esc(COL.turath)}».</div>`:(f.m?`<div class="note">لا توجد بعدُ كتب في ${esc(f.m==="general"?"الفقه العام":"المذهب "+MADH.find(x=>x[0]===f.m)[1])} في المكتبة.</div>`:'<div class="note">لا توجد كتب مطابقة.</div>'))}
 ${np>1?`<div class="pgn"><a class="btn s" ${f.pg>1?`href="${url({pg:f.pg-1})}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${f.pg} من ${np}</span><a class="btn s" ${f.pg<np?`href="${url({pg:f.pg+1})}"`:'aria-disabled="true"'}>التالية</a></div>`:""}</section></div>`)}

/* ---------- قوائم المقالات والفتاوى والبيانات ---------- */
const LISTS={
 article:{route:"articles",title:"المقالات",desc:"مقالات صوت السلف لمشايخ الدعوة السلفية وكتّابها، مقسمة كما في صوت السلف وبحسب الكاتب. تُضاف مقالات جديدة يوميًا بدءًا من الأقدم.",items:()=>ARTS(),empty:"لا توجد مقالات بعد."},
 fatwa:{route:"fatawa",title:"الفتاوى",desc:"فتاوى مشايخ الدعوة السلفية، مقسمة تقسيمًا فنيًا كما في موقع صوت السلف، وبحسب الشيخ. فتاوى صوت السلف منسوبة إلى الشيخ ياسر برهامي المشرف العام على الموقع.",items:()=>FATWAS(),empty:"لا توجد فتاوى بعد؛ تُضاف يوميًا مع الاستيراد."},
 statement:{route:"bayanat",title:"بيانات الدعوة السلفية",desc:"بيانات الدعوة السلفية وحزب النور مرتبة زمنيًا، وتُضاف آليًا عند نشرها على صوت السلف.",items:()=>BAYANAT(),empty:"لم تُستورد بيانات بعد؛ تظهر هنا تلقائيًا كلما وصل الاستيراد اليومي إلى بيانات الدعوة على صوت السلف."}};
const topicLabel=t=>t.parent?t.parent+" › "+t.name:t.name;
// ربط الموضوعات: كل قسم كتب بأقسام المقالات والفتاوى المقابلة، وأبرز مؤلفيها (ب3-23)
const TREL={t1:"st8 st12 st17 st46 st48 st49 st51 st60 st73",t19:"at1 st67 at4 st4 st71 st34 st80 st61 st33 st25",t20:"at7 st26 st36 at17 st37 st14",t2:"at15 st27",t12:"at15 st27",t3:"st85 at15",t13:"st85",t4:"st57 st19 st21 st42 st43 st45 st53 st59 st63 st78 st13 st20 st29 st38 st39 st40 st41 st44 st47 st56 st64 st74 st76 st28 st30 st31 st52 st62 st58 st72 st65 st68 st23 st18 st22",t14:"st70 st1",t5:"at6 st3 st84",t18:"at6 st3 st84 st79 at11",t6:"at5 st55 st83 st81",t11:"st27 st2",t17:"at14 st6 st9 st69",t15:"st10",t16:"st10",t7:"st24 st66 at2 at16 at13",t8:"at8 at9 at10 st7 st77 st54 st35"};
function relBox(t){
 const rel=TREL[t]?{bk:[t],ar:TREL[t].split(" ")}:{bk:Object.keys(TREL).filter(k=>TREL[k].split(" ").includes(t)),ar:[t]};
 if(!rel.bk.length)return"";
 const books=BOOKS().filter(b=>rel.bk.some(id=>inTopic(b,id))),items=[...ARTS(),...FATWAS()].filter(b=>rel.ar.some(id=>inTopic(b,id)));
 const chips=rel.bk.filter(id=>id!==t&&books.some(b=>inTopic(b,id))).map(id=>`<a class="chip" href="#/library?t=${id}">📚 ${esc(T(id).name)}</a>`)
  .concat([["article","articles"],["fatwa","fatawa"]].flatMap(([k,rt])=>rel.ar.filter(id=>id!==t&&items.some(b=>kindOf(b)===k&&inTopic(b,id))).map(id=>`<a class="chip" href="#/${rt}?t=${id}">${k==="fatwa"?"الفتاوى":"المقالات"}: ${esc(T(id).name)}</a>`)));
 const n={};[...books,...items].forEach(b=>{n[b.authorId]=(n[b.authorId]||0)+1});
 const au=Object.keys(n).sort((x,y)=>n[y]-n[x]).slice(0,8).map(id=>`<a class="chip" href="#/author/${id}" data-author="${id}">${esc(A(id).name)} <span class="mut">${toAr(n[id])}</span></a>`);
 if(!chips.length&&!au.length)return"";
 return`<details class="relbox"><summary>ذو صلة بهذا القسم</summary>${chips.length?`<div class="chips">${chips.join("")}</div>`:""}${au.length?`<p class="mut" style="margin:8px 0 4px">أبرز من كتب فيه</p><div class="chips">${au.join("")}</div>`:""}</details>`}
function vList(kind,q){const L=LISTS[kind],all=L.items();
 const f={t:q.t||"",a:q.a||"",q:q.q||"",s:q.s||"new",pg:+q.pg||1},PER=20,wide=matchMedia("(min-width:760px)").matches;
 let r=all.filter(b=>(!f.t||inTopic(b,f.t))&&(!f.a||b.authorId===f.a));
 if(f.q.trim()){const w=norm(f.q).split(/\s+/).filter(Boolean);r=r.filter(b=>w.every(k=>norm(b.title).includes(k)))}
 const an=b=>A(b.authorId).name;
 r=f.s==="title"?[...r].sort((x,y)=>x.title.localeCompare(y.title,"ar")):f.s==="author"?[...r].sort((x,y)=>an(x).localeCompare(an(y),"ar")||(y.date||"").localeCompare(x.date||"")):f.s==="old"?[...r].sort((x,y)=>(x.date||"9").localeCompare(y.date||"9")):f.s==="topic"?[...r].sort((x,y)=>topicLabel(T(x.topicId)).localeCompare(topicLabel(T(y.topicId)),"ar")||(y.date||"").localeCompare(x.date||"")):[...r].sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 const np=Math.max(1,Math.ceil(r.length/PER));f.pg=Math.max(1,Math.min(f.pg,np));
 const url=o=>{const n=Object.assign({},f,o),p=new URLSearchParams();["t","a","q","s"].forEach(k=>{if(n[k]&&!(k==="s"&&n[k]==="new"))p.set(k,n[k])});if(n.pg>1)p.set("pg",n.pg);return"#/"+L.route+(p.toString()?"?"+p:"")};
 const cnt=key=>id=>all.filter(b=>!id||b[key==="t"?"topicId":"authorId"]===id).length;
 const topics=lib.topics.filter(t=>all.some(b=>inTopic(b,t.id))).map(t=>Object.assign({},t,{name:topicLabel(t)})).sort((x,y)=>x.name.localeCompare(y.name,"ar"));
 const authors=lib.authors.filter(a=>all.some(b=>b.authorId===a.id));
 const sorts=kind==="statement"?[["new","الأحدث"],["old","الأقدم"]]:[["new","الأحدث"],["title","حسب العنوان"],["author",kind==="fatwa"?"حسب الشيخ":"حسب الكاتب"],["topic",kind==="fatwa"?"حسب الباب":"حسب الموضوع"]];
 const tabs=`<div class="tabs" role="tablist">${sorts.map(([v,l])=>`<a role="tab" aria-selected="${f.s===v}" href="${url({s:v,pg:1})}">${l}</a>`).join("")}</div>`;
 const page=r.slice((f.pg-1)*PER,f.pg*PER);let list="";
 if(f.s==="author"){let last=null;page.forEach(b=>{if(b.authorId!==last){last=b.authorId;list+=`<h3 class="grp"><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(an(b))}</a></h3>`}list+=artCard(b)})}
 else if(f.s==="topic"){let last=null;page.forEach(b=>{if(b.topicId!==last){last=b.topicId;list+=`<h3 class="grp"><a href="${url({t:b.topicId,s:"new",pg:1})}">${esc(topicLabel(T(b.topicId)))}</a> <span class="mut">(${toAr(cnt("t")(b.topicId))})</span></h3>`}list+=artCard(b)})}else list=page.map(artCard).join("");
 const chips=[f.t&&`<a class="chip x" href="${url({t:"",pg:1})}">${esc(topicLabel(T(f.t)))} ✕</a>`,f.a&&`<a class="chip x" href="${url({a:"",pg:1})}">${esc(A(f.a).name)} ✕</a>`,f.q&&`<a class="chip x" href="${url({q:"",pg:1})}">«${esc(f.q)}» ✕</a>`].filter(Boolean).join(" ");
 view(`<h2>${L.title} <span class="mut">(${r.length})</span></h2><p class="mut">${L.desc}</p>${tabs}
 <div class="lib"><aside class="side">${sideList(kind==="fatwa"?"الأبواب":"الأقسام",topics,"t",f.t,url,cnt("t"),wide)}${sideList(kind==="fatwa"?"المشايخ":"الكُتّاب",authors,"a",f.a,url,cnt("a"),wide)}</aside><section>
 <form class="sbox" style="margin:8px 0;max-width:none" data-form="listq" data-route="${L.route}">${["t","a","s"].map(k=>`<input type="hidden" name="${k}" value="${esc(f[k])}">`).join("")}<input name="q" type="search" value="${esc(f.q)}" placeholder="${kind==="fatwa"?"ابحث في أسئلة الفتاوى":"ابحث في العناوين"}" aria-label="بحث في العناوين"><button class="btn">بحث</button></form>
 <div class="chips">${chips}</div>${f.t?relBox(f.t):""}
 ${list||`<div class="note">${all.length?"لا توجد نتائج مطابقة.":L.empty}</div>`}
 ${np>1?`<div class="pgn"><a class="btn s" ${f.pg>1?`href="${url({pg:f.pg-1})}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${f.pg} من ${np}</span><a class="btn s" ${f.pg<np?`href="${url({pg:f.pg+1})}"`:'aria-disabled="true"'}>التالية</a></div>`:""}</section></div>`)}

/* ---------- المؤلفون: الصفحة الجامعة ---------- */
function vAuthors(){const g=(title,col)=>{const as=lib.authors.filter(a=>(a.col||"dawah")===col).map(a=>({a,c:counts(a.id)})).filter(x=>x.c.books||x.c.arts||x.c.fatwas||x.c.st||col==="dawah");
  return`<h2>${title}</h2><div class="grid">${as.map(({a})=>`<a class="card acard" href="#/author/${a.id}" data-author="${a.id}">${avatar(a)}<div><b>${esc(a.name)}</b><span>${a.died?`ت ${a.died}هـ • `:""}${countLine(a.id)}</span></div></a>`).join("")}</div>`};
 view(`<p class="mut" style="margin-top:14px">اضغط مطولًا على اسم أي مؤلف لترى تعريفه الموجز. <a href="#/tarajim">تراجم مشايخ الدعوة</a></p>`+g("مشايخ الدعوة السلفية والكتّاب","dawah")+g("مؤلفو المكتبة العامة","turath")+(lib.authors.some(a=>a.col==="ithra")?g("مؤلفو "+COL.ithra,"ithra"):""))}
function vAuthor(id,q){const mi=(CAT.authors.find(x=>x.id===id)||{}).mergedInto;if(mi){location.replace("#/author/"+mi);return}const a=A(id),mine=lib.books.filter(b=>b.authorId===id&&!VOL2(b)),byDate=l=>l.sort((x,y)=>(y.date||"").localeCompare(x.date||""));
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
const FURQAN=[["فقه الخلاف",/الخلاف/],["الأمر بالمعروف والنهي عن المنكر",/الامر بالمعروف|النهي عن المنكر/],["العمل الجماعي",/العمل الجماعي/],["الحاكمية",/الحاكميه|تحكيم الشريعه|بغير ما انزل الله|تنحيه الشريعه/],["السياسة الشرعية",/السياسه الشرعيه/],["الإلحاد",/الالحاد|الملحد/],["قضايا الإيمان والكفر",/الايمان والكفر|التكفير|العذر بالجهل|الارجاء/],["الولاء والبراء",/الولاء والبراء|البراء/],["السلفية ومناهج التغيير",/مناهج التغيير|منهج التغيير|طرق التغيير|سبل التغيير|وسائل التغيير|السلفيه والتغيير/],["فقه الجهاد",/الجهاد/],["التمذهب",/التمذهب|المذهبيه|اللامذهبيه|التعصب المذهبي/],["مسائل الأسماء والأحكام",/الاسماء والاحكام/],["أهداف الدعوة ومنطلقاتها",/اهداف الدعوه|منطلقات الدعوه|منهج الدعوه السلفيه|^دعوتنا$/],["السلوك",/السلوك|التزكيه|تزكيه النفوس|اعمال القلوب/],["التوحيد وعلم الكلام",/علم الكلام|المتكلمين|الاشاعره|الاشعريه|المعتزله|الجهميه|توحيد الاسماء والصفات/],["حجية السنة",/حجيه السنه|منكري السنه|انكار السنه|القرانيين/],["الدين الإبراهيمي",/الابراهيمي|الابراهيميه/],["المذاهب الفكرية",/العلمانيه|الليبراليه|المذاهب الفكريه|الحداثه|النسويه|الشيوعيه|العلمانيين|الليبراليين/]];
function vFurqan(i,q){const pool=lib.books.filter(b=>!b.demo&&bc(b)==="dawah"&&kindOf(b)!=="fatwa");
 const groups=FURQAN.map(([name,rx])=>[name,pool.filter(b=>(b.tags||[]).includes("furqan:"+name)||rx.test(norm(b.title)))]);
 const gi=+i;if(i!=null&&groups[gi-1]){const [name,l]=groups[gi-1],PER=20,np=Math.max(1,Math.ceil(l.length/PER)),pg=Math.max(1,Math.min(+(q&&q.pg)||1,np)),u=n=>`#/furqan/${gi}${n>1?"?pg="+n:""}`;
  return view(`<p><a href="#/furqan">قضايا الفرقان</a> ›</p><h2>${esc(name)} <span class="mut">(${toAr(l.length)})</span></h2>${l.slice((pg-1)*PER,pg*PER).map(anyCard).join("")||'<p class="note">لا توجد مواد بعد في هذه القضية. تُضاف من «الإدارة» باختيار القضية عند رفع الكتاب أو تعديله.</p>'}${np>1?`<div class="pgn"><a class="btn s" ${pg>1?`href="${u(pg-1)}"`:'aria-disabled="true"'}>السابقة</a><span class="mut">صفحة ${pg} من ${np}</span><a class="btn s" ${pg<np?`href="${u(pg+1)}"`:'aria-disabled="true"'}>التالية</a></div>`:""}`)}
 view(`<h2>قضايا الفرقان</h2><p class="mut">المؤلفات والأبحاث العلمية المنهجية التي أصدرتها الدعوة السلفية في القضايا الكبرى، وأكثرها للشيخ ياسر برهامي. تظهر كتب السلسلة هنا وفي صفحة مؤلفها وفي أقسامها الموضوعية معًا.</p>
 <p class="note">تُرفع كتب سلسلة «قضايا الفرقان» عند توفر ملفاتها من الجمعية. ويظهر هنا الآن ما يتصل بكل قضية من المقالات المستوردة.</p>
 ${groups.map(([name,l],k)=>`<section class="tj-s"><h3><a href="#/furqan/${k+1}">${esc(name)}</a> <span class="mut">(${toAr(l.length)})</span></h3>${l.slice(0,8).map(anyCard).join("")||'<p class="mut">لا توجد مواد بعد.</p>'}${l.length>8?`<p><a href="#/furqan/${k+1}">عرض كل المواد (${toAr(l.length)}) ←</a></p>`:""}</section>`).join("")}`)}
function vTafrighat(){const l=lib.books.filter(b=>!b.demo&&isTranscript(b)&&!VOL2(b));
 const extra=b=>b.sharh&&B(b.sharh)||b.audio?`<p class="mut" style="margin:-6px 0 12px;font-size:.88rem">${b.sharh&&B(b.sharh)?`شرح لكتاب: <a href="#/book/${b.sharh}">${esc(B(b.sharh).setTitle||B(b.sharh).title)}</a>`:""}${b.sharh&&B(b.sharh)&&/^https:/.test(b.audio||"")?" • ":""}${/^https:/.test(b.audio||"")?`<a href="${esc(b.audio)}" target="_blank" rel="noopener">التسجيل الصوتي ↗</a>`:""}</p>`:"";
 view(`<h2>تفريغات</h2><p class="mut">الدروس والشروح الصوتية لمشايخ الدعوة مفرّغة نصيًا، مرتبطة بمؤلفيها وبالكتب المشروحة.</p>${l.map(b=>bookCard(b)+extra(b)).join("")||'<p class="note">لا توجد تفريغات بعد.</p>'}<p class="note">تُضاف التفريغات من «الإدارة ← رفع تفريغات» (ملفات Word أو نص أو ترجمات المقاطع)، أو بإرسال ملفاتها لنا من <a href="#/contact">تواصل معنا</a>.</p>`)}

/* ---------- الصفحات التعريفية ---------- */
const WA="96566700232";
const waLink=t=>`https://wa.me/${WA}${t?"?text="+encodeURIComponent(t):""}`;
function vAbout(){view(`<div class="page"><h2>من نحن</h2>
 <p><b>مكتبة الدعوة السلفية الرقمية</b> مشروع لجمعية الدعاة، يهدف إلى حفظ تراث الدعوة السلفية بمصر وتيسيره للباحثين وطلاب العلم وعموم المسلمين، بطريقة حديثة تسهّل البحث والقراءة والنقل والدراسة.</p>
 <h3>ماذا تجد في المكتبة</h3><ul>
 <li><b>مكتبة الدعوة:</b> كتب مشايخ الدعوة السلفية بمصر وكتب حزب النور.</li>
 <li><b>المقالات والفتاوى والبيانات:</b> تُستورد يوميًا من موقع صوت السلف، مقسمة كما فيه وبحسب الكاتب.</li>
 <li><b>المكتبة العامة:</b> كتب الإسلام الكبرى والمراجع المعتمدة في التفسير والحديث والفقه والعقيدة واللغة والتاريخ.</li>
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

function vFavs(){const l=lib.books.filter(b=>S.favs.includes(b.id)),mj=S.favs.some(x=>x.startsWith("maj:"));if(mj&&typeof MAJ!=="undefined")MAJ.load().then(()=>{const el=$("#favmaj");if(el)el.innerHTML=MAJ.favCards()});view(`<h2>المفضلة</h2><div id="favmaj"></div>${l.map(anyCard).join("")||(mj?"":'<p class="mut">لم تضف شيئًا بعد. افتح أي كتاب أو مقال واضغط «مفضلة».</p>')}`)}

/* ---------- البحث ---------- */
async function vSearch(q){
 const f={q:q.q||"",mode:q.mode||"all",scope:q.scope||"all",a:q.a||"",t:q.t||"",ex:q.ex||"",big:q.big||"",c:q.c||"",k:q.k||""};
 const opt=(arr,v,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const so=(v,l,c)=>`<option value="${v}"${c===v?" selected":""}>${l}</option>`;
 view(`<h2>البحث</h2><form data-form="search"><input name="q" type="search" value="${esc(f.q)}" placeholder="اكتب كلمة أو عبارة" aria-label="كلمات البحث">
 <div class="row"><div><label>نوع البحث</label><select name="mode">${so("all","كل الكلمات",f.mode)}${so("any","أي كلمة",f.mode)}${so("phrase","عبارة كاملة",f.mode)}</select></div>
 <div><label>النطاق</label><select name="scope">${so("all","العناوين والنصوص",f.scope)}${so("meta","العناوين والمؤلفون فقط",f.scope)}${so("text","النصوص فقط",f.scope)}</select></div>
 <div><label>النوع</label><select name="k">${so("","كتب ومقالات",f.k)}${so("book","كتب فقط",f.k)}${so("article","مقالات فقط",f.k)}</select></div></div>
 <div class="row"><div><label>القسم</label><select name="c">${so("","الكل",f.c)}${so("dawah",COL.dawah,f.c)}${so("turath",COL.turath,f.c)}${so("ithra",COL.ithra,f.c)}</select></div><div><label>المؤلف</label><select name="a">${opt(lib.authors,f.a,"كل المؤلفين")}</select></div><div><label>الموضوع</label><select name="t">${opt(lib.topics,f.t,"كل الموضوعات")}</select></div></div>
 <label class="inl"><input type="checkbox" name="ex" value="1"${f.ex==="1"?" checked":""}> مطابقة التشكيل والهمزات حرفيًا</label><br>${lib.books.some(b=>b.big)?`<label class="inl"><input type="checkbox" name="big" value="1"${f.big==="1"?" checked":""}> البحث في الموسوعات الكبيرة متعددة المجلدات أيضًا (أبطأ؛ أو اختر المؤلف)</label><br>`:""}
 <button class="btn p" style="margin-top:10px">ابحث</button></form><div id="sres"></div>`,true);
 if(!f.q.trim())return;
 const out=$("#sres"),n=f.ex==="1"?f.q.trim():norm(f.q).trim(),w=n.split(/\s+/).filter(Boolean),P=f.ex==="1"?(s=>s):(s=>norm(s));
 const m=t=>{const x=P(t);return f.mode==="phrase"?x.includes(n):f.mode==="any"?w.some(k=>x.includes(k)):w.every(k=>x.includes(k))};
 const books=lib.books.filter(b=>(!f.c||bc(b)===f.c)&&(!f.a||b.authorId===f.a)&&(!f.t||inTopic(b,f.t))&&(!f.k||(b.type||"book")===f.k)&&(!b.big||f.a||f.big==="1"));
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
 if(prev!==null&&t&&prev.trim()&&!/^#/.test(prev)&&!/^#|^[-•*]\s|^[(\[]?[\d٠-٩]{1,3}[)\].-]\s|^\*\*\*/.test(t)&&!/[.؟!:؛»)\]"*]\s*$/.test(prev)&&!/^\|/.test(t)&&!/^\|/.test(prev.trim())&&!/\s{3,}/.test(prev.trim())&&!TOCL.test(prev))o[o.length-1]=prev.trimEnd()+" "+t;else o.push(l)}return o.join("\n")}
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
// تشكيل الطبعة الأصلي (كثير من كتب التراث مشكول في أصله): يُعرف من كثافة الحركات في صفحات من الكتاب
const ORIG_TASH=new Map();
function origTash(b){if(!b||!b.pages)return false;if(ORIG_TASH.has(b.id))return ORIG_TASH.get(b.id);const ps=b.pages,step=Math.max(1,Math.floor(ps.length/12));let d=0,l=0;for(let i=0;i<ps.length;i+=step){const t=ps[i]||"";d+=(t.match(/[\u064B-\u0652]/g)||[]).length;l+=(t.match(/[\u0621-\u064A]/g)||[]).length}const r=l>200&&d/l>0.02;ORIG_TASH.set(b.id,r);return r}
const hasTash=b=>!!(b&&(TK.info(b)||origTash(b)||bc(b)==="dawah"));
const shownText=(b,i)=>{const t=b.pages[i]||"";return S.tash?(TK.get(b,t)||t):strip(t)};
const expTash=t=>S.tash?t:strip(t);
/* الباب ٦: تمييز الآيات ﴿…﴾، والأحاديث «…» بعد ذكر النبي ﷺ، والاقتباسات «…» الطويلة (٥ كلمات فأكثر)، ورؤوس الفقرات المعروفة.
   يعيد مواضع بالحروف داخل السطر؛ يُصحَّح الخطأ من الإدارة (paintMarks)، والنص الأصلي لا يتغير. */
// الحديث: ذكر النبي ﷺ متكلمًا قبل «» مباشرة (قال ﷺ: / قال رسول الله ﷺ: / حديث: / قال النبي ﷺ لعمه: …)، لا من يخاطبه (لرسول الله، يا رسول الله، إلى النبي).
// قيس على ٤٠ كتابًا من مكتبة الدعوة: ٢٠٩٨ موضعًا، وكل العينات المفحوصة أحاديث فعلًا.
const HDSPK="(?:رسول الله|النبي|نبينا)";
const HDCUE=new RegExp("(?:ﷺ|صلى الله عليه وسلم|صلى الله عليه وآله وسلم|عليه الصلاة والسلام|(?:قال|يقول|فقال|وقال|ويقول|قول|قوله|وقوله|وقول|عن|حديث|خطب)\\s+"+HDSPK+"|حديث|في الحديث)(?:\\s*\\([^)]{0,6}\\))?\\s*(?:أنه\\s+)?(?:فقال|قال|يقول)?\\s*[:،]?\\s*$");
const HDCUE2=new RegExp("(?:قال|يقول|فقال|وقال|ويقول)\\s+"+HDSPK+"\\s*(?:ﷺ|صلى الله عليه وسلم)?(?:(?!قال|يقول|قالت)[^«»:،.؟]){1,35}:\\s*$");
const HDADDR=/(?:(?:^|\s)(?:لرسول الله|للنبي|لنبينا)|(?:^|\s)(?:إلى|يا|عند|مع)\s+(?:رسول الله|النبي|نبينا))\s*(?:ﷺ|صلى الله عليه وسلم)?\s*(?:\([^)]{0,6}\))?\s*(?:قال|فقال)?\s*[:،]?\s*$/;
const isHdCue=b=>(HDCUE.test(b)||HDCUE2.test(b))&&!HDADDR.test(b);
const LEADRX=/^\s*(و?(?:فائدة(?: \S+)?|فوائد|تنبيه|تنبيهات|مسألة|المسألة \S+|فصل|قاعدة|ضابط|تعريف\S*|الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا|الجواب|السؤال|س|ج|الدليل|الشاهد|الخلاصة|خلاصة القول|ملحوظة|ملاحظة|تعليق|المعنى|المعنى الإجمالي|وجه الدلالة|الراجح|الحكم|الحكمة|الفرق|قلت|أقول|الشرح|الإعراب|التخريج))\s*[:：]/;
function lineMarks(l){const sp=[],t=String(l);let m;
 const rq=/﴿[^﴾]*﴾?/g;while((m=rq.exec(t)))sp.push({s:m.index,e:m.index+m[0].length,k:"qv"});
 const rg=/«([^»]*)»?/g;while((m=rg.exec(t))){if(sp.some(x=>m.index>=x.s&&m.index<x.e))continue;const words=m[1].trim().split(/\s+/).filter(Boolean).length,before=strip(t.slice(Math.max(0,m.index-60),m.index));
  const k=isHdCue(before)?"hd":words>=5?"qt":"";if(k)sp.push({s:m.index,e:m.index+m[0].length,k})}
 const st=strip(t),lm=LEADRX.exec(st);let lead=0;if(lm){// موضع النقطتين في النص الأصلي (قد يكون مشكولًا)
  const ci=t.search(/[:：]/);if(ci>0&&ci<80)lead=ci+1}
 const nn=t.replace(/\s+/g,"").length||1,cov=k=>sp.filter(x=>x.k===k).reduce((a,x)=>a+t.slice(x.s,x.e).replace(/\s+/g,"").length,0)/nn;
 const words=t.trim().split(/\s+/).length,p=words>=8&&cov("qt")>=.8?"pq":words>=4&&cov("qv")>=.85?"pv":"";
 return{sp,lead,p}}
function markOf(mk,a,b){if(mk.lead&&a<mk.lead)return"ld";const x=mk.sp.find(x=>a<x.e&&b>x.s);return x?x.k:""}
function pageHtml(text,h,uw,bk){if(!String(text||"").trim())return`<p class="mut emptyp">هذه الصفحة بلا نص في الكتاب (غلاف أو صفحة فارغة)، ويمكنك رؤيتها في النسخة المصورة.</p>`;const hs=norm(h||"").split(/\s+/).filter(Boolean),us=(uw||[]).map(x=>norm(x)).filter(Boolean);const tk=S.tash&&bk?TK.get(bk,text):null;const tx0=S.tash?(tk||text):strip(text);
 // الحواشي: ما بعد سطر الشرطات ____ يُعرض حواشي أسفل الصفحة (ظاهرة أو مطوية بحسب اختيار القارئ)
 const cut=tx0.search(/^\s*_{4,}\s*$/m),tx=cut>=0?tx0.slice(0,cut).trimEnd():tx0,fnt=cut>=0?tx0.slice(cut).replace(/^\s*_{4,}\s*\n?/,"").trim():"";
 const fnHtml=fnt?`<div class="fns${S.fn==="fold"?" fold":""}"><button class="fnt" data-act="fntoggle">الحواشي (${toAr(fnt.split("\n").filter(Boolean).length)})</button><div class="fnb">${fnt.split("\n").filter(Boolean).map(l=>`<p>${esc(l).replace(/^(\(?[\d٠-٩]{1,3}\)?)/,'<b>$1</b>')}</p>`).join("")}</div></div>`:"";
 const tocPg=bk&&tx.split("\n").filter(l=>TOCL.test(l.trim())).length>=4;
 return (tocPg?tx:joinLines(tx)).split("\n").map(line=>{const tl=line.trim();if(/^\|.*\|$/.test(tl)){if(/^\|[\s:|-]+\|$/.test(tl))return"";return"<tr>"+tl.slice(1,-1).split("|").map(c=>"<td>"+esc(c.trim()).replace(/&lt;br&gt;/g,"<br>")+"</td>").join("")+"</tr>"}const tm=tocPg&&TOCL.exec(line.trim()),tp=tm&&pageByLabel(bk,arD(tm[2]));if(tp)return`<p class="tocl"><a href="#/book/${bk.id}/${tp}"><span>${esc(tm[1].replace(/^#+\s*/,""))}</span><em>${toAr(arD(tm[2]))}</em></a></p>`;const h2=line.startsWith("## "),head=h2||line.startsWith("# "),l=h2?line.slice(3):head?line.slice(2):line;
  const mk=head?{sp:[],lead:0,p:""}:lineMarks(l);let pos=0;
  const inner=l.split(/(\s+)/).map(w=>{const a=pos;pos+=w.length;if(!w.trim())return w;const mc=markOf(mk,a,pos);return`<span class="w${mc?" "+mc:""}${hs.length&&hs.some(k=>norm(w).includes(k))?" hit":""}${us.length&&us.some(k=>norm(w).includes(k))?" unc":""}">${fnt?esc(w).replace(/\(([\d٠-٩]{1,3})\)/g,'<sup class="fnr" data-fn="$1">($1)</sup>'):esc(w)}</span>`}).join("");
  return head?`<p class="ph${h2?" ph2":""}">${inner}</p>`:`<p${mk.p?` class="${mk.p}"`:""}>${inner}</p>`}).join("").replace(/(?:<tr>.*?<\/tr>)+/g,m=>`<div class="tblw"><table>${m}</table></div>`)+fnHtml}
/* تصحيحات التمييز من الإدارة (data/marks/<الكتاب>.json): {p:{"<الصفحة>":{h:بصمة النص,m:[[فقرة,من,إلى,صنف]]}}}.
   تُطبَّق فقط إن لم يتغير نص الصفحة، وتُحمَّل للكتب المعلَّمة marks في الفهرس وحدها. */
const MARKS=new Map();
async function marksOf(b){if(!b||!b.marks)return null;let m=MARKS.get(b.id);if(m&&m.v===b.marks)return m.d;
 try{const r=await fetch(`data/marks/${encodeURIComponent(b.id)}.json?v=${b.marks}`);const d=r.ok?await r.json():null;MARKS.set(b.id,{v:b.marks,d});return d}catch(e){return null}}
async function paintMarks(rd){const b=B(rd.dataset.id),pg=+rd.dataset.p;if(!b||!b.marks||!b.pages)return;const d=await marksOf(b),e=d&&d.p&&d.p[pg];if(!e||e.h!==fnv(b.pages[pg-1]||""))return;
 const ps=rd.querySelectorAll(":scope > p");e.m.forEach(([pi,a,z,k])=>{const ws=ps[pi]&&ps[pi].querySelectorAll(".w");if(!ws)return;for(let i=a;i<=z&&i<ws.length;i++){ws[i].classList.remove("qv","hd","qt","ld");if(k!=="none")ws[i].classList.add(k)}})}
// تحديد المشرف: الفقرة ورقما أول كلمة وآخرها
function selWords(){const g=getSelection();if(!g.rangeCount)return null;const r=g.getRangeAt(0),w=n=>(n.nodeType===1?n:n.parentElement).closest(".w"),a=w(r.startContainer),z=w(r.endContainer);if(!a||!z)return null;
 const p=a.closest("p");if(!p||p!==z.closest("p"))return{err:"حدّد داخل فقرة واحدة."};const rd=p.closest(".rd[data-id]");if(!rd)return null;
 const ws=[...p.querySelectorAll(".w")],ps=[...rd.querySelectorAll(":scope > p")];return{rd,pi:ps.indexOf(p),a:ws.indexOf(a),z:ws.indexOf(z)}}
async function saveMark(k){const s0=selWords();if(!s0||s0.err)return toast(s0?s0.err:"حدّد النص أولًا.");if(!GH.on)return toast("التصحيح يحتاج حساب مشرف.");
 const id=s0.rd.dataset.id,pg=+s0.rd.dataset.p,b=B(id),h=fnv(b.pages[pg-1]||""),ent=[s0.pi,s0.a,s0.z,k];
 try{await GH.editJSON("data/marks/"+id+".json",o=>{o=o&&o.p?o:{v:1,p:{}};const e=o.p[pg]&&o.p[pg].h===h?o.p[pg]:{h,m:[]};e.m=e.m.filter(x=>!(x[0]===ent[0]&&x[1]===ent[1]&&x[2]===ent[2]));e.m.push(ent);o.p[pg]=e;return o},"تصحيح تمييز: "+(b.setTitle||b.title)+" ص "+pg,true);
  const v=Date.now();await GH.editJSON("data/catalog.json",c=>{const x=c.books.find(y=>y.id===id);if(x)x.marks=v;c.version=Date.now();return c},"تصحيح تمييز (فهرس): "+(b.setTitle||b.title),true);
  [CAT.books.find(y=>y.id===id),b].forEach(x=>{if(x)x.marks=v});MARKS.delete(id);
  if(typeof MG!=="undefined")MG.log({op:"mark",kind:"book",ids:[id],changes:[{id,kind:"book",field:"mark",from:"آلي",to:{qv:"آية",hd:"حديث",qt:"اقتباس",none:"بلا تمييز"}[k]+` (ص ${pg})`}],note:"تصحيح تمييز في «"+(b.setTitle||b.title)+"»"}).catch(()=>{});
  closeSheet();try{getSelection().removeAllRanges()}catch(e){}refreshPage();toast("حُفظ التصحيح، ويظهر للجميع خلال دقائق.")}catch(e){toast(e.message)}}
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
/* تكبير الصفحة المصورة وتصغيرها: أزرار، وقرص بإصبعين، وضغطتان متتاليتان، وسحب للتنقل داخل الصفحة المكبرة */
function zoomify(box){const el=box.querySelector("img.pimg,canvas");if(!el)return;const wrap=document.createElement("div");wrap.className="zwrap";el.replaceWith(wrap);wrap.appendChild(el);
 let z=Math.min(4,Math.max(1,+S.pz||1));const bar=document.createElement("div");bar.className="zbar";bar.innerHTML='<button data-z="-" aria-label="تصغير الصفحة">−</button><span class="zv"></span><button data-z="+" aria-label="تكبير الصفحة">+</button><button data-z="0" aria-label="الحجم الأصلي">⟲</button>'+(el.tagName==="IMG"?'<a href="'+el.src+'" target="_blank" rel="noopener" aria-label="فتح الصورة كاملة">⤢</a>':"");wrap.before(bar);
 const set=(nz,cx,cy)=>{nz=Math.min(4,Math.max(1,Math.round(nz*100)/100));const r=wrap.getBoundingClientRect(),fx=cx==null?.5:(cx-r.left+wrap.scrollLeft)/(wrap.scrollWidth||1),fy=cy==null?.5:(cy-r.top+wrap.scrollTop)/(wrap.scrollHeight||1);z=nz;el.style.width=(z*100)+"%";el.style.maxWidth="none";wrap.classList.toggle("zoomed",z>1);bar.querySelector(".zv").textContent=toAr(Math.round(z*100))+"٪";S.pz=z;saveS();
  requestAnimationFrame(()=>{wrap.scrollLeft=fx*wrap.scrollWidth-wrap.clientWidth/2;wrap.scrollTop=fy*wrap.scrollHeight-wrap.clientHeight/2})};
 bar.addEventListener("click",e=>{const b=e.target.closest("[data-z]");if(!b)return;const k=b.dataset.z;set(k==="+"?z+.5:k==="-"?z-.5:1)});
 let last=0;wrap.addEventListener("click",e=>{const t=Date.now();if(t-last<320){set(z>1?1:2,e.clientX,e.clientY);last=0}else last=t});
 const pts=new Map();let d0=0,z0=1,drag=null;
 wrap.addEventListener("pointerdown",e=>{pts.set(e.pointerId,e);if(pts.size===2){const[a,b]=[...pts.values()];d0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);z0=z}else if(z>1&&e.pointerType==="mouse"){drag={x:e.clientX,y:e.clientY,l:wrap.scrollLeft,t:wrap.scrollTop}}});
 wrap.addEventListener("pointermove",e=>{if(pts.has(e.pointerId))pts.set(e.pointerId,e);if(pts.size===2&&d0){const[a,b]=[...pts.values()],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);set(z0*d/d0,(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);e.preventDefault()}else if(drag){wrap.scrollLeft=drag.l-(e.clientX-drag.x);wrap.scrollTop=drag.t-(e.clientY-drag.y)}});
 const up=e=>{pts.delete(e.pointerId);if(pts.size<2)d0=0;drag=null};["pointerup","pointercancel","pointerleave"].forEach(ev=>wrap.addEventListener(ev,up));
 set(z)}
async function renderPdf(b,p){const box=$("#pdfv");if(!box)return;box.innerHTML='<p class="mut" style="text-align:center;padding:30px 0">جارٍ تحميل الصفحة المصورة…</p>';
 if(b.img){// صور الصفحات من مخزن المكتبة: صفحة واحدة خفيفة بدل الملف كله
  const n=pdfPageFor(b,p),N=+b.imgN||0;if(n<1||(N&&n>N)){box.innerHTML='<p class="note">لا توجد صفحة مصورة مقابلة لهذه الصفحة.</p>';return}
  const im=new Image();im.alt="الصفحة المصورة "+n;im.decoding="async";im.className="pimg";
  im.onload=()=>{if(!$("#pdfv"))return;box.innerHTML="";box.appendChild(im);box.insertAdjacentHTML("beforeend",pdfCap(b,n,N||n));zoomify(box)};
  im.onerror=()=>{const el=$("#pdfv");if(el)el.innerHTML='<p class="note">تعذر تحميل الصفحة المصورة. تحقق من الاتصال.</p>'};
  if(!Auth.user){box.innerHTML='<p class="note">النسخة المصورة لأعضاء المكتبة. <a href="#/account">سجّل الدخول</a>.</p>';return}
  try{im.src=await pimgUrl(b,n);[n+1,n+2].forEach(k=>{if(!N||k<=N)pimgUrl(b,k).then(u=>{new Image().src=u}).catch(()=>{})})}catch(e){box.innerHTML='<p class="note">'+esc(e.message)+'</p>'}return}
 try{const doc=await pdfDoc(b.pdf),n=pdfPageFor(b,p);if(!$("#pdfv"))return;if(n<1||n>doc.numPages){box.innerHTML='<p class="note">لا توجد صفحة مصورة مقابلة لهذه الصفحة.</p>';return}
  const pg=await doc.getPage(n),w=Math.max(280,box.clientWidth||600),vp0=pg.getViewport({scale:1}),sc=w/vp0.width*Math.min(2,window.devicePixelRatio||1),vp=pg.getViewport({scale:sc});
  const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;if(!$("#pdfv"))return;
  box.innerHTML="";box.appendChild(c);box.insertAdjacentHTML("beforeend",pdfCap(b,n,doc.numPages));zoomify(box)}
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
 // حفظ عدة ملفات في إيداع واحد (يقلل عمليات النشر): عبر خادم الحفظ للمشرفين، أو Git Data API بالمفتاح المباشر.
 // files: [{path, text}] ؛ يُقسَّم تلقائيًا إلى دفعات تحت حد حجم الطلب
 async batch(files,msg,onStatus){const MAX=3e6,groups=[[]];let sz=0;for(const f of files){const n=(f.text||"").length*1.1+200;if(groups[groups.length-1].length&&(sz+n>MAX||groups[groups.length-1].length>=40)){groups.push([]);sz=0}groups[groups.length-1].push(f);sz+=n}
  for(let g=0;g<groups.length;g++){const part=groups.length>1?` (دفعة ${g+1} من ${groups.length})`:"";if(onStatus)onStatus(`جارٍ الحفظ${part}…`);
   if(this.proxied){const r=await fetch((CFG.ghProxy||"api/gh")+"?batch=1",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(Auth.token||"")},body:JSON.stringify({message:msg+part,branch:this.branch,files:groups[g]})});
    if(!r.ok){let m="";try{m=(await r.json()).message}catch(e){}throw new Error(m||"تعذر الحفظ ("+r.status+")")}continue}
   const j=async(p,o)=>(await this.api(p,o)).json(),ref=await j("/git/ref/heads/"+this.branch),base=await j("/git/commits/"+ref.object.sha),tree=[];
   for(const f of groups[g]){const b=await j("/git/blobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:f.text,encoding:"utf-8"})});tree.push({path:f.path,mode:"100644",type:"blob",sha:b.sha})}
   const t=await j("/git/trees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:base.tree.sha,tree})});
   const c=await j("/git/commits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg+part,tree:t.sha,parents:[ref.object.sha]})});
   await this.api("/git/refs/heads/"+this.branch,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:c.sha})})}},
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
 <label class="inl"><input type="checkbox" id="lfn"${S.fn==="fold"?" checked":""}> طيّ الحواشي (تُفتح بالضغط)</label>
 ${lookMore()}`}
// الباب ٦: إعدادات العرض الإضافية؛ كل عنصر data-k يُحفظ في S بنوعه (data-t)
function lookMore(){const o=(k,arr)=>arr.map(([v,t])=>`<option value="${v}"${String(S[k]??"")===String(v)?" selected":""}>${t}</option>`).join("");
 const col=(k,lbl)=>`<div class="colrow"><label for="lk-${k}">${lbl}</label><input type="color" id="lk-${k}" data-k="${k}" data-t="color" value="${S[k]||"#000000"}"${S[k]?"":' data-unset="1"'}><button type="button" class="btn s" data-lkclr="${k}">${S[k]?"افتراضي":"(افتراضي)"}</button></div>`;
 return`<fieldset class="lookgrp"><legend>النص</legend><div class="row">
  <div><label for="lk-fw">كثافة الخط</label><select id="lk-fw" data-k="fw" data-t="num">${o("fw",[[400,"عادي"],[500,"متوسط"],[700,"عريض"]])}</select></div>
  <div><label for="lk-align">المحاذاة</label><select id="lk-align" data-k="align" data-t="str">${o("align",[["","تلقائية"],["justify","ضبط الطرفين"],["right","يمين"],["center","وسط"]])}</select></div>
  <div><label for="lk-dir">اتجاه الكتابة</label><select id="lk-dir" data-k="dir" data-t="str">${o("dir",[["rtl","من اليمين"],["auto","تلقائي لكل فقرة"]])}</select></div></div>
  <label for="lk-ps">المسافة بين الفقرات</label><input id="lk-ps" type="range" min="0" max="1.6" step=".05" data-k="ps" data-t="num" value="${S.ps??.35}">
  <label for="lk-w">عرض مساحة القراءة</label><select id="lk-w" data-k="w" data-t="str">${o("w",[["s","ضيق"],["m","متوسط"],["l","واسع"],["x","كامل الشاشة"]])}</select>
  <label class="inl"><input type="checkbox" data-k="lead" data-t="bool"${S.lead!==false?" checked":""}> إبراز رؤوس الفقرات (فائدة: تنبيه: مسألة: أولًا: …)</label></fieldset>
 <fieldset class="lookgrp"><legend>الألوان</legend>${col("bg","لون الخلفية")}${col("ink","لون النص")}<p class="mut" style="margin:4px 0 0">يتقدّمان على لون الصفحة المختار أعلاه.</p></fieldset>
 <fieldset class="lookgrp"><legend>الاقتباسات</legend><p class="mut" style="margin:0">النصوص بين «» من خمس كلمات فأكثر، والفقرة التي هي اقتباس كلها تُعرض كتلة مستقلة.</p><div class="row">
  <div><label for="lk-qf">الخط</label><select id="lk-qf" data-k="qf" data-t="str"><option value="">كخط النص</option>${fontOpts(S.qf||"").replace(/ selected/g,"").replace(`value="${S.qf}"`,`value="${S.qf}" selected`)}</select></div>
  <div><label for="lk-qw">الكثافة</label><select id="lk-qw" data-k="qw" data-t="num">${o("qw",[[400,"عادي"],[500,"متوسط"],[700,"عريض"]])}</select></div>
  <div><label for="lk-qa">المحاذاة</label><select id="lk-qa" data-k="qa" data-t="str">${o("qa",[["","كالنص"],["justify","ضبط الطرفين"],["right","يمين"],["center","وسط"]])}</select></div></div>
  <label for="lk-qs">الحجم</label><input id="lk-qs" type="range" min=".8" max="1.35" step=".05" data-k="qs" data-t="num" value="${S.qs||1}">
  <label for="lk-qm">المسافة حول الاقتباس</label><input id="lk-qm" type="range" min="0" max="1.6" step=".1" data-k="qm" data-t="num" value="${S.qm??.6}">${col("qc","لون الاقتباس")}</fieldset>
 <fieldset class="lookgrp"><legend>العناوين</legend><label for="lk-hs">حجم العناوين</label><input id="lk-hs" type="range" min=".9" max="1.6" step=".05" data-k="hs" data-t="num" value="${S.hs||1}">${col("hc","لون العناوين")}</fieldset>
 <fieldset class="lookgrp"><legend>تنسيق بصري اختياري</legend>
  <label class="inl"><input type="checkbox" data-k="mkq" data-t="bool"${S.mkq?" checked":""}> تمييز الآيات القرآنية بالأخضر</label>
  <label class="inl"><input type="checkbox" data-k="mkh" data-t="bool"${S.mkh?" checked":""}> تمييز الأحاديث النبوية بالأزرق</label>
  <label class="inl"><input type="checkbox" data-k="mkt" data-t="bool"${S.mkt?" checked":""}> تمييز العناوين الفرعية بالأحمر، وعناوين الفصول بنمط خاص</label>
  <p class="mut" style="margin:4px 0 0">التعرّف آلي: الآيات بين ﴿﴾، والأحاديث بين «» بعد ذكر النبي ﷺ. إن أخطأ في موضع يصححه المشرف من شريط التحديد.</p></fieldset>
 <button type="button" class="btn" data-act="lookreset">إعادة كل إعدادات العرض إلى الافتراضي</button>`}
function wireLook(){
 // عناصر الباب ٦ (data-k)
 const save=()=>{saveS();applyLook();refreshPage();Prefs.push()};
 $$("#sheetB [data-k]").forEach(e=>{e.oninput=e.onchange=()=>{const k=e.dataset.k,t=e.dataset.t;S[k]=t==="bool"?e.checked:t==="num"?+e.value:e.value;if(t==="color"){delete e.dataset.unset;const b=$(`[data-lkclr="${k}"]`);if(b)b.textContent="افتراضي"}save()}});
 $$("#sheetB [data-lkclr]").forEach(b=>b.onclick=()=>{S[b.dataset.lkclr]="";b.textContent="(افتراضي)";save()});
 const rs=$("#sheetB [data-act=lookreset]");if(rs)rs.onclick=()=>{Object.assign(S,LOOKDEF);save();openSheet("مظهر الصفحة",lookHtml(),wireLook)};
 const up=()=>{S.font=$("#lf").value;S.size=+$("#ls").value;S.lh=+$("#ll").value;S.tash=$("#lt").checked;S.fn=$("#lfn")&&$("#lfn").checked?"fold":"show";S.fmt=$("#lfmt")&&!$("#lfmt").checked?"plain":"print";S.theme=$("#lth").value;saveS();applyLook();refreshPage();Prefs.push()};
 ["#lf","#ls","#ll","#lt","#lth","#lfn","#lfmt"].forEach(i=>{const e=$(i);if(e)e.oninput=e.onchange=up});
 $$("[data-sz]").forEach(b=>b.onclick=()=>{const r=$("#ls");r.value=Math.max(1,Math.min(2.4,+r.value+(+b.dataset.sz)*.1));up()});
 $$(".swc").forEach(s=>s.onclick=()=>{S.pg=s.dataset.pg;saveS();applyLook();Prefs.push();$$(".swc").forEach(x=>x.setAttribute("aria-pressed",x===s))});
 $$("[data-mode]").forEach(m=>m.onclick=()=>{if(S.mode===m.dataset.mode)return;S.mode=m.dataset.mode;saveS();$$("[data-mode]").forEach(x=>x.setAttribute("aria-checked",x===m));const c=cur();closeSheet();if(c){LASTREAD=null;history.replaceState(null,"","/book/"+c.b.id+"/"+c.p);route()}})}
function refreshPage(){$$(".rd[data-id]").forEach(rb=>{const b=B(rb.dataset.id);if(b&&b.pages){rb.innerHTML=pageHtml(b.pages[+rb.dataset.p-1],parse().q.h,uncOf(b,+rb.dataset.p-1),b);paintNotes(rb)}})}
/* شريط تقدم القراءة أعلى الشاشة */
function setProg(b,p){let el=$("#rprog");if(!el){document.body.insertAdjacentHTML("beforeend",'<div id="rprog" aria-hidden="true"><i></i></div>');el=$("#rprog")}const n=b.pages.length;el.hidden=n<2;el.firstChild.style.width=(n>1?Math.round(p/n*1000)/10:0)+"%"}
/* وضع التمرير العمودي المتصل: الصفحات تتتابع، والصفحة الظاهرة هي الحالية */
const SCR={io:null,more:null};
function spgHtml(b,k,h){const lb=PL(b,k-1),ch=chapterOf(b,k);return`<section class="spg" data-p="${k}"${ch?` data-ch="${esc(ch)}"`:""}><div class="spn">صفحة ${toAr(k)}${lb?` <small>${esc(lb)}</small>`:""}</div><div class="rd" data-id="${b.id}" data-p="${k}">${pageHtml(b.pages[k-1],h,uncOf(b,k-1),b)}</div></section>`}
function scrSet(b,k){const sec=$(`.spg[data-p="${k}"]`);if(!sec)return;const old=$("#rb");if(old&&old!==sec.querySelector(".rd"))old.removeAttribute("id");sec.querySelector(".rd").id="rb";
 if(LASTREAD&&LASTREAD.p===k)return;LASTREAD={id:b.id,p:k};S.last={id:b.id,p:k};S.lastBy=Object.assign({},S.lastBy||{});delete S.lastBy[b.id];S.lastBy[b.id]=k;S.maxBy=S.maxBy||{};if(k>(S.maxBy[b.id]||0))S.maxBy[b.id]=k;saveS();
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
  ${hasTash(b)||art?`<button data-act="tashtog">${S.tash?"إخفاء التشكيل":"إظهار التشكيل"}${TK.info(b)?` <small class="mut">(مشكول ${toAr(Math.round(100*TK.info(b).n/Math.max(1,TK.info(b).of)))}٪)</small>`:bc(b)!=="dawah"&&origTash(b)?` <small class="mut">(تشكيل الطبعة)</small>`:""}</button>`:""}
  <button data-act="fav">${fav?"★ إزالة من المفضلة":"☆ إضافة للمفضلة"}</button>
  <button data-act="offbook" data-id="${b.id}">${(ls.get("offbooks",[])).includes(b.set||b.id)?"✓ محفوظ دون إنترنت":"⇩ حفظ للقراءة دون إنترنت"}</button>
  <button data-act="copyp">نسخ ${art?"المقال":"الصفحة"}</button>
  ${art?"":'<button data-act="card">بطاقة الكتاب</button>'}
  ${art||b.pages.length<3?"":`<a class="btn" href="#/summary?b=${encodeURIComponent(b.id)}&r=20" data-act="closeSheet">اختصار هذا الكتاب</a><a class="btn" href="#/quizzes/${encodeURIComponent(b.id)}?l=easy" data-act="closeSheet">اختبر فهمك للكتاب</a>`}
  <button data-act="mark">علامة على هذه الصفحة</button>
  <button data-act="plan">مشروع قراءة وتذكير</button>
  <button data-act="tts">استمع (قراءة صوتية)</button>
  <button data-act="tr">ترجمة</button>
  <button data-act="exp">تصدير وطباعة</button>
  <a href="#/ask?b=${b.id}&p=${c.p}" data-act="closeSheet">اسأل المكتبة عنها</a>
  <button data-act="qhint">صمّم الاقتباس</button>
  ${b.pages.length>1?'<button data-act="goto">الانتقال لصفحة</button>':""}
  <button data-act="share">مشاركة الرابط</button>
  ${S.admin||GH.on?'<button data-act="editp">تعديل النص</button>':'<button data-act="corr">اقتراح تصحيح</button>'}${isAdmin()?'<button data-act="bookmeta">بيانات الكتاب وقسمه</button><button data-act="eds">طبعات الكتاب</button>':""}
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
 const head=art?"":`<div class="rhead"><h2>${esc(b.title)}</h2><div class="mut"><a class="alink" href="#/author/${b.authorId}" data-author="${b.authorId}">${avatar(a,"sm")}${esc(a.name)}${died(a)}</a> • <a href="#/library?c=${bc(b)}&t=${b.topicId}">${esc(T(b.topicId).name)}</a> • ${COL[bc(b)]} • <button class="linkbtn" data-act="card">بطاقة الكتاب</button><span class="tjlink" data-tj="${esc(b.set||b.id)}"></span>${b.tkh?` • <a href="#/takhrij/${esc(b.id)}">📚 تخريج أحاديث الكتاب</a>`:""}</div>${b.card&&b.card.summary&&p===1?`<p class="rsum">${esc(b.card.summary)}</p>`:""}${b.demo?'<p class="note">هذا نص تجريبي يُستبدل بالنص المعتمد.</p>':""}${volStrip(b)}${typeof ED!=="undefined"?ED.strip(b):""}${typeof ITHRA!=="undefined"?ITHRA.note(b):""}</div>`;
 const ahead=art?`<div class="ahead"><h1>${esc(b.title)}</h1><div><a href="#/author/${b.authorId}" data-author="${b.authorId}">${esc(a.name)}</a>${b.date?" • "+fmtDate(b.date):""} • <a href="#/articles?t=${b.topicId}">${esc(T(b.topicId).name)}</a>${b.url?` • <a href="${esc(b.url)}" target="_blank" rel="noopener">المصدر</a>`:""}</div>${fatwa&&bc(b)!=="ithra"?'<div class="src-note">من فتاوى موقع صوت السلف</div>':""}${typeof ITHRA!=="undefined"?ITHRA.note(b):""}</div>`:"";
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
 if($("#scr")){let sec=$(`.spg[data-p="${p}"]`);if(!sec){const ps=[...$$("#scr .spg")].map(x=>+x.dataset.p);if(p===Math.min(...ps)-1)scrAdd(b,-1);else if(p===Math.max(...ps)+1)scrAdd(b,1);else{LASTREAD=null;go(`#/book/${b.id}/${p}`);return}sec=$(`.spg[data-p="${p}"]`)}
  if(sec){scrSet(b,p);scrollTo({top:sec.getBoundingClientRect().top+scrollY-(S.full?8:96),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}return}const h=parse().q.h;go(`#/book/${b.id}/${p}${h?"?h="+encodeURIComponent(h):""}`)}

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
const Q=Object.assign({bg:"id",plain:"#0f5c4d",idx:0,dim:.45,font:"Amiri",ink:"auto",logo:true,size:"1080x1080",fz:100,fw:400,lh:1.8,al:"center",sa:true,sb:true,wm:"corner",url:true},ls.get("qset",{}));
// المصدر «الكاتب — الكتاب، الصفحة»: يُظهر منه ما يختاره المستخدم
const qSrc=s=>{const p=String(s||"").split(" — ");return p.length<2?(Q.sa||Q.sb?s:""):[Q.sa&&p[0],Q.sb&&p.slice(1).join(" — ")].filter(Boolean).join(" — ")};
const SITEHOST=()=>siteLink("").replace(/^https?:\/\//,"").replace(/\/$/,"");let QIMG=null;
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
 const text=($("#qt").value.trim()||"…"),src=qSrc($("#qs").value.trim()),cm=$("#qc").value.trim(),A_=Object.assign({},st.area);
 if(Q.wm==="bar")A_.h-=40;
 const reserve=(src?70:0)+(cm?60:0);let fs=Math.round(W*.064*(Q.fz||100)/100),L;
 for(;fs>20;fs-=2){c.font=`${Q.fw||400} ${fs}px "${Q.font}", serif`;L=wrap(c,text,A_.w);if(L.length*fs*Q.lh<=A_.h-reserve)break}
 const jus=Q.al==="justify",lh=fs*Q.lh,blockH=L.length*lh+reserve,ax=Q.al==="right"||jus?A_.x+A_.w:Q.al==="left"?A_.x:W/2;let y=A_.y+(A_.h-blockH)/2+fs;c.textAlign=jus?"right":Q.al||"center";c.fillStyle=st.ink;
 // المحاذاة المستقيمة من الجانبين: توزيع الفراغ بين الكلمات، إلا السطر الأخير من كل فقرة
 const lastOf=new Set();{let k=0;text.split("\n").forEach(par=>{k+=wrap(c,par,A_.w).length;lastOf.add(k-1)})}
 L.forEach((l,i)=>{const w=l.split(" ");if(jus&&w.length>1&&!lastOf.has(i)){const ws=w.map(x=>c.measureText(x).width),gap=(A_.w-ws.reduce((a,b)=>a+b,0))/(w.length-1);let x=ax;w.forEach((x_,k)=>{c.fillText(x_,x,y);x-=ws[k]+gap})}else c.fillText(l,ax,y);y+=lh});
 if(src){y+=14;c.fillStyle=st.acc;c.font=`600 ${Math.round(fs*.55)}px "IBM Plex Sans Arabic", sans-serif`;c.fillText("— "+src,ax,y);y+=50}
 if(cm){c.fillStyle=st.ink;c.globalAlpha=.85;c.font=`${Math.round(fs*.5)}px "IBM Plex Sans Arabic", sans-serif`;c.fillText(cm,ax,y);c.globalAlpha=1}
 c.textAlign="center";
 // بصمة هوية المكتبة (لا تُلغى): زاوية، أو شريط سفلي، أو علامة مائية على كامل الصورة مع الزاوية
 if(Q.wm==="tile"){c.save();c.globalAlpha=.07;c.fillStyle=st.ink;c.font=`600 30px "IBM Plex Sans Arabic", sans-serif`;c.textAlign="center";c.translate(W/2,H/2);c.rotate(-Math.PI/6);for(let yy=-H;yy<H;yy+=170)for(let xx=-W;xx<W;xx+=560)c.fillText(SITENAME,xx+(yy/170%2?280:0),yy);c.restore()}
 const host=Q.url?SITEHOST():"";
 if(Q.wm==="bar"){const bh=86;c.fillStyle="rgba(255,255,255,.93)";c.fillRect(0,H-bh,W,bh);if(emb)c.drawImage(emb,W-bh-14,H-bh+8,bh-16,bh-16);c.fillStyle="#0a4a50";c.textAlign="right";c.font=`600 28px "IBM Plex Sans Arabic", sans-serif`;c.fillText(SITENAME,W-bh-26,H-bh/2+(host?-4:10));if(host){c.font=`500 21px "IBM Plex Sans Arabic", sans-serif`;c.fillStyle="#5b6b66";c.fillText(host,W-bh-26,H-bh/2+26)}}
 else{c.font=`600 27px "IBM Plex Sans Arabic", sans-serif`;const tw=c.measureText(SITENAME).width,ph=100,pw=tw+ph+30,px=34,py=H-ph-34;
 c.fillStyle="rgba(255,255,255,.9)";c.beginPath();c.roundRect?c.roundRect(px,py,pw,ph,16):c.rect(px,py,pw,ph);c.fill();
 if(emb)c.drawImage(emb,px+pw-ph+6,py+6,ph-12,ph-12);c.fillStyle="#0a4a50";c.textAlign="right";c.fillText(SITENAME,px+pw-ph+2,py+ph/2+(host?-2:10));if(host){c.font=`500 20px "IBM Plex Sans Arabic", sans-serif`;c.fillStyle="#5b6b66";c.fillText(host,px+pw-ph+2,py+ph/2+28)}}
 if(Q.logo&&logo){const lw=92,lh2=lw*logo.height/logo.width;c.fillStyle="rgba(255,255,255,.92)";c.beginPath();c.roundRect?c.roundRect(W-lw-50,36,lw+16,lh2+16,12):c.rect(W-lw-50,36,lw+16,lh2+16);c.fill();c.drawImage(logo,W-lw-42,44,lw,lh2)}
 // هوية جهة الداعية أو المركز (اختيارية، محفوظة على جهازه): شعارها واسمها أعلى يسار التصميم
 const org=ls.get("qorg",{});if(org.n||org.img){let oi=null;if(org.img){oi=ORGIMG&&ORGIMG.src===org.img?ORGIMG:await new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=org.img});ORGIMG=oi}if(my!==drawing)return;
  c.font=`600 26px "IBM Plex Sans Arabic", sans-serif`;const nw=org.n?c.measureText(org.n).width:0,ih=oi?86:0,bw=nw+ih+(nw&&ih?18:0)+28,bh=Math.max(ih,40)+16,bx=34,by=36;
  c.fillStyle="rgba(255,255,255,.92)";c.beginPath();c.roundRect?c.roundRect(bx,by,bw,bh,14):c.rect(bx,by,bw,bh);c.fill();
  if(oi){const r=Math.min(ih/oi.width,ih/oi.height);c.drawImage(oi,bx+14,by+8+(ih-oi.height*r)/2,oi.width*r,oi.height*r)}
  if(org.n){c.fillStyle="#14231f";c.textAlign="left";c.fillText(org.n,bx+14+(ih?ih+18:0),by+bh/2+9)}}}
let ORGIMG=null;
function quoteText(){const t=$("#qt").value.trim(),s=qSrc($("#qs").value.trim());const link=Q.url?siteLink(pendingQ&&pendingQ.ref?`#/book/${pendingQ.ref.b}/${pendingQ.ref.p}`:""):"";
 return`«${t}»`+(s?`\n— ${s}`:"")+`\n${SITENAME}`+(link?`\n${link}`:"")}
async function vQabasat(q){const pq=pendingQ;
 view(`<h2>قبسات</h2><p class="mut">اختر مقتطفًا يرشحه الموقع، أو اكتب قبستك، أو حدّد نصًا في أي كتاب واضغط «اجعل المحدد قبسة».</p>
 <div class="row"><select id="qf" aria-label="مصدر المقتطفات" style="max-width:260px"><option value="">كل المكتبة</option><option value="dawah">مكتبة الدعوة</option><option value="articles">المقالات</option><option value="turath">المكتبة العامة</option></select><button class="btn" data-act="moreSug">مقتطفات أخرى</button></div>
 <div id="sugl"><p class="mut">جارٍ اختيار مقتطفات…</p></div>
 <h2>صمّم الاقتباس</h2><div class="studio">
 <label for="qt">النص</label><textarea id="qt"></textarea>
 <details class="qorg"><summary>هوية جهتك على التصميم (للدعاة والمراكز والصفحات)</summary><div class="row"><div><label for="qorgn">اسم الجهة</label><input id="qorgn" maxlength="60" value="${esc((ls.get("qorg",{})).n||"")}" placeholder="مثال: مسجد التوحيد"></div><div><label for="qorgl">شعار الجهة</label><input id="qorgl" type="file" accept="image/*"></div></div><button class="btn s" type="button" data-act="qorgx">إزالة هوية الجهة</button><p class="mut" style="font-size:.8rem">تُحفظ على جهازك وتظهر أعلى التصميم بجوار شعار المكتبة.</p></details>
 <div class="row"><div><label for="qs">المصدر (الكاتب والكتاب)</label><input id="qs"></div><div><label for="qc">تعليق (اختياري)</label><input id="qc" placeholder="تعليق قصير يظهر أسفل القبسة"></div></div>
 <div class="row"><div><label for="qfont">خط القبسة</label><select id="qfont">${fontOpts(Q.font)}</select></div><div><label for="qz">المقاس</label><select id="qz"><option value="1080x1080">مربع للمنشورات</option><option value="1080x1350">طولي للمنشورات</option><option value="1080x1920">قصص وحالات</option><option value="1600x900">عرضي</option></select></div><div><label for="qi">لون الكتابة</label><select id="qi"><option value="auto">تلقائي</option><option value="light">فاتح</option><option value="dark">داكن</option></select></div></div>
 <label>الخلفية</label><div class="tabs" role="tablist" id="qbt"><button role="tab" data-bg="id">هوية المكتبة</button><button role="tab" data-bg="plain">لون سادة</button><button role="tab" data-bg="photo">صورة من جهازك</button></div>
 <div id="qp-id" class="ids" style="margin-top:8px"></div>
 <div id="qp-plain" class="row" style="margin-top:8px"><div class="swatches nf">${PLAINS.map(p=>`<button class="sw" data-plain="${p}" aria-label="لون ${p}" style="background:${p}"></button>`).join("")}</div><input type="color" id="qcol" value="${Q.plain}" aria-label="لون مخصص" class="nf"></div>
 <div id="qp-photo" style="margin-top:8px"><input type="file" id="qimg" accept="image/*" aria-label="اختر صورة"><label for="qdim">تعتيم الصورة لوضوح النص</label><input type="range" id="qdim" min="0" max=".8" step=".05" value="${Q.dim}"></div>
 <fieldset class="secs"><legend>تنسيق النص</legend><div class="row"><div><label for="qfz">حجم الخط <output id="qfzv">${Q.fz}٪</output></label><input type="range" id="qfz" min="60" max="150" step="5" value="${Q.fz}"></div><div><label for="qlh">تباعد الأسطر <output id="qlhv">${Q.lh}</output></label><input type="range" id="qlh" min="1.3" max="2.6" step=".1" value="${Q.lh}"></div><div><label for="qal">المحاذاة</label><select id="qal"><option value="center">وسط</option><option value="right">يمين</option><option value="left">يسار</option><option value="justify">مستقيمة من الجانبين</option></select></div><div><label for="qfw">سُمك الخط</label><select id="qfw"><option value="400">عادي</option><option value="700">عريض</option></select></div></div>
 <label class="inl"><input type="checkbox" id="qsa"${Q.sa?" checked":""}> اسم الكاتب</label><label class="inl"><input type="checkbox" id="qsb"${Q.sb?" checked":""}> اسم الكتاب والصفحة</label><label class="inl"><input type="checkbox" id="qurl"${Q.url?" checked":""}> رابط الموقع</label></fieldset>
 <div class="row"><div><label for="qwm">بصمة هوية المكتبة</label><select id="qwm"><option value="corner">ختم في الزاوية</option><option value="bar">شريط سفلي</option><option value="tile">علامة مائية على كامل الصورة</option></select></div></div>
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
 $("#qal").value=Q.al;$("#qwm").value=Q.wm;$("#qfw").value=String(Q.fw||400);$("#qfw").onchange=e=>{Q.fw=+e.target.value;saveQ();draw()};
 $("#qfz").oninput=e=>{Q.fz=+e.target.value;$("#qfzv").textContent=toAr(Q.fz)+"٪";saveQ();draw()};$("#qlh").oninput=e=>{Q.lh=+e.target.value;$("#qlhv").textContent=toAr(Q.lh);saveQ();draw()};
 [["qal","al"],["qwm","wm"]].forEach(([i,k])=>$("#"+i).onchange=e=>{Q[k]=e.target.value;saveQ();draw()});[["qsa","sa"],["qsb","sb"],["qurl","url"]].forEach(([i,k])=>$("#"+i).onchange=e=>{Q[k]=e.target.checked;saveQ();draw()});
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
const Auth={mode:"local",sb:null,user:null,token:null,ready:false,
 async init(){try{await this._init()}finally{this.ready=true}},
 async _init(){
  if(CFG.supabaseUrl&&CFG.supabaseAnonKey){
   try{let ok=false;for(const u of["vendor/supabase.js","https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.75.0/dist/umd/supabase.js","https://unpkg.com/@supabase/supabase-js@2.75.0/dist/umd/supabase.js"]){try{await loadScript(u);if(window.supabase&&window.supabase.createClient){ok=true;break}}catch(e){}}if(!ok)throw new Error("تعذر تحميل مكتبة الحسابات");
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
 async phoneOtp(phone){const {error}=await this.sb.auth.signInWithOtp({phone});if(error)throw error},
 async phoneVerify(phone,token){const {data,error}=await this.sb.auth.verifyOtp({phone,token,type:"sms"});if(error)throw error;this.set(data.session);Cloud.loadRole()},
 async emailLink(email,next){ls.set("authNext",next||"#/ask");const {error}=await this.sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});if(error)throw error},
 async resetPw(email){const {error}=await this.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+"#/account?m=newpw"});if(error)throw error},
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
 if(Auth.user&&q.m==="newpw"){view(`<h2>تعيين كلمة مرور جديدة</h2><form data-form="newpw"><label>كلمة المرور الجديدة</label><input name="pw" type="password" minlength="8" required dir="ltr" autocomplete="new-password"><label>تأكيدها</label><input name="pw2" type="password" minlength="8" required dir="ltr" autocomplete="new-password"><button class="btn p" style="margin-top:12px">حفظ</button></form><p id="aerr" role="alert"></p>`);return}
 if(Auth.user){view(`<h2>حسابي</h2><div class="card"><b>${esc(Auth.user.name||"")}</b><span>${esc(Auth.user.email||"")}</span></div>
  ${Auth.mode==="local"?'<p class="note">وضع تجريبي: الحساب ومحادثاته محفوظة على هذا الجهاز فقط. بعد ربط الموقع بقاعدة البيانات تصبح الحسابات حقيقية ومتزامنة بين الأجهزة.</p>':""}
  <div class="row" style="margin:10px 0"><a class="btn p nf" href="#/ask">اسأل المكتبة</a><a class="btn nf" href="#/favs">المفضلة</a><a class="btn nf" href="#/mine">مكتبتي: العلامات والتعليقات</a><a class="btn nf" href="#/hifz">حفظ المتون</a><a class="btn nf" href="#/dm">الرسائل الخاصة</a><button class="btn nf" data-act="logout">تسجيل الخروج</button></div>
  <h2>محادثاتي</h2><div id="convs" class="mut">جارٍ التحميل…</div>`);
  Chats.list().then(l=>{$("#convs").innerHTML=l.length?l.map(c=>`<a class="bk" href="#/ask?id=${encodeURIComponent(c.id)}"><b>${esc(c.title||"محادثة")}</b><span>${esc((c.updated_at||"").slice(0,10))}</span></a>`).join(""):"لا توجد محادثات بعد."}).catch(()=>{$("#convs").textContent="تعذر تحميل المحادثات."});return}
 if(!Auth.ready&&CFG.supabaseUrl){view(`<h2>تسجيل الدخول</h2><p class="mut">جارٍ تجهيز خدمة الحسابات…</p>`);const t=setInterval(()=>{if(Auth.ready){clearInterval(t);if(parse().p[0]==="account")route()}},200);return}
 const signup=q.m==="signup",back=q.next||"#/ask",cloud=Auth.mode==="cloud";
 view(`<h2>${signup?"إنشاء حساب":"تسجيل الدخول"}</h2>
 <div class="atabs"><a class="${signup?"":"on"}" href="#/account?next=${encodeURIComponent(back)}">دخول</a><a class="${signup?"on":""}" href="#/account?m=signup&next=${encodeURIComponent(back)}">حساب جديد</a></div>
 <div class="perks"><b>مزايا الأعضاء</b><ul><li>«اسأل المكتبة»: مساعد بحثي يجيب من نصوص المكتبة ويحيل إلى الكتاب والصفحة.</li><li>إعداد بحث علمي موثق في أي مسألة.</li><li>شرح أي صفحة أو مقال بضغطة من القارئ.</li><li>حفظ محادثاتك والرجوع إليها من أي جهاز.</li></ul></div>
 ${cloud?`<div id="oauthw"></div>`:''}
 <form data-form="${signup?"signup":"signin"}" data-next="${esc(back)}">${signup?'<label>اسم العضو (يظهر في الموقع)</label><input name="name" required minlength="2" maxlength="40" autocomplete="nickname" placeholder="مثال: عبد الله المصري">':""}
 <label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="email">
 ${cloud?`<label>كلمة المرور${signup?" (ثمانية أحرف على الأقل)":""}</label><div class="pwrow"><input name="pw" type="password" minlength="8" required dir="ltr" autocomplete="${signup?"new-password":"current-password"}"><button type="button" class="lnk" data-act="pwshow" aria-label="إظهار كلمة المرور">👁</button></div>${signup?'<label>تأكيد كلمة المرور</label><input name="pw2" type="password" minlength="8" required dir="ltr" autocomplete="new-password">':`<p class="mut" style="margin:6px 0 0"><a href="javascript:void 0" data-act="pwreset">نسيت كلمة المرور؟</a></p>`}`:""}
 <p class="mut" style="margin:8px 0 0">${cloud?"يبقى دخولك محفوظًا على هذا الجهاز، فلا تحتاج إلى الدخول كل مرة، حتى تختار «تسجيل الخروج».":""}</p>
 <button class="btn p" style="margin-top:12px">${signup?"إنشاء الحساب":"دخول"}</button></form><p id="aerr" role="alert"></p>${CFG.supabaseUrl&&!cloud?`<p class="note">تعذر تحميل خدمة الحسابات${Auth.loadErr?" ("+esc(Auth.loadErr)+")":""}، فيعمل الحساب على هذا الجهاز فقط. أعد تحميل الصفحة بعد قليل.</p>`:""}
 <p>${signup?`لديك حساب؟ <a href="#/account?next=${encodeURIComponent(back)}">سجّل الدخول</a>`:`ليس لديك حساب؟ <a href="#/account?m=signup&next=${encodeURIComponent(back)}">أنشئ حسابًا مجانيًا</a>`}</p>
 ${cloud?"":'<p class="note">وضع تجريبي: لم تُربط قاعدة الحسابات بعد، فيُحفظ الحساب على هذا الجهاز فقط ودون كلمة مرور.</p>'}`);
 if(cloud)Auth.providers().then(p=>{const w=$("#oauthw");if(!w)return;
  w.innerHTML=`<div class="oauth"><button data-oauth="google"${p.google?"":' data-off="1"'}>${GICON} ${signup?"إنشاء حساب":"الدخول"} بحساب Gmail (Google) مباشرة</button>${p.apple?'<button class="apple" data-oauth="apple">المتابعة بحساب Apple</button>':""}${p.phone?'<button data-alt="phone">📱 الدخول برقم الهاتف</button>':""}<button data-alt="link">✉️ رابط دخول إلى بريدي (دون كلمة مرور)</button></div><div id="altw"></div><div class="or">أو ${signup?"أنشئ حسابًا":"ادخل"} بالبريد وكلمة المرور</div>`;
  $$("[data-oauth]").forEach(b=>b.onclick=async()=>{if(b.dataset.off){$("#aerr").textContent="الدخول بحساب Gmail قيد التفعيل؛ استخدم البريد وكلمة المرور الآن، ويمكنك لاحقًا الدخول بـ Gmail بالبريد نفسه.";return}try{await Auth.oauth(b.dataset.oauth,back)}catch(e){$("#aerr").textContent=authMsg(e)}});
  $$("[data-alt]").forEach(b=>b.onclick=()=>altLogin(b.dataset.alt,back))})}
// الدخول برقم الهاتف (رمز SMS) أو برابط يُرسل إلى البريد
function altLogin(kind,back){const w=$("#altw"),err=$("#aerr");err.textContent="";
 if(kind==="link"){w.innerHTML=`<div class="card"><label>بريدك الإلكتروني</label><input id="lkem" type="email" autocomplete="email" dir="ltr"><button class="btn p" id="lkgo" style="margin-top:8px">أرسل رابط الدخول</button></div>`;
  $("#lkgo").onclick=async()=>{const em=$("#lkem").value.trim();if(!em)return;try{await Auth.emailLink(em,back);w.innerHTML='<p class="note">أرسلنا رابط الدخول إلى بريدك؛ افتحه من هذا الجهاز وستدخل مباشرة. (تفقد مجلد الرسائل غير المرغوبة)</p>'}catch(e){err.textContent=authMsg(e)}};return}
 w.innerHTML=`<div class="card"><label>رقم الهاتف مع رمز الدولة</label><input id="ph" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="+9665xxxxxxxx"><button class="btn p" id="phgo" style="margin-top:8px">أرسل رمز التحقق</button><div id="phv" hidden><label>الرمز الذي وصلك</label><input id="phc" inputmode="numeric" autocomplete="one-time-code" dir="ltr"><button class="btn p" id="phok" style="margin-top:8px">تأكيد الدخول</button></div></div>`;
 const num=()=>{let v=$("#ph").value.replace(/[\s\-()]/g,"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));if(v.startsWith("00"))v="+"+v.slice(2);return v};
 $("#phgo").onclick=async()=>{const n=num();if(!/^\+\d{8,15}$/.test(n)){err.textContent="اكتب الرقم كاملًا مع رمز الدولة، مثل +9665xxxxxxxx";return}try{await Auth.phoneOtp(n);$("#phv").hidden=false;err.textContent="أرسلنا رمزًا إلى هاتفك."}catch(e){err.textContent=authMsg(e)}};
 $("#phok").onclick=async()=>{try{await Auth.phoneVerify(num(),$("#phc").value.trim());paintAuth();location.hash=back}catch(e){err.textContent=authMsg(e)}}}
// حماية كلمات المرور: طول كافٍ، ورفض كلمات المرور المسرّبة (فحص Have I Been Pwned بطريقة إخفاء الهوية: يُرسل أول 5 أحرف من بصمة SHA-1 فقط)
async function pwCheck(pw){pw=String(pw||"");if(pw.length<8)throw new Error("كلمة المرور قصيرة: ثمانية أحرف على الأقل.");
 if(/^(.)\1+$/.test(pw)||/^(12345678|123456789|password|qwertyui)/i.test(pw))throw new Error("كلمة المرور سهلة التخمين؛ اختر غيرها.");
 try{const h=[...new Uint8Array(await crypto.subtle.digest("SHA-1",new TextEncoder().encode(pw)))].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
  const r=await fetch("https://api.pwnedpasswords.com/range/"+h.slice(0,5),{headers:{"Add-Padding":"true"}});if(!r.ok)return;
  const t=await r.text();if(t.split("\n").some(l=>{const [suf,c]=l.trim().split(":");return suf===h.slice(5)&&+c>0}))throw new Error("كلمة المرور هذه ظهرت في تسريبات بيانات سابقة على الإنترنت، فاختر كلمة مرور أخرى لحماية حسابك.")}
 catch(e){if(/تسريبات/.test(e.message))throw e}}
const AUTHERR=[[/invalid login credentials/i,"البريد أو كلمة المرور غير صحيحة. إن لم يكن لك حساب بعد فاضغط «أنشئ حسابًا مجانيًا»."],[/email not confirmed/i,"لم يُؤكَّد بريدك بعد؛ افتح رسالة التأكيد في بريدك ثم سجّل الدخول."],[/already registered|already exists/i,"هذا البريد مسجّل من قبل؛ سجّل الدخول به."],[/password should be at least|weak password/i,"كلمة المرور قصيرة؛ اجعلها 8 أحرف على الأقل."],[/rate limit|too many/i,"محاولات كثيرة؛ انتظر دقيقة ثم أعد المحاولة."],[/invalid.*email|email.*invalid/i,"صيغة البريد غير صحيحة."],[/failed to fetch|network/i,"تعذر الاتصال بخادم الحسابات؛ تأكد من الإنترنت."],[/provider is not enabled|unsupported.*provider|phone.*disabled|sms.*provider/i,"هذه الطريقة لم تُفعَّل بعد في إعدادات الموقع."],[/token has expired|invalid.*otp|otp.*invalid/i,"الرمز غير صحيح أو انتهت صلاحيته؛ اطلب رمزًا جديدًا."]];
const authMsg=e=>{const m=String((e&&(e.message||e.error_description))||e||"");const t=AUTHERR.find(([r])=>r.test(m));return t?t[1]:(m?"تعذر الدخول: "+m:"تعذر الدخول")};
// إظهار كلمة المرور، واستعادتها بالبريد، وتعيين كلمة جديدة بعد رابط الاستعادة
document.addEventListener("click",async e=>{const a=e.target.closest('[data-act="pwshow"],[data-act="pwreset"]');if(!a)return;e.preventDefault();
 if(a.dataset.act==="pwshow"){const i=a.parentNode.querySelector("input");i.type=i.type==="password"?"text":"password";return}
 const f=a.closest("form"),em=f&&f.email&&f.email.value.trim(),err=$("#aerr");if(!em){err.textContent="اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور؟».";return}
 try{await Auth.resetPw(em);err.textContent="أرسلنا إلى بريدك رابطًا لتعيين كلمة مرور جديدة؛ افتحه من هذا الجهاز. (تفقد مجلد الرسائل غير المرغوبة)"}catch(x){err.textContent=authMsg(x)}});
document.addEventListener("submit",async e=>{const f=e.target.closest('[data-form="newpw"]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();const err=$("#aerr");
 try{if(f.pw.value!==f.pw2.value)throw new Error("كلمتا المرور غير متطابقتين.");await pwCheck(f.pw.value);const {error}=await Auth.sb.auth.updateUser({password:f.pw.value});if(error)throw error;toast("حُفظت كلمة المرور الجديدة");location.hash="#/account"}catch(x){err.textContent=authMsg(x)}},true);
async function authSubmit(f,kind){const fd=new FormData(f),err=$("#aerr"),btn=f.querySelector("button"),old=btn.textContent;err.textContent="";btn.disabled=true;btn.textContent=kind==="signup"?"جارٍ إنشاء الحساب…":"جارٍ الدخول…";
 const slow=setTimeout(()=>{err.textContent="الخادم بطيء في الرد… انتظر قليلًا."},12000);
 try{if(kind==="signup"&&fd.get("pw2")!==null&&fd.get("pw2")!==fd.get("pw"))throw new Error("كلمتا المرور غير متطابقتين.");if(kind==="signup"){const r=await Auth.signUp(String(fd.get("name")).trim(),String(fd.get("email")).trim(),fd.get("pw")||"");if(r==="confirm"){err.textContent="أرسلنا رابط تأكيد إلى بريدك، افتحه ثم سجّل الدخول.";return}}
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
   if(!r.ok)throw{code:"server",message:(j.error==="paused"&&j.message)||j.error||(r.status===404?"خدمة المساعد لم تُفعَّل على هذا الخادم بعد.":"تعذرت الإجابة، حاول لاحقًا.")};o.onText(j.text||"");o.searches=j.searches;return j.text||""}
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
let SWX=null;const swx=async()=>{if(SWX)return SWX;try{const r=await fetch("data/switches.json");SWX=r.ok?((await r.json()).s||{}):{}}catch(e){SWX={}}return SWX};
const pausedNote=n=>`<div class="note warn" role="status">خدمة «${n}» متوقفة مؤقتًا، ونعمل على إعادتها قريبًا بإذن الله. يمكنك في هذه الأثناء استعمال <a href="#/search">البحث في نصوص المكتبة</a>.</div>`;
async function vAsk(q){
 if(q.id&&Auth.user){try{CONV=(await Chats.get(q.id))||newConv()}catch(e){CONV=newConv()}}else if(!CONV||q.new||q.b||q.q||q.a||q.m)CONV=newConv();
 if(q.m&&SS.MODES[q.m])CONV.mode=q.m;
 let pre="";if(q.b&&B(q.b)){CONV.mode="explain";CONV.bookId=q.b;CONV.ctx={b:q.b,p:+q.p||1};pre=isArt(B(q.b))?"اشرح هذا المقال ولخّص أهم مسائله":"اشرح هذه الصفحة"}else if(q.q)pre=q.q;else if(q.a)pre=`ما أهم الموضوعات في كتب ${A(q.a).name}؟`;
 if((await swx()).ask===false)setTimeout(()=>{const el=$("#app");if(el&&!el.querySelector(".note.warn"))el.insertAdjacentHTML("afterbegin",pausedNote("المساعد العلمي"))},0);
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
 const q=document.createElement("button");q.className="btn s";q.textContent="صمّم الاقتباس";q.onclick=()=>{const t=plain(body.replace(/\[\[[^\]]+\]\]/g,"").replace(/^#+\s*/gm,"").replace(/\*\*/g,"")).trim();pendingQ={t:t.length>600?t.slice(0,600)+"…":t,src:"المساعد العلمي — "+SITENAME};location.hash="#/qabasat"};
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
const tCount=id=>lib.books.filter(b=>inTopic(b,id)&&!VOL2(b)).length;
function topicRows(list,kind){return list.map(t=>{const n=tCount(t.id);return`<div class="trow" data-id="${esc(t.id)}" data-kind="${kind}"><input class="tn" value="${esc(t.name)}" aria-label="اسم القسم">${kind==="articles"?`<input class="tp" value="${esc(t.parent||"")}" placeholder="القسم الأعلى (اختياري)" aria-label="القسم الأعلى">`:""}<span class="mut tc">${toAr(n)}</span><button type="button" class="btn s" data-act="tup" aria-label="أعلى">▲</button><button type="button" class="btn s" data-act="tdown" aria-label="أسفل">▼</button><button type="button" class="btn s" data-act="tdel"${n?' disabled title="انقل ما فيه أولًا"':""}>حذف</button></div>`}).join("")}
function structBody(){const L=CAT.labels||{};
 return`${needGH()}<form data-form="struct">
 <h3>الأقسام الرئيسية</h3><div class="row"><div><label>اسم مكتبة الدعوة</label><input name="col_dawah" value="${esc(COL.dawah)}"></div><div><label>اسم المكتبة العامة</label><input name="col_turath" value="${esc(COL.turath)}"></div></div>
 <details><summary>أسماء روابط القائمة العليا</summary><div class="navl">${NAVDEF.map(([h,t])=>`<label>${esc(t)}</label><input name="nav:${esc(h)}" value="${esc(L["nav:"+h]||t)}">`).join("")}</div></details>
 <h3>التقسيم الموضوعي للكتب</h3><p class="mut">غيّر الأسماء، ورتّبها بالأسهم، واحذف الفارغ منها. الرقم عدد الكتب في القسم.</p>
 <div class="tlist" id="tl-books">${topicRows(lib.topics.filter(t=>t.for!=="articles"),"books")}</div><button type="button" class="btn s" data-act="tadd" data-kind="books">+ قسم جديد للكتب</button>
 <h3>تصنيفات المقالات والفتاوى</h3>
 <div class="tlist" id="tl-articles">${topicRows(lib.topics.filter(t=>t.for==="articles"),"articles")}</div><button type="button" class="btn s" data-act="tadd" data-kind="articles">+ تصنيف جديد للمقالات</button>
 <div class="savebar"><button class="btn p">حفظ الأقسام والأسماء</button><span id="structst" class="mut" role="status"></span></div></form>
 <h3>المؤلفون</h3><form data-form="authedit"><label>اختر المؤلف</label><select name="id" id="aesel"><option value="">— اختر —</option>${[...lib.authors].sort((x,y)=>x.name.localeCompare(y.name,"ar")).map(a=>`<option value="${a.id}">${esc(a.name)} (${a.col==="turath"?"العامة":"الدعوة"})</option>`).join("")}</select>
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
// يرفع ملف PDF واحدًا إلى صندوق التحويل مع إعداداته (cfg): مخزن الموقع أولًا، وإلا أجزاء في المستودع. يستعمله رفع الكتب المصورة ورفع المجلدات
async function pdfUpload(file,base,cfg,say){say=say||(()=>{});
   await GH.put("ocr-inbox/"+base+".json",JSON.stringify(cfg,null,1),"إعدادات كتاب مصور: "+cfg.title);
   // الأسرع: رفع الملف كاملًا إلى مخزن الموقع (Supabase Storage) دفعة واحدة، ثم رابط تنزيل مؤقت يأخذه التحويل
   let viaStore=false;if(GH.proxied&&Cloud.on()&&file.size<=50*1048576){try{say(`جارٍ رفع ${cfg.title} (${toAr(Math.round(file.size/1048576))} ميجابايت)…`);
    const S_=Auth.sb.storage.from("inbox"),{error:ue}=await S_.upload(base+".pdf",file,{contentType:"application/pdf",upsert:true});if(ue)throw ue;
    // لا يُحفظ رابط موقَّع في المستودع العام: يُحفظ اسم الملف فقط، ويطلب التحويل رابطًا مؤقتًا من الخادم
    await GH.put("ocr-inbox/"+base+".store",base+".pdf","ملف كتاب مصور: "+cfg.title,null);await GH.put("ocr-inbox/"+base+".ready","0","اكتمل رفع: "+cfg.title,null);viaStore=true}catch(e){console.warn("storage upload",e)}}
   if(viaStore)return "store";
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(GH.proxied){const CH=2500000,n=Math.ceil(bytes.length/CH);for(let k=0;k<n;k++){say(`جارٍ رفع ${cfg.title}: الجزء ${toAr(k+1)} من ${toAr(n)}…`);await GH.put("ocr-inbox/"+base+".pdf.part"+String(k+1).padStart(3,"0"),bytes.subarray(k*CH,(k+1)*CH),"رفع كتاب مصور (جزء "+(k+1)+"): "+cfg.title,null)}
    await GH.put("ocr-inbox/"+base+".ready",String(n),"اكتمل رفع: "+cfg.title,null)}
   else await GH.put("ocr-inbox/"+base+".pdf",bytes,"رفع كتاب مصور: "+cfg.title);
   return "repo"}
async function ghPdf(f){const fd=new FormData(f),files=fd.getAll("file").filter(x=>x&&x.size),st=$("#pdfst");if(!files.length)return;
 const big=files.filter(x=>x.size>45*1048576);if(big.length){st.textContent="ملفات أكبر من 45 ميجابايت: "+big.map(x=>x.name).join("، ")+". قسّمها أو ارفعها إلى مجلد ocr-inbox مباشرة.";return}
 const btn=f.querySelector("button");btn.disabled=true;const done=[],link=files.length===1?fd.get("book"):"";
 const tags=[];if(fd.get("tafrigh"))tags.push("tafrigh");fd.getAll("furqan").forEach(n=>tags.push("furqan:"+n));
 let author0=String(fd.get("author")||"");if(author0==="__new")author0=String(fd.get("authornew")||"").trim();else if(author0)author0=A(author0).name;
 try{for(let i=0;i<files.length;i++){const file=files[i],nm=file.name.replace(/\.pdf$/i,"").replace(/[_]+/g," ").trim(),parts=nm.split(/\s+-\s+/);
   st.textContent=`جارٍ رفع ${files.length>1?"الكتاب "+toAr(i+1)+" من "+toAr(files.length)+": ":""}${nm}…`;
   const base="up"+Date.now().toString(36)+i,cfg={title:(files.length===1&&String(fd.get("title")||"").trim())||parts[0],author:author0||parts[1]||undefined,topic:fd.get("tid"),col:fd.get("col"),offset:+fd.get("off")||0,ocr:link?!!fd.get("ocr"):true};
   if(tags.length)cfg.tags=tags;if(link)cfg.book=link;
   await pdfUpload(file,base,cfg,t=>st.textContent=t);done.push(cfg.title)}
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
/* متابعة إنجاز الكتب: نسبة كل كتاب من رفعه حتى اكتمال خدماته، ووقته المتوقع، وما يعمل الآن (data/progress.json تحدّثه مهمة progress.yml) */
const PRG_WF={"تحويل الكتب المصورة إلى نص":"التحويل والتدقيق","تشكيل الكتب (تشكيل مدقق نحويًا ولغويًا)":"التشكيل","انتقاء منشورات المشايخ وتدقيق سؤال وجواب":"انتقاء الفوائد وسؤال وجواب","تشجير الكتب (للكتب التي تختارها الإدارة)":"التشجير","فحص الآيات في الكتب":"فحص الآيات","صوتيات المكتبة (تحويل النص إلى صوت)":"الصوتيات","الفهارس الفنية (الآيات والأحاديث والأعلام)":"الفهارس الفنية","بطاقات التعريف بالكتب":"بطاقات التعريف"};
async function progAdmin(){const el=$("#progadm");if(!el)return;let P=null,runs=[];
 try{const r=await fetch("https://raw.githubusercontent.com/"+GH.repo+"/main/data/progress.json?t="+Date.now());if(r.ok)P=await r.json()}catch(e){}
 try{const r=await fetch("https://api.github.com/repos/"+GH.repo+"/actions/runs?status=in_progress&per_page=30");if(r.ok)runs=((await r.json()).workflow_runs||[]);const q=await fetch("https://api.github.com/repos/"+GH.repo+"/actions/runs?status=queued&per_page=30");if(q.ok)runs=runs.concat(((await q.json()).workflow_runs||[]).map(x=>Object.assign(x,{_q:1})))}catch(e){}
 if(!P){el.innerHTML='<p class="note">لم تُحسب المتابعة بعد؛ تظهر بعد أول تشغيل لمهمة «متابعة إنجاز الكتب».</p>';return}
 const days=d=>d==null?"غير معروف بعد":d<1?"أقل من يوم":"نحو "+toAr(Math.ceil(d))+" "+(Math.ceil(d)<=10&&Math.ceil(d)>2?"أيام":"يوم");
 const bar=(p,c)=>`<div style="height:10px;border-radius:6px;background:var(--line,#ddd);overflow:hidden;margin:6px 0"><div style="height:100%;width:${Math.max(2,p)}%;background:${c||"var(--acc,#2a7)"}"></div></div>`;
 const act=runs.filter(r=>PRG_WF[r.name]).map(r=>`<li>${r._q?"⏳ ينتظر دوره":"⚙️ يعمل الآن"}: <b>${esc(PRG_WF[r.name])}</b> <small class="mut">منذ ${toAr(Math.max(1,Math.round((Date.now()-new Date(r.run_started_at||r.created_at))/60000)))} دقيقة</small></li>`).join("");
 const bk=Object.entries(P.books||{}).sort((a,b)=>a[1].pct-b[1].pct);
 const avg=bk.length?bk.reduce((s,x)=>s+x[1].pct,0)/bk.length:0;
 el.className="";el.innerHTML=`<p class="mut">نسبة كل كتاب من لحظة رفعه حتى اكتمال تحويله وتدقيقه وفحص آياته وتشكيله وخدماته (الفوائد، وسؤال وجواب، والتشجير، والفهارس، والصوتيات). تُحدَّث آليًا بعد كل مهمة وكل ست ساعات. آخر تحديث: ${esc(P.upd||"")} (بتوقيت غرينتش).</p>
 <div class="card"><b>مكتبة الدعوة إجمالًا: ${toAr(Math.round(avg))}٪</b>${bar(avg)}<small class="mut">${toAr(bk.length)} كتابًا • صفحات تنتظر التدقيق: ${toAr(P.pending_pages||0)}${P.speed?` • سرعة التدقيق: نحو ${toAr(Math.round(P.speed))} صفحة يوميًا`:""}</small></div>
 ${act?`<div class="card"><b>الآن</b><ul style="margin:6px 0 0">${act}</ul></div>`:'<p class="mut">لا مهمة تعمل الآن.</p>'}
 ${(P.inbox||[]).map(x=>`<div class="bk"><b>${esc(x.t)}</b><span>${toAr(x.pct)}٪ • ${esc(x.next)}</span>${bar(x.pct,"#c90")}</div>`).join("")}
 ${bk.map(([id,x])=>`<div class="bk"><b><a href="#/book/${id}/1">${esc(x.t)}</a> — ${toAr(Math.round(x.pct))}٪</b>${bar(x.pct,x.pct>=99?"#2a7":x.pct>=60?"#39c":"#c90")}<span>التالي: ${esc(x.next)} • المتوقع: ${x.pct>=99.5?"اكتمل":days(x.eta)}${x.path?" • ضمن مسار علمي":""}</span>
  <details style="margin-top:4px"><summary class="mut">المراحل</summary><ul style="margin:4px 0">${x.st.map(s=>`<li>${s.f>=1?"✅":s.f>0?"🔄":"⬜"} ${esc(s.t)} <small class="mut">(${toAr(Math.round(s.f*100))}٪ من ${toAr(s.w)} نقاط${s.note?" • "+esc(s.note):""})</small></li>`).join("")}</ul></details></div>`).join("")}
 <p class="mut">تستمر المهام على خوادم GitHub دون الحاجة إلى المحادثة؛ وهذه الصفحة تعرض آخر ما وصلت إليه.</p>`}
async function sysStatus(){const el=$("#sysst");if(!el)return;const R_=GH.repo,api=u=>fetch("https://api.github.com/repos/"+R_+u).then(r=>r.ok?r.json():Promise.reject(new Error(r.status)));
 try{const [cm,runs]=await Promise.all([api("/commits?per_page=8"),api("/actions/runs?per_page=12")]);
  const st=await Promise.all(cm.slice(0,8).map(c=>api("/commits/"+c.sha+"/status").then(x=>x.state).catch(()=>"")));
  const ic={success:"✓ منشور",pending:"… يُنشر الآن",failure:"✗ تعذر النشر",error:"✗ تعذر النشر"},rs={completed:"",in_progress:"… جارٍ",queued:"في الانتظار"},cs={success:"✓",failure:"✗",cancelled:"أُلغي",skipped:"تُخطي"};
  el.innerHTML=`<h3 style="font-size:1rem">آخر الحفظ والنشر على الموقع</h3>${cm.map((c,i)=>`<div class="card"><b>${esc(c.commit.message.split("\n")[0].slice(0,140))}</b><span class="mut">${esc(ago(c.commit.author.date))} • ${esc(c.commit.author.name)} • ${ic[st[i]]||"—"}</span></div>`).join("")}
  <h3 style="font-size:1rem">المهام الآلية (التحويل والاستيراد والفهارس)</h3>${(runs.workflow_runs||[]).map(r=>`<div class="card"><b>${esc(r.name)}</b><span class="mut">${esc(ago(r.created_at))} • ${r.status==="completed"?(cs[r.conclusion]||r.conclusion):rs[r.status]||r.status} • <a href="${esc(r.html_url)}" target="_blank" rel="noopener">التفاصيل</a></span></div>`).join("")}`}
 catch(e){el.innerHTML='<p class="note">تعذر جلب الحالة الآن ('+esc(e.message)+').</p>'}}
function vAdmin(q){const tab=q.t||"book",opt=(a,v)=>a.map(x=>`<option value="${x.id}"${x.id===v?" selected":""}>${esc(x.name)}</option>`).join("");
 const T_=[["book","إضافة كتاب"],["tafrigh","رفع تفريغات"],["pdf","كتاب مصور"],["article","إضافة مقال"],["post","إضافة منشور"],["import","استيراد من صوت السلف"],["update","ملف التحديث"],["offline","دون إنترنت"]].concat(isAdmin()?[["struct","الأقسام والأسماء"],["review","مراجعة التحويل"],["tashkeel","التشكيل"],["sheikhs","حسابات المشايخ والمراسلة"]]:[]).concat(Cloud.staff()||GH.on?MG.tabs().concat([["releases","جديد الإصدارات"],["majalla","مجلة المكتبة"],["quizzes","اختبارات الكتب"],["talaea","الطلائع"]]):[]).concat(Cloud.staff()?[["prog","متابعة إنجاز الكتب"],["corr","تصحيحات القراء"],["notify","إشعار للأعضاء"],["msgs","رسائل الأعضاء"],["community","مراقبة المجتمع"],["audio","الصوتيات والراديو"],["status","حالة النشر والتحويل"]]:[]);
 const authSel=(name,col)=>`<select name="${name}">${opt(lib.authors.filter(a=>!col||bc(a)===col))}<option value="__new">+ مؤلف جديد</option></select><input name="${name}new" placeholder="اسم المؤلف الجديد (عند اختيار «مؤلف جديد»)" style="margin-top:4px">`;
 let body="";
 if(tab==="book")body=`<form data-form="addbook"><label>العنوان</label><input name="title" required>
  <div class="row"><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option><option value="ithra">${COL.ithra}</option></select></div><div><label>المؤلف</label>${authSel("aid")}</div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for!=="articles"))}</select></div></div>
  <label>المصدر أو الناشر والسنة (اختياري)</label><input name="source">
  <label>ملف نصي (.txt) أو الصق النص أدناه</label><input type="file" name="file" accept=".txt,text/plain"><textarea name="text" placeholder="نص الكتاب"></textarea>
  <div class="row"><div><label>تقسيم الصفحات</label><select name="split"><option value="mark">عند السطر ----- أو فاصل الصفحة</option><option value="auto">تلقائيًا بالحجم</option></select></div><div><label>حجم الصفحة التلقائي (حرف)</label><input name="size" type="number" value="1800"></div></div>
  <label>الفهرس (سطر لكل عنوان: العنوان|رقم الصفحة)</label><textarea name="toc" style="min-height:60px"></textarea>
  <div class="row"><div><label>رابط النسخة المصورة PDF (اختياري)</label><input name="pdf" type="url" placeholder="https://archive.org/download/…/book.pdf" dir="ltr"></div><div><label>فرق ترقيم الصفحات</label><input name="off" type="number" value="0"></div></div>
  <label class="inl"><input type="checkbox" name="tafrigh" value="1"> هذا تفريغ لدروس صوتية</label><label>ضمن «قضايا الفرقان» (اختياري)</label><select name="furqan"><option value="">—</option>${FURQAN.map(([n])=>`<option>${esc(n)}</option>`).join("")}</select>
  <button class="btn p" style="margin-top:10px">حفظ الكتاب</button></form>`;
 else if(tab==="tafrigh")body=`<p class="mut">ارفع تفريغات الدروس والشروح الصوتية فتُجهَّز وتُنسب إلى الشيخ وتظهر في <a href="#/tafrighat">التفريغات</a> وفي صفحة الشيخ. يقبل Word (.docx) والنص (.txt) وملفات الترجمة النصية للمقاطع (.srt/.vtt)، أو لصق النص.</p>
  <form data-form="addtfg"><label>ملفات التفريغ (يمكن اختيار عدة ملفات)</label><input type="file" name="files" multiple accept=".docx,.txt,.md,.srt,.vtt,text/plain">
  <div class="row"><div><label>طريقة الحفظ عند تعدد الملفات</label><select name="mode"><option value="series">سلسلة واحدة: كل ملف درس في فهرسها</option><option value="each">كل ملف درس مستقل (مجلدات سلسلة)</option></select></div><div><label>عنوان السلسلة أو الدرس</label><input name="title" placeholder="مثل: شرح كتاب التوحيد"></div></div>
  <div class="row"><div><label>الشيخ</label>${authSel("aid")}</div><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option></select></div><div><label>الموضوع</label><select name="tid">${opt(lib.topics.filter(t=>t.for!=="articles"))}</select></div></div>
  <div class="row"><div><label>الكتاب المشروح (اختياري)</label><select name="sharh"><option value="">—</option>${BOOKS().map(b=>`<option value="${b.id}">${esc(b.setTitle||b.title)}</option>`).join("")}</select></div><div><label>رابط التسجيل الصوتي أو المرئي (اختياري)</label><input name="audio" type="url" dir="ltr" placeholder="https://"></div></div>
  <div class="row"><div><label>المفرِّغ (اختياري)</label><input name="by" maxlength="80"></div><div><label>تاريخ الإلقاء (اختياري)</label><input name="date" maxlength="40" placeholder="مثل: ١٤٤٥ هـ"></div><div><label>حجم الصفحة (حرف)</label><input name="size" type="number" value="1800"></div></div>
  <fieldset class="secs"><legend>تجهيز النص</legend><label class="inl"><input type="checkbox" name="ts" value="1" checked> حذف التوقيتات وأرقام المقاطع</label><label class="inl"><input type="checkbox" name="join" value="1" checked> دمج الأسطر المتقطعة في فقرات</label><label class="inl"><input type="checkbox" name="heads" value="1" checked> جعل «الدرس/المجلس/المحاضرة…» عناوين في الفهرس</label></fieldset>
  <label>أو الصق نص التفريغ</label><textarea name="text" style="min-height:120px"></textarea>
  <label>ضمن «قضايا الفرقان» (اختياري)</label><select name="furqan"><option value="">—</option>${FURQAN.map(([n])=>`<option>${esc(n)}</option>`).join("")}</select>
  <div class="savebar"><button class="btn" type="button" data-act="tfgpv">معاينة التجهيز</button> <button class="btn p">حفظ التفريغ</button> <span id="tfgst" class="mut"></span></div></form><div id="tfgpv"></div>`;
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
 else if(tab==="quizzes"&&(Cloud.staff()||GH.on)){body='<div id="qzadm" class="mut">جارٍ التحميل…</div>';LRN.admin(q).then(h=>{const el=$("#qzadm");if(el){el.className="";el.innerHTML=h}})}
 else if(tab==="talaea"&&(Cloud.staff()||GH.on)){body='<div id="taladm" class="mut">جارٍ التحميل…</div>';TALA.admin().then(h=>{const el=$("#taladm");if(el){el.className="";el.innerHTML=h}})}
 else if(tab==="majalla"&&(Cloud.staff()||GH.on)){body='<div id="majadm" class="mut">جارٍ التحميل…</div>';MAJ.admin(q).then(h=>{const el=$("#majadm");if(el){el.className="";el.innerHTML=h}})}
 else if(tab==="releases"&&(Cloud.staff()||GH.on)){body='<div id="reladm" class="mut">جارٍ التحميل…</div>';REL.admin().then(h=>{const el=$("#reladm");if(el){el.className="";el.innerHTML=h}})}
 else if(/^(items|vols|dups|imports|reports|log|switches)$/.test(tab)&&(Cloud.staff()||GH.on))body=MG.body(tab,q);
 else if(tab==="msgs"){location.hash="#/messages";return}
 else if(tab==="community"){location.hash="#/community?k=admin";return}
 else if(tab==="sheikhs"){body='<div id="shadm" class="mut">جارٍ التحميل…</div>';setTimeout(shAdmin,0)}
 else if(tab==="tashkeel"){body='<div id="tkadm" class="mut">جارٍ التحميل…</div>';setTimeout(tkAdmin,0)}
 else if(tab==="audio"){location.hash="#/audio?k=admin";return}
 else if(tab==="prog"){body='<div id="progadm" class="mut">جارٍ التحميل…</div>';setTimeout(progAdmin,0)}
 else if(tab==="status"){body='<p class="mut">كل ما تحفظه من الإدارة يُكتب في المستودع ثم يُنشر تلقائيًا على الموقع خلال دقيقة أو اثنتين. هنا آخر عمليات النشر والتحويل.</p><h3 style="font-size:1rem">إشعارات تليجرام</h3><div id="tgst" class="card"><p class="mut">جارٍ التحميل…</p></div><div id="sysst"><p class="mut">جارٍ التحميل…</p></div>';setTimeout(()=>{sysStatus();if(typeof tgPanel==="function")tgPanel()},0)}
 else if(tab==="review"){const ob=lib.books.filter(b=>b.ocr).sort((x,y)=>(y.added||"").localeCompare(x.added||""));body=`<p class="mut">الكتب المحوّلة آليًا من نسخها المصورة. يقرأ Gemini صورة كل صفحة ويراجع مسودة Tesseract ويصححها، ويعلّم الكلمات التي شكّ فيها لتراجعها أنت: تظهر مظللة بالبرتقالي في القارئ (لك وحدك)، وتختفي العلامة بعد «تعديل النص» وحفظه.</p>${ob.map(b=>`<div class="bk"><b>${esc(b.title)}</b><span>${esc(A(b.authorId).name)} • ${b.ocrEngine==="gemini+tesseract"||b.ocrEngine==="gemini"?"Gemini + Tesseract":"Tesseract وحده"} • ${toAr(b.unc||0)} موضع للمراجعة${b.unrev?` • ${toAr(b.unrev)} صفحة لم يراجعها Gemini`:""}</span><div class="row" style="margin-top:6px"><button class="btn s nf" data-act="revlist" data-id="${b.id}">مواضع المراجعة</button><a class="btn s nf" href="#/book/${b.id}/1">فتح الكتاب</a>${(b.pdfLocal||b.pdf)&&/^pdf\//.test(b.pdfLocal||b.pdf)?`<button class="btn s nf" data-act="reocr" data-id="${b.id}">إعادة التحويل بالذكاء الاصطناعي</button>`:""}</div><div class="revl" id="rv-${b.id}"></div></div>`).join("")||'<p class="note">لا توجد كتب محوّلة بعد.</p>'}<p id="bmst" class="mut"></p>`}
 else if(tab==="notify")body=`<p class="mut">يظهر الإشعار في جرس الإشعارات لكل الأعضاء، ويصل إلى أجهزة من فعّل إشعارات الجهاز خلال ساعة.</p><form data-form="bcast"><label>العنوان</label><input name="title" required maxlength="200" placeholder="مثال: صدر كتاب جديد للشيخ…"><label>نص مختصر (اختياري)</label><textarea name="body" style="min-height:80px"></textarea><label>رابط داخل المكتبة (اختياري)</label><input name="url" placeholder="#/book/… أو #/posts" dir="ltr"><button class="btn p" style="margin-top:8px">إرسال الإشعار</button> <span id="bcst" class="mut"></span></form><h3>آخر الإشعارات</h3><div id="bclist" class="mut">جارٍ التحميل…</div>`;
 else if(tab==="corr")body=`<p class="mut">تصحيحات أرسلها القراء. راجع النص المقترح وعدّله إن لزم، ثم اعتمده فيُنشر مباشرة (يحتاج مفتاح الإدارة المباشرة).</p><div id="corrs"><p class="mut">جارٍ التحميل…</p></div>`;
 else body=`<p class="mut">نزّل نصوص المكتبة كلها على هذا الجهاز لتعمل دون إنترنت، وتتحدث تلقائيًا عند الاتصال. الحجم الكلي نحو ${Math.round(lib.books.reduce((s,b)=>s+(b.size||0),0)/1048576)} ميجابايت.</p><button class="btn p" data-act="offline">تنزيل المكتبة للعمل دون إنترنت</button><div id="offst"></div>`;
 view(`<h2>الإدارة</h2>${Cloud.staff()?'<p><a class="btn p s" href="#/team">مساحة الفريق</a> <span class="mut">التواصل والمهام والقرارات والاجتماعات (للفريق وحده)</span></p>':""}${ghBox()}<label class="inl"><input type="checkbox" id="adm"${S.admin?" checked":""}> وضع الإدارة (يظهر زر «تعديل النص» في القارئ)</label>
 <div class="tabs" role="tablist">${T_.map(([k,l])=>`<a role="tab" aria-selected="${tab===k}" href="#/admin?t=${k}">${l}</a>`).join("")}</div><div style="margin-top:10px">${body}</div>
 <p class="note">${GH.on?"أنت في وضع الإدارة المباشرة: احذر، فالتعديلات تُنشر للجميع.":"بدون مفتاح المشرف لا يستطيع أحد تغيير المكتبة المنشورة من هذه الصفحة؛ ما يُضاف يبقى على هذا الجهاز حتى يُرفع ملف التحديث."}</p>`);
 $("#adm").onchange=e=>{S.admin=e.target.checked;saveS()};
 const impf=$("#impf");if(impf)impf.onchange=async e=>{try{await applyUpdate(JSON.parse(await e.target.files[0].text()));alert("تم الاستيراد");route()}catch(x){alert("ملف غير صالح")}};
 const ig=$("#impgo");if(ig)ig.onclick=importArticles;if(tab==="corr"&&Cloud.staff())corrList();if(tab==="notify"&&Cloud.staff())bcList();if(tab==="struct")wireStruct()}
async function newAuthor(fd,key,col){let aid=fd.get(key);if(aid!=="__new")return aid;const n=String(fd.get(key+"new")||"").trim();if(!n)throw new Error("اكتب اسم المؤلف الجديد");
 const ex=lib.authors.find(a=>[a.name].concat(a.aliases||[]).some(x=>norm(x)===norm(n)));if(ex)return ex.id;
 // منع التكرار (ب2-16): اسم قريب من مؤلف قائم يُعرض للتأكيد قبل إنشاء سجل جديد
 const near=typeof MG!=="undefined"&&MG.sameish?lib.authors.find(a=>(!col||bc(a)===col)&&[a.name].concat(a.aliases||[]).some(x=>MG.sameish(x,n))):null;
 if(near&&confirm("يوجد مؤلف باسم قريب: «"+near.name+"». هل هو الشخص نفسه؟\n(موافق: تُنسب المادة إليه، إلغاء: يُنشأ مؤلف جديد)"))return near.id;aid="u_a"+Date.now().toString(36);const au={id:aid,name:n,col:col||"dawah",bio:""};if(GH.on)await ghSaveAuthor(au);else LOCAL.catalog.authors.push(au);return aid}
function splitPages(t,mode,size){t=t.replace(/\r/g,"").trim();if(mode==="mark")return t.split(/\n-{3,}\n|\f/).map(x=>x.trim()).filter(Boolean);
 const ps=[];let cur="";t.split(/\n+/).forEach(par=>{if(cur&&(cur+par).length>size){ps.push(cur.trim());cur=""}cur+=par+"\n"});if(cur.trim())ps.push(cur.trim());return ps}
async function saveItem(meta,pages,toc){if(GH.on)return ghSaveBook(meta,pages,toc);LOCAL.catalog.books=byId(LOCAL.catalog.books,[Object.assign(meta,{n:pages.length,size:JSON.stringify(pages).length,added:meta.added||new Date().toISOString()})]);
 LOCAL.shards[meta.id]={id:meta.id,pages,toc:toc||[]};await DB.set("local",LOCAL);SH.delete(meta.id);merge();renderTicker()}
async function addBook(f){const fd=new FormData(f);try{let text=String(fd.get("text")||"");const file=fd.get("file");if(file&&file.size)text=await file.text();if(!text.trim())throw new Error("أدخل نص الكتاب");
 const col=fd.get("col"),aid=await newAuthor(fd,"aid",col),pages=splitPages(text,fd.get("split"),+fd.get("size")||1800);
 const toc=String(fd.get("toc")||"").split("\n").map(l=>l.split("|")).filter(x=>x[0]&&+x[1]).map(x=>({t:x[0].trim(),p:+x[1]}));
 const tags=[];if(fd.get("tafrigh"))tags.push("tafrigh");if(fd.get("furqan"))tags.push("furqan:"+fd.get("furqan"));const meta={id:"u"+Date.now().toString(36),title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col,type:"book",source:String(fd.get("source")||"")};
 if(tags.length)meta.tags=tags;if(fd.get("pdf")){meta.pdf=String(fd.get("pdf")).trim();meta.pdfOffset=+fd.get("off")||0}
 if(!dupOk(meta.title,aid,false))return;
 await saveItem(meta,pages,toc);
 alert("تم حفظ الكتاب ("+pages.length+" صفحة)");f.reset()}catch(e){alert(e.message)}}
// منع تكرار المواد (ب2-16): العنوان نفسه للمؤلف نفسه يُنبَّه عليه، ويُقترح «طبعات الكتاب» للكتب
const dupKey=t=>norm(String(t||"").replace(/[«»"'()\[\]،,.:؛؟!\-–—]/g," ")).replace(/\s+/g," ").trim();
function dupOk(title,aid,art){const k=dupKey(title),hit=CAT.books.concat(ARTS_IDX.map(artFromIdx)).find(b=>b.authorId===aid&&isArt(b)===art&&dupKey(b.setTitle||b.title)===k);
 return!hit||confirm(`يوجد ${art?"مقال":"كتاب"} بالعنوان نفسه للمؤلف نفسه: «${hit.setTitle||hit.title}» (${hit.id}).${art?"":"\nإن كان طبعة أخرى فأضفه من «طبعات الكتاب» في صفحة الكتاب."}\nإضافة سجل جديد رغم ذلك؟`)}
/* ---------- رفع التفريغات (دروس صوتية مفرغة) وتجهيزها ونسبتها إلى الشيخ ---------- */
// يقبل Word (.docx) والنص (.txt/.md) وملفات الترجمة (.srt/.vtt) أو اللصق؛ كل ملف درس مستقل أو فصل في سلسلة واحدة
async function docxText(file){const u=new Uint8Array(await file.arrayBuffer()),dv=new DataView(u.buffer);let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error("ملف Word غير صالح: "+file.name);
 let o=dv.getUint32(e+16,true);const n=dv.getUint16(e+10,true);
 for(let i=0;i<n;i++){const m=dv.getUint16(o+10,true),cs=dv.getUint32(o+20,true),nl=dv.getUint16(o+28,true),xl=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lo=dv.getUint32(o+42,true),name=new TextDecoder().decode(u.slice(o+46,o+46+nl));
  if(name==="word/document.xml"){const st=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true),raw=u.slice(st,st+cs);
   const xml=m===0?new TextDecoder().decode(raw):await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
   return xml.replace(/<w:tab\/>/g," ").replace(/<w:br[^>]*\/>/g,"\n").replace(/<\/w:p>/g,"\n").replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&")}
  o+=46+nl+xl+cl}
 throw new Error("لم يُعثر على نص في ملف Word: "+file.name)}
const tfgFileText=f=>/\.docx$/i.test(f.name)?docxText(f):f.text();
const TFGH=/^(الدرس|المحاضرة|المجلس|الحلقة|اللقاء|الشريط)\s+[^\n]{0,60}$/;
const tfgName=n=>n.replace(/\.[^.]+$/,"").replace(/[_]+/g," ").replace(/\s+/g," ").trim();
function tfgClean(t,o){t=String(t||"").replace(/\r/g,"").replace(/ /g," ");
 if(o.ts){t=t.replace(/^WEBVTT.*$/m,"").split("\n").filter(l=>!/^\s*\d+\s*$/.test(l)&&!/\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?\s*-->/.test(l)).join("\n").replace(/[\[(]?\b\d{1,2}:\d{2}(:\d{2})?\b[\])]?/g,"")}
 if(o.join){const L=t.split("\n").map(x=>x.trim());const out=[];const H=x=>/^#/.test(x)||o.heads&&TFGH.test(x);L.forEach(l=>{if(!l){out.push("");return}const last=out[out.length-1];if(last&&!/[.!؟?:؛»"]$/.test(last)&&!H(last)&&!H(l))out[out.length-1]=last+" "+l;else out.push(l)});t=out.join("\n")}
 if(o.heads)t=t.split("\n").map(l=>TFGH.test(l.trim())?"# "+l.trim():l).join("\n");
 return t.replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").trim()}
function tfgToc(pages){const toc=[];pages.forEach((p,i)=>p.split("\n").forEach(l=>{if(/^#\s+/.test(l))toc.push({t:l.replace(/^#\s+/,"").trim(),p:i+1})}));return toc}
async function tfgBuild(f){const fd=new FormData(f),files=[...f.querySelector("[name=files]").files],o={ts:!!fd.get("ts"),join:!!fd.get("join"),heads:!!fd.get("heads")},size=+fd.get("size")||1800;
 const parts=[];for(const fl of files)parts.push({name:tfgName(fl.name),text:tfgClean(await tfgFileText(fl),o)});
 const pasted=String(fd.get("text")||"").trim();if(pasted)parts.push({name:String(fd.get("title")||"").trim()||"تفريغ",text:tfgClean(pasted,o)});
 if(!parts.length)throw new Error("اختر ملفات التفريغ أو الصق النص");
 const title=String(fd.get("title")||"").trim(),series=fd.get("mode")==="series"||parts.length===1;
 if(series&&!title&&parts.length>1)throw new Error("اكتب عنوان السلسلة");
 return(series?[{title:title||parts[0].name,text:parts.length>1?parts.map(p=>"# "+p.name+"\n"+p.text).join("\n\n"):parts[0].text}]:parts.map((p,i)=>({title:(title?title+" — ":"")+p.name,text:p.text,no:i+1}))).map(r=>{const pages=splitPages(r.text,"auto",size);return Object.assign(r,{pages,toc:tfgToc(pages)})})}
async function tfgPreview(f){const el=$("#tfgpv");try{const R=await tfgBuild(f);el.innerHTML=`<p><b>${toAr(R.length)} ${R.length>1?"سجلات":"سجل"}</b> سيُحفظ ${R.length>1?"كل منها":""} في «التفريغات» منسوبًا إلى المؤلف المختار:</p>`+R.map(r=>`<div class="bk"><b>${esc(r.title)}</b><span>${toAr(r.pages.length)} صفحة • ${toAr(r.toc.length)} عنوان في الفهرس</span><small class="mut">${esc(r.pages[0].slice(0,220))}…</small></div>`).join("")}catch(e){el.innerHTML=`<p class="note">${esc(e.message)}</p>`}}
async function addTafrigh(f){const fd=new FormData(f),st=$("#tfgst");try{const R=await tfgBuild(f),col=fd.get("col"),aid=await newAuthor(fd,"aid",col);
 const base={authorId:aid,topicId:fd.get("tid"),col,type:"book",tags:["tafrigh"].concat(fd.get("furqan")?["furqan:"+fd.get("furqan")]:[]),source:["تفريغ دروس صوتية",fd.get("by")&&"فرّغه: "+String(fd.get("by")).trim(),fd.get("date")&&"أُلقي في "+fd.get("date")].filter(Boolean).join(" — ")};
 if(fd.get("audio"))base.audio=String(fd.get("audio")).trim();if(fd.get("sharh"))base.sharh=fd.get("sharh");
 for(const r of R)if(!dupOk(r.title,aid,false))return;
 const stamp=Date.now().toString(36),metas=R.map((r,i)=>Object.assign({id:"u"+stamp+(R.length>1?"-"+(i+1):""),title:r.title},base,R.length>1?{set:"u"+stamp,setTitle:String(fd.get("title")||"").trim()||r.title,vol:i+1,vols:R.length}:{}));
 st.textContent="جارٍ الحفظ…";
 if(GH.on){const files=R.map((r,i)=>{const sh={id:metas[i].id,pages:r.pages,toc:r.toc},s=JSON.stringify(sh);metas[i].n=r.pages.length;metas[i].size=s.length;metas[i].added=today();SH.set(metas[i].id,sh);return{path:"data/books/"+metas[i].id+".json",text:s}});
  await GH.batch(files,"تفريغات: "+(fd.get("title")||metas[0].title),t=>{st.textContent=t});
  await GH.editJSON("data/catalog.json",c=>{const ids=new Set(metas.map(m=>m.id));c.books=c.books.filter(b=>!ids.has(b.id)).concat(metas);c.version=Date.now();return c},"فهرس التفريغات: "+(fd.get("title")||metas[0].title),true);
  CAT.books=CAT.books.filter(b=>!metas.some(m=>m.id===b.id)).concat(metas);merge();renderTicker()}
 else for(let i=0;i<R.length;i++)await saveItem(metas[i],R[i].pages,R[i].toc);
 st.textContent="";alert(`حُفظ ${R.length>1?R.length+" دروس":"التفريغ"} في «التفريغات» ✓`);f.reset();$("#tfgpv").innerHTML=""}catch(e){st.textContent="";alert(e.message)}}
async function addArticle(f){const fd=new FormData(f);try{const text=String(fd.get("text")||"").trim();if(!text)throw new Error("أدخل نص المقال");const aid=await newAuthor(fd,"aid","dawah");if(!dupOk(fd.get("title"),aid,true))return;
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
// قسم التراجم قسمان: «مشايخ الدعوة السلفية بمصر» (التراجم المفصلة في data/tarajim.json ثم بقية مؤلفي مكتبة الدعوة من المشايخ)،
// و«تراجم عامة» (أئمة المكتبة العامة بوفياتهم، مع الربط بتراجمهم في كتب التراجم المحفوظة في المكتبة — #/alam).
const NONPERSON=/^(صوت السلف|الدعوة السلفية|حزب النور|مجلة|موقع|مركز|لجنة|مجلس|إدارة|فريق|أنا السلفي|بوابة)/;
function vTarajim(q){q=q||{};const tab=q.t==="aam"?"aam":"dawah",s=(q.q||"").trim(),ws=s?norm(s).split(/\s+/).filter(Boolean):[];
 const hit=a=>!ws.length||ws.every(w=>norm(a.name+" "+((tj(a.id)||{}).brief||a.bio||"")).includes(w));
 const tabs=`<div class="tabs" role="tablist">${[["dawah","مشايخ الدعوة السلفية بمصر"],["aam","تراجم عامة"]].map(([k,l])=>`<a role="tab" aria-selected="${tab===k}" href="#/tarajim${k==="aam"?"?t=aam":""}">${l}</a>`).join("")}</div>
 <form class="stepper" data-form="tjq"><input type="hidden" name="t" value="${tab}"><input name="q" type="search" value="${esc(s)}" placeholder="ابحث بالاسم"><button class="btn p">بحث</button></form>`;
 const av=a=>`<span class="av">${esc(a.name.replace(/^(الشيخ|الإمام|الحافظ|العلامة|شيخ الإسلام|الدكتور|د\.)\s*/,"").trim()[0]||"")}</span>`;
 if(tab==="dawah"){
  const det=sheikhs().map(A).filter(hit);
  const rest=lib.authors.filter(a=>(a.col||"dawah")==="dawah"&&!a.mergedInto&&!tj(a.id)&&!NONPERSON.test(a.name)&&hit(a)).map(a=>[a,counts(a.id)]).filter(([,c])=>c.books+c.arts+c.fatwas>0).sort((x,y)=>(y[1].books*20+y[1].arts+y[1].fatwas)-(x[1].books*20+x[1].arts+x[1].fatwas));
  return view(`<h2>التراجم</h2><p class="mut">تعريف بمشايخ الدعوة السلفية بمصر وجهودهم العلمية والدعوية، وتراجم أئمة المكتبة العامة من كتب التراجم. اضغط مطولًا على اسم أي مؤلف في الموقع لترى تعريفه الموجز.</p>${tabs}
  ${det.length?`<h3>تراجم مفصلة</h3><div class="tgrid">${det.map(a=>{const t=tj(a.id);return`<a class="tcard" href="#/tarjama/${a.id}">${av(a)}<b>${esc(a.name)}</b><p>${esc(t.brief)}</p><em>${countLine(a.id)}</em></a>`}).join("")}</div>`:""}
  ${rest.length?`<h3>مشايخ وكتّاب مكتبة الدعوة</h3><p class="mut">تُستكمل تراجمهم المفصلة تباعًا من مصادر موثقة تراجعها الإدارة.</p><div class="tgrid">${rest.map(([a])=>`<a class="tcard" href="#/author/${a.id}" data-author="${a.id}">${av(a)}<b>${esc(a.name)}</b>${a.bio?`<p>${esc(a.bio.slice(0,160))}</p>`:""}<em>${countLine(a.id)}</em></a>`).join("")}</div>`:""}
  ${!det.length&&!rest.length?'<p class="mut">لا نتائج.</p>':""}<p class="note">${esc(TJ.note||"")}</p>`)}
 if(tab==="aam"&&q.m!=="lib")return vA3lam(q,tabs);
 const im=lib.authors.filter(a=>a.col==="turath"&&!a.mergedInto&&hit(a)).sort((x,y)=>(parseInt(x.died)||9999)-(parseInt(y.died)||9999));
 view(`<h2>التراجم</h2><p><a href="#/tarajim?t=aam">← موسوعة أعلام المسلمين</a></p><p class="mut">أئمة المكتبة العامة مرتبون بسنة الوفاة، ولكل إمام كتبه في المكتبة وترجمته منقولة بنصها من كتب التراجم المحفوظة فيها (سير أعلام النبلاء، وتهذيب التهذيب، والإصابة…). وللبحث في نحو ستين ألف علم وراوٍ: <a href="#/alam">التعريف بالأعلام والرواة</a>.</p>${tabs}
 <div class="tgrid">${im.map(a=>`<div class="tcard">${av(a)}<b><a href="#/author/${a.id}" data-author="${a.id}">${esc(a.name)}</a></b>${a.died?`<p class="mut">ت ${esc(String(a.died))}${/هـ/.test(a.died)?"":"هـ"}</p>`:""}${a.bio?`<p>${esc(a.bio.slice(0,160))}</p>`:""}<em>${countLine(a.id)}</em><a class="btn s nf" href="#/alam?q=${encodeURIComponent(a.name.replace(/^(الإمام|الحافظ|العلامة|شيخ الإسلام|الشيخ)\s*/,""))}">ترجمته في كتب التراجم</a></div>`).join("")||'<p class="mut">لا نتائج.</p>'}</div>`)}
/* التدقيق الحديثي (تخريج أحاديث الكتاب): data/takhrij/<الكتاب>.json من tools/takhrij.py — مواضع كل حديث في كتب السنة بالمكتبة
   بالمطابقة النصية، وعزو المؤلف، وحكم الترمذي إن ورد؛ ولا حكم من خارج المصادر، وما لم يوجد يُعلَّم للمراجعة. */
const TKH=new Map();const tkhGet=id=>{if(!TKH.has(id))TKH.set(id,fetch("data/takhrij/"+id+".json?v="+((B(id)||{}).tkh||"")).then(r=>r.ok?r.json():null).catch(()=>null));return TKH.get(id)};
async function vTakhrij(q,id){const b=B(id);view('<p class="mut">جارٍ تحميل التخريج…</p>');const d=await tkhGet(id);if(!d||!b)return view('<p class="note">لا يوجد تخريج لهذا الكتاب بعد.</p>');
 const f=q.f||"",L=d.items.filter(x=>f==="nf"?x.nf:f==="ok"?!x.nf:true),SN=(d.items.length&&d.items[0])||{};
 view(`<p><a href="#/book/${esc(id)}/1">← ${esc(b.setTitle||b.title)}</a></p><h2>تخريج أحاديث «${esc(b.setTitle||b.title)}»</h2>
 <p class="mut">${toAr(d.n)} حديثًا مرفوعًا في الكتاب، وُجدت مواضع ${toAr(d.found)} منها في كتب السنة بالمكتبة (الصحيحين والسنن والمسند والموطأ وغيرها) بالمطابقة النصية، مع عزو المؤلف وحكم الترمذي إن ورد في جامعه. لا يُذكر حكم من خارج المصادر؛ وما لم يُعثر عليه بلفظه يحتاج مراجعة يدوية (قد يكون بلفظ آخر أو في كتاب ليس في المكتبة). آخر تحديث ${esc(d.at)}.</p>
 <nav class="chips">${[["","الكل ("+toAr(d.n)+")"],["ok","وُجدت مواضعه ("+toAr(d.found)+")"],["nf","للمراجعة ("+toAr(d.n-d.found)+")"]].map(([k,l])=>`<a class="chip${f===k?" x":""}" href="#/takhrij/${esc(id)}${k?"?f="+k:""}">${l}</a>`).join("")}</nav>
 ${L.map(x=>`<div class="tkh${x.nf?" nf":""}"><p class="tkht">«${esc(x.t)}»</p><p class="mut"><a href="#/book/${esc(id)}/${x.p}">في الكتاب: ص ${toAr(x.p)}</a>${x.cite?` • عزو المؤلف: ${esc(x.cite)}`:""}</p>
  ${x.loc.length?`<div class="tkhl"><b>مواضعه في المكتبة:</b> ${x.loc.map(l=>`<a href="#/book/${esc(l[2])}/${l[3]}">${esc(l[1])} (ص ${toAr(l[3])})</a>`).join("، ")}</div>`:'<p class="warn">لم يُعثر عليه بلفظه في كتب السنة بالمكتبة — يحتاج مراجعة.</p>'}
  ${x.g&&x.g.length?`<p class="tkhg">${esc(x.g[0])} <a href="#/book/${esc(x.g[1])}/${x.g[2]}">(الموضع)</a></p>`:""}</div>`).join("")||'<p class="mut">لا نتائج.</p>'}`)}
/* موسوعة أعلام المسلمين (التراجم العامة): من «سير أعلام النبلاء» مرتبة زمنيًّا بالقرون (بحسب طبقات الذهبي)، أو موضوعيًّا بالفنون،
   لكل علم ترجمة موجزة بنصها وموضعها، ومراجع للتوسع من كتب التراجم والجرح والتعديل في المكتبة (data/a3lam من tools/a3lam.py). */
const A3={ix:null,c:new Map()};
const a3get=async c=>{if(!A3.c.has(c))A3.c.set(c,fetch("data/a3lam/c"+c+".json").then(r=>r.ok?r.json():[]).catch(()=>[]));return A3.c.get(c)};
const CENT=["","القرن الأول","القرن الثاني","القرن الثالث","القرن الرابع","القرن الخامس","القرن السادس","القرن السابع"];
async function vA3lam(q,tabs){
 if(!A3.ix){try{A3.ix=await (await fetch("data/a3lam/_index.json")).json()}catch(e){A3.ix={fields:[],c:{}}}}
 const F=A3.ix.fields||[],FL=k=>(F.find(x=>x[0]===k)||[k,k])[1],s=(q.q||"").trim(),ws=s?norm(s).split(/\s+/).filter(Boolean):[],c=+q.c||(ws.length?0:1),f=q.f||"",o=q.o==="f"?"f":"t";
 const u=x=>{const p=new URLSearchParams(Object.assign({t:"aam"},{c:q.c||"",f,o,q:s},x));[...p.keys()].forEach(k=>!p.get(k)&&p.delete(k));return"#/tarajim?"+p};
 view(`<h2>التراجم</h2>${tabs.replace(/<form[\s\S]*<\/form>/,"")}<p class="mut">موسوعة أعلام المسلمين: ${toAr(Object.values(A3.ix.c).reduce((n,x)=>n+x.n,0))} علمًا من «سير أعلام النبلاء» للذهبي، مرتبين زمنيًّا بطبقاتهم أو موضوعيًّا بفنونهم، ولكل علم ترجمة موجزة بنصها وموضعها، ومراجع للتوسع في كتب التراجم والجرح والتعديل بالمكتبة. <a href="#/tarajim?t=aam&m=lib">أئمة المكتبة العامة ومؤلفاتهم</a> • <a href="#/alam">البحث في ستين ألف علم وراوٍ</a></p>
 <div class="tabs sub" role="tablist">${[["t","الترتيب الزمني"],["f","الترتيب الموضوعي"]].map(([k,l])=>`<a role="tab" aria-selected="${o===k}" href="${u({o:k})}">${l}</a>`).join("")}</div>
 <nav class="chips a3c">${CENT.slice(1).map((n,i)=>`<a class="chip${c===i+1?" x":""}" href="${u({c:i+1})}">${n} <small>${toAr((A3.ix.c[i+1]||{}).n||0)}</small></a>`).join("")}<a class="chip${!c?" x":""}" href="${u({c:"",q:s||""})}">كل القرون</a></nav>
 <nav class="chips a3f"><a class="chip${!f?" x":""}" href="${u({f:""})}">كل الفنون</a>${F.map(([k,l])=>`<a class="chip${f===k?" x":""}" href="${u({f:k})}">${esc(l)}</a>`).join("")}</nav>
 <form class="stepper" data-form="a3q"><input name="q" type="search" value="${esc(s)}" placeholder="ابحث باسم العلم أو لقبه أو بلده"><button class="btn p">بحث</button></form>
 <div id="a3l" class="mut">جارٍ التحميل…</div>`);
 const cs=c?[c]:[1,2,3,4,5,6,7],all=(await Promise.all(cs.map(a3get))).flatMap((L,i)=>L.map(z=>Object.assign({c:cs[i]},z)));
 let L=all.filter(z=>(!f||z.f.includes(f))&&(!ws.length||ws.every(w=>norm(z.n+" "+z.x).includes(w))));
 if(ws.length){const sc=z=>{const n=norm(z.n);return(ws.every(w=>n.includes(w))?2:0)+(n.startsWith(ws[0])||n.includes(" "+ws[0])?1:0)};L=L.map(z=>[sc(z),z]).sort((a,b)=>b[0]-a[0]||a[1].c-b[1].c).map(x=>x[1])}
 const el=$("#a3l");if(!el)return;el.className="";
 const card=z=>`<div class="a3"><b>${esc(z.n)}</b><div class="a3m">${z.f.filter(x=>x!=="other").map(x=>`<span class="tag">${esc(FL(x))}</span>`).join("")}<span class="mut">${CENT[z.c]} تقريبًا</span></div><p>${esc(z.x)}</p>
  <div class="a3r"><span class="mut">مراجع للتوسع:</span> <a href="#/book/${esc(z.b)}/${z.p}">سير أعلام النبلاء ${esc(z.pl||"")}</a>${(z.r||[]).map(r=>` • <a href="#/book/${esc(r[1])}/${r[2]}">${esc(r[0].replace(/ ل.*$/,""))} ${esc(r[3]||"")}</a>`).join("")} • <a href="#/alam?q=${encodeURIComponent(z.n)}">كل ما ورد عنه في المكتبة</a>${A3D?` • <a href="${A3D(z.n)}" target="_blank" rel="noopener">ترجمته في الدرر السنية ↗</a>`:""}</div></div>`;
 const PER=60,pg=Math.max(1,+q.pg||1),pages=Math.ceil(L.length/PER);
 let body;
 if(o==="f"){const g=new Map();L.forEach(z=>{const k=z.f[0];if(!g.has(k))g.set(k,[]);g.get(k).push(z)});body=[...g.entries()].sort((a,b)=>F.findIndex(x=>x[0]===a[0])-F.findIndex(x=>x[0]===b[0])).map(([k,l])=>`<details class="a3g"${f||ws.length?" open":""}><summary><b>${esc(FL(k))}</b> <span class="mut">(${toAr(l.length)})</span></summary>${l.slice(0,f||ws.length?400:40).map(card).join("")}${l.length>(f||ws.length?400:40)?`<p><a class="btn s" href="${u({f:k})}">عرض الكل</a></p>`:""}</details>`).join("")}
 else body=L.slice((pg-1)*PER,pg*PER).map((z,i,arr)=>(i===0||arr[i-1].c!==z.c?`<h3 class="a3h">${CENT[z.c]}</h3>`:"")+card(z)).join("")+(pages>1?`<div class="pgn">${pg>1?`<a class="btn s" href="${u({pg:pg-1})}">السابقة</a>`:""}<span class="mut">صفحة ${toAr(pg)} من ${toAr(pages)}</span>${pg<pages?`<a class="btn s" href="${u({pg:pg+1})}">التالية</a>`:""}</div>`:"");
 el.innerHTML=`<p class="mut">${toAr(L.length)} علمًا${c?" في "+CENT[c]:""}${f?" • "+esc(FL(f)):""}. القرن تقريبي بحسب طبقات الذهبي، والمراجع الإضافية مطابقة بالاسم فتُراجع.</p>`+(body||'<p class="mut">لا نتائج.</p>')}
// الدرر السنية ترفض الجلب الآلي (403)، فالرابط بحث عن العلم داخل موقعها يفتحه القارئ بنفسه
const A3D=n=>"https://www.google.com/search?q="+encodeURIComponent("site:dorar.net "+n.split(" ").slice(0,5).join(" "));
document.addEventListener("submit",e=>{const f=e.target;if(!f.dataset||f.dataset.form!=="a3q")return;e.preventDefault();e.stopImmediatePropagation();const v=f.q.value.trim();location.hash="#/tarajim?t=aam"+(v?"&q="+encodeURIComponent(v):"")},true);
document.addEventListener("submit",e=>{const f=e.target;if(!f.dataset||f.dataset.form!=="tjq")return;e.preventDefault();e.stopImmediatePropagation();const p=new URLSearchParams();if(f.t.value==="aam")p.set("t","aam");if(f.q.value.trim())p.set("q",f.q.value.trim());go("#/tarajim"+(p+""?"?"+p:""))},true);
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
 // فوائد منتقاة من كتب المشايخ بنصها (data/fawaid.json): تامة المعنى، مدققة، مجدولة يومًا بيوم
 try{const r=await fetch("https://raw.githubusercontent.com/"+(CFG.repo||"dawah-library/sdsl-library")+"/main/data/fawaid.json?t="+Math.floor(Date.now()/600e3));if(r.ok){const F=await r.json(),td=today();(F.items||[]).filter(x=>!x.hide&&(x.date||"")<=td&&B(x.b)).forEach(x=>{const b=B(x.b);items.push({id:"fw-"+x.id,authorId:b.authorId,date:x.date,text:x.text,fw:{b:x.b,p:x.p,t:x.t||"فائدة",id:x.id},src:"من كتاب «"+(b.setTitle||b.title)+"»، "+(PL(b,x.p-1)||"ص "+x.p)})})}}catch(e){}
 const del=new Set(ls.get("posts_hidden",[]));POSTS=items.concat(ls.get("posts_local",[]).map(x=>Object.assign({mine:1},x))).filter(x=>!del.has(x.id));POSTS.sort((x,y)=>(y.date||"").localeCompare(x.date||""));return POSTS}
const actPosts=()=>lib.books.filter(b=>!b.demo&&bc(b)==="dawah").map(b=>({id:"act-"+b.id,authorId:b.authorId,date:(isArt(b)?b.date:b.added)||b.added||"",act:1,b}));
const findPost=id=>(typeof MP!=="undefined"&&MP.get(id))||(POSTS||[]).find(x=>x.id===id)||(/^act-/.test(id)?actPosts().find(x=>x.id===id):null);
const pName=x=>x.authorId?A(x.authorId).name:x.member?(x.name||"عضو"):(x.name||"مكتبة الدعوة السلفية الرقمية");
const Cloud={role:"member",author:null,isSheikh(){return this.on()&&!!Auth.user&&this.role==="sheikh"},on(){return Auth.mode==="cloud"&&!!Auth.sb},staff(){return this.on()&&!!Auth.user&&/^(admin|editor)$/.test(this.role)},
 async loadRole(){this.role="member";if(!this.on()||!Auth.user)return;Prefs.pull();try{const {data}=await Auth.sb.from("profiles").select("role,author_id").eq("id",Auth.user.id).maybeSingle();if(data&&data.role){this.role=data.role;this.author=data.author_id||null}}catch(e){}
  if(this.staff()){if(!S.admin){S.admin=true;saveS()}applyLabels();merge();let first=false;try{first=!sessionStorage.getItem("admOpen");sessionStorage.setItem("admOpen","1")}catch(e){}if(first&&!parse().p[0])location.hash="#/admin"}}};
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
  try{if(typeof HZ!=="undefined"){const d=HZ.due().length;if(d)out.push({id:"hifz:"+today(),title:"حان وقت مراجعة محفوظك",body:toAr(d)+" بطاقة مستحقة في «حفظ المتون»",url:"#/hifz",at:new Date().toISOString(),local:1})}}catch(e){}
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
async function paintNotes(rd){rd=rd||$("#rb");if(rd)paintMarks(rd);if(!rd||!Auth.user)return;const bid=rd.dataset.id,p=+rd.dataset.p;try{const l=(await Mine.notesOf(bid)).filter(n=>n.page===p);if(l.length)hlWords(rd,l)}catch(e){}}
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
 const t=q.t||"marks",tabs=[["marks","العلامات"],["notes","تعليقاتي"],["plans","مشاريع القراءة"],["off","دون إنترنت"]];
 view(`<h2>مكتبتي</h2><div class="tabs" role="tablist">${tabs.map(([k,n])=>`<a role="tab" href="#/mine?t=${k}" aria-selected="${k===t}">${n}</a>`).join("")}</div><div id="minebox" class="mut">جارٍ التحميل…</div>`);
 const box=$("#minebox");box.className="";const bk=(id,p)=>`#/book/${id}/${p}`;
 try{if(t==="marks"){const m=Object.values(await Mine.loadMarks()).sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
   box.innerHTML=m.length?m.map(x=>`<a class="bk" href="${bk(x.book_id,x.page)}"><b><i class="rib-mini"></i> ${esc(x.title||(B(x.book_id)||{}).title||x.book_id)}</b><span>صفحة ${toAr(x.page)} • ${esc(ago(x.updated_at))}</span></a>`).join(""):"لا علامات بعد. اضغط الشريط أعلى الصفحة في القارئ لتضع علامتك."}
  else if(t==="notes"){const l=await Mine.allNotes();const g={};l.forEach(n=>(g[n.book_id]=g[n.book_id]||[]).push(n));
   box.innerHTML=(l.length?`<div class="row" style="margin-bottom:10px"><button class="btn s p" data-act="nbexp" data-f="doc">تصدير دفتري بحثًا (Word)</button><button class="btn s" data-act="nbexp" data-f="txt">نصًا</button><button class="btn s" data-act="tashtog2">${S.tash?"التصدير بالتشكيل ✓":"التصدير بلا تشكيل ✓"}</button></div>`:"")+(l.length?Object.entries(g).map(([id,ns])=>`<h3>${esc(ns[0].title||(B(id)||{}).title||id)}</h3>${ns.sort((a,b)=>a.page-b.page).map(n=>`<a class="nrow" href="${bk(id,n.page)}"><blockquote class="nq" style="--hl:${(NCOL[n.color]||NCOL.y)[1]}">${esc(n.quote.length>260?n.quote.slice(0,260)+"…":n.quote)}</blockquote>${n.note?`<p>${esc(n.note)}</p>`:""}<small class="mut">صفحة ${toAr(n.page)} • ${esc(ago(n.updated_at||n.created_at))}</small></a>`).join("")}`).join(""):"لا تعليقات بعد. حدّد عبارة في أي كتاب ثم اضغط «تعليق» لتظللها وتكتب فائدتك.")}
  else if(t==="off"){const l=ls.get("offbooks",[]);box.innerHTML=l.length?l.map(k=>{const b=B(k)||lib.books.find(x=>x.set===k);return b?`<a class="bk" href="#/book/${b.id}/1"><b>${esc(b.setTitle||b.title)}</b><span>${esc(A(b.authorId).name)} • محفوظ على هذا الجهاز</span></a>`:""}).join(""):"لم تحفظ كتابًا للقراءة دون إنترنت بعد. افتح كتابًا ثم «أدوات القراءة ← حفظ للقراءة دون إنترنت»."}
  else{const l=await Mine.loadPlans();box.innerHTML=(l.length?l.map(p=>{const b=B(p.book_id),s=planStat(p,b);return`<div class="plan"><a href="${bk(p.book_id,s.at)}"><b>${esc(p.title||(b||{}).title||"")}</b></a><div class="prog"><i style="width:${s.pct}%"></i></div><span class="mut">${s.done?"✓ أتممت الكتاب":`صفحة ${toAr(s.at)} من ${toAr(s.n)} • الورد ${pgs(p.daily)} يوميًا • التذكير ${esc(p.remind_at||"")}`}${s.behind?` • <b class="warn">متأخر ${pgs(s.behind)}</b>`:s.readToday?" • ✓ قرأت اليوم":""}</span></div>`}).join(""):"<p>لا مشاريع قراءة بعد. افتح كتابًا ثم «المزيد ← مشروع قراءة».</p>")+`<p style="margin-top:10px">${pushBtn()}</p>`}}
 catch(e){box.innerHTML=`<p class="note">${esc(e.message)}</p>`}}
function ago(d){const t=new Date(d);if(!d||isNaN(t))return"";if(/^\d{4}-\d\d-\d\d$/.test(d)){const k=Math.round((new Date(today())-t)/864e5);return k<=0?"اليوم":k===1?"أمس":fmtDate(d)}const s=(Date.now()-t)/1000;if(s<60)return"الآن";
 const f=(n,one,two,few,many)=>n===1?one:n===2?two:n<=10?`${toAr(n)} ${few}`:`${toAr(n)} ${many}`;
 if(s<3600)return"منذ "+f(Math.floor(s/60),"دقيقة","دقيقتين","دقائق","دقيقة");if(s<86400)return"منذ "+f(Math.floor(s/3600),"ساعة","ساعتين","ساعات","ساعة");
 if(s<7*86400)return"منذ "+f(Math.floor(s/86400),"يوم","يومين","أيام","يومًا");return fmtDate(d)}
const linkify=h=>h.replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u.length>48?u.slice(0,45)+"…":u}</a>`);
const KINDN={book:"كتاب جديد في المكتبة",article:"مقال",fatwa:"فتوى",statement:"بيان"};
function postText(x){if(!x.act)return x.text||"";const b=x.b;if(kindOf(b)==="book")return(b.card&&b.card.summary)||"";if(!b.pages)return"";
 const clean=t=>plain(t||"").replace(/-*\s*NO PAGE\s*NO\s*-*/gi," ").replace(/[ \t]+/g," ").trim();if(isArt(b))return clean(b.pages[0]);
 return b.pages.slice(0,25).map(clean).find(t=>t.length>350&&!/(ت|هاتف|فاكس)\s*:\s*\d{5}|رقم الإيداع|الطبعة|حقوق الطبع/.test(t.slice(0,300)))||clean(b.pages[0])}
function postHtml(x,st){st=st||{stats:{},likes:new Map(),saves:new Set()};const s=st.stats[x.id]||{likes:0,comments:0,kinds:{}},my=st.likes.get?st.likes.get(x.id):(st.likes.has(x.id)?"like":null),saved=st.saves.has(x.id),name=pName(x);
 const av=x.authorId&&A(x.authorId).photo?`<img class="av" data-author="${x.authorId}" src="${esc(A(x.authorId).photo)}" alt="">`:x.authorId?`<span class="av" data-author="${x.authorId}" style="${avHue(x.authorId)}">${esc(name.replace(/^(الشيخ|الدكتور|د\.)\s*/,"")[0]||"")}</span>`:x.member?`<a href="#/member/${x.uid}" class="av" style="${avHue(x.uid)}">${esc((x.name||"ع")[0])}</a>`:`<img class="av" src="assets/logo-sdsl-128.png" alt="">`;
 let body;if(x.member&&x.quote){body=quoteHtml(x.quote)}else if(x.act){const ex=postText(x);body=`<a class="pcard" href="#/book/${x.b.id}/1"><b>${esc(x.b.title)}</b>${ex?`<p>${esc(ex.slice(0,360))}${ex.length>360?"…":""}</p>`:""}<span>${kindOf(x.b)==="book"?"افتح الكتاب":"اقرأ كاملًا"} ←</span></a>`}
 else{const long=(x.text||"").length>420;body=`<div class="ptext${long?" clip":""}">${linkify(esc(x.text||"")).replace(/\n/g,"<br>")}</div>${long?'<button class="more-t" data-act="pmore">عرض المزيد</button>':""}${x.image?`<img class="pimg" src="${esc(x.image)}" alt="" loading="lazy">`:""}${x.url?`<a class="plink" href="${esc(x.url)}" target="_blank" rel="noopener">المنشور الأصلي ↗</a>`:""}${x.fw?`<a class="plink" href="#/book/${esc(x.fw.b)}/${x.fw.p}">📖 اقرأها في موضعها من الكتاب</a>`:""}`}
 return`<article class="post" data-id="${esc(x.id)}"><header>${av}<div><b${x.authorId?` data-author="${x.authorId}"`:""}>${x.member?`<a href="#/member/${x.uid}">${esc(name)}</a>`:esc(name)}</b><span class="mut">${x.pinned?"📌 مثبّت • ":""}${x.hidden?'<b class="warn">مخفي عن الأعضاء</b> • ':""}${x.act?KINDN[kindOf(x.b)]+" • ":x.fw?"✦ "+esc(x.fw.t)+" • ":x.sheikh?"🕌 من حساب الشيخ • ":x.member?"مختارة من كتاب • ":""}<a href="#/post/${encodeURIComponent(x.id)}">${esc(ago(x.date))}</a>${x.src?` • ${esc(x.src)}`:""}${x.demo?" • منشور تجريبي":""}</span></div><button class="pmenu" data-act="pmenu" aria-label="خيارات المنشور">⋯</button></header>
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
 ${Cloud.isSheikh()?`<div class="row ptools"><button class="btn p" data-act="shpost">✍️ منشور جديد</button></div>`:""}<a class="cmcta" href="#/community"><b>مجتمع المكتبة</b><span>مختارات الأعضاء من الكتب: تفاعل وعلّق وشارك واحفظ ←</span></a>${Auth.user&&Cloud.on()&&k==="saved"?'<div class="row ptools"><button class="btn s" data-act="pexport" data-k="saved">تصدير المحفوظات</button></div>':""}
 <div id="feed" class="feed"></div><div id="feedEnd" class="mut feedend">جارٍ التحميل…</div>`);
 let list;if(k==="saved"){if(!Auth.user){$("#feedEnd").innerHTML='<a href="#/account?next=%23%2Fposts%3Fk%3Dsaved">سجّل الدخول</a> لترى منشوراتك المحفوظة.';return}list=(await Social.savedIds()).map(findPost).filter(Boolean)}
 else if(k==="follow"){if(!Auth.user){$("#feedEnd").innerHTML='<a href="#/account?next=%23%2Fposts%3Fk%3Dfollow">سجّل الدخول</a> لترى منشورات من تتابعهم.';return}
  const fs=await Members.myFollows(),aids=new Set([...fs].filter(x=>x[0]==="a").map(x=>x.slice(2))),uids=[...fs].filter(x=>x[0]==="u").map(x=>x.slice(2));
  if(!aids.size){$("#feedEnd").innerHTML='لا تتابع أحدًا من المشايخ بعد. افتح صفحة شيخ واضغط «متابعة»؛ تظهر منشوراته هنا. ومتابعة الأعضاء في <a href="#/community?k=follow">مجتمع المكتبة</a>.';return}
  list=POSTS.concat(actPosts()).filter(x=>aids.has(x.authorId));list.sort((x,y)=>String(y.date||"").localeCompare(String(x.date||"")))}
 else{const shp=(k===""||k==="posts")&&typeof Members!=="undefined"?await Members.posts({sheikh:true,limit:120,visible:true}).catch(()=>[]):[];list=k==="lib"?actPosts():k==="posts"?POSTS.concat(shp):POSTS.concat(actPosts(),shp);list.sort((x,y)=>String(y.date||"").localeCompare(String(x.date||"")))}
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
 else if(a==="pmenu"){const canDel=!x.act&&(x.mine||GH.on||(x.member&&Auth.user&&(x.uid===Auth.user.id||Cloud.staff())));openSheet("خيارات المنشور",`<div class="tools-grid"><button data-act="plink" data-id="${esc(id)}">نسخ رابط المنشور</button>${x.member&&typeof cmMenu==="function"?cmMenu(x):""}${x.fw&&isAdmin()?`<button data-act="fwhide" data-id="${esc(x.fw.id)}">إخفاء هذه الفائدة</button><button data-act="fwedit" data-id="${esc(x.fw.id)}">تعديل حدود النص</button>`:""}${x.authorId?`<a href="#/posts?a=${x.authorId}" data-act="closeSheet">منشورات ${esc(A(x.authorId).name)}</a>`:""}${x.act?`<a href="#/book/${x.b.id}/1" data-act="closeSheet">فتح في المكتبة</a>`:""}${canDel?`<button data-act="pdel" data-id="${esc(id)}">حذف المنشور</button>`:""}</div>`)}
 else if(a==="pcopy"){if(!must())return;await navigator.clipboard.writeText(postShareText(x));closeSheet();toast("نُسخ المنشور مع اسم الكاتب والموقع.")}
 else if(a==="plink"){const u=siteLink("#/post/"+encodeURIComponent(id))||location.origin+"/post/"+encodeURIComponent(id);await navigator.clipboard.writeText(u);closeSheet();toast("نُسخ رابط المنشور")}
 else if(a==="pnative"){closeSheet();const t=postShareText(x);if(navigator.share)await navigator.share({text:t}).catch(()=>{});else{await navigator.clipboard.writeText(t);toast("نُسخ للمشاركة.")}}
 else if(a==="pimgq"){if(!must())return;closeSheet();const t=postText(x);pendingQ={t:t.length>600?t.slice(0,600)+"…":t,src:pName(x)+(x.act?" — "+x.b.title:""),ref:x.act?{b:x.b.id,p:1}:null};location.hash="#/qabasat"}
 else if(a==="pdel"){if(!confirm("حذف هذا المنشور؟"))return;closeSheet();if(x.member){await Members.del(x);toast("حُذف المنشور.");return route()}
  if(x.mine){ls.set("posts_local",ls.get("posts_local",[]).filter(y=>y.id!==id))}
  else if(GH.on){await GH.editJSON("data/posts.json",o=>{o.items=(o.items||[]).filter(y=>y.id!==id);return o},"حذف منشور");toast("حُذف المنشور، ويختفي عند الجميع خلال دقيقة.")}
  POSTS=null;route()}
 }catch(e){console.warn(e);toast(e.message||"تعذر تنفيذ الطلب")}}

/* ---------- حسابات المشايخ (عضو مميز بموافقة الإدارة) ---------- */
async function shAdmin(q){const el=$("#shadm");if(!el)return;if(!Cloud.on())return el.textContent="يحتاج قاعدة الحسابات.";
 let qq=Auth.sb.from("profiles").select("id,name,role,author_id,created_at,dm_ok").order("created_at",{ascending:false}).limit(60);if(q)qq=qq.ilike("name","%"+q+"%");const {data,error}=await qq;if(error){el.textContent=error.message;return}
 const au=lib.authors.filter(a=>a.col!=="turath").sort((x,y)=>x.name.localeCompare(y.name,"ar"));
 el.className="";el.innerHTML=`<p class="note">من هنا أيضًا تأذن لعضو بالمراسلة الخاصة مع الأعضاء المأذون لهم (زر «السماح بالمراسلة الخاصة»).</p><p class="mut">امنح أحد مشايخ الدعوة المؤلفين «حساب شيخ»: ينشر ما يشاء نصًا حرًا (لا يُشترط أن يكون من الكتب)، فيظهر منشوره للزوار والأعضاء في «منشورات المشايخ» وفي «مجتمع المكتبة» باسمه وصورته. يُطلب من الشيخ أولًا إنشاء حساب عادي في الموقع، ثم تبحث عنه هنا باسمه.</p>
 <form data-form="shq" class="stepper"><input name="q" placeholder="ابحث عن عضو باسمه" value="${esc(q||"")}"><button class="btn">بحث</button></form>
 ${(data||[]).map(p=>`<div class="bk"><b>${esc(p.name||"عضو")}</b> ${p.role==="sheikh"?'<em class="tag">حساب شيخ</em>':p.role!=="member"?`<em class="tag">${esc(p.role)}</em>`:""}<span>${esc((p.created_at||"").slice(0,10))}${p.author_id?" • مرتبط بـ "+esc(A(p.author_id).name):""}${p.dm_ok?" • مأذون بالمراسلة الخاصة":""}</span><button class="btn s" data-act="dmgrant" data-id="${p.id}" data-on="${p.dm_ok?0:1}">${p.dm_ok?"منع المراسلة الخاصة":"السماح بالمراسلة الخاصة"}</button>
 ${p.role==="admin"||p.role==="editor"?"":`<div class="row" style="margin-top:6px"><select data-sh="${p.id}"><option value="">— اختر المؤلف المرتبط —</option>${au.map(a=>`<option value="${a.id}" ${a.id===p.author_id?"selected":""}>${esc(a.name)}</option>`).join("")}</select>${p.role==="sheikh"?`<button class="btn s" data-act="shgrant" data-id="${p.id}" data-on="1">حفظ الربط</button><button class="btn s danger" data-act="shgrant" data-id="${p.id}" data-on="0">سحب الخاصية</button>`:`<button class="btn s p" data-act="shgrant" data-id="${p.id}" data-on="1">منحه حساب شيخ</button>`}</div>`}</div>`).join("")||'<p class="mut">لا نتائج.</p>'}`}
document.addEventListener("submit",e=>{const f=e.target.closest('[data-form="shq"]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();shAdmin(f.q.value.trim())},true);
document.addEventListener("click",async e=>{const el=e.target.closest('[data-act="shgrant"],[data-act="shpost"]');if(!el)return;
 if(el.dataset.act==="shpost"){if(!Cloud.isSheikh())return;openDlg(`<h3>منشور جديد</h3><p class="mut">يظهر باسمك في «منشورات المشايخ» وفي «مجتمع المكتبة».</p><form data-form="shpost"><textarea name="t" maxlength="6000" style="min-height:200px" required placeholder="اكتب منشورك…"></textarea><button class="btn p" style="margin-top:8px">نشر</button></form>`);return}
 try{const on=el.dataset.on==="1",sel=document.querySelector(`select[data-sh="${el.dataset.id}"]`),aid=sel&&sel.value||null;if(on&&!aid&&!confirm("لم تختر المؤلف المرتبط؛ يظهر المنشور باسم العضو. متابعة؟"))return;if(!on&&!confirm("سحب خاصية حساب الشيخ؟"))return;
  const {error}=await Auth.sb.from("profiles").update(on?{role:"sheikh",author_id:aid}:{role:"member",author_id:null}).eq("id",el.dataset.id);if(error)throw new Error(error.message);
  try{await Auth.sb.from("notifications").insert({user_id:el.dataset.id,title:on?"منحتك إدارة المكتبة «حساب شيخ»: يمكنك النشر في منشورات المشايخ":"سُحبت خاصية حساب الشيخ",url:"#/posts?k=posts"})}catch(x){}
  toast(on?"مُنح حساب الشيخ":"سُحبت الخاصية");shAdmin()}catch(x){toast(x.message)}});
document.addEventListener("submit",async e=>{const f=e.target.closest('[data-form="shpost"]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();const b=f.querySelector("button");b.disabled=true;
 try{const x=await Members.publishFree(f.t.value.trim());dlg().close();toast("نُشر منشورك");location.hash="#/post/"+x.id}catch(x){alert(x.message);b.disabled=false}},true);

/* ---------- إدارة التشكيل ---------- */
async function tkAdmin(){const el=$("#tkadm");if(!el)return;TK.list=null;TK.busy=false;await TK.init();const L=TK.list||{};let Q={items:[]};try{const r=await fetch(TK.raw("_queue.json"));if(r.ok)Q=await r.json()}catch(e){}
 const bs=lib.books.filter(b=>kindOf(b)==="book"&&!b.demo&&b.col==="dawah").sort((x,y)=>(x.col===y.col?0:x.col==="dawah"?-1:1)||(x.n||0)-(y.n||0));
 el.className="";el.innerHTML=`<p class="note">خدمة التشكيل لكتب مكتبة الدعوة وحدها في هذه المرحلة: تُشكَّل وتُراجَع تلقائيًا، ويمكنك تقديم كتاب على غيره في الطابور. أما كتب التراث فيُعرض تشكيلها الأصلي (إن كانت مشكولة في طبعتها) ويُخفى بحسب اختيار القارئ.</p><p class="mut">يُشكَّل الكتاب ليلًا بالحصة المجانية: يشكّله Gemini بحسب الإعراب والصرف، ثم تراجعه جولة تدقيق مستقلة (Gemini Pro إن أتاحت الحصة) كلمة كلمة. ولا يتغير حرف من نص الكتاب: تُنقل الحركات وحدها إلى حروفه، وما اختلفت حروفه يبقى كما هو. ولا تُشكَّل كتب التحويل الآلي إلا بعد اكتمال تدقيقها، ويُعاد تشكيل أي صفحة يُصحَّح نصها.</p>
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
 {h:"#/library?c=turath",n:"العامة",i:'<path d="M6 3h10l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',is:(p,q)=>p[0]==="library"&&q.c==="turath"},
 {h:"#/posts",n:"منشورات",i:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',is:(p)=>p[0]==="posts"},
 {h:"#/community",n:"المجتمع",i:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 14.3c3.2-.5 6.5 1.6 6.5 5.7"/>',is:(p)=>p[0]==="community"},
 {h:"#/qa",n:"سؤال وجواب",i:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>',is:(p)=>p[0]==="qa"},
 {h:"#/tashjir",n:"التشجير",i:'<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="12" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M12 7.2v8.6M12 11H5v4.8M12 11h7v4.8"/>',is:(p)=>p[0]==="tashjir"},
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
function route(){const{p,q}=parse(),v=p[0];if(typeof NAV!=="undefined")NAV.ui();if(v!=="book"&&TTS.on)TTS.stop();Pager.onRoute();applyLabels();$("#selq").hidden=true;closeSheet();document.body.classList.toggle("reading",v==="book");if(v!=="book")document.body.classList.remove("reading-full");
 if(!v)return vHome();if(v==="library")return vLibrary(q);if(v==="articles")return vList("article",q);if(v==="fatawa")return vList("fatwa",q);if(v==="bayanat")return vList("statement",q);
 if(v==="posts")return vPosts(q);if(v==="community")return vCommunity(q);if(v==="qa")return vQA(q,p[1]);if(v==="hifz")return vHifz(q);if(v==="paths")return vPaths(q,p[1],p[2],p[3]);if(v==="takhrij")return vTakhrij(q,p[1]);if(v==="dm")return vDM(p[1]);if(v==="tashjir")return vTashjir(q,p[1]);if(v==="audio")return vAudio(q,p[1]);if(v==="radio")return vRadio(q,p[1]);if(v==="post")return vPost(p[1]);if(v==="member")return vMember(p[1]);if(v==="messages")return vMessages();if(v==="furqan")return vFurqan(p[1],q);if(v==="releases")return REL.view(q,p[1]);if(v==="majalla")return MAJ.view(q,p[1]);if(v==="editions")return ED.view(p[1],q);if(v==="team")return TEAM.view(p[1],q);if(v==="alam")return ALAM.view(q);if(v==="ithra")return ITHRA.view(q);if(v==="summary")return LRN.vSummary(q);if(v==="quizzes")return LRN.vQuizzes(q,p[1]);if(v==="talaea")return TALA.view(q,p[1]);if(v==="tafrighat")return vTafrighat();if(v==="about")return vAbout();if(v==="dawah")return vDawah();if(v==="history")return vHistory(q,p[1]);if(v==="contact")return vContact();if(v==="authors")return vAuthors();if(v==="author")return vAuthor(p[1],q);
 if(v==="topics")return vLibrary({});if(v==="topic")return vLibrary({t:p[1]});if(v==="book"){const r=vBook(p[1],+p[2],q.h);if(q.tts)Promise.resolve(r).then(()=>setTimeout(()=>{if(typeof AP!=="undefined"&&AP.el&&!AP.el.paused)AP.toggle(false);TTS.start()},700));return r}if(v==="search")return vSearch(q);
 if(v==="qabasat")return vQabasat(q);if(v==="favs")return vFavs();if(v==="admin")return vAdmin(q);if(v==="ask"||v==="ai")return vAsk(q);if(v==="tarajim")return vTarajim(q);if(v==="tarjama")return vTarjama(p[1]);if(v==="account")return vAccount(q);if(v==="mine")return vMine(q);vHome()}
/* الروابط: يكتبها الموقع بصيغة #/… ويحوّلها إلى روابط عادية (/book/…) تفهمها محركات البحث وتُشارك كما هي */
const toPath=h=>{const p=String(h).replace(/^#/,"");return p.startsWith("/")?p:"/"+p};
/* التنقل والرجوع (الباب ٢٢): لكل خطوة رقم i في history.state، فيُعرف هل في التطبيق خطوة سابقة،
   ويُحفظ موضع التمرير لكل خطوة ويُستعاد عند الرجوع، وزر رجوع الجهاز يغلق النافذة أو اللوحة المفتوحة أولًا بدل مغادرة الصفحة،
   وفي التطبيق المثبّت لا يُغلق الرجوع التطبيقَ إن فُتح على صفحة داخلية (تُدرج الرئيسية تحتها). */
const NAV=(()=>{const ss=(k,v)=>{try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){}};
 const _rs=history.replaceState.bind(history),_ps=history.pushState.bind(history);
 const N={restoring:false,cur:null,rawPush:(st,u)=>{_ps(st,"",u);N.mark()},
  next(){const n=(+ss("navMax")||0)+1;ss("navMax",n);return n},
  i(){return(history.state&&history.state.i)||0},base(){return +ss("navBase")||0},
  ys(){try{return JSON.parse(ss("navY")||"{}")}catch(e){return{}}},
  save(){if(N.restoring)return;const y=N.ys();y[N.i()]=Math.round(scrollY);const k=Object.keys(y);if(k.length>200)delete y[k[0]];ss("navY",JSON.stringify(y))},
  mark(){N.cur={s:history.state,u:location.pathname+location.search}},
  canBack(){return N.i()>N.base()},
  parent(){const{p}=parse(),v=p[0],b=v==="book"&&typeof B==="function"?B(p[1]):null;
   if(b)return isArt(b)?(kindOf(b)==="fatwa"?"#/fatawa":kindOf(b)==="statement"?"#/bayanat":"#/articles"):"#/library?c="+bc(b);
   return({author:"#/authors",tarjama:"#/tarajim",post:"#/posts",member:"#/community",topic:"#/library"})[v]||"#/"},
  back(){if(N.canBack())history.back();else go(N.parent())},
  restore(y){N.restoring=true;const t0=Date.now();(function tick(){const max=document.documentElement.scrollHeight-innerHeight;
   if(max>=y-4||Date.now()-t0>2500){scrollTo(0,Math.min(y,Math.max(0,max)));setTimeout(()=>{N.restoring=false},120);return}setTimeout(tick,80)})()},
  overlay(){const sh=$("#sheet"),d=$("#dlg");if(d&&d.open){d.close();return true}if(sh&&!sh.hidden){closeSheet();return true}
   if(document.body.classList.contains("reading-full")&&typeof setFull==="function"){setFull(false);return true}return false},
  ui(){const bb=$("#backbtn");if(bb)bb.hidden=parse().p.length===0},
  // فتح نافذة أو لوحة يضيف خطوة في التاريخ (m) يستهلكها زر الرجوع فيغلقها؛ وإغلاقها باليد يزيل الخطوة
  mopen(){if(!(history.state&&history.state.m)){_ps({i:N.i(),m:1},"",location.pathname+location.search);N.mark()}},
  mclose(){if(N.popping)return;if(history.state&&history.state.m){N.skip=true;history.back()}}};
 history.replaceState=(st,t,u)=>{_rs(st==null&&history.state&&history.state.i!=null?{i:history.state.i}:st,t,u);N.mark()};
 history.pushState=(st,t,u)=>{N.save();_ps(st==null?{i:N.next()}:st,t,u);N.mark()};
 if(!history.state||history.state.i==null){const i=N.next();ss("navBase",String(i));
  const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  const deep=(location.hash.startsWith("#/")?location.hash.length>2:location.pathname!=="/"&&location.pathname!=="/index.html");
  if(standalone&&deep){const u=location.pathname+location.search+location.hash;_rs({i},"","/");_ps({i:N.next()},"",u)}else _rs({i},"",location.href)}
 N.mark();let st=0;addEventListener("scroll",()=>{clearTimeout(st);st=setTimeout(N.save,150)},{passive:true});
 return N})();
{const _od=openDlg,_os=openSheet,_cs=closeSheet;
 openDlg=function(){const r=_od.apply(this,arguments);NAV.mopen();return r};
 openSheet=function(){const r=_os.apply(this,arguments);NAV.mopen();return r};
 closeSheet=function(){const sh=$("#sheet"),was=sh&&!sh.hidden;const r=_cs.apply(this,arguments);if(was)NAV.mclose();return r};
 const d=$("#dlg");if(d)d.addEventListener("close",()=>NAV.mclose())}
function go(h,replace){const sameBook=(a,b)=>{const m=x=>(String(x).match(/^\/book\/([^/?]+)/)||[])[1];return m(a)&&m(a)===m(b)};
 // تقليب صفحات الكتاب نفسه لا يضيف خطوات، فالرجوع يعود إلى ما قبل الكتاب لا إلى الصفحة السابقة
 if(sameBook(toPath(h),location.pathname))replace=true;
 if(replace)history.replaceState(null,"",toPath(h));else history.pushState(null,"",toPath(h));route();NAV.ui()}
window.addEventListener("hashchange",()=>{if(location.hash.startsWith("#/")){history.replaceState({i:NAV.next()},"",toPath(location.hash))}route();NAV.ui()});
window.addEventListener("popstate",()=>{
 if(NAV.skip){NAV.skip=false;NAV.mark();return}
 // زر رجوع الجهاز مع نافذة مفتوحة: تُغلق النافذة؛ فإن كانت الخطوة خطوتها (m) انتهى الأمر، وإلا أُعيد الرابط كما كان
 NAV.popping=true;const had=NAV.overlay();NAV.popping=false;
 if(had){const c=NAV.cur;if(c&&c.s&&c.s.m&&history.state&&history.state.i===c.s.i){NAV.mark();return}if(c)NAV.rawPush(c.s,c.u);return}
 const y=NAV.ys()[NAV.i()];NAV.restoring=true;NAV.mark();route();NAV.ui();
 if(parse().p[0]!=="book"&&y>0)NAV.restore(y);else setTimeout(()=>{NAV.restoring=false},150)});
document.addEventListener("click",e=>{const a=e.target.closest('a[href^="#/"]');if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==="_blank")return;e.preventDefault();const h=a.getAttribute("href");if(toPath(h)!==location.pathname+location.search)go(h);else route()});
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]"),w=e.target.closest(".rd .w");
 const fr=e.target.closest(".rd .fnr"),dg=x=>String(x).replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d));
 if(fr&&!el){const k=dg(fr.dataset.fn||fr.textContent.replace(/[^\d٠-٩]/g,"")),fb=fr.closest(".rd").querySelector(".fnb");const hit=fb&&[...fb.querySelectorAll("p")].find(x=>dg(x.textContent).replace(/[^\d]/g," ").trim().split(/\s+/)[0]===k);if(hit){openSheet("الحاشية "+k,`<p class="rdfn">${esc(hit.textContent)}</p>`);return}}
 if(w&&!el){if(String(getSelection()).trim())return;if(w.dataset.note)return noteOpen(w.dataset.note);return}if(!el)return;const a=el.dataset.act;
 if(a==="closeDlg")dlg().close();else if(a==="navback")NAV.back();else if(a==="selmark"){const s0=selWords();if(!s0||s0.err)return toast(s0?s0.err:"حدّد النص أولًا.");openSheet("تصحيح التمييز الآلي",`<p class="mut">يُطبَّق على الكلمات المحددة في هذه الصفحة للجميع.</p><div class="tools-grid">${[["qv","آية قرآنية"],["hd","حديث نبوي"],["qt","اقتباس"],["none","إزالة التمييز"]].map(([k,t])=>`<button data-act="selmarkk" data-k="${k}">${t}</button>`).join("")}</div>`)}else if(a==="selmarkk")saveMark(el.dataset.k);else if(a==="shareSite"){const url=siteLink("#/").replace(/#\/?$/,"").replace(/\/?$/,"/"),title="مكتبة الدعوة السلفية الرقمية";
  if(navigator.share){try{await navigator.share({title,text:title+": كتب مشايخ الدعوة السلفية بمصر ومقالاتهم وكتب التراث، للقراءة والبحث.",url})}catch(x){}}
  else{try{await navigator.clipboard.writeText(url);toast("نُسخ رابط المكتبة: "+url)}catch(x){openDlg(`<h3>رابط المكتبة</h3><p>انسخ الرابط:</p><input id="sharl" readonly value="${esc(url)}" style="width:100%;direction:ltr">`);const i=$("#sharl");if(i){i.focus();i.select()}}}}
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
 else if(a==="selprint"||a==="selcopy"||a==="selshare"){const s0=String(getSelection()).trim(),rb=selRd()||$("#rb");if(!s0||!rb)return;const b=B(rb.dataset.id),i=+rb.dataset.p-1,src=`${b.setTitle||b.title} — ${A(b.authorId).name}${PL(b,i)?"، "+PL(b,i):""}`,link=siteLink(`#/book/${b.id}/${i+1}`);
  if(a==="selshare"){const txt=s0+"\n— "+src;if(navigator.share){try{await navigator.share({title:src,text:txt,url:link})}catch(x){}return}try{await navigator.clipboard.writeText(txt+"\n"+link);toast("المشاركة غير متاحة في هذا المتصفح؛ نُسخ النص مع مصدره ورابطه")}catch(x){toast("تعذر النسخ؛ انسخ النص يدويًا")}return}
  if(a==="selcopy"){const sp=[Q.sa&&A(b.authorId).name,Q.sb&&(b.setTitle||b.title)+(PL(b,i)?"، "+PL(b,i):"")].filter(Boolean).join(" — ");try{await navigator.clipboard.writeText(s0+(sp?"\n— "+sp:"")+"\n"+SITENAME+(Q.url?"\n"+link:""));toast("نُسخ النص مع مصدره")}catch(x){toast("تعذر النسخ؛ انسخ النص يدويًا")}return}
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
 else if(a==="fwhide"||a==="fwedit"){if(!GH.on)return toast("فعّل الإدارة المباشرة أولًا.");const x=(POSTS||[]).find(p=>p.fw&&p.fw.id===el.dataset.id);let nt=null;if(a==="fwedit"){nt=prompt("نص الفائدة (من الكتاب نفسه؛ احذف الزائد أو أكمل الناقص):",x?x.text:"");if(nt===null)return}else if(!confirm("إخفاء هذه الفائدة من منشورات المشايخ؟"))return;
  try{await GH.editJSON("data/fawaid.json",o=>{(o.items||[]).forEach(it=>{if(it.id===el.dataset.id){if(a==="fwhide")it.hide=1;else{it.text=nt.trim();it.edited=1}}});return o},"منشورات المشايخ: "+(a==="fwhide"?"إخفاء فائدة":"تعديل فائدة"),true);closeSheet();toast("حُفظ؛ يظهر التعديل خلال دقائق");POSTS=null}catch(x2){toast(x2.message)}}
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
 else if(a==="tfgpv"){tfgPreview(el.closest("form"))}
 else if(a==="selq"){const s=String(getSelection()).trim(),rb=selRd()||$("#rb");if(s&&rb){const b=B(rb.dataset.id),i=+rb.dataset.p-1;pendingQ={t:s,src:A(b.authorId).name+" — "+b.title+(PL(b,i)?"، "+PL(b,i):""),ref:{b:b.id,p:i+1}};location.hash="#/qabasat"}}
 else if(a==="fav"){const id=parse().p[1];S.favs=S.favs.includes(id)?S.favs.filter(x=>x!==id):[...S.favs,id];saveS();el.textContent=S.favs.includes(id)?"إزالة من المفضلة":"مفضلة"}
 else if(a==="copyp"){const rb=$("#rb"),b=B(rb.dataset.id),i=+rb.dataset.p-1;try{await navigator.clipboard.writeText(plain(shownText(b,i))+"\n— "+b.title+"، "+A(b.authorId).name+(PL(b,i)?"، "+PL(b,i):"")+"\n"+SITENAME+(siteLink()?"\n"+siteLink(`#/book/${b.id}/${i+1}`):""));el.textContent="تم النسخ"}catch(x){}}
 else if(a==="logout"){await Auth.signOut();location.hash="#/"}
 else if(a==="tr"){closeSheet();trDlg()}else if(a==="trset"){S.tr=el.dataset.l||"";saveS();const d=dlg();if(d&&d.open)d.close();const c=cur();if(c){if(!$("#trv")&&S.tr)route();else renderTr(c.b,c.p)}}else if(a==="exp"){closeSheet();expDlg()}else if(a==="editp"){closeSheet();editDlg()}else if(a==="offline")offline();
 else if(a==="mega"){const m=$("#mega"),o=m.hidden;m.hidden=!o;el.setAttribute("aria-expanded",String(o));if(o){const f=m.querySelector("a");if(f)f.focus()}}
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
  closeSheet();for(let j=1;j<=b.pages.length;j++){const x=(cur-1+j)%b.pages.length;const t=norm(plain(b.pages[x]));if(w.every(k2=>t.includes(k2)))return location.hash=`#/book/${b.id}/${x+1}?h=${encodeURIComponent(h)}`}
  // الكتاب متعدد المجلدات (ب3-41): إن لم يوجد في هذا المجلد يُبحث في المجلدات التالية ثم السابقة
  if(b.set){const vs=lib.books.filter(x=>x.set===b.set&&x.id!==b.id).sort((x,y)=>(x.vol||0)-(y.vol||0)),nx=vs.filter(x=>(x.vol||0)>(b.vol||0)).concat(vs.filter(x=>(x.vol||0)<(b.vol||0)));
   if(nx.length&&confirm("لا نتائج في هذا المجلد. البحث في بقية المجلدات ("+toAr(nx.length)+")؟")){(async()=>{for(const v of nx){toast("جارٍ البحث في "+(v.vol?"ج "+toAr(v.vol):"المقدمة")+"…");let vb;try{vb=await loadBook(v.id)}catch(e){continue}
    for(let x=0;x<vb.pages.length;x++){const t=norm(plain(vb.pages[x]));if(w.every(k2=>t.includes(k2)))return location.hash=`#/book/${v.id}/${x+1}?h=${encodeURIComponent(h)}`}}alert("لا توجد نتائج في مجلدات هذا الكتاب")})();return}}
  alert("لا توجد نتائج في هذا الكتاب")}
 else if(k==="addbook")addBook(f);else if(k==="addtfg")addTafrigh(f);else if(k==="addart")addArticle(f);else if(k==="impsave")impSave(f);
 else if(k==="signin"||k==="signup")authSubmit(f,k);else if(k==="ask")askSubmit(f)});
const selRd=()=>{const n=getSelection().anchorNode;return n&&(n.nodeType===1?n:n.parentElement).closest(".rd[data-id]")};
// شريط النص المحدد: يُحفظ آخر تحديد صالح، لأن لمس الزر في بعض متصفحات الجوال (سفاري) يُلغي التحديد قبل وصول اللمسة،
// فيُعاد التحديد قبل تنفيذ الإجراء، ويُؤجَّل إخفاء الشريط قليلًا حتى لا يختفي الزر تحت الإصبع.
let SELC=null,selHideT=0;const selOk=()=>{const s=String(getSelection()).trim();return(s.length>12||/\S\s+\S/.test(s))&&!!selRd()};
document.addEventListener("selectionchange",()=>{clearTimeout(selHideT);const q=$("#selq");
 if(selOk()){try{SELC={r:getSelection().getRangeAt(0).cloneRange(),t:Date.now()}}catch(x){}q.hidden=false;const mb=$("#selq [data-act=selmark]");if(mb)mb.hidden=!(typeof isAdmin==="function"&&isAdmin());return}
 selHideT=setTimeout(()=>{if(!selOk())q.hidden=true},500)});
(()=>{const q=$("#selq");if(!q)return;["pointerdown","mousedown"].forEach(ev=>q.addEventListener(ev,e=>{if(e.target.closest("button"))e.preventDefault()}));
 q.addEventListener("click",()=>{clearTimeout(selHideT);const g=getSelection();if(!String(g).trim()&&SELC&&Date.now()-SELC.t<300000){try{g.removeAllRanges();g.addRange(SELC.r)}catch(x){}}},true)})();
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
 if("serviceWorker"in navigator&&/^https?:/.test(location.protocol)&&!/claude|anthropic/.test(location.host)){const had=!!navigator.serviceWorker.controller;let rl=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had&&!rl){rl=true;location.reload()}});navigator.serviceWorker.register("sw.js").then(r=>{r.update&&r.update();
  // التطبيق المثبت على الهاتف يعود من الخلفية دون إعادة تحميل: يُفحص وجود إصدار جديد عند كل عودة (مرة كل ١٠ دقائق على الأكثر)
  let last=Date.now();document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-last>600e3){last=Date.now();try{r.update()}catch(e){}}})}).catch(()=>{})}
 renderTicker();await Auth.init();route()}
boot();

/* هوية الجهة في تصميم الاقتباس */
document.addEventListener("input",e=>{if(e.target.id==="qorgn"){const o=ls.get("qorg",{});o.n=e.target.value.trim();ls.set("qorg",o);if(typeof draw==="function")draw()}});
document.addEventListener("change",e=>{if(e.target.id!=="qorgl"||!e.target.files[0])return;const f=e.target.files[0],r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement("canvas"),k=Math.min(1,240/Math.max(im.width,im.height));c.width=im.width*k;c.height=im.height*k;c.getContext("2d").drawImage(im,0,0,c.width,c.height);const o=ls.get("qorg",{});o.img=c.toDataURL("image/png");ls.set("qorg",o);draw()};im.src=r.result};r.readAsDataURL(f)});
document.addEventListener("click",e=>{if(e.target.closest('[data-act="qorgx"]')){ls.set("qorg",{});const n=$("#qorgn");if(n)n.value="";draw()}});

/* حفظ كتاب (بكل مجلداته) للقراءة دون إنترنت: تُحمَّل نصوصه فيحفظها عامل الخدمة في ذاكرة الجهاز */
document.addEventListener("click",async e=>{const el=e.target.closest('[data-act="offbook"]');if(!el)return;e.preventDefault();const b=B(el.dataset.id);if(!b)return;
 const vols=b.set?lib.books.filter(x=>x.set===b.set):[b];el.disabled=true;let i=0;
 try{for(const v of vols){el.textContent="جارٍ الحفظ… "+toAr(++i)+"/"+toAr(vols.length);await loadBook(v.id)}const l=ls.get("offbooks",[]);const k=b.set||b.id;if(!l.includes(k))l.push(k);ls.set("offbooks",l);el.textContent="✓ محفوظ دون إنترنت";toast("حُفظ الكتاب؛ يُقرأ الآن ولو انقطع الإنترنت")}catch(x){toast(x.message);el.disabled=false}});
/* قائمة «الأقسام» الشاملة: تُغلق عند اختيار رابط أو الضغط خارجها أو Esc */
(()=>{const close=()=>{const m=$("#mega");if(m&&!m.hidden){m.hidden=true;const b=$(".megab");if(b)b.setAttribute("aria-expanded","false")}};
document.addEventListener("click",e=>{if(e.target.closest("#mega a")||(!e.target.closest("#mega")&&!e.target.closest(".megab")))close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});})();
