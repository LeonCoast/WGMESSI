/* ---------- Müll: voll / rausgebracht ---------- */
const BINS = [["rest","Restmüll","🗑️"],["papier","Papier","📦"]];
function onBins(bins,changes){
  state.bins=bins;
  for(const ch of changes){
    if(ch.type!=="modified"&&ch.type!=="added") continue;
    const d=ch.doc.data(), b=BINS.find(x=>x[0]===ch.doc.id); if(!b||!d||d.by===me||!me||Date.now()-(d.at||0)>60000) continue;
    toast(d.status==="full"?`${d.by}: ${b[2]} ${b[1]} ist voll`:`${d.by} hat ${b[1]} rausgebracht 🦸`); play();
  }
  render();
}
async function toggleBin(id){
  const b=BINS.find(x=>x[0]===id); if(!b) return;
  if(!me){ pickMe(); return; }
  const [,name,em]=b, full=state.bins[id]?.status==="full";
  play();
  if(full){ cancelPush("bin:"+id); toast(`${me} hat ${name} rausgebracht 🦸`); }
  else { toast(`${em} ${name} ist voll. Wer bringt's raus?`); notifyLater("bin:"+id, "muell", `${em} ${name} ist voll (${me})`, "Wer bringt's raus?", "wastebasket"); }
  await Store.setBin(id,{status:full?"ok":"full",by:me,at:Date.now()});
}
function binsHTML(){
  return `<div class="bins">${BINS.map(([id,name,em])=>{ const b=state.bins[id]||{}, full=b.status==="full";
    return `<button class="bin ${full?"full":""}" data-bin="${id}" aria-label="${name}: ${full?"voll":"okay"}. Tippen zum Ändern"><span class="em">${em}</span><span>${name}<small>${full?`Voll · ${esc(b.by)}`:"Okay"}</small></span></button>`; }).join("")}</div>`;
}
