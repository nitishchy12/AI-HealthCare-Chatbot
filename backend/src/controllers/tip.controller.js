const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');
const { getCachedOrFetch, del } = require('../utils/redisCache');

const CACHE_KEY = 'tips:all';
const CACHE_TTL = 300;

const listTips = async (_req, res, next) => {
  try {
    const data = await getCachedOrFetch(CACHE_KEY, CACHE_TTL, async () => {
      const result = await pool.query(
        `SELECT * FROM health_tips
         WHERE is_active = true OR is_active IS NULL
           AND (scheduled_at IS NULL OR scheduled_at <= NOW())
         ORDER BY created_at DESC LIMIT 20`,
      );
      return result.rows;
    });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ success: true, message: 'Health tips fetched', data });
  } catch (error) { return next(error); }
};

const addTip = async (req, res, next) => {
  try {
    const payload = {
      title:        clean(req.body.title),
      description:  clean(req.body.description),
      category:     clean(req.body.category || 'General Wellness'),
      scheduled_at: req.body.scheduled_at || null,
    };
    const result = await pool.query(
      'INSERT INTO health_tips (title, description, category, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [payload.title, payload.description, payload.category, payload.scheduled_at],
    );
    await del(CACHE_KEY);
    await logAuditAction({ userId: req.user.id, role: req.user.role, action: 'CREATE', entityType: 'health_tip', entityId: result.rows[0].id, details: { title: result.rows[0].title } });
    return res.status(201).json({ success: true, message: 'Health tip added', data: result.rows[0] });
  } catch (error) { return next(error); }
};

const updateTip = async (req, res, next) => {
  try {
    const payload = {
      title:        clean(req.body.title),
      description:  clean(req.body.description),
      category:     clean(req.body.category || 'General Wellness'),
      scheduled_at: req.body.scheduled_at || null,
    };
    const result = await pool.query(
      'UPDATE health_tips SET title=$1, description=$2, category=$3, scheduled_at=$4 WHERE id=$5 RETURNING *',
      [payload.title, payload.description, payload.category, payload.scheduled_at, req.params.id],
    );
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Health tip not found' });
    await del(CACHE_KEY);
    await logAuditAction({ userId: req.user.id, role: req.user.role, action: 'UPDATE', entityType: 'health_tip', entityId: result.rows[0].id, details: { title: result.rows[0].title } });
    return res.status(200).json({ success: true, message: 'Health tip updated', data: result.rows[0] });
  } catch (error) { return next(error); }
};

const deleteTip = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM health_tips WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Health tip not found' });
    await del(CACHE_KEY);
    await logAuditAction({ userId: req.user.id, role: req.user.role, action: 'DELETE', entityType: 'health_tip', entityId: req.params.id });
    return res.status(200).json({ success: true, message: 'Health tip deleted', data: { id: req.params.id } });
  } catch (error) { return next(error); }
};

module.exports = { listTips, addTip, updateTip, deleteTip };
