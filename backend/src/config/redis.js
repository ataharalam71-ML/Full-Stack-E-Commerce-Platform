const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: false,
});

redis.on('error', (err) => {
  // Don't crash the app if Redis is temporarily unavailable — caching is an optimization,
  // not a hard dependency. Callers should treat cache misses/errors as "go to DB".
  console.error('Redis error:', err.message);
});

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60;

/**
 * Get a JSON value from cache, or null if missing/unavailable.
 */
async function cacheGet(key) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set a JSON value in cache with TTL. Failures are swallowed.
 */
async function cacheSet(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* noop */
  }
}

/**
 * Delete cache keys matching a prefix (used for invalidation on writes).
 */
async function cacheDelByPrefix(prefix) {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(keys);
  } catch {
    /* noop */
  }
}

module.exports = { redis, cacheGet, cacheSet, cacheDelByPrefix, CACHE_TTL_SECONDS };
