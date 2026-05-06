const http = require('http');
const app = require('./src/app');
const { connectMongo, connectPostgres, closeConnections } = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const { initWorkers } = require('./src/workers/index');
const { logger } = require('./src/utils/logger');

const PORT = process.env.PORT || 5004;
const DB_STARTUP_RETRIES = Number(process.env.DB_STARTUP_RETRIES || 15);
const DB_STARTUP_DELAY_MS = Number(process.env.DB_STARTUP_DELAY_MS || 4000);
let server;
let io;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDatabasesWithRetry = async () => {
  let lastError;

  for (let attempt = 1; attempt <= DB_STARTUP_RETRIES; attempt += 1) {
    try {
      await connectPostgres();
      await connectMongo();
      return;
    } catch (error) {
      lastError = error;
      logger.warn('Database startup attempt failed', {
        attempt,
        retries: DB_STARTUP_RETRIES,
        retryInMs: DB_STARTUP_DELAY_MS,
        error: error.message
      });

      await closeConnections();

      if (attempt < DB_STARTUP_RETRIES) {
        await delay(DB_STARTUP_DELAY_MS);
      }
    }
  }

  throw lastError;
};

const gracefulShutdown = async (signal) => {
  logger.info('Server shutting down', { signal });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (io) {
    io.close();
  }

  await closeConnections();
  process.exit(0);
};

(async () => {
  try {
    await connectDatabasesWithRetry();

    server = http.createServer(app);
    io = initSocket(server);
    app.set('io', io);

    // Start BullMQ workers (no-op if Redis unavailable)
    initWorkers(io);

    server.listen(PORT, () => {
      logger.info(`Backend running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Startup failed due to database connection issue', { error: error.message });
    process.exit(1);
  }
})();

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
