/**
 * Lightweight Redis cache helper with graceful no-op when Redis is unavailable.
 * All functions are safe to call without a running Redis — they just skip caching.
 */
let _client = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url || process.env.NODE_ENV === 'test') return null;
  try {
    const Redis = require('ioredis');
    _client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true, enableOfflineQueue: false });
    _client.on('error', () => {}); // silence connection errors
    return _client;
  } catch { return null; }
}

/**
 * Get a cached value or fetch it and store it.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} fetchFn
 */
const getCachedOrFetch = async (key, ttlSeconds, fetchFn) => {
  const r = getClient();
  if (r) {
    try {
      const cached = await r.get(key);
      if (cached !== null) return JSON.parse(cached);
    } catch { /* cache miss — continue to fetch */ }
  }

  const data = await fetchFn();

  if (r) {
    try { await r.setex(key, ttlSeconds, JSON.stringify(data)); } catch {}
  }

  return data;
};

const del = async (...keys) => {
  const r = getClient();
  if (!r) return;
  try { await r.del(...keys); } catch {}
};

module.exports = { getCachedOrFetch, del };
