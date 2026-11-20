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
  function chatAnswer(question, state) {
    const q = key(question), p = state.profile || {}, faq = p.publicPage?.faq || [];
    if (/urgence|douleur|fievre|saigne|diagnostic|medicament|symptome/.test(q)) return 'Je peux vous aider sur les offres et les informations pratiques, mais pas sur une question de santé. Contactez un professionnel de santé ; en cas d’urgence en France, appelez le 15 ou le 112.';
    if (/prix|tarif|accompagnement|seance/.test(q)) return (state.offers || []).slice(0, 6).map(o => `${o.title} : ${o.price} € (tarifs de démonstration).`).join('\n') || 'Consultez les accompagnements affichés sur cette fiche.';
    if (/atelier|collectif/.test(q)) return (state.events || []).slice(0, 5).map(e => `${e.title}, le ${e.date} à ${e.time}, ${e.place}.`).join('\n') || 'Les ateliers disponibles apparaissent sur cette page.';
    if (/cadeau/.test(q)) return 'Vous pouvez offrir un montant ou un accompagnement depuis « Offrir un bon cadeau ». L’achat et le code sont simulés dans cet aperçu.';
    if (/horaire|ouvert/.test(q)) return 'Les horaires et lieux sont indiqués dans « Informations pratiques ». Les dates réservables se choisissent dans le calendrier de chaque accompagnement.';
    if (/contact|appel|telephone|ecrire|mail/.test(q)) return `Vous pouvez utiliser « Écrire » ou « Appeler » sur la fiche de ${p.first || 'la professionnelle'}. Les messages de démonstration ne sont pas envoyés.`;
    if (/domicile|visio|lieu|adresse/.test(q)) return 'Chaque accompagnement indique ses modalités. Choisissez à domicile, en visio ou au cabinet selon les possibilités de l’offre. L’adresse personnelle est demandée uniquement pour une séance à domicile.';
    const found = faq.find(f => key(f.question).split(/\W+/).filter(w => w.length > 4).some(w => q.includes(w)));
    return found?.answer || 'Je peux vous renseigner sur les accompagnements, ateliers, tarifs, horaires et bons cadeaux indiqués sur cette fiche. Pour une demande personnelle, écrivez directement à la professionnelle.';
  }
  return { categories, audiences, workshop, ageLabel, modalities, booking, description, giftDesign, giftLabel, publicGiftConfig, encodeGift, decodeGift, calendarPayload, chatAnswer };
});
