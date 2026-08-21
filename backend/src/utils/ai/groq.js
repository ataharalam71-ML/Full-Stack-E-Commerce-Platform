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

/** A 4xx that is the request's fault is worth retrying in a simpler form. */
const isBadRequest = (err) => err?.status === 400 || err?.status === 422;

/**
 * Restricting the search to the store domains is what keeps the links real: the model can
 * only cite pages it was actually shown, and it is only shown store pages.
 *
 * Compound is an agentic system rather than a plain chat model, and Groq does not document
 * which parameters it accepts. So the instructions go in the user message (a system role is
 * the parameter most likely to be ignored or refused), and if `search_settings` is rejected
 * the search is retried without it — unfiltered results still beat no feature at all,
 * because the vetting in ai.controller.js is what actually guarantees the links.
 */
async function runSearch({ task, stores }) {
  const groq = getClient();
  const prompt = `${SEARCH_SYSTEM}\n\n---\n\n${task}`;

  const base = {
    model: SEARCH_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  };

  const searchSettings = {
    include_domains: stores.flatMap((key) => STORES[key].domains),
    country: 'india',
  };

  let completion;
  let filtered = true;
  try {
    completion = await groq.chat.completions.create({ ...base, search_settings: searchSettings });
  } catch (err) {
    if (!isBadRequest(err)) throw err;
    console.warn(
      `[ai:groq] ${SEARCH_MODEL} rejected search_settings (${err.status}); ` +
        'retrying without domain filtering.'
    );
    filtered = false;
    completion = await groq.chat.completions.create(base);
  }

  const message = completion.choices?.[0]?.message;
  return {
    text: message?.content?.trim() || '',
    // `executed_tools` is how compound reports the searches it actually ran.
    searches: Array.isArray(message?.executed_tools) ? message.executed_tools.length : 0,
    filtered,
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

/**
 * Three attempts, weakest constraint last: a strict schema, then a best-effort schema,
 * then plain JSON-object mode with the shape described in the prompt. Only the strict pass
 * is guaranteed to match the schema, so every pass is still vetted downstream — this just
 * means a model that dislikes one `response_format` does not take the feature down.
 */
async function runFormat({ findings, category, count }) {
  const groq = getClient();

  const messages = [
    { role: 'system', content: FORMAT_SYSTEM },
    {
      role: 'user',
      content: [
        `Convert these research notes into at most ${count} structured products.`,
        `Where a product has no category of its own, use "${category}".`,
        '',
        'Reply with JSON only: {"products":[{"title","url","store","price","mrp","brand",',
        '"category","rating","description","image_url","confidence"}],"note":""}',
        'store is amazon|flipkart|meesho. confidence is high|medium|low. Unknown fields null.',
        '',
        '--- RESEARCH NOTES ---',
        findings,
        '--- END NOTES ---',
      ].join('\n'),
    },
  ];

  const formats = [
    { type: 'json_schema', json_schema: RESULT_SCHEMA },
    { type: 'json_schema', json_schema: { ...RESULT_SCHEMA, strict: false } },
    { type: 'json_object' },
  ];

  let lastError;
  for (const response_format of formats) {
    try {
      // eslint-disable-next-line no-await-in-loop -- fallbacks are sequential by nature
      const completion = await groq.chat.completions.create({
        model: FORMAT_MODEL,
        messages,
        response_format,
        temperature: 0,
        max_tokens: 8192,
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) throw new Error('empty response');
      return JSON.parse(raw);
    } catch (err) {
      lastError = err;
      // A rejected response_format is worth downgrading for; anything else (auth, rate
      // limit, network) will not be fixed by trying a looser schema.
      if (!isBadRequest(err) && !(err instanceof SyntaxError)) throw err;
      console.warn(
        `[ai:groq] ${FORMAT_MODEL} rejected ${response_format.type}` +
          `${response_format.json_schema ? `(strict=${response_format.json_schema.strict})` : ''}` +
          `: ${err.message}. Trying a looser format.`
      );
    }
  }

  const err = new Error(
    'The AI found products but could not format them. This usually clears on a retry.'
  );
  err.statusCode = 502;
  err.cause = lastError;
  throw err;
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

  const notes = [(shaped.note || '').trim()];
  if (!found.filtered) {
    notes.push('Searched without store-domain filtering, so expect more results to be dropped.');
  }

  return {
    products: Array.isArray(shaped.products) ? shaped.products : [],
    note: notes.filter(Boolean).join(' '),
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
