// Same-origin font delivery: the browser never contacts Google Fonts.
const catalog = require("../assets/font-catalog.json");
const families = new Map(catalog.map((f) => [f.family, f]));
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  const family = typeof req.query.family === "string" ? req.query.family : "";
  const entry = families.get(family);
  if (!entry)
    return res
      .status(400)
      .json({ error: "Police absente du catalogue libre." });
  const weight = Number(
    req.query.weight || (entry.weights.includes(400) ? 400 : entry.weights[0]),
  );
  if (!entry.weights.includes(weight))
    return res
      .status(400)
      .json({ error: "Graisse indisponible pour cette police." });
  try {
    if (req.query.license === "1") {
      const slug = family.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const path of [
        `ofl/${slug}/OFL.txt`,
        `apache/${slug}/LICENSE.txt`,
        `ufl/${slug}/LICENCE.txt`,
      ]) {
        const license = await fetch(
          "https://raw.githubusercontent.com/google/fonts/main/" + path,
          { signal: AbortSignal.timeout(8000), redirect: "manual" },
        );
        if (license.ok) {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.status(200).end(await license.text());
        }
      }
      return res.status(404).json({
        error: "Consulter la licence de cette famille sur fonts.google.com.",
      });
    }
    const cssURL =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family) +
      ":wght@" +
      weight +
      "&display=swap";
    const css = await fetch(cssURL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(12000),
      redirect: "manual",
    });
    if (!css.ok) throw new Error("font-styles-unavailable");
    const sources = [
      ...(await css.text()).matchAll(
        /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g,
      ),
    ];
    // Google lists its Latin subset last; WOFF2 keeps the French editor fast.
    const source = sources.at(-1);
    if (!source) throw new Error("font-file-unavailable");
    const assetURL = new URL(source[1]);
    if (
      assetURL.protocol !== "https:" ||
      assetURL.hostname !== "fonts.gstatic.com"
    )
      throw new Error("invalid-source");
    const asset = await fetch(assetURL, { signal: AbortSignal.timeout(12000), redirect: "manual" });
    if (!asset.ok) throw new Error("font-file-unavailable");
    const content = Buffer.from(await asset.arrayBuffer());
    if (content.length > 4_000_000)
      return res
        .status(413)
        .json({ error: "Police trop volumineuse pour cet aperçu." });
    res.setHeader(
      "Content-Type",
      asset.headers.get("content-type") || "font/ttf",
    );
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Link",
      `</api/font?family=${encodeURIComponent(family)}&weight=${weight}&license=1>; rel="license"`,
    );
    return res.status(200).end(content);
  } catch (error) {
    console.error("Font delivery unavailable:", error.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error:
        "Cette police est temporairement indisponible. La police précédente est conservée.",
    });
  }
};
