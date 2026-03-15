const Chat = require('../models/Chat');
const SymptomCheck = require('../models/SymptomCheck');

const getHealthReport = async (req, res, next) => {
  try {
    const [recentChats, recentChecks] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(5),
      SymptomCheck.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(5)
    ]);

    const symptomPool = [];
    const riskLevels = [];

    recentChats.forEach((chat) => {
      if (chat.aiResponse?.symptoms) symptomPool.push(chat.aiResponse.symptoms);
      if (chat.riskLevel) riskLevels.push(chat.riskLevel);
    });

    recentChecks.forEach((check) => {
      symptomPool.push(...check.symptoms);
      riskLevels.push(check.riskLevel);
    });

    const uniqueSymptoms = [...new Set(symptomPool)].slice(0, 8);
    const currentRisk = riskLevels[0] || 'Low';
    const previousRisk = riskLevels[1] || currentRisk;

    return res.status(200).json({
      success: true,
      message: 'Health report generated',
      data: {
        recentSymptoms: uniqueSymptoms,
        riskTrend: `${previousRisk} -> ${currentRisk}`,
        recommendations: [
          'Continue symptom monitoring and maintain hydration.',
          currentRisk === 'High' ? 'Visit a hospital or doctor immediately.' : 'Consult a doctor if symptoms persist.'
        ],
        recentChatsCount: recentChats.length,
        recentSymptomChecksCount: recentChecks.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHealthReport };
