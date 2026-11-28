const { test } = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../assets/professional-profile.js');

test('a cancellation policy accepts explicit HTTP(S) links without credentials', () => {
  assert.equal(profile.safePolicyURL(' https://pro.example/conditions?lang=fr#report '), 'https://pro.example/conditions?lang=fr#report');
  assert.equal(profile.safePolicyURL('http://pro.example/conditions'), 'http://pro.example/conditions');
  for (const value of ['', '/conditions', 'javascript:alert(1)', 'data:text/html,hello', 'mailto:pro@example.test', 'https://name:secret@pro.example/conditions', 'ftp://pro.example/conditions']) {
    assert.equal(profile.safePolicyURL(value), '', value);
  }
});

test('public profile keeps existing policy text and never invents a policy link', () => {
  const empty = profile.normalise();
  assert.equal(empty.cancellation, '');
  assert.equal(empty.cancellationURL, '');
  const stored = profile.normalise({ cancellation: 'Nous contacter pour un report.', cancellationURL: 'http://pro.example/report', unrelatedPrivateData: 'private' });
  assert.equal(stored.cancellation, 'Nous contacter pour un report.');
  assert.equal(stored.cancellationURL, 'http://pro.example/report');
  assert.equal(stored.unrelatedPrivateData, undefined);
  assert.equal(profile.normalise({ cancellationURL: 'javascript:alert(1)' }).cancellationURL, '');
});
