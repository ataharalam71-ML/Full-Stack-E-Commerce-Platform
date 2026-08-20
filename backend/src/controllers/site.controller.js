// Public site metadata + SEO files. Affiliate traffic is mostly organic search, so the
// sitemap matters as much as the pages themselves.
const { all } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const { getSetting, publicStores } = require('../utils/affiliate');

const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const SITE_URL = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Branding the frontend renders in the navbar/footer, editable in Admin -> Settings. */
const siteInfo = asyncHandler(async (req, res) => {
  res.json({
    site: {
      name: await getSetting('site_name', 'DealDost'),
      tagline: await getSetting('site_tagline', 'Handpicked deals from Amazon, Flipkart & Meesho'),
      contact_email: await getSetting('contact_email', ''),
      url: SITE_URL(),
    },
    stores: publicStores(),
  });
});

const XML_ESCAPES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => XML_ESCAPES[c]);

const sitemap = asyncHandler(async (req, res) => {
  const base = SITE_URL();
  const deals = await all(
    'SELECT slug, updated_at FROM deals WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 5000'
  );

  const staticPaths = ['/', '/about', '/contact', '/affiliate-disclosure', '/privacy'];
  const urls = [
    ...staticPaths.map((p) => `  <url><loc>${base}${p}</loc><changefreq>daily</changefreq></url>`),
    ...deals.map((d) => {
      const lastmod = new Date(d.updated_at).toISOString().slice(0, 10);
      return `  <url><loc>${base}/deal/${escapeXml(d.slug)}</loc><lastmod>${lastmod}</lastmod></url>`;
    }),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="${SITEMAP_NS}">`,
    ...urls,
    '</urlset>',
  ].join('\n');

  res.type('application/xml').send(xml);
});

/**
 * robots.txt is generated rather than shipped as a static file, so the Sitemap line always
 * matches SITE_URL instead of whatever host it was last edited for.
 */
const robots = asyncHandler(async (req, res) => {
  const base = SITE_URL();
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      '',
      '# Affiliate redirects must not be crawled or indexed.',
      'Disallow: /go/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

module.exports = { siteInfo, sitemap, robots };
