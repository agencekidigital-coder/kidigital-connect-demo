/* This script belongs to the browser preview, never to the email template. */
(function () {
  'use strict';
  const button = document.getElementById('copyEmailTemplate');
  if (!button) return;
  const status = document.getElementById('copyEmailStatus');
  const fallback = document.getElementById('emailTemplateFallback');
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = ''; fallback.hidden = true;
    try {
      const response = await fetch('/assets/previews/confirmation-inscription-source.txt', { credentials: 'omit', cache: 'no-store', redirect: 'error' });
      if (!response.ok) throw Error('Le modèle ne peut pas être chargé. Réessayez.');
      const html = await response.text();
      if (html.length > 102400 || (html.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length !== 3) throw Error('Le modèle est incomplet. Réessayez.');
      try {
        await navigator.clipboard.writeText(html);
        status.textContent = 'HTML copié. Collez-le dans le corps du modèle Confirm signup de Supabase.';
      } catch {
        fallback.value = html; fallback.hidden = false; fallback.focus(); fallback.select();
        status.textContent = 'Le code est sélectionné ci-dessous. Copiez-le puis collez-le dans Supabase.';
      }
    } catch (error) { status.textContent = error.message || 'Impossible de copier le modèle. Réessayez.'; }
    finally { button.disabled = false; }
  });
})();
