/* ---------- Dialoge und Personenauswahl ---------- */
function openModal(html){ $("#modal").innerHTML=`<div class="scrim">${html}</div>`; const s=$("#modal .scrim"); s.addEventListener("click",e=>{ if(e.target===s && !s.dataset.lock) closeModal(); }); setTimeout(()=>$("#modal .sheet button, #modal .sheet input")?.focus(),50); }
function closeModal(){ $("#modal").innerHTML=""; }

function pickMe(){
  openModal(`<div class="sheet" role="dialog" aria-modal="true"><h2>Wer bist du?</h2><p class="sub">Damit die anderen sehen, wer was gemeldet oder gekauft hat. Wird auf diesem Gerät gemerkt.</p>
    <div class="names">${PEOPLE.map(p=>`<button data-me="${p}">${avatar(p)}${p}</button>`).join("")}</div></div>`);
  $("#modal .scrim").dataset.lock = me ? "" : "1";
  document.querySelectorAll("[data-me]").forEach(b=>b.onclick=()=>{ me=b.dataset.me; ls.set("wg_me",me); closeModal(); play("pop"); toast(`Hi ${me}! 👋`); render(); checkWelcome(); });
}
