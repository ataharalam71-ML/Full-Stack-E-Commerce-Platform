// Public (no-auth) endpoints: browsing deals and clicking through to the store.
const { all, get, run } = require('../config/db');
const { cacheGet, cacheSet } = require('../config/cache');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { STORE_KEYS, publicStores, withAffiliateTag } = require('../utils/affiliate');

const MAX_LIMIT = 48;

// Selling price, MRP and the % off — computed in SQL so sorting and display agree.
const DEAL_FIELDS = `
  id, title, slug, description, store, image_url, category, brand,
  price, mrp, rating, coupon_code, is_featured, is_active, clicks, created_at,
  CASE WHEN mrp IS NOT NULL AND mrp > price AND mrp > 0
       THEN CAST(ROUND((mrp - price) * 100.0 / mrp) AS INTEGER)
       ELSE 0 END AS discount_percent`;

const SORTS = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  price_asc: 'price ASC',
  price_desc: 'price DESC',
  discount: 'discount_percent DESC, price ASC',
  popular: 'clicks DESC, created_at DESC',
  rating: 'rating DESC NULLS LAST, clicks DESC',
};

/** Turns a DB row into what the frontend consumes. The raw affiliate URL is never exposed. */
function toPublicDeal(row) {
  return {
    ...row,
    is_featured: Boolean(row.is_featured),
    is_active: Boolean(row.is_active),
    // Visitors always go through /go/:id so the click can be counted and tagged.
    go_url: `/go/${row.id}`,
  };
}

const listDeals = asyncHandler(async (req, res) => {
  const {
    q = '',
    store = '',
    category = '',
    brand = '',
    minPrice = '',
    maxPrice = '',
    featured = '',
    sort = 'newest',
  } = req.query;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || 12));
  const orderBy = SORTS[sort] || SORTS.newest;

  const cacheKey = `deals:${JSON.stringify({ q, store, category, brand, minPrice, maxPrice, featured, sort, page, limit })}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const where = ['is_active = 1'];
  const params = [];

  if (q.trim()) {
    where.push('(title LIKE ? OR description LIKE ? OR brand LIKE ? OR category LIKE ?)');
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like);
  }
  if (store && STORE_KEYS.includes(store)) {
    where.push('store = ?');
    params.push(store);
  }
  if (category.trim()) {
    where.push('category = ?');
    params.push(category.trim());
  }
  if (brand.trim()) {
    where.push('brand = ?');
    params.push(brand.trim());
  }
  if (minPrice !== '' && !Number.isNaN(Number(minPrice))) {
    where.push('price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
    where.push('price <= ?');
    params.push(Number(maxPrice));
  }
  if (featured === 'true' || featured === '1') {
    where.push('is_featured = 1');
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { total } = get(`SELECT COUNT(*) AS total FROM deals ${whereSql}`, ...params);
  const rows = all(
    `SELECT ${DEAL_FIELDS} FROM deals ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit
  );

  const payload = {
    deals: rows.map(toPublicDeal),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };

  cacheSet(cacheKey, payload);
  res.json(payload);
});

/** Sidebar/filter data: category and store counts plus the price range actually in use. */
const listFilters = asyncHandler(async (req, res) => {
  const cached = cacheGet('filters');
  if (cached) return res.json(cached);

  const payload = {
    categories: all(
      `SELECT category, COUNT(*) AS count FROM deals WHERE is_active = 1
       GROUP BY category ORDER BY count DESC, category ASC`
    ),
    brands: all(
      `SELECT brand, COUNT(*) AS count FROM deals
       WHERE is_active = 1 AND brand IS NOT NULL AND brand <> ''
       GROUP BY brand ORDER BY count DESC, brand ASC LIMIT 30`
    ),
    storeCounts: all(
      `SELECT store, COUNT(*) AS count FROM deals WHERE is_active = 1 GROUP BY store`
    ),
    stores: publicStores(),
    priceRange: get(
      `SELECT COALESCE(MIN(price), 0) AS min, COALESCE(MAX(price), 0) AS max
       FROM deals WHERE is_active = 1`
    ),
  };

  cacheSet('filters', payload);
  res.json(payload);
});

/** A single deal by slug (pretty URLs) or by numeric id, plus a few related picks. */
const getDeal = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const numericId = Number(idOrSlug);

  const row = get(
    `SELECT ${DEAL_FIELDS} FROM deals WHERE is_active = 1 AND (slug = ? OR id = ?)`,
    idOrSlug,
    Number.isInteger(numericId) ? numericId : -1
  );
  if (!row) throw new ApiError(404, 'Deal not found');

  const related = all(
    `SELECT ${DEAL_FIELDS} FROM deals
     WHERE is_active = 1 AND id <> ? AND (category = ? OR store = ?)
     ORDER BY (category = ?) DESC, clicks DESC LIMIT 4`,
    row.id,
    row.category,
    row.store,
    row.category
  );

  res.json({ deal: toPublicDeal(row), related: related.map(toPublicDeal) });
});

/**
 * The money endpoint: logs the click, then 302s to the store with your affiliate ID
 * attached. Used by every "Buy on ..." button.
 */
const clickThrough = asyncHandler(async (req, res) => {
  const dealId = Number(req.params.id);
  const deal = get(
    'SELECT id, store, affiliate_url FROM deals WHERE id = ? AND is_active = 1',
    Number.isInteger(dealId) ? dealId : -1
  );
  if (!deal) throw new ApiError(404, 'Deal not found or no longer available');

  run('UPDATE deals SET clicks = clicks + 1 WHERE id = ?', deal.id);
  run(
    'INSERT INTO clicks (deal_id, referrer, user_agent) VALUES (?, ?, ?)',
    deal.id,
    req.get('referer') || null,
    (req.get('user-agent') || '').slice(0, 300) || null
  );

  const target = withAffiliateTag(deal.affiliate_url, deal.store, deal.id);

  // Affiliate links must not be followed/indexed by crawlers.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.redirect(302, target);
});

module.exports = { listDeals, listFilters, getDeal, clickThrough };
