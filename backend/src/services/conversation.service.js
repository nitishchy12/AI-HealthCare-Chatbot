const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');
const { AI_MAX_CONTEXT_MESSAGES } = require('../config/constants');

/* ── Helpers ─────────────────────────────────────────────────────── */

const makeTitle = (text = '') => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length <= 60 ? cleaned : `${cleaned.slice(0, 57)}…`;
};

/* ── Create ──────────────────────────────────────────────────────── */

const createConversation = async ({ userId, firstMessage = '', language = 'en' }) => {
  const conv = await Conversation.create({
    userId,
    title:    makeTitle(firstMessage),
    language,
    last_message_at: new Date(),
  });
  return conv;
};

/* ── Append user + assistant messages atomically ─────────────────── */

const appendMessages = async (conversationId, userMsg, assistantMsg) => {
  const now = new Date();

  const [userDoc, assistantDoc] = await Promise.all([
    Message.create({
      conversationId,
      role:    'user',
      content: userMsg.content,
      created_at: now,
    }),
    Message.create({
      conversationId,
      role:             'assistant',
      content:          assistantMsg.content,
      structured_output: assistantMsg.structured_output || null,
      tokens_in:        assistantMsg.tokens_in   || 0,
      tokens_out:       assistantMsg.tokens_out  || 0,
      model:            assistantMsg.model        || '',
      prompt_version:   assistantMsg.prompt_version || '',
      latency_ms:       assistantMsg.latency_ms   || 0,
    }),
  ]);

  await Conversation.findByIdAndUpdate(conversationId, {
    $inc: {
      message_count: 2,
      total_tokens:  (assistantMsg.tokens_in || 0) + (assistantMsg.tokens_out || 0),
    },
    last_message_at: now,
  });

  return { userDoc, assistantDoc };
};

const appendSystemMessage = async (conversationId, userId, content) => {
  const conv = await Conversation.findOne({ _id: conversationId, userId, is_deleted: false });
  if (!conv) return null;

  const doc = await Message.create({
    conversationId,
    role: 'system',
    content,
    created_at: new Date(),
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    $inc: { message_count: 1 },
    last_message_at: doc.created_at,
  });

  return doc;
};

/* ── Get last N messages for AI context ─────────────────────────── */

const getContextMessages = async (conversationId, limit = AI_MAX_CONTEXT_MESSAGES) => {
  const messages = await Message.find({ conversationId })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  return messages.reverse(); // chronological order for the AI prompt
};

/* ── Auto-title (called after first user message saved) ─────────── */

const autoTitle = async (conversationId, firstUserMsg) => {
  await Conversation.findByIdAndUpdate(conversationId, {
    title: makeTitle(firstUserMsg),
  });
};

/* ── Rename ──────────────────────────────────────────────────────── */

const renameConversation = async (conversationId, userId, newTitle) => {
  const conv = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId, is_deleted: false },
    { title: makeTitle(newTitle) },
    { new: true },
  );
  return conv;
};

/* ── Soft delete ─────────────────────────────────────────────────── */

const softDelete = async (conversationId, userId) => {
  const conv = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { is_deleted: true },
    { new: true },
  );
  return conv;
};

/* ── List conversations ──────────────────────────────────────────── */

const listConversations = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Conversation.find({ userId, is_deleted: false })
      .sort({ last_message_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments({ userId, is_deleted: false }),
  ]);
  return { items, total, page, totalPages: Math.ceil(total / limit) };
};

/* ── Get single conversation + its messages ─────────────────────── */

const getConversationWithMessages = async (conversationId, userId) => {
  const conv = await Conversation.findOne({
    _id: conversationId,
    userId,
    is_deleted: false,
  }).lean();

  if (!conv) return null;

  const messages = await Message.find({ conversationId })
    .sort({ created_at: 1 })
    .lean();

  return { ...conv, messages };
};

/* ── Get paginated messages for a conversation ───────────────────── */

const getMessages = async (conversationId, userId, { page = 1, limit = 50 } = {}) => {
  const conv = await Conversation.findOne({ _id: conversationId, userId, is_deleted: false });
  if (!conv) return null;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Message.find({ conversationId }).sort({ created_at: 1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments({ conversationId }),
  ]);

  return { items, total, page, totalPages: Math.ceil(total / limit) };
};

module.exports = {
  createConversation,
  appendMessages,
  appendSystemMessage,
  getContextMessages,
  autoTitle,
  renameConversation,
  softDelete,
  listConversations,
  getConversationWithMessages,
  getMessages,
};
