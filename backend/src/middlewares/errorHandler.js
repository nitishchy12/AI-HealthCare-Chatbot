const { logger } = require('../utils/logger');

module.exports = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  if (statusCode >= 500) {
    logger.error(message, error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data: null
  });
};
