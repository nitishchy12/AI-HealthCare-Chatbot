const webpush   = require('web-push');
const { pool }  = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logger } = require('../utils/logger');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@healthguide.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

/* GET /api/push/vapid-public-key — public ──────────────────────── */
const getVapidPublicKey = (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ success: false, message: 'Push notifications not configured' });
  return res.status(200).json({ success: true, publicKey: key });
};

/* POST /api/push/subscribe ─────────────────────────────────────── */
const subscribe = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return next({ statusCode: 400, message: 'Invalid subscription object' });
    }

    const endpoint = clean(subscription.endpoint);
    const p256dh   = clean(subscription.keys.p256dh);
    const auth     = clean(subscription.keys.auth);

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint)
       DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id`,
      [req.user.id, endpoint, p256dh, auth],
    );

    return res.status(201).json({ success: true, message: 'Push subscription registered' });
  } catch (error) {
    return next(error);
  }
};

/* DELETE /api/push/unsubscribe ─────────────────────────────────── */
const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return next({ statusCode: 400, message: 'endpoint is required' });

    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user.id, clean(endpoint)],
    );

    return res.status(200).json({ success: true, message: 'Push subscription removed' });
  } catch (error) {
    return next(error);
  }
};

/* Internal helper — send push to all subscriptions for a user ──── */
const sendPushToUser = async (userId, { title, body, url = '/' }) => {
  if (!process.env.VAPID_PUBLIC_KEY) return; // push not configured

  let rows = [];
  try {
    const result = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId],
    );
    rows = result.rows;
  } catch (err) {
    logger.warn('sendPushToUser: DB error', { error: err.message, userId });
    return;
  }

  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
    } catch (err) {
      if (err.statusCode === 410) {
        // Subscription expired — remove it
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(() => {});
      } else {
        logger.warn('Push send failed', { error: err.message, userId });
      }
    }
  }));
};

module.exports = { getVapidPublicKey, subscribe, unsubscribe, sendPushToUser };
