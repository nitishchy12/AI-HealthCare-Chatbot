const router = require('express').Router();
const {
  createChat, getMyChats, clearMyChats, chatLimiter,
  streamChat, saveFeedback,
} = require('../controllers/chat.controller');
const auth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.use(auth);
router.get('/history',  getMyChats);
router.delete('/history', clearMyChats);
router.post('/', chatLimiter, validate(schemas.chat), createChat);

// SSE streaming uses fetch on the client so Authorization headers are available.
router.get('/stream', chatLimiter, streamChat);

// Message feedback
router.post('/messages/:messageId/feedback', validate(schemas.feedback), saveFeedback);

module.exports = router;
