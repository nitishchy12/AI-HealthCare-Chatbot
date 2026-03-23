const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

const PROMPT_VERSION = 'health-awareness-v3';
const SUPPORTED_LANGUAGES = ['en', 'hi'];

const symptomKnowledge = [
  {
    patterns: ['fever', 'temperature', 'chills'],
    symptoms: ['fever', 'chills', 'weakness', 'dehydration risk'],
    causes: ['viral infection', 'dengue', 'malaria', 'flu'],
    prevention: ['drink plenty of water', 'monitor body temperature', 'take rest', 'avoid exposure to mosquitoes'],
    whenToConsultDoctor: ['consult a doctor if fever stays for more than 2 to 3 days', 'seek advice earlier if fever becomes very high or comes with rash']
  },
  {
    patterns: ['cough', 'coughing', 'sore throat', 'throat'],
    symptoms: ['cough', 'sore throat', 'throat irritation', 'mucus'],
    causes: ['common cold', 'throat irritation', 'seasonal allergy', 'mild respiratory infection'],
    prevention: ['drink warm fluids', 'avoid cold drinks', 'steam inhalation', 'rest your throat'],
    whenToConsultDoctor: ['consult a doctor if cough lasts more than 1 week', 'seek help if breathing difficulty or blood in cough appears']
  },
  {
    patterns: ['headache', 'head pain', 'migraine'],
    symptoms: ['headache', 'light sensitivity', 'head heaviness', 'fatigue'],
    causes: ['migraine', 'viral fever', 'stress', 'dehydration'],
    prevention: ['stay hydrated', 'sleep properly', 'reduce stress', 'avoid prolonged screen strain'],
    whenToConsultDoctor: ['consult a doctor if headache is severe or frequent', 'seek help if headache occurs with vomiting or high fever']
  },
  {
    patterns: ['chest pain', 'tightness in chest', 'chest tightness'],
    symptoms: ['chest pain', 'pressure in chest', 'tightness', 'discomfort'],
    causes: ['heart-related condition', 'muscle strain', 'acid reflux'],
    prevention: ['avoid physical strain', 'do not ignore persistent pain', 'seek urgent evaluation if pain is severe'],
    whenToConsultDoctor: ['get immediate medical help if chest pain occurs with sweating or dizziness', 'do not wait if pain spreads to arm or jaw']
  },
  {
    patterns: ['breathing difficulty', 'shortness of breath', 'breathlessness', 'difficulty breathing'],
    symptoms: ['breathing difficulty', 'shortness of breath', 'wheezing', 'chest discomfort'],
    causes: ['asthma flare', 'respiratory infection', 'allergy', 'cardiopulmonary emergency'],
    prevention: ['avoid smoke and dust exposure', 'rest in an upright position', 'use prescribed inhaler if available'],
    whenToConsultDoctor: ['seek medical help immediately if breathing difficulty is sudden', 'go to emergency care if it worsens with chest pain']
  },
  {
    patterns: ['vomiting', 'vomit', 'nausea'],
    symptoms: ['vomiting', 'nausea', 'weakness', 'dehydration'],
    causes: ['food poisoning', 'gastric irritation', 'viral infection'],
    prevention: ['take oral fluids slowly', 'eat bland food', 'avoid oily or contaminated food'],
    whenToConsultDoctor: ['consult a doctor if vomiting is repeated or severe', 'seek help if you cannot keep fluids down']
  },
  {
    patterns: ['stomach pain', 'abdominal pain', 'abdomen pain'],
    symptoms: ['stomach pain', 'cramps', 'acidity', 'digestive discomfort'],
    causes: ['food-borne illness', 'acidity', 'indigestion', 'intestinal infection'],
    prevention: ['eat light meals', 'avoid spicy and oily food', 'drink safe water'],
    whenToConsultDoctor: ['consult a doctor if abdominal pain is severe', 'seek help if pain comes with vomiting or fever']
  }
];

const phraseTranslations = {
  'general discomfort': 'सामान्य असुविधा',
  'monitor symptoms': 'लक्षणों पर नजर रखें',
  'infection': 'संक्रमण',
  'allergy': 'एलर्जी',
  'dehydration': 'डिहाइड्रेशन',
  'mild inflammation': 'हल्की सूजन',
  'stay hydrated': 'पर्याप्त पानी पिएं',
  'get rest': 'आराम करें',
  'maintain hygiene': 'स्वच्छता बनाए रखें',
  'avoid self-medication without guidance': 'बिना सलाह के दवा न लें',
  'consult a doctor if symptoms persist': 'अगर लक्षण बने रहें तो डॉक्टर से मिलें',
  'seek help earlier if symptoms worsen quickly': 'अगर लक्षण जल्दी बढ़ें तो तुरंत मदद लें',
  'high risk detected. seek medical help immediately.': 'उच्च जोखिम पाया गया है। तुरंत चिकित्सा सहायता लें।',
  'this information is for awareness only and not a substitute for professional medical advice.': 'यह जानकारी केवल जागरूकता के लिए है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है।',
  'ai service was unavailable, so verified fallback information is shown.': 'एआई सेवा उपलब्ध नहीं थी, इसलिए सत्यापित बैकअप जानकारी दिखाई गई है।',
  'confidence': 'विश्वास',
  'viral infection': 'वायरल संक्रमण',
  'dengue': 'डेंगू',
  'malaria': 'मलेरिया',
  'flu': 'फ्लू',
  'drink plenty of water': 'पर्याप्त पानी पिएं',
  'monitor body temperature': 'शरीर का तापमान देखें',
  'take rest': 'आराम करें',
  'avoid exposure to mosquitoes': 'मच्छरों से बचें',
  'common cold': 'सामान्य सर्दी',
  'throat irritation': 'गले में जलन',
  'seasonal allergy': 'मौसमी एलर्जी',
  'mild respiratory infection': 'हल्का श्वसन संक्रमण',
  'drink warm fluids': 'गर्म तरल लें',
  'avoid cold drinks': 'ठंडे पेय से बचें',
  'steam inhalation': 'भाप लें',
  'rest your throat': 'गले को आराम दें',
  'chest pain': 'सीने में दर्द',
  'pressure in chest': 'सीने में दबाव',
  'tightness': 'जकड़न',
  'discomfort': 'असुविधा',
  'heart-related condition': 'हृदय से जुड़ी समस्या',
  'muscle strain': 'मांसपेशियों में खिंचाव',
  'acid reflux': 'एसिड रिफ्लक्स',
  'avoid physical strain': 'शारीरिक जोर से बचें',
  'do not ignore persistent pain': 'लगातार दर्द को नजरअंदाज न करें',
  'seek urgent evaluation if pain is severe': 'दर्द तेज हो तो तुरंत जांच कराएं',
  'breathing difficulty': 'सांस लेने में कठिनाई',
  'shortness of breath': 'सांस फूलना',
  'wheezing': 'घरघराहट',
  'chest discomfort': 'सीने में असुविधा',
  'asthma flare': 'अस्थमा का बढ़ना',
  'respiratory infection': 'श्वसन संक्रमण',
  'cardiopulmonary emergency': 'हृदय या फेफड़ों की आपात स्थिति',
  'avoid smoke and dust exposure': 'धुआं और धूल से बचें',
  'rest in an upright position': 'सीधे बैठकर आराम करें',
  'use prescribed inhaler if available': 'अगर डॉक्टर ने इनहेलर दिया है तो उपयोग करें'
};

const buildGeneralFallback = () => ({
  symptoms: ['general discomfort', 'monitor symptoms'],
  possibleCauses: ['infection', 'allergy', 'dehydration', 'mild inflammation'],
  prevention: ['stay hydrated', 'get rest', 'maintain hygiene', 'avoid self-medication without guidance'],
  whenToConsultDoctor: ['consult a doctor if symptoms persist', 'seek help earlier if symptoms worsen quickly'],
  riskLevel: 'Low'
});

const inferRiskLevel = (text) => {
  const t = text.toLowerCase();
  if (/(chest pain|breathing difficulty|shortness of breath|unconscious|seizure|blood)/.test(t)) return 'High';
  if (/(fever|vomit|infection|persistent pain|migraine|abdominal pain)/.test(t)) return 'Medium';
  return 'Low';
};

const dedupeNormalized = (items, limit = 6) => {
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

const extractKnowledgeMatches = (question) => {
  const normalized = question.toLowerCase();
  return symptomKnowledge.filter((item) => item.patterns.some((pattern) => normalized.includes(pattern)));
};

const fetchDiseaseMatches = async (question, knowledgeMatches) => {
  const normalized = question.toLowerCase();
  const keywords = dedupeNormalized([normalized, ...knowledgeMatches.flatMap((item) => item.patterns)], 8);

  if (keywords.length === 0) return [];

  const clauses = [];
  const values = [];

  keywords.forEach((keyword, index) => {
    const valueIndex = index + 1;
    clauses.push(
      `(LOWER(disease_name) LIKE '%' || $${valueIndex} || '%' OR LOWER(symptoms) LIKE '%' || $${valueIndex} || '%' OR LOWER(risk_factors) LIKE '%' || $${valueIndex} || '%')`
    );
    values.push(keyword.toLowerCase());
  });

  const result = await pool.query(
    `
      SELECT disease_name, symptoms, prevention, treatment, risk_factors
      FROM diseases
      WHERE ${clauses.join(' OR ')}
      ORDER BY disease_name ASC
      LIMIT 4
    `,
    values
  );

  return result.rows;
};

const getRecommendedHospitals = async (userId, riskLevel, question) => {
  if (riskLevel !== 'High') return [];

  const userResult = await pool.query('SELECT city FROM users WHERE id = $1', [userId]);
  const city = userResult.rows[0]?.city || '';
  const normalizedQuestion = question.toLowerCase();

  let specialization = 'General Physician';
  if (/(chest pain|heart|pressure)/.test(normalizedQuestion)) specialization = 'Cardiologist';
  else if (/(breathing|cough|asthma)/.test(normalizedQuestion)) specialization = 'Pulmonologist';
  else if (/(headache|migraine|dizziness)/.test(normalizedQuestion)) specialization = 'Neurologist';

  const result = await pool.query(
    `
      SELECT name, city, specialization, rating
      FROM hospitals
      WHERE ($1 = '' OR LOWER(city) = LOWER($1))
      AND ($2 = 'General Physician' OR LOWER(specialization) LIKE LOWER('%' || $2 || '%') OR LOWER(specialization) LIKE '%general physician%')
      ORDER BY rating DESC, name ASC
      LIMIT 3
    `,
    [city, specialization]
  );

  return result.rows;
};

const estimateConfidenceScore = (knowledgeMatches, diseaseMatches, riskLevel) => {
  let score = 0.55;
  score += Math.min(knowledgeMatches.length * 0.08, 0.16);
  score += Math.min(diseaseMatches.length * 0.06, 0.18);
  if (riskLevel === 'High') score += 0.04;
  return Number(Math.min(score, 0.95).toFixed(2));
};

const translateText = (value, language) => {
  if (language !== 'hi') return value;

  const normalized = String(value || '').trim();
  if (!normalized) return normalized;

  const exact = phraseTranslations[normalized.toLowerCase()];
  if (exact) return exact;

  return normalized
    .split(', ')
    .map((part) => phraseTranslations[part.toLowerCase()] || part)
    .join(', ');
};

const translateArray = (items, language) => items.map((item) => translateText(item, language));

const translateHospitals = (hospitals, language) => {
  if (language !== 'hi') return hospitals;

  return hospitals.map((hospital) => ({
    ...hospital,
    specialization: translateText(hospital.specialization, language)
  }));
};

const addLanguage = (payload, language) => ({
  ...payload,
  symptoms: translateArray(payload.symptoms, language),
  possibleCauses: translateArray(payload.possibleCauses, language),
  prevention: translateArray(payload.prevention, language),
  whenToConsultDoctor: translateArray(payload.whenToConsultDoctor, language),
  emergencyAlert: translateText(payload.emergencyAlert, language),
  recommendedHospitals: translateHospitals(payload.recommendedHospitals || [], language)
});

const isUnsafeStructuredResponse = (parsed) => {
  const arrays = ['symptoms', 'possibleCauses', 'prevention', 'whenToConsultDoctor'];
  if (!arrays.every((key) => Array.isArray(parsed[key]) && parsed[key].length > 0)) return true;

  return arrays.some((key) =>
    parsed[key].some((entry) => {
      const text = String(entry || '').toLowerCase();
      return text.length > 140 || /(guaranteed cure|definitely cancer|100% sure|immediate cure)/.test(text);
    })
  );
};

const buildRuleBasedResponse = async (question, userId, language = 'en') => {
  const knowledgeMatches = extractKnowledgeMatches(question);
  const diseaseMatches = await fetchDiseaseMatches(question, knowledgeMatches);

  if (knowledgeMatches.length === 0 && diseaseMatches.length === 0) {
    const fallback = buildGeneralFallback();
    return addLanguage({
      ...fallback,
      confidenceScore: 0.52,
      promptVersion: PROMPT_VERSION,
      emergencyAlert: '',
      recommendedHospitals: []
    }, language);
  }

  const symptoms = dedupeNormalized([
    ...knowledgeMatches.flatMap((item) => item.symptoms),
    ...diseaseMatches.flatMap((item) => item.symptoms.split(',').map((part) => part.trim()))
  ], 5);

  const possibleCauses = dedupeNormalized([
    ...knowledgeMatches.flatMap((item) => item.causes),
    ...diseaseMatches.map((item) => item.disease_name),
    ...diseaseMatches.flatMap((item) => item.risk_factors.split(',').map((part) => part.trim()))
  ], 5);

  const prevention = dedupeNormalized([
    ...knowledgeMatches.flatMap((item) => item.prevention),
    ...diseaseMatches.flatMap((item) => item.prevention.split(',').map((part) => part.trim()))
  ], 5);

  const whenToConsultDoctor = dedupeNormalized([
    ...knowledgeMatches.flatMap((item) => item.whenToConsultDoctor),
    ...diseaseMatches.flatMap((item) => item.treatment.split(',').map((part) => part.trim()))
  ], 4);

  const riskLevel = inferRiskLevel(question);
  const recommendedHospitals = await getRecommendedHospitals(userId, riskLevel, question);

  return addLanguage({
    symptoms,
    possibleCauses,
    prevention,
    whenToConsultDoctor,
    riskLevel,
    confidenceScore: estimateConfidenceScore(knowledgeMatches, diseaseMatches, riskLevel),
    promptVersion: PROMPT_VERSION,
    emergencyAlert: riskLevel === 'High' ? 'High risk detected. Seek medical help immediately.' : '',
    recommendedHospitals
  }, language);
};

const parseStructuredJson = async (content, question, userId, language) => {
  try {
    const parsed = JSON.parse(content);
    if (isUnsafeStructuredResponse(parsed)) {
      return buildRuleBasedResponse(question, userId, language);
    }

    const knowledgeMatches = extractKnowledgeMatches(question);
    const diseaseMatches = await fetchDiseaseMatches(question, knowledgeMatches);
    const riskLevel = ['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : inferRiskLevel(question);
    const recommendedHospitals = await getRecommendedHospitals(userId, riskLevel, question);

    return addLanguage({
      symptoms: dedupeNormalized(parsed.symptoms, 5),
      possibleCauses: dedupeNormalized(parsed.possibleCauses, 5),
      prevention: dedupeNormalized(parsed.prevention, 5),
      whenToConsultDoctor: dedupeNormalized(parsed.whenToConsultDoctor, 4),
      riskLevel,
      confidenceScore: estimateConfidenceScore(knowledgeMatches, diseaseMatches, riskLevel),
      promptVersion: PROMPT_VERSION,
      emergencyAlert: riskLevel === 'High' ? 'High risk detected. Seek medical help immediately.' : '',
      recommendedHospitals
    }, language);
  } catch (_error) {
    return buildRuleBasedResponse(question, userId, language);
  }
};

const getAIResponse = async (question, userId, language = 'en') => {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const safeLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

  if (!apiKey || apiKey === 'replace_with_api_key') {
    return buildRuleBasedResponse(question, userId, safeLanguage);
  }

  const prompt = `You are a public health awareness assistant. Return strict JSON only with keys: symptoms, possibleCauses, prevention, whenToConsultDoctor, riskLevel. Values for list fields must be arrays of short bullet-style phrases. Use riskLevel in [Low, Medium, High]. Respond in ${safeLanguage === 'hi' ? 'Hindi' : 'English'}. Do not claim diagnosis certainty. User question: ${question}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You generate safe health-awareness information in JSON format with concise lists.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI API failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return parseStructuredJson(content, question, userId, safeLanguage);
};

const buildResponse = async (question, userId, language = 'en') => {
  const safeLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';

  try {
    const aiData = await getAIResponse(question, userId, safeLanguage);
    return {
      ...aiData,
      disclaimer: translateText(
        'This information is for awareness only and not a substitute for professional medical advice.',
        safeLanguage
      )
    };
  } catch (error) {
    logger.error('AI generation failed, serving fallback', { error: error.message });
    const fallback = await buildRuleBasedResponse(question, userId, safeLanguage);
    return {
      ...fallback,
      disclaimer: translateText('AI service was unavailable, so verified fallback information is shown.', safeLanguage)
    };
  }
};

module.exports = { buildResponse, PROMPT_VERSION };
