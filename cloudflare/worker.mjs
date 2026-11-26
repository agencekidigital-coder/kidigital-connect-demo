import publicConfig from '../server/public-config.cjs';
import { createWorkshopsHandler } from '../server/workshops.mjs';
import { createPublicWorkshopHandler } from '../server/public-workshop.mjs';
import { createPublicCatalogHandler } from '../server/public-catalog.mjs';
import {createBookingHandler} from '../server/bookings.mjs';
import {bookingConfig} from '../server/booking-config.mjs';
import { createAccountHandler } from '../server/account-profile.mjs';
import fontHandler from '../api/font.js';
import videoSizes from '../dist/video-sizes.json' with { type: 'json' };

export const capabilities = Object.freeze({
  mode: 'preview', businessData: 'fictional-browser-only',
  realBookings: false, payments: false, invoices: false, admin: false,
  sms: false, remoteAI: false, google: false, meta: false,
});
const PLACEHOLDER = 'https://naitea-render.invalid';
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
const unavailable = () => json({ error: 'Bientôt disponible. Cette fonction est désactivée dans cet aperçu.', code: 'FEATURE_UNAVAILABLE' }, 423);
const accountHandler = createAccountHandler();
const workshopsHandler = createWorkshopsHandler();
const publicWorkshopHandler = createPublicWorkshopHandler();
const publicCatalogHandler = createPublicCatalogHandler();
const bookingHandler = createBookingHandler();

function guard(response, request, { embed = false, auth = false, account = false } = {}) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  // Compatible with the existing inline editor. This is not a complete XSS policy.
  headers.set('Content-Security-Policy', "base-uri 'self'; object-src 'none'" + (embed ? '' : "; frame-ancestors " + (auth ? "'none'" : "'self'")));
  if (account) headers.set('Content-Security-Policy', "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self' https://*.supabase.co");
  if (/^\/ateliers?\//.test(new URL(request.url).pathname)) {
    const u=new URL(request.url);
    const publicEmbed=u.searchParams.get('embed')==='1'&&/^\/ateliers?\/[a-zA-Z0-9-]{1,180}$/.test(u.pathname);
    headers.set('Content-Security-Policy',"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors "+(publicEmbed?'https:':"'none'")+"; form-action 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:");
    headers.set('Referrer-Policy','no-referrer');
  }
  if(new URL(request.url).pathname==='/reservation/confirmer'||/^\/atelier\/[a-z0-9-]{1,180}\/reserver$/.test(new URL(request.url).pathname)){
    headers.set('Content-Security-Policy',"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com");
    // HTML form POSTs need a non-null Origin for the strict same-origin check.
    // Only the origin, never the page path or confirmation fragment, is disclosed.
    headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin');
  }
  if (auth) headers.set('X-Frame-Options', 'DENY');
  if (headers.get('Content-Type')?.includes('text/html')) headers.set('Cache-Control', 'no-store');
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers });
}

function validPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (/[\\\u0000-\u001f\u007f%]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..') || decoded.includes('//')) return null;
  return decoded;
}

async function asset(env, request, pathname) {
  if (!env.ASSETS?.fetch) return json({ error: 'Ressources indisponibles.' }, 503);
  const url = new URL(request.url); url.pathname = pathname; url.search = '';
  const response = await env.ASSETS.fetch(new Request(url, { method: request.method, headers: request.headers }));
  if (response.status !== 200 || !response.headers.get('Content-Type')?.startsWith('video/')) return response;
  const size = Number(response.headers.get('Content-Length') || videoSizes[pathname]);
  if (!Number.isSafeInteger(size) || size <= 0) return response;
  const headers = new Headers(response.headers); headers.set('Accept-Ranges', 'bytes'); headers.set('Content-Length', String(size));
  const range = request.headers.get('Range'), ifRange = request.headers.get('If-Range');
  const modified = Date.parse(response.headers.get('Last-Modified') || ''), since = Date.parse(ifRange || '');
  const rangeAllowed = !ifRange || ifRange === response.headers.get('ETag') && !ifRange.startsWith('W/') || Number.isFinite(modified) && Number.isFinite(since) && since >= modified;
  if (!range || !rangeAllowed) return new Response(response.body, { status: response.status, headers });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = 0, end = size - 1;
  if (match && (match[1] || match[2])) {
    if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
    else start = Math.max(0, size - Number(match[2]));
  }
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
    if (response.body) await response.body.cancel();
    headers.delete('Content-Length'); headers.set('Content-Range', 'bytes */' + size);
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  headers.set('Content-Length', String(end - start + 1));
  if (!response.body || request.method === 'HEAD') return new Response(null, { status: 206, headers });
  // Slice a stream rather than buffering complete videos in a Worker isolate.
  const reader = response.body.getReader(); let position = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) { controller.close(); return; }
          const offset = position; position += value.byteLength;
          if (position <= start) continue;
          const part = value.subarray(Math.max(0, start - offset), Math.min(value.byteLength, end + 1 - offset));
          if (part.byteLength) controller.enqueue(part);
          if (position > end) { await reader.cancel(); controller.close(); }
          return;
        }
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  return new Response(stream, { status: 206, headers });
}

async function landing(env, request) {
  const source = await asset(env, new Request(request.url), '/index.html');
  if (!source.ok) return json({ error: 'Page indisponible.' }, 503);
  const origin = new URL(request.url).origin;
  const html = (await source.text()).replaceAll(PLACEHOLDER + '/decouvrir', origin + '/').replaceAll(PLACEHOLDER, origin);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function font(request, env, ctx) {
  const url = new URL(request.url);
  const family = url.searchParams.get('family'), weight = Number(url.searchParams.get('weight') || 400);
  const localFonts = new Map([
    ['DM Sans', { weights: [400, 500, 600, 700], file: '/assets/dm-sans-' + weight + '.ttf', license: '/assets/dmsans-LICENSE.txt' }],
    ['Lora', { weights: [700], file: '/assets/lora-700.ttf', license: '/assets/lora-LICENSE.txt' }],
    ['Source Sans 3', { weights: [200, 300, 400, 500, 600, 700, 800, 900], file: '/assets/berceau/typographie/SourceSans3-Variable.ttf', license: '/assets/berceau/typographie/SourceSans3-OFL.txt' }],
  ]);
  const local = localFonts.get(family);
  if (local?.weights.includes(weight)) {
    const response = await asset(env, request, url.searchParams.get('license') === '1' ? local.license : local.file);
    if (!response.ok) return response;
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Link', '</api/font?family=' + encodeURIComponent(family) + '&weight=' + weight + '&license=1>; rel="license"');
    return new Response(response.body, { status: response.status, headers });
  }
  // The existing handler validates every family, weight, license path and upstream host.
  const clean = new URL('/api/font', url.origin);
  for (const key of ['family', 'weight', 'license']) if (url.searchParams.has(key)) clean.searchParams.set(key, url.searchParams.get(key));
  const key = new Request(clean);
  const cache = globalThis.caches?.default;
  const cached = cache ? await cache.match(key) : null;
  if (cached) return cached;
  let status = 200, content = null;
  const headers = new Headers();
  await fontHandler({ method: 'GET', query: Object.fromEntries(clean.searchParams) }, {
    setHeader(name, value) { headers.set(name, String(value)); },
    status(value) { status = value; return this; },
    end(value) { content = value; return this; },
    json(value) { headers.set('Content-Type', 'application/json; charset=utf-8'); content = JSON.stringify(value); return this; },
  });
  const response = new Response(content, { status, headers });
  if (response.ok && cache && ctx?.waitUntil) ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

async function route(request, env, ctx, pathname) {
  const url = new URL(request.url);
  if (!pathname) return json({ error: 'Adresse invalide.' }, 400);
  if (pathname === '/api/account') return accountHandler(request, env);
  if (pathname === '/api/workshops') return workshopsHandler(request, env);
  if(pathname==='/reservation/confirmer')return bookingHandler(request,env);
  const bookingMatch=/^\/atelier\/([a-z0-9-]{1,180})\/reserver$/.exec(pathname);
  if(bookingMatch)return bookingHandler(request,env,bookingMatch[1]);
  const publicMatch=/^\/atelier\/([a-zA-Z0-9-]{1,180})(?:\/(photo|portrait))?$/.exec(pathname);
  if(publicMatch)return publicWorkshopHandler(request,env,publicMatch[1],publicMatch[2]==='photo',publicMatch[2]==='portrait');
  const catalogMatch=/^\/ateliers\/([a-z0-9-]{1,180})$/.exec(pathname);
  if(catalogMatch)return publicCatalogHandler(request,env,catalogMatch[1]);
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Méthode non autorisée.' }, 405, { Allow: 'GET, HEAD' });
  if (pathname === '/api/deployment') return json({ ...capabilities, realBookings: !!bookingConfig(env) && new URL(request.url).origin===bookingConfig(env).origin, workshopPublication: env.NAITEA_PUBLICATION_ENABLED === 'true' && env.NAITEA_WORKSHOPS_ENABLED === 'true' && env.NAITEA_AUTH_ENABLED === 'true' && !!publicConfig.readPublicConfig(env), workshopPersistence: env.NAITEA_AUTH_ENABLED === 'true' && env.NAITEA_WORKSHOPS_ENABLED === 'true' && !!publicConfig.readPublicConfig(env), accountProfile: env.NAITEA_AUTH_ENABLED === 'true' && env.NAITEA_PROFILE_ENABLED === 'true' && !!publicConfig.readPublicConfig(env) });
  if (pathname === '/api/public-config') {
    const config = env.NAITEA_AUTH_ENABLED === 'true' ? publicConfig.readPublicConfig(env) : null;
    return config ? json(config) : json({ error: 'La connexion sera ouverte après validation de sa configuration.' }, 503);
  }
  if (pathname === '/api/font') return font(request, env, ctx);
  // Deny at the server even if a provider key is added accidentally.
  if (pathname === '/api' || pathname.startsWith('/api/')) return unavailable();
  if (pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (pathname === '/sitemap.xml') return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>\n', { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (pathname === '/marketing/landing.html') return new Response(null, { status: 307, headers: { Location: '/' } });
  if (pathname === '/_vercel/image') {
    const source = url.searchParams.get('url') || '';
    if (!/^\/assets\/(berceau\/transparent|landing(?:\/brand-additions)?|photos)\/[\w.-]+\.(png|jpg|jpeg|webp)$/.test(source) || source.split('/').some(p => p === '..')) return json({ error: 'Image non autorisée.' }, 400);
    const response = await asset(env, request, source);
    if (response.ok && !response.headers.get('Content-Type')?.startsWith('image/')) return json({ error: 'Image non autorisée.' }, 400);
    return response;
  }
  const shared = ['vue', 'atelier', 'embed', 'boutique-cadeaux', 'gift-preview'].some(k => url.searchParams.has(k));
  if ((pathname === '/' || pathname === '/decouvrir' || pathname === '/decouvrir/') && !(pathname === '/' && shared)) return landing(env, request);
  if (['/pro', '/pro/', '/index.html', '/familles', '/familles/', '/pro.html'].includes(pathname) || pathname === '/' && shared) return asset(env, request, '/pro.html');
  if (pathname === '/connexion.html') return asset(env, request, '/connexion.html');
  if (['/bienvenue', '/bienvenue.html'].includes(pathname)) return asset(env, request, '/bienvenue.html');
  if (['/mes-ateliers', '/mes-ateliers.html'].includes(pathname)) return asset(env, request, '/mes-ateliers.html');
  if (['/compte', '/compte.html'].includes(pathname)) return asset(env, request, '/compte.html');
  if (pathname.startsWith('/assets/')) return asset(env, request, pathname);
  return new Response('Page introuvable.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env, ctx) {
    let response;
    const url = new URL(request.url);
    const pathname = validPath(url.pathname);
    try { response = await route(request, env, ctx, pathname); }
    catch { response = json({ error: 'Le service est temporairement indisponible.' }, 503); }
    return guard(response, request, {
      auth: ['/connexion.html', '/bienvenue', '/bienvenue.html', '/compte', '/compte.html', '/mes-ateliers', '/mes-ateliers.html'].includes(pathname),
      account: ['/compte', '/compte.html', '/mes-ateliers', '/mes-ateliers.html'].includes(pathname),
      embed: ['/', '/pro', '/pro/', '/familles', '/familles/', '/index.html', '/pro.html'].includes(pathname) && (url.searchParams.has('embed') || url.searchParams.get('boutique-cadeaux') === '1'),
    });
  },
};
