const { z } = require('zod');
const { pool } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { createProviderOrder, verifySignature, isMockMode } = require('../utils/payment.service');

const createOrderSchema = z.object({
  shipping_address: z.record(z.any()).optional(),
});

const confirmPaymentSchema = z.object({
  order_id: z.string().uuid(),
  provider_payment_id: z.string(),
  signature: z.string().optional(), // not required in mock mode
});

/**
 * POST /api/orders
 * Places an order from the user's current cart:
 *   1. Lock the relevant product rows (FOR UPDATE) to prevent oversell under concurrent checkout.
 *   2. Verify stock, decrement it, snapshot price/name into order_items.
 *   3. Create the order (PENDING_PAYMENT) + a payment-provider order.
 *   4. Clear the cart.
 * All of this happens inside a single DB transaction — if anything fails, nothing is committed.
 */
const createOrder = asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `SELECT c.product_id, c.quantity, p.name, p.price_cents, p.stock, p.currency
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1
       FOR UPDATE OF p`,
      [req.user.id]
    );

    if (!cartResult.rows.length) throw new ApiError(400, 'Cart is empty');

    let totalCents = 0;
    for (const item of cartResult.rows) {
      if (item.stock < item.quantity) {
        throw new ApiError(400, `Insufficient stock for "${item.name}"`);
      }
      totalCents += item.price_cents * item.quantity;
    }

    const currency = cartResult.rows[0].currency;

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, status, total_cents, currency, shipping_address)
       VALUES ($1, 'PENDING_PAYMENT', $2, $3, $4) RETURNING *`,
      [req.user.id, totalCents, currency, parsed.data.shipping_address || null]
    );
    const order = orderResult.rows[0];

    for (const item of cartResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.product_id, item.name, item.price_cents, item.quantity]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
        item.quantity,
        item.product_id,
      ]);
    }

    const { providerOrderId } = await createProviderOrder({
      amountCents: totalCents,
      currency,
      receipt: order.id,
    });

    const paymentResult = await client.query(
      `INSERT INTO payments (order_id, provider_order_id, amount_cents, currency, status)
       VALUES ($1, $2, $3, $4, 'CREATED') RETURNING *`,
      [order.id, providerOrderId, totalCents, currency]
    );

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

    await client.query('COMMIT');

    res.status(201).json({
      order,
      payment: paymentResult.rows[0],
      mock_payment_mode: isMockMode,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/orders/confirm-payment
 * Called by the frontend after the payment provider (Razorpay checkout.js) completes.
 * In mock mode, any provider_payment_id is accepted so the flow is testable end-to-end
 * without real Razorpay credentials.
 */
const confirmPayment = asyncHandler(async (req, res) => {
  const parsed = confirmPaymentSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { order_id, provider_payment_id, signature } = parsed.data;

  const paymentResult = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1',
    [order_id]
  );
  const payment = paymentResult.rows[0];
  if (!payment) throw new ApiError(404, 'Payment record not found for this order');

  const valid = verifySignature({
    providerOrderId: payment.provider_order_id,
    providerPaymentId: provider_payment_id,
    signature,
  });
  if (!valid) throw new ApiError(400, 'Payment signature verification failed');

  await pool.query(
    `UPDATE payments SET status = 'SUCCESS', provider_payment_id = $1 WHERE order_id = $2`,
    [provider_payment_id, order_id]
  );
  const orderResult = await pool.query(
    `UPDATE orders SET status = 'PAID' WHERE id = $1 RETURNING *`,
    [order_id]
  );

  res.json({ order: orderResult.rows[0] });
});

const listMyOrders = asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orderResult = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND (user_id = $2 OR $3 = true)',
    [id, req.user.id, req.user.role === 'admin']
  );
  const order = orderResult.rows[0];
  if (!order) throw new ApiError(404, 'Order not found');

  const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [id]);
  res.json({ order, items: itemsResult.rows });
});

module.exports = { createOrder, confirmPayment, listMyOrders, getOrder };
