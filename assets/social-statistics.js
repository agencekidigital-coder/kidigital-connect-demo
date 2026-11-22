/* Social reports remain on this browser. No tracker, token, API or invented metric. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root.document) api.mount(root.document);
})(globalThis, function () {
  'use strict';
  const KEY = 'naitea-social-statistics-v1';
  const networks = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
  const metricNames = { views: 'Vues', impressions: 'Impressions', reach: 'Couverture cumulée', likes: 'J’aime', reactions: 'Réactions', comments: 'Commentaires', shares: 'Partages', saves: 'Enregistrements', clicks: 'Clics' };
  const aliases = {
    title: ['title', 'titre', 'caption', 'legende', 'description', 'postmessage', 'message'],
    date: ['date', 'publishdate', 'publishtime', 'datepublication', 'datedepublication', 'publicationdate', 'postdate', 'createdtime'],
    url: ['permalink', 'lienpermanent', 'link', 'lien', 'url', 'posturl'], id: ['postid', 'publicationid', 'identifiantdelapublication', 'id'],
    views: ['views', 'vues', 'videoviews', 'lifetimevideototalviews'],
    impressions: ['impressions', 'lifetimeposttotalimpressions'],
    reach: ['reach', 'couverture', 'lifetimeposttotalreach', 'postreach'],
    likes: ['likes', 'jaime', 'mentionsjaime', 'reactionsjaime'],
    reactions: ['reactions', 'lifetimeposttotalreactions'],
    comments: ['comments', 'commentaires', 'postcomments'], shares: ['shares', 'partages', 'postshares'],
    saves: ['saves', 'saved', 'enregistrements'], clicks: ['clicks', 'clics', 'linkclicks', 'clicssurlelien', 'lifetimeposttotalclicks']
  };
  const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const text = (value, limit = 200) => String(value || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, limit);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function count(value) {
    const clean = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
    if (!clean || /^(?:n\/?a|--?|null)$/i.test(clean)) return null;
    if (!/^\d+$/.test(clean)) return null; // Never guess a decimal/thousands convention.
    const n = Number(clean); return Number.isSafeInteger(n) && n <= 1e12 ? n : null;
  }
  function date(value) {
    const s = text(value, 50), iso = /^(\d{4})-(\d{2})-(\d{2})(?:\b|T)/.exec(s), fr = /^(\d{2})\/(\d{2})\/(\d{4})(?:\b|\s)/.exec(s);
    const parts = iso ? [iso[1], iso[2], iso[3]] : fr ? [fr[3], fr[2], fr[1]] : null;
    if (!parts) return '';
    const out = parts.join('-'), d = new Date(out + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === out ? out : '';
  }
  function safeURL(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com)$/.test(u.hostname) ? u.href : ''; } catch { return ''; }
  }
  function rowsCSV(input) {
    if (typeof input !== 'string' || input.length > 512000) throw Error('Choisissez un export CSV de moins de 500 Ko.');
    input = input.replace(/^\uFEFF/, '');
    const first = input.split(/\r?\n/)[0], delimiter = [';', ',', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (!quoted && c === delimiter) { row.push(cell); cell = ''; }
      else if (!quoted && (c === '\n' || c === '\r')) {
        if (c === '\r' && input[i + 1] === '\n') i++;
        row.push(cell); if (row.some(c => c.trim())) rows.push(row); row = []; cell = '';
      } else cell += c;
      if (cell.length > 10000 || rows.length > 2000 || row.length > 200) throw Error('Cet export est trop volumineux. Choisissez une période plus courte.');
    }
    if (quoted) throw Error('Le fichier CSV contient une cellule incomplète. Réexportez-le depuis votre réseau.');
    row.push(cell); if (row.some(c => c.trim())) rows.push(row);
    return rows;
  }
  function parseReport(input, network) {
    if (!networks[network]) throw Error('Choisissez le réseau correspondant à votre export.');
    const rows = rowsCSV(input); if (rows.length < 2) throw Error('Le fichier ne contient aucune publication.');
    const headers = rows.shift().map(key), fields = {};
    for (const [name, names] of Object.entries(aliases)) fields[name] = headers.findIndex(h => names.includes(h));
    if (!Object.keys(metricNames).some(name => fields[name] >= 0)) throw Error('Aucune colonne de statistiques reconnue. Utilisez un export de publications, avec vues, couverture ou interactions.');
    const get = (row, name) => fields[name] >= 0 ? row[fields[name]] : '';
    const reports = rows.map((row, index) => {
      const metrics = Object.fromEntries(Object.keys(metricNames).map(name => [name, count(get(row, name))]));
      return { network, id: text(get(row, 'id'), 150), title: text(get(row, 'title'), 240) || 'Publication ' + (index + 1), date: date(get(row, 'date')), url: safeURL(get(row, 'url')), ...metrics };
    }).filter(row => Object.keys(metricNames).some(name => row[name] !== null));
    if (!reports.length) throw Error('Aucune valeur entière exploitable. Les cellules vides ou ambiguës ne sont pas transformées en zéro.');
    return reports;
  }
  function merge(previous, incoming) {
    const identity = row => [row.network, row.id || row.url || row.date + '|' + row.title].join('|');
    const all = new Map(previous.map(row => [identity(row), row])); incoming.forEach(row => all.set(identity(row), row));
    return [...all.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3000);
  }
  function totals(rows) {
    return Object.fromEntries(Object.keys(metricNames).map(metric => {
      const values = rows.map(r => r[metric]).filter(n => Number.isSafeInteger(n) && n >= 0);
      return [metric, values.length ? values.reduce((a, b) => a + b, 0) : null];
    }));
  }
  function mount(document) {
    const app = document.getElementById('app'); if (!app) return;
    const format = n => n === null ? 'Non renseigné' : new Intl.NumberFormat('fr-FR').format(n);
    let report = { rows: [], importedAt: '' }, networkFilter = 'all';
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(stored?.rows) && stored.rows.length <= 3000) {
        report = { importedAt: text(stored.importedAt, 50), rows: stored.rows.filter(r => networks[r.network]).map(r => ({ network: r.network, id: text(r.id, 150), title: text(r.title, 240), date: date(r.date), url: safeURL(r.url), ...Object.fromEntries(Object.keys(metricNames).map(m => [m, count(r[m])])) })) };
      }
    } catch {}
    function paint() {
      if (!app.querySelector('.v8-tabs [data-value="publications"][aria-pressed="true"]')) return;
      const workspace = app.querySelector('.v8-workspace'); if (!workspace) return;
      let panel = document.getElementById('naiteaSocialStats');
      if (!panel) { panel = document.createElement('section'); panel.id = 'naiteaSocialStats'; panel.className = 'card naitea-social-stats'; workspace.prepend(panel); }
      const selected = report.rows.filter(row => networkFilter === 'all' || row.network === networkFilter), sum = totals(selected);
      panel.innerHTML = `<div class="between"><h2>Statistiques des réseaux sociaux</h2><span class="fine">Synchronisation Meta non connectée</span></div><p>Retrouvez les résultats de vos publications à partir des exports de vos réseaux.</p><div class="naitea-social-import"><label class="field"><span>Réseau de l’export</span><select id="naiteaSocialNetwork">${Object.entries(networks).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label><label class="btn secondary">Importer un export CSV<input type="file" id="naiteaSocialFile" accept=".csv,text/csv" hidden></label></div><p id="naiteaSocialImportStatus" class="fine" role="status">${report.importedAt ? 'Dernier import : ' + esc(new Date(report.importedAt).toLocaleDateString('fr-FR')) : 'Aucun résultat importé. Aucune statistique fictive n’est affichée.'}</p>${report.rows.length ? `<label class="field naitea-social-filter"><span>Afficher</span><select id="naiteaSocialFilter"><option value="all">Tous les réseaux</option>${Object.entries(networks).map(([id, label]) => `<option value="${id}" ${networkFilter === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="naitea-social-metrics">${['views', 'reach', 'likes', 'comments'].map(m => `<article><span>${metricNames[m]}</span><strong>${format(sum[m])}</strong></article>`).join('')}</div><div class="naitea-social-table"><table><caption>Résultats importés de ${selected.length} publication(s)</caption><thead><tr><th>Publication</th><th>Date</th><th>Vues</th><th>Impressions</th><th>Couverture</th><th>J’aime</th><th>Réactions</th><th>Commentaires</th><th>Partages</th><th>Clics</th></tr></thead><tbody>${selected.map(row => `<tr><th scope="row">${row.url ? `<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.title)}</a>` : esc(row.title)}<small>${networks[row.network]}</small></th><td>${esc(row.date || 'Non renseignée')}</td>${['views', 'impressions', 'reach', 'likes', 'reactions', 'comments', 'shares', 'clicks'].map(m => `<td>${format(row[m])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button type="button" class="btn ghost small" data-social-clear>Effacer mes imports</button>` : ''}<details class="naitea-social-help"><summary>Où trouver mon export ?</summary><p>Dans Meta Business Suite, ouvrez Statistiques, puis Contenu et Exporter. Choisissez les publications de votre page Facebook ou de votre compte Instagram professionnel. Sur TikTok, utilisez l’export de votre espace d’analyse. Importez chaque réseau séparément.</p><p>Les fichiers sont lus dans votre navigateur et ne sont pas envoyés à Naïtea. Les vues et la couverture sont cumulées par publication : une même personne peut être comptée plusieurs fois. Les chiffres absents restent indiqués comme non renseignés.</p><p>La connexion automatique à Meta nécessite une application validée et votre autorisation. Aucun accès à vos comptes ni publication n’est effectué par cet import.</p></details>`;
    }
    app.addEventListener('change', async event => {
      if (event.target.id === 'naiteaSocialFilter') { networkFilter = event.target.value; paint(); return; }
      if (event.target.id !== 'naiteaSocialFile') return;
      const file = event.target.files?.[0], status = document.getElementById('naiteaSocialImportStatus'); if (!file) return;
      try {
        if (file.size > 512000) throw Error('Choisissez un export de moins de 500 Ko.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const content = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8').decode(bytes);
        const rows = parseReport(content, document.getElementById('naiteaSocialNetwork').value);
        const next = { rows: merge(report.rows, rows), importedAt: new Date().toISOString() };
        localStorage.setItem(KEY, JSON.stringify(next)); report = next; paint();
        document.getElementById('naiteaSocialImportStatus').textContent = rows.length + ' publication(s) importée(s). Les doublons sont actualisés.';
      } catch (error) { status.textContent = error.message || 'Impossible de lire cet export.'; event.target.value = ''; }
    });
    app.addEventListener('click', event => {
      if (!event.target.closest('[data-social-clear]') || !confirm('Effacer les statistiques importées sur cet appareil ? Vos fichiers originaux restent disponibles.')) return;
      try { localStorage.removeItem(KEY); report = { rows: [], importedAt: '' }; paint(); } catch {}
    });
    new MutationObserver(() => { if (!document.getElementById('naiteaSocialStats')) paint(); }).observe(app, { childList: true });
    paint();
  }
  return { parseReport, merge, totals, count, safeURL, mount };
});
