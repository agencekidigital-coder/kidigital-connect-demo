const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChoice, parseChoice, LIFETIME } = require('../assets/landing/consent.js');
test('accept, refuse and custom choices never activate absent optional services', () => {
  for (const decision of ['accepted', 'refused', 'customized']) {
    const choice = createChoice(decision, 1000);
    assert.equal(choice.necessary, true); assert.equal(choice.analytics, false); assert.equal(choice.advertising, false);
    assert.deepEqual(parseChoice(JSON.stringify(choice), 2000), choice);
  }
});
test('privacy preferences expire after six months and corrupted versions cannot imply consent', () => {
  const choice = createChoice('refused', 1000);
  assert.equal(parseChoice(JSON.stringify(choice), 1000 + LIFETIME), null);
  assert.equal(parseChoice('{', 2000), null);
  assert.equal(parseChoice(JSON.stringify({ ...choice, version: 999 }), 2000), null);
  assert.equal(parseChoice(JSON.stringify({ ...choice, analytics: true }), 2000), null);
  assert.equal(parseChoice(JSON.stringify({ ...choice, savedAt: 1_000_000 }), 2000), null);
  assert.equal(parseChoice(JSON.stringify({ ...choice, expiresAt: Infinity }), 2000), null);
});
test('stored preferences are bounded and never retain personal identifiers', () => {
  const original = createChoice('accepted', 1000);
  const choice = parseChoice(JSON.stringify({ ...original, email: 'private@example.test', visitorId: 'arbitrary-id' }), 2000);
  assert.deepEqual(choice, original);
  assert.throws(() => createChoice('unknown'));
});
