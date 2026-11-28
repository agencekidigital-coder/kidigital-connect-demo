import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutParams,verifyStripeSignature,paymentOutcome,checkoutEnabled,recoverWorkshopPayment,createWorkshopPaymentHandler} from '../server/workshop-checkout.mjs';
const id='12345678-1234-4234-8234-123456789012',hold={booking_id:id,account:'acct_Test',unit_cents:2500,seats:2,amount_cents:5000,title:'Massage bébé',expires_at:1900000000};
test('Checkout price, quantity and metadata come from the server hold; no transfer or fee',()=>{
 const p=checkoutParams(hold,'https://beta.example.com','a'.repeat(64),'test@example.com');
 assert.equal(p.get('line_items[0][price_data][unit_amount]'),'2500');
 assert.equal(p.get('line_items[0][quantity]'),'2');assert.equal(p.get('metadata[naitea_booking_id]'),id);
 assert.equal(p.get('line_items[0][price_data][currency]'),'eur');
 assert.equal(p.get('payment_intent_data[application_fee_amount]'),null);assert.equal(p.get('payment_intent_data[transfer_data][destination]'),null);
 assert.throws(()=>checkoutParams({...hold,amount_cents:1},'https://beta.example.com','a'.repeat(64),'test@example.com'));
});
test('Only terminal verified payment states fulfil or release holds',()=>{
 assert.equal(paymentOutcome('checkout.session.completed',{status:'complete',payment_status:'unpaid'}),null);
 assert.equal(paymentOutcome('checkout.session.completed',{status:'complete',payment_status:'paid'}),'paid');
 assert.equal(paymentOutcome('checkout.session.async_payment_succeeded',{status:'complete',payment_status:'paid'}),'paid');
 assert.equal(paymentOutcome('checkout.session.expired',{status:'expired',payment_status:'unpaid'}),'expired');
 assert.equal(paymentOutcome('checkout.session.async_payment_failed',{status:'complete',payment_status:'unpaid'}),'failed');
 assert.equal(paymentOutcome('checkout.session.expired',{status:'open',payment_status:'unpaid'}),null);
});
test('Webhook signature checks raw body, timestamp, and all v1 signatures',async()=>{
 const enc=new TextEncoder(),body=enc.encode('{"test":true}'),now=1700000000,secret='whsec_test_fake';
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(now+'.{"test":true}'))),v=>v.toString(16).padStart(2,'0')).join('');
 assert.equal(await verifyStripeSignature(body,'t='+now+',v1='+signature,secret,now),true);
 assert.equal(await verifyStripeSignature(enc.encode('{"test":false}'),'t='+now+',v1='+signature,secret,now),false);
 assert.equal(await verifyStripeSignature(body,'t='+now+',v1='+signature,secret,now+301),false);
});
test('Checkout is closed without the complete test configuration',()=>{assert.equal(checkoutEnabled({}),false);assert.equal(checkoutEnabled({NAITEA_WORKSHOP_CHECKOUT_TEST_ENABLED:'true',NAITEA_STRIPE_TEST_ENABLED:'true',NAITEA_STRIPE_TEST_SECRET_KEY:'sk_live_'+ 'a'.repeat(32)}),false);});

const origin='https://beta.example.com',hash='b'.repeat(64),sid='cs_test_Example123';
const env={NAITEA_BOOKINGS_ENABLED:'true',NAITEA_AUTH_ENABLED:'true',NAITEA_WORKSHOPS_ENABLED:'true',NAITEA_PUBLICATION_ENABLED:'true',NAITEA_WORKSHOP_CHECKOUT_TEST_ENABLED:'true',NAITEA_STRIPE_TEST_ENABLED:'true',NAITEA_STRIPE_TEST_SECRET_KEY:'sk_test_'+ 'x'.repeat(32),NAITEA_STRIPE_TEST_WEBHOOK_SECRET:'whsec_'+ 'x'.repeat(32),SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_'+ 'x'.repeat(32),NAITEA_BOOKING_SUPABASE_SECRET:'sb_secret_'+ 'x'.repeat(32),NAITEA_TURNSTILE_SITE_KEY:'testsite12345',NAITEA_TURNSTILE_SECRET_KEY:'testsecret12345',NAITEA_BOOKING_BREVO_KEY:'testbrevo12345',NAITEA_BOOKING_SENDER:'contact@naitea.fr',NAITEA_BOOKING_ORIGIN:origin,NAITEA_BOOKING_TEST_EMAIL:'contact@naitea.fr'};
const c={origin,url:env.SUPABASE_URL,service:env.NAITEA_BOOKING_SUPABASE_SECRET,testEmail:env.NAITEA_BOOKING_TEST_EMAIL};
const record={booking_id:id,stripe_account_id:'acct_Test',session_id:sid,amount_cents:5000,currency:'eur',state:'pending'};
const session={id:sid,livemode:false,mode:'payment',currency:'eur',amount_total:5000,client_reference_id:id,metadata:{naitea_kind:'workshop_test',naitea_booking_id:id},status:'complete',payment_status:'paid'};
function mock(overrides={},row=record){return async(u,o)=>{const url=new URL(u);if(url.hostname==='example.supabase.co'){assert.equal(url.searchParams.get('return_hash'),'eq.'+hash);return Response.json(row?[row]:[]);}assert.equal(url.pathname,'/v1/checkout/sessions/'+sid);assert.equal(o.method,'GET');assert.equal(o.headers['Stripe-Account'],'acct_Test');return Response.json({...session,...overrides});};}
test('Recovery verifies existing session on bound connected account and settles once',async()=>{let writes=0;const db=async(name,p)=>{writes++;assert.equal(name,'naitea_settle_workshop_checkout');assert.deepEqual(p,{p_booking_id:id,p_account:'acct_Test',p_session:sid,p_amount:5000,p_currency:'eur',p_outcome:'paid'});return {code:'ALREADY_SETTLED'};};assert.equal(await recoverWorkshopPayment({db,c,env,fetchImpl:mock(),hash}),'paid');assert.equal(writes,1);});
test('Recovery refuses wrong amount, currency, metadata, session or live payment',async()=>{for(const overrides of [{amount_total:1},{currency:'usd'},{metadata:{}},{id:'cs_test_wrong'},{livemode:true}])await assert.rejects(()=>recoverWorkshopPayment({db:async()=>assert.fail('must not settle'),c,env,fetchImpl:mock(overrides),hash}));});
test('Unpaid completed sessions remain pending and unknown tokens do not settle',async()=>{const db=async()=>assert.fail('must not settle');assert.equal(await recoverWorkshopPayment({db,c,env,fetchImpl:mock({payment_status:'unpaid'}),hash}),'pending');assert.equal(await recoverWorkshopPayment({db,c,env,fetchImpl:mock({},null),hash}),'unknown');});
test('Explicit refresh rejects cross-origin POST before calling providers',async()=>{const h=createWorkshopPaymentHandler({fetchImpl:async()=>assert.fail('must not fetch')});const r=await h(new Request(origin+'/reservation/paiement?t='+hash,{method:'POST',headers:{Origin:'https://other.example.com'}}),env,'/reservation/paiement');assert.equal(r.status,403);});

const ownerId='ab345678-1234-4234-8234-123456789012',wid='cd345678-1234-4234-8234-123456789012';
const syncRequest=()=>new Request(origin+'/api/workshop-payment-sync',{method:'POST',headers:{Origin:origin,Authorization:'Bearer aa.bb.cc','Content-Type':'application/json'},body:JSON.stringify({workshop_id:wid})});
test('Professional sync never queries payments for an unowned workshop',async()=>{
 const h=createWorkshopPaymentHandler({fetchImpl:async(u,o)=>{const path=new URL(u).pathname;if(path==='/auth/v1/user')return Response.json({id:ownerId});if(path==='/rest/v1/naitea_workshops'){assert.equal(o.headers.Authorization,'Bearer aa.bb.cc');return Response.json([]);}assert.fail('must not access payments');}});
 const r=await h(syncRequest(),env,'/api/workshop-payment-sync');assert.equal(r.status,404);
});
test('Professional sync recovers only a verified bound payment in their workshop',async()=>{
 let settled=0;
 const h=createWorkshopPaymentHandler({fetchImpl:async(u,o)=>{
  const url=new URL(u),path=url.pathname;
  if(path==='/auth/v1/user')return Response.json({id:ownerId});
  if(path==='/rest/v1/naitea_workshops'){assert.equal(url.searchParams.get('professional_id'),'eq.'+ownerId);return Response.json([{id:wid,professional_id:ownerId}]);}
  if(path==='/rest/v1/naitea_bookings'){assert.equal(url.searchParams.get('workshop_id'),'eq.'+wid);assert.equal(url.searchParams.get('naitea_workshops.professional_id'),'eq.'+ownerId);return Response.json([{id,workshop_id:wid,naitea_workshops:{professional_id:ownerId}}]);}
  if(path==='/rest/v1/naitea_workshop_test_payments'){if(url.searchParams.has('booking_id'))return Response.json([{booking_id:id,return_hash:hash}]);assert.equal(url.searchParams.get('return_hash'),'eq.'+hash);return Response.json([record]);}
  if(path==='/v1/checkout/sessions/'+sid){assert.equal(o.headers['Stripe-Account'],'acct_Test');assert.equal(o.method,'GET');return Response.json(session);}
  if(path==='/rest/v1/rpc/naitea_settle_workshop_checkout'){settled++;assert.equal(JSON.parse(o.body).p_outcome,'paid');return Response.json({code:'ALREADY_SETTLED'});}
  assert.fail('unexpected request');
 }});
 const r=await h(syncRequest(),env,'/api/workshop-payment-sync');assert.equal(r.status,200);assert.deepEqual(await r.json(),{paid:1,pending:0,expired:0,failed:0,errors:0,more:false});assert.equal(settled,1);
});

test('Deposit checkout charges only the stored deposit and labels it clearly',()=>{const p=checkoutParams({...hold,payment_mode:'deposit',unit_cents:1000,amount_cents:2000},'https://beta.example.com','a'.repeat(64),'test@example.com');assert.equal(p.get('line_items[0][price_data][unit_amount]'),'1000');assert.equal(p.get('line_items[0][price_data][product_data][name]'),'Acompte — Massage bébé');});

test('Recovery distinguishes open unpaid sessions from completed processing sessions without settling',async()=>{for(const [status,expected] of [['open','checkout_open'],['complete','payment_processing']]){const seen=[];assert.equal(await recoverWorkshopPayment({db:async()=>assert.fail('must not settle'),c,env,fetchImpl:mock({status,payment_status:'unpaid'}),hash,diagnose:x=>seen.push(x)}),'pending');assert.deepEqual(seen,[expected]);}});

test('Resume only a verified open checkout for the configured test email; no writes',async()=>{const url='https://checkout.stripe.com/c/pay/'+sid,valid={status:'open',payment_status:'unpaid',customer_email:c.testEmail,expires_at:Math.floor(Date.now()/1000)+600,url};for(const [overrides,expected] of [[{},[url]],[{customer_email:'other@example.com'},[]],[{url:'https://evil.example/c/pay/'+sid},[]],[{url:'https://checkout.stripe.com/c/pay/cs_test_other'},[]],[{expires_at:1},[]]]){const links=[];assert.equal(await recoverWorkshopPayment({db:async()=>assert.fail('must not settle'),c,env,fetchImpl:mock({...valid,...overrides}),hash,resumeTestCheckout:u=>links.push(u)}),'pending');assert.deepEqual(links,expected);}});
