const router = require('express').Router();
const auth   = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { schemas } = require('../middlewares/validate');
const {
  list, create, getOne, rename, remove, getMessages, addSystemMessage, search,
} = require('../controllers/conversation.controller');

router.use(auth);

router.get('/search',       search);       // must come before /:id
router.get('/',             list);
router.post('/',            create);
router.get('/:id',          getOne);
router.patch('/:id',        rename);
router.delete('/:id',       remove);
router.get('/:id/messages', getMessages);
router.post('/:id/system-message', validate(schemas.conversationSystemMessage), addSystemMessage);

module.exports = router;
