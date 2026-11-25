const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, OUTPUT } = require('../scripts/build-cloudflare.cjs');
const { legacyDestination } = require('../assets/cloudflare-links.js');
let worker, manifest;
before(async () => { manifest = build(); worker = (await import('../cloudflare/worker.mjs')).default; });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp4': 'video/mp4', '.vtt': 'text/vtt' };
function environment(extra = {}) {
  return { ASSETS: { async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const file = path.resolve(OUTPUT, '.' + pathname);
    if (!file.startsWith(OUTPUT + '/') || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Missing', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : fs.readFileSync(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ETag: '"fixture"' } });
  } }, ...extra };
}
const request = (p, env, method = 'GET') => worker.fetch(new Request('https://naitea-beta.example' + p, { method }), environment(env), { waitUntil() {} });

test('legacy fragment links retain their workshop without creating an open redirect or carrying private query fields', () => {
  const location = { origin: 'https://naitea-beta.example', pathname: '/', hash: '#atelier=abc_12', search: '?access_token=private&event=public-payload' };
  assert.equal(legacyDestination(location), 'https://naitea-beta.example/familles?atelier=abc_12&event=public-payload');
  for (const hash of ['#atelier=', '#atelier=%ZZ', '#atelier=//evil.test', '#atelier=a%22%3E%3Cimg', '#atelier=' + 'x'.repeat(81)]) assert.equal(legacyDestination({ ...location, hash }), '');
  assert.equal(legacyDestination({ ...location, pathname: '/familles' }), '');
});

test('the Cloudflare build publishes only selected pages and resources, never repository internals', () => {
  for (const file of ['index.html', 'pro.html', 'connexion.html', 'bienvenue.html', 'compte.html', 'mes-ateliers.html', 'assets/landing/favicon-transparent.png', 'assets/landing/demo-pro.mp4', 'assets/berceau/transparent/naitea-logo.png']) assert(manifest.files.includes(file));
  assert(manifest.files.every(f => f.startsWith('assets/') || ['index.html', 'pro.html', 'connexion.html', 'bienvenue.html', 'compte.html', 'mes-ateliers.html'].includes(f)));
  assert(!manifest.files.some(f => /(^|\/)(\.git|server|supabase|api|tests|docs|node_modules|\.env|\.dev.vars)(\/|$)/.test(f) || f.endsWith('.zip')));
  assert(!manifest.files.some(f => f.endsWith('.md') || f.startsWith('assets/landing/narration/')));
  const html = fs.readFileSync(path.join(OUTPUT, 'index.html'), 'utf8');
  assert(!html.includes('{{') && !html.includes('data-preview-testimonials'));
  assert(html.includes('name="robots" content="noindex, nofollow"'));
  assert(fs.readFileSync(path.join(OUTPUT, 'pro.html'), 'utf8').includes('/assets/beta-preview.js'));
  assert(!fs.readFileSync(path.join(OUTPUT, 'connexion.html'), 'utf8').includes('/assets/beta-preview.js'));
});

test('landing and app routes remain distinct and every preview is excluded from search indexing', async () => {
  for (const route of ['/', '/decouvrir', '/decouvrir/']) {
    const response = await request(route);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    const html = await response.text();
    assert(html.includes('https://naitea-beta.example/'));
    assert(html.includes('class="hero-summary"'));
    assert(!html.includes('naitea-render.invalid') && !html.includes('data-preview-testimonials'));
    assert(html.includes('rel="canonical" href="https://naitea-beta.example/"'));
  }
  for (const route of ['/pro', '/pro/', '/index.html', '/familles', '/familles/', '/?atelier=e1', '/?embed=e1', '/?boutique-cadeaux=1']) {
    const response = await request(route); assert.equal(response.status, 200);
    assert((await response.text()).includes('/assets/beta-preview.js'));
  }
  assert.equal(await (await request('/robots.txt')).text(), 'User-agent: *\nDisallow: /\n');
  assert(!(await (await request('/sitemap.xml')).text()).includes('<loc>'));
});

test('auth is frame protected and HEAD never returns a body', async () => {
  for (const route of ['/', '/pro', '/connexion.html', '/bienvenue', '/bienvenue.html', '/compte', '/compte.html']) {
    const response = await request(route, {}, 'HEAD');
    assert.equal(response.status, 200); assert.equal(await response.text(), '');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
  const auth = await request('/connexion.html?embed=test');
  assert.equal(auth.headers.get('X-Frame-Options'), 'DENY');
  assert.equal((await request('/connexion%2ehtml?embed=test')).headers.get('X-Frame-Options'), 'DENY');
  assert((await request('/connexion%2ehtml?embed=test')).headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  assert((await request('/connexion.html')).headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
  assert(!(await request('/?embed=e1')).headers.get('Content-Security-Policy').includes('frame-ancestors'));
  assert.equal((await request('/?embed=e1')).headers.get('X-Frame-Options'), null);
  const account = await request('/compte?embed=1');
  assert.equal(account.headers.get('X-Frame-Options'), 'DENY');
  assert(account.headers.get('Content-Security-Policy').includes("default-src 'none'"));
  assert.equal((await request('/compt%65.html')).headers.get('X-Frame-Options'), 'DENY');
});

test('public configuration is closed by default and privileged keys cannot be exposed by an accidental environment change', async () => {
  const valid = { SUPABASE_URL: 'https://exampleproject.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(30) };
  assert.equal((await request('/api/public-config', valid)).status, 503);
  const enabled = await request('/api/public-config', { ...valid, NAITEA_AUTH_ENABLED: 'true' });
  assert.equal(enabled.status, 200); assert.deepEqual(await enabled.json(), { url: valid.SUPABASE_URL, publishableKey: valid.SUPABASE_PUBLISHABLE_KEY });
  const secret = 'sb_secret_' + 'do-not-expose-this'.repeat(3);
  const denied = await request('/api/public-config', { ...valid, NAITEA_AUTH_ENABLED: 'true', SUPABASE_PUBLISHABLE_KEY: secret });
  assert.equal(denied.status, 503); assert(!(await denied.text()).includes(secret));
  assert.equal(denied.headers.get('Cache-Control'), 'no-store');
});

test('account routes remain inactive until both flags and public credentials are valid', async () => {
  for (const method of ['GET', 'HEAD', 'PATCH']) {
    const response = await request('/api/account', {}, method);
    assert.equal(response.status, 423);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    if (method === 'HEAD') assert.equal(await response.text(), '');
  }
  const valid = { SUPABASE_URL: 'https://exampleproject.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(30) };
  for (const flags of [{}, { NAITEA_AUTH_ENABLED: 'true' }, { NAITEA_PROFILE_ENABLED: 'true' }]) {
    assert.equal((await (await request('/api/deployment', { ...valid, ...flags })).json()).accountProfile, false);
    assert.equal((await request('/api/account', { ...valid, ...flags })).status, 423);
  }
  const enabled = { ...valid, NAITEA_AUTH_ENABLED: 'true', NAITEA_PROFILE_ENABLED: 'true' };
  assert.equal((await (await request('/api/deployment', enabled)).json()).accountProfile, true);
  assert.equal((await request('/api/account', enabled)).status, 401);
  assert.equal((await (await request('/api/deployment', { ...enabled, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' })).json()).accountProfile, false);
});

test('Google, AI, payment and admin routes stay blocked independently of their environment values', async () => {
  for (const route of ['/api/google?action=connect', '/api/google-reviews', '/api/workshop-description', '/api/review-reply', '/api/admin', '/api/stripe', '/api/bookings']) {
    const response = await request(route, { GOOGLE_PLACES_API_KEY: 'fixture-only', AI_GATEWAY_API_KEY: 'fixture-only' });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).code, 'FEATURE_UNAVAILABLE');
    assert.equal((await request(route, {}, 'POST')).status, 405);
  }
  const policy = await (await request('/api/deployment')).json();
  for (const flag of ['realBookings', 'payments', 'admin', 'sms', 'remoteAI', 'google', 'meta']) assert.equal(policy[flag], false);
});

test('private files, path traversal, unknown pages and arbitrary image URLs are never served', async () => {
  for (const route of ['/server/public-config.cjs', '/api/landing.js', '/supabase/02-auth-profile-trigger.sql', '/docs/NAITEA-MEMOIRE-PROJET.md', '/tests/cloudflare.test.cjs', '/.git/config', '/.env', '/package.json', '/wrangler.jsonc', '/Kidigital-Connect-V8-deploiement.zip', '/unknown', '/admin']) {
    const response = await request(route); assert([404, 423].includes(response.status), route + ' was exposed');
  }
  for (const route of ['/assets/%2e%2e%2fserver/secret', '/assets/%252e%252e/secret', '/assets/%00.png', '/assets/%5csecret', '/assets/%ZZ']) assert.equal((await request(route)).status, 400, route);
  for (const source of ['https://outside.example/photo.png', '//outside.example/photo.png', '/assets/landing/../../server/key.png', '/assets/font-catalog.json', '/assets/landing/demo-pro.mp4']) {
    assert.equal((await request('/_vercel/image?url=' + encodeURIComponent(source))).status, 400);
  }
  const image = await request('/_vercel/image?url=%2Fassets%2Flanding%2Ffavicon-transparent.png&w=64&q=80');
  assert.equal(image.status, 200); assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.equal((await request('/api/font?family=NotARealFont')).status, 400);
  const font = await request('/api/font?family=DM%20Sans&weight=400');
  assert.equal(font.status, 200); assert((await font.arrayBuffer()).byteLength > 1000);
  assert.equal((await request('/api/font?family=DM%20Sans&weight=9999')).status, 400);
  assert.equal((await request('/api/font?family=Source%20Sans%203&weight=400&license=1')).status, 200);
  assert.equal((await request('/pro', {}, 'POST')).status, 405);
});

test('video range requests support seeking and reject out-of-bounds or malformed ranges', async () => {
  const url = 'https://naitea-beta.example/assets/landing/demo-pro.mp4';
  const bytes = fs.readFileSync(path.join(OUTPUT, 'assets/landing/demo-pro.mp4'));
  const load = (range, other = {}) => worker.fetch(new Request(url, { headers: { Range: range, ...other } }), environment(), {});
  const first = await load('bytes=0-1023');
  assert.equal(first.status, 206); assert.equal(first.headers.get('Content-Length'), '1024');
  assert.deepEqual(Buffer.from(await first.arrayBuffer()), bytes.subarray(0, 1024));
  const tail = await load('bytes=-20'); assert.equal(tail.status, 206);
  assert.deepEqual(Buffer.from(await tail.arrayBuffer()), bytes.subarray(-20));
  for (const range of ['bytes=', 'bytes=20-10', 'bytes=999999999-', 'bytes=0-1,5-10']) {
    const denied = await load(range); assert.equal(denied.status, 416);
    assert.equal(denied.headers.get('Content-Range'), 'bytes */' + bytes.length);
  }
  assert.equal((await load('bytes=0-10', { 'If-Range': '"older-file"' })).status, 200);
});


test('workshop preview page is frame protected and API is closed by default', async () => {
  const page = await request('/mes-ateliers');
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('X-Frame-Options'), 'DENY');
  assert((await page.text()).includes('/assets/workshops-beta.js'));
  assert.equal((await request('/api/workshops')).status, 423);
  assert.equal((await (await request('/api/deployment')).json()).workshopPersistence, false);
});

test('private dashboard bridge is injected into pro without modifying the source demo state',()=>{
  const html=fs.readFileSync(path.join(OUTPUT,'pro.html'),'utf8');
  assert(html.includes('/assets/pro-workshops.js'));
  assert(html.includes("['ateliers','dashboard'].includes(page)"));
  assert(html.includes('calendarState: () => ({date:v8CalDate,view:v8CalView})'));
  assert(manifest.files.includes('assets/pro-workshops.js'));
});

test('real workshop links are closed by default, distinct from fictional packed links',async()=>{
  const route='/atelier/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  for(const suffix of ['', '/photo'])assert.equal((await request(route+suffix)).status,404);
  assert.equal((await (await request('/api/deployment')).json()).workshopPublication,false);
  assert(manifest.files.includes('assets/public-workshop-base.css'));
});
