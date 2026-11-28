// Isolated local preview: no real account, message, payment or external write.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4189';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Test the isolated local demonstration.');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const errors = [], remote = [], chatRequests = []; let checkingChat = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(BASE)) remote.push(request.url()); if (checkingChat && /\/api\/|supabase|stripe|gateway/.test(request.url())) chatRequests.push(request.url()); });
    await page.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto(BASE + '/?vue=parents', { waitUntil: 'networkidle' });
    await page.locator('#v12Presentation').waitFor();
    await page.evaluate(() => {
      const k = 'kidigital-connect-v1', s = JSON.parse(localStorage.getItem(k));
      s.profile.publicPage = { ...s.profile.publicPage, cancellation: '', cancellationURL: 'https://pro.example/annulation', faq: [{ question: 'Puis-je venir avec des jumeaux ?', answer: 'Écrivez-moi pour préparer votre accueil.' }] };
      s.profile.openingHours = [{ id: 'hours-test', days: [1, 2, 3], start: '09:00', end: '17:00', mode: 'En cabinet', location: 'Cabinet de démonstration' }];
      s.offers[0].modalities = ['En visio', 'À domicile'];
      s.offers[0].modalityDetails = { video: { platform: 'Zoom' }, home: { zone: 'Lille et alentours' } };
      s.v8.availability = Array.from({ length: 7 }, (_, day) => ({ id: 'rule-' + day, offerId: s.offers[0].id, day, start: '09:00', end: '17:00', duration: 60, buffer: 0 }));
      localStorage.setItem(k, JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'networkidle' });
    const stored = await page.evaluate(() => localStorage.getItem('kidigital-connect-v1'));
    checkingChat = true;
    await page.locator('#naiteaChatLauncher').click();
    assert.equal(await page.locator('#naiteaChatLauncher img').getAttribute('src'), '/assets/berceau/transparent/messagerie.png');
    assert(await page.locator('#naiteaChat input').evaluate(input => document.activeElement === input));
    const ask = async text => {
      await page.locator('#naiteaChat input').fill(text);
      await page.locator('#naiteaChatForm [type="submit"]').click();
      return page.locator('#naiteaChatMessages .naitea-chat-answer').last().innerText();
    };
    assert.match(await ask('Bonjour'), /Bonjour/);
    assert.match(await ask('Accompagnement post-partum'), /120/);
    assert.match(await ask('Et en visio ?'), /Zoom/);
    assert.match(await ask('Et son prix ?'), /120/);
    assert.match(await ask('Quand est la prochaine date ?'), /Prochain créneau affiché/);
    assert.match(await ask('Merci !'), /Avec plaisir/);
    assert.match(await ask('Puis-je venir avec des jumeaux ?'), /préparer votre accueil/);
    assert.match(await ask('Quels sont vos horaires ?'), /Lundi, Mardi, Mercredi.*09:00 à 17:00/);
    assert.match(await ask('Quel diagnostic pour mon bébé ?'), /sans diagnostic ni conseil médical/);
    assert.match(await ask('Je cherche une information absente'), /Poser une question.*rendez-vous/);
    assert.equal(await page.evaluate(() => localStorage.getItem('kidigital-connect-v1')), stored, 'conversation is not persisted');
    assert.deepEqual(chatRequests, [], 'chat does not call an API'); checkingChat = false;
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#naiteaChat').isVisible(), false);
    assert(await page.locator('#naiteaChatLauncher').evaluate(el => el === document.activeElement));
    await page.locator('#naiteaChatLauncher').click();
    assert.match(await page.locator('#naiteaChatMessages').innerText(), /Zoom/);
    await page.locator('[data-platform="clear-chat"]').click();
    assert.equal(await page.locator('#naiteaChatMessages .naitea-chat-question').count(), 0);
    await page.locator('[data-platform="chat-contact"]').click();
    assert.equal(await page.locator('#naiteaChat').isVisible(), false);
    assert(await page.locator('#v12Contact h2').evaluate(el => el === document.activeElement));
    // A supplied policy appears before confirmation for workshops and individual sessions.
    await page.locator('#v8ParentWorkshops [data-action="book"]').first().click();
    assert.equal(await page.locator('#bookEvent .naitea-booking-policy a').getAttribute('href'), 'https://pro.example/annulation');
    await page.locator('.modal .close').click();
    await page.locator('#v8ParentAppointments [data-v8="book-appointment"]').first().click();
    await page.locator('.v8-slots button').first().click();
    assert.equal(await page.locator('#v8BookAppointment .naitea-booking-policy a').getAttribute('href'), 'https://pro.example/annulation');
    await page.locator('.modal .close').click();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.locator('#naiteaChatLauncher').click();
      const r = await page.locator('#naiteaChat').boundingBox();
      assert(r.x >= 0 && r.x + r.width <= width && r.y >= 0 && r.y + r.height <= 844);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#naiteaChat [data-platform="toggle-chat"]').click();
    }
    // Invalid and absent URLs add no policy and no default legal condition.
    await page.evaluate(() => { const k = 'kidigital-connect-v1', s = JSON.parse(localStorage.getItem(k)); s.profile.publicPage.cancellationURL = 'javascript:alert(1)'; localStorage.setItem(k, JSON.stringify(s)); });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.v12-cancellation-link').count(), 0);
    await page.locator('#v8ParentWorkshops [data-action="book"]').first().click();
    assert.equal(await page.locator('#bookEvent .naitea-booking-policy').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log(JSON.stringify({ contextualPublicConversation: 'pass', noConversationStorageOrAPICall: 'pass', keyboardAndMobile: 'pass', optionalPolicyBeforeBooking: 'pass', remoteRequests: 0 }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
