const test=require('node:test'),assert=require('node:assert/strict');
const {dayOf,plusDay,monday,optionLabel}=require('../assets/pro-appointments.js');
test('Agenda calendar and modality display',()=>{assert.equal(monday('2026-11-27'),'2026-11-23');assert.equal(plusDay('2026-12-31',1),'2027-01-01');assert.equal(dayOf('2026-11-27T23:30:00Z'),'2026-11-28');assert.equal(optionLabel({modality:'video',location_details:'Google Meet'}),'En visio · Google Meet');});
