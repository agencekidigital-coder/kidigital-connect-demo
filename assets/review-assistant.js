(function (root) {
  'use strict';
  root.NaiteaReviewAssistant = {
    create(deps) {
      let configured = false;
      fetch('/api/review-reply', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(r => { configured = r?.configured === true; }).catch(() => {});
      const state = deps.getState, esc = deps.esc;
      function open(saved = null) {
        deps.showModal('Préparer une réponse à un avis', '', `<form id="berceauReviewForm"><p>Relis et personnalise la proposition avant de la copier sur Google. Aucune réponse n’est publiée automatiquement.</p><div class="berceau-toolbar"><button type="button" class="btn secondary small" data-review="positive">Exemple positif fictif</button><button type="button" class="btn secondary small" data-review="critical">Exemple critique fictif</button></div><label class="field"><span>Texte de l’avis</span><textarea id="berceauReviewText" rows="4" maxlength="2000" required>${esc(saved?.review || '')}</textarea></label><p class="fine">Évite les noms complets, coordonnées et informations de santé dans le texte transmis à l’IA.</p><div class="inputgrid"><label class="field"><span>Note indiquée dans l’avis (facultative)</span><select id="berceauReviewRating"><option value="">Non renseignée</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(saved?.rating) === n ? 'selected' : ''}>${n}/5</option>`).join('')}</select></label><label class="field"><span>Ton</span><select id="berceauReviewTone"><option value="warm">Chaleureux et sobre</option><option value="factual">Factuel et professionnel</option></select></label></div><label class="field"><span>Longueur</span><select id="berceauReviewLength"><option value="short">Courte</option><option value="normal">Quelques phrases</option></select></label>${configured ? '<label class="checkline"><input type="checkbox" id="berceauReviewConsent"> Je valide l’envoi de ce texte au service IA, après retrait des informations sensibles.</label>' : '<p class="berceau-status">IA non connectée. La démonstration propose un modèle local personnalisable.</p>'}<button class="btn" type="button" data-review="generate">${configured ? 'Générer une proposition avec l’IA' : 'Préparer une proposition de démonstration'}</button><p id="berceauReviewStatus" role="status" class="fine"></p><label class="field"><span>Réponse à relire et personnaliser</span><textarea id="berceauReviewReply" rows="5" maxlength="2500">${esc(saved?.reply || '')}</textarea></label><div class="berceau-toolbar"><button type="button" class="btn secondary" data-review="copy">Copier la réponse</button><button type="submit" class="btn">Enregistrer le brouillon</button>${root.NaiteaProfessionalProfile.safeURL(state().v9.googleReview.url) ? `<a class="btn ghost" href="${esc(root.NaiteaProfessionalProfile.safeURL(state().v9.googleReview.url))}" target="_blank" rel="noopener noreferrer">Ouvrir ma fiche Google</a>` : ''}</div></form>`);
        document.querySelector('.modal')?.classList.add('berceau-review-modal');
      }
      function afterRender() {
        const settings = document.querySelector('.v9-review-settings');
        if (settings && !document.getElementById('berceauReviewAssistant')) settings.insertAdjacentHTML('beforeend', `<section id="berceauReviewAssistant"><h2>Répondre aux avis</h2><p>Prépare une réponse, ajuste le texte puis copie-le sur ta fiche Google.</p><button type="button" class="btn" data-review="open">Préparer une réponse</button><p class="fine">Les avis individuels ne sont pas importés automatiquement. Colle l’avis à traiter ; les notes Google affichées restent indépendantes des brouillons.</p><div class="berceau-review-drafts">${(state().berceau?.reviewDrafts || []).map(d => `<button type="button" class="btn secondary small" data-review="draft" data-id="${esc(d.id)}">${esc(d.review.slice(0, 70))}${d.review.length > 70 ? '…' : ''}</button>`).join('')}</div></section>`);
      }
      function submit(form) {
        if (form.id !== 'berceauReviewForm') return false;
        const review = document.getElementById('berceauReviewText').value.trim(), reply = document.getElementById('berceauReviewReply').value.trim();
        if (!review || !reply) { deps.toast('Renseigne l’avis et une réponse avant d’enregistrer.'); return true; }
        const local = state().berceau ||= {};
        local.reviewDrafts = [{ id: deps.uid(), review, reply, rating: document.getElementById('berceauReviewRating').value, date: new Date().toISOString(), status: 'draft' }, ...(local.reviewDrafts || [])].slice(0, 30);
        if (!deps.save()) return true;
        document.getElementById('berceauReviewStatus').textContent = 'Brouillon enregistré dans ce navigateur. Aucune publication sur Google.';
        return true;
      }
      document.addEventListener('click', async event => {
        const button = event.target.closest('[data-review]'); if (!button) return;
        const action = button.dataset.review;
        if (action === 'open') return open();
        if (action === 'draft') return open(state().berceau.reviewDrafts.find(d => d.id === button.dataset.id));
        if (action === 'positive' || action === 'critical') {
          document.getElementById('berceauReviewText').value = action === 'positive' ? 'Exemple fictif : un atelier clair et un accueil chaleureux, merci pour ce moment.' : 'Exemple fictif : j’aurais aimé davantage de précisions sur le déroulé avant de réserver.';
          document.getElementById('berceauReviewRating').value = action === 'positive' ? '5' : '2'; return;
        }
        const status = document.getElementById('berceauReviewStatus'), output = document.getElementById('berceauReviewReply');
        if (action === 'copy') {
          if (!output.value.trim()) return deps.toast('Prépare ou écris une réponse avant de la copier.');
          try { await navigator.clipboard.writeText(output.value); status.textContent = 'Réponse copiée. Relis-la avant de la publier sur Google.'; }
          catch { output.focus(); output.select(); status.textContent = document.execCommand('copy') ? 'Réponse copiée.' : 'Texte sélectionné. Copie-le avec Ctrl ou Cmd C.'; }
          return;
        }
        if (action !== 'generate') return;
        const review = document.getElementById('berceauReviewText').value.trim();
        if (!review) return deps.toast('Colle le texte de l’avis ou choisis un exemple fictif.');
        const payload = { review, rating: Number(document.getElementById('berceauReviewRating').value) || null, tone: document.getElementById('berceauReviewTone').value, length: document.getElementById('berceauReviewLength').value };
        if (!configured) {
          output.value = deps.tools.localReviewReply({ rating: payload.rating, tone: payload.tone, short: payload.length === 'short' });
          status.textContent = 'Proposition issue d’un modèle local de démonstration. Personnalise-la avant utilisation.'; return;
        }
        if (!document.getElementById('berceauReviewConsent')?.checked) return deps.toast('Vérifie le texte et confirme son envoi au service IA.');
        button.disabled = true; status.textContent = 'Préparation de la proposition…';
        try {
          const token = await deps.getAccessToken();
          if (!token) { status.textContent = 'Connecte-toi avec un compte professionnel autorisé pour utiliser l’IA. Ton texte est conservé ici.'; return; }
          const response = await fetch('/api/review-reply', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...payload, consent: true }) });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || 'La génération IA est indisponible.');
          output.value = result.text; status.textContent = 'Proposition IA prête à relire. Aucune publication automatique.';
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      }, true);
      return { afterRender, submit };
    },
  };
})(globalThis);
