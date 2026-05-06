const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/push.controller');

router.get('/vapid-public-key', getVapidPublicKey);   // public
router.post('/subscribe',    auth, subscribe);
router.delete('/unsubscribe', auth, unsubscribe);

module.exports = router;
