const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');

const listTips = async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM health_tips ORDER BY created_at DESC LIMIT 10');
    return res.status(200).json({ success: true, message: 'Health tips fetched', data: result.rows });
  } catch (error) {
    return next(error);
  }
};

const addTip = async (req, res, next) => {
  try {
    const payload = {
      title: clean(req.body.title),
      description: clean(req.body.description),
      category: clean(req.body.category || 'General Wellness')
    };

    const result = await pool.query(
      'INSERT INTO health_tips (title, description, category) VALUES ($1, $2, $3) RETURNING *',
      [payload.title, payload.description, payload.category]
    );

    return res.status(201).json({ success: true, message: 'Health tip added', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listTips, addTip };
