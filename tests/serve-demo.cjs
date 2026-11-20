// Local preview with the same serverless route boundaries as Vercel. No credentials required.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), port = Number(process.env.PORT || 4182);
const routes = Object.fromEntries(['font', 'google-reviews', 'review-reply', 'workshop-description', 'google', 'landing'].map(name => ['/api/' + name, require('../api/' + name + '.js')]));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:' + port); req.query = Object.fromEntries(u.searchParams);
  res.status = n => (res.statusCode = n, res); res.json = data => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(data)));
  if (u.pathname === '/api/public-config') return res.status(503).json({ error: 'Local demonstration' });
  if (u.pathname === '/decouvrir' || u.pathname === '/decouvrir/') return routes['/api/landing'](req, res);
  if (u.pathname === '/robots.txt' || u.pathname === '/sitemap.xml') { req.query.format = u.pathname === '/robots.txt' ? 'robots' : 'sitemap'; return routes['/api/landing'](req, res); }
  if (u.pathname === '/_vercel/image') {
    const source = u.searchParams.get('url') || '';
    if (!/^\/assets\/(berceau\/transparent|landing|photos)\/[\w.-]+\.(png|jpg|webp)$/.test(source)) return res.status(400).end();
    const file = path.join(root, source); try { res.setHeader('Content-Type', types[path.extname(file)]); return res.end(fs.readFileSync(file)); } catch { return res.status(404).end(); }
  }
  if (routes[u.pathname]) {
    let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 100000) return res.status(413).end(); }
    if (text) { try { req.body = JSON.parse(text); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }
    try { return await routes[u.pathname](req, res); } catch { return res.status(500).json({ error: 'Server error' }); }
  }
  const file = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!file.startsWith(root + '/')) return res.status(403).end();
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); } catch { res.status(404).end(); }
}).listen(port, '0.0.0.0', () => console.log('Naitea demo http://localhost:' + port));
