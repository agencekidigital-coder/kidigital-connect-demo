// Render an inert preview; never substitute a real confirmation link or token.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'emails/supabase-confirm-signup.html'), 'utf8');
if ((source.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length !== 3) throw Error('The confirmation placeholders changed.');
const note = '<aside id="apercu" aria-label="Aperçu du modèle" class="preview-tools"><div><strong>Email de confirmation Naïtea</strong><p>Le bouton de confirmation est inactif dans cet aperçu.</p></div><nav aria-label="Récupérer le modèle"><button id="copyEmailTemplate" type="button">Copier le HTML</button><a href="/assets/previews/confirmation-inscription-source.txt" download="confirmation-inscription-naitea.html">Télécharger</a></nav><p id="copyEmailStatus" role="status" aria-live="polite"></p><textarea id="emailTemplateFallback" readonly hidden aria-label="Modèle HTML à copier"></textarea></aside>';
const preview = source.replace(/\{\{ \.ConfirmationURL \}\}/g, '#apercu')
  .replaceAll('target="_blank" rel="noopener noreferrer"', '')
  .replace('<title>Confirmez votre inscription à Naïtea</title>', '<title>Aperçu email Naïtea</title>\n  <meta name="robots" content="noindex, nofollow">')
  .replace('<a class="email-button"', '<a aria-disabled="true" tabindex="-1" class="email-button"')
  .replace('</head>', '<link rel="stylesheet" href="/assets/previews/email-preview.css"><script src="/assets/previews/email-preview.js" defer></script></head>')
  .replace(/(<body[^>]*>)/, '$1\n' + note);
const target = path.join(root, 'assets/previews/confirmation-inscription.html');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, preview);
fs.writeFileSync(path.join(root, 'assets/previews/confirmation-inscription-source.txt'), source);
process.stdout.write(JSON.stringify({ templateBytes: Buffer.byteLength(source), preview: path.relative(root, target), liveRequests: 0 }) + '\n');
