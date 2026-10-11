/* ---------- Kassenbon scannen (Tesseract im Browser) ---------- */
const TESS_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const CHAINS = ["REWE","Lidl","Aldi","Edeka","Netto","Penny","Kaufland","dm","Rossmann","Norma","Globus","tegut","Müller","Budni"];
/* Wörter, die auf dem Bon anders heißen als im Vorrat (klein, ohne Umlaute) */
const ALIAS = {
  "Klopapier":["toilettenpapier","toipa","klopapier","hygienepapier"], "Küchenrolle":["kuechentuch","kuechenrolle","kuechenpapier","haushaltsrolle"],
  "Spülmittel":["spuelmittel","spueli","pril","fairy"], "Spülmaschinentabs":["tabs","geschirrreiniger","spuelmaschine","finish","somat"],
  "Handseife":["seife","fluessigseife"], "Müllbeutel":["muellbeutel","muellsack","abfallbeutel"], "Waschmittel":["waschmittel","persil","ariel","colorwasch","vollwasch"],
  "Schwämme":["schwamm","schwaemme"], "Öl":["oel","olivenoel","sonnenblumenoel","rapsoel"], "Salz":["salz"], "Pfeffer":["pfeffer"], "Zucker":["zucker"], "Mehl":["mehl"]
};
const RC_SUM = /summe|zu zahlen|total|gesamt/i;
const RC_SKIP = /summe|zu zahlen|total|gesamt|\bbar\b|gegeben|r[uü]ckgeld|wechselgeld|ec[- ]?karte|karte|girocard|visa|mastercard|mwst|ust\b|steuer|netto|brutto|payback|punkte|bonus|tse|kasse|datum|uhrzeit|tel\.|www|danke/i;
const normTxt = s => String(s).toLocaleLowerCase("de").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss");

function parseReceipt(text){
  const lines=String(text||"").split("\n").map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
  let store="", date=null, total=null; const out=[];
  for(const l of lines.slice(0,15)){ const c=CHAINS.find(c=>new RegExp(`(^|[^a-zäöü])${c}([^a-zäöü]|$)`,"i").test(l)); if(c){ store=c; break; } }
  for(const l of lines){ const m=l.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); if(!m) continue;
    const y=+m[3]<100?2000+ +m[3]:+m[3]; const t=new Date(y,+m[2]-1,+m[1],12).getTime();
    if(t<=Date.now()+864e5 && Date.now()-t<90*864e5){ date=t; break; } }
  for(const l of lines){
    const m=l.match(/^(.*?[a-zäöüß].*?)\s+(-?\d{1,4} ?[.,] ?\d{2})( ?-)?(?:\s*(?:€|eur))?[^a-z0-9äöüß]*[a-d0-9il]?[^a-z0-9äöüß]*$/i); if(!m) continue;
    const price=Number(m[2].replace(/ /g,"").replace(",","."));
    const name=m[1].replace(/^\d{3,}\s+/,"").replace(/[^\p{L}\p{N}%.,\/&+\- ]/gu,"").trim();
    if(RC_SKIP.test(name)){ if(total==null && RC_SUM.test(name) && price>0) total=price; continue; }
    if(/^\d+\s*[x×*=]|^\d+[,.]\s?\d/i.test(name) || name.replace(/[^a-zäöüß]/gi,"").length<2) continue;
    if(price<0 || m[3]){ if(out.length) out[out.length-1].price=Math.round((out[out.length-1].price-Math.abs(price))*100)/100; continue; }
    out.push({name,price});
  }
  return {store,date,total,lines:out};
}

function matchItem(line){
  const words=normTxt(line).split(/[^a-z]+/).filter(w=>w.length>=3); let best=null, score=0;
  for(const it of state.items){
    const keys=[normTxt(it.name).replace(/[^a-z]/g,""),...(ALIAS[it.name]||[])].filter(k=>k.length>=3);
    for(const k of keys) for(const w of words){
      const s = (w===k||(w.includes(k)&&(k.length>=5||w.startsWith(k)||w.endsWith(k)))) ? 10+k.length : (k.length>=6&&w.length>=5&&k.startsWith(w.slice(0,5))) ? 5 : 0;
      if(s>score){ score=s; best=it; }
    }
  }
  return best;
}

function loadImg(file){ return new Promise((res,rej)=>{ const u=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ URL.revokeObjectURL(u); res(im); }; im.onerror=()=>{ URL.revokeObjectURL(u); rej(new Error("img")); }; im.src=u; }); }
/* Bild verkleinern und in Graustufen umrechnen (für OCR etwas mehr Kontrast) */
function grayCanvas(im,maxW,maxH,contrast=1){
  const s=Math.min(1,maxW/im.naturalWidth,maxH/im.naturalHeight);
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(im.naturalWidth*s)); c.height=Math.max(1,Math.round(im.naturalHeight*s));
  const x=c.getContext("2d"); x.drawImage(im,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data;
  for(let i=0;i<p.length;i+=4){ let g=.299*p[i]+.587*p[i+1]+.114*p[i+2]; g=Math.max(0,Math.min(255,(g-128)*contrast+128)); p[i]=p[i+1]=p[i+2]=g; }
  x.putImageData(d,0,0); return c;
}
/* Adaptive Schwelle (Bradley): entfernt Schatten und ungleichmäßiges Licht, Text wird schwarz auf weiß */
function binarize(c){
  const x=c.getContext("2d"), W=c.width, H=c.height, d=x.getImageData(0,0,W,H), p=d.data, I=new Uint32Array((W+1)*(H+1));
  for(let y=0;y<H;y++){ let row=0; for(let k=0;k<W;k++){ row+=p[(y*W+k)*4]; I[(y+1)*(W+1)+k+1]=I[y*(W+1)+k+1]+row; } }
  const r=Math.max(8,Math.round(W/40));
  for(let y=0;y<H;y++){ const y0=Math.max(0,y-r), y1=Math.min(H,y+r+1);
    for(let k=0;k<W;k++){ const x0=Math.max(0,k-r), x1=Math.min(W,k+r+1);
      const sum=I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0], i=(y*W+k)*4;
      p[i]=p[i+1]=p[i+2] = p[i]*(x1-x0)*(y1-y0) < sum*.88 ? 0 : 255; } }
  x.putImageData(d,0,0); return c;
}
/* Schräg fotografierten Bon geraderücken: Winkel mit den schärfsten Textzeilen suchen (−6° bis +6°) */
function deskew(c){
  const sm=document.createElement("canvas"), f=Math.min(1,500/c.width); sm.width=Math.round(c.width*f); sm.height=Math.round(c.height*f);
  sm.getContext("2d").drawImage(c,0,0,sm.width,sm.height); binarize(sm);
  const rot=(src,a,W,H)=>{ const t=document.createElement("canvas"); t.width=W; t.height=H; const x=t.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,W,H);
    x.translate(W/2,H/2); x.rotate(a*Math.PI/180); x.drawImage(src,-src.width/2,-src.height/2); return t; };
  let best=0, bs=-1;
  for(let a=-6;a<=6;a+=.5){ const t=rot(sm,a,sm.width,sm.height), d=t.getContext("2d").getImageData(0,0,t.width,t.height).data; let sc=0, prev=0;
    for(let y=0;y<t.height;y++){ let r=0; for(let k=0;k<t.width;k++) if(d[(y*t.width+k)*4]<128) r++; sc+=(r-prev)**2; prev=r; }
    if(sc>bs){ bs=sc; best=a; } }
  return best ? rot(c,best,c.width,c.height) : c;
}
/* Kleine Fotos hochskalieren: Tesseract liest größere Schrift deutlich besser */
function upscale(c){
  const f=Math.min(2,2400/c.width); if(f<=1.05) return c;
  const d=document.createElement("canvas"); d.width=Math.round(c.width*f); d.height=Math.round(c.height*f);
  const x=d.getContext("2d"); x.imageSmoothingQuality="high"; x.drawImage(c,0,0,d.width,d.height); return d;
}
/* Bon-Foto stark komprimiert (Ziel: unter ~150 KB), damit es in ein Firestore-Dokument passt */
function compressImg(im){
  let w=720, h=2600, url="";
  for(let i=0;i<6;i++){ const c=grayCanvas(im,w,h,1.1); for(const q of [.55,.4,.3]){ url=c.toDataURL("image/jpeg",q); if(url.length<200000) return url; } w*=.8; h*=.8; }
  return url;
}
let tessP=null;
function loadTesseract(){ return tessP ||= new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=TESS_SRC; s.onload=()=>res(window.Tesseract); s.onerror=()=>{ tessP=null; s.remove(); rej(new Error("tesseract")); }; document.head.appendChild(s); }); }

function scanReceipt(){
  if(!me){ pickMe(); return; }
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=()=>{ const f=inp.files?.[0]; if(f) readReceipt(f); };
  inp.click();
}
async function readReceipt(file){
  let cancelled=false, worker=null;
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>Bon wird gelesen…</h2><p class="sub" id="rstat">Foto wird vorbereitet</p>
    <div class="progress"><span id="rbar"></span></div><div class="actions"><button class="btn ghost" id="rcx">Abbrechen</button></div></div>`);
  $("#modal .scrim").dataset.lock="1";
  $("#rcx").onclick=()=>{ cancelled=true; worker?.terminate(); closeModal(); };
  const stat=(t,p)=>{ if(cancelled) return; const s=$("#rstat"), b=$("#rbar"); if(s) s.textContent=t; if(b&&p!=null) b.style.width=Math.round(p*100)+"%"; };
  let im; try{ im=await loadImg(file); }catch(e){ if(!cancelled){ closeModal(); toast("Das Bild konnte nicht geöffnet werden."); } return; }
  const img=compressImg(im);
  let text="";
  try{
    stat("Texterkennung wird geladen (beim ersten Mal etwas länger)",.05);
    const T=await loadTesseract(); if(cancelled) return;
    worker=await T.createWorker("deu",1,{logger:m=>{ if(m.status==="recognizing text") stat("Text wird erkannt",.15+m.progress*.85); }});
    if(cancelled){ worker.terminate(); return; }
    await worker.setParameters({tessedit_pageseg_mode:"4"});
    text=(await worker.recognize(upscale(deskew(grayCanvas(im,1600,4500,1.5))))).data.text||"";
    if(parseReceipt(text).lines.length<2 && !cancelled){ stat("Zweiter Versuch",.5);
      const t2=(await worker.recognize(binarize(upscale(grayCanvas(im,1600,4500))))).data.text||"";
      if(parseReceipt(t2).lines.length>parseReceipt(text).lines.length) text=t2; }
    worker.terminate();
  }catch(e){ console.error(e); if(cancelled) return; toast("Bon konnte nicht gelesen werden. Trag die Artikel selbst ein."); }
  if(cancelled) return;
  const r=parseReceipt(text);
  const lines=r.lines.map(l=>{ const it=matchItem(l.name); return {name:l.name,price:l.price,itemId:it?.id||"",on:!!it}; });
  reviewReceipt({store:r.store,date:r.date,total:r.total,img,lines,text});
}

function reviewReceipt(rc){
  const L=rc.lines; if(!L.length) L.push({name:"",price:null,itemId:"",on:true});
  const opts=state.items.slice().sort((a,b)=>a.name.localeCompare(b.name,"de"));
  const lineHTML=(l,i)=>`<div class="rline ${l.on?"":"off"}" data-rl="${i}"><input type="checkbox" data-on="${i}" ${l.on?"checked":""} aria-label="Zeile übernehmen">
    <div class="rl-main"><input data-name="${i}" value="${esc(l.name)}" placeholder="Artikel" aria-label="Name auf dem Bon">
    <select data-item="${i}" aria-label="Vorrat-Artikel"><option value="">🛍️ Kein Vorrat-Artikel</option>${opts.map(it=>`<option value="${it.id}" ${it.id===l.itemId?"selected":""}>${esc(it.emoji)} ${esc(it.name)}</option>`).join("")}</select></div>
    <input class="rl-price" data-price="${i}" inputmode="decimal" value="${l.price==null?"":String(l.price.toFixed(2)).replace(".",",")}" placeholder="0,00" aria-label="Preis in €"></div>`;
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>🧾 Kassenbon</h2>
    <p class="sub">${rc.lines.length&&rc.lines[0].name?"Hak an, was für die WG war. Erkannte Vorrat-Artikel sind schon ausgewählt. Namen und Preise kannst du korrigieren.":"Nichts erkannt. Trag die WG-Artikel einfach selbst ein."}</p>
    <details class="rphoto"><summary>Foto ansehen</summary><img class="rimg" src="${rc.img}" alt="Foto vom Kassenbon"></details>
    ${rc.text!=null?`<details class="rphoto"><summary>Erkannter Text</summary><pre class="rtext">${esc(rc.text.trim()||"(nichts erkannt)")}</pre></details>`:""}
    <div class="field-row" style="grid-template-columns:1fr 1fr"><div class="field"><label for="rstore">Laden</label><input id="rstore" value="${esc(rc.store)}" placeholder="z. B. REWE" maxlength="30"></div>
    <div class="field"><label for="rdate">Datum</label><input id="rdate" type="date" value="${isoDay(rc.date||Date.now())}" max="${isoDay(Date.now())}"></div></div>
    <div class="rlines" id="rlines">${L.map(lineHTML).join("")}</div>
    <button class="btn ghost wide" id="radd" style="margin-bottom:12px">＋ Zeile hinzufügen</button>
    <div class="rsum"><span id="rcount"></span><span class="money" id="rtotal"></span></div>
    ${rc.total!=null?`<p class="hint" style="margin:-6px 2px 12px">Summe laut Bon: ${eur(rc.total)}</p>`:""}
    <div class="field"><label for="rwho">Bezahlt von</label><select id="rwho">${PEOPLE.map(p=>`<option ${p===me?"selected":""}>${p}</option>`).join("")}</select></div>
    <div class="actions"><button class="btn" id="rok">Speichern</button><button class="btn ghost" id="rx">Abbrechen</button></div></div>`);
  $("#modal .scrim").dataset.lock="1";
  const sum=()=>{ const s=L.filter(l=>l.on); $("#rcount").textContent=`${s.length} ausgewählt`; $("#rtotal").textContent=eur(s.reduce((a,l)=>a+(isFinite(toNum(l.price))?toNum(l.price)||0:0),0)); $("#rok").textContent=s.length?`${s.length} ${s.length===1?"Einkauf":"Einkäufe"} speichern`:"Speichern"; };
  const box=$("#rlines");
  box.oninput=e=>{ const t=e.target, d=t.dataset;
    if(d.name!=null){ const l=L[d.name]; l.name=t.value; if(!l.itemId){ const it=matchItem(t.value); if(it){ l.itemId=it.id; box.querySelector(`[data-item="${d.name}"]`).value=it.id; } } }
    if(d.price!=null) L[d.price].price=t.value;
    sum(); };
  box.onchange=e=>{ const t=e.target, d=t.dataset;
    if(d.on!=null){ L[d.on].on=t.checked; t.closest(".rline").classList.toggle("off",!t.checked); }
    if(d.item!=null){ L[d.item].itemId=t.value; if(t.value){ L[d.item].on=true; box.querySelector(`[data-on="${d.item}"]`).checked=true; t.closest(".rline").classList.remove("off"); } }
    sum(); };
  $("#radd").onclick=()=>{ L.push({name:"",price:null,itemId:"",on:true}); box.insertAdjacentHTML("beforeend",lineHTML(L[L.length-1],L.length-1)); box.querySelector(`[data-name="${L.length-1}"]`).focus(); sum(); };
  $("#rx").onclick=closeModal;
  sum();
  $("#rok").onclick=async()=>{
    const sel=L.filter(l=>l.on&&(l.name.trim()||l.itemId));
    if(!sel.length){ toast("Hak mindestens eine Zeile an."); return; }
    for(const l of sel){ const n=toNum(l.price); if(Number.isNaN(n)||n<0){ box.querySelector(`[data-price="${L.indexOf(l)}"]`).focus(); toast("Preis bitte als Zahl, z. B. 3,49"); return; } }
    const who=$("#rwho").value, store=$("#rstore").value.trim(), day=$("#rdate").value;
    const at = !day||day===isoDay(Date.now()) ? Date.now() : new Date(day+"T12:00").getTime();
    const items=sel.map(l=>{ const it=state.items.find(i=>i.id===l.itemId); const price=toNum(l.price); return {it,name:l.name.trim()||it.name,price}; });
    const total=items.reduce((a,x)=>a+(x.price||0),0);
    $("#rok").disabled=true; $("#rok").textContent="Wird gespeichert…";
    const rid=await Store.addReceipt({store,date:at,who,by:me,at:Date.now(),img:rc.img,ocrTotal:rc.total,total:Math.round(total*100)/100,
      lines:items.map(x=>({name:x.name,price:x.price,itemId:x.it?.id||null,item:x.it?.name||null}))});
    closeModal(); play("kauf"); confetti(); toast(pick(HERO).replace("{n}",who)+` (${items.length} Artikel vom Bon)`);
    items.forEach(x=>x.it&&cancelPush("item:"+x.it.id)); sendPush("kauf", `🧾 ${who} war einkaufen${store?" bei "+store:""}`, `${items.map(x=>x.it?x.it.emoji+" "+x.it.name:x.name).join(", ")} · ${eur(total)}. Held des Tages! 🦸`, "tada");
    const done=new Set();
    for(const x of items){
      if(x.it && !done.has(x.it.id)){ done.add(x.it.id); const {id:_,...rest}=x.it; await Store.setItem(x.it.id,{...rest,status:"full",by:who,boughtBy:who,at:Date.now()}); }
      const p={item:x.it?x.it.name:x.name,itemId:x.it?.id||null,emoji:x.it?.emoji||"🛍️",who,price:x.price,at,store:store||null};
      if(rid) p.receiptId=rid; if(x.it&&x.name!==x.it.name) p.label=x.name;
      await Store.addPurchase(p);
    }
  };
}

async function receiptSheet(id){
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>🧾 Kassenbon</h2><p class="sub">Wird geladen…</p></div>`);
  const r=await Store.getReceipt(id);
  if(!$("#modal .sheet")) return;
  if(!r){ $("#modal .sheet").innerHTML=`<h2>🧾 Kassenbon</h2><p class="sub">Dieser Bon ist nicht mehr da.</p><div class="actions"><button class="btn ghost" id="rvx">Schließen</button></div>`; $("#rvx").onclick=closeModal; return; }
  $("#modal .sheet").innerHTML=`<h2>🧾 ${esc(r.store||"Kassenbon")}</h2><p class="sub">${new Date(r.date).toLocaleDateString("de-DE")} · bezahlt von ${esc(r.who)}</p>
    ${r.img?`<img class="rimg" src="${r.img}" alt="Foto vom Kassenbon">`:""}
    <div class="card balance" style="box-shadow:none;background:var(--surface-2);margin-bottom:12px">${(r.lines||[]).map(l=>`<div><span>${esc(l.item&&l.item!==l.name?l.name+" → "+l.item:l.name)}</span><span class="money">${l.price==null?"–":eur(l.price)}</span></div>`).join("")}
    <div style="border-top:1px solid var(--line);padding-top:6px"><b>Für die WG</b><span class="money">${eur(r.total)}</span></div>
    ${r.ocrTotal!=null?`<div><span>Summe laut Bon</span><span class="money">${eur(r.ocrTotal)}</span></div>`:""}</div>
    <div class="actions"><button class="btn ghost" id="rvx">Schließen</button></div>`;
  $("#rvx").onclick=closeModal;
}
