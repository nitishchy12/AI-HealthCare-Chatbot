const router = require('express').Router();
const { createChat, getMyChats, clearMyChats, chatLimiter } = require('../controllers/chat.controller');
const auth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.use(auth);
router.get('/history', getMyChats);
router.delete('/history', clearMyChats);
router.post('/', chatLimiter, validate(schemas.chat), createChat);

module.exports = router;
