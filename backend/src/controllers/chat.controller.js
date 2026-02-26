const rateLimit = require('express-rate-limit');
const Chat = require('../models/Chat');
const { buildResponse } = require('../services/ai.service');
const { clean } = require('../utils/sanitize');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Rate limit exceeded', error: 'Too many chat requests. Please wait a minute.' }
});

const createChat = async (req, res, next) => {
  try {
    const question = clean(req.body.question);
    const aiResponse = await buildResponse(question);

    const saved = await Chat.create({
      userId: req.user.id,
      question,
      aiResponse,
      riskLevel: aiResponse.riskLevel
    });

    return res.status(201).json({
      success: true,
      message: 'Chat generated successfully',
      data: saved
    });
  } catch (error) {
    return next(error);
  }
};

const getMyChats = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Chat.countDocuments({ userId: req.user.id })
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
          totalPages: Math.max(Math.ceil(total / limit), 1)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createChat, getMyChats, chatLimiter };
