// Turns a product URL into a deal draft.
//
// This is the path that works everywhere. A store's *search* page is often closed to
// servers, but a *product* page is the page they want indexed, so it usually carries
// machine-readable metadata: a JSON-LD Product block, or failing that OpenGraph tags. Both
// are published deliberately for exactly this purpose, so reading them needs no guesswork.
//
// Order of preference: JSON-LD (richest) -> OpenGraph/meta -> visible price text.
const cheerio = require('cheerio');
const { getHtml } = require('./http');
const { money, ratingFrom, pricesIn } = require('./parse');
const { detectStore } = require('../utils/affiliate');

/** Walks a JSON-LD blob, which may be a graph, an array, or a single node. */
function* walkJsonLd(node) {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJsonLd(item);
    return;
  }
  if (!node || typeof node !== 'object') return;
  yield node;
  if (node['@graph']) yield* walkJsonLd(node['@graph']);
}

const typeOf = (node) => []
  .concat(node['@type'] || [])
  .map((t) => String(t).toLowerCase());

/** The first schema.org Product in the page's JSON-LD, if there is one. */
function findProductNode($) {
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    let parsed;
    try {
      parsed = JSON.parse($(element).contents().text());
    } catch {
      continue; // a malformed block is not worth failing the whole import over
    }
    for (const node of walkJsonLd(parsed)) {
      if (typeOf(node).includes('product')) return node;
    }
  }
  return null;
}

/** offers can be an object, an array, or an AggregateOffer wrapping more offers. */
function offerFrom(node) {
  for (const offer of [].concat(node?.offers || [])) {
    if (!offer || typeof offer !== 'object') continue;
    if (offer.price ?? offer.lowPrice) return offer;
    if (offer.offers) {
      const nested = offerFrom(offer);
      if (nested) return nested;
    }
  }
  return null;
}

const firstString = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === 'object') return firstString(value.url || value.name || value['@id']);
  return null;
};

function fromJsonLd(node) {
  if (!node) return null;

  const offer = offerFrom(node);
  const price = money(offer?.price ?? offer?.lowPrice);
  if (!price) return null; // no price means nothing publishable

  return {
    title: firstString(node.name),
    price,
    // Stores put the pre-discount figure in different places depending on the template.
    mrp: money(offer?.priceSpecification?.price ?? node.highPrice ?? offer?.highPrice),
    brand: firstString(node.brand),
    image_url: firstString(node.image),
    rating: ratingFrom(node.aggregateRating?.ratingValue),
    description: typeof node.description === 'string' ? node.description : null,
    source: 'structured data',
  };
}

function fromMetaTags($) {
  const meta = (name) =>
    $(`meta[property="${name}"]`).attr('content') || $(`meta[name="${name}"]`).attr('content') || null;

  const price = money(
    meta('product:price:amount') || meta('og:price:amount') || meta('twitter:data1')
  );

  return {
    title: meta('og:title') || $('title').first().text().trim() || null,
    price,
    mrp: null,
    brand: meta('og:brand') || meta('product:brand') || null,
    image_url: meta('og:image') || null,
    rating: null,
    description: meta('og:description') || null,
    source: 'page tags',
  };
}

/**
 * Last resort: the largest and smallest rupee amounts on the page. Deliberately cautious —
 * it returns a draft flagged as unverified rather than a confident-looking wrong price.
 */
function fromVisibleText($) {
  const amounts = pricesIn($('body').text()).filter((n) => n >= 1);
  if (!amounts.length) return null;
  return { price: amounts[0], mrp: null, source: 'visible price text' };
}

/**
 * Resolves one URL. Returns { ok, draft } or { ok: false, error } — never throws, because
 * one bad link out of twenty pasted should not fail the other nineteen.
 */
async function resolveUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return { ok: false, url: String(rawUrl), error: 'Not a valid URL' };
  }

  const page = await getHtml(url.toString());
  if (!page.ok) {
    return {
      ok: false,
      url: url.toString(),
      error: page.blocked
        ? 'The store blocked the request. Open the page in your browser and add it manually.'
        : page.error || 'Could not read that page',
    };
  }

  const $ = cheerio.load(page.html);

  const structured = fromJsonLd(findProductNode($));
  const tags = fromMetaTags($);

  // Merge: structured data wins field by field, tags fill the gaps.
  const draft = {
    title: structured?.title || tags.title,
    price: structured?.price ?? tags.price,
    mrp: structured?.mrp ?? tags.mrp,
    brand: structured?.brand || tags.brand,
    image_url: structured?.image_url || tags.image_url,
    rating: structured?.rating ?? tags.rating,
    description: structured?.description || tags.description,
    source: structured ? structured.source : 'page tags',
  };

  if (!draft.price) {
    const guessed = fromVisibleText($);
    if (guessed) {
      draft.price = guessed.price;
      draft.source = guessed.source;
    }
  }

  if (!draft.title) return { ok: false, url: url.toString(), error: 'No product name on that page' };
  if (!draft.price) {
    return { ok: false, url: url.toString(), error: 'No price found — add this one manually' };
  }
  if (draft.mrp && draft.mrp <= draft.price) draft.mrp = null;

  // Titles from <title> tags carry the store's name; trim the noise.
  draft.title = draft.title.replace(/\s*[|:-]\s*(Amazon\.in|Flipkart\.com).*$/i, '').trim();

  return {
    ok: true,
    draft: {
      ...draft,
      url: url.toString(),
      store: detectStore(url.toString()),
      // A price read off the visible page is a guess about layout, not a published fact.
      needs_check: draft.source === 'visible price text',
    },
  };
}

module.exports = { resolveUrl, findProductNode, fromJsonLd, fromMetaTags };
