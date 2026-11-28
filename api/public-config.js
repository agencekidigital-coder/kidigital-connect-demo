// Public configuration is shared with the Cloudflare entry point.
const { readPublicConfig } = require('../server/public-config.cjs');

function createHandler({ env = process.env } = {}) {
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Méthode non autorisée.' });
    }
    const config = readPublicConfig(env);
    if (!config) return res.status(503).json({ error: 'Configuration Supabase indisponible.' });
    return res.status(200).json(config);
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
