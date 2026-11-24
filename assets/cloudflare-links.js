/* Preserve old fragment-only workshop links when / becomes the landing page. */
(function (root) {
  function legacyDestination(location) {
    if (location.pathname !== '/' || !location.hash?.startsWith('#atelier=')) return '';
    let id;
    try { id = decodeURIComponent(location.hash.slice('#atelier='.length)); } catch { return ''; }
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return '';
    const next = new URL('/familles', location.origin);
    next.searchParams.set('atelier', id);
    const packed = new URLSearchParams(location.search).get('event');
    if (packed && packed.length <= 16000) next.searchParams.set('event', packed);
    return next.href;
  }
  if (typeof module === 'object' && module.exports) module.exports = { legacyDestination };
  else {
    const target = legacyDestination(root.location);
    if (target) root.location.replace(target);
  }
})(globalThis);
