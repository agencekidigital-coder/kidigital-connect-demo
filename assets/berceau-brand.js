(function (root) {
  'use strict';
  root.BerceauBrand = {
    create(deps) {
      const { esc, tools } = deps, getState = deps.getState;
      function applyBrand() {
        Object.assign(getState().brand, { accent: tools.palette.pourpre, secondary: tools.palette.corail, third: tools.palette.moutarde, text: tools.palette.pourpre, background: tools.palette.ivoire, titleFont: 'Naitea Titres', bodyFont: 'Source Sans 3' });
      }
      const old = getState().brand;
      const untouchedDemo = old.name === 'Le Cocon de Camille' && old.titleFont === 'Playfair Display' && old.bodyFont === 'Nunito' && old.accent === '#8f79bc' && old.secondary === '#f4c7d6' && old.text === '#402f57' && !old.logo && !old.photo && !(old.customFonts || []).length && !(old.pictograms || []).length && !(getState().v9.customFonts || []).some(font => font.family !== 'Naitea Titres');
      if (untouchedDemo) applyBrand();
      function libraryHTML() {
        return `<details class="card berceau-library"><summary>Les 24 pictogrammes Berceau</summary><p>Choisis un pictogramme pour l’ajouter au visuel, puis déplace-le et redimensionne-le.</p><div class="berceau-picto-grid">${tools.pictograms.map(p => `<button type="button" data-berceau-picto="${p.id}"><img src="${p.src}" alt="" loading="lazy">${p.label}</button>`).join('')}</div></details>`;
      }
      function selections(field) {
        const input = document.querySelector(`#v12ProfileDetails [name="${field}"]`);
        return input ? root.NaiteaProfessionalProfile.list(input.value, 20) : [];
      }
      function paintPicker(field) {
        const picker = document.querySelector(`[data-berceau-picker="${field}"]`); if (!picker) return;
        const selected = selections(field), query = picker.querySelector('input[type="search"]').value.trim();
        const key = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const catalogue = [...new Set([...selected, ...tools.taxonomy[field]])];
        const visible = catalogue.filter(s => key(s).includes(key(query)));
        picker.querySelector('.berceau-keyword-options').innerHTML = visible.map(value => `<label><input type="checkbox" data-berceau-keyword="${field}" value="${esc(value)}" ${selected.includes(value) ? 'checked' : ''}><span>${esc(value)}</span></label>`).join('') + (query && !catalogue.some(s => key(s) === key(query)) ? `<button type="button" class="btn secondary small" data-berceau-add-keyword="${field}">Ajouter « ${esc(query)} »</button>` : '');
        picker.querySelector('.berceau-keyword-selected').innerHTML = selected.map(value => `<button type="button" data-berceau-remove-keyword="${field}" data-value="${esc(value)}" aria-label="Retirer ${esc(value)}">${esc(value)} <span aria-hidden="true">×</span></button>`).join('');
      }
      function updateKeywords(field, values) {
        const input = document.querySelector(`#v12ProfileDetails [name="${field}"]`); input.value = values.join(', ');
        input.dispatchEvent(new Event('input', { bubbles: true })); paintPicker(field);
      }
      function addKeywordPickers() {
        for (const [field, title] of [['specialties', 'Spécialités'], ['audiences', 'Publics accompagnés'], ['languages', 'Langues parlées']]) {
          const input = document.querySelector(`#v12ProfileDetails [name="${field}"]`);
          if (!input || input.type === 'hidden') continue;
          input.type = 'hidden'; const original = input.closest('label');
          const picker = document.createElement('fieldset'); picker.className = 'berceau-keyword-picker'; picker.dataset.berceauPicker = field;
          picker.innerHTML = `<legend>${title}</legend><div class="berceau-keyword-selected"></div><label class="field"><span>Rechercher ou ajouter un mot clé</span><input type="search" data-berceau-keyword-search="${field}" maxlength="100" autocomplete="off"></label><div class="berceau-keyword-options"></div>`;
          original.before(input, picker); original.remove(); paintPicker(field);
        }
      }
      function syncQualifications() {
        const target = document.querySelector('#v12ProfileDetails [name="qualifications"]');
        if (!target) return;
        target.value = [...document.querySelectorAll('.berceau-qualification-row')].map(row => ['title', 'school', 'year'].map(key => row.querySelector('[data-qualification="' + key + '"]').value.replace(/[|\r\n]/g, ' ').trim()).join(' | ')).join('\n');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function qualificationRow(value = {}) {
        return `<article class="berceau-qualification-row"><label class="field"><span>Formation ou spécialisation obtenue</span><input data-qualification="title" value="${esc(value.title || '')}" maxlength="180"></label><div class="inputgrid"><label class="field"><span>Organisme de formation</span><input data-qualification="school" value="${esc(value.school || '')}" maxlength="160"></label><label class="field"><span>Année</span><input data-qualification="year" value="${esc(value.year || '')}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4"></label></div><button type="button" class="btn ghost small" data-berceau-remove-qualification>Supprimer cette formation</button></article>`;
      }
      function addQualificationEditor() {
        const target = document.querySelector('#v12ProfileDetails [name="qualifications"]');
        if (!target || target.hidden) return;
        const values = target.value.split('\n').map(line => { const [title, school, year] = line.split('|').map(s => s.trim()); return { title, school, year }; }).filter(v => v.title);
        const original = target.closest('label'), editor = document.createElement('fieldset');
        target.hidden = true; editor.className = 'berceau-qualifications';
        editor.innerHTML = `<legend>Formations et spécialisations</legend><div id="berceauQualifications">${values.map(qualificationRow).join('')}</div><button type="button" class="btn secondary" data-berceau-add-qualification>Ajouter une formation</button>`;
        original.before(target, editor); original.remove();
      }
      function afterRender() {
        const kit = document.querySelector('.v10-brand');
        if (kit && !document.getElementById('berceauOfficialKit')) kit.insertAdjacentHTML('afterbegin', `<section id="berceauOfficialKit" class="card berceau-kit-card"><img class="berceau-kit-logo" src="/assets/berceau/logos/naitea-logo-trema-ea.png" alt="Naïtea, identité Berceau"><h2>La charte Berceau</h2><p>Le logo et les pictogrammes officiels sont disponibles. Tu peux garder ta propre identité ou appliquer cette palette et ses polices à tes prochaines créations.</p><div class="berceau-brand-palette">${Object.entries(tools.palette).map(([key, color]) => `<span><i style="--color:${color}"></i>${key} ${color}</span>`).join('')}</div><button type="button" class="btn secondary" data-berceau-brand="apply">Utiliser cette palette et ces polices</button></section>`);
        if (document.getElementById('v8DesignStage') && !document.querySelector('.berceau-library')) document.querySelector('.v8-workspace')?.insertAdjacentHTML('beforeend', libraryHTML());
        document.querySelectorAll('.dashboard-metrics .metric').forEach(card => {
          if (card.querySelector('.berceau-metric-icon')) return;
          const label = card.querySelector('.metrichead')?.textContent.toLowerCase() || '';
          const id = /atelier/.test(label) ? 'agenda' : /inscri/.test(label) ? 'inscriptions' : /famille|contact/.test(label) ? 'suivi-des-familles' : 'statistiques';
          const p = tools.pictograms.find(p => p.id === id);
          card.insertAdjacentHTML('beforeend', `<img class="berceau-metric-icon" src="${p.src}" alt="">`);
        });
        addKeywordPickers();
        addQualificationEditor();
        const socials = document.getElementById('v8Social'), d = getState().profile.publicPage || {};
        if (socials && !socials.querySelector('[name="linkedin"]')) {
          socials.querySelector('button').insertAdjacentHTML('beforebegin', `<label class="field"><span>Lien LinkedIn (facultatif)</span><input name="linkedin" type="url" value="${esc(d.linkedin || '')}" maxlength="1000"></label><label class="field"><span>Lien TikTok (facultatif)</span><input name="tiktok" type="url" value="${esc(d.tiktok || '')}" maxlength="1000"></label>`);
        }
        const hero = document.querySelector('.v12-hero-actions');
        if (hero && !hero.querySelector('.berceau-contact-action')) {
          hero.insertAdjacentHTML('beforeend', `${getState().profile.phone ? `<a class="btn secondary berceau-contact-action" href="tel:${esc(getState().profile.phone.replace(/[^\d+]/g, ''))}">${deps.ic('phone', 's')} Appeler</a>` : ''}<a class="btn secondary berceau-contact-action" href="#v12Contact">${deps.ic('mail', 's')} Écrire</a>`);
          hero.querySelector('a[href="#v8ParentWorkshops"]')?.classList.add('berceau-secondary');
        }
      }
      function beforeSubmit(form) {
        if (form.id === 'v12ProfileDetails') {
          for (const row of form.querySelectorAll('.berceau-qualification-row')) {
            const title = row.querySelector('[data-qualification="title"]').value.trim();
            if (!title && [...row.querySelectorAll('input')].some(input => input.value.trim())) { deps.toast('Précise l’intitulé de la formation ou supprime la ligne vide.'); return false; }
          }
        }
        if (form.id !== 'v8Social') return true;
        const page = getState().profile.publicPage ||= {};
        const next = {};
        for (const key of ['linkedin', 'tiktok']) {
          const value = form.elements[key]?.value.trim() || '';
          next[key] = root.NaiteaProfessionalProfile.safeURL(value, [key + '.com']);
          if (value && !next[key]) { deps.toast('Indique un lien HTTPS valide vers ' + key + '.com.'); return false; }
        }
        Object.assign(page, next); return true;
      }
      document.addEventListener('input', event => {
        if (event.target.dataset.berceauKeywordSearch) paintPicker(event.target.dataset.berceauKeywordSearch);
        if (event.target.hasAttribute('data-qualification')) syncQualifications();
      }, true);
      document.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.dataset.berceauKeywordSearch) { event.preventDefault(); event.target.closest('fieldset').querySelector('[data-berceau-add-keyword]')?.click(); }
      }, true);
      document.addEventListener('change', event => {
        const field = event.target.dataset.berceauKeyword;
        if (field) { const selected = selections(field).filter(s => s !== event.target.value); if (event.target.checked) selected.push(event.target.value); updateKeywords(field, selected); }
      }, true);
      document.addEventListener('click', event => {
        const addQualification = event.target.closest('[data-berceau-add-qualification]');
        if (addQualification) {
          if (document.querySelectorAll('.berceau-qualification-row').length >= 25) return deps.toast('Tu peux ajouter jusqu’à 25 formations.');
          document.getElementById('berceauQualifications').insertAdjacentHTML('beforeend', qualificationRow()); syncQualifications(); return;
        }
        const removeQualification = event.target.closest('[data-berceau-remove-qualification]');
        if (removeQualification) { removeQualification.closest('.berceau-qualification-row').remove(); syncQualifications(); return; }
        const apply = event.target.closest('[data-berceau-brand]');
        if (apply) { deps.snapshotBrand(); applyBrand(); deps.save(); deps.render(); deps.toast('Palette et polices Berceau appliquées à tes prochaines créations.'); return; }
        const picture = event.target.closest('[data-berceau-picto]');
        if (picture) { const p = tools.pictograms.find(p => p.id === picture.dataset.berceauPicto); if (p) deps.addImage(p.src); return; }
        const add = event.target.closest('[data-berceau-add-keyword]');
        if (add) { const field = add.dataset.berceauAddKeyword, picker = add.closest('fieldset'), value = picker.querySelector('input[type="search"]').value.trim(); updateKeywords(field, [...new Set([...selections(field), value])]); picker.querySelector('input[type="search"]').value = ''; paintPicker(field); return; }
        const remove = event.target.closest('[data-berceau-remove-keyword]');
        if (remove) updateKeywords(remove.dataset.berceauRemoveKeyword, selections(remove.dataset.berceauRemoveKeyword).filter(s => s !== remove.dataset.value));
      }, true);
      return { afterRender, beforeSubmit };
    },
  };
})(globalThis);
