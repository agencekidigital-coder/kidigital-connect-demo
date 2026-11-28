/* Local purchase documents. No payment, email or fiscal service is connected. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NaiteaBilling = api;
})(globalThis, function () {
  'use strict';
  const Legal = typeof module === 'object' && module.exports ? require('./billing-legal.js') : globalThis.NaiteaBillingLegal;
  const clean = (value, length = 180) => String(value ?? '').trim().slice(0, length);
  const euro = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n / 100);
  const date = value => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  function createDocument(existing, purchase, seller, now = new Date()) {
    if (existing.some(doc => doc.purchaseKey === purchase.key)) return null;
    if (!purchase.key || !Number.isSafeInteger(purchase.totalCents) || purchase.totalCents <= 0 || purchase.totalCents > 10000000) throw Error('Montant de démonstration invalide.');
    const giftCents = purchase.giftCents || 0;
    if (!Number.isSafeInteger(giftCents) || giftCents < 0 || giftCents > purchase.totalCents) throw Error('Règlement par bon cadeau invalide.');
    const issuedAt = new Date(now).toISOString();
    const year = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date(now));
    const sequence = 1 + Math.max(0, ...existing.filter(d => d.year === year).map(d => d.sequence || 0));
    const number = 'DEMO-' + year + '-' + String(sequence).padStart(4, '0');
    const doc = { id: number, number, year, sequence, issuedAt, type: purchase.kind === 'gift' ? 'gift' : 'invoice', purchaseKey: clean(purchase.key, 120), kind: purchase.kind, sourceId: clean(purchase.sourceId, 100), title: clean(purchase.title, 140), buyer: { name: clean(purchase.name, 100), email: clean(purchase.email).toLowerCase() }, seller: { name: clean(seller.name, 100), email: clean(seller.email), address: clean(seller.address, 200), identifier: clean(seller.identifier, 80) }, totalCents: purchase.totalCents, giftCents, paidCents: purchase.totalCents - giftCents, payment: 'simulated', status: 'demo', originalId: '' };
    return Legal.snapshot(doc, purchase, seller);
  }
  function createCredit(existing, invoice, now = new Date()) {
    if (!invoice || invoice.type !== 'invoice') return null;
    if (Legal.amount(invoice) <= 0) return null;
    const alreadyTaxed = !!invoice.legal?.tax?.previouslyTaxedCents;
    const doc = createDocument(existing, { key: 'credit:' + invoice.id, sourceId: invoice.sourceId, kind: invoice.kind, title: invoice.title, name: invoice.buyer.name, email: invoice.buyer.email, totalCents: Legal.amount(invoice), giftCents: alreadyTaxed ? 0 : invoice.giftCents }, invoice.seller, now);
    const legal = structuredClone(Legal.hydrate(invoice).legal); if (alreadyTaxed) legal.tax.previouslyTaxedCents = 0;
    return doc ? { ...doc, type: 'credit', originalId: invoice.id, legal } : null;
  }
  function emailFor(doc) {
    return { id: 'billing-' + doc.id, invoiceId: doc.id, to: doc.buyer.email, subject: Legal.documentTitle(doc) + ' ' + doc.number, body: `Bonjour ${doc.buyer.name},\n\nVotre ${doc.type === 'credit' ? 'avoir' : 'document d’achat'} de démonstration ${doc.number} pour « ${doc.title} » est préparé.\nMontant du document fictif : ${euro(Legal.amount(doc))}.\n\nLe PDF est disponible dans Facturation et dans la confirmation d’achat. Ce document est sans valeur fiscale. Aucun débit, remboursement ni email réel.\n\n${doc.seller.name}`, attachments: [{ name: doc.number + '.pdf', type: 'application/pdf', documentId: doc.id }], status: 'Préparé, non envoyé', date: doc.issuedAt };
  }
  // Hex-encoded WinAnsi text keeps user input out of PDF operators.
  function pdfBytes(doc, fonts = globalThis.NaiteaBillingFonts) {
    const cp = { '€': 128, '’': 146, '‘': 145, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140, '…': 133, '\u202f': 32, '\u00a0': 32 };
    const hex = value => Array.from(String(value)).map(c => (cp[c] ?? (c.charCodeAt(0) <= 255 ? c.charCodeAt(0) : 63)).toString(16).padStart(2, '0')).join('');
    const streams = Legal.streams(doc, hex, fonts);
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${streams.map((_, i) => (5 + i * 2) + ' 0 R').join(' ')}] /Count ${streams.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    streams.forEach((content, i) => {
      content += `BT /F1 9 Tf 1 0 0 1 48 65 Tm <${hex(doc.number + ' · Page ' + (i + 1) + '/' + streams.length + ' · Démonstration, sans valeur fiscale')}> Tj ET\n`;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      objects.push('<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
    });
    if (fonts?.regular && fonts?.bold) {
      ['regular', 'bold'].forEach((key, i) => {
        const font = fonts[key], name = i ? 'SourceSans3-Semibold' : 'SourceSans3-Regular';
        const descriptorId = objects.length + 1, fileId = descriptorId + 1;
        objects[2 + i] = `<< /Type /Font /Subtype /TrueType /BaseFont /${name} /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(' ')}] /FontDescriptor ${descriptorId} 0 R /Encoding /WinAnsiEncoding >>`;
        objects.push(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${fileId} 0 R >>`);
        const data = atob(font.data), encoded = Array.from(data, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('') + '>';
        objects.push(`<< /Length ${encoded.length + 1} /Length1 ${data.length} /Filter /ASCIIHexDecode >>\nstream\n${encoded}\nendstream`);
      });
    }
    let pdf = '%PDF-1.4\n', offsets = [0];
    objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const start = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, '0') + ' 00000 n \n'; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
    return Uint8Array.from(pdf, c => c.charCodeAt(0));
  }
  function create(deps) {
    const state = deps.getState, esc = deps.esc;
    const local = () => {
      const value = state().billingDemo ||= { documents: [], pending: [], email: true };
      value.documents ||= []; value.pending ||= []; return value;
    };
    const seller = () => ({ ...Legal.seller(local().legal), name: local().legal?.name || [state().profile.first, state().profile.last].filter(Boolean).join(' '), email: local().legal?.email || state().profile.email, address: state().profile.city, identifier: local().legal?.siren || '' });
    const byId = id => local().documents.find(doc => doc.id === id);
    function record(purchase) {
      const doc = createDocument(local().documents, purchase, seller());
      if (!doc) return null;
      local().documents.push(doc);
      if (local().email !== false) state().v8.emails.unshift(emailFor(doc));
      return doc;
    }
    function summary(doc) {
      return `<section class="billing-receipt"><h3>${Legal.documentTitle(doc)}</h3><p>${esc(doc.number)} · ${euro(Legal.amount(doc))}</p><p>${local().email === false ? 'L’email automatique est désactivé dans la démo.' : 'L’email avec le PDF est préparé, non envoyé.'}</p><button type="button" class="btn secondary" data-billing="download" data-id="${esc(doc.id)}">Télécharger le PDF de démonstration</button><p class="fine">Sans valeur fiscale. Aucun envoi ni paiement réel.</p></section>`;
    }
    function show(doc) {
      if (!doc) return;
      deps.showModal(Legal.documentTitle(doc), '', Legal.preview(doc, esc) + `<div class="berceau-toolbar"><button type="button" class="btn" data-billing="download" data-id="${esc(doc.id)}">Télécharger le PDF</button><button type="button" class="btn secondary" data-billing="email" data-id="${esc(doc.id)}">Voir l’email et sa pièce jointe</button></div>`);
      document.querySelector('.modal')?.classList.add('billing-invoice-modal');
    }
    function beforePurchase(form) {
      if (!['berceauBuyGift', 'v8BookAppointment', 'bookEvent'].includes(form.id)) return null;
      return { data: Object.fromEntries(new FormData(form)), form: form.id, method: new FormData(form).get('payment') || new FormData(form).get('billingPayment') || 'simulated', gifts: new Set((state().berceau.gifts || []).map(g => g.code)), appointments: new Set(state().v8.appointments.map(a => a.id)), signups: new Set(state().signups.map(s => s.id)) };
    }
    function afterPurchase(before) {
      if (!before) return;
      let purchase;
      if (before.form === 'berceauBuyGift') {
        const gift = state().berceau.gifts.find(g => !before.gifts.has(g.code));
        if (gift) purchase = { key: 'gift:' + gift.code, kind: 'gift', sourceId: gift.code, title: 'Bon cadeau : ' + (gift.offerTitle || 'Montant au choix'), name: gift.buyerName, email: gift.buyerEmail, totalCents: gift.valueCents, coveredService: globalThis.NaiteaPlatformTools.giftLabel(gift, state().offers), recipient: gift.recipient, giftExpiresAt: gift.expiresAt, serviceDate: gift.issuedAt.slice(0, 10) };
      } else {
        const kind = before.form === 'bookEvent' ? 'workshop' : 'offer';
        const row = (kind === 'workshop' ? state().signups : state().v8.appointments).find(r => !(kind === 'workshop' ? before.signups : before.appointments).has(r.id));
        if (!row || row.status !== 'confirmed') return;
        const event = kind === 'workshop' ? state().events.find(e => e.id === row.eventId) : row;
        const totalCents = Math.round(Number(event?.price) * 100);
        if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return;
        purchase = { key: kind + ':' + row.id, sourceId: row.id, kind, title: event.title, name: row.name, email: row.email, totalCents, giftCents: row.gift?.amountCents || 0, serviceDate: row.date || event.date, redeemedGift: { amountCents: row.gift?.amountCents || 0, singlePurpose: state().berceau.gifts.find(g => g.code === row.gift?.code)?.taxAtIssue?.mode === 'single' && state().berceau.gifts.find(g => g.code === row.gift?.code)?.taxAtIssue?.ready === true } };
      }
      if (!purchase) return;
      // Only the billing details belong in a pending purchase. Booking contact,
      // home-visit, co-parent and child fields are already held by their own flow.
      const billingFields = ['billingStreet', 'billingPostalCode', 'billingCity', 'billingCountry', 'billingAddressOpposed', 'orderNumber'];
      const billingData = Object.fromEntries(billingFields.filter(key => key in before.data).map(key => [key, before.data[key]]));
      purchase = { ...billingData, ...purchase };
      const previous = structuredClone(state());
      if (before.method !== 'simulated' && (purchase.giftCents || 0) < purchase.totalCents) {
        if (!local().pending.some(p => p.key === purchase.key)) local().pending.push(purchase);
        deps.save(); deps.render();
        document.querySelector('.modal')?.insertAdjacentHTML('beforeend', '<p class="billing-receipt">La facture sera préparée après le règlement simulé sur place.</p>'); return;
      }
      const doc = record(purchase);
      if (doc && purchase.kind === 'gift') { const gift = state().berceau.gifts.find(g => g.code === purchase.sourceId); if (gift) gift.taxAtIssue = structuredClone(doc.legal.tax); }
      if (!deps.save()) { deps.restoreState(previous); deps.toast('Le document n’a pas pu être enregistré. Libère de l’espace avant de réessayer.'); return; }
      deps.render();
      if (doc) document.querySelector('.modal')?.insertAdjacentHTML('beforeend', summary(doc));
    }
    function decorateBooking() {
      const booking = document.querySelector('#berceauBuyGift,#v8BookAppointment,#bookEvent');
      const event = booking?.id === 'bookEvent' ? state().events.find(e => e.id === booking.elements.eventId?.value) : null;
      const offer = booking?.id === 'v8BookAppointment' ? deps.currentOffer?.() : null;
      const billable = booking?.id === 'berceauBuyGift' || booking?.id === 'bookEvent' && event?.price > 0 && deps.spots(event) > 0 || booking?.id === 'v8BookAppointment' && (!offer || offer.price > 0);
      if (booking && !billable) booking.querySelector('.billing-address')?.remove();
      if (booking && billable && !booking.querySelector('.billing-address')) {
        const target = booking.querySelector('.modalfooter') || booking.querySelector('button[type="submit"]');
        target?.insertAdjacentHTML('beforebegin', `<fieldset class="billing-address"><legend>Adresse de facturation</legend><p class="fine">Utilisez une adresse fictive pour le test. Elle sert au document d’achat et n’est pas affichée sur la fiche.</p><label class="checkline"><input type="checkbox" name="billingAddressOpposed"> Je ne souhaite pas communiquer mon adresse sur la facture (achat en tant que particulier).</label><div class="billing-address-fields"><label class="field"><span>Numéro et rue</span><input name="billingStreet" required maxlength="200" autocomplete="billing street-address"></label><div class="inputgrid"><label class="field"><span>Code postal</span><input name="billingPostalCode" required maxlength="20" autocomplete="billing postal-code"></label><label class="field"><span>Ville</span><input name="billingCity" required maxlength="100" autocomplete="billing address-level2"></label></div><label class="field"><span>Pays</span><input name="billingCountry" value="France" required maxlength="80" autocomplete="billing country-name"></label></div><label class="field"><span>Numéro de bon de commande, si vous en avez un</span><input name="orderNumber" maxlength="80"></label></fieldset>`);
      }
      const form = document.getElementById('bookEvent');
      if (!form || form.querySelector('[name="billingPayment"]')) return;
      if (!event || event.price <= 0 || deps.spots(event) <= 0) { form.querySelector('.billing-payment')?.remove(); return; }
      const target = form.querySelector('.modalfooter') || form.querySelector('button[type="submit"]');
      target?.insertAdjacentHTML('beforebegin', `<label class="field billing-payment"><span>Mode de règlement dans la démo</span><select name="billingPayment"><option value="simulated">Paiement en ligne simulé</option><option value="onsite">Règlement sur place prévu</option></select><small>Le PDF et son email sont préparés après le paiement simulé. Aucun débit ni envoi réel.</small></label>`);
    }
    function legalSettings() {
      const s = Legal.seller(local().legal), input = (label, name, value = '', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${extra}></label>`;
      return `<section class="card billing-legal-settings"><h2>Mes informations de facturation</h2><p>Ces coordonnées légales figurent sur les prochains documents. Chaque document conserve les informations présentes lors de sa création.</p><form id="billingLegalSettings"><div class="inputgrid">${input('Nom et prénom ou dénomination sociale', 'name', s.name, 'maxlength="150"')}${input('Nom commercial (facultatif)', 'tradeName', s.tradeName || state().brand?.name, 'maxlength="150"')}</div><label class="field"><span>Statut juridique</span><select name="entity"><option value="unset">À préciser</option><option value="ei" ${s.entity === 'ei' ? 'selected' : ''}>Entrepreneure individuelle (EI / micro-entreprise)</option><option value="company" ${s.entity === 'company' ? 'selected' : ''}>Société</option><option value="association" ${s.entity === 'association' ? 'selected' : ''}>Association</option></select></label><div class="inputgrid">${input('Forme juridique (pour une société)', 'legalForm', s.legalForm, 'maxlength="50" placeholder="SAS, EURL…"')}${input('Capital social en euros (pour une société)', 'capital', s.capital, 'maxlength="40"')}</div>${input('Adresse du siège ou adresse professionnelle', 'street', s.street, 'maxlength="200"')}<div class="inputgrid">${input('Code postal', 'postalCode', s.postalCode, 'maxlength="20"')}${input('Ville', 'city', s.city, 'maxlength="100"')}</div>${input('Pays', 'country', s.country, 'maxlength="80"')}<div class="inputgrid">${input('SIREN (9 chiffres)', 'siren', s.siren, 'inputmode="numeric" maxlength="9"')}${input('SIRET (14 chiffres, facultatif en complément)', 'siret', s.siret, 'inputmode="numeric" maxlength="14"')}</div>${input('Immatriculation complémentaire, si applicable', 'register', s.register, 'maxlength="150" placeholder="RCS, ville d’immatriculation…"')}<div class="inputgrid">${input('Email professionnel', 'email', s.email || state().profile.email, 'type="email" maxlength="180"')}${input('Téléphone professionnel (facultatif)', 'phone', s.phone || state().profile.phone, 'type="tel" maxlength="30"')}</div><h3>TVA et bons cadeaux</h3><label class="field"><span>Mon régime de TVA pour ces prestations</span><select name="taxRegime"><option value="unset">À préciser</option><option value="franchise" ${s.taxRegime === 'franchise' ? 'selected' : ''}>Franchise en base de TVA</option><option value="taxed" ${s.taxRegime === 'taxed' ? 'selected' : ''}>TVA facturée</option><option value="exempt" ${s.taxRegime === 'exempt' ? 'selected' : ''}>Exonération spécifique</option></select></label><div class="inputgrid">${input('Numéro de TVA intracommunautaire', 'vatId', s.vatId, 'maxlength="40"')}<label class="field"><span>Taux applicable aux prestations de cet aperçu</span><select name="vatRate">${[20, 10, 5.5, 2.1, 0].map(n => `<option value="${n}" ${s.vatRate === n ? 'selected' : ''}>${String(n).replace('.', ',')} %</option>`).join('')}</select></label></div>${input('Référence légale de l’exonération, si concernée', 'exemption', s.exemption, 'maxlength="300"')}<label class="checkline"><input type="checkbox" name="vatOnDebits" ${s.vatOnDebits ? 'checked' : ''}> J’ai opté pour le paiement de la TVA d’après les débits</label><label class="field"><span>Traitement fiscal de mes bons cadeaux</span><select name="giftTaxMode"><option value="unclassified">À confirmer selon mes offres</option><option value="single" ${s.giftTaxMode === 'single' ? 'selected' : ''}>Bon à usage unique : lieu et TVA connus à l’émission</option><option value="multiple" ${s.giftTaxMode === 'multiple' ? 'selected' : ''}>Bon à usages multiples : TVA déterminée à l’utilisation</option></select></label><label class="checkline"><input name="giftTaxKnown" type="checkbox" ${s.giftTaxKnown ? 'checked' : ''}> Pour les bons à usage unique, je confirme que le lieu d’imposition et la TVA due sont connus à l’émission pour toutes les prestations couvertes.</label><p class="fine">Un bon portant sur plusieurs offres peut être à usage unique si le lieu et la TVA sont déjà connus. Ce choix dépend de la fiscalité des offres. Un bon à usages multiples donne lieu à un reçu sans TVA à l’émission.</p>${input('Conditions d’escompte', 'discount', s.discount, 'maxlength="200"')}<label class="field"><span>Mentions complémentaires liées à mon activité (facultatives)</span><textarea name="extra" maxlength="600" rows="3">${esc(s.extra)}</textarea></label><button class="btn" type="submit">Enregistrer mes informations</button><p class="fine" role="status">${Legal.missing(s).length ? 'À compléter : ' + esc(Legal.missing(s).join(', ')) + '.' : 'Champs de ce modèle renseignés. Les documents de cet aperçu restent fictifs.'}</p></form></section>`;
    }
    function page() {
      const docs = local().documents.slice().reverse();
      const paid = local().pending.filter(p => {
        const rows = p.kind === 'offer' ? state().v8.appointments : state().signups;
        return rows.some(r => r.id === p.sourceId && r.status === 'confirmed');
      });
      return `<div class="billing-page"><div class="headrow"><h1 class="h1">Facturation</h1></div>${deps.demo}<section class="card"><h2>Un document après chaque achat</h2><p>Factures de prestations et de bons à usage unique ; reçus sans TVA à l’émission des bons à usages multiples. Les PDF sont préparés avec leur email après le règlement simulé.</p><form id="billingSettings"><label class="checkline"><input type="checkbox" name="email" ${local().email !== false ? 'checked' : ''}> Préparer automatiquement l’email avec le PDF</label><button class="btn" type="submit">Enregistrer</button></form><p class="fine">Démonstration locale, sans envoi réel. Les documents restent sans valeur fiscale.</p></section>${legalSettings()}${paid.length ? `<section class="card"><h2>Règlements sur place à confirmer</h2>${paid.map(p => `<article class="billing-row"><div><strong>${esc(p.title)}</strong><p>${esc(p.name)} · ${euro(p.totalCents - (p.giftCents || 0))} à régler</p></div><button class="btn secondary" type="button" data-billing="pay" data-key="${esc(p.key)}">Simuler le règlement</button></article>`).join('')}</section>` : ''}<section class="card"><h2>Documents de démonstration</h2>${docs.map(doc => `<article class="billing-row"><div><strong>${esc(doc.number)} · ${Legal.documentTitle(doc)}</strong><p>${esc(doc.title)} · ${esc(doc.buyer.name)}</p><p>${date(doc.issuedAt)} · ${euro(Legal.amount(doc))} · ${state().v8.emails.some(e => e.invoiceId === doc.id) ? 'Email préparé, non envoyé' : 'Email non préparé'}</p></div><div class="berceau-toolbar"><button class="btn secondary small" data-billing="view" data-id="${esc(doc.id)}">Voir</button><button class="btn secondary small" data-billing="download" data-id="${esc(doc.id)}">PDF</button>${doc.type === 'invoice' && Legal.amount(doc) > 0 && !docs.some(d => d.originalId === doc.id) ? `<button class="btn secondary small" data-billing="credit" data-id="${esc(doc.id)}">Préparer un avoir</button>` : ''}</div></article>`).join('') || '<p>Aucun document. Teste un nouvel achat depuis la fiche parents. Les anciennes réservations ne sont pas considérées comme payées.</p>'}</section></div>`;
    }
    function submit(form) {
      if (form.id === 'billingLegalSettings') {
        const data = Object.fromEntries(new FormData(form)); data.vatOnDebits = !!data.vatOnDebits; data.giftTaxKnown = !!data.giftTaxKnown;
        if (data.siren && !Legal.validIdentifier(data.siren, 9)) { deps.toast('Vérifie les 9 chiffres et la clé de contrôle du SIREN.'); return true; }
        if (data.siret && (!Legal.validIdentifier(data.siret, 14) || !data.siret.startsWith(data.siren))) { deps.toast('Le SIRET doit être valide et commencer par ton SIREN.'); return true; }
        local().legal = Legal.seller(data); if (deps.save()) { deps.render(); deps.toast('Informations enregistrées pour les prochains documents.'); } return true;
      }
      if (form.id !== 'billingSettings') return false;
      local().email = new FormData(form).has('email');
      if (deps.save()) { deps.render(); deps.toast('Préparation des factures mise à jour. Aucun envoi réel.'); }
      return true;
    }
    document.addEventListener('change', event => {
      if (event.target.name !== 'billingAddressOpposed') return;
      const box = event.target.closest('.billing-address').querySelector('.billing-address-fields'); box.hidden = event.target.checked;
      box.querySelectorAll('input').forEach(input => { input.disabled = event.target.checked; input.required = !event.target.checked; });
    }, true);
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-billing]'); if (!button) return;
      const action = button.dataset.billing, doc = byId(button.dataset.id);
      if (action === 'view') return show(doc);
      if (action === 'download' && doc) return deps.download(doc.number + '.pdf', pdfBytes(doc), 'application/pdf');
      if (action === 'email' && doc) {
        const email = state().v8.emails.find(e => e.invoiceId === doc.id);
        return deps.showModal('Email de facture', '', email ? `<p>À : ${esc(email.to)}<br><strong>${esc(email.subject)}</strong></p><pre class="billing-email">${esc(email.body)}</pre><p>Pièce jointe : ${esc(doc.number)}.pdf</p><button class="btn secondary" data-billing="download" data-id="${esc(doc.id)}">Télécharger la pièce jointe</button><p class="fine">Préparé, non envoyé. Aucun abonnement marketing.</p>` : '<p>La préparation automatique de cet email était désactivée au moment de l’achat.</p>');
      }
      if (action === 'pay') {
        const purchase = local().pending.find(p => p.key === button.dataset.key); if (!purchase) return;
        const rows = purchase.kind === 'offer' ? state().v8.appointments : state().signups;
        if (!rows.some(r => r.id === purchase.sourceId && r.status === 'confirmed')) return deps.toast('Cette réservation a été annulée.');
        const previous = structuredClone(state()), issued = record(purchase);
        local().pending = local().pending.filter(p => p.key !== purchase.key);
        if (!deps.save()) { deps.restoreState(previous); return; }
        deps.render(); show(issued); return;
      }
      if (action === 'credit' && doc) {
        deps.showModal('Préparer un avoir de démonstration', '', `<p>Créer un avoir intégral de ${euro(Legal.amount(doc))} lié à ${esc(doc.number)} ? La facture d’origine est conservée. Aucun remboursement réel ni annulation de réservation.</p><button class="btn" data-billing="confirm-credit" data-id="${esc(doc.id)}">Confirmer l’avoir fictif</button>`); return;
      }
      if (action === 'confirm-credit' && doc) {
        const previous = structuredClone(state()), credit = createCredit(local().documents, doc); if (!credit) return;
        local().documents.push(credit); if (local().email !== false) state().v8.emails.unshift(emailFor(credit));
        if (!deps.save()) { deps.restoreState(previous); return; }
        deps.render(); show(credit);
      }
    });
    return { beforePurchase, afterPurchase, decorateBooking, page, submit };
  }
  return { createDocument, createCredit, emailFor, pdfBytes, create };
});
