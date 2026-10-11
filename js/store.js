/* ---------- App-Zustand und Datenbank (Firestore oder lokal) ---------- */
const state = { items:[], purchases:[], chat:[], bins:{}, away:[], prefs:{}, todos:[], chatOpen:false, calOff:0, loaded:false, shared:false, tab:"home", cat:"Alle", edit:false };
let me = ls.get("wg_me"); if(!PEOPLE.includes(me)) me=null;
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const Store = {
  db:null,
  async init(){
    let db=null;
    try{
      if(!LOCAL_DEV && window.firebase && FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith("HIER")){
        firebase.initializeApp(FIREBASE_CONFIG);
        const fs=firebase.firestore();
        const root=fs.collection("wgs").doc(WG_ID);
        db={ doc:p=>{const [c,id]=p.split("/"); return root.collection(c).doc(id)}, collection:c=>root.collection(c) };
      }
    }catch(e){ console.error(e); db=null; }
    if(db){
      this.db=db; state.shared=true;
      db.collection("items").onSnapshot(snap=>{ onItems(snap.docs.map(d=>({id:d.id,...d.data()})), snap.docChanges()); }, e=>showNotice("Keine Verbindung zur Datenbank. Prüfe die Firestore-Regeln oder lade neu."));
      db.collection("purchases").onSnapshot(snap=>{ state.purchases=snap.docs.map(d=>({id:d.id,...d.data()})); render(); }, ()=>{});
      db.collection("chat").orderBy("at","desc").limit(300).onSnapshot(snap=>{ onChat(snap.docs.map(d=>({id:d.id,...d.data()})).reverse()); }, ()=>{});
      db.collection("away").onSnapshot(snap=>{ state.away=snap.docs.map(d=>({id:d.id,...d.data()})); render(); }, ()=>{});
      db.collection("bins").onSnapshot(snap=>{ onBins(Object.fromEntries(snap.docs.map(d=>[d.id,d.data()])), snap.docChanges()); }, ()=>{});
      db.collection("todos").onSnapshot(snap=>{ state.todos=snap.docs.map(d=>({id:d.id,...d.data()})); render(); }, ()=>{});
      db.collection("prefs").onSnapshot(snap=>{ state.prefs=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()])); }, ()=>{});
    } else {
      showNotice(LOCAL_DEV ? "Lokaler Testmodus: Änderungen werden nur auf diesem Gerät gespeichert, keine Push-Nachrichten." : "Firebase ist noch nicht eingerichtet: Änderungen werden nur auf diesem Gerät gespeichert.");
      let saved=null; try{ saved=JSON.parse(ls.get("wg_local")||"null") }catch(e){}
      state.purchases = saved?.purchases||[]; state.chat = saved?.chat||[]; state.bins = saved?.bins||{}; state.away = saved?.away||[]; state.prefs = saved?.prefs||{}; state.todos = saved?.todos||[]; onItems(saved?.items||[],[]);
    }
  },
  saveLocal(){ ls.set("wg_local",JSON.stringify({items:state.items,purchases:state.purchases,chat:state.chat,bins:state.bins,away:state.away,prefs:state.prefs,todos:state.todos})) },
  async setItem(id,data){
    if(this.db){ try{ await this.db.doc("items/"+id).set(data) }catch(e){ writeErr(e) } }
    else { const i=state.items.findIndex(x=>x.id===id); const v={id,...data}; i<0?state.items.push(v):state.items[i]=v; this.saveLocal(); onItems(state.items,[]); }
  },
  async delItem(id){
    if(this.db){ try{ await this.db.doc("items/"+id).delete() }catch(e){ writeErr(e) } }
    else { state.items=state.items.filter(x=>x.id!==id); this.saveLocal(); onItems(state.items,[]); }
  },
  async addPurchase(p){
    const id=uid();
    if(this.db){ try{ await this.db.doc("purchases/"+id).set(p) }catch(e){ writeErr(e) } }
    else { state.purchases.push({id,...p}); this.saveLocal(); render(); }
  },
  async addChat(m){
    const id=String(m.at).padStart(15,"0")+"-"+uid();
    if(this.db){ try{ await this.db.doc("chat/"+id).set(m); return true }catch(e){ writeErr(e); return false } }
    else { state.chat.push({id,...m}); this.saveLocal(); onChat(state.chat); return true }
  },
  async delChat(id){
    if(this.db){ try{ await this.db.doc("chat/"+id).delete() }catch(e){ writeErr(e) } }
    else { state.chat=state.chat.filter(x=>x.id!==id); this.saveLocal(); onChat(state.chat); }
  },
  /* Bons liegen in einer eigenen Sammlung und werden nur bei Bedarf geladen (Fotos sind groß) */
  receipts:{},
  async addReceipt(r){
    const id=uid();
    if(this.db){ try{ await this.db.doc("receipts/"+id).set(r); this.receipts[id]=r; return id }catch(e){ writeErr(e); return null } }
    this.receipts[id]=r;
    let all={}; try{ all=JSON.parse(ls.get("wg_receipts")||"{}") }catch(e){}
    all[id]=r; try{ localStorage.setItem("wg_receipts",JSON.stringify(all)) }catch(e){ toast("Speicher voll: Bon-Foto nur bis zum Neuladen sichtbar.") }
    return id;
  },
  async getReceipt(id){
    if(this.receipts[id]) return this.receipts[id];
    if(this.db){ try{ const d=await this.db.doc("receipts/"+id).get(); return this.receipts[id]=d.exists?d.data():null }catch(e){ console.error(e); return null } }
    try{ return JSON.parse(ls.get("wg_receipts")||"{}")[id]||null }catch(e){ return null }
  },
  async setBin(id,data){
    if(this.db){ try{ await this.db.doc("bins/"+id).set(data) }catch(e){ writeErr(e) } }
    else { state.bins[id]=data; this.saveLocal(); render(); }
  },
  async setAway(id,data){
    if(this.db){ try{ await this.db.doc("away/"+id).set(data) }catch(e){ writeErr(e) } }
    else { const i=state.away.findIndex(x=>x.id===id); const v={id,...data}; i<0?state.away.push(v):state.away[i]=v; this.saveLocal(); render(); }
  },
  async delAway(id){
    if(this.db){ try{ await this.db.doc("away/"+id).delete() }catch(e){ writeErr(e) } }
    else { state.away=state.away.filter(x=>x.id!==id); this.saveLocal(); render(); }
  },
  async setTodo(id,data){
    if(this.db){ try{ await this.db.doc("todos/"+id).set(data) }catch(e){ writeErr(e) } }
    else { const i=state.todos.findIndex(x=>x.id===id); const v={id,...data}; i<0?state.todos.push(v):state.todos[i]=v; this.saveLocal(); render(); }
  },
  async delTodo(id){
    if(this.db){ try{ await this.db.doc("todos/"+id).delete() }catch(e){ writeErr(e) } }
    else { state.todos=state.todos.filter(x=>x.id!==id); this.saveLocal(); render(); }
  },
  async setPrefs(who,data){
    state.prefs[who]=data;
    if(this.db){ try{ await this.db.doc("prefs/"+who).set(data) }catch(e){ writeErr(e) } }
    else this.saveLocal();
  },
  async delPurchase(id){
    if(this.db){ try{ await this.db.doc("purchases/"+id).delete() }catch(e){ writeErr(e) } }
    else { state.purchases=state.purchases.filter(x=>x.id!==id); this.saveLocal(); render(); }
  }
};
function writeErr(e){ console.error(e); toast(e?.code==="permission-denied" ? "Keine Schreibrechte. Prüfe die Firestore-Regeln." : "Speichern hat nicht geklappt. Bist du online?"); }

function showNotice(t){ $("#notice").innerHTML=`<div class="notice">${esc(t)}</div>`; }
