const { pool } = require('../config/db');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');

const listDiseases = async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM diseases ORDER BY disease_name ASC');
    return res.status(200).json({ success: true, message: 'Diseases fetched', data: result.rows });
  } catch (error) {
    return next(error);
  }
};

const addDisease = async (req, res, next) => {
  try {
    const payload = {
      disease_name: clean(req.body.disease_name),
      symptoms: clean(req.body.symptoms),
      prevention: clean(req.body.prevention),
      treatment: clean(req.body.treatment),
      risk_factors: clean(req.body.risk_factors)
    };

    const result = await pool.query(
      'INSERT INTO diseases (disease_name, symptoms, prevention, treatment, risk_factors) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [payload.disease_name, payload.symptoms, payload.prevention, payload.treatment, payload.risk_factors]
    );

    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'CREATE',
      entityType: 'disease',
      entityId: result.rows[0].id,
      details: { disease_name: result.rows[0].disease_name }
    });

    return res.status(201).json({ success: true, message: 'Disease info added', data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return next({ statusCode: 400, message: 'Disease already exists' });
    }
    return next(error);
  }
};

const updateDisease = async (req, res, next) => {
  try {
    const payload = {
      disease_name: clean(req.body.disease_name),
      symptoms: clean(req.body.symptoms),
      prevention: clean(req.body.prevention),
      treatment: clean(req.body.treatment),
      risk_factors: clean(req.body.risk_factors)
    };

    const result = await pool.query(
      `UPDATE diseases
       SET disease_name = $1, symptoms = $2, prevention = $3, treatment = $4, risk_factors = $5
       WHERE id = $6
       RETURNING *`,
      [payload.disease_name, payload.symptoms, payload.prevention, payload.treatment, payload.risk_factors, req.params.id]
    );

    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Disease not found' });
    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'UPDATE',
      entityType: 'disease',
      entityId: result.rows[0].id,
      details: { disease_name: result.rows[0].disease_name }
    });
    return res.status(200).json({ success: true, message: 'Disease updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

const deleteDisease = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM diseases WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'Disease not found' });
    await logAuditAction({
      userId: req.user.id,
      role: req.user.role,
      action: 'DELETE',
      entityType: 'disease',
      entityId: req.params.id
    });
    return res.status(200).json({ success: true, message: 'Disease deleted', data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listDiseases, addDisease, updateDisease, deleteDisease };
