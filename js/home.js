/* ---------- Home: To-dos und Überblick ---------- */
function todoSheet(id){
  if(!me){ pickMe(); return; }
  const t=id?state.todos.find(x=>x.id===id):null;
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>${t?"To-do bearbeiten":"Neues To-do"}</h2>
    <p class="sub">${t?`Angelegt von ${esc(t.by)}, ${ago(t.at)}.`:"Was muss in der WG erledigt werden?"}</p>
    <div class="field"><label for="ttext">Was</label><input id="ttext" value="${esc(t?.text||"")}" placeholder="z. B. Bad putzen" maxlength="80"></div>
    <div class="field"><label for="twho">Für wen</label><select id="twho"><option value="">🏠 Die ganze WG</option>${PEOPLE.map(p=>`<option value="${p}" ${p===t?.who?"selected":""}>${p}${p===me?" (du)":""}</option>`).join("")}</select></div>
    <div class="actions"><button class="btn" id="tok">Speichern</button>${t?`<button class="btn danger" id="tdel">Löschen</button>`:""}<button class="btn ghost" id="tx">Abbrechen</button></div></div>`);
  $("#tx").onclick=closeModal;
  if(t){ let armed=false; $("#tdel").onclick=async()=>{ if(!armed){ armed=true; $("#tdel").textContent="Wirklich löschen?"; return; } closeModal(); play("trash"); await Store.delTodo(t.id); }; }
  $("#tok").onclick=async()=>{
    const text=$("#ttext").value.trim(), who=$("#twho").value; if(!text){ $("#ttext").focus(); return; }
    closeModal(); play("pop");
    if(!t || t.who!==who){ if(who) sendPush("todo", `✅ Neues To-do für dich`, `${text} (von ${me})`, "white_check_mark", who); else sendPush("todo", `✅ Neues WG-To-do`, `${text} (von ${me})`, "white_check_mark"); }
    await Store.setTodo(t?.id||uid(), {...(t?{text:t.text,who:t.who,done:t.done,doneBy:t.doneBy||null,doneAt:t.doneAt||null,by:t.by,at:t.at}:{done:false,by:me,at:Date.now()}), text, who});
  };
}
async function toggleTodo(id){
  const t=state.todos.find(x=>x.id===id); if(!t) return;
  if(!me){ pickMe(); return; }
  const done=!t.done; play(done?"kauf":"pop"); if(done) toast(pick(["Erledigt 💪","Abgehakt. Stark!","Weg damit ✅"]));
  const {id:_,...rest}=t; await Store.setTodo(id,{...rest,done,doneBy:done?me:null,doneAt:done?Date.now():null});
}

/* Automatische To-dos entstehen aus dem Stand der App und verschwinden von selbst */
function autoTodos(){
  const out=[], today=isoDay(Date.now());
  const need=state.items.filter(i=>i.status!=="full").sort((a,b)=>(a.status==="empty"?0:1)-(b.status==="empty"?0:1));
  if(need.length){
    const mStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime();
    const cnt=Object.fromEntries(PEOPLE.map(n=>[n,0])); state.purchases.forEach(p=>{ if(p.kind!=="settle"&&p.at>=mStart&&p.who in cnt) cnt[p.who]++; });
    const here=PEOPLE.filter(p=>!awayOn(p,today)), min=Math.min(...here.map(p=>cnt[p])), low=here.filter(p=>cnt[p]===min);
    const turn=low.length===1&&here.length>1?low[0]:"";
    const names=need.slice(0,3).map(i=>i.name).join(", ")+(need.length>3?` +${need.length-3}`:"");
    out.push({who:turn===me?me:"",em:"🛒",title:turn===me?"Du bist mit Einkaufen dran":"Einkaufen",sub:esc(names)+(turn&&turn!==me?` · Vorschlag: ${esc(turn)}`:""),btn:`<button class="btn sm" data-go="liste">Liste</button>`});
  }
  for(const [id,name,em] of BINS){ const b=state.bins[id];
    if(b?.status==="full") out.push({who:"",em,title:`${name} rausbringen`,sub:`Voll gemeldet von ${esc(b.by)}, ${ago(b.at)}`,btn:`<button class="btn sm" data-bin="${id}">Erledigt</button>`}); }
  for(const t of money().tx) if(t.from===me && t.amount>=1)
    out.push({who:me,em:"💸",title:`${t.to} ${eur(t.amount)} zahlen`,sub:"Damit ihr wieder quitt seid",btn:`<button class="btn sm" data-settle="${t.from}|${t.to}|${t.amount}">Bezahlt</button>`});
  return out;
}
function renderHome(){
  const autos=autoTodos();
  const visible=state.todos.filter(t=>!t.done||Date.now()-(t.doneAt||0)<12*36e5).sort((a,b)=>(a.done-b.done)||(b.at-a.at));
  const autoRow=a=>`<div class="todo"><span class="em" aria-hidden="true">${a.em}</span><div class="tx"><b>${esc(a.title)}</b><span>${a.sub}</span></div>${a.btn}</div>`;
  const ownRow=t=>`<div class="todo ${t.done?"done":""}"><button class="check" data-todo-done="${t.id}" aria-pressed="${!!t.done}" aria-label="${esc(t.text)}: ${t.done?"erledigt":"offen"}">✓</button>
    <button class="tx" data-todo="${t.id}"><b>${esc(t.text)}</b><span>${t.done?`erledigt von ${esc(t.doneBy)}`:`${t.who?"für "+esc(t.who===me?"dich":t.who):"WG"} · ${esc(t.by)}, ${ago(t.at)}`}</span></button>${t.who&&t.who!==me?avatar(t.who):""}</div>`;
  const mine=[...autos.filter(a=>a.who===me).map(autoRow),...visible.filter(t=>me&&t.who===me).map(ownRow)];
  const wg=[...autos.filter(a=>a.who!==me).map(autoRow),...visible.filter(t=>!me||t.who!==me).map(ownRow)];
  const open=autos.length+state.todos.filter(t=>!t.done).length;
  const dateStr=new Date().toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});
  return `<div class="hello"><h2>${me?`Hi ${esc(me)} 👋`:"Hi 👋"}</h2><p>${esc(dateStr)} · ${open?`${open} ${open===1?"Sache":"Sachen"} offen`:"Alles erledigt ✨"}</p></div>
    <div class="section-h">Für dich</div>
    ${mine.length?`<div class="todos">${mine.join("")}</div>`:`<p class="empty-mini">Nichts für dich zu tun. Gönn dir. 🛋️</p>`}
    <div class="section-h">WG</div>
    ${wg.length?`<div class="todos">${wg.join("")}</div>`:`<p class="empty-mini">Die WG läuft. Keine offenen Aufgaben.</p>`}
    <button class="btn ghost wide" id="addTodo" style="margin-top:10px">＋ To-do anlegen</button>
    <div class="section-h">Überblick</div>
    <div class="dash">${cardVorrat()}${cardMuell()}${cardDa()}${cardGeld()}</div>`;
}
function cardVorrat(){
  const c={full:0,low:0,empty:0}; state.items.forEach(i=>c[i.status||"full"]++);
  const need=state.items.filter(i=>i.status!=="full").sort((a,b)=>(a.status==="empty"?0:1)-(b.status==="empty"?0:1));
  return `<button class="dcard" data-go="${need.length?"liste":"vorrat"}"><span class="dh"><span>🧺 Vorrat</span><span aria-hidden="true">›</span></span>
    <span class="summary mini"><span class="pill ok">${c.full}</span><span class="pill low">${c.low}</span><span class="pill empty">${c.empty}</span></span>
    <span class="dsub">${need.length?`Fehlt: ${esc(need.slice(0,3).map(i=>i.emoji+" "+i.name).join(", "))}${need.length>3?" …":""}`:state.items.length?"Alles da ✨":"Noch keine Artikel"}</span></button>`;
}
function cardMuell(){
  return `<div class="dcard"><span class="dh"><span>🗑️ Müll</span></span>
    ${BINS.map(([id,name,em])=>{ const full=state.bins[id]?.status==="full";
      return `<button class="drow" data-bin="${id}" aria-label="${name}: ${full?"voll":"okay"}. Tippen zum Ändern"><span>${em} ${name}</span><span class="tag ${full?"full":""}">${full?"Voll":"Okay"}</span></button>`; }).join("")}</div>`;
}
function cardDa(){
  const today=isoDay(Date.now()), here=PEOPLE.filter(p=>!awayOn(p,today));
  const awayNow=state.away.filter(a=>a.from<=today&&today<=a.to);
  const in7=isoDay(Date.now()+7*864e5), soon=state.away.filter(a=>a.from>today&&a.from<=in7).sort((a,b)=>a.from.localeCompare(b.from));
  const lines=[...awayNow.map(a=>`${esc(a.who)} weg bis ${esc(fday(a.to))}`),...soon.slice(0,2).map(a=>`${esc(a.who)} ab ${esc(fday(a.from))}`)];
  return `<button class="dcard" data-go="kalender"><span class="dh"><span>📅 Wer ist da</span><span aria-hidden="true">›</span></span>
    <span class="avs">${here.length?here.map(p=>avatar(p)).join(""):`<span class="dsub">Heute niemand zu Hause</span>`}</span>
    <span class="dsub">${lines.length?lines.join("<br>"):"Diese Woche sind alle da"}</span></button>`;
}
function cardGeld(){
  const M=money(), b=me?M.bal[me]:0, last=state.purchases.filter(p=>p.kind!=="settle").sort((a,c)=>c.at-a.at)[0];
  const mStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime(), month=M.real.filter(p=>p.at>=mStart).reduce((s,p)=>s+(p.price||0),0);
  return `<button class="dcard" data-go="geld"><span class="dh"><span>💶 Geld</span><span aria-hidden="true">›</span></span>
    <span class="big ${b>=.005?"pos":b<=-.005?"neg":""}">${!me?"–":b>=.005?"+"+eur(b):b<=-.005?"−"+eur(-b):"Quitt"}</span>
    <span class="dsub">${me?(b>=.005?"bekommst du":b<=-.005?"zahlst du":"alles ausgeglichen"):""}<br>${esc(new Date().toLocaleDateString("de-DE",{month:"long"}))}: ${eur(month)}${last?`<br>Zuletzt: ${esc(last.who)} · ${esc(last.item)}`:""}</span></button>`;
}
