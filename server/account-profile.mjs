import publicConfig from './public-config.cjs';

const { readPublicConfig } = publicConfig;
const MAX_BODY_BYTES = 2048;
const MAX_AUTH_BYTES = 64 * 1024, MAX_PROFILE_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u;
const ALLOWED_FIELDS = new Set(['full_name', 'business_name']);
const MESSAGES = {
  PROFILE_DISABLED: 'Cette fonctionnalité sera bientôt disponible.',
  PROFILE_UNAVAILABLE: 'Le service de profil est momentanément indisponible.',
  AUTH_REQUIRED: 'Connectez-vous pour accéder à votre profil.',
  PROFILE_FORBIDDEN: 'L’accès à ce profil n’est pas autorisé.',
  INVALID_REQUEST: 'Requête de profil invalide.',
  INVALID_PROFILE: 'Vérifiez le nom et le nom professionnel.',
  ORIGIN_FORBIDDEN: 'Origine non autorisée.',
  JSON_REQUIRED: 'Le format JSON est requis.',
  PAYLOAD_TOO_LARGE: 'La requête de profil est trop volumineuse.',
  PROFILE_NOT_FOUND: 'Aucun profil enregistré pour ce compte.',
  PROFILE_DATA_INVALID: 'Le profil nécessite une vérification avant modification.',
  METHOD_NOT_ALLOWED: 'Méthode non autorisée.',
};

class InputError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

async function readPatch(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null && !/^\d+$/.test(declared)) throw new InputError(400, 'INVALID_REQUEST');
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    request.body?.cancel().catch(() => {});
    throw new InputError(413, 'PAYLOAD_TOO_LARGE');
  }
  if (!request.body) throw new InputError(400, 'INVALID_PROFILE');
  const reader = request.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new InputError(400, 'INVALID_PROFILE');
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        throw new InputError(413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let input;
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new InputError(400, 'INVALID_PROFILE'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError(400, 'INVALID_PROFILE');
  const keys = Object.keys(input);
  if (!keys.length || keys.some(key => !ALLOWED_FIELDS.has(key))) throw new InputError(400, 'INVALID_PROFILE');
  const patch = {};
  for (const key of keys) {
    const value = input[key];
    if (key === 'business_name' && value === null) { patch[key] = null; continue; }
    if (typeof value !== 'string' || CONTROL.test(value)) throw new InputError(400, 'INVALID_PROFILE');
    const clean = value.normalize('NFC').trim(), max = key === 'full_name' ? 120 : 160;
    if (clean.length > max || key === 'full_name' && !clean.length) throw new InputError(400, 'INVALID_PROFILE');
    patch[key] = clean;
  }
  return patch;
}

function validStoredValue(value, max) {
  return value === null || typeof value === 'string' && value.length <= max && !CONTROL.test(value);
}

function discardBody(response) {
  response.body?.cancel().catch(() => {});
}

async function readProviderJSON(response, maxBytes) {
  if (!response.body) throw Error('Missing provider response');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw Error('Invalid provider response');
      size += value.byteLength;
      // Count delivered bytes, including when Content-Length is absent or false.
      if (size > maxBytes) throw Error('Provider response exceeds limit');
      chunks.push(value);
    }
  } catch (error) {
    reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function createAccountHandler({ fetchImpl = globalThis.fetch } = {}) {
  return async function handleAccountProfile(request, env = {}) {
    const head = request.method === 'HEAD';
    const respond = (status, body, extra = {}) => new Response(head ? null : JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra },
    });
    const failure = (status, code, extra) => respond(status, { code, error: MESSAGES[code] }, extra);
    if (env?.NAITEA_AUTH_ENABLED !== 'true' || env?.NAITEA_PROFILE_ENABLED !== 'true') return failure(423, 'PROFILE_DISABLED');
    const config = readPublicConfig(env);
    if (!config) return failure(503, 'PROFILE_UNAVAILABLE');
    if (!['GET', 'HEAD', 'PATCH'].includes(request.method)) return failure(405, 'METHOD_NOT_ALLOWED', { Allow: 'GET, HEAD, PATCH' });
    let url;
    try { url = new URL(request.url); } catch { return failure(400, 'INVALID_REQUEST'); }
    if (url.search || request.url.includes('?')) return failure(400, 'INVALID_REQUEST');
    const authorization = request.headers.get('authorization') || '';
    const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
    if (!bearer || bearer[1].length > 8192) return failure(401, 'AUTH_REQUIRED');
    let patch;
    if (request.method === 'PATCH') {
      if (request.headers.get('origin') !== url.origin) return failure(403, 'ORIGIN_FORBIDDEN');
      if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return failure(415, 'JSON_REQUIRED');
      try { patch = await readPatch(request); }
      catch (error) { return error instanceof InputError ? failure(error.status, error.code) : failure(400, 'INVALID_PROFILE'); }
    }
    // Never decode a browser token to choose the owner. The auth provider verifies it.
    const headers = { apikey: config.publishableKey, Authorization: 'Bearer ' + bearer[1], Accept: 'application/json' };
    try {
      const authenticated = await fetchImpl(config.url + '/auth/v1/user', {
        method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(10000),
      });
      if (!authenticated.ok) {
        discardBody(authenticated);
        return authenticated.status === 401 || authenticated.status === 403
          ? failure(401, 'AUTH_REQUIRED') : failure(503, 'PROFILE_UNAVAILABLE');
      }
      const user = await readProviderJSON(authenticated, MAX_AUTH_BYTES);
      if (!user || typeof user.id !== 'string' || !UUID.test(user.id)) return failure(401, 'AUTH_REQUIRED');
      const owner = user.id.toLowerCase(), endpoint = new URL('/rest/v1/naitea_profiles', config.url);
      endpoint.searchParams.set('id', 'eq.' + owner);
      endpoint.searchParams.set('select', 'id,full_name,business_name');
      const profileResponse = await fetchImpl(endpoint.href, {
        method: patch ? 'PATCH' : 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: patch ? { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' } : headers,
        ...(patch ? { body: JSON.stringify(patch) } : {}),
      });
      if (!profileResponse.ok) {
        discardBody(profileResponse);
        if (profileResponse.status === 401) return failure(401, 'AUTH_REQUIRED');
        return profileResponse.status === 403 ? failure(403, 'PROFILE_FORBIDDEN') : failure(503, 'PROFILE_UNAVAILABLE');
      }
      const rows = await readProviderJSON(profileResponse, MAX_PROFILE_BYTES);
      if (!Array.isArray(rows)) return failure(503, 'PROFILE_UNAVAILABLE');
      if (!rows.length) return failure(404, 'PROFILE_NOT_FOUND');
      if (rows.length !== 1 || typeof rows[0]?.id !== 'string' || rows[0].id.toLowerCase() !== owner) return failure(503, 'PROFILE_UNAVAILABLE');
      const row = rows[0];
      if (!validStoredValue(row.full_name, 120) || !validStoredValue(row.business_name, 160)) return failure(409, 'PROFILE_DATA_INVALID');
      return respond(200, { profile: { full_name: row.full_name, business_name: row.business_name } });
    } catch { return failure(503, 'PROFILE_UNAVAILABLE'); }
  };
}
