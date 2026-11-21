/* Deterministic gift, reminder and calendar helpers for the local demonstration. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BerceauTools = api;
})(globalThis, function () {
  'use strict';
  const clean = (s, max = 300) => String(s ?? '').trim().slice(0, max);
  const palette = { pourpre: '#590425', corail: '#BF5B45', moutarde: '#D89328', ivoire: '#FEF8ED' };
  const taxonomy = {
    specialties: ['Massage bébé', 'Portage physiologique', 'Sommeil de bébé', 'Allaitement', 'Post-partum', 'Préparation à la naissance', 'Bain enveloppé', 'Soutien émotionnel', 'Bien-être parental', 'Éveil du bébé', 'Yoga parents-bébé', 'Parentalité'],
    audiences: ['Futurs parents', 'Parents', 'Co-parents', 'Nouveau-nés', 'Bébés', 'Bébés 0-12 mois', 'Enfants 1-3 ans', 'Enfants 3-6 ans', 'Familles monoparentales'],
    languages: ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Italien', 'Portugais', 'Arabe', 'Langue des signes française'],
  };
  const pictograms = [
    ['parents', 'preparer-la-naissance', 'Préparer la naissance'], ['parents', 'portage', 'Portage'], ['parents', 'alimentation-de-bebe', 'Alimentation de bébé'], ['parents', 'sommeil-de-bebe', 'Sommeil de bébé'], ['parents', 'retour-a-la-maison', 'Retour à la maison'], ['parents', 'prendre-soin-de-soi', 'Prendre soin de soi'],
    ['accompagnements', 'massage-bebe', 'Massage bébé'], ['accompagnements', 'atelier-collectif', 'Atelier collectif'], ['accompagnements', 'seance-individuelle', 'Séance individuelle'], ['accompagnements', 'consultation-en-visio', 'Consultation en visio'], ['accompagnements', 'accompagnement-a-domicile', 'Accompagnement à domicile'], ['accompagnements', 'ressources', 'Ressources'],
    ['espace-parents', 'pres-de-chez-moi', 'Près de chez moi'], ['espace-parents', 'favoris', 'Favoris'], ['espace-parents', 'creneaux-disponibles', 'Créneaux disponibles'], ['espace-parents', 'messagerie', 'Messagerie'], ['espace-parents', 'rappels', 'Rappels'], ['espace-parents', 'avis', 'Avis'],
    ['espace-pro', 'agenda', 'Agenda'], ['espace-pro', 'inscriptions', 'Inscriptions'], ['espace-pro', 'suivi-des-familles', 'Suivi des familles'], ['espace-pro', 'profil-public', 'Profil public'], ['espace-pro', 'automatisations', 'Automatisations'], ['espace-pro', 'statistiques', 'Statistiques'],
  ].map(([group, id, label]) => ({ id, group, label, src: `/assets/berceau/transparent/${id}.png` }));
  function cents(value) {
    const s = String(value ?? '').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    return Math.round(Number(s) * 100);
  }
  const formatCents = amount => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(amount / 100);
  function giftSettings(value = {}) {
    return {
      enabled: value.enabled !== false, amounts: [...new Set((value.amounts || [30, 50, 100, 150]).map(Number))].filter(n => Number.isFinite(n) && n >= 5 && n <= 1000).slice(0, 8),
      custom: value.custom !== false, min: Number.isFinite(+value.min) ? +value.min : 20, max: Number.isFinite(+value.max) ? +value.max : 500,
      months: Math.max(1, Math.min(24, Math.round(+value.months || 12))), workshops: value.workshops !== false, offers: value.offers !== false,
    };
  }
  function expiresInMonths(iso, months) {
    const start = new Date(iso), target = new Date(start); target.setUTCDate(1); target.setUTCMonth(target.getUTCMonth() + months);
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(start.getUTCDate(), last)); return target.toISOString();
  }
  function issueGift({ code, valueCents, offerId = '', buyerName, buyerEmail, recipient, message = '', settings, now }) {
    const cfg = giftSettings(settings);
    if (!cfg.enabled || (!cfg.workshops && !cfg.offers) || !/^DEMO-[A-Z0-9-]{8,30}$/.test(code || '')) throw Error('Le bon cadeau n’est pas disponible.');
    if (!Number.isSafeInteger(valueCents) || valueCents < 500 || valueCents > 100000) throw Error('Le montant du bon doit être compris entre 5 et 1 000 €.');
    if (!clean(buyerName, 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(buyerEmail, 180)) || !clean(recipient, 100)) throw Error('Complétez les coordonnées fictives et le prénom du bénéficiaire.');
    return { code, valueCents, balanceCents: valueCents, offerId: clean(offerId, 80), buyerName: clean(buyerName, 100), buyerEmail: clean(buyerEmail, 180), recipient: clean(recipient, 100), message: clean(message, 400), issuedAt: new Date(now).toISOString(), expiresAt: expiresInMonths(now, cfg.months), scope: { workshops: cfg.workshops, offers: cfg.offers }, transactions: [], status: 'active' };
  }
  function quoteGift(gift, item, now) {
    if (!gift) return { ok: false, reason: 'Ce code n’existe pas dans ce navigateur de démonstration.' };
    if (gift.status !== 'active') return { ok: false, reason: 'Ce bon cadeau est annulé.' };
    if (!Number.isFinite(Date.parse(gift.expiresAt)) || new Date(now) >= new Date(gift.expiresAt)) return { ok: false, reason: 'La date de validité de ce bon est dépassée.' };
    if (!Number.isSafeInteger(gift.balanceCents) || gift.balanceCents <= 0) return { ok: false, reason: 'Ce bon cadeau a déjà été utilisé en totalité.' };
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents <= 0) return { ok: false, reason: 'Aucun règlement n’est nécessaire pour cette prestation.' };
    if ((item.kind === 'workshop' && !gift.scope.workshops) || (item.kind === 'offer' && !gift.scope.offers)) return { ok: false, reason: 'Ce bon ne couvre pas ce type de prestation.' };
    if (gift.offerId && (item.kind !== 'offer' || gift.offerId !== item.id)) return { ok: false, reason: 'Ce bon est réservé à l’accompagnement indiqué lors de l’achat.' };
    const discountCents = Math.min(gift.balanceCents, item.priceCents);
    return { ok: true, discountCents, dueCents: item.priceCents - discountCents, balanceAfterCents: gift.balanceCents - discountCents };
  }
  function redeemGift(gift, item, reservationId, now) {
    if ((gift.transactions || []).some(t => t.reservationId === reservationId)) throw Error('Ce bon est déjà lié à cette réservation.');
    const quote = quoteGift(gift, item, now); if (!quote.ok) throw Error(quote.reason);
    return { ...gift, balanceCents: quote.balanceAfterCents, transactions: [...(gift.transactions || []), { reservationId, kind: item.kind, amountCents: quote.discountCents, date: new Date(now).toISOString(), refunded: false }] };
  }
  function refundCancelledGifts(gifts, statusOf) {
    let changed = false;
    const result = gifts.map(gift => {
      let credit = 0;
      const transactions = (gift.transactions || []).map(t => {
        if (!t.refunded && statusOf(t.kind, t.reservationId) === 'cancelled') { credit += t.amountCents; changed = true; return { ...t, refunded: true }; }
        return t;
      });
      return credit ? { ...gift, balanceCents: Math.min(gift.valueCents, gift.balanceCents + credit), transactions } : gift;
    });
    return { gifts: result, changed };
  }
  const parisFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function parisInstant(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
    const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    if (new Date(wanted).toISOString().slice(0, 10) !== date) return null;
    let guess = wanted;
    for (let n = 0; n < 4; n++) {
      const formatted = parisFormatter.format(new Date(guess)), actual = Date.parse(formatted.replace(' ', 'T') + ':00Z');
      if (wanted === actual) return new Date(guess);
      guess += wanted - actual;
    }
    return null; // Nonexistent local time during the spring DST change.
  }
  function durationMinutes(value) {
    if (typeof value === 'number' && value > 0) return value;
    const text = String(value || ''), h = text.match(/(\d+)\s*h(?:\s*(\d+))?/);
    return h ? Number(h[1]) * 60 + Number(h[2] || 0) : parseInt(text) || 60;
  }
  function calendarEntry(record, kind, publicURL = '') {
    const start = parisInstant(record.date, record.time); if (!start) return null;
    return { id: `${kind}-${clean(record.id, 80)}`, title: clean(record.title, 200), start, end: new Date(start.getTime() + durationMinutes(record.duration) * 60000), location: clean(record.place || record.location, 300), description: 'Démonstration Naïtea. ' + (publicURL ? 'Informations : ' + publicURL : '') };
  }
  const compactDate = date => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function googleCalendarURL(entry) {
    const url = new URL('https://calendar.google.com/calendar/render');
    for (const [key, value] of Object.entries({ action: 'TEMPLATE', text: entry.title, dates: compactDate(entry.start) + '/' + compactDate(entry.end), details: entry.description, location: entry.location, ctz: 'Europe/Paris' })) url.searchParams.set(key, value);
    return url.href;
  }
  const icsEscape = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r/g, '').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  function foldLine(line) {
    let result = '', chunk = '', bytes = 0;
    for (const character of line) {
      const count = new TextEncoder().encode(character).length;
      if (bytes + count > 74) { result += chunk + '\r\n '; chunk = ''; bytes = 1; }
      chunk += character; bytes += count;
    }
    return result + chunk;
  }
  function calendarICS(entries, now = new Date()) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Naitea//Demonstration//FR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Naïtea, démonstration', 'X-WR-TIMEZONE:Europe/Paris'];
    for (const entry of entries.filter(Boolean)) lines.push('BEGIN:VEVENT', 'UID:' + icsEscape(entry.id) + '@naitea.demo', 'DTSTAMP:' + compactDate(now), 'DTSTART:' + compactDate(entry.start), 'DTEND:' + compactDate(entry.end), 'SUMMARY:' + icsEscape(entry.title), 'LOCATION:' + icsEscape(entry.location), 'DESCRIPTION:' + icsEscape(entry.description), 'END:VEVENT');
    return [...lines, 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
  }
  function normalisePhone(value) {
    let phone = clean(value, 40).replace(/[\s().-]/g, '');
    if (/^0[1-9]\d{8}$/.test(phone)) phone = '+33' + phone.slice(1);
    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
  }
  function reminderPlans(records, config, now) {
    const result = [], current = new Date(now).getTime();
    if (!config.enabled) return result;
    for (const row of records) {
      if (row.status !== 'confirmed') continue;
      const startsAt = parisInstant(row.date, row.time); if (!startsAt || startsAt.getTime() <= current) continue;
      const delays = [...new Set((row.kind === 'workshop' ? config.workshopHours : config.offerHours) || [])].map(Number).filter(n => Number.isFinite(n) && n > 0 && n <= 168);
      for (const hours of delays) {
        const due = new Date(startsAt.getTime() - hours * 3600000); if (due.getTime() <= current) continue;
        const channels = [];
        if (config.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email || '')) channels.push(['email', row.email]);
        const phone = normalisePhone(row.phone);
        if (config.sms && row.smsConsent && phone) channels.push(['sms', phone]);
        for (const [channel, destination] of channels) result.push({ key: [row.kind, row.id, startsAt.toISOString(), hours, channel].join(':'), reservationId: row.id, kind: row.kind, title: row.title, channel, destination, hours, scheduledAt: due.toISOString(), startsAt: startsAt.toISOString(), status: 'prepared', body: `Rappel de démonstration : ${row.title}, le ${row.date} à ${row.time} (heure de Paris). Pour modifier ce rendez-vous, contactez votre accompagnante. Aucun envoi réel.` });
      }
    }
    return result;
  }
  function syncReminders(previous, desired, now) {
    const current = new Date(now).getTime(), wanted = new Map(desired.map(r => [r.key, r]));
    const result = previous.map(r => {
      const fresh = wanted.get(r.key); wanted.delete(r.key);
      if (fresh) return { ...r, ...fresh };
      return { ...r, status: Date.parse(r.scheduledAt) <= current ? 'past' : 'cancelled' };
    });
    return [...wanted.values(), ...result].slice(0, 200);
  }
  function localReviewReply({ rating, tone = 'warm', short = false }) {
    const negative = Number(rating) > 0 && Number(rating) <= 3;
    if (negative) return tone === 'factual' ? 'Merci pour votre retour. Vous pouvez me contacter directement afin que nous puissions clarifier les points soulevés, dans le respect de votre confidentialité.' : 'Merci d’avoir pris le temps de partager votre ressenti. Je reste à votre écoute et vous invite à me contacter en privé pour en discuter avec attention.';
    const base = tone === 'factual' ? 'Merci pour votre retour et pour le temps consacré à cet avis.' : 'Merci beaucoup pour ces mots et pour le temps pris pour les partager.';
    return base + (short ? '' : ' Vos retours m’aident à faire évoluer mes propositions et à soigner l’accueil des familles.');
  }
  return { palette, taxonomy, pictograms, cents, formatCents, giftSettings, expiresInMonths, issueGift, quoteGift, redeemGift, refundCancelledGifts, parisInstant, durationMinutes, calendarEntry, googleCalendarURL, calendarICS, normalisePhone, reminderPlans, syncReminders, localReviewReply };
});
