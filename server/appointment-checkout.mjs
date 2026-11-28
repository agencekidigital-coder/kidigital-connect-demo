import {checkoutEnabled,checkoutParams,paymentOutcome,stripe,rpc,readJSON} from './workshop-checkout.mjs';
import {bookingConfig} from './booking-config.mjs';
import {bytes,html,esc} from './public-workshop.mjs';
import {appointmentEmail} from './workshop-email.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,SESSION=/^cs_test_[A-Za-z0-9_]+$/,ACCOUNT=/^acct_[A-Za-z0-9]+$/,HEX=/^[0-9a-f]{64}$/;
const KIND='appointment_test',RETURN='/reservation/rendez-vous-paiement';
const hex=a=>Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');
const hash=async t=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))));
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const page=(status,title,message,body='')=>html(status,title,'<section class="card naitea-booking-panel"><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+body+'</section>');
const get=async(c,fetchImpl,path,query,headers={apikey:c.service,Accept:'application/json'})=>{const u=new URL(path,c.url);for(const [k,v] of Object.entries(query))u.searchParams.set(k,v);return readJSON(await fetchImpl(u.href,{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(10000)}));};
const lookup=async(c,fetchImpl,query)=>{const r=await get(c,fetchImpl,'/rest/v1/naitea_appointment_test_payments',{...query,select:'appointment_id,stripe_account_id,session_id,amount_cents,currency,state',limit:'2'});if(!Array.isArray(r)||r.length>1)throw Error('lookup');return r[0]||null;};
export function appointmentCheckoutParams(held,origin,t,email){
 const p=checkoutParams(held,origin,t,email),back=origin+RETURN+'?t='+t;
 p.set('success_url',back);p.set('cancel_url',back+'&cancel=1');p.delete('metadata[naitea_booking_id]');p.set('metadata[naitea_appointment_id]',held.booking_id);p.set('metadata[naitea_kind]',KIND);p.set('integration_identifier','naitea-appointment-vmptksrz');return p;
}
export function validAppointmentSession(s,h){return s?.livemode===false&&SESSION.test(s.id||'')&&s.mode==='payment'&&s.currency==='eur'&&s.amount_total===h.amount_cents&&s.client_reference_id===h.appointment_id&&s.metadata?.naitea_kind===KIND&&s.metadata?.naitea_appointment_id===h.appointment_id;}
export async function startAppointmentCheckout({c,env,fetchImpl,args,mode,deposit}){
 if(!checkoutEnabled(env))return page(423,'Paiement indisponible','Le paiement en ligne de test n’est pas encore disponible.');
 const db=rpc(c,fetchImpl),t=hex(crypto.getRandomValues(new Uint8Array(32)));
 const h=await db('naitea_prepare_appointment_checkout',{...args,p_hash:await hash(t),p_expected_mode:mode,p_expected_deposit:deposit});
 if(h?.code!=='HELD'){const messages={FULL:'Ce créneau vient d’être occupé.',CHANGED:'Le tarif ou le mode de paiement a changé. Rouvrez la fiche.',RATE_LIMIT:'Limite de réservations de test atteinte.',STRIPE_NOT_CONNECTED:'La professionnelle doit configurer Stripe.',ALREADY_REQUESTED:'Une demande existe déjà.'};return page(409,'Rendez-vous non confirmé',messages[h?.code]||'Ce créneau ne peut plus être réservé en ligne.');}
 const abort=()=>db('naitea_abort_unstarted_appointment_checkout',{p_appointment_id:h.booking_id,p_account:h.account});
 let params;try{
  params=appointmentCheckoutParams(h,c.origin,t,args.p_email);
  const q=new URLSearchParams({'include[0]':'configuration.merchant','include[1]':'defaults'});
  const a=await stripe(env,fetchImpl,'/v2/core/accounts/'+h.account+'?'+q);
  if(a.id!==h.account||a.livemode===true||a.dashboard!=='full'||a.defaults?.responsibilities?.fees_collector!=='stripe'||a.defaults?.responsibilities?.losses_collector!=='stripe'||a.configuration?.merchant?.capabilities?.card_payments?.status!=='active')throw Error('Inactive account');
 }catch{await abort();return page(503,'Paiement indisponible','Le compte Stripe de test ne peut pas encore accepter ce règlement.');}
 let s;try{s=await stripe(env,fetchImpl,'/v1/checkout/sessions',{account:h.account,params,idempotency:'naitea-appointment-test-'+h.booking_id});}catch(e){if(e.definiteRejection)await abort();return page(503,'Paiement non démarré','La session n’a pas pu être vérifiée. Ne réservez pas une seconde fois avant vérification.');}
 if(!validAppointmentSession(s,{appointment_id:h.booking_id,amount_cents:h.amount_cents})||s.status!=='open')return page(503,'Paiement indisponible','La session doit être vérifiée. Aucun rendez-vous n’est confirmé.');
 let target;try{target=new URL(s.url);if(target.origin!=='https://checkout.stripe.com'||target.username||target.password)throw Error();}catch{return page(503,'Paiement indisponible','Lien de paiement non reconnu.');}
 if(await db('naitea_bind_appointment_checkout',{p_appointment_id:h.booking_id,p_account:h.account,p_session:s.id})!==true)return page(503,'Paiement indisponible','La session n’a pas pu être associée. Contactez la professionnelle.');
 return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
async function settle(c,fetchImpl,h,s,outcome){
 const db=rpc(c,fetchImpl),r=await db('naitea_settle_appointment_checkout',{p_appointment_id:h.appointment_id,p_account:h.stripe_account_id,p_session:s.id,p_amount:s.amount_total,p_currency:s.currency,p_outcome:outcome});
 if(r?.code==='CONFIRMED'){let accepted=false;if(r.email===c.testEmail){try{const m=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email:r.email}],...appointmentEmail(r,r.first_name)})});accepted=m.ok;m.body?.cancel().catch(()=>{});}catch{}}
  try{await db('naitea_record_appointment_mail',{p_id:r.id,p_status:accepted?'accepted':'failed'});}catch{}
 }
 return r?.code;
}
async function recover(c,env,fetchImpl,h,expire=false){
 if(!h)return {state:'unknown'};
 if(['paid','expired','failed'].includes(h.state))return {state:h.state};
 if(h.state!=='pending'||!UUID.test(h.appointment_id)||!ACCOUNT.test(h.stripe_account_id)||h.currency!=='eur'||!Number.isInteger(h.amount_cents)||h.amount_cents<50)throw Error('Invalid record');
 if(!h.session_id)return {state:'pending',reason:'session_missing'};
 if(!SESSION.test(h.session_id))throw Error('Invalid session');
 let s=await stripe(env,fetchImpl,'/v1/checkout/sessions/'+h.session_id,{account:h.stripe_account_id});
 if(s.id!==h.session_id||!validAppointmentSession(s,h))throw Error('Mismatch');
 if(expire&&s.status==='open'&&s.payment_status==='unpaid'){
  s=await stripe(env,fetchImpl,'/v1/checkout/sessions/'+h.session_id+'/expire',{account:h.stripe_account_id,params:new URLSearchParams(),idempotency:'naitea-expire-appointment-test-'+h.appointment_id});
  if(s.id!==h.session_id||!validAppointmentSession(s,h))throw Error('Mismatch');
 }
 const outcome=paymentOutcome('checkout.session.expired',s);
 if(!outcome){const open=s.status==='open'&&s.payment_status==='unpaid';return {state:'pending',reason:open?'checkout_open':'stripe_pending',can_expire:open};}
 const code=await settle(c,fetchImpl,h,s,outcome);if(!['CONFIRMED','RELEASED','ALREADY_SETTLED'].includes(code))throw Error('Settlement conflict');
 return {state:outcome};
}
// Called only after the shared endpoint has verified the Stripe signature, test mode and event type.
export async function appointmentWebhook({event:e,c,env,fetchImpl}){
 const obj=e.data?.object,id=obj?.metadata?.naitea_appointment_id;
 if(e.livemode!==false||obj?.metadata?.naitea_kind!==KIND||!UUID.test(id||'')||!ACCOUNT.test(e.account||'')||!SESSION.test(obj.id||''))return json(400,{error:'INVALID_EVENT'});
 const h=await lookup(c,fetchImpl,{appointment_id:'eq.'+id,stripe_account_id:'eq.'+e.account});
 if(!h)return json(200,{received:true,ignored:true});
 if(h.session_id&&h.session_id!==obj.id)return json(409,{error:'SESSION_MISMATCH'});
 const s=await stripe(env,fetchImpl,'/v1/checkout/sessions/'+obj.id,{account:e.account});
 if(s.id!==obj.id||!validAppointmentSession(s,h))return json(409,{error:'PAYMENT_MISMATCH'});
 const outcome=paymentOutcome(e.type,s);if(!outcome)return json(200,{received:true,pending:true});
 const code=await settle(c,fetchImpl,h,s,outcome);return ['CONFIRMED','RELEASED','ALREADY_SETTLED'].includes(code)?json(200,{received:true}):json(409,{error:'SETTLEMENT_CONFLICT'});
}
export function createAppointmentPaymentHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,path)=>{
  const c=bookingConfig(env),u=new URL(request.url);if(!c||u.origin!==c.origin||!checkoutEnabled(env))return json(423,{error:'CHECKOUT_TEST_DISABLED'});
  if(path===RETURN){
   const t=u.searchParams.get('t')||'';if(!['GET','POST'].includes(request.method)||!HEX.test(t)||u.searchParams.getAll('t').length!==1)return page(400,'Rendez-vous','Lien de suivi invalide.');
   if(request.method==='POST'&&request.headers.get('origin')!==c.origin)return page(403,'Rendez-vous','Actualisation non autorisée.');
   const button='<form method="post" action="'+RETURN+'?t='+t+'"><button class="btn">Actualiser le statut</button></form>';
   try{const h=await lookup(c,fetchImpl,{return_hash:'eq.'+await hash(t)}),r=request.method==='POST'?await recover(c,env,fetchImpl,h):{state:h?.state||'unknown'};
    if(r.state==='paid')return page(200,'Votre rendez-vous est confirmé !','Paiement de test vérifié. Votre rendez-vous est réservé. Aucun argent réel débité.');
    if(['expired','failed'].includes(r.state))return page(200,'Paiement non finalisé','Le créneau a été libéré. Aucun rendez-vous confirmé.');
    if(r.state==='pending')return page(200,'Vérification du paiement','Le rendez-vous reste en attente de confirmation Stripe. Ne payez pas une seconde fois.',button);
    return page(404,'Rendez-vous','Lien de suivi inconnu.');
   }catch{return page(503,'Vérification indisponible','Ne payez pas une deuxième fois.',button);}
  }
  if(request.method!=='POST'||request.headers.get('origin')!==c.origin)return json(403,{error:'ORIGIN_FORBIDDEN'});
  const token=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization')||'');if(!token||token[1].length>8192)return json(401,{error:'AUTH_REQUIRED'});
  if((request.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')return json(415,{error:'JSON_REQUIRED'});
  try{
   const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(request,2048)));
   if(!input||!UUID.test(input.appointment_id||'')||Object.keys(input).some(k=>!['appointment_id','expire_test'].includes(k))||Object.hasOwn(input,'expire_test')&&typeof input.expire_test!=='boolean')return json(400,{error:'INVALID_REQUEST'});
   const headers={apikey:c.publishableKey,Authorization:'Bearer '+token[1],Accept:'application/json'},auth=await fetchImpl(c.url+'/auth/v1/user',{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return json(401,{error:'AUTH_REQUIRED'});const user=await readJSON(auth,65536);if(!UUID.test(user.id||'')||user.is_anonymous===true)return json(401,{error:'AUTH_REQUIRED'});
   const rows=await get(c,fetchImpl,'/rest/v1/naitea_appointments',{id:'eq.'+input.appointment_id,professional_id:'eq.'+user.id,select:'id,professional_id',limit:'2'},headers);
   if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==input.appointment_id||rows[0].professional_id!==user.id)return json(404,{error:'NOT_FOUND'});
   if(input.expire_test){const a=await get(c,fetchImpl,'/rest/v1/naitea_appointments',{id:'eq.'+input.appointment_id,professional_id:'eq.'+user.id,select:'id,naitea_families!inner(email)',limit:'2'});if(!Array.isArray(a)||a.length!==1||a[0].naitea_families?.email!==c.testEmail)return json(403,{error:'NOT_TEST'});}
   const h=await lookup(c,fetchImpl,{appointment_id:'eq.'+input.appointment_id});return json(200,await recover(c,env,fetchImpl,h,!!input.expire_test));
  }catch{return json(503,{error:'SYNC_UNAVAILABLE'});}
 };
}
