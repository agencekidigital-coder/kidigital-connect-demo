import test from 'node:test';import assert from 'node:assert/strict';
import {renderAppointmentForm,renderAppointmentCalendar} from '../server/public-appointments.mjs';
import {appointmentEmail} from '../server/workshop-email.mjs';
test('Public appointment form uses one choice, escapes content and preserves displayed tariff',()=>{
 const s={title:'Sommeil <script>',description:'<img onerror=x>',price_cents:6500,duration_minutes:60,slots:[{rule_id:'12345678-1234-4234-8234-123456789012',modality:'video',location_details:'Google Meet',starts_at:'2026-12-01T09:00:00Z',ends_at:'2026-12-01T10:00:00Z'}]};
 const html=renderAppointmentForm(s,'12345678-1234-4234-8234-123456789012','2026-12-01',{site:'fake-site-key'},'fake-key','2026-11-27');
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
 const html=renderAppointmentForm(s,'12345678-1234-4234-8234-123456789012','2026-12-05',{site:'fake'},'fake','2026-11-27',{month:'2026-12',availability:[{date:'2026-12-05',modalities:['video']}]},true);
 assert(!html.includes('<form'));assert(!html.includes('cf-turnstile'));assert(html.includes('target="_blank"'));assert(html.includes('60 min'));
});
