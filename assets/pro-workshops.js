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
  return rows.filter(w=>['draft','published'].includes(w.status)&&w.starts_at&&Number.isFinite(Date.parse(w.starts_at))&&Date.parse(w.starts_at)>=now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
}
function rowsOnDate(rows,date){
  return rows.filter(w=>['draft','published'].includes(w.status)&&w.starts_at&&localDate(w.starts_at).slice(0,10)===date).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)||a.id.localeCompare(b.id));
}
const COVER_BUCKET='naitea-workshop-covers', COVER_LIMIT=2097152, INPUT_LIMIT=12*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function coverPath(owner,id){
  if(!UUID.test(owner)||!UUID.test(id))throw Error('Identifiant de photo invalide.');
  return owner.toLowerCase()+'/'+id.toLowerCase()+'.jpg';
}
function dimensions(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>40000000)throw Error('Image trop grande ou illisible.');
  const scale=Math.min(1,1600/Math.max(width,height));
  return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))];
}
function cropRect(width,height,zoom=1,x=50,y=50){
  dimensions(width,height);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
  const z=clamp(zoom,1,3), ratio=16/9;
  const w=Math.min(width,height*ratio)/z,h=w/ratio;
  return [(width-w)*clamp(x,0,100)/100,(height-h)*clamp(y,0,100)/100,w,h];
}
async function compressCover(file,crop=null){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>INPUT_LIMIT)throw Error('Choisis une image JPG, PNG ou WebP de 12 Mo maximum.');
  const src=URL.createObjectURL(file);
  try{
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Image illisible.'));image.src=src;});
    const source=crop?cropRect(image.naturalWidth,image.naturalHeight,crop.zoom,crop.x,crop.y):[0,0,image.naturalWidth,image.naturalHeight];
    const [width,height]=dimensions(source[2],source[3]);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Compression indisponible.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,...source,0,0,width,height);
    for(const quality of [.86,.72,.58,.42]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob?.type==='image/jpeg'&&blob.size&&blob.size<=COVER_LIMIT)return blob;
    }
    throw Error('Impossible de compresser cette image sous 2 Mo.');
  }finally{URL.revokeObjectURL(src);}
}
function create(d){
  let manualEnabled=false,checkoutConfigured=false;
  let enabled=false, publication=false, owner=null, client=null, revision=0, rows=[], ready=false, busy=false, truncated=false, message='', observed=false, uncertain=false, controller=null, timer=null;
  const bookingCounts=new Map();let countRequest=0;
  const knownCovers=new Set(), coverUrls=new Map(), downloads=new Map();
  let coversAvailable=false, previewUrl='', portraitPreviewUrl='';
  const el=id=>document.getElementById(id);
  function revokePreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl='';if(portraitPreviewUrl)URL.revokeObjectURL(portraitPreviewUrl);portraitPreviewUrl='';}
  function forgetCover(id){const url=coverUrls.get(id);if(url)URL.revokeObjectURL(url);coverUrls.delete(id);downloads.delete(id);}
  function resetCovers(){for(const id of coverUrls.keys())forgetCover(id);downloads.clear();knownCovers.clear();coversAvailable=false;revokePreview();}
  async function listCovers(version){
    const {data,error}=await client.storage.from(COVER_BUCKET).list(owner,{limit:1000,sortBy:{column:'name',order:'asc'}});
    if(version!==revision)return;
    if(error||!Array.isArray(data))throw Error('Photos indisponibles.');
    knownCovers.clear();
    for(const file of data){const id=typeof file.name==='string'&&file.name.endsWith('.jpg')?file.name.slice(0,-4):'';if(UUID.test(id))knownCovers.add(id);}
    coversAvailable=true;
  }
  async function getCover(w){
    if(!owner||!knownCovers.has(w.id))return '';
    if(coverUrls.has(w.id))return coverUrls.get(w.id);
    if(downloads.has(w.id))return downloads.get(w.id);
    const version=revision, key=coverPath(owner,w.id);
    const promise=(async()=>{
      try{
        const {data,error}=await client.storage.from(COVER_BUCKET).download(key);
        if(error||!data||!data.size||data.size>COVER_LIMIT||data.type!=='image/jpeg'||revision!==version||downloads.get(w.id)!==promise)return '';
        const url=URL.createObjectURL(data);coverUrls.set(w.id,url);return url;
      }catch{return '';}finally{if(downloads.get(w.id)===promise)downloads.delete(w.id);}
    })();
    downloads.set(w.id,promise);return promise;
  }
  function attachCover(w,img,stillCurrent=()=>true){
    if(!w)return;
    const version=revision;
    getCover(w).then(url=>{if(url&&version===revision&&img.isConnected&&d.isPage()&&stillCurrent()){img.src=url;img.hidden=false;}});
  }
  const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
  function closePrivate(){revokePreview();if(el('naiteaPrivateWorkshopForm')||el('naiteaPrivatePublicPreviewCover')||el('naiteaPublishedLink')||el('naiteaPublicProfileForm')||el('naiteaPrivateBookings')||el('naiteaReminderModal'))d.closeModal();}
  function clear(){revision++;controller?.abort();owner=null;rows=[];bookingCounts.clear();countRequest++;ready=false;busy=false;uncertain=false;truncated=false;resetCovers();closePrivate();}
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
      rows=result.workshops;truncated=result.truncated;ready=true;await refreshBookingCounts();if(version!==revision)return;message='Tes ateliers sont enregistrés dans ton compte. Seuls les ateliers publiés sont accessibles aux familles.';
      try{await listCovers(version);}catch{if(version===revision)message+=' Photos indisponibles : actualise pour réessayer.';}
    }catch{if(version===revision)message='Impossible de charger les ateliers. Réessaie.';}
    finally{if(version===revision&&d.isPage())decorate();}
  }
  function view(w){
    if(!w)return null;
    const date=localDate(w.starts_at);
    return {id:w.id,title:w.title,description:w.description||'',date:date.slice(0,10),time:date.slice(11),capacity:w.capacity,price:w.price_cents/100,duration:w.duration_label||'',category:w.category||'Massage bébé',workshopModality:w.modality||'venue',venueName:w.venue_name||'',venueAddress:{street:w.venue_street||'',postalCode:w.venue_postal_code||'',city:w.venue_city||''},videoPlatform:w.video_platform||'',targetAudiences:w.target_audiences||['Jeunes parents','Bébés'],childAge:w.child_age_unit?{min:w.child_age_min,max:w.child_age_max,unit:w.child_age_unit}:null};
  }
  function reminderFields(w){
    const panel=document.createElement('section');panel.className='naitea-reminder-panel';
    const hours=Array.isArray(w?.reminder_hours)?w.reminder_hours:w?[]:[24];
    const heading=text('h3','Rappels automatiques');panel.append(heading);
    const checkbox=(name,value,label,checked)=>{const wrap=document.createElement('label');wrap.className='checkline';const input=document.createElement('input');input.type='checkbox';input.name=name;input.value=String(value);if(checked)input.setAttribute('checked','');wrap.append(input,document.createTextNode(' '+label));return wrap;};
    panel.append(checkbox('reminders_enabled','yes','Activer les rappels par email',hours.length>0));
    const choices=document.createElement('div');choices.dataset.reminderChoices='1';
    for(const h of [48,24,2])choices.append(checkbox('reminder_hours',h,h+' heures avant l’atelier',hours.includes(h)));
    const label=text('label','Informations à rappeler aux participants (facultatif)');label.htmlFor='naiteaReminderNotes';
    const notes=document.createElement('textarea');notes.name='reminder_instructions';notes.id=label.htmlFor;notes.maxLength=1000;notes.rows=3;notes.placeholder='Ex. Prévoir un tapis et une tenue confortable.';notes.textContent=w?.reminder_instructions||'';
    choices.append(label,notes);panel.append(choices,text('p','Seules les inscriptions confirmées avant l’heure du rappel sont concernées. En bêta, envoi à l’adresse de test uniquement. Ne saisis pas de données personnelles ou médicales.'));
    return panel;
  }
  function syncReminders(form,changed=null){
    const enabled=form.elements.reminders_enabled;if(!enabled)return;
    const choices=form.querySelector('[data-reminder-choices]');
    const inputs=[...choices.querySelectorAll('input[name="reminder_hours"]')];
    if(changed===enabled&&enabled.checked&&!inputs.some(i=>i.checked))inputs.find(i=>i.value==='24').checked=true;
    if(changed?.name==='reminder_hours'&&enabled.checked&&!inputs.some(i=>i.checked))enabled.checked=false;
    choices.hidden=!enabled.checked;
    for(const input of choices.querySelectorAll('input,textarea'))input.disabled=!enabled.checked;
  }
  function reminderPayload(form){
    const enabled=form.elements.reminders_enabled;
    if(!enabled)return {};
    const hours=enabled.checked?[...form.querySelectorAll('input[name="reminder_hours"]:checked')].map(i=>Number(i.value)):[];
    const notes=form.elements.reminder_instructions.value.trim().replace(/[\r\n\t]+/g,' ');
    return {reminder_hours:hours,reminder_instructions:notes||null};
  }
  function editReminders(w){
    if(!ready||busy||uncertain||!owner||!d.isPage())return;
    const version=revision,uid=owner;
    const shell=document.createElement('div');shell.id='naiteaReminderModal';
    d.showModal('Rappels de ton atelier',w.title,shell.outerHTML);
    const target=el('naiteaReminderModal');if(!target)return;
    const form=document.createElement('form');form.append(reminderFields(w));
    const status=text('p','');status.setAttribute('role','status');
    const back=button('Retour',()=>d.closeModal()),save=text('button','Enregistrer les rappels');save.type='submit';save.className='btn';
    const actions=document.createElement('div');actions.className='naitea-cancel-actions';actions.append(back,save);form.append(status,actions);target.append(form);syncReminders(form);
    form.addEventListener('change',event=>syncReminders(form,event.target));
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(busy||version!==revision||uid!==owner||!target.isConnected)return;
      const payload={id:w.id,...reminderPayload(form)};busy=true;for(const input of form.elements)input.disabled=true;status.textContent='Enregistrement…';
      try{const result=await api('PATCH',payload,version);if(version!==revision||uid!==owner)return;const saved=result?.workshops?.[0];if(!saved||saved.id!==w.id)throw Error();rows=rows.map(r=>r.id===saved.id?saved:r);message='Rappels enregistrés.';d.closeModal();}
      catch{if(version===revision&&uid===owner){uncertain=true;message='Enregistrement non confirmé. Actualise avant de réessayer.';status.textContent=message;back.disabled=false;}}
      finally{if(version===revision&&uid===owner){busy=false;decorate();}}
    });
  }
  const PAYMENT_LABELS={free:'Gratuit',onsite:'Paiement sur place',online:'Paiement intégral en ligne',choice:'Au choix de la famille',deposit:'Acompte en ligne, solde sur place'};
  const paymentLabel=w=>PAYMENT_LABELS[w.price_cents===0?'free':w.payment_mode||'onsite'];
  const pendingOnline=w=>['online','choice','deposit'].includes(w.payment_mode)&&!checkoutConfigured;
  function paymentControls(w){
    const panel=document.createElement('fieldset');panel.className='naitea-workshop-payment';panel.append(text('legend','Modalités de paiement'));
    const info=text('p','Choisis comment les familles régleront cet atelier. Aucun frais de commission Naïtéa. Le paiement intégral est ouvert pour un atelier autorisé en test. Les autres modes en ligne restent en préparation.');info.className='fine';panel.append(info);
    const grid=document.createElement('div');grid.className='naitea-workshop-payment-options';
    for(const [mode,label] of Object.entries(PAYMENT_LABELS)){const line=document.createElement('label');line.className='naitea-workshop-payment-option';const input=document.createElement('input');input.type='radio';input.name='payment_mode';input.value=mode;input.required=true;if(mode===(w?.price_cents===0?'free':w?.payment_mode||'onsite'))input.setAttribute('checked','');const span=document.createElement('span');span.append(text('strong',label));if(['online','choice','deposit'].includes(mode))span.append(text('small',checkoutConfigured?'Test uniquement · atelier autorisé':'En préparation · brouillon uniquement'));line.append(input,span);grid.append(line);}
    panel.append(grid);
    const deposit=document.createElement('label');deposit.className='field';deposit.dataset.paymentDeposit='1';deposit.append(text('span','Acompte par place (€)'));const amount=document.createElement('input');amount.name='deposit_amount';amount.type='number';amount.step='0.01';amount.min='0.50';amount.value=w?.deposit_cents!=null?String(w.deposit_cents/100):'';amount.setAttribute('value',amount.value);deposit.append(amount);panel.append(deposit);
    const help=text('p','');help.dataset.paymentHelp='1';help.className='fine';panel.append(help);return panel;
  }
  function syncPayment(form){
    const e=form.elements,radios=[...form.querySelectorAll('[name=payment_mode]')];if(!radios.length)return;
    const price=Number(e.price.value),free=radios.find(x=>x.value==='free'),onsite=radios.find(x=>x.value==='onsite');
    if(e.price.value!==''&&price===0)free.checked=true;else if(free.checked&&price>0)onsite.checked=true;
    for(const radio of radios)radio.disabled=radio.value==='free'?price>0:price===0&&e.price.value!=='';
    const mode=radios.find(x=>x.checked)?.value||'onsite',deposit=form.querySelector('[data-payment-deposit]'),amount=e.deposit_amount;
    deposit.hidden=mode!=='deposit';amount.disabled=mode!=='deposit';amount.required=mode==='deposit';if(Number.isFinite(price))amount.max=String(Math.max(0,Math.round(price*100-1)/100));
    form.querySelector('[data-payment-help]').textContent=mode==='free'?'Les familles réservent sans paiement.':mode==='onsite'?'La famille réserve en ligne et règle directement auprès de toi.':checkoutConfigured?'Règlement en mode test, pour les ateliers autorisés uniquement.':'Le réglage est enregistré dans ton brouillon. La publication sera ouverte après validation du paiement en ligne.';
  }
  function fields(form){
    syncPayment(form);
    syncReminders(form);
    const e=form.elements;const pricingLabel=form.querySelector('[data-pricing-label]');if(pricingLabel)pricingLabel.textContent=e.pricing_unit.value==='duo'?'Prix par duo parent-enfant (€) *':'Prix par personne (€) *';
    const video=form.querySelector('[name="workshopModality"]:checked')?.value==='video';
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
    const cents=Math.round(Number(values.price)*100),mode=cents===0?'free':values.payment_mode||'onsite',deposit=mode==='deposit'?Math.round(Number(values.deposit_amount)*100):null;
    if(mode==='deposit'&&(!Number.isInteger(deposit)||deposit<50||deposit>=cents))throw Error('L’acompte doit être d’au moins 0,50 € et inférieur au prix total.');
    return {payment_mode:mode,deposit_cents:deposit,title:values.title,description:values.description||null,starts_at:date.toISOString(),capacity:Number(values.capacity),price_cents:Math.round(Number(values.price)*100),pricing_unit:values.pricing_unit,category:extra.category,duration_label:values.duration?.trim()||null,timezone_name:Intl.DateTimeFormat().resolvedOptions().timeZone,modality:extra.workshopModality,venue_name:extra.venueName||null,venue_street:address?.street||null,venue_postal_code:address?.postalCode||null,venue_city:address?.city||null,video_platform:extra.videoPlatform||null,target_audiences:extra.targetAudiences,child_age_min:age?.min??null,child_age_max:age?.max??null,child_age_unit:age?.unit??null,...reminderPayload(form),...(w?{id:w.id}:{})};
  }
  function open(w){
    if(!ready||busy||uncertain||!owner||!d.isPage())return;
    if(w&&w.status!=='draft'){previewWorkshop(w);return;}
    const container=document.createElement('div');container.innerHTML=d.formHtml(view(w));
    const form=container.querySelector('form');
    form.id='naiteaPrivateWorkshopForm';
    revokePreview();
    const cover=form.querySelector('#v5CoverFile');const oldCover=cover?.closest('.field');if(!oldCover)throw Error('Champ photo introuvable.');
    oldCover.innerHTML='<label for="naiteaCoverFile">Photo de couverture</label><img id="naiteaCoverPreview" class="v6-cover" alt="Aperçu de la photo de couverture" hidden><input id="naiteaCoverFile" type="file" accept="image/jpeg,image/png,image/webp"><p class="fine">JPG, PNG ou WebP (12 Mo maximum). Cadrage et compression automatiques.</p><label class="checkline"><input type="checkbox" id="naiteaCoverRemove"> Retirer la photo actuelle</label><p class="fine" id="naiteaCoverStatus" role="status"></p>';
    const remove=oldCover.querySelector('#naiteaCoverRemove');remove.closest('label').hidden=!w||!knownCovers.has(w.id);
    if(!coversAvailable){oldCover.querySelector('#naiteaCoverFile').disabled=true;remove.disabled=true;oldCover.querySelector('#naiteaCoverStatus').textContent='Stockage photo indisponible. Actualise la liste pour réessayer.';}
    for(const node of form.querySelectorAll('[data-v6],[data-action]:not([data-action="close-modal"])'))node.remove();
    form.querySelector('.naitea-description-tools')?.remove();
    const helper=text('p','Heure locale de ton appareil. Les photos restent privées.');helper.className='fine';form.querySelector('.modalfooter').before(helper);
    form.elements.price.step='0.01';
    const priceField=form.elements.price.closest('.field');
    const unitField=document.createElement('div');unitField.className='field';
    const unitLabel=text('label','Tarif applicable *');unitLabel.htmlFor='naiteaPricingUnit';
    const unit=document.createElement('select');unit.name='pricing_unit';unit.id='naiteaPricingUnit';unit.required=true;
    for(const [value,label] of [['person','Par personne (bébé bienvenu)'],['duo','Par duo parent-enfant']]){const opt=text('option',label);opt.value=value;unit.append(opt);}
    unit.value=w?.pricing_unit==='duo'?'duo':'person';unitField.append(unitLabel,unit);priceField.before(unitField);
    const priceLabel=priceField.querySelector('label');priceLabel.dataset.pricingLabel='1';priceLabel.textContent=unit.value==='duo'?'Prix par duo parent-enfant (€) *':'Prix par personne (€) *';
    priceField.after(paymentControls(w));
    form.querySelector('.modalfooter').before(reminderFields(w));
    form.querySelector('[type="submit"]').textContent='Enregistrer le brouillon';
    d.showModal(w?'Modifier mon atelier':'Créer un atelier','Les informations restent privées tant que la publication n’est pas ouverte.',container.innerHTML);
    const active=el('naiteaPrivateWorkshopForm');fields(active);
    active.addEventListener('change',event=>{syncReminders(active,event.target);fields(active);});
    active.elements.price.addEventListener('input',()=>syncPayment(active));
    const status=text('p','');status.setAttribute('role','status');active.append(status);
    const fileInput=active.querySelector('#naiteaCoverFile'), removeInput=active.querySelector('#naiteaCoverRemove'), preview=active.querySelector('#naiteaCoverPreview'), coverStatus=active.querySelector('#naiteaCoverStatus');
    attachCover(w,preview,()=>!fileInput.files.length&&!removeInput.checked);
    let selected=null,preparing=false,selection=0,sourceFile=null;
    fileInput.addEventListener('change',async()=>{
      const number=++selection,version=revision;
      selected=null;sourceFile=fileInput.files[0]||null;removeInput.checked=false;
      revokePreview();preview.hidden=true;preview.removeAttribute('src');
      if(!sourceFile){preparing=false;attachCover(w,preview,()=>!fileInput.files.length&&!removeInput.checked);return;}
      preparing=true;coverStatus.textContent='Préparation de la photo…';
      try{
        const blob=await compressCover(sourceFile,{zoom:1,x:50,y:50});
        if(version!==revision||number!==selection||!active.isConnected)return;
        selected=blob;previewUrl=URL.createObjectURL(blob);preview.src=previewUrl;preview.hidden=false;coverStatus.textContent='Photo prête à être enregistrée.';
      }catch(error){if(version===revision&&number===selection&&active.isConnected){sourceFile=null;fileInput.value='';coverStatus.textContent=error.message;attachCover(w,preview,()=>!fileInput.files.length&&!removeInput.checked);}}
      finally{if(number===selection)preparing=false;}
    });
    removeInput.addEventListener('change',()=>{
      if(removeInput.checked){selection++;preparing=false;selected=null;sourceFile=null;fileInput.value='';revokePreview();preview.hidden=true;preview.removeAttribute('src');coverStatus.textContent='La photo sera retirée à l’enregistrement.';}
      else{coverStatus.textContent='';attachCover(w,preview,()=>!fileInput.files.length&&!removeInput.checked);}
    });
    active.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();if(busy||uncertain||!ready||!d.isPage())return;
      if(preparing){status.textContent='La photo est en cours de préparation.';return;}
      if(sourceFile&&!selected){status.textContent='La photo n’est pas prête.';return;}
      const photo=selected, removePhoto=removeInput.checked;
      let payload;try{payload=toPayload(active,w);}catch(error){status.textContent=error.message;return;}
      const version=revision;busy=true;
      for(const field of active.elements)field.disabled=true;status.textContent='Enregistrement…';
      try{
        const result=await api(w?'PATCH':'POST',payload,version);if(!result)return;
        const saved=result.workshops[0];if(!saved)throw Error('Enregistrement non confirmé.');
        rows=[saved,...rows.filter(r=>r.id!==saved.id)];message='Brouillon enregistré dans ton compte.';
        if(photo||removePhoto){
          try{
            const {data:sessionData,error:sessionError}=await client.auth.getSession();
            if(version!==revision)return;
            if(sessionError||sessionData?.session?.user?.id!==owner)throw Error('Session expirée.');
            const bucket=client.storage.from(COVER_BUCKET),key=coverPath(owner,saved.id);
            const result=photo?await bucket.upload(key,photo,{upsert:true,contentType:'image/jpeg',cacheControl:'0'}):await bucket.remove([key]);
            if(version!==revision)return;
            if(result.error)throw result.error;
            forgetCover(saved.id);
            if(photo){knownCovers.add(saved.id);coverUrls.set(saved.id,URL.createObjectURL(photo));}
            else knownCovers.delete(saved.id);
            message+=photo?' Photo enregistrée.':' Photo retirée.';
          }catch{
            if(version!==revision)return;
            message+=' Photo non confirmée. Actualise puis modifie ce brouillon pour réessayer (ne crée pas de doublon).';
            forgetCover(saved.id);
            try{await listCovers(version);}catch{if(version===revision)coversAvailable=false;}
          }
        }
        if(version!==revision)return;
        closePrivate();if(d.isPage())decorate();
      }catch{if(version===revision){uncertain=true;message='Enregistrement non confirmé. Actualise avant toute nouvelle tentative.';closePrivate();if(d.isPage())decorate();}}
      finally{if(version===revision){busy=false;if(d.isPage())decorate();}}
    });
  }
  function button(label,action){const b=text('button',label);b.type='button';b.className='btn secondary';b.addEventListener('click',action);return b;}
  function shareURL(w){return new URL('/atelier/'+(w.public_slug||w.id),location.origin).href;}
  function complete(w){return !!(w.starts_at&&w.category&&w.timezone_name&&w.target_audiences?.length&&((w.modality==='venue'&&w.venue_name&&w.venue_street&&w.venue_postal_code&&w.venue_city)||(w.modality==='video'&&w.video_platform)));}
  function previewWorkshop(w){
    if(!ready||busy||!owner||!d.isPage())return;
    revokePreview();
    const root=document.createElement('div');root.className='v8-public-event';
    const img=document.createElement('img');img.id='naiteaPrivatePublicPreviewCover';img.hidden=true;img.alt='Photo de couverture de '+w.title;root.append(img);
    const body=document.createElement('div');body.className='card';
    const tag=text('span',w.category||'Atelier');tag.className='tag';
    let when='Date à préciser';if(w.starts_at){try{when=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeStyle:'short',timeZone:w.timezone_name||'Europe/Paris'}).format(new Date(w.starts_at));}catch{}}
    const location=w.modality==='video'?'À distance · '+(w.video_platform||'Visioconférence'):[w.venue_name,w.venue_street,[w.venue_postal_code,w.venue_city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const desc=text('p',w.description||'');desc.className='naitea-public-description';
    const time=text('p',[when,w.duration_label].filter(Boolean).join(' · '));time.className='naitea-public-date';
    const audiences=w.target_audiences||[],age=w.child_age_unit&&w.child_age_min!=null&&w.child_age_max!=null?'de '+w.child_age_min+' à '+w.child_age_max+' '+(w.child_age_unit==='years'?'ans':'mois'):'';
    const audience=document.createElement('p');
    audiences.forEach((label,i)=>{if(i)audience.append(document.createTextNode(', '));audience.append(document.createTextNode(label));if(label==='Bébés'&&age){audience.append(document.createTextNode(' '),text('em',age));}});
    if(age&&!audiences.includes('Bébés'))audience.append(document.createTextNode(' · '),text('em',age));
    const price=text('p',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+(w.pricing_unit==='duo'?' / duo parent-enfant':' / personne')+' · '+w.capacity+' places au total');price.className='naitea-public-price';
    const professional=document.createElement('section');professional.className='naitea-public-pro';professional.id='naiteaPreviewProfessional';professional.hidden=true;
    body.append(tag,text('h1',w.title),professional,time,desc,text('p',location),audience,price,text('p',paymentLabel(w)+(pendingOnline(w)?' · En préparation, non activé':'')));
    const reserve=text('button','Réservation bientôt disponible');reserve.className='btn';reserve.disabled=true;body.append(reserve);root.append(body);
    d.showModal('Aperçu côté familles','Aperçu privé des informations visibles sur ta page publiée.',root.outerHTML);
    const active=el('naiteaPrivatePublicPreviewCover');if(active)attachCover(w,active);
    const pro=el('naiteaPreviewProfessional'),version=revision,uid=owner;
    (async()=>{
      try{
        const {data,error}=await client.from('naitea_profiles').select('business_name,public_details_enabled,public_email,public_phone,public_website,public_google_url,google_reviews_visible,google_rating,google_review_count,google_reviews_updated_at').eq('id',uid).single();
        if(error||!data||!data.business_name||version!==revision||!pro?.isConnected)return;
        const details=document.createElement('div'),name=text('p','Proposé par '+data.business_name);name.className='naitea-public-provider';details.append(name);
        if(data.public_details_enabled){
          const contacts=document.createElement('div');contacts.className='naitea-public-contacts';
          for(const [label,value] of [['',data.public_email],['',data.public_phone],['Site internet',data.public_website],['Avis Google',data.public_google_url]])if(value)contacts.append(text('span',label||value));
          details.append(contacts);
          if(data.google_reviews_visible&&data.public_google_url&&data.google_rating!=null&&Number.isInteger(data.google_review_count)){
            const score=Number(data.google_rating), review=text('p',score.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+'/5 · '+data.google_review_count.toLocaleString('fr-FR')+' avis Google');review.className='naitea-review-score';
            const stars=text('span','★★★★★');stars.className='naitea-review-stars';stars.setAttribute('aria-hidden','true');stars.style.setProperty('--rating-width',(score/5*100)+'%');const googleIcon=document.createElement('img');googleIcon.className='naitea-google-icon';googleIcon.src='/assets/google-g.svg';googleIcon.alt='';googleIcon.width=18;googleIcon.height=18;review.prepend(googleIcon,stars,document.createTextNode(' '));
            const stamp=data.google_reviews_updated_at?new Date(data.google_reviews_updated_at).toLocaleDateString('fr-FR'):'';
            const note=text('small','Note déclarée par la professionnelle, non vérifiée par Naïtéa.'+(stamp?' Mise à jour le '+stamp+'.':''));note.className='naitea-review-note';
            details.append(review,note);
          }
        }
        pro.replaceChildren(details);pro.hidden=false;
        if(!data.public_details_enabled)return;
        const result=await client.storage.from('naitea-professional-portraits').download(uid+'/profile.jpg');
        if(result.error||!result.data||result.data.type!=='image/jpeg'||result.data.size>COVER_LIMIT||version!==revision||!pro.isConnected)return;
        if(portraitPreviewUrl)URL.revokeObjectURL(portraitPreviewUrl);
        portraitPreviewUrl=URL.createObjectURL(result.data);
        const portrait=document.createElement('img');portrait.alt='Photo professionnelle';portrait.src=portraitPreviewUrl;pro.prepend(portrait);
      }catch{}
    })();
  }
  async function changeStatus(w,status){
    if(!publication||!ready||busy||uncertain||!owner||!d.isPage())return;
    if(status==='published'&&pendingOnline(w)){message='Les paiements en ligne sont en préparation. Ce brouillon est conservé ; choisis le paiement sur place pour le publier dès maintenant.';decorate();return;}
    if(status==='published'&&!complete(w)){message='Complète la date, la catégorie, le public et le lieu ou la visioconférence avant publication.';decorate();return;}
    if(status==='published'&&['online','choice','deposit'].includes(w.payment_mode)&&!window.confirm('Ce paiement est un test. Aucun argent réel ne sera débité. Ne partage le lien qu’avec les testeurs autorisés. Continuer ?'))return;
    if(!window.confirm(status==='published'?'Publier cet atelier ? Son titre, description, adresse de l’atelier, nom professionnel et photo seront accessibles sans compte. N’utilise aucune donnée privée de famille.':'Dépublier cet atelier ? Son lien ne sera plus accessible aux familles.'))return;
    const version=revision;busy=true;decorate();
    try{
      const result=await api('PATCH',{id:w.id,status},version);if(!result)return;
      const saved=result.workshops[0];if(!saved||saved.id!==w.id||saved.status!==status)throw Error('Publication non confirmée');
      rows=[saved,...rows.filter(r=>r.id!==saved.id)];message=status==='published'?'Atelier publié ! Son lien est prêt à être partagé.':'Atelier dépublié. Son lien public est désactivé.';
    }catch{if(version===revision){uncertain=true;message='Changement non confirmé. Actualise pour vérifier le statut avant de réessayer.';}}
    finally{if(version===revision){busy=false;decorate();}}
  }
  async function shareCatalog(){
    if(!publication||!ready||busy||!owner||!d.isPage())return;
    const version=revision;busy=true;decorate();
    try{
      const {data,error}=await client.rpc('naitea_ensure_my_workshop_catalog');
      if(version!==revision)return;
      if(error||typeof data!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data)||data.length>180)throw Error('Renseigne ton nom professionnel dans Mes informations publiques puis réessaie.');
      showShare(new URL('/ateliers/'+data,location.origin).href,'Mes ateliers',true);
    }catch(error){if(version===revision)message=error.message||'Lien indisponible.';}
    finally{if(version===revision){busy=false;decorate();}}
  }
  function shareWorkshop(w){
    if(!publication||w.status!=='published'||!ready||busy||!owner)return;
    showShare(shareURL(w),w.title,false);
  }
  function showShare(url,title,collective){
    const box=document.createElement('div');
    const label=text('label',collective?'Mon lien public permanent':'Lien public de ton atelier');label.htmlFor='naiteaPublishedLink';
    const field=document.createElement('input');field.id='naiteaPublishedLink';field.value=url;field.readOnly=true;field.setAttribute('value',url);
    const copy=text('button','Copier le lien');copy.id='naiteaPublishedCopy';copy.className='btn secondary';copy.type='button';
    const link=text('a','Voir la page publique');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='btn secondary';
    const share=text('button','Partager');share.id='naiteaPublishedShare';share.type='button';share.className='btn secondary';share.hidden=typeof navigator.share!=='function';
    const status=text('p','');status.id='naiteaPublishedStatus';status.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='eventactions';actions.append(copy,link,share);
    const embedURL=new URL(url);embedURL.searchParams.set('embed','1');
    const iframe='<iframe src="'+embedURL.href+'" title="'+(collective?'Mes ateliers Naïtéa':'Atelier Naïtéa')+'" width="100%" height="'+(collective?'1000':'900')+'" style="border:0" loading="lazy"></iframe>';
    const embedLabel=text('label','Code iframe pour ton site internet');embedLabel.htmlFor='naiteaPublishedIframe';
    const embedField=document.createElement('textarea');embedField.id='naiteaPublishedIframe';embedField.readOnly=true;embedField.rows=4;embedField.textContent=iframe;
    const embedCopy=text('button','Copier le code iframe');embedCopy.id='naiteaPublishedIframeCopy';embedCopy.type='button';embedCopy.className='btn secondary';
    box.append(label,field,actions,embedLabel,embedField,embedCopy,status,text('p','Les réservations et les paiements restent désactivés.'));
    d.showModal(collective?'Partager mes ateliers':'Partager cet atelier',collective?'Tous tes ateliers publiés sont mis à jour automatiquement sur ce lien et dans l’iframe.':'Copie le lien pour ton site, tes réseaux sociaux ou tes messages.',box.outerHTML);
    el('naiteaPublishedCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);el('naiteaPublishedStatus').textContent='Lien copié !';}catch{el('naiteaPublishedLink').select();el('naiteaPublishedStatus').textContent='Sélectionne et copie le lien.';}});
    el('naiteaPublishedIframeCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(iframe);el('naiteaPublishedStatus').textContent='Code iframe copié !';}catch{el('naiteaPublishedIframe').select();el('naiteaPublishedStatus').textContent='Sélectionne et copie le code.';}});
    el('naiteaPublishedShare').addEventListener('click',async()=>{try{await navigator.share({title,url});}catch{}});
  }
  async function editPublicProfile(){
    if(!ready||busy||!owner||!d.isPage())return;
    const version=revision,uid=owner;
    const keys='business_name,public_details_enabled,public_email,public_phone,public_website,public_google_url,google_place_id,google_reviews_visible,google_rating,google_review_count,google_reviews_updated_at';
    try{
      const {data,error}=await client.from('naitea_profiles').select(keys).eq('id',uid).single();
      if(error||!data||version!==revision||!d.isPage())throw Error('Profil indisponible');
      const box=document.createElement('div'),form=document.createElement('form');form.id='naiteaPublicProfileForm';
      function input(name,label,type,value,max){
        const l=text('label',label);l.htmlFor='publicProfile'+name;
        const i=document.createElement('input');i.id=l.htmlFor;i.name=name;i.type=type;i.maxLength=max;i.setAttribute('value',value||'');form.append(l,i);return i;
      }
      input('business_name','Nom professionnel','text',data.business_name,160);
      input('public_email','Email professionnel public','email',data.public_email,254);
      input('public_phone','Téléphone professionnel public','tel',data.public_phone,40);
      input('public_website','Site internet (https://)','url',data.public_website,500);
      input('public_google_url','Lien vers les avis Google (https://)','url',data.public_google_url,500);
      const reviewConsent=document.createElement('input');reviewConsent.type='checkbox';reviewConsent.id='publicProfileReviewsVisible';if(data.google_reviews_visible)reviewConsent.setAttribute('checked','');
      const reviewLabel=text('label',' Afficher ma note et mon nombre d’avis Google');reviewLabel.prepend(reviewConsent);form.append(reviewLabel);
      const rating=input('google_rating','Note moyenne sur 5','number',data.google_rating,5);rating.min='1';rating.max='5';rating.step='0.1';rating.setAttribute('min','1');rating.setAttribute('max','5');rating.setAttribute('step','0.1');
      const count=input('google_review_count','Nombre total d’avis','number',data.google_review_count,8);count.min='1';count.max='10000000';count.step='1';count.setAttribute('min','1');count.setAttribute('max','10000000');count.setAttribute('step','1');
      const googleHelp=text('p','Recopie les valeurs de ta fiche Google. Elles ne sont pas synchronisées ni vérifiées par Naïtéa. Pense à les vérifier chaque mois.'+(data.google_reviews_updated_at?' Dernière modification : '+new Date(data.google_reviews_updated_at).toLocaleDateString('fr-FR')+'.':''));googleHelp.className='fine';form.append(googleHelp);
      const label=text('label','Photo professionnelle');label.htmlFor='publicProfilePortrait';const file=document.createElement('input');file.type='file';file.id=label.htmlFor;file.accept='image/jpeg,image/png,image/webp';form.append(label,file);
      const remove=document.createElement('input');remove.type='checkbox';remove.id='publicProfileRemove';const rl=text('label','Retirer la photo professionnelle');rl.prepend(remove);form.append(rl);
      const consent=document.createElement('input');consent.type='checkbox';consent.id='publicProfileConsent';if(data.public_details_enabled)consent.setAttribute('checked','');
      const cl=text('label',' J’autorise l’affichage de ces coordonnées et de ma photo sur mes ateliers publiés.');cl.prepend(consent);form.append(cl);
      const submit=text('button','Enregistrer');submit.type='submit';submit.className='btn';const status=text('p','');status.id='publicProfileStatus';status.setAttribute('role','status');form.append(submit,status);box.append(form);
      d.showModal('Mes informations publiques','Ces champs sont facultatifs. Ils ne remplacent pas ton email de connexion.',box.outerHTML);
      const active=el('naiteaPublicProfileForm');
      active.addEventListener('submit',async e=>{
        e.preventDefault();e.stopImmediatePropagation();if(busy||version!==revision||owner!==uid)return;
        const st=el('publicProfileStatus'),fd=new FormData(active);
        const patch=Object.fromEntries(['business_name','public_email','public_phone','public_website','public_google_url'].map(k=>[k,String(fd.get(k)||'').trim()||null]));
        for(const k of ['public_website','public_google_url'])if(patch[k]){try{const u=new URL(patch[k]);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{st.textContent='Indique une adresse HTTPS valide.';return;}}
        if(patch.public_phone&&!/^[+0-9 ().-]+$/.test(patch.public_phone)){st.textContent='Vérifie le téléphone.';return;}
        const scoreRaw=String(fd.get('google_rating')||'').trim(),countRaw=String(fd.get('google_review_count')||'').trim();
        const score=scoreRaw===''?null:Number(scoreRaw),count=countRaw===''?null:Number(countRaw);
        patch.google_reviews_visible=el('publicProfileReviewsVisible').checked;
        if((score===null)!==(count===null)||(score!==null&&(!Number.isFinite(score)||score<1||score>5||Math.abs(score*10-Math.round(score*10))>1e-8||!Number.isInteger(count)||count<1||count>10000000))){st.textContent='Indique une note de 1 à 5 (une décimale maximum) et un nombre entier d’avis, ou laisse les deux champs vides.';return;}
        if(patch.google_reviews_visible&&(score===null||!patch.public_google_url||!/^https:\/\/(share\.google|maps\.app\.goo\.gl|g\.page|([a-z0-9-]+\.)*google\.(com|fr)|goo\.gl)(\/|$)/.test(patch.public_google_url))){st.textContent='Pour afficher les avis, renseigne une note, le nombre d’avis et un lien Google valide.';return;}
        patch.google_rating=score;patch.google_review_count=count;
        patch.public_details_enabled=el('publicProfileConsent').checked;
        const portrait=el('publicProfilePortrait').files[0],removePhoto=el('publicProfileRemove').checked;
        busy=true;for(const field of active.elements)field.disabled=true;st.textContent='Enregistrement…';
        try{
          const blob=portrait?await compressCover(portrait):null;
          if(version!==revision)return;
          const {data:session,error:authError}=await client.auth.getSession();if(version!==revision)return;
          if(authError||session?.session?.user?.id!==uid)throw Error('Reconnecte-toi.');
          const result=await client.from('naitea_profiles').update(patch).eq('id',uid).select(keys).single();
          if(version!==revision)return;if(result.error||!result.data)throw Error('Profil non confirmé.');
          const bucket=client.storage.from('naitea-professional-portraits');
          if(blob||removePhoto){const result=blob?await bucket.upload(uid+'/profile.jpg',blob,{upsert:true,contentType:'image/jpeg',cacheControl:'0'}):await bucket.remove([uid+'/profile.jpg']);if(version!==revision)return;if(result.error)throw Error('Coordonnées enregistrées, photo non confirmée. Réessaie.');}
          st.textContent='Informations enregistrées.';
        }catch(error){if(version===revision&&active.isConnected)st.textContent=error.message||'Enregistrement non confirmé.';}
        finally{if(version===revision){busy=false;for(const field of active.elements)field.disabled=false;}}
      });
    }catch{if(version===revision){message='Impossible de charger les informations publiques.';decorate();}}
  }
  function paintBookingCount(node,w){
    const n=bookingCounts.get(w.id),known=Number.isInteger(n)&&n>=0,capacity=w.capacity;
    const heading=document.createElement('div');heading.className='naitea-fill-heading';
    const value=text('strong',(known?n:'—')+' / '+capacity);value.className='naitea-fill-value';
    const label=text('span','places réservées');label.className='fine';
    const left=document.createElement('div');left.append(value,label);
    const right=text('span',known?(n>=capacity?'Complet':Math.max(0,capacity-n)+' place(s) libre(s)'):'À actualiser');right.className='naitea-fill-status';
    heading.append(left,right);
    const bar=document.createElement('progress');bar.className='naitea-fill-bar';bar.max=Math.max(1,capacity);if(known)bar.value=Math.min(n,capacity);bar.setAttribute('aria-label',known?n+' places réservées sur '+capacity:'Remplissage non chargé');
    const note=text('p',known?Math.min(100,Math.round(n/Math.max(1,capacity)*100))+' % rempli':'Compteur indisponible');note.className='fine naitea-fill-note';
    node.replaceChildren(heading,bar,note);
  }
  async function refreshBookingCounts(){
    if(!owner||!client||!ready||!publication)return;
    const version=revision,req=++countRequest,uid=owner,ids=rows.map(w=>w.id);
    if(!ids.length)return;
    try{
      const {data,error}=await client.rpc('naitea_my_workshop_booking_counts',{p_ids:ids});
      if(version!==revision||req!==countRequest||owner!==uid)return;
      if(error||!Array.isArray(data))throw Error();
      bookingCounts.clear();for(const b of data){const n=Number(b.confirmed_seats);if(ids.includes(b.workshop_id)&&Number.isSafeInteger(n)&&n>=0)bookingCounts.set(b.workshop_id,n);}
    }catch{if(version!==revision||req!==countRequest)return;bookingCounts.clear();}
    if(version!==revision||req!==countRequest||!d.isPage())return;
    for(const node of document.querySelectorAll('[data-naitea-fill]')){const w=rows.find(w=>w.id===node.dataset.naiteaFill);if(w)paintBookingCount(node,w);}
  }
  function manualForm(w,target,loadList,version,uid,prefill=null){
    const root=document.createElement('div');root.className='naitea-manual-booking';
    const start=button('+ Ajouter un inscrit',()=>{start.hidden=true;panel.hidden=false;search.focus();});start.className='btn';
    const panel=document.createElement('div');panel.className='naitea-manual-panel';panel.hidden=true;
    panel.append(text('h3','Ajouter un participant'),text('p','Mode test : utilise uniquement des coordonnées fictives. Pour un email réel de test, utilise l’adresse autorisée Naïtéa.'));
    const searchLabel=text('label','Rechercher dans mes familles');searchLabel.htmlFor='naitea-family-search';
    const search=document.createElement('input');search.id=searchLabel.htmlFor;search.placeholder='Nom, prénom ou email';search.maxLength=100;
    const found=document.createElement('div');found.setAttribute('role','status');
    const form=document.createElement('form');form.className='naitea-manual-form';
    const field=(label,name,type,max,required=false,placeholder='')=>{
      const wrap=document.createElement('label');wrap.className='field';wrap.append(text('span',label+(required?' *':'')));
      const input=document.createElement('input');input.name=name;input.type=type;if(max)input.maxLength=max;input.required=required;input.placeholder=placeholder;wrap.append(input);return wrap;
    };
    const grid=document.createElement('div');grid.className='naitea-manual-grid';
    grid.append(field('Prénom du parent','first_name','text',60,true),field('Nom du parent','last_name','text',59,true),field('Email','parent_email','email',254,true,'camille@example.invalid'),field('Téléphone','phone','tel',30,true,'06 00 00 00 00'));form.append(text('h4','Coordonnées'),grid,text('h4','Participants'));
    const toggle=(label,name,fields)=>{
      const wrap=document.createElement('label');wrap.className='checkline';
      const input=document.createElement('input');input.type='checkbox';input.name=name;input.value='yes';wrap.append(input,document.createTextNode(' '+label));
      const detail=document.createElement('fieldset');detail.className='naitea-manual-grid';detail.append(...fields);detail.hidden=true;detail.disabled=true;
      input.addEventListener('change',()=>{detail.hidden=!input.checked;detail.disabled=!input.checked;});
      form.append(wrap,detail);
    };
    toggle('Un co-parent participera-t-il ?','coparent',[field('Prénom du co-parent','coparent_first_name','text',100),field('Nom du co-parent','coparent_last_name','text',100)]);
    toggle('Un enfant sera-t-il présent ?','child',[field('Prénom de l’enfant','child_first_name','text',100),field('Âge de l’enfant','child_age','text',40,false,'Ex. 6 mois')]);
    const seatsLabel=document.createElement('label');seatsLabel.className='field';seatsLabel.append(text('span',w.pricing_unit==='duo'?'Nombre de places (duos) *':'Nombre de places (personnes) *'));
    const seats=document.createElement('select');seats.name='seats';seats.required=true;
    const count=bookingCounts.get(w.id),max=Math.min(10,Number.isInteger(count)?Math.max(0,w.capacity-count):w.capacity);
    for(let i=1;i<=max;i++){const opt=text('option',i+' place(s)');opt.value=String(i);seats.append(opt);}seatsLabel.append(seats);form.append(seatsLabel);
    const mailLabel=document.createElement('label');mailLabel.className='checkline';const mail=document.createElement('input');mail.type='checkbox';mail.name='send_email';mail.value='yes';mailLabel.append(mail,document.createTextNode(' Envoyer un email de confirmation (adresse de test uniquement)'));form.append(mailLabel);
    const status=text('p','');status.setAttribute('role','status');
    const key=crypto.randomUUID(),submit=text('button','Enregistrer l’inscription');submit.type='submit';submit.className='btn';submit.disabled=max===0;
    if(max===0)status.textContent='Atelier complet : aucune place disponible.';
    const back=button('Retour',()=>{panel.hidden=true;start.hidden=false;});
    const actions=document.createElement('div');actions.className='naitea-cancel-actions';actions.append(back,submit);form.append(status,actions);
    let searchRequest=0;
    const lookup=button('Rechercher',async()=>{
      const q=search.value.trim(),serial=++searchRequest;if(q.length<2){found.textContent='Saisis au moins deux caractères.';return;}
      found.textContent='Recherche…';
      try{
        const {data,error}=await client.rpc('naitea_search_my_booking_families',{p_query:q});
        if(serial!==searchRequest||version!==revision||uid!==owner||!panel.isConnected)return;
        if(error||!Array.isArray(data))throw Error();
        found.replaceChildren();
        if(!data.length){found.textContent='Aucune famille trouvée.';return;}
        for(const family of data){
          const item=button([family.parent_first_name,family.parent_last_name,family.parent_email].filter(Boolean).join(' · '),()=>{
            if(version!==revision||uid!==owner)return;
            for(const [field,property] of [['first_name','parent_first_name'],['last_name','parent_last_name'],['parent_email','parent_email'],['phone','parent_phone']])form.elements[field].value=family[property]||'';
            mail.checked=false;found.textContent='Coordonnées reprises. Vérifie les participants de ce nouvel atelier.';
          });item.className='btn secondary small';found.append(item);
        }
      }catch{if(serial===searchRequest&&panel.isConnected)found.textContent='Recherche indisponible.';}
    });
    const searchRow=document.createElement('div');searchRow.className='naitea-manual-search';searchRow.append(search,lookup);
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookup.click();}});
    panel.append(searchLabel,searchRow,found,text('p','Ou renseigne une nouvelle famille ci-dessous.'),form);
    let submitting=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(submitting||version!==revision||uid!==owner||!target.isConnected||max===0)return;
      const payload=new URLSearchParams(new FormData(form));payload.set('workshop_id',w.id);payload.set('request_key',key);
      submitting=true;for(const node of form.elements)node.disabled=true;lookup.disabled=true;status.textContent='Enregistrement…';
      try{
        const {data,error}=await client.auth.getSession();
        if(version!==revision||uid!==owner||!target.isConnected)return;
        if(error||data?.session?.user?.id!==uid||!data.session.access_token)throw Error();
        const response=await fetch('/api/manual-bookings',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token},body:payload});
        const result=await response.json();if(version!==revision||uid!==owner||!target.isConnected)return;
        if(response.ok&&result.code==='CONFIRMED'){
          const notice=result.mail==='accepted'?'Inscription ajoutée. Email de confirmation envoyé.':result.mail==='failed'?'Inscription ajoutée. Envoi de l’email non confirmé : ne crée pas de doublon.':'Inscription ajoutée, sans envoi d’email.';
          await loadList(notice);return;
        }
        if(['ALREADY_REQUESTED','FULL','WORKSHOP_UNAVAILABLE','NOT_CONFIRMED'].includes(result.code)){
          const notice={ALREADY_REQUESTED:'Une demande existe déjà pour cette adresse et cet atelier. Aucune nouvelle inscription ajoutée.',FULL:'Atelier complet. Aucune nouvelle place réservée.',WORKSHOP_UNAVAILABLE:'Atelier indisponible.',NOT_CONFIRMED:'Enregistrement non confirmé. Vérifie la liste avant de réessayer.'}[result.code];
          await loadList(notice);return;
        }
        status.textContent=({TEST_EMAIL_ONLY:'Utilise contact@naitea.fr ou une adresse fictive se terminant par @example.invalid.',TEST_MAIL_ONLY:'Décoche l’envoi d’email pour une adresse fictive.',INVALID_REQUEST:'Vérifie les coordonnées et le téléphone.',RATE_LIMIT:'Limite de test atteinte pour cette adresse.',AUTH_REQUIRED:'Reconnecte-toi.'})[result.code]||'Inscription non enregistrée. Vérifie la liste avant de réessayer.';
      }catch{if(target.isConnected){await loadList('Enregistrement non confirmé. Vérifie la liste avant de réessayer.');return;}}
      finally{if(form.isConnected){submitting=false;for(const node of form.elements)node.disabled=false;for(const fieldset of form.querySelectorAll('fieldset'))fieldset.disabled=fieldset.hidden;lookup.disabled=false;}}
    });
    if(prefill){start.hidden=true;panel.hidden=false;for(const [field,property] of [['first_name','first_name'],['last_name','last_name'],['parent_email','email'],['phone','phone']])form.elements[field].value=prefill[property]||'';found.textContent='Coordonnées reprises depuis la fiche famille. Vérifie les participants avant de confirmer.';}
    root.append(start,panel);return root;
  }
  function waitingGroup(w,entries,target,loadList,version,uid){
    const section=document.createElement('section');section.className='naitea-booking-group naitea-waiting-group';
    section.append(text('h3','Liste d’attente ('+entries.length+')'),text('p','Demandes par ordre d’arrivée. Les familles en attente ne réservent aucune place.'));
    if(!entries.length){section.append(text('p','Aucune famille en attente.'));return section;}
    for(const [index,b] of entries.entries()){
      const card=document.createElement('div');card.className='card naitea-booking-entry';
      card.append(text('strong',(index+1)+'. '+b.parent_first_name+' '+b.parent_last_name),text('p',b.parent_email),text('p','Téléphone : '+b.parent_phone),text('p',b.seats+' place(s) demandée(s) · '+new Date(b.created_at).toLocaleString('fr-FR')));
      if(b.details?.coparent)card.append(text('p','Co-parent : '+([b.details.coparent_first_name,b.details.coparent_last_name].filter(Boolean).join(' ')||'Présent')));
      if(b.details?.child)card.append(text('p','Enfant : '+([b.details.child_first_name,b.details.child_age].filter(Boolean).join(' · ')||'Présent')));
      const status=text('p','');status.setAttribute('role','status');
      const actions=document.createElement('div');actions.className='naitea-cancel-actions';
      const run=async action=>{
        if(version!==revision||uid!==owner||!target.isConnected)return;
        if(!window.confirm(action==='promote'?'As-tu obtenu l’accord de la famille pour confirmer sa réservation ? Les places demandées seront décomptées, et un email sera envoyé à l’adresse de test autorisée.':'Retirer cette famille de la liste d’attente ? Aucun email automatique ne sera envoyé.'))return;
        promote.disabled=true;withdraw.disabled=true;status.textContent='Enregistrement…';
        try{
          const {data,error}=await client.auth.getSession();if(version!==revision||uid!==owner||!target.isConnected)return;if(error||data?.session?.user?.id!==uid||!data.session.access_token)throw Error();
          const r=await fetch('/api/waitlist',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token},body:new URLSearchParams({id:b.id,action})});
          const result=await r.json();if(version!==revision||uid!==owner||!target.isConnected)return;
          const notice=result.code==='CONFIRMED'?(result.mail==='accepted'?'Inscription confirmée et email envoyé.':'Inscription confirmée. Email non envoyé ou non confirmé : contacte la famille.'):result.code==='WITHDRAWN'?'Demande retirée de la liste d’attente.':({FULL:'Pas assez de places. La famille reste en attente.',ALREADY_REQUESTED:'Une réservation existe déjà. Vérifie les inscriptions.',ALREADY_RESOLVED:'Cette demande a déjà été traitée.',WORKSHOP_UNAVAILABLE:'Atelier indisponible.',RATE_LIMIT:'Limite de test atteinte.'}[result.code]||'Action non confirmée. Vérifie les inscriptions.');
          await loadList(notice);
        }catch{if(target.isConnected)await loadList('Action non confirmée. Vérifie les inscriptions avant de réessayer.');}
      };
      const promote=button('Confirmer l’inscription',()=>run('promote'));promote.className='btn';
      const count=bookingCounts.get(w.id);promote.disabled=['online','deposit'].includes(w.payment_mode)||w.status!=='published'||Date.parse(w.starts_at)<=Date.now()||Number.isInteger(count)&&w.capacity-count<b.seats;
      if(['online','deposit'].includes(w.payment_mode))card.append(text('p','Paiement requis : invite la famille à réserver depuis le lien public lorsqu’une place se libère.'));
      const withdraw=button('Retirer de la liste',()=>run('withdraw'));actions.append(promote,withdraw);
      card.append(status,actions);section.append(card);
    }
    return section;
  }
  function cancellationNotice(result){
    let msg='Annulation enregistrée.';
    if(result.accepted)msg+=' '+result.accepted+' email(s) accepté(s) par le service d’envoi.';
    if(result.failed)msg+=' '+result.failed+' email(s) dont l’envoi n’a pas été confirmé : contacte les familles directement.';
    if(result.skipped)msg+=' '+result.skipped+' demande(s) sans envoi automatique (adresse fictive ou non autorisée dans la bêta).';
    if(result.pending)msg+=' '+result.pending+' réservation(s) en attente de validation clôturée(s) sans email.';
    if(result.unrecorded)msg+=' Le statut de certains emails n’a pas pu être enregistré.';
    return msg;
  }
  const cancellationEmailLabel=state=>({accepted:'Email d’annulation : accepté par le service d’envoi',failed:'Email d’annulation : envoi non confirmé — contacte la famille',skipped:'Email d’annulation : non envoyé (mode test)',pending:'Email d’annulation : statut à vérifier',null:'Email d’annulation : non enregistré'}[state??'null']||'Email d’annulation : statut indisponible');
  async function cancelRequest(scope,id,reason,version,uid){
    const {data,error}=await client.auth.getSession();
    if(version!==revision||uid!==owner||error||data?.session?.user?.id!==uid||!data.session.access_token)throw Error('Session expirée.');
    const response=await fetch('/api/cancellations',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token},body:new URLSearchParams({scope,id,reason})});
    const result=await response.json();
    if(!response.ok||result.code!=='CANCELLED')throw Error('Annulation non confirmée.');
    return result;
  }
  function cancelWorkshop(w){
    if(!ready||busy||uncertain||!owner||!manualEnabled||!d.isPage())return;
    const version=revision,uid=owner;
    const shell=document.createElement('div');shell.id='naiteaPrivateBookings';
    d.showModal('Annuler cet atelier','Toutes les réservations seront annulées et la liste d’attente sera clôturée.',shell.outerHTML);
    const target=el('naiteaPrivateBookings');if(!target)return;
    const panel=document.createElement('div');panel.className='naitea-cancel-box';
    panel.append(text('h3',w.title),text('p','Cette action retire l’atelier de la réservation en ligne et ne peut pas être annulée. Les familles inscrites et en attente seront informées si leur adresse est autorisée dans le mode test. Aucun remboursement automatique.'));
    const label=text('label','Motif communiqué aux familles *');label.htmlFor='naiteaWorkshopCancelReason';
    const reason=document.createElement('textarea');reason.id=label.htmlFor;reason.maxLength=250;reason.rows=3;reason.placeholder='Ex. L’atelier ne pourra pas être maintenu.';
    const caution=text('p','Le motif apparaîtra dans l’email. N’y indique aucune information personnelle ou médicale.');caution.className='fine';
    const status=text('p','');status.setAttribute('role','status');
    const back=button('Retour',()=>d.closeModal());
    const submit=button('Confirmer l’annulation de l’atelier',async()=>{
      if(!reason.value.trim()){status.textContent='Merci de renseigner le motif.';return;}
      if(version!==revision||uid!==owner||!target.isConnected||busy)return;
      if(!window.confirm('Annuler définitivement cet atelier et toutes ses inscriptions ?'))return;
      busy=true;for(const node of [reason,back,submit])node.disabled=true;status.textContent='Annulation et notifications en cours…';
      try{
        const result=await cancelRequest('workshop',w.id,reason.value.trim(),version,uid);
        if(version!==revision||uid!==owner)return;
        await load();
        if(owner===uid&&ready&&d.isPage()){message=cancellationNotice(result)+' '+result.bookings+' inscription(s) annulée(s), '+result.waiting+' demande(s) en attente clôturée(s).';decorate();}
      }catch{
        if(version!==revision||uid!==owner)return;
        busy=false;uncertain=true;message='Annulation non confirmée. Actualise la liste avant toute autre action.';if(target.isConnected){status.textContent=message;back.disabled=false;}decorate();
      }
    });submit.className='btn naitea-cancel-danger';
    const actions=document.createElement('div');actions.className='naitea-cancel-actions';actions.append(back,submit);panel.append(label,reason,caution,status,actions);target.append(panel);reason.focus();
  }
  async function showBookings(w,prefill=null){
    if(!ready||busy||!owner||!d.isPage())return;
    const version=revision,uid=owner;
    const root=document.createElement('div');root.id='naiteaPrivateBookings';root.append(text('p','Chargement des inscriptions…'));
    d.showModal('Inscriptions · '+w.title,'Retrouve tes inscriptions confirmées et l’historique des annulations.',root.outerHTML);
    const target=el('naiteaPrivateBookings');
    const loadList=async(notice='',paymentNotice=false,resumeTestUrl=null,expireTestId=null)=>{
      try{
        const {data,error}=await client.from('naitea_bookings').select('id,workshop_id,parent_name,parent_email,seats,status,confirmed_at,parent_first_name,parent_last_name,parent_phone,coparent_present,coparent_first_name,coparent_last_name,child_present,child_first_name,child_age,newsletter_requested_at,confirmation_mode,cancellation_reason,cancelled_at,booking_source,cancellation_email_status,payment_status,amount_paid_cents,balance_due_cents').eq('workshop_id',w.id).order('confirmed_at',{ascending:false}).limit(1001);
        if(version!==revision||owner!==uid||!target.isConnected)return;
        if(error||!Array.isArray(data))throw Error('Chargement impossible');
        let waiting=[],closedWaiting=[],waitingError=false;
        if(manualEnabled){try{const result=await client.from('naitea_workshop_waitlist').select('id,parent_first_name,parent_last_name,parent_email,parent_phone,seats,details,created_at').eq('workshop_id',w.id).eq('status','waiting').order('created_at',{ascending:true}).order('id',{ascending:true}).limit(1000);if(result.error||!Array.isArray(result.data))throw Error();waiting=result.data;const closed=await client.from('naitea_workshop_waitlist').select('id,parent_first_name,parent_last_name,seats,resolved_at,cancellation_reason,cancellation_email_status').eq('workshop_id',w.id).eq('status','withdrawn').not('cancellation_reason','is',null).order('resolved_at',{ascending:false}).limit(1000);if(closed.error||!Array.isArray(closed.data))throw Error();closedWaiting=closed.data;}catch{waitingError=true;}}
        await refreshBookingCounts();
        if(version!==revision||owner!==uid||!target.isConnected)return;
        target.replaceChildren();
        const summary=document.createElement('div');summary.className='naitea-fill';summary.dataset.naiteaFill=w.id;paintBookingCount(summary,w);target.append(summary);
        if(notice&&!paymentNotice){const n=text('p',notice);n.setAttribute('role','status');target.append(n);}
        if(checkoutConfigured&&['online','choice','deposit'].includes(w.payment_mode)){
          const paymentPanel=document.createElement('section');paymentPanel.className='card naitea-booking-group';paymentPanel.append(text('h3','Paiements Stripe (test)'),text('p','Vérifie les paiements en attente, même si la famille a fermé sa page de réservation. Aucun nouveau débit.'));
          const syncAction=async(expireId=null)=>{
            sync.disabled=true;sync.textContent='Vérification en cours…';
            try{
              const {data,error}=await client.auth.getSession();if(version!==revision||owner!==uid||!target.isConnected)return;if(error||data?.session?.user?.id!==uid||!data.session.access_token)throw Error();
              const response=await fetch('/api/workshop-payment-sync',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({workshop_id:w.id,...(expireId?{expire_test_booking_id:expireId}:{})})});
              const result=await response.json();if(!response.ok)throw Error();if(version!==revision||owner!==uid||!target.isConnected)return;
              const count=result.paid+result.pending+result.expired+result.failed+result.errors;
              const notice=count===0?'Aucun paiement en attente à synchroniser.':result.paid+' paiement(s) confirmé(s) · '+result.pending+' en attente · '+(result.expired+result.failed)+' non finalisé(s)'+(result.errors?' · '+result.errors+' vérification(s) non aboutie(s)':'')+(result.more?' · D’autres paiements restent à vérifier.':'');
              const labels={session_missing:'Session Stripe non associée. Ne refais pas de paiement.',checkout_open:'Stripe indique que le paiement n’a pas été finalisé (session encore ouverte).',payment_processing:'Stripe traite encore le règlement.',stripe_pending:'Stripe n’a pas confirmé le règlement.',stripe_unavailable:'Impossible de consulter la session Stripe.',session_mismatch:'La session Stripe ne correspond pas à la réservation.',settlement_unavailable:'Règlement vérifié mais enregistrement indisponible.',settlement_conflict:'Le règlement vérifié ne peut pas encore être enregistré.',verification_unavailable:'Vérification indisponible.'};
              const details=Object.entries(result.diagnostics||{}).filter(([k,v])=>Object.hasOwn(labels,k)&&Number.isInteger(v)&&v>0).map(([k,v])=>v+' × '+labels[k]).join(' ');
              await loadList(notice+(details?' — '+details:''),true,result.resume_test_url,result.expire_test_booking_id);
            }catch{if(version===revision&&owner===uid&&target.isConnected)await loadList('Synchronisation non confirmée. Réessaie sans refaire de paiement.',true);}
          };const sync=button('Synchroniser les paiements Stripe',()=>syncAction());sync.className='btn';paymentPanel.append(sync);if(notice&&paymentNotice){const n=text('p',notice);n.setAttribute('role','status');paymentPanel.append(n);}
          if(typeof resumeTestUrl==='string'){try{const url=new URL(resumeTestUrl);if(url.origin==='https://checkout.stripe.com'&&!url.username&&!url.password&&/^\/(?:c\/)?pay\/cs_test_[A-Za-z0-9_]+$/.test(url.pathname)){const link=text('a','Reprendre le paiement de test');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='btn secondary';paymentPanel.append(link,text('p','Rouvre uniquement la session existante. Aucun nouveau paiement n’est créé.'));}}catch{}}
          if(typeof expireTestId==='string'&&/^[a-f0-9-]{36}$/i.test(expireTestId)){const abandon=button('Abandonner ce paiement de test',async()=>{if(!window.confirm('Fermer définitivement cette session Stripe non payée et libérer la place ? Aucun remboursement ni nouveau débit.'))return;abandon.disabled=true;await syncAction(expireTestId);});abandon.className='btn secondary';paymentPanel.append(abandon,text('p','Si tu ne peux pas reprendre le paiement, ferme la session existante avant de recommencer.'));}
          target.append(paymentPanel);
        }
        if(manualEnabled&&!['online','deposit'].includes(w.payment_mode)&&w.status==='published'&&Date.parse(w.starts_at)>Date.now()){target.append(manualForm(w,target,loadList,version,uid,prefill));prefill=null;}
        const confirmed=data.slice(0,1000).filter(b=>b.status==='confirmed'),cancelled=data.slice(0,1000).filter(b=>b.status==='cancelled');
        const group=(label,items,empty)=>{const section=document.createElement('section');section.className='naitea-booking-group';section.append(text('h3',label+' ('+items.length+(data.length>1000?'+':'')+')'));if(!items.length)section.append(text('p',empty));return section;};
        const active=group('Inscriptions confirmées',confirmed,'Aucune inscription confirmée.');
        const history=group('Inscriptions annulées',cancelled,'Aucune inscription annulée.');
        for(const b of [...confirmed,...cancelled]){
          const card=document.createElement('div');card.className='card naitea-booking-entry'+(b.status==='cancelled'?' is-cancelled':'');card.append(text('strong',b.parent_name),text('p',b.parent_email),text('p',b.seats+' place(s) · '+(b.status==='confirmed'?'Confirmée':'Annulée')));
          if(b.payment_status==='paid'){const euros=c=>(c/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});card.append(text('p',(b.balance_due_cents>0?'Acompte payé (test) · ':'Payé en ligne (test) · ')+euros(b.amount_paid_cents)));if(b.balance_due_cents>0)card.append(text('p','Reste à régler sur place : '+euros(b.balance_due_cents)));}else if(b.status==='confirmed'&&w.price_cents>0)card.append(text('p','Règlement sur place · Paiement non vérifié en ligne'));
          if(b.booking_source==='manual')card.append(text('p','Ajout manuel par la professionnelle'));
          if(b.parent_phone)card.append(text('p','Téléphone : '+b.parent_phone));
          if(b.coparent_present)card.append(text('p','Co-parent : '+([b.coparent_first_name,b.coparent_last_name].filter(Boolean).join(' ')||'Présent')));
          if(b.child_present)card.append(text('p','Enfant : '+([b.child_first_name,b.child_age].filter(Boolean).join(' · ')||'Présent')));
          card.append(text('p',b.confirmation_mode==='instant'?'Adresse email déclarée (non vérifiée)':'Adresse email confirmée par lien'));
          card.append(text('p',b.newsletter_requested_at?(b.confirmation_mode==='instant'?'Actualités : accord déclaré (email non vérifié)':'Actualités : accord donné lors de l’inscription'):'Actualités : aucun accord enregistré'));
          if(b.status==='cancelled'){
            const reason=text('p','Motif : '+(b.cancellation_reason||'Non renseigné (ancienne annulation)'));reason.className='naitea-cancel-reason';card.append(reason);
            if(b.cancelled_at)card.append(text('p','Annulée le '+new Date(b.cancelled_at).toLocaleString('fr-FR')));
            card.append(text('p',cancellationEmailLabel(b.cancellation_email_status)));
            history.append(card);continue;
          }
          if(manualEnabled&&b.booking_source==='manual'){
            const edit=button('Modifier les coordonnées',()=>{
              if(card.querySelector('.naitea-edit-contact'))return;
              edit.hidden=true;
              const form=document.createElement('form');form.className='naitea-manual-panel naitea-edit-contact';
              const grid=document.createElement('div');grid.className='naitea-manual-grid';
              for(const [name,label,type,max,value] of [['first_name','Prénom','text',60,b.parent_first_name],['last_name','Nom','text',59,b.parent_last_name],['parent_email','Email','email',254,b.parent_email],['phone','Téléphone','tel',30,b.parent_phone]]){
                const wrap=document.createElement('label');wrap.className='field';wrap.append(text('span',label+' *'));const input=document.createElement('input');input.name=name;input.type=type;input.maxLength=max;input.required=true;input.value=value||'';wrap.append(input);grid.append(wrap);
              }
              const status=text('p','');status.setAttribute('role','status');const back=button('Retour',()=>{form.remove();edit.hidden=false;});const save=text('button','Enregistrer les modifications');save.type='submit';save.className='btn';
              const actions=document.createElement('div');actions.className='naitea-cancel-actions';actions.append(back,save);form.append(grid,text('p','Les places et le statut ne changent pas. Aucun nouvel email automatique.'),status,actions);
              form.addEventListener('submit',async event=>{
                event.preventDefault();event.stopImmediatePropagation();
                if(version!==revision||owner!==uid||!target.isConnected||save.disabled)return;
                const payload=new URLSearchParams(new FormData(form));payload.set('booking_id',b.id);payload.set('action','edit');
                for(const input of form.elements)input.disabled=true;status.textContent='Enregistrement…';
                try{
                  const {data,error}=await client.auth.getSession();if(version!==revision||owner!==uid||!target.isConnected)return;if(error||data?.session?.user?.id!==uid||!data.session.access_token)throw Error();
                  const response=await fetch('/api/manual-bookings',{method:'POST',credentials:'omit',cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token},body:payload});
                  const result=await response.json();if(version!==revision||owner!==uid||!target.isConnected)return;
                  if(response.ok&&result.code==='UPDATED'){await loadList('Coordonnées mises à jour.');return;}
                  status.textContent=({DUPLICATE:'Cette adresse est déjà utilisée pour cet atelier.',TEST_EMAIL_ONLY:'Utilise contact@naitea.fr ou une adresse @example.invalid.',INVALID_REQUEST:'Vérifie les coordonnées.',UNAVAILABLE:'Cette inscription ne peut plus être modifiée.'})[result.code]||'Modification non confirmée. Actualise avant de réessayer.';
                }catch{if(target.isConnected)await loadList('Modification non confirmée. Vérifie les coordonnées.');}
                finally{if(form.isConnected)for(const input of form.elements)input.disabled=false;}
              });card.append(form);form.elements.first_name.focus();
            });card.append(edit);
          }
          const cancel=button('Annuler cette inscription',()=>{
            if(card.querySelector('.naitea-cancel-box'))return;cancel.hidden=true;
            const panel=document.createElement('div');panel.className='naitea-cancel-box';
            const label=text('label','Motif de l’annulation *');label.htmlFor='reason-'+b.id;
            const select=document.createElement('select');select.id=label.htmlFor;
            for(const reason of ['','Demande de la famille','Indisponibilité de la professionnelle','Report de l’atelier','Erreur ou doublon d’inscription','Autre']){const opt=text('option',reason||'Choisir un motif');opt.value=reason;select.append(opt);}
            const other=document.createElement('input');other.placeholder='Préciser le motif (sans information sensible)';other.maxLength=200;other.hidden=true;other.setAttribute('aria-label','Autre motif');
            select.addEventListener('change',()=>{other.hidden=select.value!=='Autre';});
            const warning=text('p','La place sera libérée. Le motif sera communiqué par email à l’adresse de test autorisée. N’indique aucune information personnelle ou médicale.');warning.className='fine';
            const status=text('p','');status.setAttribute('role','status');
            const back=button('Retour',()=>{panel.remove();cancel.hidden=false;});
            const submit=button('Confirmer l’annulation',async()=>{
              const reason=select.value==='Autre'?other.value.trim():select.value;
              if(!reason){status.textContent='Merci de renseigner le motif.';return;}
              if(version!==revision||owner!==uid||!target.isConnected)return;
              for(const node of [select,other,back,submit])node.disabled=true;
              try{if(!manualEnabled)throw Error();const r=await cancelRequest('booking',b.id,reason,version,uid);if(version!==revision||owner!==uid||!target.isConnected)return;await loadList(cancellationNotice(r));}
              catch{if(target.isConnected){status.textContent='Annulation non confirmée. Actualise avant de réessayer.';back.disabled=false;}}
            });submit.className='btn';
            const buttons=document.createElement('div');buttons.className='naitea-cancel-actions';buttons.append(back,submit);panel.append(label,select,other,warning,status,buttons);card.append(panel);select.focus();
          });if(manualEnabled&&b.payment_status!=='paid')card.append(cancel);else if(b.payment_status==='paid')card.append(text('p','Annulation et remboursement : non disponibles dans cette phase de test.'));active.append(card);
        }
        target.append(active);
        if(manualEnabled){if(waitingError)target.append(text('p','Liste d’attente indisponible. Actualise pour réessayer.'));else target.append(waitingGroup(w,waiting,target,loadList,version,uid));}
        target.append(history);
        if(closedWaiting.length){const section=document.createElement('section');section.className='naitea-booking-group';section.append(text('h3','Demandes en attente clôturées ('+closedWaiting.length+')'));for(const b of closedWaiting){const card=document.createElement('div');card.className='card naitea-booking-entry is-cancelled';card.append(text('strong',b.parent_first_name+' '+b.parent_last_name),text('p',b.seats+' place(s) demandée(s) · Demande clôturée'),text('p','Motif : '+b.cancellation_reason),text('p',cancellationEmailLabel(b.cancellation_email_status)));section.append(card);}target.append(section);}
        if(data.length>1000)target.append(text('p','Liste limitée aux 1 000 premières inscriptions ; le compteur inclut toutes les inscriptions.'));
      }catch{if(version===revision&&target.isConnected)target.replaceChildren(text('p','Impossible de charger les inscriptions. Réessaie.'));}
    };
    await loadList();
  }
  function workshopCard(w){
    const card=document.createElement('article');card.className='card eventcard naitea-private-eventcard';
    const content=document.createElement('div');content.className='eventcontent';
    const headline=text('h3',w.title);headline.className='eventtitle';
    const date=w.starts_at?new Date(w.starts_at).toLocaleString('fr-FR'):'Date à préciser';
    content.append(headline,text('p',[w.category,date,w.capacity+' places',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+(w.pricing_unit==='duo'?' / duo parent-enfant':' / personne')].filter(Boolean).join(' · ')),text('p',w.status==='draft'?'Brouillon privé':w.status==='published'?'Publié':'Annulé'));
    const actions=document.createElement('div');actions.className='eventactions';
    if(w.status==='draft'){const edit=button('Modifier',()=>open(w));edit.disabled=!ready||busy||uncertain;actions.append(edit);}
    if(publication&&['draft','published'].includes(w.status)){
      const preview=button('Aperçu',()=>previewWorkshop(w));preview.disabled=!ready||busy;actions.append(preview);
      const publish=button(w.status==='draft'?'Publier':'Dépublier',()=>changeStatus(w,w.status==='draft'?'published':'draft'));publish.disabled=!ready||busy||uncertain;
      if(w.status==='draft')publish.className='btn';
      actions.append(publish);
      content.append(text('p',paymentLabel(w)+(pendingOnline(w)?' · En préparation, brouillon uniquement':'')));
    if(w.status==='published'){const share=button('Partager',()=>shareWorkshop(w));share.disabled=!ready||busy||uncertain;actions.append(share);content.append(text('p','Pour modifier un atelier publié, repasse-le en brouillon.'));}
    }
    if(w.status==='cancelled'&&w.cancellation_reason){content.append(text('p','Motif : '+w.cancellation_reason));if(w.cancelled_at)content.append(text('p','Annulé le '+new Date(w.cancelled_at).toLocaleString('fr-FR')));}
    if(manualEnabled&&['published','draft'].includes(w.status)&&Date.parse(w.starts_at)>Date.now()){const reminder=button('Rappels',()=>editReminders(w));reminder.disabled=busy||uncertain;actions.append(reminder);content.append(text('p',w.reminder_hours?.length?'Rappels : '+w.reminder_hours.slice().sort((a,b)=>b-a).map(h=>h+' h').join(' · ')+' avant l’atelier':'Rappels désactivés'));}
    if(manualEnabled&&['published','draft'].includes(w.status)&&Date.parse(w.starts_at)>Date.now()){const cancel=button('Annuler l’atelier',()=>cancelWorkshop(w));cancel.className='btn secondary small naitea-cancel-danger';cancel.disabled=busy||uncertain;actions.append(cancel);}
    if(ready&&publication){const bookings=button('Inscriptions',()=>showBookings(w));bookings.disabled=busy||uncertain;actions.append(bookings);}
    if(publication){const fill=document.createElement('div');fill.className='naitea-fill';fill.dataset.naiteaFill=w.id;paintBookingCount(fill,w);content.append(fill);}
    content.append(actions);
    if(knownCovers.has(w.id)){
      const img=document.createElement('img');img.className='v6-cover naitea-private-card-cover';img.alt='Photo de couverture de '+w.title;img.hidden=true;
      card.append(img);attachCover(w,img);
    }
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
    notice.textContent=(message||'Vérification de la connexion…')+' Rendez-vous et contacts disponibles dans leurs rubriques.'+(truncated?' Seuls les 100 ateliers les plus récents sont chargés.':'');
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
      metrics.replaceChildren(metric('Ateliers à venir',ready?(truncated?'≥ ':'')+upcoming.length:'—',ready?'Brouillons et ateliers publiés':'Non chargé',true),metric('Inscriptions','—','Bientôt disponible',false),metric('Contacts','—','Bientôt disponible',false),metric('Abonnements newsletter','—','Bientôt disponible',false));
    }
    const program=app.querySelector('.dashboard-program .events');
    if(program){
      program.replaceChildren();
      if(ready&&upcoming.length){for(const w of upcoming.slice(0,2))program.append(workshopCard(w));}
      else{const empty=text('p',ready?'Aucun atelier à venir.':'Tes ateliers apparaîtront après connexion et chargement.');empty.className='card empty';program.append(empty);}
    }
    const activity=app.querySelector('.dashboard-activity');
    if(activity){
      const title=text('h2','Activité récente'), heading=document.createElement('div');heading.className='sectionhead';heading.append(title);
      const list=document.createElement('div');list.className='card list';
      const recent=ready?rows.filter(w=>['draft','published'].includes(w.status)&&w.created_at&&Number.isFinite(Date.parse(w.created_at))).slice().sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,4):[];
      for(const w of recent){const line=document.createElement('div');line.className='activity';const body=document.createElement('div');body.append(text('strong','Atelier créé : '+w.title),text('p',new Date(w.created_at).toLocaleString('fr-FR')));line.append(body);list.append(line);}
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
          item.className='v8-cal-item workshop';item.title=w.title+' · '+(w.status==='published'?'Publié':'Brouillon privé');item.setAttribute('aria-label',item.title+' '+localDate(w.starts_at).slice(11));item.disabled=busy||uncertain;cell.append(item);
        }
        if(!items.length&&view==='day')cell.append(text('p',ready?'Aucun atelier enregistré ce jour.':'Agenda non chargé.'));
      });
      const legend=calendar.querySelector(':scope > p.fine');if(legend)legend.textContent='Corail : ateliers privés et publiés · Vert : rendez-vous individuels.';
      const hint=calendar.querySelector('.v8-calendar-mobile-hint');if(hint)hint.textContent='Sélectionne un atelier ou un rendez-vous. Les dates utilisent le fuseau de ton appareil.';
      if(ready&&owner&&dates.length===cells.length&&dates.length){const version=revision,uid=owner;const marker=Symbol();calendar._naiteaAppointmentMarker=marker;client.rpc('naitea_my_agenda',{p_day:dates[0],p_days:dates.length}).then(r=>{if(version!==revision||uid!==owner||!d.isPage()||d.page()!=='dashboard'||!calendar.isConnected||calendar._naiteaAppointmentMarker!==marker)return;if(r.error||!Array.isArray(r.data?.appointments)){if(legend)legend.textContent+=' Rendez-vous indisponibles : actualise.';return;}cells.forEach((cell,i)=>{for(const a of r.data.appointments.filter(x=>x.status==='confirmed'&&localDate(x.starts_at).slice(0,10)===dates[i])){if(view==='day')cell.querySelectorAll(':scope > p').forEach(p=>p.remove());const item=button(localDate(a.starts_at).slice(11)+' · '+a.title,()=>d.goAppointments(dates[i]));item.className='v8-cal-item appointment';item.title=a.title;cell.append(item);}});}).catch(()=>{if(calendar.isConnected&&calendar._naiteaAppointmentMarker===marker&&legend)legend.textContent+=' Rendez-vous indisponibles : actualise.';});}
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
    if(publication){const pro=button('Mes informations publiques',editPublicProfile);pro.disabled=!ready||busy;const shareAll=button('Partager mes ateliers',shareCatalog);shareAll.disabled=!ready||busy||uncertain;panel.append(pro,shareAll);}
    if(!owner){const login=text('a','Me connecter');login.href='/connexion.html?mode=login';login.className='btn secondary';panel.append(login);}
    if(ready&&!rows.length)panel.append(text('p','Tu n’as pas encore d’atelier enregistré.'));
    const grid=document.createElement('div');grid.className='events';
    for(const w of rows)grid.append(workshopCard(w));
    panel.append(grid);if(truncated)panel.append(text('p','100 ateliers les plus récents affichés.'));
    panel.append(text('p','Le tableau de bord et le calendrier utilisent aussi tes ateliers. Les compteurs affichent les places confirmées, hors inscriptions annulées.'));
    app.replaceChildren(panel);
  }
  async function start(){
    try{
      const response=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});
      if(!response.ok)return;
      const flags=await response.json();if(!flags.workshopPersistence)return;
      publication=flags.workshopPublication===true;manualEnabled=flags.realBookings===true;checkoutConfigured=flags.workshopCheckoutConfigured===true;
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
  window.addEventListener('focus',()=>{if(d.isPage())refreshBookingCounts();});
  window.addEventListener('pagehide',()=>{clear();if(enabled&&d.isPage())decorate();});
  window.addEventListener('pageshow',event=>{if(event.persisted&&client)load();});
  function openFamilyBooking(f,wid){
    const w=rows.find(r=>r.id===wid&&r.status==='published'&&Date.parse(r.starts_at)>Date.now());
    if(!manualEnabled||!ready||busy||uncertain||!owner||f.professional_id!==owner||!w)return false;
    d.goWorkshops();if(!d.isPage())return false;showBookings(w,f);return true;
  }
  return {start,decorate,openFamilyBooking};
}
const api={create,calendarDates,upcomingRows,rowsOnDate,coverPath,dimensions,cropRect,compressCover};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.NaiteaProWorkshops=api;
})(globalThis);
