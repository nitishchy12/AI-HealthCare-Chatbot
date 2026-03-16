const { pool } = require('../config/db');
const { logger } = require('../utils/logger');

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
  const keywords = dedupeNormalized([
    normalized,
    ...knowledgeMatches.flatMap((item) => item.patterns)
  ], 8);

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

const buildRuleBasedResponse = async (question, userId) => {
  const knowledgeMatches = extractKnowledgeMatches(question);
  const diseaseMatches = await fetchDiseaseMatches(question, knowledgeMatches);

  if (knowledgeMatches.length === 0 && diseaseMatches.length === 0) {
    const fallback = buildGeneralFallback();
    return {
      ...fallback,
      emergencyAlert: '',
      recommendedHospitals: []
    };
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

  return {
    symptoms,
    possibleCauses,
    prevention,
    whenToConsultDoctor,
    riskLevel,
    emergencyAlert: riskLevel === 'High' ? 'High risk detected. Seek medical help immediately.' : '',
    recommendedHospitals
  };
};

const parseStructuredJson = async (content, question, userId) => {
  try {
    const parsed = JSON.parse(content);
    const fallback = await buildRuleBasedResponse(question, userId);
    return {
      symptoms: Array.isArray(parsed.symptoms) ? dedupeNormalized(parsed.symptoms, 5) : fallback.symptoms,
      possibleCauses: Array.isArray(parsed.possibleCauses) ? dedupeNormalized(parsed.possibleCauses, 5) : fallback.possibleCauses,
      prevention: Array.isArray(parsed.prevention) ? dedupeNormalized(parsed.prevention, 5) : fallback.prevention,
      whenToConsultDoctor: Array.isArray(parsed.whenToConsultDoctor) ? dedupeNormalized(parsed.whenToConsultDoctor, 4) : fallback.whenToConsultDoctor,
      riskLevel: ['Low', 'Medium', 'High'].includes(parsed.riskLevel) ? parsed.riskLevel : fallback.riskLevel,
      emergencyAlert: fallback.emergencyAlert,
      recommendedHospitals: fallback.recommendedHospitals
    };
  } catch (_err) {
    return buildRuleBasedResponse(question, userId);
  }
};

const getAIResponse = async (question, userId) => {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey === 'replace_with_api_key') {
    return buildRuleBasedResponse(question, userId);
  }

  const prompt = `You are a public health awareness assistant. Return strict JSON only with keys: symptoms, possibleCauses, prevention, whenToConsultDoctor, riskLevel. The values for symptoms, possibleCauses, prevention, and whenToConsultDoctor must be arrays of short bullet-style phrases, not long paragraphs. Use riskLevel in [Low, Medium, High]. User question: ${question}`;

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
        { role: 'system', content: 'You generate safe health-awareness information in JSON format.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI API failed with status ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '{}';
  return parseStructuredJson(content, question, userId);
};

const buildResponse = async (question, userId) => {
  try {
    const aiData = await getAIResponse(question, userId);
    return {
      ...aiData,
      disclaimer: 'This information is for awareness only and not a substitute for professional medical advice.'
    };
  } catch (error) {
    logger.error('AI generation failed, serving fallback', { error: error.message });
    const fallback = await buildRuleBasedResponse(question, userId);
    return {
      ...fallback,
      disclaimer: 'AI service was unavailable, so verified fallback information is shown.'
    };
  }
};

module.exports = { buildResponse };
