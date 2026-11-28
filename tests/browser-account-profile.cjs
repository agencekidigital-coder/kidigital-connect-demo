// Entire auth provider and account API are fixtures. No real accounts or writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4194';
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw Error('This fixture test is local only.');
const OUT = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-account-profile';
const A = { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', email: 'compte-a@example.test' };
const B = { id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', email: 'compte-b@example.test' };
const sdk = `
export function createClient(){
  const f=window.__accountFixture; let callback;
  window.__authChange=(user,event)=>{f.user=user;callback?.(event||(user?'SIGNED_IN':'SIGNED_OUT'),{user});};
  return {auth:{
    getSession:async()=>({data:{session:f.user?{user:f.user,access_token:f.user.id.startsWith('a')?'a.a.a':'b.b.b'}:null}}),
    getUser:async()=>{const user=structuredClone(f.user);if(f.holdUser){f.holdUser=false;await new Promise(resolve=>window.__releaseUser=resolve);}return {data:{user}};},
    onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};},
    signOut:async()=>{if(f.logoutFailure)throw Error('fixture');f.user=null;callback?.('SIGNED_OUT');return {error:null};}
  }};
}`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], forbidden = [], contexts = [];
  async function fixture({ enabled = true, user = A, status = 200, viewport = { width: 1440, height: 1000 } } = {}) {
    const context = await browser.newContext({ viewport, locale: 'fr-FR' }); contexts.push(context);
    await context.addInitScript(user => {
      window.__accountFixture = { user };
      localStorage.setItem('kidigital-connect-v1', 'DEMO-SENTINEL');
    }, user);
    let records = [], nextStatus = status, delayedSave, releaseSave;
    const profiles = {
      'a.a.a': { full_name: 'Camille Exemple', business_name: 'Ateliers A' },
      'b.b.b': { full_name: 'Lou Exemple', business_name: 'Ateliers B' },
    };
    await context.route('**/api/deployment', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ accountProfile: enabled }) }));
    await context.route('**/api/public-config', route => {
      records.push({ config: true });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://fixtureproject.supabase.co', publishableKey: 'sb_publishable_' + 'p'.repeat(30) }) });
    });
    await context.route('https://cdn.jsdelivr.net/**', route => {
      records.push({ sdk: true }); return route.fulfill({ contentType: 'text/javascript', body: sdk });
    });
    await context.route('https://*.supabase.co/**', route => { forbidden.push(route.request().url()); return route.abort(); });
    await context.route('**/api/account', async route => {
      const request = route.request(), method = request.method();
      const token = (request.headers().authorization || '').replace('Bearer ', '');
      const input = method === 'PATCH' ? request.postDataJSON() : null;
      records.push({ method, token, input });
      const responseStatus = nextStatus, row = structuredClone(profiles[token]);
      if (method === 'PATCH' && responseStatus === 200) Object.assign(profiles[token], input);
      if (method === 'PATCH' && delayedSave) { delayedSave = false; await new Promise(resolve => { releaseSave = resolve; }); }
      try { await route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(responseStatus === 200 ? { profile: method === 'PATCH' ? { ...row, ...input } : row } : { code: 'FIXTURE_ERROR' }) }); }
      catch (error) { if (!/closed|handled|cancel|abort/i.test(error.message)) throw error; }
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(BASE + '/') && !request.url().startsWith('https://cdn.jsdelivr.net/')) forbidden.push(request.url());
    });
    return { page, records, profiles, setStatus(value) { nextStatus = value; }, delaySave() { delayedSave = true; }, releaseSave() { releaseSave?.(); } };
  }
  const ready = page => page.locator('#accountDetails').waitFor({ state: 'visible' });
  const sameDemo = page => page.evaluate(() => localStorage.getItem('kidigital-connect-v1'));
  try {
    const closed = await fixture({ enabled: false });
    await closed.page.goto(BASE + '/compte');
    await closed.page.getByRole('heading', { name: 'L’espace compte ouvrira bientôt.' }).waitFor();
    assert.equal(await closed.page.locator('#accountDetails').isVisible(), false);
    assert.deepEqual(closed.records, []); // No SDK, config or account request.

    const guest = await fixture({ user: null });
    await guest.page.goto(BASE + '/compte');
    await guest.page.locator('#accountLogin').waitFor({ state: 'visible' });
    assert(!guest.records.some(r => r.method));

    for (const width of [1440, 390, 320]) {
      const current = await fixture({ viewport: { width, height: 1000 } });
      const page = current.page;
      const response = await page.goto(BASE + '/compte'); await ready(page);
      assert.equal(response.headers()['x-frame-options'], 'DENY');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.equal(await page.locator('#accountFullName').inputValue(), 'Camille Exemple');
      await page.locator('#accountFullName').fill('Camille Modifiée');
      const readsBeforeRefresh = current.records.filter(r => r.method === 'GET').length;
      await page.evaluate(() => window.__authChange(window.__accountFixture.user, 'TOKEN_REFRESHED'));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await page.locator('#accountFullName').inputValue(), 'Camille Modifiée');
      assert.equal(current.records.filter(r => r.method === 'GET').length, readsBeforeRefresh);
      await page.locator('#accountBusinessName').fill('<img src=x onerror=alert(1)>');
      await page.locator('#accountSave').click();
      await page.locator('#accountSaveStatus').filter({ hasText: 'sont enregistrées' }).waitFor();
      assert.equal(current.records.filter(r => r.method === 'PATCH').length, 1);
      assert.deepEqual(current.records.find(r => r.method === 'PATCH').input, { full_name: 'Camille Modifiée', business_name: '<img src=x onerror=alert(1)>' });
      assert.equal(await page.locator('#accountDetails img').count(), 0);
      assert.equal(await sameDemo(page), 'DEMO-SENTINEL');
      await page.screenshot({ path: path.join(OUT, 'compte-' + width + '.png'), fullPage: true });
      // A delayed provider identity response cannot overwrite the next account.
      await page.evaluate(() => { window.__accountFixture.holdUser = true; window.__authChange(window.__accountFixture.user, 'INITIAL_SESSION'); });
      await page.waitForFunction(() => typeof window.__releaseUser === 'function');
      assert.equal(await page.locator('#accountFullName').inputValue(), '');
      await page.evaluate(user => window.__authChange(user), B); await ready(page);
      assert.equal(await page.locator('#accountFullName').inputValue(), 'Lou Exemple');
      await page.evaluate(() => window.__releaseUser());
      // A renderer turn is enough: the stale promise resolves immediately.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#accountFullName').inputValue(), 'Lou Exemple');
      assert.equal(await sameDemo(page), 'DEMO-SENTINEL');
    }

    const late = await fixture(); await late.page.goto(BASE + '/compte'); await ready(late.page);
    late.delaySave(); await late.page.locator('#accountFullName').fill('Ancien compte A');
    const sent = late.page.waitForRequest(request => request.url() === BASE + '/api/account' && request.method() === 'PATCH');
    await late.page.locator('#accountSave').click(); await sent;
    await late.page.evaluate(user => window.__authChange(user), B); await ready(late.page);
    late.releaseSave();
    await late.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await late.page.locator('#accountFullName').inputValue(), 'Lou Exemple');
    assert.equal(await late.page.locator('#accountSaveStatus').innerText(), '');

    const failed = await fixture(); await failed.page.goto(BASE + '/compte'); await ready(failed.page);
    failed.setStatus(503); await failed.page.locator('#accountSave').click();
    await failed.page.locator('#accountSaveStatus[data-error="true"]').waitFor();
    assert(!/sont enregistrées/.test(await failed.page.locator('#accountSaveStatus').innerText()));
    await failed.page.evaluate(() => { window.__accountFixture.logoutFailure = true; });
    await failed.page.locator('#accountLogout').click();
    await failed.page.getByRole('heading', { name: 'La déconnexion n’a pas abouti.' }).waitFor();
    assert.equal(await failed.page.locator('#accountFullName').inputValue(), '');
    assert.equal(await failed.page.locator('#accountEmail').innerText(), '');
    assert.equal(await failed.page.locator('#accountDetails').isVisible(), false);
    await failed.page.evaluate(() => { window.__accountFixture.logoutFailure = false; });
    await failed.page.locator('#accountLogout').click();
    await failed.page.getByRole('heading', { name: 'Vous êtes déconnectée.' }).waitFor();

    for (const status of [404, 409]) {
      const missing = await fixture({ status }); await missing.page.goto(BASE + '/compte');
      await missing.page.getByRole('heading', { name: 'Votre profil est indisponible.' }).waitFor();
      assert.equal(await missing.page.locator('#accountDetails').isVisible(), false);
      assert.equal(missing.records.filter(r => r.method === 'PATCH').length, 0);
    }
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    const report = { accountApi: 'mocked', auth: 'mocked', viewports: [1440, 390, 320], defaultClosed: true, staleIdentityAndSaveRejected: true, demoStorageUntouched: true, externalProviderCalls: forbidden.length, errors };
    fs.writeFileSync(path.join(OUT, 'verification.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally { await Promise.all(contexts.map(context => context.close())); await browser.close(); }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
