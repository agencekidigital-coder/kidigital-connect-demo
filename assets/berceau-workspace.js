(function (root) {
  'use strict';
  root.BerceauWorkspace = {
    create(deps) {
      const { tools, esc, money, ic, fmtDate } = deps, state = deps.getState;
      let giftChoice = '50', preferredGift = '', phoneDraft = { key: '', phone: '', smsConsent: false }, openedGiftLink = false, reminderSignature = '';
      function local() {
        const value = state().berceau ||= {};
        value.gifts ||= []; value.reminders ||= [];
        value.giftConfig ||= tools.giftSettings();
        value.reminderConfig ||= { email: true, sms: true, workshopHours: [48, 24], offerHours: [24, 2] };
        return value;
      }
      local();
      const giftBy = code => local().gifts.find(g => g.code === String(code || '').trim().toUpperCase());
      const euro = tools.formatCents;
      const field = (label, name, value = '', type = 'text', attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
      const dateTime = value => new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'medium', timeStyle: 'short' });
      function records() {
        return [...state().v8.appointments.map(a => ({ ...a, kind: 'offer' })), ...state().signups.map(s => {
          const event = state().events.find(e => e.id === s.eventId);
          return event ? { ...s, title: event.title, date: event.date, time: event.time, duration: event.duration, place: event.place, kind: 'workshop' } : null;
        }).filter(Boolean)];
      }
      function syncReminders(save = true) {
        const config = { ...local().reminderConfig, enabled: !!state().settings.reminder }, rows = records(), now = new Date();
        const desired = tools.reminderPlans(rows, config, now);
        const next = tools.syncReminders(local().reminders, desired, now);
        const signature = JSON.stringify(next);
        if (signature === reminderSignature) return;
        reminderSignature = signature; local().reminders = next;
        const labels = { prepared: 'Prévu dans la démo, non envoyé', cancelled: 'Annulé, non envoyé', past: 'Échéance passée, non envoyé' };
        const generated = next.filter(r => r.channel === 'email').map(r => ({ id: 'berceau-' + r.key, reminderKey: r.key, to: r.destination, subject: 'Rappel de ' + (r.kind === 'workshop' ? 'votre atelier : ' : 'rendez-vous : ') + r.title, body: r.body, status: labels[r.status], date: r.scheduledAt, scheduledAt: r.scheduledAt }));
        state().v8.emails = [...generated, ...state().v8.emails.filter(e => !e.reminderKey && !(/^Rappel/.test(e.subject) && /Modèle à programmer/.test(e.body)))].slice(0, 250);
        if (save) deps.save();
      }
      function reconcileGifts() {
        const result = tools.refundCancelledGifts(local().gifts, (kind, id) => (kind === 'offer' ? state().v8.appointments : state().signups).find(r => r.id === id)?.status);
        if (result.changed) { local().gifts = result.gifts; deps.save(); }
      }
      function giftBanner() {
        return `<section id="berceauGifts" class="berceau-gift-banner"><img src="/assets/landing/brand-additions/cadeau-3d.png" alt=""><div><h2>Offrir un bon cadeau</h2><p>Un montant ou un accompagnement à offrir. La famille choisit ensuite le moment qui lui convient.</p><div class="berceau-toolbar"><button type="button" class="btn" data-berceau="buy-gift">Offrir un bon cadeau</button><button type="button" class="btn secondary" data-berceau="check-gift">J’ai un bon cadeau</button></div><p class="fine">Achat et utilisation simulés, sans débit réel.</p></div></section>`;
      }
      function giftPage() {
        reconcileGifts();
        const cfg = tools.giftSettings(local().giftConfig), gifts = local().gifts;
        const url = new URL('/', location.origin); url.searchParams.set('vue', 'parents'); url.searchParams.set('cadeau', '1');
        return `<div class="berceau-gift-page"><div class="headrow"><h1 class="h1">Bons cadeaux</h1><button class="btn" data-mode="parent">Voir côté parents</button></div>${deps.demo}<div class="grid3 berceau-gift-metrics"><div class="card"><p>Bons créés</p><strong>${gifts.length}</strong></div><div class="card"><p>Valeur offerte, fictive</p><strong>${euro(gifts.reduce((n, g) => n + g.valueCents, 0))}</strong></div><div class="card"><p>Montant utilisé, fictif</p><strong>${euro(gifts.reduce((n, g) => n + g.valueCents - g.balanceCents, 0))}</strong></div></div><div class="berceau-two"><section class="card"><h2>Mon offre de bons cadeaux</h2><form id="berceauGiftSettings"><label class="checkline"><input name="enabled" type="checkbox" ${cfg.enabled ? 'checked' : ''}> Afficher les bons cadeaux sur ma fiche</label>${field('Montants proposés, séparés par des virgules (€)', 'amounts', cfg.amounts.join(', '), 'text', 'maxlength="100" required')}<label class="checkline"><input name="custom" type="checkbox" ${cfg.custom ? 'checked' : ''}> Autoriser un montant libre</label><div class="inputgrid">${field('Montant libre minimum (€)', 'min', cfg.min, 'number', 'min="5" max="1000" step="1" required')}${field('Montant libre maximum (€)', 'max', cfg.max, 'number', 'min="5" max="1000" step="1" required')}</div>${field('Validité à partir de l’achat (mois)', 'months', cfg.months, 'number', 'min="1" max="24" required')}<fieldset class="berceau-checks"><legend>Utilisable pour</legend><label class="checkline"><input name="workshops" type="checkbox" ${cfg.workshops ? 'checked' : ''}> Ateliers collectifs</label><label class="checkline"><input name="offers" type="checkbox" ${cfg.offers ? 'checked' : ''}> Accompagnements individuels</label></fieldset><button class="btn" type="submit">Enregistrer mon offre</button></form></section><section class="card"><h2>Le parcours des familles</h2><ol class="berceau-steps"><li>Choisir un montant ou une prestation.</li><li>Ajouter un prénom et un message.</li><li>Tester le paiement puis télécharger le bon.</li><li>Saisir le code au moment de réserver.</li></ol><p>Un bon peut être utilisé en plusieurs fois. Le complément reste indiqué si son solde ne couvre pas la séance. Une annulation recrédite le bon dans la démo.</p><label class="field"><span>Lien vers la démonstration d’achat</span><input id="berceauGiftLink" readonly value="${esc(url.href)}"></label><button class="btn secondary" data-berceau="copy-gift-link">Copier le lien</button><p class="fine">Les réglages, bons et soldes de cet appareil ne sont pas partagés par ce lien. L’activation réelle demandera un paiement et un stockage serveur.</p></section></div><section class="card berceau-gift-list"><h2>Les bons de démonstration</h2>${gifts.map(g => `<article><div><strong>${esc(g.recipient)}</strong><p>${esc(g.code)}</p><p>Offert par ${esc(g.buyerName)} · valable jusqu’au ${new Date(g.expiresAt).toLocaleDateString('fr-FR')}</p></div><div><strong>${euro(g.balanceCents)} disponibles</strong><p>Sur ${euro(g.valueCents)}${Date.parse(g.expiresAt) <= Date.now() ? ' · expiré' : ''}</p><button class="btn secondary small" data-berceau="gift-detail" data-code="${esc(g.code)}">Voir le bon</button></div></article>`).join('') || '<p>Aucun bon créé. Teste l’achat depuis la fiche parents.</p>'}</section></div>`;
      }
      function giftValue() {
        if (giftChoice.startsWith('offer:')) return state().offers.find(o => o.id === giftChoice.slice(6))?.price * 100 || 0;
        if (giftChoice === 'custom') return tools.cents(document.getElementById('berceauGiftCustom')?.value);
        return tools.cents(giftChoice);
      }
      function openPurchase() {
        const cfg = tools.giftSettings(local().giftConfig); if (!cfg.enabled) return deps.toast('Les bons cadeaux ne sont pas proposés actuellement.');
        giftChoice = String(cfg.amounts[0] || (cfg.custom ? 'custom' : ''));
        const offers = cfg.offers ? state().offers.filter(o => o.price >= 5 && o.price <= 1000) : [];
        if (!giftChoice && offers.length) giftChoice = 'offer:' + offers[0].id;
        deps.showModal('Offrir un bon cadeau', '', `${deps.demo}<form id="berceauBuyGift"><h3>Choisir le cadeau</h3><div class="berceau-gift-choices">${cfg.amounts.map(n => `<button type="button" data-berceau="gift-choice" data-value="${n}" aria-pressed="${giftChoice === String(n)}">${euro(Math.round(n * 100))}</button>`).join('')}${cfg.custom ? `<button type="button" data-berceau="gift-choice" data-value="custom" aria-pressed="${giftChoice === 'custom'}">Montant libre</button>` : ''}</div>${cfg.custom ? `<label class="field" id="berceauGiftCustomField" ${giftChoice === 'custom' ? '' : 'hidden'}><span>Montant libre, de ${cfg.min} à ${cfg.max} €</span><input id="berceauGiftCustom" name="customAmount" type="number" min="${cfg.min}" max="${cfg.max}" step="0.01" value="${cfg.min}" ${giftChoice === 'custom' ? '' : 'disabled'}></label>` : ''}${offers.length ? `<label class="field"><span>Ou offrir un accompagnement précis</span><select id="berceauGiftOffer"><option value="">Choisir un accompagnement</option>${offers.map(o => `<option value="${esc(o.id)}">${esc(o.title)} · ${euro(Math.round(o.price * 100))}</option>`).join('')}</select></label>` : ''}<p class="fine">Valable ${cfg.months} mois. ${cfg.workshops && cfg.offers ? 'Les montants sont utilisables sur les ateliers et accompagnements.' : cfg.workshops ? 'Utilisable sur les ateliers collectifs.' : 'Utilisable sur les accompagnements individuels.'} Un bon lié à une prestation reste réservé à cet accompagnement.</p><h3>Personnaliser le bon</h3>${field('Prénom du bénéficiaire (fictif)', 'recipient', '', 'text', 'required maxlength="100"')}<label class="field"><span>Votre message (facultatif)</span><textarea name="message" maxlength="400" rows="3" placeholder="Un moment pour vous…"></textarea></label><div class="inputgrid">${field('Votre nom (fictif)', 'buyerName', '', 'text', 'required maxlength="100"')}${field('Votre email de test', 'buyerEmail', '', 'email', 'required maxlength="180"')}</div><div class="berceau-gift-total">Total simulé <strong id="berceauGiftTotal">${euro(giftValue())}</strong></div><label class="checkline"><input name="consent" type="checkbox" required> Je teste un achat fictif, sans débit ni envoi réel.</label><button class="btn full" type="submit">Confirmer l’achat de démonstration</button></form>`);
        document.querySelector('.modal')?.classList.add('berceau-gift-modal');
      }
      function showGift(gift) {
        if (!gift) return;
        deps.showModal('Votre bon cadeau de démonstration', '', `<div class="berceau-gift-card"><img src="/assets/berceau/transparent/naitea-logo.png" alt="Naïtea"><h3>Un moment pour ${esc(gift.recipient)}</h3><strong>${euro(gift.valueCents)}</strong>${gift.message ? `<p>${esc(gift.message)}</p>` : ''}<p class="berceau-gift-code">${esc(gift.code)}</p><p>Solde disponible : ${euro(gift.balanceCents)}<br>Valable jusqu’au ${new Date(gift.expiresAt).toLocaleDateString('fr-FR')}</p></div><p>Lors de la réservation, renseignez ce code dans « Utiliser un bon cadeau ». Le bon et son solde restent dans ce navigateur.</p><div class="berceau-toolbar"><button class="btn" type="button" data-berceau="download-gift" data-code="${gift.code}">Télécharger le bon</button><button class="btn secondary" type="button" data-berceau="copy-code" data-code="${gift.code}">Copier le code</button><button class="btn secondary" type="button" data-berceau="use-gift" data-code="${gift.code}">Utiliser ce bon</button></div><p class="fine">Aucun débit réel. Le modèle de confirmation reste dans les automatisations ; aucun email n’a été envoyé.</p>`);
        document.querySelector('.modal')?.classList.add('berceau-gift-modal');
      }
      async function downloadGift(gift) {
        if (deps.customGiftDownload) return deps.customGiftDownload(gift);
        await document.fonts.load('600 60px "Naitea Titres"'); await document.fonts.load('400 30px "Source Sans 3"');
        const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1040;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FEF8ED'; ctx.fillRect(0, 0, 1600, 1040); ctx.strokeStyle = '#D89328'; ctx.lineWidth = 5; ctx.strokeRect(38, 38, 1524, 964);
        const logo = new Image(); logo.src = '/assets/berceau/transparent/naitea-logo.png'; await logo.decode(); ctx.drawImage(logo, 115, 95, 340, 83);
        ctx.fillStyle = '#590425'; ctx.font = '600 78px "Naitea Titres"'; ctx.fillText('Un moment pour ' + gift.recipient.slice(0, 32), 115, 310, 1350);
        ctx.font = '600 94px "Source Sans 3"'; ctx.fillText(euro(gift.valueCents), 115, 445);
        ctx.font = '400 33px "Source Sans 3"'; let y = 520, line = '';
        for (const word of gift.message.split(/\s+/)) { const next = (line + ' ' + word).trim(); if (ctx.measureText(next).width > 1320 && line) { ctx.fillText(line, 115, y); y += 46; line = word; } else line = next; }
        if (line) ctx.fillText(line, 115, y);
        ctx.font = '600 44px "Source Sans 3"'; ctx.fillText(gift.code, 115, 770);
        ctx.font = '400 29px "Source Sans 3"'; ctx.fillText('À renseigner au moment de réserver dans la démonstration Naïtea.', 115, 830);
        ctx.fillText('Valable jusqu’au ' + new Date(gift.expiresAt).toLocaleDateString('fr-FR') + ' · Bon fictif, sans valeur monétaire réelle.', 115, 878);
        ctx.font = '600 25px "Source Sans 3"'; ctx.fillText('DÉMONSTRATION · Utilisable uniquement dans le navigateur ayant créé ce bon.', 115, 953);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); deps.download('Naitea-bon-cadeau-demo.png', blob, 'image/png');
      }
      function bookingContext(form) {
        if (form.id === 'v8BookAppointment') {
          const booking = deps.currentBooking(), offer = state().offers.find(o => o.id === booking.offerId);
          return offer ? { kind: 'offer', id: offer.id, priceCents: Math.round(offer.price * 100), title: offer.title, key: 'offer:' + offer.id, waiting: false } : null;
        }
        if (form.id === 'bookEvent') {
          const event = state().events.find(e => e.id === form.elements.eventId.value);
          return event ? { kind: 'workshop', id: event.id, priceCents: Math.round(event.price * 100), title: event.title, key: 'workshop:' + event.id, waiting: deps.spots(event) === 0 } : null;
        }
        return null;
      }
      function decorateBooking() {
        const form = document.querySelector('#v8BookAppointment,#bookEvent'); if (!form || form.querySelector('.berceau-booking-options')) return;
        const item = bookingContext(form); if (!item) return;
        const remembered = phoneDraft.key === item.key ? phoneDraft : { phone: '', smsConsent: false };
        const existingPhone = form.elements.namedItem('phone');
        if (existingPhone) {
          existingPhone.required = false; existingPhone.maxLength = 30;
          const label = existingPhone.closest('.field')?.querySelector('label,span');
          if (label) label.textContent = 'Téléphone de test (facultatif)';
          if (remembered.phone) existingPhone.value = remembered.phone;
        }
        const smsPhone = existingPhone ? '<p class="fine">Le numéro de test renseigné ci-dessus sera utilisé pour ce rappel.</p>' : field('Numéro de téléphone de test (facultatif, France ou format international)', 'berceauPhone', remembered.phone, 'tel', 'maxlength="30" autocomplete="tel"');
        const cfg = tools.giftSettings(local().giftConfig);
        const giftEnabled = (cfg.enabled || local().gifts.length > 0) && !item.waiting && item.priceCents > 0;
        const markup = `<div class="berceau-booking-options">${giftEnabled ? `<details class="berceau-gift-redeem" ${preferredGift ? 'open' : ''}><summary>Utiliser un bon cadeau</summary><label class="field"><span>Code du bon de démonstration</span><input name="berceauGiftCode" autocomplete="off" maxlength="40" value="${esc(preferredGift)}" placeholder="DEMO-…"></label><button type="button" class="btn secondary small" data-berceau="apply-gift">Appliquer le bon</button><div id="berceauGiftQuote" role="status"></div></details>` : ''}<details class="berceau-sms-choice"><summary>Recevoir un rappel SMS de démonstration</summary>${smsPhone}<label class="checkline"><input name="berceauSmsConsent" type="checkbox" ${remembered.smsConsent ? 'checked' : ''}> Je souhaite tester les rappels pratiques par SMS pour cette réservation. Aucun SMS réel ni message publicitaire.</label></details></div>`;
        const footer = form.querySelector('.modalfooter'), submit = form.querySelector('button[type="submit"]');
        (footer || submit)?.insertAdjacentHTML('beforebegin', markup);
        if (!state().settings.reminder || !local().reminderConfig.sms) form.querySelector('.berceau-sms-choice')?.remove();
        if (preferredGift && giftEnabled) applyGiftQuote(form);
      }
      function quoteHTML(item, quote) {
        return quote.ok ? `<div class="berceau-gift-breakdown"><p>Tarif de la prestation <strong>${euro(item.priceCents)}</strong></p><p>Bon cadeau <strong>− ${euro(quote.discountCents)}</strong></p><p>Reste à régler, simulé <strong>${euro(quote.dueCents)}</strong></p><p class="fine">Solde du bon après réservation : ${euro(quote.balanceAfterCents)}</p></div>` : `<p class="berceau-error">${esc(quote.reason)}</p>`;
      }
      function applyGiftQuote(form) {
        const item = bookingContext(form), code = form.elements.berceauGiftCode.value.trim().toUpperCase();
        form.elements.berceauGiftCode.value = code;
        const quote = tools.quoteGift(giftBy(code), item, new Date());
        form.querySelector('#berceauGiftQuote').innerHTML = quoteHTML(item, quote);
        const option = form.querySelector('select[name="payment"] option[value="simulated"]');
        if (option) option.textContent = 'Paiement en ligne simulé · ' + euro(quote.ok ? quote.dueCents : item.priceCents);
        return quote;
      }
      function beforeBooking(form) {
        const item = bookingContext(form); if (!item) return null;
        const data = Object.fromEntries(new FormData(form)), phone = tools.normalisePhone(data.berceauPhone || data.phone), smsConsent = !!data.berceauSmsConsent;
        if (smsConsent && !phone) return { error: 'Renseignez un numéro de test valide pour préparer les rappels SMS.' };
        const code = String(data.berceauGiftCode || '').trim().toUpperCase(), gift = code && giftBy(code);
        if (code) { const quote = tools.quoteGift(gift, item, new Date()); if (!quote.ok) { applyGiftQuote(form); return { error: quote.reason }; } }
        return { item, code, phone: (smsConsent || data.phone) ? phone : '', smsConsent, ids: new Set((item.kind === 'offer' ? state().v8.appointments : state().signups).map(r => r.id)), emailIds: new Set(state().v8.emails.map(r => r.id)), snapshot: code ? structuredClone(state()) : null };
      }
      function afterBooking(pending) {
        if (!pending) return;
        const rows = pending.item.kind === 'offer' ? state().v8.appointments : state().signups;
        const row = rows.find(r => !pending.ids.has(r.id)); if (!row) return;
        row.phone = pending.phone; row.smsConsent = pending.smsConsent;
        if (pending.code && row.status === 'confirmed') {
          const gift = giftBy(pending.code), quote = tools.quoteGift(gift, pending.item, new Date());
          if (!quote.ok) { deps.restoreState(pending.snapshot); deps.save(); deps.render(); deps.showModal('Réservation non enregistrée', '', `<p>${esc(quote.reason)}</p>`); return; }
          local().gifts = local().gifts.map(g => g.code === pending.code ? tools.redeemGift(g, pending.item, row.id, new Date()) : g);
          row.gift = { code: pending.code, amountCents: quote.discountCents, dueCents: quote.dueCents };
          for (const email of state().v8.emails.filter(e => !pending.emailIds.has(e.id) && !e.reminderKey)) email.body += `\nBon cadeau de démonstration : ${pending.code}. Montant utilisé : ${euro(quote.discountCents)}. Complément simulé : ${euro(quote.dueCents)}.`;
        }
        syncReminders(false);
        if (!deps.save()) {
          if (pending.snapshot) { deps.restoreState(pending.snapshot); deps.save(); deps.render(); deps.showModal('Réservation non enregistrée', '', '<p>Le stockage local est plein. Le bon n’a pas été débité. Libérez de l’espace avant de réessayer.</p>'); }
          return;
        }
        deps.render();
        if (row.status === 'confirmed') appendReceipt(row, pending.item.kind);
        preferredGift = ''; phoneDraft = { key: '', phone: '', smsConsent: false };
      }
      function entryFor(row, kind) {
        const record = kind === 'workshop' ? { ...state().events.find(e => e.id === row.eventId), id: row.id } : row;
        return tools.calendarEntry(record, kind, location.origin + '/?vue=parents');
      }
      function appendReceipt(row, kind) {
        const modal = document.querySelector('.modal'), entry = entryFor(row, kind); if (!modal || !entry) return;
        const jobCount = local().reminders.filter(r => r.reservationId === row.id && r.status === 'prepared').length;
        const html = `<section class="berceau-receipt">${row.gift ? `<h3>Votre bon cadeau</h3><p>${esc(row.gift.code)} · ${euro(row.gift.amountCents)} utilisés</p><p><strong>Complément simulé : ${euro(row.gift.dueCents)}</strong></p><p>Solde du bon : ${euro(giftBy(row.gift.code).balanceCents)}</p>` : ''}<h3>Retrouver ce rendez-vous</h3><div class="berceau-toolbar"><a class="btn secondary" href="${esc(tools.googleCalendarURL(entry))}" target="_blank" rel="noopener noreferrer">Ajouter à Google Agenda</a><button type="button" class="btn secondary" data-berceau="download-reservation" data-kind="${kind}" data-id="${esc(row.id)}">Télécharger pour mon agenda</button></div><p class="fine">L’ajout dans Google se valide dans votre agenda. Aucun événement n’est créé automatiquement.</p><p>${jobCount} rappel(s) email/SMS préparé(s) dans la démonstration. Aucun envoi réel.</p></section>`;
        const footer = modal.querySelector('.modalfooter'); if (footer) footer.insertAdjacentHTML('beforebegin', html); else modal.insertAdjacentHTML('beforeend', html);
      }
      function reminderPanel() {
        const cfg = local().reminderConfig;
        const labels = { prepared: 'Prévu, non envoyé', cancelled: 'Annulé', past: 'Échéance passée, non envoyé' };
        return `<section id="berceauReminders" class="card berceau-reminder-panel"><h2>Rappels email et SMS</h2><p>Choisis les canaux et les délais. Les rappels de cette démonstration restent préparés localement, sans envoi.</p><form id="berceauReminderSettings"><label class="checkline"><input name="enabled" type="checkbox" ${state().settings.reminder ? 'checked' : ''}> Préparer les rappels de réservation</label><fieldset class="berceau-checks"><legend>Canaux</legend><label class="checkline"><input name="email" type="checkbox" ${cfg.email ? 'checked' : ''}> Email pratique</label><label class="checkline"><input name="sms" type="checkbox" ${cfg.sms ? 'checked' : ''}> SMS si la famille l’a demandé</label></fieldset><div class="inputgrid">${field('Ateliers : heures avant (ex. 48, 24)', 'workshopHours', cfg.workshopHours.join(', '), 'text', 'required maxlength="60"')}${field('Individuel : heures avant (ex. 24, 2)', 'offerHours', cfg.offerHours.join(', '), 'text', 'required maxlength="60"')}</div><button type="submit" class="btn">Enregistrer les rappels</button></form><p class="fine">Les SMS nécessitent un numéro de test et un accord distinct. Une inscription à une newsletter ne vaut pas demande de SMS. Les annulations retirent les rappels futurs.</p><div class="berceau-reminder-list">${local().reminders.slice(0, 15).map(r => `<article><div><strong>${r.channel === 'sms' ? 'SMS' : 'Email'} · ${esc(r.title)}</strong><p>${dateTime(r.scheduledAt)} · ${esc(r.destination)}</p><span>${labels[r.status]}</span></div><button type="button" class="btn secondary small" data-berceau="reminder-preview" data-key="${esc(r.key)}">Aperçu</button></article>`).join('') || '<p>Aucun rappel à préparer sur les réservations actuelles. Les créneaux trop proches ou passés sont exclus.</p>'}</div></section>`;
      }
      function calendarEntries() {
        const now = Date.now();
        return [...state().events.map(e => tools.calendarEntry(e, 'workshop', location.origin + '/?vue=parents')), ...state().v8.appointments.filter(a => a.status === 'confirmed').map(a => tools.calendarEntry(a, 'offer', location.origin + '/?vue=parents'))].filter(e => e && e.start.getTime() >= now).sort((a, b) => a.start - b.start);
      }
      function calendarPanel() {
        return `<section id="berceauCalendar" class="card berceau-calendar-panel"><h2>Google Agenda</h2><p>Ajoute tes ateliers collectifs et rendez-vous individuels à ton agenda Google, ou télécharge-les dans un fichier compatible.</p><div class="berceau-toolbar"><button type="button" class="btn secondary" data-berceau="calendar-list">Ajouter à Google Agenda</button><button type="button" class="btn secondary" data-berceau="calendar-export">Exporter mon agenda (.ics)</button></div><p class="berceau-status">Synchronisation automatique non connectée.</p><p class="fine">L’ajout et l’import se valident dans ton agenda. Les événements Google ne bloquent pas encore les créneaux Naïtea. L’export ne contient pas les coordonnées des familles.</p></section>`;
      }
      function afterRender() {
        reconcileGifts(); syncReminders();
        const parent = document.querySelector('.v12-professional-page');
        if (parent && tools.giftSettings(local().giftConfig).enabled && !document.getElementById('berceauGifts')) document.getElementById('v8ParentAppointments')?.insertAdjacentHTML('afterend', giftBanner());
        if (deps.mode() === 'pro' && deps.page() === 'automations' && !document.getElementById('berceauReminders')) document.getElementById('app').insertAdjacentHTML('beforeend', reminderPanel());
        if (deps.mode() === 'pro' && deps.page() === 'rendezvous' && !document.getElementById('berceauCalendar')) document.getElementById('app').insertAdjacentHTML('afterbegin', calendarPanel());
        if (parent && new URLSearchParams(location.search).get('cadeau') === '1' && !openedGiftLink) { openedGiftLink = true; openPurchase(); }
        document.querySelectorAll('.v8-appointment').forEach(card => {
          const id = card.querySelector('[data-v8="cancel-appointment"]')?.dataset.id, row = state().v8.appointments.find(a => a.id === id);
          if (row?.gift && !card.querySelector('.berceau-gift-used')) card.insertAdjacentHTML('beforeend', `<p class="berceau-gift-used">Bon cadeau : ${euro(row.gift.amountCents)} · complément simulé : ${euro(row.gift.dueCents)}</p>`);
        });
      }
      function submit(form) {
        const data = Object.fromEntries(new FormData(form));
        if (form.id === 'berceauGiftSettings') {
          const amounts = String(data.amounts || '').split(',').map(s => Number(s.trim())), min = +data.min, max = +data.max;
          if (amounts.some(n => !Number.isFinite(n) || n < 5 || n > 1000) || min < 5 || max > 1000 || max < min || (!data.workshops && !data.offers)) { deps.toast('Vérifie les montants (5 à 1 000 €) et choisis au moins un type de prestation.'); return true; }
          local().giftConfig = tools.giftSettings({ ...data, amounts, min, max, enabled: !!data.enabled, custom: !!data.custom, workshops: !!data.workshops, offers: !!data.offers });
          if (deps.save()) { deps.render(); deps.toast('Offre de bons cadeaux enregistrée.'); } return true;
        }
        if (form.id === 'berceauBuyGift') {
          if (!data.consent) { deps.toast('Confirme le test avec des données fictives.'); return true; }
          const cfg = tools.giftSettings(local().giftConfig), valueCents = giftValue(), offerId = giftChoice.startsWith('offer:') ? giftChoice.slice(6) : '';
          if (giftChoice === 'custom' && (!cfg.custom || valueCents < cfg.min * 100 || valueCents > cfg.max * 100)) { deps.toast('Choisis un montant dans la plage proposée.'); return true; }
          const random = new Uint8Array(6); crypto.getRandomValues(random);
          let gift;
          try { gift = tools.issueGift({ ...data, code: 'DEMO-' + Array.from(random, b => b.toString(16).padStart(2, '0')).join('').toUpperCase(), valueCents, offerId, settings: cfg, now: new Date() }); }
          catch (error) { deps.toast(error.message); return true; }
          gift.offerTitle = state().offers.find(o => o.id === gift.offerId)?.title || '';
          gift.design = root.NaiteaPlatformTools.giftDesign(local().giftDesign, state().brand);
          gift.professional = [state().profile.first, state().profile.last].filter(Boolean).join(' ');
          gift.phone = data.phone || '';
          const previous = structuredClone(state()); local().gifts.unshift(gift);
          state().logs.unshift({ id: deps.uid(), type: 'gift', text: 'Nouveau bon cadeau de démonstration : ' + euro(gift.valueCents), date: 'À l’instant · paiement simulé' });
          state().v8.emails.unshift({ id: deps.uid(), to: gift.buyerEmail, subject: 'Votre bon cadeau Naïtea, démonstration', body: `Bon fictif pour ${gift.recipient}. Valeur : ${euro(gift.valueCents)}. Code : ${gift.code}. Valable jusqu’au ${new Date(gift.expiresAt).toLocaleDateString('fr-FR')}. Aucun paiement ni email réel. Ce code fonctionne uniquement dans le navigateur de démonstration qui l’a créé.`, date: new Date().toISOString(), status: 'Préparé, non envoyé' });
          if (!deps.save()) { deps.restoreState(previous); return true; }
          deps.render(); showGift(gift); return true;
        }
        if (form.id === 'berceauCheckGift') {
          const gift = giftBy(data.code); if (!gift) { document.getElementById('berceauGiftCheckStatus').textContent = 'Code inconnu sur cet appareil de démonstration.'; return true; }
          showGift(gift); return true;
        }
        if (form.id === 'berceauReminderSettings') {
          const hours = value => String(value || '').split(',').map(x => Number(x.trim())), workshopHours = hours(data.workshopHours), offerHours = hours(data.offerHours);
          if ([...workshopHours, ...offerHours].some(n => !Number.isFinite(n) || n <= 0 || n > 168) || (data.enabled && !data.email && !data.sms)) { deps.toast('Choisis un canal et des délais entre 1 et 168 heures.'); return true; }
          state().settings.reminder = !!data.enabled;
          local().reminderConfig = { email: !!data.email, sms: !!data.sms, workshopHours, offerHours };
          syncReminders(false); if (deps.save()) { deps.render(); deps.toast('Rappels de démonstration mis à jour. Aucun envoi réel.'); } return true;
        }
        return false;
      }
      document.addEventListener('input', event => {
        if (event.target.id === 'berceauGiftCustom') document.getElementById('berceauGiftTotal').textContent = Number.isFinite(giftValue()) ? euro(giftValue()) : 'Montant à préciser';
        if (event.target.name === 'berceauPhone' || (event.target.name === 'phone' && event.target.closest('#bookEvent'))) { const item = bookingContext(event.target.form); if (item) phoneDraft = { key: item.key, phone: event.target.value, smsConsent: !!event.target.form.elements.berceauSmsConsent?.checked }; }
      }, true);
      document.addEventListener('change', event => {
        if (event.target.name === 'berceauSmsConsent') { const item = bookingContext(event.target.form); if (item) phoneDraft = { key: item.key, phone: (event.target.form.elements.berceauPhone || event.target.form.elements.phone)?.value || '', smsConsent: event.target.checked }; }
        if (event.target.id === 'berceauGiftOffer' && event.target.value) { giftChoice = 'offer:' + event.target.value; document.querySelectorAll('[data-berceau="gift-choice"]').forEach(b => b.setAttribute('aria-pressed', 'false')); const custom = document.getElementById('berceauGiftCustomField'); if (custom) { custom.hidden = true; custom.querySelector('input').disabled = true; } document.getElementById('berceauGiftTotal').textContent = euro(giftValue()); }
      }, true);
      document.addEventListener('click', async event => {
        const booking = event.target.closest('[data-v8="book-appointment"],[data-action="book"]'); if (booking) phoneDraft = { key: '', phone: '', smsConsent: false };
        const button = event.target.closest('[data-berceau]'); if (!button) return;
        const action = button.dataset.berceau, code = button.dataset.code;
        if (action === 'buy-gift') return openPurchase();
        if (action === 'check-gift') return deps.showModal('Retrouver un bon cadeau', '', `<form id="berceauCheckGift">${field('Code du bon de démonstration', 'code', '', 'text', 'required maxlength="40"')}<button class="btn" type="submit">Voir le solde</button><p id="berceauGiftCheckStatus" class="fine" role="status">Le code doit avoir été créé sur cet appareil.</p></form>`);
        if (action === 'gift-detail') return showGift(giftBy(code));
        if (action === 'gift-choice') {
          giftChoice = button.dataset.value;
          document.querySelectorAll('[data-berceau="gift-choice"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === giftChoice)));
          const custom = document.getElementById('berceauGiftCustomField'); if (custom) { custom.hidden = giftChoice !== 'custom'; custom.querySelector('input').disabled = giftChoice !== 'custom'; }
          if (document.getElementById('berceauGiftOffer')) document.getElementById('berceauGiftOffer').value = '';
          document.getElementById('berceauGiftTotal').textContent = euro(giftValue()); return;
        }
        if (action === 'apply-gift') return applyGiftQuote(button.closest('form'));
        if (action === 'use-gift') { preferredGift = code; deps.closeModal(); const target = document.getElementById('v8ParentAppointments'); if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' }); else { deps.setParent(); document.getElementById('v8ParentAppointments')?.scrollIntoView({ block: 'start' }); } return; }
        if (action === 'download-gift') { button.disabled = true; try { await downloadGift(giftBy(code)); } catch { deps.toast('Le téléchargement est indisponible. Tu peux conserver le code affiché.'); } finally { button.disabled = false; } return; }
        if (action === 'copy-code' || action === 'copy-gift-link') {
          const value = action === 'copy-code' ? code : document.getElementById('berceauGiftLink').value;
          try { await navigator.clipboard.writeText(value); deps.toast('Copié.'); } catch { deps.showModal('Copier', '', `<label class="field"><span>Texte à copier</span><input readonly value="${esc(value)}" onclick="this.select()"></label>`); } return;
        }
        if (action === 'calendar-export') return deps.download('Naitea-agenda-demo.ics', tools.calendarICS(calendarEntries()), 'text/calendar;charset=utf-8');
        if (action === 'calendar-list') return deps.showModal('Ajouter dans Google Agenda', '', `<p>Choisis un événement puis valide son ajout dans Google. Aucune synchronisation automatique n’est active.</p><div class="berceau-calendar-list">${calendarEntries().map(e => `<a class="btn secondary" href="${esc(tools.googleCalendarURL(e))}" target="_blank" rel="noopener noreferrer">${esc(e.title)} · ${dateTime(e.start)}</a>`).join('') || '<p>Aucun événement futur à exporter.</p>'}</div>`);
        if (action === 'download-reservation') { const row = (button.dataset.kind === 'offer' ? state().v8.appointments : state().signups).find(r => r.id === button.dataset.id); if (row) deps.download('Naitea-rendez-vous-demo.ics', tools.calendarICS([entryFor(row, button.dataset.kind)]), 'text/calendar;charset=utf-8'); return; }
        if (action === 'reminder-preview') { const row = local().reminders.find(r => r.key === button.dataset.key); if (row) deps.showModal('Aperçu du rappel ' + (row.channel === 'sms' ? 'SMS' : 'email'), '', `<p>Prévu pour ${dateTime(row.scheduledAt)} · ${esc(row.destination)}</p><label class="field"><span>Texte de démonstration, non envoyé</span><textarea rows="5" readonly>${esc(row.body)}</textarea></label>`); }
      }, true);
      return { giftPage, openPurchase, afterRender, decorateBooking, beforeBooking, afterBooking, submit, syncReminders };
    },
  };
})(globalThis);
