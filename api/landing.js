// Public marketing page. No account, contact, payment or database operation.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const templatePath = path.join(__dirname, '..', 'marketing', 'landing.html');
function originFor(req, env) {
  if (env.NAITEA_PUBLIC_ORIGIN && env.VERCEL_ENV === 'production') {
    const url = new URL(env.NAITEA_PUBLIC_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid public origin');
    return url.origin;
  }
  const host = String(req.headers?.host || '');
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) throw Error('Invalid host');
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  return new URL((local ? 'http://' : 'https://') + host).origin;
}
function createHandler({ env = process.env, readTemplate = () => fs.readFileSync(templatePath, 'utf8') } = {}) {
  return function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).end(); }
    let origin;
    try { origin = originFor(req, env); } catch { return res.status(400).end('Adresse de page invalide.'); }
    const isProduction = env.VERCEL_ENV === 'production', canonical = origin + '/decouvrir';
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    if (!isProduction) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const format = req.query?.format;
    if (format === 'robots' || format === 'sitemap') {
      const content = format === 'robots'
        ? (isProduction ? 'User-agent: *\nDisallow: /\nAllow: /decouvrir$\nAllow: /decouvrir/$\nAllow: /assets/\nAllow: /_vercel/image\nSitemap: ' + origin + '/sitemap.xml\n' : 'User-agent: *\nDisallow: /\n')
        : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + canonical + '</loc></url></urlset>\n';
      res.setHeader('Content-Type', format === 'robots' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8');
      return res.status(200).end(req.method === 'HEAD' ? undefined : content);
    }
    const schema = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'Organization', '@id': canonical + '#organisation', name: 'Naïtea', url: canonical, logo: origin + '/assets/berceau/transparent/naitea-logo.png', founder: { '@type': 'Person', name: 'Laureen' } },
      { '@type': 'WebPage', '@id': canonical + '#page', url: canonical, name: 'Logiciel tout en 1 périnatalité et parentalité | Naïtea', inLanguage: 'fr-FR', description: 'Ateliers, rendez-vous, familles, facturation et communication dans un même espace professionnel.', publisher: { '@id': canonical + '#organisation' }, mainEntity: { '@id': canonical + '#application' } },
      { '@type': 'WebApplication', '@id': canonical + '#application', name: 'Naïtea', url: canonical, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'fr-FR', description: 'Logiciel pour les professionnelles et professionnels de la périnatalité, de la parentalité et de la petite enfance.', featureList: ['Gestion des ateliers collectifs', 'Rendez-vous individuels', 'Fiche professionnelle', 'Suivi des familles', 'Studio de communication', 'Bons cadeaux personnalisables'], publisher: { '@id': canonical + '#organisation' } },
      ...[
        ['pro', 'Démonstration de l’espace professionnel Naïtea', 'Calendrier, ateliers, disponibilités, familles, studio et bons cadeaux. Enregistrement avec des données fictives.'],
        ['familles', 'Démonstration de la fiche visible par les familles', 'Présentation de la professionnelle, ateliers et rendez-vous individuels. Réservations et paiements de démonstration.']
      ].map(([id, name, description]) => ({ '@type': 'VideoObject', '@id': canonical + '#video-' + id, name, description, inLanguage: 'fr-FR', contentUrl: origin + '/assets/landing/demo-' + id + '.mp4', thumbnailUrl: origin + '/assets/landing/demo-' + id + '-poster.jpg', uploadDate: '2026-11-21', duration: 'PT35S', publisher: { '@id': canonical + '#organisation' } }))
    ] };
    const values = { ORIGIN: origin, CANONICAL: canonical, ROBOTS: isProduction ? 'index, follow, max-image-preview:large' : 'noindex, nofollow', YEAR: new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date()), SCHEMA: JSON.stringify(schema).replace(/</g, '\\u003c') };
    let template = readTemplate();
    // Layout examples requested for review only. Never publish them as customer evidence.
    if (isProduction) template = template.replace(/<!-- preview-testimonials:start -->[\s\S]*?<!-- preview-testimonials:end -->/g, '');
    const html = template.replace(/\{\{(ORIGIN|CANONICAL|ROBOTS|YEAR|SCHEMA)\}\}/g, (_, key) => values[key]);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('ETag', '"' + crypto.createHash('sha256').update(html).digest('hex') + '"');
    res.status(200); return res.end(req.method === 'HEAD' ? undefined : html);
  };
}
module.exports = createHandler(); module.exports.createHandler = createHandler; module.exports.originFor = originFor;
