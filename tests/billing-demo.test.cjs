const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../assets/billing-fonts.js');
const { createDocument, createCredit, emailFor, pdfBytes } = require('../assets/billing-demo.js');
const now = '2026-11-20T12:00:00Z';
const seller = { name: 'Professionnelle fictive', email: 'pro@example.test', address: 'Lille', identifier: '' };
const purchase = { key: 'offer:a1', sourceId: 'a1', kind: 'offer', title: 'Séance de portage', name: 'Famille fictive', email: 'parent@example.test', totalCents: 6550, giftCents: 3000 };

test('purchase documents snapshot supplier, buyer and exact cents without duplicating a purchase', () => {
  const doc = createDocument([], purchase, seller, now);
  assert.equal(doc.number, 'DEMO-2026-0001'); assert.equal(doc.totalCents, 6550); assert.equal(doc.paidCents, 3550);
  assert.equal(doc.type, 'invoice'); assert.equal(doc.status, 'demo'); assert.equal(doc.payment, 'simulated');
  assert.equal(createDocument([doc], purchase, seller, now), null);
  const another = createDocument([doc], { ...purchase, key: 'workshop:s2', kind: 'workshop' }, seller, now);
  assert.equal(another.number, 'DEMO-2026-0002');
  const original = structuredClone(seller); seller.name = 'Nom changé'; assert.equal(doc.seller.name, original.name); seller.name = original.name;
  assert(!('health' in doc)); assert(!('phone' in doc.buyer));
});
test('numbering uses the Paris calendar year and gifts are identified as purchase receipts', () => {
  const first = createDocument([], { ...purchase, key: 'gift:demo', kind: 'gift' }, seller, '2026-12-31T23:30:00Z');
  assert.equal(first.number, 'DEMO-2027-0001'); assert.equal(first.type, 'gift');
  assert.equal(createDocument([first], { ...purchase, key: 'offer:next' }, seller, '2027-01-02T10:00:00Z').sequence, 2);
});
test('invalid prices and voucher settlements cannot produce purchase documents', () => {
  for (const totalCents of [0, -1, 30.5, NaN, 10000001]) assert.throws(() => createDocument([], { ...purchase, totalCents }, seller, now));
  for (const giftCents of [-1, 6551, 10.5]) assert.throws(() => createDocument([], { ...purchase, giftCents }, seller, now));
});
test('a full credit preserves the original, refers to it and cannot be prepared twice', () => {
  const original = createDocument([], purchase, seller, now), snapshot = structuredClone(original);
  const credit = createCredit([original], original, now);
  assert.equal(credit.type, 'credit'); assert.equal(credit.originalId, original.id); assert.equal(credit.totalCents, original.totalCents);
  assert.deepEqual(original, snapshot); assert.equal(createCredit([original, credit], original, now), null);
  assert.equal(createCredit([original, credit], credit, now), null);
});
test('invoice emails stay prepared and reference a real generated PDF without marketing permissions', () => {
  const doc = createDocument([], purchase, seller, now), email = emailFor(doc);
  assert.equal(email.status, 'Préparé, non envoyé'); assert.equal(email.to, purchase.email);
  assert.equal(email.attachments[0].name, doc.number + '.pdf'); assert.equal(email.invoiceId, doc.id);
  assert(!('newsletter' in email)); assert.match(email.body, /Aucun débit, remboursement ni email réel/);
  const bytes = pdfBytes(doc), text = Buffer.from(bytes).toString('ascii');
  assert(text.startsWith('%PDF-1.4')); assert(text.includes('/MediaBox [0 0 595 842]')); assert(text.endsWith('%%EOF\n'));
  assert(text.includes('/FontFile2')); assert(text.includes('/Subtype /TrueType'));
  const xref = Number(text.match(/startxref\n(\d+)/)[1]); assert.equal(text.slice(xref, xref + 4), 'xref');
  assert(!text.includes(purchase.email)); // All customer text is hex-encoded, never raw PDF commands.
});
test('long untrusted document text is hex-encoded and stays above the footer', () => {
  const doc = createDocument([], { ...purchase, title: ') Tj ET /JS (bad) '.repeat(8), name: 'Nom long '.repeat(12), email: 'long'.repeat(35) + '@example.test' }, { ...seller, address: 'Adresse longue '.repeat(16), identifier: 'Identifiant '.repeat(8) }, now);
  const text = Buffer.from(pdfBytes(doc)).toString('ascii');
  assert(!text.includes('/JS')); assert(!text.includes('Adresse longue'));
  assert.match(text, /\/Type \/Pages .* \/Count [12]/);
  const positions = [...text.matchAll(/1 0 0 1 48 (\d+) Tm/g)].map(m => +m[1]);
  assert(positions.every(y => y === 65 || y >= 105));
});
