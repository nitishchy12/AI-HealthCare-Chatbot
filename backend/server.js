const http = require('http');
const app = require('./src/app');
const { connectMongo, connectPostgres, closeConnections } = require('./src/config/db');
const { initSocket } = require('./src/config/socket');
const { logger } = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;
let server;
let io;

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
    await connectPostgres();
    await connectMongo();

    server = http.createServer(app);
    io = initSocket(server);
    app.set('io', io);

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
