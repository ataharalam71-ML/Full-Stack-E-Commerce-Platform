// Amazon India search adapter.
//
// Every result card carries a `data-asin`, which is the one thing on the page that is
// stable. Everything else is read relative to that card, and any card missing a title,
// a price or an ASIN is skipped rather than half-filled.
const cheerio = require('cheerio');
const { getHtml } = require('./http');
const { text, money, ratingFrom } = require('./parse');

const ORIGIN = 'https://www.amazon.in';

const searchUrl = (query) => `${ORIGIN}/s?k=${encodeURIComponent(query)}&ref=nb_sb_noss`;

/** A bare /dp/ASIN link: short, permanent, and free of the search's tracking parameters. */
const productUrl = (asin) => `${ORIGIN}/dp/${asin}`;

function parse(html, limit) {
  const $ = cheerio.load(html);
  const products = [];

  $('div[data-asin]').each((_, element) => {
    if (products.length >= limit) return false;

    const card = $(element);
    const asin = (card.attr('data-asin') || '').trim();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return undefined;

    // Sponsored slots and carousels reuse data-asin, so require an actual result card.
    if (!card.is('[data-component-type="s-search-result"]')) return undefined;

    const title =
      text(card.find('[data-cy="title-recipe"] h2 span').first()) ||
      text(card.find('h2 span').first()) ||
      text(card.find('.a-size-base-plus').first());
    if (!title) return undefined;

    // .a-price-whole is the rupees; .a-offscreen is the whole formatted price. Prefer
    // offscreen when present because it survives the fractional-paise markup.
    const price =
      money(text(card.find('.a-price:not(.a-text-price) .a-offscreen').first())) ??
      money(text(card.find('.a-price-whole').first()));
    if (!price) return undefined;

    // The struck-through "M.R.P." is marked a-text-price.
    const mrp = money(text(card.find('.a-price.a-text-price .a-offscreen').first()));

    products.push({
      store: 'amazon',
      title,
      url: productUrl(asin),
      price,
      mrp: mrp && mrp > price ? mrp : null,
      rating: ratingFrom(text(card.find('.a-icon-alt').first())),
      image_url: card.find('img.s-image').attr('src') || null,
      brand: null, // Amazon's search cards do not carry a reliable brand field
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

module.exports = { key: 'amazon', label: 'Amazon', search, searchUrl, parse };
