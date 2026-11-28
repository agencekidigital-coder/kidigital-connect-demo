const { test } = require('node:test'), assert = require('node:assert/strict');
const G = require('../server/google-connection.cjs'), { createHandler } = require('../api/google.js');
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test-key', GOOGLE_OAUTH_CLIENT_ID: 'test-client', GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret', GOOGLE_CONNECTION_SECRET: 'a-long-random-secret-for-unit-tests-only', GOOGLE_OAUTH_REDIRECT_URI: 'https://preview.example.test/api/google?action=callback' };
const timestamp = Date.parse('2026-11-20T12:00:00Z'), bearer = 'Bearer ' + 'x'.repeat(40);
const tokenCookie = subject => G.cookie(G.TOKEN_COOKIE, G.seal({ subject, access: 'TEST_ACCESS_TOKEN', refresh: 'TEST_REFRESH_TOKEN', accessExpires: timestamp + 3600000, expires: timestamp + 86400000 }, env.GOOGLE_CONNECTION_SECRET, 'tokens')).split(';')[0];
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
async function call(handler, action, { method = 'GET', input, cookie, origin, auth = bearer, query = {} } = {}) {
  const result = { headers: {} }, res = { setHeader(name, value) { result.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { result.code = this.statusCode; result.body = body; return this; }, end() { result.code = this.statusCode; return this; } };
  await handler({ method, query: { action, ...query }, body: input, headers: { host: 'preview.example.test', ...(auth ? { authorization: auth } : {}), ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } }, res);
  return result;
}
test('unconfigured Google is dormant and does not expose keys or make requests', async () => {
  let calls = 0; const h = createHandler({ env: {}, fetcher: async () => calls++ });
  assert.deepEqual((await call(h, 'status')).body, { configured: false, connected: false });
  assert.equal((await call(h, 'start')).code, 503); assert.equal(calls, 0);
});
test('encrypted cookie tokens are purpose-bound, tamper resistant and expire', () => {
  const sealed = G.seal({ token: 'PRIVATE', expires: timestamp + 1000 }, env.GOOGLE_CONNECTION_SECRET, 'tokens');
  assert(!sealed.includes('PRIVATE')); assert.equal(G.unseal(sealed, env.GOOGLE_CONNECTION_SECRET, 'tokens', timestamp).token, 'PRIVATE');
  assert.equal(G.unseal(sealed, env.GOOGLE_CONNECTION_SECRET, 'flow', timestamp), null);
  assert.equal(G.unseal(sealed, env.GOOGLE_CONNECTION_SECRET, 'tokens', timestamp + 1000), null);
  assert.equal(G.unseal(sealed.slice(0, -5) + 'abcde', env.GOOGLE_CONNECTION_SECRET, 'tokens', timestamp), null);
});
test('OAuth start uses PKCE, a short-lived state cookie and exact callback; unbound callbacks are rejected', async () => {
  const h = createHandler({ env, now: () => timestamp, fetcher: async url => { assert(url.includes('/auth/v1/user')); return response({ id: 'owner-a' }); } });
  const start = await call(h, 'start'); assert.equal(start.code, 200);
  const url = new URL(start.body.url); assert.equal(url.hostname, 'accounts.google.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(url.searchParams.get('redirect_uri'), env.GOOGLE_OAUTH_REDIRECT_URI);
  assert.match(start.headers['Set-Cookie'][0], /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  assert(!JSON.stringify(start.body).includes('test-secret'));
  const callback = await call(h, 'callback', { auth: '', query: { state: url.searchParams.get('state'), code: 'valid-code-for-testing' } }); assert.equal(callback.code, 303); assert(callback.headers.Location.endsWith('google=refuse'));
});
test('mutation requests reject wrong origins and Google sessions from another app user', async () => {
  let count = 0; const h = createHandler({ env, now: () => timestamp, fetcher: async () => { count++; return response({ id: 'owner-b' }); } });
  assert.equal((await call(h, 'reply', { method: 'POST', origin: 'https://evil.example', cookie: tokenCookie('owner-a') })).code, 403); assert.equal(count, 0);
  assert.equal((await call(h, 'reviews', { method: 'POST', cookie: tokenCookie('owner-a'), input: {} })).code, 401); assert.equal(count, 1);
});
test('all review pages are read, answered reviews are excluded and summary belongs to the selected establishment', async () => {
  const urls = [], h = createHandler({ env, now: () => timestamp, fetcher: async url => {
    urls.push(url); if (url.includes('/auth/v1/user')) return response({ id: 'owner-reviews' });
    if (url.includes('businessinformation')) return response({ title: 'Établissement test', metadata: { mapsUri: 'https://maps.google.com/test' } });
    if (url.includes('pageToken=next')) return response({ reviews: [{ reviewId: 'older', comment: 'Sans réponse', starRating: 'FIVE' }], averageRating: 4.8, totalReviewCount: 20 });
    return response({ reviews: [{ reviewId: 'done', reviewReply: { comment: 'Merci' }, starRating: 'FIVE' }], nextPageToken: 'next', averageRating: 4.8, totalReviewCount: 20 });
  } });
  const r = await call(h, 'reviews', { method: 'POST', cookie: tokenCookie('owner-reviews'), input: { location: 'accounts/a/locations/l' } });
  assert.equal(r.code, 200); assert.equal(r.body.reviews.length, 1); assert.equal(r.body.reviews[0].id, 'older'); assert.equal(r.body.title, 'Établissement test'); assert.equal(r.body.totalReviewCount, 20);
  assert(urls.some(u => u.includes('pageToken=next')));
});
test('review publication requires explicit confirmation and cannot target an arbitrary URL', async () => {
  const calls = [], h = createHandler({ env, now: () => timestamp, fetcher: async (url, options) => { calls.push({ url, options }); return response(url.includes('/auth/v1/user') ? { id: 'owner-publish' } : { comment: 'Merci' }); } });
  const input = { location: 'accounts/a/locations/l', review: 'r1', reply: 'Merci pour votre retour.' };
  assert.equal((await call(h, 'reply', { method: 'POST', cookie: tokenCookie('owner-publish'), input })).code, 400);
  assert.equal((await call(h, 'reply', { method: 'POST', cookie: tokenCookie('owner-publish'), input: { ...input, confirmed: true, location: 'https://evil.example' } })).code, 400);
  assert.equal((await call(h, 'reply', { method: 'POST', cookie: tokenCookie('owner-publish'), input: { ...input, confirmed: true } })).body.published, true);
  const publication = calls.find(c => c.options.method === 'PUT'); assert.equal(publication.url, 'https://mybusiness.googleapis.com/v4/accounts/a/locations/l/reviews/r1/reply'); assert.equal(JSON.parse(publication.options.body).comment, input.reply);
});
test('calendar payloads force privacy and an existing invited event cannot acquire a private family roster', async () => {
  const source = { summary: 'Atelier', start: { dateTime: '2026-12-01T10:00:00Z' }, end: { dateTime: '2026-12-01T11:00:00Z' }, description: 'Inscrits (usage professionnel privé)\nFamille <test@example.test>', visibility: 'public', guestsCanSeeOtherGuests: true };
  assert.equal(G.cleanCalendar(source).visibility, 'private'); assert.equal(G.cleanCalendar(source).guestsCanSeeOtherGuests, false);
  const calls = [], h = createHandler({ env, now: () => timestamp, fetcher: async (url, options) => { calls.push({ url, options }); return response(url.includes('/auth/v1/user') ? { id: 'owner-calendar' } : { attendees: [{ email: 'invited@example.test' }] }); } });
  const r = await call(h, 'calendar', { method: 'POST', cookie: tokenCookie('owner-calendar'), input: { confirmed: true, eventId: 'e1', payload: source } });
  assert.equal(r.code, 400); assert.equal(calls.filter(c => c.options.method === 'PATCH' || c.options.method === 'POST').length, 0);
});
