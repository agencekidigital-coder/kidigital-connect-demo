/* Manual appointments: private owner-scoped agenda and server-verified slots. */
(function(root){
'use strict';
const ZONE='Europe/Paris',MODES={practice:'En cabinet',home:'À domicile',video:'En visio',phone:'Par téléphone'};
function dayOf(value=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('fr-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function plusDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function monday(day){return plusDay(day,-(new Date(day+'T12:00:00Z').getUTCDay()+6)%7);}
const hour=v=>new Intl.DateTimeFormat('fr-FR',{timeZone:ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const labelDay=d=>new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const money=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v/100);
const optionLabel=s=>[MODES[s.modality],s.location_label,s.location_details].filter(Boolean).join(' · ');
function mount(d){
 const node=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;},text=(tag,v)=>{const n=node(tag);n.textContent=v;return n;};
 const button=(label,action,primary=false)=>{const b=text('button',label);b.type='button';b.className=primary?'btn':'btn secondary';b.addEventListener('click',action);return b;};
 const field=(label,control)=>{const wrap=node('label','field');wrap.append(text('span',label),control);return wrap;};
 const option=(value,label)=>{const o=text('option',label);o.value=value;return o;};
 const status=()=>{const p=text('p','');p.setAttribute('role','status');return p;};
 const section=node('section','naitea-appointments');let week=monday(d.initialDay||dayOf()),agendaSeq=0,slotSeq=0,familySeq=0,slots=[],familyRows=[],selectedSlot=null,requestId=null;
 const alive=()=>section.isConnected&&d.isCurrent();
 const head=node('div','naitea-appointment-head');head.append(text('h2','Mon agenda'),text('p','Ateliers, rendez-vous et absences au même endroit · heure de Paris.'));
 const tools=node('div','naitea-family-actions'),weekLabel=text('strong',''),prev=button('← Semaine',()=>{week=plusDay(week,-7);loadAgenda();}),next=button('Semaine →',()=>{week=plusDay(week,7);loadAgenda();});
 tools.append(prev,weekLabel,next,button('Aujourd’hui',()=>{week=monday(dayOf());loadAgenda();}));head.append(tools);
 const agendaStatus=status(),calendar=node('div','v8-calendar naitea-appointment-calendar'),weekGrid=node('div','naitea-appointment-week');calendar.append(weekGrid);section.append(head,agendaStatus,calendar);
 const form=node('form','naitea-service-form naitea-appointment-form');form.id='naiteaManualAppointmentForm';form.append(text('h2','Ajouter un rendez-vous'),text('p','Sélectionne une famille, un accompagnement et un créneau disponible.'));
 const service=node('select');service.required=true;service.append(option('','Choisir un accompagnement'));for(const s of d.services.filter(s=>s.status==='active'))service.append(option(s.id,s.title+' · '+s.duration_minutes+' min · '+money(s.price_cents)));service.value=d.initialService&&[...service.options].some(o=>o.value===d.initialService)?d.initialService:'';
 const date=node('input');date.type='date';date.required=true;date.min=dayOf();date.max=plusDay(dayOf(),365);date.value=d.initialDay&&d.initialDay>=date.min&&d.initialDay<=date.max?d.initialDay:date.min;
 const top=node('div','naitea-family-fields');top.append(field('Accompagnement',service),field('Date',date));form.append(top);
 const familyQuery=node('input');familyQuery.type='search';familyQuery.placeholder='Nom ou email (2 caractères minimum)';familyQuery.maxLength=100;const familySelect=node('select');familySelect.required=true;familySelect.append(option('','Choisir une famille'));
 const familyStatus=status(),familyBar=node('div','naitea-family-actions');familyBar.append(field('Rechercher une famille existante',familyQuery),button('Rechercher',searchFamily),button('Créer une fiche famille',()=>d.goFamilies()));form.append(familyBar,familyStatus,field('Famille',familySelect));
 const slotStatus=status(),slotBox=node('div','naitea-appointment-slots'),find=button('Voir les créneaux disponibles',loadSlots,true);
 form.append(find,slotStatus,slotBox);
 const submit=text('button','Confirmer le rendez-vous');submit.type='submit';submit.className='btn';submit.disabled=true;
 const formStatus=status();form.append(text('p','Bêta : familles fictives uniquement. Aucun email, paiement ni lien visio n’est envoyé à cette étape.'),submit,formStatus);section.append(form);
 function selectionChanged(){slotSeq++;slots=[];selectedSlot=null;requestId=null;slotBox.replaceChildren();slotStatus.textContent='';submit.disabled=true;}
 function updateSubmit(){submit.disabled=!(selectedSlot&&familySelect.value&&service.value&&date.value);}
 service.addEventListener('change',selectionChanged);date.addEventListener('change',selectionChanged);familySelect.addEventListener('change',()=>{requestId=null;updateSubmit();});
 familyQuery.addEventListener('input',()=>{familySeq++;familyRows=[];familySelect.replaceChildren(option('','Choisir une famille'));familyStatus.textContent='';requestId=null;updateSubmit();});
 familyQuery.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchFamily();}});
 async function searchFamily(){
  const query=familyQuery.value.trim();if(query.length<2){familyStatus.textContent='Saisis au moins deux caractères.';return;}
  const n=++familySeq;familyStatus.textContent='Recherche…';familySelect.replaceChildren(option('','Choisir une famille'));updateSubmit();
  try{const r=await d.client.rpc('naitea_search_appointment_families',{p_query:query});if(!alive()||n!==familySeq)return;if(r.error||!Array.isArray(r.data))throw Error();
   familyRows=r.data;for(const f of familyRows)familySelect.append(option(f.id,([f.first_name,f.last_name].filter(Boolean).join(' ')||'Famille')+' · '+f.email));familyStatus.textContent=familyRows.length?familyRows.length+' résultat(s).':'Aucune famille de test trouvée. Crée d’abord sa fiche dans Mes familles.';if(familyRows.length===1)familySelect.value=familyRows[0].id;requestId=null;updateSubmit();
  }catch{if(alive()&&n===familySeq)familyStatus.textContent='Recherche indisponible. Réessaie.';}
 }
 async function loadSlots(){
  selectionChanged();const serviceId=service.value,day=date.value,n=slotSeq;
  if(!serviceId||!day||day<date.min||day>date.max){slotStatus.textContent='Choisis un accompagnement actif et une date valide.';return;}
  slotStatus.textContent='Recherche des créneaux…';find.disabled=true;
  try{const r=await d.client.rpc('naitea_my_appointment_slots',{p_service:serviceId,p_day:day});if(!alive()||n!==slotSeq)return;if(r.error||!Array.isArray(r.data))throw Error();
   slots=r.data;slotStatus.textContent=slots.length?'Choisis une modalité et un horaire.':'Aucun créneau disponible à cette date (horaires, rendez-vous, atelier ou absence).';
   const groups=new Map();for(const s of slots){const k=JSON.stringify([s.modality,s.location_label,s.location_details]);if(!groups.has(k))groups.set(k,{label:optionLabel(s),rows:[]});groups.get(k).rows.push(s);}
   for(const g of groups.values()){const card=node('section','naitea-appointment-option');card.append(text('h3',g.label));const times=node('div','naitea-appointment-times');for(const s of g.rows){const b=button(hour(s.starts_at),()=>{selectedSlot=s;requestId=null;slotBox.querySelectorAll('[aria-pressed]').forEach(x=>{x.setAttribute('aria-pressed','false');x.classList.remove('is-selected');});b.setAttribute('aria-pressed','true');b.classList.add('is-selected');updateSubmit();});b.className='naitea-appointment-time';b.setAttribute('aria-pressed','false');b.title=hour(s.starts_at)+' – '+hour(s.ends_at);times.append(b);}card.append(times);slotBox.append(card);}
  }catch{if(alive()&&n===slotSeq)slotStatus.textContent='Impossible de vérifier les créneaux. Actualise et réessaie.';}
  finally{if(alive())find.disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(!alive()||!selectedSlot||!familyRows.some(f=>f.id===familySelect.value)||!service.value)return;
  const slot=selectedSlot;requestId=requestId||crypto.randomUUID();const args={p_service:service.value,p_family:familySelect.value,p_rule:slot.rule_id,p_start:slot.starts_at,p_modality:slot.modality,p_request:requestId};
  if(!confirm('Confirmer ce rendez-vous le '+labelDay(date.value)+' à '+hour(slot.starts_at)+' ? Aucun email ne sera envoyé.'))return;
  d.mutate(async()=>{const r=await d.client.rpc('naitea_create_manual_appointment',args);if(r.error?.code==='23P01')return {...r,appointmentConflict:true};return {...r,appointmentDay:date.value};},'Rendez-vous enregistré.',formStatus);
 });
 async function loadAgenda(){
  const n=++agendaSeq;weekLabel.textContent=labelDay(week)+' – '+labelDay(plusDay(week,6));weekGrid.replaceChildren();agendaStatus.textContent='Chargement de l’agenda…';
  try{const r=await d.client.rpc('naitea_my_agenda',{p_day:week,p_days:7});if(!alive()||n!==agendaSeq)return;const data=r.data;if(r.error||!data||!['workshops','appointments','absences'].every(k=>Array.isArray(data[k])))throw Error();
   agendaStatus.textContent='';for(let i=0;i<7;i++){const day=plusDay(week,i),col=node('section','v8-cal-day naitea-appointment-day'+(day===dayOf()?' today':''));col.append(text('h3',labelDay(day)));
    const absent=data.absences.some(a=>a.closed_date<=day&&a.end_date>=day);if(absent)col.append(text('p','Indisponible'));
    const items=[...data.workshops.filter(a=>dayOf(a.starts_at)===day).map(a=>({...a,kind:'workshop'})),...data.appointments.filter(a=>dayOf(a.starts_at)===day).map(a=>({...a,kind:'appointment'}))].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
    if(!items.length&&!absent)col.append(text('p','Aucun rendez-vous ni atelier'));
    for(const a of items){const card=node('article','naitea-appointment-item '+a.kind+(a.status==='cancelled'?' is-cancelled':''));card.append(text('strong',hour(a.starts_at)+(a.ends_at?' – '+hour(a.ends_at):'')),text('b',a.title));if(a.kind==='workshop')card.append(text('p','Atelier · '+(a.status==='draft'?'Brouillon':a.status==='cancelled'?'Annulé':'Publié')+(a.duration_label?' · '+a.duration_label:'')));
     else{card.append(text('p',a.family_name||'Famille'),text('p',optionLabel(a)),text('p',a.status==='cancelled'?'Annulé':a.status==='pending'?'Paiement en attente · créneau temporairement réservé':'Confirmé · '+money(a.price_cents)));
      if(['yes','no','unsure'].includes(a.coparent_present))card.append(text('p','Coparent présent : '+({yes:'Oui',no:'Non',unsure:'Je ne sais pas'}[a.coparent_present])));
      if(a.payment_status==='paid')card.append(text('p',(a.balance_due_cents>0?'Acompte payé (test) : ':'Payé en ligne (test) : ')+money(a.amount_paid_cents)+(a.balance_due_cents>0?' · Reste sur place : '+money(a.balance_due_cents):'')));
      if(a.status==='confirmed'&&a.booking_source==='online')card.append(text('p','Réservation en ligne · '+({accepted:'Email pris en charge',failed:'Envoi non confirmé',pending:'Statut d’envoi inconnu'}[a.confirmation_email_status]||'Email non confirmé')));
      if(a.status==='confirmed'&&a.payment_status!=='paid'&&Date.parse(a.starts_at)>Date.now()){const cancelStatus=status();card.append(button('Annuler',()=>{if(confirm('Annuler ce rendez-vous ? Le créneau sera libéré, aucun email ne sera envoyé.'))d.mutate(async()=>({...await d.client.rpc('naitea_cancel_manual_appointment',{p_id:a.id}),appointmentDay:day}),'Rendez-vous annulé.',cancelStatus);}),cancelStatus);}}
     col.append(card);}
    const add=button('+ RDV',()=>{date.value=day;selectionChanged();form.scrollIntoView({block:'start',behavior:'smooth'});});add.disabled=day<date.min||day>date.max||absent;col.append(add);weekGrid.append(col);
   }
  }catch{if(alive()&&n===agendaSeq)agendaStatus.textContent='Agenda indisponible. Réessaie en actualisant.';}
 }
 // mount() is called before the section is connected.
 queueMicrotask(()=>{if(alive())loadAgenda();});
 return section;
}
const api={mount,dayOf,plusDay,monday,optionLabel};if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaAppointments=api;
})(globalThis);
