// Run with BASE_URL and CHROMIUM_PATH; fixtures stay inside an isolated browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { X509Certificate, createHash } = require('node:crypto');
const BASE = process.env.BASE_URL || 'http://localhost:4180';
const artifacts = process.env.ARTIFACT_DIR || '/tmp/naitea-v10-verification';
fs.mkdirSync(artifacts, { recursive: true });
let p, browser;
(async () => {
  const args = ['--no-sandbox'];
  const certDir = '/usr/local/share/ca-certificates';
  if (fs.existsSync(certDir)) {
    const pins = fs.readdirSync(certDir).filter(f => f.endsWith('.crt')).map(f => createHash('sha256').update(new X509Certificate(fs.readFileSync(path.join(certDir, f))).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    if (pins.length) args.push('--ignore-certificate-errors-spki-list=' + pins.join(','));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  p = await context.newPage();
  p.setDefaultTimeout(25000);
  const errors = [], googleCalls = [], results = {};
  p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { if (/fonts\.googleapis|fonts\.gstatic|places\.googleapis/.test(r.url())) googleCalls.push(r.url()); });
  const nav = id => p.locator('#sidebar [data-nav="' + id + '"]').click();
  const tab = id => p.locator('[data-v8="comm-tab"][data-value="' + id + '"]').click();
  const readState = () => p.evaluate(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')));
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kidigital-connect-v1'));
    state.family.push({ id: 'test-offer-family', name: 'Alice Accompagnement Test', email: 'alice@example.test', newsletter: false, interest: 'Massage bébé' });
    state.family.push({ id: 'test-no-booking', name: 'Zoé Sans Réservation', email: 'zoe@example.test', newsletter: false, interest: 'Massage bébé' });
    state.leads.push({ id: 'test-lead', name: 'Alice Accompagnement Test', email: 'alice@example.test', offerId: state.offers[0].id, status: 'Nouveau' });
    state.v9.communicationDraft = 'Découvrez nos ateliers sur Kidigital Connect.';
    localStorage.setItem('kidigital-connect-v1', JSON.stringify(state));
  });
  await p.reload();
  await nav('familles');
  await p.locator('#v10FamilyType').selectOption('offer');
  assert(await p.locator('.v9-family-grid').innerText().then(t => t.includes('Alice Accompagnement Test') && !t.includes('Zoé Sans Réservation')));
  await p.locator('#v10FamilyType').selectOption('workshop');
  await p.locator('#v10FamilyService').selectOption('workshop:e1');
  assert.equal(await p.locator('.v9-family-grid>article').count(), 3);
  const download = p.waitForEvent('download');
  await p.locator('[data-v10="export-families"]').click();
  const file = await download; await file.saveAs(path.join(artifacts, 'families.csv'));
  const csv = fs.readFileSync(path.join(artifacts, 'families.csv'), 'utf8');
  assert(csv.includes('Emma Laurent') && !csv.includes('Alice Accompagnement Test'));
  await p.locator('[data-v9="edit-family"][data-id="f1"]').click();
  await p.locator('#v9FamilyForm [name="email"]').fill('emma.corrected@example.test');
  await p.locator('#v9FamilyForm [type="submit"]').click();
  assert.equal(await p.locator('.v9-family-grid>article').count(), 3);
  assert(await p.locator('.v9-family-grid').innerText().then(t => t.includes('emma.corrected@example.test')));
  await p.screenshot({ path: path.join(artifacts, 'families-desktop.png'), fullPage: true });
  results.familyFiltersAndExport = true;
  results.emailCorrectionKeepsLinks = true;

  await nav('personnaliser');
  for (const [name, value] of Object.entries({ first: 'Aline', last: 'Test', city: 'Bordeaux et alentours', email: 'aline@example.test', phone: '0612345678', website: 'https://example.org' })) await p.locator('#v7ProfileForm [name="' + name + '"]').fill(value);
  const draft = await p.locator('#v10ProfilePreview').innerText();
  assert(draft.includes('Bordeaux et alentours') && draft.includes('aline@example.test') && draft.includes('0612345678'));
  assert.notEqual((await readState()).profile.first, 'Aline');
  await p.locator('[data-v10="save-view-profile"]').click();
  const publicProfile = await p.locator('.v8-parent-profile').innerText();
  assert(publicProfile.includes('Aline Test') && publicProfile.includes('aline@example.test') && publicProfile.includes('Bordeaux et alentours'));
  assert.equal(await p.locator('.v8-parent-profile a[href="https://example.org/"]').count(), 1);
  await p.reload();
  await nav('personnaliser');
  assert.equal(await p.locator('#v7ProfileForm [name="email"]').inputValue(), 'aline@example.test');
  await p.locator('#v7ProfileForm [name="google"]').fill('https://www.google.com/maps?cid=123');
  await p.locator('#v7ProfileForm [type="submit"]').click();
  await p.locator('#v7ProfileForm [name="google"]').fill('');
  await p.locator('#v7ProfileForm [type="submit"]').click();
  assert.equal(await p.locator('#v10ProfilePreview .v9-reviews').count(), 0);
  const status = await p.evaluate(() => fetch('/api/google-reviews?status=1').then(r => r.json()));
  results.googleConfigured = status.configured;
  if (!status.configured) {
    await p.locator('[data-v10="sync-google"]').click();
    await p.locator('#v10GoogleStatus').filter({ hasText: 'n’est pas activée' }).waitFor();
    assert.equal(await p.locator('#v10GoogleAuto').isChecked(), false);
  }
  results.liveAndSavedProfile = true;

  // The configured UI branch is exercised with a provider fixture, not real reviews.
  const linkedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
  const linked = await linkedContext.newPage();
  await linked.route('**/api/google-reviews*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(route.request().url().includes('status=1') ? { configured: true } : { business: 'Établissement de test API', rating: 4.7, count: 36, url: 'https://www.google.com/maps?cid=123', attributions: [], fetchedAt: '2026-11-18T12:00:00Z' }) }));
  await linked.goto(BASE, { waitUntil: 'domcontentloaded' });
  await linked.locator('#sidebar [data-nav="personnaliser"]').click();
  await linked.locator('#v10GoogleAuto').check();
  await linked.locator('.v10-live-reviews').first().waitFor();
  assert((await linked.locator('.v10-live-reviews').first().innerText()).includes('36 avis'));
  assert((await linked.locator('.v10-live-reviews').first().innerText()).includes('4,7/5'));
  assert.equal(await linked.evaluate(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')).v9.googleReview.rating), null);
  await linkedContext.close();
  results.googleConnectionUiWithFixture = true;

  await nav('communication');
  assert((await p.locator('#marketingEditor').inputValue()).includes('Naïtéa'));
  await p.locator('[data-comm="email"]').click();
  const emailCopy = await p.locator('#marketingEditor').inputValue();
  assert(emailCopy.includes('ma page Naïtéa') && !/kidigital\s+connect/i.test(emailCopy));
  await tab('studio');
  await p.waitForFunction(() => document.querySelector('.v9-font-count')?.textContent.includes('1961'));
  for (const family of ['Grandiflora One', 'Montserrat', 'Lora']) {
    await p.locator('[data-v10="font-picker"][data-target="layer"]').click();
    assert.equal(await p.locator('#v10FontQuery').inputValue(), '');
    assert((await p.locator('#v10FontList button').count()) >= 80);
    await p.locator('#v10FontQuery').fill(family);
    await p.locator('[data-v10="font-select"][data-family="' + family + '"]').click();
    await p.locator('.v10-font-modal').waitFor({ state: 'detached' });
    assert((await p.locator('[data-design-layer].selected').getAttribute('style')).includes(family));
  }
  await p.locator('[data-v10="font-picker"]').click();
  await p.locator('[data-v10="font-more"]').click();
  assert.equal(await p.locator('#v10FontList button').count(), 160);
  await p.locator('[data-action="close-modal"]').click();
  results.fullFontCatalogAfterMultipleChoices = true;

  for (const id of ['rencontre', 'editorial', 'conseil', 'portrait', 'offres', 'agenda']) {
    await p.locator('[data-v10="templates"]').click();
    assert.equal(await p.locator('[data-v10="apply-template"]').count(), 6);
    if (id === 'editorial') await p.screenshot({ path: path.join(artifacts, 'templates.png'), fullPage: true });
    await p.locator('[data-v10="apply-template"][data-id="' + id + '"]').click();
    assert((await p.locator('.v10-shape').count()) > 0);
    assert((await p.locator('.v9-inline-text').count()) > 0);
  }
  const beforeDelete = await p.locator('[data-design-layer]').count();
  await p.locator('.v9-object-toolbar [data-v9="object-delete"]').click();
  assert.equal(await p.locator('[data-design-layer]').count(), beforeDelete - 1);
  await p.keyboard.press('Control+z');
  assert.equal(await p.locator('[data-design-layer]').count(), beforeDelete);
  await p.keyboard.press('Control+Shift+z');
  assert.equal(await p.locator('[data-design-layer]').count(), beforeDelete - 1);
  await p.locator('[data-v10="undo"]').click();
  assert.equal(await p.locator('[data-design-layer]').count(), beforeDelete);
  results.editableTemplates = 6;
  results.keyboardUndoRedo = true;

  const fixtureData = await p.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 160;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#336699'; ctx.fillRect(50, 40, 100, 80);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const fixture = { name: 'transparent-test.png', mimeType: 'image/png', buffer: Buffer.from(fixtureData, 'base64') };
  await p.locator('#v9ImageUpload').setInputFiles(fixture);
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')).v8.currentDesign.layers.at(-1).src?.startsWith('data:image/png'));
  const alphaOf = async selector => p.locator(selector).evaluate(async n => {
    const image = new Image(); image.src = n.src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return { corner: [...ctx.getImageData(0, 0, 1, 1).data], center: [...ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data] };
  });
  assert.equal((await alphaOf('[data-design-layer].selected img')).corner[3], 0);
  results.transparentPngImport = true;

  await nav('personnaliser');
  await p.locator('[data-v8="profile-tab"][data-value="marque"]').click();
  await p.locator('#v10BrandLogo').setInputFiles(fixture);
  await p.locator('.v10-logo-preview img').waitFor();
  assert.equal((await alphaOf('.v10-logo-preview img')).corner[3], 0);
  await p.locator('#v10BrandPictograms').setInputFiles(fixture);
  await p.locator('.v10-pictograms article').waitFor();
  await p.locator('[data-v10="remove-picto"]').click();
  assert.equal(await p.locator('.v10-pictograms article').count(), 0);
  await p.locator('[data-v10="brand-undo"]').click();
  assert.equal(await p.locator('.v10-pictograms article').count(), 1);
  await p.locator('#v10BrandFontUpload').setInputFiles({ name: 'pro-font.ttf', mimeType: 'font/ttf', buffer: fs.readFileSync(path.resolve(__dirname, '../assets/dm-sans-400.ttf')) });
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')).brand.titleFont === 'Import pro-font');
  await p.locator('[data-v5-hex="accent"]').fill('#315A4D');
  await p.locator('[data-v5-hex="accent"]').dispatchEvent('change');
  await p.locator('[data-v10="font-picker"][data-target="titleFont"]').click();
  await p.locator('#v10FontQuery').fill('DM Sans');
  await p.locator('[data-v10="font-select"][data-family="DM Sans"]').click();
  await p.locator('.v10-font-modal').waitFor({ state: 'detached' });
  assert.equal((await readState()).brand.titleFont, 'DM Sans');
  await p.screenshot({ path: path.join(artifacts, 'brand-desktop.png'), fullPage: true });
  await p.locator('[data-v10="insert-picto"]').click();
  assert.equal((await alphaOf('[data-design-layer].selected img')).corner[3], 0);
  await p.locator('[data-v10="templates"]').click();
  await p.locator('[data-v10="apply-template"][data-id="rencontre"]').click();
  assert.equal((await readState()).v8.currentDesign.accent, '#315A4D');
  await p.screenshot({ path: path.join(artifacts, 'studio-desktop.png'), fullPage: true });
  results.brandKitAndReuse = true;
  results.customBrandFont = true;

  await tab('publications');
  await p.locator('#v10PublicationImport').setInputFiles(fixture);
  await p.locator('.v9-publication-preview>img').waitFor({ state: 'visible' });
  const image = await alphaOf('.v9-publication-preview>img');
  assert.deepEqual(image.corner, [0, 0, 0, 0]);
  assert.deepEqual(image.center, [51, 102, 153, 255]);
  const imported = (await readState()).v8.currentDesign;
  assert.equal(imported.format, 'custom'); assert.equal(imported.width, 200); assert.equal(imported.height, 160);
  assert.equal(imported.showLogo, false); assert.equal(imported.showAccent, false);
  await p.locator('[data-v9="save-publication"]').click();
  assert((await readState()).v9.publicationDrafts.length > 0);
  await p.locator('[data-action="close-modal"]').click();
  const exportEvent = p.waitForEvent('download');
  await p.locator('[data-v8="design-export"]').click();
  await (await exportEvent).saveAs(path.join(artifacts, 'imported-export.png'));
  results.readyVisualAndTransparentExport = true;

  await p.setViewportSize({ width: 390, height: 844 });
  const mobile = [];
  for (const id of ['familles', 'personnaliser', 'communication']) {
    await p.locator('#mobilebar [data-nav="more"]').click();
    await p.locator('.modal [data-nav="' + id + '"]').click();
    if (id === 'personnaliser') await p.locator('[data-v8="profile-tab"][data-value="marque"]').click();
    if (id === 'communication') await tab('studio');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, id + ' overflow');
    mobile.push(id);
    await p.screenshot({ path: path.join(artifacts, id + '-mobile.png'), fullPage: true });
  }
  results.mobileViews = mobile;
  assert.equal(googleCalls.length, 0);
  assert.deepEqual(errors, []);
  results.directGoogleRequests = googleCalls.length;
  results.javascriptErrors = errors;
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(async error => {
  if (p) await p.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
