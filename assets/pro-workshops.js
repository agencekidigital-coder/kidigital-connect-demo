/* Private workshop data never enters the shared demonstration state or localStorage. */
(function(root){
'use strict';
// Calendar periods match the existing pro calendar (Monday-first, 42-day month).
function localDate(value){
  if(!value)return '';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';
}
function calendarDates(value,view){
  const date=new Date(value+'T12:00:00');
  if(!Number.isFinite(date.getTime()))return [];
  if(view==='month')date.setDate(1);
  if(view==='month'||view==='week')date.setDate(date.getDate()-(date.getDay()+6)%7);
  const count=view==='month'?42:view==='week'?7:1;
  return Array.from({length:count},(_,i)=>{const d=new Date(date);d.setDate(d.getDate()+i);return localDate(d).slice(0,10);});
}
function upcomingRows(rows,now=Date.now()){
  return rows.filter(w=>w.status==='draft'&&w.starts_at&&Number.isFinite(Date.parse(w.starts_at))&&Date.parse(w.starts_at)>=now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
}
function rowsOnDate(rows,date){
  return rows.filter(w=>w.status==='draft'&&w.starts_at&&localDate(w.starts_at).slice(0,10)===date).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
}
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
  function workshopCard(w){
    const card=document.createElement('article');card.className='card eventcard';
    const content=document.createElement('div');content.className='eventcontent';
    const headline=text('h3',w.title);headline.className='eventtitle';
    const date=w.starts_at?new Date(w.starts_at).toLocaleString('fr-FR'):'Date à préciser';
    content.append(headline,text('p',[w.category,date,w.capacity+' places',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})].filter(Boolean).join(' · ')),text('p',w.status==='draft'?'Brouillon privé':w.status));
    if(w.status==='draft'){const edit=button('Modifier',()=>open(w));edit.disabled=!ready||busy||uncertain;content.append(edit);}
    card.append(content);return card;
  }
  function decorateDashboard(app){
    // Keep the original dashboard layout and calendar controls. Never copy DB
    // rows into the demo model, its storage, notifications or public links.
    const head=app.querySelector('.headrow');
    if(head){
      for(const old of head.querySelectorAll('[data-action="create-event"],[data-private-dashboard-action]'))old.remove();
      const createButton=button('Créer un atelier',()=>open(null));createButton.className='btn';createButton.dataset.privateDashboardAction='1';createButton.disabled=!ready||busy||uncertain;
      const actions=document.createElement('div');actions.dataset.privateDashboardAction='1';
      const reload=button('Actualiser',()=>{if(client&&!busy)load();});reload.disabled=!client||busy;actions.append(createButton,reload);
      if(!owner){const login=text('a','Me connecter');login.href='/connexion.html?mode=login';login.className='btn secondary';actions.append(login);}
      head.append(actions);
    }
    let notice=app.querySelector('.naitea-demo-warning');
    if(!notice){notice=text('p','');notice.className='naitea-demo-warning';notice.setAttribute('role','status');if(head)head.after(notice);else app.prepend(notice);}
    notice.textContent=(message||'Vérification de la connexion…')+' Les inscriptions, rendez-vous et contacts ne sont pas encore raccordés.'+(truncated?' Seuls les 100 ateliers les plus récents sont chargés.':'');
    const upcoming=ready?upcomingRows(rows):[];
    const metrics=app.querySelector('.dashboard-metrics');
    if(metrics){
      const metric=(label,value,detail,link)=>{
        const node=document.createElement(link?'button':'div');node.className='card metric';
        if(link){node.type='button';node.dataset.nav='ateliers';}
        const title=text('span',label);title.className='metrichead';
        const number=text('span',value);number.className='metricnum';
        const note=text('span',detail);note.className='fine';
        node.append(title,number,note);return node;
      };
      metrics.replaceChildren(metric('Ateliers à venir',ready?(truncated?'≥ ':'')+upcoming.length:'—',ready?'Brouillons privés':'Non chargé',true),metric('Inscriptions','—','Bientôt disponible',false),metric('Contacts','—','Bientôt disponible',false),metric('Abonnements newsletter','—','Bientôt disponible',false));
    }
    const program=app.querySelector('.dashboard-program .events');
    if(program){
      program.replaceChildren();
      if(ready&&upcoming.length){for(const w of upcoming.slice(0,2))program.append(workshopCard(w));}
      else{const empty=text('p',ready?'Aucun brouillon à venir.':'Tes ateliers apparaîtront après connexion et chargement.');empty.className='card empty';program.append(empty);}
    }
    const activity=app.querySelector('.dashboard-activity');
    if(activity){
      const title=text('h2','Activité récente'), heading=document.createElement('div');heading.className='sectionhead';heading.append(title);
      const list=document.createElement('div');list.className='card list';
      const recent=ready?rows.filter(w=>w.status==='draft'&&w.created_at&&Number.isFinite(Date.parse(w.created_at))).slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,4):[];
      for(const w of recent){const line=document.createElement('div');line.className='activity';const body=document.createElement('div');body.append(text('strong','Brouillon créé : '+w.title),text('p',new Date(w.created_at).toLocaleString('fr-FR')));line.append(body);list.append(line);}
      if(!recent.length)list.append(text('p',ready?'Aucune création enregistrée.':'Activité non chargée.'));
      activity.replaceChildren(heading,list);
    }
    const calendar=app.querySelector('.v8-calendar');
    if(calendar){
      const {date,view}=d.calendarState(), dates=calendarDates(date,view), cells=calendar.querySelectorAll('.v8-cal-day');
      // Always remove demonstration entries, even if date/layout mismatch.
      cells.forEach((cell,i)=>{
        const header=cell.querySelector('.v8-cal-date');cell.replaceChildren();if(header)cell.append(header);
        const items=ready&&dates.length===cells.length?rowsOnDate(rows,dates[i]):[];
        for(const w of items){
          const item=button(localDate(w.starts_at).slice(11)+' · '+w.title,()=>open(w));
          item.className='v8-cal-item workshop';item.title=w.title+' · Brouillon privé';item.setAttribute('aria-label',item.title+' '+localDate(w.starts_at).slice(11));item.disabled=busy||uncertain;cell.append(item);
        }
        if(!items.length&&view==='day')cell.append(text('p',ready?'Aucun atelier enregistré ce jour.':'Agenda non chargé.'));
      });
      const legend=calendar.querySelector(':scope > p.fine');if(legend)legend.textContent='Corail : brouillons privés · Rendez-vous individuels : bientôt disponibles.';
      const hint=calendar.querySelector('.v8-calendar-mobile-hint');if(hint)hint.textContent='Sélectionne un atelier pour le modifier. Les dates utilisent le fuseau de ton appareil.';
    }
  }
  function decorate(){
    const active=enabled&&d.isPage();
    document.body.classList.toggle('naitea-private-workspace',active);
    if(!active){closePrivate();return;}
    if(d.page()==='dashboard'){const app=el('app');if(app)decorateDashboard(app);return;}
    const app=el('app');if(!app)return;
    const panel=document.createElement('section');panel.className='card';panel.id='naiteaPrivateWorkshops';
    const title=text('h1','Mes ateliers 🌸');const note=text('p',message||'Vérification de la connexion…');note.setAttribute('role','status');
    panel.append(title,note);
    const createButton=button('Nouvel atelier',()=>open(null));createButton.className='btn';createButton.disabled=!ready||busy||uncertain;
    panel.append(createButton,button('Actualiser',()=>{if(client&&!busy)load();}));
    if(!owner){const login=text('a','Me connecter');login.href='/connexion.html?mode=login';login.className='btn secondary';panel.append(login);}
    if(ready&&!rows.length)panel.append(text('p','Tu n’as pas encore d’atelier enregistré.'));
    const grid=document.createElement('div');grid.className='events';
    for(const w of rows)grid.append(workshopCard(w));
    panel.append(grid);if(truncated)panel.append(text('p','100 ateliers les plus récents affichés.'));
    panel.append(text('p','Le tableau de bord et le calendrier utilisent aussi ces brouillons privés. Les autres rubriques restent des démonstrations.'));
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
  window.addEventListener('pagehide',()=>{clear();if(enabled&&d.isPage())decorate();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&client)load();});
  return {start,decorate};
}
const api={create,calendarDates,upcomingRows,rowsOnDate};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.NaiteaProWorkshops=api;
})(globalThis);
