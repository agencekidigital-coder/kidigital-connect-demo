const test=require('node:test'),assert=require('node:assert/strict');
const {minutes,clock,priceCents}=require('../assets/pro-services.js');
test('Individual session time and euro inputs',()=>{assert.equal(minutes('09:30'),570);assert.equal(clock(570),'09:30');assert.equal(clock(1440),'24:00');assert(Number.isNaN(minutes('25:00')));assert(Number.isNaN(minutes('09:60')));assert.equal(priceCents('45,50'),4550);assert.equal(priceCents('0'),0);assert.throws(()=>priceCents('-1'));assert.throws(()=>priceCents('1.234'));});
