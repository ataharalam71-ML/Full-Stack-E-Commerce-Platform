const { z } = require('zod');
const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const addItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

const getCart = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.quantity, p.id AS product_id, p.name, p.price_cents, p.currency,
            p.image_url, p.stock, (c.quantity * p.price_cents) AS line_total_cents
     FROM cart_items c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1
     ORDER BY c.created_at ASC`,
    [req.user.id]
  );

  const total_cents = result.rows.reduce((sum, item) => sum + Number(item.line_total_cents), 0);
  res.json({ items: result.rows, total_cents });
});

const addItem = asyncHandler(async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { product_id, quantity } = parsed.data;

  const product = await pool.query(
    'SELECT id, stock FROM products WHERE id = $1 AND is_active = true',
    [product_id]
  );
  if (!product.rows[0]) throw new ApiError(404, 'Product not found');
  if (product.rows[0].stock < quantity) throw new ApiError(400, 'Insufficient stock');

  const result = await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [req.user.id, product_id, quantity]
  );

  res.status(201).json({ item: result.rows[0] });
});

const updateItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const result = await pool.query(
    `UPDATE cart_items SET quantity = $1
     WHERE id = $2 AND user_id = $3 RETURNING *`,
    [parsed.data.quantity, itemId, req.user.id]
  );
  if (!result.rows[0]) throw new ApiError(404, 'Cart item not found');

  res.json({ item: result.rows[0] });
});

const removeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const result = await pool.query(
    'DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id',
    [itemId, req.user.id]
  );
  if (!result.rows[0]) throw new ApiError(404, 'Cart item not found');
  res.status(204).send();
});

const clearCart = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
  res.status(204).send();
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
