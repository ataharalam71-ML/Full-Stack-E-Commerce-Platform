// The gate every candidate deal passes before an admin ever sees it.
//
// This used to guard against a model inventing links. It still earns its place with a
// deterministic finder: a search page can return a category tile instead of a product, a
// parser can misread a price, and the same product turns up twice in one search. Nothing
// gets to the review grid without passing here.
const { STORES, STORE_KEYS, validateAffiliateUrl, detectStore } = require('../utils/affiliate');
const { slugify } = require('../utils/slug');

const clean = (value, max) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
};

/** Prices arrive as "₹1,299" often enough to be worth stripping rather than rejecting. */
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// What a real product page looks like at each store. Checking for these positively is
// safer than trying to spot search pages: Flipkart product links routinely carry a `q=`
// parameter copied from the search that led to them, so a "looks like a search" rule
// throws away good links. A network shortlink (EarnKaro etc.) hides its path, so it passes.
const PRODUCT_PATHS = {
  amazon: [/\/dp\/[A-Z0-9]{10}/i, /\/gp\/product\/[A-Z0-9]{10}/i],
  flipkart: [/\/p\/itm[a-z0-9]+/i, /\/p\/[a-z0-9]+/i],
  meesho: [/\/p\/[a-z0-9]+/i, /\/product\/[a-z0-9-]+/i],
};

function looksLikeProductPage(url, store, host) {
  const isStoreLink = STORES[store].domains.some((d) => host === d || host.endsWith(`.${d}`));
  if (!isStoreLink) return true; // an affiliate-network shortlink — the path tells us nothing

  // Shortened store links (amzn.to, fkrt.cc) also carry no readable path.
  if (/^(amzn\.|fkrt\.|dl\.flipkart\.com)/.test(host)) return true;

  return (PRODUCT_PATHS[store] || []).some((re) => re.test(url.pathname));
}

/**
 * Turns one raw candidate into either a deal draft the admin can approve, or a rejection
 * with a reason. The URL is re-checked against the same host allow-list that /go/:id
 * enforces, so a link the site could never redirect to cannot reach the form.
 */
function vet(raw, { category, seenUrls, seenSlugs }) {
  const title = clean(raw?.title, 200);
  if (!title || title.length < 3) {
    return { ok: false, title: title || '(no title)', reason: 'No usable title' };
  }

  const rawUrl = clean(raw?.url, 600);
  if (!rawUrl) return { ok: false, title, reason: 'No product link' };

  const check = validateAffiliateUrl(rawUrl);
  if (!check.ok) return { ok: false, title, reason: check.error };

  const url = check.url.toString();

  // The link decides which store this is — never the caller's claim about it. Get this
  // backwards and a Flipkart link saved as "amazon" gets no affiliate tag on redirect,
  // because the tag is looked up per store: the click happens and the commission is lost.
  // The claimed store is only a fallback, for affiliate-network shortlinks whose host
  // hides the real destination.
  const detected = detectStore(url);
  const claimed = STORE_KEYS.includes(raw?.store) ? raw.store : null;
  const store = detected || claimed;
  if (!store) return { ok: false, title, reason: 'Could not tell which store the link is for' };

  // A search or category page passes the domain check but is not a deal.
  if (!looksLikeProductPage(check.url, store, check.host)) {
    return { ok: false, title, reason: 'Not a product page (looks like a search or listing page)' };
  }

  const price = toNumber(raw?.price);
  if (price === null || price <= 0) return { ok: false, title, reason: 'No usable price' };

  const warnings = [];

  let mrp = toNumber(raw?.mrp);
  if (mrp !== null && mrp < price) {
    mrp = null; // the API would reject it; drop it rather than lose the whole candidate
    warnings.push('Dropped an MRP that was lower than the price');
  }
  // A "90% off" that is really a parsing slip is worth a second look before publishing.
  if (mrp !== null && mrp > price * 20) {
    warnings.push('That discount looks too big to be real — check the price on the store');
  }

  let rating = toNumber(raw?.rating);
  if (rating !== null && (rating < 0 || rating > 5)) rating = null;

  if (raw?.needs_check) {
    warnings.push('The price was read off the page layout — open the link and confirm it');
  }

  // Duplicate detection is per-request as well as against the catalogue, because one
  // search often turns up the same product twice — same link, or the same name from two
  // result pages.
  const slug = slugify(title);
  if (seenUrls.has(url) || seenSlugs.has(slug)) {
    return { ok: false, title, reason: 'Duplicate of another result' };
  }
  seenUrls.add(url);
  seenSlugs.add(slug);

  return {
    ok: true,
    deal: {
      title,
      affiliate_url: url,
      store,
      price,
      mrp,
      rating,
      brand: clean(raw?.brand, 80),
      description: clean(raw?.description, 2000),
      image_url: clean(raw?.image_url, 600),
      category: clean(raw?.category, 80) || category,
      coupon_code: null,
      is_featured: false,
      is_active: true,
    },
    slug,
    warnings,
  };
}

module.exports = { vet, looksLikeProductPage, PRODUCT_PATHS };
