const app = require('./src/app');
const { connectMongo, connectPostgres } = require('./src/config/db');
const { logger } = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectPostgres();
    await connectMongo();

    app.listen(PORT, () => {
      logger.info(`Backend running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
})();
