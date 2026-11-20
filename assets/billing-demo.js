/* Local purchase documents. No payment, email or fiscal service is connected. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NaiteaBilling = api;
})(globalThis, function () {
  'use strict';
  const clean = (value, length = 180) => String(value ?? '').trim().slice(0, length);
  const euro = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n / 100);
  const date = value => new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const titles = { invoice: 'Facture de démonstration', gift: 'Justificatif de bon cadeau', credit: 'Avoir de démonstration' };
  function createDocument(existing, purchase, seller, now = new Date()) {
    if (existing.some(doc => doc.purchaseKey === purchase.key)) return null;
    if (!purchase.key || !Number.isSafeInteger(purchase.totalCents) || purchase.totalCents <= 0 || purchase.totalCents > 10000000) throw Error('Montant de démonstration invalide.');
    const giftCents = purchase.giftCents || 0;
    if (!Number.isSafeInteger(giftCents) || giftCents < 0 || giftCents > purchase.totalCents) throw Error('Règlement par bon cadeau invalide.');
    const issuedAt = new Date(now).toISOString();
    const year = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date(now));
    const sequence = 1 + Math.max(0, ...existing.filter(d => d.year === year).map(d => d.sequence || 0));
    const number = 'DEMO-' + year + '-' + String(sequence).padStart(4, '0');
    return { id: number, number, year, sequence, issuedAt, type: purchase.kind === 'gift' ? 'gift' : 'invoice', purchaseKey: clean(purchase.key, 120), kind: purchase.kind, sourceId: clean(purchase.sourceId, 100), title: clean(purchase.title, 140), buyer: { name: clean(purchase.name, 100), email: clean(purchase.email).toLowerCase() }, seller: { name: clean(seller.name, 100), email: clean(seller.email), address: clean(seller.address, 200), identifier: clean(seller.identifier, 80) }, totalCents: purchase.totalCents, giftCents, paidCents: purchase.totalCents - giftCents, payment: 'simulated', status: 'demo', originalId: '' };
  }
  function createCredit(existing, invoice, now = new Date()) {
    if (!invoice || invoice.type !== 'invoice') return null;
    const doc = createDocument(existing, { key: 'credit:' + invoice.id, sourceId: invoice.sourceId, kind: invoice.kind, title: invoice.title, name: invoice.buyer.name, email: invoice.buyer.email, totalCents: invoice.totalCents, giftCents: invoice.giftCents }, invoice.seller, now);
    return doc ? { ...doc, type: 'credit', originalId: invoice.id } : null;
  }
  function emailFor(doc) {
    return { id: 'billing-' + doc.id, invoiceId: doc.id, to: doc.buyer.email, subject: titles[doc.type] + ' ' + doc.number, body: `Bonjour ${doc.buyer.name},\n\nVotre ${doc.type === 'credit' ? 'avoir' : 'document d’achat'} de démonstration ${doc.number} pour « ${doc.title} » est préparé.\nMontant fictif : ${euro(doc.totalCents)}.\n\nLe PDF est disponible dans Facturation et dans la confirmation d’achat. Ce document est sans valeur fiscale. Aucun débit, remboursement ni email réel.\n\n${doc.seller.name}`, attachments: [{ name: doc.number + '.pdf', type: 'application/pdf', documentId: doc.id }], status: 'Préparé, non envoyé', date: doc.issuedAt };
  }
  // Hex-encoded WinAnsi text keeps user input out of PDF operators.
  function pdfBytes(doc, fonts = globalThis.NaiteaBillingFonts) {
    const cp = { '€': 128, '’': 146, '‘': 145, '“': 147, '”': 148, '–': 150, '—': 151, 'œ': 156, 'Œ': 140, '…': 133, '\u202f': 32, '\u00a0': 32 };
    const hex = value => Array.from(String(value)).map(c => (cp[c] ?? (c.charCodeAt(0) <= 255 ? c.charCodeAt(0) : 63)).toString(16).padStart(2, '0')).join('');
    const streams = []; let stream = '0.35 0.016 0.145 rg\n', y = 790;
    const line = (value, size = 11, bold = false) => {
      if (y < 105) { streams.push(stream); stream = '0.35 0.016 0.145 rg\n'; y = 790; }
      stream += `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 48 ${y} Tm <${hex(value)}> Tj ET\n`; y -= size + 8;
    };
    const wrap = value => {
      const lines = []; let current = '';
      for (const word of String(value).replace(/[\r\n\t]/g, ' ').split(/\s+/)) {
        if ((current + ' ' + word).length > 76 && current) { lines.push(current); current = ''; }
        if (word.length > 76) { if (current) lines.push(current); for (let i = 0; i < word.length; i += 76) lines.push(word.slice(i, i + 76)); current = ''; }
        else current += (current ? ' ' : '') + word;
      }
      if (current) lines.push(current); return lines;
    };
    const para = value => wrap(value).forEach(value => line(value));
    line(titles[doc.type], 21, true); line(doc.number, 14, true); line('Émis le ' + date(doc.issuedAt)); y -= 12;
    line('DÉMONSTRATION - SANS VALEUR FISCALE', 12, true); para('Paiement et envoi simulés. Ne pas utiliser pour une comptabilité réelle.'); y -= 10;
    line('Professionnelle', 12, true); para(doc.seller.name || 'Nom à renseigner'); para(doc.seller.address || 'Adresse professionnelle à compléter'); para(doc.seller.email); para('Identifiant : ' + (doc.seller.identifier || 'à compléter avant activation réelle')); y -= 10;
    line('Acheteur de démonstration', 12, true); para(doc.buyer.name); para(doc.buyer.email); y -= 10;
    if (doc.originalId) para('Document d’origine : ' + doc.originalId);
    line('Désignation - quantité 1', 12, true); para(doc.title); y -= 10;
    line((doc.type === 'credit' ? 'Montant de l’avoir : ' : 'Montant de l’achat : ') + euro(doc.totalCents), 16, true);
    if (doc.giftCents) line('Part réglée par bon cadeau : ' + euro(doc.giftCents));
    line((doc.type === 'credit' ? 'Part monétaire à rembourser, simulée : ' : 'Part monétaire réglée, simulée : ') + euro(doc.paidCents));
    para('TVA : régime et mentions à paramétrer avant toute utilisation réelle.');
    if (doc.type === 'gift') para('Justificatif d’achat du bon. Le traitement fiscal du bon dépendra de ses conditions d’utilisation.');
    if (doc.type === 'credit') para('Cet avoir ne déclenche aucun remboursement réel. Le solde du bon est géré séparément dans la démonstration.');
    streams.push(stream);
    const footer = `BT /F1 9 Tf 1 0 0 1 48 65 Tm <${hex('Naïtea - démonstration locale. Aucun email ni débit réel.')}> Tj ET\n`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${streams.map((_, i) => (5 + i * 2) + ' 0 R').join(' ')}] /Count ${streams.length} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    streams.forEach((content, i) => {
      content += footer;
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
    const seller = () => ({ name: [state().profile.first, state().profile.last].filter(Boolean).join(' '), email: state().profile.email, address: state().profile.city, identifier: state().profile.publicPage?.siret || '' });
    const byId = id => local().documents.find(doc => doc.id === id);
    function record(purchase) {
      const doc = createDocument(local().documents, purchase, seller());
      if (!doc) return null;
      local().documents.push(doc);
      if (local().email !== false) state().v8.emails.unshift(emailFor(doc));
      return doc;
    }
    function summary(doc) {
      return `<section class="billing-receipt"><h3>${titles[doc.type]}</h3><p>${esc(doc.number)} · ${euro(doc.totalCents)}</p><p>${local().email === false ? 'L’email automatique est désactivé dans la démo.' : 'L’email avec le PDF est préparé, non envoyé.'}</p><button type="button" class="btn secondary" data-billing="download" data-id="${esc(doc.id)}">Télécharger le PDF de démonstration</button><p class="fine">Sans valeur fiscale. Aucun envoi ni paiement réel.</p></section>`;
    }
    function show(doc) {
      if (!doc) return;
      deps.showModal(titles[doc.type], '', `<div class="billing-preview"><p><strong>${esc(doc.number)}</strong> · ${date(doc.issuedAt)}</p><div class="billing-parties"><div><h3>Professionnelle</h3><p>${esc(doc.seller.name)}<br>${esc(doc.seller.address)}<br>${esc(doc.seller.email)}</p></div><div><h3>Acheteur fictif</h3><p>${esc(doc.buyer.name)}<br>${esc(doc.buyer.email)}</p></div></div><h3>${esc(doc.title)}</h3><p class="billing-total">${euro(doc.totalCents)}</p>${doc.giftCents ? `<p>Bon cadeau : ${euro(doc.giftCents)} · part monétaire simulée : ${euro(doc.paidCents)}</p>` : ''}${doc.originalId ? `<p>Document d’origine : ${esc(doc.originalId)}</p>` : ''}<p class="fine">TVA, mentions, identité complète et régime fiscal à paramétrer avant toute utilisation réelle. Ce document de démonstration est sans valeur fiscale.</p></div><div class="berceau-toolbar"><button type="button" class="btn" data-billing="download" data-id="${esc(doc.id)}">Télécharger le PDF</button><button type="button" class="btn secondary" data-billing="email" data-id="${esc(doc.id)}">Voir l’email et sa pièce jointe</button></div>`);
    }
    function beforePurchase(form) {
      if (!['berceauBuyGift', 'v8BookAppointment', 'bookEvent'].includes(form.id)) return null;
      return { form: form.id, method: new FormData(form).get('payment') || new FormData(form).get('billingPayment') || 'simulated', gifts: new Set((state().berceau.gifts || []).map(g => g.code)), appointments: new Set(state().v8.appointments.map(a => a.id)), signups: new Set(state().signups.map(s => s.id)) };
    }
    function afterPurchase(before) {
      if (!before) return;
      let purchase;
      if (before.form === 'berceauBuyGift') {
        const gift = state().berceau.gifts.find(g => !before.gifts.has(g.code));
        if (gift) purchase = { key: 'gift:' + gift.code, kind: 'gift', sourceId: gift.code, title: 'Achat d’un bon cadeau', name: gift.buyerName, email: gift.buyerEmail, totalCents: gift.valueCents };
      } else {
        const kind = before.form === 'bookEvent' ? 'workshop' : 'offer';
        const row = (kind === 'workshop' ? state().signups : state().v8.appointments).find(r => !(kind === 'workshop' ? before.signups : before.appointments).has(r.id));
        if (!row || row.status !== 'confirmed') return;
        const event = kind === 'workshop' ? state().events.find(e => e.id === row.eventId) : row;
        const totalCents = Math.round(Number(event?.price) * 100);
        if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return;
        purchase = { key: kind + ':' + row.id, sourceId: row.id, kind, title: event.title, name: row.name, email: row.email, totalCents, giftCents: row.gift?.amountCents || 0 };
      }
      if (!purchase) return;
      const previous = structuredClone(state());
      if (before.method !== 'simulated' && (purchase.giftCents || 0) < purchase.totalCents) {
        if (!local().pending.some(p => p.key === purchase.key)) local().pending.push(purchase);
        deps.save(); deps.render();
        document.querySelector('.modal')?.insertAdjacentHTML('beforeend', '<p class="billing-receipt">La facture sera préparée après le règlement simulé sur place.</p>'); return;
      }
      const doc = record(purchase);
      if (!deps.save()) { deps.restoreState(previous); deps.toast('Le document n’a pas pu être enregistré. Libère de l’espace avant de réessayer.'); return; }
      deps.render();
      if (doc) document.querySelector('.modal')?.insertAdjacentHTML('beforeend', summary(doc));
    }
    function decorateBooking() {
      const form = document.getElementById('bookEvent');
      if (!form || form.querySelector('[name="billingPayment"]')) return;
      const event = state().events.find(e => e.id === form.elements.eventId?.value);
      if (!event || event.price <= 0 || deps.spots(event) <= 0) return;
      const target = form.querySelector('.modalfooter') || form.querySelector('button[type="submit"]');
      target?.insertAdjacentHTML('beforebegin', `<label class="field billing-payment"><span>Mode de règlement dans la démo</span><select name="billingPayment"><option value="simulated">Paiement en ligne simulé</option><option value="onsite">Règlement sur place prévu</option></select><small>Le PDF et son email sont préparés après le paiement simulé. Aucun débit ni envoi réel.</small></label>`);
    }
    function page() {
      const docs = local().documents.slice().reverse();
      const paid = local().pending.filter(p => {
        const rows = p.kind === 'offer' ? state().v8.appointments : state().signups;
        return rows.some(r => r.id === p.sourceId && r.status === 'confirmed');
      });
      return `<div class="billing-page"><div class="headrow"><h1 class="h1">Facturation</h1></div>${deps.demo}<section class="card"><h2>Un document après chaque achat</h2><p>Ateliers et séances : facture de démonstration après le paiement simulé. Bons cadeaux : justificatif d’achat. Les PDF et les emails restent dans ce navigateur.</p><form id="billingSettings"><label class="checkline"><input type="checkbox" name="email" ${local().email !== false ? 'checked' : ''}> Préparer automatiquement l’email avec le PDF</label><button class="btn" type="submit">Enregistrer</button></form><p class="fine">Aucun email envoyé. Aucune connexion Stripe modifiée. Avant un usage réel : identité légale, TVA et mentions à définir, numérotation et stockage serveur, paiements vérifiés et service d’envoi à connecter.</p></section>${paid.length ? `<section class="card"><h2>Règlements sur place à confirmer</h2>${paid.map(p => `<article class="billing-row"><div><strong>${esc(p.title)}</strong><p>${esc(p.name)} · ${euro(p.totalCents - (p.giftCents || 0))} à régler</p></div><button class="btn secondary" type="button" data-billing="pay" data-key="${esc(p.key)}">Simuler le règlement</button></article>`).join('')}</section>` : ''}<section class="card"><h2>Documents de démonstration</h2>${docs.map(doc => `<article class="billing-row"><div><strong>${esc(doc.number)} · ${titles[doc.type]}</strong><p>${esc(doc.title)} · ${esc(doc.buyer.name)}</p><p>${date(doc.issuedAt)} · ${euro(doc.totalCents)} · ${state().v8.emails.some(e => e.invoiceId === doc.id) ? 'Email préparé, non envoyé' : 'Email non préparé'}</p></div><div class="berceau-toolbar"><button class="btn secondary small" data-billing="view" data-id="${esc(doc.id)}">Voir</button><button class="btn secondary small" data-billing="download" data-id="${esc(doc.id)}">PDF</button>${doc.type === 'invoice' && !docs.some(d => d.originalId === doc.id) ? `<button class="btn secondary small" data-billing="credit" data-id="${esc(doc.id)}">Préparer un avoir</button>` : ''}</div></article>`).join('') || '<p>Aucun document. Teste un nouvel achat depuis la fiche parents. Les anciennes réservations ne sont pas considérées comme payées.</p>'}</section></div>`;
    }
    function submit(form) {
      if (form.id !== 'billingSettings') return false;
      local().email = new FormData(form).has('email');
      if (deps.save()) { deps.render(); deps.toast('Préparation des factures mise à jour. Aucun envoi réel.'); }
      return true;
    }
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
        deps.showModal('Préparer un avoir de démonstration', '', `<p>Créer un avoir intégral de ${euro(doc.totalCents)} lié à ${esc(doc.number)} ? La facture d’origine est conservée. Aucun remboursement réel ni annulation de réservation.</p><button class="btn" data-billing="confirm-credit" data-id="${esc(doc.id)}">Confirmer l’avoir fictif</button>`); return;
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
