const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../assets/platform-tools.js'), B = require('../assets/berceau-tools.js');
test('researched workshop categories include prenatal movement and parent circles without locking custom categories', () => {
  const categories = Object.values(T.categories).flat(); assert(categories.length >= 65); assert.equal(new Set(categories).size, categories.length);
  for (const v of ['Danse prénatale', 'Chant prénatal', 'Cercle futures mamans', 'Cercle jeunes mamans', 'Cercle jeunes parents']) assert(categories.includes(v));
  const data = { category: '__custom', customCategory: 'Ma pratique', workshopModality: 'video', videoPlatform: 'Zoom', audiences: ['Futurs parents'], minAge: '', maxAge: '' };
  assert.equal(T.workshop(data).category, 'Ma pratique'); assert.equal(T.workshop(data).place, 'À distance · Zoom');
  assert.throws(() => T.workshop({ ...data, workshopModality: 'venue' }));
  assert.throws(() => T.workshop({ ...data, ageEnabled: true, minAge: '10', maxAge: '3' }));
});
test('bookings require both names, a valid phone and an allowed modality; home addresses stay conditional', () => {
  const data = { firstName: 'Prénom', lastName: 'Nom', phone: '0600000000', bookingModality: 'En visio' }, modes = ['En visio', 'À domicile'];
  assert.equal(T.booking(data, modes, B.normalisePhone).phone, '+33600000000'); assert.equal(T.booking(data, modes, B.normalisePhone).homeAddress, null);
  for (const patch of [{ firstName: '' }, { lastName: '' }, { phone: '' }, { bookingModality: 'En cabinet' }, { bookingModality: 'À domicile' }]) assert.throws(() => T.booking({ ...data, ...patch }, modes, B.normalisePhone));
  assert.equal(T.booking({ ...data, bookingModality: 'À domicile', homeStreet: 'Rue fictive', homePostalCode: '00000', homeCity: 'Ville fictive' }, modes, B.normalisePhone).homeAddress.street, 'Rue fictive');
});
test('public gift snapshots contain no customer, gift code, token or home address and resist active content', () => {
  const state = { profile: { first: 'Pro', last: 'Démo', phone: 'SECRET_PHONE' }, brand: { name: 'Test', logo: 'javascript:alert(1)' }, offers: [{ id: 'o1', title: 'Offre', price: 45 }], signups: [{ email: 'PRIVATE' }], berceau: { gifts: [{ code: 'SECRET_CODE' }], giftConfig: {} }, tokens: 'SECRET_TOKEN' };
  const encoded = T.encodeGift(state), decoded = T.decodeGift(encoded), json = JSON.stringify(decoded);
  assert(!/PRIVATE|SECRET_|javascript/.test(json)); assert.equal(decoded.offers[0].title, 'Offre'); assert.equal(decoded.design.logo, '');
  assert.equal(T.decodeGift('<script>'), null); assert.equal(T.decodeGift('a'.repeat(16001)), null);
});
test('calendar rosters are private by default and cannot be combined with invitations that expose other families', () => {
  const event = { id: 'e1', title: 'Atelier', date: '2027-01-01', time: '10:00', duration: 60, place: 'Lieu public' };
  const signups = [{ id: 's1', eventId: 'e1', name: 'Famille', email: 'test@example.test', phone: 'PRIVATE_PHONE', homeAddress: 'PRIVATE_ADDRESS', status: 'confirmed' }, { eventId: 'e1', name: 'Annulée', email: 'cancel@example.test', status: 'cancelled' }];
  const roster = T.calendarPayload(event, signups, { includeRoster: true }, B); assert(roster.description.includes('test@example.test')); assert(!roster.attendees); assert.equal(roster.visibility, 'private');
  const invited = T.calendarPayload(event, signups, { includeRoster: true, inviteAttendees: true }, B); assert(!invited.description.includes('test@example.test')); assert.equal(invited.attendees.length, 1); assert.equal(invited.guestsCanSeeOtherGuests, false);
  assert(!/PRIVATE_|Annulée|cancel@/.test(JSON.stringify(roster)));
});
test('descriptions use the title and place benefits after the programme; chatbot answers remain public and bounded', () => {
  const copy = T.description({ title: 'Massage bébé', audiences: ['Jeunes parents'] }); assert(copy.indexOf('Au programme') < copy.indexOf('Les bienfaits')); assert(copy.includes('Pour bébé')); assert(copy.includes('Pour vous'));
  assert.match(T.chatAnswer('Mon bébé a de la fièvre', { profile: {} }), /15 ou le 112/);
  assert(!T.chatAnswer('Quel accompagnement ?', { profile: {}, offers: [{ title: 'Test', price: 30 }], signups: [{ email: 'PRIVATE' }] }).includes('PRIVATE'));
});
