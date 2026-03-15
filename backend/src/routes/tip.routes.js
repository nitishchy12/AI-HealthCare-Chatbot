const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const { listTips, addTip } = require('../controllers/tip.controller');

router.get('/', listTips);
router.post('/', auth, admin, validate(schemas.tip), addTip);

module.exports = router;
