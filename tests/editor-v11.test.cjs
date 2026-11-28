const { test } = require('node:test');
const assert = require('node:assert/strict');
const rich = require('../assets/rich-text.js');
const tools = require('../assets/naitea-tools.js');
const text = { type: 'text', text: 'Première ligne\nDeuxième ligne', font: 'DM Sans', size: 24, weight: 400, color: '#5B3A48' };
test('only the selected line receives bold, italic, underline and color', () => {
  const styled = rich.apply(text, 0, 14, { weight: 700, italic: true, underline: true, color: '#336699' });
  assert.equal(styled.text, text.text);
  assert.equal(styled.runs.length, 2);
  assert.equal(styled.runs[0].text, 'Première ligne');
  assert.equal(styled.runs[0].weight, 700);
  assert.equal(styled.runs[0].italic, true);
  assert.equal(styled.runs[1].weight, 400);
  assert.equal(styled.runs[1].italic, false);
  assert.equal(styled.runs[1].color, '#5B3A48');
  const copy = JSON.parse(JSON.stringify(styled));
  assert.deepEqual(rich.runs(copy), styled.runs);
});
test('text replacement retains formatting on untouched words', () => {
  const styled = rich.apply(text, 0, 14, { underline: true });
  const next = rich.setText(styled, 'Première ligne\nDernière ligne');
  assert.equal(rich.at(next, 3).underline, true);
  assert.equal(rich.at(next, 21).underline, false);
  assert.equal(next.runs.map(r => r.text).join(''), next.text);
});
test('line and letter spacing affect exported layout and preserve explicit breaks', () => {
  const layer = { ...text, size: 10, lineHeight: 2, letterSpacing: 2 };
  const lines = rich.layout(layer, 500, () => 5);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].y, 20);
  assert.equal(lines[0].segments.reduce((sum, s) => sum + s.width, 0), 14 * 7);
  assert(rich.layout(layer, 30, () => 5).length > 2);
});
test('image fitting preserves aspect ratio when its frame is resized and panned', () => {
  const first = tools.imagePlacement({ fit: 'cover' }, 200, 100, 100, 100);
  assert.deepEqual(first, { width: 200, height: 200, x: 0, y: -50 });
  const resized = tools.imagePlacement({ fit: 'cover', cropZoom: 2, cropX: 50 }, 300, 200, 100, 100);
  assert.equal(resized.width / resized.height, 1);
  assert.equal(resized.width, 600);
  assert.equal(resized.x, 0);
});
test('category and date identify the same registered workshop', () => {
  const state = { events: [{ id: 'a', category: 'Massage bébé', date: '2026-12-01' }, { id: 'b', category: 'Massage bébé', date: '2026-12-08' }, { id: 'c', category: 'Portage', date: '2026-12-08' }], offers: [], leads: [], family: [{ id: 'one', name: 'Alice', email: 'alice@example.test' }, { id: 'two', name: 'Zoé', email: 'zoe@example.test' }], signups: [{ eventId: 'a', email: 'alice@example.test', status: 'confirmed' }, { eventId: 'b', email: 'zoe@example.test', status: 'confirmed' }, { eventId: 'c', email: 'alice@example.test', status: 'confirmed' }] };
  assert.equal(tools.filterFamilies(state, { category: 'Massage bébé' }).length, 2);
  assert.deepEqual(tools.filterFamilies(state, { category: 'Massage bébé', date: '2026-12-08' }).map(f => f.id), ['two']);
});
test('highlight and effects stay confined to the selected words and survive text edits', () => {
  const styled = rich.apply(text, 0, 14, { highlight: '#D89328', effect: 'shadow' });
  assert.equal(rich.at(styled, 2).highlight, '#D89328');
  assert.equal(rich.at(styled, 20).highlight, '');
  const changed = rich.setText(styled, 'Première ligne\nAutre ligne');
  assert.equal(rich.at(changed, 2).effect, 'shadow');
  assert.equal(rich.at(changed, 20).effect, 'none');
  assert.equal(rich.at(rich.apply(styled, 0, 14, { highlight: '' }), 2).highlight, '');
});
test('bullets apply to selected paragraphs and preserve the other paragraphs and their formatting', () => {
  const styled = rich.apply(text, 15, 29, { italic: true });
  const one = rich.toggleBullets(styled, 2, 8);
  assert.equal(one.text, '• Première ligne\nDeuxième ligne');
  assert.equal(rich.at(one, 23).italic, true);
  const restored = rich.toggleBullets(one, 2, 8);
  assert.equal(restored.text, text.text);
  assert.equal(rich.at(restored, 21).italic, true);
});
