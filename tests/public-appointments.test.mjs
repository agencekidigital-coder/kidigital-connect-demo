import test from 'node:test';import assert from 'node:assert/strict';
import {renderAppointmentForm} from '../server/public-appointments.mjs';
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
