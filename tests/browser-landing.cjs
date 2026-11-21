// Landing → videos/anchors → offer → signup. All account submissions use a stub.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { X509Certificate, createHash } = require('node:crypto');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4186';
const artifacts = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-landing-v2';
(async () => {
  const args = ['--no-sandbox'], certDir = '/usr/local/share/ca-certificates';
  if (fs.existsSync(certDir)) {
    const pins = fs.readdirSync(certDir).filter(f => f.endsWith('.crt')).map(f => createHash('sha256').update(new X509Certificate(fs.readFileSync(path.join(certDir, f))).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    if (pins.length) args.push('--ignore-certificate-errors-spki-list=' + pins.join(','));
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args });
  try {
    fs.mkdirSync(artifacts, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const page = await context.newPage(); page.setDefaultTimeout(25000);
    const errors = [], external = [], failures = [], media = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(new URL(BASE).origin)) external.push(r.url()); if (/\.mp4(?:\?|$)/.test(r.url())) media.push({ url: r.url(), range: r.headers().range }); });
    page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }); });
    const load = async hash => {
      let response = await page.goto(BASE + '/decouvrir' + (hash || ''), { waitUntil: 'networkidle' });
      if (!response) response = await page.reload({ waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.evaluate(async () => { document.querySelectorAll('img[src]').forEach(i => i.loading = 'eager'); await document.fonts.ready; await Promise.all([...document.querySelectorAll('img[src]')].map(i => i.decode())); });
    };
    await load();
    // Follow the route in Chrome as a visitor would; the Node request client
    // does not inherit the shared browser's network transport.
    const redirectPage = await context.newPage();
    const templateRoute = await redirectPage.goto(BASE + '/marketing/landing.html', { waitUntil: 'domcontentloaded' });
    const redirect = await templateRoute.request().redirectedFrom()?.response();
    assert.equal(redirect?.status(), 307);
    assert.equal(new URL(templateRoute.url()).pathname, '/decouvrir');
    await redirectPage.close();
    assert.equal(media.length, 0, 'videos are not downloaded before interaction');
    assert.equal(await page.locator('h1').count(), 1); assert.match(await page.title(), /Logiciel tout en 1 périnatalité et parentalité/);
    assert.equal(await page.locator('h1 span').count(), 2);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), new URL(BASE).origin + '/decouvrir');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await page.evaluate(() => document.body.innerText.includes('—') || /kidigital connect/i.test(document.body.innerText)), false);
    for (const selector of ['#features-title', '.feature-intro > p']) assert.equal(await page.locator(selector).evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length; }), 1, selector + ' occupies one desktop line');
    assert.equal(await page.locator('.faq-list article').count(), 7);
    assert.equal(await page.locator('.faq-list details, .faq-list summary').count(), 0);
    for (const answer of await page.locator('.faq-list article p').all()) assert(await answer.isVisible());
    assert.match(await page.locator('#creatrice').innerText(), /maman d’un petit garçon de 2 ans/);
    assert.match(await page.locator('[data-preview-testimonials]').innerText(), /Exemples fictifs/);
    assert.match(await page.locator('#tarifs').innerText(), /50 premières abonnées/);
    assert.match(await page.locator('#tarifs').innerText(), /12 mois, puis 14,90/);
    // Native media must really decode, play, seek and expose French captions.
    const videoInfo = [];
    for (const id of ['pro', 'familles']) {
      await page.locator('#tab-' + id).click();
      assert.equal(new URL(page.url()).hash, '#demo-' + id);
      assert(await page.locator('#demo-' + id).isVisible());
      const video = page.locator('#demo-' + id + ' video');
      await video.evaluate(v => v.load());
      await page.waitForFunction(id => { const v = document.querySelector('#demo-' + id + ' video'); return v.readyState >= 1 && v.duration > 20 && !v.error; }, id);
      const info = await video.evaluate(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }));
      assert(info.duration < 90); assert(info.width >= 1280); videoInfo.push({ id, ...info });
      await video.evaluate(v => { v.currentTime = 10; v.textTracks[0].mode = 'hidden'; });
      await video.evaluate(v => v.play());
      await page.waitForFunction(id => { const v = document.querySelector('#demo-' + id + ' video'); return !v.paused && v.currentTime > 10.15 && v.readyState >= 2; }, id);
      await page.waitForFunction(id => document.querySelector('#demo-' + id + ' video').textTracks[0].cues?.length >= 7, id);
      await page.screenshot({ path: path.join(artifacts, 'video-' + id + '.png') });
    }
    assert(await page.locator('#demo-pro video').evaluate(v => v.paused), 'switching demo pauses the previous video');
    await page.locator('#tab-pro').click(); assert(await page.locator('#demo-familles video').evaluate(v => v.paused));
    await page.goBack(); assert(await page.locator('#demo-familles').isVisible());
    await page.locator('#tab-pro').focus(); await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#tab-familles').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home'); assert.equal(await page.locator('#tab-pro').getAttribute('aria-selected'), 'true');
    await load('#demo-familles'); assert(await page.locator('#demo-familles').isVisible());
    await page.locator('[data-open-privacy]').click(); assert(await page.locator('#privacy-dialog').isVisible()); await page.keyboard.press('Escape');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => scrollY === 0);
    await page.screenshot({ path: path.join(artifacts, 'desktop-hero.png') });
    await page.screenshot({ path: path.join(artifacts, 'desktop-full.png'), fullPage: true });
    for (const width of [1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => scrollY === 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'horizontal overflow at ' + width);
      assert(await page.locator('#hero-signup').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'signup on first screen at ' + width);
      if (width === 390) {
        await page.screenshot({ path: path.join(artifacts, 'mobile-hero.png') }); await page.screenshot({ path: path.join(artifacts, 'mobile-full.png'), fullPage: true });
        await page.locator('.menu-toggle').click(); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
        await page.keyboard.press('Escape'); assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        await page.locator('.menu-toggle').click(); await page.locator('#site-navigation a[href="#tarifs"]').click();
        assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        await page.waitForFunction(() => document.querySelector('.mobile-signup').hidden === false);
        assert.equal(await page.locator('.site-header').evaluate(el => Math.round(el.getBoundingClientRect().top)), 0);
        await page.locator('#tab-familles').click(); const v = page.locator('#demo-familles video'); await v.evaluate(v => v.load());
        await page.waitForFunction(() => document.querySelector('#demo-familles video').readyState >= 1);
        await v.evaluate(v => v.play()); await page.waitForFunction(() => document.querySelector('#demo-familles video').currentTime > .15);
        await page.screenshot({ path: path.join(artifacts, 'mobile-video.png') }); await v.evaluate(v => v.pause());
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failures, []);
    // Actual hosted form must initialise, without creating a real account.
    await page.locator('#hero-signup').click();
    await page.locator('#signupTab[aria-selected="true"]').waitFor();
    await page.waitForFunction(() => !document.getElementById('submitBtn').disabled || document.getElementById('status').classList.contains('error'));
    if (BASE.startsWith('https://')) assert(await page.locator('#submitBtn').isEnabled());
    assert.equal(await page.locator('#password').getAttribute('autocomplete'), 'new-password'); assert(await page.locator('#nameGroup').isVisible());
    assert.match(await page.locator('#offerSummary').innerText(), /essai de 30 jours/); assert.match(await page.locator('#offerSummary').innerText(), /9,90/);
    assert.equal(await page.locator('#backLink').getAttribute('href'), '/decouvrir'); await page.screenshot({ path: path.join(artifacts, 'signup-mobile.png') });
    await page.goto(BASE + '/connexion.html?mode=signup&from=landing&offre=fiche'); assert.match(await page.locator('#offerSummary').innerText(), /Ma fiche : gratuit/);
    const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await isolated.route('**/api/public-config', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://auth.example.test', publishableKey: 'test-placeholder' }) }));
    await isolated.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: 'export function createClient(){return {auth:{getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>{},signUp:async input=>{window.__signupInput=input;return {data:{session:null},error:null}},signInWithPassword:async()=>{throw Error("Wrong mode")}}}}' }));
    const signup = await isolated.newPage(); await signup.goto(BASE + '/connexion.html?mode=signup&from=landing&offre=complet&essai=30');
    await signup.waitForFunction(() => !document.getElementById('submitBtn').disabled);
    await signup.locator('#loginTab').click(); assert.equal(await signup.locator('#offerSummary').isVisible(), false);
    await signup.locator('#forgotBtn').click(); await signup.locator('#signupTab').click(); assert(await signup.locator('#authForm').isVisible());
    await signup.locator('#fullName').fill('Professionnelle de test'); await signup.locator('#email').fill('landing@example.test'); await signup.locator('#password').fill('Exemple-test-2026');
    await signup.locator('#submitBtn').click(); await signup.waitForFunction(() => window.__signupInput?.options?.data?.full_name === 'Professionnelle de test');
    assert.match(await signup.locator('#status').innerText(), /confirme ton adresse/);
    const result = { landing: 'pass', widths: [1440, 1024, 768, 390, 320], videos: videoInfo, anchorsAndHistory: 'pass', captionsAndSeeking: 'pass', openFaq: 'pass', pricingAndOffers: 'pass', signup: 'pass', realAccountsCreated: 0, browserErrors: errors.length };
    fs.writeFileSync(path.join(artifacts, 'browser-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
