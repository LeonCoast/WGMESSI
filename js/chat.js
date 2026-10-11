/* ---------- Chat (Pop-up über der Tab-Leiste) ---------- */
let chatDraft="", firstChat=true;
function chatTime(ms){ return new Date(ms).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}) }
function chatDay(ms){ const d=new Date(ms), t=new Date(); const y=new Date(); y.setDate(t.getDate()-1);
  if(d.toDateString()===t.toDateString()) return "Heute"; if(d.toDateString()===y.toDateString()) return "Gestern";
  return d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}); }
function unreadChat(){ if(!me) return 0; const seen=+(ls.get("wg_chatseen_"+me)||0); return state.chat.filter(m=>m.who!==me&&m.at>seen).length; }
function onChat(list){
  const before=new Set(state.chat.map(m=>m.id));
  state.chat=list;
  if(!firstChat){ const fresh=list.filter(m=>!before.has(m.id)&&m.who!==me); if(fresh.length&&!state.chatOpen){ const m=fresh[fresh.length-1]; toast(`💬 ${m.who}: ${m.text.slice(0,60)}`); play(); } }
  firstChat=false;
  if(state.chatOpen){ ls.set("wg_chatseen_"+me,String(Date.now())); renderChatList(); }
  updateBadges();
}
function chatHTML(){
  if(!state.chat.length) return `<div class="empty-state"><div class="big">💬</div><h3>Noch keine Nachrichten</h3><p>Schreibt hier rein, was sonst in der WG-Gruppe untergeht: „Wer hat meinen Joghurt gegessen?“</p></div>`;
  let out="", day="";
  for(const m of state.chat){
    const d=chatDay(m.at); if(d!==day){ day=d; out+=`<div class="daysep">${esc(d)}</div>`; }
    out+=`<div class="msg ${m.who===me?"mine":""}" style="--c:${COLORS[m.who]||"#888"}"><div class="who">${esc(m.who)}</div><div class="txt">${esc(m.text)}</div><div class="meta"><span class="time">${new Date(m.at).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})} · ${chatTime(m.at)}</span>${m.who===me?`<button class="del" data-delmsg="${esc(m.id)}" aria-label="Nachricht löschen">Löschen</button>`:""}</div></div>`;
  }
  return out;
}
function scrollChat(){ requestAnimationFrame(()=>{ const b=$("#chatList"); if(b) b.scrollTop=b.scrollHeight; }); }
async function sendChat(){
  if(!me){ pickMe(); return; }
  const ta=$("#chatIn"); const text=ta.value.trim(); if(!text) return;
  ta.value=""; chatDraft=""; ta.style.height="";
  const ok=await Store.addChat({who:me,text,at:Date.now()});
  if(ok){ play(); sendPush("chat", `💬 ${me}`, text, "speech_balloon"); }
  else { ta.value=text; chatDraft=text; }
}

function openChat(){
  if(!me){ pickMe(); return; }
  state.chatOpen=true; ls.set("wg_chatseen_"+me,String(Date.now()));
  $("#chatPanel").hidden=false; $("#chatFab").hidden=true; $("#chatFab").setAttribute("aria-expanded","true");
  renderChatList(); const ta=$("#chatIn"); ta.value=chatDraft; updateBadges();
  if(!/iPhone|iPad|Android/.test(navigator.userAgent)) ta.focus();
}
function closeChat(){ state.chatOpen=false; $("#chatPanel").hidden=true; $("#chatFab").hidden=false; $("#chatFab").setAttribute("aria-expanded","false"); updateBadges(); }
function renderChatList(){ const box=$("#chatList"); if(!box) return; box.innerHTML=chatHTML(); scrollChat(); }
function bindChat(){
  $("#chatFab").onclick=openChat; $("#chatClose").onclick=closeChat;
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&state.chatOpen&&!$("#modal").innerHTML) closeChat(); });
  $("#chatList").onclick=async e=>{ const b=e.target.closest("[data-delmsg]"); if(!b) return;
    const m=state.chat.find(x=>x.id===b.dataset.delmsg); if(!m||m.who!==me) return;
    if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent="Wirklich löschen?"; setTimeout(()=>{ if(b.isConnected){ b.classList.remove("armed"); b.textContent="Löschen"; } },3000); return; }
    await Store.delChat(m.id); };
  const ta=$("#chatIn");
  $("#chatForm").onsubmit=e=>{ e.preventDefault(); sendChat(); };
  ta.oninput=()=>{ chatDraft=ta.value; ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight,110)+"px"; };
  ta.onkeydown=e=>{ if(e.key==="Enter"&&!e.shiftKey&&!/iPhone|iPad|Android/.test(navigator.userAgent)){ e.preventDefault(); sendChat(); } };
}
