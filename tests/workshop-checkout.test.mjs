import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutParams,verifyStripeSignature,paymentOutcome,checkoutEnabled} from '../server/workshop-checkout.mjs';
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
