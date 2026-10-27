/* ---------- Rendern, Event-Handler, Passwort-Abfrage und App-Start (muss als letztes geladen werden) ---------- */
function updateBadges(){
  const need=state.items.filter(i=>i.status!=="full").length; const bd=$("#listBadge"); bd.hidden=!need; bd.textContent=need;
  const u=state.chatOpen?0:unreadChat(); const cb=$("#chatBadge"); cb.hidden=!u; cb.textContent=u>9?"9+":u;
}

function render(){
  const meBtn=$("#meBtn"); meBtn.innerHTML = me ? `${avatar(me)}${esc(me)}` : `${avatar("?")}Wer bist du?`;
  $("#soundBtn").textContent = muted?"🔇":"🔊"; $("#soundBtn").setAttribute("aria-pressed",String(!muted));
  document.querySelectorAll("nav.tabs [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===state.tab)));
  updateBadges();
  const v=$("#view");
  if(!state.loaded){ v.innerHTML=`<div class="empty-state"><div class="big">📦</div><h3>Vorräte werden geladen…</h3></div>`; return; }
  if(state.tab==="home") v.innerHTML=renderHome();
  else if(state.tab==="vorrat") v.innerHTML=renderVorrat();
  else if(state.tab==="liste") v.innerHTML=renderListe();
  else if(state.tab==="geld") v.innerHTML=renderGeld();
  else v.innerHTML=renderKalender();
  bindView();
}

function bindView(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{ state.tab=b.dataset.go; play("pop"); render(); scrollTo(0,0); });
  document.querySelectorAll("[data-todo]").forEach(b=>b.onclick=()=>todoSheet(b.dataset.todo));
  document.querySelectorAll("[data-todo-done]").forEach(b=>b.onclick=()=>toggleTodo(b.dataset.todoDone));
  document.querySelectorAll("[data-settle]").forEach(b=>b.onclick=()=>{ const [f,t,a]=b.dataset.settle.split("|"); settleSheet(f,t,+a); });
  const at=$("#addTodo"); if(at) at.onclick=()=>todoSheet(null);
  document.querySelectorAll("[data-id]").forEach(b=>b.onclick=e=>{ if(e.target.closest("[data-edit]")){ itemSheet(e.target.closest("[data-edit]").dataset.edit); return;} if(state.edit){ itemSheet(b.dataset.id); return;} cycle(b.dataset.id); });
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{ state.cat=b.dataset.cat; play("pop"); render(); });
  const te=document.querySelector("[data-toggle-edit]"); if(te) te.onclick=()=>{ state.edit=!state.edit; play("pop"); render(); };
  document.querySelectorAll("#addNew").forEach(b=>b.onclick=()=>itemSheet(null));
  const sd=$("#seed"); if(sd) sd.onclick=seedStarter;
  document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buySheet(b.dataset.buy));
  const mn=$("#manual"); if(mn) mn.onclick=()=>buySheet(null);
  const xp=$("#expense"); if(xp) xp.onclick=expenseSheet;
  document.querySelectorAll("[data-scan]").forEach(b=>b.onclick=scanReceipt);
  document.querySelectorAll("[data-rcpt]").forEach(b=>b.onclick=()=>receiptSheet(b.dataset.rcpt));
  document.querySelectorAll("[data-bin]").forEach(b=>b.onclick=()=>toggleBin(b.dataset.bin));
  document.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>awaySheet(null,b.dataset.day));
  document.querySelectorAll("[data-away]").forEach(b=>b.onclick=()=>awaySheet(b.dataset.away));
  document.querySelectorAll("[data-cal]").forEach(b=>b.onclick=()=>{ const d=+b.dataset.cal; state.calOff=d?state.calOff+d:0; play("pop"); render(); });
  const aa=$("#addAway"); if(aa) aa.onclick=()=>awaySheet(null);
  document.querySelectorAll("[data-delp]").forEach(b=>{ let armed=false; b.onclick=async()=>{ if(!armed){armed=true;b.textContent="?";b.setAttribute("aria-label","Nochmal tippen zum Löschen");setTimeout(()=>{armed=false;b.textContent="✕"},2500);return;} play("trash"); await Store.delPurchase(b.dataset.delp); }; });
}

document.querySelectorAll("nav.tabs [data-tab]").forEach(b=>b.onclick=()=>{ state.tab=b.dataset.tab; state.edit=false; state.calOff=0; play("pop"); render(); scrollTo(0,0); });
$("#meBtn").onclick=pickMe;
$("#pushBtn").onclick=pushSheet;
$("#soundBtn").onclick=()=>{ muted=!muted; ls.set("wg_muted",muted?"1":"0"); render(); if(!muted) play("bell"); };
setInterval(()=>{ if(state.tab==="liste"||state.tab==="home") render(); },60000);
bindChat();

async function sha256(t){ const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function start(){ render(); Store.init(); }
function gate(){
  if(ls.get("wg_unlocked")===PASS_HASH){ start(); return; }
  const g=document.createElement("div"); g.className="gate";
  g.innerHTML=`<form class="box" id="gateForm"><img src="assets/icons/apple-touch-icon.png" alt=""><h2>WG Vorrat</h2><p>Nur für Leon, Lucio und Yannick.</p>
    <input id="gatePw" type="password" placeholder="Passwort" autocomplete="current-password" autocapitalize="off" aria-label="Passwort">
    <button class="btn wide" type="submit">Reinkommen</button><div class="err" id="gateErr" role="alert"></div></form>`;
  document.body.appendChild(g); setTimeout(()=>$("#gatePw").focus(),50);
  $("#gateForm").onsubmit=async e=>{ e.preventDefault();
    const inp=$("#gatePw"); const h=await sha256(inp.value.trim().toLowerCase());
    if(h===PASS_HASH){ ls.set("wg_unlocked",PASS_HASH); g.remove(); play(); start(); }
    else { inp.classList.remove("wrong"); void inp.offsetWidth; inp.classList.add("wrong"); $("#gateErr").textContent="Falsches Passwort. Versuch’s nochmal."; inp.select(); }
  };
}
gate();
