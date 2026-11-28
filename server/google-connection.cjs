'use strict';
const crypto = require('node:crypto');
const TOKEN_COOKIE = '__Host-naitea-google', FLOW_COOKIE = '__Host-naitea-google-flow';
function configuration(env) {
  let redirect = '', supabase = '';
  try { const url = new URL(env.GOOGLE_OAUTH_REDIRECT_URI); if (url.protocol === 'https:' && url.pathname === '/api/google' && url.searchParams.get('action') === 'callback' && !url.username && !url.password) redirect = url.href; } catch {}
  try { const url = new URL(env.SUPABASE_URL); if (url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')) supabase = url.origin; } catch {}
  return { configured: !!env.GOOGLE_OAUTH_CLIENT_ID && !!env.GOOGLE_OAUTH_CLIENT_SECRET && String(env.GOOGLE_CONNECTION_SECRET || '').length >= 32 && !!redirect && !!supabase && !!env.SUPABASE_PUBLISHABLE_KEY, redirect, supabase };
}
function seal(value, secret, purpose) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret).digest(), iv);
  cipher.setAAD(Buffer.from(purpose)); const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
function unseal(value, secret, purpose, now = Date.now()) {
  try {
    if (typeof value !== 'string' || value.length > 6000) return null;
    const [version, iv, tag, encrypted, extra] = value.split('.'); if (version !== 'v1' || extra || !encrypted) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(secret).digest(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
    return result.expires > now ? result : null;
  } catch { return null; }
}
function cookies(header = '') { return Object.fromEntries(header.split(';').map(s => { const index = s.indexOf('='); return index < 0 ? [] : [s.slice(0, index).trim(), s.slice(index + 1).trim()]; }).filter(s => s.length === 2)); }
function cookie(name, value, seconds = 2592000) {
  const serialized = `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
  if (serialized.length > 4096) throw Error('La session Google est trop volumineuse. Reconnectez le compte.');
  return serialized;
}
function body(req) { const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; if (!value || typeof value !== 'object' || JSON.stringify(value).length > 50000) throw Error('Requête invalide.'); return value; }
const validLocation = value => /^accounts\/[A-Za-z0-9_-]{1,160}\/locations\/[A-Za-z0-9_-]{1,160}$/.test(value || '');
function cleanCalendar(input) {
  if (!input || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 200 || String(input.description || '').length > 24000 || String(input.location || '').length > 500) throw Error('Événement invalide.');
  const start = Date.parse(input.start?.dateTime), end = Date.parse(input.end?.dateTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000) throw Error('Horaires invalides.');
  const attendees = Array.isArray(input.attendees) ? [...new Set(input.attendees.map(a => a.email).filter(e => typeof e === 'string' && e.length <= 180 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].slice(0, 100).map(email => ({ email })) : [];
  return { summary: input.summary.trim(), description: String(input.description || ''), location: String(input.location || ''), start: { dateTime: new Date(start).toISOString(), timeZone: 'Europe/Paris' }, end: { dateTime: new Date(end).toISOString(), timeZone: 'Europe/Paris' }, visibility: 'private', guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false, guestsCanModify: false, ...(attendees.length ? { attendees } : {}) };
}
module.exports = { configuration, seal, unseal, cookies, cookie, body, validLocation, cleanCalendar, TOKEN_COOKIE, FLOW_COOKIE };
