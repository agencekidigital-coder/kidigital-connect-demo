const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Preview = require('../assets/beta-preview.js');

test('preview locks identify unavailable integrations without disabling local creative tools', () => {
  for (const value of ['communaute', 'community']) assert.equal(Preview.featureFor({ 'data-nav': value }), 'community');
  assert.equal(Preview.featureFor({ 'data-nav': 'automations' }), 'automations');
  for (const value of ['connect-google', 'load-google-reviews', 'disconnect-google', 'publish-google-reply']) {
    assert.equal(Preview.featureFor({ 'data-platform': value }), 'google');
  }
  assert.equal(Preview.featureFor({ form: 'berceauReminderSettings', name: 'sms' }), 'sms');
  assert.equal(Preview.featureFor({ form: 'naiteaCalendarForm', type: 'submit' }), 'google');
  for (const attributes of [
    { 'data-nav': 'communication' }, { 'data-nav': 'studio' }, { 'data-nav': 'familles' },
    { 'data-nav': 'facturation' }, { 'data-action': 'share-marketing' },
    { 'data-platform': 'draft-description' }, { 'data-review': 'generate' },
    { 'data-platform': 'calendar-ics' }, { 'data-platform': 'contact-email' },
    { form: 'berceauReminderSettings', name: 'email' },
  ]) assert.equal(Preview.featureFor(attributes), '', JSON.stringify(attributes));
});

// Execute the real portable-link decoder in isolation; no browser, credentials,
// accounts or network are needed to exercise the untrusted URL boundary.
const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = app.indexOf('function v8LoadShared() {');
const end = app.indexOf('\nlet v8Shared = v8LoadShared();', start);
assert(start > 0 && end > start);
const loadSharedSource = app.slice(start, end) + '\nresult = v8LoadShared();';
const packed = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const workshop = overrides => ({ id: 'atelier_123-ab', title: 'Portage physiologique', date: '2026-12-01', time: '10:00', capacity: 8, price: 35, duration: '90 min', ...overrides });
function decode({ id, data, key = 'atelier', hash = '', query } = {}) {
  const params = new URLSearchParams(query);
  if (id !== undefined) params.set(key, id);
  if (data !== undefined) params.set('event', packed(data));
  const sandbox = {
    location: { search: '?' + params, hash }, state: { events: [] },
    URLSearchParams, TextDecoder, Uint8Array, atob,
    v8Date: day => new Date(day + 'T12:00:00Z'),
    v8ISO: date => date.toISOString().slice(0, 10),
  };
  vm.runInNewContext(loadSharedSource, sandbox);
  return JSON.parse(JSON.stringify({ result: sandbox.result, events: sandbox.state.events }));
}

test('portable workshop IDs cannot introduce HTML attributes into the workspace', () => {
  for (const id of ['e1" onmouseover="alert(1)', '<svg/onload=alert(1)>', 'bad/id', 'a'.repeat(81), 'é1', 'e1\n']) {
    for (const key of ['atelier', 'embed']) {
      const value = decode({ id, key, data: workshop({ id }) });
      assert(value.result.error, id); assert.equal(value.result.id, ''); assert.deepEqual(value.events, []);
      const noPayload = decode({ id, key });
      assert(noPayload.result.error); assert.deepEqual(noPayload.events, []);
    }
  }
});

test('hash-based shared links reject injected, malformed and empty IDs', () => {
  for (const hash of ['#atelier=' + encodeURIComponent('x" autofocus onfocus="alert(1)'), '#atelier=%E0%A4%A', '#atelier=' + 'x'.repeat(81), '#atelier=']) {
    const value = decode({ hash }); assert(value.result.error); assert.equal(value.result.id, ''); assert.deepEqual(value.events, []);
  }
  assert(decode({ id: '' }).result.error);
  assert.equal(decode().result, undefined);
});

test('valid public workshop links still decode and discard unexpected private fields', () => {
  const source = workshop({ duration: 'a'.repeat(200), participants: ['private@example.test'], token: 'not-public' });
  for (const key of ['atelier', 'embed']) {
    const value = decode({ id: source.id, key, data: source });
    assert.equal(value.result.error, ''); assert.equal(value.result.id, source.id);
    assert.equal(value.events.length, 1); assert.equal(value.events[0].duration.length, 80);
    assert.equal(value.events[0].participants, undefined); assert.equal(value.events[0].token, undefined);
  }
  assert.equal(decode({ hash: '#atelier=' + source.id }).result.id, source.id);
});

test('mismatched or malformed packed workshops never mutate the workspace', () => {
  for (const data of [null, {}, workshop({ id: 'different' }), workshop({ date: '2026-02-30' }), workshop({ capacity: -1 })]) {
    const value = decode({ id: 'atelier_123-ab', data }); assert(value.result.error); assert.deepEqual(value.events, []);
  }
});
