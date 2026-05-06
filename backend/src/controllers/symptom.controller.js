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

const suggestSpecialists = (symptoms, possibleDisease, emergency) => {
  const text = `${symptoms.join(' ')} ${possibleDisease}`.toLowerCase();
  if (emergency && (text.includes('chest pain') || text.includes('cardiovascular'))) return ['Cardiologist', 'Emergency Physician'];
  if (emergency && (text.includes('breath') || text.includes('respiratory'))) return ['Pulmonologist', 'Emergency Physician'];
  if (text.includes('stomach') || text.includes('vomiting') || text.includes('food-borne')) return ['Gastroenterologist', 'General Physician'];
  if (text.includes('headache') || text.includes('dizziness')) return ['Neurologist', 'General Physician'];
  if (text.includes('rash') || text.includes('skin')) return ['Dermatologist', 'General Physician'];
  if (text.includes('cough') || text.includes('viral') || text.includes('flu')) return ['General Physician', 'Pulmonologist'];
  return ['General Physician'];
};

const buildRiskReasoning = ({ symptoms, feverDays, breathingDifficulty, chestPain, fatigueLevel, age }, riskLevel) => {
  const reasons = [];
  if (symptoms.length >= 3) reasons.push(`${symptoms.length} symptoms were reported`);
  if (feverDays >= 3) reasons.push('symptoms have continued for 3 or more days');
  if (breathingDifficulty) reasons.push('shortness of breath is a high-priority warning sign');
  if (chestPain) reasons.push('chest pain is a high-priority warning sign');
  if (fatigueLevel === 'High') reasons.push('overall severity is high');
  if (age >= 60) reasons.push('age can increase risk for some conditions');

  if (reasons.length === 0) {
    return `${riskLevel} risk based on the symptom pattern and current severity. Continue monitoring and seek care if symptoms worsen.`;
  }
  return `${riskLevel} risk because ${reasons.join(', ')}. This is a triage estimate, not a diagnosis.`;
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

const serializeSymptomCheck = (check) => {
  const obj = typeof check.toObject === 'function' ? check.toObject() : check;
  return {
    ...obj,
    risk_level: obj.riskLevel,
    risk_reasoning: obj.riskReasoning,
    specialists_suggested: obj.specialistsSuggested || [],
    recommended_actions: obj.recommendations || [],
  };
};

const createSymptomCheck = async (req, res, next) => {
  try {
    const userResult = await require('../config/db').pool.query(
      'SELECT age, gender, city, medical_notes FROM users WHERE id = $1',
      [req.user.id],
    );
    const userProfile = userResult.rows[0] || {};
    const requestProfile = req.body.profile || {};
    const age = Number(requestProfile.age || userProfile.age || 0);
    const payload = {
      symptoms: req.body.symptoms,
      feverDays: Number(req.body.feverDays || 0),
      breathingDifficulty: Boolean(req.body.breathingDifficulty),
      chestPain: Boolean(req.body.chestPain),
      fatigueLevel: req.body.fatigueLevel || 'Low',
      age
    };

    const analysis = analyzeSymptoms(payload);
    const specialistsSuggested = suggestSpecialists(payload.symptoms, analysis.possibleDisease, analysis.emergency);
    const riskReasoning = buildRiskReasoning(payload, analysis.riskLevel);
    const saved = await SymptomCheck.create({
      userId: req.user.id,
      symptoms: payload.symptoms,
      followUpAnswers: {
        feverDays: payload.feverDays,
        breathingDifficulty: payload.breathingDifficulty,
        chestPain: payload.chestPain,
        fatigueLevel: payload.fatigueLevel
      },
      ...analysis,
      riskReasoning,
      specialistsSuggested,
      profileSnapshot: {
        age: age || null,
        gender: requestProfile.gender || userProfile.gender || '',
        city: requestProfile.city || userProfile.city || '',
        medical_notes: requestProfile.medical_notes || userProfile.medical_notes || '',
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Symptom check completed',
      data: serializeSymptomCheck(saved)
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

/* POST /api/symptoms/related ─────────────────────────────────────
 * Returns 5 related/associated symptoms based on the primary selection.
 * Pure rule-based — no LLM cost, instant response.
 */
const RELATED_MAP = {
  'Fever':               ['Chills', 'Body pain', 'Sweating', 'Fatigue', 'Loss of appetite'],
  'Cough':               ['Sore throat', 'Runny nose', 'Shortness of breath', 'Chest pain', 'Fatigue'],
  'Headache':            ['Nausea', 'Dizziness', 'Eye pain', 'Sweating', 'Neck stiffness'],
  'Stomach pain':        ['Nausea', 'Vomiting', 'Diarrhea', 'Loss of appetite', 'Bloating'],
  'Vomiting':            ['Nausea', 'Stomach pain', 'Diarrhea', 'Dizziness', 'Loss of appetite'],
  'Body pain':           ['Fever', 'Fatigue', 'Joint pain', 'Muscle weakness', 'Chills'],
  'Chest pain':          ['Shortness of breath', 'Sweating', 'Nausea', 'Palpitations', 'Dizziness'],
  'Shortness of breath': ['Chest pain', 'Cough', 'Fatigue', 'Wheezing', 'Palpitations'],
  'Fatigue':             ['Body pain', 'Dizziness', 'Loss of appetite', 'Sweating', 'Shortness of breath'],
  'Dizziness':           ['Nausea', 'Headache', 'Fatigue', 'Ear pain', 'Blurred vision'],
  'Sore throat':         ['Cough', 'Runny nose', 'Fever', 'Ear pain', 'Loss of appetite'],
  'Runny nose':          ['Sore throat', 'Cough', 'Sneezing', 'Eye pain', 'Fever'],
  'Nausea':              ['Vomiting', 'Stomach pain', 'Dizziness', 'Loss of appetite', 'Sweating'],
  'Back pain':           ['Body pain', 'Fatigue', 'Joint pain', 'Muscle weakness', 'Dizziness'],
  'Joint pain':          ['Body pain', 'Fever', 'Swelling', 'Fatigue', 'Muscle weakness'],
  'Skin rash':           ['Fever', 'Itching', 'Swelling', 'Body pain', 'Fatigue'],
  'Eye pain':            ['Headache', 'Blurred vision', 'Runny nose', 'Fever', 'Light sensitivity'],
  'Ear pain':            ['Sore throat', 'Fever', 'Headache', 'Runny nose', 'Dizziness'],
  'Loss of appetite':    ['Nausea', 'Fatigue', 'Stomach pain', 'Vomiting', 'Fever'],
  'Sweating':            ['Fever', 'Chills', 'Fatigue', 'Dizziness', 'Body pain'],
};

const getRelatedSymptoms = (req, res, next) => {
  try {
    const primary = Array.isArray(req.body.primary_symptoms) ? req.body.primary_symptoms : [];
    const related  = new Set();

    primary.forEach((s) => {
      const list = RELATED_MAP[s] || [];
      list.forEach((r) => { if (!primary.includes(r)) related.add(r); });
    });

    return res.status(200).json({
      success: true,
      message: 'Related symptoms',
      data: [...related].slice(0, 5),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { createSymptomCheck, getSymptomChecks, getRelatedSymptoms };
