const convSvc = require('../services/conversation.service');
const { DEFAULT_PAGE_LIMIT } = require('../config/constants');

/* GET /api/conversations */
const list = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT);
    const result = await convSvc.listConversations(req.user.id, { page, limit });
    return res.status(200).json({ success: true, message: 'Conversations fetched', data: result });
  } catch (err) { return next(err); }
};

/* POST /api/conversations */
const create = async (req, res, next) => {
  try {
    const { firstMessage = '', language = 'en' } = req.body;
    const conv = await convSvc.createConversation({
      userId: req.user.id,
      firstMessage,
      language,
    });
    return res.status(201).json({ success: true, message: 'Conversation created', data: conv });
  } catch (err) { return next(err); }
};

/* GET /api/conversations/:id */
const getOne = async (req, res, next) => {
  try {
    const conv = await convSvc.getConversationWithMessages(req.params.id, req.user.id);
    if (!conv) return next({ statusCode: 404, message: 'Conversation not found' });
    return res.status(200).json({ success: true, message: 'Conversation fetched', data: conv });
  } catch (err) { return next(err); }
};

/* PATCH /api/conversations/:id */
const rename = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return next({ statusCode: 400, message: 'title is required' });
    const conv = await convSvc.renameConversation(req.params.id, req.user.id, title);
    if (!conv) return next({ statusCode: 404, message: 'Conversation not found' });
    return res.status(200).json({ success: true, message: 'Conversation renamed', data: conv });
  } catch (err) { return next(err); }
};

/* DELETE /api/conversations/:id */
const remove = async (req, res, next) => {
  try {
    const conv = await convSvc.softDelete(req.params.id, req.user.id);
    if (!conv) return next({ statusCode: 404, message: 'Conversation not found' });
    return res.status(200).json({ success: true, message: 'Conversation deleted' });
  } catch (err) { return next(err); }
};

/* GET /api/conversations/:id/messages */
const getMessages = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const result = await convSvc.getMessages(req.params.id, req.user.id, { page, limit });
    if (!result) return next({ statusCode: 404, message: 'Conversation not found' });
    return res.status(200).json({ success: true, message: 'Messages fetched', data: result });
  } catch (err) { return next(err); }
};

/* POST /api/conversations/:id/system-message */
const addSystemMessage = async (req, res, next) => {
  try {
    const content = String(req.body.content || '').trim();
    if (!content) return next({ statusCode: 400, message: 'content is required' });

    const doc = await convSvc.appendSystemMessage(req.params.id, req.user.id, content);
    if (!doc) return next({ statusCode: 404, message: 'Conversation not found' });

    return res.status(201).json({ success: true, message: 'System message added', data: doc });
  } catch (err) { return next(err); }
};

/* GET /api/conversations/search?q=QUERY&page=1&limit=20 ──────────── */
const Message      = require('../models/Message');
const Conversation = require('../models/Conversation');

const search = async (req, res, next) => {
  try {
    const q     = String(req.query.q || '').trim();
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50,  parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    if (!q) return next({ statusCode: 400, message: 'Search query q is required' });

    // Get conversation IDs belonging to this user
    const userConvIds = (await Conversation.find({ userId: req.user.id, is_deleted: false }).select('_id').lean())
      .map((c) => c._id);

    const [items, total] = await Promise.all([
      Message.find({
        conversationId: { $in: userConvIds },
        role:           { $in: ['user', 'assistant'] },
        content:        { $regex: q, $options: 'i' },
      })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({
        conversationId: { $in: userConvIds },
        role:           { $in: ['user', 'assistant'] },
        content:        { $regex: q, $options: 'i' },
      }),
    ]);

    // Attach conversation title to each result
    const convMap = {};
    const convDocs = await Conversation.find({
      _id: { $in: [...new Set(items.map((m) => m.conversationId.toString()))] },
    }).select('_id title').lean();
    convDocs.forEach((c) => { convMap[c._id.toString()] = c.title; });

    // Build snippet around first match (50 chars either side)
    const toSnippet = (content, query) => {
      const idx = content.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return content.slice(0, 100);
      const start = Math.max(0, idx - 40);
      const end   = Math.min(content.length, idx + query.length + 60);
      return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
    };

    const data = items.map((m) => ({
      message_id:          m._id,
      conversation_id:     m.conversationId,
      conversation_title:  convMap[m.conversationId.toString()] || 'Conversation',
      content_snippet:     toSnippet(m.content || '', q),
      role:                m.role,
      created_at:          m.created_at,
    }));

    return res.status(200).json({
      success: true,
      message: 'Search results',
      data,
      pagination: { page, limit, total },
    });
  } catch (err) { return next(err); }
};

module.exports = { list, create, getOne, rename, remove, getMessages, addSystemMessage, search };
