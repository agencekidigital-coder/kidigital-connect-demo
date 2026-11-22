/* Review local website content before adding offers to the demonstration. */
(function (root) {
  'use strict';
  function create(deps) {
    const T = root.NaiteaSiteImportTools, esc = deps.esc || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const modes = ['À domicile', 'En visio', 'En cabinet', 'Par téléphone'];
    let raw = '', format = 'text', source = '', filename = '', results = null, message = '';
    const field = (label, key, value, extra = '') => `<label class="field"><span>${label}</span><input data-import-field name="${key}" value="${esc(value ?? '')}" ${extra}></label>`;
    function preview() {
      if (!results) return '';
      if (!results.offers.length) return '<section class="card site-import-results"><h3>Aucune prestation identifiable</h3><p>Ajoutez un titre par prestation, sa description, son tarif et sa durée, ou essayez une autre page HTML de votre site. Aucun contenu n’a été créé.</p></section>';
      return `<section class="site-import-results" aria-labelledby="site-import-results-title"><h3 id="site-import-results-title" tabindex="-1">${results.offers.length} prestation${results.offers.length > 1 ? 's' : ''} à vérifier</h3><p>Vérifiez chaque fiche. Les tarifs et durées absents restent vides. Sélectionnez les prestations à ajouter, puis complétez les champs manquants.</p>${results.warnings.map(text => `<p class="fine">${esc(text)}</p>`).join('')}<form id="naiteaSiteImportForm">${results.offers.map((offer, index) => {
        const knownPrice = offer.currency === 'EUR' || offer.price === 0, selected = knownPrice && offer.price !== null && offer.durationMinutes !== null && offer.modalities.length;
        return `<article class="card site-import-offer" data-import-index="${index}"><label class="checkline site-import-selection"><input type="checkbox" class="site-import-select" ${selected ? 'checked' : ''}><strong>Ajouter « ${esc(offer.title)} »</strong></label><div class="site-import-fields"><div class="inputgrid">${field('Titre', 'title', offer.title, 'required maxlength="160"')}${field('Tarif en euros', 'price', knownPrice ? offer.price : '', 'type="number" min="0" max="100000" step="0.01" required placeholder="À compléter"')}</div><label class="field"><span>Description</span><textarea data-import-field name="description" rows="4" maxlength="3000">${esc(offer.description)}</textarea></label>${field('Durée en minutes', 'durationMinutes', offer.durationMinutes, 'type="number" min="5" max="480" step="1" required placeholder="À compléter"')}<fieldset class="site-import-modalities"><legend>Modalités à confirmer</legend>${modes.map(mode => `<label><input data-import-field type="checkbox" name="modalities" value="${mode}" ${offer.modalities.includes(mode) ? 'checked' : ''}> ${mode}</label>`).join('')}</fieldset>${offer.price !== null && !knownPrice ? '<p class="fine">Un montant sans devise euro explicite a été repéré. Renseignez le tarif en euros avant validation.</p>' : ''}<p class="fine">Source : ${filename ? esc(filename) : format === 'html' ? 'HTML fourni' : 'Texte collé'}. ${offer.detectedFrom === 'jsonld' ? 'Données structurées du site.' : 'Contenu lisible fourni.'}</p></div></article>`;
      }).join('')}<label class="checkline site-import-review"><input id="site-import-reviewed" type="checkbox" required> J’ai vérifié les prestations sélectionnées, leurs tarifs, durées et modalités.</label><button class="btn" type="submit">Ajouter les prestations vérifiées</button></form></section>`;
    }
    function screen() {
      return `<div class="site-import-tool"><section class="card"><h2>Importer les prestations de mon site</h2><p>Collez le texte de vos offres ou ouvrez un fichier HTML enregistré depuis votre site. L’analyse reste dans ce navigateur.</p><p class="fine">Aucun site n’est parcouru automatiquement. Aucun fichier n’est envoyé sur un serveur et aucune image externe n’est chargée.</p><label class="field"><span>Adresse de votre site (facultatif, pour la référence)</span><input id="site-import-source" type="url" value="${esc(source)}" placeholder="https://votre-site.fr"></label><div class="site-import-inputs"><label class="field"><span>Format du contenu</span><select id="site-import-format"><option value="text" ${format === 'text' ? 'selected' : ''}>Texte des prestations</option><option value="html" ${format === 'html' ? 'selected' : ''}>Code HTML de la page</option></select></label><label class="btn secondary site-import-file">Ouvrir un fichier HTML ou texte<input id="site-import-file" type="file" accept=".html,.htm,.txt,text/html,text/plain" hidden></label></div><label class="field"><span>Contenu à analyser</span><textarea id="site-import-content" rows="9" spellcheck="false" maxlength="1000000" placeholder="Un titre par prestation, puis sa description, son tarif et sa durée. Les informations absentes resteront à compléter.">${esc(raw)}</textarea></label>${filename ? `<p class="fine">Fichier ouvert : ${esc(filename)}</p>` : ''}<button type="button" class="btn" data-site-import="analyse">Analyser le contenu</button><p class="site-import-status" id="site-import-status" role="status">${esc(message)}</p><details class="site-import-help"><summary>Comment récupérer le contenu de mon site ?</summary><p>Pour le texte : ouvrez votre page de prestations, copiez son texte puis collez-le ici.</p><p>Pour le HTML : utilisez « Enregistrer la page sous » dans votre navigateur, au format HTML. Ouvrez ensuite ce fichier ici. Si votre site construit son contenu avec JavaScript, préférez le texte visible de la page.</p><p>Importez uniquement du contenu dont vous possédez les droits. N’ajoutez pas de messages de clientes ni de données de santé.</p></details></section>${preview()}</div>`;
    }
    function status(text) { message = text; const target = document.getElementById('site-import-status'); if (target) target.textContent = text; }
    function refresh() { deps.render(); syncSelection(); }
    function syncSelection() {
      document.querySelectorAll('.site-import-offer').forEach(card => {
        const checked = card.querySelector('.site-import-select').checked;
        card.querySelectorAll('[data-import-field]').forEach(input => { input.disabled = !checked; });
      });
    }
    function analyse() {
      const input = document.getElementById('site-import-content'); if (!input) return;
      raw = input.value; format = document.getElementById('site-import-format').value; source = document.getElementById('site-import-source').value.trim();
      try {
        if (source && !T.safeURL(source)) throw Error('Vérifiez l’adresse du site : utilisez un lien http ou https sans identifiants.');
        if (!raw.trim()) throw Error('Collez un texte ou ouvrez un fichier HTML avant l’analyse.');
        results = format === 'html' ? T.extractHTML(raw) : T.extractText(raw);
        status(results.offers.length ? 'Analyse locale terminée. Aucune prestation n’a encore été ajoutée.' : 'Aucune prestation identifiable dans ce contenu.');
        refresh(); document.getElementById('site-import-results-title')?.focus({ preventScroll: true });
      } catch (error) { status(error.message || 'Ce contenu ne peut pas être analysé.'); }
    }
    function confirm() {
      const form = document.getElementById('naiteaSiteImportForm'); if (!form || !results) return;
      try {
        if (!form.querySelector('#site-import-reviewed').checked) throw Error('Confirmez la vérification des prestations avant de les ajouter.');
        const selected = [...form.querySelectorAll('.site-import-offer')].filter(card => card.querySelector('.site-import-select').checked);
        if (!selected.length) throw Error('Sélectionnez au moins une prestation à ajouter.');
        if (!form.reportValidity()) return;
        const offers = selected.map(card => {
          const original = results.offers[Number(card.dataset.importIndex)];
          const value = name => card.querySelector(`[name="${name}"]`).value;
          return T.validateOffer({ title: value('title'), description: value('description'), price: value('price'), durationMinutes: value('durationMinutes'), modalities: [...card.querySelectorAll('[name="modalities"]:checked')].map(input => input.value), source: original.source || source });
        });
        const state = deps.getState(), previous = state.offers.slice(), existing = new Set(previous.map(offer => T.key(offer.title) + '|' + T.safeURL(offer.source)));
        let count = 0;
        for (const offer of offers) {
          const id = T.key(offer.title) + '|' + offer.source; if (existing.has(id)) continue;
          state.offers.push({ id: deps.uid(), ...offer, importedFrom: filename ? 'local-file' : format === 'html' ? 'local-html' : 'pasted-text' }); existing.add(id); count++;
        }
        if (!count) return status('Ces prestations existent déjà avec la même référence. Aucune fiche dupliquée.');
        try { if (deps.save() === false) throw Error('Enregistrement impossible sur cet appareil. Libérez de l’espace puis réessayez.'); }
        catch (error) { state.offers = previous; throw error; }
        raw = ''; filename = ''; results = null; message = '';
        deps.navigate?.('offers'); deps.render(); deps.toast?.(`${count} prestation${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} après vérification.`);
      } catch (error) { status(error.message || 'Vérifiez les champs sélectionnés.'); }
    }
    document.addEventListener('click', event => { if (event.target.closest('[data-site-import="analyse"]')) { event.preventDefault(); analyse(); } });
    document.addEventListener('submit', event => { if (event.target.id === 'naiteaSiteImportForm') { event.preventDefault(); event.stopImmediatePropagation(); confirm(); } }, true);
    document.addEventListener('change', async event => {
      if (event.target.matches('.site-import-select')) return syncSelection();
      if (event.target.id !== 'site-import-file') return;
      const file = event.target.files?.[0]; if (!file) return;
      try {
        if (file.size > T.MAX_BYTES) throw Error('Choisissez un fichier de moins de 1 Mo.');
        if (!/\.(?:html?|txt)$/i.test(file.name)) throw Error('Choisissez un fichier HTML ou texte.');
        raw = await file.text(); filename = file.name.slice(0, 180); format = /\.html?$/i.test(file.name) ? 'html' : 'text';
        source = document.getElementById('site-import-source')?.value.trim() || source; results = null; message = 'Fichier ouvert localement. Cliquez sur « Analyser le contenu » pour préparer les fiches.'; refresh();
      } catch (error) { status(error.message || 'Impossible de lire ce fichier.'); }
    });
    // Rendering does not persist raw HTML or drafts in localStorage.
    new MutationObserver(() => { if (document.querySelector('.site-import-tool')) syncSelection(); }).observe(document.body, { childList: true, subtree: true });
    return { screen, analyse, confirm, syncSelection };
  }
  root.NaiteaSiteImport = { create };
})(globalThis);
