const argon2  = require('argon2');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode  = require('qrcode');
const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logger } = require('../utils/logger');
const sessionService = require('../services/session.service');
const {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
  ACCESS_TOKEN_EXPIRY,
  TOTP_TEMP_TOKEN_EXPIRY,
  TOTP_WINDOW,
  TOTP_STEP,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} = require('../config/constants');

/* ── Helpers ──────────────────────────────────────────────────────── */

const hashPassword = (pw) =>
  argon2.hash(pw, {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost:   ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  });

const verifyPassword = async (stored, supplied) => {
  // Graceful bcrypt → argon2id migration: verify with bcrypt if old hash
  if (stored.startsWith('$2')) {
    const match = await bcrypt.compare(supplied, stored);
    return { match, needsRehash: true };
  }
  const match = await argon2.verify(stored, supplied);
  return { match, needsRehash: false };
};

const signAccess = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

const signTemp = (userId) =>
  jwt.sign({ id: userId, type: '2fa_pending' }, process.env.JWT_SECRET, {
    expiresIn: TOTP_TEMP_TOKEN_EXPIRY,
  });

const safeUser = (u) => ({
  id:         u.id,
  name:       u.name,
  first_name: u.first_name,
  last_name:  u.last_name,
  email:      u.email,
  role:       u.role,
  age:        u.age,
  gender:     u.gender,
  city:       u.city,
  medical_notes: u.medical_notes,
  avatar_url:    u.avatar_url,
  totp_enabled:  u.totp_enabled,
  preferred_language: u.preferred_language,
  theme_preference:   u.theme_preference,
});

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';

/* ── Register ─────────────────────────────────────────────────────── */

const register = async (req, res, next) => {
  try {
    const name         = clean(req.body.name);
    const firstName    = clean(req.body.first_name || name.split(' ')[0] || '');
    const lastName     = clean(req.body.last_name  || name.split(' ').slice(1).join(' ') || '');
    const email        = clean(req.body.email).toLowerCase();
    const password     = req.body.password;
    const age          = req.body.age || null;
    const gender       = clean(req.body.gender || '');
    const medicalNotes = clean(req.body.medical_notes || '');
    const city         = clean(req.body.city || '');

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) return next({ statusCode: 409, message: 'Email already registered' });

    const hash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users
         (name, first_name, last_name, email, password_hash, age, gender, medical_notes, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, first_name, last_name, email, role, age, gender,
                 medical_notes, city, avatar_url, totp_enabled,
                 preferred_language, theme_preference, created_at`,
      [name, firstName, lastName, email, hash, age, gender || null, medicalNotes || null, city || null],
    );

    const user = result.rows[0];
    const accessToken   = signAccess(user);
    const refreshToken  = await sessionService.createSession({
      userId: user.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });

    logger.info('User registered', { userId: user.id, requestId: req.id });
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user: safeUser(user), token: accessToken, refreshToken },
    });
  } catch (error) {
    return next(error);
  }
};

/* ── Login ────────────────────────────────────────────────────────── */

const login = async (req, res, next) => {
  try {
    const email    = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      logger.warn('Login failed — email not found', { email, requestId: req.id });
      return next({ statusCode: 401, message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 1000 / 60);
      return next({
        statusCode: 429,
        message: `Account locked. Try again in ${remaining} minute(s).`,
        error: 'ACCOUNT_LOCKED',
      });
    }

    const { match, needsRehash } = await verifyPassword(user.password_hash, password);

    if (!match) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const isLocked = attempts >= MAX_LOGIN_ATTEMPTS;

      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             locked_until = $2
         WHERE id = $3`,
        [
          attempts,
          isLocked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
          user.id,
        ],
      );

      logger.warn('Login failed — wrong password', { userId: user.id, attempts, requestId: req.id });
      return next({
        statusCode: 401,
        message: isLocked
          ? `Too many failed attempts. Account locked for 15 minutes.`
          : 'Invalid email or password',
      });
    }

    // Reset lockout state + optionally rehash
    const updates = ['failed_login_attempts = 0', 'locked_until = NULL', 'last_seen_at = NOW()'];
    const values  = [user.id];

    if (needsRehash) {
      const newHash = await hashPassword(password);
      updates.push(`password_hash = $${values.length + 1}`);
      values.splice(0, 0, newHash);          // insert at front, user.id shifts
      values[values.length - 1] = user.id;  // fix: reset
      // Simpler approach:
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(password), user.id]);
    }

    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_seen_at = NOW() WHERE id = $1`,
      [user.id],
    );

    // 2FA gate
    if (user.totp_enabled) {
      const tempToken = signTemp(user.id);
      return res.status(200).json({
        success: true,
        message: '2FA required',
        data: { requires2FA: true, tempToken },
      });
    }

    const accessToken  = signAccess(user);
    const refreshToken = await sessionService.createSession({
      userId: user.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });

    logger.info('User logged in', { userId: user.id, requestId: req.id });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser(user), token: accessToken, refreshToken },
    });
  } catch (error) {
    return next(error);
  }
};

/* ── 2FA Login (second factor) ────────────────────────────────────── */

const twoFactorLogin = async (req, res, next) => {
  try {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) return next({ statusCode: 400, message: 'tempToken and totpCode required' });

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return next({ statusCode: 401, message: 'Invalid or expired 2FA session' });
    }

    if (payload.type !== '2fa_pending') return next({ statusCode: 401, message: 'Invalid token type' });

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [payload.id]);
    const user = result.rows[0];
    if (!user) return next({ statusCode: 401, message: 'User not found' });

    const valid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token:    totpCode,
      window:   TOTP_WINDOW,
      step:     TOTP_STEP,
    });

    if (!valid) return next({ statusCode: 401, message: 'Invalid 2FA code' });

    await pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    const accessToken  = signAccess(user);
    const refreshToken = await sessionService.createSession({
      userId: user.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser(user), token: accessToken, refreshToken },
    });
  } catch (error) {
    return next(error);
  }
};

/* ── Refresh ──────────────────────────────────────────────────────── */

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next({ statusCode: 400, message: 'refreshToken required' });

    const session = await sessionService.findSession(refreshToken);
    if (!session) return next({ statusCode: 401, message: 'Invalid or expired refresh token', error: 'REFRESH_INVALID' });

    const userResult = await pool.query(
      'SELECT id, email, role, name, first_name, last_name, avatar_url, totp_enabled, preferred_language, theme_preference FROM users WHERE id = $1',
      [session.user_id],
    );
    const user = userResult.rows[0];
    if (!user) return next({ statusCode: 401, message: 'User not found' });

    // Rotate: revoke old, issue new
    const newRefreshToken = await sessionService.rotateSession(refreshToken, {
      userId: user.id,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    const accessToken = signAccess(user);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: { token: accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    return next(error);
  }
};

/* ── Logout ───────────────────────────────────────────────────────── */

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await sessionService.revokeSession(refreshToken);
    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) {
    return next(error);
  }
};

const logoutAll = async (req, res, next) => {
  try {
    await sessionService.revokeAllSessions(req.user.id);
    return res.status(200).json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    return next(error);
  }
};

/* ── 2FA Setup ────────────────────────────────────────────────────── */

const setup2FA = async (req, res, next) => {
  try {
    const userResult = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const secret = speakeasy.generateSecret({
      name:   `HealthBot (${user.email})`,
      length: 32,
    });

    // Store secret temporarily (not yet enabled — user must verify first)
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    return res.status(200).json({
      success: true,
      message: '2FA setup initiated — scan the QR code and verify',
      data: {
        qrDataUrl,
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* ── 2FA Verify + Enable ──────────────────────────────────────────── */

const verify2FA = async (req, res, next) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode) return next({ statusCode: 400, message: 'totpCode required' });

    const result = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [req.user.id]);
    const { totp_secret } = result.rows[0];
    if (!totp_secret) return next({ statusCode: 400, message: 'Run 2FA setup first' });

    const valid = speakeasy.totp.verify({
      secret:   totp_secret,
      encoding: 'base32',
      token:    totpCode,
      window:   TOTP_WINDOW,
    });

    if (!valid) return next({ statusCode: 400, message: 'Invalid TOTP code — try again' });

    await pool.query('UPDATE users SET totp_enabled = TRUE WHERE id = $1', [req.user.id]);

    return res.status(200).json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    return next(error);
  }
};

/* ── 2FA Disable ──────────────────────────────────────────────────── */

const disable2FA = async (req, res, next) => {
  try {
    const { password, totpCode } = req.body;
    if (!password || !totpCode) return next({ statusCode: 400, message: 'password and totpCode required' });

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const { match } = await verifyPassword(user.password_hash, password);
    if (!match) return next({ statusCode: 401, message: 'Incorrect password' });

    const valid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token:    totpCode,
      window:   TOTP_WINDOW,
    });
    if (!valid) return next({ statusCode: 401, message: 'Invalid TOTP code' });

    await pool.query(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1',
      [req.user.id],
    );

    return res.status(200).json({ success: true, message: '2FA disabled' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  twoFactorLogin,
  refresh,
  logout,
  logoutAll,
  setup2FA,
  verify2FA,
  disable2FA,
};
