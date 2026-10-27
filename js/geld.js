/* ---------- Ausgaben, Bilanz und Ausgleich ---------- */
/* Einkäufe werden gedrittelt. Ausgleichszahlungen (kind:"settle") verschieben nur Geld zwischen zwei Personen. */
function money(){
  const real=state.purchases.filter(p=>p.kind!=="settle");
  const paid=Object.fromEntries(PEOPLE.map(n=>[n,0]));
  real.forEach(p=>{ if(p.who in paid) paid[p.who]+=p.price||0; });
  const total=PEOPLE.reduce((s,n)=>s+paid[n],0), share=total/PEOPLE.length;
  const bal=Object.fromEntries(PEOPLE.map(n=>[n,paid[n]-share]));
  state.purchases.forEach(p=>{ if(p.kind==="settle" && p.who in bal && p.to in bal){ bal[p.who]+=p.price||0; bal[p.to]-=p.price||0; } });
  // Überweisungen: größter Schuldner zahlt an größten Gläubiger
  const deb=PEOPLE.filter(n=>bal[n]<-.005).map(n=>[n,-bal[n]]).sort((a,b)=>b[1]-a[1]);
  const cred=PEOPLE.filter(n=>bal[n]>.005).map(n=>[n,bal[n]]).sort((a,b)=>b[1]-a[1]);
  const tx=[]; let i=0, j=0;
  while(i<deb.length && j<cred.length){ const x=Math.min(deb[i][1],cred[j][1]);
    if(x>=.01) tx.push({from:deb[i][0],to:cred[j][0],amount:Math.round(x*100)/100});
    deb[i][1]-=x; cred[j][1]-=x; if(deb[i][1]<.005) i++; if(cred[j][1]<.005) j++; }
  return {real,total,share,bal,tx};
}
function settleSheet(from,to,amount){
  if(!me){ pickMe(); return; }
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>💸 Ausgleich</h2>
    <p class="sub">${esc(from)} hat ${esc(to)} Geld gegeben? Dann wird es hier verrechnet.</p>
    <div class="field"><label for="samt">Betrag in €</label><input id="samt" inputmode="decimal" value="${String(amount.toFixed(2)).replace(".",",")}" autocomplete="off"></div>
    <div class="actions"><button class="btn" id="sok">Bezahlt ✓</button><button class="btn ghost" id="sx">Abbrechen</button></div></div>`);
  $("#sx").onclick=closeModal;
  $("#sok").onclick=async()=>{
    const price=toNum($("#samt").value);
    if(!price||Number.isNaN(price)||price<0){ $("#samt").focus(); toast("Betrag bitte als Zahl, z. B. 4,20"); return; }
    closeModal(); play("kauf"); toast(`${from} → ${to}: ${eur(price)} verrechnet`);
    sendPush("geld", `💸 ${from} hat dir ${eur(price)} gegeben`, "Ist in der App verrechnet.", "money_with_wings", to);
    await Store.addPurchase({kind:"settle",item:`Ausgleich an ${to}`,emoji:"💸",who:from,to,price,by:me,at:Date.now()});
  };
}

/* Sonstige Ausgaben (kind:"expense"): werden gedrittelt, haben aber nichts mit dem Vorrat zu tun */
const EXP_EMOJIS = ["🛍️","✉️","🍻","🍕","🍽️","🎉","🛋️","🪴","🧰","💡","🌐","🚕","🎟️","🧾","📦"];
function expenseSheet(){
  if(!me){ pickMe(); return; }
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>Sonstige Ausgabe</h2>
    <p class="sub">Für alles, was kein Vorrat-Artikel ist: Porto, ein Teppich, ein Abend zusammen. Wird gedrittelt.</p>
    <div class="field-row"><div class="field"><label for="xemb">Symbol</label><button type="button" class="emoji-btn" id="xemb" aria-expanded="false">🛍️</button></div>
    <div class="field"><label for="xname">Wofür?</label><input id="xname" placeholder="z. B. Brief verschickt" maxlength="40" autocomplete="off"></div></div>
    <div class="emoji-grid" id="xgrid" hidden>${EXP_EMOJIS.map(e=>`<button type="button" data-xemo="${e}" aria-pressed="${e==="🛍️"}">${e}</button>`).join("")}</div>
    <div class="field"><label for="xprice">Betrag in €</label><input id="xprice" inputmode="decimal" placeholder="z. B. 3,30" autocomplete="off"></div>
    <div class="field"><label for="xwho">Bezahlt von</label><select id="xwho">${PEOPLE.map(p=>`<option ${p===me?"selected":""}>${p}</option>`).join("")}</select></div>
    <div class="actions"><button class="btn" id="xok">Eintragen</button><button class="btn ghost" id="xx">Abbrechen</button></div></div>`);
  let emoji="🛍️";
  $("#xemb").onclick=()=>{ const g=$("#xgrid"); g.hidden=!g.hidden; $("#xemb").setAttribute("aria-expanded",String(!g.hidden)); };
  document.querySelectorAll("[data-xemo]").forEach(b=>b.onclick=()=>{ emoji=b.dataset.xemo; $("#xemb").textContent=emoji; document.querySelectorAll("[data-xemo]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); $("#xgrid").hidden=true; $("#xemb").setAttribute("aria-expanded","false"); play(); });
  $("#xx").onclick=closeModal;
  $("#xok").onclick=async()=>{
    const item=$("#xname").value.trim(); if(!item){ $("#xname").focus(); toast("Wofür war die Ausgabe?"); return; }
    const price=toNum($("#xprice").value);
    if(!price||Number.isNaN(price)||price<0){ $("#xprice").focus(); toast("Betrag bitte als Zahl, z. B. 3,30"); return; }
    const who=$("#xwho").value;
    closeModal(); play("kauf"); toast(`${emoji} ${item}: ${eur(price)} eingetragen`);
    sendPush("kauf", `${emoji} ${who} hat ${eur(price)} ausgelegt`, `${item} · wird gedrittelt.`, "money_with_wings");
    await Store.addPurchase({kind:"expense",item,emoji,who,price,by:me,at:Date.now()});
  };
}

function renderGeld(){
  const P=state.purchases.slice().sort((a,b)=>b.at-a.at);
  const now=new Date(); const mStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();
  const month=P.filter(p=>p.at>=mStart);
  const stats=Object.fromEntries(PEOPLE.map(n=>[n,{count:0,sum:0,mcount:0}]));
  const M=money();
  P.forEach(p=>{ if(p.kind!=="settle" && stats[p.who]){ stats[p.who].count++; stats[p.who].sum+=p.price||0; if(p.at>=mStart && p.kind!=="expense") stats[p.who].mcount++; } });
  const total=PEOPLE.reduce((s,n)=>s+stats[n].sum,0); const share=total/PEOPLE.length;
  const mc=PEOPLE.map(n=>stats[n].mcount); const max=Math.max(...mc), min=Math.min(...mc);
  const monthName=now.toLocaleDateString("de-DE",{month:"long"});
  const board=`<div class="section-h">Wer kauft ein? (${monthName})</div><div class="board">${PEOPLE.map(n=>{
    const s=stats[n]; const isTop=max>0&&s.mcount===max; const isMessi=isTop||s.mcount>0;
    return `<div class="person">${isTop?`<span class="crown" aria-label="Nummer 1 im Monat">👑</span>`:""}${avatar(n)}<b>${n}</b><div class="num">${s.mcount}×</div><small>gesamt ${eur(s.sum)}</small><span class="title">${isMessi?"Messi-Fan 🐐":"Ronaldo-Fan 😤"}</span></div>`}).join("")}</div>`;
  const bal = total>0 ? `<div class="section-h">Wer schuldet wem? (alles gedrittelt)</div><div class="card balance">
     <div><span>Gesamt ausgegeben</span><span class="money">${eur(total)}</span></div><div><span>Anteil pro Person</span><span class="money">${eur(share)}</span></div>
     ${PEOPLE.map(n=>{const d=M.bal[n]; return `<div><span>${n}</span><span class="money ${d>=0.005?"pos":d<=-0.005?"neg":""}">${d>=0.005?"bekommt "+eur(d):d<=-0.005?"zahlt "+eur(-d):"ausgeglichen"}</span></div>`}).join("")}
     ${M.tx.length?`<div style="border-top:1px solid var(--line);padding-top:8px;margin-top:2px"><b>So werdet ihr quitt</b></div>${M.tx.map(t=>`<div style="align-items:center"><span>${esc(t.from)} → ${esc(t.to)} <span class="money">${eur(t.amount)}</span></span><button class="btn sm ghost" data-settle="${t.from}|${t.to}|${t.amount}">Bezahlt</button></div>`).join("")}`:""}</div>` : "";
  // Einkäufe nach Monat gruppiert, neuester Monat zuerst
  const months=[]; P.forEach(p=>{ const d=new Date(p.at), k=d.getFullYear()*12+d.getMonth(); const g=months[months.length-1];
    if(g&&g.k===k) g.list.push(p); else months.push({k,label:d.toLocaleDateString("de-DE",{month:"long",year:"numeric"}),list:[p]}); });
  const list = P.length ? `<div class="section-h">Alle Einkäufe</div>`+months.map(g=>`<div class="month-h"><span>${g.label}</span><span class="money">${eur(g.list.reduce((s,p)=>s+(p.kind==="settle"?0:p.price||0),0))}</span></div><div class="list">${g.list.map(p=>`<div class="row">${avatar(p.who)}<div class="tx"><b>${esc(p.emoji||"🛍️")} ${esc(p.item)}</b><span>${esc(p.who)} · ${fdate(p.at)}${p.store?" · "+esc(p.store):""}${p.kind==="expense"?" · Sonstiges":""}</span></div><span class="money">${p.price==null?"–":eur(p.price)}</span>${p.receiptId?`<button class="iconbtn" style="box-shadow:none;background:var(--surface-2);width:34px;height:34px;font-size:15px" data-rcpt="${p.receiptId}" aria-label="Kassenbon ansehen">🧾</button>`:""}<button class="iconbtn" style="box-shadow:none;background:var(--surface-2);width:34px;height:34px;font-size:14px" data-delp="${p.id}" aria-label="Eintrag löschen">✕</button></div>`).join("")}</div>`).join("")
    : `<div class="empty-state"><div class="big">🧾</div><h3>Noch keine Einkäufe</h3><p>Wenn jemand in der Einkaufsliste auf „Gekauft“ tippt und den Preis einträgt, landet es hier. Alles andere über „Sonstige Ausgabe“.</p></div>`;
  return board+bal+`<button class="btn wide" data-scan style="margin-top:14px">🧾 Kassenbon scannen</button><button class="btn ghost wide" id="manual" style="margin-top:8px">＋ Vorrat-Einkauf eintragen</button><button class="btn ghost wide" id="expense" style="margin-top:8px">＋ Sonstige Ausgabe</button>`+list;
}
