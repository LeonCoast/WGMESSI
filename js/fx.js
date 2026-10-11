/* ---------- Sprüche, Sounds, Konfetti, Toast ---------- */
const SPECIAL = {
  Klopapier:{low:["Klopapier wird knapp. Bitte sparsam abrollen.","Noch 2 Rollen. Die Uhr tickt."]},
  "Öl":{low:["Das Öl geht zur Neige. Die Pfanne macht sich Sorgen."]},
  "Spülmittel":{low:["Spülmittel fast leer. Noch ein bis zwei Abwasch-Abenteuer."]},
};
const CR7 = "Nur noch so viel übrig, wie CR7 WM-Titel hat";
const GENERIC = {
  empty:["{x}: "+CR7+" 🏆❌"],
  low:["{x} wird knapp. Kleiner Reminder.","{x} fast leer. Noch ist Zeit."]
};
const HERO = ["Held des Tages: {n} 🦸","{n} hat die WG gerettet. Applaus!","Ehre, wem Ehre gebührt: {n} 🏆","{n} for President 🗳️"];
function quip(name,status){const s=SPECIAL[name]?.[status]; return pick(s||GENERIC[status]).replace("{x}",name)}
function mood(items){
  const e=items.filter(i=>i.status==="empty").length, l=items.filter(i=>i.status==="low").length;
  if(!items.length) return "";
  if(!e&&!l) return pick(["Die WG ist bestens versorgt. Ihr seid Legenden. ✨","Alles grün. So sieht Erwachsensein aus.","Nichts fehlt. Verdächtig. Aber schön."]);
  if(e>=4) return "Lage: kritisch. Jemand muss heute zum Supermarkt. 🫡";
  if(e) return pick(["Ein paar Sachen sind alle. Zeit für einen Einkauf.","Es fehlt was. Wer hat den Rucksack?"]);
  return "Ein paar Dinge werden knapp. Noch kein Grund zur Panik.";
}

let actx=null; let muted = ls.get("wg_muted")==="1";
/* iOS: Web Audio auch bei Lautlos-Schalter abspielen (Safari 16.4+) */
try{ if(navigator.audioSession) navigator.audioSession.type="playback"; }catch(e){}
function audio(){ if(!actx){ try{actx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){} } if(actx&&actx.state!=="running") actx.resume().catch(()=>{}); return actx; }
/* Safari entsperrt Audio nicht immer beim ersten Tippen: bei jeder Geste erneut versuchen, bis es läuft */
function unlockAudio(){ const a=audio(); if(a&&a.state==="running"){ ["pointerdown","touchend","click","keydown"].forEach(ev=>document.removeEventListener(ev,unlockAudio,true)); } }
["pointerdown","touchend","click","keydown"].forEach(ev=>document.addEventListener(ev,unlockAudio,true));
function tone(f,start,dur,type="sine",vol=.18,f2){const a=audio(); if(!a||muted)return; const t=a.currentTime+start; const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+dur); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+.05);}
/* Ein einziger, dezenter Hinweiston für alles */
const SFX = { ding(){ tone(880,0,.18,"sine",.12); tone(1320,.09,.25,"sine",.07); } };
/* Eigener Kauf-Sound: Datei liegt unter assets/kauf.mp3.
   Gibt es keine, wird einfach der normale Ding-Ton gespielt. */
const KAUF_SOUND = "assets/kauf.mp3";
let kaufBuf=null, kaufTried=false;
async function loadKauf(){
  if(kaufTried) return; kaufTried=true;
  try{ const a=audio(); if(!a) return; const r=await fetch(KAUF_SOUND,{cache:"no-cache"}); if(!r.ok) return;
       kaufBuf=await a.decodeAudioData(await r.arrayBuffer()); }catch(e){ kaufBuf=null; }
}
loadKauf(); /* Dekodieren geht auch vor dem Entsperren, so ist der Ton schon beim ersten Kauf bereit */
function play(n){
  if(muted) return;
  try{
    if(n==="kauf" && kaufBuf){ const a=audio(); const src=a.createBufferSource(); src.buffer=kaufBuf; src.connect(a.destination); src.start(); return; }
    SFX.ding();
  }catch(e){}
}

function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c=$("#confetti"); c.hidden=false; const x=c.getContext("2d"); const W=c.width=innerWidth, H=c.height=innerHeight;
  const cols=["#2747E8","#E0582E","#14946A","#F2C14E","#FF7A6B","#7D93FF"];
  const P=Array.from({length:140},()=>({x:W/2,y:H*.45,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*6+4,c:pick(cols),a:Math.random()*6,s:(Math.random()-.5)*.3}));
  let f=0; (function step(){ x.clearRect(0,0,W,H); P.forEach(p=>{p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.vx*=.99;p.a+=p.s; x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore()}); if(++f<150) requestAnimationFrame(step); else {x.clearRect(0,0,W,H); c.hidden=true;} })();
}

let toastT; function toast(msg){ const el=document.createElement("div"); el.className="toast"; el.textContent=msg; document.querySelectorAll(".toast").forEach(t=>t.remove()); document.body.appendChild(el); clearTimeout(toastT); toastT=setTimeout(()=>el.remove(),3200); }
