/* Tester navigation. Stored offer is a UI preference, never an auth session. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.NaiteaTester = api;
    if (typeof document !== 'undefined' && document.body?.dataset.page === 'tester-welcome') api.start(document, root);
  }
})(globalThis, function () {
  'use strict';
  const key = 'naitea-tester-offer-v1', maxAge = 7 * 24 * 60 * 60 * 1000;
  function offer(value) { return ['fiche', 'complet'].includes(value) ? value : ''; }
  function origin(value) {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw Error('Invalid app origin');
    return url.origin;
  }
  function confirmationURL(value) { return origin(value) + '/connexion.html'; }
  function destination(value, selection, page = '/bienvenue.html') {
    if (!['/bienvenue.html', '/connexion.html'].includes(page)) throw Error('Unknown tester destination');
    const url = new URL(page, origin(value));
    const selected = offer(selection); if (selected) url.searchParams.set('offre', selected);
    if (page === '/connexion.html') url.searchParams.set('mode', 'login');
    return url.href;
  }
  function remember(storage, value, now = Date.now()) {
    const selected = offer(value); if (!selected) return;
    try { storage.setItem(key, JSON.stringify({ offer: selected, savedAt: now })); } catch {}
  }
  function recall(storage, now = Date.now()) {
    try {
      const data = JSON.parse(storage.getItem(key));
      if (!data || !offer(data.offer) || !Number.isFinite(data.savedAt) || data.savedAt > now || now - data.savedAt > maxAge) { storage.removeItem(key); return ''; }
      return data.offer;
    } catch { return ''; }
  }
  async function start(doc, browser) {
    const $ = id => doc.getElementById(id);
    let storage; try { storage = browser.localStorage; } catch {}
    const selection = offer(new URLSearchParams(browser.location.search).get('offre')) || recall(storage);
    if (selection) remember(storage, selection);
    $('welcomeLogin').href = destination(browser.location.origin, selection, '/connexion.html');
    let client = null;
    function guest(message) {
      $('onboardingContent').hidden = true; $('onboardingLoading').hidden = true; $('onboardingGuest').hidden = false;
      $('guestMessage').textContent = message;
    }
    try {
      const response = await fetch('/api/public-config', { cache: 'no-store' });
      if (!response.ok) throw Error('Le service de connexion est momentanément indisponible. Vous pouvez explorer la démonstration publique.');
      const config = await response.json();
      if (!config.url || !config.publishableKey) throw Error('Le service de connexion est momentanément indisponible.');
      const sdk = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      client = sdk.createClient(config.url, config.publishableKey);
      // Validate the user with the auth provider; no local flag grants access.
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user) return guest('Connectez-vous pour retrouver votre parcours de démarrage. La démonstration publique reste accessible sans compte.');
      const name = String(data.user.user_metadata?.full_name || '').trim().split(/\s+/)[0].slice(0, 60);
      $('welcomeTitle').textContent = name ? 'Bienvenue ' + name + ' !' : 'Bienvenue sur Naïtea !';
      $('welcomeEmail').textContent = data.user.email || 'Compte connecté';
      $('welcomeOffer').textContent = selection === 'fiche' ? 'Vous avez choisi Ma fiche gratuite. Commencez par découvrir la présentation de votre activité.' : selection === 'complet' ? 'Vous avez choisi de découvrir Naïtea Complet. Aucun abonnement ni prélèvement n’est activé dans cet aperçu.' : 'Votre compte de test est prêt. Découvrez l’espace professionnel et le parcours des familles.';
      $('onboardingLoading').hidden = true; $('onboardingGuest').hidden = true; $('onboardingContent').hidden = false;
      $('welcomeLogout').addEventListener('click', async () => {
        $('welcomeLogout').disabled = true;
        try {
          const result = await client.auth.signOut();
          if (result.error) throw result.error;
          browser.location.replace(destination(browser.location.origin, selection, '/connexion.html'));
        } catch {
          $('welcomeStatus').textContent = 'La déconnexion n’a pas abouti. Réessayez.'; $('welcomeLogout').disabled = false;
        }
      });
    } catch (error) { guest(error.message || 'Impossible de vérifier votre connexion. Réessayez depuis la page de connexion.'); }
  }
  return { offer, origin, confirmationURL, destination, remember, recall, start };
});
