const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readPublicConfig } = require('../server/public-config.cjs');
const { createHandler } = require('../api/public-config.js');

const publicKey = 'sb_publishable_' + 'public-fixture-'.repeat(3);
const base = { SUPABASE_URL: 'https://project-fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: publicKey };
const jwt = (payload, header = { alg: 'HS256', typ: 'JWT' }) => [header, payload]
  .map(value => Buffer.from(JSON.stringify(value)).toString('base64url'))
  .concat('fixture-signature').join('.');
const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
function call(env, method = 'GET') {
  const result = response();
  createHandler({ env })({ method }, result);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
  return result;
}

test('only browser configuration is disclosed, with modern or legacy public credentials', () => {
  for (const key of [publicKey, jwt({ role: 'anon', ref: 'project-fixture', iss: 'supabase' })]) {
    const result = call({ ...base, SUPABASE_URL: base.SUPABASE_URL + '/', SUPABASE_PUBLISHABLE_KEY: key,
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-fixture', STRIPE_SECRET_KEY: 'payment-only-fixture' });
    assert.equal(result.code, 200);
    assert.deepEqual(result.body, { url: base.SUPABASE_URL, publishableKey: key });
    assert.equal(JSON.stringify(result.body).includes('server-only-fixture'), false);
    assert.equal(JSON.stringify(result.body).includes('payment-only-fixture'), false);
  }
});

test('privileged, malformed and missing credentials fail closed without disclosing any configuration', () => {
  const credentials = [undefined, null, 42, {}, '', 'sb_secret_server-only-fixture', 'public-fixture',
    jwt({ role: 'service_role' }), jwt({ role: 'authenticated' }), jwt({ role: 'admin' }), jwt({}),
    jwt({ role: 'anon' }, { alg: 'none' }), 'not-json.not-json.not-json',
    jwt({ role: 'anon' }).split('.').slice(0, 2).join('.'), publicKey + '\n'];
  for (const key of credentials) {
    const result = call({ ...base, SUPABASE_PUBLISHABLE_KEY: key });
    assert.equal(result.code, 503);
    assert.deepEqual(result.body, { error: 'Configuration Supabase indisponible.' });
    assert.equal(JSON.stringify(result.body).includes('project-fixture'), false);
  }
  assert.equal(readPublicConfig(null), null);
  assert.equal(readPublicConfig({}), null);
});

test('only an HTTPS project origin is accepted, excluding credentials and alternate destinations', () => {
  const destinations = [undefined, 42, 'http://project-fixture.supabase.co', 'https://supabase.co',
    'https://project-fixture.supabase.co.attacker.test', 'https://nested.project-fixture.supabase.co',
    'https://user:password@project-fixture.supabase.co', 'https://project-fixture.supabase.co:443',
    'https://project-fixture.supabase.co:8443', base.SUPABASE_URL + '/rest/v1', base.SUPABASE_URL + '/?',
    base.SUPABASE_URL + '#', ' ' + base.SUPABASE_URL, base.SUPABASE_URL + '\n',
    'https://-project.supabase.co', 'https://project-.supabase.co'];
  for (const url of destinations) {
    const result = call({ ...base, SUPABASE_URL: url });
    assert.equal(result.code, 503, String(url));
    assert.deepEqual(result.body, { error: 'Configuration Supabase indisponible.' });
  }
});

test('writes and unsupported methods never disclose configuration or bypass no-store responses', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']) {
    const result = call(base, method);
    assert.equal(result.code, 405);
    assert.equal(result.headers.Allow, 'GET');
    assert.deepEqual(result.body, { error: 'Méthode non autorisée.' });
  }
});
