// Local demonstration only: no account, message, payment or external write.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4189';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Test the isolated local demonstration.');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto(BASE + '/?vue=parents', { waitUntil: 'domcontentloaded' });
    await page.locator('#v12Presentation').waitFor();
    assert.equal(await page.locator('.v12-cancellation-link').count(), 0);
    await page.evaluate(() => {
      const key = 'kidigital-connect-v1', state = JSON.parse(localStorage.getItem(key));
      state.v8.social = { facebook: 'https://www.facebook.com/example', instagram: 'https://www.instagram.com/example', whatsapp: '33600000000' };
      state.profile.publicPage = { ...state.profile.publicPage, tiktok: 'https://www.tiktok.com/@example', linkedin: 'https://www.linkedin.com/in/example', cancellation: 'Conditions existantes.', cancellationURL: 'http://pro.example/conditions' };
      localStorage.setItem(key, JSON.stringify(state));
    });
    await page.reload(); await page.locator('#v12Presentation .v12-presentation-social').waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const social = page.locator('#v12Presentation .v12-presentation-social');
      for (const label of ['Facebook', 'Instagram', 'TikTok', 'WhatsApp', 'LinkedIn']) {
        const link = social.getByRole('link', { name: label, exact: label !== 'WhatsApp' });
        assert(await link.isVisible(), label + ' is visible in the presentation');
        assert.equal(await link.locator('svg').count(), 1);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.equal(await page.locator('#v12Practical .v12-cancellation-link').getAttribute('href'), 'http://pro.example/conditions');
    assert.match(await page.locator('#v12Practical').innerText(), /Conditions existantes\./);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-mode="pro"]:visible').first().click();
    await page.locator('#sidebar [data-nav="personnaliser"]').click();
    const field = page.locator('#v12ProfileDetails [name="cancellationURL"]');
    assert.equal(await field.inputValue(), 'http://pro.example/conditions');
    await field.evaluate(input => input.closest('details').open = true);
    await field.fill('https://pro.example/politique');
    await page.locator('#v12ProfileDetails [type="submit"]').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')).profile.publicPage.cancellationURL), 'https://pro.example/politique');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ visibleSocialsDesktopAndMobile: 'pass', optionalPolicyAndPersistence: 'pass', privateDataOrExternalWrites: 0 }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
