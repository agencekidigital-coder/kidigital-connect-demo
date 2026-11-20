(function (root) {
  'use strict';
  root.NaiteaPlatform = {
    create(deps) {
      const T = root.NaiteaPlatformTools, B = root.BerceauTools, { esc, ic } = deps;
      const state = deps.getState;
      let bookingDraft = {}, draftKey = '', connection = { configured: false, connected: false }, googleReviews = [], selectedLocation = '', busy = false, workshopAI = false;
      const local = () => state().berceau;
      // Upgrade only unchanged stock offers from older local demos. User-defined modes stay intact.
      const seed = state().offers.find(o => o.id === 'o1' && o.title === 'Accompagnement post-partum' && o.description === 'Présence et soutien à domicile pour traverser les premières semaines sereinement.' && !o.modalities);
      if (seed) { seed.modalities = ['À domicile', 'En visio']; seed.modalityDetails = { home: { zone: state().profile.city, fees: { enabled: false } }, video: { platform: 'Google Meet' } }; }
      const portage = state().offers.find(o => o.id === 'o2' && o.title === 'Séance individuelle portage' && o.description === 'Un moment personnalisé pour trouver le portage qui convient à votre famille.' && !o.modalities);
      if (portage) { portage.modalities = ['En cabinet', 'En visio']; portage.modalityDetails = { office: { address: 'Adresse du cabinet à préciser avec la professionnelle' }, video: { platform: 'Zoom' } }; }
      const field = (label, name, value = '', extra = '') => `<label class="field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${extra}></label>`;
      const icon = (id, cls = '') => `<img class="naitea-pictogram ${cls}" src="/assets/berceau/transparent/${id}.png" alt="" loading="lazy" width="80" height="80">`;
      const button = (action, text, extra = '') => `<button class="btn secondary" type="button" data-platform="${action}" ${extra}>${text}</button>`;
      function eventForm(html, event) {
        const e = event || {}, box = document.createElement('div'); box.innerHTML = html;
        const form = box.querySelector('form'), category = form.elements.category;
        const known = Object.values(T.categories).flat(), custom = e.category && !known.includes(e.category);
        category.innerHTML = Object.entries(T.categories).map(([group, values]) => `<optgroup label="${esc(group)}">${values.map(v => `<option ${v === (e.category || 'Massage bébé') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</optgroup>`).join('') + `<option value="__custom" ${custom ? 'selected' : ''}>Ma propre catégorie</option>`;
        category.closest('.field').insertAdjacentHTML('afterend', field('Ta catégorie', 'customCategory', custom ? e.category : '', 'maxlength="100"'));
        const place = form.elements.place, address = e.venueAddress || {};
        place.type = 'hidden'; place.required = false; place.closest('.field').hidden = true;
        place.closest('.field').insertAdjacentHTML('afterend', `<fieldset class="naitea-workshop-location"><legend>Modalité et lieu</legend><div class="naitea-choice-row"><label><input name="workshopModality" type="radio" value="venue" ${e.workshopModality !== 'video' ? 'checked' : ''}> Dans un lieu</label><label><input name="workshopModality" type="radio" value="video" ${e.workshopModality === 'video' ? 'checked' : ''}> À distance</label></div><div data-workshop-venue>${field('Nom du lieu', 'venueName', e.venueName || (e.workshopModality !== 'video' ? e.place : ''), 'required maxlength="150" placeholder="Cabinet, maison des familles…"')}${field('Numéro et rue', 'venueStreet', address.street, 'required maxlength="200" autocomplete="street-address"')}<div class="inputgrid">${field('Code postal', 'venuePostalCode', address.postalCode, 'required maxlength="20"')}${field('Ville', 'venueCity', address.city, 'required maxlength="100"')}</div></div><div data-workshop-video><label class="field"><span>Outil de visioconférence</span><select name="videoPlatform">${['Zoom', 'Google Meet', 'Microsoft Teams', 'WhatsApp', 'Autre'].map(v => `<option ${v === (e.videoPlatform || 'Zoom') || v === 'Autre' && e.videoPlatform && !['Zoom', 'Google Meet', 'Microsoft Teams', 'WhatsApp'].includes(e.videoPlatform) ? 'selected' : ''}>${v}</option>`).join('')}</select></label>${field('Autre outil', 'videoOther', e.videoPlatform || '', 'maxlength="100"')}<p class="fine">Le lien privé de connexion se communique aux inscrits. N’ajoute pas de code d’accès dans la description publique.</p></div></fieldset><fieldset class="naitea-audiences"><legend>À qui s’adresse cet atelier ?</legend><div class="naitea-check-grid">${T.audiences.map(a => `<label><input type="checkbox" name="audiences" value="${a}" ${(e.targetAudiences || ['Jeunes parents', 'Bébés']).includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div><label class="checkline"><input type="checkbox" name="ageEnabled" ${e.childAge ? 'checked' : ''}> Préciser l’âge des enfants</label><div data-child-age class="inputgrid">${field('À partir de', 'minAge', e.childAge?.min ?? 0, 'type="number" min="0" max="216"')}${field('Jusqu’à', 'maxAge', e.childAge?.max ?? 12, 'type="number" min="0" max="216"')}<label class="field"><span>Unité</span><select name="ageUnit"><option value="months">Mois</option><option value="years" ${e.childAge?.unit === 'years' ? 'selected' : ''}>Ans</option></select></label></div></fieldset>`);
        const description = form.elements.description; description.maxLength = 5000; description.rows = 7;
        description.closest('.field').insertAdjacentHTML('afterend', `<div class="naitea-description-tools">${button('draft-description', 'M’aider à rédiger')}<p class="fine" id="naiteaDescriptionStatus" role="status">Une proposition selon le titre, à relire et personnaliser.</p></div>`);
        // The old demonstration SVG generator is no longer offered as a photo.
        form.querySelector('[data-action="v5-ai-cover"]')?.nextElementSibling?.remove(); form.querySelector('[data-action="v5-ai-cover"]')?.remove();
        return box.innerHTML;
      }
      function workshopFields() {
        const form = document.querySelector('#createEvent,#editEvent'); if (!form?.elements.workshopModality) return;
        const video = form.querySelector('[name="workshopModality"]:checked')?.value === 'video';
        for (const [selector, enabled] of [['[data-workshop-venue]', !video], ['[data-workshop-video]', video], ['[data-child-age]', form.elements.ageEnabled.checked]]) {
          const box = form.querySelector(selector); box.hidden = !enabled; box.querySelectorAll('input,select').forEach(n => n.disabled = !enabled);
        }
        const other = form.elements.videoOther.closest('label'), showOther = video && form.elements.videoPlatform.value === 'Autre'; other.hidden = !showOther; form.elements.videoOther.disabled = !showOther; form.elements.videoOther.required = showOther;
        const custom = form.elements.customCategory.closest('label'), showCustom = form.elements.category.value === '__custom'; custom.hidden = !showCustom; form.elements.customCategory.required = showCustom; form.elements.customCategory.disabled = !showCustom;
      }
      function bookingContext(form) {
        if (form.id === 'v8BookAppointment') { const offer = state().offers.find(o => o.id === deps.currentBooking().offerId); return offer && { key: 'offer:' + offer.id, offer, modes: T.modalities(offer).length ? T.modalities(offer) : ['En cabinet'] }; }
        if (form.id === 'bookEvent') { const event = state().events.find(e => e.id === form.elements.eventId.value); return event && { key: 'event:' + event.id, event, modes: [event.workshopModality === 'video' ? 'En visio' : 'Dans un lieu'] }; }
        return null;
      }
      function decorateBooking() {
        workshopFields();
        const form = document.querySelector('#v8BookAppointment,#bookEvent'); if (!form || form.dataset.naiteaBooking) return;
        const context = bookingContext(form); if (!context) return; form.dataset.naiteaBooking = '1';
        if (draftKey !== context.key) { draftKey = context.key; bookingDraft = {}; }
        const oldName = form.elements.namedItem('name');
        if (oldName?.type !== 'hidden') oldName?.closest('.field')?.remove();
        if (!form.elements.firstName) form.insertAdjacentHTML('afterbegin', `<div class="inputgrid">${field('Prénom (fictif)', 'firstName', bookingDraft.firstName, 'required maxlength="100" autocomplete="given-name"')}${field('Nom (fictif)', 'lastName', bookingDraft.lastName, 'required maxlength="100" autocomplete="family-name"')}</div>`);
        if (!form.elements.namedItem('name')) form.insertAdjacentHTML('beforeend', '<input type="hidden" name="name">');
        if (!form.elements.phone) form.elements.email.closest('.field').insertAdjacentHTML('afterend', field('Téléphone de test *', 'phone', bookingDraft.phone, 'type="tel" required maxlength="30" autocomplete="tel" placeholder="06 00 00 00 00 ou +33…"'));
        form.elements.phone.required = true; form.elements.phone.type = 'tel'; form.elements.phone.maxLength = 30;
        const phoneLabel = form.elements.phone.closest('.field')?.querySelector('label,span'); if (phoneLabel) phoneLabel.textContent = 'Téléphone de test *';
        form.querySelector('[name="berceauPhone"]')?.closest('.field')?.remove();
        const selected = context.modes.includes(bookingDraft.bookingModality) ? bookingDraft.bookingModality : context.modes[0];
        form.elements.email.closest('.field').insertAdjacentHTML('afterend', `<fieldset class="naitea-booking-modality"><legend>${context.event ? 'Votre atelier' : 'Choisissez la modalité'}</legend><div class="naitea-choice-row">${context.modes.map(m => `<label><input type="radio" name="bookingModality" value="${m}" ${selected === m ? 'checked' : ''} required>${m}</label>`).join('')}</div><div data-home-address>${field('Numéro et rue *', 'homeStreet', bookingDraft.homeStreet, 'maxlength="200" autocomplete="street-address"')}<div class="inputgrid">${field('Code postal *', 'homePostalCode', bookingDraft.homePostalCode, 'maxlength="20" autocomplete="postal-code"')}${field('Ville *', 'homeCity', bookingDraft.homeCity, 'maxlength="100" autocomplete="address-level2"')}</div>${field('Pays', 'homeCountry', bookingDraft.homeCountry || 'France', 'maxlength="80" autocomplete="country-name"')}<p class="fine">Cette adresse sert à organiser le déplacement. Elle ne figure pas sur la fiche publique ni dans les invitations aux autres familles.</p></div><p data-modality-detail class="fine"></p></fieldset>`);
        for (const [name, value] of Object.entries(bookingDraft)) { const input = form.elements.namedItem(name); if (input && typeof input.value === 'string' && !['hidden', 'radio', 'checkbox'].includes(input.type)) input.value = value; }
        if (form.elements.billingAddressOpposed && bookingDraft.billingAddressOpposed) { form.elements.billingAddressOpposed.checked = true; form.elements.billingAddressOpposed.dispatchEvent(new Event('change', { bubbles: true })); }
        const privacy = form.querySelector('.v9-privacy'); if (privacy) privacy.textContent = 'Vos coordonnées servent à organiser ce rendez-vous. L’adresse est demandée uniquement pour une séance à domicile. Utilisez des informations fictives dans cette démonstration, stockée sur cet appareil. Aucun renseignement de santé ni accord commercial n’est demandé.';
        modalityFields();
      }
      function modalityFields() {
        const form = document.querySelector('#v8BookAppointment,#bookEvent'); if (!form?.dataset.naiteaBooking) return;
        const context = bookingContext(form), selected = form.querySelector('[name="bookingModality"]:checked')?.value, home = form.querySelector('[data-home-address]');
        home.hidden = selected !== 'À domicile'; home.querySelectorAll('input').forEach(n => { n.disabled = home.hidden; n.required = !home.hidden && n.name !== 'homeCountry'; });
        const detail = context.offer?.modalityDetails || {};
        form.querySelector('[data-modality-detail]').textContent = context.event ? context.event.place : selected === 'En visio' ? 'Visioconférence : ' + (detail.video?.platform === 'Autre' ? detail.video.other : detail.video?.platform || 'outil précisé par la professionnelle') : selected === 'À domicile' ? [detail.home?.zone, detail.home?.fees?.enabled ? 'Des frais de déplacement peuvent s’appliquer ; montant à confirmer avec la professionnelle.' : ''].filter(Boolean).join(' · ') : selected === 'En cabinet' ? detail.office?.address || context.offer.location || 'Adresse précisée par la professionnelle.' : 'La professionnelle vous contactera au numéro indiqué.';
      }
      function before(form) {
        if (form.id === 'v12ContactForm') return { kind: 'contact', ids: new Set((state().v12?.messages || []).map(m => m.id)) };
        if (form.id === 'berceauBuyGift') {
          const first = form.elements.buyerFirstName.value.trim(), last = form.elements.buyerLastName.value.trim(), phone = B.normalisePhone(form.elements.phone.value);
          if (!first || !last || !phone) throw Error('Complétez le prénom, le nom et un téléphone de test valide.');
          form.elements.buyerName.value = first + ' ' + last; form.elements.phone.value = phone;
          return null;
        }
        if (['createEvent', 'editEvent'].includes(form.id)) {
          const data = Object.fromEntries(new FormData(form)); data.audiences = new FormData(form).getAll('audiences');
          const extra = T.workshop(data); form.elements.place.value = extra.place;
          // Base form understands a flat category value.
          if (data.category === '__custom') form.elements.category.add(new Option(extra.category, extra.category, true, true));
          return { kind: 'event', extra, id: data.eventId, ids: new Set(state().events.map(e => e.id)) };
        }
        const context = bookingContext(form); if (!context) return null;
        const data = Object.fromEntries(new FormData(form)), extra = T.booking(data, context.modes, B.normalisePhone);
        form.elements.namedItem('name').value = extra.name;
        return { kind: 'booking', context, extra, ids: new Set((context.offer ? state().v8.appointments : state().signups).map(r => r.id)), emails: new Set(state().v8.emails.map(e => e.id)) };
      }
      function after(pending) {
        if (!pending) return;
        if (pending.kind === 'contact') {
          const message = state().v12?.messages?.find(m => !pending.ids.has(m.id));
          if (message && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state().profile.email || '')) {
            state().v8.emails.unshift({ id: deps.uid(), to: state().profile.email, replyTo: message.email, subject: 'Demande depuis Naïtea (démonstration)', body: `Bonjour ${state().profile.first},\n\n${message.name} souhaite vous contacter.\n\n${message.message}\n\nRépondre à : ${message.email}\n\nMessage fictif, préparé mais non envoyé.`, date: new Date().toISOString(), status: 'Préparé, non envoyé', contactMessageId: message.id });
            deps.save(); document.getElementById('v12ContactStatus').textContent = 'Message fictif enregistré. Un email destiné à la professionnelle est préparé dans les automatisations, sans envoi réel.';
          }
          return;
        }
        if (pending.kind === 'event') {
          const event = state().events.find(e => e.id === pending.id || !pending.ids.has(e.id));
          if (event) { Object.assign(event, pending.extra); deps.save(); deps.render(); }
        } else if (pending.kind === 'booking') {
          const row = (pending.context.offer ? state().v8.appointments : state().signups).find(r => !pending.ids.has(r.id)); if (!row) return;
          Object.assign(row, pending.extra);
          const mode = row.modality + (row.homeAddress ? ' · ' + [row.homeAddress.street, row.homeAddress.postalCode, row.homeAddress.city].join(', ') : '');
          for (const email of state().v8.emails.filter(e => !pending.emails.has(e.id) && !e.reminderKey)) email.body += '\nModalité : ' + mode;
          deps.save(); document.querySelector('.modal')?.insertAdjacentHTML('beforeend', `<section class="naitea-booking-confirmation"><h3>Vos informations</h3><p>${esc(row.name)} · ${esc(row.phone)}</p><p>${esc(mode)}</p></section>`);
          bookingDraft = {}; draftKey = '';
        }
      }
      function giftDesignEditor() {
        const d = T.giftDesign(local().giftDesign, state().brand);
        return `<section class="card naitea-gift-design"><div class="naitea-section-title">${icon('prendre-soin-de-soi')}<h2>Personnaliser mes bons cadeaux</h2></div><div class="naitea-gift-editor-layout"><form id="naiteaGiftDesign"><fieldset><legend>Modèle de départ</legend><div class="naitea-gift-templates">${[['classic', 'Épuré'], ['arch', 'Arche'], ['photo', 'Avec une photo']].map(([id, name]) => `<label class="naitea-template ${id}"><input type="radio" name="template" value="${id}" ${d.template === id ? 'checked' : ''}><span>${name}</span></label>`).join('')}</div></fieldset>${field('Titre du bon', 'title', d.title, 'required maxlength="80"')}${field('Petit mot de présentation', 'subtitle', d.subtitle, 'maxlength="200"')}<div class="naitea-gift-colors">${[['accent', 'Accent'], ['background', 'Fond'], ['text', 'Texte']].map(([k, label]) => field(label, k, d[k], 'type="color"')).join('')}</div><div class="inputgrid"><label class="field"><span>Mon logo transparent</span><input type="file" data-gift-image="logo" accept="image/png,image/webp"></label><label class="field"><span>Ma photo</span><input type="file" data-gift-image="photo" accept="image/png,image/jpeg,image/webp"></label></div><div class="naitea-choice-row">${button('remove-gift-logo', 'Retirer le logo')}${button('remove-gift-photo', 'Retirer la photo')}</div><p class="fine">Utilise tes propres photos et éléments de marque, avec les autorisations nécessaires.</p><button type="submit" class="btn">Enregistrer mon modèle</button><p id="naiteaGiftDesignStatus" role="status" class="fine"></p></form><div><div id="naiteaGiftDesignPreview"></div><p class="fine">Exemple fictif. Le nom, la prestation, le montant et le code sont ajoutés à l’achat.</p></div></div></section>`;
      }
      function giftCard(gift, design) {
        const d = T.giftDesign(design || gift.design || local().giftDesign, state().brand);
        return `<article class="naitea-gift-art ${d.template}" style="--gift-accent:${d.accent};--gift-bg:${d.background};--gift-text:${d.text}">${d.photo && d.template === 'photo' ? `<img class="naitea-gift-photo" src="${esc(d.photo)}" alt="Photo choisie pour ce bon">` : ''}<div class="naitea-gift-art-content">${d.logo ? `<img class="naitea-gift-logo" src="${esc(d.logo)}" alt="${esc(state().brand.name)}">` : `<p class="naitea-gift-business">${esc(state().brand.name || 'Votre professionnelle')}</p>`}<h3>${esc(d.title)}</h3><p>${esc(d.subtitle)}</p><p>Pour ${esc(gift.recipient)}</p><strong class="naitea-gift-service">${esc(T.giftLabel(gift, state().offers))}</strong><strong class="naitea-gift-amount">${B.formatCents(gift.valueCents)}</strong>${gift.message ? `<p>${esc(gift.message)}</p>` : ''}<p class="naitea-gift-code">${esc(gift.code)}</p><p>À réserver auprès de ${esc(gift.professional || [state().profile.first, state().profile.last].join(' '))}<br>Valable jusqu’au ${new Date(gift.expiresAt).toLocaleDateString('fr-FR')}</p><p class="fine">Bon de démonstration, sans valeur réelle</p></div></article>`;
      }
      function readDesign() {
        const form = document.getElementById('naiteaGiftDesign');
        return T.giftDesign({ ...local().giftDesign, ...Object.fromEntries(new FormData(form)) }, state().brand);
      }
      function previewGift() { return { recipient: 'Camille', valueCents: 6000, code: 'DEMO-EXEMPLE', message: 'Un instant à partager ensemble.', offerTitle: state().offers[0]?.title || 'Accompagnement individuel', offerId: state().offers[0]?.id || 'exemple', expiresAt: B.expiresInMonths(new Date(), 12) }; }
      function updateGiftPreview() { const node = document.getElementById('naiteaGiftDesignPreview'); if (node) node.innerHTML = giftCard(previewGift(), readDesign()); }
      async function downloadGift(gift) {
        await document.fonts.load('600 52px "Naitea Titres"'); await document.fonts.load('400 30px "Source Sans 3"');
        const d = T.giftDesign(gift.design || local().giftDesign, state().brand), canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1100;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = d.background; ctx.fillRect(0, 0, 1600, 1100);
        const load = async src => { const im = new Image(); im.src = src; await im.decode(); return im; };
        let x = 95, width = 1410;
        if (d.template === 'photo' && d.photo) { const photo = await load(d.photo), scale = Math.max(560 / photo.width, 1100 / photo.height); ctx.save(); ctx.beginPath(); ctx.rect(1040, 0, 560, 1100); ctx.clip(); ctx.drawImage(photo, 1040 + (560 - photo.width * scale) / 2, (1100 - photo.height * scale) / 2, photo.width * scale, photo.height * scale); ctx.restore(); width = 860; }
        ctx.strokeStyle = d.accent; ctx.lineWidth = d.template === 'arch' ? 14 : 3; ctx.strokeRect(30, 30, 1540, 1040); ctx.fillStyle = d.text;
        if (d.logo) { const logo = await load(d.logo), scale = Math.min(320 / logo.width, 100 / logo.height); ctx.drawImage(logo, x, 70, logo.width * scale, logo.height * scale); } else { ctx.font = '600 34px "Source Sans 3"'; ctx.fillText(state().brand.name || 'Votre professionnelle', x, 125, width); }
        const wrap = (text, size, y, maxLines = 3, bold = false) => { ctx.font = `${bold ? 600 : 400} ${size}px "Source Sans 3"`; let line = '', count = 0; for (const word of String(text).split(/\s+/)) { const next = (line + ' ' + word).trim(); if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y, width); y += size * 1.25; line = word; if (++count >= maxLines - 1) break; } else line = next; } if (line) ctx.fillText(line, x, y, width); return y + size * 1.3; };
        ctx.font = '600 68px "Naitea Titres"'; ctx.fillText(d.title, x, 240, width);
        wrap(d.subtitle, 30, 295, 2); wrap('Pour ' + gift.recipient, 34, 385, 2, true);
        wrap(T.giftLabel(gift, state().offers), 37, 470, 3, true);
        ctx.fillStyle = d.accent; ctx.font = '600 78px "Source Sans 3"'; ctx.fillText(B.formatCents(gift.valueCents), x, 650, width); ctx.fillStyle = d.text;
        wrap(gift.message || '', 29, 715, 3);
        wrap(gift.code, 34, 865, 1, true);
        wrap('À réserver auprès de ' + (gift.professional || [state().profile.first, state().profile.last].join(' ')), 25, 920, 2);
        wrap('Valable jusqu’au ' + new Date(gift.expiresAt).toLocaleDateString('fr-FR'), 25, 985, 1);
        wrap('DÉMONSTRATION · Bon fictif utilisable dans ce navigateur uniquement.', 20, 1045, 1);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); deps.download('Naitea-bon-cadeau-demo.png', blob, 'image/png');
      }
      function giftURL(offerId = '') { const url = new URL('/', location.origin); url.searchParams.set('vue', 'parents'); url.searchParams.set('boutique-cadeaux', '1'); if (offerId) url.searchParams.set('offre', offerId); url.hash = 'cadeaux=' + T.encodeGift(state()); return url.href; }
      function embedPanel() {
        const url = giftURL();
        return `<section class="card naitea-gift-embed"><h2>Ajouter les bons cadeaux à mon site</h2><p>Intègre toute ta boutique ou une seule prestation. Le lien fonctionne aussi sur tes réseaux sociaux.</p><label class="field"><span>Contenu à partager</span><select id="naiteaGiftEmbedOffer"><option value="">Toute ma boutique de bons cadeaux</option>${state().offers.filter(o => o.price >= 5 && o.price <= 1000).map(o => `<option value="${esc(o.id)}">${esc(o.title)}</option>`).join('')}</select></label><label class="field"><span>URL à partager</span><input id="naiteaGiftURL" readonly value="${esc(url)}"></label>${button('copy-gift-url', 'Copier le lien')}<label class="field"><span>Code à coller dans un bloc HTML de ton site</span><textarea id="naiteaGiftIframe" readonly rows="4">${esc(iframe(url))}</textarea></label><div class="naitea-choice-row">${button('copy-gift-iframe', 'Copier le code iframe')}<a class="btn secondary" id="naiteaGiftPreviewLink" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Tester la boutique</a></div><p class="fine">Aperçu autonome de tes offres au moment de la copie. Après modification, recopie le lien. Achats, paiements et soldes restent simulés sur l’appareil qui les crée.</p></section>`;
      }
      function iframe(url) { return `<iframe src="${url}" title="Bons cadeaux" width="100%" height="900" style="border:0;border-radius:20px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`; }
      function giftShop() {
        const offerId = new URLSearchParams(location.search).get('offre'), cfg = B.giftSettings(local().giftConfig), offers = state().offers.filter(o => o.price >= 5 && o.price <= 1000 && (!offerId || o.id === offerId));
        return `<main class="naitea-gift-shop"><header>${icon('prendre-soin-de-soi')}<h1>Offrir un moment avec ${esc(state().profile.first || 'votre professionnelle')}</h1><p>Choisissez un accompagnement ou un montant à offrir.</p></header>${deps.demo}${cfg.enabled ? `<div class="naitea-gift-shop-grid">${cfg.offers ? offers.map(o => `<article class="card"><h2>${esc(o.title)}</h2><strong>${deps.money(o.price)}</strong><p>Un bon réservé à cet accompagnement.</p>${button('buy-specific-gift', 'Offrir cet accompagnement', `data-offer="${esc(o.id)}"`)}</article>`).join('') : ''}${!offerId ? `<article class="card"><h2>Un montant au choix</h2><p>${cfg.amounts.map(a => deps.money(a)).join(' · ')}${cfg.custom ? ' · ou un montant libre' : ''}</p><p>${cfg.offers && cfg.workshops ? 'Ateliers et accompagnements au choix.' : cfg.offers ? 'Accompagnements individuels au choix.' : 'Ateliers collectifs au choix.'}</p>${button('buy-generic-gift', 'Choisir mon bon cadeau')}</article>` : ''}</div>` : '<p>Les bons cadeaux ne sont pas proposés actuellement.</p>'}<p class="fine">Démonstration Naïtea. Aucun paiement ni email réel.</p></main>`;
      }
      function giftShopMode() { return new URLSearchParams(location.search).get('boutique-cadeaux') === '1'; }
      function importGiftShop() {
        if (!giftShopMode()) return;
        const token = new URLSearchParams(location.hash.slice(1)).get('cadeaux'), payload = T.decodeGift(token);
        if (token && !payload) { state().offers = []; local().giftConfig = { enabled: false }; return; }
        if (payload) { state().profile.first = payload.professional; state().profile.last = ''; state().brand.name = payload.business; state().offers = payload.offers; local().giftConfig = payload.config; local().giftDesign = payload.design; }
      }
      function decorateGift() {
        const card = document.querySelector('.berceau-gift-card');
        if (card) { const code = document.querySelector('[data-berceau="download-gift"]')?.dataset.code, gift = local().gifts.find(g => g.code === code); if (gift) card.outerHTML = giftCard(gift); }
        const purchase = document.getElementById('berceauBuyGift');
        if (purchase && !purchase.elements.buyerFirstName) {
          const original = purchase.elements.buyerName; original.type = 'hidden'; original.closest('.field').hidden = true;
          original.closest('.field').insertAdjacentHTML('afterend', field('Votre prénom (fictif)', 'buyerFirstName', '', 'required maxlength="100" autocomplete="given-name"') + field('Votre nom (fictif)', 'buyerLastName', '', 'required maxlength="100" autocomplete="family-name"'));
          purchase.elements.buyerEmail.closest('.field').insertAdjacentHTML('afterend', field('Téléphone de test *', 'phone', '', 'type="tel" required maxlength="30" autocomplete="tel"'));
        }
        if (purchase && !purchase.querySelector('.naitea-gift-selection')) purchase.querySelector('h3')?.insertAdjacentHTML('afterend', '<p class="naitea-gift-selection" role="status"></p>');
        giftSelection();
      }
      function giftSelection() {
        const select = document.getElementById('berceauGiftOffer'), status = document.querySelector('.naitea-gift-selection'); if (!status) return;
        const offer = state().offers.find(o => o.id === select?.value); status.textContent = offer ? 'Bon réservé à : ' + offer.title : T.giftLabel({ scope: B.giftSettings(local().giftConfig) });
      }
      function addPictograms() {
        const pageIcons = { dashboard: 'agenda', ateliers: 'atelier-collectif', offers: 'seance-individuelle', cadeaux: 'prendre-soin-de-soi', facturation: 'ressources', rendezvous: 'creneaux-disponibles', familles: 'suivi-des-familles', communication: 'ressources', personnaliser: 'profil-public', automations: 'automatisations', community: 'messagerie' };
        const h1 = document.querySelector('#app h1'); if (deps.mode() === 'pro' && h1 && !h1.querySelector('img')) h1.insertAdjacentHTML('afterbegin', icon(pageIcons[deps.page()] || 'profil-public', 'naitea-title-picto'));
        for (const [id, picto] of [['v12Presentation', 'profil-public'], ['v8ParentAppointments', 'seance-individuelle'], ['v8ParentWorkshops', 'atelier-collectif'], ['v12Practical', 'pres-de-chez-moi'], ['v12FAQ', 'ressources'], ['v12Contact', 'messagerie']]) {
          const heading = document.querySelector('#' + id + ' h2'); if (heading && !heading.querySelector('img')) heading.insertAdjacentHTML('afterbegin', icon(picto));
        }
        document.querySelectorAll('[data-v12-offer]').forEach(card => { if (card.querySelector('.naitea-offer-picto')) return; const title = card.querySelector('h3')?.textContent || ''; card.insertAdjacentHTML('afterbegin', icon(/sommeil/i.test(title) ? 'sommeil-de-bebe' : /portage/i.test(title) ? 'portage' : /massage|bain/i.test(title) ? 'massage-bebe' : 'seance-individuelle', 'naitea-offer-picto')); });
        document.querySelectorAll('.navbtn[data-nav]').forEach(a => { const id = pageIcons[a.dataset.nav] || (a.dataset.nav === 'communaute' ? 'messagerie' : ''); if (id && a.closest('.sidebar') && !a.querySelector('.naitea-nav-picto')) { a.querySelector('svg')?.remove(); a.insertAdjacentHTML('afterbegin', icon(id, 'naitea-nav-picto')); } });
        document.querySelectorAll('.eventcard').forEach(card => {
          if (card.querySelector('.naitea-workshop-meta')) return;
          const id = card.querySelector('[data-action="book"],[data-action="v5-edit"]')?.dataset.id, e = state().events.find(x => x.id === id); if (!e) return;
          const text = [...(e.targetAudiences || []), T.ageLabel(e.childAge), e.workshopModality === 'video' ? 'En visio · ' + e.videoPlatform : ''].filter(Boolean);
          (card.querySelector('.eventcontent') || card).insertAdjacentHTML('beforeend', `<p class="naitea-workshop-meta">${esc(text.join(' · '))}</p>`);
        });
      }
      function chatPanel() {
        const parent = document.querySelector('.v12-professional-page'); if (!parent || local().chatEnabled === false || document.getElementById('naiteaChatLauncher')) return;
        parent.insertAdjacentHTML('beforeend', `<button type="button" id="naiteaChatLauncher" data-platform="toggle-chat" aria-expanded="false" aria-controls="naiteaChat">${icon('messagerie')}<span>Une question ?</span></button><section id="naiteaChat" hidden aria-label="Assistant de la fiche professionnelle"><header><h2>Une question sur cette fiche ?</h2><button type="button" data-platform="toggle-chat" aria-label="Fermer la discussion">×</button></header><p class="fine">Assistant automatique de démonstration. Informations de cette fiche uniquement, sans conseil médical. Aucun message transmis à la professionnelle.</p><div id="naiteaChatMessages" aria-live="polite"><p class="naitea-chat-answer">Bonjour ! Je peux vous aider à trouver un atelier, un accompagnement ou une information pratique.</p></div><div class="naitea-chat-prompts">${['Les accompagnements', 'Les ateliers', 'Les bons cadeaux'].map(v => button('chat-prompt', v, `data-question="${v}"`)).join('')}</div><form id="naiteaChatForm"><label class="field"><span>Votre question (sans information personnelle)</span><input name="question" required maxlength="400" autocomplete="off"></label><button class="btn" type="submit">Envoyer</button></form></section>`);
      }
      function answerChat(question) {
        const messages = document.getElementById('naiteaChatMessages');
        if (messages.children.length > 16) messages.firstElementChild.remove();
        messages.insertAdjacentHTML('beforeend', `<p class="naitea-chat-question">${esc(question)}</p><p class="naitea-chat-answer">${esc(T.chatAnswer(question, state()))}</p>`); messages.scrollTop = messages.scrollHeight;
      }
      function afterRender() {
        addPictograms(); chatPanel();
        // Put working hours before the rest of the public-profile content editor.
        const hours = document.querySelector('.v11-opening-hours'), details = document.querySelector('.v12-profile-editor'); if (hours && details) details.before(hours);
        if (details && !document.getElementById('naiteaPublicContactSettings')) details.insertAdjacentHTML('afterend', `<section id="naiteaPublicContactSettings" class="card"><div class="naitea-section-title">${icon('messagerie')}<h2>Les échanges sur ma fiche</h2></div><form id="naiteaChatSettings"><label class="checkline"><input type="checkbox" name="enabled" ${local().chatEnabled !== false ? 'checked' : ''}> Afficher l’assistant d’informations sur ma fiche</label><p class="fine">L’assistant répond sur tes offres et informations pratiques. Il ne donne pas de conseil médical. Les questions restent dans la page, sans enregistrement.</p><p>Les demandes de contact préparent un email à ton adresse professionnelle ; une copie du message de démonstration reste accessible dans ton profil.</p><button type="submit" class="btn secondary">Enregistrer</button></form></section>`);
        document.querySelector('.v11-google-help')?.remove();
        const google = document.querySelector('.v10-google-connect'); if (google && !google.querySelector('#naiteaGoogleConnection')) { google.innerHTML = googleConnectionHTML(); paintGoogleStatus(); }
        const manualReply = document.querySelector('#berceauReviewAssistant'); if (manualReply && !manualReply.dataset.secondary) { manualReply.dataset.secondary = '1'; const heading = manualReply.querySelector('h2'); if (heading) heading.textContent = 'Brouillons et avis de démonstration'; manualReply.querySelectorAll('p').forEach(p => p.remove()); manualReply.insertAdjacentHTML('afterbegin', '<p class="fine">Pour les avis réels de ton établissement, utilise la connexion Google ci-dessus. Tu peux aussi préparer un brouillon à partir d’un exemple fictif.</p>'); }
        if (deps.mode() === 'pro' && deps.page() === 'cadeaux' && !document.getElementById('naiteaGiftDesign')) { document.querySelector('.berceau-gift-list')?.insertAdjacentHTML('beforebegin', giftDesignEditor() + embedPanel()); updateGiftPreview(); }
        const oldGiftLink = document.getElementById('berceauGiftLink'); if (oldGiftLink) { const label = oldGiftLink.closest('label'); label?.nextElementSibling?.remove(); const note = label?.nextElementSibling; if (note?.classList.contains('fine')) note.textContent = 'Retrouve les liens et les codes iframe dans « Ajouter les bons cadeaux à mon site » ci-dessous.'; label?.remove(); }
        const calendar = document.getElementById('berceauCalendar'); if (calendar && !calendar.querySelector('[data-platform="calendar-manage"]')) calendar.insertAdjacentHTML('beforeend', `<hr><h3>Inscrits dans mon agenda</h3><p>Prépare une liste privée pour chaque atelier. Les invitations aux familles se choisissent séparément.</p>${button('calendar-manage', 'Gérer les ateliers et les inscrits')}`);
        document.querySelectorAll('.v8-appointment').forEach(card => {
          const id = card.querySelector('[data-v8="cancel-appointment"]')?.dataset.id, row = state().v8.appointments.find(a => a.id === id);
          if (!row?.modality || card.querySelector('.naitea-private-booking')) return;
          card.insertAdjacentHTML('beforeend', `<details class="naitea-private-booking"><summary>Modalité et coordonnées</summary><p>${esc(row.name)}<br>${esc(row.email)}<br>${esc(row.phone || '')}</p><p>${esc(row.modality)}${row.homeAddress ? '<br>' + esc([row.homeAddress.street, row.homeAddress.postalCode, row.homeAddress.city, row.homeAddress.country].filter(Boolean).join(', ')) : ''}</p></details>`);
        });
        const contact = document.getElementById('v12ContactForm'); if (contact && !contact.dataset.naiteaContact) { contact.dataset.naiteaContact = '1'; const email = String(state().profile.email || ''); const intro = contact.previousElementSibling; if (intro?.tagName === 'P') intro.textContent = 'Votre message de démonstration prépare un email pour la professionnelle. Aucun envoi réel dans cet aperçu.'; if (email) contact.insertAdjacentHTML('beforeend', `<button type="button" class="btn secondary" data-platform="contact-email">Préparer l’email à la professionnelle</button>`); }
        decorateBooking();
      }
      async function api(action, body) {
        const token = await deps.getAccessToken(), response = await fetch('/api/google?action=' + action, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const result = await response.json(); if (!response.ok) throw Error(result.error || 'Connexion Google indisponible.'); return result;
      }
      function googleConnectionHTML() { return `<div id="naiteaGoogleConnection"><h2>Ma fiche Google et mes avis</h2><p>Relie ton établissement pour récupérer sa note et les avis sans réponse, puis publier tes réponses après relecture.</p><p id="naiteaGoogleStatus" role="status" class="fine"></p><div class="naitea-choice-row">${button('connect-google', 'Connecter mon compte Google')}${button('load-google-reviews', 'Voir les avis sans réponse')}${button('disconnect-google', 'Déconnecter', 'hidden')}</div><div id="naiteaGoogleLocations"></div><div id="naiteaGoogleReviews"></div></div>`; }
      function paintGoogleStatus(message = '') {
        const status = document.getElementById('naiteaGoogleStatus'); if (!status) return;
        status.textContent = message || (connection.connected ? 'Compte Google relié. Choisis ton établissement pour consulter ses avis.' : connection.configured ? 'Connexion prête. Autorise l’accès à la fiche que tu gères.' : 'La connexion Google de Naïtea n’est pas encore activée. Les données de démonstration restent séparées de tes avis réels.');
        const b = document.querySelector('[data-platform="disconnect-google"]'); if (b) b.hidden = !connection.connected;
      }
      async function loadLocations() {
        const result = await api('locations');
        document.getElementById('naiteaGoogleLocations').innerHTML = `<label class="field"><span>Ton établissement</span><select id="naiteaGoogleLocation"><option value="">Choisir l’établissement</option>${result.locations.map(l => `<option value="${esc(l.name)}" ${l.name === selectedLocation ? 'selected' : ''}>${esc(l.title)} · ${esc(l.address || '')}</option>`).join('')}</select></label>`;
      }
      async function loadReviews() {
        if (!connection.connected) { paintGoogleStatus(connection.configured ? 'Connecte d’abord le compte qui gère ta fiche.' : 'Les autorisations Google Business doivent être activées pour Naïtea avant de relier ta fiche.'); return; }
        if (!selectedLocation && !document.getElementById('naiteaGoogleLocation') && document.getElementById('naiteaGoogleLocations')) await loadLocations();
        selectedLocation = document.getElementById('naiteaGoogleLocation')?.value || selectedLocation;
        if (!selectedLocation) return paintGoogleStatus('Choisis ton établissement puis actualise les avis.');
        const result = await api('reviews', { location: selectedLocation }); googleReviews = result.reviews;
        local().googleLocation = selectedLocation;
        const previous = local().googleReviewIds, ids = googleReviews.map(r => r.id);
        if (previous && ids.some(id => !previous.includes(id))) state().logs.unshift({ id: deps.uid(), type: 'star', text: 'De nouveaux avis Google attendent une réponse.', date: 'À l’instant · Google Business Profile' });
        local().googleReviewIds = ids;
        deps.setGoogleSummary(result);
        const inbox = document.getElementById('naiteaGoogleReviews');
        if (inbox) inbox.innerHTML = `<div class="naitea-review-summary"><strong>${Number(result.averageRating || 0).toFixed(1)}/5</strong><span> · ${result.totalReviewCount} avis Google</span></div><h3>${googleReviews.length} avis sans réponse</h3>${googleReviews.map((r, n) => `<article class="naitea-google-review"><p>${'★'.repeat(r.rating)} · ${esc(r.author || 'Client Google')}</p><p class="naitea-review-text">${esc(r.comment || 'Avis sans commentaire')}</p><label class="field"><span>Ta réponse publique</span><textarea id="naiteaGoogleReply${n}" rows="4" maxlength="4000"></textarea></label><div class="naitea-choice-row">${button('draft-google-reply', 'Préparer une réponse', `data-index="${n}"`)}${button('publish-google-reply', 'Publier sur Google', `data-index="${n}"`)}</div><p class="fine" role="status" id="naiteaGoogleReplyStatus${n}"></p></article>`).join('') || '<p>Tous les avis récupérés ont déjà une réponse.</p>'}`;
        paintGoogleStatus('Avis actualisés depuis ton établissement Google. Une validation est demandée avant chaque publication.');
      }
      function calendarManage() {
        const options = state().events.map(e => `<option value="${esc(e.id)}">${esc(e.title)} · ${esc(e.date)}</option>`).join('');
        deps.showModal('Mon atelier dans Google Agenda', '', `<form id="naiteaCalendarForm"><label class="field"><span>Atelier</span><select name="eventId">${options}</select></label><label class="checkline"><input type="checkbox" name="includeRoster" checked> Ajouter les noms et emails des inscrits dans la description privée de mon événement</label><label class="checkline"><input type="checkbox" name="inviteAttendees"> Envoyer une invitation Google aux inscrits (emails réels, à confirmer)</label><p class="fine">Les invités ne voient pas les autres invités. Les adresses personnelles et numéros de téléphone ne sont jamais exportés.</p><div id="naiteaCalendarPreview"></div><div class="naitea-choice-row">${button('calendar-preview', 'Voir la liste et l’aperçu')}${button('calendar-ics', 'Télécharger pour mon agenda privé')}<button class="btn" type="submit">Mettre à jour dans Google Agenda</button></div><p id="naiteaCalendarStatus" role="status" class="fine">${connection.connected ? 'Compte Google relié.' : 'La mise à jour directe demande une connexion Google autorisée. Le téléchargement reste disponible.'}</p></form>`);
        calendarPreview();
      }
      function calendarDraft() {
        const form = document.getElementById('naiteaCalendarForm'), event = state().events.find(e => e.id === form.elements.eventId.value); if (!event) throw Error('Choisis un atelier.');
        return { form, event, payload: T.calendarPayload(event, state().signups, { includeRoster: form.elements.includeRoster.checked, inviteAttendees: form.elements.inviteAttendees.checked }, B) };
      }
      function calendarPreview() { const { event, payload } = calendarDraft(); document.getElementById('naiteaCalendarPreview').innerHTML = `<h3>${esc(event.title)}</h3><pre>${esc(payload.description)}</pre><p class="fine">${payload.attendees?.length || 0} invitation(s) demandée(s). Aucun envoi avant confirmation.</p>`; }
      async function submit(form) {
        // Only handled forms return true; callers must await this method.
        if (form.id === 'naiteaGiftDesign') { local().giftDesign = readDesign(); if (deps.save()) { document.getElementById('naiteaGiftDesignStatus').textContent = 'Modèle enregistré pour les prochains bons.'; updateGiftPreview(); } return true; }
        if (form.id === 'naiteaChatForm') { const q = form.elements.question.value.trim(); if (q) { answerChat(q); form.reset(); } return true; }
        if (form.id === 'naiteaChatSettings') { local().chatEnabled = form.elements.enabled.checked; if (deps.save()) { deps.render(); deps.toast('Affichage de l’assistant enregistré.'); } return true; }
        if (form.id === 'naiteaGooglePublish') {
          const index = +form.elements.reviewIndex.value, review = googleReviews[index], reply = form.elements.reply.value.trim();
          if (!form.elements.confirm.checked || !review || !reply) return true;
          const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
          try { await api('reply', { location: selectedLocation, review: review.id, reply, confirmed: true }); deps.closeModal(); await loadReviews(); deps.toast('Réponse publiée sur Google.'); } catch (e) { form.querySelector('[role="status"]').textContent = e.message; } finally { submit.disabled = false; } return true;
        }
        if (form.id === 'naiteaCalendarForm') {
          const { event, payload } = calendarDraft(), status = document.getElementById('naiteaCalendarStatus');
          if (!connection.connected) { status.textContent = 'Relie Google depuis Personnaliser mon profil pour activer la mise à jour directe.'; return true; }
          if (payload.attendees?.length && !form.elements.confirmInvites?.checked) { status.innerHTML = '<label class="checkline"><input name="confirmInvites" type="checkbox" required> Je confirme l’envoi de ces invitations réelles aux inscrits.</label>'; return true; }
          try { const result = await api('calendar', { eventId: event.id, googleEventId: local().googleEvents?.[event.id] || '', payload, sendInvites: !!payload.attendees?.length, confirmed: true }); local().googleEvents ||= {}; local().googleEvents[event.id] = result.id; deps.save(); status.textContent = 'Événement mis à jour dans Google Agenda. Actualise à nouveau après de nouvelles inscriptions.'; } catch (e) { status.textContent = e.message; } return true;
        }
        return false;
      }
      async function draftDescription(b) {
        const form = b.closest('form'), title = form.elements.title.value, audiences = new FormData(form).getAll('audiences');
        let text = T.description({ title, audiences }), source = 'Proposition locale de démonstration, sans appel à une IA distante.';
        if (workshopAI) {
          b.disabled = true;
          try {
            const token = await deps.getAccessToken(); if (!token) throw Error('Connecte-toi pour utiliser l’IA.');
            const r = await fetch('/api/workshop-description', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ title, audiences, consent: true }) });
            const result = await r.json(); if (!r.ok) throw Error(result.error || 'IA indisponible.'); text = result.text; source = 'Proposition IA, à relire et personnaliser.';
          } finally { b.disabled = false; }
        }
        const area = form.elements.description;
        if (area.value.trim()) {
          const preview = document.createElement('div'); preview.innerHTML = `<label class="field"><span>Proposition à relire</span><textarea rows="12" readonly>${esc(text)}</textarea></label>${button('use-description', 'Utiliser cette proposition')}<p class="fine">${source} Ton texte actuel reste conservé jusqu’à validation.</p>`;
          form.querySelector('.naitea-description-proposal')?.remove(); preview.className = 'naitea-description-proposal'; preview.dataset.text = text; b.closest('.naitea-description-tools').after(preview);
        } else { area.value = text; document.getElementById('naiteaDescriptionStatus').textContent = source; }
      }
      document.addEventListener('input', event => {
        const form = event.target.form;
        if (form && ['v8BookAppointment', 'bookEvent'].includes(form.id) && event.target.name) { const context = bookingContext(form); if (context) { draftKey = context.key; bookingDraft = { ...bookingDraft, ...Object.fromEntries(new FormData(form)) }; } }
        if (event.target.closest('#naiteaGiftDesign') && !event.target.matches('[type="file"]')) updateGiftPreview();
      }, true);
      document.addEventListener('change', async event => {
        if (event.target.closest('#createEvent,#editEvent')) workshopFields();
        if (event.target.name === 'bookingModality') { modalityFields(); const form = event.target.form; bookingDraft = { ...bookingDraft, ...Object.fromEntries(new FormData(form)) }; }
        if (event.target.id === 'berceauGiftOffer') giftSelection();
        if (event.target.id === 'naiteaGiftEmbedOffer') { const url = giftURL(event.target.value); document.getElementById('naiteaGiftURL').value = url; document.getElementById('naiteaGiftIframe').value = iframe(url); document.getElementById('naiteaGiftPreviewLink').href = url; }
        if (event.target.id === 'naiteaGoogleLocation') selectedLocation = event.target.value;
        if (event.target.closest('#naiteaCalendarForm')) {
          const form = event.target.form;
          if (event.target.name === 'inviteAttendees' && event.target.checked) form.elements.includeRoster.checked = false;
          if (event.target.name === 'includeRoster' && event.target.checked) form.elements.inviteAttendees.checked = false;
          calendarPreview();
        }
        const type = event.target.dataset.giftImage;
        if (type) { const file = event.target.files?.[0]; if (!file) return; try { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Utilise un PNG, JPEG ou WebP.'); const image = await deps.loadImage(file, 1000); local().giftDesign = { ...readDesign(), [type]: image }; updateGiftPreview(); } catch (e) { deps.toast(e.message); } event.target.value = ''; }
      }, true);
      document.addEventListener('click', async event => {
        const deletedMessage = event.target.closest('[data-v12="remove-message"]');
        if (deletedMessage) { state().v8.emails = state().v8.emails.filter(e => e.contactMessageId !== deletedMessage.dataset.id); deps.save(); }
        const b = event.target.closest('[data-platform]'); if (!b) return;
        const action = b.dataset.platform; event.preventDefault();
        try {
          if (action === 'draft-description') return await draftDescription(b);
          if (action === 'use-description') { const form = b.closest('form'); form.elements.description.value = b.closest('.naitea-description-proposal').dataset.text; b.closest('.naitea-description-proposal').remove(); return; }
          if (action === 'remove-gift-logo' || action === 'remove-gift-photo') { const key = action.endsWith('logo') ? 'logo' : 'photo'; local().giftDesign = { ...readDesign(), [key]: '' }; updateGiftPreview(); return; }
          if (action === 'copy-gift-url' || action === 'copy-gift-iframe') { const input = document.getElementById(action.endsWith('url') ? 'naiteaGiftURL' : 'naiteaGiftIframe'); try { await navigator.clipboard.writeText(input.value); deps.toast('Copié.'); } catch { input.focus(); input.select(); deps.toast('Texte sélectionné. Utilise Ctrl ou Cmd C.'); } return; }
          if (action === 'buy-specific-gift' || action === 'buy-generic-gift') { deps.openGift(); if (action === 'buy-specific-gift') { const select = document.getElementById('berceauGiftOffer'); select.value = b.dataset.offer; select.dispatchEvent(new Event('change', { bubbles: true })); } return; }
          if (action === 'toggle-chat') { const panel = document.getElementById('naiteaChat'), launcher = document.getElementById('naiteaChatLauncher'); panel.hidden = !panel.hidden; launcher.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) panel.querySelector('input').focus(); return; }
          if (action === 'chat-prompt') return answerChat(b.dataset.question);
          if (action === 'contact-email') { const form = document.getElementById('v12ContactForm'), data = Object.fromEntries(new FormData(form)), email = state().profile.email; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) throw Error('L’adresse email de la professionnelle n’est pas renseignée.'); if (!data.message?.trim() || !data.name?.trim() || !data.email?.trim()) throw Error('Complétez votre prénom, votre email et votre question.'); location.href = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Question depuis Naïtea') + '&body=' + encodeURIComponent(`Bonjour ${state().profile.first || ''},\n\n${data.message.slice(0, 1500)}\n\n${data.name}\n${data.email}\n\nMessage préparé depuis l’aperçu Naïtea. Vérifiez les données avant envoi.`); return; }
          if (action === 'connect-google') { b.disabled = true; const result = await api('start'); location.assign(result.url); return; }
          if (action === 'disconnect-google') { await api('disconnect', {}); connection.connected = false; googleReviews = []; document.getElementById('naiteaGoogleReviews').innerHTML = ''; document.getElementById('naiteaGoogleLocations').innerHTML = ''; paintGoogleStatus(); return; }
          if (action === 'load-google-reviews') { if (busy) return; busy = true; b.disabled = true; await loadReviews(); return; }
          if (action === 'draft-google-reply') { const r = googleReviews[+b.dataset.index]; document.getElementById('naiteaGoogleReply' + b.dataset.index).value = B.localReviewReply({ rating: r.rating }); document.getElementById('naiteaGoogleReplyStatus' + b.dataset.index).textContent = 'Base de réponse locale à personnaliser. Aucun texte envoyé à une IA ni publié.'; return; }
          if (action === 'publish-google-reply') { const i = +b.dataset.index, r = googleReviews[i], reply = document.getElementById('naiteaGoogleReply' + i).value.trim(); if (!reply) throw Error('Prépare et relis ta réponse avant publication.'); deps.showModal('Publier cette réponse sur Google ?', '', `<form id="naiteaGooglePublish"><input type="hidden" name="reviewIndex" value="${i}"><p>${esc(r.comment || 'Avis sans commentaire')}</p><label class="field"><span>Réponse publique</span><textarea name="reply" rows="6" required maxlength="4000">${esc(reply)}</textarea></label><label class="checkline"><input name="confirm" type="checkbox" required> J’ai relu ce texte. Je confirme sa publication réelle sur ma fiche Google.</label><button class="btn" type="submit">Publier la réponse</button><p role="status" class="fine"></p></form>`); return; }
          if (action === 'calendar-manage') return calendarManage();
          if (action === 'calendar-preview') return calendarPreview();
          if (action === 'calendar-ics') { const { event, payload } = calendarDraft(), entry = B.calendarEntry(event, 'workshop'); entry.description = payload.description; const content = B.calendarICS([entry]).replace('BEGIN:VEVENT\r\n', 'BEGIN:VEVENT\r\nCLASS:PRIVATE\r\n'); deps.download('Naitea-atelier-inscrits-prive.ics', content, 'text/calendar;charset=utf-8'); return; }
        } catch (e) { if (action.includes('google')) paintGoogleStatus(e.message); else deps.toast(e.message || 'Cette action est indisponible.'); }
        finally { busy = false; b.disabled = false; }
      }, true);
      fetch('/api/google?action=status', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(r => { if (r) { connection = r; paintGoogleStatus(); } }).catch(() => {});
      fetch('/api/workshop-description', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(r => { workshopAI = r?.configured === true; }).catch(() => {});
      selectedLocation = local().googleLocation || '';
      // Poll only while this view is open. No claim of unattended background delivery.
      setInterval(() => { if (connection.connected && selectedLocation && !document.hidden && deps.mode() === 'pro' && !busy) { busy = true; loadReviews().catch(e => paintGoogleStatus(e.message)).finally(() => busy = false); } }, 300000);
      importGiftShop();
      return { eventForm, decorateBooking, decorateGift, before, after, afterRender, submit, giftShopMode, giftShop, giftCard, downloadGift, icon };
    },
  };
})(globalThis);
