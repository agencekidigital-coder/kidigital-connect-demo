const test=require('node:test'),assert=require('node:assert/strict');
const {phoneValue,normal,contactsCsv,preference}=require('../assets/pro-families.js');
test('CRM phone normalization and accent-insensitive search',()=>{
 assert.equal(phoneValue('06 00 00 00 00'),'+33600000000');
 assert.equal(phoneValue('0032 470 00 00 00'),'+32470000000');
 assert.equal(phoneValue(''),null);assert.throws(()=>phoneValue('123'));
 assert.equal(normal('ÉLODIE'),'elodie');
});
test('CRM CSV excludes notes and children and neutralizes formula cells',()=>{
 const f={first_name:'=1+1',last_name:'Nom "test"',email:'test@example.invalid',phone:'+33600000000',notes:'private note',children:'private child',newsletter_opt_out:true,newsletter_requested_at:'2026-11-27T12:00:00Z',created_at:'2026-11-27T12:00:00Z'};
 const csv=contactsCsv([f]);assert(csv.includes("\"'=1+1\""));assert(csv.includes("\"'+33600000000\""));assert(csv.includes('Nom ""test""'));assert(!csv.includes('private note'));assert(!csv.includes('private child'));assert.equal(preference(f),'Désinscription enregistrée');
 assert.equal(preference({...f,newsletter_opt_out:false}),'Accord déclaré (à vérifier)');assert.equal(preference({}),'Aucun accord enregistré');
});
