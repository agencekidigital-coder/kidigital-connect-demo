/* Preview affordances only. Server routes enforce unavailable integrations independently. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.NaiteaBetaPreview = api;
    const launch = () => api.start(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', launch, { once: true });
    else if (root.document) launch();
  }
})(globalThis, function () {
  'use strict';
  const features = Object.freeze({
    automations: Object.freeze({ label: 'Automatisations', detail: 'Les envois et scénarios automatiques seront ouverts dans une prochaine étape.' }),
    community: Object.freeze({ label: 'Communauté', detail: 'Les échanges entre professionnelles ne sont pas encore ouverts.' }),
    google: Object.freeze({ label: 'Connexion Google', detail: 'La synchronisation de l’agenda et des avis Google sera disponible après son raccordement.' }),
    sms: Object.freeze({ label: 'Rappels SMS', detail: 'Les rappels SMS ne sont pas activés dans cette démonstration.' }),
  });
  const selectors = Object.freeze([
    '[data-nav="automations"]', '[data-nav="communaute"]', '[data-nav="community"]',
    '[data-platform="connect-google"]', '[data-platform="load-google-reviews"]',
    '[data-platform="disconnect-google"]', '[data-platform="publish-google-reply"]',
    '[data-v10="sync-google"]', '#v10GoogleAuto',
    '#berceauReminderSettings input[name="sms"]',
    '#naiteaCalendarForm button[type="submit"]', '#naiteaGooglePublish button[type="submit"]',
  ]);
  const googleActions = new Set(['connect-google', 'load-google-reviews', 'disconnect-google', 'publish-google-reply']);
  function featureFor(attributes) {
    if (!attributes || typeof attributes !== 'object') return '';
    if (attributes['data-nav'] === 'automations') return 'automations';
    if (['communaute', 'community'].includes(attributes['data-nav'])) return 'community';
    if (googleActions.has(attributes['data-platform']) || attributes['data-v10'] === 'sync-google' || attributes.id === 'v10GoogleAuto') return 'google';
    if (attributes.form === 'berceauReminderSettings' && attributes.name === 'sms') return 'sms';
    if (['naiteaCalendarForm', 'naiteaGooglePublish'].includes(attributes.form) && attributes.type === 'submit') return 'google';
    return '';
  }
  function attributesFor(element) {
    return {
      'data-nav': element.getAttribute('data-nav'), 'data-platform': element.getAttribute('data-platform'),
      'data-v10': element.getAttribute('data-v10'), id: element.id, name: element.name,
      form: element.form?.id, type: element.getAttribute('type'),
    };
  }
  function start(doc, browser) {
    const workspace = doc?.querySelector('.shell .workspace');
    if (!doc?.body || !workspace || doc.getElementById('naiteaBetaPreviewNotice')) return;
    const notice = doc.createElement('aside');
    notice.id = 'naiteaBetaPreviewNotice'; notice.className = 'naitea-beta-notice';
    notice.setAttribute('aria-label', 'Conditions de la démonstration');
    notice.textContent = 'Démonstration : données fictives uniquement. Les modifications restent dans ce navigateur.';
    workspace.insertBefore(notice, workspace.querySelector('main'));
    const status = doc.createElement('p');
    status.id = 'naiteaBetaPreviewStatus'; status.className = 'naitea-beta-status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.hidden = true;
    doc.body.append(status);
    const announce = key => {
      const feature = features[key]; if (!feature) return;
      status.textContent = `Bientôt disponible : ${feature.label}. ${feature.detail}`;
      status.hidden = false;
      browser.clearTimeout(status.timer);
      status.timer = browser.setTimeout(() => { status.hidden = true; }, 8000);
    };
    function decorate() {
      const message = (doc.body.classList.contains('naitea-private-workspace') || doc.body.classList.contains('naitea-family-workspace')) ? 'Bêta : ateliers et familles privés synchronisés avec ton compte. Les autres fonctions restent en démonstration.' : 'Démonstration : données fictives uniquement. Les modifications restent dans ce navigateur.';
      if (notice.textContent !== message) notice.textContent = message;
      // The account page and its API belong to the Cloudflare beta only.
      for (const link of doc.querySelectorAll('a.naitea-login-link, .nav a[href="/connexion.html"]')) {
        link.setAttribute('href', '/compte'); link.setAttribute('title', 'Mon compte Naïtea');
      }
      for (const selector of selectors) for (const element of doc.querySelectorAll(selector)) {
        if (element.dataset.naiteaBetaLocked) continue;
        const key = featureFor(attributesFor(element)); if (!key) continue;
        element.dataset.naiteaBetaLocked = key;
        element.classList.add('naitea-beta-locked');
        element.setAttribute('aria-disabled', 'true');
        element.setAttribute('title', `${features[key].detail} Bientôt disponible.`);
        const host = element.tagName === 'INPUT' ? element.closest('label') || element.parentElement : element;
        if (!host) continue;
        if (host !== element) host.dataset.naiteaBetaLocked = key;
        const badge = doc.createElement('span'); badge.className = 'naitea-beta-lock-badge';
        const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>';
        badge.append(icon, doc.createTextNode('Bientôt disponible')); host.append(badge);
      }
    }
    function capture(event) {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      const element = event.target?.closest ? event.target : event.target?.parentElement;
      const locked = element?.closest('[data-naitea-beta-locked]');
      let key = locked?.dataset.naiteaBetaLocked;
      if (event.type === 'submit') {
        key = ['naiteaCalendarForm', 'naiteaGooglePublish'].includes(event.target?.id) ? 'google' : '';
      }
      if (!key || !features[key]) return;
      event.preventDefault(); event.stopImmediatePropagation(); announce(key);
    }
    // Window capture runs before the application's existing document listeners.
    browser.addEventListener('click', capture, true);
    browser.addEventListener('keydown', capture, true);
    browser.addEventListener('submit', capture, true);
    let pending = false;
    const observer = new browser.MutationObserver(() => {
      if (pending) return; pending = true;
      browser.queueMicrotask(() => { pending = false; decorate(); });
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    decorate();
  }
  return Object.freeze({ features, selectors, featureFor, start });
});
