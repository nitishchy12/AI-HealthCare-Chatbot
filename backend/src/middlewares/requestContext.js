const { randomUUID } = require('crypto');
const { logger } = require('../utils/logger');

module.exports = (req, res, next) => {
  const requestId = randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  logger.info('Incoming request', { requestId, method: req.method, url: req.originalUrl });

  res.on('finish', () => {
    logger.info('Request complete', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start
    });
  });

  next();
};
