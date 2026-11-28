/* Private beta: individual services and weekly availability. No public booking yet. */
(function(root){
'use strict';
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const MODES={practice:'En cabinet',home:'À domicile',video:'En visio',phone:'Par téléphone'};
const COVER_BUCKET='naitea-service-covers';
const modesOf=s=>Array.isArray(s?.modalities)&&s.modalities.length?s.modalities:[s?.modality||'practice'];
const STATES={draft:'Brouillon',active:'Active',archived:'Archivée'};
const money=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n/100);
const minutes=s=>{if(!/^\d{2}:\d{2}$/.test(s))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;};
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
function priceCents(s){s=String(s).trim().replace(',','.');if(!/^\d{1,6}(?:\.\d{1,2})?$/.test(s))throw Error('Indique un tarif valide en euros.');const n=Math.round(Number(s)*100);if(n>10000000)throw Error('Tarif trop élevé.');return n;}
function parisDay(){const p=Object.fromEntries(new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(v=>[v.type,v.value]));return p.year+'-'+p.month+'-'+p.day;}
function locationDefault(s,mode){const d=s?.modality_details||{};return mode==='practice'?d.office?.address||'':mode==='home'?d.home?.zone||'':mode==='video'?d.video?.other||d.video?.platform||'':mode==='phone'?'':'';}
function optionsOf(r){return Array.isArray(r?.options)&&r.options.length?r.options:[{modality:r.modality,location_label:r.location_label,location_details:r.location_details}];}
function optionKey(o){return JSON.stringify([o.modality,o.location_label||'',o.location_details||'']);}
function groupLocations(rows){const groups=new Map();for(const r of rows)for(const o of optionsOf(r)){const key=optionKey(o);if(!groups.has(key))groups.set(key,{modality:o.modality,label:o.location_label||'',details:o.location_details||'',rows:[]});groups.get(key).rows.push(r);}return [...groups.values()];}
const VIDEO_TOOLS=['Google Meet','Zoom'];
const SERVICE_AUDIENCES=['Futurs parents','Femmes enceintes','Jeunes parents','Mamans','Papás et coparents','Bébés','Tout-petits','Enfants','Familles','Professionnels'].map(v=>v.replace('Papás','Papas'));
function audienceOptions(value){const saved=String(value||'').split(' · ').map(v=>v.trim()).filter(Boolean);return [...new Set([...SERVICE_AUDIENCES,...saved])];}
function visibleServices(services,status='active'){return services.filter(s=>s.status===status);}
function absenceLabel(r){const format=s=>s.split('-').reverse().join('/');return r.closed_date===(r.end_date||r.closed_date)?format(r.closed_date):'Du '+format(r.closed_date)+' au '+format(r.end_date);}
function create(d){
 let client=null,owner=null,enabled=false,checked=false,active=false,view='',generation=0,loading=false,loaded=false,busy=false,notice='',failed=false,services=[],rules=[],closed=[],edit=null,chosen='',ruleEdit=null,allPlanning=false,parentPreview=false,offerFilter='active',detailId=null,agendaDay=null;
 const node=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
 const text=(tag,v)=>{const e=node(tag);e.textContent=v;return e;};
 const button=(label,fn,primary=false)=>{const b=text('button',label);b.type='button';b.className=primary?'btn':'btn secondary';b.addEventListener('click',fn);return b;};
 const current=()=>d.isPage()&&active&&d.page()===view;
 const safe=(v,uid)=>current()&&generation===v&&owner===uid;
 let subscription=null;const coverUrls=new Map();let localPreview='';
 function resetImages(){for(const u of coverUrls.values())URL.revokeObjectURL(u);coverUrls.clear();if(localPreview)URL.revokeObjectURL(localPreview);localPreview='';}
 function attachImage(s,img,accept=()=>true){if(!s||!owner)return;const v=generation,uid=owner;const cached=coverUrls.get(s.id);if(cached){if(accept()){img.src=cached;img.hidden=false;}return;}client.storage.from(COVER_BUCKET).download(root.NaiteaProWorkshops.coverPath(uid,s.id)).then(({data,error})=>{if(error||!data||data.type!=='image/jpeg'||data.size>2097152||!safe(v,uid)||!img.isConnected||!accept())return;const u=coverUrls.get(s.id)||URL.createObjectURL(data);coverUrls.set(s.id,u);img.src=u;img.hidden=false;}).catch(()=>{});}
 function clear(){generation++;resetImages();owner=null;loaded=loading=busy=failed=false;services=[];rules=[];closed=[];edit=null;chosen='';ruleEdit=null;allPlanning=false;parentPreview=false;offerFilter='active';detailId=null;agendaDay=null;notice='';}
 function leave(){if(active){active=false;clear();}document.body.classList.remove('naitea-service-workspace');}
 function connect(){const next=d.getClient();if(!next)return false;if(next!==client){subscription?.unsubscribe();client=next;subscription=null;}if(!subscription){const r=client.auth.onAuthStateChange((event,session)=>{if(!active||!current()||event==='INITIAL_SESSION')return;if(owner&&session?.user?.id===owner&&['TOKEN_REFRESHED','SIGNED_IN','USER_UPDATED'].includes(event))return;clear();paint();setTimeout(load,0);});subscription=r.data.subscription;}return true;}
 async function load(){
  if(!current()||!enabled||loading||busy)return;
  loading=true;loaded=false;failed=false;resetImages();notice='Chargement…';paint();const v=++generation;
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
   if(result.error){const code=result.error.code;throw Error(result.appointmentConflict?'Ce créneau vient d’être occupé. Clique sur Voir les créneaux disponibles pour actualiser.':code==='23P01'?'Cette plage chevauche une disponibilité existante.':code==='23505'?'Cette plage ou date existe déjà.':code==='23514'?'Vérifie les horaires et la durée de la séance.':'Enregistrement non confirmé. Actualise avant de réessayer.');}
   if(!result.data||Array.isArray(result.data)&&result.data.length!==1)throw Error('Modification non confirmée. Actualise la page.');
   edit=null;ruleEdit=null;detailId=null;if(result.nextFilter)offerFilter=result.nextFilter;if(result.appointmentDay)agendaDay=result.appointmentDay;busy=false;await load();if(current()&&owner===uid&&loaded){notice=success+(result.coverWarning?' '+result.coverWarning:'');paint();}
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
  const details=s?.modality_details||{},modes=modesOf(s),offer={id:s?.id||'',title:s?.title||'',price:(s?.price_cents||0)/100,duration:String(s?.duration_minutes||60),location:s?.location||'',audience:s?.audience||'',description:s?.description||'',extra:s?.extra||'',modalities:modes.map(k=>MODES[k]),modalityDetails:details};
  const shell=node('div');shell.innerHTML=d.formHtml(offer);const form=shell.querySelector('form');if(!form)throw Error('Formulaire Codex indisponible.');
  form.id='naiteaPrivateServiceForm';form.classList.add('naitea-service-form');
  form.querySelectorAll('[data-v6],[data-action]').forEach(e=>e.remove());
  form.elements.offerId?.remove();form.elements.location?.closest('.field')?.remove();
  const duration=form.elements.duration;duration.type='number';duration.min='15';duration.max='480';duration.step='5';duration.required=true;duration.closest('.field').querySelector('label').textContent='Durée (minutes)';
  form.elements.price.step='0.01';form.elements.price.max='100000';form.elements.price.required=true;form.elements.price.closest('.field').querySelector('label').textContent='Tarif (€) · 0 si gratuit';
  form.elements.title.maxLength=120;form.elements.audience.maxLength=300;form.elements.extra.maxLength=2000;form.elements.description.maxLength=3000;
  const audienceInput=form.elements.audience, audienceField=audienceInput.closest('.field');
  const savedAudiences=String(s?.audience||'').split(' · ').map(v=>v.trim()).filter(Boolean);
  const audienceGroup=node('fieldset','naitea-service-audience');audienceGroup.append(text('legend','Public concerné'),text('p','Coche un ou plusieurs publics.'));
  audienceInput.type='hidden';audienceInput.hidden=true;audienceField.replaceChildren(audienceInput,audienceGroup);
  for(const item of audienceOptions(s?.audience)){const label=node('label','checkline'),check=node('input');check.type='checkbox';check.name='audience_category';check.value=item;check.checked=savedAudiences.includes(item);label.append(check,document.createTextNode(' '+item));audienceGroup.append(label);}
  const syncAudience=()=>{audienceInput.value=[...audienceGroup.querySelectorAll('input:checked')].map(e=>e.value).join(' · ');};
  audienceGroup.addEventListener('change',syncAudience);syncAudience();
  form.elements.offerPhone.value=details.phone?.number||'';
  const footer=form.querySelector('.modalfooter');const more=node('div','naitea-family-fields');
  more.append(field('Pause entre deux séances (minutes)','buffer','number',s?.buffer_minutes??15,{required:true,min:0,max:120,step:5}),selectField('Statut','status',Object.entries(STATES).filter(([k])=>k!=='archived'||s?.status==='archived'),s?.status??'draft'));footer.before(more);
  const seo=field('Ville de référence pour le lien de réservation','booking_city','text',s?.booking_city||'',{maxlength:100,placeholder:'Ex. Lille'});footer.before(seo,text('p','Le lien reprend le nom de ton accompagnement et cette ville. Une fois créé, il reste stable pour préserver tes partages. Pour une prestation à distance, renseigne ta ville de référence.'));
  const instructions=field('Informations utiles à communiquer aux familles','booking_instructions','textarea',s?.booking_instructions||'',{maxlength:2000,placeholder:'Ex. Prévoir une tenue confortable pour bébé, apporter une serviette…'});footer.before(instructions,text('p','Ces consignes seront ajoutées à l’email de confirmation du rendez-vous. Ne renseigne aucune donnée personnelle.'));
  const video=form.querySelector('[data-modality-panel="En visio"]');const videoSelect=form.elements.videoPlatform,oldTool=details.video?.platform;
  videoSelect.replaceChildren();for(const v of VIDEO_TOOLS){const o=text('option',v);o.value=v;videoSelect.append(o);}if(oldTool&&!VIDEO_TOOLS.includes(oldTool)){const o=text('option',oldTool+' (ancien choix)');o.value=oldTool;videoSelect.append(o);}videoSelect.value=oldTool||'Google Meet';
  video.append(text('p','Google Meet et Zoom : génération automatique prévue lors du raccordement des réservations et de ton compte. Pour l’instant, le lien sera communiqué manuellement.'));
  const sync=()=>{
   const selected=[...form.querySelectorAll('[name="modality"]:checked')].map(e=>e.value);
   for(const p of form.querySelectorAll('[data-modality-panel]')){p.hidden=!selected.includes(p.dataset.modalityPanel);for(const e of p.querySelectorAll('input,textarea,select'))e.disabled=p.hidden;}
   const fees=form.querySelector('.v11-fees-fields');fees.hidden=!selected.includes('À domicile')||!form.elements.travelFees.checked;for(const e of fees.querySelectorAll('input'))e.disabled=fees.hidden;
   const other=form.querySelector('.v11-other-video');other.hidden=!selected.includes('En visio')||form.elements.videoPlatform.value!=='Autre';other.querySelector('input').disabled=other.hidden;other.querySelector('input').required=!other.hidden;
  };
  form.addEventListener('change',sync);sync();
  const aiStatus=statusLine(),draftButton=button('Aide à la rédaction IA',async()=>{
   if(busy||!current()||!form.isConnected)return;
   const title=form.elements.title.value.trim(),audience=form.elements.audience.value.trim();
   if(!title){aiStatus.textContent='Renseigne d’abord le nom de ta prestation.';return;}
   if(!confirm('Envoyer uniquement le titre et le public concerné au service IA ? N’indique aucune donnée personnelle ou de santé.'))return;
   const v=generation,uid=owner,before=form.elements.description.value;draftButton.disabled=true;aiStatus.textContent='Préparation du brouillon…';
   try{
    const {data,error}=await client.auth.getSession();if(error||data?.session?.user?.id!==uid||!safe(v,uid))throw Error('Reconnecte-toi.');
    const r=await fetch('/api/service-description',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({title,audiences:audience?[audience]:[],consent:true})});
    const result=await r.json();if(!safe(v,uid)||!form.isConnected)return;
    if(!r.ok||typeof result.text!=='string')throw Error(result.error||'IA indisponible.');
    if(form.elements.description.value!==before||before.trim()){if(!confirm('Remplacer ta description par cette proposition IA ?')){aiStatus.textContent='Description conservée.';return;}}
    form.elements.description.value=result.text;aiStatus.textContent='Brouillon IA à relire et personnaliser avant enregistrement.';
   }catch(e){if(safe(v,uid)&&form.isConnected)aiStatus.textContent=e.message||'IA indisponible.';}
   finally{if(safe(v,uid)&&form.isConnected)draftButton.disabled=false;}
  });
  form.elements.description.closest('.field').append(draftButton,aiStatus);
  const photoField=form.elements.offerCover.closest('.field');photoField.replaceChildren(text('label','Photo de couverture'));
  const preview=node('img','v6-cover naitea-service-cover');preview.alt='Aperçu de la couverture';preview.hidden=true;
  const file=node('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';
  const removeWrap=node('label','checkline'),remove=node('input');remove.type='checkbox';removeWrap.append(remove,document.createTextNode(' Retirer la photo actuelle'));removeWrap.hidden=!s;
  const photoStatus=statusLine();photoField.append(preview,file,text('p','JPG, PNG ou WebP (12 Mo maximum). Cadrage et compression automatiques, comme les ateliers.'),removeWrap,photoStatus);
  let selectedFile=null,photoBlob=null,preparing=false,selection=0;
  function clearPreview(){if(localPreview)URL.revokeObjectURL(localPreview);localPreview='';preview.hidden=true;preview.removeAttribute('src');}
  file.addEventListener('change',async()=>{
   const n=++selection,v=generation,uid=owner;photoBlob=null;selectedFile=file.files[0]||null;remove.checked=false;clearPreview();
   if(!selectedFile){preparing=false;attachImage(s,preview,()=>!selectedFile&&!remove.checked);return;}
   preparing=true;photoStatus.textContent='Préparation de la photo…';
   try{const blob=await root.NaiteaProWorkshops.compressCover(selectedFile,{zoom:1,x:50,y:50});if(!safe(v,uid)||n!==selection||!form.isConnected)return;photoBlob=blob;localPreview=URL.createObjectURL(blob);preview.src=localPreview;preview.hidden=false;photoStatus.textContent='Photo prête à être enregistrée.';}
   catch(e){if(safe(v,uid)&&n===selection&&form.isConnected){selectedFile=null;file.value='';photoStatus.textContent=e.message;attachImage(s,preview,()=>!selectedFile&&!remove.checked);}}
   finally{if(n===selection)preparing=false;}
  });
  remove.addEventListener('change',()=>{if(remove.checked){selection++;preparing=false;selectedFile=null;photoBlob=null;file.value='';clearPreview();photoStatus.textContent='La photo sera retirée à l’enregistrement.';}else{photoStatus.textContent='';attachImage(s,preview,()=>!selectedFile&&!remove.checked);}});
  attachImage(s,preview,()=>!selectedFile&&!remove.checked);
  const status=statusLine();footer.prepend(button('Retour',()=>{edit=null;if(localPreview)URL.revokeObjectURL(localPreview);localPreview='';paint();}));footer.before(status);panel.append(text('h2',s?'Modifier cet accompagnement':'Nouvel accompagnement'),form);
  form.addEventListener('submit',e=>{
   e.preventDefault();e.stopImmediatePropagation();if(busy)return;
   if(preparing||selectedFile&&!photoBlob){status.textContent='Attends que la photo soit prête ou retire le fichier.';return;}
   const f=new FormData(form);let payload;
   try{
    const title=String(f.get('title')).trim(),duration=Number(f.get('duration')),buffer=Number(f.get('buffer'));
    if(!title||duration<15||duration>480||duration%5||buffer<0||buffer>120||buffer%5)throw Error('Vérifie le titre et la durée.');
    const chosenModes=f.getAll('modality').map(v=>Object.keys(MODES).find(k=>MODES[k]===v));if(!chosenModes.length||chosenModes.some(k=>!k))throw Error('Sélectionne au moins une modalité.');
    const val=k=>String(f.get(k)||'').trim(),detail={};if(val('audience').length>300)throw Error('Sélectionne moins de catégories de public.');
    if(chosenModes.includes('practice')){if(!val('officeAddress'))throw Error('Précise l’adresse du cabinet.');detail.office={address:val('officeAddress')};}
    if(chosenModes.includes('home')){if(!val('homeZone'))throw Error('Précise la zone d’intervention.');const enabled=!!f.get('travelFees'),perKm=enabled?priceCents(val('feePerKm')||'0')/100:0,fixed=enabled?priceCents(val('feeFixed')||'0')/100:0,includedKm=enabled?Number(val('feeIncludedKm')||0):0;if(enabled&&(!perKm&&!fixed||!Number.isInteger(includedKm)||includedKm<0||includedKm>10000))throw Error('Vérifie les frais de déplacement.');detail.home={zone:val('homeZone'),fees:{enabled,perKm,fixed,includedKm}};}
    if(chosenModes.includes('video')){const platform=val('videoPlatform'),other=val('videoOther');if((!VIDEO_TOOLS.includes(platform)&&platform!==details.video?.platform)||platform==='Autre'&&!other)throw Error('Précise l’outil de visio.');detail.video={platform,other:platform==='Autre'?other:'',linkMode:'manual'};}
    if(chosenModes.includes('phone'))detail.phone={number:val('offerPhone')};
    if(s&&rules.some(r=>r.service_id===s.id&&optionsOf(r).some(o=>!chosenModes.includes(o.modality))))throw Error('Modifie ou retire les plages de cette modalité dans Rendez-vous avant de la désactiver.');
    const location=(detail.office?.address||detail.home?.zone||'').replace(/[\r\n\t]+/g,' ').slice(0,250)||null;
    payload={title,description:val('description'),duration_minutes:duration,buffer_minutes:buffer,price_cents:priceCents(f.get('price')),modality:chosenModes[0],modalities:chosenModes,modality_details:detail,location,audience:val('audience'),extra:val('extra'),booking_city:val('booking_city'),booking_instructions:val('booking_instructions'),status:val('status')};
   }catch(err){status.textContent=err.message;return;}
   const photo=photoBlob,removePhoto=remove.checked,v=generation;
   mutate(async uid=>{
    const result=await(s?client.from('naitea_services').update(payload).eq('id',s.id).eq('professional_id',uid).select('id').single():client.from('naitea_services').insert({...payload,professional_id:uid}).select('id').single());
    if(result.error||!result.data?.id||!safe(v,uid))return result;
    if(photo||removePhoto){try{const bucket=client.storage.from(COVER_BUCKET),key=root.NaiteaProWorkshops.coverPath(uid,result.data.id);const r=photo?await bucket.upload(key,photo,{contentType:'image/jpeg',upsert:true,cacheControl:'0'}):await bucket.remove([key]);if(r.error)throw Error();}catch{return {...result,nextFilter:payload.status,coverWarning:'La prestation est enregistrée, mais pas la modification de la photo. Ouvre la fiche pour réessayer.'};}}
    return {...result,nextFilter:payload.status};
   },'Accompagnement enregistré.',status);
  });
 }
 function setServiceStatus(s,state,status){
  const message=state==='archived'?'Archiver cet accompagnement ? Ses informations et disponibilités sont conservées.':'Réactiver cet accompagnement ? Ses disponibilités enregistrées seront conservées.';
  if(!confirm(message))return;
  mutate(async uid=>{const r=await client.from('naitea_services').update({status:state}).eq('id',s.id).eq('professional_id',uid).select('id').single();return {...r,nextFilter:state};},state==='archived'?'Accompagnement archivé.':'Accompagnement réactivé.',status);
 }
 function serviceDetail(panel,s){
  const actions=node('div','naitea-family-actions');actions.append(button('← Mes accompagnements',()=>{detailId=null;paint();}),button('Modifier',()=>{edit=s.id;paint();},true));if(s.status!=='archived')actions.append(button('Disponibilités',()=>{chosen=s.id;d.go('rendezvous');}));panel.append(actions);
  const photo=node('img','naitea-service-detail-cover');photo.alt='Couverture de '+s.title;photo.hidden=true;panel.append(photo);attachImage(s,photo);
  const head=node('div','naitea-service-summary');head.append(text('h2',s.title),text('strong',money(s.price_cents)+' · '+s.duration_minutes+' min'),text('p',STATES[s.status]));panel.append(head);
  const content=node('section','naitea-family-detail naitea-service-description');content.append(text('h3','Description'),text('p',s.description||'Pas de description.'));if(s.audience)content.append(text('h3','Public concerné'),text('p',s.audience));if(s.extra)content.append(text('h3','Informations complémentaires'),text('p',s.extra));if(s.booking_city)content.append(text('h3','Ville de référence'),text('p',s.booking_city));if(s.booking_instructions)content.append(text('h3','Informations utiles envoyées aux familles'),text('p',s.booking_instructions));panel.append(content);
  const modes=node('div','naitea-service-grid'),detail=s.modality_details||{};
  for(const k of modesOf(s)){const card=node('section','naitea-family-detail');card.append(text('h3',MODES[k]));if(k==='practice'&&detail.office?.address)card.append(text('p',detail.office.address));if(k==='home'){if(detail.home?.zone)card.append(text('p',detail.home.zone));const f=detail.home?.fees;if(f?.enabled)card.append(text('p','Frais de déplacement : '+[f.perKm?money(Math.round(f.perKm*100))+'/km':'',f.fixed?money(Math.round(f.fixed*100))+' forfait':'',f.includedKm?f.includedKm+' km inclus':''].filter(Boolean).join(' · ')));}if(k==='video'&&detail.video?.platform)card.append(text('p',detail.video.other||detail.video.platform));if(k==='phone'&&detail.phone?.number)card.append(text('p',detail.phone.number));modes.append(card);}
  panel.append(modes,text('p','Pause entre séances : '+s.buffer_minutes+' min · '+rules.filter(r=>r.service_id===s.id).length+' plage(s) hebdomadaire(s)'));
  if(s.status==='active'){
   const share=node('section','naitea-family-detail naitea-service-share');share.append(text('h3','Réservation en ligne'));
   const info=statusLine();share.append(text('p',s.booking_link?'Ce lien est accessible aux personnes à qui tu le transmets. En bêta, seules les coordonnées de test sont acceptées.':'Active ton lien pour permettre aux familles de choisir un créneau. Vérifie que les informations et les lieux de cet accompagnement peuvent être publiés.'));
   const changeLink=async link=>{const r=await client.from('naitea_services').update({booking_link:link}).eq('id',s.id).eq('professional_id',owner).select('id').single();return {...r,nextFilter:'active'};};
   if(!s.booking_slug)share.append(text('p','Renseigne la ville dans Modifier pour obtenir un lien optimisé avec le nom de ton accompagnement et ta ville.'),button('Renseigner ma ville',()=>{edit=s.id;paint();}));
   if(s.booking_link){
    const url=location.origin+(s.booking_slug?'/'+s.booking_slug:'/accompagnement/'+s.booking_link),link=node('input');link.value=url;link.readOnly=true;link.setAttribute('aria-label','Lien de réservation');share.append(link);
    const tools=node('div','naitea-family-actions');const preview=text('a','Ouvrir la réservation');preview.href=url;preview.target='_blank';preview.rel='noopener noreferrer';preview.className='btn';
    tools.append(preview,button('Copier le lien',async()=>{try{await navigator.clipboard.writeText(url);info.textContent='Lien copié.';}catch{link.select();info.textContent='Sélectionne et copie le lien.';}}),button('Désactiver le lien',()=>{if(confirm('Désactiver ce lien ? Les rendez-vous déjà confirmés sont conservés.'))mutate(()=>changeLink(null),'Lien de réservation désactivé.',info);}));share.append(tools);
    const embedURL=url+'?embed=1',iframe='<iframe src="'+embedURL+'" title="Accompagnement Naïtéa" width="100%" height="1100" style="border:0" loading="lazy"></iframe>';
    const iframeLabel=text('label','Code iframe pour ton site internet');iframeLabel.htmlFor='naiteaServiceIframe';
    const embedField=node('textarea');embedField.id='naiteaServiceIframe';embedField.readOnly=true;embedField.rows=4;embedField.value=iframe;share.append(iframeLabel,embedField,button('Copier le code iframe',async()=>{try{await navigator.clipboard.writeText(iframe);info.textContent='Code iframe copié !';}catch{embedField.select();info.textContent='Sélectionne et copie le code.';}}),text('p','La famille choisit la date, l’horaire et la modalité dans ton site. Elle retrouve son choix dans le nouvel onglet sécurisé pour finaliser.'));
   }else if(s.booking_slug)share.append(button('Activer mon lien de réservation',()=>{if(confirm('Rendre la description, la couverture, les tarifs, les modalités et les lieux de cette prestation accessibles via un lien de test ?'))mutate(()=>changeLink(crypto.randomUUID()),'Lien activé. Ouvre la fiche pour le copier.',info);},true));
   share.append(info);panel.append(share);
  }
  const status=statusLine();panel.append(button(s.status==='archived'?'Réactiver l’accompagnement':'Archiver l’accompagnement',()=>setServiceStatus(s,s.status==='archived'?'active':'archived',status)),status);
 }
 function offers(panel){
  if(edit!==null){serviceForm(panel,edit==='new'?null:services.find(x=>x.id===edit));return;}
  if(detailId){const s=services.find(x=>x.id===detailId);if(s){serviceDetail(panel,s);return;}detailId=null;}
  const actions=node('div','naitea-family-actions');actions.append(button('+ Ajouter un accompagnement',()=>{edit='new';paint();},true),button('Mes disponibilités',()=>d.go('rendezvous')),button('Actualiser',load));panel.append(actions);
  const tabs=node('div','naitea-service-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Filtrer les accompagnements');
  for(const [key,label] of [['active','Actifs'],['draft','Brouillons'],['archived','Archives']]){const b=button(label+' ('+visibleServices(services,key).length+')',()=>{offerFilter=key;paint();});b.className='naitea-service-tab'+(offerFilter===key?' is-selected':'');b.setAttribute('aria-pressed',String(offerFilter===key));tabs.append(b);}panel.append(tabs);
  const visible=visibleServices(services,offerFilter);
  if(!visible.length){panel.append(text('p',offerFilter==='active'?'Aucun accompagnement actif. Crée une prestation ou active un brouillon.':offerFilter==='draft'?'Aucun brouillon.':'Aucun accompagnement archivé.'));return;}
  const grid=node('div','naitea-service-grid naitea-offer-grid');
  for(const s of visible){
   const c=node('article','naitea-offer-card');const img=node('img','naitea-offer-cover');img.alt='';img.hidden=true;c.append(img);attachImage(s,img);
   const body=node('div','naitea-offer-body'),h=node('h2'),open=()=>{detailId=s.id;paint();};const titleButton=button(s.title,open);titleButton.className='naitea-offer-title';h.append(titleButton);body.append(h);
   const line=node('div','naitea-offer-price');line.append(text('strong',money(s.price_cents)),text('span',s.duration_minutes+' min'));body.append(line);
   const list=node('ul','naitea-offer-modalities');list.setAttribute('aria-label','Modalités');for(const k of modesOf(s))list.append(text('li',MODES[k]));body.append(list);
   const footer=node('div','naitea-offer-footer');const detail=button('Voir les détails →',open);detail.className='btn secondary';footer.append(detail);body.append(footer);c.append(body);grid.append(c);
  }panel.append(grid);
 }
 function availability(panel){
  const v=generation,uid=owner;panel.append(root.NaiteaAppointments.mount({client,services,isCurrent:()=>safe(v,uid),mutate,goFamilies:()=>d.go('familles'),initialDay:agendaDay,initialService:chosen}));
  const available=services.filter(s=>s.status!=='archived');const actions=node('div','naitea-family-actions');actions.append(button('Gérer mes accompagnements',()=>d.go('offers')),button('Actualiser',load));panel.append(actions);
  panel.append(text('h2','Ma semaine type'),text('p','Choisis les jours et les modalités possibles sur chaque plage. Une famille choisira une seule option lors de sa réservation. Les horaires se répètent chaque semaine (heure de Paris).'));
  if(!available.length)panel.append(text('p','Crée d’abord un accompagnement pour définir ses disponibilités.'));
  else{
   const service=selectField('Accompagnement','service',available.map(s=>[s.id,s.title]),chosen||available[0].id);const sel=service.querySelector('select');sel.addEventListener('change',()=>{chosen=sel.value;ruleEdit=null;allPlanning=false;paint();});panel.append(service);
   const selected=available.find(s=>s.id===sel.value)||available[0];chosen=selected.id;
   panel.append(text('p','Durée : '+selected.duration_minutes+' min · pause entre séances : '+selected.buffer_minutes+' min'));
   const toolbar=node('div','naitea-family-actions');
   toolbar.append(button(allPlanning?'Voir cet accompagnement':'Voir tous mes accompagnements',()=>{allPlanning=!allPlanning;paint();}),button(parentPreview?'Masquer l’aperçu familles':'Aperçu côté familles',()=>{parentPreview=!parentPreview;paint();}));
   panel.append(toolbar);
   const legend=node('div','naitea-planning-legend');
   for(const k of Object.keys(MODES)){const tag=text('span',MODES[k]);tag.className='naitea-planning-tag mode-'+k;legend.append(tag);}panel.append(legend);
   const visible=rules.filter(r=>allPlanning?available.some(s=>s.id===r.service_id):r.service_id===selected.id);
   const week=node('div','naitea-planning-week');
   for(const [i,day] of DAYS.entries()){
    const col=node('section','naitea-planning-day');const title=node('div','naitea-planning-dayhead');title.append(text('h3',day),text('span',String(visible.filter(r=>r.weekday===i+1).length)+' plage(s)'));col.append(title);
    const dayRules=visible.filter(r=>r.weekday===i+1).sort((a,b)=>a.start_minute-b.start_minute||a.end_minute-b.end_minute);
    if(!dayRules.length)col.append(text('p','Repos / non disponible'));
    for(const r of dayRules){const opts=optionsOf(r),card=node('article','naitea-planning-slot '+(opts.length>1?'mode-flexible':'mode-'+opts[0].modality)),serviceRow=services.find(s=>s.id===r.service_id);
     card.append(text('strong',clock(r.start_minute)+' – '+clock(r.end_minute)));
     if(opts.length>1)card.append(text('span',opts.length+' modalités au choix'));
     for(const o of opts){const part=node('div','naitea-planning-option mode-'+o.modality);part.append(text('b',MODES[o.modality]||'Modalité à préciser'));if(o.location_label)part.append(text('p',o.location_label));if(o.location_details)part.append(text('p',o.location_details));card.append(part);}
     if(allPlanning)card.append(text('p',serviceRow?.title||'Accompagnement'));
     if(serviceRow&&r.end_minute-r.start_minute<serviceRow.duration_minutes)card.append(text('p','Plage trop courte pour la durée actuelle.'));
     const conflict=rules.some(o=>o.id!==r.id&&o.service_id!==r.service_id&&available.some(s=>s.id===o.service_id)&&o.weekday===r.weekday&&o.start_minute<r.end_minute&&o.end_minute>r.start_minute&&!optionsOf(o).some(a=>opts.some(b=>optionKey(a)===optionKey(b))));
     if(conflict){const warn=text('p','Autre prestation au même horaire, avec des lieux ou modalités différents.');warn.className='naitea-planning-warning';card.append(warn);}
     const tools=node('div','naitea-planning-tools'),status=statusLine();tools.append(button('Modifier',()=>{chosen=r.service_id;ruleEdit={...r};paint();document.getElementById('naiteaPlanningForm')?.scrollIntoView({block:'nearest',behavior:'smooth'});}),button('Retirer',()=>{if(confirm('Retirer cette disponibilité hebdomadaire ?'))mutate(uid=>client.from('naitea_service_availability').delete().eq('id',r.id).eq('professional_id',uid).select('id').single(),'Disponibilité retirée.',status);}));card.append(tools,status);col.append(card);
    }
    col.append(button('+ Ajouter',()=>{ruleEdit={weekday:i+1};paint();document.getElementById('naiteaPlanningForm')?.scrollIntoView({block:'nearest',behavior:'smooth'});}));
    week.append(col);
   }
   panel.append(week);
   if(parentPreview){
    const preview=node('section','naitea-planning-preview');preview.append(text('h2','Aperçu côté familles'),text('p',selected.title+' · '+selected.duration_minutes+' min · '+money(selected.price_cents)),text('p','Choisir mon lieu ou ma modalité'));
    const groups=groupLocations(rules.filter(r=>r.service_id===selected.id&&r.end_minute-r.start_minute>=selected.duration_minutes));
    if(!groups.length)preview.append(text('p','Aucune disponibilité configurée.'));
    for(const g of groups){const card=node('div','naitea-planning-slot mode-'+g.modality);card.append(text('strong',g.label||MODES[g.modality]),text('p',g.label?MODES[g.modality]:''));if(g.details)card.append(text('p',g.details));for(const r of g.rows)card.append(text('p',DAYS[r.weekday-1]+' · '+clock(r.start_minute)+' – '+clock(r.end_minute)));preview.append(card);}
    preview.append(text('p','Les mêmes horaires peuvent apparaître dans plusieurs modalités : la famille en choisira une seule. Aperçu des horaires habituels, sans réservation réelle. Les créneaux occupés et les absences seront pris en compte par le futur moteur.'));panel.append(preview);
   }
   const form=node('form','naitea-service-form');form.id='naiteaPlanningForm';const existing=ruleEdit?.id?ruleEdit:null;
   form.append(text('h2',existing?'Modifier une disponibilité':'Ajouter une disponibilité'));
   form.append(text('h3','Quelles modalités proposes-tu à ces horaires ?'),text('p','Coche une ou plusieurs options. Elles partagent la même plage horaire, elles ne représentent pas plusieurs places.'));
   const modeGrid=node('div','naitea-planning-modes');const previous=existing?optionsOf(existing):[];const allowed=modesOf(selected);
   for(const k of allowed){
    const prior=previous.find(o=>o.modality===k),box=node('section','naitea-planning-mode-choice mode-'+k),label=node('label','naitea-planning-mode-check'),check=node('input');
    check.type='checkbox';check.name='modalities';check.value=k;check.checked=existing?!!prior:allowed.length===1;
    label.append(check,text('strong',MODES[k]));box.append(label);
    const fields=node('div','naitea-planning-mode-fields');
    if(k==='practice'||k==='home')fields.append(field('Nom du lieu (facultatif)','label_'+k,'text',prior?.location_label||'',{maxlength:120,placeholder:k==='practice'?'Ex. Pôle santé Les Tilleuls':'Ex. Métropole lilloise'}));
    let detail;
    if(k==='video'){const saved=prior?.location_details||locationDefault(selected,k),choices=VIDEO_TOOLS.map(v=>[v,v]);if(prior?.location_details&&!VIDEO_TOOLS.includes(prior.location_details))choices.push([prior.location_details,prior.location_details+' (ancien choix)']);detail=selectField('Outil de visioconférence','details_'+k,choices,choices.some(([v])=>v===saved)?saved:'Google Meet');}
    else{detail=field(k==='practice'?'Adresse du cabinet / pôle santé *':k==='home'?'Zone d’intervention *':'Précision (facultative)','details_'+k,'text',prior?.location_details??locationDefault(selected,k),{maxlength:300,placeholder:k==='practice'?'Rue, code postal, ville':k==='home'?'Ex. 15 km autour de Lille':'Appel téléphonique'});detail.querySelector('input').required=k==='practice'||k==='home';}
    fields.append(detail);box.append(fields);
    const sync=()=>{fields.hidden=!check.checked;for(const e of fields.querySelectorAll('input,select'))e.disabled=!check.checked;box.classList.toggle('is-selected',check.checked);};check.addEventListener('change',sync);sync();modeGrid.append(box);
   }
   form.append(modeGrid,text('p','Les lieux sont préremplis depuis ton accompagnement. Tu peux les personnaliser pour cette plage.'));
   const days=node('div','naitea-planning-days');for(const [i,label] of DAYS.entries()){const l=node('label','naitea-planning-daychoice'),c=node('input');c.type='checkbox';c.name='weekday';c.value=String(i+1);c.checked=(ruleEdit?.weekday||1)===i+1;if(existing)c.addEventListener('change',()=>{if(c.checked)days.querySelectorAll('input').forEach(other=>{if(other!==c)other.checked=false;});});l.append(c,text('span',label));days.append(l);}form.append(text('h3',existing?'Jour':'Jour(s) de la semaine'),days);
   const grid=node('div','naitea-family-fields');grid.append(field('De','start','time',existing?clock(existing.start_minute):'09:00',{required:true,step:300}),field('À','end','time',existing?clock(existing.end_minute):'17:00',{required:true,step:300}));form.append(grid);
   const add=text('button',existing?'Enregistrer la modification':'Ajouter à mon planning');add.type='submit';add.className='btn';const status=statusLine(),buttons=node('div','naitea-family-actions');buttons.append(add);if(ruleEdit)buttons.append(button('Annuler',()=>{ruleEdit=null;paint();}));form.append(buttons,status);panel.append(form);
   form.addEventListener('submit',e=>{
    e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form),start=minutes(f.get('start')),end=minutes(f.get('end')),weekdays=f.getAll('weekday').map(Number),chosenModes=f.getAll('modalities').map(String);
    if(!weekdays.length||existing&&weekdays.length!==1){status.textContent='Choisis au moins un jour.';return;}
    if(!Number.isInteger(start)||!Number.isInteger(end)||start%5||end%5||end-start<selected.duration_minutes){status.textContent='La plage doit être au moins aussi longue que la séance, avec des horaires par pas de 5 minutes.';return;}
    if(!chosenModes.length||chosenModes.some(k=>!modesOf(selected).includes(k))){status.textContent='Choisis au moins une modalité.';return;}
    const options=chosenModes.map(modality=>({modality,location_label:String(f.get('label_'+modality)||'').trim()||null,location_details:String(f.get('details_'+modality)||'').trim()||null}));
    if(options.some(o=>['practice','home'].includes(o.modality)&&!o.location_details)){status.textContent='Précise le lieu ou la zone pour chaque modalité sélectionnée.';return;}
    if(weekdays.some(day=>rules.some(r=>r.id!==existing?.id&&r.service_id===selected.id&&r.weekday===day&&r.start_minute<end&&r.end_minute>start))){status.textContent='Une plage existe déjà à cet horaire. Modifie-la pour ajouter les autres modalités.';return;}
    const payload={start_minute:start,end_minute:end,options};
    mutate(async uid=>{if(existing)return client.from('naitea_service_availability').update({...payload,weekday:weekdays[0]}).eq('id',existing.id).eq('professional_id',uid).select('id').single();const result=await client.from('naitea_service_availability').insert(weekdays.map(weekday=>({...payload,weekday,professional_id:uid,service_id:selected.id}))).select('id');return result.error||result.data?.length!==weekdays.length?{...result,data:null}:{...result,data:{id:result.data[0].id}};},existing?'Disponibilité modifiée.':'Disponibilité ajoutée au planning.',status);
   });
   panel.append(text('p','Plusieurs modalités sur une plage sont des alternatives pour un seul rendez-vous. Le verrouillage global de l’horaire, toutes prestations et modalités confondues, sera raccordé au moteur de réservation.'));
  }
  panel.append(text('h2','Mes indisponibilités'),text('p','Bloque une journée ou une période complète pour toutes tes prestations. Tes horaires hebdomadaires restent enregistrés.'));
  const form=node('form','naitea-service-form naitea-absence-form'),status=statusLine();
  const type=selectField('Type d’indisponibilité','absence_type',[['day','Une journée'],['range','Une période (vacances, congés…)']],'day');form.append(type);
  const dates=node('div','naitea-family-fields'),startField=field('Date','start_date','date',parisDay(),{required:true,min:parisDay(),max:'2100-12-31'}),endField=field('Au (inclus)','end_date','date',parisDay(),{required:true,min:parisDay(),max:'2100-12-31'});
  dates.append(startField,endField);form.append(dates);const add=text('button','Bloquer cette journée');add.type='submit';add.className='btn';form.append(add,status);panel.append(form);
  const sync=()=>{const range=form.elements.absence_type.value==='range',from=form.elements.start_date,to=form.elements.end_date;startField.querySelector('span').textContent=range?'Du':'Date';endField.hidden=!range;to.disabled=!range;to.min=from.value;if(to.value<from.value)to.value=from.value;add.textContent=range?'Bloquer cette période':'Bloquer cette journée';};form.addEventListener('change',sync);sync();
  form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form),date=String(f.get('start_date')||''),end=f.get('absence_type')==='range'?String(f.get('end_date')||''):date;
   if(!date||!end||date<parisDay()||end<date||end>'2100-12-31'){status.textContent='Vérifie les dates de début et de fin.';return;}
   if(closed.some(r=>r.closed_date<=end&&(r.end_date||r.closed_date)>=date)){status.textContent='Cette période recoupe une indisponibilité existante. Ajuste les dates ou débloque d’abord la période concernée.';return;}
   mutate(uid=>client.from('naitea_service_closed_days').insert({professional_id:uid,closed_date:date,end_date:end}).select('id').single(),date===end?'Journée bloquée.':'Période bloquée.',status);
  });
  const days=closed.filter(r=>(r.end_date||r.closed_date)>=parisDay());if(!days.length)panel.append(text('p','Aucune indisponibilité à venir.'));
  const absences=node('div','naitea-absence-list');for(const r of days){const line=node('div','naitea-absence-row'),info=node('div','naitea-absence-info'),status=statusLine();info.append(text('strong',absenceLabel(r)),text('p',r.closed_date===(r.end_date||r.closed_date)?'Journée indisponible':'Période indisponible'));line.append(info,button('Débloquer',()=>{if(confirm('Retirer cette indisponibilité ?'))mutate(uid=>client.from('naitea_service_closed_days').delete().eq('id',r.id).eq('professional_id',uid).select('id').single(),'Indisponibilité retirée.',status);}),status);absences.append(line);}panel.append(absences);
  panel.append(text('p','Les horaires et les absences sont pris en compte pour les nouveaux rendez-vous. Les réservations côté familles, les emails et les liens visio automatiques seront raccordés ensuite. Les absences n’annulent pas les rendez-vous existants.'));
 }
 function paint(){
  if(!current())return;const app=document.getElementById('app');if(!app)return;const panel=node('section','card naitea-crm naitea-service-panel');panel.id='naiteaPrivateServices';app.replaceChildren(panel);
  if(view==='offers')heading(panel,'Mes accompagnements','seance-individuelle','Crée tes prestations individuelles et prépare leur réservation.');else heading(panel,'Mes rendez-vous','agenda','Retrouve tes rendez-vous, tes ateliers et tes disponibilités.');
  if(!checked){panel.append(text('p','Vérification de la connexion…'));return;}if(!enabled){panel.append(text('p','Cette fonctionnalité est disponible uniquement dans la bêta privée.'));return;}
  if(notice){const p=text('p',notice);p.setAttribute('role','status');panel.append(p);}if(!loaded){if(!loading){panel.append(button('Actualiser',load));if(!owner){const a=text('a','Me connecter');a.href='/connexion.html';a.className='btn secondary';panel.append(a);}}return;}
  if(view==='offers')offers(panel);else availability(panel);
 }
 function decorate(){
  if(!d.isPage()){leave();return;}document.body.classList.add('naitea-service-workspace');
  const next=d.page();if(!active||view!==next){generation++;loading=busy=false;active=true;view=next;edit=null;ruleEdit=null;detailId=null;if(next==='offers')offerFilter='active';paint();if(enabled&&!loaded)load();}else if(!document.getElementById('naiteaPrivateServices'))paint();
 }
 async function start(){try{const r=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});enabled=r.ok&&(await r.json()).realBookings===true;}catch{}finally{checked=true;if(d.isPage()){decorate();paint();if(enabled&&!loaded&&!loading)load();}}}
 window.addEventListener('pagehide',leave);window.addEventListener('pageshow',e=>{if(e.persisted){decorate();if(enabled&&!loaded&&!loading)load();}});
 function openAgenda(day){agendaDay=day;d.go('rendezvous');if(current()&&loaded)paint();}
 return {start,decorate,openAgenda};
}
const api={create,minutes,clock,priceCents,locationDefault,groupLocations,optionsOf,visibleServices,absenceLabel};if(typeof module==='object'&&module.exports)module.exports=api;else root.NaiteaProServices=api;
})(globalThis);
