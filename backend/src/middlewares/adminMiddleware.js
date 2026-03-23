const { logger } = require('../utils/logger');

module.exports = (req, _res, next) => {
  logger.info('Role check', { role: req.user?.role, userId: req.user?.id, requestId: req.id });
  if (!req.user || req.user.role !== 'admin') {
    return next({ statusCode: 403, message: 'Forbidden: admin access required' });
  }
  return next();
};
