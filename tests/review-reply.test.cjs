const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../api/review-reply.js');
const response = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(data) { this.data = data; return this; } });
const env = { BERCEAU_REVIEW_AI_ENABLED: 'true', AI_GATEWAY_MODEL: 'openai/gpt-4.1-mini', AI_GATEWAY_API_KEY: 'fixture-only', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-fixture', AI_REVIEW_ALLOWED_USER_IDS: 'allowed-fixture' };
const input = { review: 'Avis de démonstration', rating: 5, tone: 'warm', length: 'short', consent: true };
const request = body => ({ method: 'POST', headers: { authorization: 'Bearer fixture-token-for-test-only', host: 'example.test', origin: 'https://example.test' }, body });

test('disabled AI does not call a provider or expose credentials', async () => {
  const handler = createHandler({ env: {}, fetcher: () => { throw Error('Unexpected network'); } });
  const get = response(); await handler({ method: 'GET' }, get); assert.deepEqual(get.data, { configured: false, mode: 'local-demo' });
  const post = response(); await handler(request(input), post); assert.equal(post.statusCode, 503);
});
test('AI requires authentication, origin checks and explicit text sharing', async () => {
  const handler = createHandler({ env, fetcher: () => { throw Error('Unexpected network'); } });
  const anon = response(); await handler({ ...request(input), headers: {} }, anon); assert.equal(anon.statusCode, 401);
  const origin = response(); await handler({ ...request(input), headers: { ...request(input).headers, origin: 'https://other.test' } }, origin); assert.equal(origin.statusCode, 403);
  const consent = response(); await handler(request({ ...input, consent: false }), consent); assert.equal(consent.statusCode, 400);
  const size = response(); await handler(request({ ...input, review: 'a'.repeat(2001) }), size); assert.equal(size.statusCode, 400);
});
test('only an allowed authenticated account can request an editable draft', async () => {
  const calls = [];
  const handler = createHandler({ env, fetcher: async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? { ok: true, json: async () => ({ id: 'allowed-fixture' }) } : { ok: true, json: async () => ({ choices: [{ message: { content: 'Merci pour votre retour.' } }] }) }; } });
  const res = response(); await handler(request(input), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.requiresReview, true); assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://fixture.supabase.co/auth/v1/user');
  assert.equal(calls[1].url, 'https://ai-gateway.vercel.sh/v1/chat/completions');
  const payload = JSON.parse(calls[1].options.body); assert.equal(payload.model, env.AI_GATEWAY_MODEL); assert(payload.messages[0].content.includes('Ne confirme jamais'));
  assert(!JSON.stringify(res.data).includes('fixture-only'));
});
test('an account without explicit permission cannot spend generation credits', async () => {
  let calls = 0;
  const handler = createHandler({ env, fetcher: async () => { calls++; return { ok: true, json: async () => ({ id: 'unapproved-fixture' }) }; } });
  const res = response(); await handler(request(input), res); assert.equal(res.statusCode, 403); assert.equal(calls, 1);
});
