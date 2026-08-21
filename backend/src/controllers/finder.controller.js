// Product finder endpoints. Every one of these is read-only: they propose drafts, and
// nothing reaches the deals table until the admin approves and the normal
// POST /api/admin/deals/bulk validation accepts it.
const { get } = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { STORE_KEYS } = require('../utils/affiliate');
const finder = require('../finder');

/** Which stores can be searched from the server, and where their own search lives. */
const finderStatus = asyncHandler(async (req, res) => {
  res.json({
    stores: finder.capabilities(),
    maxResults: finder.MAX_RESULTS,
    maxUrls: finder.MAX_URLS,
  });
});

/** Adds the "already on the site?" flag and the shape the review grid expects. */
async function decorate(accepted) {
  return Promise.all(
    accepted.map(async ({ deal, slug, warnings }) => {
      const existing = await get(
        'SELECT id, title FROM deals WHERE affiliate_url = ? OR slug = ? LIMIT 1',
        deal.affiliate_url,
        slug
      );
      return {
        ...deal,
        warnings,
        already_published: existing ? { id: existing.id, title: existing.title } : null,
      };
    })
  );
}

function requestedStores(body) {
  const asked = Array.isArray(body?.stores) ? body.stores : [];
  const valid = asked.filter((s) => STORE_KEYS.includes(s));
  return valid.length ? valid : finder.STORE_ORDER;
}

/**
 * POST /api/admin/finder/search — search the stores for a term.
 * Read-only.
 */
const searchProducts = asyncHandler(async (req, res) => {
  const query = String(req.body?.query ?? '').trim().slice(0, 120);
  if (query.length < 2) {
    throw new ApiError(400, 'Type what to search for, for example "cotton t shirt".');
  }

  const category = String(req.body?.category ?? '').trim().slice(0, 80) || 'Other';
  const stores = requestedStores(req.body);
  const limit = Math.min(finder.MAX_RESULTS, Math.max(1, Number(req.body?.limit) || 12));

  // Ask each store for enough that the interleaved grid can still reach the limit.
  const perStore = Math.max(4, Math.ceil(limit / stores.length) + 2);

  const { products, reports } = await finder.searchStores({ query, stores, perStore });
  const { accepted, rejected } = finder.vetAll(products, category);

  res.json({
    query,
    category,
    stores,
    reports,
    results: (await decorate(accepted)).slice(0, limit),
    rejected,
    // Handy when every store is blocked: the admin can search the store directly and
    // paste the links back.
    searchLinks: finder.searchLinks(query),
  });
});

/**
 * POST /api/admin/finder/resolve — turn pasted product links into drafts.
 * Read-only. This is the path that works for every store, including the ones that refuse
 * server-side search.
 */
const resolveLinks = asyncHandler(async (req, res) => {
  const raw = req.body?.urls;
  const urls = (Array.isArray(raw) ? raw : String(raw ?? '').split(/[\s,]+/))
    .map((u) => String(u).trim())
    .filter(Boolean);

  if (!urls.length) throw new ApiError(400, 'Paste at least one product link.');
  if (urls.length > finder.MAX_URLS) {
    throw new ApiError(400, `Paste at most ${finder.MAX_URLS} links at a time.`);
  }

  const category = String(req.body?.category ?? '').trim().slice(0, 80) || 'Other';

  const { drafts, failures } = await finder.resolveUrls(urls);
  const { accepted, rejected } = finder.vetAll(drafts, category);

  res.json({
    category,
    requested: urls.length,
    results: await decorate(accepted),
    // Links that could not be read at all, and drafts the gate turned away.
    rejected: [...failures.map((f) => ({ title: f.url, reason: f.error })), ...rejected],
  });
});

module.exports = { finderStatus, searchProducts, resolveLinks };
