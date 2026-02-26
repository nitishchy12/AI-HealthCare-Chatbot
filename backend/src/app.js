const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const diseaseRoutes = require('./routes/disease.routes');
const errorHandler = require('./middlewares/errorHandler');
const requestContext = require('./middlewares/requestContext');
const { getDbHealth } = require('./config/db');
const { logger } = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(requestContext);

morgan.token('reqId', (req) => req.id);
app.use(morgan(':method :url :status :response-time ms reqId=:reqId'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded', error: 'Too many requests, try again later.' }
});

app.use('/api', globalLimiter);

app.get('/api/health', (_req, res) => {
  const health = getDbHealth();
  const dbConnected = health.postgres && health.mongo;
  return res.status(200).json({
    status: dbConnected ? 'OK' : 'DEGRADED',
    uptime: `${Math.floor(process.uptime())}s`,
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/diseases', diseaseRoutes);

app.use((req, _res, next) => {
  logger.warn('Route not found', { requestId: req.id, method: req.method, url: req.originalUrl });
  next({ statusCode: 404, message: 'Not Found', error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
