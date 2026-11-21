// Capture each actual tool for the alternating marketing sections.
// Uses a fresh local browser with fictitious records only. No external writes.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4187';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(BASE)) throw Error('Capture the local demonstration only.');
const out = path.resolve(__dirname, '../assets/landing');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const blocked = [], errors = [], captures = [];
    await context.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await context.route('**/*', route => {
      const r = route.request(); if (r.method() !== 'GET' && !r.url().startsWith(BASE)) { blocked.push(r.url()); return route.abort(); }
      return route.fallback();
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    const nav = id => page.locator('#sidebar .navbtn[data-nav="' + id + '"]').click();
    const mode = id => page.locator('[data-mode="' + id + '"]:visible').first().click();
    const close = () => page.locator('.modal .close').click();
    const fill = async (form, data) => { for (const [name, value] of Object.entries(data)) await page.locator('#' + form + ' [name="' + name + '"]').fill(value); };
    async function capture(name, selector = '#app') {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('#toastHost .toast').waitFor({ state: 'detached' });
      if (selector !== '#app' && selector !== '.v12-professional-page') await page.locator(selector).evaluate(el => scrollTo({ top: scrollY + el.getBoundingClientRect().top - 110, behavior: 'instant' }));
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.height > 0; }).map(img => img.decode().catch(() => {})));
      });
      const box = selector === '.v12-professional-page' ? { x: 0, y: 0, width: 1440, height: 1000 } : await page.locator(selector).boundingBox();
      const clip = { x: Math.ceil(box.x), y: Math.ceil(box.y), width: Math.floor(box.width), height: Math.floor(Math.min(box.height, selector === '.v12-professional-page' ? 1000 : 850, 1000 - box.y)) };
      await page.screenshot({ path: path.join(out, 'outil-' + name + '.png'), clip });
      captures.push({ name, width: clip.width, height: clip.height });
    }
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.locator('.v8-calendar').waitFor();
    await page.evaluate(() => { const key = 'kidigital-connect-v1', state = JSON.parse(localStorage.getItem(key)); state.profile.photo = '/assets/landing/brand-additions/accompagnante-illustration.jpg'; localStorage.setItem(key, JSON.stringify(state)); });
    await page.reload(); await page.locator('.v8-calendar').waitFor();
    await nav('ateliers'); await capture('ateliers');
    await nav('rendezvous'); await page.locator('#v8Availability [name="offerId"]').selectOption('o1');
    await page.locator('#v8Availability [name="start"]').fill('09:00'); await page.locator('#v8Availability [name="end"]').fill('17:00');
    await page.locator('#v8Availability [type="submit"]').click();
    await mode('parent'); await page.locator('.v12-professional-page').waitFor(); await capture('fiche', '.v12-professional-page');
    await mode('pro'); await nav('familles'); await capture('familles');
    await nav('communication'); await page.locator('[data-v8="comm-tab"][data-value="studio"]').click();
    await page.locator('[data-v10="templates"]').click(); await page.locator('[data-v10="apply-template"][data-id="editorial"]').click();
    await page.locator('[data-design="format"]').selectOption('square'); await capture('studio');
    await nav('cadeaux');
    await page.locator('#naiteaGiftDesign [name="template"][value="arch"]').check();
    await fill('naiteaGiftDesign', { title: 'Un accompagnement à offrir', subtitle: 'Un moment pour prendre soin de vous.' });
    await page.locator('#naiteaGiftDesign [type="submit"]').click(); await capture('cadeaux', '.naitea-gift-design');
    await nav('facturation');
    await fill('billingLegalSettings', { name: 'Professionnelle fictive', street: 'Adresse de démonstration', postalCode: '00000', city: 'Ville fictive' });
    await page.locator('#billingLegalSettings [name="email"]').fill('camille@example.test');
    await page.locator('#billingLegalSettings [name="entity"]').selectOption('ei');
    await page.locator('#billingLegalSettings [name="taxRegime"]').selectOption('franchise');
    await page.locator('#billingLegalSettings [name="giftTaxMode"]').selectOption('single');
    await page.locator('#billingLegalSettings [name="giftTaxKnown"]').check();
    await page.locator('#billingLegalSettings [type="submit"]').click();
    // One simulated gift purchase makes the billing list representative.
    await mode('parent'); await page.locator('[data-berceau="buy-gift"]').click(); await page.locator('#berceauGiftOffer').selectOption('o1');
    await fill('berceauBuyGift', { recipient: 'Famille fictive', buyerFirstName: 'Acheteuse', buyerLastName: 'Démonstration', buyerEmail: 'achat@example.test', phone: '0600000000', billingStreet: '1 rue fictive', billingPostalCode: '00000', billingCity: 'Ville fictive' });
    await page.locator('#berceauBuyGift [name="consent"]').check(); await page.locator('#berceauBuyGift [type="submit"]').click(); await page.locator('#berceauBuyGift').waitFor({ state: 'detached' });
    await close(); await mode('pro'); await nav('facturation');
    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.locator('[data-billing="view"]').first().click();
    await page.locator('#toastHost .toast').waitFor({ state: 'detached' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.billing-invoice').screenshot({ path: path.join(out, 'outil-facturation.png') });
    const invoice = await page.locator('.billing-invoice').boundingBox(); captures.push({ name: 'facturation', width: Math.round(invoice.width), height: Math.round(invoice.height) });
    if (blocked.length || errors.length) throw Error('Capture failed: ' + JSON.stringify({ blocked, errors }));
    const manifest = path.join('/workspace/artifacts/naitea-landing-v3', 'feature-captures.json'); fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, JSON.stringify({ fictitiousData: true, realPurchases: 0, externalWrites: 0, captures }, null, 2));
    console.log(JSON.stringify({ captures, externalWrites: 0, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
