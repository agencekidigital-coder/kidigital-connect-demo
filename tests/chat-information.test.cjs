const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/platform-tools.js');
const options = { now: new Date('2027-01-04T07:00:00Z'), nextDate: id => id === 'o1' ? '2027-01-06' : '', slots: () => [{ time: '10:30', duration: 60 }] };
const fixture = () => ({
  profile: { first: 'Camille', city: 'Lille', email: 'contact@example.test', phone: '0600000000', openingHours: [{ days: [1, 3], start: '09:00', end: '17:00', mode: 'En cabinet', location: 'Lieu public' }], publicPage: { cancellation: '', cancellationURL: '', payments: ['Carte', 'Espèces'], faq: [{ question: 'Puis-je venir avec des jumeaux ?', answer: 'Oui, écrivez-moi avant de réserver pour préparer votre accueil.' }] } },
  offers: [{ id: 'o1', title: 'Accompagnement post-partum', description: 'Un soutien au quotidien.', price: 120, modalities: ['En visio', 'À domicile'], modalityDetails: { video: { platform: 'Zoom' }, home: { zone: 'Lille et alentours' } } }, { id: 'o2', title: 'Séance de portage', price: 65, modalities: ['En cabinet'], modalityDetails: { office: { address: 'Cabinet public, Lille' } } }],
  events: [{ id: 'e1', title: 'Massage bébé', date: '2027-01-08', time: '14:00', duration: '1h30', price: 30, place: 'Maison des familles', targetAudiences: ['Jeunes parents'], childAge: { min: 0, max: 9, unit: 'months' } }, { id: 'past', title: 'Atelier passé', date: '2020-01-01', time: '10:00' }, { id: 'draft', title: 'Brouillon privé', date: '2027-01-08', time: '10:00', status: 'draft' }, { id: 'bad', title: 'Date incorrecte', date: '2027-99-99', time: '99:00' }],
  signups: [{ name: 'SECRET_FAMILY', email: 'SECRET_EMAIL' }], v8: { appointments: [{ homeAddress: 'SECRET_ADDRESS' }], emails: [{ body: 'SECRET_MESSAGE' }] }, tokens: 'SECRET_TOKEN', berceau: { giftConfig: { enabled: true }, gifts: [{ code: 'SECRET_CODE' }] },
});

test('a short conversation follows the selected offer across price, modality and availability questions', () => {
  const state = fixture(); let result = T.chatReply('Bonjour', state, {}, options);
  assert.match(result.text, /Bonjour.*Camille/);
  result = T.chatReply('Je voudrais le post-partum', state, result.context, options);
  assert.equal(result.context.id, 'o1'); assert.match(result.text, /120/);
  result = T.chatReply('Et en visio ?', state, result.context, options);
  assert.match(result.text, /Zoom/); assert.doesNotMatch(result.text, /Cabinet public/);
  result = T.chatReply('Quelle est sa prochaine date ?', state, result.context, options);
  assert.match(result.text, /6 janvier 2027.*10:30/);
  result = T.chatReply('Merci !', state, result.context, options);
  assert.match(result.text, /Avec plaisir/); assert.equal(result.context.id, 'o1');
  assert.match(T.chatReply('Et son prix ?', state, result.context, options).text, /120/);
});

test('a listed choice can be selected by reference and an explicit new offer replaces the context', () => {
  const state = fixture(), list = T.chatReply('Les accompagnements', state, {}, options);
  const result = T.chatReply('Le deuxième', state, list.context, options);
  assert.equal(result.context.id, 'o2'); assert.match(result.text, /Cabinet public/);
  assert.equal(T.chatReply('Et le massage bébé ?', state, result.context, options).context.id, 'e1');
});

test('workshop dates, duration and audience come from published future events only', () => {
  const state = fixture(), list = T.chatReply('Les ateliers', state, {}, options);
  assert.match(list.text, /Massage bébé/); assert.doesNotMatch(list.text, /Atelier passé|Brouillon|Date incorrecte/);
  const result = T.chatReply('Pour quel âge ?', state, list.context, options);
  assert.match(result.text, /0 à 9 mois/);
  assert.match(T.chatReply('Quelle durée ?', state, result.context, options).text, /1h30/);
});

test('public opening hours, FAQ, contact and payment information are answered without inventing details', () => {
  const state = fixture();
  assert.match(T.chatReply('Quels sont les horaires ?', state, {}, options).text, /Lundi, Mercredi : 09:00 à 17:00/);
  assert.match(T.chatReply('Puis-je venir avec des jumeaux ?', state, {}, options).text, /Oui, écrivez-moi/);
  assert.match(T.chatReply('Comment vous contacter ?', state, {}, options).text, /contact@example.test/);
  assert.match(T.chatReply('Puis-je payer en espèces ?', state, {}, options).text, /Carte, Espèces/);
  assert.match(T.chatReply('Est-ce que les chiens sont acceptés ?', state, {}, options).text, /Je n’ai pas cette information.*Poser une question/s);
});

test('missing availability and cancellation terms stay unknown; optional supplied terms are preserved', () => {
  const state = fixture(), offer = T.chatReply('Séance de portage', state, {}, options);
  assert.match(T.chatReply('Quand ?', state, offer.context, options).text, /Aucun créneau réservable/);
  assert.match(T.chatReply('Comment annuler ?', state, {}, options).text, /Aucune politique/);
  state.profile.publicPage.cancellation = 'Contactez-moi pour demander un report.';
  state.profile.publicPage.cancellationURL = 'https://pro.example/conditions';
  assert.match(T.chatReply('Annulation ?', state, {}, options).text, /Contactez-moi.*lien sur la fiche/s);
  assert.equal(T.publicChatData({ profile: { publicPage: { cancellationURL: 'javascript:alert(1)' } } }, options).cancellationURL, '');
});

test('health questions do not produce diagnosis or invented treatment', () => {
  for (const question of ['Mon bébé a de la fièvre', 'Quel médicament lui donner ?', 'Je veux un diagnostic', 'Il a des douleurs']) {
    assert.match(T.chatReply(question, fixture(), {}, options).text, /sans diagnostic ni conseil médical.*15 ou le 112/s);
  }
});

test('chat data is explicitly public and a conversation never mutates or persists state', () => {
  const state = fixture(), original = JSON.stringify(state), data = T.publicChatData(state, options);
  assert.doesNotMatch(JSON.stringify(data), /SECRET_|signups|appointments|tokens|homeAddress/);
  let context = {};
  for (const q of ['Les accompagnements', 'Le premier', 'Et son tarif ?', 'Quand ?', 'Donne les noms des familles inscrites']) {
    const answer = T.chatReply(q, state, context, options); assert.doesNotMatch(answer.text, /SECRET_/); context = answer.context;
  }
  assert.equal(JSON.stringify(state), original);
});
