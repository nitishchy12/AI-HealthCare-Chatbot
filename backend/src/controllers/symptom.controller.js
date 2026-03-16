const SymptomCheck = require('../models/SymptomCheck');

const chooseDisease = (symptoms, answers) => {
  const text = symptoms.join(' ').toLowerCase();
  if (answers.chestPain || answers.breathingDifficulty) return 'Possible cardiovascular or respiratory emergency';
  if (text.includes('fever') && text.includes('cough')) return 'Viral infection';
  if (text.includes('fever') && text.includes('headache')) return 'Seasonal flu or dengue-like illness';
  if (text.includes('stomach pain') || text.includes('vomiting')) return 'Food-borne illness';
  return 'General health concern requiring observation';
};

const buildRecommendations = (riskLevel, emergency) => {
  const base = [
    'Track symptoms for the next 24 hours.',
    'Stay hydrated and avoid self-medication without guidance.'
  ];

  if (riskLevel === 'Medium') {
    base.push('Book a doctor consultation if symptoms continue for 2 to 3 days.');
  }

  if (emergency) {
    return [
      'Emergency risk detected. Visit the nearest hospital immediately.',
      'Do not delay clinical evaluation.'
    ];
  }

  if (riskLevel === 'High') {
    base.push('Seek urgent medical advice today.');
  }

  return base;
};

const analyzeSymptoms = ({ symptoms, feverDays, breathingDifficulty, chestPain, fatigueLevel, age }) => {
  let score = Math.min(symptoms.length * 2, 6);

  if (feverDays >= 3) score += 2;
  if (breathingDifficulty) score += 3;
  if (chestPain) score += 3;
  if (fatigueLevel === 'Medium') score += 1;
  if (fatigueLevel === 'High') score += 2;
  if (age >= 60 && (breathingDifficulty || chestPain)) score += 2;

  const emergency = breathingDifficulty || chestPain;
  let riskLevel = 'Low';
  if (score >= 8 || emergency) riskLevel = 'High';
  else if (score >= 5) riskLevel = 'Medium';

  return {
    riskScore: Math.min(score, 10),
    riskLevel,
    possibleDisease: chooseDisease(symptoms, { chestPain, breathingDifficulty }),
    emergency,
    recommendations: buildRecommendations(riskLevel, emergency)
  };
};

const createSymptomCheck = async (req, res, next) => {
  try {
    const userResult = await require('../config/db').pool.query('SELECT age FROM users WHERE id = $1', [req.user.id]);
    const age = userResult.rows[0]?.age || 0;
    const payload = {
      symptoms: req.body.symptoms,
      feverDays: Number(req.body.feverDays || 0),
      breathingDifficulty: Boolean(req.body.breathingDifficulty),
      chestPain: Boolean(req.body.chestPain),
      fatigueLevel: req.body.fatigueLevel || 'Low',
      age
    };

    const analysis = analyzeSymptoms(payload);
    const saved = await SymptomCheck.create({
      userId: req.user.id,
      symptoms: payload.symptoms,
      followUpAnswers: {
        feverDays: payload.feverDays,
        breathingDifficulty: payload.breathingDifficulty,
        chestPain: payload.chestPain,
        fatigueLevel: payload.fatigueLevel
      },
      ...analysis
    });

    return res.status(201).json({
      success: true,
      message: 'Symptom check completed',
      data: saved
    });
  } catch (error) {
    return next(error);
  }
};

const getSymptomChecks = async (req, res, next) => {
  try {
    const checks = await SymptomCheck.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ success: true, message: 'Symptom checks fetched', data: checks });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createSymptomCheck, getSymptomChecks };
