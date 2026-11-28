import test from 'node:test';import assert from 'node:assert/strict';
import {renderAppointmentForm,renderAppointmentCalendar,bookingSelection,validCoparent} from '../server/public-appointments.mjs';
import {appointmentEmail} from '../server/workshop-email.mjs';
test('Public appointment form uses one choice, escapes content and preserves displayed tariff',()=>{
 const s={title:'Sommeil <script>',description:'<img onerror=x>',price_cents:6500,duration_minutes:60,slots:[{rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',location_details:'Google Meet',starts_at:'2026-12-01T09:00:00Z',ends_at:'2026-12-01T10:00:00Z'}]};
 const html=renderAppointmentForm(s,'12345678-1234-4234-8234-123456789012','2026-12-01',{site:'fake-site-key'},'fake-key','2026-11-27',null,false,s.slots[0].starts_at,s.slots[0].rule_id+'|video|'+s.slots[0].starts_at);
 assert(html.includes('&lt;script&gt;'));assert(!html.includes('<img onerror=x>'));assert(html.includes('name="slot"'));assert(html.includes('data-action="appointment_booking"'));assert(html.includes('name="price" value="6500"'));
});
test('Confirmation reuses branded email shell and does not promise a generated video link',()=>{
 const mail=appointmentEmail({title:'Sommeil <test>',modality:'video',location_details:'Google Meet',price_cents:6500,starts_at:'2026-12-01T09:00:00Z',ends_at:'2026-12-01T10:00:00Z'},'Camille');
 assert(mail.subject.includes('rendez-vous'));assert(mail.htmlContent.includes('&lt;test&gt;'));assert(mail.textContent.includes('sera communiqué'));assert(!/[^\x00-\x7f]/.test(mail.htmlContent));
});

test('Calendar exposes actual dates, modalities and embed navigation',()=>{
 const html=renderAppointmentCalendar('12345678-1234-4234-8234-123456789012','2026-12-05','2026-12',[{date:'2026-12-05',modalities:['practice','video']}],'2026-11-27',true);
 assert(html.includes('date=2026-12-05&amp;embed=1'));assert(html.includes('En cabinet, En visio'));assert(html.includes('aria-current="date"'));assert(!html.includes('date=2026-12-06'));
});
test('Embed has no booking form or challenge',()=>{
 const s={title:'Sommeil',description:'',price_cents:6500,duration_minutes:60,slots:[{rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',starts_at:'2026-12-05T09:00:00Z',ends_at:'2026-12-05T10:00:00Z'}]};
 const html=renderAppointmentForm(s,'12345678-1234-4234-8234-123456789012','2026-12-05',{site:'fake'},'fake','2026-11-27',{month:'2026-12',availability:[{date:'2026-12-05',modalities:['video']}]},true,s.slots[0].starts_at,s.slots[0].rule_id+'|video|'+s.slots[0].starts_at);
 assert(!html.includes('<form'));assert(!html.includes('cf-turnstile'));assert(html.includes('target="_blank"'));assert(html.includes('60 min'));
});

test('Selection validates time and modality together',()=>{
 const a={rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',starts_at:'2026-12-05T09:00:00Z',ends_at:'2026-12-05T10:00:00Z'};
 const b={...a,modality:'home'};
 assert.equal(bookingSelection([a,b],a.starts_at,'').groups.length,1);
 assert.equal(bookingSelection([a,b],a.starts_at,a.rule_id+'|home|'+a.starts_at).selected.modality,'home');
 assert.equal(bookingSelection([a,b],'bad',a.rule_id+'|home|'+a.starts_at).selected,null);
});

test('Booking steps and iframe preserve the choice without exposing a form in the frame',()=>{
 const a={rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',location_details:'Google Meet',starts_at:'2026-12-05T09:00:00Z',ends_at:'2026-12-05T10:00:00Z'};
 const s={title:'Sommeil',description:'',price_cents:6500,duration_minutes:60,slots:[a,{...a,modality:'home'}]};
 const key=a.rule_id+'|video|'+a.starts_at, slug='accompagnement-soutien-allaitement-lille';
 const page=(embed,start='',choice='')=>renderAppointmentForm(s,slug,'2026-12-05',{site:'fake'},'fake','2026-11-27',null,embed,start,choice);
 assert(!page(false).includes('naitea-mode-choice'));assert(!page(false,a.starts_at).includes('name="slot"'));assert(page(false,a.starts_at).includes('À domicile'));
 assert(page(false,a.starts_at,key).includes('action="/'+slug+'"'));assert(page(false,a.starts_at,key).includes('name="slot"'));
 const embedded=page(true,a.starts_at,key);assert(embedded.includes('target="_blank"'));assert(embedded.includes(encodeURIComponent(key)));assert(!embedded.includes('<form'));
});
test('Practical instructions are escaped in the branded confirmation and included in plain text',()=>{
 const mail=appointmentEmail({title:'Sommeil',modality:'video',price_cents:6500,starts_at:'2026-12-01T09:00:00Z',ends_at:'2026-12-01T10:00:00Z',instructions:'Prévoir une serviette.\nTenue <confortable>.'},'Camille');
 assert(mail.htmlContent.includes('Informations utiles'));assert(mail.htmlContent.includes('&lt;confortable&gt;'));assert(mail.textContent.includes('Prévoir une serviette.'));assert(!/[^\x00-\x7f]/.test(mail.htmlContent));
});

 test('Coparent response is an explicit three-way choice',()=>{
  assert(validCoparent('yes'));assert(validCoparent('no'));assert(validCoparent('unsure'));assert(!validCoparent(null));assert(!validCoparent('other'));assert(!validCoparent('constructor'));
  const a={rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',starts_at:'2026-12-05T09:00:00Z',ends_at:'2026-12-05T10:00:00Z'};
  const html=renderAppointmentForm({title:'Sommeil',description:'',price_cents:6500,duration_minutes:60,slots:[a]},'accompagnement-sommeil-lille','2026-12-05',{site:'fake'},'fake','2026-11-27',null,false,a.starts_at,a.rule_id+'|video|'+a.starts_at);
  assert.equal((html.match(/name="coparent"/g)||[]).length,3);assert(html.includes('Je ne sais pas'));assert(!html.includes('name="coparent" value="yes" checked'));
 });
