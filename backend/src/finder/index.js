// The finder: search the stores, or resolve pasted links, and hand back vetted drafts.
// No model, no API key — just HTTP and parsing.
const amazon = require('./amazon');
const flipkart = require('./flipkart');
const { resolveUrl } = require('./resolve');
const { vet } = require('./vet');

const ADAPTERS = { amazon, flipkart };
const STORE_ORDER = ['flipkart', 'amazon']; // most reliable first

const MAX_RESULTS = 40;
const MAX_URLS = 25;

/** Per-store capability, so the panel can set expectations before the admin searches. */
function capabilities() {
  return STORE_ORDER.map((key) => ({
    store: key,
    label: ADAPTERS[key].label,
    searchUrl: ADAPTERS[key].searchUrl(''),
    note: ADAPTERS[key].searchNote || null,
  }));
}

/** A one-click link to the store's own search, for the copy-the-links workflow. */
const searchLinks = (query) =>
  STORE_ORDER.map((key) => ({
    store: key,
    label: ADAPTERS[key].label,
    url: ADAPTERS[key].searchUrl(query),
  }));

/**
 * Searches the chosen stores in parallel and returns raw candidates plus a per-store
 * report. A store failing is normal and never fails the whole search — the others still
 * return, and the admin is told which one was unavailable and why.
 */
async function searchStores({ query, stores, perStore }) {
  const settled = await Promise.all(
    stores.map(async (key) => {
      const adapter = ADAPTERS[key];
      try {
        const result = await adapter.search(query, perStore);

        // A store can also answer 200 with nothing usable — a page that renders its results
        // in the browser leaves a server with an empty shell. That is "unavailable", not "no
        // matches", and saying so is the difference between the admin understanding the
        // result and thinking their search term was bad.
        const emptyButOk = !result.error && result.products.length === 0;

        return {
          store: key,
          label: adapter.label,
          found: result.products.length,
          blocked: Boolean(result.blocked),
          unavailable: emptyButOk && Boolean(adapter.searchNote),
          error: result.error || (emptyButOk ? adapter.searchNote : null),
          products: result.products,
        };
      } catch (err) {
        return {
          store: key,
          label: adapter.label,
          found: 0,
          blocked: false,
          unavailable: false,
          error: `Search failed: ${err.message}`,
          products: [],
        };
      }
    })
  );

  // Interleave the stores so one store cannot fill the whole grid.
  const products = [];
  for (let i = 0; i < perStore; i += 1) {
    for (const report of settled) {
      if (report.products[i]) products.push(report.products[i]);
    }
  }

  return {
    products,
    reports: settled.map(({ products: _ignored, ...report }) => report),
  };
}

/** Resolves pasted URLs one at a time, so a slow store cannot stall the whole batch. */
async function resolveUrls(urls) {
  const drafts = [];
  const failures = [];

  for (const url of urls.slice(0, MAX_URLS)) {
    // eslint-disable-next-line no-await-in-loop -- sequential keeps us polite to each store
    const result = await resolveUrl(url);
    if (result.ok) drafts.push(result.draft);
    else failures.push({ url: result.url, error: result.error });
  }

  return { drafts, failures };
}

/**
 * Runs every candidate through the gate and splits them into what the admin sees and what
 * was thrown away, with the reason.
 */
function vetAll(candidates, category) {
  const seenUrls = new Set();
  const seenSlugs = new Set();
  const accepted = [];
  const rejected = [];

  for (const candidate of candidates) {
    const result = vet(candidate, { category, seenUrls, seenSlugs });
    if (result.ok) accepted.push(result);
    else rejected.push({ title: result.title, reason: result.reason });
  }

  return { accepted, rejected };
}

module.exports = {
  ADAPTERS,
  STORE_ORDER,
  MAX_RESULTS,
  MAX_URLS,
  capabilities,
  searchLinks,
  searchStores,
  resolveUrls,
  vetAll,
};
