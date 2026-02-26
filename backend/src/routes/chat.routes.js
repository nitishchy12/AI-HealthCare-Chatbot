const router = require('express').Router();
const { createChat, getMyChats, chatLimiter } = require('../controllers/chat.controller');
const auth = require('../middlewares/authMiddleware');
const validate, { schemas } = require('../middlewares/validate');

router.use(auth);
router.get('/history', getMyChats);
router.post('/', chatLimiter, validate(schemas.chat), createChat);

module.exports = router;
