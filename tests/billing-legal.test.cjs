const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../assets/billing-legal.js');
const { createDocument, createCredit, pdfBytes, emailFor } = require('../assets/billing-demo.js');
require('../assets/billing-fonts.js');
const seller = { name: 'Professionnelle de test', entity: 'ei', street: 'Adresse fictive', postalCode: '00000', city: 'Ville fictive', country: 'France', taxRegime: 'taxed', vatId: 'FR00000000000', vatRate: 20, giftTaxMode: 'single', giftTaxKnown: true };
const purchase = { key: 'gift:legal-test', sourceId: 'DEMO-LEGAL-TEST', kind: 'gift', title: 'Bon cadeau : accompagnement', coveredService: 'Séance de démonstration', recipient: 'Bénéficiaire fictif', name: 'Acheteur fictif', email: 'test@example.test', totalCents: 12000, billingAddressOpposed: true };
const now = '2026-11-20T12:00:00Z';
test('a single-purpose gift invoice splits an inclusive price into exact HT and TVA', () => {
  const d = createDocument([], purchase, seller, now);
  assert.equal(L.documentTitle(d), 'Facture de bon cadeau');
  assert.equal(d.legal.tax.netCents, 10000); assert.equal(d.legal.tax.vatCents, 2000);
  assert.equal(d.legal.tax.netCents + d.legal.tax.vatCents, d.totalCents);
  assert.equal(d.legal.coveredService, purchase.coveredService); assert.equal(d.legal.recipient, purchase.recipient);
  assert.equal(d.legal.live, false); assert(d.legal.missing.includes('SIREN valide'));
});
test('multiple-purpose gifts never show TVA or an HT/TTC split at issue', () => {
  const d = createDocument([], purchase, { ...seller, giftTaxMode: 'multiple' }, now);
  assert.equal(L.documentTitle(d), 'Reçu d’achat de bon cadeau');
  assert.equal(d.legal.tax.vatCents, null); assert.equal(d.legal.tax.netCents, null);
  assert.match(d.legal.tax.mention, /aucune TVA facturée à l’émission/);
  assert(!L.preview(d, String).includes('<span>Total HT'));
});
test('franchise and exemption use their own basis; an unknown regime never invents zero TVA', () => {
  const franchise = L.tax(6550, { ...seller, taxRegime: 'franchise' }, 'offer');
  assert.equal(franchise.vatCents, 0); assert.match(franchise.mention, /L. 223 et s./);
  assert.equal(L.tax(6550, { ...seller, taxRegime: 'unset' }, 'offer').vatCents, null);
  assert.equal(L.tax(6550, { ...seller, giftTaxKnown: false }, 'gift').ready, false);
  const exempt = L.tax(6550, { ...seller, taxRegime: 'exempt', exemption: 'Référence de test à confirmer' }, 'offer');
  assert.equal(exempt.vatCents, 0); assert.equal(exempt.mention, 'Référence de test à confirmer');
});
test('a redeemed single-purpose gift is excluded from the VAT base and only its complement is invoiced', () => {
  const p = { ...purchase, kind: 'offer', key: 'offer:partial', totalCents: 15000, giftCents: 12000, redeemedGift: { singlePurpose: true, amountCents: 12000 } };
  const d = createDocument([], p, seller, now);
  assert.equal(L.amount(d), 3000); assert.equal(L.documentTitle(d), 'Facture du complément');
  assert.equal(d.legal.tax.netCents, 2500); assert.equal(d.legal.tax.vatCents, 500);
  assert.match(emailFor(d).body, /Montant du document fictif : 30,00\s€\./);
  assert(!emailFor(d).body.includes('150,00'));
  const credit = createCredit([d], d, now); assert.equal(credit.totalCents, 3000); assert.equal(credit.giftCents, 0);
  const full = createDocument([], { ...p, totalCents: 12000 }, seller, now);
  assert.equal(L.amount(full), 0); assert.equal(L.documentTitle(full), 'Attestation d’utilisation du bon'); assert.equal(createCredit([full], full, now), null);
  const multi = createDocument([], { ...p, redeemedGift: { singlePurpose: false, amountCents: 12000 } }, seller, now);
  assert.equal(multi.legal.tax.netCents, 12500); assert.equal(multi.legal.tax.vatCents, 2500);
});
test('legal snapshots, buyer opposition and original tax survive later edits and credits', () => {
  const original = createDocument([], purchase, seller, now), frozen = structuredClone(original);
  const nextSeller = { ...seller, vatRate: 10, street: 'Nouvelle adresse' }; createDocument([original], { ...purchase, key: 'gift:next' }, nextSeller, now);
  assert.deepEqual(original, frozen); assert.equal(original.legal.buyer.addressOpposed, true); assert(!('phone' in original.legal.buyer));
  const pdf = Buffer.from(pdfBytes(original)).toString('ascii'); assert(pdf.includes('/FontFile2')); assert(!pdf.includes(purchase.name));
});
test('legal fields are bounded and business identifiers are checked without guessing identities', () => {
  assert.equal(L.validIdentifier('000000000', 9), false); assert.equal(L.validIdentifier('123456789', 9), false);
  const s = L.seller({ name: 'x'.repeat(1000), siren: 'un identifiant', taxRegime: 'invalid', giftTaxMode: 'invalid' });
  assert.equal(s.name.length, 150); assert.equal(s.taxRegime, 'unset'); assert.equal(s.giftTaxMode, 'unclassified');
  const missing = L.missing(s); assert(missing.includes('SIREN valide')); assert(missing.includes('Régime de TVA'));
});
