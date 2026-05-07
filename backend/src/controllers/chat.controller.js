const rateLimit   = require('express-rate-limit');
const Chat        = require('../models/Chat');
const Conversation = require('../models/Conversation');
const { buildResponse } = require('../services/ai.service');
const convSvc     = require('../services/conversation.service');
const { clean }   = require('../utils/sanitize');
const { logAuditAction } = require('../utils/audit');
const { logger }  = require('../utils/logger');
const { CHAT_RATE_LIMIT_WINDOW_MS, CHAT_RATE_LIMIT_MAX } = require('../config/constants');

// Try to build a Redis-backed, per-user rate limiter.
// Falls back to in-memory IP-based limiter when Redis is unavailable.
const buildChatLimiter = () => {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.NODE_ENV !== 'test') {
    try {
      const { RedisStore } = require('rate-limit-redis');
      const Redis = require('ioredis');
      const redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
      });
      redisClient.on('connect', () => logger.info('Redis connected (chat limiter)'));
      redisClient.on('error', (err) => logger.error('Redis error (chat limiter)', { message: err.message }));
      const redis = {
        sendCommand: (args) => redisClient.call(...args),
      };
      return rateLimit({
        windowMs:     CHAT_RATE_LIMIT_WINDOW_MS,
        max:          CHAT_RATE_LIMIT_MAX,
        // Key by authenticated user ID so VPN/NAT doesn't affect other users
        keyGenerator: (req) => `rate:chat:${req.user?.id || req.ip}`,
        store:        new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
        passOnStoreError: true,
        standardHeaders: true,
        legacyHeaders:   false,
        message: { success: false, message: 'Too many chat requests. Please wait a minute.', error: 'RATE_LIMITED' },
      });
    } catch {
      // fall through to IP-based limiter
    }
  }
  return rateLimit({
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS,
    max:      CHAT_RATE_LIMIT_MAX,
    keyGenerator: (req) => `rate:chat:${req.user?.id || req.ip}`,
    message:  { success: false, message: 'Too many chat requests. Please wait a minute.', error: 'RATE_LIMITED' },
  });
};

const chatLimiter = buildChatLimiter();

/* POST /api/chat ─────────────────────────────────────────────────── */
const createChat = async (req, res, next) => {
  try {
    const question       = clean(req.body.question);
    const language       = req.body.language || 'en';
    const conversationId = req.body.conversation_id || null;

    const startMs = Date.now();

    // ── Resolve / create conversation ─────────────────────────────
    let conv;
    if (conversationId) {
      conv = await Conversation.findOne({
        _id: conversationId,
        userId: req.user.id,
        is_deleted: false,
      });
      if (!conv) return next({ statusCode: 404, message: 'Conversation not found' });
    } else {
      conv = await convSvc.createConversation({
        userId:       req.user.id,
        firstMessage: question,
        language,
      });
    }

    // ── Build AI context from last N messages ─────────────────────
    const contextMessages = await convSvc.getContextMessages(conv._id);
    const aiResponse      = await buildResponse(
      question,
      req.user.id,
      language,
      contextMessages,
      req.headers.authorization,
    );

    const latency = Date.now() - startMs;

    // ── Persist both messages ─────────────────────────────────────
    await convSvc.appendMessages(conv._id, { content: question }, {
      content:          buildTextContent(aiResponse),
      structured_output: aiResponse,
      prompt_version:   aiResponse.promptVersion || '',
      latency_ms:       latency,
    });

    // ── Keep legacy Chat collection in sync (backward compat) ─────
    const legacySaved = await Chat.create({
      userId:    req.user.id,
      language,
      question,
      aiResponse,
      riskLevel: aiResponse.riskLevel,
    });

    // ── Emit Socket.IO event ──────────────────────────────────────
    const io = req.app.get('io');
    io?.to(`user:${req.user.id}`).emit('assessment:created', {
      id:             legacySaved._id.toString(),
      conversationId: conv._id.toString(),
      riskLevel:      legacySaved.riskLevel,
      createdAt:      legacySaved.createdAt,
    });

    await logAuditAction({
      userId:     req.user.id,
      role:       req.user.role,
      action:     'CREATE',
      entityType: 'chat_assessment',
      entityId:   legacySaved._id.toString(),
      details:    { riskLevel: legacySaved.riskLevel, language, conversationId: conv._id.toString() },
    });

    return res.status(201).json({
      success: true,
      message: 'Chat generated successfully',
      data: {
        ...legacySaved.toObject(),
        conversationId: conv._id.toString(),
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* GET /api/chat/history ─────────────────────────────────────────── */
const getMyChats = async (req, res, next) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip  = (page - 1) * limit;

    // Read from legacy Chat collection for backward compat with existing frontend
    const [items, total] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Chat.countDocuments({ userId: req.user.id }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Chat history fetched',
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

/* DELETE /api/chat/history ──────────────────────────────────────── */
const clearMyChats = async (req, res, next) => {
  try {
    // Soft-delete conversations + hard-delete legacy chats
    const convs = await Conversation.find({ userId: req.user.id, is_deleted: false }).select('_id');
    await Promise.all([
      Conversation.updateMany(
        { userId: req.user.id },
        { is_deleted: true },
      ),
      Chat.deleteMany({ userId: req.user.id }),
    ]);

    await logAuditAction({
      userId:     req.user.id,
      role:       req.user.role,
      action:     'DELETE',
      entityType: 'chat_history',
      entityId:   req.user.id,
      details:    { cleared: true, conversationCount: convs.length },
    });

    return res.status(200).json({ success: true, message: 'Chat history cleared', data: { cleared: true } });
  } catch (error) {
    return next(error);
  }
};

/* ── Helpers ─────────────────────────────────────────────────────── */
function buildTextContent(aiResponse = {}) {
  if (aiResponse.answerMd) return aiResponse.answerMd;

  const parts = [];
  if (aiResponse.symptoms?.length)            parts.push(`Symptoms: ${aiResponse.symptoms.join(', ')}`);
  if (aiResponse.possibleCauses?.length)      parts.push(`Possible causes: ${aiResponse.possibleCauses.join(', ')}`);
  if (aiResponse.prevention?.length)          parts.push(`Prevention: ${aiResponse.prevention.join(', ')}`);
  if (aiResponse.whenToConsultDoctor?.length) parts.push(`When to consult: ${aiResponse.whenToConsultDoctor.join(', ')}`);
  if (aiResponse.riskLevel)                   parts.push(`Risk: ${aiResponse.riskLevel}`);
  return parts.join('\n\n') || 'Assessment complete.';
}

/* GET /api/chat/stream ──────────────────────────────────────────
 * SSE endpoint. Streams AI answer_md in chunks, then sends full
 * structured metadata, then saves to conversation + legacy Chat.
 */
const streamChat = async (req, res) => {
  const question       = clean(String(req.query.question || ''));
  const language       = ['en', 'hi'].includes(req.query.language) ? req.query.language : 'en';
  const conversationId = req.query.conversation_id || null;

  if (!question || question.length < 5) {
    res.status(400).json({ success: false, message: 'question must be at least 5 characters' });
    return;
  }

  // ── SSE headers ───────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (event, data) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // ── Resolve / create conversation ─────────────────────────
    let conv;
    if (conversationId) {
      conv = await Conversation.findOne({ _id: conversationId, userId: req.user.id, is_deleted: false });
      if (!conv) { send('error', { message: 'Conversation not found' }); res.end(); return; }
    } else {
      conv = await convSvc.createConversation({ userId: req.user.id, firstMessage: question, language });
    }

    // ── Get AI context ────────────────────────────────────────
    const contextMessages = await convSvc.getContextMessages(conv._id);
    const aiResponse      = await buildResponse(
      question,
      req.user.id,
      language,
      contextMessages,
      req.headers.authorization,
    );

    const answerMd = aiResponse.answerMd || (aiResponse.possibleCauses?.length
      ? `**Possible causes:** ${aiResponse.possibleCauses.join(', ')}\n\n**Risk level:** ${aiResponse.riskLevel}\n\n${aiResponse.disclaimer || ''}`
      : aiResponse.disclaimer || 'Please consult a healthcare professional.');

    // ── Stream answer_md in word chunks ───────────────────────
    const words = answerMd.split(/(\s+)/);
    const CHUNK = 1;
    for (let i = 0; i < words.length; i += CHUNK) {
      if (closed) break;
      const chunk = words.slice(i, i + CHUNK).join('');
      send('token', { text: chunk });
      await new Promise((r) => setTimeout(r, 50));
    }

    if (closed) { res.end(); return; }

    // ── Send metadata ─────────────────────────────────────────
    send('metadata', {
      conversationId:       conv._id.toString(),
      riskLevel:            aiResponse.riskLevel,
      confidence:           aiResponse.confidenceScore,
      symptoms_detected:    aiResponse.symptoms || [],
      possible_causes:      aiResponse.possibleCauses || [],
      recommended_actions:  aiResponse.prevention || [],
      when_to_seek_care:    (aiResponse.whenToConsultDoctor || []).join(' '),
      specialists_suggested:[],
      follow_up_questions:  aiResponse.followUpQuestions || [],
      citations:            aiResponse.citations || [],
      emergency:            !!aiResponse.emergencyAlert,
      disclaimer:           aiResponse.disclaimer || '',
    });

    // ── Persist to DB ─────────────────────────────────────────
    await convSvc.appendMessages(conv._id,
      { content: question },
      { content: answerMd, structured_output: aiResponse, prompt_version: aiResponse.promptVersion || '' },
    );

    await Chat.create({
      userId: req.user.id, language, question,
      aiResponse, riskLevel: aiResponse.riskLevel,
    }).catch(() => {}); // non-fatal

    const io = req.app.get('io');
    io?.to(`user:${req.user.id}`).emit('assessment:created', {
      conversationId: conv._id.toString(),
      riskLevel: aiResponse.riskLevel,
    });

    send('done', { conversationId: conv._id.toString() });
  } catch (err) {
    send('error', { message: err.message || 'Failed to generate response' });
  } finally {
    res.end();
  }
};

/* POST /api/chat/messages/:messageId/feedback ───────────────────── */
const Feedback = require('../models/Feedback');

const saveFeedback = async (req, res, next) => {
  try {
    const { rating, reason = '', comment = '' } = req.body;
    const { messageId } = req.params;

    await Feedback.findOneAndUpdate(
      { userId: req.user.id, messageId },
      { userId: req.user.id, messageId, rating, reason, comment },
      { upsert: true, new: true },
    );

    return res.status(200).json({ success: true, message: 'Feedback saved' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { createChat, getMyChats, clearMyChats, chatLimiter, streamChat, saveFeedback };
