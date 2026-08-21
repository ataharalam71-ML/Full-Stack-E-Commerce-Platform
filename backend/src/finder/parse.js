// Small shared helpers for reading numbers and text out of store HTML.

/** Trimmed, whitespace-collapsed text of a cheerio selection. */
const text = (selection) =>
  (selection?.text?.() || '').replace(/\s+/g, ' ').trim();

/**
 * "₹1,299.00" / "1,299" / "Rs. 1299" -> 1299. Returns null for anything that is not a
 * usable positive amount, so a missing price never becomes a zero-rupee deal.
 */
function money(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/[^\d.]/g, '');
  if (!digits) return null;
  // A stray second dot ("1.299.00") means the separators were not what we assumed.
  const n = Number(digits.split('.').slice(0, 2).join('.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** "4.2 out of 5 stars" / "4.2" -> 4.2, and anything outside 0-5 -> null. */
function ratingFrom(value) {
  const match = String(value ?? '').match(/(\d(?:\.\d)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 0 && n <= 5 ? n : null;
}

/**
 * Every rupee amount in a blob of text, in order.
 *
 * The grouping matters. Stores render a card as "₹1,099₹1,99945% off" with no separators,
 * so a lazy `₹[\d,]+` reads the MRP as ₹199,945. Requiring proper Indian comma groups
 * (or, failing that, a plain run of digits) stops the discount being absorbed into the
 * price.
 */
const PRICE_RE = /₹\s?(?:\d{1,3}(?:,\d{2,3})+|\d+)/g;

const pricesIn = (blob) =>
  (String(blob ?? '').match(PRICE_RE) || []).map(money).filter((n) => n !== null);

/** First absolute http(s) URL in a string, or null. */
function firstUrl(value) {
  const match = String(value ?? '').match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0] : null;
}

module.exports = { text, money, ratingFrom, firstUrl, pricesIn };
