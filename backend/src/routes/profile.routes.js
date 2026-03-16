const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const { getProfile, updateProfile } = require('../controllers/profile.controller');

router.use(auth);
router.get('/', getProfile);
router.put('/', validate(schemas.profile), updateProfile);

module.exports = router;
