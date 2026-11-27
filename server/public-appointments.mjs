import {bookingConfig} from './booking-config.mjs';
import {esc,html,bytes,headers} from './public-workshop.mjs';
import {familyDetails} from './bookings.mjs';
import {appointmentEmail} from './workshop-email.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MODES={practice:'En cabinet',home:'À domicile',video:'En visio',phone:'Par téléphone'};
const ZONE='Europe/Paris';
const money=v=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v/100);
const time=v=>new Intl.DateTimeFormat('fr-FR',{timeZone:ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(v));
function dayOf(value=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('fr-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function plusDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function validDay(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
const dateLabel=v=>new Intl.DateTimeFormat('fr-FR',{timeZone:ZONE,dateStyle:'full',timeStyle:'short'}).format(new Date(v));
const optionLabel=s=>[MODES[s.modality],s.location_label,s.location_details].filter(Boolean).join(' · ');
const box=(title,message,body='',status=200)=>html(status,title,'<section class="card naitea-booking-panel"><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+body+'</section>');
const back=link=>'<a class="btn secondary" href="/accompagnement/'+link+'">Revenir à l’accompagnement</a>';
function fail(link,message,status=400){return box('Réservation non confirmée',message,back(link),status);}
function validService(s){return s&&typeof s.title==='string'&&s.title.length<=120&&Number.isInteger(s.price_cents)&&s.price_cents>=0&&Number.isInteger(s.duration_minutes)&&s.duration_minutes>=15&&s.duration_minutes<=480&&Array.isArray(s.slots)&&s.slots.length<=384;}
function validSlot(s){return s&&UUID.test(s.rule_id)&&Object.hasOwn(MODES,s.modality)&&Number.isFinite(Date.parse(s.starts_at))&&Number.isFinite(Date.parse(s.ends_at));}
const familyFields='<h2>Vos coordonnées</h2><div class="naitea-booking-grid"><div class="field"><label for="first_name">Prénom *</label><input id="first_name" name="first_name" maxlength="60" autocomplete="given-name" required></div><div class="field"><label for="last_name">Nom *</label><input id="last_name" name="last_name" maxlength="59" autocomplete="family-name" required></div><div class="field"><label for="email">Email *</label><input id="email" type="email" name="parent_email" maxlength="254" autocomplete="email" required></div><div class="field"><label for="phone">Téléphone *</label><input id="phone" name="phone" type="tel" maxlength="30" autocomplete="tel" required></div></div>';
function shiftMonth(month,n){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);}
const longDay=day=>new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
function calendarHref(link,params,embed){const p=new URLSearchParams(params);if(embed)p.set('embed','1');return '/accompagnement/'+link+'?'+p.toString();}
export function renderAppointmentCalendar(link,day,month,availability,today,embed=false){
 const first=new Date(month+'-01T12:00:00Z'),padding=(first.getUTCDay()+6)%7,count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 const available=new Map(availability.map(a=>[a.date,a.modalities.filter(m=>Object.hasOwn(MODES,m))]));
 const min=today.slice(0,7),max=plusDay(today,365).slice(0,7),prev=shiftMonth(month,-1),next=shiftMonth(month,1);
 const arrow=(m,label,enabled,icon)=>enabled?'<a class="btn secondary small" href="'+esc(calendarHref(link,{month:m},embed))+'" aria-label="'+label+'">'+icon+'</a>':'<span class="btn secondary small naitea-cal-disabled" aria-disabled="true">'+icon+'</span>';
 const days=Array.from({length:padding},()=>'<span aria-hidden="true"></span>');
 for(let n=1;n<=count;n++){const date=month+'-'+String(n).padStart(2,'0'),modes=available.get(date),label=longDay(date);
 if(modes?.length){const selected=date===day;days.push('<a class="naitea-cal-day'+(selected?' is-selected':'')+'" href="'+esc(calendarHref(link,{date},embed))+'" aria-label="'+esc(label+' : '+modes.map(m=>MODES[m]).join(', '))+'"'+(selected?' aria-current="date"':'')+'><span>'+n+'</span><span class="naitea-cal-dots" aria-hidden="true">'+modes.map(m=>'<i class="dot-'+m+'"></i>').join('')+'</span></a>');}
 else days.push('<span class="naitea-cal-day naitea-cal-disabled" aria-label="'+esc(label+' : indisponible')+'" aria-disabled="true">'+n+'</span>');}
 const monthName=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
 return '<section class="v9-booking-calendar naitea-real-calendar" aria-label="Agenda des rendez-vous"><div class="v8-toolbar naitea-cal-toolbar">'+arrow(prev,'Mois précédent',prev>=min,'←')+'<h3>'+esc(monthName)+'</h3>'+arrow(next,'Mois suivant',next<=max,'→')+'</div><div class="v9-month naitea-cal-month">'+['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>'<span class="v9-day-label">'+d+'</span>').join('')+days.join('')+'</div><div class="naitea-cal-legend">'+Object.entries(MODES).filter(([m])=>availability.some(a=>a.modalities.includes(m))).map(([m,label])=>'<span><i class="dot-'+m+'"></i>'+esc(label)+'</span>').join('')+'</div><p class="fine">'+(available.size?'Les dates en couleur disposent de créneaux. Choisissez une journée.':'Aucun créneau disponible ce mois-ci. Vous pouvez consulter le mois suivant.')+'</p></section>';
}
export function renderAppointmentForm(s,link,day,c,requestKey,today=dayOf(),calendar=null,embed=false){
 const groups=new Map();for(const slot of s.slots.filter(validSlot)){const k=slot.starts_at;if(!groups.has(k))groups.set(k,{start:k,end:slot.ends_at,rows:[]});groups.get(k).rows.push(slot);}
 const path='/accompagnement/'+link;
 const selection=[...groups.values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).map(g=>'<fieldset class="naitea-public-appointment-option naitea-slot-row"><legend>'+esc(time(g.start)+' – '+time(g.end))+'</legend><div class="naitea-public-appointment-times">'+g.rows.map(v=>embed?'<span class="naitea-slot-mode dot-bg-'+v.modality+'">'+esc(optionLabel(v))+'</span>':'<label class="naitea-public-appointment-time dot-bg-'+v.modality+'"><input type="radio" name="slot" value="'+esc(v.rule_id+'|'+v.modality+'|'+v.starts_at)+'" required><span>'+esc(optionLabel(v))+'</span></label>').join('')+'</div></fieldset>').join('');
 const cal=renderAppointmentCalendar(link,day,calendar?.month||day.slice(0,7),calendar?.availability||(groups.size?[{date:day,modalities:[...new Set(s.slots.filter(validSlot).map(v=>v.modality))]}]:[]),today,embed);
 const detail='<section class="v9-booking-details naitea-slot-details"><h3>'+esc(longDay(day))+'</h3><p>'+(groups.size?'Choisissez une heure et la modalité qui vous convient.':'Aucun créneau disponible ce jour. Sélectionnez une autre date.')+'</p>'+selection+'</section>';
 const layout='<div class="v9-booking-layout naitea-real-booking">'+cal+detail+'</div>';
 const booking=embed?layout+(groups.size?'<a class="btn" href="'+esc(calendarHref(link,{date:day},false))+'" target="_blank" rel="noopener noreferrer">Réserver mon rendez-vous</a>':''):'<form class="naitea-booking-form" method="post" action="'+path+'"><input type="hidden" name="request_key" value="'+esc(requestKey)+'"><input type="hidden" name="price" value="'+s.price_cents+'"><input type="hidden" name="duration" value="'+s.duration_minutes+'">'+layout+(groups.size?'<div class="naitea-appointment-contact">'+familyFields+'<label class="naitea-booking-consent"><input type="checkbox" name="ack" value="yes" required> J’ai compris que mes coordonnées seront transmises à la professionnelle et utilisées pour organiser ce rendez-vous.</label><p>Pour une visio, le lien sera communiqué par la professionnelle. Pour une visite à domicile, elle vous contactera pour préciser l’adresse.</p><div class="cf-turnstile" data-sitekey="'+esc(c.site)+'" data-action="appointment_booking"></div><button class="btn" type="submit">Confirmer mon rendez-vous</button></div>':'')+'</form>'+(groups.size?'<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>':'');
 return '<section class="card naitea-booking-panel naitea-public-appointment">'+(s.cover_path?'<img class="naitea-public-cover" src="'+path+'/photo" alt="">':'')+'<h1>'+esc(s.title)+'</h1>'+(s.business_name?'<p>Avec '+esc(s.business_name)+'</p>':'')+'<div class="naitea-service-price-banner"><div><span>Tarif de la séance</span><strong>'+esc(money(s.price_cents))+'</strong></div><div><span>Durée</span><strong>'+s.duration_minutes+' min</strong></div></div><p class="naitea-public-description">'+esc(s.description)+'</p>'+(s.audience?'<p><strong>Pour qui ?</strong> '+esc(s.audience)+'</p>':'')+(s.extra?'<p>'+esc(s.extra)+'</p>':'')+(s.travel_fees?'<p>Des frais de déplacement peuvent s’ajouter pour une séance à domicile ; montant à confirmer avec la professionnelle.</p>':'')+'<h2>Choisissez votre rendez-vous</h2><p>Horaires de Paris. Version de test : coordonnées fictives et email de test uniquement. Aucun paiement en ligne.</p>'+booking+'</section>';
}
export function createPublicAppointmentHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,link,photo=false)=>{
  const c=bookingConfig(env),url=new URL(request.url);
  if(!UUID.test(link)||!c||url.origin!==c.origin||c.testEmail!=='contact@naitea.fr')return photo?new Response(null,{status:404,headers}):box('Accompagnement indisponible','Ce lien de réservation n’est pas actif.','',404);
  if(!['GET','HEAD','POST'].includes(request.method)||photo&&request.method==='POST')return new Response(null,{status:405,headers});
  const call=(u,opts)=>fetchImpl(u,{redirect:'manual',signal:AbortSignal.timeout(10000),...opts});
  const rpc=async(name,args)=>{const r=await call(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(args)});if(!r.ok){r.body?.cancel().catch(()=>{});throw Error('RPC');}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,524288)));};
  let committed=false;
  try{
   if(photo){
    const s=await rpc('naitea_public_appointment_service',{p_link:link,p_day:null});
    const parts=String(s?.cover_path||'').split('/');
    if(!validService(s)||parts.length!==2||!UUID.test(parts[0])||!parts[1].endsWith('.jpg')||!UUID.test(parts[1].slice(0,-4)))return new Response(null,{status:404,headers});
    const r=await call(c.url+'/storage/v1/object/authenticated/naitea-service-covers/'+parts.join('/'),{headers:{apikey:c.service}});
    if(!r.ok||r.headers.get('content-type')?.split(';')[0]!=='image/jpeg'){r.body?.cancel().catch(()=>{});return new Response(null,{status:404,headers});}
    const data=await bytes(r,2097152);if(data.length<4||data[0]!==255||data[1]!==216||data[2]!==255)return new Response(null,{status:404,headers});return new Response(request.method==='HEAD'?null:data,{headers:{...headers,'Content-Type':'image/jpeg'}});
   }
   if(request.method!=='POST'){
    const today=dayOf(),requested=url.searchParams.get('date'),month=url.searchParams.get('month')||(requested?requested.slice(0,7):today.slice(0,7)),embed=url.searchParams.get('embed')==='1',max=plusDay(today,365);
    if(!/^\d{4}-\d{2}$/.test(month)||!validDay(month+'-01')||month<today.slice(0,7)||month>max.slice(0,7)||requested&&(!validDay(requested)||requested<today||requested>max||requested.slice(0,7)!==month))return fail(link,'Choisissez une date comprise dans les 365 prochains jours.');
    const available=await rpc('naitea_public_appointment_month',{p_link:link,p_month:month+'-01'});
    if(available===null)return box('Accompagnement indisponible','Ce lien n’est plus actif.','',404);
    if(!Array.isArray(available)||available.length>31||available.some(a=>!validDay(a.date)||a.date.slice(0,7)!==month||!Array.isArray(a.modalities)))throw Error('Calendar');
    const day=requested||available[0]?.date||(month===today.slice(0,7)?today:month+'-01');
    const s=await rpc('naitea_public_appointment_service',{p_link:link,p_day:day});
    if(!validService(s))return box('Accompagnement indisponible','Ce lien n’est plus actif.','',404);
    return html(200,s.title,renderAppointmentForm(s,link,day,c,crypto.randomUUID(),today,{month,availability:available},embed),'',embed);
   }
   if(url.search||request.headers.get('origin')!==url.origin||(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return fail(link,'Rouvrez le formulaire.',403);
   let f,details;try{f=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,8192)));details=familyDetails(f);}catch{return fail(link,'Vérifiez votre prénom, nom et téléphone.');}
   const recipient=(f.get('parent_email')||'').trim().toLowerCase(),key=f.get('request_key')||'',challenge=f.get('cf-turnstile-response')||'',parts=(f.get('slot')||'').split('|'),[rule,modality,start]=parts,price=Number(f.get('price')),duration=Number(f.get('duration'));
   if(recipient!==c.testEmail)return fail(link,'Les réservations sont limitées à l’adresse email de test autorisée.',403);
   if(parts.length!==3||!UUID.test(rule)||!Object.hasOwn(MODES,modality)||!start||start.length>50||!Number.isFinite(Date.parse(start))||!UUID.test(key)||!Number.isInteger(price)||price<0||!Number.isInteger(duration)||duration<15||duration>480||f.get('ack')!=='yes'||!challenge||challenge.length>2048)return fail(link,'Vérifiez les champs et sélectionnez un créneau.');
   const verify=await call('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:c.secret,response:challenge})});
   if(!verify.ok)return fail(link,'Vérification anti-spam indisponible.',503);
   const checked=JSON.parse(new TextDecoder().decode(await bytes(verify,16384)));
   if(checked.success!==true||checked.hostname!==url.hostname||checked.action!=='appointment_booking')return fail(link,'La vérification anti-spam a échoué.',403);
   const a=await rpc('naitea_book_online_appointment',{p_link:link,p_rule:rule,p_start:start,p_modality:modality,p_request:key,p_email:recipient,p_first:details.first_name,p_last:details.last_name,p_phone:details.phone,p_price:price,p_duration:duration});
   if(a?.code==='ALREADY_REQUESTED')return box('Demande déjà enregistrée','Aucun nouveau rendez-vous n’a été créé. Vérifiez votre email ou contactez la professionnelle.',back(link));
   if(a?.code==='FULL')return fail(link,'Ce créneau vient d’être occupé. Choisissez un autre horaire.',409);
   if(a?.code==='CHANGED')return fail(link,'Le tarif ou la durée a changé. Vérifiez la nouvelle proposition.',409);
   if(a?.code==='RATE_LIMIT')return fail(link,'Limite de réservations de test atteinte. Réessayez plus tard.',429);
   if(a?.code!=='CONFIRMED'||!UUID.test(a.id))return fail(link,'Ce rendez-vous n’est plus disponible.',409);
   committed=true;let accepted=false;
   try{
    const m=await call('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email:recipient}],...appointmentEmail(a,details.first_name)})});accepted=m.ok;m.body?.cancel().catch(()=>{});
   }catch{}
   try{await rpc('naitea_record_appointment_mail',{p_id:a.id,p_status:accepted?'accepted':'failed'});}catch{}
   const recap='<div class="naitea-booking-recap"><strong>'+esc(a.title)+'</strong><p>'+esc(dateLabel(a.starts_at)+' – '+time(a.ends_at))+'</p><p>'+esc(optionLabel(a))+'</p><p>'+esc(money(a.price_cents))+(a.travel_fees?' · frais de déplacement à confirmer':'')+' · Aucun paiement en ligne.</p></div>';
   return box('Votre rendez-vous est confirmé !',accepted?'Votre rendez-vous est enregistré. Un email récapitulatif a été pris en charge par notre service d’envoi.':'Votre rendez-vous est enregistré, mais l’envoi de l’email n’a pas pu être confirmé. Conservez ce récapitulatif et ne réservez pas une seconde fois.',recap+back(link));
  }catch{return photo?new Response(null,{status:503,headers}):committed?box('Rendez-vous enregistré','Votre réservation a été enregistrée. Contactez la professionnelle pour obtenir le récapitulatif.',back(link)):fail(link,'Le service est momentanément indisponible. Si vous avez déjà confirmé, vérifiez auprès de la professionnelle avant de réserver à nouveau.',503);}
 };
}
