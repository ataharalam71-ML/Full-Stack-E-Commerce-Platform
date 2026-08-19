const crypto = require('crypto');

const hasRazorpayKeys =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_ID !== 'rzp_test_xxxxxxxx' &&
  process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;
if (hasRazorpayKeys) {
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Creates a payment-provider order for the given amount.
 * Falls back to a local mock order when no real Razorpay keys are configured,
 * so the API is fully testable without a Razorpay account.
 */
async function createProviderOrder({ amountCents, currency, receipt }) {
  if (razorpay) {
    const order = await razorpay.orders.create({
      amount: amountCents, // Razorpay expects the smallest currency unit (paise for INR)
      currency,
      receipt,
    });
    return { providerOrderId: order.id, mock: false };
  }

  // Mock mode: deterministic fake order id, always "succeeds" on confirm.
  return { providerOrderId: `mock_order_${crypto.randomUUID()}`, mock: true };
}

/**
 * Verifies a Razorpay payment signature (HMAC SHA256 of order_id|payment_id using the key secret).
 * In mock mode, any confirmation is accepted — this endpoint exists purely so the order flow
 * (PENDING_PAYMENT -> PAID) can be exercised end-to-end without a real gateway.
 */
function verifySignature({ providerOrderId, providerPaymentId, signature }) {
  if (!razorpay) return true; // mock mode

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest('hex');

  return expected === signature;
}

module.exports = { createProviderOrder, verifySignature, isMockMode: !razorpay };
