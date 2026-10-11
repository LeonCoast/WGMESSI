/* ---------- Kalender: wer ist wann nicht in der WG ---------- */
const fday = iso => new Date(iso+"T12:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"});
const awayOn = (who,iso) => state.away.some(a=>a.who===who && a.from<=iso && iso<=a.to);
function awayRange(a){ return a.from===a.to ? fday(a.from) : `${fday(a.from)} – ${fday(a.to)}`; }

function renderKalender(){
  const now=new Date(), first=new Date(now.getFullYear(),now.getMonth()+state.calOff,1);
  const y=first.getFullYear(), m=first.getMonth(), days=new Date(y,m+1,0).getDate(), lead=(first.getDay()+6)%7;
  const today=isoDay(Date.now()), mFrom=isoDay(first.getTime()), mTo=isoDay(new Date(y,m,days).getTime());
  const title=first.toLocaleDateString("de-DE",{month:"long",year:"numeric"});
  const cell=d=>{ const iso=isoDay(new Date(y,m,d).getTime()), A=PEOPLE.filter(p=>awayOn(p,iso));
    return `<button class="day ${iso<today?"past":""} ${iso===today?"today":""} ${A.length>1?"multi":""}" data-day="${iso}" aria-label="${d}. ${esc(title)}: ${A.length?esc(A.join(", "))+" nicht da":"alle da"}">
      <span class="dn">${d}</span>${A.length>1?`<span class="cnt" aria-hidden="true">${A.length}</span>`:""}
      <span class="bars">${PEOPLE.map(p=>`<i style="${A.includes(p)?`background:${COLORS[p]}`:""}"></i>`).join("")}</span></button>`; };
  const list=state.away.filter(a=>a.to>=mFrom&&a.from<=mTo).sort((a,b)=>a.from.localeCompare(b.from)||PEOPLE.indexOf(a.who)-PEOPLE.indexOf(b.who));
  return `<div class="cal-h"><button class="iconbtn" data-cal="-1" aria-label="Voriger Monat">‹</button><h2>${esc(title)}</h2>
      ${state.calOff?`<button class="btn ghost" data-cal="0">Heute</button>`:""}<button class="iconbtn" data-cal="1" aria-label="Nächster Monat">›</button></div>
    <div class="cal">${["Mo","Di","Mi","Do","Fr","Sa","So"].map(w=>`<div class="wd">${w}</div>`).join("")}${"<div></div>".repeat(lead)}${Array.from({length:days},(_,i)=>cell(i+1)).join("")}</div>
    <div class="legend">${PEOPLE.map(p=>`<span><i style="background:${COLORS[p]}"></i>${p}</span>`).join("")}</div>
    <p class="hint">Tippe auf einen Tag, um einzutragen, wer nicht da ist. Umrandete Tage: mehrere sind weg.</p>
    <div class="section-h">Nicht da im ${esc(first.toLocaleDateString("de-DE",{month:"long"}))}</div>
    ${list.length?`<div class="list">${list.map(a=>`<button class="row" style="text-align:left;width:100%" data-away="${a.id}">${avatar(a.who)}<div class="tx"><b>${esc(a.who)}</b><span>${esc(awayRange(a))}${a.note?" · "+esc(a.note):""}</span></div><span aria-hidden="true">✏️</span></button>`).join("")}</div>`
      :`<p class="hint" style="margin-top:0">Diesen Monat sind alle da. 🏠</p>`}
    <button class="btn wide" id="addAway" style="margin-top:12px">＋ Abwesenheit eintragen</button>`;
}

function awaySheet(id,day){
  if(!me){ pickMe(); return; }
  const a=id?state.away.find(x=>x.id===id):null, d=day||isoDay(Date.now());
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>${a?"Abwesenheit ändern":"Wer ist nicht da?"}</h2>
    <p class="sub">${day?esc(fday(day))+". ":""}Die anderen sehen es im Kalender.</p>
    <div class="field"><label for="awho">Wer</label><select id="awho">${PEOPLE.map(p=>`<option ${p===(a?.who||me)?"selected":""}>${p}</option>`).join("")}</select></div>
    <div class="field-row" style="grid-template-columns:1fr 1fr"><div class="field"><label for="afrom">Von</label><input id="afrom" type="date" value="${a?.from||d}"></div>
    <div class="field"><label for="ato">Bis</label><input id="ato" type="date" value="${a?.to||d}"></div></div>
    <div class="field"><label for="anote">Notiz (optional)</label><input id="anote" value="${esc(a?.note||"")}" placeholder="z. B. bei den Eltern" maxlength="40"></div>
    <div class="actions"><button class="btn" id="aok">Speichern</button>${a?`<button class="btn danger" id="adel">Löschen</button>`:""}<button class="btn ghost" id="ax">Abbrechen</button></div></div>`);
  $("#ax").onclick=closeModal;
  $("#afrom").onchange=()=>{ if($("#ato").value<$("#afrom").value) $("#ato").value=$("#afrom").value; };
  if(a){ let armed=false; $("#adel").onclick=async()=>{ if(!armed){ armed=true; $("#adel").textContent="Wirklich löschen?"; return;} closeModal(); play("trash"); cancelPush("away:"+a.id); await Store.delAway(a.id); toast("Gelöscht"); }; }
  $("#aok").onclick=async()=>{
    const who=$("#awho").value, from=$("#afrom").value, to=$("#ato").value, note=$("#anote").value.trim();
    if(!from){ $("#afrom").focus(); return; } if(!to||to<from){ $("#ato").focus(); toast("„Bis“ muss nach „Von“ liegen."); return; }
    const r=awayRange({from,to});
    closeModal(); play("pop"); toast(`${who} ist nicht da: ${r}`);
    const aid=a?.id||uid();
    if(!a) notifyLater("away:"+aid, "kalender", `📅 ${who} ist nicht da`, `${r}${note?" · "+note:""}`, "date");
    await Store.setAway(aid,{who,from,to,note,by:me,at:Date.now()});
  };
}
