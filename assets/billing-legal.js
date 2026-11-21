/* French B2C service/gift document model. Sources and limits: docs/naitea-invoices.md. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NaiteaBillingLegal = api;
})(globalThis, function () {
  'use strict';
  const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
  const FRANCHISE = 'TVA non applicable, art. L. 223 et s. du code des impositions sur les biens et services (CIBS).';
  const MULTIPLE = 'Bon à usages multiples : aucune TVA facturée à l’émission. La TVA éventuelle sera déterminée lors de la fourniture de la prestation.';
  const euro = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value / 100);
  function seller(value = {}) {
    return { name: clean(value.name, 150), tradeName: clean(value.tradeName, 150), entity: ['ei', 'company', 'association'].includes(value.entity) ? value.entity : 'unset', legalForm: clean(value.legalForm, 50), capital: clean(value.capital, 40), street: clean(value.street, 200), postalCode: clean(value.postalCode, 20), city: clean(value.city, 100), country: clean(value.country, 80) || 'France', email: clean(value.email, 180), phone: clean(value.phone, 30), siren: clean(value.siren, 20).replace(/\s/g, ''), siret: clean(value.siret, 25).replace(/\s/g, ''), register: clean(value.register, 150), taxRegime: ['franchise', 'taxed', 'exempt'].includes(value.taxRegime) ? value.taxRegime : 'unset', vatId: clean(value.vatId, 40).replace(/\s/g, ''), vatRate: [0, 2.1, 5.5, 10, 20].includes(Number(value.vatRate)) ? Number(value.vatRate) : 20, exemption: clean(value.exemption, 300), vatOnDebits: !!value.vatOnDebits, giftTaxMode: ['single', 'multiple'].includes(value.giftTaxMode) ? value.giftTaxMode : 'unclassified', giftTaxKnown: !!value.giftTaxKnown, discount: clean(value.discount, 200) || 'Aucun escompte pour paiement anticipé.', extra: clean(value.extra, 600) };
  }
  function validIdentifier(value, length) {
    if (!(new RegExp('^\\d{' + length + '}$')).test(value) || /^0+$/.test(value)) return false;
    const digits = [...value].reverse().map(Number);
    return digits.reduce((sum, n, i) => { const x = i % 2 ? n * 2 : n; return sum + (x > 9 ? x - 9 : x); }, 0) % 10 === 0;
  }
  function missing(value) {
    const s = seller(value), result = [];
    if (!s.name) result.push('Identité légale');
    if (s.entity === 'unset') result.push('Statut juridique');
    if (!s.street || !s.postalCode || !s.city) result.push('Adresse professionnelle complète');
    if (!validIdentifier(s.siren, 9)) result.push('SIREN valide');
    if (s.siret && (!validIdentifier(s.siret, 14) || !s.siret.startsWith(s.siren))) result.push('SIRET cohérent avec le SIREN');
    if (s.entity === 'company' && (!s.legalForm || !s.capital)) result.push('Forme juridique et capital');
    if (s.taxRegime === 'unset') result.push('Régime de TVA');
    if (s.taxRegime === 'taxed' && !/^FR[A-Z0-9]{2}\d{9}$/.test(s.vatId)) result.push('Numéro de TVA français');
    if (s.taxRegime === 'exempt' && !s.exemption) result.push('Fondement légal de l’exonération');
    if (s.giftTaxMode === 'unclassified') result.push('Traitement fiscal des bons cadeaux');
    if (s.giftTaxMode === 'single' && !s.giftTaxKnown) result.push('Confirmation du lieu et de la TVA connus à l’émission du bon');
    return result;
  }
  function buyer(value = {}) {
    return { name: clean(value.name, 200), email: clean(value.email, 180), street: clean(value.billingStreet, 200), postalCode: clean(value.billingPostalCode, 20), city: clean(value.billingCity, 100), country: clean(value.billingCountry, 80) || 'France', addressOpposed: !!value.billingAddressOpposed, orderNumber: clean(value.orderNumber, 80) };
  }
  function tax(totalCents, info, kind, redeemed = {}) {
    const s = seller(info), mode = kind === 'gift' ? s.giftTaxMode : 'service';
    if (mode === 'multiple') return { mode, netCents: null, vatCents: null, rate: null, taxableCents: 0, mention: MULTIPLE, ready: true };
    if (mode === 'unclassified' || s.taxRegime === 'unset' || mode === 'single' && !s.giftTaxKnown) return { mode, netCents: null, vatCents: null, rate: null, mention: 'Traitement de TVA à compléter. Aucune TVA n’est présentée comme déductible dans cet aperçu.', ready: false };
    // A single-purpose voucher was taxed when issued; do not tax that part twice.
    const previouslyTaxedCents = redeemed.singlePurpose ? Math.max(0, Math.min(totalCents, redeemed.amountCents || 0)) : 0;
    const taxableCents = totalCents - previouslyTaxedCents;
    if (s.taxRegime === 'franchise' || s.taxRegime === 'exempt') return { mode, netCents: taxableCents, vatCents: 0, rate: null, taxableCents, previouslyTaxedCents, mention: s.taxRegime === 'franchise' ? FRANCHISE : s.exemption || 'Fondement légal de l’exonération à compléter.', ready: s.taxRegime === 'franchise' || !!s.exemption };
    const netCents = Math.round(taxableCents * 10000 / (10000 + Math.round(s.vatRate * 100))), vatCents = taxableCents - netCents;
    return { mode, rate: s.vatRate, taxableCents, netCents, vatCents, previouslyTaxedCents, mention: mode === 'single' ? 'Bon à usage unique : TVA déterminée à l’émission. La remise de la prestation couverte ne donne pas lieu à une seconde taxation.' : previouslyTaxedCents ? 'Part déjà couverte par un bon à usage unique : TVA traitée lors de son émission. Seul le complément est taxé ici.' : 'Prestations de services.' , ready: true };
  }
  function documentTitle(doc) {
    if (doc.type === 'credit') return 'Avoir';
    if (doc.legal?.tax?.previouslyTaxedCents) return doc.legal.tax.taxableCents ? 'Facture du complément' : 'Attestation d’utilisation du bon';
    if (doc.type === 'gift' && doc.legal?.tax?.mode !== 'single') return 'Reçu d’achat de bon cadeau';
    return doc.type === 'gift' ? 'Facture de bon cadeau' : 'Facture';
  }
  function snapshot(doc, purchase, sellerInfo) {
    const legalSeller = seller(sellerInfo), legalBuyer = buyer({ ...purchase, name: doc.buyer.name, email: doc.buyer.email });
    const missingFields = missing(legalSeller);
    if (!legalBuyer.addressOpposed && (!legalBuyer.street || !legalBuyer.postalCode || !legalBuyer.city)) missingFields.push('Adresse de facturation de l’acheteur ou opposition explicite');
    const treatment = tax(doc.totalCents, legalSeller, doc.kind, purchase.redeemedGift || {});
    return { ...doc, schema: 2, legal: { seller: legalSeller, buyer: legalBuyer, tax: treatment, missing: missingFields, serviceDate: clean(purchase.serviceDate, 40) || doc.issuedAt.slice(0, 10), paidAt: doc.issuedAt, dueDate: doc.issuedAt.slice(0, 10), reference: clean(purchase.sourceId, 100), recipient: clean(purchase.recipient, 100), giftExpiresAt: clean(purchase.giftExpiresAt, 40), coveredService: clean(purchase.coveredService || doc.title, 200), nature: doc.kind === 'gift' && treatment.mode === 'multiple' ? 'Émission d’un bon à usages multiples' : 'Prestations de services', paymentTerms: 'Paiement comptant à la commande (simulé).', paid: true, remainingCents: 0, live: false } };
  }
  function hydrate(doc) { return doc.legal ? doc : snapshot(doc, { ...doc.buyer, sourceId: doc.sourceId, kind: doc.kind, title: doc.title }, { ...doc.seller, name: doc.seller.name }); }
  function amount(doc) { const t = hydrate(doc).legal.tax; return t.previouslyTaxedCents ? t.taxableCents : doc.totalCents; }
  function sellerName(value) { const s = seller(value); return s.name + (s.entity === 'ei' ? ' EI' : s.entity === 'company' ? ' · ' + s.legalForm : s.entity === 'association' ? ' · Association' : ''); }
  function address(value) { return [value.street, [value.postalCode, value.city].filter(Boolean).join(' '), value.country].filter(Boolean).join('\n'); }
  function preview(doc, esc) {
    const d = hydrate(doc), l = d.legal, s = l.seller, b = l.buyer, t = l.tax, taxed = t.netCents !== null;
    return `<article class="billing-invoice"><header><div><strong>${esc(s.tradeName || s.name || d.seller.name || 'Professionnelle')}</strong><p>${esc(sellerName(s) || 'Identité légale à compléter')}</p></div><div><h2>${documentTitle(d)}</h2><p><strong>${esc(d.number)}</strong><br>Émise le ${new Date(d.issuedAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}</p></div></header><p class="billing-demo-stamp">Démonstration · sans valeur fiscale</p><div class="billing-invoice-parties"><section><h3>Émettrice</h3><p>${esc(sellerName(s) || d.seller.name)}<br>${esc(address(s) || 'Adresse professionnelle à compléter').replace(/\n/g, '<br>')}<br>${esc(s.email || d.seller.email)}</p><p>${s.siren ? 'SIREN : ' + esc(s.siren) : 'SIREN à renseigner'}${s.siret ? '<br>SIRET : ' + esc(s.siret) : ''}${s.register ? '<br>' + esc(s.register) : ''}${s.entity === 'company' ? '<br>Capital social : ' + esc(s.capital) + ' €' : ''}${s.vatId ? '<br>TVA : ' + esc(s.vatId) : ''}</p></section><section><h3>Facturé à</h3><p>${esc(b.name)}<br>${b.addressOpposed ? 'Adresse non communiquée à la demande de l’acheteur.' : esc(address(b) || 'Adresse de facturation à compléter').replace(/\n/g, '<br>')}<br>${esc(b.email)}</p>${b.orderNumber ? '<p>Bon de commande : ' + esc(b.orderNumber) + '</p>' : ''}</section></div><dl class="billing-invoice-meta"><div><dt>${d.kind === 'gift' ? 'Date d’achat du bon' : 'Date de la prestation'}</dt><dd>${esc(l.serviceDate)}</dd></div><div><dt>Échéance</dt><dd>Paiement comptant</dd></div><div><dt>Référence</dt><dd>${esc(l.reference)}</dd></div></dl><div class="billing-invoice-table"><table><thead><tr><th>Désignation</th><th>Qté</th><th>${taxed ? 'Prix unitaire HT' : 'Valeur du bon'}</th><th>TVA</th><th>Total</th></tr></thead><tbody><tr><td>${esc((t.previouslyTaxedCents ? 'Complément : ' : '') + d.title)}${d.kind === 'gift' ? '<small>' + esc(l.coveredService) + (l.recipient ? '<br>Pour ' + esc(l.recipient) : '') + '</small>' : ''}</td><td>1</td><td>${euro(taxed ? t.netCents : d.totalCents)}</td><td>${t.rate !== null ? String(t.rate).replace('.', ',') + ' %' : 'Non facturée'}</td><td>${euro(amount(d))}</td></tr></tbody></table></div><div class="billing-invoice-totals">${taxed ? `<p><span>Total HT${t.previouslyTaxedCents ? ' du complément' : ''}</span><strong>${euro(t.netCents)}</strong></p><p><span>TVA${t.rate !== null ? ' ' + t.rate + ' %' : ''}</span><strong>${euro(t.vatCents)}</strong></p>` : ''}<p class="billing-grand-total"><span>${taxed ? 'Total TTC' : 'Montant du bon'}</span><strong>${euro(amount(d))}</strong></p>${d.giftCents && !t.previouslyTaxedCents ? '<p><span>Réglé par bon cadeau</span><strong>' + euro(d.giftCents) + '</strong></p>' : ''}<p><span>${d.type === 'credit' ? 'Remboursement simulé' : 'Paiement simulé'}</span><strong>${euro(d.paidCents)}</strong></p><p><span>${d.type === 'credit' ? 'Solde de l’avoir simulé' : 'Net à payer'}</span><strong>0,00 €</strong></p></div><footer>${t.previouslyTaxedCents ? '<p>Montant initial de la prestation : ' + euro(d.totalCents) + ' ; part couverte par un bon à usage unique déjà facturé : ' + euro(t.previouslyTaxedCents) + '. Ce document porte uniquement sur le complément.</p>' : ''}<p>${esc(t.mention)}</p><p>${esc(l.nature)}. ${esc(l.paymentTerms)} ${esc(s.discount)}</p>${s.vatOnDebits && s.taxRegime === 'taxed' ? '<p>Option pour le paiement de la taxe d’après les débits.</p>' : ''}${d.originalId ? '<p>Avoir intégral relatif au document ' + esc(d.originalId) + '. Aucun remboursement réel.</p>' : ''}${l.giftExpiresAt ? '<p>Validité du bon : ' + new Date(l.giftExpiresAt).toLocaleDateString('fr-FR') + '.</p>' : ''}${s.extra ? '<p>' + esc(s.extra) + '</p>' : ''}${l.missing.length ? '<p class="billing-invoice-incomplete">Informations à compléter : ' + esc(l.missing.join(', ')) + '.</p>' : ''}<p class="fine">Paiement et email simulés. Document réservé aux tests, sans valeur comptable ou fiscale.</p></footer></article>`;
  }
  // Layout uses actual embedded-font widths. All untrusted PDF text stays hex-encoded.
  function streams(doc, hex, fonts) {
    const d = hydrate(doc), l = d.legal, s = l.seller, b = l.buyer, t = l.tax, pages = []; let stream = '', y = 790;
    const cp = { '€': 128, '’': 146, '‘': 145, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140, '…': 133, '\u202f': 32, '\u00a0': 32 };
    const width = (v, size, bold) => [...String(v)].reduce((sum, c) => { const code = cp[c] ?? c.charCodeAt(0); return sum + ((fonts?.[bold ? 'bold' : 'regular']?.widths?.[code - 32] || 500) / 1000 * size); }, 0);
    const text = (value, x, yy, size = 10, bold = false, color = '.22 .10 .15') => { stream += `${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x} ${yy} Tm <${hex(value)}> Tj ET\n`; };
    const rect = (x, yy, w, h, color = '.98 .95 .91') => stream += `${color} rg ${x} ${yy} ${w} ${h} re f\n`;
    const rule = yy => stream += `.86 .79 .75 RG .6 w 48 ${yy} m 547 ${yy} l S\n`;
    const next = () => { pages.push(stream); stream = ''; y = 775; text(documentTitle(d) + ' · ' + d.number, 48, 799, 10, true); rule(785); };
    const wrap = (v, max, size, bold = false) => {
      const result = []; for (const paragraph of String(v || '').split('\n')) { let line = ''; for (const raw of paragraph.split(/\s+/).filter(Boolean)) { let word = raw; if (line && width(line + ' ' + word, size, bold) > max) { result.push(line); line = ''; } while (width(word, size, bold) > max && word.length > 1) { let n = 1; while (n < word.length && width(word.slice(0, n + 1), size, bold) <= max) n++; result.push(word.slice(0, n)); word = word.slice(n); } line += (line ? ' ' : '') + word; } if (line) result.push(line); } return result;
    };
    const paragraph = (v, size = 10, bold = false, indent = 48, max = 499) => { for (const line of wrap(v, max, size, bold)) { if (y < 110) next(); text(line, indent, y, size, bold); y -= size + 4; } y -= 5; };
    text(s.tradeName || s.name || d.seller.name || 'Professionnelle', 48, y, 19, true, '.35 .016 .145'); y -= 28;
    paragraph(documentTitle(d), 25, true); paragraph(d.number, 11, true); paragraph('Date d’émission : ' + new Date(d.issuedAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }));
    rect(48, y - 24, 499, 24); text('DÉMONSTRATION · SANS VALEUR FISCALE', 58, y - 16, 10, true, '.35 .016 .145'); y -= 45;
    const top = y;
    text('ÉMETTRICE', 48, y, 9, true); y -= 19;
    paragraph(sellerName(s) || d.seller.name, 10, true, 48, 230); paragraph(address(s) || 'Adresse professionnelle à compléter', 10, false, 48, 230); paragraph(s.email || d.seller.email, 10, false, 48, 230);
    paragraph('SIREN : ' + (s.siren || 'à renseigner') + (s.siret ? '\nSIRET : ' + s.siret : ''), 9, false, 48, 230);
    if (s.register) paragraph(s.register, 9, false, 48, 230); if (s.entity === 'company') paragraph(s.legalForm + ' au capital de ' + s.capital + ' €', 9, false, 48, 230); if (s.vatId) paragraph('TVA : ' + s.vatId, 9, false, 48, 230);
    const leftBottom = y; y = top; text('FACTURÉ À', 318, y, 9, true); y -= 19;
    paragraph(b.name, 10, true, 318, 229); paragraph(b.addressOpposed ? 'Adresse non communiquée à la demande de l’acheteur.' : address(b) || 'Adresse de facturation à compléter', 10, false, 318, 229); paragraph(b.email, 10, false, 318, 229); if (b.orderNumber) paragraph('Bon de commande : ' + b.orderNumber, 9, false, 318, 229);
    y = Math.min(y, leftBottom) - 12; rule(y + 6); y -= 12;
    paragraph((d.kind === 'gift' ? 'Date d’achat du bon' : 'Date de la prestation') + ' : ' + l.serviceDate + ' · Échéance : paiement comptant', 10); paragraph('Référence : ' + l.reference, 9);
    if (y < 280) next();
    rect(48, y - 24, 499, 26, '.35 .016 .145'); text('Désignation', 58, y - 15, 9, true, '1 1 1'); text('Qté', 317, y - 15, 9, true, '1 1 1'); text(t.netCents === null ? 'Valeur' : 'P.U. HT', 350, y - 15, 9, true, '1 1 1'); text('TVA', 425, y - 15, 9, true, '1 1 1'); text('Total', 490, y - 15, 9, true, '1 1 1'); y -= 43;
    const rowY = y; paragraph((t.previouslyTaxedCents ? 'Complément : ' : '') + d.title, 11, true, 58, 247); if (d.kind === 'gift') { paragraph(l.coveredService, 10, false, 58, 247); if (l.recipient) paragraph('Pour ' + l.recipient, 9, false, 58, 247); }
    text('1', 324, rowY, 10); text(euro(t.netCents === null ? d.totalCents : t.netCents), 350, rowY, 10); text(t.rate !== null ? t.rate + ' %' : 'N/A', 425, rowY, 9); text(euro(amount(d)), 487, rowY, 10, true); y -= 10; rule(y + 5);
    const total = (label, amount, large = false) => { if (y < 145) next(); text(label, 305, y, large ? 12 : 10, large); text(euro(amount), 476, y, large ? 13 : 11, true); y -= large ? 27 : 21; };
    y -= 12; if (t.netCents !== null) { total('Total HT' + (t.previouslyTaxedCents ? ' du complément' : ''), t.netCents); total('TVA' + (t.rate !== null ? ' ' + t.rate + ' %' : ''), t.vatCents); }
    total(t.netCents !== null ? 'Total TTC' : 'Montant du bon', amount(d), true);
    if (d.giftCents && !t.previouslyTaxedCents) total('Réglé par bon cadeau', d.giftCents);
    total(d.type === 'credit' ? 'Remboursement simulé' : 'Règlement simulé', d.paidCents); total('Net à payer', 0, true); y -= 8;
    paragraph(t.mention, 9); paragraph(l.nature + '. ' + l.paymentTerms + ' ' + s.discount, 9);
    if (t.previouslyTaxedCents) paragraph('Montant initial de la prestation : ' + euro(d.totalCents) + '. Bon à usage unique déjà facturé lors de son émission : ' + euro(t.previouslyTaxedCents) + '. Le présent document porte uniquement sur le complément.', 9);
    if (s.vatOnDebits && s.taxRegime === 'taxed') paragraph('Option pour le paiement de la taxe d’après les débits.', 9);
    if (l.giftExpiresAt) paragraph('Validité du bon : ' + new Date(l.giftExpiresAt).toLocaleDateString('fr-FR'), 9);
    if (d.originalId) paragraph('Avoir intégral relatif au document ' + d.originalId + '. Aucun remboursement réel.', 9);
    if (s.extra) paragraph(s.extra, 9);
    if (l.missing.length) paragraph('Informations à compléter : ' + l.missing.join(', ') + '.', 9);
    paragraph('Paiement et envoi simulés. Document réservé aux tests, sans valeur comptable ou fiscale.', 9);
    pages.push(stream); return pages;
  }
  return { seller, buyer, validIdentifier, missing, tax, snapshot, hydrate, amount, documentTitle, sellerName, address, preview, streams, FRANCHISE, MULTIPLE };
});
