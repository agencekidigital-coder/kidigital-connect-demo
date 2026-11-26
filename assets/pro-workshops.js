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
  let enabled=false, publication=false, owner=null, client=null, revision=0, rows=[], ready=false, busy=false, truncated=false, message='', observed=false, uncertain=false, controller=null, timer=null;
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
  function closePrivate(){revokePreview();if(el('naiteaPrivateWorkshopForm')||el('naiteaPrivatePublicPreviewCover')||el('naiteaPublishedLink')||el('naiteaPublicProfileForm')||el('naiteaPrivateBookings'))d.closeModal();}
  function clear(){revision++;controller?.abort();owner=null;rows=[];ready=false;busy=false;uncertain=false;truncated=false;resetCovers();closePrivate();}
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
      rows=result.workshops;truncated=result.truncated;ready=true;message='Tes ateliers sont enregistrés dans ton compte. Seuls les ateliers publiés sont accessibles aux familles.';
      try{await listCovers(version);}catch{if(version===revision)message+=' Photos indisponibles : actualise pour réessayer.';}
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
    form.querySelector('[type="submit"]').textContent='Enregistrer le brouillon';
    d.showModal(w?'Modifier mon atelier':'Créer un atelier','Les informations restent privées tant que la publication n’est pas ouverte.',container.innerHTML);
    const active=el('naiteaPrivateWorkshopForm');fields(active);
    active.addEventListener('change',()=>fields(active));
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
    const price=text('p',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+' / duo · '+w.capacity+' places au total');price.className='naitea-public-price';
    const professional=document.createElement('section');professional.className='naitea-public-pro';professional.id='naiteaPreviewProfessional';professional.hidden=true;
    body.append(tag,text('h1',w.title),professional,time,desc,text('p',location),audience,price);
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
    if(status==='published'&&!complete(w)){message='Complète la date, la catégorie, le public et le lieu ou la visioconférence avant publication.';decorate();return;}
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
  async function showBookings(w){
    if(!ready||busy||!owner||!d.isPage())return;
    const version=revision,uid=owner;
    const root=document.createElement('div');root.id='naiteaPrivateBookings';root.append(text('p','Chargement des inscriptions…'));
    d.showModal('Inscriptions · '+w.title,'Seules les inscriptions confirmées sont visibles.',root.outerHTML);
    const target=el('naiteaPrivateBookings');
    const loadList=async()=>{
      try{
        const {data,error}=await client.from('naitea_bookings').select('id,workshop_id,parent_name,parent_email,seats,status,confirmed_at,parent_first_name,parent_last_name,parent_phone,coparent_present,coparent_first_name,coparent_last_name,child_present,child_first_name,child_age,newsletter_requested_at,confirmation_mode').eq('workshop_id',w.id).order('confirmed_at',{ascending:false}).limit(1001);
        if(version!==revision||owner!==uid||!target.isConnected)return;
        if(error||!Array.isArray(data))throw Error('Chargement impossible');
        target.replaceChildren();
        const total=data.filter(b=>b.status==='confirmed').reduce((sum,b)=>sum+b.seats,0);
        target.append(text('h3',total+' place(s) confirmée(s) / '+w.capacity));
        if(!data.length)target.append(text('p','Aucune inscription confirmée.'));
        for(const b of data.slice(0,1000)){
          const card=document.createElement('div');card.className='card naitea-booking-entry';card.append(text('strong',b.parent_name),text('p',b.parent_email),text('p',b.seats+' place(s) · '+(b.status==='confirmed'?'Confirmée':'Annulée')));
          if(b.parent_phone)card.append(text('p','Téléphone : '+b.parent_phone));
          if(b.coparent_present)card.append(text('p','Co-parent : '+([b.coparent_first_name,b.coparent_last_name].filter(Boolean).join(' ')||'Présent')));
          if(b.child_present)card.append(text('p','Enfant : '+([b.child_first_name,b.child_age].filter(Boolean).join(' · ')||'Présent')));
          card.append(text('p',b.confirmation_mode==='instant'?'Adresse email déclarée (non vérifiée)':'Adresse email confirmée par lien'));
          card.append(text('p',b.newsletter_requested_at?(b.confirmation_mode==='instant'?'Actualités : accord déclaré (email non vérifié)':'Actualités : accord donné lors de l’inscription'):'Actualités : aucun accord enregistré'));
          if(b.status==='confirmed'){
            const cancel=button('Annuler cette inscription',async()=>{
              if(!window.confirm('Annuler cette inscription et libérer les places ? Aucun email automatique ne sera envoyé : informe la famille directement.'))return;
              cancel.disabled=true;
              try{const r=await client.rpc('naitea_cancel_my_booking',{p_id:b.id});if(version!==revision||!target.isConnected)return;if(r.error||r.data!==true)throw Error();await loadList();}
              catch{if(target.isConnected){cancel.disabled=false;target.append(text('p','Annulation non confirmée. Actualise avant de réessayer.'));}}
            });card.append(cancel);
          }
          target.append(card);
        }
        if(data.length>1000)target.append(text('p','Liste limitée aux 1 000 premières inscriptions.'));
      }catch{if(version===revision&&target.isConnected)target.replaceChildren(text('p','Impossible de charger les inscriptions. Réessaie.'));}
    };
    await loadList();
  }
  function workshopCard(w){
    const card=document.createElement('article');card.className='card eventcard naitea-private-eventcard';
    const content=document.createElement('div');content.className='eventcontent';
    const headline=text('h3',w.title);headline.className='eventtitle';
    const date=w.starts_at?new Date(w.starts_at).toLocaleString('fr-FR'):'Date à préciser';
    content.append(headline,text('p',[w.category,date,w.capacity+' places',(w.price_cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})].filter(Boolean).join(' · ')),text('p',w.status==='draft'?'Brouillon privé':w.status==='published'?'Publié':'Annulé'));
    const actions=document.createElement('div');actions.className='eventactions';
    if(w.status==='draft'){const edit=button('Modifier',()=>open(w));edit.disabled=!ready||busy||uncertain;actions.append(edit);}
    if(publication&&['draft','published'].includes(w.status)){
      const preview=button('Aperçu',()=>previewWorkshop(w));preview.disabled=!ready||busy;actions.append(preview);
      const publish=button(w.status==='draft'?'Publier':'Dépublier',()=>changeStatus(w,w.status==='draft'?'published':'draft'));publish.disabled=!ready||busy||uncertain;
      if(w.status==='draft')publish.className='btn';
      actions.append(publish);
      if(w.status==='published'){const share=button('Partager',()=>shareWorkshop(w));share.disabled=!ready||busy||uncertain;actions.append(share);content.append(text('p','Pour modifier un atelier publié, repasse-le en brouillon.'));}
    }
    if(ready&&publication){const bookings=button('Inscriptions',()=>showBookings(w));bookings.disabled=busy||uncertain;actions.append(bookings);}
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
      const legend=calendar.querySelector(':scope > p.fine');if(legend)legend.textContent='Corail : ateliers privés et publiés · Rendez-vous individuels : bientôt disponibles.';
      const hint=calendar.querySelector('.v8-calendar-mobile-hint');if(hint)hint.textContent='Sélectionne un atelier pour le modifier ou le prévisualiser. Les dates utilisent le fuseau de ton appareil.';
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
    panel.append(text('p','Le tableau de bord et le calendrier utilisent aussi tes ateliers. Les réservations restent désactivées.'));
    app.replaceChildren(panel);
  }
  async function start(){
    try{
      const response=await fetch('/api/deployment',{cache:'no-store',credentials:'omit'});
      if(!response.ok)return;
      const flags=await response.json();if(!flags.workshopPersistence)return;
      publication=flags.workshopPublication===true;
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
const api={create,calendarDates,upcomingRows,rowsOnDate,coverPath,dimensions,cropRect};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.NaiteaProWorkshops=api;
})(globalThis);
