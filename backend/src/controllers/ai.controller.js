// AI finder endpoints. These only ever *suggest* — approving a suggestion goes through
// the normal POST /api/admin/deals/bulk path, so an AI-added deal is validated by exactly
// the same code as a hand-typed one.
const { all, get } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { slugify } = require('../utils/slug');
const { STORES, STORE_KEYS, validateAffiliateUrl, detectStore } = require('../utils/affiliate');
const { describe, suggest, MAX_SUGGESTIONS } = require('../utils/ai.service');

/**
 * Lets the admin page show "not configured" - and which key to add - instead of failing
 * on the first search.
 */
const aiStatus = asyncHandler(async (req, res) => {
  res.json(describe());
});

const clean = (value, max) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
};

/** Numbers arrive as "₹1,299" often enough to be worth stripping rather than rejecting. */
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
 * Turns one raw model suggestion into either a deal draft the admin can approve, or a
 * rejection with a reason. Everything the model says about a URL is re-checked here —
 * the same host allow-list /go/:id enforces, so a bad suggestion can never reach the form.
 */
function vet(raw, { category, seenUrls, seenSlugs }) {
  const title = clean(raw?.title, 200);
  if (!title || title.length < 3) return { ok: false, title: title || '(no title)', reason: 'No usable title' };

  const rawUrl = clean(raw?.url, 600);
  if (!rawUrl) return { ok: false, title, reason: 'No product link' };

  const check = validateAffiliateUrl(rawUrl);
  if (!check.ok) return { ok: false, title, reason: check.error };

  const url = check.url.toString();
  const store = STORE_KEYS.includes(raw?.store) ? raw.store : detectStore(url);
  if (!store) return { ok: false, title, reason: 'Could not tell which store the link is for' };

  // A search or category page passes the domain check but is not a deal.
  if (!looksLikeProductPage(check.url, store, check.host)) {
    return { ok: false, title, reason: 'Not a product page (looks like a search or listing page)' };
  }

  const price = toNumber(raw?.price);
  if (price === null || price <= 0) return { ok: false, title, reason: 'No usable price' };

  let mrp = toNumber(raw?.mrp);
  const warnings = [];
  if (mrp !== null && mrp < price) {
    mrp = null; // the API would reject it; drop it rather than lose the whole suggestion
    warnings.push('Dropped an MRP that was lower than the price');
  }

  let rating = toNumber(raw?.rating);
  if (rating !== null && (rating < 0 || rating > 5)) rating = null;

  if (raw?.confidence === 'low') {
    warnings.push('The finder was unsure about this link or price — open it before approving');
  }

  // Duplicate detection is per-request as well as against the catalogue, because one
  // search often turns up the same product twice — same link, or the same name from two
  // result pages.
  const slug = slugify(title);
  if (seenUrls.has(url) || seenSlugs.has(slug)) {
    return { ok: false, title, reason: 'Duplicate of another suggestion' };
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
    confidence: ['high', 'medium', 'low'].includes(raw?.confidence) ? raw.confidence : 'medium',
    warnings,
  };
}

/**
 * POST /api/admin/ai/suggest — search the stores and return drafts to approve.
 * Read-only: nothing is written to the deals table here.
 */
const suggestDeals = asyncHandler(async (req, res) => {
  const query = clean(req.body?.query, 120);
  if (!query || query.length < 2) {
    throw new ApiError(400, 'Type what to search for, for example "cotton t shirt".');
  }

  const category = clean(req.body?.category, 80) || 'Other';

  const requested = Array.isArray(req.body?.stores) ? req.body.stores : [];
  const stores = requested.filter((s) => STORE_KEYS.includes(s));
  if (!stores.length) stores.push(...STORE_KEYS);

  const count = Math.min(MAX_SUGGESTIONS, Math.max(1, Number(req.body?.count) || 8));

  // Showing the model what is already published stops it suggesting the same deals again.
  const published = await all(
    `SELECT title FROM deals WHERE category = ? OR title ILIKE ?
     ORDER BY created_at DESC LIMIT 40`,
    category,
    `%${query}%`
  );

  const result = await suggest({
    query,
    category,
    stores,
    count,
    existingTitles: published.map((r) => r.title),
  });

  const suggestions = [];
  const rejected = [];
  const seenUrls = new Set();
  const seenSlugs = new Set();

  for (const raw of result.products.slice(0, count)) {
    const vetted = vet(raw, { category, seenUrls, seenSlugs });
    if (!vetted.ok) {
      rejected.push({ title: vetted.title, reason: vetted.reason });
      continue;
    }

    // Already in the catalogue? Still show it, but flagged, so the admin does not
    // accidentally publish the same product twice.
    // eslint-disable-next-line no-await-in-loop -- one small indexed lookup per suggestion
    const existing = await get(
      'SELECT id, title FROM deals WHERE affiliate_url = ? OR slug = ? LIMIT 1',
      vetted.deal.affiliate_url,
      vetted.slug
    );

    suggestions.push({
      ...vetted.deal,
      confidence: vetted.confidence,
      warnings: vetted.warnings,
      already_published: existing ? { id: existing.id, title: existing.title } : null,
    });
  }

  res.json({
    query,
    category,
    stores,
    note: result.note,
    searches: result.searches,
    model: result.model,
    suggestions,
    rejected,
  });
});

module.exports = { aiStatus, suggestDeals };
