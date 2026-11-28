const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../assets/site-import-tools.js');
test('explicit prices and durations are parsed without turning missing values or ranges into free/fixed offers', () => {
  assert.equal(T.priceFromText('Tarif : 65,50 €'), 65.5);
  assert.equal(T.priceFromText('Atelier gratuit'), 0);
  for (const value of ['Sur devis', 'À partir de 50 €', '50 à 70 €', '50 € et 70 €', 'Un accompagnement sans prix']) assert.equal(T.priceFromText(value), null);
  assert.equal(T.durationMinutes('Durée : 1h30'), 90); assert.equal(T.durationMinutes('PT45M'), 45);
  assert.equal(T.durationMinutes('45 à 60 min'), null); assert.equal(T.durationMinutes('Durée selon les besoins'), null);
});
test('structured Service/Offer prices retain only explicit euro data and leave unknown fields empty', () => {
  const data = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Service', name: 'Bain enveloppé', description: 'Séance à domicile.', duration: 'PT1H30M', offers: { '@type': 'Offer', price: '70.50', priceCurrency: 'EUR' } },
    { '@type': 'Service', name: 'Accompagnement sans tarif', description: 'À préciser ensemble.' },
    { '@type': 'Offer', price: '50', priceCurrency: 'USD', itemOffered: { '@type': 'Service', name: 'Prestation hors euros' } },
    { '@type': 'Offer', price: '55', priceCurrency: 'EUR', itemOffered: { '@type': 'Service', name: 'Séance reliée à son tarif' } },
    { '@type': 'Service', name: 'Tarif variable', description: 'À partir de 50 €', offers: { '@type': 'Offer', price: '50', priceCurrency: 'EUR' } },
    { '@type': 'Service', name: 'Deux formats', offers: [{ '@type': 'Offer', price: '50', priceCurrency: 'EUR' }, { '@type': 'Offer', price: '80', priceCurrency: 'EUR' }] },
  ] };
  const offers = T.structuredOffers(data), bath = offers.find(o => o.title === 'Bain enveloppé');
  assert.equal(bath.price, 70.5); assert.equal(bath.durationMinutes, 90); assert.deepEqual(bath.modalities, ['À domicile']);
  const unknown = offers.find(o => o.title === 'Accompagnement sans tarif'); assert.equal(unknown.price, null); assert.equal(unknown.durationMinutes, null);
  assert.equal(offers.find(o => o.title === 'Prestation hors euros').price, null);
  assert.equal(offers.find(o => o.title === 'Séance reliée à son tarif').price, 55);
  assert.equal(offers.find(o => o.title === 'Tarif variable').price, null);
  assert.equal(offers.find(o => o.title === 'Deux formats').price, null);
});
test('pasted text is bounded, meaningful offers require review, and active or credentialed sources cannot be saved', () => {
  const result = T.extractText('Massage bébé\nUn atelier pour découvrir des gestes doux.\nTarif : 30 €\nDurée : 60 min\nEn cabinet');
  assert.equal(result.offers.length, 1); assert.equal(result.offers[0].price, 30); assert.equal(result.offers[0].durationMinutes, 60);
  assert.throws(() => T.extractText('a'.repeat(T.MAX_BYTES + 1)));
  assert.throws(() => T.validateOffer({ title: 'Sans tarif', price: '', durationMinutes: '', modalities: [] }));
  assert.throws(() => T.validateOffer({ title: 'À vérifier', price: 20, durationMinutes: 60, modalities: [] }));
  const value = T.validateOffer({ title: 'Prestation vérifiée', price: '0', durationMinutes: 60, modalities: ['En cabinet'], source: 'javascript:alert(1)' });
  assert.equal(value.price, 0); assert.equal(value.source, '');
  assert.equal(T.safeURL('https://user:password@example.test/'), '');
});
