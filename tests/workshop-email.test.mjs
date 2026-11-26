import test from 'node:test';
import assert from 'node:assert/strict';
import {workshopEmail} from '../server/workshop-email.mjs';
const w={title:'Atelier <test>',starts_at:'2099-12-17T13:00:00Z',timezone_name:'Europe/Paris',modality:'video',video_platform:'Zoom',price_cents:2000,pricing_unit:'person'};
test('confirmed and waiting emails retain branding and escape personalised data',()=>{
 const confirmed=workshopEmail('confirmed',w,'<Camille>',1);
 assert.match(confirmed.htmlContent,/naitea-logo\.png/);assert.match(confirmed.htmlContent,/#590425/);assert.match(confirmed.htmlContent,/Bonjour &lt;Camille&gt;/);assert.match(confirmed.htmlContent,/\/ personne/);assert(!confirmed.htmlContent.includes('/ duo'));assert(!confirmed.htmlContent.includes('@@'));assert(!confirmed.htmlContent.includes('<Camille>'));
 const waiting=workshopEmail('waiting',{...w,pricing_unit:'duo'},'Camille',2);
 assert.match(waiting.htmlContent,/Aucune place réservée/);assert.match(waiting.htmlContent,/duo parent-enfant/);assert.match(waiting.htmlContent,/Places demandées/);assert.match(waiting.subject,/liste d’attente/);
});