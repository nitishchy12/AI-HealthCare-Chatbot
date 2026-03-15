const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const { getHealthReport } = require('../controllers/report.controller');

router.use(auth);
router.get('/', getHealthReport);

module.exports = router;
