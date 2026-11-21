// Fonction Vercel : ne retourne QUE les informations publiques de Supabase.
// Les clés secrètes Stripe et Supabase ne doivent jamais être envoyées au navigateur.
module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return res.status(503).json({ error: 'Configuration Supabase indisponible.' });
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      return res.status(503).json({ error: 'Adresse Supabase invalide.' });
    }
  } catch (_) {
    return res.status(503).json({ error: 'Adresse Supabase invalide.' });
  }
  return res.status(200).json({ url, publishableKey });
};
