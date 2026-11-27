/* Owner-scoped family CRM. Never use the demonstration store, browser storage or marketing tools. */
(function(root){
'use strict';
const FIELDS='id,professional_id,email,first_name,last_name,phone,coparent,children,notes,newsletter_requested_at,newsletter_opt_out,created_at,updated_at';
const normal=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
const name=f=>[f.first_name,f.last_name].filter(Boolean).join(' ')||'Famille';
const preference=f=>f.newsletter_opt_out?'Désinscription enregistrée':f.newsletter_requested_at?'Accord déclaré (à vérifier)':'Aucun accord enregistré';
function phoneValue(raw){
 const value=String(raw||'').replace(/[\s().-]/g,'');
 if(!value)return null;
 const result=value.startsWith('00')?'+'+value.slice(2):/^0[1-9]\d{8}$/.test(value)?'+33'+value.slice(1):value;
 if(!/^\+[1-9]\d{7,14}$/.test(result))throw Error('Vérifie le téléphone (format international ou numéro français).');
 return result;
}
function csvCell(value){let v=String(value??'');if(/^[\s\u0000-\u001f]*[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
function contactsCsv(rows){return '\ufeff'+[['Prénom','Nom','Email','Téléphone','Préférence newsletter','Créée le'],...rows.map(f=>[f.first_name,f.last_name,f.email,f.phone,preference(f),f.created_at?.slice(0,10)])].map(r=>r.map(csvCell).join(';')).join('\r\n');}
const localDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function periodBounds(kind,from='',to='',now=new Date()){
 const d=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 const next=x=>{const v=new Date(x);v.setDate(v.getDate()+1);return v;};
 if(kind==='week'){const start=new Date(d);start.setDate(d.getDate()-(d.getDay()+6)%7);const end=new Date(start);end.setDate(end.getDate()+7);return [localDay(start),localDay(end)];}
 if(kind==='month')return [localDay(new Date(d.getFullYear(),d.getMonth(),1,12)),localDay(new Date(d.getFullYear(),d.getMonth()+1,1,12))];
 if(kind==='year')return [localDay(new Date(d.getFullYear(),0,1,12)),localDay(next(d))];
 const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const t=new Date(s+'T12:00:00');return Number.isFinite(t.getTime())&&localDay(t)===s?t:null;};
 const a=parse(from),b=parse(to);if(!a||!b||a>b||(b-a)/86400000>3658)throw Error('Choisis une période valide (10 ans maximum).');
 return [from,localDay(next(b))];
}
function create(d){
 let enabled=false,checked=false,client=null,owner=null,serial=0,loading=false,loaded=false,active=false,rows=[],count=0,month=0,bookings=0,query='',filter='all',selected=null,notice='',observer=false,workshops=[],history=[],historyLoading=false,historyError=false,historyCount=0,editing=false,saving=false;
 let waiting=0,cancelled=0,amount=null,period='month',dateFrom='',dateTo='',metricSeq=0,metricError='',metricLoading=false,importPanel=null;
 const text=(tag,v)=>{const n=document.createElement(tag);n.textContent=v;return n;};
 const node=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const button=(label,fn,primary=false)=>{const b=text('button',label);b.type='button';b.className=primary?'btn':'btn secondary';b.addEventListener('click',fn);return b;};
 const rootNode=()=>document.getElementById('app');
 const isPage=()=>d.isPage();
 const safe=(v,uid)=>v===serial&&uid===owner&&active&&isPage();
 function clear(){serial++;metricSeq++;importPanel?.dispose();importPanel=null;waiting=cancelled=0;amount=null;period='month';dateFrom=dateTo=metricError='';metricLoading=false;owner=null;rows=[];workshops=[];count=month=bookings=historyCount=0;history=[];selected=null;loaded=loading=editing=saving=historyLoading=historyError=false;query='';filter='all';notice='';}
 function leave(){if(active){active=false;clear();}document.body.classList.remove('naitea-family-workspace');}
 function date(v){return v?new Date(v).toLocaleDateString('fr-FR'):'—';}
 function filtered(){return rows.filter(f=>(filter==='all'||filter==='declared'&&!f.newsletter_opt_out&&f.newsletter_requested_at||filter==='optout'&&f.newsletter_opt_out||filter==='none'&&!f.newsletter_opt_out&&!f.newsletter_requested_at)&&normal([name(f),f.email,f.phone].join(' ')).includes(normal(query)));}
 async function connect(){
   let next=d.getClient();if(!next){notice='Connexion en cours…';paint();return false;}
   if(client!==next){client=next;observer=false;}
   if(!observer){observer=true;client.auth.onAuthStateChange((event,session)=>{
     if(!active||!isPage())return;
     if(owner&&session?.user?.id===owner&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;
     clear();paint();setTimeout(load,0);
   });}
   return true;
 }
 async function load(){
   if(!enabled||!active||!isPage()||loading)return;
   loading=true;loaded=false;selected=null;editing=false;history=[];importPanel?.dispose();importPanel=null;metricSeq++;metricLoading=false;metricError='';notice='Chargement de tes familles…';paint();
   const v=++serial;
   try{
     if(!await connect()){if(v===serial){loading=false;setTimeout(()=>{if(v===serial&&active&&isPage()&&!loaded&&d.getClient())load();},500);}return;}
     const auth=await client.auth.getUser();if(v!==serial||!active||!isPage())return;
     if(auth.error||!auth.data?.user||auth.data.user.is_anonymous){notice='Connecte-toi pour accéder à ton fichier familles.';owner=null;return;}
     owner=auth.data.user.id;const uid=owner;
     const start=new Date();start.setDate(1);start.setHours(0,0,0,0);
     try{metricArgs();}catch{period='month';dateFrom=dateTo='';}
     const [list,recent,indicators,events]=await Promise.all([
       client.from('naitea_families').select(FIELDS,{count:'exact'}).eq('professional_id',uid).order('last_name',{ascending:true,nullsFirst:false}).order('first_name').order('id').limit(500),
       client.from('naitea_families').select('id',{count:'exact',head:true}).eq('professional_id',uid).gte('created_at',start.toISOString()),
       client.rpc('naitea_crm_indicators',metricArgs()),
       client.from('naitea_workshops').select('id,title,starts_at,status').eq('professional_id',uid).eq('status','published').gt('starts_at',new Date().toISOString()).order('starts_at').limit(100)
     ]);
     if(!safe(v,uid))return;
     if(list.error||recent.error||indicators.error||events.error||!Array.isArray(list.data)||!Array.isArray(events.data)||list.data.some(f=>f.professional_id!==uid))throw Error();
     rows=list.data;count=list.count??rows.length;month=recent.count??0;applyIndicators(indicators.data);workshops=events.data;loaded=true;notice=count>rows.length?'500 premières fiches affichées. La recherche et l’export portent sur ces fiches.':'';
   }catch{if(v===serial){rows=[];loaded=false;notice='Impossible de charger tes familles. Actualise pour réessayer.';}}
   finally{if(v===serial){loading=false;paint();}}
 }
 async function detail(f){
   if(!loaded||!owner||saving)return;
   selected=f;editing=false;history=[];historyCount=0;historyLoading=true;historyError=false;paint();
   const v=++serial,uid=owner;
   try{
     const r=await client.from('naitea_bookings').select('id,status,seats,confirmed_at,cancelled_at,cancellation_reason,workshop_id,naitea_workshops(title,starts_at,status)',{count:'exact'}).eq('family_id',f.id).order('confirmed_at',{ascending:false}).limit(200);
     if(!safe(v,uid)||selected?.id!==f.id)return;
     if(r.error||!Array.isArray(r.data))throw Error();history=r.data;historyCount=r.count??history.length;
   }catch{if(safe(v,uid))historyError=true;}
   finally{if(safe(v,uid)){historyLoading=false;paint();}}
 }
 function listBody(host){
   host.replaceChildren();const list=filtered();
   host.append(text('p',list.length+' fiche(s) affichée(s)'));
   if(!list.length){host.append(text('p',rows.length?'Aucune famille ne correspond à cette recherche.':'Ton fichier familles est vide. Ajoute une famille ou confirme une inscription.'));return;}
   for(const f of list){
     const card=node('article','naitea-family-row');const avatar=text('span',([f.first_name,f.last_name].filter(Boolean).map(x=>x[0]).join('').toUpperCase()||'F').slice(0,2));avatar.className='naitea-family-avatar';
     const info=node('div','naitea-family-info');info.append(text('strong',name(f)),text('p',f.email),text('p',f.phone||'Téléphone non renseigné'));
     const status=text('span',preference(f));status.className='naitea-family-tag';info.append(status);
     card.append(avatar,info,button('Voir la fiche',()=>detail(f)));host.append(card);
   }
 }
 function exportRows(){
   if(!loaded||!owner||!active||!isPage())return;
   const list=filtered();if(!list.length)return;
   const url=URL.createObjectURL(new Blob([contactsCsv(list)],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='naitea-familles.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function input(label,key,value,type='text',max=120,required=false){
   const wrap=node('label','field');wrap.append(text('span',label+(required?' *':'')));
   const field=node(type==='textarea'?'textarea':'input');if(type!=='textarea')field.type=type;else field.rows=3;
   field.name=key;field.maxLength=max;field.required=required;field.value=value||'';wrap.append(field);return wrap;
 }
 function editPanel(panel,f){
   panel.append(text('h2',f?'Modifier la fiche famille':'Ajouter une famille'));
   const form=node('form','naitea-family-form');const grid=node('div','naitea-family-fields');
   grid.append(input('Prénom','first_name',f?.first_name,'text',120,!f),input('Nom','last_name',f?.last_name,'text',120,!f),input('Email','email',f?.email,'email',254,true),input('Téléphone','phone',f?.phone,'tel',30),input('Co-parent','coparent',f?.coparent,'text',200),input('Enfant(s) — prénoms, informations utiles','children',f?.children,'textarea',1000));
   form.append(grid,input('Notes privées (organisation uniquement)','notes',f?.notes,'textarea',2000),text('p','Ne renseigne aucune donnée de santé ou autre information sensible. En bêta, utilise uniquement des coordonnées fictives ou contact@naitea.fr.'));
   const opt=node('label','checkline'),check=node('input');check.type='checkbox';check.name='optout';check.checked=!!f?.newsletter_opt_out;check.disabled=!!f?.newsletter_opt_out;opt.append(check,document.createTextNode(' Ne pas envoyer de newsletter / retrait de l’accord'));form.append(opt,text('p','Un accord de newsletter ne peut pas être ajouté manuellement. Les déclarations issues des inscriptions restent à vérifier.'));
   const status=text('p','');status.setAttribute('role','status');const save=text('button','Enregistrer la fiche');save.type='submit';save.className='btn';
   const back=button('Retour',()=>{if(!saving){editing=false;paint();}});
   const actions=node('div','naitea-family-actions');actions.append(back,save);form.append(status,actions);panel.append(form);
   form.addEventListener('submit',async e=>{
     e.preventDefault();e.stopImmediatePropagation();if(saving||!active||!owner||!isPage())return;
     const uid=owner,v=++serial,fd=new FormData(form);
     const clean=k=>String(fd.get(k)||'').trim().replace(/[\r\n\t]+/g,' ')||null;
     let payload;
     try{
       const email=String(fd.get('email')||'').trim().toLowerCase();
       if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254)throw Error('Vérifie l’adresse email.');
       if(email!==f?.email&&email!=='contact@naitea.fr'&&!email.endsWith('@example.invalid'))throw Error('En bêta, utilise contact@naitea.fr ou une adresse @example.invalid.');
       const first_name=clean('first_name'),last_name=clean('last_name');if(!first_name&&!last_name)throw Error('Renseigne au moins un prénom ou un nom.');
       payload={email,first_name,last_name,phone:phoneValue(fd.get('phone')),coparent:clean('coparent'),children:clean('children'),notes:clean('notes'),newsletter_opt_out:!!f?.newsletter_opt_out||check.checked};
     }catch(err){status.textContent=err.message;return;}
     saving=true;for(const el of form.elements)el.disabled=true;status.textContent='Enregistrement…';
     try{
       const auth=await client.auth.getUser();if(!safe(v,uid))return;if(auth.error||auth.data?.user?.id!==uid)throw Error('Reconnecte-toi.');
       const result=f?await client.from('naitea_families').update(payload).eq('id',f.id).eq('professional_id',uid).select(FIELDS).single():await client.from('naitea_families').insert({...payload,professional_id:uid}).select(FIELDS).single();
       if(!safe(v,uid))return;
       if(result.error?.code==='23505'){status.textContent='Une fiche utilise déjà cette adresse email. Recherche la famille existante.';return;}
       if(result.error||result.data?.professional_id!==uid)throw Error('Enregistrement non confirmé. Actualise avant de réessayer.');
       saving=false;editing=false;selected=null;await load();
       if(active&&owner===uid&&loaded){notice='Fiche enregistrée.';paint();await detail(result.data);}
     }catch(err){if(safe(v,uid))status.textContent=err.message||'Enregistrement non confirmé.';}
     finally{if(safe(v,uid)){saving=false;for(const el of form.elements)el.disabled=false;check.disabled=!!f?.newsletter_opt_out;}}
   });
 }
 function detailPanel(panel,f){
   const actions=node('div','naitea-family-actions');actions.append(button('← Mes familles',()=>{serial++;selected=null;history=[];historyLoading=false;paint();}),button('Modifier la fiche',()=>{serial++;editing=true;historyLoading=false;paint();},true));panel.append(actions,text('h2',name(f)));
   const cards=node('div','naitea-family-fields');
   for(const [label,value] of [['Email',f.email],['Téléphone',f.phone],['Co-parent',f.coparent],['Enfant(s)',f.children],['Newsletter',preference(f)],['Date de création',date(f.created_at)]]){
     const c=node('div','naitea-family-detail');c.append(text('span',label),text('strong',value||'Non renseigné'));cards.append(c);
   }
   panel.append(cards,text('h3','Notes privées'),text('p',f.notes||'Aucune note.'));
   const booking=node('section','naitea-family-detail');booking.append(text('h3','Inscrire à un atelier'));
   if(workshops.length){
     const select=node('select');select.setAttribute('aria-label','Choisir un atelier');
     for(const w of workshops){const option=text('option',w.title+' · '+new Date(w.starts_at).toLocaleString('fr-FR'));option.value=w.id;select.append(option);}
     const info=text('p','');info.setAttribute('role','status');booking.append(select,button('Préparer l’inscription',()=>{if(!d.openBooking(f,select.value))info.textContent='Atelier indisponible ou liste non chargée. Actualise les ateliers.';},true),info);
   }else booking.append(text('p','Aucun atelier publié à venir.'));
   panel.append(booking,text('h3','Historique des inscriptions'));
   if(historyLoading)panel.append(text('p','Chargement…'));
   else if(historyError)panel.append(text('p','Historique indisponible.'),button('Réessayer',()=>detail(f)));
   else if(!history.length)panel.append(text('p','Aucune inscription enregistrée.'));
   else{
     for(const b of history){
       const c=node('div','naitea-family-history');const w=b.naitea_workshops;
       c.append(text('strong',w?.title||'Atelier'),text('p',date(w?.starts_at)+' · '+b.seats+' place(s) · '+(b.status==='cancelled'?'Annulée':'Confirmée')));
       if(b.status==='cancelled')c.append(text('p','Motif : '+(b.cancellation_reason||'Non renseigné')));
       panel.append(c);
     }
     if(historyCount>history.length)panel.append(text('p','200 inscriptions les plus récentes affichées.'));
   }
   panel.append(text('p','Les anciennes réservations conservent leurs coordonnées d’origine. Les rendez-vous, paiements et factures seront reliés dans les prochaines étapes.'));
 }
 function metricArgs(){
   const [from,until]=periodBounds(period,dateFrom,dateTo);
   return {p_from:from,p_until:until,p_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Paris'};
 }
 function applyIndicators(data){
   if(!data||!['confirmed','waiting','cancelled','amount_cents'].every(k=>Number.isFinite(Number(data[k]))&&Number(data[k])>=0))throw Error('Indicateurs indisponibles.');
   bookings=Number(data.confirmed);waiting=Number(data.waiting);cancelled=Number(data.cancelled);amount=Number(data.amount_cents);
 }
 async function refreshMetrics(){
   if(!loaded||!owner||!active||!isPage())return;
   const uid=owner,v=serial,request=++metricSeq;amount=null;metricLoading=true;metricError='';
   try{
     const args=metricArgs();paint();
     const r=await client.rpc('naitea_crm_indicators',args);
     if(!safe(v,uid)||request!==metricSeq)return;
     if(r.error)throw Error('Montant indisponible. Réessaie.');
     applyIndicators(r.data);
   }catch(e){if(safe(v,uid)&&request===metricSeq)metricError=e.message||'Indicateurs indisponibles.';}
   finally{if(safe(v,uid)&&request===metricSeq){metricLoading=false;if(!selected&&!editing&&!importPanel)paint();}}
 }
 function revenueCard(){
   const card=node('section','naitea-family-detail naitea-family-revenue');
   card.append(text('h2','Chiffre d’affaires estimé'),text('p','Montant des inscriptions confirmées, non encaissé vérifié.'));
   const value=text('strong',metricLoading?'Calcul en cours…':amount===null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(amount/100));value.className='naitea-revenue-value';card.append(value);
   const controls=node('div','naitea-family-revenue-controls'),select=node('select');select.setAttribute('aria-label','Période du chiffre d’affaires');
   for(const [v,l] of [['week','Cette semaine'],['month','Ce mois-ci'],['custom','Période personnalisée'],['year','CA cumulé '+new Date().getFullYear()]]){const opt=text('option',l);opt.value=v;select.append(opt);}select.value=period;
   select.addEventListener('change',()=>{period=select.value;if(period==='custom'&&(!dateFrom||!dateTo)){const d=new Date();dateFrom=localDay(new Date(d.getFullYear(),d.getMonth(),1,12));dateTo=localDay(d);}refreshMetrics();});
   controls.append(select);
   if(period==='custom'){
     const field=(label,value,change)=>{const wrap=node('label','field');wrap.append(text('span',label));const input=node('input');input.type='date';input.value=value;input.addEventListener('change',()=>change(input.value));wrap.append(input);return wrap;};
     controls.append(field('Du',dateFrom,v=>dateFrom=v),field('Au (inclus)',dateTo,v=>dateTo=v),button('Appliquer',refreshMetrics));
   }
   card.append(controls);
   if(metricError){const p=text('p',metricError);p.setAttribute('role','status');card.append(p);}
   card.append(text('p','Calcul selon la date de l’atelier et le tarif × les places confirmées. Les réservations en attente ou annulées sont exclues. Les ateliers futurs compris dans la période sont inclus ; le cumul annuel s’arrête aujourd’hui.'));
   return card;
 }
 function beginImport(){
   if(!loaded||!owner||!active||!isPage()||importPanel)return;
   const v=serial,uid=owner;
   importPanel=root.NaiteaFamilyImport.create({
     isCurrent:()=>safe(v,uid),
     phoneValue,
     existing:async emails=>{const r=await client.rpc('naitea_crm_existing_emails',{p_emails:emails});if(!safe(v,uid)||r.error||!Array.isArray(r.data))throw Error('Vérification des doublons indisponible.');return r.data;},
     commit:async contacts=>{const auth=await client.auth.getUser();if(!safe(v,uid)||auth.error||auth.data?.user?.id!==uid)throw Error('Reconnecte-toi avant l’import.');const r=await client.rpc('naitea_crm_import_contacts',{p_contacts:contacts});if(!safe(v,uid)||r.error||!r.data)throw Error('Import non confirmé. Actualise tes contacts avant de recommencer.');return r.data;},
     close:()=>{if(importPanel){importPanel.dispose();importPanel=null;paint();}},
     done:async result=>{if(!safe(v,uid))return;importPanel?.dispose();importPanel=null;await load();if(owner===uid&&loaded&&active){notice=result.inserted+' fiche(s) importée(s), '+result.skipped+' doublon(s) ignoré(s) lors de l’enregistrement.';paint();}}
   });paint();
 }
 function paint(){
   if(!active||!isPage())return;const app=rootNode();if(!app)return;
   const panel=node('section','card naitea-crm');panel.id='naiteaPrivateFamilies';app.replaceChildren(panel);
   const top=node('div','naitea-family-heading');const pictogram=node('img');pictogram.src='/assets/berceau/pictogrammes/espace-pro/suivi-des-familles.webp';pictogram.alt='';pictogram.width=80;pictogram.height=80;top.append(pictogram,text('h1','Mes familles'));panel.append(top);
   if(!checked){panel.append(text('p','Vérification de la connexion…'));return;}
   if(!enabled){panel.append(text('p','Le fichier familles réel est indisponible dans cet environnement.'));return;}
   if(notice){const p=text('p',notice);p.setAttribute('role','status');panel.append(p);}
   if(!loaded){if(!loading){panel.append(button('Actualiser',load));const a=text('a','Me connecter');a.href='/connexion.html';a.className='btn secondary';panel.append(a);}return;}
   if(importPanel){panel.append(importPanel.element);return;}
   if(editing){editPanel(panel,selected);return;}
   if(selected){detailPanel(panel,selected);return;}
   panel.append(text('p','Tes contacts et leur historique, au même endroit.'));
   const metrics=node('div','naitea-family-metrics');
   for(const [label,value] of [['Familles',count],['Nouvelles familles ce mois-ci',month],['Inscriptions confirmées',bookings],['Inscriptions en attente',waiting],['Inscriptions annulées',cancelled]]){const c=node('div','naitea-family-detail');c.append(text('span',label),text('strong',String(value)));metrics.append(c);}panel.append(metrics,revenueCard());
   const toolbar=node('div','naitea-family-actions');toolbar.append(button('+ Ajouter une famille',()=>{selected=null;editing=true;paint();},true),button('Importer un fichier clients',beginImport),button('Exporter les contacts (CSV)',exportRows),button('Actualiser',load));panel.append(toolbar);
   const controls=node('div','naitea-family-fields'),search=node('input');search.type='search';search.placeholder='Nom, email, téléphone…';search.setAttribute('aria-label','Rechercher une famille');search.value=query;
   const select=node('select');select.setAttribute('aria-label','Filtrer les préférences newsletter');for(const [v,l] of [['all','Toutes les familles'],['declared','Accord déclaré'],['optout','Désinscrites'],['none','Aucun accord']]){const opt=text('option',l);opt.value=v;select.append(opt);}select.value=filter;controls.append(search,select);panel.append(controls);
   const list=node('div','naitea-family-list');panel.append(list);listBody(list);search.addEventListener('input',()=>{query=search.value;listBody(list);});select.addEventListener('change',()=>{filter=select.value;listBody(list);});
   panel.append(text('p','Export limité aux coordonnées et préférences affichées, sans notes ni données sur les enfants. Aucun email marketing envoyé.'));
 }
 function decorate(){if(!isPage()){leave();return;}document.body.classList.add('naitea-family-workspace');if(!active){active=true;paint();if(enabled)load();}else paint();}
 async function start(){
   try{const r=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});const flags=r.ok?await r.json():{};enabled=flags.realBookings===true;}catch{}finally{checked=true;if(isPage()){active=true;paint();if(enabled){let attempts=0;const timer=setInterval(()=>{if(!isPage()||!active){clearInterval(timer);return;}if(d.getClient()){clearInterval(timer);if(!loading&&!loaded)load();}else if(++attempts>100){clearInterval(timer);notice='Connexion indisponible. Actualise la page.';paint();}},100);}}}
 }
 window.addEventListener('pagehide',()=>{leave();if(isPage()){active=true;paint();}});window.addEventListener('pageshow',e=>{if(e.persisted&&isPage()&&enabled){active=true;load();}});
 return {start,decorate};
}
const api={create,phoneValue,contactsCsv,normal,preference,periodBounds};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaProFamilies=api;
})(globalThis);
