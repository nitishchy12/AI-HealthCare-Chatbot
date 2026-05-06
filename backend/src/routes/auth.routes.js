const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const {
  register, login, twoFactorLogin,
  refresh, logout, logoutAll,
  setup2FA, verify2FA, disable2FA,
} = require('../controllers/auth.controller');
const validate    = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const auth        = require('../middlewares/authMiddleware');
const {
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
} = require('../config/constants');

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max:      AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error:   'RATE_LIMITED',
  },
});

// Public
router.post('/register',    authLimiter, validate(schemas.register),   register);
router.post('/login',       authLimiter, validate(schemas.login),       login);
router.post('/2fa/login',   authLimiter,                                twoFactorLogin);
router.post('/refresh',                                                  refresh);
router.post('/logout',                                                   logout);

// Authenticated
router.post('/logout-all',  auth,        logoutAll);
router.post('/2fa/setup',   auth,        setup2FA);
router.post('/2fa/verify',  auth,        validate(schemas.totpVerify),  verify2FA);
router.post('/2fa/disable', auth,        validate(schemas.totpDisable), disable2FA);

module.exports = router;
