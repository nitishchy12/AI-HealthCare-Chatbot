const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const { getHealthReport, getInsights, getReportPdf } = require('../controllers/report.controller');

router.use(auth);
router.get('/',         getHealthReport);
router.get('/insights', getInsights);
router.get('/pdf',      getReportPdf);

module.exports = router;
