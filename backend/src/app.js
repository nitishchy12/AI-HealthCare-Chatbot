const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const authRoutes         = require('./routes/auth.routes');
const chatRoutes         = require('./routes/chat.routes');
const hospitalRoutes     = require('./routes/hospital.routes');
const diseaseRoutes      = require('./routes/disease.routes');
const symptomRoutes      = require('./routes/symptom.routes');
const historyRoutes      = require('./routes/history.routes');
const reportRoutes       = require('./routes/report.routes');
const tipRoutes          = require('./routes/tip.routes');
const profileRoutes      = require('./routes/profile.routes');
const notificationRoutes = require('./routes/notification.routes');
const conversationRoutes = require('./routes/conversation.routes');
const adminRoutes        = require('./routes/admin.routes');
const pushRoutes         = require('./routes/push.routes');

const errorHandler   = require('./middlewares/errorHandler');
const requestContext = require('./middlewares/requestContext');
const lastSeen       = require('./middlewares/lastSeenMiddleware');
const { getDbHealth } = require('./config/db');
const swaggerSpec    = require('./config/swagger');
const { logger }     = require('./utils/logger');
const {
  GLOBAL_RATE_LIMIT_WINDOW_MS,
  GLOBAL_RATE_LIMIT_MAX,
} = require('./config/constants');

const app = express();

// ── Security headers (helmet + custom CSP) ──────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:   ["'self'"],
      scriptSrc:    ["'self'"],
      styleSrc:     ["'self'", "'unsafe-inline'"],  // Tailwind inlines styles in dev
      imgSrc:       ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://*.tile.openstreetmap.org'],
      connectSrc:   ["'self'", 'https://nominatim.openstreetmap.org'],
      fontSrc:      ["'self'", 'data:'],
      frameSrc:     ["'none'"],
      objectSrc:    ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // allows Leaflet tiles
}));

// ── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Prompt-Version'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestContext);

// ── Structured request logging ────────────────────────────────────
morgan.token('reqId', (req) => req.id);
morgan.token('userId', (req) => req.user?.id || '-');
app.use(morgan(':method :url :status :response-time ms reqId=:reqId userId=:userId'));

// ── Global rate limiter (IP-based) ───────────────────────────────
const globalLimiter = rateLimit({
  windowMs:        GLOBAL_RATE_LIMIT_WINDOW_MS,
  max:             GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.ip,
  message: { success: false, message: 'Rate limit exceeded', error: 'Too many requests, try again later.' },
});
app.use('/api', globalLimiter);

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const health = getDbHealth();
  const dbConnected = health.postgres && health.mongo;
  return res.status(200).json({
    status:   dbConnected ? 'OK' : 'DEGRADED',
    uptime:   `${Math.floor(process.uptime())}s`,
    database: dbConnected ? 'connected' : 'disconnected',
    version:  process.env.npm_package_version || '1.0.0',
  });
});

// ── Swagger docs (dev only) ───────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use(lastSeen);            // updates last_seen_at for authenticated requests
app.use('/api/chat',          chatRoutes);
app.use('/api/symptoms',      symptomRoutes);
app.use('/api/history',       historyRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/hospitals',     hospitalRoutes);
app.use('/api/diseases',      diseaseRoutes);
app.use('/api/tips',          tipRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/push',         pushRoutes);

// ── 404 handler ───────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.warn('Route not found', { requestId: req.id, method: req.method, url: req.originalUrl });
  next({ statusCode: 404, message: 'Not Found', error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
