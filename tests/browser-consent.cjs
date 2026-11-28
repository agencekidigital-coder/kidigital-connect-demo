// A self-contained browser fixture checks privacy choices without any tracker.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const { KEY, LIFETIME } = require('../assets/landing/consent.js');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/landing/landing.css"><link rel="stylesheet" href="/assets/landing/consent.css"><script src="/assets/landing/consent.js" defer></script><body><main><h1>Naïtea</h1><p>Fixture de confidentialité.</p></main><footer><button type="button" data-open-consent>Mes choix de confidentialité</button></footer><div class="mobile-signup"><a class="button" href="#">Essayer gratuitement 30 jours</a></div></body></html>');
  }
  const asset = pathname === '/_vercel/image' ? new URL(req.url, 'http://localhost').searchParams.get('url') : pathname;
  let file = path.resolve(root, '.' + asset);
  if (!file.startsWith(root + '/')) { res.statusCode = 403; return res.end(); }
  // The asset is generated independently; its fallback is a local test fixture.
  if (pathname === '/assets/landing/brand-additions/cookie-3d.png' && !fs.existsSync(file)) file = path.join(root, 'assets/berceau/transparent/agenda.png');
  try { res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.statusCode = 404; res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' }), page = await context.newPage();
    const errors = [], external = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!r.url().startsWith(base)) external.push(r.url()); });
    await page.goto(base); const banner = page.locator('#naitea-consent-banner'); await banner.waitFor();
    assert.equal(await page.locator('body').evaluate(el => el === document.activeElement), true, 'initial banner does not steal focus');
    const styles = await banner.locator('[data-consent-choice]').evaluateAll(nodes => nodes.map(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color, border: getComputedStyle(node).border, width: Math.round(node.getBoundingClientRect().width) })));
    assert.deepEqual(styles[0], styles[1]);
    await banner.locator('[data-consent-choice="refused"]').click(); assert.equal(await banner.isVisible(), false);
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    assert.equal((await read()).decision, 'refused'); assert.equal((await read()).analytics, false);
    await page.reload(); assert.equal(await banner.isVisible(), false);
    await page.locator('[data-open-consent]').click(); const preferences = page.locator('#naitea-consent-preferences'); assert(await preferences.isVisible());
    assert.equal(await preferences.locator('input:checked').count(), 1); assert.equal(await preferences.locator('input:not(:checked):disabled').count(), 2);
    await page.keyboard.press('Escape'); assert.equal(await preferences.isVisible(), false);
    assert(await page.locator('[data-open-consent]').evaluate(el => el === document.activeElement));
    await page.locator('[data-open-consent]').click(); await preferences.locator('[data-consent-choice="accepted"]').click();
    assert.equal((await read()).decision, 'accepted'); assert.equal((await read()).advertising, false);
    await page.evaluate(({ key, lifetime }) => { const stored = JSON.parse(localStorage.getItem(key)); stored.savedAt = Date.now() - lifetime - 1000; stored.expiresAt = Date.now() - 1000; localStorage.setItem(key, JSON.stringify(stored)); }, { key: KEY, lifetime: LIFETIME });
    await page.reload(); await banner.waitFor();
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert(await banner.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.top >= 0; }));
    assert.equal(await page.locator('.mobile-signup').isVisible(), false);
    await banner.locator('[data-consent-settings]').click(); assert(await preferences.isVisible());
    assert(await preferences.evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    await preferences.locator('[data-consent-choice="customized"]').click();
    assert.equal((await read()).decision, 'customized'); assert(await page.locator('.mobile-signup').isVisible());
    const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException('Blocked'); }; Storage.prototype.setItem = () => { throw new DOMException('Blocked'); }; });
    const blockedPage = await blocked.newPage(); await blockedPage.goto(base); await blockedPage.locator('#naitea-consent-banner [data-consent-choice="refused"]').click();
    assert.equal(await blockedPage.locator('#naitea-consent-banner').isVisible(), false);
    assert.equal(await blockedPage.evaluate(() => window.NaiteaConsent.get().decision), 'refused');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ privacyBanner: 'pass', persistenceAndExpiry: 'pass', blockedStorage: 'pass', keyboardAndFocus: 'pass', equalChoices: 'pass', mobileWithoutOverlap: 'pass', optionalTrackersActivated: 0, externalRequests: external.length }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
