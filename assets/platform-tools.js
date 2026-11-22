/* Shared, deterministic helpers. No network or private data in public gift links. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NaiteaPlatformTools = api;
})(globalThis, function () {
  'use strict';
  const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
  const key = v => clean(v, 4000).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Researched provider catalogues and sources are recorded in docs/naitea-workshop-research.md.
  const categories = {
    'Grossesse et naissance': ['Préparation à la naissance', 'Danse prénatale', 'Chant prénatal', 'Yoga prénatal', 'Relaxation prénatale', 'Respiration et naissance', 'Sophrologie prénatale', 'Lien avec bébé pendant la grossesse', 'Préparer le post-partum', 'Place du co-parent', 'Allaitement : se préparer', 'Projet de naissance'],
    'Premiers mois avec bébé': ['Massage bébé', 'Bain enveloppé', 'Portage physiologique', 'Sommeil de bébé', 'Allaitement et soutien', 'Alimentation au biberon', 'Diversification alimentaire', 'Diversification menée par l’enfant', 'Soins du nouveau-né', 'Gestes de premiers secours pédiatriques', 'Comprendre les pleurs du bébé', 'Retour à la maison'],
    'Éveil et activités ensemble': ['Éveil sensoriel', 'Éveil musical', 'Chanter avec bébé', 'Bébé signe', 'Motricité libre', 'Yoga parent-bébé', 'Danse avec bébé', 'Lecture et comptines', 'Jeux parent-enfant', 'Créativité parent-enfant', 'Éveil nature', 'Yoga enfants', 'Relaxation enfants'],
    'Cercles et rencontres': ['Cercle futures mamans', 'Cercle jeunes mamans', 'Cercle jeunes parents', 'Cercle futurs parents', 'Cercle de pères et co-parents', 'Rencontre allaitement', 'Café des parents', 'Cercle de femmes', 'Rencontre familles monoparentales', 'Rencontre familles LGBTQIA+', 'Groupe de soutien au parcours PMA', 'Groupe de soutien au deuil périnatal'],
    'Parentalité et vie de famille': ['Communication parent-enfant', 'Accompagner les émotions', 'Fratrie et arrivée d’un bébé', 'Charge mentale et organisation familiale', 'Couple et parentalité', 'Parentalité et adolescence', 'Écrans et vie de famille', 'Limites et coopération', 'Continence et autonomie', 'Séparation et adaptation', 'Parentalité et handicap', 'Parents d’enfants à besoins particuliers'],
    'Bien-être des parents': ['Yoga postnatal', 'Danse postnatale', 'Relaxation parentale', 'Respiration et détente', 'Soutien au post-partum', 'Auto-massage et détente', 'Temps pour soi', 'Reprise du travail et allaitement', 'Reprise du travail et parentalité', 'Réflexologie de bien-être'],
  };
  const audiences = ['Future maman', 'Futurs parents', 'Jeune maman', 'Jeunes parents', 'Co-parent', 'Bébés', 'Enfants', 'Adolescents', 'Toute la famille'];
  function workshop(input, old = {}) {
    const modality = input.workshopModality === 'video' ? 'video' : 'venue';
    const category = clean(input.category === '__custom' ? input.customCategory : input.category, 100);
    const targetAudiences = [...new Set((input.audiences || []).filter(x => audiences.includes(x)))];
    const ageEnabled = !!input.ageEnabled, ageUnit = input.ageUnit === 'years' ? 'years' : 'months';
    const minAge = input.minAge === '' ? null : Number(input.minAge), maxAge = input.maxAge === '' ? null : Number(input.maxAge);
    if (!category) throw Error('Choisis une catégorie ou indique ta propre catégorie.');
    if (!targetAudiences.length) throw Error('Choisis au moins un public pour cet atelier.');
    if (ageEnabled && (!Number.isFinite(minAge) || !Number.isFinite(maxAge) || minAge < 0 || maxAge < minAge || maxAge > (ageUnit === 'years' ? 18 : 216))) throw Error('Indique une tranche d’âge valide, du plus jeune au plus grand.');
    const address = { street: clean(input.venueStreet, 200), postalCode: clean(input.venuePostalCode, 20), city: clean(input.venueCity, 100) };
    const venue = clean(input.venueName, 150), videoPlatform = clean(input.videoPlatform === 'Autre' ? input.videoOther : input.videoPlatform, 100);
    if (modality === 'venue' && (!venue || !address.street || !address.postalCode || !address.city)) throw Error('Complète le nom du lieu, la rue, le code postal et la ville.');
    if (modality === 'video' && !videoPlatform) throw Error('Indique l’outil de visioconférence.');
    return { ...old, category, workshopModality: modality, venueName: modality === 'venue' ? venue : '', venueAddress: modality === 'venue' ? address : null, videoPlatform: modality === 'video' ? videoPlatform : '', targetAudiences, childAge: ageEnabled ? { min: minAge, max: maxAge, unit: ageUnit } : null, place: modality === 'video' ? 'À distance · ' + videoPlatform : [venue, address.street, address.postalCode + ' ' + address.city].join(' · ') };
  }
  function ageLabel(age) { return age ? `${age.min} à ${age.max} ${age.unit === 'years' ? 'ans' : 'mois'}` : ''; }
  function modalities(offer) {
    const all = ['À domicile', 'En visio', 'En cabinet', 'Par téléphone'];
    return [...new Set((offer?.modalities || []).filter(m => all.includes(m)))];
  }
  function booking(data, allowedModes, normalisePhone) {
    const firstName = clean(data.firstName, 100), lastName = clean(data.lastName, 100), phone = normalisePhone(data.phone);
    if (!firstName || !lastName || !phone) throw Error('Renseignez le prénom, le nom et un numéro de téléphone valide.');
    const mode = clean(data.bookingModality, 40);
    if (!allowedModes.includes(mode)) throw Error('Choisissez une modalité proposée pour ce rendez-vous.');
    const homeAddress = mode === 'À domicile' ? { street: clean(data.homeStreet, 200), postalCode: clean(data.homePostalCode, 20), city: clean(data.homeCity, 100), country: clean(data.homeCountry, 80) || 'France' } : null;
    if (homeAddress && (!homeAddress.street || !homeAddress.postalCode || !homeAddress.city)) throw Error('Complétez votre adresse pour la séance à domicile.');
    return { firstName, lastName, name: firstName + ' ' + lastName, phone, modality: mode, homeAddress };
  }
  function description(input) {
    const title = clean(input.title, 90), kind = key(title), audience = (input.audiences || []).join(', ') || 'les familles';
    if (!title) throw Error('Donne un titre à ton atelier pour préparer sa description.');
    let programme = 'Un temps d’accueil, des propositions adaptées au groupe et un échange pour repartir avec des repères concrets.', benefits = 'Partager un moment ensemble, découvrir de nouvelles pistes et avancer à son rythme.';
    if (/massage/.test(kind)) { programme = 'Un accueil en douceur, la découverte de gestes simples de massage et un temps d’échange. Le rythme et les signes de confort de chaque bébé guident la séance.'; benefits = 'Pour bébé : un moment de détente, une découverte sensorielle douce et un contact rassurant.\n\nPour vous : apprendre des gestes adaptés, mieux observer les signaux de votre bébé et partager un temps de complicité.'; }
    else if (/portage/.test(kind)) { programme = 'Découvrir les principes de sécurité, observer une installation et essayer des réglages avec un accompagnement adapté.'; benefits = 'Mieux comprendre les repères de sécurité et gagner en aisance dans les gestes du quotidien, en respectant le confort de l’enfant et du porteur.'; }
    else if (/chant|musical|comptine/.test(kind)) { programme = 'Explorer la voix, des sons et des comptines, avec des temps d’écoute et des propositions accessibles sans expérience musicale.'; benefits = 'Trouver du plaisir à chanter, découvrir un temps d’expression et partager une présence attentive.'; }
    else if (/danse|yoga/.test(kind)) { programme = 'Un accueil, des mouvements doux proposés selon votre confort et un retour au calme. Chaque proposition reste facultative.'; benefits = 'Prendre un temps pour soi et pour le lien, explorer le mouvement et partager une expérience à son rythme, sans objectif de performance.'; }
    else if (/cercle|cafe|rencontre|groupe/.test(kind)) { programme = 'Un temps d’accueil, un cadre de parole respectueux et des échanges libres. Écouter sans prendre la parole est aussi possible.'; benefits = 'Rencontrer d’autres parents, partager ses questions sans jugement et découvrir des points de vue différents.'; }
    return `${title}\n\nUn atelier pour ${audience.toLowerCase()}, dans un cadre accueillant et respectueux du rythme de chacun.\n\nAu programme\n${programme}\n\nLes bienfaits de cet atelier\n${benefits}\n\nChaque famille est différente : les effets varient et cet atelier ne remplace pas un avis médical.`;
  }
  const color = (v, fallback) => /^#[\da-f]{6}$/i.test(v || '') ? v : fallback;
  function giftDesign(value = {}, brand = {}) {
    const safeImage = v => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v || '') && v.length <= 1_500_000 || /^\/assets\/[\w./-]+\.(png|jpg|webp)$/i.test(v || '') ? v : '';
    return { template: ['classic', 'arch', 'photo'].includes(value.template) ? value.template : 'classic', title: clean(value.title, 80) || 'Un moment à offrir', subtitle: clean(value.subtitle, 200) || 'Du temps pour vous, à votre rythme.', accent: color(value.accent, color(brand.accent, '#590425')), background: color(value.background, '#FEF8ED'), text: color(value.text, '#590425'), logo: safeImage(Object.hasOwn(value, 'logo') ? value.logo : brand.logo), photo: safeImage(value.photo) };
  }
  function giftLabel(gift, offers = []) {
    if (gift.offerId) return clean(gift.offerTitle || offers.find(o => o.id === gift.offerId)?.title, 200) || 'Accompagnement sélectionné lors de l’achat';
    return gift.scope?.offers && gift.scope?.workshops ? 'Au choix : ateliers collectifs et accompagnements individuels' : gift.scope?.offers ? 'Accompagnements individuels au choix' : 'Ateliers collectifs au choix';
  }
  function publicGiftConfig(state) {
    const cfg = state.berceau?.giftConfig || {}, d = giftDesign(state.berceau?.giftDesign, state.brand);
    // No pictures as data URLs, bearer tokens, addresses, issued gift codes or customer records.
    return { version: 1, professional: clean([state.profile?.first, state.profile?.last].filter(Boolean).join(' '), 150), business: clean(state.brand?.name, 150), config: { enabled: cfg.enabled !== false, amounts: (cfg.amounts || [30, 50, 100]).filter(n => Number.isFinite(n) && n >= 5 && n <= 1000).slice(0, 8), custom: cfg.custom !== false, min: Math.max(5, +cfg.min || 20), max: Math.min(1000, +cfg.max || 500), months: Math.min(24, +cfg.months || 12), offers: cfg.offers !== false, workshops: cfg.workshops !== false }, design: { ...d, logo: '', photo: '' }, offers: (state.offers || []).slice(0, 40).map(o => ({ id: clean(o.id, 80), title: clean(o.title, 100), price: Math.max(0, Math.min(1000, Number(o.price) || 0)) })) };
  }
  function encodeGift(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(publicGiftConfig(state)));
    return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeGift(token) {
    if (!/^[\w-]{1,16000}$/.test(token || '')) return null;
    try { const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); const p = JSON.parse(new TextDecoder().decode(bytes)); if (p.version !== 1 || !Array.isArray(p.offers) || !p.config || !p.design) return null; return publicGiftConfig({ profile: { first: p.professional }, brand: { name: p.business }, offers: p.offers, berceau: { giftConfig: p.config, giftDesign: p.design } }); } catch { return null; }
  }
  function calendarPayload(event, signups, opts, clockTools) {
    const entry = clockTools.calendarEntry(event, 'workshop'); if (!entry) throw Error('Date ou heure invalide.');
    const confirmed = signups.filter(s => s.eventId === event.id && s.status === 'confirmed');
    const roster = opts.includeRoster && !opts.inviteAttendees ? '\n\nInscrits (usage professionnel privé)\n' + confirmed.map(s => clean(s.name || [s.firstName, s.lastName].filter(Boolean).join(' '), 200) + ' <' + clean(s.email, 180) + '>').join('\n') : '';
    const payload = { summary: clean(event.title, 200), description: 'Atelier Naïtea.' + roster, location: clean(event.place, 500), start: { dateTime: entry.start.toISOString(), timeZone: 'Europe/Paris' }, end: { dateTime: entry.end.toISOString(), timeZone: 'Europe/Paris' }, visibility: 'private', guestsCanSeeOtherGuests: false, guestsCanInviteOthers: false, guestsCanModify: false };
    if (opts.inviteAttendees) payload.attendees = [...new Set(confirmed.map(s => clean(s.email, 180)).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))].map(email => ({ email }));
    return payload;
  }
  const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false; const date = new Date(value + 'T12:00:00Z'); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
  const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  const publicPrice = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const euros = value => value == null ? 'tarif non indiqué' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
  const frenchDate = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(value + 'T12:00:00Z'));
  function publicURL(value) {
    try { const url = new URL(clean(value, 1500)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  // Explicit allowlist: never pass contacts, bookings, messages or tokens to the chat.
  function publicChatData(state = {}, options = {}) {
    const profile = state.profile || {}, page = profile.publicPage || {}, now = options.now instanceof Date ? options.now : new Date();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const offers = (Array.isArray(state.offers) ? state.offers : []).slice(0, 50).filter(o => o && o.title).map(o => {
      let next = null;
      try {
        const date = options.nextDate?.(o.id), slot = validDate(date) && date >= today && options.slots?.(o.id, date)?.[0];
        if (slot && validTime(slot.time)) next = { date, time: slot.time, duration: Number.isFinite(Number(slot.duration)) && +slot.duration > 0 ? +slot.duration : null };
      } catch { /* Availability remains unknown if the booking engine cannot answer. */ }
      const d = o.modalityDetails || {};
      return { kind: 'offer', id: clean(o.id, 80), title: clean(o.title, 200), description: clean(o.description, 1500), price: publicPrice(o.price), modalities: modalities(o), homeZone: clean(d.home?.zone, 300), travelFees: d.home?.fees?.enabled === true, office: clean(d.office?.address || o.location, 400), video: clean(d.video?.platform === 'Autre' ? d.video.other : d.video?.platform, 100), next };
    });
    const events = (Array.isArray(state.events) ? state.events : []).slice(0, 100).filter(e => e && e.title && validDate(e.date) && validTime(e.time) && (e.date > today || e.date === today && e.time > time) && !['cancelled', 'canceled', 'draft', 'archived'].includes(e.status)).map(e => ({ kind: 'workshop', id: clean(e.id, 80), title: clean(e.title, 200), category: clean(e.category, 100), description: clean(e.description, 1500), date: e.date, time: e.time, duration: clean(e.duration, 50), price: publicPrice(e.price), place: clean(e.place, 500), modality: e.workshopModality === 'video' ? 'En visio' : 'Dans un lieu', video: clean(e.videoPlatform, 100), audiences: (e.targetAudiences || []).slice(0, 12).map(v => clean(v, 100)), age: ageLabel(e.childAge) })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return {
      first: clean(profile.first, 100), city: clean(profile.city, 200), phone: clean(profile.phone, 40), email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '') ? clean(profile.email, 180) : '',
      offers, events, faq: (Array.isArray(page.faq) ? page.faq : []).slice(0, 12).filter(f => f?.question && f?.answer).map(f => ({ question: clean(f.question, 200), answer: clean(f.answer, 1500) })),
      hours: (Array.isArray(profile.openingHours) ? profile.openingHours : []).slice(0, 30).map(r => ({ days: [...new Set((r.days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))], start: validTime(r.start) ? r.start : '', end: validTime(r.end) ? r.end : '', byAppointment: !!r.byAppointment, mode: clean(r.mode, 60), location: clean(r.location, 300) })).filter(r => r.days.length),
      payments: (Array.isArray(page.payments) ? page.payments : []).slice(0, 8).map(v => clean(v, 80)), audiences: (Array.isArray(page.audiences) ? page.audiences : []).slice(0, 20).map(v => clean(v, 100)),
      cancellation: clean(page.cancellation, 1200), cancellationURL: publicURL(page.cancellationURL), giftsEnabled: state.berceau?.giftConfig?.enabled !== false,
    };
  }
  const chatStopwords = new Set(('a au aux avec ce ces cet cette c est dans de des du elle en et il ils je la le les leur lui ma me mes mon ne nos notre nous on ou par pas pour que quel quelle quelles quels qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y bonjour bonsoir salut coucou merci svp sil plait pouvez peut possible savoir voudrais aimerais concernant propos aussi plus sont sontils cest estce comment combien prix tarif tarifs cout coute couter duree temps date dates prochain prochaine prochains prochaines disponible disponibles disponibilite disponibilites creneau creneaux horaire horaires atelier ateliers collectif collectifs accompagnement accompagnements seance seances individuel individuelle individuelles visio video distance domicile cabinet telephone adresse lieu lieux zone intervention reserver reservation rdv rendez inscrire inscription inscription').split(/\s+/));
  function chatWords(value) {
    return key(value).replace(/participer|venir/g, 'participer').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !chatStopwords.has(w));
  }
  function entityMatches(question, data) {
    const q = key(question), workshopOnly = /atelier|collectif/.test(q), offerOnly = /accompagnement|seance|individuel/.test(q) && !workshopOnly;
    const records = [...(!workshopOnly ? data.offers : []), ...(!offerOnly ? data.events : [])], words = chatWords(q);
    const scores = records.map(record => {
      const title = key(record.title).replace(/[^a-z0-9]+/g, ' '), normalized = q.replace(/[^a-z0-9]+/g, ' '), titleWords = chatWords(record.title + ' ' + (record.category || ''));
      const hits = words.filter(w => titleWords.includes(w));
      return { record, score: title.length > 5 && normalized.includes(title) ? 100 + title.length : hits.length };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return scores.filter(x => x.score === scores[0]?.score).map(x => x.record);
  }
  function faqMatch(question, faq) {
    const words = [...new Set(chatWords(question))];
    if (!words.length) return null;
    const ranked = faq.map(f => { const target = [...new Set(chatWords(f.question))], count = words.filter(w => target.includes(w)).length; return { f, count, score: count / Math.max(words.length, target.length, 1) }; }).filter(x => x.count >= 2 && x.score >= .5 || x.count >= 1 && key(x.f.question) === key(question)).sort((a, b) => b.score - a.score);
    return ranked[0]?.f || null;
  }
  function chatReply(question, state, previous = {}, options = {}) {
    const original = clean(question, 400), q = key(original), data = publicChatData(state, options);
    const respond = (text, context = previous) => ({ text: clean(text, 4000), context: { kind: context.kind || '', id: clean(context.id, 80), ids: Array.isArray(context.ids) ? context.ids.slice(0, 12).map(v => clean(v, 80)) : [] } });
    const contact = `Vous pouvez écrire à ${data.first || 'la professionnelle'} depuis « Poser une question » sur cette fiche, ou consulter les accompagnements pour prendre rendez-vous.`;
    if (!q) return respond('Quelle information recherchez-vous sur cette fiche ?');
    if (/urgence|douleur|fievre|saign|diagnosti|medicament|symptom|posologie|traitement|soigner|vomit|detresse/.test(q)) return respond('Je renseigne uniquement sur les offres et les informations pratiques, sans diagnostic ni conseil médical. Contactez un professionnel de santé ; en cas d’urgence en France, appelez le 15 ou le 112.');
    if (/^(bonjour|bonsoir|salut|coucou|hello|merci|merci beaucoup|super merci|parfait merci|au revoir|bonne journee)[\s!?.]*$/.test(q)) return respond(/^merci|merci|au revoir|bonne journee/.test(q) ? 'Avec plaisir ! Je reste disponible pour une autre question sur cette fiche.' : `Bonjour ! Je suis l’assistant d’information de ${data.first || 'cette professionnelle'}. Vous cherchez un atelier, un accompagnement ou une information pratique ?`);
    if (/annul|reporter|report\b|rembours/.test(q)) return respond([data.cancellation, data.cancellationURL ? 'La politique d’annulation et de report est accessible depuis le lien sur la fiche et dans le formulaire de réservation.' : ''].filter(Boolean).join('\n') || `Aucune politique d’annulation ou de report n’est renseignée sur cette fiche. ${contact}`);
    if (/contact|appeler|appel|ecrire|email|e-mail|mail|whatsapp/.test(q) && !/visio|domicile|cabinet/.test(q)) return respond([data.phone ? 'Téléphone public : ' + data.phone + '.' : '', data.email ? 'Email public : ' + data.email + '.' : '', contact].filter(Boolean).join('\n'));
    if (/cadeau/.test(q)) return respond(data.giftsEnabled ? 'La rubrique « Offrir un bon cadeau » présente les montants ou les accompagnements à offrir. Le paiement, le code et les emails sont simulés dans cet aperçu.' : `Les bons cadeaux ne sont pas proposés sur cette fiche. ${contact}`);
    const faq = faqMatch(q, data.faq);
    const matched = entityMatches(q, data);
    let selected = matched.length === 1 ? matched[0] : null;
    if (matched.length > 1) return respond('Plusieurs offres correspondent. De laquelle souhaitez-vous parler ?\n' + matched.map(r => '• ' + r.title + (r.kind === 'workshop' ? ' (atelier)' : ' (séance individuelle)')).join('\n'), { kind: 'choice', ids: matched.map(r => r.kind + ':' + r.id) });
    if (!selected && /premier|premiere|deuxieme|second|troisieme|dernier|derniere/.test(q) && previous.ids?.length) {
      const index = /deuxieme|second/.test(q) ? 1 : /troisieme/.test(q) ? 2 : /dernier|derniere/.test(q) ? previous.ids.length - 1 : 0;
      const wanted = previous.ids[index]; selected = [...data.offers, ...data.events].find(r => r.kind + ':' + r.id === wanted);
    }
    const price = /prix|tarif|cout|coute|combien/.test(q) && !/temps|duree/.test(q), duration = /duree|combien de temps/.test(q);
    const mode = /visio|video|distance|domicile|cabinet|modalite|telephone/.test(q), location = /adresse|lieu|\bou\b|zone|intervention/.test(q), dates = /date|prochain|disponib|creneau|quand|demain|aujourd|semaine/.test(q), hours = /horaire|ouvert|ferme/.test(q), bookingIntent = /reserver|reservation|inscrire|inscription|rendez|\brdv\b/.test(q);
    const followUp = price || duration || mode || location || dates || hours || bookingIntent || /description|programme|bienfait|public|pour qui|age|mois|enfant|bebe/.test(q);
    if (!selected && followUp && !/les ateliers|vos ateliers|les accompagnements|vos accompagnements|toutes|tous/.test(q)) selected = [...data.offers, ...data.events].find(r => r.kind === previous.kind && r.id === previous.id);
    if (faq && !selected) return respond(faq.answer, { kind: 'faq' });
    if (/paiement|payer|reglement|especes|cheque|carte bancaire/.test(q)) return respond(data.payments.length ? 'Moyens de paiement indiqués sur cette fiche : ' + data.payments.join(', ') + '. Les paiements restent simulés dans cet aperçu.' : `Les moyens de paiement ne sont pas renseignés sur cette fiche. ${contact}`);
    const availability = r => r.kind === 'workshop' ? `Le ${frenchDate(r.date)} à ${r.time}${r.duration ? ', durée ' + r.duration : ''}.` : r.next ? `Prochain créneau affiché : le ${frenchDate(r.next.date)} à ${r.next.time}${r.next.duration ? ', ' + r.next.duration + ' min' : ''}. Le calendrier confirme la disponibilité au moment de réserver.` : 'Aucun créneau réservable n’est indiqué actuellement pour cet accompagnement. Vous pouvez contacter la professionnelle pour convenir d’une date.';
    const modeDescription = r => r.kind === 'workshop' ? [r.modality, r.video, r.place].filter(Boolean).join(' · ') : r.modalities.length ? r.modalities.map(m => m === 'En visio' ? m + (r.video ? ' : ' + r.video : '') : m === 'À domicile' ? m + (r.homeZone ? ' : ' + r.homeZone : '') + (r.travelFees ? ' (frais de déplacement indiqués par la professionnelle)' : '') : m === 'En cabinet' ? m + (r.office ? ' : ' + r.office : '') : m).join('\n') : 'Les modalités ne sont pas précisées pour cet accompagnement.';
    if (selected) {
      const context = { kind: selected.kind, id: selected.id };
      if (bookingIntent) return respond(`${selected.title}\n${availability(selected)}\nOuvrez ${selected.kind === 'workshop' ? 'cet atelier puis « Réserver »' : 'cet accompagnement puis « Prendre rendez-vous »'} sur la fiche. La réservation reste une démonstration, sans débit ni email réel.`, context);
      if (price) return respond(`${selected.title}\nTarif affiché : ${euros(selected.price)}.`, context);
      if (dates || hours || duration) return respond(`${selected.title}\n${availability(selected)}`, context);
      if (mode || location) return respond(`${selected.title}\n${modeDescription(selected)}`, context);
      if (/public|pour qui|age|mois|enfant|bebe/.test(q) && selected.kind === 'workshop' && (selected.audiences.length || selected.age)) return respond(`${selected.title}\n${[selected.audiences.join(', '), selected.age].filter(Boolean).join(' · ')}.`, context);
      return respond([selected.title, selected.description, 'Tarif affiché : ' + euros(selected.price) + '.', modeDescription(selected), availability(selected)].filter(Boolean).join('\n'), context);
    }
    if (hours) {
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      return respond(data.hours.length ? data.hours.map(r => `${r.days.map(d => days[d]).join(', ')} : ${r.byAppointment ? 'sur rendez-vous' : r.start && r.end ? r.start + ' à ' + r.end : 'horaires à préciser'}${r.mode ? ' · ' + r.mode : ''}${r.location ? ' · ' + r.location : ''}.`).join('\n') + '\nLes créneaux réservables figurent dans chaque accompagnement.' : `Les horaires d’ouverture ne sont pas renseignés. ${contact}`);
    }
    const showWorkshops = /atelier|collectif/.test(q), showOffers = /accompagnement|seance|individuel/.test(q);
    let records = showWorkshops ? data.events : showOffers ? data.offers : price || dates || mode || location || bookingIntent ? [...data.offers, ...data.events] : [];
    if (records.length) {
      const shown = records.slice(0, 6), context = { kind: 'choice', ids: shown.map(r => r.kind + ':' + r.id) };
      return respond(shown.map(r => `• ${r.title}${price || showOffers ? ' : ' + euros(r.price) : ''}${dates || showWorkshops ? '\n' + availability(r) : ''}${mode || location ? '\n' + modeDescription(r) : ''}`).join('\n\n') + (shown.length > 1 ? '\n\nIndiquez le nom de l’offre pour préciser votre question.' : ''), shown.length === 1 ? { kind: shown[0].kind, id: shown[0].id } : context);
    }
    if (showWorkshops) return respond(`Aucun atelier à venir n’est publié sur cette fiche. ${contact}`);
    if (showOffers) return respond(`Aucun accompagnement individuel n’est publié sur cette fiche. ${contact}`);
    return respond(`Je n’ai pas cette information dans la fiche. ${contact}`);
  }
  function chatAnswer(question, state) { return chatReply(question, state).text; }
  return { categories, audiences, workshop, ageLabel, modalities, booking, description, giftDesign, giftLabel, publicGiftConfig, encodeGift, decodeGift, calendarPayload, publicChatData, chatReply, chatAnswer };
});
