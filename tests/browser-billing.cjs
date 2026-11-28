const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { X509Certificate, createHash } = require('node:crypto');
const BASE = process.env.BASE_URL || 'http://localhost:4181';
const out = process.env.ARTIFACT_DIR || '/tmp/naitea-billing-verification';
fs.mkdirSync(out, { recursive: true });
let browser, p;
(async () => {
  const dir = '/usr/local/share/ca-certificates';
  const pins = fs.readdirSync(dir).filter(f => f.endsWith('.crt')).map(f => createHash('sha256').update(new X509Certificate(fs.readFileSync(path.join(dir, f))).publicKey.export({ type: 'spki', format: 'der' })).digest('base64')).join(',');
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--ignore-certificate-errors-spki-list=' + pins] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await context.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await context.route('**/*', route => {
    if (route.request().method() !== 'GET' && !route.request().url().startsWith(new URL(BASE).origin)) return route.abort();
    return route.fallback();
  });
  p = await context.newPage(); p.setDefaultTimeout(20000);
  const errors = [], writes = [], results = {};
  p.on('pageerror', e => errors.push(e.message));
  p.on('request', r => { if (r.method() !== 'GET' && /supabase\.co|stripe|googleapis|ai-gateway/.test(r.url())) writes.push(r.url()); });
  const state = () => p.evaluate(() => JSON.parse(localStorage.getItem('kidigital-connect-v1')));
  const nav = id => p.locator('#sidebar [data-nav="' + id + '"]').click();
  const mode = id => p.locator('[data-mode="' + id + '"]:visible').first().click();
  const close = () => p.locator('.modal .close').click();
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await nav('facturation');
  assert((await p.locator('#app').innerText()).includes('Aucun document'));
  assert.equal(((await state()).billingDemo?.documents || []).length, 0);
  results.existingUnpaidDemoDataNotInvoiced = true;

  await mode('parent'); await p.locator('[data-berceau="buy-gift"]').click();
  await p.locator('[data-berceau="gift-choice"][data-value="custom"]').click();
  await p.locator('#berceauGiftCustom').fill('30.50');
  for (const [name, value] of Object.entries({ recipient: 'Famille fictive', buyerFirstName: 'Acheteuse', buyerLastName: 'fictive', phone: '0600000000', buyerEmail: 'gift@example.test' })) await p.locator('#berceauBuyGift [name="' + name + '"]').fill(value);
  await p.locator('#berceauBuyGift [name="billingAddressOpposed"]').check(); await p.locator('#berceauBuyGift [name="consent"]').check();
  await p.locator('#berceauBuyGift [type="submit"]').click();
  let docs = (await state()).billingDemo.documents;
  assert.equal(docs.length, 1); assert.equal(docs[0].type, 'gift'); assert.equal(docs[0].totalCents, 3050);
  assert.equal((await state()).v8.emails.filter(e => e.invoiceId === docs[0].id).length, 1);
  let pending = p.waitForEvent('download'); await p.locator('.billing-receipt [data-billing="download"]').click();
  const file = await pending; await file.saveAs(path.join(out, 'bon-cadeau-demo.pdf'));
  assert(fs.readFileSync(path.join(out, 'bon-cadeau-demo.pdf')).subarray(0, 8).toString().startsWith('%PDF-1.4'));
  await close(); results.giftReceiptAndPdfEmailPrepared = true;

  await mode('pro'); await nav('rendezvous');
  await p.locator('#v8Availability [name="offerId"]').selectOption('o2');
  await p.locator('#v8Availability [name="start"]').fill('09:00'); await p.locator('#v8Availability [name="end"]').fill('17:00');
  await p.locator('#v8Availability [type="submit"]').click();
  await mode('parent'); await p.locator('#v8ParentAppointments [data-v8="book-appointment"][data-id="o2"]').click();
  await p.locator('.v8-slots button').first().click();
  await p.locator('#v8BookAppointment [name="firstName"]').fill('Parent'); await p.locator('#v8BookAppointment [name="lastName"]').fill('fictif'); await p.locator('#v8BookAppointment [name="phone"]').fill('0600000000'); await p.locator('#v8BookAppointment [name="billingAddressOpposed"]').check(); await p.locator('#v8BookAppointment [name="email"]').fill('appointment@example.test');
  await p.locator('#v8BookAppointment [name="payment"]').selectOption('simulated'); await p.locator('#v8BookAppointment [name="consent"]').check();
  await p.locator('#v8BookAppointment [type="submit"]').click();
  docs = (await state()).billingDemo.documents; assert.equal(docs.length, 2); assert.equal(docs[1].type, 'invoice'); assert.equal(docs[1].totalCents, 6500);
  await p.screenshot({ path: path.join(out, 'confirmation-facture.png'), fullPage: true });
  await close(); results.individualPurchaseInvoicedOnce = true;

  await p.locator('[data-action="book"][data-id="e3"]').click();
  await p.locator('#bookEvent [name="billingPayment"]').selectOption('onsite');
  for (const [name, value] of Object.entries({ firstName: 'Parent', lastName: 'Atelier fictif', email: 'workshop@example.test', phone: '0600000000' })) await p.locator('#bookEvent [name="' + name + '"]').fill(value);
  await p.locator('#bookEvent [name="billingAddressOpposed"]').check(); await p.locator('#bookEvent [type="submit"]').click();
  assert.equal((await state()).billingDemo.documents.length, 2); assert.equal((await state()).billingDemo.pending.length, 1);
  const awaitingPayment = (await state()).billingDemo.pending[0];
  assert.equal(awaitingPayment.name, 'Parent Atelier fictif');
  assert.equal(awaitingPayment.billingAddressOpposed, 'on');
  for (const field of ['phone', 'childName', 'childAge', 'homeStreet', 'newsletter', 'bookingModality', 'firstName', 'lastName']) assert.equal(field in awaitingPayment, false, 'pending billing record excludes ' + field);
  assert((await p.locator('.modal').innerText()).includes('après le règlement simulé'));
  await close(); await mode('pro'); await nav('facturation');
  await p.locator('[data-billing="pay"]').click();
  docs = (await state()).billingDemo.documents; assert.equal(docs.length, 3); assert.equal(docs[2].totalCents, 3500);
  assert.equal((await state()).billingDemo.pending.length, 0); await close();
  results.workshopWaitsForOnsitePaymentConfirmation = true;

  const invoice = docs[1]; await p.locator('[data-billing="view"][data-id="' + invoice.id + '"]').click();
  await p.locator('[data-billing="email"]').click();
  assert((await p.locator('.modal').innerText()).includes(invoice.number + '.pdf'));
  assert((await p.locator('.modal').innerText()).includes('Préparé, non envoyé'));
  pending = p.waitForEvent('download'); await p.locator('.modal [data-billing="download"]').click(); await (await pending).saveAs(path.join(out, 'facture-demo.pdf'));
  await close();
  await p.locator('[data-billing="credit"][data-id="' + invoice.id + '"]').click(); await p.locator('[data-billing="confirm-credit"]').click();
  docs = (await state()).billingDemo.documents; assert.equal(docs.length, 4); assert.equal(docs[3].originalId, invoice.id); assert.equal(docs[3].type, 'credit'); assert.deepEqual(docs[1], invoice);
  await close(); await p.reload(); await nav('facturation');
  assert.equal((await state()).billingDemo.documents.length, 4);
  assert.equal((await state()).v8.emails.filter(e => e.invoiceId).length, 4);
  assert.equal(await p.locator('[data-billing="credit"][data-id="' + invoice.id + '"]').count(), 0);
  await p.screenshot({ path: path.join(out, 'facturation-desktop.png'), fullPage: true });
  results.immutableOriginalCreditAndReloadDeduplication = true;

  // Free attendance and waiting lists are not purchases. They must not collect a
  // billing address or prepare a payment/document just to book a place.
  await p.evaluate(() => {
    const key = 'kidigital-connect-v1', value = JSON.parse(localStorage.getItem(key));
    value.events.push({ ...value.events[0], id: 'billing-free', title: 'Atelier découverte gratuit', price: 0, capacity: 6 });
    value.events.push({ ...value.events[0], id: 'billing-full', title: 'Atelier complet de test', price: 25, capacity: 1 });
    value.signups.push({ id: 'billing-occupied', eventId: 'billing-full', status: 'confirmed', name: 'Famille fictive', email: 'occupied@example.test' });
    value.offers.find(offer => offer.id === 'o2').price = 0;
    localStorage.setItem(key, JSON.stringify(value));
  });
  await p.reload(); await mode('parent');
  for (const [id, email, expectedStatus] of [['billing-free', 'free@example.test', 'confirmed'], ['billing-full', 'waiting@example.test', 'waitlist']]) {
    await p.locator('[data-action="book"][data-id="' + id + '"]').click();
    assert.equal(await p.locator('#bookEvent .billing-address').count(), 0);
    assert.equal(await p.locator('#bookEvent [name="billingPayment"]').count(), 0);
    for (const [name, value] of Object.entries({ firstName: 'Parent', lastName: 'Test gratuit', email, phone: '0600000000' })) await p.locator('#bookEvent [name="' + name + '"]').fill(value);
    await p.locator('#bookEvent [type="submit"]').click();
    const snapshot = await state();
    assert.equal(snapshot.signups.find(signup => signup.email === email)?.status, expectedStatus);
    assert.equal(snapshot.billingDemo.documents.length, 4); assert.equal(snapshot.billingDemo.pending.length, 0);
    await close();
  }
  await p.locator('#v8ParentAppointments [data-v8="book-appointment"][data-id="o2"]').click();
  await p.locator('.v8-slots button').first().click();
  assert.equal(await p.locator('#v8BookAppointment .billing-address').count(), 0);
  for (const [name, value] of Object.entries({ firstName: 'Parent', lastName: 'Séance gratuite', email: 'free-appointment@example.test', phone: '0600000000' })) await p.locator('#v8BookAppointment [name="' + name + '"]').fill(value);
  await p.locator('#v8BookAppointment [name="consent"]').check();
  await p.locator('#v8BookAppointment [type="submit"]').click();
  assert.equal((await state()).billingDemo.documents.length, 4); assert.equal((await state()).billingDemo.pending.length, 0);
  await close(); await mode('pro'); await nav('facturation');
  results.freeBookingsAndWaitlistsHaveNoInvoiceOrBillingAddress = true;

  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => scrollTo(0, 0));
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.screenshot({ path: path.join(out, 'facturation-mobile.png'), fullPage: true });
  await p.locator('[data-billing="view"]').first().click();
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await close();
  results.desktopAndMobileWithoutOverflow = true;
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ ...results, javascriptErrors: errors, noExternalWrites: true }, null, 2));
  await browser.close();
})().catch(async e => { console.error(e); if (p) await p.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {}); if (browser) await browser.close(); process.exit(1); });
