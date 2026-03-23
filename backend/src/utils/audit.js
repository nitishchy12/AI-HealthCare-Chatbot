const { pool } = require('../config/db');
const { logger } = require('./logger');

const logAuditAction = async ({ userId, role, action, entityType, entityId, details }) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId || null, role || null, action, entityType, entityId ? String(entityId) : null, details || null]
    );
  } catch (error) {
    logger.warn('Audit log write failed', { error: error.message, action, entityType });
  }
};

module.exports = { logAuditAction };
