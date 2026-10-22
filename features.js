"use strict";
/* =========================================================
   features.js — الكتب المصورة والتحويل إلى نص، المنشورات، التصحيحات،
   وطبقة قاعدة البيانات (Supabase) للإدارة من داخل الموقع.
   يُحمَّل بعد app.js ويستخدم دواله العامة.
   ========================================================= */

/* ---------- أيقونات إضافية لشريط القراءة ---------- */
IC.scan='<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>';
IC.text='<path d="M5 6h14M5 10h14M5 14h10M5 18h8"/>';
const PIC={like:'<path d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 19H7"/>',cmt:'<path d="M4 5h16v11H9l-5 4V5Z"/>',share:'<path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v3"/>',save:'<path d="M6 3h12v18l-6-4-6 4V3Z"/>'};
const psvg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PIC[k]}</svg>`;

/* =========================================================
   طبقة قاعدة البيانات: الصلاحيات والتعديلات المنشورة مباشرة
   ========================================================= */
const Cloud={
 role:"member",
 on(){return Auth.mode==="cloud"&&!!Auth.sb},
 staff(){return this.on()&&!!Auth.user&&(this.role==="admin"||this.role==="editor")},
 async init(){await this.loadRole();await this.loadEdits();merge();renderTicker()},
 async loadRole(){this.role="member";if(!this.on()||!Auth.user)return;
  try{const {data}=await Auth.sb.from("profiles").select("role").eq("id",Auth.user.id).maybeSingle();if(data&&data.role)this.role=data.role}catch(e){console.warn("role",e)}},
 async loadEdits(){if(!this.on())return;
  try{const [it,ex]=await Promise.all([Auth.sb.from("items").select("id,meta,pages,toc,pl,deleted"),Auth.sb.from("catalog_extra").select("kind,id,data")]);
   const R={books:[],shards:{},authors:[],topics:[],deleted:[]};
   (it.data||[]).forEach(r=>{if(r.deleted){R.deleted.push(r.id);return}R.books.push(Object.assign({},r.meta||{},{id:r.id}));if(r.pages)R.shards[r.id]={id:r.id,pages:r.pages,toc:r.toc||[],pl:r.pl||undefined}});
   (ex.data||[]).forEach(r=>(r.kind==="author"?R.authors:R.topics).push(Object.assign({},r.data||{},{id:r.id})));
   REMOTE=R}catch(e){console.warn("edits",e)}},
 async saveItem(meta,shard){const row={id:meta.id,meta,updated_by:Auth.user.id,updated_at:new Date().toISOString()};
  if(shard){row.pages=shard.pages;row.toc=shard.toc||[];row.pl=shard.pl||null}
  const {error}=await Auth.sb.from("items").upsert(row);if(error)throw new Error("تعذر الحفظ في قاعدة البيانات: "+error.message)},
 async saveExtra(kind,obj){const {error}=await Auth.sb.from("catalog_extra").upsert({kind,id:obj.id,data:obj});if(error)throw new Error(error.message)}
};

const stripMeta=b=>{const m=Object.assign({},b);delete m.pages;delete m.toc;delete m.pl;return m};
/** يحفظ إضافة أو تعديلًا: مباشرة في قاعدة البيانات للمشرف، وإلا على هذا الجهاز (ويدخل ملف التحديث) */
async function persistItem(meta,shard){
 if(Cloud.staff()){
  for(const a of LOCAL.catalog.authors.filter(a=>/^u_a/.test(a.id))){await Cloud.saveExtra("author",a);REMOTE.authors=byId(REMOTE.authors,[a])}
  LOCAL.catalog.authors=LOCAL.catalog.authors.filter(a=>!/^u_a/.test(a.id));
  const base=stripMeta(lib.books.find(b=>b.id===meta.id)||{}),full=Object.assign(base,meta);delete full.edited;
  if(shard)full.n=shard.pages.length;
  await Cloud.saveItem(full,shard);REMOTE.books=byId(REMOTE.books,[full]);if(shard)REMOTE.shards[meta.id]=Object.assign({id:meta.id},shard);
 }else{LOCAL.catalog.books=byId(LOCAL.catalog.books,[meta]);if(shard)LOCAL.shards[meta.id]=Object.assign({id:meta.id},shard)}
 await DB.set("local",LOCAL);SH.delete(meta.id);merge();renderTicker()}

/* =========================================================
   الكتب المصورة (PDF): العرض وربط الصفحة النصية بالمصورة
   ========================================================= */
const PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
let pdfjsP=null;
const pdfjs=()=>pdfjsP||(pdfjsP=loadScript(PDFJS).then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS.replace("pdf.min.js","pdf.worker.min.js");return window.pdfjsLib}).catch(e=>{pdfjsP=null;throw e}));
const PDFDOCS=new Map();
async function openPdf(key,src){if(PDFDOCS.has(key))return PDFDOCS.get(key);const L=await pdfjs();
 const p=L.getDocument(Object.assign(typeof src==="string"?{url:src}:{data:src},{isEvalSupported:false})).promise;PDFDOCS.set(key,p);p.catch(()=>PDFDOCS.delete(key));return p}
let LOCALPDF=new Set(ls.get("localPdfs",[]));
async function localPdfData(id){const blob=await DB.get("pdf:"+id);if(!blob)throw new Error("الملف المحلي غير موجود على هذا الجهاز");return new Uint8Array(await blob.arrayBuffer())}
function scanInfo(b){if(!b)return null;if(b.pdf)return typeof b.pdf==="string"?{url:b.pdf}:b.pdf;if(LOCALPDF.has(b.id))return{local:true};return null}
/** رقم الصفحة المصورة المقابلة للصفحة النصية i (تبدأ من 0) */
function scanPage(b,i){const s=scanInfo(b)||{},lab=(b.pl&&b.pl[i])||"",m=s.map==="index"?null:lab.match(/(?:ج\s*(\d+)\s*)?ص\s*(\d+)/);
 const vol=m&&m[1]?+m[1]:1,pg=(m?+m[2]:i+1)+(+s.offset||0);
 return{vol,page:Math.max(1,pg),url:(s.vols&&s.vols[vol])||s.url||"",archive:s.archive||"",local:!!s.local}}
let SCANZ=1;
async function renderScan(b,i,el){if(!el)return;const sp=scanPage(b,i);
 el.innerHTML=`<div class="scanbar"><span>الصفحة ${toAr(sp.page)} في النسخة المصورة${(scanInfo(b).vols)?` • المجلد ${toAr(sp.vol)}`:""}</span><span class="row nf" style="gap:4px"><button class="btn s" data-act="szo" aria-label="تصغير">−</button><button class="btn s" data-act="szi" aria-label="تكبير">+</button>${sp.url?`<a class="btn s" href="${esc(sp.url)}#page=${sp.page}" target="_blank" rel="noopener">فتح الملف</a>`:""}</span></div><div class="scanpg"><p class="mut" style="padding:30px;text-align:center">جارٍ تحميل الصفحة المصورة…</p></div>`;
 const box=el.querySelector(".scanpg");
 if(sp.archive&&!sp.url){box.innerHTML=`<iframe class="scanif" title="النسخة المصورة" src="https://archive.org/embed/${encodeURIComponent(sp.archive)}#page/n${sp.page-1}/mode/1up" allowfullscreen></iframe>`;return}
 try{const doc=sp.local?await openPdf("local:"+b.id,await localPdfData(b.id)):await openPdf(sp.url,sp.url);
  const n=Math.min(doc.numPages,sp.page),page=await doc.getPage(n),dpr=window.devicePixelRatio||1,w=Math.max(280,box.clientWidth||600)*SCANZ;
  const v1=page.getViewport({scale:1}),vp=page.getViewport({scale:w/v1.width*dpr}),c=document.createElement("canvas");
  c.width=vp.width;c.height=vp.height;c.style.width=(vp.width/dpr)+"px";c.setAttribute("role","img");c.setAttribute("aria-label","الصفحة المصورة "+n);
  await page.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;if(!box.isConnected)return;box.innerHTML="";box.appendChild(c);
  if(sp.page>doc.numPages)box.insertAdjacentHTML("afterbegin",`<p class="note">رقم الصفحة (${toAr(sp.page)}) أكبر من عدد صفحات الملف (${toAr(doc.numPages)})؛ عدّل «إزاحة الصفحات» من الإدارة.</p>`)}
 catch(e){console.warn("pdf",e);box.innerHTML=sp.url?`<iframe class="scanif" title="النسخة المصورة" src="${esc(sp.url)}#page=${sp.page}"></iframe><p class="mut">إن لم تظهر الصفحة فاضغط «فتح الملف».</p>`:`<p class="note">تعذر عرض الملف المصور: ${esc(e.message||"")}</p>`}}

/* =========================================================
   التحويل من مصور إلى نص (OCR)
   ========================================================= */
const TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let tessW=null;
async function ocrTess(canvas,onP){if(!window.Tesseract)await loadScript(TESS);
 if(!tessW)tessW=await window.Tesseract.createWorker("ara",1,{logger:m=>{if(m.status==="recognizing text"&&OCR.onP)OCR.onP(m.progress)}});
 OCR.onP=onP;const {data}=await tessW.recognize(canvas);return cleanOcr(data.text)}
async function ocrAI(canvas){let c=canvas;if(c.width>1700){const s=1700/c.width,d=document.createElement("canvas");d.width=1700;d.height=Math.round(c.height*s);d.getContext("2d").drawImage(c,0,0,d.width,d.height);c=d}
 const r=await fetch(CFG.ocrEndpoint||"api/ocr",{method:"POST",headers:Object.assign({"content-type":"application/json"},Auth.token?{Authorization:"Bearer "+Auth.token}:{}),body:JSON.stringify({image:c.toDataURL("image/jpeg",.85)})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||(r.status===404?"خدمة التحويل بالذكاء الاصطناعي غير متاحة هنا.":"تعذر التحويل"));return j.text||""}
const cleanOcr=t=>String(t||"").replace(/[ \t]+/g," ").split("\n").map(l=>l.trim()).join("\n").replace(/\n{3,}/g,"\n\n").trim();
const OCR={run:false,stop:false,pages:[],onP:null,src:null};
async function ocrPages(){const fileIn=$("#ocrf"),url=$("#ocru").value.trim(),a=Math.max(1,+$("#ocra").value||1),bb=Math.max(a,+$("#ocrb").value||a),eng=$("#ocre").value,st=$("#ocrst"),out=$("#ocrout");
 const files=[...(fileIn.files||[])];if(!files.length&&!url)return alert("اختر ملفًا من جهازك أو ضع رابط ملف PDF");
 OCR.run=true;OCR.stop=false;OCR.pages=[];out.innerHTML="";$("#ocrgo").disabled=true;$("#ocrstop").hidden=false;$("#ocrsave").hidden=true;
 const canvases=[];
 try{
  const imgs=files.filter(f=>/^image\//.test(f.type)),pdf=files.find(f=>f.type==="application/pdf"||/\.pdf$/i.test(f.name));
  if(imgs.length){for(const f of imgs){const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=URL.createObjectURL(f)});const c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext("2d").drawImage(im,0,0);canvases.push({n:canvases.length+1,c})}}
  else{OCR.src=url||null;const doc=pdf?await openPdf("ocr:"+pdf.name+pdf.size,new Uint8Array(await pdf.arrayBuffer())):await openPdf(url,url);
   const last=Math.min(doc.numPages,bb,a+49);if(bb>a+49)st.innerHTML='<p class="note">الحد الأقصى 50 صفحة في المرة الواحدة.</p>';
   for(let n=a;n<=last&&!OCR.stop;n++){progress(st,n-a,last-a+1,"تجهيز الصفحات");const pg=await doc.getPage(n),vp=pg.getViewport({scale:2.2}),c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;canvases.push({n,c})}}
  for(let k=0;k<canvases.length&&!OCR.stop;k++){const {n,c}=canvases[k];
   st.innerHTML=`<p class="mut">يحوّل الصفحة ${toAr(n)} (${toAr(k+1)} من ${toAr(canvases.length)})…</p><div class="prog"><i style="width:${Math.round(k/canvases.length*100)}%"></i></div>`;
   let text="";try{text=eng==="ai"?await ocrAI(c):await ocrTess(c,p=>{const i=st.querySelector(".prog i");if(i)i.style.width=Math.round((k+p)/canvases.length*100)+"%"})}catch(e){text="";st.insertAdjacentHTML("beforeend",`<p class="note">الصفحة ${toAr(n)}: ${esc(e.message||String(e))}</p>`);if(eng==="ai")break}
   const th=document.createElement("canvas"),s=260/c.width;th.width=260;th.height=Math.round(c.height*s);th.getContext("2d").drawImage(c,0,0,th.width,th.height);
   OCR.pages.push({n,text});out.insertAdjacentHTML("beforeend",`<div class="ocrrow"><figure><img alt="الصفحة ${n}" src="${th.toDataURL("image/jpeg",.7)}"><figcaption>الصفحة ${toAr(n)}</figcaption></figure><textarea data-ocr="${OCR.pages.length-1}" aria-label="نص الصفحة ${n}">${esc(text)}</textarea></div>`)}
  st.innerHTML=`<p class="mut">${OCR.stop?"أُوقف التحويل. ":""}حُوّلت ${toAr(OCR.pages.length)} صفحة. راجع النصوص وصحّحها، ثم احفظها كتابًا.</p>`;if(OCR.pages.length)$("#ocrsave").hidden=false}
 catch(e){console.warn(e);st.innerHTML=`<p class="note">تعذر فتح الملف: ${esc(e.message||String(e))}. إن كان رابطًا خارجيًا فقد يمنع موقعه القراءة المباشرة؛ نزّل الملف واختره من جهازك.</p>`}
 finally{OCR.run=false;$("#ocrgo").disabled=false;$("#ocrstop").hidden=true}}
async function ocrSave(f){const fd=new FormData(f);try{if(!OCR.pages.length)throw new Error("لا توجد صفحات");
 const pages=[...document.querySelectorAll("[data-ocr]")].map(t=>t.value.trim()),pl=OCR.pages.map(p=>"ص "+p.n);
 const col=fd.get("col"),aid=await newAuthor(fd,"aid",col),id="u"+Date.now().toString(36);
 const meta={id,title:String(fd.get("title")).trim(),authorId:aid,topicId:fd.get("tid"),col,type:"book",source:String(fd.get("source")||"")+(fd.get("source")?" — ":"")+"نص محوّل من نسخة مصورة",added:new Date().toISOString(),n:pages.length};
 if(OCR.src)meta.pdf={url:OCR.src,offset:0};
 await persistItem(meta,{pages,toc:[],pl});alert("حُفظ الكتاب ("+toAr(pages.length)+" صفحة). تجده في «مكتبة الدعوة» أو «تراث».");location.hash=`#/book/${id}/1`}catch(e){alert(e.message)}}

/* =========================================================
   المنشورات
   ========================================================= */
let POSTFILE={items:[]},CLOUDPOSTS=[];
async function loadPosts(){try{const r=await fetch("data/posts.json",{cache:"no-cache"});if(r.ok)POSTFILE=await r.json()}catch(e){}
 if(Cloud.on()){try{const {data}=await Auth.sb.from("posts").select("id,author_id,body,images,source_url,published_at").order("published_at",{ascending:false}).limit(500);
  CLOUDPOSTS=(data||[]).map(r=>({id:r.id,a:r.author_id,d:r.published_at,t:r.body,img:r.images||[],src:r.source_url||"",cloud:1}))}catch(e){console.warn("posts",e)}}}
const curated=()=>{const del=new Set(LOCAL.deletedPosts||[]);return byId(byId(POSTFILE.items||[],CLOUDPOSTS),LOCAL.posts||[]).filter(p=>!del.has(p.id))};
const activity=()=>lib.books.filter(b=>!b.demo&&bc(b)==="dawah").map(b=>({id:"act-"+b.id,a:b.authorId,d:(isArt(b)?b.date:b.added)||b.added||"",act:1,b}));
const findPost=id=>curated().find(p=>p.id===id)||(/^act-/.test(id)?activity().find(p=>p.id===id):null);
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
 like(id,on){return this.toggle("post_reactions","likes",id,on)},
 save(id,on){return this.toggle("post_saves","saves",id,on)},
 async comments(id){if(Cloud.on()){const {data}=await Auth.sb.from("post_comments").select("id,user_id,user_name,body,created_at").eq("post_id",id).order("created_at",{ascending:true}).limit(300);
  return(data||[]).map(c=>({id:c.id,uid:c.user_id,name:c.user_name,text:c.body,at:c.created_at}))}return(ls.get("soc:comments",{})[id]||[])},
 async comment(id,text){const name=(Auth.user&&Auth.user.name)||"عضو";if(Cloud.on()){const {error}=await Auth.sb.from("post_comments").insert({post_id:id,user_id:Auth.user.id,user_name:name,body:text});if(error)throw new Error(error.message);return}
  const C=ls.get("soc:comments",{});(C[id]=C[id]||[]).push({id:Date.now(),uid:Auth.user.id,name,text,at:new Date().toISOString()});ls.set("soc:comments",C)},
 async delComment(id,cid){if(Cloud.on()){const {error}=await Auth.sb.from("post_comments").delete().eq("id",cid);if(error)throw new Error(error.message);return}
  const C=ls.get("soc:comments",{});C[id]=(C[id]||[]).filter(c=>String(c.id)!==String(cid));ls.set("soc:comments",C)},
 async savedIds(){if(!Auth.user)return[];if(Cloud.on()){const {data}=await Auth.sb.from("post_saves").select("post_id").eq("user_id",Auth.user.id).order("created_at",{ascending:false});return(data||[]).map(x=>x.post_id)}return ls.get(this.k("saves"),[]).slice().reverse()}};
function ago(d){const t=new Date(d);if(!d||isNaN(t))return"";const s=(Date.now()-t)/1000;if(s<60)return"الآن";
 const f=(n,one,two,few,many)=>n===1?one:n===2?two:n<=10?`${toAr(n)} ${few}`:`${toAr(n)} ${many}`;
 if(s<3600)return"منذ "+f(Math.floor(s/60),"دقيقة","دقيقتين","دقائق","دقيقة");if(s<86400)return"منذ "+f(Math.floor(s/3600),"ساعة","ساعتين","ساعات","ساعة");
 if(s<7*86400)return"منذ "+f(Math.floor(s/86400),"يوم","يومين","أيام","يومًا");return fmtDate(d)}
const initial=a=>esc((a.name||"؟").replace(/^(الشيخ|الدكتور|د\.|م\.)\s*/,"").trim()[0]||"؟");
const linkify=h=>h.replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" target="_blank" rel="noopener">${u.length>48?u.slice(0,45)+"…":u}</a>`);
const kindName={book:"كتاب جديد في المكتبة",article:"مقال",fatwa:"فتوى",statement:"بيان"};
function postText(p){if(!p.act)return p.t||"";const b=p.b;if(!b.pages)return"";
 const clean=t=>plain(t||"").replace(/-*\s*NO PAGE\s*NO\s*-*/gi," ").replace(/[ \t]+/g," ").trim();
 if(isArt(b))return clean(b.pages[0]);
 const pg=b.pages.slice(0,25).map(clean).find(t=>t.length>350&&!/(ت|هاتف|فاكس)\s*:\s*\d{5}|رقم الإيداع|الطبعة|حقوق الطبع/.test(t.slice(0,300)));return pg||clean(b.pages[0])}
function postHtml(p,st){const a=A(p.a),s=st.stats[p.id]||{likes:0,comments:0},liked=st.likes.has(p.id),saved=st.saves.has(p.id);
 let body;
 if(p.act){const ex=postText(p);body=`<a class="pcard" href="#/book/${p.b.id}/1"><b>${esc(p.b.title)}</b>${ex?`<p>${esc(ex.slice(0,360))}${ex.length>360?"…":""}</p>`:""}<span>${kindOf(p.b)==="book"?"افتح الكتاب":"اقرأ كاملًا"} ←</span></a>`}
 else{const long=(p.t||"").length>480;body=`<div class="ptext${long?" clamp":""}">${linkify(esc(p.t||""))}</div>${long?'<button class="pexp" data-act="pExpand">عرض المزيد</button>':""}${(p.img||[]).length?`<div class="pimgs n${Math.min(4,p.img.length)}">${p.img.slice(0,4).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join("")}</div>`:""}`}
 return`<article class="post" data-pid="${esc(p.id)}"><header class="phd"><span class="av">${initial(a)}</span><div class="pmeta"><a href="#/author/${p.a}" data-author="${p.a}"><b>${esc(a.name)}</b></a><span class="mut">${p.act?kindName[kindOf(p.b)]+" • ":""}<a href="#/post/${encodeURIComponent(p.id)}">${esc(ago(p.d))}</a>${p.src?` • <a href="${esc(p.src)}" target="_blank" rel="noopener">المصدر</a>`:""}</span></div><button class="pmenu" data-act="pMenu" aria-label="خيارات المنشور">⋯</button></header>
 ${body}
 <div class="pstats"><span data-likes="${s.likes}">${s.likes?`${psvg("like")} ${toAr(s.likes)}`:""}</span><button data-act="pCmt" class="lnk">${s.comments?`${toAr(s.comments)} تعليق`:""}</button></div>
 <div class="pacts"><button data-act="pLike" aria-pressed="${liked}">${psvg("like")}<span>إعجاب</span></button><button data-act="pCmt">${psvg("cmt")}<span>تعليق</span></button><button data-act="pShare">${psvg("share")}<span>مشاركة</span></button><button data-act="pSave" aria-pressed="${saved}">${psvg("save")}<span>${saved?"محفوظ":"حفظ"}</span></button></div>
 <div class="pcmts" hidden></div></article>`}
const FEED={list:[],pos:0,busy:false,obs:null};
async function vPosts(q){const k=q.k||"",tabs=[["","الكل"],["posts","منشورات المشايخ"],["lib","جديد المكتبة"],["saved","المحفوظة"]];
 const url=o=>{const n=Object.assign({k,a:q.a||""},o),p=new URLSearchParams();if(n.k)p.set("k",n.k);if(n.a)p.set("a",n.a);return"#/posts"+(p.toString()?"?"+p:"")};
 view(`<div class="feedwrap"><h2>منشورات</h2><p class="mut">منشورات مشايخ الدعوة وكتّابها، وجديد المكتبة من كتب ومقالات وفتاوى. ${Auth.user?"":"<a href=\"#/account?next=%23%2Fposts\">سجّل الدخول</a> للإعجاب والتعليق والحفظ والمشاركة."}</p>
 <div class="tabs" role="tablist">${tabs.map(([v,l])=>`<a role="tab" aria-selected="${k===v}" href="${url({k:v})}">${l}</a>`).join("")}</div>
 ${q.a?`<div class="chips" style="margin-top:8px"><a class="chip x" href="${url({a:""})}">${esc(A(q.a).name)} ✕</a></div>`:""}
 <div id="feed" class="feed"></div><div id="feedend" class="mut feedend">جارٍ التحميل…</div></div>`);
 await loadPosts();if(parse().p[0]!=="posts")return;
 let list;if(k==="saved"){if(!Auth.user){$("#feedend").innerHTML=`<a href="#/account?next=%23%2Fposts%3Fk%3Dsaved">سجّل الدخول</a> لترى منشوراتك المحفوظة.`;return}list=(await Social.savedIds()).map(findPost).filter(Boolean)}
 else{list=k==="lib"?activity():k==="posts"?curated():curated().concat(activity());list.sort((x,y)=>String(y.d||"").localeCompare(String(x.d||"")))}
 if(q.a)list=list.filter(p=>p.a===q.a);
 Object.assign(FEED,{list,pos:0,busy:false});if(FEED.obs)FEED.obs.disconnect();
 FEED.obs=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))feedMore()},{rootMargin:"700px"});FEED.obs.observe($("#feedend"));feedMore()}
async function feedMore(){if(FEED.busy||!$("#feed"))return;const batch=FEED.list.slice(FEED.pos,FEED.pos+8);
 if(!batch.length){$("#feedend").textContent=FEED.list.length?"وصلت إلى آخر المنشورات":"لا توجد منشورات بعد.";return}
 FEED.busy=true;FEED.pos+=batch.length;
 try{await Promise.all(batch.filter(p=>p.act).map(p=>loadBook(p.b.id).then(b=>{p.b=b}).catch(()=>{})));
  const st=await Social.state(batch.map(p=>p.id));if(!$("#feed"))return;$("#feed").insertAdjacentHTML("beforeend",batch.map(p=>postHtml(p,st)).join(""))}
 finally{FEED.busy=false}
 if(FEED.pos>=FEED.list.length)$("#feedend").textContent="وصلت إلى آخر المنشورات";else{const r=$("#feedend").getBoundingClientRect();if(r.top<innerHeight+700)feedMore()}}
async function vPost(id){await loadPosts();const p=findPost(id);if(!p)return view('<p class="note">المنشور غير موجود.</p>');
 if(p.act)p.b=await loadBook(p.b.id).catch(()=>p.b);const st=await Social.state([p.id]);
 view(`<div class="feedwrap"><p><a href="#/posts">← كل المنشورات</a></p><div class="feed">${postHtml(p,st)}</div></div>`);openComments($(".post"))}
function needLogin(msg){openSheet("للأعضاء المسجلين",`<p>${esc(msg||"الإعجاب والتعليق والحفظ والمشاركة متاحة لأعضاء المكتبة المسجلين.")}</p><div class="row"><a class="btn p nf" href="#/account?m=signup&next=${encodeURIComponent(location.hash)}" data-act="closeSheet">أنشئ حسابًا مجانيًا</a><a class="btn nf" href="#/account?next=${encodeURIComponent(location.hash)}" data-act="closeSheet">لدي حساب</a></div>`)}
async function openComments(post){const box=post.querySelector(".pcmts"),id=post.dataset.pid;box.hidden=false;box.innerHTML='<p class="mut">جارٍ تحميل التعليقات…</p>';
 let list=[];try{list=await Social.comments(id)}catch(e){}
 const cl=post.querySelector(".pstats .lnk");if(cl)cl.textContent=list.length?`${toAr(list.length)} تعليق`:"";
 box.innerHTML=`${list.map(c=>`<div class="cmt"><span class="av sm">${esc((c.name||"؟")[0])}</span><div><b>${esc(c.name||"عضو")}</b><p>${linkify(esc(c.text))}</p><span class="mut">${esc(ago(c.at))}${Auth.user&&(c.uid===Auth.user.id||Cloud.staff())?` • <button class="lnk" data-act="pDelC" data-cid="${esc(c.id)}">حذف</button>`:""}</span></div></div>`).join("")||'<p class="mut">لا توجد تعليقات بعد.</p>'}
 ${Auth.user?`<form class="cform" data-form="pcmt" data-id="${esc(id)}"><input name="c" placeholder="اكتب تعليقًا…" aria-label="اكتب تعليقًا" maxlength="2000" required><button class="btn s p">نشر</button></form>`:`<p class="mut"><a href="#/account?next=${encodeURIComponent(location.hash)}">سجّل الدخول</a> للتعليق.</p>`}`}
function postShareText(p){const a=A(p.a),t=p.act?`${p.b.title}\n${postText(p).slice(0,600)}`:p.t;return`${t}\n— ${a.name}\n${SITENAME}${siteLink()?"\n"+siteLink("#/post/"+encodeURIComponent(p.id)):""}`}
function shareSheet(p){openSheet("مشاركة المنشور",`<div class="tools-grid">
 <button data-act="pCopy" data-id="${esc(p.id)}">نسخ النص مع المصدر</button>
 <button data-act="pImg" data-id="${esc(p.id)}">تصميمه صورة (قبسة)</button>
 <button data-act="pNative" data-id="${esc(p.id)}">مشاركة عبر التطبيقات</button>
 <button data-act="pLink" data-id="${esc(p.id)}">نسخ رابط المنشور</button></div>
 <p class="mut" style="margin-top:10px">التصميم صورة يفتح استوديو القبسات بنص المنشور، فتختار الخلفية والمقاس المناسب (مربع، طولي، قصص، عرضي).</p>`)}
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act,post=el.closest(".post"),pid=(post&&post.dataset.pid)||el.dataset.id;
 const must=()=>{if(!Auth.user){needLogin();return false}return true};
 try{
 if(a==="pExpand"){post.querySelector(".ptext").classList.remove("clamp");el.remove()}
 else if(a==="pLike"){if(!must())return;const on=el.getAttribute("aria-pressed")!=="true";el.setAttribute("aria-pressed",on);const sp=post.querySelector("[data-likes]");const n=Math.max(0,(+sp.dataset.likes||0)+(on?1:-1));sp.dataset.likes=n;sp.innerHTML=n?`${psvg("like")} ${toAr(n)}`:"";
  try{await Social.like(pid,on)}catch(x){el.setAttribute("aria-pressed",!on);alert(x.message)}}
 else if(a==="pSave"){if(!must())return;const on=el.getAttribute("aria-pressed")!=="true";el.setAttribute("aria-pressed",on);el.querySelector("span").textContent=on?"محفوظ":"حفظ";try{await Social.save(pid,on)}catch(x){alert(x.message)}}
 else if(a==="pCmt"){const box=post.querySelector(".pcmts");if(!box.hidden&&box.innerHTML){box.hidden=true;return}openComments(post)}
 else if(a==="pDelC"){if(confirm("حذف التعليق؟")){await Social.delComment(pid,el.dataset.cid);openComments(post)}}
 else if(a==="pShare"){if(!must())return;const p=findPost(pid);if(p)shareSheet(p)}
 else if(a==="pMenu"){const p=findPost(pid);if(!p)return;const canDel=!p.act&&((LOCAL.posts||[]).some(x=>x.id===pid)||(p.cloud&&Cloud.staff()));
  openSheet("خيارات المنشور",`<div class="tools-grid"><button data-act="pLink" data-id="${esc(pid)}">نسخ رابط المنشور</button>${Auth.user?`<button data-act="pCopy" data-id="${esc(pid)}">نسخ النص</button>`:""}<a href="#/posts?a=${p.a}" data-act="closeSheet">منشورات ${esc(A(p.a).name)}</a>${p.act?`<a href="#/book/${p.b.id}/1" data-act="closeSheet">فتح في المكتبة</a>`:""}${canDel?`<button data-act="pDel" data-id="${esc(pid)}">حذف المنشور</button>`:""}</div>`)}
 else if(a==="pCopy"){if(!must())return;const p=findPost(pid);await navigator.clipboard.writeText(postShareText(p));closeSheet();toast("نُسخ النص مع المصدر واسم الموقع")}
 else if(a==="pLink"){await navigator.clipboard.writeText(siteLink("#/post/"+encodeURIComponent(pid))||location.href.split("#")[0]+"#/post/"+encodeURIComponent(pid));closeSheet();toast("نُسخ رابط المنشور")}
 else if(a==="pNative"){const p=findPost(pid);closeSheet();if(navigator.share)await navigator.share({text:postShareText(p)}).catch(()=>{});else{await navigator.clipboard.writeText(postShareText(p));toast("نُسخ النص")}}
 else if(a==="pImg"){const p=findPost(pid);closeSheet();const t=(p.act?postText(p):p.t||"").slice(0,700);pendingQ={t,src:A(p.a).name+(p.act?" — "+p.b.title:""),ref:p.act?{b:p.b.id,p:1}:null};location.hash="#/qabasat"}
 else if(a==="pDel"){if(!confirm("حذف هذا المنشور؟"))return;closeSheet();
  if(CLOUDPOSTS.some(x=>x.id===pid)&&Cloud.staff()){const {error}=await Auth.sb.from("posts").delete().eq("id",pid);if(error)throw new Error(error.message);CLOUDPOSTS=CLOUDPOSTS.filter(x=>x.id!==pid)}
  else{LOCAL.posts=(LOCAL.posts||[]).filter(x=>x.id!==pid);await DB.set("local",LOCAL)}route()}
 else if(a==="scan"){S.scanMode=S.scanMode==="scan"||S.scanMode==="both"?"text":(innerWidth>=1000?"both":"scan");saveS();LASTREAD=null;route()}
 else if(a==="szi"||a==="szo"){SCANZ=Math.max(.6,Math.min(2.5,SCANZ+(a==="szi"?.2:-.2)));const c=cur();if(c)renderScan(c.b,c.p-1,$("#scanw"))}
 else if(a==="corr")corrDlg();
 else if(a==="corrOk"||a==="corrNo")corrDecide(el);
 }catch(x){console.warn(x);alert(x.message||"تعذر تنفيذ الطلب")}});
document.addEventListener("submit",async e=>{const f=e.target.closest("[data-form]");if(!f)return;const k=f.dataset.form;
 if(k==="pcmt"){const t=String(new FormData(f).get("c")||"").trim();if(!t)return;f.querySelector("button").disabled=true;try{await Social.comment(f.dataset.id,t);openComments(f.closest(".post"))}catch(x){alert(x.message);f.querySelector("button").disabled=false}}
 else if(k==="addpost")addPost(f);else if(k==="pdflink")pdfLinkSave(f);else if(k==="ocrsave")ocrSave(f);else if(k==="corrsend")corrSend(f)});
function toast(t){let el=$("#toast");if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el)}el.textContent=t;el.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("on"),2200)}
async function addPost(f){const fd=new FormData(f);try{const t=String(fd.get("t")||"").trim();if(!t)throw new Error("اكتب نص المنشور");
 const aid=await newAuthor(fd,"aid","dawah"),d=fd.get("d")?new Date(fd.get("d")).toISOString():new Date().toISOString();
 const img=String(fd.get("img")||"").split(/\s+/).filter(u=>/^https?:\/\//.test(u)),src=String(fd.get("src")||"").trim(),id="p"+Date.now().toString(36);
 if(Cloud.staff()){for(const a of LOCAL.catalog.authors.filter(a=>/^u_a/.test(a.id))){await Cloud.saveExtra("author",a);REMOTE.authors=byId(REMOTE.authors,[a])}LOCAL.catalog.authors=LOCAL.catalog.authors.filter(a=>!/^u_a/.test(a.id));merge();
  const {error}=await Auth.sb.from("posts").insert({id,author_id:aid,body:t,images:img,source_url:src||null,published_at:d});if(error)throw new Error(error.message);toast("نُشر المنشور للجميع")}
 else{(LOCAL.posts=LOCAL.posts||[]).push({id,a:aid,d,t,img,src});await DB.set("local",LOCAL);merge();toast("حُفظ المنشور على هذا الجهاز؛ ينشر للجميع مع ملف التحديث")}
 f.reset();vAdmin({t:"posts"})}catch(e){alert(e.message)}}

/* =========================================================
   التصحيحات المقترحة من القراء
   ========================================================= */
function corrDlg(){const c=cur();if(!c)return;closeSheet();const b=c.b,i=c.p-1;
 if(Cloud.on()&&!Auth.user)return needLogin("اقتراح التصحيحات متاح للأعضاء المسجلين.");
 openDlg(`<h3>اقتراح تصحيح</h3><p class="mut">${esc(b.title)}${PL(b,i)?" — "+esc(PL(b,i)):""}. عدّل النص كما ينبغي أن يكون، واكتب ملاحظة إن شئت.</p>
 <form data-form="corrsend" data-id="${b.id}" data-p="${c.p}"><textarea name="t" style="min-height:240px">${esc(b.pages[i])}</textarea><label>ملاحظة (اختياري)</label><input name="n" placeholder="مثال: خطأ مطبعي في السطر الثالث"><button class="btn p" style="margin-top:8px">${Cloud.on()?"إرسال التصحيح للمراجعة":"إرسال عبر واتساب"}</button></form>`)}
async function corrSend(f){const fd=new FormData(f),b=B(f.dataset.id),p=+f.dataset.p,t=String(fd.get("t")||""),n=String(fd.get("n")||"");
 try{if(Cloud.on()){const {error}=await Auth.sb.from("corrections").insert({book_id:b.id,page:p,proposed:t,note:n,user_id:Auth.user.id,user_name:Auth.user.name||""});if(error)throw new Error(error.message);dlg().close();toast("شكرًا لك، أُرسل التصحيح للمراجعة")}
  else{const old=b.pages[p-1],a=old.split("\n"),c=t.split("\n"),diff=c.filter(l=>!a.includes(l)).slice(0,8).join("\n");
   window.open(waLink(`اقتراح تصحيح — ${b.title}، صفحة ${p}${PL(b,p-1)?" ("+PL(b,p-1)+")":""}\n${n?"ملاحظة: "+n+"\n":""}\nالسطور المقترحة:\n${(diff||t).slice(0,1500)}`),"_blank","noopener");dlg().close()}}catch(e){alert(e.message)}}
async function corrList(){const el=$("#corrs");if(!el)return;const {data,error}=await Auth.sb.from("corrections").select("*").eq("status","pending").order("created_at",{ascending:true}).limit(50);
 if(error){el.innerHTML=`<p class="note">${esc(error.message)}</p>`;return}
 el.innerHTML=(data||[]).map(r=>{const b=B(r.book_id);return`<div class="studio corr" data-cid="${r.id}" data-id="${esc(r.book_id)}" data-p="${r.page}" style="margin-top:10px"><b>${esc(b?b.title:r.book_id)}</b> — صفحة ${toAr(r.page)} <span class="mut">من ${esc(r.user_name||"عضو")} • ${esc(ago(r.created_at))}</span>${r.note?`<p>${esc(r.note)}</p>`:""}<textarea style="min-height:180px">${esc(r.proposed)}</textarea><div class="row"><button class="btn p nf" data-act="corrOk">اعتماد ونشر</button><button class="btn nf" data-act="corrNo">رفض</button>${b?`<a class="btn nf" href="#/book/${b.id}/${r.page}" target="_blank">النص الحالي</a>`:""}</div></div>`}).join("")||'<p class="mut">لا توجد تصحيحات بانتظار المراجعة.</p>'}
async function corrDecide(el){const box=el.closest(".corr"),ok=el.dataset.act==="corrOk";
 if(ok){const b=await loadBook(box.dataset.id),p=+box.dataset.p,pages=b.pages.slice();pages[p-1]=box.querySelector("textarea").value;await persistItem({id:b.id},{pages,toc:b.toc||[],pl:b.pl})}
 const {error}=await Auth.sb.from("corrections").update({status:ok?"accepted":"rejected"}).eq("id",+box.dataset.cid);if(error)throw new Error(error.message);
 box.outerHTML=`<p class="mut">${ok?"✓ اعتُمد التصحيح ونُشر":"رُفض التصحيح"}</p>`}

/* =========================================================
   تبويبات الإدارة الجديدة
   ========================================================= */
const bookOpts=()=>lib.books.filter(b=>!isArt(b)).sort((x,y)=>x.title.localeCompare(y.title,"ar")).map(b=>`<option value="${b.id}">${esc(b.title)} — ${esc(A(b.authorId).name)}</option>`).join("");
const ADMIN_EXT={
 posts:{label:"المنشورات",html:()=>`<p class="mut">أضف منشورًا لأحد المشايخ أو الكتّاب (مثلًا من صفحته على فيس بوك)، فيظهر في صفحة «منشورات» وفي صفحة الكاتب.</p>
  <form data-form="addpost"><div class="row"><div><label>الكاتب</label><select name="aid">${lib.authors.filter(a=>bc(a)==="dawah").map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}<option value="__new">+ كاتب جديد</option></select><input name="aidnew" placeholder="اسم الكاتب الجديد" style="margin-top:4px"></div><div><label>تاريخ النشر</label><input name="d" type="datetime-local"></div></div>
  <label>نص المنشور</label><textarea name="t" required style="min-height:160px"></textarea>
  <label>روابط الصور (اختياري، رابط في كل سطر)</label><textarea name="img" dir="ltr" style="min-height:60px"></textarea>
  <label>رابط المنشور الأصلي (اختياري)</label><input name="src" type="url" dir="ltr" placeholder="https://www.facebook.com/…">
  <button class="btn p" style="margin-top:10px">نشر</button></form>
  ${Cloud.staff()?"":`<h3>المنشورات المحفوظة على هذا الجهاز</h3>${(LOCAL.posts||[]).map(p=>`<div class="bk"><b>${esc((p.t||"").slice(0,80))}</b><span>${esc(A(p.a).name)} • ${esc(fmtDate(p.d))}</span></div>`).join("")||'<p class="mut">لا يوجد.</p>'}`}`},
 pdf:{label:"الكتب المصورة",html:()=>`<p class="mut">اربط كل كتاب بنسخته المصورة (PDF) ليتنقل القارئ بين الصفحة النصية والمصورة بضغطة. أسهل مكان مجاني للرفع: <a href="https://archive.org/create" target="_blank" rel="noopener">أرشيف الإنترنت</a>؛ بعد الرفع انسخ رابط ملف الـPDF المباشر (يبدأ بـ archive.org/download/) أو رابط صفحة الكتاب (archive.org/details/).</p>
  <form data-form="pdflink"><label>الكتاب</label><select name="id">${bookOpts()}</select>
  <label>رابط النسخة المصورة</label><input name="url" dir="ltr" placeholder="https://archive.org/download/…/….pdf">
  <div class="row"><div><label>طريقة المطابقة</label><select name="map"><option value="label">برقم الصفحة في المطبوع (ص ١٥ ← صفحة ١٥ في الملف)</option><option value="index">بترتيب الصفحة في المكتبة</option></select></div><div><label>إزاحة الصفحات</label><input name="offset" type="number" value="0"><p class="mut" style="margin:2px 0 0;font-size:.78rem">إذا كانت «ص ١» في الملف هي الصفحة ٥ فالإزاحة ٤.</p></div></div>
  <label>للكتب متعددة المجلدات (اختياري): سطر لكل مجلد بالصيغة «رقم المجلد|الرابط»</label><textarea name="vols" dir="ltr" style="min-height:60px"></textarea>
  <label>أو اختر ملف PDF من جهازك (للتجربة؛ يبقى على هذا الجهاز فقط)</label><input type="file" name="file" accept="application/pdf">
  <div class="row" style="margin-top:10px"><button class="btn p nf">حفظ الربط</button><button type="button" class="btn nf" data-act="pdfUnlink">إلغاء الربط</button></div></form>
  <h3>الكتب المربوطة</h3>${lib.books.filter(scanInfo).map(b=>`<a class="bk" href="#/book/${b.id}/1"><b>${esc(b.title)}</b><span>${scanInfo(b).local?"ملف على هذا الجهاز":esc(scanInfo(b).url||("archive.org/details/"+scanInfo(b).archive))}</span></a>`).join("")||'<p class="mut">لا يوجد بعد.</p>'}`},
 ocr:{label:"تحويل المصور إلى نص",html:()=>`<p class="mut">حوّل صفحات كتاب مصور إلى نص، ثم راجعها وصحّحها، واحفظها كتابًا جديدًا مربوطًا بنسخته المصورة.</p>
  <label>ملف PDF أو صور الصفحات من جهازك</label><input type="file" id="ocrf" accept="application/pdf,image/*" multiple>
  <label>أو رابط ملف PDF</label><input id="ocru" dir="ltr" placeholder="https://…/book.pdf">
  <div class="row"><div><label>من صفحة</label><input id="ocra" type="number" min="1" value="1"></div><div><label>إلى صفحة</label><input id="ocrb" type="number" min="1" value="5"></div>
  <div><label>طريقة التحويل</label><select id="ocre"><option value="tess">مجانية داخل المتصفح (أقل دقة)</option><option value="ai">بالذكاء الاصطناعي (أدق؛ بعد تفعيل المفتاح)</option></select></div></div>
  <div class="row" style="margin-top:10px"><button class="btn p nf" id="ocrgo" data-act="ocrGo">ابدأ التحويل</button><button class="btn nf" id="ocrstop" data-act="ocrStop" hidden>إيقاف</button></div>
  <div id="ocrst" style="margin-top:10px"></div><div id="ocrout"></div>
  <form data-form="ocrsave" id="ocrsave" hidden class="studio" style="margin-top:14px"><h3 style="margin-top:0">حفظ النص كتابًا</h3><label>العنوان</label><input name="title" required>
  <div class="row"><div><label>القسم</label><select name="col"><option value="dawah">${COL.dawah}</option><option value="turath">${COL.turath}</option></select></div><div><label>المؤلف</label><select name="aid">${lib.authors.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}<option value="__new">+ مؤلف جديد</option></select><input name="aidnew" placeholder="اسم المؤلف الجديد" style="margin-top:4px"></div><div><label>الموضوع</label><select name="tid">${lib.topics.filter(t=>t.for!=="articles").map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div></div>
  <label>المصدر أو الناشر (اختياري)</label><input name="source"><button class="btn p" style="margin-top:10px">حفظ الكتاب</button></form>
  <p class="note">التحويل المجاني يعمل داخل متصفحك دون خادم، ودقته في العربية متوسطة خاصة مع التشكيل والحواشي، فراجع كل صفحة. والتحويل بالذكاء الاصطناعي أدق ويحتاج تفعيل مفتاح Anthropic في Vercel.</p>`},
 corr:{label:"التصحيحات",cloud:true,html:()=>`<p class="mut">تصحيحات أرسلها القراء على نصوص الكتب والمقالات. راجع النص المقترح وعدّله إن لزم، ثم اعتمده فيُنشر مباشرة.</p><div id="corrs"><p class="mut">جارٍ التحميل…</p></div>`,wire:()=>corrList()}};
async function pdfLinkSave(f){const fd=new FormData(f),id=fd.get("id"),file=fd.get("file");
 try{if(file&&file.size){await DB.set("pdf:"+id,file);LOCALPDF.add(id);ls.set("localPdfs",[...LOCALPDF]);PDFDOCS.delete("local:"+id);toast("رُبط الملف على هذا الجهاز");location.hash=`#/book/${id}/1`;S.scanMode=innerWidth>=1000?"both":"scan";saveS();return}
  const u=String(fd.get("url")||"").trim();if(!u&&!String(fd.get("vols")||"").trim())throw new Error("ضع رابط الملف أو اختر ملفًا من جهازك");
  const pdf={map:fd.get("map"),offset:+fd.get("offset")||0},arc=u.match(/archive\.org\/details\/([^\/?#]+)/);if(arc)pdf.archive=arc[1];else if(u)pdf.url=u;
  const vols={};String(fd.get("vols")||"").split("\n").map(l=>l.split("|")).filter(x=>+x[0]&&/^https?:/.test((x[1]||"").trim())).forEach(x=>vols[+x[0]]=x[1].trim());if(Object.keys(vols).length)pdf.vols=vols;
  await persistItem({id,pdf},null);toast(Cloud.staff()?"رُبطت النسخة المصورة ونُشرت":"رُبطت النسخة المصورة على هذا الجهاز (تُنشر مع ملف التحديث)");S.scanMode=innerWidth>=1000?"both":"scan";saveS();location.hash=`#/book/${id}/1`}catch(e){alert(e.message)}}
document.addEventListener("click",async e=>{const el=e.target.closest("[data-act]");if(!el)return;const a=el.dataset.act;
 if(a==="ocrGo"){if(!OCR.run)ocrPages()}else if(a==="ocrStop")OCR.stop=true;
 else if(a==="pdfUnlink"){const id=new FormData(el.closest("form")).get("id");LOCALPDF.delete(id);ls.set("localPdfs",[...LOCALPDF]);if(B(id)&&B(id).pdf)await persistItem({id,pdf:null},null);toast("أُلغي الربط");vAdmin({t:"pdf"})}});
