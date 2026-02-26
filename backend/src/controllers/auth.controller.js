const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logger } = require('../utils/logger');

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });

const register = async (req, res, next) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) return next({ statusCode: 400, message: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role, created_at',
      [name, email, hash]
    );

    const token = signToken(result.rows[0]);
    return res.status(201).json({ success: true, message: 'User registered successfully', data: { user: result.rows[0], token } });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = req.body.password;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rowCount === 0) {
      logger.warn('Failed login attempt', { email });
      return next({ statusCode: 401, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logger.warn('Failed login attempt', { email });
      return next({ statusCode: 401, message: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login };
