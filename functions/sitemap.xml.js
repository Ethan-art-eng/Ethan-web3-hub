const STATIC_PATHS = [
  ["/", "0.9"], ["/airdrops/", "0.8"], ["/wealth/", "0.8"], ["/toolbox/", "0.8"], ["/courses/", "0.9"],
  ["/courses/wallet-security/", "0.7"], ["/courses/onchain-basics/", "0.7"], ["/courses/defi-basics/", "0.7"], ["/courses/project-research/", "0.7"],
  ["/courses/okx-technical-analysis-19-ma/", "0.7"], ["/courses/okx-technical-analysis-20-volume/", "0.7"],
  ["/courses/okx-technical-analysis-21-boll/", "0.7"], ["/courses/okx-technical-analysis-22-macd/", "0.7"],
  ["/courses/okx-technical-analysis-23-kdj/", "0.7"], ["/courses/okx-technical-analysis-24-rsi/", "0.7"],
  ["/courses/okx-technical-analysis-25-sar/", "0.7"], ["/courses/okx-technical-analysis-26-td-sequential/", "0.7"],
  ["/courses/okx-technical-analysis-27-okx-trading-data/", "0.7"], ["/courses/okx-technical-analysis-28-multi-indicator-practice/", "0.7"],
];

function xmlEscape(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function onRequestGet({ env }) {
  let articles = [];
  if (env.CONTENT_DB) {
    try {
      const result = await env.CONTENT_DB.prepare("SELECT slug, updated_at FROM articles WHERE status = 'published' AND access_level = 'public' ORDER BY updated_at DESC").all();
      articles = result.results || [];
    } catch {}
  }
  const staticUrls = STATIC_PATHS.map(([path, priority]) => `<url><loc>https://ethanweb3.com${path}</loc><changefreq>${path === "/" || path === "/courses/" ? "weekly" : "monthly"}</changefreq><priority>${priority}</priority></url>`).join("");
  const articleUrls = articles.map((article) => `<url><loc>https://ethanweb3.com/articles/${xmlEscape(encodeURIComponent(article.slug))}/</loc><lastmod>${xmlEscape(String(article.updated_at || "").slice(0, 10))}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${articleUrls}</urlset>`, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
