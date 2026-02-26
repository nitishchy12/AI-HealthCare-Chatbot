const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');
const validate, { schemas } = require('../middlewares/validate');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Rate limit exceeded',
    error: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

router.post('/register', validate(schemas.register), register);
router.post('/login', loginLimiter, validate(schemas.login), login);

module.exports = router;
