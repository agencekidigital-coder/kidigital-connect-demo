import {bookingConfig} from './booking-config.mjs';
import {bytes,html,esc} from './public-workshop.mjs';
import {workshopEmail} from './workshop-email.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,ACCOUNT=/^acct_[A-Za-z0-9]+$/,SESSION=/^cs_test_[A-Za-z0-9_]+$/,HEX=/^[0-9a-f]{64}$/;
const VERSION='2026-11-18.endive';
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const page=(status,title,message,body='')=>html(status,title,'<section class="card naitea-booking-panel"><h1>'+esc(title)+'</h1><p>'+esc(message)+'</p>'+body+'</section>');
const hex=arr=>Array.from(arr,n=>n.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
export function checkoutEnabled(env={}){
 return env.NAITEA_WORKSHOP_CHECKOUT_TEST_ENABLED==='true'&&env.NAITEA_STRIPE_TEST_ENABLED==='true'&&/^sk_test_[A-Za-z0-9]{16,250}$/.test(env.NAITEA_STRIPE_TEST_SECRET_KEY||'')&&/^whsec_[A-Za-z0-9]{16,250}$/.test(env.NAITEA_STRIPE_TEST_WEBHOOK_SECRET||'')&&!!bookingConfig(env);
}
async function readJSON(response,max=262144){
 if(!response.ok){response.body?.cancel().catch(()=>{});throw Error('provider');}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bytes(response,max)));
}
const rpc=(c,fetchImpl)=>async(name,args)=>readJSON(await fetchImpl(c.url+'/rest/v1/rpc/'+name,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{apikey:c.service,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(args)}));
async function stripe(env,fetchImpl,path,{account,params,idempotency}={}){
 const response=await fetchImpl('https://api.stripe.com'+path,{method:params?'POST':'GET',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+env.NAITEA_STRIPE_TEST_SECRET_KEY,'Stripe-Version':VERSION,Accept:'application/json',...(account?{'Stripe-Account':account}:{}),...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},...(params?{body:params}:{})});
 if(!response.ok){
  let rejected=false;
  try{const e=JSON.parse(new TextDecoder().decode(await bytes(response,16384))).error;rejected=[400,401,403,404].includes(response.status)&&['invalid_request_error','authentication_error','permission_error'].includes(e?.type);}catch{}
  const error=Error('Stripe API');error.definiteRejection=rejected;throw error;
 }
 return readJSON(response);
}
export function checkoutParams(held,origin,returnToken,email){
 if(!UUID.test(held.booking_id)||!ACCOUNT.test(held.account)||!Number.isInteger(held.unit_cents)||held.unit_cents<1||!Number.isInteger(held.seats)||held.seats<1||held.seats>10||!Number.isSafeInteger(held.amount_cents)||held.amount_cents!==held.seats*held.unit_cents||held.amount_cents<50||!Number.isInteger(held.expires_at)||!HEX.test(returnToken)||typeof held.title!=='string'||!held.title.trim())throw Error('Invalid checkout');
 const back=origin+'/reservation/paiement?t='+returnToken;
 return new URLSearchParams({
  mode:'payment',locale:'fr',success_url:back,cancel_url:back+'&cancel=1',
  expires_at:String(held.expires_at),customer_email:email,client_reference_id:held.booking_id,
  'metadata[naitea_booking_id]':held.booking_id,'metadata[naitea_kind]':'workshop_test',
  'line_items[0][quantity]':String(held.seats),'line_items[0][price_data][currency]':'eur',
  'line_items[0][price_data][unit_amount]':String(held.unit_cents),'line_items[0][price_data][product_data][name]':held.title,
  'adaptive_pricing[enabled]':'false','integration_identifier':'naitea-workshop-qmvrkstp'
 });
}
const validSession=(s,held)=>s?.livemode===false&&SESSION.test(s.id||'')&&s.mode==='payment'&&s.currency==='eur'&&s.amount_total===held.amount_cents&&s.client_reference_id===held.booking_id&&s.metadata?.naitea_kind==='workshop_test'&&s.metadata?.naitea_booking_id===held.booking_id;
export async function startWorkshopCheckout({c,env,fetchImpl,w,email,seats,key,details}){
 if(!checkoutEnabled(env))return page(423,'Paiement indisponible','Le paiement de test n’est pas activé. Aucune inscription n’est confirmée.');
 const db=rpc(c,fetchImpl),token=hex(crypto.getRandomValues(new Uint8Array(32)));
 const held=await db('naitea_prepare_workshop_checkout',{p_workshop_id:w.id,p_parent_email:email,p_seats:seats,p_request_key:key,p_hash:await digest(token),p_details:details});
 if(held?.code!=='HELD'){
  const messages={FULL:'Il ne reste pas suffisamment de places.',ALREADY_REQUESTED:'Une demande existe déjà. Vérifiez votre email ou contactez la professionnelle.',RATE_LIMIT:'Limite de test atteinte.',STRIPE_NOT_CONNECTED:'La professionnelle doit configurer Stripe.',WORKSHOP_UNAVAILABLE:'Le paiement en ligne est indisponible pour cet atelier, notamment dans les 40 minutes précédant son début.'};
  return page(409,'Réservation non confirmée',messages[held?.code]||'La réservation n’a pas pu être préparée.');
 }
 const abort=()=>db('naitea_abort_unstarted_workshop_checkout',{p_booking_id:held.booking_id,p_account:held.account});
 let params;
 try{
  params=checkoutParams(held,c.origin,token,email);
  const q=new URLSearchParams({'include[0]':'configuration.merchant','include[1]':'defaults'});
  const a=await stripe(env,fetchImpl,'/v2/core/accounts/'+held.account+'?'+q);
  if(a.id!==held.account||a.livemode!==false||a.dashboard!=='full'||a.defaults?.responsibilities?.fees_collector!=='stripe'||a.defaults?.responsibilities?.losses_collector!=='stripe'||a.configuration?.merchant?.capabilities?.card_payments?.status!=='active')throw Error('Inactive account');
 }catch{await abort();return page(503,'Paiement indisponible','La professionnelle ne peut pas encore accepter ce paiement de test. Aucune inscription confirmée.');}
 let session;
 try{
  session=await stripe(env,fetchImpl,'/v1/checkout/sessions',{account:held.account,params,idempotency:'naitea-workshop-test-'+held.booking_id});
 }catch(e){
  if(e.definiteRejection)await abort();
  return page(503,'Paiement non démarré','Le service de paiement n’a pas répondu correctement. Aucune inscription n’est confirmée. Contactez la professionnelle avant de réessayer.');
 }
 // Do not release the reservation after an ambiguous creation or a binding failure.
 // Stripe may have created a payable session. Resolve using its actual terminal state.
 if(!validSession(session,held)||session.status!=='open')return page(503,'Paiement indisponible','La session doit être vérifiée. Aucune inscription n’est confirmée.');
 const target=new URL(session.url);
 if(target.origin!=='https://checkout.stripe.com'||target.username||target.password)return page(503,'Paiement indisponible','Lien de paiement non reconnu.');
 if(await db('naitea_bind_workshop_checkout',{p_booking_id:held.booking_id,p_account:held.account,p_session:session.id})!==true)return page(503,'Paiement indisponible','La session n’a pas pu être associée. Contactez la professionnelle.');
 return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
export async function verifyStripeSignature(raw,header,secret,now=Math.floor(Date.now()/1000)){
 if(!(raw instanceof Uint8Array)||typeof header!=='string'||header.length>8192||typeof secret!=='string')return false;
 const parts=header.split(',').map(v=>v.trim().split('='));
 const timestamps=parts.filter(v=>v[0]==='t'&&/^\d{1,12}$/.test(v[1]||''));
 if(timestamps.length!==1||Math.abs(now-Number(timestamps[0][1]))>300)return false;
 const prefix=new TextEncoder().encode(timestamps[0][1]+'.'),body=new Uint8Array(prefix.length+raw.length);body.set(prefix);body.set(raw,prefix.length);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const v of parts){if(v[0]==='v1'&&HEX.test(v[1]||'')){const sig=Uint8Array.from(v[1].match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,sig,body))return true;}}
 return false;
}
export function paymentOutcome(eventType,s){
 if(s.status==='complete'&&s.payment_status==='paid')return 'paid';
 if(eventType==='checkout.session.expired'&&s.status==='expired'&&s.payment_status==='unpaid')return 'expired';
 if(eventType==='checkout.session.async_payment_failed'&&s.status==='complete'&&s.payment_status==='unpaid')return 'failed';
 return null;
}
const EVENTS=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired']);
export function createWorkshopPaymentHandler({fetchImpl=globalThis.fetch}={}){
 return async(request,env,path)=>{
  const c=bookingConfig(env),u=new URL(request.url);
  if(!c||u.origin!==c.origin||!checkoutEnabled(env))return json(423,{error:'CHECKOUT_TEST_DISABLED'});
  const db=rpc(c,fetchImpl);
  if(path==='/reservation/paiement'){
   if(request.method!=='GET'||!HEX.test(u.searchParams.get('t')||''))return page(400,'Réservation','Lien de suivi invalide.');
   try{
    const token=u.searchParams.get('t'),state=await db('naitea_workshop_checkout_return',{p_hash:await digest(token)});
    if(state==='paid')return page(200,'Votre inscription est confirmée !','Paiement de test vérifié. Votre place est réservée. Aucun argent réel n’a été débité.');
    if(['expired','failed'].includes(state))return page(200,'Paiement non finalisé','Aucune inscription confirmée. Les places ont été libérées.');
    if(state!=='pending')return page(404,'Réservation','Lien de suivi inconnu.');
    return page(200,'Vérification du paiement','La réservation reste en attente de confirmation Stripe. Si vous avez quitté le paiement, les places sont libérées après expiration confirmée de la session.','<p><a class="btn" href="/reservation/paiement?t='+token+'">Actualiser le statut</a></p>');
   }catch{return page(503,'Vérification indisponible','Réessayez plus tard, sans effectuer un nouveau paiement.');}
  }
  if(request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  try{
   const raw=await bytes(request,512*1024);
   if(!await verifyStripeSignature(raw,request.headers.get('Stripe-Signature'),env.NAITEA_STRIPE_TEST_WEBHOOK_SECRET))return json(400,{error:'INVALID_SIGNATURE'});
   const e=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),obj=e.data?.object;
   if(e.livemode!==false||!EVENTS.has(e.type)||obj?.metadata?.naitea_kind!=='workshop_test')return json(200,{received:true});
   if(!ACCOUNT.test(e.account||'')||!SESSION.test(obj.id||'')||!UUID.test(obj.metadata.naitea_booking_id||''))return json(400,{error:'INVALID_EVENT'});
   const bookingId=obj.metadata.naitea_booking_id,held=await db('naitea_get_workshop_checkout',{p_booking_id:bookingId,p_account:e.account});
   if(!held)return json(200,{received:true,ignored:true});
   if(held.session_id&&held.session_id!==obj.id)return json(409,{error:'SESSION_MISMATCH'});
   // Retrieve on the same connected account; never trust the browser or the event amount alone.
   const s=await stripe(env,fetchImpl,'/v1/checkout/sessions/'+obj.id,{account:e.account});
   if(!validSession(s,{...held,booking_id:bookingId})||s.id!==obj.id)return json(409,{error:'PAYMENT_MISMATCH'});
   const outcome=paymentOutcome(e.type,s);
   if(!outcome)return json(200,{received:true,pending:true});
   const result=await db('naitea_settle_workshop_checkout',{p_booking_id:bookingId,p_account:e.account,p_session:s.id,p_amount:s.amount_total,p_currency:s.currency,p_outcome:outcome});
   if(result?.code==='CONFIRMED'){
    // Only the transaction which first confirms the booking claims the email.
    let sent=false;
    if(result.email===c.testEmail&&result.workshop){
     try{const response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'api-key':c.brevo,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'Naïtéa',email:c.sender},to:[{email:result.email}],...workshopEmail('confirmed',result.workshop,result.first_name,result.seats,'',{amount_cents:result.amount_cents})})});sent=response.ok;response.body?.cancel().catch(()=>{});}catch{}
    }
    return json(200,{received:true,confirmed:true,mail:sent?'accepted':'unconfirmed'});
   }
   if(['RELEASED','ALREADY_SETTLED'].includes(result?.code))return json(200,{received:true});
   return json(409,{error:'SETTLEMENT_CONFLICT'});
  }catch{return json(503,{error:'WEBHOOK_UNAVAILABLE'});}
 };
}
