// Read-only readiness check. Never submit a form or create an account/email.
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { X509Certificate, createHash } = require('node:crypto');
const { readPublicConfig } = require('../server/public-config.cjs');
const BASE = process.env.BASE_URL || 'https://naitea-beta.agence-kidigital.workers.dev';
const OUT = process.env.ARTIFACT_DIR || '/workspace/artifacts/naitea-auth-ready';
if (!['naitea-beta.agence-kidigital.workers.dev', '127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw Error('Unexpected preview host.');
(async () => {
  const args = ['--no-sandbox'], directory = '/usr/local/share/ca-certificates';
  if (fs.existsSync(directory)) {
    const pins = fs.readdirSync(directory).filter(f => f.endsWith('.crt')).map(f => createHash('sha256').update(new X509Certificate(fs.readFileSync(path.join(directory, f))).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
    if (pins.length) args.push('--ignore-certificate-errors-spki-list=' + pins.join(','));
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args });
  const errors = [], writes = [], results = [];
  fs.mkdirSync(OUT, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      try {
        // Block all state-changing traffic, including background SDK refreshes.
        await context.route('**/*', route => {
          if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
            writes.push({ method: route.request().method(), origin: new URL(route.request().url()).origin });
            return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(BASE + '/connexion.html?mode=signup', { waitUntil: 'domcontentloaded', timeout: 30000 });
        assert.equal(response.status(), 200);
        assert.equal(response.headers()['x-frame-options'], 'DENY');
        assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
        const config = await page.evaluate(async () => {
          const response = await fetch('/api/public-config', { credentials: 'omit', cache: 'no-store' });
          return { status: response.status, value: response.ok ? await response.json() : null };
        });
        assert.equal(config.status, 200, 'Public configuration is still unavailable.');
        const safe = readPublicConfig({ SUPABASE_URL: config.value?.url, SUPABASE_PUBLISHABLE_KEY: config.value?.publishableKey });
        assert(safe, 'The public configuration did not pass validation.');
        // No credentials, URLs or raw responses are written to the report.
        const settings = await page.evaluate(async config => {
          const response = await fetch(config.url + '/auth/v1/settings', {
            method: 'GET', credentials: 'omit', redirect: 'error',
            headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) return { status: response.status };
          const value = await response.json();
          return {
            status: response.status,
            emailEnabled: value.external?.email === true,
            signupAllowed: value.disable_signup === false,
            emailConfirmationRequired: value.mailer_autoconfirm === false,
          };
        }, safe);
        assert.equal(settings.status, 200, 'Supabase refused the read-only settings request.');
        assert.equal(settings.emailEnabled, true, 'Email authentication is disabled.');
        assert.equal(settings.signupAllowed, true, 'New account creation is disabled.');
        assert.equal(settings.emailConfirmationRequired, true, 'Email confirmation must be enabled before the test.');
        await page.locator('#submitBtn:not([disabled])').waitFor();
        assert.equal(await page.locator('#signupTab').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#email').inputValue(), '');
        assert.equal(await page.locator('#password').inputValue(), '');
        assert.equal(await page.locator('#confirmationPanel').isVisible(), false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        const locks = await page.evaluate(async () => {
          const policy = await (await fetch('/api/deployment', { credentials: 'omit', cache: 'no-store' })).json();
          const statuses = {};
          for (const route of ['/api/account', '/api/bookings', '/api/stripe', '/api/admin', '/api/google']) statuses[route] = (await fetch(route, { credentials: 'omit', cache: 'no-store' })).status;
          return { policy, statuses };
        });
        for (const name of ['accountProfile', 'realBookings', 'payments', 'invoices', 'admin', 'google', 'meta', 'sms']) assert.equal(locks.policy[name], false);
        for (const value of Object.values(locks.statuses)) assert.equal(value, 423);
        await page.screenshot({ path: path.join(OUT, 'inscription-' + width + '.png'), fullPage: true });
        results.push({ width, authFormReady: true, ...settings, businessWorkerRoutesClosed: true });
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    const report = { runtime: 'Cloudflare Workers preview, anonymous read-only check', results, emailsSent: 0, accountsCreated: 0, writes: writes.length, errors };
    fs.writeFileSync(path.join(OUT, 'verification.json'), JSON.stringify(report, null, 2));
    process.stdout.write(JSON.stringify(report) + '\n');
  } finally { await browser.close(); }
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
