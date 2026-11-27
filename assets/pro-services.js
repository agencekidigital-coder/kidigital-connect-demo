/* Private beta: individual services and weekly availability. No public booking yet. */
(function(root){
'use strict';
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const MODES={practice:'En cabinet',home:'À domicile',video:'En visioconférence'};
const STATES={draft:'Brouillon',active:'Active',archived:'Archivée'};
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n/100);
const minutes=s=>{if(!/^\d{2}:\d{2}$/.test(s))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function priceCents(s){s=String(s).trim().replace(',','.');if(!/^\d{1,6}(?:\.\d{1,2})?$/.test(s))throw Error('Indique un tarif valide en euros.');const n=Math.round(Number(s)*100);if(n>10000000)throw Error('Tarif trop élevé.');return n;}
function parisDay(){const p=Object.fromEntries(new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(v=>[v.type,v.value]));return p.year+'-'+p.month+'-'+p.day;}
function create(d){
 let client=null,owner=null,enabled=false,checked=false,active=false,view='',generation=0,loading=false,loaded=false,busy=false,notice='',failed=false,services=[],rules=[],closed=[],edit=null,chosen='';
 const node=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
 const text=(tag,v)=>{const e=node(tag);e.textContent=v;return e;};
 const button=(label,fn,primary=false)=>{const b=text('button',label);b.type='button';b.className=primary?'btn':'btn secondary';b.addEventListener('click',fn);return b;};
 const current=()=>d.isPage()&&active&&d.page()===view;
 const safe=(v,uid)=>current()&&generation===v&&owner===uid;
 let subscription=null;
 function clear(){generation++;owner=null;loaded=loading=busy=failed=false;services=[];rules=[];closed=[];edit=null;chosen='';notice='';}
 function leave(){if(active){active=false;clear();}document.body.classList.remove('naitea-service-workspace');}
 function connect(){const next=d.getClient();if(!next)return false;if(next!==client){subscription?.unsubscribe();client=next;subscription=null;}if(!subscription){const r=client.auth.onAuthStateChange((event,session)=>{if(!active||!current()||event==='INITIAL_SESSION')return;if(owner&&session?.user?.id===owner&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;clear();paint();setTimeout(load,0);});subscription=r.data.subscription;}return true;}
 async function load(){
  if(!current()||!enabled||loading||busy)return;
  loading=true;loaded=false;failed=false;notice='Chargement…';paint();const v=++generation;
  try{
   if(!connect()){if(v===generation){notice='Connexion en cours…';setTimeout(()=>{if(v===generation&&current())load();},500);}return;}
   const auth=await client.auth.getUser();if(!current()||v!==generation)return;
   if(auth.error||!auth.data?.user||auth.data.user.is_anonymous){owner=null;notice='Connecte-toi pour accéder à tes accompagnements.';failed=true;return;}
   owner=auth.data.user.id;const uid=owner;
   const [a,b,c]=await Promise.all([
    client.from('naitea_services').select('*',{count:'exact'}).eq('professional_id',uid).order('created_at').limit(500),
    client.from('naitea_service_availability').select('*',{count:'exact'}).eq('professional_id',uid).order('weekday').order('start_minute').limit(1000),
    client.from('naitea_service_closed_days').select('*',{count:'exact'}).eq('professional_id',uid).order('closed_date').limit(1000)
   ]);
   if(!safe(v,uid))return;
   if([a,b,c].some(r=>r.error||!Array.isArray(r.data)||r.data.some(x=>x.professional_id!==uid)||r.count>r.data.length))throw Error('Chargement incomplet. Réessaie avant de modifier tes données.');
   services=a.data;rules=b.data;closed=c.data;loaded=true;notice='';
   if(!services.some(s=>s.id===chosen&&s.status!=='archived'))chosen=services.find(s=>s.status!=='archived')?.id||'';
  }catch(e){if(v===generation&&current()){failed=true;notice=e.message||'Chargement impossible.';}}
  finally{if(v===generation&&current()){loading=false;paint();}}
 }
 async function mutate(action,success,status){
  if(!loaded||busy||!owner||!current())return;
  const v=generation,uid=owner;busy=true;status.textContent='Enregistrement…';const panel=document.getElementById('naiteaPrivateServices');const controls=[...panel.querySelectorAll('button,input,select,textarea')];const prev=controls.map(e=>e.disabled);controls.forEach(e=>e.disabled=true);
  try{
   const auth=await client.auth.getUser();if(!safe(v,uid))return;if(auth.error||auth.data?.user?.id!==uid)throw Error('Session expirée.');
   const result=await action(uid);if(!safe(v,uid))return;
   if(result.error){const code=result.error.code;throw Error(code==='23P01'?'Cette plage chevauche une disponibilité existante.':code==='23505'?'Cette plage ou date existe déjà.':code==='23514'?'Vérifie les horaires et la durée de la séance.':'Enregistrement non confirmé. Actualise avant de réessayer.');}
   if(!result.data||Array.isArray(result.data)&&result.data.length!==1)throw Error('Modification non confirmée. Actualise la page.');
   edit=null;busy=false;await load();if(current()&&owner===uid&&loaded){notice=success;paint();}
  }catch(e){if(safe(v,uid))status.textContent=e.message||'Action non confirmée.';}
  finally{if(safe(v,uid)){busy=false;controls.forEach((e,i)=>e.disabled=prev[i]);}}
 }
 function field(label,name,type,value,opts={}){
  const wrap=node('label','field');wrap.append(text('span',label));const input=node(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;else input.rows=4;input.name=name;input.value=value??'';for(const [k,v] of Object.entries(opts)){if(k==='required')input.required=v;else input.setAttribute(k,String(v));}wrap.append(input);return wrap;
 }
 function selectField(label,name,options,value){
  const wrap=node('label','field');wrap.append(text('span',label));const select=node('select');select.name=name;for(const [v,l] of options){const o=text('option',l);o.value=String(v);select.append(o);}select.value=String(value??options[0]?.[0]??'');select.required=true;wrap.append(select);return wrap;
 }
 function statusLine(){const p=text('p','');p.setAttribute('role','status');return p;}
 function heading(panel,title,img,desc){const h=node('div','naitea-family-heading');const image=node('img');image.src='/assets/berceau/transparent/'+img+'.png';image.alt='';image.width=80;image.height=80;h.append(image,text('h1',title));panel.append(h,text('p',desc));}
 function serviceForm(panel,s){
  const form=node('form','naitea-service-form');form.append(text('h2',s?'Modifier cet accompagnement':'Nouvel accompagnement'));
  form.append(field('Nom de la prestation *','title','text',s?.title,{required:true,maxlength:120,placeholder:'Ex. Consultation sommeil'}),field('Description','description','textarea',s?.description,{maxlength:3000}));
  const grid=node('div','naitea-family-fields');
  grid.append(field('Durée de la séance (minutes) *','duration','number',s?.duration_minutes??60,{required:true,min:15,max:480,step:5}),field('Temps entre deux séances (minutes)','buffer','number',s?.buffer_minutes??15,{required:true,min:0,max:120,step:5}),field('Tarif en euros *','price','number',s?(s.price_cents/100).toFixed(2):'0',{required:true,min:0,max:100000,step:0.01}),selectField('Modalité','modality',Object.entries(MODES),s?.modality??'practice'),field('Lieu / précision (facultatif)','location','text',s?.location,{maxlength:250,placeholder:'Cabinet, zone de déplacement…'}),selectField('Statut','status',Object.entries(STATES).filter(([k])=>k!=='archived'||s?.status==='archived'),s?.status??'draft'));
  form.append(grid,text('p','Une prestation active peut être préparée avec des disponibilités. Elle ne sera pas encore visible ni réservable côté familles.'));
  const status=statusLine(),save=text('button','Enregistrer');save.className='btn';save.type='submit';const actions=node('div','naitea-family-actions');actions.append(button('Retour',()=>{edit=null;paint();}),save);form.append(status,actions);panel.append(form);
  form.addEventListener('submit',e=>{
   e.preventDefault();e.stopImmediatePropagation();if(busy)return;const f=new FormData(form);
   let payload;try{
    const title=String(f.get('title')).trim(),duration=Number(f.get('duration')),buffer=Number(f.get('buffer'));
    if(!title||duration<15||duration>480||duration%5||buffer<0||buffer>120||buffer%5)throw Error('Vérifie le titre et la durée.');
    payload={title,description:String(f.get('description')||'').trim(),duration_minutes:duration,buffer_minutes:buffer,price_cents:priceCents(f.get('price')),modality:String(f.get('modality')),location:String(f.get('location')||'').trim()||null,status:String(f.get('status'))};
   }catch(err){status.textContent=err.message;return;}
   mutate(uid=>s?client.from('naitea_services').update(payload).eq('id',s.id).eq('professional_id',uid).select('id').single():client.from('naitea_services').insert({...payload,professional_id:uid}).select('id').single(),'Accompagnement enregistré.',status);
  });
 }
 function offers(panel){
  if(edit!==null){serviceForm(panel,edit==='new'?null:services.find(x=>x.id===edit));return;}
  const actions=node('div','naitea-family-actions');actions.append(button('+ Ajouter un accompagnement',()=>{edit='new';paint();},true),button('Mes disponibilités',()=>d.go('rendezvous')),button('Actualiser',load));panel.append(actions);
  const metrics=node('div','naitea-family-metrics');for(const [l,n] of [['Accompagnements',services.filter(s=>s.status!=='archived').length],['Actifs',services.filter(s=>s.status==='active').length],['Brouillons',services.filter(s=>s.status==='draft').length]]){const c=node('div','naitea-family-detail');c.append(text('span',l),text('strong',String(n)));metrics.append(c);}panel.append(metrics);
  if(!services.length){panel.append(text('p','Tu n’as pas encore créé d’accompagnement. Commence par ta première prestation !'));return;}
  const grid=node('div','naitea-service-grid');
  for(const s of services){const c=node('article','naitea-family-detail naitea-service-card');c.append(text('h2',s.title),text('p',STATES[s.status]),text('p',s.description||'Pas de description.'),text('strong',money(s.price_cents)),text('p',s.duration_minutes+' min · pause '+s.buffer_minutes+' min · '+MODES[s.modality]));if(s.location)c.append(text('p',s.location));c.append(text('p',rules.filter(r=>r.service_id===s.id).length+' plage(s) hebdomadaire(s)'));
   const buttons=node('div','naitea-family-actions'),status=statusLine();buttons.append(button('Modifier',()=>{edit=s.id;paint();}),button('Disponibilités',()=>{chosen=s.id;d.go('rendezvous');}));if(s.status!=='archived')buttons.append(button('Archiver',()=>{if(confirm('Archiver cette prestation ? Ses informations restent conservées.'))mutate(uid=>client.from('naitea_services').update({status:'archived'}).eq('id',s.id).eq('professional_id',uid).select('id').single(),'Prestation archivée.',status);}));
   c.append(buttons,status);grid.append(c);
  }panel.append(grid);
 }
 function availability(panel){
  const available=services.filter(s=>s.status!=='archived');const actions=node('div','naitea-family-actions');actions.append(button('Gérer mes accompagnements',()=>d.go('offers')),button('Actualiser',load));panel.append(actions);
  panel.append(text('h2','Disponibilités hebdomadaires'),text('p','Fuseau horaire : Europe/Paris. Chaque plage se répète chaque semaine. Les jours bloqués s’appliquent à toutes tes prestations.'));
  if(!available.length)panel.append(text('p','Crée d’abord un accompagnement pour définir ses disponibilités.'));
  else{
   const form=node('form','naitea-service-form');const service=selectField('Accompagnement','service',available.map(s=>[s.id,s.title]),chosen||available[0].id);const sel=service.querySelector('select');sel.addEventListener('change',()=>{chosen=sel.value;paint();});form.append(service);
   const selected=available.find(s=>s.id===sel.value)||available[0];chosen=selected.id;
   form.append(text('p','Durée : '+selected.duration_minutes+' min · pause entre séances : '+selected.buffer_minutes+' min'));
   const grid=node('div','naitea-family-fields');grid.append(selectField('Jour','weekday',DAYS.map((s,i)=>[i+1,s]),1),field('De','start','time','09:00',{required:true,step:300}),field('À','end','time','17:00',{required:true,step:300}));form.append(grid);
   const add=text('button','Ajouter une plage');add.type='submit';add.className='btn';const status=statusLine();form.append(add,status);panel.append(form);
   form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form),start=minutes(f.get('start')),end=minutes(f.get('end'));if(!Number.isInteger(start)||!Number.isInteger(end)||start%5||end%5||end-start<selected.duration_minutes){status.textContent='La plage doit être au moins aussi longue que la séance, avec des horaires par pas de 5 minutes.';return;}mutate(uid=>client.from('naitea_service_availability').insert({professional_id:uid,service_id:selected.id,weekday:Number(f.get('weekday')),start_minute:start,end_minute:end}).select('id').single(),'Disponibilité ajoutée.',status);});
   const list=node('div','naitea-service-grid');for(const day of DAYS.map((label,i)=>({label,n:i+1}))){const c=node('div','naitea-family-detail');c.append(text('h3',day.label));const dayRules=rules.filter(r=>r.service_id===selected.id&&r.weekday===day.n);if(!dayRules.length)c.append(text('p','Non disponible'));for(const r of dayRules){const line=node('div','naitea-family-actions'),status=statusLine();line.append(text('strong',clock(r.start_minute)+' – '+clock(r.end_minute)),button('Retirer',()=>{if(confirm('Retirer cette disponibilité hebdomadaire ?'))mutate(uid=>client.from('naitea_service_availability').delete().eq('id',r.id).eq('professional_id',uid).select('id').single(),'Disponibilité retirée.',status);}));c.append(line,status);if(r.end_minute-r.start_minute<selected.duration_minutes)c.append(text('p','Plage trop courte pour la durée actuelle.'));}list.append(c);}panel.append(list);
  }
  panel.append(text('h2','Dates d’indisponibilité'));
  const form=node('form','naitea-service-form'),status=statusLine();form.append(field('Journée à bloquer','date','date',parisDay(),{required:true,min:parisDay(),max:'2100-12-31'}));const add=text('button','Bloquer cette journée');add.type='submit';add.className='btn';form.append(add,status);panel.append(form);
  form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();const date=new FormData(form).get('date');if(!date||date<parisDay()){status.textContent='Choisis une date à venir.';return;}mutate(uid=>client.from('naitea_service_closed_days').insert({professional_id:uid,closed_date:date}).select('id').single(),'Journée bloquée.',status);});
  const days=closed.filter(r=>r.closed_date>=parisDay());if(!days.length)panel.append(text('p','Aucune indisponibilité à venir.'));for(const r of days){const line=node('div','naitea-family-actions'),status=statusLine();line.append(text('strong',r.closed_date.split('-').reverse().join('/')),button('Débloquer',()=>mutate(uid=>client.from('naitea_service_closed_days').delete().eq('id',r.id).eq('professional_id',uid).select('id').single(),'Journée débloquée.',status)));panel.append(line,status);}
  panel.append(text('h2','Mes rendez-vous'),text('p','La création des rendez-vous, les réservations en ligne et la prévention des conflits avec les ateliers seront raccordées lors de la prochaine étape. Aucun créneau n’est encore réservable.'));
 }
 function paint(){
  if(!current())return;const app=document.getElementById('app');if(!app)return;const panel=node('section','card naitea-crm naitea-service-panel');panel.id='naiteaPrivateServices';app.replaceChildren(panel);
  if(view==='offers')heading(panel,'Mes accompagnements','seance-individuelle','Crée tes prestations individuelles et prépare leur réservation.');else heading(panel,'Mes rendez-vous','agenda','Organise tes disponibilités et tes journées d’absence.');
  if(!checked){panel.append(text('p','Vérification de la connexion…'));return;}if(!enabled){panel.append(text('p','Cette fonctionnalité est disponible uniquement dans la bêta privée.'));return;}
  if(notice){const p=text('p',notice);p.setAttribute('role','status');panel.append(p);}if(!loaded){if(!loading){panel.append(button('Actualiser',load));if(!owner){const a=text('a','Me connecter');a.href='/connexion.html';a.className='btn secondary';panel.append(a);}}return;}
  if(view==='offers')offers(panel);else availability(panel);
 }
 function decorate(){
  if(!d.isPage()){leave();return;}document.body.classList.add('naitea-service-workspace');
  const next=d.page();if(!active||view!==next){generation++;loading=busy=false;active=true;view=next;edit=null;paint();if(enabled&&!loaded)load();}else if(!document.getElementById('naiteaPrivateServices'))paint();
 }
 async function start(){try{const r=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});enabled=r.ok&&(await r.json()).realBookings===true;}catch{}finally{checked=true;if(d.isPage()){decorate();paint();if(enabled&&!loaded&&!loading)load();}}}
 window.addEventListener('pagehide',leave);window.addEventListener('pageshow',e=>{if(e.persisted){decorate();if(enabled&&!loaded&&!loading)load();}});
 return {start,decorate};
}
const api={create,minutes,clock,priceCents};if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaProServices=api;
})(globalThis);
