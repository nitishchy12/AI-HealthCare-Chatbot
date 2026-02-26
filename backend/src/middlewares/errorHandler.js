const { logger } = require('../utils/logger');

module.exports = (error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server error';
  const publicError = error.error || (statusCode >= 500 ? 'Internal server error' : message);

  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      requestId: req.id,
      message,
      error: error.message
    });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: publicError,
    requestId: req.id
  });
};
