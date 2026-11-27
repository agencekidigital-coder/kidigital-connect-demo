/* Build an explicit public directory. Never upload the repository as assets. */
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('../api/landing.js');
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'dist', 'public');
const PLACEHOLDER = 'https://naitea-render.invalid';
const EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.ttf', '.otf', '.woff', '.woff2', '.mp4', '.vtt', '.txt']);

function copyAssets(source, destination, files) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw Error('Les liens symboliques ne sont pas des ressources publiques autorisées.');
    // Keep provenance notes and narration working files out of the hosted site.
    if (path.extname(entry.name).toLowerCase() === '.md' || from === path.join(ROOT, 'assets', 'landing', 'narration')) continue;
    if (entry.isDirectory()) { fs.mkdirSync(to, { recursive: true }); copyAssets(from, to, files); continue; }
    if (!entry.isFile() || !(EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || entry.name === 'LICENSE')) throw Error('Extension de ressource publique non autorisée : ' + path.relative(ROOT, from));
    if (fs.statSync(from).size > 25 * 1024 * 1024) throw Error('Une ressource dépasse la limite de 25 MiB.');
    fs.copyFileSync(from, to); files.push(path.relative(OUTPUT, to));
  }
}

function renderLanding() {
  const res = { setHeader() {}, status(n) { if (n !== 200) throw Error('Échec du rendu de la landing.'); return this; }, end(html) { this.html = html; } };
  // Remove every fictional testimonial, including from the public preview.
  createHandler({ env: { VERCEL_ENV: 'production', NAITEA_PUBLIC_ORIGIN: PLACEHOLDER } })({ method: 'GET', headers: {}, query: {} }, res);
  const html = res.html.replace('name="robots" content="index, follow, max-image-preview:large"', 'name="robots" content="noindex, nofollow"')
    .replace('</head>', '<script src="/assets/cloudflare-links.js" defer></script></head>');
  if (html.includes('{{') || html.includes('data-preview-testimonials')) throw Error('La landing contient encore des données de rendu non publiables.');
  return html;
}

function build() {
  const files = [];
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUTPUT, 'assets'), { recursive: true });
  copyAssets(path.join(ROOT, 'assets'), path.join(OUTPUT, 'assets'), files);
  // Pinned SheetJS is served locally, used only in a disposable import Worker.
  const vendor=path.join(OUTPUT,'assets','vendor');fs.mkdirSync(vendor,{recursive:true});
  for(const [src,dest] of [['dist/xlsx.full.min.js','xlsx.full.min.js'],['LICENSE','xlsx-LICENSE.txt']]){
    fs.copyFileSync(path.join(ROOT,'node_modules','xlsx',src),path.join(vendor,dest));files.push('assets/vendor/'+dest);
  }
  const extra = '<link rel="stylesheet" href="/assets/beta-preview.css"><script src="/assets/beta-preview.js" defer></script><script src="/assets/pro-workshops.js"></script><script src="/assets/family-import.js"></script><script src="/assets/pro-families.js"></script><script src="/assets/pro-services.js"></script>';
  for (const file of ['connexion.html', 'bienvenue.html', 'compte.html', 'mes-ateliers.html']) {
    let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (file === 'bienvenue.html') html = html.replace('<p class="tester-demo">', '<p class="tester-account"><a href="/compte">Gérer mon compte</a></p><p class="tester-demo">');
    fs.writeFileSync(path.join(OUTPUT, file), html); files.push(file);
  }
  let pro = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('</head>', extra + '</head>');
  // Reuse the original Codex base stylesheet without its demo application scripts.
  const originalHead=pro.slice(0,pro.indexOf('</head>'));
  const baseStyles=[...originalHead.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match=>match[1]).join('\n');
  if(!baseStyles.includes('.card'))throw Error('Style original indisponible');
  fs.writeFileSync(path.join(OUTPUT,'assets','public-workshop-base.css'),baseStyles);
  files.push('assets/public-workshop-base.css');
  const anchor = 'naiteaLoadAuth();';
  if(pro.split(anchor).length!==2)throw Error('Point de raccordement ateliers introuvable');
  pro=pro.replace(anchor, `if (typeof NaiteaProWorkshops !== 'undefined' && /^\\/pro\\/?$/.test(location.pathname)) {
  const privateWorkshopRender = render;
  const privateWorkshops = NaiteaProWorkshops.create({
    tools: NaiteaPlatformTools, getClient: () => berceauAuthClient,
    isPage: () => mode === 'pro' && !v8Shared && !platform.giftShopMode() && ['ateliers','dashboard'].includes(page),
    page: () => page, calendarState: () => ({date:v8CalDate,view:v8CalView}),
    render: () => render(), formHtml: e => platform.eventForm(platformEventFormBase(e),e),
    showModal: (...args) => showModal(...args), closeModal,
    escape: esc, goWorkshops: () => navigate('ateliers'),
  });
  const privateFamilies = NaiteaProFamilies.create({getClient: () => berceauAuthClient, isPage: () => mode === 'pro' && !v8Shared && !platform.giftShopMode() && page === 'familles',openBooking: (f,id) => privateWorkshops.openFamilyBooking(f,id)});
  const privateServices = NaiteaProServices.create({getClient: () => berceauAuthClient, isPage: () => mode === 'pro' && !v8Shared && !platform.giftShopMode() && ['offers','rendezvous'].includes(page),page: () => page,go: to => navigate(to),formHtml: offer => v6OfferForm(offer)});
  render = function () { privateWorkshopRender(); privateWorkshops.decorate(); privateFamilies.decorate(); privateServices.decorate(); };
  privateWorkshops.start(); privateFamilies.start(); privateServices.start();
}
naiteaLoadAuth();`);
  fs.writeFileSync(path.join(OUTPUT, 'pro.html'), pro);
  fs.writeFileSync(path.join(OUTPUT, 'index.html'), renderLanding());
  files.push('pro.html', 'index.html');
  for (const file of ['assets/beta-preview.js', 'assets/beta-preview.css']) if (!files.includes(file)) throw Error('Le verrouillage de l’aperçu est absent.');
  const manifest = { mode: 'preview', businessData: 'fictional-browser-only', files: files.sort(), totalBytes: files.reduce((sum, f) => sum + fs.statSync(path.join(OUTPUT, f)).size, 0) };
  fs.writeFileSync(path.join(ROOT, 'dist', 'public-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  // The asset binding may omit Content-Length; the Worker needs exact lengths for seeking.
  const videos = Object.fromEntries(files.filter(f => f.endsWith('.mp4')).map(f => ['/' + f, fs.statSync(path.join(OUTPUT, f)).size]));
  fs.writeFileSync(path.join(ROOT, 'dist', 'video-sizes.json'), JSON.stringify(videos) + '\n');
  return manifest;
}
if (require.main === module) {
  const result = build();
  process.stdout.write(JSON.stringify({ mode: result.mode, publicFiles: result.files.length, totalBytes: result.totalBytes }) + '\n');
}
module.exports = { build, renderLanding, PLACEHOLDER, OUTPUT };
