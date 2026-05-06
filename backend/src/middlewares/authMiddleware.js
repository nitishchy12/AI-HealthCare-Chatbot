const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');

module.exports = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next({ statusCode: 401, message: 'Unauthorized: token missing', error: 'TOKEN_MISSING' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next({ statusCode: 401, message: 'Token expired', error: 'TOKEN_EXPIRED' });
    }
    return next({ statusCode: 401, message: 'Unauthorized: invalid token', error: 'TOKEN_INVALID' });
  }

  // Check suspended_at — only query when column exists (migration 005 may not have run yet)
  try {
    const result = await pool.query(
      'SELECT suspended_at FROM users WHERE id = $1',
      [decoded.id],
    );
    if (result.rows[0]?.suspended_at) {
      return next({
        statusCode: 403,
        message:    'Your account has been suspended. Contact support.',
        error:      'ACCOUNT_SUSPENDED',
      });
    }
  } catch {
    // Column may not exist if migration hasn't run — safe to ignore
  }

  req.user = decoded;
  return next();
};
