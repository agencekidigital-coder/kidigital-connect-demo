const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/google-reviews.js');
const place = 'ChIJ_test_place_123';
function response() { return { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }; }
async function withConfig(key, id, fn) {
  const oldKey = process.env.GOOGLE_PLACES_API_KEY, oldPlace = process.env.GOOGLE_PLACES_PLACE_ID, oldFetch = global.fetch;
  if (key) process.env.GOOGLE_PLACES_API_KEY = key; else delete process.env.GOOGLE_PLACES_API_KEY;
  if (id) process.env.GOOGLE_PLACES_PLACE_ID = id; else delete process.env.GOOGLE_PLACES_PLACE_ID;
  try { await fn(); } finally {
    if (oldKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY; else process.env.GOOGLE_PLACES_API_KEY = oldKey;
    if (oldPlace === undefined) delete process.env.GOOGLE_PLACES_PLACE_ID; else process.env.GOOGLE_PLACES_PLACE_ID = oldPlace;
    global.fetch = oldFetch;
  }
}
test('unconfigured connection returns an honest state without contacting Google', async () => {
  await withConfig(null, null, async () => {
    global.fetch = () => { throw Error('Must not call provider'); };
    const status = response(); await handler({ method: 'GET', query: { status: '1' } }, status);
    assert.equal(status.body.configured, false);
    const res = response(); await handler({ method: 'GET', query: {} }, res);
    assert.equal(res.code, 503); assert.equal(res.body.code, 'GOOGLE_NOT_CONFIGURED');
    assert.equal(res.headers['Cache-Control'], 'no-store');
  });
});
test('only the configured establishment and required aggregate fields are requested', async () => {
  await withConfig('test-only-secret', place, async () => {
    let calls = 0;
    global.fetch = async (url, options) => {
      calls++;
      assert(url.startsWith('https://places.googleapis.com/v1/places/' + place));
      assert.equal(options.headers['X-Goog-Api-Key'], 'test-only-secret');
      assert.equal(options.headers['X-Goog-FieldMask'].includes('reviews'), false);
      return { ok: true, json: async () => ({ id: place, displayName: { text: 'Établissement de test' }, rating: 4.8, userRatingCount: 42, googleMapsUri: 'https://www.google.com/maps?cid=123', attributions: [{ provider: 'Test provider' }] }) };
    };
    const invalid = response(); await handler({ method: 'GET', query: { placeId: 'other' } }, invalid);
    assert.equal(invalid.code, 400); assert.equal(calls, 0);
    const res = response(); await handler({ method: 'GET', query: {} }, res);
    assert.equal(calls, 1); assert.equal(res.body.rating, 4.8); assert.equal(res.body.count, 42);
    assert.equal(JSON.stringify(res.body).includes('test-only-secret'), false);
    assert.equal(res.body.attributions[0].name, 'Test provider');
  });
});
test('wrong place, upstream failure and writes cannot change displayed figures', async () => {
  await withConfig('test-only-secret', place, async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'different', displayName: { text: 'Wrong' }, rating: 5 }) });
    const wrong = response(); await handler({ method: 'GET', query: {} }, wrong); assert.equal(wrong.code, 502);
    global.fetch = async () => ({ ok: false, status: 403 });
    const failed = response(); await handler({ method: 'GET', query: {} }, failed); assert.equal(failed.code, 502);
    const write = response(); await handler({ method: 'POST', query: {} }, write); assert.equal(write.code, 405);
    assert.equal(write.headers.Allow, 'GET');
  });
});
