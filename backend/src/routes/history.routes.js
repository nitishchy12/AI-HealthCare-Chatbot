const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const { getHealthHistory } = require('../controllers/history.controller');

router.use(auth);
router.get('/', getHealthHistory);

module.exports = router;
