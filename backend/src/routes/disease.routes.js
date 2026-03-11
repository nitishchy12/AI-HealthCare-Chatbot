const router = require('express').Router();
const { listDiseases, addDisease } = require('../controllers/disease.controller');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.get('/', listDiseases);
router.post('/', auth, admin, validate(schemas.disease), addDisease);

module.exports = router;
