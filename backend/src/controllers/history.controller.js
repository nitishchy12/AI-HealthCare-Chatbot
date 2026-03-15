const Chat = require('../models/Chat');
const SymptomCheck = require('../models/SymptomCheck');

const getHealthHistory = async (req, res, next) => {
  try {
    const [chats, checks] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50),
      SymptomCheck.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50)
    ]);

    const chatItems = chats.map((item) => ({
      id: item._id,
      type: 'Chat',
      title: item.question,
      riskLevel: item.riskLevel,
      createdAt: item.createdAt,
      summary: item.aiResponse?.possibleCauses || item.aiResponse?.symptoms
    }));

    const symptomItems = checks.map((item) => ({
      id: item._id,
      type: 'Symptom Check',
      title: item.symptoms.join(', '),
      riskLevel: item.riskLevel,
      createdAt: item.createdAt,
      summary: item.possibleDisease
    }));

    const merged = [...chatItems, ...symptomItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ success: true, message: 'Health history fetched', data: merged });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHealthHistory };
