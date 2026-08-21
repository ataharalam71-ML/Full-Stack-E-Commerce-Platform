// Flipkart search adapter.
//
// Flipkart ships obfuscated class names ("atJtCj") that change without notice, so nothing
// here depends on them. The two stable facts on the page are that a product link contains
// `/p/itm`, and that the card's title is the anchor's `title` attribute. Price and image
// are read from the card's surrounding container by shape, not by class.
const cheerio = require('cheerio');
const { getHtml } = require('./http');
const { text, money, ratingFrom, pricesIn } = require('./parse');

const ORIGIN = 'https://www.flipkart.com';

const searchUrl = (query) => `${ORIGIN}/search?q=${encodeURIComponent(query)}`;

/** Drops the search's tracking query string but keeps `pid`, which Flipkart needs. */
function productUrl(href) {
  const url = new URL(href, ORIGIN);
  const pid = url.searchParams.get('pid');
  url.search = pid ? `?pid=${pid}` : '';
  url.hash = '';
  return url.toString();
}

const itemId = (href) => (href.match(/\/p\/(itm[a-z0-9]+)/i) || [])[1] || null;

/**
 * Finds the element that is exactly this product's card.
 *
 * The boundary is defined by content, not by class or depth: keep climbing while the
 * ancestor still contains exactly one product link, and stop the moment it contains two.
 * That is what a card *is*, so it survives a redesign.
 *
 * Stopping at the first ancestor that merely contains a price is not enough — Flipkart
 * puts the price and the thumbnail in sibling columns, so that lands on the text column
 * and the image is never found. Climbing to the last single-product ancestor gets both.
 */
function cardFor($, anchor) {
  let card = anchor;
  let node = anchor;

  for (let depth = 0; depth < 8; depth += 1) {
    const parent = node.parent();
    if (!parent.length) break;
    node = parent;

    const ids = new Set((node.html() || '').match(/\/p\/itm[a-z0-9]+/gi) || []);
    if (ids.size > 1) break; // crossed into a neighbouring product — the last one was the card
    card = node;
  }

  return card;
}

/** Flipkart serves some assets protocol-relative ("//host/path"). */
const absolute = (src) => {
  if (!src) return null;
  if (src.startsWith('//')) return `https:${src}`;
  return /^https?:\/\//i.test(src) ? src : null;
};

/**
 * The product thumbnail. Flipkart's own CDN is rukminim*.flixcart.com; anything else in a
 * card is a badge or a rating icon, so a generic "first image" would pick up the wrong one.
 */
function imageIn($, card, id) {
  const fromCard = card.find('img[src*="rukminim"]').first().attr('src');
  if (fromCard) return absolute(fromCard);

  // Fallback: the thumbnail sits inside one of the other anchors for the same product.
  const sibling = $(`a[href*="${id}"]`).find('img[src*="rukminim"]').first().attr('src');
  return absolute(sibling);
}

/**
 * Rupee amounts from the card's leaf elements, in the order they appear. Only elements with
 * no element children are considered, so a wrapper that happens to contain a single price
 * does not report it twice.
 */
function leafPrices($, card) {
  const amounts = [];
  card.find('*').each((_, element) => {
    const node = $(element);
    if (node.children().length) return;
    const own = node.text().trim();
    if (/^₹\s?[\d,]+(\.\d+)?$/.test(own)) {
      const value = money(own);
      if (value !== null) amounts.push(value);
    }
  });
  // Fall back to scanning the merged text only if the markup gave us nothing at all.
  return amounts.length ? amounts : pricesIn(card.text());
}

function parse(html, limit) {
  const $ = cheerio.load(html);
  const products = [];
  const seen = new Set();

  $('a[href*="/p/itm"]').each((_, element) => {
    if (products.length >= limit) return false;

    const anchor = $(element);
    const href = anchor.attr('href') || '';
    const id = itemId(href);
    if (!id || seen.has(id)) return undefined;

    // Several anchors point at the same product; only the titled one names it.
    const title = (anchor.attr('title') || text(anchor)).trim();
    if (!title || title.length < 5) return undefined;

    const card = cardFor($, anchor);
    const blob = card.text();

    // Flipkart prints the selling price first, then the struck-through MRP. Read them from
    // the leaf elements that hold them rather than from the card's merged text: the card
    // renders as "₹232₹69966% off", where "₹699" and "66% off" run together and no regex
    // can reliably tell 699 from 69966. One element per price has no such ambiguity.
    const amounts = leafPrices($, card);
    const price = amounts[0] ?? null;
    if (!price) return undefined;

    const mrp = amounts.find((n) => n > price) ?? null;

    // The card reads "BRAND" + "Title" + prices, so whatever sits in front of the title
    // is the brand. Anything implausibly long is prose, not a brand.
    const beforeTitle = blob.split(title)[0].trim();
    const brand = beforeTitle && beforeTitle.length <= 40 ? beforeTitle : null;

    const image = imageIn($, card, id);

    seen.add(id);
    products.push({
      store: 'flipkart',
      title,
      url: productUrl(href),
      price,
      mrp,
      rating: ratingFrom((blob.match(/([0-5](?:\.\d)?)\s*(?:★|out of 5)/) || [])[1]),
      image_url: image,
      brand,
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

module.exports = { key: 'flipkart', label: 'Flipkart', search, searchUrl, parse };
