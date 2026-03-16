const Chat = require('../models/Chat');
const SymptomCheck = require('../models/SymptomCheck');

const uniqueList = (items, limit = 8) => {
  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });

  return result.slice(0, limit);
};

const getHealthReport = async (req, res, next) => {
  try {
    const [recentChats, recentChecks] = await Promise.all([
      Chat.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(5),
      SymptomCheck.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(5)
    ]);

    const symptomPool = [];
    const riskLevels = [];
    const symptomCounts = {};

    recentChats.forEach((chat) => {
      const chatSymptoms = Array.isArray(chat.aiResponse?.symptoms) ? chat.aiResponse.symptoms : [];
      symptomPool.push(...chatSymptoms);
      chatSymptoms.forEach((symptom) => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
      if (chat.riskLevel) riskLevels.push(chat.riskLevel);
    });

    recentChecks.forEach((check) => {
      symptomPool.push(...check.symptoms);
      riskLevels.push(check.riskLevel);
      check.symptoms.forEach((symptom) => {
        symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
      });
    });

    const activity = [...recentChats, ...recentChecks]
      .map((item) => new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }))
      .reduce((acc, date) => {
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    const uniqueSymptoms = uniqueList(symptomPool, 8);
    const currentRisk = riskLevels[0] || 'Low';
    const trendLevels = riskLevels.slice(0, 5).reverse();
    const riskTrend = trendLevels.length ? trendLevels.join(' -> ') : 'Low';
    const sortedSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    let recommendations = [
      'Continue symptom monitoring and maintain hydration.'
    ];

    if (currentRisk === 'High') {
      recommendations = [
        'Seek urgent medical help immediately.',
        'Visit a hospital or emergency center without delay.'
      ];
    } else if (currentRisk === 'Medium') {
      recommendations = [
        'Rest, hydration, and symptom monitoring are important.',
        'Consult a doctor if symptoms continue for 2 to 3 days.'
      ];
    } else {
      recommendations = [
        'Rest and hydration are recommended.',
        'Monitor symptoms for the next 2 to 3 days.'
      ];
    }

    return res.status(200).json({
      success: true,
      message: 'Health report generated',
      data: {
        recentSymptoms: uniqueSymptoms,
        riskTrend,
        recommendations,
        symptomChart: sortedSymptoms,
        riskChart: riskLevels.slice(0, 5).map((level, index) => ({ name: `Check ${index + 1}`, risk: level === 'High' ? 3 : level === 'Medium' ? 2 : 1 })),
        activityChart: Object.entries(activity).map(([date, count]) => ({ date, count })),
        weeklyTrend: sortedSymptoms.slice(0, 3),
        recentChatsCount: recentChats.length,
        recentSymptomChecksCount: recentChecks.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHealthReport };
