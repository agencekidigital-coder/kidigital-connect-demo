const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, originFor } = require('../api/landing.js');
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.code = value; return this; }, end(value) { this.body = value; return this; } };
}
const request = (overrides = {}) => ({ method: 'GET', headers: { host: 'naitea-preview.vercel.app' }, query: {}, ...overrides });
test('preview HTML has rendered SEO metadata, correct schema and no search indexing', () => {
  const res = response(); createHandler({ env: { VERCEL_ENV: 'preview' } })(request(), res);
  assert.equal(res.code, 200); assert.equal(res.headers['X-Robots-Tag'], 'noindex, nofollow');
  assert(res.body.includes('<link rel="canonical" href="https://naitea-preview.vercel.app/decouvrir">'));
  assert(res.body.includes('name="robots" content="noindex, nofollow"'));
  assert(!res.body.includes('{{'));
  const schema = JSON.parse(res.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@graph'].find(x => x['@type'] === 'WebApplication').name, 'Naïtea');
  assert.equal(schema['@graph'].some(x => x.aggregateRating || x.offers), false);
  const videos = schema['@graph'].filter(x => x['@type'] === 'VideoObject');
  assert.equal(videos.length, 2);
  assert(videos.every(x => x.contentUrl.startsWith('https://naitea-preview.vercel.app/assets/landing/demo-') && x.thumbnailUrl.endsWith('-poster.jpg')));
});
test('production canonical, social metadata and sitemap agree on the approved origin', () => {
  const handler = createHandler({ env: { VERCEL_ENV: 'production', NAITEA_PUBLIC_ORIGIN: 'https://www.naitea.example' } });
  const html = response(); handler(request(), html);
  assert.equal(html.headers['X-Robots-Tag'], undefined);
  assert(html.body.includes('index, follow, max-image-preview:large'));
  assert(html.body.includes('https://www.naitea.example/assets/landing/naitea-social.png'));
  assert(!html.body.includes('https://naitea-preview.vercel.app'));
  const sitemap = response(); handler(request({ query: { format: 'sitemap' } }), sitemap);
  assert.equal(sitemap.headers['Content-Type'], 'application/xml; charset=utf-8');
  assert(sitemap.body.includes('<loc>https://www.naitea.example/decouvrir</loc>'));
});
test('fictional testimonial examples are labelled in preview and excluded from production', () => {
  const preview = response(), production = response();
  createHandler({ env: { VERCEL_ENV: 'preview' } })(request(), preview);
  createHandler({ env: { VERCEL_ENV: 'production' } })(request(), production);
  assert(preview.body.includes('data-preview-testimonials'));
  assert(preview.body.includes('Exemples fictifs pour la maquette. Aucun avis réel à ce stade.'));
  assert.equal((preview.body.match(/Exemple fictif :/g) || []).length, 3);
  assert(!production.body.includes('data-preview-testimonials'));
  assert(!production.body.includes('Je retrouve mes ateliers, mes rendez-vous et mes familles'));
  const schema = JSON.parse(production.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema['@graph'].some(x => x.review || x.aggregateRating || x.interactionStatistic), false);
});
test('the same factual summary is present in initial HTML and machine-readable metadata', () => {
  for (const target of ['preview', 'production']) {
    const res = response(); createHandler({ env: { VERCEL_ENV: target } })(request(), res);
    const schema = JSON.parse(res.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    const summary = schema['@graph'].find(item => item['@type'] === 'WebPage').abstract;
    const list = res.body.match(/<ul class="hero-summary" id="tldr"[^>]*>(.*?)<\/ul>/)[1];
    const items = [...list.matchAll(/<li>([^<]+)<\/li>/g)].map(match => match[1]);
    assert.equal(items.length, 3);
    assert(items.every(item => summary.includes(item)));
    assert(summary.includes('données fictives') && summary.includes('périnatalité'));
    assert(res.body.indexOf('class="hero-description"') < res.body.indexOf('id="tldr"'));
    assert(res.body.indexOf('id="tldr"') < res.body.indexOf('class="hero-actions"'));
    assert(!res.body.includes('<details') && !res.body.includes('{{SUMMARY_ITEMS}}'));
  }
});
test('robots protects the fictitious app and previews, permits only the production landing', () => {
  for (const target of ['preview', 'production']) {
    const res = response(); createHandler({ env: { VERCEL_ENV: target } })(request({ query: { format: 'robots' } }), res);
    assert(res.body.includes('Disallow: /\n'));
    assert.equal(res.body.includes('Allow: /decouvrir$'), target === 'production');
    assert.equal(res.body.includes('Sitemap: https://naitea-preview.vercel.app/sitemap.xml'), target === 'production');
  }
});
test('HEAD returns metadata without HTML and mutations are rejected', () => {
  const handler = createHandler({ env: {} });
  const head = response(); handler(request({ method: 'HEAD' }), head);
  assert.equal(head.code, 200); assert.equal(head.body, undefined); assert(head.headers.ETag);
  const post = response(); handler(request({ method: 'POST' }), post);
  assert.equal(post.code, 405); assert.equal(post.headers.Allow, 'GET, HEAD');
});
test('invalid origins and header injection cannot reach the rendered markup', () => {
  assert.equal(originFor(request({ headers: { host: '127.0.0.1:4185' } }), {}), 'http://127.0.0.1:4185');
  for (const host of ['evil.example/<script>', 'good.example\r\nX-Test: value', 'user@evil.example']) {
    const res = response(); createHandler({ env: {} })(request({ headers: { host } }), res); assert.equal(res.code, 400);
  }
  for (const origin of ['http://naitea.example', 'https://naitea.example/path', 'https://user:pass@naitea.example']) {
    assert.throws(() => originFor(request(), { VERCEL_ENV: 'production', NAITEA_PUBLIC_ORIGIN: origin }));
  }
});
