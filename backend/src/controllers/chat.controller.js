const rateLimit = require('express-rate-limit');
const Chat = require('../models/Chat');
const { buildResponse } = require('../services/ai.service');
const { clean } = require('../utils/sanitize');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many chat requests. Please wait a minute.' }
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
    const chats = await Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, message: 'Chat history fetched', data: chats });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createChat, getMyChats, chatLimiter };
