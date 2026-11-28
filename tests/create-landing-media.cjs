// Real UI recordings and screenshots for the marketing page. All records are
// fictitious fixtures in isolated localStorage. No account, email or payment.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4186';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Record only the local demonstration.');
const out = path.resolve(__dirname, '../assets/landing'), raw = '/workspace/artifacts/naitea-landing-recordings';
fs.mkdirSync(raw, { recursive: true });
let browser;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const stateKey = 'kidigital-connect-v1';
async function ready(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(image => { const r = image.getBoundingClientRect(); return r.height && r.top < innerHeight && r.bottom > 0; }).map(image => image.decode().catch(() => {})));
  });
}
const nav = (page, id) => page.locator('#sidebar .navbtn[data-nav="' + id + '"]').click();
const mode = (page, id) => page.locator('[data-mode="' + id + '"]:visible').first().click();
async function context(options = {}) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...options });
  await c.route('**/api/public-config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await c.route('**/*', route => {
    const r = route.request();
    if (r.method() !== 'GET' && !r.url().startsWith(BASE)) return route.abort();
    return route.fallback();
  });
  return c;
}
function timestamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
}
async function record(kind, fixture, action) {
  console.log('Recording ' + kind + ' from the actual app…');
  const c = await context({ recordVideo: { dir: raw, size: { width: 1440, height: 900 } } });
  await c.addInitScript(({ key, value }) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, { key: stateKey, value: fixture });
  const page = await c.newPage(), created = Date.now();
  await page.goto(BASE + (kind === 'familles' ? '/?vue=parents' : '/'), { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.addStyleTag({ content: '#naiteaDemoCaption{position:fixed;left:50%;bottom:23px;transform:translateX(-50%);z-index:2147483647;max-width:calc(100% - 110px);width:max-content;background:#590425;color:#FEF8ED;border:1px solid #FEF8ED88;border-radius:12px;padding:13px 25px;font:600 23px/1.35 "Source Sans 3",sans-serif;text-align:center;box-shadow:0 5px 24px #59042522;pointer-events:none}#naiteaDemoPointer{position:fixed;top:-100px;left:-100px;width:18px;height:18px;background:#D89328AA;border:2px solid #590425;border-radius:50%;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%)}' });
  await page.evaluate(() => {
    const caption = document.createElement('div'); caption.id = 'naiteaDemoCaption'; caption.textContent = 'Naïtea · Démonstration avec données fictives'; document.body.append(caption);
    const pointer = document.createElement('div'); pointer.id = 'naiteaDemoPointer'; document.body.append(pointer);
    document.addEventListener('mousemove', e => { pointer.style.left = e.clientX + 'px'; pointer.style.top = e.clientY + 'px'; });
    document.addEventListener('pointerdown', () => pointer.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.8)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 400));
  });
  const start = Date.now(), cues = [];
  const scene = async (text, perform, hold = 3800) => {
    const from = (Date.now() - start) / 1000;
    await page.evaluate(value => { document.getElementById('naiteaDemoCaption').textContent = value; }, text);
    if (perform) await perform();
    await ready(page); await delay(hold);
    cues.push({ from, to: (Date.now() - start) / 1000, text });
  };
  await action(page, scene);
  const duration = (Date.now() - start) / 1000, file = await page.video().path();
  await c.close();
  console.log('Encoding ' + kind + ' (' + duration.toFixed(1) + ' seconds)…');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String((start - created) / 1000), '-i', file, '-t', String(duration), '-an', '-vf', 'fps=24,setsar=1', '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'demo-' + kind + '.mp4')]);
  const vtt = 'WEBVTT\n\n' + cues.map(cue => timestamp(cue.from) + ' --> ' + timestamp(cue.to) + '\n' + cue.text + '\n').join('\n');
  fs.writeFileSync(path.join(out, 'demo-' + kind + '.vtt'), vtt);
  return { name: kind, duration, cues, bytes: fs.statSync(path.join(out, 'demo-' + kind + '.mp4')).size };
}
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const c = await context({ viewport: { width: 1440, height: 1000 } }), page = await c.newPage(); page.setDefaultTimeout(20000);
    await page.goto(BASE); await page.locator('.v8-calendar').waitFor();
    const week = await page.evaluate(key => {
      const data = JSON.parse(localStorage.getItem(key)), date = new Date(); date.setDate(date.getDate() + (8 - date.getDay()) % 7 || 7);
      const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      data.events.forEach((event, i) => { const next = new Date(date); next.setDate(date.getDate() + 1 + i * 2); event.date = iso(next); });
      data.profile.photo = '/assets/landing/brand-additions/accompagnante-illustration.jpg'; data.profile.email = 'camille@example.test'; data.profile.publicPage.headline = 'Massage bébé, portage et accompagnement post-partum';
      localStorage.setItem(key, JSON.stringify(data)); return iso(date);
    }, stateKey);
    await page.reload(); await page.locator('.v8-calendar').waitFor();
    await page.locator('[data-v8="calendar-view"][data-value="week"]').click();
    await page.locator('#v8CalendarDate').fill(week); await page.locator('#v8CalendarDate').press('Tab'); await ready(page);
    await page.screenshot({ path: path.join(out, 'agenda-demo.png') });
    await nav(page, 'rendezvous'); await page.locator('#v8Availability [name="offerId"]').selectOption('o1');
    await page.locator('#v8Availability [name="start"]').fill('09:00'); await page.locator('#v8Availability [name="end"]').fill('17:00');
    await page.locator('#v8Availability [type="submit"]').click();
    await mode(page, 'parent'); await page.locator('#toastHost .toast').waitFor({ state: 'detached' }); await ready(page); await page.screenshot({ path: path.join(out, 'fiche-demo.png') });
    await page.setViewportSize({ width: 1440, height: 900 }); await ready(page); await page.screenshot({ path: path.join(out, 'demo-familles-poster.jpg'), type: 'jpeg', quality: 85 });
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await ready(page); await page.screenshot({ path: path.join(out, 'famille-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 }); await mode(page, 'pro'); await nav(page, 'communication');
    await page.locator('[data-v8="comm-tab"][data-value="studio"]').click();
    await page.locator('[data-v10="templates"]').click(); await page.locator('[data-v10="apply-template"][data-id="editorial"]').click();
    await page.locator('[data-design="format"]').selectOption('square'); await ready(page);
    await page.screenshot({ path: path.join(out, 'studio-demo.png') });
    await page.locator('.v8-design-preview').screenshot({ path: path.join(out, 'studio-detail.png') });
    // Keep this fixture only in the isolated recording browser, never in Supabase.
    const fixture = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), stateKey);
    await nav(page, 'dashboard'); await page.setViewportSize({ width: 1440, height: 900 }); await ready(page);
    await page.screenshot({ path: path.join(out, 'demo-pro-poster.jpg'), type: 'jpeg', quality: 85 });
    await c.close();
    const pro = await record('pro', fixture, async (p, scene) => {
      await scene('Votre activité, dans un seul espace.', null, 3500);
      await scene('Un calendrier pour vos ateliers et vos rendez-vous.', async () => { await p.locator('[data-v8="calendar-view"][data-value="week"]').click(); await p.locator('#v8CalendarDate').fill(week); await p.locator('#v8CalendarDate').press('Tab'); }, 4200);
      await scene('Créez un atelier et choisissez son public et sa modalité.', async () => { await nav(p, 'ateliers'); await p.locator('[data-action="create-event"]').click(); await p.locator('#createEvent [name="title"]').fill('Chant prénatal'); await p.locator('#createEvent [name="category"]').selectOption({ label: 'Chant prénatal' }); }, 4200);
      await scene('Publiez vos disponibilités sur plusieurs jours.', async () => { await p.locator('.modal .close').click(); await nav(p, 'rendezvous'); await p.locator('#v8Availability').scrollIntoViewIfNeeded(); }, 4200);
      await scene('Retrouvez les inscriptions et les coordonnées de vos familles.', async () => { await nav(p, 'familles'); }, 4200);
      await scene('Personnalisez vos publications avec vos textes et vos photos.', async () => { await nav(p, 'communication'); await p.locator('[data-v8="comm-tab"][data-value="studio"]').click(); }, 5200);
      await scene('Préparez aussi vos bons cadeaux et leurs visuels.', async () => { await nav(p, 'cadeaux'); }, 4200);
      await scene('Parcours de démonstration : aucun achat ni envoi réel.', async () => { await nav(p, 'dashboard'); }, 3000);
    });
    const familles = await record('familles', fixture, async (p, scene) => {
      await scene('Une fiche pour découvrir votre approche et vos offres.', null, 4000);
      await scene('Les familles consultent vos ateliers et leurs informations.', async () => { await p.locator('a[href="#v8ParentWorkshops"]').first().click(); }, 4200);
      await scene('Un formulaire clair pour réserver une place.', async () => { await p.locator('#v8ParentWorkshops [data-action="book"]').first().click(); }, 4200);
      await scene('Pour une séance individuelle, les dates sont visibles directement.', async () => { await p.locator('.modal .close').click(); await p.locator('#v8ParentAppointments [data-v8="book-appointment"][data-id="o1"]').click(); }, 4400);
      await scene('La famille choisit un horaire et une modalité disponible.', async () => { await p.locator('.v8-slots button').first().click(); await p.locator('[name="bookingModality"][value="En visio"]').check(); }, 4300);
      await scene('Un accompagnement peut aussi être offert en bon cadeau.', async () => { await p.locator('.modal .close').click(); await p.locator('[data-berceau="buy-gift"]').click(); }, 4200);
      await scene('Et une question peut être préparée depuis votre fiche.', async () => { await p.locator('.modal .close').click(); await p.locator('.v12-profile-sidebar a[href="#v12Contact"]').click(); }, 3800);
      await scene('Parcours fictif : aucun paiement ni email réel.', async () => { await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); }, 3000);
    });
    fs.writeFileSync(path.join(raw, 'recordings.json'), JSON.stringify({ base: BASE, fictitiousData: true, externalWrites: 0, recordings: [pro, familles] }, null, 2));
    console.log(JSON.stringify({ completed: [pro, familles].map(({ name, duration, bytes }) => ({ name, duration, bytes })), externalWrites: 0 }));
  } finally { if (browser) await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
