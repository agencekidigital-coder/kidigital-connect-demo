// UI regression with a fake Google API. Never contacts Google or publishes a real reply.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://localhost:4184'; let browser;
(async () => {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } }); p.setDefaultTimeout(15000);
  const errors = [], publications = []; let reads = 0, published = false;
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.install();
  await p.route('**/api/google?*', async route => {
    const action = new URL(route.request().url()).searchParams.get('action'); let result;
    if (action === 'status') result = { configured: true, connected: true };
    else if (action === 'locations') result = { locations: [{ name: 'accounts/test/locations/demo', title: 'Établissement fictif' }] };
    else if (action === 'reviews') {
      reads++;
      const r1 = { id: 'review-original', rating: 5, author: 'Client fictif A', comment: 'Avis fictif A' }, r2 = { id: 'review-second', rating: 4, author: 'Client fictif B', comment: 'Avis fictif B' }, r3 = { id: 'review-new', rating: 5, author: 'Client fictif C', comment: 'Nouvel avis fictif' };
      result = { reviews: reads === 1 ? [r1, r2] : published ? [r3, r2] : [r3, r1, r2], averageRating: 4.8, totalReviewCount: 3, title: 'Établissement fictif', mapsURL: 'https://maps.google.com/' };
    } else if (action === 'reply') { publications.push(route.request().postDataJSON()); published = true; result = { published: true }; }
    else throw Error('Unexpected action: ' + action);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.locator('#sidebar .navbtn[data-nav="personnaliser"]').click();
  await p.locator('[data-platform="load-google-reviews"]').click();
  await p.locator('#naiteaGoogleLocation').selectOption('accounts/test/locations/demo');
  await p.locator('[data-platform="load-google-reviews"]').click();
  await p.locator('#naiteaGoogleReply0').fill('Ma réponse relue au premier avis.');
  await p.clock.fastForward(300000); assert.equal(reads, 1, 'Automatic refresh must preserve an active draft.');
  await p.locator('[data-platform="load-google-reviews"]').click();
  assert.equal(await p.locator('#naiteaGoogleReply1').inputValue(), 'Ma réponse relue au premier avis.');
  await p.locator('[data-platform="publish-google-reply"][data-index="1"]').click();
  assert.equal(await p.locator('#naiteaGooglePublish [name="reviewId"]').inputValue(), 'review-original');
  await p.clock.fastForward(300000); assert.equal(reads, 2, 'Confirmation modal must keep its reviewed source.');
  await p.locator('#naiteaGooglePublish [name="confirm"]').check(); await p.locator('#naiteaGooglePublish [type="submit"]').click();
  await p.locator('#naiteaGooglePublish').waitFor({ state: 'detached' });
  assert.equal(publications.length, 1); assert.equal(publications[0].review, 'review-original'); assert.equal(publications[0].reply, 'Ma réponse relue au premier avis.'); assert.equal(publications[0].location, 'accounts/test/locations/demo');
  assert.equal(publications[0].confirmed, true); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ fixtureOnly: true, reorderedReviewsPreserveDrafts: true, refreshPausesDuringDraftAndConfirmation: true, publicationUsesReviewedStableId: true, noRealGoogleWrite: true, javascriptErrors: errors }, null, 2));
  await browser.close();
})().catch(async e => { console.error(e); if (browser) await browser.close(); process.exit(1); });
