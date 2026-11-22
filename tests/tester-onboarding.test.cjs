const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/tester-onboarding.js');

function storage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('callbacks stay on the current origin and offer destinations cannot become open redirects', () => {
  for (const origin of ['https://preview.example.test', 'http://localhost:4182', 'http://127.0.0.1:4182']) {
    assert.equal(T.confirmationURL(origin), origin + '/connexion.html');
    const next = new URL(T.destination(origin, 'complet'));
    assert.equal(next.origin, origin); assert.equal(next.pathname, '/bienvenue.html');
    assert.equal(next.searchParams.get('offre'), 'complet'); assert.equal(next.hash, '');
  }
  for (const invalid of ['http://remote.test', 'javascript:alert(1)', 'https://me:secret@example.test', 'https://example.test/path', 'https://example.test?next=other', 'https://example.test#token']) assert.throws(() => T.confirmationURL(invalid));
  assert.throws(() => T.destination('https://preview.test', 'fiche', '//other.test'));
  assert.throws(() => T.destination('https://preview.test', 'fiche', '/pro?next=other'));
  assert.equal(T.destination('https://preview.test', 'https://evil.test'), 'https://preview.test/bienvenue.html');
  assert.equal(T.destination('https://preview.test', 'fiche', '/connexion.html'), 'https://preview.test/connexion.html?offre=fiche&mode=login');
});

test('only a temporary offer preference is stored, never an identity, token, or paid entitlement', () => {
  const state = storage(); T.remember(state, 'complet', 10000);
  assert.deepEqual([...state.values.values()].map(JSON.parse), [{ offer: 'complet', savedAt: 10000 }]);
  assert.equal(T.recall(state, 10001), 'complet');
  assert.equal(T.recall(state, 10000 + 7 * 24 * 3600000 + 1), ''); assert.equal(state.values.size, 0);
  T.remember(state, { session: true, access_token: 'fake' }, 10000); assert.equal(state.values.size, 0);
  T.remember(state, 'fiche', 20000); assert.equal(T.recall(state, 10000), ''); assert.equal(state.values.size, 0);
  state.setItem('naitea-tester-offer-v1', JSON.stringify({ offer: 'complet', session: true }));
  assert.equal(T.recall(state, 30000), '');
  assert.doesNotThrow(() => T.remember(undefined, 'complet')); assert.equal(T.recall(undefined), '');
});

test('offer validation rejects arbitrary values and malformed stored content', () => {
  for (const value of [null, undefined, '', 'pro', '<script>', 'COMPLET', ['complet']]) assert.equal(T.offer(value), '');
  assert.equal(T.offer('fiche'), 'fiche'); assert.equal(T.offer('complet'), 'complet');
  assert.equal(T.recall(storage({ 'naitea-tester-offer-v1': '{broken' })), '');
});
