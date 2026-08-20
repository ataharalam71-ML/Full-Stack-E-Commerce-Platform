// Admin-only endpoints. This is what powers the "add / remove item" panel.
const { z } = require('zod');
const { all, get, run, transaction } = require('../config/db');
const { cacheClear } = require('../config/cache');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { uniqueSlug } = require('../utils/slug');
const {
  STORE_KEYS,
  validateAffiliateUrl,
  detectStore,
  getSetting,
  setSetting,
  withAffiliateTag,
} = require('../utils/affiliate');

const SETTING_KEYS = [
  'site_name',
  'site_tagline',
  'amazon_tag',
  'flipkart_affid',
  'meesho_tag',
  'contact_email',
];

// Accepts true/false, 1/0 and "true"/"false" — checkboxes and JSON imports both work.
const boolish = z
  .union([z.boolean(), z.number(), z.string()])
  .transform((v) => v === true || v === 1 || v === '1' || v === 'true');

// Empty strings from an HTML form mean "not set", not "".
const optionalText = (max) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const trimmed = (v ?? '').trim();
      return trimmed ? trimmed.slice(0, max) : null;
    });

const optionalNumber = (min, max) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `Value must be a number between ${min} and ${max}` });
        return null;
      }
      return n;
    });

const dealSchema = z.object({
  title: z.string().trim().min(3, 'Title needs at least 3 characters').max(200),
  affiliate_url: z.string().trim().min(8, 'Affiliate link is required'),
  store: z.enum(STORE_KEYS).optional(),
  description: optionalText(2000),
  image_url: optionalText(600),
  category: z.string().trim().max(80).optional().default('Other'),
  brand: optionalText(80),
  price: z.union([z.number(), z.string()]).transform((v, ctx) => {
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: 'Price must be 0 or more' });
      return 0;
    }
    return n;
  }),
  mrp: optionalNumber(0, 100000000),
  rating: optionalNumber(0, 5),
  coupon_code: optionalText(40),
  is_featured: boolish.optional().default(false),
  is_active: boolish.optional().default(true),
});

/**
 * Shared validation for create and update: parse the body, work out the store from the
 * link when it was not given, and reject links we would refuse to redirect to.
 */
function parseDeal(body) {
  const parsed = dealSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const data = parsed.data;

  const linkCheck = validateAffiliateUrl(data.affiliate_url);
  if (!linkCheck.ok) throw new ApiError(400, linkCheck.error);
  data.affiliate_url = linkCheck.url.toString();

  const store = data.store || detectStore(data.affiliate_url);
  if (!store) {
    throw new ApiError(400, 'Could not tell which store this link is for — pick one manually.');
  }
  data.store = store;
  data.category = data.category?.trim() || 'Other';

  if (data.mrp !== null && data.mrp < data.price) {
    throw new ApiError(400, 'MRP cannot be lower than the deal price');
  }
  return data;
}

const ADMIN_SORTS = {
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  clicks: 'clicks DESC',
  price_asc: 'price ASC',
  price_desc: 'price DESC',
  title: 'title ASC',
};

/** Full list including hidden deals and the raw affiliate URL (admins need to see it). */
const listDeals = asyncHandler(async (req, res) => {
  const { q = '', store = '', status = 'all', sort = 'newest' } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const where = ['1 = 1'];
  const params = [];

  if (q.trim()) {
    where.push('(title ILIKE ? OR brand ILIKE ? OR category ILIKE ? OR affiliate_url ILIKE ?)');
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like);
  }
  if (store && STORE_KEYS.includes(store)) {
    where.push('store = ?');
    params.push(store);
  }
  if (status === 'active') where.push('is_active = 1');
  if (status === 'hidden') where.push('is_active = 0');
  if (status === 'featured') where.push('is_featured = 1');

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { total } = await get(`SELECT COUNT(*)::int AS total FROM deals ${whereSql}`, ...params);
  const deals = await all(
    `SELECT * FROM deals ${whereSql} ORDER BY ${ADMIN_SORTS[sort] || ADMIN_SORTS.newest}
     LIMIT ? OFFSET ?`,
    ...params,
    limit,
    (page - 1) * limit
  );

  res.json({
    deals: await Promise.all(
      deals.map(async (d) => ({
        ...d,
        is_active: Boolean(d.is_active),
        is_featured: Boolean(d.is_featured),
        // Shows the admin exactly where a visitor will land, affiliate tag included.
        tagged_url: await withAffiliateTag(d.affiliate_url, d.store, d.id),
      }))
    ),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

const createDeal = asyncHandler(async (req, res) => {
  const d = parseDeal(req.body);
  const slug = await uniqueSlug(d.title);

  const { rows } = await run(
    `INSERT INTO deals
       (title, slug, description, store, affiliate_url, image_url, category, brand,
        price, mrp, rating, coupon_code, is_featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    d.title, slug, d.description, d.store, d.affiliate_url, d.image_url, d.category,
    d.brand, d.price, d.mrp, d.rating, d.coupon_code, d.is_featured, d.is_active
  );

  cacheClear();
  res.status(201).json({ deal: await get('SELECT * FROM deals WHERE id = ?', rows[0].id) });
});

const updateDeal = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get('SELECT * FROM deals WHERE id = ?', Number.isInteger(id) ? id : -1);
  if (!existing) throw new ApiError(404, 'Deal not found');

  // Merge so a partial submit does not blank out fields the admin did not touch.
  const d = parseDeal({ ...existing, ...req.body });
  const slug = d.title === existing.title ? existing.slug : await uniqueSlug(d.title, id);

  await run(
    `UPDATE deals SET title = ?, slug = ?, description = ?, store = ?, affiliate_url = ?,
       image_url = ?, category = ?, brand = ?, price = ?, mrp = ?, rating = ?,
       coupon_code = ?, is_featured = ?, is_active = ?
     WHERE id = ?`,
    d.title, slug, d.description, d.store, d.affiliate_url, d.image_url, d.category,
    d.brand, d.price, d.mrp, d.rating, d.coupon_code, d.is_featured, d.is_active, id
  );

  cacheClear();
  res.json({ deal: await get('SELECT * FROM deals WHERE id = ?', id) });
});

/** Hard delete. Rows in `clicks` go with it via ON DELETE CASCADE. */
const deleteDeal = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get(
    'SELECT id, title FROM deals WHERE id = ?',
    Number.isInteger(id) ? id : -1
  );
  if (!existing) throw new ApiError(404, 'Deal not found');

  await run('DELETE FROM deals WHERE id = ?', id);
  cacheClear();
  res.json({ deleted: existing.id, title: existing.title });
});

/** Delete several at once — the checkbox + "Delete selected" flow in the admin panel. */
const deleteManyDeals = asyncHandler(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(Number)
    .filter(Number.isInteger);
  if (!ids.length) throw new ApiError(400, 'Send an "ids" array of deal ids to delete');

  const deleted = await transaction(async (tx) => {
    const { changes } = await tx.run('DELETE FROM deals WHERE id = ANY(?)', ids);
    return changes;
  });

  cacheClear();
  res.json({ deleted });
});

/** Flip is_active (hide/show) or is_featured (homepage strip) without opening the form. */
const toggleDealFlag = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const field = req.body?.field === 'is_featured' ? 'is_featured' : 'is_active';

  const existing = await get('SELECT * FROM deals WHERE id = ?', Number.isInteger(id) ? id : -1);
  if (!existing) throw new ApiError(404, 'Deal not found');

  const next = existing[field] ? 0 : 1;
  await run(`UPDATE deals SET ${field} = ? WHERE id = ?`, next, id);

  cacheClear();
  res.json({ id, field, value: Boolean(next) });
});

/**
 * Bulk add, so a batch of deals can go live in one paste. Bad rows are reported back
 * instead of failing the whole import.
 */
const bulkCreateDeals = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.deals;
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Send a JSON array of deals, or { "deals": [ ... ] }');
  }
  if (items.length > 200) throw new ApiError(400, 'Import at most 200 deals at a time');

  const created = [];
  const errors = [];

  for (const [index, item] of items.entries()) {
    try {
      const d = parseDeal(item);
      // eslint-disable-next-line no-await-in-loop -- keeps import order predictable
      const slug = await uniqueSlug(d.title);
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await run(
        `INSERT INTO deals
           (title, slug, description, store, affiliate_url, image_url, category, brand,
            price, mrp, rating, coupon_code, is_featured, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        d.title, slug, d.description, d.store, d.affiliate_url, d.image_url, d.category,
        d.brand, d.price, d.mrp, d.rating, d.coupon_code, d.is_featured, d.is_active
      );
      created.push({ id: rows[0].id, title: d.title });
    } catch (err) {
      errors.push({ row: index + 1, title: item?.title || '(no title)', error: err.message });
    }
  }

  cacheClear();
  res.status(created.length ? 201 : 400).json({ created: created.length, errors, deals: created });
});

/** Dashboard numbers: catalogue size, clicks, and which deals actually earn. */
const getStats = asyncHandler(async (req, res) => {
  const totals = await get(`
    SELECT COUNT(*)::int AS deals,
           COALESCE(SUM(is_active), 0)::int AS active,
           COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0)::int AS hidden,
           COALESCE(SUM(is_featured), 0)::int AS featured,
           COALESCE(SUM(clicks), 0)::int AS clicks
    FROM deals`);

  res.json({
    totals,
    clicks: {
      today: (await get(`SELECT COUNT(*)::int AS n FROM clicks WHERE clicked_at::date = CURRENT_DATE`)).n,
      last7: (await get(`SELECT COUNT(*)::int AS n FROM clicks WHERE clicked_at >= NOW() - INTERVAL '7 days'`)).n,
      last30: (await get(`SELECT COUNT(*)::int AS n FROM clicks WHERE clicked_at >= NOW() - INTERVAL '30 days'`)).n,
    },
    byStore: await all(`
      SELECT store, COUNT(*)::int AS deals, COALESCE(SUM(clicks), 0)::int AS clicks
      FROM deals GROUP BY store ORDER BY clicks DESC`),
    byCategory: await all(`
      SELECT category, COUNT(*)::int AS deals, COALESCE(SUM(clicks), 0)::int AS clicks
      FROM deals GROUP BY category ORDER BY clicks DESC, deals DESC LIMIT 8`),
    topDeals: await all(`
      SELECT id, title, slug, store, price, clicks FROM deals
      WHERE clicks > 0 ORDER BY clicks DESC LIMIT 10`),
    clicksPerDay: await all(`
      SELECT to_char(clicked_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS clicks FROM clicks
      WHERE clicked_at >= NOW() - INTERVAL '13 days'
      GROUP BY day ORDER BY day ASC`),
  });
});

/**
 * Download the whole catalogue as JSON. Pairs with bulk import, so the catalogue can be
 * backed up and restored — important on free hosts that wipe the disk on redeploy.
 */
const exportDeals = asyncHandler(async (req, res) => {
  const rows = await all(
    `SELECT title, description, store, affiliate_url, image_url, category, brand,
            price, mrp, rating, coupon_code, is_featured, is_active
     FROM deals ORDER BY id ASC`
  );
  const deals = rows.map((d) => ({
    ...d,
    is_featured: Boolean(d.is_featured),
    is_active: Boolean(d.is_active),
  }));

  res.set('Content-Disposition', 'attachment; filename="deals-backup.json"');
  res.json(deals);
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = {};
  // eslint-disable-next-line no-await-in-loop -- six tiny reads
  for (const key of SETTING_KEYS) settings[key] = await getSetting(key, '');
  res.json({ settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const incoming = req.body?.settings ?? req.body ?? {};
  const applied = {};

  for (const key of SETTING_KEYS) {
    if (incoming[key] === undefined) continue;
    // eslint-disable-next-line no-await-in-loop
    await setSetting(key, String(incoming[key]).trim().slice(0, 300));
    // eslint-disable-next-line no-await-in-loop
    applied[key] = await getSetting(key, '');
  }

  cacheClear();
  res.json({ settings: applied });
});

module.exports = {
  listDeals,
  exportDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  deleteManyDeals,
  toggleDealFlag,
  bulkCreateDeals,
  getStats,
  getSettings,
  updateSettings,
};
