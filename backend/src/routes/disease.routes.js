const router = require('express').Router();
const { listDiseases, addDisease, updateDisease, deleteDisease } = require('../controllers/disease.controller');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.get('/', listDiseases);
router.post('/', auth, admin, validate(schemas.disease), addDisease);
router.put('/:id', auth, admin, validate(schemas.disease), updateDisease);
router.delete('/:id', auth, admin, deleteDisease);

module.exports = router;
