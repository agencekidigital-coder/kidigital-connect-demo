// Refresh marketing screenshots from the real demo, in an isolated browser only.
// No Supabase account is created and no external message or payment is sent.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:4185';
const output = path.resolve(__dirname, '../assets/landing');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    await context.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const ready = async () => { await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0; }).map(img => img.decode().catch(() => {}))); }); };
    const mode = async value => { await page.locator('[data-mode="' + value + '"]:visible').first().click(); };
    const nav = async value => page.locator('#sidebar [data-nav="' + value + '"]').click();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.v8-calendar').waitFor();
    // Move the existing fictitious workshops into the current calendar week.
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('kidigital-connect-v1'));
      const now = new Date(), monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
      data.events.forEach((event, i) => { const date = new Date(monday); date.setDate(monday.getDate() + 1 + i * 2); event.date = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); });
      localStorage.setItem('kidigital-connect-v1', JSON.stringify(data));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-v8="calendar-view"][data-value="week"]').click();
    await ready(); await page.screenshot({ path: path.join(output, 'agenda-demo.png') });
    await nav('rendezvous');
    await page.locator('#v8Availability [name="offerId"]').selectOption('o1');
    await page.locator('#v8Availability [name="start"]').fill('09:00');
    await page.locator('#v8Availability [name="end"]').fill('17:00');
    await page.locator('#v8Availability [type="submit"]').click();
    await mode('parent'); await page.locator('.v12-professional-page').waitFor(); await ready();
    await page.screenshot({ path: path.join(output, 'fiche-demo.png') });
    await mode('pro'); await nav('communication');
    await page.locator('[data-v8="comm-tab"][data-value="studio"]').click();
    await page.locator('[data-v10="templates"]').click();
    await page.locator('[data-v10="apply-template"][data-id="editorial"]').click();
    await ready(); await page.screenshot({ path: path.join(output, 'studio-demo.png') });
    await mode('parent');
    await page.locator('[data-v8="book-appointment"][data-id="o1"]').first().click();
    await page.locator('.v9-booking-calendar').waitFor(); await ready();
    await page.locator('.v9-booking-calendar').screenshot({ path: path.join(output, 'reservation-demo.png') });
    console.log('Four demo captures refreshed in assets/landing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
