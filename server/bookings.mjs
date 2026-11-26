import {bookingConfig} from './booking-config.mjs';
import {esc,html,bytes,format,SLUG} from './public-workshop.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const box=(title,message,body='',status=200)=>html(status,title,'<section class="card naitea-booking-panel"><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+body+'</section>');
const error=(message,status=400)=>box('Réservation non confirmée',message,'<p><a class="btn secondary" href="/decouvrir">Revenir à Naïtéa</a></p>',status);
const configError=()=>error('Les réservations en ligne ne sont pas encore ouvertes.',423);
function provider(config,fetchImpl,privileged=false){
 return async(name,args)=>{
  const key=privileged?config.service:config.publishableKey;
  const r=await fetchImpl(config.url+'/rest/v1/rpc/'+name,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{apikey:key,...(!privileged&&key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(args)});
  if(!r.ok){r.body?.cancel().catch(()=>{});throw Error('RPC unavailable');}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(r,65536)));
 };
}
async function readForm(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('origin');
 if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')throw Error('format');
 return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,8192)));
}
const hash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const goBack=slug=>'<a class="btn secondary" href="/atelier/'+slug+'">Revenir à l’atelier</a>';
function familyDetails(f){
 const clean=(key,max)=>{const s=(f.get(key)||'').normalize('NFC').trim();if(s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw Error('invalid field');return s||null;};
 const first=clean('first_name',60),last=clean('last_name',59);
 let phone=(f.get('phone')||'').replace(/[\s.()-]/g,'');
 if(/^0[1-9]\d{8}$/.test(phone))phone='+33'+phone.slice(1);
 else if(phone.startsWith('00'))phone='+'+phone.slice(2);
 if(!first||!last||!/^\+[1-9]\d{7,14}$/.test(phone)||/^(\d)\1+$/.test(phone.slice(1)))throw Error('invalid parent');
 const coparent=f.get('coparent')==='yes',child=f.get('child')==='yes';
 return {first_name:first,last_name:last,phone,coparent,coparent_first_name:coparent?clean('coparent_first_name',100):null,coparent_last_name:coparent?clean('coparent_last_name',100):null,child,child_first_name:child?clean('child_first_name',100):null,child_age:child?clean('child_age',40):null,newsletter:f.get('newsletter')==='yes'};
}
function familyFields(){
 return '<h2>Vos coordonnées</h2><div class="naitea-booking-grid"><div class="field"><label for="first_name">Prénom du parent *</label><input id="first_name" name="first_name" autocomplete="given-name" maxlength="60" required></div><div class="field"><label for="last_name">Nom du parent *</label><input id="last_name" name="last_name" autocomplete="family-name" maxlength="59" required></div><div class="field"><label for="parent_email">Adresse email *</label><input id="parent_email" name="parent_email" type="email" autocomplete="email" maxlength="254" required></div><div class="field"><label for="phone">Téléphone *</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="06 12 34 56 78" required></div></div><h2>Qui participera à l’atelier ?</h2><label class="naitea-booking-consent"><input type="checkbox" name="coparent" value="yes" data-family-toggle="coparent_fields" aria-controls="coparent_fields"> Un co-parent participera-t-il ?</label><fieldset class="naitea-booking-conditional" id="coparent_fields"><legend>Informations du co-parent (facultatives)</legend><div class="naitea-booking-grid"><div class="field"><label for="coparent_first_name">Prénom du co-parent</label><input id="coparent_first_name" name="coparent_first_name" maxlength="100"></div><div class="field"><label for="coparent_last_name">Nom du co-parent</label><input id="coparent_last_name" name="coparent_last_name" maxlength="100"></div></div></fieldset><label class="naitea-booking-consent"><input type="checkbox" name="child" value="yes" data-family-toggle="child_fields" aria-controls="child_fields"> Un enfant sera-t-il présent ?</label><fieldset class="naitea-booking-conditional" id="child_fields"><legend>Informations de l’enfant (facultatives)</legend><div class="naitea-booking-grid"><div class="field"><label for="child_first_name">Prénom de l’enfant</label><input id="child_first_name" name="child_first_name" maxlength="100"></div><div class="field"><label for="child_age">Âge de l’enfant</label><input id="child_age" name="child_age" maxlength="40" placeholder="Ex. 6 mois"></div></div></fieldset>';
}
export function createBookingHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,slug=null)=>{
  const c=bookingConfig(env),url=new URL(request.url);
  if(!c||url.origin!==c.origin)return configError();
  if(!['GET','HEAD','POST'].includes(request.method))return error('Méthode non autorisée.',405);
  const publicRPC=provider(c,fetchImpl),privateRPC=provider(c,fetchImpl,true);
  let stage='atelier';
  try{
   if(slug===null){
    if(request.method!=='POST')return box('Confirmez votre inscription','Cliquez sur le bouton pour confirmer votre place. Le lien expire après 15 minutes.','<form method="post" action="/reservation/confirmer" id="naitea-confirm-form"><input type="hidden" name="token" id="naitea-confirm-token"><button class="btn" id="naitea-confirm-submit" disabled>Confirmer mon inscription</button><p id="naitea-confirm-status" role="status"></p><noscript>Activez JavaScript pour confirmer votre inscription.</noscript></form><script src="/assets/booking-confirm.js" defer></script>');
    stage='formulaire';
    const f=await readForm(request),t=f.get('token')||'';
    if(!HEX.test(t))return error('Lien invalide ou incomplet.');
    stage='confirmation';
    const result=await privateRPC('naitea_confirm_verified_booking',{p_hash:await hash(t)});
    if(result?.code==='CONFIRMED')return box('Votre inscription est confirmée !','Votre place est réservée. Aucun paiement en ligne n’a été effectué. Conservez le récapitulatif reçu par email.');
    return error('Ce lien est expiré, invalide ou l’atelier n’est plus disponible. Revenez à la page de l’atelier.',409);
   }
   if(typeof slug!=='string'||slug.length>180||!SLUG.test(slug))return error('Atelier indisponible.',404);
   const w=await publicRPC('naitea_public_workshop_slug',{p_slug:slug});
   if(!w||w.slug!==slug||!UUID.test(w.id)||!Number.isFinite(Date.parse(w.starts_at))||Date.parse(w.starts_at)<=Date.now())return error('Cet atelier ne peut plus être réservé.',404);
   const available=await publicRPC('naitea_available_workshop_seats',{p_id:w.id});
   if(!Number.isInteger(available)||available<1)return box('Atelier complet','Il n’y a plus de place disponible pour le moment.',goBack(slug),409);
   const {date,location,price}=format(w);
   const recap=esc(w.title)+' · '+esc(date)+' · '+esc(location)+' · '+esc(price)+' / duo';
   if(request.method!=='POST'){
    const fields='<div class="naitea-booking-recap"><strong>'+recap+'</strong><p>'+available+' place(s) disponible(s)</p></div><form class="naitea-booking-form" method="post" action="/atelier/'+slug+'/reserver"><input type="hidden" name="request_key" value="'+crypto.randomUUID()+'">'+familyFields()+'<label for="seats">Nombre de places (duos)</label><select id="seats" name="seats">'+Array.from({length:Math.min(available,10)},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'</option>').join('')+'</select><h2>Vos préférences</h2><label class="naitea-booking-consent"><input type="checkbox" name="newsletter" value="yes"> J’accepte de recevoir par email les actualités et prochains ateliers de cette professionnelle (facultatif).</label><p>Les informations de participation et vos coordonnées seront transmises à la professionnelle après confirmation et utilisées pour organiser votre inscription. Les emails pratiques sont indépendants de votre choix de recevoir les actualités. Aucun envoi commercial n’est activé dans cette version de test.</p><label class="naitea-booking-consent"><input type="checkbox" name="ack" value="yes" required> J’ai compris que mes coordonnées sont utilisées pour cette réservation.</label><div class="cf-turnstile" data-sitekey="'+esc(c.site)+'" data-action="workshop_booking"></div><button class="btn" type="submit">Recevoir mon lien de confirmation</button><p class="fine">La place est réservée pendant 15 minutes, le temps de confirmer votre email. Aucun paiement en ligne.</p></form><script src="/assets/booking-family.js" defer></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
    return box('Réserver un atelier — test','Version de test : seules les inscriptions avec l’adresse email autorisée sont acceptées. N’utilisez pas de données réelles de familles.',fields);
   }
   stage='formulaire';
   const f=await readForm(request),email=(f.get('parent_email')||'').trim().toLowerCase(),seats=Number(f.get('seats')),key=f.get('request_key')||'',challenge=f.get('cf-turnstile-response')||'';
   let details;try{details=familyDetails(f);}catch{return error('Renseignez un prénom, un nom et un téléphone valides, et vérifiez les autres informations.');}
   if(email.length>254||!EMAIL.test(email)||!Number.isInteger(seats)||seats<1||seats>10||!UUID.test(key)||f.get('ack')!=='yes'||!challenge||challenge.length>2048)return error('Vérifiez les informations et recommencez depuis la fiche de l’atelier.');
   if(email!==c.testEmail)return error('Les inscriptions sont limitées à une adresse de test autorisée.',403);
   stage='anti-spam';
   const verify=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:c.secret,response:challenge})});
   if(!verify.ok)return error('La vérification anti-spam est indisponible. Réessayez.',503);
   const checked=JSON.parse(new TextDecoder().decode(await bytes(verify,16384)));
   if(checked.success!==true||checked.hostname!==url.hostname||checked.action!=='workshop_booking')return error('La vérification anti-spam a échoué. Revenez au formulaire.',403);
   stage='enregistrement';
   const t=token();
   const result=await privateRPC('naitea_begin_full_booking',{p_workshop_id:w.id,p_parent_email:email,p_seats:seats,p_request_key:key,p_hash:await hash(t),p_details:details});
   if(result?.code==='FULL')return box('Atelier complet','Une autre famille a réservé les dernières places.',goBack(slug),409);
   if(result?.code==='RATE_LIMIT')return error('Trop de demandes. Réessayez plus tard.',429);
   if(result?.code!=='REQUEST_RECEIVED')return error('Impossible de réserver cet atelier pour le moment.',409);
   if(result.send===true){
    const link=c.origin+'/reservation/confirmer#'+t;
    stage='email';
    const mail=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email}],subject:'Confirmez votre inscription à votre atelier Naïtéa',htmlContent:'<html lang="fr"><body style="font-family:Arial;color:#590425"><h1>Encore une petite étape !</h1><p>'+recap+'</p><p>'+seats+' place(s) · Aucun paiement en ligne.</p><p><a href="'+esc(link)+'" style="background:#590425;color:white;padding:14px;border-radius:8px;text-decoration:none">Confirmer mon inscription</a></p><p>Ce lien expire dans 15 minutes. Si vous n’avez pas fait cette demande, ignorez cet email.</p></body></html>',textContent:'Confirmez votre inscription dans les 15 minutes : '+link+' . Si vous n’avez pas fait cette demande, ignorez cet email.'})});
    if(!mail.ok){mail.body?.cancel().catch(()=>{});return error('L’envoi de l’email n’a pas pu être confirmé. La place temporaire sera libérée après 15 minutes.',503);}
    mail.body?.cancel().catch(()=>{});
   }
   return box('Vérifiez votre boîte email','Si votre demande est nouvelle, un lien de confirmation vous a été envoyé. Si vous avez déjà demandé une inscription, utilisez votre précédent email. La place n’est confirmée qu’après validation.',goBack(slug));
  }catch{
   // Never expose provider errors, secrets, request content or family data.
   if(stage==='formulaire')return error('Le formulaire n’a pas pu être vérifié. Rouvrez la page de réservation et réessayez. (FORM)',400);
   return error('Le service est momentanément indisponible. Aucune inscription n’est confirmée par cette page. (Étape : '+stage+')',503);
  }
 };
}
