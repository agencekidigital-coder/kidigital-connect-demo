// Actual application, isolated local browser. The import never visits a website.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4192';
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Use the isolated local demonstration.');
const out = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-site-import';
const fixture = '<!doctype html><html><head><script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'Service', name: 'Bain enveloppé de test', description: 'Un accompagnement à domicile pour la démonstration.', duration: 'PT1H30M', offers: { '@type': 'Offer', price: '70', priceCurrency: 'EUR' }, url: 'https://example.test/bain' },
  { '@type': 'Service', name: 'Accompagnement à compléter', description: 'Une prestation dont le site ne précise pas le tarif ni la durée.' },
] }) + '</script></head><body><h1>Mes prestations</h1></body></html>';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
    const external = [], writes = [], errors = [];
    await context.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await context.route('**/*', route => {
      const request = route.request(); if (!request.url().startsWith(BASE)) { external.push(request.url()); return route.abort(); }
      if (request.method() !== 'GET') { writes.push(request.url()); return route.abort(); }
      return route.fallback();
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.locator('.v8-calendar').waitFor();
    const navigateImport = async () => {
      await page.locator('#sidebar [data-nav="personnaliser"]').click();
      await page.locator('[data-v8="profile-tab"][data-value="import"]').click();
      await page.locator('#site-import-content').waitFor();
    };
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')));
    const originalCount = (await state()).offers.length;
    // Fixture 1: real DOM parsing of JSON-LD, with unknown values left blank.
    const structured = await page.evaluate(html => NaiteaSiteImportTools.extractHTML(html), fixture);
    assert.equal(structured.offers.length, 2);
    assert.equal(structured.offers.find(o => o.title === 'Bain enveloppé de test').price, 70);
    assert.equal(structured.offers.find(o => o.title === 'Accompagnement à compléter').durationMinutes, null);
    // Fixture 2: normal readable headings when JSON-LD is absent.
    const headings = await page.evaluate(html => NaiteaSiteImportTools.extractHTML(html), '<h1>Mes prestations</h1><section><h2>Massage bébé de test</h2><p>Des gestes doux, en cabinet.</p><p>30 € · 60 min</p></section><section><h2>Soutien parental de test</h2><p>Un temps d’échange, modalités à convenir.</p></section>');
    assert.equal(headings.offers.length, 2);
    assert.equal(headings.offers.find(o => o.title === 'Massage bébé de test').durationMinutes, 60);
    assert.equal(headings.offers.find(o => o.title === 'Soutien parental de test').price, null);
    // Fixture 3: active HTML remains inert; even CSS/image/frame requests are absent.
    const malicious = '<html><head><base href="https://external.example.test/"><meta http-equiv="refresh" content="0;url=https://external.example.test/refresh"><link rel="stylesheet" href="https://external.example.test/style"><style>@import url(https://external.example.test/css);</style><script>window.__importExecuted=1</script></head><body onload="window.__importExecuted=2"><iframe src="https://external.example.test/frame"></iframe><svg onload="window.__importExecuted=3"><image href="https://external.example.test/svg"></image></svg><img src="https://external.example.test/photo" onerror="window.__importExecuted=4"><noscript><img src="https://external.example.test/noscript"></noscript><h2>Test inerte</h2><p>Une description de test. 20 € · 45 min en visio.</p></body></html>';
    const inert = await page.evaluate(html => ({ result: NaiteaSiteImportTools.extractHTML(html), executed: window.__importExecuted }), malicious);
    assert.equal(inert.result.offers.length, 1); assert.equal(inert.executed, undefined);
    await navigateImport();
    assert(!/nid-de-vie|module d.import serveur/i.test(await page.locator('.site-import-tool').innerText()));
    await page.locator('#site-import-source').fill('https://example.test/');
    await page.locator('#site-import-file').setInputFiles({ name: 'prestations-test.html', mimeType: 'text/html', buffer: Buffer.from(fixture) });
    await page.locator('#site-import-format').waitFor();
    await page.waitForFunction(() => document.getElementById('site-import-content').value.includes('Bain enveloppé'));
    await page.locator('[data-site-import="analyse"]').click();
    assert.equal((await state()).offers.length, originalCount, 'analysis does not create an offer');
    const unknown = page.locator('.site-import-offer').filter({ hasText: 'Ajouter « Accompagnement à compléter »' });
    assert.equal(await unknown.locator('[name="price"]').inputValue(), '');
    assert.equal(await unknown.locator('[name="durationMinutes"]').inputValue(), '');
    await unknown.locator('.site-import-select').check();
    await page.locator('#site-import-reviewed').check();
    await page.locator('#naiteaSiteImportForm [type="submit"]').click();
    assert.equal((await state()).offers.length, originalCount, 'missing tariffs/durations prevent creation');
    await unknown.locator('[name="price"]').fill('25'); await unknown.locator('[name="durationMinutes"]').fill('45');
    await unknown.locator('[name="modalities"][value="En visio"]').check();
    await page.screenshot({ path: path.join(out, 'review-before-import.png'), fullPage: true });
    await page.locator('#naiteaSiteImportForm [type="submit"]').click();
    await page.waitForFunction(count => JSON.parse(localStorage.getItem('kidigital-connect-v1')).offers.length === count, originalCount + 2);
    const imported = (await state()).offers.filter(o => o.importedFrom);
    assert.equal(imported.length, 2); assert.equal(imported.find(o => o.title === 'Accompagnement à compléter').price, 25);
    assert.equal(imported.find(o => o.title === 'Bain enveloppé de test').duration, '90 min');
    assert(!JSON.stringify(await state()).includes('application/ld+json'));
    await navigateImport();
    await page.locator('#site-import-format').selectOption('html'); await page.locator('#site-import-content').fill(fixture);
    await page.locator('[data-site-import="analyse"]').click(); await page.locator('#site-import-reviewed').check();
    await page.locator('#naiteaSiteImportForm [type="submit"]').click();
    assert.equal((await state()).offers.length, originalCount + 2, 'reimport does not duplicate the known offer');
    assert.match(await page.locator('#site-import-status').innerText(), /existent déjà/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile-review.png'), fullPage: true });
    assert.deepEqual(external, []); assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    const result = { structuredHTML: 'pass', headingsHTML: 'pass', maliciousHTMLInert: 'pass', noExternalResourcesOrExecution: 'pass', fileImportAndReview: 'pass', missingValuesStayBlankUntilCompleted: 'pass', duplicateProtection: 'pass', responsive: 'pass', offersCreatedAfterValidation: 2, externalRequests: 0, serverWrites: 0, javascriptErrors: errors };
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
