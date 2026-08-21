// Meesho search adapter.
//
// Meesho's CDN answers 403 to anything that is not a real browser — the search page and
// their internal JSON endpoint both refuse a server outright, and no header combination
// changes that. This adapter therefore exists to *report that clearly* and to work if
// Meesho ever opens up; the supported route for Meesho is the paste-a-link importer or the
// manual form, which the admin panel points at whenever this returns unavailable.
const cheerio = require('cheerio');
const { getHtml } = require('./http');
const { text, money, pricesIn } = require('./parse');

const ORIGIN = 'https://www.meesho.com';

const searchUrl = (query) => `${ORIGIN}/search?q=${encodeURIComponent(query)}`;

function productUrl(href) {
  const url = new URL(href, ORIGIN);
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** Generic card parse: a product link, the nearest price, the nearest image. */
function parse(html, limit) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('a[href*="/p/"]').each((_, element) => {
    if (products.length >= limit) return false;

    const anchor = $(element);
    const href = anchor.attr('href') || '';
    if (!/\/p\/[a-z0-9]+/i.test(href)) return undefined;

    const url = productUrl(href);
    if (seen.has(url)) return undefined;

    const title = (anchor.attr('title') || text(anchor)).trim();
    if (!title || title.length < 5) return undefined;

    const amounts = pricesIn(anchor.closest('div').text());
    const price = amounts[0] ?? null;
    if (!price) return undefined;

    seen.add(url);
    products.push({
      store: 'meesho',
      title,
      url,
      price,
      mrp: amounts.find((n) => n > price) ?? null,
      rating: null,
      image_url: anchor.find('img[src^="http"]').attr('src') || null,
      brand: null,
    });
    return undefined;
  });

  return products;
}

async function search(query, limit) {
  const page = await getHtml(searchUrl(query));
  if (!page.ok) return { products: [], error: page.error, blocked: page.blocked };
  return { products: parse(page.html, limit), error: null, blocked: false };
}

module.exports = {
  key: 'meesho',
  label: 'Meesho',
  search,
  searchUrl,
  parse,
  // Shown in the panel so the admin is not left wondering why this store never returns
  // anything, and knows which route to use instead.
  searchNote: 'Meesho blocks server-side search. Use Paste links or the manual form.',
};
