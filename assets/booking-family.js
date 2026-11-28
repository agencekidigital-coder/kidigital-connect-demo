(function(){
 for(const toggle of document.querySelectorAll('[data-family-toggle]')){
  const target=document.getElementById(toggle.dataset.familyToggle);
  if(!target)continue;
  const update=()=>{target.hidden=!toggle.checked;target.disabled=!toggle.checked;};
  toggle.addEventListener('change',update);update();
 }
 const panel=document.querySelector('[data-workshop-payment]'),seats=document.getElementById('seats');
 if(panel&&seats){
  const money=c=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(c/100);
  const update=()=>{const choice=panel.querySelector('[name=payment_method]:checked')?.value||panel.querySelector('input[type=hidden][name=payment_method]')?.value;const n=Number(seats.value),total=Number(panel.dataset.total)*n,online=Number(panel.dataset.unit)*n;
   panel.querySelector('[data-workshop-payment-summary]').textContent=!choice?'Total : '+money(total)+' · Choisissez votre règlement.':'À régler maintenant : '+money(choice==='onsite'?0:online)+' · Reste sur place : '+money(choice==='onsite'?total:total-online);
  };seats.addEventListener('change',update);panel.addEventListener('change',update);update();
 }
})();