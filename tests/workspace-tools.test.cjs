const { test } = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../assets/naitea-tools.js');
test('rebrands saved copy while retaining technical URLs and stored data', () => {
  const original = { text: 'Sur Kidigital Connect : https://kidigital-connect-demo.vercel.app', image: 'data:image/png;base64,abc', count: 2 };
  const next = tools.renameBrand(original);
  assert.equal(next.text, 'Sur Naïtéa : https://kidigital-connect-demo.vercel.app');
  assert.equal(next.image, original.image);
  assert.equal(original.text.startsWith('Sur Kidigital'), true);
});
test('family filters follow registrations and appointments rather than interests', () => {
  const state = {
    family: [{ id: 'a', name: 'Émilie', email: 'a@example.test', interest: 'Massage' }, { id: 'b', name: 'Alice', email: 'b@example.test', interest: 'Massage' }, { id: 'c', name: 'Zoé', email: 'c@example.test' }],
    events: [{ id: 'e', title: 'Massage' }], offers: [{ id: 'o', title: 'Sommeil' }],
    signups: [{ eventId: 'e', email: 'A@EXAMPLE.TEST', status: 'confirmed' }, { eventId: 'e', email: 'c@example.test', status: 'cancelled' }],
    v8: { appointments: [{ offerId: 'o', email: 'b@example.test', status: 'confirmed' }] }, leads: [],
  };
  assert.deepEqual(tools.filterFamilies(state, { type: 'workshop', service: 'workshop:e' }).map(f => f.id), ['a']);
  assert.deepEqual(tools.filterFamilies(state, { type: 'offer', query: 'sommeil' }).map(f => f.id), ['b']);
  assert.deepEqual(tools.filterFamilies(state, { type: 'none' }).map(f => f.id), ['c']);
  assert.deepEqual(tools.filterFamilies(state, { sort: 'asc' }).map(f => f.id), ['b', 'a', 'c']);
});
test('undo skips selection-only snapshots and supports redo and a new edit', () => {
  const h = new tools.DesignHistory(), a = { layers: ['text', 'photo'] }, b = { layers: ['text'] };
  h.commit(a); h.record(a); h.record(a); h.commit(a);
  assert.equal(h.canUndo(a), false);
  h.record(a); h.commit(b); h.record(b); h.commit(b);
  assert.deepEqual(h.undo(b), a);
  h.record(a); h.commit(a); // selection after undo does not lose redo
  assert.deepEqual(h.redo(a), b);
  h.undo(b); h.record(a); h.commit({ layers: ['other'] });
  assert.equal(h.canRedo({ layers: ['other'] }), false);
});
test('every model is editable, uses the brand and has valid geometry', () => {
  const context = { brand: { accent: '#123456', text: '#222222', third: '#FAFAFA', titleFont: 'Lora' }, profile: { first: 'Aline' }, event: { title: 'Massage', date: '2026-12-12', time: '10:00' }, month: '2026-12', offers: [], events: [] };
  for (const template of tools.templates) {
    const d = tools.buildTemplate(template.id, context);
    assert.equal(d.accent, '#123456');
    assert(d.layers.some(l => l.type === 'text'));
    assert.equal(new Set(d.layers.map(l => l.id)).size, d.layers.length);
    for (const l of d.layers) { assert(l.w > 0 && l.x + l.w <= 100); assert(l.y >= 0 && l.y < 100); }
  }
});
