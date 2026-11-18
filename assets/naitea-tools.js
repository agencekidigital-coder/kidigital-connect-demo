/* Shared, deterministic helpers for the local Naïtéa workspace. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NaiteaTools = api;
})(globalThis, function () {
  const legacyBrand = /kidigital\s+connect/gi;
  function renameText(text) {
    // Keep working URLs, data URLs and the storage namespace intact.
    return String(text).split(/(https?:\/\/[^\s<>"']+|data:[^\s]+|kidigital-connect-v\d+)/gi)
      .map((part, i) => i % 2 ? part : part.replace(legacyBrand, "Naïtéa")).join("");
  }
  function renameBrand(value) {
    if (typeof value === "string") return renameText(value);
    if (Array.isArray(value)) return value.map(renameBrand);
    if (value && typeof value === "object")
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renameBrand(v)]));
    return value;
  }
  const email = value => String(value || "").trim().toLocaleLowerCase("fr");
  function familyLinks(family, state) {
    const matches = row => row.familyId === family.id || email(row.email) === email(family.email);
    const workshopIds = new Set((state.signups || []).filter(row => matches(row) && row.status !== "cancelled").map(row => row.eventId));
    const offerIds = new Set([
      ...(state.leads || []).filter(matches).map(row => row.offerId),
      ...(state.v8?.appointments || []).filter(row => matches(row) && row.status !== "cancelled").map(row => row.offerId),
    ]);
    return {
      workshops: (state.events || []).filter(row => workshopIds.has(row.id)),
      offers: (state.offers || []).filter(row => offerIds.has(row.id)),
    };
  }
  function filterFamilies(state, { query = "", type = "all", service = "", sort = "asc" } = {}) {
    const needle = query.trim().toLocaleLowerCase("fr");
    return (state.family || []).filter(f => {
      const links = familyLinks(f, state);
      if (type === "workshop" && !links.workshops.length) return false;
      if (type === "offer" && !links.offers.length) return false;
      if (type === "none" && (links.workshops.length || links.offers.length)) return false;
      if (service && ![...links.workshops.map(e => "workshop:" + e.id), ...links.offers.map(o => "offer:" + o.id)].includes(service)) return false;
      return [f.name, f.email, f.interest, ...links.workshops.map(e => e.title), ...links.offers.map(o => o.title)].join(" ").toLocaleLowerCase("fr").includes(needle);
    }).sort((a, b) => (sort === "desc" ? -1 : 1) * a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }
  class DesignHistory {
    constructor(limit = 50) { this.before = []; this.after = []; this.limit = limit; this.saved = ""; }
    record(design) {
      const value = JSON.stringify(design);
      if (this.before.at(-1) !== value) this.before.push(value);
      this.before = this.before.slice(-this.limit);
    }
    commit(design) {
      const value = JSON.stringify(design);
      if (this.saved && this.saved !== value) this.after = [];
      this.saved = value;
    }
    canUndo(design) { const value = JSON.stringify(design); return this.before.some(v => v !== value); }
    canRedo(design) { const value = JSON.stringify(design); return this.after.some(v => v !== value); }
    restore(design, from, to) {
      const value = JSON.stringify(design);
      while (from.at(-1) === value) from.pop();
      if (!from.length) return null;
      to.push(value);
      const previous = from.pop();
      this.saved = previous;
      return JSON.parse(previous);
    }
    undo(design) { return this.restore(design, this.before, this.after); }
    redo(design) { return this.restore(design, this.after, this.before); }
  }
  const templates = [
    { id: "rencontre", name: "Rencontre", description: "Photo et présentation de l’atelier" },
    { id: "editorial", name: "Éditorial", description: "Texte et photo en deux colonnes" },
    { id: "conseil", name: "Conseil", description: "Une idée à partager avec les familles" },
    { id: "portrait", name: "Présentation", description: "Mettre en valeur ton activité" },
    { id: "offres", name: "Accompagnements", description: "Présenter plusieurs offres" },
    { id: "agenda", name: "Agenda", description: "Les rendez-vous du mois" },
  ];
  function buildTemplate(id, context) {
    if (!templates.some(t => t.id === id)) throw Error("Modèle inconnu");
    const { brand = {}, profile = {}, event = {}, events = [], offers = [], month = "", kind = "studio", photo = "/assets/photos/family-5.jpg" } = context;
    const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || "") ? value : fallback;
    const accent = color(brand.accent, "#B97682"), ink = color(brand.text, "#5B3A48"), cream = color(brand.third, "#FFF7F1");
    const titleFont = brand.titleFont || "Lora", bodyFont = brand.bodyFont || "DM Sans";
    let next = 0;
    const layers = [], add = l => layers.push({ id: "model-" + (++next), ...l });
    const text = (value, x, y, w, size, more = {}) => add({ type: "text", text: value, x, y, w, size, font: bodyFont, weight: 400, color: ink, ...more });
    const shape = (x, y, w, h, fill, radius = 0) => add({ type: "shape", x, y, w, h, fill, radius });
    const image = (x, y, w, h, src = photo, more = {}) => add({ type: "image", src, x, y, w, h, fit: "cover", positionX: src.includes("family-5.jpg") ? 80 : 50, positionY: 50, ...more });
    const name = brand.name || [profile.first, profile.last].filter(Boolean).join(" ") || "Mon activité";
    const title = event.title || "Notre prochain atelier";
    const date = event.date ? new Date(event.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "Prochaine date";
    const details = [date, event.time, event.place].filter(Boolean).join(" · ");
    const contact = profile.website || profile.email || "Prendre rendez-vous";
    const heading = { font: titleFont, weight: 700 };
    if (id === "rencontre") {
      image(0, 0, 100, 45);
      shape(6, 39, 88, 55, cream, 2);
      text(name, 11, 44, 78, 22);
      text(title, 11, 51, 78, 58, heading);
      text(details, 11, 72, 78, 25);
      text(contact, 11, 86, 78, 21);
    } else if (id === "editorial") {
      shape(0, 0, 53, 100, cream);
      image(53, 0, 47, 100);
      text(name, 7, 8, 39, 24);
      text(title, 7, 23, 40, 62, heading);
      shape(7, 61, 12, 0.7, accent);
      text(details, 7, 67, 39, 25);
      text(contact, 7, 90, 40, 18);
    } else if (id === "conseil") {
      shape(0, 0, 100, 100, cream);
      shape(6, 7, 1, 71, accent);
      text("Le conseil du jour", 12, 9, 78, 25);
      text("Un moment de présence compte autant que les grands gestes.", 12, 22, 78, 62, heading);
      text("Observez votre bébé, respectez son rythme et gardez un temps pour vous.", 12, 59, 52, 27);
      image(72, 65, 21, 24);
      text(name, 12, 90, 75, 22);
    } else if (id === "portrait") {
      shape(0, 0, 100, 100, cream);
      shape(0, 0, 47, 100, accent);
      image(7, 14, 39, 69, profile.photo || photo);
      text(name, 54, 16, 39, 60, heading);
      text(profile.job || "Accompagnement des familles", 54, 45, 39, 30);
      text(profile.city || "Ma zone d’intervention", 54, 65, 39, 25);
      text(contact, 54, 84, 39, 20);
    } else if (id === "offres") {
      shape(0, 0, 100, 100, cream);
      text(name, 8, 7, 84, 25);
      text("Mes accompagnements", 8, 16, 84, 57, heading);
      const rows = offers.slice(0, 3);
      if (!rows.length) rows.push({ title: "Votre accompagnement", price: null, description: "Une offre à personnaliser" });
      rows.forEach((o, i) => {
        const y = 36 + i * 17;
        shape(7, y - 2, 86, 14, i % 2 ? "#F4EAE5" : "#FFFFFF", 1);
        text(o.title, 11, y, 77, 29, heading);
        text(o.price == null ? o.description : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(o.price), 11, y + 7, 77, 23);
      });
      text(contact, 8, 92, 84, 21);
    } else {
      shape(0, 0, 100, 100, cream);
      const label = month ? new Date(month + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "du mois";
      text("Les rendez-vous", 8, 8, 84, 52, heading);
      text(label, 8, 20, 84, 34, { color: accent });
      const rows = events.filter(e => !month || e.date?.startsWith(month)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5);
      if (!rows.length) text("Ajoutez vos prochaines dates", 8, 40, 84, 30);
      rows.forEach((e, i) => {
        const y = 34 + i * 11;
        shape(8, y + 8, 84, 0.15, accent);
        text(new Date(e.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " · " + e.time, 8, y, 25, 24);
        text(e.title, 36, y, 55, 29, heading);
      });
      text(contact, 8, 92, 84, 21);
    }
    return { kind, templateId: id, bg: cream, ink, accent, showLogo: false, showAccent: false, transparent: false, photo: "", brightness: 100, contrast: 100, layers };
  }
  return { renameText, renameBrand, familyLinks, filterFamilies, DesignHistory, templates, buildTemplate };
});
