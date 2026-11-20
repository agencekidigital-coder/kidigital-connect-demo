/* Public professional pages. Data stays in the existing local demonstration. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NaiteaProfessionalProfile = api;
})(globalThis, function () {
  "use strict";
  const clean = (value, max = 300) => String(value ?? "").trim().slice(0, max);
  const searchKey = value => clean(value, 5000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  function list(value, max = 20, itemMax = 100) {
    const entries = Array.isArray(value) ? value : String(value || "").split(/[,\n]/);
    const seen = new Set();
    return entries.map(x => clean(x, itemMax)).filter(x => {
      const key = searchKey(x);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, max);
  }
  function safeURL(value, hosts) {
    try {
      const url = new URL(clean(value, 1000));
      if (url.protocol !== "https:" || url.username || url.password) return "";
      if (hosts && !hosts.some(host => url.hostname === host || url.hostname.endsWith("." + host))) return "";
      return url.href;
    } catch { return ""; }
  }
  function safeImage(value) {
    const src = clean(value, 3_000_000);
    return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src) || /^\/assets\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(src) ? src : "";
  }
  function normalise(value = {}) {
    return {
      headline: clean(value.headline, 160), approach: clean(value.approach, 2500),
      specialties: list(value.specialties), audiences: list(value.audiences), languages: list(value.languages, 12),
      qualifications: (Array.isArray(value.qualifications) ? value.qualifications : []).slice(0, 25).map(q => ({ title: clean(q.title, 180), school: clean(q.school, 160), year: clean(q.year, 20) })).filter(q => q.title),
      areas: list(value.areas, 30), addresses: list(Array.isArray(value.addresses) ? value.addresses : String(value.addresses || "").split("\n"), 12, 300),
      payments: list(value.payments, 8), accessibility: clean(value.accessibility, 1000), cancellation: clean(value.cancellation, 1200),
      siret: clean(value.siret, 20), linkedin: safeURL(value.linkedin, ["linkedin.com"]), tiktok: safeURL(value.tiktok, ["tiktok.com"]), bookingURL: safeURL(value.bookingURL),
      gallery: (Array.isArray(value.gallery) ? value.gallery : []).slice(0, 12).map(p => ({ src: safeImage(p.src), alt: clean(p.alt, 200) || "Photo de présentation", illustrative: p.illustrative !== false })).filter(p => p.src),
      faq: (Array.isArray(value.faq) ? value.faq : []).slice(0, 12).map(q => ({ question: clean(q.question, 200), answer: clean(q.answer, 1500) })).filter(q => q.question && q.answer),
    };
  }
  function matchesOffer(offer, query = "", modality = "") {
    return (!modality || (offer.modalities || []).includes(modality)) && searchKey([offer.title, offer.description, ...(offer.modalities || [])].join(" ")).includes(searchKey(query));
  }
  function nextAppointment(offers, getDate, getSlots) {
    return offers.map(offer => {
      const date = getDate(offer.id), slot = date && getSlots(offer.id, date)[0];
      return slot ? { offer, date, time: slot.time, duration: slot.duration } : null;
    }).filter(Boolean).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
  }
  function itineraryURL(address) {
    return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(clean(address, 300));
  }
  function create(deps) {
    const { esc, ic, money, fmtDate } = deps;
    const state = () => deps.getState();
    const initial = state().profile.publicPage;
    if (!initial) state().profile.publicPage = normalise({
      specialties: [...new Set(state().events.map(e => e.category))], audiences: ["Futurs parents", "Parents", "Bébés"], languages: ["Français"],
      gallery: [3, 5, 6].map(n => ({ src: "/assets/photos/family-" + n + ".jpg", alt: "Famille et bébé, photo illustrative de démonstration", illustrative: true })),
      faq: [
        { question: "Comment prendre rendez-vous ?", answer: "Choisissez un accompagnement, puis une date et un horaire dans le calendrier. Cet aperçu permet de tester la réservation sans paiement ni email réel." },
        { question: "Puis-je participer à un atelier avec mon bébé ?", answer: "Le public, le lieu et les horaires figurent sur chaque atelier. Pour toute précision avant de réserver, vous pouvez préparer un message à la professionnelle." },
        { question: "Ces accompagnements remplacent-ils un suivi médical ?", answer: "Les ateliers de bien-être et de parentalité ne remplacent pas un avis ni un suivi médical. Pour une question de santé, adressez-vous à un professionnel de santé." },
      ],
    });
    let draftGallery = [], draftFAQ = [], offerQuery = "", offerModality = "";
    const details = () => normalise(state().profile.publicPage);
    const name = () => [state().profile.first, state().profile.last].filter(Boolean).join(" ");
    const chips = values => `<div class="v12-tags">${values.map(x => `<span>${esc(x)}</span>`).join("")}</div>`;
    const paragraph = value => `<p class="v12-prose">${esc(value)}</p>`;
    const field = (label, key, value, type = "text", extra = "") => `<label class="field"><span>${label}</span><input name="${key}" type="${type}" value="${esc(value || "")}" ${extra}></label>`;
    const textarea = (label, key, value, rows = 3, max = 1500) => `<label class="field"><span>${label}</span><textarea name="${key}" rows="${rows}" maxlength="${max}">${esc(value || "")}</textarea></label>`;
    function contacts(profile) {
      return `<div class="v10-public-contacts">${profile.phone ? `<a href="tel:${esc(profile.phone.replace(/[^\d+]/g, ""))}">${ic("phone", "s")} ${esc(profile.phone)}</a>` : ""}${profile.email ? `<a href="mailto:${encodeURIComponent(profile.email)}">${ic("mail", "s")} ${esc(profile.email)}</a>` : ""}</div>`;
    }
    function extraLinks(d) {
      return [[d.linkedin, "LinkedIn"], [d.tiktok, "TikTok"]].filter(([url]) => url).map(([url, label]) => `<a class="btn secondary small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} ${ic("external", "s")}</a>`).join("");
    }
    function galleryHTML(d) {
      if (!d.gallery.length) return "";
      return `<section id="v12Photos" class="v12-section"><h2>En images</h2><div class="v12-gallery">${d.gallery.map((p, i) => `<button type="button" data-v12="photo" data-index="${i}" aria-label="Agrandir : ${esc(p.alt)}"><img loading="lazy" src="${esc(p.src)}" alt="${esc(p.alt)}">${p.illustrative ? '<span>Photo d’illustration</span>' : ""}</button>`).join("")}</div></section>`;
    }
    function practicalHTML(d) {
      const offices = list([...d.addresses, ...state().offers.filter(o => o.modalities?.includes("En cabinet")).map(o => o.modalityDetails?.office?.address)], 24, 300);
      const zones = list([...d.areas, ...state().offers.filter(o => o.modalities?.includes("À domicile")).map(o => o.modalityDetails?.home?.zone)]);
      return `<section id="v12Practical" class="v12-section"><h2>Informations pratiques</h2><div class="v12-practical-grid"><div><h3>Où se retrouver</h3><p class="v12-location">${ic("pin", "s")} ${esc(state().profile.city)}</p>${zones.length ? `<h4>À domicile</h4>${paragraph(zones.join(" · "))}` : ""}${offices.map(address => `<div class="v12-address">${paragraph(address)}<a href="${esc(itineraryURL(address))}" target="_blank" rel="noopener noreferrer">Ouvrir l’itinéraire ${ic("external", "s")}</a></div>`).join("")}${!offices.length && !zones.length ? '<p>Le lieu et les modalités sont indiqués sur chaque prestation.</p>' : ""}</div><div>${d.payments.length ? `<h3>Moyens de paiement indiqués</h3>${chips(d.payments)}<p class="fine">Les paiements restent simulés dans cette démonstration.</p>` : ""}${d.languages.length ? `<h3>Langues</h3>${chips(d.languages)}` : ""}${d.siret ? `<p class="fine">SIRET déclaré : ${esc(d.siret)}</p>` : ""}</div></div>${deps.hours(state().profile)}${d.accessibility ? `<h3>Accueil et accessibilité</h3>${paragraph(d.accessibility)}` : ""}${d.cancellation ? `<h3>Annulation et report</h3>${paragraph(d.cancellation)}` : ""}</section>`;
    }
    function contactHTML() {
      return `<section id="v12Contact" class="v12-section"><h2>Écrire à ${esc(state().profile.first || "la professionnelle")}</h2><p>Testez une demande de renseignement. Le message restera dans ce navigateur, sans envoi réel.</p><form id="v12ContactForm"><div class="inputgrid">${field("Votre prénom (fictif)", "name", "", "text", 'required maxlength="100" autocomplete="given-name"')}${field("Email de test", "email", "", "email", 'required maxlength="180" autocomplete="email"')}</div>${textarea("Votre question", "message", "", 4, 1500)}<p class="fine">N’indiquez aucune donnée de santé ni information personnelle concernant un enfant.</p><label class="checkline"><input type="checkbox" name="consent" required> Je teste l’enregistrement local d’un message fictif. Je ne suis inscrite à aucune newsletter.</label><button class="btn" type="submit">Enregistrer le message de démonstration</button><p id="v12ContactStatus" role="status" class="fine"></p></form></section>`;
    }
    function sidebarHTML(d) {
      const next = nextAppointment(state().offers, deps.nextDate, deps.slots), prices = state().offers.map(o => o.price).filter(n => Number.isFinite(n) && n >= 0);
      return `<aside class="v12-profile-sidebar"><section class="card v12-booking-card"><h2>Votre prochain rendez-vous</h2>${next ? `<p class="v12-next-date">${esc(fmtDate(next.date))}<br><span>${esc(next.time)} · ${next.duration} min</span></p><p>${esc(next.offer.title)}</p><strong>${money(next.offer.price)}</strong><button class="btn full" data-v8="book-appointment" data-id="${esc(next.offer.id)}">Prendre rendez-vous</button>` : `<p>Les créneaux individuels ne sont pas encore publiés.</p>${prices.length ? `<p>Accompagnements à partir de <strong>${money(Math.min(...prices))}</strong></p>` : ""}<a class="btn full" href="#v8ParentAppointments">Voir les accompagnements individuels</a>`}<a class="btn secondary full" href="#v12Contact">Poser une question</a>${d.bookingURL ? `<a class="v12-external-booking" href="${esc(d.bookingURL)}" target="_blank" rel="noopener noreferrer">Agenda externe de la professionnelle ${ic("external", "s")}</a>` : ""}<p class="fine">Réservation de démonstration, sans débit ni email réel.</p></section><section class="card v12-contact-card"><h2>Restons en contact</h2>${contacts(state().profile)}${deps.social()}${extraLinks(d)}${deps.websiteURL(state().profile.website) ? `<a class="btn secondary full" href="${esc(deps.websiteURL(state().profile.website))}" target="_blank" rel="noopener noreferrer">Découvrir mon site ${ic("external", "s")}</a>` : ""}</section></aside>`;
    }
    function parents() {
      const box = document.createElement("div"); box.innerHTML = deps.parentsBase();
      const d = details(), p = state().profile;
      const workshops = box.querySelector("#v8ParentWorkshops"), offers = box.querySelector("#v8ParentAppointments");
      offers?.querySelector(".sectionhead h2")?.replaceChildren(document.createTextNode("Accompagnements individuels"));
      if (offers) {
        const filters = `<form id="v12OfferSearch" class="v12-offer-search"><label class="field"><span>Rechercher un accompagnement</span><input type="search" id="v12OfferQuery" value="${esc(offerQuery)}" placeholder="Portage, post-partum…"></label><label class="field"><span>Modalité</span><select id="v12OfferModality"><option value="">Toutes les modalités</option>${list(state().offers.flatMap(o => o.modalities || [])).map(m => `<option ${m === offerModality ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label></form><p id="v12OfferCount" role="status" class="fine"></p>`;
        offers.querySelector(".sectionhead")?.insertAdjacentHTML("afterend", filters);
        offers.insertAdjacentHTML("beforeend", '<p id="v12OfferEmpty" hidden>Aucun accompagnement ne correspond. Essayez une autre recherche.</p>');
        offers.querySelectorAll('[data-v8="book-appointment"]').forEach(button => {
          const offer = state().offers.find(o => o.id === button.dataset.id); if (!offer) return;
          const card = button.closest("article"), date = deps.nextDate(offer.id);
          card.dataset.v12Offer = offer.id;
          if (offer.modalities?.length) card.querySelector("h3").insertAdjacentHTML("afterend", chips(offer.modalities));
          button.insertAdjacentHTML("beforebegin", `<p class="v12-service-availability">${date ? "Prochaine date : " + esc(fmtDate(date)) : "Créneaux à définir avec la professionnelle"}</p>`);
        });
      }
      const reviews = box.querySelector(".v9-reviews")?.outerHTML || "";
      const photo = safeImage(p.photo);
      const identity = `<header class="v12-profile-hero"><div class="v12-profile-identity">${photo ? `<img class="v12-portrait" src="${esc(photo)}" alt="Portrait de ${esc(name())}">` : `<div class="v12-portrait v12-initials" aria-hidden="true">${esc((p.first?.[0] || "") + (p.last?.[0] || ""))}</div>`}<div><h1>${esc(name())}</h1><p class="v12-profession">${esc(p.job)}</p><p class="v9-profile-location v12-location">${ic("pin", "s")} ${esc(p.city)}</p>${d.headline ? paragraph(d.headline) : ""}</div></div><div class="v12-hero-actions"><a class="btn" href="#v8ParentAppointments">Voir les accompagnements individuels</a><a class="btn secondary" href="#v8ParentWorkshops">Découvrir les ateliers</a><button type="button" class="btn secondary" data-v12="favorite" aria-pressed="${!!state().v12?.favorite}">${ic("heart", "s")} ${state().v12?.favorite ? "Fiche enregistrée" : "Garder cette fiche"}</button><button type="button" class="btn ghost" data-v12="share">${ic("share", "s")} Partager l’aperçu</button></div></header>`;
      const presentation = `<section id="v12Presentation" class="v12-section"><h2>Présentation</h2>${paragraph(p.bio)}${d.approach ? `<h3>Mon approche</h3>${paragraph(d.approach)}` : ""}${d.specialties.length ? `<h3>Je vous accompagne autour de</h3>${chips(d.specialties)}` : ""}${d.audiences.length ? `<h3>Pour qui</h3>${chips(d.audiences)}` : ""}</section>`;
      const training = d.qualifications.length ? `<section id="v12Training" class="v12-section"><h2>Formations et parcours</h2><div class="v12-training">${d.qualifications.map(q => `<article><h3>${esc(q.title)}</h3><p>${esc([q.school, q.year].filter(Boolean).join(" · "))}</p></article>`).join("")}</div><p class="fine">Informations déclarées par la professionnelle, non vérifiées dans cette démonstration.</p></section>` : "";
      const faq = d.faq.length ? `<section id="v12FAQ" class="v12-section"><h2>Vos questions</h2>${d.faq.map(q => `<details class="v12-faq"><summary>${esc(q.question)}</summary>${paragraph(q.answer)}</details>`).join("")}</section>` : "";
      const links = [["v12Presentation", "Présentation"], ["v8ParentAppointments", "Accompagnements"], ["v8ParentWorkshops", "Ateliers"], ["v12Practical", "Infos pratiques"], ...(training ? [["v12Training", "Formations"]] : []), ...(faq ? [["v12FAQ", "Questions"]] : [])];
      return `<div class="v8-parent v12-professional-page">${deps.demo}${identity}<nav class="v12-section-nav" aria-label="Rubriques de la fiche">${links.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav><div class="v12-profile-layout"><div class="v12-profile-content">${presentation}${offers?.outerHTML || ""}${workshops?.outerHTML || ""}${galleryHTML(d)}${practicalHTML(d)}${training}${reviews}${faq}${contactHTML()}</div>${sidebarHTML(d)}</div><p class="v12-footer-note">Profil et offres fictifs. Les photos d’illustration ne représentent pas les clientes de cette professionnelle. Les favoris et messages restent sur cet appareil.</p></div>`;
    }
    function galleryEditor() {
      return draftGallery.map((p, i) => `<article><img src="${esc(p.src)}" alt="${esc(p.alt)}"><div>${field("Description de la photo", "galleryAlt" + i, p.alt, "text", 'maxlength="200"')}<label class="checkline"><input type="checkbox" data-v12-illustrative="${i}" ${p.illustrative ? "checked" : ""}> Photo d’illustration</label><button type="button" class="btn ghost small" data-v12="remove-photo" data-index="${i}">Supprimer la photo</button></div></article>`).join("") || '<p class="fine">Aucune photo ajoutée.</p>';
    }
    function faqEditor() {
      return draftFAQ.map((q, i) => `<div class="v12-faq-editor">${field("Question " + (i + 1), "question" + i, q.question, "text", 'maxlength="200"')}${textarea("Réponse", "answer" + i, q.answer, 3)}<button type="button" class="btn ghost small" data-v12="remove-faq" data-index="${i}">Supprimer cette question</button></div>`).join("");
    }
    function readForm(form) {
      const data = Object.fromEntries(new FormData(form));
      return normalise({ ...data, payments: new FormData(form).getAll("payments"), addresses: String(data.addresses || "").split("\n"),
        qualifications: String(data.qualifications || "").split("\n").map(line => { const [title, school, year] = line.split("|").map(x => x.trim()); return { title, school, year }; }),
        gallery: draftGallery.map((p, i) => ({ ...p, alt: data["galleryAlt" + i] || p.alt, illustrative: !!form.querySelector('[data-v12-illustrative="' + i + '"]')?.checked })),
        faq: draftFAQ.map((_, i) => ({ question: data["question" + i], answer: data["answer" + i] })),
      });
    }
    function preview(d) {
      return `<h3>${esc(d.headline || name())}</h3>${chips(d.specialties)}${d.approach ? paragraph(d.approach) : ""}<p>${d.audiences.length ? "Publics : " + esc(d.audiences.join(", ")) : ""}</p><p>${d.languages.length ? "Langues : " + esc(d.languages.join(", ")) : ""}</p><p class="fine">${d.qualifications.length} formation(s), ${d.gallery.length} photo(s), ${d.faq.length} question(s). Aperçu non enregistré.</p>`;
    }
    function editor() {
      const d = details(); draftGallery = structuredClone(d.gallery); draftFAQ = structuredClone(d.faq);
      const box = document.createElement("div"); box.innerHTML = deps.profileBase();
      const section = `<section class="card v12-profile-editor"><h2>Le contenu de ma fiche</h2><p>Ces informations complètent ta présentation, tes coordonnées, tes offres et tes horaires.</p><form id="v12ProfileDetails"><details open><summary>Spécialités et publics</summary>${field("Phrase de présentation (facultative)", "headline", d.headline, "text", 'maxlength="160"')}${field("Spécialités, séparées par des virgules", "specialties", d.specialties.join(", "), "text", 'maxlength="1500"')}${field("Publics accompagnés, séparés par des virgules", "audiences", d.audiences.join(", "), "text", 'maxlength="1500"')}${field("Langues parlées", "languages", d.languages.join(", "), "text", 'maxlength="500"')}</details><details><summary>Approche et formations</summary>${textarea("Mon approche", "approach", d.approach, 5, 2500)}${textarea("Formations : une par ligne, au format intitulé | organisme | année", "qualifications", d.qualifications.map(q => [q.title, q.school, q.year].join(" | ")).join("\n"), 5, 6000)}<p class="fine">N’indique que tes formations obtenues. Cette démo ne vérifie aucun diplôme et n’affiche pas de badge de certification.</p></details><details><summary>Lieux et informations pratiques</summary>${field("Villes et secteurs d’intervention, séparés par des virgules", "areas", d.areas.join(", "), "text", 'maxlength="2000"')}${textarea("Autres lieux d’accueil publics (une adresse par ligne)", "addresses", d.addresses.join("\n"), 3, 2500)}<p class="fine">Les adresses de cabinet et zones définies dans tes accompagnements sont déjà reprises automatiquement.</p><fieldset class="v12-payments"><legend>Moyens de paiement indiqués</legend>${["Espèces", "Carte bancaire", "Virement", "Chèque", "Paiement en ligne"].map(p => `<label class="checkline"><input name="payments" type="checkbox" value="${p}" ${d.payments.includes(p) ? "checked" : ""}> ${p}</label>`).join("")}</fieldset>${textarea("Accueil, accessibilité, stationnement", "accessibility", d.accessibility, 3, 1000)}${textarea("Conditions d’annulation et de report", "cancellation", d.cancellation, 3, 1200)}${field("SIRET public (facultatif)", "siret", d.siret, "text", 'inputmode="numeric" pattern="[0-9 ]{14,17}" maxlength="17"')}${field("Lien LinkedIn (facultatif)", "linkedin", d.linkedin, "url", 'maxlength="1000"')}${field("Lien TikTok (facultatif)", "tiktok", d.tiktok, "url", 'maxlength="1000"')}${field("Autre agenda en ligne (facultatif)", "bookingURL", d.bookingURL, "url", 'maxlength="1000"')}<p class="fine">Le formulaire de réservation Naïtéa reste disponible. Aucun moyen de paiement réel n’est activé ici.</p></details><details><summary>Photos et questions fréquentes</summary><div id="v12GalleryEditor" class="v12-gallery-editor">${galleryEditor()}</div><label class="checkline"><input id="v12PhotoRights" type="checkbox"> Je dispose des droits et des autorisations de diffusion des personnes reconnaissables.</label><label class="btn secondary v12-upload">Ajouter des photos<input id="v12GalleryUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><p class="fine">12 photos maximum. Images enregistrées dans ce navigateur uniquement.</p><div id="v12FAQEditor">${faqEditor()}</div><button type="button" class="btn secondary" data-v12="add-faq">Ajouter une question</button></details><div class="v12-editor-bottom"><button class="btn" type="submit">Enregistrer le contenu de ma fiche</button><p id="v12ProfileSaveStatus" class="fine" role="status">Les modifications seront visibles côté parents après enregistrement.</p></div></form><details class="v12-preview-details"><summary>Aperçu du contenu</summary><div id="v12DetailsPreview">${preview(d)}</div></details></section>${inboxHTML()}`;
      const grid = box.querySelector(".grid2");
      if (grid) grid.insertAdjacentHTML("afterend", section); else box.insertAdjacentHTML("beforeend", section);
      return box.innerHTML;
    }
    function inboxHTML() {
      const messages = state().v12?.messages || [];
      return `<section class="card v12-inbox"><h2>Messages de la fiche</h2><p class="fine">Demandes fictives enregistrées sur cet appareil, sans envoi email.</p>${messages.map(m => `<article><div><strong>${esc(m.name)}</strong><span>${esc(new Date(m.date).toLocaleDateString("fr-FR"))}</span></div><p>${esc(m.email)}</p>${paragraph(m.message)}<button type="button" class="btn ghost small" data-v12="remove-message" data-id="${esc(m.id)}">Supprimer ce message local</button></article>`).join("") || "<p>Aucun message de démonstration.</p>"}</section>`;
    }
    function submit(form) {
      if (form.id === "v12ProfileDetails") {
        const d = readForm(form);
        for (const [key, hosts, label] of [["linkedin", ["linkedin.com"], "LinkedIn"], ["tiktok", ["tiktok.com"], "TikTok"], ["bookingURL", null, "l’agenda"]]) {
          if (form.elements[key].value.trim() && !safeURL(form.elements[key].value, hosts)) { deps.toast("Indique un lien HTTPS valide pour " + label + "."); return true; }
        }
        d.siret = d.siret.replace(/\s/g, "");
        if (d.siret && !/^\d{14}$/.test(d.siret)) { deps.toast("Le SIRET doit contenir 14 chiffres."); return true; }
        const previous = state().profile.publicPage;
        state().profile.publicPage = d;
        if (!deps.save()) { state().profile.publicPage = previous; return true; }
        deps.render(); deps.toast("Contenu enregistré. Ta fiche parents est à jour."); return true;
      }
      if (form.id === "v12ContactForm") {
        const d = Object.fromEntries(new FormData(form));
        if (!d.consent || !clean(d.name) || !clean(d.message) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || "")) { deps.toast("Complétez le message et confirmez le test avec des données fictives."); return true; }
        const previous = structuredClone(state().v12 || {}), previousLogs = [...state().logs];
        const local = state().v12 ||= {};
        const notificationId = deps.uid();
        local.messages = [{ id: deps.uid(), notificationId, name: clean(d.name, 100), email: clean(d.email, 180), message: clean(d.message, 1500), date: new Date().toISOString() }, ...(local.messages || [])].slice(0, 30);
        state().logs.unshift({ id: notificationId, type: "message", text: "Nouveau message de démonstration de " + clean(d.name, 100), date: "À l’instant · non envoyé" });
        if (!deps.save()) { state().v12 = previous; state().logs = previousLogs; return true; }
        form.reset(); document.getElementById("v12ContactStatus").textContent = "Message fictif enregistré sur cet appareil. Aucun email envoyé. Il est visible dans Personnaliser mon profil et le centre de notifications.";
        return true;
      }
      if (form.id === "v12OfferSearch") { filterOffers(); return true; }
      return false;
    }
    function filterOffers() {
      if (!document.getElementById("v12OfferSearch")) return;
      document.getElementById("mobilebar").innerHTML = `<button data-v12="go-offers">${ic("calendar")}<span>Accompagnements</span></button><button data-v12="go-contact">${ic("message")}<span>Écrire</span></button><button data-nav="dashboard">${ic("home")}<span>Espace pro</span></button>`;
      offerQuery = document.getElementById("v12OfferQuery").value; offerModality = document.getElementById("v12OfferModality").value;
      let count = 0;
      document.querySelectorAll("[data-v12-offer]").forEach(card => { const offer = state().offers.find(o => o.id === card.dataset.v12Offer); card.hidden = !offer || !matchesOffer(offer, offerQuery, offerModality); if (!card.hidden) count++; });
      document.getElementById("v12OfferCount").textContent = `${count} accompagnement${count > 1 ? "s" : ""}`;
      document.getElementById("v12OfferEmpty").hidden = count !== 0;
    }
    function refreshDraft() {
      const form = document.getElementById("v12ProfileDetails"); if (!form) return;
      const d = readForm(form); draftGallery = d.gallery;
      // Keep incomplete question rows in the editor until they are completed or removed.
      draftFAQ = draftFAQ.map((_, i) => ({ question: form.elements["question" + i]?.value || "", answer: form.elements["answer" + i]?.value || "" }));
      document.getElementById("v12DetailsPreview").innerHTML = preview(d);
      document.getElementById("v12ProfileSaveStatus").textContent = "Modifications en cours, non enregistrées.";
    }
    function showPhoto(index) {
      const gallery = details().gallery, i = (index + gallery.length) % gallery.length, photo = gallery[i]; if (!photo) return;
      deps.showModal("En images", "", `<div class="v12-lightbox"><img src="${esc(photo.src)}" alt="${esc(photo.alt)}"><p>${esc(photo.alt)}${photo.illustrative ? " · Photo d’illustration" : ""}</p><div><button type="button" class="btn secondary" data-v12="photo" data-index="${i - 1}" aria-label="Photo précédente">←</button><span>${i + 1} / ${gallery.length}</span><button type="button" class="btn secondary" data-v12="photo" data-index="${i + 1}" aria-label="Photo suivante">→</button></div></div>`);
      document.querySelector(".modal")?.classList.add("v12-photo-modal");
    }
    document.addEventListener("input", event => {
      if (event.target.closest("#v12ProfileDetails")) refreshDraft();
      if (event.target.id === "v12OfferQuery") filterOffers();
    }, true);
    document.addEventListener("change", async event => {
      if (event.target.id === "v12OfferModality") filterOffers();
      if (event.target.matches("[data-v12-illustrative]")) refreshDraft();
      if (event.target.id !== "v12GalleryUpload") return;
      const input = event.target;
      if (!document.getElementById("v12PhotoRights").checked) { input.value = ""; deps.toast("Confirme les droits et autorisations avant d’importer les photos."); return; }
      refreshDraft(); input.disabled = true;
      try {
        const photos = [];
        for (const file of [...input.files].slice(0, 12 - draftGallery.length)) {
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw Error("Utilise des photos PNG, JPEG ou WebP.");
          photos.push({ src: await deps.loadImage(file, 1000), alt: clean(file.name.replace(/\.[^.]+$/, ""), 200), illustrative: false });
        }
        draftGallery.push(...photos); document.getElementById("v12GalleryEditor").innerHTML = galleryEditor(); refreshDraft();
        if (!photos.length) deps.toast("La galerie contient déjà 12 photos.");
      } catch (error) { deps.toast(error.message || "Impossible d’importer cette photo."); }
      finally { input.disabled = false; input.value = ""; }
    }, true);
    document.addEventListener("click", async event => {
      const button = event.target.closest("[data-v12]"); if (!button) return;
      const action = button.dataset.v12, index = Number(button.dataset.index);
      if (action === "go-offers" || action === "go-contact") {
        const target = document.getElementById(action === "go-offers" ? "v8ParentAppointments" : "v12Contact");
        target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        return;
      }
      if (action === "photo") return showPhoto(index);
      if (action === "favorite") {
        const local = state().v12 ||= {}; const previous = !!local.favorite; local.favorite = !previous;
        if (!deps.save()) { local.favorite = previous; return; }
        button.setAttribute("aria-pressed", String(local.favorite)); button.innerHTML = ic("heart", "s") + (local.favorite ? " Fiche enregistrée" : " Garder cette fiche");
        deps.toast(local.favorite ? "Fiche conservée dans les favoris de cet appareil." : "Fiche retirée des favoris."); return;
      }
      if (action === "share") {
        const url = new URL("/", location.origin); url.searchParams.set("vue", "parents");
        deps.showModal("Partager l’aperçu", "", `<p>Ce lien ouvre le profil fictif de démonstration. Les modifications et messages enregistrés sur ton appareil ne sont pas partagés.</p><label class="field"><span>Lien de l’aperçu</span><input id="v12ShareLink" readonly value="${esc(url.href)}"></label><button type="button" class="btn" data-v12="copy-link">Copier le lien</button><p id="v12ShareStatus" role="status" class="fine"></p>`); return;
      }
      if (action === "copy-link") {
        const input = document.getElementById("v12ShareLink");
        try { await navigator.clipboard.writeText(input.value); document.getElementById("v12ShareStatus").textContent = "Lien copié."; }
        catch { input.focus(); input.select(); document.getElementById("v12ShareStatus").textContent = document.execCommand("copy") ? "Lien copié." : "Lien sélectionné. Copie-le avec Ctrl ou Cmd C."; }
        return;
      }
      if (action === "remove-message") {
        const previous = state().v12.messages, previousLogs = state().logs;
        const message = previous.find(m => m.id === button.dataset.id);
        state().v12.messages = previous.filter(m => m.id !== button.dataset.id);
        if (message?.notificationId) state().logs = state().logs.filter(log => log.id !== message.notificationId);
        if (!deps.save()) { state().v12.messages = previous; state().logs = previousLogs; return; }
        document.querySelector(".v12-inbox").outerHTML = inboxHTML(); return;
      }
      if (!["add-faq", "remove-faq", "remove-photo"].includes(action)) return;
      refreshDraft();
      if (action === "add-faq") { if (draftFAQ.length >= 12) return deps.toast("Tu peux ajouter jusqu’à 12 questions."); draftFAQ.push({ question: "", answer: "" }); }
      if (action === "remove-faq") draftFAQ.splice(index, 1);
      if (action === "remove-photo") draftGallery.splice(index, 1);
      document.getElementById("v12GalleryEditor").innerHTML = galleryEditor();
      document.getElementById("v12FAQEditor").innerHTML = faqEditor(); refreshDraft();
    }, true);
    return { parents, editor, submit, afterRender: filterOffers };
  }
  return { normalise, list, safeURL, safeImage, matchesOffer, nextAppointment, itineraryURL, create };
});
