// Everything both AI providers agree on: the rules a suggestion has to follow, the shape
// it comes back in, and the prompt that asks for it. Keeping this in one file is what stops
// the Groq and Anthropic paths from quietly drifting apart.
const { STORES } = require('../affiliate');

const MAX_SUGGESTIONS = 24;

/**
 * The rules. Both providers get this text. The first rule is the important one: a
 * plausible-looking URL the model assembled itself becomes a dead affiliate link on a
 * live website, which is worse than returning nothing.
 */
const RULES = [
  'Rules:',
  '- Only report a product whose listing you actually saw in a search result. Never invent',
  '  or edit a URL, and never guess an Amazon ASIN, a Flipkart item id or a Meesho product',
  '  id. A made-up link becomes a dead affiliate link on a live website.',
  '- Only product pages. Not search pages, category pages, blog posts or "top 10" lists.',
  '- Prices in Indian rupees as plain numbers. If a price is unclear, say so rather than',
  '  guessing a number.',
  '- The original/struck-through price (MRP) must be higher than the selling price, or be',
  '  left out entirely.',
  '- Prefer genuine discounts, well-rated items, and a spread of brands and price points.',
  '- Skip near-duplicates of each other, and skip anything already published on the site.',
  '- Fewer solid results beat a long list padded with guesses.',
].join('\n');

/** The task, in the admin's terms. Shared so both providers search for the same thing. */
function buildTask({ query, category, stores, count, existingTitles = [] }) {
  const lines = [
    `Find up to ${count} products that could be published as deals.`,
    '',
    `Search term: ${query}`,
    `Category to file them under: ${category}`,
    `Stores to search: ${stores.map((s) => STORES[s].label).join(', ')}`,
  ];

  if (existingTitles.length) {
    lines.push(
      '',
      'Already published on the site — do not suggest these again:',
      ...existingTitles.map((t) => `- ${t}`)
    );
  }
  return lines.join('\n');
}

/** Per-product field docs, reused by the Anthropic tool schema and the Groq JSON schema. */
const FIELD_DOCS = {
  title: 'Product name as the store lists it, including the brand. 3-200 characters.',
  url:
    'The product page URL exactly as it appeared in the search result. Never invent or ' +
    'edit a URL, and never guess a product id.',
  store: 'Which store the URL belongs to.',
  price: 'Current selling price in rupees. Digits only, no symbol.',
  mrp: 'Original / struck-through price in rupees. Null if not shown.',
  brand: 'Brand name only, e.g. "Levis". Null if unknown.',
  category: 'The category the admin asked for, copied verbatim.',
  rating: 'Star rating out of 5. Null if not shown.',
  description:
    'One or two plain sentences a shopper would find useful: key specs, what makes it a ' +
    'good buy. No marketing hype, no invented claims. Null if you have nothing real to say.',
  image_url:
    'Direct link to the product image, only if you actually saw one. Null otherwise — ' +
    'do not guess a CDN path.',
  confidence:
    'high = you saw this exact product page and its price. medium = page confirmed, price ' +
    'may be stale. low = unsure about the link or the price.',
};

const CONFIDENCE = ['high', 'medium', 'low'];

module.exports = { MAX_SUGGESTIONS, RULES, FIELD_DOCS, CONFIDENCE, buildTask };
