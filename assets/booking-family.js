(function(){
 for(const toggle of document.querySelectorAll('[data-family-toggle]')){
  const target=document.getElementById(toggle.dataset.familyToggle);
  if(!target)continue;
  const update=()=>{target.hidden=!toggle.checked;target.disabled=!toggle.checked;};
  toggle.addEventListener('change',update);update();
 }
})();