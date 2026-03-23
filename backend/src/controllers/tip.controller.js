const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');

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

    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'CREATE',
      entityType: 'health_tip',
      entityId: result.rows[0].id,
      details: { title: result.rows[0].title }
    });

    return res.status(201).json({ success: true, message: 'Health tip added', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const updateTip = async (req, res, next) => {
  try {
    const payload = {
      title: clean(req.body.title),
      description: clean(req.body.description),
      category: clean(req.body.category || 'General Wellness')
    };

    const result = await pool.query(
      `UPDATE health_tips
       SET title = $1, description = $2, category = $3
       WHERE id = $4
       RETURNING *`,
      [payload.title, payload.description, payload.category, req.params.id]
    );

    if (result.rowCount === 0) {
      return next({ statusCode: 404, message: 'Health tip not found' });
    }

    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'UPDATE',
      entityType: 'health_tip',
      entityId: result.rows[0].id,
      details: { title: result.rows[0].title }
    });

    return res.status(200).json({ success: true, message: 'Health tip updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const deleteTip = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM health_tips WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return next({ statusCode: 404, message: 'Health tip not found' });
    }

    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'DELETE',
      entityType: 'health_tip',
      entityId: req.params.id
    });

    return res.status(200).json({ success: true, message: 'Health tip deleted', data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listTips, addTip, updateTip, deleteTip };
