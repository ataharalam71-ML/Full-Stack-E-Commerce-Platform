const { z } = require('zod');
const { pool } = require('../config/db');
const { cacheGet, cacheSet, cacheDelByPrefix } = require('../config/redis');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const CACHE_PREFIX = 'products:';

const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  price_cents: z.number().int().nonnegative(),
  category: z.string().max(80).optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  image_url: z.string().url().optional().nullable(),
});

/**
 * GET /api/products?search=&category=&page=&limit=
 * Cached in Redis per unique query combination. This is the "scalability" showcase:
 * repeated identical queries hit Redis instead of PostgreSQL.
 */
const listProducts = asyncHandler(async (req, res) => {
  const { search = '', category = '', page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const offset = (pageNum - 1) * limitNum;

  const cacheKey = `${CACHE_PREFIX}list:${search}:${category}:${pageNum}:${limitNum}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const conditions = ['is_active = true'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM products ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limitNum, offset);
  const dataResult = await pool.query(
    `SELECT id, name, description, price_cents, currency, category, stock, image_url, created_at
     FROM products ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const payload = {
    products: dataResult.rows,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  };

  await cacheSet(cacheKey, payload);
  res.json({ ...payload, cached: false });
});

const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `${CACHE_PREFIX}item:${id}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return res.json({ product: cached, cached: true });

  const result = await pool.query(
    'SELECT * FROM products WHERE id = $1 AND is_active = true',
    [id]
  );
  const product = result.rows[0];
  if (!product) throw new ApiError(404, 'Product not found');

  await cacheSet(cacheKey, product);
  res.json({ product, cached: false });
});

// ===== Admin-only =====

const createProduct = asyncHandler(async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { name, description, price_cents, category, stock, image_url } = parsed.data;

  const result = await pool.query(
    `INSERT INTO products (name, description, price_cents, category, stock, image_url)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, description || null, price_cents, category || null, stock, image_url || null]
  );

  await cacheDelByPrefix(CACHE_PREFIX);
  res.status(201).json({ product: result.rows[0] });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const fields = Object.keys(parsed.data);
  if (!fields.length) throw new ApiError(400, 'No fields to update');

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => parsed.data[f]);

  const result = await pool.query(
    `UPDATE products SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
    [...values, id]
  );
  if (!result.rows[0]) throw new ApiError(404, 'Product not found');

  await cacheDelByPrefix(CACHE_PREFIX);
  res.json({ product: result.rows[0] });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Soft delete keeps historical order_items referencing the product intact.
  const result = await pool.query(
    'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
    [id]
  );
  if (!result.rows[0]) throw new ApiError(404, 'Product not found');

  await cacheDelByPrefix(CACHE_PREFIX);
  res.status(204).send();
});

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
