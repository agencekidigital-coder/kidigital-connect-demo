const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let createAccountHandler;
before(async () => { ({ createAccountHandler } = await import('../server/account-profile.mjs')); });

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const publicKey = 'sb_publishable_' + 'fixture-public-'.repeat(3);
const env = { NAITEA_AUTH_ENABLED: 'true', NAITEA_PROFILE_ENABLED: 'true', SUPABASE_URL: 'https://profile-fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: publicKey };
const token = subject => Buffer.from('{"alg":"HS256"}').toString('base64url') + '.'
  + Buffer.from(JSON.stringify({ sub: subject, role: 'authenticated' })).toString('base64url') + '.fixture-signature';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function request({ method = 'GET', owner = A, body, headers = {}, query = '', raw, stream } = {}) {
  const options = { method, headers: { Authorization: 'Bearer ' + token(owner), ...(method === 'PATCH' ? { Origin: 'https://beta.example.test', 'Content-Type': 'application/json' } : {}), ...headers } };
  if (stream) { options.body = stream; options.duplex = 'half'; }
  else if (raw !== undefined || body !== undefined) options.body = raw ?? JSON.stringify(body);
  return new Request('https://beta.example.test/api/account-profile' + query, options);
}
function mocked(responses) {
  const calls = [];
  const handler = createAccountHandler({ fetchImpl: async (url, options) => {
    calls.push({ url: String(url), ...options });
    const result = responses.shift();
    if (!result) throw Error('Unexpected provider call');
    if (result instanceof Error) throw result;
    return result;
  } });
  return { handler, calls };
}
function streamed(bytes, declared) {
  const state = { cancelled: false, delivered: 0 };
  const stream = new ReadableStream({
    pull(controller) {
      if (state.delivered >= bytes.length) return controller.close();
      const chunk = bytes.slice(state.delivered, state.delivered + 1024);
      state.delivered += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  const headers = { 'Content-Type': 'application/json', ...(declared === undefined ? {} : { 'Content-Length': declared }) };
  return { response: new Response(stream, { headers }), state };
}
function noStore(response) {
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
}
async function error(response, status, code) {
  assert.equal(response.status, status);
  noStore(response);
  const data = await response.json();
  if (code) assert.equal(data.code, code);
  assert.deepEqual(Object.keys(data).sort(), ['code', 'error']);
  const output = JSON.stringify(data);
  for (const secret of [publicKey, token(A), 'provider-private-fixture', 'server-only-fixture', 'parent-private-fixture', 'PGRST']) assert.equal(output.includes(secret), false);
  return data;
}

test('disabled flags and unsafe public configuration fail closed without provider calls', async () => {
  for (const changes of [{ NAITEA_AUTH_ENABLED: undefined }, { NAITEA_PROFILE_ENABLED: undefined }, { NAITEA_AUTH_ENABLED: true }, { NAITEA_PROFILE_ENABLED: 'false' }]) {
    const { handler, calls } = mocked([]);
    await error(await handler(request(), { ...env, ...changes }), 423, 'PROFILE_DISABLED');
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = mocked([]);
  await error(await handler(request(), { ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_server-only-fixture' }), 503);
  await error(await handler(request(), { ...env, SUPABASE_URL: 'https://profile-fixture.supabase.co.attacker.test' }), 503);
  assert.equal(calls.length, 0);
});

test('verified identity selects only its profile; forged client subject cannot choose another owner', async () => {
  for (const owner of [A, B]) {
    const forged = owner === A ? B : A;
    const { handler, calls } = mocked([json({ id: owner, email: 'parent-private-fixture', user_metadata: { role: 'admin' } }),
      json([{ id: owner, full_name: 'Camille', business_name: null, private_field: 'provider-private-fixture' }])]);
    const result = await handler(request({ owner: forged }), { ...env, SUPABASE_SERVICE_ROLE_KEY: 'server-only-fixture' });
    assert.equal(result.status, 200); noStore(result);
    assert.deepEqual(await result.json(), { profile: { full_name: 'Camille', business_name: null } });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, env.SUPABASE_URL + '/auth/v1/user');
    const endpoint = new URL(calls[1].url);
    assert.equal(endpoint.pathname, '/rest/v1/naitea_profiles');
    assert.equal(endpoint.searchParams.get('id'), 'eq.' + owner);
    assert.equal(endpoint.searchParams.get('select'), 'id,full_name,business_name');
    for (const call of calls) {
      assert.equal(call.method, 'GET'); assert.equal(call.redirect, 'manual');
      assert(call.signal instanceof AbortSignal);
      assert.equal(call.headers.apikey, publicKey);
      assert.equal(call.headers.Authorization, 'Bearer ' + token(forged));
    }
  }
});

test('PATCH normalizes permitted fields and updates only the remotely verified existing profile', async () => {
  const { handler, calls } = mocked([json({ id: A }), json([{ id: A, full_name: 'Élodie', business_name: 'Mon cocon' }])]);
  const result = await handler(request({ method: 'PATCH', owner: B, body: { full_name: '  E\u0301lodie  ', business_name: '  Mon cocon  ' } }), env);
  assert.equal(result.status, 200); noStore(result);
  assert.deepEqual(await result.json(), { profile: { full_name: 'Élodie', business_name: 'Mon cocon' } });
  assert.equal(calls[0].method, 'GET'); assert.equal(calls[1].method, 'PATCH');
  assert.equal(new URL(calls[1].url).searchParams.get('id'), 'eq.' + A);
  assert.equal(calls[1].headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(calls[1].body), { full_name: 'Élodie', business_name: 'Mon cocon' });
  assert.equal(calls[1].headers.Authorization, 'Bearer ' + token(B));
});

test('empty or null business names are allowed without inserting or upserting any row', async () => {
  for (const business_name of ['', null]) {
    const { handler, calls } = mocked([json({ id: A }), json([{ id: A, full_name: null, business_name }])]);
    const result = await handler(request({ method: 'PATCH', body: { business_name } }), env);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { profile: { full_name: null, business_name } });
    assert.deepEqual(JSON.parse(calls[1].body), { business_name });
    assert.equal(calls[1].headers.Prefer, 'return=representation');
    assert.equal(calls.some(call => call.method === 'POST'), false);
  }
});

test('missing profile and unauthorized or unexpected returned rows never claim a successful save', async () => {
  for (const method of ['GET', 'PATCH']) {
    const { handler, calls } = mocked([json({ id: A }), json([])]);
    await error(await handler(request({ method, ...(method === 'PATCH' ? { body: { full_name: 'Camille' } } : {}) }), env), 404, 'PROFILE_NOT_FOUND');
    assert.equal(calls.length, 2);
  }
  for (const rows of [[{ id: B, full_name: 'Autre', business_name: null }], [{ id: A }, { id: A }], { id: A }]) {
    const { handler } = mocked([json({ id: A }), json(rows)]);
    await error(await handler(request(), env), 503, 'PROFILE_UNAVAILABLE');
  }
});

test('legacy oversize or malformed stored names produce a conflict instead of silent truncation', async () => {
  for (const fields of [{ full_name: 'a'.repeat(121), business_name: null }, { full_name: 'Camille', business_name: 'b'.repeat(161) },
    { full_name: 123, business_name: null }, { full_name: 'Camille\n', business_name: null }, { full_name: 'Camille' }]) {
    const { handler } = mocked([json({ id: A }), json([{ id: A, ...fields }])]);
    await error(await handler(request(), env), 409, 'PROFILE_DATA_INVALID');
  }
});

test('unsupported methods, missing or excessive bearer credentials and URL selectors are rejected locally', async () => {
  for (const options of [{ method: 'POST' }, { headers: { Authorization: '' } }, { headers: { Authorization: 'Bearer not-a-jwt' } },
    { headers: { Authorization: 'Bearer a.b.' + 'c'.repeat(8192) } }, { query: '?id=' + B }, { query: '?select=*' }, { query: '?' }]) {
    const { handler, calls } = mocked([]);
    const result = await handler(request(options), env);
    const expected = options.method ? 405 : options.query ? 400 : 401;
    await error(result, expected);
    if (expected === 405) assert.equal(result.headers.get('allow'), 'GET, HEAD, PATCH');
    assert.equal(calls.length, 0);
  }
});

test('PATCH requires the exact origin and JSON media type before any provider operation', async () => {
  for (const [headers, status] of [[{ Origin: '' }, 403], [{ Origin: 'null' }, 403], [{ Origin: 'https://beta.example.test.attacker.test' }, 403],
    [{ Origin: 'https://beta.example.test/' }, 403], [{ Origin: 'http://beta.example.test' }, 403], [{ 'Content-Type': 'text/plain' }, 415]]) {
    const { handler, calls } = mocked([]);
    await error(await handler(request({ method: 'PATCH', body: { full_name: 'Camille' }, headers }), env), status);
    assert.equal(calls.length, 0);
  }
});

test('PATCH rejects privileged or unknown fields, empty patches, invalid JSON and invalid names locally', async () => {
  const bodies = [{ id: B }, { role: 'admin' }, { email: 'parent-private-fixture' }, { full_name: 'Camille', created_at: 'now' },
    {}, [], null, { full_name: '' }, { full_name: '  ' }, { full_name: null }, { full_name: 'a'.repeat(121) },
    { full_name: 'Camille\t' }, { full_name: 'Camille\ud800' }, { business_name: 'b'.repeat(161) }, { business_name: false }, { business_name: 'Nom\u007f' }];
  for (const body of bodies) {
    const { handler, calls } = mocked([]);
    await error(await handler(request({ method: 'PATCH', body }), env), 400, 'INVALID_PROFILE');
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = mocked([]);
  await error(await handler(request({ method: 'PATCH', raw: '{not-json' }), env), 400);
  assert.equal(calls.length, 0);
});

test('the 2048-byte body limit is enforced while streaming even with a false or absent content length', async () => {
  for (const declared of [undefined, '1']) {
    const chunks = [new TextEncoder().encode('{"full_name":"'), new Uint8Array(2048).fill(97), new TextEncoder().encode('"}')];
    const stream = new ReadableStream({ pull(controller) { const chunk = chunks.shift(); if (chunk) controller.enqueue(chunk); else controller.close(); } });
    const { handler, calls } = mocked([]);
    await error(await handler(request({ method: 'PATCH', stream, headers: declared ? { 'Content-Length': declared } : {} }), env), 413, 'PAYLOAD_TOO_LARGE');
    assert.equal(calls.length, 0);
  }
  const { handler, calls } = mocked([]);
  await error(await handler(request({ method: 'PATCH', body: { full_name: 'Camille' }, headers: { 'Content-Length': '2049' } }), env), 413);
  await error(await handler(request({ method: 'PATCH', raw: '{"full_name":"' + 'é'.repeat(1100) + '"}' }), env), 413);
  assert.equal(calls.length, 0);
});

test('provider authentication, database denials, rate limits, redirects and invalid responses fail safely', async () => {
  for (const [responses, status] of [
    [[json({ message: 'provider-private-fixture' }, 401)], 401],
    [[json({ message: 'provider-private-fixture' }, 403)], 401],
    [[json({ message: 'provider-private-fixture' }, 429)], 503],
    [[new Response(null, { status: 302, headers: { Location: 'https://attacker.test/' } })], 503],
    [[json({ id: 'not-a-uuid' })], 401],
    [[json({ id: A }), json({ code: 'PGRST', hint: 'provider-private-fixture' }, 403)], 403],
    [[json({ id: A }), json({ message: 'provider-private-fixture' }, 401)], 401],
    [[json({ id: A }), json({ message: 'provider-private-fixture' }, 429)], 503],
    [[json({ id: A }), new Response(null, { status: 307, headers: { Location: 'https://attacker.test/' } })], 503],
    [[json({ id: A }), new Response('provider-private-fixture')], 503],
    [[new Error('provider-private-fixture')], 503],
  ]) {
    const { handler, calls } = mocked(responses);
    await error(await handler(request(), env), status);
    assert(calls.length <= 2);
    assert.equal(calls.some(call => call.method === 'PATCH' || call.method === 'POST'), false);
  }
});

test('authentication JSON is bounded at 64 KiB while streaming, regardless of Content-Length', async () => {
  for (const declared of [undefined, '1']) {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: A, user_metadata: { note: 'provider-private-fixture' + 'a'.repeat(100000) } }));
    const upstream = streamed(bytes, declared), { handler, calls } = mocked([upstream.response]);
    await error(await handler(request(), env), 503, 'PROFILE_UNAVAILABLE');
    assert.equal(calls.length, 1);
    assert.equal(upstream.state.cancelled, true);
    assert(upstream.state.delivered <= 64 * 1024 + 1024);
    assert(upstream.state.delivered < bytes.length);
  }
});

test('profile JSON is bounded at 16 KiB for reads and PATCH representations without claiming a save', async () => {
  for (const method of ['GET', 'PATCH']) for (const declared of [undefined, '1']) {
    const bytes = new TextEncoder().encode(JSON.stringify([{ id: A, full_name: 'provider-private-fixture' + 'a'.repeat(50000), business_name: null }]));
    const upstream = streamed(bytes, declared), { handler, calls } = mocked([json({ id: A }), upstream.response]);
    await error(await handler(request({ method, ...(method === 'PATCH' ? { body: { full_name: 'Camille' } } : {}) }), env), 503, 'PROFILE_UNAVAILABLE');
    assert.equal(calls.length, 2);
    assert.equal(upstream.state.cancelled, true);
    assert(upstream.state.delivered <= 16 * 1024 + 1024);
    assert(upstream.state.delivered < bytes.length);
  }
});

test('invalid UTF-8 in either provider response fails instead of replacing or returning private text', async () => {
  for (const stage of ['auth', 'profile']) {
    const prefix = new TextEncoder().encode(stage === 'auth' ? '{"id":"' + A + '","note":"' : '[{"id":"' + A + '","full_name":"');
    const suffix = new TextEncoder().encode(stage === 'auth' ? '"}' : '","business_name":null}]');
    const bytes = new Uint8Array(prefix.length + 2 + suffix.length);
    bytes.set(prefix); bytes.set([0xc3, 0x28], prefix.length); bytes.set(suffix, prefix.length + 2);
    const upstream = streamed(bytes, '1');
    const { handler, calls } = mocked(stage === 'auth' ? [upstream.response] : [json({ id: A }), upstream.response]);
    await error(await handler(request(), env), 503, 'PROFILE_UNAVAILABLE');
    assert.equal(calls.length, stage === 'auth' ? 1 : 2);
  }
});

test('small provider bodies use delivered bytes rather than an exaggerated Content-Length', async () => {
  const authentication = streamed(new TextEncoder().encode(JSON.stringify({ id: A })), '999999999');
  const profile = streamed(new TextEncoder().encode(JSON.stringify([{ id: A, full_name: 'Camille', business_name: null }])), '999999999');
  const { handler } = mocked([authentication.response, profile.response]);
  const result = await handler(request(), env);
  assert.equal(result.status, 200); noStore(result);
  assert.deepEqual(await result.json(), { profile: { full_name: 'Camille', business_name: null } });
});

test('HEAD verifies account access without a response body or write', async () => {
  const { handler, calls } = mocked([json({ id: A }), json([{ id: A, full_name: 'Camille', business_name: null }])]);
  const result = await handler(request({ method: 'HEAD' }), env);
  assert.equal(result.status, 200); noStore(result);
  assert.equal(await result.text(), '');
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET']);
  const disabled = await handler(request({ method: 'HEAD' }), {});
  assert.equal(disabled.status, 423); noStore(disabled);
  assert.equal(await disabled.text(), '');
});
