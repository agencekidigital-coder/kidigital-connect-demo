// Optional, read-only Google Places connection. No Supabase or Stripe access.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const place = process.env.GOOGLE_PLACES_PLACE_ID;
  const configured = Boolean(key && /^[A-Za-z0-9_-]{10,256}$/.test(place || ""));
  if (req.query.status === "1") return res.status(200).json({ configured, provider: "google-places" });
  if (!configured) return res.status(503).json({
    code: "GOOGLE_NOT_CONFIGURED",
    error: "La connexion Google Places n’est pas activée. Une clé serveur et l’identifiant de ta fiche sont nécessaires. La saisie manuelle reste disponible.",
  });
  // A client cannot choose another establishment or spend quota on a search.
  if (req.query.placeId && req.query.placeId !== place) return res.status(400).json({ error: "Seule la fiche Google configurée est accessible." });
  try {
    const response = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(place) + "?languageCode=fr", {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,googleMapsUri,attributions",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) return res.status(502).json({ error: "Google n’a pas pu fournir la note. Vérifie l’activation de Places API, les restrictions de la clé et la fiche configurée." });
    const data = await response.json();
    if (data.id !== place || typeof data.displayName?.text !== "string") throw Error("invalid-place");
    const rating = typeof data.rating === "number" && data.rating >= 0 && data.rating <= 5 ? data.rating : null;
    const count = Number.isInteger(data.userRatingCount) && data.userRatingCount >= 0 ? data.userRatingCount : 0;
    let url = "https://www.google.com/maps/search/?api=1&query=Google&query_place_id=" + encodeURIComponent(place);
    if (data.googleMapsUri) {
      const parsed = new URL(data.googleMapsUri);
      if (parsed.protocol === "https:" && (parsed.hostname === "google.com" || parsed.hostname.endsWith(".google.com") || parsed.hostname === "maps.app.goo.gl")) url = parsed.href;
    }
    return res.status(200).json({
      business: data.displayName.text.slice(0, 250),
      rating, count, url,
      fetchedAt: new Date().toISOString(),
      attributions: (Array.isArray(data.attributions) ? data.attributions : []).map(a => {
        let uri = "";
        try { const link = new URL(a.providerUri); if (link.protocol === "https:") uri = link.href; } catch {}
        return { name: String(a.provider || "").slice(0, 250), uri };
      }),
    });
  } catch {
    return res.status(502).json({ error: "La fiche Google est temporairement indisponible. Aucun chiffre n’a été remplacé." });
  }
};
