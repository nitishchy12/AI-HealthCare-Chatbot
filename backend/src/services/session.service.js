const crypto = require('crypto');
const { pool } = require('../config/db');
const { REFRESH_TOKEN_BYTES, REFRESH_TOKEN_EXPIRY_MS } = require('../config/constants');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const createSession = async ({ userId, ip, userAgent }) => {
  const rawToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, ip, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, ip || null, userAgent || null],
  );

  return rawToken;
};

const findSession = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  const result = await pool.query(
    `SELECT * FROM user_sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND created_at > NOW() - INTERVAL '7 days'`,
    [tokenHash],
  );
  return result.rows[0] || null;
};

const rotateSession = async (oldRawToken, { userId, ip, userAgent }) => {
  const oldHash = hashToken(oldRawToken);
  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1`,
    [oldHash],
  );
  return createSession({ userId, ip, userAgent });
};

const revokeSession = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1`,
    [tokenHash],
  );
};

const revokeAllSessions = async (userId) => {
  await pool.query(
    `UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
};

const touchSession = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  await pool.query(
    `UPDATE user_sessions SET last_active_at = NOW() WHERE refresh_token_hash = $1`,
    [tokenHash],
  );
};

module.exports = {
  createSession,
  findSession,
  rotateSession,
  revokeSession,
  revokeAllSessions,
  touchSession,
};
