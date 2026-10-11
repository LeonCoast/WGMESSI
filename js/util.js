/* ---------- Konstanten und kleine Helfer ---------- */
const PEOPLE = ["Leon","Lucio","Yannick"];
const COLORS = {Leon:"#2747E8",Lucio:"#E0582E",Yannick:"#14946A"};
const CATS = ["Küche","Bad","Putzen","Sonstiges"];
const STARTER = [
  ["Öl","🫒","Küche"],["Salz","🧂","Küche"],["Pfeffer","🌶️","Küche"],["Zucker","🍬","Küche"],["Mehl","🌾","Küche"],
  ["Klopapier","🧻","Bad"],["Handseife","🧼","Bad"],["Küchenrolle","🧻","Küche"],
  ["Spülmittel","🫧","Putzen"],["Spülmaschinentabs","🍽️","Putzen"],["Müllbeutel","🗑️","Putzen"],["Waschmittel","👕","Putzen"],["Schwämme","🧽","Putzen"]
];
const EMOJIS = ["🧻","🧼","🧴","🪥","🧽","🫧","🧹","🪣","🗑️","🧺","👕","🧦","🪒","💊","🩹","🕯️","💡","🔋",
"🫒","🧂","🌶️","🧄","🧅","🍬","🌾","🍝","🍚","🥫","🫙","🍯","🧈","🥚","🥛","🧀","🍞","🥐","☕","🍵","🫖","🧃","🥤","🍺","🍷","🧊",
"🍅","🥔","🥕","🍋","🍎","🍌","🥑","🥬","🍫","🍪","🥜","🍿","🍕","🧇","🍽️","🥄","🔪","🧯","🌿","🪴","🐱","📦"];
const ST_LABEL = {full:"Voll",low:"Fast leer",empty:"Leer"};
const NEXT = {full:"low",low:"empty",empty:"full"};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls = {get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const pick = a => a[Math.floor(Math.random()*a.length)];
const eur = n => (n||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"});
function ago(ms){const s=(Date.now()-ms)/1000; if(s<60)return "gerade eben"; if(s<3600)return `vor ${Math.round(s/60)} Min.`; if(s<86400)return `vor ${Math.round(s/3600)} Std.`; const d=Math.round(s/86400); return d===1?"gestern":`vor ${d} Tagen`;}
function fdate(ms){return new Date(ms).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})}
const avatar = (n,cls="") => `<span class="avatar ${cls}" style="background:${COLORS[n]||"#888"}">${esc((n||"?")[0])}</span>`;

const toNum = raw => { const s=String(raw??"").trim().replace(/\s|€/g,"").replace(",","."); if(s==="") return null; const n=Number(s); return isFinite(n)?n:NaN; };
const isoDay = ms => { const d=new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
