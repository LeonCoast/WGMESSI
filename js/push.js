/* ---------- Push-Nachrichten über ntfy + Einstellungen ---------- */
/* Push aufs Handy über ntfy: jede Person hat ein eigenes Thema und stellt in der App ein,
   wofür sie Push bekommt (prefs/<Name> in der Datenbank). Eigene Aktionen schicken einem selbst nichts. */
const PUSH_EVENTS = [
  ["leer","Etwas ist leer","🚨",true], ["fastleer","Etwas ist fast leer","⚠️",false], ["kauf","Jemand hat eingekauft","🎉",true],
  ["muell","Müll ist voll","🗑️",true], ["kalender","Jemand ist nicht da (Kalender)","📅",false], ["chat","Neue Chat-Nachricht","💬",true],
  ["todo","Neues To-do","✅",true], ["geld","Jemand hat dir Geld zurückgegeben","💸",true] ];
const pushTopic = p => `${NTFY_TOPIC}-${p.toLowerCase()}`;
const wantsPush = (p,ev) => { const d=PUSH_EVENTS.find(x=>x[0]===ev); return !!d && (state.prefs[p]?.[ev] ?? d[3]); };
function sendPush(ev,title,message,tags,only){
  if(!NTFY_TOPIC || LOCAL_DEV) return;
  for(const p of PEOPLE){
    if(p===me || (only && p!==only) || !wantsPush(p,ev)) continue;
    try{ fetch("https://ntfy.sh/",{method:"POST",keepalive:true,body:JSON.stringify({topic:pushTopic(p),title,message,tags:[tags],priority:tags==="rotating_light"?4:3})}).catch(()=>{}); }catch(e){}
  }
}
/* Gegen Vertippen: Status-Meldungen gehen erst nach kurzer Wartezeit raus.
   Wer in der Zeit weiter- oder zurücktippt, verschickt nur den Endstand oder gar nichts. */
const PUSH_DELAY = 20000, pendingPush = new Map();
function notifyLater(key,ev,title,message,tags){
  cancelPush(key);
  const send=()=>{ pendingPush.delete(key); sendPush(ev,title,message,tags); };
  pendingPush.set(key,{send,t:setTimeout(send,PUSH_DELAY)});
}
function cancelPush(key){ const x=pendingPush.get(key); if(x){ clearTimeout(x.t); pendingPush.delete(key); } }
/* App wird verlassen: Wartende sofort verschicken, sonst gehen sie verloren */
function flushPush(){ for(const x of [...pendingPush.values()]){ clearTimeout(x.t); x.send(); } }
addEventListener("pagehide",flushPush);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") flushPush(); });

function pushSheet(){
  if(!me){ pickMe(); return; }
  const topic=pushTopic(me);
  openModal(`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pusht"><h2 id="pusht">Push-Nachrichten</h2>
    <p class="sub">Wofür bekommst du, ${esc(me)}, eine Nachricht aufs Handy? Für deine eigenen Aktionen kommt nie eine.</p>
    <div class="opts">${PUSH_EVENTS.map(([k,label,em])=>`<label class="opt"><input type="checkbox" data-push="${k}" ${wantsPush(me,k)?"checked":""}><span>${em}</span>${esc(label)}</label>`).join("")}</div>
    <p class="hint" style="margin:0 2px 6px">Damit es ankommt, in der ntfy-App einmal dieses Thema abonnieren (Server ntfy.sh):</p>
    <div class="topic"><code>${esc(topic)}</code><button class="btn ghost" id="pcopy">Kopieren</button></div>
    <div class="actions"><button class="btn" id="px">Fertig</button></div></div>`);
  document.querySelectorAll("[data-push]").forEach(c=>c.onchange=()=>{
    const prefs=Object.fromEntries(PUSH_EVENTS.map(([k])=>[k,!!document.querySelector(`[data-push="${k}"]`)?.checked]));
    Store.setPrefs(me,prefs);
  });
  $("#pcopy").onclick=async()=>{ try{ await navigator.clipboard.writeText(topic); toast("Thema kopiert"); }catch(e){ toast(topic); } };
  $("#px").onclick=closeModal;
}
