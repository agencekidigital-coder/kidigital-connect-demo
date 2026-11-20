const { test } = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../assets/professional-profile.js');

test('normalisation preserves optional public data without private records or invented credentials', () => {
  const d = profile.normalise({ specialties: 'Portage, massage bébé, PORTAGE', languages: ['Français', 'Anglais'], audiences: [], signups: [{ email: 'private@example.test' }], qualifications: [{ title: 'Formation test', school: 'Organisme test', year: '2026', verified: true }], addresses: '12 rue de démonstration, Lille\nCabinet test, Annecy' });
  assert.deepEqual(d.specialties, ['Portage', 'massage bébé']);
  assert.equal(d.qualifications[0].verified, undefined);
  assert.equal(d.signups, undefined);
  assert.deepEqual(d.addresses, ['12 rue de démonstration, Lille', 'Cabinet test, Annecy']);
  assert.deepEqual(profile.normalise().qualifications, []);
});
test('public images cannot load tracking URLs or execute SVG content', () => {
  for (const src of ['https://tracker.example/pixel.png', 'data:image/svg+xml,<svg onload=alert(1)>', 'javascript:alert(1)']) assert.equal(profile.safeImage(src), '');
  assert.equal(profile.safeImage('/assets/photos/family-5.jpg'), '/assets/photos/family-5.jpg');
  assert.equal(profile.safeImage('data:image/png;base64,YWJjZA=='), 'data:image/png;base64,YWJjZA==');
});
test('social URLs reject lookalike hosts and credentials', () => {
  for (const url of ['javascript:alert(1)', 'http://linkedin.com/me', 'https://linkedin.com.evil.test/a', 'https://user:pass@linkedin.com/a']) assert.equal(profile.safeURL(url, ['linkedin.com']), '');
  assert.equal(profile.safeURL('https://www.linkedin.com/in/test', ['linkedin.com']), 'https://www.linkedin.com/in/test');
});
test('service filters handle accents and combine with modality', () => {
  const offer = { title: 'Séance bébé', description: 'Portage adapté', modalities: ['À domicile'] };
  assert.equal(profile.matchesOffer(offer, 'bebe', 'À domicile'), true);
  assert.equal(profile.matchesOffer(offer, 'PORTAGE', 'En visio'), false);
  assert.equal(profile.matchesOffer(offer, 'sommeil'), false);
});
test('next appointment chooses a real slot across offers, with no fictional fallback', () => {
  const offers = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const dates = { a: '2026-12-05', b: '2026-12-04', c: null };
  const getSlots = id => id === 'a' ? [{ time: '09:00', duration: 60 }] : id === 'b' ? [{ time: '16:00', duration: 30 }] : [];
  assert.equal(profile.nextAppointment(offers, id => dates[id], getSlots).offer.id, 'b');
  assert.equal(profile.nextAppointment(offers, () => null, () => []), null);
  assert.equal(profile.nextAppointment(offers, () => '2026-12-04', () => []), null);
});
test('map directions are an explicit encoded link', () => {
  const url = new URL(profile.itineraryURL('10 rue Test, Lille & alentours'));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('destination'), '10 rue Test, Lille & alentours');
});
