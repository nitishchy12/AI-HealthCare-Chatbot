const router  = require('express').Router();
const { getByCity, getNearby, addHospital, updateHospital, deleteHospital } = require('../controllers/hospital.controller');
const auth    = require('../middlewares/authMiddleware');
const admin   = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');

router.get('/nearby', getNearby);
router.get('/',       getByCity);
router.post('/',      auth, admin, validate(schemas.hospital), addHospital);
router.put('/:id',    auth, admin, validate(schemas.hospital), updateHospital);
router.delete('/:id', auth, admin, deleteHospital);

module.exports = router;
