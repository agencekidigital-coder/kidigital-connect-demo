/* Local extraction only. This module never fetches a website or executes HTML. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NaiteaSiteImportTools = api;
})(globalThis, function () {
  'use strict';
  const MAX_BYTES = 1_000_000, MAX_OFFERS = 20;
  const clean = (value, max = 3000) => typeof value === 'string' || typeof value === 'number' ? String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '';
  const key = value => clean(value, 300).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const genericTitle = value => /^(?:accueil|contact(?:ez nous)?|menu|a propos|qui suis je|bienvenue|nos? (?:offres?|prestations?|services?|accompagnements?)|mes (?:offres?|prestations?|services?|accompagnements?)|prestations?|services?|accompagnements?|tarifs?|avis|blog|actualites|mentions legales|politique .*|a domicile|en visio|en cabinet|par telephone|modalites?|publics?)$/.test(key(value));
  function bounded(value) {
    if (typeof value !== 'string' || new TextEncoder().encode(value).length > MAX_BYTES) throw Error('Le contenu doit être un texte ou un fichier de moins de 1 Mo.');
    return value;
  }
  function safeURL(value) {
    try { const url = new URL(clean(value, 1000)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function numberPrice(value) {
    const raw = clean(value, 30).replace(/\s/g, '').replace(',', '.');
    if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(raw)) return null;
    const price = Number(raw); return price <= 100000 ? price : null;
  }
  function priceFromText(value) {
    const text = clean(value, 5000);
    if (/\b(?:sur devis|a partir)\b/.test(key(text)) || /\d[\d.,]*\s*(?:à|a|[-–])\s*\d[\d.,]*\s*(?:€|EUR)/i.test(text)) return null;
    const matches = [...text.matchAll(/(?:\bEUR\s*(\d{1,6}(?:[.,]\d{1,2})?)\b|\b(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:€|EUR\b))/gi)].map(match => numberPrice(match[1] || match[2])).filter(value => value !== null);
    const distinct = [...new Set(matches)];
    if (distinct.length === 1) return distinct[0];
    return !distinct.length && /\bgratuit(?:e)?\b/i.test(text) ? 0 : null;
  }
  function durationMinutes(value) {
    const text = clean(value, 300);
    if (/\d+\s*(?:à|a|[-–])\s*\d+\s*(?:min|h|heure)/i.test(text)) return null;
    let match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(text);
    if (match && (match[1] || match[2])) { const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0); return minutes >= 5 && minutes <= 480 ? minutes : null; }
    match = /\b(\d{1,2})\s*(?:h(?:eures?)?|heures?)(?:\s*(\d{1,2})\s*(?:min(?:utes?)?)?)?(?!\d)/i.exec(text);
    if (match) { const minutes = Number(match[1]) * 60 + Number(match[2] || 0); return minutes >= 5 && minutes <= 480 && Number(match[2] || 0) < 60 ? minutes : null; }
    match = /\b(\d{1,3})\s*(?:min(?:ute)?s?)\b/i.exec(text);
    return match && Number(match[1]) >= 5 && Number(match[1]) <= 480 ? Number(match[1]) : null;
  }
  function modalities(value) {
    const text = key(value), result = [];
    if (/\ba domicile\b/.test(text)) result.push('À domicile');
    if (/\b(?:en visio|visioconference|a distance)\b/.test(text)) result.push('En visio');
    if (/\b(?:en cabinet|au cabinet)\b/.test(text)) result.push('En cabinet');
    if (/\b(?:par telephone|au telephone)\b/.test(text)) result.push('Par téléphone');
    return result;
  }
  function makeOffer(value) {
    const title = clean(value.title, 160).replace(/\s+/g, ' '), description = clean(value.description, 3000);
    if (!title || genericTitle(title)) return null;
    return { title, description, price: value.price ?? null, currency: clean(value.currency, 8), durationMinutes: value.durationMinutes ?? null, modalities: modalities([title, description, value.modality || ''].join(' ')), source: safeURL(value.source), detectedFrom: value.detectedFrom || 'text' };
  }
  function unique(values) {
    const found = new Map();
    values.filter(Boolean).forEach(offer => { const id = key(offer.title); if (!found.has(id)) found.set(id, offer); });
    return [...found.values()].slice(0, MAX_OFFERS);
  }
  function structuredOffers(input) {
    const nodes = [], stack = [{ value: input, depth: 0 }]; let seen = 0;
    while (stack.length && seen++ < 3000) {
      const { value, depth } = stack.pop(); if (!value || typeof value !== 'object' || depth > 20) continue;
      if (!Array.isArray(value)) nodes.push(value);
      for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push({ value: child, depth: depth + 1 });
    }
    const type = (node, name) => (Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']]).some(value => String(value).split(/[\/#]/).pop() === name);
    const from = (service, offer = {}, multipleVariants = false) => {
      const pricing = offer.priceSpecification || offer, rawPrice = pricing.price ?? service.price;
      const currency = clean(pricing.priceCurrency || offer.priceCurrency || service.priceCurrency, 8).toUpperCase();
      const price = !currency || currency === 'EUR' ? numberPrice(rawPrice) : null;
      const text = clean(service.description || offer.description, 3000);
      const variablePrice = multipleVariants || /\b(?:sur devis|a partir)\b/.test(key(text));
      return makeOffer({ title: service.name || offer.name, description: text, price: variablePrice ? null : rawPrice === undefined ? priceFromText(text) : price, currency: price !== null && rawPrice !== undefined ? currency : '', durationMinutes: durationMinutes(service.duration || service.timeRequired || (multipleVariants ? '' : offer.duration || text)), source: service.url || offer.url, detectedFrom: 'jsonld' });
    };
    const result = [];
    const linkedServices = new Set(nodes.filter(node => type(node, 'Offer')).map(node => node.itemOffered).filter(value => value && typeof value === 'object'));
    for (const node of nodes) if (type(node, 'Service') && !linkedServices.has(node)) { const variants = Array.isArray(node.offers) ? node.offers : [node.offers || {}]; result.push(from(node, variants[0], variants.length > 1)); }
    for (const node of nodes) if (type(node, 'Offer')) {
      if (node.itemOffered && typeof node.itemOffered === 'object') result.push(from(node.itemOffered, node));
      else if (node.name) result.push(from(node, node));
    }
    return unique(result);
  }
  function extractText(input) {
    const text = bounded(input).replace(/\r\n?/g, '\n'), lines = text.split('\n'), offers = [];
    let current = null;
    const flush = () => {
      if (!current) return;
      const description = current.lines.join('\n').trim(), context = [current.title, description].join('\n');
      offers.push(makeOffer({ title: current.title, description, price: priceFromText(context), durationMinutes: durationMinutes(context), currency: /€|\bEUR\b/i.test(context) ? 'EUR' : '', detectedFrom: 'text' })); current = null;
    };
    let gap = true;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) { gap = true; continue; }
      const heading = /^(?:#{1,4}\s+|\*\*)(.+?)(?:\*\*)?$/.exec(line);
      const shortTitle = (gap || !current) && line.length <= 140 && !/[.!?;:]$/.test(line) && !/€|\b(?:EUR|min(?:utes?)?|\d+h\d*)\b/i.test(line) && !/^(?:https?:|tarif|prix|durée|duree)/i.test(line);
      if (heading || shortTitle) { flush(); current = { title: heading ? heading[1] : line, lines: [] }; }
      else if (current) current.lines.push(line);
      gap = false;
    }
    flush(); return { offers: unique(offers), warnings: [] };
  }
  function extractHTML(input, environment = globalThis) {
    const html = bounded(input);
    if (!environment.document?.createElement || !environment.DOMParser) throw Error('L’analyse HTML doit être ouverte dans un navigateur.');
    // A template is inert, including its images and frames. It is never attached
    // to the live document. Strip active/resource attributes before DOMParser.
    const template = environment.document.createElement('template'); template.innerHTML = html;
    template.content.querySelectorAll('base,link,meta,style,noscript,iframe,frame,frameset,object,embed,img,picture,video,audio,source,track,svg,math,form').forEach(node => node.remove());
    template.content.querySelectorAll('script').forEach(node => { if (node.getAttribute('type')?.toLowerCase() !== 'application/ld+json') node.remove(); });
    template.content.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => { if (/^(?:on|src|href|style|action|poster|background|data$)/i.test(attr.name)) node.removeAttribute(attr.name); }));
    const doc = new environment.DOMParser().parseFromString(template.innerHTML, 'text/html');
    const offers = [], warnings = [];
    doc.querySelectorAll('script').forEach(script => { try { offers.push(...structuredOffers(JSON.parse(script.textContent))); } catch { warnings.push('Un bloc de données structurées illisible a été ignoré.'); } });
    if (!offers.length) doc.querySelectorAll('h1,h2,h3,h4').forEach(heading => {
      if (heading.closest('header,nav,footer,aside')) return;
      const title = clean(heading.textContent, 160); if (genericTitle(title)) return;
      const paragraphs = []; let next = heading.nextElementSibling;
      while (next && !/^H[1-6]$/.test(next.tagName) && paragraphs.length < 12) { const text = clean(next.textContent, 3000); if (text) paragraphs.push(text); next = next.nextElementSibling; }
      const description = paragraphs.join('\n').slice(0, 3000), context = [title, description].join('\n');
      if (!description) return;
      offers.push(makeOffer({ title, description, price: priceFromText(context), durationMinutes: durationMinutes(context), currency: /€|\bEUR\b/i.test(context) ? 'EUR' : '', detectedFrom: 'heading' }));
    });
    return { offers: unique(offers), warnings: [...new Set(warnings)] };
  }
  function validateOffer(value) {
    const title = clean(value.title, 160), description = clean(value.description, 3000), price = numberPrice(value.price), minutes = Number(value.durationMinutes);
    if (!title) throw Error('Chaque prestation sélectionnée doit avoir un titre.');
    if (price === null) throw Error('Complétez le tarif en euros. Saisissez 0 uniquement pour une prestation gratuite.');
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) throw Error('Complétez une durée de 5 à 480 minutes pour chaque prestation sélectionnée.');
    const allowed = ['À domicile', 'En visio', 'En cabinet', 'Par téléphone'], modes = [...new Set(Array.isArray(value.modalities) ? value.modalities : [])].filter(mode => allowed.includes(mode));
    if (!modes.length) throw Error('Choisissez au moins une modalité pour chaque prestation sélectionnée.');
    return { title, description, price, duration: minutes + ' min', modalities: modes, source: safeURL(value.source) };
  }
  return { MAX_BYTES, MAX_OFFERS, safeURL, numberPrice, priceFromText, durationMinutes, structuredOffers, extractText, extractHTML, validateOffer, key };
});
