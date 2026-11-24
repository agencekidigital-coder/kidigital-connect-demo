// Local workerd preview only. No live account, email, payment or provider write.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4194';
const OUT = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-cloudflare-etape-1';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const results = [], errors = [], external = [];
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE + '/')) external.push(r.url()); });
      let response = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
      assert(await page.locator('h1').innerText());
      assert.equal(await page.locator('[data-preview-testimonials]').count(), 0);
      await page.locator('img').evaluateAll(images => images.forEach(im => { im.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.images].every(im => im.complete));
      const broken = await page.locator('img[src]').evaluateAll(images => images.filter(im => im.getAttribute('src') && !im.naturalWidth).map(im => im.getAttribute('src')));
      assert.deepEqual(broken, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(OUT, 'landing-' + viewport.width + '.png'), fullPage: true });

      response = await page.goto(BASE + '/pro', { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.waitForSelector('#naiteaBetaPreviewNotice');
      assert((await page.locator('#naiteaBetaPreviewNotice').innerText()).includes('données fictives'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (viewport.width > 700) {
        const lock = page.locator('#sidebar [data-nav="automations"]');
        const dashboardTitle = await page.locator('#app h1').allTextContents();
        assert.equal(await lock.getAttribute('aria-disabled'), 'true');
        // Deliberately attempt a click despite aria-disabled, to verify interception.
        await lock.click({ force: true });
        assert(await page.locator('#naiteaBetaPreviewStatus').isVisible());
        assert((await page.locator('#naiteaBetaPreviewStatus').innerText()).includes('Bientôt disponible'));
        assert.deepEqual(await page.locator('#app h1').allTextContents(), dashboardTitle);
        await lock.focus(); await lock.press('Enter');
        assert.deepEqual(await page.locator('#app h1').allTextContents(), dashboardTitle);
        await page.locator('#sidebar [data-nav="communication"]').click();
        assert(await page.locator('#app .v8-workspace').isVisible());
      }
      await page.goto(BASE + '/pro', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#naiteaBetaPreviewNotice');
      await page.screenshot({ path: path.join(OUT, 'pro-' + viewport.width + '.png'), fullPage: true });
      await page.goto(BASE + '/familles', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#naiteaBetaPreviewNotice');
      assert(await page.locator('#naiteaBetaPreviewNotice').isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(OUT, 'familles-' + viewport.width + '.png'), fullPage: true });

      await page.goto(BASE + '/connexion.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('momentanément indisponible'));
      assert((await page.locator('#status').innerText()).includes('momentanément indisponible'));
      assert(await page.locator('#submitBtn').isDisabled());
      assert.equal(await page.locator('#naiteaBetaPreviewNotice').count(), 0);
      const api = await context.request.get(BASE + '/api/google?action=connect');
      assert.equal(api.status(), 423);
      for (const hidden of ['/server/public-config.cjs', '/supabase/02-auth-profile-trigger.sql', '/.git/config', '/package.json', '/Kidigital-Connect-V8-deploiement.zip']) assert.equal((await context.request.get(BASE + hidden)).status(), 404);
      assert.equal((await context.request.head(BASE + '/pro')).status(), 200);
      const video = await context.request.get(BASE + '/assets/landing/demo-pro.mp4', { headers: { Range: 'bytes=0-1023' } });
      assert.equal(video.status(), 206); assert.equal((await video.body()).length, 1024);
      results.push({ viewport, landing: true, app: true, locks: true, authClosed: true, privateFilesClosed: true, videoRange: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    const result = { runtime: 'Cloudflare workerd, local only', liveWrites: 0, errors, external, results };
    fs.writeFileSync(path.join(OUT, 'verification.json'), JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify(result) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
