// Groq provider — the free option.
//
// Groq needs two calls, because its two useful capabilities live in different models:
//
//   1. `groq/compound` has a built-in web search (with domain filtering), which is what
//      makes the links real. It does NOT accept custom tools or JSON schemas, so all it
//      can give back is prose.
//   2. `openai/gpt-oss-120b` supports strict JSON schemas but cannot search. It turns that
//      prose into the exact shape the admin panel expects.
//
// Step 2 is explicitly forbidden from inventing anything: it may only reshape what step 1
// found. Anything it makes up anyway is caught by the vetting in ai.controller.js.
const Groq = require('groq-sdk');
const { STORES } = require('../affiliate');
const { RULES, FIELD_DOCS, CONFIDENCE, buildTask } = require('./shared');

const SEARCH_MODEL = process.env.GROQ_SEARCH_MODEL || 'groq/compound';
const FORMAT_MODEL = process.env.GROQ_FORMAT_MODEL || 'openai/gpt-oss-120b';

let client;
function getClient() {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 180000, // milliseconds — a search turn is slow
      maxRetries: 1,
    });
  }
  return client;
}

// ── Step 1: find real listings ───────────────────────────────────────────────
const SEARCH_SYSTEM = [
  'You find real, currently-listed products on Indian shopping sites so an affiliate-site',
  'owner can publish them as deals. You are a research tool: accuracy beats volume.',
  '',
  'Search the web for actual product listings. Search more than once — vary the wording,',
  'and search per store when several stores were asked for.',
  '',
  RULES,
  '',
  'Report what you found as a plain numbered list, one product per line, in exactly this',
  'form (use "?" for anything the listing did not show):',
  '',
  '1. TITLE | STORE | URL | PRICE | MRP | BRAND | RATING | CONFIDENCE | IMAGE_URL',
  '',
  'STORE is one of amazon, flipkart, meesho. CONFIDENCE is high, medium or low.',
  'Then, after the list, add one short line starting with "NOTE:" about coverage or caveats.',
  'No other commentary — the list is the deliverable.',
].join('\n');

/**
 * Restricting the search to the store domains is what keeps the links real: the model can
 * only cite pages it was actually shown, and it is only shown store pages.
 */
async function runSearch({ task, stores }) {
  const groq = getClient();

  const completion = await groq.chat.completions.create({
    model: SEARCH_MODEL,
    messages: [
      { role: 'system', content: SEARCH_SYSTEM },
      { role: 'user', content: task },
    ],
    search_settings: {
      include_domains: stores.flatMap((key) => STORES[key].domains),
      country: 'india',
      include_images: true,
    },
    temperature: 0.3,
    max_tokens: 4096,
  });

  const message = completion.choices?.[0]?.message;
  return {
    text: message?.content?.trim() || '',
    // `executed_tools` is how compound reports the searches it actually ran.
    searches: Array.isArray(message?.executed_tools) ? message.executed_tools.length : 0,
  };
}

// ── Step 2: reshape into the admin panel's format ────────────────────────────
// Strict mode requires every property in `required` and `additionalProperties: false`, so
// optional fields are expressed as nullable unions rather than being left out.
const nullable = (type, description) => ({ type: [type, 'null'], description });

const PRODUCT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: FIELD_DOCS.title },
    url: { type: 'string', description: FIELD_DOCS.url },
    store: { type: 'string', enum: Object.keys(STORES), description: FIELD_DOCS.store },
    price: { type: 'number', description: FIELD_DOCS.price },
    mrp: nullable('number', FIELD_DOCS.mrp),
    brand: nullable('string', FIELD_DOCS.brand),
    category: { type: 'string', description: FIELD_DOCS.category },
    rating: nullable('number', FIELD_DOCS.rating),
    description: nullable('string', FIELD_DOCS.description),
    image_url: nullable('string', FIELD_DOCS.image_url),
    confidence: { type: 'string', enum: CONFIDENCE, description: FIELD_DOCS.confidence },
  },
  required: [
    'title', 'url', 'store', 'price', 'mrp', 'brand', 'category',
    'rating', 'description', 'image_url', 'confidence',
  ],
};

const RESULT_SCHEMA = {
  name: 'product_suggestions',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      products: { type: 'array', description: 'The products found.', items: PRODUCT_SCHEMA },
      note: nullable('string', 'One short line for the admin about coverage or caveats.'),
    },
    required: ['products', 'note'],
  },
};

const FORMAT_SYSTEM = [
  'You convert a researcher\'s findings into structured data. You are a formatter, not a',
  'researcher.',
  '',
  '- Use ONLY what the notes contain. Never add a product, a URL, a price or a rating that',
  '  is not there. You have no web access and no way to check anything, so anything you',
  '  invent is a dead link on a live website.',
  '- A field the notes leave as "?" or do not mention becomes null. Do not fill gaps.',
  '- Strip currency symbols and separators from prices: "₹1,299" becomes 1299.',
  '- Drop any entry that has no usable URL or no usable price.',
  '- Copy URLs character for character.',
].join('\n');

async function runFormat({ findings, category, count }) {
  const groq = getClient();

  const completion = await groq.chat.completions.create({
    model: FORMAT_MODEL,
    messages: [
      { role: 'system', content: FORMAT_SYSTEM },
      {
        role: 'user',
        content: [
          `Convert these research notes into at most ${count} structured products.`,
          `Where a product has no category of its own, use "${category}".`,
          '',
          '--- RESEARCH NOTES ---',
          findings,
          '--- END NOTES ---',
        ].join('\n'),
      },
    ],
    response_format: { type: 'json_schema', json_schema: RESULT_SCHEMA },
    temperature: 0,
    max_tokens: 8192,
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('The AI returned something that was not valid JSON. Try again.');
    err.statusCode = 502;
    throw err;
  }
}

/** Same contract as the Anthropic provider: { products, note, searches, model }. */
async function suggest({ query, category, stores, count, existingTitles }) {
  const task = buildTask({ query, category, stores, count, existingTitles });

  const found = await runSearch({ task, stores });
  if (!found.text) {
    return {
      products: [],
      note: 'The search came back empty. Try a different or broader search term.',
      searches: found.searches,
      model: SEARCH_MODEL,
    };
  }

  const shaped = await runFormat({ findings: found.text, category, count });

  return {
    products: Array.isArray(shaped.products) ? shaped.products : [],
    note: (shaped.note || '').trim(),
    searches: found.searches,
    model: `${SEARCH_MODEL} + ${FORMAT_MODEL}`,
  };
}

module.exports = {
  key: 'groq',
  label: 'Groq',
  envKey: 'GROQ_API_KEY',
  consoleUrl: 'https://console.groq.com/keys',
  free: true,
  model: `${SEARCH_MODEL} + ${FORMAT_MODEL}`,
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
  suggest,
};
