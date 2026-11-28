// Entire auth provider is an in-browser fixture. This test sends no signup,
// login, reset, or email request to Supabase and creates no real account.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4182';
const OUT = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-onboarding';
const fakeUser = { id: 'isolated-fixture', email: 'testeuse@example.test', user_metadata: { full_name: 'Camille Démonstration' } };
const sdk = String.raw`
const read=()=>JSON.parse(sessionStorage.getItem('onboarding-fixture'));
const save=s=>sessionStorage.setItem('onboarding-fixture',JSON.stringify(s));
export function createClient(){let listener;return {auth:{
  getUser:async()=>{const s=read();s.verified=(s.verified||0)+1;save(s);return {data:{user:s.user||null},error:s.verificationError?{message:'Invalid session'}:null}},
  onAuthStateChange:fn=>{listener=fn;if(new URLSearchParams(location.hash.slice(1)).get('type')==='recovery')setTimeout(()=>fn('PASSWORD_RECOVERY'),0);return {data:{subscription:{unsubscribe(){}}}}},
  signInWithPassword:async input=>{const s=read();s.login=input;s.user=s.fixtureUser;save(s);listener?.('SIGNED_IN');return {data:{user:s.user},error:null}},
  signUp:async input=>{const s=read();s.signup=input;if(s.immediate)s.user=s.fixtureUser;save(s);return {data:{session:s.immediate?{fixture:true}:null},error:null}},
  resetPasswordForEmail:async(email,options)=>{const s=read();s.reset={email,options};save(s);return {error:null}},
  updateUser:async input=>{const s=read();s.updatedPassword=input.password;save(s);return {error:null}},
  signOut:async()=>{const s=read();if(s.logoutError)throw Error('fixture');s.user=null;s.loggedOut=true;save(s);listener?.('SIGNED_OUT');return {error:null}}
}}}`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], forbidden = [];
  const contexts = [];
  async function fixture(state = {}, viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport, locale: 'fr-FR' }); contexts.push(context);
    await context.addInitScript(initial => {
      if (!sessionStorage.getItem('onboarding-fixture')) sessionStorage.setItem('onboarding-fixture', JSON.stringify(initial));
    }, { fixtureUser: fakeUser, ...state });
    await context.route('**/api/public-config', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://auth.example.test', publishableKey: 'isolated-placeholder' }) }));
    await context.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: sdk }));
    await context.route('https://auth.example.test/**', route => { forbidden.push(route.request().url()); return route.abort(); });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }
  const state = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('onboarding-fixture')));
  const ready = page => page.waitForFunction(() => !document.getElementById('submitBtn').disabled);
  const welcome = page => page.locator('#onboardingContent').waitFor({ state: 'visible' });
  try {
    fs.mkdirSync(OUT, { recursive: true });
    // Offer → signup pending → explicit confirmation guidance, exact callback.
    const pending = await fixture();
    await pending.goto(BASE + '/connexion.html?mode=signup&offre=complet&next=https://other.test'); await ready(pending);
    await pending.locator('#fullName').fill('Camille Démonstration');
    await pending.locator('#email').fill(fakeUser.email); await pending.locator('#password').fill('Exemple-test-2026');
    await pending.locator('#submitBtn').click(); await pending.locator('#confirmationPanel').waitFor();
    assert.equal((await state(pending)).signup.options.emailRedirectTo, new URL(BASE).origin + '/connexion.html');
    assert.equal(await pending.locator('#confirmationEmail').innerText(), fakeUser.email);
    assert.equal(await pending.locator('#authForm').isVisible(), false);
    assert.match(await pending.locator('#confirmedLogin').getAttribute('href'), /offre=complet&mode=login$/);
    await pending.locator('#confirmedLogin').click(); await ready(pending);
    assert.equal(await pending.locator('#loginTab').getAttribute('aria-selected'), 'true');
    await pending.locator('#email').fill(fakeUser.email); await pending.locator('#password').fill('Exemple-test-2026');
    await pending.locator('#submitBtn').click(); await pending.waitForURL('**/bienvenue.html?offre=complet'); await welcome(pending);
    assert.match(await pending.locator('#welcomeTitle').innerText(), /Bienvenue Camille/);
    assert.match(await pending.locator('#welcomeOffer').innerText(), /Aucun abonnement ni prélèvement/);
    assert.equal(await pending.locator('#openProfessionalApp').getAttribute('href'), '/pro');
    assert.equal(await pending.locator('#openFamilyApp').getAttribute('href'), '/familles');
    assert.match(await pending.locator('.tester-demo').innerText(), /exemples fictifs/);
    assert.equal(await pending.evaluate(() => location.hash), '');
    assert((await state(pending)).verified >= 2, 'provider validates both login and welcome');

    // Narrated tutorial must decode and expose the default French captions.
    const video = pending.locator('#testerTutorial'); await video.evaluate(v => { v.load(); });
    await pending.waitForFunction(() => { const v = document.getElementById('testerTutorial'); return v.readyState >= 1 && v.duration > 30 && !v.error; });
    assert.equal(await video.evaluate(v => v.textTracks[0].mode), 'showing');
    await video.evaluate(v => v.play());
    await pending.waitForFunction(() => document.getElementById('testerTutorial').webkitAudioDecodedByteCount > 0);
    await video.evaluate(v => v.pause());
    await pending.evaluate(() => document.fonts.ready);
    await pending.screenshot({ path: path.join(OUT, 'welcome-desktop.png'), fullPage: true });
    for (const width of [390, 320]) {
      await pending.setViewportSize({ width, height: 844 });
      assert.equal(await pending.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no welcome overflow at ' + width);
      await pending.screenshot({ path: path.join(OUT, 'welcome-' + width + '.png'), fullPage: true });
    }
    await pending.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('onboarding-fixture')); s.logoutError = true; sessionStorage.setItem('onboarding-fixture', JSON.stringify(s)); });
    await pending.locator('#welcomeLogout').click(); await pending.locator('#welcomeStatus').getByText('La déconnexion n’a pas abouti.', { exact: false }).waitFor();
    assert.equal(await pending.locator('#welcomeLogout').isEnabled(), true);
    await pending.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('onboarding-fixture')); s.logoutError = false; sessionStorage.setItem('onboarding-fixture', JSON.stringify(s)); });
    await pending.locator('#welcomeLogout').click(); await pending.waitForURL('**/connexion.html?offre=complet&mode=login'); await ready(pending);
    assert.equal((await state(pending)).loggedOut, true);

    // Existing email callback session resumes on the same current origin.
    const callback = await fixture({ user: fakeUser });
    await callback.goto(BASE + '/connexion.html#access_token=FAKE-NOT-A-TOKEN&type=signup');
    await callback.waitForURL('**/bienvenue.html'); await welcome(callback);
    assert.equal(new URL(callback.url()).origin, new URL(BASE).origin); assert.equal(new URL(callback.url()).hash, '');

    // Signup with an immediate provider session also goes through verification.
    const immediate = await fixture({ immediate: true });
    await immediate.goto(BASE + '/connexion.html?mode=signup&offre=fiche'); await ready(immediate);
    await immediate.locator('#fullName').fill('Camille Démonstration'); await immediate.locator('#email').fill(fakeUser.email); await immediate.locator('#password').fill('Exemple-test-2026');
    await immediate.locator('#submitBtn').click(); await immediate.waitForURL('**/bienvenue.html?offre=fiche'); await welcome(immediate);
    assert.match(await immediate.locator('#welcomeOffer').innerText(), /Ma fiche gratuite/);

    // Stored auth-shaped flags never count as a provider-verified session.
    const guest = await fixture();
    await guest.goto(BASE + '/connexion.html'); await ready(guest);
    await guest.evaluate(() => { localStorage.setItem('naitea-auth', JSON.stringify({ session: true, access_token: 'FAKE' })); localStorage.setItem('naitea-tester-offer-v1', JSON.stringify({ session: true, offer: 'complet', savedAt: Date.now() })); });
    await guest.goto(BASE + '/bienvenue.html'); await guest.locator('#onboardingGuest').waitFor();
    assert.equal(await guest.locator('#onboardingContent').isVisible(), false);
    assert.match(await guest.locator('#guestMessage').innerText(), /Connectez-vous/);

    // Recovery remains a separate verified state; mismatch never updates user.
    const reset = await fixture({ user: fakeUser });
    await reset.goto(BASE + '/connexion.html#type=recovery&access_token=FAKE-RECOVERY');
    await reset.locator('#resetPanel').waitFor(); assert.match(reset.url(), /connexion\.html#/);
    await reset.locator('#newPassword').fill('Exemple-nouveau-2026'); await reset.locator('#confirmPassword').fill('Autre-nouveau-2026');
    await reset.locator('#savePasswordBtn').click(); assert.match(await reset.locator('#status').innerText(), /ne correspondent pas/); assert.equal((await state(reset)).updatedPassword, undefined);
    await reset.locator('#confirmPassword').fill('Exemple-nouveau-2026'); await reset.locator('#savePasswordBtn').click();
    await reset.waitForFunction(() => location.hash === '' && !document.getElementById('authPanel').hidden);
    assert.equal((await state(reset)).updatedPassword, 'Exemple-nouveau-2026'); assert.equal((await state(reset)).loggedOut, true);
    assert.equal(await reset.locator('#resetPanel').isVisible(), false);
    await reset.locator('#forgotBtn').click(); await reset.locator('#resetEmail').fill(fakeUser.email); await reset.locator('#sendResetBtn').click();
    await reset.waitForFunction(() => JSON.parse(sessionStorage.getItem('onboarding-fixture')).reset);
    assert.equal((await state(reset)).reset.options.redirectTo, new URL(BASE).origin + '/connexion.html');
    const expired = await fixture(); await expired.goto(BASE + '/connexion.html#type=recovery');
    await expired.locator('#status.error').waitFor(); assert.equal(await expired.locator('#resetPanel').isVisible(), false);

    // Offline provider config shows an honest guest route, not local access.
    const offline = await fixture({ user: fakeUser });
    await offline.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await offline.goto(BASE + '/bienvenue.html'); await offline.locator('#onboardingGuest').waitFor();
    assert.equal(await offline.locator('#onboardingContent').isVisible(), false);
    assert.match(await offline.locator('#guestMessage').innerText(), /momentanément indisponible/);
    assert.deepEqual(forbidden, []); assert.deepEqual(errors, []);
    const result = { signupAndLogin: 'pass', callbackCurrentOrigin: 'pass', offersPreserved: 'pass', recoveryAndExpiredLinks: 'pass', noLocalSessionTrust: 'pass', narratedTutorialAndCaptions: 'pass', responsiveWidths: [1440, 390, 320], logoutFailureAndRetry: 'pass', realAccountsCreated: 0, realEmailsSent: 0, realAuthRequests: forbidden.length, browserErrors: errors.length };
    fs.writeFileSync(path.join(OUT, 'browser-results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { for (const context of contexts) await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
