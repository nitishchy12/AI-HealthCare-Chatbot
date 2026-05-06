const Conversation = require('../models/Conversation');
const Message      = require('../models/Message');
const SymptomCheck = require('../models/SymptomCheck');

const getHealthHistory = async (req, res, next) => {
  try {
    const [conversations, checks] = await Promise.all([
      Conversation.find({ userId: req.user.id, is_deleted: false })
        .sort({ last_message_at: -1 })
        .limit(50)
        .lean(),
      SymptomCheck.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    // For each conversation, grab the last assistant message summary
    const convIds = conversations.map((c) => c._id);
    const lastMessages = await Message.aggregate([
      { $match: { conversationId: { $in: convIds }, role: 'assistant' } },
      { $sort:  { created_at: -1 } },
      { $group: { _id: '$conversationId', content: { $first: '$content' }, structured_output: { $first: '$structured_output' } } },
    ]);

    const msgMap = Object.fromEntries(lastMessages.map((m) => [m._id.toString(), m]));

    const chatItems = conversations.map((conv) => {
      const lastMsg = msgMap[conv._id.toString()];
      const so = lastMsg?.structured_output;
      const summary = Array.isArray(so?.possibleCauses) && so.possibleCauses.length
        ? so.possibleCauses.join(' · ')
        : Array.isArray(so?.symptoms) && so.symptoms.length
          ? so.symptoms.join(' · ')
          : lastMsg?.content?.slice(0, 100) || '';

      return {
        id:        conv._id,
        type:      'Chat',
        title:     conv.title,
        riskLevel: so?.riskLevel || null,
        createdAt: conv.last_message_at,
        summary,
        conversationId: conv._id,
      };
    });

    const symptomItems = checks.map((item) => ({
      id:        item._id,
      type:      'Symptom Check',
      title:     item.symptoms.length <= 3
        ? item.symptoms.join(', ')
        : `${item.symptoms.slice(0, 3).join(', ')} & ${item.symptoms.length - 3} more`,
      riskLevel: item.riskLevel,
      createdAt: item.createdAt,
      summary:   item.possibleDisease || '',
    }));

    const merged = [...chatItems, ...symptomItems]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ success: true, message: 'Health history fetched', data: merged });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHealthHistory };
