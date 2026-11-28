const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/social-statistics.js');
test('French CSV preserves missing numbers and quoted multiline titles', () => {
  const rows = S.parseReport('\uFEFFTitre;Date de publication;Vues;Couverture;J’aime;Commentaires;Partages\r\n"Atelier;\nmassage";20/11/2026;100;80;0;4;\r\nPortage;21/11/2026;20;15;2;;1', 'instagram');
  assert.equal(rows.length, 2); assert.equal(rows[0].likes, 0); assert.equal(rows[0].shares, null);
  assert.equal(rows[0].date, '2026-11-20'); assert.match(rows[0].title, /massage/);
  assert.deepEqual(S.totals(rows), { views: 120, impressions: null, reach: 95, likes: 2, reactions: null, comments: 4, shares: 1, saves: null, clicks: null });
});
test('Meta exports merge by stable publication ID without double counting', () => {
  const a = S.parseReport('Post ID,Title,Publish time,Lifetime Post Total Reach,Lifetime Video Total Views\n42,Massage,2026-11-20 09:00:00,80,120', 'facebook');
  const b = S.parseReport('Post ID,Title,Publish time,Reach,Views\n42,Massage,2026-11-20,100,150', 'facebook');
  assert.equal(S.merge(a, b).length, 1); assert.equal(S.merge(a, b)[0].reach, 100);
  assert.equal(S.merge(a, [{ ...b[0], network: 'instagram' }]).length, 2);
});
test('CSV parsing is bounded and never guesses malformed or negative statistics', () => {
  assert.equal(S.count('1\u202f234'), 1234); assert.equal(S.count('1,234'), null); assert.equal(S.count('-1'), null);
  assert.equal(S.safeURL('https://instagram.com.attacker.test/post'), ''); assert.equal(S.safeURL('javascript:alert(1)'), '');
  assert.throws(() => S.parseReport('Title,Views\n"unfinished,20', 'instagram'));
  assert.throws(() => S.parseReport('Title,Unrelated\nTest,20', 'instagram'));
  assert.throws(() => S.parseReport('a'.repeat(512001), 'instagram'));
  assert.throws(() => S.parseReport('Title,Views\nTest,12', 'whatsapp'));
});

test('impressions and reactions never masquerade as views or likes', () => {
 const [r] = S.parseReport('Title,Impressions,Reactions\nTest,100,12', 'facebook');
 assert.equal(r.views, null); assert.equal(r.likes, null); assert.equal(r.impressions, 100); assert.equal(r.reactions, 12);
});
