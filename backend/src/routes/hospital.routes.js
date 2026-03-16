const router = require('express').Router();
const { getByCity, addHospital, updateHospital, deleteHospital } = require('../controllers/hospital.controller');
const auth = require('../middlewares/authMiddleware');
const admin = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.get('/', getByCity);
router.post('/', auth, admin, validate(schemas.hospital), addHospital);
router.put('/:id', auth, admin, validate(schemas.hospital), updateHospital);
router.delete('/:id', auth, admin, deleteHospital);

module.exports = router;
