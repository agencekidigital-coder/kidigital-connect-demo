/* First-party preference storage only. This preview has no optional tracker. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) api.init(root.document);
})(globalThis, function () {
  'use strict';
  const KEY = 'naitea-consent-v1', VERSION = 1, LIFETIME = 180 * 24 * 60 * 60 * 1000;
  const decisions = new Set(['accepted', 'refused', 'customized']);
  function createChoice(decision, now = Date.now()) {
    if (!decisions.has(decision) || !Number.isFinite(now)) throw new TypeError('Invalid privacy choice');
    return { version: VERSION, decision, necessary: true, analytics: false, advertising: false, savedAt: now, expiresAt: now + LIFETIME };
  }
  function parseChoice(value, now = Date.now()) {
    try {
      const choice = typeof value === 'string' ? JSON.parse(value) : value;
      if (!choice || choice.version !== VERSION || !decisions.has(choice.decision) || choice.necessary !== true || choice.analytics !== false || choice.advertising !== false) return null;
      if (!Number.isFinite(choice.savedAt) || !Number.isFinite(choice.expiresAt) || choice.savedAt > now + 60_000 || choice.expiresAt <= now || choice.expiresAt > choice.savedAt + LIFETIME || choice.expiresAt <= choice.savedAt) return null;
      // Rebuild a bounded record; never retain injected identifiers or fields.
      return { ...createChoice(choice.decision, choice.savedAt), expiresAt: choice.expiresAt };
    } catch { return null; }
  }
  function init(document) {
    const window = document.defaultView;
    if (window.NaiteaConsent || document.getElementById('naitea-consent-banner')) return window.NaiteaConsent;
    let memory = null;
    try { memory = parseChoice(window.localStorage.getItem(KEY)); } catch {}
    const host = document.createElement('div'); host.className = 'naitea-consent-root';
    host.innerHTML = `<section id="naitea-consent-banner" class="naitea-consent-banner" aria-labelledby="naitea-consent-title" role="region" hidden>
      <div class="naitea-consent-overview"><img class="naitea-consent-icon" src="/_vercel/image?url=%2Fassets%2Flanding%2Fbrand-additions%2Fcookie-3d.png&amp;w=128&amp;q=80" alt="" width="76" height="76" decoding="async"><div><h2 id="naitea-consent-title">Vos choix de confidentialité</h2><p>Aucun traceur publicitaire ou de mesure d’audience. Photos, polices et vidéos hébergées sur Naïtea.</p></div></div>
      <p class="naitea-consent-note">Votre choix sera mémorisé dans ce navigateur pendant six mois.</p>
      <div class="naitea-consent-actions"><button type="button" class="naitea-consent-choice" data-consent-choice="refused">Tout refuser</button><button type="button" class="naitea-consent-choice" data-consent-choice="accepted">Tout accepter</button><button type="button" class="naitea-consent-choice" data-consent-settings>Personnaliser</button></div>
    </section>
    <dialog id="naitea-consent-preferences" class="naitea-consent-dialog" aria-labelledby="naitea-consent-preferences-title" aria-describedby="naitea-consent-intro">
      <div class="naitea-consent-heading"><h2 id="naitea-consent-preferences-title">Préférences de confidentialité</h2><button type="button" class="naitea-consent-close" aria-label="Fermer les préférences">×</button></div>
      <p id="naitea-consent-intro">Cet aperçu utilise uniquement le stockage nécessaire. Aucun cookie facultatif ne sera activé, quel que soit votre choix.</p>
      <div class="naitea-consent-categories">
        <section><div class="naitea-consent-category-heading"><h3>Nécessaires</h3><span>Toujours actifs</span><input type="checkbox" checked disabled aria-label="Stockage nécessaire, toujours actif"></div><p>Mémorisent vos préférences et permettent les fonctions que vous demandez. Ils ne servent pas à établir un profil publicitaire.</p></section>
        <section><div class="naitea-consent-category-heading"><h3>Mesure d’audience</h3><span>Non utilisée</span><input type="checkbox" disabled aria-label="Mesure d’audience non utilisée dans cet aperçu"></div><p>Aucun service d’analyse n’est installé. Aucun suivi de votre navigation n’est ajouté par cette page.</p></section>
        <section><div class="naitea-consent-category-heading"><h3>Publicité</h3><span>Non utilisée</span><input type="checkbox" disabled aria-label="Cookies publicitaires non utilisés dans cet aperçu"></div><p>Aucun cookie publicitaire ni outil de ciblage n’est installé.</p></section>
      </div>
      <p class="naitea-consent-note">Vous pourrez rouvrir ces réglages depuis le pied de page. Votre choix est conservé six mois, sans identifiant personnel.</p>
      <div class="naitea-consent-actions naitea-consent-preference-actions"><button type="button" class="naitea-consent-choice" data-consent-choice="refused">Tout refuser</button><button type="button" class="naitea-consent-choice" data-consent-choice="accepted">Tout accepter</button><button type="button" class="naitea-consent-choice" data-consent-choice="customized">Enregistrer mes choix</button></div>
    </dialog>`;
    document.body.append(host);
    const banner = document.getElementById('naitea-consent-banner'), dialog = document.getElementById('naitea-consent-preferences');
    const icon = banner.querySelector('img');
    icon.addEventListener('error', () => { icon.hidden = true; banner.classList.add('naitea-consent-no-icon'); });
    function hideBanner() { banner.hidden = true; document.body.classList.remove('naitea-consent-visible'); }
    function showBanner(focus = false) {
      banner.hidden = false; document.body.classList.add('naitea-consent-visible');
      if (focus) banner.querySelector('button').focus();
    }
    function get() {
      const choice = parseChoice(memory);
      return choice ? Object.freeze({ ...choice }) : null;
    }
    function save(decision) {
      memory = createChoice(decision);
      try { window.localStorage.setItem(KEY, JSON.stringify(memory)); } catch {}
      if (dialog.open) dialog.close();
      document.body.classList.remove('naitea-consent-dialog-open'); hideBanner();
      window.dispatchEvent(new window.CustomEvent('naitea:consent', { detail: get() }));
      return get();
    }
    function openPreferences() {
      if (dialog.open) return;
      dialog.showModal(); document.body.classList.add('naitea-consent-dialog-open');
    }
    host.addEventListener('click', event => {
      const choice = event.target.closest('[data-consent-choice]');
      if (choice) { save(choice.dataset.consentChoice); return; }
      if (event.target.closest('[data-consent-settings]')) openPreferences();
    });
    dialog.querySelector('.naitea-consent-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.body.classList.remove('naitea-consent-dialog-open'));
    dialog.addEventListener('click', event => {
      const r = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-open-consent]')) { event.preventDefault(); openPreferences(); }
    });
    const controller = Object.freeze({ open: openPreferences, get, refuse: () => save('refused'), accept: () => save('accepted') });
    window.NaiteaConsent = controller;
    if (!memory) showBanner();
    return controller;
  }
  return { KEY, VERSION, LIFETIME, createChoice, parseChoice, init };
});
