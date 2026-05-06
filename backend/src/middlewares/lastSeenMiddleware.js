const { pool } = require('../config/db');
const { LAST_SEEN_UPDATE_DEBOUNCE_MS } = require('../config/constants');

// Track last DB write per user in-process to avoid hammering DB on every request
const lastUpdated = new Map();

module.exports = async (req, _res, next) => {
  if (!req.user?.id) return next();

  const userId = req.user.id;
  const now    = Date.now();
  const last   = lastUpdated.get(userId) || 0;

  if (now - last > LAST_SEEN_UPDATE_DEBOUNCE_MS) {
    lastUpdated.set(userId, now);
    // Fire-and-forget — never block the request
    pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]).catch(() => {});
  }

  return next();
};
