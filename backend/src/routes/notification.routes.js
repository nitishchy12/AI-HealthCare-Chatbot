const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const { getNotifications } = require('../controllers/notification.controller');

router.use(auth);
router.get('/', getNotifications);

module.exports = router;
