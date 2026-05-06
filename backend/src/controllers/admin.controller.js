const { pool } = require('../config/db');
const Message    = require('../models/Message');
const Conversation = require('../models/Conversation');
const { clean } = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');

/* GET /api/admin/stats ─────────────────────────────────────────── */
const getStats = async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, convs7d, highRisk7d] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(`SELECT COUNT(*) FROM users WHERE last_seen_at > NOW() - INTERVAL '24 hours'`),
      Conversation.countDocuments({ created_at: { $gte: new Date(Date.now() - 7 * 86400000) } }),
      Message.countDocuments({
        created_at: { $gte: new Date(Date.now() - 7 * 86400000) },
        'structured_output.riskLevel': 'High',
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Admin stats fetched',
      data: {
        total_users:       parseInt(totalUsers.rows[0].count, 10),
        active_24h:        parseInt(activeUsers.rows[0].count, 10),
        conversations_7d:  convs7d,
        high_risk_7d:      highRisk7d,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/admin/users?search=X&role=Y&page=N ──────────────────── */
const getUsers = async (req, res, next) => {
  try {
    const search = clean(req.query.search || '');
    const role   = clean(req.query.role   || '');
    const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT id, name, first_name, last_name, email, role,
                last_seen_at, created_at, suspended_at,
                CASE WHEN suspended_at IS NOT NULL THEN true ELSE false END AS is_suspended
         FROM users
         WHERE ($1 = '' OR LOWER(name) LIKE LOWER('%'||$1||'%') OR LOWER(email) LIKE LOWER('%'||$1||'%'))
           AND ($2 = '' OR role = $2)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [search, role, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM users
         WHERE ($1 = '' OR LOWER(name) LIKE LOWER('%'||$1||'%') OR LOWER(email) LIKE LOWER('%'||$1||'%'))
           AND ($2 = '' OR role = $2)`,
        [search, role],
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Users fetched',
      data: rows.rows,
      pagination: { page, limit, total: parseInt(count.rows[0].count, 10) },
    });
  } catch (error) {
    return next(error);
  }
};

/* PATCH /api/admin/users/:id/role ──────────────────────────────── */
const updateRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return next({ statusCode: 400, message: 'Role must be user or admin' });
    }

    const result = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, name, email, role',
      [role, req.params.id],
    );
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'User not found' });

    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: 'UPDATE_ROLE', entityType: 'user',
      entityId: req.params.id,
      details: { new_role: role, target_email: result.rows[0].email },
    });

    return res.status(200).json({ success: true, message: 'Role updated', data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
};

/* PATCH /api/admin/users/:id/suspend ───────────────────────────── */
const suspendUser = async (req, res, next) => {
  try {
    const { suspended } = req.body;
    if (typeof suspended !== 'boolean') {
      return next({ statusCode: 400, message: 'suspended must be a boolean' });
    }

    // Prevent admins from suspending themselves
    if (String(req.params.id) === String(req.user.id)) {
      return next({ statusCode: 400, message: 'You cannot suspend your own account' });
    }

    const result = await pool.query(
      `UPDATE users
       SET suspended_at = $1
       WHERE id = $2
       RETURNING id, name, email, suspended_at`,
      [suspended ? new Date() : null, req.params.id],
    );
    if (result.rowCount === 0) return next({ statusCode: 404, message: 'User not found' });

    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: suspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
      entityType: 'user', entityId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: `User ${suspended ? 'suspended' : 'unsuspended'}`,
      data: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/admin/audit-logs?search=X&from=DATE&to=DATE&page=N ──── */
const getAuditLogs = async (req, res, next) => {
  try {
    const search = clean(req.query.search || '');
    const from   = req.query.from || null;
    const to     = req.query.to   || null;
    const page   = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT al.*, u.name AS actor_name, u.email AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ($1 = '' OR LOWER(u.name) LIKE LOWER('%'||$1||'%') OR LOWER(al.action) LIKE LOWER('%'||$1||'%'))
           AND ($2::timestamptz IS NULL OR al.created_at >= $2::timestamptz)
           AND ($3::timestamptz IS NULL OR al.created_at <= $3::timestamptz)
         ORDER BY al.created_at DESC
         LIMIT $4 OFFSET $5`,
        [search, from, to, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ($1 = '' OR LOWER(u.name) LIKE LOWER('%'||$1||'%') OR LOWER(al.action) LIKE LOWER('%'||$1||'%'))
           AND ($2::timestamptz IS NULL OR al.created_at >= $2::timestamptz)
           AND ($3::timestamptz IS NULL OR al.created_at <= $3::timestamptz)`,
        [search, from, to],
      ),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit logs fetched',
      data: rows.rows,
      pagination: { page, limit, total: parseInt(count.rows[0].count, 10) },
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/admin/prompts ────────────────────────────────────────── */
const getPrompts = async (req, res, next) => {
  try {
    const fs   = require('fs');
    const path = require('path');
    const dir  = path.resolve(__dirname, '../../../../ai-service/prompts');

    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'));
    } catch {
      // prompts dir may not be mounted in dev — return empty list gracefully
    }

    const prompts = files.map((f) => ({
      filename: f,
      version:  path.basename(f, '.txt'),
    }));

    // Active version stored in Redis (falls back to first file if not set)
    const { getCachedOrFetch } = require('../utils/redisCache');
    let activeVersion = '';
    try {
      const Redis = require('ioredis');
      const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      activeVersion = (await r.get('active_prompt_version')) || (prompts[0]?.version || '');
      r.disconnect();
    } catch {
      activeVersion = prompts[0]?.version || '';
    }

    return res.status(200).json({ success: true, data: prompts, active_version: activeVersion });
  } catch (error) {
    return next(error);
  }
};

/* POST /api/admin/prompts/activate ─────────────────────────────── */
const activatePrompt = async (req, res, next) => {
  try {
    const { version } = req.body;
    if (!version) return next({ statusCode: 400, message: 'version is required' });

    try {
      const Redis = require('ioredis');
      const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      await r.set('active_prompt_version', version);
      r.disconnect();
    } catch {
      return next({ statusCode: 503, message: 'Redis unavailable — cannot persist prompt version' });
    }

    await logAuditAction({
      userId: req.user.id, role: req.user.role,
      action: 'ACTIVATE_PROMPT', entityType: 'prompt',
      entityId: version,
    });

    return res.status(200).json({ success: true, message: `Prompt ${version} activated` });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/admin/eval/latest ────────────────────────────────────── */
const getEvalLatest = async (req, res, next) => {
  try {
    let data = null;
    try {
      const Redis = require('ioredis');
      const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      const raw = await r.get('eval:latest_results');
      if (raw) data = JSON.parse(raw);
      r.disconnect();
    } catch { /* Redis unavailable */ }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

/* POST /api/admin/eval/run ──────────────────────────────────────── */
const runEval = async (req, res, next) => {
  try {
    const { execFile } = require('child_process');
    const path = require('path');
    const evalScript = path.resolve(__dirname, '../../../../ai-service/eval/evaluate.py');

    // Fire and forget — evaluation may take minutes
    execFile('python', [evalScript], { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) return;
      try {
        const result = JSON.parse(stdout.trim().split('\n').pop() || '{}');
        if (result.accuracy !== undefined) {
          const Redis = require('ioredis');
          const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
          r.set('eval:latest_results', JSON.stringify({ ...result, run_at: new Date().toISOString() }))
            .finally(() => r.disconnect());
        }
      } catch { /* non-JSON output — ignore */ }
    });

    return res.status(202).json({ success: true, message: 'Evaluation started' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getStats, getUsers, updateRole, suspendUser, getAuditLogs, getPrompts, activatePrompt, getEvalLatest, runEval };
