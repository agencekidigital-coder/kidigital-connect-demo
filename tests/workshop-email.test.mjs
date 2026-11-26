import test from 'node:test';
import assert from 'node:assert/strict';
import {workshopEmail} from '../server/workshop-email.mjs';
const w={title:'Atelier <test>',starts_at:'2099-12-17T13:00:00Z',timezone_name:'Europe/Paris',modality:'video',video_platform:'Zoom',price_cents:2000,pricing_unit:'person'};
test('confirmed and waiting emails retain branding and escape personalised data',()=>{
 const confirmed=workshopEmail('confirmed',w,'<Camille>',1);
 assert.match(confirmed.htmlContent,/naitea-logo\.png/);assert.match(confirmed.htmlContent,/#590425/);assert.match(confirmed.htmlContent,/Bonjour &lt;Camille&gt;/);assert.match(confirmed.htmlContent,/\/ personne/);assert(!confirmed.htmlContent.includes('/ duo'));assert(!confirmed.htmlContent.includes('@@'));assert(!confirmed.htmlContent.includes('<Camille>'));
 const waiting=workshopEmail('waiting',{...w,pricing_unit:'duo'},'Camille',2);
 assert.match(waiting.htmlContent,/Aucune place r&#233;serv&#233;e/);assert.match(waiting.htmlContent,/duo parent-enfant/);assert.match(waiting.htmlContent,/Places demand&#233;es/);assert.match(waiting.subject,/liste d’attente/);
});
test('email headings keep final punctuation attached to the preceding word',()=>{assert.match(workshopEmail('confirmed',w,'Camille',1).htmlContent,/confirm&#233;e&nbsp;!<\/h1>/);assert.match(workshopEmail('waiting',w,'Camille',1).htmlContent,/attente&nbsp;!<\/h1>/);});

test('email HTML is ASCII safe even for personalised accents and non-Latin text',()=>{const m=workshopEmail('confirmed',{...w,title:'Éveil bébé'},'Élodie',1);assert(!/[^\x00-\x7F]/.test(m.htmlContent));assert.match(m.htmlContent,/Bonjour &#201;lodie/);assert.match(m.htmlContent,/&#201;veil b&#233;b&#233;/);assert.match(m.textContent,/Élodie/);});
