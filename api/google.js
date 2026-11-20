/* Google Business Profile + Calendar. Dormant without an approved OAuth client.
   Tokens are encrypted, HttpOnly, account-bound cookies, never browser storage.
   No Supabase writes. No replies or invitations without explicit confirmation. */
const crypto = require('node:crypto');
const G = require('../server/google-connection.cjs');
const rates = new Map();
function createHandler({ env = process.env, fetcher = globalThis.fetch, now = () => Date.now() } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const config = G.configuration(env), action = req.query?.action || 'status', jar = G.cookies(req.headers?.cookie);
    const read = (name, purpose) => G.unseal(jar[name], env.GOOGLE_CONNECTION_SECRET || '', purpose, now());
    const send = (code, data) => res.status(code).json(data);
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { error: 'Méthode non autorisée.' }); }
    if (action === 'status' && req.method === 'GET') return send(200, { configured: config.configured, connected: config.configured && !!read(G.TOKEN_COOKIE, 'tokens') });
    if (!config.configured) return send(503, { error: 'La connexion Google de Naïtea n’est pas encore activée. Aucun compte ni avis n’a été modifié.' });
    if (req.headers?.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Origine non autorisée.' }); } catch { return send(403, { error: 'Origine non autorisée.' }); }
    }
    const writeCookies = values => res.setHeader('Set-Cookie', values);
    const redirect = suffix => { res.statusCode = 303; res.setHeader('Location', new URL('/?google=' + suffix, config.redirect).href); return res.end(); };
    async function google(url, token, options = {}) {
      const response = await fetcher(url, { ...options, headers: { Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) { const error = Error(response.status === 403 ? 'Google n’a pas autorisé cet accès. Vérifie les droits du compte et l’activation de Google Business Profile pour Naïtea.' : response.status === 401 ? 'La connexion Google a expiré. Reconnecte le compte.' : 'Google est momentanément indisponible. Réessaie plus tard.'); error.status = response.status === 401 ? 401 : 502; throw error; }
      return response.status === 204 ? {} : response.json();
    }
    try {
      if (action === 'callback') {
        if (req.method !== 'GET') return send(405, { error: 'Méthode non autorisée.' });
        const flow = read(G.FLOW_COOKIE, 'flow'), state = G.unseal(req.query.state, env.GOOGLE_CONNECTION_SECRET, 'state', now());
        writeCookies([G.cookie(G.FLOW_COOKIE, '', 0)]);
        if (!flow || !state || flow.nonce !== state.nonce || flow.subject !== state.subject || req.query.error || !/^[A-Za-z0-9_./~-]{10,3000}$/.test(req.query.code || '')) return redirect('refuse');
        const tokenResponse = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri: config.redirect, grant_type: 'authorization_code', code_verifier: flow.verifier }).toString(), signal: AbortSignal.timeout(15000) });
        if (!tokenResponse.ok) return redirect('refuse');
        const tokens = await tokenResponse.json();
        if (!tokens.access_token || !tokens.refresh_token) return redirect('refuse');
        const value = G.seal({ subject: flow.subject, access: tokens.access_token, refresh: tokens.refresh_token, accessExpires: now() + Number(tokens.expires_in || 3600) * 1000, expires: now() + 30 * 86400000 }, env.GOOGLE_CONNECTION_SECRET, 'tokens');
        writeCookies([G.cookie(G.FLOW_COOKIE, '', 0), G.cookie(G.TOKEN_COOKIE, value)]); return redirect('connecte');
      }
      // Every non-callback operation is bound to the existing authenticated app user.
      const authorization = String(req.headers?.authorization || '');
      if (!/^Bearer [A-Za-z0-9_.-]{20,6000}$/.test(authorization)) return send(401, { error: 'Connecte-toi à ton compte professionnel pour relier Google.' });
      const auth = await fetcher(config.supabase + '/auth/v1/user', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
      if (!auth.ok) return send(401, { error: 'Ta session a expiré. Reconnecte-toi.' });
      const user = await auth.json(); if (!user.id) return send(401, { error: 'Session invalide.' });
      const rateKey = user.id + ':' + action, record = rates.get(rateKey), current = now();
      for (const [key, entry] of rates) if (entry.until < current) rates.delete(key);
      if (record?.until > current && record.count >= 15) return send(429, { error: 'Patiente une minute avant de recommencer.' });
      rates.set(rateKey, record?.until > current ? { ...record, count: record.count + 1 } : { count: 1, until: current + 60000 });
      if (action === 'start') {
        if (req.method !== 'GET') return send(405, { error: 'Méthode non autorisée.' });
        // Prevent forwarding credentials from a different preview/host.
        if (req.headers.host !== new URL(config.redirect).host) return send(409, { error: 'Cette prévisualisation n’est pas celle autorisée pour Google.' });
        const nonce = crypto.randomBytes(24).toString('base64url'), verifier = crypto.randomBytes(48).toString('base64url'), expires = now() + 10 * 60000;
        const state = G.seal({ nonce, subject: user.id, expires }, env.GOOGLE_CONNECTION_SECRET, 'state');
        writeCookies([G.cookie(G.FLOW_COOKIE, G.seal({ nonce, subject: user.id, verifier, expires }, env.GOOGLE_CONNECTION_SECRET, 'flow'), 600)]);
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        for (const [key, value] of Object.entries({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: config.redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/calendar.events', access_type: 'offline', prompt: 'consent', state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })) url.searchParams.set(key, value);
        return send(200, { url: url.href });
      }
      if (action === 'disconnect' && req.method === 'POST') { writeCookies([G.cookie(G.TOKEN_COOKIE, '', 0), G.cookie(G.FLOW_COOKIE, '', 0)]); return send(200, { disconnected: true }); }
      let tokens = read(G.TOKEN_COOKIE, 'tokens');
      if (!tokens || tokens.subject !== user.id) return send(401, { error: 'Relie le compte Google correspondant à ta session Naïtea.' });
      if (tokens.accessExpires <= now() + 60000) {
        const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, refresh_token: tokens.refresh, grant_type: 'refresh_token' }).toString(), signal: AbortSignal.timeout(15000) });
        if (!response.ok) { writeCookies([G.cookie(G.TOKEN_COOKIE, '', 0)]); return send(401, { error: 'Reconnecte ton compte Google pour continuer.' }); }
        const value = await response.json(); if (!value.access_token) return send(502, { error: 'Google n’a pas renouvelé la connexion.' });
        tokens = { ...tokens, access: value.access_token, accessExpires: now() + Number(value.expires_in || 3600) * 1000 };
        writeCookies([G.cookie(G.TOKEN_COOKIE, G.seal(tokens, env.GOOGLE_CONNECTION_SECRET, 'tokens'))]);
      }
      if (action === 'locations' && req.method === 'GET') {
        const accounts = []; let pageToken = '';
        for (let page = 0; page < 20; page++) { const result = await google('https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), tokens.access); accounts.push(...(result.accounts || [])); pageToken = result.nextPageToken; if (!pageToken) break; }
        const locations = [];
        for (const account of accounts.filter(a => /^accounts\/[A-Za-z0-9_-]+$/.test(a.name))) {
          let cursor = '';
          for (let page = 0; page < 20; page++) { const result = await google(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100` + (cursor ? '&pageToken=' + encodeURIComponent(cursor) : ''), tokens.access); for (const loc of result.locations || []) { const id = String(loc.name || '').replace(/^locations\//, ''); if (!/^[A-Za-z0-9_-]+$/.test(id)) continue; locations.push({ name: account.name + '/locations/' + id, title: String(loc.title || '').slice(0, 200), address: [loc.storefrontAddress?.addressLines?.join(', '), loc.storefrontAddress?.postalCode, loc.storefrontAddress?.locality].filter(Boolean).join(', ') }); } cursor = result.nextPageToken; if (!cursor) break; }
        }
        return send(200, { locations });
      }
      if (!['reviews', 'reply', 'calendar'].includes(action) || req.method !== 'POST') return send(405, { error: 'Action non autorisée.' });
      let input; try { input = G.body(req); } catch { return send(400, { error: 'Requête invalide.' }); }
      if (action === 'reviews' || action === 'reply') {
        if (!G.validLocation(input.location)) return send(400, { error: 'Établissement invalide.' });
        if (action === 'reply') {
          if (!/^[A-Za-z0-9_-]{1,300}$/.test(input.review || '') || typeof input.reply !== 'string' || !input.reply.trim() || input.reply.length > 4000 || input.confirmed !== true) return send(400, { error: 'Relis la réponse et confirme sa publication.' });
          await google(`https://mybusiness.googleapis.com/v4/${input.location}/reviews/${input.review}/reply`, tokens.access, { method: 'PUT', body: JSON.stringify({ comment: input.reply.trim() }) });
          return send(200, { published: true });
        }
        const reviews = [], ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }; let cursor = '', averageRating = 0, totalReviewCount = 0;
        // Page through the whole review feed, including older unanswered reviews.
        for (let page = 0; page < 100; page++) {
          const result = await google(`https://mybusiness.googleapis.com/v4/${input.location}/reviews?pageSize=50&orderBy=updateTime%20desc` + (cursor ? '&pageToken=' + encodeURIComponent(cursor) : ''), tokens.access);
          averageRating = result.averageRating || 0; totalReviewCount = result.totalReviewCount || 0;
          for (const r of result.reviews || []) if (!r.reviewReply?.comment) reviews.push({ id: r.reviewId, author: String(r.reviewer?.displayName || '').slice(0, 200), comment: String(r.comment || '').slice(0, 10000), rating: ratings[r.starRating] || 0, updatedAt: r.updateTime });
          cursor = result.nextPageToken; if (!cursor) break;
        }
        const locationId = input.location.split('/').at(-1);
        const establishment = await google(`https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=title,metadata`, tokens.access);
        return send(200, { reviews, averageRating, totalReviewCount, title: establishment.title || '', mapsURL: establishment.metadata?.mapsUri || '', hasMore: !!cursor });
      }
      if (input.confirmed !== true || !/^[\w-]{1,100}$/.test(input.eventId || '')) return send(400, { error: 'Confirme la mise à jour de cet atelier.' });
      let payload; try { payload = G.cleanCalendar(input.payload); } catch (e) { return send(400, { error: e.message }); }
      if (payload.attendees?.length && input.sendInvites !== true) return send(400, { error: 'Confirme l’envoi des invitations aux familles.' });
      // Deterministic ID: retries update the same event; a user cannot choose an arbitrary event to overwrite.
      const id = 'naitea' + crypto.createHash('sha256').update(user.id + ':' + input.eventId).digest('hex').slice(0, 40), base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events', updates = payload.attendees?.length ? 'all' : 'none';
      let result;
      const existing = await fetcher(base + '/' + id, { headers: { Authorization: 'Bearer ' + tokens.access }, signal: AbortSignal.timeout(15000) });
      if (existing.ok) {
        const currentEvent = await existing.json();
        // An existing invited event must never receive a private roster in its description.
        if (currentEvent.attendees?.length && payload.description.includes('Inscrits (usage professionnel privé)')) return send(400, { error: 'Cet événement comporte des invités. Désactive la liste privée pour éviter de leur transmettre les coordonnées des autres familles.' });
        if (!payload.attendees && currentEvent.attendees?.length) payload.attendees = currentEvent.attendees.map(a => ({ email: a.email }));
        result = await google(base + '/' + id + '?sendUpdates=' + updates, tokens.access, { method: 'PATCH', body: JSON.stringify(payload) });
      } else if (existing.status === 404) {
        if (payload.attendees?.length && payload.description.includes('Inscrits (usage professionnel privé)')) return send(400, { error: 'Choisis une liste privée ou des invitations. Les coordonnées des autres familles ne doivent pas être transmises aux invités.' });
        result = await google(base + '?sendUpdates=' + updates, tokens.access, { method: 'POST', body: JSON.stringify({ ...payload, id }) });
      } else return send(502, { error: 'Impossible de vérifier cet événement dans Google Agenda.' });
      return send(200, { id: result.id, htmlLink: result.htmlLink });
    } catch (error) { return send(error.status || 502, { error: error.message?.startsWith('Google') || error.message?.startsWith('La connexion') ? error.message : 'La connexion Google est indisponible. Aucune modification supplémentaire n’a été effectuée.' }); }
  };
}
module.exports = createHandler(); module.exports.createHandler = createHandler;
