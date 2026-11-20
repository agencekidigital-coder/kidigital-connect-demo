const { test } = require('node:test');
const assert = require('node:assert/strict');
const t = require('../assets/berceau-tools.js');
const now = '2026-11-20T12:00:00Z';
const issue = (changes = {}) => t.issueGift({ code: 'DEMO-TEST1234', valueCents: 5000, buyerName: 'Test', buyerEmail: 'test@example.test', recipient: 'Parent fictif', settings: t.giftSettings(), now, ...changes });

test('gift amounts use cents, reject ambiguous values and clamp month expiry', () => {
  assert.equal(t.cents('30,50'), 3050); assert.equal(t.cents('12.10'), 1210);
  assert(t.formatCents(3050).includes('30,50')); assert(!t.formatCents(3000).includes(',00'));
  assert(Number.isNaN(t.cents('1e3'))); assert(Number.isNaN(t.cents('-5'))); assert(Number.isNaN(t.cents('3.123')));
  assert.equal(t.expiresInMonths('2026-01-31T12:00:00Z', 1), '2026-02-28T12:00:00.000Z');
  assert.throws(() => issue({ valueCents: 499 }));
});
test('gifts cover all or part of an eligible reservation and preserve unused balance', () => {
  const gift = issue(), item = { id: 'e1', kind: 'workshop', priceCents: 3000 };
  assert.deepEqual(t.quoteGift(gift, item, now), { ok: true, discountCents: 3000, dueCents: 0, balanceAfterCents: 2000 });
  const used = t.redeemGift(gift, item, 's1', now);
  assert.equal(gift.balanceCents, 5000); assert.equal(used.balanceCents, 2000);
  const next = t.quoteGift(used, { id: 'o1', kind: 'offer', priceCents: 6500 }, now);
  assert.equal(next.dueCents, 4500); assert.equal(next.balanceAfterCents, 0);
  assert.throws(() => t.redeemGift(used, item, 's1', now), /déjà/);
});
test('expired, exhausted, wrong-service and revoked gifts cannot be redeemed', () => {
  const gift = issue({ offerId: 'o1' });
  assert.equal(t.quoteGift(gift, { id: 'o2', kind: 'offer', priceCents: 5000 }, now).ok, false);
  assert.equal(t.quoteGift(gift, { id: 'e1', kind: 'workshop', priceCents: 5000 }, now).ok, false);
  assert.equal(t.quoteGift(gift, { id: 'o1', kind: 'offer', priceCents: 5000 }, gift.expiresAt).ok, false);
  assert.equal(t.quoteGift({ ...gift, balanceCents: 0 }, { id: 'o1', kind: 'offer', priceCents: 1 }, now).ok, false);
  assert.equal(t.quoteGift({ ...gift, status: 'revoked' }, { id: 'o1', kind: 'offer', priceCents: 1 }, now).ok, false);
});
test('cancellation credits a gift once and keeps its original expiry', () => {
  const gift = t.redeemGift(issue(), { id: 'o1', kind: 'offer', priceCents: 3500 }, 'a1', now);
  const result = t.refundCancelledGifts([gift], () => 'cancelled');
  assert.equal(result.gifts[0].balanceCents, 5000); assert.equal(result.gifts[0].expiresAt, gift.expiresAt);
  assert.equal(t.refundCancelledGifts(result.gifts, () => 'cancelled').changed, false);
});
test('Paris appointment instants follow DST and reject invalid local dates', () => {
  assert.equal(t.parisInstant('2026-01-15', '09:00').toISOString(), '2026-01-15T08:00:00.000Z');
  assert.equal(t.parisInstant('2026-07-15', '09:00').toISOString(), '2026-07-15T07:00:00.000Z');
  assert.equal(t.parisInstant('2026-03-29', '02:30'), null);
  assert.equal(t.parisInstant('2026-02-30', '09:00'), null);
});
test('calendar export excludes family coordinates and escapes ICS property injection', () => {
  const entry = t.calendarEntry({ id: 'a1', title: 'Séance, bébé\nATTENDEE:unsafe', date: '2026-12-01', time: '10:00', duration: '1h30', email: 'private@example.test', name: 'Secret client', phone: '0612345678' }, 'offer', 'https://example.test/?vue=parents');
  assert.equal((entry.end - entry.start) / 60000, 90);
  const ics = t.calendarICS([entry], now);
  assert(!ics.includes('private@example.test')); assert(!ics.includes('Secret client')); assert(!ics.includes('0612345678'));
  assert(!ics.includes('\r\nATTENDEE:')); assert(ics.includes('Séance\\, bébé\\nATTENDEE:unsafe'));
  assert(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  const url = new URL(t.googleCalendarURL(entry)); assert.equal(url.origin, 'https://calendar.google.com'); assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('dates'), '20261201T090000Z/20261201T103000Z');
});
test('reminders respect cancellation, dates, channel choices and separate SMS permission', () => {
  const row = { id: 'a1', kind: 'offer', title: 'Démo', date: '2026-11-24', time: '10:00', status: 'confirmed', email: 'family@example.test', phone: '0600000000', smsConsent: false };
  const config = { enabled: true, email: true, sms: true, offerHours: [24, 2, 24], workshopHours: [48] };
  const email = t.reminderPlans([row], config, now); assert.equal(email.length, 2); assert(email.every(r => r.channel === 'email'));
  const both = t.reminderPlans([{ ...row, smsConsent: true }], config, now); assert.equal(both.length, 4); assert.equal(both.find(r => r.channel === 'sms').destination, '+33600000000');
  assert.equal(t.reminderPlans([{ ...row, status: 'cancelled' }], config, now).length, 0);
  assert.equal(t.reminderPlans([row], { ...config, enabled: false }, now).length, 0);
  assert.equal(t.reminderPlans([row], config, '2026-11-24T09:01:00Z').length, 0);
  const jobs = t.syncReminders([], both, now); assert.equal(t.syncReminders(jobs, both, now).length, 4);
  assert(t.syncReminders(jobs, [], now).every(r => r.status === 'cancelled'));
});
test('the local review model does not echo sensitive text or imply a patient relationship', () => {
  const reply = t.localReviewReply({ rating: 2, tone: 'warm', review: 'Email secret@example.test et diagnostic confidentiel' });
  assert(!reply.includes('secret@')); assert(!reply.includes('diagnostic')); assert(reply.includes('privé'));
});
