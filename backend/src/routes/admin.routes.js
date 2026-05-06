const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const admin  = require('../middlewares/adminMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const {
  getStats, getUsers, updateRole, suspendUser, getAuditLogs,
  getPrompts, activatePrompt, getEvalLatest, runEval,
} = require('../controllers/admin.controller');

router.use(auth, admin);

router.get('/stats',              getStats);
router.get('/users',              getUsers);
router.patch('/users/:id/role',   validate(schemas.adminRole),    updateRole);
router.patch('/users/:id/suspend',validate(schemas.adminSuspend), suspendUser);
router.get('/audit-logs',         getAuditLogs);

router.get('/prompts',            getPrompts);
router.post('/prompts/activate',  activatePrompt);
router.get('/eval/latest',        getEvalLatest);
router.post('/eval/run',          runEval);

module.exports = router;
