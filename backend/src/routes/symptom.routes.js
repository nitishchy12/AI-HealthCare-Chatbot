const router  = require('express').Router();
const auth    = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const { createSymptomCheck, getSymptomChecks, getRelatedSymptoms } = require('../controllers/symptom.controller');

router.use(auth);
router.get('/',         getSymptomChecks);
router.post('/',        validate(schemas.symptomCheck), createSymptomCheck);
router.post('/related', validate(schemas.relatedSymptoms), getRelatedSymptoms);

module.exports = router;
