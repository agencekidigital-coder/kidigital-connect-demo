import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWorkshopPayment} from '../server/bookings.mjs';
test('Choice requires an explicit selection',()=>{assert.equal(selectWorkshopPayment({payment_mode:'choice'},'online'),'online');assert.equal(selectWorkshopPayment({payment_mode:'choice'},'onsite'),'onsite');for(const v of [null,'free','invalid'])assert.throws(()=>selectWorkshopPayment({payment_mode:'choice'},v));});
test('Required online and deposit cannot be downgraded to on-site by the client',()=>{for(const mode of ['online','deposit'])assert.equal(selectWorkshopPayment({payment_mode:mode},'onsite'),'online');});
test('Existing free and on-site workshops keep their behaviour',()=>{for(const mode of ['free','onsite',undefined])assert.equal(selectWorkshopPayment({payment_mode:mode},'online'),'onsite');});
