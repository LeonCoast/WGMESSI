/* ---------- Vorrat, Einkaufsliste, Kaufen, Artikel bearbeiten ---------- */
let firstItems=true;
function onItems(items,changes){
  state.items = items.slice().sort((a,b)=>(a.order??0)-(b.order??0)||String(a.name).localeCompare(b.name,"de"));
  state.loaded = true;
  if(firstItems){ firstItems=false; render(); checkWelcome(); return; }
  // live alerts from roommates while the app is open
  for(const ch of changes){
    if(ch.type!=="modified"&&ch.type!=="added") continue;
    const d=ch.doc.data(); if(!d||d.by===me||!me) continue;
    if(Date.now()-(d.at||0)>60000) continue;
    if(d.status==="empty"){ toast(`${d.by}: ${quip(d.name,"empty")}`); play("siren"); }
    else if(d.status==="low"){ toast(`${d.by}: ${quip(d.name,"low")}`); play("nervous"); }
    else if(d.status==="full" && d.boughtBy){ toast(pick(HERO).replace("{n}",d.boughtBy)+` (${d.name})`); play("kauf"); }
    ls.set("wg_seen_"+me,String(Date.now()));
  }
  render();
}

function checkWelcome(){
  if(!me){ pickMe(); return; }
  const seen=+(ls.get("wg_seen_"+me)||0);
  const news=state.items.filter(i=>i.status!=="full"&&i.by&&i.by!==me&&(i.at||0)>seen);
  if(!news.length){ ls.set("wg_seen_"+me,String(Date.now())); return; }
  const worst=news.some(i=>i.status==="empty");
  const top=news.find(i=>i.name==="Klopapier"&&i.status==="empty")||news.find(i=>i.status==="empty")||news[0];
  openModal(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="wt">
    <span class="siren" aria-hidden="true">${worst?"🚨":"⚠️"}</span>
    <h2 id="wt">${esc(quip(top.name,top.status))}</h2>
    <p class="sub">Seit deinem letzten Besuch, ${esc(me)}:</p>
    <div class="alertlist">${news.map(i=>`<div class="${i.status}"><span class="em">${esc(i.emoji)}</span><div><b>${esc(i.name)}</b> ist ${ST_LABEL[i.status].toLowerCase()}<small>gemeldet von ${esc(i.by)}, ${ago(i.at)}</small></div></div>`).join("")}</div>
    <div class="actions"><button class="btn" id="wgo">Zur Einkaufsliste</button><button class="btn ghost" id="wok">Hab's gesehen</button></div></div>`);
  const done=(tab)=>{ ls.set("wg_seen_"+me,String(Date.now())); closeModal(); play(worst?"siren":"bell"); if(tab){state.tab=tab;render();} };
  $("#wgo").onclick=()=>done("liste"); $("#wok").onclick=()=>done();
}

async function cycle(id){
  const it=state.items.find(i=>i.id===id); if(!it) return;
  if(!me){ pickMe(); return; }
  const status=NEXT[it.status||"full"];
  const {id:_, ...rest}=it;
  const data={...rest,status,by:me,at:Date.now()}; delete data.boughtBy;
  play(status==="empty"?"sad":status==="low"?"nervous":"pop");
  cancelPush("item:"+id);
  if(status!=="full"){ const q=quip(it.name,status); toast(q); notifyLater("item:"+id, status==="empty"?"leer":"fastleer", `${it.emoji} ${it.name} ist ${ST_LABEL[status].toLowerCase()} (${me})`, q, status==="empty"?"rotating_light":"warning"); }
  await Store.setItem(id,data);
  const el=document.querySelector(`[data-id="${id}"]`); el?.classList.add("bump");
}

function buySheet(id){
  if(!me){ pickMe(); return; }
  if(!state.items.length){ toast("Leg zuerst Artikel im Vorrat an."); return; }
  const fixed=state.items.find(i=>i.id===id);
  const opts=state.items.slice().sort((a,b)=>(a.status==="full")-(b.status==="full")||a.name.localeCompare(b.name,"de"));
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>${fixed?esc(fixed.emoji)+" "+esc(fixed.name)+" gekauft":"Einkauf eintragen"}</h2>
    <p class="sub">Trag den Preis ein, dann sieht jeder, wer wie viel ausgelegt hat. Der Artikel springt automatisch auf Voll.</p>
    ${fixed?"":`<div class="field"><label for="bitem">Welcher Artikel?</label><select id="bitem">${opts.map(i=>`<option value="${i.id}">${esc(i.emoji)} ${esc(i.name)}${i.status!=="full"?" ("+ST_LABEL[i.status].toLowerCase()+")":""}</option>`).join("")}</select></div>`}
    <div class="field"><label for="bprice">Preis in €</label><input id="bprice" inputmode="decimal" placeholder="z. B. 3,49" autocomplete="off"></div>
    <div class="field"><label for="bwho">Gekauft von</label><select id="bwho">${PEOPLE.map(p=>`<option ${p===me?"selected":""}>${p}</option>`).join("")}</select></div>
    <div class="actions"><button class="btn" id="bok">Gekauft 🎉</button><button class="btn ghost" id="bx">Abbrechen</button></div></div>`);
  $("#bx").onclick=closeModal;
  $("#bok").onclick=async()=>{
    const raw=$("#bprice").value.trim().replace(/\s|€/g,"").replace(",",".");
    const price = raw===""?null:Number(raw);
    if(raw!=="" && (!isFinite(price)||price<0)){ $("#bprice").focus(); toast("Preis bitte als Zahl, z. B. 3,49"); return; }
    const who=$("#bwho").value;
    const it = fixed || state.items.find(i=>i.id===$("#bitem").value);
    if(!it){ closeModal(); return; }
    closeModal(); play("kauf"); confetti(); toast(pick(HERO).replace("{n}",who)+` (${it.name} ist wieder voll)`);
    cancelPush("item:"+it.id); sendPush("kauf", `${it.emoji} ${it.name} ist wieder voll`, `${who} hat eingekauft${price!=null?" ("+eur(price)+")":""}. Held des Tages! 🦸`, "tada");
    const {id:_,...rest}=it; await Store.setItem(it.id,{...rest,status:"full",by:who,boughtBy:who,at:Date.now()});
    await Store.addPurchase({item:it.name,itemId:it.id,emoji:it.emoji,who,price,at:Date.now()});
  };
}

function itemSheet(id){
  const it=id?state.items.find(i=>i.id===id):null;
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>${it?"Artikel bearbeiten":"Neuer Artikel"}</h2><p class="sub">${it?"Name, Emoji, Kategorie oder Status ändern.":"Was teilt ihr euch noch?"}</p>
    <div class="field-row"><div class="field"><label for="iemb">Symbol</label><button type="button" class="emoji-btn" id="iemb" aria-expanded="false">${esc(it?.emoji||"📦")}</button></div>
    <div class="field"><label for="inm">Name</label><input id="inm" value="${esc(it?.name||"")}" placeholder="z. B. Kaffee" maxlength="30"></div></div>
    <div class="emoji-grid" id="egrid" hidden>${EMOJIS.map(e=>`<button type="button" data-emo="${e}" aria-pressed="${e===(it?.emoji||"📦")}">${e}</button>`).join("")}
      <div class="own"><label for="iem">Eigenes Emoji (Emoji-Tastatur 🌐):</label><input id="iem" value="${esc(it?.emoji||"📦")}" maxlength="8"></div></div>
    <div class="field"><label for="icat">Kategorie</label><select id="icat">${CATS.map(c=>`<option ${c===(it?.cat||(state.cat!=="Alle"?state.cat:"Küche"))?"selected":""}>${c}</option>`).join("")}</select></div>
    <div class="statuspick" role="group" aria-label="Status">${["full","low","empty"].map(s=>`<button class="s-${s}" data-s="${s}" aria-pressed="${(it?.status||"full")===s}">${ST_LABEL[s]}</button>`).join("")}</div>
    <div class="actions"><button class="btn" id="iok">Speichern</button>${it?`<button class="btn danger" id="idel">Löschen</button>`:""}<button class="btn ghost" id="ix">Abbrechen</button></div></div>`);
  let st=it?.status||"full";
  const setEmo=e=>{ $("#iemb").textContent=e; $("#iem").value=e; document.querySelectorAll("[data-emo]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.emo===e))); };
  $("#iemb").onclick=()=>{ const g=$("#egrid"); g.hidden=!g.hidden; $("#iemb").setAttribute("aria-expanded",String(!g.hidden)); };
  document.querySelectorAll("[data-emo]").forEach(b=>b.onclick=()=>{ setEmo(b.dataset.emo); $("#egrid").hidden=true; $("#iemb").setAttribute("aria-expanded","false"); play(); });
  $("#iem").oninput=()=>{ const v=$("#iem").value.trim(); if(v){ $("#iemb").textContent=v; document.querySelectorAll("[data-emo]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.emo===v))); } };
  document.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{ st=b.dataset.s; document.querySelectorAll("[data-s]").forEach(x=>x.setAttribute("aria-pressed",x===b)); play("pop"); });
  $("#ix").onclick=closeModal;
  if(it){ let armed=false; $("#idel").onclick=async()=>{ if(!armed){ armed=true; $("#idel").textContent="Wirklich löschen?"; return;} closeModal(); play("trash"); await Store.delItem(it.id); toast(`${it.name} gelöscht`); }; }
  $("#iok").onclick=async()=>{
    const name=$("#inm").value.trim(); if(!name){ $("#inm").focus(); return; }
    const norm=s=>s.toLocaleLowerCase("de").replace(/\s+/g," ").trim();
    const dup=state.items.find(i=>i.id!==it?.id && norm(i.name)===norm(name));
    if(dup){ $("#inm").focus(); toast(`${dup.emoji} ${dup.name} gibt's schon im Vorrat.`); play("nervous"); return; }
    const nid = it?.id || uid();
    const order = it?.order ?? (Math.max(0,...state.items.map(i=>i.order||0))+1);
    const changed = !it || it.status!==st;
    await Store.setItem(nid,{name,emoji:$("#iem").value.trim()||"📦",cat:$("#icat").value,status:st,order,by:changed?(me||it?.by||""):(it?.by||me||""),at:changed?Date.now():(it?.at||Date.now())});
    closeModal(); play("pop"); toast(it?"Gespeichert":`${name} hinzugefügt`);
  };
}

async function seedStarter(){
  if(!me){ pickMe(); return; }
  let o=0; for(const [name,emoji,cat] of STARTER){ await Store.setItem(uid(),{name,emoji,cat,status:"full",order:++o,by:me,at:Date.now()}); }
  play("fanfare"); confetti();
}

function renderVorrat(){
  const items=state.items;
  if(!items.length) return binsHTML()+`<div class="empty-state"><div class="big">🧺</div><h3>Noch keine Vorräte</h3><p>Leg mit den üblichen WG-Basics los oder füg eigene Artikel hinzu.</p><div class="actions" style="max-width:340px;margin:16px auto 0"><button class="btn" id="seed">Startartikel anlegen</button><button class="btn ghost" id="addNew">Eigener Artikel</button></div></div>`;
  const c={full:0,low:0,empty:0}; items.forEach(i=>c[i.status||"full"]++);
  const cats=["Alle",...CATS.filter(k=>items.some(i=>i.cat===k))];
  if(!cats.includes(state.cat)) state.cat="Alle";
  const shown = state.cat==="Alle"?items:items.filter(i=>i.cat===state.cat);
  const groups = state.cat==="Alle" ? CATS.map(k=>[k,shown.filter(i=>i.cat===k)]).filter(g=>g[1].length) : [[state.cat,shown]];
  const tile=i=>`<button class="tile ${i.status||"full"}" data-id="${i.id}" aria-label="${esc(i.name)}: ${ST_LABEL[i.status||"full"]}. Tippen zum Ändern">
      ${state.edit?`<span class="edit" data-edit="${i.id}" aria-hidden="true">✏️</span>`:""}
      <span class="em">${esc(i.emoji)}</span><span class="nm">${esc(i.name)}</span><span class="st">${ST_LABEL[i.status||"full"]}</span></button>`;
  return binsHTML()+`<div class="summary"><span class="pill ok"><span class="dot"></span>${c.full} voll</span><span class="pill low"><span class="dot"></span>${c.low} fast leer</span><span class="pill empty"><span class="dot"></span>${c.empty} leer</span></div>
    <p class="mood">${esc(mood(items))}</p>
    <div class="cats" role="group" aria-label="Kategorie">${cats.map(k=>`<button data-cat="${k}" aria-pressed="${k===state.cat}">${k}</button>`).join("")}<button data-toggle-edit aria-pressed="${state.edit}">${state.edit?"Fertig":"✏️ Bearbeiten"}</button></div>
    ${groups.map(([k,arr])=>`${state.cat==="Alle"?`<div class="section-h">${k}</div>`:""}<div class="grid">${arr.map(tile).join("")}${(state.cat!=="Alle"||k===groups[groups.length-1][0])?`<button class="tile add-tile" id="addNew"><span class="em">＋</span><span class="nm">Neuer Artikel</span></button>`:""}</div>`).join("")}
    <p class="hint">${state.edit?"Tippe auf ✏️, um einen Artikel zu ändern oder zu löschen.":"Antippen wechselt: Voll → Fast leer → Leer → Voll. Gekauft? In der Einkaufsliste abhaken, dann wird es automatisch wieder grün."}</p>`;
}

function renderListe(){
  const need=state.items.filter(i=>i.status!=="full").sort((a,b)=>(a.status==="empty"?0:1)-(b.status==="empty"?0:1));
  const quick=`<button class="btn wide" data-scan style="margin-top:12px">🧾 Kassenbon scannen</button><button class="btn ghost wide" id="manual" style="margin-top:8px">＋ Weiteren Artikel als gekauft eintragen</button>`;
  if(!need.length) return `<div class="empty-state"><div class="big">🏆</div><h3>Nichts zu kaufen!</h3><p>${esc(pick(["Die WG ist bestens versorgt. Ihr seid Legenden.","Leerer Einkaufszettel. Gönnt euch was."]))}</p></div>${quick}`;
  return `<p class="mood">${need.length} ${need.length===1?"Sache fehlt":"Sachen fehlen"}. Wer geht?</p>
  <div class="list">${need.map(i=>`<div class="row"><span class="stbar" style="background:var(--${i.status})"></span><span class="em">${esc(i.emoji)}</span>
    <div class="tx"><b>${esc(i.name)}</b><span>${ST_LABEL[i.status]} · ${esc(i.by||"?")}, ${ago(i.at||Date.now())}</span></div>
    <button class="btn" data-buy="${i.id}">Gekauft</button></div>`).join("")}</div>${quick}`;
}
