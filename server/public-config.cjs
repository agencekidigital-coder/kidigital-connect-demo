'use strict';

// This is a disclosure boundary, not an authentication or JWT verification API.
// Only Supabase's browser credentials may cross it. Privileged credentials must
// be rejected even when accidentally saved under the public environment name.
function decodePart(part) {
  const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(binary, character => character.charCodeAt(0)),
  ));
}

function isBrowserKey(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{20,200}$/.test(value)) return true;
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const header = decodePart(parts[0]), payload = decodePart(parts[1]);
    return header && typeof header === 'object' && !Array.isArray(header)
      && typeof header.alg === 'string' && header.alg !== 'none'
      && payload && typeof payload === 'object' && !Array.isArray(payload)
      && payload.role === 'anon';
  } catch {
    return false;
  }
}

function readPublicConfig(env = {}) {
  const url = env?.SUPABASE_URL, publishableKey = env?.SUPABASE_PUBLISHABLE_KEY;
  // A project origin only: no userinfo, custom port, path, query, or fragment.
  if (typeof url !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co\/?$/i.test(url)
      || !isBrowserKey(publishableKey)) return null;
  return { url: new URL(url).origin, publishableKey };
}

module.exports = { readPublicConfig };
