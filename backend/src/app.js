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
const { logger } = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, try again later.' }
});

app.use('/api', globalLimiter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy', data: { uptime: process.uptime() } });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/diseases', diseaseRoutes);

app.use((req, _res, next) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  next({ statusCode: 404, message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
