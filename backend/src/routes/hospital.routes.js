const router = require('express').Router();
const { getByCity, addHospital } = require('../controllers/hospital.controller');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');
const validate, { schemas } = require('../middlewares/validate');

router.get('/', getByCity);
router.post('/', auth, admin, validate(schemas.hospital), addHospital);

module.exports = router;
