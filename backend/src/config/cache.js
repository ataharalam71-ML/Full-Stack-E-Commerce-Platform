// Tiny in-process TTL cache. Replaces Redis: an affiliate catalogue is small and
// read-heavy, so an in-memory map gives the same win with zero infrastructure.
const store = new Map();

const DEFAULT_TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 60) * 1000;
const MAX_ENTRIES = 500;

function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  // Cheap bound on memory: drop the oldest insert once we hit the cap.
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Called after any write so visitors never see a stale catalogue. */
function cacheClear(prefix = '') {
  if (!prefix) return store.clear();
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { cacheGet, cacheSet, cacheClear };
