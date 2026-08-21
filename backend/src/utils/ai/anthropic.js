// Anthropic provider — the paid option, and the simpler one: Claude can run the web search
// and report structured results in a single conversation, so there is no second call.
const Anthropic = require('@anthropic-ai/sdk');
const { STORES, STORE_KEYS } = require('../affiliate');
const { RULES, FIELD_DOCS, CONFIDENCE, buildTask } = require('./shared');

const MODEL = process.env.ANTHROPIC_MODEL || process.env.AI_MODEL || 'claude-opus-5';

let client;
function getClient() {
  if (!client) {
    client = new Anthropic({
      timeout: 240000, // milliseconds — web search makes a turn take a while
      maxRetries: 1,
    });
  }
  return client;
}

/**
 * Claude reports its findings by calling this tool. Using a tool rather than asking for
 * JSON in prose means the SDK hands back a parsed object and the field names cannot drift.
 */
const SUBMIT_TOOL = {
  name: 'submit_products',
  description:
    'Report the products you found. Call this exactly once, at the end, with every ' +
    'product you are confident about. If you found nothing, call it with an empty list ' +
    'and explain why in `note`.',
  input_schema: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        description: 'The products found, best first.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: FIELD_DOCS.title },
            url: { type: 'string', description: FIELD_DOCS.url },
            store: { type: 'string', enum: STORE_KEYS, description: FIELD_DOCS.store },
            price: { type: 'number', description: FIELD_DOCS.price },
            mrp: { type: 'number', description: FIELD_DOCS.mrp },
            brand: { type: 'string', description: FIELD_DOCS.brand },
            category: { type: 'string', description: FIELD_DOCS.category },
            rating: { type: 'number', description: FIELD_DOCS.rating },
            description: { type: 'string', description: FIELD_DOCS.description },
            image_url: { type: 'string', description: FIELD_DOCS.image_url },
            confidence: {
              type: 'string',
              enum: CONFIDENCE,
              description: FIELD_DOCS.confidence,
            },
          },
          required: ['title', 'url', 'store', 'price', 'confidence'],
        },
      },
      note: {
        type: 'string',
        description: 'One short line for the admin about the search — coverage, caveats.',
      },
    },
    required: ['products'],
  },
};

const SYSTEM_PROMPT = [
  'You find real, currently-listed products on Indian shopping sites so an affiliate-site',
  'owner can publish them as deals. You are a research tool: accuracy beats volume.',
  '',
  'Method:',
  '1. Use web_search to find actual product listings. Search more than once — vary the',
  '   wording, and search per store when the admin asked for several stores.',
  '2. Take the product URL, title and price from what the search results actually show.',
  '3. Call submit_products once with what you found.',
  '',
  RULES,
].join('\n');

/** Same contract as the Groq provider: { products, note, searches, model }. */
async function suggest({ query, category, stores, count, existingTitles }) {
  const anthropic = getClient();

  // Keeping the search on the store domains is what keeps the links real: the model can
  // only cite pages it was actually shown, and it is only shown store pages.
  const tools = [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: Math.min(12, 3 + stores.length * 2),
      allowed_domains: stores.flatMap((key) => STORES[key].domains),
      user_location: { type: 'approximate', country: 'IN', timezone: 'Asia/Kolkata' },
    },
    SUBMIT_TOOL,
  ];

  const messages = [
    { role: 'user', content: buildTask({ query, category, stores, count, existingTitles }) },
  ];

  let searches = 0;
  let submitted = null;
  let note = '';

  // Manual loop: web_search runs server-side, and the turn ends when the model calls
  // submit_products. pause_turn is handled explicitly — a long search run can pause.
  for (let turn = 0; turn < 10 && !submitted; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- the turns are inherently sequential
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      const err = new Error(
        `The model declined this search${
          response.stop_details?.category ? ` (${response.stop_details.category})` : ''
        }. Try a different search term.`
      );
      err.statusCode = 422;
      throw err;
    }

    searches += response.content.filter((b) => b.type === 'server_tool_use').length;
    messages.push({ role: 'assistant', content: response.content });

    // Server-side search hit its per-turn ceiling — re-send so it can carry on.
    if (response.stop_reason === 'pause_turn') continue;

    const calls = response.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) {
      // No tool call and no pause: the model answered in prose and is done.
      note = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
      break;
    }

    const results = [];
    for (const call of calls) {
      if (call.name === 'submit_products') {
        submitted = call.input;
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: 'Received. Stop here — the admin reviews them next.',
        });
      } else {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: `Unknown tool "${call.name}".`,
          is_error: true,
        });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  return {
    products: Array.isArray(submitted?.products) ? submitted.products : [],
    note: (submitted?.note || note || '').trim(),
    searches,
    model: MODEL,
  };
}

module.exports = {
  key: 'anthropic',
  label: 'Claude (Anthropic)',
  envKey: 'ANTHROPIC_API_KEY',
  consoleUrl: 'https://console.anthropic.com',
  free: false,
  model: MODEL,
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  suggest,
};
