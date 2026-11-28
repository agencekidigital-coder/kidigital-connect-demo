import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentFields} from '../server/workshops.mjs';
test('legacy requests preserve previous payment settings',()=>assert.deepEqual(paymentFields({price_cents:5000}),{}));
test('valid workshop payment modes are normalized',()=>{
 for(const mode of ['onsite','online','choice'])assert.deepEqual(paymentFields({price_cents:4500,payment_mode:mode,deposit_cents:null}),{payment_mode:mode,deposit_cents:null});
 assert.deepEqual(paymentFields({price_cents:0,payment_mode:'free',deposit_cents:null}),{payment_mode:'free',deposit_cents:null});
 assert.deepEqual(paymentFields({price_cents:4500,payment_mode:'deposit',deposit_cents:1500}),{payment_mode:'deposit',deposit_cents:1500});
});
test('reject inconsistent amounts and unsupported modes',()=>{
 for(const p of [{price_cents:100,payment_mode:'free',deposit_cents:null},{price_cents:0,payment_mode:'online',deposit_cents:null},{price_cents:5000,payment_mode:'deposit',deposit_cents:5000},{price_cents:5000,payment_mode:'deposit',deposit_cents:0},{price_cents:5000,payment_mode:'deposit',deposit_cents:1.5},{price_cents:5000,payment_mode:'onsite',deposit_cents:500},{price_cents:5000,payment_mode:'unknown',deposit_cents:null},{price_cents:5000,payment_mode:'online'}])assert.throws(()=>paymentFields(p));
});
