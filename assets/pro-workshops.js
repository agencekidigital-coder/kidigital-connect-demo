/* Private workshop data never enters the shared demonstration state or localStorage. */
(function(root){
'use strict';
function create(d){
  let enabled=false, owner=null, client=null, revision=0, rows=[], ready=false, busy=false, truncated=false, message='', observed=false, uncertain=false, controller=null, timer=null;
  const el=id=>document.getElementById(id);
  const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
  function closePrivate(){if(el('naiteaPrivateWorkshopForm'))d.closeModal();}
  function clear(){revision++;controller?.abort();owner=null;rows=[];ready=false;busy=false;uncertain=false;truncated=false;closePrivate();}
  function invalidate(){clear();message='Vérification du compte…';if(d.isPage())decorate();}
  async function api(method,payload,version){
    const {data,error}=await client.auth.getSession();
    if(version!==revision)return null;
    const session=data?.session;
    if(error||!session?.access_token||session.user.id!==owner)throw Error('Reconnecte-toi à ton compte.');
    const c=new AbortController();controller=c;const timeout=setTimeout(()=>c.abort(),18000);
    try{
      const response=await fetch('/api/workshops',{method,credentials:'omit',cache:'no-store',signal:c.signal,headers:{Authorization:'Bearer '+session.access_token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
      if(!response.ok)throw Error('Enregistrement ou lecture non confirmé ('+response.status+').');
      const result=await response.json();
      if(!Array.isArray(result.workshops))throw Error('Réponse invalide.');
      return revision===version?result:null;
    }finally{clearTimeout(timeout);if(controller===c)controller=null;}
  }
  async function load(){
    invalidate();const version=revision;
    try {
      const {data,error}=await client.auth.getUser();if(version!==revision)return;
      if(error||!data?.user){message='Connecte-toi pour retrouver tes ateliers privés.';return;}
      owner=data.user.id;
      const result=await api('GET',null,version);if(!result)return;
      rows=result.workshops;truncated=result.truncated;ready=true;message='Tes brouillons sont enregistrés dans ton compte. Ils ne sont pas publics.';
    }catch{if(version===revision)message='Impossible de charger les ateliers. Réessaie.';}
    finally{if(version===revision&&d.isPage())decorate();}
  }
  function localDate(value){if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  function view(w){
    if(!w)return null;
    const date=localDate(w.starts_at);
    return {id:w.id,title:w.title,description:w.description||'',date:date.slice(0,10),time:date.slice(11),capacity:w.capacity,price:w.price_cents/100,duration:w.duration_label||'',category:w.category||'Massage bébé',workshopModality:w.modality||'venue',venueName:w.venue_name||'',venueAddress:{street:w.venue_street||'',postalCode:w.venue_postal_code||'',city:w.venue_city||''},videoPlatform:w.video_platform||'',targetAudiences:w.target_audiences||['Jeunes parents','Bébés'],childAge:w.child_age_unit?{min:w.child_age_min,max:w.child_age_max,unit:w.child_age_unit}:null};
  }
  function fields(form){
    const e=form.elements, video=form.querySelector('[name="workshopModality"]:checked')?.value==='video';
    for(const [selector,on] of [['[data-workshop-venue]',!video],['[data-workshop-video]',video],['[data-child-age]',e.ageEnabled.checked]]){
      const node=form.querySelector(selector);node.hidden=!on;for(const input of node.querySelectorAll('input,select'))input.disabled=!on;
    }
    for(const [name,on] of [['videoOther',video&&e.videoPlatform.value==='Autre'],['customCategory',e.category.value==='__custom']]){
      e[name].closest('label').hidden=!on;e[name].disabled=!on;e[name].required=on;
    }
  }
  function toPayload(form,w){
    const fd=new FormData(form), values=Object.fromEntries(fd);values.audiences=fd.getAll('audiences');
    const extra=d.tools.workshop(values),date=new Date(values.date+'T'+values.time);
    if(!Number.isFinite(date.getTime())||localDate(date.toISOString())!==values.date+'T'+values.time)throw Error('Choisis une date et une heure valides.');
    const age=extra.childAge, address=extra.venueAddress;
    return {title:values.title,description:values.description||null,starts_at:date.toISOString(),capacity:Number(values.capacity),price_cents:Math.round(Number(values.price)*100),category:extra.category,duration_label:values.duration?.trim()||null,timezone_name:Intl.DateTimeFormat().resolvedOptions().timeZone,modality:extra.workshopModality,venue_name:extra.venueName||null,venue_street:address?.street||null,venue_postal_code:address?.postalCode||null,venue_city:address?.city||null,video_platform:extra.videoPlatform||null,target_audiences:extra.targetAudiences,child_age_min:age?.min??null,child_age_max:age?.max??null,child_age_unit:age?.unit??null,...(w?{id:w.id}:{})};
  }
  function open(w){
    if(!ready||busy||uncertain||!owner||!d.isPage())return;
    const container=document.createElement('div');container.innerHTML=d.formHtml(view(w));
    const form=container.querySelector('form');
    form.id='naiteaPrivateWorkshopForm';
    const cover=form.querySelector('#v5CoverFile');cover?.closest('.field')?.remove();
    for(const node of form.querySelectorAll('[data-v6],[data-action]:not([data-action="close-modal"])'))node.remove();
    form.querySelector('.naitea-description-tools')?.remove();
    const helper=text('p','Photo de couverture : stockage sécurisé à venir. Heure locale de ton appareil.');helper.className='fine';form.querySelector('.modalfooter').before(helper);
    form.elements.price.step='0.01';
    form.querySelector('[type="submit"]').textContent='Enregistrer le brouillon';
    d.showModal(w?'Modifier mon atelier':'Créer un atelier','Les informations restent privées tant que la publication n’est pas ouverte.',container.innerHTML);
    const active=el('naiteaPrivateWorkshopForm');fields(active);
    active.addEventListener('change',()=>fields(active));
    const status=text('p','');status.setAttribute('role','status');active.append(status);
    active.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();if(busy||uncertain||!ready||!d.isPage())return;
      let payload;try{payload=toPayload(active,w);}catch(error){status.textContent=error.message;return;}
      const version=revision;busy=true;
      for(const field of active.elements)field.disabled=true;status.textContent='Enregistrement…';
      try{
        const result=await api(w?'PATCH':'POST',payload,version);if(!result)return;
        const saved=result.workshops[0];if(!saved)throw Error('Enregistrement non confirmé.');
        rows=[saved,...rows.filter(r=>r.id!==saved.id)];message='Brouillon enregistré dans ton compte.';
        closePrivate();if(d.isPage())decorate();
      }catch{if(version===revision){uncertain=true;message='Enregistrement non confirmé. Actualise avant toute nouvelle tentative.';closePrivate();if(d.isPage())decorate();}}
      finally{if(version===revision){busy=false;if(d.isPage())decorate();}}
    });
  }
  function button(label,action){const b=text('button',label);b.type='button';b.className='btn secondary';b.addEventListener('click',action);return b;}
  function decorate(){
    if(!enabled||!d.isPage())return;
    const app=el('app');if(!app)return;
    const panel=document.createElement('section');panel.className='card';panel.id='naiteaPrivateWorkshops';
    const title=text('h1','Mes ateliers 🌸');const note=text('p',message||'Vérification de la connexion…');note.setAttribute('role','status');
    panel.append(title,note);
    const createButton=button('Nouvel atelier',()=>open(null));createButton.className='btn';createButton.disabled=!ready||busy||uncertain;
    panel.append(createButton,button('Actualiser',()=>{if(client&&!busy)load();}));
    if(!owner){const login=text('a','Me connecter');login.href='/connexion.html?mode=login';login.className='btn secondary';panel.append(login);}
    if(ready&&!rows.length)panel.append(text('p','Tu n’as pas encore d’atelier enregistré.'));
    const grid=document.createElement('div');grid.className='events';
    for(const w of rows){
      const card=document.createElement('article');card.className='card eventcard';
      const content=document.createElement('div');content.className='eventcontent';
      const headline=text('h3',w.title);headline.className='eventtitle';
      const date=w.starts_at?new Date(w.starts_at).toLocaleString('fr-FR'):'Date à préciser';
      content.append(headline,text('p',[w.category,date,w.capacity+' places',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})].filter(Boolean).join(' · ')),text('p',w.status==='draft'?'Brouillon privé':w.status));
      if(w.status==='draft'){const edit=button('Modifier',()=>open(w));edit.disabled=busy||uncertain;content.append(edit);}
      card.append(content);grid.append(card);
    }
    panel.append(grid);if(truncated)panel.append(text('p','100 ateliers les plus récents affichés.'));
    panel.append(text('p','Les autres rubriques, y compris le tableau de bord et l’agenda, restent des démonstrations. Aucun atelier privé n’y est copié.'));
    app.replaceChildren(panel);
  }
  async function start(){
    try{
      const response=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});
      if(!response.ok||!(await response.json()).workshopPersistence)return;
      enabled=true;if(d.isPage())decorate();
      let attempts=0;
      timer=setInterval(()=>{
        const next=d.getClient();
        if(!next){if(++attempts>100){clearInterval(timer);message='Connexion indisponible. Recharge la page.';if(d.isPage())decorate();}return;}
        clearInterval(timer);client=next;
        if(!observed){observed=true;client.auth.onAuthStateChange((event,session)=>{
          if(owner&&session?.user?.id===owner&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;
          invalidate();setTimeout(load,0);
        });}
        load();
      },100);
    }catch{}
  }
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted&&client)load();});
  return {start,decorate};
}
root.NaiteaProWorkshops={create};
})(globalThis);
