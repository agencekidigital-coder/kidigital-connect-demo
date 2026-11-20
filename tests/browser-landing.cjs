// Browser → rendered landing → signup form. Account submissions use a stub only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { X509Certificate, createHash } = require('node:crypto');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4185';
const artifacts = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-landing';
(async () => {
  const args = ['--no-sandbox'], certDir = '/usr/local/share/ca-certificates';
  if (fs.existsSync(certDir)) {
    const pins = fs.readdirSync(certDir).filter(file => file.endsWith('.crt')).map(file => createHash('sha256').update(new X509Certificate(fs.readFileSync(path.join(certDir, file))).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    if (pins.length) args.push('--ignore-certificate-errors-spki-list=' + pins.join(','));
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args });
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = [], external = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(new URL(BASE).origin)) external.push(request.url()); });
    page.on('response', response => { if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
    const response = await page.goto(BASE + '/decouvrir', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('h1').count(), 1);
    assert.match(await page.title(), /Logiciel périnatalité et parentalité/);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), new URL(BASE).origin + '/decouvrir');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    await page.evaluate(async () => { document.querySelectorAll('img[src]').forEach(image => image.loading = 'eager'); await document.fonts.ready; await Promise.all([...document.querySelectorAll('img[src]')].map(image => image.decode())); });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('img[src]')].filter(image => !image.naturalWidth).length), 0);
    assert.equal(await page.evaluate(() => document.body.innerText.includes('—') || /kidigital connect/i.test(document.body.innerText)), false);
    for (const tab of ['fiche', 'studio', 'agenda']) {
      await page.locator('#tab-' + tab).click();
      assert.equal(await page.locator('#tab-' + tab).getAttribute('aria-selected'), 'true');
      assert(await page.locator('#panel-' + tab).isVisible());
    }
    await page.locator('#tab-agenda').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-fiche').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End'); assert.equal(await page.locator('#tab-studio').getAttribute('aria-selected'), 'true');
    await page.locator('#panel-studio [data-enlarge]').click();
    assert(await page.locator('#capture-dialog').isVisible());
    await page.locator('#enlarged-capture').evaluate(image => image.decode());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#capture-dialog').isVisible(), false);
    await page.locator('#questions details').first().locator('summary').click();
    assert(await page.locator('#questions details').first().getAttribute('open') !== null);
    await page.locator('[data-open-privacy]').click(); assert(await page.locator('#privacy-dialog').isVisible());
    await page.keyboard.press('Escape');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({ path: path.join(artifacts, 'desktop-hero.png') });
    await page.screenshot({ path: path.join(artifacts, 'desktop-full.png'), fullPage: true });
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => scrollY === 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow at ' + width);
      assert(await page.locator('#hero-signup').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'signup visible in the first screen at ' + width);
      if (width === 390) {
        await page.screenshot({ path: path.join(artifacts, 'mobile-hero.png') });
        await page.screenshot({ path: path.join(artifacts, 'mobile-full.png'), fullPage: true });
        await page.locator('.menu-toggle').click(); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape'); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        await page.locator('.menu-toggle').click(); await page.locator('#site-navigation a[href="#fonctionnalites"]').click();
        assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        await page.waitForFunction(() => document.querySelector('.mobile-signup').hidden === false);
        assert.equal(await page.locator('.site-header').evaluate(el => Math.round(el.getBoundingClientRect().top)), 0);
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failures, []);
    // Check the actual conversion link without submitting to Supabase.
    await page.locator('#hero-signup').click();
    await page.locator('#signupTab[aria-selected="true"]').waitFor();
    await page.waitForFunction(() => !document.getElementById('submitBtn').disabled || document.getElementById('status').classList.contains('error'));
    if (BASE.startsWith('https://')) assert.equal(await page.locator('#submitBtn').isEnabled(), true, 'hosted signup service must load');
    assert.equal(await page.locator('#password').getAttribute('autocomplete'), 'new-password');
    assert(await page.locator('#nameGroup').isVisible());
    assert.equal(await page.locator('#backLink').getAttribute('href'), '/decouvrir');
    await page.screenshot({ path: path.join(artifacts, 'signup-mobile.png') });
    // Isolated fake SDK: verify the signup mode reaches signUp, never signIn.
    const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await isolated.route('**/api/public-config', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://auth.example.test', publishableKey: 'test-placeholder' }) }));
    await isolated.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createClient(){return {auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>{},signUp:async input=>{window.__signupInput=input;return {data:{session:null},error:null}},signInWithPassword:async()=>{throw Error("Wrong mode")}}}}' }));
    const signup = await isolated.newPage();
    await signup.goto(BASE + '/connexion.html?mode=signup&from=landing');
    await signup.waitForFunction(() => !document.getElementById('submitBtn').disabled);
    await signup.locator('#loginTab').click(); await signup.locator('#forgotBtn').click();
    await signup.locator('#signupTab').click(); assert(await signup.locator('#authForm').isVisible());
    await signup.locator('#fullName').fill('Professionnelle de test');
    await signup.locator('#email').fill('landing@example.test'); await signup.locator('#password').fill('Exemple-test-2026');
    await signup.locator('#submitBtn').click();
    await signup.waitForFunction(() => window.__signupInput?.options?.data?.full_name === 'Professionnelle de test');
    assert.match(await signup.locator('#status').innerText(), /confirme ton adresse/);
    console.log(JSON.stringify({ landing: 'pass', widths: [1440, 768, 390, 320], realImages: 'pass', keyboardAndMenus: 'pass', signupDeepLink: 'pass', isolatedSignupSubmission: 'pass', realAccountsCreated: 0, browserErrors: errors.length }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
